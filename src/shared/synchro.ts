/**
 * Ce que l'enregistrement d'une construction change au calque d'un lieu.
 *
 * Les traits tirés de l'atelier portent un `atelierId` ; on les apparie par
 * lui plutôt que de tout effacer et tout recréer. C'est ce qui garde l'état
 * de partie : une porte ouverte en séance, verrouillée par le MJ, nommée
 * « Porte de la cave », reste la même ligne — seuls sa place et sa largeur
 * suivent la construction. Les traits faits main (`atelierId` nul), eux,
 * n'entrent jamais dans le plan : un rideau tracé dans l'éditeur survit à
 * tous les réenregistrements.
 */
import type { CalqueDerive, MurDerive, OuvertureDerivee } from './atelier'
import type { Mur, Ouverture } from './types'

export interface PlanSynchro {
  murs: { ajouter: MurDerive[]; modifier: { id: number; d: MurDerive }[]; retirer: number[] }
  ouvertures: {
    ajouter: OuvertureDerivee[]
    modifier: { id: number; d: OuvertureDerivee }[]
    retirer: number[]
  }
}

function apparier<D extends { atelierId: string }, L extends { id: number; atelierId?: string | null }>(
  voulus: D[],
  lignes: L[]
): { ajouter: D[]; modifier: { id: number; d: D }[]; retirer: number[] } {
  const parAtelier = new Map<string, L>()
  for (const l of lignes) if (l.atelierId) parAtelier.set(l.atelierId, l)
  const ajouter: D[] = []
  const modifier: { id: number; d: D }[] = []
  const vus = new Set<string>()
  for (const d of voulus) {
    vus.add(d.atelierId)
    const l = parAtelier.get(d.atelierId)
    if (l) modifier.push({ id: l.id, d })
    else ajouter.push(d)
  }
  const retirer = lignes.filter((l) => l.atelierId && !vus.has(l.atelierId)).map((l) => l.id)
  return { ajouter, modifier, retirer }
}

export function planDeSynchro(derive: CalqueDerive, murs: Mur[], ouvertures: Ouverture[]): PlanSynchro {
  return {
    murs: apparier(derive.murs, murs),
    ouvertures: apparier(derive.ouvertures, ouvertures)
  }
}

/* ---------------- le verrou, hors de l'atelier ---------------- */

/** Un mur de l'atelier ne se modifie que dans l'atelier : il serait réécrit au prochain enregistrement. */
export function murVerrouille(m: Mur): boolean {
  return !!m.atelierId
}

/** Ce qu'on peut changer d'une porte de l'atelier ailleurs que dans l'atelier : son état de partie, son nom. */
const ETAT_DE_PARTIE = new Set(['ouverte', 'verrouillee', 'nom'])

export function modifOuvertureAutorisee(o: Ouverture, patch: Record<string, unknown>): boolean {
  return !o.atelierId || Object.keys(patch).every((k) => ETAT_DE_PARTIE.has(k))
}
