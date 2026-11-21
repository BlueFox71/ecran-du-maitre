import { expect, it } from 'vitest'
import { bilanImport } from './bilanImport'

it('dit ce qui a été importé', () => {
  expect(bilanImport({ objets: 2, documents: 3, ignores: 0 })).toBe('2 objets et 3 documents importés')
  expect(bilanImport({ objets: 1, documents: 0, ignores: 0 })).toBe('1 objet importé')
  expect(bilanImport({ objets: 0, documents: 1, ignores: 1 })).toBe('1 document importé (1 déjà présent)')
  expect(bilanImport({ objets: 0, documents: 0, ignores: 2 })).toBe('Rien d’importé (2 déjà présents)')
})
