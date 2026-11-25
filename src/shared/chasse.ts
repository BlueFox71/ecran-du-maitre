/**
 * Les outils de chasse (EMF, thermomètre…) : ce que mesure un appareil porté
 * sur un téléphone, d'après les calques peints dans l'atelier, et comment on
 * l'entend de loin. Logique pure, partagée entre le main et le renderer.
 */
import type { Construction, PointCase } from './atelier'

export type OutilChasse = 'emf' | 'thermometre'

export const OUTILS_CHASSE: { id: OutilChasse; nom: string }[] = [
  { id: 'emf', nom: 'EMF' },
  { id: 'thermometre', nom: 'Thermomètre' }
]

export const estOutil = (v: unknown): v is OutilChasse => OUTILS_CHASSE.some((o) => o.id === v)

/** Un coup de pinceau sur un calque ; `valeur: null` = coup de gomme. */
export interface TraitMesure {
  id: string
  valeur: number | null
  /** En cases. */
  rayon: number
  pts: PointCase[]
}

/** Température d'une pièce sans trait peint, en °C. */
export const AMBIANTE_DEFAUT = 18
/** Au-delà, on n'entend plus l'appareil. */
export const PORTEE_SON_M = 15
/** Part du son qui passe à chaque mur traversé. */
export const ATTENUATION_MUR = 0.35
/** À quelle distance on lit l'appareil d'un autre. */
export const PORTEE_LECTURE_M = 6
/** Largeur supposée d'un plan sans échelle. */
export const LARGEUR_PLAN_DEFAUT_M = 30

export interface AppareilChasse {
  placementId: number
  objetId: number
  nom: string
  outil: OutilChasse
  ou: 'main' | 'lieu' | 'ailleurs'
  placeId: number | null
  /** En fractions du plan. */
  pos: { x: number; y: number } | null
  characterId: number | null
  allume: boolean
  /** Niveau EMF (0 à 5) ou °C. */
  valeur: number
  controle: boolean
  gain: number
}

/** Bornes d'une température peinte, en °C. */
export const TEMPERATURE_MIN = -20
export const TEMPERATURE_MAX = 35

/**
 * La valeur peinte sous le point : on parcourt les traits du dernier au
 * premier, le dernier peint l'emporte (repeindre remplace), une gomme rend `null`.
 */
export function mesureSous(traits: TraitMesure[] | undefined, p: PointCase): number | null {
  if (!traits) return null
  for (let i = traits.length - 1; i >= 0; i--) {
    const t = traits[i]
    if (t.pts.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) <= t.rayon)) return t.valeur
  }
  return null
}

export function niveauEmfSous(c: Construction | null, p: PointCase | null): number {
  if (!c || !p) return 0
  return mesureSous(c.emf, p) ?? 0
}

export function temperatureSous(c: Construction | null, p: PointCase | null): number {
  const ambiante = c?.ambiante ?? AMBIANTE_DEFAUT
  if (!c || !p) return ambiante
  return mesureSous(c.temperature, p) ?? ambiante
}

/** La part du son qu'on entend : pleine à 1 m, nulle à la portée, divisée à chaque mur. */
export function gainSon(distanceM: number, mursTraverses: number): number {
  const base = Math.min(1, Math.max(0, 1 - (distanceM - 1) / (PORTEE_SON_M - 1)))
  return base * ATTENUATION_MUR ** mursTraverses
}

/**
 * Où est un pion sur la carte, en fractions de celle-ci. Il est rangé en
 * fractions du cadre de l'écran des joueurs, où la carte entre entière,
 * centrée, avec des bandes là où les proportions diffèrent. Un pion dans une
 * bande est hors de la carte : les fractions rendues peuvent sortir de [0, 1]
 * (non bornées, exprès).
 */
export function pionSurPlan(
  p: { x: number; y: number },
  ratioCarte: number,
  ratioEcran: number
): { x: number; y: number } {
  const x = ratioEcran > ratioCarte ? (p.x - 0.5) * (ratioEcran / ratioCarte) + 0.5 : p.x
  const y = ratioEcran < ratioCarte ? (p.y - 0.5) * (ratioCarte / ratioEcran) + 0.5 : p.y
  return { x, y }
}
