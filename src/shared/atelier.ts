/**
 * L'atelier des lieux : un plan qu'on construit au lieu de le retracer.
 *
 * La construction est la seule source de vérité d'un lieu bâti. Elle se
 * compte en **cases**, pas en fractions : agrandir le terrain ne doit rien
 * déplacer de ce qu'on a posé, et une case reste une case quelle que soit la
 * taille de la carte. Les fractions n'apparaissent qu'à la sortie, quand on
 * en tire le calque que le reste de l'application sait déjà lire — murs,
 * ouvertures, emprises des meubles.
 *
 * Ce module ne connaît ni React ni la base : la Régie s'en sert pour
 * dessiner, le processus principal pour dériver le calque.
 */
import {
  natureObstacle,
  type NatureMur,
  type NatureOuverture,
  type PointMur
} from './types'

/** Un point en cases, l'origine en haut à gauche du terrain. */
export type PointCase = [number, number]

/** Une surface de sol : un polygone fermé, peint d'une matière. */
export interface SolPeint {
  id: string
  assetId: string
  pts: PointCase[]
}

/** Un mur épais : sa ligne médiane, sa matière, son épaisseur en cases. */
export interface MurBati {
  id: string
  assetId: string
  pts: PointCase[]
  epaisseur: number
}

export type NatureOuvertureBatie = NatureOuverture

/** Une porte ou une fenêtre, posée sur un mur bâti. */
export interface OuvertureBatie {
  id: string
  murId: string
  nature: NatureOuvertureBatie
  assetId: string
  /** Où elle se trouve le long du mur, de 0 (le début) à 1 (la fin), en cases. */
  d: number
  /** Sa largeur, en cases. */
  largeur: number
}

/** Un meuble, un tapis, un objet de décor. */
export interface ObjetPose {
  id: string
  assetId: string
  /** Le centre, en cases. */
  x: number
  y: number
  /** La taille, en cases, avant rotation. */
  l: number
  h: number
  /** En degrés, dans le sens des aiguilles d'une montre. */
  angle: number
  bloquePas: boolean
  bloqueVue: boolean
}

export interface Construction {
  v: 1
  /** La taille du terrain, en cases. */
  largeur: number
  hauteur: number
  metresParCase: number
  /** Chaque liste est dans l'ordre où l'on dessine : le dernier par-dessus. */
  sols: SolPeint[]
  murs: MurBati[]
  ouvertures: OuvertureBatie[]
  objets: ObjetPose[]
}

/** Un trait du calque tiré de la construction ; `atelierId` le retrouve d'un enregistrement à l'autre. */
export interface MurDerive {
  atelierId: string
  nature: NatureMur
  pts: PointMur[]
}

/** Une ouverture du calque tirée de la construction, en fractions comme `Ouverture`. */
export interface OuvertureDerivee {
  atelierId: string
  murAtelierId: string
  nature: NatureOuverture
  d: number
  largeur: number
}

export interface CalqueDerive {
  murs: MurDerive[]
  ouvertures: OuvertureDerivee[]
}

/** Un cadre en fractions de l'ancienne carte, au format de `recalerApresRognage`. */
export interface Cadre {
  x: number
  y: number
  w: number
  h: number
}

/** Le préfixe des emprises de meubles dans le calque : `obj:<id de l'objet>`. */
export const PREFIXE_OBJET = 'obj:'

export function constructionVide(): Construction {
  return {
    v: 1,
    largeur: 30,
    hauteur: 20,
    metresParCase: 1.5,
    sols: [],
    murs: [],
    ouvertures: [],
    objets: []
  }
}

export function nouvelId(): string {
  return crypto.randomUUID()
}

export function enFraction(c: Construction, p: PointCase): PointMur {
  return [p[0] / c.largeur, p[1] / c.hauteur]
}

/** Les quatre coins du rectangle tourné, refermé sur le premier. */
export function contourDeLObjet(o: ObjetPose): PointCase[] {
  const a = (o.angle * Math.PI) / 180
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  const coins: PointCase[] = [
    [-o.l / 2, -o.h / 2],
    [o.l / 2, -o.h / 2],
    [o.l / 2, o.h / 2],
    [-o.l / 2, o.h / 2]
  ].map(([dx, dy]) => [o.x + dx * cos - dy * sin, o.y + dx * sin + dy * cos] as PointCase)
  return [...coins, coins[0]]
}

/* ---------------- le long d'une polyligne ---------------- */

const dist = (a: PointCase | PointMur, b: PointCase | PointMur): number =>
  Math.hypot(b[0] - a[0], b[1] - a[1])

function longueur(pts: (PointCase | PointMur)[]): number {
  let l = 0
  for (let i = 0; i + 1 < pts.length; i++) l += dist(pts[i], pts[i + 1])
  return l
}

/** Le point à une distance donnée du début, et l'indice du segment où il tombe. */
function pointA(pts: PointCase[], distance: number): { p: PointCase; seg: number } {
  let reste = Math.max(0, distance)
  for (let i = 0; i + 1 < pts.length; i++) {
    const l = dist(pts[i], pts[i + 1])
    if (reste <= l || i + 2 === pts.length) {
      const t = l === 0 ? 0 : Math.min(1, reste / l)
      return {
        p: [pts[i][0] + t * (pts[i + 1][0] - pts[i][0]), pts[i][1] + t * (pts[i + 1][1] - pts[i][1])],
        seg: i
      }
    }
    reste -= l
  }
  return { p: pts[0], seg: 0 }
}

/** La distance parcourue, en fractions, jusqu'à un point posé sur le segment `seg`. */
function parcouruEnFraction(f: PointMur[], seg: number, p: PointMur): number {
  let l = 0
  for (let i = 0; i < seg; i++) l += dist(f[i], f[i + 1])
  return l + dist(f[seg], p)
}

/** L'intervalle qu'une ouverture occupe sur son mur, en distance depuis le début (cases). */
function intervalle(m: MurBati, o: OuvertureBatie): [number, number] {
  const L = longueur(m.pts)
  const demi = Math.min(o.largeur, L * 0.98) / 2
  const centre = Math.max(demi, Math.min(L - demi, o.d * L))
  return [centre - demi, centre + demi]
}

/** Le morceau de polyligne entre deux distances depuis son début. */
function troncon(pts: PointCase[], d0: number, d1: number): PointCase[] {
  const out: PointCase[] = [pointA(pts, d0).p]
  let parcouru = 0
  for (let i = 0; i + 1 < pts.length; i++) {
    parcouru += dist(pts[i], pts[i + 1])
    if (parcouru > d0 + 1e-9 && parcouru < d1 - 1e-9) out.push(pts[i + 1])
  }
  out.push(pointA(pts, d1).p)
  return out
}

/**
 * Ce qui reste plein d'un mur bâti une fois ses ouvertures percées : les
 * morceaux qu'on dessine. Une porte, ouverte ou fermée, est un trou dans la
 * maçonnerie ; c'est son battant qu'on pose dedans.
 */
export function morceauxPleins(m: MurBati, ouvertures: OuvertureBatie[]): PointCase[][] {
  const L = longueur(m.pts)
  if (L <= 0) return []
  const trous = ouvertures
    .filter((o) => o.murId === m.id)
    .map((o) => intervalle(m, o))
    .sort((a, b) => a[0] - b[0])
  const out: PointCase[][] = []
  let debut = 0
  for (const [a, b] of trous) {
    if (a > debut + 1e-9) out.push(troncon(m.pts, debut, a))
    debut = Math.max(debut, b)
  }
  if (L > debut + 1e-9) out.push(troncon(m.pts, debut, L))
  return out
}

/** Où dessiner une ouverture : son centre, l'angle de son mur (radians), sa largeur. */
export function placeOuverture(
  m: MurBati,
  o: OuvertureBatie
): { centre: PointCase; angle: number; largeur: number } {
  const [a, b] = intervalle(m, o)
  const { p, seg } = pointA(m.pts, (a + b) / 2)
  const u = m.pts[seg]
  const v = m.pts[seg + 1] ?? u
  return { centre: p, angle: Math.atan2(v[1] - u[1], v[0] - u[0]), largeur: b - a }
}

/**
 * Le calque que la construction impose au lieu.
 *
 * Une ouverture se recalcule point par point plutôt qu'à la règle de trois :
 * sur une carte qui n'est pas carrée, une case de large ne fait pas la même
 * fraction qu'une case de haut, et un mur coudé répartit autrement sa
 * longueur en fractions qu'en cases. On place ses deux bords en cases, on les
 * convertit, et on relit `d` et `largeur` sur le mur converti.
 */
export function deriverCalque(c: Construction): CalqueDerive {
  const murs: MurDerive[] = []
  const parId = new Map<string, MurBati>()
  for (const m of c.murs) {
    if (m.pts.length < 2) continue
    parId.set(m.id, m)
    murs.push({ atelierId: m.id, nature: 'mur', pts: m.pts.map((p) => enFraction(c, p)) })
  }
  for (const o of c.objets) {
    const nature = natureObstacle(o.bloquePas, o.bloqueVue)
    if (!nature) continue
    murs.push({
      atelierId: PREFIXE_OBJET + o.id,
      nature,
      pts: contourDeLObjet(o).map((p) => enFraction(c, p))
    })
  }

  const ouvertures: OuvertureDerivee[] = []
  for (const o of c.ouvertures) {
    const m = parId.get(o.murId)
    if (!m) continue
    const L = longueur(m.pts)
    if (L <= 0) continue
    const demi = Math.min(o.largeur, L * 0.98) / 2
    const centre = Math.max(demi, Math.min(L - demi, o.d * L))
    const f = m.pts.map((p) => enFraction(c, p))
    const Lf = longueur(f)
    if (Lf <= 0) continue
    const au = (d: number): number => {
      const { p, seg } = pointA(m.pts, d)
      return parcouruEnFraction(f, seg, enFraction(c, p))
    }
    const a = au(centre - demi)
    const b = au(centre + demi)
    ouvertures.push({
      atelierId: o.id,
      murAtelierId: m.id,
      nature: o.nature,
      d: (a + b) / 2 / Lf,
      largeur: b - a
    })
  }
  return { murs, ouvertures }
}

/**
 * Agrandir le terrain par ses bords.
 *
 * On n'agrandit que : rogner ferait tomber hors de la carte des pions, des
 * lampes, des sons qu'on ne voit pas d'ici. Le cadre rendu dit où l'ancienne
 * carte se place dans la nouvelle, en fractions de l'ancienne — exactement ce
 * que `recalerApresRognage` attend pour recaler ce qui est posé sur le lieu.
 */
export function agrandir(
  c: Construction,
  bords: { gauche: number; haut: number; droite: number; bas: number }
): { construction: Construction; cadre: Cadre } {
  const { gauche, haut, droite, bas } = bords
  if ([gauche, haut, droite, bas].some((v) => !Number.isFinite(v) || v < 0))
    throw new Error('On n’agrandit un terrain que vers l’extérieur')
  const dec = (p: PointCase): PointCase => [p[0] + gauche, p[1] + haut]
  const largeur = c.largeur + gauche + droite
  const hauteur = c.hauteur + haut + bas
  return {
    construction: {
      ...c,
      largeur,
      hauteur,
      sols: c.sols.map((s) => ({ ...s, pts: s.pts.map(dec) })),
      murs: c.murs.map((m) => ({ ...m, pts: m.pts.map(dec) })),
      ouvertures: c.ouvertures.map((o) => ({ ...o })),
      objets: c.objets.map((o) => ({ ...o, x: o.x + gauche, y: o.y + haut }))
    },
    cadre: {
      x: -gauche / c.largeur,
      y: -haut / c.hauteur,
      w: largeur / c.largeur,
      h: hauteur / c.hauteur
    }
  }
}

/* ---------------- relecture méfiante ---------------- */

const fini = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const texte = (v: unknown): v is string => typeof v === 'string' && v.length > 0

function points(v: unknown, min: number): PointCase[] | null {
  if (!Array.isArray(v)) return null
  const pts = v.filter((p) => Array.isArray(p) && fini(p[0]) && fini(p[1])).map((p) => [p[0], p[1]] as PointCase)
  return pts.length >= min ? pts : null
}

/**
 * Une construction telle qu'elle sort de la base. Un JSON abîmé ne doit pas
 * empêcher le lieu de s'ouvrir : on rend un terrain vide, et un élément
 * illisible est écarté sans emporter les autres.
 */
export function lireConstruction(brut: unknown): Construction {
  let v: any
  try {
    v = typeof brut === 'string' ? JSON.parse(brut) : brut
  } catch {
    return constructionVide()
  }
  if (!v || typeof v !== 'object') return constructionVide()
  const base = constructionVide()
  const liste = (x: unknown): any[] => (Array.isArray(x) ? x : [])

  const sols: SolPeint[] = []
  for (const s of liste(v.sols)) {
    const pts = points(s?.pts, 3)
    if (texte(s?.id) && texte(s?.assetId) && pts) sols.push({ id: s.id, assetId: s.assetId, pts })
  }
  const murs: MurBati[] = []
  for (const m of liste(v.murs)) {
    const pts = points(m?.pts, 2)
    if (texte(m?.id) && texte(m?.assetId) && pts && fini(m.epaisseur) && m.epaisseur > 0)
      murs.push({ id: m.id, assetId: m.assetId, pts, epaisseur: m.epaisseur })
  }
  const ouvertures: OuvertureBatie[] = []
  for (const o of liste(v.ouvertures)) {
    if (
      texte(o?.id) &&
      texte(o?.murId) &&
      (o.nature === 'porte' || o.nature === 'vitre') &&
      texte(o.assetId) &&
      fini(o.d) &&
      fini(o.largeur) &&
      o.largeur > 0
    )
      ouvertures.push({
        id: o.id,
        murId: o.murId,
        nature: o.nature,
        assetId: o.assetId,
        d: Math.min(1, Math.max(0, o.d)),
        largeur: o.largeur
      })
  }
  const objets: ObjetPose[] = []
  for (const o of liste(v.objets)) {
    if (
      texte(o?.id) &&
      texte(o?.assetId) &&
      [o.x, o.y, o.l, o.h, o.angle].every(fini) &&
      o.l > 0 &&
      o.h > 0
    )
      objets.push({
        id: o.id,
        assetId: o.assetId,
        x: o.x,
        y: o.y,
        l: o.l,
        h: o.h,
        angle: o.angle,
        bloquePas: !!o.bloquePas,
        bloqueVue: !!o.bloqueVue
      })
  }
  return {
    v: 1,
    largeur: fini(v.largeur) && v.largeur >= 1 ? v.largeur : base.largeur,
    hauteur: fini(v.hauteur) && v.hauteur >= 1 ? v.hauteur : base.hauteur,
    metresParCase: fini(v.metresParCase) && v.metresParCase > 0 ? v.metresParCase : base.metresParCase,
    sols,
    murs,
    ouvertures,
    objets
  }
}
