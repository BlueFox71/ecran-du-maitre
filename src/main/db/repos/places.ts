import { activeCampaignId, activeSessionId, getDb } from '../index'
import { copierLigne } from '../copie'
import { copierFiche } from './ficheLieu'
import * as reglages from './reglages'
import { lireCampagne } from '@shared/reglages'
import { planDe } from './echelle'
import {
  PARENT_TIERS,
  type Astre,
  type CielDuLieu,
  type Place,
  type PlaceTier,
  type PointMur
} from '@shared/types'

const SELECT = `
  SELECT p.id, p.tier, p.parent_id AS parentId, p.ord, p.name, p.summary, p.notes,
         p.map_item_id      AS mapItemId,
         p.ambience_item_id AS ambienceItemId,
         p.zone_pts AS zonePts, p.ancre_x AS ancreX, p.ancre_y AS ancreY,
         p.seen, p.ouv_largeur AS ouvLargeur, p.lum_garde AS lumGarde,
         p.piece_unique AS pieceUnique,
         p.regard_portee AS regardPortee, p.astre, p.astre_cap AS astreCap,
         p.nord, p.ciel, p.ciel_cap AS cielCap,
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

/** Un angle ramené entre 0 et 360 ; ce qui n'est pas un nombre vaut 0. */
function degres(v: number): number {
  return Number.isFinite(v) ? ((v % 360) + 360) % 360 : 0
}

function versAstre(nature: unknown, cap: unknown): Astre | null {
  return nature === 'soleil' || nature === 'lune' ? { nature, cap: degres(Number(cap)) } : null
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
    pieceUnique: !!r.pieceUnique,
    regardPortee:
      r.regardPortee === null || r.regardPortee === undefined ? null : Number(r.regardPortee),
    astre: versAstre(r.astre, r.astreCap),
    nord: degres(Number(r.nord)),
    ciel: r.tier === 'espace' ? versAstre(r.ciel, r.cielCap) : null,
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
    if (p.tier === 'espace') {
      for (const n of enfants(p.id, 'niveau')) poser(n)
      for (const b of enfants(p.id, 'lieu')) poser(b)
    }
    if (p.tier === 'niveau') for (const l of enfants(p.id, 'lieu')) poser(l)
    /* Un bâtiment : la chapelle tient ses propres étages. */
    if (p.tier === 'lieu') for (const n of enfants(p.id, 'niveau')) poser(n)
  }

  for (const e of enfants(null, 'espace')) poser(e)
  for (const p of plat) poser(p)
  return out
}

/** Tout ce qu'un contenant tient, à tous les étages en dessous de lui. */
export function descendants(id: number): Place[] {
  const tous = listPlaces()
  /* Pas de profondeur fixe : un bâtiment ajoute deux étages sous sa pièce. */
  const out: Place[] = []
  const vus = new Set<number>([id])
  const pile = [id]
  while (pile.length) {
    const pid = pile.shift()!
    for (const p of tous)
      if (p.parentId === pid && !vus.has(p.id)) {
        vus.add(p.id)
        out.push(p)
        pile.push(p.id)
      }
  }
  return out
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
 * Le soleil ou la lune de cette carte, et d'où vient sa lumière, compté depuis
 * le nord ; `null`, aucun. Sans effet visible tant que l'espace règle le ciel
 * pour tous : on le garde pour le jour où il le rend.
 */
export function setAstre(id: number, astre: Astre | null): Place | null {
  ecrireAstre(id, 'astre', 'astre_cap', astre)
  return getPlace(id)
}

/** Le ciel d'un espace : le soleil ou la lune de tous ses lieux ; `null`, chacun le sien. */
export function setCiel(espaceId: number, astre: Astre | null): Place | null {
  ecrireAstre(espaceId, 'ciel', 'ciel_cap', astre)
  return getPlace(espaceId)
}

function ecrireAstre(id: number, col: string, colCap: string, astre: Astre | null): void {
  if (!astre) {
    getDb().prepare(`UPDATE place SET ${col} = NULL WHERE id = ?`).run(id)
    return
  }
  const cap = Number.isFinite(astre.cap) ? degres(astre.cap) : 135
  const nature = astre.nature === 'lune' ? 'lune' : 'soleil'
  getDb().prepare(`UPDATE place SET ${col} = ?, ${colCap} = ? WHERE id = ?`).run(nature, cap, id)
}

/**
 * Où pointe le nord sur le plan de ce lieu — celui de l'étage, pour une pièce
 * découpée : elle en partage l'image, donc la boussole.
 */
export function setNord(id: number, nord: number): CielDuLieu {
  getDb().prepare(`UPDATE place SET nord = ? WHERE id = ?`).run(degres(nord), planDe(id))
  return cielDe(id)
}

/** L'espace qui tient ce lieu, en remontant ; `null`, il n'est rangé dans aucun. */
function espaceDe(id: number): Place | null {
  const vus = new Set<number>()
  let cur = getPlace(id)
  while (cur && !vus.has(cur.id)) {
    if (cur.tier === 'espace') return cur
    vus.add(cur.id)
    cur = cur.parentId == null ? null : getPlace(cur.parentId)
  }
  return null
}

/**
 * Le soleil ou la lune qui éclaire ce lieu, tourné dans le repère de son
 * image : le ciel de l'espace s'il en a un, sinon celui du lieu. Les caps se
 * comptent depuis le nord ; le nord du plan les remet à l'endroit.
 */
export function cielDe(id: number): CielDuLieu {
  const lieu = getPlace(id)
  const plan = lieu ? getPlace(planDe(id)) : null
  const nord = plan?.nord ?? 0
  const espace = lieu ? espaceDe(id) : null
  const general = espace?.ciel ? { espaceId: espace.id, nom: espace.name, astre: espace.ciel } : null
  /* Un espace ne règle plus d'astre à lui : son réglage, c'est le ciel. */
  const source = general?.astre ?? (lieu?.tier === 'espace' ? null : (lieu?.astre ?? null))
  return {
    astre: source ? { nature: source.nature, cap: degres(source.cap + nord) } : null,
    nord,
    general
  }
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

/** Ce lieu n'est qu'une pièce : ses murs le referment, il ne se découpe pas. */
export function setPieceUnique(id: number, unique: boolean): Place | null {
  getDb().prepare(`UPDATE place SET piece_unique = ? WHERE id = ?`).run(unique ? 1 : 0, id)
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
  /* Un niveau rangé dans un bâtiment qu'il tient lui-même : une boucle, et
     tout l'arbre disparaîtrait de la liste. */
  if (parentId !== null && (parentId === id || descendants(id).some((d) => d.id === parentId)))
    return listPlaces()

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
  const partent = [id, ...sous.map((p) => p.id)]
  db.transaction(() => {
    /* L'échelle et le nord sont ceux d'une image, pas d'un lieu : quand on
       efface un plan, un autre lieu qui montre la même image en entier les
       garde. Le « Rez-de-chaussée » né du plan d'un espace emportait sinon
       l'échelle qu'on y avait fixée, et l'espace revenait sans. */
    const marques = `(${partent.map(() => '?').join(',')})`
    const seance = (
      db.prepare(`SELECT session_id AS s FROM place WHERE id = ?`).get(id) as { s: number | null } | undefined
    )?.s ?? null
    const plans = db
      .prepare(
        `SELECT map_item_id AS carte, echelle, nord FROM place
          WHERE id IN ${marques} AND map_item_id IS NOT NULL AND zone_pts IS NULL`
      )
      .all(...partent) as { carte: number; echelle: number | null; nord: number }[]
    for (const pl of plans) {
      if (pl.echelle != null)
        db.prepare(
          `UPDATE place SET echelle = ?
            WHERE map_item_id = ? AND zone_pts IS NULL AND echelle IS NULL AND session_id IS ?
              AND id NOT IN ${marques}`
        ).run(pl.echelle, pl.carte, seance, ...partent)
      if (pl.nord)
        db.prepare(
          `UPDATE place SET nord = ?
            WHERE map_item_id = ? AND zone_pts IS NULL AND nord = 0 AND session_id IS ?
              AND id NOT IN ${marques}`
        ).run(pl.nord, pl.carte, seance, ...partent)
    }
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
 * les repères du MJ et les objets posés. Il arrive **pas encore
 * découvert** : la table qui entre à la scierie n'y est jamais venue, même si
 * celle d'avant avait tout visité. Les pions restent là-bas ; ceux des
 * joueurs se posent au moment d'entrer.
 *
 * Rend l'identifiant de la copie, rangée à la racine de l'arbre.
 */
export function duplicatePlace(id: number): number {
  const racine = getPlace(id)
  if (!racine) throw new Error('Lieu introuvable')
  let nouveau = new Map<number, number>()
  getDb().transaction(() => {
    nouveau = copierLieu(id, activeSessionId(), { parentId: null, ord: rangSuivant(racine.tier, null) })
  })()
  return nouveau.get(id)!
}

/**
 * Le cœur de la reprise, sans transaction : un lieu et tout ce qu'il tient,
 * recopiés dans la séance `sid`. La racine prend `parentId` et `ord` s'ils
 * sont donnés, garde les siens sinon. `jumeaux` raccroche le plan et
 * l'ambiance au double d'un fichier quand le dossier a été recopié avec la
 * séance. Rend la correspondance des identifiants, original → copie.
 */
export function copierLieu(
  id: number,
  sid: number,
  racine: { parentId?: number | null; ord?: number } = {},
  jumeaux: Map<number, number> = new Map()
): Map<number, number> {
  const db = getDb()
  const depart = getPlace(id)
  if (!depart) throw new Error('Lieu introuvable')
  const nouveau = new Map<number, number>()
  const ids = (sql: string, p: number): number[] =>
    (db.prepare(sql).all(p) as { id: number }[]).map((r) => r.id)
  const fichier = (v: number | null): number | null => (v == null ? null : (jumeaux.get(v) ?? v))

  for (const p of [depart, ...descendantsDe(id)]) {
    const brut = db
      .prepare(`SELECT map_item_id AS m, ambience_item_id AS a FROM place WHERE id = ?`)
      .get(p.id) as { m: number | null; a: number | null }
    const neuf = copierLigne('place', p.id, {
      session_id: sid,
      parent_id:
        p.id === id
          ? racine.parentId !== undefined
            ? racine.parentId
            : p.parentId
          : (nouveau.get(p.parentId!) ?? null),
      seen: 0,
      map_item_id: fichier(brut.m),
      ambience_item_id: fichier(brut.a),
      ...(p.id === id && racine.ord !== undefined ? { ord: racine.ord } : {})
    })
    nouveau.set(p.id, neuf)

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

    /* Sa fiche : scénarios, découvertes et déclencheurs, PNJ qu'on y croise. */
    copierFiche(p.id, neuf)
  }

  return nouveau
}

/**
 * Après un rognage : le lieu prend l'image rognée, et tout ce qui était posé
 * sur l'ancienne est recalé sur la nouvelle.
 *
 * Tout se tient en fractions de la carte : un point (x, y) devient
 * ((x − cx) / cw, (y − cy) / ch), et une longueur — rayon d'une lampe,
 * largeur d'une porte, portée du regard, taille des pions — se compte en part
 * de la **largeur**, donc se divise par cw. Ce qui tombe hors du cadre reste
 * hors du cadre : on ne détruit rien.
 *
 * Les pièces découpées sur ce plan, et les niveaux de bâtiment qui le
 * cadrent, suivent : ils partageaient l'image, ils partagent la nouvelle.

 */
export function recalerApresRognage(
  id: number,
  ancienne: number,
  nouvelle: number,
  c: { x: number; y: number; w: number; h: number }
): void {
  const db = getDb()
  const px = (x: number): number => (x - c.x) / c.w
  const py = (y: number): number => (y - c.y) / c.h
  const pt = (p: PointMur): PointMur => [px(p[0]), py(p[1])]
  const touches = [getPlace(id), ...descendantsDe(id)].filter(
    (p): p is Place => !!p && (p.id === id || p.mapItemId === ancienne)
  )

  db.transaction(() => {
    /* Une image rognée est plus étroite : l'échelle fixée au trait la suit.
       Un calage ne change pas l'image, son échelle non plus. */
    if (ancienne !== nouvelle)
      db.prepare(`UPDATE place SET echelle = echelle * ? WHERE id = ? AND echelle IS NOT NULL`).run(c.w, id)
    for (const p of touches) {
      db.prepare(
        `UPDATE place SET map_item_id = ?,
                          ouv_largeur = ouv_largeur / ?,
                          regard_portee = regard_portee / ?,
                          pion_size = MIN(24, MAX(2, pion_size / ?))
          WHERE id = ?`
      ).run(nouvelle, c.w, c.w, c.w, p.id)
      if (p.zone)
        db.prepare(
          `UPDATE place SET zone_pts = ?, ancre_x = ?, ancre_y = ? WHERE id = ?`
        ).run(
          JSON.stringify(p.zone.map(pt)),
          p.ancre ? px(p.ancre[0]) : null,
          p.ancre ? py(p.ancre[1]) : null,
          p.id
        )

      const mursIci = db.prepare(`SELECT id, pts FROM mur WHERE place_id = ?`).all(p.id) as {
        id: number
        pts: string
      }[]
      for (const m of mursIci) {
        try {
          const pts = (JSON.parse(m.pts) as PointMur[]).map(pt)
          db.prepare(`UPDATE mur SET pts = ? WHERE id = ?`).run(JSON.stringify(pts), m.id)
        } catch {
          /* Un trait illisible le restait déjà : on le laisse tel quel. */
        }
      }
      db.prepare(
        `UPDATE ouverture SET largeur = largeur / ?
          WHERE mur_id IN (SELECT id FROM mur WHERE place_id = ?)`
      ).run(c.w, p.id)
      db.prepare(
        `UPDATE lumiere SET x = (x - @cx) / @cw, y = (y - @cy) / @ch,
                            clair = clair / @cw, penombre = penombre / @cw
          WHERE place_id = @id`
      ).run({ cx: c.x, cy: c.y, cw: c.w, ch: c.h, id: p.id })
      for (const t of ['pion', 'annotation'])
        db.prepare(
          `UPDATE ${t} SET x = (x - @cx) / @cw, y = (y - @cy) / @ch WHERE place_id = @id`
        ).run({ cx: c.x, cy: c.y, cw: c.w, ch: c.h, id: p.id })
    }
  })()
}

/**
 * Le cadre qui garde la forme de ce qui est posé quand l'image change de
 * proportions.
 *
 * Tout se tient en fractions de la carte : sans rien faire, un plan carré
 * remplacé par une image deux fois plus large étirerait ses murs du double.
 * On place donc l'ancienne image **dans** la nouvelle, à ses propres
 * proportions, aussi grande que possible et centrée — et tout ce qui y était
 * posé la suit sans se déformer. On rogne ensuite pour recaler l'image sous
 * les murs.
 *
 * Le cadre se lit comme celui d'un rognage (`recalerApresRognage`), dont c'est
 * l'inverse : l'ancienne image y tient la place `1 / w` de la nouvelle. Sans
 * mesure de l'une ou l'autre, ou à proportions égales, rien ne bouge.
 */
export function cadrePourRemplacer(
  avant: { width: number | null; height: number | null } | null,
  apres: { width: number | null; height: number | null } | null
): { x: number; y: number; w: number; h: number } {
  const neutre = { x: 0, y: 0, w: 1, h: 1 }
  if (!avant?.width || !avant.height || !apres?.width || !apres.height) return neutre
  const a0 = avant.width / avant.height
  const a1 = apres.width / apres.height
  if (Math.abs(a0 / a1 - 1) <= 0.002) return neutre
  /* La part de la nouvelle image qu'occupe l'ancienne, en largeur et en hauteur. */
  const fw = a0 > a1 ? 1 : a0 / a1
  const fh = a0 > a1 ? a1 / a0 : 1
  const fx = (1 - fw) / 2
  const fy = (1 - fh) / 2
  return { x: -fx / fw, y: -fy / fh, w: 1 / fw, h: 1 / fh }
}

/** Ce qui se pose sur la carte d'un lieu et le suit quand il change de rôle. */
const CALQUES = ['mur', 'lumiere', 'annotation', 'pion'] as const

/** Les réglages de carte qu'un étage tient pour ses pièces. */
const REGLAGES_CARTE =
  'pion_size, pion_main, echelle, lum_garde, regard_portee, ouv_largeur, astre, astre_cap, nord'

/** Le premier contenant, en remontant, dont l'étage est admis au-dessus de `tier`. */
function contenantAdmis(depart: number | null, tier: PlaceTier): number | null {
  const admis = PARENT_TIERS[tier]
  const vus = new Set<number>()
  let cur = depart === null ? null : getPlace(depart)
  while (cur && !vus.has(cur.id)) {
    if (admis.includes(cur.tier)) return cur.id
    vus.add(cur.id)
    cur = cur.parentId === null ? null : getPlace(cur.parentId)
  }
  return null
}

/**
 * Changer un niveau en bâtiment, ou un bâtiment en niveau — sans rien perdre.
 *
 * **Niveau → bâtiment.** S'il tient des pièces ou des tracés, ils passent dans
 * un niveau neuf, « Rez-de-chaussée », rangé dans le bâtiment avec la même
 * image : les murs, les lampes, les repères et les pions vont avec les pièces
 * qu'ils bordent. Le bâtiment garde son image pour qu'on le reconnaisse.
 *
 * **Bâtiment → niveau.** Un seul niveau dedans : il se fond dans le nouveau
 * niveau, pièces et tracés compris. Plusieurs : on refuse, il faudrait
 * choisir lequel garder.
 *
 * Dans les deux cas, le lieu remonte jusqu'au premier contenant qui l'admet.
 */
export function changerEtage(id: number, tier: 'niveau' | 'lieu'): void {
  const db = getDb()
  const x = getPlace(id)
  if (!x || x.tier === tier || (x.tier !== 'niveau' && x.tier !== 'lieu')) return
  const enfantsDe = (pid: number): Place[] =>
    (db.prepare(`${SELECT} WHERE p.parent_id = ? ORDER BY p.ord, p.id`).all(pid) as any[]).map(
      toPlace
    )
  const deplacerCalques = (de: number, vers: number): void => {
    for (const t of CALQUES) db.prepare(`UPDATE ${t} SET place_id = ? WHERE place_id = ?`).run(vers, de)
  }
  const aDesCalques = (pid: number): boolean =>
    CALQUES.some(
      (t) => !!db.prepare(`SELECT 1 FROM ${t} WHERE place_id = ? LIMIT 1`).get(pid)
    )

  const enfants = enfantsDe(id)
  if (tier === 'niveau') {
    const niveaux = enfants.filter((q) => q.tier === 'niveau')
    if (niveaux.length > 1)
      throw new Error(
        `« ${x.name} » a ${niveaux.length} niveaux : range-les ailleurs, ou garde-le en bâtiment`
      )
  }

  db.transaction(() => {
    const parent = contenantAdmis(x.parentId, tier)
    const garderZone = parent === x.parentId

    if (tier === 'lieu' && (enfants.length || aDesCalques(id))) {
      const n = upsertPlace({
        tier: 'niveau',
        parentId: id,
        name: 'Rez-de-chaussée',
        mapItemId: x.mapItemId,
        zone: x.zone,
        seen: x.seen
      })
      db.prepare(
        `UPDATE place SET (${REGLAGES_CARTE}) = (SELECT ${REGLAGES_CARTE} FROM place WHERE id = ?)
          WHERE id = ?`
      ).run(id, n.id)
      db.prepare(`UPDATE place SET parent_id = ? WHERE parent_id = ? AND id <> ?`).run(n.id, id, n.id)
      deplacerCalques(id, n.id)
    }

    if (tier === 'niveau') {
      const n = enfants.find((q) => q.tier === 'niveau')
      if (n) {
        db.prepare(`UPDATE place SET parent_id = ? WHERE parent_id = ?`).run(id, n.id)
        deplacerCalques(n.id, id)
        if (!x.mapItemId)
          db.prepare(
            `UPDATE place SET map_item_id = ?, zone_pts = ?,
                              (${REGLAGES_CARTE}) = (SELECT ${REGLAGES_CARTE} FROM place WHERE id = ?)
              WHERE id = ?`
          ).run(n.mapItemId, n.zone ? JSON.stringify(n.zone) : null, n.id, id)
        db.prepare(`DELETE FROM place WHERE id = ?`).run(n.id)
      }
    }

    db.prepare(
      `UPDATE place SET tier = ?, parent_id = ?, ord = ?
                        ${garderZone ? '' : ', zone_pts = NULL, ancre_x = NULL, ancre_y = NULL'}
        WHERE id = ?`
    ).run(tier, parent, rangSuivant(tier, parent), id)
  })()
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
