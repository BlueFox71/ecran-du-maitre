import { activeCampaignId, activeSessionId, getDb } from '../index'
import { getItem } from './library'
import type { Beat, GameSession, Item } from '@shared/types'

export function listSessions(): GameSession[] {
  return getDb()
    .prepare(
      `SELECT id, label, date, notes FROM game_session WHERE campaign_id = ? ORDER BY date DESC, id DESC`
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
        `INSERT INTO game_session (campaign_id, label, date, active)
         VALUES (?, ?, COALESCE(?, date('now')), 1)`
      )
      .run(cid, label, date ?? null)
  })()
  return listSessions().find((s) => s.id === Number(info.lastInsertRowid))!
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
    .prepare(`SELECT id, label, date, notes FROM game_session WHERE id = ?`)
    .get(id) as GameSession
}

/** Renommer, redater, annoter. Un champ absent du patch ne bouge pas. */
export function updateSession(
  id: number,
  patch: { label?: string; date?: string; notes?: string | null }
): GameSession | null {
  const db = getDb()
  const cur = db.prepare(`SELECT id, label, date, notes FROM game_session WHERE id = ?`).get(id) as
    | GameSession
    | undefined
  if (!cur) return null
  db.prepare(`UPDATE game_session SET label = ?, date = ?, notes = ? WHERE id = ?`).run(
    patch.label !== undefined ? patch.label.trim() || cur.label : cur.label,
    patch.date !== undefined ? patch.date : cur.date,
    patch.notes !== undefined ? patch.notes : cur.notes,
    id
  )
  return db.prepare(`SELECT id, label, date, notes FROM game_session WHERE id = ?`).get(id) as GameSession
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
        .prepare(`SELECT id FROM game_session WHERE campaign_id = ? ORDER BY date DESC, id DESC LIMIT 1`)
        .get(cid) as { id: number } | undefined
      if (suivante) db.prepare(`UPDATE game_session SET active = 1 WHERE id = ?`).run(suivante.id)
    }
  })()
  return { ok: true }
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
              chapter_id AS chapterId, place_id AS placeId
         FROM beat WHERE session_id = ? ORDER BY ord, id`
    )
    .all(sid) as any[]
  return rows.map((r) => ({ ...r, done: !!r.done, items: beatItems(r.id) }))
}

export function upsertBeat(input: {
  id?: number
  sessionId?: number
  atTime?: string | null
  title: string
  note?: string | null
  done?: boolean
  chapterId?: number | null
  placeId?: number | null
}): Beat {
  const db = getDb()
  const sid = input.sessionId ?? activeSessionId()
  let id = input.id ?? 0

  if (id) {
    db.prepare(
      `UPDATE beat SET at_time = @atTime, title = @title, note = @note, done = @done,
                       chapter_id = @chapterId, place_id = @placeId
        WHERE id = @id`
    ).run({
      id,
      atTime: input.atTime ?? null,
      title: input.title,
      note: input.note ?? null,
      done: input.done ? 1 : 0,
      chapterId: input.chapterId ?? null,
      placeId: input.placeId ?? null
    })
  } else {
    const ord =
      ((db.prepare(`SELECT MAX(ord) AS m FROM beat WHERE session_id = ?`).get(sid) as any)?.m ?? -1) +
      1
    const info = db
      .prepare(
        `INSERT INTO beat (session_id, ord, at_time, title, note, done, chapter_id, place_id)
         VALUES (@sid, @ord, @atTime, @title, @note, @done, @chapterId, @placeId)`
      )
      .run({
        sid,
        ord,
        atTime: input.atTime ?? null,
        title: input.title,
        note: input.note ?? null,
        done: input.done ? 1 : 0,
        chapterId: input.chapterId ?? null,
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
