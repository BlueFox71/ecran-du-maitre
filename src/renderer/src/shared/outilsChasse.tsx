/**
 * Les appareils de chasse tels qu'on les dessine hors de la page du MJ : le
 * visuel d'un outil (`imageOutil`) et l'appareil « posé » sur un plan
 * (`AppareilPose`), avec la lueur de son état. Sans store : utilisable sur le
 * portable et la fenêtre de la table.
 */
import type { CSSProperties } from 'react'
import type { OutilChasse } from '@shared/chasse'
import imageEmf from '../assets/chasse/emf-eteint.png'
import imageThermometre from '../assets/chasse/thermometre.png'
import { LEDS_EMF, ledsAllumees } from '../mj/chasse/emf'
import { froid } from '../mj/chasse/temperature'

/** L'URL de la photo d'un outil. */
export function imageOutil(o: OutilChasse): string {
  return o === 'emf' ? imageEmf : imageThermometre
}

/** Le rapport hauteur / largeur des photos (EMF 348 × 908, thermomètre 499 × 1520). */
const RAPPORT: Record<OutilChasse, number> = { emf: 908 / 348, thermometre: 1520 / 499 }

/** La lueur d'un appareil : sa couleur et son rayon (en fraction de la taille), ou rien. */
function lueur(outil: OutilChasse, valeur: number, allume: boolean): { couleur: string; rayon: number } | null {
  if (!allume) return null
  if (outil === 'emf') {
    const n = ledsAllumees(valeur)
    if (n === 0) return null
    /* Le rayon croît avec le niveau. */
    return { couleur: LEDS_EMF[n - 1].couleur, rayon: 0.5 + 0.2 * n }
  }
  if (valeur < 10) return { couleur: `rgba(120, 190, 255, ${0.5 + 0.5 * froid(valeur)})`, rayon: 0.9 }
  if (valeur > 25) return { couleur: 'rgba(255, 150, 60, 0.7)', rayon: 0.9 }
  return { couleur: 'rgba(230, 230, 230, 0.35)', rayon: 0.7 }
}

/**
 * Un appareil vu « posé à plat » : la photo réduite et une lueur radiale.
 * `taille` est la hauteur de la photo, en pixels. Le composant est un bloc
 * `position: relative` ; pour le centrer sur un point (x, y) d'un calque,
 * l'envelopper dans un élément `position: absolute` en
 * `left: x; top: y; transform: translate(-50%, -50%)`. La lueur déborde
 * (l'enveloppe ne doit pas rogner) et ne capte pas les clics.
 * `valeur` : le niveau 0 à 5 (EMF) ou la température en °C (thermomètre).
 */
export function AppareilPose({
  outil,
  valeur,
  allume,
  taille
}: {
  outil: OutilChasse
  valeur: number
  allume: boolean
  taille: number
}): JSX.Element {
  const l = lueur(outil, valeur, allume)
  const boite: CSSProperties = { position: 'relative', width: taille / RAPPORT[outil], height: taille, flex: 'none' }
  return (
    <div style={boite}>
      {l ? (
        <i
          aria-hidden
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: taille * l.rayon * 2,
            height: taille * l.rayon * 2,
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${l.couleur} 0%, transparent 65%)`,
            pointerEvents: 'none'
          }}
        />
      ) : null}
      <img
        src={imageOutil(outil)}
        alt=""
        draggable={false}
        style={{ position: 'relative', width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  )
}
