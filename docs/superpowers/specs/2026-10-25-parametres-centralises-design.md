# Paramètres centralisés, avec recherche

## Pourquoi

Le maître du jeu se perd quand il cherche un réglage. Exemple vécu : changer le
nombre de places que porte un joueur (*Capacité du sac*). Le réglage existe,
dans Paramètres › Table et règles, mais rien ne mène là : les monnaies, qui sont
une règle de même nature, vivent dans la Fiche de campagne ; le compteur
« X / Y places » de l'Équipement ne renvoie nulle part.

Aujourd'hui la configuration est répartie entre la fenêtre **Paramètres**
(`mj/components/Parametres.tsx`, 8 rubriques), la **Fiche de campagne**
(`mj/modules/FicheCampagne.tsx`), la fenêtre **La campagne**
(`FicheCampagne` dans `mj/components/Fiches.tsx`), l'écran **Ça commence
bientôt** (`mj/components/Attente.tsx`) et des commandes en place (Affichage ▾,
console du direct, Bibliothèque, Éditeur). Plusieurs valeurs se règlent à deux
endroits qui ne se comportent pas pareil (enregistrement immédiat d'un côté,
bouton « Appliquer » de l'autre).

## Ce que veut l'utilisateur (ses décisions)

1. **Tout centraliser** dans une seule fenêtre Paramètres.
2. **Une barre de recherche** pour trouver un réglage.
3. **Garder les commandes rapides** du direct là où elles sont, *en plus* de
   leur place dans Paramètres.

## Objectifs

- Toute la configuration de l'outil se trouve dans Paramètres, ou y est au
  moins *trouvable* par la recherche.
- Taper un mot (« sac », « places », « porter », « transition », « thème »…)
  montre le ou les réglages correspondants, **modifiables sur place**, avec
  leur chemin (« Campagne › Règles du jeu »).
- Chaque valeur n'a qu'**une source et un comportement** : si elle apparaît à
  deux endroits (Paramètres + commande rapide), les deux lisent et écrivent la
  même chose, et changent ensemble.
- Enregistrement **immédiat** partout dans Paramètres (comportement actuel :
  au blur / au relâchement). Plus de bouton « Appliquer » pour un réglage.
  **Seule exception : la liste des monnaies** (voir plus bas).

## Non-objectifs

- Ne pas changer ce que fait chaque réglage, ses bornes ni son stockage
  (`setting` pour la campagne, `app_setting` pour le poste —
  `shared/reglages.ts`).
- Ne pas déplacer l'**éditeur de la fiche** (caractéristiques, compétences,
  jauges, modèles, briques) : c'est un éditeur, pas un réglage. Il reste dans la
  Fiche de campagne, avec son « Appliquer ».
- Ne pas toucher au mobile (il n'a pas d'écran de réglages ; ses deux
  préférences sont propres à l'appareil).
- Ne pas rendre configurables les raccourcis (la rubrique reste en lecture).

## Anti-objectifs (échec même si « ça marche »)

- Retirer une commande rapide utilisée en pleine partie (Affichage ▾,
  bascule de la console, vignettes de la Bibliothèque, volume).
- Une recherche qui ne trouve que le libellé exact : « places » doit trouver la
  capacité du sac.
- Un résultat de recherche qui dit seulement « c'est dans tel onglet » alors
  que le réglage pourrait être modifié là, tout de suite.
- Un même réglage qui, à deux endroits, se comporte différemment.

## La fenêtre

Ouverture inchangée : roue dentée, `Ctrl+,`, menus, événement `jdr:parametres`
(avec rubrique de départ). La recherche reçoit le focus à l'ouverture ;
`Échap` vide d'abord la recherche, puis ferme la fenêtre.

### Rubriques

Les deux groupes « La campagne » / « Le poste » et le bandeau « Suit la
campagne / Suit le poste » restent : la coupure dit ce qui part avec le dossier.

**La campagne**

| Rubrique | Contenu | Provenance |
|---|---|---|
| La campagne | Nom, Système, Dossier (Ouvrir / Changer de campagne…), **Joueurs de la campagne** (nom, personnage, couleur) | Paramètres › Table + fenêtre « La campagne » (supprimée) |
| Règles du jeu | Système de jet, Compétences (la table s'en sert), Limite de compétences, Santé mentale, Fiche de compétences des PNJ, **Capacité du sac**, **Monnaies** (éditeur complet : activer, liste, images, teintes, taux, modèles de départ) | Paramètres › Table + Fiche de campagne (onglet Monnaies et réglages de règles) |
| Écran des joueurs | Écran de sortie, Manière de basculer, Durée ; **En direct** : Vision (regards / plein jour), Encart joueurs (+ sens ligne/colonne), Santé mentale dans l'encart, Noms et PV sous les pions, Volume de l'ambiance | Paramètres › Écran + Affichage ▾ / barre Régie / console |
| Écran d'attente | Titre, Au-dessus du titre, Compte à rebours par défaut, Couleurs, Musique, Émojis, Montrer les joueurs attendus, Me montrer à la table | `Attente.tsx` (`setting['attente']`) |
| Murs et lumière | Inchangé (défauts des nouvelles cartes) | Paramètres › Murs |
| Sons | **En direct** : Volume général des sons, Déclenchement auto | `PanneauSons.tsx` |

**Monnaies : brouillon conservé.** Une monnaie enregistrée dans
`setting['monnaies']` compte comme « déjà sur les fiches » et ne peut plus être
supprimée (`monnaiesPosees()`, `shared/monnaies.ts`) ; les modèles de départ ne
sont proposés que tant que rien n'est enregistré. Enregistrer à chaque frappe
figerait donc une monnaie d'essai ou une faute de frappe. Le bloc Monnaies de
Paramètres garde son **brouillon et son bouton « Appliquer »** (et la
confirmation « Passer la campagne sans monnaie ? »), comme aujourd'hui dans la
Fiche de campagne — le bloc le dit en une phrase. Le reste de la rubrique
s'enregistre immédiatement.

**Les deux volumes restent deux réglages distincts** : « Volume de
l'ambiance » (`display.audio.volume`, la musique d'ambiance à l'écran) et
« Volume général des sons » (`regie.general`, les sons posés sur les cartes).
Leurs libellés et mots proches doivent les distinguer dans la recherche
(« volume » trouve les deux, chacun avec une aide qui dit ce qu'il règle).

**« En direct »** désigne, dans les rubriques Écran des joueurs et Sons, les
réglages tenus en mémoire (non persistés, perdus au redémarrage) ; un
sous-titre le dit. Ils restent rangés côté campagne parce qu'ils concernent la
partie en cours, mais ne partent pas avec le dossier.

**Le poste**

| Rubrique | Contenu |
|---|---|
| Le maître du jeu | Inchangé |
| Portables | Inchangé |
| Le poste | Thème, Rouvrir au démarrage, Dossier de données, **Taille des vignettes** (déplacée depuis « Bibliothèque » : elle suit le poste), **Zoom de l'éditeur** (nouveau : `editeur.zoom` n'avait pas de ligne) |
| Bibliothèque | Le graveur de vignettes (état, Relire, Tout regraver) |
| Raccourcis | Inchangé |

### Recherche

- Chaque réglage est déclaré une fois avec : rubrique, libellé, aide, **mots
  proches** (synonymes à la main : sac → inventaire, encombrement, charge,
  places, porter, emplacements) et le rendu de sa ligne.
- La correspondance ignore la casse, les accents, et accepte un début de mot
  (« transi » → Manière de basculer, via « transition »).
- Avec une recherche en cours, la navigation de gauche s'efface au profit
  d'une **liste de résultats** groupés par rubrique ; chaque ligne est la vraie
  ligne de réglage, modifiable. Cliquer sur le chemin ouvre la rubrique.
- Aucun résultat : le dire simplement (« Rien pour “xyz” »).

### Réglages qui vivent ailleurs (trouvables, pas déplacés)

Ce qui se règle **par carte** ou **par séance** reste à sa place, car il n'a de
sens que dans ce contexte. La recherche les trouve quand même et propose d'y
aller :

- Par carte : portée du regard, zone éclairée gardée, largeur des ouvertures,
  astre et nord (volet Murs des Lieux) ; taille des pions d'un lieu.
- Par séance : dossier de la séance, présents (fenêtre « La séance ») ; PNJ sur
  la ligne des pions.
- Le résultat affiche « Se règle sur chaque carte — dans Lieux › Murs » (ou
  équivalent) avec un bouton qui y mène quand c'est possible (ex. ouvrir « La
  séance » ; pour une carte, ouvrir Lieux sur la carte courante s'il y en a
  une, sinon l'indication seule).

## Les autres fenêtres après le chantier

- **Fiche de campagne** : ne garde que la composition de la fiche
  (caractéristiques, compétences, jauges, modèles, briques). L'onglet Monnaies
  et les réglages de règles (jet, compétences on/off, limite, santé mentale) en
  sortent ; à leur place, un lien « Règles du jeu dans les Paramètres ».
  ⚠️ La santé mentale désigne une jauge de la fiche : si la jauge choisie est
  retirée dans l'éditeur, le comportement actuel s'applique (à vérifier et
  conserver). Paramètres ne propose que les jauges **appliquées** ; une jauge
  ajoutée dans le brouillon de l'éditeur n'y apparaît qu'après « Appliquer »
  (le sélecteur le dit en une phrase).
  - Ces règles sont stockées dans le modèle de fiche (`TemplateSpec` :
    `rollSystem`, `sansCompetences`, `skillLimit`, `sanityGauge`), réécrit en
    entier des deux côtés. **L'« Appliquer » de l'éditeur ne doit plus écrire
    ces quatre champs** : il relit les valeurs courantes au moment
    d'enregistrer et ne remplace que la composition, pour ne pas écraser une
    règle changée entre-temps dans Paramètres.
  - Le lien « Règles du jeu dans les Paramètres » ferme l'éditeur ; s'il y a
    un brouillon non appliqué, la confirmation existante « Fermer sans
    appliquer ? » s'affiche d'abord.
- **La campagne** (Fiches.tsx) : supprimée. « Campagne › Configurer la
  campagne… » ouvre Paramètres › La campagne. Son bouton « Inscrire un
  joueur… » suit la liste des joueurs dans Paramètres et ouvre le carnet de
  joueurs **par-dessus** Paramètres (empilement de modales à assurer, Échap
  ferme d'abord le carnet).
- **Ça commence bientôt** : reste le bouton de lancement de la Régie (commande
  rapide), préremplie depuis les réglages ; ce qu'on y change est le même
  `setting['attente']` que Paramètres › Écran d'attente.
- **Commandes rapides** (Affichage ▾, barre Régie, console du direct,
  Bibliothèque, Éditeur, panneau Sons) : inchangées à l'écran ; elles et
  Paramètres partagent la même valeur et se mettent à jour mutuellement en
  direct.
- **Équipement** : le compteur « X / Y places » devient un lien vers
  Paramètres › Règles du jeu, sur la capacité du sac.

## Contraintes

- Conserver les effets de bord actuels des écritures (`main/ipc/index.ts`) :
  déplacement de la sortie, rafraîchissement des murs, diffusion aux
  téléphones pour `monnaies` et `sac.capacite`, redémarrage du serveur mobile.
- Les réglages « en direct » de l'écran des joueurs restent **non persistés**
  (mémoire du processus principal, `main/display.ts`) : Paramètres montre et
  modifie l'état courant.
- Paramètres reste ouvrable sans campagne : les rubriques de campagne sont
  alors grisées avec une phrase, et la recherche n'y renvoie que l'indication.
- Ton et vocabulaire de l'interface : ceux de l'existant (tutoiement dans la
  fiche, phrases courtes, `Tete` / `Ligne` / `Bloc` / `Seg` / `Curseur`).

## Laissé au constructeur

- La forme exacte du registre des réglages (déclaratif vs composants
  enregistrés) et son emplacement.
- L'algorithme de correspondance, dans le cadre ci-dessus.
- La mise en page des résultats et le découpage de `Parametres.tsx` (1 100
  lignes ; le découper par rubrique est bienvenu).
- Comment faire « se mettre à jour mutuellement » les commandes rapides et
  Paramètres pour l'état en mémoire (abonnement existant ou nouveau).

## Choix faits par Claude (à vérifier)

- Les synonymes de recherche, écrits à la main par réglage.
- Joueurs de la campagne déplacés dans Paramètres › La campagne (la fenêtre
  qui les portait disparaît).
- Écran d'attente, Sons et réglages « en direct » ajoutés à Paramètres.
- Taille des vignettes rangée dans « Le poste » ; zoom de l'éditeur ajouté.
- Le compteur de places de l'Équipement devient un lien.
- Monnaies : gardent leur brouillon et leur « Appliquer », seule exception à
  l'enregistrement immédiat (sinon une monnaie d'essai serait figée).
- Volume général et déclenchement auto des sons : restent en mémoire, rangés
  « en direct » ; les deux volumes restent distincts.
- L'« Appliquer » de l'éditeur de fiche n'écrit plus les règles ; le lien vers
  Paramètres ferme l'éditeur (avec la confirmation existante).
- Santé mentale : seules les jauges appliquées sont proposées.
- Le carnet de joueurs s'ouvre par-dessus Paramètres.
