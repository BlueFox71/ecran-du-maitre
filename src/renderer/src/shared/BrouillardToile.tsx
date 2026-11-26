/**
 * L'ombre peinte dans un canvas plutôt qu'en masques SVG.
 *
 * Même calcul que `Brouillard` (`useOmbre`), même règles — la lumière
 * commande, la mémoire dépend du lieu —, autre pinceau. Safari (et tout
 * navigateur d'iPad ou d'iPhone, qui en est un) repeint les masques SVG
 * imbriqués sur le processeur, toute la carte à chaque mise à jour : le pion
 * tombait à une dizaine d'images par seconde. Ici, chaque mise à jour est une
 * poignée de polygones peints dans une image de quelques centaines de pixels,
 * puis une passe qui la change en ombre ; le navigateur n'a plus qu'à poser
 * cette image, agrandie, sur la carte.
 *
 * Comment se lisent les masques du SVG, ici :
 * - « ce qu'on voit » est une image en gris, noire au départ, où chaque
 *   couche de regard se peint en `lighten` (la plus claire l'emporte), comme
 *   `MELANGE_LUMIERE` ;
 * - le masque des lampes (`-lum`) est une seconde image en gris, qu'on
 *   multiplie par la première ;
 * - l'ombre est le noir, opaque à 82 % sur ce qu'on a déjà vu (`.br-vu`),
 *   plein ailleurs (`.br-noir`), là où l'on ne voit pas.
 *
 * Le flou des bords n'y est pas : la définition réduite, agrandie en douceur
 * par le navigateur, suffit à les adoucir. La teinte des lampes non plus —
 * une nuance que Safari ne mélange pas comme Chrome ; les portes, elles, sont
 * déjà dessinées sous l'ombre par la page du portable.
 */
import { useEffect, useRef } from 'react'
import type { CalqueBrouillard } from '@shared/types'
import type { Pt } from '@shared/murs'
import { useOmbre, type Oeil } from './Brouillard'
import { PENOMBRE_BORD, REGARD_NET, gris, type Couche, type Dehors, type Lueur } from './Lueur'

/** La largeur de l'image de l'ombre, au plus, en pixels. */
const LARGEUR_MAX = 900
/** Ce qu'on a au bout des bras, même dans le noir (comme dans `Brouillard`). */
const A_PORTEE = 0.018
/** Le noir de ce qu'on a déjà vu (`.br-vu`), et de ce qu'on n'a jamais vu. */
const ALPHA_VU = 0.82

function toile(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

function trace(ctx: CanvasRenderingContext2D, pts: Pt[]): void {
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.closePath()
}

/** Un fond noir, opaque, dans le repère de l'image (`k` : pixels de toile par pixel d'image). */
function noir(ctx: CanvasRenderingContext2D, k: number): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.setTransform(k, 0, 0, k, 0, 0)
}

/**
 * Les couches d'un regard, en gris : leur force, ou — avec `fondu` — leur
 * force jusqu'à `REGARD_NET` de la portée puis le noir au bout.
 */
function couches(ctx: CanvasRenderingContext2D, liste: Couche[], fondu: { c: Pt; r: number } | null): void {
  ctx.globalCompositeOperation = 'lighten'
  for (const k of liste) {
    if (fondu) {
      const g = ctx.createRadialGradient(fondu.c.x, fondu.c.y, 0, fondu.c.x, fondu.c.y, Math.max(1, fondu.r))
      g.addColorStop(0, gris(k.force))
      g.addColorStop(REGARD_NET, gris(k.force))
      g.addColorStop(1, '#000')
      ctx.fillStyle = g
    } else ctx.fillStyle = gris(k.force)
    trace(ctx, k.pts)
    ctx.fill()
  }
}

/** Le masque des lampes, en gris : chaque lueur et la lumière du dehors, la plus claire l'emportant. */
function lumiere(ctx: CanvasRenderingContext2D, k: number, lueurs: Lueur[], dehors: Dehors | null, w: number, h: number): void {
  noir(ctx, k)
  ctx.globalCompositeOperation = 'lighten'
  for (const l of lueurs) {
    const g = ctx.createRadialGradient(l.c.x, l.c.y, 0, l.c.x, l.c.y, Math.max(1, l.r))
    g.addColorStop(0, gris(1))
    g.addColorStop(Math.min(1, Math.max(0, l.f)), gris(1))
    g.addColorStop(1, gris(PENOMBRE_BORD))
    ctx.fillStyle = g
    trace(ctx, l.pts)
    ctx.fill()
  }
  if (dehors) {
    /* Le dehors d'abord à part, comme son groupe SVG : tout éclairé, les
       pièces au noir, ce que l'astre y fait entrer rallumé — puis mêlé. */
    const d = toile(ctx.canvas.width, ctx.canvas.height)
    const dc = d.getContext('2d')!
    dc.setTransform(k, 0, 0, k, 0, 0)
    dc.fillStyle = gris(dehors.force)
    dc.fillRect(0, 0, w, h)
    dc.fillStyle = '#000'
    for (const p of dehors.pieces) {
      if (p.length < 3) continue
      trace(dc, p)
      dc.fill()
    }
    if (dehors.dedans.length > 2) {
      dc.fillStyle = gris(dehors.force)
      trace(dc, dehors.dedans)
      dc.fill()
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalCompositeOperation = 'lighten'
    ctx.drawImage(d, 0, 0)
    ctx.setTransform(k, 0, 0, k, 0, 0)
  }
}

export function BrouillardToile({
  calque,
  yeux,
  w,
  h
}: {
  calque: CalqueBrouillard
  yeux: Oeil[]
  /** La taille naturelle de l'image : le repère de tout ce qu'on dessine. */
  w: number
  h: number
}): JSX.Element | null {
  const { lumGarde, regardsY, couchesY, lueurs, dehors, sousLaLampe, connu, inconnu } = useOmbre(calque, yeux, w, h)
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const sortie = ref.current
    if (!sortie || w <= 0 || h <= 0) return
    const k = Math.min(1, LARGEUR_MAX / w)
    const cw = Math.max(1, Math.round(w * k))
    const ch = Math.max(1, Math.round(h * k))
    if (sortie.width !== cw || sortie.height !== ch) {
      sortie.width = cw
      sortie.height = ch
    }

    /* 1. Ce qu'on voit, en gris. */
    const vue = toile(cw, ch)
    const v = vue.getContext('2d')!
    noir(v, k)
    if (sousLaLampe) {
      /* Au loin, seulement ce que les lampes éclairent : les couches, puis
         multipliées par le masque des lampes. */
      const loin = toile(cw, ch)
      const lc = loin.getContext('2d')!
      noir(lc, k)
      for (const c of couchesY) couches(lc, c.loin, null)
      const lum = toile(cw, ch)
      lumiere(lum.getContext('2d')!, k, lueurs, dehors, w, h)
      lc.setTransform(1, 0, 0, 1, 0, 0)
      lc.globalCompositeOperation = 'multiply'
      lc.drawImage(lum, 0, 0)
      v.setTransform(1, 0, 0, 1, 0, 0)
      v.globalCompositeOperation = 'lighten'
      v.drawImage(loin, 0, 0)
      v.setTransform(k, 0, 0, k, 0, 0)
    } else {
      couchesY.forEach((c, i) => {
        if (!regardsY[i]?.portee) couches(v, c.loin, null)
      })
    }
    /* Jusqu'à la portée, on distingue sans lumière — de moins en moins. */
    couchesY.forEach((c, i) => {
      const r = regardsY[i]
      if (r?.portee) couches(v, c.proche, { c: r.c, r: r.portee * w })
    })
    /* Ce qu'on a au bout des bras, lampe ou pas. */
    v.globalCompositeOperation = 'lighten'
    v.fillStyle = '#fff'
    for (const o of yeux) {
      v.beginPath()
      v.arc(o.x * w, o.y * h, w * A_PORTEE, 0, Math.PI * 2)
      v.fill()
    }

    /* 2. Ce qu'on n'a jamais vu, en blanc — si le lieu garde la mémoire. */
    let jamais: Uint8ClampedArray | null = null
    if (inconnu) {
      const t = toile(cw, ch)
      const tc = t.getContext('2d')!
      noir(tc, k)
      tc.fillStyle = '#fff'
      tc.fill(new Path2D(inconnu))
      jamais = tc.getImageData(0, 0, cw, ch).data
    }

    /* 3. L'ombre : du noir là où l'on ne voit pas, plus ou moins opaque. */
    const vu = v.getImageData(0, 0, cw, ch).data
    const out = sortie.getContext('2d')!
    const img = out.createImageData(cw, ch)
    const px = img.data
    /* Sans mémoire, un seul noir ; avec, le sombre du déjà-vu et le noir plein de l'inconnu. */
    const fond = lumGarde && connu.size ? ALPHA_VU : 1
    for (let p = 0; p < px.length; p += 4) {
      const cache = 1 - vu[p] / 255
      let a = fond * cache
      if (jamais) {
        const n = (jamais[p] / 255) * cache
        a = n + a * (1 - n)
      }
      px[p + 3] = Math.round(a * 255)
    }
    out.putImageData(img, 0, 0)
  }, [lumGarde, regardsY, couchesY, lueurs, dehors, sousLaLampe, connu, inconnu, yeux, w, h])

  if (w <= 0 || h <= 0) return null
  return <canvas ref={ref} className="brouillard brouillard-toile" aria-hidden="true" />
}
