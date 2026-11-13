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
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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
  cases: (Case | null)[]
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
  }
]

function rogner(src: PNG, x: number, y: number, w: number, h: number): PNG {
  const out = new PNG({ width: w, height: h })
  PNG.bitblt(src, out, x, y, w, h, 0, 0)
  return out
}

const catalogue: Record<string, unknown>[] = []

for (const pl of PLANCHES) {
  const img = PNG.sync.read(readFileSync(join(SOURCES, pl.fichier)))
  const px = new Uint8ClampedArray(img.data.buffer, img.data.byteOffset, img.data.length)
  const net =
    pl.fond === 'magenta' ? detourerMagenta(px) : pl.fond === 'noir' ? lumiereEnAlpha(px) : px
  img.data = Buffer.from(net.buffer, net.byteOffset, net.length)

  const cw = img.width / pl.cols
  const ch = img.height / pl.rows
  pl.cases.forEach((c, i) => {
    if (!c) return
    const cx = Math.round((i % pl.cols) * cw)
    const cy = Math.round(Math.floor(i / pl.cols) * ch)
    const cellule = rogner(img, cx, cy, Math.round(cw), Math.round(ch))
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
    const type = typeof pl.type === 'function' ? pl.type(c) : pl.type
    const fichier = `${pl.dossier}/${c.id}.png`
    mkdirSync(dirname(join(PACK, fichier)), { recursive: true })
    writeFileSync(join(PACK, fichier), PNG.sync.write(piece))
    const entree: Record<string, unknown> = { id: `${pl.dossier}/${c.id}`, type, nom: c.nom, categorie: pl.categorie, fichier }
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

writeFileSync(join(PACK, 'catalogue.json'), JSON.stringify({ v: 1, assets: catalogue }, null, 2) + '\n')
console.log(`${catalogue.length} assets → resources/atelier/catalogue.json`)
