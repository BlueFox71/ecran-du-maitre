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
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { toDataURL } from 'qrcode'
import { lirePoste, nomDuMj } from '@shared/reglages'
import type { EnvoiWow, EtatWow, JoueurWow, QuetePreparee, ServeurWow } from '@shared/wow'
import { reglagesPoste } from './carnet'
import { currentProject } from './project'
import * as serveur from './wowServeur'
import * as fiches from './wowFiches'

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

/** Lance le jeu sur le dossier de données (sans effet s'il tourne déjà). */
export async function demarrer(): Promise<ServeurWow> {
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
      .then((t) => fiches.synchroniser(t))
      .catch((err) => console.error('[wow] fiches :', err))
      .finally(() => (enCours = false))
  }, 4000)
}

/** Le MJ a changé une fiche dans l'Écran : elle part dans l'Aventure du joueur. */
export function pousserFiche(
  characterId: number,
  maj: { pv?: number; res?: number; car?: Record<string, number>; ecarts?: Record<string, number> }
): void {
  const id = fiches.joueurDe(characterId)
  if (!id) return
  fiches.versAventure(characterId, maj, {
    dossier: dossier(),
    enLigne: !!serveur.portActuel() && serveur.presents().some((p) => p.id === id),
    deposer: (joueur, quoi) => serveur.deposer(ID_MJ, nomDuMj(lirePoste(reglagesPoste())), [joueur], quoi)
  })
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
function lireFiche(chemin: string): { classe: string; etat: Partial<EtatWow>; quand: string } | null {
  try {
    const j = JSON.parse(readFileSync(chemin, 'utf8'))
    const p = j?.progress ?? {}
    const perso = p.perso ?? {}
    return {
      classe: String(j.classe ?? ''),
      quand: typeof j.savedAt === 'string' ? j.savedAt : statSync(chemin).mtime.toISOString(),
      etat: {
        nomPerso: [perso.prenom, perso.nom].filter(Boolean).join(' ').trim(),
        prenom: perso.prenom ?? '',
        race: perso.race ?? '',
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
    fichiers = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.json'))
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
