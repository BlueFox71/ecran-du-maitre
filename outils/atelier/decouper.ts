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
  souche: ['Nature', 'Bois mort']
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
  isoler?: boolean
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
  const el = pl.isoler ? elements(img) : null
  pl.cases.forEach((c, i) => {
    if (!c) return
    const cx = Math.round((i % pl.cols) * cw)
    const cy = Math.round(Math.floor(i / pl.cols) * ch)
    let cellule = rogner(img, cx, cy, Math.round(cw), Math.round(ch))
    if (el) {
      /* L'élément le plus lourd dont le centre tombe dans cette case. */
      let meilleur = 0
      el.infos.forEach((f, e) => {
        if (!e) return
        const mx = (f.sx / f.n + 0.5) * BLOC
        const my = (f.sy / f.n + 0.5) * BLOC
        if (mx >= cx && mx < cx + cw && my >= cy && my < cy + ch && f.n > (el.infos[meilleur]?.n ?? 0)) meilleur = e
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
const ORDRE_CATEGORIES = ['Mobilier', 'Lumière', 'Objets', 'Architecture', 'Nature', 'Macabre']
const ORDRE_SOUS = ['Arbres', 'Végétation', 'Rochers', 'Bois mort', 'Toiles d’araignées']
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
