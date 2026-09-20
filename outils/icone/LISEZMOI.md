# L'icône de l'application

Un paravent de maître de jeu, vu de trois quarts, en laiton sur l'encre de
l'application.

```bash
node outils/icone/graver.cjs
```

Écrit trois fichiers dans `resources/` :

| Fichier | À quoi il sert |
| --- | --- |
| `icon.ico` | l'icône que Windows affiche partout ; `electron-builder` la reprend telle quelle |
| `icon.png` | la même en 512, pour les usages qui ne lisent pas le `.ico` |
| `icon.svg` | le dessin source, si tu veux le retoucher à la main ailleurs |

Aucune dépendance : le dessin n'est fait que de polygones et de deux dégradés,
alors `rendu.cjs` les peint lui-même et `ico.cjs` assemble le fichier.

## Un dessin par taille, pas une image réduite

Un `.ico` n'est pas une image que Windows rétrécit : c'est un jeu d'images dans
lequel il pioche celle qui tombe juste. Le fichier en contient donc sept —
16, 24, 32, 48, 64, 128, 256 — et **deux versions du dessin** :

- **détaillé** (48 px et plus) : les trois volets, le chant du carton, et la
  table de règles imprimée sur le grand volet ;
- **simplifié** (32 px et moins) : sans l'imprimé, qui ne ferait qu'un bruit
  gris, avec des écarts de ton plus francs et l'objet un rien plus gros.

Les couches jusqu'à 64 px sont stockées en DIB 32 bits, les deux grandes en
PNG : c'est la combinaison que toutes les versions de Windows savent lire.

## Pourquoi ce dessin-là

Un paravent dessiné de face, à trois volets égaux, sur une base droite, **est**
une fenêtre — l'œil n'a aucun moyen de faire la différence. Trois choses l'en
sortent, et elles sont toutes dans `paravent.cjs` :

1. des volets de largeur inégale (144, 116, 76), donc une vraie perspective ;
2. une arête **et** une base qui zigzaguent, l'accordéon se voyant en haut comme en bas ;
3. la table de règles imprimée sur le grand volet : rien de vitré ne porte de texte.

## Retoucher

Tout le dessin tient dans `paravent.cjs`, en coordonnées d'une vignette de 512 :
les sommets des volets, les trois tons de laiton, les barres de l'imprimé.
Change ce que tu veux, relance `graver.cjs`, regarde le résultat en petit —
c'est à 16 px que se jugent les icônes, pas en 512.
