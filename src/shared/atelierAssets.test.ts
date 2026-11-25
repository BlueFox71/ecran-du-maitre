import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  appliquerRangement,
  assetsManquants,
  boiteOpaque,
  colonnesDuCatalogue,
  detourerMagenta,
  FAMILLES,
  filtrerAssets,
  filtrerObjets,
  lireCatalogue,
  lumiereEnAlpha,
  raccorder,
  rangement,
  THEMES,
  type AssetAtelier
} from './atelierAssets'

/** Une image w × h remplie d'une couleur. */
function image(w: number, h: number, rgba: [number, number, number, number]): Uint8ClampedArray {
  const px = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i++) px.set(rgba, i * 4)
  return px
}
const pixel = (px: Uint8ClampedArray, w: number, x: number, y: number): number[] =>
  Array.from(px.slice((y * w + x) * 4, (y * w + x) * 4 + 4))

describe('boiteOpaque', () => {
  it('trouve le seul pixel opaque', () => {
    const px = image(4, 4, [0, 0, 0, 0])
    px[(1 * 4 + 2) * 4 + 3] = 255
    expect(boiteOpaque(px, 4, 4)).toEqual({ x: 2, y: 1, w: 1, h: 1 })
  })
  it('une image vide n’a pas de boîte', () => {
    expect(boiteOpaque(image(4, 4, [0, 0, 0, 0]), 4, 4)).toBeNull()
  })
  it('ignore une poussière presque transparente', () => {
    const px = image(4, 4, [0, 0, 0, 0])
    px[3] = 5
    expect(boiteOpaque(px, 4, 4)).toBeNull()
  })
})

describe('raccorder', () => {
  it('rapproche les deux bords d’une texture qui ne se raccorde pas', () => {
    const w = 64
    const h = 8
    const px = new Uint8ClampedArray(w * h * 4)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const v = Math.round((x / (w - 1)) * 255)
        px.set([v, v, v, 255], (y * w + x) * 4)
      }
    const avant = Math.abs(pixel(px, w, 0, 0)[0] - pixel(px, w, w - 1, 0)[0])
    const out = raccorder(px, w, h, true)
    const apres = Math.abs(pixel(out, w, 0, 0)[0] - pixel(out, w, w - 1, 0)[0])
    expect(apres).toBeLessThan(avant * 0.2)
  })
  it('laisse intacte une texture uniforme', () => {
    const px = image(16, 16, [90, 60, 30, 255])
    expect(Array.from(raccorder(px, 16, 16, false))).toEqual(Array.from(px))
  })
})

describe('detourerMagenta', () => {
  it('rend transparent le magenta pur et garde le reste', () => {
    const px = new Uint8ClampedArray([255, 0, 255, 255, 120, 80, 40, 255])
    const out = detourerMagenta(px)
    expect(out[3]).toBe(0)
    expect(Array.from(out.slice(4))).toEqual([120, 80, 40, 255])
  })
  it('un magenta un peu sali par la compression part aussi', () => {
    const out = detourerMagenta(new Uint8ClampedArray([238, 20, 241, 255]))
    expect(out[3]).toBe(0)
  })
  it('une dentelle teintée de magenta redevient neutre, un bois brun ne bouge pas', () => {
    const out = detourerMagenta(new Uint8ClampedArray([230, 180, 220, 255, 120, 80, 40, 255]))
    expect(out[3]).toBe(255)
    expect(out[0] - out[1]).toBeLessThan(20)
    expect(out[2] - out[1]).toBeLessThan(20)
    expect(Array.from(out.slice(4))).toEqual([120, 80, 40, 255])
  })
  it('un bord rosé perd son reflet magenta', () => {
    /* Moitié bois, moitié magenta : on garde le bois, à demi transparent. */
    const out = detourerMagenta(new Uint8ClampedArray([188, 40, 148, 255]))
    expect(out[3]).toBeGreaterThan(0)
    expect(out[3]).toBeLessThan(255)
    expect(out[0] - out[2]).toBeGreaterThan(0)
    expect(out[2]).toBeLessThan(148)
  })
})

describe('lumiereEnAlpha', () => {
  it('le noir devient transparent, le blanc opaque', () => {
    const out = lumiereEnAlpha(new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]))
    expect(out[3]).toBe(0)
    expect(out[7]).toBe(255)
  })
  it('un gris moyen devient un fil à demi transparent', () => {
    const out = lumiereEnAlpha(new Uint8ClampedArray([128, 128, 128, 255]))
    expect(out[3]).toBeGreaterThan(100)
    expect(out[3]).toBeLessThan(160)
  })
})

describe('lireCatalogue', () => {
  it('garde les entrées valables et les préfixe de leur source', () => {
    const a = lireCatalogue(
      {
        v: 1,
        assets: [
          { id: 'sols/parquet', type: 'sol', nom: 'Parquet', categorie: 'Sols', fichier: 'sols/parquet.png', tuile: 2 },
          { id: 'x', nom: 'Sans type', categorie: 'Sols', fichier: 'x.png' },
          { id: 'objets/lit', type: 'objet', nom: 'Lit', categorie: 'Chambre', fichier: 'objets/lit.png', l: 1.2, h: 1.5, bloquePas: true }
        ]
      },
      'pack'
    )
    expect(a.map((x) => x.id)).toEqual(['pack:sols/parquet', 'pack:objets/lit'])
    expect(a[0].source).toBe('pack')
    expect(a[1].bloqueVue).toBe(false)
  })
  it('un catalogue illisible est vide', () => {
    expect(lireCatalogue('n’importe quoi', 'moi')).toEqual([])
  })
  it('refuse un fichier qui sortirait de son dossier', () => {
    expect(
      lireCatalogue({ v: 1, assets: [{ id: 'a', type: 'sol', nom: 'A', categorie: 'S', fichier: '../../secret.png' }] }, 'moi')
    ).toEqual([])
  })
})

describe('rangement des assets', () => {
  const a = (id: string, categorie: string, sousCategorie?: string, nom = id) =>
    ({ id, source: 'pack', type: 'objet', nom, categorie, sousCategorie, fichier: id + '.png' }) as const
  const liste = [
    a('lampe', 'Lumière', 'Lampes', 'Lampe à huile'),
    a('chene', 'Nature', 'Arbres', 'Chêne'),
    a('bougie', 'Lumière', 'Bougies', 'Bougeoir'),
    a('rocher', 'Nature', 'Rochers', 'Gros rocher'),
    a('sapin', 'Nature', 'Arbres', 'Sapin'),
    a('crane', 'Macabre', undefined, 'Crâne')
  ]
  it('rangement : les catégories et leurs sous-catégories, dans l’ordre où elles apparaissent', () => {
    expect(rangement(liste)).toEqual([
      { categorie: 'Lumière', sous: ['Lampes', 'Bougies'] },
      { categorie: 'Nature', sous: ['Arbres', 'Rochers'] },
      { categorie: 'Macabre', sous: [] }
    ])
  })
  it('filtrer par catégorie, sous-catégorie et nom (sans tenir compte des accents)', () => {
    expect(filtrerAssets(liste, { categorie: 'Nature' }).map((x) => x.id)).toEqual(['chene', 'rocher', 'sapin'])
    expect(filtrerAssets(liste, { categorie: 'Nature', sous: 'Arbres' }).map((x) => x.id)).toEqual(['chene', 'sapin'])
    expect(filtrerAssets(liste, { recherche: 'crane' }).map((x) => x.id)).toEqual(['crane'])
    expect(filtrerAssets(liste, {}).length).toBe(6)
  })
  it('lireCatalogue garde la sous-catégorie', () => {
    const [x] = lireCatalogue({ v: 1, assets: [{ id: 'l', type: 'objet', nom: 'L', categorie: 'Lumière', sousCategorie: 'Lampes', fichier: 'l.png' }] }, 'pack')
    expect(x.sousCategorie).toBe('Lampes')
  })
})

describe('le catalogue des objets : thème, famille, rayon', () => {
  const o = (id: string, categorie: string, sousCategorie?: string, source: 'pack' | 'moi' = 'pack'): AssetAtelier => ({
    id: `${source}:${id}`,
    source,
    type: 'objet',
    nom: id,
    categorie,
    sousCategorie,
    fichier: id + '.png'
  })
  const rangementJson = {
    v: 1,
    objets: {
      'objets/lustre': { theme: 'Classique', famille: 'Lumière', rayon: 'Plafonniers' },
      'objets/lanterne-rouge': { theme: 'Restaurant', famille: 'Lumière', rayon: 'Plafonniers' },
      'objets/box': { theme: 'Restaurant', famille: 'Mobilier', rayon: 'Assises' },
      'objets/chaise': { theme: 'Classique', famille: 'Mobilier', rayon: 'Assises' }
    }
  }
  const brut = [
    o('objets/lustre', 'Lumière', 'Plafonniers'),
    o('objets/lanterne-rouge', 'Restaurant', 'Plafonds'),
    o('objets/box', 'Restaurant', 'Salle'),
    o('objets/chaise', 'Mobilier', 'Assises'),
    o('objets/inconnu', 'Bazar', 'Truc'),
    o('mon-coffre', 'Mobilier', undefined, 'moi'),
    o('ma-chose', 'Divers', undefined, 'moi')
  ]
  const assets = appliquerRangement(brut, JSON.stringify(rangementJson))

  it('pose famille, rayon et thème sur les objets du pack, et sur eux seuls', () => {
    expect(assets[1]).toMatchObject({ categorie: 'Lumière', sousCategorie: 'Plafonniers', theme: 'Restaurant' })
    expect(assets[4]).toEqual(brut[4])
    expect(assets[5]).toEqual(brut[5])
    expect(appliquerRangement(brut, '{abîmé')).toBe(brut)
  })

  it('les colonnes suivent l’ordre prévu, ne gardent que ce qui a des objets, et finissent par Mes objets', () => {
    expect(colonnesDuCatalogue(assets, null)).toEqual([
      { famille: 'Mobilier', rayons: ['Assises'] },
      { famille: 'Lumière', rayons: ['Plafonniers'] },
      { famille: 'Bazar', rayons: ['Truc'] },
      { famille: 'Mes objets', rayons: ['Mobilier'] }
    ])
  })

  it('un décor filtre les colonnes et la grille ; les imports vont avec tous les décors', () => {
    expect(colonnesDuCatalogue(assets, 'Restaurant').map((c) => c.famille)).toEqual([
      'Mobilier',
      'Lumière',
      /* Un objet sans rangement n'a pas de thème : il reste visible partout. */
      'Bazar',
      'Mes objets'
    ])
    expect(filtrerObjets(assets, { theme: 'Restaurant', famille: 'Lumière' }).map((a) => a.id)).toEqual([
      'pack:objets/lanterne-rouge'
    ])
    expect(filtrerObjets(assets, { famille: 'Mes objets' }).map((a) => a.id)).toEqual(['moi:mon-coffre', 'moi:ma-chose'])
    expect(filtrerObjets(assets, { famille: 'Mes objets', rayon: 'Mobilier' }).map((a) => a.id)).toEqual(['moi:mon-coffre'])
    expect(filtrerObjets(assets, { recherche: 'plafon' }).length).toBe(2)
  })

  it('le pack livré : chaque objet a sa place, dans une famille, un rayon et un thème connus', () => {
    const racine = join(__dirname, '../../resources/atelier')
    const pack = lireCatalogue(readFileSync(join(racine, 'catalogue.json'), 'utf8'), 'pack').filter(
      (a) => a.type === 'objet'
    )
    const r = JSON.parse(readFileSync(join(racine, 'rangement.json'), 'utf8'))
    const sansPlace = pack.filter((a) => !r.objets[a.id.replace(/^pack:/, '')]).map((a) => a.id)
    expect(sansPlace).toEqual([])
    const horsCadre = Object.entries(r.objets as Record<string, { theme: string; famille: string; rayon: string }>)
      .filter(
        ([, v]) =>
          !THEMES.includes(v.theme) || !FAMILLES.find((f) => f.famille === v.famille)?.rayons.includes(v.rayon)
      )
      .map(([k]) => k)
    expect(horsCadre).toEqual([])
  })
})

describe('les assets manquants', () => {
  it('les assets d’une construction qui manquent au catalogue', () => {
    const c = {
      base: 'pack:sols/herbe',
      sols: [{ assetId: '', gomme: true }, { assetId: 'pack:sols/dalles' }],
      murs: [{ assetId: 'pack:murs/pierre', cote2: { assetId: 'pack:murs/laque' } }],
      ouvertures: [],
      objets: [{ assetId: 'pack:objets/dragon' }, { assetId: 'pack:objets/dragon' }]
    }
    const connus = new Set(['pack:sols/herbe', 'pack:sols/dalles', 'pack:murs/pierre'])
    expect(assetsManquants(c, connus)).toEqual(['pack:murs/laque', 'pack:objets/dragon'])
  })
})
