/**
 * Les curseurs de volume suivent l'oreille, pas la règle.
 *
 * L'oreille entend en rapports : de 2 % à 4 %, le son double ; de 80 % à 82 %,
 * il ne bouge pas. Un curseur droit gaspillait donc sa course dans le haut et
 * tassait tout le bas — là où l'on règle une ambiance discrète — dans le
 * premier dixième. Le volume est ici le carré de la position : le premier
 * tiers de la course couvre 0 à 10 %, au dixième de pour cent près.
 *
 * Seul le curseur change de forme : le volume rangé, joué et tapé dans le
 * champ reste le même nombre, de 0 à 1.
 */

const EXPOSANT = 2

/** La course du curseur, en crans : assez fins pour régler le bas au dixième de pour cent. */
export const COURSE = 1000

const borne = (x: number): number => Math.min(1, Math.max(0, x))

/** Le cran du curseur pour un volume de 0 à 1. */
export function positionDe(volume: number): number {
  return Math.round(Math.pow(borne(volume), 1 / EXPOSANT) * COURSE)
}

/** Le volume (0 à 1, au dix-millième : au millième, les crans du bas se confondaient) pour un cran du curseur. */
export function volumeDe(position: number): number {
  return Math.round(Math.pow(borne(position / COURSE), EXPOSANT) * 10000) / 10000
}

/** Un volume en pour cent, tel qu'on le lit : une décimale sous 10 %, où elle compte. */
export function texteVolume(pourcent: number): string {
  const p = Math.min(100, Math.max(0, pourcent))
  return p < 10 && Math.round(p * 10) % 10 !== 0 ? `${p.toFixed(1).replace('.', ',')} %` : `${Math.round(p)} %`
}
