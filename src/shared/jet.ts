/**
 * La règle du jet d20, la même partout : le dé plus le **modificateur** de la
 * caractéristique, à la manière de D&D — FOR 16 donne +3, FOR 9 donne −1.
 *
 * Avant, chaque jet ajoutait la valeur brute (d20 + 16) alors que la fiche
 * affichait le modificateur : le joueur lisait +3 et recevait 19 de plus.
 * Le téléphone, la saisie du MJ et l'initiative passent tous par ici.
 */
export const modificateur = (valeur: number): number => Math.floor((valeur - 10) / 2)

/** « +3 », « +0 », « −1 » : le signe toujours écrit, le vrai moins. */
export const signe = (n: number): string => (n < 0 ? `−${-n}` : `+${n}`)

/** Le dé lui-même, pas le total : un 20 reste un 20 quel que soit le bonus. */
export type Naturel = 'critique' | 'maladresse' | null
export const naturel = (de: number): Naturel => (de === 20 ? 'critique' : de === 1 ? 'maladresse' : null)
