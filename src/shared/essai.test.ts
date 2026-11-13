import { describe, expect, it } from 'vitest'
import { constructionVide, type Construction } from './atelier'
import { calqueDEssai } from './essai'
import type { CalqueBrouillard } from './types'

const base: CalqueBrouillard = {
  murs: [],
  ouvertures: [],
  lumieres: [{ id: 1 } as never],
  lumGarde: false,
  regardPortee: null,
  regardOuverture: 120,
  porteurs: [],
  astre: null,
  objets: [],
  pieces: []
}

function maison(): Construction {
  const c: Construction = { ...constructionVide(), largeur: 10, hauteur: 10 }
  c.murs.push({ id: 'm', assetId: 'x', pts: [[0, 5], [10, 5]], epaisseur: 0.4 })
  c.ouvertures.push({ id: 'p', murId: 'm', nature: 'porte', assetId: 'y', d: 0.5, largeur: 1 })
  c.objets.push({ id: 'lit', assetId: 'l', x: 2, y: 2, l: 1, h: 1, angle: 0, bloquePas: true, bloqueVue: false })
  return c
}

describe('calqueDEssai', () => {
  it('prend les murs de la construction en cours, et garde le reste du calque du lieu', () => {
    const k = calqueDEssai(maison(), base, new Set())
    expect(k.murs.map((m) => m.nature)).toEqual(['mur', 'obstacle-bas'])
    expect(k.lumieres).toBe(base.lumieres)
    expect(k.regardOuverture).toBe(120)
  })
  it('relie chaque ouverture à son mur, fermée sauf si on l’a ouverte pendant l’essai', () => {
    const fermee = calqueDEssai(maison(), base, new Set())
    expect(fermee.ouvertures).toHaveLength(1)
    expect(fermee.ouvertures[0].murId).toBe(fermee.murs[0].id)
    expect(fermee.ouvertures[0].ouverte).toBe(false)
    expect(calqueDEssai(maison(), base, new Set(['p'])).ouvertures[0].ouverte).toBe(true)
  })
  it('des ids distincts pour chaque trait', () => {
    const ids = calqueDEssai(maison(), base, new Set()).murs.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
