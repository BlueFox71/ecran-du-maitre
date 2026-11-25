# Outils de chasse dans la main des joueurs — chantier 1 : EMF et thermomètre

*Conception validée en conversation le 25/11/2026. Les points marqués « (choix de Claude) » n'ont pas été tranchés par l'utilisateur ; ils peuvent être remis en cause.*

## Pourquoi

La page **Simulation Objets** (rail MJ, sous Objets) fait déjà vivre six outils de chasseur de fantômes — EMF, thermomètre, spirit box, livre d'écriture, planche, tarot — mais pour le MJ seul : rien ne part vers les téléphones ni le grand écran, et le niveau de l'EMF se règle au curseur. L'utilisateur veut que ces outils deviennent **des objets que les joueurs manipulent** : on les porte, on s'en sert depuis son téléphone, on les pose et on les ramasse sur le plan, et ils réagissent au lieu.

Le travail est coupé en deux chantiers :

1. **Ce document — les outils qui mesurent : EMF et thermomètre.** Il pose aussi le socle commun (outil rattaché à un objet, page sur le téléphone, poser/ramasser sur le plan, dessin sur le plan).
2. **Plus tard — les outils qui parlent : spirit box, livre, planche, tarot.** Le MJ y envoie des textes préparés (pour le tarot, plusieurs textes prédéfinis par carte) qui s'affichent sur le téléphone du porteur. Hors périmètre ici, mais le socle doit pouvoir les accueillir sans être refait.

## Ce qu'on vise

### 1. Un outil est un objet

- Dans la fiche d'un `Objet` (modèle de campagne, `src/shared/types.ts` ~884), le MJ choisit l'**outil** qu'il représente : aucun, EMF, thermomètre (les quatre autres arrivent au chantier 2 ; le champ doit pouvoir les recevoir).
- Un objet rattaché à un outil **prend directement l'image de l'outil** (`assets/chasse/emf.png`, `thermometre.png`) : partout où l'objet s'affiche (sac, inventaire, plan), c'est elle. Le MJ n'a pas d'image à choisir pour lui.
- Chaque **exemplaire** (`ObjetPlacement`) est un appareil à part, avec sa propre mesure : deux EMF dans la maison réagissent chacun à leur endroit.

### 2. Le MJ cartographie le lieu

- **Où :** dans l'**atelier**, à l'étape **Objets** (décision de l'utilisateur). Les zones n'existent donc que sur les plans construits à l'atelier ; un lieu qui n'est qu'une image n'a pas de zones (ses appareils lisent 0 et la température ambiante). On les prépare avant la séance, comme le reste du plan.
- Deux **calques** invisibles des joueurs :
  - **EMF** : on peint des zones de niveau **1 à 5**. Hors de toute zone : **niveau 0**, aucun son.
  - **Température** : on peint des zones en °C ; hors zone, l'appareil lit la **température ambiante**, un réglage par plan (un niveau de l'atelier), par défaut 18 °C (valeur et emplacement du réglage, à côté des calques dans l'étape Objets : choix de Claude). Une cave froide ou une cuisine chaude se font en peignant une zone, pas avec un réglage par pièce.
- **On colorie le plan entier**, librement, sans tenir compte des pièces (décision de l'utilisateur) : c'est un coloriage, pas un tracé de zones. Chaque endroit du plan a **une seule valeur** ; repeindre par-dessus remplace (comme un coloriage). Outil : un **pinceau** à rayon réglable, mesuré en cases, sur le modèle du sol peint de l'atelier (`SolPeint`, `src/shared/atelier.ts`), et une gomme qui remet à 0 / à l'ambiante (choix de Claude).
- Les calques font partie de la construction du plan et s'enregistrent avec elle dans la base de la campagne.

### 3. Ce que mesure un appareil

- **Les outils ne sont jamais posés d'avance par le MJ** : ils commencent dans un **inventaire** partagé (le matériel des chasseurs), où les joueurs les prennent (décision de l'utilisateur). Il n'y a donc pas d'appareil « caché pas encore trouvé » : un outil posé sur le plan l'a été par un joueur, et il est visible (« trouvé »).
- La valeur d'un appareil vient de **l'endroit où il est** :
  - **en main** (`port = 'pj'`) : la position du **pion de son porteur** ; quand le joueur déplace son pion, l'appareil réagit ;
  - **posé** (`port = 'lieu'` avec `pos`) : sa position sur le plan ; **il continue de mesurer** même sans personne autour ;
  - **ailleurs** (dans un inventaire, chez un PNJ, dans un lieu sans position) : il ne mesure pas et reste muet (choix de Claude).
- **Pas seulement le lieu affiché** (décision de l'utilisateur) : un appareil mesure et s'entend partout où il y a des pions, même si le grand écran montre un autre lieu ou un autre étage. Un EMF posé au rez-de-chaussée s'entend donc des pions restés au rez-de-chaussée pendant que l'écran montre la cave, et un porteur lit toujours la valeur sous son propre pion. Le serveur, qui aujourd'hui ne travaille que sur le lieu affiché (`d.placeId`), doit pour cela suivre tous les lieux où se trouvent des pions et des appareils.
- L'EMF garde le caractère vivant de la simulation actuelle (fluctuations, rafales sous ~2,6 : `src/renderer/src/mj/chasse/emf.ts`) autour du niveau lu ; le thermomètre glisse vers sa cible comme aujourd'hui (`temperature.ts`, `rapprocher`).
- **LED de l'EMF** : la première LED verte reste allumée tant que l'appareil est en marche, même au niveau 0 (choix de Claude, comme un vrai K-II) ; on peut l'**éteindre** (plus de LED, plus de son).

### 4. Le MJ peut prendre la main

- Sur **un appareil précis**, le MJ choisit **« Prendre le contrôle de cet objet »** : la valeur ne vient plus des zones mais d'un curseur (celui de la page EMF actuelle, `src/renderer/src/mj/modules/Emf.tsx` ; pour le thermomètre, celui de `Thermometre.tsx`). Usage type : le fantôme passe à l'attaque, le MJ monte à 5.
- **« Lâcher le contrôle de cet objet »** : l'appareil se remet à lire sa zone.
- On ne prend le contrôle que d'un appareil en main ou posé sur un plan (choix de Claude) ; le contrôle reste acquis si l'appareil change de mains ou est posé, jusqu'à ce que le MJ le lâche.
- Le MJ voit **tous les appareils** avec leur valeur du moment, y compris dans le noir, et un appareil sous son contrôle est signalé comme tel. Où s'offrent ces commandes (clic sur l'appareil dans le plan du MJ, liste dans Simulation Objets, les deux) : laissé au constructeur, l'essentiel est d'y accéder en un geste pendant la séance.

### 5. Sur le téléphone du joueur

- Un onglet **Objets** (à côté de Fiche, Plan, Sac… — `Onglet` dans `src/renderer/src/mobile/Mobile.tsx` ~261) liste ses outils (décision de l'utilisateur). Chaque ligne montre **l'image de l'objet, son nom, allumé ou éteint, et où il est : en main ou posé dans le lieu**. La liste contient les outils qu'il porte et ceux qu'il a posés (choix de Claude) ; pour un outil posé, la mesure n'apparaît que si le joueur le voit sur le plan (sinon, pas de lecture à distance dans le noir). L'onglet n'apparaît que si le joueur a au moins un outil (choix de Claude).
- Toucher un outil **en main** ouvre sa page : l'appareil (même rendu que la simulation : photo, LED / afficheur), avec :
  - **Allumer / Éteindre** ;
  - **Poser ici** : l'objet quitte son sac et se pose sur le plan sous son pion (`port` → `'lieu'`, `pos` = position du pion, pièce du pion).
- Sur l'onglet **Plan**, toucher un outil posé **tout près de son pion** propose **Ramasser** (l'objet passe dans son sac). La distance « tout près » est laissée au constructeur (de l'ordre de deux rayons de pion), et un mur entre les deux interdit de ramasser (choix de Claude).
- Aujourd'hui le téléphone ne sait ni déposer ni ramasser sur le plan (seulement sac ↔ inventaire ouvert, `src/main/mobile.ts` ~1385-1502) : ces deux actions sont à créer, côté serveur avec les mêmes garde-fous que `pion()` (un joueur n'agit que pour son personnage).

### 6. Sur le plan (téléphones et grand écran)

- Un outil posé se dessine **vu de dessus, avec une lueur** autour (option B validée) : la lueur grandit et prend la couleur du niveau (couleurs des LED de l'EMF, `LEDS_EMF`) ; pour le thermomètre, lueur bleue quand il fait froid, chaude quand il fait chaud (choix de Claude). L'image est celle de l'outil (photo de face = l'appareil posé à plat, choix de Claude), réduite.
- Il obéit au **brouillard** comme les autres objets : visible seulement là où les joueurs voient. Dans le noir ou dans une pièce que personne ne voit, **il disparaît** (le grand écran suit la même règle — choix de Claude).
- Un outil posé est visible de tous les joueurs (il est « trouvé »), pas seulement de celui qui l'a posé.

### 7. Le son

- **Tout le son sort du PC**, rien des téléphones.
- Chaque EMF qui sonne a un volume qui dépend du **pion de joueur le plus proche**, murs compris : plein volume en main ; de plus en plus faible quand on s'éloigne, plus encore à travers un mur ; silence au-delà d'une certaine distance. Un EMF posé dans une pièce que tout le monde a quittée s'éteint donc peu à peu, et **on l'entend même dans le noir** si un pion est assez proche.
- Plusieurs EMF qui sonnent s'entendent ensemble.
- Le calcul de proximité existe déjà pour les zones sonores (`proximite`, `src/main/sons.ts` ~266, qui coupe à travers les murs) : à réutiliser ou à adapter (l'utilisateur veut « moins fort » à travers un mur plutôt que forcément « rien » — à ajuster à l'oreille).
- Le moteur sonore de l'EMF existe (`SonEmf`, `emf.ts`, un enregistrement joué tel quel au niveau 3) ; il faudra une instance par appareil qui sonne.
- Le thermomètre n'a pas de son (choix de Claude).

## Ce qu'on ne fait pas ici

- Spirit box, livre d'écriture, planche, tarot (chantier 2).
- Son sur les téléphones.
- Un fantôme qui se déplace et emporte ses zones avec lui : les zones sont peintes, fixes ; le mouvement passe par « Prendre le contrôle ».
- Toute reprise d'assets de Phasmophobia (refusée par l'utilisateur) : les images sont les photos originales déjà dans `assets/chasse/`.

## Ce qui ferait échouer le projet même si « ça marche »

- Le MJ doit chercher l'appareil pendant l'attaque : prendre le contrôle doit être immédiat.
- Les joueurs voient les calques EMF/température, ou devinent les zones autrement qu'en promenant l'appareil.
- Un outil posé dans le noir reste visible et trahit la pièce.
- Le son d'un EMF lointain couvre la scène, ou des appareils muets « au niveau 0 » grésillent.

## Contraintes

- Application existante : Electron + React, serveur local pour les téléphones (SSE `/api/stream`), base SQLite par campagne avec migrations (`src/main/db/schema.ts`).
- Le téléphone le plus ancien en usage est une Galaxy Tab S2 sous Chrome 119.
- Les textes de l'interface sont en français, dans le ton de l'application.
- À chaque montée de version : `RELEASE_NOTES.md` réécrit et validé par l'utilisateur (voir `CLAUDE.md`).

## Laissé au constructeur

- Le stockage des calques dans la construction (traits de pinceau comme le sol, grille…) et la conversion entre cases de l'atelier et position des pions/objets sur le plan.
- Qui peut éteindre un appareil posé (*choix de Claude par défaut : il faut le ramasser d'abord*).
- Où vivent les commandes MJ (plan, Simulation Objets) — tant qu'elles sont à un geste.
- Le rythme de mise à jour des valeurs vers les téléphones et le PC.
- Les courbes exactes d'atténuation du son, à régler à l'oreille avec l'utilisateur.
- Le découpage du travail en étapes livrables.
