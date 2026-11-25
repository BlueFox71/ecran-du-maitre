import { describe, expect, it } from 'vitest'
import { bornerTemperature, froid, rapprocher, texteTemperature } from './temperature'

describe('Thermomètre', () => {
  it('rejoint la cible pas à pas, sans la dépasser', () => {
    expect(rapprocher(20, 10, 2, 1)).toBe(18)
    expect(rapprocher(10, 20, 2, 1)).toBe(12)
    expect(rapprocher(10.5, 10, 2, 1)).toBe(10)
    expect(rapprocher(10, 10, 2, 1)).toBe(10)
  })

  it('écrit un chiffre après la virgule, sans « -0.0 »', () => {
    expect(texteTemperature(15.24)).toBe('15.2')
    expect(texteTemperature(-3)).toBe('-3.0')
    expect(texteTemperature(-0.04)).toBe('0.0')
  })

  it('blanchit l’écran avec le froid', () => {
    expect(froid(20)).toBe(0)
    expect(froid(-10)).toBe(1)
    expect(froid(3)).toBeGreaterThan(froid(10))
  })

  it('reste dans les bornes de l’appareil', () => {
    expect(bornerTemperature(99)).toBe(35)
    expect(bornerTemperature(-99)).toBe(-20)
  })
})
