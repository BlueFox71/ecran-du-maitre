/**
 * L'ambiance d'une carte : la couleur de sa lumière générale et le temps qu'il
 * y fait.
 *
 * C'est de l'ambiance, pas une règle : la teinte ne change rien à ce que les
 * pions voient, la pluie ne cache rien. On la règle dans l'atelier, à l'étape
 * de l'éclairage, et elle voyage avec le calque d'ombre pour que la régie, la
 * fenêtre des joueurs et l'atelier peignent la même chose.
 */

import type { NatureAstre } from './types'

export type Meteo = 'aucune' | 'brouillard' | 'pluie' | 'orage' | 'neige' | 'cendres'

export interface Ambiance {
  /** La couleur de la lumière générale, en hexadécimal ; `null`, la carte telle quelle. */
  teinte: string | null
  /** De 0 à 1 : combien la teinte pèse sur la carte. */
  force: number
  meteo: Meteo
  /** De 0 à 1 : une bruine ou une averse, un voile ou une purée de pois. */
  meteoForce: number
}

export const AMBIANCE_NEUTRE: Ambiance = { teinte: null, force: 0.35, meteo: 'aucune', meteoForce: 0.5 }

/** Les temps proposés, dans l'ordre des boutons. */
export const METEOS: { cle: Meteo; label: string; titre: string }[] = [
  { cle: 'aucune', label: 'Aucun', titre: 'Pas d’effet de temps' },
  { cle: 'brouillard', label: 'Brouillard', titre: 'Des nappes de brume qui dérivent lentement' },
  { cle: 'pluie', label: 'Pluie', titre: 'Une pluie qui tombe, des gouttes qui éclaboussent' },
  { cle: 'orage', label: 'Orage', titre: 'Une averse battante et des éclairs' },
  { cle: 'neige', label: 'Neige', titre: 'Des flocons qui tombent en tournoyant' },
  { cle: 'cendres', label: 'Cendres', titre: 'Des cendres et des braises qui volent (Légion, volcan, incendie)' }
]

/**
 * Les moments de l'ambiance, d'un clic : chacun règle à la fois la clarté du
 * lieu — le soleil, la lune ou la nuit noire, qui décident de ce que les
 * joueurs voient — et la couleur de la carte.
 */
export interface Moment {
  cle: string
  label: string
  titre: string
  astre: NatureAstre
  teinte: string | null
  force: number
}

export const MOMENTS: Moment[] = [
  { cle: 'jour', label: 'Jour', titre: 'Le plein soleil, la carte telle qu’elle est peinte', astre: 'soleil', teinte: null, force: 0 },
  { cle: 'aube', label: 'Aube', titre: 'Le soleil levant : une lumière dorée', astre: 'soleil', teinte: '#f2b35e', force: 0.3 },
  { cle: 'crepuscule', label: 'Crépuscule', titre: 'Le soleil couchant : orangé, un peu plus sombre', astre: 'lune', teinte: '#c8643c', force: 0.4 },
  { cle: 'nuit-claire', label: 'Nuit au clair de lune', titre: 'La nuit, sous la lune : bleutée, on y voit encore', astre: 'lune', teinte: '#3d5f9e', force: 0.5 },
  { cle: 'nuit-noire', label: 'Nuit noire', titre: 'Sans lune : les joueurs ne voient que ce qu’éclairent les lampes', astre: 'nuit', teinte: '#1d2a4a', force: 0.5 },
  { cle: 'gangrene', label: 'Gangrené', titre: 'Une lueur verte de gangrène, celle de la Légion', astre: 'soleil', teinte: '#5fbf3a', force: 0.35 },
  { cle: 'arcanique', label: 'Arcanique', titre: 'Une lumière violette de magie arcanique', astre: 'lune', teinte: '#7d4fd1', force: 0.4 }
]

/** Le moment qui correspond à ce ciel et cette couleur ; `null`, un réglage à soi. */
export function momentDe(nature: NatureAstre | null | undefined, teinte: string | null | undefined): Moment | null {
  const t = teinte ? teinte.toLowerCase() : null
  return MOMENTS.find((m) => m.astre === nature && m.teinte === t) ?? null
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

const borne = (v: unknown, defaut: number): number => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : defaut
}

/** Une ambiance lue en base ou reçue d'un écran : tout ce qui manque reprend sa valeur neutre. */
export function lireAmbiance(v: unknown): Ambiance {
  let o: unknown = v
  if (typeof v === 'string')
    try {
      o = JSON.parse(v)
    } catch {
      return { ...AMBIANCE_NEUTRE }
    }
  if (!o || typeof o !== 'object') return { ...AMBIANCE_NEUTRE }
  const r = o as Record<string, unknown>
  const meteo = METEOS.some((m) => m.cle === r.meteo) ? (r.meteo as Meteo) : 'aucune'
  return {
    teinte: typeof r.teinte === 'string' && HEX.test(r.teinte) ? r.teinte.toLowerCase() : null,
    force: borne(r.force, AMBIANCE_NEUTRE.force),
    meteo,
    meteoForce: borne(r.meteoForce, AMBIANCE_NEUTRE.meteoForce)
  }
}

/** Rien à peindre : ni teinte, ni temps. */
export const ambianceVide = (a: Ambiance | null | undefined): boolean =>
  !a || ((!a.teinte || a.force <= 0) && (a.meteo === 'aucune' || a.meteoForce <= 0))
