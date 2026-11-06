import { useSyncExternalStore } from 'react'

/**
 * Ce que la main survole dans la fiche du lieu, au Paravent : un objet posé
 * (son exemplaire) ou un article (`c12`, `s4`). La carte de la scène le met
 * en évidence — même si « Affichage » le cache —, pour qu'on voie d'un coup
 * d'œil où il est.
 *
 * Partagé à toute la fenêtre, comme les cases d'« Affichage » : la fiche et
 * la scène sont deux branches qui ne se parlent pas autrement.
 */
export type ViseCarte = { objet: number } | { article: string } | null

let courant: ViseCarte = null
const abonnes = new Set<() => void>()

export function viserCarte(v: ViseCarte): void {
  courant = v
  abonnes.forEach((f) => f())
}

const sAbonner = (f: () => void): (() => void) => {
  abonnes.add(f)
  return () => abonnes.delete(f)
}

export function useViseCarte(): ViseCarte {
  return useSyncExternalStore(sAbonner, () => courant)
}

/** Les gestes d'une ligne de la fiche qui vise ce qu'elle montre sur la carte. */
export function survolCarte(v: Exclude<ViseCarte, null>): {
  onMouseEnter: () => void
  onMouseLeave: () => void
} {
  return { onMouseEnter: () => viserCarte(v), onMouseLeave: () => viserCarte(null) }
}

/*
 * L'inverse : un clic sur un élément de la carte demande à la fiche du lieu
 * de le montrer — déplier sa rubrique, venir jusqu'à sa ligne, la faire
 * clignoter. `n` change à chaque demande, pour qu'un second clic sur le même
 * élément la rejoue.
 */
export type DemandeFiche = { cible: Exclude<ViseCarte, null>; n: number } | null

let demande: DemandeFiche = null
const abonnesFiche = new Set<() => void>()

export function montrerDansFiche(cible: Exclude<ViseCarte, null>): void {
  demande = { cible, n: (demande?.n ?? 0) + 1 }
  abonnesFiche.forEach((f) => f())
}

const sAbonnerFiche = (f: () => void): (() => void) => {
  abonnesFiche.add(f)
  return () => abonnesFiche.delete(f)
}

export function useDemandeFiche(): DemandeFiche {
  return useSyncExternalStore(sAbonnerFiche, () => demande)
}
