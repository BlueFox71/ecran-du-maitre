# Prompts — Jardin de Jade, sous-sol : The Nine Lives

Le speakeasy des années 1920 sous le Jardin de Jade, muré depuis 1926 : poussière,
toiles d'araignée, fleurs séchées, le corps de Rosalind et les huit chats. Deux planches
au format habituel (**1536 × 1024**, fond **magenta pur**).

Déjà dans l'atelier, à réutiliser : sols `terre-battue`, `sol-bar`, `parquet-sombre` ;
murs `moellons`, `briques`, `briques-suie`, `mur-boiserie-doree` ; `tonneau`,
`casier-vin`, `crane`, toiles d'araignée, `lustre-bougies`, `lampe-petrole`, et les
escaliers du `lot 45` (dont celui aux marches cassées).

⚠ Le détourage enlève le rose : pas de fleurs roses, pas de velours rose.

## 1. `lot 46.png` — The Nine Lives (5 × 4)

```
Create ONE image, 1536x1024, a sprite sheet of 20 separate assets for a top-down tabletop
RPG battle map of a 1920s prohibition speakeasy hidden in a cellar, ABANDONED AND
WALLED UP FOR A HUNDRED YEARS: thick grey dust on everything, cobwebs, tarnished brass,
faded colors, dried flowers.

BACKGROUND: solid pure magenta (#FF00FF) everywhere around the items. ABSOLUTELY NO
pink, magenta, purple or violet inside an item. Items do not touch or overlap; leave at
least 30 pixels of clear magenta between items.

CAMERA AND STYLE: strictly orthographic, straight down (90°), no perspective, no
visible sides or fronts: we see only the TOP of each object. Realistic hand-painted
digital art, finely detailed, like premium battle map assets, eerie and melancholic but
not gory. Flat even lighting from directly above: NO cast shadows, NO glow. No text, no
letters, no numbers, no logos, no labels, no grid. No living people.

ITEMS, 4 rows of 5, left to right:
Row 1 (the dead):
1. The mummified body of a young woman in a 1920s flapper dress (faded jade green with
   tarnished beads), sitting on the floor with her back against a wall, legs stretched
   out, head bowed, dry dark hair in a bob, a long string of pearls, one hand closed.
2. A small cat skeleton curled up as if asleep, with a thin leather collar and a tiny
   brass tag.
3. A small cat skeleton lying on its side, stretched out, with a thin leather collar.
4. Three small cat skeletons huddled together against each other, each with a collar.
5. A pile of broken red bricks, mortar chunks and dust, as left after breaking through
   a walled-up doorway.
Row 2 (music):
6. A 1920s upright piano in dark wood, lid closed, keyboard cover closed, thick dust,
   a few dried petals on top (seen from above: the long top and the keyboard edge).
7. A small upholstered piano bench, faded dark green velvet, dusty.
8. An antique gramophone with a large brass horn, on a small round side table.
9. A long garland of dried flowers and faded ribbons (brown, ochre, faded yellow and
   dusty white roses), lying horizontally.
10. A fallen painted wooden sign lying flat on the floor: a black cat with nine tails
    on a dark green background with a gold Art Deco border, cracked paint, NO text.
Row 3 (the bar):
11. A long straight 1920s bar counter in dark mahogany with a brass foot rail, dusty,
    a few old bottles and dirty glasses on top (long, lying horizontally).
12. The matching L-shaped CORNER piece of the same mahogany bar counter.
13. A back bar against the wall: dark wood shelves with rows of old dusty liquor
    bottles and a large cracked mirror in a gilded frame, wall side at the top.
14. Two old oak whiskey barrels side by side on a wooden cradle.
15. A small framed old sepia photograph lying face up, an old group portrait, cracked
    glass, a few cobwebs.
Row 4 (the room):
16. A small round 1920s table with a white marble top and black iron base, with two
    dusty cocktail glasses, a scattered deck of playing cards and an ashtray.
17. A bentwood bistro chair lying OVERTURNED on its side.
18. An upright bentwood bistro chair.
19. An octagonal poker table with faded green felt, scattered poker chips and cards.
20. A large Art Deco ceiling chandelier in tarnished brass and frosted glass, covered
    in cobwebs, seen from below, NO chain, NO cable.
```

| Case | id | Nom | Largeur (cases) | Bloque |
|---|---|---|---|---|
| 1 | `corps-rosalind` | Corps momifié en robe des années 20 | 0,8 | — |
| 2 | `chat-squelette-enroule` | Squelette de chat enroulé | 0,3 | — |
| 3 | `chat-squelette-allonge` | Squelette de chat allongé | 0,4 | — |
| 4 | `chats-squelettes-blottis` | Trois squelettes de chats | 0,6 | — |
| 5 | `gravats-briques` | Gravats de briques | 1 | — |
| 6 | `piano-droit` | Piano droit | 1 | P V |
| 7 | `banquette-piano-droit` | Banquette de piano | 0,6 | P |
| 8 | `gramophone` | Gramophone | 0,6 | P |
| 9 | `guirlande-fleurs-sechees` | Guirlande de fleurs séchées | 2 | — |
| 10 | `enseigne-nine-lives` | Enseigne du chat à neuf queues | 1,2 | — |
| 11 | `comptoir-acajou` | Comptoir en acajou | 2 | P |
| 12 | `comptoir-acajou-angle` | Angle du comptoir en acajou | 1,2 | P |
| 13 | `arriere-bar-miroir` | Arrière-bar au miroir fendu | 2 | P |
| 14 | `tonneaux-whiskey` | Tonneaux de whiskey | 1 | P |
| 15 | `photo-famille-1925` | Photo de famille encadrée | 0,25 | — |
| 16 | `table-annees-20` | Table ronde des années 20 | 0,7 | P |
| 17 | `chaise-bistrot-renversee` | Chaise bistrot renversée | 0,5 | — |
| 18 | `chaise-bistrot` | Chaise bistrot | 0,4 | — |
| 19 | `table-poker` | Table de poker | 1,2 | P |
| 20 | `lustre-art-deco` | Lustre Art déco | 1 | — |

## 2. `ouvertures 5.png` — les portes du sous-sol (2 × 3)

Premier essai raté : ChatGPT a dessiné la FACE des portes (vues de devant), poignée posée
sur le battant. Vue de dessus, on ne voit que la TRANCHE du battant fermé : une bande
fine, avec la poignée qui dépasse de chaque côté, comme sur `ouvertures 4.png`.

```
Create ONE image, 1536x1024, a sprite sheet of 6 separate DOOR assets for a top-down
tabletop RPG battle map, in 3 rows of 2.

BACKGROUND: solid pure magenta (#FF00FF) everywhere around the items. No magenta, pink
or purple inside an item. Items do not touch or overlap.

CAMERA: strictly orthographic, looking STRAIGHT DOWN from the ceiling, like a floor plan.
IMPORTANT: we do NOT see the face of the door. A closed door seen from above is only its
TOP EDGE: a long, very THIN horizontal strip (the thickness of the leaf, about 12 times
longer than thick), lying horizontally and centered in its cell, between two small
square door posts (the top of the door frame) at each end. The lever handles stick OUT
of the leaf, one ABOVE the strip and one BELOW it, near the RIGHT end, seen from above
as small L-shaped levers (one handle on each face of the door). Small hinge knuckles at
the LEFT end. Nothing is drawn on the strip itself except the texture of its top edge.

STYLE: realistic hand-painted digital art, finely detailed, like premium battle map
assets. Flat even lighting from above, NO cast shadows. No text, no letters, no grid, no
people.

DOORS, left to right, top to bottom:
1. A doorway walled up with old red bricks: seen from above, a narrow strip of brick
   tops and grey mortar, one brick thick, between two old stone posts, dusty, cobwebs.
   NO handles, NO hinges.
2. The same walled-up doorway, with a ragged gap broken through the middle of the
   strip, loose bricks scattered on both sides of the gap. NO handles, NO hinges.
3. A heavy 1920s speakeasy door: the thick top edge of a dark oak leaf with iron
   bands, black iron lever handles above and below at the right end, big iron hinges
   at the left end.
4. A padded door: the top edge of a leaf covered in dark green leather with brass
   nails along it, brass lever handles above and below at the right end.
5. An old rotten wooden cellar door: the top edge of grey split planks, rusty iron
   ring handles above and below at the right end, rusty hinges at the left end.
6. An Art Deco double door: two thin dark wood leaves meeting in the middle, brass
   trim along their top edges, a brass lever handle above and below at the middle
   where they meet, hinges at both outer ends.
```

| Case | id | Nom | Nature |
|---|---|---|---|
| 1 | `porte-muree` | Porte murée | porte |
| 2 | `porte-muree-percee` | Porte murée, percée | porte |
| 3 | `porte-speakeasy` | Porte de speakeasy | porte |
| 4 | `porte-capitonnee` | Porte capitonnée | porte |
| 5 | `porte-cave-pourrie` | Porte de cave pourrie | porte |
| 6 | `porte-art-deco` | Porte double Art déco | porte |
