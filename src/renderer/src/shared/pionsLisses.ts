import { useEffect, useRef, useState } from 'react'
import type { Pion } from '@shared/types'

/*
 * La marche d'un pion, vue à l'écran.
 *
 * Le téléphone et le pilote du MJ envoient la position vingt fois par seconde :
 * plus serait une rafale d'écritures et de diffusions pour rien. Mais un pion
 * qui saute de cran en cran se voit — et bien plus encore quand l'écran le
 * suit : c'est alors toute la carte qui saute, vingt fois par seconde.
 *
 * Chaque écran comble donc lui-même les intervalles : entre deux positions
 * reçues, il fait glisser le pion de l'une à l'autre en un battement. La
 * caméra, l'ombre des murs et le calque des pions se calculent tous sur cette
 * même position glissée ; ils restent donc d'accord entre eux, image après
 * image. Un pion posé ailleurs d'un coup (lâché à la souris, changé de lieu)
 * y va sans glisser : seule la marche se lisse.
 */

/** Le battement : un peu plus que l'intervalle entre deux envois (50 ms). */
export const GLISSE_MS = 70
/** Au-delà, ce n'est plus un pas mais un déplacement : on n'anime pas. */
export const SAUT_MAX = 0.12

interface Course {
  dx: number
  dy: number
  ax: number
  ay: number
  t0: number
}

/** Où en est un pion en chemin, à l'instant `t`. Linéaire : la marche est régulière. */
export function positionAu(c: Course, t: number, duree = GLISSE_MS): { x: number; y: number; fini: boolean } {
  const k = duree <= 0 ? 1 : Math.min(1, Math.max(0, (t - c.t0) / duree))
  return { x: c.dx + (c.ax - c.dx) * k, y: c.dy + (c.ay - c.dy) * k, fini: k >= 1 }
}

/** Un pas à glisser, ou un saut à franchir d'un coup ? */
export function estUnPas(de: { x: number; y: number }, a: { x: number; y: number }): boolean {
  const d = Math.hypot(a.x - de.x, a.y - de.y)
  return d > 0 && d <= SAUT_MAX
}

/**
 * Les pions tels qu'on les dessine : ceux reçus, aux positions glissées.
 * Rien ne tourne tant que personne ne marche.
 */
export function usePionsLisses(pions: Pion[] | undefined): Pion[] | undefined {
  /* Où chaque pion est dessiné en ce moment, et où il va. */
  const courses = useRef(new Map<number, Course>())
  const montres = useRef(new Map<number, { x: number; y: number }>())
  const [, setImage] = useState(0)
  const anim = useRef(0)

  /* À chaque position reçue : on repart d'où le pion est dessiné. */
  const maintenant = performance.now()
  if (pions) {
    for (const p of pions) {
      const c = courses.current.get(p.id)
      if (c && c.ax === p.x && c.ay === p.y) continue
      const vu = c ? positionAu(c, maintenant) : (montres.current.get(p.id) ?? { x: p.x, y: p.y })
      courses.current.set(
        p.id,
        estUnPas(vu, p) ? { dx: vu.x, dy: vu.y, ax: p.x, ay: p.y, t0: maintenant } : { dx: p.x, dy: p.y, ax: p.x, ay: p.y, t0: 0 }
      )
    }
  }

  /* Une image par rafraîchissement, tant qu'un pion est en chemin. */
  useEffect(() => {
    const enChemin = (): boolean => {
      const t = performance.now()
      for (const c of courses.current.values()) if (!positionAu(c, t).fini) return true
      return false
    }
    if (anim.current || !enChemin()) return
    const battre = (): void => {
      setImage((n) => n + 1)
      anim.current = enChemin() ? requestAnimationFrame(battre) : 0
    }
    anim.current = requestAnimationFrame(battre)
  })
  useEffect(
    () => () => {
      if (anim.current) cancelAnimationFrame(anim.current)
      anim.current = 0
    },
    []
  )

  if (!pions) return pions
  const t = performance.now()
  const ids = new Set<number>()
  const sortie = pions.map((p) => {
    ids.add(p.id)
    const c = courses.current.get(p.id)
    const q = c ? positionAu(c, t) : { x: p.x, y: p.y }
    montres.current.set(p.id, { x: q.x, y: q.y })
    return q.x === p.x && q.y === p.y ? p : { ...p, x: q.x, y: q.y }
  })
  /* Les pions partis n'ont plus de chemin. */
  for (const id of courses.current.keys()) if (!ids.has(id)) courses.current.delete(id)
  for (const id of montres.current.keys()) if (!ids.has(id)) montres.current.delete(id)
  return sortie
}
