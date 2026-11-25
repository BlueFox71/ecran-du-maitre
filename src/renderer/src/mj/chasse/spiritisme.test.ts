import { describe, expect, it } from 'vitest'
import { REPOS, TOUTES_LES_CASES, caseDeLaTouche, dureeTrajet, pointDuTrajet } from './spiritisme'

describe('Planche de spiritisme', () => {
  it('a une case pour chaque lettre, chaque chiffre, OUI, NON et AU REVOIR', () => {
    const ids = TOUTES_LES_CASES.map((c) => c.id)
    for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') expect(ids).toContain(c)
    expect(ids).toEqual(expect.arrayContaining(['OUI', 'NON', 'AU REVOIR']))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('trouve la case d’une touche, accents ôtés, et rien pour une autre touche', () => {
    expect(caseDeLaTouche('a')?.id).toBe('A')
    expect(caseDeLaTouche('é')?.id).toBe('E')
    expect(caseDeLaTouche('7')?.id).toBe('7')
    expect(caseDeLaTouche('?')).toBeNull()
    expect(caseDeLaTouche('Enter')).toBeNull()
  })

  it('met plus longtemps pour aller loin, moins quand on accélère', () => {
    const a = caseDeLaTouche('A')!
    const b = caseDeLaTouche('B')!
    const z = caseDeLaTouche('Z')!
    expect(dureeTrajet(a, z, 1)).toBeGreaterThan(dureeTrajet(a, b, 1))
    expect(dureeTrajet(a, z, 2)).toBeLessThan(dureeTrajet(a, z, 1))
  })

  it('part du départ et arrive pile sur la case', () => {
    const z = caseDeLaTouche('Z')!
    expect(pointDuTrajet(REPOS, z, 0, 0.2)).toEqual({ x: REPOS.x, y: REPOS.y })
    const fin = pointDuTrajet(REPOS, z, 1, 0.2)
    expect(fin.x).toBeCloseTo(z.x)
    expect(fin.y).toBeCloseTo(z.y)
  })
})
