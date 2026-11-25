import { afterEach, beforeEach, expect, it } from 'vitest'
import { activer, fermerBaseEssai, lieu, objet, ouvrirBaseEssai, pj, placer, seance } from './base'
import { getDb } from '../index'
import * as objets from '../repos/objets'

beforeEach(() => {
  ouvrirBaseEssai()
})
afterEach(() => fermerBaseEssai())

it("un objet neuf n'est pas un outil", () => {
  activer(seance('S1'))
  expect(objets.addObjet({ nom: 'Clé' }).outil).toBeNull()
})

it("un objet devient outil ; une valeur inconnue est refusée ; la copie le garde", () => {
  activer(seance('S1'))
  const o = objets.addObjet({ nom: 'Détecteur' })
  expect(objets.updateObjet(o.id, { outil: 'emf' })?.outil).toBe('emf')
  expect(objets.getObjet(o.id)?.outil).toBe('emf')
  expect(objets.copyObjet(o.id)?.outil).toBe('emf')

  const n = objets.addObjet({ nom: 'Autre' })
  objets.updateObjet(n.id, { outil: 'nimporte' as never })
  expect(objets.getObjet(n.id)?.outil).toBeNull()
  /* Une valeur refusée ne défait pas un outil déjà posé : on retire avec null. */
  expect(objets.updateObjet(o.id, { outil: null })?.outil).toBeNull()
})

it("objetsVus dit l'outil d'un exemplaire posé, pas celui d'un objet ordinaire", () => {
  const s = seance('S1')
  activer(s)
  const l = lieu('Salle', s)
  const emf = objet(s, 'EMF')
  const cle = objet(s, 'Clé')
  objets.updateObjet(emf, { outil: 'emf' })
  for (const o of [emf, cle]) {
    const p = placer(o, s, { port: 'lieu', placeId: l, etat: 'trouve' })
    getDb().prepare(`UPDATE objet_placement SET pos_x = 0.5, pos_y = 0.5 WHERE id = ?`).run(p)
  }
  const vus = objets.objetsVus(l)
  expect(vus).toHaveLength(2)
  expect(vus.find((v) => v.nom === 'EMF')?.outil).toBe('emf')
  expect('outil' in vus.find((v) => v.nom === 'Clé')!).toBe(false)
})

it("donner dans un lieu note qui l'a posé ; redonné à un PJ, la trace s'efface", () => {
  const s = seance('S1')
  activer(s)
  const l = lieu('Salle', s)
  const perso = pj('Anna')
  const o = objet(s, 'EMF')
  const pl = placer(o, s, { port: 'pj', characterId: perso, etat: 'porte' })
  const posee = objets.donner(pl, { port: 'lieu', placeId: l }, undefined, perso)
  expect(posee?.placements[0].posePar).toBe(perso)
  const reprise = objets.donner(pl, { port: 'pj', characterId: perso })
  expect(reprise?.placements[0].posePar).toBeNull()
})
