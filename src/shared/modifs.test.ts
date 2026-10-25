import { expect, it } from 'vitest'
import { apresLeCombat, apresUnJet, apresUnTour, bonusDuJet, sommeBonus, valeurEffet, type Modif } from './modifs'
import type { Objet } from './types'

const FOR = { key: 'for', label: 'Force', code: 'FOR' }
const DEX = { key: 'dex', label: 'Dextérité', code: 'DEX' }

const m = (id: string, valeur: number, caracKey: string | null, duree: Modif['duree']): Modif => ({
  id,
  valeur,
  raison: id,
  caracKey,
  duree
})

/** Un objet réduit à ce que le compte lit : ses effets, et qui le porte où. */
const objet = (nom: string, effets: [string, string][], emplacement: string | null): Objet =>
  ({
    nom,
    effets: effets.map(([tete, detail], i) => ({ id: String(i), tete, detail })),
    placements: [{ characterId: 1, emplacement }]
  }) as unknown as Objet

it('lit la tête d’un effet comme un bonus, ou pas', () => {
  expect(valeurEffet('+1')).toBe(1)
  expect(valeurEffet('−2')).toBe(-2)
  expect(valeurEffet('- 3')).toBe(-3)
  expect(valeurEffet('Dégâts')).toBeNull()
  expect(valeurEffet('1d6')).toBeNull()
})

it('compte les bonus de la carac, ceux de tous les jets, et les objets portés seulement', () => {
  const modifs = [m('Béni', 2, null, { genre: 'jets', reste: 1 }), m('Jambe', -1, 'dex', { genre: 'retrait' })]
  const objets = [
    objet('Gants', [['+1', 'Force']], 'main-g'),
    objet('Talisman', [['+1', '']], 'cou'),
    objet('Grimoire', [['+3', 'FOR']], null)
  ]
  const pourFor = bonusDuJet(modifs, objets, 1, FOR)
  expect(pourFor.map((l) => l.raison)).toEqual(['Béni', 'Gants', 'Talisman'])
  expect(sommeBonus(pourFor)).toBe(4)
  expect(sommeBonus(bonusDuJet(modifs, objets, 1, DEX))).toBe(2)
})

it('use le prochain jet sur la bonne carac seulement', () => {
  const modifs = [
    m('a', 2, null, { genre: 'jets', reste: 1 }),
    m('b', 1, 'dex', { genre: 'jets', reste: 2 }),
    m('c', -1, 'for', { genre: 'retrait' })
  ]
  const apres = apresUnJet(modifs, 'for')
  expect(apres.map((x) => x.id)).toEqual(['b', 'c'])
  expect(apresUnJet(apres, 'dex')[0].duree).toEqual({ genre: 'jets', reste: 1 })
})

it('fait vieillir les tours, et la fin du combat les efface', () => {
  const modifs = [m('a', 1, null, { genre: 'tours', reste: 2 }), m('b', 1, null, { genre: 'retrait' })]
  const un = apresUnTour(modifs)
  expect(un[0].duree).toEqual({ genre: 'tours', reste: 1 })
  expect(apresUnTour(un).map((x) => x.id)).toEqual(['b'])
  expect(apresLeCombat(modifs).map((x) => x.id)).toEqual(['b'])
})
