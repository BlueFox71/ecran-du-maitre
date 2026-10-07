import { create } from 'zustand'
import { useStore, type ViewId } from './store'

/**
 * L'historique des pages, comme dans un navigateur : les flèches de la barre
 * du haut, Alt+← / Alt+→ et les boutons latéraux de la souris reviennent à la
 * page précédente ou repartent à la suivante.
 *
 * Il écoute le magasin plutôt que `setView` : une page change aussi par
 * `openInEditor`, par la recherche ou par un `setState` direct, et toutes ces
 * routes doivent laisser une trace. Une étape de l'Éditeur retient le document
 * ouvert, pour qu'on retombe sur le bon texte.
 */
export interface Etape {
  view: ViewId
  itemId: number | null
}

interface Historique {
  pile: Etape[]
  pos: number
}

export const useHistorique = create<Historique>(() => ({ pile: [], pos: -1 }))

/** Au-delà, les plus anciennes étapes tombent : personne ne recule de cent pages. */
const PROFONDEUR = 100

/** Vrai pendant qu'on recule ou qu'on avance : ce changement-là ne s'empile pas. */
let enDeplacement = false

const etapeDe = (s: ReturnType<typeof useStore.getState>): Etape => ({
  view: s.view,
  itemId: s.view === 'editor' ? s.editingItemId : null
})

const memeEtape = (a: Etape, b: Etape): boolean => a.view === b.view && a.itemId === b.itemId

/** Branche l'écoute ; rend de quoi la débrancher. */
export function suivreHistorique(): () => void {
  useHistorique.setState({ pile: [etapeDe(useStore.getState())], pos: 0 })
  return useStore.subscribe((s, avant) => {
    /* Une autre campagne : l'historique de la précédente n'a plus de sens. */
    if (s.project?.dir !== avant.project?.dir) {
      useHistorique.setState({ pile: [etapeDe(s)], pos: 0 })
      return
    }
    if (enDeplacement) return
    const ici = etapeDe(s)
    if (memeEtape(ici, etapeDe(avant))) return
    const { pile, pos } = useHistorique.getState()
    if (pile[pos] && memeEtape(pile[pos], ici)) return
    const suite = [...pile.slice(0, pos + 1), ici].slice(-PROFONDEUR)
    useHistorique.setState({ pile: suite, pos: suite.length - 1 })
  })
}

/** Se rend à l'étape `pos`, en sautant les textes qui n'existent plus. */
function allerA(sens: -1 | 1): void {
  const { pile, pos } = useHistorique.getState()
  const s = useStore.getState()
  let i = pos + sens
  while (i >= 0 && i < pile.length) {
    const e = pile[i]
    if (e.view !== 'editor' || (e.itemId !== null && s.allItems.some((it) => it.id === e.itemId)))
      break
    i += sens
  }
  if (i < 0 || i >= pile.length) return
  const e = pile[i]
  enDeplacement = true
  try {
    useStore.setState(
      e.view === 'editor' ? { view: 'editor', editingItemId: e.itemId } : { view: e.view }
    )
  } finally {
    enDeplacement = false
  }
  useHistorique.setState({ pos: i })
}

export const reculer = (): void => allerA(-1)
export const avancer = (): void => allerA(1)
