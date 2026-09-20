/**
 * Les pièces d'un plan — ce que les murs referment.
 *
 * On ne dessine pas une pièce, on la ferme : dès qu'un contour de cloisons se
 * boucle, le morceau de plan qu'il entoure en est une. Ce fichier ne fait que
 * ça — des traits, il tire des formes — et ne connaît ni la base, ni l'écran.
 *
 * Le principe : on coupe les segments à leurs croisements **et aux jonctions
 * en T**, on soude les bouts voisins, puis on longe chaque face du graphe en
 * repartant toujours par l'arête suivante dans l'ordre angulaire. La face qui
 * entoure tout le dessin tourne dans l'autre sens : son aire est négative, on
 * l'écarte.
 */
import type { Mur, PointMur } from './types'

/** Ce qui compte comme voisin : 1,2 % de la carte. */
export const SOUDURE = 0.012

/** Une pièce trouvée : son contour, son aire, et de quoi la reconnaître. */
export interface Forme {
  /** Le contour fermé, en fractions de la carte. */
  pts: PointMur[]
  /** L'aire, en fraction de la carte — 0,25 pour un quart du plan. */
  aire: number
  /** Le centre, là où se pose son nom. */
  centre: PointMur
}

type Sommet = { k: number; p: PointMur; sortantes: Demi[] }
type Demi = { de: Sommet; vers: Sommet; angle: number; jumelle: Demi }

/** Un rideau laisse passer : il coupe la vue, pas le plan. */
const ferme = (m: Mur): boolean => m.nature === 'mur'

function segments(murs: Mur[]): [PointMur, PointMur][] {
  const out: [PointMur, PointMur][] = []
  for (const m of murs) {
    if (!ferme(m)) continue
    for (let i = 0; i + 1 < m.pts.length; i++) out.push([m.pts[i], m.pts[i + 1]])
  }
  return out
}

/** Le croisement de deux segments, s'il tombe franchement à l'intérieur des deux. */
function croisement(
  a: PointMur,
  b: PointMur,
  c: PointMur,
  d: PointMur
): PointMur | null {
  const rx = b[0] - a[0]
  const ry = b[1] - a[1]
  const sx = d[0] - c[0]
  const sy = d[1] - c[1]
  const den = rx * sy - ry * sx
  if (Math.abs(den) < 1e-12) return null
  const t = ((c[0] - a[0]) * sy - (c[1] - a[1]) * sx) / den
  const u = ((c[0] - a[0]) * ry - (c[1] - a[1]) * rx) / den
  if (t <= 1e-6 || t >= 1 - 1e-6 || u <= 1e-6 || u >= 1 - 1e-6) return null
  return [a[0] + t * rx, a[1] + t * ry]
}

/**
 * Le point tombe-t-il franchement au milieu du segment ?
 *
 * C'est la jonction en T, et elle est indispensable : une cloison aboutit
 * presque toujours au milieu d'un mur porteur, sans le croiser. Sans ce
 * découpage-là, les deux traits ne partagent aucun sommet et la pièce ne se
 * ferme jamais.
 */
function surSegment(pt: PointMur, seg: [PointMur, PointMur]): boolean {
  const [a, b] = seg
  const vx = b[0] - a[0]
  const vy = b[1] - a[1]
  const l2 = vx * vx + vy * vy
  if (l2 < 1e-12) return false
  const t = ((pt[0] - a[0]) * vx + (pt[1] - a[1]) * vy) / l2
  if (t <= 1e-6 || t >= 1 - 1e-6) return false
  const px = a[0] + t * vx
  const py = a[1] + t * vy
  if (Math.hypot(pt[0] - px, pt[1] - py) > SOUDURE / 3) return false
  const l = Math.sqrt(l2)
  return t * l > SOUDURE / 2 && (1 - t) * l > SOUDURE / 2
}

function graphe(murs: Mur[]): Demi[] {
  const bruts = segments(murs)
  const bouts: PointMur[] = []
  for (const s of bruts) bouts.push(s[0], s[1])

  const decoupes: [PointMur, PointMur][] = []
  for (const seg of bruts) {
    const pts: PointMur[] = []
    for (const autre of bruts) {
      if (autre === seg) continue
      const x = croisement(seg[0], seg[1], autre[0], autre[1])
      if (x) pts.push(x)
    }
    for (const e of bouts) if (surSegment(e, seg)) pts.push(e)
    if (!pts.length) {
      decoupes.push(seg)
      continue
    }
    const le = (q: PointMur): number => (q[0] - seg[0][0]) ** 2 + (q[1] - seg[0][1]) ** 2
    pts.sort((q, r) => le(q) - le(r))
    let cur = seg[0]
    for (const q of pts) {
      if (Math.hypot(q[0] - cur[0], q[1] - cur[1]) < SOUDURE / 2) continue
      decoupes.push([cur, q])
      cur = q
    }
    decoupes.push([cur, seg[1]])
  }

  /* La soudure, par proximité : deux bouts voisins sont le même sommet. */
  const sommets: Sommet[] = []
  const noeud = (p: PointMur): Sommet => {
    for (const s of sommets) if (Math.hypot(s.p[0] - p[0], s.p[1] - p[1]) < SOUDURE) return s
    const s: Sommet = { k: sommets.length, p, sortantes: [] }
    sommets.push(s)
    return s
  }

  const aretes = new Map<string, [Sommet, Sommet]>()
  for (const [a, b] of decoupes) {
    const na = noeud(a)
    const nb = noeud(b)
    if (na === nb) continue
    const id = na.k < nb.k ? `${na.k}>${nb.k}` : `${nb.k}>${na.k}`
    if (!aretes.has(id)) aretes.set(id, [na, nb])
  }

  const demi: Demi[] = []
  for (const [, [na, nb]] of aretes) {
    const h1 = { de: na, vers: nb } as Demi
    const h2 = { de: nb, vers: na } as Demi
    h1.jumelle = h2
    h2.jumelle = h1
    h1.angle = Math.atan2(nb.p[1] - na.p[1], nb.p[0] - na.p[0])
    h2.angle = Math.atan2(na.p[1] - nb.p[1], na.p[0] - nb.p[0])
    na.sortantes.push(h1)
    nb.sortantes.push(h2)
    demi.push(h1, h2)
  }
  for (const s of sommets) s.sortantes.sort((a, b) => a.angle - b.angle)
  return demi
}

/** L'aire signée d'un anneau : son signe dit dans quel sens on l'a parcouru. */
export function aireSignee(pts: PointMur[]): number {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    const q = pts[(i + 1) % pts.length]
    a += p[0] * q[1] - q[0] * p[1]
  }
  return a / 2
}

/** Le centre de gravité d'un anneau — là où son nom se pose. */
export function centreDe(pts: PointMur[]): PointMur {
  let x = 0
  let y = 0
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    const q = pts[(i + 1) % pts.length]
    const f = p[0] * q[1] - q[0] * p[1]
    a += f
    x += (p[0] + q[0]) * f
    y += (p[1] + q[1]) * f
  }
  a *= 3
  if (Math.abs(a) < 1e-12) return pts[0]
  return [x / a, y / a]
}

/** Le point tombe-t-il dans ce contour ? */
export function dansForme(pt: PointMur, pts: PointMur[]): boolean {
  let dedans = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]
    const b = pts[j]
    if (
      a[1] > pt[1] !== b[1] > pt[1] &&
      pt[0] < ((b[0] - a[0]) * (pt[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      dedans = !dedans
  }
  return dedans
}

/** Le rectangle qui enferme un contour — le cadrage d'une vignette. */
export function boiteDe(pts: PointMur[]): { x: number; y: number; w: number; h: number } {
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

/** Une pièce plus petite que ça n'en est pas une : c'est une écharde. */
const MIETTE = 0.0008

/**
 * Toutes les pièces que ces murs referment, de la plus grande à la plus
 * petite. Les rideaux sont ignorés : ils coupent la vue, pas le plan.
 */
export function formesDesMurs(murs: Mur[]): Forme[] {
  const demi = graphe(murs)
  const vues = new Set<Demi>()
  const out: Forme[] = []

  for (const depart of demi) {
    if (vues.has(depart)) continue
    const cycle: Demi[] = []
    let h = depart
    let sur = 0
    while (!vues.has(h) && sur < 6000) {
      vues.add(h)
      cycle.push(h)
      const liste = h.vers.sortantes
      const i = liste.indexOf(h.jumelle)
      h = liste[(i - 1 + liste.length) % liste.length]
      sur++
      if (h === depart) break
    }
    if (h !== depart || cycle.length < 3) continue
    const pts = cycle.map((x) => x.de.p)
    const aire = aireSignee(pts)
    if (aire <= MIETTE) continue
    out.push({ pts, aire, centre: centreDe(pts) })
  }

  return out.sort((a, b) => b.aire - a.aire)
}

/**
 * Recoller les murs entre eux.
 *
 * On trace à la main : deux cloisons qui devraient se rejoindre finissent à
 * trois pixels l'une de l'autre, et le contour ne se referme pas — donc pas de
 * pièce, sans qu'on voie pourquoi. Ce geste va chercher tout ce qui se touche
 * presque et le met franchement au même endroit.
 *
 * Deux rapprochements, et deux seulement :
 * - **bout contre bout** : les extrémités voisines se retrouvent sur leur
 *   milieu commun ;
 * - **bout contre mur** : une extrémité qui frôle un autre trait vient se
 *   poser exactement dessus — c'est la jonction en T, celle d'une cloison qui
 *   aboutit au milieu d'un mur porteur.
 *
 * Les points intérieurs d'une polyligne ne bougent jamais : on recolle les
 * bouts, on ne redresse pas le tracé.
 */
export function fusionnerLesMurs(
  murs: Mur[],
  tolerance = SOUDURE * 2
): { murs: Mur[]; recolles: number } {
  /* On travaille sur une copie : rien n'est écrit tant que l'appelant n'a pas
     décidé de le faire. */
  const sortie = murs.map((m) => ({ ...m, pts: m.pts.map((p) => [p[0], p[1]] as PointMur) }))
  const fermants = sortie.filter((m) => m.nature === 'mur')
  let recolles = 0

  /* Chaque extrémité, repérée par son mur et son rang — 0 ou le dernier. */
  const bouts: { m: (typeof sortie)[number]; i: number }[] = []
  for (const m of fermants) {
    if (m.pts.length < 2) continue
    bouts.push({ m, i: 0 }, { m, i: m.pts.length - 1 })
  }

  /* 1. Bout contre bout : on regroupe les voisins et on les pose au milieu. */
  const pris = new Set<number>()
  for (let a = 0; a < bouts.length; a++) {
    if (pris.has(a)) continue
    const groupe = [a]
    for (let b = a + 1; b < bouts.length; b++) {
      if (pris.has(b)) continue
      const pa = bouts[a].m.pts[bouts[a].i]
      const pb = bouts[b].m.pts[bouts[b].i]
      if (Math.hypot(pa[0] - pb[0], pa[1] - pb[1]) < tolerance) groupe.push(b)
    }
    if (groupe.length < 2) continue
    let x = 0
    let y = 0
    for (const k of groupe) {
      const p = bouts[k].m.pts[bouts[k].i]
      x += p[0]
      y += p[1]
    }
    const milieu: PointMur = [x / groupe.length, y / groupe.length]
    for (const k of groupe) {
      const p = bouts[k].m.pts[bouts[k].i]
      if (p[0] !== milieu[0] || p[1] !== milieu[1]) recolles++
      bouts[k].m.pts[bouts[k].i] = [...milieu] as PointMur
      pris.add(k)
    }
  }

  /* 2. Bout contre mur : la jonction en T, celle qu'on rate le plus souvent. */
  for (const bout of bouts) {
    const p = bout.m.pts[bout.i]
    let meilleur: { q: PointMur; d: number } | null = null
    for (const autre of fermants) {
      if (autre === bout.m) continue
      for (let i = 0; i + 1 < autre.pts.length; i++) {
        const a = autre.pts[i]
        const b = autre.pts[i + 1]
        const vx = b[0] - a[0]
        const vy = b[1] - a[1]
        const l2 = vx * vx + vy * vy
        if (l2 < 1e-12) continue
        const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / l2))
        const q: PointMur = [a[0] + t * vx, a[1] + t * vy]
        const d = Math.hypot(p[0] - q[0], p[1] - q[1])
        if (d > 1e-9 && d < tolerance && (!meilleur || d < meilleur.d)) meilleur = { q, d }
      }
    }
    if (!meilleur) continue
    bout.m.pts[bout.i] = meilleur.q
    recolles++
  }

  return { murs: sortie, recolles }
}

/**
 * Le contour que ces murs dessinent ensemble.
 *
 * La détection automatique ne voit que ce qui se referme vraiment. Or un plan
 * de maison est plein de seuils, de passages, de murs qui ne se touchent pas
 * tout à fait — et le MJ, lui, sait très bien quels traits bornent une pièce.
 * Alors il les désigne, et on enchaîne leurs polylignes bout à bout : les
 * trous sont enjambés, la boucle se referme.
 *
 * On ne vérifie donc pas que le contour est étanche — c'est lui qui l'affirme.
 * On refuse seulement ce qui n'enferme rien, et les sauts d'un bout du plan à
 * l'autre, qui trahissent une sélection faite au hasard.
 */
export function contourDesMurs(murs: Mur[], sautMax = 0.4): PointMur[] | null {
  const reste = murs.filter((m) => m.pts.length >= 2).map((m) => m.pts.map((p) => [...p] as PointMur))
  if (reste.length === 0) return null
  if (reste.length === 1) {
    const seul = reste[0]
    return aireSignee(seul) !== 0 && seul.length >= 3 ? seul : null
  }

  const contour: PointMur[] = [...reste.shift()!]
  while (reste.length) {
    const fin = contour[contour.length - 1]
    let meilleur: { i: number; retourne: boolean; d: number } | null = null
    for (let i = 0; i < reste.length; i++) {
      const debut = reste[i][0]
      const bout = reste[i][reste[i].length - 1]
      const dDebut = Math.hypot(debut[0] - fin[0], debut[1] - fin[1])
      const dBout = Math.hypot(bout[0] - fin[0], bout[1] - fin[1])
      if (!meilleur || dDebut < meilleur.d) meilleur = { i, retourne: false, d: dDebut }
      if (dBout < meilleur.d) meilleur = { i, retourne: true, d: dBout }
    }
    if (!meilleur || meilleur.d > sautMax) break
    const suite = meilleur.retourne ? [...reste[meilleur.i]].reverse() : reste[meilleur.i]
    reste.splice(meilleur.i, 1)
    /* Deux bouts au même endroit ne font qu'un sommet. */
    const debut = suite[0]
    const colle = Math.hypot(debut[0] - fin[0], debut[1] - fin[1]) < SOUDURE
    contour.push(...(colle ? suite.slice(1) : suite))
  }

  if (contour.length < 3) return null
  /* La boucle se ferme d'elle-même : le dernier point rejoint le premier, et
     le trou qui les sépare est le seuil par lequel on entre. */
  const premier = contour[0]
  const dernier = contour[contour.length - 1]
  if (Math.hypot(premier[0] - dernier[0], premier[1] - dernier[1]) < SOUDURE) contour.pop()
  if (contour.length < 3) return null
  return Math.abs(aireSignee(contour)) > MIETTE ? contour : null
}
