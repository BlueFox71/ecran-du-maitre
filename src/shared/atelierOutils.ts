/**
 * Ce que les outils de l'atelier demandent à la géométrie : un rectangle
 * tiré à la souris, le sol sous le curseur, la pièce qu'on veut paver.
 */
import {
  contourDeLObjet,
  placeOuverture,
  type Construction,
  type ObjetPose,
  type OuvertureBatie,
  type PointCase,
  type SolPeint
} from './atelier'
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
  for (let i = c.sols.length - 1; i >= 0; i--) {
    const s = c.sols[i]
    const r = s.rayon
    if (r ? s.pts.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) <= r) : dansForme(p, s.pts)) return s
  }
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

/** L'ouverture sous un point : dans son rectangle (sa largeur le long du mur, l'épaisseur du mur en travers). */
export function ouvertureSous(c: Construction, p: PointCase): OuvertureBatie | null {
  for (let i = c.ouvertures.length - 1; i >= 0; i--) {
    const o = c.ouvertures[i]
    const m = c.murs.find((x) => x.id === o.murId)
    if (!m) continue
    const { centre, angle, largeur } = placeOuverture(m, o)
    const dx = p[0] - centre[0]
    const dy = p[1] - centre[1]
    const le = dx * Math.cos(angle) + dy * Math.sin(angle)
    const tr = -dx * Math.sin(angle) + dy * Math.cos(angle)
    if (Math.abs(le) <= largeur / 2 && Math.abs(tr) <= Math.max(m.epaisseur, 0.3)) return o
  }
  return null
}

/** Un point dans le repère d'un objet : origine au centre, axes tournés avec lui. */
function local(o: ObjetPose, p: PointCase): PointCase {
  const a = (o.angle * Math.PI) / 180
  const dx = p[0] - o.x
  const dy = p[1] - o.y
  return [dx * Math.cos(a) + dy * Math.sin(a), -dx * Math.sin(a) + dy * Math.cos(a)]
}

/** L'objet du dessus sous un point (le dernier posé gagne). */
export function objetSous(c: Construction, p: PointCase): ObjetPose | null {
  for (let i = c.objets.length - 1; i >= 0; i--) {
    const o = c.objets[i]
    const [lx, ly] = local(o, p)
    if (Math.abs(lx) <= o.l / 2 && Math.abs(ly) <= o.h / 2) return o
  }
  return null
}

const TAILLE_MIN = 0.1

/**
 * Tirer le coin `i` d'un objet (dans l'ordre de `contourDeLObjet`) jusqu'à
 * `p` : le coin opposé ne bouge pas. `garder` : les proportions restent
 * celles de l'image — c'est le cas par défaut, un meuble ne s'étire pas.
 */
export function redimensionner(o: ObjetPose, i: number, p: PointCase, garder: boolean): ObjetPose {
  const sx = i === 1 || i === 2 ? 1 : -1
  const sy = i >= 2 ? 1 : -1
  const a = (o.angle * Math.PI) / 180
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  /* Le coin opposé, fixe. */
  const qx = o.x + (-sx * o.l * cos) / 2 - (-sy * o.h * sin) / 2
  const qy = o.y + (-sx * o.l * sin) / 2 + (-sy * o.h * cos) / 2
  const dx = p[0] - qx
  const dy = p[1] - qy
  let l = Math.max(TAILLE_MIN, (dx * cos + dy * sin) * sx)
  let h = Math.max(TAILLE_MIN, (-dx * sin + dy * cos) * sy)
  if (garder) {
    const k = Math.max(l / o.l, h / o.h)
    l = Math.max(TAILLE_MIN, o.l * k)
    h = Math.max(TAILLE_MIN, o.h * k)
  }
  return {
    ...o,
    l,
    h,
    x: qx + (sx * l * cos) / 2 - (sy * h * sin) / 2,
    y: qy + (sx * l * sin) / 2 + (sy * h * cos) / 2
  }
}

/** Tourner un objet vers un point : sa poignée de rotation est au-dessus de lui. `pas` : par 15°. */
export function tourner(o: ObjetPose, p: PointCase, pas: boolean): ObjetPose {
  let angle = (Math.atan2(p[0] - o.x, -(p[1] - o.y)) * 180) / Math.PI
  if (pas) angle = Math.round(angle / 15) * 15
  return { ...o, angle: ((angle % 360) + 360) % 360 }
}

/** Ce que l'outil Remplir peint sous un point : la pièce fermée qui l'entoure, sinon toute la grille. */
export function zoneARemplir(c: Construction, p: PointCase): PointCase[] {
  return pieceSous(c, p) ?? (rectangle([0, 0], [c.largeur, c.hauteur]) as PointCase[])
}

/** Le centre de la case où tombe un point : là où Ctrl cale un objet. */
export function centreDeCase(p: PointCase): PointCase {
  return [Math.floor(p[0]) + 0.5, Math.floor(p[1]) + 0.5]
}

/** Passer des objets devant (ou derrière) les autres, en gardant leur ordre entre eux. */
export function mettreAuPlan<T extends { id: string }>(liste: T[], ids: string[], devant: boolean): T[] {
  const choisis = liste.filter((o) => ids.includes(o.id))
  const reste = liste.filter((o) => !ids.includes(o.id))
  return devant ? [...reste, ...choisis] : [...choisis, ...reste]
}

/**
 * Faire pivoter un groupe d'objets autour d'un point : chacun tourne autour
 * de lui comme sur un plateau, et sur lui-même du même angle.
 */
export function tournerGroupe(objets: ObjetPose[], centre: PointCase, delta: number): ObjetPose[] {
  const a = (delta * Math.PI) / 180
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  return objets.map((o) => {
    const dx = o.x - centre[0]
    const dy = o.y - centre[1]
    return {
      ...o,
      x: centre[0] + dx * cos - dy * sin,
      y: centre[1] + dx * sin + dy * cos,
      angle: (((o.angle + delta) % 360) + 360) % 360
    }
  })
}

/** La taille d'un objet tiré au hasard : entre 80 et 120 % de sa taille réelle. */
export const ECHELLE_HASARD = { min: 0.8, max: 1.2 }

/**
 * Le mode aléatoire : une des vignettes choisies, un angle et une taille au
 * hasard — de quoi semer un bois sans que deux arbres se ressemblent.
 */
export function tirerObjet(
  ids: string[],
  hasard: () => number
): { id: string; angle: number; echelle: number } | null {
  if (!ids.length) return null
  const id = ids[Math.min(ids.length - 1, Math.floor(hasard() * ids.length))]
  const angle = hasard() * 360
  const echelle = ECHELLE_HASARD.min + hasard() * (ECHELLE_HASARD.max - ECHELLE_HASARD.min)
  return { id, angle, echelle }
}

/** Les objets que touche un rectangle tiré entre deux points (leur boîte le chevauche). */
export function objetsDansRectangle(objets: ObjetPose[], a: PointCase, b: PointCase): string[] {
  const x0 = Math.min(a[0], b[0])
  const x1 = Math.max(a[0], b[0])
  const y0 = Math.min(a[1], b[1])
  const y1 = Math.max(a[1], b[1])
  return objets
    .filter((o) => {
      const pts = contourDeLObjet(o)
      const xs = pts.map((p) => p[0])
      const ys = pts.map((p) => p[1])
      return Math.max(...xs) >= x0 && Math.min(...xs) <= x1 && Math.max(...ys) >= y0 && Math.min(...ys) <= y1
    })
    .map((o) => o.id)
}
