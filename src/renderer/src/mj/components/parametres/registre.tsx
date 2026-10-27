import {
  IconAudio,
  IconClavier,
  IconDie,
  IconDoc,
  IconEye,
  IconFolder,
  IconMurs,
  IconPeople,
  IconPortable,
  IconSablier,
  IconScreen,
  IconSliders
} from '../Icons'
import { useStore } from '../../store'
import type { Cherchable } from './chercher'
import * as campagne from './rubriques/campagne'
import * as regles from './rubriques/regles'
import * as sante from './rubriques/sante'
import * as ecran from './rubriques/ecran'
import * as attente from './rubriques/attente'
import * as murs from './rubriques/murs'
import * as sons from './rubriques/sons'
import * as biblio from './rubriques/biblio'
import * as mj from './rubriques/mj'
import * as portables from './rubriques/portables'
import * as poste from './rubriques/poste'
import * as touches from './rubriques/touches'

/**
 * Le registre des réglages : chaque réglage est déclaré une fois, ici, avec
 * sa rubrique, son libellé, son aide et ses mots proches. La fenêtre des
 * paramètres le rend, la recherche le lit — les deux voient donc la même
 * chose, et un réglage ajouté se trouve sans qu'on ait à y penser.
 */

export type Rubrique =
  | 'campagne'
  | 'regles'
  | 'sante'
  | 'ecran'
  | 'attente'
  | 'murs'
  | 'sons'
  | 'mj'
  | 'portables'
  | 'poste'
  | 'biblio'
  | 'touches'

export interface InfoRubrique {
  id: Rubrique
  nom: string
  icone: JSX.Element
  /** Suit le poste plutôt que la campagne. */
  poste?: boolean
  /** La phrase de `Tete`. */
  quoi: string
  /** Ce qui précède les lignes et n'est pas un réglage (l'aperçu du profil). */
  Avant?: () => JSX.Element
  /** Ce qui suit les lignes et n'est pas un réglage (l'aparté de fin). */
  apres?: JSX.Element
}

export interface Reglage {
  /** La clé du réglage quand il en a une (`sac.capacite`), sinon un nom stable. */
  id: string
  rubrique: Rubrique
  nom: string
  aide?: string
  /** Mots proches, pour la recherche : jamais vide pour un vrai réglage. */
  mots: string[]
  pleine?: boolean
  /** Montrée seulement quand cette condition tient (sinon la ligne n'existe pas). */
  visible?: (s: ReturnType<typeof useStore.getState>) => boolean
  /** « En direct » : tenu en mémoire, perdu au redémarrage. */
  direct?: boolean
  /** Les commandes de la ligne (ou le bloc entier si `pleine`). */
  Cmd: () => JSX.Element
}

/* L'ordre compte : c'est celui de la navigation. */
export const RUBRIQUES: InfoRubrique[] = [
  {
    id: 'campagne',
    nom: 'La campagne',
    icone: <IconDoc />,
    quoi: 'Son nom, son système, le dossier où elle vit, et les joueurs qui s’y assoient.'
  },
  {
    id: 'regles',
    nom: 'Règles du jeu',
    icone: <IconDie />,
    quoi: 'Les règles que la campagne suit. Les premières étaient rangées dans un coin d’en-tête de la fiche : on ne les trouvait qu’en cherchant.'
  },
  {
    id: 'sante',
    nom: 'Santé mentale',
    icone: <IconEye />,
    quoi: 'L’assistance du Paravent pour la santé mentale : le jet, les paliers et ce qu’ils changent, la folie, les hallucinations, les pertes et les remèdes.'
  },
  {
    id: 'ecran',
    nom: 'Écran des joueurs',
    icone: <IconScreen />,
    quoi: 'Comment l’image sort et comment elle change, réglé une fois pour toutes. En dessous, ce qu’on bascule en pleine scène : vision, encart, noms et PV sous les pions, volume de l’ambiance.',
    apres: ecran.apres
  },
  {
    id: 'attente',
    nom: 'Écran d’attente',
    icone: <IconSablier />,
    quoi: 'L’écran « Ça commence bientôt », avant que la séance ne démarre.'
  },
  {
    id: 'murs',
    nom: 'Murs et lumière',
    icone: <IconMurs />,
    quoi: 'Les valeurs de départ des cartes neuves. Chaque plan garde ensuite les siennes, réglées sur place — on ne refait pas ici le travail des murs.',
    apres: murs.apres
  },
  {
    id: 'sons',
    nom: 'Sons',
    icone: <IconAudio />,
    quoi: 'Les sons posés sur les cartes : leur volume général, et s’ils se déclenchent tout seuls.'
  },
  {
    id: 'biblio',
    nom: 'Bibliothèque',
    icone: <IconFolder />,
    poste: true,
    quoi: 'Le disque fait foi. Ici, le graveur qui travaille derrière : il mesure les médias et grave leurs vignettes.'
  },
  {
    id: 'mj',
    nom: 'Le maître du jeu',
    icone: <IconPeople />,
    poste: true,
    quoi: 'Ton profil, d’une campagne à l’autre. C’est lui qui s’assoit à la table sur l’écran « Ça commence bientôt ».',
    Avant: mj.Avant
  },
  {
    id: 'portables',
    nom: 'Portables',
    icone: <IconPortable />,
    poste: true,
    quoi: 'Tout passe par le Wi-Fi de la maison — rien ne sort vers Internet. Le QR code, lui, reste en Régie : le tendre à la table est un geste de partie.'
  },
  {
    id: 'poste',
    nom: 'Le poste',
    icone: <IconSliders />,
    poste: true,
    quoi: 'Ce qui te suit d’une campagne à l’autre. Les campagnes récentes, le carnet de joueurs et le catalogue de briques sont dans le menu Campagne : ce sont des gestes, pas des réglages.'
  },
  {
    id: 'touches',
    nom: 'Raccourcis',
    icone: <IconClavier />,
    poste: true,
    quoi: 'Ils n’existaient que dans des info-bulles. En lecture seule pour l’instant — les rendre modifiables est un autre chantier.'
  }
]

export const REGLAGES: Reglage[] = [
  ...campagne.reglages,
  ...regles.reglages,
  ...sante.reglages,
  ...ecran.reglages,
  ...attente.reglages,
  ...murs.reglages,
  ...sons.reglages,
  ...biblio.reglages,
  ...mj.reglages,
  ...portables.reglages,
  ...poste.reglages,
  ...touches.reglages
]

/** Pour `chercher` : le chemin « La campagne › Règles du jeu ». */
export function cheminDe(r: Reglage): string {
  const rub = RUBRIQUES.find((x) => x.id === r.rubrique)
  if (!rub) return ''
  return `${rub.poste ? 'Le poste' : 'La campagne'} › ${rub.nom}`
}

/** Ouvre les paramètres depuis n'importe où : sur une rubrique, voire sur un réglage. */
export function ouvrirParametres(rubrique?: Rubrique, cible?: string): void {
  window.dispatchEvent(new CustomEvent('jdr:parametres', { detail: { rubrique, cible } }))
}

/**
 * Ce qui se règle ailleurs que dans les Paramètres — par carte, par lieu, par
 * séance, dans la fiche de campagne. Ce ne sont pas des lignes : la recherche
 * les trouve quand même, dit où ils vivent et, quand on peut, y emmène.
 */
export interface Ailleurs extends Cherchable {
  id: string
  /** « Se règle sur chaque carte — dans Lieux, volet Murs. » */
  ou: string
  aller?: { libelle: string; faire: () => void }
}

const SUR_CARTE = 'Se règle sur chaque carte — dans Lieux, volet Murs.'
const versLieux = {
  libelle: 'Ouvrir les Lieux',
  faire: (): void => useStore.getState().setView('places')
}
const PAR_SEANCE = 'Se règle pour chaque séance — Séance › Configurer la séance.'
const fiche = (detail: 'seance' | 'fiche') => (): void => {
  window.dispatchEvent(new CustomEvent('jdr:fiche', { detail }))
}

export const AILLEURS: Ailleurs[] = [
  { id: 'carte.portee', nom: 'Portée du regard d’une carte', mots: ['vision', 'vue', 'distance', 'murs', 'carte'], chemin: 'Ailleurs', ou: SUR_CARTE, aller: versLieux },
  { id: 'carte.zone', nom: 'Zone éclairée gardée d’une carte', mots: ['lumiere', 'eclairage', 'memoire', 'brouillard', 'carte'], chemin: 'Ailleurs', ou: SUR_CARTE, aller: versLieux },
  { id: 'carte.ouvertures', nom: 'Largeur des ouvertures d’une carte', mots: ['portes', 'fenetres', 'passages', 'murs', 'carte'], chemin: 'Ailleurs', ou: SUR_CARTE, aller: versLieux },
  { id: 'carte.soleil', nom: 'Soleil, lune et nord d’une carte', mots: ['nord', 'orientation', 'ombres', 'astre', 'jour', 'nuit', 'carte'], chemin: 'Ailleurs', ou: SUR_CARTE, aller: versLieux },
  {
    id: 'lieu.pions',
    nom: 'Taille des pions d’un lieu',
    mots: ['jetons', 'taille', 'echelle', 'lieu'],
    chemin: 'Ailleurs',
    ou: 'Se règle sur chaque lieu — en Régie, au-dessus de la ligne des pions.',
    aller: { libelle: 'Ouvrir la Régie', faire: () => useStore.getState().setView('regie') }
  },
  {
    id: 'seance.dossier',
    nom: 'Dossier de la séance',
    mots: ['dossier', 'repertoire', 'notes', 'seance'],
    chemin: 'Ailleurs',
    ou: PAR_SEANCE,
    aller: { libelle: 'Configurer la séance', faire: fiche('seance') }
  },
  {
    id: 'seance.presents',
    nom: 'Présents à la séance',
    mots: ['joueurs', 'personnages', 'presence', 'absents', 'seance'],
    chemin: 'Ailleurs',
    ou: PAR_SEANCE,
    aller: { libelle: 'Configurer la séance', faire: fiche('seance') }
  },
  {
    id: 'seance.pnj',
    nom: 'PNJ sur la ligne des pions',
    mots: ['pnj', 'figurants', 'pions', 'seance'],
    chemin: 'Ailleurs',
    ou: 'Se règle pour chaque séance — le « + » de la ligne des pions.'
  },
  {
    id: 'fiche.composition',
    nom: 'Composition de la fiche (caractéristiques, compétences, jauges)',
    mots: ['fiche', 'caracteristiques', 'competences', 'jauges', 'feuille de personnage'],
    chemin: 'Ailleurs',
    ou: 'Dans la fiche de campagne.',
    aller: { libelle: 'Ouvrir la fiche de campagne', faire: fiche('fiche') }
  }
]
