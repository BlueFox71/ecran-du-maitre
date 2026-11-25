import { describe, expect, it } from 'vitest'
import { ECRITURES, delaiLettre, ecritureParId, tremblement } from './ecriture'

describe('Livre d’écriture', () => {
  it('trace plus vite quand la vitesse monte', () => {
    expect(delaiLettre('a', 1, 0.5)).toBeLessThan(delaiLettre('a', 0, 0.5))
  })

  it('passe vite sur une espace, marque un temps sur une ponctuation et une ligne', () => {
    const a = delaiLettre('a', 0.5, 0.5)
    expect(delaiLettre(' ', 0.5, 0.5)).toBeLessThan(a)
    expect(delaiLettre('.', 0.5, 0.5)).toBeGreaterThan(a)
    expect(delaiLettre('\n', 0.5, 0.5)).toBeGreaterThan(delaiLettre('.', 0.5, 0.5))
  })

  it('fait trembler une lettre toujours pareil, et pas du tout sans agitation', () => {
    expect(tremblement(5, 1)).toEqual(tremblement(5, 1))
    expect(tremblement(5, 1)).not.toEqual(tremblement(6, 1))
    expect(Math.abs(tremblement(5, 0).angle)).toBe(0)
    expect(Math.abs(tremblement(5, 1).angle)).toBeLessThanOrEqual(4.5)
  })

  it('retombe sur la première écriture si l’identifiant est inconnu', () => {
    expect(ecritureParId('inconnue')).toBe(ECRITURES[0])
    expect(ecritureParId('plume').nom).toBe('Plume ancienne')
  })
})
