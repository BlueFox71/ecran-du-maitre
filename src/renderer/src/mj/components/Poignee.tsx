/**
 * Une poignée entre deux colonnes d'une grille, qu'on tire à la souris.
 *
 * La largeur de la colonne de gauche part dans une variable CSS posée sur la
 * grille (`--fiche-g`, `--pu-g`…), que la feuille de style lit dans son
 * `grid-template-columns`. Elle reste sur ce poste (stockage du navigateur) :
 * c'est une habitude d'écran, pas une règle de la campagne. Double-clic : la
 * largeur d'origine.
 *
 * La grille doit être en `position: relative` ; la poignée se pose au bord
 * droit de la colonne de gauche (plus la moitié de l'écart entre colonnes).
 */
import { useLayoutEffect, useRef, useState } from 'react'

export function usePoignee({
  cle,
  variable,
  gauche,
  min = 180,
  resteMin = 320,
  demiEcart = 0
}: {
  /** Où garder la largeur dans le stockage du navigateur. */
  cle: string
  /** La variable CSS que la grille lit (`--fiche-g`). */
  variable: string
  /** La colonne de gauche, sélecteur relatif à la grille (`:scope > …`). */
  gauche: string
  /** Sa largeur minimale. */
  min?: number
  /** Ce qu'il faut laisser au reste de la grille. */
  resteMin?: number
  /** La moitié de l'écart entre colonnes : la poignée se pose au milieu. */
  demiEcart?: number
}): {
  ref: React.RefObject<HTMLDivElement>
  largeur: number | null
  poignee: JSX.Element
} {
  const ref = useRef<HTMLDivElement>(null)
  const [largeur, setLargeur] = useState<number | null>(() => {
    try {
      const v = Number(localStorage.getItem(cle))
      return v > 0 ? v : null
    } catch {
      return null
    }
  })
  /* Où se trouve le bord : la colonne d'usine change avec la fenêtre. */
  const [bord, setBord] = useState(0)
  const [tire, setTire] = useState(false)
  /* Pendant qu'on tire, React ne voit rien : on écrit la largeur droit dans
     le style de la grille, une fois par image. Redessiner toute la page à
     chaque pixel rendait le geste saccadé. */
  const enCours = useRef<{ largeur: number; image: number } | null>(null)
  const poigneeEl = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const grille = ref.current
    const el = grille?.querySelector<HTMLElement>(gauche)
    if (!grille || !el) return
    const mesurer = (): void => {
      if (!enCours.current) setBord(el.offsetLeft + el.offsetWidth + demiEcart)
    }
    mesurer()
    const ro = new ResizeObserver(mesurer)
    ro.observe(grille)
    ro.observe(el)
    return () => ro.disconnect()
  }, [largeur, gauche, demiEcart])

  const garder = (v: number | null): void => {
    try {
      if (v == null) localStorage.removeItem(cle)
      else localStorage.setItem(cle, String(Math.round(v)))
    } catch {
      /* sans stockage, la largeur ne dure que la visite */
    }
  }

  const poignee = (
    <div
      ref={poigneeEl}
      className={`poignee-col${tire ? ' tire' : ''}`}
      style={{ left: bord }}
      role="separator"
      aria-orientation="vertical"
      title="Tirer pour régler la largeur · double-clic : largeur d’origine"
      onPointerDown={(e) => {
        if (!ref.current) return
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        enCours.current = { largeur: largeur ?? bord - demiEcart, image: 0 }
        setTire(true)
      }}
      onPointerMove={(e) => {
        const g = enCours.current
        if (!g || !ref.current) return
        const r = ref.current.getBoundingClientRect()
        const x = e.clientX - r.left - demiEcart
        g.largeur = Math.max(min, Math.min(r.width - resteMin, x))
        if (g.image) return
        g.image = requestAnimationFrame(() => {
          g.image = 0
          ref.current?.style.setProperty(variable, `${g.largeur}px`)
          if (poigneeEl.current) poigneeEl.current.style.left = `${g.largeur + demiEcart}px`
        })
      }}
      onPointerUp={() => {
        const g = enCours.current
        if (!g) return
        if (g.image) cancelAnimationFrame(g.image)
        enCours.current = null
        setTire(false)
        setLargeur(g.largeur)
        setBord(g.largeur + demiEcart)
        garder(g.largeur)
        /* Lâché au-dessus d'un bouton, le clic qui suit l'actionnerait : on
           l'avale. */
        const avaler = (ev: MouseEvent): void => {
          ev.stopPropagation()
          ev.preventDefault()
        }
        window.addEventListener('click', avaler, { capture: true, once: true })
        setTimeout(() => window.removeEventListener('click', avaler, { capture: true }), 50)
      }}
      onDoubleClick={() => {
        setLargeur(null)
        garder(null)
      }}
    />
  )
  return { ref, largeur, poignee }
}
