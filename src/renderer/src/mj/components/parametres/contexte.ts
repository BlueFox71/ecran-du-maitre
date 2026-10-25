import { createContext } from 'react'

/** Ouvre le carnet de joueurs par-dessus les Paramètres : la ligne des joueurs
 *  n'a pas de props (`Cmd`), c'est la fenêtre qui lui tend l'ouvreur. */
export const OuvrirCarnet = createContext<() => void>(() => {})
