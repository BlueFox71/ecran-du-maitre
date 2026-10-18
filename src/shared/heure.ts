/**
 * Les heures écrites par la base, rendues à l'heure du MJ.
 *
 * SQLite horodate en UTC (`datetime('now')`) : « 2026-10-17 19:22:37 » veut
 * dire 21 h 22 à Paris en été. Lu tel quel, le journal des jets retardait de
 * deux heures sur l'horloge de séance posée juste au-dessus.
 */
export function dateDeLaBase(at: string): Date {
  return new Date(at.includes('T') ? at : `${at.replace(' ', 'T')}Z`)
}

const deux = (n: number): string => String(n).padStart(2, '0')

/** « 21:22 », à l'heure locale. Une valeur illisible est rendue telle quelle. */
export function heureLocale(at: string): string {
  const d = dateDeLaBase(at)
  if (Number.isNaN(d.getTime())) return at.slice(11, 16)
  return `${deux(d.getHours())}:${deux(d.getMinutes())}`
}

/** « 2026-10-17 21:22:37 », à l'heure locale — pour un export qu'on relira. */
export function horodatageLocal(at: string): string {
  const d = dateDeLaBase(at)
  if (Number.isNaN(d.getTime())) return at
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())} ${deux(d.getHours())}:${deux(d.getMinutes())}:${deux(d.getSeconds())}`
}
