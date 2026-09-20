/**
 * Le carnet de joueurs, et la mémoire des projets ouverts.
 *
 * Ces deux choses appartiennent à l'application, pas à une campagne : les
 * mêmes personnes jouent d'une campagne à l'autre, et la liste des récents
 * suit le maître du jeu, pas ses dossiers. Elles vivent donc dans une base
 * à part, sous les données de l'application, qui reste ouverte de bout en
 * bout — là où la base d'un projet, elle, va et vient.
 */
import Database from 'better-sqlite3'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { dataRoot } from './db'
import { couleurLibre } from '@shared/types'
import { CATALOGUE_LIVRE, MODELES_LIVRES } from './db/seed'
import type { Brut } from '@shared/reglages'
import type {
  CarnetPlayer,
  CatalogueEntry,
  RecentProject,
  SheetModel,
  TemplateSpec
} from '@shared/types'

let app: Database.Database | null = null

function db(): Database.Database {
  if (app) return app
  app = new Database(join(dataRoot(), 'application.db'))
  app.pragma('journal_mode = WAL')
  app.exec(`
    CREATE TABLE IF NOT EXISTS carnet_player (
      uid        TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      color      TEXT,
      notes      TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS recent_project (
      path      TEXT PRIMARY KEY,
      name      TEXT NOT NULL,
      opened_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS app_setting (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
    /* Les briques de fiche que le maître du jeu réutilise d'une campagne à
       l'autre. Le couple (genre, nom) est unique : écrire deux fois « Sang-froid »
       ne fait pas deux entrées, et réimporter un modèle n'encombre pas la liste. */
    CREATE TABLE IF NOT EXISTS catalogue_entry (
      uid        TEXT PRIMARY KEY,
      kind       TEXT NOT NULL,
      code       TEXT,
      label      TEXT NOT NULL,
      color      TEXT,
      max        INTEGER,
      builtin    INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_catalogue_nom
      ON catalogue_entry (kind, label COLLATE NOCASE);
    /* Une fiche entière, gardée pour servir de départ ailleurs. */
    CREATE TABLE IF NOT EXISTS sheet_model (
      uid      TEXT PRIMARY KEY,
      name     TEXT NOT NULL,
      spec     TEXT NOT NULL,
      builtin  INTEGER NOT NULL DEFAULT 0,
      saved_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_modele_nom ON sheet_model (name COLLATE NOCASE);
  `)
  garnir(app)
  return app
}

/**
 * Le numéro du fond livré. L'incrémenter fait reposer le fond au prochain
 * démarrage — c'est ce qui permet de corriger une brique mal nommée une fois
 * l'application chez les gens.
 */
const FOND = 2

/**
 * Le fond livré avec l'application : de quoi composer une fiche sans rien
 * écrire le premier soir.
 *
 * Il n'est reposé que si son numéro a changé, et il ne touche alors qu'à ce
 * qui est marqué « livré » : ce que le maître du jeu a écrit lui-même ne
 * bouge jamais, et ses fiches gardent leurs briques même si le fond en perd.
 */
function garnir(d: Database.Database): void {
  const pose = Number(
    (d.prepare(`SELECT value FROM app_setting WHERE key = 'fondCatalogue'`).get() as
      | { value: string }
      | undefined)?.value ?? 0
  )
  if (pose >= FOND) return

  const briques = d.prepare(
    `INSERT INTO catalogue_entry (uid, kind, code, label, color, max, builtin)
     VALUES (?, ?, ?, ?, ?, ?, 1) ON CONFLICT DO NOTHING`
  )
  const modeles = d.prepare(
    `INSERT INTO sheet_model (uid, name, spec, builtin) VALUES (?, ?, ?, 1) ON CONFLICT DO NOTHING`
  )

  d.transaction(() => {
    d.prepare(`DELETE FROM catalogue_entry WHERE builtin = 1`).run()
    for (const e of CATALOGUE_LIVRE) {
      briques.run(randomUUID(), e.kind, e.code ?? null, e.label, e.color ?? null, e.max ?? null)
    }
    d.prepare(`DELETE FROM sheet_model WHERE builtin = 1`).run()
    for (const m of MODELES_LIVRES) modeles.run(randomUUID(), m.name, JSON.stringify(m.spec))
    d.prepare(
      `INSERT INTO app_setting (key, value) VALUES ('fondCatalogue', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).run(String(FOND))
  })()
}

/* ============================================================
   Le catalogue de briques de fiche
   ============================================================ */

export function listCatalogue(): CatalogueEntry[] {
  return (
    db()
      .prepare(
        `SELECT uid, kind, code, label, color, max, builtin
           FROM catalogue_entry ORDER BY builtin DESC, label COLLATE NOCASE`
      )
      .all() as any[]
  ).map((r) => ({ ...r, builtin: !!r.builtin }))
}

/**
 * Une brique de plus au catalogue. Elle y reste : c'est tout l'intérêt —
 * écrite une fois ce soir, elle se retrouve dans la campagne d'après.
 * Un nom déjà pris rend l'entrée existante plutôt que d'en créer une jumelle.
 */
export function addCatalogueEntry(input: {
  kind: CatalogueEntry['kind']
  label: string
  code?: string | null
  color?: string | null
  max?: number | null
}): CatalogueEntry {
  const label = input.label.trim()
  const deja = db()
    .prepare(`SELECT uid FROM catalogue_entry WHERE kind = ? AND label = ? COLLATE NOCASE`)
    .get(input.kind, label) as { uid: string } | undefined
  if (deja) return listCatalogue().find((e) => e.uid === deja.uid)!

  const uid = randomUUID()
  db()
    .prepare(
      `INSERT INTO catalogue_entry (uid, kind, code, label, color, max, builtin)
       VALUES (?, ?, ?, ?, ?, ?, 0)`
    )
    .run(uid, input.kind, input.code?.trim() || null, label, input.color ?? null, input.max ?? null)
  return listCatalogue().find((e) => e.uid === uid)!
}

/** Effacer du catalogue ne touche à aucune fiche : les campagnes gardent la leur. */
export function removeCatalogueEntry(uid: string): void {
  db().prepare(`DELETE FROM catalogue_entry WHERE uid = ?`).run(uid)
}

/* ============================================================
   Les modèles de fiche
   ============================================================ */

export function listModels(): SheetModel[] {
  return (
    db()
      .prepare(
        `SELECT uid, name, spec, builtin, saved_at AS savedAt
           FROM sheet_model ORDER BY builtin DESC, name COLLATE NOCASE`
      )
      .all() as any[]
  ).map((r) => ({
    uid: r.uid,
    name: r.name,
    spec: JSON.parse(r.spec) as TemplateSpec,
    builtin: !!r.builtin,
    savedAt: r.savedAt
  }))
}

/**
 * Garder la fiche en cours comme modèle. Réenregistrer sous un nom déjà pris
 * écrase ce modèle — c'est le geste attendu quand on a corrigé sa fiche et
 * qu'on veut que le modèle suive ; un modèle livré, lui, ne bouge pas.
 */
export function saveModel(name: string, spec: TemplateSpec): SheetModel {
  const nom = name.trim() || 'Fiche sans nom'
  const deja = db()
    .prepare(`SELECT uid, builtin FROM sheet_model WHERE name = ? COLLATE NOCASE`)
    .get(nom) as { uid: string; builtin: number } | undefined

  if (deja && !deja.builtin) {
    db()
      .prepare(`UPDATE sheet_model SET spec = ?, saved_at = datetime('now') WHERE uid = ?`)
      .run(JSON.stringify(spec), deja.uid)
    return listModels().find((m) => m.uid === deja.uid)!
  }

  const uid = randomUUID()
  db()
    .prepare(`INSERT INTO sheet_model (uid, name, spec, builtin) VALUES (?, ?, ?, 0)`)
    .run(uid, deja ? `${nom} (la mienne)` : nom, JSON.stringify(spec))
  return listModels().find((m) => m.uid === uid)!
}

export function removeModel(uid: string): void {
  db().prepare(`DELETE FROM sheet_model WHERE uid = ? AND builtin = 0`).run(uid)
}

export function closeCarnet(): void {
  if (!app) return
  try {
    app.pragma('wal_checkpoint(TRUNCATE)')
    app.close()
  } catch (e) {
    console.error('[carnet] fermeture :', e)
  }
  app = null
}

/* ============================================================
   Carnet de joueurs
   ============================================================ */

export function listCarnet(): CarnetPlayer[] {
  return db()
    .prepare(`SELECT uid, name, color, notes FROM carnet_player ORDER BY name COLLATE NOCASE`)
    .all() as CarnetPlayer[]
}

/**
 * Une personne de plus au carnet. Sa couleur la suit partout : c'est à elle
 * qu'on la reconnaît d'une campagne à l'autre, et on ne la lui reprend pas.
 */
export function createCarnetPlayer(name: string, color?: string | null): CarnetPlayer {
  const uid = randomUUID()
  const teinte = color ?? couleurLibre(listCarnet().map((p) => p.color))
  db()
    .prepare(`INSERT INTO carnet_player (uid, name, color) VALUES (?, ?, ?)`)
    .run(uid, name.trim(), teinte)
  return { uid, name: name.trim(), color: teinte, notes: null }
}

export function updateCarnetPlayer(
  uid: string,
  patch: { name?: string; color?: string | null; notes?: string | null }
): CarnetPlayer | null {
  const cur = db().prepare(`SELECT * FROM carnet_player WHERE uid = ?`).get(uid) as
    | CarnetPlayer
    | undefined
  if (!cur) return null
  const next = {
    name: patch.name !== undefined ? patch.name.trim() : cur.name,
    color: patch.color !== undefined ? patch.color : cur.color,
    notes: patch.notes !== undefined ? patch.notes : cur.notes
  }
  db()
    .prepare(`UPDATE carnet_player SET name = ?, color = ?, notes = ? WHERE uid = ?`)
    .run(next.name, next.color, next.notes, uid)
  return { uid, ...next }
}

/**
 * Effacer du carnet ne touche à aucun projet : les campagnes gardent leur
 * copie du nom et de la couleur. On perd seulement le lien qui aurait permis
 * de reconnaître la personne ailleurs.
 */
export function deleteCarnetPlayer(uid: string): void {
  db().prepare(`DELETE FROM carnet_player WHERE uid = ?`).run(uid)
}

/**
 * Le carnet rattrape ce qu'un projet connaît et lui pas : à l'ouverture d'une
 * campagne, ses joueurs entrent au carnet s'ils y manquent. C'est ce qui fait
 * qu'une base d'avant les projets — où le joueur n'était qu'un nom tapé dans
 * une fiche — arrive avec ses gens déjà inscrits.
 */
export function absorb(joueurs: { uid: string; name: string; color: string | null }[]): void {
  const ins = db().prepare(
    `INSERT INTO carnet_player (uid, name, color) VALUES (?, ?, ?) ON CONFLICT(uid) DO NOTHING`
  )
  db().transaction(() => {
    for (const j of joueurs) ins.run(j.uid, j.name, j.color)
  })()
}

/* ============================================================
   Projets récents
   ============================================================ */

export function recents(): RecentProject[] {
  const rows = db()
    .prepare(`SELECT path, name, opened_at AS openedAt FROM recent_project ORDER BY opened_at DESC LIMIT 12`)
    .all() as Omit<RecentProject, 'exists'>[]
  return rows.map((r) => ({ ...r, exists: existsSync(r.path) }))
}

export function remember(path: string, name: string): void {
  db()
    .prepare(
      `INSERT INTO recent_project (path, name, opened_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(path) DO UPDATE SET name = excluded.name, opened_at = excluded.opened_at`
    )
    .run(path, name)
}

export function forget(path: string): void {
  db().prepare(`DELETE FROM recent_project WHERE path = ?`).run(path)
}

export function lastProject(): string | null {
  const row = db().prepare(`SELECT value FROM app_setting WHERE key = 'lastProject'`).get() as
    | { value: string | null }
    | undefined
  return row?.value ?? null
}

export function setLastProject(path: string | null): void {
  db()
    .prepare(
      `INSERT INTO app_setting (key, value) VALUES ('lastProject', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    .run(path)
}

/* ============================================================
   Les réglages du poste
   ============================================================ */

/**
 * Ce qui suit le maître du jeu, pas ses dossiers : le thème, le port des
 * portables, la taille des vignettes.
 *
 * `lastProject` et `fondCatalogue` vivent dans la même table et n'ont rien à
 * faire dans une fenêtre de réglages : on les écarte ici plutôt que de les
 * laisser paraître sous un nom que personne ne reconnaîtrait.
 */
const INTERNES = new Set(['lastProject', 'fondCatalogue'])

export function reglagesPoste(): Brut {
  const rows = db().prepare(`SELECT key, value FROM app_setting`).all() as {
    key: string
    value: string | null
  }[]
  const out: Brut = {}
  for (const r of rows) if (r.value !== null && !INTERNES.has(r.key)) out[r.key] = r.value
  return out
}

export function poserReglagePoste(cle: string, valeur: string | null): Brut {
  if (INTERNES.has(cle)) return reglagesPoste()
  if (valeur === null) db().prepare(`DELETE FROM app_setting WHERE key = ?`).run(cle)
  else
    db()
      .prepare(
        `INSERT INTO app_setting (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      )
      .run(cle, valeur)
  return reglagesPoste()
}
