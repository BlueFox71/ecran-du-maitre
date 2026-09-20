import { activeCampaignId, getDb } from '../index'
import { getItem } from './library'
import type { Item } from '@shared/types'

/**
 * Les documents annexes : ce que le meneur garde sous la main pendant toute la
 * séance — règles maison, fiches de PNJ, tables de jets. Ils n'appartiennent à
 * aucun moment ; on les consulte quand la table le demande.
 *
 * Le document reste un fichier de la campagne. On n'enregistre ici que le fait
 * de l'avoir mis sous la main, et son rang dans la liste.
 */

export function listAnnexes(): Item[] {
  const rows = getDb()
    .prepare(`SELECT item_id FROM annexe WHERE campaign_id = ? ORDER BY ord, id`)
    .all(activeCampaignId()) as { item_id: number }[]
  // Un fichier disparu du disque a déjà été effacé par la cascade ; le filtre
  // couvre le cas où la bibliothèque ne le sert plus.
  return rows.map((r) => getItem(r.item_id)).filter((i): i is Item => !!i)
}

export function addAnnexe(itemId: number): Item[] {
  const db = getDb()
  const c = activeCampaignId()
  const max = db
    .prepare(`SELECT COALESCE(MAX(ord), -1) AS m FROM annexe WHERE campaign_id = ?`)
    .get(c) as { m: number }
  db.prepare(
    `INSERT OR IGNORE INTO annexe (campaign_id, item_id, ord) VALUES (?, ?, ?)`
  ).run(c, itemId, max.m + 1)
  return listAnnexes()
}

export function removeAnnexe(itemId: number): Item[] {
  getDb()
    .prepare(`DELETE FROM annexe WHERE campaign_id = ? AND item_id = ?`)
    .run(activeCampaignId(), itemId)
  return listAnnexes()
}

/** L'ordre de la liste, tel que le meneur l'a rangée. */
export function reorderAnnexes(itemIds: number[]): Item[] {
  const db = getDb()
  const c = activeCampaignId()
  const up = db.prepare(`UPDATE annexe SET ord = ? WHERE campaign_id = ? AND item_id = ?`)
  db.transaction(() => itemIds.forEach((id, n) => up.run(n, c, id)))()
  return listAnnexes()
}
