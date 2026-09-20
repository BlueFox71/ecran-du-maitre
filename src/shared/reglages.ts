/**
 * Les réglages — ce qu'on pose une fois et qu'on ne retouche plus.
 *
 * Deux magasins, et la distinction n'est pas un détail de rangement : elle
 * décide de ce qui part avec le dossier de la campagne quand on le copie sur
 * une clé, et de ce qui reste sur la machine du maître du jeu.
 *
 *  — **la campagne** vit dans `setting`, dans la base du projet : la manière
 *    de basculer, la portée du regard, l'unité de valeur. Prête la campagne à
 *    quelqu'un d'autre, il joue avec les mêmes règles.
 *  — **le poste** vit dans `app_setting`, sous les données de l'application :
 *    le thème, le port des portables, la taille des vignettes. Ce sont des
 *    habitudes de la personne, pas de la table.
 *
 * Ce module ne connaît ni la base ni React : il sait seulement lire une pile
 * de chaînes et en faire des valeurs sûres. Les deux procédés s'en servent,
 * si bien qu'un défaut n'est jamais écrit deux fois — et qu'un réglage jamais
 * posé se comporte exactement comme avant qu'il existe.
 */
import { OUVERTURE_REGARD } from '@shared/types'
import { LARGEUR_DEFAUT } from '@shared/ouvertures'
import type { Transition } from '@shared/types'

/** Ce que la base rend : des chaînes, et rien d'autre. */
export type Brut = Record<string, string>

/* ============================================================
   La campagne
   ============================================================ */

export interface ReglagesCampagne {
  /** Fondu, volet, par le noir : la bascule armée en arrivant. */
  basculeMode: Transition
  /** Le temps que dure l'enchaînement, en millisecondes. */
  basculeMs: number
  /** L'écran de sortie choisi, ou `null` pour « le secondaire, au hasard ». */
  sortieEcran: number | null
  /** Portée du regard des cartes neuves, en part de largeur ; `null`, sans limite. */
  mursPortee: number | null
  /** De combien de degrés s'ouvre le regard d'un pion. */
  mursAngle: number
  /** Une zone éclairée reste-t-elle découverte, sur les cartes neuves ? */
  mursGarde: boolean
  /** La largeur d'usine d'une porte, en part de largeur de carte. */
  mursLargeur: number
}

export const CAMPAGNE_DEFAUT: ReglagesCampagne = {
  basculeMode: 'fondu',
  basculeMs: 800,
  sortieEcran: null,
  /* Sans limite : c'est ce que faisait l'application avant que la portée
     existe, et une campagne déjà commencée ne doit pas changer de regard. */
  mursPortee: null,
  mursAngle: OUVERTURE_REGARD,
  mursGarde: false,
  mursLargeur: LARGEUR_DEFAUT
}

export function lireCampagne(b: Brut): ReglagesCampagne {
  const mode = b['bascule.mode']
  return {
    basculeMode:
      mode === 'volet' || mode === 'noir' || mode === 'fondu' ? mode : CAMPAGNE_DEFAUT.basculeMode,
    basculeMs: nombre(b, 'bascule.ms', CAMPAGNE_DEFAUT.basculeMs, 0, 5000),
    sortieEcran: entierOuRien(b['sortie.ecran']),
    mursPortee: b['murs.portee'] ? borne(Number(b['murs.portee']), 0.02, 1.5) : null,
    mursAngle: nombre(b, 'murs.angle', CAMPAGNE_DEFAUT.mursAngle, 15, 360),
    mursGarde: oui(b, 'murs.garde', CAMPAGNE_DEFAUT.mursGarde),
    mursLargeur: nombre(b, 'murs.largeur', CAMPAGNE_DEFAUT.mursLargeur, 0.005, 0.5)
  }
}

/* ============================================================
   Le poste
   ============================================================ */

export type Theme = 'sombre' | 'clair'

export interface ReglagesPoste {
  theme: Theme
  /** Rouvrir la dernière campagne au démarrage, ou montrer l'accueil. */
  rouvrir: boolean
  /** La taille des vignettes de la bibliothèque, en pixels. */
  vignette: number
  /** Le port du serveur des portables. */
  port: number
  /** L'adresse annoncée quand ce poste en a plusieurs ; vide, on la choisit. */
  adresse: string | null
  /** Combien d'appareils un même joueur peut appairer. */
  appareils: number
}

export const POSTE_DEFAUT: ReglagesPoste = {
  theme: 'sombre',
  rouvrir: true,
  vignette: 154,
  port: 7777,
  adresse: null,
  appareils: 2
}

export function lirePoste(b: Brut): ReglagesPoste {
  return {
    theme: b['theme'] === 'clair' ? 'clair' : 'sombre',
    rouvrir: oui(b, 'demarrage.rouvrir', POSTE_DEFAUT.rouvrir),
    vignette: nombre(b, 'biblio.vignette', POSTE_DEFAUT.vignette, 90, 340),
    port: Math.round(nombre(b, 'portable.port', POSTE_DEFAUT.port, 1024, 65535)),
    adresse: b['portable.adresse']?.trim() || null,
    appareils: Math.round(nombre(b, 'portable.appareils', POSTE_DEFAUT.appareils, 1, 8))
  }
}

/* ============================================================
   Lire une chaîne sans jamais rendre une valeur folle
   ============================================================ */

const borne = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n))

function nombre(b: Brut, cle: string, defaut: number, min: number, max: number): number {
  const n = Number(b[cle])
  return b[cle] !== undefined && Number.isFinite(n) ? borne(n, min, max) : defaut
}

function oui(b: Brut, cle: string, defaut: boolean): boolean {
  const v = b[cle]
  if (v === undefined) return defaut
  return v === '1' || v === 'oui' || v === 'true'
}

function entierOuRien(v: string | undefined): number | null {
  if (!v) return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n) : null
}

/** Ce qu'on écrit en base pour un oui ou un non. */
export const enChaine = (v: boolean | number | string | null): string | null =>
  v === null ? null : typeof v === 'boolean' ? (v ? '1' : '0') : String(v)
