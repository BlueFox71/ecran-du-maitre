/**
 * Les surlignages du Paravent — ce que le MJ a marqué « fait » en lisant.
 *
 * Comme les annotations, ce dépôt est isolé de `display.ts` : rien de ce qu'il
 * renvoie ne rejoint l'état de diffusion, donc rien ne peut atteindre la
 * fenêtre des joueurs ni les portables. Et il ne touche jamais aux textes eux-
 * mêmes : un surlignage n'est pas une écriture.
 */
import { activeCampaignId, getDb } from '../index'
import type { Cible, Plage } from '@shared/surlignage'

export function listSurlignages(): Record<Cible, Plage[]> {
  const lignes = getDb()
    .prepare(`SELECT cible, debut, fin, cite FROM surlignage WHERE campaign_id = ? ORDER BY cible, debut`)
    .all(activeCampaignId()) as ({ cible: string } & Plage)[]
  const r: Record<Cible, Plage[]> = {}
  for (const l of lignes) (r[l.cible] ??= []).push({ debut: l.debut, fin: l.fin, cite: l.cite })
  return r
}

/**
 * Les plages de chaque cible touchée par un glissé, mises à la place des
 * anciennes. Effacer puis réécrire — et non mettre à jour — n'est jamais
 * « que des modifications des mêmes cases » : le défaire ne le fond donc pas
 * dans une rafale, et chaque glissé reste un pas de Ctrl+Z à lui seul.
 */
export function remplacer(changes: { cible: Cible; plages: Plage[] }[]): void {
  const db = getDb()
  const cid = activeCampaignId()
  const del = db.prepare(`DELETE FROM surlignage WHERE campaign_id = ? AND cible = ?`)
  const ins = db.prepare(`INSERT INTO surlignage (campaign_id, cible, debut, fin, cite) VALUES (?, ?, ?, ?, ?)`)
  db.transaction(() => {
    for (const c of changes) {
      del.run(cid, c.cible)
      for (const p of c.plages) ins.run(cid, c.cible, p.debut, p.fin, p.cite)
    }
  })()
}

/** « Effacer le surlignage » d'un document : toutes ses cibles d'un coup. */
export function effacer(cibles: Cible[]): void {
  remplacer(cibles.map((cible) => ({ cible, plages: [] })))
}

/** Toute la campagne — la case de « Réinitialiser la séance ». */
export function toutEffacer(): number {
  return getDb().prepare(`DELETE FROM surlignage WHERE campaign_id = ?`).run(activeCampaignId()).changes
}
