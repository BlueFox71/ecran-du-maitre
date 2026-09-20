/**
 * Les annotations d'un lieu — la clé de lecture de sa carte, pour le MJ seul.
 *
 * Ce dépôt est volontairement isolé de `display.ts` : rien de ce qu'il renvoie
 * ne rejoint l'état de diffusion, donc rien ne peut atteindre la fenêtre des
 * joueurs. Si un jour quelqu'un veut montrer une annotation à la table, il
 * devra le décider explicitement, pas l'obtenir par accident.
 */
import { getDb } from '../index'
import type { Annotation } from '@shared/types'

const SELECT = `
  SELECT id, place_id AS placeId, kind, num, texte, color, x, y
    FROM annotation`

function toAnnotation(r: any): Annotation {
  return {
    id: r.id,
    placeId: r.placeId,
    kind: r.kind === 'texte' ? 'texte' : 'repere',
    num: r.num,
    texte: r.texte ?? '',
    color: r.color,
    x: r.x,
    y: r.y
  }
}

export function listAnnotations(placeId: number | null): Annotation[] {
  if (placeId == null) return []
  return (
    getDb().prepare(`${SELECT} WHERE place_id = ? ORDER BY ord, id`).all(placeId) as any[]
  ).map(toAnnotation)
}

const clamp = (v: number): number => Math.min(0.99, Math.max(0.01, v))

/** Le prochain numéro libre du lieu : on compte les repères, pas les textes. */
function prochainNumero(placeId: number): number {
  const r = getDb()
    .prepare(`SELECT MAX(num) AS m FROM annotation WHERE place_id = ? AND kind = 'repere'`)
    .get(placeId) as { m: number | null } | undefined
  return (r?.m ?? 0) + 1
}

export function addAnnotation(input: {
  placeId: number
  kind: 'repere' | 'texte'
  texte?: string
  color?: string | null
  x: number
  y: number
}): Annotation {
  const db = getDb()
  const ord =
    ((db.prepare(`SELECT MAX(ord) AS m FROM annotation WHERE place_id = ?`).get(input.placeId) as any)
      ?.m ?? -1) + 1
  const info = db
    .prepare(
      `INSERT INTO annotation (place_id, kind, num, texte, color, x, y, ord)
       VALUES (@placeId, @kind, @num, @texte, @color, @x, @y, @ord)`
    )
    .run({
      placeId: input.placeId,
      kind: input.kind,
      num: input.kind === 'repere' ? prochainNumero(input.placeId) : null,
      texte: input.texte ?? '',
      color: input.color ?? null,
      x: clamp(input.x),
      y: clamp(input.y),
      ord
    })
  return getAnnotation(Number(info.lastInsertRowid))!
}

export function getAnnotation(id: number): Annotation | null {
  const r = getDb().prepare(`${SELECT} WHERE id = ?`).get(id)
  return r ? toAnnotation(r) : null
}

export function updateAnnotation(
  id: number,
  patch: { texte?: string; color?: string | null }
): Annotation | null {
  const cur = getAnnotation(id)
  if (!cur) return null
  getDb()
    .prepare(`UPDATE annotation SET texte = @texte, color = @color WHERE id = @id`)
    .run({
      id,
      texte: patch.texte !== undefined ? patch.texte : cur.texte,
      color: patch.color !== undefined ? patch.color : cur.color
    })
  return getAnnotation(id)
}

export function moveAnnotation(id: number, x: number, y: number): Annotation | null {
  getDb().prepare(`UPDATE annotation SET x = ?, y = ? WHERE id = ?`).run(clamp(x), clamp(y), id)
  return getAnnotation(id)
}

/**
 * Retire une annotation et **renumérote les repères qui suivent** : une clé de
 * lecture qui saute du 2 au 4 fait douter qu'on ait perdu quelque chose.
 */
export function removeAnnotation(id: number): void {
  const db = getDb()
  const cur = getAnnotation(id)
  if (!cur) return
  db.transaction(() => {
    db.prepare(`DELETE FROM annotation WHERE id = ?`).run(id)
    if (cur.kind === 'repere' && cur.num != null) {
      db.prepare(
        `UPDATE annotation SET num = num - 1
          WHERE place_id = ? AND kind = 'repere' AND num > ?`
      ).run(cur.placeId, cur.num)
    }
  })()
}

/** Combien d'annotations par lieu, pour le dire en face de chaque lieu. */
export function annotationCounts(): Record<number, number> {
  const out: Record<number, number> = {}
  for (const r of getDb()
    .prepare(`SELECT place_id, COUNT(*) AS n FROM annotation GROUP BY place_id`)
    .all() as { place_id: number; n: number }[]) {
    out[r.place_id] = r.n
  }
  return out
}
