# Arbre de talents — les 9 classes dans une seule appli

Tout l'outil tient dans ce dossier `Application`. Aucune installation, aucune
connexion. Il remplace les éditeurs séparés des dossiers Paladin et Chaman.

```
classe\
  Application\              <- l'appli, tout est là
    Lancer-le-jeu.cmd             LE bouton de démarrage (MJ et joueurs)
    Arbre-de-talents.html         l'appli elle-même
    serveur.js / serveur.py       le mini serveur local (lancé tout seul)
    LISEZMOI-detail-editeur.md    le manuel détaillé (grille, rangs, liens…)
    Images\                       toutes les icônes et tous les fonds,
                                  un dossier par classe (voir plus bas)
    Sauvegardes\                  ton travail (voir plus bas)
    Anciennes-versions\           les .html d'avant, au cas où
  Guerrier\  Mage\  Druide\ …  plus que les .ai, tes sources Illustrator
  Paladin.png  Chaman.jpg  …   les fiches de présentation des classes
```

## Démarrer

**`Application\Lancer-le-jeu.cmd`** — double-clic, et c'est tout. Une
fenêtre noire s'ouvre (le serveur local, **à laisser ouverte**) puis le navigateur.

Il n'y a qu'**un seul lanceur**, pour préparer seul comme pour jouer avec la
table : la fenêtre noire affiche à la fois l'adresse de ton PC et celle que les
joueurs tapent sur leur tablette. Relancé alors qu'il tourne déjà, il se
contente de rouvrir l'appli, sans démarrer un second serveur.

Windows Terminal, réglé pour rouvrir les onglets de la dernière fois, relançait
le lanceur une seconde fois (deux fenêtres noires, deux onglets). Depuis le
12/10/2026, le lanceur ignore un onglet restauré, et c'est le serveur qui ouvre
le navigateur une fois démarré : même si deux lancements se croisent, un seul
onglet s'ouvre et la fenêtre en trop se referme seule.

**Deux fenêtres de l'appli ?** C'est Chrome qui rouvre tout seul les onglets
d'avant (après un plantage, ou avec « Continuer là où vous en étiez »), en plus
de celui du lanceur. L'appli le repère : la deuxième affiche **« L'appli est
déjà ouverte »** et ne sauvegarde rien. Ferme-la, ou clique **Continuer dans
cette fenêtre** : l'autre sauvegarde puis se met en pause. Une seule fenêtre
écrit à la fois, donc elles ne peuvent pas s'écraser.

C'est la seule façon d'avoir la **sauvegarde dans `Sauvegardes\`**, la **galerie
d'images vivante** (`Images\`) et l'**export PNG** : un navigateur qui ouvre un
fichier en direct n'a le droit ni de lire un dossier, ni d'écrire sur le disque,
ni de fabriquer une image.

Le double-clic direct sur `Arbre-de-talents.html` marche toujours — les 9 arbres
et la liste des images sont embarqués dans le fichier — mais le travail ne sort
plus du navigateur.
L'appli le dit : la pastille en haut à droite affiche alors **navigateur seul**
au lieu de **Sauvegardes\ ✔**.

## Jouer sur tablette ou téléphone

Chaque joueur a son PC, sa tablette ou son téléphone. Un PC peut lancer l'appli
lui-même (comme ci-dessus) ; **une tablette ou un téléphone, non** : ils
l'ouvrent depuis **ton PC**, par le Wi-Fi de la maison.

1. Sur ton PC, double-clic sur **`Application\Lancer-le-jeu.cmd`**.
   La fenêtre noire affiche, sous **POUR LES JOUEURS**, l'adresse à taper, par exemple
   `http://192.168.1.87:8730/Application/Arbre-de-talents.html`.
2. La **première fois**, Windows demande l'autorisation du pare-feu :
   coche **Réseaux privés** et accepte. Sinon les tablettes ne verront rien.
3. Sur chaque tablette ou téléphone, **connecté au même Wi-Fi**, ouvre cette
   adresse dans le navigateur, en ajoutant le prénom du joueur et sa classe :
   `…/Arbre-de-talents.html?joueur=marie&classe=mage`. Ajoute-la à l'écran
   d'accueil : elle s'ouvrira d'un geste.

La pastille en haut à droite affiche alors **Sauvegardes\ ✔ · Marie** ; sur
ton PC, **Sauvegardes\ ✔ · table**, et un clic dessus redonne l'adresse, pour
la dicter.

### Une fiche par joueur

Avec `?joueur=marie`, l'appli ouvre **la fiche de Marie** : son niveau, ses
talents, ses sorts, ses métiers, ses sacs. Deux joueurs peuvent donc jouer la
**même classe** : chacun a sa fiche.

- **La classe est retenue.** Sans `&classe=…` dans l'adresse, le joueur passe
  la première fois par la **création de personnage** (race et classe, voir plus
  bas), puis l'appli s'en souvient. Le menu des classes
  disparaît : un joueur ne peut pas ouvrir le personnage d'un autre.
- **L'arbre reste le tien.** Le joueur lit l'arbre et le grimoire de sa classe
  tels que tu les as construits ; il ne les modifie pas (pas d'onglet
  **Édition**), et ce qu'il changerait au Grimoire n'est pas gardé.
- **Première ouverture** : le joueur reprend la fiche que la classe portait
  jusqu'ici, pour ne pas repartir de zéro. Ensuite, sa fiche vit sa vie.
- **Pour voir la fiche d'un joueur** sur ton PC, ouvre
  `http://127.0.0.1:8730/Application/Arbre-de-talents.html?joueur=marie`
  dans un autre onglet : il ne gêne pas celui de ton arbre.

**Où vont les fiches ?** Toutes sur ton PC : `Sauvegardes\Joueurs\marie.json`,
écrite toute seule à chaque changement ; **Ctrl+S** en garde une copie datée
dans `Sauvegardes\Joueurs\Historique\`. Pense à sauvegarder
`Sauvegardes\Joueurs\` avec `Permanent\`. La fenêtre noire doit rester ouverte
pendant la partie. Deux appareils ne doivent pas ouvrir **le même joueur** en
même temps : ils écriraient la même fiche.

Le lanceur ouvre toujours l'appli au Wi-Fi de la maison. Sur un réseau public
(gare, hôtel, café), ne le lance pas : n'importe qui sur ce réseau pourrait
ouvrir l'appli. Les deux anciens lanceurs (`Lancer-arbre-de-talents.cmd` et
`Lancer-pour-la-table.cmd`) sont rangés dans `Anciennes-versions\` : les ouvrir
tous les deux ensemble lançait l'appli deux fois.

### Jouer à distance (pas sur le même Wi-Fi)

L'appli reste sur ton PC ; **Tailscale** (gratuit) relie les appareils de la
table entre eux, où qu'ils soient (4G, chez eux…), et personne d'autre ne peut
entrer.

1. Installe **Tailscale** sur ton PC (tailscale.com/download) et connecte-toi
   (compte Google, Microsoft…).
2. Chaque joueur installe l'appli **Tailscale** sur sa tablette ou son
   téléphone. Invite-le dans ton réseau : console Tailscale → **Users** →
   **Invite users**, ou **partage** juste ton PC (bouton *Share* sur ta machine).
3. Lance `Lancer-le-jeu.cmd` comme d'habitude. La fenêtre noire affiche,
   sous **A DISTANCE**, une adresse en `http://100.….:8730/…` : c'est celle des
   joueurs à distance. Elle ne change pas d'une partie à l'autre — mets-la à
   l'écran d'accueil une fois pour toutes.

Le clic sur la pastille donne aussi cette adresse. Le PC doit rester allumé,
la fenêtre noire ouverte, et Tailscale actif sur les deux appareils.

### Au doigt

| | Souris | Doigt |
|---|---|---|
| lancer un sort, utiliser un objet | clic | toucher |
| prendre / poser un objet | clic, puis clic | toucher, puis toucher (un rappel s'affiche en haut) |
| déplacer | glisser | glisser |
| lire l'info-bulle | survol | **appui long** |
| équiper, modifier, jeter… | clic droit | **appui long** (le menu sous l'info-bulle) |
| mettre un sort dans une barre | glisser | glisser, ou appui long → *Mettre dans une barre* |
| **arbre de talents** : lire / +1 / −1 | survol / clic / clic droit | toucher / toucher encore / appui long |
| zoomer dans l'arbre | molette | pincer à deux doigts |

Sur un **téléphone**, l'écran se range autrement : les fenêtres prennent tout
l'écran au-dessus de la barre d'action, qui montre **une barre à la fois**
(la flèche **▲1▼** passe à l'autre), et le panneau de droite des autres onglets
passe sous le contenu. Sur une **tablette**, tout reste comme sur PC, avec des
boutons plus grands, et les fenêtres restent dans l'écran.

**Pas d'Édition au doigt.** Sur un téléphone ou une tablette, l'onglet
**Édition** n'apparaît pas : l'appli s'ouvre sur **Jeu**. L'arbre se construit
sur un PC (souris ou pavé tactile).

## Où va ton travail

Un seul endroit : **`Application\Sauvegardes\`**.

| | |
|---|---|
| `Temporaire\<classe>.json` | écrit **tout seul**, une seconde après chaque changement. Le filet : il est écrasé en permanence. |
| `Permanent\<classe>.json` | écrit quand tu cliques **Enregistrer** (Ctrl+S). Ta copie de référence, l'appli ne l'écrase jamais toute seule. |
| `Permanent\Historique\` | une copie **datée** à chaque Enregistrer, jamais écrasée. |
| `Joueurs\<prénom>.json` | la fiche d'un joueur (`?joueur=…`), écrite **toute seule** à chaque changement ; `Joueurs\Historique\` en garde une copie datée à chaque Ctrl+S. |

Au démarrage, l'appli compare ces fichiers avec ce que le navigateur garde de
son côté, **prend la plus récente** des copies et te dit laquelle dans le bandeau
du bas. Le stockage du navigateur continue de tout recevoir en double : il ne
coûte rien et sert de second filet.

À sauvegarder sur une clé ou dans un cloud : **`Sauvegardes\Permanent\`** et
**`Sauvegardes\Joueurs\`**.
Rien d'autre n'est irremplaçable.

Pour revenir en arrière : prends le fichier daté qui va bien dans
`Permanent\Historique\` et ouvre-le avec le bouton **Ouvrir…**.

Si la pastille passe au rouge (**écriture bloquée**), la fenêtre noire du serveur
a été fermée : ton travail est encore dans le navigateur, relance le `.cmd`.

## Changer de classe

La liste déroulante en haut à gauche, à côté du titre. Les classes suivies de
**« (à faire) »** n'ont pas encore d'arbre relevé.

Un raccourci peut viser une classe directement :
`Application\Arbre-de-talents.html?classe=chaman`
(identifiants : `guerrier`, `paladin`, `chasseur`, `voleur`, `pretre`, `chaman`,
`mage`, `demoniste`, `druide`).

## Une classe = un personnage

Chaque classe a **son arbre et sa fiche de perso** : son niveau, ses points
dépensés, ses sorts débloqués. Changer de classe range la précédente et ouvre la
suivante là où tu l'avais laissée. Rien n'est partagé entre deux classes.

Tout part dans `Sauvegardes\Temporaire\` classe par classe, sans rien demander.
Pense quand même à **Enregistrer** (Ctrl+S) en fin de séance : c'est ce qui
remplit `Permanent\`, le seul dossier que l'appli n'écrase jamais.

## La création de personnage

Le bouton **Création**, à côté de la liste des classes, ouvre l'écran de
création en pleine page, comme dans WoW : les **races** à gauche (Alliance et
Horde), les **classes** à droite, l'illustration au centre, le sexe, le prénom,
le nom et le bouton **Créer** en bas. Sous les icônes, les panneaux donnent
l'histoire et les traits de la race, et le rôle, la ressource, l'armure et les
trois voies de la classe. Une race qui ne peut pas jouer la classe choisie est
grisée, et inversement.

Les **caractéristiques de départ** sont propres à chaque **combinaison
race-classe** : il n'y a pas de bonus ni de malus de race ou de classe qui
s'additionnent. Un Orc guerrier et un Orc chaman ont chacun leur tableau.
**Créer** les écrit dans la fiche du personnage (colonne « Point »), avec la
race, le prénom, le nom et le sexe. Si la fiche avait déjà une race ou des
caractéristiques, l'appli demande avant de les remplacer. La « Valeur dé »
n'est pas touchée.

**Les illustrations** se déposent dans `Application\Images\illustrations\`, nommées
selon la combinaison : `orc-guerrier.jpg`, `orc-guerrier-femme.png`… Sans image
pour la combinaison, l'écran prend celle de la race, puis de la classe, puis le
fond de l'arbre de la classe. Le `LISEZMOI.txt` du dossier donne l'ordre complet
et les 57 noms possibles. En tant que MJ, l'écran signale la combinaison qui n'a
pas encore son image.

Un **joueur** qui ouvre l'appli pour la première fois (`?joueur=marie` sans
fiche) arrive directement sur cet écran, sans pouvoir le fermer : il lui faut un
personnage.

**Corriger les textes et les chiffres** : en tant que MJ, bouton **Modifier** en
haut de l'écran. Les histoires, les traits (un par ligne), les rôles, les voies,
les classes jouables (cases à cocher) et les dix caractéristiques de la
combinaison affichée deviennent modifiables. **Terminer les corrections**
les enregistre dans `Sauvegardes\creation.json`, qui passe avant les textes
d'origine. Pour tout remettre comme au départ, supprime ce fichier.

**Les effets de l'illustration** : en Modifier, bouton **Effets**. Les panneaux
s'effacent et l'éditeur s'ouvre à droite.

| Geste | Effet |
|---|---|
| « Ajouter un effet », puis un clic sur l'image | l'effet en un point (flammes au bout d'une torche, lueur) |
| « Ajouter un effet », puis glisser | une ligne (fumée le long d'une lame, éclair, deux yeux) ou une zone (brume, lucioles) |
| clic sur un repère | le régler : forme, texture, couleurs (début et fin de vie), rendu lumineux ou opaque, et les curseurs (quantité, taille, vitesse, durée de vie, direction, dispersion, gravité, vent, ondulation, taille à la fin, opacité, scintillement, rotation) |
| glisser un repère / un de ses bouts | le déplacer / allonger la ligne ou la zone |
| Dupliquer, Supprimer (ou Suppr) | |
| Copier, puis Coller sur une autre image | reprendre les mêmes effets |
| Échap | lâcher l'effet en main, puis fermer l'éditeur |

La bibliothèque compte 40 effets : flammes, brasier, gangrefeu, flammes
d'ombre, braises, étincelles, fumées, brume, brouillard au sol, souffle de
givre, ombres, neige, pluie, cendres, feuilles, pétales, lucioles, poussière
dorée, étoiles, orbes, arcanes, cercle de runes, givre, arcs électriques,
éclair, lumière sacrée, rayons de soleil, colonne de lumière, lueur, yeux
luisants, aura, tourbillon, portail, entailles, débris, sang, poison, bulles,
cœurs. Ses textures sont le *Particle Pack* de Kenney (libre de droits, CC0),
dans `Images\effets\`. Les effets suivent l'image (cadrage, taille de
fenêtre) et s'enregistrent avec **Terminer les corrections**, dans
`Sauvegardes\creation.json`. Le simulateur les montre aussi.

## Où vivent les images

**Un seul endroit : `Application\Images\`, un dossier par classe.**

```
Application\Images\
  guerrier\   50 images        chaman\     79 images
  paladin\    86 images        mage\       88 images
  chasseur\   42 images        demoniste\  45 images
  voleur\     68 images        druide\     52 images
  pretre\     94 images
```

Icônes de talent, icônes de sort, illustrations de fond, relevés des arbres
d'origine : tout est là, mélangé, et l'appli pioche dedans. Un talent ne retient
que le **nom du fichier** — `spell_holy_purify.jpg` — et l'appli va le chercher
dans le dossier de la classe affichée.

### Ajouter une image

Deux façons, qui reviennent au même :

- **Depuis l'appli** : *Importer une image…* dans la galerie. Le fichier est
  **copié dans `Images\<classe>\`** et entre aussitôt dans la galerie de cette
  classe. Il resservira pour tous les arbres suivants.
- **Depuis l'explorateur** : dépose le `.jpg` dans `Application\Images\<classe>\`.
  Rien d'autre à faire, **aucune liste à tenir à jour** : l'appli relit le
  dossier à chaque ouverture de la galerie. Rouvre le sélecteur, l'image est là.

Formats acceptés : `.jpg` `.jpeg` `.png` `.webp` `.gif` `.bmp`.

### Emprunter l'icône d'une autre classe

La galerie s'ouvre sur la classe affichée. Le bouton **Toutes** à côté du titre
montre les images des neuf classes d'un coup ; celles qui ne sont pas de la
classe courante portent son nom dans le coin. Quand tu en choisis une, le talent
retient `pretre/spell_holy_heal.jpg` — le fichier reste chez le Prêtre, il n'est
pas recopié.

### Sans le serveur local

En double-clic direct sur le `.html`, le navigateur n'a pas le droit de lire un
dossier ni d'y écrire. L'appli retombe alors sur la **liste des images embarquée
dans le `.html`**, figée au dernier rangement, et une image importée repart
**intégrée au `.json`** comme avant — elle marche, mais elle n'entre pas dans la
galerie. Passe par `Lancer-le-jeu.cmd` pour retrouver le vrai dossier.

### Ce que le `.json` retient

Toujours **le nom du fichier, pas l'image**. Conséquence : **le `.json` retient
sa classe**. Ouvrir un `.json` de Paladin alors que le Chaman est affiché bascule
automatiquement sur le Paladin, sinon les icônes iraient chercher dans le mauvais
dossier.

| Classe | Images | Arbre |
|---|---|---|
| Guerrier | 50 | à faire |
| Paladin | 86 | **102 talents, 120 liens** |
| Chasseur | 42 | à faire |
| Voleur | 68 | **101 talents, 120 liens** |
| Prêtre | 94 | démo en cours |
| Chaman | 79 | **80 talents, 95 liens** |
| Mage | 88 | **96 talents, 113 liens** |
| Démoniste | 45 | à faire |
| Druide | 52 | à faire |

## La fiche du sort

Tes descriptions suivent toutes le même moule : une prose, une ligne vide, puis
le bloc chiffré. Sur les 214 talents et sorts déjà écrits, on trouve **79 fois
`Jet`, 71 `Mana`, 63 `Portée`, 29 `Dégâts`**, presque toujours dans cet ordre :

```
Lance une boule de lave qui inflige des dégâts à distance.

Jet : Intelligence
Dégâts : 1D10 dégâts Magique (Feu)
Portée : 30M
Mana : 16
```

Sous la description, le panneau de droite propose maintenant **ces champs
directement** — pour un talent de l'arbre comme pour un sort du grimoire :

| Champ | Ce que ça t'évite |
|---|---|
| **Jet** | une liste des 8 caractéristiques — c'est `Sagesse` 48 fois sur 79 |
| **Dégâts** | trois listes (dé / physique-magique / école) qui composent `1D6 dégâts magique (Nature)`, puis tu complètes à la main si besoin |
| **Soins** | une liste de dés qui écrit `1D6 PV` |
| **Portée** | tes valeurs habituelles proposées à la frappe (`10M`, `20M`, `Allonge`…) |
| **Mana / Coût** | le libellé suit la classe, et les charges de puissance sacrée sont proposées |
| **PV** | pour les invocations |

Le texte reste maître : la zone de description est toujours là, modifiable à la
main, et les champs ne font que réécrire le bloc du bas. **Tout ce qui n'est pas
une étiquette connue reste dans la prose, mot pour mot** — vérifié en relisant
puis réécrivant tes 158 descriptions non vides : 136 ressortent au caractère
près, 22 sont normalisées (`Dégats` → `Dégâts`, `mana` → `Mana`, ordre remis),
**aucune ne perd quoi que ce soit**.

### La ressource

`Mana` par défaut, **`Rage` pour le Guerrier, `Énergie` pour le Voleur**. Ça se
change dans le panneau de l'arbre, quand rien n'est sélectionné.

## Les talents « Amélioration de… »

45 de tes talents suivent ce moule, **sans une seule exception** : titre
`Amélioration de <talent>`, l'icône du talent amélioré, forme ronde (chez toi le
rond est le passif, le carré la compétence active), un seul rang.

Le bouton **`+ Amélioration`** de la barre d'outils le fabrique d'un coup :

1. il liste les talents de l'arbre, filtrables, en montrant le nom qui sortira ;
2. tu en choisis un ;
3. le talent est créé sous celui-ci, avec **son icône**, rond, 1 rang — et son
   titre est sélectionné pour que tu enchaînes sur l'effet.

**Aucun lien n'est tracé** : une amélioration ne pend pas forcément au talent
qu'elle améliore, c'est à toi de décider. La touche `L` puis les deux icônes
relient, comme pour n'importe quel talent.

L'élision est gérée : `Amélioration de Marteau divin`, mais
`Amélioration d'esprit Farouche` et `Amélioration d'éclair`.

Les améliorations ne sont pas proposées à l'amélioration.

## Le texte à côté des talents

Il va **à droite**, toujours, pour tout talent nouvellement créé — à la main,
par duplication du réglage par défaut, ou par `+ Amélioration`.

Si tu en as déplacé à la main, le panneau de l'arbre (rien de sélectionné)
affiche un bouton **« Remettre les N textes à droite »**, qui ne montre que le
nombre réellement concerné. `Ctrl+Z` annule.

## Les couleurs

**Chaque classe a la sienne** (celles de WoW : le Chaman en bleu, le Druide en
orange, le Guerrier en brun…). Un arbre qui n'a pas reçu de consigne la prend.

Avant, la **bordure** d'un talent sans couleur propre retombait sur un rose codé
en dur pendant que son **lien** suivait la couleur de l'arbre : les deux ne
s'accordaient jamais, et la pastille du panneau proposait ce rose quelle que soit
la classe. Les deux suivent désormais la même couleur, dans l'appli comme dans
les exports SVG et PNG.

Le panneau de l'arbre (rien de sélectionné) donne la couleur par défaut, plus un
bouton **« Couleur du &lt;classe&gt; »** qui efface la consigne et rend la main à
la classe. Une couleur choisie pour un arbre **gagne toujours** : ton Chaman
reste en `#fe5d06` et ton Paladin en `#ffd500`.

### Bordures et liens, séparément

Deux réglages distincts dans ce panneau : **Couleur des bordures** et **Couleur
des liens**. Tant que la seconde n'est pas touchée, chaque lien **suit la bordure
de son talent parent** — pratique pour colorier une branche entière d'un coup.
Dès qu'on lui donne une couleur, les liens s'en tiennent à elle et ne suivent
plus les bordures ; le bouton **« Suivre les bordures »** revient en arrière.

La couleur d'un lien se décide donc en quatre temps, du plus fort au plus faible :

1. la couleur propre du lien (panneau du lien) ;
2. la couleur de liens de l'arbre, si elle est réglée ;
3. la bordure de son talent parent ;
4. la couleur de bordure par défaut de l'arbre.

## Les classes « à faire »

Elles s'ouvrent sur une **toile vide, avec leur arbre d'origine en calque** à 55 %
d'opacité et à la bonne taille. Il n'y a plus qu'à poser les talents par-dessus :
double-clic sur le fond pour en créer un, `L` puis deux icônes pour les relier.

Le calque se règle (ou s'enlève) dans le panneau de droite, section **Fond**, quand
rien n'est sélectionné.

## Changer de mode

Les cinq modes sont des **onglets**, en haut à gauche à côté de la classe :

| | | |
|---|---|---|
| ✎ **Édition** | touche `1` | construire l'arbre |
| ▶ **Jeu** | touche `2` | monter les talents du personnage |
| ✦ **Grimoire** | touche `3` | les sorts et compétences |
| ⚒ **Métiers** | touche `4` | l'artisanat |
| ⚔ **Aventure** | touche `5` | l'écran du joueur, façon WoW Classic |

Un clic (ou une touche) suffit pour aller de n'importe lequel à n'importe lequel :
plus besoin de faire le tour. L'onglet allumé dit toujours où l'on est, et les
deux traits de séparation rappellent les deux familles — l'**arbre** à gauche, la
**fiche de perso** à droite.

La barre d'outils suit : elle ne montre que ce qui sert au mode affiché. Au
Grimoire et aux Métiers, les outils de dessin, la grille et les exports d'image
s'effacent au lieu de rester grisés ; *Ouvrir*, *Enregistrer* et *Imprimer*
restent toujours là.

**Le mode est retenu classe par classe.** Quitter le Paladin au Grimoire, c'est
le retrouver au Grimoire en le rouvrant, comme son arbre et sa fiche.

## Les métiers

Le quatrième onglet, après le Grimoire.

Comme le Grimoire, il appartient au personnage : chaque classe a ses métiers, son
sac et ses créations. Tout part dans le `.json` avec le reste de la fiche.

### Le principe

Pas de compétence de 1 à 300 comme dans WoW : **six paliers** (Apprenti,
Compagnon, Expert, Artisan, Maître, Grand Maître) et **un seul jet de D20** par
objet créé.

```
1D20 + palier + caractéristique  (+2 si la recette est de votre spécialisation)
```

| Résultat | Effet |
|---|---|
| 1 naturel | Rebut : tout est perdu |
| Sous le DD | Échec — les essences et les gemmes ne sont pas consommées |
| DD à DD+4 | Objet ordinaire |
| DD+5 à DD+9 | **De qualité** : +1 à sa meilleure caractéristique, à l'armure, aux dégâts ; une potion ou un plat de plus |
| DD+10, ou un 20 naturel | **Chef-d'œuvre** : +1 à toutes ses caractéristiques, une couleur de plus ; deux potions ou plats de plus |

Le DD monte de 2 par rang (10, 12, 14, 16, 18) pendant que le palier en donne 1 :
une recette « à votre mesure » reste autour de 60 % de réussite du rang I au
rang V, au lieu de devenir injouable en fin de course.

### Monter de palier

La **coche** remplace le *skill up*. Une création réussie en donne une, sauf si la
recette est **grise**. La couleur se lit sur l'écart entre le rang de la recette
et votre palier :

| | |
|---|---|
| **Orange** | un rang au-dessus de votre palier |
| **Jaune** | pile à votre palier |
| **Vert** | un rang derrière vous |
| **Gris** | deux rangs derrière : plus aucune coche |

Le palier suivant demande les coches **et** le niveau : 20 pour Compagnon, 30
pour Expert, 40 pour Artisan, 50 pour Maître, 60 pour Grand Maître. Arrivé au
plafond, on ne gagne plus de coche : comme dans WoW, il faut aller **payer un
formateur** (bouton sur la carte du métier).

### Les formateurs : tout se paie

L'argent est celui des sacs de l'Aventure.

| | |
|---|---|
| Apprendre un métier (Apprenti) | 10 pc |
| Compagnon | 5 pa |
| Expert | 1 po |
| Artisan | 5 po |
| Maître | 10 po |
| Grand Maître | 35 po |

Apprendre un métier donne aussi ses premières recettes de l'atelier. Les autres
recettes **blanches** s'achètent une par une chez le formateur : le prix suit le
niveau de l'objet (10 pc pour un objet de niveau 1, 2 pa 50 au niveau 7, 20 pa au niveau 20,
1 po au niveau 45, près de 2 po au niveau 60). Une recette **rare** (verte ou
bleue) s'achète trois fois plus cher chez un marchand, ou se prend gratuitement
avec le bouton *Trouvée* quand elle vient d'un butin, d'une quête ou du MJ.
On ne peut pas apprendre une recette hors de portée de son palier. Abandonner un
métier fait perdre ses recettes : le réapprendre se paie de nouveau.

Les fiches d'avant les formateurs gardent, sans rien payer, les recettes blanches
qu'elles connaissaient déjà.

### Les trois vues

**Atelier** — vos métiers en onglets. Deux principaux au maximum, les
secondaires sans limite. La carte du métier ouvert donne son palier, sa
progression, le champ où saisir votre bonus de caractéristique, et la
spécialisation (au palier Maître). Les métiers de récolte y gagnent leurs cinq
boutons de filon. Dessous, les recettes du métier, groupées par rang, avec une
recherche et des filtres (rang, « à ma portée », « matières en main », « à apprendre » pour voir ce que
vendent le formateur et les marchands).

**Sac** — neuf matières × cinq rangs. Chaque case compte les vrais objets des
sacs de l'Aventure, plus une **réserve** saisie à la main (un coffre, un butin
noté sur papier, ce qui n'a pas tenu dans les sacs).

**Établi** — le désenchantement des objets des sacs (verts et mieux), celui d'un
objet que le MJ décrit, et le journal des vingt derniers jets, pratique pour
retrouver ce qui s'est passé au milieu d'une partie.

### Les objets du catalogue

Les métiers travaillent avec les objets du catalogue (`Donnees\catalogue-objets.json`,
celui de l'onglet Objets) et les **sacs de l'Aventure** :

- **Les matières** sont de vrais objets. Minerai de cuivre, Barre de cuivre et
  Pierre brute sont tous du *minerai de rang I* ; Etoffe de soie, du *tissu III*.
  Le rang vient du niveau de l'objet (1-12, 13-24, 25-36, 37-48, 49-60).
- **La récolte** met l'objet dans les sacs : Minerai d'étain, une herbe du rang,
  Cuir moyen, un poisson… La gemme ou la viande en prime aussi.
- **Les recettes** : chaque objet que WoW fait fabriquer devient une recette du
  bon métier (armures et armes de mailles et de plaques à la Forge, armures de
  tissu et sacs à la Couture, potions et élixirs à l'Alchimie, explosifs, pièces
  et fusils à l'Ingénierie, bandages, plats, parchemins, bagues et colliers…),
  environ 8 600 en tout. Leur coût suit l'emplacement, le rang et la qualité.
  Les objets **blancs** s'achètent chez le formateur ; les **verts et bleus**
  sont des recettes rares.
- **Ce qu'on fabrique** arrive dans les sacs, prêt à porter ou à utiliser, signé
  « &lt;Fabriqué par …&gt; ». Les anciennes recettes de l'atelier (runes,
  glyphes, transmutations…) fabriquent aussi un objet dans les sacs.

Sans le catalogue (appli ouverte sans le serveur), seules les recettes de
l'atelier restent, et les matières viennent de la réserve.

Le panneau de droite garde le mémo des règles sous les yeux pendant tout le mode.

### Ce qu'il faut tenir à table

L'appli lance les dés, prend et range les objets dans les sacs, et compte les coches. Elle ne sait rien de
votre feuille de personnage : le **bonus de caractéristique se saisit à la
main**, métier par métier. Elle ne vérifie pas non plus les règles de port —
un objet par emplacement, trois enchantements actifs au maximum, un élixir et un
plat à la fois — qui restent à l'arbitrage du MJ. Elles sont rappelées en bas du
panneau de droite.

L'appli ne sait pas si vous êtes devant un formateur : c'est au MJ de dire où
l'on peut apprendre. Une recette rare reçue en butin ou en récompense de quête
se prend avec *Trouvée*, sans payer. Cochez « à apprendre » dans les filtres
pour voir les recettes pas encore apprises.

## L'Aventure — l'écran du joueur

Le cinquième onglet, touche `5`. C'est **l'interface de WoW Classic** posée sur
la fiche de perso : ce que le joueur a sous les yeux pendant la partie, à la
place des feuilles papier.

Rien n'est ressaisi. Les sorts viennent du **Grimoire**, les talents de l'arbre
(**Jeu**), le niveau de la fiche. L'Aventure ajoute ce que la feuille papier
tenait : caractéristiques, PV, équipement, sacs, argent, notes. Tout part dans
le `.json` de la classe avec le reste, comme les métiers.

### L'écran

| Où | Quoi |
|---|---|
| En haut à droite | les **améliorations** (buffs) et, dessous, les **affaiblissements** (débuffs, bord rouge), avec les tours restants — voir « Buffs et débuffs » |
| En haut à gauche | le **cadre du perso** : portrait, niveau, barre de PV (verte) et de ressource (bleue pour la Mana, rouge pour la Rage, jaune pour l'Énergie). Un clic sur une barre ouvre `−5 −1 +1 +5 Max 0` ; la molette fait ±1. |
| En bas au centre | **deux barres d'action** de 12 cases, le menu (Perso, Sorts, Talents, Métiers) et la **barre des sacs** |
| En bas à gauche | la **fenêtre de discussion** : le journal de tout ce qui a été lancé, et les boutons de dés `d4` à `d100` |
| En bas à droite | les **sacs** ouverts, empilés comme dans le jeu |

### Le clavier

| Touche | |
|---|---|
| `1` … `9` `0` `)` `=` | la barre du bas (la rangée des chiffres, AZERTY compris) — sur PC ; au doigt, voir « Jouer sur tablette ou téléphone » |
| `Maj` + la même touche | la barre du haut |
| `C` | la feuille du personnage |
| `P` | le grimoire |
| `B` | tous les sacs |
| `T` | tour suivant : un tour de moins pour chaque buff et débuff |
| `N` / `K` | l'arbre de talents (onglet Jeu) / les métiers |
| `Entrée` | écrire dans la discussion |
| `Échap` | reposer ce qu'on tient, puis fermer la fenêtre du dessus |

Dans l'Aventure, les chiffres servent aux barres : on change d'onglet à la
souris. Depuis les autres onglets, `5` y ramène.

### Les sorts

Le **grimoire** (`P`) montre, comme un livre, les sorts **connus** — ceux que
le niveau a donnés ou qui ont été débloqués — rangés par catégorie dans les
onglets de droite, plus un onglet **Talents** pour ceux pris dans l'arbre.
**On les glisse sur une barre d'action.** Un passif (le rond de l'arbre) reste
dans le livre : il ne se lance pas.

**Lancer un sort** (clic, ou sa touche) lit sa fiche :

- le **coût** est retiré de la barre de ressource (`Mana : 16`, ou
  `Coût : 10 Mana`) — et si la réserve ne suffit pas, le message rouge
  *Pas assez de mana* s'affiche et rien n'est lancé ;
- le **Jet** lance un D20 et rappelle la caractéristique du perso ;
- les **Dégâts** et les **Soins** lancent leurs dés.

Tout s'écrit dans la discussion :
*Vous lancez [Éclair] (−8 Mana) — Jet d'Intelligence : 14 (Intelligence 12) · 3 dégâts magique (Nature) (1D4).*

### Le jet contre la difficulté

La règle de la table : **1D20 contre le score demandé par le MJ — 1, 5, 10, 15
ou 20 — et les facteurs qui modifient le dé.**

Au-dessus de la discussion, le panneau **Difficulté** :

1. le MJ annonce « DD 15, +2 parce que tu as l'avantage du terrain » ;
2. le joueur touche **15**, puis **+** deux fois (Facteurs : +2) — le panneau
   s'allume en or ;
3. il lance : un sort qui a un *Jet*, un toucher sur le **nom d'une
   caractéristique** dans sa feuille, le bouton **d20**, ou `/roll 1d20`.

*Jet de Force : 13 + 2 = 15 (Force 12) — DD 15 : **RÉUSSITE***

Réussite si le dé plus les facteurs **atteint** le score. Le DD et les facteurs
**ne valent que pour ce jet** : le panneau se remet à zéro, prêt pour le suivant.
Sans DD choisi, le dé est lancé et affiché, sans verdict. Le 20 et le 1
naturels sont signalés, sans changer le verdict.

La **valeur dé** d'une caractéristique est rappelée dans la ligne, mais **pas
ajoutée** au dé : si elle doit compter, c'est un facteur à ajouter avec **+**.

Glisser un sort hors de la barre l'en retire. Glisser d'une case à l'autre
échange les deux.

### La feuille du personnage (`C`)

Trois onglets en bas, comme dans le jeu :

- **Personnage** — les 19 cases d'équipement de WoW autour de l'illustration,
  les **10 caractéristiques** de la feuille papier (Point et Valeur dé), et le
  combat : niveau, PV max, ressource max, dé de vie, armure, défense,
  initiative, mêlée, distance, magie. Un clic sur l'illustration pour la choisir.
- **Identité** — prénom, nom, joueur, race, sexe, âge, taille, poids, histoire,
  et le **fond d'écran** de l'Aventure.
- **Notes** — quêtes, noms, indices, dettes…

Les **bonus des objets portés** s'ajoutent tout seuls, en vert à côté de la
valeur : une épée `+2 Force` fait passer la Force de 12 à 14 dans les jets.
L'armure des objets s'additionne à l'armure de base.

### Les sacs et les objets

Le **sac à dos** a 16 cases. Les quatre cases de la barre des sacs reçoivent de
vrais **sacs** (un objet d'emplacement *Sac*, avec son nombre de cases) :
clic droit sur un sac rangé dans le sac à dos et il se pose dans la barre.
Un sac ne se retire que vide.

**Créer un objet** — le MJ vient de donner le butin : bouton **+ Objet** sous
le sac à dos, ou clic droit sur une case vide. L'atelier demande le nom,
l'icône, la qualité (Médiocre gris → Légendaire orange), l'emplacement, et au
choix : armure, dégâts, bonus, durabilité, niveau requis, pile, un effet
*Utiliser :* (dont les dés sont lancés), une description d'ambiance. L'info-bulle
se dessine à côté pendant qu'on écrit.

| Geste | Effet |
|---|---|
| clic, puis clic ailleurs | prendre l'objet en main, le poser (ou l'échanger) |
| glisser | la même chose d'un seul geste |
| clic droit | l'évidence : **équiper**, **retirer**, **utiliser**, **poser le sac** |
| Ctrl + clic droit | le menu : modifier, réparer, abîmer, séparer la pile, jeter |
| Maj + clic droit | modifier l'objet |
| glisser sur une barre | un raccourci : la case affiche le nombre restant |

Les refus sont ceux du jeu : un casque ne va pas aux pieds, un niveau trop bas
ne peut pas porter l'objet, une arme à deux mains renvoie ce qu'il y avait en
main gauche dans le sac. Un objet *qui disparaît quand on l'utilise* (potion,
nourriture) se décompte à chaque usage.

L'**argent** (or, argent, cuivre) est au pied du sac à dos : un clic pour le
changer.

### Les effets des objets

Les textes des objets (ceux du catalogue comme ceux créés à l'atelier) sont
**appliqués**, le résultat s'écrit dans une carte de la discussion :

| L'objet dit | Ce qui se passe |
|---|---|
| *Utiliser : Rend 5D6 PV*, *Rend 2D6+1 mana*, *Rend X PV et Y mana* | les dés sont lancés, PV et mana remontent |
| *Rend 1D4 PV à chaque tour pendant 5 tours* | un soin qui revient à chaque **Tour suivant** |
| *Augmente la Dextérité de 5 et vos chances de coup critique de 2 % pendant 1 heure* | une amélioration *Dextérité +5 · Dégâts des critiques +2* pour 1 h |
| *… de la cible* (parchemins) | l'appli demande : sur vous ou sur un allié |
| *Augmente la Rage de 20 à 40*, *100 points d'énergie* | la jauge monte (si c'est la vôtre) |
| *Absorbe jusqu'à 4D6 points de dégâts* | un bouclier |
| *Inflige 6D6+2 points de dégâts et étourdit… pendant 1 tour* | dégâts à l'ennemi, état *Étourdi* posé |
| *Dissipe les effets de Peur…*, *Guérit les poisons* | vos affaiblissements de ce type partent |
| *Chances quand vous touchez : …* | à chaque coup **d'arme** qui touche, un D20 : **17 ou plus**, l'effet part (un « 5 % de chances » écrit se joue au D100) |
| *Équipé : Lorsque vous êtes touché en combat, …* | la riposte, à chaque coup subi (bouton **Dégâts**) |
| *Équipé : Ajoute 1D4 points de dégâts de Feu à vos attaques* | ajouté aux dégâts de l'arme |
| *Équipé : Rend 1D4 PV à chaque tour* | à chaque Tour suivant |

Ce qui ne se chiffre pas (*Augmente la vitesse de votre Loup fantôme*, une
téléportation, un costume) s'affiche seulement : au MJ d'en tenir compte.

Le **catalogue** est entièrement en français : les noms officiels du client
français pour WoW Classic, une traduction dans le même style pour les objets
propres à WoW Forever (ils n'existent pas en français). Les chiffres sont à
l'échelle du jeu : caractéristiques ÷ 5, armure ÷ 15, dégâts et soins des sorts
÷ 15, résistances ÷ 10, PV max ÷ 30, secondes → tours (6 s par tour). Les sacs
ont leur vrai nombre de cases (Wowhead).

L'**éclat d'âme** du démoniste est l'objet de WoW (« Fragment d'âme ») ; ses
**pierres de soin** ont l'icône des pierres de soins de WoW.

### Les icônes d'objet

La galerie a un troisième bouton, **Objets**, qui ouvre
**`Images\objets\`** — un dossier commun à toutes les classes. Il contient
pour commencer les 14 icônes d'équipement de ta fiche papier (casque, collier,
épaulières, cape, torse, brassards, gants, ceinture, jambières, bottes, anneau,
bijou, épée, bouclier). Dépose-y d'autres `.jpg` d'objets : ils apparaissent
à la prochaine ouverture de la galerie, sans rien faire d'autre.

### Buffs et débuffs

En haut à droite, comme dans le jeu : les améliorations sur la première
rangée, les affaiblissements (bord rouge) dessous, le nombre de tours restants
sous chaque icône. Ils sont sauvegardés avec le perso.

**Ils se posent tout seuls quand on lance le sort.** L'appli lit la fiche :

| La fiche dit | Ce qui se passe |
|---|---|
| « Une aura peut être active à la fois » | l'aura s'affiche jusqu'à annulation, et **remplace** l'aura précédente |
| « Un sceau… », « Un poison peut être appliqué… », « Un bouclier à la fois » | pareil : un seul à la fois |
| « Mana : 2 par tour » | à chaque **Tour suivant**, 2 de mana sont retirés ; sans mana, l'aura s'éteint |
| « …à vous ou un allié pendant… » | l'appli demande **sur qui** (sur un allié : rien ne s'affiche chez vous) |
| « Vous devenez… pendant 4 tours », « Augmente votre… pendant 2 tours » | buff de 4 / 2 tours |
| « pendant 1 heure », « 30 minutes » | affiché « 1 h », ne se décompte pas en tours |

Ce qui vise un ennemi (« étourdit l'ennemi pendant 2 tours ») ne pose rien chez
vous. Un sort **raté contre la difficulté** du MJ ne pose rien non plus. Un
objet utilisé (« Utiliser : augmente votre force de 2 pendant 3 tours ») suit
les mêmes règles. Si un sort n'est pas reconnu, glisse-le sur la rangée.

- **Poser à la main** : glisser un sort (barre ou grimoire) ou un objet sur la bonne
  rangée. La durée se lit dans sa description (« pendant 3 tours ») ; une
  durée en dés (« pendant (1D4) tour ») est lancée et écrite dans la
  discussion. Sans durée lisible, l'appli la demande. Le sort reste dans la barre.
- **Le `+`** de chaque rangée : un nom, une durée, puis l'icône dans la galerie
  (pour « Étourdi », « Poison »… lancés par le MJ).
- **Tour suivant** (bouton sous les auras, ou `T`) : un tour de moins pour
  chacun ; ce qui tombe à zéro se dissipe. Sans durée : jusqu'à ce qu'on le
  retire. À 1 tour, l'icône clignote.
- **Clic** sur une aura : +1 / −1 tour, durée, cumul, nom, icône, retirer.
  **Clic droit** sur un buff : l'annule, comme dans WoW.
- Reposer un buff déjà présent le **renouvelle** pour sa durée.

### La barre d'incantation

Elle apparaît au-dessus de la barre de combat, comme dans WoW :

- **Incantation** (barre jaune) : un sort ou une attaque qui « Nécessite 1 tour
  d'incantation » est payé tout de suite, puis la barre se charge. Le sort part
  au **Tour suivant**. « 2 tours d'incantation » : la barre a deux cases et le
  sort part au deuxième Tour suivant.
- **Canalisation** (barre verte) : le sort agit à chaque Tour suivant pendant
  sa durée, et la barre se vide d'une case par tour.
- **Agir autrement** pendant une incantation ou une canalisation (un autre sort,
  une attaque, un objet) la **brise** : l'appli demande d'abord « Interrompre
  et lancer… ». Annuler garde l'incantation en cours.
- **Le ✕** de la barre, ou **Échap** quand plus rien n'est ouvert, interrompt à
  la main (l'ennemi vous a coupé, vous changez d'avis). La barre passe au rouge
  « Interrompu ». Ce qui a été payé reste payé.
- **Fin du combat** arrête aussi les canalisations.

### La discussion

Elle garde les 80 dernières lignes, sauvegardées avec le perso.

| | |
|---|---|
| `/roll 1d20`, `/roll 2d6+3`, `/roll 20` | lance les dés (`/r` marche aussi) — `/roll` seul fait 1D100, comme dans WoW |
| `/car sagesse` | un jet de caractéristique |
| `/effacer` | vide le journal |
| n'importe quel texte | *[Asgar] dit : …* |

### Ce que l'Aventure ne fait pas (encore)

- Elle ne voit pas **les autres joueurs** : chaque poste a son personnage, et
  la discussion reste locale.
- **Un personnage par classe et par poste**, comme le reste de l'appli : deux
  joueurs Mage sur le même ordinateur partageraient la même fiche.


## L'éditeur de cartes

`Application\Editeur-de-cartes.html`, servi par le même lanceur :
`http://127.0.0.1:8730/Application/Editeur-de-cartes.html`. Ses fichiers sont
dans `Application\Editeur-de-cartes\` (textures, décors, générateurs, rendu,
éditeur) ; il n'a rien à installer et ne touche pas à l'arbre de talents.

**Ce qu'il sait faire**

- **Grille** en carrés, en hexagones ou sans grille (carte du monde), taille et
  nombre de cases réglables, échelle (1 case = 1,5 m, ou 1 km…).
- **Sol** peint case par case : 19 textures fabriquées par le code (herbe,
  terre, chemin, sable, dalles, pavés, plancher, eau, lave, neige, roche,
  briques…). La roche et les briques dessinent seules leurs bords de mur.
  Pinceau (`B`), remplissage (`G`), gomme (`E`).
- **Murs** (`W`), lignes, polygones, main levée, rectangles, ellipses, textes
  (police WoW).
- **Décor** (`I`) : une quarantaine de tampons vus de dessus (arbres, rochers,
  coffres, portes, tables, lits, feu de camp, autel, tente, tour, pont, « ! »
  et « ? » de quête…). Glisser en sème plusieurs d'un coup (une forêt).
- **Pions** (`K`) : joueur, PNJ, ennemi, boss ; numérotés tout seuls
  (Gobelin 1, Gobelin 2…), PV, état, portrait pris dans `Images\`, taille 1 à 4.
  En déplaçant un pion, la distance s'affiche.
- **Notes du MJ** (`N`) : jamais montrées aux joueurs.
- **Brouillard de guerre** (`X`) : révéler ou cacher au pinceau ou au cadre.
  Translucide pour le MJ, noir pour les joueurs.
- **Mesure** (`M`) en ligne ou en cercle (zone d'un sort), **signal** (`Q`).
- **Images** : bouton « Image… », glisser-déposer ou Ctrl+V. Elles sont copiées
  dans `Images\cartes\`. « Cases de large » cale une carte déjà quadrillée
  sur la grille.
- **Générer…** : donjon, crypte, grotte, forêt d'Elwynn, Dun Morogh, Tanaris.
- Calques (afficher, verrouiller, opacité), annuler / refaire (Ctrl+Z / Ctrl+Y),
  copier-coller, export PNG (version MJ ou joueurs) et `.json`.

**Deux styles** (panneau « Carte » → Style) :
- **Bataille** : les cases et les textures, pour les combats.
- **Parchemin** : façon carte de zone de WoW. Le sol est peint d'un bloc avec
  des frontières qui ondulent, les côtes sont encrées, la roche devient des
  chaînes de montagnes, avec grain du papier, bords brûlés et cadre doré.
  « 🎨 Varier la peinture » redessine les bords autrement. Le modèle
  **Région (parchemin)** tire une région complète : lacs, montagnes, forêts,
  route, cité, villages, entrée de donjon, ruines. Les décors de la catégorie
  « Carte » (montagne, forêt, village, cité…) vont avec ce style. Les styles de
  texte **Titre de zone** (lettres dorées) et **Lieu**, et les tracés **Route**,
  **Rivière** et **Frontière** sont dans les options des outils Texte, Ligne et
  Main levée. Le pinceau marche pareil : pendant le trait la carte est
  grossière, elle se repeint nette au relâcher.

**À table.** Clique **📡 Montrer aux joueurs** : les joueurs ouvrent
`…/Application/Editeur-de-cartes.html?vue=joueur` (l'adresse du Wi-Fi est
donnée par le bouton 🔗) et voient cette carte se mettre à jour en direct, avec
le brouillard, les pions et les signaux. **🎯 Centrer les joueurs** amène leur
vue sur ce que tu regardes. Une tablette ou un téléphone ouvre toujours la vue
des joueurs (ajoute `?vue=mj` pour forcer l'éditeur).

**Où vont les cartes ?** `Sauvegardes\Cartes\<nom>.json`, écrites toutes seules
à chaque changement, plus `index.json` (la liste) et `table.json` (la carte
montrée). Sans le serveur, elles restent dans le navigateur.

**Ce qu'il ne fait pas (encore)** : les joueurs ne déplacent pas leurs pions
eux-mêmes (seul le MJ écrit la carte) ; pas de ligne de vue automatique ; il
n'y a pas encore de bouton vers l'éditeur depuis l'arbre de talents.


## Le reste ne change pas

Les modes Édition, Jeu et Grimoire, la grille et l'aimant, les rangs, les
liens parent → enfant, le grimoire et sa fiche de perso, les exports SVG / PNG /
impression : tout fonctionne comme avant. Le détail est dans
**`LISEZMOI-detail-editeur.md`**, ici même : c'est le manuel de l'ancien éditeur
Chaman, rapatrié quand celui-ci a été supprimé. Il reste valable — lis-le en
remplaçant « l'arbre Chaman » par « la classe affichée », et sachant que les
images ne sont plus à côté du `.html` mais dans `Images\<classe>\`.

## Le rangement du 29 septembre 2026

- **Toutes les images sont dans `Application\Images\<classe>\`.** 561 fichiers
  ont quitté `..\Paladin\`, `..\Chaman\`, etc. pour un dossier unique dans
  l'appli, découpé par classe. Rien n'a été copié : elles ont été *déplacées*.
- **Une image déposée dans le dossier est utilisable tout de suite.** Le serveur
  local lit le dossier à chaque ouverture de la galerie ; il n'y a plus de liste
  `icons` à tenir à jour dans le `.html`.
- **Importer une image l'enregistre dans le dossier** au lieu de l'enfouir en
  base64 dans le `.json`. Elle entre dans la galerie de sa classe et resservira.
- **51 images étaient prisonnières des `.json`** (5 chez le Paladin, 46 chez le
  Chaman) : elles ont été extraites. 7 étaient vraiment nouvelles, les 44 autres
  existaient déjà en double dans le dossier. `Permanent\chaman.json` est passé de
  98 Ko à 63 Ko. Les copies de `Historique\` n'ont pas été touchées, exprès.
- **Le bouton *Toutes*** de la galerie donne accès aux images des neuf classes.
- **Le serveur accepte d'écrire des images**, mais seulement dans
  `Images\<classe>\` et seulement aux six extensions d'image. Tout le reste du
  disque lui reste fermé, comme avant.

## Le rangement du 19 septembre 2026

- **L'appli a son dossier.** `Arbre-de-talents.html`, son lanceur et ses
  sauvegardes vivent désormais dans `classe\Application\`. La racine `classe\`
  ne garde que les images : les dossiers de classe et `Arbre de talent\` n'ont
  pas bougé d'un pouce.
- **Les deux `.json` qui traînaient sont devenus la copie de référence.**
  `Paladin\nouveau-arbre-paladin (8).json` est maintenant
  `Application\Sauvegardes\Permanent\paladin.json`, et celui du Chaman
  `…\Permanent\chaman.json`. Même contenu, juste rangé et renommé.
- **L'appli écrit sur le disque.** Avant, Ctrl+S envoyait un fichier dans
  Téléchargements et le reste ne vivait que dans le navigateur. Maintenant tout
  va dans `Sauvegardes\`, et le navigateur n'est plus qu'un second filet.
  C'est le mini serveur qui écrit : il n'accepte que les `.json` de ce dossier,
  rien d'autre sur le disque n'est à sa portée.
- **`serveur.js` et `serveur.py` sont des vrais fichiers**, plus une ligne
  illisible planquée dans le `.cmd`. Le lanceur prend Node.js s'il est là,
  Python sinon.
- **L'ancien `.html` d'avant les métiers** est dans
  `Application\Anciennes-versions\`.

## Ce qui avait changé avant ça

- **L'arbre du Paladin a maigri.** 35 de ses icônes étaient stockées en base64 dans
  le `.json` alors que le fichier `.jpg` existait juste à côté : elles pointent
  maintenant sur le fichier. 5 images importées qui n'existent nulle part sur le
  disque sont restées intégrées telles quelles. Ta fiche de perso (niveau 60,
  51 points dépensés) est intacte.
- **`Arbre paladin.png` n'est plus dans le dossier Paladin** — il se trouve
  désormais dans `classe\Arbre de talent\`. L'appli va le chercher là pour le
  proposer comme calque ; l'ancien éditeur `Paladin\Editeur-Arbre-Talents.html`, lui,
  le cherche encore à côté de lui et affichera un cadre vide si tu le choisis.

## Ce qui reste autour de l'appli

Les anciens éditeurs `Paladin\Editeur-Arbre-Talents.html` et
`Chaman\Editeur-Arbre-Talents.html` **ont été supprimés**, avec leurs
`Lancer-editeur.cmd`. Leur manuel a été gardé : c'est le
`LISEZMOI-detail-editeur.md` de ce dossier. Le dossier `..\Arbre de talent\` est
parti aussi : ses huit relevés étaient devenus des doublons exacts de ceux
rangés dans `Images\<classe>\`.

Il reste, à côté de `Application\` — et **l'appli n'y touche jamais** :

- `..\Guerrier\`, `..\Chasseur\`, `..\Voleur\`, `..\Prêtre\`, `..\Mage\`,
  `..\Démoniste\`, `..\Druide\` : uniquement les **fichiers Illustrator `.ai`**,
  tes sources de montage. Un `.png` se refabrique depuis un `.ai`, l'inverse
  non — ils restent.
- Les neuf **fiches de présentation de classe** (`..\Paladin.png`,
  `..\Chasseur.png`, `..\Chaman.jpg`, …) : race jouable, bonus et malus,
  histoire, les deux voies. C'est du contenu de jeu, pas un résidu.
- `..\old-parchment-…webp`, la texture de parchemin.
