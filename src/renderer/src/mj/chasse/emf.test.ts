import { describe, expect, it } from 'vitest'
import { courbeApproche, ledsAllumees, reglageFichier } from './emf'

describe('EMF', () => {
  it('allume autant de LED que le niveau, bornées de 0 à 5', () => {
    expect(ledsAllumees(0)).toBe(0)
    expect(ledsAllumees(3)).toBe(3)
    expect(ledsAllumees(2.6)).toBe(3)
    expect(ledsAllumees(9)).toBe(5)
    expect(ledsAllumees(-1)).toBe(0)
  })

  it('joue le son tel quel à 3, en rafales dessous, plus vite dessus, rien à 0', () => {
    expect(reglageFichier(0)).toBeNull()
    const trois = reglageFichier(3)!
    expect(trois.vitesse).toBe(1)
    expect(trois.rafale).toBeNull()
    const un = reglageFichier(1)!
    expect(un.rafale).not.toBeNull()
    expect(un.vitesse).toBeLessThan(1)
    expect(un.volume).toBeLessThan(trois.volume)
    expect(reglageFichier(5)!.vitesse).toBeGreaterThan(1)
    expect(reglageFichier(2)!.rafale!.ecartMs).toBeLessThan(un.rafale!.ecartMs)
  })

  it('l’approche part de 0, culmine à 5 au milieu et y revient', () => {
    expect(courbeApproche(0, 8)).toBe(0)
    expect(courbeApproche(4, 8)).toBeCloseTo(5)
    expect(courbeApproche(8, 8)).toBe(0)
    expect(courbeApproche(2, 8)).toBeGreaterThan(courbeApproche(1, 8))
  })
})
