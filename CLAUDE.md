# CLAUDE.md

## Le Grenier — rapport de mise à jour

Ce projet est distribué par **Le Grenier** (launcher `BlueFox71/le-grenier`). La section
« Actualités » de sa fiche affiche les **notes des releases GitHub** de ce dépôt : une
release sans notes n'y apparaît pas, et rien ne signale l'oubli.

**À chaque montée de version, réécris `RELEASE_NOTES.md`** et fais-le valider par
l'utilisateur avant la publication :

- première ligne : `<!-- version: X.Y.Z -->`, **la nouvelle version** (celle de
  `package.json`) ;
- en Markdown, **écrit pour l'utilisateur de l'outil** : ce qui change pour lui, pas le
  détail technique ;
- sections `### Nouveautés`, `### Améliorations`, `### Corrections` — seulement celles
  qui ont du contenu ;
- il couvre tout ce qui a changé depuis la release précédente
  (`git log v<précédente>..HEAD`).

`npm run publier` (avec `GH_TOKEN`) enchaîne `scripts/publish-notes.mjs`, qui pose ce
rapport comme notes de la release `v<version>`. Il **refuse** si le marqueur ne
correspond pas à la version de `package.json` : un rapport oublié ne se republie pas
en silence. Pour reposer le rapport seul (corriger une coquille) :
`node scripts/publish-notes.mjs`.

⚠️ electron-builder ne met **pas** de lui-même de notes dans la release GitHub : un
`release-notes.md` dans `resources/` ne finirait que dans `latest.yml`, invisible du
Grenier.

Le titre de la release reste la version, sauf si elle mérite un nom
(« 1.4.0 — Le grand ménage ») : Le Grenier l'affiche alors à côté du numéro.
