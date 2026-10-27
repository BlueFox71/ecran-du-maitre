import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Pop } from '../components/Pop'
import { IconClose } from '../components/Icons'
import type { JoueurSm } from './Joueurs'

/**
 * « Qui le subit ? » — posé sous l'entrée du barème qu'on vient de cliquer.
 *
 * Un choc, un prix, un remède tombe rarement sur toute la table : celui qui a
 * vu les yeux verts, celui qui tient la spirit box. On choisit ici, au bout du
 * geste, plutôt que de penser à cocher avant. `exclus` : ceux qui ne peuvent
 * pas (un remède « une fois par scène » déjà pris), montrés grisés.
 *
 * Posé dans le corps du document : `.pu-detail` est un conteneur de taille, et
 * un panneau `fixed` resté dedans se placerait par rapport à lui, pas à la fenêtre.
 */
export function ChoixJoueurs({
  x,
  y,
  titre,
  joueurs,
  exclus = [],
  onValide,
  onClose
}: {
  x: number
  y: number
  titre: string
  joueurs: JoueurSm[]
  exclus?: number[]
  onValide: (ids: number[]) => void
  onClose: () => void
}): JSX.Element {
  const [choisis, setChoisis] = useState<Set<number>>(() => new Set())
  const possibles = joueurs.filter((j) => !exclus.includes(j.id))
  const basculer = (id: number): void =>
    setChoisis((c) => {
      const n = new Set(c)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const tous = possibles.length > 0 && possibles.every((j) => choisis.has(j.id))

  return createPortal(
    <div className="sm-choix-portail">
      <Pop x={x} y={y} className="sm-choix" onClose={onClose}>
        <button className="sm-choix-fermer" onClick={onClose} title="Fermer sans rien retirer — Échap" aria-label="Fermer">
          <IconClose />
        </button>
        <span className="eyebrow">{titre}</span>
        {joueurs.map((j) => {
          const exclu = exclus.includes(j.id)
          return (
            <label key={j.id} className={`sm-choix-opt${exclu ? ' sm-exclu' : ''}`}>
              <input type="checkbox" checked={choisis.has(j.id)} disabled={exclu} onChange={() => basculer(j.id)} />
              <span>{j.nom}</span>
              <span className="sm-choix-sm num">{exclu ? 'déjà pris' : j.sm}</span>
            </label>
          )
        })}
        <div className="sm-choix-pied">
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            disabled={possibles.length === 0}
            onClick={() => setChoisis(tous ? new Set() : new Set(possibles.map((j) => j.id)))}
          >
            {tous ? 'Personne' : 'Tout le groupe'}
          </button>
          <div className="spacer" />
          <button
            type="button"
            className="btn btn-sm btn-brass"
            disabled={choisis.size === 0}
            onClick={() => onValide([...choisis])}
          >
            Appliquer{choisis.size ? ` (${choisis.size})` : ''}
          </button>
        </div>
      </Pop>
    </div>,
    document.body
  )
}
