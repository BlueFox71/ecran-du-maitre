/**
 * Les assets de l'atelier, sur le disque.
 *
 * Le pack voyage avec l'application (`resources/atelier`, copié à côté de
 * l'exécutable). Les imports du MJ vivent dans son profil, hors de toute
 * campagne : une bibliothèque de meubles sert à toutes ses maisons.
 */
import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join, normalize, sep } from 'node:path'
import {
  appliquerRangement,
  lireCatalogue,
  type AssetAtelier,
  type SourceAsset
} from '@shared/atelierAssets'

export function dossierPack(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'atelier')
    : join(app.getAppPath(), 'resources', 'atelier')
}

export function dossierMoi(): string {
  const d = join(app.getPath('userData'), 'atelier')
  mkdirSync(d, { recursive: true })
  return d
}

const dossierDe = (s: SourceAsset): string => (s === 'pack' ? dossierPack() : dossierMoi())

function lire(s: SourceAsset): AssetAtelier[] {
  const f = join(dossierDe(s), 'catalogue.json')
  if (!existsSync(f)) return []
  try {
    return lireCatalogue(readFileSync(f, 'utf8'), s)
  } catch {
    return []
  }
}

/**
 * Le pack, rangé par thème, famille et rayon (`rangement.json`, à part du
 * catalogue que la découpe des planches réécrit). Les imports gardent leur
 * catégorie : ils sont réécrits sur le disque, le rangement n'a pas à s'y mêler.
 */
function lirePack(): AssetAtelier[] {
  const pack = lire('pack')
  const f = join(dossierPack(), 'rangement.json')
  if (!existsSync(f)) return pack
  try {
    return appliquerRangement(pack, readFileSync(f, 'utf8'))
  } catch {
    return pack
  }
}

/** Ce que l'atelier montre : tout le pack, puis les imports. */
export function tousLesAssets(): AssetAtelier[] {
  return [...lirePack(), ...lire('moi')]
}

/** Le chemin d'un fichier d'asset, ou `null` s'il sortirait de son dossier. */
export function cheminAsset(source: string, fichier: string): string | null {
  if (source !== 'pack' && source !== 'moi') return null
  const base = dossierDe(source)
  const abs = normalize(join(base, fichier))
  return abs.startsWith(base + sep) ? abs : null
}

function ecrireMoi(assets: AssetAtelier[]): void {
  const propres = assets.map(({ source: _s, ...a }) => ({ ...a, id: a.id.replace(/^moi:/, '') }))
  writeFileSync(join(dossierMoi(), 'catalogue.json'), JSON.stringify({ v: 1, assets: propres }, null, 2))
}

/** Un asset importé : l'image est déjà traitée par l'atelier (recadrée, raccordée). */
export function importer(
  meta: Omit<AssetAtelier, 'id' | 'source' | 'fichier'>,
  png: Uint8Array
): AssetAtelier {
  const id = crypto.randomUUID()
  const fichier = `${id}.png`
  writeFileSync(join(dossierMoi(), fichier), Buffer.from(png))
  const brut = { ...meta, id, fichier }
  const [asset] = lireCatalogue({ v: 1, assets: [brut] }, 'moi')
  if (!asset) {
    unlinkSync(join(dossierMoi(), fichier))
    throw new Error('Cet asset est incomplet : type, nom et image sont nécessaires')
  }
  ecrireMoi([...lire('moi'), asset])
  return asset
}

/** On ne retire que ses propres imports ; le pack reste. */
export function retirer(id: string): void {
  if (!id.startsWith('moi:')) throw new Error('Les assets livrés ne se retirent pas')
  const tous = lire('moi')
  const a = tous.find((x) => x.id === id)
  if (!a) return
  const abs = cheminAsset('moi', a.fichier)
  if (abs && existsSync(abs)) unlinkSync(abs)
  ecrireMoi(tous.filter((x) => x.id !== id))
}
