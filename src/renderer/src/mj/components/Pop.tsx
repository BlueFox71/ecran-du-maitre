/**
 * Un panneau posé au curseur, qui se recale pour tenir dans la fenêtre.
 *
 * On ne peut pas deviner sa taille avant de l'avoir posé — elle dépend de son
 * contenu — alors on le mesure une fois en place, avant que le navigateur ne
 * peigne, et on le ramène dans le cadre. Ouvert près du bord droit ou du bas,
 * il débordait et on en perdait la moitié.
 *
 * Le voile derrière lui ferme au premier clic ailleurs ; Échap aussi. Les
 * styles restent au module qui l'ouvre : la Réserve et l'Équipement n'habillent
 * pas leurs panneaux pareil.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export function Pop({
  x,
  y,
  className,
  onClose,
  children
}: {
  x: number
  y: number
  className?: string
  onClose: () => void
  children: React.ReactNode
}): JSX.Element {
  const boite = useRef<HTMLDivElement>(null)
  const [pose, setPose] = useState<React.CSSProperties>({ left: x, top: y, visibility: 'hidden' })

  useLayoutEffect(() => {
    const el = boite.current
    if (!el) return
    const b = el.getBoundingClientRect()
    const marge = 10
    setPose({
      left: Math.max(marge, Math.min(x, window.innerWidth - b.width - marge)),
      top: Math.max(marge, Math.min(y, window.innerHeight - b.height - marge)),
      visibility: 'visible'
    })
  }, [x, y])

  useEffect(() => {
    const touche = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', touche)
    return () => window.removeEventListener('keydown', touche)
  }, [onClose])

  return (
    <>
      <div className="pop-fond" onClick={onClose} />
      <div
        ref={boite}
        className={`pop${className ? ' ' + className : ''}`}
        style={pose}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </>
  )
}
