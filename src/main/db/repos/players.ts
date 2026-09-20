/**
 * Les joueurs d'une campagne — les personnes autour de la table.
 *
 * Le carnet de l'application (carnet.ts) tient la liste des gens ; ce dépôt-ci
 * tient ceux qui sont inscrits à *cette* campagne, avec le personnage que
 * chacun mène. Le projet garde son propre nom et sa propre couleur pour chaque
 * joueur : ouvert ailleurs, il reste lisible sans le carnet.
 *
 * Deux reflets sont tenus à jour d'ici, et de nulle part ailleurs :
 *  - `character.player`, le nom du joueur affiché sur la fiche, dans le PDF et
 *    sur l'écran des joueurs ;
 *  - `character.color`, la couleur qui cercle son pion — celle du joueur, pour
 *    qu'on se reconnaisse d'une campagne à l'autre.
 */
import { randomUUID } from 'node:crypto'
import { activeCampaignId, getDb } from '../index'
import type { CampaignPlayer } from '@shared/types'

function toPlayer(r: any): CampaignPlayer {
  return { id: r.id, uid: r.uid, name: r.name, color: r.color, characterId: r.character_id }
}

export function listPlayers(): CampaignPlayer[] {
  return (
    getDb()
      .prepare(
        `SELECT id, uid, name, color, character_id FROM player
          WHERE campaign_id = ? ORDER BY ord, id`
      )
      .all(activeCampaignId()) as any[]
  ).map(toPlayer)
}

export function getPlayer(id: number): CampaignPlayer | null {
  const r = getDb().prepare(`SELECT id, uid, name, color, character_id FROM player WHERE id = ?`).get(id)
  return r ? toPlayer(r) : null
}

/** Le reflet sur la fiche : nom du joueur et sa couleur, ou rien du tout. */
function refleter(characterId: number | null, nom: string | null, couleur: string | null): void {
  if (characterId == null) return
  const db = getDb()
  if (nom === null) db.prepare(`UPDATE character SET player = NULL WHERE id = ?`).run(characterId)
  else
    db.prepare(`UPDATE character SET player = ?, color = COALESCE(?, color) WHERE id = ?`).run(
      nom,
      couleur,
      characterId
    )
}

/**
 * Inscrit une personne du carnet à la campagne. Deux inscriptions de la même
 * personne, c'est la même ligne : on met seulement son nom et sa couleur à jour.
 */
export function enrollPlayer(uid: string, name: string, color: string | null): CampaignPlayer {
  const db = getDb()
  const cid = activeCampaignId()
  const deja = db.prepare(`SELECT id FROM player WHERE campaign_id = ? AND uid = ?`).get(cid, uid) as
    | { id: number }
    | undefined

  if (deja) {
    db.prepare(`UPDATE player SET name = ?, color = ? WHERE id = ?`).run(name.trim(), color, deja.id)
    const p = getPlayer(deja.id)!
    refleter(p.characterId, p.name, p.color)
    return p
  }

  const ord =
    ((db.prepare(`SELECT MAX(ord) AS m FROM player WHERE campaign_id = ?`).get(cid) as any)?.m ?? -1) + 1
  const info = db
    .prepare(`INSERT INTO player (campaign_id, uid, name, color, ord) VALUES (?, ?, ?, ?, ?)`)
    .run(cid, uid, name.trim(), color, ord)
  return getPlayer(Number(info.lastInsertRowid))!
}

/** Une personne née dans la campagne ; l'appelant l'ajoute aussi au carnet. */
export function createPlayer(name: string, color: string | null): CampaignPlayer {
  return enrollPlayer(randomUUID(), name, color)
}

export function updatePlayer(
  id: number,
  patch: { name?: string; color?: string | null }
): CampaignPlayer | null {
  const cur = getPlayer(id)
  if (!cur) return null
  const nom = patch.name !== undefined ? patch.name.trim() || cur.name : cur.name
  const couleur = patch.color !== undefined ? patch.color : cur.color
  getDb().prepare(`UPDATE player SET name = ?, color = ? WHERE id = ?`).run(nom, couleur, id)
  refleter(cur.characterId, nom, couleur)
  return getPlayer(id)
}

/**
 * Donne un personnage à un joueur. Un personnage n'est mené que par une
 * personne : s'il était à quelqu'un d'autre, cet autre le lâche.
 */
export function setPlayerCharacter(id: number, characterId: number | null): CampaignPlayer | null {
  const db = getDb()
  const cur = getPlayer(id)
  if (!cur) return null

  /* Un PNJ n'est mené par personne : c'est le MJ qui le tient. La liste de
     choix ne les propose pas, et cette porte-ci les refuse aussi — donner un
     PNJ à un joueur le ferait entrer dans l'encart de la table par la bande. */
  if (characterId != null) {
    const nature = db.prepare(`SELECT kind FROM character WHERE id = ?`).get(characterId) as
      | { kind: string }
      | undefined
    if (nature?.kind === 'pnj') {
      throw new Error('Un PNJ est mené par le maître du jeu, pas par un joueur.')
    }
  }

  db.transaction(() => {
    if (characterId != null) {
      const autre = db
        .prepare(`SELECT id, character_id FROM player WHERE campaign_id = ? AND character_id = ? AND id <> ?`)
        .get(activeCampaignId(), characterId, id) as { id: number } | undefined
      if (autre) db.prepare(`UPDATE player SET character_id = NULL WHERE id = ?`).run(autre.id)
    }
    if (cur.characterId != null && cur.characterId !== characterId) refleter(cur.characterId, null, null)
    db.prepare(`UPDATE player SET character_id = ? WHERE id = ?`).run(characterId, id)
  })()

  refleter(characterId, cur.name, cur.color)
  return getPlayer(id)
}

/** Retire la personne de la campagne. Son personnage reste, sans joueur. */
export function removePlayer(id: number): void {
  const cur = getPlayer(id)
  if (!cur) return
  refleter(cur.characterId, null, null)
  getDb().prepare(`DELETE FROM player WHERE id = ?`).run(id)
}
