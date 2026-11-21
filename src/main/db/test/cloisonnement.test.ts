import { afterEach, beforeEach, expect, it } from 'vitest'
import {
  activer, compter, doc, famille, fermerBaseEssai, fichier, inventaire, lieu, objet, onglet,
  ouvrirBaseEssai, pj, placer, seance
} from './base'
import { getDb } from '../index'
import * as objets from '../repos/objets'
import * as pochette from '../repos/pochette'
import * as timeline from '../repos/timeline'
import * as chars from '../repos/characters'
import { copierObjet, nouvelleCorrespondance } from '../repos/copieSeance'
import { reinitialiser } from '../../reinitialiser'
import { FAMILLES_LIVREES } from '@shared/types'

beforeEach(() => {
  ouvrirBaseEssai()
})
afterEach(() => fermerBaseEssai())

const db = (): ReturnType<typeof getDb> => getDb()

it('une séance neuve est vide', () => {
  const s1 = seance('S1')
  activer(s1)
  const f = famille(s1, 'Cercle')
  const o = objet(s1, 'Bougie', f)
  placer(o, s1, { port: 'inventaire', inventaireId: inventaire(s1, 'Camion') })
  doc(s1, fichier('Plan'), { ongletId: onglet(s1, 'Indices') })
  expect(objets.listObjets()).toHaveLength(1)

  timeline.createSession('S2')

  expect(objets.listObjets()).toEqual([])
  expect(objets.listFamilles()).toEqual([])
  expect(objets.listInventaires()).toEqual([])
  expect(pochette.listPochette()).toEqual([])
  expect(pochette.listOnglets()).toEqual([])
})

it('entrer dans une séance ne recopie pas les affaires', () => {
  const s1 = seance('S1')
  activer(s1)
  const ana = pj('Ana')
  placer(objet(s1, 'Lampe'), s1, { port: 'pj', characterId: ana })
  chars.preparerSeance(s1)
  const s2 = timeline.createSession('S2').id
  chars.preparerSeance(s2)
  expect(compter(`SELECT COUNT(*) AS n FROM objet_placement WHERE session_id = ?`, s2)).toBe(0)
})

it('créer un objet le range dans la séance ouverte', () => {
  const s1 = seance('S1')
  activer(s1)
  const f = objets.addFamille({ nom: 'Cercle' })
  const o = objets.addObjet({ nom: 'Bougie', familleId: f.id })
  const i = objets.addInventaire('Camion')
  pochette.createOnglet('Indices')
  pochette.addDoc(fichier('Plan'), null, null)
  for (const [t, id] of [['objet_famille', f.id], ['objet', o.id], ['inventaire', i.id]] as const)
    expect((db().prepare(`SELECT session_id AS s FROM ${t} WHERE id = ?`).get(id) as any).s, t).toBe(s1)
  expect(compter(`SELECT COUNT(*) AS n FROM pochette WHERE session_id = ?`, s1)).toBe(1)
  expect(compter(`SELECT COUNT(*) AS n FROM pochette_onglet WHERE session_id = ?`, s1)).toBe(1)
})

it('modifier un objet ne touche pas l’autre séance', () => {
  const s1 = seance('S1')
  const s2 = seance('S2')
  const o = objet(s1, 'Lampe')
  const copie = copierObjet(o, s2, nouvelleCorrespondance())
  activer(s2)
  objets.updateObjet(copie, { nom: 'X' })
  expect((db().prepare(`SELECT nom FROM objet WHERE id = ?`).get(o) as any).nom).toBe('Lampe')
  expect(objets.listObjets().map((x) => x.nom)).toEqual(['X'])
})

it('un projet neuf garde ses familles livrées', () => {
  expect(objets.listFamilles().map((f) => f.nom)).toEqual(FAMILLES_LIVREES.map((f) => f.nom))
  expect(compter(`SELECT COUNT(*) AS n FROM objet_famille WHERE session_id IS NULL`)).toBe(0)
})

it('réinitialiser ne range que la séance ouverte', () => {
  const s1 = seance('S1')
  const s2 = seance('S2')
  const ana = pj('Ana')
  const ici = (s: number): number => {
    const l = lieu('Grenier', s)
    return placer(objet(s, 'Clé'), s, { port: 'pj', characterId: ana, init: { port: 'lieu', placeId: l } })
  }
  const p1 = ici(s1)
  const p2 = ici(s2)
  activer(s2)
  reinitialiser({
    objets: true, jaugesPj: false, jaugesPnj: false, modifs: false, journalJauges: false, journalJets: false
  } as any)
  expect((db().prepare(`SELECT port FROM objet_placement WHERE id = ?`).get(p2) as any).port).toBe('lieu')
  expect((db().prepare(`SELECT port FROM objet_placement WHERE id = ?`).get(p1) as any).port).toBe('pj')
})
