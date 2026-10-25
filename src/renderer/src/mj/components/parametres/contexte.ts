import { createContext } from 'react'
import { monnaiesParDefaut, type ReglageMonnaies } from '@shared/monnaies'

/** Ouvre le carnet de joueurs par-dessus les Paramètres : la ligne des joueurs
 *  n'a pas de props (`Cmd`), c'est la fenêtre qui lui tend l'ouvreur. */
export const OuvrirCarnet = createContext<() => void>(() => {})

/** Le brouillon des monnaies, tenu par la fenêtre (voir `useBrouillonMonnaies`). */
export interface Brouillon {
  argent: ReglageMonnaies
  setArgent: (r: ReglageMonnaies) => void
  /** Différent de ce qui est enregistré : pas encore appliqué. */
  sale: boolean
}
export const BrouillonMonnaies = createContext<Brouillon>({
  argent: monnaiesParDefaut(),
  setArgent: () => {},
  sale: false
})
