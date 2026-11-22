import { describe, expect, it } from 'vitest'
import { FICHE_WOW, idJoueur, jugerJet } from './wow'

describe('le jet contre la difficulté', () => {
  it('réussit quand le dé plus les facteurs atteint le score', () => {
    expect(jugerJet(13, 2, 15)).toMatchObject({ total: 15, reussi: true, naturel: null })
    expect(jugerJet(13, 1, 15)).toMatchObject({ total: 14, reussi: false })
  })
  it('sans difficulté, pas de verdict', () => {
    expect(jugerJet(7, 0, null).reussi).toBeNull()
  })
  it('signale le 20 et le 1 naturels sans changer le verdict', () => {
    expect(jugerJet(20, -10, 15)).toMatchObject({ naturel: 'vingt', reussi: false })
    expect(jugerJet(1, 5, 5)).toMatchObject({ naturel: 'un', reussi: true })
  })
})

describe("l'identifiant d'un joueur", () => {
  it("suit le slug de l'Aventure", () => {
    expect(idJoueur('Marie')).toBe('marie')
    expect(idJoueur('  Jean-Hervé ')).toBe('jean-herve')
    expect(idJoueur('Zoé & Léa')).toBe('zoe-lea')
  })
})

describe('la fiche WoW', () => {
  it('a les dix caractéristiques, sans compétences ni santé mentale', () => {
    expect(FICHE_WOW.stats).toHaveLength(10)
    expect(FICHE_WOW.sansCompetences).toBe(true)
    expect(FICHE_WOW.sanityGauge).toBeNull()
    expect(FICHE_WOW.systeme).toBe('wow')
  })
})
