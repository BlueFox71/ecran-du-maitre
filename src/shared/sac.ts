/**
 * Ce que tient un sac.
 *
 * Seul ce qui est **dans** le sac compte : une épée en main ne prend pas de
 * place. Chaque objet y occupe ses places, autant de fois qu'il y en a ; ce
 * qu'il porte sur lui peut en ajouter — le sac à dos sur le dos, une fois,
 * quel que soit le nombre qu'on lui en compte.
 *
 * Le poste du MJ, le serveur et les téléphones font le même calcul : il vit
 * ici pour qu'un sac plein le soit partout.
 */

/** Un exemplaire sur quelqu'un, vu du sac. */
export interface LigneSac {
  places: number
  bonusSac: number
  qte: number
  /** L'endroit du corps où il est porté ; `null`, dans le sac. */
  emplacement: string | null
}

export interface EtatSac {
  /** Les places prises. */
  charge: number
  /** Les places qu'il a ; `null`, sans limite. */
  capacite: number | null
}

/** Sous ce seuil, deux places sont les mêmes : 0,1 + 0,2 n'excède pas 0,3. */
export const EPSILON_SAC = 1e-6

export function etatSac(lignes: LigneSac[], base: number): EtatSac {
  let charge = 0
  let bonus = 0
  for (const l of lignes) {
    if (l.emplacement) bonus += Math.max(0, l.bonusSac)
    else charge += Math.max(0, l.places) * l.qte
  }
  return { charge, capacite: base > 0 ? base + bonus : null }
}

export const sacPlein = (e: EtatSac): boolean =>
  e.capacite !== null && e.charge > e.capacite + EPSILON_SAC

/** « 9,5 » : une place se lit à la française, sans zéros qui traînent. */
export function ditPlaces(n: number): string {
  return String(Math.round(n * 100) / 100).replace('.', ',')
}

/** « 7 / 10 places », ou « 7 places » sans limite. */
export function ditSac(e: EtatSac): string {
  return e.capacite === null
    ? `${ditPlaces(e.charge)} place${e.charge > 1 ? 's' : ''}`
    : `${ditPlaces(e.charge)} / ${ditPlaces(e.capacite)} places`
}

/**
 * La marque d'un refus pour sac plein, en tête du message d'erreur. Le
 * message traverse l'IPC dans le texte d'une exception : la marque permet à
 * l'interface de le reconnaître et de le montrer tel quel.
 */
export const REFUS_SAC = '[sac] '

/** Le message d'un refus pour sac plein, s'il en est un ; sinon `null`. */
export function refusSac(e: unknown): string | null {
  const msg = e instanceof Error ? e.message : String(e)
  const i = msg.indexOf(REFUS_SAC)
  return i < 0 ? null : msg.slice(i + REFUS_SAC.length)
}
