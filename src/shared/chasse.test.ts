import { describe, expect, it } from 'vitest'
import type { Construction } from './atelier'
import {
  gainSon,
  grilleTemperatures,
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
  it('un pion dans une bande est hors de la carte (pas borné)', () => {
    const q = pionSurPlan({ x: 0.9, y: 0.5 }, 1, 2)
    expect(q.x).toBeCloseTo(1.3)
    expect(q.y).toBe(0.5)
  })
  it('écran plus haut que la carte', () => {
    expect(pionSurPlan({ x: 0.5, y: 0.75 }, 2, 1)).toEqual({ x: 0.5, y: 1 })
  })
})

describe('pinceau relatif (réchauffer, refroidir)', () => {
  const ecart = (e: number, pts: [number, number][], rayon = 1): TraitMesure => ({
    id: String(Math.random()),
    valeur: null,
    ecart: e,
    rayon,
    pts
  })
  it("s'ajoute à l'ambiante, là où rien n'est peint", () => {
    expect(temperatureSous(constr({ ambiante: 12, temperature: [ecart(-3, [[1, 1]])] }), [1, 1])).toBe(9)
    expect(temperatureSous(constr({ ambiante: 12, temperature: [ecart(-3, [[1, 1]])] }), [4, 4])).toBe(12)
  })
  it("s'ajoute à la température peinte dessous, et les passages se cumulent", () => {
    const t = [trait(5, [[1, 1]]), ecart(2, [[1, 1]]), ecart(2, [[1, 1]]), ecart(-1, [[1, 1]])]
    expect(temperatureSous(constr({ ambiante: 12, temperature: t }), [1, 1])).toBe(8)
  })
  it('un même trait ne compte qu’une fois, même si ses points se chevauchent', () => {
    const t = [ecart(2, [[1, 1], [1.2, 1], [1.4, 1]])]
    expect(temperatureSous(constr({ ambiante: 10, temperature: t }), [1.2, 1])).toBe(12)
  })
  it('repeindre une température par-dessus efface les écarts dessous', () => {
    const t = [ecart(5, [[1, 1]]), trait(0, [[1, 1]])]
    expect(temperatureSous(constr({ ambiante: 10, temperature: t }), [1, 1])).toBe(0)
  })
  it('après la gomme, on repart de l’ambiante', () => {
    const t = [trait(30, [[1, 1]]), trait(null, [[1, 1]]), ecart(-4, [[1, 1]])]
    expect(temperatureSous(constr({ ambiante: 10, temperature: t }), [1, 1])).toBe(6)
  })
  it('reste dans les bornes, passage après passage', () => {
    const t = [trait(33, [[1, 1]]), ecart(5, [[1, 1]]), ecart(-5, [[1, 1]])]
    expect(temperatureSous(constr({ ambiante: 10, temperature: t }), [1, 1])).toBe(30)
  })
  it('la grille donne la même chose que la lecture point par point', () => {
    const t = [trait(5, [[2, 2]], 1.5), ecart(3, [[3, 2], [4, 2]], 1), trait(null, [[2, 3]], 0.5), ecart(-2, [[2, 2]], 2)]
    const k = 4
    const g = grilleTemperatures(t, 6, 5, 12, k)
    for (let j = 0; j < 5 * k; j++)
      for (let i = 0; i < 6 * k; i++) {
        const p: [number, number] = [(i + 0.5) / k, (j + 0.5) / k]
        expect(g.valeurs[j * g.l + i]).toBe(temperatureSous(constr({ ambiante: 12, temperature: t }), p))
      }
  })
})
