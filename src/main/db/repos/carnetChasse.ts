/**
 * Le carnet des chasseurs : ses lignes (indices et entités, propres à la
 * campagne) et les marques que les joueurs y posent, séance par séance.
 *
 * Ce dépôt ne déduit rien : il range des cercles et des traits. Voir
 * `@shared/carnetChasse`. (Rien à voir avec `src/main/carnet.ts`, le carnet de
 * joueurs du poste.)
 */
import { activeCampaignId, activeSessionId, getDb } from '../index'
import * as reglages from './reglages'
import { lireCampagne } from '@shared/reglages'
import {
  ENTITES_DEPART,
  INDICES_DEPART,
  type ElementCarnet,
  type EtatMarque,
  type GenreCarnet,
  type MarqueCarnet
} from '@shared/carnetChasse'

/** Les lignes de la campagne : les indices, puis les entités, chacun dans son ordre. */
export function elements(): ElementCarnet[] {
  return getDb()
    .prepare(
      `SELECT id, genre, nom FROM carnet_element WHERE campaign_id = ?
        ORDER BY CASE genre WHEN 'indice' THEN 0 ELSE 1 END, ord, id`
    )
    .all(activeCampaignId()) as ElementCarnet[]
}

/** Une ligne de plus, en bas de son genre. Un nom vide n'en fait pas une. */
export function ajouterElement(genre: GenreCarnet, nom: string): ElementCarnet | null {
  const n = nom.trim()
  if (!n || (genre !== 'indice' && genre !== 'entite')) return null
  const db = getDb()
  const cid = activeCampaignId()
  const ord =
    ((db.prepare(`SELECT MAX(ord) AS m FROM carnet_element WHERE campaign_id = ? AND genre = ?`).get(cid, genre) as {
      m: number | null
    }).m ?? -1) + 1
  const id = Number(
    db
      .prepare(`INSERT INTO carnet_element (campaign_id, genre, nom, ord) VALUES (?, ?, ?, ?)`)
      .run(cid, genre, n, ord).lastInsertRowid
  )
  return { id, genre, nom: n }
}

/** Renommer garde les marques : c'est la même ligne. Un nom vide ne change rien. */
export function renommerElement(id: number, nom: string): void {
  const n = nom.trim()
  if (!n) return
  getDb().prepare(`UPDATE carnet_element SET nom = ? WHERE id = ? AND campaign_id = ?`).run(n, id, activeCampaignId())
}

/** Retirer une ligne emporte ses marques, de toutes les séances (ON DELETE CASCADE). */
export function retirerElement(id: number): void {
  getDb().prepare(`DELETE FROM carnet_element WHERE id = ? AND campaign_id = ?`).run(id, activeCampaignId())
}

/** L'ordre d'un genre : celui de `ids`. Un id étranger à ce genre est ignoré. */
export function ordonner(genre: GenreCarnet, ids: number[]): void {
  const db = getDb()
  const cid = activeCampaignId()
  const maj = db.prepare(`UPDATE carnet_element SET ord = ? WHERE id = ? AND campaign_id = ? AND genre = ?`)
  db.transaction(() => ids.forEach((id, i) => maj.run(i, id, cid, genre)))()
}

/** Noté dans `setting` : les listes de départ ne se posent qu'une fois. */
const CLE_DEPART = 'carnet.depart'

/**
 * Les listes du livre des fantômes, posées une seule fois : dans une campagne
 * de chasse (règles « fantomes », ou jamais choisies), et seulement si elle
 * n'a encore aucune ligne. Un MJ qui vide ses listes ne les voit pas revenir.
 */
export function poserListesDeDepart(): boolean {
  const db = getDb()
  if (db.prepare(`SELECT 1 FROM setting WHERE key = ?`).get(CLE_DEPART)) return false
  reglages.poser(CLE_DEPART, '1')
  const regles = lireCampagne(reglages.tous()).regles
  if (regles !== 'fantomes' && regles !== null) return false
  const deja = db.prepare(`SELECT 1 FROM carnet_element WHERE campaign_id = ? LIMIT 1`).get(activeCampaignId())
  if (deja) return false
  db.transaction(() => {
    for (const nom of INDICES_DEPART) ajouterElement('indice', nom)
    for (const nom of ENTITES_DEPART) ajouterElement('entite', nom)
  })()
  return true
}

/** Les marques de la séance active, de tous les personnages. */
export function marquesDeLaSeance(): MarqueCarnet[] {
  return getDb()
    .prepare(
      `SELECT m.character_id AS characterId, m.element_id AS elementId, m.etat
         FROM carnet_marque m JOIN carnet_element e ON e.id = m.element_id
        WHERE m.session_id = ? AND e.campaign_id = ?
        ORDER BY e.id, m.character_id`
    )
    .all(activeSessionId(), activeCampaignId()) as MarqueCarnet[]
}

/**
 * Poser une marque (ou l'effacer avec `null`) pour la séance active. Le
 * téléphone envoie l'état voulu, pas « au suivant » : un envoi répété ne fait
 * pas tourner deux fois. Une ligne qui n'est pas de la campagne est refusée.
 */
export function marquer(characterId: number, elementId: number, etat: EtatMarque | null): boolean {
  const db = getDb()
  const ok = db
    .prepare(`SELECT 1 FROM carnet_element WHERE id = ? AND campaign_id = ?`)
    .get(elementId, activeCampaignId())
  if (!ok) return false
  const sid = activeSessionId()
  if (etat === null) {
    db.prepare(`DELETE FROM carnet_marque WHERE session_id = ? AND character_id = ? AND element_id = ?`).run(
      sid,
      characterId,
      elementId
    )
  } else if (etat === 'entoure' || etat === 'barre') {
    db.prepare(
      `INSERT INTO carnet_marque (session_id, character_id, element_id, etat) VALUES (?, ?, ?, ?)
         ON CONFLICT(session_id, character_id, element_id) DO UPDATE SET etat = excluded.etat`
    ).run(sid, characterId, elementId, etat)
  } else return false
  return true
}
