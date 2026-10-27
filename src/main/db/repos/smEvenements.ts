import { activeCampaignId, activeSessionId, getDb } from '../index'
import { EVENEMENTS_DEFAUT, type EvenementSm } from '@shared/santeMentale'

/**
 * Les événements de santé mentale, séance par séance : ce qui peut faire
 * perdre de la raison, avec la perte qu'on propose. Chaque séance a sa liste,
 * rangée comme le meneur l'a voulu.
 */

interface Ligne {
  id: number
  session_id: number
  ord: number
  nom: string
  note: string | null
  perte: number
  jet: number
  tous: number
}

const enEvenement = (r: Ligne): EvenementSm => ({
  id: r.id,
  sessionId: r.session_id,
  ord: r.ord,
  nom: r.nom,
  note: r.note,
  perte: r.perte,
  jet: !!r.jet,
  tous: !!r.tous
})

const INSERER = `INSERT INTO sm_evenement (campaign_id, session_id, ord, nom, note, perte, jet, tous)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`

export function listEvenements(sessionId: number): EvenementSm[] {
  return (
    getDb()
      .prepare(`SELECT * FROM sm_evenement WHERE campaign_id = ? AND session_id = ? ORDER BY ord, id`)
      .all(activeCampaignId(), sessionId) as Ligne[]
  ).map(enEvenement)
}

/** Le rang qui suit le dernier de la séance. */
const suivant = (sessionId: number): number =>
  (
    getDb()
      .prepare(`SELECT COALESCE(MAX(ord), -1) AS m FROM sm_evenement WHERE campaign_id = ? AND session_id = ?`)
      .get(activeCampaignId(), sessionId) as { m: number }
  ).m + 1

/** Écrit un événement — le crée en fin de liste s'il n'a pas d'id — et rend la liste de sa séance. */
export function ecrireEvenement(e: Omit<EvenementSm, 'id' | 'ord'> & { id?: number }): EvenementSm[] {
  const db = getDb()
  const c = activeCampaignId()
  if (e.id === undefined) {
    db.prepare(INSERER).run(c, e.sessionId, suivant(e.sessionId), e.nom, e.note, e.perte, e.jet ? 1 : 0, e.tous ? 1 : 0)
  } else {
    db.prepare(
      `UPDATE sm_evenement SET nom = ?, note = ?, perte = ?, jet = ?, tous = ?
       WHERE id = ? AND campaign_id = ?`
    ).run(e.nom, e.note, e.perte, e.jet ? 1 : 0, e.tous ? 1 : 0, e.id, c)
  }
  return listEvenements(e.sessionId)
}

export function effacerEvenement(id: number): EvenementSm[] {
  const db = getDb()
  const c = activeCampaignId()
  const row = db.prepare(`SELECT session_id FROM sm_evenement WHERE id = ? AND campaign_id = ?`).get(id, c) as
    | { session_id: number }
    | undefined
  if (!row) return []
  db.prepare(`DELETE FROM sm_evenement WHERE id = ? AND campaign_id = ?`).run(id, c)
  return listEvenements(row.session_id)
}

/** L'ordre de la liste d'une séance, tel que le meneur l'a rangée. */
export function rangerEvenements(sessionId: number, ids: number[]): EvenementSm[] {
  const db = getDb()
  const c = activeCampaignId()
  const up = db.prepare(`UPDATE sm_evenement SET ord = ? WHERE id = ? AND campaign_id = ? AND session_id = ?`)
  db.transaction(() => ids.forEach((id, n) => up.run(n, id, c, sessionId)))()
  return listEvenements(sessionId)
}

/** Copie un événement en fin de liste d'une autre séance. */
export function dupliquerEvenement(id: number, versSessionId: number): void {
  const db = getDb()
  const c = activeCampaignId()
  const r = db.prepare(`SELECT * FROM sm_evenement WHERE id = ? AND campaign_id = ?`).get(id, c) as Ligne | undefined
  if (!r) return
  db.prepare(INSERER).run(c, versSessionId, suivant(versSessionId), r.nom, r.note, r.perte, r.jet, r.tous)
}

/** Les événements du barème sous la séance active — seulement si la campagne n'en a encore aucun. */
export function semerEvenements(): void {
  const db = getDb()
  const c = activeCampaignId()
  const n = (db.prepare(`SELECT COUNT(*) AS n FROM sm_evenement WHERE campaign_id = ?`).get(c) as { n: number }).n
  if (n > 0) return
  const s = activeSessionId()
  const ins = db.prepare(INSERER)
  db.transaction(() =>
    EVENEMENTS_DEFAUT.forEach((e, i) => ins.run(c, s, i, e.nom, e.note, e.perte, e.jet ? 1 : 0, e.tous ? 1 : 0))
  )()
}
