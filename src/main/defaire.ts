import type Database from 'better-sqlite3'
import { BrowserWindow } from 'electron'

/**
 * Défaire et refaire — Ctrl+Z, Ctrl+Y — pour ce qu'on prépare : moments,
 * lieux, murs, portes, lumières, repères, objets, fiches, annexes, fiche de
 * campagne.
 *
 * Plutôt qu'une pile par module, c'est la base qui tient la mémoire : des
 * déclencheurs **temporaires** (attachés à la connexion, jamais écrits dans le
 * fichier de la campagne) notent, pour chaque ligne touchée, l'ordre SQL qui
 * la remet comme avant. Un échange avec l'interface — un appel IPC suivi —
 * fait un pas ; un geste en plusieurs appels (un trait de mur qui en perce
 * d'autres) se regroupe en un seul. Défaire rejoue le pas à l'envers, et les
 * mêmes déclencheurs notent au passage de quoi le refaire.
 *
 * Ce qui n'est pas suivi : le jeu (écran, pions, jets, portables, pochette),
 * et la bibliothèque, dont le disque fait foi — une ligne de fichier ne se
 * recrée pas sans son fichier. Des tables de fichiers, on ne suit donc que
 * les modifications, jamais les naissances ni les disparitions.
 */

interface Pas {
  /** Ce qu'on montre à l'utilisateur : « Lieux », « Murs »… */
  libelle: string
  /** Les ordres inverses, dans l'ordre où ils ont été notés. */
  sqls: string[]
  /** Quand il a été noté, pour reconnaître une rafale. */
  quand?: number
}

/** Les cases que touche un pas fait seulement de modifications, ou null. */
const cases = (sqls: string[]): string | null =>
  sqls.every((q) => q.startsWith('UPDATE '))
    ? [...new Set(sqls.map((q) => q.replace(/=.* WHERE rowid=/, ' WHERE rowid=')))].sort().join('\n')
    : null

export interface EtatDefaire {
  defaire: string | null
  refaire: string | null
}

/** Au-delà, les plus anciens pas tombent. */
const PROFONDEUR = 100

/** Tables dont les lignes suivent des fichiers : modifications seulement. */
const TABLES_DU_DISQUE = new Set(['item', 'folder', 'tag', 'item_tag', 'folder_tag'])
/** Tables qu'on ne touche jamais. */
const TABLES_HORS = new Set(['migration'])

/** Les modules de la préparation, et le nom qu'on leur donne en retour. */
const MODULES: Record<string, string> = {
  timeline: 'Chronologie',
  places: 'Lieux',
  murs: 'Murs',
  ouvertures: 'Portes et fenêtres',
  lumieres: 'Lumières',
  annotations: 'Repères',
  objets: 'Objets',
  characters: 'Fiches',
  annexes: 'Annexes',
  templates: 'Fiche de campagne',
  sheet: 'Fiche de campagne',
  models: 'Fiche de campagne',
  catalogue: 'Fiche de campagne'
}

/**
 * Dans ces modules, les canaux qui relèvent du jeu ou de la séance et non de
 * la préparation — ou qui touchent au disque. Ils ne font pas de pas.
 */
const CANAUX_HORS = new Set([
  'timeline:createSession',
  'timeline:deleteSession',
  'timeline:setActiveSession',
  'timeline:placerSeance',
  'places:seen',
  'characters:adjust',
  'characters:setState',
  'characters:log',
  'characters:present',
  'characters:horsJeu'
])

/**
 * Un ordre inverse qui ne relève que du jeu, même noté par un canal suivi :
 * cocher « Joué » sur un moment ne se défait pas d'un Ctrl+Z de préparation.
 */
const INVERSES_DU_JEU = [
  /^UPDATE "beat" SET "done"=/,
  /* Ouvrir une porte, tirer un rideau, allumer une lampe : ça se referme et
     ça s'éteint, ça ne s'annule pas. */
  /^UPDATE "ouverture" SET "ouverte"=/,
  /^UPDATE "lumiere" SET "allumee"=/
]

/**
 * Une rafale — un curseur qu'on fait glisser, un mur qu'on tire — envoie des
 * dizaines de modifications des mêmes cases. Elles ne font qu'un pas : celui
 * du début de la rafale, qui sait déjà rendre la valeur d'origine.
 */
const RAFALE_MS = 1500

let base: Database.Database | null = null
let pileDefaire: Pas[] = []
let pileRefaire: Pas[] = []
/** Appels suivis en cours : tant qu'il y en a, les déclencheurs notent. */
let actifs = 0
/** Groupe ouvert par l'interface, et le pas qu'il accumule. */
let groupe = 0
let enCours: Pas | null = null

const ident = (n: string): string => `"${n.replace(/"/g, '""')}"`
/** Un identifiant cité à l'intérieur d'une chaîne SQL : les apostrophes doublées. */
const litteral = (s: string): string => s.replace(/'/g, "''")

/** Pose les déclencheurs sur la base qui vient de s'ouvrir. */
export function installer(db: Database.Database): void {
  base = db
  pileDefaire = []
  pileRefaire = []
  actifs = 0
  groupe = 0
  enCours = null

  db.exec(`
    CREATE TEMP TABLE IF NOT EXISTS defaire_journal (n INTEGER PRIMARY KEY, sql TEXT NOT NULL);
    CREATE TEMP TABLE IF NOT EXISTS defaire_etat (actif INTEGER NOT NULL);
    DELETE FROM temp.defaire_journal;
    DELETE FROM temp.defaire_etat;
    INSERT INTO temp.defaire_etat (actif) VALUES (0);
  `)

  const tables = (
    db
      .prepare(
        `SELECT name FROM main.sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`
      )
      .all() as { name: string }[]
  )
    .map((r) => r.name)
    .filter((t) => !TABLES_HORS.has(t))

  const quand = `(SELECT actif FROM temp.defaire_etat) = 1`
  /* Sans « temp. » : SQLite refuse un nom qualifié comme cible d'un INSERT
     dans un déclencheur. Un déclencheur temporaire trouve la table
     temporaire en premier de toute façon. */
  const noter = (expr: string): string => `INSERT INTO defaire_journal (sql) VALUES (${expr});`

  const ordres: string[] = []
  for (const t of tables) {
    const cols = (db.prepare(`PRAGMA main.table_info(${ident(t)})`).all() as { name: string }[]).map(
      (c) => c.name
    )
    if (!cols.length) continue
    const T = litteral(ident(t))
    const nom = (suffixe: string): string => ident(`defaire_${suffixe}_${t}`)

    if (!TABLES_DU_DISQUE.has(t)) {
      /* Une ligne née se défait en l'effaçant. */
      ordres.push(
        `CREATE TEMP TRIGGER IF NOT EXISTS ${nom('ins')} AFTER INSERT ON main.${ident(t)}
         WHEN ${quand} BEGIN ${noter(`'DELETE FROM ${T} WHERE rowid=' || new.rowid`)} END;`
      )
      /* Une ligne effacée se défait en la recréant telle quelle, même rowid. */
      const liste = cols.map((c) => litteral(ident(c))).join(',')
      const valeurs = cols.map((c) => `quote(old.${ident(c)})`).join(` || ',' || `)
      ordres.push(
        `CREATE TEMP TRIGGER IF NOT EXISTS ${nom('del')} AFTER DELETE ON main.${ident(t)}
         WHEN ${quand} BEGIN ${noter(
           `'INSERT INTO ${T} (rowid,${liste}) VALUES (' || old.rowid || ',' || ${valeurs} || ')'`
         )} END;`
      )
    }
    /* Une modification se défait colonne par colonne : on ne rend que ce
       qui a changé, sans écraser ce qu'un autre geste aurait touché depuis. */
    for (const c of cols) {
      const C = litteral(ident(c))
      ordres.push(
        `CREATE TEMP TRIGGER IF NOT EXISTS ${nom(`upd_${c}`)} AFTER UPDATE OF ${ident(c)} ON main.${ident(t)}
         WHEN ${quand} AND old.${ident(c)} IS NOT new.${ident(c)} BEGIN ${noter(
           `'UPDATE ${T} SET ${C}=' || quote(old.${ident(c)}) || ' WHERE rowid=' || old.rowid`
         )} END;`
      )
    }
  }
  db.exec(ordres.join('\n'))
}

/** Le moniteur se tait quand la base se ferme. */
export function oublier(): void {
  base = null
  pileDefaire = []
  pileRefaire = []
  diffuser()
}

const activer = (on: boolean): void => {
  base?.prepare(`UPDATE temp.defaire_etat SET actif = ?`).run(on ? 1 : 0)
}

const recolter = (): string[] => {
  if (!base) return []
  const lignes = base
    .prepare(`SELECT sql FROM temp.defaire_journal ORDER BY n`)
    .all() as { sql: string }[]
  base.prepare(`DELETE FROM temp.defaire_journal`).run()
  return lignes.map((l) => l.sql)
}

const suivi = (canal: string): boolean =>
  canal.split(':')[0] in MODULES && !CANAUX_HORS.has(canal)

function noterPas(libelle: string, sqls: string[]): void {
  const utiles = sqls.filter((q) => !INVERSES_DU_JEU.some((r) => r.test(q)))
  if (!utiles.length) return
  pileRefaire = []
  if (groupe > 0) {
    if (!enCours) enCours = { libelle, sqls: [] }
    enCours.sqls.push(...utiles)
    return
  }
  const maintenant = Date.now()
  const dernier = pileDefaire[pileDefaire.length - 1]
  const memes = cases(utiles)
  if (
    dernier?.quand &&
    maintenant - dernier.quand < RAFALE_MS &&
    memes !== null &&
    memes === cases(dernier.sqls)
  ) {
    dernier.quand = maintenant
    return
  }
  pileDefaire.push({ libelle, sqls: utiles, quand: maintenant })
  if (pileDefaire.length > PROFONDEUR) pileDefaire.shift()
  diffuser()
}

/**
 * Enveloppe un échange IPC : si son canal est suivi, ce qu'il écrit en base
 * devient un pas qu'on pourra défaire.
 */
export function envelopper<R>(canal: string, fn: () => R): R {
  if (!base || !suivi(canal)) return fn()
  const libelle = MODULES[canal.split(':')[0]]
  actifs++
  if (actifs === 1) activer(true)
  const fin = (): void => {
    actifs = Math.max(0, actifs - 1)
    if (actifs === 0) activer(false)
    noterPas(libelle, recolter())
  }
  try {
    const r = fn()
    if (r instanceof Promise) return r.finally(fin) as R
    fin()
    return r
  } catch (e) {
    fin()
    throw e
  }
}

/** Un geste en plusieurs appels : tout ce qui se fait jusqu'à la fermeture compte pour un. */
export function ouvrirGroupe(): void {
  groupe++
}

export function fermerGroupe(): void {
  if (groupe === 0) return
  groupe--
  if (groupe > 0 || !enCours) return
  pileDefaire.push(enCours)
  if (pileDefaire.length > PROFONDEUR) pileDefaire.shift()
  enCours = null
  diffuser()
}

/** Rejoue un pas à l'envers, et rend le pas qui le rejouerait à l'endroit. */
function rejouer(pas: Pas): Pas {
  const db = base!
  recolter()
  activer(true)
  try {
    db.transaction(() => {
      /* Recréer un lieu avant ses pièces, ou l'inverse : l'ordre de la note
         n'est pas forcément celui des clés étrangères. On vérifie à la fin. */
      db.pragma('defer_foreign_keys = ON')
      for (const q of [...pas.sqls].reverse()) db.exec(q)
    })()
  } finally {
    activer(false)
  }
  return { libelle: pas.libelle, sqls: recolter() }
}

function bouger(depuis: Pas[], vers: Pas[]): string | null {
  if (!base || groupe > 0 || actifs > 0) return null
  const pas = depuis.pop()
  if (!pas) return null
  try {
    vers.push(rejouer(pas))
  } catch (e) {
    /* La base a changé sous nos pieds d'une façon que le pas ne prévoyait
       pas : on ne rejoue plus rien de cette mémoire, elle n'est plus sûre. */
    console.error('[défaire]', e)
    pileDefaire = []
    pileRefaire = []
    diffuser()
    throw new Error('Impossible de défaire : la campagne a changé depuis.')
  }
  diffuser()
  return pas.libelle
}

export const defaire = (): string | null => bouger(pileDefaire, pileRefaire)
export const refaire = (): string | null => bouger(pileRefaire, pileDefaire)

export function etat(): EtatDefaire {
  return {
    defaire: pileDefaire[pileDefaire.length - 1]?.libelle ?? null,
    refaire: pileRefaire[pileRefaire.length - 1]?.libelle ?? null
  }
}

/** L'interface allume ou éteint ses boutons « Défaire » selon la pile. */
function diffuser(): void {
  const e = etat()
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send('defaire:etat', e)
  }
}
