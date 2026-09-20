/**
 * Un projet, c'est un dossier de campagne.
 *
 * Dedans, l'application range sa base dans `.ecran-du-maitre/projet.db` ; tout
 * le reste du dossier est la bibliothèque, des fichiers ordinaires que le MJ
 * peut déplacer, sauvegarder ou ouvrir sans nous. Le point devant le nom suffit
 * à tenir ce dossier hors du balayage (voir `isHidden` dans library.ts).
 *
 * Ouvrir un projet, c'est fermer la base courante et en ouvrir une autre. Rien
 * d'autre dans le processus principal ne doit appeler openDbAt().
 */
import Database from 'better-sqlite3'
import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs'
import { basename, join } from 'node:path'
import { BrowserWindow, app, dialog } from 'electron'
import { activeCampaignId, closeDb, dataRoot, getDb, isDbOpen, openDbAt } from './db'
import * as carnet from './carnet'
import * as mobile from './mobile'
import * as display from './display'
import * as fsLib from './library'
import * as examen from './examen'
import { listPlayers } from './db/repos/players'
import * as reglages from './db/repos/reglages'
import { lireCampagne } from '@shared/reglages'
import type { ProjectInfo } from '@shared/types'

const MARQUE = '.ecran-du-maitre'
const FICHIER = 'projet.db'

let courant: string | null = null

export function projectDbFile(dir: string): string {
  return join(dir, MARQUE, FICHIER)
}

/** Un dossier déjà tenu par l'application. */
export function isProjectDir(dir: string): boolean {
  return existsSync(projectDbFile(dir))
}

/**
 * Le dossier technique de l'application, et tout ce qu'il contient, ne peuvent
 * pas devenir une campagne. Sans cette garde, désigner `.ecran-du-maitre` dans
 * le sélecteur de dossiers y installait une campagne vide, imbriquée dans la
 * vraie — et l'application s'ouvrait dessus, l'air de tout avoir perdu.
 */
function dansLaMarque(dir: string): boolean {
  const parts = dir.split(/[\\/]/)
  return parts.includes(MARQUE)
}

export function currentDir(): string | null {
  return courant
}

export function currentProject(): ProjectInfo | null {
  if (!courant || !isDbOpen()) return null
  const camp = getDb()
    .prepare(`SELECT id, name, system FROM campaign WHERE id = ?`)
    .get(activeCampaignId()) as { id: number; name: string; system: string | null }
  return { dir: courant, campaign: camp }
}

/**
 * Ouvre — ou crée — le projet d'un dossier. Un dossier qui n'en contient pas
 * encore en reçoit un, nommé comme lui : c'est ce qui fait qu'« ouvrir » et
 * « nouveau » sont le même geste, à la seule différence du dossier choisi.
 */
export function openProject(dir: string): ProjectInfo {
  if (!existsSync(dir)) throw new Error(`Le dossier « ${dir} » est introuvable.`)
  if (dansLaMarque(dir))
    throw new Error('Ce dossier appartient à l’application : il ne peut pas être une campagne.')

  /* Le graveur travaille sur la base ouverte : changer de projet sous lui
     ferait ranger les mesures d'un dossier dans la campagne d'un autre. */
  examen.arreter()
  fsLib.stopWatch()
  openDbAt(projectDbFile(dir), basename(dir))
  courant = dir

  /* Le dossier fait foi, y compris s'il a été déplacé ou renommé depuis la
     dernière ouverture : la base apprend où elle se trouve, pas l'inverse. */
  fsLib.setCampaignRoot(dir)

  const info = currentProject()!
  carnet.remember(dir, info.campaign.name)
  carnet.setLastProject(dir)
  /* Les joueurs de la campagne rejoignent le carnet s'il ne les connaît pas :
     une base d'avant les projets arrive ainsi avec ses gens déjà inscrits. */
  carnet.absorb(listPlayers().map((p) => ({ uid: p.uid, name: p.name, color: p.color })))

  /* L'écran de sortie appartient à la campagne : on le repose tout de suite,
     sinon la première image partirait sur le moniteur du MJ le temps qu'il
     ouvre les paramètres pour redire ce qu'il avait déjà dit. */
  display.setOutput(lireCampagne(reglages.tous()).sortieEcran)

  fsLib.scan()
  fsLib.startWatch()
  /* Si cette campagne avait ouvert l'accès aux portables, il se rallume : ses
     téléphones sont toujours appairés et n'ont rien à refaire. */
  void mobile.restore()
  console.log(`[projet] ouvert : ${dir}`)
  return info
}

/**
 * Bascule vers un autre projet, puis recharge les interfaces : plutôt que de
 * rafraîchir vingt morceaux d'état dans le bon ordre, on repart d'une page
 * neuve sur la nouvelle base.
 */
export function switchTo(dir: string): ProjectInfo {
  const info = openProject(dir)
  display.refreshJoueurs()
  for (const w of BrowserWindow.getAllWindows()) w.webContents.reload()
  return info
}

function fenetre(): BrowserWindow | undefined {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
}

/** Dit non, et pourquoi. `null` veut dire que le dossier convient. */
function refusDeCreer(dir: string): string | null {
  if (dansLaMarque(dir))
    return 'Ce dossier appartient à l’application. Choisis le dossier de la campagne lui-même, ou un dossier neuf.'
  return null
}

function refusDOuvrir(dir: string): string | null {
  const dit = refusDeCreer(dir)
  if (dit) return dit
  /* « Ouvrir » n'invente rien : sans campagne dans le dossier, on renvoie vers
     « Nouvelle campagne » plutôt que d'en installer une là où l'on croyait
     seulement regarder. */
  if (!isProjectDir(dir))
    return `« ${basename(dir)} » ne contient aucune campagne. Pour en créer une ici, passe par « Nouvelle campagne… ».`
  return null
}

async function dire(message: string): Promise<void> {
  await dialog.showMessageBox(fenetre()!, {
    type: 'info',
    title: 'Écran du Maître',
    message,
    buttons: ['Compris']
  })
}

/** Créer : le dossier choisi devient la campagne, vide ou déjà rempli. */
export async function promptNew(): Promise<ProjectInfo | null> {
  const res = await dialog.showOpenDialog(fenetre()!, {
    title: 'Où poser cette campagne ?',
    defaultPath: defaultParentDir(),
    properties: ['openDirectory', 'createDirectory'],
    buttonLabel: 'Créer la campagne ici'
  })
  if (res.canceled || !res.filePaths[0]) return null

  const dir = res.filePaths[0]
  const refus = refusDeCreer(dir)
  if (refus) {
    await dire(refus)
    return null
  }
  return switchTo(dir)
}

/** Ouvrir : seulement un dossier qui contient déjà une campagne. */
export async function promptOpen(): Promise<ProjectInfo | null> {
  const res = await dialog.showOpenDialog(fenetre()!, {
    title: 'Ouvrir une campagne',
    defaultPath: courant ?? defaultParentDir(),
    properties: ['openDirectory'],
    buttonLabel: 'Ouvrir cette campagne'
  })
  if (res.canceled || !res.filePaths[0]) return null

  const dir = res.filePaths[0]
  const refus = refusDOuvrir(dir)
  if (refus) {
    await dire(refus)
    return null
  }
  return switchTo(dir)
}

/** Le nom et le système de la campagne — l'identité du projet. */
export function updateCampaign(patch: { name?: string; system?: string | null }): ProjectInfo | null {
  const info = currentProject()
  if (!info) return null
  const nom = patch.name !== undefined ? patch.name.trim() || info.campaign.name : info.campaign.name
  const systeme = patch.system !== undefined ? patch.system : info.campaign.system
  getDb()
    .prepare(`UPDATE campaign SET name = ?, system = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(nom, systeme, info.campaign.id)
  if (courant) carnet.remember(courant, nom)
  return currentProject()
}

export function closeProject(): void {
  examen.arreter()
  fsLib.stopWatch()
  /* Les jetons des téléphones appartiennent à la base du projet : en fermer
     un doit couper les appareils, sinon ils parleraient à la campagne
     suivante avec les identifiants de la précédente. */
  mobile.stop()
  closeDb()
  courant = null
  carnet.setLastProject(null)
}

/** Le dossier proposé d'office quand on crée un projet. */
export function defaultParentDir(): string {
  const docs = join(app.getPath('documents'), 'Écran du Maître')
  mkdirSync(docs, { recursive: true })
  return docs
}

/* ============================================================
   Reprise de l'ancienne base unique
   ============================================================ */

/**
 * Avant les projets, tout vivait dans une seule base sous les données de
 * l'application. On la déménage une fois, dans le dossier que la campagne
 * désignait déjà — et à défaut, dans un dossier créé pour elle : mieux vaut
 * une campagne rangée ailleurs que prévu qu'une campagne perdue.
 *
 * Renvoie le dossier du projet repris, ou null s'il n'y avait rien à reprendre.
 */
export function migrateLegacy(): string | null {
  const ancienne = join(dataRoot(), 'campagnes.db')
  if (!existsSync(ancienne)) return null

  let racine: string | null = null
  let nom = 'Ma campagne'
  try {
    const vieille = new Database(ancienne)
    vieille.pragma('wal_checkpoint(TRUNCATE)')
    /* La campagne active d'abord ; à défaut, la première venue. */
    const row = vieille
      .prepare(`SELECT name, root_path FROM campaign ORDER BY active DESC, id LIMIT 1`)
      .get() as { name: string; root_path: string | null } | undefined
    if (row) {
      nom = row.name
      racine = row.root_path
    }
    vieille.close()
  } catch (e) {
    console.error('[projet] ancienne base illisible :', e)
    return null
  }

  const dossier = racine && existsSync(racine) ? racine : join(defaultParentDir(), safe(nom))
  mkdirSync(join(dossier, MARQUE), { recursive: true })

  const cible = projectDbFile(dossier)
  if (existsSync(cible)) {
    /* Déjà repris lors d'un lancement précédent : on ne réécrit rien. */
    renameSync(ancienne, ancienne + '.repris')
    return dossier
  }

  copyFileSync(ancienne, cible)
  /* L'ancienne base est gardée sous un autre nom : si la reprise déçoit, tout
     est encore là. On écarte seulement ses fichiers de journal, devenus vides
     après le point de contrôle et sans objet à côté d'un fichier renommé. */
  renameSync(ancienne, ancienne + '.repris')
  for (const suffixe of ['-wal', '-shm']) rmSync(ancienne + suffixe, { force: true })
  console.log(`[projet] ancienne campagne « ${nom} » reprise dans ${dossier}`)
  return dossier
}

function safe(nom: string): string {
  return nom.replace(new RegExp('[<>:"/\\\\|?*]', 'g'), '').trim() || 'Ma campagne'
}

/** Un dossier de projet est-il vide de tout sauf de notre marque ? */
export function looksEmpty(dir: string): boolean {
  try {
    return readdirSync(dir).filter((n) => n !== MARQUE).length === 0
  } catch {
    return true
  }
}
