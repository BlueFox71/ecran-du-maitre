import { afterEach, beforeEach, expect, it } from 'vitest'
import {
  activer, compter, doc, famille, fermerBaseEssai, fichier, inventaire, joueur, lu, objet, onglet,
  ouvrirBaseEssai, pj, placer, seance
} from './base'
import { repartirParSeance } from '../repartition'

let db: ReturnType<typeof ouvrirBaseEssai>
beforeEach(() => {
  db = ouvrirBaseEssai()
})
afterEach(() => fermerBaseEssai())

/** Remettre la base dans l'état d'avant la migration 96 : tout est commun. */
function toutCommun(): void {
  for (const t of ['objet', 'objet_famille', 'inventaire', 'pochette', 'pochette_onglet'])
    db.exec(`UPDATE ${t} SET session_id = NULL`)
  db.exec(`DROP INDEX IF EXISTS idx_pochette_unique`)
}

const nb = (sql: string, ...p: unknown[]): number => compter(sql, ...p)

it('chaque séance reçoit sa copie de ce qu’elle utilise, et la pochette partout', () => {
  db.exec(`DELETE FROM game_session`)
  db.exec(`DELETE FROM objet_famille`)
  const A = seance('A')
  const B = seance('B')
  const C = seance('C')
  activer(C)
  const f = famille(A, 'Équipement')
  const lampe = objet(A, 'Lampe', f)
  const cle = objet(A, 'Clé', f)
  const camion = inventaire(A, 'Camion')
  placer(lampe, A, { port: 'pj', characterId: pj('Ana') })
  placer(lampe, B, { port: 'inventaire', inventaireId: camion })
  const og = onglet(A, 'Indices')
  const d1 = doc(A, fichier('Plan'), { ongletId: og, visible: true })
  doc(A, fichier('Lettre'), { ongletId: og })
  lu(d1, joueur('Marie'))
  const placementsAvant = nb(`SELECT COUNT(*) AS n FROM objet_placement`)
  toutCommun()

  repartirParSeance(db)

  const lampes = db.prepare(`SELECT id, session_id AS s FROM objet WHERE nom = 'Lampe' ORDER BY s`).all() as any[]
  expect(lampes.map((l) => l.s)).toEqual([A, B])
  for (const l of lampes)
    expect(nb(`SELECT COUNT(*) AS n FROM objet_placement WHERE objet_id = ? AND session_id = ?`, l.id, l.s)).toBe(1)
  expect(db.prepare(`SELECT session_id AS s FROM inventaire WHERE nom = 'Camion'`).all()).toEqual([{ s: B }])
  expect((db.prepare(`SELECT session_id AS s FROM objet WHERE id = ?`).get(cle) as any).s).toBe(C)
  for (const s of [A, B, C]) {
    expect(nb(`SELECT COUNT(*) AS n FROM pochette WHERE session_id = ?`, s), `séance ${s}`).toBe(2)
    expect(nb(`SELECT COUNT(*) AS n FROM pochette_onglet WHERE session_id = ?`, s)).toBe(1)
    expect(
      nb(
        `SELECT COUNT(*) AS n FROM pochette_lu l JOIN pochette p ON p.id = l.pochette_id WHERE p.session_id = ?`,
        s
      )
    ).toBe(1)
    expect(
      nb(
        `SELECT COUNT(*) AS n FROM pochette p JOIN pochette_onglet o ON o.id = p.onglet_id
          WHERE p.session_id = ? AND o.session_id = ?`,
        s,
        s
      )
    ).toBe(2)
  }
  for (const t of ['objet', 'objet_famille', 'inventaire', 'pochette', 'pochette_onglet'])
    expect(nb(`SELECT COUNT(*) AS n FROM ${t} WHERE session_id IS NULL`), t).toBe(0)
  expect(nb(`SELECT COUNT(*) AS n FROM objet_placement`)).toBe(placementsAvant)
  expect(
    nb(`SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'index' AND name = 'idx_pochette_unique'`)
  ).toBe(1)
})

it('un document d’inventaire ne va que là où est l’inventaire', () => {
  db.exec(`DELETE FROM game_session`)
  const A = seance('A')
  const B = seance('B')
  activer(B)
  const camion = inventaire(A, 'Camion')
  const og = onglet(A, 'Camion')
  db.prepare(`UPDATE inventaire SET en_pochette = 1, pochette_onglet_id = ? WHERE id = ?`).run(og, camion)
  placer(objet(A, 'Lampe'), A, { port: 'inventaire', inventaireId: camion })
  const d = doc(A, fichier('Lampe'), { ongletId: og, visible: true })
  db.prepare(`UPDATE pochette SET inventaire_id = ? WHERE id = ?`).run(camion, d)
  toutCommun()

  repartirParSeance(db)

  const invA = db.prepare(`SELECT id, pochette_onglet_id AS o FROM inventaire WHERE session_id = ?`).get(A) as any
  expect(invA).toBeTruthy()
  expect(nb(`SELECT COUNT(*) AS n FROM pochette WHERE session_id = ? AND inventaire_id = ?`, A, invA.id)).toBe(1)
  expect((db.prepare(`SELECT session_id AS s FROM pochette_onglet WHERE id = ?`).get(invA.o) as any).s).toBe(A)
  expect(nb(`SELECT COUNT(*) AS n FROM pochette WHERE session_id = ? AND inventaire_id IS NOT NULL`, B)).toBe(0)
})

it('une campagne sans séance garde tout en commun', () => {
  db.exec(`DELETE FROM game_session`)
  db.prepare(`INSERT INTO objet (campaign_id, nom) VALUES ((SELECT id FROM campaign), 'Lampe')`).run()
  toutCommun()
  repartirParSeance(db)
  expect(nb(`SELECT COUNT(*) AS n FROM objet WHERE session_id IS NULL`)).toBe(1)
})

it('l’onglet d’un inventaire partagé n’est copié qu’une fois par séance', () => {
  db.exec(`DELETE FROM game_session`)
  const A = seance('A')
  const B = seance('B')
  const C = seance('C')
  activer(C)
  const camion = inventaire(A, 'Camion')
  const og = onglet(A, 'Camion')
  db.prepare(`UPDATE inventaire SET en_pochette = 1, pochette_onglet_id = ? WHERE id = ?`).run(og, camion)
  placer(objet(A, 'Lampe'), A, { port: 'inventaire', inventaireId: camion })
  placer(objet(A, 'Pelle'), B, { port: 'inventaire', inventaireId: camion })
  toutCommun()
  repartirParSeance(db)
  for (const s of [A, B, C]) expect(nb(`SELECT COUNT(*) AS n FROM pochette_onglet WHERE session_id = ?`, s), `séance ${s}`).toBe(1)
  for (const s of [A, B]) {
    const i = db.prepare(`SELECT pochette_onglet_id AS o FROM inventaire WHERE session_id = ?`).get(s) as any
    expect((db.prepare(`SELECT session_id AS s FROM pochette_onglet WHERE id = ?`).get(i.o) as any).s).toBe(s)
  }
})
