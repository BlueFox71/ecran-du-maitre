import { afterEach, beforeEach, expect, it } from 'vitest'
import {
  compter, doc, famille, fermerBaseEssai, fichier, inventaire, joueur, lieu, lu, objet, onglet,
  ouvrirBaseEssai, pj, placer, seance
} from './base'
import {
  copierDoc, copierFamille, copierObjet, nouvelleCorrespondance, rattacherASeance
} from '../repos/copieSeance'

let db: ReturnType<typeof ouvrirBaseEssai>
let s1: number
let s2: number
beforeEach(() => {
  db = ouvrirBaseEssai()
  s1 = seance('S1')
  s2 = seance('S2')
})
afterEach(() => fermerBaseEssai())

const ligne = (t: string, id: number): any => db.prepare(`SELECT * FROM ${t} WHERE id = ?`).get(id)

it('copierObjet recopie la fiche et non les exemplaires', () => {
  const o = objet(s1, 'Lampe')
  db.prepare(`UPDATE objet SET vu = 'Une lampe UV', effets = '[{"x":1}]' WHERE id = ?`).run(o)
  placer(o, s1, { port: 'pj', characterId: pj('Ana') })
  const c = copierObjet(o, s2, nouvelleCorrespondance())
  expect(c).not.toBe(o)
  const copie = ligne('objet', c)
  expect(copie.nom).toBe('Lampe')
  expect(copie.vu).toBe('Une lampe UV')
  expect(copie.effets).toBe('[{"x":1}]')
  expect(copie.session_id).toBe(s2)
  expect(compter(`SELECT COUNT(*) AS n FROM objet_placement WHERE objet_id = ?`, c)).toBe(0)
  db.prepare(`UPDATE objet SET nom = 'X' WHERE id = ?`).run(c)
  expect(ligne('objet', o).nom).toBe('Lampe')
})

it('copierFamille fusionne sur le nom', () => {
  const ici = famille(s2, 'documents ')
  const la = famille(s1, 'Documents')
  const avant = compter(`SELECT COUNT(*) AS n FROM objet_famille`)
  expect(copierFamille(la, s2, nouvelleCorrespondance())).toBe(ici)
  expect(compter(`SELECT COUNT(*) AS n FROM objet_famille`)).toBe(avant)
})

it('copierObjet emporte sa famille, une seule fois', () => {
  const f = famille(s1, 'Cercle')
  const c = nouvelleCorrespondance()
  const a = copierObjet(objet(s1, 'Bougie', f), s2, c)
  const b = copierObjet(objet(s1, 'Craie', f), s2, c)
  expect(ligne('objet', a).famille_id).toBe(ligne('objet', b).famille_id)
  expect(ligne('objet_famille', ligne('objet', a).famille_id).session_id).toBe(s2)
})

it('copierObjet laisse la famille masquée', () => {
  const f = famille(s1, 'Photos')
  db.prepare(`UPDATE objet_famille SET masquee_depuis = ? WHERE id = ?`).run(s2, f)
  const c = copierObjet(objet(s1, 'Photo', f), s2, nouvelleCorrespondance())
  expect(ligne('objet', c).famille_id).toBeNull()
})

it('copierDoc au départ', () => {
  const og = onglet(s1, 'Indices')
  const d = doc(s1, fichier('Plan'), { ongletId: og, visible: true })
  lu(d, joueur('Marie'))
  const c = copierDoc(d, s2, nouvelleCorrespondance(), 'depart')!
  const copie = ligne('pochette', c)
  expect(copie.visible).toBe(0)
  expect(copie.session_id).toBe(s2)
  expect(compter(`SELECT COUNT(*) AS n FROM pochette_lu WHERE pochette_id = ?`, c)).toBe(0)
  const o = ligne('pochette_onglet', copie.onglet_id)
  expect(o.name).toBe('Indices')
  expect(o.session_id).toBe(s2)
})

it('copierDoc à l’état actuel garde ce qui est lu', () => {
  const d = doc(s1, fichier('Plan'), { visible: true })
  lu(d, joueur('Marie'))
  const c = copierDoc(d, s2, nouvelleCorrespondance(), 'actuel')!
  expect(ligne('pochette', c).visible).toBe(1)
  expect(compter(`SELECT COUNT(*) AS n FROM pochette_lu WHERE pochette_id = ?`, c)).toBe(1)
})

it('copierDoc refuse un doublon', () => {
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_pochette_unique ON pochette(session_id, item_id, player_key)`)
  const it = fichier('Plan')
  doc(s2, it)
  expect(copierDoc(doc(s1, it), s2, nouvelleCorrespondance(), 'depart')).toBeNull()
})

it('copierDoc écarte un document d’inventaire absent', () => {
  const inv = inventaire(s1, 'Camion')
  const d = doc(s1, fichier('Lampe'))
  db.prepare(`UPDATE pochette SET inventaire_id = ? WHERE id = ?`).run(inv, d)
  expect(copierDoc(d, s2, nouvelleCorrespondance(), 'actuel')).toBeNull()
})

it('rattacherASeance remplace ce qui vient d’ailleurs par une seule copie', () => {
  const o = objet(s1, 'Lampe')
  const inv = inventaire(s1, 'Camion')
  db.prepare(`UPDATE inventaire SET en_pochette = 1 WHERE id = ?`).run(inv)
  const p1 = placer(o, s2, { port: 'inventaire', inventaireId: inv })
  const p2 = placer(o, s2, { port: 'pj', characterId: pj('Ana'), init: { port: 'inventaire', inventaireId: inv } })
  const l = lieu('Scierie', s2)
  const carte = Number(db.prepare(`INSERT INTO lieu_carte (place_id) VALUES (?)`).run(l).lastInsertRowid)
  db.prepare(`INSERT INTO lieu_carte_objet (carte_id, objet_id) VALUES (?, ?)`).run(carte, o)
  const sc = Number(db.prepare(`INSERT INTO lieu_scenario (place_id) VALUES (?)`).run(l).lastInsertRowid)
  db.prepare(`INSERT INTO lieu_scenario_objet (scenario_id, objet_id) VALUES (?, ?)`).run(sc, o)

  const c = rattacherASeance(s2)

  const copie = c.objets.get(o)!
  expect(ligne('objet', copie).session_id).toBe(s2)
  expect(ligne('objet_placement', p1).objet_id).toBe(copie)
  expect(ligne('objet_placement', p2).objet_id).toBe(copie)
  const invCopie = ligne('objet_placement', p1).inventaire_id
  expect(invCopie).not.toBe(inv)
  expect(ligne('objet_placement', p2).init_inventaire_id).toBe(invCopie)
  expect(ligne('inventaire', invCopie).en_pochette).toBe(1)
  expect(compter(`SELECT COUNT(*) AS n FROM inventaire WHERE session_id = ?`, s2)).toBe(1)
  expect(compter(`SELECT COUNT(*) AS n FROM objet WHERE session_id = ?`, s2)).toBe(1)
  expect((db.prepare(`SELECT objet_id AS o FROM lieu_carte_objet WHERE carte_id = ?`).get(carte) as any).o).toBe(copie)
  expect((db.prepare(`SELECT objet_id AS o FROM lieu_scenario_objet WHERE scenario_id = ?`).get(sc) as any).o).toBe(copie)
  expect(ligne('objet', o).session_id).toBe(s1)
})

it('rattacherASeance ne touche pas ce qui est déjà là', () => {
  const o = objet(s2, 'Lampe')
  const p = placer(o, s2, { port: 'pj', characterId: pj('Ana') })
  rattacherASeance(s2)
  expect(ligne('objet_placement', p).objet_id).toBe(o)
  expect(compter(`SELECT COUNT(*) AS n FROM objet`)).toBe(1)
})
