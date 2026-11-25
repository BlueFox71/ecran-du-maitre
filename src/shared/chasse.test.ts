import { describe, expect, it } from 'vitest'
import type { Construction } from './atelier'
import {
  gainSon,
  mesureSous,
  niveauEmfSous,
  pionSurPlan,
  temperatureSous,
  type TraitMesure
} from './chasse'

const trait = (valeur: number | null, pts: [number, number][], rayon = 1): TraitMesure => ({
  id: String(Math.random()),
  valeur,
  rayon,
  pts
})
const constr = (o: object): Construction => o as unknown as Construction

describe('mesureSous', () => {
  it('rien de peint', () => {
    expect(mesureSous([], [1, 1])).toBeNull()
    expect(mesureSous(undefined, [1, 1])).toBeNull()
  })
  it('un trait ne vaut que dans son rayon', () => {
    const t = [trait(3, [[5, 5]])]
    expect(mesureSous(t, [5.5, 5])).toBe(3)
    expect(mesureSous(t, [7, 5])).toBeNull()
  })
  it('repeindre remplace', () => {
    expect(mesureSous([trait(3, [[5, 5]]), trait(5, [[5, 5]])], [5, 5])).toBe(5)
  })
  it('la gomme efface', () => {
    expect(mesureSous([trait(4, [[5, 5]]), trait(null, [[5, 5]])], [5, 5])).toBeNull()
  })
})

describe('niveauEmfSous', () => {
  it('0 sans construction ni point', () => {
    expect(niveauEmfSous(null, [1, 1])).toBe(0)
    expect(niveauEmfSous(constr({}), null)).toBe(0)
  })
  it('lit le calque EMF', () => {
    expect(niveauEmfSous(constr({ emf: [trait(4, [[1, 1]])] }), [1, 1])).toBe(4)
  })
})

describe('temperatureSous', () => {
  it('ambiante par défaut', () => {
    expect(temperatureSous(null, [1, 1])).toBe(18)
  })
  it('ambiante de la construction', () => {
    expect(temperatureSous(constr({ ambiante: 12 }), [1, 1])).toBe(12)
  })
  it('un trait, puis la gomme', () => {
    const t = trait(-5, [[1, 1]])
    expect(temperatureSous(constr({ ambiante: 12, temperature: [t] }), [1, 1])).toBe(-5)
    const g = trait(null, [[1, 1]])
    expect(temperatureSous(constr({ ambiante: 12, temperature: [t, g] }), [1, 1])).toBe(12)
  })
})

describe('gainSon', () => {
  it('pleine près, nulle à la portée', () => {
    expect(gainSon(0, 0)).toBe(1)
    expect(gainSon(1, 0)).toBe(1)
    expect(gainSon(15, 0)).toBe(0)
  })
  it('décroît entre les deux', () => {
    const g = gainSon(8, 0)
    expect(g).toBeGreaterThan(0)
    expect(g).toBeLessThan(1)
  })
  it('chaque mur atténue', () => {
    expect(gainSon(4, 1)).toBeCloseTo(gainSon(4, 0) * 0.35)
    expect(gainSon(4, 2)).toBeCloseTo(gainSon(4, 0) * 0.35 ** 2)
  })
})

describe('pionSurPlan', () => {
  it('mêmes proportions : inchangé', () => {
    expect(pionSurPlan({ x: 0.5, y: 0.5 }, 1, 2)).toEqual({ x: 0.5, y: 0.5 })
  })
  it('écran plus large que la carte', () => {
    expect(pionSurPlan({ x: 0.75, y: 0.5 }, 1, 2)).toEqual({ x: 1, y: 0.5 })
  })
  it('écran plus haut que la carte', () => {
    expect(pionSurPlan({ x: 0.5, y: 0.75 }, 2, 1)).toEqual({ x: 0.5, y: 1 })
  })
})
