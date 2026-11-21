# Objets et pochette par séance — plan de réalisation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** familles, objets, inventaires et pochette deviennent propres à chaque
séance. Une séance neuve démarre vide, et un écran d'import copie depuis une séance
précédente.

**Architecture :** une colonne `session_id` sur les cinq tables. Un module de copie
unique (`copieSeance.ts`) sert à quatre usages : la migration des données, la
duplication de séance, la reprise de lieu ou de PNJ, et l'import. Il expose
`rattacherASeance`, qui rattache à une séance tout ce que ses emplacements et ses
lieux désignent ailleurs, en créant des copies au besoin. L'import a son propre
module (`importSeance.ts`) et sa propre fenêtre (`ImporterDUneSeance.tsx`).

**Tech Stack :** Electron, TypeScript, better-sqlite3 (compilé pour Electron),
React, vitest.

**Spec :** `docs/superpowers/specs/2026-11-22-objets-par-seance-design.md`. À lire
avant toute tâche.

## Contraintes globales

- better-sqlite3 est compilé pour Electron : les tests qui touchent la base passent
  par `npm test`, qui lance vitest **sous le Node d'Electron** (Tâche 1). Les tests
  existants doivent continuer à passer.
- Les tests de base mockent `electron` :
  `vi.mock('electron', () => ({ app: { getPath: () => '' }, BrowserWindow: { getAllWindows: () => [] } }))`.
  `closeDb()` appelle `BrowserWindow.getAllWindows`.
- `copieSeance.ts` et `importSeance.ts` n'appellent **jamais**
  `activeSessionId()` ni `activeCampaignId()` : la séance cible est toujours passée
  en paramètre. La migration les appelle avant qu'aucune séance ne soit choisie.
- Les commentaires et les noms sont en français, dans le style du code existant :
  verbes à l'infinitif, commentaires qui disent pourquoi.
- Documents de pochette importés ou dupliqués « au départ » : `visible = 0`, aucune
  ligne `pochette_lu`.
- Copie d'objet : la fiche entière est recopiée par `copierLigne('objet', …)`. Les
  fichiers (`item`) ne sont jamais dupliqués.
- Sauvegarde : `projet.db` est copié en `projet.db.avant-migration-<id>` avant de
  jouer une migration marquée `sauvegarde: true`.
- Version : 1.8.0, avec un `RELEASE_NOTES.md` réécrit (voir `CLAUDE.md`).
- Commits : messages en français, au style du dépôt (« Objets : … »), terminés par
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Points d'attention en relecture

1. **Document déjà présent dans la pochette cible** : l'unicité
   `(session_id, item_id, player_key)` fait échouer l'insertion. L'import le saute
   sans erreur et ne le compte pas. Testé en Tâche 6.
2. **Importer depuis la séance ouverte elle-même** : refusé côté serveur
   (`Error('Choisissez une autre séance')`), et la fenêtre ne la propose pas. Testé
   en Tâche 6.
3. **Supprimer une séance** emporte ses familles, objets, inventaires et pochette
   (`ON DELETE CASCADE`), sans toucher ceux des autres séances. Testé en Tâche 2.
4. **Objet copié vers une séance où sa famille est masquée** (migration) : la copie
   part sans famille (`famille_id = NULL`) plutôt que de faire revivre la famille.
   Testé en Tâche 3.
5. **Téléphones après un import** : la pochette et les inventaires des téléphones
   se rafraîchissent (`mobile.broadcast()`, `pochette:changee`). Vérifié en Tâche 7.

---

### Tâche 1 : faire tourner les tests de base sous Electron

**Files:**
- Create: `scripts/vitest-electron.mjs`
- Create: `src/main/db/test/base.ts`
- Create: `src/main/db/test/base.test.ts`
- Modify: `package.json` (script `test`)

**Interfaces:**
- Produces :
  - `ouvrirBaseEssai(): Database.Database` : ouvre un `projet.db` neuf dans un
    dossier temporaire avec `openDbAt(fichier, 'Essai')` et le rend ;
  - `fermerBaseEssai(): void` ;
  - `seance(label: string): number` : insère une `game_session` dans la campagne
    active, avec `ord` à la suite, et rend son id. Elle **n'active pas** la séance ;
  - `activer(sid: number): void` : met `active = 1` sur cette séance seulement ;
  - `pj(nom: string): number` et `pnj(nom: string, sid: number): number` : insèrent
    une ligne `character` minimale ;
  - `objet(sid: number, nom: string, familleId?: number | null): number` ;
  - `famille(sid: number, nom: string): number` ;
  - `inventaire(sid: number, nom: string): number` ;
  - `placer(objetId: number, sid: number, ou: { port: 'pj' | 'inventaire' | 'lieu' | 'corbeille'; characterId?: number; inventaireId?: number; placeId?: number; init?: { port: string; characterId?: number; inventaireId?: number; placeId?: number } }): number`
  - `base.ts` contient le `vi.mock('electron', …)` des contraintes globales.

- [ ] **Step 1 : écrire `scripts/vitest-electron.mjs`.** Le script lance
  `node_modules/electron/cli.js` (ou le binaire rendu par `require('electron')`)
  avec `node_modules/vitest/vitest.mjs run` et les arguments reçus, dans un
  environnement où `ELECTRON_RUN_AS_NODE=1`, et `stdio: 'inherit'`. Il sort avec le
  code d'Electron. Puis `"test": "node scripts/vitest-electron.mjs"`.
- [ ] **Step 2 : écrire `base.test.ts`.**
  - `ouvre une base neuve` : `ouvrirBaseEssai()`, puis
    `SELECT COUNT(*) FROM campaign` vaut 1.
  - `les fabriques posent un objet dans un inventaire` : `seance('S1')`,
    `inventaire`, `objet`, `placer(... port 'inventaire')`, puis une ligne
    `objet_placement` existe avec `inventaire_id`.
  - Ces tests utiliseront `session_id` sur `objet` et `inventaire` : marquer ce
    second test `it.todo` jusqu'à la Tâche 2, qui le réactive.
- [ ] **Step 3 : écrire `base.ts`.** Lancer `npm test`, attendu : tous les tests
  existants et `ouvre une base neuve` en PASS.
- [ ] **Step 4 : commit** « Tests : la base se teste sous Electron ».

### Tâche 2 : rattacher les cinq tables à une séance (schéma)

**Files:**
- Modify: `src/main/db/schema.ts` (type de `MIGRATIONS`, migration 95)
- Modify: `src/main/db/index.ts` (`openDbAt`)
- Test: `src/main/db/test/schema.test.ts`

**Interfaces:**
- Produces : `MIGRATIONS: { id: number; sql: string; run?: (db: Database.Database) => void; sauvegarde?: boolean }[]`.
  `openDbAt` joue `sql` puis `run?.(db)` dans la même transaction. Avant la
  **première** migration en attente marquée `sauvegarde`, si le fichier existait
  déjà, il le copie en `projet.db.avant-migration-<id>` après un
  `wal_checkpoint(TRUNCATE)`.
- Colonnes (migration 95, `sauvegarde: true`) :
  `ALTER TABLE <t> ADD COLUMN session_id INTEGER REFERENCES game_session(id) ON DELETE CASCADE`
  pour `objet`, `objet_famille`, `inventaire`, `pochette`, `pochette_onglet`, avec un
  index `idx_<t>_session` sur chacune. On remplace `idx_pochette_unique` par
  `UNIQUE (session_id, item_id, player_key)`. Ne pas créer ce nouvel index unique
  avant la Tâche 4, qui répartit les données : la migration 95 ne fait que
  `DROP INDEX idx_pochette_unique` et la 96 recrée l'unicité.

- [ ] **Step 1 : tests en échec.**
  - `migration 95 ajoute session_id` : `PRAGMA table_info` des cinq tables contient
    `session_id`.
  - `supprimer une séance emporte ses objets et pas ceux des autres` : deux séances,
    un objet, une famille, un inventaire et un document de pochette dans chacune.
    `DELETE FROM game_session WHERE id = s1`, puis les lignes de s2 restent et celles
    de s1 disparaissent.
  - `sauvegarde avant migration` : on teste la fonction extraite
    `sauvegarderAvant(fichier: string, id: number): string`, qui rend le chemin de
    la copie. Sur un fichier de base existant, la copie
    `<fichier>.avant-migration-<id>` existe et a la même taille.
  - Réactiver le test `todo` de la Tâche 1.
- [ ] **Step 2 :** `npm test -- src/main/db/test`, attendu : FAIL.
- [ ] **Step 3 : implémenter** la migration 95, le champ `run`,
  `sauvegarderAvant` (exportée de `index.ts`) et son appel dans `openDbAt`.
- [ ] **Step 4 :** `npm test`, attendu : PASS.
- [ ] **Step 5 : commit** « Séances : objets, familles, inventaires et pochette
  rattachables à une séance ».

### Tâche 3 : le module de copie entre séances

**Files:**
- Create: `src/main/db/repos/copieSeance.ts`
- Test: `src/main/db/test/copieSeance.test.ts`

**Interfaces:**
- Produces (tout dans `copieSeance.ts`) :
  ```ts
  export interface Correspondance {
    objets: Map<number, number>; familles: Map<number, number>
    inventaires: Map<number, number>; onglets: Map<number, number>
  }
  export function nouvelleCorrespondance(): Correspondance
  /** Famille de même nom déjà dans `sid` (casse et espaces ignorés), sinon copie. */
  export function copierFamille(familleId: number, sid: number, c: Correspondance): number
  /** La fiche seule, sans exemplaire. La famille suit (copierFamille), sauf si elle
   *  est masquée pour `sid` (masquee_depuis), auquel cas famille_id = NULL. */
  export function copierObjet(objetId: number, sid: number, c: Correspondance): number
  /** `enPochette: false` : la copie n'est pas passée à la pochette. */
  export function copierInventaire(invId: number, sid: number, c: Correspondance, o: { enPochette: boolean }): number
  export function copierOnglet(ongletId: number, sid: number, c: Correspondance): number
  /** 'depart' : caché, non lu. 'actuel' : tel quel, avec ses pochette_lu.
   *  Rend null si l'unicité (sid, item, joueur) l'empêche, ou si le document vient
   *  d'un inventaire absent de c.inventaires. */
  export function copierDoc(pochetteId: number, sid: number, c: Correspondance, mode: 'depart' | 'actuel'): number | null
  /** Tout ce que les emplacements de `sid` (objet_id, inventaire_id,
   *  init_inventaire_id) et les fiches de ses lieux (lieu_carte_objet,
   *  lieu_scenario_objet) désignent hors de `sid` est remplacé par une copie dans
   *  `sid`, créée une seule fois par élément grâce à `c`. Les inventaires copiés
   *  gardent en_pochette. Rend `c`. */
  export function rattacherASeance(sid: number, c?: Correspondance): Correspondance
  ```
- Consumes : `copierLigne` (`src/main/db/copie.ts`), `getDb`.

- [ ] **Step 1 : tests en échec.**
  - `copierObjet recopie la fiche et non les exemplaires` : la copie a le même
    `nom`, la même `description`, les mêmes `effets`, et `session_id = s2`. Elle n'a
    aucune ligne `objet_placement`. Modifier `nom` sur la copie ne change pas
    l'original.
  - `copierFamille fusionne sur le nom` : s2 a déjà « documents » et on copie
    « Documents » de s1, donc l'id rendu est celui de s2 et aucune nouvelle ligne
    n'est créée.
  - `copierObjet laisse la famille masquée` : `masquee_depuis = s2` sur la famille,
    donc `famille_id` de la copie est NULL.
  - `copierDoc au départ` : l'original a `visible = 1` et une ligne `pochette_lu`. La
    copie a `visible = 0`, `session_id = s2`, aucune `pochette_lu`, et son
    `onglet_id` est la copie de l'onglet d'origine.
  - `copierDoc refuse un doublon` : rend `null`.
  - `rattacherASeance` : un emplacement de s2 pointe vers un objet de s1 et vers un
    inventaire de s1, et une `lieu_carte_objet` d'un lieu de s2 pointe vers le même
    objet. Après l'appel, les trois pointent vers **une seule** copie de l'objet dans
    s2, l'inventaire est copié une seule fois, et l'objet de s1 est intact.
- [ ] **Step 2 :** `npm test -- copieSeance`, attendu : FAIL.
- [ ] **Step 3 : implémenter.** `copierLigne` avec `session_id` remplacé. Pour
  `rattacherASeance`, les lieux de `sid` se lisent dans `place.session_id`, et leurs
  fiches via `lieu_carte.place_id` et `lieu_scenario.place_id`.
- [ ] **Step 4 :** `npm test`, attendu : PASS.
- [ ] **Step 5 : commit** « Séances : copier familles, objets, inventaires et
  pochette d'une séance à l'autre ».

### Tâche 4 : répartir les données existantes (migration 96)

**Files:**
- Modify: `src/main/db/schema.ts` (migration 96 avec `run`)
- Test: `src/main/db/test/migration96.test.ts`

**Interfaces:**
- Consumes : `rattacherASeance`, `copierDoc` (Tâche 3).
- Produces : après la migration 96, chaque ligne des cinq tables a un `session_id`,
  sauf dans une campagne sans séance. L'unicité
  `idx_pochette_unique (session_id, item_id, player_key)` est recréée.

Algorithme du `run`, campagne par campagne. Les séances sont dans l'ordre
`ord, id`. La « séance de repli » est la séance active, sinon la dernière.

1. Campagne sans séance : ne rien faire.
2. Chaque **objet** prend la dernière séance (dans l'ordre) où il a un emplacement,
   sinon la séance de repli. Chaque **inventaire** prend la dernière séance dont un
   emplacement le désigne (`inventaire_id` ou `init_inventaire_id`), sinon la
   séance de repli. Chaque **famille** prend la séance de repli.
3. `rattacherASeance(s)` pour chaque séance. Les copies naissent ici.
4. Les **familles** de la séance de repli qui n'ont aucun objet dans cette séance
   restent là. Elles sont vides, et on ne les supprime pas.
5. **Pochette** : onglets et documents prennent la séance de repli. Puis, pour
   chaque autre séance s, `copierOnglet` sur chaque onglet et `copierDoc(…, 'actuel')`
   sur chaque document. Les documents qui viennent d'un inventaire absent de s sont
   écartés par `copierDoc`. La correspondance des inventaires de s se construit en
   relisant l'inventaire d'origine de chaque copie : `rattacherASeance` rend `c`.
6. Recréer `idx_pochette_unique` sur `(session_id, item_id, player_key)`.

- [ ] **Step 1 : test en échec**, avec une base construite à la main avant la
  migration 96. Ouvrir une base neuve, puis remettre `session_id = NULL` partout et
  rejouer le `run` de la migration 96, exporté sous le nom
  `repartirParSeance(db)`. Scénario : 3 séances A, B, C. Un objet « Lampe » est
  placé dans A (sur un PJ) et dans B (dans un inventaire « Camion »). Un objet
  « Clé » n'a aucun emplacement. C est active. La pochette a 1 onglet et
  2 documents, dont 1 lu. Attendus :
  - « Lampe » existe dans A et dans B (2 lignes `objet`), et chaque emplacement
    pointe vers celle de sa séance ;
  - « Camion » existe seulement dans B ;
  - « Clé » est dans C ;
  - la pochette existe dans A, B et C, avec 2 documents chacune ; le document lu
    l'est dans les trois ;
  - `SELECT COUNT(*) FROM objet WHERE session_id IS NULL` vaut 0.
- [ ] **Step 2 :** FAIL. **Step 3 :** implémenter. **Step 4 :** `npm test`, PASS.
- [ ] **Step 5 : vérifier sur une copie de la vraie base.** Copier
  `D:\Documents\JDR\Campagnes\Chasse aux fantômes\.ecran-du-maitre\projet.db` dans
  le dossier scratchpad, et l'ouvrir avec `openDbAt` dans un test jetable, non
  commité. Attendu : 5 séances. Les séances 5, 7, 8 et 9 ont chacune 75 objets,
  moins ceux qu'elles n'utilisent pas (comparer au nombre de `objet_id` distincts par
  séance d'avant la migration : 75, 75, 74, 63). La séance 4 a 0 objet et
  118 documents de pochette, moins les documents d'inventaire. Aucun emplacement
  n'est perdu (`COUNT(*)` de `objet_placement` inchangé à 347). **Ne jamais ouvrir
  l'original.**
- [ ] **Step 6 : commit** « Séances : chaque séance reçoit sa copie des objets et de
  la pochette ».

### Tâche 5 : tout lire et écrire dans la séance ouverte, et une séance neuve vide

**Files:**
- Modify: `src/main/db/repos/objets.ts` (familles, objets, inventaires, corbeille,
  suppression de `reporterInventaires` et `masquerFamille`)
- Modify: `src/main/db/repos/pochette.ts` (toutes les requêtes `campaign_id = ?`)
- Modify: `src/main/mobile.ts:842-851` (`nomsDesObjets`)
- Modify: `src/main/reinitialiser.ts:30-41`
- Modify: `src/main/db/repos/characters.ts:372` (`preparerSeance`)
- Modify: `src/main/db/repos/timeline.ts` (`createSession`)
- Modify: `src/main/db/index.ts` (`activeSessionId`, branche « créée au besoin »)
- Modify: `src/main/ipc/index.ts:642,835`, `src/preload/index.ts:723-724`,
  `src/renderer/src/mj/modules/Objets.tsx` (bouton « masquer » d'une famille)
- Modify: `src/shared/types.ts:976-978` (retirer `verrouillee` et `masquee` de
  `ObjetFamille`)
- Test: `src/main/db/test/cloisonnement.test.ts`

**Interfaces:**
- Toute requête qui filtrait `objet`, `objet_famille`, `inventaire`, `pochette` ou
  `pochette_onglet` sur `campaign_id = activeCampaignId()` filtre désormais sur
  `session_id = activeSessionId()`. Toute insertion dans ces tables remplit
  `session_id`. On garde aussi `campaign_id`.
- `SELECT_FAMILLE` ne calcule plus `verrouillee` ni `masquee`. Partout dans
  `Objets.tsx`, les filtres `!f.masquee` disparaissent, ainsi que les icônes de
  verrou ou d'œil sur les familles.
- `preparerSeance` ne recopie plus d'`objet_placement`. On supprime
  `reporterInventaires` et son appel dans `entrerDansLaSeance`.
- Séance sans rien : `createSession` ne crée rien. Si c'est la **première** séance
  de la campagne (y compris celle que `activeSessionId` crée au besoin), elle
  adopte les lignes de la campagne dont `session_id IS NULL` : c'est le cas d'un
  projet neuf, où `seed.ts` pose les familles livrées sans séance.

- [ ] **Step 1 : tests en échec.**
  - `une séance neuve est vide` : on a des objets, familles, inventaires et une
    pochette dans s1. Après `createSession('S2')`, `listObjets()`,
    `listFamilles()`, `listInventaires()`, `listPochette()` et `listOnglets()` sont
    vides.
  - `entrer dans une séance ne recopie pas les affaires` : un PJ porte un objet dans
    s1. Après `createSession`, `preparerSeance(s2)`, il n'y a aucun
    `objet_placement` dans s2.
  - `modifier un objet ne touche pas l'autre séance` : un objet de s1 est copié dans
    s2 par `copierObjet`. `updateObjet(copie, { nom: 'X' })` depuis s2 laisse le nom
    d'origine dans s1.
  - `un projet neuf garde ses familles livrées` : `ouvrirBaseEssai()`, puis
    `listFamilles()` rend les 8 `FAMILLES_LIVREES`, rattachées à la séance créée.
  - `réinitialiser ne range que la séance ouverte` : un objet est déplacé dans s1 et
    dans s2. `reinitialiser({ objets: true, … })` dans s2 laisse celui de s1 déplacé.
- [ ] **Step 2 :** FAIL. **Step 3 :** implémenter. **Step 4 :** `npm test`, puis
  `npm run typecheck`. Attendu : PASS, 0 erreur.
- [ ] **Step 5 : commit** « Séances : une séance neuve démarre sans objet ni
  pochette ».

### Tâche 6 : reprendre un lieu ou un PNJ, et dupliquer une séance avec ses objets

**Files:**
- Modify: `src/main/db/repos/places.ts` (`duplicatePlace`, `copierLieu`)
- Modify: `src/main/db/repos/characters.ts` (`duplicatePnj`)
- Modify: `src/main/db/repos/timeline.ts` (`dupliquerSeance`)
- Test: `src/main/db/test/duplication.test.ts`

**Interfaces:**
- Consumes : `rattacherASeance`, `copierDoc`, `copierOnglet`,
  `nouvelleCorrespondance`, et `objets.ranger(ids: number[]): number`, qui existe
  déjà.
- `duplicatePlace` et `duplicatePnj` : après la copie, ils appellent
  `rattacherASeance(sid)`.
- `dupliquerSeance(src, …, suite)` : après les lieux, les PNJ et la trame :
  1. copier les emplacements de `src` qu'aucun lieu ni PNJ n'a déjà emportés (PJ,
     inventaire, corbeille), avec `session_id = nid`, en reportant
     `init_place_id` et `init_character_id` à travers les tables de lieux et de PNJ ;
  2. `rattacherASeance(nid, c)` ;
  3. copier tous les onglets, puis tous les documents de la pochette de `src` :
     `copierDoc(…, suite ? 'actuel' : 'depart')` ;
  4. si `!suite` : `ranger` tous les emplacements de `nid`, qui reviennent à leur
     place de départ.

- [ ] **Step 1 : tests en échec.**
  - `reprendre un lieu copie ses objets` : un lieu de s1 porte un objet. Après
    `duplicatePlace` depuis s2, l'emplacement copié pointe vers un objet de s2, et
    l'objet de s1 est intact.
  - `reprendre un PNJ copie ce qu'il porte` : même chose avec `duplicatePnj`.
  - `dupliquer remet au départ` : un objet est parti du Camion et se trouve sur un
    PJ dans `src`. Après `dupliquerSeance(src, 'Copie', null, new Map(), false)`,
    dans `nid` il est dans la copie du Camion, et le document de pochette est
    caché et non lu.
  - `la suite garde l'état actuel` : même scénario avec `suite = true`. L'objet est
    sur le PJ, et le document est visible et lu.
- [ ] **Step 2 :** FAIL. **Step 3 :** implémenter. **Step 4 :** `npm test`, PASS.
- [ ] **Step 5 : commit** « Séances : dupliquer et reprendre emportent leurs
  objets, en copies ».

### Tâche 7 : importer depuis une séance précédente (côté serveur)

**Files:**
- Create: `src/main/db/repos/importSeance.ts`
- Modify: `src/shared/types.ts` (types ci-dessous)
- Modify: `src/main/ipc/index.ts`, `src/preload/index.ts`
- Test: `src/main/db/test/importSeance.test.ts`

**Interfaces:**
- Produces :
  ```ts
  // src/shared/types.ts
  export interface ImportObjet { id: number; nom: string; imageItemId: number | null; teinte: string | null }
  export interface ImportFamille { id: number | null; nom: string; objets: ImportObjet[] }   // id null : « Sans famille »
  export interface ImportDoc { id: number; itemId: number; titre: string; playerId: number | null }
  export interface ImportOnglet { id: number | null; nom: string; docs: ImportDoc[] }       // id null : la pile
  export interface ImportSource { familles: ImportFamille[]; onglets: ImportOnglet[] }
  export interface ImportChoix { objetIds: number[]; docIds: number[] }
  export interface ImportBilan { objets: number; documents: number; ignores: number }

  // importSeance.ts
  export function sourceImport(srcId: number): ImportSource
  export function importer(srcId: number, dstId: number, choix: ImportChoix): ImportBilan
  ```
  `sourceImport` écarte les documents qui viennent d'un inventaire
  (`inventaire_id IS NOT NULL`). Le `titre` est le nom du fichier `item`.
- IPC : `seance:importSource(srcId)` et `seance:importer(srcId, choix)`.
  `importer` reçoit `activeSessionId()` en `dstId`, puis
  `pochette.suivreInventaires()`, `display.versMj('pochette:changee', null)` et
  `mobile.broadcast()`. Preload : `window.jdr.seance.importSource` et
  `window.jdr.seance.importer`.

Règles de `importer`, en une transaction :
- `srcId === dstId` : `throw new Error('Choisissez une autre séance')`.
- Pour chaque objet coché : `copierObjet`. Pour chaque emplacement de cet objet dans
  `src` dont la place **de départ** est un inventaire (`init_port = 'inventaire'`,
  ou `port = 'inventaire'` si `init_port` est NULL) : on crée dans `dst` un
  emplacement `port = 'inventaire'` vers
  `copierInventaire(init_inventaire_id, dst, c, { enPochette: false })`, avec
  `qte` et `etat` de départ (`init_etat`, sinon `etat`), puis `fixerInitial`.
  Les autres départs ne créent rien : l'objet est dans la réserve.
- Pour chaque document coché : `copierDoc(id, dst, c, 'depart')`, et `null` compte
  dans `ignores`.

- [ ] **Step 1 : tests en échec.**
  - `l'import copie la famille et les objets cochés seulement` : la famille
    « Équipement » de s1 a 3 objets, on en coche 2. Dans s2, il y a 2 objets et une
    famille « Équipement ».
  - `un objet parti du Camion arrive dans le Camion copié` : la quantité 3 est
    gardée, et la copie du Camion a `en_pochette = 0`.
  - `un objet parti d'un PJ arrive dans la réserve` : aucun emplacement dans s2.
  - `un objet à deux exemplaires donne une fiche` : un exemplaire est dans le Camion
    et un sur un PJ. On obtient 1 fiche et 1 emplacement, dans le Camion.
  - `importer deux fois donne deux copies`.
  - `les copies sont indépendantes` : renommer dans s2 ne change rien dans s1, et
    l'inverse non plus.
  - `un document importé est caché et non lu`, et `un document déjà présent est
    ignoré` : `ignores = 1`.
  - `importer depuis la séance cible est refusé`.
  - `sourceImport n'offre pas les documents d'inventaire`.
- [ ] **Step 2 :** FAIL. **Step 3 :** implémenter. **Step 4 :** `npm test`, puis
  `npm run typecheck`. PASS.
- [ ] **Step 5 : commit** « Séances : importer objets et pochette d'une séance
  précédente ».

### Tâche 8 : la fenêtre d'import

**Files:**
- Create: `src/renderer/src/mj/components/ImporterDUneSeance.tsx`
- Modify: `src/renderer/src/mj/modules/Objets.tsx` (bouton)
- Modify: `src/renderer/src/mj/modules/Pochette.tsx` (bouton)
- Modify: `src/renderer/src/styles/app.css` si besoin

**Interfaces:**
- Consumes : `window.jdr.seance.importSource`, `window.jdr.seance.importer`
  (Tâche 7).
- `ImporterDUneSeance({ onglet: 'objets' | 'pochette', onClose })` : même charpente
  que `ReprendreDUneSeance.tsx`, avec `useEchap`, la liste `s.sessions` sans la
  séance ouverte, et les mêmes classes CSS.
- Libellés exacts : bouton « Importer depuis une séance précédente… » dans
  l'en-tête d'Objets et dans celui de la Pochette. Titre de la fenêtre « Importer
  depuis une séance ». Onglets « Objets » et « Pochette ». Bouton d'action
  « Importer ». Phrase sous le titre : « Les objets et documents importés sont des
  copies : ce que vous y changerez ici ne touchera pas l'autre séance. » Toast
  après l'import : « 2 objets et 3 documents importés ». Ajouter
  « (1 déjà présent) » quand `ignores > 0`.
- Objets : une case par famille, à trois états (tout, partiel, rien), puis une case
  par objet. Rien n'est coché au départ. Pochette : une case par onglet, puis une par
  document, rien de coché au départ.
- Après l'import : `s.refreshSeance()` (ou le rafraîchissement qu'utilise déjà
  Objets) et fermeture de la fenêtre.

- [ ] **Step 1 :** implémenter.
- [ ] **Step 2 : vérifier dans l'application** avec la skill `run`, sur la séance de
  référence « Référence dev — La scierie », en mode développeur. Créer une séance,
  vérifier qu'elle est vide. Importer depuis la Référence dev la famille
  « Équipement chasseur de fantôme » et un onglet de pochette. Vérifier les
  emplacements dans les inventaires, les documents cachés, et le toast. Faire une
  capture d'écran de la fenêtre.
- [ ] **Step 3 :** `npm run typecheck` et `npm test`, PASS.
- [ ] **Step 4 : commit** « Séances : la fenêtre d'import ».

### Tâche 9 : la base du MJ, la version et le rapport

**Files:**
- Create: `outils/vider-seance.sql`
- Modify: `package.json` (version `1.8.0`), `RELEASE_NOTES.md`

- [ ] **Step 1 : écrire `outils/vider-seance.sql`** pour la séance 9.
  `PRAGMA foreign_keys = ON;` puis, dans une transaction :
  `DELETE FROM objet_placement WHERE session_id = 9`, puis les lignes
  `session_id = 9` de `pochette`, `pochette_onglet`, `inventaire`, `objet` et
  `objet_famille`. Ne pas toucher `character_seance`.
- [ ] **Step 2 : demander au MJ** de fermer l'application, et **attendre son accord**
  avant de toucher à sa base. La migration 96 aura déjà été jouée en ouvrant
  l'application 1.8.0 en dev sur la vraie campagne, ce qui pose
  `projet.db.avant-migration-95`. Copier `projet.db` en `projet.db.avant-vidage-9`,
  puis jouer le script avec `python -c` et `sqlite3`. Vérifier : 0 ligne de la
  séance 9 dans les six tables, et les autres séances inchangées (comptes relevés
  avant et après).
- [ ] **Step 3 :** version `1.8.0`, et `RELEASE_NOTES.md` réécrit pour l'utilisateur
  (première ligne `<!-- version: 1.8.0 -->`, sections `### Nouveautés` et
  `### Améliorations`), couvrant `git log v1.7.0..HEAD`. **Le soumettre au MJ**
  avant toute publication.
- [ ] **Step 4 : commit** « 1.8.0 : objets et pochette par séance ». Le script SQL
  et le rapport sont dans ce commit ; la base du MJ, elle, n'est pas dans le dépôt.
