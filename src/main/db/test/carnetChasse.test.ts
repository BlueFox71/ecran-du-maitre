import { afterEach, beforeEach, expect, it } from 'vitest'
import { activer, fermerBaseEssai, ouvrirBaseEssai, pj, seance } from './base'
import * as carnet from '../repos/carnetChasse'
import * as reglages from '../repos/reglages'
import { ENTITES_DEPART, INDICES_DEPART } from '@shared/carnetChasse'

beforeEach(() => ouvrirBaseEssai())
afterEach(() => fermerBaseEssai())

const noms = (genre: 'indice' | 'entite'): string[] =>
  carnet
    .elements()
    .filter((e) => e.genre === genre)
    .map((e) => e.nom)

it('les listes de départ ne se posent qu’une fois', () => {
  expect(carnet.poserListesDeDepart()).toBe(true)
  expect(noms('indice')).toEqual([...INDICES_DEPART])
  expect(noms('entite')).toEqual([...ENTITES_DEPART])
  for (const e of carnet.elements()) carnet.retirerElement(e.id)
  expect(carnet.poserListesDeDepart()).toBe(false)
  expect(carnet.elements()).toEqual([])
})

it('pas de listes de départ pour une campagne WoW', () => {
  reglages.poser('regles', 'wow')
  expect(carnet.poserListesDeDepart()).toBe(false)
  expect(carnet.elements()).toEqual([])
})

it('ajouter, renommer, ordonner', () => {
  const a = carnet.ajouterElement('indice', 'EMF élevé')!
  const b = carnet.ajouterElement('indice', '  Odeur de soufre ')!
  expect(b.nom).toBe('Odeur de soufre')
  expect(noms('indice')).toEqual(['EMF élevé', 'Odeur de soufre'])
  expect(carnet.ajouterElement('entite', '  ')).toBeNull()
  carnet.renommerElement(a.id, 'EMF niveau 5')
  carnet.renommerElement(a.id, '   ')
  carnet.ordonner('indice', [b.id, a.id])
  expect(noms('indice')).toEqual(['Odeur de soufre', 'EMF niveau 5'])
})

it('les marques suivent la séance active', () => {
  const s1 = seance('S1')
  const s2 = seance('S2')
  const c = pj('Anna')
  const e = carnet.ajouterElement('indice', 'Spirit Box')!.id
  activer(s1)
  carnet.marquer(c, e, 'entoure')
  activer(s2)
  expect(carnet.marquesDeLaSeance()).toEqual([])
  activer(s1)
  expect(carnet.marquesDeLaSeance()).toEqual([{ characterId: c, elementId: e, etat: 'entoure' }])
})

it('marquer null efface, marquer deux fois remplace', () => {
  const c = pj('Anna')
  const e = carnet.ajouterElement('entite', 'Banshee')!.id
  carnet.marquer(c, e, 'entoure')
  carnet.marquer(c, e, 'barre')
  expect(carnet.marquesDeLaSeance()).toEqual([{ characterId: c, elementId: e, etat: 'barre' }])
  carnet.marquer(c, e, null)
  expect(carnet.marquesDeLaSeance()).toEqual([])
})

it('les marques d’un personnage sont les siennes sur tous ses appareils', () => {
  const c = pj('Anna')
  const e = carnet.ajouterElement('indice', 'Empreintes UV')!.id
  carnet.marquer(c, e, 'entoure')
  carnet.marquer(c, e, 'entoure')
  expect(carnet.marquesDeLaSeance()).toHaveLength(1)
})

it('retirer un élément emporte ses marques', () => {
  const c = pj('Anna')
  const e = carnet.ajouterElement('indice', 'Orbes sur caméra')!.id
  carnet.marquer(c, e, 'barre')
  carnet.retirerElement(e)
  expect(carnet.marquesDeLaSeance()).toEqual([])
})

it('refuse un élément qui n’est pas de la campagne', () => {
  const c = pj('Anna')
  expect(carnet.marquer(c, 999999, 'entoure')).toBe(false)
  expect(carnet.marquesDeLaSeance()).toEqual([])
})
