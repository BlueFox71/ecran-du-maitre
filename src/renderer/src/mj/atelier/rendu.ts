/**
 * Le dessin d'une construction : ce que verront les joueurs.
 *
 * Une seule fonction, pour l'atelier comme pour le plan enregistré : l'aperçu
 * doit montrer exactement l'image qui partira. Les aides de l'atelier
 * (grille, sélection, poignées) se dessinent par-dessus, ailleurs.
 *
 * L'image reste neutre côté lumière : ce sont les lampes du lieu, vivantes en
 * séance, qui font l'ambiance. On ne dessine ici que des ombres de contact —
 * celles qui posent un meuble sur le sol et donnent du volume à un mur.
 */
import {
  contourDeLObjet,
  morceauxPleins,
  placeOuverture,
  type Construction,
  type MurBati,
  type PointCase
} from '@shared/atelier'
import type { AssetAtelier } from '@shared/atelierAssets'
import type { ImagesAtelier } from './images'

const FOND = '#0b1014'
const ABSENT = 'rgba(85, 85, 85, 0.6)'

function chemin(ctx: CanvasRenderingContext2D, pts: PointCase[], px: number): void {
  ctx.beginPath()
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * px, y * px) : ctx.moveTo(x * px, y * px)))
}

function image(images: ImagesAtelier, id: string): HTMLImageElement | null {
  const i = images.get(id)
  return i && i !== 'absent' ? i : null
}

/** Le motif d'une matière, à l'échelle : une tuile couvre `tuile` cases. */
function motifDe(
  ctx: CanvasRenderingContext2D,
  a: AssetAtelier,
  img: HTMLImageElement,
  px: number
): CanvasPattern {
  const motif = ctx.createPattern(img, 'repeat')!
  /* Toutes les matières partent de l'origine du terrain : deux damiers posés
     l'un sur l'autre tombent case sur case. */
  motif.setTransform(new DOMMatrix().scaleSelf(((a.tuile ?? 2) * px) / img.width))
  return motif
}

/**
 * Un trait d'aérosol : des touches rondes aux bords fondus, qui s'additionnent
 * là où le pinceau repasse. On les dessine dans un masque, puis la matière ne
 * se pose qu'à travers lui.
 */
function dessinerAerosol(
  ctx: CanvasRenderingContext2D,
  pts: PointCase[],
  rayon: number,
  remplissage: string | CanvasPattern,
  px: number
): void {
  const r = rayon * px
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x * px - r)
    y0 = Math.min(y0, y * px - r)
    x1 = Math.max(x1, x * px + r)
    y1 = Math.max(y1, y * px + r)
  }
  const w = Math.ceil(x1 - x0)
  const h = Math.ceil(y1 - y0)
  if (w <= 0 || h <= 0) return
  const masque = document.createElement('canvas')
  masque.width = w
  masque.height = h
  const m = masque.getContext('2d')!
  m.translate(-x0, -y0)
  for (const [x, y] of pts) {
    const g = m.createRadialGradient(x * px, y * px, 0, x * px, y * px, r)
    g.addColorStop(0, 'rgba(0, 0, 0, 0.55)')
    g.addColorStop(0.55, 'rgba(0, 0, 0, 0.3)')
    g.addColorStop(1, 'rgba(0, 0, 0, 0)')
    m.fillStyle = g
    m.fillRect(x * px - r, y * px - r, 2 * r, 2 * r)
  }
  m.globalCompositeOperation = 'source-in'
  m.fillStyle = remplissage
  m.fillRect(x0, y0, w, h)
  ctx.drawImage(masque, x0, y0)
}

function dessinerSols(
  ctx: CanvasRenderingContext2D,
  c: Construction,
  assets: Map<string, AssetAtelier>,
  images: ImagesAtelier,
  px: number
): void {
  for (const s of c.sols) {
    const a = assets.get(s.assetId)
    const img = image(images, s.assetId)
    const remplissage = a && img ? motifDe(ctx, a, img, px) : ABSENT
    if (s.rayon) {
      dessinerAerosol(ctx, s.pts, s.rayon, remplissage, px)
      continue
    }
    ctx.save()
    chemin(ctx, s.pts, px)
    ctx.closePath()
    ctx.fillStyle = remplissage
    ctx.fill()
    ctx.restore()
  }
}

/** Un morceau de mur, segment par segment : un rectangle tourné, prolongé d'une demi-épaisseur aux deux bouts. */
function pourChaqueSegment(
  morceau: PointCase[],
  m: MurBati,
  px: number,
  fn: (x: number, y: number, angle: number, longueur: number, ep: number) => void
): void {
  const ep = m.epaisseur * px
  for (let i = 0; i + 1 < morceau.length; i++) {
    const [ax, ay] = morceau[i]
    const [bx, by] = morceau[i + 1]
    const l = Math.hypot(bx - ax, by - ay) * px
    if (l <= 0) continue
    fn(ax * px, ay * px, Math.atan2(by - ay, bx - ax), l, ep)
  }
}

function dessinerMurs(
  ctx: CanvasRenderingContext2D,
  c: Construction,
  images: ImagesAtelier,
  px: number
): void {
  const morceaux = c.murs.map((m) => ({ m, parts: morceauxPleins(m, c.ouvertures) }))

  /* L'ombre au pied des murs, d'abord, sous tous les murs à la fois — en
     deux passes, pour qu'elle se voie sur un sol sombre. */
  ctx.save()
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)'
  for (const passe of [1.8, 0.7])
  for (const { m, parts } of morceaux) {
    ctx.shadowBlur = m.epaisseur * px * passe
    for (const p of parts)
      pourChaqueSegment(p, m, px, (x, y, angle, l, ep) => {
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(angle)
        ctx.fillStyle = '#000'
        ctx.fillRect(-ep / 2, -ep / 2, l + ep, ep)
        ctx.restore()
      })
  }
  ctx.restore()

  /* La maçonnerie : la texture tourne avec le segment, sa hauteur est l'épaisseur. */
  for (const { m, parts } of morceaux) {
    const img = image(images, m.assetId)
    for (const p of parts)
      pourChaqueSegment(p, m, px, (x, y, angle, l, ep) => {
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(angle)
        if (img) {
          const motif = ctx.createPattern(img, 'repeat-x')!
          const e = ep / img.height
          motif.setTransform(new DOMMatrix().translateSelf(-ep / 2, -ep / 2).scaleSelf(e))
          ctx.fillStyle = motif
        } else ctx.fillStyle = '#2c2c30'
        ctx.fillRect(-ep / 2, -ep / 2, l + ep, ep)
        /* Le volume : deux arêtes sombres, un liseré clair au milieu. */
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
        ctx.fillRect(-ep / 2, -ep / 2, l + ep, Math.max(1, ep * 0.08))
        ctx.fillRect(-ep / 2, ep / 2 - Math.max(1, ep * 0.08), l + ep, Math.max(1, ep * 0.08))
        ctx.fillStyle = 'rgba(255, 240, 210, 0.07)'
        ctx.fillRect(-ep / 2, -ep * 0.075, l + ep, ep * 0.15)
        ctx.restore()
      })
  }
}

function dessinerOuvertures(
  ctx: CanvasRenderingContext2D,
  c: Construction,
  images: ImagesAtelier,
  px: number
): void {
  for (const o of c.ouvertures) {
    const m = c.murs.find((x) => x.id === o.murId)
    if (!m) continue
    const { centre, angle, largeur } = placeOuverture(m, o)
    const l = largeur * px
    const img = image(images, o.assetId)
    /* Le battant garde ses proportions, sans dépasser l'épaisseur du mur. */
    const h = img ? Math.min(m.epaisseur * px * 1.15, (l * img.height) / img.width) : m.epaisseur * px * 0.4
    ctx.save()
    ctx.translate(centre[0] * px, centre[1] * px)
    ctx.rotate(angle + (o.retourne ? Math.PI : 0))
    if (o.miroir) ctx.scale(-1, 1)
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'
    ctx.shadowBlur = h * 0.6
    if (img) ctx.drawImage(img, -l / 2, -h / 2, l, h)
    else {
      ctx.fillStyle = ABSENT
      ctx.fillRect(-l / 2, -h / 2, l, h)
    }
    ctx.restore()
  }
}

function dessinerObjets(
  ctx: CanvasRenderingContext2D,
  c: Construction,
  images: ImagesAtelier,
  px: number
): void {
  for (const o of c.objets) {
    const img = image(images, o.assetId)
    ctx.save()
    if (!img) {
      chemin(ctx, contourDeLObjet(o), px)
      ctx.fillStyle = ABSENT
      ctx.fill()
      ctx.restore()
      continue
    }
    ctx.translate(o.x * px, o.y * px)
    ctx.rotate((o.angle * Math.PI) / 180)
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'
    ctx.shadowBlur = 0.15 * px
    ctx.shadowOffsetY = 0.05 * px
    ctx.drawImage(img, (-o.l / 2) * px, (-o.h / 2) * px, o.l * px, o.h * px)
    ctx.restore()
  }
}

/** Dessine la construction entière, à `pxParCase` pixels par case, depuis l'origine du contexte. */
export function dessinerConstruction(
  ctx: CanvasRenderingContext2D,
  c: Construction,
  assets: Map<string, AssetAtelier>,
  images: ImagesAtelier,
  pxParCase: number
): void {
  ctx.save()
  ctx.fillStyle = FOND
  ctx.fillRect(0, 0, c.largeur * pxParCase, c.hauteur * pxParCase)
  dessinerSols(ctx, c, assets, images, pxParCase)
  dessinerMurs(ctx, c, images, pxParCase)
  dessinerOuvertures(ctx, c, images, pxParCase)
  dessinerObjets(ctx, c, images, pxParCase)
  ctx.restore()
}

/** La résolution du plan enregistré : fine, sans dépasser 8192 px de côté. */
export const pxExport = (c: Construction): number =>
  Math.min(128, Math.floor(8192 / Math.max(c.largeur, c.hauteur)))

/** Le plan tel qu'il partira : un PNG, sans aucune aide de l'atelier. */
export async function exporterPng(
  c: Construction,
  assets: Map<string, AssetAtelier>,
  images: ImagesAtelier
): Promise<Uint8Array> {
  const px = pxExport(c)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(c.largeur * px)
  canvas.height = Math.round(c.hauteur * px)
  dessinerConstruction(canvas.getContext('2d')!, c, assets, images, px)
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/png'))
  if (!blob) throw new Error('Le plan n’a pas pu être dessiné')
  return new Uint8Array(await blob.arrayBuffer())
}
