# Vidéo tutoriel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** produire `tutoriel-ecran-du-maitre.mp4` (6–8 min, 1080p, sans voix) filmé sur une copie isolée de la campagne, sans rien afficher à l'écran.

**Architecture:** un hook `--require` injecté dans le processus principal d'Electron (build `out/` du dépôt) rend toutes les fenêtres `offscreen`, coupe le son, et ouvre un petit serveur HTTP local de pilotage (eval JS dans le main). Un scénario par acte pilote l'UI (`sendInputEvent`, curseur dessiné injecté dans la page) et enregistre chaque fenêtre en flux brut vers ffmpeg avec une chronologie JSON des légendes/zooms. Un monteur ffmpeg assemble cartons, légendes (PNG rendus avec les polices de l'app), zooms et incrustations.

**Tech Stack:** Electron 33 (celui du dépôt), Node, ffmpeg 9.0.2, Python `sqlite3` (copie de base).

**Spec:** `docs/superpowers/specs/2026-11-12-video-tutoriel-design.md`

## Global Constraints

- Jamais d'écriture dans `D:\Documents\JDR\Campagnes\Chasse aux fantômes` ni dans `%APPDATA%\Ecran du Maitre*`.
- Aucune fenêtre visible, son coupé (`webContents.setAudioMuted(true)`), port portables ≠ celui de l'app installée (on prend 47123).
- Aucun fichier modifié dans `src/`. Outillage dans le scratchpad `…\scratchpad\video\`.
- Sortie : MP4 H.264 1920×1080, 30 i/s, + `chapitres.txt`.

## Review Focus

- La copie de base ouverte par l'app installée (WAL) : la copie doit contenir les écritures récentes → backup API, puis vérifier que la séance id 8 existe dans la copie.
- Une fenêtre non offscreen qui passerait entre les mailles (graveur, examen PDF, fenêtre joueurs) → le hook patche le constructeur, et un contrôle liste `BrowserWindow.getAllWindows()` et vérifie `isOffscreen?`/`webContents.isOffscreen()` pour toutes.
- Le menu de l'app « Mode développeur » n'est pas requis : on ouvre la séance 8 par l'UI normale.
- Frames manquantes (offscreen ne peint que sur changement) → l'enregistreur répète la dernière image à cadence fixe.
- Chemins avec accents/espaces (« fantômes », « Séance ») dans tous les scripts.

---

### Task 1: Copie isolée

**Files:** Create `scratchpad/video/preparer.py`

- [ ] Copier `projet.db` (backup API depuis `?mode=ro`), le reste de `.ecran-du-maitre\` sauf `projet.db*`, `Séance 4 - La scierie`, `Musique`, les fichiers racine → `scratchpad/video/campagne/Chasse aux fantômes`.
- [ ] Créer `scratchpad/video/userdata/donnees/application.db` (backup de celui de l'app installée), y mettre `lastProject` = copie, `portable.port` = 47123, réécrire `recent_project`.
- [ ] Vérifier : la copie contient la séance `Référence dev — La scierie`.

### Task 2: Hook offscreen + serveur de pilotage

**Files:** Create `scratchpad/video/hook.cjs`, `scratchpad/video/lancer.ps1`

- [ ] `hook.cjs` : `app.setPath('userData', …)` avant ready ; remplacer `electron.BrowserWindow` par une sous-classe forçant `webPreferences.offscreen = true`, `show:false`-insensible ; muet ; `POST /eval` sur `127.0.0.1:47200` évalue du JS dans le main (accès `BrowserWindow`, helpers).
- [ ] Lancer `electron -r hook.cjs out/main/index.js` ; vérifier via `/eval` : fenêtre MJ chargée, toutes offscreen, capture PNG lisible.

### Task 3: Boîte à outils de tournage

**Files:** Create `scratchpad/video/outils.cjs` (chargé par le hook)

- [ ] `capture(win, file)`, `clic(win, x, y)`, `glisser`, `taper(win, texte)`, `touche`, `sel(win, cssSelector) -> rect` (via `executeJavaScript`).
- [ ] Curseur dessiné injecté (div fixe, `pointer-events:none`, déplacement animé easing), clic visible (onde).
- [ ] `Enregistreur(win, fichier)` : `paint` → dernière image → ffmpeg rawvideo bgra 30 i/s ; `marque(label, data)` écrit la chronologie JSON.
- [ ] Téléphone simulé : fenêtre offscreen 390×844 sur `http://127.0.0.1:47123/…`, rattachée à un joueur.

### Task 4: Scénarios (un fichier par acte)

**Files:** Create `scratchpad/video/scenes/{0-intro,1-histoire,2-fiches,3-lieux,4-objets-sons,5-pupitre,6-portables,7-stats}.cjs`

- [ ] Explorer chaque module (captures) pour trouver les sélecteurs, puis écrire et tourner la scène ; relire quelques images clés pour valider.

### Task 5: Montage

**Files:** Create `scratchpad/video/legendes.html`, `scratchpad/video/monter.mjs`

- [ ] Cartons et légendes rendus en PNG (polices Fraunces/Archivo de l'app, fond `#0f1518`).
- [ ] Par scène : zooms (crop animé), légendes en fondu, incrustation écran joueurs / téléphone ; concat ; `chapitres.txt`.
- [ ] Vérifier : durée 6–8 min, `ffprobe` 1920×1080 30 i/s, extraire 10 images et les regarder.
