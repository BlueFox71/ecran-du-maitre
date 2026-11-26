# Carnet des chasseurs — plan de construction

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un onglet « Carnet » sur le téléphone de chaque joueur, où il entoure ou barre des indices et des types d'entités, voit les marques des autres en pâle, et que le MJ suit dans l'onglet Portables du Paravent.

**Architecture:** Deux tables dans `projet.db` : les éléments du carnet (campagne) et les marques (séance × personnage × élément). Un dépôt `carnetChasse` porte toute la logique ; le serveur des téléphones (`mobile.ts`) ajoute le carnet à l'état qu'il pousse déjà et une route pour marquer ; le poste du MJ lit le même dépôt par IPC. Aucune déduction nulle part.

**Tech Stack:** Electron, TypeScript, React, better-sqlite3, Vitest (`npm test` = `scripts/vitest-electron.mjs`), `npm run typecheck`.

**Spec:** `docs/superpowers/specs/2026-11-27-carnet-indices-design.md`

## Global Constraints

- Aucune déduction automatique : rien ne se barre, ne se filtre ni ne se compte tout seul.
- Cycle d'un toucher : rien → entouré → barré → rien.
- Marques rattachées à la séance active ; une séance neuve ou dupliquée part vierge ; les marques ne sont jamais copiées par `copieSeance`.
- Une marque appartient au personnage attaché au téléphone ; téléphone sans personnage, ou spectateur : pas de carnet (le spectateur peut le lire, pas marquer — `exige(res, url)` sans `lecture`).
- On ne montre que les marques des personnages présents (`chars.listJoueurs()`).
- Mes marques : cercle doré `var(--brass)`, trait rouge `var(--blood)` en travers et mot pâle `var(--text-faint)` ; tracés « à la main », un peu de travers.
- Marques des autres : pastilles à droite de la ligne, couleur du pion (`c-<color>`), faible opacité (0.45), initiale du joueur ; cercle = entouré, pastille barrée = barré.
- Campagne sans aucun élément : pas d'onglet Carnet sur les téléphones, pas de section dans Portables.
- Listes de départ posées une seule fois, seulement si les règles valent `'fantomes'` ou `null`, et seulement si la campagne n'a encore aucun élément.
- Modifier les listes (IPC `carnetChasse:*`) se défait au Ctrl+Z, libellé « Carnet » ; les marques (HTTP) ne se défont pas.
- Noms de départ, exacts et dans cet ordre :
  - Indices : `EMF élevé`, `Spirit Box`, `Températures glaciales`, `Empreintes UV`, `Traces dans le sel`, `Orbes sur caméra`, `Écriture automatique`, `Planche Ouija`, `Voix et murmures`, `Détecteur de mouvement`, `Polaroïd / miroir`, `Objets manipulés ou lancés`
  - Entités : `Fantôme`, `Esprit`, `Poltergeist`, `Ombre`, `Revenant`, `Banshee`, `Spectre`, `Djinn`, `Yurei`, `Oni`, `Yokai`, `Hantu`, `Goryo`, `Onryo`, `Les Jumeaux`, `Obake`, `Deogen`, `Démon`
- Le module `src/main/carnet.ts` existe déjà (carnet de joueurs du poste) : ne pas le toucher ; tout ce qui est neuf s'appelle `carnetChasse`.
- Fichiers en LF, commentaires en français dans le ton du code existant.

## Review Focus

1. **Deux téléphones du même personnage** (téléphone + tablette) : une marque posée sur l'un apparaît sur l'autre comme *sienne*, pas comme celle d'un autre. → test Task 2 `les marques d'un personnage sont les siennes sur tous ses appareils` (le dépôt ne connaît que le personnage).
2. **Le MJ retire un élément en pleine séance** : ses marques disparaissent avec lui, aucun téléphone ne garde une ligne fantôme. → test Task 2 `retirer un élément emporte ses marques`.
3. **Un joueur marque un élément d'une autre campagne ou un id inventé** (requête forgée) : refusé, rien n'est écrit. → test Task 2 `refuse un élément qui n'est pas de la campagne`.
4. **Changer de séance active** : les carnets se vident, revenir retrouve les marques. → test Task 2 `les marques suivent la séance active`.
5. **Rouvrir une campagne déjà pré-remplie dont le MJ a vidé les listes** : elles ne reviennent pas. → test Task 2 `les listes de départ ne se posent qu'une fois`.

---

### Task 1: Le vocabulaire partagé

**Files:**
- Create: `src/shared/carnetChasse.ts`
- Test: `src/shared/carnetChasse.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type GenreCarnet = 'indice' | 'entite'
  export type EtatMarque = 'entoure' | 'barre'
  export interface ElementCarnet { id: number; genre: GenreCarnet; nom: string }
  export interface MarqueCarnet { characterId: number; elementId: number; etat: EtatMarque }
  export interface JoueurCarnet { characterId: number; nom: string; color: string; initiales: string }
  /** Ce qu'un téléphone et le MJ reçoivent : les éléments, les marques de la séance (présents seulement), qui est qui. */
  export interface CarnetVu { elements: ElementCarnet[]; marques: MarqueCarnet[]; joueurs: JoueurCarnet[] }
  export const INDICES_DEPART: readonly string[]   // les 12, ordre des Global Constraints
  export const ENTITES_DEPART: readonly string[]   // les 18
  export function marqueSuivante(e: EtatMarque | null): EtatMarque | null
  ```

- [ ] **Step 1: Write the failing test** — `marqueSuivante` : `null → 'entoure'`, `'entoure' → 'barre'`, `'barre' → null` ; `INDICES_DEPART.length === 12`, `ENTITES_DEPART.length === 18`, `INDICES_DEPART[0] === 'EMF élevé'`, `ENTITES_DEPART.at(-1) === 'Démon'`, aucun doublon dans chacune.
- [ ] **Step 2: Run** `npm test -- src/shared/carnetChasse.test.ts` — Expected: FAIL (module introuvable).
- [ ] **Step 3: Implement** `src/shared/carnetChasse.ts` avec les noms exacts des Global Constraints.
- [ ] **Step 4: Run** `npm test -- src/shared/carnetChasse.test.ts` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(carnet): vocabulaire partagé du carnet des chasseurs`

### Task 2: Les tables et le dépôt

**Files:**
- Modify: `src/main/db/schema.ts` (migration `id: 100`, après la 99)
- Create: `src/main/db/repos/carnetChasse.ts`
- Test: `src/main/db/test/carnetChasse.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces (`src/main/db/repos/carnetChasse.ts`):
  ```ts
  export function elements(): ElementCarnet[]                         // campagne active, indices puis entités, par ord puis id
  export function ajouterElement(genre: GenreCarnet, nom: string): ElementCarnet | null  // nom trimé ; vide → null ; ord = fin de son genre
  export function renommerElement(id: number, nom: string): void      // vide → ne fait rien
  export function retirerElement(id: number): void                    // ses marques partent (ON DELETE CASCADE)
  export function ordonner(genre: GenreCarnet, ids: number[]): void   // ord = index dans ids ; ids étrangers ignorés
  export function poserListesDeDepart(): boolean                      // true si posées maintenant
  export function marquesDeLaSeance(): MarqueCarnet[]                 // séance active, tous personnages
  export function marquer(characterId: number, elementId: number, etat: EtatMarque | null): boolean // false si élément hors campagne
  ```

Migration 100 :
```sql
CREATE TABLE carnet_element (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL REFERENCES campaign(id) ON DELETE CASCADE,
  genre       TEXT NOT NULL CHECK (genre IN ('indice', 'entite')),
  nom         TEXT NOT NULL,
  ord         INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_carnet_element ON carnet_element(campaign_id, genre, ord);
CREATE TABLE carnet_marque (
  session_id   INTEGER NOT NULL REFERENCES game_session(id) ON DELETE CASCADE,
  character_id INTEGER NOT NULL REFERENCES character(id) ON DELETE CASCADE,
  element_id   INTEGER NOT NULL REFERENCES carnet_element(id) ON DELETE CASCADE,
  etat         TEXT NOT NULL CHECK (etat IN ('entoure', 'barre')),
  PRIMARY KEY (session_id, character_id, element_id)
);
```

`poserListesDeDepart` : clé `setting` `carnet.depart` déjà posée → `false`. Sinon, la poser dans tous les cas, puis insérer `INDICES_DEPART` et `ENTITES_DEPART` seulement si `lireCampagne(reglages.tous()).regles` vaut `'fantomes'` ou `null` **et** que la campagne n'a aucun `carnet_element` ; renvoyer `true` si insérées.

- [ ] **Step 1: Write the failing tests** (base d'essai `./base` : `ouvrirBaseEssai`, `seance`, `activer`, `pj`) :
  - `les listes de départ ne se posent qu'une fois` : 1er appel → `true`, 12 indices et 18 entités dans l'ordre ; on retire tout, 2e appel → `false`, `elements()` vide.
  - `pas de listes de départ pour une campagne WoW` : `reglages.poser('regles', 'wow')` puis `poserListesDeDepart()` → `false`, `elements()` vide.
  - `ajouter, renommer, ordonner` : `ajouterElement('indice', '  Odeur de soufre ')` → nom `'Odeur de soufre'`, en dernier de son genre ; `ajouterElement('entite', '  ')` → `null` ; `ordonner` inverse deux éléments et `elements()` suit.
  - `les marques suivent la séance active` : `s1`, `s2`, un `pj` ; actif `s1`, `marquer(c, e, 'entoure')` ; actif `s2` → `marquesDeLaSeance()` vide ; actif `s1` → `[{ characterId: c, elementId: e, etat: 'entoure' }]`.
  - `marquer null efface, marquer deux fois remplace` : `'entoure'` puis `'barre'` → une seule marque `'barre'` ; puis `null` → vide.
  - `les marques d'un personnage sont les siennes sur tous ses appareils` : deux appels `marquer` pour le même personnage (deux « appareils ») → une seule ligne.
  - `retirer un élément emporte ses marques` : marque posée, `retirerElement(e)` → `marquesDeLaSeance()` vide.
  - `refuse un élément qui n'est pas de la campagne` : `marquer(c, 999999, 'entoure')` → `false`, rien d'écrit.
- [ ] **Step 2: Run** `npm test -- src/main/db/test/carnetChasse.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** la migration 100 et le dépôt.
- [ ] **Step 4: Run** `npm test` — Expected: tout PASS (dont `schema.test.ts`).
- [ ] **Step 5: Commit** `feat(carnet): tables et dépôt du carnet des chasseurs`

### Task 3: Le pont du poste du MJ

**Files:**
- Modify: `src/main/project.ts` (appeler `carnetChasse.poserListesDeDepart()` juste après `fsLib.rangerTextesDesMoments()`)
- Modify: `src/main/ipc/index.ts` (canaux `carnetChasse:*`)
- Modify: `src/main/defaire.ts` (`MODULES` : `carnetChasse: 'Carnet'`)
- Modify: `src/main/mobile.ts` (exporter `carnetVu(): CarnetVu` — voir Interfaces)
- Modify: `src/preload/index.ts` (espace `carnetChasse`)

**Interfaces:**
- Consumes: Task 2.
- Produces:
  - `mobile.ts` : `export function carnetVu(): CarnetVu` — `elements()`, `marquesDeLaSeance()` filtrées sur les personnages de `chars.listJoueurs()`, `joueurs` = ces mêmes personnages (`characterId`, `nom`, `color` via `colorFor` si absente, `initiales` via `initialsOf`). C'est la seule fabrique de `CarnetVu`, pour les téléphones comme pour le MJ.
  - `mobile.ts` : `export function carnetChange(): void` — `broadcast()` puis `versMj('carnetChasse:change', null)`.
  - IPC : `carnetChasse:etat` → `CarnetVu` ; `carnetChasse:ajouter(genre, nom)`, `carnetChasse:renommer(id, nom)`, `carnetChasse:retirer(id)`, `carnetChasse:ordonner(genre, ids)` → chacun appelle le dépôt puis `mobile.carnetChange()` et rend `CarnetVu`.
  - Preload : `window.jdr.carnetChasse.{ etat(), ajouter(genre, nom), renommer(id, nom), retirer(id), ordonner(genre, ids), onChange(cb) }` (`onChange` écoute `carnetChasse:change`, rend la fonction de désabonnement, comme `onMotsChanges`).

- [ ] **Step 1: Implement** les branchements ci-dessus.
- [ ] **Step 2: Run** `npm run typecheck` — Expected: aucune erreur.
- [ ] **Step 3: Run** `npm test` — Expected: tout PASS.
- [ ] **Step 4: Commit** `feat(carnet): listes du carnet au poste du MJ, Ctrl+Z compris`

### Task 4: Le carnet sur le téléphone

**Files:**
- Modify: `src/main/mobile.ts` (champ `carnet` de `etatJoueur`, route `/api/carnet`)
- Create: `src/renderer/src/mobile/Carnet.tsx`
- Modify: `src/renderer/src/mobile/Mobile.tsx` (type `Etat`, onglet `'carnet'`)
- Modify: `src/renderer/src/styles/mobile.css`

**Interfaces:**
- Consumes: Task 3 (`carnetVu`, `carnetChange`), Task 1 (`marqueSuivante`).
- Produces:
  - Dans l'état du téléphone : `carnet: (CarnetVu & { moi: number | null }) | null` — `null` si la campagne n'a aucun élément ; `moi` = id du personnage du joueur (null : pas de personnage).
  - Route `POST /api/carnet?t=<jeton>` corps `{ elementId: number, etat: 'entoure' | 'barre' | null }` : `exige(res, url)` (spectateur refusé) ; pas de personnage → 403 `{ erreur: 'Aucun personnage ne t’est attribué.' }` ; `marquer` → `false` → 400 `{ erreur: 'Indice inconnu.' }` ; sinon `carnetChange()` puis 200 `{ ok: true }`.
  - `Carnet.tsx` : `export function Carnet({ etat, jeton }: { etat: Etat; jeton: string }): JSX.Element` — deux sections « Indices » et « Entités » ; un toucher envoie `marqueSuivante(maMarque)` (le téléphone envoie l'état voulu, pas un « bascule », pour qu'un double envoi ne fasse pas tourner deux fois) et affiche tout de suite le nouvel état en attendant le flux ; erreur → message court, retour à l'état reçu.
  - Onglet : `Onglet` gagne `'carnet'` (et `ongletDe` l'accepte) ; icône `✎`, libellé `Carnet` ; montré seulement si `etat.carnet` n'est pas `null` ; s'il disparaît alors qu'on est dessus, retour à `'fiche'`.

- [ ] **Step 1: Implement** le serveur (champ + route).
- [ ] **Step 2: Implement** `Carnet.tsx`, l'onglet et le style (formes des Global Constraints ; la maquette validée est `.superpowers/brainstorm/1724-1795733502/content/carnet.html`).
- [ ] **Step 3: Run** `npm run typecheck` puis `npm test` — Expected: PASS.
- [ ] **Step 4: Verify in the app** : `npm run dev`, séance « Référence dev — La scierie », deux navigateurs appairés à deux personnages différents (un en fenêtre de 390 px de large). Toucher trois fois une ligne : entouré, barré, rien. L'autre navigateur voit la pastille à la couleur du premier, pâle, à droite de la ligne. Changer la séance active au poste : les deux carnets se vident.
- [ ] **Step 5: Commit** `feat(carnet): l'onglet Carnet sur les téléphones`

### Task 5: Les carnets dans l'onglet Portables

**Files:**
- Create: `src/renderer/src/mj/components/CarnetsJoueurs.tsx`
- Modify: `src/renderer/src/mj/modules/Pupitre.tsx` (onglet `portables` : `<CarnetsJoueurs />` sous `<Portables />`, avant `<MotsSecrets />`)
- Modify: `src/renderer/src/styles/app.css`

**Interfaces:**
- Consumes: Task 3 (`window.jdr.carnetChasse.etat`, `onChange`).
- Produces: `export function CarnetsJoueurs(): JSX.Element | null` — `null` si aucun élément. Lecture seule. Par élément (indices puis entités) : son nom et les pastilles des joueurs qui l'ont marqué (mêmes formes que sur le téléphone, mais **pleine opacité** : ici, rien n'est « à moi »). Un élément sans marque reste listé, en pâle. Doit tenir dans la colonne du Paravent (~210 px utiles) sans défilement horizontal.

- [ ] **Step 1: Implement** le composant et son style.
- [ ] **Step 2: Run** `npm run typecheck` — Expected: aucune erreur.
- [ ] **Step 3: Verify in the app** : avec les deux navigateurs de la Task 4, une marque posée sur un téléphone apparaît dans Paravent › Portables sans recharger ; la colonne à 1384×716 (taille dev) ne défile pas en largeur.
- [ ] **Step 4: Commit** `feat(carnet): les carnets des joueurs dans l'onglet Portables`

### Task 6: La rubrique « Carnet » des paramètres

**Files:**
- Create: `src/renderer/src/mj/components/parametres/rubriques/carnet.tsx`
- Modify: `src/renderer/src/mj/components/parametres/registre.tsx` (type `Rubrique` + `'carnet'`, entrée dans `RUBRIQUES` après `'sante'`, `...carnet.reglages` dans `REGLAGES`)
- Modify: `src/renderer/src/mj/components/parametres/chercher.test.ts` (un cas)

**Interfaces:**
- Consumes: Task 3 (preload `carnetChasse`).
- Produces: rubrique campagne `{ id: 'carnet', nom: 'Carnet des chasseurs', quoi: 'Les indices et les entités que les joueurs entourent ou barrent sur leur téléphone. Rien ne se déduit tout seul : c’est le livre qui fait le travail.' }` ; deux réglages `pleine: true` : `carnet.indices` (nom « Indices », mots `['indice', 'preuve', 'emf', 'spirit box', 'phasmo']`) et `carnet.entites` (nom « Entités », mots `['entité', 'fantôme', 'type', 'démon', 'phasmo']`). Chacun : la liste du genre, renommer en place, retirer, monter/descendre, ajouter en bas.

- [ ] **Step 1: Write the failing test** dans `chercher.test.ts` : chercher `phasmo` trouve `Indices` avec le chemin `'La campagne › Carnet des chasseurs'`.
- [ ] **Step 2: Run** `npm test -- src/renderer/src/mj/components/parametres/chercher.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** la rubrique.
- [ ] **Step 4: Run** `npm test` puis `npm run typecheck` — Expected: PASS.
- [ ] **Step 5: Verify in the app** : renommer « Spirit Box » se voit aussitôt sur les téléphones, les marques restent ; retirer un indice marqué le fait disparaître partout ; Ctrl+Z le ramène, au poste comme sur les téléphones.
- [ ] **Step 6: Commit** `feat(carnet): les listes du carnet dans les paramètres`
