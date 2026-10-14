import { activeSessionId, getDb } from '../index'
import { lisCadreCarre } from '@shared/types'
import type { Trame, TrameCarte, TrameLien, TrameType } from '@shared/types'

/* ============================================================
   La trame de la séance : le scénario en cartes reliées par des
   flèches. On la prépare dans la Préparation de la séance ; au
   Paravent, on coche ce qui est fait. Rien n'en sort du poste du MJ.
   ============================================================ */

const TYPES: TrameType[] = ['ouverture', 'scene', 'objectif', 'fin']

export function lireTrame(sessionId?: number): Trame {
  const db = getDb()
  const sid = sessionId ?? activeSessionId()
  const rows = db
    .prepare(
      `SELECT id, session_id AS sessionId, type, titre, resume, x, y, regle, fait,
              item_id AS itemId, image_cadre AS imageCadre, beat_id AS beatId, place_id AS placeId
         FROM trame_carte WHERE session_id = ? ORDER BY id`
    )
    .all(sid) as (Omit<TrameCarte, 'fait' | 'pnjIds' | 'imageCadre'> & { fait: number; imageCadre: string | null })[]
  const pnj = db.prepare(`SELECT character_id AS id FROM trame_carte_pnj WHERE carte_id = ?`)
  const cartes = rows.map((r) => ({
    ...r,
    fait: !!r.fait,
    imageCadre: lisCadreCarre(r.imageCadre),
    pnjIds: (pnj.all(r.id) as { id: number }[]).map((x) => x.id)
  }))
  const liens = db
    .prepare(`SELECT id, de, a, mot FROM trame_lien WHERE session_id = ? ORDER BY id`)
    .all(sid) as TrameLien[]
  return { cartes, liens }
}

export function creerCarte(input: { type: TrameType; x: number; y: number; titre?: string }): TrameCarte {
  const sid = activeSessionId()
  const type = TYPES.includes(input.type) ? input.type : 'scene'
  const titre =
    input.titre ??
    { ouverture: 'Ouverture', scene: 'Nouvelle scène', objectif: 'Nouvel objectif', fin: 'Nouvelle fin' }[type]
  const info = getDb()
    .prepare(`INSERT INTO trame_carte (session_id, type, titre, x, y) VALUES (?, ?, ?, ?, ?)`)
    .run(sid, type, titre, input.x, input.y)
  return lireTrame(sid).cartes.find((c) => c.id === Number(info.lastInsertRowid))!
}

/** Un champ absent du patch ne bouge pas. Les PNJ se donnent en entier. */
export function majCarte(
  id: number,
  patch: Partial<Omit<TrameCarte, 'id' | 'sessionId' | 'fait'>>
): void {
  const db = getDb()
  const cols: Record<string, string> = {
    type: 'type',
    titre: 'titre',
    resume: 'resume',
    x: 'x',
    y: 'y',
    regle: 'regle',
    itemId: 'item_id',
    imageCadre: 'image_cadre',
    beatId: 'beat_id',
    placeId: 'place_id'
  }
  const sets: string[] = []
  const vals: unknown[] = []
  for (const [k, col] of Object.entries(cols)) {
    const v = (patch as Record<string, unknown>)[k]
    if (v === undefined) continue
    if (k === 'type' && !TYPES.includes(v as TrameType)) continue
    if (k === 'regle' && v !== 'et' && v !== 'ou') continue
    sets.push(`${col} = ?`)
    vals.push(k === 'imageCadre' ? (v ? JSON.stringify(v) : null) : v)
  }
  db.transaction(() => {
    if (sets.length) db.prepare(`UPDATE trame_carte SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id)
    if (patch.pnjIds) {
      db.prepare(`DELETE FROM trame_carte_pnj WHERE carte_id = ?`).run(id)
      const ins = db.prepare(
        `INSERT OR IGNORE INTO trame_carte_pnj (carte_id, character_id)
           SELECT ?, id FROM character WHERE id = ?`
      )
      for (const c of patch.pnjIds) ins.run(id, c)
    }
  })()
}

/** Cocher au Paravent : c'est du jeu, pas de la préparation. */
export function cocher(id: number, fait: boolean): void {
  getDb().prepare(`UPDATE trame_carte SET fait = ? WHERE id = ?`).run(fait ? 1 : 0, id)
}

/** Recommencer la séance : plus rien de coché. */
export function toutDecocher(): void {
  getDb().prepare(`UPDATE trame_carte SET fait = 0 WHERE session_id = ? AND fait = 1`).run(activeSessionId())
}

export function supprimerCarte(id: number): void {
  getDb().prepare(`DELETE FROM trame_carte WHERE id = ?`).run(id)
}

/** Une flèche de plus. Pas de doublon, pas de boucle sur soi-même. */
export function relier(de: number, a: number): TrameLien | null {
  if (de === a) return null
  const db = getDb()
  const s = db.prepare(`SELECT session_id AS sid FROM trame_carte WHERE id = ?`).get(de) as
    | { sid: number }
    | undefined
  if (!s) return null
  const info = db
    .prepare(`INSERT OR IGNORE INTO trame_lien (session_id, de, a) VALUES (?, ?, ?)`)
    .run(s.sid, de, a)
  if (!info.changes) return null
  return db.prepare(`SELECT id, de, a, mot FROM trame_lien WHERE id = ?`).get(Number(info.lastInsertRowid)) as TrameLien
}

export function majLien(id: number, mot: string): void {
  getDb().prepare(`UPDATE trame_lien SET mot = ? WHERE id = ?`).run(mot, id)
}

export function supprimerLien(id: number): void {
  getDb().prepare(`DELETE FROM trame_lien WHERE id = ?`).run(id)
}

/**
 * Recopier la trame d'une séance dans une autre, à rejouer : rien n'y est
 * coché. Les correspondances disent où pointent désormais les moments, les
 * lieux, les PNJ et les fichiers recopiés ; ce qui n'a pas de double reste
 * partagé, comme ailleurs. À appeler dans la transaction de la duplication.
 */
export function copierTrame(
  srcId: number,
  nid: number,
  maps: {
    beats: Map<number, number>
    lieux: Map<number, number>
    pnj: Map<number, number>
    fichiers: Map<number, number>
  }
): void {
  const db = getDb()
  const { cartes, liens } = lireTrame(srcId)
  const ins = db.prepare(
    `INSERT INTO trame_carte (session_id, type, titre, resume, x, y, regle, fait, item_id, image_cadre, beat_id, place_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`
  )
  const insPnj = db.prepare(`INSERT OR IGNORE INTO trame_carte_pnj (carte_id, character_id) VALUES (?, ?)`)
  const ids = new Map<number, number>()
  const via = (m: Map<number, number>, v: number | null): number | null => (v == null ? null : (m.get(v) ?? v))
  for (const c of cartes) {
    const n = Number(
      ins.run(
        nid,
        c.type,
        c.titre,
        c.resume,
        c.x,
        c.y,
        c.regle,
        via(maps.fichiers, c.itemId),
        c.imageCadre ? JSON.stringify(c.imageCadre) : null,
        /* Un moment est propre à sa séance : sans double, la carte le perd. */
        c.beatId == null ? null : (maps.beats.get(c.beatId) ?? null),
        via(maps.lieux, c.placeId)
      ).lastInsertRowid
    )
    ids.set(c.id, n)
    for (const p of c.pnjIds) insPnj.run(n, maps.pnj.get(p) ?? p)
  }
  const insLien = db.prepare(`INSERT OR IGNORE INTO trame_lien (session_id, de, a, mot) VALUES (?, ?, ?, ?)`)
  for (const l of liens) {
    const de = ids.get(l.de)
    const a = ids.get(l.a)
    if (de && a) insLien.run(nid, de, a, l.mot)
  }
}
