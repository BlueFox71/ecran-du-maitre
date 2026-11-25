/**
 * La photo de l'EMF, avec ses LED : partagée par la page de simulation du MJ,
 * l'appareil posé sur les plans et les portables. Aucune dépendance au store.
 *
 * Deux photos du même appareil, au pixel près : `emf-eteint.png`, les cinq LED
 * éteintes (retouchées), et `emf.png`, toutes allumées. On pose la première, et
 * pour chaque LED allumée on découvre la seconde dans un petit cercle autour
 * d'elle : rien à caler, c'est la même image.
 */
import photoAllumee from '../../assets/chasse/emf.png'
import photoEteinte from '../../assets/chasse/emf-eteint.png'
import { LEDS_EMF, ledsVisibles } from './emf'

/** La taille des photos, en pixels. */
export const PHOTO_L = 348
export const PHOTO_H = 908

/** Les LED sur la photo : centre et rayon du verre, en pixels (mesurés sur l'image). */
const LEDS_PHOTO: { x: number; y: number; r: number }[] = [
  { x: 68.8, y: 58.5, r: 19.0 },
  { x: 121.9, y: 53.0, r: 19.4 },
  { x: 173.3, y: 46.4, r: 21.0 },
  { x: 226.6, y: 50.7, r: 20.4 },
  { x: 279.6, y: 55.0, r: 19.8 }
]
/** De combien le cercle découvert dépasse le verre : assez pour emporter son liseré lumineux. */
const MARGE_DECOUVERTE = 8

/**
 * L'appareil : la photo éteinte, et pour chaque LED allumée, la photo allumée
 * découverte dans un cercle autour d'elle, plus un halo qui déborde.
 * `n` est le niveau (0 à 5, fractionnaire accepté) ; `eteint` : aucune LED.
 * Allumé au niveau 0, la première LED verte brille seule.
 */
export function PhotoEmf({ n, eteint = false }: { n: number; eteint?: boolean }): JSX.Element {
  const visibles = ledsVisibles(n, !eteint)
  return (
    <div className="emf-photo">
      <img src={photoEteinte} alt="Détecteur EMF" draggable={false} />
      {LEDS_PHOTO.map((p, i) => {
        if (i >= visibles) return null
        const x = (p.x / PHOTO_L) * 100
        const y = (p.y / PHOTO_H) * 100
        const rx = ((p.r + MARGE_DECOUVERTE) / PHOTO_L) * 100
        const ry = ((p.r + MARGE_DECOUVERTE) / PHOTO_H) * 100
        return (
          <span key={i}>
            <img
              src={photoAllumee}
              alt=""
              aria-hidden
              draggable={false}
              className="emf-allumee"
              style={{ clipPath: `ellipse(${rx}% ${ry}% at ${x}% ${y}%)` }}
            />
            <i
              className="emf-halo"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                width: `${((p.r * 5) / PHOTO_L) * 100}%`,
                ['--led' as string]: LEDS_EMF[i].couleur
              }}
            />
          </span>
        )
      })}
    </div>
  )
}
