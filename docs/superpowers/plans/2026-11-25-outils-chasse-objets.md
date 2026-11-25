# Outils de chasse dans la main des joueurs (EMF, thermomètre) — plan de construction

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un objet peut être un EMF ou un thermomètre : les joueurs le portent, s'en servent depuis l'onglet Objets du téléphone, le posent et le ramassent sur le plan ; il mesure les zones peintes dans l'atelier, le MJ peut en prendre le contrôle, et le PC fait entendre chaque EMF selon la distance au pion le plus proche.

**Architecture:** La logique pure (lecture des calques, atténuation, repères) vit dans `src/shared/chasse.ts`. Le processus principal tient un moteur en mémoire (`src/main/chasse.ts`) qui calcule, pour chaque exemplaire d'objet-outil, sa position, sa valeur (zones ou contrôle du MJ) et son gain sonore, et le diffuse au MJ (IPC `chasse:state`), aux téléphones (état SSE) et à l'écran de la table (`DisplayState`). Les clients ne reçoivent que la valeur cible ; l'animation vivante (fluctuations, rafales, glissement de température) reste locale, avec `emf.ts` / `temperature.ts` existants.

**Tech Stack:** Electron 33, React, TypeScript, better-sqlite3 (migrations dans `src/main/db/schema.ts`), serveur HTTP + SSE maison (`src/main/mobile.ts`), Vitest (`npm test`, qui passe par le Node d'Electron).

**Spec:** `docs/superpowers/specs/2026-11-25-outils-chasse-objets-design.md`

## Global Constraints

- Textes d'interface en français, dans le ton de l'application ; commentaires de code en français comme le reste du dépôt.
- Le téléphone le plus ancien en usage : Chrome 119 (Galaxy Tab S2).
- Tout le son sort du PC (fenêtre du MJ) ; rien ne joue sur les téléphones.
- Les calques EMF/température ne sortent jamais vers les joueurs (ni téléphone, ni écran de la table).
- Pas d'asset de Phasmophobia ; images = `src/renderer/src/assets/chasse/emf.png`, `emf-eteint.png`, `thermometre.png`.
- Travail sur une branche (`outils-chasse`), pas sur `main`. Ne commiter que si l'utilisateur l'a demandé pour l'exécution.
- Montée de version (1.13.0) : `RELEASE_NOTES.md` réécrit et validé par l'utilisateur (CLAUDE.md).

## Review Focus

- Un porteur dont le personnage n'a **aucun pion** (ou des pions sur plusieurs lieux) : l'appareil doit prendre le pion du lieu affiché s'il y en a un, sinon le premier trouvé, sinon être « ailleurs », muet — jamais planter le moteur. (Tâche 4)
- Un lieu **sans construction** (plan image) : EMF 0, température ambiante 18 °C, pas d'erreur. (Tâche 4)
- Le MJ **retire l'outil** d'un objet (ou supprime l'objet) pendant que le contrôle est pris : l'appareil disparaît et le contrôle est oublié. (Tâche 4)
- **Deux joueurs ramassent** le même EMF presque en même temps : le second reçoit un refus clair, l'objet n'est pas dupliqué. (Tâche 5)
- Un exemplaire qui compte **plusieurs appareils** (qte 2) : « Poser ici » n'en pose qu'un. (Tâche 5)

---

### Task 1: La logique pure des outils de chasse

**Files:**
- Create: `src/shared/chasse.ts`
- Test: `src/shared/chasse.test.ts`

**Interfaces:**
- Produces:
  - `type OutilChasse = 'emf' | 'thermometre'` (le chantier 2 ajoutera `'spirit' | 'livre' | 'planche' | 'tarot'`) ; `OUTILS_CHASSE: { id: OutilChasse; nom: string }[]` = `[{ id: 'emf', nom: 'EMF' }, { id: 'thermometre', nom: 'Thermomètre' }]` ; `estOutil(v: unknown): v is OutilChasse`.
  - `interface TraitMesure { id: string; valeur: number | null; rayon: number; pts: PointCase[] }` — `valeur: null` = coup de gomme.
  - `AMBIANTE_DEFAUT = 18`, `PORTEE_SON_M = 15`, `ATTENUATION_MUR = 0.35`, `PORTEE_LECTURE_M = 6`, `LARGEUR_PLAN_DEFAUT_M = 30`.
  - `mesureSous(traits: TraitMesure[] | undefined, p: PointCase): number | null`
  - `niveauEmfSous(c: Construction | null, p: PointCase | null): number`
  - `temperatureSous(c: Construction | null, p: PointCase | null): number`
  - `gainSon(distanceM: number, mursTraverses: number): number`
  - `pionSurPlan(p: { x: number; y: number }, ratioCarte: number, ratioEcran: number): { x: number; y: number }`
  - `interface AppareilChasse { placementId: number; objetId: number; nom: string; outil: OutilChasse; ou: 'main' | 'lieu' | 'ailleurs'; placeId: number | null; pos: { x: number; y: number } | null; characterId: number | null; allume: boolean; valeur: number; controle: boolean; gain: number }` (`pos` en fractions du plan ; `valeur` = niveau EMF 0–5 ou °C).

- [ ] **Step 1: Write the failing tests** in `src/shared/chasse.test.ts`:
  - `mesureSous` : `[]` → `null` ; un trait `{valeur: 3, rayon: 1, pts: [[5,5]]}` → `3` en `[5.5,5]`, `null` en `[7,5]` ; deux traits qui se recouvrent (3 puis 5) → `5` (le dernier peint l'emporte, « repeindre remplace ») ; trait 4 puis gomme (`valeur: null`) au même endroit → `null`.
  - `niveauEmfSous(null, [1,1])` → `0` ; `niveauEmfSous(c, null)` → `0` ; avec `c.emf` peint à 4 → `4`.
  - `temperatureSous(null, [1,1])` → `18` ; `c.ambiante = 12` sans trait → `12` ; trait à `-5` → `-5` ; gomme par-dessus → retombe à `c.ambiante`.
  - `gainSon(0, 0)` → `1` ; `gainSon(1, 0)` → `1` ; `gainSon(15, 0)` → `0` ; `gainSon(8, 0)` entre 0 et 1 ; `gainSon(4, 1)` ≈ `gainSon(4, 0) * 0.35` ; `gainSon(4, 2)` ≈ `gainSon(4, 0) * 0.35²`.
  - `pionSurPlan({x:0.5,y:0.5}, 1, 2)` → `{x:0.5,y:0.5}` ; écran plus large que la carte (`ratioCarte 1`, `ratioEcran 2`) : `{x:0.75,y:0.5}` → `{x:1,y:0.5}` ; écran plus haut (`ratioCarte 2`, `ratioEcran 1`) : `{x:0.5,y:0.75}` → `{x:0.5,y:1}`.

- [ ] **Step 2: Run** `npm test -- src/shared/chasse.test.ts` — Expected: FAIL (module introuvable).

- [ ] **Step 3: Implement `src/shared/chasse.ts`.** `mesureSous` parcourt les traits **du dernier au premier** et rend la valeur du premier dont un point est à `≤ rayon` de `p`. `gainSon` : `clamp(1 - (d - 1) / (PORTEE_SON_M - 1), 0, 1) * ATTENUATION_MUR ** murs`. `pionSurPlan` reprend exactement `surCarte` de `src/main/sons.ts:257` mais en fractions :
  ```ts
  x: ratioEcran > ratioCarte ? (p.x - 0.5) * (ratioEcran / ratioCarte) + 0.5 : p.x
  y: ratioEcran < ratioCarte ? (p.y - 0.5) * (ratioCarte / ratioEcran) + 0.5 : p.y
  ```
  (puis borné à [0, 1]).

- [ ] **Step 4: Run** `npm test -- src/shared/chasse.test.ts` — Expected: PASS.

- [ ] **Step 5: Faire passer `src/main/sons.ts:257` `surCarte` par `pionSurPlan`** (multiplié par `g.w`, `g.h`) ; `npm test` — Expected: tout PASS (comportement des zones sonores inchangé).

- [ ] **Step 6: Commit** `feat(chasse): logique pure des calques et du son des outils`.

---

### Task 2: Les calques dans la construction

**Files:**
- Modify: `src/shared/atelier.ts` (`Construction` ~l.118, `lireConstruction` ~l.522)
- Test: `src/shared/atelier.test.ts`

**Interfaces:**
- Consumes: `TraitMesure` (Task 1).
- Produces: `Construction.emf?: TraitMesure[]`, `Construction.temperature?: TraitMesure[]`, `Construction.ambiante?: number`.

- [ ] **Step 1: Failing test** `lireConstruction garde les calques de mesure` : un brut avec `emf: [{id:'a', valeur: 4, rayon: 1, pts: [[2,2]]}, {id:'g', valeur: null, rayon: 1, pts: [[2,2]]}]`, `temperature: [{id:'t', valeur: -5, rayon: 2, pts: [[1,1]]}]`, `ambiante: 12` ressort à l'identique ; un trait EMF à `valeur: 9` est borné à 5, à `0` est écarté ; un trait sans `pts` ou `rayon ≤ 0` est écarté ; température bornée à [-20, 35] ; `ambiante` absente ou non finie → absente ; une construction sans ces champs n'en gagne pas.

- [ ] **Step 2: Run** `npm test -- src/shared/atelier.test.ts` — Expected: FAIL.

- [ ] **Step 3: Étendre `Construction` et `lireConstruction`** (mêmes gardes que `sols` : `texte(id)`, `points(pts, 1)`, `fini(rayon) && rayon > 0` ; EMF arrondi à l'entier 1–5).

- [ ] **Step 4: Run** — Expected: PASS.

- [ ] **Step 5: Commit** `feat(atelier): calques EMF et température dans la construction`.

---

### Task 3: L'outil d'un objet, en base

**Files:**
- Modify: `src/main/db/schema.ts` (migration **97**, après la 96 ~l.2090)
- Modify: `src/shared/types.ts` (`Objet` ~l.884, `ObjetVu` ~l.345)
- Modify: `src/main/db/repos/objets.ts` (`toObjet` l.184, requêtes de lecture ~l.138, `ObjetPatch` l.317, `updateObjet` l.359, `copyObjet` l.414, `objetsDe` l.586, `objetsVus` l.827, `donnerLibre` l.689)
- Test: `src/main/db/test/outilsChasse.test.ts`

**Interfaces:**
- Consumes: `OutilChasse`, `estOutil` (Task 1).
- Produces:
  - `Objet.outil: OutilChasse | null` ; `ObjetPatch.outil?: OutilChasse | null`.
  - `ObjetVu.outil?: OutilChasse` ; `objetsDe()` gagne `outil: OutilChasse | null`.
  - `ObjetPlacement.posePar: number | null` (le personnage qui l'a posé depuis son téléphone).
  - `objets.donner(placementId, cible, qte?, posePar?: number | null)` — quatrième paramètre facultatif, écrit `pose_par` (remis à `NULL` pour toute cible autre que `'lieu'`).

- [ ] **Step 1: Failing tests** (`ouvrirBaseEssai` / helpers de `src/main/db/test/base.ts`) :
  - `un objet neuf n'est pas un outil` → `addObjet({nom:'Clé'}).outil === null`.
  - `updateObjet(id, {outil:'emf'})` → relu `'emf'` ; `{outil:'nimporte'}` → refusé (reste `null`) ; `copyObjet` garde l'outil.
  - `objetsVus` rend `outil: 'emf'` pour un exemplaire trouvé posé d'un objet EMF, et pas de champ `outil` pour un objet ordinaire.
  - `donner(pl, {port:'lieu', placeId}, undefined, persoId)` → `posePar === persoId` ; redonné à un PJ → `posePar === null`.

- [ ] **Step 2: Run** `npm test -- src/main/db/test/outilsChasse.test.ts` — Expected: FAIL.

- [ ] **Step 3: Migration 97** :
  ```sql
  ALTER TABLE objet ADD COLUMN outil TEXT;            -- 'emf' | 'thermometre' | NULL
  ALTER TABLE objet_placement ADD COLUMN pose_par INTEGER REFERENCES character(id) ON DELETE SET NULL;
  ```
  Puis les champs dans les types et le dépôt (lecture via `estOutil`, sinon `null`). Vérifier que la copie de séance (`src/main/db/repos/copieSeance.ts`) recopie `outil` (elle copie les colonnes d'`objet` : s'assurer qu'aucune liste de colonnes explicite ne l'oublie).

- [ ] **Step 4: Run** `npm test` — Expected: tout PASS (dont `schema.test.ts`).

- [ ] **Step 5: Commit** `feat(objets): un objet peut être un outil de chasse`.

---

### Task 4: Le moteur des appareils (processus principal)

**Files:**
- Create: `src/main/chasse.ts`
- Modify: `src/main/display.ts:670` (`ecouterPions` accepte plusieurs écouteurs), `src/main/sons.ts:442` (s'y inscrit toujours), `src/main/index.ts` (brancher le moteur), `src/main/ipc/index.ts`, `src/preload/index.ts`
- Test: `src/main/db/test/moteurChasse.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3 ; `listPions(placeId)` (`src/main/db/repos/pions.ts:100`), `getConstruction(placeId)` (`src/main/db/repos/construction.ts:14`), `mobile.repereDuPlan(placeId)`, `barrieres`/`seCroisent` (`@shared/murs`), `listMurs`/`listOuvertures` (comme `geometrie`, `sons.ts:239`), `display.ratioEcran()`, `display.getState().placeId`.
- Produces (`src/main/chasse.ts`) :
  - `appareils(): AppareilChasse[]` — tous les exemplaires dont l'objet a un `outil` et `port` ∈ {`pj`, `lieu`} (les autres : absents de la liste).
  - `controler(placementId: number, valeur: number | null): AppareilChasse[]` — `null` lâche le contrôle ; valeur bornée (EMF 0–5, température −20–35).
  - `recalculer(): void` — recalcule, et si quelque chose a changé : `display.versMj('chasse:state', appareils)`, `mobile.broadcast()`, `display.chasseABouge(appareils)`.
- Produces (`src/shared/types.ts`, `src/main/display.ts`) : `DisplayState.chasse?: { placementId: number; outil: OutilChasse; valeur: number; allume: boolean }[]` — les appareils **posés** du lieu affiché, rien d'autre (ni porteur, ni calque) ; `display.chasseABouge(a: AppareilChasse[]): void` remplit ce champ et diffuse.
  - `brancher(): void` — s'abonne aux pions (`display.ecouterPions`) et recalcule.
  - `lisiblePar(a: AppareilChasse, characterId: number): boolean` — porteur, ou pion du personnage sur le même lieu, à `≤ PORTEE_LECTURE_M` sans mur entre eux.
- IPC (preload `window.api`, sur le modèle de `sons:state`) : `chasseEtat(): Promise<AppareilChasse[]>`, `chasseControler(placementId: number, valeur: number | null): Promise<AppareilChasse[]>`, `onChasse(cb: (a: AppareilChasse[]) => void): () => void`.

Règles (du spec) :
- **En main** : position = pion du porteur (`characterId`) — celui du lieu affiché s'il y en a un, sinon le premier trouvé ; aucun pion → `ou: 'ailleurs'`. Position du pion → fractions du plan avec `pionSurPlan(p, w/h du plan, ratioEcran())`.
- **Posé** : `port = 'lieu'` avec `pos` → `ou: 'lieu'` ; sans `pos` → `'ailleurs'`.
- Fractions → cases : `[x * c.largeur, y * c.hauteur]` ; sans construction → `null` (EMF 0, ambiante).
- **Valeur** : contrôle du MJ s'il existe, sinon `niveauEmfSous` / `temperatureSous` ; `'ailleurs'` → 0 / ambiante (`AMBIANTE_DEFAUT` sans construction).
- **Gain** (EMF seulement ; thermomètre : 0) : 0 si éteint, `valeur < 0.5` ou `'ailleurs'` ; 1 en main ; posé → `max` sur les pions **de joueurs** du même lieu de `gainSon(distance en m, murs traversés)` ; distance en m = distance en fractions de largeur × `place.echelle` (ou `LARGEUR_PLAN_DEFAUT_M`) ; murs = barrières `'pas'` coupées par le segment (`seCroisent`).
- Tous les lieux où il y a des appareils sont calculés, pas seulement le lieu affiché.
- Le contrôle survit au changement de mains et à la pose ; il est oublié quand l'exemplaire n'est plus un appareil (objet supprimé, outil retiré, jeté).

- [ ] **Step 1: Failing tests** (base d'essai ; `display` et `mobile` mockés avec `vi.mock` pour `ratioEcran` → 1, `getState` → `{ placeId }`, `repereDuPlan` → `{ w: 1000, h: 1000 }`, `broadcast`/`versMj` espions) :
  - `un EMF en main lit la zone sous le pion de son porteur` (construction 10×10 cases, trait EMF 4 autour de [5,5], pion à 0.5/0.5) → `valeur 4`, `ou 'main'`, `gain 1`.
  - `posé hors zone : niveau 0, muet` → `valeur 0`, `gain 0`.
  - `posé dans une zone, entendu selon le pion de joueur le plus proche` → deux pions, `gain` = celui du plus proche ; aucun pion de joueur sur le lieu → `gain 0`.
  - `un mur entre l'EMF et le pion atténue` → `gain` ≈ ×0.35 par rapport au même cas sans mur.
  - `posé sur un lieu qui n'est pas à l'écran, il sonne quand même` (placeId ≠ `getState().placeId`).
  - `thermomètre sans construction : ambiante 18`.
  - `éteint : gain 0`.
  - Review Focus : `porteur sans pion : ailleurs, muet` ; `pions sur deux lieux : celui du lieu affiché` ; `contrôle à 5 puis lâché : revient à la zone` ; `contrôle conservé quand l'EMF passe d'un joueur au sol` ; `outil retiré pendant le contrôle : l'appareil disparaît, le contrôle est oublié`.
  - `recalculer n'envoie rien si rien n'a changé` (espion `versMj` appelé une seule fois pour deux appels identiques).

- [ ] **Step 2: Run** `npm test -- src/main/db/test/moteurChasse.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement `src/main/chasse.ts`** (état en mémoire : `Map<placementId, valeur>` pour le contrôle, dernier état diffusé pour la comparaison) ; `ecouterPions` devient une liste d'écouteurs (le sons existant continue de marcher).

- [ ] **Step 4: Brancher les recalculs** : `chasse.brancher()` au démarrage (là où `sons.brancher()` est appelé) ; `chasse.recalculer()` après chaque geste d'objet venu du téléphone (`equiper`, `allumer`, `prendre`, `remettre` dans `mobile.ts` ~l.1385–1502), après l'IPC qui modifie objets/exemplaires côté MJ (chercher les `versMj('objets:changes'` et les handlers IPC d'objets dans `src/main/ipc/index.ts`), après `atelier.enregistrer`.

- [ ] **Step 5: Run** `npm test` — Expected: tout PASS.

- [ ] **Step 6: Commit** `feat(chasse): moteur des appareils, contrôle du MJ, gain sonore`.

---

### Task 5: Poser et ramasser depuis le téléphone

**Files:**
- Modify: `src/main/chasse.ts`, `src/main/mobile.ts` (routes l.972–988 ; `etatPour` ~l.251/740)
- Test: `src/main/db/test/moteurChasse.test.ts`

**Interfaces:**
- Consumes: Task 4 ; `objets.donner` (Task 3) ; `RAYON_PION` (`@shared/murs`).
- Produces :
  - `poserOutil(characterId: number, placementId: number): string | null` — `null` = fait, sinon le message de refus. Refuse si l'exemplaire n'est pas un outil porté par ce personnage, ou si son pion n'est sur aucun lieu. Détache **un seul** appareil (`qte: 1`), le donne au lieu du pion (`port 'lieu'`, `posePar = characterId`) puis `situer` à la position du pion (fractions du plan).
  - `ramasserOutil(characterId: number, placementId: number): string | null` — refuse si ce n'est pas un outil posé (`port ≠ 'lieu'` → « Quelqu'un l'a déjà ramassé. »), si le pion du personnage n'est pas sur le même lieu, à plus de `3 × RAYON_PION × max(w, h)` px, ou si un mur (`'pas'`) les sépare. Sinon `donner(…, { port: 'pj', characterId })`.
  - Routes `POST /api/poser` et `POST /api/ramasser` (`{ placementId }`), mêmes gardes que `equiper` (`exige`, personnage attribué), puis `display.calqueABouge()`, `versMj('objets:changes', null)`, `chasse.recalculer()`, `broadcast()`.
  - Dans l'état du téléphone : `outils: { placementId: number; nom: string; outil: OutilChasse; ou: 'main' | 'lieu'; allume: boolean; valeur: number | null }[]` — les appareils qu'il porte et ceux qu'il a posés (`posePar`), `valeur` à `null` si `!lisiblePar` ; et `appareilsPoses: { placementId: number; outil: OutilChasse; valeur: number; allume: boolean }[]` pour les appareils posés du lieu affiché (le plan du téléphone les dessine sous l'ombre).

- [ ] **Step 1: Failing tests** : `poser met l'EMF sous le pion, trouvé, posé par lui` ; `poser d'une pile de deux n'en pose qu'un` ; `ramasser trop loin est refusé` ; `ramasser à travers un mur est refusé` ; `deux ramassages : le second est refusé et l'EMF n'est pas dupliqué` ; `on ne pose pas l'EMF d'un autre`.

- [ ] **Step 2: Run** — Expected: FAIL.

- [ ] **Step 3: Implement** `poserOutil`, `ramasserOutil`, les deux routes, les deux champs d'état.

- [ ] **Step 4: Run** `npm test` — Expected: PASS.

- [ ] **Step 5: Commit** `feat(portable): poser et ramasser un outil de chasse sur le plan`.

---

### Task 6: Les appareils dessinés, partagés MJ / téléphone / table

**Files:**
- Create: `src/renderer/src/mj/chasse/PhotoEmf.tsx` (sortie de `src/renderer/src/mj/modules/Emf.tsx:179`, avec `LEDS_PHOTO`, `PHOTO_L/H`, `MARGE_DECOUVERTE`)
- Create: `src/renderer/src/mj/chasse/EcranThermometre.tsx` (la photo + l'afficheur, sortis de `Thermometre.tsx`)
- Create: `src/renderer/src/mj/chasse/vivant.ts` — `useNiveauVivant(cible: number, allume: boolean): number` (EMF : fluctuations/rafales autour de la cible, comme la page EMF actuelle) et `useTemperatureVivante(cible: number): number` (`rapprocher`)
- Create: `src/renderer/src/shared/outilsChasse.tsx` — `imageOutil(o: OutilChasse): string` (URL de l'asset) ; `<AppareilPose outil valeur allume taille />` : la photo réduite vue « posée à plat » + une lueur radiale (couleur `LEDS_EMF[ledsAllumees(valeur) - 1]` pour l'EMF, rayon croissant avec le niveau, rien au niveau 0 ; pour le thermomètre, bleu sous 10 °C via `froid(t)`, orangé au-dessus de 25 °C, neutre entre)
- Modify: `src/renderer/src/mj/modules/Emf.tsx`, `src/renderer/src/mj/chasse/Thermometre.tsx` (utilisent les composants extraits)

**Interfaces:**
- Consumes: `LEDS_EMF`, `ledsAllumees` (`emf.ts`), `rapprocher`, `froid`, `texteTemperature` (`temperature.ts`).
- Produces: `PhotoEmf({ n: number; eteint?: boolean })` (éteint : aucune LED ; allumé au niveau 0 : la première LED verte seule, cf. spec) ; `EcranThermometre({ t: number; eteint?: boolean })` ; `useNiveauVivant`, `useTemperatureVivante` ; `imageOutil`, `AppareilPose`.

- [ ] **Step 1: Failing test** `src/renderer/src/mj/chasse/emf.test.ts` : nouvelle fonction pure `ledsVisibles(niveau: number, allume: boolean): number` dans `emf.ts` — éteint → 0 ; allumé niveau 0 → 1 ; niveau 3 → 3 ; niveau 5 → 5.
- [ ] **Step 2: Run** — FAIL. **Step 3:** implémenter `ledsVisibles` et les extractions. **Step 4:** `npm test` PASS, puis `npm run dev` : les pages EMF et Thermomètre de Simulation Objets s'affichent et réagissent comme avant (contrôle visuel).
- [ ] **Step 5: Commit** `refactor(chasse): appareils dessinés réutilisables`.

---

### Task 7: L'outil dans la fiche d'objet, et son image partout

**Files:**
- Modify: `src/renderer/src/mj/modules/Objets.tsx` (fiche d'objet), les listes d'objets côté MJ qui affichent l'image, `src/main/mobile.ts` (`avecImage`), le dessin des objets du téléphone (`src/renderer/src/mobile/Mobile.tsx` ~l.3294) et de la table (`src/renderer/src/shared/Slide.tsx` ~l.1724)

**Interfaces:**
- Consumes: `Objet.outil`, `ObjetVu.outil` (Task 3), `DisplayState.chasse` (Task 4), `appareilsPoses` (Task 5), `imageOutil`, `AppareilPose` (Task 6).

- [ ] **Step 1:** Dans la fiche d'objet, un choix « Outil de chasse » : *Aucun* + `OUTILS_CHASSE`. Un objet-outil n'offre plus le choix d'image : il montre `imageOutil(outil)`.
- [ ] **Step 2:** Partout où une image d'objet est rendue (MJ, sac du téléphone, inventaires ouverts, plan), un objet-outil prend `imageOutil(outil)`. Sur les plans (téléphone et table), un `ObjetVu` avec `outil` se dessine avec `<AppareilPose>` et la valeur / l'état allumé venus de `appareilsPoses` (téléphone) ou `DisplayState.chasse` (table), toujours **sous l'ombre** comme les autres objets.
- [ ] **Step 3: Vérifier** `npm run dev` : un objet passé en EMF montre la photo dans la fiche, dans le sac du téléphone et sur le plan ; masqué dans le noir.
- [ ] **Step 4: Commit** `feat(objets): choisir l'outil de chasse d'un objet`.

---

### Task 8: Peindre les calques dans l'atelier (étape Objets)

**Files:**
- Create: `src/renderer/src/mj/atelier/etapes/Mesures.tsx` — le pinceau des calques, monté par l'étape Objets
- Modify: `src/renderer/src/mj/atelier/etapes/Deco.tsx` (un sélecteur en tête de panneau : **Objets · EMF · Température**), `src/renderer/src/mj/atelier/rendu.ts` (dessin du calque actif par-dessus la construction, dans l'atelier seulement)

**Interfaces:**
- Consumes: `TraitMesure`, `Construction.emf/temperature/ambiante` (Task 2) ; `PropsEtape` (`src/renderer/src/mj/modules/Atelier.tsx:39`) ; le geste d'aérosol de `src/renderer/src/mj/atelier/etapes/Sol.tsx:103-120` (un point tous les quarts de rayon, trait validé au relâcher).
- Produces: `EtapeMesures(props: PropsEtape & { calque: 'emf' | 'temperature' }): JSX.Element`.

- [ ] **Step 1:** Mode EMF : cinq pastilles 1–5 aux couleurs de `LEDS_EMF`, Gomme, taille du pinceau (comme le sol). Chaque trait relâché s'ajoute à `c.emf` (`valeur` choisie, ou `null` pour la gomme) via `co.modifier`.
- [ ] **Step 2:** Mode Température : un champ de valeur en °C (−20 à 35, pas de 1), Gomme, taille du pinceau, et le réglage **Température ambiante** (`c.ambiante`, 18 par défaut) avec une phrase d'aide : « Hors des zones peintes, le thermomètre lit cette température. »
- [ ] **Step 3:** Rendu : dans le mode actif seulement, chaque trait dessiné en disques semi-transparents de sa couleur (EMF : couleur du niveau ; température : bleu → rouge), dans l'ordre (le dernier par-dessus) ; la gomme découpe (`destination-out`). Rien n'en sort dans l'image enregistrée du plan.
- [ ] **Step 4: Vérifier** `npm run dev` sur la séance de référence « La scierie » : peindre, gommer, enregistrer, rouvrir — les calques sont retrouvés et n'apparaissent pas sur l'image du plan.
- [ ] **Step 5: Commit** `feat(atelier): peindre les zones EMF et température`.

---

### Task 9: Côté MJ — prendre le contrôle, et le son du PC

**Files:**
- Create: `src/renderer/src/mj/chasse/Appareils.tsx` — la liste des appareils en jeu
- Create: `src/renderer/src/mj/chasse/SonsChasse.tsx` — moteur sonore, monté une fois dans `src/renderer/src/mj/App.tsx`
- Modify: `src/renderer/src/mj/modules/SimulationObjets.tsx` (la liste en tête de page), `src/renderer/src/mj/store.ts` (état `chasse: AppareilChasse[]` alimenté par `onChasse`)

**Interfaces:**
- Consumes: IPC de la Task 4 ; `PhotoEmf`, `EcranThermometre`, hooks vivants (Task 6) ; `SonEmf` (`emf.ts:80` : `demarrer`, `setNiveau`, `setVolume`, `arreter`).

- [ ] **Step 1:** `Appareils` : une ligne par appareil — vignette, nom, où (« en main de Léa », « posé — Chambre de l'enfant », « rangé »), valeur du moment (même dans le noir), et un bouton **Prendre le contrôle de cet objet** / **Lâcher le contrôle de cet objet**. Sous contrôle : la ligne est marquée, et un curseur (EMF 0–5 au dixième, comme `Emf.tsx` ; température −20–35) envoie `chasseControler`. Un geste suffit pendant la séance : la liste est en tête de Simulation Objets.
- [ ] **Step 2:** `SonsChasse` : une instance `SonEmf` par appareil EMF dont `gain > 0` ; `setNiveau(valeur)`, `setVolume(gain)` à chaque état ; arrêtée quand l'appareil disparaît ou que son gain tombe à 0. Respecter le volume général du MJ s'il en existe un (`src/renderer/src/mj/volume.ts`).
- [ ] **Step 3: Vérifier** `npm run dev` + un téléphone : un EMF pris dans un inventaire ouvert, pion promené vers une zone 4 → le PC grésille plus vite ; posé puis pion éloigné dans une autre pièce → plus faible ; « Prendre le contrôle » → curseur à 5 → toutes les LED et le son suivent ; « Lâcher » → retour à la zone.
- [ ] **Step 4: Commit** `feat(chasse): contrôle des appareils par le MJ et son du PC`.

---

### Task 10: Le téléphone — onglet Objets et Ramasser

**Files:**
- Create: `src/renderer/src/mobile/Outils.tsx` — l'onglet Objets (liste + page d'un appareil)
- Modify: `src/renderer/src/mobile/Mobile.tsx` (`Onglet` l.261 gagne `'outils'`, rendu l.914–918, barre l.923–927 ; le plan `Plan` l.2778 : toucher un appareil posé)
- Modify: `src/renderer/src/styles/mobile.css`

**Interfaces:**
- Consumes: champs d'état `outils`, `appareilsPoses` (Task 5) ; routes `/api/allumer` (existante), `/api/poser`, `/api/ramasser` (Task 5) ; `PhotoEmf`, `EcranThermometre`, hooks vivants, `imageOutil` (Task 6).

- [ ] **Step 1:** L'onglet s'appelle **Objets** et n'apparaît que si `outils.length > 0`. Chaque ligne : image (`imageOutil`), nom, « allumé » / « éteint », « en main » / « posé ». Toucher une ligne **en main** ouvre la page de l'appareil ; une ligne **posée** montre sa valeur si elle n'est pas `null`, rien sinon.
- [ ] **Step 2:** Page d'un appareil : `PhotoEmf` (niveau vivant) ou `EcranThermometre`, boutons **Allumer / Éteindre** (`/api/allumer`) et **Poser ici** (`/api/poser`) ; après la pose, retour à la liste. Un refus du serveur s'affiche comme les autres refus du téléphone.
- [ ] **Step 3:** Sur le plan, toucher un appareil posé propose **Ramasser** (`/api/ramasser`) ; le refus « trop loin » se lit en clair (« Approche-toi pour le ramasser. »).
- [ ] **Step 4: Vérifier** `npm run dev` avec un téléphone (et la Galaxy Tab S2 sous Chrome) : prendre l'EMF dans l'inventaire, l'onglet Objets apparaît, l'EMF réagit en marchant, Poser ici, il apparaît sur le plan avec sa lueur, s'éloigner, Ramasser refusé, revenir, Ramasser accepté ; un second joueur voit l'EMF posé, pas dans le noir.
- [ ] **Step 5: Commit** `feat(portable): onglet Objets et outils de chasse en main`.

---

### Task 11: Version et rapport de mise à jour

**Files:**
- Modify: `package.json` (1.12.0 → **1.13.0**), `RELEASE_NOTES.md`

- [ ] **Step 1:** Réécrire `RELEASE_NOTES.md` (première ligne `<!-- version: 1.13.0 -->`, sections `### Nouveautés` / `### Améliorations` / `### Corrections` utiles seulement, écrit pour le MJ, couvrant `git log v1.12.0..HEAD`).
- [ ] **Step 2:** Le faire valider par l'utilisateur **avant** toute publication.
- [ ] **Step 3: Run** `npm test` et `npm run build` — Expected: PASS, build sans erreur de types.
- [ ] **Step 4: Commit** `1.13.0 : outils de chasse dans la main des joueurs`.
