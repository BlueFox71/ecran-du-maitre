import type { TemplateSpec } from './types'

/**
 * Les règles de World of Warcraft — le JDR maison de la table, et son logiciel
 * de joueurs (l'« Arbre de talents », dont l'onglet **Aventure** est l'écran du
 * joueur pendant la partie).
 *
 * L'Écran du Maître ne refait pas l'Aventure : il lance son serveur, donne
 * aux joueurs l'adresse où l'ouvrir, lit l'état de leurs fiches et leur envoie
 * ce que le MJ décide (dégâts, soins, affaiblissements, le jet demandé).
 *
 * La règle des jets : **1D20 contre un score donné par le MJ — 1, 5, 10, 15
 * ou 20 —, modifié par des facteurs**. Réussite si le dé plus les facteurs
 * atteint le score. Le 20 et le 1 naturels se signalent sans changer le verdict.
 */

/** Les règles qu'une campagne peut suivre. */
export type Regles = 'fantomes' | 'wow'

export const REGLES: { id: Regles; nom: string; resume: string }[] = [
  {
    id: 'fantomes',
    nom: 'Chasse aux fantômes',
    resume:
      'Les règles de l’écran telles qu’elles sont : la fiche de campagne, les jets au d20, la santé mentale, les téléphones de l’écran.'
  },
  {
    id: 'wow',
    nom: 'World of Warcraft',
    resume:
      'Le JDR d’Azeroth : 1D20 contre la difficulté (1, 5, 10, 15, 20) et ses facteurs, classes et talents. Les joueurs jouent dans l’Aventure.'
  }
]

/** Les scores que le MJ peut demander. */
export const DDS = [1, 5, 10, 15, 20] as const

/** Les dix caractéristiques de la feuille WoW, dans l'ordre de l'Aventure. */
export const CARACS_WOW: [string, string][] = [
  ['force', 'Force'],
  ['dexterite', 'Dextérité'],
  ['intelligence', 'Intelligence'],
  ['endurance', 'Endurance'],
  ['constitution', 'Constitution'],
  ['sagesse', 'Sagesse'],
  ['perception', 'Perception'],
  ['charisme', 'Charisme'],
  ['education', 'Éducation'],
  ['discretion', 'Discrétion']
]

/**
 * La fiche de campagne aux règles WoW : PV et ressource (mana, rage ou
 * énergie selon la classe), les dix caractéristiques, ni compétences ni santé
 * mentale — les sorts et les talents vivent dans l'Aventure.
 */
export const FICHE_WOW: TemplateSpec = {
  systeme: 'wow',
  rollSystem: 'd20-plus',
  sanityGauge: null,
  gauges: [
    { key: 'pv', label: 'Points de vie', min: 0, max: 10, color: 'blood', maxEditable: true },
    { key: 'ressource', label: 'Mana / Rage / Énergie', min: 0, max: 100, color: 'azur', maxEditable: true }
  ],
  stats: CARACS_WOW.map(([key, label]) => ({ key, label, derive: 'none' as const })),
  skills: [],
  skillLimit: null,
  sansCompetences: true
}

/**
 * La fiche « chasse aux fantômes » quand on revient de WoW sans en avoir gardé
 * l'ancienne : le système maison, avec la santé mentale.
 */
export const FICHE_FANTOMES: TemplateSpec = {
  rollSystem: 'd20-plus',
  gauges: [
    { key: 'pv', label: 'Points de vie', min: 0, max: 20, color: 'blood', maxEditable: true },
    { key: 'san', label: 'Santé mentale', min: 0, max: 99, color: 'iris', maxEditable: true }
  ],
  stats: [
    { key: 'for', label: 'FOR', derive: 'mod' },
    { key: 'dex', label: 'DEX', derive: 'mod' },
    { key: 'con', label: 'CON', derive: 'mod' },
    { key: 'int', label: 'INT', derive: 'mod' },
    { key: 'sag', label: 'SAG', derive: 'mod' },
    { key: 'cha', label: 'CHA', derive: 'mod' }
  ],
  skills: [],
  skillLimit: 5
}

/** Le réglage de campagne où l'on garde la fiche d'avant WoW, pour y revenir. */
export const CLE_FICHE_AVANT_WOW = 'regles.fiche-fantomes'

/* ============================================================
   Le jet contre la difficulté
   ============================================================ */

export interface JetWow {
  de: number
  mod: number
  total: number
  dd: number | null
  /** null sans difficulté : le dé est lancé et affiché, sans verdict. */
  reussi: boolean | null
  naturel: 'vingt' | 'un' | null
}

/** Juge un D20 : réussite si le dé plus les facteurs atteint le score. */
export function jugerJet(de: number, mod: number, dd: number | null): JetWow {
  const total = de + mod
  return {
    de,
    mod,
    total,
    dd,
    reussi: dd ? total >= dd : null,
    naturel: de === 20 ? 'vingt' : de === 1 ? 'un' : null
  }
}

/* ============================================================
   Le pont avec le serveur du jeu
   ============================================================ */

export interface AuraWow {
  nom: string
  mal: boolean
  tours: number
  pile: number
  lbl: string
}

/** Ce qu'une fiche de l'Aventure publie toutes les 3 secondes. */
export interface EtatWow {
  joueur: string
  prenom: string
  nom?: string
  nomPerso: string
  race: string
  sexe?: string
  age?: string
  histoire?: string
  /** Les dix caractéristiques, valeurs totales (points, talents, objets). */
  car?: Record<string, number>
  classe: string
  classeNom: string
  niveau: number
  pv: number
  pvMax: number
  res: number
  resMax: number
  resNom: string
  resType: string
  argent?: { po?: number; pa?: number; pc?: number }
  auras: AuraWow[]
  journal: { t: string; c: string; x: string }[]
  /** Ce qu'il porte : l'emplacement (« tete », « mainD »…), le nom, la qualité (0 à 5). */
  equip?: { c: string; nom: string; q: number }[]
  /** Ce qu'il transporte dans ses sacs. */
  sacs?: { nom: string; q: number; qte: number }[]
  talents?: { nom: string; rang: number; max: number }[]
  sorts?: { nom: string; niveau: number }[]
  /** L'image que son Aventure affiche (chemin dans les Images du jeu). */
  portrait?: string
  /** Ses totaux de combat : armure, défense, initiative, et une résistance par école. */
  combat?: CombatWow
}

/** Les totaux de combat d'un personnage WoW (équipement, talents et effets compris). */
export interface CombatWow {
  armure: number
  defense: number
  initiative: number
  resist: Record<string, number>
}

/** Les six écoles de magie, et ce qu'on lit sur la fiche. */
export const ECOLES_WOW: [string, string][] = [
  ['arcane', 'Arcane'],
  ['feu', 'Feu'],
  ['nature', 'Nature'],
  ['givre', 'Givre'],
  ['ombre', 'Ombre'],
  ['sacre', 'Sacré']
]

/** Le panneau Aventure d'une fiche : ce que le personnage porte, transporte et sait. */
export interface AventureWow {
  equip: { c: string; nom: string; q: number }[]
  sacs: { nom: string; q: number; qte: number }[]
  talents: { nom: string; rang: number; max: number }[]
  sorts: { nom: string; niveau: number }[]
}

/** Les emplacements de l'Aventure, dans l'ordre de la feuille de personnage. */
export const EMPLACEMENTS_WOW: [string, string][] = [
  ['tete', 'Tête'],
  ['cou', 'Cou'],
  ['epaules', 'Épaules'],
  ['dos', 'Dos'],
  ['torse', 'Torse'],
  ['chemise', 'Chemise'],
  ['tabard', 'Tabard'],
  ['poignets', 'Poignets'],
  ['mains', 'Mains'],
  ['taille', 'Taille'],
  ['jambes', 'Jambes'],
  ['pieds', 'Pieds'],
  ['doigt1', 'Doigt'],
  ['doigt2', 'Doigt'],
  ['bijou1', 'Bijou'],
  ['bijou2', 'Bijou'],
  ['mainD', 'Main droite'],
  ['mainG', 'Main gauche'],
  ['distance', 'À distance']
]

/** Une entrée du catalogue d'objets du jeu (Donnees\catalogue-objets.json), telle que l'Écran la cherche. */
export interface CatalogueObjetWow {
  id: number
  nom: string
  qualite: number
  niveau: number
  type: string
}

/** Un joueur de la table : en ligne (son état est frais) ou seulement sa fiche sur le disque. */
export interface JoueurWow {
  /** L'identifiant de l'adresse : `?joueur=<id>`. */
  id: string
  /** Ce que l'Aventure annonce : le prénom du personnage, ou celui du joueur. */
  nom: string
  enLigne: boolean
  classe: string
  /** L'état en direct, ou ce que la fiche enregistrée en dit. */
  etat: Partial<EtatWow> | null
  /** La dernière écriture de sa fiche, ISO. */
  enregistreLe: string | null
}

export interface ServeurWow {
  /** Le dossier « Application » du jeu, s'il est trouvé. */
  dossier: string | null
  /** Pourquoi il n'est pas utilisable, en clair. */
  probleme: string | null
  lance: boolean
  /** L'Écran l'a lancé lui-même (il le referme en partant). */
  lanceParEcran: boolean
  port: number | null
  /** Les adresses des joueurs : Wi-Fi de la maison, puis Tailscale. */
  adresses: string[]
  distance: string[]
  /** Le serveur tourne mais c'est une version d'avant le pont avec l'Écran. */
  ancien: boolean
}

/** Ce que le MJ envoie dans la boîte d'un joueur. */
export type EnvoiWow =
  | { t: 'degats'; n: number; type: 'physique' | 'magique'; ecole?: string; sort?: string }
  | { t: 'soin'; n: number; sort?: string }
  | { t: 'ressource'; n: number }
  | { t: 'aura'; aura: { nom: string; desc?: string; mal: boolean; tours: number; icone?: string; lbl?: string } }
  | { t: 'retire'; nom: string }
  | { t: 'dd'; dd: number; mod: number; quoi?: string }
  | { t: 'message'; texte: string }
  | { t: 'tour' }
  /** Le MJ commence ou termine le combat (les capacités « une fois par combat » reviennent à la fin). */
  | { t: 'combat'; etat: 'debut' | 'fin' }
  | { t: 'quete'; quete: { titre: string; donneur?: string; lieu?: string; texte?: string } }
  | { t: 'queteFinie'; titre: string }
  /** Une fiche corrigée par le MJ dans l'Écran : valeurs totales. */
  | {
      t: 'fiche'
      niveau?: number
      /** Des totaux réglés par le MJ : `total.armure`, `total.resist.feu`… */
      totaux?: Record<string, number>
      /** L'image du personnage, posée sur sa fiche de l'Écran (chemin dans les Images de l'Aventure). */
      portrait?: string
      pv?: number
      res?: number
      car?: Record<string, number>
      sexe?: string
      age?: string
      histoire?: string
      argent?: ArgentWow
    }

/** La bourse de l'Aventure : pièces d'or, d'argent et de cuivre, comptées à part. */
export interface ArgentWow {
  po?: number
  pa?: number
  pc?: number
}

/** Ce que le MJ change sur la fiche d'un personnage WoW, et qui part dans son Aventure. */
export interface MajFicheWow {
  /** Le niveau : c'est la fiche de l'Écran qui le décide. */
  niveau?: number
  /** Le portrait de la fiche de l'Écran, copié dans les Images de l'Aventure. */
  portrait?: string
  /** Des totaux de combat réglés par le MJ : `total.armure`, `total.resist.feu`… */
  totaux?: Record<string, number>
  pv?: number
  res?: number
  /** Les maximums voulus par le MJ (totaux) : l'Aventure recale sa base pour y arriver. */
  pvMax?: number
  resMax?: number
  car?: Record<string, number>
  /** Hors ligne : l'écart voulu par le MJ, pour décaler les points de la fiche. */
  ecarts?: Record<string, number>
  sexe?: string
  age?: string
  histoire?: string
  argent?: ArgentWow
}

/** Un objet donné (par son id dans le catalogue) ou repris par le MJ depuis la fiche. */
export type ObjetFicheWow = { t: 'objet'; id: number; n: number } | { t: 'retireObjet'; nom: string; n: number }

/** Un effet posé ou retiré par le MJ depuis la fiche d'un personnage WoW. */
export type EffetFicheWow =
  | { t: 'aura'; aura: { nom: string; desc?: string; mal: boolean; tours: number } }
  | { t: 'retire'; nom: string }

/**
 * L'identifiant d'un joueur dans l'Aventure (son adresse ?joueur=…, le nom de
 * sa fiche dans Sauvegardes\Joueurs) : comme le `slug` du jeu.
 */
export function slugJoueurWow(nom: string): string {
  return (nom || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

/** Les pièces de l'Aventure, et leur monnaie dans l'Écran (même clé). */
export const PIECES_WOW = [
  { key: 'po', nom: 'Pièce d’or', abbr: 'po', teinte: 'or' },
  { key: 'pa', nom: 'Pièce d’argent', abbr: 'pa', teinte: 'argent' },
  { key: 'pc', nom: 'Pièce de cuivre', abbr: 'pc', teinte: 'cuivre' }
] as const

/** Un personnage créé dans l'Aventure, que le MJ doit associer à un joueur de l'Écran. */
export interface PersoAAssocier {
  characterId: number
  nom: string
  /** Le joueur WoW qui l'a créé (le prénom de son adresse ?joueur=). */
  joueurWow: string
  occupation: string | null
  /** Le joueur de l'Écran au même prénom, à proposer en premier. */
  suggestion: number | null
}

/**
 * Une quête préparée pour la campagne, que le MJ envoie au journal des joueurs.
 * Elle vit dans le dossier de la campagne : `quetes-wow.json`.
 * Le texte est **ce que les joueurs lisent** : jamais de secret du MJ.
 */
export interface QuetePreparee {
  /** « Prologue », « Acte 1 »… : pour ranger la liste. */
  acte: string
  /** ★ principale, ◆ secondaire liée, ○ secondaire libre. */
  sorte: '★' | '◆' | '○'
  titre: string
  donneur?: string
  lieu?: string
  texte?: string
}

/** L'identifiant d'un joueur, comme l'Aventure le fabrique à partir de `?joueur=` (son `slug`). */
export function idJoueur(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}
