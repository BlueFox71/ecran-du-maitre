/**
 * Les lieux en texte : chacun a son fichier `.txt` dans le dossier « Lieux » de
 * sa séance, côté dossier de l'app (`.ecran-du-maitre/<séance>/Lieux`), qu'on peut lire et écrire hors de l'application — l'explorateur,
 * un éditeur, une autre session. Deux parties, la description que voient les
 * joueurs et les notes du MJ ; le reste du lieu (plan, murs, pièces) ne vit
 * qu'en base.
 *
 * Depuis le 11 octobre, la fiche du lieu y passe aussi : ses scénarios, ses
 * découvertes et ses déclencheurs, chacun sous un « ## titre ». Ni la coche ni
 * les liens (objets, PNJ, moment) n'y figurent : ils restent en base, et
 * suivent la carte tant que son titre ne change pas.
 *
 * La liaison va dans les deux sens. On garde, par lieu, ce qui a été accordé
 * la dernière fois (réglage `lieux.textes`) : le côté qui s'en est écarté
 * l'emporte. Si les deux ont bougé, le fichier gagne — c'est lui qu'on vient
 * d'écrire à la main.
 *
 * Le nom du fichier est celui du lieu ; deux lieux du même nom dans une séance
 * se départagent par « (2) », dans l'ordre de leur création. Un fichier
 * renommé dans l'explorateur n'est plus reconnu : on renomme le lieu, pas son
 * fichier.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { BrowserWindow, shell } from 'electron'
import { activeCampaignId, getDb, isDbOpen } from './db'
import * as reglages from './db/repos/reglages'
import { ficheEnTexte, poserFicheTexte, type FicheTexte } from './db/repos/ficheLieu'
import { absOf, announce, assurerDossier, campaignRoot, insideRoot, safeName } from './library'
import { DOSSIER_LIEUX, dossierDeLApp } from '@shared/dossierDeLApp'
const CLE = 'lieux.textes'
const TITRE_DESC = "# Description — ce que voient les joueurs en arrivant"
const TITRE_NOTES = "# Notes du MJ — ce qu'ils ne doivent pas savoir"
const TITRE_SCEN = '# Scénarios — ce que les joueurs peuvent tenter ici'
const TITRE_DECO = "# Découvertes — ce qu'on peut trouver ici"
const TITRE_DECL = '# Déclencheurs — ce qui arrive si…'

type Partie = 's' | 'n' | 'scen' | 'deco' | 'decl'
const PARTIES: [Partie, RegExp][] = [
  ['s', /^#\s*Description\b/i],
  ['n', /^#\s*Notes du MJ\b/i],
  ['scen', /^#\s*Sc[ée]narios?\b/i],
  ['deco', /^#\s*D[ée]couvertes?\b/i],
  ['decl', /^#\s*D[ée]clencheurs?\b/i]
]

interface Valeurs {
  s: string
  n: string
  /** La fiche mise au propre ; absente des accords d'avant le 11 octobre. */
  f?: string
}
interface Suivi extends Valeurs {
  rel: string
}
interface Ligne {
  id: number
  name: string
  summary: string | null
  notes: string | null
  parentId: number | null
  sessionId: number | null
  base: string | null
}

const net = (t: string): string => t.replace(/\r\n?/g, '\n').trim()
const pareil = (a: Valeurs, b: Valeurs): boolean =>
  net(a.s) === net(b.s) && net(a.n) === net(b.n) && (a.f === undefined || b.f === undefined || a.f === b.f)

/** Les parties d'un fichier, sous leurs titres « # ». Ce qui précède le premier (la filiation) ne compte pas. */
function decouper(texte: string): Partial<Record<Partie, string>> | null {
  const parts: Partial<Record<Partie, string[]>> = {}
  let cur: Partie | null = null
  for (const l of texte.replace(/\r\n?/g, '\n').split('\n')) {
    const p = /^#(?!#)/.test(l) ? PARTIES.find(([, re]) => re.test(l))?.[0] : undefined
    if (p) {
      cur = p
      parts[p] ??= []
    } else if (cur) parts[cur]!.push(l)
  }
  if (!cur) return null
  const out: Partial<Record<Partie, string>> = {}
  for (const [k, v] of Object.entries(parts)) out[k as Partie] = v.join('\n')
  return out
}

/** Les « ## titre » d'une partie. Du texte avant le premier titre fait un article sans titre. */
function articles(t: string): { titre: string; corps: string }[] {
  const out: { titre: string; lignes: string[] }[] = []
  let cur: { titre: string; lignes: string[] } | null = null
  for (const l of t.split('\n')) {
    const m = /^##(?!#)\s*(.*)$/.exec(l)
    if (m) {
      cur = { titre: m[1].trim(), lignes: [] }
      out.push(cur)
    } else if (cur) cur.lignes.push(l)
    else if (l.trim()) {
      cur = { titre: '', lignes: [l] }
      out.push(cur)
    }
  }
  return out.map((a) => ({ titre: a.titre, corps: net(a.lignes.join('\n')) }))
}

const SI = /^\s*si\s*:\s?/i
const ALORS = /^\s*alors\s*:\s?/i

/** « Si : … » puis « Alors : … ». Sans aucun des deux, tout est l'« alors ». */
function siAlors(corps: string): { si: string; alors: string } {
  const si: string[] = []
  const alors: string[] = []
  const libre: string[] = []
  let ou: string[] = libre
  for (const l of corps.split('\n')) {
    if (SI.test(l)) (ou = si).push(l.replace(SI, ''))
    else if (ALORS.test(l)) (ou = alors).push(l.replace(ALORS, ''))
    else ou.push(l)
  }
  if (!si.length && !alors.length) return { si: '', alors: net(libre.join('\n')) }
  return { si: net([...libre, ...si].join('\n')), alors: net(alors.join('\n')) }
}

function lireFiche(p: Partial<Record<Partie, string>> | null): FicheTexte {
  const cartes = (t: string | undefined, sorte: 'decouverte' | 'declencheur'): FicheTexte['cartes'] =>
    articles(t ?? '').map((a) => ({ sorte, titre: a.titre, ...siAlors(a.corps) }))
  return {
    scenarios: articles(p?.scen ?? '').map((a) => ({ titre: a.titre, info: a.corps })),
    cartes: [...cartes(p?.deco, 'decouverte'), ...cartes(p?.decl, 'declencheur')]
  }
}

/** La fiche en texte, toujours de la même façon : c'est elle qu'on compare. */
function ecrireFiche(f: FicheTexte): string {
  const article = (titre: string, corps: string): string => `## ${titre}`.trimEnd() + (corps ? `\n${corps}` : '')
  const partie = (titre: string, items: string[]): string => [titre, ...items].join('\n\n')
  const cartes = (sorte: string): string[] =>
    f.cartes
      .filter((c) => c.sorte === sorte)
      .map((c) => article(c.titre, `Si : ${net(c.si)}`.trimEnd() + '\n' + `Alors : ${net(c.alors)}`.trimEnd()))
  return [
    partie(TITRE_SCEN, f.scenarios.map((s) => article(s.titre, net(s.info)))),
    partie(TITRE_DECO, cartes('decouverte')),
    partie(TITRE_DECL, cartes('declencheur'))
  ].join('\n\n')
}

/** Ce que dit un fichier : sans titres, tout est description. */
export function lire(texte: string): Valeurs {
  const p = decouper(texte)
  if (!p) return { s: net(texte), n: '', f: ecrireFiche(lireFiche(null)) }
  return { s: net(p.s ?? ''), n: net(p.n ?? ''), f: ecrireFiche(lireFiche(p)) }
}

/** Un fichier d'avant la fiche : il lui manque ses titres. */
const sansFiche = (brut: string): boolean =>
  PARTIES.slice(2).some(([, re]) => !brut.split(/\r?\n/).some((l) => re.test(l)))

function ecrireTexte(chemin: string, v: Valeurs): string {
  return `${chemin}\n\n${TITRE_DESC}\n${net(v.s)}\n\n${TITRE_NOTES}\n${net(v.n)}\n\n${v.f ?? ''}\n`
}

function charger(): Record<string, Suivi> {
  try {
    return JSON.parse(reglages.tous()[CLE] ?? '{}')
  } catch {
    return {}
  }
}

/** Le chemin de chaque lieu : son nom, unique dans le dossier de sa séance. */
function chemins(lignes: Ligne[]): Map<number, string> {
  const pris = new Map<string, Set<string>>()
  const out = new Map<number, string>()
  for (const l of [...lignes].sort((a, b) => a.id - b.id)) {
    const dossier = dossierDeLApp(l.base, DOSSIER_LIEUX)
    const noms = pris.get(dossier) ?? new Set<string>()
    pris.set(dossier, noms)
    let nom: string
    try {
      nom = safeName(l.name)
    } catch {
      nom = 'Lieu'
    }
    let essai = nom
    for (let k = 2; noms.has(essai.toLowerCase()); k++) essai = `${nom} (${k})`
    noms.add(essai.toLowerCase())
    out.set(l.id, `${dossier}/${essai}.txt`)
  }
  return out
}

function filiation(l: Ligne, parId: Map<number, Ligne>): string {
  const noms: string[] = []
  for (let p: Ligne | undefined = l; p && noms.length < 12; p = p.parentId ? parId.get(p.parentId) : undefined)
    noms.unshift(p.name)
  return noms.join(' › ')
}

let enCours = false

/**
 * Accorde les lieux et leurs fichiers. Idempotent : on peut l'appeler après
 * chaque relecture du dossier et chaque retouche d'un lieu. Rend le nombre de
 * lieux modifiés depuis le disque.
 */
export function synchroniserLieux(): number {
  if (enCours || !isDbOpen() || !campaignRoot()) return 0
  enCours = true
  try {
    const db = getDb()
    const lignes = db
      .prepare(
        `SELECT p.id, p.name, p.summary, p.notes, p.parent_id AS parentId,
                p.session_id AS sessionId, g.folder_rel AS base
           FROM place p LEFT JOIN game_session g ON g.id = p.session_id
          WHERE p.campaign_id = ?`
      )
      .all(activeCampaignId()) as Ligne[]
    const parId = new Map(lignes.map((l) => [l.id, l]))
    const voulus = chemins(lignes)
    const avant = charger()
    const apres: Record<string, Suivi> = {}
    const majLieu = db.prepare(`UPDATE place SET summary = ?, notes = ? WHERE id = ?`)
    const dossiersFaits = new Set<string>()
    let depuisDisque = 0

    for (const l of lignes) {
      const rel = voulus.get(l.id)!
      const abs = absOf(rel)
      if (!insideRoot(abs)) continue
      const prev = avant[l.id]
      const enBase: Valeurs = { s: l.summary ?? '', n: l.notes ?? '', f: ecrireFiche(ficheEnTexte(l.id)) }
      const chemin = filiation(l, parId)

      // Renommé, ou départagé autrement : le fichier suit le lieu.
      if (prev && prev.rel !== rel && !existsSync(abs) && existsSync(absOf(prev.rel))) {
        mkdirSync(dirname(abs), { recursive: true })
        renameSync(absOf(prev.rel), abs)
      }

      const dossier = dirname(rel)
      if (!dossiersFaits.has(dossier)) {
        dossiersFaits.add(dossier)
        // Créé par la bibliothèque, pour qu'il ait sa ligne — et son icône.
        if (!existsSync(absOf(dossier))) assurerDossier(dossier, 'lieu')
      }

      if (!existsSync(abs)) {
        writeFileSync(abs, ecrireTexte(chemin, enBase), 'utf8')
        apres[l.id] = { rel, ...enBase }
        continue
      }
      const brut = readFileSync(abs, 'utf8')
      const surDisque = lire(brut)
      if (pareil(surDisque, enBase)) {
        // D'accord sur le fond ; la ligne de filiation, elle, suit l'arbre.
        if (!brut.startsWith(`${chemin}\n`) || sansFiche(brut)) writeFileSync(abs, ecrireTexte(chemin, enBase), 'utf8')
        apres[l.id] = { rel, ...enBase }
      } else if (prev && pareil(surDisque, prev)) {
        // Seule la base a bougé : le fichier la rattrape.
        writeFileSync(abs, ecrireTexte(chemin, enBase), 'utf8')
        apres[l.id] = { rel, ...enBase }
      } else {
        // Le fichier a été écrit ailleurs : le lieu le reprend.
        db.transaction(() => {
          majLieu.run(surDisque.s || null, surDisque.n || null, l.id)
          poserFicheTexte(l.id, lireFiche(decouper(brut)))
        })()
        apres[l.id] = { rel, ...surDisque }
        depuisDisque++
      }
    }

    // Un lieu supprimé emporte son fichier, s'il n'a pas été retouché depuis.
    for (const [id, prev] of Object.entries(avant)) {
      if (parId.has(Number(id))) continue
      const abs = absOf(prev.rel)
      if (!existsSync(abs) || !insideRoot(abs)) continue
      if (pareil(lire(readFileSync(abs, 'utf8')), prev)) void shell.trashItem(abs).catch(() => {})
    }

    const json = JSON.stringify(apres)
    if (json !== (reglages.tous()[CLE] ?? '')) reglages.poser(CLE, json)
    if (depuisDisque) {
      announce()
      for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send('fiche:relue')
    }
    return depuisDisque
  } catch (e) {
    console.error('[lieux] accord avec les fichiers impossible :', e)
    return 0
  } finally {
    enCours = false
  }
}

let minuterie: NodeJS.Timeout | null = null

/** Bientôt, une fois que les écritures de l'instant se sont calmées. */
export function synchroniserBientot(): void {
  if (minuterie) clearTimeout(minuterie)
  minuterie = setTimeout(() => {
    minuterie = null
    synchroniserLieux()
  }, 400)
}
