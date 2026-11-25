/**
 * La planche de spiritisme : où se trouve chaque case sur la photo, et comment
 * la goutte (la planchette) glisse de l'une à l'autre.
 *
 * Les positions sont celles des lettres sur assets/chasse/planche.jpg
 * (1536 × 1024), relevées à la main sur la photo quadrillée.
 */

export const PLANCHE_L = 1536
export const PLANCHE_H = 1024

export interface Case {
  /** Ce qu'on vise : une lettre, un chiffre, OUI, NON, AU REVOIR. */
  id: string
  x: number
  y: number
}

const LETTRES: [string, number, number][] = [
  ['A', 215, 430], ['B', 300, 390], ['C', 385, 360], ['D', 485, 340], ['E', 580, 322],
  ['F', 670, 315], ['G', 765, 310], ['H', 865, 315], ['I', 955, 325], ['J', 1030, 335],
  ['K', 1125, 350], ['L', 1215, 390], ['M', 1320, 425],
  ['N', 205, 570], ['O', 305, 535], ['P', 385, 510], ['Q', 475, 490], ['R', 565, 465],
  ['S', 660, 455], ['T', 745, 450], ['U', 840, 455], ['V', 940, 460], ['W', 1040, 480],
  ['X', 1145, 515], ['Y', 1240, 535], ['Z', 1330, 580]
]

const CHIFFRES: [string, number, number][] = [
  ['1', 330, 700], ['2', 425, 700], ['3', 525, 700], ['4', 620, 700], ['5', 715, 698],
  ['6', 807, 700], ['7', 902, 700], ['8', 996, 698], ['9', 1096, 695], ['0', 1194, 697]
]

const MOTS: [string, number, number][] = [
  ['OUI', 420, 182],
  ['NON', 1110, 180],
  ['AU REVOIR', 760, 855]
]

const vers = ([id, x, y]: [string, number, number]): Case => ({ id, x, y })

export const CASES_LETTRES: Case[] = LETTRES.map(vers)
export const CASES_CHIFFRES: Case[] = CHIFFRES.map(vers)
export const CASES_MOTS: Case[] = MOTS.map(vers)
export const TOUTES_LES_CASES: Case[] = [...CASES_MOTS, ...CASES_LETTRES, ...CASES_CHIFFRES]

/** Où la goutte attend : au milieu, sous les lettres. */
export const REPOS: Case = { id: '', x: 768, y: 610 }

/** La case d'une touche du clavier (lettre ou chiffre, accents ôtés), ou null. */
export function caseDeLaTouche(touche: string): Case | null {
  if (touche.length !== 1) return null
  const t = touche.normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase()
  return TOUTES_LES_CASES.find((c) => c.id === t) ?? null
}

/**
 * La durée d'un trajet, en ms : plus c'est loin, plus c'est long, mais pas
 * proportionnellement — la main qui pousse accélère. `vitesse` > 1 : plus vite.
 */
export function dureeTrajet(de: Case, a: Case, vitesse: number): number {
  const d = Math.hypot(a.x - de.x, a.y - de.y)
  return Math.round((500 + 95 * Math.sqrt(d)) / Math.max(0.2, vitesse))
}

/** Un départ et une arrivée en douceur. */
export function adoucir(t: number): number {
  const u = Math.max(0, Math.min(1, t))
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2
}

/**
 * Le point du trajet à l'instant `t` (0 → 1) : une courbe, pas une ligne
 * droite — `courbure` déporte le milieu du chemin sur le côté (en part de la
 * distance, signée).
 */
export function pointDuTrajet(de: Case, a: Case, t: number, courbure: number): { x: number; y: number } {
  const u = adoucir(t)
  const dx = a.x - de.x
  const dy = a.y - de.y
  /* Le point de contrôle : le milieu, poussé perpendiculairement. */
  const cx = de.x + dx / 2 - dy * courbure
  const cy = de.y + dy / 2 + dx * courbure
  const v = 1 - u
  return { x: v * v * de.x + 2 * v * u * cx + u * u * a.x, y: v * v * de.y + 2 * v * u * cy + u * u * a.y }
}
