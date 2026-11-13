/**
 * Le pion d'essai de l'atelier : il marche dans la construction **en cours**,
 * pas dans celle qu'on a enregistrée. On lui fabrique donc un calque de
 * brouillard à partir d'elle — ses murs, ses portes, ses meubles — en gardant
 * du lieu ce qui ne vient pas de l'atelier : les lampes, le ciel, le réglage
 * du regard.
 */
import { deriverCalque, type Construction } from './atelier'
import type { CalqueBrouillard, Mur, Ouverture } from './types'

/** `ouvertes` : les ids d'atelier des portes qu'on a ouvertes pendant l'essai. */
export function calqueDEssai(
  c: Construction,
  lieu: CalqueBrouillard,
  ouvertes: Set<string>
): CalqueBrouillard {
  const d = deriverCalque(c)
  const idDe = new Map<string, number>()
  const murs: Mur[] = d.murs.map((m, i) => {
    idDe.set(m.atelierId, i + 1)
    return { id: i + 1, placeId: 0, nature: m.nature, pts: m.pts, ouvert: false, atelierId: m.atelierId }
  })
  const ouvertures: Ouverture[] = d.ouvertures
    .filter((o) => idDe.has(o.murAtelierId))
    .map((o, i) => ({
      id: i + 1,
      murId: idDe.get(o.murAtelierId)!,
      nature: o.nature,
      d: o.d,
      largeur: o.largeur,
      ouverte: o.nature === 'porte' && ouvertes.has(o.atelierId),
      verrouillee: false,
      nom: null,
      atelierId: o.atelierId
    }))
  return { ...lieu, murs, ouvertures }
}
