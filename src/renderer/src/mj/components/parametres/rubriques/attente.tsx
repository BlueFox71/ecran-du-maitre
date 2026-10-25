import { useStore } from '../../../store'
import { ChampsAttente, lireAttente, type ReglagesAttente } from '../../Attente'
import type { Reglage } from '../registre'

/* ============================================================
   Écran d'attente — « Ça commence bientôt », réglé une fois ici.
   La fenêtre de la Régie reste la commande rapide : elle part de
   ces mêmes valeurs et les réécrit au lancement.
   ============================================================ */

/** Le réglage `attente` est un seul JSON : on relit l'état frais, on y pose le patch. */
function poser(patch: Partial<ReglagesAttente>): void {
  const s = useStore.getState()
  void s.poserReglage('attente', JSON.stringify({ ...lireAttente(s.reglagesBrut['attente']), ...patch }))
}

/** Un champ de `ReglagesAttente`, rendu seul, qui écrit dès qu'il change (les textes, en quittant le champ). */
function Champ({ k }: { k: keyof ReglagesAttente }): JSX.Element {
  const brut = useStore((s) => s.reglagesBrut['attente'])
  return <ChampsAttente r={lireAttente(brut)} onChange={poser} seul={k} auBlur />
}

export const reglages: Reglage[] = [
  {
    id: 'attente.titre',
    rubrique: 'attente',
    nom: 'Titre',
    aide: 'Le grand titre de l’écran.',
    mots: ['titre', 'accueil', 'pause'],
    Cmd: () => <Champ k="titre" />
  },
  {
    id: 'attente.sousTitre',
    rubrique: 'attente',
    nom: 'Au-dessus du titre',
    aide: 'Vide : le nom de la campagne et de la séance.',
    mots: ['sous-titre', 'surtitre', 'campagne', 'séance'],
    Cmd: () => <Champ k="sousTitre" />
  },
  {
    id: 'attente.minutes',
    rubrique: 'attente',
    nom: 'Compte à rebours',
    aide: 'Il part au lancement ; à zéro, l’écran annonce « C’est l’heure ! ».',
    mots: ['minutes', 'minuteur', 'rebours', 'attente'],
    Cmd: () => <Champ k="minutes" />
  },
  {
    id: 'attente.lueurs',
    rubrique: 'attente',
    nom: 'Couleurs du fond',
    aide: 'Trois lueurs qui dérivent lentement dans le ciel. Préfère des teintes sombres : le titre reste lisible.',
    mots: ['fond', 'lueurs', 'ambiance'],
    pleine: true,
    Cmd: () => <Champ k="lueurs" />
  },
  {
    id: 'attente.musique',
    rubrique: 'attente',
    nom: 'Musique d’attente',
    aide: 'Une ambiance de la sonothèque, en boucle jusqu’à ce que l’attente quitte l’écran.',
    mots: ['musique', 'son', 'boucle'],
    Cmd: () => <Champ k="musique" />
  },
  {
    id: 'attente.emojis',
    rubrique: 'attente',
    nom: 'Émojis',
    aide: 'Ils montent doucement derrière le titre.',
    mots: ['émojis', 'emoji', 'décor', 'titre'],
    pleine: true,
    Cmd: () => <Champ k="emojis" />
  },
  {
    id: 'attente.joueurs',
    rubrique: 'attente',
    nom: 'Montrer les joueurs attendus',
    aide: 'Les joueurs présents à la séance, autour de la table.',
    mots: ['joueurs', 'table', 'présents', 'portraits'],
    Cmd: () => <Champ k="joueurs" />
  },
  {
    id: 'attente.mj',
    rubrique: 'attente',
    nom: 'Me montrer autour de la table',
    aide: 'Ton nom et ton image sont ceux de ton profil.',
    mots: ['mj', 'maître du jeu', 'profil', 'table'],
    pleine: true,
    Cmd: () => <Champ k="mj" />
  }
]
