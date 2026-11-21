import { afterEach, beforeEach, expect, it } from 'vitest'
import {
  compter, doc, famille, fermerBaseEssai, fichier, inventaire, joueur, lu, objet, onglet,
  ouvrirBaseEssai, pj, placer, seance
} from './base'
import { getDb } from '../index'
import { importer, sourceImport } from '../repos/importSeance'

let s1: number
let s2: number
beforeEach(() => {
  ouvrirBaseEssai()
  s1 = seance('S1')
  s2 = seance('S2')
})
afterEach(() => fermerBaseEssai())

const db = (): ReturnType<typeof getDb> => getDb()
const aucun = { objetIds: [] as number[], docIds: [] as number[] }

it('l’import copie la famille et les objets cochés seulement', () => {
  const f = famille(s1, 'Équipement')
  const [a, b] = [objet(s1, 'Lampe UV', f), objet(s1, 'EMF', f), objet(s1, 'Thermomètre', f)]
  const bilan = importer(s1, s2, { ...aucun, objetIds: [a, b] })
  expect(bilan).toEqual({ objets: 2, documents: 0, ignores: 0 })
  expect((db().prepare(`SELECT nom FROM objet WHERE session_id = ? ORDER BY nom`).all(s2) as any[]).map((r) => r.nom)).toEqual([
    'EMF',
    'Lampe UV'
  ])
  expect(db().prepare(`SELECT nom FROM objet_famille WHERE session_id = ?`).all(s2)).toEqual([{ nom: 'Équipement' }])
})

it('un objet parti du Camion arrive dans le Camion copié', () => {
  const camion = inventaire(s1, 'Camion')
  db().prepare(`UPDATE inventaire SET en_pochette = 1 WHERE id = ?`).run(camion)
  const o = objet(s1, 'Piles')
  db().prepare(`UPDATE objet SET unique_piece = 0, qte = 3 WHERE id = ?`).run(o)
  placer(o, s1, { port: 'pj', characterId: pj('Ana'), qte: 1, init: { port: 'inventaire', inventaireId: camion, qte: 3 } as any })
  db().prepare(`UPDATE objet_placement SET init_etat = 'trouve' WHERE objet_id = ?`).run(o)
  importer(s1, s2, { ...aucun, objetIds: [o] })
  const p = db()
    .prepare(
      `SELECT p.port, p.qte, p.etat, i.nom, i.en_pochette AS ep, i.session_id AS s, p.init_port AS ip
         FROM objet_placement p JOIN inventaire i ON i.id = p.inventaire_id WHERE p.session_id = ?`
    )
    .all(s2)
  expect(p).toEqual([{ port: 'inventaire', qte: 1, etat: 'trouve', nom: 'Camion', ep: 0, s: s2, ip: 'inventaire' }])
})

it('un objet parti d’un PJ arrive dans la réserve', () => {
  const o = objet(s1, 'Carnet')
  placer(o, s1, { port: 'pj', characterId: pj('Ana') })
  expect(importer(s1, s2, { ...aucun, objetIds: [o] }).objets).toBe(1)
  expect(compter(`SELECT COUNT(*) AS n FROM objet WHERE session_id = ?`, s2)).toBe(1)
  expect(compter(`SELECT COUNT(*) AS n FROM objet_placement WHERE session_id = ?`, s2)).toBe(0)
})

it('un objet à deux exemplaires donne une fiche', () => {
  const camion = inventaire(s1, 'Camion')
  const o = objet(s1, 'Lampe')
  placer(o, s1, { port: 'inventaire', inventaireId: camion })
  placer(o, s1, { port: 'pj', characterId: pj('Ana') })
  importer(s1, s2, { ...aucun, objetIds: [o] })
  expect(compter(`SELECT COUNT(*) AS n FROM objet WHERE session_id = ?`, s2)).toBe(1)
  expect(db().prepare(`SELECT port FROM objet_placement WHERE session_id = ?`).all(s2)).toEqual([{ port: 'inventaire' }])
})

it('importer deux fois donne deux copies', () => {
  const o = objet(s1, 'Lampe')
  importer(s1, s2, { ...aucun, objetIds: [o] })
  importer(s1, s2, { ...aucun, objetIds: [o] })
  expect(compter(`SELECT COUNT(*) AS n FROM objet WHERE session_id = ?`, s2)).toBe(2)
  expect(compter(`SELECT COUNT(*) AS n FROM objet_famille WHERE session_id = ?`, s2)).toBe(0)
})

it('les copies sont indépendantes', () => {
  const o = objet(s1, 'Lampe')
  importer(s1, s2, { ...aucun, objetIds: [o] })
  const copie = (db().prepare(`SELECT id FROM objet WHERE session_id = ?`).get(s2) as any).id
  db().prepare(`UPDATE objet SET nom = 'Lampe cassée' WHERE id = ?`).run(copie)
  expect((db().prepare(`SELECT nom FROM objet WHERE id = ?`).get(o) as any).nom).toBe('Lampe')
  db().prepare(`UPDATE objet SET vu = 'neuf' WHERE id = ?`).run(o)
  expect((db().prepare(`SELECT vu FROM objet WHERE id = ?`).get(copie) as any).vu).toBe('')
})

it('un document importé est caché et non lu', () => {
  const d = doc(s1, fichier('Plan'), { ongletId: onglet(s1, 'Indices'), visible: true })
  lu(d, joueur('Marie'))
  expect(importer(s1, s2, { ...aucun, docIds: [d] })).toEqual({ objets: 0, documents: 1, ignores: 0 })
  const c = db().prepare(`SELECT id, visible FROM pochette WHERE session_id = ?`).get(s2) as any
  expect(c.visible).toBe(0)
  expect(compter(`SELECT COUNT(*) AS n FROM pochette_lu WHERE pochette_id = ?`, c.id)).toBe(0)
  expect(db().prepare(`SELECT name FROM pochette_onglet WHERE session_id = ?`).all(s2)).toEqual([{ name: 'Indices' }])
})

it('un document déjà présent est ignoré', () => {
  const plan = fichier('Plan')
  doc(s2, plan)
  expect(importer(s1, s2, { ...aucun, docIds: [doc(s1, plan)] })).toEqual({ objets: 0, documents: 0, ignores: 1 })
})

it('importer depuis la séance cible est refusé', () => {
  expect(() => importer(s2, s2, aucun)).toThrow('Choisissez une autre séance')
})

it('sourceImport range par famille et n’offre pas les documents d’inventaire', () => {
  const f = famille(s1, 'Cercle')
  objet(s1, 'Bougie', f)
  objet(s1, 'Clé')
  const og = onglet(s1, 'Indices')
  doc(s1, fichier('Plan'), { ongletId: og })
  const derive = doc(s1, fichier('Bougie'), { ongletId: og })
  db().prepare(`UPDATE pochette SET inventaire_id = ? WHERE id = ?`).run(inventaire(s1, 'Malle'), derive)
  const src = sourceImport(s1)
  expect(src.familles.map((x) => [x.id, x.nom, x.objets.map((o) => o.nom)])).toEqual([
    [f, 'Cercle', ['Bougie']],
    [null, 'Sans famille', ['Clé']]
  ])
  expect(src.onglets.map((o) => [o.nom, o.docs.map((d) => d.titre)])).toEqual([['Indices', ['Plan']]])
})
