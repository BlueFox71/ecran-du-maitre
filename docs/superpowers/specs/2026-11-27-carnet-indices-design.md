# Le carnet des chasseurs — entourer ou barrer indices et entités

*Conception du 27 novembre 2026.*

## L'intention

Dans Phasmophobia, le journal de l'équipe permet d'**entourer** un indice qu'on a
constaté et de **barrer** ce qu'on a écarté, et d'en faire autant avec les types
d'entités. On veut ce geste sur le téléphone de chaque joueur, pendant la partie de
« Chasse aux fantômes ».

Le carnet est un **pense-bête**, rien de plus. Les joueurs trouvent l'entité **eux-mêmes**,
en lisant le livre des fantômes (un document de la séance) et en croisant ce qu'ils ont
constaté. Le carnet ne déduit rien, ne filtre rien et ne barre rien à leur place : c'est
le cœur de la demande.

## Ce qu'on veut

- Sur le téléphone, un **onglet « Carnet »** avec deux listes : les **indices** et les
  **entités**.
- Toucher une ligne fait tourner trois états : **rien → entouré → barré → rien**.
- **Chacun son carnet.** Les marques d'un joueur sont les siennes. Il voit aussi
  celles des autres joueurs, **en faible opacité, à la couleur de leur pion** ; elles
  arrivent en direct, sans recharger.
- Les marques sont **rattachées à la séance** : une nouvelle séance part d'un carnet
  vierge. Rouvrir une séance passée retrouve ses marques ; « Repartir du début » (une
  séance dupliquée) repart vierge.
- Le MJ voit **où en sont les carnets dans l'onglet Portables du Paravent**, pour savoir
  si l'équipe est sur la bonne piste. Il ne fait que regarder.
- Les deux listes **appartiennent à la campagne** et se règlent au poste du MJ, dans les
  paramètres : ajouter, renommer, retirer, réordonner. Elles partent pré-remplies (voir
  plus bas).

## Ce qu'on ne veut pas

- **Aucune déduction automatique** : pas d'entités qui se barrent toutes seules quand on
  entoure des indices, pas de compteur « 3 indices sur 3 », pas de tableau entité ×
  indices dans l'application. Ce serait un échec même si ça « marche ».
- Pas d'indice qui donne la réponse : les signes propres à une seule entité (flammes
  soufflées, mains à six doigts…) restent dans le livre, pas dans le carnet.
- Le MJ n'écrit pas dans les carnets des joueurs.
- Pas d'écran de la table : le carnet ne s'affiche ni sur la fenêtre joueurs ni dans le
  Paravent hors de l'onglet Portables.

## Les listes de départ

Tirées du livre de la séance 5 (`Séance 5 - Le Jardin de Jade\MJ\livre_fantome - source\livre.html`),
validées par Jules le 26/11/2026. Le livre est en cours de remise en cohérence avec ces
indices, en parallèle (une autre session) : les noms ci-dessous font foi.

**Indices (12), dans cet ordre :**
EMF élevé · Spirit Box · Températures glaciales · Empreintes UV · Traces dans le sel ·
Orbes sur caméra · Écriture automatique · Planche Ouija · Voix et murmures ·
Détecteur de mouvement · Polaroïd / miroir · Objets manipulés ou lancés

**Entités (18), dans l'ordre du livre :**
Fantôme · Esprit · Poltergeist · Ombre · Revenant · Banshee · Spectre · Djinn · Yurei ·
Oni · Yokai · Hantu · Goryo · Onryo · Les Jumeaux · Obake · Deogen · Démon

« Apparition visible » et « Chute rapide de santé mentale » ont été écartés exprès : ce
ne sont pas des indices.

## Ce qui est décidé de la forme

Validé sur maquette (26/11) :

- **Mes marques** se dessinent sur le mot, à la main, un peu de travers : un cercle
  **doré** (laiton) pour entouré ; un trait **rouge** (sang) en travers pour barré, le
  mot passant en pâle. On doit le lire d'un coup d'œil, à bout de bras, dans le noir.
- **Les marques des autres** se rangent **à droite de la ligne** : une petite pastille
  par joueur, à la couleur de son pion, en faible opacité ; un cercle s'il a entouré,
  une pastille barrée s'il a barré. On ne les pose pas sur le mot, pour ne pas les
  confondre avec les siennes. Une pastille porte l'initiale (ou le portrait) du joueur.
- L'onglet **Carnet** prend place dans la barre du bas du téléphone, à côté de Fiche,
  Jet, Pion, Sac et Poche.

## Contraintes

- Le téléphone tourne dans le navigateur (Chrome ; le Samsung Internet ancien de la
  Galaxy Tab S2 ne sait pas tout faire) ; il reçoit déjà l'état par le flux SSE de
  `src/main/mobile.ts`. Attention au poids de ce flux : une marque est un petit
  événement, on n'y renvoie pas tout l'état à chaque toucher (voir la lenteur corrigée
  en 1.6.2).
- Les données vivent dans `projet.db` de la campagne ; le schéma se migre comme les
  autres (`src/main/db/schema.ts`).
- **Ctrl+Z** : les modifications des listes dans les paramètres se défont comme toute
  préparation (`src/main/defaire.ts`). Les marques des joueurs, elles, arrivent des
  téléphones par HTTP et restent **hors du Ctrl+Z**, comme les jets et la Pochette : ce
  sont des gestes de jeu, pas du MJ.
- **« Mon » carnet** : chaque téléphone est déjà attaché à un personnage (`mobile.ts`).
  Une marque est donc propre à une **séance × un personnage × un élément**. Un
  téléphone sans personnage attribué n'a pas de carnet.
- L'application sert d'autres campagnes et d'autres règles (WoW…) : un carnet vide
  n'apparaît pas. Sans aucun indice ni aucune entité dans la campagne, pas d'onglet
  Carnet sur les téléphones. Les listes de départ ne sont posées que dans les campagnes
  aux règles « chasse aux fantômes » (`src/shared/regles.ts` ; des règles jamais
  choisies comptent comme chasse) ; les autres partent vides.
- *Choix du constructeur, retenu ici :* on ne montre que les marques des personnages
  **présents à la séance** (`seance_absent`, `character_seance`) ; un absent ne pollue
  pas les carnets des autres.
- Les personnages sans pion ou sans couleur prennent la couleur que l'application leur
  donne déjà (`colorFor`).

## Ce qui est laissé au constructeur

- La forme des tables (listes de la campagne ; marques par séance, par personnage et par
  élément), la façon de pousser une marque aux autres téléphones et au poste du MJ.
- La présentation dans l'onglet Portables : par joueur, ou une grille éléments × joueurs —
  elle doit rester lisible dans la colonne du Paravent (~210 px utiles sur un écran de
  portable) ; une grille compacte n'est acceptable que si elle tient.
- La rubrique des paramètres (probablement une nouvelle rubrique à côté de
  `portables.tsx` dans `src/renderer/src/mj/components/parametres/rubriques/`), et la façon
  de pré-remplir les listes pour la campagne existante sans les imposer aux autres.
- Ce que devient une marque quand le MJ retire ou renomme un élément en cours de séance.
- Le comportement hors séance active (aucune séance en cours) : carnet visible mais
  inerte, ou masqué.
