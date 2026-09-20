import { getDb } from '../index'
import { mediaUrl } from '../../vault'
import { upsertCharacter } from './characters'
import type { Pion, PionsDuLieu } from '@shared/types'

/**
 * Les pions d'un lieu. Un pion est soit un personnage joueur — il prend son
 * portrait, ou ses initiales tant qu'il n'en a pas — soit n'importe quelle
 * image de la bibliothèque.
 */

/** Couleur déduite de l'identifiant : deux pions voisins ne se ressemblent pas. */
const PALETTE = ['brass', 'moss', 'iris', 'blood', 'neutral']
const colorFor = (n: number): string => PALETTE[Math.abs(n) % PALETTE.length]

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

interface Row {
  id: number
  place_id: number
  character_id: number | null
  item_id: number | null
  label: string | null
  x: number
  y: number
  ord: number
  rotation: number
  hidden: number
  char_name: string | null
  char_color: string | null
  portrait_path: string | null
  item_title: string | null
  item_path: string | null
}

const SELECT = `
  SELECT p.id, p.place_id, p.character_id, p.item_id, p.label, p.x, p.y,
         p.ord, p.rotation, p.hidden,
         c.name        AS char_name,
         c.color       AS char_color,
         pi.rel_path   AS portrait_path,
         i.title       AS item_title,
         i.rel_path    AS item_path
    FROM pion p
    LEFT JOIN character c ON c.id = p.character_id
    LEFT JOIN item pi     ON pi.id = c.portrait_item_id
    LEFT JOIN item i      ON i.id = p.item_id`

function toPion(r: Row): Pion {
  const label = r.label ?? r.char_name ?? r.item_title ?? 'Pion'
  return {
    id: r.id,
    placeId: r.place_id,
    characterId: r.character_id,
    itemId: r.item_id,
    label,
    url: mediaUrl(r.item_path ?? r.portrait_path),
    initials: initialsOf(label),
    /* La couleur choisie sur la fiche l'emporte ; sans elle, on la déduit de
       l'identifiant, pour que deux pions voisins ne se ressemblent pas. */
    color: r.char_color ?? colorFor(r.character_id ?? r.item_id ?? r.id),
    x: r.x,
    y: r.y,
    ord: r.ord,
    rotation: r.rotation,
    cache: !!r.hidden
  }
}

/**
 * Tous les pions d'un lieu, cachés compris. C'est la vue du MJ : la Régie et
 * le Pupitre travaillent dessus.
 */
export function listPions(placeId: number | null): Pion[] {
  if (placeId == null) return []
  return (
    getDb().prepare(`${SELECT} WHERE p.place_id = ? ORDER BY p.ord, p.id`).all(placeId) as Row[]
  ).map(toPion)
}

/**
 * Ceux que les joueurs voient — et rien d'autre.
 *
 * C'est la seule porte par laquelle un pion rejoint l'écran des joueurs, leur
 * téléphone, et le moniteur du rail qui prétend montrer ce qu'ils ont sous les
 * yeux. Un pion caché n'en sort pas, donc il ne peut pas être affiché par
 * mégarde : la garantie tient à la forme des données, pas à un drapeau qu'on
 * penserait à lire. Tout nouveau chemin vers les joueurs passe par ici.
 */
export function listPionsVus(placeId: number | null): Pion[] {
  return listPions(placeId).filter((p) => !p.cache)
}

export function pionSize(placeId: number | null): number {
  if (placeId == null) return 6
  const r = getDb().prepare(`SELECT pion_size FROM place WHERE id = ?`).get(placeId) as
    | { pion_size: number }
    | undefined
  return r?.pion_size ?? 6
}

export function setPionSize(placeId: number, size: number): void {
  const clamped = Math.min(24, Math.max(2, size))
  getDb().prepare(`UPDATE place SET pion_size = ? WHERE id = ?`).run(clamped, placeId)
}

export function addPion(input: {
  placeId: number
  characterId?: number | null
  itemId?: number | null
  label?: string | null
  x: number
  y: number
  /** Le poser déjà caché : le MJ le montrera quand la scène l'amènera. */
  cache?: boolean
}): Pion {
  const db = getDb()
  /*
   * Un joueur n'est pas à deux endroits à la fois. Son pion est unique : le
   * poser sur un autre lieu l'y **déménage** — il quitte le précédent — et le
   * reposer sur le même lieu ne fait que le déplacer sur l'image.
   */
  const poser = db.transaction((): number => {
    let ici: number | null = null
    if (input.characterId != null) {
      const poses = db
        .prepare(`SELECT id, place_id FROM pion WHERE character_id = ? ORDER BY id`)
        .all(input.characterId) as { id: number; place_id: number }[]
      for (const q of poses) {
        if (q.place_id === input.placeId && ici == null) ici = q.id
        else db.prepare(`DELETE FROM pion WHERE id = ?`).run(q.id)
      }
    }
    // Il était déjà là : rien ne naît, le pion glisse simplement.
    if (ici != null) {
      db.prepare(`UPDATE pion SET x = ?, y = ? WHERE id = ?`).run(clamp(input.x), clamp(input.y), ici)
      return ici
    }
    const ord =
      ((db.prepare(`SELECT MAX(ord) AS m FROM pion WHERE place_id = ?`).get(input.placeId) as any)
        ?.m ?? -1) + 1
    const info = db
      .prepare(
        `INSERT INTO pion (place_id, character_id, item_id, label, x, y, ord, hidden)
         VALUES (@placeId, @characterId, @itemId, @label, @x, @y, @ord, @hidden)`
      )
      .run({
        placeId: input.placeId,
        characterId: input.characterId ?? null,
        itemId: input.itemId ?? null,
        label: input.label ?? null,
        x: clamp(input.x),
        y: clamp(input.y),
        ord,
        hidden: input.cache ? 1 : 0
      })
    return Number(info.lastInsertRowid)
  })
  return getPion(poser())!
}

const clamp = (v: number): number => Math.min(0.99, Math.max(0.01, v))

export function getPion(id: number): Pion | null {
  const r = getDb().prepare(`${SELECT} WHERE p.id = ?`).get(id) as Row | undefined
  return r ? toPion(r) : null
}

export function movePion(id: number, x: number, y: number): Pion | null {
  getDb().prepare(`UPDATE pion SET x = ?, y = ? WHERE id = ?`).run(clamp(x), clamp(y), id)
  return getPion(id)
}

/**
 * Faire tourner un pion. L'angle se ramène toujours entre 0 et 360 : sans
 * cela, trente crans de molette laissaient un `rotation` de 450 en base, exact
 * mais illisible le jour où on le regarde.
 */
export function tournerPion(id: number, deg: number): Pion | null {
  const r = ((deg % 360) + 360) % 360
  getDb().prepare(`UPDATE pion SET rotation = ? WHERE id = ?`).run(r, id)
  return getPion(id)
}

/**
 * Le calque. « Devant », c'est prendre le plus grand `ord` du lieu et ajouter
 * un ; « derrière », prendre le plus petit et retrancher un. Rien à
 * renuméroter, et deux pions ne se disputent jamais la même place.
 */
export function calquePion(id: number, ou: 'devant' | 'derriere'): Pion | null {
  const db = getDb()
  const p = db.prepare(`SELECT place_id FROM pion WHERE id = ?`).get(id) as
    | { place_id: number }
    | undefined
  if (!p) return null
  const b = db
    .prepare(`SELECT MIN(ord) AS lo, MAX(ord) AS hi FROM pion WHERE place_id = ?`)
    .get(p.place_id) as { lo: number | null; hi: number | null }
  const ord = ou === 'devant' ? (b.hi ?? 0) + 1 : (b.lo ?? 0) - 1
  db.prepare(`UPDATE pion SET ord = ? WHERE id = ?`).run(ord, id)
  return getPion(id)
}

/**
 * Faire une fiche à un pion nommé — le rôdeur qui a fini par mériter un nom
 * propre, des points de vie et des notes.
 *
 * Le pion **ne bouge pas** : il garde sa place, son calque, son angle et sa
 * cachette. Ce qui change, c'est qu'il cesse de porter son nom lui-même pour
 * le tenir d'un personnage — et sa couleur, qui n'était jusque-là qu'une
 * déduction de son identifiant, devient celle de la fiche, pour qu'il reste
 * exactement le même jeton sur la carte.
 *
 * Le geste ne va que dans ce sens : on ne redéfait pas une fiche en pion.
 */
export function promouvoirPion(id: number, templateId: number): Pion | null {
  const db = getDb()
  const p = getPion(id)
  if (!p || p.characterId != null) return p

  return db.transaction(() => {
    const perso = upsertCharacter({
      templateId,
      kind: 'pnj',
      name: p.label,
      // La couleur qu'il avait déjà à l'écran, pour qu'il ne change pas de tête.
      color: p.color
    })
    db.prepare(`UPDATE pion SET character_id = ?, label = NULL WHERE id = ?`).run(perso.id, id)
    return getPion(id)
  })()
}

/** Le soustraire aux joueurs, ou le leur rendre. */
export function cacherPion(id: number, cache: boolean): Pion | null {
  getDb().prepare(`UPDATE pion SET hidden = ? WHERE id = ?`).run(cache ? 1 : 0, id)
  return getPion(id)
}

export function removePion(id: number): void {
  getDb().prepare(`DELETE FROM pion WHERE id = ?`).run(id)
}

/** Vide un lieu, et lui seul. */
export function clearPions(placeId: number): number {
  return getDb().prepare(`DELETE FROM pion WHERE place_id = ?`).run(placeId).changes
}

/**
 * Qui se trouve où, pour l'afficher en face de chaque lieu. On rend les
 * joueurs eux-mêmes — visage et couleur — et non leur nombre : en pleine
 * partie, le MJ cherche « où est Elias », pas « combien de pions ici ».
 * Le total, lui, sert encore aux messages qui parlent de la table entière.
 */
export function pionsParLieu(): Record<number, PionsDuLieu> {
  const out: Record<number, PionsDuLieu> = {}
  for (const r of getDb().prepare(`${SELECT} ORDER BY p.place_id, p.ord, p.id`).all() as Row[]) {
    const lieu = (out[r.place_id] ??= { count: 0, joueurs: [] })
    lieu.count++
    if (r.character_id == null) continue
    const pion = toPion(r)
    lieu.joueurs.push({
      characterId: r.character_id,
      name: pion.label,
      color: pion.color,
      url: pion.url,
      initials: pion.initials
    })
  }
  return out
}

