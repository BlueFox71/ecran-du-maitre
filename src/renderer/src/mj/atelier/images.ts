/**
 * Les images des assets, chargées une fois pour toutes.
 *
 * `crossOrigin` : le plan enregistré sort d'un canvas, et un canvas qui a
 * dessiné une image d'une autre origine refuse de se laisser lire. Le
 * protocole `jdr://` répond avec l'en-tête qu'il faut.
 */
import type { AssetAtelier } from '@shared/atelierAssets'

/** `'absent'` : l'image n'a pas pu se charger (fichier supprimé, illisible). */
export type ImagesAtelier = Map<string, HTMLImageElement | 'absent'>

export const urlAsset = (a: AssetAtelier): string =>
  `jdr://atelier/${a.source}/${a.fichier.split('/').map(encodeURIComponent).join('/')}`

const enCours = new Map<string, Promise<void>>()

/** Charge ce qui manque ; rend quand toutes les images demandées sont prêtes ou absentes. */
export function chargerImages(assets: AssetAtelier[], images: ImagesAtelier): Promise<void> {
  return Promise.all(
    assets.map((a) => {
      if (images.has(a.id)) return Promise.resolve()
      let p = enCours.get(a.id)
      if (!p) {
        p = new Promise<void>((fin) => {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => {
            images.set(a.id, img)
            fin()
          }
          img.onerror = () => {
            images.set(a.id, 'absent')
            fin()
          }
          img.src = urlAsset(a)
        }).finally(() => enCours.delete(a.id))
        enCours.set(a.id, p)
      }
      return p
    })
  ).then(() => undefined)
}
