/**
 * La géométrie des murs invisibles : ce qui arrête un pas, et ce qu'un œil
 * voit depuis l'endroit où il se trouve.
 *
 * Tout se calcule **en pixels de l'image affichée**, jamais en fractions. La
 * raison est bête et suffisante : une carte n'est presque jamais carrée, et en
 * fractions un angle droit n'est plus droit — le cône du regard s'ouvrirait de
 * travers et un pion glisserait le long d'un mur en biais. Les fractions sont
 * ce qu'on enregistre ; les pixels, ce avec quoi on calcule.
 *
 * Ce module ne connaît ni React ni la base : il prend des segments, il rend
 * des points. La Régie s'en sert telle quelle — et le serveur du portable
 * aussi, qui retient les pas venus d'un téléphone. C'est pour lui qu'il vit
 * dans `src/shared` plutôt que chez le renderer : les deux procédés partagent
 * la même géométrie, sinon un joueur traverserait un mur selon l'écran d'où
 * il pousse son pion.
 */
import {
  MUR_NATURES,
  murArretePas,
  murArreteVue,
  type Mur,
  type Ouverture,
  type PointMur
} from '@shared/types'
import { bordsOuverture, segmentsPerces } from '@shared/ouvertures'

export interface Pt {
  x: number
  y: number
}

/** Un bout de mur : deux points, et rien d'autre à savoir. */
export interface Barriere {
  a: Pt
  b: Pt
}

/** Les segments d'une polyligne. Un point seul ne barre rien. */
export function segmentsDuMur(m: Mur, enPx: (p: PointMur) => Pt): Barriere[] {
  const out: Barriere[] = []
  for (let i = 0; i < m.pts.length - 1; i++) out.push({ a: enPx(m.pts[i]), b: enPx(m.pts[i + 1]) })
  return out
}

/**
 * Tous les segments qui arrêtent ce qu'on demande.
 *
 * `pas` et `vue` tiennent compte des ouvertures : un mur percé d'une porte
 * ouverte laisse passer **là où elle est**, et nulle part ailleurs. `pieces`
 * les ignore : une porte, ouverte ou non, reste le seuil entre deux pièces —
 * c'est ce qui permet de dire « la pièce d'à côté » plutôt que « tout ce
 * qu'on peut atteindre ».
 */
export function barrieres(
  murs: Mur[],
  quoi: 'pas' | 'vue' | 'pieces',
  enPx: (p: PointMur) => Pt,
  ouvertures: Ouverture[] = []
): Barriere[] {
  const garde = quoi === 'pas' ? murArretePas : murArreteVue
  const out: Barriere[] = []
  for (const m of murs) {
    if (quoi === 'pieces') {
      /* Un seuil reste un seuil : pour découper en pièces, on ne perce rien. */
      if (MUR_NATURES[m.nature].pas) out.push(...segmentsDuMur(m, enPx))
      continue
    }
    if (!garde(m)) continue
    for (const [a, b] of segmentsPerces(m, ouvertures, quoi))
      out.push({ a: enPx(a), b: enPx(b) })
  }
  return out
}

/** Les quatre bords de l'image : on n'en sort pas, et la vue s'y arrête. */
export function bords(w: number, h: number): Barriere[] {
  return [
    { a: { x: 0, y: 0 }, b: { x: w, y: 0 } },
    { a: { x: w, y: 0 }, b: { x: w, y: h } },
    { a: { x: w, y: h }, b: { x: 0, y: h } },
    { a: { x: 0, y: h }, b: { x: 0, y: 0 } }
  ]
}

/** Deux segments se croisent-ils ? */
export function seCroisent(p1: Pt, p2: Pt, p3: Pt, p4: Pt): boolean {
  const rx = p2.x - p1.x
  const ry = p2.y - p1.y
  const sx = p4.x - p3.x
  const sy = p4.y - p3.y
  const d = rx * sy - ry * sx
  if (Math.abs(d) < 1e-9) return false
  const t = ((p3.x - p1.x) * sy - (p3.y - p1.y) * sx) / d
  const u = ((p3.x - p1.x) * ry - (p3.y - p1.y) * rx) / d
  return t >= 0 && t <= 1 && u >= 0 && u <= 1
}

/** Le premier obstacle rencontré par un rayon parti de `oeil`. */
function premierObstacle(oeil: Pt, dx: number, dy: number, murs: Barriere[]): number | null {
  let best: number | null = null
  for (const { a, b } of murs) {
    const sx = b.x - a.x
    const sy = b.y - a.y
    const d = dx * sy - dy * sx
    if (Math.abs(d) < 1e-9) continue
    const t = ((a.x - oeil.x) * sy - (a.y - oeil.y) * sx) / d
    const u = ((a.x - oeil.x) * dy - (a.y - oeil.y) * dx) / d
    if (t > 1e-6 && u >= -1e-9 && u <= 1 + 1e-9 && (best === null || t < best)) best = t
  }
  return best
}

/**
 * Le pas d'un pion : il passe, il longe, ou il reste.
 *
 * Buter contre un mur et s'arrêter net est désagréable — on voulait contourner
 * le buffet, pas s'y coller. Alors quand le trajet direct est barré, on essaie
 * les deux mouvements qui le composent : celui en largeur, puis celui en
 * hauteur. C'est ce qui donne l'impression de longer la cloison.
 */
export function pasContraint(
  murs: Barriere[],
  de: Pt,
  vers: Pt,
  cadre: { w: number; h: number },
  marge = 0
): Pt {
  const dedans = (p: Pt): Pt => ({
    x: Math.min(cadre.w - marge, Math.max(marge, p.x)),
    y: Math.min(cadre.h - marge, Math.max(marge, p.y))
  })
  const passe = (a: Pt, b: Pt): boolean => !murs.some((m) => seCroisent(a, b, m.a, m.b))

  const cible = dedans(vers)
  if (passe(de, cible)) return cible
  const enLargeur = dedans({ x: cible.x, y: de.y })
  if (passe(de, enLargeur)) return enLargeur
  const enHauteur = dedans({ x: de.x, y: cible.y })
  if (passe(de, enHauteur)) return enHauteur
  return de
}

/**
 * Ce qu'un œil voit : un rayon vers chaque bout de mur, et deux de plus de
 * part et d'autre pour passer derrière les angles. Les points reviennent
 * triés, prêts à faire un polygone.
 *
 * Personne ne voit à 360° : `cap` dit où le pion regarde — 0 vers le haut,
 * comme la rotation d'un pion — et `ouverture` de combien de degrés s'ouvre
 * son regard. On ne garde donc que les rayons qui tombent dans le secteur,
 * plus ses deux bords, et le polygone part de l'œil. Une ouverture de 360
 * rend la couronne entière, pour ce qui n'a pas de dos : une lanterne.
 */
export function champDeVision(
  murs: Barriere[],
  oeil: Pt,
  cap: number,
  ouverture: number,
  /**
   * Jusqu'où cela porte, en pixels. Une vue n'a pas de bout ; une lampe, si —
   * son rond s'arrête là, sauf si un mur l'arrête avant. On ajoute alors des
   * rayons réguliers, sinon l'arc serait un polygone à trois côtés.
   */
  portee = Infinity
): Pt[] {
  const plein = ouverture >= 360
  const axe = ((cap - 90) * Math.PI) / 180
  const demi = (ouverture * Math.PI) / 360

  /** L'écart signé d'un rayon à l'axe du regard, ramené dans (-π, π]. */
  const ecart = (a: number): number => {
    let d = a - axe
    while (d <= -Math.PI) d += 2 * Math.PI
    while (d > Math.PI) d -= 2 * Math.PI
    return d
  }

  const angles: number[] = plein ? [] : [axe - demi, axe + demi]
  /* L'arc du bord : un rayon tous les quatre degrés suffit à faire un rond. */
  if (Number.isFinite(portee)) {
    const pas = (4 * Math.PI) / 180
    for (let d = -demi; d <= demi + 1e-9; d += pas) angles.push(axe + d)
    if (plein) angles.push(axe + Math.PI)
  }
  for (const { a, b } of murs) {
    for (const pt of [a, b]) {
      const ang = Math.atan2(pt.y - oeil.y, pt.x - oeil.x)
      for (const d of [-0.0004, 0, 0.0004]) {
        if (plein || Math.abs(ecart(ang + d)) <= demi) angles.push(ang + d)
      }
    }
  }

  const vus: { p: Pt; rang: number }[] = []
  for (const ang of angles) {
    const dx = Math.cos(ang)
    const dy = Math.sin(ang)
    const t = premierObstacle(oeil, dx, dy, murs)
    if (t === null) continue
    /* Le mur d'abord, la portée ensuite : la lampe s'arrête au plus proche. */
    const d = Math.min(t, portee)
    vus.push({ p: { x: oeil.x + dx * d, y: oeil.y + dy * d }, rang: plein ? ang : ecart(ang) })
  }
  vus.sort((u, v) => u.rang - v.rang)

  const bordure = vus.map((v) => v.p)
  return plein ? bordure : [{ x: oeil.x, y: oeil.y }, ...bordure]
}

/**
 * Ce qu'il reste d'un trait quand un autre se pose dessus.
 *
 * Poser une vitre sur un mur, c'est percer une fenêtre : le morceau de mur
 * recouvert doit disparaître, sinon la cloison continuerait d'arrêter la vue
 * derrière la fenêtre qu'on vient d'y mettre. Le trait entamé revient donc en
 * morceaux — zéro, un, ou deux selon l'endroit où on a percé.
 *
 * On ne retire que ce qui est **posé dessus** : à peu près parallèle (11° de
 * tolérance) et à moins de `tol` du trait. Un mur qui en croise un autre à
 * angle droit ne se coupe pas — il le traverse, et c'est ce qu'on veut.
 *
 * `null` veut dire « rien à retirer », pour que l'appelant ne réécrive pas un
 * trait qu'il n'a pas touché.
 */
export function soustraireTrace(pts: Pt[], par: Pt[], tol: number): Pt[][] | null {
  const morceaux: [Pt, Pt][] = []
  const autres: [Pt, Pt][] = []
  for (let i = 0; i < par.length - 1; i++) autres.push([par[i], par[i + 1]])

  let touche = false
  for (let i = 0; i < pts.length - 1; i++) {
    const A = pts[i]
    const B = pts[i + 1]
    const vx = B.x - A.x
    const vy = B.y - A.y
    const L = Math.hypot(vx, vy)
    if (L < 1e-6) continue
    const ux = vx / L
    const uy = vy / L

    /** L'écart d'un point à la droite du segment, et sa place le long de lui. */
    const ecart = (P: Pt): number => Math.abs((P.x - A.x) * uy - (P.y - A.y) * ux)
    const place = (P: Pt): number => ((P.x - A.x) * ux + (P.y - A.y) * uy) / L

    const couvert: [number, number][] = []
    for (const [C, D] of autres) {
      const wx = D.x - C.x
      const wy = D.y - C.y
      const M = Math.hypot(wx, wy)
      if (M < 1e-6) continue
      if (Math.abs((ux * wy - uy * wx) / M) > 0.2) continue
      if (ecart(C) > tol || ecart(D) > tol) continue
      const t0 = Math.max(0, Math.min(place(C), place(D)))
      const t1 = Math.min(1, Math.max(place(C), place(D)))
      if (t1 - t0 > 1e-6) couvert.push([t0, t1])
    }

    if (!couvert.length) {
      morceaux.push([A, B])
      continue
    }
    touche = true
    couvert.sort((a, b) => a[0] - b[0])
    const gardes: [number, number][] = []
    let t = 0
    for (const [c0, c1] of couvert) {
      if (c0 > t) gardes.push([t, c0])
      t = Math.max(t, c1)
    }
    if (t < 1) gardes.push([t, 1])
    for (const [g0, g1] of gardes) {
      /* Un moignon de deux pixels ne barre rien et encombre la liste. */
      if ((g1 - g0) * L < 2) continue
      morceaux.push([
        { x: A.x + vx * g0, y: A.y + vy * g0 },
        { x: A.x + vx * g1, y: A.y + vy * g1 }
      ])
    }
  }
  if (!touche) return null
  return enchainer(morceaux)
}

/**
 * Ce qu'il reste d'un trait quand la gomme passe dessus.
 *
 * La gomme est une suite de ronds — un par position de la souris pendant le
 * geste. Tout ce qui tombe dedans s'en va, et le trait revient en morceaux.
 * On raisonne en ronds plutôt qu'en traînée continue parce qu'un rond se
 * calcule en trois lignes, et qu'on en sème assez pour qu'ils se recouvrent.
 */
export function gommerTrace(pts: Pt[], ronds: Pt[], rayon: number): Pt[][] | null {
  const morceaux: [Pt, Pt][] = []
  let touche = false

  for (let i = 0; i < pts.length - 1; i++) {
    const A = pts[i]
    const B = pts[i + 1]
    const vx = B.x - A.x
    const vy = B.y - A.y
    const L = Math.hypot(vx, vy)
    if (L < 1e-6) continue
    const ux = vx / L
    const uy = vy / L

    const couvert: [number, number][] = []
    for (const C of ronds) {
      const wx = C.x - A.x
      const wy = C.y - A.y
      const ecart = Math.abs(wx * uy - wy * ux)
      if (ecart >= rayon) continue
      const long = wx * ux + wy * uy
      const demi = Math.sqrt(rayon * rayon - ecart * ecart)
      const t0 = Math.max(0, (long - demi) / L)
      const t1 = Math.min(1, (long + demi) / L)
      if (t1 - t0 > 1e-6) couvert.push([t0, t1])
    }

    if (!couvert.length) {
      morceaux.push([A, B])
      continue
    }
    touche = true
    couvert.sort((a, b) => a[0] - b[0])
    const gardes: [number, number][] = []
    let t = 0
    for (const [c0, c1] of couvert) {
      if (c0 > t) gardes.push([t, c0])
      t = Math.max(t, c1)
    }
    if (t < 1) gardes.push([t, 1])
    for (const [g0, g1] of gardes) {
      if ((g1 - g0) * L < 2) continue
      morceaux.push([
        { x: A.x + vx * g0, y: A.y + vy * g0 },
        { x: A.x + vx * g1, y: A.y + vy * g1 }
      ])
    }
  }
  if (!touche) return null
  return enchainer(morceaux)
}

/**
 * Couper un trait en deux à l'endroit visé.
 *
 * Le point tombe sur le trait, pas là où la souris se trouvait : on projette.
 * Couper trop près d'un bout ne donnerait qu'un moignon et un trait presque
 * entier — dans ce cas on ne coupe pas, et `null` le dit.
 */
export function couperTrace(pts: Pt[], vise: Pt, marge = 6): [Pt[], Pt[]] | null {
  let meilleur: { i: number; t: number; d: number } | null = null
  for (let i = 0; i < pts.length - 1; i++) {
    const A = pts[i]
    const B = pts[i + 1]
    const vx = B.x - A.x
    const vy = B.y - A.y
    const l2 = vx * vx + vy * vy
    if (l2 < 1e-9) continue
    const t = Math.max(0, Math.min(1, ((vise.x - A.x) * vx + (vise.y - A.y) * vy) / l2))
    const d = Math.hypot(vise.x - (A.x + t * vx), vise.y - (A.y + t * vy))
    if (!meilleur || d < meilleur.d) meilleur = { i, t, d }
  }
  if (!meilleur) return null

  const A = pts[meilleur.i]
  const B = pts[meilleur.i + 1]
  const point = { x: A.x + (B.x - A.x) * meilleur.t, y: A.y + (B.y - A.y) * meilleur.t }
  const avant = [...pts.slice(0, meilleur.i + 1), point]
  const apres = [point, ...pts.slice(meilleur.i + 1)]
  if (longueur(avant) < marge || longueur(apres) < marge) return null
  return [avant, apres]
}

/** La longueur d'une polyligne, bout à bout. */
export function longueur(pts: Pt[]): number {
  let l = 0
  for (let i = 0; i < pts.length - 1; i++) l += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y)
  return l
}

/* Les bouts qui se suivent redeviennent une polyligne : un mur percé d'une
   fenêtre fait deux traits, pas six. */
function enchainer(morceaux: [Pt, Pt][]): Pt[][] {
  const lignes: Pt[][] = []
  for (const [a, b] of morceaux) {
    const cur = lignes[lignes.length - 1]
    const fin = cur?.[cur.length - 1]
    if (fin && Math.hypot(fin.x - a.x, fin.y - a.y) < 0.01) cur.push(b)
    else lignes.push([a, b])
  }
  return lignes
}

/* ============================================================
   Ce que le pion a pu atteindre — les pièces, sans jamais les nommer
   ============================================================ */

/**
 * Une grille posée sur la carte. On ne sait pas ce qu'est « une pièce » : on
 * ne connaît que des traits. Mais une pièce, c'est exactement ce qu'on peut
 * parcourir sans traverser un mur — alors on quadrille, on marque les cases
 * barrées, et on se répand. Ce qui se remplit est la pièce.
 */
export interface Grille {
  cols: number
  rows: number
  taille: number
}

export function grille(w: number, h: number, taille = 8): Grille {
  return { cols: Math.max(1, Math.ceil(w / taille)), rows: Math.max(1, Math.ceil(h / taille)), taille }
}

/** Les cases que les murs barrent — portes ouvertes non comprises, forcément. */
export function casesBarrees(murs: Barriere[], g: Grille): Uint8Array {
  const barre = new Uint8Array(g.cols * g.rows)
  const marque = (x: number, y: number): void => {
    const c = Math.floor(x / g.taille)
    const r = Math.floor(y / g.taille)
    if (c >= 0 && r >= 0 && c < g.cols && r < g.rows) barre[r * g.cols + c] = 1
  }
  for (const { a, b } of murs) {
    const d = Math.hypot(b.x - a.x, b.y - a.y)
    /* Un pas d'une demi-case : un mur en biais ne doit pas laisser de trou par
       où le remplissage filerait dans la pièce voisine. */
    const pas = Math.max(1, Math.ceil((d / g.taille) * 2))
    for (let i = 0; i <= pas; i++) marque(a.x + ((b.x - a.x) * i) / pas, a.y + ((b.y - a.y) * i) / pas)
  }
  return barre
}

/**
 * Tout ce qu'on atteint depuis un point sans traverser un mur — la pièce où
 * l'on est, plus celles qui s'ouvrent par une porte ouverte.
 *
 * Le remplissage est à quatre voisins, jamais en diagonale : deux murs qui se
 * touchent par un coin ferment le passage, comme dans la vraie vie.
 */
export function inonder(barre: Uint8Array, g: Grille, depart: Pt): Set<number> {
  const c0 = Math.min(g.cols - 1, Math.max(0, Math.floor(depart.x / g.taille)))
  const r0 = Math.min(g.rows - 1, Math.max(0, Math.floor(depart.y / g.taille)))
  const vus = new Set<number>()
  const file = [r0 * g.cols + c0]
  vus.add(file[0])
  while (file.length) {
    const i = file.pop() as number
    const c = i % g.cols
    const r = (i - c) / g.cols
    const voisins = [
      c > 0 ? i - 1 : -1,
      c < g.cols - 1 ? i + 1 : -1,
      r > 0 ? i - g.cols : -1,
      r < g.rows - 1 ? i + g.cols : -1
    ]
    for (const v of voisins) {
      if (v < 0 || vus.has(v) || barre[v]) continue
      vus.add(v)
      file.push(v)
    }
  }
  return vus
}

/**
 * Le contour des cases **absentes** de l'ensemble, en un seul chemin : ce que
 * le pion n'a jamais atteint. Les cases voisines d'une même ligne se
 * rassemblent en un rectangle — sinon on peindrait dix mille carrés.
 */
export function cheminDesInconnues(connues: Set<number>, g: Grille): string {
  let d = ''
  for (let r = 0; r < g.rows; r++) {
    let debut = -1
    for (let c = 0; c <= g.cols; c++) {
      const dedans = c < g.cols && !connues.has(r * g.cols + c)
      if (dedans && debut < 0) debut = c
      else if (!dedans && debut >= 0) {
        const x = debut * g.taille
        const y = r * g.taille
        d += `M${x} ${y}h${(c - debut) * g.taille}v${g.taille}h${-(c - debut) * g.taille}z`
        debut = -1
      }
    }
  }
  return d
}

/**
 * Les cases que le regard couvre, par balayage ligne à ligne.
 *
 * C'est la mémoire du pion : on ajoute à chaque instant ce qu'il voit, et ce
 * qui n'a jamais été vu reste noir. On arrondit vers l'extérieur — mieux vaut
 * une case connue de trop qu'un liseré noir au bord du cône.
 */
export function casesVues(poly: Pt[], g: Grille): Set<number> {
  const vues = new Set<number>()
  if (poly.length < 3) return vues
  for (let r = 0; r < g.rows; r++) {
    const y = (r + 0.5) * g.taille
    const bords: number[] = []
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]
      const b = poly[(i + 1) % poly.length]
      if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y))
        bords.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x))
    }
    bords.sort((u, v) => u - v)
    for (let k = 0; k + 1 < bords.length; k += 2) {
      const c0 = Math.max(0, Math.floor(bords[k] / g.taille))
      const c1 = Math.min(g.cols - 1, Math.ceil(bords[k + 1] / g.taille))
      for (let c = c0; c <= c1; c++) vues.add(r * g.cols + c)
    }
  }
  return vues
}

/** Les cases à bout de bras : on sait où l'on met les pieds, même de dos. */
export function casesAutour(p: Pt, rayon: number, g: Grille): Set<number> {
  const s = new Set<number>()
  for (let r = Math.floor((p.y - rayon) / g.taille); r <= Math.floor((p.y + rayon) / g.taille); r++) {
    for (let c = Math.floor((p.x - rayon) / g.taille); c <= Math.floor((p.x + rayon) / g.taille); c++) {
      if (r < 0 || c < 0 || r >= g.rows || c >= g.cols) continue
      s.add(r * g.cols + c)
    }
  }
  return s
}

/**
 * Les pièces que touche une porte ouverte — des deux côtés.
 *
 * Ouvrir une porte montre ce qu'il y a derrière : pas le cône du pion, la
 * pièce entière, et elle seule. Les seuils restent fermés pour ce calcul,
 * sinon la première porte ouverte livrerait la maison entière.
 */
export function piecesDesPortesOuvertes(
  murs: Mur[],
  ouvertures: Ouverture[],
  enPx: (p: PointMur) => Pt,
  g: Grille
): Set<number> {
  const out = new Set<number>()
  const ouvertes = ouvertures.filter((o) => o.nature === 'porte' && o.ouverte && !o.verrouillee)
  if (!ouvertes.length) return out
  const barre = casesBarrees(barrieres(murs, 'pieces', enPx), g)

  for (const porte of ouvertes) {
    const mur = murs.find((m) => m.id === porte.murId)
    if (!mur) continue
    const bords = bordsOuverture(mur, porte)
    for (const { a, b } of [{ a: enPx(bords.a), b: enPx(bords.b) }]) {
      const dx = b.x - a.x
      const dy = b.y - a.y
      const L = Math.hypot(dx, dy) || 1
      /* On sonde de part et d'autre du seuil, perpendiculairement : deux
         distances, parce qu'une case peut tomber sur le mur lui-même. */
      for (const d of [1.5, -1.5, 3, -3]) {
        const sonde = {
          x: (a.x + b.x) / 2 + (-dy / L) * d * g.taille,
          y: (a.y + b.y) / 2 + (dx / L) * d * g.taille
        }
        const c = Math.floor(sonde.x / g.taille)
        const r = Math.floor(sonde.y / g.taille)
        if (c < 0 || r < 0 || c >= g.cols || r >= g.rows) continue
        const i = r * g.cols + c
        if (barre[i] || out.has(i)) continue
        for (const case_ of inonder(barre, g, sonde)) out.add(case_)
      }
    }
  }
  return out
}

/** Distance d'un point à un segment — pour attraper un trait à la souris. */
export function distanceAuSegment(p: Pt, a: Pt, b: Pt): number {
  const vx = b.x - a.x
  const vy = b.y - a.y
  const l2 = vx * vx + vy * vy
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / l2))
  return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy))
}

/** Le trait le plus proche du point, s'il est assez près pour être visé. */
export function murSous(
  murs: Mur[],
  p: Pt,
  enPx: (q: PointMur) => Pt,
  seuil: number
): Mur | null {
  let trouve: Mur | null = null
  let proche = seuil
  for (const m of murs) {
    for (const s of segmentsDuMur(m, enPx)) {
      const d = distanceAuSegment(p, s.a, s.b)
      if (d < proche) {
        proche = d
        trouve = m
      }
    }
  }
  return trouve
}

/** `points="…"` d'un polygone SVG. */
export const polygone = (pts: Pt[]): string =>
  pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

/** `d="…"` d'une polyligne SVG. */
export const chemin = (pts: Pt[]): string =>
  pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
