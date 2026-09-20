/**
 * La silhouette d'un personnage — le corps de sa poupée d'équipement.
 *
 * Deux dessins, homme ou femme, choisis sur sa fiche. Tant qu'on n'a rien dit,
 * c'est celle d'homme : la poupée doit pouvoir s'ouvrir avant qu'on ait réglé
 * quoi que ce soit.
 *
 * Elle porte **la couleur du personnage**, celle de son pion : autour de la
 * table on reconnaît le sien à sa teinte, et cette page-là ne fait pas
 * exception. Les classes `c-*` (slide.css) donnent la teinte et son fond.
 */
import { SILHOUETTE_FEMME, SILHOUETTE_HOMME } from './silhouettes'
import type { Sexe } from '@shared/types'

export function Silhouette({
  sexe,
  teinte,
  className
}: {
  sexe: Sexe | null
  /** Nom d'un jeton de couleur ; `null` laisse la teinte par défaut, le laiton. */
  teinte: string | null
  className?: string
}): JSX.Element {
  const t = sexe === 'femme' ? SILHOUETTE_FEMME : SILHOUETTE_HOMME
  return (
    <svg
      className={`silhouette c-${teinte ?? 'brass'}${className ? ' ' + className : ''}`}
      viewBox={t.viewBox}
      role="img"
      aria-label={`Silhouette ${sexe === 'femme' ? 'de femme' : 'd’homme'}`}
    >
      <path fillRule="evenodd" d={t.d} />
    </svg>
  )
}
