# Outils de chasse, chantier 2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire entrer la spirit box, le livre d'écriture, la planche et le tarot dans le jeu, pilotés depuis le panneau Objets du Paravent, avec EMF et thermomètre dans le même panneau.

**Architecture:** Les trois nouveaux outils sont des `OutilChasse` comme l'EMF : même moteur (`src/main/chasse.ts`), mêmes gestes au téléphone. Ce qu'ils « disent » vit dans un nouveau module du main, `src/main/parole.ts` : en mémoire pour la soirée (dernier texte dit, pages écrites, position de la goutte, fenêtre montrée à la table), diffusé aux téléphones avec la règle « en main ou posé et lisible » et à l'écran de la table par `DisplayState`. Les textes préparés sont sur la fiche d'objet (colonne JSON `objet.parole`, recopiée avec l'objet) ; ceux du tarot dans une table `tarot_texte` par séance. Le son sort du PC : la fenêtre du MJ joue grésillement, voix et crayon.

**Tech Stack:** Electron, React 18, TypeScript, better-sqlite3, Vitest (`npm test`), `npm run typecheck`.

**Spec:** `docs/superpowers/specs/2026-11-26-outils-chasse-chantier2-design.md`

## Global Constraints

- Tout le son sort du PC, rien des téléphones.
- Textes préparés par séance ; aucun texte de campagne.
- Un objet rangé dans le sac (`ou: 'sac'`) ou porté sans pion est hors jeu : muet, rien ne s'y lance.
- Objet posé : visible des joueurs dont le pion est à `PORTEE_LECTURE_M` (6 m) sans mur (`lisiblePar`).
- Livre, planche, tarot à la table : une fenêtre par-dessus le plan, jamais sans un geste du MJ.
- Téléphones : Android (Chrome) et iPad (WebKit) — pas de `foreignObject` dans un SVG, pas de masques SVG lourds.
- Interface en français, ton de l'application ; commentaires en français comme le reste du code.
- Migration suivante : 99 (`src/main/db/schema.ts`).
- Version 1.14.0 et `RELEASE_NOTES.md` à la fin (à faire valider, ne rien publier).

## Review Focus

1. Spirit box lancée alors que personne ne la tient (sac, réserve, inventaire) → bouton grisé, rien ne part (test Task 3).
2. Deux joueurs, l'un loin d'un livre posé → seul le proche reçoit les pages (test Task 3).
3. Livre qui change de main → le nouveau porteur voit les pages déjà écrites (test Task 3).
4. Téléphone qui se reconnecte en plein passage → il reçoit l'état courant, pas un trou (le passage porte son instant de départ ; test Task 3).
5. Dupliquer une séance → les textes de la spirit box et du tarot suivent, les pages du livre non (tests Task 2).

---

### Task 1: Trois nouveaux outils dans le type et le moteur

**Files:**
- Modify: `src/shared/chasse.ts`, `src/main/chasse.ts`, `src/renderer/src/shared/outilsChasse.tsx`
- Test: `src/main/db/test/moteurChasse.test.ts`, `src/shared/chasse.test.ts`

**Interfaces:**
- Produces: `OutilChasse = 'emf' | 'thermometre' | 'spiritbox' | 'livre' | 'planche'` ; `OUTILS_CHASSE` gagne `{ id: 'spiritbox', nom: 'Spirit box' }`, `{ id: 'livre', nom: 'Livre d’écriture' }`, `{ id: 'planche', nom: 'Planche de spiritisme' }` ; `estMesureur(o: OutilChasse): boolean` (emf, thermometre) ; `seRegleAllume(o): boolean` (emf, thermometre, spiritbox) ; `imageOutil` couvre les cinq (`spirit-box.png`, `livre.jpg`, `planche.jpg`).

- [ ] Test : un exemplaire `spiritbox` en main, allumé → `gain === 1`, `valeur === 0` ; éteint → `gain === 0` ; `livre`/`planche` en main → `gain === 0`, `valeur === 0` ; `controler(livre, 3)` ne crée aucun contrôle (l'appareil garde `controle: false`).
- [ ] Le faire échouer, puis : dans `calculer()`, la valeur n'est lue des calques que pour un mesureur (sinon 0) ; le gain se calcule pour `emf` (valeur ≥ 0,5) **et** pour `spiritbox` (allumée, quelle que soit la valeur), même règle de distance ; `controler` refuse un non-mesureur.
- [ ] `AppareilPose` (`outilsChasse.tsx`) : `RAPPORT` pour les nouveaux (spirit box 1519/629, livre 1024/1536, planche 1024/1536) ; pas de lueur pour livre et planche, lueur blanche faible pour une spirit box allumée.
- [ ] `npm test` et `npm run typecheck` verts ; commit `feat(chasse): spirit box, livre et planche sont des outils`.

### Task 2: Les textes préparés, en base

**Files:**
- Modify: `src/main/db/schema.ts` (migration 99), `src/shared/types.ts`, `src/main/db/repos/objets.ts`, `src/main/db/repos/timeline.ts` (duplication), `src/main/ipc/index.ts`, `src/preload/index.ts`, `src/main/defaire.ts`
- Create: `src/shared/parole.ts`, `src/main/db/repos/tarot.ts`
- Test: `src/main/db/test/parole.test.ts`

**Interfaces:**
- Produces (`src/shared/parole.ts`) :
  - `interface TextePrepare { id: string; texte: string; ecriture?: string; taille?: number; angle?: number }`
  - `interface ParoleObjet { textes: TextePrepare[]; voix?: { nom: string | null; reglages: ReglagesVoix } }` (`ReglagesVoix` déplacé de `mj/chasse/spirit.ts` vers `src/shared/parole.ts`, réexporté par `spirit.ts`)
  - `lireParole(brut: unknown): ParoleObjet` (valide, jamais d'exception ; vide par défaut)
  - `interface TexteTarot { id: number; arcane: string; texte: string }` (`arcane` = `Arcane.fichier`)
- Migration 99 : `ALTER TABLE objet ADD COLUMN parole TEXT;` + `CREATE TABLE tarot_texte (id INTEGER PRIMARY KEY AUTOINCREMENT, campaign_id INTEGER NOT NULL REFERENCES campaign(id) ON DELETE CASCADE, session_id INTEGER NOT NULL REFERENCES game_session(id) ON DELETE CASCADE, arcane TEXT NOT NULL, texte TEXT NOT NULL, ord INTEGER NOT NULL DEFAULT 0)`.
- `Objet.parole: ParoleObjet` (lu par les trois SELECT d'objet de `objets.ts`) ; `updateObjet(id, { parole })` l'écrit.
- Repo `tarot.ts` : `textesTarot(): TexteTarot[]` (séance active), `ajouterTexteTarot(arcane, texte): void`, `modifierTexteTarot(id, texte): void`, `retirerTexteTarot(id): void`, `copierTarot(de: number, vers: number): void`.
- IPC : `objets:update` porte déjà le patch (rien de neuf pour `parole`) ; `tarot:liste`, `tarot:ajouter`, `tarot:modifier`, `tarot:retirer` → `window.jdr.tarot.*` ; `'tarot'` ajouté à `MODULES` de `defaire.ts` (libellé « Tarot »).

- [ ] Tests : `lireParole` d'un JSON abîmé → vide ; `updateObjet` puis relecture garde textes et voix ; dupliquer la séance (`timeline.ts`, fonction de duplication existante) recopie `parole` et les `tarot_texte` vers la nouvelle séance ; `textesTarot()` ne rend que la séance active.
- [ ] Les faire échouer, implémenter, appeler `copierTarot` là où la duplication copie les objets.
- [ ] `npm test`, `npm run typecheck` ; commit `feat(chasse): textes préparés des outils et du tarot, par séance`.

### Task 3: Ce que disent les outils — état de la soirée et diffusion

**Files:**
- Create: `src/main/parole.ts`
- Modify: `src/shared/parole.ts`, `src/shared/chasse.ts`, `src/main/chasse.ts`, `src/main/mobile.ts`, `src/main/display.ts`, `src/shared/types.ts`, `src/main/ipc/index.ts`, `src/preload/index.ts`
- Test: `src/main/db/test/parole.test.ts`

**Interfaces:**
- Produces (`src/shared/parole.ts`) :
  - `interface Passage { id: number; texte: string; ecriture: string; taille: number; angle: number; debut: number }` (`debut` = `Date.now()` du serveur au départ)
  - `interface Goutte { de: string; vers: string; debut: number }` (identifiants de case de `spiritisme.ts`)
  - `interface ParoleTelephone { placementId: number; objetId: number; outil: 'spiritbox' | 'livre' | 'planche'; dit?: { texte: string; a: number }; pages?: Passage[]; goutte?: Goutte }`
  - `type FenetreChasse = { sorte: 'livre'; objetId: number; nom: string; pages: Passage[] } | { sorte: 'planche'; objetId: number; nom: string; goutte: Goutte } | { sorte: 'tarot'; cartes: { arcane: string; texte: string }[] }`
- Produces (`src/main/parole.ts`) : `dire(objetId, texte): string | null`, `ecrire(objetId, t: TextePrepare): string | null`, `viser(objetId, caseId): string | null` (null = fait, sinon raison : « Personne ne la tient. », « Elle est éteinte. », « Elle est dans un sac. ») ; `montrer(f: { sorte: 'livre' | 'planche'; objetId: number } | null)`, `tirerTarot(arcane: string, texte: string)`, `retirerTarot()` ; `paroleDe(characterId, ctx): ParoleTelephone[]` ; `oublier()`.
- `DisplayState.fenetreChasse?: FenetreChasse | null`. `OutilTelephone` gagne `objetId`. L'état du téléphone gagne `paroles?: ParoleTelephone[]`.
- IPC : `parole:dire`, `parole:ecrire`, `parole:viser`, `parole:montrer`, `parole:tarot`, `parole:retirerTarot` → `window.jdr.parole.*`.

- [ ] Tests : spirit box dans un sac → `dire` rend « Elle est dans un sac. » ; éteinte → refus ; en main → ok, et `paroleDe(porteur)` contient `dit` ; livre posé : `paroleDe` d'un joueur à 2 m le contient avec ses pages, d'un joueur à 20 m non ; livre ramassé par un autre → ses `pages` toujours là ; `viser` enchaîne `de` = l'ancienne case ; `montrer({sorte:'livre',...})` met `fenetreChasse` dans l'état de l'écran, `montrer(null)` l'enlève ; `tirerTarot` ajoute une carte, `retirerTarot` vide.
- [ ] Les faire échouer, implémenter en s'appuyant sur `appareils()`, `lisiblePar`, `contexte()` de `chasse.ts` (garder un exemplaire « en jeu » = `ou` `main` ou `lieu`, et hors `sacs`). `oublier()` branché là où `chasse.oublier()` l'est.
- [ ] `mobile.ts` : `etatPour` ajoute `paroles` ; `display.ts` diffuse `fenetreChasse`. Chaque geste rediffuse (téléphones + table).
- [ ] `npm test`, typecheck ; commit `feat(chasse): ce que disent les outils, diffusé aux téléphones et à la table`.

### Task 4: Les vues partagées — livre, planche, spirit box, tarot

**Files:**
- Create: `src/renderer/src/shared/chasse/VueLivre.tsx`, `VuePlanche.tsx`, `VueSpirit.tsx`, `VueTarot.tsx`
- Modify: `src/renderer/src/mj/chasse/Livre.tsx`, `Planche.tsx`, `SpiritBox.tsx`, `Tarot.tsx` (s'en servir)

**Interfaces:**
- `VueLivre({ pages: Passage[]; maintenant: number }): JSX.Element` — le livre de la simulation, chaque passage tracé jusqu'à `maintenant - debut` (même rythme que `delaiLettre`).
- `VuePlanche({ goutte: Goutte | null; maintenant: number }): JSX.Element` — la goutte interpolée entre `de` et `vers` sur `dureeTrajet`.
- `VueSpirit({ allume: boolean; dit?: { texte: string; a: number } }): JSX.Element` — la photo, la fréquence qui défile, le texte dit dessous.
- `VueTarot({ cartes: { arcane: string; texte: string }[] }): JSX.Element` — le tapis de la simulation.
- `useMaintenant(actif: boolean): number` (rafraîchit à chaque image tant qu'une animation court).

- [ ] Extraire le rendu des quatre simulations dans ces vues sans changer leur comportement ; les pages Simulation Objets s'en servent.
- [ ] Vérifier à l'œil dans Simulation Objets (lancer `npm run dev`) : livre, planche, spirit box, tarot identiques à avant.
- [ ] Typecheck, tests ; commit `refactor(chasse): vues partagées des outils qui parlent`.

### Task 5: Les sons au PC

**Files:**
- Modify: `src/renderer/src/mj/chasse/SonsChasse.tsx`, `src/renderer/src/mj/store.ts`

**Interfaces:**
- Consumes : `AppareilChasse` (Task 1) ; `window.jdr.spirit.parler` ; `window.jdr.parole.dire` (Task 3).
- Produces : `lancerVoix(objetId: number, texte: string): Promise<string | null>` exporté de `SonsChasse.tsx` — génère le WAV avec la voix et les réglages de la fiche (`Objet.parole.voix`), le fait passer dans le `SonSpirit` de l'appareil, et appelle `parole.dire` **au moment où la voix commence**. `jouerCrayon(passage: Passage): void`.

- [ ] Une spirit box en jeu, allumée, avec `gain > 0` → une instance `SonSpirit` qui grésille au volume `gain × général` ; repit et Silence de la régie comme l'EMF.
- [ ] Le crayon : quand l'état de parole reçoit un nouveau passage, `SonCrayon` gratte pendant sa durée.
- [ ] Vérifier à l'oreille en dev ; typecheck ; commit `feat(chasse): grésillement, voix et crayon au PC`.

### Task 6: Le panneau Objets du Paravent

**Files:**
- Create: `src/renderer/src/mj/components/AppareilsDuParavent.tsx`
- Modify: `src/renderer/src/mj/components/ObjetsDeScene.tsx`, `src/renderer/src/mj/chasse/Appareils.tsx` (exporter `Curseur`), `src/renderer/src/styles/app.css`

**Interfaces:**
- Consumes : `useStore(s => s.chasse)`, `s.objets` (`Objet.parole`), `window.jdr.objets.update`, `window.jdr.parole.*`, `window.jdr.tarot.*`, `lancerVoix` (Task 5), vues (Task 4).

- [ ] Section « Appareils » en tête du panneau : une carte par appareil en jeu de la séance (en main / posé / dans un sac / sans pion), quel que soit le lieu.
  - EMF, thermomètre : mesure, Prendre / Lâcher le contrôle avec `Curseur`.
  - Spirit box : allumée ou non ; voix (liste `spirit.voix()`) et réglages ; textes (ajouter, modifier, retirer) ; « Dire » par texte → `lancerVoix` ; grisé avec la raison si hors jeu.
  - Livre : textes avec écriture / taille / inclinaison ; « Écrire » ; « Montrer à la table » / « Retirer ».
  - Planche : la planche (`VuePlanche`), clic sur une case ou touche du clavier → `parole.viser` ; « Montrer » / « Retirer ».
- [ ] Section « Tarot » : les 22 arcanes ; une carte choisie → ses textes de séance (et le texte intégré d'`arcanes.ts` comme point de départ) ; « Afficher » → `parole.tarot` ; « Retirer le tapis ».
- [ ] Vérifier en dev sur la séance de référence ; typecheck ; commit `feat(paravent): appareils et tarot dans le panneau Objets`.

### Task 7: Téléphones et écran de la table

**Files:**
- Modify: `src/renderer/src/mobile/Outils.tsx`, `src/renderer/src/mobile/Mobile.tsx`, `src/renderer/src/styles/mobile.css`, `src/renderer/src/shared/Slide.tsx`, `src/renderer/src/player/Player.tsx`, `src/renderer/src/styles/slide.css`

**Interfaces:**
- Consumes : `etat.paroles: ParoleTelephone[]`, `OutilTelephone` (spirit box allumable ; livre, planche : seulement Poser), `DisplayState.fenetreChasse`, vues de Task 4.

- [ ] « Mes objets » : cartes des nouveaux outils (spirit box : Allumer/Éteindre, Poser ; livre, planche : Poser) ; l'appareil en grand affiche `VueSpirit` / `VueLivre` / `VuePlanche` d'après `paroles`. Un livre ou une planche posés et lisibles (dans `paroles` sans être portés) ont leur carte, avec Ramasser s'ils sont à portée.
- [ ] Table : `fenetreChasse` rendue dans une fenêtre par-dessus le plan (même place et même allure que `FenetreImage`), `VueLivre` / `VuePlanche` / `VueTarot`.
- [ ] Vérifier en dev (portable + écran de la table) ; typecheck ; commit `feat(chasse): les outils qui parlent sur les téléphones et à la table`.

### Task 8: Version et notes

**Files:**
- Modify: `package.json` (1.14.0), `RELEASE_NOTES.md`

- [ ] Notes 1.14.0 écrites pour le MJ (Nouveautés : spirit box, livre, planche, tarot, panneau Objets du Paravent ; Améliorations ; Corrections), marqueur `<!-- version: 1.14.0 -->`.
- [ ] `npm test`, `npm run typecheck` ; commit `1.14.0 : les outils qui parlent`. Ne rien publier.
