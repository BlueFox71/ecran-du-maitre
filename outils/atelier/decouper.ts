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
  /**
   * La boîte de l'élément dans la planche, en pixels [x, y, l, h], à la place
   * de sa case de grille : pour un élément fait de morceaux séparés (les
   * bandes d'un passage piéton), qu'aucune isolation ne garderait entier.
   */
  zone?: [number, number, number, number]
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
  'herbe-rase': ['Herbe', ''],
  'pierre-moussue': ['Pierre', ''],
  'moellons': ['Pierre', ''],
  'brique-rouge': ['Brique', ''],
  'palissade-cloutee': ['Bois', ''],
  'pierre-grise': ['Pierre', ''],
  'pierre-taillee': ['Pierre', ''],
  'brique-claire': ['Brique', ''],
  'planches-mur': ['Bois', ''],
  'pierre-joints-mousse': ['Pierre', ''],
  'colombage': ['Bois', ''],
  'calcaire': ['Pierre', ''],
  'pierre-seche': ['Pierre', ''],
  'ruines': ['Nature', ''],
  'haie': ['Nature', ''],
  'roche': ['Nature', ''],
  'beton': ['Plâtre et béton', ''],
  'platre-blanc': ['Plâtre et béton', ''],
  'cachot': ['Pierre', ''],
  'briques-suie': ['Brique', ''],
  'pierre-sombre': ['Pierre', ''],
  'platre-boiserie': ['Bois', ''],
  'briques': ['Brique', ''],
  'asphalte-neuf': ['Ville', ''],
  'asphalte-use': ['Ville', ''],
  'asphalte-mouille': ['Ville', ''],
  'dalles-trottoir': ['Ville', ''],
  'trottoir-beton': ['Ville', ''],
  'paves-autobloquants': ['Ville', ''],
  'beton-parking': ['Ville', ''],
  'asphalte-rapiece': ['Ville', ''],
  'bande-podotactile': ['Ville', ''],
  'beton-desactive': ['Ville', ''],
  'paves-granit': ['Ville', ''],
  'beton-ruelle': ['Ville', ''],
  'bordure-trottoir': ['Ville', 'Voirie'],
  'bordure-angle': ['Ville', 'Voirie'],
  'bateau-trottoir': ['Ville', 'Voirie'],
  'grille-egout': ['Ville', 'Voirie'],
  'plaque-egout': ['Ville', 'Voirie'],
  'tache-huile': ['Ville', 'Voirie'],
  'nid-de-poule': ['Ville', 'Voirie'],
  'passage-pieton': ['Ville', 'Marquages'],
  'place-parking': ['Ville', 'Marquages'],
  'fleche-tout-droit': ['Ville', 'Marquages'],
  'fleche-tourner': ['Ville', 'Marquages'],
  'logo-handicape': ['Ville', 'Marquages'],
  'ligne-discontinue': ['Ville', 'Marquages'],
  'double-ligne-jaune': ['Ville', 'Marquages'],
  'voiture-berline': ['Ville', 'Véhicules'],
  'voiture-citadine': ['Ville', 'Véhicules'],
  camionnette: ['Ville', 'Véhicules'],
  scooter: ['Ville', 'Véhicules'],
  'velo-arceau': ['Ville', 'Véhicules'],
  lampadaire: ['Ville', 'Mobilier urbain'],
  potelet: ['Ville', 'Mobilier urbain'],
  'poubelle-rue': ['Ville', 'Mobilier urbain'],
  'banc-public': ['Ville', 'Mobilier urbain'],
  'bouche-incendie': ['Ville', 'Mobilier urbain'],
  horodateur: ['Ville', 'Mobilier urbain'],
  cone: ['Ville', 'Mobilier urbain'],
  'conteneur-ordures': ['Ville', 'Ruelle'],
  cartons: ['Ville', 'Ruelle'],
  'moquette-nuages': ['Restaurant', ''],
  'moquette-treillis': ['Restaurant', ''],
  'parquet-laque-rouge': ['Restaurant', ''],
  'terrazzo-jade': ['Restaurant', ''],
  'carrelage-cuisine-rouge': ['Restaurant', ''],
  'carrelage-cuisine-gris': ['Restaurant', ''],
  'carrelage-cuisine-gras': ['Restaurant', ''],
  'damier-beige-rouge': ['Restaurant', ''],
  'mur-laque-rouge': ['Restaurant', ''],
  'mur-papier-peint-rouge': ['Restaurant', ''],
  'mur-faience-cuisine': ['Restaurant', ''],
  'mur-bambou': ['Restaurant', ''],
  'table-banquet': ['Restaurant', 'Salle'],
  'buffet-chauffe-plats': ['Restaurant', 'Salle'],
  'box-banquettes': ['Restaurant', 'Salle'],
  'comptoir-accueil': ['Restaurant', 'Salle'],
  'table-ronde-quatre': ['Restaurant', 'Salle'],
  'table-carree-deux': ['Restaurant', 'Salle'],
  'aquarium-homards': ['Restaurant', 'Salle'],
  'chariot-dim-sum': ['Restaurant', 'Salle'],
  'banc-attente': ['Restaurant', 'Salle'],
  'table-carree-quatre': ['Restaurant', 'Salle'],
  'table-six': ['Restaurant', 'Salle'],
  'box-marbre': ['Restaurant', 'Salle'],
  'tabouret-laque': ['Restaurant', 'Salle'],
  'comptoir-caisse': ['Restaurant', 'Salle'],
  'bassin-koi': ['Restaurant', 'Salle'],
  'paravent-laque': ['Restaurant', 'Décor chinois'],
  'paravent-fleurs': ['Restaurant', 'Décor chinois'],
  autel: ['Restaurant', 'Décor chinois'],
  'lion-gardien': ['Restaurant', 'Décor chinois'],
  'vase-porcelaine': ['Restaurant', 'Décor chinois'],
  'bambou-pot': ['Restaurant', 'Décor chinois'],
  'lanterne-papier': ['Restaurant', 'Décor chinois'],
  'lanterne-soie': ['Restaurant', 'Décor chinois'],
  'chat-porte-bonheur': ['Restaurant', 'Décor chinois'],
  'brule-encens': ['Restaurant', 'Décor chinois'],
  'enveloppes-rouges': ['Restaurant', 'Décor chinois'],
  'piano-woks': ['Restaurant', 'Cuisine'],
  'piano-deux-woks': ['Restaurant', 'Cuisine'],
  'table-preparation': ['Restaurant', 'Cuisine'],
  plonge: ['Restaurant', 'Cuisine'],
  'frigo-pro': ['Restaurant', 'Cuisine'],
  'plan-refrigere': ['Restaurant', 'Cuisine'],
  'paniers-vapeur': ['Restaurant', 'Cuisine'],
  'cuiseur-riz': ['Restaurant', 'Cuisine'],
  friteuse: ['Restaurant', 'Cuisine'],
  'marmite-bouillon': ['Restaurant', 'Cuisine'],
  'etagere-inox': ['Restaurant', 'Cuisine'],
  'etagere-vaisselle': ['Restaurant', 'Cuisine'],
  'vitrine-canards': ['Restaurant', 'Cuisine'],
  'canards-laques': ['Restaurant', 'Cuisine'],
  'sacs-riz': ['Restaurant', 'Cuisine'],
  'cagette-legumes': ['Restaurant', 'Cuisine'],
  'poubelle-cuisine': ['Restaurant', 'Cuisine'],
  'chariot-vaisselle': ['Restaurant', 'Cuisine'],
  'plateau-tournant': ['Restaurant', 'Plats'],
  'canard-laque': ['Restaurant', 'Plats'],
  'bol-riz': ['Restaurant', 'Plats'],
  'dim-sum': ['Restaurant', 'Plats'],
  'wok-nouilles': ['Restaurant', 'Plats'],
  'service-the': ['Restaurant', 'Plats'],
  'boites-emporter': ['Restaurant', 'Plats'],
  sauces: ['Restaurant', 'Plats'],
  'biscuits-chinois': ['Restaurant', 'Plats'],
  'bouteilles-biere': ['Restaurant', 'Plats'],
  'wok-ingredients-crus': ['Restaurant', 'Buffet'],
  'wok-bar-sauces': ['Restaurant', 'Buffet'],
  'wok-ligne-cuisson': ['Restaurant', 'Buffet'],
  'wok-passe': ['Restaurant', 'Buffet'],
  'statue-moine': ['Restaurant', 'Décor chinois'],
  'statue-chat': ['Restaurant', 'Décor chinois'],
  'paravent-riz': ['Mobilier', 'Paravents'],
  'paravent-jade': ['Mobilier', 'Paravents'],
  'tapis-sas': ['Restaurant', 'Décor chinois'],
  'bureau-deux-ecrans': ['Moderne', 'Bureau'],
  'imprimante-bureau': ['Moderne', 'Bureau'],
  'classeur-metal': ['Moderne', 'Bureau'],
  'etagere-classeurs': ['Moderne', 'Bureau'],
  'armoire-bureau': ['Moderne', 'Bureau'],
  'toilettes-pmr': ['Moderne', 'Bain'],
  urinoirs: ['Moderne', 'Bain'],
  'vasques-toilettes': ['Moderne', 'Bain'],
  'table-a-langer': ['Moderne', 'Bain'],
  'derouleur-papier-wc': ['Moderne', 'Bain'],
  'distributeur-papier-wc': ['Moderne', 'Bain'],
  'seche-mains': ['Moderne', 'Bain'],
  'seche-mains-lame': ['Moderne', 'Bain'],
  'distributeur-essuie-mains': ['Moderne', 'Bain'],
  'distributeur-savon': ['Moderne', 'Bain'],
  'poubelle-pedale': ['Moderne', 'Bain'],
  'balai-wc': ['Moderne', 'Bain'],
  'poubelle-essuie-mains': ['Moderne', 'Bain'],
  'pack-papier-wc': ['Moderne', 'Bain']
}

interface Planche {
  fichier: string
  fond: 'magenta' | 'noir' | 'aucun'
  cols: number
  rows: number
  type: TypeAsset | ((c: Case) => TypeAsset)
  categorie: string
  /** La sous-catégorie de toute la planche (ce que `RANGEMENT` dit d'une case prime). */
  sousCategorie?: string
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
  /** Une porte : l'image est centrée sur ses montants, pour qu'une poignée
      ou un heurtoir d'un seul côté ne décale pas le battant dans le mur. */
  centrerMontants?: boolean
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
    fichier: 'planches/lot 32.png',
    fond: 'magenta',
    lignes: [4, 5, 5],
    cols: 5,
    rows: 3,
    type: 'objet',
    categorie: 'Ville',
    dossier: 'objets',
    /* Des cases qui débordent de la grille, des marquages en morceaux : chaque élément a sa zone. */
    cases: [
      { id: 'bordure-trottoir', nom: 'Bordure de trottoir', l: 2, zone: [5, 140, 470, 110] },
      { id: 'bordure-angle', nom: 'Bordure d’angle', l: 1.5, zone: [482, 48, 245, 252] },
      { id: 'bateau-trottoir', nom: 'Bateau (trottoir abaissé)', l: 2, zone: [735, 145, 455, 110] },
      { id: 'grille-egout', nom: 'Grille d’égout', l: 0.6, zone: [1205, 78, 325, 222] },
      { id: 'passage-pieton', nom: 'Passage piéton', l: 2.5, zone: [35, 375, 310, 300] },
      { id: 'place-parking', nom: 'Place de parking', l: 1.7, zone: [410, 365, 240, 305] },
      { id: 'fleche-tout-droit', nom: 'Flèche tout droit', l: 0.6, zone: [750, 362, 140, 310] },
      { id: 'fleche-tourner', nom: 'Flèche tourner', l: 0.9, zone: [975, 362, 232, 310] },
      { id: 'logo-handicape', nom: 'Pictogramme handicapé', l: 0.9, zone: [1250, 372, 275, 290] },
      { id: 'ligne-discontinue', nom: 'Ligne discontinue', l: 3, zone: [10, 815, 320, 65] },
      { id: 'double-ligne-jaune', nom: 'Double ligne jaune', l: 2, zone: [335, 800, 300, 95] },
      { id: 'plaque-egout', nom: 'Plaque d’égout', l: 0.5, zone: [645, 715, 255, 265] },
      { id: 'tache-huile', nom: 'Tache d’huile', l: 1, zone: [910, 715, 300, 250] },
      { id: 'nid-de-poule', nom: 'Nid-de-poule', l: 0.8, zone: [1220, 735, 310, 240] }
    ]
  },
  {
    fichier: 'planches/lot 33.png',
    fond: 'magenta',
    isoler: true,
    lignes: [4, 5, 5],
    cols: 5,
    rows: 3,
    type: 'objet',
    categorie: 'Ville',
    dossier: 'objets',
    cases: [
      { id: 'voiture-berline', nom: 'Berline', l: 3, pas: true },
      { id: 'voiture-citadine', nom: 'Citadine', l: 2.5, pas: true },
      { id: 'camionnette', nom: 'Camionnette', l: 3.6, pas: true, vue: true },
      { id: 'scooter', nom: 'Scooter', l: 1.2, pas: true },
      { id: 'lampadaire', nom: 'Lampadaire', l: 0.8 },
      { id: 'potelet', nom: 'Potelet', l: 0.15 },
      { id: 'poubelle-rue', nom: 'Poubelle de rue', l: 0.4, pas: true },
      { id: 'banc-public', nom: 'Banc public', l: 1.2, pas: true },
      { id: 'conteneur-ordures', nom: 'Conteneur à ordures', l: 1.3, pas: true },
      { id: 'bouche-incendie', nom: 'Bouche d’incendie', l: 0.3 },
      { id: 'horodateur', nom: 'Horodateur', l: 0.3, pas: true },
      { id: 'velo-arceau', nom: 'Vélo à l’arceau', l: 1.2, pas: true },
      { id: 'cone', nom: 'Cône de chantier', l: 0.3 },
      { id: 'cartons', nom: 'Cartons empilés', l: 0.8, pas: true }
    ]
  },
  {
    fichier: 'planches/lot 34.png',
    fond: 'magenta',
    isoler: true,
    lignes: [4, 5, 5],
    cols: 5,
    rows: 3,
    type: 'objet',
    categorie: 'Restaurant',
    dossier: 'objets',
    /* La dernière rangée n'est pas calée sur la grille : chaque élément a sa zone. */
    cases: [
      { id: 'table-banquet', nom: 'Table de banquet (8 places)', l: 2.2, pas: true },
      { id: 'buffet-chauffe-plats', nom: 'Buffet à chauffe-plats', l: 1.6, pas: true },
      { id: 'box-banquettes', nom: 'Box à banquettes', l: 1.3, pas: true },
      { id: 'comptoir-accueil', nom: 'Comptoir d’accueil', l: 1.4, pas: true },
      { id: 'table-ronde-quatre', nom: 'Table ronde (4 places)', l: 1.4, pas: true },
      { id: 'table-carree-deux', nom: 'Table carrée (2 places)', l: 0.9, pas: true },
      { id: 'aquarium-homards', nom: 'Aquarium à homards', l: 1.2, pas: true },
      { id: 'paravent-laque', nom: 'Paravent laqué', l: 1.4, pas: true, vue: true },
      { id: 'autel', nom: 'Autel', l: 0.6, pas: true },
      { id: 'lion-gardien', nom: 'Lion gardien', l: 0.6, pas: true, zone: [40, 700, 195, 290] },
      { id: 'vase-porcelaine', nom: 'Vase de porcelaine', l: 0.4, pas: true, zone: [270, 700, 200, 290] },
      { id: 'bambou-pot', nom: 'Bambou en pot', l: 0.5, pas: true, zone: [495, 670, 215, 320] },
      { id: 'chariot-dim-sum', nom: 'Chariot à dim sum', l: 0.8, pas: true, zone: [745, 715, 320, 270] },
      { id: 'banc-attente', nom: 'Banc d’attente', l: 1.1, pas: true, zone: [1100, 720, 415, 250] }
    ]
  },
  {
    fichier: 'planches/lot 35.png',
    fond: 'magenta',
    isoler: true,
    lignes: [4, 5, 5],
    cols: 5,
    rows: 3,
    type: 'objet',
    categorie: 'Restaurant',
    dossier: 'objets',
    cases: [
      { id: 'piano-woks', nom: 'Piano à woks', l: 1.6, pas: true },
      { id: 'table-preparation', nom: 'Table de préparation', l: 1.4, pas: true },
      { id: 'plonge', nom: 'Plonge double', l: 1.2, pas: true },
      { id: 'frigo-pro', nom: 'Frigo professionnel', l: 1, pas: true, vue: true },
      { id: 'paniers-vapeur', nom: 'Paniers vapeur', l: 0.5, pas: true },
      { id: 'cuiseur-riz', nom: 'Cuiseur à riz', l: 0.4, pas: true },
      { id: 'friteuse', nom: 'Friteuse', l: 0.5, pas: true },
      { id: 'marmite-bouillon', nom: 'Marmite de bouillon', l: 0.6, pas: true },
      { id: 'etagere-inox', nom: 'Étagère inox', l: 1.2, pas: true, vue: true },
      { id: 'canards-laques', nom: 'Canards laqués suspendus', l: 0.8 },
      { id: 'sacs-riz', nom: 'Sacs de riz', l: 0.8, pas: true },
      { id: 'cagette-legumes', nom: 'Cagette de légumes', l: 0.5 },
      { id: 'poubelle-cuisine', nom: 'Poubelle de cuisine', l: 0.4, pas: true },
      { id: 'chariot-vaisselle', nom: 'Chariot de vaisselle', l: 0.7, pas: true }
    ]
  },
  {
    fichier: 'planches/lot 36.png',
    fond: 'magenta',
    isoler: true,
    cols: 5,
    rows: 3,
    type: 'objet',
    categorie: 'Restaurant',
    dossier: 'objets',
    /* Les éléments en plusieurs morceaux (bouteilles, boîtes et sac, fumée) ont leur zone. */
    cases: [
      { id: 'lanterne-papier', nom: 'Lanterne de papier', l: 0.4 },
      { id: 'lanterne-soie', nom: 'Grande lanterne de soie', l: 0.6 },
      { id: 'plateau-tournant', nom: 'Plateau tournant garni', l: 0.9 },
      { id: 'canard-laque', nom: 'Canard laqué', l: 0.4 },
      { id: 'bol-riz', nom: 'Bol de riz', l: 0.15 },
      { id: 'dim-sum', nom: 'Paniers de dim sum', l: 0.35 },
      { id: 'wok-nouilles', nom: 'Wok de nouilles', l: 0.4 },
      { id: 'service-the', nom: 'Service à thé', l: 0.3 },
      { id: 'chat-porte-bonheur', nom: 'Chat porte-bonheur', l: 0.15 },
      { id: 'boites-emporter', nom: 'Boîtes à emporter', l: 0.3, zone: [1230, 362, 296, 296] },
      { id: 'sauces', nom: 'Sauces', l: 0.2 },
      { id: 'biscuits-chinois', nom: 'Biscuits chinois', l: 0.15 },
      { id: 'bouteilles-biere', nom: 'Bouteilles de bière', l: 0.2, zone: [630, 710, 250, 275] },
      { id: 'brule-encens', nom: 'Brûle-encens', l: 0.2, zone: [925, 660, 265, 320] },
      { id: 'enveloppes-rouges', nom: 'Enveloppes rouges', l: 0.2 }
    ]
  },
  {
    fichier: 'planches/lot 37.png',
    fond: 'magenta',
    isoler: true,
    lignes: [5, 5, 5, 6],
    cols: 6,
    rows: 4,
    type: 'objet',
    categorie: 'Restaurant',
    dossier: 'objets',
    /* Une première version de la salle et de la cuisine : n'en restent que les
       variantes ; la 2e rangée, décalée sur la grille, a ses zones. */
    cases: [
      null,
      { id: 'table-carree-quatre', nom: 'Table carrée (4 places)', l: 1.2, pas: true },
      { id: 'table-six', nom: 'Table rectangulaire (6 places)', l: 1.6, pas: true },
      { id: 'box-marbre', nom: 'Box à table de marbre', l: 1.4, pas: true },
      { id: 'tabouret-laque', nom: 'Tabouret laqué', l: 0.3 },
      { id: 'comptoir-caisse', nom: 'Comptoir-caisse', l: 2.2, pas: true, zone: [15, 360, 495, 180] },
      { id: 'paravent-fleurs', nom: 'Paravent aux cerisiers', l: 1.4, pas: true, vue: true, zone: [530, 340, 295, 200] },
      { id: 'bassin-koi', nom: 'Bassin à koïs', l: 1.4, pas: true, zone: [845, 355, 330, 175] },
      null,
      null,
      { id: 'vitrine-canards', nom: 'Vitrine à canards laqués', l: 1.4, pas: true },
      null,
      { id: 'piano-deux-woks', nom: 'Piano à deux woks', l: 1.3, pas: true },
      null,
      null,
      null,
      { id: 'etagere-vaisselle', nom: 'Étagère à vaisselle', l: 1, pas: true, vue: true },
      null,
      { id: 'plan-refrigere', nom: 'Plan de travail réfrigéré', l: 1.3, pas: true },
      null,
      null
    ]
  },
  {
    fichier: 'planches/murs 7.png',
    fond: 'magenta',
    isoler: 'case',
    cols: 1,
    rows: 4,
    type: 'mur',
    categorie: 'Murs',
    dossier: 'murs',
    retrait: 6,
    raccord: 'long',
    cases: [
      { id: 'mur-laque-rouge', nom: 'Laque rouge', tuile: 2.5 },
      { id: 'mur-papier-peint-rouge', nom: 'Papier peint rouge et or', tuile: 2.5 },
      { id: 'mur-faience-cuisine', nom: 'Faïence de cuisine', tuile: 2.5 },
      { id: 'mur-bambou', nom: 'Bambou', tuile: 2.5 }
    ]
  },
  {
    /* Des tuiles plus hautes que larges : l'atelier garde leurs proportions. */
    fichier: 'planches/sols 7.png',
    fond: 'magenta',
    isoler: 'case',
    cols: 4,
    rows: 2,
    type: 'sol',
    categorie: 'Sols',
    dossier: 'sols',
    retrait: 16,
    raccord: 'deux',
    cases: [
      { id: 'moquette-nuages', nom: 'Moquette rouge aux nuages', tuile: 2 },
      { id: 'moquette-treillis', nom: 'Moquette bordeaux à treillis', tuile: 2, brut: true },
      { id: 'parquet-laque-rouge', nom: 'Parquet laqué rouge', tuile: 1.5, brut: true },
      { id: 'terrazzo-jade', nom: 'Terrazzo jade', tuile: 2 },
      { id: 'carrelage-cuisine-rouge', nom: 'Carrelage de cuisine rouge', tuile: 1.5, brut: true },
      { id: 'carrelage-cuisine-gris', nom: 'Carrelage de cuisine gris', tuile: 1.5, brut: true },
      { id: 'carrelage-cuisine-gras', nom: 'Carrelage de cuisine gras', tuile: 1.5, brut: true },
      { id: 'damier-beige-rouge', nom: 'Damier beige et rouge', tuile: 1.5, brut: true }
    ]
  },
  {
    fichier: 'planches/lot 38.png',
    fond: 'magenta',
    isoler: true,
    lignes: [3, 4, 5],
    cols: 5,
    rows: 3,
    type: 'objet',
    categorie: 'Restaurant',
    sousCategorie: 'Buffet',
    dossier: 'objets',
    cases: [
      { id: 'buffet-chaud', nom: 'Îlot de buffet chaud', l: 3, pas: true },
      { id: 'buffet-fruits-de-mer', nom: 'Buffet de fruits de mer', l: 3, pas: true },
      { id: 'buffet-sushis', nom: 'Buffet de sushis', l: 3, pas: true },
      { id: 'station-teppanyaki', nom: 'Station teppanyaki', l: 2, pas: true },
      { id: 'station-wok', nom: 'Station wok', l: 2, pas: true },
      { id: 'buffet-desserts', nom: 'Buffet de desserts', l: 2, pas: true },
      { id: 'bar-salades-fruits', nom: 'Bar à salades et fruits', l: 2, pas: true },
      { id: 'station-soupes', nom: 'Station à soupes', l: 1.2, pas: true },
      { id: 'station-dim-sum', nom: 'Station à dim sum', l: 1.2, pas: true },
      { id: 'congelateur-glaces', nom: 'Congélateur à glaces', l: 1.2, pas: true },
      { id: 'station-boissons', nom: 'Station boissons', l: 1.2, pas: true },
      { id: 'distributeurs-assiettes', nom: 'Distributeurs d’assiettes', l: 0.9, pas: true }
    ]
  },
  {
    fichier: 'planches/lot 39.png',
    fond: 'magenta',
    isoler: true,
    lignes: [4, 5, 5],
    cols: 5,
    rows: 3,
    type: 'objet',
    categorie: 'Restaurant',
    sousCategorie: 'Salle',
    dossier: 'objets',
    /* Les tables dont les chaises ne touchent pas le plateau ont leur zone. */
    cases: [
      { id: 'box-moderne', nom: 'Box moderne', l: 1.3, pas: true },
      { id: 'table-six-moderne', nom: 'Table pour six', l: 1.6, pas: true, zone: [415, 70, 355, 300] },
      { id: 'table-ronde-marbre', nom: 'Table ronde en marbre (8 places)', l: 2.2, pas: true, zone: [775, 2, 396, 392] },
      { id: 'accueil-moderne', nom: 'Accueil moderne', l: 1.4, pas: true },
      { id: 'table-noire-quatre', nom: 'Table noire (4 places)', l: 1.2, pas: true, zone: [25, 425, 235, 260] },
      { id: 'table-ronde-deux', nom: 'Table ronde (2 places)', l: 0.9, pas: true, zone: [285, 465, 270, 175] },
      { id: 'table-haute-tabourets', nom: 'Table haute et tabourets', l: 1, pas: true, zone: [565, 420, 325, 240] },
      { id: 'claustra-chene', nom: 'Claustra en chêne', l: 1.5, pas: true },
      { id: 'jardiniere-graminees', nom: 'Jardinière de graminées', l: 1.2, pas: true },
      { id: 'suspensions-trio', nom: 'Trio de suspensions', l: 0.8 },
      { id: 'suspension-lineaire', nom: 'Suspension linéaire', l: 1.2 },
      { id: 'chariot-debarrassage', nom: 'Chariot de débarrassage', l: 0.8, pas: true },
      { id: 'borne-commande', nom: 'Borne de commande', l: 0.4, pas: true },
      { id: 'retour-plateaux', nom: 'Retour des plateaux', l: 1.2, pas: true }
    ]
  },
  {
    fichier: 'planches/lot 40.png',
    fond: 'magenta',
    isoler: true,
    cols: 5,
    rows: 3,
    type: 'objet',
    categorie: 'Restaurant',
    sousCategorie: 'Décor chinois',
    dossier: 'objets',
    cases: [
      { id: 'plafond-lanternes', nom: 'Plafond de lanternes', l: 1.5 },
      { id: 'lanterne-tambour', nom: 'Lanterne tambour blanche', l: 0.6 },
      { id: 'bonsai', nom: 'Bonsaï', l: 0.6, pas: true },
      { id: 'orchidees', nom: 'Coupe d’orchidées', l: 0.4 },
      { id: 'dragon-dore', nom: 'Dragon doré', l: 0.8, pas: true },
      { id: 'jardin-zen', nom: 'Jardin zen', l: 1.5, pas: true },
      { id: 'fontaine-galets', nom: 'Fontaine de galets', l: 0.8, pas: true },
      { id: 'vasque-poissons', nom: 'Vasque à poissons', l: 0.7, pas: true },
      { id: 'prunier-fleuri', nom: 'Prunier en fleurs', l: 0.8, pas: true, zone: [950, 355, 280, 275] },
      { id: 'arbre-jade', nom: 'Arbre de jade', l: 0.6, pas: true },
      { id: 'tapis-rond-nuages', nom: 'Tapis rond aux nuages', l: 2 },
      { id: 'tapis-couloir-jade', nom: 'Tapis de couloir jade', l: 3 },
      { id: 'vitrine-porcelaines', nom: 'Vitrine de porcelaines', l: 1.2, pas: true, vue: true },
      { id: 'lion-moderne', nom: 'Lion moderne', l: 0.6, pas: true },
      { id: 'centre-de-table', nom: 'Centre de table', l: 0.3 }
    ]
  },
  {
    /* Le buffet la nuit, restaurant fermé : des modules double face qu'on aligne
       bout à bout. Leur longueur est choisie pour qu'ils aient tous la même
       profondeur. */
    fichier: 'planches/lot 41.png',
    fond: 'magenta',
    isoler: true,
    lignes: [5, 5, 4],
    cols: 5,
    rows: 3,
    type: 'objet',
    categorie: 'Restaurant',
    sousCategorie: 'Buffet fermé',
    /* Les cases 3-4 et 7-8 se touchent presque : une zone chacune. */
    dossier: 'objets',
    cases: [
      { id: 'buffet-vide-froid', nom: 'Buffet fermé : bacs réfrigérés', l: 1.7, pas: true },
      { id: 'buffet-vide-glace', nom: 'Buffet fermé : banc à glace', l: 1.7, pas: true },
      { id: 'buffet-vide-sushis', nom: 'Buffet fermé : ardoises à sushis', l: 1.7, pas: true, zone: [617, 88, 301, 260] },
      { id: 'buffet-vide-lampes', nom: 'Buffet fermé : lampes chauffantes', l: 1.7, pas: true, zone: [919, 70, 302, 278] },
      { id: 'buffet-vide-vapeur', nom: 'Buffet fermé : paniers vapeur', l: 1.7, pas: true },
      { id: 'buffet-vide-bain-marie', nom: 'Buffet fermé : bains-marie fermés', l: 1.7, pas: true },
      { id: 'buffet-vide-bacs-retires', nom: 'Buffet fermé : bacs retirés', l: 1.7, pas: true, zone: [314, 402, 301, 262] },
      { id: 'buffet-vide-desserts', nom: 'Buffet fermé : présentoirs à desserts', l: 1.7, pas: true, zone: [616, 402, 302, 262] },
      { id: 'buffet-vide-fruits', nom: 'Buffet fermé : fruits', l: 1.7, pas: true },
      { id: 'buffet-glaces-cadenas', nom: 'Buffet : bahut à glaces cadenassé', l: 1.7, pas: true },
      { id: 'buffet-bonbons', nom: 'Buffet : bar à bonbons', l: 2.33, pas: true },
      { id: 'buffet-condiments', nom: 'Buffet : condiments et chips', l: 2.53, pas: true },
      { id: 'buffet-embout-gauche', nom: 'Buffet : embout gauche (assiettes)', l: 1.67, pas: true },
      { id: 'buffet-embout-droit', nom: 'Buffet : embout droit', l: 1.73, pas: true }
    ]
  },
  {
    /* Le stand wok, le grand bar, le décor : restaurant fermé, tout est rangé. */
    fichier: 'planches/lot 42.png',
    fond: 'magenta',
    isoler: true,
    cols: 5,
    rows: 3,
    type: 'objet',
    categorie: 'Restaurant',
    sousCategorie: 'Bar',
    dossier: 'objets',
    cases: [
      { id: 'wok-ingredients-crus', nom: 'Wok : comptoir d’ingrédients', l: 2, pas: true },
      { id: 'wok-bar-sauces', nom: 'Wok : bar à sauces', l: 2, pas: true },
      { id: 'wok-ligne-cuisson', nom: 'Wok : plancha et woks', l: 3, pas: true },
      /* À cheval sur deux cases de grille. */
      { id: 'wok-passe', nom: 'Wok : passe', l: 1.5, pas: true, zone: [1110, 92, 236, 242] },
      { id: 'tabouret-bar-moderne', nom: 'Tabouret de bar moderne', l: 0.35 },
      { id: 'bar-comptoir-long', nom: 'Grand comptoir de bar', l: 3.3, pas: true },
      { id: 'bar-comptoir-angle', nom: 'Angle du grand comptoir', l: 1.18, pas: true },
      { id: 'bar-arriere-cafe', nom: 'Arrière-bar : café et verres', l: 1.95, pas: true },
      { id: 'bar-arriere-pression', nom: 'Arrière-bar : pression et bouteilles', l: 1.9, pas: true },
      { id: 'bar-caisse', nom: 'Bout de comptoir caisse', l: 1.6, pas: true },
      { id: 'statue-moine', nom: 'Statue de moine', l: 1, pas: true },
      { id: 'statue-chat', nom: 'Statue de chat', l: 0.9, pas: true },
      { id: 'paravent-riz', nom: 'Paravent papier de riz', l: 1.6, pas: true, vue: true },
      { id: 'paravent-jade', nom: 'Paravent treillis jade', l: 1.4, pas: true, vue: true },
      { id: 'tapis-sas', nom: 'Tapis de sas', l: 1.3 }
    ]
  },
  {
    /* Le bar à bonbons : les trois modules à bocaux de la première rangée ne
       sont pas retenus, le mur de distributeurs les remplace. */
    fichier: 'planches/lot 43.png',
    fond: 'magenta',
    isoler: true,
    cols: 3,
    rows: 2,
    type: 'objet',
    categorie: 'Restaurant',
    sousCategorie: 'Buffet fermé',
    dossier: 'objets',
    cases: [
      null,
      null,
      null,
      { id: 'bonbons-mur-distributeurs', nom: 'Mur de distributeurs de bonbons', l: 2.8, pas: true },
      { id: 'bonbons-sachets', nom: 'Comptoir à sachets', l: 1, pas: true },
      { id: 'bonbons-embout', nom: 'Bonbons : embout', l: 1.79, pas: true }
    ]
  },
  {
    /* Plafonds chinois, bureau, toilettes. L'escalier (case 11) est en
       perspective : refait à part. Les éléments en plusieurs morceaux ont leur zone. */
    fichier: 'planches/lot 44.png',
    fond: 'magenta',
    isoler: true,
    cols: 5,
    rows: 4,
    type: 'objet',
    categorie: 'Restaurant',
    sousCategorie: 'Plafonds',
    dossier: 'objets',
    cases: [
      { id: 'plafond-dragon-soie', nom: 'Dragon de soie au plafond', l: 4, zone: [0, 60, 398, 130] },
      { id: 'lanterne-palais-rouge', nom: 'Grande lanterne de palais', l: 1 },
      { id: 'rangee-lanternes', nom: 'Rangée de cinq lanternes', l: 2.5, zone: [630, 98, 300, 70] },
      { id: 'lanterne-hexagonale', nom: 'Lanterne hexagonale peinte', l: 0.8, zone: [952, 12, 262, 245] },
      { id: 'plafond-ombrelles', nom: 'Ombrelles suspendues', l: 1.8 },
      { id: 'couronne-lanternes', nom: 'Couronne de lanternes', l: 1.8 },
      { id: 'branches-prunier', nom: 'Branches de prunier suspendues', l: 1.6, zone: [295, 270, 340, 230] },
      { id: 'plafond-rubans', nom: 'Rubans de soie au plafond', l: 2 },
      { id: 'plafonnier-lineaire', nom: 'Plafonnier linéaire', l: 1.5 },
      { id: 'spots-laiton', nom: 'Rampe de trois spots', l: 0.8 },
      null,
      { id: 'bureau-deux-ecrans', nom: 'Bureau à deux écrans', l: 1.2, pas: true, zone: [362, 528, 330, 262] },
      { id: 'imprimante-bureau', nom: 'Imprimante de bureau', l: 0.7, pas: true },
      { id: 'classeur-metal', nom: 'Classeur métallique', l: 0.5, pas: true },
      { id: 'etagere-classeurs', nom: 'Étagère à classeurs', l: 1.2, pas: true },
      { id: 'toilettes-pmr', nom: 'Toilettes accessibles', l: 1, pas: true },
      { id: 'urinoirs', nom: 'Urinoirs', l: 1, pas: true },
      { id: 'vasques-toilettes', nom: 'Double vasque des toilettes', l: 1.5, pas: true },
      { id: 'table-a-langer', nom: 'Table à langer', l: 0.6, pas: true },
      { id: 'armoire-bureau', nom: 'Armoire de bureau', l: 1, pas: true }
    ]
  },
  {
    /* Le vieil escalier caché, en trois états : le haut en haut de l'image. */
    fichier: 'planches/lot 45.png',
    fond: 'magenta',
    isoler: true,
    cols: 3,
    rows: 1,
    type: 'objet',
    categorie: 'Architecture',
    sousCategorie: 'Escaliers',
    dossier: 'objets',
    cases: [
      { id: 'escalier-ancien', nom: 'Vieil escalier en bois', l: 1 },
      { id: 'escalier-ancien-casse', nom: 'Vieil escalier aux marches cassées', l: 1 },
      { id: 'escalier-ancien-palier', nom: 'Vieil escalier et son palier', l: 1.3 }
    ]
  },
  {
    /* The Nine Lives, le speakeasy muré sous le Jardin de Jade. Les éléments en
       morceaux (os, gravats, guirlande, chaise renversée) ont leur zone. */
    fichier: 'planches/lot 46.png',
    fond: 'magenta',
    isoler: true,
    cols: 5,
    rows: 4,
    type: 'objet',
    categorie: 'Speakeasy',
    sousCategorie: 'The Nine Lives',
    dossier: 'objets',
    cases: [
      { id: 'corps-rosalind', nom: 'Corps momifié en robe des années 20', l: 0.8 },
      { id: 'chat-squelette-enroule', nom: 'Squelette de chat enroulé', l: 0.3, zone: [338, 58, 175, 135] },
      { id: 'chat-squelette-allonge', nom: 'Squelette de chat allongé', l: 0.45, zone: [562, 58, 300, 175] },
      { id: 'chats-squelettes-blottis', nom: 'Trois squelettes de chats', l: 0.6, zone: [903, 22, 280, 210] },
      { id: 'gravats-briques', nom: 'Gravats de briques', l: 1, zone: [1228, 18, 305, 232] },
      { id: 'piano-droit', nom: 'Piano droit', l: 1, pas: true, vue: true },
      { id: 'banquette-piano-droit', nom: 'Banquette de piano', l: 0.6, pas: true },
      { id: 'gramophone', nom: 'Gramophone', l: 0.6, pas: true },
      { id: 'guirlande-fleurs-sechees', nom: 'Guirlande de fleurs séchées', l: 2, zone: [828, 328, 368, 145] },
      { id: 'enseigne-nine-lives', nom: 'Enseigne du chat à neuf queues', l: 1.2 },
      { id: 'comptoir-acajou', nom: 'Comptoir en acajou', l: 2, pas: true },
      { id: 'comptoir-acajou-angle', nom: 'Angle du comptoir en acajou', l: 0.8, pas: true },
      { id: 'arriere-bar-miroir', nom: 'Arrière-bar au miroir fendu', l: 2, pas: true },
      { id: 'tonneaux-whiskey', nom: 'Tonneaux de whiskey', l: 1, pas: true },
      { id: 'photo-famille-1925', nom: 'Photo de famille encadrée', l: 0.25 },
      { id: 'table-annees-20', nom: 'Table ronde des années 20', l: 0.7, pas: true },
      { id: 'chaise-bistrot-renversee', nom: 'Chaise bistrot renversée', l: 0.5, zone: [338, 805, 228, 172] },
      { id: 'chaise-bistrot', nom: 'Chaise bistrot', l: 0.4 },
      { id: 'table-poker', nom: 'Table de poker', l: 1.2, pas: true },
      { id: 'lustre-art-deco', nom: 'Lustre Art déco', l: 1 }
    ]
  },
  {
    /* Le poste caisse du grand bar (lot 42) : même profondeur que le comptoir, 1,46. */
    fichier: 'planches/lot 47.png',
    fond: 'magenta',
    isoler: true,
    cols: 3,
    rows: 1,
    type: 'objet',
    categorie: 'Restaurant',
    sousCategorie: 'Bar',
    dossier: 'objets',
    cases: [
      { id: 'bar-comptoir-caisse', nom: 'Grand comptoir : caisse', l: 2.13, pas: true, zone: [20, 300, 580, 420] },
      { id: 'bar-comptoir-caisse-bout', nom: 'Grand comptoir : caisse en bout', l: 2.33, pas: true, zone: [610, 300, 630, 420] },
      { id: 'bar-comptoir-abattant', nom: 'Grand comptoir : abattant', l: 0.89, zone: [1260, 300, 260, 420] }
    ]
  },
  {
    /* Restaurant fermé : tables de préparation vides ; accessoires des toilettes (Moderne / Bain). */
    fichier: 'planches/lot 48.png',
    fond: 'magenta',
    isoler: true,
    cols: 5,
    rows: 3,
    type: 'objet',
    categorie: 'Restaurant',
    sousCategorie: 'Cuisine',
    dossier: 'objets',
    cases: [
      { id: 'table-prep-vide', nom: 'Table de préparation vide', l: 1.4, pas: true, zone: [4, 40, 299, 290] },
      { id: 'table-prep-longue', nom: 'Longue table de préparation vide', l: 2, pas: true, zone: [311, 40, 299, 290] },
      { id: 'table-prep-dosseret', nom: 'Table de préparation à dosseret, vide', l: 1.4, pas: true, zone: [618, 40, 299, 290] },
      { id: 'table-prep-angle', nom: 'Table de préparation d’angle, vide', l: 1.4, pas: true, zone: [925, 40, 299, 290] },
      { id: 'ilot-prep-evier', nom: 'Îlot de préparation et lave-mains', l: 1.8, pas: true, zone: [1232, 40, 300, 290] },
      { id: 'derouleur-papier-wc', nom: 'Dérouleur de papier toilette', l: 0.2, zone: [4, 360, 299, 310] },
      { id: 'distributeur-papier-wc', nom: 'Distributeur de papier toilette', l: 0.25, zone: [311, 360, 299, 310] },
      { id: 'seche-mains', nom: 'Sèche-mains', l: 0.22, zone: [618, 360, 299, 310] },
      { id: 'seche-mains-lame', nom: 'Sèche-mains à lame', l: 0.3, zone: [925, 360, 299, 310] },
      { id: 'distributeur-essuie-mains', nom: 'Distributeur d’essuie-mains', l: 0.25, zone: [1232, 360, 300, 310] },
      { id: 'distributeur-savon', nom: 'Distributeur de savon', l: 0.12, zone: [4, 695, 299, 310] },
      { id: 'poubelle-pedale', nom: 'Poubelle à pédale', l: 0.22, zone: [311, 695, 299, 310] },
      { id: 'balai-wc', nom: 'Balai de toilettes', l: 0.12, zone: [618, 695, 299, 310] },
      { id: 'poubelle-essuie-mains', nom: 'Poubelle à essuie-mains', l: 0.3, zone: [925, 695, 299, 310] },
      { id: 'pack-papier-wc', nom: 'Pack de papier toilette', l: 0.3, zone: [1232, 695, 300, 310] }
    ]
  },
  {
    fichier: 'planches/murs 8.png',
    fond: 'magenta',
    isoler: 'case',
    cols: 1,
    rows: 4,
    type: 'mur',
    categorie: 'Restaurant',
    dossier: 'murs',
    retrait: 6,
    raccord: 'long',
    cases: [
      { id: 'mur-tasseaux-chene', nom: 'Tasseaux de chêne', tuile: 2.5 },
      { id: 'mur-noir-laiton', nom: 'Panneaux noirs et laiton', tuile: 2.5 },
      { id: 'mur-vert-jade', nom: 'Vert jade', tuile: 2.5 },
      { id: 'mur-marbre-blanc', nom: 'Marbre blanc', tuile: 2.5 }
    ]
  },
  {
    fichier: 'planches/sols 8.png',
    fond: 'magenta',
    isoler: 'case',
    cols: 4,
    rows: 2,
    type: 'sol',
    categorie: 'Restaurant',
    dossier: 'sols',
    retrait: 16,
    raccord: 'deux',
    cases: [
      { id: 'gres-anthracite', nom: 'Grès anthracite grand format', tuile: 2, brut: true },
      { id: 'beton-cire', nom: 'Béton ciré', tuile: 2 },
      { id: 'parquet-chene-large', nom: 'Parquet de chêne large', tuile: 1.5, brut: true },
      { id: 'marbre-grand-format', nom: 'Marbre blanc grand format', tuile: 2, brut: true },
      { id: 'hexagones-noirs', nom: 'Hexagones noirs', tuile: 1, brut: true },
      { id: 'pierre-beige', nom: 'Pierre beige', tuile: 2, brut: true },
      { id: 'parquet-chene-fume', nom: 'Parquet de chêne fumé', tuile: 1.5, brut: true },
      { id: 'dalles-moquette', nom: 'Dalles de moquette grise', tuile: 2, brut: true }
    ]
  },
  {
    fichier: 'planches/sols 6.png',
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
      { id: 'asphalte-neuf', nom: 'Asphalte neuf', tuile: 2 },
      { id: 'asphalte-use', nom: 'Asphalte usé', tuile: 2 },
      { id: 'asphalte-mouille', nom: 'Asphalte mouillé', tuile: 2 },
      { id: 'dalles-trottoir', nom: 'Dalles de trottoir', tuile: 2, brut: true },
      { id: 'trottoir-beton', nom: 'Trottoir en béton', tuile: 2, brut: true },
      { id: 'paves-autobloquants', nom: 'Pavés autobloquants', tuile: 1.5, brut: true },
      { id: 'beton-parking', nom: 'Béton de parking', tuile: 2 },
      { id: 'asphalte-rapiece', nom: 'Asphalte rapiécé', tuile: 2 },
      { id: 'bande-podotactile', nom: 'Bande podotactile', tuile: 1, brut: true },
      { id: 'beton-desactive', nom: 'Béton désactivé', tuile: 1.5 },
      { id: 'paves-granit', nom: 'Pavés de granit', tuile: 1.5, brut: true },
      { id: 'beton-ruelle', nom: 'Béton de ruelle', tuile: 2 }
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
    fichier: 'planches/murs 2.png',
    fond: 'magenta',
    isoler: 'case',
    cols: 1,
    rows: 4,
    type: 'mur',
    categorie: 'Murs',
    dossier: 'murs',
    retrait: 6,
    raccord: 'long',
    cases: [
      { id: 'pierre-moussue', nom: 'Pierre moussue', tuile: 2.5 },
      { id: 'moellons', nom: 'Moellons', tuile: 2.5 },
      { id: 'brique-rouge', nom: 'Brique rouge', tuile: 2.5 },
      { id: 'palissade-cloutee', nom: 'Palissade cloutée', tuile: 2.5 }
    ]
  },
  {
    fichier: 'planches/murs 3.png',
    fond: 'magenta',
    isoler: 'case',
    cols: 1,
    rows: 4,
    type: 'mur',
    categorie: 'Murs',
    dossier: 'murs',
    retrait: 6,
    raccord: 'long',
    cases: [
      { id: 'pierre-grise', nom: 'Pierre grise', tuile: 2.5 },
      { id: 'pierre-taillee', nom: 'Pierre taillée', tuile: 2.5 },
      { id: 'brique-claire', nom: 'Brique claire', tuile: 2.5 },
      { id: 'planches-mur', nom: 'Planches', tuile: 2.5 }
    ]
  },
  {
    fichier: 'planches/murs 4.png',
    fond: 'magenta',
    isoler: 'case',
    cols: 1,
    rows: 4,
    type: 'mur',
    categorie: 'Murs',
    dossier: 'murs',
    retrait: 6,
    raccord: 'long',
    cases: [
      { id: 'pierre-joints-mousse', nom: 'Pierre aux joints moussus', tuile: 2.5 },
      { id: 'colombage', nom: 'Colombage et plâtre', tuile: 2.5 },
      { id: 'calcaire', nom: 'Calcaire', tuile: 2.5 },
      null
    ]
  },
  {
    fichier: 'planches/murs 5.png',
    fond: 'magenta',
    isoler: 'case',
    cols: 1,
    rows: 4,
    type: 'mur',
    categorie: 'Murs',
    dossier: 'murs',
    retrait: 6,
    raccord: 'long',
    cases: [
      { id: 'pierre-seche', nom: 'Pierre sèche', tuile: 2.5 },
      { id: 'ruines', nom: 'Ruines', tuile: 2.5 },
      { id: 'haie', nom: 'Haie', tuile: 2.5 },
      { id: 'roche', nom: 'Roche de caverne', tuile: 2.5 }
    ]
  },
  {
    fichier: 'planches/murs 6.png',
    fond: 'magenta',
    isoler: 'case',
    cols: 1,
    rows: 4,
    type: 'mur',
    categorie: 'Murs',
    dossier: 'murs',
    retrait: 6,
    raccord: 'long',
    cases: [
      { id: 'beton', nom: 'Béton', tuile: 2.5 },
      { id: 'platre-blanc', nom: 'Plâtre blanc', tuile: 2.5 },
      { id: 'cachot', nom: 'Pierre de cachot', tuile: 2.5 },
      { id: 'briques-suie', nom: 'Briques noircies', tuile: 2.5 }
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
    centrerMontants: true,
    isoler: 'case',
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
    fichier: 'planches/ouvertures 2.png',
    fond: 'magenta',
    cols: 2,
    rows: 3,
    type: 'porte',
    categorie: 'Portes et fenêtres',
    dossier: 'ouvertures',
    centrerMontants: true,
    isoler: 'case',
    cases: [
      { id: 'porte-service', nom: 'Porte de service' },
      { id: 'porte-entree', nom: 'Porte d’entrée' },
      { id: 'porte-acajou', nom: 'Porte en acajou' },
      { id: 'porte-brisee', nom: 'Porte brisée' },
      { id: 'porte-chapelle', nom: 'Porte de chapelle' },
      { id: 'porte-grange', nom: 'Porte de grange' }
    ]
  },
  {
    fichier: 'planches/ouvertures 3.png',
    fond: 'magenta',
    cols: 2,
    rows: 3,
    type: 'porte',
    categorie: 'Portes et fenêtres',
    dossier: 'ouvertures',
    centrerMontants: true,
    isoler: 'case',
    cases: [
      { id: 'porte-coffre', nom: 'Porte de coffre-fort' },
      { id: 'porte-cellule', nom: 'Porte de cellule' },
      { id: 'porte-secrete', nom: 'Porte secrète' },
      { id: 'porte-fenetre', nom: 'Porte-fenêtre' },
      { id: 'rideau-velours', nom: 'Rideau de velours' },
      { id: 'herse', nom: 'Herse en bois' }
    ]
  },
  {
    fichier: 'planches/ouvertures 4.png',
    fond: 'magenta',
    cols: 2,
    rows: 3,
    type: 'porte',
    categorie: 'Portes et fenêtres',
    dossier: 'ouvertures',
    centrerMontants: true,
    isoler: 'case',
    cases: [
      { id: 'porte-blanche', nom: 'Porte blanche' },
      { id: 'porte-coupe-feu', nom: 'Porte coupe-feu' },
      { id: 'porte-bureau', nom: 'Porte de bureau' },
      { id: 'porte-verre-depoli', nom: 'Porte en verre dépoli' },
      { id: 'porte-automatique', nom: 'Porte automatique' },
      { id: 'porte-blindee', nom: 'Porte blindée' }
    ]
  },
  {
    /* Les portes du sous-sol du Jardin de Jade ; la porte murée percée est en deux morceaux. */
    fichier: 'planches/ouvertures 5.png',
    fond: 'magenta',
    cols: 2,
    rows: 3,
    type: 'porte',
    categorie: 'Portes et fenêtres',
    dossier: 'ouvertures',
    centrerMontants: true,
    isoler: 'case',
    cases: [
      { id: 'porte-muree', nom: 'Porte murée' },
      { id: 'porte-muree-percee', nom: 'Porte murée, percée', zone: [795, 118, 718, 162] },
      { id: 'porte-speakeasy', nom: 'Porte de speakeasy' },
      { id: 'porte-capitonnee', nom: 'Porte capitonnée' },
      { id: 'porte-cave-pourrie', nom: 'Porte de cave pourrie' },
      { id: 'porte-art-deco', nom: 'Porte double Art déco' }
    ]
  },
  {
    fichier: 'planches/fenetres 1.png',
    fond: 'magenta',
    cols: 2,
    rows: 3,
    /* Condamnée ou volet baissé : on ne voit pas au travers — une porte, qu'on « ouvre ». */
    type: (c) => (c.id === 'fenetre-condamnee' || c.id === 'volet-roulant' ? 'porte' : 'vitre'),
    categorie: 'Portes et fenêtres',
    dossier: 'ouvertures',
    centrerMontants: true,
    isoler: 'case',
    cases: [
      { id: 'fenetre-guillotine', nom: 'Fenêtre à guillotine' },
      { id: 'fenetre-double', nom: 'Fenêtre double' },
      { id: 'fenetre-brisee', nom: 'Fenêtre brisée' },
      { id: 'fenetre-condamnee', nom: 'Fenêtre condamnée' },
      { id: 'fenetre-vitrail', nom: 'Vitrail' },
      { id: 'fenetre-barreaux', nom: 'Fenêtre à barreaux' }
    ]
  },
  {
    fichier: 'planches/fenetres 2.png',
    fond: 'magenta',
    cols: 2,
    rows: 3,
    /* Condamnée ou volet baissé : on ne voit pas au travers — une porte, qu'on « ouvre ». */
    type: (c) => (c.id === 'fenetre-condamnee' || c.id === 'volet-roulant' ? 'porte' : 'vitre'),
    categorie: 'Portes et fenêtres',
    dossier: 'ouvertures',
    centrerMontants: true,
    isoler: 'case',
    cases: [
      { id: 'fenetre-pvc', nom: 'Fenêtre PVC' },
      { id: 'fenetre-alu', nom: 'Baie aluminium' },
      { id: 'volet-roulant', nom: 'Volet roulant' },
      { id: 'fenetre-coulissante', nom: 'Fenêtre coulissante' },
      { id: 'fenetre-depolie', nom: 'Fenêtre dépolie' },
      { id: 'vitrine', nom: 'Vitrine' }
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
  },
  /* Les pictogrammes blancs du rangement par familles et rayons (22/11/2026) :
     ils remplacent les icônes illustrées ci-dessus, même nom de fichier quand
     le rayon est le même. Voir docs/atelier/prompts-icones-catalogue.md. */
  {
    fichier: 'planches/icones 3.png',
    fond: 'magenta',
    icones: true,
    cols: 5,
    rows: 4,
    type: 'objet',
    categorie: '',
    dossier: 'icones',
    cases: [
      { id: 'mobilier', nom: 'Mobilier' },
      { id: 'cuisine-et-bain', nom: 'Cuisine et bain' },
      { id: 'lumiere', nom: 'Lumière' },
      { id: 'deco-et-objets', nom: 'Déco et objets' },
      { id: 'nature', nom: 'Nature' },
      { id: 'architecture', nom: 'Architecture' },
      { id: 'exterieur', nom: 'Extérieur' },
      { id: 'personnages', nom: 'Personnages' },
      { id: 'mes-objets', nom: 'Mes objets' },
      { id: 'assises', nom: 'Assises' },
      { id: 'tables', nom: 'Tables' },
      { id: 'lits', nom: 'Lits' },
      { id: 'rangements', nom: 'Rangements' },
      { id: 'bureau', nom: 'Bureau' },
      { id: 'cheminees', nom: 'Cheminées' },
      { id: 'tapis', nom: 'Tapis' },
      { id: 'paravents', nom: 'Paravents' },
      { id: 'cuisine', nom: 'Cuisine' },
      { id: 'electromenager', nom: 'Électroménager' },
      { id: 'bain', nom: 'Bain' }
    ]
  },
  {
    fichier: 'planches/icones 4.png',
    fond: 'magenta',
    icones: true,
    cols: 5,
    rows: 4,
    type: 'objet',
    categorie: '',
    dossier: 'icones',
    cases: [
      { id: 'bar', nom: 'Bar' },
      { id: 'buffet', nom: 'Buffet' },
      { id: 'lampes', nom: 'Lampes' },
      { id: 'lampadaires', nom: 'Lampadaires' },
      { id: 'plafonniers', nom: 'Plafonniers' },
      { id: 'appliques', nom: 'Appliques' },
      { id: 'bougies', nom: 'Bougies' },
      { id: 'projecteurs', nom: 'Projecteurs' },
      { id: 'decoration', nom: 'Décoration' },
      { id: 'livres-et-papiers', nom: 'Livres et papiers' },
      { id: 'vaisselle', nom: 'Vaisselle' },
      { id: 'nourriture', nom: 'Nourriture' },
      { id: 'instruments', nom: 'Instruments' },
      { id: 'sonorisation', nom: 'Sonorisation' },
      { id: 'indices', nom: 'Indices' },
      { id: 'armes', nom: 'Armes' },
      { id: 'arbres', nom: 'Arbres' },
      { id: 'vegetation', nom: 'Végétation' },
      { id: 'rochers', nom: 'Rochers' },
      { id: 'bois-mort', nom: 'Bois mort' }
    ]
  },
  {
    fichier: 'planches/icones 5.png',
    fond: 'magenta',
    icones: true,
    cols: 5,
    rows: 3,
    type: 'objet',
    categorie: '',
    dossier: 'icones',
    cases: [
      { id: 'toiles-d-araignees', nom: 'Toiles d’araignées' },
      { id: 'escaliers', nom: 'Escaliers' },
      { id: 'scene', nom: 'Scène' },
      { id: 'colonnes', nom: 'Colonnes' },
      { id: 'cloisons', nom: 'Cloisons' },
      { id: 'voirie', nom: 'Voirie' },
      { id: 'marquages', nom: 'Marquages' },
      { id: 'vehicules', nom: 'Véhicules' },
      { id: 'mobilier-urbain', nom: 'Mobilier urbain' },
      { id: 'ruelle', nom: 'Ruelle' },
      { id: 'personnel', nom: 'Personnel' },
      { id: 'invites', nom: 'Invités' },
      { id: 'public', nom: 'Public' },
      { id: 'corps', nom: 'Corps' },
      { id: 'ossements', nom: 'Ossements' }
    ]
  }
]

function rogner(src: PNG, x: number, y: number, w: number, h: number): PNG {
  const out = new PNG({ width: w, height: h })
  PNG.bitblt(src, out, x, y, w, h, 0, 0)
  return out
}

/** Le milieu vertical des montants : les colonnes opaques du bord gauche de la boîte. */
function milieuDesMontants(src: PNG, b: { x: number; y: number; w: number; h: number }): number {
  let haut = Infinity
  let bas = -Infinity
  const bord = Math.max(2, Math.round(b.w * 0.03))
  for (let y = b.y; y < b.y + b.h; y++)
    for (let x = b.x; x < b.x + bord; x++)
      if (src.data[(y * src.width + x) * 4 + 3] > 128) {
        haut = Math.min(haut, y)
        bas = Math.max(bas, y)
      }
  return haut <= bas ? (haut + bas + 1) / 2 : b.y + b.h / 2
}

/** Recadre en étendant la boîte de vide, symétriquement autour de `milieu`. */
function rognerCentre(src: PNG, b: { x: number; y: number; w: number; h: number }, milieu: number): PNG {
  const demi = Math.ceil(Math.max(milieu - b.y, b.y + b.h - milieu))
  const out = new PNG({ width: b.w, height: 2 * demi })
  out.data.fill(0)
  PNG.bitblt(src, out, b.x, b.y, b.w, b.h, 0, Math.round(demi - (milieu - b.y)))
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
    let cellule = c.zone
      ? rogner(img, ...c.zone)
      : rogner(img, cx, cy, Math.round(cwi), Math.round(ch))
    if (c.zone) {
      /* Une zone qui coupe un élément : son bord n'est pas vide. */
      const [zw, zh] = [c.zone[2], c.zone[3]]
      let coupe = 0
      for (let y = 0; y < zh; y++)
        for (let x = 0; x < zw; x++)
          if ((x === 0 || y === 0 || x === zw - 1 || y === zh - 1) && cellule.data[(y * zw + x) * 4 + 3] > 64) coupe++
      if (coupe) console.warn(`! ${pl.fichier} case ${i + 1} : la zone coupe un élément (${coupe} px au bord)`)
    } else if (el) {
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
    if (pl.isoler === 'case' && !c.zone) {
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
    let piece = pl.centrerMontants
      ? rognerCentre(cellule, b, milieuDesMontants(cellule, b))
      : rogner(cellule, b.x + r, b.y + r, b.w - 2 * r, b.h - 2 * r)
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
    const [categorie, sousCategorie] = RANGEMENT[c.id] ?? [pl.categorie, pl.sousCategorie]
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

/* Le mur blanc : un enduit à peine grainé, fabriqué ici. Uni, il prend
   exactement la couleur qu'on lui donne dans l'atelier. */
{
  const W = 1024
  const H = 160
  const blanc = new PNG({ width: W, height: H })
  let g = 12345
  const hasard = (): number => ((g = (g * 1664525 + 1013904223) >>> 0) / 2 ** 32)
  /* Un grain doux qui se raccorde en longueur : du bruit lissé, bouclé sur la largeur. */
  const bruit = Array.from({ length: W / 8 }, hasard)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const k = x / 8
      const i0 = Math.floor(k) % bruit.length
      const t = k - Math.floor(k)
      const doux = bruit[i0] * (1 - t) + bruit[(i0 + 1) % bruit.length] * t
      const v = Math.round(236 + doux * 10 + (hasard() - 0.5) * 8)
      const i = (y * W + x) * 4
      blanc.data[i] = v
      blanc.data[i + 1] = v
      blanc.data[i + 2] = Math.max(0, v - 3)
      blanc.data[i + 3] = 255
    }
  writeFileSync(join(PACK, 'murs/uni-blanc.png'), PNG.sync.write(blanc))
  catalogue.push({ id: 'murs/uni-blanc', type: 'mur', nom: 'Mur uni (à colorer)', categorie: 'Plâtre et béton', fichier: 'murs/uni-blanc.png', tuile: 2.5 })
}

/* Les assets du catalogue qui ne sortent d'aucune planche d'ici (ajoutés
   autrement, comme le pack concert et enquête) : gardés tels quels, sans quoi
   une relance les effacerait. */
{
  const ancien = join(PACK, 'catalogue.json')
  if (existsSync(ancien)) {
    const produits = new Set(catalogue.map((e) => e.id))
    const garde = (JSON.parse(readFileSync(ancien, 'utf8')).assets as Record<string, unknown>[]).filter(
      (e) => !produits.has(e.id)
    )
    catalogue.push(...garde)
    if (garde.length) console.log(`${garde.length} assets hors planches, gardés`)
  }
}

/* L'ordre de la palette : les sols, murs et ouvertures d'abord, puis les objets
   par catégorie et sous-catégorie, dans un ordre qui se lit. */
const ORDRE_CATEGORIES = ['Mobilier', 'Lumière', 'Objets', 'Architecture', 'Nature', 'Macabre', 'Moderne', 'Ville', 'Restaurant']
const ORDRE_SOUS = [
  'Lits', 'Assises', 'Tables', 'Rangements', 'Cuisine', 'Bain', 'Cheminées', 'Tapis', 'Paravents', 'Musique',
  'Lampes', 'Lampadaires', 'Plafonniers', 'Appliques', 'Bougies',
  'Livres et papiers', 'Nourriture', 'Vaisselle', 'Décoration', 'Électroménager',
  'Arbres', 'Végétation', 'Rochers', 'Bois mort', 'Toiles d’araignées',
  'Voirie', 'Marquages', 'Véhicules', 'Mobilier urbain', 'Ruelle',
  'Salle', 'Buffet', 'Cuisine', 'Plats', 'Décor chinois'
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
