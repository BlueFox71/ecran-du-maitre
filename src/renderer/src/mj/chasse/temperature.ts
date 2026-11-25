/**
 * Le thermomètre du chasseur de fantômes : la température affichée rejoint en
 * douceur celle que le MJ choisit, avec le petit bruit d'une vraie mesure.
 *
 * Ici, le calcul pur ; la case (Thermometre.tsx) l'affiche dans l'écran de la
 * photo, en chiffres à segments.
 */

export const TEMPERATURE_MIN = -20
export const TEMPERATURE_MAX = 35

export function bornerTemperature(t: number): number {
  return Math.max(TEMPERATURE_MIN, Math.min(TEMPERATURE_MAX, Number.isFinite(t) ? t : 0))
}

/**
 * Un pas vers la cible : au plus `vitesse` degrés par seconde, pendant `dt`
 * secondes — sans jamais la dépasser.
 */
export function rapprocher(actuelle: number, cible: number, vitesse: number, dt: number): number {
  const ecart = cible - actuelle
  const pas = Math.max(0, vitesse) * Math.max(0, dt)
  if (Math.abs(ecart) <= pas) return cible
  return actuelle + Math.sign(ecart) * pas
}

/** La température telle que l'écran l'écrit : un chiffre après la virgule, « -0.0 » évité. */
export function texteTemperature(t: number): string {
  const arrondi = Math.round(t * 10) / 10
  return (Object.is(arrondi, -0) ? 0 : arrondi).toFixed(1)
}

/**
 * Le froid sur l'écran, de 0 (tiède, 12 °C et plus) à 1 (glacial, −5 °C et
 * moins) : le rétroéclairage blanchit à mesure qu'il fait froid.
 */
export function froid(t: number): number {
  return Math.max(0, Math.min(1, (12 - t) / 17))
}
