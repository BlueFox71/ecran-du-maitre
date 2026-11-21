/**
 * Le serveur du jeu World of Warcraft, dans l'Écran du Maître.
 *
 * Il remplace l'ancien `serveur.js` (et sa fenêtre noire) : même adresses,
 * mêmes échanges, si bien que l'Arbre de talents, l'Aventure et l'éditeur de
 * cartes n'ont pas vu la différence.
 *
 * Deux dossiers, et c'est tout l'intérêt :
 *  — **le code** du jeu (les pages, l'éditeur de cartes, le catalogue
 *    d'objets) voyage avec l'Écran : `resources/wow/Application` ;
 *  — **les données** (Sauvegardes, Images) restent dans un dossier du disque,
 *    celui de la table : une mise à jour de l'Écran n'y touche jamais.
 *
 * Une adresse `/Application/Sauvegardes/…` ou `/Application/Images/…` va aux
 * données ; le reste de `/Application/…` au code. L'écriture (PUT) n'est
 * permise qu'aux `.json` de Sauvegardes et aux images d'un dossier d'Images,
 * comme avant.
 *
 * « La table » (qui est là, le courrier entre les fiches) vit en mémoire : le
 * module Azeroth la lit et y écrit sans passer par le réseau.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises'
import { existsSync, statSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { app } from 'electron'

export const PORT_DEBUT = 8730
export const PORT_FIN = 8739

/** Le code du jeu : à côté de l'exécutable une fois installé, dans `resources` en dev. */
export function dossierCode(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'wow', 'Application')
    : join(app.getAppPath(), 'resources', 'wow', 'Application')
}

const IMG_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp']
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.md': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
}
/** Une image déposée ne dépasse pas ça : une galerie, pas un disque dur. */
const CORPS_MAX = 60 * 1024 * 1024

/* ---------------- la table ---------------- */

export interface Present {
  id: string
  nom: string
  classe: string
  vu: number
  etat: unknown
}
const PRESENTS = new Map<string, Present>()
const BOITES = new Map<string, unknown[]>()
const PRESENCE_MS = 15000

const idTable = (s: unknown): string =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 40)

const frais = (): Present[] => {
  const t = Date.now()
  return [...PRESENTS.values()].filter((p) => t - p.vu < PRESENCE_MS)
}

/** Toute la table, pour le MJ. */
export function presents(): Present[] {
  return frais()
}

/** Dépose un envoi dans la boîte de chacun ; il le relève à sa prochaine présence. */
export function deposer(de: string, nom: string, a: string[], quoi: unknown): void {
  for (const id of a.map(idTable).filter(Boolean)) {
    const b = BOITES.get(id) ?? []
    b.push({ de: idTable(de), nom: String(nom ?? '').slice(0, 60), quoi, t: Date.now() })
    if (b.length > 50) b.splice(0, b.length - 50)
    BOITES.set(id, b)
  }
}

/* ---------------- le serveur ---------------- */

let serveur: Server | null = null
let port: number | null = null
let donnees: string | null = null
/** Un ancien lanceur (Lancer-le-jeu.cmd) qui tient un port de la plage. */
let ancienPort: number | null = null

export function portActuel(): number | null {
  return port
}
export function ancienLanceur(): number | null {
  return ancienPort
}

/** Les adresses de ce PC que les tablettes tapent : Wi-Fi, ou Tailscale (100.64/10). */
export function adresses(distance = false): string[] {
  if (!port) return []
  const tailscale = (ip: string): boolean => {
    const [a, b] = ip.split('.').map(Number)
    return a === 100 && b >= 64 && b <= 127
  }
  const out: string[] = []
  for (const liste of Object.values(networkInterfaces())) {
    for (const a of liste ?? []) {
      if (a.family === 'IPv4' && !a.internal && tailscale(a.address) === distance)
        out.push(`http://${a.address}:${port}/Application/Arbre-de-talents.html`)
    }
  }
  return out
}

function envoyer(res: ServerResponse, code: number, type: string, corps: string | Buffer): void {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' })
  res.end(corps)
}
const json = (res: ServerResponse, o: unknown): void => envoyer(res, 200, TYPES['.json'], JSON.stringify(o))

function lireCorps(req: IncomingMessage): Promise<Buffer | null> {
  return new Promise((ok) => {
    const morceaux: Buffer[] = []
    let taille = 0
    req.on('data', (c: Buffer) => {
      taille += c.length
      if (taille > CORPS_MAX) {
        req.destroy()
        ok(null)
        return
      }
      morceaux.push(c)
    })
    req.on('end', () => ok(Buffer.concat(morceaux)))
    req.on('error', () => ok(null))
  })
}
const lireJson = async (req: IncomingMessage): Promise<Record<string, unknown> | null> => {
  const b = await lireCorps(req)
  try {
    return b ? JSON.parse(b.toString('utf8')) : null
  } catch {
    return null
  }
}

const dedans = (base: string, abs: string): boolean => abs === base || abs.startsWith(base + sep)

/**
 * Où lire une adresse : dans les données ou dans le code. `null`, refusé.
 * Le reste de la racine (les images de classe d'à côté, de vieilles
 * références) se cherche à côté du dossier de données, comme avant.
 */
function chemin(url: string): { abs: string; donnees: boolean } | null {
  if (!donnees) return null
  let rel: string
  try {
    rel = decodeURIComponent(url.split('?')[0]).replace(/^\/+/, '')
  } catch {
    return null
  }
  const code = dossierCode()
  if (rel.startsWith('Application/') || rel === 'Application') {
    const reste = rel.slice('Application/'.length)
    if (/^(Sauvegardes|Images)(\/|$)/.test(reste)) {
      const abs = resolve(donnees, reste)
      return dedans(donnees, abs) ? { abs, donnees: true } : null
    }
    const abs = resolve(code, reste)
    if (!dedans(code, abs)) return null
    if (existsSync(abs)) return { abs, donnees: false }
    /* Ce que le code n'a pas (une musique, un fichier ajouté à la main) : dans les données. */
    const autre = resolve(donnees, reste)
    return dedans(donnees, autre) ? { abs: autre, donnees: true } : null
  }
  const racine = dirname(donnees)
  const abs = resolve(racine, rel)
  return dedans(racine, abs) ? { abs, donnees: true } : null
}

/** L'écriture : les .json de Sauvegardes, et une image juste sous Images\<classe>\. */
function inscriptible(abs: string): boolean {
  if (!donnees) return false
  const ext = extname(abs).toLowerCase()
  const save = join(donnees, 'Sauvegardes')
  const imgs = join(donnees, 'Images')
  if (ext === '.json' && abs.startsWith(save + sep)) return true
  if (IMG_EXT.includes(ext) && abs.startsWith(imgs + sep)) return relative(imgs, abs).split(sep).length === 2
  return false
}

async function galeries(): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {}
  if (!donnees) return out
  const imgs = join(donnees, 'Images')
  let dossiers: string[] = []
  try {
    dossiers = (await readdir(imgs, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name)
  } catch {
    return out
  }
  for (const d of dossiers) {
    try {
      out[d] = (await readdir(join(imgs, d)))
        .filter((f) => IMG_EXT.includes(extname(f).toLowerCase()))
        .sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }))
    } catch {
      /* dossier illisible : on passe */
    }
  }
  return out
}

async function repondre(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = (req.url ?? '/').split('?')[0]
  const q = new URLSearchParams((req.url ?? '').split('?')[1] ?? '')

  if (url === '/__sauvegardes') return json(res, { ecriture: true, ecran: true })
  if (url === '/__reseau') return json(res, { reseau: true, adresses: adresses(), distance: adresses(true) })
  if (url === '/__images') return json(res, await galeries())

  /* « Je suis là » : la fiche se signale (avec son état en POST), reçoit les autres et son courrier. */
  if (url === '/__table/presence') {
    const id = idTable(q.get('id'))
    if (!id) return envoyer(res, 400, TYPES['.txt'], 'id manquant')
    const corps = req.method === 'POST' ? await lireJson(req) : null
    const avant = PRESENTS.get(id)
    const etat = corps && typeof corps.etat === 'object' && corps.etat ? corps.etat : (avant?.etat ?? null)
    PRESENTS.set(id, {
      id,
      nom: String(q.get('nom') || id).slice(0, 60),
      classe: idTable(q.get('classe')),
      vu: Date.now(),
      etat
    })
    const courrier = BOITES.get(id) ?? []
    BOITES.delete(id)
    const autres = frais()
      .filter((p) => p.id !== id)
      .map((p) => ({ id: p.id, nom: p.nom, classe: p.classe }))
    return json(res, { presents: autres, courrier })
  }
  if (url === '/__table/envoi' && req.method === 'POST') {
    const o = await lireJson(req)
    if (!o || !Array.isArray(o.a) || !o.quoi) return envoyer(res, 400, TYPES['.txt'], 'envoi illisible')
    deposer(String(o.de ?? ''), String(o.nom ?? ''), o.a as string[], o.quoi)
    return json(res, { ok: true })
  }
  if (url === '/__table/etat') {
    return json(res, {
      presents: frais().map((p) => ({ id: p.id, nom: p.nom, classe: p.classe, vu: p.vu, etat: p.etat })),
      maintenant: Date.now()
    })
  }

  if (req.method === 'PUT') {
    const c = chemin(url)
    if (!c || !inscriptible(c.abs)) return envoyer(res, 403, TYPES['.txt'], 'écriture refusée')
    const data = await lireCorps(req)
    if (!data) return envoyer(res, 413, TYPES['.txt'], 'trop gros')
    try {
      await mkdir(dirname(c.abs), { recursive: true })
      await writeFile(c.abs, data)
      return json(res, { ok: true })
    } catch (e) {
      return envoyer(res, 500, TYPES['.txt'], e instanceof Error ? e.message : String(e))
    }
  }

  if (url === '/' || url === '/Application' || url === '/Application/') {
    res.writeHead(302, { Location: '/Application/Arbre-de-talents.html' })
    return void res.end()
  }
  const c = chemin(url)
  if (!c) return envoyer(res, 403, TYPES['.txt'], 'chemin refusé')
  try {
    if (statSync(c.abs).isDirectory()) return envoyer(res, 404, TYPES['.txt'], '404')
    const data = await readFile(c.abs)
    return envoyer(res, 200, TYPES[extname(c.abs).toLowerCase()] ?? 'application/octet-stream', data)
  } catch {
    return envoyer(res, 404, TYPES['.txt'], '404')
  }
}

/** Le port est-il tenu par un ancien serveur du jeu (la fenêtre noire) ? */
async function estUnAncienJeu(p: number): Promise<boolean> {
  try {
    const r = await fetch(`http://127.0.0.1:${p}/__sauvegardes`, { signal: AbortSignal.timeout(800) })
    const j = (await r.json()) as { ecriture?: boolean; ecran?: boolean }
    return !!j.ecriture && !j.ecran
  } catch {
    return false
  }
}

function ecouter(s: Server, p: number): Promise<boolean> {
  return new Promise((ok) => {
    const echec = (): void => {
      s.removeListener('listening', reussite)
      ok(false)
    }
    const reussite = (): void => {
      s.removeListener('error', echec)
      ok(true)
    }
    s.once('error', echec)
    s.once('listening', reussite)
    /* Toute la table : le Wi-Fi de la maison (et Tailscale). */
    s.listen(p, '0.0.0.0')
  })
}

/** Lance le serveur sur ces données (ou le garde s'il tourne déjà dessus). */
export async function demarrer(dossierDonnees: string): Promise<number | null> {
  if (serveur && donnees === dossierDonnees) return port
  arreter()
  donnees = dossierDonnees
  ancienPort = null
  const s = createServer((req, res) => {
    repondre(req, res).catch((e) => {
      if (!res.headersSent) envoyer(res, 500, TYPES['.txt'], e instanceof Error ? e.message : String(e))
    })
  })
  for (let p = PORT_DEBUT; p <= PORT_FIN; p++) {
    if (await ecouter(s, p)) {
      serveur = s
      port = p
      return p
    }
    if (ancienPort === null && (await estUnAncienJeu(p))) ancienPort = p
  }
  donnees = null
  return null
}

export function arreter(): void {
  serveur?.close()
  serveur = null
  port = null
}
