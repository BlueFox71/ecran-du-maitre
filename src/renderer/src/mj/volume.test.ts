import { describe, expect, it } from 'vitest'
import { COURSE, positionDe, texteVolume, volumeDe } from './volume'

describe('curseur de volume', () => {
  it('donne le premier tiers de la course aux dix premiers pour cent', () => {
    expect(volumeDe(Math.round(COURSE * 0.316))).toBeCloseTo(0.1, 2)
    expect(positionDe(0.1)).toBe(316)
  })

  it('garde les bornes', () => {
    expect(volumeDe(0)).toBe(0)
    expect(volumeDe(COURSE)).toBe(1)
    expect(positionDe(0)).toBe(0)
    expect(positionDe(1)).toBe(COURSE)
    expect(positionDe(2)).toBe(COURSE)
  })

  it('retrouve un volume rangé après un aller-retour', () => {
    for (const v of [0.02, 0.05, 0.35, 0.8]) expect(volumeDe(positionDe(v))).toBeCloseTo(v, 2)
  })

  it('règle le bas au dixième de pour cent', () => {
    const crans = [100, 101, 102].map(volumeDe)
    expect(crans[1] - crans[0]).toBeLessThan(0.0025)
    expect(crans[2]).toBeGreaterThan(crans[1])
  })

  it('montre une décimale sous 10 %, seulement si elle sert', () => {
    expect(texteVolume(2.5)).toBe('2,5 %')
    expect(texteVolume(3)).toBe('3 %')
    expect(texteVolume(45.4)).toBe('45 %')
  })
})
