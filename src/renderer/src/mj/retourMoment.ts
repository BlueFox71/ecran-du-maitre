import { create } from 'zustand'

/**
 * D'où l'on vient quand on ouvre un texte depuis la Chronologie : l'Éditeur
 * propose alors « Retour au moment », et la Chronologie rouvre ce moment-là.
 * Le retour ne vaut que pour ce texte-là — ouvert autrement, l'Éditeur n'en
 * parle pas.
 */
export const useRetourMoment = create<{ beatId: number | null; docId: number | null }>(() => ({
  beatId: null,
  docId: null
}))
