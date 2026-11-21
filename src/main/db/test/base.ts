/**
 * Une base d'essai, neuve à chaque test, et de quoi la remplir en une ligne.
 *
 * Electron n'est pas là : on n'en garde que ce que la base touche — le
 * dossier des données, et les fenêtres à prévenir quand Ctrl+Z change.
 */
import { vi } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type Database from 'better-sqlite3'

vi.mock('electron', () => ({
  app: { getPath: () => tmpdir() },
  BrowserWindow: { getAllWindows: () => [] }
}))

import { activeCampaignId, closeDb, getDb, openDbAt } from '../index'

export function ouvrirBaseEssai(): Database.Database {
  const dossier = mkdtempSync(join(tmpdir(), 'edm-essai-'))
  return openDbAt(join(dossier, 'projet.db'), 'Essai')
}

export function fermerBaseEssai(): void {
  closeDb()
}

/** Une séance de plus, rangée en bas de la liste, sans l'activer. */
export function seance(label: string): number {
  const db = getDb()
  const cid = activeCampaignId()
  const m = db.prepare(`SELECT MAX(ord) AS m FROM game_session WHERE campaign_id = ?`).get(cid) as {
    m: number | null
  }
  return Number(
    db
      .prepare(`INSERT INTO game_session (campaign_id, label, active, ord) VALUES (?, ?, 0, ?)`)
      .run(cid, label, (m.m ?? -1) + 1).lastInsertRowid
  )
}

export function activer(sid: number): void {
  const db = getDb()
  db.prepare(`UPDATE game_session SET active = 0 WHERE campaign_id = ?`).run(activeCampaignId())
  db.prepare(`UPDATE game_session SET active = 1 WHERE id = ?`).run(sid)
}

function gabarit(): number {
  return (getDb().prepare(`SELECT id FROM sheet_template ORDER BY id LIMIT 1`).get() as { id: number }).id
}

export function pj(nom: string): number {
  return Number(
    getDb()
      .prepare(`INSERT INTO character (campaign_id, template_id, name, data, kind) VALUES (?, ?, ?, '{}', 'pj')`)
      .run(activeCampaignId(), gabarit(), nom).lastInsertRowid
  )
}

export function pnj(nom: string, sid: number): number {
  return Number(
    getDb()
      .prepare(
        `INSERT INTO character (campaign_id, template_id, name, data, kind, session_id) VALUES (?, ?, ?, '{}', 'pnj', ?)`
      )
      .run(activeCampaignId(), gabarit(), nom, sid).lastInsertRowid
  )
}

export function lieu(nom: string, sid: number): number {
  return Number(
    getDb()
      .prepare(`INSERT INTO place (campaign_id, name, session_id) VALUES (?, ?, ?)`)
      .run(activeCampaignId(), nom, sid).lastInsertRowid
  )
}

export function famille(sid: number, nom: string): number {
  return Number(
    getDb()
      .prepare(`INSERT INTO objet_famille (campaign_id, session_id, nom) VALUES (?, ?, ?)`)
      .run(activeCampaignId(), sid, nom).lastInsertRowid
  )
}

export function objet(sid: number, nom: string, familleId: number | null = null): number {
  return Number(
    getDb()
      .prepare(`INSERT INTO objet (campaign_id, session_id, nom, famille_id) VALUES (?, ?, ?, ?)`)
      .run(activeCampaignId(), sid, nom, familleId).lastInsertRowid
  )
}

export function inventaire(sid: number, nom: string): number {
  return Number(
    getDb()
      .prepare(`INSERT INTO inventaire (campaign_id, session_id, nom) VALUES (?, ?, ?)`)
      .run(activeCampaignId(), sid, nom).lastInsertRowid
  )
}

type Port = 'pj' | 'inventaire' | 'lieu' | 'corbeille'
interface Ou {
  port: Port
  characterId?: number
  inventaireId?: number
  placeId?: number
  qte?: number
  etat?: string
}

/** Un exemplaire, et d'où il part (par défaut : là où il est). */
export function placer(objetId: number, sid: number, ou: Ou & { init?: Ou }): number {
  const init = ou.init ?? ou
  return Number(
    getDb()
      .prepare(
        `INSERT INTO objet_placement
           (objet_id, session_id, port, character_id, inventaire_id, place_id, qte, etat,
            init_port, init_character_id, init_inventaire_id, init_place_id, init_etat)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        objetId,
        sid,
        ou.port,
        ou.characterId ?? null,
        ou.inventaireId ?? null,
        ou.placeId ?? null,
        ou.qte ?? 1,
        ou.etat ?? 'trouve',
        init.port,
        init.characterId ?? null,
        init.inventaireId ?? null,
        init.placeId ?? null,
        init.etat ?? ou.etat ?? 'trouve'
      ).lastInsertRowid
  )
}

/** Un fichier de la bibliothèque, pour la pochette. */
export function fichier(titre: string): number {
  return Number(
    getDb()
      .prepare(`INSERT INTO item (campaign_id, kind, title) VALUES (?, 'image', ?)`)
      .run(activeCampaignId(), titre).lastInsertRowid
  )
}

export function onglet(sid: number, nom: string): number {
  return Number(
    getDb()
      .prepare(`INSERT INTO pochette_onglet (campaign_id, session_id, name) VALUES (?, ?, ?)`)
      .run(activeCampaignId(), sid, nom).lastInsertRowid
  )
}

export function doc(sid: number, itemId: number, o: { ongletId?: number; visible?: boolean } = {}): number {
  return Number(
    getDb()
      .prepare(
        `INSERT INTO pochette (campaign_id, session_id, item_id, onglet_id, visible) VALUES (?, ?, ?, ?, ?)`
      )
      .run(activeCampaignId(), sid, itemId, o.ongletId ?? null, o.visible ? 1 : 0).lastInsertRowid
  )
}

export function lu(pochetteId: number, playerId: number): void {
  getDb().prepare(`INSERT INTO pochette_lu (pochette_id, player_id) VALUES (?, ?)`).run(pochetteId, playerId)
}

export function joueur(nom: string): number {
  return Number(
    getDb()
      .prepare(`INSERT INTO player (campaign_id, uid, name) VALUES (?, ?, ?)`)
      .run(activeCampaignId(), 'uid-' + nom, nom).lastInsertRowid
  )
}

export function compter(sql: string, ...params: unknown[]): number {
  return (getDb().prepare(sql).get(...params) as { n: number }).n
}
