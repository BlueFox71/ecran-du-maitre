# Écran du Maître

Assistant de table pour maître de jeu. Application de bureau Windows, hors ligne, sans compte.

Le principe : **tu ne dois jamais te demander ce que voient tes joueurs.** Le moniteur en haut à
gauche montre l'écran joueurs en direct, dans tous les modules.

## Démarrer

```bash
npm install          # installe et recompile better-sqlite3 pour Electron
npm run dev          # développement, rechargement à chaud
npm run typecheck    # vérification TypeScript
npm run dist         # produit l'installeur et l'exe autonome dans dist/
npm run publier      # idem, et pousse le tout en GitHub Release
```

### Fabriquer les exécutables

`npm run dist` produit **deux fichiers** dans `dist/`, et ils ne servent pas au même usage :

| Fichier | Pour qui |
| --- | --- |
| `Ecran du Maitre-<version>-setup.exe` | l'installeur, pour une installation normale sur un poste |
| `Ecran-du-Maitre-<version>.exe` | l'**exécutable autonome**, celui que Le Grenier télécharge et lance tel quel |

Le second ne s'installe pas : il se décompresse dans le dossier temporaire au premier
lancement — comptez une bonne quinzaine de secondes cette fois-là — puis réutilise ce dossier
ensuite. Les deux écrivent leurs données au même endroit (voir « Où sont mes données »), donc
passer de l'un à l'autre ne perd rien.

**Ni l'un ni l'autre n'est signé**, et ils ne le seront pas : c'est une décision, pas un reste à faire.

Ce que ça change, une fois : au premier lancement du fichier, Windows affiche un écran bleu
« Windows a protégé votre ordinateur ». Il faut cliquer **Informations complémentaires**, puis
**Exécuter quand même**. Ce n'est pas un signe que le fichier est douteux — SmartScreen dit
seulement qu'il ne connaît pas encore l'éditeur. L'avertissement s'espace à mesure que le fichier
circule, et disparaît sur une machine où l'application est déjà installée.

### Publier une version

L'application est au catalogue du **Grenier**, le launcher maison : il lit la dernière GitHub
Release de ce dépôt, compare son tag à la version installée, et télécharge l'exécutable autonome.
Publier une version tient donc en trois gestes :

```bash
# 1. le numéro dans package.json, puis
npm run publier        # construit et crée la release (demande GH_TOKEN)
git tag v1.0.0 && git push --tags
```

Deux contraintes viennent du Grenier, et **rien ne les signale** si on les enfreint :

- l'asset doit être l'**exécutable autonome**, jamais l'installeur — d'où la cible `portable` ;
- son nom doit **porter la version**, sans espace : c'est là-dessus que le motif du catalogue
  (`^Ecran[ .-]du[ .-]Maitre[ .-][0-9][0-9.]*[.]exe$`) fait sa correspondance, et GitHub
  remplace les espaces d'un nom de fichier par des tirets à l'upload.

L'application n'a pas d'updater à elle : c'est le Grenier qui décide quand mettre à jour.

Si `better-sqlite3` refuse de se charger après une mise à jour d'Electron :

```bash
npm run rebuild
```

## Modules

| Module | Ce qu'il fait |
| --- | --- |
| **Régie** | Deux emplacements comme une table de mixage : on compose sur celui qui n'est pas diffusé, puis on bascule — en fondu, au volet, ou par le noir —, et le bouton « Couper » change l'image d'un coup quand il le faut. Dix dispositions de collage, d'une à six images sur le même écran, chacune recadrable à la molette et au glisser, et rattrapable en luminosité quand le scan est trop sombre — une vidéo aussi, exactement comme une image. Chaque case porte sa légende — le carton sous le tableau — et une case peut tenir du texte à la place d'une image : un nom, une date, une réplique. Autant de textes qu'on veut se posent par-dessus — corps, couleur, cartouche, placés à la souris. À droite, le lieu où se tient la scène puis l'arborescence du dossier en vignettes. Pions posés à la main — la molette en oriente un, le clic droit le met devant, derrière, ou le cache des joueurs —, pointeur laser, voile noir, gel, écran de sortie, ambiance sonore. Et le temps qu'il fait : pluie, vent, feu, brouillard, posés sur l'image d'un bouton. Les points de vie des joueurs s'affichent sous leur pion, et dans un encart « Joueurs » qu'on pose où l'on veut sur l'image : un visage, un cœur, et un cerveau si le gabarit a une santé mentale. Le MJ y retire ou rend des points d'un clic, sans quitter la régie. |
| **Chronologie** | Suivre la séance, pas piloter l'écran. Un moment ou un lieu à gauche, son texte en grand à droite, sur page claire : la note du MJ puis les documents attachés, prêts à être lus. Chaque moment se coche quand il est joué. |
| **Pupitre** | Le plan de travail du meneur en cours de partie : la Régie et la Chronologie sur une seule page. Le fil de la séance et son texte à gauche, l'écran des joueurs à droite. En haut à droite, l'étagère du moment : son lieu, ses images, ses vidéos, ses sons — un clic prépare, la bascule envoie ; un son part tout de suite. La grande scène prend les proportions de l'écran branché, pas un 16/9 de principe : l'image va bord à bord, et la hauteur ainsi rendue revient à l'étagère. Sous les deux visuels, la réserve de pions : les joueurs à glisser sur la scène, le `+` pour un PNJ, la taille des pions du lieu, les noms et les PV. À côté des deux visuels, l'encart Joueurs : portraits, noms et points de vie sur l'écran, avec la santé mentale si le gabarit en a une. Sous les deux cases, chaque joueur avec sa vie et sa santé mentale, à retirer ou à rendre d'un bouton — que l'encart soit montré aux joueurs ou non, parce qu'un coup encaissé se note dans tous les cas. Le journal du personnage l'enregistre. La place et la taille de l'encart, elles, se prennent à la main sur la scène : on le glisse, on tire sa poignée. Tout en bas, la source : **Lieux** — l'arborescence des espaces, niveaux et lieux, avec qui s'y tient — ou **Dossier**, le dossier de campagne en vignettes. Un clic prépare, un glisser sur la scène à l'antenne envoie tout de suite. Ce qui n'est pas rattaché au moment se prend d'un bouton dans la bibliothèque. La barre du haut porte les dispositions de collage, le pivot et la correction de luminosité. Les repères et textes annotés sur la carte du lieu s'affichent par-dessus la scène d'un bouton — chez le MJ seulement, jamais chez les joueurs ; on les pose, eux, depuis la **Régie** ou la fiche de lieu. Les textes écrits sur l'image restent à la **Régie** : ici on suit la partie et on diffuse. |
| **Bibliothèque** | Vue directe sur le dossier de campagne, dans les deux sens. Trois façons de le regarder : arborescence, grandes icônes, détails. Créer, renommer, déplacer, supprimer — tout passe par le disque. Un dossier se glisse comme un fichier, et le fil d'Ariane accepte les lâchers : c'est par lui qu'on fait remonter quelque chose d'un cran. Chaque média y est mesuré une fois pour toutes : une vidéo montre une image d'elle-même et sa durée, un son sa durée, une image ses dimensions, un PDF sa première page — et ce qu'on voit dans les vignettes, partout dans l'application, est une image gravée à 480 px, pas la carte de quatre mille pixels qu'on décoderait pour rien. |
| **Éditeur** | Traitement de texte (titres, listes, tableaux, citations) sur une page claire — on n'écrit pas dans le noir, et le document sera lu, imprimé ou diffusé comme une feuille. Chaque document est un vrai fichier `.html` du dossier. Enregistrement automatique. « Diffuser la sélection » envoie un passage aux joueurs en carte à lire. |
| **Lieux** | Un clic sur un lieu ouvre sa fiche : la carte en grand, les notes du MJ, l'ambiance, les chapitres et les documents. Le **mode annotation** y pose des repères numérotés et des textes sur la carte — « 3 — le coffre sous la latte » — que la régie peut rappeler d'un bouton et que **les joueurs ne voient jamais**. Carte, ambiance sonore et documents regroupés par lieu, rattachés à un ou plusieurs chapitres. Les lieux se rangent sur trois étages : un **espace** (le manoir) tient ses **niveaux** (les étages), qui tiennent leurs **lieux** (les pièces) — et les trois se diffusent de la même façon. Le **mode murs** y trace les cloisons invisibles : un **mur** arrête le pas et la vue, une **vitre** arrête le pas et laisse voir, un **voile** laisse passer et coupe la vue, une **porte** arrête tout tant qu'elle est fermée — et une porte **verrouillée** ne s'ouvre pas du tout : les joueurs ne passent pas tant que le MJ ne l'accorde pas. On les pose point par point le long d'une cloison, ou d'un glisser pour les quatre murs d'une pièce — **quatre traits séparés**, pour qu'une fenêtre au mur nord ne touche pas au mur sud —, avec un aimant aux bouts déjà posés et une **loupe** qui suit le curseur pour viser au pixel. « Choisir » attrape un trait, tire ses poignées, change sa nature ; **le recliquer le coupe en deux** au point visé. La **gomme** efface ce qui passe dessous — pas seulement le trait entier : on lui prend un morceau, il reste de part et d'autre, et la molette règle sa taille. **Un trait posé sur un autre prend sa place** : une vitre sur un mur perce une fenêtre, et le mur revient en deux morceaux de part et d'autre — sinon la cloison continuerait d'arrêter la vue derrière la fenêtre qu'on vient d'y mettre.  « Essayer les murs » referme toutes les portes et pose un pion d'essai qui ne traverse plus et ne voit que devant lui — la molette le tourne, et son ouverture va de 60° à tout autour. Ce qu'il n'a **jamais vu** reste noir, ce qu'il a vu et ne regarde plus reste **sombre** : on le promène, la carte se découvre derrière lui. Ouvrir une porte fait exception — elle montre la pièce derrière, entière, sans qu'on aille y marcher. Comme les repères, **les joueurs ne voient jamais ce calque** : il sert à empêcher et à calculer. Un lieu peut être masqué pour empêcher toute diffusion accidentelle. Le bloc **« Ce qu'on y trouve »** range les objets de la réserve dans la pièce, sans quitter Lieux : chacun dit s'il est « pas découvert » ou « sur place », et un bouton le fait passer dans les mains de quelqu'un le jour où les joueurs mettent la main dessus. |
| **Objets** | La réserve de la campagne : ce qui se trouve, se ramasse, se porte. **Un modèle, des exemplaires** — on décrit la lanterne une fois, puis on la pose autant de fois qu'on veut : dans un lieu, dans le butin d'un PNJ, dans le sac d'un joueur. Corriger sa description corrige tout ce qui en traîne dans la campagne. Trois colonnes : les rayons à gauche — huit familles livrées, renommables, chacune avec sa teinte et son dessin, pour qu'un objet sans photo reste reconnaissable de loin —, l'étagère au milieu, en grille ou en liste, et la fiche à droite. La fiche tient deux textes qui ne se mélangent jamais : **ce qu'on en voit**, qui peut partir dans la Pochette, et **ce que le MJ sait**, qui ne sort de l'application par aucun chemin. Elle dit aussi s'il se porte et **à quels endroits du corps** — une épée va dans l'une ou l'autre main, une bague à l'un ou l'autre doigt : on coche, on ne choisit pas —, ce qui s'épuise (six balles, quatre heures d'huile), et ses effets — des lignes libres rattachées aux caractéristiques de la campagne, jamais à un système de jeu câblé. **La valeur est un nombre** : l'unité — francs, pièces d'or, crédits — se nomme une fois dans « Réglages » et se lit en suffixe du champ, si bien que les totaux restent calculables. « Où il est » liste les exemplaires posés, avec ce que la table en sait : pas encore découvert, sur place, porté. Création en rafale, comme les lieux : un nom, Entrée. Au pied du module, **la bande des joueurs** : une colonne par joueur, ses affaires dessous, et pour chacune l'endroit du corps où il la porte — ou « inventaire » si elle ne fait que suivre. On y **glisse** une carte de l'étagère pour la lui donner, on y glisse une ligne d'une colonne à l'autre pour que l'objet change de mains, et la croix la rend à la réserve. |
| **Fiches** | La fiche tient en trois colonnes, et chacune ne répond qu’à une question. À gauche **qui il est** : son portrait en grand, son nom, son occupation, qui le mène, ses états — et pour un PNJ, ce qu’on sait de lui et ce qu’on lui prend. Au milieu **ses chiffres**, caractéristiques en tête et en grand, puis les jauges, les compétences, et le journal au pied. À droite **sa feuille**, celle que le joueur a remplie — la colonne reste même quand rien n’est lié, et propose alors de la lier. Moteur de gabarits : jauges, caractéristiques et compétences définies par le gabarit. Trois gabarits livrés (Cthulhu 7e, D&D 5e, vierge). Chaque modification de jauge est horodatée. La photo de profil se choisit dans une galerie de vignettes, le nom du joueur se modifie d'un clic, et la fiche de compétences que le joueur a remplie se lit en grand, en PDF, sans quitter l'application. Deux rayons sur la même étagère : les personnages des joueurs, et les **PNJ** — même fiche, même journal, même pion, plus un bloc de notes que les joueurs n'ont pas. Un pion nommé posé en partie reçoit une fiche d'un clic droit, sans quitter sa place. |
| **Son équipement** (onglet des Fiches) | Ce que le personnage porte, sur une **poupée** : sa silhouette au milieu, les quinze endroits du corps tout autour — tête, cou, épaules, bras et gants à gauche et à droite&nbsp;; dos, torse, ceinture, jambes, pieds&nbsp;; les deux mains sous la figure. Un clic sur une case ne propose que **ce qui va là** : on ne met pas des bottes sur la tête par mégarde. La silhouette — homme ou femme, réglée sur sa fiche à côté de sa couleur — porte **la teinte du personnage**, celle de son pion. Équiper, c'est poser : l'objet porté est un exemplaire de la réserve rangé sur lui, et vider une case ne l'efface pas, elle le fait retomber dans son sac. À droite, ce que l'équipement change — les effets des objets portés, reportés et jamais appliqués en douce — et ce qu'il traîne. **« Donner à… »** fait passer un objet d'une main à l'autre, ou le pose dans une pièce : un seul exemplaire se déplace, l'emplacement ne suit pas — ce qu'on ramasse tombe dans le sac. |
| **La Pochette** | Ce que les joueurs ont en main. Un plan, une lettre, une photo, un film y entre **en réserve** — on le prépare pendant qu’ils discutent, on le montre d’un bouton quand ils le trouvent, et il s’affiche alors sur leur téléphone — à toute la table, ou à un seul, pour la lettre que seul l’archiviste a trouvée. Le rangement se fait par onglets, facultatifs : tant qu’il n’y en a aucun, la pochette est une seule pile, ici comme sur les téléphones ; le premier onglet créé ramasse ce qui est déjà donné, et en retirer un reverse ses documents ailleurs plutôt que de les reprendre aux joueurs. Une pastille par joueur dit qui l’a **ouvert** — la seule chose que le MJ ne peut pas voir en se penchant sur la table. La bande du haut rappelle si le portable est ouvert, et l’ouvre sur place : donner dans le vide est le piège du module. Rien ne sort du Wi-Fi de la maison. Un document montré le reste jusqu’à ce qu’on le retire ou le remette en réserve, d’une séance à l’autre. Chaque carte porte un aperçu : la première page d’un PDF, un arrêt sur image d’une vidéo — et pour un PDF, le badge de la carte dit de quelle page vient l’aperçu et se clique pour en choisir une autre, quand le document commence par une couverture vide ou un sommaire. Un PDF tapoté sur le téléphone s’ouvre dans le lecteur du navigateur, en plein écran. |
| **Le sac (téléphone du joueur)** | Cinquième page du portable, à côté de la fiche, du jet, du pion et de la pochette : ce que le joueur porte, et ce qu'il traîne. Pas de poupée sur un téléphone — une liste, lue au pouce : chaque affaire porte l'endroit du corps où elle est, on la tapote, une feuille monte du bas et propose les quinze places et « dans le sac ». Une place déjà occupée dit par quoi. Il ne range **que ses affaires** : le serveur revérifie le porteur, et ce n'est pas l'interface qui en décide. Le poste du MJ suit sans qu'il touche à rien. |
| **Jets de dés** | Journal horodaté par joueur, tirage cryptographique, niveaux Cthulhu 7e, jets de groupe, jets de SAN, formules libres (`2d6+3`), export CSV. |

## Raccourcis

| Touche | Effet |
| --- | --- |
| `F5` | Ouvre / ferme l'écran joueurs |
| `Ctrl+B` | Voile noir (bascule) |
| `Ctrl+Alt+B` | Voile noir, même sans le focus sur l'application |
| `Ctrl+K` | Champ de recherche |
| `Ctrl+S` | Enregistre le document ouvert |
| `P` | Pointeur (bascule) — ou maintiens `Ctrl` le temps d'un geste |
| `Échap` | (fenêtre joueurs) rien — elle se ferme depuis le poste MJ |

## Où sont mes données

**Dans ton dossier de campagne**, celui que tu désignes à la première ouverture de la bibliothèque.
Tes cartes, tes bruitages, tes vidéos et tes documents restent des fichiers normaux, rangés comme
tu les as rangés, ouvrables sans l'application.

Le reste — ce que le système de fichiers ne sait pas porter — tient dans
`<ta campagne>\.ecran-du-maitre\projet.db` : les chapitres, les lieux, la chronologie,
les fiches, les jets, et le décor des dossiers (icône, couleur). À côté, `vignettes\` garde les
images gravées à l'examen des médias — un cache, qu'on peut effacer sans rien perdre : il se
regrave tout seul à la prochaine ouverture.

Ces attaches suivent le fichier **par son identité, pas par son nom** : renomme ou déplace un
fichier dans l'explorateur, il garde son chapitre et son lieu.

Sauvegarder une campagne, c'est donc sauvegarder le dossier : la base est dedans.

## Architecture

```
src/
  shared/types.ts        types partagés entre les trois processus
  main/                  processus principal (Node)
    index.ts             cycle de vie, fenêtres, menu, raccourcis globaux
    display.ts           état de diffusion + fenêtre joueurs + suivi des écrans
    library.ts           le dossier de campagne : lecture, écriture, surveillance
    kinds.ts             nature d'un fichier d'après son extension
    vault.ts             protocole jdr://, cantonné au dossier de campagne
    examen.ts            mesure les médias et grave leurs vignettes
                         (un PDF passe par une fenêtre photographiée : le
                          lecteur de Chromium est un greffon, un canevas n'en
                          relit rien)
    db/
      schema.ts          migrations SQL, jouées une fois et enregistrées
      seed.ts            gabarits livrés + campagne initiale
      repos/             requêtes groupées par domaine
    ipc/index.ts         tous les canaux exposés
  preload/index.ts       seule passerelle vers le système (contextBridge)
  renderer/
    index.html           poste du MJ
    player.html          écran des joueurs
    examen.html          le graveur : fenêtre cachée, décode les médias
    src/
      shared/Slide.tsx   rendu d'une diapositive, partagé par les deux fenêtres
      shared/murs.ts     géométrie des murs : le pas empêché, le champ de vision
      examen/            le graveur : mesures et vignettes, sans interface
      mj/                interface du MJ (store zustand + 7 modules)
      player/            fenêtre joueurs : reflète l'état, ne décide de rien
      styles/            jetons de design, mise en page, diapositives
outils/
  import-campagne/       traduit les documents Word d'un dossier de campagne
  icone/                 grave l'icône de l'application (.ico multi-tailles)
```

L'application lit le dossier de campagne tel qu'il est. La seule chose qu'elle
ne sait pas lire, c'est le `.docx` : `outils/import-campagne` le traduit en
document éditable. Voir son `LISEZMOI.md`.

L'icône se regrave avec `node outils/icone/graver.cjs`, qui produit un `.ico` de
sept tailles — un dessin par taille, pas une image réduite sept fois.

### Cinq décisions structurantes

**Le dossier de campagne fait foi.** L'arborescence n'est pas une invention de la base : c'est le
reflet d'un vrai dossier. L'application écrit dedans — créer, renommer, déplacer, mettre à la
corbeille — et le surveille, donc ce que tu fais dans l'explorateur remonte ici, même en pleine
partie. Un fichier déplacé est reconnu à son nom, un fichier renommé à son poids : ses
rattachements le suivent.

**L'état de diffusion vit dans le processus principal**, pas dans une fenêtre. Les deux interfaces
s'y abonnent (`display:state`). La fenêtre joueurs ne décide de rien : elle reflète. Fermer et
réouvrir l'écran joueurs ne perd donc rien.

**Rien ne part à l'écran sans qu'on le décide.** La grande surface de la régie montre l'écran
**en préparation**, pas celui des joueurs : c'est là qu'on compose. Un clic y charge une image,
arrange un pion, remplit une case de collage — les joueurs ne voient rien bouger. La bascule en
fondu envoie tout à la fois : l'image, le lieu et ses pions. L'ambiance d'un lieu est chargée
**en pause** ; on la lance quand la scène commence, pas quand on la prépare. Un bouton bascule
la surface sur « À l'écran » quand on veut voir ce que les joueurs ont sous les yeux.

**L'interface ne commente pas les gestes.** Aucune étiquette de confirmation en bas de l'écran :
ce qui a changé se voit à l'endroit où ça a changé. Seuls les ratés s'affichent.

**Les textes appartiennent à l'emplacement, pas à l'image.** On écrit une fois « Le grenier », puis
on feuillette les cartes : le cartouche reste. Il ne part qu'au bouton « Supprimer » — ou sous le
voile noir, qui couvre tout. Un écran en porte autant qu'on veut : légender trois photos d'un
collage demande trois textes, chacun avec son corps, sa couleur et sa place. Le corps est en
pourcentage de la largeur, comme les pions : le même réglage donne la même image dans le moniteur,
dans la régie et chez les joueurs.

**La Chronologie lit, elle n'écrit pas — mais elle sait où ranger.** Un moment peut *associer*
un texte déjà dans la campagne, ou s'en faire créer un : on choisit alors le dossier de rangement,
dans une liste de l'arborescence ou par l'explorateur de Windows. Un dossier hors de la campagne est
refusé — le fichier ne serait plus suivi. À droite, les **annexes** : les textes qu'on garde sous la
main du début à la fin de la séance (règles maison, fiches de PNJ, tables), un onglet chacun, un
clic pour les lire sans quitter le moment en cours. La colonne se replie quand on veut de la place.

**Une classe CSS porte un nom unique, ou elle contamine.** `over` désignait déjà la case
survolée pendant un glisser (`.cell.over`) ; l'avoir repris pour le texte posé sur l'écran faisait
hériter toute case survolée d'un `position: absolute` — elle quittait sa grille et allait flotter
ailleurs, donnant l'illusion de cases surnuméraires. Le texte s'appelle `legende` depuis. Avant
d'introduire un nom court, `grep` d'abord : c'est la deuxième collision du projet après `.place`.

**Accepter un lâcher demande deux gestes, et Chromium n'en pardonne aucun** : annuler l'événement
dès `dragenter` — sans quoi il cesse d'envoyer les `dragover` et la cible reste morte — et poser un
`dropEffect`, faute de quoi il remplace le lâcher par un `dragleave`, sans rien dire. Toute nouvelle
cible de glisser doit faire les deux.

**Les pions appartiennent au lieu, pas à l'image.** On change de carte, ils restent où ils
étaient ; on revient au lieu, ils reviennent avec leur taille. Positions et taille sont en
fractions de l'écran, donc justes quelle que soit la résolution d'en face.

**Un joueur n'est pas à deux endroits à la fois.** Son pion est unique dans toute la campagne :
le poser sur un second lieu le retire du premier, et la régie le dit en passant. La colonne des
lieux ne compte donc plus les pions — elle montre, en bout de ligne, les visages des joueurs qui
se tiennent là. Un même visage n'apparaît jamais deux fois dans la colonne.

**Une seule diapositive, trois échelles.** `Slide.tsx` sert au moniteur (5 px), à la grande
prévisualisation (15 px) et à l'écran joueurs (22 px) : tout l'intérieur est dimensionné en `em`,
seul le conteneur fixe la `font-size`. Ce que tu vois dans le moniteur est exactement ce qui est
projeté — pas une approximation.

**La couleur d'un dossier vient de son icône.** Choisir une clé, puis choisir sa couleur, c'était
deux gestes pour une seule idée — et rien ne garantissait que la clé soit dorée. Chaque dessin porte
donc sa teinte, prise aux jetons du projet, et le panneau de choix n'a plus de pastilles : on prend
une icône et sa couleur vient avec. `decorDossier()` pose deux variables CSS — l'encre et le fond —
et les cinq endroits qui dessinent un dossier s'en servent, chacun à sa façon : une pastille
derrière l'icône dans une liste, **la chemise entière** dans une tuile, comme le dossier jaune de
Windows. Un seul endroit décide de la couleur, cinq la dessinent.

Les couleurs choisies à la main avant ce changement n'ont plus d'effet, mais elles sont **réécrites
telles quelles** au lieu d'être mises à nul : elles ne servent plus, ce n'est pas une raison pour
jeter le travail de quelqu'un.

**Un PNJ est un personnage marqué, pas une table à part.** Mêmes jauges, mêmes caractéristiques,
même journal, même pion : `character.kind` vaut `pj` ou `pnj`, et c'est tout. Le coût de ce choix
est ailleurs — jusqu'ici, **tout** ce que portait cette table partait dans l'encart de l'écran des
joueurs. `listJoueurs()` est désormais la seule porte par laquelle un personnage y arrive, comme
`listPionsVus()` pour les pions : la garantie tient à la forme des données, pas à un filtre qu'on
penserait à écrire. Trois autres endroits supposaient la même chose et disent maintenant ce qu'ils
font — la liste qui attribue un personnage à une personne (un PNJ n'est mené par personne, et la
base le refuse aussi), le jet rapide (qui dit « Joueur »), et la réserve de pions, qui porte les
deux mais **range les joueurs devant** : ils sont trois, les PNJ peuvent être vingt, et ce sont les
trois qu'on cherche en pleine partie.

**Un pion nommé reçoit une fiche sans bouger.** Les pions nommés restent des pions nommés — une
torche, un garde anonyme n'ont pas besoin d'une fiche, et rien n'est converti. « Lui faire une
fiche… », dans le menu du pion, crée le PNJ et le lui attache : il garde sa place, son calque, son
angle, sa cachette, et **sa couleur**, qui n'était jusque-là qu'une déduction de son identifiant et
devient celle de la fiche pour qu'il reste le même jeton sur la carte. Le geste ne va que dans ce
sens : on ne redéfait pas une fiche en pion.

**Le bloc de notes n'existe que sur les PNJ** : ce qu'il cache, ce qui le fait céder, sa voix. Un
joueur a sa propre feuille pour ça. Il s'écrit sur fond sombre, contrairement aux pages de lecture —
ce n'est pas un texte qu'on lit à la table, c'est une antisèche qu'on consulte du coin de l'œil
pendant qu'on joue — et il n'est jamais diffusé.

**Un champ que personne ne lit est un mensonge.** `TemplateSpec.sanityGauge` existait depuis le
premier jour sans qu'aucun code ne s'en serve : deux endroits devinaient la jauge de santé mentale à
une liste de clés en dur — `san`, `sm`, `sante`, `mental` — si bien qu'une campagne appelant la
sienne « lucidité » n'avait ni cerveau dans l'encart, ni avertissement en perdant des points. La
fiche de campagne le dit maintenant, dans l'en-tête des jauges, et `jaugeSanite()` fait foi partout.
La devinette reste, en second : les campagnes écrites avant n'ont rien à ressaisir, et le choix
s'affiche comme « devinée » tant que personne ne l'a tranché. `null` dit qu'il n'y en a pas, et ce
n'est pas la même chose qu'absent — un gabarit peut vouloir qu'on cesse de chercher.

**Le temps qu'il fait est du CSS, pas une boucle de dessin.** Pluie, vent, feu et brouillard sont
des animations composées par le navigateur, en proportions du conteneur (`cqw`, `cqh`, `%`) : rien
à mettre à jour image par image, et le même résultat aux trois échelles — **le moniteur montre donc
la pluie que les joueurs ont vraiment sous les yeux**. Les grains sont semés par une suite
déterministe et non par `Math.random`, faute de quoi la pluie sauterait à chaque passage de React.
Le temps se pose **sur l'image et sous les pions** : il tombe sur la carte, pas sur les visages de
la table. Une seule chose à la fois, et le bouton qui allume est celui qui éteint.

Trois de ces quatre effets ont été refaits après les avoir regardés, ce qu'aucune relecture
n'aurait donné :
- la **pluie** était trois rideaux rayés qui descendaient — un dégradé répété. Des traits continus,
  réguliers et serrés ne font pas une averse, ils font un **moiré** : à l'écran, c'était un
  grillage. Ce sont donc des gouttes, une à une, courtes et de vitesses inégales, qui tombent droit
  dans une nappe inclinée — une averse a une seule direction ;
- le **feu** ne se voyait pas : ses dégradés étaient centrés *sous* le cadre, l'essentiel tombait
  hors de l'image et le reste se noyait dans un ciel clair. La teinte chaude porte désormais sur le
  fond entier, la lueur monte du bas, et le battement suit six respirations inégales — un feu qui
  pulse comme un métronome n'est pas un feu ;
- le **brouillard** s'évaporait : les cinq nappes partaient à des instants tirés au hasard, et il
  arrivait qu'elles soient toutes hors cadre en même temps. Leurs départs sont maintenant
  **répartis**, et un fond permanent tient sous elles.

**Un dossier se glisse comme un fichier**, et une cible qui ne peut pas l'accepter ne s'allume pas :
on le dit au survol (`dropEffect: 'none'`), pas au lâcher — une cible qui s'allume puis refuse est
une cible qui ment. Le fil d'Ariane est une cible lui aussi : c'est le seul chemin pour faire
**remonter** quelque chose, puisqu'on ne voit pas les dossiers parents depuis une vue en icônes. Le
dossier déplacé emporte son chemin et celui de tout ce qu'il contient : si l'on était dedans, on y
reste, mais à sa nouvelle adresse. Côté disque, `moveEntry` refusait bien qu'un dossier entre dans
sa **descendance**, mais pas qu'il entre dans **lui-même** — `rename(A, A/A)` remontait alors un
EINVAL de Windows, illisible.

**Une vidéo se cadre comme une image.** C'était la seule chose dans l'application qui savait
s'afficher sans savoir se recadrer : elle passe désormais par `Framed`, comme tout le reste. Le
zoom, le décalage, le quart de tour et la correction de luminosité valent donc pour elle, et il n'y
a plus deux géométries à tenir d'accord — une seule règle CSS (`.framed img, .framed video`) et un
seul calcul de transformation servent aux deux.

**Trois manières de basculer, et une coupe.** Un fondu relie deux moments, un volet en ouvre un
autre, le passage par le noir met un point — la coupe, elle, n'est pas dans cette liste : c'est le
bouton qu'on frappe quand il faut que ça s'arrête tout de suite. Le choix se fait juste au-dessus
du bouton qui l'applique, et il vit dans le magasin comme le visuel qu'on arrange : la Régie et le
Pupitre basculent de la même façon.

**L'enchaînement se joue dans la fenêtre des joueurs, et nulle part ailleurs** : elle seule tient
les deux images en même temps. Le processus principal ne fait que dire la manière et la durée. Le
volet **découpe** le calque du dessus (`clip-path`) plutôt que de le faire glisser : l'image reste
en place et se dévoile, au lieu d'entrer en scène par le côté. Le liseré qui marque l'arête est une
barre étroite qu'on avance par les mêmes proportions que la découpe — écrit d'abord comme un
dégradé plaqué sur tout le calque, il restait invisible, sa partie claire étant au bord de
l'élément et non au bord de la découpe.

**Une case de collage porte une image, ou du texte.** La case de texte existe pour ce qu'aucune
image ne dit mieux : un nom, une date, la ligne d'un télégramme, une réplique. Aller chercher un
fichier pour afficher trois mots serait une comédie. `CollageCell` est donc une union — image ou
texte — et non une structure à champs optionnels : le jour où l'on ajoute un cas, le compilateur
montre du doigt chaque endroit qui doit en tenir compte, ce qu'un champ facultatif ne fait jamais.

**La légende appartient à la case, pas à l'écran.** Elle se range au bas de sa case, la suit quand
on change de disposition, et s'en va avec elle. C'est ce qui la distingue d'un `TextOverlay`, qu'on
pose librement à la main n'importe où. Ce n'est pas non plus le sur-titre d'autrefois, retiré parce
qu'il s'affichait tout seul : celle-ci, le MJ l'écrit parce qu'il veut qu'elle soit lue.

**À une case, un collage redevient une image plein écran — sauf s'il porte plus qu'une image.**
Une case de texte n'a pas d'équivalent plein écran, et une image légendée perdrait sa légende sans
un mot. Ces deux-là restent des collages à une case.

**Le corps d'une case de texte se mesure, il ne se devine pas.** `corpsDeCase()` donne l'ordre de
grandeur d'après la longueur — trois mots sont un titre qu'on lit du fond de la pièce, trente
lignes sont une lettre qu'on lit en se penchant — mais il ne connaît pas la case : dans la colonne
étroite d'un « 3 à gauche », « Elle ne dort plus » débordait par le bas. `CaseTexte` mesure donc et
réduit jusqu'à ce que ça entre. **Même leçon que l'encart des joueurs et que `CadreAnnote` : quand
la résolution d'une unité dépend du contexte, on mesure et on calcule.** Le corps reste exprimé en
`em` de la diapositive, donc le résultat est le même aux trois échelles.

**Un pion caché n'est pas un pion qu'on s'abstient d'afficher.** Le rôdeur embusqué que le MJ pose,
suit et déplace sans que les joueurs le voient ne tient pas à un drapeau qu'on penserait à lire : il
**n'entre jamais dans `DisplayState`**. `listPionsVus()` est la seule porte par laquelle un pion
rejoint l'écran des joueurs, leur téléphone et le moniteur du rail ; `listPions()`, qui les rend
tous, ne sert qu'à la Régie et au Pupitre, où le MJ travaille. Conséquence heureuse : **le moniteur
continue de dire vrai**. Il montre ce que les joueurs ont sous les yeux, donc il ne montre pas le
rôdeur — et c'est bien ce qu'on lui demande. Vérifié : cacher un pion le retire de l'état diffusé
séance tenante, et l'état sérialisé ne contient jamais un pion caché.

**Tourner un pion veut dire deux choses.** Un **objet** — une image de la bibliothèque posée sur la
carte, un canapé, une porte — se tourne pour de vrai : son image pivote dans le jeton, qui est rond
et dont la rotation ne se verrait pas. Un **personnage**, lui, ne se penche pas : un visage incliné
ou des initiales de travers, ce n'est pas « il regarde par là », c'est une image cassée. On lui pose
donc un **nez** sur le bord du jeton — la pointe d'une figurine —, et son portrait reste droit. Rien
à 0° : un pion sans orientation n'en affiche pas. La première version faisait tourner les initiales,
et il a suffi de la regarder pour voir que c'était faux.

**La molette tourne le pion, le clic droit ouvre son menu.** Deux gestes, aucune barre d'outils de
plus sur la scène — c'est l'infobulle du pion qui les enseigne. L'écouteur de molette est posé à la
main en non passif : celui de React est passif, et un écouteur passif ne peut rien retenir. Un seul
écouteur pour tout le calque, le jeton visé se retrouvant par son `data-pion` — on n'en pose pas un
par pion. Le menu, lui, se dessine au niveau du module et non dans le calque : `.pion-layer` porte
`container-type: size`, qui fait de lui le bloc de référence de tout `position: fixed` — un menu
placé au curseur s'y serait posé de travers.

**Le calque, c'est `ord`, qui existait déjà.** « Devant », c'est prendre le plus grand du lieu et
ajouter un ; « derrière », le plus petit et retrancher un. Rien à renuméroter, et deux pions ne se
disputent jamais la même place.

**Ce que le dossier ne dit pas, un navigateur le dit.** Un fichier donne son nom, son poids et sa
date ; il ne dit ni sa durée, ni ses dimensions, ni à quoi il ressemble. Le processus principal ne
sait pas décoder une vidéo, et `ffprobe` n'a rien à faire dans une application hors ligne — alors
c'est Chromium qui regarde, dans une fenêtre cachée : *le graveur* (`examen.ts` et
`renderer/src/examen/`). Il réclame un média à la fois, relève ses mesures, saisit une image au
dixième de la durée — la première est presque toujours noire —, la rend en JPEG de 480 px, et
recommence. Il s'ouvre quand il y a du travail et se ferme quand il n'y en a plus. Trois
conséquences de méthode :
- **un échec est un résultat** : ce que Chromium ne sait pas décoder est marqué comme vu, sinon il
  reviendrait à chaque relecture du dossier ;
- **la signature porte un numéro de version du graveur** — c'est ce qui rattrape les corrections.
  La première version ne savait pas tirer sa durée d'un mp3 à débit constant ; sans ce numéro, les
  dix-neuf bruitages déjà vus l'auraient été pour toujours. Apprendre au graveur à voir quelque
  chose de plus, c'est incrémenter `VERSION` dans `examen.ts` ;
- **le protocole `jdr://` se déclare partageable** (`Access-Control-Allow-Origin`) : un canevas où
  l'on dessine l'image d'une autre origine devient teinté, et on ne peut plus rien en relire.

**Un mp3 ne connaît pas toujours sa durée.** Sans en-tête Xing, Chromium répond « l'infini » tant
qu'il n'a pas atteint la fin du fichier. Le seul moyen connu de la lui faire dire est de l'y
envoyer : `currentTime = 1e101`, puis écouter `durationchange`. Dix-huit bruitages sur dix-neuf de
la campagne d'essai sont dans ce cas.

**Le graveur est une fenêtre, cachée mais bien réelle.** S'il restait ouvert quand le MJ ferme la
sienne, Electron ne verrait jamais la dernière fenêtre se fermer et l'application ne quitterait
pas. Il se referme donc avec la fenêtre du MJ, et à chaque changement de projet — il travaille sur
la base ouverte, et ranger les mesures d'un dossier dans la campagne d'un autre serait pire que de
ne rien mesurer.

### Sécurité

`contextIsolation` actif, pas de `nodeIntegration`, CSP stricte, et les médias passent par un
protocole `jdr://` en lecture seule cantonné au dossier de campagne — un chemin qui tente d'en
sortir est refusé, en lecture comme en écriture. Supprimer, c'est envoyer à la corbeille de
Windows : l'application n'efface jamais définitivement. Aucune requête réseau : les polices sont
embarquées.

## Reste à faire

La liste est vide. Ce qui a été écarté l'a été **par décision**, pas par oubli :

- **L'installeur n'est pas signé** — choix de Jules, le 18 septembre 2026. Il n'y a donc pas de
  certificat à acheter ni à garder, et rien dans `electron-builder.yml` ne l'attend. Ce qu'il faut
  savoir en échange est dit plus haut, sous « Fabriquer l'installeur ».
- **Les pions nommés ne deviennent pas tous des PNJ** : ils restent utiles pour ce qui ne mérite pas
  de fiche, et la promotion est un geste, jamais une migration.
