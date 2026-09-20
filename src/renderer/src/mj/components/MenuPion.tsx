import { useEffect } from 'react'
import type { Pion } from '@shared/types'

/**
 * Le menu d'un pion — clic droit sur un jeton, dans la Régie ou au Pupitre.
 *
 * Il tient les gestes qu'on ne fait pas à la souris : le calque, la cachette,
 * l'aplomb. Tourner, lui, se fait à la molette sur le pion : c'est un réglage
 * continu, il n'a rien à faire dans une liste.
 *
 * Pourquoi ici et non dans `Slide.tsx`, avec le calque des pions ? Parce que
 * `.pion-layer` porte `container-type: size`, qui fait de lui le bloc de
 * référence de tout ce qui se veut `position: fixed` : un menu placé au
 * curseur s'y serait posé de travers. Il se dessine donc au niveau du module,
 * et la scène ne fait que dire quel pion a été visé.
 */
export interface CiblePion {
  pion: Pion
  x: number
  y: number
}

export function MenuPion({
  cible,
  focusId,
  onFerme,
  onFait
}: {
  cible: CiblePion | null
  /** Le pion que l'écran suit déjà, s'il y en a un : on ne propose pas deux fois. */
  focusId?: number | null
  onFerme: () => void
  /** Appelé après chaque geste : au module de rafraîchir ce qu'il affiche. */
  onFait: () => void | Promise<void>
}): JSX.Element | null {
  /* Un menu ouvert se ferme au premier clic ailleurs, et à Échap. Sans cela il
     resterait posé sur la scène pendant la partie. */
  useEffect(() => {
    if (!cible) return
    const clic = (): void => onFerme()
    const touche = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onFerme()
    }
    window.addEventListener('click', clic)
    window.addEventListener('keydown', touche)
    return () => {
      window.removeEventListener('click', clic)
      window.removeEventListener('keydown', touche)
    }
  }, [cible, onFerme])

  if (!cible) return null
  const p = cible.pion

  const geste = (faire: () => Promise<unknown>) => async (): Promise<void> => {
    onFerme()
    await faire()
    await onFait()
  }

  return (
    <div
      className="menu-pion"
      style={{ left: cible.x, top: cible.y }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      role="menu"
    >
      <div className="menu-pion-titre">{p.label}</div>

      <button onClick={geste(() => window.jdr.pions.layer(p.id, 'devant'))}>
        Mettre devant
      </button>
      <button onClick={geste(() => window.jdr.pions.layer(p.id, 'derriere'))}>
        Mettre derrière
      </button>
      <hr />

      {/*
        La caméra de la table. Elle n'est pas rangée avec les gestes de cadrage
        de la Régie parce qu'elle ne se donne pas à une image : elle se donne à
        **quelqu'un**, et c'est ici qu'on désigne quelqu'un.
      */}
      {focusId === p.id ? (
        <button onClick={geste(() => window.jdr.pions.focus(null))}>
          Ne plus suivre<span className="k">◉</span>
        </button>
      ) : (
        <button onClick={geste(() => window.jdr.pions.focus(p.id))}>Suivre à l’écran</button>
      )}
      <hr />

      {/* Le seul geste de ce menu qui engage l'écran des joueurs : on dit ce
          qu'il fait, pas ce qu'il coche. */}
      {p.cache ? (
        <button onClick={geste(() => window.jdr.pions.hide(p.id, false))}>
          Montrer aux joueurs
        </button>
      ) : (
        <button onClick={geste(() => window.jdr.pions.hide(p.id, true))}>
          Cacher aux joueurs
        </button>
      )}

      {/* Un pion nommé — un PNJ sans fiche — peut en recevoir une. Un pion qui
          en a déjà une, ou qui est un joueur, n'a rien à faire ici. */}
      {p.characterId == null ? (
        <button onClick={geste(() => window.jdr.pions.promote(p.id))}>
          Lui faire une fiche…
        </button>
      ) : null}

      {p.rotation ? (
        <button onClick={geste(() => window.jdr.pions.rotate(p.id, 0))}>
          Remettre d’aplomb<span className="k">{Math.round(p.rotation)}°</span>
        </button>
      ) : null}

      <hr />
      <button className="danger" onClick={geste(() => window.jdr.pions.remove(p.id))}>
        Retirer ce pion
      </button>
    </div>
  )
}
