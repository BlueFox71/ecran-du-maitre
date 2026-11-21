# Objets et pochette par séance, avec import depuis les séances précédentes

## Pourquoi

À la création de la séance 5 (Le Jardin de Jade, id 9, campagne « Chasse aux
fantômes », id 4), le MJ a récupéré tous les objets de la campagne : photos des
habitants, documents de la scierie, objets du Cercle, pochette de la scierie. Il ne
voulait que l'équipement chasseur de fantôme.

Aujourd'hui, les fiches d'objets (`objet`), les familles (`objet_famille`), les
inventaires (`inventaire`) et la pochette (`pochette`, `pochette_onglet`) sont
communs à la campagne. Seuls les emplacements (`objet_placement.session_id`) sont
propres à chaque séance, et une séance neuve recopie en partie ceux de la précédente.

Les choix marqués *(choix de Claude)* n'ont pas été discutés avec le MJ. Il peut les
remettre en cause à la relecture.

## Ce qu'on veut (décidé avec le MJ)

1. **Une nouvelle séance démarre vide** : aucune famille, aucun objet, aucun
   inventaire, une pochette vide. Les huit familles d'usine ne sont **pas**
   recréées : les familles n'arrivent que par l'import, ou parce que le MJ les crée.
2. **Les familles, les objets, les inventaires et la pochette sont propres à chaque
   séance.** Les copies sont indépendantes : modifier un objet, sa fiche (nom,
   description, image, effets…), une famille, un inventaire ou un document de la
   pochette d'une séance ne touche jamais une autre séance, dans un sens comme dans
   l'autre.
3. **Bouton « Importer depuis une séance précédente »** dans la séance ouverte :
   - on choisit la séance d'origine ;
   - **Objets** : les objets de la séance d'origine sont rangés par famille. Une case
     coche ou décoche toute une famille, et on peut aussi cocher ou décocher chaque
     objet séparément ;
   - **Pochette** : on peut choisir des onglets et des documents à reprendre ;
   - l'import **copie** ce qui est coché.
4. **Où arrive un objet importé** : à sa place **de départ** (`init_*`) dans la
   séance d'origine.
   - Départ dans un inventaire : l'inventaire est copié dans la séance en cours, s'il
     n'y a pas déjà été copié pendant cet import, et l'objet arrive dedans, avec sa
     quantité et son état de départ.
   - Départ sur un personnage : **aucune place**. L'objet va dans la réserve, et le
     MJ le donnera lui-même. Aucun objet n'arrive sur un personnage.
   - Départ dans un lieu : la réserve aussi, puisque les lieux sont propres à chaque
     séance. *(Proposé par Claude, validé avec le reste.)*
   - Plusieurs exemplaires au départ, par exemple un dans le Camion et un sur un
     personnage : **une seule fiche** est copiée. Seuls les exemplaires partis d'un
     inventaire reçoivent une place. S'il n'y en a aucun, l'objet est dans la
     réserve. *(Choix de Claude.)*
   - Un exemplaire sans `init_port` part de sa place actuelle. *(Choix de Claude.)*
5. **Familles à l'import** : la famille d'un objet importé est copiée dans la séance
   en cours. Si une famille du **même nom** existe déjà dans la séance, par exemple
   copiée par un import précédent, l'objet va dans celle-là.
6. **Documents de pochette importés** : ils arrivent dans la copie de leur onglet,
   **cachés** (`visible = 0`) et **non lus**, comme si le MJ venait de les ajouter.
   Un document donné à un seul joueur garde son destinataire. *(Choix de Claude.)*
7. Importer deux fois le même objet depuis la même séance donne **deux copies**. On ne
   cherche pas à repérer les doublons. *(Proposé par Claude, validé.)*
8. **Inventaires et pochette** *(choix de Claude)* :
   - un inventaire copié par l'import arrive **non passé à la pochette**
     (`en_pochette = 0`). Le MJ le repasse s'il le veut, et la synchro existante crée
     alors les documents ;
   - les documents de pochette qui viennent d'un inventaire (`pochette.inventaire_id`)
     ne sont **pas proposés** dans l'import de pochette, puisqu'ils suivent leur
     inventaire.

## Dupliquer une séance / la suite (décidé avec le MJ)

`dupliquerSeance` recopie déjà lieux, PNJ, trame (et plateau pour la suite). Elle
recopie désormais **aussi les familles, les objets, les inventaires et la pochette**
de la séance source, en copies indépendantes :

- **Dupliquer** : tout est remis à l'**état de départ**. Les objets reprennent leur
  place `init_*`, sur la copie du lieu, du PNJ ou de l'inventaire ; ceux d'un PJ
  retournent sur ce PJ. Les documents de la pochette sont cachés et non lus. *(Le
  détail de « l'état de départ » pour la pochette est un choix de Claude.)*
- **La suite** : tout est recopié dans l'**état actuel**, comme le plateau : places,
  états, pochette avec ce qui est dévoilé et lu.

Contrairement à l'import, ici les objets peuvent rester sur un personnage, puisque la
duplication recopie une séance entière.

## Données existantes : la migration

Une migration de `schema.ts`, livrée à tous les utilisateurs, avec des règles
générales. **Avant de la lancer, une sauvegarde de `projet.db`.** Elle ne doit rien
perdre.

- On ajoute `session_id` à `objet`, `objet_famille`, `inventaire`, `pochette` et
  `pochette_onglet`.
- **Chaque séance reçoit sa propre copie** des objets qu'elle utilise (ceux qui y ont
  un emplacement), avec leurs familles et leurs inventaires. Les emplacements de la
  séance pointent vers ces copies, et chaque objet garde sa place (état actuel et
  `init_*`). Les liens `lieu_carte_objet` et `lieu_scenario_objet` d'un lieu
  pointent vers les copies de la séance du lieu.
- **Objets sans aucun emplacement** : ils vont dans la séance active de leur
  campagne, ou dans la plus récente. *(Choix de Claude.)*
- **Inventaires et familles qu'aucune séance n'utilise** : même règle, séance active
  ou plus récente. *(Choix de Claude.)*
- **Campagne sans aucune séance** : ses lignes gardent `session_id = NULL`. La
  première séance créée les récupère. *(Choix de Claude.)*
- **La pochette** (onglets, documents, états « dévoilé » et « lu ») est copiée telle
  quelle dans **chaque séance** de la campagne, puisque rien ne dit à quelle séance
  appartient chaque document. On accepte les doublons pour ne rien perdre. Les
  documents qui viennent d'un inventaire ne sont copiés que dans les séances qui ont
  cet inventaire : ailleurs, ce ne sont que des images d'un inventaire absent.
  *(Choix de Claude.)*
- `objet_famille.masquee_depuis` : une famille masquée à partir d'une séance n'est
  pas copiée dans cette séance ni dans les suivantes. Après la migration, la colonne
  ne sert plus.

### Opération ponctuelle sur la base du MJ (après la migration)

À faire une fois, à part, sur `Chasse aux fantômes` :

- **la séance 5** (id 9) est **remise à vide** : on supprime ses objets, ses
  emplacements, ses familles, ses inventaires et sa pochette. Les états des
  personnages (`character_seance`) ne bougent pas. Le MJ y importera lui-même
  l'équipement chasseur de fantôme ;
- la **séance 3** (id 4) n'a aucun objet. Elle reçoit seulement sa copie de la
  pochette.

Sauvegarde de `projet.db` avant cette opération aussi.

## Ce qui change dans le comportement existant

- **Nouvelle séance** (`createSession`, menu) : rien n'est créé.
- **Entrer dans une séance** (`preparerSeance`) : on recopie toujours les jauges et
  les caractéristiques de la séance d'avant, mais **plus les affaires** des
  personnages.
- **Reprendre un lieu ou un PNJ d'une autre séance** (`duplicatePlace`,
  `duplicatePnj`) : les objets qu'ils tiennent sont copiés comme des fiches de la
  séance en cours, avec leur famille (règle du même nom). Les liens
  `lieu_carte_objet` et `lieu_scenario_objet` pointent vers ces copies.
- **Réinitialiser une séance** (`reinitialiser.ts`) ne touche que les objets de la
  séance.
- **Familles** : le masquage (`masquee_depuis`) disparaît. On supprime simplement une
  famille de la séance.
- **Inventaire passé à la pochette** (`inventaire.en_pochette`,
  `pochette.inventaire_id`, `pochette_onglet_id`) : tout reste à l'intérieur d'une
  seule séance.
- **Téléphones** (`mobile.ts`) : tout ce qu'ils lisent (objets, inventaires,
  pochette) se filtre sur la séance ouverte.
- L'unicité de la pochette passe de `(campaign_id, item_id, player_key)` à
  `(session_id, item_id, player_key)`.
- La création d'une famille, d'un objet, d'un inventaire, d'un onglet ou d'un
  document de pochette se rattache à la séance ouverte.

## Ce qui reste au constructeur

- La place du bouton d'import dans l'interface et la forme de l'écran (fenêtre en
  deux étapes, onglets Objets / Pochette…), dans le style des fenêtres existantes,
  comme celle de la duplication de séance dans `Fiches.tsx`.
- La factorisation d'un « copier un objet vers une séance », avec ses variantes
  état de départ ou état actuel et sa table de correspondance (objets, familles,
  inventaires), commun à l'import, à la migration, à la reprise de lieu ou de PNJ et
  à la duplication.
- Les tests (vitest) : migration sur une copie de la base réelle, import,
  duplication, isolation entre séances.

## Hors sujet

- Les fichiers eux-mêmes (images, documents de la bibliothèque) ne sont pas
  dupliqués : seules les lignes de base qui les référencent le sont.
- Les lieux et les PNJ gardent leur fonctionnement actuel.
