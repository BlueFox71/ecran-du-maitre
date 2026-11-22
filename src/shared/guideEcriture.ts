/**
 * Le guide d'écriture d'une séance : un mode d'emploi pour une autre session
 * (un assistant, un co-auteur) qui écrit la séance en fichiers — ce qu'elle
 * peut écrire elle-même, et ce qu'elle doit préparer pour le MJ.
 *
 * Le texte vit dans `guideEcriture.md` ; on y remplit la séance, ses dossiers
 * et la fiche de personnage de la campagne. Les chemins sont ceux de Windows,
 * tels que l'explorateur les montre.
 */
import modele from './guideEcriture.md?raw'

export const NOM_GUIDE = 'GUIDE-ECRITURE-SEANCE.md'

export interface ParamsGuide {
  /** Le nom de la séance, tel que le MJ le voit. */
  seance: string
  /** Son dossier dans la campagne ; null : elle n'en a pas, tout va à la racine. */
  base: string | null
  /** Le dossier de la campagne, en chemin absolu. */
  racine: string
  /** Le dossier d'une séance précédente à prendre pour modèle, s'il y en a. */
  modele: string | null
  version: string
  fiche: { stats: string[]; jauges: string[]; competences: string[] }
}

const win = (...parts: (string | null)[]): string =>
  parts
    .filter((p): p is string => !!p)
    .join('\\')
    .replace(/\//g, '\\')

export function texteGuide(p: ParamsGuide): string {
  const seance = win(p.racine, p.base) + '\\'
  const app = win(p.racine, '.ecran-du-maitre', p.base) + '\\'
  const sous = (nom: string): string => win(p.racine, p.base, nom) + '\\'
  const relatif = (...parts: string[]): string => [p.base, ...parts].filter(Boolean).join('/')
  const liste = (l: string[]): string => (l.length ? l.join(', ') : '(aucune)')

  const modeles = p.modele
    ? `
**Les séances précédentes servent de modèles** : regarde \`${win(p.racine, '.ecran-du-maitre', p.modele)}\\\`
(Lieux, PNJ, Moments, Annexes, Arborescence.json) et le dossier \`${win(p.racine, p.modele)}\\\` de
la campagne (Objets, Pochette, Props, PNJ, Maps, Musique, Bruitages). Garde la même organisation.
`
    : ''

  const valeurs: Record<string, string> = {
    SEANCE: p.seance,
    VERSION: p.version,
    RACINE: p.racine,
    DOSSIER_SEANCE: seance,
    DOSSIER_APP: app,
    DOSSIER_OBJETS: sous('Objets'),
    DOSSIER_POCHETTE: sous('Pochette'),
    DOSSIER_PNJ_IMAGES: sous('PNJ'),
    MODELES: modeles,
    ET_MODELES: p.modele ? ' et les modèles de la séance précédente' : '',
    STATS: liste(p.fiche.stats),
    JAUGES: liste(p.fiche.jauges),
    COMPETENCES: liste(p.fiche.competences),
    EXEMPLE_STATS: p.fiche.stats.map((s) => `${s} : 10`).join('\n') || '(la fiche n’a pas de caractéristiques)',
    EXEMPLE_JAUGES: p.fiche.jauges.map((j) => `${j} : 10 / 10`).join('\n') || '(la fiche n’a pas de jauges)',
    EXEMPLE_COMPETENCE: p.fiche.competences.length ? `${p.fiche.competences[0]} : 12` : '',
    EXEMPLE_IMAGE: relatif('Maps', 'plan.jpg'),
    EXEMPLE_OBJET: relatif('Objets', 'Lanterne de pierre miniature.png'),
    EXEMPLE_POCHETTE: relatif('Pochette', 'Lettre de 1931.png')
  }
  return modele.replace(/\r\n/g, '\n').replace(/\{\{([A-Z_]+)\}\}/g, (m, k: string) => valeurs[k] ?? m)
}
