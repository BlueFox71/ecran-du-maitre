import { randomInt } from 'node:crypto'
import { activeCampaignId, activeSessionId, getDb } from '../index'
import type { Roll, RollLevel, RollRecord, RollRequest } from '@shared/types'

/** Dé équitable : tirage cryptographique, pas de Math.random. */
export function die(faces: number): number {
  return randomInt(1, faces + 1)
}

/**
 * Résolution d'un jet.
 * d100-under  : Appel de Cthulhu 7e — extrême = seuil/5, difficile = seuil/2,
 *               critique sur 1, maladresse sur 100 (et 96-100 si le seuil est sous 50).
 * d20-plus    : D&D 5e et systèmes maison — `target` est ce qu'on ajoute
 *               (modificateur ou caractéristique), le total est comparé par le MJ.
 *
 * `donne` est la valeur lue sur le dé du joueur. Fournie, elle remplace le
 * tirage : la lecture du résultat reste la même, qu'on ait tiré ou recopié.
 */
export function resolve(
  req: RollRequest,
  donne?: number
): { result: number; detail: string; level: RollLevel } {
  if (req.system === 'd20-plus') {
    const d = donne ?? die(20)
    const total = d + req.target
    const level: RollLevel = d === 20 ? 'critique' : d === 1 ? 'maladresse' : 'neutre'
    const sign = req.target >= 0 ? '+' : '−'
    return { result: total, detail: `d20=${d} ${sign}${Math.abs(req.target)}`, level }
  }

  const r = donne ?? die(100)
  const t = req.target
  let level: RollLevel
  if (r === 1) level = 'critique'
  else if (r === 100 || (r >= 96 && t < 50)) level = 'maladresse'
  else if (r <= Math.floor(t / 5)) level = 'extreme'
  else if (r <= Math.floor(t / 2)) level = 'difficile'
  else if (r <= t) level = 'reussite'
  else level = 'echec'
  return {
    result: r,
    detail: `seuil ${t} · extrême ${Math.floor(t / 5)} · difficile ${Math.floor(t / 2)}`,
    level
  }
}

const SELECT = `
  SELECT r.id, r.character_id AS characterId, c.name AS characterName, c.player AS playerName,
         c.color AS characterColor,
         r.at, r.label, r.formula, r.target, r.result, r.detail, r.level
    FROM roll r LEFT JOIN character c ON c.id = r.character_id`

/** Les jets encore au journal — la corbeille n'en fait plus partie. */
const VIVANTS = `r.trashed_at IS NULL`

export function listRolls(limit = 300, sessionOnly = true): Roll[] {
  if (sessionOnly) {
    return getDb()
      .prepare(`${SELECT} WHERE r.session_id = ? AND ${VIVANTS} ORDER BY r.id DESC LIMIT ?`)
      .all(activeSessionId(), limit) as Roll[]
  }
  return getDb()
    .prepare(`${SELECT} WHERE r.campaign_id = ? AND ${VIVANTS} ORDER BY r.id DESC LIMIT ?`)
    .all(activeCampaignId(), limit) as Roll[]
}

/**
 * La corbeille de la séance : ce qu'on vient de retirer du journal, du plus
 * récemment jeté au plus ancien.
 */
export const CORBEILLE_MAX = 20

export function listTrash(): Roll[] {
  return getDb()
    .prepare(
      `${SELECT} WHERE r.session_id = ? AND r.trashed_at IS NOT NULL
        ORDER BY r.trashed_at DESC, r.id DESC LIMIT ?`
    )
    .all(activeSessionId(), CORBEILLE_MAX) as Roll[]
}

/**
 * Retirer un jet du journal. Il n'est pas effacé : il passe à la corbeille,
 * d'où on le rappelle. La corbeille ne garde que ses vingt dernières lignes —
 * au-delà, la suppression devient définitive, sans quoi « supprimer » ne
 * supprimerait jamais rien.
 */
export function trashRoll(id: number): void {
  const db = getDb()
  db.transaction(() => {
    /* À la milliseconde, et non datetime('now') : à la table on supprime deux
       lignes coup sur coup, et à la seconde près elles porteraient la même
       heure — la corbeille retomberait sur l'ordre des identifiants, qui est
       celui où les jets ont été écrits, pas celui où ils ont été jetés. */
    db.prepare(
      `UPDATE roll SET trashed_at = strftime('%Y-%m-%d %H:%M:%f', 'now')
        WHERE id = ? AND trashed_at IS NULL`
    ).run(id)
    db.prepare(
      `DELETE FROM roll
        WHERE session_id = ? AND trashed_at IS NOT NULL
          AND id NOT IN (
            SELECT id FROM roll WHERE session_id = ? AND trashed_at IS NOT NULL
             ORDER BY trashed_at DESC, id DESC LIMIT ?
          )`
    ).run(activeSessionId(), activeSessionId(), CORBEILLE_MAX)
  })()
}

/** Rendre un jet au journal. Il retrouve sa place à son heure, pas en tête. */
export function restoreRoll(id: number): void {
  getDb().prepare(`UPDATE roll SET trashed_at = NULL WHERE id = ?`).run(id)
}

/** Vider la corbeille : cette fois, c'est définitif. */
export function emptyTrash(): void {
  getDb()
    .prepare(`DELETE FROM roll WHERE session_id = ? AND trashed_at IS NOT NULL`)
    .run(activeSessionId())
}

/** Écrit la ligne du journal. Tirage et saisie y arrivent par le même chemin. */
function saveRoll(
  req: RollRequest,
  { result, detail, level }: { result: number; detail: string; level: RollLevel }
): Roll {
  const formula = req.system === 'd20-plus' ? '1d20' : '1d100'
  const info = getDb()
    .prepare(
      `INSERT INTO roll (campaign_id, session_id, character_id, label, formula, target, result, detail, level)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      activeCampaignId(),
      activeSessionId(),
      req.characterId,
      req.label,
      formula,
      req.target,
      result,
      detail,
      level
    )
  return getDb().prepare(`${SELECT} WHERE r.id = ?`).get(Number(info.lastInsertRowid)) as Roll
}

/** Jet tiré par l'application. */
export function addRoll(req: RollRequest): Roll {
  return saveRoll(req, resolve(req))
}

/**
 * Jet **lancé par le joueur**, dont on ne fait que noter la valeur. Le dé est
 * ramené dans les bornes de son système : une saisie hors limites viendrait
 * d'une faute de frappe, et une ligne fausse dans le journal vaut moins que
 * pas de ligne du tout.
 */
export function recordRoll(req: RollRecord): Roll {
  const faces = req.system === 'd20-plus' ? 20 : 100
  const d = Math.min(faces, Math.max(1, Math.round(req.die)))
  return saveRoll(req, resolve(req, d))
}

/** Jet libre : « 2d6+3 », « 1d100 », « 3d8 ». */
export function rollFormula(formula: string, label = 'Jet libre'): Roll {
  const m = /^\s*(\d*)\s*d\s*(\d+)\s*([+-]\s*\d+)?\s*$/i.exec(formula)
  if (!m) throw new Error(`Formule illisible : « ${formula} »`)
  const count = Math.min(50, Math.max(1, parseInt(m[1] || '1', 10)))
  const faces = Math.min(1000, Math.max(2, parseInt(m[2], 10)))
  const bonus = m[3] ? parseInt(m[3].replace(/\s+/g, ''), 10) : 0

  const dice: number[] = []
  for (let i = 0; i < count; i++) dice.push(die(faces))
  const total = dice.reduce((a, b) => a + b, 0) + bonus

  const detail =
    dice.join(' + ') + (bonus ? ` ${bonus > 0 ? '+' : '−'} ${Math.abs(bonus)}` : '')
  const info = getDb()
    .prepare(
      `INSERT INTO roll (campaign_id, session_id, character_id, label, formula, target, result, detail, level)
       VALUES (?, ?, NULL, ?, ?, NULL, ?, ?, 'neutre')`
    )
    .run(activeCampaignId(), activeSessionId(), label, `${count}d${faces}`, total, detail)
  return getDb().prepare(`${SELECT} WHERE r.id = ?`).get(Number(info.lastInsertRowid)) as Roll
}

/**
 * `judged` compte les jets que le dé tranche lui-même. En d20 le résultat se
 * compare à la table du MJ, pas à un seuil : ces jets sont « neutre » et
 * resteraient hors du taux de réussite, qui afficherait sinon 0 % à tort.
 */
export function rollStats(): {
  total: number
  judged: number
  success: number
  fumble: number
  rate: number
} {
  const rows = getDb()
    .prepare(
      `SELECT level, COUNT(*) AS n FROM roll
        WHERE session_id = ? AND target IS NOT NULL AND trashed_at IS NULL
        GROUP BY level`
    )
    .all(activeSessionId()) as { level: RollLevel; n: number }[]
  let total = 0
  let judged = 0
  let success = 0
  let fumble = 0
  for (const r of rows) {
    total += r.n
    if (r.level !== 'neutre') judged += r.n
    if (['critique', 'extreme', 'difficile', 'reussite'].includes(r.level)) success += r.n
    if (r.level === 'maladresse') fumble += r.n
  }
  return { total, judged, success, fumble, rate: judged ? Math.round((success / judged) * 100) : 0 }
}

export function clearSessionRolls(): void {
  getDb().prepare(`DELETE FROM roll WHERE session_id = ?`).run(activeSessionId())
}

export function rollsCsv(): string {
  const rows = listRolls(5000, true)
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const head = ['heure', 'personnage', 'joueur', 'jet', 'formule', 'seuil', 'resultat', 'niveau']
  const lines = [head.join(';')]
  for (const r of rows.slice().reverse()) {
    lines.push(
      [r.at, r.characterName, r.playerName, r.label, r.formula, r.target, r.result, r.level]
        .map(esc)
        .join(';')
    )
  }
  return '﻿' + lines.join('\r\n')
}
