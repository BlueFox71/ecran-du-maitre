/**
 * « Donner à… » — faire passer un exemplaire d'une main à l'autre.
 *
 * Le geste de la table : ils fouillent la commode, ils trouvent la clé, Marie
 * la prend. Le même menu sert partout où un exemplaire s'affiche — la fiche
 * de l'objet, la fiche du lieu, le sac d'un personnage — parce que c'est le
 * même geste vu de plusieurs côtés. La liste elle-même est celle de
 * « Poser… » (ChoixDestination) : on y trouve aussi la corbeille.
 */
import { useStore } from '../store'
import { ChoixDestination, type Destination } from './ChoixDestination'
import type { ObjetPlacement } from '@shared/types'
import { refusSac } from '@shared/sac'

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

  const aller = async (d: Destination, qte?: number): Promise<void> => {
    /* Un transfert qui échoue sans rien dire est le pire des ratés : le MJ
       croit l'objet passé de main en main, et il n'a pas bougé. */
    try {
      if (d.port === 'inventaire') await window.jdr.objets.remettre(p.id, d.inventaireId, qte)
      else
        await window.jdr.objets.donner(
          p.id,
          d.port === 'lieu'
            ? { port: 'lieu', placeId: d.placeId }
            : d.port === 'corbeille'
              ? { port: 'corbeille' }
              : { port: d.port, characterId: d.characterId },
          qte
        )
    } catch (e) {
      s.toast(refusSac(e) ?? 'L’objet n’a pas bougé.', true)
      console.error('[donner]', e)
      return
    }
    await onFait()
  }

  return (
    <ChoixDestination
      x={x}
      y={y}
      verbe="donner"
      max={p.qte}
      exclure={{ characterId: p.characterId, placeId: p.placeId, inventaireId: p.inventaireId }}
      inventaires
      onChoisir={aller}
      onClose={onClose}
    />
  )
}
