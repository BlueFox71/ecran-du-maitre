/**
 * Ce que les outils de l'atelier demandent à la géométrie : un rectangle
 * tiré à la souris, le sol sous le curseur, la pièce qu'on veut paver.
 */
import type { Construction, PointCase, SolPeint } from './atelier'
import { dansForme, formesDesMurs } from './pieces'
import type { Mur, PointMur } from './types'

/** Les quatre coins d'un rectangle tiré entre deux points ; `null` s'il est plat. */
export function rectangle(a: PointCase, b: PointCase): PointCase[] | null {
  const x0 = Math.min(a[0], b[0])
  const x1 = Math.max(a[0], b[0])
  const y0 = Math.min(a[1], b[1])
  const y1 = Math.max(a[1], b[1])
  if (x1 - x0 < 1e-6 || y1 - y0 < 1e-6) return null
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1]
  ]
}

/** Le sol du dessus sous un point (le dernier peint gagne). */
export function solSous(c: Construction, p: PointCase): SolPeint | null {
  for (let i = c.sols.length - 1; i >= 0; i--) if (dansForme(p, c.sols[i].pts)) return c.sols[i]
  return null
}

/**
 * La pièce que les murs bâtis referment autour d'un point, en cases.
 *
 * On réutilise la détection des pièces du plan : elle travaille sur un carré
 * unité, on y ramène donc les murs (en gardant les proportions) et on en
 * revient. Les meubles n'y entrent pas : ce ne sont pas des murs.
 */
export function pieceSous(c: Construction, p: PointCase): PointCase[] | null {
  const k = Math.max(c.largeur, c.hauteur)
  const murs: Mur[] = c.murs.map((m, i) => ({
    id: i,
    placeId: 0,
    nature: 'mur',
    pts: m.pts.map(([x, y]) => [x / k, y / k] as PointMur),
    ouvert: false
  }))
  const cible: PointMur = [p[0] / k, p[1] / k]
  let meilleure: PointCase[] | null = null
  let aire = Infinity
  for (const f of formesDesMurs(murs))
    if (f.aire < aire && dansForme(cible, f.pts)) {
      aire = f.aire
      meilleure = f.pts.map(([x, y]) => [x * k, y * k] as PointCase)
    }
  return meilleure
}

/**
 * Le mur bâti le plus proche d'un point, s'il est à moins de `tol` cases.
 * `sommet` : l'indice du sommet saisi, si l'on est tout près d'un coin.
 * `avecD` : où l'on tombe le long du mur, de 0 à 1 — là où se pose une porte.
 */
export function murSous(
  c: Construction,
  p: PointCase,
  tol: number,
  avecD = false
): { murId: string; sommet: number | null; d?: number } | null {
  let meilleur: { murId: string; sommet: number | null; d: number; dist: number } | null = null
  for (const m of c.murs) {
    let L = 0
    for (let i = 0; i + 1 < m.pts.length; i++) L += Math.hypot(m.pts[i + 1][0] - m.pts[i][0], m.pts[i + 1][1] - m.pts[i][1])
    if (L <= 0) continue
    let parcouru = 0
    for (let i = 0; i + 1 < m.pts.length; i++) {
      const a = m.pts[i]
      const b = m.pts[i + 1]
      const vx = b[0] - a[0]
      const vy = b[1] - a[1]
      const l2 = vx * vx + vy * vy
      const l = Math.sqrt(l2)
      const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / l2)) : 0
      const dist = Math.hypot(p[0] - (a[0] + t * vx), p[1] - (a[1] + t * vy))
      if (dist < tol && (!meilleur || dist < meilleur.dist))
        meilleur = { murId: m.id, sommet: null, d: (parcouru + t * l) / L, dist }
      parcouru += l
    }
    if (meilleur?.murId === m.id) {
      let proche = -1
      let dmin = tol
      m.pts.forEach((q, i) => {
        const d = Math.hypot(p[0] - q[0], p[1] - q[1])
        if (d < dmin) {
          dmin = d
          proche = i
        }
      })
      if (proche >= 0) meilleur.sommet = proche
    }
  }
  /* TypeScript ne suit pas l'affectation faite dans les boucles : on le lui redit. */
  const r = meilleur as { murId: string; sommet: number | null; d: number } | null
  if (!r) return null
  return avecD ? { murId: r.murId, sommet: r.sommet, d: r.d } : { murId: r.murId, sommet: r.sommet }
}
