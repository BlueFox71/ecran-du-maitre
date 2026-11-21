/**
 * Importer depuis une séance précédente.
 *
 * Une séance neuve part vide ; le MJ y reprend ce qu'il veut d'une autre —
 * l'équipement de chasseur de fantômes, pas les photos des habitants d'avant.
 * Tout ce qui arrive est **copié** : le retoucher ici ne touche pas là-bas.
 *
 * Un objet arrive là d'où il partait au début de la séance d'origine, s'il
 * partait d'un inventaire (l'inventaire est copié avec lui). Parti d'un
 * personnage ou d'un lieu, il arrive en réserve : les mains des joueurs et
 * les lieux de la nouvelle séance ne sont pas ceux d'avant.
 */
import { getDb } from '../index'
import { fixerInitial } from './objets'
import { copierDoc, copierInventaire, copierObjet, nouvelleCorrespondance } from './copieSeance'
import type { ImportBilan, ImportChoix, ImportFamille, ImportOnglet, ImportSource } from '@shared/types'

/** Ce que la séance `srcId` a à offrir, rangé comme on le choisit. */
export function sourceImport(srcId: number): ImportSource {
  const db = getDb()
  const familles: ImportFamille[] = (
    db.prepare(`SELECT id, nom FROM objet_famille WHERE session_id = ? ORDER BY ord, id`).all(srcId) as {
      id: number
      nom: string
    }[]
  ).map((f) => ({ id: f.id, nom: f.nom, objets: [] }))
  const sans: ImportFamille = { id: null, nom: 'Sans famille', objets: [] }
  for (const o of db
    .prepare(
      `SELECT o.id, o.nom, o.image_item_id AS imageItemId, o.famille_id AS f, f.teinte
         FROM objet o LEFT JOIN objet_famille f ON f.id = o.famille_id AND f.session_id = o.session_id
        WHERE o.session_id = ? ORDER BY o.nom COLLATE NOCASE, o.id`
    )
    .all(srcId) as { id: number; nom: string; imageItemId: number | null; f: number | null; teinte: string | null }[]) {
    const ou = familles.find((x) => x.id === o.f) ?? sans
    ou.objets.push({ id: o.id, nom: o.nom, imageItemId: o.imageItemId, teinte: o.teinte ?? null })
  }

  const onglets: ImportOnglet[] = (
    db.prepare(`SELECT id, name FROM pochette_onglet WHERE session_id = ? ORDER BY ord, id`).all(srcId) as {
      id: number
      name: string
    }[]
  ).map((o) => ({ id: o.id, nom: o.name, docs: [] }))
  const pile: ImportOnglet = { id: null, nom: 'Pochette', docs: [] }
  /* Les images d'un inventaire passé à la pochette suivent l'inventaire : on
     ne les offre pas seules. */
  for (const d of db
    .prepare(
      `SELECT p.id, p.item_id AS itemId, p.player_id AS playerId, p.onglet_id AS o, i.title AS titre
         FROM pochette p JOIN item i ON i.id = p.item_id
        WHERE p.session_id = ? AND p.inventaire_id IS NULL ORDER BY p.ord, p.id`
    )
    .all(srcId) as { id: number; itemId: number; playerId: number | null; o: number | null; titre: string }[]) {
    const ou = onglets.find((x) => x.id === d.o) ?? pile
    ou.docs.push({ id: d.id, itemId: d.itemId, titre: d.titre, playerId: d.playerId })
  }

  return {
    familles: [...familles, sans].filter((f) => f.objets.length > 0),
    onglets: [...onglets, pile].filter((o) => o.docs.length > 0)
  }
}

/** Copier dans `dstId` ce qui est coché dans `srcId`. Une seule transaction. */
export function importer(srcId: number, dstId: number, choix: ImportChoix): ImportBilan {
  if (srcId === dstId) throw new Error('Choisissez une autre séance')
  const db = getDb()
  const bilan: ImportBilan = { objets: 0, documents: 0, ignores: 0 }
  db.transaction(() => {
    const c = nouvelleCorrespondance()
    for (const objetId of choix.objetIds) {
      const o = db.prepare(`SELECT 1 FROM objet WHERE id = ? AND session_id = ?`).get(objetId, srcId)
      if (!o) continue
      /* Chaque import est une copie neuve, même d'un objet déjà importé. */
      c.objets.delete(objetId)
      const copie = copierObjet(objetId, dstId, c)
      bilan.objets++
      for (const p of db
        .prepare(
          `SELECT COALESCE(init_port, port) AS port,
                  CASE WHEN init_port IS NULL THEN inventaire_id ELSE init_inventaire_id END AS inv,
                  COALESCE(init_etat, etat) AS etat, qte, ord
             FROM objet_placement WHERE objet_id = ? AND session_id = ?`
        )
        .all(objetId, srcId) as { port: string; inv: number | null; etat: string; qte: number; ord: number }[]) {
        if (p.port !== 'inventaire' || p.inv == null) continue
        const inv = copierInventaire(p.inv, dstId, c, { enPochette: false })
        const id = Number(
          db
            .prepare(
              `INSERT INTO objet_placement (objet_id, session_id, port, inventaire_id, qte, etat, ord)
               VALUES (?, ?, 'inventaire', ?, ?, ?, ?)`
            )
            .run(copie, dstId, inv, p.qte, p.etat, p.ord).lastInsertRowid
        )
        fixerInitial(id)
      }
    }
    for (const docId of choix.docIds) {
      const d = db.prepare(`SELECT 1 FROM pochette WHERE id = ? AND session_id = ?`).get(docId, srcId)
      if (!d) continue
      if (copierDoc(docId, dstId, c, 'depart') == null) bilan.ignores++
      else bilan.documents++
    }
  })()
  return bilan
}
