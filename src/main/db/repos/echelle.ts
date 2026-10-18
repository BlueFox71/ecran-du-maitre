/**
 * L'échelle des plans : combien de mètres fait la largeur d'une image.
 *
 * Sans elle, la taille d'un pion se réglait à la main, en part de la largeur
 * — minuscule sur un plan de village, énorme sur un placard. Avec elle, un
 * pion fait 1,5 m sur tous les plans, une case de jeu.
 *
 * Deux sources, la plus sûre d'abord : le trait que le MJ a tiré sur une
 * longueur connue, puis les portes déjà posées — une porte fait environ
 * 0,9 m, et la médiane de leurs largeurs donne l'échelle sans rien demander.
 * Une pièce tracée sur son étage n'a pas d'échelle à elle : elle partage
 * l'image de l'étage, donc son échelle.
 */
import { getDb } from '../index'
import { ALLURE_DEFAUT, ALLURE_MAX, ALLURE_MIN, type EchellePlan } from '@shared/types'

/** La largeur d'une porte, dans la réalité. */
export const PORTE_M = 0.9
/** La taille d'un pion, dans la réalité : une case de jeu. */
export const PION_M = 1.5
/** Les bornes d'un pion à l'écran, en pour cent de la largeur du plan. */
const PION_MIN = 0.2
const PION_MAX = 24

/** Le lieu qui porte le plan : l'étage d'une pièce découpée, sinon le lieu lui-même. */
export function planDe(placeId: number): number {
  const r = getDb()
    .prepare(`SELECT parent_id AS parentId, zone_pts AS zone FROM place WHERE id = ?`)
    .get(placeId) as { parentId: number | null; zone: string | null } | undefined
  return r?.zone && r.parentId != null ? r.parentId : placeId
}

/** Les mètres que fait la largeur du plan, et d'où on le sait. */
function largeurEnMetres(plan: number): { metres: number | null; source: EchellePlan['source']; portes: number } {
  const db = getDb()
  const fixe = db.prepare(`SELECT echelle FROM place WHERE id = ?`).get(plan) as
    | { echelle: number | null }
    | undefined
  const largeurs = (
    db
      .prepare(
        `SELECT o.largeur AS l FROM ouverture o JOIN mur m ON m.id = o.mur_id
          WHERE m.place_id = ? AND o.nature = 'porte' AND o.largeur > 0`
      )
      .all(plan) as { l: number }[]
  )
    .map((r) => r.l)
    .sort((a, b) => a - b)
  const portes = largeurs.length
  if (fixe?.echelle && fixe.echelle > 0) return { metres: fixe.echelle, source: 'trait', portes }
  if (!portes) return { metres: null, source: null, portes }
  const milieu = Math.floor(portes / 2)
  const mediane = portes % 2 ? largeurs[milieu] : (largeurs[milieu - 1] + largeurs[milieu]) / 2
  return { metres: PORTE_M / mediane, source: 'portes', portes }
}

/** L'échelle d'un lieu, et la taille que ses pions en tirent. */
export function echelleDe(placeId: number): EchellePlan {
  const plan = planDe(placeId)
  const { metres, source, portes } = largeurEnMetres(plan)
  const r = getDb()
    .prepare(`SELECT pion_size AS taille, pion_main AS main FROM place WHERE id = ?`)
    .get(placeId) as { taille: number; main: number } | undefined
  const main = !!r?.main
  const a = getDb().prepare(`SELECT allure FROM place WHERE id = ?`).get(plan) as
    | { allure: number | null }
    | undefined
  const aLEchelle =
    metres !== null ? Math.min(PION_MAX, Math.max(PION_MIN, (PION_M / metres) * 100)) : null
  return {
    planId: plan,
    metres,
    source,
    portes,
    pionMain: main,
    pionPourcent: !main && aLEchelle !== null ? aLEchelle : (r?.taille ?? 6),
    allure: a?.allure ?? ALLURE_DEFAUT,
    allureReglee: a?.allure != null
  }
}

/** Régler l'allure des pions de ce plan — ou `null`, revenir à celle d'usine. */
export function poserAllure(placeId: number, allure: number | null): EchellePlan {
  const ok =
    allure !== null && Number.isFinite(allure) ? Math.min(ALLURE_MAX, Math.max(ALLURE_MIN, allure)) : null
  getDb().prepare(`UPDATE place SET allure = ? WHERE id = ?`).run(ok, planDe(placeId))
  return echelleDe(placeId)
}

/** Fixer l'échelle au trait — ou `null`, revenir à l'estimation par les portes. */
export function etalonner(placeId: number, metres: number | null): EchellePlan {
  const ok = metres !== null && Number.isFinite(metres) && metres > 0 ? metres : null
  getDb().prepare(`UPDATE place SET echelle = ? WHERE id = ?`).run(ok, planDe(placeId))
  return echelleDe(placeId)
}

/** La taille des pions : à l'échelle, ou celle réglée à la main. */
export function poserPionMain(placeId: number, main: boolean): EchellePlan {
  getDb().prepare(`UPDATE place SET pion_main = ? WHERE id = ?`).run(main ? 1 : 0, placeId)
  return echelleDe(placeId)
}
