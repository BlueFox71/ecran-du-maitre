# Prompts — WoW, priorité 1 : la base commune (2e essai)

Pour la Campagne 4 (*Les cendres de la Légion*). Le premier essai est dans
`C:\Users\PC-Alexis\Downloads\Génération asset` (8 planches, 2026-11-24).

## Bilan du premier essai

Trois défauts reviennent sur toutes les planches, et ils viennent du premier prompt de style :

1. **Fond** : aucun fond magenta. Il y a un faux fond transparent, avec un voile
   semi-transparent et un dégradé brun ou gris, ou un fond blanc (taverne). Les objets
   restent récupérables, parce que leur opacité est franche (seuil d'alpha), mais il faut
   repasser au **magenta pur**.
2. **Ombres et halos** : le style demandait une ombre portée, alors que l'application
   l'ajoute elle-même. On demande maintenant **aucune ombre, aucun halo**.
3. **Perspective** : murs, portes, taverne et une bonne moitié des objets sont dessinés
   **de face ou de 3/4**, avec les pieds de table et les façades visibles. Il faut décrire,
   objet par objet, **ce qu'on voit d'en haut**.

### À garder (déjà vus du dessus)

| Planche d'origine | id | Remarque |
|---|---|---|
| Grille de textures fantasy (sols 9) | `dalles-hurlevent` | à raccorder |
| Grille de textures fantasy | `paves-humains` | |
| Grille de textures fantasy | `chemin-terre` | |
| Grille de textures fantasy | `planches-taverne` | |
| Grille de textures fantasy | `dalles-donjon` | |
| Grille de textures fantasy | `herbe-elwynn` | |
| Pavés de pierre, gris et ivoire (sols 10) | `dalles-blanches` | bonus, variante des dalles de Hurlevent |
| Objets d'aventure | `feu-de-camp`, `tente-voyageur`, `sac-couchage`, `charrette`, `caisse-ravitaillement` (lot 51) | |
| Sièges et guerriers tombés | `catapulte-orque`, `cadavre-soldat-humain`, `cadavre-orque`, `cadavre-sentinelle`, `squelette-soldat`, `ossements-epars` (lot 52) | |
| Objets médiévaux | `pont-bois`, `echelle` (lot 53) | pont légèrement de biais, mais acceptable |

### À refaire

| Asset | Problème |
|---|---|
| Les 4 murs | dessinés en façade (créneaux et pieux de profil), pas le dessus du mur |
| Les 2 portes | façade du portail, au lieu de la tranche vue d'en haut ; bords rouges et noirs |
| Les 8 objets de taverne | 3/4, pieds visibles, fond blanc opaque |
| Barricade, chevaux de frise | vus de face |
| Râtelier d'armes, mannequin | vus de face |
| Lianes | pendent comme un rideau, vues de face |
| Coffre, panneau de quêtes, boîte aux lettres, puits, forge, enclume, établi | 3/4 ou de face |
| Pont de pierre | vu de profil (on voit l'arche) |
| (barrière en bois, non demandée) | vue de profil, ignorée |

## 1. Les murs

### 2e essai (planche « remparts assortis ») : rien n'est gardé

La planche est bien sur fond magenta, mais les quatre murs montrent encore leur
**façade** : la rangée de briques du bas, les bannières qui pendent, les rondins vus sur
toute leur hauteur, les arcades des ruines et le flanc de la falaise. Posé à la verticale sur un plan, ce genre
de mur montrerait sa façade de côté. Les bandes ne remplissaient pas non plus leur
hauteur. Le mot « wall » attire la façade : on demande plutôt une **texture** en bande,
comme un sol découpé en ruban.

### `murs 9.png` — rempart, palissade, ruines, falaise (4 bandes) ✅ fait (4e essai)

Avec ce prompt et une nouvelle conversation, les 4 murs sont enfin vus d'en haut. Les
ruines ont une brèche au milieu, donc on n'en garde que la moitié gauche, intacte.

#### Prompt

```
Create ONE image, 1536x1024, a sprite sheet of 4 TEXTURE BANDS for a top-down tabletop
RPG battle map in the World of Warcraft art style (stylized hand-painted, saturated
colors, chunky shapes, painterly brush strokes).

LAYOUT: 4 long horizontal bands stacked vertically, each spanning the FULL width of the
image from the left edge to the right edge, each about 200 pixels tall, separated by
gutters of solid pure magenta (#FF00FF). Each band is a RECTANGLE COMPLETELY FILLED with
texture: straight, parallel top and bottom edges, no magenta inside a band.

EACH BAND is a flat texture, like a floor texture cut into a long ribbon: the flat top
surface of a thick wall as drawn on a floor plan, seen face-on from directly above.
FORBIDDEN: any front face, any lower course of bricks, any base, any banner or cloth
hanging down, any object sticking out of the band, any perspective, any shadow.
Seamless tileable horizontally (the left edge continues the right edge), no focal point,
the same pattern repeated along the band. Flat even lighting, NO glow. No text, no logos.

BANDS, top to bottom:
1. Human rampart: rows of big flat pale white stone slabs with dark joints, like a
   paved walkway, with a single line of slightly larger square slabs along the upper edge.
2. Orc palisade: a tight row of round cut log ends seen exactly from above (circles of
   wood with growth rings and a darker bark ring), packed side by side in two staggered
   rows, rope lashings crossing between them. No pointed stakes seen from the side.
3. Ancient elven ruin: flat cracked white marble blocks with thin turquoise and gold
   inlaid lines, a few chipped corners, moss and small ivy leaves lying flat in the
   cracks.
4. Rocky cliff top: flat grey rock surface seen exactly from above, cracked slabs and
   flat ledges, tufts of grass and moss lying flat in the cracks. No side of the cliff,
   no boulders seen from the side.
```

| Bande | id | Nom | Tuile (cases) |
|---|---|---|---|
| 1 | `mur-rempart-blanc` | Rempart de pierre blanche | 2,5 |
| 2 | `mur-palissade-orque` | Palissade orque | 2,5 |
| 3 | `mur-ruines-elfiques` | Ruines elfiques | 2,5 |
| 4 | `mur-falaise` | Bord de falaise | 3 |

## 2. Les portes

### `ouvertures 6.png` (3e essai) ✅ la porte de forteresse

La porte de forteresse est enfin vue d'en haut : une barre fine entre deux piliers à
chapeau pointu. Elle est découpée à ses piliers, sans les bouts de rempart. Le portail
de ville est encore dessiné de face (arche, herse à pointes), et la planche n'avait
toujours que 2 portes en 2172 × 724. Il faut **une nouvelle conversation ChatGPT par
planche**, sinon il retouche l'image précédente au lieu d'en faire une nouvelle.

### `ouvertures 7.png` (4e essai) ✅ le portail de ville

Cette fois, le portail est un linteau de pierre au lion entre deux piliers, avec la herse
levée en dessous, vu d'en haut. Il est coupé à ses piliers. La porte de forteresse du haut
de la planche double celle qu'on a déjà, donc elle est laissée.

### `ouvertures 8.png` — porte de taverne et porte de palissade orque

Même prompt que ci-dessous, en ne gardant que les portes 3 et 4 ("EXACTLY 2 separate
DOOR assets, in 2 rows of 1"), et en ajoutant : "Draw each door exactly like a fortress
gate seen from the sky: a thin bar between two square pillars with pyramid-shaped caps.
The city gateway has NO arch: its raised portcullis is only a thin row of dark iron bar
tips between the pillars."

#### Prompt d'origine

2e essai raté : la planche ne contenait que 2 portes au lieu de 4, en 2172 × 724. Les
deux étaient encore dessinées **en façade**, la porte de forteresse sous son arche et le
portail avec sa herse ouverte. Les bannières pendaient aussi sur les piliers. On reprend
avec la comparaison du plan d'architecte, sans aucune bannière ni arche.

```
Create ONE image, EXACTLY 1536x1024, a sprite sheet of EXACTLY 4 separate DOOR assets,
in 2 rows of 2, for a top-down tabletop RPG battle map in the World of Warcraft art style
(stylized hand-painted, saturated colors, chunky shapes).

BACKGROUND: solid pure magenta (#FF00FF) everywhere around the items. No magenta, pink
or purple inside an item. Items do not touch; at least 60 pixels of magenta between them.

THIS IS THE MOST IMPORTANT RULE: each door is drawn as on an ARCHITECT'S FLOOR PLAN,
seen from the sky. A closed door seen from the sky is NOT a rectangle with planks and
rings: it is only a THIN HORIZONTAL BAR (the top edge of the door leaf, about 10 times
longer than thick) lying between two SQUARE blocks (the tops of the two door posts) at
its ends. The whole asset is a long, flat, horizontal shape about 5 times wider than
tall. NO arch, NO visible planks, NO hinges seen from the front, NO banner, NO
portcullis seen from the front, NO wall above the door, NO perspective.
Small ring handles are only seen as small half-circles sticking out above and below
the bar.

STYLE: flat even lighting, NO cast shadows, NO glow. No text, no grid, no people.

DOORS, left to right, top to bottom:
1. Fortress gate: a thick bar of dark oak banded with riveted iron, between two big
   square white stone blocks, small iron rings above and below the middle of the bar.
2. City gateway: a thin bar of dark iron (a raised portcullis seen from above, a row of
   iron bar ends), between two big square white stone blocks, a thin gold line along
   the top of each block.
3. Tavern door: a thin bar of warm brown wood with an iron band, between two small
   square wooden posts, an iron ring above and below near the right end.
4. Orc palisade gate: a bar made of a row of small round log ends bound with rope,
   between two square log posts topped with a small bone spike seen from above.
```

| Case | id | Nom | Nature |
|---|---|---|---|
| 1 | `porte-forteresse` ✅ | Porte de forteresse | porte |
| 2 | `porte-portail-ville` ✅ | Portail de ville | porte |
| 3 | `porte-taverne` | Porte de taverne | porte |
| 4 | `porte-palissade-orque` | Porte de palissade orque | porte |

## 3. `lot 49.png` — la taverne (2 × 4) ✅ fait

Le 2e essai est bon pour 6 objets sur 8 : comptoir, table, banc, tabouret, tonneau et
cheminée. Le banc et le tabouret laissent un peu voir leurs pieds, ce qui est acceptable.
La **chope** (vue de côté) et l'**enseigne** (debout sur son poteau au lieu d'être à
plat) passent dans le `lot 50`.

```
Create ONE image, 1536x1024, a sprite sheet of 8 separate assets for a top-down tabletop
RPG battle map of a human tavern in the World of Warcraft style (stylized hand-painted,
saturated warm colors, chunky exaggerated shapes, thick wood, riveted iron, blue and
gold Alliance accents).

BACKGROUND: solid pure magenta (#FF00FF) everywhere around the items, NOT white, NOT
transparent, NOT a gradient. No pink, magenta or purple inside an item. Items do not
touch or overlap; leave at least 40 pixels of clear magenta between items.

CAMERA: strictly orthographic, straight down from the ceiling (90°), like a floor plan.
We see ONLY THE TOP of each object: no legs, no front faces, no sides, no perspective,
no 3/4 view. Flat even lighting from above: NO cast shadows, NO glow, NO light halo
around candles or fire. No text, no letters, no logos, no grid, no people.

ITEMS, 2 rows of 4, left to right:
Row 1:
1. A long straight tavern bar counter: the top of a thick wooden counter (long, lying
   horizontally) with a few foaming tankards, a pewter jug and a folded cloth on it.
2. A rectangular tavern table seen from above: thick planks with a blue and gold table
   runner, pewter plates, a roast chicken leg, cheese, tankards, a candle.
3. A long wooden bench seen from above: just its thick plank seat, no legs visible.
4. A round wooden stool seen from above: a round seat of planks with iron rivets.
Row 2:
5. A wooden beer tankard seen from above: a round circle of foam inside an iron-banded
   rim, the handle sticking out on one side.
6. A beer barrel lying on its side on a wooden cradle, seen from above: an oval barrel
   shape with iron hoops, a brass tap at one end.
7. A stone fireplace seen from above, set against a wall at the TOP of the cell: a
   U-shaped stone hearth opening downward, glowing logs and a small black cauldron
   inside, poker and tongs on the side.
8. An inn sign that has fallen and lies FLAT on the floor: a wooden shield-shaped sign
   with iron trim, a painted foaming tankard on it.
```

| Case | id | Nom | Largeur (cases) | Bloque |
|---|---|---|---|---|
| 1 | `comptoir-taverne` | Comptoir de taverne | 2,5 | P |
| 2 | `table-taverne` | Table de taverne | 1,5 | P |
| 3 | `banc-taverne` | Banc de taverne | 1,2 | — |
| 4 | `tabouret-taverne` | Tabouret de taverne | 0,4 | — |
| 5 | ~~`chope`~~ | → lot 50 | | |
| 6 | `tonneau-biere` | Tonneau de bière en perce | 0,8 | P |
| 7 | `cheminee-taverne` | Cheminée de taverne | 1,5 | P V |
| 8 | ~~`panneau-auberge`~~ | → lot 50 | | |

## 4. `lot 50.png` — camp, combat et village (5 + 5 + 5)

> **Remplacé** : ces 15 objets sont répartis sur 2 planches plus petites, `lot 50` (8 objets) et `lot 54` (7 objets). Leurs prompts prêts à coller sont dans `D:JDRWORLD OF WARCRAFTCampagne 4 - Les cendres de la LégionPrompts assets ChatGPT.txt`, comme celui de `ouvertures 8`. Le prompt ci-dessous n'est gardé que pour mémoire.

```
Create ONE image, 1536x1024, a sprite sheet of EXACTLY 15 separate assets for a top-down tabletop
RPG battle map in the World of Warcraft style (stylized hand-painted, saturated colors,
chunky exaggerated shapes, thick wood, riveted iron, blue and gold Alliance accents).

BACKGROUND: solid pure magenta (#FF00FF) everywhere around the items, NOT transparent,
NOT a gradient. No pink, magenta or purple inside an item. Items do not touch or
overlap; leave at least 30 pixels of clear magenta between items.

CAMERA: strictly orthographic, straight down from the sky (90°), like a floor plan.
We see ONLY THE TOP of each object: no legs, no front faces, no sides, no perspective,
no 3/4 view. Flat even lighting from above: NO cast shadows, NO glow. No text, no
letters, no grid, no people.

ITEMS, left to right:
Row 1 (5 items):
1. A wooden barricade seen from above: a line of planks and crates lying across, a few
   sandbags, a small barrel (long, lying horizontally).
2. Cheval de frise seen from above: a horizontal log with sharpened stakes crossing it
   in X shapes, the stakes pointing left-up and right-down (long, horizontal).
3. A weapon rack seen from above: the top of a narrow wooden rack (long, horizontal),
   with the hilts of swords and the heads of spears and an axe resting along it.
4. A training dummy seen from above: a round straw head on top of a cross of wooden
   arms wrapped in straw, a round wooden base around the post.
5. Ivy and vines seen from above, spreading flat on the ground: a tangle of green leafy
   vines in an irregular patch.
Row 2 (5 items):
6. An open treasure chest seen from above: the open lid lying flat behind it, gold
   coins, gems and pearls filling the chest.
7. A quest notice board seen from above: the thin top edge of a wooden board between
   two posts (long, horizontal), with a few paper bounties pinned and curling over its
   top edge.
8. A blue and gold human mailbox seen from above: a small rounded blue box top with a
   gold trim and a gold finial.
9. A stone well seen from above: a round ring of stone blocks with dark water inside,
   a wooden crossbar over the opening with a rope and a bucket, NO roof.
10. A wooden beer tankard seen EXACTLY from above: a round circle of white foam inside
    a round iron-banded rim, the handle sticking out on the right side. NOT seen from
    the side.
Row 3 (5 items):
11. A blacksmith forge seen from above: a square stone hearth full of glowing coals,
    a chimney opening at the back (top of the cell), tools hanging on the side.
12. An iron anvil on a wooden stump seen from above: the flat top of the anvil with its
    horn pointing right, the round cut stump around it.
13. A carpenter's workbench seen from above: the plank top with a hammer, chisels,
    nails and a blueprint, no legs visible.
14. A stone arch bridge seen from above (long, horizontal): the cobbled deck of the
    bridge with low stone parapets along the top and bottom edges, square pillars at
    the four corners with small blue and gold banners lying on them.
15. A tavern sign that has FALLEN and lies FLAT on the floor, seen from above: a wooden
    shield-shaped sign with iron trim and a painted foaming tankard, a short broken
    chain lying next to it. NO post, NO standing pole.
```

| Case | id | Nom | Largeur (cases) | Bloque |
|---|---|---|---|---|
| 1 | `barricade` | Barricade | 1,5 | P |
| 2 | `chevaux-frise` | Chevaux de frise | 1,5 | P |
| 3 | `ratelier-armes` | Râtelier d'armes | 1 | P |
| 4 | `mannequin` | Mannequin d'entraînement | 0,5 | P |
| 5 | `lianes` | Lianes | 1,2 | — |
| 6 | `coffre-tresor` | Coffre au trésor | 0,7 | P |
| 7 | `panneau-quete` | Panneau de quêtes | 1,2 | P |
| 8 | `boite-lettres` | Boîte aux lettres | 0,3 | P |
| 9 | `puits` | Puits | 1 | P |
| 10 | `chope` | Chope de bière | 0,15 | — |
| 11 | `forge` | Forge | 1,5 | P V |
| 12 | `enclume` | Enclume | 0,5 | P |
| 13 | `etabli` | Établi | 1,2 | P |
| 14 | `pont-pierre` | Pont de pierre | 3 | — |
| 15 | `enseigne-auberge` | Enseigne d'auberge tombée | 0,8 | — |

## Pour la suite (Légion, actes 1 à 7)

- Le **magenta est enlevé au détourage**. Pour les planches violettes (elfes de la nuit,
  Karazhan, Conseil des Ombres, arcanes), il faut un autre fond : **vert pur (#00FF00)**,
  sauf pour le fel, qui est vert lui aussi. On ne mélange donc pas le fel et le violet
  sur une même planche, et il faudra ajouter le détourage vert à `decouper.ts`.
- On reprend le même cadre : planche de 1536 × 1024, objets numérotés, description de ce
  qu'on voit **d'en haut**, aucune ombre.

---

# Priorité 2 — la Légion

## Bilan des 3 planches (sols 11, murs 10, lot 55)

Fond magenta franc, format 2172 × 724 : rien à reprocher au cadre.

- **`sols 11`** ✅ roche gangrenée, gangre liquide, pont de vaisseau de la Légion (tuile 3).
- **`murs 10`** ✅ rempart de la Légion, paroi de cristaux gangrenés (tuile 3).
- **`lot 55`** : 8 objets sur 14 gardés ✅ portail, cercle d'invocation, autel sacrificiel,
  brasero, débris de vaisseau, gangrecuve, gangregarde mort, diablotin mort.
  À refaire :
  - le **pylône**, le **petit** et le **grand cristal** : vus de face, debout ;
  - la **cage** : de trois-quarts ;
  - la **bannière** : de face, sur son mât ;
  - la **tache de corruption** : sa brume se mélange au magenta et ressort brun-rouge
    au détourage. Il lui faut des bords nets et opaques.

Nouveaux rayons : « Portails » et « Débris » (Architecture), « Rituels » (Déco et objets),
« Braseros » (Lumière). Tout est dans le thème Azeroth (bouton WoW de l'atelier).

## `lot 56.png` — la Légion, à refaire (3 + 3) ✅ fait (1er essai, les 6 gardés)

Prompt prêt à coller dans `Prompts assets ChatGPT.txt` (campagne 4), entre ▼▼▼ et ▲▲▲.

```
Create ONE image, 1536x1024, a sprite sheet of EXACTLY 6 separate assets for a top-down tabletop
RPG battle map in the World of Warcraft Burning Legion style (stylized hand-painted, saturated
colors, chunky exaggerated shapes, black spiked metal, dark stone, glowing fel-green crystals
and runes).

BACKGROUND: solid pure magenta (#FF00FF) everywhere around the items, NOT transparent,
NOT a gradient. No pink, magenta or purple inside an item. Items do not touch or
overlap; leave at least 40 pixels of clear magenta between items. Every item has a
HARD, CRISP outline: no mist, no smoke, no haze, no soft glow bleeding onto the background.

CAMERA: strictly orthographic, straight down from the sky (90°), like a floor plan.
We see ONLY THE TOP of each object: nothing stands up, no front faces, no sides, no
perspective, no 3/4 view. Flat even lighting from above: NO cast shadows. No text, no
letters, no grid, no people.

ITEMS, left to right, 2 rows of 3, each item centered in its third of the row:
Row 1:
1. A demonic fel pylon seen EXACTLY from above: the pointed roof of a square black metal
   obelisk, seen as a square whose four sloping faces meet at the center, green runes
   engraved on the faces, a glowing green fel crystal set at the very center, curved
   black spikes pointing outward from the four corners. NOT tall, NOT seen from the side.
2. A small cluster of fel crystals seen EXACTLY from above: five or six green crystal
   points radiating from the center like a star, on a few dark broken rocks. We see the
   tips of the crystals pointing at the camera, not their length.
3. A large fel crystal embedded in rock seen EXACTLY from above: one big green crystal
   seen end-on, a hexagon whose facets converge to its tip at the center, smaller
   crystals around it, the whole thing set in a ring of cracked black rock.
Row 2:
4. A round demonic cage seen EXACTLY from above: its flat round roof made of black iron
   bars radiating from a central iron ring like a wheel, a thick spiked iron rim around
   it with spikes pointing outward. It is a perfect circle, NOT an ellipse, NOT 3/4.
5. A Burning Legion war banner seen EXACTLY from above: a round spiked black iron base
   with the top of the pole at its center, a horizontal crossbar with curved horns at
   both ends, and the green and black cloth blown flat by the wind to the right, so its
   horned demonic sigil is visible from above.
6. A fel corruption stain on the ground seen from above: an irregular patch of black-
   green corrupted earth with bright green glowing veins spreading outward like cracks.
   Fully OPAQUE with HARD, CRISP edges: NO mist, NO haze, NO semi-transparent border.
```

| Case | id | Nom | Largeur (cases) | Bloque |
|---|---|---|---|---|
| 1 | `pylone-fel` | Pylône gangrené | 1 | P |
| 2 | `cristal-fel-petit` | Petits cristaux gangrenés | 0,8 | — |
| 3 | `cristal-fel-grand` | Grand cristal gangrené | 1,5 | P |
| 4 | `cage-demoniaque` | Cage démoniaque | 1,5 | P |
| 5 | `banniere-legion` | Bannière de la Légion | 0,8 | P |
| 6 | `corruption-sol` | Corruption gangrenée | 2 | — |

# Acte 4 — Gangrebois et Jaedenar

## Bilan des 2 planches (sols 15, lot 64)

- **`sols 15`** ✅ terre corrompue, boue toxique, eau polluée (tuile 3).
- **`lot 64`** : 6 objets sur 10 gardés ✅ arbre corrompu, champignons gangrenés, mare de
  corruption, furbolg mort, tente de satyre, pentagramme (l'arbre, la tente et le
  pentagramme, violets, passent en `magenta-violet`).
  À refaire :
  - le **totem furbolg** : de face, debout ;
  - l'**autel des Ombres** : de trois-quarts, bannière pendue en façade ;
  - le **crâne de démon** : vu de face, comme un masque ;
  - les **bougies noires** : de profil, on voit la hauteur des bougies.

## `lot 65.png` — Acte 4, à refaire (2 + 2) ✅ fait (1er essai, les 4 gardés)

Prompt prêt à coller dans `Prompts assets ChatGPT.txt` (campagne 4), entre ▼▼▼ et ▲▲▲.

```
Create ONE image, 1536x1024, a sprite sheet of EXACTLY 4 separate assets for a top-down tabletop
RPG battle map in the World of Warcraft style (stylized hand-painted, saturated colors, chunky
exaggerated shapes), for a corrupted forest of the Burning Legion (dark stone, old wood, bone,
glowing fel-green runes).

BACKGROUND: solid pure magenta (#FF00FF) everywhere around the items, NOT transparent,
NOT a gradient. No pink, magenta or purple inside an item. Items do not touch or
overlap; leave at least 60 pixels of clear magenta between items. Every item has a
HARD, CRISP outline: no mist, no smoke, no haze, no soft glow bleeding onto the background.

CAMERA: strictly orthographic, straight down from the sky (90°), like a floor plan or a
map icon. We see ONLY THE TOP of each object: NOTHING stands up, nothing hangs, no front
faces, no sides, no perspective, no 3/4 view. Flat even lighting from above: NO cast
shadows. No text, no letters, no grid, no people.

ITEMS, 2 rows of 2, each item centered in its quarter of the image:
Row 1:
1. A furbolg totem seen EXACTLY from above, as a bird directly above sees it: the round
   flat top of a thick wooden pole (a disk with tree rings) at the center, a bear skull
   lying FLAT on top of it with its snout pointing down the image, two short crossbeams
   forming a plus sign, a few feathers lying flat on the ground around the base, a ring of
   mossy stones around it. NOT tall, NOT seen from the front.
2. A Shadow Council altar seen EXACTLY from above: a perfect circle of black stone slabs,
   a glowing fel-green rune circle engraved on its flat top, five black candle tops (small
   dark disks with a tiny yellow flame dot seen from above) evenly spaced around the rim,
   curved black horns lying flat and pointing outward. No banner, no front face, NOT 3/4.
Row 2:
3. A huge horned demon skull lying on the ground, seen EXACTLY from above: we see the TOP
   of the cranium (a rounded bone dome with green fel cracks), the snout and upper fangs
   pointing down the image, two big curved horns spreading flat to the left and right.
   We do NOT see the eye sockets or the face: it is a view of the top of the head.
4. A group of five black ritual candles seen EXACTLY from above: five dark round disks of
   different sizes (the tops of the candles), each with a small bright yellow-orange flame
   seen from above as a teardrop dot at its center, black wax drips spreading flat on the
   ground around them like puddles. We do NOT see the height of the candles.
```

| Case | id | Nom | Largeur (cases) | Bloque |
|---|---|---|---|---|
| 1 | `totem-furbolg` | Totem furbolg | 1 | P |
| 2 | `autel-ombres` | Autel des Ombres | 2 | P |
| 3 | `crane-demon` | Crâne de démon | 2 | P |
| 4 | `bougies-noires` | Bougies noires | 0,8 | — |

# Acte 5 — Hache-tripes

## Bilan des 4 planches (sols 16, murs 14, ouvertures 9, lot 66)

- **`sols 16`** ✅ dalles elfiques moussues, marbre fissuré d'Eldre'Thalas (tuile 3).
- **`murs 14`** ✅ mur elfique au lierre (coupé sans ses deux piliers), mur d'ogre (tuile 3).
- **`ouvertures 9`** ✅ porte d'ogre aux crânes (ajoutée au filtre WoW).
- **`lot 66`** : 5 objets sur 9 gardés ✅ trône d'ogre, marmite d'ogre, livres éparpillés,
  piège à pointes, tas d'or (en `magenta-violet` pour ses gemmes).
  À refaire :
  - la **bibliothèque elfique** : de face, colonnes et étagères debout ;
  - la **statue elfique** : la femme vue de face, pas le dessus de sa tête ;
  - le **cristal arcanique** : debout, on voit sa hauteur ;
  - le **pilier arcanique** : de profil, une colonne debout.

## `lot 67.png` — Acte 5, à refaire (2 + 2) ✅ fait (1er essai, les 4 gardés)

Prompt prêt à coller dans `Prompts assets ChatGPT.txt` (campagne 4), entre ▼▼▼ et ▲▲▲.

```
Create ONE image, 1536x1024, a sprite sheet of EXACTLY 4 separate assets for a top-down tabletop
RPG battle map in the World of Warcraft style (stylized hand-painted, saturated colors, chunky
exaggerated shapes), for the ruined night elf / Highborne library city of Dire Maul (white and
pale grey-blue marble, turquoise and gold inlays, ivy, glowing violet arcane runes).

BACKGROUND: solid pure magenta (#FF00FF) everywhere around the items, NOT transparent,
NOT a gradient. Items do not touch or overlap; leave at least 60 pixels of clear magenta
between items. Every item has a HARD, CRISP outline: no mist, no smoke, no haze, no soft
glow bleeding onto the background.

CAMERA: strictly orthographic, straight down from the sky (90°), like a floor plan or a
map icon, as a bird directly above sees it. We see ONLY THE TOP of each object: NOTHING
stands up, nothing hangs, no front faces, no sides, no columns seen along their height,
no perspective, no 3/4 view. Flat even lighting from above: NO cast shadows. No text,
no letters, no grid, no people.

ITEMS, 2 rows of 2, each item centered in its quarter of the image:
Row 1:
1. A ruined elven library seen EXACTLY from above: a long rectangle of marble floor
   framed by the flat TOPS of tall bookshelves along its edges (we see only the top
   planks of the shelves as thin dark-wood strips with the tops of book spines in a row),
   two shelves toppled flat on the floor with books spilled around them, broken marble
   slabs and ivy. NO columns, NO arch, NOT seen from the front.
2. A statue of a Highborne elf woman seen EXACTLY from above: the TOP of her head (hair
   tied up in a bun, two long pointed ears sticking out left and right), her shoulders
   and her long robe spreading as a flat circle around her, on a round marble pedestal
   with a gold and turquoise rim. We do NOT see her face, only the top of her head.
Row 2:
3. A floating arcane crystal on its pedestal seen EXACTLY from above: a round marble
   pedestal with gold inlays and a circle of glowing violet runes, and at its center the
   violet crystal seen end-on, a hexagon whose facets converge to its tip at the center
   like a star. We do NOT see the length of the crystal.
4. An arcane stone pillar seen EXACTLY from above: the flat octagonal TOP of a grey stone
   pillar, with a violet glowing rune engraved on its top face and a thin gold rim, set on
   a slightly larger octagonal base. It reads as two concentric octagons. We do NOT see
   the height of the pillar.
```

| Case | id | Nom | Largeur (cases) | Bloque |
|---|---|---|---|---|
| 1 | `biblio-elfique` | Bibliothèque elfique en ruine | 3 | P V |
| 2 | `statue-elfique` | Statue d'elfe haut-né | 1,5 | P |
| 3 | `cristal-arcane` | Cristal arcanique | 1,5 | P |
| 4 | `pilier-arcane` | Pilier arcanique | 1 | P V |

Le cristal et le pilier sont violets : à découper en `magenta-violet`.

# Acte 6 — Karazhan

## Bilan des 5 planches (sols 17, sols 18, murs 15, ouvertures 10, lot 68)

- **`sols 17`** ✅ parquet de Karazhan, tapis royal violet (motif encadré : il se répète
  en carreaux de tapis), dalles aux runes arcaniques (tuile 3).
- **`sols 18`** ✅ l'échiquier de marbre, 6 × 6 cases (tuile 12 : deux cases de plan par
  case d'échecs).
- **`murs 15`** ✅ mur de la tour, boiseries aux tentures violettes. Coupés au milieu des
  piliers d'extrémité : deux tuiles bout à bout refont un pilier entier.
- **`ouvertures 10`** ✅ porte gothique de Karazhan (ajoutée au filtre WoW).
- **`lot 68`** : 16 objets sur 23 gardés ✅ les 12 pièces d'échecs (vues en plongée, lisibles
  comme des pions ; nouveau rayon « Échecs »), fantôme de serviteur, cercle arcanique,
  armure animée, globe céleste. Toute la planche en `magenta-violet`.
  À refaire :
  - le **télescope**, la **bibliothèque**, le **piano**, le **banquet**, le **chandelier**
    et le **rideau** : de face ou de trois-quarts ;
  - les **livres flottants** : leur aura brumeuse ressort en traînées au détourage.

## `lot 69.png` — Acte 6, à refaire (4 + 3) ✅ fait (1er essai, les 7 gardés)

Prompt prêt à coller dans `Prompts assets ChatGPT.txt` (campagne 4), entre ▼▼▼ et ▲▲▲.

```
Create ONE image, 1536x1024, a sprite sheet of EXACTLY 7 separate assets for a top-down tabletop
RPG battle map in the World of Warcraft style (stylized hand-painted, saturated colors, chunky
exaggerated shapes), for Karazhan, the haunted gothic tower of the mage Medivh (dark wood,
brass, deep royal purple velvet, violet arcane magic).

BACKGROUND: solid pure magenta (#FF00FF) everywhere around the items, NOT transparent,
NOT a gradient. Purple is allowed, but only a DEEP violet leaning toward blue (royal purple,
indigo), never pink, never magenta. Items do not touch or overlap; leave at least 50 pixels
of clear magenta between items. Every item has a HARD, CRISP, fully opaque outline: no mist,
no smoke, no aura, no haze, no soft glow bleeding onto the background.

CAMERA: strictly orthographic, straight down from the sky (90°), like a floor plan or a
map icon, as a bird directly above sees it. We see ONLY THE TOP of each object: NOTHING
stands up, nothing hangs, no front faces, no sides, no legs, no perspective, no 3/4 view.
Flat even lighting from above: NO cast shadows. No text, no letters, no grid, no people.

ITEMS, row 1 has 4 items, row 2 has 3 items, evenly spaced:
Row 1:
1. A large brass astronomy telescope seen EXACTLY from above: a round wooden platform
   with a brass compass rose, and the long brass tube lying across it seen from above as
   a long tapered rectangle pointing diagonally, a round blue lens disk at its wide end.
2. An arcane bookcase seen EXACTLY from above: a long narrow rectangle, the flat TOP of a
   dark wood bookcase with gold trim, and along its front edge only the top ends of a
   row of book spines (small colored rectangles in a line), two small violet crystals on
   top. We do NOT see the shelves or the books from the front.
3. A spectral grand piano seen EXACTLY from above: the classic grand piano outline (a
   harp shape with one straight side and one curved side), its lid closed and seen flat
   from above, pale translucent ghostly blue but with a HARD, CRISP, opaque outline, the
   keyboard as a thin strip of black and white keys along the straight short end.
4. A haunted banquet table seen EXACTLY from above: a long rectangle of dark wood with a
   deep purple tablecloth runner, rotten food on plates, a roast boar, goblets, cobwebs,
   and the round flat seats of 3 chairs on each long side seen from above. We do NOT
   see the chair backs or the table legs.
Row 2:
5. A chandelier with violet flames lying flat on the floor seen EXACTLY from above: a
   dark iron wheel (a ring with spokes like a cartwheel) with 6 candle cups on the ring,
   each candle top a small disk with a violet flame seen from above as a teardrop dot.
   NO chains, NOTHING hanging.
6. A theatre stage curtain seen EXACTLY from above: a long thin horizontal strip, the
   top of the gilded curtain rail with a golden mask in the middle, and just below it
   the folds of red velvet seen from above as a wavy band of red ripples with gold fringe.
   It is a long thin band, about 5 times wider than tall. We do NOT see the curtain hanging.
7. Three open spellbooks lying flat on the floor seen EXACTLY from above, in a loose
   triangle: open pages of cream parchment with violet runes, deep purple leather covers.
   NO aura, NO swirl, NO glow around them: only the books, with hard crisp edges.
```

| Case | id | Nom | Largeur (cases) | Bloque |
|---|---|---|---|---|
| 1 | `telescope-astral` | Télescope astral | 2 | P |
| 2 | `biblio-arcane` | Bibliothèque arcanique | 3 | P V |
| 3 | `piano-spectral` | Piano spectral | 2.5 | P |
| 4 | `banquet-hante` | Banquet hanté | 4 | P |
| 5 | `chandelier-violet` | Chandelier aux flammes violettes | 1.5 | — |
| 6 | `rideau-scene` | Rideau de scène | 5 | P V |
| 7 | `livres-flottants` | Grimoires ouverts | 1.5 | — |

Tout en `magenta-violet`.

# Interlude — Le Noir Marécage

## Bilan des 3 planches (deux de sols, une d'objets)

- **`sols 19`** ✅ marais noir, sable des Grottes du temps aux dalles brisées (tuile 3).
  L'autre planche de sols (« gravés », marais en portrait répété, sable aux grands arcs de
  runes qui se raccordent mal) n'a pas servi.
- **`lot 70`** : 4 objets sur 7 gardés ✅ faille temporelle, sablier géant (vu de profil
  dans son cadre, lisible comme un sceau), arbre mort du marais, dragonide mort. Toute la
  planche en `magenta-violet`. À refaire :
  - la **porte naissante** : en deux moitiés vues de face, échafaudages et échelle debout ;
  - la **bulle de Medivh** : le mage est vu de face, bras levés ;
  - la **pierre de soutien** : de trois-quarts, on voit sa face gravée et les défenses dressées.

## `lot 71.png` — Interlude, à refaire (3) ✅ fait (1er essai, les 3 gardés)

Prompt prêt à coller dans `Prompts assets ChatGPT.txt` (campagne 4), entre ▼▼▼ et ▲▲▲.

```
Create ONE image, 1536x1024, a sprite sheet of EXACTLY 3 separate assets for a top-down tabletop
RPG battle map in the World of Warcraft style (stylized hand-painted, saturated colors, chunky
exaggerated shapes), for the Black Morass in the Caverns of Time (the Dark Portal being built
by the orcs, the mage Medivh, orc Horde rune stones).

BACKGROUND: solid pure magenta (#FF00FF) everywhere around the items, NOT transparent,
NOT a gradient. Purple is allowed, but only a DEEP violet leaning toward blue (royal purple,
indigo), never pink, never magenta. Items do not touch or overlap; leave at least 80 pixels
of clear magenta between items. Every item has a HARD, CRISP, fully opaque outline: no mist,
no smoke, no aura, no haze, no soft glow bleeding onto the background.

CAMERA: strictly orthographic, straight down from the sky (90°), like a floor plan or a
map icon, as a bird directly above sees it. We see ONLY THE TOP of each object: NOTHING
stands up, no front faces, no sides, no perspective, no 3/4 view.
Flat even lighting from above: NO cast shadows. No text, no letters, no grid.

ITEMS, in ONE row of 3, evenly spaced:
1. The Dark Portal under construction seen EXACTLY from above, like on an architect's plan:
   a long thick horizontal bar made of huge square black stone blocks (the TOP of the
   unfinished arch), with a GAP in the middle where the blocks are not yet placed, bright
   fel-green light visible as crisp green cracks between the blocks. Around it, wooden
   scaffolding seen from above as a flat grid of planks, a few stone blocks and crates
   (seen as squares) on the ground. It is wide, about 3 times wider than tall.
   We do NOT see the arch rising, no front of the portal, no ladders standing.
2. Medivh's protective bubble seen EXACTLY from above: a perfect round disk of translucent
   deep violet light with a HARD, CRISP, opaque outline and thin arcane rune lines. In its
   center, a robed mage seen from DIRECTLY ABOVE: we see the round TOP of his dark hood,
   his shoulders with brown feathered pauldrons, and his two arms spread out flat to the
   sides like a star, his robe spread around him. We see the TOP of the head, NOT the face.
3. An orc rune stone seen EXACTLY from above: the flat TOP face of a squat grey boulder,
   an irregular rounded shape like a map icon, a big red orc Horde rune carved on that
   top face, a thick rope tied around its outline, two ivory tusks lying flat on the
   ground pointing outward, tufts of dry grass radiating around it on a patch of mud.
   We do NOT see the side of the stone, nothing stands up.
```

| Case | id | Nom | Largeur (cases) | Bloque |
|---|---|---|---|---|
| 1 | `porte-naissante` | Porte des Ténèbres en construction | 6 | P V |
| 2 | `bulle-medivh` | Bulle de Medivh | 3 | — |
| 3 | `pierre-soutien` | Pierre de soutien orque | 1.5 | P |

Tout en `magenta-violet`.

# Acte 7 — Terres foudroyées

## Bilan des 3 planches (sols 20, murs 16, lot 72)

- **`sols 20`** ✅ terre rouge cendrée, roche volcanique aux veines rougeoyantes, lave en fusion (tuile 3).
- **`murs 16`** ✅ falaise des Terres foudroyées (coupée sans ses bouts arrondis), rempart de la Légion
  (coupé au milieu des piliers d'extrémité). Les deux en `brut` : le raccord en longueur fondait les
  bouts en fantômes translucides.
- **`lot 72`** : 2 objets sur 9 gardés ✅ ruines de forteresse orque, squelette de dragon. À refaire :
  - la **Porte des Ténèbres** et la **statue de démon** : de face ;
  - les **deux tentes**, la **roche fumante** et le **cristal fel** : de trois-quarts (la fumée de la
    roche, en plus, se fondrait dans le magenta) ;
  - le **crâne géant** : de profil, on voit la face.

## `lot 73.png` — Acte 7, à refaire (3 + 4) ✅ fait (1er essai, les 7 gardés)

Prompt prêt à coller dans `Prompts assets ChatGPT.txt` (campagne 4), entre ▼▼▼ et ▲▲▲.

```
Create ONE image, 1536x1024, a sprite sheet of EXACTLY 7 separate assets for a top-down tabletop
RPG battle map in the World of Warcraft style (stylized hand-painted, saturated colors, chunky
exaggerated shapes), for the Blasted Lands (red scorched earth, the closed Dark Portal, the Burning
Legion's black stone and fel-green fire, Alliance and Horde war camps).

BACKGROUND: solid pure magenta (#FF00FF) everywhere around the items, NOT transparent,
NOT a gradient. No pink and no purple in the items. Use fel-green only where asked. Items do not touch or overlap; leave
at least 60 pixels of clear magenta between items. Every item has a HARD, CRISP, fully
opaque outline: NO smoke, NO steam, no mist, no aura, no soft glow bleeding onto the background.

CAMERA: strictly orthographic, straight down from the sky (90°), like a floor plan or a
map icon, as a bird directly above sees it. We see ONLY THE TOP of each object: NOTHING
stands up, nothing hangs, no front faces, no sides, no perspective, no 3/4 view.
Flat even lighting from above: NO cast shadows. No text, no letters, no grid.

ITEMS, row 1 has 3 items, row 2 has 4 items, evenly spaced:
Row 1:
1. The Dark Portal of World of Warcraft, CLOSED, seen EXACTLY from above like on an
   architect's plan. It stands on a huge raised square platform of dark grey-brown stone
   slabs, with a wide staircase seen as parallel flat strips going down its front edge.
   On the platform, the TOP of the colossal arch: a very long, very thick horizontal bar of
   massive weathered stone blocks with jagged broken spikes along it, ending at each side in
   an enormous stepped square pillar base. Along the middle of the bar, a thin straight
   band of calm, glowing ICE-BLUE light (the closed portal surface seen edge-on from above,
   crisp edges, no swirl). In front of each pillar base, a colossal crouching guardian statue
   of dark stone seen from above: the top of its horned head and its huge hunched shoulders.
   About 3 times wider than tall. NO green anywhere on this item. We do NOT see the portal
   opening, no front face, no vortex facing us.
2. A giant demon statue seen EXACTLY from above: a square black stone plinth with bronze
   corner studs, and on it the statue seen from above: the top of a horned head (two
   big curved horns as crescents), broad shoulders, two huge wings spread flat to the
   sides like a bat seen from the sky. We see the TOP of the head, NOT the face.
3. A large Alliance command tent seen EXACTLY from above: an octagon of blue canvas with
   the roof seams as lines radiating from a golden central pole cap, gold trim along the
   edge, a few crates (seen as squares) and two blue-and-gold banners lying flat on the
   ground beside it. We do NOT see the walls, the door or any hanging banner.
Row 2:
4. A large Horde command tent seen EXACTLY from above: a round roof of red-brown hides
   with the seams radiating from a central pole topped by bone tusks, big ivory tusks
   lying flat around the edge pointing outward, crates seen as squares. We do NOT see the
   walls, the entrance or any hanging banner.
5. A volcanic rock seen EXACTLY from above: an irregular rounded cluster of black basalt
   blocks seen from the top as flat polygons, with glowing orange-red lava cracks between
   them as crisp lines, a ring of small black rocks around. NO smoke, NO steam, no glow halo.
6. A giant's skull half buried, seen EXACTLY from above: we see the TOP of the cranium, a
   big rounded dome of cracked ivory bone like an egg seen from above, with only the brow
   ridge and two tusks poking out at the front edge, half sunk in a patch of red earth with
   dry grass. We do NOT see the face, the eye sockets or the teeth.
7. A gigantic fel crystal cluster seen EXACTLY from above: a star of bright fel-green
   crystal points radiating outward from the center like a flower, each crystal seen from
   above as a flat elongated hexagon with a lighter facet line, surrounded by a ring of
   black rocks with green cracks. We do NOT see the crystals' height, nothing rises toward us.
```

| Case | id | Nom | Largeur (cases) | Bloque |
|---|---|---|---|---|
| 1 | `porte-tenebres` | La Porte des Ténèbres (fermée) | 8 | P V |
| 2 | `statue-demon` | Statue de démon géante | 3 | P V |
| 3 | `tente-alliance` | Tente de commandement de l'Alliance | 4 | P V |
| 4 | `tente-horde` | Tente de commandement de la Horde | 4 | P V |
| 5 | `roche-fumante` | Rocher volcanique | 2.5 | P |
| 6 | `crane-geant` | Crâne de géant | 3 | P |
| 7 | `cristal-fel-geant` | Cristal fel géant | 3 | P |

# Bonus — effets et marqueurs

## Bilan de la planche (lot 74)

- **`lot 74`** : les 4 marqueurs gardés ✅ point d'exclamation, point d'interrogation, tête de mort,
  flèche dorée (nouveau rayon « Marqueurs »). Les 6 effets semi-transparents (brume, ombre de nuage,
  cercle de soin, givre, feu, aura d'ombre) se mêlent au magenta : refaits **sur fond noir**
  (`fond: 'noir'`, la luminosité devient l'opacité). L'ombre de nuage est un nuage gris clair repeint
  en noir par la découpe (`teinte: [0, 0, 0]`, `opacite`).

## `lot 75.png` — les effets, sur fond noir (3 + 3) ✅ fait (1er essai, les 6 gardés)

Prompt prêt à coller dans `Prompts assets ChatGPT.txt` (campagne 4), entre ▼▼▼ et ▲▲▲.

```
Create ONE image, 1536x1024, a sprite sheet of EXACTLY 6 separate glowing magic EFFECTS for a
top-down tabletop RPG battle map in the World of Warcraft style (stylized hand-painted,
saturated colors). These are light overlays that will be laid on top of the map.

BACKGROUND: solid pure BLACK (#000000) everywhere around the effects, NOT a gradient, NOT a
dark texture, no vignette, no stars. The effects are made ONLY of light and bright colors:
NO black or dark outlines, NO dark shading, NO dark parts inside them (everything dark will
become transparent). Each effect fades softly into the black at its edges. Effects do not
touch or overlap; leave at least 60 pixels of pure black between them.

CAMERA: strictly from above (90°), like effects painted on the floor of a map. No perspective,
no 3/4 view, no objects, no characters, no text, no grid.

EFFECTS, 2 rows of 3, evenly spaced, each about 400 pixels wide:
Row 1:
1. A patch of soft white mist seen from above: an irregular wide cloud of pale white-grey
   wisps, brightest in the middle, fading softly to black at the edges.
2. A single soft cloud shape seen from above: one rounded fluffy cloud of plain flat light
   grey, uniform, with soft edges fading to black. No details, no color.
3. A healing circle on the ground: a ring of bright warm golden holy light with small
   glowing golden runes along it, a soft golden glow filling the inside, light rays.
Row 2:
4. A frost zone on the ground: an irregular round patch of icy light blue and white frost,
   frost-fern patterns and small ice crystals, glowing pale cyan.
5. A fire zone on the ground seen from above: a round patch of bright orange and yellow
   flames and glowing embers, hottest yellow-white in the middle, flame tongues at the edge.
6. A shadow aura on the ground: a swirling ring of glowing deep violet and purple magic
   wisps, brighter violet sparks on the ring, a faint violet glow inside.
```

| Case | id | Nom | Largeur (cases) | Découpe |
|---|---|---|---|---|
| 1 | `eff-brume` | Nappe de brume | 4 | — |
| 2 | `eff-ombre-nuage` | Ombre de nuage | 5 | teinte noire, opacité 0,7 |
| 3 | `eff-cercle-soin` | Cercle de soin | 3 | — |
| 4 | `eff-zone-givre` | Zone de givre | 3 | — |
| 5 | `eff-zone-feu` | Zone de feu | 3 | — |
| 6 | `eff-aura-ombre` | Aura d'ombre | 3 | — |

Tout en `noir`, rayon « Effets ».
