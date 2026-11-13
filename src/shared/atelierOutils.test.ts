import { describe, expect, it } from 'vitest'
import { constructionVide, type Construction } from './atelier'
import { pieceSous, rectangle, solSous } from './atelierOutils'

const terrain = (): Construction => ({ ...constructionVide(), largeur: 20, hauteur: 10 })

describe('rectangle', () => {
  it('rend les quatre coins dans l’ordre, quel que soit le sens du glisser', () => {
    expect(rectangle([5, 4], [1, 2])).toEqual([
      [1, 2],
      [5, 2],
      [5, 4],
      [1, 4]
    ])
  })
  it('un rectangle sans surface n’en est pas un', () => {
    expect(rectangle([1, 2], [1, 6])).toBeNull()
  })
})

describe('solSous', () => {
  it('rend le sol du dessus sous le point', () => {
    const c = terrain()
    c.sols.push(
      { id: 'cour', assetId: 'a', pts: [[0, 0], [20, 0], [20, 10], [0, 10]] },
      { id: 'salon', assetId: 'b', pts: [[2, 2], [8, 2], [8, 8], [2, 8]] }
    )
    expect(solSous(c, [5, 5])?.id).toBe('salon')
    expect(solSous(c, [15, 5])?.id).toBe('cour')
    expect(solSous(c, [25, 5])).toBeNull()
  })
})

describe('pieceSous', () => {
  it('rend le contour de la pièce fermée par les murs bâtis', () => {
    const c = terrain()
    c.murs.push(
      { id: 'ext', assetId: 'x', pts: [[1, 1], [11, 1], [11, 9], [1, 9], [1, 1]], epaisseur: 0.4 },
      { id: 'refend', assetId: 'x', pts: [[6, 1], [6, 9]], epaisseur: 0.4 }
    )
    const p = pieceSous(c, [8, 5])!
    const xs = p.map((q) => q[0])
    expect(Math.min(...xs)).toBeCloseTo(6, 6)
    expect(Math.max(...xs)).toBeCloseTo(11, 6)
  })
  it('hors de toute pièce fermée, rien', () => {
    const c = terrain()
    c.murs.push({ id: 'seul', assetId: 'x', pts: [[1, 1], [11, 1]], epaisseur: 0.4 })
    expect(pieceSous(c, [5, 5])).toBeNull()
  })
  it('un meuble ne ferme pas de pièce', () => {
    const c = terrain()
    c.murs.push({ id: 'ext', assetId: 'x', pts: [[1, 1], [11, 1], [11, 9], [1, 9], [1, 1]], epaisseur: 0.4 })
    c.objets.push({ id: 'lit', assetId: 'l', x: 4, y: 4, l: 2, h: 2, angle: 0, bloquePas: true, bloqueVue: true })
    const p = pieceSous(c, [4, 4])!
    expect(Math.max(...p.map((q) => q[0]))).toBeCloseTo(11, 6)
  })
})
