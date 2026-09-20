/**
 * Les réglages de la campagne, dans la table `setting` de son projet.
 *
 * Une clé, une chaîne, et c'est tout : ce dépôt ne sait rien de ce que les
 * clés veulent dire — `@shared/reglages` s'en charge, des deux côtés du pont.
 * Poser `null` efface la ligne plutôt que d'y écrire du vide : un réglage
 * absent est un réglage jamais posé, et il reprend son défaut.
 */
import { getDb, isDbOpen } from '../index'
import type { Brut } from '@shared/reglages'

export function tous(): Brut {
  if (!isDbOpen()) return {}
  const rows = getDb().prepare(`SELECT key, value FROM setting`).all() as {
    key: string
    value: string | null
  }[]
  const out: Brut = {}
  for (const r of rows) if (r.value !== null) out[r.key] = r.value
  return out
}

export function poser(cle: string, valeur: string | null): Brut {
  if (!isDbOpen()) return {}
  if (valeur === null) getDb().prepare(`DELETE FROM setting WHERE key = ?`).run(cle)
  else
    getDb()
      .prepare(
        `INSERT INTO setting (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      )
      .run(cle, valeur)
  return tous()
}
