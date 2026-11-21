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
  nomPerso: string
  race: string
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
  | { t: 'quete'; quete: { titre: string; donneur?: string; lieu?: string; texte?: string } }
  | { t: 'queteFinie'; titre: string }

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
