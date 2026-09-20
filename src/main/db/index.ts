import Database from 'better-sqlite3'
import { app } from 'electron'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { MIGRATIONS } from './schema'
import { seedProject } from './seed'

/**
 * La base d'un projet. Il n'y en a qu'une d'ouverte à la fois, et elle vit
 * dans le dossier de la campagne — pas dans les données de l'application.
 * Ouvrir un autre projet, c'est fermer celle-ci et en ouvrir une autre :
 * voir project.ts, seul endroit qui a le droit d'appeler openDbAt().
 */
let db: Database.Database | null = null

/** Données de l'application elle-même : le carnet de joueurs, les récents. */
export function dataRoot(): string {
  const root = join(app.getPath('userData'), 'donnees')
  if (!existsSync(root)) mkdirSync(root, { recursive: true })
  return root
}

/**
 * Ouvre la base du projet, joue les migrations qui manquent, et installe les
 * gabarits et la campagne si le fichier vient de naître.
 */
export function openDbAt(file: string, nomSiNeuf: string): Database.Database {
  closeDb()
  mkdirSync(dirname(file), { recursive: true })

  db = new Database(file)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(
    `CREATE TABLE IF NOT EXISTS migration (id INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))`
  )
  const applied = new Set(
    db
      .prepare(`SELECT id FROM migration`)
      .all()
      .map((r: any) => r.id as number)
  )

  for (const m of MIGRATIONS) {
    if (applied.has(m.id)) continue
    db.transaction(() => {
      db!.exec(m.sql)
      db!.prepare(`INSERT INTO migration (id) VALUES (?)`).run(m.id)
    })()
    console.log(`[db] migration ${m.id} appliquée`)
  }

  const n = db.prepare(`SELECT COUNT(*) AS n FROM campaign`).get() as { n: number }
  if (n.n === 0) seedProject(db, nomSiNeuf)

  return db
}

export function isDbOpen(): boolean {
  return db !== null
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Aucun projet ouvert.')
  return db
}

export function closeDb(): void {
  if (!db) return
  try {
    db.pragma('wal_checkpoint(TRUNCATE)')
    db.close()
  } catch (e) {
    console.error('[db] fermeture :', e)
  }
  db = null
}

/** Identifiant de la campagne active (il y en a toujours une dans un projet). */
export function activeCampaignId(): number {
  const row = getDb().prepare(`SELECT id FROM campaign WHERE active = 1 LIMIT 1`).get() as
    | { id: number }
    | undefined
  if (row) return row.id
  const first = getDb().prepare(`SELECT id FROM campaign ORDER BY id LIMIT 1`).get() as {
    id: number
  }
  getDb().prepare(`UPDATE campaign SET active = 1 WHERE id = ?`).run(first.id)
  return first.id
}

/** Identifiant de la séance en cours pour la campagne active, créée au besoin. */
export function activeSessionId(): number {
  const cid = activeCampaignId()
  const row = getDb()
    .prepare(`SELECT id FROM game_session WHERE campaign_id = ? AND active = 1 LIMIT 1`)
    .get(cid) as { id: number } | undefined
  if (row) return row.id

  const last = getDb()
    .prepare(`SELECT id FROM game_session WHERE campaign_id = ? ORDER BY id DESC LIMIT 1`)
    .get(cid) as { id: number } | undefined
  if (last) {
    getDb().prepare(`UPDATE game_session SET active = 1 WHERE id = ?`).run(last.id)
    return last.id
  }

  const info = getDb()
    .prepare(`INSERT INTO game_session (campaign_id, label, active) VALUES (?, ?, 1)`)
    .run(cid, 'Séance 1')
  return Number(info.lastInsertRowid)
}
