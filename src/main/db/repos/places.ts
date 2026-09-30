import { activeCampaignId, activeSessionId, getDb } from '../index'
import { copierLigne } from '../copie'
import * as reglages from './reglages'
import { lireCampagne } from '@shared/reglages'
import type { Place, PlaceTier, PointMur } from '@shared/types'

const SELECT = `
  SELECT p.id, p.tier, p.parent_id AS parentId, p.ord, p.name, p.summary, p.notes,
         p.map_item_id      AS mapItemId,
         p.ambience_item_id AS ambienceItemId,
         p.zone_pts AS zonePts, p.ancre_x AS ancreX, p.ancre_y AS ancreY,
         p.seen, p.ouv_largeur AS ouvLargeur, p.lum_garde AS lumGarde,
         p.regard_portee AS regardPortee,
         (SELECT group_concat(pc.chapter_id, ',') FROM place_chapter pc WHERE pc.place_id = p.id) AS chapters,
         (SELECT COUNT(*) FROM item i WHERE i.place_id = p.id) AS docCount
    FROM place p`

/**
 * Le contour tel qu'il sort de la base. On se méfie de ce qu'on relit : un
 * JSON abîmé ne doit pas empêcher le lieu de s'ouvrir, il doit seulement lui
 * ôter sa forme — que le MJ verra manquer.
 */
function toContour(brut: unknown): PointMur[] | null {
  if (typeof brut !== 'string') return null
  try {
    const v = JSON.parse(brut)
    if (!Array.isArray(v) || v.length < 3) return null
    const pts = v
      .filter(
        (p) => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1])
      )
      .map((p) => [p[0], p[1]] as PointMur)
    return pts.length >= 3 ? pts : null
  } catch {
    return null
  }
}

function toPlace(r: any): Place {
  return {
    id: r.id,
    tier: (r.tier ?? 'lieu') as PlaceTier,
    parentId: r.parentId,
    ord: r.ord ?? 0,
    name: r.name,
    summary: r.summary,
    notes: r.notes,
    mapItemId: r.mapItemId,
    zone: toContour(r.zonePts),
    ancre:
      r.ancreX === null || r.ancreX === undefined ? null : [r.ancreX, r.ancreY],
    ambienceItemId: r.ambienceItemId,
    seen: !!r.seen,
    ouvLargeur:
      r.ouvLargeur === null || r.ouvLargeur === undefined ? null : Number(r.ouvLargeur),
    lumGarde: !!r.lumGarde,
    regardPortee:
      r.regardPortee === null || r.regardPortee === undefined ? null : Number(r.regardPortee),
    chapterIds: r.chapters ? String(r.chapters).split(',').map(Number) : [],
    docCount: r.docCount
  }
}

/**
 * Les lieux d'une séance — la séance en cours si on n'en nomme pas.
 *
 * Un lieu sans séance est commun : il vient d'une séance qu'on a supprimée,
 * et on le montre partout plutôt que de le perdre. La migration 42 dit le
 * reste.
 *
 * La liste sort déjà dans l'ordre de l'arbre : chaque espace suivi de ses
 * niveaux, chaque niveau suivi de ses lieux, et à la fin ce qui n'est rangé
 * nulle part. Les interfaces n'ont plus qu'à lire — voir `arbreDesLieux`.
 */
export function listPlaces(sessionId: number = activeSessionId()): Place[] {
  const plat = (
    getDb()
      .prepare(
        `${SELECT} WHERE p.campaign_id = ? AND (p.session_id = ? OR p.session_id IS NULL)
          ORDER BY p.ord, p.id`
      )
      .all(activeCampaignId(), sessionId) as any[]
  ).map(toPlace)

  const enfants = (pid: number | null, tier: PlaceTier): Place[] =>
    plat.filter((p) => p.tier === tier && p.parentId === pid)

  /*
   * On descend depuis les espaces, puis on ramasse tout ce que la descente n'a
   * pas atteint — et ce que celui-là tient à son tour.
   *
   * Ce second passage n'est pas une précaution : un niveau qu'on vient de
   * créer n'a pas encore d'espace, et sans lui ses pièces sortaient de la
   * liste. Elles existaient en base et n'apparaissaient nulle part.
   */
  const out: Place[] = []
  const vus = new Set<number>()
  const poser = (p: Place): void => {
    if (vus.has(p.id)) return
    vus.add(p.id)
    out.push(p)
    if (p.tier === 'espace') for (const n of enfants(p.id, 'niveau')) poser(n)
    if (p.tier === 'niveau') for (const l of enfants(p.id, 'lieu')) poser(l)
  }

  for (const e of enfants(null, 'espace')) poser(e)
  for (const p of plat) poser(p)
  return out
}

/** Tout ce qu'un contenant tient, à tous les étages en dessous de lui. */
export function descendants(id: number): Place[] {
  const tous = listPlaces()
  const directs = tous.filter((p) => p.parentId === id)
  return [...directs, ...directs.flatMap((d) => tous.filter((p) => p.parentId === d.id))]
}

export function getPlace(id: number): Place | null {
  const r = getDb().prepare(`${SELECT} WHERE p.id = ?`).get(id)
  return r ? toPlace(r) : null
}

/** Le rang libre au bout d'une fratrie : on crée toujours à la suite. */
function rangSuivant(tier: PlaceTier, parentId: number | null): number {
  const r = getDb()
    .prepare(
      `SELECT COALESCE(MAX(ord), -1) + 1 AS n FROM place
        WHERE campaign_id = ? AND tier = ? AND parent_id IS ?
          AND (session_id = ? OR session_id IS NULL)`
    )
    .get(activeCampaignId(), tier, parentId, activeSessionId()) as { n: number }
  return r.n
}

/**
 * La séance où naît un lieu : celle de son contenant s'il en a un — une
 * pièce ajoutée à un étage commun reste commune avec lui —, la séance en
 * cours sinon.
 */
function seanceDeNaissance(parentId: number | null): number | null {
  if (parentId) {
    const r = getDb().prepare(`SELECT session_id AS s FROM place WHERE id = ?`).get(parentId) as
      | { s: number | null }
      | undefined
    if (r) return r.s
  }
  return activeSessionId()
}

export function upsertPlace(input: {
  id?: number
  tier?: PlaceTier
  parentId?: number | null
  name: string
  summary?: string | null
  notes?: string | null
  mapItemId?: number | null
  zone?: PointMur[] | null
  ancre?: PointMur | null
  ambienceItemId?: number | null
  seen?: boolean
  chapterIds?: number[]
}): Place {
  const db = getDb()
  const neufs = lireCampagne(reglages.tous())
  let id = input.id ?? 0

  db.transaction(() => {
    if (id) {
      const cur = getPlace(id)!
      const zone = input.zone !== undefined ? input.zone : cur.zone
      const ancre = input.ancre !== undefined ? input.ancre : cur.ancre
      db.prepare(
        `UPDATE place SET tier = @tier, parent_id = @parentId,
                          name = @name, summary = @summary, notes = @notes,
                          map_item_id = @mapItemId, ambience_item_id = @ambienceItemId,
                          zone_pts = @zonePts, ancre_x = @ancreX, ancre_y = @ancreY,
                          seen = @seen
          WHERE id = @id`
      ).run({
        id,
        tier: input.tier ?? cur.tier,
        parentId: input.parentId !== undefined ? input.parentId : cur.parentId,
        name: input.name,
        summary: input.summary !== undefined ? input.summary : cur.summary,
        notes: input.notes !== undefined ? input.notes : cur.notes,
        mapItemId: input.mapItemId !== undefined ? input.mapItemId : cur.mapItemId,
        ambienceItemId:
          input.ambienceItemId !== undefined ? input.ambienceItemId : cur.ambienceItemId,
        zonePts: zone ? JSON.stringify(zone) : null,
        ancreX: ancre ? ancre[0] : null,
        ancreY: ancre ? ancre[1] : null,
        seen: (input.seen !== undefined ? input.seen : cur.seen) ? 1 : 0
      })
    } else {
      const tier = input.tier ?? 'lieu'
      const parentId = input.parentId ?? null
      const info = db
        .prepare(
          `INSERT INTO place (campaign_id, session_id, tier, parent_id, ord, name, summary, notes,
                               map_item_id, ambience_item_id,
                               zone_pts, ancre_x, ancre_y, seen,
                               regard_portee, lum_garde)
           VALUES (@cid, @sid, @tier, @parentId, @ord, @name, @summary, @notes,
                   @mapItemId, @ambienceItemId,
                   @zonePts, @ancreX, @ancreY, @seen,
                   @regardPortee, @lumGarde)`
        )
        .run({
          cid: activeCampaignId(),
          sid: seanceDeNaissance(parentId),
          tier,
          parentId,
          ord: rangSuivant(tier, parentId),
          name: input.name,
          summary: input.summary ?? null,
          notes: input.notes ?? null,
          mapItemId: input.mapItemId ?? null,
          ambienceItemId: input.ambienceItemId ?? null,
          zonePts: input.zone ? JSON.stringify(input.zone) : null,
          ancreX: input.ancre ? input.ancre[0] : null,
          ancreY: input.ancre ? input.ancre[1] : null,
          /* Un lieu qu'on vient d'écrire, le groupe n'y est pas encore passé. */
          seen: input.seen ? 1 : 0,
          /* La carte naît avec les habitudes de la campagne : on les a réglées
             une fois dans les paramètres, et chaque plan peut ensuite s'en
             écarter sans que les suivants l'apprennent. */
          regardPortee: neufs.mursPortee,
          lumGarde: neufs.mursGarde ? 1 : 0
        })
      id = Number(info.lastInsertRowid)
    }

    if (input.chapterIds) {
      db.prepare(`DELETE FROM place_chapter WHERE place_id = ?`).run(id)
      const ins = db.prepare(
        `INSERT OR IGNORE INTO place_chapter (place_id, chapter_id) VALUES (?, ?)`
      )
      for (const c of input.chapterIds) ins.run(id, c)
    }
  })()

  return getPlace(id)!
}

/** Le groupe y est entré, ou on s'était trompé. Rien d'autre ne bouge. */
export function setSeen(id: number, seen: boolean): Place | null {
  getDb().prepare(`UPDATE place SET seen = ? WHERE id = ?`).run(seen ? 1 : 0, id)
  return getPlace(id)
}

/**
 * Jusqu'où le regard porte sur cette carte.
 *
 * `null` remet le regard sans limite — il n'ira alors que jusqu'au mur, comme
 * il a toujours fait. Les valeurs aberrantes sont ramenées à des bornes qui
 * veulent dire quelque chose : moins de 2 % de la carte, on ne voit plus ses
 * pieds ; au-delà d'une carte entière, ce n'est plus une portée.
 */
export function setRegardPortee(id: number, portee: number | null): Place | null {
  const v =
    portee === null || !Number.isFinite(portee) ? null : Math.min(1.5, Math.max(0.02, portee))
  getDb().prepare(`UPDATE place SET regard_portee = ? WHERE id = ?`).run(v, id)
  return getPlace(id)
}

/**
 * Ce que la lumière laisse derrière elle, sur cette carte.
 *
 * Coché, une zone éclairée une fois reste découverte ; décoché, elle retombe
 * au noir dès qu'on ne la voit plus. C'est une règle de la carte : toutes ses
 * lampes la suivent, y compris celle que le pion porte.
 */
export function setLumGarde(id: number, garde: boolean): Place | null {
  getDb().prepare(`UPDATE place SET lum_garde = ? WHERE id = ?`).run(garde ? 1 : 0, id)
  return getPlace(id)
}

/**
 * La largeur des prochaines ouvertures de cette carte.
 *
 * On la retient au lieu de la retaper : sur un même plan, les portes se
 * ressemblent. `null` remet la largeur d'usine ; les valeurs aberrantes sont
 * ramenées aux bornes que le dépôt des ouvertures applique déjà.
 */
export function setOuvLargeur(id: number, largeur: number | null): Place | null {
  const v =
    largeur === null || !Number.isFinite(largeur)
      ? null
      : Math.min(0.3, Math.max(0.01, largeur))
  getDb().prepare(`UPDATE place SET ouv_largeur = ? WHERE id = ?`).run(v, id)
  return getPlace(id)
}

/**
 * Le rectangle qu'une pièce occupe sur le plan de son étage.
 *
 * Poser une zone, c'est adopter la carte du niveau : la pièce ne se cherche
 * plus d'image à elle. L'enlever laisse la carte adoptée en place — sinon le
 * lieu deviendrait aveugle au moment où l'on hésite.
 */
export function setZone(
  id: number,
  zone: PointMur[] | null,
  ancre?: PointMur | null
): Place | null {
  const db = getDb()
  const p = getPlace(id)
  if (!p) return null

  db.transaction(() => {
    if (zone && zone.length >= 3) {
      const parent = p.parentId ? getPlace(p.parentId) : null
      db.prepare(
        `UPDATE place SET zone_pts = @pts, ancre_x = @ax, ancre_y = @ay,
                          map_item_id = COALESCE(@map, map_item_id)
          WHERE id = @id`
      ).run({
        id,
        pts: JSON.stringify(zone),
        ax: ancre !== undefined && ancre ? ancre[0] : (p.ancre?.[0] ?? null),
        ay: ancre !== undefined && ancre ? ancre[1] : (p.ancre?.[1] ?? null),
        map: parent?.mapItemId ?? null
      })
    } else {
      db.prepare(
        `UPDATE place SET zone_pts = NULL, ancre_x = NULL, ancre_y = NULL WHERE id = ?`
      ).run(id)
    }
  })()

  return getPlace(id)
}

/**
 * Ranger un lieu ailleurs, ou le remuer parmi ses frères.
 *
 * `beforeId` dit devant qui il se pose ; `null`, il va au bout. Les rangs sont
 * réécrits d'affilée après coup : on ne cherche pas à glisser une valeur entre
 * deux autres, une fratrie de lieux tient dans une poignée de lignes.
 *
 * Un lieu qui change d'étage perd sa zone : un rectangle tracé sur le plan du
 * premier ne veut rien dire au rez-de-chaussée.
 */
export function movePlace(id: number, parentId: number | null, beforeId: number | null): Place[] {
  const db = getDb()
  const p = getPlace(id)
  if (!p) return listPlaces()

  db.transaction(() => {
    const changeDeContenant = p.parentId !== parentId
    if (changeDeContenant) {
      db.prepare(`UPDATE place SET parent_id = ? WHERE id = ?`).run(parentId, id)
      if (p.zone)
        db.prepare(
          `UPDATE place SET zone_pts = NULL, ancre_x = NULL, ancre_y = NULL WHERE id = ?`
        ).run(id)
    }

    const freres = (
      db
        .prepare(
          `SELECT id FROM place
            WHERE campaign_id = ? AND tier = ? AND parent_id IS ? AND id <> ?
              AND (session_id = ? OR session_id IS NULL)
            ORDER BY ord, id`
        )
        .all(activeCampaignId(), p.tier, parentId, id, activeSessionId()) as { id: number }[]
    ).map((r) => r.id)

    const at = beforeId === null ? freres.length : freres.indexOf(beforeId)
    freres.splice(at < 0 ? freres.length : at, 0, id)

    const rang = db.prepare(`UPDATE place SET ord = ? WHERE id = ?`)
    freres.forEach((fid, i) => rang.run(i, fid))
  })()

  return listPlaces()
}

/**
 * Supprime le lieu et tout ce qu'il tient. L'interface prévient d'abord de ce
 * qu'elle va détruire : ici on ne fait qu'exécuter, du bas vers le haut.
 */
export function removePlace(id: number): void {
  const db = getDb()
  const sous = descendants(id)
  db.transaction(() => {
    const del = db.prepare(`DELETE FROM place WHERE id = ?`)
    for (const p of [...sous].reverse()) del.run(p.id)
    del.run(id)
  })()
}

/**
 * Reprendre un lieu d'une autre séance : une copie, jamais un partage.
 *
 * Le lieu arrive avec tout ce qu'il tient — ses étages et ses pièces, et pour
 * chacun le plan, le découpage, les murs et leurs ouvertures, les lumières,
 * les repères du MJ, les chapitres et les objets posés. Il arrive **pas encore
 * découvert** : la table qui entre à la scierie n'y est jamais venue, même si
 * celle d'avant avait tout visité. Les pions restent là-bas ; ceux des
 * joueurs se posent au moment d'entrer.
 *
 * Rend l'identifiant de la copie, rangée à la racine de l'arbre.
 */
export function duplicatePlace(id: number): number {
  const db = getDb()
  const racine = getPlace(id)
  if (!racine) throw new Error('Lieu introuvable')
  const sid = activeSessionId()
  const nouveau = new Map<number, number>()
  const ids = (sql: string, p: number): number[] =>
    (db.prepare(sql).all(p) as { id: number }[]).map((r) => r.id)

  db.transaction(() => {
    for (const p of [racine, ...descendantsDe(id)]) {
      const neuf = copierLigne('place', p.id, {
        session_id: sid,
        parent_id: p.id === id ? null : (nouveau.get(p.parentId!) ?? null),
        seen: 0,
        ...(p.id === id ? { ord: rangSuivant(p.tier, null) } : {})
      })
      nouveau.set(p.id, neuf)

      db.prepare(
        `INSERT INTO place_chapter (place_id, chapter_id)
           SELECT ?, chapter_id FROM place_chapter WHERE place_id = ?`
      ).run(neuf, p.id)

      for (const m of ids(`SELECT id FROM mur WHERE place_id = ?`, p.id)) {
        const mur = copierLigne('mur', m, { place_id: neuf })
        for (const o of ids(`SELECT id FROM ouverture WHERE mur_id = ?`, m))
          copierLigne('ouverture', o, { mur_id: mur })
      }
      for (const l of ids(`SELECT id FROM lumiere WHERE place_id = ?`, p.id))
        copierLigne('lumiere', l, { place_id: neuf })
      for (const a of ids(`SELECT id FROM annotation WHERE place_id = ?`, p.id))
        copierLigne('annotation', a, { place_id: neuf })

      /* Un objet déjà trouvé là-bas est de nouveau à trouver ici. */
      for (const o of ids(`SELECT id FROM objet_placement WHERE place_id = ?`, p.id))
        copierLigne('objet_placement', o, { place_id: neuf, session_id: sid, etat: 'cache' })
    }
  })()

  return nouveau.get(id)!
}

/** Tout ce qu'un lieu tient, parents avant enfants, quelle que soit la séance. */
function descendantsDe(id: number): Place[] {
  const out: Place[] = []
  const pile = [id]
  while (pile.length) {
    const enfants = (
      getDb().prepare(`${SELECT} WHERE p.parent_id = ? ORDER BY p.ord, p.id`).all(pile.shift()!) as any[]
    ).map(toPlace)
    out.push(...enfants)
    pile.push(...enfants.map((e) => e.id))
  }
  return out
}
