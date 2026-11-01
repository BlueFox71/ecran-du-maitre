import { useState } from 'react'
import { signe } from '@shared/jet'
import type { DeSurTable } from '@shared/types'
import { D20 } from './D20'

/**
 * Les dés déjà vus tomber dans cette fenêtre. Quitter la Régie et y revenir
 * remonte le composant : sans cette mémoire, chaque dé retomberait.
 */
const vus = new Set<number>()

/**
 * Les d20 lancés depuis les téléphones, au centre de la scène : sur l'écran
 * de la table, et dans la Régie, où le MJ les voit tomber au même moment.
 *
 * La couche se mesure elle-même (`container-type`) : le même dé remplit
 * l'écran de la table et tient dans la scène de la Régie.
 */
export function DesSurTable({
  des,
  onVu
}: {
  des: DeSurTable[]
  /** Chez le MJ seulement : « Vu » sur le dé lui-même. */
  onVu?: (id: number) => void
}): JSX.Element | null {
  if (des.length === 0) return null
  return (
    <div className={`des-table${des.length > 2 ? ' nombreux' : ''}`}>
      {des.map((d) => (
        <DeTombe key={d.id} d={d} onVu={onVu} />
      ))}
    </div>
  )
}

function DeTombe({ d, onVu }: { d: DeSurTable; onVu?: (id: number) => void }): JSX.Element {
  const [deja] = useState(() => vus.has(d.id))
  const [pose, setPose] = useState(deja)
  return (
    <div className={`des-table-de c-${d.couleur ?? 'neutral'}`}>
      <span className="des-table-qui">
        <b>{d.perso || d.joueur}</b> · {d.carac}
      </span>
      <D20
        valeur={d.de}
        sansChute={deja}
        onPose={() => {
          vus.add(d.id)
          setPose(true)
        }}
      />
      <span className={`des-table-calc${pose ? ' vu' : ''}`}>
        {d.de} {signe(d.bonus)} {d.code ?? ''} = <b>{d.total}</b>
      </span>
      {onVu ? (
        <button className="des-table-vu" onClick={() => onVu(d.id)}>
          Vu
        </button>
      ) : null}
    </div>
  )
}
