import Database from 'better-sqlite3'
import { expect, it } from 'vitest'
import { MIGRATIONS } from '../schema'

/** Deux 97 se sont croisées (outils de chasse / ambiance des cartes) : la 97 et la 101 rattrapent. */
const run = (id: number): ((db: Database.Database) => void) => MIGRATIONS.find((m) => m.id === id)!.run!

function base(colonnes: { outil?: boolean; ambiance?: boolean }): Database.Database {
  const db = new Database(':memory:')
  db.exec(`CREATE TABLE character (id INTEGER PRIMARY KEY);
    CREATE TABLE objet (id INTEGER PRIMARY KEY ${colonnes.outil ? ', outil TEXT' : ''});
    CREATE TABLE objet_placement (id INTEGER PRIMARY KEY ${colonnes.outil ? ', pose_par INTEGER' : ''});
    CREATE TABLE place (id INTEGER PRIMARY KEY ${colonnes.ambiance ? ', ambiance TEXT' : ''});`)
  return db
}

const a = (db: Database.Database, table: string): string[] =>
  (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name)

function complete(db: Database.Database): void {
  expect(a(db, 'objet')).toContain('outil')
  expect(a(db, 'objet_placement')).toContain('pose_par')
  expect(a(db, 'place')).toContain('ambiance')
}

it('une base neuve reçoit les trois colonnes à la 97, et la 101 ne casse rien', () => {
  const db = base({})
  run(97)(db)
  run(101)(db)
  complete(db)
})

it('une base qui avait la 97 des outils de chasse reçoit l’ambiance à la 101', () => {
  const db = base({ outil: true })
  run(101)(db)
  complete(db)
})

it('une base 1.16.0 (la 97 de l’ambiance) reçoit les outils de chasse à la 101', () => {
  const db = base({ ambiance: true })
  run(101)(db)
  complete(db)
})

it('les numéros de migration restent uniques', () => {
  const ids = MIGRATIONS.map((m) => m.id)
  expect(new Set(ids).size).toBe(ids.length)
})
