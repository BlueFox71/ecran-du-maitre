import { useLayoutEffect, useRef, useState } from 'react'

/**
 * Un texte coupé à quelques lignes, « bla bla bla… », et un « voir plus » pour
 * le déplier — le même partout : fiche du lieu, Paravent, Lieux, Chronologie.
 *
 * Le lien n'apparaît que si le texte déborde vraiment : un texte court reste
 * tel quel, sans bouton pour rien. On remesure quand la colonne change de
 * largeur, puisque c'est elle qui décide du nombre de lignes.
 *
 * Le clic sur « voir plus » ne remonte pas : posé dans une carte cliquable, il
 * déplie le texte sans ouvrir la carte.
 */
export function TexteCourt({
  children,
  lignes = 3,
  className,
  enLigne = false
}: {
  children: React.ReactNode
  lignes?: number
  className?: string
  /** Dans un paragraphe : des `span`, puisqu'un `div` n'y entre pas. */
  enLigne?: boolean
}): JSX.Element {
  const corps = useRef<HTMLElement>(null)
  const Boite = enLigne ? 'span' : 'div'
  const [ouvert, setOuvert] = useState(false)
  const [deborde, setDeborde] = useState(false)

  useLayoutEffect(() => {
    const el = corps.current
    if (!el || ouvert) return
    const mesurer = (): void => setDeborde(el.scrollHeight > el.clientHeight + 1)
    mesurer()
    const ro = new ResizeObserver(mesurer)
    ro.observe(el)
    return () => ro.disconnect()
  }, [children, ouvert, lignes])

  return (
    <Boite className={`texte-court${className ? ` ${className}` : ''}`}>
      <Boite
        ref={corps as React.RefObject<HTMLDivElement>}
        className={ouvert ? 'texte-court-corps' : 'texte-court-corps replie'}
        style={ouvert ? undefined : { WebkitLineClamp: lignes }}
      >
        {children}
      </Boite>
      {deborde || ouvert ? (
        <button
          type="button"
          className="texte-court-voir"
          onClick={(e) => {
            e.stopPropagation()
            setOuvert((o) => !o)
          }}
        >
          {ouvert ? 'voir moins' : 'voir plus'}
        </button>
      ) : null}
    </Boite>
  )
}
