/**
 * Les assets de l'atelier : sols, murs, portes, fenêtres et objets.
 *
 * Deux sources : le pack livré avec l'application, et les images que le MJ
 * importe, communes à toutes ses campagnes. Ce module ne lit aucun fichier :
 * il relit un catalogue et travaille sur des pixels à plat (RGBA), pour que
 * le découpage des planches et l'import partagent les mêmes traitements.
 */

export type TypeAsset = 'sol' | 'mur' | 'porte' | 'vitre' | 'objet'
export type SourceAsset = 'pack' | 'moi'

export interface AssetAtelier {
  /** `<source>:<id dans son catalogue>` — unique entre les deux sources. */
  id: string
  source: SourceAsset
  type: TypeAsset
  nom: string
  /** « Sols », « Chambre », « Horreur »… */
  categorie: string
  /** Relatif au dossier de sa source. */
  fichier: string
  /** Sol, mur : combien de cases une tuile couvre. */
  tuile?: number
  /** Objet : sa taille réelle, en cases. */
  l?: number
  h?: number
  /** Objet : ses blocages par défaut. */
  bloquePas?: boolean
  bloqueVue?: boolean
}

export interface CatalogueAtelier {
  v: 1
  assets: Omit<AssetAtelier, 'source'>[]
}

const TYPES: TypeAsset[] = ['sol', 'mur', 'porte', 'vitre', 'objet']
const texte = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const positif = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0

/** Un chemin qui reste dans son dossier : ni `..`, ni chemin absolu. */
const cheminSur = (f: string): boolean =>
  !/^[\\/]/.test(f) && !/^[a-z]:/i.test(f) && !f.split(/[\\/]/).includes('..')

/** Un catalogue tel qu'il sort d'un fichier ; une entrée invalide est écartée, pas le reste. */
export function lireCatalogue(brut: unknown, source: SourceAsset): AssetAtelier[] {
  let v: any = brut
  if (typeof brut === 'string')
    try {
      v = JSON.parse(brut)
    } catch {
      return []
    }
  if (!v || !Array.isArray(v.assets)) return []
  const out: AssetAtelier[] = []
  for (const a of v.assets) {
    if (!a || !texte(a.id) || !TYPES.includes(a.type) || !texte(a.nom) || !texte(a.fichier)) continue
    if (!cheminSur(a.fichier)) continue
    const id = a.id.startsWith(`${source}:`) ? a.id : `${source}:${a.id}`
    const asset: AssetAtelier = {
      id,
      source,
      type: a.type,
      nom: a.nom.trim(),
      categorie: texte(a.categorie) ? a.categorie.trim() : 'Divers',
      fichier: a.fichier
    }
    if (a.type === 'sol' || a.type === 'mur') asset.tuile = positif(a.tuile) ? a.tuile : 2
    if (a.type === 'objet') {
      asset.l = positif(a.l) ? a.l : 1
      asset.h = positif(a.h) ? a.h : 1
      asset.bloquePas = !!a.bloquePas
      asset.bloqueVue = !!a.bloqueVue
    }
    out.push(asset)
  }
  return out
}

/* ---------------- pixels ---------------- */

/** La boîte des pixels qui comptent (alpha > 8) ; `null` si l'image est vide. */
export function boiteOpaque(
  rgba: Uint8ClampedArray,
  w: number,
  h: number
): { x: number; y: number; w: number; h: number } | null {
  let x0 = w
  let y0 = h
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (rgba[(y * w + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}

/** Fondu sur un axe : près des bords, la copie décalée d'une demi-taille. */
function raccorderAxe(src: Uint8ClampedArray, w: number, h: number, horizontal: boolean): Uint8ClampedArray {
  const out = new Uint8ClampedArray(src.length)
  const n = horizontal ? w : h
  const bande = Math.max(1, Math.floor(n / 8))
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const t = horizontal ? x : y
      const bord = Math.min(t, n - 1 - t)
      const poids = bord < bande ? 1 - bord / bande : 0
      const i = (y * w + x) * 4
      const sx = horizontal ? (x + Math.floor(w / 2)) % w : x
      const sy = horizontal ? y : (y + Math.floor(h / 2)) % h
      const j = (sy * w + sx) * 4
      for (let k = 0; k < 4; k++) out[i + k] = Math.round(src[i + k] * (1 - poids) + src[j + k] * poids)
    }
  return out
}

/**
 * Atténue la couture d'une texture qui ne se raccorde pas tout à fait.
 *
 * Près de chaque bord, on fond l'image avec sa copie décalée d'une
 * demi-taille : cette copie, elle, se raccorde à ses bords (ce sont deux
 * pixels voisins de l'original), et sa propre couture tombe au milieu, là où
 * on ne la prend pas. Un mur ne se répète qu'en longueur.
 */
export function raccorder(
  rgba: Uint8ClampedArray,
  w: number,
  h: number,
  horizontalSeulement: boolean
): Uint8ClampedArray {
  const a = raccorderAxe(rgba, w, h, true)
  return horizontalSeulement ? a : raccorderAxe(a, w, h, false)
}

/* Les seuils de « magenta » : min(r, b) − g. Au-dessous, c'est l'objet ; au-dessus, le fond. */
const MAGENTA_BAS = 60
const MAGENTA_HAUT = 190

/**
 * Le fond magenta d'une planche devient transparent.
 *
 * Un pixel du bord mêle l'objet et le fond : on estime la part de magenta, on
 * la retire de sa couleur et elle devient sa transparence. Ce qui évite le
 * liseré rose qu'un simple seuil laisserait autour de chaque meuble. Ce qui
 * reste opaque mais rosi perd son reflet.
 */
export function detourerMagenta(rgba: Uint8ClampedArray): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba)
  for (let i = 0; i < out.length; i += 4) {
    const r = out[i]
    const g = out[i + 1]
    const b = out[i + 2]
    const m = Math.min(r, b) - g
    if (m <= MAGENTA_BAS) {
      /* Le reflet : un pixel resté opaque mais teinté de rose par le fond —
         la dentelle, un bord de cadre. On ramène le rouge et le bleu vers le
         vert de ce qu'ils ont en commun de trop. Un bois brun (bleu sous le
         vert) n'a pas de reflet et ne bouge pas. */
      if (m > 0) {
        out[i] = r - m * 0.85
        out[i + 2] = b - m * 0.85
      }
      continue
    }
    const k = Math.min(1, (m - MAGENTA_BAS) / (MAGENTA_HAUT - MAGENTA_BAS))
    if (k >= 1) {
      out[i + 3] = 0
      continue
    }
    const reste = 1 - k
    const r2 = (r - k * 255) / reste
    const g2 = g / reste
    const b2 = (b - k * 255) / reste
    const m2 = Math.min(r2, b2) - g2
    out[i] = m2 > 0 ? r2 - m2 * 0.85 : r2
    out[i + 1] = g2
    out[i + 2] = m2 > 0 ? b2 - m2 * 0.85 : b2
    out[i + 3] = Math.round(out[i + 3] * reste)
  }
  return out
}

/**
 * Sur fond noir, la clarté devient l'opacité : un fil de toile d'araignée
 * laisse voir le sol au travers, comme une vraie toile.
 */
export function lumiereEnAlpha(rgba: Uint8ClampedArray): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba)
  for (let i = 0; i < out.length; i += 4) {
    const l = Math.max(out[i], out[i + 1], out[i + 2])
    if (l === 0) {
      out[i + 3] = 0
      continue
    }
    const f = 255 / l
    out[i] = out[i] * f
    out[i + 1] = out[i + 1] * f
    out[i + 2] = out[i + 2] * f
    out[i + 3] = l
  }
  return out
}
