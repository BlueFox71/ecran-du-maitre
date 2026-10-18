/**
 * La sonothèque et les sons posés sur les plans.
 *
 * Un son est un nom, une nature et des fichiers de la bibliothèque ; un son
 * posé est un cercle sur une carte, qui joue un son quand un pion y entre.
 * Ce qui se passe pendant la partie — armé, joué, en attente du feu vert —
 * ne vit pas ici : voir `main/sons.ts`.
 */
import { getDb } from '../index'
import { mediaUrl } from '../../vault'
import {
  MOTIFS_VIBRATION,
  type FichierSon,
  type MotifVibration,
  type NatureSon,
  type ParZone,
  type QuandZone,
  type Son,
  type VibrerZone,
  type ZoneSon
} from '@shared/types'

const NATURES: NatureSon[] = ['ambiance', 'nappe', 'bruitage']
const QUANDS: QuandZone[] = ['une', 'chaque', 'proche']
const PARS: ParZone[] = ['joueurs', 'pnj', 'tous']
const VIBRERS: VibrerZone[] = ['aucun', 'lui', 'tous']

const borne = (v: unknown, min: number, max: number, defaut: number): number => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : defaut
}
const parmi = <T extends string>(v: unknown, liste: T[], defaut: T): T =>
  liste.includes(v as T) ? (v as T) : defaut
/** Une touche du Paravent : un chiffre de 1 à 9, et rien d'autre. */
const toucheSure = (v: unknown): string | null =>
  typeof v === 'string' && /^[1-9]$/.test(v) ? v : null
const motifSur = (v: unknown): MotifVibration | null =>
  typeof v === 'string' && v in MOTIFS_VIBRATION ? (v as MotifVibration) : null

/* ============================================================
   La sonothèque
   ============================================================ */

/** Le nom d'un son tiré de son fichier : sans extension, sans tirets bas. */
const nomDuFichier = (titre: string): string =>
  titre.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_]+/g, ' ').trim() || 'Son'

function fichiersDe(sonIds: number[]): Map<number, FichierSon[]> {
  const out = new Map<number, FichierSon[]>()
  if (!sonIds.length) return out
  const rows = getDb()
    .prepare(
      `SELECT f.son_id AS sonId, i.id AS itemId, i.title AS titre, i.duration AS duree,
              i.rel_path AS relPath
         FROM son_fichier f JOIN item i ON i.id = f.item_id
        WHERE f.son_id IN (${sonIds.map(() => '?').join(',')})
        ORDER BY f.ord, f.id`
    )
    .all(...sonIds) as { sonId: number; itemId: number; titre: string; duree: number | null; relPath: string | null }[]
  for (const r of rows) {
    const l = out.get(r.sonId) ?? []
    l.push({ itemId: r.itemId, titre: r.titre, duree: r.duree, url: mediaUrl(r.relPath) })
    out.set(r.sonId, l)
  }
  return out
}

function toSon(r: any, fichiers: FichierSon[]): Son {
  const propre = String(r.nom ?? '').trim()
  return {
    id: r.id,
    /* Sans nom à lui, il prend celui de son fichier — qui suit les renommages
       faits dans l'explorateur, la bibliothèque retrouvant le fichier. */
    nom: propre || (fichiers[0] ? nomDuFichier(fichiers[0].titre) : 'Son sans fichier'),
    nomSuitFichier: !propre,
    emoji: r.emoji || null,
    nature: parmi(r.nature, NATURES, 'bruitage'),
    volume: borne(r.volume, 0, 1, 0.7),
    fonduEntree: borne(r.fondu_entree, 0, 30, 2),
    fonduSortie: borne(r.fondu_sortie, 0, 30, 2),
    touche: toucheSure(r.touche),
    planche: r.planche ?? '',
    vibration: motifSur(r.vibration),
    ord: r.ord,
    fichiers
  }
}

export function listSons(): Son[] {
  const rows = getDb().prepare(`SELECT * FROM son ORDER BY ord, id`).all() as any[]
  const f = fichiersDe(rows.map((r) => r.id))
  return rows.map((r) => toSon(r, f.get(r.id) ?? []))
}

export function getSon(id: number): Son | null {
  const r = getDb().prepare(`SELECT * FROM son WHERE id = ?`).get(id)
  return r ? toSon(r, fichiersDe([id]).get(id) ?? []) : null
}

/**
 * La nature qu'on devine à la durée : au-delà de deux minutes, c'est une
 * ambiance ; sous six secondes, un bruitage ; entre les deux, une nappe.
 * Le MJ corrige d'un clic — c'est un point de départ, pas un verdict.
 */
export function natureDevinee(duree: number | null): NatureSon {
  if (duree == null) return 'bruitage'
  if (duree >= 120) return 'ambiance'
  if (duree <= 6) return 'bruitage'
  return 'nappe'
}


export function addSon(input: {
  nom?: string
  nature?: NatureSon
  planche?: string
  itemIds?: number[]
}): Son | null {
  const db = getDb()
  const ids = (input.itemIds ?? []).filter((i) => Number.isFinite(i))
  const premier = ids.length
    ? (db.prepare(`SELECT duration FROM item WHERE id = ?`).get(ids[0]) as
        | { duration: number | null }
        | undefined)
    : undefined
  const nature = input.nature ?? natureDevinee(premier?.duration ?? null)
  const ord = (db.prepare(`SELECT COALESCE(MAX(ord), 0) + 1 AS o FROM son`).get() as { o: number }).o
  const id = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO son (nom, nature, volume, fondu_entree, fondu_sortie, planche, ord)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        /* Vide : il portera le nom de son fichier, et le suivra. */
        input.nom?.trim() || (ids.length ? '' : 'Nouveau son'),
        nature,
        nature === 'bruitage' ? 0.7 : nature === 'nappe' ? 0.35 : 0.45,
        nature === 'bruitage' ? 0 : 2,
        nature === 'bruitage' ? 0 : 3,
        (input.planche ?? '').trim(),
        ord
      )
    const sonId = Number(info.lastInsertRowid)
    const ins = db.prepare(`INSERT OR IGNORE INTO son_fichier (son_id, item_id, ord) VALUES (?, ?, ?)`)
    ids.forEach((it, i) => ins.run(sonId, it, i))
    return sonId
  })()
  return getSon(id)
}

export function updateSon(
  id: number,
  patch: Partial<
    Pick<Son, 'nom' | 'emoji' | 'nature' | 'volume' | 'fonduEntree' | 'fonduSortie' | 'touche' | 'planche' | 'vibration'>
  >
): Son | null {
  const av = getSon(id)
  if (!av) return null
  const db = getDb()
  /* Le nom qu'il porte vraiment en base : vide s'il suit son fichier. */
  const nomPropre = av.nomSuitFichier ? '' : av.nom
  const touche = patch.touche === undefined ? av.touche : toucheSure(patch.touche)
  db.transaction(() => {
    /* Une touche ne joue qu'un son : celui qui la prend la retire à l'autre. */
    if (touche && touche !== av.touche)
      db.prepare(`UPDATE son SET touche = NULL WHERE touche = ? AND id <> ?`).run(touche, id)
    db.prepare(
      `UPDATE son SET nom = @nom, emoji = @emoji, nature = @nature, volume = @volume,
              fondu_entree = @fe, fondu_sortie = @fs, touche = @touche, planche = @planche,
              vibration = @vibration
        WHERE id = @id`
    ).run({
      id,
      nom: patch.nom === undefined ? nomPropre : String(patch.nom).trim(),
      emoji: patch.emoji === undefined ? av.emoji : patch.emoji || null,
      nature: patch.nature === undefined ? av.nature : parmi(patch.nature, NATURES, av.nature),
      volume: patch.volume === undefined ? av.volume : borne(patch.volume, 0, 1, av.volume),
      fe: patch.fonduEntree === undefined ? av.fonduEntree : borne(patch.fonduEntree, 0, 30, av.fonduEntree),
      fs: patch.fonduSortie === undefined ? av.fonduSortie : borne(patch.fonduSortie, 0, 30, av.fonduSortie),
      touche,
      planche: patch.planche === undefined ? av.planche : String(patch.planche).trim(),
      vibration: patch.vibration === undefined ? av.vibration : motifSur(patch.vibration)
    })
  })()
  return getSon(id)
}

/** Supprimer un son, ou plusieurs d'un coup — un seul pas à défaire. */
export function removeSon(id: number | number[]): void {
  const db = getDb()
  const del = db.prepare(`DELETE FROM son WHERE id = ?`)
  db.transaction(() => {
    for (const x of Array.isArray(id) ? id : [id]) del.run(x)
  })()
}

/** Les fichiers d'un son, dans l'ordre donné : on en ajoute, on en retire, d'un seul geste. */
export function setFichiersSon(id: number, itemIds: number[]): Son | null {
  const db = getDb()
  db.transaction(() => {
    db.prepare(`DELETE FROM son_fichier WHERE son_id = ?`).run(id)
    const ins = db.prepare(`INSERT OR IGNORE INTO son_fichier (son_id, item_id, ord) VALUES (?, ?, ?)`)
    itemIds.forEach((it, i) => ins.run(id, it, i))
  })()
  return getSon(id)
}

/** Rendre aux sons le nom de leur fichier : ils le suivront désormais. Tous, faute d'en nommer. */
export function nomsDesFichiers(ids?: number[]): void {
  const db = getDb()
  if (!ids) db.prepare(`UPDATE son SET nom = ''`).run()
  else {
    const up = db.prepare(`UPDATE son SET nom = '' WHERE id = ?`)
    db.transaction(() => ids.forEach((id) => up.run(id)))()
  }
}

/** Ranger les sons : l'ordre donné, d'un bout à l'autre. */
export function ordonnerSons(ids: number[]): void {
  const db = getDb()
  const up = db.prepare(`UPDATE son SET ord = ? WHERE id = ?`)
  db.transaction(() => ids.forEach((id, i) => up.run(i + 1, id)))()
}

/** Renommer une planche : tous ses sons suivent. Vide, ils ne sont plus rangés nulle part. */
export function renommerPlanche(avant: string, apres: string): void {
  getDb().prepare(`UPDATE son SET planche = ? WHERE planche = ?`).run(apres.trim(), avant)
}

/* ============================================================
   Les sons posés sur les plans
   ============================================================ */

const RAYON = { min: 0.01, max: 1 }

function toZone(r: any): ZoneSon {
  return {
    id: r.id,
    placeId: r.place_id,
    sonId: r.son_id ?? null,
    nom: r.nom ?? '',
    x: borne(r.x, 0, 1, 0.5),
    y: borne(r.y, 0, 1, 0.5),
    rayon: borne(r.rayon, RAYON.min, RAYON.max, 0.08),
    quand: parmi(r.quand, QUANDS, 'chaque'),
    par: parmi(r.par, PARS, 'joueurs'),
    tempsMort: borne(r.temps_mort, 0, 600, 10),
    confirmer: !!r.confirmer,
    vibrer: parmi(r.vibrer, VIBRERS, 'lui')
  }
}

export function listZones(placeId: number | null): ZoneSon[] {
  if (placeId == null) return []
  return (getDb().prepare(`SELECT * FROM son_zone WHERE place_id = ? ORDER BY id`).all(placeId) as any[]).map(toZone)
}

export function getZone(id: number): ZoneSon | null {
  const r = getDb().prepare(`SELECT * FROM son_zone WHERE id = ?`).get(id)
  return r ? toZone(r) : null
}

/** Combien de sons posés, lieu par lieu — et sur quels lieux un son est posé. */
export function zonesParSon(): { id: number; sonId: number; placeId: number; nom: string; x: number; y: number }[] {
  return getDb()
    .prepare(
      `SELECT z.id, z.son_id AS sonId, z.place_id AS placeId, z.nom AS nom, z.x, z.y
         FROM son_zone z WHERE z.son_id IS NOT NULL ORDER BY z.place_id, z.id`
    )
    .all() as { id: number; sonId: number; placeId: number; nom: string; x: number; y: number }[]
}

export function addZone(input: { placeId: number; x: number; y: number; sonId?: number | null; rayon?: number }): ZoneSon | null {
  const lieu = getDb().prepare(`SELECT id FROM place WHERE id = ?`).get(input.placeId)
  if (!lieu) return null
  const son = input.sonId != null ? getSon(input.sonId) : null
  /* Une nappe posée sur un plan est une source : elle se fait entendre de près. */
  const quand: QuandZone = son?.nature === 'nappe' || son?.nature === 'ambiance' ? 'proche' : 'chaque'
  const info = getDb()
    .prepare(
      `INSERT INTO son_zone (place_id, son_id, nom, x, y, rayon, quand)
       VALUES (@placeId, @sonId, @nom, @x, @y, @rayon, @quand)`
    )
    .run({
      placeId: input.placeId,
      sonId: son?.id ?? null,
      /* Vide : il porte le nom de son son, et le suit. */
      nom: '',
      x: borne(input.x, 0, 1, 0.5),
      y: borne(input.y, 0, 1, 0.5),
      rayon: borne(input.rayon ?? (quand === 'proche' ? 0.18 : 0.07), RAYON.min, RAYON.max, 0.08),
      quand
    })
  return getZone(Number(info.lastInsertRowid))
}

export function updateZone(
  id: number,
  patch: Partial<Pick<ZoneSon, 'sonId' | 'nom' | 'x' | 'y' | 'rayon' | 'quand' | 'par' | 'tempsMort' | 'confirmer' | 'vibrer'>>
): ZoneSon | null {
  const av = getZone(id)
  if (!av) return null
  getDb()
    .prepare(
      `UPDATE son_zone SET son_id = @sonId, nom = @nom, x = @x, y = @y, rayon = @rayon,
              quand = @quand, par = @par, temps_mort = @tm, confirmer = @conf, vibrer = @vibrer
        WHERE id = @id`
    )
    .run({
      id,
      sonId: patch.sonId === undefined ? av.sonId : patch.sonId,
      nom: patch.nom === undefined ? av.nom : String(patch.nom),
      x: patch.x === undefined ? av.x : borne(patch.x, 0, 1, av.x),
      y: patch.y === undefined ? av.y : borne(patch.y, 0, 1, av.y),
      rayon: patch.rayon === undefined ? av.rayon : borne(patch.rayon, RAYON.min, RAYON.max, av.rayon),
      quand: patch.quand === undefined ? av.quand : parmi(patch.quand, QUANDS, av.quand),
      par: patch.par === undefined ? av.par : parmi(patch.par, PARS, av.par),
      tm: patch.tempsMort === undefined ? av.tempsMort : borne(patch.tempsMort, 0, 600, av.tempsMort),
      conf: (patch.confirmer === undefined ? av.confirmer : patch.confirmer) ? 1 : 0,
      vibrer: patch.vibrer === undefined ? av.vibrer : parmi(patch.vibrer, VIBRERS, av.vibrer)
    })
  return getZone(id)
}

export function removeZone(id: number): void {
  getDb().prepare(`DELETE FROM son_zone WHERE id = ?`).run(id)
}
