/**
 * Les murs invisibles d'un lieu — ce qui arrête le pas, ce qui coupe la vue.
 *
 * Ce dépôt est isolé de `display.ts` au même titre que les annotations : rien
 * de ce qu'il renvoie ne rejoint l'état de diffusion, donc rien ne peut
 * atteindre la fenêtre des joueurs. Un mur sert à empêcher et à calculer,
 * jamais à être montré.
 */
import { getDb } from '../index'
import * as places from './places'
import * as ouvertures from './ouvertures'
import * as lumieres from './lumieres'
import { echelleDe } from './echelle'
import * as reglages from './reglages'
import { lireCampagne } from '@shared/reglages'
import { dansForme, formesDesMurs, pointInterieur } from '@shared/pieces'
import {
  MUR_NATURES,
  type CalqueBrouillard,
  type Mur,
  type NatureMur,
  type PointMur
} from '@shared/types'

const SELECT = `
  SELECT id, place_id AS placeId, nature, pts, ouverte
    FROM mur`

const clamp = (v: number): number => Math.min(1, Math.max(0, v))

/**
 * Les points tels qu'ils sortent de la base. On se méfie de ce qu'on relit :
 * un JSON abîmé ne doit pas empêcher le lieu de s'ouvrir, il doit seulement
 * donner un trait vide, que le MJ verra manquer.
 */
function toPoints(brut: unknown): PointMur[] {
  if (typeof brut !== 'string') return []
  try {
    const v = JSON.parse(brut)
    if (!Array.isArray(v)) return []
    return v
      .filter((p) => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]))
      .map((p) => [clamp(p[0]), clamp(p[1])] as PointMur)
  } catch {
    return []
  }
}

function toMur(r: any): Mur {
  return {
    id: r.id,
    placeId: r.placeId,
    nature: (r.nature in MUR_NATURES ? r.nature : 'mur') as NatureMur,
    pts: toPoints(r.pts),
    /* `ouverte` en base, `ouvert` ici : c'est d'un rideau qu'on parle
       maintenant, plus d'une porte. Voir la migration 40. */
    ouvert: !!r.ouverte
  }
}

export function listMurs(placeId: number | null): Mur[] {
  if (placeId == null) return []
  return (getDb().prepare(`${SELECT} WHERE place_id = ? ORDER BY ord, id`).all(placeId) as any[]).map(
    toMur
  )
}

export function getMur(id: number): Mur | null {
  const r = getDb().prepare(`${SELECT} WHERE id = ?`).get(id)
  return r ? toMur(r) : null
}

/** Un trait de moins de deux points ne barre rien : on ne l'enregistre pas. */
const enJson = (pts: PointMur[]): string =>
  JSON.stringify(pts.map(([x, y]) => [Number(clamp(x).toFixed(5)), Number(clamp(y).toFixed(5))]))

export function addMur(input: {
  placeId: number
  nature: NatureMur
  pts: PointMur[]
}): Mur | null {
  if (!input.pts || input.pts.length < 2) return null
  const db = getDb()
  const ord =
    ((db.prepare(`SELECT MAX(ord) AS m FROM mur WHERE place_id = ?`).get(input.placeId) as any)?.m ??
      -1) + 1
  const info = db
    .prepare(
      `INSERT INTO mur (place_id, nature, pts, ord)
       VALUES (@placeId, @nature, @pts, @ord)`
    )
    .run({
      placeId: input.placeId,
      nature: input.nature in MUR_NATURES ? input.nature : 'mur',
      pts: enJson(input.pts),
      ord
    })
  return getMur(Number(info.lastInsertRowid))
}

export function updateMur(
  id: number,
  patch: { nature?: NatureMur; pts?: PointMur[]; ouvert?: boolean }
): Mur | null {
  const cur = getMur(id)
  if (!cur) return null
  const pts = patch.pts && patch.pts.length >= 2 ? patch.pts : cur.pts
  const nature = patch.nature && patch.nature in MUR_NATURES ? patch.nature : cur.nature
  getDb()
    .prepare(`UPDATE mur SET nature = @nature, pts = @pts, ouverte = @ouverte WHERE id = @id`)
    .run({
      id,
      nature,
      pts: enJson(pts),
      /* Un trait qui cesse d'être un rideau se referme : un mur « ouvert »
         n'aurait aucun sens, et voilerait le jour où on le retracerait. */
      ouverte: nature === 'rideau' ? ((patch.ouvert ?? cur.ouvert) ? 1 : 0) : 0
    })
  return getMur(id)
}

export function removeMur(id: number): void {
  getDb().prepare(`DELETE FROM mur WHERE id = ?`).run(id)
}

/**
 * Les pièces d'un étage suivent ses murs.
 *
 * Un lieu tracé sur un plan garde son contour en base, et la fiche du lieu ne
 * lit que lui. Ce contour se recalait dans l'interface, seulement quand le
 * plan était ouvert en mode murs : une retouche faite ailleurs — une autre
 * session, la base elle-même — laissait des fiches à l'ancienne, et le plan du
 * niveau ne disait plus la même chose que les fiches. On recale donc ici,
 * après chaque geste sur un mur, dans le même échange : le contour se défait
 * avec le geste.
 *
 * Chaque forme fermée revient au lieu dont le point d'accroche tombe dedans.
 * Deux lieux dans la même forme : on ne choisit pas, on ne touche à rien — le
 * volet des murs le signale, c'est au MJ de dire lequel va où.
 *
 * Dit si un contour a bougé, et les lieux nés d'une coupe : un mur qui
 * traverse un lieu en laisse une moitié sans nom, qui devient « <lieu>
 * (suite) ».
 */
export function recalerPieces(placeId: number): { touche: boolean; suites: string[] } {
  const niveau = places.getPlace(placeId)
  if (!niveau) return { touche: false, suites: [] }
  let touche = false
  const pieces = (
    getDb().prepare(`SELECT id FROM place WHERE parent_id = ? AND tier = 'lieu'`).all(placeId) as {
      id: number
    }[]
  )
    .map((r) => places.getPlace(r.id))
    .filter((q): q is NonNullable<typeof q> => !!q)
  /* Un lieu dont le point d'accroche est sorti de son propre contour — un
     couloir en L ancré à son centre de gravité — ne retrouverait plus sa
     pièce : on le raccroche à un point de son contour. */
  for (const q of pieces)
    if (q.zone && q.ancre && !dansForme(q.ancre, q.zone)) {
      q.ancre = pointInterieur(q.zone)
      places.setZone(q.id, q.zone, q.ancre)
      touche = true
    }
  const formes = formesDesMurs(listMurs(placeId))
  const changes: { nom: string; avant: PointMur[] }[] = []
  const libres: typeof formes = []
  for (const f of formes) {
    const ici = pieces.filter((q) => q.ancre && dansForme(q.ancre, f.pts))
    if (ici.length === 0) libres.push(f)
    if (ici.length !== 1) continue
    const lieu = ici[0]
    if (JSON.stringify(lieu.zone ?? []) === JSON.stringify(f.pts)) continue
    if (lieu.zone) changes.push({ nom: lieu.name, avant: lieu.zone })
    places.setZone(lieu.id, f.pts, lieu.ancre ?? f.centre)
    touche = true
  }
  const suites: string[] = []
  if (niveau.tier === 'niveau')
    for (const f of libres) {
      const coupe = changes.find((c) => dansForme(f.centre, c.avant))
      if (!coupe) continue
      const neuf = places.upsertPlace({ tier: 'lieu', parentId: placeId, name: `${coupe.nom} (suite)` })
      places.setZone(neuf.id, f.pts, f.centre)
      suites.push(`Le mur coupe « ${coupe.nom} » : l’autre moitié est « ${neuf.name} »`)
      touche = true
    }
  return { touche, suites }
}

/** Combien de traits par lieu, pour le dire en face de chaque lieu. */
export function murCounts(): Record<number, number> {
  const out: Record<number, number> = {}
  for (const r of getDb()
    .prepare(`SELECT place_id, COUNT(*) AS n FROM mur GROUP BY place_id`)
    .all() as { place_id: number; n: number }[]) {
    out[r.place_id] = r.n
  }
  return out
}

/**
 * Le calque d'ombre d'un lieu, d'un seul tenant : les murs, les ouvertures,
 * les lampes, et les deux réglages de la carte qui décident de ce qu'on
 * retient et jusqu'où l'on voit.
 *
 * Il vit ici plutôt que dans le canal IPC parce que trois procédés le
 * demandent maintenant : la fenêtre des joueurs, la Régie, et le serveur du
 * portable. Un seul endroit où il se compose, donc une seule chose à corriger
 * le jour où une carte gagnera un réglage de plus.
 */
export function calqueDe(placeId: number | null): CalqueBrouillard {
  const lieu = placeId == null ? null : places.getPlace(placeId)
  return {
    murs: listMurs(placeId),
    ouvertures: ouvertures.listOuvertures(placeId),
    lumieres: lumieres.listLumieres(placeId),
    lumGarde: !!lieu?.lumGarde,
    regardPortee: lieu?.regardPortee ?? null,
    regardOuverture: lireCampagne(reglages.tous()).mursAngle,
    porteurs: lumieres.porteursDeLumiere(placeId == null ? null : echelleDe(placeId).metres),
    astre: placeId == null ? null : places.cielDe(placeId).astre
  }
}
