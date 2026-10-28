import { expect, it } from 'vitest'
import { basculer, cible, couvre, placer } from './surlignage'

const T = 'Le manoir est vide. La cave cache un corps.'

it('adresse un texte par sa sorte, son id et son champ', () => {
  expect(cible('item', 12, 'body')).toBe('item:12:body')
})

it('surligne un glissé', () => {
  expect(basculer([], 3, 9, T)).toEqual([{ debut: 3, fin: 9, cite: 'manoir' }])
})

it('fond ce qui chevauche ou touche', () => {
  expect(basculer([{ debut: 3, fin: 9, cite: 'manoir' }], 1, 5, T)).toEqual([
    { debut: 1, fin: 9, cite: 'e manoir' }
  ])
  expect(basculer([{ debut: 3, fin: 9, cite: 'manoir' }], 9, 13, T)).toEqual([
    { debut: 3, fin: 13, cite: 'manoir est' }
  ])
})

it('dé-surligne quand le glissé commence dans du surligné, en coupant', () => {
  expect(basculer([{ debut: 0, fin: 19, cite: T.slice(0, 19) }], 3, 9, T)).toEqual([
    { debut: 0, fin: 3, cite: 'Le ' },
    { debut: 9, fin: 19, cite: ' est vide.' }
  ])
})

it('glissé à rebours : même chose qu’à l’endroit', () => {
  expect(basculer([], 9, 3, T)).toEqual([{ debut: 3, fin: 9, cite: 'manoir' }])
})

it('suit le sens imposé par la première cible d’un glissé', () => {
  expect(basculer([], 3, 9, T, true)).toEqual([])
  expect(basculer([{ debut: 0, fin: 2, cite: 'Le' }], 0, 9, T, false)).toEqual([
    { debut: 0, fin: 9, cite: 'Le manoir' }
  ])
})

it('ne fait rien d’un glissé vide', () => {
  expect(basculer([], 5, 5, T)).toEqual([])
})

it('place un surlignage resté à sa place', () => {
  expect(placer([{ debut: 3, fin: 9, cite: 'manoir' }], T)).toEqual([{ debut: 3, fin: 9 }])
})

it('retrouve un passage déplacé par une réécriture', () => {
  expect(placer([{ debut: 3, fin: 9, cite: 'manoir' }], 'Le vieux manoir est vide.')).toEqual([
    { debut: 9, fin: 15 }
  ])
})

it('ne devine pas entre plusieurs occurrences : mieux vaut rien que le mauvais mot', () => {
  expect(placer([{ debut: 18, fin: 22, cite: 'cave' }], 'cave. Le manoir. La cave.')).toEqual([])
  expect(placer([{ debut: 7, fin: 9, cite: 'et' }], 'XYZA et B et C')).toEqual([])
})

it('dit si un point du texte est déjà surligné — là où le geste a commencé', () => {
  const ps = [{ debut: 3, fin: 9, cite: 'manoir' }]
  expect(couvre(ps, 3)).toBe(true)
  expect(couvre(ps, 8)).toBe(true)
  expect(couvre(ps, 9)).toBe(false)
  expect(couvre(ps, 0)).toBe(false)
})

it('oublie un passage disparu', () => {
  expect(placer([{ debut: 3, fin: 9, cite: 'manoir' }], 'La maison est vide.')).toEqual([])
})
