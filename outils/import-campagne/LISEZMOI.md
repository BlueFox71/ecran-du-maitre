# Documents Word d'une campagne

Depuis que **le dossier de campagne fait foi**, il n'y a plus d'import à faire :
l'application lit le dossier tel qu'il est, et le surveille. Reste une chose
qu'elle ne sait pas lire — le `.docx`.

## Convertir

```bash
node outils/import-campagne/documents-word.cjs "D:\Documents\JDR\Ma campagne"
```

Chaque `.docx` trouvé dans le dossier (et ses sous-dossiers) devient un `.html`
dans un sous-dossier `Documents`. Titres, listes, tableaux, gras, italiques et
soulignés sont conservés ; le reste est écarté.

- Les originaux ne sont **jamais** modifiés ni déplacés.
- Un document déjà converti est laissé tel quel : relancer l'outil est sans danger.
- Un `.docx` qui ne contient que des images est signalé et ignoré.
- Aucune base n'est touchée : au prochain examen du dossier, l'application
  découvre les fichiers et les range.

L'extraction se fait avec le `tar.exe` fourni par Windows, qui sait ouvrir un
zip — et un `.docx` en est un. Pas de dépendance supplémentaire.

## Réutiliser le convertisseur seul

`docx2html.cjs` est indépendant. Il lit un `word/document.xml` déjà extrait :

```bash
node -e "console.log(require('./outils/import-campagne/docx2html.cjs').docxToHtml('word/document.xml'))"
```
