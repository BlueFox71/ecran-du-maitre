import { useCallback, useEffect, useState } from 'react'
import type { MobilePing } from '@shared/types'

/**
 * Les ondes — ce qu'un joueur montre du doigt depuis son téléphone.
 *
 * Trois anneaux qui s'ouvrent depuis le point et s'effacent, à la couleur de
 * celui qui montre : la même qui cercle son pion, si bien qu'on sait qui parle
 * sans qu'il ait à le dire. Rien n'est gardé — un geste de table vaut le temps
 * qu'il dure, et deux secondes après, l'écran est comme avant.
 *
 * Le calque se pose sur un conteneur en position relative et ne prend aucun
 * clic : il montre, il n'attrape pas.
 */
export const PING_MS = 2000

export function Pings({ pings }: { pings: MobilePing[] }): JSX.Element | null {
  if (pings.length === 0) return null
  return (
    <div className="onde-layer" aria-hidden="true">
      {pings.map((p) => (
        <span
          key={p.id}
          className={`onde c-${p.color ?? 'neutral'}`}
          style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
        >
          <i />
          <i />
          <i />
        </span>
      ))}
    </div>
  )
}

/**
 * Garde les ondes le temps qu'elles durent, puis les oublie.
 *
 * Le branchement est laissé à l'appelant : l'écran des joueurs les reçoit par
 * IPC, un téléphone par son flux. Ce qui se répète, c'est de les empiler et de
 * les retirer à l'heure — c'est donc cela qu'on met en commun.
 */
export function usePings(): { pings: MobilePing[]; ajouter: (p: MobilePing) => void } {
  const [pings, setPings] = useState<MobilePing[]>([])

  useEffect(() => {
    if (pings.length === 0) return
    const t = setTimeout(() => setPings((l) => l.slice(1)), PING_MS)
    return () => clearTimeout(t)
  }, [pings])

  /* La fonction ne change jamais : les appelants s'abonnent une fois pour
     toutes, au lieu de se rebrancher à chaque rendu — et de perdre les ondes
     qui tomberaient entre deux. */
  const ajouter = useCallback((p: MobilePing) => setPings((l) => [...l, p]), [])

  return { pings, ajouter }
}
