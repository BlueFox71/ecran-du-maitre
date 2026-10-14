/**
 * Ce que l'application écrit d'elle-même — les textes des lieux et des
 * moments, les annexes, le Bloc-notes — vit dans son dossier `.ecran-du-maitre`,
 * à côté de la base. Le dossier de campagne reste celui du MJ : ses plans, ses
 * sons, ses images.
 *
 * Le dossier de l'app reprend les chemins des séances : les moments de
 * `Séance 4/` vont dans `.ecran-du-maitre/Séance 4/Moments`. Une séance sans
 * dossier range les siens à la racine de `.ecran-du-maitre`.
 */
export const MARQUE = '.ecran-du-maitre'

export const DOSSIER_LIEUX = 'Lieux'
export const DOSSIER_MOMENTS = 'Moments'
export const DOSSIER_ANNEXES = 'Annexes'
export const DOSSIER_NOTES = 'Bloc-notes'
export const DOSSIER_PNJ = 'PNJ'

/** Le chemin, relatif à la campagne, d'un dossier de l'app pour une séance (ou pour toute la campagne). */
export function dossierDeLApp(base: string | null | undefined, nom: string): string {
  return [MARQUE, base, nom].filter(Boolean).join('/')
}

/** Ce chemin est-il dans le dossier de l'app ? */
export function dansLApp(rel: string | null | undefined): boolean {
  return !!rel && (rel === MARQUE || rel.startsWith(MARQUE + '/'))
}
