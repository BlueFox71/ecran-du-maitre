import { getDb } from '../index'
import { copierLigne } from '../copie'
import type { FicheDuLieu, LieuCarte, LieuScenario, SorteCarte } from '@shared/types'

/* ============================================================
   La fiche d'un lieu : ses scénarios possibles, ses découvertes et
   ses déclencheurs, les PNJ qu'on y croise. Les objets, eux, restent
   des exemplaires de la réserve (objet_placement). Rien n'en sort
   du poste du MJ.
   ============================================================ */

const SORTES: SorteCarte[] = ['decouverte', 'declencheur']

export function lireFiche(placeId: number): FicheDuLieu {
  const db = getDb()
  const scenarios = db
    .prepare(
      `SELECT id, place_id AS placeId, titre, info FROM lieu_scenario
        WHERE place_id = ? ORDER BY ord, id`
    )
    .all(placeId) as LieuScenario[]
  const objets = db.prepare(`SELECT objet_id AS id FROM lieu_carte_objet WHERE carte_id = ?`)
  const pnj = db.prepare(`SELECT character_id AS id FROM lieu_carte_pnj WHERE carte_id = ?`)
  const cartes = (
    db
      .prepare(
        `SELECT id, place_id AS placeId, sorte, titre, si, alors, fait, beat_id AS beatId
           FROM lieu_carte WHERE place_id = ? ORDER BY fait, ord, id`
      )
      .all(placeId) as (Omit<LieuCarte, 'fait' | 'objetIds' | 'pnjIds'> & { fait: number })[]
  ).map((r) => ({
    ...r,
    fait: !!r.fait,
    objetIds: (objets.all(r.id) as { id: number }[]).map((x) => x.id),
    pnjIds: (pnj.all(r.id) as { id: number }[]).map((x) => x.id)
  }))
  const pnjIds = (
    db
      .prepare(`SELECT character_id AS id FROM lieu_pnj WHERE place_id = ? ORDER BY ord, character_id`)
      .all(placeId) as { id: number }[]
  ).map((x) => x.id)
  return { scenarios, cartes, pnjIds }
}

/* ---------------- les scénarios ---------------- */

export function ajouterScenario(placeId: number, titre = ''): LieuScenario {
  const db = getDb()
  const { m } = db
    .prepare(`SELECT COALESCE(MAX(ord), -1) AS m FROM lieu_scenario WHERE place_id = ?`)
    .get(placeId) as { m: number }
  const info = db
    .prepare(`INSERT INTO lieu_scenario (place_id, ord, titre) VALUES (?, ?, ?)`)
    .run(placeId, m + 1, titre)
  return { id: Number(info.lastInsertRowid), placeId, titre, info: '' }
}

export function majScenario(id: number, patch: { titre?: string; info?: string }): void {
  const db = getDb()
  if (patch.titre !== undefined)
    db.prepare(`UPDATE lieu_scenario SET titre = ? WHERE id = ?`).run(patch.titre, id)
  if (patch.info !== undefined)
    db.prepare(`UPDATE lieu_scenario SET info = ? WHERE id = ?`).run(patch.info, id)
}

/** Les numéros se refont : ce sont des places, pas des identifiants. */
function renumeroter(placeId: number, ids?: number[]): void {
  const db = getDb()
  const ordre =
    ids ??
    (
      db.prepare(`SELECT id FROM lieu_scenario WHERE place_id = ? ORDER BY ord, id`).all(placeId) as {
        id: number
      }[]
    ).map((r) => r.id)
  const maj = db.prepare(`UPDATE lieu_scenario SET ord = ? WHERE id = ? AND place_id = ?`)
  ordre.forEach((id, i) => maj.run(i, id, placeId))
}

export function supprimerScenario(id: number): void {
  const db = getDb()
  const r = db.prepare(`SELECT place_id AS placeId FROM lieu_scenario WHERE id = ?`).get(id) as
    | { placeId: number }
    | undefined
  db.prepare(`DELETE FROM lieu_scenario WHERE id = ?`).run(id)
  if (r) renumeroter(r.placeId)
}

export function ordonnerScenarios(placeId: number, ids: number[]): void {
  getDb().transaction(() => renumeroter(placeId, ids))()
}

/* ---------------- découvertes et déclencheurs ---------------- */

type ContenuCarte = {
  sorte?: SorteCarte
  titre?: string
  si?: string
  alors?: string
  beatId?: number | null
  objetIds?: number[]
  pnjIds?: number[]
}

function poserLiens(id: number, c: ContenuCarte): void {
  const db = getDb()
  if (c.objetIds) {
    db.prepare(`DELETE FROM lieu_carte_objet WHERE carte_id = ?`).run(id)
    const ins = db.prepare(`INSERT OR IGNORE INTO lieu_carte_objet (carte_id, objet_id) VALUES (?, ?)`)
    for (const o of c.objetIds) ins.run(id, o)
  }
  if (c.pnjIds) {
    db.prepare(`DELETE FROM lieu_carte_pnj WHERE carte_id = ?`).run(id)
    const ins = db.prepare(`INSERT OR IGNORE INTO lieu_carte_pnj (carte_id, character_id) VALUES (?, ?)`)
    for (const p of c.pnjIds) ins.run(id, p)
  }
}

/** Le rang pour arriver en haut de la liste, ou tout en bas. */
function rang(placeId: number, ou: 'haut' | 'bas'): number {
  const r = getDb()
    .prepare(`SELECT MIN(ord) AS lo, MAX(ord) AS hi FROM lieu_carte WHERE place_id = ?`)
    .get(placeId) as { lo: number | null; hi: number | null }
  return ou === 'haut' ? (r.lo ?? 1) - 1 : (r.hi ?? -1) + 1
}

/** Une carte neuve arrive en haut de la liste. */
export function ajouterCarte(placeId: number, c: ContenuCarte): number {
  const db = getDb()
  let id = 0
  db.transaction(() => {
    const sorte = c.sorte && SORTES.includes(c.sorte) ? c.sorte : 'decouverte'
    const info = db
      .prepare(
        `INSERT INTO lieu_carte (place_id, sorte, titre, si, alors, ord, beat_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        placeId,
        sorte,
        c.titre ?? '',
        c.si ?? '',
        c.alors ?? '',
        rang(placeId, 'haut'),
        sorte === 'declencheur' ? (c.beatId ?? null) : null
      )
    id = Number(info.lastInsertRowid)
    poserLiens(id, c)
  })()
  return id
}

/** Un champ absent ne bouge pas ; les liens se donnent en entier. */
export function majCarte(id: number, c: ContenuCarte): void {
  const db = getDb()
  db.transaction(() => {
    const champs: [keyof ContenuCarte, string][] = [
      ['titre', 'titre'],
      ['si', 'si'],
      ['alors', 'alors'],
      ['beatId', 'beat_id']
    ]
    for (const [k, col] of champs)
      if (c[k] !== undefined) db.prepare(`UPDATE lieu_carte SET ${col} = ? WHERE id = ?`).run(c[k] as never, id)
    if (c.sorte && SORTES.includes(c.sorte)) {
      db.prepare(`UPDATE lieu_carte SET sorte = ? WHERE id = ?`).run(c.sorte, id)
      /* Une découverte ne mène nulle part : seul un déclencheur ouvre un moment. */
      if (c.sorte === 'decouverte') db.prepare(`UPDATE lieu_carte SET beat_id = NULL WHERE id = ?`).run(id)
    }
    poserLiens(id, c)
  })()
}

/** Cochée, elle descend en bas ; décochée, elle remonte en haut. */
export function cocherCarte(id: number, fait: boolean): void {
  const db = getDb()
  const r = db.prepare(`SELECT place_id AS placeId FROM lieu_carte WHERE id = ?`).get(id) as
    | { placeId: number }
    | undefined
  if (!r) return
  db.prepare(`UPDATE lieu_carte SET fait = ?, ord = ? WHERE id = ?`).run(
    fait ? 1 : 0,
    rang(r.placeId, fait ? 'bas' : 'haut'),
    id
  )
}

export function supprimerCarte(id: number): void {
  getDb().prepare(`DELETE FROM lieu_carte WHERE id = ?`).run(id)
}

/* ---------------- les PNJ du lieu ---------------- */

export function ajouterPnj(placeId: number, characterId: number): void {
  const db = getDb()
  const { m } = db
    .prepare(`SELECT COALESCE(MAX(ord), -1) AS m FROM lieu_pnj WHERE place_id = ?`)
    .get(placeId) as { m: number }
  db.prepare(`INSERT OR IGNORE INTO lieu_pnj (place_id, character_id, ord) VALUES (?, ?, ?)`).run(
    placeId,
    characterId,
    m + 1
  )
}

export function retirerPnj(placeId: number, characterId: number): void {
  getDb()
    .prepare(`DELETE FROM lieu_pnj WHERE place_id = ? AND character_id = ?`)
    .run(placeId, characterId)
}

/* ---------------- le fichier texte du lieu ---------------- */

/** Ce que le fichier du lieu montre de sa fiche : ni coche ni liens. */
export interface FicheTexte {
  scenarios: { titre: string; info: string }[]
  cartes: { sorte: SorteCarte; titre: string; si: string; alors: string }[]
}

export function ficheEnTexte(placeId: number): FicheTexte {
  const f = lireFiche(placeId)
  return {
    scenarios: f.scenarios.map((s) => ({ titre: s.titre, info: s.info })),
    cartes: f.cartes.map((c) => ({ sorte: c.sorte, titre: c.titre, si: c.si, alors: c.alors }))
  }
}

/**
 * Le fichier a été écrit ailleurs : la fiche le reprend. On se reconnaît au
 * titre — d'abord dans la même sorte, puis dans l'autre — pour que coche et
 * liens suivent ; un titre inconnu fait une carte neuve, un titre disparu
 * efface la sienne. À appeler dans une transaction.
 */
export function poserFicheTexte(placeId: number, f: FicheTexte): void {
  const db = getDb()
  const cle = (t: string): string => t.trim().toLowerCase()
  const prendre = <T extends { titre: string }>(liste: T[], titre: string, ok: (x: T) => boolean = () => true) => {
    const i = liste.findIndex((x) => cle(x.titre) === cle(titre) && ok(x))
    return i < 0 ? undefined : liste.splice(i, 1)[0]
  }

  const scen = db
    .prepare(`SELECT id, titre FROM lieu_scenario WHERE place_id = ? ORDER BY ord, id`)
    .all(placeId) as { id: number; titre: string }[]
  const majScen = db.prepare(`UPDATE lieu_scenario SET titre = ?, info = ?, ord = ? WHERE id = ?`)
  const insScen = db.prepare(`INSERT INTO lieu_scenario (place_id, ord, titre, info) VALUES (?, ?, ?, ?)`)
  f.scenarios.forEach((s, i) => {
    const r = prendre(scen, s.titre)
    if (r) majScen.run(s.titre, s.info, i, r.id)
    else insScen.run(placeId, i, s.titre, s.info)
  })
  for (const r of scen) db.prepare(`DELETE FROM lieu_scenario WHERE id = ?`).run(r.id)

  const cartes = db
    .prepare(`SELECT id, sorte, titre, fait FROM lieu_carte WHERE place_id = ? ORDER BY fait, ord, id`)
    .all(placeId) as { id: number; sorte: SorteCarte; titre: string; fait: number }[]
  const majCarte = db.prepare(
    `UPDATE lieu_carte SET sorte = ?, titre = ?, si = ?, alors = ?,
            beat_id = CASE WHEN ? = 'decouverte' THEN NULL ELSE beat_id END
      WHERE id = ?`
  )
  const insCarte = db.prepare(`INSERT INTO lieu_carte (place_id, sorte, titre, si, alors) VALUES (?, ?, ?, ?, ?)`)
  const gardees: { id: number; fait: boolean }[] = []
  for (const c of f.cartes) {
    const sorte = SORTES.includes(c.sorte) ? c.sorte : 'decouverte'
    const r = prendre(cartes, c.titre, (x) => x.sorte === sorte) ?? prendre(cartes, c.titre)
    if (r) {
      majCarte.run(sorte, c.titre, c.si, c.alors, sorte, r.id)
      gardees.push({ id: r.id, fait: !!r.fait })
    } else {
      const id = Number(insCarte.run(placeId, sorte, c.titre, c.si, c.alors).lastInsertRowid)
      gardees.push({ id, fait: false })
    }
  }
  for (const r of cartes) supprimerCarte(r.id)
  /* À jouer dans l'ordre du fichier, les cochées en bas. */
  const ord = db.prepare(`UPDATE lieu_carte SET ord = ? WHERE id = ?`)
  ;[...gardees.filter((g) => !g.fait), ...gardees.filter((g) => g.fait)].forEach((g, i) => ord.run(i, g.id))
}

/* ---------------- la copie, avec le lieu ---------------- */

/**
 * La fiche d'un lieu suit sa copie. Les cartes repartent à jouer : rien n'y
 * est coché. PNJ et moment gardent leurs identifiants ; quand une séance
 * entière se recopie, `raccrocherFiches` les remet sur leurs doubles.
 */
export function copierFiche(de: number, vers: number): void {
  const db = getDb()
  const ids = (sql: string): number[] => (db.prepare(sql).all(de) as { id: number }[]).map((r) => r.id)
  for (const s of ids(`SELECT id FROM lieu_scenario WHERE place_id = ?`))
    copierLigne('lieu_scenario', s, { place_id: vers })
  for (const c of ids(`SELECT id FROM lieu_carte WHERE place_id = ?`)) {
    const n = copierLigne('lieu_carte', c, { place_id: vers, fait: 0 })
    db.prepare(
      `INSERT INTO lieu_carte_objet (carte_id, objet_id) SELECT ?, objet_id FROM lieu_carte_objet WHERE carte_id = ?`
    ).run(n, c)
    db.prepare(
      `INSERT INTO lieu_carte_pnj (carte_id, character_id) SELECT ?, character_id FROM lieu_carte_pnj WHERE carte_id = ?`
    ).run(n, c)
  }
  db.prepare(
    `INSERT INTO lieu_pnj (place_id, character_id, ord) SELECT ?, character_id, ord FROM lieu_pnj WHERE place_id = ?`
  ).run(vers, de)
}

/**
 * Après la copie d'une séance : dans ses lieux, les PNJ et les moments
 * désignent leurs doubles, pas ceux de la séance d'origine.
 */
export function raccrocherFiches(
  lieux: Iterable<number>,
  pnj: Map<number, number>,
  beats: Map<number, number>
): void {
  const db = getDb()
  const majBeat = db.prepare(`UPDATE lieu_carte SET beat_id = ? WHERE id = ?`)
  const majCartePnj = db.prepare(
    `UPDATE OR IGNORE lieu_carte_pnj SET character_id = ? WHERE carte_id = ? AND character_id = ?`
  )
  const majLieuPnj = db.prepare(
    `UPDATE OR IGNORE lieu_pnj SET character_id = ? WHERE place_id = ? AND character_id = ?`
  )
  for (const placeId of lieux) {
    for (const c of db
      .prepare(`SELECT id, beat_id AS beatId FROM lieu_carte WHERE place_id = ?`)
      .all(placeId) as { id: number; beatId: number | null }[]) {
      if (c.beatId != null && beats.has(c.beatId)) majBeat.run(beats.get(c.beatId)!, c.id)
      for (const r of db
        .prepare(`SELECT character_id AS id FROM lieu_carte_pnj WHERE carte_id = ?`)
        .all(c.id) as { id: number }[])
        if (pnj.has(r.id)) majCartePnj.run(pnj.get(r.id)!, c.id, r.id)
    }
    for (const r of db
      .prepare(`SELECT character_id AS id FROM lieu_pnj WHERE place_id = ?`)
      .all(placeId) as { id: number }[])
      if (pnj.has(r.id)) majLieuPnj.run(pnj.get(r.id)!, placeId, r.id)
  }
}
