import { randomUUID } from 'node:crypto'
import { activeCampaignId, getDb } from '../index'
import type { MotSecret } from '@shared/types'

/**
 * Les mots secrets : ce que le MJ glisse à un joueur, ou à quelques-uns.
 *
 * Le geste est celui de la Pochette, en plus court — un texte au lieu d'un
 * fichier. Deux façons de le donner :
 *
 *  — **gardé** : écrit pendant la préparation, il attend sur son moment et
 *    part d'un clic quand la scène y arrive ;
 *  — **tout de suite** : écrit en pleine partie, il part en même temps.
 *
 * Écrit pour plusieurs joueurs, il fait un exemplaire chacun — chacun le lit
 * à son heure —, réunis par un même `lot`. Le MJ les manie d'un seul geste.
 *
 * Une règle tient la discrétion : un téléphone n'apprend jamais l'existence
 * d'un mot qui n'est pas à lui, ni d'un mot encore gardé. Le filtre est ici,
 * dans les données (`motsDe`), pas dans l'interface du téléphone.
 */

type Ligne = {
  id: number
  lot: string
  beat_id: number | null
  player_id: number
  player_name: string
  character_name: string | null
  player_color: string | null
  texte: string
  created_at: string
  envoye_at: string | null
  lu_at: string | null
  vibre: number
}

const SELECT = `
  SELECT m.id, m.lot, m.beat_id, m.player_id, m.texte, m.created_at, m.envoye_at, m.lu_at, m.vibre,
         p.name AS player_name, p.color AS player_color,
         ch.name AS character_name
    FROM mot m
    JOIN player p ON p.id = m.player_id
    LEFT JOIN character ch ON ch.id = p.character_id
   WHERE m.campaign_id = ?`

const versMot = (r: Ligne): MotSecret => ({
  id: r.id,
  lot: r.lot,
  beatId: r.beat_id,
  playerId: r.player_id,
  playerName: r.player_name,
  characterName: r.character_name,
  playerColor: r.player_color,
  texte: r.texte,
  createdAt: r.created_at,
  envoyeA: r.envoye_at,
  luA: r.lu_at,
  vibre: r.vibre === 1
})

/** Tous les mots de la campagne, dans l'ordre où ils ont été écrits. */
export function listMots(): MotSecret[] {
  return (getDb().prepare(`${SELECT} ORDER BY m.id`).all(activeCampaignId()) as Ligne[]).map(versMot)
}

/** Poser un exemplaire par joueur, sous le même lot. */
function poser(
  lot: string,
  playerIds: number[],
  texte: string,
  beatId: number | null,
  envoyer: boolean,
  vibre: boolean
): void {
  /* Le joueur doit être de cette campagne : on part de sa ligne, pas du numéro. */
  const ins = getDb().prepare(
    `INSERT INTO mot (campaign_id, lot, beat_id, player_id, texte, envoye_at, vibre)
     SELECT campaign_id, ?, ?, id, ?, CASE WHEN ? THEN datetime('now') END, ?
       FROM player WHERE id = ? AND campaign_id = ?`
  )
  for (const p of new Set(playerIds))
    ins.run(lot, beatId, texte, envoyer ? 1 : 0, vibre ? 1 : 0, p, activeCampaignId())
}

/** Écrire un mot, pour un joueur ou plusieurs. `envoyer` faux : il est gardé sur son moment. */
export function ecrire(
  playerIds: number[],
  texte: string,
  beatId: number | null,
  envoyer: boolean,
  vibre: boolean
): void {
  const t = texte.trim()
  if (!t || !playerIds.length) return
  getDb().transaction(() => poser(randomUUID(), playerIds, t, beatId, envoyer, vibre))()
}

/**
 * Retoucher un mot gardé — son texte, ses destinataires, sa vibration. Un mot
 * parti ne se réécrit pas : le joueur l'a peut-être lu.
 *
 * Gardé, il n'a encore ni envoi ni lecture à perdre : on refait ses
 * exemplaires plutôt que de les recoudre un à un.
 */
export function reecrire(lot: string, texte: string, playerIds: number[], vibre: boolean): void {
  const t = texte.trim()
  if (!t || !playerIds.length) return
  const db = getDb()
  const c = activeCampaignId()
  const garde = db
    .prepare(`SELECT beat_id FROM mot WHERE lot = ? AND campaign_id = ? AND envoye_at IS NULL LIMIT 1`)
    .get(lot, c) as { beat_id: number | null } | undefined
  if (!garde) return
  db.transaction(() => {
    db.prepare(`DELETE FROM mot WHERE lot = ? AND campaign_id = ? AND envoye_at IS NULL`).run(lot, c)
    poser(lot, playerIds, t, garde.beat_id, false, vibre)
  })()
}

/** Faire partir un mot gardé, à tous ses destinataires d'un coup. */
export function envoyer(lot: string): void {
  getDb()
    .prepare(
      `UPDATE mot SET envoye_at = datetime('now')
        WHERE lot = ? AND campaign_id = ? AND envoye_at IS NULL`
    )
    .run(lot, activeCampaignId())
}

/** L'effacer — gardé, il ne partira pas ; parti, il disparaît des téléphones. */
export function effacer(lot: string): void {
  getDb().prepare(`DELETE FROM mot WHERE lot = ? AND campaign_id = ?`).run(lot, activeCampaignId())
}

/**
 * « Réinitialiser la séance » : tous les mots partis quittent les téléphones
 * et redeviennent gardés, sur leur moment, non lus — prêts à repartir quand
 * on rejoue la scène. Rend le nombre d'exemplaires repris.
 */
export function reprendreTout(): number {
  return getDb()
    .prepare(`UPDATE mot SET envoye_at = NULL, lu_at = NULL WHERE campaign_id = ? AND envoye_at IS NOT NULL`)
    .run(activeCampaignId()).changes
}

/* ============================================================
   Ce que le téléphone lit, et ce qu'il en dit
   ============================================================ */

/** Les mots partis vers ce joueur, le plus récent d'abord. Jamais ceux d'un autre. */
export function motsDe(playerId: number): MotSecret[] {
  return (
    getDb()
      .prepare(`${SELECT} AND m.player_id = ? AND m.envoye_at IS NOT NULL ORDER BY m.envoye_at DESC, m.id DESC`)
      .all(activeCampaignId(), playerId) as Ligne[]
  ).map(versMot)
}

/**
 * Il l'a ouvert. On retient le premier regard, et seulement pour un mot qui
 * lui a bien été envoyé : le téléphone donne un identifiant, rien n'oblige à
 * le croire. Rend vrai si quelque chose a changé.
 */
export function marquerLu(id: number, playerId: number): boolean {
  return (
    getDb()
      .prepare(
        `UPDATE mot SET lu_at = datetime('now')
          WHERE id = ? AND campaign_id = ? AND player_id = ?
            AND envoye_at IS NOT NULL AND lu_at IS NULL`
      )
      .run(id, activeCampaignId(), playerId).changes > 0
  )
}
