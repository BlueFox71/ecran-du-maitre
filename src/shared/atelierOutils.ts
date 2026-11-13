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
