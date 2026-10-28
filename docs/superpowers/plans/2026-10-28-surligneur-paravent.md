# Surligneur du Paravent — plan de réalisation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** un mode surligneur au Paravent qui surligne (et dé-surligne) au glissé le texte des moments, des annexes et des fiches de lieu, persistant, privé au MJ, défaisable par Ctrl+Z.

**Architecture :** les surlignages vivent dans une table `surlignage` à part (jamais dans les textes), adressés par une *cible* `sorte:id:champ` qui désigne le texte propriétaire, pas l'endroit de lecture. Le renderer les affiche par la **CSS Custom Highlight API** (`CSS.highlights`, Chromium 130 d'Electron 33) : aucun changement du DOM, donc compatible avec `dangerouslySetInnerHTML` et React. Toute écriture passe par un seul canal IPC suivi par `defaire.ts` (module `surlignage`), qui remplace les lignes des cibles touchées (DELETE + INSERT : jamais fondu dans une rafale → un glissé = un pas).

**Tech Stack :** Electron 33, React 18, zustand 5, better-sqlite3, vitest.

**Spec :** `docs/superpowers/specs/2026-10-28-surligneur-paravent-design.md`

## Global Constraints

- Rien du surlignage ne passe par `display.ts`, les portables ni `Slide` : comme `repos/annotations.ts`, le dépôt est isolé et le dit en tête de fichier.
- Les textes (`item.body`, `place.summary`…) ne sont **jamais** modifiés par le surligneur.
- Une seule couleur, variable CSS `--surligneur` (jaune feutre), lisible en thème clair et sombre.
- Ctrl+Z / Ctrl+Y : libellé du pas « Surlignage » ; un glissé = un pas ; un effacement total = un pas ; la réinitialisation (case cochée) reste un seul pas qui rend aussi les surlignages.
- Case de réinitialisation : « Retirer tous les surlignages », **décochée par défaut**, toute la campagne.
- Code, commentaires et libellés en français, dans le ton des fichiers voisins (commentaires en prose qui disent le pourquoi).
- Commits terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Glissé à cheval sur plusieurs textes** (fin d'un document, début du suivant ; ou titre + si/alors d'un article) : chaque cible touchée bascule sur sa portion, en un seul pas de Ctrl+Z. → test de `decouper` (Tâche 1) et un seul appel `remplacer` (Tâche 3).
2. **Texte réécrit dans l'Éditeur après surlignage** : le passage cité est retrouvé près de sa place, sinon le surlignage ne s'affiche plus ; jamais de surlignage décalé sur le mauvais mot. → tests de `placer` (Tâche 1).
3. **Clic simple en mode surligneur** (cases à cocher, « Montrer », replier un article) : un clic sans sélection garde son effet normal ; seul un glissé surligne. → étape de vérification manuelle (Tâche 4).
4. **Même texte affiché deux fois à l'écran** (document rattaché au moment et lu en annexe, article épinglé relu sur un étage) : les deux affichages se mettent à jour ensemble. → plages tenues par cible dans un store unique (Tâche 3).
5. **Texte replié par `TexteCourt` (lignes=4)** : un surlignage dans la partie cachée ne casse rien et réapparaît en dépliant. → vérification manuelle (Tâche 5).

---

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `src/shared/surlignage.ts` (+ `.test.ts`) | Logique pure : basculer, fusionner, découper un glissé, replacer après réécriture. |
| `src/main/db/schema.ts` | Migration 89 : table `surlignage`. |
| `src/main/db/repos/surlignage.ts` | Lister, remplacer, effacer, tout effacer. |
| `src/main/ipc/index.ts`, `src/preload/index.ts` | Canaux `surlignage:*`. |
| `src/main/defaire.ts` | Module `surlignage: 'Surlignage'`. |
| `src/main/reinitialiser.ts`, `src/shared/types.ts`, `components/ReinitSeance.tsx` | Case de réinitialisation. |
| `src/renderer/src/mj/surligneur.tsx` | Store, mode, `<Surlignable>`, bouton du mode, bouton d'effacement, peinture des highlights. |
| `src/renderer/src/styles/app.css` | `--surligneur`, `::highlight(surligne)`, curseur feutre. |
| `mj/modules/Pupitre.tsx`, `mj/components/FicheDuLieu.tsx` | Branchement sur les textes lus. |

---

### Task 1 : la logique pure du surlignage

**Files :**
- Create : `src/shared/surlignage.ts`
- Test : `src/shared/surlignage.test.ts`

**Interfaces :**
- Produces :
  ```ts
  export type Sorte = 'item' | 'beat' | 'place' | 'carte' | 'scenario' | 'character' | 'objet'
  /** « item:12:body » : le texte propriétaire, jamais l'endroit où on le lit. */
  export type Cible = string
  export const cible = (sorte: Sorte, id: number, champ: string): Cible
  /** debut/fin : décalages dans le texte brut (textContent) du champ ; cite : ce qu'il y avait entre les deux. */
  export interface Plage { debut: number; fin: number; cite: string }
  /** Le glissé [debut, fin[ : s'il commence dans du surligné il dé-surligne, sinon il surligne (et fond ce qui touche). Plages triées. */
  export function basculer(plages: Plage[], debut: number, fin: number, texte: string, effacer?: boolean): Plage[]
  /** Où afficher chaque plage dans le texte actuel ; les introuvables disparaissent. */
  export function placer(plages: Plage[], texte: string): { debut: number; fin: number }[]
  ```
  `effacer` force le sens (utilisé pour les cibles suivantes d'un glissé à cheval : le sens est décidé par la première).

- [ ] **Step 1 : écrire les tests qui échouent** (`src/shared/surlignage.test.ts`)

  ```ts
  const T = 'Le manoir est vide. La cave cache un corps.'
  // basculer
  expect(basculer([], 3, 9, T)).toEqual([{ debut: 3, fin: 9, cite: 'manoir' }])
  // fusion d'un chevauchement et d'un contact
  expect(basculer([{ debut: 3, fin: 9, cite: 'manoir' }], 7, 13, T)).toEqual([{ debut: 3, fin: 13, cite: 'manoir est' }])
  expect(basculer([{ debut: 3, fin: 9, cite: 'manoir' }], 9, 13, T)).toEqual([{ debut: 3, fin: 13, cite: 'manoir est' }])
  // commencer dans du surligné : dé-surligne en coupant
  expect(basculer([{ debut: 0, fin: 19, cite: T.slice(0, 19) }], 3, 9, T)).toEqual([
    { debut: 0, fin: 3, cite: 'Le ' }, { debut: 9, fin: 19, cite: ' est vide.' }
  ])
  // sens forcé
  expect(basculer([], 3, 9, T, true)).toEqual([])
  // glissé vide ou inversé : rien
  expect(basculer([], 5, 5, T)).toEqual([])
  // placer : à sa place
  expect(placer([{ debut: 3, fin: 9, cite: 'manoir' }], T)).toEqual([{ debut: 3, fin: 9 }])
  // placer : texte réécrit avant → retrouvé au plus près
  expect(placer([{ debut: 3, fin: 9, cite: 'manoir' }], 'Le vieux manoir est vide.')).toEqual([{ debut: 9, fin: 15 }])
  // placer : deux occurrences → la plus proche de l'ancienne place
  expect(placer([{ debut: 18, fin: 22, cite: 'cave' }], 'cave. Le manoir. La cave.')).toEqual([{ debut: 20, fin: 24 }])
  // placer : disparu → rien
  expect(placer([{ debut: 3, fin: 9, cite: 'manoir' }], 'La maison est vide.')).toEqual([])
  ```

- [ ] **Step 2 : lancer** `npx vitest run src/shared/surlignage.test.ts` — attendu : FAIL (module introuvable).
- [ ] **Step 3 : écrire `src/shared/surlignage.ts`.** `basculer` : borne [debut, fin] dans [0, texte.length], ordonne ; « commence dans du surligné » = une plage avec `p.debut <= debut < p.fin`. Après toute opération, recalculer `cite = texte.slice(debut, fin)` et jeter les plages vides. `placer` : `texte.slice(debut, fin) === cite` → telle quelle ; sinon toutes les occurrences de `cite` (`indexOf` en boucle), garder celle dont le début est le plus proche de `debut`.
- [ ] **Step 4 : lancer** `npx vitest run src/shared/surlignage.test.ts` — attendu : PASS.
- [ ] **Step 5 : commit** `Surligneur : la logique des plages`.

---

### Task 2 : la table, le dépôt, les canaux, le défaire, la réinitialisation (côté main)

**Files :**
- Modify : `src/main/db/schema.ts` (migration `id: 89` à la fin de `MIGRATIONS`)
- Create : `src/main/db/repos/surlignage.ts`
- Modify : `src/main/ipc/index.ts`, `src/preload/index.ts`, `src/main/defaire.ts` (`MODULES`), `src/main/reinitialiser.ts`, `src/shared/types.ts` (`ChoixReinit`)

**Interfaces :**
- Consumes : `Cible`, `Plage` (Tâche 1).
- Produces :
  - Migration 89 :
    ```sql
    /* Le surligneur du Paravent : ce que le MJ a marqué « fait » dans ce qu'il lit.
       À part des textes, qui n'en savent rien ; adressé au texte propriétaire
       (cible « item:12:body »), pas à l'endroit où on le lit. */
    CREATE TABLE surlignage (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL REFERENCES campaign(id) ON DELETE CASCADE,
      cible       TEXT NOT NULL,
      debut       INTEGER NOT NULL,
      fin         INTEGER NOT NULL,
      cite        TEXT NOT NULL
    );
    CREATE INDEX idx_surlignage ON surlignage(campaign_id, cible);
    ```
  - Repo (campagne active via `activeCampaignId()`) :
    `listSurlignages(): Record<Cible, Plage[]>` ;
    `remplacer(changes: { cible: Cible; plages: Plage[] }[]): void` — dans une transaction : DELETE des lignes de chaque cible puis INSERT de ses plages ;
    `effacer(cibles: Cible[]): void` ;
    `toutEffacer(): number`.
  - IPC (`on(...)`, comme `annotations:*`) : `surlignage:liste`, `surlignage:remplacer`, `surlignage:effacer`. Preload : `window.jdr.surlignage = { liste, remplacer, effacer }` avec les types ci-dessus.
  - `defaire.ts` : `surlignage: 'Surlignage'` dans `MODULES` (pas dans `CANAUX_HORS`). `surlignage:liste` n'écrit rien, il ne fait donc pas de pas.
  - `ChoixReinit.surlignages: boolean` (doc : « Les surlignages du Paravent, de toute la campagne. ») ; `reinitialiser` appelle `toutEffacer()` si coché, et renvoie aussi `surlignages: number`.

- [ ] **Step 1 :** migration 89, repo, IPC, preload, `MODULES`, `ChoixReinit` + `reinitialiser`. Le DELETE+INSERT de `remplacer` n'est jamais « que des UPDATE » : `noterPas` ne le fond donc pas dans une rafale (voir `cases()`), c'est voulu, l'écrire en commentaire.
- [ ] **Step 2 : lancer** `npm run typecheck` — attendu : aucune erreur (le compilateur signale `DEFAUT` de `ReinitSeance.tsx` incomplet : y ajouter `surlignages: false` ici, la case visible vient en Tâche 6).
- [ ] **Step 3 : commit** `Surligneur : la table et ses canaux`.

---

### Task 3 : le surligneur côté MJ (store, mode, `<Surlignable>`, effacement)

**Files :**
- Create : `src/renderer/src/mj/surligneur.tsx`
- Modify : `src/renderer/src/styles/app.css`

**Interfaces :**
- Consumes : `basculer`, `placer`, `cible`, `Plage`, `Cible` (Tâche 1) ; `window.jdr.surlignage` (Tâche 2) ; `useEchap` (`mj/echap`).
- Produces :
  ```ts
  /** Le mode feutre, et les plages de la campagne par cible (un seul store : un texte lu deux fois se met à jour deux fois). */
  export const useSurligneur: UseBoundStore<StoreApi<{
    actif: boolean
    plages: Record<Cible, Plage[]>
    basculerMode(on?: boolean): void
    charger(): Promise<void>
  }>>
  /** Un texte surlignable. Avec `html`, rend le HTML (comme dangerouslySetInnerHTML) ; sinon ses enfants. Pose data-cible. */
  export function Surlignable(props: { cible: Cible; as?: 'div' | 'span' | 'dd' | 'p'; className?: string; html?: string; children?: React.ReactNode }): JSX.Element
  /** Le feutre : bouton du mode, raccourci H (hors champ), Échap pour sortir. À poser dans chaque en-tête de lecture. */
  export function BoutonSurligneur(): JSX.Element
  /** « Effacer le surlignage » des cibles sous `conteneur` ; ne s'affiche que s'il y a quelque chose à effacer. */
  export function EffacerSurlignage(props: { conteneur: React.RefObject<HTMLElement> }): JSX.Element | null
  /** Monté une fois par le Paravent : charge, écoute jdr:defait (relire), écoute le glissé, peint les highlights, quitte le mode au démontage. */
  export function Surligneur(): null
  ```

- [ ] **Step 1 : le store et le chargement.** `charger` lit `window.jdr.surlignage.liste()`. `Surligneur` appelle `charger` au montage et à chaque `jdr:defait`, et remet `actif` à `false` au démontage.
- [ ] **Step 2 : la peinture.** Chaque `Surlignable` s'inscrit (élément + cible) dans un registre de module. Après chaque rendu et chaque changement de `plages`, reconstruire **un** `Highlight` nommé `surligne` : pour chaque élément inscrit, `placer(plages[cible], el.textContent)` puis convertir les décalages en `Range` en parcourant les nœuds texte (`TreeWalker` `SHOW_TEXT`). `CSS.highlights.set('surligne', h)`. Un `MutationObserver` (subtree, characterData, childList) sur chaque élément redemande une peinture (texte relu, `TexteCourt` déplié).
- [ ] **Step 3 : le glissé.** En mode actif, au `mouseup` du document : sélection non vide, sinon rien (le clic garde son effet). Pour chaque élément inscrit que la sélection touche, dans l'ordre du document, découper la portion (`Range` borné à l'élément, décalages = longueur de `Range(el début → point)`.toString()). Le sens est décidé par la première cible (`basculer` sans `effacer`, puis comparer : a-t-on retiré ?), les suivantes reçoivent `effacer` forcé. Mise à jour optimiste du store, **un seul** `remplacer(changes)`, puis `getSelection().removeAllRanges()` et annulation du `click` qui suit (capture, une fois).
- [ ] **Step 4 : le mode.** `BoutonSurligneur` : bouton icône (un feutre dans `components/Icons.tsx`, dans le style des voisins), `aria-pressed`, titre « Surligneur (H) ». Touche `h`/`H` sans modificateur hors champ : bascule ; `useEchap(() => basculerMode(false), actif)`. Mode actif : classe `surligneur-actif` sur `document.body`.
- [ ] **Step 5 : l'effacement.** `EffacerSurlignage` lit les `[data-cible]` sous `conteneur.current` (après rendu et à chaque changement de `plages`), s'affiche si l'une a des plages ; au clic, `effacer([...cibles])` et mise à jour du store. Petit bouton texte « Effacer le surlignage ».
- [ ] **Step 6 : le CSS.** Dans `app.css`, `--surligneur` dans les tokens clair et sombre (jaune feutre translucide, p. ex. `rgba(255, 221, 0, 0.45)` clair, `rgba(255, 214, 0, 0.32)` sombre), `::highlight(surligne) { background-color: var(--surligneur); color: inherit; }`, et `body.surligneur-actif [data-cible] { cursor: text; }` avec un curseur feutre (SVG en data URL) ; `user-select: text` sur `[data-cible]` si un parent l'interdit.
- [ ] **Step 7 : lancer** `npm run typecheck` — attendu : aucune erreur.
- [ ] **Step 8 : commit** `Surligneur : le feutre et son store`.

---

### Task 4 : brancher les moments et les annexes

**Files :**
- Modify : `src/renderer/src/mj/modules/Pupitre.tsx`

**Interfaces :**
- Consumes : `Surligneur`, `Surlignable`, `BoutonSurligneur`, `EffacerSurlignage` (Tâche 3), `cible` (Tâche 1).

- [ ] **Step 1 :** monter `<Surligneur />` une fois dans le Paravent.
- [ ] **Step 2 : moment** (bloc `lect-body`, ~l. 1378) : `beat.note` → `<Surlignable as="p" className="mine" cible={cible('beat', beat.id, 'note')}>` ; chaque document → `<Surlignable className="read-body" cible={cible('item', d.id, 'body')} html={d.body || '<p class="rien">Ce texte est vide.</p>'} />` ; le titre `h4` de chaque document → `cible('item', d.id, 'title')`. Un `EffacerSurlignage` par `article.read` (ref sur l'article), et un dans `lect-head` du moment dont le conteneur ne couvre que la note.
- [ ] **Step 3 : annexe** (~l. 1194) : corps → `cible('item', annexe.id, 'body')`, titre `h3` → `cible('item', annexe.id, 'title')` ; `EffacerSurlignage` sur tout le bloc annexe dans `lect-head`.
- [ ] **Step 4 :** `BoutonSurligneur` dans chaque `lect-head` (lieu ~l. 1135, annexe, moment).
- [ ] **Step 5 : lancer** `npm run typecheck`, puis `npm run dev` : au Paravent, surligner un passage d'un moment, re-glisser dessus (dé-surligne), Ctrl+Z (revient), Ctrl+Y ; glisser à cheval sur deux documents puis un seul Ctrl+Z ; un document rattaché aussi en annexe montre le même surlignage ; quitter/revenir au Paravent et relancer l'app (persiste) ; écran joueurs et Éditeur sans surlignage ; un clic simple sur un bouton du moment marche en mode feutre.
- [ ] **Step 6 : commit** `Surligneur : moments et annexes`.

---

### Task 5 : brancher la fiche du lieu

**Files :**
- Modify : `src/renderer/src/mj/modules/Pupitre.tsx` (résumé ~l. 1170 via `TexteDeLieu`, notes dans `apres`), `src/renderer/src/mj/components/FicheDuLieu.tsx` (`FicheCompacte` et ses lignes)

**Interfaces :**
- Consumes : Tâche 3, `cible`.

- [ ] **Step 1 :** `TexteDeLieu` reçoit une `cible` et enveloppe ses paragraphes dans un seul `Surlignable` (un seul champ, plusieurs `<p>`) ; résumé → `cible('place', lieu.id, 'summary')`, notes → `cible('place', lieu.id, 'notes')`.
- [ ] **Step 2 :** dans `FicheCompacte` et les lignes qu'elle rend : titre d'article `cible('carte', c.id, 'titre')`, si/alors `cible('carte', c.id, 'si')` / `'alors'` — dans les **deux** rendus (`<dl>` déplié et ligne « SI … ALORS … » repliée, ~l. 1245 et ~l. 2419–2449) ; titre de scénario `cible('scenario', sc.id, 'titre')` ; notes de PNJ `cible('character', c.id, 'notes')` (~l. 2012 et ~l. 2769) ; texte d'objet `cible('objet', o.id, <champ affiché>)` (~l. 2260). Ne jamais envelopper un bouton ou une case.
- [ ] **Step 3 :** `EffacerSurlignage` dans l'en-tête de la fiche du lieu au Paravent, conteneur = toute la fiche (résumé, notes, articles, PNJ, objets).
- [ ] **Step 4 : lancer** `npm run typecheck`, puis `npm run dev` : surligner un si/alors replié, le déplier (surligné aussi) ; un article épinglé par un bâtiment relu sur un étage montre le même surlignage ; une note de PNJ repliée par `TexteCourt` puis dépliée ; cocher un article en mode feutre (le clic coche) ; « Effacer le surlignage » vide toute la fiche, Ctrl+Z la rend.
- [ ] **Step 5 : commit** `Surligneur : la fiche du lieu`.

---

### Task 6 : la case de réinitialisation

**Files :**
- Modify : `src/renderer/src/mj/components/ReinitSeance.tsx`, `src/renderer/src/mj/surligneur.tsx`

- [ ] **Step 1 :** dans `CASES`, après `journalJets` : `{ k: 'surlignages', nom: 'Retirer tous les surlignages', aide: 'Ceux du Paravent, dans toute la campagne.' }` ; `DEFAUT.surlignages = false`.
- [ ] **Step 2 :** après une réinitialisation qui a coché la case, relire le store (`useSurligneur.getState().charger()`).
- [ ] **Step 3 : lancer** `npm run typecheck` et `npm test` — attendu : aucune erreur, tous les tests passent. Puis `npm run dev` : réinitialiser sans cocher (les surlignages restent), en cochant (ils partent), Ctrl+Z (ils reviennent avec le reste).
- [ ] **Step 4 : commit** `Surligneur : le retirer en réinitialisant la séance`.
