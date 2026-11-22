# Prompts — Jardin de Jade la nuit : grand buffet, wok, bar et décor

Deuxième passe sur le rez-de-chaussée du Jardin de Jade (séance 5) : 200 couverts, deux
longues lignes de buffet accessibles des deux côtés, un vrai stand wok, un grand bar,
des paravents, deux statues. Les enquêteurs y viennent **restaurant fermé** : le buffet
est vidé et nettoyé. Il ne reste que ce qui passe la nuit dehors (bonbons en bocaux,
glaces dans le bahut fermé, condiments, chips de crevettes, biscuits de fortune).

Deux planches au format habituel (**1536 × 1024**, fond **magenta pur**). Elles
complètent `prompts-buffet-moderne.md` (même style : chêne clair, noir mat, marbre blanc,
inox, laiton).

## Principe des lignes de buffet : des modules

Un buffet d'un seul tenant sur toute la longueur ne tiendrait pas sur une planche, et
ChatGPT ne le dessinerait pas net. On génère donc des **modules** de même gabarit
(2 cases de long × 1,2 de profondeur, soit 3 m × 1,8 m) qu'on aligne bout à bout dans
l'atelier. Chaque module est **double face** : la vitre de protection court au milieu et
on se sert des deux côtés. Deux **embouts** arrondis ferment chaque ligne.

Les 12 modules gardent la trace du parcours (froid → japonais → fritures et vapeurs →
chaud → desserts → glaces et bonbons) même vides : bacs réfrigérés, ardoises à sushis,
lampes chauffantes, paniers vapeur, bains-marie, présentoirs à desserts. On peut répéter
un module (les bains-marie surtout) pour allonger une ligne.

## 1. `lot 41.png` — les lignes de buffet, fermées pour la nuit (5 + 5 + 4)

```
Create ONE image, 1536x1024, a sprite sheet of separate assets for a top-down tabletop
RPG battle map of a very modern, upscale Chinese all-you-can-eat buffet restaurant in
France, AT NIGHT AFTER CLOSING: the buffet has been emptied and cleaned, no cooked food
is left out.

BACKGROUND: solid pure magenta (#FF00FF) everywhere around the items. Never use magenta,
pink or purple inside an item (no pink candy). Items do not touch or overlap; clear
magenta space around each.

CAMERA AND STYLE: strictly orthographic, straight down (90°), no perspective, no
visible sides or fronts: we see only the TOP of each object. Realistic hand-painted
digital art, finely detailed, like premium battle map assets. Contemporary design:
white marble and brushed stainless steel counters, light oak trim, matte black, thin
brass accents. Clean, wiped, shiny. Flat even lighting from directly above: NO cast
shadows, NO glow, lamps switched off. No text, no Chinese characters, no letters, no
logos, no labels, no price tags, no grid, no characters/people.

BUFFET MODULES (items 1 to 12): every module is a section of one very long,
DOUBLE-SIDED buffet counter, lying HORIZONTALLY. All 12 modules have EXACTLY the same
size and proportions (length = 1.67 x depth) and the same frame: a stainless steel
counter with a thin white marble rim along both long edges, and a narrow glass sneeze
guard running along the CENTER LINE over the whole length. Customers serve themselves
from BOTH long sides, so trays and equipment are laid out in TWO MIRRORED ROWS, one on
each side of the glass. The left and right ends of each module are cut perfectly
STRAIGHT and open, like a piece of a longer counter, so modules line up end to end
without a gap. Each module must still be recognisable by its equipment.

ITEMS, left to right:
Row 1 (5 modules, cold and Japanese, all EMPTY):
1. Refrigerated salad counter: two rows of empty, clean steel gastronorm trays, a few
   empty glass bowls stacked upside down.
2. Cold seafood counter: a long recessed steel ice bed, now dry and empty, drain holes
   visible, a stack of empty shell bowls.
3. Sushi counter: empty black slate trays in two rows, a few stacked at one end, rolled
   bamboo mats.
4. Fried food counter: a row of round infrared heat lamps (switched off, matte black
   shades) over empty perforated steel trays.
5. Dim sum counter: many stacked round bamboo steamers with their lids CLOSED, on a
   heated steel counter.
Row 2 (5 modules, hot and sweet, all EMPTY except as described):
6. Hot bain-marie counter: two rows of rectangular steel food wells with their hinged
   steel lids CLOSED.
7. Hot bain-marie counter with the pans REMOVED: two rows of open, empty rectangular
   wells, a little water at the bottom, ladles hanging on a rail.
8. Dessert counter: empty white tiered cake stands and empty glass cloches, a stack of
   small white plates.
9. Fruit counter: refrigerated, empty clean steel trays and empty glass bowls stacked.
10. Ice cream cabinet: a refrigerated chest with its sliding glass lid CLOSED and a
    small brass padlock; through the frosted glass, two rows of large ice cream tubs
    with their covers on (vanilla, chocolate, pistachio, mango, matcha green); beside
    it a wafer cone dispenser and a stack of paper cups.
Row 3 (2 modules, then 2 end caps):
11. Candy bar, still FULL: rows of large clear jars with closed lids full of white
    marshmallows, gummy crocodiles, black licorice, colorful jelly beans, sour candy
    strips; small plastic tongs and paper bags.
12. Condiments and dry snacks: bottles of soy sauce (sweet and salty) and chili sauce,
    jars of sesame seeds, salt and pepper mills, a box of sugar sticks and tea bags, a
    large closed dispenser full of white prawn crackers, a bowl of individually wrapped
    fortune cookies.
13. LEFT end cap of the buffet, same depth as the modules: a half-rounded counter end
    (round side on the LEFT, straight cut on the RIGHT) with two round plate
    dispensers covered by a cloth and a tray of wrapped chopsticks.
14. RIGHT end cap of the buffet, same depth: a half-rounded counter end (straight cut
    on the LEFT, round side on the RIGHT) with stacks of small dessert bowls and a
    bonsai.
```

| Case | id | Nom | Largeur (cases) | Bloque |
|---|---|---|---|---|
| 1 | `buffet-vide-froid` | Buffet fermé : bacs réfrigérés | 2 | P |
| 2 | `buffet-vide-glace` | Buffet fermé : banc à glace | 2 | P |
| 3 | `buffet-vide-sushis` | Buffet fermé : ardoises à sushis | 2 | P |
| 4 | `buffet-vide-lampes` | Buffet fermé : lampes chauffantes | 2 | P |
| 5 | `buffet-vide-vapeur` | Buffet fermé : paniers vapeur | 2 | P |
| 6 | `buffet-vide-bain-marie` | Buffet fermé : bains-marie fermés | 2 | P |
| 7 | `buffet-vide-bacs-retires` | Buffet fermé : bacs retirés | 2 | P |
| 8 | `buffet-vide-desserts` | Buffet fermé : présentoirs à desserts | 2 | P |
| 9 | `buffet-vide-fruits` | Buffet fermé : fruits | 2 | P |
| 10 | `buffet-glaces-cadenas` | Buffet : bahut à glaces cadenassé | 2 | P |
| 11 | `buffet-bonbons` | Buffet : bar à bonbons | 2 | P |
| 12 | `buffet-condiments` | Buffet : condiments et chips | 2 | P |
| 13 | `buffet-embout-gauche` | Buffet : embout gauche (assiettes) | 0,8 | P |
| 14 | `buffet-embout-droit` | Buffet : embout droit | 0,8 | P |

## 2. `lot 42.png` — wok, bar, paravents, statues, sas (5 × 3)

```
Create ONE image, 1536x1024, a sprite sheet of 15 separate assets for a top-down
tabletop RPG battle map of a very modern, upscale Chinese all-you-can-eat buffet
restaurant, AT NIGHT AFTER CLOSING: everything is cleaned and tidied, no food left out.

BACKGROUND: solid pure magenta (#FF00FF) everywhere around the items. Never use magenta,
pink or purple inside an item. Items do not touch or overlap; clear magenta space
around each.

CAMERA AND STYLE: strictly orthographic, straight down (90°), no perspective, no
visible sides or fronts: we see only the TOP of each object. Realistic hand-painted
digital art, finely detailed, like premium battle map assets. Contemporary Chinese
design: matte black, brass, white marble, light oak, brushed stainless steel, jade
green and deep red accents. Clean and new. Flat even lighting from directly above:
NO cast shadows, NO glow. No text, no Chinese characters, no letters, no logos, no
labels, no grid, no characters/people.

ITEMS, 3 rows of 5, left to right:
Row 1 (live wok station, long counters lying HORIZONTALLY, closed for the night):
1. A long refrigerated raw ingredients counter for customers: a row of empty, clean
   steel trays set in the counter, a stack of empty white bowls at one end.
2. A sauce bar counter: a row of small steel pots with their lids closed and ladles
   resting beside them, a few bottles of soy sauce and chili oil.
3. A large live cooking line for the chef: a long steel counter with a big flat
   teppanyaki griddle, scraped clean, on the left and three large clean woks upside
   down on cold gas burners on the right, steel spatulas hanging on a rail.
4. A pick-up counter: a short empty steel shelf with a small bell.
5. A modern bar stool, round black leather seat with a brass ring (single).
Row 2 (large cocktail and drinks bar):
6. A long straight bar counter: dark marble top on the customer side, and on the
   bartender side a lower stainless workstation with two sinks, an empty ice well, a
   speed rail of bottles, a cutting board, clean glasses upside down on racks.
7. The matching CORNER piece of the same bar counter (L-shaped, same depth, same
   materials, workstation on the inner side).
8. A back bar work counter against the wall: stainless top with an espresso machine,
   a tea brewer, a blender, a glass washer with its door closed, rows of clean
   glasses and cups.
9. A second back bar work counter: three beer taps over a dry drip tray, a small
   fridge with glass doors showing bottles, a shelf of liquor bottles along the wall.
10. A cash register and payment counter end: light oak top, a tablet register, a card
    terminal, a bowl of wrapped fortune cookies.
Row 3 (decor and partitions):
11. A large seated Asian Buddhist monk statue in dark weathered bronze, meditating
    cross-legged, hands in the lap, shaved head, folded robe, on a square black stone
    plinth (top view: head, shoulders, knees and plinth).
12. A large sitting cat statue in white and gold glazed ceramic, one paw raised, on a
    round black plinth (top view: head, ears, raised paw, curled tail).
13. A modern folding screen in four panels, matte black frames with translucent rice
    paper and a thin painted bamboo pattern, zigzag shape seen from above.
14. A straight partition screen of dark wood lattice with a jade green fabric panel,
    on two small feet.
15. A large rectangular entrance doormat, dark grey ribbed fibre with a thin brass
    border.
```

| Case | id | Nom | Largeur (cases) | Bloque |
|---|---|---|---|---|
| 1 | `wok-ingredients-crus` | Wok : comptoir d'ingrédients | 3 | P |
| 2 | `wok-bar-sauces` | Wok : bar à sauces | 2 | P |
| 3 | `wok-ligne-cuisson` | Wok : plancha et woks | 3 | P |
| 4 | `wok-passe` | Wok : passe | 1,2 | P |
| 5 | `tabouret-bar-moderne` | Tabouret de bar moderne | 0,3 | — |
| 6 | `bar-comptoir-long` | Grand comptoir de bar | 3 | P |
| 7 | `bar-comptoir-angle` | Angle du grand comptoir | 1,5 | P |
| 8 | `bar-arriere-cafe` | Arrière-bar : café et verres | 2 | P |
| 9 | `bar-arriere-pression` | Arrière-bar : pression et bouteilles | 2 | P |
| 10 | `bar-caisse` | Bout de comptoir caisse | 1,2 | P |
| 11 | `statue-moine` | Statue de moine | 1 | P |
| 12 | `statue-chat` | Statue de chat | 0,8 | P |
| 13 | `paravent-riz` | Paravent papier de riz | 1,5 | P V |
| 14 | `paravent-jade` | Paravent treillis jade | 1,4 | P V |
| 15 | `tapis-entree` | Tapis d'entrée | 1,5 | — |

## Ce qui existe déjà et servira au plan

- **Parking** : sol `beton-parking`, marquage `place-parking`, `voiture-berline`,
  `voiture-citadine`, bordures et mobilier urbain (`lot 32`, `lot 33`).
- **Sas d'entrée** : c'est de la structure (deux portes et une petite pièce), avec les
  portes existantes (`porte-automatique`, `porte-verre-depoli`, `porte-double`).
- **Salle** : tables, box, claustras, suspensions des lots 38 à 40.

## 3. `lot 43.png` — le bar à bonbons, en grand (3 + 3)

Le module bonbons du `lot 41` est un peu pauvre : trois modules de plus, un par famille
(incontournables, acides, réglisses et pâtes), et un mur de distributeurs. Même gabarit
que les modules déjà découpés (profondeur 1,4 case).

⚠ Le détourage enlève le rose (trop proche du magenta) : les fraises Tagada passent en
**rouge framboise**, les guimauves torsadées en **blanc et rouge**, pas de Dragibus roses.

```
Create ONE image, 1536x1024, a sprite sheet of 6 separate assets for a top-down tabletop
RPG battle map of a very modern Chinese all-you-can-eat buffet restaurant in France, AT
NIGHT AFTER CLOSING (the candy bar stays full, jars closed).

BACKGROUND: solid pure magenta (#FF00FF) everywhere around the items. ABSOLUTELY NO
pink, magenta, purple or violet anywhere inside an item: every candy that is usually
pink must be raspberry RED instead. Items do not touch or overlap; leave at least 30
pixels of clear magenta between items.

CAMERA AND STYLE: strictly orthographic, straight down (90°), no perspective, no
visible sides or fronts: we see only the TOP of each object (round jar lids and the
candies seen through the clear lids). Realistic hand-painted digital art, finely
detailed, like premium battle map assets. White marble and brushed stainless steel,
thin brass accents. Flat even lighting from directly above: NO cast shadows, NO glow.
No text, no letters, no logos, no labels, no grid, no people.

CANDY MODULES (items 1 to 3): each is a section of a long DOUBLE-SIDED buffet counter
lying HORIZONTALLY, all three EXACTLY the same size: length = 1.2 x depth. Stainless
steel counter with a thin white marble rim along both long edges and a narrow glass
sneeze guard with brass ends along the CENTER LINE. Two MIRRORED rows of large clear
candy jars with closed steel lids, one row on each side of the glass, plus small
plastic tongs. Left and right ends cut perfectly STRAIGHT and open, so modules line up
end to end. Packed and colorful.

ITEMS:
Row 1 (3 candy modules):
1. The classics, 6 jars per row: raspberry red sugar-coated strawberry marshmallow
   candies, big white and red twisted marshmallows, multicolor gummy crocodiles (red,
   green, yellow, orange), brown and clear gummy cola bottles, small translucent gold
   gummy bears, small shiny round jelly beans (black, green, yellow, blue, red).
2. The sour candies, 5 jars per row: rainbow sour belts covered in white sour sugar,
   sour gummy rings (orange, green, brown) dusted with sugar, sugar-coated sour
   pacifier candies, two-color sour gummy worms, fizzy cola bottles covered in sugar.
3. Licorice and soft candies, 5 jars per row: black licorice spiral wheels, small
   black licorice tubes filled with yellow, green and white paste, soft yellow banana
   candies, gummy fried eggs (white with a yellow center), small blue and white gummy
   candies.
Row 2:
4. A candy wall against a wall: a long white and brass shelf unit with two rows of
   clear gravity dispenser bins (lever at the bottom) full of colorful candies, seen
   from above, the wall side at the top.
5. A small square counter with a stack of paper candy bags, a scale and a dispenser of
   plastic tongs.
6. A short single-sided candy counter end, half-rounded on the RIGHT side and cut
   straight on the LEFT, same depth as the modules, with three big jars of candies.
```

| Case | id | Nom | Largeur (cases) | Bloque |
|---|---|---|---|---|
| 1 | `bonbons-classiques` | Bonbons : les incontournables | 1,7 | P |
| 2 | `bonbons-acides` | Bonbons : les acides | 1,7 | P |
| 3 | `bonbons-reglisses` | Bonbons : réglisses et pâtes | 1,7 | P |
| 4 | `bonbons-mur-distributeurs` | Mur de distributeurs de bonbons | 3 | P |
| 5 | `bonbons-sachets` | Comptoir à sachets | 0,8 | P |
| 6 | `bonbons-embout` | Bonbons : embout | 1,7 | P |

## 4. `lot 44.png` — plafonds, escalier ancien, bureau, toilettes (5 × 4)

Après la première version du plan : la déco du plafond est le point fort d'un restaurant
chinois, il en faut beaucoup plus ; les suspensions linéaires du buffet montraient leurs
câbles ; l'escalier caché ne faisait pas ancien ; le bureau de Liu et les toilettes
manquaient de meubles.

```
Create ONE image, 1536x1024, a sprite sheet of 20 separate assets for a top-down tabletop
RPG battle map of a very modern, upscale Chinese all-you-can-eat buffet restaurant.

BACKGROUND: solid pure magenta (#FF00FF) everywhere around the items. ABSOLUTELY NO
pink, magenta, purple or violet inside an item (blossoms are WHITE). Items do not touch
or overlap; leave at least 30 pixels of clear magenta between items.

CAMERA AND STYLE: strictly orthographic, straight down (90°), no perspective, no
visible sides or fronts: we see only the TOP of each object. Realistic hand-painted
digital art, finely detailed, like premium battle map assets. Flat even lighting from
directly above: NO cast shadows, NO glow. No text, no Chinese characters, no letters,
no logos, no labels, no grid, no people.

CEILING ITEMS (1 to 9) are seen from directly below the ceiling plane, as if looking
down on them: show ONLY the lamp or decoration itself, NO cables, NO wires, NO chains,
NO hanging rods, NO ceiling mounts.

ITEMS, 4 rows of 5, left to right:
Row 1 (Chinese ceiling decorations):
1. A long Chinese dragon made of red and gold silk, its body undulating in an S shape
   along the whole length, with small round red lanterns along its back (very long and
   thin, lying horizontally).
2. A large round red silk palace lantern with gold ribs and a gold top cap, seen from
   above (round).
3. A straight row of five round red lanterns with gold caps, evenly spaced, touching
   nothing, lying horizontally.
4. A hexagonal Chinese palace lantern in dark lacquered wood with six painted glass
   panels (landscapes, green and gold) and red tassels, seen from above.
5. A cluster of seven open red and gold oil-paper umbrellas, seen from above, tightly
   grouped in a circle.
Row 2 (more ceiling decoration and modern lights):
6. A large round carved dark wood ceiling ring with eight small red lanterns evenly
   spaced around it.
7. A cluster of white blossoming plum branches with a few tiny gold lanterns among them,
   seen from above, roughly oval.
8. A square ceiling of red silk ribbons and gold knots stretched in a star pattern from
   a central gold medallion.
9. A long modern flush ceiling light panel, matte black frame with a warm white
   diffuser, NO cables (long thin rectangle lying horizontally).
10. A short flush ceiling bar of three round brass spotlights in a row, NO cables.
Row 3 (old hidden staircase, and Liu's office):
11. A very old, narrow wooden staircase going down, seen from above: worn grey wood
    steps, cracked and dusty, one broken step, cobwebs in the corners, a rickety wooden
    handrail on one side, the lower steps disappearing into darkness at the bottom.
12. An office desk with two computer monitors, a keyboard, a mouse, scattered papers
    and a mug, and a black office swivel chair.
13. A large standalone office laser printer and copier, light grey, with a paper tray.
14. A grey metal filing cabinet with four drawers, the top drawer slightly open showing
    folders.
15. A low wooden office shelf unit with rows of colored binders and archive boxes.
Row 4 (restrooms):
16. A wheelchair-accessible toilet: a white toilet with steel grab bars on the side and
    behind, a small sink beside it.
17. Two white wall urinals side by side, separated by a small frosted glass divider.
18. A long double vanity: a white quartz counter with two round white basins, two
    faucets and a wall-mounted hand dryer at the end.
19. A small fold-down baby changing table with a padded white mat.
20. A modern standalone office cabinet, light oak and white, with two doors and a plant
    on top.
```

| Case | id | Nom | Largeur (cases) | Bloque |
|---|---|---|---|---|
| 1 | `plafond-dragon-soie` | Dragon de soie au plafond | 4 | — |
| 2 | `lanterne-palais-rouge` | Grande lanterne de palais | 1 | — |
| 3 | `rangee-lanternes` | Rangée de cinq lanternes | 2,5 | — |
| 4 | `lanterne-hexagonale` | Lanterne hexagonale peinte | 0,8 | — |
| 5 | `plafond-ombrelles` | Ombrelles suspendues | 1,8 | — |
| 6 | `couronne-lanternes` | Couronne de lanternes | 1,8 | — |
| 7 | `branches-prunier` | Branches de prunier suspendues | 1,6 | — |
| 8 | `plafond-rubans` | Rubans de soie au plafond | 2 | — |
| 9 | `plafonnier-lineaire` | Plafonnier linéaire | 1,5 | — |
| 10 | `spots-laiton` | Rampe de trois spots | 0,8 | — |
| 11 | `escalier-ancien` | Vieil escalier en bois | 1 | — |
| 12 | `bureau-deux-ecrans` | Bureau à deux écrans | 1,2 | P |
| 13 | `imprimante-bureau` | Imprimante de bureau | 0,7 | P |
| 14 | `classeur-metal` | Classeur métallique | 0,5 | P |
| 15 | `etagere-classeurs` | Étagère à classeurs | 1,2 | P |
| 16 | `toilettes-pmr` | Toilettes accessibles | 1 | P |
| 17 | `urinoirs` | Urinoirs | 1 | P |
| 18 | `vasques-toilettes` | Double vasque des toilettes | 1,5 | P |
| 19 | `table-a-langer` | Table à langer | 0,6 | P |
| 20 | `armoire-bureau` | Armoire de bureau | 1 | P |

## 5. `lot 45.png` — le vieil escalier caché (3 variantes)

Le premier essai (case 11 du `lot 44`) est sorti en perspective, comme un puits : pas
utilisable. On demande trois variantes à plat, on garde la meilleure.

```
Create ONE image, 1536x1024, a sprite sheet of 3 separate assets for a top-down tabletop
RPG battle map: three variants of the same VERY OLD, NARROW WOODEN STAIRCASE going down
into a hidden basement, forgotten for a hundred years.

BACKGROUND: solid pure magenta (#FF00FF) everywhere around the items. No magenta, pink or
purple inside an item. Leave at least 40 pixels of clear magenta between items.

CAMERA: strictly orthographic, straight down (90°), like a floor plan. ABSOLUTELY NO
perspective: no depth, no vanishing point, no pit or hole effect, no walls around the
stairs. The steps are drawn as FLAT parallel planks of equal width, stacked from top to
bottom, like a staircase on a battle map. The top of the staircase is at the TOP of the
image, the bottom at the bottom; the steps get slightly darker toward the bottom.

STYLE: realistic hand-painted digital art, finely detailed, like premium battle map
assets. Flat even lighting from above, NO cast shadows. No text, no letters, no grid, no
people.

THE STAIRCASE (each variant is a tall rectangle, about 1 wide x 2 high, standing
VERTICALLY): about 12 narrow steps of grey, weathered, split wooden planks with rusty
nail heads, thick dust, one broken step with a dark gap, a thin wooden handrail along
the left edge with one post missing, cobwebs in two corners.
1. Variant 1, as described.
2. Variant 2: same, with a few planks missing near the bottom.
3. Variant 3: same, slightly wider, with a small landing at the top.
```

| Case | id | Nom | Largeur (cases) | Bloque |
|---|---|---|---|---|
| 1 à 3 | `escalier-ancien` | Vieil escalier en bois | 1,4 | — |

## `lot 47.png` — le poste caisse du grand bar (3 × 1)

Le grand bar (lot 42) n'a pas de caisse : on le prolonge à l'est par un module caisse
dans le même style (marbre noir veiné d'or côté clients, inox côté barman). Le
`bar-caisse` du lot 42 est en bois clair : il reste le comptoir de Mei à l'accueil.

Premier essai raté : image panoramique au lieu de 1536 × 1024, modules deux fois trop
longs, objets énormes dessinés DE FACE comme des autocollants (chat, écran, terminal),
billets roses (le détourage les mange). Joindre `resources/atelier/objets/bar-comptoir-long.png`
à ChatGPT comme référence de style.

```
Create ONE image, EXACTLY 1536x1024 pixels (landscape 3:2, NOT a wide panorama), a sprite
sheet of 3 separate assets for a top-down tabletop RPG battle map. The attached image
is a section of the same bar counter: match its style, colors, scale and level of
realism exactly (brushed stainless steel bartender side at the top, polished black
marble with thin gold veins on the customers' side at the bottom, thin gold strip along
the bottom edge).

LAYOUT: the 3 items side by side in ONE row, vertically centered, each in its own third
of the image, with wide magenta margins. Items 1 and 2 are almost SQUARE (only about
1.1 times wider than deep). Item 3 is half as wide.

BACKGROUND: solid pure magenta (#FF00FF) everywhere around the items. No magenta, pink,
purple or violet inside an item. Leave at least 40 pixels of clear magenta between items.

CAMERA: strictly orthographic, looking STRAIGHT DOWN from the ceiling. Every object on
the counter is seen FROM ABOVE ONLY, as it would look in a floor plan: NO front views,
NO faces, NO screens facing the viewer. Objects are SMALL and realistic in scale, like
the bottles and sinks of the reference: the counter is 2.4 m long, so a cash register
screen is only about one seventh of its length.

STYLE: realistic hand-painted digital art, same as the reference, NOT cartoon, NOT
stickers, NOT icons. Flat even lighting from above, NO cast shadows. No text, no
letters, no numbers, no logos, no people.

1. The CASHIER section, square ends. On the steel side, seen from above: the thin top
   edge and black back of a tilted point-of-sale touchscreen, a small receipt printer
   (top view, a white paper roll slot), and an open cash drawer with coin cups and green
   and blue banknotes. On the marble side, seen from above: a small card payment
   terminal, the head and raised paw of a small golden lucky cat seen from above, a
   small round glass tip jar with coins seen from above, a small bowl of fortune
   cookies.
2. The same cashier section, but its LEFT end is ROUNDED (both left corners rounded, the
   gold strip following the curve), as the end of the bar: a small stack of red
   take-away menus and a small bowl of white mints instead of the fortune cookies.
3. A narrow hinged FLAP section of the same counter, to let the staff through: steel
   strip at the top, the marble top is a lifting flap with two small brass hinges along
   its top edge, empty, nothing on it.
```

| Case | id | Nom | Largeur (cases) | Bloque |
|---|---|---|---|---|
| 1 | `bar-comptoir-caisse` | Grand comptoir : caisse | 1,6 | P |
| 2 | `bar-comptoir-caisse-bout` | Grand comptoir : caisse en bout | 1,7 | P |
| 3 | `bar-comptoir-abattant` | Grand comptoir : abattant | 0,8 | — |

## `lot 48.png` — tables de préparation vides, accessoires des toilettes (5 × 3)

Restaurant fermé : les tables de la cuisine sont vides et nettoyées. Les accessoires des
toilettes sont fixés au mur : vus du dessus, on ne voit que leur dessus qui dépasse du mur
(le côté du mur est en haut de la case).

```
Create ONE image, EXACTLY 1536x1024 pixels, a sprite sheet of 15 separate assets for a
top-down tabletop RPG battle map of a modern Chinese buffet restaurant, CLOSED for the
night: everything clean, empty and tidy. 3 rows of 5, each item centered in its cell.

BACKGROUND: solid pure magenta (#FF00FF) everywhere around the items. No magenta, pink,
purple or violet inside an item. Items do not touch; leave at least 40 pixels of clear
magenta between items.

CAMERA: strictly orthographic, looking STRAIGHT DOWN from the ceiling, like a floor plan.
We see only the TOP of each object: no front views, no visible sides, no perspective.

STYLE: realistic hand-painted digital art, finely detailed, like premium battle map
assets. Flat even lighting from above, NO cast shadows. No text, no letters, no numbers,
no logos, no people.

Row 1 — EMPTY stainless steel kitchen prep tables, brushed steel tops, wiped clean,
NOTHING on them, lying horizontally:
1. A stainless steel prep table, about 2 times longer than deep.
2. A long stainless steel prep table, about 3 times longer than deep.
3. A stainless steel prep table with a raised backsplash rim along its TOP edge (the
   wall side), about 2 times longer than deep.
4. An L-shaped CORNER stainless steel prep table, both arms the same depth.
5. A large central stainless steel prep island, about 2 times longer than deep, with a
   small round hand-wash sink at its right end.
Row 2 — restroom accessories mounted on a wall, the wall side at the TOP of each item,
drawn LARGE in their cells:
6. A chrome toilet paper holder with a white roll, seen from above.
7. A large round white plastic jumbo toilet roll dispenser, seen from above.
8. A white electric hand dryer box, seen from above, its air nozzle at the bottom edge.
9. A sleek grey modern blade hand dryer with a long slot on top, seen from above.
10. A brushed stainless steel paper towel dispenser, seen from above.
Row 3 — more restroom items:
11. A small wall-mounted white liquid soap dispenser, seen from above.
12. A small round stainless steel pedal bin, closed lid, seen from above.
13. A white toilet brush in its round holder, seen from above.
14. A tall open grey bin with a few crumpled paper towels inside, seen from above.
15. A spare pack of 9 toilet paper rolls in clear plastic wrap, seen from above.
```

| Case | id | Nom | Largeur (cases) | Bloque |
|---|---|---|---|---|
| 1 | `table-prep-vide` | Table de préparation vide | 1,4 | P |
| 2 | `table-prep-longue` | Longue table de préparation vide | 2 | P |
| 3 | `table-prep-dosseret` | Table de préparation à dosseret, vide | 1,4 | P |
| 4 | `table-prep-angle` | Table de préparation d'angle, vide | 1,4 | P |
| 5 | `ilot-prep-evier` | Îlot de préparation et lave-mains | 1,8 | P |
| 6 | `derouleur-papier-wc` | Dérouleur de papier toilette | 0,2 | — |
| 7 | `distributeur-papier-wc` | Distributeur de papier toilette | 0,25 | — |
| 8 | `seche-mains` | Sèche-mains | 0,22 | — |
| 9 | `seche-mains-lame` | Sèche-mains à lame | 0,3 | — |
| 10 | `distributeur-essuie-mains` | Distributeur d'essuie-mains | 0,25 | — |
| 11 | `distributeur-savon` | Distributeur de savon | 0,12 | — |
| 12 | `poubelle-pedale` | Poubelle à pédale | 0,22 | — |
| 13 | `balai-wc` | Balai de toilettes | 0,12 | — |
| 14 | `poubelle-essuie-mains` | Poubelle à essuie-mains | 0,3 | — |
| 15 | `pack-papier-wc` | Pack de papier toilette | 0,3 | — |
