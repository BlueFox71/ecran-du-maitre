/**
 * Dire une durée et des dimensions comme on les dit à voix haute.
 *
 * Ces mesures viennent de l'examen des médias (`main/examen.ts`) et se
 * retrouvent dans trois endroits — la Bibliothèque, le Pupitre, la Régie —,
 * d'où ce petit module commun plutôt que trois formatages qui divergeront.
 */

/**
 * `2:07`, `1:04:30`. On ne montre l'heure que s'il y en a une : un bruitage de
 * porte n'a pas à s'annoncer « 0:00:03 ».
 */
export function duree(secondes: number | null | undefined): string | null {
  if (secondes == null || !Number.isFinite(secondes) || secondes <= 0) return null
  const t = Math.round(secondes)
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = t % 60
  const ss = String(s).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** `1920 × 1080`, avec la vraie multiplication et son espace insécable. */
export function dimensions(w: number | null | undefined, h: number | null | undefined): string | null {
  if (!w || !h) return null
  return `${w} × ${h}`
}
