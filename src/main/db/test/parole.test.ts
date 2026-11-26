import { afterEach, beforeEach, expect, it } from 'vitest'
import { activer, fermerBaseEssai, objet, ouvrirBaseEssai, seance } from './base'
import * as objets from '../repos/objets'
import * as tarot from '../repos/tarot'
import * as timeline from '../repos/timeline'
import { lireParole } from '@shared/parole'

beforeEach(() => ouvrirBaseEssai())
afterEach(() => fermerBaseEssai())

it('lireParole : un JSON abîmé donne une parole vide', () => {
  expect(lireParole('{pas du json')).toEqual({ textes: [] })
  expect(lireParole(null)).toEqual({ textes: [] })
  expect(lireParole({ textes: [{ id: 'a', texte: '  ' }, { id: 'b', texte: 'Viens' }] })).toEqual({
    textes: [{ id: 'b', texte: 'Viens' }]
  })
})

it('les textes et la voix d’une spirit box s’enregistrent sur sa fiche', () => {
  const s = seance('S1')
  activer(s)
  const o = objet(s, 'Spirit box')
  const voix = { nom: 'Microsoft Paul', reglages: { grave: 0.7, hachage: 0.2, echo: 0.5, clarte: 0.6 } }
  objets.updateObjet(o, { outil: 'spiritbox', parole: { textes: [{ id: 't1', texte: 'Partez' }], voix } })
  expect(objets.getObjet(o)!.parole).toEqual({ textes: [{ id: 't1', texte: 'Partez' }], voix })
})

it('les textes du tarot ne valent que pour la séance active', () => {
  const s1 = seance('S1')
  const s2 = seance('S2')
  activer(s1)
  tarot.ajouterTexteTarot('16-la-maison-dieu', 'Tout s’effondre ici.')
  activer(s2)
  expect(tarot.textesTarot()).toEqual([])
  activer(s1)
  expect(tarot.textesTarot().map((t) => t.texte)).toEqual(['Tout s’effondre ici.'])
})

it('dupliquer une séance emporte les textes des outils et ceux du tarot', () => {
  const s1 = seance('S1')
  activer(s1)
  const o = objet(s1, 'Livre')
  objets.updateObjet(o, { outil: 'livre', parole: { textes: [{ id: 't1', texte: 'Elle est là' }] } })
  tarot.ajouterTexteTarot('13-l-arcane-sans-nom', 'Une fin.')
  const nid = timeline.dupliquerSeance(s1, 'Suite', null, new Map(), true).id
  activer(nid)
  const copie = objets.listObjets().find((x) => x.nom === 'Livre')!
  expect(copie.id).not.toBe(o)
  expect(copie.parole.textes.map((t) => t.texte)).toEqual(['Elle est là'])
  expect(tarot.textesTarot().map((t) => t.texte)).toEqual(['Une fin.'])
})
