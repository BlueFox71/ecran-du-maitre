/**
 * L'arborescence de chaque séance en fichier : `Arborescence.json`, dans le
 * dossier de la séance côté dossier de l'app (`.ecran-du-maitre/<séance>/`).
 * On peut la lire et l'écrire hors de l'application — un éditeur, une autre
 * session qui aide à la construire.
 *
 * La liaison va dans les deux sens, comme pour les lieux : on garde, par
 * séance, ce qui a été accordé la dernière fois (réglage `arborescence.fichiers`),
 * et le côté qui s'en est écarté l'emporte. Si les deux ont bougé, le fichier
 * gagne. Un fichier illisible (JSON cassé, en cours d'écriture) n'est ni repris
 * ni écrasé : on attend qu'il se répare.
 *
 * Le fichier nomme les choses plutôt que de donner leurs numéros : le lieu, le
 * moment et les PNJ par leur nom, l'image par son chemin dans la campagne. Une
 * carte sans « id » est neuve ; sans « x »/« y », elle se range d'elle-même,
 * une colonne par étape depuis l'ouverture.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { activeCampaignId, getDb, isDbOpen } from './db'
import * as reglages from './db/repos/reglages'
import { lireTrame } from './db/repos/trame'
import { absOf, announce, campaignRoot, insideRoot, safeName } from './library'
import { MARQUE } from '@shared/dossierDeLApp'
import type { CadreCarre, TrameType } from '@shared/types'

const CLE = 'arborescence.fichiers'
const TYPES: TrameType[] = ['ouverture', 'scene', 'objectif', 'fin']
/** L'écart entre deux colonnes, et entre deux cartes d'une colonne, quand on range. */
const COLONNE = 280
const RANG = 220

/** Ce qu'on écrit en tête du fichier : le mode d'emploi, pour qui l'ouvre. */
const FORMAT = [
  "Arborescence de la séance : le scénario en cartes reliées par des flèches. Réservée au MJ, jamais montrée aux joueurs.",
  "Ce fichier est relu par l'Écran du Maître dès qu'il est enregistré, et réécrit quand on modifie l'arborescence dans l'application.",
  "cartes[] : id (garder celui qui est donné ; l'omettre pour une carte neuve), type (ouverture | scene | objectif | fin), titre, resume (ce qu'il faut retenir), regle (et : il faut toutes les flèches qui arrivent ; ou : une seule suffit), fait (coché en jeu), image (chemin du fichier dans la campagne, ou null), cadreImage (morceau de l'image, fractions x/y/w/h, ou null), moment (titre d'un moment de la Chronologie, ou null), lieu (nom d'un lieu, ou null), pnj (noms de PNJ), x et y (place sur le plan ; à omettre pour une carte neuve, elle se range seule).",
  "fleches[] : de et a (id des cartes, ou la « ref » d'une carte neuve), mot (ce qui fait passer, facultatif). Une flèche veut dire « ceci ouvre la voie à cela ».",
  "Une carte neuve peut porter une « ref » (texte libre, ex. \"registre\") pour que les flèches la désignent avant qu'elle ait un id.",
  "Supprimer une carte du fichier la supprime de l'application."
]

interface CarteFichier {
  id?: number
  ref?: string
  type: TrameType
  titre: string
  resume: string
  regle: 'et' | 'ou'
  fait: boolean
  image: string | null
  cadreImage: CadreCarre | null
  moment: string | null
  lieu: string | null
  pnj: string[]
  x?: number | null
  y?: number | null
}
interface FlecheFichier {
  de: number | string
  a: number | string
  mot: string
}
interface Modele {
  cartes: CarteFichier[]
  fleches: FlecheFichier[]
}
interface Seance {
  id: number
  label: string
  base: string | null
}

/** Le fichier d'une séance. Sans dossier de séance, il porte son nom pour ne pas se mêler aux autres. */
function cheminDe(s: Seance): string {
  if (s.base) return `${MARQUE}/${s.base}/Arborescence.json`
  let nom: string
  try {
    nom = safeName(s.label)
  } catch {
    nom = `Séance ${s.id}`
  }
  return `${MARQUE}/Arborescence — ${nom}.json`
}

/* ---------------- de la base vers le fichier ---------------- */

function depuisLaBase(sessionId: number): Modele {
  const db = getDb()
  const { cartes, liens } = lireTrame(sessionId)
  const chemin = db.prepare(`SELECT rel_path AS r FROM item WHERE id = ?`)
  const moment = db.prepare(`SELECT title AS t FROM beat WHERE id = ?`)
  const lieu = db.prepare(`SELECT name AS n FROM place WHERE id = ?`)
  const pnj = db.prepare(`SELECT name AS n FROM character WHERE id = ?`)
  const val = <T>(st: { get: (v: number) => unknown }, id: number | null, k: string): T | null =>
    id == null ? null : (((st.get(id) as Record<string, T> | undefined)?.[k] ?? null) as T | null)
  return {
    cartes: cartes.map((c) => ({
      id: c.id,
      type: c.type,
      titre: c.titre,
      resume: c.resume,
      regle: c.regle,
      fait: c.fait,
      image: val<string>(chemin, c.itemId, 'r'),
      cadreImage: c.imageCadre,
      moment: val<string>(moment, c.beatId, 't'),
      lieu: val<string>(lieu, c.placeId, 'n'),
      pnj: c.pnjIds.map((id) => val<string>(pnj, id, 'n')).filter((n): n is string => !!n),
      x: c.x,
      y: c.y
    })),
    fleches: liens.map((l) => ({ de: l.de, a: l.a, mot: l.mot }))
  }
}

const texteDe = (s: Seance, m: Modele): string =>
  JSON.stringify({ _format: FORMAT, seance: s.label, ...m }, null, 2) + '\n'

/* ---------------- du fichier vers la base ---------------- */

const texte = (v: unknown): string => (typeof v === 'string' ? v : '')
const nombre = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const nomOuNull = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

function lisCadre(v: unknown): CadreCarre | null {
  const c = v as Record<string, unknown> | null
  if (!c || typeof c !== 'object') return null
  const [x, y, w, h] = [nombre(c.x), nombre(c.y), nombre(c.w), nombre(c.h)]
  if (x == null || y == null || w == null || h == null || w <= 0 || h <= 0) return null
  return { x, y, w: Math.min(1, w), h: Math.min(1, h) }
}

/** Le fichier remis en forme ; null s'il ne se lit pas. */
function lireFichier(brut: string): Modele | null {
  let o: Record<string, unknown>
  try {
    o = JSON.parse(brut)
  } catch {
    return null
  }
  if (!o || typeof o !== 'object' || !Array.isArray(o.cartes)) return null
  const cartes: CarteFichier[] = (o.cartes as Record<string, unknown>[])
    .filter((c) => c && typeof c === 'object')
    .map((c) => ({
      ...(nombre(c.id) != null ? { id: nombre(c.id)! } : {}),
      ...(nomOuNull(c.ref) ? { ref: nomOuNull(c.ref)! } : {}),
      type: TYPES.includes(c.type as TrameType) ? (c.type as TrameType) : 'scene',
      titre: texte(c.titre),
      resume: texte(c.resume),
      regle: c.regle === 'ou' ? 'ou' : 'et',
      fait: c.fait === true,
      image: nomOuNull(c.image),
      cadreImage: lisCadre(c.cadreImage),
      moment: nomOuNull(c.moment),
      lieu: nomOuNull(c.lieu),
      pnj: Array.isArray(c.pnj) ? c.pnj.map(nomOuNull).filter((n): n is string => !!n) : [],
      x: nombre(c.x),
      y: nombre(c.y)
    }))
  const fleches: FlecheFichier[] = (Array.isArray(o.fleches) ? (o.fleches as Record<string, unknown>[]) : [])
    .filter((f) => f && typeof f === 'object')
    .map((f) => ({
      de: (nombre(f.de) ?? texte(f.de)) as number | string,
      a: (nombre(f.a) ?? texte(f.a)) as number | string,
      mot: texte(f.mot)
    }))
  return { cartes, fleches }
}

/** Deux modèles disent-ils la même chose ? */
const empreinte = (m: Modele): string => JSON.stringify(m)

/**
 * Le fichier devient l'arborescence de la séance : les cartes connues sont
 * mises à jour, les neuves créées, les absentes supprimées ; les flèches sont
 * reprises en entier.
 */
function versLaBase(s: Seance, m: Modele): void {
  const db = getDb()
  const cid = activeCampaignId()
  const existantes = new Set(lireTrame(s.id).cartes.map((c) => c.id))

  /* Ce que le fichier nomme : d'abord dans la séance, puis dans la campagne. */
  const parNom = (sql: string) => {
    const st = db.prepare(sql)
    return (nom: string | null): number | null =>
      nom == null ? null : ((st.get(cid, nom, s.id) as { id: number } | undefined)?.id ?? null)
  }
  const lieu = parNom(
    `SELECT id FROM place WHERE campaign_id = ? AND name = ? COLLATE NOCASE ORDER BY (session_id = ?) DESC, id LIMIT 1`
  )
  const pnj = parNom(
    `SELECT id FROM character WHERE campaign_id = ? AND kind = 'pnj' AND name = ? COLLATE NOCASE ORDER BY (session_id = ?) DESC, id LIMIT 1`
  )
  const momentSt = db.prepare(`SELECT id FROM beat WHERE session_id = ? AND title = ? COLLATE NOCASE ORDER BY ord, id LIMIT 1`)
  const moment = (t: string | null): number | null =>
    t == null ? null : ((momentSt.get(s.id, t) as { id: number } | undefined)?.id ?? null)
  const imageSt = db.prepare(`SELECT id FROM item WHERE rel_path = ? LIMIT 1`)
  const image = (r: string | null): number | null =>
    r == null ? null : ((imageSt.get(r.replace(/\\/g, '/')) as { id: number } | undefined)?.id ?? null)

  const maj = db.prepare(
    `UPDATE trame_carte SET type = ?, titre = ?, resume = ?, regle = ?, fait = ?, item_id = ?, image_cadre = ?,
            beat_id = ?, place_id = ?, x = COALESCE(?, x), y = COALESCE(?, y)
      WHERE id = ? AND session_id = ?`
  )
  const ins = db.prepare(
    `INSERT INTO trame_carte (session_id, type, titre, resume, regle, fait, item_id, image_cadre, beat_id, place_id, x, y)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
  const videPnj = db.prepare(`DELETE FROM trame_carte_pnj WHERE carte_id = ?`)
  const insPnj = db.prepare(`INSERT OR IGNORE INTO trame_carte_pnj (carte_id, character_id) VALUES (?, ?)`)

  db.transaction(() => {
    /* Ce que le fichier désigne (id ou ref) → l'id en base. */
    const ids = new Map<number | string, number>()
    const aRanger: number[] = []
    for (const c of m.cartes) {
      const champs = [
        c.type,
        c.titre.trim() || 'Sans titre',
        c.resume,
        c.regle,
        c.fait ? 1 : 0,
        image(c.image),
        c.cadreImage && image(c.image) != null ? JSON.stringify(c.cadreImage) : null,
        moment(c.moment),
        lieu(c.lieu)
      ]
      let id: number
      if (c.id != null && existantes.has(c.id) && !ids.has(c.id)) {
        id = c.id
        maj.run(...champs, c.x ?? null, c.y ?? null, id, s.id)
        if (c.x == null || c.y == null) aRanger.push(id)
      } else {
        id = Number(ins.run(s.id, ...champs, c.x ?? 0, c.y ?? 0).lastInsertRowid)
        if (c.x == null || c.y == null) aRanger.push(id)
      }
      if (c.id != null) ids.set(c.id, id)
      if (c.ref) ids.set(c.ref, id)
      videPnj.run(id)
      for (const n of c.pnj) {
        const p = pnj(n)
        if (p != null) insPnj.run(id, p)
      }
    }
    const gardees = new Set(ids.values())
    for (const id of existantes) if (!gardees.has(id)) db.prepare(`DELETE FROM trame_carte WHERE id = ?`).run(id)

    db.prepare(`DELETE FROM trame_lien WHERE session_id = ?`).run(s.id)
    const insLien = db.prepare(`INSERT OR IGNORE INTO trame_lien (session_id, de, a, mot) VALUES (?, ?, ?, ?)`)
    for (const f of m.fleches) {
      const de = ids.get(f.de)
      const a = ids.get(f.a)
      if (de && a && de !== a) insLien.run(s.id, de, a, f.mot)
    }

    if (aRanger.length) ranger(s.id, new Set(aRanger))
  })()
}

/**
 * Range les cartes sans place : une colonne par étape depuis le début — la
 * plus longue suite de flèches qui y mène —, sous ce qui occupe déjà la colonne.
 */
function ranger(sessionId: number, aRanger: Set<number>): void {
  const db = getDb()
  const { cartes, liens } = lireTrame(sessionId)
  const etape = new Map<number, number>(cartes.map((c) => [c.id, 0]))
  /* Autant de passes qu'il y a de cartes suffit, même avec une boucle. */
  for (let k = 0; k < cartes.length; k++) {
    let bouge = false
    for (const l of liens) {
      const v = (etape.get(l.de) ?? 0) + 1
      if (v > (etape.get(l.a) ?? 0) && v <= cartes.length) {
        etape.set(l.a, v)
        bouge = true
      }
    }
    if (!bouge) break
  }
  const bas = new Map<number, number>()
  for (const c of cartes) {
    if (aRanger.has(c.id)) continue
    const col = Math.round(c.x / COLONNE)
    bas.set(col, Math.max(bas.get(col) ?? -RANG, c.y))
  }
  const poser = db.prepare(`UPDATE trame_carte SET x = ?, y = ? WHERE id = ?`)
  for (const c of cartes) {
    if (!aRanger.has(c.id)) continue
    const col = etape.get(c.id) ?? 0
    const y = (bas.get(col) ?? -RANG) + RANG
    bas.set(col, y)
    poser.run(col * COLONNE, y, c.id)
  }
}

/* ---------------- l'accord ---------------- */

type Suivi = Record<string, { rel: string; e: string }>

function charger(): Suivi {
  try {
    return JSON.parse(reglages.tous()[CLE] ?? '{}')
  } catch {
    return {}
  }
}

let enCours = false

/**
 * Accorde l'arborescence de chaque séance et son fichier. Idempotent. Une
 * séance sans carte et sans fichier n'en reçoit pas : le fichier naît avec
 * la première carte — ou quand quelqu'un l'écrit. Rend le nombre de séances
 * reprises depuis le disque.
 */
export function synchroniserArborescences(): number {
  if (enCours || !isDbOpen() || !campaignRoot()) return 0
  enCours = true
  try {
    const seances = getDb()
      .prepare(`SELECT id, label, folder_rel AS base FROM game_session WHERE campaign_id = ?`)
      .all(activeCampaignId()) as Seance[]
    const avant = charger()
    const apres: Suivi = {}
    let depuisDisque = 0

    for (const s of seances) {
      const rel = cheminDe(s)
      const abs = absOf(rel)
      if (!insideRoot(abs)) continue
      const prev = avant[s.id]
      const enBase = depuisLaBase(s.id)
      const eBase = empreinte(enBase)

      if (!existsSync(abs)) {
        if (!enBase.cartes.length) continue
        mkdirSync(dirname(abs), { recursive: true })
        writeFileSync(abs, texteDe(s, enBase), 'utf8')
        apres[s.id] = { rel, e: eBase }
        continue
      }
      const surDisque = lireFichier(readFileSync(abs, 'utf8'))
      if (!surDisque) {
        // Illisible : on n'y touche pas, on garde l'accord d'avant.
        if (prev) apres[s.id] = prev
        continue
      }
      const eDisque = empreinte(surDisque)
      if (eDisque === eBase) {
        apres[s.id] = { rel, e: eBase }
      } else if (prev && eDisque === prev.e) {
        // Seule la base a bougé : le fichier la rattrape.
        writeFileSync(abs, texteDe(s, enBase), 'utf8')
        apres[s.id] = { rel, e: eBase }
      } else {
        // Le fichier a été écrit ailleurs : l'arborescence le reprend, puis
        // le fichier est réécrit avec les id et les places qu'elle a donnés.
        versLaBase(s, surDisque)
        const neuf = depuisLaBase(s.id)
        writeFileSync(abs, texteDe(s, neuf), 'utf8')
        apres[s.id] = { rel, e: empreinte(neuf) }
        depuisDisque++
      }
    }

    const json = JSON.stringify(apres)
    if (json !== (reglages.tous()[CLE] ?? '')) reglages.poser(CLE, json)
    if (depuisDisque) announce()
    return depuisDisque
  } catch (e) {
    console.error('[arborescence] accord avec les fichiers impossible :', e)
    return 0
  } finally {
    enCours = false
  }
}

let minuterie: NodeJS.Timeout | null = null

/** Bientôt, une fois que les écritures de l'instant se sont calmées. */
export function synchroniserArborescencesBientot(): void {
  if (minuterie) clearTimeout(minuterie)
  minuterie = setTimeout(() => {
    minuterie = null
    synchroniserArborescences()
  }, 400)
}
