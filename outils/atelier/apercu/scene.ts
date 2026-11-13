/* Une maison de test pour le banc d'essai du rendu (outils/atelier/apercu). */
import { dessinerConstruction } from '../../../src/renderer/src/mj/atelier/rendu'
import { lireCatalogue, type AssetAtelier } from '../../../src/shared/atelierAssets'
import type { Construction } from '../../../src/shared/atelier'
import type { ImagesAtelier } from '../../../src/renderer/src/mj/atelier/images'

declare const CATALOGUE: unknown
declare const PACK: string

const assets = new Map<string, AssetAtelier>(lireCatalogue(CATALOGUE, 'pack').map((a) => [a.id, a]))
const A = (id: string): string => 'pack:' + id
const obj = (id: string, x: number, y: number, angle = 0, e = 1) => {
  const a = assets.get(A('objets/' + id))!
  return { id: id + x, assetId: a.id, x, y, l: a.l! * e, h: a.h! * e, angle, bloquePas: false, bloqueVue: false }
}
const c: Construction = {
  v: 1, largeur: 16, hauteur: 10, metresParCase: 1.5,
  sols: [
    { id: 's0', assetId: A('sols/terre-herbe'), pts: [[0, 0], [16, 0], [16, 10], [0, 10]] },
    { id: 's1', assetId: A('sols/parquet-sombre'), pts: [[1, 1], [9, 1], [9, 9], [1, 9]] },
    { id: 's2', assetId: A('sols/damier-use'), pts: [[9, 1], [14, 1], [14, 5], [9, 5]] },
    { id: 's3', assetId: A('sols/parquet-vert'), pts: [[9, 5], [14, 5], [14, 9], [9, 9]] }
  ],
  murs: [
    { id: 'ext', assetId: A('murs/pierre-sombre'), pts: [[1, 1], [14, 1], [14, 9], [1, 9], [1, 1]], epaisseur: 0.45 },
    { id: 'm1', assetId: A('murs/platre-boiserie'), pts: [[9, 1], [9, 9]], epaisseur: 0.3 },
    { id: 'm2', assetId: A('murs/briques'), pts: [[9, 5], [14, 5]], epaisseur: 0.3 }
  ],
  ouvertures: [
    { id: 'o1', murId: 'm1', nature: 'porte', assetId: A('ouvertures/porte-bois'), d: 0.3, largeur: 0.9 },
    { id: 'o2', murId: 'm2', nature: 'porte', assetId: A('ouvertures/porte-double'), d: 0.5, largeur: 1.4 },
    { id: 'o3', murId: 'ext', nature: 'vitre', assetId: A('ouvertures/fenetre'), d: 0.12, largeur: 1.6 },
    { id: 'o4', murId: 'ext', nature: 'porte', assetId: A('ouvertures/porte-cave'), d: 0.7, largeur: 1 }
  ],
  objets: [
    obj('lit-double', 2.5, 2.6), obj('table-de-nuit', 3.6, 1.6), 
    obj('commode', 6, 1.5), obj('bougeoir', 5.8, 1.5), obj('table-ronde', 5, 6), obj('napperon', 5, 6),
    obj('chandelier', 5, 6), obj('fauteuil', 3.6, 6.8, -30), obj('bibliotheque', 8.5, 4, 90),
    obj('toile-coin', 1.8, 8.2, -90), obj('baignoire', 11.5, 2.2), obj('canape-chesterfield', 11.5, 8.3, 180),
    obj('escalier-droit', 13.3, 6.6), obj('cheminee', 11.5, 5.6), obj('toile-dense', 12.5, 7.2)
  ].filter((o) => o.assetId)
}
c.objets.push({ id: 'manque', assetId: 'pack:objets/introuvable', x: 7, y: 8, l: 1, h: 0.6, angle: 15, bloquePas: false, bloqueVue: false })

const images: ImagesAtelier = new Map()
await Promise.all([...assets.values()].map((a) => new Promise<void>((ok) => {
  const img = new Image()
  img.onload = () => { images.set(a.id, img); ok() }
  img.onerror = () => { images.set(a.id, 'absent'); ok() }
  img.src = PACK + '/' + a.fichier
})))
const px = 80
const cv = document.createElement('canvas')
cv.width = c.largeur * px; cv.height = c.hauteur * px
document.body.appendChild(cv)
dessinerConstruction(cv.getContext('2d')!, c, assets, images, px)
;(window as any).fini = cv.toDataURL('image/png')
