import { activeCampaignId, activeSessionId, getDb } from '../index'
import { getItem } from './library'
import { copierLieu } from './places'
import { copierPnj } from './characters'
import { copierLigne } from '../copie'
import type { Beat, GameSession, Item } from '@shared/types'

export function listSessions(): GameSession[] {
  return getDb()
    .prepare(
      `SELECT id, label, date, notes, folder_rel AS folderRel FROM game_session WHERE campaign_id = ? ORDER BY ord, id`
    )
    .all(activeCampaignId()) as GameSession[]
}

export function createSession(label: string, date?: string): GameSession {
  const cid = activeCampaignId()
  const db = getDb()
  const info = db.transaction(() => {
    db.prepare(`UPDATE game_session SET active = 0 WHERE campaign_id = ?`).run(cid)
    return db
      .prepare(
        `INSERT INTO game_session (campaign_id, label, date, active, ord)
         VALUES (?, ?, COALESCE(?, date('now')), 1, ?)`
      )
      .run(cid, label, date ?? null, rangSuivant())
  })()
  return listSessions().find((s) => s.id === Number(info.lastInsertRowid))!
}

/** Une séance neuve se range en bas de la liste. */
function rangSuivant(): number {
  const r = getDb()
    .prepare(`SELECT MAX(ord) AS m FROM game_session WHERE campaign_id = ?`)
    .get(activeCampaignId()) as { m: number | null }
  return (r.m ?? -1) + 1
}

/**
 * Placer une séance juste avant ou juste après une autre. L'ordre est celui
 * de la liste, et c'est aussi lui qui dit « la séance d'avant » : l'état des
 * joueurs qu'on recopie en entrant, le hors-jeu. On renumérote tout, de 0.
 */
export function placerSeance(id: number, refId: number, sens: 'avant' | 'apres'): GameSession[] {
  if (id === refId) return listSessions()
  const db = getDb()
  const ids = listSessions().map((s) => s.id).filter((x) => x !== id)
  const i = ids.indexOf(refId)
  if (i < 0) return listSessions()
  ids.splice(sens === 'avant' ? i : i + 1, 0, id)
  const poser = db.prepare(`UPDATE game_session SET ord = ? WHERE id = ?`)
  db.transaction(() => ids.forEach((x, n) => poser.run(n, x)))()
  return listSessions()
}

export function setActiveSession(id: number): void {
  const db = getDb()
  db.transaction(() => {
    db.prepare(`UPDATE game_session SET active = 0 WHERE campaign_id = ?`).run(activeCampaignId())
    db.prepare(`UPDATE game_session SET active = 1 WHERE id = ?`).run(id)
  })()
}

export function currentSession(): GameSession {
  const id = activeSessionId()
  return getDb()
    .prepare(`SELECT id, label, date, notes, folder_rel AS folderRel FROM game_session WHERE id = ?`)
    .get(id) as GameSession
}

/** Renommer, redater, annoter. Un champ absent du patch ne bouge pas. */
export function updateSession(
  id: number,
  patch: { label?: string; date?: string; notes?: string | null; folderRel?: string | null }
): GameSession | null {
  const db = getDb()
  const cur = db.prepare(`SELECT id, label, date, notes, folder_rel AS folderRel FROM game_session WHERE id = ?`).get(id) as
    | GameSession
    | undefined
  if (!cur) return null
  db.prepare(`UPDATE game_session SET label = ?, date = ?, notes = ?, folder_rel = ? WHERE id = ?`).run(
    patch.label !== undefined ? patch.label.trim() || cur.label : cur.label,
    patch.date !== undefined ? patch.date : cur.date,
    patch.notes !== undefined ? patch.notes : cur.notes,
    patch.folderRel !== undefined ? patch.folderRel || null : cur.folderRel,
    id
  )
  return db.prepare(`SELECT id, label, date, notes, folder_rel AS folderRel FROM game_session WHERE id = ?`).get(id) as GameSession
}

/**
 * Supprime une séance et ses moments. La dernière ne s'efface pas : une
 * campagne sans séance n'aurait nulle part où poser ce qui se joue.
 */
export function deleteSession(id: number): { ok: boolean; raison?: string } {
  const db = getDb()
  const cid = activeCampaignId()
  const n = db.prepare(`SELECT COUNT(*) AS n FROM game_session WHERE campaign_id = ?`).get(cid) as {
    n: number
  }
  if (n.n <= 1) return { ok: false, raison: 'La campagne garde au moins une séance.' }

  db.transaction(() => {
    const etaitActive = db.prepare(`SELECT active FROM game_session WHERE id = ?`).get(id) as
      | { active: number }
      | undefined
    db.prepare(`DELETE FROM game_session WHERE id = ?`).run(id)
    if (etaitActive?.active) {
      const suivante = db
        .prepare(`SELECT id FROM game_session WHERE campaign_id = ? ORDER BY ord DESC, id DESC LIMIT 1`)
        .get(cid) as { id: number } | undefined
      if (suivante) db.prepare(`UPDATE game_session SET active = 1 WHERE id = ?`).run(suivante.id)
    }
  })()
  return { ok: true }
}

/**
 * Dupliquer une séance : une nouvelle, qui devient la séance en cours, avec
 * une copie de ce que l'autre préparait — ses lieux (non découverts, sans
 * pions, comme toute reprise), ses PNJ, ses moments (à rejouer : aucun n'est
 * coché), ses notes et la liste de ses absents.
 *
 * `folderRel` est le dossier déjà recopié qui devient celui de la séance ;
 * `jumeaux` dit, pour chaque fichier de l'ancien dossier, son double dans le
 * nouveau. Plans, portraits et textes des moments pointent alors sur la copie
 * — corriger un texte de la séance 5 ne touche pas celui de la séance 4. Ce
 * qui est rangé ailleurs dans la campagne reste partagé, comme avant.
 *
 * L'état des joueurs, lui, ne se copie pas d'ici : il suit la règle de toute
 * séance où l'on entre, et vient de la plus récente.
 */
export function dupliquerSeance(
  srcId: number,
  label: string,
  folderRel: string | null,
  jumeaux: Map<number, number>
): GameSession {
  const db = getDb()
  const cid = activeCampaignId()
  const fichier = (v: number): number => jumeaux.get(v) ?? v
  let nid = 0

  db.transaction(() => {
    nid = copierLigne('game_session', srcId, {
      label: label.trim() || 'Séance',
      date: new Date().toISOString().slice(0, 10),
      active: 0,
      ord: rangSuivant(),
      folder_rel: folderRel
    })

    /* Les lieux : chaque racine de la séance emporte ce qu'elle tient. Une
       racine rangée sous un espace commun y reste ; sous un lieu d'une autre
       séance, elle remonte à la racine de l'arbre. */
    const lieux = new Map<number, number>()
    const siens = db
      .prepare(`SELECT id, parent_id AS parentId FROM place WHERE campaign_id = ? AND session_id = ? ORDER BY ord, id`)
      .all(cid, srcId) as { id: number; parentId: number | null }[]
    const ids = new Set(siens.map((p) => p.id))
    const commun = db.prepare(`SELECT 1 FROM place WHERE id = ? AND session_id IS NULL`)
    for (const p of siens) {
      if (p.parentId != null && ids.has(p.parentId)) continue
      const parentId = p.parentId != null && commun.get(p.parentId) ? p.parentId : null
      for (const [a, b] of copierLieu(p.id, nid, { parentId }, jumeaux)) lieux.set(a, b)
    }

    const pnj = new Map<number, number>()
    for (const c of db
      .prepare(`SELECT id FROM character WHERE campaign_id = ? AND session_id = ? AND kind = 'pnj' ORDER BY ord, id`)
      .all(cid, srcId) as { id: number }[])
      pnj.set(c.id, copierPnj(c.id, nid, jumeaux))

    const insItem = db.prepare(`INSERT OR IGNORE INTO beat_item (beat_id, item_id, ord) VALUES (?, ?, ?)`)
    const insPnj = db.prepare(`INSERT OR IGNORE INTO beat_pnj (beat_id, character_id) VALUES (?, ?)`)
    for (const b of db
      .prepare(`SELECT id, place_id AS placeId FROM beat WHERE session_id = ? ORDER BY ord, id`)
      .all(srcId) as { id: number; placeId: number | null }[]) {
      const neuf = copierLigne('beat', b.id, {
        session_id: nid,
        done: 0,
        place_id: b.placeId == null ? null : (lieux.get(b.placeId) ?? b.placeId)
      })
      for (const i of db
        .prepare(`SELECT item_id AS id, ord FROM beat_item WHERE beat_id = ?`)
        .all(b.id) as { id: number; ord: number }[])
        insItem.run(neuf, fichier(i.id), i.ord)
      for (const c of db.prepare(`SELECT character_id AS id FROM beat_pnj WHERE beat_id = ?`).all(b.id) as {
        id: number
      }[])
        insPnj.run(neuf, pnj.get(c.id) ?? c.id)
    }

    db.prepare(
      `INSERT OR IGNORE INTO seance_absent (session_id, character_id)
         SELECT ?, character_id FROM seance_absent WHERE session_id = ?`
    ).run(nid, srcId)

    /* Le double d'un fichier rattaché à un lieu l'est à la copie de ce lieu,
       et garde la page de PDF choisie pour sa vignette. */
    const lire = db.prepare(`SELECT place_id AS placeId, thumb_page AS page FROM item WHERE id = ?`)
    const poser = db.prepare(`UPDATE item SET place_id = ?, thumb_page = ? WHERE id = ?`)
    for (const [de, vers] of jumeaux) {
      const o = lire.get(de) as { placeId: number | null; page: number } | undefined
      if (o) poser.run(o.placeId == null ? null : (lieux.get(o.placeId) ?? o.placeId), o.page, vers)
    }
  })()

  setActiveSession(nid)
  return listSessions().find((s) => s.id === nid)!
}

function beatItems(beatId: number): Item[] {
  const ids = getDb()
    .prepare(`SELECT item_id AS id FROM beat_item WHERE beat_id = ? ORDER BY ord, item_id`)
    .all(beatId) as { id: number }[]
  return ids.map((r) => getItem(r.id)).filter((i): i is Item => i !== null)
}

export function listBeats(sessionId?: number): Beat[] {
  const sid = sessionId ?? activeSessionId()
  const rows = getDb()
    .prepare(
      `SELECT id, session_id AS sessionId, ord, at_time AS atTime, title, note, done,
              place_id AS placeId
         FROM beat WHERE session_id = ? ORDER BY ord, id`
    )
    .all(sid) as any[]
  const pnj = getDb().prepare(`SELECT character_id AS id FROM beat_pnj WHERE beat_id = ?`)
  return rows.map((r) => ({
    ...r,
    done: !!r.done,
    items: beatItems(r.id),
    pnjIds: (pnj.all(r.id) as { id: number }[]).map((x) => x.id)
  }))
}

/** Les PNJ que ce moment met en scène, donnés en entier. */
export function setBeatPnjs(beatId: number, ids: number[]): void {
  const db = getDb()
  db.transaction(() => {
    db.prepare(`DELETE FROM beat_pnj WHERE beat_id = ?`).run(beatId)
    const ins = db.prepare(
      `INSERT OR IGNORE INTO beat_pnj (beat_id, character_id)
         SELECT ?, id FROM character WHERE id = ? AND kind = 'pnj'`
    )
    for (const id of ids) ins.run(beatId, id)
  })()
}

export function upsertBeat(input: {
  id?: number
  sessionId?: number
  atTime?: string | null
  title: string
  note?: string | null
  done?: boolean
  placeId?: number | null
}): Beat {
  const db = getDb()
  const sid = input.sessionId ?? activeSessionId()
  let id = input.id ?? 0

  if (id) {
    db.prepare(
      `UPDATE beat SET at_time = @atTime, title = @title, note = @note, done = @done,
                       place_id = @placeId
        WHERE id = @id`
    ).run({
      id,
      atTime: input.atTime ?? null,
      title: input.title,
      note: input.note ?? null,
      done: input.done ? 1 : 0,
      placeId: input.placeId ?? null
    })
  } else {
    const ord =
      ((db.prepare(`SELECT MAX(ord) AS m FROM beat WHERE session_id = ?`).get(sid) as any)?.m ?? -1) +
      1
    const info = db
      .prepare(
        `INSERT INTO beat (session_id, ord, at_time, title, note, done, place_id)
         VALUES (@sid, @ord, @atTime, @title, @note, @done, @placeId)`
      )
      .run({
        sid,
        ord,
        atTime: input.atTime ?? null,
        title: input.title,
        note: input.note ?? null,
        done: input.done ? 1 : 0,
        placeId: input.placeId ?? null
      })
    id = Number(info.lastInsertRowid)
  }
  return listBeats(sid).find((b) => b.id === id)!
}

export function removeBeat(id: number): void {
  getDb().prepare(`DELETE FROM beat WHERE id = ?`).run(id)
}

export function reorderBeats(ids: number[]): void {
  const db = getDb()
  const stmt = db.prepare(`UPDATE beat SET ord = ? WHERE id = ?`)
  db.transaction(() => ids.forEach((id, i) => stmt.run(i, id)))()
}

export function attachToBeat(beatId: number, itemId: number): void {
  const ord =
    ((getDb().prepare(`SELECT MAX(ord) AS m FROM beat_item WHERE beat_id = ?`).get(beatId) as any)
      ?.m ?? -1) + 1
  getDb()
    .prepare(`INSERT OR IGNORE INTO beat_item (beat_id, item_id, ord) VALUES (?, ?, ?)`)
    .run(beatId, itemId, ord)
}

export function detachFromBeat(beatId: number, itemId: number): void {
  getDb().prepare(`DELETE FROM beat_item WHERE beat_id = ? AND item_id = ?`).run(beatId, itemId)
}
