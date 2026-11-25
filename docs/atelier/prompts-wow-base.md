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
