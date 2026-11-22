# Prompts — restaurant chinois moderne, buffet à volonté

Le Jardin de Jade version moderne : un buffet à volonté. Quatre planches au format habituel
(**1536 × 1024**, fond **magenta pur**). Elles complètent le pack « Restaurant » (plus
traditionnel, laque rouge) sans le remplacer.

Les deux planches d'objets partagent ce début de prompt :

```
Create ONE image, 1536x1024, a sprite sheet of separate assets for a top-down tabletop
RPG battle map of a very modern, upscale Chinese all-you-can-eat buffet restaurant.

BACKGROUND: solid pure magenta (#FF00FF) everywhere around the items. Never use magenta
or pink inside an item. Items do not touch or overlap; clear magenta space around each.

CAMERA AND STYLE: strictly orthographic, straight down (90°), no perspective, no
visible sides or fronts: we see only the TOP of each object. Realistic hand-painted
digital art, finely detailed, like premium battle map assets. Contemporary design:
clean lines, light oak, matte black, white marble, brushed stainless steel, glass
sneeze guards, thin brass accents, a few jade green and red touches. Clean and new.
Flat even lighting from directly above: NO cast shadows, NO glow. No text, no Chinese
characters, no letters, no logos, no labels, no grid, no characters/people.
```

## 1. `lot 38.png` — les buffets (3 + 4 + 5)

```
ITEMS, 3 rows, left to right. Buffet counters are long and lie HORIZONTALLY.
Row 1 (3 long buffet islands):
1. A long hot buffet island: two rows of rectangular stainless steel food pans under a
   glass sneeze guard, filled with fried rice, noodles, sweet and sour chicken, shrimp,
   vegetables, spring rolls; serving tongs and spoons.
2. A long cold seafood buffet: crushed ice bed with prawns, mussels, crab legs, oysters
   and lemon wedges, under a glass sneeze guard.
3. A long sushi and maki buffet counter: black slate trays with neat rows of sushi,
   maki and sashimi, small bowls of soy sauce, wasabi and ginger.
Row 2 (4 items):
4. A teppanyaki live cooking station: a counter with a large flat steel griddle in the
   middle and trays of raw meat, seafood and vegetables beside it.
5. A live wok station counter: two woks on burners, bowls of noodles and fresh
   ingredients in a row of small pans.
6. A dessert buffet: small cakes, mousse cups, fruit tarts, macarons and a chocolate
   fountain, on white marble.
7. A salad and fresh fruit bar: bowls of salads, sliced melon, pineapple, lychees and
   grapes in a refrigerated counter.
Row 3 (5 items):
8. A soup station: three round stainless soup kettles with ladles, a stack of bowls.
9. A dim sum station: stacked bamboo steamers on a heated stainless counter.
10. An ice cream chest freezer with a glass lid, colorful ice cream tubs inside, scoops.
11. A drink station: a soda fountain dispenser, an ice bin and a rack of glasses.
12. Two round heated plate dispensers side by side, full of clean white plates.
```

| Case | id | Nom | Largeur (cases) | Bloque |
|---|---|---|---|---|
| 1 | `buffet-chaud` | Îlot de buffet chaud | 3 | P |
| 2 | `buffet-fruits-de-mer` | Buffet de fruits de mer | 3 | P |
| 3 | `buffet-sushis` | Buffet de sushis | 3 | P |
| 4 | `station-teppanyaki` | Station teppanyaki | 2 | P |
| 5 | `station-wok` | Station wok | 2 | P |
| 6 | `buffet-desserts` | Buffet de desserts | 2 | P |
| 7 | `bar-salades-fruits` | Bar à salades et fruits | 2 | P |
| 8 | `station-soupes` | Station à soupes | 1,2 | P |
| 9 | `station-dim-sum` | Station à dim sum | 1,2 | P |
| 10 | `congelateur-glaces` | Congélateur à glaces | 1,2 | P |
| 11 | `station-boissons` | Station boissons | 1,2 | P |
| 12 | `distributeurs-assiettes` | Distributeurs d'assiettes | 0,9 | P |

## 2. `lot 39.png` — la salle moderne (4 + 5 + 5)

```
ITEMS, 3 rows, left to right:
Row 1 (4 items):
1. A modern booth: two grey upholstered bench seats facing each other around a light
   oak table set with plates, bowls and chopsticks.
2. A rectangular light oak table for six with matte black metal chairs, place settings.
3. A large round white marble table for eight with a glass lazy Susan in the center and
   modern upholstered chairs, place settings.
4. A modern reception desk: white with light oak top, a tablet register and a small
   jade plant.
Row 2 (5 items):
5. A square matte black table for four with light oak chairs, place settings.
6. A small round table for two with two modern chairs.
7. A high bar table with four tall stools.
8. A straight room divider of vertical light oak slats.
9. A long rectangular black planter with tall ornamental grasses.
Row 3 (5 items):
10. A cluster of three modern round pendant lamps, seen from above (matte black and brass).
11. A long linear LED pendant lamp in matte black.
12. A dirty dish trolley: grey bus tubs with used plates and bowls on a steel cart.
13. A self-order kiosk with a blank dark screen.
14. A tray return station: a steel counter with stacked trays and a dish rack.
```

| Case | id | Nom | Largeur (cases) | Bloque |
|---|---|---|---|---|
| 1 | `box-moderne` | Box moderne | 1,3 | P |
| 2 | `table-six-moderne` | Table pour six | 1,6 | P |
| 3 | `table-ronde-marbre` | Table ronde en marbre (8 places) | 2,2 | P |
| 4 | `accueil-moderne` | Accueil moderne | 1,4 | P |
| 5 | `table-noire-quatre` | Table noire (4 places) | 1,2 | P |
| 6 | `table-ronde-deux` | Table ronde (2 places) | 0,9 | P |
| 7 | `table-haute-tabourets` | Table haute et tabourets | 1 | P |
| 8 | `claustra-chene` | Claustra en chêne | 1,5 | P |
| 9 | `jardiniere-graminees` | Jardinière de graminées | 1,2 | P |
| 10 | `suspensions-trio` | Trio de suspensions | 0,8 | — |
| 11 | `suspension-lineaire` | Suspension linéaire | 1,2 | — |
| 12 | `chariot-debarrassage` | Chariot de débarrassage | 0,8 | P |
| 13 | `borne-commande` | Borne de commande | 0,4 | P |
| 14 | `retour-plateaux` | Retour des plateaux | 1,2 | P |

## 2 bis. `lot 40.png` — les décorations (5 × 3)

Prompt complet (il reprend le début commun) :

```
Create ONE image, 1536x1024, a sprite sheet of 15 separate decoration assets for a
top-down tabletop RPG battle map of a very modern, upscale Chinese all-you-can-eat
buffet restaurant.

BACKGROUND: solid pure magenta (#FF00FF) everywhere around the items. Never use magenta,
pink or purple inside an item (no pink flowers). Items do not touch or overlap; clear
magenta space around each.

CAMERA AND STYLE: strictly orthographic, straight down (90°), no perspective, no
visible sides or fronts: we see only the TOP of each object. Realistic hand-painted
digital art, finely detailed, like premium battle map assets. Contemporary Chinese
design: matte black, brass, white marble, light oak, jade green, deep red accents.
Clean and new. Flat even lighting from directly above: NO cast shadows, NO glow.
No text, no Chinese characters, no letters, no logos, no labels, no grid, no people.

ITEMS, 3 rows of 5, left to right:
Row 1:
1. A ceiling installation of many small red silk lanterns hanging in a tight grid,
   seen from above as a square cluster of round lanterns.
2. A large white minimalist paper drum lantern, seen from above (round).
3. A sculpted bonsai pine in a low square matte black pot.
4. White orchids arranged in a low round grey ceramic bowl with moss.
5. A golden coiled dragon sculpture on a round black stone plinth.
Row 2:
6. A rectangular zen garden: raked white gravel, three dark rocks, black frame.
7. A modern water feature: stacked smooth stones in a round black basin of water.
8. A large glazed ceramic fish bowl with water lilies and a few goldfish.
9. A small white plum blossom tree in a square concrete planter.
10. A jade money tree in a round brushed brass pot.
Row 3:
11. A round deep red rug with a minimalist gold cloud motif.
12. A long jade green runner rug with a thin gold border.
13. A glass display case with porcelain bowls, jade figurines and a tea set inside.
14. A stylized modern guardian lion statue in matte black, on a square base.
15. A table centerpiece: a small jade plant and two tealights on a slate plate.
```

| Case | id | Nom | Largeur (cases) | Bloque |
|---|---|---|---|---|
| 1 | `plafond-lanternes` | Plafond de lanternes | 1,5 | — |
| 2 | `lanterne-tambour` | Lanterne tambour blanche | 0,6 | — |
| 3 | `bonsai` | Bonsaï | 0,6 | P |
| 4 | `orchidees` | Coupe d'orchidées | 0,4 | — |
| 5 | `dragon-dore` | Dragon doré | 0,8 | P |
| 6 | `jardin-zen` | Jardin zen | 1,5 | P |
| 7 | `fontaine-galets` | Fontaine de galets | 0,8 | P |
| 8 | `vasque-poissons` | Vasque à poissons | 0,7 | P |
| 9 | `prunier-fleuri` | Prunier en fleurs | 0,8 | P |
| 10 | `arbre-jade` | Arbre de jade | 0,6 | P |
| 11 | `tapis-rond-nuages` | Tapis rond aux nuages | 2 | — |
| 12 | `tapis-couloir-jade` | Tapis de couloir jade | 3 | — |
| 13 | `vitrine-porcelaines` | Vitrine de porcelaines | 1,2 | P V |
| 14 | `lion-moderne` | Lion moderne | 0,6 | P |
| 15 | `centre-de-table` | Centre de table | 0,3 | — |

## 3. `sols 8.png` — sols modernes (4 × 2 tuiles)

```
Create ONE image, 1536x1024, a sprite sheet of 8 floor textures for a top-down
tabletop RPG battle map of a very modern, upscale Chinese all-you-can-eat buffet restaurant.

LAYOUT: 4 columns x 2 rows of equal SQUARE tiles, separated by thin gutters of solid
pure magenta (#FF00FF). Each tile is completely filled with its texture (no magenta,
no transparency inside a tile).

CAMERA AND STYLE: strictly orthographic, straight down (90°), no perspective. Realistic
hand-painted digital art, finely detailed, like premium battle map assets. Clean, new,
contemporary. Flat, even, neutral lighting from directly above: NO cast shadows,
NO light pools, NO glow, NO reflections of lamps, NO vignette.

EVERY TILE: seamless tileable on both axes. Uniform coverage, no focal point, no single
large feature. Same scale for all: one tile = about 3 x 3 metres. No text, no Chinese
characters, no labels, no grid, no characters.

TILES, left to right, top to bottom:
1. Large-format dark grey porcelain tiles (about 1 m squares), thin joints, matte.
2. Polished grey concrete floor, smooth, subtle mottling.
3. Wide light oak floorboards, matte natural finish.
4. Large white marble tiles with soft grey veins.
5. Small matte black hexagon tiles with thin light grout.
6. Warm beige large stone tiles, honed finish.
7. Dark smoked oak floorboards, matte.
8. Light grey modern carpet tiles with a subtle linear texture.
```

| Case | id | Nom | Tuile (cases) | Brut |
|---|---|---|---|---|
| 1 | `gres-anthracite` | Grès anthracite grand format | 2 | oui |
| 2 | `beton-cire` | Béton ciré | 2 | |
| 3 | `parquet-chene-large` | Parquet de chêne large | 1,5 | oui |
| 4 | `marbre-grand-format` | Marbre blanc grand format | 2 | oui |
| 5 | `hexagones-noirs` | Hexagones noirs | 1 | oui |
| 6 | `pierre-beige` | Pierre beige | 2 | oui |
| 7 | `parquet-chene-fume` | Parquet de chêne fumé | 1,5 | oui |
| 8 | `dalles-moquette` | Dalles de moquette grise | 2 | oui |

## 4. `murs 8.png` — murs modernes (4 bandes)

```
Create ONE image, 1536x1024, a sprite sheet of 4 wall textures for a top-down tabletop
RPG battle map of a very modern, upscale Chinese all-you-can-eat buffet restaurant.

LAYOUT: 4 long horizontal strips stacked vertically, each spanning the full width,
separated by gutters of solid pure magenta (#FF00FF). Each strip is completely filled.

EACH STRIP: the TOP of a thick wall seen from directly above, filling the strip.
Seamless tileable horizontally (left edge continues right edge), no focal point.
Realistic hand-painted digital art, clean and new, flat even lighting from above,
NO cast shadows. No text, no Chinese characters, no labels.

STRIPS, top to bottom:
1. Wall clad with vertical light oak slats.
2. Matte black wall panels with thin brass lines.
3. Deep jade green painted wall with a thin brass trim.
4. White marble wall cladding with soft grey veins.
```

| Bande | id | Nom | Tuile (cases) |
|---|---|---|---|
| 1 | `mur-tasseaux-chene` | Tasseaux de chêne | 2,5 |
| 2 | `mur-noir-laiton` | Panneaux noirs et laiton | 2,5 |
| 3 | `mur-vert-jade` | Vert jade | 2,5 |
| 4 | `mur-marbre-blanc` | Marbre blanc | 2,5 |
