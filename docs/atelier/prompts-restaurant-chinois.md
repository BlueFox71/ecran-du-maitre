# Prompts — restaurant chinois

Cinq planches au format habituel : **1536 × 1024**, fond **magenta pur**. Range les PNG
dans `docs/atelier/planches/` (ou laisse-les dans Téléchargements) sous le nom indiqué.

Déjà au catalogue, donc absent ici : comptoir de bar, tabourets hauts, évier inox,
plan de travail, lanternes européennes, carrelage métro, terre cuite, marbre noir et or.

Les quatre planches d'objets partagent ce début de prompt :

```
Create ONE image, 1536x1024, a sprite sheet of separate assets for a top-down tabletop
RPG battle map of a family-run Chinese restaurant in a modern city (dining room and
kitchen).

BACKGROUND: solid pure magenta (#FF00FF) everywhere around the items. Never use magenta
or pink inside an item. Items do not touch or overlap; clear magenta space around each.

CAMERA AND STYLE: strictly orthographic, straight down (90°), no perspective, no
visible sides: we see only the TOP of each object. Realistic hand-painted digital art,
finely detailed, like premium battle map assets. Lived-in, slightly worn. Rich reds,
lacquered dark wood, gold accents, jade green, stainless steel in the kitchen. Flat even
lighting from directly above: NO cast shadows, NO glow. No text, no Chinese characters,
no letters, no logos, no labels, no grid, no characters/people.
```

## 1. `lot 34.png` — la salle (4 + 5 + 5)

Début commun, puis :

```
ITEMS, 3 rows, left to right:
Row 1 (4 items):
1. A large round banquet table with a red tablecloth and a lazy Susan turntable in the
   center, surrounded by 8 dark lacquered wooden chairs.
2. A buffet counter with a row of stainless steel chafing dishes, lids closed.
3. A booth: a rectangular table between two red padded bench seats.
4. A reception counter in red lacquered wood with gold trim, a cash register and a small
   golden lucky cat on top.
Row 2 (5 items):
5. A round table for four with a white tablecloth and 4 dark wooden chairs.
6. A small square table for two with 2 chairs.
7. A rectangular aquarium tank with live lobsters and crabs, seen from above through
   the water, bubbling.
8. A folding Chinese screen in red lacquer with gold painted landscape panels, zigzag.
9. A small red wall altar shelf with an incense burner, oranges and two small candles.
Row 3 (5 items):
10. A stone guardian lion statue on a square base.
11. A large blue-and-white porcelain floor vase.
12. A tall potted lucky bamboo plant in a glazed pot.
13. A dim sum trolley cart carrying stacked bamboo steamer baskets.
14. A dark wooden waiting bench with a red cushion.
```

| Case | id | Nom | Largeur (cases) | Bloque |
|---|---|---|---|---|
| 1 | `table-banquet` | Table de banquet (8 places) | 2,2 | P |
| 2 | `buffet-chauffe-plats` | Buffet à chauffe-plats | 1,6 | P |
| 3 | `box-banquettes` | Box à banquettes | 1,3 | P |
| 4 | `comptoir-accueil` | Comptoir d'accueil | 1,4 | P |
| 5 | `table-ronde-quatre` | Table ronde (4 places) | 1,4 | P |
| 6 | `table-carree-deux` | Table carrée (2 places) | 0,9 | P |
| 7 | `aquarium-homards` | Aquarium à homards | 1,2 | P |
| 8 | `paravent-laque` | Paravent laqué | 1,4 | P V |
| 9 | `autel` | Autel | 0,6 | P |
| 10 | `lion-gardien` | Lion gardien | 0,6 | P |
| 11 | `vase-porcelaine` | Vase de porcelaine | 0,4 | P |
| 12 | `bambou-pot` | Bambou en pot | 0,5 | P |
| 13 | `chariot-dim-sum` | Chariot à dim sum | 0,8 | P |
| 14 | `banc-attente` | Banc d'attente | 1,1 | P |

## 2. `lot 35.png` — la cuisine (4 + 5 + 5)

Début commun, puis :

```
ITEMS, 3 rows, left to right:
Row 1 (4 items):
1. A professional stainless steel wok range with three gas burners, a black wok on one.
2. A long stainless steel prep table with a thick round wooden chopping block and a
   cleaver on it.
3. A double-basin stainless steel commercial sink with a spray faucet.
4. A tall double-door stainless steel commercial fridge, seen from above (top only).
Row 2 (5 items):
5. A tower of stacked bamboo steamer baskets on a steaming pot.
6. A large commercial rice cooker, lid closed.
7. A stainless steel deep fryer with two baskets.
8. A huge stockpot of broth on a single gas burner.
9. A stainless steel wire shelf loaded with jars, sauces bottles and boxes, seen from above.
Row 3 (5 items):
10. Three glazed roast ducks hanging from hooks on a horizontal metal rod.
11. A stack of large rice sacks (plain white sacks, no print).
12. A crate of Chinese cabbages and green onions.
13. A kitchen trash bin full of scraps.
14. A rolling cart with stacked clean white bowls and plates.
```

| Case | id | Nom | Largeur (cases) | Bloque |
|---|---|---|---|---|
| 1 | `piano-woks` | Piano à woks | 1,6 | P |
| 2 | `table-preparation` | Table de préparation | 1,4 | P |
| 3 | `plonge` | Plonge double | 1,2 | P |
| 4 | `frigo-pro` | Frigo professionnel | 1 | P V |
| 5 | `paniers-vapeur` | Paniers vapeur | 0,5 | P |
| 6 | `cuiseur-riz` | Cuiseur à riz | 0,4 | P |
| 7 | `friteuse` | Friteuse | 0,5 | P |
| 8 | `marmite-bouillon` | Marmite de bouillon | 0,6 | P |
| 9 | `etagere-inox` | Étagère inox | 1,2 | P V |
| 10 | `canards-laques` | Canards laqués suspendus | 0,8 | — |
| 11 | `sacs-riz` | Sacs de riz | 0,8 | P |
| 12 | `cagette-legumes` | Cagette de légumes | 0,5 | — |
| 13 | `poubelle-cuisine` | Poubelle de cuisine | 0,4 | P |
| 14 | `chariot-vaisselle` | Chariot de vaisselle | 0,7 | P |

## 3. `lot 36.png` — sur les tables et la déco (5 × 3)

Début commun, puis :

```
ITEMS, 3 rows of 5, left to right:
Row 1:
1. A red paper lantern with gold bands and a tassel, seen from above (round).
2. A large round red silk lantern, seen from above.
3. A loaded lazy Susan turntable: several shared dishes, rice and sauces on it.
4. A whole Peking duck on an oval platter.
5. A bowl of white rice with chopsticks resting on it.
Row 2:
6. Three bamboo steamer baskets of dumplings, lids off.
7. A wok of stir-fried noodles with vegetables.
8. A clay teapot with four small tea cups on a tray.
9. A golden lucky cat figurine with a raised paw.
10. White takeaway boxes and a paper delivery bag.
Row 3:
11. Small dishes of soy sauce, chili oil and vinegar bottles.
12. A small plate of fortune cookies.
13. Three plain green beer bottles (no labels).
14. A bronze incense burner with smoking incense sticks.
15. A pair of red envelopes and a few coins (no characters).
```

| Case | id | Nom | Largeur (cases) | Bloque |
|---|---|---|---|---|
| 1 | `lanterne-papier` | Lanterne de papier | 0,4 | — |
| 2 | `lanterne-soie` | Grande lanterne de soie | 0,6 | — |
| 3 | `plateau-tournant` | Plateau tournant garni | 0,9 | — |
| 4 | `canard-laque` | Canard laqué | 0,4 | — |
| 5 | `bol-riz` | Bol de riz | 0,15 | — |
| 6 | `dim-sum` | Paniers de dim sum | 0,35 | — |
| 7 | `wok-nouilles` | Wok de nouilles | 0,4 | — |
| 8 | `service-the` | Service à thé | 0,3 | — |
| 9 | `chat-porte-bonheur` | Chat porte-bonheur | 0,15 | — |
| 10 | `boites-emporter` | Boîtes à emporter | 0,3 | — |
| 11 | `sauces` | Sauces | 0,2 | — |
| 12 | `biscuits-chinois` | Biscuits chinois | 0,15 | — |
| 13 | `bouteilles-biere` | Bouteilles de bière | 0,2 | — |
| 14 | `brule-encens` | Brûle-encens | 0,2 | — |
| 15 | `enveloppes-rouges` | Enveloppes rouges | 0,2 | — |

## 4. `sols 7.png` — sols du restaurant (4 × 2 tuiles)

```
Create ONE image, 1536x1024, a sprite sheet of 8 floor textures for a top-down
tabletop RPG battle map of a family-run Chinese restaurant in a modern city.

LAYOUT: 4 columns x 2 rows of equal SQUARE tiles, separated by thin gutters of solid
pure magenta (#FF00FF). Each tile is completely filled with its texture (no magenta,
no transparency inside a tile).

CAMERA AND STYLE: strictly orthographic, straight down (90°), no perspective. Realistic
hand-painted digital art, finely detailed, like premium battle map assets. Lived-in,
slightly worn. Flat, even, neutral lighting from directly above: NO cast shadows,
NO light pools, NO glow, NO vignette.

EVERY TILE: seamless tileable on both axes. Uniform coverage, no focal point, no single
large feature; small repeating patterns only. Same scale for all: one tile = about 3 x 3
metres. No text, no Chinese characters, no labels, no grid, no characters.

TILES, left to right, top to bottom:
1. Deep red restaurant carpet with a small repeating gold cloud pattern.
2. Burgundy carpet with a small repeating gold and jade geometric lattice pattern.
3. Dark red lacquered wooden floorboards, glossy, slightly worn.
4. Jade green terrazzo with small white and gold chips.
5. Red quarry tiles for a commercial kitchen, small squares, anti-slip texture.
6. Grey anti-slip commercial kitchen tiles, small squares, clean.
7. Greasy dirty commercial kitchen tiles, stained grout, oil spots spread evenly.
8. Beige and red small square tiles in a checkerboard.
```

| Case | id | Nom | Tuile (cases) | Brut |
|---|---|---|---|---|
| 1 | `moquette-nuages` | Moquette rouge aux nuages | 2 | |
| 2 | `moquette-treillis` | Moquette bordeaux à treillis | 2 | oui |
| 3 | `parquet-laque-rouge` | Parquet laqué rouge | 1,5 | oui |
| 4 | `terrazzo-jade` | Terrazzo jade | 2 | |
| 5 | `carrelage-cuisine-rouge` | Carrelage de cuisine rouge | 1,5 | oui |
| 6 | `carrelage-cuisine-gris` | Carrelage de cuisine gris | 1,5 | oui |
| 7 | `carrelage-cuisine-gras` | Carrelage de cuisine gras | 1,5 | oui |
| 8 | `damier-beige-rouge` | Damier beige et rouge | 1,5 | oui |

## 5. `murs 7.png` — murs du restaurant (4 bandes)

```
Create ONE image, 1536x1024, a sprite sheet of 4 wall textures for a top-down tabletop
RPG battle map of a family-run Chinese restaurant in a modern city.

LAYOUT: 4 long horizontal strips stacked vertically, each spanning the full width,
separated by gutters of solid pure magenta (#FF00FF). Each strip is completely filled.

EACH STRIP: the TOP of a thick wall seen from directly above, filling the strip.
Seamless tileable horizontally (left edge continues right edge), no focal point.
Realistic hand-painted digital art, flat even lighting from above, NO cast shadows.
No text, no Chinese characters, no labels.

STRIPS, top to bottom:
1. Red lacquered wooden wall with thin gold trim along both edges.
2. Dark red wallpaper wall with a small repeating gold pattern, dark wood cap.
3. White glazed tile wall of a commercial kitchen, slightly greasy.
4. Light bamboo panel wall, vertical bamboo canes bound together.
```

| Bande | id | Nom | Tuile (cases) |
|---|---|---|---|
| 1 | `mur-laque-rouge` | Laque rouge | 2,5 |
| 2 | `mur-papier-peint-rouge` | Papier peint rouge et or | 2,5 |
| 3 | `mur-faience-cuisine` | Faïence de cuisine | 2,5 |
| 4 | `mur-bambou` | Bambou | 2,5 |
