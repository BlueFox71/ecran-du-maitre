# Prompts — extérieur urbain (rue, trottoir, parking)

Pour la séance « restaurant chinois ». Trois planches au format habituel : **1536 × 1024**,
fond **magenta pur**, une grille de cases. Une planche par conversation ChatGPT (ou à la
suite, en rappelant les règles si ça dérive). Range les PNG dans `docs/atelier/planches/`
sous le nom indiqué ; les entrées de `outils/atelier/decouper.ts` se font ensuite.

Déjà au catalogue, donc absent ici : béton lisse, béton brut, béton fissuré, pavés
(mousse, herbe), gravier, tôle larmée, caillebotis.

## 1. `sols 6.png` — rue et béton (4 × 3 tuiles)

```
Create ONE image, 1536x1024, a sprite sheet of 12 floor textures for a top-down
tabletop RPG battle map of a modern city street (Chinatown, around a Chinese restaurant).

LAYOUT: 4 columns x 3 rows of equal SQUARE tiles, separated by thin gutters of solid
pure magenta (#FF00FF). Each tile is completely filled with its texture (no magenta,
no transparency inside a tile).

CAMERA AND STYLE: strictly orthographic, straight down (90°), no perspective. Realistic
hand-painted digital art, finely detailed, like premium battle map assets. Slightly
worn, urban, lived-in. Flat, even, neutral lighting from directly above: NO cast
shadows, NO light pools, NO glow, NO vignette.

EVERY TILE: seamless tileable on both axes (left edge continues right edge, top edge
continues bottom edge). Uniform coverage, no focal point, no single large feature,
nothing that would look repeated. Same scale for all tiles: one tile = about 3 x 3 metres.
No text, no road markings, no labels, no grid, no characters.

TILES, left to right, top to bottom:
1. Fresh dark asphalt, fine even grain.
2. Old grey asphalt, faded, with thin cracks and small repaired patches.
3. Wet dark asphalt after rain, glossy, with many small shallow puddles evenly spread.
4. Grey square concrete sidewalk slabs, about 50 cm each, thin joints, a few stains.
5. Broom-finished poured concrete sidewalk, large panels with straight expansion joints.
6. Grey interlocking concrete paving bricks in a herringbone pattern.
7. Parking lot concrete, light grey, with dark oil stains and tire marks spread evenly.
8. Asphalt with darker rectangular patch repairs and sealed crack lines.
9. Yellow tactile paving for the blind: rows of raised round dots.
10. Exposed-aggregate concrete: small round pebbles set in cement.
11. Old dark granite setts (cobblestones) in rows, like an old city street.
12. Dirty back-alley concrete: grime, damp stains, cigarette butts and scraps of paper.
```

| Case | id | Nom | Tuile (cases) |
|---|---|---|---|
| 1 | `asphalte-neuf` | Asphalte neuf | 2 |
| 2 | `asphalte-use` | Asphalte usé | 2 |
| 3 | `asphalte-mouille` | Asphalte mouillé | 2 |
| 4 | `dalles-trottoir` | Dalles de trottoir | 2 |
| 5 | `trottoir-beton` | Trottoir en béton | 2 |
| 6 | `paves-autobloquants` | Pavés autobloquants | 2 |
| 7 | `beton-parking` | Béton de parking | 2 |
| 8 | `asphalte-rapiece` | Asphalte rapiécé | 2 |
| 9 | `bande-podotactile` | Bande podotactile | 1 |
| 10 | `beton-desactive` | Béton désactivé | 2 |
| 11 | `paves-granit` | Pavés de granit | 2 |
| 12 | `beton-ruelle` | Béton de ruelle | 2 |

## 2. `lot 32.png` — voirie : bordures et marquages (4 + 5 + 5)

```
Create ONE image, 1536x1024, a sprite sheet of 14 separate assets for a top-down
tabletop RPG battle map of a modern city street (Chinatown, around a Chinese restaurant).

BACKGROUND: solid pure magenta (#FF00FF) everywhere around the items. Never use magenta
or pink inside an item. Items do not touch or overlap; clear magenta space around each.

CAMERA AND STYLE: strictly orthographic, straight down (90°), no perspective, no
visible sides. Realistic hand-painted digital art, finely detailed, like premium battle
map assets. Slightly worn and dirty. Flat even lighting from directly above: NO cast
shadows, NO glow. No text, no letters, no labels, no grid, no characters.

ROAD PAINT ITEMS (markings) are only the worn white or yellow paint itself, slightly
chipped, with NO asphalt around them: just the painted shapes on the magenta.

ITEMS, 3 rows, left to right:
Row 1 (4 items):
1. A straight grey concrete curb segment, long horizontal strip, worn edge.
2. A curved concrete curb corner (quarter circle), for a street corner.
3. A lowered curb ramp (driveway cut) segment, horizontal, with sloped middle.
4. A rectangular cast-iron storm drain grate set in a concrete frame.
Row 2 (5 items):
5. A pedestrian zebra crossing: five thick parallel white paint stripes, as one block.
6. A parking space outline: white painted U shape (two long sides and one short end).
7. A white painted straight-ahead arrow, pointing up.
8. A white painted turn arrow (straight and right).
9. A white painted wheelchair (disabled parking) pictogram, no text.
Row 3 (5 items):
10. A dashed white center-line: three dashes in a horizontal row.
11. A double solid yellow line segment, horizontal.
12. A round cast-iron manhole cover with a relief pattern.
13. A large dark oil stain on the ground, irregular, semi-transparent edges.
14. A pothole: broken asphalt hole with crumbled edges and loose gravel.
```

| Case | id | Nom | Largeur (cases) | Bloque |
|---|---|---|---|---|
| 1 | `bordure-trottoir` | Bordure de trottoir | 2 | — |
| 2 | `bordure-angle` | Bordure d'angle | 1,5 | — |
| 3 | `bateau-trottoir` | Bateau (trottoir abaissé) | 2 | — |
| 4 | `grille-egout` | Grille d'égout | 0,6 | — |
| 5 | `passage-pieton` | Passage piéton | 2,5 | — |
| 6 | `place-parking` | Place de parking | 1,7 | — |
| 7 | `fleche-tout-droit` | Flèche tout droit | 0,6 | — |
| 8 | `fleche-tourner` | Flèche tourner | 0,9 | — |
| 9 | `logo-handicape` | Pictogramme handicapé | 0,9 | — |
| 10 | `ligne-discontinue` | Ligne discontinue | 3 | — |
| 11 | `double-ligne-jaune` | Double ligne jaune | 2 | — |
| 12 | `plaque-egout` | Plaque d'égout | 0,5 | — |
| 13 | `tache-huile` | Tache d'huile | 1 | — |
| 14 | `nid-de-poule` | Nid-de-poule | 0,8 | — |

## 3. `lot 33.png` — véhicules et mobilier urbain (4 + 5 + 5)

```
Create ONE image, 1536x1024, a sprite sheet of 14 separate assets for a top-down
tabletop RPG battle map of a modern city street (Chinatown, around a Chinese restaurant).

BACKGROUND: solid pure magenta (#FF00FF) everywhere around the items. Never use magenta
or pink inside an item. Items do not touch or overlap; clear magenta space around each.

CAMERA AND STYLE: strictly orthographic, straight down (90°), no perspective: we see
only the ROOF / TOP of each object. Realistic hand-painted digital art, finely detailed,
like premium battle map assets. Slightly worn, urban. Flat even lighting from directly
above: NO cast shadows, NO glow, NO headlight beams. No text, no letters, no logos,
no license plates, no labels, no grid, no characters.

ITEMS, 3 rows, left to right:
Row 1 (4 items, vehicles lying HORIZONTALLY, front pointing right):
1. A dark grey four-door sedan car, roof and windshield seen from above.
2. A small red city car (hatchback).
3. A white delivery van, slightly dirty.
4. A black scooter / moped.
Row 2 (5 items):
5. A street lamp seen from above: the lamp head on a short arm, pole base round.
6. A short metal bollard (round top).
7. A green street trash bin with a lid.
8. A wooden-slat public bench with metal frame.
9. A large green rolling dumpster with a closed plastic lid (restaurant back alley).
Row 3 (5 items):
10. A red fire hydrant.
11. A parking pay machine (pay station), seen from above.
12. A bicycle parked in a metal hoop rack.
13. An orange traffic cone.
14. A stack of flattened cardboard boxes and crates (restaurant deliveries).
```

| Case | id | Nom | Largeur (cases) | Bloque |
|---|---|---|---|---|
| 1 | `voiture-berline` | Berline | 3 | P |
| 2 | `voiture-citadine` | Citadine | 2,5 | P |
| 3 | `camionnette` | Camionnette | 3,6 | P V |
| 4 | `scooter` | Scooter | 1,2 | P |
| 5 | `lampadaire` | Lampadaire | 0,8 | — |
| 6 | `potelet` | Potelet | 0,15 | — |
| 7 | `poubelle-rue` | Poubelle de rue | 0,4 | P |
| 8 | `banc-public` | Banc public | 1,2 | P |
| 9 | `conteneur-ordures` | Conteneur à ordures | 1,3 | P |
| 10 | `bouche-incendie` | Bouche d'incendie | 0,3 | — |
| 11 | `horodateur` | Horodateur | 0,3 | P |
| 12 | `velo-arceau` | Vélo à l'arceau | 1,2 | P |
| 13 | `cone` | Cône de chantier | 0,3 | — |
| 14 | `cartons` | Cartons empilés | 0,8 | P |
