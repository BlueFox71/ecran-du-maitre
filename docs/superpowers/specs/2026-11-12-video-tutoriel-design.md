# Vidéo tutoriel — Écran du Maître

## Intention

Un MJ qui **découvre** l'outil regarde la vidéo et sait ensuite préparer puis mener sa
première séance. Il voit l'application en action, pas des captures fixes : la vidéo doit être
**dynamique** (demande explicite de l'utilisateur).

## Contraintes (de l'utilisateur)

- **Ne rien faire sur l'écran principal** : l'utilisateur joue en même temps avec l'application
  installée. Aucune fenêtre visible, rien sur l'écran joueurs branché, aucune prise de focus.
- Séance support : la **séance de référence dev** « Référence dev — La scierie » (id 8,
  campagne « Chasse aux fantômes »).
- C'est Claude qui pilote l'application et filme ; l'utilisateur ne fait rien.
- Vidéo **privée** ; tout le contenu de « Chasse aux fantômes » est la création de
  l'utilisateur : on filme tel quel (cartes, portraits, musiques, noms, historique de jets).
- La charge machine n'est pas un souci (l'utilisateur joue sur Switch projetée via PotPlayer) :
  captation en temps réel autorisée.

## Isolation (décision de Claude)

- La campagne réelle est `D:\Documents\JDR\Campagnes\Chasse aux fantômes` (2,5 Go), base dans
  `.ecran-du-maitre\projet.db` (WAL, ouverte par l'app installée). On n'y écrit **jamais**.
- On fabrique une **copie** dans le scratchpad : `projet.db` copiée par l'API de sauvegarde
  SQLite (lecture seule, cohérente malgré le WAL), le reste de `.ecran-du-maitre\` (lieux, PNJ,
  vignettes, arborescence), le dossier `Séance 4 - La scierie` et `Musique`. Les autres séances
  ne sont pas copiées (leurs fichiers manquent dans la bibliothèque : sans importance, la vidéo
  ne les montre pas).
- L'application tourne depuis le dépôt (build `out/`, non packagée) avec un `userData` dédié
  dans le scratchpad (`--user-data-dir` ou `app.setPath` via variable d'env), dont le
  `application.db` pointe `lastProject` vers la copie. Verrou d'instance unique distinct de
  l'app installée et de `npm run dev`.
- Serveur des portables sur un **port différent** de celui de l'app installée.
- Le code de l'application n'est **pas modifié** pour la vidéo. Tout le pilotage passe par un
  script externe (Playwright `_electron` ou CDP) qui injecte les options de fenêtre au lancement
  (hook du processus principal via `--require` / `executeJavaScript`), sans commit dans `src/`.

## Captation (décision de Claude)

- Fenêtres créées **hors écran** (`webPreferences.offscreen: true`, ou fenêtre positionnée hors
  des moniteurs et jamais affichée) : fenêtre MJ en **1920×1080 px CSS**, écran joueurs en
  1920×1080, téléphone simulé en ~390×844.
- Capture image par image (`webContents` `paint` en offscreen à 30 i/s, ou `capturePage` en
  boucle) vers des PNG, puis montage `ffmpeg` (9.0.2, installé via winget).
- Les gestes sont joués par script (clics, glisser, saisie au clavier avec `sendInputEvent` ou
  équivalent) à une vitesse humaine lisible. Un **curseur dessiné** est ajouté au montage
  (le curseur système n'est pas dans la capture).

## Forme de la vidéo

- MP4 H.264 1080p 30 i/s, **sans voix**, durée visée **6 à 8 min**.
- Cartons de titre par acte, **légendes animées** (une phrase courte, écrite pour un MJ, pas
  technique), **zooms/recadrages** sur la zone d'action, transitions courtes. Style aligné sur
  l'app (fond sombre `#0f1518`, polices Fraunces / Archivo de l'app).
- Musique de fond : optionnelle, au choix du builder, uniquement si libre de droits et présente
  localement ; sinon silence.
- Chapitres : timecodes listés dans un fichier texte à côté de la vidéo.

## Déroulé

0. **Intro** — nom de l'outil, son principe : « Tu sais toujours ce que voient tes joueurs. »
   Les trois actes annoncés.

**Acte 1 — Préparer sa séance**
1. **L'histoire** : dans la Chronologie, créer un moment (titre, note du MJ, lieu rattaché,
   document attaché) au milieu des moments existants de La scierie.
2. **Les fiches** : créer une fiche joueur, puis une fiche PNJ (portrait, caractéristiques,
   jauges ; montrer la feuille liée si disponible).
3. **Les lieux et les plans** : créer un espace → niveau → lieu, lui poser une carte, puis le mode
   annotation (repère numéroté + texte, « invisible des joueurs »).
4. **Les objets et les sons** : créer un objet (rayon, fiche), le poser dans un lieu ou un sac ;
   rattacher une ambiance sonore et un bruitage (Sonothèque / lieu / moment).

**Acte 2 — Jouer au Pupitre**
5. Écran en attente → préparer un lieu depuis l'étagère du moment → bascule (fondu) : il passe
   chez les joueurs. Placer les pions des joueurs, ajouter un PNJ, retirer des PV, lancer un son.
   Montrer en incrustation l'**écran joueurs** réel (fenêtre joueurs filmée) pour prouver
   « ce que voient les joueurs ».

**Acte 3 — Le gestionnaire de portables**
6. Avec un **téléphone simulé** filmé côte à côte : donner un objet, poser un document dans la
   Pochette puis le montrer, lancer un jet de dés, envoyer un mot secret. Le téléphone reçoit à
   l'image. *Choix de Claude* : le jet suit ce que le code permet réellement (jet lancé depuis
   le téléphone d'un joueur lié si c'est possible, sinon jet demandé/lancé côté MJ) ; le
   téléphone simulé rejoint un joueur existant de La scierie.

**Final — Les statistiques des jets de dés**
7. Module Dés : le journal et les statistiques de jets accumulés pendant la vidéo (et ceux déjà
   présents dans la base copiée). Carton de fin.

## Non-objectifs

- Pas de voix off, pas de sous-titres multilingues.
- Pas de couverture exhaustive (Régie détaillée, Éditeur, Bibliothèque, réglages) : seulement
  ce qui sert à une première séance selon le découpage de l'utilisateur.
- Aucune modification livrée du code de l'application.

## Anti-objectifs

- Toucher à la vraie campagne ou à la partie en cours (fenêtre qui surgit, son qui sort des
  haut-parleurs, port des portables pris, base modifiée).
- Une vidéo lente, faite de plans fixes et de longs textes.
- Des légendes en jargon technique.

## Laissé au builder

- Outillage exact de pilotage (Playwright vs CDP brut) et de capture.
- Bloquer le son de la copie (`audioMuted`) : **oui**, obligatoire.
- Contenus inventés pour les créations (noms de PNJ, objets) : dans le ton de « Chasse aux
  fantômes » (enquête paranormale).
- Rythme, durée exacte de chaque plan, mise en forme des légendes.

## Livrable

`tutoriel-ecran-du-maitre.mp4` + `chapitres.txt` dans le scratchpad, puis montré à
l'utilisateur. Les scripts de pilotage restent hors du dépôt (scratchpad), sauf demande.
