/**
 * La migration 96 : séparer ce que les séances partageaient.
 *
 * Avant elle, fiches d'objets, familles, inventaires et pochette valaient pour
 * toute la campagne. Après, chaque séance a les siens. Rien ne doit se
 * perdre : chaque séance reçoit une copie de ce qu'elle utilise, et la
 * pochette — dont rien ne dit à quelle séance appartient chaque document —
 * est recopiée dans toutes.
 *
 * La « séance de repli » est l'active, sinon la dernière : elle reçoit ce
 * qu'aucune séance n'utilise. Une campagne sans séance garde tout en commun ;
 * sa première séance le recueillera.
 */
import type Database from 'better-sqlite3'
import {
  copierDoc,
  copierOnglet,
  nouvelleCorrespondance,
  rattacherASeance,
  type Correspondance
} from './repos/copieSeance'

export function repartirParSeance(db: Database.Database): void {
  const campagnes = db.prepare(`SELECT id FROM campaign`).all() as { id: number }[]
  for (const { id: cid } of campagnes) {
    const seances = db
      .prepare(`SELECT id, active FROM game_session WHERE campaign_id = ? ORDER BY ord, id`)
      .all(cid) as { id: number; active: number }[]
    if (seances.length === 0) continue
    const repli = (seances.find((s) => s.active) ?? seances[seances.length - 1]).id

    /* Un exemplaire d'avant le cloisonnement des séances n'en a pas : il va
       au repli, comme tout ce qui n'a pas de place. */
    db.prepare(
      `UPDATE objet_placement SET session_id = ?
        WHERE session_id IS NULL AND objet_id IN (SELECT id FROM objet WHERE campaign_id = ?)`
    ).run(repli, cid)

    /* L'original va à la dernière séance qui s'en sert ; les autres en
       recevront une copie. */
    const derniere = (cond: string): string => `(
      SELECT p.session_id FROM objet_placement p JOIN game_session g ON g.id = p.session_id
       WHERE ${cond} ORDER BY g.ord DESC, g.id DESC LIMIT 1)`
    db.prepare(
      `UPDATE objet SET session_id = COALESCE(${derniere('p.objet_id = objet.id')}, ?) WHERE campaign_id = ?`
    ).run(repli, cid)
    db.prepare(
      `UPDATE inventaire SET session_id = COALESCE(${derniere(
        '(p.inventaire_id = inventaire.id OR p.init_inventaire_id = inventaire.id)'
      )}, ?) WHERE campaign_id = ?`
    ).run(repli, cid)
    db.prepare(`UPDATE objet_famille SET session_id = ? WHERE campaign_id = ?`).run(repli, cid)
    db.prepare(`UPDATE pochette_onglet SET session_id = ? WHERE campaign_id = ?`).run(repli, cid)
    db.prepare(`UPDATE pochette SET session_id = ? WHERE campaign_id = ?`).run(repli, cid)

    const parSeance = new Map<number, Correspondance>()
    for (const s of seances) parSeance.set(s.id, rattacherASeance(s.id))

    /* Ce que la séance possède déjà en propre se correspond à lui-même. */
    for (const s of seances) {
      const c = parSeance.get(s.id)!
      for (const i of db.prepare(`SELECT id FROM inventaire WHERE session_id = ?`).all(s.id) as { id: number }[])
        if (!c.inventaires.has(i.id)) c.inventaires.set(i.id, i.id)
    }
    const repliC = parSeance.get(repli)!
    for (const o of db.prepare(`SELECT id FROM pochette_onglet WHERE session_id = ?`).all(repli) as { id: number }[])
      repliC.onglets.set(o.id, o.id)

    const onglets = db
      .prepare(`SELECT id FROM pochette_onglet WHERE session_id = ? ORDER BY ord, id`)
      .all(repli) as { id: number }[]
    const docs = db
      .prepare(`SELECT id, inventaire_id AS inv FROM pochette WHERE session_id = ? ORDER BY ord, id`)
      .all(repli) as { id: number; inv: number | null }[]

    for (const s of seances) {
      if (s.id === repli) continue
      const c = parSeance.get(s.id)!
      for (const o of onglets) copierOnglet(o.id, s.id, c)
      for (const d of docs) copierDoc(d.id, s.id, c, 'actuel')
    }

    /* Au repli, les documents d'un inventaire suivent sa copie ; ceux d'un
       inventaire qu'il n'a pas s'en vont — les autres séances les gardent. */
    for (const d of docs) {
      if (d.inv == null) continue
      const ici = repliC.inventaires.get(d.inv)
      if (ici == null) db.prepare(`DELETE FROM pochette WHERE id = ?`).run(d.id)
      else db.prepare(`UPDATE pochette SET inventaire_id = ? WHERE id = ?`).run(ici, d.id)
    }

    /* L'onglet d'un inventaire passé à la pochette : celui de sa séance. */
    for (const s of seances) {
      const c = parSeance.get(s.id)!
      for (const i of db
        .prepare(
          `SELECT i.id, i.pochette_onglet_id AS o FROM inventaire i JOIN pochette_onglet o ON o.id = i.pochette_onglet_id
            WHERE i.session_id = ? AND o.session_id IS NOT ?`
        )
        .all(s.id, s.id) as { id: number; o: number }[]) {
        const o = c.onglets.get(i.o) ?? copierOnglet(i.o, s.id, c)
        if (o !== i.o) db.prepare(`UPDATE inventaire SET pochette_onglet_id = ? WHERE id = ?`).run(o, i.id)
      }
    }

    /* Une famille masquée à partir d'une séance n'a pas sa place dans
       celle-ci ni dans les suivantes : ses objets y restent, sans famille. */
    const masquees = db
      .prepare(
        `SELECT f.id FROM objet_famille f
           JOIN game_session s ON s.id = f.session_id
           JOIN game_session m ON m.id = f.masquee_depuis
          WHERE f.campaign_id = ? AND (s.ord > m.ord OR (s.ord = m.ord AND s.id >= m.id))`
      )
      .all(cid) as { id: number }[]
    for (const f of masquees) {
      db.prepare(`UPDATE objet SET famille_id = NULL WHERE famille_id = ?`).run(f.id)
      db.prepare(`DELETE FROM objet_famille WHERE id = ?`).run(f.id)
    }
  }
  /* Chaque séance a désormais ses familles : le masquage n'a plus d'objet. */
  db.exec(`UPDATE objet_famille SET masquee_depuis = NULL`)
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_pochette_unique ON pochette(session_id, item_id, player_key)`)
}
