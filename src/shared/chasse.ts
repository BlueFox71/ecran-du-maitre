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

/**
 * Un coup de pinceau sur un calque ; `valeur: null` = coup de gomme. Avec
 * `ecart`, c'est un pinceau relatif (température seulement) : il réchauffe ou
 * refroidit de tant de degrés ce qu'il y a dessous, et `valeur` est ignorée.
 */
export interface TraitMesure {
  id: string
  valeur: number | null
  /** En cases. */
  rayon: number
  pts: PointCase[]
  ecart?: number
}

/**
 * Jusqu'où un joueur ramasse un appareil posé, en mètres entre son pion et
 * l'appareil (à l'échelle du plan). Le poste en juge ; le téléphone ne montre
 * « Ramasser » qu'un peu en deçà, pour ne pas être refusé au bord.
 */
export const PORTEE_RAMASSER_M = 5

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

/** Un appareil sur la fiche du téléphone : porté, ou posé par son joueur. */
export interface OutilTelephone {
  placementId: number
  nom: string
  outil: OutilChasse
  /** Tenu en main (un emplacement), rangé dans le sac, ou posé dans le lieu. */
  ou: 'main' | 'sac' | 'lieu'
  allume: boolean
  /** `null` quand le joueur ne peut pas le lire (posé loin de son pion, ou derrière un mur). */
  valeur: number | null
}

/** Un appareil posé dans le lieu affiché, que le plan du téléphone dessine sous l'ombre. */
export interface AppareilPose {
  placementId: number
  outil: OutilChasse
  valeur: number
  allume: boolean
}

/** Bornes d'une température peinte, en °C. */
export const TEMPERATURE_MIN = -20
export const TEMPERATURE_MAX = 35

const borneTemperature = (v: number): number => Math.min(TEMPERATURE_MAX, Math.max(TEMPERATURE_MIN, v))

const couvre = (t: TraitMesure, p: PointCase): boolean =>
  t.pts.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) <= t.rayon)

/**
 * La valeur peinte sous le point : on parcourt les traits du dernier au
 * premier, le dernier peint l'emporte (repeindre remplace), une gomme rend
 * `fond` (`null` par défaut : rien de peint). Les traits relatifs croisés en
 * chemin s'ajoutent ensuite à ce qu'on a trouvé dessous, du plus ancien au
 * plus récent, chacun borné comme une température.
 */
export function mesureSous(
  traits: TraitMesure[] | undefined,
  p: PointCase,
  fond: number | null = null
): number | null {
  if (!traits) return fond
  const ecarts: number[] = []
  let v: number | null = fond
  for (let i = traits.length - 1; i >= 0; i--) {
    const t = traits[i]
    if (!couvre(t, p)) continue
    if (t.ecart !== undefined) {
      ecarts.push(t.ecart)
      continue
    }
    v = t.valeur ?? fond
    break
  }
  if (!ecarts.length) return v
  let x = v ?? 0
  for (let j = ecarts.length - 1; j >= 0; j--) x = borneTemperature(x + ecarts[j])
  return x
}

/**
 * Le calque des températures en grille, `parCase` échantillons par case
 * (pris au centre de chaque cellule), pour le dessiner : chaque trait se pose
 * à son tour, comme on l'a peint — le même résultat que `mesureSous` en
 * chaque point, sans relire tous les traits pour chacun.
 */
export function grilleTemperatures(
  traits: TraitMesure[],
  largeur: number,
  hauteur: number,
  ambiante: number,
  parCase: number,
  depart?: Float32Array
): { l: number; h: number; valeurs: Float32Array } {
  const l = Math.max(1, Math.ceil(largeur * parCase))
  const h = Math.max(1, Math.ceil(hauteur * parCase))
  const valeurs = depart && depart.length === l * h ? depart.slice() : new Float32Array(l * h).fill(ambiante)
  /* Une cellule ne prend un trait qu'une fois, même sous plusieurs de ses points. */
  const vu = new Uint8Array(l * h)
  for (const t of traits) {
    vu.fill(0)
    const r = t.rayon
    for (const [x, y] of t.pts) {
      const i0 = Math.max(0, Math.floor((x - r) * parCase))
      const i1 = Math.min(l - 1, Math.ceil((x + r) * parCase))
      const j0 = Math.max(0, Math.floor((y - r) * parCase))
      const j1 = Math.min(h - 1, Math.ceil((y + r) * parCase))
      for (let j = j0; j <= j1; j++) {
        const cy = (j + 0.5) / parCase - y
        for (let i = i0; i <= i1; i++) {
          const k = j * l + i
          if (vu[k]) continue
          const cx = (i + 0.5) / parCase - x
          if (Math.hypot(cx, cy) > r) continue
          vu[k] = 1
          valeurs[k] = t.ecart !== undefined ? borneTemperature(valeurs[k] + t.ecart) : (t.valeur ?? ambiante)
        }
      }
    }
  }
  return { l, h, valeurs }
}

export function niveauEmfSous(c: Construction | null, p: PointCase | null): number {
  if (!c || !p) return 0
  return mesureSous(c.emf, p) ?? 0
}

export function temperatureSous(c: Construction | null, p: PointCase | null): number {
  const ambiante = c?.ambiante ?? AMBIANTE_DEFAUT
  if (!c || !p) return ambiante
  return mesureSous(c.temperature, p, ambiante) ?? ambiante
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
