/** Reconnaissance des fichiers par extension : nature et type MIME. */
import { extname } from 'node:path'
import type { ItemKind } from '@shared/types'

const IMAGE = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.avif', '.svg'])
const VIDEO = new Set(['.mp4', '.webm', '.mkv', '.mov', '.m4v', '.avi'])
const AUDIO = new Set(['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac', '.opus'])
/** Les documents rédigés dans l'application sont des fichiers comme les autres. */
const DOC = new Set(['.html', '.htm'])

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.m4v': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.opus': 'audio/opus',
  '.pdf': 'application/pdf',
  '.html': 'text/html',
  '.htm': 'text/html'
}

export function kindOf(file: string): ItemKind {
  const e = extname(file).toLowerCase()
  if (IMAGE.has(e)) return 'image'
  if (VIDEO.has(e)) return 'video'
  if (AUDIO.has(e)) return 'audio'
  if (DOC.has(e)) return 'doc'
  if (e === '.pdf') return 'pdf'
  return 'other'
}

export function mimeOf(file: string): string {
  return MIME[extname(file).toLowerCase()] ?? 'application/octet-stream'
}

/** Extensions proposées par le sélecteur de fichiers à l'import. */
export const IMPORTABLE = [
  ...IMAGE, ...VIDEO, ...AUDIO, ...DOC, '.pdf'
].map((e) => e.slice(1))

export const IMAGE_EXT = [...IMAGE].map((e) => e.slice(1))
export const VIDEO_EXT = [...VIDEO].map((e) => e.slice(1))
export const AUDIO_EXT = [...AUDIO].map((e) => e.slice(1))
