import { BrowserWindow, Menu, app, globalShortcut, shell } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { closeDb, dataRoot } from './db'
import { cheminIcone } from './icone'
import { registerIpc } from './ipc'
import * as display from './display'
import * as mobile from './mobile'
import * as carnet from './carnet'
import * as projet from './project'
import { registerMediaProtocol, registerProtocolScheme } from './vault'
import * as examen from './examen'
import { announce, auScan, stopWatch } from './library'
import { lirePoste } from '@shared/reglages'

// Doit être appelé avant que l'application soit prête.
registerProtocolScheme()

let mainWindow: BrowserWindow | null = null

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1080,
    minHeight: 680,
    show: false,
    backgroundColor: '#0f1518',
    title: 'Écran du Maître',
    icon: cheminIcone(),
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      spellcheck: true,
      /* Le lecteur de PDF de Chromium est un greffon : sans cela, la fiche de
         compétences d'un personnage ne s'affiche pas dans l'application. */
      plugins: true
    }
  })

  /* Au démarrage, la fenêtre occupe tout l'écran sans passer en plein écran
     exclusif : la barre de titre et la barre des tâches restent accessibles.
     Les dimensions ci-dessus servent alors de taille restaurée. */
  mainWindow.on('ready-to-show', () => {
    mainWindow?.maximize()
    mainWindow?.show()
  })

  // En développement, les erreurs de l'interface remontent dans la console du terminal.
  if (!app.isPackaged) {
    mainWindow.webContents.on('console-message', (_e, level, message, line, source) => {
      if (level >= 2) console.error(`[interface] ${message}  (${source}:${line})`)
    })
    mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
      console.error(`[interface] chargement échoué ${code} ${desc} — ${url}`)
    })
  }

  // Les liens externes s'ouvrent dans le navigateur, jamais dans l'application.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  /* Le graveur de vignettes est une fenêtre, cachée mais bien réelle : s'il
     restait ouvert, Electron ne verrait jamais la dernière fenêtre se fermer
     et l'application ne quitterait pas. */
  mainWindow.on('close', () => examen.arreter())

  display.bindMjWindow(mainWindow)
  mobile.bindMjWindow(mainWindow)
  display.onBroadcast(() => mobile.broadcast())

}

/**
 * Au démarrage, on rouvre la campagne quittée la dernière fois : c'est le cas
 * courant, on reprend là où on s'est arrêté. L'accueil n'apparaît qu'à la
 * toute première ouverture, ou si le dossier n'est plus là.
 *
 * Au tout premier lancement de cette version, l'ancienne base unique est
 * reprise en projet (voir project.migrateLegacy) : rien à faire pour le MJ.
 */
function ouvrirDernierProjet(): void {
  /* On peut préférer l'accueil : quelqu'un qui mène trois campagnes choisit
     la sienne en arrivant plutôt que de refermer celle d'hier. */
  if (!lirePoste(carnet.reglagesPoste()).rouvrir) return

  let dir = carnet.lastProject()

  if (!dir) {
    try {
      dir = projet.migrateLegacy()
    } catch (e) {
      console.error('[projet] reprise de l’ancienne base :', e)
    }
  }

  if (!dir || !existsSync(dir)) {
    if (dir) console.log(`[projet] dossier introuvable, accueil : ${dir}`)
    return
  }

  try {
    projet.openProject(dir)
    /* L'écran doit connaître les joueurs avant qu'on lui demande de les montrer. */
    display.refreshJoueurs()
  } catch (e) {
    console.error(`[projet] ouverture de ${dir} :`, e)
  }
}

function buildMenu(): void {
  const menu = Menu.buildFromTemplate([
    {
      label: 'Fichier',
      submenu: [
        {
          label: 'Nouvelle campagne…',
          accelerator: 'CommandOrControl+N',
          click: () => void projet.promptNew()
        },
        {
          label: 'Ouvrir une campagne…',
          accelerator: 'CommandOrControl+O',
          click: () => void projet.promptOpen()
        },
        { type: 'separator' },
        {
          label: 'Ouvrir le dossier de données',
          click: () => shell.openPath(dataRoot())
        },
        { type: 'separator' },
        { role: 'quit', label: 'Quitter' }
      ]
    },
    {
      label: 'Écran joueurs',
      submenu: [
        {
          label: "Ouvrir / fermer l'écran joueurs",
          accelerator: 'F5',
          click: () => display.togglePlayer()
        },
        { label: 'Voile noir', accelerator: 'CommandOrControl+B', click: () => display.blackout() }
      ]
    },
    {
      label: 'Affichage',
      submenu: [
        { role: 'reload', label: 'Recharger' },
        { role: 'toggleDevTools', label: 'Outils de développement' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Zoom normal' },
        { role: 'zoomIn', label: 'Agrandir' },
        { role: 'zoomOut', label: 'Réduire' }
      ]
    }
  ])
  Menu.setApplicationMenu(menu)
}

// Une seule instance : deux processus sur la même base SQLite finiraient mal.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    /* Sans cela, Windows regroupe les fenêtres sous l'identité d'Electron :
       la barre des tâches afficherait son icône, pas la nôtre. */
    app.setAppUserModelId('fr.julescannet.ecrandumaitre')
    registerMediaProtocol()
    registerIpc()

    /* La bibliothèque et l'examen des médias se préviennent l'un l'autre sans
       se connaître : le dossier relu réveille le graveur, le graveur qui a du
       neuf fait rafraîchir les interfaces. */
    auScan(examen.planifier)
    examen.auxNouvelles(announce)

    ouvrirDernierProjet()
    buildMenu()
    createMainWindow()
    display.watchScreens()

    // Raccourcis utilisables même quand le focus est ailleurs — en pleine partie, ça compte.
    globalShortcut.register('CommandOrControl+Alt+B', () => display.blackout())

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('will-quit', () => {
    /* Le serveur des portables se referme avec l'application : un port resté
       ouvert après coup empêcherait la prochaine ouverture. */
    mobile.stop()
    globalShortcut.unregisterAll()
    examen.arreter()
    stopWatch()
    closeDb()
    carnet.closeCarnet()
  })
}
