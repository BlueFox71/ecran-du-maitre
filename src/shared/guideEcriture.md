# Écrire « {{SEANCE}} » pour l’Écran du Maître

Ce guide est pour une session dédiée à l’écriture de la séance **« {{SEANCE}} »**. Il dit ce que
tu peux écrire toi-même, en fichiers que l’Écran du Maître relit, et ce que tu dois préparer
pour que le MJ le crée dans le logiciel.

> Fichier écrit par l’Écran du Maître (version {{VERSION}}), réécrit chaque fois qu’on entre
> dans la séance : ne le modifie pas, tes changements seraient perdus. Écris tes notes dans un
> autre fichier.

---

## 1. Les règles d’or

1. **Ne touche jamais à `projet.db`** (ni à ses `-wal`, `-shm`, ni aux sauvegardes `projet.db.*`).
   Tout passe par des fichiers texte, que le logiciel relit lui-même.
2. **Le logiciel relit les fichiers** quand ils sont enregistrés, s’il est ouvert. Sinon, il
   les relit à la prochaine ouverture. Le lien marche dans les deux sens : ce que le MJ change
   dans le logiciel est réécrit dans les fichiers. **Si les deux ont changé, le fichier gagne.**
3. **Ne renomme jamais un fichier de lieu ou de PNJ.** Le nom du fichier, c’est le nom du lieu
   ou du PNJ. Un fichier de PNJ renommé crée un **nouveau** PNJ. Un fichier de lieu renommé
   n’est plus reconnu. Pour renommer, c’est le MJ qui renomme dans le logiciel.
4. **Relis un fichier juste avant de le modifier.** Le MJ a pu le changer entre-temps.
5. **Les fichiers sont en UTF-8**, sans changer la structure des titres `#` décrite plus bas.
   Un titre mal écrit fait que la partie n’est pas reconnue.
6. Ce qui est sous « Notes du MJ », dans l’Arborescence, et dans le champ « Ce que le MJ
   sait » d’un objet **n’est jamais montré aux joueurs**. La **Description** d’un lieu et
   « Ce qu’on en voit » d’un objet, eux, peuvent leur être montrés.

---

## 2. Où sont les choses

| Quoi | Où |
|---|---|
| La campagne | `{{RACINE}}\` |
| Les fichiers du MJ pour la séance (scénario, images, plans, props) | `{{DOSSIER_SEANCE}}` |
| Ce que le logiciel synchronise pour la séance (le dossier de ce guide) | `{{DOSSIER_APP}}` |

Le scénario du MJ est d’ordinaire dans le sous-dossier `MJ\` de la séance.

Dans `{{DOSSIER_APP}}`, le logiciel tient :

| Sous-dossier ou fichier | Contenu | Tu peux… |
|---|---|---|
| `Lieux\*.txt` | un fichier par lieu | lire et modifier (pas créer de lieu) |
| `PNJ\*.txt` | un fichier par PNJ | lire, modifier **et créer** |
| `Moments\*.html` | un texte par moment de la Chronologie | lire, modifier et créer |
| `Arborescence.json` | le scénario en cartes et flèches | lire, modifier et créer |
| `Annexes\*.html` | les documents que le MJ garde sous la main | créer et modifier |

Les dossiers manquants peuvent être créés : le logiciel ne les crée que quand il a quelque
chose à y écrire.
{{MODELES}}
---

## 3. La fiche de personnage de la campagne

Les PNJ utilisent la fiche de la campagne. Seuls ces libellés sont reconnus (sans tenir compte
des majuscules ni des accents) :

- **Caractéristiques** : {{STATS}}
- **Jauges** : {{JAUGES}}
- **Compétences** : {{COMPETENCES}}

Un libellé inconnu est ignoré sans message.

---

## 4. Les lieux — `Lieux\<nom du lieu>.txt`

**Un lieu naît dans le logiciel, pas dans un fichier.** Le MJ le crée dans le module Lieux,
avec son plan, ou il le reprend d’une autre séance. Le logiciel écrit alors son fichier, et tu
le remplis. Un `.txt` que tu poses pour un lieu qui n’existe pas n’est pas lu.

Si tu prépares des lieux avant qu’ils existent, écris-les dans un fichier à part, par exemple
`Lieux à créer.md` dans ce dossier. Le MJ les créera, et tu recopieras ensuite le contenu dans
leurs fichiers.

### Format

```
Jardin › Pavillon de thé

# Description — ce que voient les joueurs en arrivant
Texte lu aux joueurs, ou montré à la table.

# Notes du MJ — ce qu'ils ne doivent pas savoir
Ce qui se cache ici, la vérité, les pièges.

# Scénarios — ce que les joueurs peuvent tenter ici

## Ils allument les lanternes
Ce qui se passe, en prose.

# Découvertes — ce qu'on peut trouver ici

## La lettre sous le tatami
Si : on soulève le tatami près de l'autel
Alors : une lettre pliée en quatre, datée de 1931…

# Déclencheurs — ce qui arrive si…

## Minuit sonne
Si : les joueurs sont encore dans le pavillon à minuit
Alors : les lanternes s'éteignent d'un coup, −1 santé mentale.
```

- **Première ligne** : la filiation, du lieu parent jusqu’au lieu (`Parent › Enfant`). C’est le
  logiciel qui l’écrit, et elle n’est pas relue. Laisse-la telle quelle.
- **Les cinq titres `#`** doivent rester présents, même vides, et dans cet ordre.
- **Scénarios** : chaque `## titre` est une carte. Le texte qui suit est sa description.
- **Découvertes** et **Déclencheurs** : chaque `## titre` est une carte avec une ligne
  `Si : …` (la condition) et une ligne `Alors : …` (le résultat). Les lignes suivantes
  prolongent la dernière partie commencée.
- **Ne change pas le titre `##` d’une carte existante** si tu veux garder ses liens. Le MJ y
  rattache des objets, des PNJ et des moments dans le logiciel, et ces liens suivent la carte
  tant que son titre ne change pas. La coche « fait » ne vit pas dans le fichier.

---

## 5. Les PNJ — `PNJ\<nom du PNJ>.txt`

**Un fichier neuf dans `PNJ\` crée un PNJ** dans cette séance, avec le nom du fichier.

### Format

```
Mme Okada

# Identité
Occupation : gardienne du jardin
Âge : 70
Sexe : femme

# Notes du MJ — ce qu'il cache, ce qui le fait céder
Ce qu'elle sait, ce qu'elle tait, ce qui la fait parler.

# Caractéristiques
{{EXEMPLE_STATS}}

# Jauges — valeur / maximum
{{EXEMPLE_JAUGES}}

# Compétences — seulement celles qu'il a
{{EXEMPLE_COMPETENCE}}

# Butin — ce qu'on lui trouve sur le corps, une ligne par chose
Clé du pavillon
Bâtonnets d'encens × 3
```

- La **première ligne** répète le nom. C’est le **nom du fichier** qui fait foi.
- **Sexe** : `femme`, `homme`, ou vide.
- Une ligne absente ne change rien. Une partie peut rester vide.
- **Butin** : une chose par ligne, `× N` à la fin pour une quantité. C’est du texte, pas des
  objets du logiciel (voir §8).
- Le **portrait**, la couleur et les liens se règlent dans le logiciel. Pose l’image dans
  `{{DOSSIER_PNJ_IMAGES}}`, et signale-la au MJ.
- Pour un fantôme ou une entité, même format. Les jauges peuvent servir de compteur.

---

## 6. Les moments de la Chronologie — `Moments\<titre>.html`

Un moment, c’est une étape de la séance dans la Chronologie, avec son texte (ce qu’on lit à
la table, ou les notes de la scène).

- **Créer** : pose `Moments\<titre du moment>.html`. Le moment naît sous le nom du fichier
  quand le MJ clique sur **« Relire le dossier »** dans la Chronologie.
- **Format** : du HTML simple (`<h2>`, `<p>`, `<ul>`, `<b>`, `<i>`), sans CSS ni script.
- **Le `.txt` à côté est une copie** réécrite par le logiciel. N’écris que le `.html`.
- Les titres des moments servent à l’arborescence (champ `moment`).

---

## 7. L’arborescence — `Arborescence.json`

Le scénario en cartes reliées par des flèches, réservé au MJ. Quand le logiciel écrit ce
fichier, il commence par un `_format` qui en donne le mode d’emploi : **lis-le**.

```json
{
  "seance": "{{SEANCE}}",
  "cartes": [
    { "ref": "arrivee", "type": "ouverture", "titre": "Arrivée",
      "resume": "…", "regle": "et", "fait": false, "image": null, "cadreImage": null,
      "moment": null, "lieu": null, "pnj": [] },
    { "ref": "pavillon", "type": "scene", "titre": "Le pavillon",
      "resume": "…", "regle": "et", "fait": false, "image": null, "cadreImage": null,
      "moment": null, "lieu": "Pavillon de thé", "pnj": ["Mme Okada"] }
  ],
  "fleches": [ { "de": "arrivee", "a": "pavillon", "mot": "la grille ouverte" } ]
}
```

- **type** : `ouverture` | `scene` | `objectif` | `fin`. **regle** : `et` (il faut toutes les
  flèches qui arrivent) ou `ou` (une seule suffit).
- **Carte neuve** : sans `id`, avec une `ref` libre que les flèches peuvent désigner, et sans
  `x`/`y`, pour qu’elle se place toute seule. Le logiciel réécrit ensuite le fichier avec les
  vrais `id` : garde-les par la suite.
- **lieu**, **pnj** et **moment** désignent les choses **par leur nom exact**, qui doivent déjà
  exister. Sinon, mets `null` ou `[]`, et complète plus tard.
- **image** : chemin dans la campagne, avec des `/`, par exemple `"{{EXEMPLE_IMAGE}}"`.
- **Supprimer une carte du fichier la supprime du logiciel.**
- Un JSON cassé est ignoré (ni lu ni écrasé) jusqu’à ce qu’il soit réparé.

---

## 8. Les objets — à préparer pour le MJ

**Les objets n’ont pas de fichier texte** : on ne les crée que dans le logiciel (module
Objets). Chaque séance a ses propres familles et ses propres objets, et une séance neuve n’en
a aucun.

Ton travail :

1. **Les images** : pose-les dans `{{DOSSIER_OBJETS}}`, en `.png` ou `.jpg`, un fichier par
   objet, nommé comme l’objet.
2. **La liste** : écris `Objets à créer.md` dans ce dossier, une fiche par objet, avec les
   champs du logiciel :

```
## Lanterne de pierre miniature
- Famille : Jardin (nouvelle) — ou une famille d'une séance précédente
- Image : {{EXEMPLE_OBJET}}
- Type : pièce unique | se compte (quantité : 3)
- Ce qu'on en voit (peut être montré aux joueurs) : …
- Ce que le MJ sait (jamais montré) : …
- Équipable : oui/non — emplacements : main gauche, main droite…
- Place occupée dans le sac : 1
- Effets : « Éclaire » — lueur verte, 3 m ; « … » — …
- Où il est au départ : dans tel lieu / sur tel PNJ / dans tel inventaire (Camion…)
```

- **Emplacements possibles** : Tête, Cou, Épaule gauche/droite, Bras gauche/droit, Gant
  gauche/droit, Dos, Torse, Main gauche/droite, Ceinture…
- **Effets** : un titre court (« Éclaire », « Protège », « Révèle ») et un détail.
- **Objets des séances précédentes** : ils **ne se recréent pas**. Le MJ les importe (Objets →
  « Importer depuis une séance précédente… »), par famille ou un par un. Ne liste que les
  objets **nouveaux**, et signale ceux d’avant qui doivent revenir.
- Un objet lié à une découverte d’un lieu : cite-le par son nom exact dans la carte. Le MJ
  fera le lien dans le logiciel.

---

## 9. La pochette — à préparer pour le MJ

La pochette, c’est ce que les joueurs reçoivent sur leur téléphone (lettres, photos, coupures
de presse, plans…). **Elle n’a pas de fichier texte** : le MJ y met les documents dans le
logiciel (Pochette → « Mettre un document »). Ils entrent **cachés**, et il les dévoile pendant
la partie.

Ton travail :

1. **Les documents** : seuls les **images (`.png`, `.jpg`), PDF et vidéos** peuvent aller dans
   la pochette. Un document texte doit être mis en page en image ou en PDF. Pose-les dans
   `{{DOSSIER_POCHETTE}}`. Les props travaillés (Word, sources) vont à côté, dans `Props\`.
2. **La liste** : ajoute une partie `# Pochette` à `Objets à créer.md` :

```
## Lettre de 1931
- Fichier : {{EXEMPLE_POCHETTE}}
- Onglet : Indices (le rangement dans la pochette)
- Pour : toute la table | un seul joueur (lequel)
- Quand la dévoiler : quand ils soulèvent le tatami (découverte « La lettre sous le tatami »)
```

- Des documents des séances précédentes peuvent revenir : le MJ les importe comme les objets
  (Pochette → « Importer depuis une séance précédente… »). Signale lesquels.

---

## 10. Les annexes — `Annexes\<titre>.html`

Les annexes sont les documents que le MJ consulte pendant toute la séance : la liste des PNJ,
la chronologie de l’histoire, les règles de santé mentale, les entités. Écris-les en HTML
simple dans `Annexes\`. Le MJ les ajoute ensuite à sa liste d’annexes dans le logiciel.

---

## 11. Ordre de travail conseillé

1. Lire le scénario du MJ{{ET_MODELES}}.
2. Écrire les **PNJ** (fichiers dans `PNJ\`) : ils existent tout de suite.
3. Écrire `Lieux à créer.md` : nom, parent, description, notes, et les cartes. Le MJ crée les
   lieux dans le logiciel, puis tu remplis leurs fichiers `Lieux\*.txt`.
4. Écrire les **moments** (`Moments\*.html`), et demander au MJ de cliquer sur « Relire le
   dossier ».
5. Écrire `Objets à créer.md` (objets et pochette), et poser les images dans les dossiers de
   la séance.
6. Écrire les **annexes**.
7. Écrire l’**Arborescence.json** en dernier, quand les noms des lieux, des PNJ et des moments
   sont fixés.
8. Faire un bilan pour le MJ : ce qui est écrit, ce qu’il doit créer ou lier dans le logiciel,
   ce qu’il doit importer des séances précédentes.

---

## 12. Ce que tu ne peux pas faire par fichier

Il faut le logiciel pour : créer un lieu et son plan (murs, portes, lumières, atelier),
créer un objet et le poser, mettre un document dans la pochette, rattacher objets, PNJ et
moments aux cartes d’un lieu, régler les portraits et les couleurs, placer les pions, poser
les sons. Pour tout ça, **prépare et décris** : le MJ le fait dans le logiciel.
