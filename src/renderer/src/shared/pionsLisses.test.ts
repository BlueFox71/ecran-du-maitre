import { describe, expect, it } from 'vitest'
import { GLISSE_MS, estUnPas, positionAu } from './pionsLisses'

describe('la marche glissée des pions', () => {
  const course = { dx: 0.2, dy: 0.4, ax: 0.3, ay: 0.5, t0: 1000 }

  it('part d’où le pion était dessiné', () => {
    expect(positionAu(course, 1000)).toEqual({ x: 0.2, y: 0.4, fini: false })
  })

  it('est à mi-chemin à mi-battement', () => {
    const q = positionAu(course, 1000 + GLISSE_MS / 2)
    expect(q.x).toBeCloseTo(0.25)
    expect(q.y).toBeCloseTo(0.45)
    expect(q.fini).toBe(false)
  })

  it('s’arrête pile sur la position reçue, sans la dépasser', () => {
    expect(positionAu(course, 1000 + GLISSE_MS * 3)).toEqual({ x: 0.3, y: 0.5, fini: true })
  })

  it('glisse un pas de marche, franchit d’un coup un déplacement', () => {
    // Vingt envois par seconde à pleine allure (60 % de la largeur) : 3 % par envoi.
    expect(estUnPas({ x: 0.5, y: 0.5 }, { x: 0.53, y: 0.5 })).toBe(true)
    // Un pion lâché à l'autre bout de la carte.
    expect(estUnPas({ x: 0.1, y: 0.1 }, { x: 0.8, y: 0.7 })).toBe(false)
    // Rien n'a bougé : rien à glisser.
    expect(estUnPas({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 })).toBe(false)
  })
})
