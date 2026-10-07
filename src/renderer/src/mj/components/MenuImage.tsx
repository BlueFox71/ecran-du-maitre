import { useEffect } from 'react'
import type { UiItem } from '../../../../preload/index'

/**
 * Le choix qu'ouvre un clic sur une image du Paravent : la préparer sur le
 * visuel libre, comme avant, ou la tendre tout de suite aux joueurs dans une
 * fenêtre posée par-dessus le direct — qu'on déplace et retaille ensuite sur
 * la scène. Le portrait d'un PNJ propose en plus de remplacer le direct.
 *
 * Même allure que le menu des pions, et pour la même raison il se dessine au
 * niveau du module, au curseur.
 */
export interface CibleImage {
  item: UiItem
  /** Le nom à afficher : celui du PNJ pour un portrait, sinon celui de l'image. */
  titre: string
  x: number
  y: number
  /** Un portrait de PNJ : il peut aussi partir droit sur le direct. */
  pnj?: boolean
}

export function MenuImage({
  cible,
  onFerme,
  onPreparer,
  onFenetre,
  onDirect,
  libre,
  direct
}: {
  cible: CibleImage | null
  onFerme: () => void
  onPreparer: (it: UiItem) => void | Promise<void>
  /** Remplace tout de suite ce que montre le direct ; proposé pour un PNJ. */
  onDirect: (it: UiItem) => void | Promise<void>
  /** Les numéros des deux visuels : ils s'échangent à chaque bascule. */
  libre: number
  direct: number
  /** Ouvre la fenêtre sur le direct ; au module d'en faire le visuel qu'on regarde. */
  onFenetre: (it: UiItem) => void | Promise<void>
}): JSX.Element | null {
  /* Un premier clic ailleurs, ou Échap, et le menu s'en va. L'écoute ne
     commence qu'au tour suivant : le clic gauche qui ouvre le menu remonte
     encore jusqu'à la fenêtre, et le refermerait aussitôt. */
  useEffect(() => {
    if (!cible) return
    const clic = (): void => onFerme()
    const touche = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onFerme()
    }
    const t = window.setTimeout(() => window.addEventListener('click', clic), 0)
    window.addEventListener('keydown', touche)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('click', clic)
      window.removeEventListener('keydown', touche)
    }
  }, [cible, onFerme])

  if (!cible) return null
  const it = cible.item

  return (
    <div
      className="menu-pion"
      style={{ left: cible.x, top: cible.y }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      role="menu"
    >
      <div className="menu-pion-titre">{cible.titre}</div>
      <button
        role="menuitem"
        title="Préparer l’image sur le visuel que les joueurs ne voient pas ; elle partira à la bascule"
        onClick={() => {
          onFerme()
          void onPreparer(it)
        }}
      >
        Sur le visuel {libre} (libre)
      </button>
      {cible.pnj ? (
        <button
          role="menuitem"
          title="Montrer l’image tout de suite aux joueurs, à la place de ce qu’ils voient"
          onClick={() => {
            onFerme()
            void onDirect(it)
          }}
        >
          Sur le visuel {direct} (en direct)
        </button>
      ) : null}
      <button
        role="menuitem"
        title="Montrer l’image tout de suite aux joueurs, dans une fenêtre par-dessus ce qu’ils voient"
        onClick={() => {
          onFerme()
          void onFenetre(it)
        }}
      >
        En fenêtre sur le direct (visuel {direct})
      </button>
    </div>
  )
}
