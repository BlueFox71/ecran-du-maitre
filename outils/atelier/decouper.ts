/**
 * Découpe les planches générées (docs/atelier/planches) en assets du pack
 * (resources/atelier) et réécrit son catalogue.
 *
 *   npx vite-node outils/atelier/decouper.ts
 *
 * Chaque planche est une grille : on prend, dans chaque case, la boîte de ce
 * qui n'est pas le fond. Le fond est magenta (objets, portes, textures entre
 * bandes) ou noir (toiles d'araignée : la clarté devient l'opacité).
 * Ajouter une planche = ajouter une entrée à PLANCHES, puis relancer.
 */
import { PNG } from 'pngjs'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  boiteOpaque,
  detourerMagenta,
  lumiereEnAlpha,
  raccorder,
  type TypeAsset
} from '../../src/shared/atelierAssets'

const RACINE = join(__dirname, '..', '..')
const SOURCES = join(RACINE, 'docs', 'atelier')
const PACK = join(RACINE, 'resources', 'atelier')

interface Case {
  id: string
  nom: string
  /** Objet : largeur réelle en cases ; la hauteur suit les proportions de l'image. */
  l?: number
  pas?: boolean
  vue?: boolean
  /** Sol, mur : cases couvertes par une tuile. */
  tuile?: number
  /** Ne pas raccorder : un motif régulier (damier) se brouillerait en deux grilles décalées. */
  brut?: boolean
}

/**
 * Le rangement des objets : catégorie et sous-catégorie, par id. Ce qui n'y
 * est pas garde la catégorie de sa planche.
 */
const RANGEMENT: Record<string, [string, string]> = {
  'lit-double': ['Mobilier', 'Lits'],
  'canape-chesterfield': ['Mobilier', 'Assises'],
  fauteuil: ['Mobilier', 'Assises'],
  chaise: ['Mobilier', 'Assises'],
  'table-ronde': ['Mobilier', 'Tables'],
  'table-de-nuit': ['Mobilier', 'Tables'],
  bureau: ['Mobilier', 'Tables'],
  commode: ['Mobilier', 'Rangements'],
  bibliotheque: ['Mobilier', 'Rangements'],
  baignoire: ['Mobilier', 'Bain'],
  cheminee: ['Mobilier', 'Cheminées'],
  'lampe-huile': ['Lumière', 'Lampes'],
  bougeoir: ['Lumière', 'Bougies'],
  chandelier: ['Lumière', 'Bougies'],
  'livre-ouvert': ['Objets', 'Livres et papiers'],
  'pile-livres': ['Objets', 'Livres et papiers'],
  lettres: ['Objets', 'Livres et papiers'],
  encrier: ['Objets', 'Livres et papiers'],
  tasse: ['Objets', 'Vaisselle'],
  miroir: ['Objets', 'Décoration'],
  napperon: ['Objets', 'Décoration'],
  coffret: ['Objets', 'Décoration'],
  crane: ['Macabre', 'Ossements'],
  'escalier-droit': ['Architecture', 'Escaliers'],
  'toile-coin': ['Nature', 'Toiles d’araignées'],
  'toile-ronde': ['Nature', 'Toiles d’araignées'],
  'toile-dense': ['Nature', 'Toiles d’araignées'],
  'toile-tendue': ['Nature', 'Toiles d’araignées'],
  'toile-petite': ['Nature', 'Toiles d’araignées'],
  'toile-eparse': ['Nature', 'Toiles d’araignées'],
  'chene-dense': ['Nature', 'Arbres'],
  'arbre-griffu': ['Nature', 'Arbres'],
  pin: ['Nature', 'Arbres'],
  saule: ['Nature', 'Arbres'],
  'chene-jeune': ['Nature', 'Arbres'],
  chene: ['Nature', 'Arbres'],
  'chene-grand': ['Nature', 'Arbres'],
  'chene-degarni': ['Nature', 'Arbres'],
  'sapin-jeune': ['Nature', 'Arbres'],
  sapin: ['Nature', 'Arbres'],
  'sapin-grand': ['Nature', 'Arbres'],
  'sapin-roussi': ['Nature', 'Arbres'],
  'mort-petit': ['Nature', 'Arbres'],
  mort: ['Nature', 'Arbres'],
  'mort-grand': ['Nature', 'Arbres'],
  'mort-mousse': ['Nature', 'Arbres'],
  buisson: ['Nature', 'Végétation'],
  ronces: ['Nature', 'Végétation'],
  'hautes-herbes': ['Nature', 'Végétation'],
  champignons: ['Nature', 'Végétation'],
  rochers: ['Nature', 'Rochers'],
  'gros-rocher': ['Nature', 'Rochers'],
  'tronc-couche': ['Nature', 'Bois mort'],
  souche: ['Nature', 'Bois mort'],
  'table-a-manger': ['Mobilier', 'Tables'],
  'canape-bordeaux': ['Mobilier', 'Assises'],
  'table-ovale-marbre': ['Mobilier', 'Tables'],
  'piano-a-queue': ['Mobilier', 'Musique'],
  'lit-damasse': ['Mobilier', 'Lits'],
  'cheminee-marbre': ['Mobilier', 'Cheminées'],
  'volaille-rotie': ['Objets', 'Nourriture'],
  'roti': ['Objets', 'Nourriture'],
  'tarte': ['Objets', 'Nourriture'],
  'plateau-fromages': ['Objets', 'Nourriture'],
  'poisson': ['Objets', 'Nourriture'],
  'pain': ['Objets', 'Nourriture'],
  'ragout': ['Objets', 'Nourriture'],
  'soupe': ['Objets', 'Nourriture'],
  'corbeille-fruits': ['Objets', 'Nourriture'],
  'gateau': ['Objets', 'Nourriture'],
  'biscuits': ['Objets', 'Nourriture'],
  'coupe-baies': ['Objets', 'Nourriture'],
  'lustre-bougies': ['Lumière', 'Plafonniers'],
  'lustre-roue': ['Lumière', 'Plafonniers'],
  'plafonnier-tulipes': ['Lumière', 'Plafonniers'],
  'suspension-cloche': ['Lumière', 'Plafonniers'],
  'globe-verre': ['Lumière', 'Plafonniers'],
  'lustre-cristal': ['Lumière', 'Plafonniers'],
  'lustre-fer': ['Lumière', 'Plafonniers'],
  'plafonnier-vitrail': ['Lumière', 'Plafonniers'],
  'lustre-globes': ['Lumière', 'Plafonniers'],
  'suspension-ajouree': ['Lumière', 'Plafonniers'],
  'plafonnier-vert': ['Lumière', 'Plafonniers'],
  'globe-dore': ['Lumière', 'Plafonniers'],
  'lampe-tiffany': ['Lumière', 'Lampes'],
  'lanterne': ['Lumière', 'Lampes'],
  'lampe-banquier': ['Lumière', 'Lampes'],
  'lampe-petrole': ['Lumière', 'Lampes'],
  'lanterne-gothique': ['Lumière', 'Lampes'],
  'lanterne-noire': ['Lumière', 'Lampes'],
  'lampe-banquier-verte': ['Lumière', 'Lampes'],
  'lampe-huile-rose': ['Lumière', 'Lampes'],
  'lampadaire-franges': ['Lumière', 'Lampadaires'],
  'applique-lanterne': ['Lumière', 'Appliques'],
  'bougeoir-laiton': ['Lumière', 'Bougies'],
  'bougeoir-main': ['Lumière', 'Bougies'],
  'escalier-bois': ['Architecture', 'Escaliers'],
  'escalier-tapis-rouge': ['Architecture', 'Escaliers'],
  'escalier-palier': ['Architecture', 'Escaliers'],
  'escalier-demi-lune': ['Architecture', 'Escaliers'],
  'escalier-quart-tournant': ['Architecture', 'Escaliers'],
  'colimacon-bois': ['Architecture', 'Escaliers'],
  'escalier-imperial': ['Architecture', 'Escaliers'],
  'colimacon-pierre': ['Architecture', 'Escaliers'],
  'escalier-lumineux': ['Architecture', 'Escaliers'],
  'escalier-metal': ['Architecture', 'Escaliers'],
  'escalier-equerre': ['Architecture', 'Escaliers'],
  'escalier-courbe': ['Architecture', 'Escaliers'],
  'bureau-ministre': ['Mobilier', 'Tables'],
  'table-fleurie': ['Mobilier', 'Tables'],
  'console-roses': ['Mobilier', 'Tables'],
  'buffet-bustes': ['Mobilier', 'Rangements'],
  'chesterfield-plaid': ['Mobilier', 'Assises'],
  'fauteuil-club': ['Mobilier', 'Assises'],
  'tapis-table-basse': ['Mobilier', 'Tables'],
  'meridienne': ['Mobilier', 'Assises'],
  'lit-coussins': ['Mobilier', 'Lits'],
  'armoire': ['Mobilier', 'Rangements'],
  'coiffeuse': ['Mobilier', 'Rangements'],
  'paravent': ['Mobilier', 'Paravents'],
  'plan-de-travail': ['Mobilier', 'Cuisine'],
  'cuisiniere-bois': ['Mobilier', 'Cuisine'],
  'evier-pierre': ['Mobilier', 'Cuisine'],
  'vaisselier': ['Mobilier', 'Cuisine'],
  'glaciere': ['Mobilier', 'Cuisine'],
  'table-cuisine': ['Mobilier', 'Tables'],
  'plan-patisserie': ['Mobilier', 'Cuisine'],
  'casseroles-suspendues': ['Mobilier', 'Cuisine'],
  'garde-manger': ['Mobilier', 'Cuisine'],
  'tonneau': ['Mobilier', 'Cuisine'],
  'casier-vin': ['Mobilier', 'Cuisine'],
  'buffet-cuisine': ['Mobilier', 'Cuisine'],
  'baignoire-mousse': ['Mobilier', 'Bain'],
  'double-vasque': ['Mobilier', 'Bain'],
  'toilettes': ['Mobilier', 'Bain'],
  'bidet': ['Mobilier', 'Bain'],
  'douche': ['Mobilier', 'Bain'],
  'armoire-linge': ['Mobilier', 'Bain'],
  'coiffeuse-bain': ['Mobilier', 'Bain'],
  'porte-serviettes': ['Mobilier', 'Bain'],
  'panier-linge': ['Mobilier', 'Bain'],
  'meuble-lavabo': ['Mobilier', 'Bain'],
  'tapis-oriental-bain': ['Mobilier', 'Tapis'],
  'desserte-bain': ['Mobilier', 'Bain'],
  'lit-baroque': ['Mobilier', 'Lits'],
  'lit-baldaquin': ['Mobilier', 'Lits'],
  'coiffeuse-miroir': ['Mobilier', 'Rangements'],
  'armoire-chambre': ['Mobilier', 'Rangements'],
  'meridienne-plaid': ['Mobilier', 'Assises'],
  'fauteuil-capitonne': ['Mobilier', 'Assises'],
  'gueridon-lampe': ['Mobilier', 'Tables'],
  'secretaire': ['Mobilier', 'Tables'],
  'coffre-fer': ['Mobilier', 'Rangements'],
  'chevet-lys': ['Mobilier', 'Tables'],
  'table-ovale-noire': ['Mobilier', 'Tables'],
  'table-ronde-marquetee': ['Mobilier', 'Tables'],
  'table-ovale-ornee': ['Mobilier', 'Tables'],
  'table-octogonale': ['Mobilier', 'Tables'],
  'table-octogonale-verte': ['Mobilier', 'Tables'],
  'gueridon-marbre': ['Mobilier', 'Tables'],
  'table-ronde-rosace': ['Mobilier', 'Tables'],
  'table-ovale-marbree': ['Mobilier', 'Tables'],
  'table-planches': ['Mobilier', 'Tables'],
  'fauteuil-rouge': ['Mobilier', 'Assises'],
  'fauteuil-damasse': ['Mobilier', 'Assises'],
  'chaise-gothique': ['Mobilier', 'Assises'],
  'fauteuil-vert': ['Mobilier', 'Assises'],
  'chaise-cannee': ['Mobilier', 'Assises'],
  'chaise-bleue': ['Mobilier', 'Assises'],
  'chaise-windsor': ['Mobilier', 'Assises'],
  'chaise-fleurie': ['Mobilier', 'Assises'],
  'tabouret-curule': ['Mobilier', 'Assises'],
  'pouf-vert': ['Mobilier', 'Assises'],
  'pouf-damasse': ['Mobilier', 'Assises'],
  'tabouret-rouge': ['Mobilier', 'Assises'],
  'canape-angle-blanc': ['Moderne', 'Assises'],
  'meuble-tv': ['Moderne', 'Décoration'],
  'table-bois': ['Moderne', 'Tables'],
  'lit-moderne': ['Moderne', 'Lits'],
  'bureau-ordinateur': ['Moderne', 'Tables'],
  'ilot-cuisson': ['Moderne', 'Cuisine'],
  'table-basse-bois': ['Moderne', 'Tables'],
  'meuble-vasque': ['Moderne', 'Bain'],
  'douche-italienne': ['Moderne', 'Bain'],
  'canape-angle-beige': ['Moderne', 'Assises'],
  'table-salle-a-manger': ['Moderne', 'Tables'],
  'ilot-tabourets': ['Moderne', 'Cuisine'],
  'baignoire-ilot': ['Moderne', 'Bain'],
  'tapis-rond-moderne': ['Moderne', 'Décoration'],
  'bureau-plantes': ['Moderne', 'Tables'],
  'douche-vitree': ['Moderne', 'Bain'],
  'toilettes-modernes': ['Moderne', 'Bain'],
  'plante-monstera': ['Moderne', 'Décoration'],
  'table-basse-marbre': ['Moderne', 'Tables'],
  'fauteuil-cuir': ['Moderne', 'Assises'],
  'canape-angle-orange': ['Moderne', 'Assises'],
  'table-basse-galet': ['Moderne', 'Tables'],
  'table-six-chaises': ['Moderne', 'Tables'],
  'ilot-moderne': ['Moderne', 'Cuisine'],
  'tapis-jute': ['Moderne', 'Décoration'],
  'lit-chevets': ['Moderne', 'Lits'],
  'baignoire-bois': ['Moderne', 'Bain'],
  'bureau-portable': ['Moderne', 'Tables'],
  'fauteuil-papasan': ['Moderne', 'Assises'],
  'plaque-induction': ['Moderne', 'Électroménager'],
  'evier-inox': ['Moderne', 'Cuisine'],
  'machine-cafe': ['Moderne', 'Électroménager'],
  'grille-pain': ['Moderne', 'Électroménager'],
  'bouilloire': ['Moderne', 'Électroménager'],
  'blender': ['Moderne', 'Électroménager'],
  'robot-patissier': ['Moderne', 'Électroménager'],
  'planche-a-decouper': ['Moderne', 'Cuisine'],
  'pot-ustensiles': ['Moderne', 'Cuisine'],
  'carrousel-epices': ['Moderne', 'Cuisine'],
  'barre-ustensiles': ['Moderne', 'Cuisine'],
  'faitout': ['Moderne', 'Cuisine'],
  'parquet-chene-clair': ['Bois', ''],
  'parquet-fonce': ['Bois', ''],
  'chevrons-chene': ['Bois', ''],
  'batons-rompus': ['Bois', ''],
  'planches-grises': ['Bois', ''],
  'chevrons-acajou': ['Bois', ''],
  'planches-noires': ['Bois', ''],
  'planches-claires': ['Bois', ''],
  'carrelage-beige': ['Carrelage', ''],
  'carrelage-ardoise': ['Carrelage', ''],
  'marbre-blanc': ['Pierre et marbre', ''],
  'marbre-noir-or': ['Pierre et marbre', ''],
  'damier-noir-blanc': ['Carrelage', ''],
  'carreaux-ciment-bleus': ['Carrelage', ''],
  'cabochons': ['Carrelage', ''],
  'carreaux-metro': ['Carrelage', ''],
  'dallage-irregulier': ['Pierre et marbre', ''],
  'paves-mousse': ['Extérieur', ''],
  'dalles-calcaire': ['Pierre et marbre', ''],
  'beton-lisse': ['Pierre et marbre', ''],
  'terrazzo-clair': ['Pierre et marbre', ''],
  'terrazzo-noir': ['Pierre et marbre', ''],
  'terrazzo-orange': ['Pierre et marbre', ''],
  'chevrons-brique': ['Pierre et marbre', ''],
  'moquette-beige': ['Moquette', ''],
  'moquette-grise': ['Moquette', ''],
  'moquette-rouge': ['Moquette', ''],
  'moquette-verte': ['Moquette', ''],
  'moquette-bleue': ['Moquette', ''],
  'carreaux-geometriques': ['Carrelage', ''],
  'fourrure': ['Moquette', ''],
  'tatami': ['Bois', ''],
  'caoutchouc': ['Métal', ''],
  'tole-larmee': ['Métal', ''],
  'tole-perforee': ['Métal', ''],
  'mosaique-piscine': ['Carrelage', ''],
  'chevrons-miel': ['Bois', ''],
  'batons-rompus-fonce': ['Bois', ''],
  'planches-delavees': ['Bois', ''],
  'planches-blanchies': ['Bois', ''],
  'planches-rustiques': ['Bois', ''],
  'planches-noyer': ['Bois', ''],
  'planches-pin': ['Bois', ''],
  'planches-ebene': ['Bois', ''],
  'marbre-creme-or': ['Pierre et marbre', ''],
  'marbre-vert': ['Pierre et marbre', ''],
  'marbre-rouge': ['Pierre et marbre', ''],
  'marbre-gris': ['Pierre et marbre', ''],
  'terrazzo-blanc': ['Pierre et marbre', ''],
  'terrazzo-anthracite': ['Pierre et marbre', ''],
  'dalles-travertin': ['Pierre et marbre', ''],
  'dalles-schiste': ['Pierre et marbre', ''],
  'hexagones-creme': ['Carrelage', ''],
  'hexagones-ardoise': ['Carrelage', ''],
  'cubes-trompe-oeil': ['Carrelage', ''],
  'carreaux-ciment-azur': ['Carrelage', ''],
  'etoiles-bleues': ['Carrelage', ''],
  'tomettes': ['Carrelage', ''],
  'terre-cuite': ['Carrelage', ''],
  'paves-herbe': ['Extérieur', ''],
  'dalles-herbe': ['Extérieur', ''],
  'dallage-romain': ['Pierre et marbre', ''],
  'gravier': ['Extérieur', ''],
  'terre-battue': ['Extérieur', ''],
  'gazon': ['Extérieur', ''],
  'terre-clairsemee': ['Extérieur', ''],
  'moquette-laine': ['Moquette', ''],
  'moquette-anthracite': ['Moquette', ''],
  'moquette-violette': ['Moquette', ''],
  'moquette-canard': ['Moquette', ''],
  'moquette-cotelee': ['Moquette', ''],
  'sisal': ['Moquette', ''],
  'planches-vieillies': ['Bois', ''],
  'planches-ecaillees': ['Bois', ''],
  'chevrons-pierre': ['Pierre et marbre', ''],
  'beton-rivete': ['Métal', ''],
  'beton-brut': ['Pierre et marbre', ''],
  'beton-fissure': ['Pierre et marbre', ''],
  'caillebotis': ['Métal', ''],
  'hexagones-cabochons': ['Carrelage', ''],
  'hexagones-turquoise': ['Carrelage', ''],
  'mosaique-verte': ['Carrelage', ''],
  'eau': ['Extérieur', ''],
  'glace': ['Extérieur', ''],
  'neige': ['Extérieur', ''],
  'terre-craquelee': ['Extérieur', ''],
  'feuilles-mortes': ['Extérieur', ''],
  'pierres-mousse': ['Extérieur', ''],
  'vannerie': ['Bois', ''],
  'lattes-bambou': ['Bois', ''],
  'dalles-ardoise': ['Pierre et marbre', ''],
  'sable-ondule': ['Sable', ''],
  'sable-fin': ['Sable', ''],
  'dunes': ['Sable', ''],
  'sable-craquele': ['Sable', ''],
  'sable-cailloux': ['Sable', ''],
  'sable-vent': ['Sable', ''],
  'sable-herbes': ['Sable', ''],
  'terre-cailloux': ['Sable', ''],
  'sable-dalles': ['Sable', ''],
  'parquet-sombre': ['Bois', ''],
  'parquet-vert': ['Bois', ''],
  'damier-use': ['Carrelage', ''],
  'dalles-pierre': ['Pierre et marbre', ''],
  'terre-herbe': ['Extérieur', ''],
  'herbe-verte': ['Herbe', ''],
  'herbe-terre': ['Herbe', ''],
  'herbe-haute': ['Herbe', ''],
  'herbe-feuilles': ['Herbe', ''],
  'mousse': ['Herbe', ''],
  'herbe-fleurie': ['Herbe', ''],
  'trefle': ['Herbe', ''],
  'herbe-seche': ['Herbe', ''],
  'herbe-givree': ['Herbe', ''],
  'herbe-boueuse': ['Herbe', ''],
  'herbe-violettes': ['Herbe', ''],
  'herbe-rase': ['Herbe', '']
}

interface Planche {
  fichier: string
  fond: 'magenta' | 'noir' | 'aucun'
  cols: number
  rows: number
  type: TypeAsset | ((c: Case) => TypeAsset)
  categorie: string
  dossier: string
  /** Rogner les bords d'une texture, pour ne rien garder du liseré. */
  retrait?: number
  /** Sol : raccorder sur les deux axes ; mur : en longueur seulement. */
  raccord?: 'deux' | 'long'
  /**
   * Des éléments qui débordent de leur case de grille (un grand arbre) : on
   * prend, dans chaque case, l'élément d'un seul tenant qui y a son centre, et
   * on efface ce qui vient des voisins.
   */
  isoler?: boolean | 'case'
  /** Des rangées de longueurs différentes : le nombre de cases de chacune (sinon `cols` partout). */
  lignes?: number[]
  /** Des icônes de rayons (catégories, sous-catégories) : `id` est le nom de fichier (`slug`). */
  icones?: boolean
  cases: (Case | null)[]
}

/** Taille des blocs pour repérer les éléments d'un seul tenant (en pixels). */
const BLOC = 4

/**
 * Les éléments d'un seul tenant d'une image détourée : un numéro par bloc de
 * BLOC × BLOC pixels (0 : vide), et pour chacun son poids, son centre et sa boîte.
 */
function elements(img: PNG): {
  nx: number
  etiquette: Int32Array
  infos: { n: number; sx: number; sy: number; x0: number; y0: number; x1: number; y1: number }[]
} {
  const nx = Math.ceil(img.width / BLOC)
  const ny = Math.ceil(img.height / BLOC)
  const plein = new Uint8Array(nx * ny)
  for (let y = 0; y < img.height; y++)
    for (let x = 0; x < img.width; x++)
      if (img.data[(y * img.width + x) * 4 + 3] > 40) plein[Math.floor(y / BLOC) * nx + Math.floor(x / BLOC)] = 1
  const etiquette = new Int32Array(nx * ny)
  const infos: { n: number; sx: number; sy: number; x0: number; y0: number; x1: number; y1: number }[] = [
    { n: 0, sx: 0, sy: 0, x0: 0, y0: 0, x1: 0, y1: 0 }
  ]
  for (let d = 0; d < nx * ny; d++) {
    if (!plein[d] || etiquette[d]) continue
    const e = infos.length
    const info = { n: 0, sx: 0, sy: 0, x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
    const pile = [d]
    etiquette[d] = e
    while (pile.length) {
      const k = pile.pop()!
      const bx = k % nx
      const by = Math.floor(k / nx)
      info.n++
      info.sx += bx
      info.sy += by
      info.x0 = Math.min(info.x0, bx)
      info.y0 = Math.min(info.y0, by)
      info.x1 = Math.max(info.x1, bx)
      info.y1 = Math.max(info.y1, by)
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const ax = bx + dx
          const ay = by + dy
          if (ax < 0 || ay < 0 || ax >= nx || ay >= ny) continue
          const v = ay * nx + ax
          if (plein[v] && !etiquette[v]) {
            etiquette[v] = e
            pile.push(v)
          }
        }
    }
    infos.push(info)
  }
  return { nx, etiquette, infos }
}

const PLANCHES: Planche[] = [
  {
    fichier: 'planches/planche 1.png',
    fond: 'magenta',
    cols: 3,
    rows: 2,
    type: 'objet',
    categorie: 'Chambre et salon',
    dossier: 'objets',
    cases: [
      { id: 'lit-double', nom: 'Lit double', l: 1.1, pas: true },
      { id: 'canape-chesterfield', nom: 'Canapé Chesterfield', l: 1.4, pas: true },
      { id: 'fauteuil', nom: 'Fauteuil', l: 0.6, pas: true },
      { id: 'table-ronde', nom: 'Table ronde', l: 0.8, pas: true },
      { id: 'commode', nom: 'Commode', l: 1, pas: true },
      { id: 'table-de-nuit', nom: 'Table de nuit', l: 0.5, pas: true }
    ]
  },
  {
    fichier: 'planches/planche 2.png',
    fond: 'magenta',
    cols: 4,
    rows: 3,
    type: 'objet',
    categorie: 'Petits objets',
    dossier: 'objets',
    cases: [
      { id: 'bougeoir', nom: 'Bougeoir', l: 0.2 },
      { id: 'lampe-huile', nom: 'Lampe à huile', l: 0.25 },
      { id: 'livre-ouvert', nom: 'Livre ouvert', l: 0.3 },
      { id: 'pile-livres', nom: 'Pile de livres', l: 0.25 },
      { id: 'miroir', nom: 'Miroir', l: 0.25 },
      { id: 'napperon', nom: 'Napperon', l: 0.4 },
      { id: 'crane', nom: 'Crâne', l: 0.2 },
      { id: 'tasse', nom: 'Tasse et soucoupe', l: 0.18 },
      { id: 'encrier', nom: 'Encrier et plume', l: 0.22 },
      { id: 'lettres', nom: 'Lettres', l: 0.35 },
      { id: 'chandelier', nom: 'Chandelier', l: 0.35 },
      { id: 'coffret', nom: 'Coffret', l: 0.3 }
    ]
  },
  {
    fichier: 'planches/planche 3.png',
    fond: 'magenta',
    cols: 3,
    rows: 2,
    type: 'objet',
    categorie: 'Bureau, bain, architecture',
    dossier: 'objets',
    cases: [
      { id: 'bibliotheque', nom: 'Bibliothèque', l: 1.2, pas: true, vue: true },
      { id: 'bureau', nom: 'Bureau', l: 1, pas: true },
      { id: 'chaise', nom: 'Chaise', l: 0.35 },
      { id: 'baignoire', nom: 'Baignoire', l: 1.1, pas: true },
      { id: 'escalier-droit', nom: 'Escalier droit', l: 0.8 },
      { id: 'cheminee', nom: 'Cheminée', l: 1.2, pas: true, vue: true }
    ]
  },
  {
    fichier: 'planches/planche 4.png',
    fond: 'noir',
    cols: 3,
    rows: 2,
    type: 'objet',
    categorie: 'Horreur',
    dossier: 'objets',
    cases: [
      { id: 'toile-coin', nom: 'Toile d’angle', l: 1 },
      { id: 'toile-ronde', nom: 'Grande toile', l: 1.2 },
      { id: 'toile-dense', nom: 'Toiles denses', l: 1.2 },
      { id: 'toile-tendue', nom: 'Toile tendue', l: 1.2 },
      { id: 'toile-petite', nom: 'Petite toile', l: 0.7 },
      { id: 'toile-eparse', nom: 'Fils épars', l: 1 }
    ]
  },
  {
    fichier: 'planches/nature 1.png',
    fond: 'magenta',
    isoler: true,
    cols: 4,
    rows: 3,
    type: 'objet',
    categorie: 'Nature',
    dossier: 'objets',
    cases: [
      { id: 'chene-dense', nom: 'Chêne touffu', l: 4 },
      { id: 'arbre-griffu', nom: 'Arbre griffu', l: 3.5 },
      { id: 'pin', nom: 'Pin', l: 3 },
      { id: 'saule', nom: 'Saule pleureur', l: 4 },
      { id: 'buisson', nom: 'Buisson', l: 1.2, pas: true },
      { id: 'ronces', nom: 'Ronces', l: 1.5 },
      { id: 'rochers', nom: 'Rochers', l: 1.2, pas: true },
      { id: 'gros-rocher', nom: 'Gros rocher', l: 1.6, pas: true },
      { id: 'tronc-couche', nom: 'Tronc couché', l: 2, pas: true },
      { id: 'souche', nom: 'Souche', l: 1, pas: true },
      { id: 'hautes-herbes', nom: 'Hautes herbes', l: 1.2 },
      { id: 'champignons', nom: 'Champignons', l: 0.6 }
    ]
  },
  {
    fichier: 'planches/nature 2.png',
    fond: 'magenta',
    isoler: true,
    cols: 4,
    rows: 3,
    type: 'objet',
    categorie: 'Arbres',
    dossier: 'objets',
    cases: [
      { id: 'chene-jeune', nom: 'Jeune chêne', l: 1.5 },
      { id: 'chene', nom: 'Chêne', l: 3 },
      { id: 'chene-grand', nom: 'Grand chêne', l: 4.5 },
      { id: 'chene-degarni', nom: 'Chêne dégarni', l: 3.5 },
      { id: 'sapin-jeune', nom: 'Jeune sapin', l: 1.2 },
      { id: 'sapin', nom: 'Sapin', l: 2.5 },
      { id: 'sapin-grand', nom: 'Grand sapin', l: 3.5 },
      { id: 'sapin-roussi', nom: 'Sapin roussi', l: 3 },
      { id: 'mort-petit', nom: 'Petit arbre mort', l: 1.2 },
      { id: 'mort', nom: 'Arbre mort', l: 2.5 },
      { id: 'mort-grand', nom: 'Grand arbre mort', l: 4 },
      { id: 'mort-mousse', nom: 'Arbre mort moussu', l: 3.5 }
    ]
  },
  {
    fichier: 'planches/lot 01.png',
    fond: 'magenta',
    retrait: 6,
    raccord: 'deux',
    cols: 4,
    rows: 3,
    type: 'sol',
    categorie: 'Sols',
    dossier: 'sols',
    cases: [
      { id: 'herbe-verte', nom: 'Herbe verte', tuile: 2 },
      { id: 'herbe-terre', nom: 'Herbe et terre', tuile: 2 },
      { id: 'herbe-haute', nom: 'Herbe haute', tuile: 2 },
      { id: 'herbe-feuilles', nom: 'Herbe et feuilles mortes', tuile: 2 },
      { id: 'mousse', nom: 'Mousse', tuile: 2 },
      { id: 'herbe-fleurie', nom: 'Herbe fleurie', tuile: 2 },
      { id: 'trefle', nom: 'Trèfle', tuile: 2 },
      { id: 'herbe-seche', nom: 'Herbe sèche', tuile: 2 },
      { id: 'herbe-givree', nom: 'Herbe givrée', tuile: 2 },
      { id: 'herbe-boueuse', nom: 'Herbe boueuse', tuile: 2 },
      { id: 'herbe-violettes', nom: 'Herbe aux violettes', tuile: 2 },
      { id: 'herbe-rase', nom: 'Herbe rase et terre', tuile: 2 }
    ]
  },
  {
    fichier: 'planches/lot 02.png',
    fond: 'magenta',
    isoler: true,
    cols: 3,
    rows: 2,
    type: 'objet',
    categorie: 'Mobilier',
    dossier: 'objets',
    cases: [
      { id: 'table-a-manger', nom: 'Table à manger', l: 2, pas: true },
      { id: 'canape-bordeaux', nom: 'Canapé bordeaux', l: 1.6, pas: true },
      { id: 'table-ovale-marbre', nom: 'Table ovale en marbre', l: 1.3, pas: true },
      { id: 'piano-a-queue', nom: 'Piano à queue', l: 1.7, pas: true },
      { id: 'lit-damasse', nom: 'Lit damassé', l: 1.2, pas: true },
      { id: 'cheminee-marbre', nom: 'Cheminée de marbre', l: 1.5, pas: true, vue: true }
    ]
  },
  {
    fichier: 'planches/lot 03.png',
    fond: 'magenta',
    isoler: true,
    cols: 4,
    rows: 3,
    type: 'objet',
    categorie: 'Objets',
    dossier: 'objets',
    cases: [
      { id: 'volaille-rotie', nom: 'Volaille rôtie', l: 0.6 },
      { id: 'roti', nom: 'Rôti', l: 0.55 },
      { id: 'tarte', nom: 'Tarte', l: 0.45 },
      { id: 'plateau-fromages', nom: 'Plateau de fromages', l: 0.5 },
      { id: 'poisson', nom: 'Poisson', l: 0.6 },
      { id: 'pain', nom: 'Pain', l: 0.45 },
      { id: 'ragout', nom: 'Ragoût', l: 0.5 },
      { id: 'soupe', nom: 'Soupe', l: 0.45 },
      { id: 'corbeille-fruits', nom: 'Corbeille de fruits', l: 0.45 },
      { id: 'gateau', nom: 'Gâteau', l: 0.45 },
      { id: 'biscuits', nom: 'Biscuits', l: 0.45 },
      { id: 'coupe-baies', nom: 'Coupe de baies', l: 0.35 }
    ]
  },
  {
    fichier: 'planches/lot 04.png',
    fond: 'magenta',
    isoler: true,
    cols: 4,
    rows: 3,
    type: 'objet',
    categorie: 'Lumière',
    dossier: 'objets',
    cases: [
      { id: 'lustre-bougies', nom: 'Lustre à bougies', l: 1 },
      { id: 'lustre-roue', nom: 'Lustre en roue', l: 1 },
      { id: 'lampe-tiffany', nom: 'Lampe Tiffany', l: 0.55 },
      { id: 'lanterne', nom: 'Lanterne', l: 0.35 },
      { id: 'plafonnier-tulipes', nom: 'Plafonnier à tulipes', l: 0.8 },
      { id: 'lampe-banquier', nom: 'Lampe de banquier', l: 0.45 },
      { id: 'bougeoir-laiton', nom: 'Bougeoir en laiton', l: 0.25 },
      { id: 'lampe-petrole', nom: 'Lampe à pétrole', l: 0.25 },
      { id: 'lampadaire-franges', nom: 'Lampadaire à franges', l: 0.6 },
      { id: 'lanterne-gothique', nom: 'Lanterne gothique', l: 0.35 },
      { id: 'suspension-cloche', nom: 'Suspension en cloche', l: 0.5 },
      { id: 'globe-verre', nom: 'Globe de verre', l: 0.4 }
    ]
  },
  {
    fichier: 'planches/lot 05.png',
    fond: 'magenta',
    isoler: true,
    cols: 4,
    rows: 3,
    type: 'objet',
    categorie: 'Lumière',
    dossier: 'objets',
    cases: [
      { id: 'lustre-cristal', nom: 'Lustre de cristal', l: 1.2 },
      { id: 'lustre-fer', nom: 'Lustre en fer', l: 1 },
      { id: 'plafonnier-vitrail', nom: 'Plafonnier à vitrail', l: 0.8 },
      { id: 'lustre-globes', nom: 'Lustre à globes', l: 0.9 },
      { id: 'lanterne-noire', nom: 'Lanterne noire', l: 0.35 },
      { id: 'suspension-ajouree', nom: 'Suspension ajourée', l: 0.55 },
      { id: 'plafonnier-vert', nom: 'Plafonnier vert', l: 0.7 },
      { id: 'applique-lanterne', nom: 'Applique lanterne', l: 0.45 },
      { id: 'lampe-banquier-verte', nom: 'Lampe de banquier verte', l: 0.45 },
      { id: 'lampe-huile-rose', nom: 'Lampe à huile rose', l: 0.25 },
      { id: 'bougeoir-main', nom: 'Bougeoir à main', l: 0.25 },
      { id: 'globe-dore', nom: 'Globe doré', l: 0.45 }
    ]
  },
  {
    fichier: 'planches/lot 18.png',
    fond: 'magenta',
    isoler: true,
    cols: 4,
    rows: 3,
    type: 'objet',
    categorie: 'Architecture',
    dossier: 'objets',
    cases: [
      { id: 'escalier-bois', nom: 'Escalier en bois', l: 0.9 },
      { id: 'escalier-tapis-rouge', nom: 'Escalier au tapis rouge', l: 0.9 },
      { id: 'escalier-palier', nom: 'Escalier à palier', l: 2 },
      { id: 'escalier-demi-lune', nom: 'Escalier en demi-lune', l: 2.5 },
      { id: 'escalier-quart-tournant', nom: 'Escalier quart tournant', l: 1.5 },
      { id: 'colimacon-bois', nom: 'Colimaçon en bois', l: 1.4 },
      { id: 'escalier-imperial', nom: 'Escalier impérial', l: 2.6 },
      { id: 'colimacon-pierre', nom: 'Colimaçon en pierre', l: 1.4 },
      { id: 'escalier-lumineux', nom: 'Escalier lumineux', l: 0.9 },
      { id: 'escalier-metal', nom: 'Escalier en métal', l: 0.8 },
      { id: 'escalier-equerre', nom: 'Escalier en équerre', l: 1.8 },
      { id: 'escalier-courbe', nom: 'Escalier courbe', l: 2 }
    ]
  },
  {
    fichier: 'planches/lot 20.png',
    fond: 'magenta',
    isoler: true,
    cols: 4,
    rows: 3,
    type: 'objet',
    categorie: 'Mobilier',
    dossier: 'objets',
    cases: [
      { id: 'bureau-ministre', nom: 'Bureau de ministre', l: 1.4, pas: true },
      { id: 'table-fleurie', nom: 'Table fleurie', l: 2, pas: true },
      { id: 'console-roses', nom: 'Console aux roses', l: 1.3, pas: true },
      { id: 'buffet-bustes', nom: 'Buffet aux bustes', l: 1.5, pas: true, vue: true },
      { id: 'chesterfield-plaid', nom: 'Chesterfield au plaid', l: 1.6, pas: true },
      { id: 'fauteuil-club', nom: 'Fauteuil club', l: 0.7, pas: true },
      { id: 'tapis-table-basse', nom: 'Tapis et table basse', l: 1.6, pas: true },
      { id: 'meridienne', nom: 'Méridienne', l: 1.5, pas: true },
      { id: 'lit-coussins', nom: 'Lit aux coussins', l: 1.2, pas: true },
      { id: 'armoire', nom: 'Armoire', l: 1.2, pas: true, vue: true },
      { id: 'coiffeuse', nom: 'Coiffeuse', l: 1.1, pas: true },
      { id: 'paravent', nom: 'Paravent', l: 1.2, pas: true, vue: true }
    ]
  },
  {
    fichier: 'planches/lot 21.png',
    fond: 'magenta',
    isoler: true,
    cols: 4,
    rows: 3,
    type: 'objet',
    categorie: 'Mobilier',
    dossier: 'objets',
    cases: [
      { id: 'plan-de-travail', nom: 'Plan de travail', l: 1.3, pas: true },
      { id: 'cuisiniere-bois', nom: 'Cuisinière à bois', l: 1.3, pas: true },
      { id: 'evier-pierre', nom: 'Évier de pierre', l: 1.2, pas: true },
      { id: 'vaisselier', nom: 'Vaisselier', l: 1.3, pas: true, vue: true },
      { id: 'glaciere', nom: 'Glacière', l: 0.7, pas: true, vue: true },
      { id: 'table-cuisine', nom: 'Table de cuisine', l: 1.4, pas: true },
      { id: 'plan-patisserie', nom: 'Plan de pâtisserie', l: 1.2, pas: true },
      { id: 'casseroles-suspendues', nom: 'Casseroles suspendues', l: 1.1 },
      { id: 'garde-manger', nom: 'Garde-manger', l: 1.3, pas: true, vue: true },
      { id: 'tonneau', nom: 'Tonneau', l: 0.6, pas: true },
      { id: 'casier-vin', nom: 'Casier à vin', l: 0.9, pas: true, vue: true },
      { id: 'buffet-cuisine', nom: 'Buffet de cuisine', l: 1.3, pas: true }
    ]
  },
  {
    fichier: 'planches/lot 22.png',
    fond: 'magenta',
    isoler: true,
    cols: 4,
    rows: 3,
    type: 'objet',
    categorie: 'Mobilier',
    dossier: 'objets',
    cases: [
      { id: 'baignoire-mousse', nom: 'Baignoire moussante', l: 1.2, pas: true },
      { id: 'double-vasque', nom: 'Double vasque', l: 1.4, pas: true },
      { id: 'toilettes', nom: 'Toilettes', l: 0.5, pas: true },
      { id: 'bidet', nom: 'Bidet', l: 0.45, pas: true },
      { id: 'douche', nom: 'Douche', l: 0.9, pas: true },
      { id: 'armoire-linge', nom: 'Armoire à linge', l: 0.9, pas: true, vue: true },
      { id: 'coiffeuse-bain', nom: 'Coiffeuse de bain', l: 1, pas: true },
      { id: 'porte-serviettes', nom: 'Porte-serviettes', l: 0.7 },
      { id: 'panier-linge', nom: 'Panier à linge', l: 0.55, pas: true },
      { id: 'meuble-lavabo', nom: 'Meuble lavabo', l: 1, pas: true },
      { id: 'tapis-oriental-bain', nom: 'Tapis oriental', l: 1.4 },
      { id: 'desserte-bain', nom: 'Desserte', l: 0.7, pas: true }
    ]
  },
  {
    fichier: 'planches/lot 23.png',
    fond: 'magenta',
    isoler: true,
    cols: 4,
    rows: 3,
    type: 'objet',
    categorie: 'Mobilier',
    dossier: 'objets',
    cases: [
      { id: 'lit-baroque', nom: 'Lit baroque', l: 1.2, pas: true },
      { id: 'lit-baldaquin', nom: 'Lit à baldaquin', l: 1.3, pas: true, vue: true },
      { id: 'coiffeuse-miroir', nom: 'Coiffeuse à miroir', l: 1.1, pas: true },
      { id: 'armoire-chambre', nom: 'Armoire de chambre', l: 1.2, pas: true, vue: true },
      { id: 'meridienne-plaid', nom: 'Méridienne au plaid', l: 1.5, pas: true },
      { id: 'fauteuil-capitonne', nom: 'Fauteuil capitonné', l: 0.7, pas: true },
      { id: 'gueridon-lampe', nom: 'Guéridon à la lampe', l: 0.6, pas: true },
      { id: 'secretaire', nom: 'Secrétaire', l: 1.2, pas: true },
      { id: 'coffre-fer', nom: 'Coffre ferré', l: 0.9, pas: true },
      null,
      null,
      { id: 'chevet-lys', nom: 'Chevet aux lys', l: 0.5, pas: true }
    ]
  },
  {
    fichier: 'planches/lot 24.png',
    fond: 'magenta',
    isoler: true,
    cols: 4,
    rows: 3,
    type: 'objet',
    categorie: 'Mobilier',
    dossier: 'objets',
    cases: [
      null,
      { id: 'table-ovale-noire', nom: 'Table ovale noire', l: 1.3, pas: true },
      { id: 'table-ronde-marquetee', nom: 'Table ronde marquetée', l: 0.9, pas: true },
      null,
      { id: 'table-ovale-ornee', nom: 'Table ovale ornée', l: 1.6, pas: true },
      { id: 'table-octogonale', nom: 'Table octogonale', l: 1.1, pas: true },
      { id: 'table-octogonale-verte', nom: 'Table octogonale verte', l: 1.2, pas: true },
      { id: 'gueridon-marbre', nom: 'Guéridon de marbre', l: 0.8, pas: true },
      null,
      { id: 'table-ronde-rosace', nom: 'Table à rosace', l: 1, pas: true },
      { id: 'table-ovale-marbree', nom: 'Table ovale marbrée', l: 1.4, pas: true },
      { id: 'table-planches', nom: 'Table en planches', l: 1.6, pas: true }
    ]
  },
  {
    fichier: 'planches/lot 25.png',
    fond: 'magenta',
    isoler: true,
    cols: 4,
    rows: 3,
    type: 'objet',
    categorie: 'Mobilier',
    dossier: 'objets',
    cases: [
      { id: 'fauteuil-rouge', nom: 'Fauteuil rouge', l: 0.6, pas: true },
      { id: 'fauteuil-damasse', nom: 'Fauteuil damassé', l: 0.6, pas: true },
      { id: 'chaise-gothique', nom: 'Chaise gothique', l: 0.5 },
      { id: 'fauteuil-vert', nom: 'Fauteuil vert', l: 0.6, pas: true },
      { id: 'chaise-cannee', nom: 'Chaise cannée', l: 0.45 },
      { id: 'chaise-bleue', nom: 'Chaise bleue', l: 0.45 },
      { id: 'chaise-windsor', nom: 'Chaise Windsor', l: 0.45 },
      { id: 'chaise-fleurie', nom: 'Chaise fleurie', l: 0.45 },
      { id: 'tabouret-curule', nom: 'Tabouret curule', l: 0.45 },
      { id: 'pouf-vert', nom: 'Pouf vert', l: 0.5 },
      { id: 'pouf-damasse', nom: 'Pouf damassé', l: 0.5 },
      { id: 'tabouret-rouge', nom: 'Tabouret rouge', l: 0.4 }
    ]
  },
  {
    fichier: 'planches/lot 26.png',
    fond: 'magenta',
    isoler: true,
    cols: 4,
    rows: 3,
    type: 'objet',
    categorie: 'Moderne',
    dossier: 'objets',
    cases: [
      { id: 'canape-angle-blanc', nom: 'Canapé d’angle blanc', l: 1.8, pas: true },
      { id: 'meuble-tv', nom: 'Meuble télé', l: 1.2, pas: true },
      { id: 'table-bois', nom: 'Table en bois', l: 1.4, pas: true },
      null,
      { id: 'lit-moderne', nom: 'Lit moderne', l: 1.3, pas: true },
      { id: 'bureau-ordinateur', nom: 'Bureau et ordinateur', l: 1.2, pas: true },
      { id: 'ilot-cuisson', nom: 'Îlot de cuisson', l: 1.3, pas: true },
      null,
      null,
      { id: 'table-basse-bois', nom: 'Table basse en bois', l: 1.2, pas: true },
      { id: 'meuble-vasque', nom: 'Meuble vasque', l: 1, pas: true },
      { id: 'douche-italienne', nom: 'Douche à l’italienne', l: 0.9, pas: true }
    ]
  },
  {
    fichier: 'planches/lot 28.png',
    fond: 'magenta',
    isoler: true,
    cols: 4,
    rows: 3,
    type: 'objet',
    categorie: 'Moderne',
    dossier: 'objets',
    cases: [
      { id: 'canape-angle-beige', nom: 'Canapé d’angle beige', l: 1.8, pas: true },
      { id: 'table-salle-a-manger', nom: 'Table de salle à manger', l: 1.6, pas: true },
      { id: 'ilot-tabourets', nom: 'Îlot et tabourets', l: 1.6, pas: true },
      { id: 'baignoire-ilot', nom: 'Baignoire îlot', l: 1.2, pas: true },
      { id: 'tapis-rond-moderne', nom: 'Tapis rond', l: 1.6 },
      { id: 'bureau-plantes', nom: 'Bureau aux plantes', l: 1.3, pas: true },
      { id: 'douche-vitree', nom: 'Douche vitrée', l: 0.9, pas: true },
      { id: 'toilettes-modernes', nom: 'Toilettes modernes', l: 0.45, pas: true },
      null,
      { id: 'plante-monstera', nom: 'Monstera', l: 0.6, pas: true },
      { id: 'table-basse-marbre', nom: 'Table basse en marbre', l: 1, pas: true },
      { id: 'fauteuil-cuir', nom: 'Fauteuil de cuir', l: 0.7, pas: true }
    ]
  },
  {
    fichier: 'planches/lot 29.png',
    fond: 'magenta',
    isoler: true,
    cols: 4,
    rows: 3,
    type: 'objet',
    categorie: 'Moderne',
    dossier: 'objets',
    cases: [
      { id: 'canape-angle-orange', nom: 'Canapé d’angle aux coussins', l: 1.9, pas: true },
      { id: 'table-basse-galet', nom: 'Table basse galet', l: 1, pas: true },
      { id: 'table-six-chaises', nom: 'Table à six chaises', l: 1.8, pas: true },
      { id: 'ilot-moderne', nom: 'Îlot moderne', l: 1.5, pas: true },
      { id: 'tapis-jute', nom: 'Tapis de jute', l: 1.5 },
      { id: 'lit-chevets', nom: 'Lit et chevets', l: 1.6, pas: true },
      { id: 'baignoire-bois', nom: 'Baignoire et planche', l: 1.2, pas: true },
      null,
      null,
      { id: 'bureau-portable', nom: 'Bureau et portable', l: 1.3, pas: true },
      null,
      { id: 'fauteuil-papasan', nom: 'Fauteuil papasan', l: 0.8, pas: true }
    ]
  },
  {
    fichier: 'planches/lot 31.png',
    fond: 'magenta',
    isoler: true,
    lignes: [4, 5, 5],
    cols: 5,
    rows: 3,
    type: 'objet',
    categorie: 'Moderne',
    dossier: 'objets',
    cases: [
      { id: 'plaque-induction', nom: 'Plaque à induction', l: 0.5 },
      null,
      { id: 'evier-inox', nom: 'Évier inox', l: 0.7, pas: true },
      null,
      { id: 'machine-cafe', nom: 'Machine à café', l: 0.3 },
      { id: 'grille-pain', nom: 'Grille-pain', l: 0.3 },
      { id: 'bouilloire', nom: 'Bouilloire', l: 0.25 },
      { id: 'blender', nom: 'Blender', l: 0.2 },
      { id: 'robot-patissier', nom: 'Robot pâtissier', l: 0.35 },
      { id: 'planche-a-decouper', nom: 'Planche à découper', l: 0.4 },
      { id: 'pot-ustensiles', nom: 'Pot à ustensiles', l: 0.2 },
      { id: 'carrousel-epices', nom: 'Carrousel à épices', l: 0.25 },
      { id: 'barre-ustensiles', nom: 'Barre à ustensiles', l: 0.5 },
      { id: 'faitout', nom: 'Faitout', l: 0.35 }
    ]
  },
  {
    fichier: 'planches/sols 2.png',
    fond: 'magenta',
    isoler: 'case',
    cols: 8,
    rows: 5,
    type: 'sol',
    categorie: 'Sols',
    dossier: 'sols',
    retrait: 16,
    raccord: 'deux',
    cases: [
      { id: 'parquet-chene-clair', nom: 'Parquet chêne clair', tuile: 1.5, brut: true },
      { id: 'parquet-fonce', nom: 'Parquet foncé', tuile: 1.5, brut: true },
      { id: 'chevrons-chene', nom: 'Chevrons de chêne', tuile: 1.5, brut: true },
      { id: 'batons-rompus', nom: 'Bâtons rompus', tuile: 1.5, brut: true },
      { id: 'planches-grises', nom: 'Planches grises', tuile: 1.5, brut: true },
      { id: 'chevrons-acajou', nom: 'Chevrons d’acajou', tuile: 1.5, brut: true },
      { id: 'planches-noires', nom: 'Planches noires', tuile: 1.5, brut: true },
      { id: 'planches-claires', nom: 'Planches claires', tuile: 1.5, brut: true },
      { id: 'carrelage-beige', nom: 'Carrelage beige', tuile: 1.5, brut: true },
      { id: 'carrelage-ardoise', nom: 'Carrelage ardoise', tuile: 1.5, brut: true },
      { id: 'marbre-blanc', nom: 'Marbre blanc', tuile: 2 },
      { id: 'marbre-noir-or', nom: 'Marbre noir veiné d’or', tuile: 2 },
      { id: 'damier-noir-blanc', nom: 'Damier noir et blanc', tuile: 1.5, brut: true },
      { id: 'carreaux-ciment-bleus', nom: 'Carreaux de ciment bleus', tuile: 1.5, brut: true },
      { id: 'cabochons', nom: 'Carrelage à cabochons', tuile: 1.5, brut: true },
      { id: 'carreaux-metro', nom: 'Carreaux métro', tuile: 1.5, brut: true },
      { id: 'dallage-irregulier', nom: 'Dallage irrégulier', tuile: 1.5, brut: true },
      { id: 'paves-mousse', nom: 'Pavés moussus', tuile: 1.5, brut: true },
      { id: 'dalles-calcaire', nom: 'Dalles de calcaire', tuile: 1.5, brut: true },
      { id: 'beton-lisse', nom: 'Béton lisse', tuile: 2 },
      { id: 'terrazzo-clair', nom: 'Terrazzo clair', tuile: 1.5 },
      { id: 'terrazzo-noir', nom: 'Terrazzo noir', tuile: 1.5 },
      { id: 'terrazzo-orange', nom: 'Terrazzo orangé', tuile: 1.5 },
      { id: 'chevrons-brique', nom: 'Chevrons de brique', tuile: 1.5, brut: true },
      { id: 'moquette-beige', nom: 'Moquette beige', tuile: 1.5 },
      { id: 'moquette-grise', nom: 'Moquette grise', tuile: 1.5 },
      { id: 'moquette-rouge', nom: 'Moquette rouge', tuile: 1.5 },
      { id: 'moquette-verte', nom: 'Moquette verte', tuile: 1.5 },
      { id: 'moquette-bleue', nom: 'Moquette bleue', tuile: 1.5 },
      null,
      { id: 'carreaux-geometriques', nom: 'Carreaux géométriques', tuile: 1.5, brut: true },
      { id: 'fourrure', nom: 'Fourrure', tuile: 1.5 },
      { id: 'tatami', nom: 'Tatami', tuile: 1.5, brut: true },
      { id: 'caoutchouc', nom: 'Caoutchouc à pastilles', tuile: 1.5, brut: true },
      { id: 'tole-larmee', nom: 'Tôle larmée', tuile: 1.5, brut: true },
      { id: 'tole-perforee', nom: 'Tôle perforée', tuile: 1.5, brut: true },
      null,
      null,
      null,
      { id: 'mosaique-piscine', nom: 'Mosaïque de piscine', tuile: 1.5, brut: true }
    ]
  },
  {
    fichier: 'planches/sols 3.png',
    fond: 'magenta',
    isoler: 'case',
    cols: 8,
    rows: 5,
    type: 'sol',
    categorie: 'Sols',
    dossier: 'sols',
    retrait: 16,
    raccord: 'deux',
    cases: [
      { id: 'chevrons-miel', nom: 'Chevrons miel', tuile: 1.5, brut: true },
      { id: 'batons-rompus-fonce', nom: 'Bâtons rompus foncés', tuile: 1.5, brut: true },
      { id: 'planches-delavees', nom: 'Planches délavées', tuile: 1.5, brut: true },
      { id: 'planches-blanchies', nom: 'Planches blanchies', tuile: 1.5, brut: true },
      { id: 'planches-rustiques', nom: 'Planches rustiques', tuile: 1.5, brut: true },
      { id: 'planches-noyer', nom: 'Planches de noyer', tuile: 1.5, brut: true },
      { id: 'planches-pin', nom: 'Planches de pin', tuile: 1.5, brut: true },
      { id: 'planches-ebene', nom: 'Planches d’ébène', tuile: 1.5, brut: true },
      { id: 'marbre-creme-or', nom: 'Marbre crème veiné d’or', tuile: 2 },
      { id: 'marbre-vert', nom: 'Marbre vert', tuile: 2 },
      { id: 'marbre-rouge', nom: 'Marbre rouge', tuile: 2 },
      { id: 'marbre-gris', nom: 'Marbre gris', tuile: 2 },
      { id: 'terrazzo-blanc', nom: 'Terrazzo blanc', tuile: 1.5 },
      { id: 'terrazzo-anthracite', nom: 'Terrazzo anthracite', tuile: 1.5 },
      { id: 'dalles-travertin', nom: 'Dalles de travertin', tuile: 1.5, brut: true },
      { id: 'dalles-schiste', nom: 'Dalles de schiste', tuile: 1.5, brut: true },
      { id: 'hexagones-creme', nom: 'Hexagones crème', tuile: 1.5, brut: true },
      { id: 'hexagones-ardoise', nom: 'Hexagones ardoise', tuile: 1.5, brut: true },
      { id: 'cubes-trompe-oeil', nom: 'Cubes en trompe-l’œil', tuile: 1.5, brut: true },
      { id: 'carreaux-ciment-azur', nom: 'Carreaux de ciment azur', tuile: 1.5, brut: true },
      null,
      null,
      { id: 'etoiles-bleues', nom: 'Carreaux aux étoiles bleues', tuile: 1.5, brut: true },
      { id: 'tomettes', nom: 'Tomettes', tuile: 1.5, brut: true },
      { id: 'terre-cuite', nom: 'Carreaux de terre cuite', tuile: 1.5, brut: true },
      { id: 'paves-herbe', nom: 'Pavés et herbe', tuile: 1.5, brut: true },
      { id: 'dalles-herbe', nom: 'Dalles et herbe', tuile: 1.5, brut: true },
      { id: 'dallage-romain', nom: 'Dallage romain', tuile: 1.5, brut: true },
      { id: 'gravier', nom: 'Gravier', tuile: 1.5 },
      { id: 'terre-battue', nom: 'Terre battue', tuile: 2 },
      { id: 'gazon', nom: 'Gazon', tuile: 2 },
      { id: 'terre-clairsemee', nom: 'Terre clairsemée', tuile: 2 },
      { id: 'moquette-laine', nom: 'Moquette de laine', tuile: 1.5 },
      { id: 'moquette-anthracite', nom: 'Moquette anthracite', tuile: 1.5 },
      { id: 'moquette-violette', nom: 'Moquette violette', tuile: 1.5 },
      { id: 'moquette-canard', nom: 'Moquette bleu canard', tuile: 1.5 },
      { id: 'moquette-cotelee', nom: 'Moquette côtelée', tuile: 1.5, brut: true },
      { id: 'sisal', nom: 'Sisal', tuile: 1.5 },
      null,
      null
    ]
  },
  {
    fichier: 'planches/sols 4.png',
    fond: 'magenta',
    isoler: 'case',
    cols: 8,
    rows: 5,
    type: 'sol',
    categorie: 'Sols',
    dossier: 'sols',
    retrait: 16,
    raccord: 'deux',
    cases: [
      null,
      null,
      null,
      null,
      null,
      null,
      { id: 'planches-vieillies', nom: 'Planches vieillies', tuile: 1.5, brut: true },
      { id: 'planches-ecaillees', nom: 'Planches écaillées', tuile: 1.5, brut: true },
      { id: 'chevrons-pierre', nom: 'Chevrons de pierre', tuile: 1.5, brut: true },
      { id: 'beton-rivete', nom: 'Dalles de béton rivetées', tuile: 1.5, brut: true },
      { id: 'beton-brut', nom: 'Béton brut', tuile: 2 },
      { id: 'beton-fissure', nom: 'Béton fissuré', tuile: 2 },
      null,
      null,
      { id: 'caillebotis', nom: 'Caillebotis', tuile: 1.5, brut: true },
      null,
      { id: 'hexagones-cabochons', nom: 'Hexagones à cabochons', tuile: 1.5, brut: true },
      { id: 'hexagones-turquoise', nom: 'Hexagones turquoise', tuile: 1.5, brut: true },
      { id: 'mosaique-verte', nom: 'Mosaïque verte', tuile: 1.5, brut: true },
      null,
      { id: 'eau', nom: 'Eau', tuile: 2 },
      { id: 'glace', nom: 'Glace', tuile: 2 },
      { id: 'neige', nom: 'Neige', tuile: 2 },
      null,
      { id: 'terre-craquelee', nom: 'Terre craquelée', tuile: 2 },
      null,
      null,
      { id: 'feuilles-mortes', nom: 'Feuilles mortes', tuile: 1.5 },
      null,
      null,
      null,
      { id: 'pierres-mousse', nom: 'Pierres et mousse', tuile: 1.5 },
      null,
      { id: 'vannerie', nom: 'Vannerie', tuile: 1.5, brut: true },
      { id: 'lattes-bambou', nom: 'Lattes de bambou', tuile: 1.5, brut: true },
      { id: 'dalles-ardoise', nom: 'Dalles d’ardoise', tuile: 1.5, brut: true },
      null,
      null,
      null,
      null
    ]
  },
  {
    fichier: 'planches/sols 5.png',
    fond: 'magenta',
    isoler: 'case',
    cols: 4,
    rows: 3,
    type: 'sol',
    categorie: 'Sols',
    dossier: 'sols',
    retrait: 16,
    raccord: 'deux',
    cases: [
      { id: 'sable-ondule', nom: 'Sable ondulé', tuile: 2 },
      { id: 'sable-fin', nom: 'Sable fin', tuile: 2 },
      { id: 'dunes', nom: 'Dunes', tuile: 2.5 },
      { id: 'sable-craquele', nom: 'Sable craquelé', tuile: 2 },
      { id: 'sable-cailloux', nom: 'Sable et cailloux', tuile: 2 },
      { id: 'sable-vent', nom: 'Sable sculpté par le vent', tuile: 2 },
      null,
      null,
      null,
      { id: 'sable-herbes', nom: 'Sable et herbes sèches', tuile: 2 },
      { id: 'terre-cailloux', nom: 'Terre et cailloux', tuile: 2 },
      { id: 'sable-dalles', nom: 'Sable et dalles brisées', tuile: 2 }
    ]
  },
  {
    fichier: 'planches/planche 5.png',
    fond: 'magenta',
    cols: 2,
    rows: 2,
    type: 'sol',
    categorie: 'Sols',
    dossier: 'sols',
    retrait: 6,
    raccord: 'deux',
    cases: [
      { id: 'damier-use', nom: 'Damier usé', tuile: 2, brut: true },
      { id: 'dalles-pierre', nom: 'Dalles de pierre', tuile: 3 },
      { id: 'parquet-vert', nom: 'Parquet vert à chevrons', tuile: 2 },
      { id: 'terre-herbe', nom: 'Terre et herbe morte', tuile: 3 }
    ]
  },
  {
    fichier: 'sols/parquet sombre.png',
    fond: 'aucun',
    cols: 1,
    rows: 1,
    type: 'sol',
    categorie: 'Sols',
    dossier: 'sols',
    raccord: 'deux',
    cases: [{ id: 'parquet-sombre', nom: 'Parquet sombre', tuile: 2 }]
  },
  {
    fichier: 'planches/murs 1.png',
    fond: 'magenta',
    cols: 1,
    rows: 3,
    type: 'mur',
    categorie: 'Murs',
    dossier: 'murs',
    retrait: 4,
    raccord: 'long',
    cases: [
      { id: 'pierre-sombre', nom: 'Pierre sombre', tuile: 2.5 },
      { id: 'platre-boiserie', nom: 'Plâtre et poutre', tuile: 2.5 },
      { id: 'briques', nom: 'Briques', tuile: 2.5 }
    ]
  },
  {
    fichier: 'planches/ouvertures 1.png',
    fond: 'magenta',
    cols: 2,
    rows: 3,
    type: (c) => (c.id.startsWith('fenetre') ? 'vitre' : 'porte'),
    categorie: 'Portes et fenêtres',
    dossier: 'ouvertures',
    cases: [
      { id: 'porte-bois', nom: 'Porte en bois' },
      { id: 'porte-double', nom: 'Porte double' },
      { id: 'porte-cave', nom: 'Porte de cave' },
      { id: 'grille', nom: 'Grille en fer' },
      { id: 'fenetre', nom: 'Fenêtre' },
      { id: 'fenetre-baie', nom: 'Baie vitrée' }
    ]
  },
  {
    fichier: 'planches/icones 1.png',
    fond: 'magenta',
    icones: true,
    cols: 4,
    rows: 4,
    type: 'objet',
    categorie: '',
    dossier: 'icones',
    cases: [
      { id: 'mobilier', nom: 'Mobilier' },
      { id: 'lumiere', nom: 'Lumière' },
      { id: 'objets', nom: 'Objets' },
      { id: 'architecture', nom: 'Architecture' },
      { id: 'nature', nom: 'Nature' },
      { id: 'macabre', nom: 'Macabre' },
      { id: 'lits', nom: 'Lits' },
      { id: 'assises', nom: 'Assises' },
      { id: 'tables', nom: 'Tables' },
      { id: 'rangements', nom: 'Rangements' },
      { id: 'bain', nom: 'Bain' },
      { id: 'cheminees', nom: 'Cheminées' },
      { id: 'lampes', nom: 'Lampes' },
      { id: 'bougies', nom: 'Bougies' },
      { id: 'lampadaires', nom: 'Lampadaires' },
      { id: 'plafonniers', nom: 'Plafonniers' }
    ]
  },
  {
    fichier: 'planches/icones 2.png',
    fond: 'magenta',
    icones: true,
    cols: 4,
    rows: 3,
    type: 'objet',
    categorie: '',
    dossier: 'icones',
    cases: [
      { id: 'livres-et-papiers', nom: 'Livres et papiers' },
      { id: 'vaisselle', nom: 'Vaisselle' },
      { id: 'decoration', nom: 'Décoration' },
      { id: 'escaliers', nom: 'Escaliers' },
      { id: 'arbres', nom: 'Arbres' },
      { id: 'vegetation', nom: 'Végétation' },
      { id: 'rochers', nom: 'Rochers' },
      { id: 'bois-mort', nom: 'Bois mort' },
      { id: 'toiles-d-araignees', nom: 'Toiles d’araignées' },
      { id: 'ossements', nom: 'Ossements' },
      { id: 'mes-objets', nom: 'Mes objets' }
    ]
  }
]

function rogner(src: PNG, x: number, y: number, w: number, h: number): PNG {
  const out = new PNG({ width: w, height: h })
  PNG.bitblt(src, out, x, y, w, h, 0, 0)
  return out
}

const catalogue: Record<string, unknown>[] = []

for (const pl of PLANCHES) {
  if (!existsSync(join(SOURCES, pl.fichier))) {
    console.warn(`! ${pl.fichier} : pas encore là, passée`)
    continue
  }
  const img = PNG.sync.read(readFileSync(join(SOURCES, pl.fichier)))
  const px = new Uint8ClampedArray(img.data.buffer, img.data.byteOffset, img.data.length)
  const net =
    pl.fond === 'magenta' ? detourerMagenta(px) : pl.fond === 'noir' ? lumiereEnAlpha(px) : px
  img.data = Buffer.from(net.buffer, net.byteOffset, net.length)

  const cw = img.width / pl.cols
  const ch = img.height / pl.rows
  const el = pl.isoler === true ? elements(img) : null
  pl.cases.forEach((c, i) => {
    if (!c) return
    /* La case i : dans une grille régulière, ou dans des rangées de longueurs différentes. */
    let rang = Math.floor(i / pl.cols)
    let col = i % pl.cols
    let cwi = cw
    if (pl.lignes) {
      let reste = i
      rang = 0
      while (reste >= pl.lignes[rang]) reste -= pl.lignes[rang++]
      col = reste
      cwi = img.width / pl.lignes[rang]
    }
    const cx = Math.round(col * cwi)
    const cy = Math.round(rang * ch)
    let cellule = rogner(img, cx, cy, Math.round(cwi), Math.round(ch))
    if (el) {
      /* L'élément le plus lourd dont le centre tombe dans cette case. */
      let meilleur = 0
      el.infos.forEach((f, e) => {
        if (!e) return
        const mx = (f.sx / f.n + 0.5) * BLOC
        const my = (f.sy / f.n + 0.5) * BLOC
        if (mx >= cx && mx < cx + cwi && my >= cy && my < cy + ch && f.n > (el.infos[meilleur]?.n ?? 0)) meilleur = e
      })
      if (!meilleur) {
        console.warn(`! ${pl.fichier} case ${i + 1} : aucun élément`)
        return
      }
      const f = el.infos[meilleur]
      const x0 = f.x0 * BLOC
      const y0 = f.y0 * BLOC
      const w = Math.min(img.width, (f.x1 + 1) * BLOC) - x0
      const h = Math.min(img.height, (f.y1 + 1) * BLOC) - y0
      cellule = rogner(img, x0, y0, w, h)
      /* Ce qui, dans la boîte, appartient à un voisin : effacé. */
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const b = Math.floor((y0 + y) / BLOC) * el.nx + Math.floor((x0 + x) / BLOC)
          if (el.etiquette[b] !== meilleur) cellule.data[(y * w + x) * 4 + 3] = 0
        }
    }
    if (pl.isoler === 'case') {
      /* Le plus grand élément d'un seul tenant de la case : les voisins qui
         débordent un peu dedans sont effacés. */
      const ec = elements(cellule)
      let grand = 0
      ec.infos.forEach((f, e) => {
        if (e && f.n > (ec.infos[grand]?.n ?? 0)) grand = e
      })
      for (let y = 0; y < cellule.height; y++)
        for (let x = 0; x < cellule.width; x++)
          if (ec.etiquette[Math.floor(y / BLOC) * ec.nx + Math.floor(x / BLOC)] !== grand) cellule.data[(y * cellule.width + x) * 4 + 3] = 0
    }
    const cpx = new Uint8ClampedArray(cellule.data.buffer, cellule.data.byteOffset, cellule.data.length)
    const b = boiteOpaque(cpx, cellule.width, cellule.height)
    if (!b) {
      console.warn(`! ${pl.fichier} case ${i + 1} vide`)
      return
    }
    const r = pl.retrait ?? 0
    let piece = rogner(cellule, b.x + r, b.y + r, b.w - 2 * r, b.h - 2 * r)
    if (pl.raccord && !c.brut) {
      const p = new Uint8ClampedArray(piece.data.buffer, piece.data.byteOffset, piece.data.length)
      const rac = raccorder(p, piece.width, piece.height, pl.raccord === 'long')
      piece.data = Buffer.from(rac.buffer, rac.byteOffset, rac.length)
    }
    /* Une icône de rayon : rangée à part, sous le nom du rayon, hors du catalogue. */
    if (pl.icones) {
      const f = join(PACK, 'icones', `${c.id}.png`)
      mkdirSync(dirname(f), { recursive: true })
      writeFileSync(f, PNG.sync.write(piece))
      console.log(`icones/${c.id}.png  ${piece.width}×${piece.height}`)
      return
    }
    const type = typeof pl.type === 'function' ? pl.type(c) : pl.type
    const fichier = `${pl.dossier}/${c.id}.png`
    mkdirSync(dirname(join(PACK, fichier)), { recursive: true })
    writeFileSync(join(PACK, fichier), PNG.sync.write(piece))
    const [categorie, sousCategorie] = RANGEMENT[c.id] ?? [pl.categorie, undefined]
    const entree: Record<string, unknown> = { id: `${pl.dossier}/${c.id}`, type, nom: c.nom, categorie, fichier }
    if (sousCategorie) entree.sousCategorie = sousCategorie
    if (type === 'sol' || type === 'mur') entree.tuile = c.tuile ?? 2
    if (type === 'objet') {
      const l = c.l ?? 1
      entree.l = l
      entree.h = Math.round(((l * piece.height) / piece.width) * 100) / 100
      entree.bloquePas = !!c.pas
      entree.bloqueVue = !!c.vue
    }
    catalogue.push(entree)
    console.log(`${fichier}  ${piece.width}×${piece.height}`)
  })
}

/* L'ordre de la palette : les sols, murs et ouvertures d'abord, puis les objets
   par catégorie et sous-catégorie, dans un ordre qui se lit. */
const ORDRE_CATEGORIES = ['Mobilier', 'Lumière', 'Objets', 'Architecture', 'Nature', 'Macabre', 'Moderne']
const ORDRE_SOUS = [
  'Lits', 'Assises', 'Tables', 'Rangements', 'Cuisine', 'Bain', 'Cheminées', 'Tapis', 'Paravents', 'Musique',
  'Lampes', 'Lampadaires', 'Plafonniers', 'Appliques', 'Bougies',
  'Livres et papiers', 'Nourriture', 'Vaisselle', 'Décoration', 'Électroménager',
  'Arbres', 'Végétation', 'Rochers', 'Bois mort', 'Toiles d’araignées'
]
const rang = (e: Record<string, unknown>): [number, number] => {
  if (e.type !== 'objet') return [-1, 0]
  const c = ORDRE_CATEGORIES.indexOf(String(e.categorie))
  const s = ORDRE_SOUS.indexOf(String(e.sousCategorie ?? ''))
  return [c < 0 ? 99 : c, s < 0 ? 0 : s]
}
catalogue.sort((a, b) => {
  const [ca, sa] = rang(a)
  const [cb, sb] = rang(b)
  return ca - cb || sa - sb
})

writeFileSync(join(PACK, 'catalogue.json'), JSON.stringify({ v: 1, assets: catalogue }, null, 2) + '\n')
console.log(`${catalogue.length} assets → resources/atelier/catalogue.json`)
