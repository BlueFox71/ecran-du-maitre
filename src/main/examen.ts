/**
 * L'examen des médias — ce que le dossier ne dit pas.
 *
 * Un fichier donne son nom, son poids et sa date. Il ne dit ni ses dimensions,
 * ni sa durée, ni à quoi il ressemble. Pour le savoir il faut le décoder, et le
 * seul décodeur que l'application embarque est celui de Chromium : `ffprobe`
 * n'est pas là, et on ne va pas le chercher sur le réseau pour une application
 * qui se veut hors ligne.
 *
 * D'où cette fenêtre cachée — *le graveur* : une page sans interface qui
 * réclame du travail, charge le média, relève ses mesures, saisit une image et
 * la renvoie. Le processus principal écrit la vignette dans
 * `.ecran-du-maitre/vignettes/<id>.jpg` et range les mesures en base.
 *
 * Le graveur s'ouvre quand il y a du travail et se ferme quand il n'y en a
 * plus : hors examen, l'application ne porte pas une fenêtre de plus. Il passe
 * un fichier à la fois, sans hâte — c'est du confort, pas de la partie.
 *
 * Ce module n'est appelé que par `library.ts`, au scan, par `auScan()`.
 */
import { existsSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { BrowserWindow } from 'electron'
import { activeCampaignId, getDb, isDbOpen } from './db'
import { absOf } from './library'
import { mediaUrl, vignettePath, vignettesDir } from './vault'
import { cheminIcone } from './icone'
import type { ExamenFait, ExamenJob } from '@shared/types'

/* ============================================================
   La file d'attente
   ============================================================ */

/**
 * Ce qui, en changeant, redemande un examen : le poids et la date du fichier —
 * et le numéro du graveur lui-même.
 *
 * Ce dernier est ce qui rattrape les corrections. Le graveur de la première
 * version ne savait pas tirer sa durée d'un mp3 à débit constant : sans ce
 * numéro, les dix-neuf bruitages déjà vus l'auraient été pour toujours. On
 * l'incrémente chaque fois que le graveur apprend à voir quelque chose de plus.
 */
const VERSION = 2
const SIG = `('v${VERSION}|' || COALESCE(i.bytes, 0) || '|' || i.updated_at)`

interface Candidat {
  id: number
  kind: 'image' | 'video' | 'audio'
  title: string
  rel_path: string
  sig: string
}

/**
 * Le prochain média à regarder. Les vidéos d'abord : ce sont elles qui, sans
 * vignette, ne sont qu'un rectangle noir dans la bibliothèque.
 */
function prochain(): ExamenJob | null {
  if (!isDbOpen()) return null
  for (;;) {
    const r = getDb()
      .prepare(
        `SELECT i.id, i.kind, i.title, i.rel_path, ${SIG} AS sig
           FROM item i
          WHERE i.campaign_id = ?
            AND i.rel_path IS NOT NULL
            AND i.kind IN ('video', 'image', 'audio')
            AND (i.meta_sig IS NULL OR i.meta_sig <> ${SIG})
          ORDER BY CASE i.kind WHEN 'video' THEN 0 WHEN 'image' THEN 1 ELSE 2 END, i.id
          LIMIT 1`
      )
      .get(activeCampaignId()) as Candidat | undefined
    if (!r) return null

    // Le fichier a pu disparaître entre le scan et l'examen : on le marque pour
    // ne pas y revenir, le prochain scan le sortira de la base.
    let abs: string
    try {
      abs = absOf(r.rel_path)
    } catch {
      return null
    }
    if (!existsSync(abs)) {
      ranger({ id: r.id, sig: r.sig, width: null, height: null, duration: null, vignette: null, erreur: 'introuvable' })
      continue
    }

    const url = mediaUrl(r.rel_path)
    if (!url) return null
    return { id: r.id, kind: r.kind, url, titre: r.title, sig: r.sig }
  }
}

/** Combien de médias attendent encore. Sert à décider s'il faut ouvrir. */
function reste(): number {
  if (!isDbOpen()) return 0
  const r = getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM item i
        WHERE i.campaign_id = ? AND i.rel_path IS NOT NULL
          AND i.kind IN ('video', 'image', 'audio')
          AND (i.meta_sig IS NULL OR i.meta_sig <> ${SIG})`
    )
    .get(activeCampaignId()) as { n: number }
  return r.n
}

/* ============================================================
   Ranger le résultat
   ============================================================ */

function ranger(f: ExamenFait): void {
  if (!isDbOpen()) return
  const abs = vignettePath(f.id, !!f.vignette)
  let grave: string | null = null

  if (f.vignette && abs) {
    try {
      const b64 = f.vignette.slice(f.vignette.indexOf(',') + 1)
      writeFileSync(abs, Buffer.from(b64, 'base64'))
      grave = new Date().toISOString()
    } catch (e) {
      console.error(`[examen] vignette ${f.id} non écrite :`, e)
    }
  } else if (abs && existsSync(abs)) {
    // Le média n'a plus d'image à montrer : l'ancienne vignette mentirait.
    try {
      rmSync(abs)
    } catch {
      /* sans importance */
    }
  }

  getDb()
    .prepare(
      `UPDATE item
          SET width = COALESCE(@width, width),
              height = COALESCE(@height, height),
              duration = COALESCE(@duration, duration),
              meta_sig = @sig,
              thumb_at = @thumbAt
        WHERE id = @id`
    )
    .run({
      id: f.id,
      sig: f.sig,
      width: f.width,
      height: f.height,
      duration: f.duration,
      thumbAt: grave
    })
}

/**
 * Les vignettes des éléments qui ne sont plus. Un fichier supprimé emporte sa
 * ligne en base, pas son image : on balaie une fois l'examen terminé.
 */
function balayer(): void {
  const dir = vignettesDir()
  if (!dir || !existsSync(dir) || !isDbOpen()) return
  try {
    const vivants = new Set(
      (getDb().prepare(`SELECT id FROM item WHERE thumb_at IS NOT NULL`).all() as { id: number }[])
        .map((r) => String(r.id))
    )
    for (const nom of readdirSync(dir)) {
      const m = /^(\d+)\.jpg$/.exec(nom)
      if (m && !vivants.has(m[1])) rmSync(join(dir, nom), { force: true })
    }
  } catch (e) {
    console.error('[examen] balayage impossible :', e)
  }
}

/* ============================================================
   Les PDF — une page rendue, puis photographiée
   ============================================================ */

/*
 * Un PDF n'a rien à donner à un canevas.
 *
 * Le graveur travaille en dessinant le média dans une toile pour en relire les
 * pixels ; or le lecteur de PDF de Chromium est un greffon, et ce qu'il dessine
 * ne se relit pas. Un PDF passé au graveur revenait donc « image illisible » —
 * et c'est pourquoi la file d'attente ne l'a jamais pris.
 *
 * D'où ce second chemin, tenu par le processus principal : on ouvre la première
 * page dans une fenêtre posée hors de l'écran, et on la photographie. C'est le
 * même Chromium, pris par l'autre bout.
 *
 * Deux choix à expliquer :
 *
 *  — **`file://` et non `jdr://`.** Le greffon refuse un protocole qu'il ne
 *    connaît pas. Cette fenêtre est donc la seule de l'application à voir le
 *    disque en direct : sans preload, sans Node, bac à sable fermé, et elle ne
 *    vit que le temps d'une image.
 *  — **montrée, mais loin.** Une fenêtre franchement cachée ne peint pas
 *    toujours, et une photographie de fenêtre non peinte est vide. Elle est
 *    donc posée à −4000 px et ouverte sans prendre le focus : rien ne bouge
 *    sous les yeux du MJ, rien n'apparaît dans la barre des tâches.
 *
 * Le numéro de version du graveur n'a pas bougé : un PDF n'a jamais été
 * examiné, sa signature est donc nulle et il entre dans la file de lui-même.
 * L'incrémenter aurait fait relire toutes les images et toutes les vidéos de la
 * campagne pour rien.
 */

/** Le côté le plus long d'une vignette, et sa qualité — les mêmes que le graveur. */
const COTE = 480
const QUALITE_PDF = 72
/** Le temps laissé au greffon pour dessiner sa première page. */
const PDF_PATIENCE = 12000
/** Le répit après le chargement : le greffon peint après avoir répondu. */
const PDF_REPIT = 1400
/** Garde-fou, comme pour le graveur : une file qui ne se vide pas est un défaut. */
const PDF_MAX = 2000

/** Vrai quand le projet se referme : la boucle des PDF doit s'arrêter aussi. */
let pdfsArretes = false

interface CandidatPdf {
  id: number
  title: string
  rel_path: string
  thumb_page: number | null
  sig: string
}

const PDF_OU = `i.campaign_id = ?
            AND i.rel_path IS NOT NULL
            AND i.kind = 'pdf'
            AND (i.meta_sig IS NULL OR i.meta_sig <> ${SIG})`

function prochainPdf(): { id: number; sig: string; abs: string; titre: string; page: number } | null {
  if (!isDbOpen()) return null
  for (;;) {
    const r = getDb()
      .prepare(
        `SELECT i.id, i.title, i.rel_path, i.thumb_page, ${SIG} AS sig
           FROM item i WHERE ${PDF_OU} ORDER BY i.id LIMIT 1`
      )
      .get(activeCampaignId()) as CandidatPdf | undefined
    if (!r) return null

    let abs: string
    try {
      abs = absOf(r.rel_path)
    } catch {
      return null
    }
    /* Disparu entre le scan et l'examen : on le marque pour ne pas y revenir. */
    if (!existsSync(abs)) {
      ranger({
        id: r.id,
        sig: r.sig,
        width: null,
        height: null,
        duration: null,
        vignette: null,
        erreur: 'introuvable'
      })
      continue
    }
    return { id: r.id, sig: r.sig, abs, titre: r.title, page: Math.max(1, r.thumb_page ?? 1) }
  }
}

function restePdfs(): number {
  if (!isDbOpen()) return 0
  const r = getDb()
    .prepare(`SELECT COUNT(*) AS n FROM item i WHERE ${PDF_OU}`)
    .get(activeCampaignId()) as { n: number }
  return r.n
}

const patienter = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/**
 * L'image porte-t-elle quelque chose ?
 *
 * Une fenêtre dont le greffon n'a pas encore peint rend un rectangle d'une
 * seule couleur — le gris de son fond. On échantillonne la luminance : si rien
 * ne varie, il n'y a rien à graver et il faut attendre encore. C'est aussi ce
 * qui évite de garder une vignette grise d'un PDF que le greffon n'a pas su
 * ouvrir.
 */
function varie(image: Electron.NativeImage): boolean {
  const b = image.getBitmap()
  if (!b || !b.length) return false
  let min = 255
  let max = 0
  /* Quatre mille points suffisent à dire si une page est blanche ou écrite. */
  const pas = Math.max(4, Math.floor(b.length / 4 / 4000)) * 4
  for (let i = 0; i + 2 < b.length; i += pas) {
    const l = (b[i] * 299 + b[i + 1] * 587 + b[i + 2] * 114) / 1000
    if (l < min) min = l
    if (l > max) max = l
  }
  return max - min > 12
}

/** La même promesse, mais qui finit toujours par répondre. */
function avecPatience<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('sans réponse')), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      }
    )
  })
}

/**
 * Une page d'un PDF, en JPEG, au format que `ranger()` attend — la même URL de
 * données que le graveur renvoie pour une image.
 *
 * La page n'est pas bornée par le haut : on ne sait pas combien le fichier en
 * porte. Le lecteur de Chromium s'arrête de lui-même à la dernière, ce qui est
 * le moins surprenant des comportements — demander la page 40 d'un document de
 * trois pages grave la troisième.
 */
async function pageDe(abs: string, page: number): Promise<string | null> {
  const w = new BrowserWindow({
    show: false,
    x: -4000,
    y: 0,
    /* Une page A4 debout : le greffon y ajuste la sienne sans trop de gris. */
    width: 620,
    height: 820,
    frame: false,
    skipTaskbar: true,
    focusable: false,
    webPreferences: {
      plugins: true,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false
    }
  })
  try {
    /* Sans focus : le MJ ne doit pas perdre son clavier pendant une partie. */
    w.showInactive()
    const url = `${pathToFileURL(abs).toString()}#page=${page}&toolbar=0&navpanes=0&view=Fit`
    /*
     * On n'attend pas la promesse de `loadURL` : sur un PDF elle **rejette**.
     * Chromium confie la navigation au greffon et la tient pour échouée
     * (ERR_FAILED) alors qu'il affiche la page. Le seul signal fiable est
     * l'image elle-même — on la regarde jusqu'à ce qu'elle porte quelque
     * chose.
     */
    void w.loadURL(url).catch(() => undefined)

    let image: Electron.NativeImage | null = null
    const fin = Date.now() + PDF_PATIENCE
    for (let essai = 0; Date.now() < fin; essai++) {
      await patienter(essai === 0 ? PDF_REPIT : 400)
      if (w.isDestroyed() || pdfsArretes) return null
      const prise = await avecPatience(w.webContents.capturePage(), PDF_PATIENCE)
      if (!prise.isEmpty() && varie(prise)) {
        image = prise
        break
      }
    }
    if (!image) return null

    const t = image.getSize()
    if (!t.width || !t.height) return null
    const k = Math.min(1, COTE / Math.max(t.width, t.height))
    const petite =
      k < 1
        ? image.resize({ width: Math.round(t.width * k), height: Math.round(t.height * k) })
        : image
    return `data:image/jpeg;base64,${petite.toJPEG(QUALITE_PDF).toString('base64')}`
  } finally {
    if (!w.isDestroyed()) w.destroy()
  }
}

/**
 * Tous les PDF qui attendent, un par un. Appelé avant d'ouvrir le graveur :
 * deux fenêtres qui décodent en même temps, sur la machine d'une table de jeu,
 * c'est du bruit pour rien.
 */
export async function graverPdfs(): Promise<void> {
  if (pdfsArretes || !restePdfs()) return
  for (let n = 0; n < PDF_MAX; n++) {
    if (pdfsArretes) return
    const job = prochainPdf()
    if (!job) break
    let vignette: string | null = null
    let erreur: string | null = null
    try {
      vignette = await pageDe(job.abs, job.page)
      if (!vignette) erreur = `page ${job.page} illisible`
    } catch (e) {
      erreur = `${job.titre} — ${(e as Error)?.message ?? e}`
    }
    if (pdfsArretes) return
    ranger({ id: job.id, sig: job.sig, width: null, height: null, duration: null, vignette, erreur })
    if (erreur) console.warn(`[examen] pdf ${job.id} : ${erreur}`)
    annoncer()
  }
  annoncer(true)
}

/* ============================================================
   Le graveur
   ============================================================ */

let graveur: BrowserWindow | null = null
let attente: NodeJS.Timeout | null = null
let faits = 0
let dernierAvis = 0

/** Prévenir les interfaces qu'il y a du neuf à montrer. Posé par `index.ts`. */
let avertir: (() => void) | null = null
export function auxNouvelles(fn: () => void): void {
  avertir = fn
}

/** Au plus une annonce toutes les trois secondes : l'arbre se relit en entier. */
function annoncer(force = false): void {
  const t = Date.now()
  if (!force && t - dernierAvis < 3000) return
  dernierAvis = t
  avertir?.()
}

function graveurUrl(): { url?: string; file?: string } {
  if (process.env.ELECTRON_RENDERER_URL) {
    return { url: `${process.env.ELECTRON_RENDERER_URL}/examen.html` }
  }
  return { file: join(__dirname, '../renderer/examen.html') }
}

/**
 * Ouvre le graveur s'il y a du travail. Rien de visible : la fenêtre ne
 * s'affiche jamais et ne paraît pas dans la barre des tâches. Le bridage des
 * fenêtres en arrière-plan est levé, sans quoi Chromium endormirait le
 * décodeur d'une fenêtre qu'il croit oubliée.
 */
function ouvrir(): void {
  if (graveur && !graveur.isDestroyed()) return
  if (!reste()) return

  faits = 0
  graveur = new BrowserWindow({
    show: false,
    width: 480,
    height: 320,
    skipTaskbar: true,
    title: 'Examen des médias',
    icon: cheminIcone(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false
    }
  })
  graveur.on('closed', () => {
    graveur = null
  })
  graveur.webContents.on('render-process-gone', (_e, d) => {
    console.error('[examen] le graveur est tombé :', d.reason)
    fermer()
  })

  const cible = graveurUrl()
  if (cible.url) void graveur.loadURL(cible.url)
  else void graveur.loadFile(cible.file!)
}

function fermer(): void {
  const w = graveur
  graveur = null
  if (w && !w.isDestroyed()) w.destroy()
}

/**
 * Il y a peut-être du neuf à regarder. Appelé à chaque relecture du dossier,
 * donc très souvent pendant une copie de fichiers : on attend que ça se calme.
 */
export function planifier(): void {
  if (attente) clearTimeout(attente)
  attente = setTimeout(() => {
    attente = null
    pdfsArretes = false
    /* Les PDF d'abord, puis le graveur : l'un et l'autre décodent, et la
       machine d'une table de jeu n'a pas à le faire deux fois de suite. */
    graverPdfs()
      .catch((e) => console.error('[examen] pdf non gravés :', e))
      .finally(() => {
        try {
          ouvrir()
        } catch (e) {
          console.error('[examen] impossible d’ouvrir le graveur :', e)
        }
      })
  }, 1200)
}

/** Le projet se ferme : le graveur n'a plus rien à examiner. */
export function arreter(): void {
  if (attente) {
    clearTimeout(attente)
    attente = null
  }
  pdfsArretes = true
  fermer()
}

/* ---------------- ce que le graveur appelle ---------------- */

export function suivant(): ExamenJob | null {
  try {
    return prochain()
  } catch (e) {
    console.error('[examen] file d’attente illisible :', e)
    return null
  }
}

export function fait(f: ExamenFait): void {
  try {
    ranger(f)
    faits++
    if (f.erreur) console.warn(`[examen] ${f.id} : ${f.erreur}`)
    annoncer()
  } catch (e) {
    console.error('[examen] résultat non rangé :', e)
  }
}

export function fini(): void {
  if (faits) console.log(`[examen] ${faits} médias examinés`)
  balayer()
  annoncer(true)
  fermer()
}

/* ============================================================
   Ce qu'on peut en dire à la fenêtre des paramètres
   ============================================================ */

/**
 * Où en est le graveur : s'il travaille, et combien de médias attendent.
 *
 * Il tourne caché — c'est bien — mais une bibliothèque qui met vingt minutes
 * à se couvrir de vignettes laisse croire à une panne. Une ligne suffit à
 * dire que ça avance.
 */
export function etat(): { actif: boolean; reste: number } {
  return { actif: !!graveur && !graveur.isDestroyed(), reste: reste() }
}

/**
 * Tout réexaminer, du premier au dernier.
 *
 * On efface les signatures : chaque média redevient inconnu, et la file se
 * remplit d'un coup. C'est le geste qu'on fait quand une vignette est fausse,
 * ou quand le graveur a appris à voir quelque chose qu'il ne voyait pas.
 */
export function toutRegraver(): number {
  if (!isDbOpen()) return 0
  const r = getDb()
    .prepare(`UPDATE item SET meta_sig = NULL WHERE campaign_id = ?`)
    .run(activeCampaignId())
  planifier()
  return r.changes
}
