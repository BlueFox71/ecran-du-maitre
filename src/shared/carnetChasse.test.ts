import { describe, expect, it } from 'vitest'
import { ENTITES_DEPART, INDICES_DEPART, marqueSuivante } from './carnetChasse'

describe('marqueSuivante', () => {
  it('un toucher entoure, le suivant barre, le troisième efface', () => {
    expect(marqueSuivante(null)).toBe('entoure')
    expect(marqueSuivante('entoure')).toBe('barre')
    expect(marqueSuivante('barre')).toBeNull()
  })
})

describe('listes de départ', () => {
  it('les 9 indices et les 18 entités du livre, dans leur ordre', () => {
    expect(INDICES_DEPART).toHaveLength(9)
    expect(ENTITES_DEPART).toHaveLength(18)
    expect(INDICES_DEPART[0]).toBe('EMF élevé')
    expect(INDICES_DEPART.at(-1)).toBe('Polaroïd / miroir')
    expect(INDICES_DEPART).not.toContain('Détecteur de mouvement')
    expect(ENTITES_DEPART[0]).toBe('Fantôme')
    expect(ENTITES_DEPART.at(-1)).toBe('Démon')
  })

  it('aucun doublon', () => {
    expect(new Set(INDICES_DEPART).size).toBe(INDICES_DEPART.length)
    expect(new Set(ENTITES_DEPART).size).toBe(ENTITES_DEPART.length)
  })
})
