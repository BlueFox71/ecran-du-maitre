/**
 * La réserve de la campagne : ce qui se trouve, se ramasse, se porte.
 *
 * Un objet est un **modèle**. Le poser quelque part crée un exemplaire —
 * une ligne de `objet_placement` — et le même modèle peut en avoir dix. C'est
 * ce qui permet de corriger une description une fois pour toute la campagne.
 *
 * Comme les annotations et les murs, ce dépôt est **isolé de `display.ts`** :
 * rien de ce qu'il renvoie ne rejoint l'état de diffusion. Ce que le MJ sait
 * d'un objet ne peut donc pas atteindre la fenêtre des joueurs par accident —
 * la garantie tient à la forme des données, pas à un drapeau qu'on penserait
 * à vérifier.
 */
import { activeCampaignId, activeSessionId, getDb } from '../index'
import { copierLigne } from '../copie'
import { UNITE_VALEUR_PAR_DEFAUT, eclaire, lisCadreCarre } from '@shared/types'
import { lireCampagne } from '@shared/reglages'
import { EPSILON_SAC, REFUS_SAC, ditPlaces, etatSac, sacPlein } from '@shared/sac'
import type { EtatSac, LigneSac } from '@shared/sac'
import * as reglages from './reglages'
import type {
  CadreCarre,
  EffetObjet,
  EmplacementInitial,
  Inventaire,
  Objet,
  ObjetFamille,
  ObjetPlacement,
  PortObjet
} from '@shared/types'

/* ---------------- l'unité de valeur, réglée une fois ---------------- */

/**
 * Francs, pièces d'or, crédits : le nom de l'unité appartient à la campagne.
 * Chaque objet ne porte qu'un nombre, si bien qu'un total reste calculable.
 */
export function uniteValeur(): string {
  const r = getDb().prepare(`SELECT value FROM setting WHERE key = 'objets.unite'`).get() as
    { value: string | null } | undefined
  const v = r?.value?.trim()
  return v ? v : UNITE_VALEUR_PAR_DEFAUT
}

export function setUniteValeur(unite: string): string {
  const v = unite.trim() || UNITE_VALEUR_PAR_DEFAUT
  getDb()
    .prepare(
      `INSERT INTO setting (key, value) VALUES ('objets.unite', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    .run(v)
  return v
}

/* ---------------- les familles ---------------- */

function toFamille(r: any): ObjetFamille {
  return {
    id: r.id,
    nom: r.nom,
    teinte: r.teinte ?? 'neutral',
    glyphe: r.glyphe ?? 'outils',
    ord: r.ord,
    builtin: !!r.builtin,
    verrouillee: !!r.verrouillee,
    masquee: !!r.masquee
  }
}

/* Ce que la séance ouverte sait d'une catégorie.

   Verrouillée : un de ses objets a un exemplaire posé dans une autre séance.
   Un exemplaire sans séance — d'avant le cloisonnement — vaut pour toutes ;
   il ne verrouille que s'il existe une autre séance que la nôtre.

   Masquée : depuis la séance ouverte, ou une qui la précède dans l'ordre des
   séances. Celles d'avant la montrent encore. */
const SELECT_FAMILLE = `
  SELECT f.id, f.nom, f.teinte, f.glyphe, f.ord, f.builtin,
         EXISTS (
           SELECT 1 FROM objet_placement p JOIN objet o ON o.id = p.objet_id
            WHERE o.famille_id = f.id
              AND (p.session_id <> @seance
                   OR (p.session_id IS NULL AND EXISTS (
                         SELECT 1 FROM game_session g
                          WHERE g.campaign_id = f.campaign_id AND g.id <> @seance)))
         ) AS verrouillee,
         EXISTS (
           SELECT 1 FROM game_session m, game_session c
            WHERE m.id = f.masquee_depuis AND c.id = @seance
              AND (c.ord, c.id) >= (m.ord, m.id)
         ) AS masquee
    FROM objet_famille f`

function uneFamille(id: number): ObjetFamille | null {
  const r = getDb()
    .prepare(`${SELECT_FAMILLE} WHERE f.id = @id`)
    .get({ id, seance: activeSessionId() })
  return r ? toFamille(r) : null
}

export function listFamilles(): ObjetFamille[] {
  return (
    getDb()
      .prepare(`${SELECT_FAMILLE} WHERE f.campaign_id = @cid ORDER BY f.ord, f.id`)
      .all({ cid: activeCampaignId(), seance: activeSessionId() }) as any[]
  ).map(toFamille)
}

export function addFamille(input: { nom: string; teinte?: string; glyphe?: string }): ObjetFamille {
  const db = getDb()
  const cid = activeCampaignId()
  const ord =
    ((db.prepare(`SELECT MAX(ord) AS m FROM objet_famille WHERE campaign_id = ?`).get(cid) as any)
      ?.m ?? -1) + 1
  const info = db
    .prepare(
      `INSERT INTO objet_famille (campaign_id, nom, teinte, glyphe, ord, builtin)
       VALUES (?, ?, ?, ?, ?, 0)`
    )
    .run(
      cid,
      input.nom.trim() || 'Sans nom',
      input.teinte ?? 'neutral',
      input.glyphe ?? 'outils',
      ord
    )
  return uneFamille(Number(info.lastInsertRowid))!
}

export function updateFamille(
  id: number,
  patch: { nom?: string; teinte?: string; glyphe?: string }
): ObjetFamille | null {
  const db = getDb()
  const cur = uneFamille(id)
  if (!cur) return null
  /* Elle a servi ailleurs : ce que les autres séances en ont vu ne change pas. */
  if (cur.verrouillee) return cur
  db.prepare(
    `UPDATE objet_famille SET nom = @nom, teinte = @teinte, glyphe = @glyphe WHERE id = @id`
  ).run({
    id,
    nom: patch.nom !== undefined ? patch.nom.trim() || cur.nom : cur.nom,
    teinte: patch.teinte ?? cur.teinte,
    glyphe: patch.glyphe ?? cur.glyphe
  })
  return uneFamille(id)
}

/** Retirer un rayon ne retire pas ce qu'il contenait : les objets restent, sans famille. */
export function removeFamille(id: number): void {
  if (uneFamille(id)?.verrouillee) return
  getDb().prepare(`DELETE FROM objet_famille WHERE id = ?`).run(id)
}

/** Masquer à partir de la séance ouverte, ou réafficher partout. */
export function masquerFamille(id: number, masquee: boolean): ObjetFamille | null {
  getDb()
    .prepare(`UPDATE objet_famille SET masquee_depuis = ? WHERE id = ?`)
    .run(masquee ? activeSessionId() : null, id)
  return uneFamille(id)
}

/* ---------------- les objets ---------------- */

const SELECT_OBJET = `
  SELECT id, nom, famille_id AS familleId, image_item_id AS imageItemId, image_cadre AS imageCadre,
         unique_piece AS uniquePiece, qte, poids, places, bonus_sac AS bonusSac, valeur, prix, vu, su,
         equipable, emplacements, charge_nom AS chargeNom, charge_max AS chargeMax, effets
    FROM objet`

/** Les endroits du corps notés sur l'objet ; une liste vide si rien n'est dit. */
function lireEmplacements(brut: string | null): string[] {
  if (!brut) return []
  try {
    const v = JSON.parse(brut)
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

/** Le prix, une monnaie par clé ; `null` quand rien n'est dit. */
function lirePrix(brut: string | null): Record<string, number> | null {
  if (!brut) return null
  try {
    const v = JSON.parse(brut)
    if (!v || typeof v !== 'object') return null
    const out: Record<string, number> = {}
    for (const [k, n] of Object.entries(v)) if (typeof n === 'number' && n !== 0) out[k] = n
    return Object.keys(out).length ? out : null
  } catch {
    return null
  }
}

function lireEffets(brut: string | null): EffetObjet[] {
  if (!brut) return []
  try {
    const v = JSON.parse(brut)
    if (!Array.isArray(v)) return []
    return v
      .filter((e) => e && typeof e === 'object')
      .map((e, i) => ({
        id: String(e.id ?? `e${i}`),
        tete: String(e.tete ?? ''),
        detail: String(e.detail ?? ''),
        ...(typeof e.teinte === 'string' ? { teinte: e.teinte } : {})
      }))
  } catch {
    return []
  }
}

function toObjet(r: any, ex: Exemplaires | undefined): Objet {
  return {
    id: r.id,
    nom: r.nom,
    familleId: r.familleId,
    imageItemId: r.imageItemId,
    imageCadre: lisCadreCarre(r.imageCadre),
    unique: !!r.uniquePiece,
    qte: r.qte ?? 1,
    poids: r.poids,
    places: r.places == null ? 1 : Number(r.places),
    bonusSac: r.bonusSac == null ? 0 : Number(r.bonusSac),
    valeur: r.valeur == null ? null : Number(r.valeur),
    prix: lirePrix(r.prix),
    vu: r.vu ?? '',
    su: r.su ?? '',
    equipable: !!r.equipable,
    emplacements: lireEmplacements(r.emplacements),
    chargeNom: r.chargeNom,
    chargeMax: r.chargeMax == null ? null : Number(r.chargeMax),
    effets: lireEffets(r.effets),
    placements: ex?.placements ?? [],
    corbeille: ex?.corbeille ?? []
  }
}

/** Les exemplaires d'un objet : ceux qui sont quelque part, ceux qu'on a jetés. */
interface Exemplaires {
  placements: ObjetPlacement[]
  corbeille: ObjetPlacement[]
}

function lireEtat(v: string | null): ObjetPlacement['etat'] {
  return v === 'trouve' ? 'trouve' : v === 'porte' ? 'porte' : 'cache'
}

/* Il a bougé : son port ou sa cible n'est plus celle du départ. L'endroit du
   corps ne compte pas — changer une arme de main n'est pas la déplacer. */
const DEPLACE = `(p.port <> p.init_port
   OR COALESCE(p.place_id, -1) <> COALESCE(p.init_place_id, -1)
   OR COALESCE(p.character_id, -1) <> COALESCE(p.init_character_id, -1)
   OR COALESCE(p.inventaire_id, -1) <> COALESCE(p.init_inventaire_id, -1))`

/* L'emplacement initial est perdu quand sa cible a été supprimée. */
function lireInitial(r: any): EmplacementInitial | null {
  const port = r.initPort as PortObjet | null
  if (!port || port === 'corbeille') return null
  const id = port === 'lieu' ? r.initPlaceId : port === 'inventaire' ? r.initInventaireId : r.initCharacterId
  if (id == null) return null
  return {
    port,
    placeId: r.initPlaceId ?? null,
    characterId: r.initCharacterId ?? null,
    inventaireId: r.initInventaireId ?? null,
    emplacement: r.initEmplacement ?? null,
    etat: lireEtat(r.initEtat),
    cible: r.initCible ?? '—'
  }
}

/**
 * Où sont les exemplaires — le nom du lieu ou du personnage résolu à la
 * lecture, pour que la fiche se lise sans aller le chercher ailleurs.
 */
function placementsOf(objetIds: number[]): Map<number, Exemplaires> {
  const par = new Map<number, Exemplaires>()
  if (objetIds.length === 0) return par
  const rows = getDb()
    .prepare(
      `SELECT p.id, p.objet_id AS objetId, p.port, p.place_id AS placeId,
              p.character_id AS characterId, p.inventaire_id AS inventaireId,
              p.detail, p.qte, p.etat, p.emplacement, p.origine_place_id AS origineLieuId,
              p.eteinte, p.pos_x AS posX, p.pos_y AS posY,
              CASE WHEN p.port = 'corbeille' THEN 'Corbeille'
                   ELSE COALESCE(l.name, c.name, i.nom, '—') END AS cible,
              p.init_port AS initPort, p.init_place_id AS initPlaceId,
              p.init_character_id AS initCharacterId, p.init_inventaire_id AS initInventaireId,
              p.init_emplacement AS initEmplacement, p.init_etat AS initEtat,
              COALESCE(l2.name, c2.name, i2.nom) AS initCible,
              ${DEPLACE} AS deplace
         FROM objet_placement p
         LEFT JOIN place l       ON l.id = p.place_id
         LEFT JOIN character c   ON c.id = p.character_id
         LEFT JOIN inventaire i  ON i.id = p.inventaire_id
         LEFT JOIN place l2      ON l2.id = p.init_place_id
         LEFT JOIN character c2  ON c2.id = p.init_character_id
         LEFT JOIN inventaire i2 ON i2.id = p.init_inventaire_id
        WHERE p.objet_id IN (${objetIds.map(() => '?').join(',')})
          AND (p.session_id = ? OR p.session_id IS NULL)
        ORDER BY p.ord, p.id`
    )
    .all(...objetIds, activeSessionId()) as any[]
  for (const r of rows) {
    const ligne: ObjetPlacement = {
      id: r.id,
      objetId: r.objetId,
      port: r.port as PortObjet,
      placeId: r.placeId,
      characterId: r.characterId,
      inventaireId: r.inventaireId ?? null,
      cible: r.cible,
      precision: r.detail,
      emplacement: r.emplacement ?? null,
      origineLieuId: r.origineLieuId ?? null,
      qte: r.qte ?? 1,
      etat: lireEtat(r.etat),
      initial: lireInitial(r),
      deplace: !!r.deplace,
      eteinte: !!r.eteinte,
      pos: r.port === 'lieu' && r.posX != null && r.posY != null ? { x: r.posX, y: r.posY } : null
    }
    let ex = par.get(r.objetId)
    if (!ex) par.set(r.objetId, (ex = { placements: [], corbeille: [] }))
    if (ligne.port === 'corbeille') ex.corbeille.push(ligne)
    else ex.placements.push(ligne)
  }
  return par
}

export function listObjets(): Objet[] {
  const rows = getDb()
    .prepare(`${SELECT_OBJET} WHERE campaign_id = ? ORDER BY ord, id`)
    .all(activeCampaignId()) as any[]
  const par = placementsOf(rows.map((r) => r.id))
  return rows.map((r) => toObjet(r, par.get(r.id)))
}

export function getObjet(id: number): Objet | null {
  const r = getDb().prepare(`${SELECT_OBJET} WHERE id = ?`).get(id) as any
  if (!r) return null
  return toObjet(r, placementsOf([id]).get(id))
}

export interface ObjetPatch {
  nom?: string
  familleId?: number | null
  imageItemId?: number | null
  imageCadre?: CadreCarre | null
  unique?: boolean
  qte?: number
  poids?: string | null
  places?: number
  bonusSac?: number
  valeur?: number | null
  prix?: Record<string, number> | null
  vu?: string
  su?: string
  equipable?: boolean
  emplacements?: string[]
  chargeNom?: string | null
  chargeMax?: number | null
  effets?: EffetObjet[]
}

/**
 * Un objet neuf n'a besoin que d'un nom : on le crée en rafale, la fiche se
 * remplit après. Le reste prend des valeurs qui ne mentent pas — pas de poids,
 * pas de valeur, aucune description.
 */
export function addObjet(input: { nom: string; familleId?: number | null }): Objet {
  const db = getDb()
  const cid = activeCampaignId()
  const ord =
    ((db.prepare(`SELECT MAX(ord) AS m FROM objet WHERE campaign_id = ?`).get(cid) as any)?.m ??
      -1) + 1
  const info = db
    .prepare(
      `INSERT INTO objet (campaign_id, famille_id, nom, unique_piece, qte, vu, su, effets, ord,
                          equipable, emplacements)
       VALUES (?, ?, ?, 1, 1, '', '', '[]', ?, 1, '["main-g","main-d"]')`
    )
    .run(cid, input.familleId ?? null, input.nom.trim() || 'Objet sans nom', ord)
  return getObjet(Number(info.lastInsertRowid))!
}

export function updateObjet(id: number, patch: ObjetPatch): Objet | null {
  const cur = getObjet(id)
  if (!cur) return null
  const v = { ...cur, ...patch }
  getDb()
    .prepare(
      `UPDATE objet SET
         nom = @nom, famille_id = @familleId, image_item_id = @imageItemId,
         image_cadre = @imageCadre,
         unique_piece = @unique, qte = @qte, poids = @poids, places = @places,
         bonus_sac = @bonusSac, valeur = @valeur, prix = @prix,
         vu = @vu, su = @su, equipable = @equipable, emplacements = @emplacements,
         charge_nom = @chargeNom, charge_max = @chargeMax, effets = @effets
       WHERE id = @id`
    )
    .run({
      id,
      nom: v.nom.trim() || cur.nom,
      familleId: v.familleId,
      imageItemId: v.imageItemId,
      /* Une autre image : le cadre taillé dans l'ancienne ne veut plus rien dire. */
      imageCadre:
        v.imageItemId !== cur.imageItemId && patch.imageCadre === undefined
          ? null
          : v.imageCadre
            ? JSON.stringify(v.imageCadre)
            : null,
      unique: v.unique ? 1 : 0,
      /* Une pièce unique se compte à un exemplaire, quoi qu'on ait tapé avant
         de cocher la case : deux vérités contradictoires dans la même fiche se
         paient plus tard, à la pose. */
      qte: v.unique ? 1 : Math.max(1, Math.round(v.qte || 1)),
      poids: v.poids,
      /* Au centième : une place se compte, elle ne se mesure pas au micron. */
      places: Math.max(0, Math.round((Number(v.places) || 0) * 100) / 100),
      bonusSac: Math.max(0, Math.round((Number(v.bonusSac) || 0) * 100) / 100),
      valeur: v.valeur,
      /* Les zéros ne se gardent pas : un prix sans rien n'est pas un prix. */
      prix: (() => {
        const p = Object.fromEntries(Object.entries(v.prix ?? {}).filter(([, n]) => n))
        return Object.keys(p).length ? JSON.stringify(p) : null
      })(),
      vu: v.vu,
      su: v.su,
      /* Tout se porte : il se porte là où on l'a dit, nulle part si rien n'est coché. */
      equipable: v.emplacements.length ? 1 : 0,
      emplacements: JSON.stringify(v.emplacements),
      chargeNom: v.chargeNom,
      chargeMax: v.chargeMax,
      effets: JSON.stringify(v.effets)
    })
  return getObjet(id)
}

/** Repartir d'un objet : la description suit, les exemplaires posés, non. */
export function copyObjet(id: number): Objet | null {
  const src = getObjet(id)
  if (!src) return null
  const neuf = addObjet({ nom: `${src.nom} (copie)`, familleId: src.familleId })
  return updateObjet(neuf.id, {
    imageItemId: src.imageItemId,
    imageCadre: src.imageCadre,
    unique: src.unique,
    qte: src.qte,
    poids: src.poids,
    places: src.places,
    bonusSac: src.bonusSac,
    valeur: src.valeur,
    prix: src.prix ? { ...src.prix } : null,
    vu: src.vu,
    su: src.su,
    equipable: src.equipable,
    emplacements: [...src.emplacements],
    chargeNom: src.chargeNom,
    chargeMax: src.chargeMax,
    effets: src.effets.map((e) => ({ ...e }))
  })
}

export function removeObjet(id: number): void {
  getDb().prepare(`DELETE FROM objet WHERE id = ?`).run(id)
}

/* ---------------- poser, déplacer, reprendre ---------------- */

/**
 * Pose un exemplaire. Dans un lieu il commence **caché** — les joueurs ne l'ont
 * pas encore trouvé ; sur quelqu'un il est **porté**, puisqu'il l'a sur lui.
 */
function poserLibre(input: {
  objetId: number
  port: PortObjet
  placeId?: number | null
  characterId?: number | null
  qte?: number
  precision?: string | null
  /** Sur quelqu'un : l'endroit du corps. Absent, c'est dans son sac. */
  emplacement?: string | null
}): Objet | null {
  const db = getDb()
  const objet = getObjet(input.objetId)
  if (!objet) return null
  const ord =
    ((
      db
        .prepare(`SELECT MAX(ord) AS m FROM objet_placement WHERE objet_id = ?`)
        .get(input.objetId) as any
    )?.m ?? -1) + 1
  if (objet.unique) oublierCorbeille(input.objetId)
  const info = db.prepare(
    `INSERT INTO objet_placement (objet_id, session_id, port, place_id, character_id, detail, qte, etat, emplacement, ord)
     VALUES (@objetId, @sid, @port, @placeId, @characterId, @precision, @qte, @etat, @emplacement, @ord)`
  ).run({
    objetId: input.objetId,
    /* Un exemplaire vit dans une séance : celle où on le pose. */
    sid: activeSessionId(),
    port: input.port,
    placeId: input.port === 'lieu' ? (input.placeId ?? null) : null,
    characterId: input.port === 'lieu' ? null : (input.characterId ?? null),
    precision: input.precision ?? null,
    qte: Math.max(1, Math.round(input.qte ?? (objet.unique ? 1 : objet.qte))),
    etat: input.port === 'lieu' ? 'cache' : 'porte',
    emplacement: input.port === 'lieu' ? null : (input.emplacement ?? null),
    ord
  })
  fixerInitial(Number(info.lastInsertRowid))
  return getObjet(input.objetId)
}

/**
 * Équiper quelqu'un — poser un objet **sur** lui, à un endroit du corps.
 *
 * Trois cas, un seul geste :
 *  — l'objet est déjà dans son sac : il monte sur le corps, sans copie ;
 *  — il vient de la réserve : un exemplaire de plus, posé directement équipé ;
 *  — la case est déjà prise : ce qui l'occupait **retombe dans le sac**, il ne
 *    disparaît pas. Un MJ qui change une arme de main ne doit pas avoir à
 *    retrouver l'ancienne ailleurs.
 *
 * `objetId` nul vide la case : ce qui s'y trouvait retombe dans le sac.
 */
function equiperLibre(input: {
  characterId: number
  emplacement: string
  objetId: number | null
}): { objets: Objet[] } {
  const db = getDb()
  const touches = new Set<number>()

  db.transaction(() => {
    /* Ce qui occupait la case redescend dans le sac. */
    const occupant = db
      .prepare(
        `SELECT id, objet_id AS objetId FROM objet_placement
          WHERE character_id = ? AND emplacement = ? AND (session_id = ? OR session_id IS NULL)`
      )
      .all(input.characterId, input.emplacement, activeSessionId()) as {
      id: number
      objetId: number
    }[]
    for (const o of occupant) {
      db.prepare(`UPDATE objet_placement SET emplacement = NULL WHERE id = ?`).run(o.id)
      touches.add(o.objetId)
    }
    if (input.objetId == null) return

    /* Un exemplaire déjà sur lui — dans le sac, ou porté ailleurs — se déplace
       plutôt que de se dédoubler : on ne fabrique pas une seconde lanterne
       parce qu'on la change de main. */
    const sien = db
      .prepare(
        `SELECT id FROM objet_placement
          WHERE character_id = ? AND objet_id = ? AND (session_id = ? OR session_id IS NULL)
          ORDER BY (emplacement IS NULL) DESC, id LIMIT 1`
      )
      .get(input.characterId, input.objetId, activeSessionId()) as { id: number } | undefined

    if (sien) {
      db.prepare(`UPDATE objet_placement SET emplacement = ? WHERE id = ?`).run(
        input.emplacement,
        sien.id
      )
    } else {
      const ord =
        ((db
          .prepare(`SELECT MAX(ord) AS m FROM objet_placement WHERE objet_id = ?`)
          .get(input.objetId) as any)?.m ?? -1) + 1
      if (getObjet(input.objetId)?.unique) oublierCorbeille(input.objetId)
      const info = db.prepare(
        `INSERT INTO objet_placement (objet_id, session_id, port, character_id, qte, etat, emplacement, ord)
         VALUES (?, ?, 'pj', ?, 1, 'porte', ?, ?)`
      ).run(input.objetId, activeSessionId(), input.characterId, input.emplacement, ord)
      fixerInitial(Number(info.lastInsertRowid))
    }
    touches.add(input.objetId)
  })()

  /* On rend les objets remués : la réserve entière se relit ailleurs, mais
     l'appelant a de quoi savoir ce qui a bougé. */
  return { objets: [...touches].map((id) => getObjet(id)).filter((o): o is Objet => !!o) }
}

/**
 * Ce qu'un personnage a sur lui — porté et dans son sac.
 *
 * Le téléphone d'un joueur n'a pas la réserve entière : il n'a que ses
 * affaires. C'est aussi ce qu'il faut pour la bande des joueurs, en bas de la
 * réserve, où l'on voit d'un coup d'œil qui possède quoi.
 */
export function objetsDe(characterId: number): {
  placementId: number
  objetId: number
  nom: string
  emplacement: string | null
  /** Les endroits du corps où cet objet peut aller — vide, il ne se porte pas. */
  emplacements: string[]
  qte: number
  /** La teinte de sa famille, pour le reconnaître sans lire. */
  teinte: string | null
  /** C'est une lampe : elle s'allume et s'éteint. */
  lampe: boolean
  allumee: boolean
}[] {
  return (
    getDb()
      .prepare(
        `SELECT p.id AS placementId, o.id AS objetId, o.nom, p.emplacement, o.emplacements,
                p.qte, f.teinte, o.effets, p.eteinte
           FROM objet_placement p
           JOIN objet o ON o.id = p.objet_id
           LEFT JOIN objet_famille f ON f.id = o.famille_id
          WHERE p.character_id = ? AND (p.session_id = ? OR p.session_id IS NULL)
          ORDER BY (p.emplacement IS NULL), p.emplacement, o.nom`
      )
      .all(characterId, activeSessionId()) as any[]
  ).map((r) => ({
    placementId: r.placementId,
    objetId: r.objetId,
    nom: r.nom,
    emplacement: r.emplacement ?? null,
    emplacements: lireEmplacements(r.emplacements),
    qte: r.qte ?? 1,
    teinte: r.teinte ?? null,
    lampe: eclaire({ effets: lireEffets(r.effets) }),
    allumee: !r.eteinte
  }))
}

/**
 * Allumer ou éteindre une lampe : l'exemplaire, pas le modèle. Elle reste où
 * elle est — en main, éteinte, elle n'éclaire plus personne.
 */
export function allumer(placementId: number, allumee: boolean): Objet | null {
  const db = getDb()
  const cur = db.prepare(`SELECT objet_id AS objetId FROM objet_placement WHERE id = ?`).get(placementId) as
    | { objetId: number }
    | undefined
  if (!cur) return null
  db.prepare(`UPDATE objet_placement SET eteinte = ? WHERE id = ?`).run(allumee ? 0 : 1, placementId)
  return getObjet(cur.objetId)
}

/** À qui appartient cet exemplaire — pour vérifier avant de le laisser bouger. */
export function porteurDe(placementId: number): number | null {
  const r = getDb()
    .prepare(`SELECT character_id AS characterId FROM objet_placement WHERE id = ?`)
    .get(placementId) as { characterId: number | null } | undefined
  return r?.characterId ?? null
}

/**
 * Faire passer un exemplaire d'une main à l'autre — ou dans une pièce.
 *
 * C'est le geste de la table : ils fouillent la commode, ils trouvent la clé,
 * Marie la prend. Sans lui, il fallait retirer l'exemplaire du lieu puis le
 * reprendre dans la réserve depuis la fiche de Marie : trois gestes dans deux
 * modules, et un aller-retour par la réserve qui ne veut rien dire.
 *
 * Deux règles tiennent la suite :
 *  — **l'emplacement ne suit pas**. Ce qu'un mort portait au poignet tombe dans
 *    le sac de celui qui le ramasse ; c'est à lui de décider s'il le met.
 *  — **l'état suit le geste**. Posé dans un lieu par quelqu'un, l'objet y est
 *    « sur place » : on ne cache pas ce qu'on vient de déposer au vu de tous.
 *    Seul le MJ qui prépare une pièce pose du « pas encore découvert ».
 */
/**
 * Séparer `qte` d'un exemplaire qui en compte davantage : le reste demeure
 * où il est, la part détachée devient une ligne à elle — même endroit, même
 * emplacement de départ — qu'on peut alors déplacer. Rend l'identifiant de
 * la ligne à déplacer : l'exemplaire entier si `qte` le couvre.
 */
function detacher(placementId: number, qte?: number): number {
  if (qte == null) return placementId
  const db = getDb()
  const r = db.prepare(`SELECT qte FROM objet_placement WHERE id = ?`).get(placementId) as
    | { qte: number }
    | undefined
  const n = Math.round(qte)
  if (!r || n < 1 || n >= r.qte) return placementId
  db.prepare(`UPDATE objet_placement SET qte = qte - ? WHERE id = ?`).run(n, placementId)
  return copierLigne('objet_placement', placementId, { qte: n })
}

function donnerLibre(
  placementId: number,
  cible: { port: PortObjet; placeId?: number | null; characterId?: number | null },
  /** Combien en donner ; absent, tout l'exemplaire part. */
  qte?: number
): Objet | null {
  const db = getDb()
  const cur = db
    .prepare(`SELECT objet_id AS objetId FROM objet_placement WHERE id = ?`)
    .get(placementId) as { objetId: number } | undefined
  if (!cur) return null
  placementId = detacher(placementId, qte)
  db.prepare(
    `UPDATE objet_placement
        SET port = @port, place_id = @placeId, character_id = @characterId,
            inventaire_id = NULL, emplacement = NULL, etat = @etat,
            /* Il quitte un lieu : le lieu s'en souvient (les valeurs lues ici
               sont celles d'avant la mise à jour). */
            origine_place_id = COALESCE(origine_place_id, CASE WHEN port = 'lieu' THEN place_id END)
      WHERE id = @id`
  ).run({
    id: placementId,
    port: cible.port,
    placeId: cible.port === 'lieu' ? (cible.placeId ?? null) : null,
    characterId: cible.port === 'lieu' ? null : (cible.characterId ?? null),
    etat: cible.port === 'lieu' ? 'trouve' : 'porte'
  })
  return getObjet(cur.objetId)
}

/** Le retirer du corps sans le lui prendre : il retombe dans son sac. */
function desequiperLibre(placementId: number): Objet | null {
  const db = getDb()
  const cur = db
    .prepare(`SELECT objet_id AS objetId FROM objet_placement WHERE id = ?`)
    .get(placementId) as { objetId: number } | undefined
  if (!cur) return null
  db.prepare(`UPDATE objet_placement SET emplacement = NULL WHERE id = ?`).run(placementId)
  return getObjet(cur.objetId)
}

/**
 * Changer cet exemplaire-là de place sur celui qui le porte : un autre endroit
 * du corps, ou le sac (`null`). À la différence d'`equiper`, on vise
 * l'exemplaire et non l'objet — deux dagues, l'une à chaque main, ne se
 * confondent pas. Ce qui occupait la case redescend dans le sac.
 *
 * On ne porte qu'un exemplaire à la fois : de trois dagues au sac, une seule
 * passe à la ceinture, les deux autres restent où elles étaient.
 */
function porterLibre(placementId: number, emplacement: string | null): Objet | null {
  const db = getDb()
  const cur = db
    .prepare(`SELECT objet_id AS objetId, character_id AS characterId FROM objet_placement WHERE id = ?`)
    .get(placementId) as { objetId: number; characterId: number | null } | undefined
  if (!cur || cur.characterId == null) return null
  db.transaction(() => {
    if (emplacement) {
      db.prepare(
        `UPDATE objet_placement SET emplacement = NULL
          WHERE character_id = ? AND emplacement = ? AND id <> ? AND (session_id = ? OR session_id IS NULL)`
      ).run(cur.characterId, emplacement, placementId, activeSessionId())
      placementId = detacher(placementId, 1)
    }
    db.prepare(`UPDATE objet_placement SET emplacement = ? WHERE id = ?`).run(emplacement, placementId)
  })()
  return getObjet(cur.objetId)
}

function majPlacementLibre(
  id: number,
  patch: { qte?: number; etat?: ObjetPlacement['etat']; precision?: string | null }
): Objet | null {
  const db = getDb()
  const cur = db
    .prepare(
      `SELECT p.objet_id AS objetId, p.qte, p.etat, p.detail, p.inventaire_id AS inventaireId,
              o.qte AS max
         FROM objet_placement p JOIN objet o ON o.id = p.objet_id WHERE p.id = ?`
    )
    .get(id) as any
  if (!cur) return null
  let qte = Math.max(1, Math.round(patch.qte ?? cur.qte))
  /* Où qu'il soit, un exemplaire ne monte pas au-dessus de la quantité de
     l'objet. Ce qui la dépassait déjà peut encore descendre. */
  if (qte > cur.qte) qte = Math.min(qte, Math.max(cur.qte, cur.max ?? 1))
  db.prepare(
    `UPDATE objet_placement SET qte = @qte, etat = @etat, detail = @detail WHERE id = @id`
  ).run({
    id,
    qte,
    etat: patch.etat ?? cur.etat,
    detail: patch.precision !== undefined ? patch.precision : cur.detail
  })
  return getObjet(cur.objetId)
}

/**
 * Poser un exemplaire en un point du plan — ou l'en retirer (`pos` nul).
 *
 * `placeId` le range en même temps dans une autre pièce du même plan : on le
 * change d'abord, puisque changer de lieu efface le point (déclencheur de la
 * migration 72). Sur le plan, c'est la préparation : son emplacement
 * initial suit.
 */
export function situer(
  id: number,
  pos: { x: number; y: number } | null,
  placeId?: number
): Objet | null {
  const db = getDb()
  const cur = db
    .prepare(`SELECT objet_id AS objetId, port, place_id AS placeId FROM objet_placement WHERE id = ?`)
    .get(id) as { objetId: number; port: string; placeId: number | null } | undefined
  if (!cur || cur.port !== 'lieu') return null
  db.transaction(() => {
    if (placeId != null && placeId !== cur.placeId) {
      db.prepare(`UPDATE objet_placement SET place_id = ? WHERE id = ?`).run(placeId, id)
      fixerInitial(id)
    }
    db.prepare(`UPDATE objet_placement SET pos_x = ?, pos_y = ? WHERE id = ?`).run(
      pos ? Math.min(1, Math.max(0, pos.x)) : null,
      pos ? Math.min(1, Math.max(0, pos.y)) : null,
      id
    )
  })()
  return getObjet(cur.objetId)
}

function reprendreLibre(id: number): Objet | null {
  const db = getDb()
  const cur = db.prepare(`SELECT objet_id AS objetId FROM objet_placement WHERE id = ?`).get(id) as
    { objetId: number } | undefined
  if (!cur) return null
  db.prepare(`DELETE FROM objet_placement WHERE id = ?`).run(id)
  return getObjet(cur.objetId)
}

/* ---------------- les inventaires partagés ---------------- */

/**
 * Le camion, la malle : un inventaire que le MJ remplit et ouvre à la table.
 * Ouvert, il se voit sur les téléphones ; chacun y pioche — l'objet tombe dans
 * son sac — ou y remet ce qu'il a. Le contenu est fait d'exemplaires comme les
 * autres (`port = 'inventaire'`), qui vivent dans la séance.
 *
 * Le journal — qui a pris quoi — ne vit qu'en mémoire : il sert pendant la
 * partie, pas d'une soirée à l'autre.
 */
const journaux = new Map<number, Inventaire['journal']>()

export function noter(inventaireId: number, texte: string): void {
  const d = new Date()
  const heure = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const j = journaux.get(inventaireId) ?? []
  j.push({ heure, texte })
  journaux.set(inventaireId, j.slice(-30))
}

function toInventaire(r: any): Inventaire {
  return {
    id: r.id,
    nom: r.nom,
    ouvert: !!r.ouvert,
    enPochette: !!r.enPochette,
    journal: journaux.get(r.id) ?? []
  }
}

export function listInventaires(): Inventaire[] {
  return (
    getDb()
      .prepare(
        `SELECT id, nom, ouvert, en_pochette AS enPochette FROM inventaire
          WHERE campaign_id = ? ORDER BY ord, id`
      )
      .all(activeCampaignId()) as any[]
  ).map(toInventaire)
}

function unInventaire(id: number): Inventaire | null {
  const r = getDb()
    .prepare(`SELECT id, nom, ouvert, en_pochette AS enPochette FROM inventaire WHERE id = ?`)
    .get(id)
  return r ? toInventaire(r) : null
}

/** Un inventaire neuf naît fermé : on le remplit tranquillement avant de l'ouvrir. */
export function addInventaire(nom: string): Inventaire {
  const db = getDb()
  const cid = activeCampaignId()
  const ord =
    ((db.prepare(`SELECT MAX(ord) AS m FROM inventaire WHERE campaign_id = ?`).get(cid) as any)
      ?.m ?? -1) + 1
  const info = db
    .prepare(`INSERT INTO inventaire (campaign_id, nom, ouvert, ord) VALUES (?, ?, 0, ?)`)
    .run(cid, nom.trim() || 'Nouvel inventaire', ord)
  return unInventaire(Number(info.lastInsertRowid))!
}

export function updateInventaire(
  id: number,
  patch: { nom?: string; ouvert?: boolean; enPochette?: boolean }
): Inventaire | null {
  const cur = unInventaire(id)
  if (!cur) return null
  const nom = patch.nom !== undefined ? patch.nom.trim() || cur.nom : cur.nom
  /* Le Sac ou la Pochette, l'un ou l'autre : ouvrir l'un ferme l'autre. */
  let ouvert = patch.ouvert ?? cur.ouvert
  let enPochette = patch.enPochette ?? cur.enPochette
  if (patch.ouvert) enPochette = false
  if (patch.enPochette) ouvert = false
  getDb()
    .prepare(`UPDATE inventaire SET nom = ?, ouvert = ?, en_pochette = ? WHERE id = ?`)
    .run(nom, ouvert ? 1 : 0, enPochette ? 1 : 0, id)
  if (ouvert !== cur.ouvert) noter(id, ouvert ? 'Ouvert aux joueurs' : 'Fermé aux joueurs')
  if (enPochette !== cur.enPochette)
    noter(id, enPochette ? 'Passé à la Pochette' : 'Retiré de la Pochette')
  return unInventaire(id)
}

/** Supprimer un inventaire rend son contenu à la réserve : les exemplaires partent avec lui. */
export function removeInventaire(id: number): void {
  getDb().prepare(`DELETE FROM inventaire WHERE id = ?`).run(id)
  journaux.delete(id)
}

/** L'exemplaire de cet objet déjà rangé dans cet inventaire, dans la séance ouverte. */
function dansInventaire(
  inventaireId: number,
  objetId: number
): { id: number; qte: number } | undefined {
  return getDb()
    .prepare(
      `SELECT id, qte FROM objet_placement
        WHERE inventaire_id = ? AND objet_id = ? AND (session_id = ? OR session_id IS NULL)
        ORDER BY id LIMIT 1`
    )
    .get(inventaireId, objetId, activeSessionId()) as { id: number; qte: number } | undefined
}

/**
 * Ranger des objets de la réserve dans un inventaire. Une pièce unique déjà
 * posée ailleurs dans la séance n'est pas dédoublée ; un objet qui se compte
 * et qu'on y range encore est complété jusqu'à sa quantité, jamais au-delà.
 * Rend le nombre d'objets ajoutés ou complétés.
 */
export function remplir(inventaireId: number, objetIds: number[]): number {
  const db = getDb()
  const sid = activeSessionId()
  let n = 0
  db.transaction(() => {
    for (const objetId of objetIds) {
      const o = getObjet(objetId)
      if (!o) continue
      if (o.unique && o.placements.length > 0) continue
      if (o.unique) oublierCorbeille(objetId)
      const ajout = o.unique ? 1 : Math.max(1, o.qte)
      const deja = dansInventaire(inventaireId, objetId)
      if (deja) {
        /* Un inventaire n'en tient jamais plus que la quantité de l'objet. */
        if (deja.qte >= ajout) continue
        db.prepare(`UPDATE objet_placement SET qte = ? WHERE id = ?`).run(ajout, deja.id)
      } else {
        const ord =
          ((
            db
              .prepare(`SELECT MAX(ord) AS m FROM objet_placement WHERE objet_id = ?`)
              .get(objetId) as any
          )?.m ?? -1) + 1
        const info = db.prepare(
          `INSERT INTO objet_placement (objet_id, session_id, port, inventaire_id, qte, etat, ord)
           VALUES (?, ?, 'inventaire', ?, ?, 'trouve', ?)`
        ).run(objetId, sid, inventaireId, ajout, ord)
        fixerInitial(Number(info.lastInsertRowid))
      }
      n++
    }
  })()
  return n
}

/** Ce qu'un inventaire contient, dans la séance ouverte — pour les téléphones. */
export function contenuInventaire(inventaireId: number): {
  placementId: number
  objetId: number
  nom: string
  qte: number
  teinte: string | null
}[] {
  return (
    getDb()
      .prepare(
        `SELECT p.id AS placementId, o.id AS objetId, o.nom, p.qte, f.teinte
           FROM objet_placement p
           JOIN objet o ON o.id = p.objet_id
           LEFT JOIN objet_famille f ON f.id = o.famille_id
          WHERE p.inventaire_id = ? AND (p.session_id = ? OR p.session_id IS NULL)
          ORDER BY o.nom COLLATE NOCASE`
      )
      .all(inventaireId, activeSessionId()) as any[]
  ).map((r) => ({ ...r, qte: r.qte ?? 1, teinte: r.teinte ?? null }))
}

/** L'inventaire où est rangé cet exemplaire, s'il l'est. */
export function inventaireDe(placementId: number): number | null {
  const r = getDb()
    .prepare(`SELECT inventaire_id AS id FROM objet_placement WHERE id = ?`)
    .get(placementId) as { id: number | null } | undefined
  return r?.id ?? null
}

/**
 * Piocher un exemplaire : il tombe dans le sac du personnage. S'il y en a
 * plusieurs, on n'en prend qu'un — les autres restent dans l'inventaire. Rend
 * le nom de l'objet pris.
 */
function prendreLibre(placementId: number, characterId: number): string | null {
  const db = getDb()
  const p = db
    .prepare(
      `SELECT p.objet_id AS objetId, p.qte, p.inventaire_id AS inventaireId, o.nom FROM objet_placement p
         JOIN objet o ON o.id = p.objet_id
        WHERE p.id = ? AND p.inventaire_id IS NOT NULL`
    )
    .get(placementId) as { objetId: number; qte: number; inventaireId: number; nom: string } | undefined
  if (!p) return null
  db.transaction(() => {
    if (p.qte > 1) {
      db.prepare(`UPDATE objet_placement SET qte = qte - 1 WHERE id = ?`).run(placementId)
      const sac = db
        .prepare(
          `SELECT id FROM objet_placement
            WHERE character_id = ? AND objet_id = ? AND emplacement IS NULL
              AND (session_id = ? OR session_id IS NULL)
            LIMIT 1`
        )
        .get(characterId, p.objetId, activeSessionId()) as { id: number } | undefined
      if (sac) db.prepare(`UPDATE objet_placement SET qte = qte + 1 WHERE id = ?`).run(sac.id)
      else
        /* Pioché dans le camion, il y retourne quand on range. */
        db.prepare(
          `INSERT INTO objet_placement (objet_id, session_id, port, character_id, qte, etat, ord,
                                        init_port, init_inventaire_id, init_etat)
           VALUES (?, ?, 'pj', ?, 1, 'porte', 0, 'inventaire', ?, 'trouve')`
        ).run(p.objetId, activeSessionId(), characterId, p.inventaireId)
    } else {
      db.prepare(
        `UPDATE objet_placement
            SET port = 'pj', inventaire_id = NULL, character_id = ?, etat = 'porte', emplacement = NULL
          WHERE id = ?`
      ).run(characterId, placementId)
    }
  })()
  return p.nom
}

/**
 * Remettre un exemplaire dans un inventaire — tout ce qu'il compte, ou `qte`
 * seulement. S'il y en a déjà de ce même objet, les deux se rejoignent. Rend
 * le nom de l'objet.
 */
function remettreLibre(placementId: number, inventaireId: number, qte?: number): string | null {
  const db = getDb()
  if (!db.prepare(`SELECT 1 FROM objet_placement WHERE id = ?`).get(placementId)) return null
  placementId = detacher(placementId, qte)
  const p = db
    .prepare(
      `SELECT p.objet_id AS objetId, p.qte, o.nom FROM objet_placement p
         JOIN objet o ON o.id = p.objet_id WHERE p.id = ?`
    )
    .get(placementId) as { objetId: number; qte: number; nom: string } | undefined
  if (!p) return null
  db.transaction(() => {
    const deja = dansInventaire(inventaireId, p.objetId)
    if (deja && deja.id !== placementId) {
      db.prepare(`UPDATE objet_placement SET qte = ? WHERE id = ?`).run(deja.qte + p.qte, deja.id)
      db.prepare(`DELETE FROM objet_placement WHERE id = ?`).run(placementId)
    } else {
      db.prepare(
        `UPDATE objet_placement
            SET port = 'inventaire', inventaire_id = ?, character_id = NULL, place_id = NULL,
                etat = 'trouve', emplacement = NULL
          WHERE id = ?`
      ).run(inventaireId, placementId)
    }
  })()
  return p.nom
}

/**
 * Entrer dans une séance : chaque inventaire encore vide y reprend ce qu'il
 * contenait à la séance d'avant. Ce qui a été pioché la dernière fois ne
 * revient donc pas dans le camion.
 */
export function reporterInventaires(sessionId: number): void {
  const db = getDb()
  const sienne = db.prepare(`SELECT id, ord FROM game_session WHERE id = ?`).get(sessionId) as
    | { id: number; ord: number }
    | undefined
  if (!sienne) return
  const avant = db
    .prepare(
      `SELECT id FROM game_session
        WHERE campaign_id = ? AND (ord < ? OR (ord = ? AND id < ?))
        ORDER BY ord DESC, id DESC LIMIT 1`
    )
    .get(activeCampaignId(), sienne.ord, sienne.ord, sienne.id) as { id: number } | undefined
  if (!avant) return
  db.transaction(() => {
    for (const inv of listInventaires()) {
      const ici = db
        .prepare(`SELECT 1 FROM objet_placement WHERE inventaire_id = ? AND session_id = ?`)
        .get(inv.id, sessionId)
      if (ici) continue
      for (const p of db
        .prepare(`SELECT id FROM objet_placement WHERE inventaire_id = ? AND session_id = ?`)
        .all(inv.id, avant.id) as { id: number }[])
        fixerInitial(copierLigne('objet_placement', p.id, { session_id: sessionId }))
    }
  })()
}

/* ---------------- l'emplacement initial, la corbeille ---------------- */

/**
 * Là où il est devient son emplacement initial. Appelé à la naissance d'un
 * exemplaire — et d'une copie, qui vit dans une autre séance et ne doit pas
 * retourner dans les lieux de celle d'où elle vient.
 */
export function fixerInitial(placementId: number): void {
  getDb()
    .prepare(
      `UPDATE objet_placement
          SET init_port = port, init_place_id = place_id, init_character_id = character_id,
              init_inventaire_id = inventaire_id, init_emplacement = emplacement, init_etat = etat
        WHERE id = ? AND port <> 'corbeille'`
    )
    .run(placementId)
}

/**
 * Choisir à la main l'emplacement de départ d'un exemplaire, sans le
 * déplacer. L'état suit l'endroit : pas découvert dans un lieu, sur place
 * dans un inventaire, porté sur quelqu'un — dans son sac.
 */
export function changerInitial(
  placementId: number,
  cible: { port: PortObjet; placeId?: number | null; characterId?: number | null; inventaireId?: number | null }
): Objet | null {
  if (cible.port === 'corbeille') return null
  const db = getDb()
  const cur = db
    .prepare(`SELECT objet_id AS objetId FROM objet_placement WHERE id = ?`)
    .get(placementId) as { objetId: number } | undefined
  if (!cur) return null
  db.prepare(
    `UPDATE objet_placement
        SET init_port = @port, init_place_id = @placeId, init_character_id = @characterId,
            init_inventaire_id = @inventaireId, init_emplacement = NULL, init_etat = @etat
      WHERE id = @id`
  ).run({
    id: placementId,
    port: cible.port,
    placeId: cible.port === 'lieu' ? (cible.placeId ?? null) : null,
    characterId: cible.port === 'pj' || cible.port === 'pnj' ? (cible.characterId ?? null) : null,
    inventaireId: cible.port === 'inventaire' ? (cible.inventaireId ?? null) : null,
    etat: cible.port === 'lieu' ? 'cache' : cible.port === 'inventaire' ? 'trouve' : 'porte'
  })
  return getObjet(cur.objetId)
}

/* Une pièce unique qu'on pose à nouveau : ce qui traînait d'elle à la
   corbeille n'a plus de sens. */
function oublierCorbeille(objetId: number): void {
  getDb()
    .prepare(
      `DELETE FROM objet_placement
        WHERE objet_id = ? AND port = 'corbeille' AND (session_id = ? OR session_id IS NULL)`
    )
    .run(objetId, activeSessionId())
}

/**
 * Jeter un exemplaire : il quitte le sac, le lieu, l'inventaire, et attend à
 * la corbeille. Il garde son emplacement initial — on peut encore l'y ranger.
 */
function jeterLibre(placementId: number): Objet | null {
  const db = getDb()
  const cur = db
    .prepare(`SELECT objet_id AS objetId FROM objet_placement WHERE id = ?`)
    .get(placementId) as { objetId: number } | undefined
  if (!cur) return null
  db.prepare(
    `UPDATE objet_placement
        SET port = 'corbeille', place_id = NULL, character_id = NULL, inventaire_id = NULL,
            emplacement = NULL, etat = 'cache'
      WHERE id = ?`
  ).run(placementId)
  return getObjet(cur.objetId)
}

/**
 * Remettre des exemplaires là où on les avait rangés au départ. Ce qui
 * retourne dans un inventaire y rejoint ce qui s'y trouve déjà ; ce qui
 * retourne sur quelqu'un reprend son endroit du corps s'il est libre, sinon
 * son sac. Un exemplaire dont l'emplacement initial est perdu ne bouge pas.
 * Rend le nombre d'exemplaires rangés.
 */
function rangerLibre(placementIds: number[]): number {
  if (placementIds.length === 0) return 0
  const db = getDb()
  const objetIds = (
    db
      .prepare(
        `SELECT DISTINCT objet_id AS id FROM objet_placement
          WHERE id IN (${placementIds.map(() => '?').join(',')})`
      )
      .all(...placementIds) as { id: number }[]
  ).map((r) => r.id)
  const voulus = new Set(placementIds)
  const lignes = [...placementsOf(objetIds).values()]
    .flatMap((ex) => [...ex.placements, ...ex.corbeille])
    .filter((p) => voulus.has(p.id))
  let n = 0
  db.transaction(() => {
    for (const p of lignes) {
      const ini = p.initial
      if (!ini || !p.deplace) continue
      if (ini.port === 'inventaire' && ini.inventaireId != null) {
        remettreLibre(p.id, ini.inventaireId)
      } else if (ini.port === 'lieu') {
        db.prepare(
          `UPDATE objet_placement
              SET port = 'lieu', place_id = ?, character_id = NULL, inventaire_id = NULL,
                  emplacement = NULL, etat = ?, origine_place_id = NULL
            WHERE id = ?`
        ).run(ini.placeId, ini.etat, p.id)
      } else {
        const prise =
          ini.emplacement != null &&
          !!db
            .prepare(
              `SELECT 1 FROM objet_placement
                WHERE character_id = ? AND emplacement = ? AND id <> ?
                  AND (session_id = ? OR session_id IS NULL)`
            )
            .get(ini.characterId, ini.emplacement, p.id, activeSessionId())
        db.prepare(
          `UPDATE objet_placement
              SET port = ?, place_id = NULL, character_id = ?, inventaire_id = NULL,
                  emplacement = ?, etat = 'porte'
            WHERE id = ?`
        ).run(ini.port, ini.characterId, prise ? null : ini.emplacement, p.id)
      }
      n++
    }
  })()
  return n
}

/** Supprimer pour de bon des exemplaires de la corbeille — et rien d'autre. */
export function supprimerJetes(placementIds: number[]): void {
  const db = getDb()
  const del = db.prepare(`DELETE FROM objet_placement WHERE id = ? AND port = 'corbeille'`)
  db.transaction(() => {
    for (const id of placementIds) del.run(id)
  })()
}

/** Vider la corbeille de la séance ouverte. */
export function viderCorbeille(): void {
  getDb()
    .prepare(
      `DELETE FROM objet_placement
        WHERE port = 'corbeille' AND (session_id = ? OR session_id IS NULL)
          AND objet_id IN (SELECT id FROM objet WHERE campaign_id = ?)`
    )
    .run(activeSessionId(), activeCampaignId())
}

/* ---------------- la garde du sac ---------------- */

/** Les places du sac de base, réglées pour la campagne ; 0, sans limite. */
export function capaciteSac(): number {
  return lireCampagne(reglages.tous()).sacCapacite
}

/** Le sac de chacun de ceux qui ont quelque chose sur eux, dans la séance ouverte. */
export function sacs(): Map<number, EtatSac & { nom: string }> {
  const rows = getDb()
    .prepare(
      `SELECT p.character_id AS characterId, c.name AS nom, p.emplacement, p.qte,
              o.places, o.bonus_sac AS bonusSac
         FROM objet_placement p
         JOIN objet o     ON o.id = p.objet_id
         JOIN character c ON c.id = p.character_id
        WHERE p.character_id IS NOT NULL AND (p.session_id = ? OR p.session_id IS NULL)`
    )
    .all(activeSessionId()) as any[]
  const par = new Map<number, { nom: string; lignes: LigneSac[] }>()
  for (const r of rows) {
    let x = par.get(r.characterId)
    if (!x) par.set(r.characterId, (x = { nom: r.nom, lignes: [] }))
    x.lignes.push({
      places: r.places ?? 1,
      bonusSac: r.bonusSac ?? 0,
      qte: r.qte ?? 1,
      emplacement: r.emplacement ?? null
    })
  }
  const base = capaciteSac()
  return new Map([...par].map(([id, x]) => [id, { nom: x.nom, ...etatSac(x.lignes, base) }]))
}

/**
 * Faire un geste sans qu'aucun sac ne déborde par sa faute.
 *
 * On compare les sacs avant et après, dans la même transaction : un sac qui
 * finit au-delà de ce qu'il tient **et** que le geste a alourdi — ou privé de
 * place, en lui ôtant son sac à dos — annule tout. Un sac qui débordait déjà
 * (le MJ a baissé la capacité en cours de route) n'empêche que ce qui
 * l'alourdit : on peut toujours le vider.
 *
 * Le refus est une exception marquée de `REFUS_SAC` : elle traverse l'IPC et
 * l'interface en montre le texte.
 */
function gardeSac<T>(geste: () => T): T {
  const db = getDb()
  return db.transaction(() => {
    if (capaciteSac() <= 0) return geste()
    const avant = sacs()
    const r = geste()
    for (const [id, apres] of sacs()) {
      if (!sacPlein(apres)) continue
      const a = avant.get(id)
      const alourdi = !a || apres.charge > a.charge + EPSILON_SAC
      const retreci = !!a && a.capacite !== null && apres.capacite! < a.capacite - EPSILON_SAC
      if (retreci)
        throw new Error(
          `${REFUS_SAC}Le sac de ${apres.nom} ne tiendrait plus : ${ditPlaces(apres.charge)} places pour ${ditPlaces(apres.capacite!)}. Qu’il se déleste d’abord.`
        )
      if (alourdi)
        throw new Error(
          `${REFUS_SAC}Le sac de ${apres.nom} est plein : ${ditPlaces(a?.charge ?? 0)} / ${ditPlaces(apres.capacite!)} places, il en faudrait ${ditPlaces(apres.charge - (a?.charge ?? 0))} de plus.`
        )
    }
    return r
  })()
}

/* Les gestes qui remplissent un sac, ou lui ôtent de la place, passent par la garde. */
export const poser = (...a: Parameters<typeof poserLibre>) => gardeSac(() => poserLibre(...a))
export const equiper = (...a: Parameters<typeof equiperLibre>) => gardeSac(() => equiperLibre(...a))
export const donner = (...a: Parameters<typeof donnerLibre>) => gardeSac(() => donnerLibre(...a))
export const desequiper = (...a: Parameters<typeof desequiperLibre>) =>
  gardeSac(() => desequiperLibre(...a))
export const porter = (...a: Parameters<typeof porterLibre>) => gardeSac(() => porterLibre(...a))
export const majPlacement = (...a: Parameters<typeof majPlacementLibre>) =>
  gardeSac(() => majPlacementLibre(...a))
export const prendre = (...a: Parameters<typeof prendreLibre>) => gardeSac(() => prendreLibre(...a))
export const remettre = (...a: Parameters<typeof remettreLibre>) =>
  gardeSac(() => remettreLibre(...a))
export const ranger = (...a: Parameters<typeof rangerLibre>) => gardeSac(() => rangerLibre(...a))
export const jeter = (...a: Parameters<typeof jeterLibre>) => gardeSac(() => jeterLibre(...a))
export const reprendre = (...a: Parameters<typeof reprendreLibre>) =>
  gardeSac(() => reprendreLibre(...a))
