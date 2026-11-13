# L'atelier des lieux — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** construire un lieu de A à Z (sol, murs, portes et fenêtres, déco, éclairage) dans
un atelier, et en faire un plan jouable comme les plans actuels.

**Architecture :** la construction (JSON, en **cases**) est la seule source de vérité,
rangée dans une table `construction` rattachée au lieu. À l'enregistrement, le renderer
dessine la construction dans un canvas et en tire un PNG qui devient la carte du lieu.
Le processus principal **dérive** ensuite les murs, les ouvertures et les obstacles
(meubles bloquants) dans les tables `mur` et `ouverture` existantes, en les
retrouvant par un `atelier_id` stable. Tout le reste de l'app (brouillard, vue, pas,
écran joueurs, téléphones) n'y voit qu'un plan ordinaire.

**Tech Stack :** Electron 33, React 18, better-sqlite3, Canvas 2D, vitest.

**Spec :** `docs/superpowers/specs/2026-11-13-atelier-des-lieux-design.md`.
Prompts des assets : `docs/atelier/prompts-assets.md` (déjà livrés).

## Global Constraints

- Code, noms et commentaires **en français**, dans le ton du code existant (les
  commentaires disent *pourquoi*).
- Géométrie partagée dans `src/shared` (la Régie **et** le serveur des téléphones s'en
  servent) ; pas de React ni de base dans `src/shared`.
- Tout ce que le calque enregistre est en **fractions de la carte** ; la construction,
  elle, est en **cases** (elle ne dépend pas de la taille du terrain).
- Terrain par défaut : **30 × 20 cases**, **1,5 m** par case.
- Les murs ne rejoignent jamais `DisplayState` : seule l'image montre les murs.
- Un plan = un niveau ; un escalier est un objet.
- Un lieu construit : image non remplaçable à la main, pas de rognage ni de calage,
  apparences masquées.
- Les lieux existants (sans construction) se comportent **exactement** comme avant.
- Migrations ajoutées à la suite de `src/main/db/schema.ts` (la dernière est la **93**).
- Vérifier chaque tâche par `npm run typecheck` et `npm test` en plus de ses tests.
- Montée de version finale : réécrire `RELEASE_NOTES.md` selon `CLAUDE.md`.

## Review Focus

1. **Agrandir par la gauche ou par le haut** un lieu déjà joué : pions, lampes, sons,
   objets de jeu, repères et pièces nommées ne bougent pas physiquement (Tâche 2 et
   Tâche 4).
2. **Réenregistrer** une construction : une porte ouverte reste ouverte, une porte
   verrouillée le reste, une porte nommée garde son nom, les rideaux faits main
   survivent (Tâche 3).
3. **Un meuble bloquant** n'apparaît pas comme pièce et ne troue pas la pièce qui le
   contient (Tâche 1).
4. **Construction incomplète** (murs ouverts, aucun sol, aucun mur) : l'enregistrement
   aboutit, l'image montre ce qui existe (Tâche 4).
5. **Asset introuvable** (fichier importé supprimé) : la construction s'ouvre, l'objet
   s'affiche comme une silhouette grise, l'enregistrement aboutit (Tâche 5).

---

### Task 1 : les obstacles, des traits qui ne ferment pas de pièce

**Files :**
- Modify : `src/shared/types.ts` (`NatureMur`, `MUR_NATURES`, ~l. 1300)
- Test : `src/shared/murs.test.ts`

**Interfaces :**
- Produces : `NatureMur = 'mur' | 'rideau' | 'obstacle' | 'obstacle-bas' | 'obstacle-voile'`
  avec dans `MUR_NATURES` : `obstacle` (pas + vue, « Meuble »), `obstacle-bas`
  (pas seul, « Meuble bas »), `obstacle-voile` (vue seule, « Meuble ajouré »).
- Produces : `natureObstacle(pas: boolean, vue: boolean): NatureMur | null`, dans `src/shared/types.ts` à côté de `MUR_NATURES`.

Pourquoi des natures de `mur` et pas un nouveau calque : tous les appelants de
`barrieres()` (Régie, Brouillard, Slide, Mobile, serveur mobile, sons) lisent déjà
`MUR_NATURES[...].pas / .vue` ; la détection des pièces (`pieces.ts`, `ferme`) et la
pose d'ouvertures (`ouvertures.ts` l. 79, `repos/ouvertures.ts` l. 110) ne retiennent
que `'mur'`. Les obstacles sont donc arrêtés partout sans toucher ces fichiers.

- [ ] **Step 1 : tests qui échouent**

```ts
test('un obstacle arrête le pas et la vue, un obstacle bas seulement le pas', () => {
  expect(murArretePas({ nature: 'obstacle-bas', ouvert: false } as Mur)).toBe(true)
  expect(murArreteVue({ nature: 'obstacle-bas', ouvert: false } as Mur)).toBe(false)
  expect(murArreteVue({ nature: 'obstacle-voile', ouvert: false } as Mur)).toBe(true)
})
test('un meuble bloquant dans une pièce ne crée pas de pièce et ne la troue pas', () => {
  // carré de murs 0..1 + obstacle fermé au centre → formesDesMurs rend 1 forme d'aire ≈ 1
})
test('natureObstacle', () => {
  expect(natureObstacle(false, false)).toBeNull()
  expect(natureObstacle(true, true)).toBe('obstacle')
})
```

- [ ] **Step 2 : lancer** — ÉCHEC attendu.
- [ ] **Step 3 : implémenter.** Rechercher `nature === 'rideau'` / `'mur'` dans
  `src/renderer` : l'éditeur `Murs.tsx` et `Tableau.tsx` doivent dessiner un
  obstacle (classe CSS `trait-mur obstacle`, pointillé fin) sans le proposer au
  sélecteur de nature (les obstacles ne naissent que de l'atelier).
- [ ] **Step 4 : relancer + typecheck** — tout passe.
- [ ] **Step 5 : commit** `Murs : les obstacles, qui arrêtent sans fermer de pièce`.

---

### Task 2 : le modèle de la construction et sa géométrie

**Files :**
- Create : `src/shared/atelier.ts`
- Test : `src/shared/atelier.test.ts`

**Interfaces :**
- Produces (types, tous exportés) :

```ts
export type PointCase = [number, number]           // en cases, origine en haut à gauche
export interface SolPeint { id: string; assetId: string; pts: PointCase[] }   // polygone fermé
export interface MurBati { id: string; assetId: string; pts: PointCase[]; epaisseur: number } // cases
export type NatureOuvertureBatie = 'porte' | 'vitre'
export interface OuvertureBatie {
  id: string; murId: string; nature: NatureOuvertureBatie; assetId: string
  d: number          // 0..1 le long du mur
  largeur: number    // cases
}
export interface ObjetPose {
  id: string; assetId: string
  x: number; y: number   // centre, en cases
  l: number; h: number   // cases
  angle: number          // degrés
  bloquePas: boolean; bloqueVue: boolean
}
export interface Construction {
  v: 1
  largeur: number; hauteur: number   // en cases
  metresParCase: number
  sols: SolPeint[]; murs: MurBati[]; ouvertures: OuvertureBatie[]; objets: ObjetPose[]  // ordre = ordre de dessin
}
export interface MurDerive { atelierId: string; nature: NatureMur; pts: PointMur[] }
export interface OuvertureDerivee { atelierId: string; murAtelierId: string; nature: NatureOuverture; d: number; largeur: number }
export interface CalqueDerive { murs: MurDerive[]; ouvertures: OuvertureDerivee[] }
export interface Cadre { x: number; y: number; w: number; h: number }
```

- Produces (fonctions) :
  - `constructionVide(): Construction` : 30 × 20, 1,5 m, listes vides.
  - `lireConstruction(brut: unknown): Construction` : relecture méfiante (comme
    `toPoints` dans `repos/murs.ts`) ; un JSON abîmé donne `constructionVide()`.
  - `enFraction(c: Construction, p: PointCase): PointMur`.
  - `contourDeLObjet(o: ObjetPose): PointCase[]` : les 4 coins du rectangle tourné,
    refermé (5 points, le dernier = le premier).
  - `deriverCalque(c: Construction): CalqueDerive` : un `MurDerive` nature `'mur'` par
    `MurBati` (ligne médiane) ; un `MurDerive` par objet bloquant, avec
    `atelierId = 'obj:' + o.id` et la nature d'obstacle de la Tâche 2
    (`natureObstacle(bloquePas, bloqueVue)`, Tâche 1) ; aucun pour un objet qui ne bloque rien.
    Largeur d'ouverture convertie en fraction **de la largeur** de la carte (comme
    `Ouverture.largeur`).
  - `agrandir(c: Construction, bords: { gauche: number; haut: number; droite: number; bas: number }): { construction: Construction; cadre: Cadre }` :
    décale tout de `(gauche, haut)` cases ; `cadre` est exprimé en fractions de
    l'**ancienne** carte, au format attendu par `places.recalerApresRognage`
    (`x = -gauche / L`, `y = -haut / H`, `w = L' / L`, `h = H' / H`). Bords négatifs
    refusés (on n'agrandit que).
  - `nouvelId(): string` (`crypto.randomUUID()`).

- [ ] **Step 1 : écrire les tests qui échouent**

```ts
test('deriverCalque : un mur bâti donne un mur en fractions', () => {
  const c = { ...constructionVide(), largeur: 10, hauteur: 5 }
  c.murs.push({ id: 'm1', assetId: 'x', pts: [[0, 0], [10, 5]], epaisseur: 0.4 })
  expect(deriverCalque(c).murs).toEqual([{ atelierId: 'm1', nature: 'mur', pts: [[0, 0], [1, 1]] }])
})
test('deriverCalque : un tapis ne bloque rien, une table bloque le pas seulement', () => {
  // tapis (false,false) → aucun mur ; table (true,false) → nature natureObstacle(true,false)
})
test('contourDeLObjet : un objet tourné de 90° échange largeur et hauteur', () => {
  // o = {x:5,y:5,l:2,h:1,angle:90} → boîte englobante x∈[4.5,5.5], y∈[4,6] (à 1e-9 près)
})
test('agrandir de 2 à gauche et 1 en haut décale tout et rend le cadre de recalage', () => {
  // 10×5 → 12×6 ; un point [0,0] devient [2,1] ; cadre = {x:-0.2, y:-0.2, w:1.2, h:1.2}
})
test('agrandir : un point recalé par le cadre retombe au même endroit physique', () => {
  // fraction f dans l'ancienne carte → (f - cadre.x)/cadre.w == enFraction(nouvelle, point décalé)
})
test('lireConstruction : un JSON abîmé rend une construction vide', () => {
  expect(lireConstruction('{pas du json')).toEqual(constructionVide())
})
```

- [ ] **Step 2 : lancer `npx vitest run src/shared/atelier.test.ts`** — attendu : ÉCHEC (module absent).
- [ ] **Step 3 : implémenter `src/shared/atelier.ts`** selon les Interfaces.
- [ ] **Step 4 : relancer** — attendu : tout passe ; `npm run typecheck` propre.
- [ ] **Step 5 : commit** `Atelier : le modèle de la construction et sa géométrie`.

---

### Task 3 : la base — construction, et calque dérivé qui garde l'état de partie

**Files :**
- Modify : `src/main/db/schema.ts` (migration **94**)
- Create : `src/main/db/repos/construction.ts`
- Modify : `src/main/db/repos/murs.ts`, `src/main/db/repos/ouvertures.ts` (lire `atelier_id`)
- Modify : `src/shared/types.ts` (`Mur.atelierId`, `Ouverture.atelierId`, `Place.construit`)
- Modify : `src/main/db/repos/places.ts` (`construit` dans le `SELECT`)
- Create : `src/shared/synchro.ts` + Test : `src/shared/synchro.test.ts`

**Interfaces :**
- Migration 94 :

```sql
CREATE TABLE construction (
  place_id INTEGER PRIMARY KEY REFERENCES place(id) ON DELETE CASCADE,
  data     TEXT NOT NULL,
  maj      TEXT NOT NULL DEFAULT (datetime('now'))
);
ALTER TABLE mur       ADD COLUMN atelier_id TEXT;
ALTER TABLE ouverture ADD COLUMN atelier_id TEXT;
```

- `Mur.atelierId: string | null`, `Ouverture.atelierId: string | null`,
  `Place.construit: boolean` (`EXISTS (SELECT 1 FROM construction WHERE place_id = p.id)`).
- `src/shared/synchro.ts` (pur, testable) :

```ts
export interface PlanSynchro {
  murs: { ajouter: MurDerive[]; modifier: { id: number; d: MurDerive }[]; retirer: number[] }
  ouvertures: { ajouter: OuvertureDerivee[]; modifier: { id: number; d: OuvertureDerivee }[]; retirer: number[] }
}
export function planDeSynchro(derive: CalqueDerive, murs: Mur[], ouvertures: Ouverture[]): PlanSynchro
```
  Ne regarde que les lignes dont `atelierId` n'est pas `null` ; apparie par `atelierId`.
  Les lignes faites main (`atelierId === null`) n'apparaissent jamais dans le plan.
- `repos/construction.ts` :
  - `getConstruction(placeId: number): Construction | null`
  - `setConstruction(placeId: number, c: Construction): void`
  - `synchroniserCalque(placeId: number, derive: CalqueDerive): void` : applique
    `planDeSynchro` dans **une transaction** ; une modification ne touche jamais
    `ouverte`, `verrouillee` ni le nom d'une ouverture ; une ouverture ajoutée
    retrouve son `mur_id` par le `murAtelierId`.

- [ ] **Step 1 : tests de `planDeSynchro` qui échouent**

```ts
test('une porte déjà là est modifiée, pas recréée (son id survit)', () => {
  // ouverture {id: 7, atelierId:'o1', ouverte:true, verrouillee:true} + dérivé o1 déplacé
  // → modifier = [{id:7,...}], ajouter = [], retirer = []
})
test('un trait fait main n’est jamais retiré', () => {
  // mur {id: 3, atelierId: null} absent du dérivé → retirer ne contient pas 3
})
test('un mur bâti supprimé de la construction est retiré', () => { /* atelierId 'm9' absent → retirer [id] */ })
test('un meuble qui cesse de bloquer retire son obstacle', () => { /* 'obj:x' absent → retiré */ })
```

- [ ] **Step 2 : lancer** — ÉCHEC attendu.
- [ ] **Step 3 : implémenter** `synchro.ts`, la migration, le dépôt, les champs.
- [ ] **Step 4 : relancer + typecheck** ; puis `npm run dev`, ouvrir la séance de
  référence (« Référence dev — La scierie ») : ses murs, portes et pièces sont
  identiques à avant (aucune ligne n'a d'`atelier_id`).
- [ ] **Step 5 : commit** `Atelier : la construction en base, et le calque qui en dérive`.

---

### Task 4 : créer, ouvrir, enregistrer, agrandir (processus principal)

**Files :**
- Create : `src/main/atelier.ts` (logique), Modify : `src/main/ipc/index.ts`, `src/preload/index.ts`
- Modify : `src/main/library.ts` (`ecrireImageDeLApp`)

**Interfaces :**
- Consumes : Tâches 2 et 3 ; `places.recalerApresRognage` ; la notification de
  changement de carte utilisée par `places:rogner` (`carteChangee`).
- Produces (IPC, exposé dans le preload sous `api.atelier`) :
  - `atelier:creer(nom: string, parentId: number | null) → Place` : crée le lieu et
    une `constructionVide()`.
  - `atelier:construire(placeId: number) → Place` : seulement si le lieu **n'a pas de
    carte** ; sinon erreur `Ce lieu a déjà une image : l’atelier part de zéro`.
  - `atelier:de(placeId: number) → Construction | null`
  - `atelier:enregistrer(placeId: number, c: Construction, png: Uint8Array) → Place` :
    1. écrit le PNG dans `dossierDeLApp(null, DOSSIER_LIEUX)` sous
       `<nom du lieu> (construit).png` (nouveau nom libre à chaque fois, via
       `freePath`) avec `ecrireImageDeLApp(dossierRel, nom, octets): string` ;
    2. calcule le cadre : identité `{0,0,1,1}` si la taille n'a pas changé, sinon celui
       rendu par `agrandir` (le renderer l'envoie avec la construction : ajouter
       `cadre?: Cadre` en 4ᵉ argument) ;
    3. `recalerApresRognage(placeId, ancienItem ?? nouvelItem, nouvelItem, cadre)` ;
       première fois (pas d'ancienne carte) : poser `map_item_id` directement ;
    4. `echelle = largeur * metresParCase` (mètres sur la largeur) ;
    5. `setConstruction`, `synchroniserCalque(deriverCalque(c))` ;
    6. supprime l'ancien PNG construit s'il est dans le dossier de l'app ;
    7. notifie comme `places:rogner`, et `murs:recaler` pour que les pièces suivent.
- Garde-fous dans `ipc/index.ts` : `places:rogner`, `places:caler`,
  `places:calerTourne`, `places:remplacerCarte`, et l'ajout d'une apparence refusent
  un lieu `construit` avec `Ce plan se modifie dans l’atelier`.

- [ ] **Step 1 : test du cadre de bout en bout** dans `src/shared/atelier.test.ts` :
  une lampe en `[0.5, 0.5]` d'une carte 10 × 10 agrandie de 10 à gauche se retrouve,
  par la formule de `recalerApresRognage` (`(x - c.x) / c.w`), en `[0.75, 0.5]`.
- [ ] **Step 2 : implémenter** l'IPC, le preload (types dans `src/preload/index.ts`
  comme les voisins).
- [ ] **Step 3 : vérifier en dev** (console de la Régie) : `api.atelier.creer('Essai', null)`
  puis `api.atelier.enregistrer(id, c, png)` avec un PNG 1×1 et une construction
  contenant un mur fermé ; le lieu a une carte, ses murs apparaissent dans l'éditeur de
  plan, une pièce est détectée. Puis enregistrer à nouveau **sans aucun mur** :
  aucune erreur, les murs bâtis ont disparu.
- [ ] **Step 4 : typecheck + tests.**
- [ ] **Step 5 : commit** `Atelier : créer, enregistrer et agrandir un lieu construit`.

---

### Task 5 : les assets — catalogue, pack livré, imports du MJ

**Files :**
- Create : `src/shared/atelierAssets.ts` + Test : `src/shared/atelierAssets.test.ts`
- Create : `src/main/atelierAssets.ts`
- Modify : `src/main/vault.ts` (hôte `atelier` du protocole `jdr`)
- Modify : `electron-builder.yml` (`extraResources: - from: resources/atelier, to: atelier`)
- Create : `resources/atelier/catalogue.json` (provisoire : trois PNG unis faits à la main —
  un sol, un mur, une porte — jusqu'à l'arrivée du vrai pack, Tâche 12)
- Modify : `src/main/ipc/index.ts`, `src/preload/index.ts`

**Interfaces :**

```ts
export type TypeAsset = 'sol' | 'mur' | 'porte' | 'vitre' | 'objet'
export interface AssetAtelier {
  id: string                 // 'pack:sols/parquet-sombre' ou 'moi:<uuid>'
  source: 'pack' | 'moi'
  type: TypeAsset
  nom: string
  categorie: string          // « Sols », « Chambre », « Horreur »…
  fichier: string            // relatif au dossier de la source
  tuile?: number             // sol, mur : cases couvertes par une tuile
  l?: number; h?: number     // objet : taille réelle en cases
  bloquePas?: boolean; bloqueVue?: boolean   // objet : défauts
}
export interface CatalogueAtelier { v: 1; assets: AssetAtelier[] }
export function lireCatalogue(brut: unknown, source: 'pack' | 'moi'): AssetAtelier[]  // méfiante, ignore les entrées invalides
/** Pixels : RGBA à plat. La boîte des pixels d'alpha > 8 ; null si tout est vide. */
export function boiteOpaque(rgba: Uint8ClampedArray, w: number, h: number): { x: number; y: number; w: number; h: number } | null
/** Atténue la couture d'une texture : fondu des bords avec la copie décalée d'une demi-taille, sur 1/8 de chaque côté. */
export function raccorder(rgba: Uint8ClampedArray, w: number, h: number, horizontalSeulement: boolean): Uint8ClampedArray
```

- URL d'une image : `jdr://atelier/<pack|moi>/<fichier>` ; le pack est lu dans
  `resources/atelier` en dev et `process.resourcesPath/atelier` une fois installé ;
  les imports dans `app.getPath('userData')/atelier` (avec leur `catalogue.json`),
  **communs à toutes les campagnes**.
- IPC : `atelier:assets() → AssetAtelier[]` (pack + moi) ;
  `atelier:importer(meta: Omit<AssetAtelier,'id'|'source'|'fichier'>, png: Uint8Array) → AssetAtelier`
  (le renderer a déjà recadré / raccordé l'image) ; `atelier:retirerAsset(id)` (seulement `moi:`).

- [ ] **Step 1 : tests qui échouent** : `boiteOpaque` sur une image 4×4 avec un seul
  pixel opaque en (2,1) → `{x:2,y:1,w:1,h:1}` ; image vide → `null` ;
  `raccorder` : sur une image dont la colonne 0 est noire et la dernière blanche, après
  traitement l'écart entre colonne 0 et colonne w-1 est < 20 % de l'écart d'avant ;
  `lireCatalogue` ignore une entrée sans `type`.
- [ ] **Step 2 : lancer** — ÉCHEC.
- [ ] **Step 3 : implémenter** ; dans le rendu (Tâche 6), un asset dont l'image ne
  charge pas est dessiné comme un rectangle gris `#555` à 60 % (Review Focus 5).
- [ ] **Step 4 : tests + typecheck** ; en dev, `api.atelier.assets()` liste le
  catalogue provisoire et `jdr://atelier/pack/...` s'affiche dans un `<img>`.
- [ ] **Step 5 : commit** `Atelier : le catalogue d’assets, livré et importé`.

---

### Task 6 : le rendu de la construction

**Files :**
- Create : `src/renderer/src/mj/atelier/rendu.ts`
- Create : `src/renderer/src/mj/atelier/images.ts` (cache `Map<assetId, HTMLImageElement | 'absent'>`, `chargerImages(assets): Promise<void>`)

**Interfaces :**
- `dessinerConstruction(ctx: CanvasRenderingContext2D, c: Construction, assets: Map<string, AssetAtelier>, images: ImagesAtelier, pxParCase: number): void`
- `exporterPng(c, assets, images): Promise<Uint8Array>` à
  `pxParCase = Math.min(128, Math.floor(8192 / Math.max(c.largeur, c.hauteur)))`.
- Ordre de dessin : fond `#0b1014` → sols (dans l'ordre, motif répété à `tuile` cases,
  décalage aléatoire **stable** dérivé de l'id du sol) → ombre portée des murs →
  murs (segments **percés** des ouvertures via `segmentsPerces` de
  `src/shared/ouvertures.ts`, trait de largeur `epaisseur`, motif du mur,
  `lineJoin = 'miter'`, puis un liseré clair de 15 % de l'épaisseur au milieu pour le
  volume) → ouvertures (l'image étirée sur `largeur` × `epaisseur`, tournée selon le
  mur) → objets (ombre commune `shadowBlur = 0.15 case`, `shadowColor = rgba(0,0,0,.6)`,
  décalage 0.05 case vers le bas, tournés de `angle`).
- Rien d'autre (pas de grille, pas de sélection) : ceux-là sont dessinés par l'atelier
  par-dessus (Tâche 7), pour que l'export soit exactement le rendu sans les aides.

- [ ] **Step 1 : écrire une page de test en dev** (bouton « Aperçu du rendu » dans le
  mode développeur, retiré à la Tâche 12) qui dessine une construction fixe : deux
  pièces, une porte, un objet, un asset absent.
- [ ] **Step 2 : vérifier visuellement** (lancer `npm run dev`, capture) : murs
  épais avec ombre, angles propres aux jonctions, porte dans l'ouverture, objet
  ombré, asset absent en gris.
- [ ] **Step 3 : typecheck + tests.**
- [ ] **Step 4 : commit** `Atelier : le rendu d’une construction`.

---

### Task 7 : l'écran de l'atelier (coquille)

**Files :**
- Modify : `src/renderer/src/mj/store.ts` (vue `'atelier'`, `atelierLieuId: number | null`)
- Modify : `src/renderer/src/mj/App.tsx` (NavItem « Atelier » dans le `nav-sous` de Lieux, sous « Plans » ; rendu de la vue)
- Create : `src/renderer/src/mj/modules/Atelier.tsx`
- Create : `src/renderer/src/mj/atelier/useConstruction.ts`
- Create : `src/renderer/src/mj/atelier/Toile.tsx`
- Modify : `src/renderer/src/styles/app.css` (section `/* Atelier */`)

**Interfaces :**
- `useConstruction(placeId)` → `{ c, modifier(f: (c) => Construction), annuler(), retablir(), sale: boolean, enregistrer(): Promise<void>, agrandir(bords) }`.
  Historique local de 100 instantanés ; Ctrl+Z / Ctrl+Y. `enregistrer` appelle
  `exporterPng` puis `api.atelier.enregistrer` (avec le cadre cumulé des
  agrandissements depuis le dernier enregistrement).
- `Toile` : canvas plein cadre, zoom molette centré sur le curseur, déplacement au clic
  milieu ou espace + glisser (mêmes gestes que l'éditeur de plan), grille en surimpression,
  `onPointer(type, pointCase, e)` pour les outils, `aimanter(p: PointCase, e): PointCase` :
  arrondit à la **demi-case** quand la grille est active et que **Maj** n'est pas
  enfoncé.
- Disposition (maquette A, `.superpowers/brainstorm/829-1794593468/content/atelier-layout.html`) :
  barre du haut avec les 5 onglets numérotés **Sol, Murs, Portes et fenêtres, Déco,
  Éclairage**, le bouton **Grille**, **Agrandir…**, **Enregistrer** (actif si `sale`) ;
  toile au centre ; panneau de droite de 260 px selon l'onglet ; barre d'état
  (`Case : 1,5 m · Maj = tracé libre · Murs actifs pour le brouillard`).
- Sans lieu choisi : liste des lieux construits + « Nouveau lieu construit » (nom) et
  « Construire un lieu sans carte » (liste des lieux sans `mapItemId`).
- Quitter avec des changements non enregistrés : bandeau dans l'atelier
  (pas de `confirm()`), « Enregistrer » / « Abandonner ».
- **Agrandir…** : petit panneau, quatre nombres de cases (gauche, haut, droite, bas).

- [ ] **Step 1 :** implémenter ; en dev, créer un lieu, agrandir de 2 à gauche,
  enregistrer : pas d'erreur, le lieu apparaît dans « Plans ».
- [ ] **Step 2 : typecheck + tests.**
- [ ] **Step 3 : commit** `Atelier : l’écran, la toile et l’enregistrement`.

---

### Task 8 : étape Sol

**Files :** Create `src/renderer/src/mj/atelier/etapes/Sol.tsx`

- Outils : **Rectangle** (glisser), **Polygone** (clics, double-clic ou clic sur le
  premier point pour fermer), **Remplir la pièce** (clic dans une pièce fermée par les
  murs bâtis : `formesDesMurs` de `src/shared/pieces.ts` sur les murs bâtis convertis
  en fractions, puis la forme reconvertie en cases), **Sélection** (clic : le sol du
  dessus sous le curseur ; Suppr l'efface ; changer de matière l'applique).
- Panneau : vignettes des assets `type: 'sol'`, la matière choisie est celle des
  prochains sols.
- Vérif : en dev, peindre une cour en rectangle, une pièce en remplissage, effacer,
  annuler. Commit `Atelier : peindre le sol`.

### Task 9 : étape Murs

**Files :** Create `src/renderer/src/mj/atelier/etapes/Murs.tsx`

- Outils : **Tracer** (clics successifs, Échap ou double-clic termine ; clic sur le
  premier point referme), **Pièce rectangulaire** (glisser → un `MurBati` fermé de
  5 points), **Sélection** (déplacer un sommet, Suppr retire le mur et ses ouvertures).
- Panneau : matière (assets `type: 'mur'`), épaisseur (curseur 0,2 à 1 case, défaut
  **0,4**).
- Vérif : tracer la maison de la référence (6 pièces) en moins de 5 minutes ;
  l'enregistrement fait apparaître les pièces dans l'éditeur de plan.
  Commit `Atelier : tracer les murs`.

### Task 10 : étape Portes et fenêtres

**Files :** Create `src/renderer/src/mj/atelier/etapes/Ouvertures.tsx`

- Survol d'un mur bâti : aperçu de l'ouverture au point le plus proche (même rendu que
  le clic posera, comme dans l'éditeur actuel) ; clic : pose. Largeur par défaut
  **0,8 case** pour une porte, **1 case** pour une fenêtre ; glisser déplace le long du
  mur ; Suppr retire.
- Panneau : assets `type: 'porte'` puis `type: 'vitre'` ; largeur réglable.
- Vérif : poser une porte, enregistrer, ouvrir la porte depuis le plan en séance,
  réenregistrer depuis l'atelier : elle est toujours ouverte (Review Focus 2).
  Commit `Atelier : portes et fenêtres`.

### Task 11 : étapes Déco et Éclairage, import d'assets

**Files :**
- Create `src/renderer/src/mj/atelier/etapes/Deco.tsx`, `etapes/Eclairage.tsx`,
  `src/renderer/src/mj/atelier/ImportAsset.tsx`

- **Déco** : catalogue par catégorie (assets `type: 'objet'`), clic pose à la taille
  réelle avec les blocages par défaut ; poignées : déplacer, tourner (Maj = pas de 15°),
  redimensionner (coins, proportions gardées sauf Alt) ; panneau de l'objet choisi :
  cases **« Bloque le passage »** et **« Bloque la vue »**, Premier plan / Arrière-plan,
  Dupliquer (Ctrl+D), Supprimer.
- **Import** (bouton dans Sol, Murs, Portes et Déco) : choisir un fichier, type,
  nom, catégorie, taille réelle, blocages par défaut, case **« Rendre raccordable »**
  (cochée par défaut pour sol et mur) ; le renderer applique `boiteOpaque` (objets,
  portes) et `raccorder` (sols, murs) avant `api.atelier.importer`.
- **Éclairage** : demande que le lieu ait été enregistré au moins une fois (sinon
  message « Enregistre une première fois pour poser la lumière ») ; affiche l'image
  enregistrée et les lampes du lieu via `api.lumieres` existant (poser, déplacer,
  couleur, clair / pénombre, allumer / éteindre), en réutilisant les contrôles de
  lampe de l'éditeur de plan plutôt qu'en les recopiant.
- Vérif : meubler un salon, une table « bloque le passage » seulement ; en séance un
  pion ne la traverse pas mais voit derrière ; importer une image ChatGPT avec fond
  transparent, elle apparaît recadrée. Commit `Atelier : déco, éclairage et import`.

### Task 12 : raccords avec l'éditeur de plan, pack livré, version

**Files :**
- Modify : `src/renderer/src/mj/modules/Places.tsx`, `src/renderer/src/mj/components/Murs.tsx`,
  `src/renderer/src/mj/components/FicheDuLieu.tsx` (ou là où vivent rogner / caler /
  remplacer / apparences)
- Create : `resources/atelier/catalogue.json` (définitif), Modify `RELEASE_NOTES.md`, `package.json`

- Lieu `construit` : bouton **« Modifier la construction »** qui ouvre l'atelier sur ce
  lieu ; boutons rogner / caler / remplacer l'image / apparences masqués.
- `Murs.tsx` : une ligne avec `atelierId` non nul n'est ni déplaçable ni supprimable
  (curseur par défaut, info-bulle « Se modifie dans l’atelier ») ; on peut toujours
  tracer des rideaux et des murs à la main.
- Catalogue définitif à partir des fichiers que l'utilisateur a rangés dans
  `resources/atelier/` (noms, tailles et blocages de `docs/atelier/prompts-assets.md`) ;
  retirer le catalogue provisoire et l'aperçu de dev de la Tâche 6.
- Vérif finale (Review Focus 1 à 5) en dev sur un lieu construit et joué :
  pion et lampe posés, agrandir de 3 à gauche, réenregistrer ; rien n'a bougé
  physiquement, la porte verrouillée l'est encore, la scierie de référence est
  inchangée.
- Montée de version **1.7.0** et `RELEASE_NOTES.md` (première ligne
  `<!-- version: 1.7.0 -->`, sections Nouveautés / Améliorations), à faire valider
  par l'utilisateur. Commit `Écran du Maître 1.7.0 — L’atelier des lieux`.
