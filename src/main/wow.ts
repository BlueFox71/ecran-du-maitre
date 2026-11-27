/**
 * World of Warcraft dans l'Écran du Maître : le jeu (Arbre de talents,
 * Aventure, éditeur de cartes) est servi par l'Écran lui-même — voir
 * `wowServeur.ts` — et le module Azeroth en tient la table.
 *
 * Ce module-ci décide **où sont les données** (Sauvegardes, Images), lance le
 * serveur dessus, lit la table et les fiches enregistrées, et dépose ce que le
 * MJ envoie dans la boîte des joueurs.
 */
import { app, BrowserWindow } from 'electron'
import { spawn } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { toDataURL } from 'qrcode'
import { lirePoste, nomDuMj } from '@shared/reglages'
import type {
  CatalogueObjetWow,
  EffetFicheWow,
  EnvoiWow,
  EtatWow,
  JoueurWow,
  MajFicheWow,
  ObjetFicheWow,
  QuetePreparee,
  ServeurWow
} from '@shared/wow'
import { CARACS_WOW, slugJoueurWow } from '@shared/wow'
import { lireCampagne } from '@shared/reglages'
import * as reglagesCampagne from './db/repos/reglages'
import * as players from './db/repos/players'
import * as chars from './db/repos/characters'
import * as lib from './db/repos/library'
import { absOf } from './library'
import { isDbOpen } from './db'
import { reglagesPoste } from './carnet'
import { currentProject } from './project'
import * as serveur from './wowServeur'
import * as fiches from './wowFiches'
import * as display from './display'

/**
 * Les quêtes préparées de la campagne ouverte : `quetes-wow.json`, dans son
 * dossier. Absent ou illisible : aucune (le MJ peut toujours en écrire une).
 */
export function quetesPreparees(): QuetePreparee[] {
  const p = currentProject()
  if (!p) return []
  try {
    const l = JSON.parse(readFileSync(join(p.dir, 'quetes-wow.json'), 'utf8'))
    return (Array.isArray(l) ? l : l?.quetes ?? []).filter(
      (q: QuetePreparee) => q && typeof q.titre === 'string' && q.titre.trim()
    )
  } catch {
    return []
  }
}

/** Là où les données du jeu vivaient avant l'Écran : on les reprend telles quelles. */
const DOSSIERS_CONNUS = ['D:\\JDR\\WORLD OF WARCRAFT\\classe\\Application']

/** L'identifiant sous lequel l'Écran écrit dans les boîtes. */
const ID_MJ = 'ecran-mj'

/** Un dossier de données a ses Sauvegardes ou ses Images (ou il est neuf). */
export function estDossierDonnees(d: string): boolean {
  return existsSync(join(d, 'Sauvegardes')) || existsSync(join(d, 'Images'))
}

/** Le dossier des données : celui du poste, l'ancien dossier du jeu, ou un dossier neuf dans le profil. */
export function dossier(): string {
  const pose = lirePoste(reglagesPoste()).wowDossier
  if (pose) return pose
  const connu = DOSSIERS_CONNUS.find((d) => estDossierDonnees(d))
  if (connu) return connu
  const neuf = join(app.getPath('userData'), 'World of Warcraft')
  mkdirSync(join(neuf, 'Sauvegardes'), { recursive: true })
  mkdirSync(join(neuf, 'Images'), { recursive: true })
  return neuf
}

export async function etat(): Promise<ServeurWow> {
  const d = dossier()
  const port = serveur.portActuel()
  const ancien = serveur.ancienLanceur()
  return {
    dossier: d,
    probleme: !existsSync(d)
      ? `Le dossier des données « ${d} » est introuvable : choisis-le.`
      : !existsSync(serveur.dossierCode())
        ? 'Le jeu WoW manque dans cette installation de l’Écran.'
        : null,
    lance: port !== null,
    lanceParEcran: true,
    port,
    adresses: serveur.adresses(),
    distance: serveur.adresses(true),
    ancien: ancien !== null
  }
}

/**
 * Un jet de l'Aventure tombe sur l'écran de la table et dans la Régie, comme
 * les dés des téléphones — à la manière de WoW. En combat, les jets
 * s'enchaînent : chacun s'en va seul au bout de quelques secondes.
 */
serveur.onJet((j) => {
  /* L'onglet Aventure du MJ lui-même : ses essais ne vont pas sur l'écran des joueurs. */
  if (j.id === 'mj' || j.id === ID_MJ) return
  if (!isDbOpen()) return
  const characterId = fiches.liensWow()[j.id]
  const joueur =
    (characterId != null ? players.listPlayers().find((p) => p.characterId === characterId) : null) ??
    players.listPlayers().find((p) => slugJoueurWow(p.name) === j.id) ??
    null
  const perso = characterId != null ? chars.getCharacter(characterId)?.name : null
  const de = display.poserDe({
    joueur: joueur?.name ?? j.nom,
    perso: perso || j.nom,
    couleur: joueur?.color ?? null,
    carac: j.titre,
    code: null,
    de: j.de,
    bonus: j.bonus,
    total: j.total,
    faces: j.faces,
    wow: { dd: j.dd, issue: j.issue }
  })
  setTimeout(() => display.retirerDe(de.id), 9000)
})

/** Lance le jeu sur le dossier de données (sans effet s'il tourne déjà). */
export async function demarrer(): Promise<ServeurWow> {
  /* La bourse des fiches WoW parle en pièces d'or, d'argent et de cuivre. */
  fiches.monnaiesDeWow()
  const d = dossier()
  if (existsSync(d)) await serveur.demarrer(d)
  const e = await etat()
  if (!e.lance && !e.probleme)
    e.probleme = `Les ports ${serveur.PORT_DEBUT} à ${serveur.PORT_FIN} sont tous pris : redémarre le PC.`
  if (e.lance) suivreLesFiches()
  return e
}

/* Les fiches de l'Aventure, tenues en miroir dans l'Écran (voir wowFiches.ts). */
let suivi: ReturnType<typeof setInterval> | null = null
let enCours = false
function suivreLesFiches(): void {
  if (suivi) return
  suivi = setInterval(() => {
    if (enCours || !serveur.portActuel()) return
    enCours = true
    table()
      .then((t) => {
        fiches.synchroniser(t)
        pousserPortraits(t)
      })
      .catch((err) => console.error('[wow] fiches :', err))
      .finally(() => (enCours = false))
  }, 4000)
}

/**
 * Le portrait d'un personnage se choisit sur sa fiche de l'Écran, plus dans
 * l'Aventure : l'image est copiée dans Images\portraits\<joueur> (le serveur
 * du jeu la sert de là), puis envoyée à son Aventure.
 *
 * L'adresse part de la racine du serveur (« Application/… ») : la page de
 * l'Aventure a un <base href="../">. On la renvoie tant que l'Aventure (ou sa
 * fiche enregistrée) ne montre pas celle-là — une Aventure rechargée avec
 * l'ancienne en mémoire aurait pu la réécrire par-dessus — sans la renvoyer
 * plus d'une fois toutes les 15 secondes.
 */
const portraitsEnvoyes = new Map<number, { src: string; quand: number }>()
function pousserPortraits(t: JoueurWow[]): void {
  if (!isDbOpen()) return
  const montre = new Map(t.map((j) => [j.id, j.etat?.portrait]))
  for (const [joueur, charId] of Object.entries(fiches.liensWow())) {
    try {
      const ch = chars.getCharacter(charId)
      if (!ch?.portraitItemId) continue
      const item = lib.getItem(ch.portraitItemId)
      if (!item?.relPath) continue
      const ext = (extname(item.relPath) || '.jpg').toLowerCase()
      const src = `Application/Images/portraits/${joueur}${ext}?v=${item.id}-${item.bytes ?? 0}`
      if (montre.get(joueur) === src) continue
      const deja = portraitsEnvoyes.get(charId)
      if (deja && deja.src === src && Date.now() - deja.quand < 15000) continue
      const dest = join(dossier(), 'Images', 'portraits', joueur + ext)
      mkdirSync(dirname(dest), { recursive: true })
      if (!deja || deja.src !== src) copyFileSync(absOf(item.relPath), dest)
      pousserFiche(charId, { portrait: src })
      portraitsEnvoyes.set(charId, { src, quand: Date.now() })
    } catch (err) {
      console.error('[wow] portrait :', err)
    }
  }
}

/** Le MJ a changé une fiche dans l'Écran : elle part dans l'Aventure du joueur. */
export function pousserFiche(characterId: number, maj: MajFicheWow): void {
  const id = fiches.joueurDe(characterId)
  if (!id) return
  fiches.versAventure(characterId, maj, {
    dossier: dossier(),
    enLigne: !!serveur.portActuel() && serveur.presents().some((p) => p.id === id),
    deposer: (joueur, quoi) => serveur.deposer(ID_MJ, nomDuMj(lirePoste(reglagesPoste())), [joueur], quoi)
  })
}

/** Le MJ pose ou retire un effet depuis la fiche : il part dans l'Aventure du joueur. */
export function effetFiche(characterId: number, effet: EffetFicheWow): boolean {
  const id = fiches.joueurDe(characterId)
  if (!id) return false
  return fiches.effetVersAventure(characterId, effet, {
    dossier: dossier(),
    enLigne: !!serveur.portActuel() && serveur.presents().some((p) => p.id === id),
    deposer: (joueur, quoi) => serveur.deposer(ID_MJ, nomDuMj(lirePoste(reglagesPoste())), [joueur], quoi)
  })
}

/* ---------------- le catalogue d'objets du jeu ---------------- */

/** Lu une fois (quelques Mo), à la première recherche. */
let catalogue: Record<string, unknown>[] | null = null
function lireCatalogue(): Record<string, unknown>[] {
  if (catalogue) return catalogue
  try {
    const l = JSON.parse(readFileSync(join(serveur.dossierCode(), 'Donnees', 'catalogue-objets.json'), 'utf8'))
    catalogue = Array.isArray(l) ? l.filter((o) => o && typeof o.nom === 'string') : []
  } catch {
    catalogue = []
  }
  return catalogue
}

const sansAccent = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

/** Les objets du catalogue dont le nom contient la recherche : les plus courts (les plus proches) d'abord. */
export function chercherObjets(texte: string): CatalogueObjetWow[] {
  const q = sansAccent(texte.trim())
  if (q.length < 2) return []
  return lireCatalogue()
    .filter((o) => sansAccent(String(o.nom)).includes(q))
    .sort((a, b) => String(a.nom).length - String(b.nom).length)
    .slice(0, 40)
    .map((o) => ({
      id: Number(o.id),
      nom: String(o.nom),
      qualite: Number(o.qualite) || 0,
      niveau: Number(o.niveau) || Math.min(60, Number(o.ilvl) || 0),
      type: String(o.type ?? '')
    }))
}

/** Le MJ donne ou reprend un objet depuis la fiche : il part dans l'Aventure du joueur. */
export function objetFiche(characterId: number, envoi: ObjetFicheWow): 'recu' | 'en-attente' | 'echec' {
  const id = fiches.joueurDe(characterId)
  if (!id) return 'echec'
  let quoi: { t: 'objet'; o: Record<string, unknown>; n: number } | { t: 'retireObjet'; nom: string; n: number }
  if (envoi.t === 'objet') {
    const o = lireCatalogue().find((x) => Number(x.id) === envoi.id)
    if (!o) return 'echec'
    quoi = { t: 'objet', o, n: Math.max(1, envoi.n | 0) }
  } else quoi = { t: 'retireObjet', nom: envoi.nom, n: Math.max(1, envoi.n | 0) }
  return fiches.objetVersAventure(characterId, quoi, {
    dossier: dossier(),
    enLigne: !!serveur.portActuel() && serveur.presents().some((p) => p.id === id),
    deposer: (joueur, q) => serveur.deposer(ID_MJ, nomDuMj(lirePoste(reglagesPoste())), [joueur], q)
  })
}

/**
 * Les mots du MJ (Écran → téléphones), dans une campagne WoW : ils arrivent
 * aussi dans l'Aventure du joueur, puisque c'est elle qu'il a sous les yeux.
 */
export function motsVersAventure(lignes: { playerId: number; texte: string }[]): void {
  if (!isDbOpen() || lireCampagne(reglagesCampagne.tous()).regles !== 'wow') return
  for (const { playerId, texte } of lignes) {
    const p = players.getPlayer(playerId)
    if (!p) continue
    const id = (p.characterId != null ? fiches.joueurDe(p.characterId) : null) ?? slugJoueurWow(p.name)
    if (!id) continue
    fiches.courrierVersAventure(id, { t: 'message', texte }, {
      dossier: dossier(),
      enLigne: !!serveur.portActuel() && serveur.presents().some((x) => x.id === id),
      deposer: (joueur, q) => serveur.deposer(ID_MJ, nomDuMj(lirePoste(reglagesPoste())), [joueur], q)
    })
  }
}

export function arreter(): void {
  if (suivi) clearInterval(suivi)
  suivi = null
  serveur.arreter()
}

/** L'adresse d'une page du jeu sur ce PC (celle que montre l'Écran). */
export async function adresseLocale(page: string, joueur?: string): Promise<string | null> {
  if (!serveur.portActuel()) await demarrer()
  const port = serveur.portActuel()
  if (!port) return null
  const q = joueur ? `?joueur=${encodeURIComponent(joueur)}` : ''
  return `http://127.0.0.1:${port}/Application/${page}${q}`
}

/** Le résumé d'une fiche enregistrée : ce qu'on en sait sans l'Aventure ouverte. */
export function lireFiche(chemin: string): { classe: string; etat: Partial<EtatWow>; quand: string } | null {
  try {
    const j = JSON.parse(readFileSync(chemin, 'utf8'))
    const p = j?.progress ?? {}
    const perso = p.perso ?? {}
    const apercu = j?.apercu && typeof j.apercu === 'object' ? j.apercu : null
    const bonus: Record<string, number> = apercu?.carBonus ?? {}
    /* Les caractéristiques : les points de la fiche, plus les bonus que l'Aventure a notés en l'enregistrant. */
    const car = perso.car && typeof perso.car === 'object'
      ? Object.fromEntries(
          CARACS_WOW.filter(([k]) => perso.car[k]).map(([k]) => [
            k,
            (parseInt(perso.car[k].pt) || 0) + (Number(bonus[k]) || 0)
          ])
        )
      : undefined
    const objets = (Array.isArray(perso.contenu) ? perso.contenu : []).flat().filter(
      (o: { nom?: unknown } | null) => o && typeof o.nom === 'string'
    ) as { nom: string; qualite?: number; qte?: number }[]
    return {
      classe: String(j.classe ?? ''),
      quand: typeof j.savedAt === 'string' ? j.savedAt : statSync(chemin).mtime.toISOString(),
      etat: {
        car,
        equip: Object.entries(perso.equip ?? {})
          .filter(([, o]) => o && typeof (o as { nom?: unknown }).nom === 'string')
          .map(([c, o]) => ({ c, nom: (o as { nom: string }).nom, q: Number((o as { qualite?: number }).qualite) || 0 })),
        sacs: objets.map((o) => ({ nom: o.nom, q: Number(o.qualite) || 0, qte: Math.max(1, parseInt(String(o.qte)) || 1) })),
        talents: Array.isArray(apercu?.talents) ? apercu.talents : undefined,
        sorts: Array.isArray(apercu?.sorts) ? apercu.sorts : undefined,
        nomPerso: [perso.prenom, perso.nom].filter(Boolean).join(' ').trim(),
        prenom: perso.prenom ?? '',
        race: perso.race ?? '',
        sexe: typeof perso.sexe === 'string' ? perso.sexe : undefined,
        age: perso.age != null ? String(perso.age) : undefined,
        histoire: typeof perso.histoire === 'string' ? perso.histoire : undefined,
        portrait: typeof perso.portrait === 'string' ? perso.portrait : undefined,
        classe: String(j.classe ?? ''),
        niveau: Number(p.level) || 1,
        pv: Number(perso.pv?.cur) || 0,
        res: Number(perso.res?.cur) || 0,
        resMax: Number(perso.res?.max) || 0,
        argent: perso.argent,
        auras: Array.isArray(perso.auras)
          ? perso.auras
              .filter((a: { nom?: unknown }) => a && typeof a.nom === 'string')
              .map((a: { nom: string; mal?: boolean; tours?: number; pile?: number; lbl?: string }) => ({
                nom: a.nom,
                mal: !!a.mal,
                tours: Number(a.tours) || 0,
                pile: Number(a.pile) || 0,
                lbl: a.lbl ?? ''
              }))
          : []
      }
    }
  } catch {
    return null
  }
}

/** Toute la table : les joueurs en ligne, puis ceux dont la fiche dort sur le disque. */
export async function table(): Promise<JoueurWow[]> {
  const out = new Map<string, JoueurWow>()
  const dir = join(dossier(), 'Sauvegardes', 'Joueurs')
  let fichiers: string[] = []
  try {
    /* Seulement les fiches de joueurs : un identifiant de l'Aventure n'a ni point ni espace
       (une copie « jules.avant-… .json » posée à côté n'est pas un joueur de plus). */
    fichiers = readdirSync(dir).filter((f) => /^[a-z0-9-]+\.json$/i.test(f))
  } catch {
    /* pas encore de joueur */
  }
  for (const f of fichiers) {
    const id = f.slice(0, -5)
    const fiche = lireFiche(join(dir, f))
    if (!fiche) continue
    out.set(id, {
      id,
      nom: fiche.etat.nomPerso || id.charAt(0).toUpperCase() + id.slice(1),
      enLigne: false,
      classe: fiche.classe,
      etat: fiche.etat,
      enregistreLe: fiche.quand
    })
  }
  for (const p of serveur.presents()) {
    /* L'onglet du MJ (sans joueur) n'est pas un joueur de la table. */
    if (p.id === 'mj' || p.id === ID_MJ) continue
    const avant = out.get(p.id)
    out.set(p.id, {
      id: p.id,
      nom: p.nom || avant?.nom || p.id,
      enLigne: true,
      classe: p.classe || avant?.classe || '',
      etat: (p.etat as EtatWow | null) ?? avant?.etat ?? null,
      enregistreLe: avant?.enregistreLe ?? null
    })
  }
  return [...out.values()].sort(
    (a, b) => Number(b.enLigne) - Number(a.enLigne) || a.nom.localeCompare(b.nom, 'fr')
  )
}

/** Dépose un envoi du MJ dans la boîte des joueurs nommés. */
export async function envoyer(ids: string[], quoi: EnvoiWow): Promise<boolean> {
  if (!serveur.portActuel() || !ids.length) return false
  serveur.deposer(ID_MJ, nomDuMj(lirePoste(reglagesPoste())), ids, quoi)
  return true
}

/** Le QR code d'une adresse, pour qu'un joueur l'ouvre sans la taper. */
export function qr(url: string): Promise<string> {
  return toDataURL(url, { margin: 1, width: 360, color: { dark: '#111111', light: '#ffffff' } })
}

/** La fiche d'un joueur dans une fenêtre de l'Écran (pour la regarder, l'aider). */
export async function fenetreJoueur(joueur: string): Promise<boolean> {
  const url = await adresseLocale('Arbre-de-talents.html', joueur)
  if (!url) return false
  const w = new BrowserWindow({
    width: 1400,
    height: 860,
    title: `Aventure — ${joueur}`,
    autoHideMenuBar: true,
    backgroundColor: '#000000',
    webPreferences: { contextIsolation: true, sandbox: true }
  })
  await w.loadURL(url)
  return true
}

/* ---------------- le simulateur (le site des joueurs) ---------------- */

function lancer(cmd: string, args: string[], cwd: string, env?: NodeJS.ProcessEnv): Promise<{ code: number; texte: string }> {
  return new Promise((ok) => {
    let texte = ''
    const p = spawn(cmd, args, { cwd, env: env ?? process.env, windowsHide: true })
    p.stdout?.on('data', (b: Buffer) => (texte += b.toString('utf8')))
    p.stderr?.on('data', (b: Buffer) => (texte += b.toString('utf8')))
    p.on('error', (e) => ok({ code: -1, texte: texte + e.message }))
    p.on('close', (code) => ok({ code: code ?? -1, texte }))
  })
}

/**
 * Refabrique le simulateur avec les arbres, les sorts et la création tels
 * qu'ils sont maintenant, puis le publie (git) si on le demande. Le dossier de
 * sortie est vidé avant d'être rempli : on ne l'accepte que s'il est bien le
 * dépôt du simulateur (il a son `.git`).
 */
export async function simulateur(publier: boolean): Promise<{ ok: boolean; texte: string }> {
  const donnees = dossier()
  const sortie = join(donnees, '..', '..', 'Simulateur')
  if (!existsSync(join(sortie, '.git')))
    return { ok: false, texte: `Le dépôt du simulateur est introuvable : ${sortie} (il lui faut son .git).` }
  const script = app.isPackaged
    ? join(process.resourcesPath, 'wow', 'construire-simulateur.js')
    : join(app.getAppPath(), 'resources', 'wow', 'construire-simulateur.js')
  const r = await lancer(process.execPath, [script], dirname(script), {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    WOW_DONNEES: donnees,
    WOW_SORTIE: sortie
  })
  if (r.code !== 0) return { ok: false, texte: r.texte.trim() || 'Le simulateur n’a pas pu être fabriqué.' }
  if (!publier) return { ok: true, texte: r.texte.trim() }
  await lancer('git', ['add', '-A'], sortie)
  const c = await lancer('git', ['commit', '-q', '-m', 'Mise a jour du simulateur'], sortie)
  if (c.code !== 0) return { ok: true, texte: `${r.texte.trim()}\nRien de nouveau à publier.` }
  const p = await lancer('git', ['push', '-q'], sortie)
  return p.code === 0
    ? { ok: true, texte: `${r.texte.trim()}\nSimulateur publié : il sera en ligne dans une minute ou deux.` }
    : { ok: false, texte: `Fabriqué, mais l’envoi en ligne a échoué :\n${p.texte.trim()}` }
}
