/**
 * « Donner à… » — faire passer un exemplaire d'une main à l'autre.
 *
 * Le geste de la table : ils fouillent la commode, ils trouvent la clé, Marie
 * la prend. Le même menu sert dans les trois endroits où un exemplaire
 * s'affiche — la fiche de l'objet, la fiche du lieu, le sac d'un personnage —
 * parce que c'est le même geste vu de trois côtés.
 *
 * Là où il se trouve déjà ne figure pas dans la liste : on ne donne pas une
 * chose à celui qui l'a.
 */
import { useStore } from '../store'
import { Pop } from './Pop'
import { IconClose } from './Icons'
import type { ObjetPlacement } from '@shared/types'

export function MenuDonner({
  x,
  y,
  p,
  onClose,
  onFait
}: {
  x: number
  y: number
  p: ObjetPlacement
  onClose: () => void
  /** Appelé après le transfert : à l'appelant de relire la réserve. */
  onFait: () => void | Promise<void>
}): JSX.Element {
  const s = useStore()
  const pnjs = s.characters.filter((c) => c.kind === 'pnj' && c.id !== p.characterId)
  const pjs = s.characters.filter((c) => c.kind !== 'pnj' && c.present && c.id !== p.characterId)
  const lieux = s.places.filter((l) => l.id !== p.placeId)

  const donner = async (
    cible: Parameters<typeof window.jdr.objets.donner>[1]
  ): Promise<void> => {
    onClose()
    /* Un transfert qui échoue sans rien dire est le pire des ratés : le MJ
       croit l'objet passé de main en main, et il n'a pas bougé. */
    try {
      await window.jdr.objets.donner(p.id, cible)
    } catch (e) {
      s.toast('L’objet n’a pas changé de mains.', true)
      console.error('[donner]', e)
      return
    }
    await onFait()
  }

  /* Le camion, la malle : un inventaire partagé est un endroit de plus où
     ranger un exemplaire. */
  const inventaires = s.inventaires.filter((i) => i.id !== p.inventaireId)
  const ranger = async (inventaireId: number): Promise<void> => {
    onClose()
    try {
      await window.jdr.objets.remettre(p.id, inventaireId)
    } catch (e) {
      s.toast('L’objet n’a pas été rangé.', true)
      console.error('[ranger]', e)
      return
    }
    await onFait()
  }

  return (
    <Pop x={x} y={y} className="menu-donner" onClose={onClose}>
      <button
        className="md-fermer"
        onClick={onClose}
        title="Fermer sans rien donner — Échap"
        aria-label="Fermer"
      >
        <IconClose />
      </button>
      <span className="eyebrow">Dans les mains de</span>
      {pjs.length === 0 ? <p className="pop-rien">Aucun personnage joueur.</p> : null}
      {pjs.map((c) => (
        <button
          key={c.id}
          className={`opt c-${c.color ?? 'neutral'}`}
          onClick={() => void donner({ port: 'pj', characterId: c.id })}
        >
          <span className="pip" />
          {c.name}
        </button>
      ))}

      {pnjs.length ? (
        <>
          <hr />
          <span className="eyebrow">Sur un PNJ</span>
          {pnjs.map((c) => (
            <button
              key={c.id}
              className={`opt c-${c.color ?? 'neutral'}`}
              onClick={() => void donner({ port: 'pnj', characterId: c.id })}
            >
              <span className="pip" />
              {c.name}
            </button>
          ))}
        </>
      ) : null}

      {lieux.length ? (
        <>
          <hr />
          {/* Le poser quelque part est la même opération, vue de l'autre bout :
              il quitte les mains de quelqu'un et reste dans la pièce. */}
          <span className="eyebrow">Le poser dans</span>
          {lieux.map((l) => (
            <button key={l.id} className="opt" onClick={() => void donner({ port: 'lieu', placeId: l.id })}>
              {l.name}
            </button>
          ))}
        </>
      ) : null}

      {inventaires.length ? (
        <>
          <hr />
          <span className="eyebrow">Le ranger dans</span>
          {inventaires.map((i) => (
            <button key={i.id} className="opt" onClick={() => void ranger(i.id)}>
              {i.nom}
            </button>
          ))}
        </>
      ) : null}
    </Pop>
  )
}
