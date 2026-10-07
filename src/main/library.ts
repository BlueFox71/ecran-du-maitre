/**
 * Le dossier de campagne fait foi.
 *
 * L'arborescence affichée par l'application n'est pas une invention de la base :
 * c'est le reflet d'un vrai dossier sur le disque. Ce module tient ce reflet à
 * jour dans les deux sens — l'application écrit dans le dossier, et le dossier
 * remonte dans l'application dès qu'il change, même pendant la partie.
 *
 * La base ne garde que ce que le système de fichiers ne sait pas porter :
 * l'icône et la couleur d'un dossier, le lieu d'un fichier.
 * Ces attaches suivent l'élément par son identifiant, donc un fichier renommé
 * ou déplacé — ici ou dans l'explorateur — ne les perd pas.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { watch, type FSWatcher } from 'node:fs'
import { copyFile } from 'node:fs/promises'
import { basename, dirname, extname, join, sep } from 'node:path'
import { BrowserWindow, nativeImage, shell } from 'electron'
import { activeCampaignId, getDb } from './db'
import { kindOf, mimeOf } from './kinds'
import { htmlEnTexte } from '@shared/texteBrut'
import type { ItemKind, LibraryRoot } from '@shared/types'

/* ============================================================
   Racine
   ============================================================ */

export function campaignRoot(): string | null {
  const row = getDb()
    .prepare(`SELECT root_path FROM campaign WHERE id = ?`)
    .get(activeCampaignId()) as { root_path: string | null } | undefined
  return row?.root_path ?? null
}

export function setCampaignRoot(path: string | null): void {
  getDb().prepare(`UPDATE campaign SET root_path = ? WHERE id = ?`).run(path, activeCampaignId())
  restartWatch()
}

/** Chemin absolu d'un chemin relatif au dossier de campagne. */
export function absOf(rel: string): string {
  const root = campaignRoot()
  if (!root) throw new Error('Cette campagne n’a pas encore de dossier de référence.')
  return rel ? join(root, ...rel.split('/')) : root
}

/** Un chemin qui tente de sortir du dossier est refusé, toujours. */
/** Chemin relatif à la campagne, pour un chemin absolu déjà vérifié. */
export function relOf(abs: string): string {
  return toRel(campaignRoot()!, abs)
}

export function insideRoot(abs: string): boolean {
  const root = campaignRoot()
  if (!root) return false
  const r = root.endsWith(sep) ? root : root + sep
  return abs === root || abs.startsWith(r)
}

const toRel = (root: string, abs: string): string =>
  abs.slice(root.length).split(sep).filter(Boolean).join('/')

/* ============================================================
   Lecture du disque
   ============================================================ */

interface DiskFile {
  rel: string
  bytes: number
  mtime: string
}

/** Ce que l'application ne montre pas : fichiers cachés, verrous Word, corbeilles. */
function skip(name: string): boolean {
  return name.startsWith('.') || name.startsWith('~$') || name === 'desktop.ini'
}

const MAX_DEPTH = 12
const MAX_FILES = 20000

function walk(root: string): { dirs: string[]; files: DiskFile[] } {
  const dirs: string[] = []
  const files: DiskFile[] = []

  const step = (abs: string, depth: number): void => {
    if (depth > MAX_DEPTH || files.length > MAX_FILES) return
    let entries: ReturnType<typeof readdirSync>
    try {
      entries = readdirSync(abs, { withFileTypes: true }) as never
    } catch {
      return // dossier illisible : on l'ignore plutôt que de faire tomber le scan
    }
    for (const e of entries as unknown as { name: string; isDirectory: () => boolean }[]) {
      if (skip(e.name)) continue
      const child = join(abs, e.name)
      if (e.isDirectory()) {
        dirs.push(toRel(root, child))
        step(child, depth + 1)
      } else {
        try {
          const st = statSync(child)
          files.push({ rel: toRel(root, child), bytes: st.size, mtime: st.mtime.toISOString() })
        } catch {
          /* fichier disparu entre le listing et le stat : sans importance */
        }
      }
    }
  }

  step(root, 0)
  dirs.sort()
  return { dirs, files }
}

/* ============================================================
   Réconciliation
   ============================================================ */

interface FolderRow {
  id: number
  rel_path: string
}
interface ItemRow {
  id: number
  rel_path: string
  bytes: number | null
  updated_at: string
  kind: ItemKind
}

const depthOf = (p: string): number => p.split('/').length
const parentOf = (p: string): string => {
  const i = p.lastIndexOf('/')
  return i < 0 ? '' : p.slice(0, i)
}

let lastScan: { at: string; folders: number; files: number } | null = null

/**
 * Ce qu'on prévient quand le dossier vient d'être relu.
 *
 * L'examen des médias (`examen.ts`) a besoin de savoir qu'il y a peut-être du
 * neuf à regarder, mais ce module-ci ne doit rien savoir de lui : il lit le
 * dossier, c'est tout. L'abonnement est donc posé de l'extérieur, par
 * `main/index.ts`.
 */
let apresScan: (() => void) | null = null

export function auScan(fn: () => void): void {
  apresScan = fn
}

/**
 * Aligne la base sur le disque. Idempotent : on peut l'appeler à chaque
 * frémissement du dossier.
 */
/**
 * Les documents des versions précédentes ne vivaient que dans la base. Le
 * dossier faisant désormais foi, on leur donne un vrai fichier — une fois,
 * sans toucher à leur identifiant, pour qu'ils gardent leur place dans la
 * chronologie et leurs rattachements.
 */
function materializeLegacyDocs(root: string): void {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT id, title, body FROM item
        WHERE campaign_id = ? AND kind = 'doc' AND rel_path IS NULL AND body IS NOT NULL`
    )
    .all(activeCampaignId()) as { id: number; title: string; body: string }[]
  if (!rows.length) return

  const dir = join(root, 'Documents')
  mkdirSync(dir, { recursive: true })
  for (const r of rows) {
    try {
      const abs = freePath(dir, safeName(r.title), '.html')
      writeFileSync(abs, r.body, 'utf8')
      db.prepare(`UPDATE item SET rel_path = ? WHERE id = ?`).run(toRel(root, abs), r.id)
    } catch (e) {
      console.error(`[bibliothèque] « ${r.title} » n’a pas pu être écrit :`, e)
    }
  }
  console.log(`[bibliothèque] ${rows.length} documents écrits dans « Documents »`)
}

export function scan(): { folders: number; files: number } {
  const root = campaignRoot()
  if (!root || !existsSync(root)) return { folders: 0, files: 0 }

  materializeLegacyDocs(root)

  const db = getDb()
  const cid = activeCampaignId()
  const { dirs, files } = walk(root)
  const diskDirs = new Set(dirs)
  const diskFiles = new Map(files.map((f) => [f.rel, f]))

  db.transaction(() => {
    /* ---------------- dossiers ---------------- */

    const repath = (from: string, to: string): void => {
      db.prepare(
        `UPDATE folder SET rel_path = ? || substr(rel_path, ?), name = ?
          WHERE campaign_id = ? AND (rel_path = ? OR rel_path LIKE ? || '/%')`
      ).run(to, from.length + 1, basename(to), cid, from, from)
      db.prepare(
        `UPDATE item SET rel_path = ? || substr(rel_path, ?)
          WHERE campaign_id = ? AND rel_path LIKE ? || '/%'`
      ).run(to, from.length + 1, cid, from)
    }

    // Un dossier renommé dans l'explorateur ne doit pas perdre son icône :
    // on apparie ce qui a disparu et ce qui est apparu au même endroit.
    for (let pass = 0; pass < 40; pass++) {
      const rows = db
        .prepare(`SELECT id, rel_path FROM folder WHERE campaign_id = ?`)
        .all(cid) as FolderRow[]
      const known = new Set(rows.map((r) => r.rel_path))
      const gone = rows.filter((r) => !diskDirs.has(r.rel_path)).sort(
        (a, b) => depthOf(a.rel_path) - depthOf(b.rel_path)
      )
      const born = dirs.filter((d) => !known.has(d))
      const pair = gone
        .map((g) => ({
          g,
          cands: born.filter(
            (b) => parentOf(b) === parentOf(g.rel_path) && depthOf(b) === depthOf(g.rel_path)
          )
        }))
        .find((x) => x.cands.length === 1)
      if (!pair) break
      repath(pair.g.rel_path, pair.cands[0])
    }

    // Ce qui reste absent du disque sort de la base.
    for (const r of db
      .prepare(`SELECT id, rel_path FROM folder WHERE campaign_id = ?`)
      .all(cid) as FolderRow[]) {
      if (!diskDirs.has(r.rel_path)) {
        db.prepare(`DELETE FROM folder WHERE id = ?`).run(r.id)
      }
    }

    const insFolder = db.prepare(
      `INSERT INTO folder (campaign_id, parent_id, rel_path, name, ord) VALUES (?, NULL, ?, ?, ?)`
    )
    const folderId = new Map<string, number>()
    for (const r of db
      .prepare(`SELECT id, rel_path FROM folder WHERE campaign_id = ?`)
      .all(cid) as FolderRow[]) {
      folderId.set(r.rel_path, r.id)
    }
    dirs.forEach((d, i) => {
      if (folderId.has(d)) {
        db.prepare(`UPDATE folder SET name = ?, ord = ? WHERE id = ?`).run(
          basename(d),
          i,
          folderId.get(d)
        )
      } else {
        const id = Number(insFolder.run(cid, d, basename(d), i).lastInsertRowid)
        folderId.set(d, id)
      }
    })
    // Le parent se déduit du chemin, une fois tous les dossiers connus.
    for (const d of dirs) {
      const p = parentOf(d)
      db.prepare(`UPDATE folder SET parent_id = ? WHERE id = ?`).run(
        p ? (folderId.get(p) ?? null) : null,
        folderId.get(d)!
      )
    }

    /* ---------------- fichiers ---------------- */

    const rows = db
      .prepare(
        `SELECT id, rel_path, bytes, updated_at, kind FROM item
          WHERE campaign_id = ? AND rel_path IS NOT NULL`
      )
      .all(cid) as ItemRow[]
    const known = new Map(rows.map((r) => [r.rel_path, r]))

    const gone = rows.filter((r) => !diskFiles.has(r.rel_path))
    const born = files.filter((f) => !known.has(f.rel))

    // Un fichier qui a bougé garde son identifiant, donc son lieu
    // et sa place dans la chronologie. On le reconnaît d'abord à son nom s'il a
    // changé de dossier, ensuite à son poids s'il a changé de nom.
    const claimed = new Set<string>()
    const followed = new Set<number>()
    const follow = (r: ItemRow, to: string): void => {
      db.prepare(`UPDATE item SET rel_path = ?, title = ? WHERE id = ?`).run(
        to,
        basename(to, extname(to)),
        r.id
      )
      claimed.add(to)
      followed.add(r.id)
    }
    for (const r of gone) {
      const name = basename(r.rel_path)
      const c = born.filter((b) => !claimed.has(b.rel) && basename(b.rel) === name)
      if (c.length === 1) follow(r, c[0].rel)
    }
    for (const r of gone) {
      if (followed.has(r.id)) continue
      const ext = extname(r.rel_path).toLowerCase()
      const c = born.filter(
        (b) => !claimed.has(b.rel) && b.bytes === r.bytes && extname(b.rel).toLowerCase() === ext
      )
      if (c.length === 1) follow(r, c[0].rel)
    }

    // Ce qui n'a pas été retrouvé disparaît ; les liens qui en dépendaient
    // tombent d'eux-mêmes (ON DELETE CASCADE / SET NULL).
    for (const r of db
      .prepare(
        `SELECT id, rel_path FROM item WHERE campaign_id = ? AND rel_path IS NOT NULL`
      )
      .all(cid) as FolderRow[]) {
      if (!diskFiles.has(r.rel_path)) db.prepare(`DELETE FROM item WHERE id = ?`).run(r.id)
    }

    const current = new Map(
      (
        db
          .prepare(
            `SELECT id, rel_path, bytes, updated_at, kind FROM item
              WHERE campaign_id = ? AND rel_path IS NOT NULL`
          )
          .all(cid) as ItemRow[]
      ).map((r) => [r.rel_path, r])
    )
    const insItem = db.prepare(
      `INSERT INTO item (campaign_id, folder_id, kind, title, body, rel_path, mime, bytes, updated_at)
       VALUES (@cid, @folderId, @kind, @title, @body, @relPath, @mime, @bytes, @mtime)`
    )
    const updItem = db.prepare(
      `UPDATE item SET folder_id = @folderId, kind = @kind, title = @title,
                       mime = @mime, bytes = @bytes, updated_at = @mtime
        WHERE id = @id`
    )
    const updBody = db.prepare(`UPDATE item SET body = ? WHERE id = ?`)

    for (const f of files) {
      const kind = kindOf(f.rel)
      const p = parentOf(f.rel)
      const row = {
        cid,
        folderId: p ? (folderId.get(p) ?? null) : null,
        kind,
        title: basename(f.rel, extname(f.rel)),
        mime: mimeOf(f.rel),
        bytes: f.bytes,
        mtime: f.mtime,
        relPath: f.rel
      }
      const seen = current.get(f.rel)
      if (!seen) {
        const id = Number(insItem.run({ ...row, body: null }).lastInsertRowid)
        if (kind === 'doc') updBody.run(readText(join(root, ...f.rel.split('/'))), id)
      } else {
        updItem.run({ ...row, id: seen.id })
        // Le corps d'un document n'est relu que s'il a bougé sur le disque.
        if (kind === 'doc' && (seen.updated_at !== f.mtime || seen.bytes !== f.bytes)) {
          updBody.run(readText(join(root, ...f.rel.split('/'))), seen.id)
        }
      }
    }
  })()

  lastScan = { at: new Date().toISOString(), folders: dirs.length, files: files.length }
  apresScan?.()
  return { folders: dirs.length, files: files.length }
}

function readText(abs: string): string {
  try {
    return readFileSync(abs, 'utf8')
  } catch {
    return ''
  }
}

export function rootState(): LibraryRoot {
  const path = campaignRoot()
  return {
    path,
    exists: !!path && existsSync(path),
    watching: watcher !== null,
    folders: lastScan?.folders ?? 0,
    files: lastScan?.files ?? 0,
    scannedAt: lastScan?.at ?? null
  }
}

/* ============================================================
   Écritures — toutes passent par le disque, la base suit
   ============================================================ */

/**
 * Un nom acceptable pour Windows. On ne retire que ce que le système refuse
 * vraiment : les tirets, les espaces et les accents sont du texte, pas du bruit.
 */
const FORBIDDEN = new RegExp('[<>:"/\\\\|?*]', 'g')

export function safeName(name: string): string {
  const clean = name
    .replace(FORBIDDEN, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '')
  if (!clean) throw new Error('Ce nom ne contient aucun caractère utilisable.')
  return clean
}

/** Ajoute « (2) », « (3) »… si le nom est déjà pris. */
function freePath(dir: string, name: string, ext = ''): string {
  let candidate = join(dir, name + ext)
  let n = 2
  while (existsSync(candidate)) candidate = join(dir, `${name} (${n++})${ext}`)
  return candidate
}

export function createFolder(parentRel: string, name: string): string {
  const dir = absOf(parentRel)
  const abs = freePath(dir, safeName(name))
  if (!insideRoot(abs)) throw new Error('Hors du dossier de campagne.')
  mkdirSync(abs, { recursive: true })
  scan()
  return toRel(campaignRoot()!, abs)
}

export function renameEntry(rel: string, name: string): string {
  if (!rel) throw new Error('Le dossier de campagne lui-même ne se renomme pas ici.')
  const abs = absOf(rel)
  const ext = statSync(abs).isDirectory() ? '' : extname(abs)
  const base = safeName(ext ? name.replace(new RegExp(`${ext}$`, 'i'), '') : name)
  const dest = freePath(dirname(abs), base, ext)
  if (!insideRoot(dest)) throw new Error('Hors du dossier de campagne.')
  if (dest === abs) return rel
  renameSync(abs, dest)
  const neuf = toRel(campaignRoot()!, dest)
  if (!ext) suivreDossierDeSeance(rel, neuf)
  scan()
  return neuf
}

/**
 * Une séance désigne son dossier par son chemin : renommé ou déplacé depuis
 * l'application, il l'emporte avec lui — lui et tout ce qui est dessous. Un
 * renommage fait dans l'explorateur, lui, laisse la séance sur un chemin qui
 * n'existe plus, et l'interface le dit.
 */
function suivreDossierDeSeance(ancien: string, neuf: string): void {
  getDb()
    .prepare(
      `UPDATE game_session
          SET folder_rel = ? || substr(folder_rel, length(?) + 1)
        WHERE campaign_id = ? AND (folder_rel = ? OR substr(folder_rel, 1, length(?) + 1) = ? || '/')`
    )
    .run(neuf, ancien, activeCampaignId(), ancien, ancien, ancien)
}

export function moveEntry(rel: string, destFolderRel: string): string {
  const abs = absOf(rel)
  const destDir = absOf(destFolderRel)
  if (!insideRoot(abs) || !insideRoot(destDir)) throw new Error('Hors du dossier de campagne.')
  if (destDir === dirname(abs)) return rel
  /* Un dossier ne se glisse ni dans sa propre descendance, ni sur lui-même.
     Le second cas manquait : `rename(A, A/A)` remontait alors un EINVAL de
     Windows, illisible pour qui lit le message. */
  if (destDir === abs || destDir.startsWith(abs + sep))
    throw new Error('Un dossier ne peut pas entrer dans lui-même.')
  const ext = statSync(abs).isDirectory() ? '' : extname(abs)
  const dest = freePath(destDir, basename(abs, ext), ext)
  renameSync(abs, dest)
  const neuf = toRel(campaignRoot()!, dest)
  if (!ext) suivreDossierDeSeance(rel, neuf)
  scan()
  return neuf
}

/**
 * Recopier un dossier à côté de lui, sous un autre nom, en disant où on en est.
 *
 * La copie se fait fichier par fichier, et la progression se compte en octets :
 * une vidéo de deux gigas pèse plus lourd que cent fiches. La surveillance est
 * coupée le temps de la copie — sinon chaque fichier posé relancerait une
 * relecture du dossier — puis on relit une fois, à la fin. Ce qu'ignore la
 * lecture (fichiers cachés, `desktop.ini`) n'est pas recopié non plus.
 *
 * Les icônes et couleurs des dossiers suivent leur jumeau. Rend le chemin de
 * la copie et, pour chaque fichier, l'identifiant de l'original et celui de
 * son double — de quoi raccrocher plans, portraits et textes à la copie.
 */
export async function copierDossier(
  srcRel: string,
  nom: string,
  progres: (fait: number, total: number) => void
): Promise<{ rel: string; jumeaux: Map<number, number> }> {
  if (!srcRel) throw new Error('Le dossier de campagne lui-même ne se duplique pas.')
  const src = absOf(srcRel)
  if (!insideRoot(src) || !existsSync(src) || !statSync(src).isDirectory())
    throw new Error('Le dossier à dupliquer est introuvable.')
  const dest = freePath(dirname(src), safeName(nom))
  if (!insideRoot(dest)) throw new Error('Hors du dossier de campagne.')

  const dossiers: string[] = []
  const fichiers: { de: string; vers: string; octets: number }[] = []
  const lister = (de: string, vers: string): void => {
    dossiers.push(vers)
    for (const e of readdirSync(de, { withFileTypes: true })) {
      if (skip(e.name)) continue
      if (e.isDirectory()) lister(join(de, e.name), join(vers, e.name))
      else fichiers.push({ de: join(de, e.name), vers: join(vers, e.name), octets: statSync(join(de, e.name)).size })
    }
  }
  lister(src, dest)

  const total = fichiers.reduce((n, f) => n + f.octets, 0) || 1
  let fait = 0
  progres(0, total)
  stopWatch()
  try {
    for (const d of dossiers) mkdirSync(d, { recursive: true })
    for (const f of fichiers) {
      await copyFile(f.de, f.vers)
      fait += f.octets
      progres(fait, total)
    }
  } finally {
    startWatch()
  }

  const root = campaignRoot()!
  const rel = toRel(root, dest)
  scan()

  const db = getDb()
  const cid = activeCampaignId()
  const jumeaux = new Map<number, number>()
  db.transaction(() => {
    const items = db
      .prepare(
        `SELECT id, rel_path AS rel FROM item
          WHERE campaign_id = ? AND substr(rel_path, 1, length(?) + 1) = ? || '/'`
      )
      .all(cid, srcRel, srcRel) as { id: number; rel: string }[]
    const parChemin = db.prepare(`SELECT id FROM item WHERE campaign_id = ? AND rel_path = ?`)
    for (const it of items) {
      const double = parChemin.get(cid, rel + it.rel.slice(srcRel.length)) as { id: number } | undefined
      if (double) jumeaux.set(it.id, double.id)
    }
    const decor = db.prepare(
      `UPDATE folder SET icon = (SELECT icon FROM folder WHERE campaign_id = @cid AND rel_path = @de),
                         color = (SELECT color FROM folder WHERE campaign_id = @cid AND rel_path = @de)
        WHERE campaign_id = @cid AND rel_path = @vers`
    )
    for (const d of dossiers) {
      const vers = toRel(root, d)
      decor.run({ cid, de: srcRel + vers.slice(rel.length), vers })
    }
  })()
  announce()
  return { rel, jumeaux }
}

/** Corbeille de Windows, jamais d'effacement définitif. */
export async function trashEntry(rel: string): Promise<void> {
  if (!rel) throw new Error('Le dossier de campagne lui-même ne se supprime pas ici.')
  const abs = absOf(rel)
  if (!insideRoot(abs)) throw new Error('Hors du dossier de campagne.')
  await shell.trashItem(abs)
  scan()
}

export function setFolderDecor(rel: string, icon: string | null, color: string | null): void {
  getDb()
    .prepare(`UPDATE folder SET icon = ?, color = ? WHERE campaign_id = ? AND rel_path = ?`)
    .run(icon, color, activeCampaignId(), rel)
}

/** Crée un document vide, c'est-à-dire un vrai fichier .html dans le dossier. */
export function createDoc(folderRel: string, title: string): string {
  const dir = absOf(folderRel)
  const abs = freePath(dir, safeName(title), '.html')
  writeFileSync(abs, '<p></p>', 'utf8')
  scan()
  return toRel(campaignRoot()!, abs)
}

export function writeDoc(rel: string, html: string): void {
  const abs = absOf(rel)
  if (!insideRoot(abs)) throw new Error('Hors du dossier de campagne.')
  writeFileSync(abs, html, 'utf8')
}

/**
 * La version texte d'un document, posée à côté de lui sous le même nom en
 * `.txt` : de quoi relire le texte d'un moment hors de l'application. Elle est
 * réécrite à chaque enregistrement ; c'est le `.html` qui fait foi.
 */
export function writeTexteBrut(rel: string, html: string): void {
  const abs = absOf(rel)
  const txt = join(dirname(abs), basename(abs, extname(abs)) + '.txt')
  if (!insideRoot(txt)) throw new Error('Hors du dossier de campagne.')
  writeFileSync(txt, htmlEnTexte(html), 'utf8')
}

/** Le dossier où se rangent les textes des moments, dans celui de leur séance. */
export const DOSSIER_MOMENTS = 'Moments'

/**
 * Migration des fichiers, une fois par campagne : les textes des moments
 * écrits avant le dossier « Moments » vont l'y rejoindre — celui de leur
 * séance — et reçoivent leur version .txt. Le dossier naît s'il manque, avec
 * son sablier. Le déplacement passe par `moveEntry` : le fichier garde son
 * identifiant, donc son moment, ses annexes et ses rattachements.
 *
 * Une seule fois, notée dans `setting` : un texte que le MJ range ailleurs
 * ensuite y reste.
 */
export function rangerTextesDesMoments(): void {
  const db = getDb()
  const cid = activeCampaignId()
  const CLE = 'migration.textes-des-moments'
  if (db.prepare(`SELECT 1 FROM setting WHERE key = ?`).get(CLE)) return

  const textes = db
    .prepare(
      `SELECT i.id, i.rel_path AS rel, MIN(COALESCE(g.folder_rel, '')) AS base
         FROM beat_item bi
         JOIN beat b ON b.id = bi.beat_id
         JOIN game_session g ON g.id = b.session_id
         JOIN item i ON i.id = bi.item_id
        WHERE i.campaign_id = ? AND i.kind = 'doc' AND i.rel_path IS NOT NULL
        GROUP BY i.id`
    )
    .all(cid) as { id: number; rel: string; base: string }[]

  const dossiers = new Set<string>()
  for (const t of textes) {
    const dest = t.base ? `${t.base}/${DOSSIER_MOMENTS}` : DOSSIER_MOMENTS
    dossiers.add(dest)
    try {
      if (!existsSync(absOf(dest))) mkdirSync(absOf(dest), { recursive: true })
      const ici = t.rel.includes('/') ? t.rel.slice(0, t.rel.lastIndexOf('/')) : ''
      const rel = ici === dest ? t.rel : moveEntry(t.rel, dest)
      const html = absOf(rel)
      if (!existsSync(join(dirname(html), basename(html, extname(html)) + '.txt')))
        writeTexteBrut(rel, readFileSync(html, 'utf8'))
      console.log(`[moments] ${t.rel} -> ${rel}`)
    } catch (e) {
      console.error(`[moments] ${t.rel} laissé en place : ${(e as Error).message}`)
    }
  }
  scan()
  for (const d of dossiers)
    db.prepare(
      `UPDATE folder SET icon = 'moments' WHERE campaign_id = ? AND rel_path = ? AND icon IS NULL`
    ).run(cid, d)
  db.prepare(`INSERT INTO setting (key, value) VALUES (?, '1')`).run(CLE)
}

/** Le dossier des notes du Bloc-notes, à la racine de la campagne : une note, un fichier. */
export const DOSSIER_NOTES = 'Bloc-notes'

/**
 * Le Bloc-notes a d'abord été un seul fichier, `Bloc-notes.html` à la racine.
 * Il est devenu un dossier de notes : l'ancien fichier y entre comme première
 * note — ou part à la corbeille s'il n'a jamais rien contenu. Sa version .txt
 * le suit.
 */
export function rangerAncienBlocNotes(): void {
  const html = absOf('Bloc-notes.html')
  if (!existsSync(html)) return
  const txt = absOf('Bloc-notes.txt')
  const vide = readFileSync(html, 'utf8').replace(/<[^>]+>|\s|&nbsp;/g, '') === ''
  try {
    if (vide) {
      void shell.trashItem(html)
      if (existsSync(txt)) void shell.trashItem(txt)
      console.log('[bloc-notes] ancien Bloc-notes vide mis à la corbeille')
      return
    }
    if (!existsSync(absOf(DOSSIER_NOTES))) mkdirSync(absOf(DOSSIER_NOTES))
    moveEntry('Bloc-notes.html', DOSSIER_NOTES)
    if (existsSync(txt)) moveEntry('Bloc-notes.txt', DOSSIER_NOTES)
    getDb()
      .prepare(
        `UPDATE folder SET icon = 'notes' WHERE campaign_id = ? AND rel_path = ? AND icon IS NULL`
      )
      .run(activeCampaignId(), DOSSIER_NOTES)
    console.log('[bloc-notes] ancien Bloc-notes rangé comme première note')
  } catch (e) {
    console.error(`[bloc-notes] ancien Bloc-notes laissé en place : ${(e as Error).message}`)
  }
}

/**
 * Un document renommé emmène sa version .txt avec lui, s'il en a une : les
 * deux fichiers portent toujours le même nom.
 */
export function renommerJumeauTxt(ancienRel: string, nom: string): void {
  const txt = ancienRel.replace(/\.html?$/i, '.txt')
  if (txt !== ancienRel && existsSync(absOf(txt))) renameEntry(txt, nom)
}

export function readDoc(rel: string): string {
  return readText(absOf(rel))
}

/** Copie des fichiers venus d'ailleurs dans le dossier de campagne. */
/**
 * Rogner une image : une **copie** rognée, posée à côté de l'originale.
 *
 * On ne touche jamais au fichier d'origine — d'autres lieux peuvent le
 * montrer, et un mauvais cadrage doit pouvoir se refaire. Le cadre est en
 * fractions de l'image. Rend le chemin de la copie, déjà connue de la
 * bibliothèque.
 */
export function rognerImage(
  rel: string,
  cadre: { x: number; y: number; w: number; h: number }
): string {
  const abs = absOf(rel)
  const img = nativeImage.createFromPath(abs)
  if (img.isEmpty()) throw new Error('Image illisible')
  const { width, height } = img.getSize()
  const x = Math.max(0, Math.min(width - 1, Math.round(cadre.x * width)))
  const y = Math.max(0, Math.min(height - 1, Math.round(cadre.y * height)))
  const w = Math.max(1, Math.min(width - x, Math.round(cadre.w * width)))
  const h = Math.max(1, Math.min(height - y, Math.round(cadre.h * height)))
  const rogne = img.crop({ x, y, width: w, height: h })
  const ext = extname(abs).toLowerCase()
  const jpeg = ext === '.jpg' || ext === '.jpeg'
  const dest = freePath(dirname(abs), `${basename(abs, extname(abs))} (rognée)`, jpeg ? ext : '.png')
  writeFileSync(dest, jpeg ? rogne.toJPEG(92) : rogne.toPNG())
  scan()
  return toRel(campaignRoot()!, dest)
}

export function importInto(folderRel: string, sources: string[]): string[] {
  const dir = absOf(folderRel)
  const made: string[] = []
  for (const src of sources) {
    const ext = extname(src)
    const dest = freePath(dir, basename(src, ext), ext)
    copyFileSync(src, dest)
    made.push(toRel(campaignRoot()!, dest))
  }
  scan()
  return made
}

export function revealEntry(rel: string): void {
  const abs = absOf(rel)
  if (!insideRoot(abs)) return
  shell.showItemInFolder(abs)
}

export function openFolderInExplorer(rel: string): void {
  const abs = absOf(rel)
  if (insideRoot(abs)) void shell.openPath(abs)
}

/* ============================================================
   Surveillance — l'autre sens de la liaison
   ============================================================ */

let watcher: FSWatcher | null = null
let pending: NodeJS.Timeout | null = null

export function announce(): void {
  const state = rootState()
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send('library:changed', state)
  }
}

export function startWatch(): void {
  stopWatch()
  const root = campaignRoot()
  if (!root || !existsSync(root)) return
  try {
    watcher = watch(root, { recursive: true }, () => {
      // Une copie de fichiers déclenche des dizaines d'événements : on attend
      // que ça se calme avant de relire le dossier.
      if (pending) clearTimeout(pending)
      pending = setTimeout(() => {
        pending = null
        try {
          scan()
          announce()
        } catch (e) {
          console.error('[bibliothèque] relecture impossible :', e)
        }
      }, 300)
    })
    watcher.on('error', (e) => console.error('[bibliothèque] surveillance interrompue :', e))
  } catch (e) {
    console.error('[bibliothèque] surveillance impossible :', e)
    watcher = null
  }
}

export function stopWatch(): void {
  if (pending) {
    clearTimeout(pending)
    pending = null
  }
  watcher?.close()
  watcher = null
}

export function restartWatch(): void {
  scan()
  startWatch()
  announce()
}
