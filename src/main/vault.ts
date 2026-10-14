/**
 * Le protocole `jdr://` — la seule porte par laquelle les interfaces voient
 * un fichier du disque. Lecture seule, et cantonnée au dossier de la campagne :
 * un chemin qui tente d'en sortir est refusé.
 *
 * Deux hôtes, et deux seulement :
 *   `jdr://media/<chemin>` — un fichier de la bibliothèque ;
 *   `jdr://vignette/<id>.jpg` — une image gravée par l'examen (voir examen.ts),
 *   qui dort dans le dossier technique du projet et non dans la bibliothèque.
 *
 * Une image trop grande est servie, sous sa propre adresse, par sa copie
 * réduite (voir `PLAFONDS_COPIES`) : les interfaces n'en savent rien.
 */
import { existsSync, mkdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { net, protocol } from 'electron'
import { absOf, campaignRoot, insideRoot } from './library'
import { activeCampaignId, dataRoot, getDb, isDbOpen } from './db'
import type { SorteCopie } from '@shared/types'

/** URL servie aux interfaces pour un chemin relatif au dossier de campagne. */
export function mediaUrl(relPath: string | null): string | null {
  if (!relPath) return null
  return `jdr://media/${relPath.split('/').map(encodeURIComponent).join('/')}`
}

/* ---------------- les vignettes ---------------- */

/**
 * Elles dorment à côté de la base, dans le dossier technique du projet : une
 * vignette se régrave, elle n'a pas à survivre au projet, et le point devant le
 * nom la tient hors du balayage de la bibliothèque.
 */
export function vignettesDir(creer = false): string | null {
  const root = campaignRoot()
  if (!root) return null
  const v = join(root, '.ecran-du-maitre', 'vignettes')
  if (creer && !existsSync(v)) mkdirSync(v, { recursive: true })
  return v
}

export function vignettePath(id: number, creer = false): string | null {
  const v = vignettesDir(creer)
  return v ? join(v, `${id}.jpg`) : null
}

/**
 * L'URL d'une vignette. La date de gravure y sert de jeton de fraîcheur : sans
 * elle, le navigateur continuerait de montrer l'ancienne image d'un fichier
 * qui, lui, a changé.
 */
export function vignetteUrl(id: number, thumbAt: string | null): string | null {
  if (!thumbAt) return null
  return `jdr://vignette/${id}.jpg?v=${encodeURIComponent(thumbAt)}`
}

/* ---------------- les copies réduites ---------------- */

/** Où dort une copie réduite : à côté de la vignette, `<id>.<sorte>.webp`. */
export function copiePath(id: number, sorte: SorteCopie, creer = false): string | null {
  const v = vignettesDir(creer)
  return v ? join(v, `${id}.${sorte}.webp`) : null
}

/**
 * La copie réduite à servir à la place d'une image de la bibliothèque, ou nul
 * s'il faut l'original : l'image tient sous le plafond, l'examen n'est pas
 * encore passé, ou le fichier a changé depuis — une copie plus ancienne que
 * lui montrerait l'ancienne image.
 */
export function copieReduite(rel: string, sorte: SorteCopie): string | null {
  if (!/\.(jpe?g|png|webp|bmp|avif)$/i.test(rel) || !isDbOpen()) return null
  try {
    const r = getDb()
      .prepare(`SELECT id FROM item WHERE campaign_id = ? AND rel_path = ?`)
      .get(activeCampaignId(), rel) as { id: number } | undefined
    const copie = r ? copiePath(r.id, sorte) : null
    if (!copie || !existsSync(copie)) return null
    return statSync(copie).mtimeMs >= statSync(absOf(rel)).mtimeMs ? copie : null
  } catch {
    return null
  }
}

/** Le portrait du MJ vit hors de toute campagne : il suit le poste. */
export function profilDir(): string {
  return join(dataRoot(), 'profil-mj')
}

/* ---------------- le protocole ---------------- */

/**
 * Le graveur dessine les médias dans un canevas pour en tirer une vignette, et
 * un canevas où l'on dessine l'image d'une autre origine devient « teinté » :
 * on ne peut plus rien en relire. Comme `jdr:` est une origine à part entière,
 * il lui faut se déclarer partageable. Aucun risque au passage : ce protocole
 * n'existe que dans les fenêtres de l'application, jamais sur le réseau.
 */
function partageable(res: Response): Response {
  const headers = new Headers(res.headers)
  headers.set('Access-Control-Allow-Origin', '*')
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
}

const servir = async (abs: string): Promise<Response> =>
  partageable(await net.fetch(pathToFileURL(abs).toString()))

export function registerMediaProtocol(): void {
  protocol.handle('jdr', async (request) => {
    const url = new URL(request.url)
    const nom = decodeURIComponent(url.pathname).replace(/^\/+/, '')

    if (url.hostname === 'vignette') {
      const dir = vignettesDir()
      if (!dir || !/^\d+\.jpg$/.test(nom)) return new Response('Introuvable', { status: 404 })
      const abs = join(dir, nom)
      if (!existsSync(abs)) return new Response('Introuvable', { status: 404 })
      return servir(abs)
    }

    if (url.hostname === 'profil') {
      if (!/^portrait-\d+\.[a-z0-9]+$/.test(nom)) return new Response('Introuvable', { status: 404 })
      const abs = join(profilDir(), nom)
      if (!existsSync(abs)) return new Response('Introuvable', { status: 404 })
      return servir(abs)
    }

    if (url.hostname !== 'media') return new Response('Introuvable', { status: 404 })

    let abs: string
    try {
      abs = absOf(nom)
    } catch {
      return new Response('Aucun dossier de campagne', { status: 404 })
    }

    if (!insideRoot(abs) || !existsSync(abs)) return new Response('Interdit', { status: 403 })
    /* Une grande image part en copie réduite. Seul le graveur, qui doit
       mesurer l'original, demande `?original`. */
    if (!url.searchParams.has('original')) {
      const copie = copieReduite(nom, 'ecran')
      if (copie) return servir(copie)
    }
    return servir(abs)
  })
}

export function registerProtocolScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'jdr',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        bypassCSP: false
      }
    }
  ])
}
