# Assistance à la santé mentale — plan de construction

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une vue SM dans le Paravent qui calcule les pertes de santé mentale, applique les paliers et rappelle leurs effets, réglable dans une nouvelle rubrique des Paramètres.

**Architecture:** Toute la règle (jet, paliers, folie, prix, activité, défauts de l'annexe) est faite de fonctions pures dans `src/shared/santeMentale.ts`, testées avec vitest. Les réglages sont une valeur JSON de la campagne (`setting['sm']`, comme `monnaies`). Les événements par séance ont leur table `sm_evenement`. L'état de jeu (jets attendus, chronos, comptes à rebours, folies, alertes) vit dans un store zustand du renderer MJ, `useSm`, hors base. Les jets arrivent par un nouvel évènement `sm:jet` émis par `noterJet`.

**Tech Stack:** Electron + electron-vite, React 18, TypeScript, zustand, better-sqlite3, vitest.

**Spec:** `docs/superpowers/specs/2026-10-27-sante-mentale-design.md`

## Global Constraints

- Tout le texte visible est en français, au ton du reste de l'app. Les commentaires suivent le style du code voisin (français, phrases, le « pourquoi »).
- Clé de réglage : `sm` (JSON). Rubrique : `'sante'`, nom « Santé mentale ». Module éteint par défaut (`actif: false`).
- Total du jet = celui de l'app (`noterJet` : d20 + `modificateur(valeur)` + bonus/malus). On ne refait jamais le compte.
- Seuls les PJ `kind === 'pj'`, `present && !horsJeu` sont suivis.
- Malus de palier : modifs `{ duree: { genre: 'retrait' } }`, `raison: 'SM — <nom du palier>'`, `id` préfixé `sm-palier-`. Le module ne touche **jamais** une modif dont l'`id` ne commence pas par `sm-`.
- Les hallucinations ne partent jamais sans un clic du meneur.
- Toute écriture sur une fiche passe par `window.jdr.characters.adjust(id, key, delta, raison)` ou `setModifs`.
- Les valeurs par défaut sont **exactement** celles de l'annexe du spec (« Annexe — valeurs par défaut »).

## Review Focus

- Jauge SM absente de la fiche (`jaugeSanite` rend `undefined`) alors que le module est actif → la vue l'explique et propose d'ouvrir Paramètres, sans planter.
- Perte qui dépasse la SM restante, ou gain au-dessus du max → la jauge reste dans `[0, max]`, et le palier se calcule sur la valeur bornée.
- Le même joueur attendu par deux déclarations à la fois → ses jets servent dans l'ordre ; un jet d'une autre carac (FOR) n'est jamais consommé.
- Un joueur qui remonte de palier (pilule) → les malus `sm-palier-*` de l'ancien palier sont retirés, ceux posés à la main restent.
- Paliers mal réglés (trous ou chevauchements entre bornes) → `palierDe` rend toujours un palier : le premier dont `min ≤ sm`, en lisant du plus haut au plus bas.

---

### Task 1: La règle, en fonctions pures

**Files:**
- Create: `src/shared/santeMentale.ts`
- Test: `src/shared/santeMentale.test.ts`

**Interfaces:**
- Produces:
```ts
export interface Choc { id: string; nom: string; perte: number }
export interface Palier {
  id: string; nom: string; min: number            // borne basse incluse ; le palier va jusqu'au min du palier au-dessus − 1
  couleur: 'moss' | 'brass' | 'iris' | 'blood'
  texte: string
  malus: { valeur: number; caracKey: string | null }[]   // null : tous les jets
  hallucinations: number | null                   // cadence en minutes ; null : aucune
}
export interface Prix { id: string; nom: string; perte: number; tous: boolean; intervalleMin: number | null } // null : fixe
export interface Recup { id: string; nom: string; gain: number | string /* 5 ou '1d10' */; limite: 'scene' | 'nuit' | null; pilule: boolean; calme: boolean }
export interface ReglageSm {
  actif: boolean
  carac: string; seuil: number
  gain20: number; partReussite: 'moitie' | 'tout' | 'rien'; surcout1: number
  chocs: Choc[]; paliers: Palier[]   // triés du plus haut min au plus bas
  folie: { seuil: number; minutes: number; table: string[] }  // 6 lignes
  hallucinations: string[]
  prix: Prix[]; recups: Recup[]
  jaugePilules: string | null; nausee: { fenetreMin: number; malus: number; dureeMin: number }
  activite: { min: number; texte: string }[]
  rappels: string[]                  // « Toute l'équipe dans la même pièce éclairée… », modificateurs de situation
}
export interface EvenementSm { id: number; sessionId: number; ord: number; nom: string; note: string | null; perte: number; jet: boolean; tous: boolean }
export const SM_DEFAUT: ReglageSm
export const EVENEMENTS_DEFAUT: Omit<EvenementSm, 'id' | 'sessionId' | 'ord'>[]  // barème de Harrow Mill
export function lireSm(json: string | undefined): ReglageSm
export function perteApresJet(perte: number, de: number, total: number, r: ReglageSm): number  // < 0 = gain
export function palierDe(sm: number, paliers: Palier[]): Palier
export function modifsDuPalier(modifs: Modif[] | undefined, palier: Palier): Modif[]
export function estFolie(perteReelle: number, r: ReglageSm): boolean
export function cibleDesEntites(joueurs: { id: number; sm: number }[]): number | null
export function activiteDe(moyenne: number, r: ReglageSm): string | null
export function tirerGain(gain: number | string, d: (faces: number) => number): number
```

- [ ] **Step 1: Write the failing tests** in `src/shared/santeMentale.test.ts`:

```ts
const r = SM_DEFAUT
it('le jet de Volonté décide de la perte', () => {
  expect(perteApresJet(5, 20, 25, r)).toBe(-2)   // 20 naturel : +2
  expect(perteApresJet(5, 14, 12, r)).toBe(3)    // réussite : moitié arrondie au-dessus
  expect(perteApresJet(10, 14, 12, r)).toBe(5)
  expect(perteApresJet(5, 9, 11, r)).toBe(5)     // échec : tout
  expect(perteApresJet(5, 1, 4, r)).toBe(10)     // 1 naturel : tout +5
})
it('trouve le palier, même mal réglé', () => {
  expect(palierDe(100, r.paliers).nom).toBe('Stable')
  expect(palierDe(76, r.paliers).nom).toBe('Stable')
  expect(palierDe(75, r.paliers).nom).toBe('Ébranlé')
  expect(palierDe(26, r.paliers).nom).toBe('Hallucinations')
  expect(palierDe(1, r.paliers).nom).toBe('Terreur')
  expect(palierDe(0, r.paliers).nom).toBe('Rupture')
  expect(palierDe(-4, r.paliers).nom).toBe('Rupture')
  expect(palierDe(50, [{ ...r.paliers[0], min: 60 }]).nom).toBe('Stable') // aucun min ≤ sm : le plus bas
})
it('remplace les malus du palier sans toucher aux autres', () => {
  const main = { id: 'x', valeur: 2, raison: 'Béni', caracKey: null, duree: { genre: 'retrait' } } as Modif
  const halluc = palierDe(40, r.paliers)
  const apres = modifsDuPalier([main], halluc)
  expect(apres).toContainEqual(main)
  expect(apres.filter((m) => m.id.startsWith('sm-palier-'))).toEqual([
    expect.objectContaining({ valeur: -2, caracKey: 'per', raison: 'SM — Hallucinations', duree: { genre: 'retrait' } })
  ])
  expect(modifsDuPalier(apres, palierDe(90, r.paliers))).toEqual([main])
  expect(modifsDuPalier(apres, halluc)).toEqual(apres) // même palier : rien ne se cumule
})
it('folie, cible, activité, gains', () => {
  expect(estFolie(10, r)).toBe(true); expect(estFolie(9, r)).toBe(false)
  expect(cibleDesEntites([{ id: 1, sm: 40 }, { id: 2, sm: 31 }])).toBe(2)
  expect(cibleDesEntites([])).toBeNull()
  expect(activiteDe(54, r)).toMatch(/petit phénomène/)
  expect(activiteDe(70, r)).toMatch(/Seulement les déclencheurs/)
  expect(tirerGain('1d10', () => 7)).toBe(7); expect(tirerGain(5, () => 1)).toBe(5)
})
it('relit un réglage abîmé sans planter', () => {
  expect(lireSm(undefined)).toEqual(SM_DEFAUT)
  expect(lireSm('pas du json')).toEqual(SM_DEFAUT)
  expect(lireSm(JSON.stringify({ actif: true, seuil: 15 }))).toMatchObject({ actif: true, seuil: 15, chocs: SM_DEFAUT.chocs })
})
it('les défauts sont ceux de l’annexe', () => {
  expect(r.actif).toBe(false)
  expect(r.chocs.map((c) => c.perte)).toEqual([3, 5, 10, 15])
  expect(r.paliers.map((p) => [p.nom, p.min])).toEqual([['Stable', 76], ['Ébranlé', 51], ['Hallucinations', 26], ['Terreur', 1], ['Rupture', 0]])
  expect(r.folie.table).toHaveLength(6)
  expect(r.hallucinations).toHaveLength(8)
  expect(EVENEMENTS_DEFAUT).toHaveLength(15)
})
```

- [ ] **Step 2: Run** `npx vitest run src/shared/santeMentale.test.ts`. Expected: FAIL (module introuvable).

- [ ] **Step 3: Implement** `src/shared/santeMentale.ts`. `lireSm` fusionne champ par champ avec `SM_DEFAUT`, les tableaux absents ou mal formés reprennent le défaut, et les paliers sont retriés par `min` décroissant. `palierDe` rend le premier palier (min décroissant) avec `min ≤ sm`, sinon le dernier. `modifsDuPalier` filtre `id.startsWith('sm-palier-')` puis ajoute `sm-palier-<palier.id>-<i>`. Si les malus `sm-palier-<palier.id>-*` sont déjà présents, il rend les modifs inchangées. Recopier les valeurs et les textes de l'annexe du spec dans `SM_DEFAUT`, `EVENEMENTS_DEFAUT` (qui inclut `tous`) et `activite`. Carac des malus : `dex`, `per`, `null`.

- [ ] **Step 4: Run** `npx vitest run src/shared/santeMentale.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit** `git commit -m "Santé mentale : la règle, en fonctions pures"`

### Task 2: Réglage de campagne et rubrique « Santé mentale »

**Files:**
- Modify: `src/shared/reglages.ts` (ajouter `sm: ReglageSm` à `ReglagesCampagne`, `CAMPAGNE_DEFAUT.sm = SM_DEFAUT`, `lireCampagne` → `sm: lireSm(b['sm'])`)
- Modify: `src/renderer/src/mj/components/parametres/registre.tsx` (type `Rubrique` + `'sante'`, entrée `RUBRIQUES` après `regles`, `...sante.reglages`)
- Create: `src/renderer/src/mj/components/parametres/rubriques/sante.tsx`
- Modify: `src/renderer/src/styles/app.css`

**Interfaces:**
- Consumes: `ReglageSm`, `SM_DEFAUT`, `lireSm` (Task 1) ; `useStore().poserReglage(cle, valeur)` ; `useFiche` (à exporter depuis `rubriques/regles.tsx`) ; `jaugeSanite`.
- Produces: `useStore().reglages.sm: ReglageSm` ; `poserSm(patch: Partial<ReglageSm>): Promise<void>`, exportée de `rubriques/sante.tsx` (`poserReglage('sm', JSON.stringify({ ...sm, ...patch }))`).

- [ ] **Step 1: Write the failing test** dans `src/shared/santeMentale.test.ts` : `expect(lireCampagne({}).sm).toEqual(SM_DEFAUT)` et `expect(lireCampagne({ sm: JSON.stringify({ actif: true }) }).sm.actif).toBe(true)`.
- [ ] **Step 2: Run** `npx vitest run src/shared`. Expected: FAIL.
- [ ] **Step 3: Implement** le champ `sm` dans `reglages.ts`.
- [ ] **Step 4: Run** `npx vitest run src/shared`. Expected: PASS.
- [ ] **Step 5: Implement la rubrique.** Info : `{ id: 'sante', nom: 'Santé mentale', icone: <IconEye />, quoi: 'L’assistance du Paravent pour la santé mentale : le jet, les paliers et ce qu’ils changent, la folie, les hallucinations, les pertes et les remèdes.' }`. Réglages (`rubrique: 'sante'`, avec des `mots` pour la recherche, comme dans `regles.tsx`) :
  - `sm.actif` (case à cocher) : si `reglages.sm` n'a jamais été posé (`reglagesBrut.sm` absent), cocher écrit `{ ...SM_DEFAUT, actif: true }` puis sème les événements (Task 3, `sm.semer`) ;
  - `fiche.sanite` : ne pas le dupliquer, mais rendre le même composant que dans `regles.tsx` (l'exporter), pour qu'il n'y ait qu'une source ;
  - `sm.jet` : carac (select parmi `spec.stats`), seuil, gain sur 20, part en cas de réussite, surcoût sur 1 ;
  - `sm.chocs`, `sm.paliers`, `sm.folie`, `sm.hallucinations`, `sm.prix`, `sm.recups`, `sm.activite`, `sm.rappels` : éditeurs de liste `pleine: true` (ajouter, retirer, monter/descendre, éditer en place, enregistrement au blur) ;
  - `sm.pilules` : jauge des pilules (select de `spec.gauges` + « aucune ») et règle de nausée ;
  - `sm.evenements` : ligne pleine, voir Task 3 ;
  - `sm.retablir` : bouton « Rétablir les valeurs de l'annexe », qui passe par `Confirmer` (de `../../Rangement`) et écrit `{ ...SM_DEFAUT, actif: sm.actif }`.
  Tant que `sm.actif` est faux, seule la ligne `sm.actif` est montrée.
- [ ] **Step 6: Verify** `npm run typecheck`. Expected: aucune erreur. Puis `npm run dev` : Paramètres › Santé mentale. Cocher remplit tout avec les valeurs de l'annexe, une retouche survit à la fermeture des Paramètres, et « Rétablir » remet l'annexe.
- [ ] **Step 7: Commit** `git commit -m "Santé mentale : la rubrique des Paramètres"`

### Task 3: Les événements par séance

**Files:**
- Modify: `src/main/db/schema.ts` (migration `id: 88`)
- Create: `src/main/db/repos/smEvenements.ts`
- Modify: `src/main/ipc/index.ts`, `src/preload/index.ts`
- Modify: `src/renderer/src/mj/components/parametres/rubriques/sante.tsx` (ligne `sm.evenements`)

**Interfaces:**
- Consumes: `EvenementSm`, `EVENEMENTS_DEFAUT` (Task 1) ; `activeCampaignId`, `activeSessionId`, `getDb`.
- Produces : la table, et `window.jdr.sm` :
```ts
sm: {
  evenements: (sessionId: number) => Promise<EvenementSm[]>
  ecrire: (e: Omit<EvenementSm, 'id' | 'ord'> & { id?: number }) => Promise<EvenementSm[]>  // rend la liste de sa séance
  effacer: (id: number) => Promise<EvenementSm[]>
  ranger: (sessionId: number, ids: number[]) => Promise<EvenementSm[]>
  dupliquer: (id: number, versSessionId: number) => Promise<void>   // ajouté en fin de liste
  semer: () => Promise<void>  // EVENEMENTS_DEFAUT sous la séance active, seulement si la campagne n'a aucun événement
  onJet: (cb: (j: JetSm) => void) => () => void   // Task 4
}
```

```sql
CREATE TABLE sm_evenement (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL REFERENCES campaign(id) ON DELETE CASCADE,
  session_id  INTEGER NOT NULL REFERENCES game_session(id) ON DELETE CASCADE,
  ord         INTEGER NOT NULL DEFAULT 0,
  nom         TEXT NOT NULL,
  note        TEXT,
  perte       INTEGER NOT NULL,
  jet         INTEGER NOT NULL DEFAULT 1,
  tous        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_sm_evenement ON sm_evenement(session_id, ord);
```

- [ ] **Step 1: Implement** la migration 88, avec un commentaire dans le style des voisines, puis le repo (`list`, `ecrire`, `effacer`, `ranger` en transaction comme `reorderAnnexes`, `dupliquer`, `semer`), l'IPC `sm:*` et le preload.
- [ ] **Step 2: Implement** la ligne `sm.evenements` : un select de séance (`useStore().sessions`, la séance active par défaut), la liste éditable (nom, note, perte, avec jet, tous), et sur chaque ligne « Dupliquer vers une séance… » (menu des autres séances).
- [ ] **Step 3: Verify** `npm run typecheck`, puis `npm run dev` sur la campagne « Chasse aux fantômes ». À l'activation, les 15 événements de Harrow Mill sont sous « Séance 4 - La scierie ». Un événement dupliqué vers « Séance 3 » y apparaît. Ctrl+Z (défaire) annule un effacement.
- [ ] **Step 4: Commit** `git commit -m "Santé mentale : les événements, séance par séance"`

### Task 4: Le jet arrive au MJ

**Files:**
- Modify: `src/main/jetDuPerso.ts` (`noterJet`), `src/shared/types.ts`, `src/preload/index.ts`

**Interfaces:**
- Produces: `export interface JetSm { characterId: number; caracKey: string; die: number; total: number }` dans `shared/types.ts` ; l'évènement `'sm:jet'` envoyé par `noterJet` via `display.versMj` après `recordRoll` ; `window.jdr.sm.onJet`.

- [ ] **Step 1: Implement.** Le téléphone (`mobile.ts › roll`) et la saisie du MJ (`rolls:record`) passent tous les deux par `noterJet`. Un seul point d'émission suffit donc.
- [ ] **Step 2: Verify** `npm run typecheck`. Puis, en dev, un jet VLT depuis un téléphone et un jet VLT saisi au MJ arrivent tous les deux dans `window.jdr.sm.onJet` (journal temporaire, à retirer).
- [ ] **Step 3: Commit** `git commit -m "Santé mentale : le jet de Volonté prévient le MJ"`

### Task 5: L'état de jeu (`useSm`)

**Files:**
- Create: `src/renderer/src/mj/santeMentale/etat.ts`
- Create: `src/renderer/src/mj/santeMentale/etat.test.ts`

**Interfaces:**
- Consumes: Task 1 (toute la règle), Task 4 (`JetSm`) ; `useStore` (`characters`, `players`, `sheet`, `reglages.sm`, `refreshCharacters`).
- Produces:
```ts
type Cible = number[]  // ids de personnages ; vide = tous les présents
interface Attente { id: string; titre: string; perte: number; raison: 'choc' | 'folie'; joueurs: { characterId: number; resultat: { total: number; perte: number } | null }[] }
type Alerte =
  | { id: string; genre: 'palier'; characterId: number; palier: Palier; sm: number; montee: boolean }
  | { id: string; genre: 'folie'; characterId: number; effet: string; finA: number }
  | { id: string; genre: 'hallucination'; characterId: number; texte: string }
  | { id: string; genre: 'nausee'; characterId: number }
interface EtatSm {
  attentes: Attente[]; alertes: Alerte[]
  chronos: Record<number, { prixId: string; prochainA: number }[]>   // par personnage
  halluA: Record<number, number>          // prochaine hallucination (ms epoch)
  folies: Record<number, { effet: string; finA: number }>
  pilules: Record<number, number[]>       // horodatages
  recupsFaites: Record<string, number[]>  // `${recupId}` → ids de personnages (scène / nuit)
  declarerChoc(titre: string, perte: number, cible: Cible): void
  declarerPrix(p: Prix | EvenementSm, cible: Cible): Promise<void>   // un événement sans jet passe par ici
  recevoirJet(j: JetSm): Promise<void>
  saisirJet(attenteId: string, characterId: number, die: number): Promise<void>  // via rolls.record avec caracKey
  annulerAttente(id: string): void
  appliquer(characterId: number, delta: number, raison: string): Promise<void>     // LE seul chemin d'écriture SM
  recuperer(r: Recup, cible: Cible): Promise<void>
  arreterChrono(characterId: number, prixId: string): void
  calmer(characterId: number): void
  tick(maintenant: number): Promise<void>   // chronos, hallucinations dues, folies finies
  envoyerHallucination(alerteId: string): Promise<void>
  autreHallucination(alerteId: string): void
  fermerAlerte(id: string): void
}
export const useSm: UseBoundStore<StoreApi<EtatSm>>
```

Ordre dans `appliquer` : lire la jauge SM (`jaugeSanite`) → `characters.adjust(id, key, delta, raison)` (le main borne la valeur) → relire la valeur → `palierDe` avant/après → si le palier change : `setModifs(modifsDuPalier(...))`, alerte `palier`, armer ou désarmer `halluA` selon `palier.hallucinations`. Si `delta < 0 && estFolie(-delta)`, ouvrir une `Attente` `raison: 'folie'`. Dans `recevoirJet`, on ignore un jet dont `caracKey !== sm.carac` et on sert la plus ancienne attente non résolue de ce personnage. Pour une attente `'folie'` ratée (`total < seuil`), on tire `table[d6 - 1]` → alerte `folie` et `folies[id]`, sans écrire de SM. `envoyerHallucination` passe par `mots.ecrire([playerId], texte, null, true, true)` avec le joueur de `players.find(p => p.characterId === id)`. Sans joueur, l'alerte affiche « Fait » au lieu d'« Envoyer ». La nausée vient de `recuperer` sur une `pilule: true` prise moins de `nausee.fenetreMin` après la précédente : modif `sm-nausee` de `nausee.malus` sur tous les jets, retirée par `tick` après `dureeMin`. La jauge pilules (si réglée) est décrémentée de 1 et la pilule est refusée à 0.

- [ ] **Step 1: Write the failing tests** dans `etat.test.ts`, avec `window.jdr` simulé (`vi.stubGlobal`) dont `characters.adjust` met à jour un personnage en mémoire et `useStore.setState` porte deux PJ (SM 80 et 52, VLT key `vlt`) :
  - `déclarer un choc moyen sur Léa puis recevoir {die:14,total:12}` → `adjust(léa, 'sm', -3, …)`, et l'attente est fermée ;
  - `un jet FOR n'est pas consommé`, et l'attente reste ouverte ;
  - `deux attentes sur Léa : deux jets servent dans l'ordre` ;
  - `perte faisant passer Tom (52) sous 51` → alerte `palier` Ébranlé et `setModifs` appelé avec une modif `sm-palier-*` −1 `dex` ;
  - `perte réelle de 10` → une attente `folie` s'ouvre, et sur un jet raté avec d6 simulé à 3 l'alerte `folie` contient « Il hurle » ;
  - `tick` après échéance d'un chrono « −2 / min » → `adjust(…, -2, …)`, et `arreterChrono` l'arrête ;
  - `deux pilules en 10 min` → alerte `nausee` et modif `sm-nausee` −2 `caracKey: null`.
- [ ] **Step 2: Run** `npx vitest run src/renderer/src/mj/santeMentale`. Expected: FAIL.
- [ ] **Step 3: Implement** `etat.ts`. Le hasard passe par une fonction `de(faces)` du module, remplaçable dans les tests. Un `setInterval(tick, 1000)` et l'abonnement `window.jdr.sm.onJet` sont posés une seule fois par `demarrerSm()`, appelé depuis le montage du MJ (`mj/App.tsx`).
- [ ] **Step 4: Run** `npx vitest run`. Expected: PASS, tous les tests.
- [ ] **Step 5: Commit** `git commit -m "Santé mentale : l'état de la partie"`

### Task 6: La vue SM dans le Paravent

**Files:**
- Create: `src/renderer/src/mj/santeMentale/VueSm.tsx` (vue entière), `src/renderer/src/mj/santeMentale/Bareme.tsx` (colonne gauche), `src/renderer/src/mj/santeMentale/Joueurs.tsx` (lignes, bandeaux, alertes)
- Modify: `src/renderer/src/mj/modules/Pupitre.tsx` (autour de `:159` et `:1890-1904`), `src/renderer/src/mj/App.tsx` (`demarrerSm()`)
- Modify: `src/renderer/src/styles/app.css` (classes `.sm-*`, jetons de `tokens.css`)

**Interfaces:**
- Consumes: `useSm` (Task 5), `window.jdr.sm.evenements(activeSessionId)` (Task 3), `reglages.sm`, `palierDe`, `cibleDesEntites`, `activiteDe`.

- [ ] **Step 1: Implement** dans `Pupitre.tsx` : un état `vueSm` (`useRetenu`, comme `choisi`). Un bouton « Gérer les SM » (`btn btn-sm`, affiché seulement si `reglages.sm.actif`), placé à droite de la réserve des pions, ouvre la vue SM et fait `setChoisi(null)`. Tout `setChoisi(non-null)` fait `setVueSm(false)`. Dans `.pu-detail`, rendre `<VueSm />` quand `vueSm`.
- [ ] **Step 2: Implement** `VueSm` selon la maquette v2 et la section « La vue SM » du spec :
  - **Gauche** : Choc (grille 2×2), Événements de la séance (6 visibles puis « N autres… » qui déplie), Prix (« −2 / min » pour un prix dans la durée), Récupérer. Les entrées utilisées « une fois » sont grisées.
  - **Droite** : rappels (`sm.rappels`), bandeaux d'attente (jetons « Tom · 14 → −3 ✓ », « Saisir à la main », qui ouvre un petit champ dé 1-20), alertes, puis les lignes joueurs : case, 🎯, nom, jauge, pastille « valeur · palier » à la couleur du palier, et sous la ligne les effets en cours (malus du palier, « hallucination dans N min », chrono avec ✕, folie avec « Calmé »).
  - **Pied** : « Moyenne N — <activité> ».
  Les cases cochées vivent dans la vue et se vident après chaque déclaration. Si la jauge SM manque (`jaugeSanite` vide), la vue affiche « Aucune jauge de santé mentale sur la fiche » et un bouton qui ouvre Paramètres › Santé mentale.
- [ ] **Step 3: Verify** `npm run typecheck && npx vitest run`. Puis `npm run dev` sur « Chasse aux fantômes », Paravent, et dérouler à la main le scénario suivant, en notant chaque écart :
  1. « Gérer les SM » remplace le détail du pion, et un clic sur un pion le ramène.
  2. Cocher deux joueurs, puis « Moyen −5 ». Le bandeau attend les deux. Un jet VLT depuis un téléphone et un « Saisir à la main » résolvent chacun leur joueur, et les jauges baissent.
  3. Faire passer un joueur sous 51. L'alerte apparaît, et sa fiche (détail du pion) montre « SM — Ébranlé −1 DEX ».
  4. « Seul dans le noir » sur un joueur : la jauge baisse de 2 chaque minute jusqu'au ✕.
  5. Pilule : +1D10, et une seconde pilule déclenche la nausée.
  6. Un joueur en Hallucinations : « Envoyer une hallucination » fait arriver le mot sur le téléphone.
  7. La scène et la réserve ne bougent pas, et la vue défile en elle-même.
- [ ] **Step 4: Commit** `git commit -m "Santé mentale : la vue SM du Paravent"`

### Task 7: Rapport de version

**Files:**
- Modify: `package.json` (version `1.5.0`), `RELEASE_NOTES.md`

- [ ] **Step 1:** Réécrire `RELEASE_NOTES.md` selon `CLAUDE.md` : `<!-- version: 1.5.0 -->`, puis `### Nouveautés` écrit pour le meneur. Couvrir `git log v1.4.1..HEAD`. Titre suggéré : « 1.5.0 — La santé mentale ».
- [ ] **Step 2:** **Faire valider le texte par l'utilisateur** avant tout commit ou publication.
- [ ] **Step 3: Commit** `git commit -m "Écran du Maître 1.5.0"`. Ne pas lancer `npm run publier` sans demande explicite.
