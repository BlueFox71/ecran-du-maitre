/**
 * Les PNJ en texte : chacun a son fichier `.txt` dans le dossier « PNJ » de sa
 * séance, côté dossier de l'app (`.ecran-du-maitre/<séance>/PNJ`), comme les
 * lieux. On y lit et écrit son identité, les notes du MJ, ses
 * caractéristiques, ses jauges, ses compétences et son butin. Portrait,
 * couleur, liens et cases « pris » du butin restent en base.
 *
 * La liaison va dans les deux sens, sur le modèle de `lieuxTexte.ts` : on
 * garde ce qui a été accordé la dernière fois (réglage `pnj.textes`), le côté
 * qui s'en est écarté l'emporte, et si les deux ont bougé, le fichier gagne.
 *
 * Différence avec les lieux : un fichier neuf posé dans un dossier « PNJ »
 * fait naître un PNJ dans la séance de ce dossier, sous le nom du fichier.
 * Un fichier renommé passe donc pour un PNJ neuf : on renomme le PNJ, pas son
 * fichier.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { basename, dirname } from 'node:path'
import { BrowserWindow, shell } from 'electron'
import { activeCampaignId, getDb, isDbOpen } from './db'
import * as reglages from './db/repos/reglages'
import { campaignSheet, getCharacter, upsertCharacter } from './db/repos/characters'
import { absOf, announce, assurerDossier, campaignRoot, insideRoot, safeName } from './library'
import { DOSSIER_PNJ, dossierDeLApp } from '@shared/dossierDeLApp'
import type { ButinLigne, Character, Sexe, TemplateSpec } from '@shared/types'

const CLE = 'pnj.textes'
const TITRE_ID = '# Identité'
const TITRE_NOTES = "# Notes du MJ — ce qu'il cache, ce qui le fait céder"
const TITRE_CARAC = '# Caractéristiques'
const TITRE_JAUGES = '# Jauges — valeur / maximum'
const TITRE_COMP = "# Compétences — seulement celles qu'il a"
const TITRE_BUTIN = "# Butin — ce qu'on lui trouve sur le corps, une ligne par chose"

type Partie = 'id' | 'notes' | 'carac' | 'jauges' | 'comp' | 'butin'
const PARTIES: [Partie, RegExp][] = [
  /* Pas de \b après un « é » : pour la regex, ce n'est pas une lettre. */
  ['id', /^#\s*Identit[ée](?!\w)/i],
  ['notes', /^#\s*Notes du MJ\b/i],
  ['carac', /^#\s*Caract[ée]ristiques?\b/i],
  ['jauges', /^#\s*Jauges?\b/i],
  ['comp', /^#\s*Comp[ée]tences?\b/i],
  ['butin', /^#\s*Butin\b/i]
]

/** Ce que le fichier dit d'un PNJ. Un champ absent ne bouge pas. */
interface Etat {
  occupation: string
  age: string
  sexe: Sexe | null
  notes: string
  stats: Record<string, number>
  jauges: Record<string, { value: number; max?: number }>
  comp: Record<string, number>
  butin: { texte: string; qte: number }[]
}

interface Suivi {
  rel: string
  t: string
}
interface Ligne {
  id: number
  name: string
  base: string | null
}

const net = (t: string): string => t.replace(/\r\n?/g, '\n').trim()
/** Pour reconnaître un libellé : sans casse ni accents. */
const cle = (t: string): string =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()

function decouper(texte: string): Partial<Record<Partie, string>> {
  const parts: Partial<Record<Partie, string[]>> = {}
  let cur: Partie | null = null
  for (const l of texte.replace(/\r\n?/g, '\n').split('\n')) {
    const p = /^#(?!#)/.test(l) ? PARTIES.find(([, re]) => re.test(l))?.[0] : undefined
    if (p) {
      cur = p
      parts[p] ??= []
    } else if (cur) parts[cur]!.push(l)
  }
  const out: Partial<Record<Partie, string>> = {}
  for (const [k, v] of Object.entries(parts)) out[k as Partie] = v.join('\n')
  return out
}

/** Les lignes « Libellé : valeur » d'une partie. */
function paires(t: string | undefined): [string, string][] {
  const out: [string, string][] = []
  for (const l of (t ?? '').split('\n')) {
    const m = /^\s*(?:[-•]\s*)?([^:]+?)\s*:\s*(.*?)\s*$/.exec(l)
    if (m) out.push([m[1], m[2]])
  }
  return out
}

const nombre = (t: string): number | null => {
  const n = Number(t.replace(',', '.').replace(/\s+/g, ''))
  return Number.isFinite(n) ? Math.round(n) : null
}

/** Le libellé d'un champ de la fiche de campagne : son nom, son abrégé ou sa clé. */
function trouver<T extends { key: string; label: string; code?: string }>(liste: T[], libelle: string): T | undefined {
  const k = cle(libelle)
  return liste.find((x) => cle(x.label) === k || (x.code && cle(x.code) === k) || cle(x.key) === k)
}

function lire(texte: string, spec: TemplateSpec): Etat {
  const p = decouper(texte)
  const id = new Map(paires(p.id).map(([k, v]) => [cle(k), v]))
  const sexe = cle(id.get('sexe') ?? '')
  const e: Etat = {
    occupation: id.get('occupation') ?? '',
    age: id.get('age') ?? '',
    sexe: sexe.startsWith('f') ? 'femme' : sexe.startsWith('h') ? 'homme' : null,
    notes: net(p.notes ?? ''),
    stats: {},
    jauges: {},
    comp: {},
    butin: []
  }
  for (const [k, v] of paires(p.carac)) {
    const s = trouver(spec.stats, k)
    const n = nombre(v)
    if (s && n != null) e.stats[s.key] = n
  }
  for (const [k, v] of paires(p.jauges)) {
    const g = trouver(spec.gauges, k)
    const [val, max] = v.split('/').map((x) => nombre(x))
    if (g && val != null) e.jauges[g.key] = max != null ? { value: val, max } : { value: val }
  }
  for (const [k, v] of paires(p.comp)) {
    const s = trouver(spec.skills, k)
    if (s) e.comp[s.key] = nombre(v) ?? 0
  }
  for (const brut of (p.butin ?? '').split('\n')) {
    const l = brut.replace(/^\s*[-•]\s*/, '').trim()
    if (!l) continue
    const m = /^(.*?)\s+[×xX]\s*(\d+)$/.exec(l)
    e.butin.push(m ? { texte: m[1].trim(), qte: Number(m[2]) } : { texte: l, qte: 1 })
  }
  return e
}

function depuisBase(c: Character): Etat {
  const jauges: Etat['jauges'] = {}
  for (const [k, g] of Object.entries(c.data.gauges)) jauges[k] = { value: g.value, max: g.max }
  return {
    occupation: c.occupation ?? '',
    age: c.age ?? '',
    sexe: c.sexe,
    notes: c.notes ?? '',
    stats: { ...c.data.stats },
    jauges,
    comp: { ...c.data.skills },
    butin: c.butin.map((b) => ({ texte: b.texte, qte: b.qte }))
  }
}

/** L'état en texte, toujours de la même façon : c'est lui qu'on compare. */
function ecrire(e: Etat, spec: TemplateSpec): string {
  const ligne = (k: string, v: string): string => `${k} : ${v}`.trimEnd()
  const partie = (titre: string, lignes: string[]): string => [titre, ...lignes].join('\n')
  return [
    partie(TITRE_ID, [ligne('Occupation', net(e.occupation)), ligne('Âge', net(e.age)), ligne('Sexe', e.sexe ?? '')]),
    partie(TITRE_NOTES, [net(e.notes)].filter(Boolean)),
    partie(
      TITRE_CARAC,
      spec.stats.filter((s) => e.stats[s.key] !== undefined).map((s) => ligne(s.label, String(e.stats[s.key])))
    ),
    partie(
      TITRE_JAUGES,
      spec.gauges
        .filter((g) => e.jauges[g.key])
        .map((g) => {
          const j = e.jauges[g.key]
          return ligne(g.label, j.max !== undefined ? `${j.value} / ${j.max}` : String(j.value))
        })
    ),
    partie(
      TITRE_COMP,
      spec.skills.filter((s) => e.comp[s.key] !== undefined).map((s) => ligne(s.label, String(e.comp[s.key])))
    ),
    partie(
      TITRE_BUTIN,
      e.butin.map((b) => (b.qte === 1 ? b.texte : `${b.texte} × ${b.qte}`))
    )
  ].join('\n\n')
}

const fichier = (nom: string, t: string): string => `${nom}\n\n${t}\n`

/** Le fichier a été écrit ailleurs : le PNJ le reprend. */
function poser(id: number, e: Etat): void {
  const c = getCharacter(id)
  if (!c) return
  const data = { ...c.data, stats: { ...c.data.stats }, gauges: { ...c.data.gauges } }
  for (const [k, v] of Object.entries(e.stats)) data.stats[k] = v
  for (const [k, j] of Object.entries(e.jauges)) {
    const max = Math.max(0, j.max ?? data.gauges[k]?.max ?? j.value)
    data.gauges[k] = { value: Math.max(0, Math.min(max, j.value)), max }
  }
  /* Les compétences du fichier sont celles qu'il a : les autres sont rendues. */
  data.skills = { ...e.comp }
  /* Le butin se reconnaît à son intitulé : la case « pris » le suit. */
  const restes = [...c.butin]
  const butin: ButinLigne[] = e.butin.map((b, i) => {
    const j = restes.findIndex((x) => cle(x.texte) === cle(b.texte))
    const avant = j < 0 ? undefined : restes.splice(j, 1)[0]
    return { id: avant?.id ?? `t${Date.now().toString(36)}${i}`, texte: b.texte, qte: b.qte, pris: avant?.pris ?? false }
  })
  upsertCharacter({
    id,
    templateId: c.templateId,
    name: c.name,
    occupation: e.occupation || null,
    age: e.age || null,
    sexe: e.sexe,
    notes: e.notes || null,
    butin,
    data
  })
}

function charger(): Record<string, Suivi> {
  try {
    return JSON.parse(reglages.tous()[CLE] ?? '{}')
  } catch {
    return {}
  }
}

/** Le chemin de chaque PNJ : son nom, unique dans le dossier de sa séance. */
function chemins(lignes: Ligne[]): Map<number, string> {
  const pris = new Map<string, Set<string>>()
  const out = new Map<number, string>()
  for (const l of [...lignes].sort((a, b) => a.id - b.id)) {
    const dossier = dossierDeLApp(l.base, DOSSIER_PNJ)
    const noms = pris.get(dossier) ?? new Set<string>()
    pris.set(dossier, noms)
    let nom: string
    try {
      nom = safeName(l.name)
    } catch {
      nom = 'PNJ'
    }
    let essai = nom
    for (let k = 2; noms.has(essai.toLowerCase()); k++) essai = `${nom} (${k})`
    noms.add(essai.toLowerCase())
    out.set(l.id, `${dossier}/${essai}.txt`)
  }
  return out
}

let enCours = false

/**
 * Accorde les PNJ et leurs fichiers, et fait naître ceux qu'un fichier neuf
 * annonce. Idempotent. Rend le nombre de PNJ touchés depuis le disque.
 */
export function synchroniserPnj(): number {
  if (enCours || !isDbOpen() || !campaignRoot()) return 0
  enCours = true
  try {
    const db = getDb()
    const cid = activeCampaignId()
    const lignes = db
      .prepare(
        `SELECT c.id, c.name, g.folder_rel AS base
           FROM character c LEFT JOIN game_session g ON g.id = c.session_id
          WHERE c.campaign_id = ? AND c.kind = 'pnj'`
      )
      .all(cid) as Ligne[]
    const spec = campaignSheet().spec
    const voulus = chemins(lignes)
    const avant = charger()
    const apres: Record<string, Suivi> = {}
    const dossiersFaits = new Set<string>()
    let depuisDisque = 0
    let nes = 0

    const assurer = (dossier: string): void => {
      if (dossiersFaits.has(dossier)) return
      dossiersFaits.add(dossier)
      if (!existsSync(absOf(dossier))) assurerDossier(dossier, 'personne')
    }

    for (const l of lignes) {
      const rel = voulus.get(l.id)!
      const abs = absOf(rel)
      if (!insideRoot(abs)) continue
      const prev = avant[l.id]
      const c = getCharacter(l.id)
      if (!c) continue
      const enBase = ecrire(depuisBase(c), spec)

      // Renommé : le fichier suit le PNJ.
      if (prev && prev.rel !== rel && !existsSync(abs) && existsSync(absOf(prev.rel))) {
        mkdirSync(dirname(abs), { recursive: true })
        renameSync(absOf(prev.rel), abs)
      }
      assurer(dirname(rel))

      if (!existsSync(abs)) {
        writeFileSync(abs, fichier(l.name, enBase), 'utf8')
        apres[l.id] = { rel, t: enBase }
        continue
      }
      const brut = readFileSync(abs, 'utf8')
      const lu = lire(brut, spec)
      const surDisque = ecrire(lu, spec)
      if (surDisque === enBase) {
        // D'accord sur le fond ; la première ligne, elle, suit le nom.
        if (!brut.startsWith(`${l.name}\n`)) writeFileSync(abs, fichier(l.name, enBase), 'utf8')
        apres[l.id] = { rel, t: enBase }
      } else if (prev && prev.t === surDisque) {
        // Seule la base a bougé : le fichier la rattrape.
        writeFileSync(abs, fichier(l.name, enBase), 'utf8')
        apres[l.id] = { rel, t: enBase }
      } else {
        // Le fichier a été écrit ailleurs : le PNJ le reprend.
        db.transaction(() => poser(l.id, lu))()
        apres[l.id] = { rel, t: surDisque }
        depuisDisque++
      }
    }

    // Un fichier neuf dans un dossier « PNJ » : un PNJ naît dans sa séance.
    const pris = new Set([...voulus.values()].map((r) => r.toLowerCase()))
    const seances = db
      .prepare(`SELECT id, folder_rel AS base FROM game_session WHERE campaign_id = ? ORDER BY ord, id`)
      .all(cid) as { id: number; base: string | null }[]
    const parDossier = new Map<string, number | null>()
    for (const s of seances) {
      const d = dossierDeLApp(s.base, DOSSIER_PNJ)
      if (!parDossier.has(d)) parDossier.set(d, s.id)
    }
    const racine = dossierDeLApp(null, DOSSIER_PNJ)
    if (!parDossier.has(racine)) parDossier.set(racine, null)
    for (const [dossier, sid] of parDossier) {
      const abs = absOf(dossier)
      if (!existsSync(abs) || !insideRoot(abs)) continue
      for (const nom of readdirSync(abs)) {
        if (!/\.txt$/i.test(nom)) continue
        const rel = `${dossier}/${nom}`
        if (pris.has(rel.toLowerCase())) continue
        const lu = lire(readFileSync(absOf(rel), 'utf8'), spec)
        db.transaction(() => {
          const neuf = upsertCharacter({
            templateId: campaignSheet().id,
            kind: 'pnj',
            name: basename(nom, '.txt').trim() || 'PNJ'
          })
          db.prepare(`UPDATE character SET session_id = ? WHERE id = ?`).run(sid, neuf.id)
          poser(neuf.id, lu)
          /* Accordé sur ce que dit le fichier : au tour suivant, la base le
             complète (caractéristiques et jauges de départ). */
          apres[neuf.id] = { rel, t: ecrire(lu, spec) }
        })()
        depuisDisque++
        nes++
      }
    }
    if (nes) synchroniserPnjBientot()

    // Un PNJ supprimé emporte son fichier, s'il n'a pas été retouché depuis.
    const ids = new Set(lignes.map((l) => l.id))
    for (const [id, prev] of Object.entries(avant)) {
      if (ids.has(Number(id))) continue
      const abs = absOf(prev.rel)
      if (!existsSync(abs) || !insideRoot(abs)) continue
      if (ecrire(lire(readFileSync(abs, 'utf8'), spec), spec) === prev.t) void shell.trashItem(abs).catch(() => {})
    }

    const json = JSON.stringify(apres)
    if (json !== (reglages.tous()[CLE] ?? '')) reglages.poser(CLE, json)
    if (depuisDisque) {
      announce()
      for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send('characters:relus')
    }
    return depuisDisque
  } catch (e) {
    console.error('[pnj] accord avec les fichiers impossible :', e)
    return 0
  } finally {
    enCours = false
  }
}

let minuterie: NodeJS.Timeout | null = null

/** Bientôt, une fois que les écritures de l'instant se sont calmées. */
export function synchroniserPnjBientot(): void {
  if (minuterie) clearTimeout(minuterie)
  minuterie = setTimeout(() => {
    minuterie = null
    synchroniserPnj()
  }, 400)
}
