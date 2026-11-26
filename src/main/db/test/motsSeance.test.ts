import { afterEach, beforeEach, expect, it } from 'vitest'
import { activer, fermerBaseEssai, joueur, ouvrirBaseEssai, seance } from './base'
import * as mots from '../repos/mots'

beforeEach(() => ouvrirBaseEssai())
afterEach(() => fermerBaseEssai())

it('le téléphone ne reçoit que les mots de la séance en cours', () => {
  const s1 = seance('S1')
  const s2 = seance('S2')
  const j = joueur('Alexis')
  activer(s1)
  mots.ecrire([j], 'Des pas te suivent.', null, true, false)
  activer(s2)
  expect(mots.motsDe(j)).toEqual([])
  mots.ecrire([j], 'Une porte claque.', null, true, false)
  expect(mots.motsDe(j).map((m) => m.texte)).toEqual(['Une porte claque.'])
  activer(s1)
  expect(mots.motsDe(j).map((m) => m.texte)).toEqual(['Des pas te suivent.'])
})
