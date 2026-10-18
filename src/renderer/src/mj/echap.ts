import { useEffect, useRef } from 'react'

/**
 * Échap ferme **la dernière chose ouverte**, et elle seule.
 *
 * Chaque fenêtre, menu ou panneau écoutait la touche de son côté : un
 * sélecteur d'image ouvert par-dessus la fiche de campagne fermait les deux
 * d'un coup — et celui qui ne l'écoutait pas laissait filer la touche jusqu'à
 * la fenêtre du dessous. Ils s'inscrivent désormais dans une pile ; un seul
 * écouteur, posé avant tous les autres, réveille le sommet et arrête la
 * touche là. Pile vide, Échap continue son chemin (éditeur de murs, trame…).
 *
 * L'écouteur est à la remontée, sur `window` : un champ qui se sert d'Échap
 * pour annuler sa frappe l'a déjà vue passer, et un éditeur qui la consomme
 * (`preventDefault`, comme la liste des « @ ») la garde pour lui.
 */
const pile: { fermer: () => void }[] = []

window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || e.defaultPrevented || pile.length === 0) return
  e.preventDefault()
  e.stopImmediatePropagation()
  pile[pile.length - 1].fermer()
})

/** Inscrit `fermer` au sommet de la pile tant que `actif` est vrai. */
export function useEchap(fermer: () => void, actif = true): void {
  const f = useRef(fermer)
  f.current = fermer
  useEffect(() => {
    if (!actif) return
    const e = { fermer: () => f.current() }
    pile.push(e)
    return () => {
      const i = pile.indexOf(e)
      if (i >= 0) pile.splice(i, 1)
    }
  }, [actif])
}
