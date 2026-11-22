# Prompts — icônes du catalogue d'objets

Le nouveau rangement des objets de l'atelier : une colonne de **familles**, une colonne de
**rayons** pour la famille ouverte, et le thème en liste déroulante. Ces icônes remplacent
celles de `icones 1.png` et `icones 2.png` (illustrées, en couleur) par des **pictogrammes
blancs**, à la façon d'une interface de jeu : lisibles en petit, tous du même trait.

Trois planches au format habituel (**1536 × 1024**, fond **magenta pur**). Elles
partagent ce début de prompt :

```
Create ONE image, 1536x1024: an icon sheet for the user interface of a tabletop RPG map
editor. Each icon is a simple pictogram that names a category of objects.

BACKGROUND: solid pure magenta (#FF00FF) everywhere. Never use magenta or pink inside an
icon. Icons do not touch; wide clear magenta space around each one.

LAYOUT: a regular grid, as described below. One icon centered in each cell, all icons the
same visual size (about 60% of the cell), same weight, same style.

STYLE: flat monochrome glyphs in pure white (#FFFFFF) only: solid white shapes with a few
thin cut-out details, like the category icons of a modern video game UI. Front or
three-quarter view of a single recognizable object, simplified to its silhouette. Bold,
clean, readable at 32 pixels. NO color, NO gradient, NO shadow, NO glow, NO outline in
another color, NO background shape behind the icon (no circle, no square, no frame).
No text, no letters, no numbers, no grid lines.
```

## 1. `icones 3.png` — les familles, le mobilier, le début de la cuisine (5 × 4)

```
GRID: 5 columns, 4 rows (20 icons), left to right, top to bottom.
Row 1:
1. Furniture: a cushioned armchair.
2. Kitchen and bathroom: a cooking pot with a lid next to a water tap.
3. Lighting: a table lamp with a lampshade.
4. Decoration and objects: a vase with a stem of flowers.
5. Nature: a leafy tree.
Row 2:
6. Architecture: a classical column with base and capital.
7. Outdoors: a street lamp post next to a small car.
8. Characters: the head and shoulders of a person.
9. My objects: an open cardboard box with an arrow pointing down into it.
10. Seats: a simple wooden chair.
Row 3:
11. Tables: a table with four legs.
12. Beds: a bed with a pillow and a blanket, seen from the side.
13. Storage: a wardrobe with two doors.
14. Desk: a desk with a drawer and a computer screen on it.
15. Fireplaces: a fireplace with flames in the hearth.
Row 4:
16. Rugs: a rectangular rug with fringes, lying slightly tilted.
17. Folding screens: a three-panel folding screen.
18. Kitchen: a cooking stove with two pans on it.
19. Appliances: a refrigerator.
20. Bathroom: a bathtub on feet.
```

| Case | Fichier | Famille ou rayon |
|---|---|---|
| 1 | `mobilier` | famille Mobilier |
| 2 | `cuisine-et-bain` | famille Cuisine et bain |
| 3 | `lumiere` | famille Lumière |
| 4 | `deco-et-objets` | famille Déco et objets |
| 5 | `nature` | famille Nature |
| 6 | `architecture` | famille Architecture |
| 7 | `exterieur` | famille Extérieur |
| 8 | `personnages` | famille Personnages |
| 9 | `mes-objets` | famille Mes objets |
| 10 | `assises` | Mobilier › Assises |
| 11 | `tables` | Mobilier › Tables |
| 12 | `lits` | Mobilier › Lits |
| 13 | `rangements` | Mobilier › Rangements |
| 14 | `bureau` | Mobilier › Bureau |
| 15 | `cheminees` | Mobilier › Cheminées |
| 16 | `tapis` | Mobilier › Tapis |
| 17 | `paravents` | Mobilier › Paravents |
| 18 | `cuisine` | Cuisine et bain › Cuisine |
| 19 | `electromenager` | Cuisine et bain › Électroménager |
| 20 | `bain` | Cuisine et bain › Bain |

## 2. `icones 4.png` — bar, buffet, lumière, déco, nature (5 × 4)

```
GRID: 5 columns, 4 rows (20 icons), left to right, top to bottom.
Row 1:
1. Bar: a cocktail glass next to a bottle.
2. Buffet: a serving dish with a domed cover (cloche).
3. Lamps: a small bedside lamp.
4. Floor lamps: a tall standing floor lamp.
5. Ceiling lights: a chandelier hanging from the top.
Row 2:
6. Wall lights: a wall sconce mounted on a vertical line.
7. Candles: two candles of different heights with flames.
8. Stage lights: a theater spotlight on a stand.
9. Decoration: a framed picture.
10. Books and papers: a stack of two books with a sheet of paper.
Row 3:
11. Tableware: a plate with a fork and a knife.
12. Food: a roast chicken leg next to an apple.
13. Musical instruments: a guitar.
14. Sound equipment: a loudspeaker and a microphone.
15. Clues: a magnifying glass over a footprint.
Row 4:
16. Weapons: a revolver.
17. Trees: a pine tree.
18. Plants: a potted plant with large leaves.
19. Rocks: a pile of three rocks.
20. Dead wood: a fallen log with a broken branch.
```

| Case | Fichier | Rayon |
|---|---|---|
| 1 | `bar` | Cuisine et bain › Bar |
| 2 | `buffet` | Cuisine et bain › Buffet |
| 3 | `lampes` | Lumière › Lampes |
| 4 | `lampadaires` | Lumière › Lampadaires |
| 5 | `plafonniers` | Lumière › Plafonniers |
| 6 | `appliques` | Lumière › Appliques |
| 7 | `bougies` | Lumière › Bougies |
| 8 | `projecteurs` | Lumière › Projecteurs |
| 9 | `decoration` | Déco et objets › Décoration |
| 10 | `livres-et-papiers` | Déco et objets › Livres et papiers |
| 11 | `vaisselle` | Déco et objets › Vaisselle |
| 12 | `nourriture` | Déco et objets › Nourriture |
| 13 | `instruments` | Déco et objets › Instruments |
| 14 | `sonorisation` | Déco et objets › Sonorisation |
| 15 | `indices` | Déco et objets › Indices |
| 16 | `armes` | Déco et objets › Armes |
| 17 | `arbres` | Nature › Arbres |
| 18 | `vegetation` | Nature › Végétation |
| 19 | `rochers` | Nature › Rochers |
| 20 | `bois-mort` | Nature › Bois mort |

## 3. `icones 5.png` — fin de la nature, architecture, extérieur, personnages (5 × 3)

```
GRID: 5 columns, 3 rows (15 icons), left to right, top to bottom.
Row 1:
1. Cobwebs: a spider web in a corner with a small spider.
2. Stairs: a staircase seen from the side.
3. Stage: a theater stage with open curtains.
4. Columns: two classical columns side by side.
5. Partitions: a section of wall with a doorway.
Row 2:
6. Road: a road with a dashed center line, in perspective.
7. Road markings: a pedestrian crossing (zebra stripes) seen in perspective.
8. Vehicles: a car seen from the side.
9. Street furniture: a park bench.
10. Back alley: a large trash dumpster with its lid.
Row 3:
11. Staff: a person wearing a waiter's bow tie, head and shoulders.
12. Guests: a person in a hat and coat, head and shoulders.
13. Crowd: three heads and shoulders, one in front of two.
14. Bodies: a body outline lying on the ground (crime scene chalk outline).
15. Bones: a skull and two crossed bones.
```

| Case | Fichier | Rayon |
|---|---|---|
| 1 | `toiles-d-araignees` | Nature › Toiles d'araignées |
| 2 | `escaliers` | Architecture › Escaliers |
| 3 | `scene` | Architecture › Scène |
| 4 | `colonnes` | Architecture › Colonnes |
| 5 | `cloisons` | Architecture › Cloisons |
| 6 | `voirie` | Extérieur › Voirie |
| 7 | `marquages` | Extérieur › Marquages |
| 8 | `vehicules` | Extérieur › Véhicules |
| 9 | `mobilier-urbain` | Extérieur › Mobilier urbain |
| 10 | `ruelle` | Extérieur › Ruelle |
| 11 | `personnel` | Personnages › Personnel |
| 12 | `invites` | Personnages › Invités |
| 13 | `public` | Personnages › Public |
| 14 | `corps` | Personnages › Corps |
| 15 | `ossements` | Personnages › Ossements |

## Notes

- Le nom de fichier est le nom du rayon passé par `slug()` (`Palette.tsx`) : c'est ainsi que
  la palette retrouve l'icône. Un rayon renommé perd son icône.
- Le blanc sur magenta se détoure bien ; vérifier seulement que les bords des traits fins
  ne gardent pas un liseré rose après la découpe.
- Les thèmes (Classique, Moderne, Restaurant, Concert, Enquête, Ville, Speakeasy, Macabre)
  sont dans une liste déroulante : pas d'icône.
