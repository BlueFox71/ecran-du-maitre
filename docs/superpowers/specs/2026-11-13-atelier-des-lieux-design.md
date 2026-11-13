# L'atelier des lieux — construire un plan de A à Z

*Conception validée en conversation le 13/11/2026. Ce qui est marqué « mon choix »
vient de Claude et reste à relire par l'utilisateur.*

## Pourquoi

Pour jouer, le MJ a besoin de plans. Aujourd'hui il part d'une image trouvée ailleurs,
qui colle rarement au scénario (mauvais nombre de pièces, mauvaise ambiance, filigrane),
puis il **retrace à la main** les murs, portes et fenêtres par-dessus pour que le
brouillard, la vue, les déplacements et les pièces fonctionnent.

L'atelier inverse le sens : on **construit** le lieu, et ce qu'on construit sert aux
deux à la fois, à l'image que voient les joueurs **et** au calque logique qui existe
déjà (murs, ouvertures, pièces, lumières). On ne trace plus rien deux fois.

Référence visuelle fournie par l'utilisateur : une maison hantée vue de dessus (style
« Dynamic Dungeons ») avec des murs de pierre épais, des sols variés par pièce (parquet,
damier, dalles), des meubles réalistes, des toiles d'araignée, et un éclairage localisé
orange et vert sur fond de brume.

## Direction artistique (celle de l'utilisateur)

- **Architecture détaillée** : murs épais, portes, escaliers, pièces communicantes,
  architecture crédible.
- **Mobilier réaliste** : lits, bureaux, canapés, bibliothèques, tapis, objets de
  décoration.
- **Ambiance horrifique** : éclairage localisé, ombres prononcées, brouillard, lumières
  colorées, atmosphère inquiétante.

## Objectifs

1. Construire un lieu complet **sans aucune image de départ**, de A à Z.
2. Le résultat **est** le plan du lieu : jouable tout de suite comme un plan actuel
   (brouillard, champ de vision, déplacements des pions, pièces, portes qu'on ouvre ou
   verrouille en séance, lumières, sons, objets).
3. Pouvoir **rouvrir la construction à tout moment** pour la modifier (ajouter une
   pièce, déplacer un meuble) sans rien refaire.
4. Un rendu qui **tient la comparaison** avec l'image de référence.

## Non-objectifs (v1)

- **Plusieurs étages dans une construction** : un plan = un niveau. Un escalier est un
  meuble comme un autre.
- **Partir d'une image existante pour l'enrichir** : l'atelier construit de zéro. Les
  plans faits à partir d'images restent gérés exactement comme aujourd'hui.
- Générer des assets par IA depuis l'application : les assets se génèrent hors de l'app
  (ChatGPT) avec les prompts fournis (voir « Livrable : prompts »).
- Les « apparences » (même lieu de nuit, en flammes…) pour un lieu construit : hors v1.
  *(mon choix)*

## Anti-objectifs (ce qui ferait dire « c'est raté » même si tout marche)

Proposés par Claude, l'utilisateur n'en a pas formulé lui-même :

- **Rendu « jeu vidéo des années 2000 »** : meubles qui ne semblent pas sortir du même
  univers, murs en traits plats, sols au motif répétitif visible.
- **Laborieux** : s'il faut une heure pour monter quatre pièces meublées, l'outil ne
  sert pas.
- **Régression** : un plan existant fait à partir d'une image se comporte différemment
  après la mise à jour.

## Le parcours : cinq étapes, dans l'ordre

L'ordre est celui de l'utilisateur :

1. **Sol** : on peint des surfaces avec une matière (parquet, damier, dalles, pierre,
   herbe, terre…). Le sol est une surface **libre**, peinte avant les murs : il peut
   déborder des pièces (terrasse, cour, jardin).
2. **Murs** : on trace des murs **épais** par-dessus. Ils découpent les pièces et
   deviennent les murs logiques du plan (ils arrêtent le pas et la vue). Un outil
   « pièce rectangulaire » trace quatre murs d'un coup. *(mon choix, pour la rapidité)*
3. **Portes et fenêtres** : posées **sur** un mur, comme les ouvertures actuelles. Elles
   deviennent des portes et fenêtres dessinées, et les ouvertures logiques existantes
   (une porte s'ouvre et se verrouille en séance).
4. **Déco** : meubles, tapis, objets, escaliers, toiles d'araignée… posés, tournés et
   redimensionnés librement. Chaque objet a **deux cases séparées** (choix de
   l'utilisateur) : **« bloque le passage »** (arrête les pions) et **« bloque la vue »**
   (cache ce qu'il y a derrière). Une table arrête les pions sans cacher la pièce ; une
   bibliothèque fait les deux ; un tapis ni l'un ni l'autre. Chaque asset a des valeurs
   par défaut sensées que le MJ peut changer pour chaque objet posé.
5. **Éclairage** : on pose les lumières **de l'application** (position, couleur, portée,
   allumée/éteinte). L'image construite reste neutre côté lumière : c'est l'éclairage
   vivant de l'app qui crée l'ambiance, pour qu'une lampe s'éteigne ou qu'une bougie
   s'ajoute en pleine séance. *(mon choix, proposé et non contesté)*

On peut revenir à n'importe quelle étape à tout moment ; l'ordre est celui qu'on suit
naturellement, pas un verrou.

### Grille et tracé libre

Les deux, au choix (demande de l'utilisateur) : une **grille aimantée** qu'on affiche
avec un bouton, et un **tracé libre** (désactiver la grille, ou maintenir une touche
pour passer outre momentanément). La taille d'une case suit l'échelle du plan (l'app
connaît déjà l'échelle d'un plan en mètres). *(choix de la touche et taille par défaut
laissés au builder, 1,5 m par case comme point de départ)*

## L'écran (disposition A, retenue)

- Dans **Lieux**, une entrée en sous-menu ouvre l'atelier. Un lieu construit propose
  « Modifier la construction » pour y revenir.
- **En haut** : les 5 étapes en onglets, numérotés, de gauche à droite, plus le bouton
  de grille.
- **Au centre** : le plan, avec zoom et déplacement comme l'éditeur de plan actuel.
- **À droite** : un panneau qui change selon l'étape : les matières de sol, les outils
  et matières de mur, les types de portes et fenêtres, le catalogue de meubles par
  catégories, les réglages de lampes.
- **En bas** : une barre d'état discrète (taille de case, raccourci du tracé libre,
  rappel que les murs sont actifs pour le brouillard).

Maquette de référence : `.superpowers/brainstorm/829-1794593468/content/atelier-layout.html`
(option A).

L'atelier doit avoir l'air d'un frère de l'éditeur de plan existant (`Places.tsx`) :
mêmes codes visuels, mêmes gestes quand ils existent déjà (zoom, sélection, Suppr).

## Raccord avec l'existant

C'est le point qui fait la « fusion avec les plans ». Principe : **une seule source de
vérité, la construction**, d'où l'on dérive ce que l'app sait déjà utiliser.

*Mon choix d'architecture, à confirmer par le builder s'il trouve mieux :*

- La construction d'un lieu (sols, murs, ouvertures, objets posés, avec leurs matières)
  est enregistrée dans la base, rattachée au lieu, en **fractions de la carte** comme
  tout le calque actuel.
- À l'enregistrement, l'atelier **produit une image** (PNG) du plan : sols + murs
  texturés + portes et fenêtres + objets. Elle devient la carte du lieu (`map_item_id`),
  si bien que **tout le reste de l'app** (écran des joueurs, téléphones, Paravent,
  pièces, zones) la consomme sans le savoir.
- Les murs et ouvertures de la construction **alimentent** les tables `mur` et
  `ouverture` existantes ; les objets « bloquants » y ajoutent leur emprise. Ce qui vient
  de la construction est régénéré à chaque enregistrement ; le reste du lieu (lumières,
  sons, objets de jeu, repères, pions, pièces nommées) est conservé.
- L'**état de partie** d'une porte (ouverte, verrouillée) et le **nom** d'une pièce ou
  d'une porte ne doivent pas être perdus quand on réenregistre la construction.
- Les lumières sont celles de la table `lumiere` (avec leur couleur) : l'étape 5 est un
  accès direct à elles, pas un nouveau système.
- Un lieu construit n'accepte pas qu'on remplace son image à la main (sinon la
  construction et l'image divergent). *(mon choix)*

### Précisions issues de la relecture *(toutes : mon choix)*

- **Taille du terrain.** On choisit la taille du terrain à la création, en cases (par
  défaut 30 × 20). Elle peut s'**agrandir** ensuite par n'importe quel bord. L'image ne
  se recadre jamais d'elle-même sur ce qui est construit. Quand on agrandit, l'app
  **recalcule toutes les fractions** du lieu (murs, ouvertures, lumières, sons, objets de
  jeu, repères, pions, pièces nommées et leurs zones, échelle), pour que rien ne bouge
  physiquement. Ce recalcul est testé : c'est le point le plus risqué en régression.
- **Où naît un lieu construit.** L'atelier crée un **nouveau lieu**, ou construit sur un
  lieu existant **qui n'a pas encore de carte**. Il ne remplace pas l'image d'un lieu
  qui en a déjà une (non-objectif v1).
- **Calque de murs d'un lieu construit dans l'éditeur de plan actuel.** Les murs et
  ouvertures venus de la construction y sont **verrouillés** : on les modifie dans
  l'atelier. On peut encore y ajouter **à la main** des rideaux ou des traits ; ils sont
  marqués comme « faits main » et survivent à chaque réenregistrement. L'état de partie
  (porte ouverte, verrouillée) et les noms sont conservés.
- **Emprise des objets bloquants.** Ce n'est pas un mur : c'est un **obstacle** à part,
  qui arrête le passage, la vue ou les deux selon ses cases, mais **ignoré par la détection des
  pièces** (un lit ne doit ni devenir une pièce, ni trouer la chambre). Nouvelle
  géométrie dans `src/shared`, utilisée par la Régie comme par le serveur des
  téléphones.
- **Apparences.** Masquées pour un lieu construit en v1.
- **Ordre de travail.** Le document de prompts est livré **en premier**, pour que
  l'utilisateur génère des sols et murs réels pendant que les étapes 1 et 2 se
  construisent sur des textures provisoires.

## Les assets

### Deux sources (demande de l'utilisateur : « les deux »)

- **Un pack livré avec l'application** : généré par l'utilisateur sur ChatGPT avec les
  prompts fournis, dans la direction artistique ci-dessus, intégré aux ressources de
  l'app.
- **Les imports du MJ** : chaque MJ peut ajouter ses propres images (PNG avec
  transparence pour les objets, texture pour les sols et murs), rangées dans une
  bibliothèque **commune à toutes ses campagnes**. *(mon choix)* À l'import, il choisit
  le type (sol, mur, porte, fenêtre, objet), une catégorie, la taille réelle (en cases
  ou en mètres) et s'il bloque par défaut le passage, la vue, les deux ou rien.

### Les types d'assets

| Type | Forme | Utilisation |
|---|---|---|
| Sol | texture carrée **raccordable** (sans couture) | répétée sur la surface peinte |
| Mur | texture raccordable en longueur, vue de dessus | habille l'épaisseur du mur |
| Porte, fenêtre | PNG transparent, vue de dessus | posée dans l'ouverture, à l'échelle de sa largeur |
| Objet | PNG transparent, vue de dessus | posé, tourné, redimensionné |

### Qualité du rendu (pour l'anti-objectif « années 2000 »)

À l'appréciation du builder, mais les attentes sont :

- des murs avec du **volume** (une arête supérieure plus claire, une ombre portée au sol
  le long des murs) et des angles propres aux jonctions ;
- des sols **sans motif répétitif visible** (variations de décalage ou de teinte) ;
- des objets avec une légère **ombre portée** commune, pour qu'ils s'ancrent dans le
  sol ;
- une échelle cohérente : l'asset déclare sa taille réelle, l'atelier le pose à cette
  taille par défaut.

### Livrable : prompts ChatGPT

Un document `docs/atelier/prompts-assets.md` qui donne :

- un **bloc de style commun** à coller en tête de chaque prompt (vue de dessus
  strictement orthogonale, lumière neutre et uniforme sans ombre peinte, palette sombre
  et désaturée, rendu réaliste peint, fond transparent pour les objets, texture
  raccordable pour sols et murs), pour que tout semble sortir du même jeu ;
- la **liste du pack de départ** à générer, par catégorie (sols, murs, portes et
  fenêtres, chambre, salon, bibliothèque, cuisine, salle de bain, horreur : toiles,
  taches, ossements, bougies…, escaliers), avec pour chacun un prompt et sa taille
  réelle ;
- les **contraintes techniques** de chaque type (format, résolution, transparence) et
  la façon de vérifier qu'une texture est bien raccordable.

Les prompts sont livrés **avant** l'implémentation de l'étape Déco, pour que
l'utilisateur ait des assets réels à tester. *(mon choix)*

## Laissé au builder

- La technique de rendu dans l'atelier (canvas, SVG, WebGL) et la façon de produire le
  PNG final, sa résolution (assez fine pour un écran de table et un zoom téléphone).
- Le format de stockage de la construction.
- L'outil de peinture du sol (pinceau, rectangle, remplissage de pièce…), du moment
  que peindre un sol de pièce est rapide.
- Annuler / rétablir (l'app a déjà un système `defaire`).
- Les raccourcis clavier.
- L'emplacement exact du pack d'assets dans les ressources de l'app.

## Contraintes

- Application Electron + React + SQLite existante ; suivre ses conventions (code et
  commentaires en français, géométrie partagée dans `src/shared`).
- Les murs ne sont jamais envoyés à l'écran des joueurs en tant que données (règle
  actuelle du code) : c'est l'image qui montre les murs, pas le calque.
- Mise à jour distribuée par Le Grenier : réécrire `RELEASE_NOTES.md` à la montée de
  version (voir `CLAUDE.md`).
