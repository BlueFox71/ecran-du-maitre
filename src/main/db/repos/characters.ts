import { activeCampaignId, getDb } from '../index'
import { couleurLibre } from '@shared/types'
import type {
  ButinLigne,
  Character,
  CharacterKind,
  Frame,
  CharacterData,
  CharacterLogEntry,
  Sexe,
  SheetTemplate,
  TemplateSpec
} from '@shared/types'

/* ---------------- gabarits ---------------- */

export function listTemplates(): SheetTemplate[] {
  const cid = activeCampaignId()
  return (
    getDb()
      .prepare(
        `SELECT id, name, spec, builtin FROM sheet_template
          WHERE campaign_id IS NULL OR campaign_id = ?
          ORDER BY builtin DESC, name`
      )
      .all(cid) as any[]
  ).map((r) => ({
    id: r.id,
    name: r.name,
    spec: JSON.parse(r.spec) as TemplateSpec,
    builtin: !!r.builtin
  }))
}

export function upsertTemplate(input: { id?: number; name: string; spec: TemplateSpec }): SheetTemplate {
  const db = getDb()
  if (input.id) {
    db.prepare(`UPDATE sheet_template SET name = ?, spec = ? WHERE id = ?`).run(
      input.name,
      JSON.stringify(input.spec),
      input.id
    )
    return listTemplates().find((t) => t.id === input.id)!
  }
  const info = db
    .prepare(`INSERT INTO sheet_template (campaign_id, name, spec, builtin) VALUES (?, ?, ?, 0)`)
    .run(activeCampaignId(), input.name, JSON.stringify(input.spec))
  return listTemplates().find((t) => t.id === Number(info.lastInsertRowid))!
}

export function removeTemplate(id: number): void {
  getDb().prepare(`DELETE FROM sheet_template WHERE id = ? AND builtin = 0`).run(id)
}

/* ---------------- la fiche de la campagne ---------------- */

/**
 * La fiche de la campagne active — il n'y en a qu'une, et tous ses
 * personnages la suivent. Une campagne qui n'en aurait pas encore (base
 * ancienne rouverte de travers) en reçoit une plutôt que de faire échouer
 * l'écran des fiches.
 */
export function campaignSheet(): SheetTemplate {
  const db = getDb()
  const cid = activeCampaignId()
  const row = db
    .prepare(
      `SELECT t.id, t.name, t.spec, t.builtin
         FROM campaign c JOIN sheet_template t ON t.id = c.sheet_template_id
        WHERE c.id = ?`
    )
    .get(cid) as any

  if (row) {
    return { id: row.id, name: row.name, spec: JSON.parse(row.spec), builtin: !!row.builtin }
  }

  const nom = (db.prepare(`SELECT name FROM campaign WHERE id = ?`).get(cid) as any)?.name ?? 'la campagne'
  const vierge: TemplateSpec = {
    rollSystem: 'd20-plus',
    gauges: [],
    stats: [],
    skills: [],
    skillLimit: null
  }
  const info = db
    .prepare(`INSERT INTO sheet_template (campaign_id, name, spec, builtin) VALUES (?, ?, ?, 0)`)
    .run(cid, `Fiche de ${nom}`, JSON.stringify(vierge))
  db.prepare(`UPDATE campaign SET sheet_template_id = ? WHERE id = ?`).run(
    Number(info.lastInsertRowid),
    cid
  )
  return { id: Number(info.lastInsertRowid), name: `Fiche de ${nom}`, spec: vierge, builtin: false }
}

/**
 * Enregistrer la fiche de la campagne.
 *
 * Les personnages suivent dans la foulée : ce qui reste garde sa valeur, ce
 * qui a disparu de la fiche la perd. C'est la seule opération destructrice de
 * l'écran — l'interface prévient avant de l'appeler.
 */
export function saveCampaignSheet(input: { name: string; spec: TemplateSpec }): SheetTemplate {
  const db = getDb()
  const fiche = campaignSheet()

  db.transaction(() => {
    db.prepare(`UPDATE sheet_template SET name = ?, spec = ? WHERE id = ?`).run(
      input.name.trim() || fiche.name,
      JSON.stringify(input.spec),
      fiche.id
    )
    const maj = db.prepare(
      `UPDATE character SET template_id = ?, data = ?, updated_at = datetime('now') WHERE id = ?`
    )
    for (const ch of listCharacters()) maj.run(fiche.id, JSON.stringify(recadre(ch.data, input.spec)), ch.id)
  })()

  return campaignSheet()
}

/**
 * Les données d'un personnage relues à travers une fiche qui a changé.
 *
 * Ce qui existe encore garde sa valeur, jauges comprises — un personnage
 * blessé ne doit pas se retrouver au maximum parce que le MJ a ajouté une
 * compétence. Les compétences, elles, ne sont pas remises à zéro : seules
 * celles que le joueur avait prises restent, les autres n'ont jamais existé
 * sur sa fiche.
 */
function recadre(data: CharacterData, spec: TemplateSpec): CharacterData {
  const gauges: CharacterData['gauges'] = {}
  for (const g of spec.gauges) {
    const old = data.gauges[g.key]
    gauges[g.key] = old ? { value: Math.min(old.value, old.max || g.max), max: old.max || g.max } : { value: g.max, max: g.max }
  }
  const stats: Record<string, number> = {}
  for (const st of spec.stats) stats[st.key] = data.stats[st.key] ?? 10
  const skills: Record<string, number> = {}
  for (const sk of spec.skills) if (sk.key in data.skills) skills[sk.key] = data.skills[sk.key]
  return { gauges, stats, skills, states: data.states, notes: data.notes }
}

/**
 * Valeurs de départ d'un personnage neuf : les jauges pleines, les
 * caractéristiques au milieu, et **aucune compétence** — c'est le joueur qui
 * choisit les siennes, dans la limite fixée par la fiche.
 */
export function blankData(spec: TemplateSpec): CharacterData {
  const gauges: CharacterData['gauges'] = {}
  for (const g of spec.gauges) gauges[g.key] = { value: g.max, max: g.max }
  const stats: Record<string, number> = {}
  for (const s of spec.stats) stats[s.key] = spec.rollSystem === 'd100-under' ? 50 : 10
  return { gauges, stats, skills: {}, states: {} }
}

/* ---------------- personnages ---------------- */

/** Le cadrage part en base sous forme de texte, ou pas du tout. */
const cadre = (f: Frame | null | undefined): string | null => (f ? JSON.stringify(f) : null)

/**
 * Le butin relu depuis la colonne. Une base d'avant la colonne, un texte
 * abîmé, une ligne sans intitulé : on rend une liste vide ou on écarte la
 * ligne, plutôt que de faire échouer l'ouverture d'une fiche.
 */
function lisButin(txt: string | null | undefined): ButinLigne[] {
  if (!txt) return []
  try {
    const brut = JSON.parse(txt)
    if (!Array.isArray(brut)) return []
    return brut.map((l: any, i: number) => ({
      id: typeof l?.id === 'string' && l.id ? l.id : `b${i}`,
      texte: typeof l?.texte === 'string' ? l.texte : '',
      qte: Number.isFinite(Number(l?.qte)) ? Math.max(0, Math.trunc(Number(l.qte))) : 1,
      pris: !!l?.pris
    }))
  } catch {
    return []
  }
}

/** Une liste vide ne s'écrit pas : la colonne reste nulle, comme à la création. */
const ecrisButin = (lignes: ButinLigne[] | null | undefined): string | null =>
  lignes && lignes.length ? JSON.stringify(lignes) : null

function toCharacter(r: any): Character {
  return {
    id: r.id,
    templateId: r.template_id,
    name: r.name,
    player: r.player,
    occupation: r.occupation,
    age: r.age,
    color: r.color,
    portraitItemId: r.portrait_item_id,
    sheetItemId: r.sheet_item_id,
    sheetFrame: r.sheet_frame ? (JSON.parse(r.sheet_frame) as Frame) : null,
    kind: r.kind === 'pnj' ? 'pnj' : 'pj',
    sexe: r.sexe === 'femme' ? 'femme' : r.sexe === 'homme' ? 'homme' : null,
    notes: r.notes ?? null,
    butin: lisButin(r.butin),
    data: JSON.parse(r.data) as CharacterData
  }
}

export function listCharacters(): Character[] {
  return (
    getDb()
      .prepare(
        `SELECT id, template_id, name, player, occupation, portrait_item_id, sheet_item_id,
                sheet_frame, age, color, kind, sexe, notes, butin, data
           FROM character WHERE campaign_id = ? ORDER BY ord, id`
      )
      .all(activeCampaignId()) as any[]
  ).map(toCharacter)
}

/**
 * Les personnages **joueurs**, et eux seuls.
 *
 * C'est la seule porte par laquelle un personnage rejoint l'encart de l'écran
 * des joueurs. Un PNJ n'en sort pas, donc il ne peut pas s'y glisser par
 * mégarde : la garantie tient à la forme des données, pas à un filtre qu'on
 * penserait à écrire. Tout nouveau chemin vers les joueurs passe par ici.
 */
export function listJoueurs(): Character[] {
  return listCharacters().filter((c) => c.kind === 'pj')
}

export function getCharacter(id: number): Character | null {
  const r = getDb()
    .prepare(
      `SELECT id, template_id, name, player, occupation, portrait_item_id, sheet_item_id,
              sheet_frame, age, color, kind, sexe, notes, butin, data
         FROM character WHERE id = ?`
    )
    .get(id)
  return r ? toCharacter(r) : null
}

export function upsertCharacter(input: {
  id?: number
  templateId: number
  kind?: CharacterKind
  notes?: string | null
  butin?: ButinLigne[]
  name: string
  player?: string | null
  occupation?: string | null
  age?: string | null
  color?: string | null
  sexe?: Sexe | null
  portraitItemId?: number | null
  sheetItemId?: number | null
  sheetFrame?: Frame | null
  data?: CharacterData
}): Character {
  const db = getDb()

  if (input.id) {
    const cur = getCharacter(input.id)!
    db.prepare(
      `UPDATE character SET template_id = @templateId, name = @name, player = @player,
                            occupation = @occupation, age = @age, color = @color,
                            sexe = @sexe, portrait_item_id = @portraitItemId,
                            sheet_item_id = @sheetItemId, sheet_frame = @sheetFrame,
                            notes = @notes, butin = @butin, data = @data,
                            updated_at = datetime('now')
        WHERE id = @id`
    ).run({
      id: input.id,
      templateId: input.templateId,
      name: input.name,
      player: input.player !== undefined ? input.player : cur.player,
      occupation: input.occupation !== undefined ? input.occupation : cur.occupation,
      age: input.age !== undefined ? input.age : cur.age,
      color: input.color !== undefined ? input.color : cur.color,
      sexe: input.sexe !== undefined ? input.sexe : cur.sexe,
      portraitItemId: input.portraitItemId !== undefined ? input.portraitItemId : cur.portraitItemId,
      sheetItemId: input.sheetItemId !== undefined ? input.sheetItemId : cur.sheetItemId,
      sheetFrame: cadre(input.sheetFrame !== undefined ? input.sheetFrame : cur.sheetFrame),
      /* La nature ne se modifie pas ici : on ne rétrograde pas une fiche en
         pion, et on ne fait pas d'un joueur un PNJ par un champ de formulaire. */
      notes: input.notes !== undefined ? input.notes : cur.notes,
      butin: ecrisButin(input.butin !== undefined ? input.butin : cur.butin),
      data: JSON.stringify(input.data ?? cur.data)
    })
    return getCharacter(input.id)!
  }

  const tpl = listTemplates().find((t) => t.id === input.templateId)
  const data = input.data ?? (tpl ? blankData(tpl.spec) : { gauges: {}, stats: {}, skills: {}, states: {} })
  const ord =
    ((db.prepare(`SELECT MAX(ord) AS m FROM character WHERE campaign_id = ?`).get(activeCampaignId()) as any)
      ?.m ?? -1) + 1

  const info = db
    .prepare(
      `INSERT INTO character (campaign_id, template_id, kind, notes, butin, name, player, occupation,
                              age, color, sexe, portrait_item_id, sheet_item_id, sheet_frame, data, ord)
       VALUES (@cid, @templateId, @kind, @notes, @butin, @name, @player, @occupation,
               @age, @color, @sexe, @portraitItemId, @sheetItemId, @sheetFrame, @data, @ord)`
    )
    .run({
      cid: activeCampaignId(),
      templateId: input.templateId,
      kind: input.kind ?? 'pj',
      notes: input.notes ?? null,
      butin: ecrisButin(input.butin),
      name: input.name,
      player: input.player ?? null,
      occupation: input.occupation ?? null,
      age: input.age ?? null,
      sexe: input.sexe ?? null,
      /* Une couleur d'office a la creation : la premiere libre de la table.
         C'est elle qui distingue le joueur dans la liste et cercle son pion. */
      color: input.color ?? couleurLibre(listCharacters().map((c) => c.color)),
      portraitItemId: input.portraitItemId ?? null,
      sheetItemId: input.sheetItemId ?? null,
      sheetFrame: cadre(input.sheetFrame ?? null),
      data: JSON.stringify(data),
      ord
    })
  return getCharacter(Number(info.lastInsertRowid))!
}

/**
 * Enregistrer la table de butin. La liste part entière : on ne suit pas une
 * ligne, on repose la table telle qu'elle est à l'écran — c'est ce que fait
 * déjà le cadrage d'un aperçu, et pour la même raison.
 *
 * Les lignes sans intitulé ne sont pas gardées : une ligne qu'on vient
 * d'ajouter et qu'on laisse vide n'a jamais existé.
 */
export function setButin(characterId: number, lignes: ButinLigne[]): Character {
  const propre = lignes
    .map((l) => ({ ...l, texte: l.texte.trim(), qte: Math.max(0, Math.trunc(l.qte)) }))
    .filter((l) => l.texte !== '')
  getDb()
    .prepare(`UPDATE character SET butin = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(ecrisButin(propre), characterId)
  return getCharacter(characterId)!
}

export function removeCharacter(id: number): void {
  getDb().prepare(`DELETE FROM character WHERE id = ?`).run(id)
}

/**
 * Modifie une jauge et journalise le changement.
 * `delta` s'applique à la valeur ; `maxDelta` au plafond (perte de SAN définitive, par exemple).
 */
export function adjustGauge(
  characterId: number,
  key: string,
  delta: number,
  reason?: string | null,
  maxDelta = 0
): { character: Character; log: CharacterLogEntry[] } {
  const db = getDb()
  const ch = getCharacter(characterId)
  if (!ch) throw new Error('Personnage introuvable')

  const tpl = listTemplates().find((t) => t.id === ch.templateId)
  const spec = tpl?.spec.gauges.find((g) => g.key === key)
  const label = spec?.label ?? key

  const cur = ch.data.gauges[key] ?? { value: 0, max: spec?.max ?? 0 }
  const newMax = Math.max(0, cur.max + maxDelta)
  const newValue = Math.max(spec?.min ?? 0, Math.min(newMax, cur.value + delta))

  ch.data.gauges[key] = { value: newValue, max: newMax }

  db.transaction(() => {
    db.prepare(`UPDATE character SET data = ?, updated_at = datetime('now') WHERE id = ?`).run(
      JSON.stringify(ch.data),
      characterId
    )
    if (delta !== 0 || maxDelta !== 0) {
      db.prepare(
        `INSERT INTO character_log (character_id, field, label, delta, value, max, reason)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(characterId, key, label, delta, newValue, newMax, reason ?? null)
    }
  })()

  return { character: getCharacter(characterId)!, log: characterLog(characterId) }
}

/**
 * Prendre une compétence, ou la rendre. La présence de la clé vaut choix :
 * une compétence rendue disparaît des données, elle ne reste pas à zéro —
 * sans quoi on ne saurait plus distinguer « pas prise » de « prise et nulle ».
 */
export function pickSkill(characterId: number, key: string, on: boolean): Character {
  const ch = getCharacter(characterId)!
  if (on) {
    if (!(key in ch.data.skills)) ch.data.skills[key] = 0
  } else {
    delete ch.data.skills[key]
  }
  getDb()
    .prepare(`UPDATE character SET data = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(JSON.stringify(ch.data), characterId)
  return getCharacter(characterId)!
}

export function setSkill(characterId: number, key: string, value: number): Character {
  const ch = getCharacter(characterId)!
  ch.data.skills[key] = value
  getDb()
    .prepare(`UPDATE character SET data = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(JSON.stringify(ch.data), characterId)
  return getCharacter(characterId)!
}

export function setStat(characterId: number, key: string, value: number): Character {
  const ch = getCharacter(characterId)!
  ch.data.stats[key] = value
  getDb()
    .prepare(`UPDATE character SET data = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(JSON.stringify(ch.data), characterId)
  return getCharacter(characterId)!
}

export function setState(characterId: number, key: string, on: boolean): Character {
  const ch = getCharacter(characterId)!
  ch.data.states[key] = on
  getDb()
    .prepare(`UPDATE character SET data = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(JSON.stringify(ch.data), characterId)
  return getCharacter(characterId)!
}

export function characterLog(characterId: number, limit = 60): CharacterLogEntry[] {
  return getDb()
    .prepare(
      `SELECT id, at, field, label, delta, value, max, reason
         FROM character_log WHERE character_id = ? ORDER BY id DESC LIMIT ?`
    )
    .all(characterId, limit) as CharacterLogEntry[]
}
