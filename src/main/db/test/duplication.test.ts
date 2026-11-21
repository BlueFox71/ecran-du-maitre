import { afterEach, beforeEach, expect, it } from 'vitest'
import {
  activer, compter, doc, fermerBaseEssai, fichier, inventaire, joueur, lieu, lu, objet, onglet,
  ouvrirBaseEssai, pj, placer, pnj, seance
} from './base'
import { getDb } from '../index'
import * as places from '../repos/places'
import * as chars from '../repos/characters'
import * as timeline from '../repos/timeline'

let s1: number
let s2: number
beforeEach(() => {
  ouvrirBaseEssai()
  s1 = seance('S1')
  s2 = seance('S2')
})
afterEach(() => fermerBaseEssai())

const db = (): ReturnType<typeof getDb> => getDb()
const sessionDeObjet = (placementId: number): number =>
  (db().prepare(`SELECT o.session_id AS s FROM objet_placement p JOIN objet o ON o.id = p.objet_id WHERE p.id = ?`).get(placementId) as any).s

it('reprendre un lieu copie ses objets', () => {
  const l = lieu('Grenier', s1)
  const o = objet(s1, 'Clé')
  placer(o, s1, { port: 'lieu', placeId: l })
  activer(s2)
  const neuf = places.duplicatePlace(l)
  const p = db().prepare(`SELECT id FROM objet_placement WHERE place_id = ?`).get(neuf) as { id: number }
  expect(sessionDeObjet(p.id)).toBe(s2)
  expect((db().prepare(`SELECT session_id AS s FROM objet WHERE id = ?`).get(o) as any).s).toBe(s1)
})

it('reprendre un PNJ copie ce qu’il porte', () => {
  const garde = pnj('Gardien', s1)
  placer(objet(s1, 'Trousseau'), s1, { port: 'pj', characterId: garde })
  activer(s2)
  const neuf = chars.duplicatePnj(garde)
  const p = db().prepare(`SELECT id FROM objet_placement WHERE character_id = ?`).get(neuf) as { id: number }
  expect(sessionDeObjet(p.id)).toBe(s2)
})

/** Une lampe partie du Camion, sortie par Ana ; un document dévoilé et lu. */
function scenario(): { ana: number } {
  activer(s1)
  const ana = pj('Ana')
  const camion = inventaire(s1, 'Camion')
  placer(objet(s1, 'Lampe'), s1, {
    port: 'pj', characterId: ana, etat: 'porte', init: { port: 'inventaire', inventaireId: camion, etat: 'trouve' }
  })
  const d = doc(s1, fichier('Plan'), { ongletId: onglet(s1, 'Indices'), visible: true })
  lu(d, joueur('Marie'))
  return { ana }
}

it('dupliquer remet au départ', () => {
  scenario()
  const nid = timeline.dupliquerSeance(s1, 'Copie', null, new Map(), false).id
  const p = db()
    .prepare(
      `SELECT p.port, i.nom AS inv, i.session_id AS invSession, o.session_id AS objSession
         FROM objet_placement p JOIN objet o ON o.id = p.objet_id LEFT JOIN inventaire i ON i.id = p.inventaire_id
        WHERE p.session_id = ?`
    )
    .all(nid) as any[]
  expect(p).toEqual([{ port: 'inventaire', inv: 'Camion', invSession: nid, objSession: nid }])
  const d = db().prepare(`SELECT id, visible FROM pochette WHERE session_id = ?`).all(nid) as any[]
  expect(d).toHaveLength(1)
  expect(d[0].visible).toBe(0)
  expect(compter(`SELECT COUNT(*) AS n FROM pochette_lu WHERE pochette_id = ?`, d[0].id)).toBe(0)
  expect(compter(`SELECT COUNT(*) AS n FROM pochette_onglet WHERE session_id = ?`, nid)).toBe(1)
})

it('la suite garde l’état actuel', () => {
  const { ana } = scenario()
  const nid = timeline.dupliquerSeance(s1, 'Suite', null, new Map(), true).id
  const p = db()
    .prepare(
      `SELECT p.port, p.character_id AS c, o.session_id AS objSession FROM objet_placement p
         JOIN objet o ON o.id = p.objet_id WHERE p.session_id = ?`
    )
    .all(nid) as any[]
  expect(p).toEqual([{ port: 'pj', c: ana, objSession: nid }])
  const d = db().prepare(`SELECT id, visible FROM pochette WHERE session_id = ?`).get(nid) as any
  expect(d.visible).toBe(1)
  expect(compter(`SELECT COUNT(*) AS n FROM pochette_lu WHERE pochette_id = ?`, d.id)).toBe(1)
  expect(compter(`SELECT COUNT(*) AS n FROM objet_placement WHERE session_id = ?`, s1)).toBe(1)
})
