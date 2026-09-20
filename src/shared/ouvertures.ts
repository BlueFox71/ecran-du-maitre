/**
 * Où se trouve une ouverture sur son mur, et ce qu'elle y perce.
 *
 * Une porte ne se trace pas : elle se pose. Tout ici part donc du mur — sa
 * polyligne, sa longueur — et ne rend que des fractions de la carte, comme le
 * reste du calque. Rien n'est en pixels : un plan rescanné plus grand garde
 * ses portes.
 */
import { ouvertureLaissePasser, type Mur, type Ouverture, type PointMur } from './types'

/**
 * La largeur d'une ouverture qu'on vient de poser, en fraction de la carte.
 *
 * Elle se règle ensuite ; celle-ci n'est qu'un point de départ, et il vaut
 * mieux qu'il soit le même partout — l'aperçu doit montrer exactement ce que
 * le clic va poser.
 */
export const LARGEUR_DEFAUT = 0.05

/** La longueur d'une polyligne, en fractions de la carte. */
export function longueurDuMur(pts: PointMur[]): number {
  let l = 0
  for (let i = 0; i + 1 < pts.length; i++)
    l += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1])
  return l
}

/** Le point à une distance donnée du début, et la direction qu'y suit le mur. */
export function pointSurLeMur(
  pts: PointMur[],
  distance: number
): { p: PointMur; dir: PointMur } {
  let reste = distance
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    const l = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (reste <= l || i + 2 === pts.length) {
      const t = l === 0 ? 0 : Math.max(0, Math.min(1, reste / l))
      return {
        p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
        dir: l === 0 ? [1, 0] : [(b[0] - a[0]) / l, (b[1] - a[1]) / l]
      }
    }
    reste -= l
  }
  return { p: pts[0], dir: [1, 0] }
}

/**
 * Les deux bouts d'une ouverture sur son mur.
 *
 * Elle ne déborde jamais : une porte plus large que le mur qui la porte n'a
 * pas de sens, on la ramène à ce qu'il peut tenir.
 */
export function bordsOuverture(mur: Mur, o: Ouverture): { a: PointMur; b: PointMur } {
  const L = longueurDuMur(mur.pts)
  const demi = Math.min(o.largeur, L * 0.98) / 2
  const centre = Math.max(demi, Math.min(L - demi, o.d * L))
  return {
    a: pointSurLeMur(mur.pts, centre - demi).p,
    b: pointSurLeMur(mur.pts, centre + demi).p
  }
}

/**
 * Le mur le plus proche d'un point, et l'endroit où l'on tomberait dessus.
 *
 * C'est ce qui fait qu'une porte « s'aligne toute seule » : on clique près
 * d'un mur, elle se pose dessus, à l'endroit visé.
 */
export function accrocherAuMur(
  murs: Mur[],
  pt: PointMur,
  portee: number
): { murId: number; d: number; distance: number } | null {
  let meilleur: { murId: number; d: number; distance: number } | null = null
  for (const m of murs) {
    if (m.nature !== 'mur') continue
    const L = longueurDuMur(m.pts)
    if (L <= 0) continue
    let parcouru = 0
    for (let i = 0; i + 1 < m.pts.length; i++) {
      const a = m.pts[i]
      const b = m.pts[i + 1]
      const vx = b[0] - a[0]
      const vy = b[1] - a[1]
      const l2 = vx * vx + vy * vy
      if (l2 < 1e-12) continue
      const t = Math.max(0, Math.min(1, ((pt[0] - a[0]) * vx + (pt[1] - a[1]) * vy) / l2))
      const qx = a[0] + t * vx
      const qy = a[1] + t * vy
      const distance = Math.hypot(pt[0] - qx, pt[1] - qy)
      if (distance < portee && (!meilleur || distance < meilleur.distance))
        meilleur = { murId: m.id, d: (parcouru + t * Math.sqrt(l2)) / L, distance }
      parcouru += Math.sqrt(l2)
    }
  }
  return meilleur
}

/**
 * Ce qui reste d'un mur quand ses ouvertures l'ont percé.
 *
 * `quoi` dit ce qu'on calcule : une fenêtre laisse passer le regard mais pas
 * le pas, une porte ouverte laisse passer les deux, une porte fermée rien.
 * Les segments rendus sont en fractions, prêts à devenir des barrières.
 */
export function segmentsPerces(
  mur: Mur,
  ouvertures: Ouverture[],
  quoi: 'pas' | 'vue'
): [PointMur, PointMur][] {
  const L = longueurDuMur(mur.pts)
  if (L <= 0) return []

  /* Les trous, en distance depuis le début du mur, fusionnés s'ils se touchent. */
  const trous: [number, number][] = []
  for (const o of ouvertures) {
    if (o.murId !== mur.id) continue
    if (!ouvertureLaissePasser(o, quoi)) continue
    const demi = Math.min(o.largeur, L * 0.98) / 2
    const centre = Math.max(demi, Math.min(L - demi, o.d * L))
    trous.push([centre - demi, centre + demi])
  }
  if (!trous.length) {
    const out: [PointMur, PointMur][] = []
    for (let i = 0; i + 1 < mur.pts.length; i++) out.push([mur.pts[i], mur.pts[i + 1]])
    return out
  }
  trous.sort((a, b) => a[0] - b[0])
  const fondus: [number, number][] = []
  for (const t of trous) {
    const dernier = fondus[fondus.length - 1]
    if (dernier && t[0] <= dernier[1]) dernier[1] = Math.max(dernier[1], t[1])
    else fondus.push([t[0], t[1]])
  }

  /* Ce qui reste, c'est le complément des trous le long du mur. */
  const pleins: [number, number][] = []
  let curseur = 0
  for (const [a, b] of fondus) {
    if (a > curseur) pleins.push([curseur, a])
    curseur = Math.max(curseur, b)
  }
  if (curseur < L) pleins.push([curseur, L])

  const out: [PointMur, PointMur][] = []
  for (const [a, b] of pleins) {
    if (b - a < 1e-6) continue
    /* On redécoupe chaque plein aux sommets du mur qu'il enjambe, sinon un
       mur coudé deviendrait une corde. */
    const bouts: PointMur[] = [pointSurLeMur(mur.pts, a).p]
    let parcouru = 0
    for (let i = 0; i + 1 < mur.pts.length; i++) {
      parcouru += Math.hypot(
        mur.pts[i + 1][0] - mur.pts[i][0],
        mur.pts[i + 1][1] - mur.pts[i][1]
      )
      if (parcouru > a && parcouru < b) bouts.push(mur.pts[i + 1])
    }
    bouts.push(pointSurLeMur(mur.pts, b).p)
    for (let i = 0; i + 1 < bouts.length; i++) out.push([bouts[i], bouts[i + 1]])
  }
  return out
}
