/**
 * Les points de lumière — ce qui éclaire une carte.
 *
 * Une lumière n'est pas un décor : c'est elle qui décide de ce que les joueurs
 * voient. Leur regard ne porte que sur ce qui est éclairé — un couloir noir
 * reste noir même s'ils le regardent. Elle vit donc avec les murs, sur le lieu
 * qui porte la carte, et s'en va avec lui.
 *
 * Deux rayons : le **clair**, où l'on y voit comme en plein jour, et la
 * **pénombre**, jusqu'où la lueur porte encore. Le second est le bord extérieur
 * — jamais plus petit que le premier, sans quoi la lampe n'aurait pas de sens.
 */
import { getDb } from '../index'
import type { Lumiere } from '@shared/types'

const SELECT = `
  SELECT l.id, l.place_id AS placeId, l.x, l.y, l.clair, l.penombre, l.allumee, l.teinte
    FROM lumiere l`

/** Une couleur qu'on accepte d'écrire : #rgb ou #rrggbb, et rien d'autre. */
const teinteSure = (v: unknown, defaut = '#ffffff'): string =>
  typeof v === 'string' && /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(v.trim())
    ? v.trim().toLowerCase()
    : defaut

/** Les bornes d'un rayon, en part de la largeur de la carte. */
const RAYON = { min: 0.01, max: 1.5 }

const borne = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Number.isFinite(v) ? v : min))

function toLumiere(r: any): Lumiere {
  const clair = borne(r.clair, RAYON.min, RAYON.max)
  return {
    id: r.id,
    placeId: r.placeId,
    x: borne(r.x, 0, 1),
    y: borne(r.y, 0, 1),
    clair,
    /* La pénombre est le bord extérieur : elle ne rentre jamais dans le clair. */
    penombre: Math.max(clair, borne(r.penombre, RAYON.min, RAYON.max)),
    allumee: !!r.allumee,
    teinte: teinteSure(r.teinte)
  }
}

export function listLumieres(placeId: number | null): Lumiere[] {
  if (placeId == null) return []
  return (
    getDb().prepare(`${SELECT} WHERE l.place_id = ? ORDER BY l.id`).all(placeId) as any[]
  ).map(toLumiere)
}

export function getLumiere(id: number): Lumiere | null {
  const r = getDb().prepare(`${SELECT} WHERE l.id = ?`).get(id)
  return r ? toLumiere(r) : null
}

export function addLumiere(input: {
  placeId: number
  x: number
  y: number
  clair?: number
  penombre?: number
  teinte?: string
}): Lumiere | null {
  const lieu = getDb().prepare(`SELECT id FROM place WHERE id = ?`).get(input.placeId)
  if (!lieu) return null
  const clair = borne(input.clair ?? 0.09, RAYON.min, RAYON.max)
  const info = getDb()
    .prepare(
      `INSERT INTO lumiere (place_id, x, y, clair, penombre, allumee, teinte)
       VALUES (@placeId, @x, @y, @clair, @penombre, 1, @teinte)`
    )
    .run({
      placeId: input.placeId,
      x: borne(input.x, 0, 1),
      y: borne(input.y, 0, 1),
      clair,
      penombre: Math.max(clair, borne(input.penombre ?? clair * 1.8, RAYON.min, RAYON.max)),
      teinte: teinteSure(input.teinte)
    })
  return getLumiere(Number(info.lastInsertRowid))
}

export function updateLumiere(
  id: number,
  patch: {
    x?: number
    y?: number
    clair?: number
    penombre?: number
    allumee?: boolean
    teinte?: string
  }
): Lumiere | null {
  const av = getLumiere(id)
  if (!av) return null
  const clair = patch.clair === undefined ? av.clair : borne(patch.clair, RAYON.min, RAYON.max)
  const penombre =
    patch.penombre === undefined ? av.penombre : borne(patch.penombre, RAYON.min, RAYON.max)
  getDb()
    .prepare(
      `UPDATE lumiere
          SET x = @x, y = @y, clair = @clair, penombre = @penombre,
              allumee = @allumee, teinte = @teinte
        WHERE id = @id`
    )
    .run({
      id,
      x: patch.x === undefined ? av.x : borne(patch.x, 0, 1),
      y: patch.y === undefined ? av.y : borne(patch.y, 0, 1),
      clair,
      penombre: Math.max(clair, penombre),
      allumee: (patch.allumee === undefined ? av.allumee : patch.allumee) ? 1 : 0,
      teinte: patch.teinte === undefined ? av.teinte : teinteSure(patch.teinte, av.teinte)
    })
  return getLumiere(id)
}

/** Le rayon d'une torche portée, en part de la largeur de la carte. */
const TORCHE = 0.14

/**
 * Les personnages qui portent de la lumière.
 *
 * Rien n'est câblé à un système de jeu : l'effet d'un objet est une ligne
 * libre, et c'est **sa tête** qu'on lit. Si elle commence par « éclair » ou
 * par « lumi », l'objet éclaire. Le détail peut donner la portée en pour-cent
 * (« 20 % ») ; sans quoi c'est une torche ordinaire.
 *
 * Seul ce qui est **porté** compte : une lanterne au fond d'un sac n'éclaire
 * personne, et un objet posé dans un lieu n'est pas encore une lampe — celles
 * du décor se posent sur le plan, dans la fiche du lieu.
 */
export function porteursDeLumiere(): { characterId: number; rayon: number; objet: string }[] {
  const sansAccents = (v: string): string =>
    v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

  const lignes = getDb()
    .prepare(
      `SELECT p.character_id AS characterId, o.nom AS nom, o.effets AS effets
         FROM objet_placement p
         JOIN objet o ON o.id = p.objet_id
        WHERE p.port = 'pj' AND p.character_id IS NOT NULL AND p.etat = 'porte'`
    )
    .all() as { characterId: number; nom: string; effets: string | null }[]

  const out: { characterId: number; rayon: number; objet: string }[] = []
  for (const l of lignes) {
    let effets: { tete?: string; detail?: string }[] = []
    try {
      const v = JSON.parse(l.effets ?? '[]')
      if (Array.isArray(v)) effets = v
    } catch {
      continue
    }
    for (const e of effets) {
      const tete = sansAccents(String(e?.tete ?? ''))
      if (!tete.startsWith('eclair') && !tete.startsWith('lumi')) continue
      const part = /(\d+(?:[.,]\d+)?)\s*%/.exec(String(e?.detail ?? ''))
      const rayon = part ? Math.min(1.5, Math.max(0.01, Number(part[1].replace(',', '.')) / 100)) : TORCHE
      out.push({ characterId: l.characterId, rayon, objet: l.nom })
      break
    }
  }
  return out
}

export function removeLumiere(id: number): void {
  getDb().prepare(`DELETE FROM lumiere WHERE id = ?`).run(id)
}
