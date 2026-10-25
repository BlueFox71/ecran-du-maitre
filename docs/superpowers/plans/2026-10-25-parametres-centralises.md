# Paramètres centralisés, avec recherche — plan de réalisation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une seule fenêtre Paramètres, avec une barre de recherche qui trouve (par mots proches) et laisse modifier sur place n'importe quel réglage de l'outil.

**Architecture:** Chaque réglage est déclaré une fois dans un **registre** (rubrique, libellé, aide, mots proches, composant de commande). Les rubriques et les résultats de recherche se rendent tous deux depuis ce registre, si bien qu'une ligne trouvée est la vraie ligne. La recherche est une fonction pure (`chercher`), testée. Les commandes rapides restent en place et lisent la même source (store Zustand, `s.display`, `useSons`), ce qui les synchronise déjà.

**Tech Stack:** Electron 33, React 18, TypeScript 5, Zustand, electron-vite. Tests : **vitest** (ajouté par ce plan, uniquement pour les fonctions pures).

**Spec:** `docs/superpowers/specs/2026-10-25-parametres-centralises-design.md`

## Global Constraints

- Aucun changement de stockage : clés `setting` / `app_setting` et bornes de `src/shared/reglages.ts` inchangées.
- Enregistrement immédiat dans Paramètres (au blur / au relâchement, via `s.poserReglage` / `s.poserPoste`), **sauf** le bloc Monnaies (brouillon + « Appliquer »).
- Les effets de bord de `src/main/ipc/index.ts:194-210` ne doivent pas être court-circuités : toujours écrire par `poserReglage` / `poserPoste`.
- Les réglages « en direct » (`window.jdr.display.*`, `window.jdr.regieSon.regler`) restent non persistés.
- Commandes rapides (Affichage ▾, barre Régie, console du direct, Bibliothèque, Éditeur, panneau Sons, bouton « Ça commence bientôt ») : inchangées à l'écran.
- Vocabulaire et ton de l'existant ; briques `Tete` / `Ligne` / `Bloc` / `Seg` / `Curseur` ; commentaires en français, au style du fichier.
- `npm run typecheck` passe à la fin de chaque tâche.
- L'arbre de travail contient des modifications non commitées sans rapport (voir `git status`) : chaque commit n'ajoute **que** les fichiers/hunks de sa tâche (`git add -p` si un fichier était déjà modifié).

## Review Focus

1. **Échap avec recherche remplie** : vide d'abord la recherche, ne ferme pas la fenêtre ; un 2ᵉ Échap ferme. → test manuel Task 3.
2. **Paramètres ouvert sans campagne** (accueil) : les réglages de campagne ne plantent pas (`s.sheet`, `s.campaign` nuls) et affichent la phrase d'attente ; la recherche les montre quand même. → Task 3, étape manuelle.
3. **Fiche de campagne ouverte, règle changée dans Paramètres, puis « Appliquer » dans l'éditeur** : la règle de Paramètres survit. → test `fusionnerRegles` Task 4.
4. **Monnaie ajoutée dans Paramètres puis fenêtre fermée sans « Appliquer »** : rien n'est écrit, aucune monnaie figée. → Task 4, étape manuelle.
5. **Changer un réglage « en direct » dans Paramètres pendant que l'Affichage ▾ est ouvert** (ou l'inverse) : les deux montrent la même valeur. → Task 6, étape manuelle.

---

### Task 1: La recherche, fonction pure

**Files:**
- Modify: `package.json` (devDependency `vitest@^2.1.9`, script `"test": "vitest run"`)
- Create: `src/renderer/src/mj/components/parametres/chercher.ts`
- Test: `src/renderer/src/mj/components/parametres/chercher.test.ts`

**Interfaces:**
- Produces:
  - `export interface Cherchable { nom: string; aide?: string; mots: string[]; chemin: string }`
  - `export function normaliser(t: string): string[]` — minuscules, sans accents (NFD), coupé sur tout ce qui n'est pas lettre/chiffre (dont `’` et `'`), mots vides retirés.
  - `export function chercher<T extends Cherchable>(liste: T[], q: string): T[]`

- [ ] **Step 1: Install vitest** — `npm i -D vitest@^2.1.9`, ajouter le script `test`. Expected : `npx vitest --version` affiche 2.x.

- [ ] **Step 2: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { chercher, normaliser } from './chercher'

const sac = { nom: 'Capacité du sac', aide: 'Les places de chaque personnage', mots: ['inventaire', 'encombrement', 'charge', 'porter', 'emplacements'], chemin: 'La campagne › Règles du jeu' }
const bascule = { nom: 'Manière de basculer, par défaut', mots: ['transition', 'fondu', 'volet'], chemin: 'La campagne › Écran des joueurs' }
const theme = { nom: 'Thème', mots: ['sombre', 'clair', 'couleurs'], chemin: 'Le poste › Le poste' }
const ambiance = { nom: 'Volume de l’ambiance', mots: ['musique', 'son'], chemin: 'La campagne › Écran des joueurs' }
const sons = { nom: 'Volume général des sons', mots: ['bruitages'], chemin: 'La campagne › Sons' }
const tous = [sac, bascule, theme, ambiance, sons]

describe('normaliser', () => {
  it('ôte accents, casse et apostrophes', () => {
    expect(normaliser('Volume de l’Ambiance')).toEqual(['volume', 'de', 'l', 'ambiance'])
    expect(normaliser('THÈME')).toEqual(['theme'])
  })
})

describe('chercher', () => {
  it('trouve par un mot proche', () => expect(chercher(tous, 'porter')).toEqual([sac]))
  it('trouve par l’aide', () => expect(chercher(tous, 'places')).toEqual([sac]))
  it('accepte un début de mot', () => expect(chercher(tous, 'transi')).toEqual([bascule]))
  it('ignore accents et casse', () => expect(chercher(tous, 'theme')).toEqual([theme]))
  it('tous les mots doivent trouver', () => {
    expect(chercher(tous, 'sac capa')).toEqual([sac])
    expect(chercher(tous, 'sac theme')).toEqual([])
  })
  it('« volume » trouve les deux volumes', () => expect(chercher(tous, 'volume')).toEqual([ambiance, sons]))
  it('le nom passe avant les mots proches', () => {
    const a = { nom: 'Fondu', mots: [], chemin: 'x' }
    expect(chercher([bascule, a], 'fondu')).toEqual([a, bascule])
  })
  it('rien pour une recherche vide ou inconnue', () => {
    expect(chercher(tous, '   ')).toEqual([])
    expect(chercher(tous, 'xyz')).toEqual([])
  })
})
```

- [ ] **Step 3: Run** `npm test` — Expected: FAIL (module introuvable).

- [ ] **Step 4: Implement `normaliser` and `chercher`.** Chaque mot de la requête doit être le début d'un mot de `nom + aide + mots + chemin`. Rang : 0 si tous trouvés dans `nom`, 1 si dans `nom + mots`, 2 sinon ; tri stable par rang (l'ordre du registre départage).

- [ ] **Step 5: Run** `npm test` — Expected: PASS ; `npm run typecheck` — PASS.

- [ ] **Step 6: Commit** `git add package.json package-lock.json src/renderer/src/mj/components/parametres/chercher*.ts && git commit -m "Paramètres : la recherche, fonction pure et testée"`

---

### Task 2: Découper Paramètres et le rendre depuis un registre (sans changement visible)

Pure restructuration : à la fin, la fenêtre montre les mêmes lignes qu'avant, sauf que « Table et règles » devient deux rubriques, **La campagne** (Nom, Système, Dossier) et **Règles du jeu** (le reste).

**Files:**
- Move: `src/renderer/src/mj/components/Parametres.tsx` → `src/renderer/src/mj/components/parametres/Parametres.tsx` (le cadre : en-tête, navigation, panneau, pied)
- Create: `parametres/briques.tsx` (`Tete`, `Ligne`, `Bloc`, `Seg`, `Curseur`, `Onglet`, déplacés tels quels ; `Ligne` gagne `id?: string` rendu en `data-reglage`)
- Create: `parametres/registre.tsx` (types + `RUBRIQUES` + `REGLAGES`, assemblés depuis les fichiers de rubriques)
- Create: un fichier par rubrique dans `parametres/rubriques/` : `campagne.tsx`, `regles.tsx`, `ecran.tsx`, `murs.tsx`, `biblio.tsx`, `mj.tsx`, `portables.tsx`, `poste.tsx`, `touches.tsx`. Chacun exporte `export const reglages: Reglage[]`.
- Modify: `src/renderer/src/mj/App.tsx:9`, `components/Menubar.tsx:20-28` (le type `Rubrique` déménage dans `registre.tsx` ; Menubar le ré-importe), `components/Attente.tsx:151`, `components/Portables.tsx:57` (inchangés hors import si besoin).

**Interfaces:**
- Consumes: `Cherchable` (Task 1).
- Produces (dans `registre.tsx`) :

```ts
export type Rubrique =
  | 'campagne' | 'regles' | 'ecran' | 'attente' | 'murs' | 'sons'
  | 'mj' | 'portables' | 'poste' | 'biblio' | 'touches'

export interface InfoRubrique {
  id: Rubrique
  nom: string
  icone: JSX.Element
  /** Suit le poste plutôt que la campagne. */
  poste?: boolean
  /** La phrase de `Tete`. */
  quoi: string
}

export interface Reglage {
  /** La clé du réglage quand il en a une (`sac.capacite`), sinon un nom stable. */
  id: string
  rubrique: Rubrique
  nom: string
  aide?: string
  /** Mots proches, pour la recherche : jamais vide pour un vrai réglage. */
  mots: string[]
  pleine?: boolean
  /** « En direct » : tenu en mémoire, perdu au redémarrage. */
  direct?: boolean
  /** Les commandes de la ligne (ou le bloc entier si `pleine`). */
  Cmd: () => JSX.Element
}

export const RUBRIQUES: InfoRubrique[]
export const REGLAGES: Reglage[]
/** Pour `chercher` : le chemin « La campagne › Règles du jeu ». */
export function cheminDe(r: Reglage): string
```

- Produces (dans `Parametres.tsx`) : `export function Parametres({ depart, cible, onClose }: { depart?: Rubrique; cible?: string; onClose: () => void })`. `cible` = id d'un réglage : la fenêtre ouvre sa rubrique, le fait défiler en vue (`[data-reglage="…"]`) et le surligne brièvement (classe `pm-cible`, 1,5 s).
- Produces (dans `registre.tsx`) : `export function ouvrirParametres(rubrique?: Rubrique, cible?: string): void` — `window.dispatchEvent(new CustomEvent('jdr:parametres', { detail: { rubrique, cible } }))`. `App.tsx:72` accepte `detail` chaîne (ancien) **ou** objet.

Les rubriques « attente » et « sons » existent dans le type mais n'ont pas encore de lignes (masquées dans la navigation tant que vides). Le `Rubrique` `'table'` disparaît : vérifier par `grep -rn "'table'" src/renderer/src/mj` qu'aucun appelant ne l'utilise.

Chaque ligne existante reçoit ses `mots` (2 à 6, à la main). Minimum imposé : `sac.capacite` → `['inventaire','encombrement','charge','places','porter','emplacements']` ; `bascule.mode` → `['transition','fondu','volet','noir']` ; `theme` → `['sombre','clair','couleurs','nuit']`.

- [ ] **Step 1:** Créer `briques.tsx` et déplacer les briques. `npm run typecheck` — PASS.
- [ ] **Step 2:** Créer `registre.tsx` et les rubriques en convertissant chaque `Ligne` actuelle en une entrée `Reglage` (les blocs à plusieurs lignes, comme « Compétences », deviennent des entrées séparées ; les listes, comme les appareils appairés ou la table des raccourcis, des entrées `pleine`).
- [ ] **Step 3:** Le panneau rend `Tete` puis, pour chaque `Reglage` de la rubrique active, `<Ligne id nom aide pleine><Cmd /></Ligne>`. Ajouter `ouvrirParametres` et le paramètre `cible`.
- [ ] **Step 4:** Ajouter au fichier de test de Task 1 un test d'intégrité du registre :

```ts
import { REGLAGES, RUBRIQUES } from './registre'
it('chaque réglage a des mots proches et une rubrique connue', () => {
  const ids = new Set(RUBRIQUES.map((r) => r.id))
  for (const r of REGLAGES) {
    expect(ids.has(r.rubrique)).toBe(true)
    expect(r.mots.length).toBeGreaterThan(0)
  }
  expect(new Set(REGLAGES.map((r) => r.id)).size).toBe(REGLAGES.length)
})
```
  (si l'import de composants React pose problème à vitest, ajouter `vitest.config.ts` avec les alias `@shared`/`@renderer` de `electron.vite.config.ts` et `@vitejs/plugin-react`.)
- [ ] **Step 5:** `npm test` et `npm run typecheck` — PASS. `npm run dev` : chaque rubrique montre les mêmes réglages qu'avant ; Menubar « Réglages de l'écran… » ouvre Écran des joueurs, « Raccourcis de table… » ouvre Raccourcis.
- [ ] **Step 6: Commit** « Paramètres : un registre des réglages, une rubrique par fichier ».

---

### Task 3: La barre de recherche

**Files:**
- Modify: `parametres/Parametres.tsx`, `src/renderer/src/styles/app.css` (styles `pm-recherche`, `pm-resultats`, `pm-cible`)

**Interfaces:**
- Consumes: `chercher` (Task 1), `REGLAGES`, `cheminDe`, `RUBRIQUES` (Task 2).

Comportement :
- Champ en tête du corps, `autoFocus`, placeholder `Chercher un réglage…`.
- Requête non vide → la navigation de gauche est remplacée par la liste des résultats, groupés par rubrique dans l'ordre de `RUBRIQUES`. Chaque groupe a pour titre son chemin, qui est un bouton : il vide la recherche et ouvre la rubrique.
- Aucun résultat : `Rien pour « {q} ».`
- Échap : `useEchap(() => setQ(''), q !== '')` inscrit **après** `useEchap(onClose)` pour être au sommet.
- Sans campagne (`!s.campaign`) : pour un réglage d'une rubrique non-`poste`, `Cmd` n'est pas rendu ; à sa place `<span className="aide">Ouvre une campagne pour régler ceci.</span>`. Vaut aussi hors recherche.
- Le bandeau « Suit la campagne / Suit le poste » et le pied, pendant une recherche : le pied dit `Tout s’enregistre en sortant du champ.` ; le bandeau est masqué (chaque groupe dit son chemin).

- [ ] **Step 1:** Implémenter.
- [ ] **Step 2:** `npm run typecheck` — PASS.
- [ ] **Step 3 (manuel, `npm run dev`):** Ctrl+, puis taper `places` → « Capacité du sac » apparaît, le curseur fonctionne et la valeur reste après réouverture. `xyz` → message. Échap vide, Échap ferme (Review Focus 1). Depuis l'accueil, sans campagne, taper `sac` → la ligne apparaît avec la phrase d'attente, aucune erreur en console (Review Focus 2).
- [ ] **Step 4: Commit** « Paramètres : chercher un réglage ».

---

### Task 4: Règles du jeu — monnaies et règles sortent de la Fiche de campagne

**Files:**
- Create: `src/shared/regles.ts`, test `src/shared/regles.test.ts`
- Modify: `parametres/rubriques/regles.tsx` (bloc Monnaies), `src/renderer/src/mj/modules/FicheCampagne.tsx` (retraits + lien + fusion)

**Interfaces:**
- Produces:
  - `export function fusionnerRegles(brouillon: TemplateSpec, courant: TemplateSpec): TemplateSpec` — le brouillon, avec `rollSystem`, `sansCompetences`, `skillLimit`, `sanityGauge` repris de `courant` (une clé absente de `courant` est absente du résultat).
  - Dans `regles.tsx` : entrée `{ id: 'monnaies', pleine: true, mots: ['argent','bourse','pièces','or','prix','devise'] }` dont `Cmd` tient un brouillon `ReglageMonnaies` initialisé depuis `s.reglages.monnaies`, rend `<MonnaiesCampagne r posees onChange />` (`components/MonnaiesCampagne.tsx`, inchangé), un bouton « Appliquer les monnaies » actif seulement si le brouillon diffère, la confirmation « Passer la campagne sans monnaie ? » reprise de `FicheCampagne.tsx:692-700`, et une phrase : `Une monnaie appliquée est sur les fiches : elle ne se supprime plus.`

- [ ] **Step 1: Failing test**

```ts
import { expect, it } from 'vitest'
import { fusionnerRegles } from './regles'
import type { TemplateSpec } from './types'

const base: TemplateSpec = { rollSystem: 'd20-plus', gauges: [], stats: [], skills: [], skillLimit: null }
it('garde la composition du brouillon et les règles courantes', () => {
  const brouillon = { ...base, rollSystem: 'd100-under' as const, stats: [{ key: 'for', label: 'Force' }] as TemplateSpec['stats'], sansCompetences: true }
  const courant = { ...base, skillLimit: 4, sanityGauge: 'sm' }
  const r = fusionnerRegles(brouillon, courant)
  expect(r.stats).toEqual(brouillon.stats)
  expect(r.rollSystem).toBe('d20-plus')
  expect(r.skillLimit).toBe(4)
  expect(r.sanityGauge).toBe('sm')
  expect('sansCompetences' in r).toBe(false)
})
```
(adapter la forme d'une `StatSpec` aux champs obligatoires de `src/shared/types.ts`.)

- [ ] **Step 2:** `npm test` — FAIL. **Step 3:** implémenter. **Step 4:** `npm test` — PASS.
- [ ] **Step 5:** Bloc Monnaies dans `regles.tsx` ; la ligne « Monnaies » en lecture seule actuelle disparaît.
- [ ] **Step 6:** Dans `FicheCampagne.tsx` :
  - retirer l'onglet Monnaies (`:414`, `:438`), l'état `argent`/`argentPose`/`argentSale`/`masquer` et leur branche dans `appliquer` ; `modifie` = `sale` ;
  - retirer les commandes Système de jet (`:424`), « La table s'en sert » (`:451`), `Limite` (`:458`), choix de la santé mentale (`:464`) ; à leur place, une ligne `Règles du jeu dans les Paramètres →` qui appelle `fermer()` puis, si la fenêtre s'est bien fermée, `ouvrirParametres('regles')` (`fermer` doit donc rendre un booléen) ;
  - l'éditeur lit ces règles dans `s.sheet?.spec` (valeur courante) et non dans son brouillon : `:149` (`derive`) et `:457` (`!spec.sansCompetences`) ;
  - `appliquer` enregistre `fusionnerRegles(spec, s.sheet?.spec ?? spec)`.
- [ ] **Step 7:** Dans `regles.tsx`, le choix de la santé mentale ne propose que `s.sheet.spec.gauges`, avec l'aide `Une jauge ajoutée dans la fiche de campagne apparaît ici une fois appliquée.`
- [ ] **Step 8:** `npm test`, `npm run typecheck` — PASS. Manuel : ouvrir la Fiche de campagne, Ctrl+, changer la limite de compétences, fermer Paramètres, modifier une caractéristique, Appliquer → la limite est restée (Review Focus 3). Paramètres › Règles du jeu : ajouter une monnaie, fermer sans appliquer, rouvrir → elle n'est pas là, et on peut toujours partir d'un modèle (Review Focus 4).
- [ ] **Step 9: Commit** « Règles du jeu : les monnaies et les règles passent dans les Paramètres ».

---

### Task 5: La campagne — la fenêtre « La campagne » disparaît

**Files:**
- Modify: `components/Fiches.tsx` (supprimer `FicheCampagne` `:14-79` ; exporter `ListeJoueurs`), `parametres/rubriques/campagne.tsx`, `App.tsx:162-169`, `components/Menubar.tsx:110,128`

**Interfaces:**
- Consumes: `ouvrirParametres` (Task 2).
- Produces: `export function ListeJoueurs({ onCarnet }: { onCarnet: () => void })` exporté de `Fiches.tsx` (corps inchangé).

- [ ] **Step 1:** Entrée `{ id: 'joueurs', rubrique: 'campagne', nom: 'Joueurs de la campagne', pleine: true, mots: ['joueurs','couleur','personnage','inscrire','table'] }` qui rend `<ListeJoueurs onCarnet={...} />`. Le carnet s'ouvre par-dessus : Paramètres tient un état local `carnet` et rend `<Carnet onClose>` (importé de `Fiches.tsx`) **après** sa section, dans le même `scrim` ; `Carnet` appelle déjà `useEchap`, donc Échap le ferme d'abord.
- [ ] **Step 2:** Menubar : l'item du nom de campagne et « Configurer la campagne… » appellent `onParametres('campagne')`. `onFiche` perd la valeur `'campagne'` (type dans `Menubar.tsx:34` et `App.tsx:66`).
- [ ] **Step 3:** `npm run typecheck` — PASS. Manuel : renommer un joueur, changer sa couleur, Inscrire un joueur… → le carnet apparaît au-dessus, Échap le ferme, Paramètres reste ouvert.
- [ ] **Step 4: Commit** « La campagne se règle dans les Paramètres ».

---

### Task 6: Écran des joueurs « en direct » et Sons

**Files:**
- Modify: `parametres/rubriques/ecran.tsx`, create `parametres/rubriques/sons.tsx`, `parametres/briques.tsx` (sous-titre « En direct »)

**Interfaces:**
- Consumes: `useStore().display` (`vision`, `encart: Encart`, `pionLabels`, `pionPv`, `audio.volume` — vérifier les noms exacts dans `DisplayState`, `src/shared/types.ts`), `useSons((x) => x.regie)` (`src/renderer/src/mj/sons.ts`).

Entrées `direct: true` ; le panneau insère avant la première d'entre elles le sous-titre `En direct — oublié à la fermeture de l'application, comme au Paravent.`
- Écran : Vision (`display.vision('regards'|'jour')`), Encart joueurs (`display.encart({ on })`), Sens de l'encart (`display.encart({ sens })`), Santé mentale dans l'encart (`display.encart({ sm })`), Noms sous les pions (`display.pionLabels`), PV sous les pions (`display.pionPv`), Volume de l'ambiance (`display.audio({ volume })`, aide : `La musique d'ambiance de l'écran des joueurs.`).
- Sons : Volume général des sons (`regieSon.regler({ general })`, aide : `Les sons posés sur les cartes et les bruitages.`), Déclenchement auto (`regieSon.regler({ auto })`).
- Retirer de `ecran.tsx` l'aparté « Restent en Régie et au Paravent… » ; le remplacer par `Ces commandes sont aussi sous la main au Paravent et en Régie.`
- Mettre à jour le commentaire d'en-tête de `Parametres.tsx` (il dit que ces réglages n'y sont pas, volontairement).

- [ ] **Step 1:** Implémenter. **Step 2:** `npm run typecheck` — PASS.
- [ ] **Step 3 (manuel):** ouvrir Affichage ▾ au Paravent, puis Ctrl+, : basculer « Noms sous les pions » dans Paramètres → l'écran des joueurs change ; refermer, la case d'Affichage ▾ a suivi (Review Focus 5). Chercher `volume` → deux lignes, distinguées par leur aide.
- [ ] **Step 4: Commit** « Paramètres : l'écran des joueurs en direct, et les sons ».

---

### Task 7: Écran d'attente

**Files:**
- Modify: `components/Attente.tsx`, create `parametres/rubriques/attente.tsx`

**Interfaces:**
- Produces (dans `Attente.tsx`) : `export interface ReglagesAttente` (existant, exporté), `export function lireAttente(brut: string | undefined): ReglagesAttente` (l'actuel `lire`, renommé), et `export function ChampsAttente({ r, onChange }: { r: ReglagesAttente; onChange: (patch: Partial<ReglagesAttente>) => void })` — les champs du formulaire extraits de `FenetreAttente`, sans le bouton « Lancer à l'écran ».

- [ ] **Step 1:** Extraire `ChampsAttente` ; `FenetreAttente` s'en sert (comportement inchangé : elle écrit au lancement).
- [ ] **Step 2:** Rubrique `attente` : **une entrée par champ** (pour que la recherche trouve chacun), chacune rendant `ChampsAttente` avec une prop optionnelle `seul?: keyof ReglagesAttente` qui ne rend que ce champ. Écriture : `s.poserReglage('attente', JSON.stringify({ ...lireAttente(s.reglagesBrut['attente']), ...patch }))`, au blur pour les textes. Mots : titre → `['titre','accueil','pause']`, compte à rebours → `['minutes','minuteur','rebours','attente']`, couleurs → `['fond','lueurs','ambiance']`, musique → `['musique','son','boucle']`.
- [ ] **Step 3:** `npm run typecheck` — PASS. Manuel : changer le titre dans Paramètres, ouvrir « Ça commence bientôt » en Régie → le titre est prérempli.
- [ ] **Step 4: Commit** « Paramètres : l'écran d'attente ».

---

### Task 8: Le poste — vignettes et zoom de l'éditeur

**Files:**
- Modify: `parametres/rubriques/biblio.tsx`, `parametres/rubriques/poste.tsx`, `src/renderer/src/mj/modules/Editor.tsx:36`

- [ ] **Step 1:** Déplacer l'entrée « Taille des vignettes » de `biblio.tsx` (rubrique `biblio`, côté poste, qui garde le graveur) vers `poste.tsx`. Dans `RUBRIQUES`, `biblio` passe dans le groupe « Le poste » (`poste: true`).
- [ ] **Step 2:** Entrée `{ id: 'editeur.zoom', rubrique: 'poste', nom: 'Zoom du texte dans l’Éditeur', mots: ['loupe','taille','police','lettres','grossir'] }` : `Curseur` de `ZOOM_MIN` à `ZOOM_MAX`, pas 0.1, texte `${Math.round(v*100)} %`, `s.poserPoste('editeur.zoom', v)`.
- [ ] **Step 3:** `Editor.tsx` : `useEffect(() => setZoomLocal(s.poste.editeurZoom), [s.poste.editeurZoom])` pour suivre un changement venu de Paramètres.
- [ ] **Step 4:** `npm run typecheck` — PASS. Manuel : régler 150 % dans Paramètres avec un document ouvert → le texte grossit.
- [ ] **Step 5: Commit** « Le poste : vignettes et zoom de l'éditeur ».

---

### Task 9: Réglages qui vivent ailleurs, et le compteur du sac

**Files:**
- Modify: `parametres/registre.tsx`, `parametres/Parametres.tsx`, `App.tsx`, `modules/Equipement.tsx:138-145`

**Interfaces:**
- Produces (dans `registre.tsx`) :

```ts
export interface Ailleurs extends Cherchable {
  id: string
  /** « Se règle sur chaque carte — dans Lieux › Murs. » */
  ou: string
  aller?: { libelle: string; faire: () => void }
}
export const AILLEURS: Ailleurs[]
```
  `chemin` vaut `Ailleurs`. Les résultats de la recherche ajoutent, après les groupes de rubriques, un groupe « Ailleurs » : `nom`, `ou`, et le bouton `aller` qui ferme Paramètres puis exécute `faire`.
- Produces (dans `App.tsx`) : écoute de `jdr:fiche` (`detail: 'seance' | 'carnet' | 'fiche' | 'dupliquer'`) → `setFiche(detail)`.

Entrées (mots à la main) :
- Portée du regard d'une carte, Zone éclairée gardée d'une carte, Largeur des ouvertures d'une carte, Soleil, lune et nord d'une carte → `Se règle sur chaque carte — dans Lieux, volet Murs.` ; aller `Ouvrir les Lieux` → `useStore.getState().setView('places')`.
- Taille des pions d'un lieu → `Se règle sur chaque lieu — en Régie, au-dessus de la ligne des pions.` ; aller → `setView('regie')`.
- Dossier de la séance, Présents à la séance → `Se règle pour chaque séance — Séance › Configurer la séance.` ; aller → `dispatchEvent(new CustomEvent('jdr:fiche', { detail: 'seance' }))` (sans séance courante : pas de bouton).
- PNJ sur la ligne des pions → `Se règle pour chaque séance — le « + » de la ligne des pions.` ; pas de bouton.
- Composition de la fiche (caractéristiques, compétences, jauges) → `Dans la fiche de campagne.` ; aller → `jdr:fiche` `'fiche'`.

- [ ] **Step 1:** Implémenter `AILLEURS` et le groupe de résultats ; étendre le test d'intégrité de Task 2 : ids de `AILLEURS` uniques et disjoints de ceux de `REGLAGES`, `mots` non vides.
- [ ] **Step 2:** `Equipement.tsx` : le `span` du compteur devient un `button` (mêmes classes, + `btn-lien` ou équivalent existant) avec le titre `Régler la capacité du sac` qui appelle `ouvrirParametres('regles', 'sac.capacite')`.
- [ ] **Step 3:** `npm test`, `npm run typecheck` — PASS. Manuel : chercher `nord` → groupe Ailleurs, « Ouvrir les Lieux » ferme et mène aux Lieux ; dans l'Équipement d'un personnage, cliquer « X / Y places » → Paramètres s'ouvre sur Règles du jeu, la ligne du sac surlignée.
- [ ] **Step 4: Commit** « Paramètres : trouver aussi ce qui se règle ailleurs ».

---

### Task 10: Vérification d'ensemble

- [ ] **Step 1:** `npm test` et `npm run typecheck` — PASS, sorties jointes au rapport.
- [ ] **Step 2:** `grep -rn "Configurer la campagne\|FicheCampagne(" src/renderer/src/mj` : plus aucune référence à la fenêtre supprimée hors de l'item de menu qui ouvre Paramètres.
- [ ] **Step 3 (manuel, `npm run dev`) :** parcourir les 11 rubriques ; refaire les cinq points de Review Focus ; vérifier que chaque commande rapide (Affichage ▾, barre Régie, console du direct, taille des vignettes en Bibliothèque, Ctrl+molette dans l'Éditeur, panneau Sons, « Ça commence bientôt ») marche comme avant.
- [ ] **Step 4:** Ne pas toucher à `RELEASE_NOTES.md` ni à la version : ce sera fait à la montée de version (CLAUDE.md).
