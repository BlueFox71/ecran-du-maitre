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

/**
 * Une surface de sol, peinte d'une matière : un polygone fermé — ou, avec
 * `rayon`, un trait d'aérosol, dont `pts` sont les passages du pinceau.
 */
export interface SolPeint {
  id: string
  assetId: string
  pts: PointCase[]
  /** Aérosol : le rayon du pinceau, en cases ; ses bords se fondent dans ce qu'il recouvre. */
  rayon?: number
  /**
   * Un coup de gomme (toujours au pinceau, avec `rayon`) : il efface les sols
   * peints avant lui, et laisse voir la matière de base. `assetId` n'y sert pas.
   */
  gomme?: boolean
}

/** Un mur épais : sa ligne médiane, sa matière, son épaisseur en cases. */
export interface MurBati {
  id: string
  assetId: string
  pts: PointCase[]
  epaisseur: number
  /** Une couleur posée sur la matière (`#rrggbb`) : sur un mur blanc, c'est elle qu'on voit. */
  teinte?: string
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
  /** Le battant de l'autre côté du mur (tourné d'un demi-tour). */
  retourne?: boolean
  /** Les gonds à l'autre bout (l'image en miroir le long du mur). */
  miroir?: boolean
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
  /**
   * La matière de base : elle couvre tout le terrain, sous tous les sols —
   * c'est elle que la gomme fait réapparaître. Absente : le fond nu.
   */
  base?: string | null
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
 * Ce qui empêche de réduire le terrain, en cases : les murs (avec leur
 * épaisseur) et les objets. Pas les sols — un sol se découpe au nouveau bord,
 * un mur ou un meuble coupé n'aurait plus de sens. `null` : rien.
 */
export function boiteDuContenu(c: Construction): { x0: number; y0: number; x1: number; y1: number } | null {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  const prendre = (pts: PointCase[], marge = 0): void => {
    for (const [x, y] of pts) {
      x0 = Math.min(x0, x - marge)
      y0 = Math.min(y0, y - marge)
      x1 = Math.max(x1, x + marge)
      y1 = Math.max(y1, y + marge)
    }
  }
  for (const m of c.murs) prendre(m.pts, m.epaisseur / 2)
  for (const o of c.objets) prendre(contourDeLObjet(o))
  return x0 === Infinity ? null : { x0, y0, x1, y1 }
}

const EPS = 1e-9

type Bords = { gauche: number; haut: number; droite: number; bas: number }

/** Un polygone découpé au rectangle [0, L] × [0, H] (Sutherland–Hodgman) ; `null` s'il n'en reste rien. */
function decouper(pts: PointCase[], L: number, H: number): PointCase[] | null {
  const bords: [(p: PointCase) => number, (a: PointCase, b: PointCase) => PointCase][] = [
    [(p) => p[0], (a, b) => [0, a[1] + ((b[1] - a[1]) * (0 - a[0])) / (b[0] - a[0])]],
    [(p) => L - p[0], (a, b) => [L, a[1] + ((b[1] - a[1]) * (L - a[0])) / (b[0] - a[0])]],
    [(p) => p[1], (a, b) => [a[0] + ((b[0] - a[0]) * (0 - a[1])) / (b[1] - a[1]), 0]],
    [(p) => H - p[1], (a, b) => [a[0] + ((b[0] - a[0]) * (H - a[1])) / (b[1] - a[1]), H]]
  ]
  let poly = pts
  for (const [dedans, couper] of bords) {
    const out: PointCase[] = []
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]
      const b = poly[(i + 1) % poly.length]
      const ia = dedans(a) >= -EPS
      const ib = dedans(b) >= -EPS
      if (ia) out.push(a)
      if (ia !== ib) out.push(couper(a, b))
    }
    poly = out
    if (poly.length < 3) return null
  }
  let aire = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    aire += a[0] * b[1] - b[0] * a[1]
  }
  return Math.abs(aire) < 1e-6 ? null : poly
}

/** Le contenu tient-il dans le terrain une fois les bords appliqués ? */
function tient(c: Construction, b: Bords): boolean {
  const L = c.largeur + b.gauche + b.droite
  const H = c.hauteur + b.haut + b.bas
  if (L < 1 - EPS || H < 1 - EPS) return false
  const k = boiteDuContenu(c)
  if (!k) return true
  return (
    k.x0 + b.gauche >= -EPS && k.x1 + b.gauche <= L + EPS && k.y0 + b.haut >= -EPS && k.y1 + b.haut <= H + EPS
  )
}

/**
 * Changer la taille du terrain par ses bords — positifs, on ajoute des cases ;
 * négatifs, on en retire.
 *
 * On ne coupe jamais ce qui est construit : un mur à moitié hors du terrain
 * deviendrait un mur tronqué dans le calque, et des pions, des lampes posés
 * là tomberaient hors de la carte. Le cadre rendu dit où l'ancienne carte se
 * place dans la nouvelle, en fractions de l'ancienne — exactement ce que
 * `recalerApresRognage` attend pour recaler ce qui est posé sur le lieu.
 */
export function agrandir(c: Construction, bords: Bords): { construction: Construction; cadre: Cadre } {
  const { gauche, haut, droite, bas } = bords
  if ([gauche, haut, droite, bas].some((v) => !Number.isFinite(v)))
    throw new Error('Une taille de terrain se compte en cases')
  if (!tient(c, bords)) throw new Error('Le terrain couperait ce qui est construit')
  const dec = (p: PointCase): PointCase => [p[0] + gauche, p[1] + haut]
  const largeur = c.largeur + gauche + droite
  const hauteur = c.hauteur + haut + bas
  return {
    construction: {
      ...c,
      largeur,
      hauteur,
      /* Les sols se découpent au nouveau bord ; celui qui sort tout entier part.
         Un aérosol perd les passages tombés dehors. */
      sols: c.sols.flatMap((s) => {
        if (s.rayon) {
          const pts = s.pts
            .map(dec)
            .filter(([x, y]) => x >= -EPS && y >= -EPS && x <= largeur + EPS && y <= hauteur + EPS)
          return pts.length ? [{ ...s, pts }] : []
        }
        const pts = decouper(s.pts.map(dec), largeur, hauteur)
        return pts ? [{ ...s, pts }] : []
      }),
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

/** Ce qui reste fixe quand le terrain change de taille : 0 le bord gauche (ou haut), 0,5 le milieu, 1 le bord droit (ou bas). */
export type Ancre = [0 | 0.5 | 1, 0 | 0.5 | 1]

/** Les bords qui donnent au terrain cette taille, le point d'ancrage restant en place. */
export function bordsPourTaille(c: Construction, largeur: number, hauteur: number, ancre: Ancre): Bords {
  const dL = largeur - c.largeur
  const dH = hauteur - c.hauteur
  const gauche = ancre[0] === 0 ? 0 : ancre[0] === 1 ? dL : Math.trunc(dL / 2)
  const haut = ancre[1] === 0 ? 0 : ancre[1] === 1 ? dH : Math.trunc(dH / 2)
  return { gauche: gauche + 0, haut: haut + 0, droite: dL - gauche + 0, bas: dH - haut + 0 }
}

/** La plus petite taille, en cases entières, qui garde tout ce qui est construit. */
export function tailleMinimale(c: Construction, ancre: Ancre): { largeur: number; hauteur: number } {
  let largeur = 1
  while (largeur < c.largeur && !tient(c, { ...bordsPourTaille(c, largeur, c.hauteur, ancre), haut: 0, bas: 0 })) largeur++
  let hauteur = 1
  while (hauteur < c.hauteur && !tient(c, { ...bordsPourTaille(c, c.largeur, hauteur, ancre), gauche: 0, droite: 0 })) hauteur++
  return { largeur, hauteur }
}

/**
 * Deux recalages l'un après l'autre : `a`, puis `b` exprimé dans la carte
 * issue de `a`. On agrandit parfois deux fois avant d'enregistrer ; le lieu,
 * lui, ne se recale qu'une fois.
 */
export function composerCadres(a: Cadre, b: Cadre): Cadre {
  return { x: a.x + b.x * a.w, y: a.y + b.y * a.h, w: a.w * b.w, h: a.h * b.h }
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
    const aerosol = fini(s?.rayon) && s.rayon > 0
    const pts = points(s?.pts, aerosol ? 1 : 3)
    if (!texte(s?.id) || !pts) continue
    /* Un coup de gomme n'a pas de matière, mais il lui faut un pinceau. */
    if (s.gomme) {
      if (aerosol) sols.push({ id: s.id, assetId: '', pts, rayon: s.rayon, gomme: true })
      continue
    }
    if (texte(s.assetId))
      sols.push(aerosol ? { id: s.id, assetId: s.assetId, pts, rayon: s.rayon } : { id: s.id, assetId: s.assetId, pts })
  }
  const murs: MurBati[] = []
  for (const m of liste(v.murs)) {
    const pts = points(m?.pts, 2)
    if (texte(m?.id) && texte(m?.assetId) && pts && fini(m.epaisseur) && m.epaisseur > 0)
      murs.push({
        id: m.id,
        assetId: m.assetId,
        pts,
        epaisseur: m.epaisseur,
        ...(typeof m.teinte === 'string' && /^#[0-9a-f]{6}$/i.test(m.teinte) ? { teinte: m.teinte } : {})
      })
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
        largeur: o.largeur,
        retourne: !!o.retourne,
        miroir: !!o.miroir
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
    ...(texte(v.base) ? { base: v.base } : {}),
    largeur: fini(v.largeur) && v.largeur >= 1 ? v.largeur : base.largeur,
    hauteur: fini(v.hauteur) && v.hauteur >= 1 ? v.hauteur : base.hauteur,
    metresParCase: fini(v.metresParCase) && v.metresParCase > 0 ? v.metresParCase : base.metresParCase,
    sols,
    murs,
    ouvertures,
    objets
  }
}
