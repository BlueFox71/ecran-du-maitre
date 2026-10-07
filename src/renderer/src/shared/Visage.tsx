import type { CSSProperties } from 'react'
import type { CadreCarre } from '@shared/types'

/*
 * Un portrait dans son carré — pion, face de l'encart, téléphone, fiche.
 *
 * Sans carré, c'est l'image telle qu'on la montrait déjà : la règle CSS du
 * parent la recadre au centre (`object-fit: cover`). Avec un carré, l'image
 * est agrandie et décalée pour que le carré choisi remplisse le cadre — tout
 * en styles posés sur l'élément, parce que ce composant sert aussi au
 * téléphone, qui ne charge pas les feuilles de l'application.
 *
 * Le parent doit être positionné : le calque se pose sur lui, bord à bord, et
 * prend son arrondi.
 */

const CALQUE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  overflow: 'hidden',
  borderRadius: 'inherit',
  display: 'block'
}

/** L'image placée pour que le carré `c` remplisse exactement son cadre. */
export function styleCarre(c: CadreCarre): CSSProperties {
  return {
    position: 'absolute',
    left: `${(-c.x / c.w) * 100}%`,
    top: `${(-c.y / c.h) * 100}%`,
    width: `${100 / c.w}%`,
    height: `${100 / c.h}%`,
    maxWidth: 'none',
    borderRadius: 0,
    objectFit: 'fill',
    transform: 'none'
  }
}

export function Visage({
  url,
  cadre,
  alt = ''
}: {
  url: string
  cadre: CadreCarre | null | undefined
  alt?: string
}): JSX.Element {
  if (!cadre) return <img src={url} alt={alt} draggable={false} />
  return (
    <span style={CALQUE}>
      <img src={url} alt={alt} draggable={false} style={styleCarre(cadre)} />
    </span>
  )
}
