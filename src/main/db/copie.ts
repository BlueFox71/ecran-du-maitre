import { getDb } from './index'

/**
 * Recopier une ligne telle quelle, sauf ce qu'on lui change.
 *
 * Les colonnes se lisent dans la base au moment de copier, pas dans une liste
 * écrite ici : un lieu gagne une colonne presque à chaque chantier, et une
 * copie qui l'oublierait rendrait un lieu à moitié réglé sans que rien ne le
 * signale. `remplace` nomme les colonnes qui prennent une autre valeur ; les
 * autres suivent l'original.
 */
export function copierLigne(
  table: string,
  id: number,
  remplace: Record<string, string | number | null>
): number {
  const db = getDb()
  const cols = (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[])
    .map((c) => c.name)
    .filter((n) => n !== 'id')
  const valeurs = cols.map((c) => (c in remplace ? `@${c}` : `"${c}"`))
  const params: Record<string, string | number | null> = { __id: id }
  for (const c of cols) if (c in remplace) params[c] = remplace[c]
  const info = db
    .prepare(
      `INSERT INTO ${table} (${cols.map((c) => `"${c}"`).join(', ')})
       SELECT ${valeurs.join(', ')} FROM ${table} WHERE id = @__id`
    )
    .run(params)
  return Number(info.lastInsertRowid)
}
