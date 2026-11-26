/**
 * Les textes du tarot, préparés carte par carte pour la séance. Les joueurs
 * tirent un vrai jeu ; le MJ affiche à la table la carte nommée et l'un de
 * ces textes. Rien ne voyage d'une séance à l'autre, sauf quand on la
 * duplique.
 */
import { activeCampaignId, activeSessionId, getDb } from '../index'
import type { TexteTarot } from '@shared/parole'

/** Les textes de la séance active, carte par carte, dans l'ordre où ils ont été écrits. */
export function textesTarot(): TexteTarot[] {
  return getDb()
    .prepare(`SELECT id, arcane, texte FROM tarot_texte WHERE session_id = ? ORDER BY arcane, ord, id`)
    .all(activeSessionId()) as TexteTarot[]
}

export function ajouterTexteTarot(arcane: string, texte: string): void {
  const t = texte.trim()
  if (!arcane || !t) return
  const db = getDb()
  const sid = activeSessionId()
  const ord =
    ((db.prepare(`SELECT MAX(ord) AS m FROM tarot_texte WHERE session_id = ? AND arcane = ?`).get(sid, arcane) as {
      m: number | null
    }).m ?? -1) + 1
  db.prepare(`INSERT INTO tarot_texte (campaign_id, session_id, arcane, texte, ord) VALUES (?, ?, ?, ?, ?)`).run(
    activeCampaignId(),
    sid,
    arcane,
    t,
    ord
  )
}

export function modifierTexteTarot(id: number, texte: string): void {
  const t = texte.trim()
  if (!t) return retirerTexteTarot(id)
  getDb().prepare(`UPDATE tarot_texte SET texte = ? WHERE id = ? AND session_id = ?`).run(t, id, activeSessionId())
}

export function retirerTexteTarot(id: number): void {
  getDb().prepare(`DELETE FROM tarot_texte WHERE id = ? AND session_id = ?`).run(id, activeSessionId())
}

/** Recopier les textes d'une séance dans une autre (dupliquer, préparer la suite). */
export function copierTarot(de: number, vers: number): void {
  getDb()
    .prepare(
      `INSERT INTO tarot_texte (campaign_id, session_id, arcane, texte, ord)
       SELECT campaign_id, ?, arcane, texte, ord FROM tarot_texte WHERE session_id = ? ORDER BY id`
    )
    .run(vers, de)
}
