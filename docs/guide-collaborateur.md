# Guide du collaborateur

Ce que le README ne dit pas : les habitudes du projet, les pièges déjà rencontrés et
la façon de tester sans abîmer une vraie campagne. Pour installer, lancer et publier,
voir d'abord le [README](../README.md) et le [CLAUDE.md](../CLAUDE.md).

## Travailler en mode dev

- **`npm run dev` qui s'arrête avec le code 127**, sans erreur dans le journal : la
  fenêtre Electron a simplement été fermée. Ce n'est pas un plantage.
- **Taille de la fenêtre en dev** : la fenêtre du MJ s'ouvre en « mode ordi portable »,
  1384 × 716 px de zone utile (`TAILLE_PORTABLE` dans `src/main/modePortable.ts`).
  C'est la taille qu'elle a sur un portable en bureau à distance. Le menu
  *Mode développeur › Mode ordi portable* bascule ce mode. Ne pas remettre la fenêtre
  maximisée en dev.
- **Zoom automatique** : `src/main/zoom.ts` zoome la fenêtre du MJ pour qu'elle voie
  toujours au moins 1920 × 960 px CSS. Un petit écran affiche donc la même mise en page
  qu'un grand, en plus petit.
- **Tester une mise en page** à deux tailles : **1920 × 993** px CSS (portable) et
  **2307 × 1234** px CSS (écran 2560 × 1440 à 111 %). Une règle
  `@media (max-width: 2100px)` ne touche pas le grand écran.
- **Main ou renderer ?** Une retouche du renderer se voit avec Ctrl+R. Une retouche du
  processus principal (`src/main`, `src/preload`) demande de relancer `npm run dev`.
- **Vite et ses modules périmés** : il arrive que le rechargement à chaud serve une
  ancienne version d'un fichier, voire un module vide. Toucher le fichier (`touch`) ou
  recharger la fenêtre. Après l'ajout d'un hook React, l'erreur « Should have a queue »
  se règle par un rechargement complet.

## Tester sans toucher aux vraies séances

- **Séance de référence** : une séance dont le nom commence par **« Référence dev »** sert
  de banc d'essai. Le menu *Mode développeur › Ouvrir la séance de référence* la trouve
  par ce préfixe. L'application installée la masque et en sort toute seule si elle
  était active. Ne pas la renommer sans garder le préfixe.
- **Une seconde instance jetable** : `EDM_PROFIL_DEV="<dossier>" npx electron-vite dev`
  lance une instance avec son propre profil, sur une campagne d'essai, sans fermer celle
  qui tourne.
- **Piloter l'app depuis un script** : lancer avec `--inspect <port>` (par exemple
  `npx electron-vite dev --inspect 9231`), puis passer par le protocole de débogage
  (CDP) du processus principal : `BrowserWindow…webContents.executeJavaScript()` pour
  agir dans la fenêtre, `capturePage()` pour une capture. Sur une instance déjà lancée :
  `node -e "process._debugProcess(<pid du processus principal>)"` ouvre l'inspecteur
  sur 9229. Si la fenêtre est cachée (session de bureau à distance déconnectée), les
  captures bloquent : créer une fenêtre `offscreen: true` depuis le processus
  principal. Une capture peut aussi renvoyer une image périmée : appeler
  `webContents.invalidate()` juste avant.
- **Une fenêtre recouverte** passe en `visibilityState: hidden` et ses
  `requestAnimationFrame` s'arrêtent : ce n'est pas un bug.

## Historique utile

- **Lenteur après ~3 h de séance (corrigée en 1.6.2)** : les flux SSE des téléphones
  (`broadcast()` dans `src/main/mobile.ts`) envoyaient l'état complet à chaque pas, sans
  contre-pression. Un téléphone écran éteint qui garde sa connexion faisait tout
  s'empiler dans le processus principal (+120 Mo/min). Correctif : `src/main/fluxSse.ts`
  (testé dans `fluxSse.test.ts`). Seul le dernier état part à un téléphone en retard,
  le flux est coupé après 60 s bloqué, et l'envoi se fait par patchs. Si la lenteur
  revient, rejouer une simulation de plusieurs téléphones qui marchent via `/api/pion`
  en mesurant la mémoire du processus principal.

## L'atelier des lieux

- Conception : [`docs/superpowers/specs/2026-11-13-atelier-des-lieux-design.md`](superpowers/specs/2026-11-13-atelier-des-lieux-design.md),
  plan : [`docs/superpowers/plans/2026-11-13-atelier-des-lieux.md`](superpowers/plans/2026-11-13-atelier-des-lieux.md).
- **Les assets** sont générés sur ChatGPT en planches sur fond magenta `#FF00FF`.
  Les prompts sont dans [`docs/atelier/prompts-assets.md`](atelier/prompts-assets.md).
  Les planches sources sont dans `docs/atelier/planches/`.
- **Découper les planches** : `npx vite-node outils/atelier/decouper.ts`. Le script
  détoure le magenta, recadre, rend les sols et les murs raccordables, range chaque
  asset (table `RANGEMENT`) et réécrit `resources/atelier/catalogue.json`. Une nouvelle
  planche s'ajoute dans la liste `PLANCHES` du script. Il faut ensuite vérifier les
  découpes sur une planche contact.
- **Portes et fenêtres** : elles sont vues **du dessus**. On ne voit que la tranche du
  battant, poignées dépassant de chaque côté. Une planche dessinée de face est à
  refaire. Le découpage centre chaque porte sur ses montants (`centrerMontants`).
- **Garder les mêmes identifiants** quand on remplace un asset : les lieux déjà
  construits reprennent alors la nouvelle image d'eux-mêmes.
- Un asset est soit une `porte` (on l'ouvre ; fermée, elle bloque pas et vue), soit une
  `vitre` (laisse passer la vue, jamais les pions). Une fenêtre condamnée ou un volet
  roulant sont donc des portes.

## Publier

Chaque montée de version réécrit `RELEASE_NOTES.md` (voir [CLAUDE.md](../CLAUDE.md)) :
ce sont ces notes que le launcher Le Grenier affiche. `npm run publier` refuse de
partir si le rapport ne correspond pas à la version de `package.json`.
