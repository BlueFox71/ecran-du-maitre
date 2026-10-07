import { activeCampaignId, activeSessionId, getDb } from '../index'
import { copierLigne } from '../copie'
import { couleurLibre, lisCadreCarre } from '@shared/types'
import type {
  ButinLigne,
  CadreCarre,
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
    /* Toutes les copies suivent : la fiche de base de chacun, et son état dans
       chaque séance — une séance passée ne doit pas garder une jauge que la
       fiche n'a plus. */
    const maj = db.prepare(
      `UPDATE character SET template_id = ?, data = ?, updated_at = datetime('now') WHERE id = ?`
    )
    for (const r of db
      .prepare(`SELECT id, data FROM character WHERE campaign_id = ?`)
      .all(activeCampaignId()) as { id: number; data: string }[])
      maj.run(fiche.id, JSON.stringify(recadre(JSON.parse(r.data), input.spec)), r.id)
    const majSeance = db.prepare(
      `UPDATE character_seance SET data = ? WHERE character_id = ? AND session_id = ?`
    )
    for (const r of db
      .prepare(
        `SELECT cs.character_id AS c, cs.session_id AS s, cs.data FROM character_seance cs
           JOIN character ch ON ch.id = cs.character_id WHERE ch.campaign_id = ?`
      )
      .all(activeCampaignId()) as { c: number; s: number; data: string }[])
      majSeance.run(JSON.stringify(recadre(JSON.parse(r.data), input.spec)), r.c, r.s)
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
/** Le carré du portrait, de même. */
const carre = (c: CadreCarre | null | undefined): string | null => (c ? JSON.stringify(c) : null)

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
    portraitCadre: lisCadreCarre(r.portrait_cadre),
    sheetItemId: r.sheet_item_id,
    sheetFrame: r.sheet_frame ? (JSON.parse(r.sheet_frame) as Frame) : null,
    kind: r.kind === 'pnj' ? 'pnj' : 'pj',
    sexe: r.sexe === 'femme' ? 'femme' : r.sexe === 'homme' ? 'homme' : null,
    notes: r.notes ?? null,
    butin: lisButin(r.butin),
    horsJeu: !!r.hors_jeu,
    /* Hors-jeu, on n'est plus à la table — ni présent, ni absent : parti. */
    present: (r.present === undefined ? true : !!r.present) && !r.hors_jeu,
    data: JSON.parse(r.data) as CharacterData
  }
}

/*
 * Un personnage joueur se lit dans la séance en cours : son état de la
 * séance s'il en a un, sa fiche de base sinon. Un PNJ n'a qu'une séance, la
 * sienne ; ses données sont sur sa ligne. Voir la migration 42.
 */
const SELECT_PERSO = `
  SELECT c.id, c.template_id, c.name, c.player, c.occupation, c.portrait_item_id,
         c.portrait_cadre, c.sheet_item_id, c.sheet_frame, c.age, c.color, c.kind, c.sexe, c.notes, c.butin,
         CASE WHEN c.kind = 'pj'
              THEN COALESCE((SELECT cs.data FROM character_seance cs
                              WHERE cs.character_id = c.id AND cs.session_id = @sid), c.data)
              ELSE c.data END AS data,
         NOT EXISTS (SELECT 1 FROM seance_absent a
                      WHERE a.character_id = c.id AND a.session_id = @sid) AS present,
         EXISTS (SELECT 1 FROM game_session sortie, game_session ici
                  WHERE sortie.id = c.sortie_session_id AND ici.id = @sid
                    AND (ici.ord > sortie.ord OR (ici.ord = sortie.ord AND ici.id >= sortie.id))
                ) AS hors_jeu
    FROM character c`

/** Les personnages de la séance : tous les joueurs, et les PNJ qui en sont. */
export function listCharacters(): Character[] {
  return (
    getDb()
      .prepare(
        `${SELECT_PERSO}
          WHERE c.campaign_id = @cid
            AND (c.kind = 'pj' OR c.session_id = @sid OR c.session_id IS NULL)
          ORDER BY c.ord, c.id`
      )
      .all({ cid: activeCampaignId(), sid: activeSessionId() }) as any[]
  ).map(toCharacter)
}

/** Les PNJ d'une autre séance — ceux qu'on peut reprendre dans celle-ci. */
export function listPnjDe(sessionId: number): Character[] {
  return (
    getDb()
      .prepare(
        `${SELECT_PERSO} WHERE c.campaign_id = @cid AND c.kind = 'pnj' AND c.session_id = @sid
          ORDER BY c.ord, c.id`
      )
      .all({ cid: activeCampaignId(), sid: sessionId }) as any[]
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
  return listCharacters().filter((c) => c.kind === 'pj' && c.present)
}

/**
 * Déclarer un joueur hors-jeu à partir de la séance en cours, ou le faire
 * revenir. Les séances d'avant ne bougent pas : il y était.
 */
export function setHorsJeu(characterId: number, horsJeu: boolean): Character | null {
  getDb()
    .prepare(`UPDATE character SET sortie_session_id = ? WHERE id = ? AND kind = 'pj'`)
    .run(horsJeu ? activeSessionId() : null, characterId)
  return getCharacter(characterId)
}

/** Présent ou absent à la séance en cours. Seul un joueur peut manquer. */
export function setPresent(characterId: number, present: boolean): Character | null {
  const db = getDb()
  if (present)
    db.prepare(`DELETE FROM seance_absent WHERE session_id = ? AND character_id = ?`).run(
      activeSessionId(),
      characterId
    )
  else
    db.prepare(
      `INSERT OR IGNORE INTO seance_absent (session_id, character_id)
         SELECT ?, id FROM character WHERE id = ? AND kind = 'pj'`
    ).run(activeSessionId(), characterId)
  return getCharacter(characterId)
}

export function getCharacter(id: number): Character | null {
  const r = getDb()
    .prepare(`${SELECT_PERSO} WHERE c.id = @id`)
    .get({ id, sid: activeSessionId() })
  return r ? toCharacter(r) : null
}

/**
 * Écrire l'état d'un personnage là où il vit : dans la séance en cours pour
 * un joueur — les autres séances gardent le leur —, sur sa ligne pour un PNJ.
 * Tous les gestes de la fiche passent par ici.
 */
function ecrisDonnees(id: number, data: CharacterData): void {
  const db = getDb()
  const r = db.prepare(`SELECT kind FROM character WHERE id = ?`).get(id) as
    | { kind: string }
    | undefined
  if (!r) return
  if (r.kind === 'pj') {
    db.prepare(
      `INSERT INTO character_seance (character_id, session_id, data) VALUES (?, ?, ?)
         ON CONFLICT (character_id, session_id) DO UPDATE SET data = excluded.data`
    ).run(id, activeSessionId(), JSON.stringify(data))
    db.prepare(`UPDATE character SET updated_at = datetime('now') WHERE id = ?`).run(id)
  } else {
    db.prepare(`UPDATE character SET data = ?, updated_at = datetime('now') WHERE id = ?`).run(
      JSON.stringify(data),
      id
    )
  }
}

/**
 * Une séance où l'on entre reçoit l'état de ses joueurs : pour chacun qui n'y
 * a encore rien, une copie de la séance d'avant — ses jauges, ses
 * caractéristiques, ses affaires. Ensuite, chaque séance vit sa vie : soigner
 * quelqu'un à la scierie ne le soigne pas à la maison pleureuse.
 *
 * « D'avant » se lit dans l'ordre des séances, celui de la liste (migration 46) ;
 * un joueur qui n'a rien avant repart de sa fiche de base.
 */
export function preparerSeance(sessionId: number): void {
  const db = getDb()
  const cid = activeCampaignId()
  const sienne = db.prepare(`SELECT ord, id FROM game_session WHERE id = ?`).get(sessionId) as
    | { ord: number; id: number }
    | undefined
  if (!sienne) return

  db.transaction(() => {
    const joueurs = db
      .prepare(
        `SELECT c.id, c.data FROM character c
          WHERE c.campaign_id = ? AND c.kind = 'pj'
            AND NOT EXISTS (SELECT 1 FROM character_seance cs
                             WHERE cs.character_id = c.id AND cs.session_id = ?)`
      )
      .all(cid, sessionId) as { id: number; data: string }[]

    for (const j of joueurs) {
      const avant = db
        .prepare(
          `SELECT cs.session_id AS sid, cs.data FROM character_seance cs
             JOIN game_session g ON g.id = cs.session_id
            WHERE cs.character_id = ? AND (g.ord < ? OR (g.ord = ? AND g.id < ?))
            ORDER BY g.ord DESC, g.id DESC LIMIT 1`
        )
        .get(j.id, sienne.ord, sienne.ord, sienne.id) as { sid: number; data: string } | undefined

      db.prepare(
        `INSERT INTO character_seance (character_id, session_id, data) VALUES (?, ?, ?)`
      ).run(j.id, sessionId, avant?.data ?? j.data)

      const dejaEquipe = db
        .prepare(`SELECT 1 FROM objet_placement WHERE character_id = ? AND session_id = ?`)
        .get(j.id, sessionId)
      if (avant && !dejaEquipe)
        for (const o of db
          .prepare(`SELECT id FROM objet_placement WHERE character_id = ? AND session_id = ?`)
          .all(j.id, avant.sid) as { id: number }[])
          copierLigne('objet_placement', o.id, { session_id: sessionId })
    }
  })()
}

/**
 * Reprendre un PNJ d'une autre séance : une copie qui vit sa vie ici — sa
 * fiche, ses notes, son butin et ce qu'il porte. Rien de ce qu'on lui fera
 * ne remonte à l'original. Rend l'identifiant de la copie.
 */
export function duplicatePnj(id: number): number {
  let neuf = 0
  getDb().transaction(() => {
    neuf = copierPnj(id, activeSessionId())
  })()
  return neuf
}

/**
 * Le cœur de la reprise, sans transaction, vers la séance `sid`. `jumeaux`
 * raccroche le portrait et la fiche PDF au double de leur fichier quand le
 * dossier a été recopié avec la séance.
 */
export function copierPnj(id: number, sid: number, jumeaux: Map<number, number> = new Map()): number {
  const db = getDb()
  const ord =
    ((db.prepare(`SELECT MAX(ord) AS m FROM character WHERE campaign_id = ?`).get(activeCampaignId()) as any)
      ?.m ?? -1) + 1
  const brut = db
    .prepare(`SELECT portrait_item_id AS p, sheet_item_id AS f FROM character WHERE id = ?`)
    .get(id) as { p: number | null; f: number | null }
  const fichier = (v: number | null): number | null => (v == null ? null : (jumeaux.get(v) ?? v))
  const neuf = copierLigne('character', id, {
    session_id: sid,
    ord,
    portrait_item_id: fichier(brut.p),
    sheet_item_id: fichier(brut.f)
  })
  for (const o of db.prepare(`SELECT id FROM objet_placement WHERE character_id = ?`).all(id) as {
    id: number
  }[])
    copierLigne('objet_placement', o.id, { character_id: neuf, session_id: sid })
  return neuf
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
  portraitCadre?: CadreCarre | null
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
                            portrait_cadre = @portraitCadre, sheet_item_id = @sheetItemId, sheet_frame = @sheetFrame,
                            notes = @notes, butin = @butin,
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
      /* Nouveau portrait, nouveau carré : celui d'avant visait un autre visage. */
      portraitCadre: carre(
        input.portraitCadre !== undefined
          ? input.portraitCadre
          : input.portraitItemId !== undefined && input.portraitItemId !== cur.portraitItemId
            ? null
            : cur.portraitCadre
      ),
      sheetItemId: input.sheetItemId !== undefined ? input.sheetItemId : cur.sheetItemId,
      sheetFrame: cadre(input.sheetFrame !== undefined ? input.sheetFrame : cur.sheetFrame),
      /* La nature ne se modifie pas ici : on ne rétrograde pas une fiche en
         pion, et on ne fait pas d'un joueur un PNJ par un champ de formulaire. */
      notes: input.notes !== undefined ? input.notes : cur.notes,
      butin: ecrisButin(input.butin !== undefined ? input.butin : cur.butin)
    })
    if (input.data) ecrisDonnees(input.id, input.data)
    return getCharacter(input.id)!
  }

  const tpl = listTemplates().find((t) => t.id === input.templateId)
  const data = input.data ?? (tpl ? blankData(tpl.spec) : { gauges: {}, stats: {}, skills: {}, states: {} })
  const ord =
    ((db.prepare(`SELECT MAX(ord) AS m FROM character WHERE campaign_id = ?`).get(activeCampaignId()) as any)
      ?.m ?? -1) + 1

  const info = db
    .prepare(
      `INSERT INTO character (campaign_id, session_id, template_id, kind, notes, butin, name, player,
                              occupation, age, color, sexe, portrait_item_id, portrait_cadre,
                              sheet_item_id, sheet_frame, data, ord)
       VALUES (@cid, @sid, @templateId, @kind, @notes, @butin, @name, @player,
               @occupation, @age, @color, @sexe, @portraitItemId, @portraitCadre,
               @sheetItemId, @sheetFrame, @data, @ord)`
    )
    .run({
      cid: activeCampaignId(),
      /* Un PNJ naît dans la séance où on l'écrit ; un joueur, dans toutes. */
      sid: (input.kind ?? 'pj') === 'pnj' ? activeSessionId() : null,
      templateId: input.templateId,
      kind: input.kind ?? 'pj',
      notes: input.notes ?? null,
      butin: ecrisButin(input.butin),
      name: input.name,
      player: input.player ?? null,
      occupation: input.occupation ?? null,
      age: input.age ?? null,
      sexe: input.sexe ?? null,
      /* Une couleur d'office a la creation : la premiere libre parmi les
         joueurs. C'est elle qui distingue le joueur dans la liste et cercle
         son pion. Les PNJ ne comptent pas : ils ne retiennent aucune teinte. */
      color:
        input.color ??
        couleurLibre(
          listCharacters()
            .filter((c) => c.kind !== 'pnj')
            .map((c) => c.color)
        ),
      portraitItemId: input.portraitItemId ?? null,
      portraitCadre: carre(input.portraitCadre ?? null),
      sheetItemId: input.sheetItemId ?? null,
      sheetFrame: cadre(input.sheetFrame ?? null),
      data: JSON.stringify(data),
      ord
    })
  const id = Number(info.lastInsertRowid)
  /* Un joueur neuf entre dans la séance en cours avec sa fiche de base ; les
     séances suivantes en tireront copie, les précédentes la liront telle quelle. */
  if ((input.kind ?? 'pj') === 'pj') ecrisDonnees(id, data)
  return getCharacter(id)!
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
    ecrisDonnees(characterId, ch.data)
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
  ecrisDonnees(characterId, ch.data)
  return getCharacter(characterId)!
}

export function setSkill(characterId: number, key: string, value: number): Character {
  const ch = getCharacter(characterId)!
  ch.data.skills[key] = value
  ecrisDonnees(characterId, ch.data)
  return getCharacter(characterId)!
}

export function setStat(characterId: number, key: string, value: number): Character {
  const ch = getCharacter(characterId)!
  ch.data.stats[key] = value
  ecrisDonnees(characterId, ch.data)
  return getCharacter(characterId)!
}

export function setState(characterId: number, key: string, on: boolean): Character {
  const ch = getCharacter(characterId)!
  ch.data.states[key] = on
  ecrisDonnees(characterId, ch.data)
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
