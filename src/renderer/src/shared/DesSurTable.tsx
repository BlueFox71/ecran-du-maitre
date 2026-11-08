import { useState } from 'react'
import { signe } from '@shared/jet'
import type { AnnonceSm, DeSurTable } from '@shared/types'
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
  onVu,
  annonces = [],
  onVuAnnonce
}: {
  des: DeSurTable[]
  /** Chez le MJ seulement : « Vu » sur le dé lui-même. */
  onVu?: (id: number) => void
  /** Les gains et pertes de santé mentale, posés à côté des dés. */
  annonces?: AnnonceSm[]
  /** Chez le MJ seulement : « Vu » sur l'annonce. */
  onVuAnnonce?: (id: number) => void
}): JSX.Element | null {
  if (des.length === 0 && annonces.length === 0) return null
  return (
    <div className={`des-table${des.length + annonces.length > 2 ? ' nombreux' : ''}`}>
      {des.map((d) => (
        <DeTombe key={d.id} d={d} onVu={onVu} />
      ))}
      {annonces.map((a) => (
        <CarteSm key={a.id} a={a} onVu={onVuAnnonce} />
      ))}
    </div>
  )
}

/**
 * Ce qu'un joueur gagne ou perd en santé mentale, lu de loin : son nom, le
 * nombre en grand — rouge une perte, vert un gain —, et ce qui l'a causé.
 */
function CarteSm({ a, onVu }: { a: AnnonceSm; onVu?: (id: number) => void }): JSX.Element {
  const perte = a.delta < 0
  return (
    <div className={`des-table-de sm-annonce c-${a.couleur ?? 'neutral'}`}>
      <span className="des-table-qui">
        <b>{a.perso}</b> · santé mentale
      </span>
      <span className={`sm-annonce-nb ${perte ? 'perte' : 'gain'}`}>
        {perte ? `−${-a.delta}` : `+${a.delta}`}
      </span>
      <span className="des-table-calc vu">{a.raison}</span>
      {onVu ? (
        <button className="des-table-vu" onClick={() => onVu(a.id)}>
          Vu
        </button>
      ) : null}
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
