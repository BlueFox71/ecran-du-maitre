# Prompts ChatGPT — premier pack d'assets de l'atelier

Objectif : un **petit pack de test** (une vingtaine d'images) pour monter une maison
hantée comme l'image de référence. Il ne vise pas l'exhaustivité ; il doit être
**cohérent**, comme si tout sortait du même jeu.

Les prompts sont en anglais : les générateurs d'images y sont plus réguliers. Les
explications restent en français.

## Comment s'y prendre

1. **Une seule conversation ChatGPT pour tout le pack.** Colle d'abord le **bloc de
   style** ci-dessous, seul, et demande « Réponds juste OK, puis applique ce style à
   toutes les images que je te demanderai ». Les images suivantes restent ainsi dans le
   même univers.
2. Envoie ensuite les prompts **un par un**. Si une image dérive (perspective de biais,
   ombre peinte, fond non transparent), réponds « Same style rules: strictly top-down,
   no cast shadow, transparent background », puis régénère.
3. Télécharge chaque image en **PNG** et range-la **sous le nom indiqué** dans
   `resources/atelier/` (crée les sous-dossiers `sols`, `murs`, `ouvertures`, `objets`).
   Je ferai le catalogue à partir de ces noms.

Ce que l'application fera d'elle-même à l'import, donc **inutile de retoucher** :
- recadrer le vide transparent autour d'un objet ;
- mettre l'objet à sa taille réelle (indiquée ci-dessous) ;
- rendre une texture de sol ou de mur **raccordable** si elle ne l'est pas tout à fait ;
- ajouter une ombre portée commune à tous les objets (c'est pour ça qu'on n'en veut
  **pas** dans l'image).

## Le bloc de style (à coller en premier)

```
STYLE RULES FOR EVERY IMAGE IN THIS CONVERSATION
- Asset for a top-down battle map of a haunted Victorian manor (tabletop RPG).
- Camera: strictly orthographic, straight down from the ceiling (90°). No perspective,
  no isometric angle, no visible sides of objects except what is seen from directly above.
- Rendering: realistic hand-painted digital art, finely detailed, like premium animated
  battle maps. Slightly worn, dusty, old.
- Palette: dark, desaturated, cold. Browns, greys, deep greens, dull blues. No bright colors.
- Lighting: flat, neutral and even, as if lit uniformly from straight above.
  NO cast shadows, NO light pools, NO glow, NO vignette. Lighting will be added later in the app.
- One single subject per image, centered, filling most of the frame.
- No text, no labels, no watermark, no border, no grid, no characters.
```

## Sols — textures raccordables

Format : **1024 × 1024**, image pleine (pas de transparence). À ajouter à la fin de
chaque prompt :

```
Seamless tileable texture: the left edge must continue the right edge and the top edge
must continue the bottom edge. Uniform coverage, no focal point, no large unique feature.
```

| Fichier | Taille réelle d'une tuile | Prompt |
|---|---|---|
| `sols/parquet-sombre.png` | 2 × 2 cases | `Top-down texture of an old dark oak plank floor, narrow boards running vertically, scuffed, dusty, a few cracks.` |
| `sols/damier-use.png` | 2 × 2 cases | `Top-down texture of a worn black and white checkerboard marble tile floor, small square tiles, grime in the grout, some chipped tiles.` |
| `sols/dalles-pierre.png` | 3 × 3 cases | `Top-down texture of large irregular grey flagstones, old and uneven, moss in some joints, dust.` |
| `sols/parquet-vert.png` | 2 × 2 cases | `Top-down texture of an old faded dark green herringbone wooden parquet floor, aged varnish.` |
| `sols/terre-herbe.png` | 3 × 3 cases | `Top-down texture of dark damp soil with sparse dead grass and a few dry leaves, gloomy.` |

## Murs — textures raccordables en longueur

Format : **1536 × 1024** (paysage), image pleine. Le mur sera vu **par le dessus** :
c'est le haut d'un mur épais qu'on voit, pas sa façade. À ajouter :

```
Seamless tileable horizontally: the left edge must continue the right edge.
Texture of the TOP of a thick wall seen from above, filling the whole frame.
```

| Fichier | Prompt |
|---|---|
| `murs/pierre-sombre.png` | `Top of a thick wall made of dark grey rough stone blocks and mortar, seen from directly above, worn edges.` |
| `murs/platre-boiserie.png` | `Top of a thick interior wall, dark wooden beam on top with old plaster, seen from directly above.` |

## Portes et fenêtres — PNG transparents

Format : **1536 × 1024** (paysage), **fond transparent**. La porte est vue fermée, par
le dessus : un battant posé dans l'épaisseur d'un mur horizontal.

| Fichier | Prompt |
|---|---|
| `ouvertures/porte-bois.png` | `Top-down view of a closed old wooden door leaf as seen from above (a thin long plank rectangle), with its frame, dark wood, iron hinges visible on one end. Transparent background.` |
| `ouvertures/porte-double.png` | `Top-down view of a closed ornate double wooden door as seen from above, two thin leaves meeting in the middle, with frame. Transparent background.` |
| `ouvertures/fenetre.png` | `Top-down view of a window set in a thick wall, as seen from above: thin glass pane between a stone sill and wooden frame, dusty glass. Transparent background.` |

## Objets — PNG transparents

Format : **1024 × 1024**, **fond transparent**. À ajouter à chaque prompt :
`Transparent background. Seen strictly from above.`

« Bloque » : la valeur par défaut, modifiable ensuite pour chaque objet posé.
**P** = bloque le passage, **V** = bloque la vue.

### Chambre
| Fichier | Taille (cases) | Bloque | Prompt |
|---|---|---|---|
| `objets/lit-double.png` | 1,2 × 1,5 | P | `An old double bed with carved dark wood headboard, rumpled grey-white sheets and a faded quilt, two pillows.` |
| `objets/commode.png` | 1 × 0,4 | P | `A Victorian chest of drawers with a dusty top, a small mirror lying on it and a candle.` |
| `objets/table-de-nuit.png` | 0,35 × 0,35 | P | `A small bedside table with an oil lamp and an open book.` |

### Salon
| Fichier | Taille (cases) | Bloque | Prompt |
|---|---|---|---|
| `objets/canape-chesterfield.png` | 1,4 × 0,6 | P | `A dark green tufted leather Chesterfield sofa, worn and cracked leather.` |
| `objets/fauteuil.png` | 0,6 × 0,6 | P | `An antique armchair with faded dark green velvet upholstery.` |
| `objets/table-ronde.png` | 0,8 × 0,8 | P | `A round dark wooden table with a lace doily and a candlestick in the center.` |
| `objets/tapis-orient.png` | 2 × 1,4 | — | `A large faded oriental rug with intricate dark red and blue patterns, frayed edges, a few stains.` |
| `objets/tapis-rond.png` | 1,6 × 1,6 | — | `A round ornate rug with a circular medallion pattern, faded beige and brown.` |
| `objets/cheminee.png` | 1,2 × 0,5 | P V | `A stone fireplace with an iron grate and cold ashes, mantel with two candles, seen from above.` |

### Bibliothèque et bureau
| Fichier | Taille (cases) | Bloque | Prompt |
|---|---|---|---|
| `objets/bibliotheque.png` | 1,2 × 0,35 | P V | `A tall dark wooden bookshelf seen from above: only its top is visible, with some books and papers stacked on it.` |
| `objets/bureau.png` | 1 × 0,6 | P | `An old writing desk with scattered papers, an inkwell, a quill and a candle.` |
| `objets/chaise.png` | 0,35 × 0,35 | — | `A simple antique wooden chair.` |

### Salle de bain
| Fichier | Taille (cases) | Bloque | Prompt |
|---|---|---|---|
| `objets/baignoire.png` | 1,1 × 0,55 | P | `A Victorian clawfoot bathtub, stained white enamel, murky water inside.` |

### Architecture
| Fichier | Taille (cases) | Bloque | Prompt |
|---|---|---|---|
| `objets/escalier-droit.png` | 0,8 × 2 | — | `A straight wooden staircase going down, seen from above, steps getting darker toward the bottom, with a banister on one side.` |

### Horreur
| Fichier | Taille (cases) | Bloque | Prompt |
|---|---|---|---|
| `objets/toile-coin.png` | 0,8 × 0,8 | — | `A thick spider web made to sit in a room corner, semi-transparent white strands, dusty.` |
| `objets/toile-grande.png` | 1,5 × 1,5 | — | `A large sprawling spider web covering furniture, semi-transparent white strands, ragged.` |
| `objets/bougies.png` | 0,3 × 0,3 | — | `A cluster of melted white candles on the floor with wax drips, unlit.` |
| `objets/tache-sang.png` | 0,8 × 0,8 | — | `An old dried dark blood stain on the floor with drag marks.` |

## Vérifier une texture raccordable (facultatif)

Ouvre l'image dans n'importe quel éditeur et décale-la de la moitié de sa largeur et de
sa hauteur (dans Photopea : *Filtre → Autre → Décalage*). S'il n'y a pas de couture
nette au centre, elle est raccordable. Sinon l'application atténuera la couture à
l'import, mais un motif trop marqué (une planche unique, une grosse tache) se verra
quand même répété : régénère-la en insistant sur « uniform coverage, no focal point ».
