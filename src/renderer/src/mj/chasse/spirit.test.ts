import { describe, expect, it } from 'vitest'
import { FREQUENCE_MAX, FREQUENCE_MIN, frequenceSuivante, texteFrequence } from './spirit'

describe('Spirit Box', () => {
  it('avance d’un pas, au dixième près', () => {
    expect(frequenceSuivante(94.3, 0.2)).toBe(94.5)
    expect(frequenceSuivante(99.9, 0.1)).toBe(100)
  })

  it('repart du bas de la bande une fois au bout', () => {
    expect(frequenceSuivante(FREQUENCE_MAX, 0.2)).toBe(FREQUENCE_MIN)
  })

  it('écrit la fréquence avec un chiffre après la virgule', () => {
    expect(texteFrequence(100)).toBe('100.0')
    expect(texteFrequence(87.5)).toBe('87.5')
  })
})
