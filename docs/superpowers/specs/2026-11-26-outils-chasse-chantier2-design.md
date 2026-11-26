# Outils de chasse — chantier 2 : spirit box, livre d'écriture, planche, tarot

*Conception tirée de la conversation du 26/11/2026. Les points marqués « (choix de Claude) » n'ont pas été tranchés par l'utilisateur ; ils peuvent être remis en cause.*

## Pourquoi

Le chantier 1 (`2026-11-25-outils-chasse-objets-design.md`, branche `outils-chasse`) a fait de l'EMF et du thermomètre des **objets que les joueurs manipulent** : on les porte, on les allume depuis la page Pion du téléphone, on les pose et on les ramasse sur le plan, et le MJ peut en prendre le contrôle.

Les quatre autres outils de la page **Simulation Objets** — spirit box, livre d'écriture, planche de spiritisme, tarot — ne vivent encore que chez le MJ, pour lui seul. L'utilisateur veut qu'ils entrent dans le jeu à leur tour, chacun à sa façon. Ces outils-là ne mesurent rien : **ce sont les « outils qui parlent »**. C'est le MJ qui leur fait dire quelque chose, au moment qu'il choisit, à partir de ce qu'il a **préparé pour la séance**.

## Le poste de commande : le panneau Objets du Paravent

Tout se pilote depuis le **panneau Objets du Paravent** (`ObjetsDeScene`, `src/renderer/src/mj/components/ObjetsDeScene.tsx` — le panneau qui remplace le tableau de scène, à gauche du visuel, ouvert par le bouton « Objets » de la barre du visuel). Décision de l'utilisateur.

- Aujourd'hui ce panneau ne liste que les objets **posés dans le lieu affiché** et ses pièces. Il gagne une section **« Appareils »** (nom : choix de Claude) qui liste **tous les outils de chasse en jeu de la séance** — en main d'un joueur ou posés, quel que soit le lieu.
- On y **ajoute l'EMF et le thermomètre** (décision de l'utilisateur) : qui le tient ou où il est posé, ce qu'il mesure, et **Prendre / Lâcher le contrôle** avec le curseur — les mêmes commandes que la liste en tête de Simulation Objets (`src/renderer/src/mj/chasse/Appareils.tsx`). Cette liste reste aussi dans Simulation Objets (choix de Claude).
- La spirit box, le livre et la planche y apparaissent avec leurs commandes propres (ci-dessous). Le tarot aussi, bien qu'il ne soit pas un appareil porté (voir § Tarot).
- La préparation des textes se fait **dans ce même panneau** (décision de l'utilisateur : « dans objets du paravent »), avant ou pendant la séance.

## Les textes préparés appartiennent à la séance

- Spirit box et livre : **une liste de textes par spirit box, par livre, pour toute la séance** (décision : « une liste par spirit box pour toute la séance »).
- Les textes s'attachent à **la fiche de l'objet** (`Objet`, déjà propre à la séance depuis la 1.12 — voir `2026-11-22-objets-par-seance-design.md`), pas à l'exemplaire (`ObjetPlacement`) dont l'identifiant change quand une pile se découpe (choix de Claude). Deux spirit box qui doivent dire des choses différentes = deux fiches.
- **Dupliquer une séance / préparer la suite / importer des objets** : les textes, réglages de voix et textes du tarot suivent la fiche comme le reste de l'objet ; les pages déjà écrites du livre repartent blanches (choix de Claude).
- Tarot : **des textes par carte, séance par séance** (décision : « uniquement séance »). Pas de bibliothèque de campagne.
- Les textes et réglages s'enregistrent dans la base de la campagne, rangés par séance (migration dans `src/main/db/schema.ts`). Un texte lancé reste dans la liste (on peut le relancer) ; il est marqué « dit » (choix de Claude).

## Qui voit quoi, sur les téléphones (vaut pour la spirit box, le livre et la planche)

- **En main** : le téléphone de celui qui le tient.
- **Posé** : le téléphone de **chaque joueur proche** — pion à moins de 6 m, sans mur entre eux — comme la mesure d'un EMF posé (`lisiblePar`, `PORTEE_LECTURE_M`, `src/main/chasse.ts`) (décision de l'utilisateur : « sur celui qui est proche »). Un joueur loin ne voit rien, même s'il l'a posé.
- **Rangé dans le sac** (`ou: 'sac'`) ou porté sans pion : **hors jeu** — la spirit box s'y tait, on ne peut ni la faire parler, ni écrire dans le livre, ni piloter la planche ; les boutons du MJ sont grisés avec la raison (choix de Claude).
- Le son sort toujours du PC.

## Spirit box

- **Un objet** (fiche d'objet → outil « Spirit box »), qui prend la photo de l'appareil (`assets/chasse/spirit-box.png`), comme l'EMF. `OutilChasse` (`src/shared/chasse.ts`) s'étend.
- **Côté joueur** : sur la page Pion, la spirit box est une carte de « Mes objets » comme l'EMF — on l'**allume / éteint**, on la **pose**, on la **ramasse** (mêmes règles qu'au chantier 1 : en main = tenue dans une main ; ramassage à 5 m sans mur ; etc.).
- **Allumée, elle grésille** (décision : « simple si c'est allumé ça fait du grésillement ») : le balayage radio de la simulation (`SonSpirit`, `src/renderer/src/mj/chasse/spirit.ts`), **joué sur le PC** comme le son de l'EMF. Éteinte : rien. Atténuation à la distance comme l'EMF (choix de Claude ; en main = plein volume).
- **Côté MJ** : pour chaque spirit box, sa **liste de textes** et ses **réglages de voix** (décision : « configuration de voix prédéfinie aussi ») — la voix Windows et les réglages grave / hachage / écho / clarté de la simulation (`ReglagesVoix`). Réglages par spirit box pour la séance (choix de Claude ; un réglage par texte est laissé au constructeur s'il ne complique rien). Un bouton par texte : **Lancer** → le PC prononce le texte (TTS Windows, `src/main/voix.ts`) à travers le grésillement.
- On ne lance qu'une spirit box **allumée et en jeu** (en main ou posée) ; sinon le bouton est grisé avec la raison (choix de Claude).
- **Sur le téléphone** (voir § Qui voit quoi) : l'appareil avec sa fréquence qui défile (rendu de la simulation). Le texte dit **ne s'affiche pas** : on l'entend au PC, l'écran de l'appareil frémit seulement pendant que la voix parle (décision de l'utilisateur, 27/11).

## Livre d'écriture

- **Un objet** (outil « Livre d'écriture »), photo `assets/chasse/livre.jpg`. Porté, posé, ramassé comme les autres. Pas d'allumé / éteint (choix de Claude).
- **Côté MJ** : une liste de textes par livre pour la séance ; chaque texte garde **son écriture, sa taille, son inclinaison** (les réglages de la simulation, `Livre.tsx` / `ecriture.ts`). Un bouton **Lancer** par texte.
- **Sur le téléphone** (voir § Qui voit quoi) : comme dans la simulation (décision : « comme dans la simulation, l'animation et bruit d'écriture ») — le livre ouvert, le texte tracé au crayon lettre par lettre, la page gauche d'abord.
- **L'écriture appartient au livre** : les passages de la séance restent écrits, et celui qui le ramasse ou s'en approche les voit ; un téléphone qui se reconnecte les retrouve (choix de Claude). Les pages pleines : comme la simulation aujourd'hui (choix de Claude).
- **Le bruit du crayon** (`SonCrayon`) sort **du PC**, pendant que ça s'écrit.
- **Sur le grand écran** : le MJ peut **montrer le livre à la table** (décision : « je peux faire afficher le livre et la planche sur l'écran ») **dans une fenêtre par-dessus le plan** (décision), comme une image montrée en fenêtre depuis le Paravent : le plan et les pions restent derrière. L'écriture s'y anime **en direct**, en même temps que sur le téléphone (choix de Claude). Rien ne part tant qu'il ne l'a pas montré ; un geste pour le retirer.

## Planche de spiritisme

- **Un objet** (outil « Planche de spiritisme »), photo `assets/chasse/planche.jpg` + goutte `planchette.png`. Porté, posé, ramassé comme les autres. Pas d'allumé / éteint (choix de Claude).
- **Pas de textes préparés** : le MJ **pilote la goutte en direct** (décision), case par case — clic sur la case, ou la touche du clavier, comme dans la simulation (`Planche.tsx`, `spiritisme.ts`). Tant qu'elle glisse, on n'en demande pas une autre.
- **Sur le téléphone** (voir § Qui voit quoi) : la planche, et la goutte qui glisse en même temps que chez le MJ.
- **Sur le grand écran** : le MJ peut la **montrer à la table**, dans une fenêtre par-dessus le plan, la goutte en direct — comme le livre.
- Son : aucun dans la simulation ; rien n'est demandé (laissé tel quel).

## Tarot

- Les joueurs tirent les cartes **d'un vrai jeu** ; le joueur dit au MJ le nom de la carte (décision).
- **Côté MJ** : dans le panneau, le MJ choisit **l'arcane** parmi les 22 (images « Daguerréotypes », `assets/chasse/tarot-hante/`, données `arcanes.ts`) puis **l'un des textes préparés pour cette carte et cette séance**, et l'**affiche sur le grand écran** : la carte retournée, son texte dessous (décision), **dans une fenêtre par-dessus le plan** (décision).
- Le tarot **n'a pas besoin de fiche d'objet** : il est toujours disponible dans le panneau ; ce n'est pas un `OutilChasse` (choix de Claude).
- **Rien sur les téléphones.** Le tarot n'est pas un objet porté : pas d'allumé, pas de poser / ramasser (choix de Claude, cohérent avec « il tire la carte physiquement »).
- **Plusieurs textes par carte**, préparés pour la séance (décision). Les textes intégrés de `arcanes.ts` (un par carte) restent proposés comme point de départ quand la carte n'a pas de texte de séance (choix de Claude).
- Plusieurs cartes à la suite s'ajoutent côte à côte dans la fenêtre, comme le tapis de la simulation, jusqu'à ce que le MJ les retire (choix de Claude).

## Ce qu'on ne fait pas

- Pas de son sur les téléphones : tout le son sort du PC (décision du chantier 1).
- Pas de textes de campagne réutilisables : tout est par séance.
- Pas de saisie de texte par les joueurs.
- Pas d'assets de Phasmophobia ; polices sous licence libre seulement.

## Ce qui ferait échouer le projet même si « ça marche »

- En pleine séance, le MJ doit **chercher** le texte à lancer ou l'appareil à piloter : tout doit être au même endroit (le panneau Objets du Paravent), à un geste.
- Un texte part vers un joueur qui n'a pas l'objet, ou un autre joueur lit sur son téléphone ce qu'un objet qu'il ne tient pas a dit.
- La voix ou le crayon tombent à côté du grésillement (une voix sèche, sans radio) : l'effet de la simulation doit être intact.
- Le livre ou la planche s'affichent sur le grand écran sans que le MJ l'ait voulu.

## Contraintes

- Application existante : Electron + React ; serveur local des téléphones (SSE `/api/stream`) ; base SQLite par campagne avec migrations (`src/main/db/schema.ts`, la dernière est la 98) ; Ctrl+Z de préparation suivi par canal IPC (`src/main/defaire.ts`).
- Les téléphones : Android (Chrome) et **iPad (Chrome = WebKit)** — éviter les `foreignObject` dans un SVG et les masques SVG lourds (leçons du chantier 1).
- Textes de l'interface en français, dans le ton de l'application.
- À la montée de version : `RELEASE_NOTES.md` réécrit et validé (voir `CLAUDE.md`).

## Laissé au constructeur

- Le stockage exact (tables, colonnes) des textes, réglages de voix et textes du tarot, rangés par séance.
- La forme du panneau Objets du Paravent (sections, repli, ordre) tant que tout est à un geste.
- Comment la voix TTS est générée et jouée (réutiliser `voix.ts` et `SonSpirit`) ; comment le grésillement d'une spirit box en jeu est mixé avec ceux des EMF (`SonsChasse.tsx`).
- Le rendu du livre et de la planche sur le téléphone et sur le grand écran (réutiliser les composants de la simulation).
- Le découpage en étapes (suggestion : panneau + EMF/thermo, puis spirit box, puis livre, puis planche, puis tarot).

## Livraison (choix de Claude)

Le chantier 1 sort d'abord tel quel (1.13.0, branche `outils-chasse`). Le chantier 2 part de là sur une branche à part et sort en une seule version (1.14.0), avec un seul `RELEASE_NOTES.md` à faire valider.
