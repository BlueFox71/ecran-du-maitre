import { describe, expect, it } from 'vitest'
import { aimanter } from './Toile'

describe('aimanter', () => {
  it('arrondit à la demi-case quand la grille est active', () => {
    expect(aimanter([2.3, 4.74], true, { shiftKey: false })).toEqual([2.5, 4.5])
  })
  it('Maj enfoncé : tracé libre', () => {
    expect(aimanter([2.3, 4.74], true, { shiftKey: true })).toEqual([2.3, 4.74])
  })
  it('grille coupée : tracé libre', () => {
    expect(aimanter([2.3, 4.74], false, { shiftKey: false })).toEqual([2.3, 4.74])
  })
})
