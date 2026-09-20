import { activeCampaignId, getDb } from '../index'
import { moveEntry, renameEntry, writeDoc } from '../../library'
import type { Chapter, Folder, FolderNode, Item, ItemFilter, ItemKind } from '@shared/types'

/* ---------------- lignes brutes ---------------- */

interface ItemRow {
  id: number
  folder_id: number | null
  chapter_id: number | null
  place_id: number | null
  kind: ItemKind
  title: string
  body: string | null
  rel_path: string | null
  mime: string | null
  bytes: number | null
  width: number | null
  height: number | null
  duration: number | null
  thumb_at: string | null
  thumb_page: number | null
  updated_at: string
}

const ITEM_SELECT = `
  SELECT i.id, i.folder_id, i.chapter_id, i.place_id, i.kind, i.title, i.body,
         i.rel_path, i.mime, i.bytes, i.width, i.height, i.duration, i.thumb_at,
         i.thumb_page, i.updated_at
    FROM item i`

function toItem(r: ItemRow): Item {
  return {
    id: r.id,
    folderId: r.folder_id,
    chapterId: r.chapter_id,
    placeId: r.place_id,
    kind: r.kind,
    title: r.title,
    body: r.body,
    relPath: r.rel_path,
    mime: r.mime,
    bytes: r.bytes,
    width: r.width,
    height: r.height,
    duration: r.duration,
    thumbAt: r.thumb_at,
    thumbPage: r.thumb_page ?? 1,
    updatedAt: r.updated_at
  }
}

/**
 * Choisir de quelle page d'un PDF on tire sa vignette.
 *
 * On n'écrit pas la vignette ici — on efface la signature de l'examen, ce qui
 * remet le fichier dans la file du graveur ; c'est lui qui regravera. Un seul
 * endroit sait tirer une image d'un PDF, et ce n'est pas celui-ci.
 *
 * La page n'est pas bornée par le haut : on ne sait pas combien de pages porte
 * le fichier, et le lecteur de Chromium s'arrête de lui-même à la dernière.
 * Demander la page 40 d'un document de trois pages grave donc la troisième,
 * ce qui est le moins surprenant des comportements.
 */
export function changerPageVignette(itemId: number, page: number): Item | null {
  const n = Math.max(1, Math.trunc(page) || 1)
  getDb()
    .prepare(
      `UPDATE item SET thumb_page = ?, meta_sig = NULL
        WHERE id = ? AND campaign_id = ? AND kind = 'pdf'`
    )
    .run(n, itemId, activeCampaignId())
  return getItem(itemId)
}

/* ---------------- chapitres ---------------- */

export function listChapters(): Chapter[] {
  return getDb()
    .prepare(
      `SELECT c.id, c.ord, c.title, c.notes,
              (SELECT COUNT(*) FROM item i WHERE i.chapter_id = c.id)         AS items,
              (SELECT COUNT(*) FROM place_chapter pc WHERE pc.chapter_id = c.id) AS places,
              (SELECT COUNT(*) FROM beat b WHERE b.chapter_id = c.id)          AS beats
         FROM chapter c
        WHERE c.campaign_id = ?
        ORDER BY c.ord, c.id`
    )
    .all(activeCampaignId()) as Chapter[]
}

export function createChapter(title: string): Chapter {
  const cid = activeCampaignId()
  const ord =
    ((getDb().prepare(`SELECT MAX(ord) AS m FROM chapter WHERE campaign_id = ?`).get(cid) as any)
      ?.m ?? -1) + 1
  const info = getDb()
    .prepare(`INSERT INTO chapter (campaign_id, ord, title) VALUES (?, ?, ?)`)
    .run(cid, ord, title)
  return { id: Number(info.lastInsertRowid), ord, title, notes: null, items: 0, places: 0, beats: 0 }
}

/**
 * L'ordre des chapitres, donné en entier.
 *
 * On renumérote de zéro plutôt que d'échanger deux rangs : une base héritée
 * peut porter deux chapitres au même rang — c'est arrivé — et un échange les
 * y laisserait pour toujours.
 */
export function reorderChapters(ids: number[]): void {
  const db = getDb()
  const cid = activeCampaignId()
  const set = db.prepare(`UPDATE chapter SET ord = ? WHERE id = ? AND campaign_id = ?`)
  db.transaction(() => ids.forEach((id, n) => set.run(n, id, cid)))()
}

export function updateChapter(id: number, patch: { title?: string; notes?: string }): void {
  const cur = getDb().prepare(`SELECT title, notes FROM chapter WHERE id = ?`).get(id) as any
  getDb()
    .prepare(`UPDATE chapter SET title = ?, notes = ? WHERE id = ?`)
    .run(patch.title ?? cur.title, patch.notes ?? cur.notes, id)
}

export function removeChapter(id: number): void {
  getDb().prepare(`DELETE FROM chapter WHERE id = ?`).run(id)
}

/* ---------------- dossiers ---------------- */

/**
 * L'arborescence n'est jamais construite ici : elle est le reflet du disque,
 * posé par `scan()`. On ne fait que la relire.
 */
export function listFolders(): Folder[] {
  return (
    getDb()
      .prepare(
        `SELECT id, parent_id AS parentId, rel_path AS relPath, name, ord, icon, color
           FROM folder WHERE campaign_id = ? ORDER BY ord, name COLLATE NOCASE`
      )
      .all(activeCampaignId()) as any[]
  ).map((r) => ({
    id: r.id,
    parentId: r.parentId,
    relPath: r.relPath,
    name: r.name,
    ord: r.ord,
    icon: r.icon,
    color: r.color
  }))
}

export function folderTree(): { tree: FolderNode[]; orphans: Item[] } {
  const folders = listFolders()
  const items = listItems({})
  const byFolder = new Map<number | null, Item[]>()
  for (const it of items) {
    const k = it.folderId
    if (!byFolder.has(k)) byFolder.set(k, [])
    byFolder.get(k)!.push(it)
  }

  const nodes = new Map<number, FolderNode>()
  for (const f of folders) nodes.set(f.id, { ...f, children: [], items: byFolder.get(f.id) ?? [] })

  const roots: FolderNode[] = []
  for (const f of folders) {
    const node = nodes.get(f.id)!
    if (f.parentId != null && nodes.has(f.parentId)) nodes.get(f.parentId)!.children.push(node)
    else roots.push(node)
  }
  return { tree: roots, orphans: byFolder.get(null) ?? [] }
}

export function folderByPath(relPath: string): Folder | null {
  const r = getDb()
    .prepare(
      `SELECT id, parent_id AS parentId, rel_path AS relPath, name, ord, icon, color
         FROM folder WHERE campaign_id = ? AND rel_path = ?`
    )
    .get(activeCampaignId(), relPath) as any
  return r ?? null
}

/* ---------------- éléments ---------------- */

export function listItems(filter: ItemFilter): Item[] {
  const where: string[] = ['i.campaign_id = @cid']
  const params: Record<string, unknown> = { cid: activeCampaignId() }

  if (filter.folderId !== undefined) {
    if (filter.folderId === null) where.push('i.folder_id IS NULL')
    else {
      where.push('i.folder_id = @folderId')
      params.folderId = filter.folderId
    }
  }
  if (filter.chapterId != null) {
    where.push('i.chapter_id = @chapterId')
    params.chapterId = filter.chapterId
  }
  if (filter.placeId != null) {
    where.push('i.place_id = @placeId')
    params.placeId = filter.placeId
  }
  if (filter.kinds?.length) {
    where.push(`i.kind IN (${filter.kinds.map((_, n) => `@k${n}`).join(',')})`)
    filter.kinds.forEach((k, n) => (params[`k${n}`] = k))
  }
  if (filter.search) {
    where.push('(i.title LIKE @q OR i.body LIKE @q)')
    params.q = `%${filter.search}%`
  }

  const rows = getDb()
    .prepare(`${ITEM_SELECT} WHERE ${where.join(' AND ')} ORDER BY i.title COLLATE NOCASE`)
    .all(params) as ItemRow[]
  return rows.map(toItem)
}

export function getItem(id: number): Item | null {
  const r = getDb().prepare(`${ITEM_SELECT} WHERE i.id = ?`).get(id) as ItemRow | undefined
  return r ? toItem(r) : null
}

export function itemByPath(relPath: string): Item | null {
  const r = getDb()
    .prepare(`${ITEM_SELECT} WHERE i.campaign_id = ? AND i.rel_path = ?`)
    .get(activeCampaignId(), relPath) as ItemRow | undefined
  return r ? toItem(r) : null
}

/**
 * Modifier un élément, c'est modifier un fichier : renommer le titre renomme
 * le fichier, changer de dossier le déplace, enregistrer un document l'écrit.
 * Seuls le chapitre et le lieu ne concernent que la base.
 */
export function updateItem(
  id: number,
  patch: Partial<Pick<Item, 'title' | 'body' | 'folderId' | 'chapterId' | 'placeId'>>
): Item | null {
  const cur = getItem(id)
  if (!cur) return null

  if (patch.body !== undefined && cur.kind === 'doc' && cur.relPath) {
    writeDoc(cur.relPath, patch.body ?? '')
    getDb().prepare(`UPDATE item SET body = ? WHERE id = ?`).run(patch.body ?? '', id)
  }

  if (patch.folderId !== undefined && patch.folderId !== cur.folderId && cur.relPath) {
    const dest =
      patch.folderId === null
        ? ''
        : ((getDb().prepare(`SELECT rel_path FROM folder WHERE id = ?`).get(patch.folderId) as any)
            ?.rel_path ?? '')
    moveEntry(cur.relPath, dest)
  }

  const after = getItem(id)
  if (patch.title !== undefined && patch.title !== cur.title && after?.relPath) {
    renameEntry(after.relPath, patch.title)
  }

  if (patch.chapterId !== undefined || patch.placeId !== undefined) {
    const now = getItem(id)!
    getDb()
      .prepare(`UPDATE item SET chapter_id = @chapterId, place_id = @placeId WHERE id = @id`)
      .run({
        id,
        chapterId: patch.chapterId !== undefined ? patch.chapterId : now.chapterId,
        placeId: patch.placeId !== undefined ? patch.placeId : now.placeId
      })
  }

  return getItem(id)
}
