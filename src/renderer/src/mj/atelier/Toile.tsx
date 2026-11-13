/**
 * La toile de l'atelier : la construction dessinée, qu'on zoome et qu'on
 * déplace, avec la grille et ce que l'outil en cours veut montrer.
 *
 * La construction se dessine une fois dans un cache, à chaque changement ;
 * zoomer ou déplacer ne fait que recopier ce cache. Les aides — grille,
 * aperçu d'un trait, sélection — se dessinent par-dessus, en cases.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Construction, PointCase } from '@shared/atelier'
import type { AssetAtelier } from '@shared/atelierAssets'
import { dessinerConstruction } from './rendu'
import type { ImagesAtelier } from './images'

export type GestePointeur = 'down' | 'move' | 'up' | 'dbl'

export interface Outil {
  curseur?: string
  /** `p` est aimanté à la grille (si elle est active et Maj relâché), `brut` jamais. */
  onPointer?: (type: GestePointeur, p: PointCase, brut: PointCase, e: PointerEvent | MouseEvent) => void
  /** Dessine par-dessus la construction ; le contexte est en cases. `echelle` : pixels écran par case. */
  dessiner?: (ctx: CanvasRenderingContext2D, echelle: number) => void
}

/** Le pas de la grille aimantée, en cases. */
export const PAS_AIMANT = 0.5

export function aimanter(p: PointCase, grille: boolean, e: { shiftKey: boolean }): PointCase {
  if (!grille || e.shiftKey) return p
  return [Math.round(p[0] / PAS_AIMANT) * PAS_AIMANT, Math.round(p[1] / PAS_AIMANT) * PAS_AIMANT]
}

const PX_CACHE_MAX = 96

export function Toile({
  c,
  assets,
  images,
  versionImages,
  grille,
  outil,
  repeindre
}: {
  c: Construction
  assets: Map<string, AssetAtelier>
  images: ImagesAtelier
  /** Change quand une image vient d'arriver : le cache se redessine. */
  versionImages: number
  grille: boolean
  outil: Outil | null
  /** Change quand l'outil veut que sa couche se redessine (un aperçu qui suit la souris). */
  repeindre: number
}): JSX.Element {
  const boite = useRef<HTMLDivElement>(null)
  const toile = useRef<HTMLCanvasElement>(null)
  const cache = useRef<HTMLCanvasElement | null>(null)
  const [taille, setTaille] = useState({ w: 0, h: 0 })
  /* La vue : pixels écran par case, et où tombe l'origine du terrain. */
  const [vue, setVue] = useState<{ echelle: number; x: number; y: number } | null>(null)
  const [cacheV, setCacheV] = useState(0)
  const glisse = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)
  const espace = useRef(false)

  useEffect(() => {
    const el = boite.current
    if (!el) return
    const ro = new ResizeObserver(() => setTaille({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  /* Cadrer le terrain entier à l'ouverture, et quand il change de taille. */
  useEffect(() => {
    if (!taille.w || !taille.h) return
    const echelle = Math.min((taille.w - 40) / c.largeur, (taille.h - 40) / c.hauteur)
    setVue({ echelle, x: (taille.w - c.largeur * echelle) / 2, y: (taille.h - c.hauteur * echelle) / 2 })
  }, [taille.w > 0 && taille.h > 0, c.largeur, c.hauteur])

  /* Le cache : la construction, à résolution fixe. */
  useEffect(() => {
    const px = Math.min(PX_CACHE_MAX, Math.floor(6000 / Math.max(c.largeur, c.hauteur)))
    const cv = cache.current ?? document.createElement('canvas')
    cv.width = Math.round(c.largeur * px)
    cv.height = Math.round(c.hauteur * px)
    dessinerConstruction(cv.getContext('2d')!, c, assets, images, px)
    cache.current = cv
    setCacheV((v) => v + 1)
  }, [c, assets, images, versionImages])

  /* La toile visible. */
  useEffect(() => {
    const cv = toile.current
    if (!cv || !vue || !cache.current) return
    const dpr = window.devicePixelRatio || 1
    cv.width = Math.round(taille.w * dpr)
    cv.height = Math.round(taille.h * dpr)
    const ctx = cv.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#05080a'
    ctx.fillRect(0, 0, taille.w, taille.h)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(cache.current, vue.x, vue.y, c.largeur * vue.echelle, c.hauteur * vue.echelle)
    ctx.setTransform(dpr * vue.echelle, 0, 0, dpr * vue.echelle, dpr * vue.x, dpr * vue.y)
    if (grille) {
      ctx.beginPath()
      for (let x = 0; x <= c.largeur; x++) {
        ctx.moveTo(x, 0)
        ctx.lineTo(x, c.hauteur)
      }
      for (let y = 0; y <= c.hauteur; y++) {
        ctx.moveTo(0, y)
        ctx.lineTo(c.largeur, y)
      }
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'
      ctx.lineWidth = 1 / vue.echelle
      ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(216, 169, 74, 0.6)'
    ctx.lineWidth = 1.5 / vue.echelle
    ctx.strokeRect(0, 0, c.largeur, c.hauteur)
    outil?.dessiner?.(ctx, vue.echelle)
  }, [vue, taille, cacheV, grille, outil, repeindre, c.largeur, c.hauteur])

  const enCases = useCallback(
    (e: { clientX: number; clientY: number }): PointCase => {
      const r = toile.current!.getBoundingClientRect()
      return vue ? [(e.clientX - r.left - vue.x) / vue.echelle, (e.clientY - r.top - vue.y) / vue.echelle] : [0, 0]
    },
    [vue]
  )

  useEffect(() => {
    const bas = (e: KeyboardEvent): void => {
      const el = document.activeElement
      if (e.code === 'Space' && !(el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) espace.current = true
    }
    const haut = (e: KeyboardEvent): void => {
      if (e.code === 'Space') espace.current = false
    }
    window.addEventListener('keydown', bas)
    window.addEventListener('keyup', haut)
    return () => {
      window.removeEventListener('keydown', bas)
      window.removeEventListener('keyup', haut)
    }
  }, [])

  const envoyer = (type: GestePointeur, e: PointerEvent | MouseEvent): void => {
    const brut = enCases(e)
    outil?.onPointer?.(type, aimanter(brut, grille, e), brut, e)
  }

  return (
    <div className="at-toile" ref={boite}>
      <canvas
        ref={toile}
        style={{ width: taille.w, height: taille.h, cursor: glisse.current ? 'grabbing' : outil?.curseur ?? 'default' }}
        onPointerDown={(e) => {
          try {
            ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
          } catch {
            /* un pointeur déjà relâché : rien à capturer */
          }
          if (e.button === 1 || (e.button === 0 && espace.current)) {
            if (vue) glisse.current = { x: e.clientX, y: e.clientY, vx: vue.x, vy: vue.y }
            e.preventDefault()
            return
          }
          if (e.button === 0) envoyer('down', e.nativeEvent)
        }}
        onPointerMove={(e) => {
          const g = glisse.current
          if (g && vue) {
            setVue({ ...vue, x: g.vx + e.clientX - g.x, y: g.vy + e.clientY - g.y })
            return
          }
          envoyer('move', e.nativeEvent)
        }}
        onPointerUp={(e) => {
          if (glisse.current) {
            glisse.current = null
            return
          }
          if (e.button === 0) envoyer('up', e.nativeEvent)
        }}
        onDoubleClick={(e) => envoyer('dbl', e.nativeEvent)}
        onWheel={(e) => {
          if (!vue) return
          const r = toile.current!.getBoundingClientRect()
          const mx = e.clientX - r.left
          const my = e.clientY - r.top
          const f = Math.exp(-e.deltaY * 0.0015)
          const echelle = Math.min(400, Math.max(4, vue.echelle * f))
          const k = echelle / vue.echelle
          setVue({ echelle, x: mx - (mx - vue.x) * k, y: my - (my - vue.y) * k })
        }}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  )
}
