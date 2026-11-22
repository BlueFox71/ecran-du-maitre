/**
 * Ce que les outils de l'atelier demandent à la géométrie : un rectangle
 * tiré à la souris, le sol sous le curseur, la pièce qu'on veut paver.
 */
import {
  contourDeLObjet,
  placeOuverture,
  type Construction,
  type Habillage,
  type MurBati,
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

/** Le milieu des quatre côtés d'un objet : haut, droite, bas, gauche (dans son repère, avant rotation). */
export function milieuxDesCotes(o: ObjetPose): PointCase[] {
  const c = contourDeLObjet(o)
  return [0, 1, 2, 3].map((i) => [(c[i][0] + c[i + 1][0]) / 2, (c[i][1] + c[i + 1][1]) / 2] as PointCase)
}

/**
 * Tirer le milieu d'un côté (0 haut, 1 droite, 2 bas, 3 gauche) jusqu'à `p` :
 * l'objet s'allonge ou rétrécit dans ce sens seulement, le côté opposé reste
 * en place. Seule la projection de `p` sur l'axe compte : tirer de biais ne
 * déplace pas l'objet de côté.
 */
export function etirer(o: ObjetPose, cote: number, p: PointCase): ObjetPose {
  const a = (o.angle * Math.PI) / 180
  const enLargeur = cote === 1 || cote === 3
  const axe: PointCase = enLargeur ? [Math.cos(a), Math.sin(a)] : [-Math.sin(a), Math.cos(a)]
  const s = cote === 1 || cote === 2 ? 1 : -1
  const taille = enLargeur ? o.l : o.h
  const fixe: PointCase = [o.x - (s * axe[0] * taille) / 2, o.y - (s * axe[1] * taille) / 2]
  const neuve = Math.max(TAILLE_MIN, s * ((p[0] - fixe[0]) * axe[0] + (p[1] - fixe[1]) * axe[1]))
  return {
    ...o,
    ...(enLargeur ? { l: neuve } : { h: neuve }),
    x: fixe[0] + (s * axe[0] * neuve) / 2,
    y: fixe[1] + (s * axe[1] * neuve) / 2
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
  hasard: () => number,
  varier: { rotation: boolean; taille: boolean } = { rotation: true, taille: true }
): { id: string; angle: number; echelle: number } | null {
  if (!ids.length) return null
  const id = ids[Math.min(ids.length - 1, Math.floor(hasard() * ids.length))]
  const angle = hasard() * 360
  const echelle = ECHELLE_HASARD.min + hasard() * (ECHELLE_HASARD.max - ECHELLE_HASARD.min)
  return { id, angle: varier.rotation ? angle : 0, echelle: varier.taille ? echelle : 1 }
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

/** L'habillage de la pièce où tombe un point, s'il y en a un. */
export function habillageSous(c: Construction, p: PointCase): Habillage | null {
  const piece = pieceSous(c, p)
  if (!piece) return null
  return c.habillages?.find((h) => dansForme(h.pt, piece) && pieceSous(c, h.pt)?.length === piece.length) ?? null
}

/**
 * Comment chaque mur borde une pièce : `1` ou `2`, le côté tourné vers elle
 * quand il la longe sur toute sa longueur ; `null` quand il ne la longe qu'en
 * partie (le mur extérieur d'une maison, qui borde plusieurs pièces). Les murs
 * qui ne la touchent pas sont absents.
 *
 * On sonde de part et d'autre de chaque segment, en plusieurs points : le
 * côté 1 est à gauche du sens de tracé (comme au rendu).
 */
export function cotesDeLaPiece(c: Construction, piece: PointCase[]): Map<string, 1 | 2 | null> {
  const out = new Map<string, 1 | 2 | null>()
  const EPS = 0.05
  for (const m of c.murs) {
    let cote: 1 | 2 | null | undefined
    let touche = false
    let entier = true
    for (let i = 0; i + 1 < m.pts.length; i++) {
      const [ax, ay] = m.pts[i]
      const [bx, by] = m.pts[i + 1]
      const l = Math.hypot(bx - ax, by - ay)
      if (l < 1e-9) continue
      const nx = (by - ay) / l
      const ny = -(bx - ax) / l
      for (const t of [0.1, 0.3, 0.5, 0.7, 0.9]) {
        const px = ax + (bx - ax) * t
        const py = ay + (by - ay) * t
        const gauche = dansForme([px + nx * EPS, py + ny * EPS], piece)
        const droite = dansForme([px - nx * EPS, py - ny * EPS], piece)
        if (gauche === droite) {
          entier = false
          continue
        }
        touche = true
        const k: 1 | 2 = gauche ? 1 : 2
        if (cote === undefined) cote = k
        else if (cote !== k) entier = false
      }
    }
    if (touche) out.set(m.id, entier && cote ? cote : null)
  }
  return out
}

/**
 * Habiller une pièce : les murs qui la bordent sur toute leur longueur passent
 * à deux côtés, la face tournée vers elle prend la matière ; l'habillage est
 * retenu pour les murs qui ne la longent qu'en partie.
 */
export function appliquerHabillage(
  c: Construction,
  pt: PointCase,
  face: { assetId: string; teinte?: string }
): Construction {
  const piece = pieceSous(c, pt)
  if (!piece) return c
  const cotes = cotesDeLaPiece(c, piece)
  const deja = habillageSous(c, pt)
  const murs = c.murs.map((m) => {
    const k = cotes.get(m.id)
    if (!k) return m
    const cote2 = m.cote2 ?? { assetId: m.assetId, ...(m.teinte ? { teinte: m.teinte } : {}) }
    if (k === 2) return { ...m, cote2: { ...face } }
    const { teinte: _t, ...reste } = m
    return { ...reste, assetId: face.assetId, ...(face.teinte ? { teinte: face.teinte } : {}), cote2 }
  })
  const h = { id: deja?.id ?? crypto.randomUUID(), pt, ...face }
  return { ...c, murs, habillages: [...(c.habillages ?? []).filter((x) => x.id !== h.id), h] }
}

/* ---------------- murs superposés ---------------- */

const TOL_SUPERPOSE = 0.05

/**
 * Ce qui reste d'un mur une fois retirées les parties qui se superposent à
 * d'autres murs (même ligne, au trait près). Rend des polylignes : aucune s'il
 * est entièrement recouvert, plusieurs s'il est coupé.
 */
export function sansSuperposition(m: MurBati, autres: MurBati[]): PointCase[][] {
  const out: PointCase[][] = []
  let cours: PointCase[] = []
  const finir = (): void => {
    if (cours.length >= 2) out.push(cours)
    cours = []
  }
  for (let i = 0; i + 1 < m.pts.length; i++) {
    const a = m.pts[i]
    const b = m.pts[i + 1]
    const L = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (L < 1e-9) continue
    const ux = (b[0] - a[0]) / L
    const uy = (b[1] - a[1]) / L
    const P = (t: number): PointCase => [a[0] + ux * t, a[1] + uy * t]
    /* Les parties couvertes : segments parallèles posés sur la même ligne. */
    const couverts: [number, number][] = []
    for (const o of autres) {
      if (o === m) continue
      for (let j = 0; j + 1 < o.pts.length; j++) {
        const c = o.pts[j]
        const d = o.pts[j + 1]
        const dist = (p: PointCase): number => Math.abs((p[0] - a[0]) * uy - (p[1] - a[1]) * ux)
        if (dist(c) > TOL_SUPERPOSE || dist(d) > TOL_SUPERPOSE) continue
        const tc = (c[0] - a[0]) * ux + (c[1] - a[1]) * uy
        const td = (d[0] - a[0]) * ux + (d[1] - a[1]) * uy
        const t0 = Math.max(0, Math.min(tc, td))
        const t1 = Math.min(L, Math.max(tc, td))
        if (t1 - t0 > TOL_SUPERPOSE) couverts.push([t0, t1])
      }
    }
    couverts.sort((x, y) => x[0] - y[0])
    /* Le complément : ce qui reste du segment. */
    const restes: [number, number][] = []
    let t = 0
    for (const [t0, t1] of couverts) {
      if (t0 - t > TOL_SUPERPOSE) restes.push([t, t0])
      t = Math.max(t, t1)
    }
    if (L - t > TOL_SUPERPOSE) restes.push([t, L])
    for (const [s, e] of restes) {
      /* Le morceau prolonge la polyligne en cours s'il part du début du segment. */
      if (s > 1e-9 || !cours.length) {
        finir()
        cours = [P(s)]
      }
      cours.push(e >= L - 1e-9 ? b : P(e))
      if (e < L - 1e-9) finir()
    }
    if (!restes.length) finir()
  }
  finir()
  return out.map((pts) => pts.map(([x, y]) => [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6] as PointCase))
}

/** La position d'une ouverture : le point au milieu d'elle, en cases. */
function centreDOuverture(c: Construction, o: OuvertureBatie): PointCase | null {
  const m = c.murs.find((x) => x.id === o.murId)
  return m ? placeOuverture(m, o).centre : null
}

/**
 * Fusionner les murs superposés de toute la construction : les pièces fermées
 * gardent leurs murs, les autres perdent ce qui les recouvre (dans l'ordre où
 * ils ont été tracés). Les ouvertures restent où elles étaient, sur le mur qui
 * subsiste à cet endroit.
 */
export function fusionnerSuperpositions(c: Construction): Construction {
  const ferme = (m: MurBati): boolean => {
    const p = m.pts
    return p.length > 3 && Math.hypot(p[0][0] - p[p.length - 1][0], p[0][1] - p[p.length - 1][1]) < 1e-6
  }
  /* Les murs invisibles restent à part : posés le long d'un vrai mur pour
     découper une pièce, ils ne doivent ni l'entamer, ni être entamés. */
  const peints = c.murs.filter((m) => !m.invisible)
  const ordre = [...peints.filter(ferme), ...peints.filter((m) => !ferme(m))]
  const gardes: MurBati[] = []
  const remplaces = new Map<string, MurBati[]>()
  let change = false
  for (const m of ordre) {
    const morceaux = sansSuperposition(m, gardes)
    const intact = morceaux.length === 1 && JSON.stringify(morceaux[0]) === JSON.stringify(m.pts)
    const nouveaux = intact
      ? [m]
      : morceaux.map((pts, k) => ({ ...m, id: k === 0 ? m.id : crypto.randomUUID(), pts }))
    if (!intact) change = true
    remplaces.set(m.id, nouveaux)
    gardes.push(...nouveaux)
  }
  if (!change) return c
  const murs = c.murs.flatMap((m) => remplaces.get(m.id) ?? [m])
  const apres: Construction = { ...c, murs }
  const ouvertures = c.ouvertures.flatMap((o) => {
    const avant = c.murs.find((x) => x.id === o.murId)
    if (!avant || JSON.stringify(remplaces.get(avant.id)?.[0]?.pts) === JSON.stringify(avant.pts)) return [o]
    const centre = centreDOuverture(c, o)
    const s = centre ? murSous(apres, centre, TOL_SUPERPOSE * 4, true) : null
    return s && s.d !== undefined ? [{ ...o, murId: s.murId, d: s.d }] : []
  })
  return { ...apres, ouvertures }
}

/* ---------------- la pipette ---------------- */

/**
 * La matière du sol qu'on voit sous un point : le dernier sol peint qui le
 * couvre, ou la matière de base si rien ne le couvre — ou si un coup de gomme
 * l'a mise à nu. `null` : le fond nu.
 */
export function matiereDuSolSous(c: Construction, p: PointCase): string | null {
  const s = solSous(c, p)
  if (!s || s.gomme) return c.base ?? null
  return s.assetId
}

/**
 * La face de mur sous un point, telle qu'on la voit : la matière et la
 * couleur du côté où tombe le point. Le côté 1 est à gauche du sens de tracé,
 * le côté 2 à droite (s'il diffère). `null` : aucun mur à portée.
 */
export function faceDuMurSous(
  c: Construction,
  p: PointCase,
  tol: number
): { murId: string; assetId: string; teinte?: string } | null {
  let meilleur: { m: MurBati; gauche: boolean; dist: number } | null = null
  for (const m of c.murs) {
    for (let i = 0; i + 1 < m.pts.length; i++) {
      const a = m.pts[i]
      const b = m.pts[i + 1]
      const vx = b[0] - a[0]
      const vy = b[1] - a[1]
      const l2 = vx * vx + vy * vy
      const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / l2)) : 0
      const dist = Math.hypot(p[0] - (a[0] + t * vx), p[1] - (a[1] + t * vy))
      if (dist > Math.max(tol, m.epaisseur / 2) || (meilleur && dist >= meilleur.dist)) continue
      /* À gauche du sens de tracé, à l'écran (y vers le bas) : du côté de (vy, −vx). */
      meilleur = { m, gauche: (p[0] - a[0]) * vy - (p[1] - a[1]) * vx >= 0, dist }
    }
  }
  if (!meilleur) return null
  const { m, gauche } = meilleur
  const face = !gauche && m.cote2 ? m.cote2 : { assetId: m.assetId, teinte: m.teinte }
  return { murId: m.id, assetId: face.assetId, ...(face.teinte ? { teinte: face.teinte } : {}) }
}

/* ---------------- miroirs et alignements ---------------- */

/** La boîte d'un ensemble d'objets (tournés), en cases. */
export function boiteDesObjets(objets: ObjetPose[]): { x0: number; y0: number; x1: number; y1: number } {
  const pts = objets.flatMap((o) => contourDeLObjet(o))
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }
}

/**
 * Retourner des objets en miroir — `h` : gauche ↔ droite, `v` : haut ↔ bas.
 * Chacun se retourne sur lui-même ; à plusieurs, ils échangent aussi leurs
 * places autour du centre du groupe, comme si on retournait le plateau.
 *
 * Un objet tourné de θ puis retourné se dessine tourné de −θ, l'image
 * retournée dans son propre repère : le même axe pour les deux miroirs,
 * puisqu'un retournement à l'écran ne fait que changer le signe de l'angle.
 */
export function miroirObjets(objets: ObjetPose[], axe: 'h' | 'v'): ObjetPose[] {
  if (!objets.length) return objets
  const b = boiteDesObjets(objets)
  const cx = (b.x0 + b.x1) / 2
  const cy = (b.y0 + b.y1) / 2
  const seul = objets.length === 1
  return objets.map((o) => {
    const angle = (((-o.angle % 360) + 360) % 360) + 0
    if (axe === 'h') return { ...o, x: seul ? o.x : 2 * cx - o.x, angle, miroirX: !o.miroirX }
    return { ...o, y: seul ? o.y : 2 * cy - o.y, angle, miroirY: !o.miroirY }
  })
}

export type Alignement = 'gauche' | 'centreH' | 'droite' | 'haut' | 'centreV' | 'bas'

/**
 * Aligner des objets sur la boîte du groupe : leurs bords gauches sur le plus
 * à gauche, leurs centres sur le centre du groupe… On aligne ce qu'on voit,
 * la boîte de l'objet tourné, pas son rectangle d'origine.
 */
export function alignerObjets(objets: ObjetPose[], comment: Alignement): ObjetPose[] {
  if (objets.length < 2) return objets
  const g = boiteDesObjets(objets)
  return objets.map((o) => {
    const b = boiteDesObjets([o])
    switch (comment) {
      case 'gauche':
        return { ...o, x: o.x + g.x0 - b.x0 }
      case 'droite':
        return { ...o, x: o.x + g.x1 - b.x1 }
      case 'centreH':
        return { ...o, x: o.x + (g.x0 + g.x1) / 2 - (b.x0 + b.x1) / 2 }
      case 'haut':
        return { ...o, y: o.y + g.y0 - b.y0 }
      case 'bas':
        return { ...o, y: o.y + g.y1 - b.y1 }
      case 'centreV':
        return { ...o, y: o.y + (g.y0 + g.y1) / 2 - (b.y0 + b.y1) / 2 }
    }
  })
}
