/** Les aides de l'atelier dessinées sur la toile, en cases. */
import type { PointCase } from '@shared/atelier'

const OR = 'rgba(232, 184, 92, 0.95)'

/** Un contour fermé, souligné d'un halo sombre pour se lire sur tous les sols. */
export function contour(ctx: CanvasRenderingContext2D, pts: PointCase[], echelle: number, voile = false): void {
  if (pts.length < 2) return
  ctx.beginPath()
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  ctx.closePath()
  if (voile) {
    ctx.fillStyle = 'rgba(232, 184, 92, 0.12)'
    ctx.fill()
  }
  ctx.lineJoin = 'round'
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)'
  ctx.lineWidth = 4 / echelle
  ctx.stroke()
  ctx.strokeStyle = OR
  ctx.lineWidth = 2 / echelle
  ctx.stroke()
}

/** Une ligne en cours de tracé, ses sommets marqués. */
export function pointille(ctx: CanvasRenderingContext2D, pts: PointCase[], echelle: number): void {
  if (!pts.length) return
  ctx.beginPath()
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  ctx.setLineDash([6 / echelle, 4 / echelle])
  ctx.strokeStyle = OR
  ctx.lineWidth = 2 / echelle
  ctx.stroke()
  ctx.setLineDash([])
  for (const [x, y] of pts) poignee(ctx, [x, y], echelle)
}

/** Une poignée carrée qu'on peut saisir. */
export function poignee(ctx: CanvasRenderingContext2D, [x, y]: PointCase, echelle: number, active = false): void {
  const r = (active ? 6 : 4.5) / echelle
  ctx.fillStyle = active ? OR : '#fff'
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)'
  ctx.lineWidth = 1.5 / echelle
  ctx.fillRect(x - r, y - r, 2 * r, 2 * r)
  ctx.strokeRect(x - r, y - r, 2 * r, 2 * r)
}

/** Un segment épais, pour l'aperçu d'un mur. */
export function trait(
  ctx: CanvasRenderingContext2D,
  pts: PointCase[],
  epaisseur: number,
  couleur = 'rgba(232, 184, 92, 0.55)'
): void {
  if (pts.length < 2) return
  ctx.beginPath()
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  ctx.lineJoin = 'miter'
  ctx.lineCap = 'square'
  ctx.strokeStyle = couleur
  ctx.lineWidth = epaisseur
  ctx.stroke()
}

/** Un rond : la touche d'un aérosol, ou le pinceau sous la souris. */
export function cercle(
  ctx: CanvasRenderingContext2D,
  [x, y]: PointCase,
  r: number,
  echelle: number,
  plein = false
): void {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  if (plein) {
    ctx.fillStyle = 'rgba(232, 184, 92, 0.08)'
    ctx.fill()
  } else {
    ctx.strokeStyle = 'rgba(232, 184, 92, 0.9)'
    ctx.lineWidth = 1.5 / echelle
    ctx.stroke()
  }
}
