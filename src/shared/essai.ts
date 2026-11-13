/**
 * Le pion d'essai de l'atelier : il marche dans la construction **en cours**,
 * pas dans celle qu'on a enregistrée. On lui fabrique donc un calque de
 * brouillard à partir d'elle — ses murs, ses portes, ses meubles — en gardant
 * du lieu ce qui ne vient pas de l'atelier : les lampes, le ciel, le réglage
 * du regard.
 */
import { deriverCalque, type Construction } from './atelier'
import type { CalqueBrouillard, Mur, Ouverture } from './types'
import { barrieres, bords, champDeVision } from './murs'

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

/** Les pixels d'une case pour le calcul de la lueur (un repère arbitraire : tout s'y mesure en proportion). */
const PX_LUEUR = 100

/**
 * Ce qu'une lampe éclaire dans la construction en cours, en cases : un rond
 * (ou un faisceau) de la portée de sa pénombre, arrêté par les murs et les
 * meubles qui cachent la vue, comme en séance. Les portes y sont fermées.
 */
export function lueurDeLampe(
  c: Construction,
  l: { x: number; y: number; penombre: number; ouverture: number; cap: number }
): [number, number][] {
  const k = calqueDEssai(c, { murs: [], ouvertures: [] } as unknown as CalqueBrouillard, new Set())
  const w = c.largeur * PX_LUEUR
  const h = c.hauteur * PX_LUEUR
  const murs = barrieres(k.murs, 'vue', (p) => ({ x: p[0] * w, y: p[1] * h }), k.ouvertures).concat(bords(w, h))
  const ouverture = l.ouverture >= 360 ? 360 : l.ouverture
  return champDeVision(murs, { x: l.x * w, y: l.y * h }, l.cap, ouverture, l.penombre * w).map((p) => [
    p.x / PX_LUEUR,
    p.y / PX_LUEUR
  ])
}
