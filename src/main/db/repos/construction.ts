/**
 * La construction d'un lieu bâti, et le calque qu'elle impose.
 *
 * Comme les murs, rien d'ici ne rejoint l'état de diffusion : c'est l'image
 * enregistrée qui montre la maison aux joueurs, jamais ces lignes.
 */
import { getDb } from '../index'
import { listMurs } from './murs'
import { listOuvertures } from './ouvertures'
import { lireConstruction, type CalqueDerive, type Construction } from '@shared/atelier'
import { planDeSynchro } from '@shared/synchro'
import type { PointMur } from '@shared/types'

export function getConstruction(placeId: number): Construction | null {
  const r = getDb().prepare(`SELECT data FROM construction WHERE place_id = ?`).get(placeId) as
    | { data: string }
    | undefined
  return r ? lireConstruction(r.data) : null
}

export function setConstruction(placeId: number, c: Construction): void {
  getDb()
    .prepare(
      `INSERT INTO construction (place_id, data, maj) VALUES (?, ?, datetime('now'))
       ON CONFLICT(place_id) DO UPDATE SET data = excluded.data, maj = excluded.maj`
    )
    .run(placeId, JSON.stringify(c))
}

const clamp = (v: number): number => Math.min(1, Math.max(0, v))
const enJson = (pts: PointMur[]): string =>
  JSON.stringify(pts.map(([x, y]) => [Number(clamp(x).toFixed(5)), Number(clamp(y).toFixed(5))]))

/**
 * Le calque du lieu rejoint ce que la construction dérive.
 *
 * Tout se fait d'un bloc : un calque à moitié écrit laisserait un pion
 * traverser un mur pas encore reposé. Une ouverture modifiée ne change que
 * son mur, sa nature, sa place et sa largeur — jamais `ouverte`,
 * `verrouillee` ni son nom, qui sont l'état de la partie.
 */
export function synchroniserCalque(placeId: number, derive: CalqueDerive): void {
  const db = getDb()
  db.transaction(() => {
    const plan = planDeSynchro(derive, listMurs(placeId), listOuvertures(placeId))

    for (const id of plan.ouvertures.retirer) db.prepare(`DELETE FROM ouverture WHERE id = ?`).run(id)
    for (const id of plan.murs.retirer) db.prepare(`DELETE FROM mur WHERE id = ?`).run(id)

    for (const { id, d } of plan.murs.modifier)
      db.prepare(`UPDATE mur SET nature = ?, pts = ? WHERE id = ?`).run(d.nature, enJson(d.pts), id)

    let ord =
      ((db.prepare(`SELECT MAX(ord) AS m FROM mur WHERE place_id = ?`).get(placeId) as any)?.m ?? -1) + 1
    for (const d of plan.murs.ajouter)
      db.prepare(
        `INSERT INTO mur (place_id, nature, pts, ord, atelier_id) VALUES (?, ?, ?, ?, ?)`
      ).run(placeId, d.nature, enJson(d.pts), ord++, d.atelierId)

    /* Les murs sont posés : on retrouve chacun par son id d'atelier. */
    const murDe = new Map<string, number>()
    for (const r of db
      .prepare(`SELECT id, atelier_id AS a FROM mur WHERE place_id = ? AND atelier_id IS NOT NULL`)
      .all(placeId) as { id: number; a: string }[])
      murDe.set(r.a, r.id)

    for (const { id, d } of plan.ouvertures.modifier) {
      const murId = murDe.get(d.murAtelierId)
      if (murId == null) continue
      db.prepare(`UPDATE ouverture SET mur_id = ?, nature = ?, d = ?, largeur = ? WHERE id = ?`).run(
        murId,
        d.nature,
        clamp(d.d),
        d.largeur,
        id
      )
    }
    for (const d of plan.ouvertures.ajouter) {
      const murId = murDe.get(d.murAtelierId)
      if (murId == null) continue
      db.prepare(
        `INSERT INTO ouverture (mur_id, nature, d, largeur, ouverte, verrouillee, atelier_id)
         VALUES (?, ?, ?, ?, 0, 0, ?)`
      ).run(murId, d.nature, clamp(d.d), d.largeur, d.atelierId)
    }
  })()
}
