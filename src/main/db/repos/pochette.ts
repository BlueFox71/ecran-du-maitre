import { activeCampaignId, getDb } from '../index'
import { getItem } from './library'
import type { Item, PochetteDoc, PochetteOnglet } from '@shared/types'

/**
 * La pochette : ce que les joueurs ont en main sur leur téléphone.
 *
 * Le principe est celui des annexes — le document reste un fichier de la
 * campagne, on n'enregistre ici que le geste de l'avoir donné. Trois choses
 * s'y ajoutent, et ce sont elles qui font le module :
 *
 *  — **à qui.** `player_id` nul veut dire « toute la table ». Nommé, le
 *    document n'est qu'à cette personne : la lettre que seul l'archiviste a
 *    trouvée.
 *  — **où c'est rangé.** `onglet_id` nul veut dire « dans la pile », l'état
 *    d'une pochette où le MJ n'a créé aucun onglet.
 *  — **qui l'a ouvert.** Le téléphone le dit en l'affichant ; c'est la seule
 *    chose que le MJ ne peut pas voir en se penchant sur la table.
 *
 * Une règle tient le rangement : **aucun document ne doit survivre en se
 * cachant derrière un filtre.** Créer le premier onglet y verse donc tout ce
 * qui traînait dans la pile, et retirer un onglet reverse ses documents dans
 * un autre — jamais on n'efface le document du joueur en réorganisant.
 */

/* ============================================================
   Les onglets
   ============================================================ */

export function listOnglets(): PochetteOnglet[] {
  return getDb()
    .prepare(
      `SELECT o.id, o.name, o.ord,
              (SELECT COUNT(*) FROM pochette p WHERE p.onglet_id = o.id) AS count
         FROM pochette_onglet o
        WHERE o.campaign_id = ?
        ORDER BY o.ord, o.id`
    )
    .all(activeCampaignId()) as PochetteOnglet[]
}

/**
 * Créer un onglet. Le premier ramasse la pile : sans quoi les documents déjà
 * donnés resteraient sous un filtre qu'aucun onglet ne montre plus.
 */
export function createOnglet(name: string): PochetteOnglet[] {
  const db = getDb()
  const c = activeCampaignId()
  const premier = listOnglets().length === 0
  db.transaction(() => {
    const max = db
      .prepare(`SELECT COALESCE(MAX(ord), -1) AS m FROM pochette_onglet WHERE campaign_id = ?`)
      .get(c) as { m: number }
    const r = db
      .prepare(`INSERT INTO pochette_onglet (campaign_id, name, ord) VALUES (?, ?, ?)`)
      .run(c, name.trim() || 'Sans titre', max.m + 1)
    if (premier) {
      db.prepare(`UPDATE pochette SET onglet_id = ? WHERE campaign_id = ? AND onglet_id IS NULL`)
        .run(r.lastInsertRowid, c)
    }
  })()
  return listOnglets()
}

export function renameOnglet(id: number, name: string): PochetteOnglet[] {
  getDb()
    .prepare(`UPDATE pochette_onglet SET name = ? WHERE id = ? AND campaign_id = ?`)
    .run(name.trim() || 'Sans titre', id, activeCampaignId())
  return listOnglets()
}

/**
 * Retirer un onglet sans rien retirer aux joueurs.
 *
 * Ses documents rejoignent l'onglet qui le précède — ou celui qui le suit s'il
 * était le premier. S'il était le dernier, ils retournent dans la pile, et la
 * pochette redevient ce qu'elle était avant qu'on la range : une seule pile,
 * sans barre d'onglets, ni ici ni sur les téléphones.
 */
export function removeOnglet(id: number): PochetteOnglet[] {
  const db = getDb()
  const c = activeCampaignId()
  const tous = listOnglets()
  const i = tous.findIndex((o) => o.id === id)
  if (i < 0) return tous
  const voisin = tous[i - 1] ?? tous[i + 1] ?? null

  db.transaction(() => {
    db.prepare(`UPDATE pochette SET onglet_id = ? WHERE campaign_id = ? AND onglet_id = ?`)
      .run(voisin?.id ?? null, c, id)
    db.prepare(`DELETE FROM pochette_onglet WHERE id = ? AND campaign_id = ?`).run(id, c)
  })()
  return listOnglets()
}

export function reorderOnglets(ids: number[]): PochetteOnglet[] {
  const db = getDb()
  const c = activeCampaignId()
  const up = db.prepare(`UPDATE pochette_onglet SET ord = ? WHERE id = ? AND campaign_id = ?`)
  db.transaction(() => ids.forEach((id, n) => up.run(n, id, c)))()
  return listOnglets()
}

/* ============================================================
   Les documents
   ============================================================ */

type Ligne = {
  id: number
  item_id: number
  player_id: number | null
  player_name: string | null
  character_name: string | null
  player_color: string | null
  onglet_id: number | null
  onglet_name: string | null
  visible: number
  given_at: string
}

const SELECT = `
  SELECT d.id, d.item_id, d.player_id, d.onglet_id, d.visible, d.given_at,
         p.name  AS player_name, p.color AS player_color,
         ch.name AS character_name,
         o.name  AS onglet_name
    FROM pochette d
    LEFT JOIN player p ON p.id = d.player_id
    LEFT JOIN character ch ON ch.id = p.character_id
    LEFT JOIN pochette_onglet o ON o.id = d.onglet_id
   WHERE d.campaign_id = ?`

/**
 * Toute la pochette, rangée comme elle s'affiche : onglet par onglet, et dans
 * chacun le dernier donné en tête — on cherche plus souvent ce qu'on vient de
 * remettre que ce qu'on a remis il y a deux séances.
 */
export function listPochette(): PochetteDoc[] {
  const db = getDb()
  const rows = db
    .prepare(`${SELECT} ORDER BY COALESCE(o.ord, -1), d.given_at DESC, d.id DESC`)
    .all(activeCampaignId()) as Ligne[]

  const lus = db
    .prepare(
      `SELECT l.pochette_id, l.player_id
         FROM pochette_lu l JOIN pochette d ON d.id = l.pochette_id
        WHERE d.campaign_id = ?`
    )
    .all(activeCampaignId()) as { pochette_id: number; player_id: number }[]

  return rows
    .map((r) => {
      const item = getItem(r.item_id)
      return item ? toDoc(r, item, lus) : null
    })
    .filter((d): d is PochetteDoc => d !== null)
}

function toDoc(
  r: Ligne,
  item: Item,
  lus: { pochette_id: number; player_id: number }[]
): PochetteDoc {
  return {
    id: r.id,
    itemId: r.item_id,
    /* L'URL se pose côté IPC, comme partout : le dépôt ne connaît pas le
       protocole jdr://. */
    item: item as PochetteDoc['item'],
    playerId: r.player_id,
    playerName: r.player_name,
    characterName: r.character_name,
    playerColor: r.player_color,
    ongletId: r.onglet_id,
    ongletName: r.onglet_name,
    visible: r.visible === 1,
    givenAt: r.given_at,
    luPar: lus.filter((l) => l.pochette_id === r.id).map((l) => l.player_id)
  }
}

/**
 * Mettre un document dans la pochette — **caché**.
 *
 * Il entre en réserve : on le prépare pendant que les joueurs discutent, on le
 * montre quand ils le trouvent. C'est la manière de toute l'application, celle
 * de la Régie — un clic prépare, une bascule envoie.
 *
 * `playerId` nul le donne à toute la table. Donner deux fois la même chose au
 * même destinataire ne fait qu'une entrée — mais le donner à la table *et* en
 * confier une copie à quelqu'un restent deux gestes distincts, et deux lignes.
 *
 * Quand la pochette a des onglets, un document doit en avoir un : l'appelant
 * passe celui qui est ouvert. Sans onglet passé, il tombe dans le premier —
 * jamais dans un nulle-part que la barre ne montrerait plus.
 */
export function addDoc(itemId: number, playerId: number | null, ongletId: number | null): void {
  const db = getDb()
  const c = activeCampaignId()
  const onglets = listOnglets()
  const ou = onglets.length === 0 ? null : (onglets.find((o) => o.id === ongletId)?.id ?? onglets[0].id)

  const max = db
    .prepare(`SELECT COALESCE(MAX(ord), -1) AS m FROM pochette WHERE campaign_id = ?`)
    .get(c) as { m: number }

  db.prepare(
    `INSERT OR IGNORE INTO pochette (campaign_id, item_id, player_id, player_key, onglet_id, ord, visible)
     VALUES (?, ?, ?, ?, ?, ?, 0)`
  ).run(c, itemId, playerId, playerId ?? -1, ou, max.m + 1)
}

/** Le reprendre. Il disparaît des téléphones à la seconde. */
export function removeDoc(id: number): void {
  getDb().prepare(`DELETE FROM pochette WHERE id = ? AND campaign_id = ?`).run(id, activeCampaignId())
}

/** Le donner à quelqu'un d'autre, ou le rendre à toute la table (`null`). */
export function setDocPlayer(id: number, playerId: number | null): void {
  const db = getDb()
  const c = activeCampaignId()
  /* Le trio (document, joueur, campagne) est unique : si la même chose est
     déjà entre ces mains-là, on ne fabrique pas de doublon — on retire la
     ligne qu'on déplaçait, et celle qui existait reste. */
  const ligne = db
    .prepare(`SELECT item_id FROM pochette WHERE id = ? AND campaign_id = ?`)
    .get(id, c) as { item_id: number } | undefined
  if (!ligne) return

  const deja = db
    .prepare(
      `SELECT id FROM pochette WHERE campaign_id = ? AND item_id = ? AND player_key = ? AND id <> ?`
    )
    .get(c, ligne.item_id, playerId ?? -1, id) as { id: number } | undefined

  db.transaction(() => {
    if (deja) {
      db.prepare(`DELETE FROM pochette WHERE id = ?`).run(id)
      return
    }
    db.prepare(`UPDATE pochette SET player_id = ?, player_key = ? WHERE id = ? AND campaign_id = ?`)
      .run(playerId, playerId ?? -1, id, c)
    /* Il change de mains : ce que les précédents en avaient lu ne dit plus
       rien de celui qui le reçoit. */
    db.prepare(`DELETE FROM pochette_lu WHERE pochette_id = ?`).run(id)
  })()
}

/**
 * Le montrer aux joueurs, ou le remettre en réserve.
 *
 * Le cacher à nouveau efface ce qu'on savait de sa lecture : s'il ressort, ce
 * sera pour être découvert, et une pastille pleine mentirait sur ce que les
 * joueurs ont déjà sous les yeux.
 */
export function setDocVisible(id: number, visible: boolean): void {
  const db = getDb()
  const c = activeCampaignId()
  db.transaction(() => {
    db.prepare(`UPDATE pochette SET visible = ? WHERE id = ? AND campaign_id = ?`)
      .run(visible ? 1 : 0, id, c)
    if (!visible) db.prepare(`DELETE FROM pochette_lu WHERE pochette_id = ?`).run(id)
  })()
}

/** Le ranger ailleurs. */
export function setDocOnglet(id: number, ongletId: number | null): void {
  getDb()
    .prepare(`UPDATE pochette SET onglet_id = ? WHERE id = ? AND campaign_id = ?`)
    .run(ongletId, id, activeCampaignId())
}

/* ============================================================
   Ce que le téléphone lit, et ce qu'il en dit
   ============================================================ */

/**
 * La pochette d'un joueur : ce qui est à toute la table, et ce qui n'est qu'à
 * lui. Rien d'autre — un téléphone ne doit jamais apprendre l'existence de la
 * lettre que son voisin a reçue.
 */
export function pochetteDe(playerId: number): PochetteDoc[] {
  /* Ce qui est encore en réserve n'existe pas pour eux : le filtre est ici,
     dans les données, et non dans l'interface du téléphone — un document caché
     ne doit pas même voyager sur le réseau. */
  return listPochette().filter(
    (d) => d.visible && (d.playerId === null || d.playerId === playerId)
  )
}

/**
 * Il l'a ouvert. La ligne ne s'écrit qu'une fois — on retient le premier
 * regard, pas le dernier : « il l'a lu » ne se défait pas.
 */
export function marquerLu(pochetteId: number, playerId: number): void {
  const db = getDb()
  /* On ne prend note que d'un document que cette personne a bien le droit de
     voir : le téléphone envoie un identifiant, et rien n'oblige à le croire. */
  const ok = db
    .prepare(
      `SELECT 1 FROM pochette
        WHERE id = ? AND campaign_id = ? AND visible = 1
          AND (player_id IS NULL OR player_id = ?)`
    )
    .get(pochetteId, activeCampaignId(), playerId)
  if (!ok) return
  db.prepare(`INSERT OR IGNORE INTO pochette_lu (pochette_id, player_id) VALUES (?, ?)`)
    .run(pochetteId, playerId)
}
