# Surligneur du Paravent — conception

## Pourquoi

Pendant la partie, le MJ lit au Paravent les textes d'un moment, la fiche d'un lieu ou une
annexe. Il veut **savoir ce qui est fait ou pas** : surligner au feutre ce qui a été joué,
vu, dit, pour voir d'un coup d'œil ce qu'il reste.

## Ce que veut l'utilisateur (ses décisions)

- Un **surligneur dans le Paravent**, sur les **moments, les lieux et les annexes**.
- **Mode surligneur** : on l'active, puis chaque glissé de souris sur le texte surligne
  le passage, comme un feutre.
- **Interrupteur sur le même feutre** : glisser sur un passage déjà surligné le
  dé-surligne. Pas de gomme séparée.
- Le surlignage **persiste** d'une séance à l'autre ; rien ne s'efface tout seul.
- **Effacement par document** : partiel (l'interrupteur ci-dessus) ou **total** (tout le
  surlignage d'un document précis, d'un coup).
- **Le surlignage appartient au texte, pas à l'endroit où on le lit** : un document
  rattaché à deux moments et rangé en annexe montre le même surlignage partout ;
  surligner ou effacer d'un côté se voit de l'autre. Même chose pour un article épinglé
  par un bâtiment et relu sur ses étages.
- **Sur la fiche d'un lieu, tout le texte lisible est surlignable**, y compris les notes
  des PNJ présents et le texte des objets (qui appartiennent au PNJ / à l'objet, donc
  partagés avec la réserve et les autres lieux, selon la règle ci-dessus).
- **Réinitialiser la séance** (Horloge de séance, `ReinitSeance.tsx`) gagne une case
  « Retirer tous les surlignages », **décochée par défaut**, qui vide les surlignages de
  toute la campagne.

## Ce qui a été posé sans objection de l'utilisateur

Proposé par Claude, l'utilisateur n'a pas corrigé :

- Le surlignage est **une marque privée du MJ** : jamais sur l'écran des joueurs, jamais
  sur les portables, même quand un texte est diffusé.
- **Une seule couleur** : il veut dire « fait ».
- Le surlignage **ne modifie pas le texte** : le texte reste réécrivable dans l'Éditeur
  (ou sur place), et surligner n'est pas écrire.
- En mode surligneur, un clic dans un moment n'ouvre **pas** l'édition sur place
  (`TexteEnPlace`). On sort du mode par le même bouton ou **Échap**.

## Non-buts / anti-buts

- Pas de surligneur hors du Paravent (Éditeur, Chronologie de préparation, Lieux…) : il
  n'y est pas affiché non plus.
- Pas de palette de couleurs, pas d'annotations, pas de commentaires.
- **Anti-but** : qu'un surlignage fuie vers les joueurs ; qu'il altère ou perde du texte ;
  que le mode surligneur casse les cases à cocher, les boutons « montrer » ou les
  vignettes des fiches.

## Où on surligne (état actuel du code)

Dans `src/renderer/src/mj/modules/Pupitre.tsx` :

- **Moments** : les documents rattachés au moment (`beat_item` → `item.body`, HTML Tiptap),
  rendus en `dangerouslySetInnerHTML` dans `.read-body` (~l. 1380). Plus `beat.note`
  (texte brut, `p.mine`).
- **Annexes** : `item.body` (HTML) en `dangerouslySetInnerHTML` (~l. 1200).
- **Lieux** : `FicheCompacte` (`components/FicheDuLieu.tsx`), avec `place.summary`
  (« Ce que voient les joueurs », texte brut via `TexteDeLieu`), les notes, et les
  articles de la fiche (« ce qui peut arriver ici »), qui portent des cases à cocher et des
  boutons.

`FicheCompacte` affiche aussi les notes des PNJ (`c.notes`, ~l. 2012), le texte des
objets (~l. 2260), les titres des articles et scénarios, et le si/alors en deux rendus
(replié sur une ligne, déplié en `<dl>`).

Tout le texte lisible de ces trois vues est surlignable, titres compris ; les contrôles
(cases, boutons, vignettes) ne le sont pas. Un surlignage porte sur le **champ** (le
si/alors, une note de PNJ…), il se voit donc sur les deux rendus replié et déplié.

## Choix de Claude (à vérifier par l'utilisateur)

- **Stockage à part, pas dans le texte.** Les textes sont de formats mêlés (HTML Tiptap
  pour les items, texte brut pour les lieux). Mettre une marque dans `item.body` ferait
  passer le surlignage dans l'Éditeur et dans toute diffusion, et l'Éditeur Tiptap le
  perdrait (pas d'extension Highlight). On stocke donc les surlignages dans une **table
  dédiée** de la campagne : une ligne par passage, avec la cible (sorte de document + id +
  champ), le décalage de début et de fin dans le **texte brut** du champ, et le passage
  cité (pour se raccrocher si le texte a bougé).
- **Si le texte a été réécrit** : on recherche le passage cité près de son ancienne place ;
  introuvable, le surlignage disparaît sans bruit. Pas d'alerte.
- **Fusion** : surligner un passage qui touche ou chevauche un surlignage existant les fond
  en un seul. L'interrupteur : si le glissé commence dans du surligné, il dé-surligne la
  portée glissée (en coupant au besoin) ; sinon il surligne.
- **Clé de stockage** : la cible est l'entité propriétaire du texte (item, lieu, carte
  d'article, PNJ, objet…) + le champ, jamais l'endroit de lecture.
- **Effacement total d'un document** : un petit bouton « Effacer le surlignage » à côté
  du titre de chaque bloc qui a son titre — chaque document rattaché à un moment (la note
  du moment va avec le moment, dans son en-tête), l'annexe lue, et la fiche du lieu
  entière (en-tête de la fiche : résumé, notes, articles, PNJ, objets d'un coup). Visible
  seulement quand il y a du surlignage à effacer. Comme le surlignage est partagé,
  l'effacer d'un document l'efface partout où ce document apparaît.
- **Ctrl+Z / Ctrl+Y** (décision de l'utilisateur, malgré la règle de `defaire.ts` qui
  exclut les marques de jeu comme « Joué ») : la table des surlignages est suivie par
  `src/main/defaire.ts`, libellé « Surlignage ». **Un glissé = un pas**, un effacement
  total = un pas : deux glissés rapprochés ne doivent pas se fondre dans la rafale de
  1,5 s. Le défaire reste la pile commune : au Paravent, un Ctrl+Z peut donc défaire une
  modification de préparation antérieure si aucun surlignage ne la suit — accepté.
  Le Ctrl+Z qui défait une réinitialisation rend aussi les surlignages retirés (même pas).
- **Bouton du mode** : dans la barre du Paravent, avec un raccourci clavier libre
  (au choix du constructeur, à vérifier contre les raccourcis existants). Curseur feutre
  et indication visible du mode actif. Le mode est retenu tant qu'on reste au Paravent,
  oublié en le quittant.
- **Couleur** : un jaune feutre lisible en thème clair comme sombre, en variable CSS.

## Laissé au constructeur

- Le schéma exact de la table, la migration, les appels IPC/preload.
- La façon de poser les surlignages sur un rendu `dangerouslySetInnerHTML`
  (CSS Custom Highlight API d'Electron, ou enveloppement en `<mark>` à l'affichage).
- Le calcul des décalages à partir de la sélection DOM et le raccrochage.
- Tests unitaires de la logique pure (fusion, interrupteur, raccrochage).
