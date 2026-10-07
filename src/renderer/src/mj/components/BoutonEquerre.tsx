/**
 * Les gestes d'un sommet choisi — le mettre d'équerre, le supprimer —, posés
 * à côté de lui.
 *
 * Ils ne vivent pas dans le calque de la carte : celui-ci est agrandi par le
 * zoom, rogné par son cadre, et d'autres calques s'empilent par-dessus. La
 * barre se pose donc sur le corps de la page, au premier plan, et suit le
 * sommet à l'écran — zoom et défilement compris.
 */
import { useEffect, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { IconTrash } from './Icons'
import type { Pt } from '@shared/murs'

export function BoutonEquerre({
  hote,
  sommet,
  droit,
  quoi = 'sommet',
  onEquerre,
  onSupprimer
}: {
  /** Le calque qui porte le sommet. */
  hote: RefObject<HTMLElement>
  /** Le sommet, en pixels de mise en page du calque. */
  sommet: Pt
  /**
   * Déjà à angle droit : le bouton le dit et ne fait rien. `null` : pas
   * d'angle à redresser — le bouton d'équerre ne se montre pas.
   */
  droit: boolean | null
  quoi?: 'sommet' | 'coin'
  onEquerre: () => void
  /** Absent : ce point ne peut pas partir. */
  onSupprimer?: () => void
}): JSX.Element | null {
  const [ecran, setEcran] = useState<Pt | null>(null)

  /* Le calque bouge sans nous prévenir — zoom, recadrage, défilement : on
     relit sa place à chaque image tant que la barre est là. */
  useEffect(() => {
    let tour = 0
    const lire = (): void => {
      const el = hote.current
      if (el && el.clientWidth && el.clientHeight) {
        const b = el.getBoundingClientRect()
        const x = b.left + (sommet.x * b.width) / el.clientWidth
        const y = b.top + (sommet.y * b.height) / el.clientHeight
        setEcran((e) => (e && Math.abs(e.x - x) < 0.5 && Math.abs(e.y - y) < 0.5 ? e : { x, y }))
      }
      tour = requestAnimationFrame(lire)
    }
    lire()
    return () => cancelAnimationFrame(tour)
  }, [hote, sommet.x, sommet.y])

  if (!ecran || (droit === null && !onSupprimer)) return null
  return createPortal(
    <div
      className="equerre-sommet"
      style={{ left: ecran.x + 12, top: ecran.y - 14 }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {droit !== null ? (
        <button
          className="btn btn-sm"
          disabled={droit}
          title={
            droit
              ? `Ce ${quoi} est déjà d’équerre`
              : `Déplacer ce ${quoi} pour que ses deux côtés soient perpendiculaires`
          }
          onClick={(e) => {
            e.stopPropagation()
            onEquerre()
          }}
        >
          ⟂ {droit ? 'D’équerre' : 'Mettre d’équerre'}
        </button>
      ) : null}
      {onSupprimer ? (
        <button
          className="btn btn-sm"
          title={`Supprimer ce ${quoi} — ses deux côtés n’en font plus qu’un (Suppr)`}
          onClick={(e) => {
            e.stopPropagation()
            onSupprimer()
          }}
        >
          <IconTrash />
          Supprimer le point
        </button>
      ) : null}
    </div>,
    document.body
  )
}
