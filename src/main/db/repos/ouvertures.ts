/**
 * Les portes et les fenêtres — posées sur un mur, jamais tracées à part.
 *
 * Comme les murs dont elles dépendent, rien d'ici ne rejoint l'état de
 * diffusion : une ouverture sert à laisser passer un pas ou un regard, pas à
 * être montrée. Elle disparaît avec le mur qui la porte (ON DELETE CASCADE) —
 * une porte sans mur n'ouvre sur rien.
 */
import { getDb } from '../index'
import { OUVERTURE_NATURES, type NatureOuverture, type Ouverture } from '@shared/types'
import * as reglages from './reglages'
import { lireCampagne } from '@shared/reglages'

const SELECT = `
  SELECT o.id, o.mur_id AS murId, o.nature, o.d, o.largeur, o.ouverte, o.verrouillee
    FROM ouverture o`

const clamp = (v: number, min = 0, max = 1): number => Math.min(max, Math.max(min, v))

/** La plus petite ouverture qui veuille dire quelque chose, et la plus grande. */
const LARGEUR = { min: 0.01, max: 0.3 }

function toOuverture(r: any): Ouverture {
  return {
    id: r.id,
    murId: r.murId,
    nature: (r.nature in OUVERTURE_NATURES ? r.nature : 'porte') as NatureOuverture,
    d: clamp(r.d),
    largeur: clamp(r.largeur, LARGEUR.min, LARGEUR.max),
    ouverte: !!r.ouverte,
    verrouillee: !!r.verrouillee
  }
}

/** Toutes les ouvertures des murs d'un lieu. */
export function listOuvertures(placeId: number | null): Ouverture[] {
  if (placeId == null) return []
  return (
    getDb()
      .prepare(
        `${SELECT} JOIN mur m ON m.id = o.mur_id WHERE m.place_id = ? ORDER BY o.mur_id, o.d, o.id`
      )
      .all(placeId) as any[]
  ).map(toOuverture)
}

export function getOuverture(id: number): Ouverture | null {
  const r = getDb().prepare(`${SELECT} WHERE o.id = ?`).get(id)
  return r ? toOuverture(r) : null
}

export function addOuverture(input: {
  murId: number
  nature: NatureOuverture
  d: number
  largeur?: number
}): Ouverture | null {
  const mur = getDb().prepare(`SELECT id FROM mur WHERE id = ?`).get(input.murId)
  if (!mur) return null
  const info = getDb()
    .prepare(
      `INSERT INTO ouverture (mur_id, nature, d, largeur, ouverte, verrouillee)
       VALUES (@murId, @nature, @d, @largeur, 0, 0)`
    )
    .run({
      murId: input.murId,
      nature: input.nature in OUVERTURE_NATURES ? input.nature : 'porte',
      d: clamp(input.d),
      /* La largeur d'usine n'est plus une constante : c'est un réglage de la
         campagne, posé une fois pour toutes les cartes qui n'ont rien retenu. */
      largeur: clamp(
        input.largeur ?? lireCampagne(reglages.tous()).mursLargeur,
        LARGEUR.min,
        LARGEUR.max
      )
    })
  return getOuverture(Number(info.lastInsertRowid))
}

export function updateOuverture(
  id: number,
  patch: {
    nature?: NatureOuverture
    d?: number
    largeur?: number
    ouverte?: boolean
    verrouillee?: boolean
  }
): Ouverture | null {
  const cur = getOuverture(id)
  if (!cur) return null
  const verrouillee = patch.verrouillee !== undefined ? patch.verrouillee : cur.verrouillee
  /* Verrouiller, c'est refermer : une porte qu'on ferme à clé ne reste pas
     ouverte, et l'état enregistré ne doit pas dire le contraire. */
  const ouverte = verrouillee
    ? false
    : patch.ouverte !== undefined
      ? patch.ouverte
      : cur.ouverte
  getDb()
    .prepare(
      `UPDATE ouverture SET nature = @nature, d = @d, largeur = @largeur,
                            ouverte = @ouverte, verrouillee = @verrouillee
        WHERE id = @id`
    )
    .run({
      id,
      nature: patch.nature && patch.nature in OUVERTURE_NATURES ? patch.nature : cur.nature,
      d: patch.d !== undefined ? clamp(patch.d) : cur.d,
      largeur:
        patch.largeur !== undefined
          ? clamp(patch.largeur, LARGEUR.min, LARGEUR.max)
          : cur.largeur,
      ouverte: ouverte ? 1 : 0,
      verrouillee: verrouillee ? 1 : 0
    })
  return getOuverture(id)
}

export function removeOuverture(id: number): void {
  getDb().prepare(`DELETE FROM ouverture WHERE id = ?`).run(id)
}

/**
 * Referme toutes les portes d'un lieu — celles qui sont verrouillées le sont
 * déjà. On s'en sert au début d'un essai : une maison s'essaie portes closes,
 * sinon le brouillard est levé avant d'avoir commencé.
 */
export function fermerLesPortes(placeId: number): number {
  const info = getDb()
    .prepare(
      `UPDATE ouverture SET ouverte = 0
        WHERE nature = 'porte' AND ouverte = 1
          AND mur_id IN (SELECT id FROM mur WHERE place_id = ?)`
    )
    .run(placeId)
  return info.changes
}
