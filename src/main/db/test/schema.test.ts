import { afterEach, beforeEach, expect, it } from 'vitest'
import { statSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  compter, doc, famille, fermerBaseEssai, fichier, inventaire, objet, onglet, ouvrirBaseEssai, placer, seance
} from './base'
import { sauvegarderAvant } from '../index'

let db: ReturnType<typeof ouvrirBaseEssai>
beforeEach(() => {
  db = ouvrirBaseEssai()
})
afterEach(() => fermerBaseEssai())

it('migration 95 ajoute session_id', () => {
  for (const t of ['objet', 'objet_famille', 'inventaire', 'pochette', 'pochette_onglet']) {
    const cols = (db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map((c) => c.name)
    expect(cols, t).toContain('session_id')
  }
})

it('supprimer une séance emporte ses objets et pas ceux des autres', () => {
  const s1 = seance('S1')
  const s2 = seance('S2')
  for (const s of [s1, s2]) {
    const f = famille(s, 'Fam')
    objet(s, 'Lampe', f)
    inventaire(s, 'Camion')
    doc(s, fichier('Plan ' + s), { ongletId: onglet(s, 'Indices') })
  }
  db.prepare(`DELETE FROM game_session WHERE id = ?`).run(s1)
  for (const t of ['objet', 'objet_famille', 'inventaire', 'pochette', 'pochette_onglet']) {
    expect(compter(`SELECT COUNT(*) AS n FROM ${t} WHERE session_id = ?`, s1), t).toBe(0)
    expect(compter(`SELECT COUNT(*) AS n FROM ${t} WHERE session_id = ?`, s2), t).toBe(1)
  }
})

it('les fabriques posent un objet dans un inventaire', () => {
  const s = seance('S')
  const inv = inventaire(s, 'Camion')
  placer(objet(s, 'Lampe'), s, { port: 'inventaire', inventaireId: inv })
  expect(compter(`SELECT COUNT(*) AS n FROM objet_placement WHERE inventaire_id = ?`, inv)).toBe(1)
})

it('sauvegarde avant migration', () => {
  const f = join(tmpdir(), `edm-sauve-${Date.now()}.db`)
  writeFileSync(f, 'contenu de base')
  const copie = sauvegarderAvant(f, 95)
  expect(copie).toBe(`${f}.avant-migration-95`)
  expect(existsSync(copie)).toBe(true)
  expect(statSync(copie).size).toBe(statSync(f).size)
})
