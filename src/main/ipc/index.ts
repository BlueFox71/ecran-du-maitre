import { BrowserWindow, app, dialog, ipcMain, shell } from 'electron'
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { activeCampaignId, activeSessionId, dataRoot, getDb, isDbOpen } from '../db'
import * as lib from '../db/repos/library'
import * as places from '../db/repos/places'
import * as echelle from '../db/repos/echelle'
import * as ouvertures from '../db/repos/ouvertures'
import * as lumieres from '../db/repos/lumieres'
import * as timeline from '../db/repos/timeline'
import * as trame from '../db/repos/trame'
import { synchroniserArborescencesBientot } from '../arborescenceTexte'
import * as fiche from '../db/repos/ficheLieu'
import * as chars from '../db/repos/characters'
import * as players from '../db/repos/players'
import * as carnet from '../carnet'
import * as mobile from '../mobile'
import * as projet from '../project'
import * as annexes from '../db/repos/annexes'
import * as smEvenements from '../db/repos/smEvenements'
import * as pochette from '../db/repos/pochette'
import * as mots from '../db/repos/mots'
import * as annotations from '../db/repos/annotations'
import * as surlignage from '../db/repos/surlignage'
import * as objets from '../db/repos/objets'
import * as murs from '../db/repos/murs'
import * as reglages from '../db/repos/reglages'
import * as rolls from '../db/repos/rolls'
import * as pions from '../db/repos/pions'
import * as display from '../display'
import * as tours from '../tours'
import * as prepa from '../preparation'
import * as regieSon from '../sons'
import * as sons from '../db/repos/sons'
import * as defaire from '../defaire'
import * as fsLib from '../library'
import * as examen from '../examen'
import * as lieuxTexte from '../lieuxTexte'
import { synchroniserPnjBientot } from '../pnjTexte'
import { mediaUrl, profilDir, vignetteUrl } from '../vault'
import { IMPORTABLE, IMAGE_EXT, VIDEO_EXT, AUDIO_EXT } from '../kinds'
import { lireCampagne, type Brut } from '@shared/reglages'
import { monnaiesActives } from '@shared/monnaies'
import { apresLeCombat, apresUnTour, type Modif } from '@shared/modifs'
import { noterJet } from '../jetDuPerso'
import { reinitialiser } from '../reinitialiser'
import type { ChoixReinit } from '@shared/types'
import type { Cible, Plage } from '@shared/surlignage'

/** Des bonus ont vieilli tout seuls : la fiche du MJ et les téléphones relisent. */
function modifsVieillis(): void {
  display.versMj('characters:relus', null)
  mobile.broadcast()
}
import type {
  Astre,
  CollageLayout,
  ExamenFait,
  Frame,
  Item,
  ItemFilter,
  MotSecret,
  ProjectInfo,
  SlidePayload,
  PointMur,
  TextOverlay,
  Transition
} from '@shared/types'

/**
 * Ajoute à chaque élément renvoyé les deux URL servies par le protocole jdr:// :
 * le fichier lui-même, et sa vignette quand l'examen en a gravé une. Un élément
 * sans vignette rend `poster: null` — c'est à l'interface de retomber sur
 * l'image entière, ou sur rien.
 */
function withUrl<T extends { relPath: string | null }>(
  o: T
): T & { url: string | null; poster: string | null } {
  const id = (o as { id?: number }).id
  const thumbAt = (o as { thumbAt?: string | null }).thumbAt ?? null
  return {
    ...o,
    url: mediaUrl(o.relPath),
    poster: id != null ? vignetteUrl(id, thumbAt) : null
  }
}
function withUrls(items: Item[]): (Item & { url: string | null; poster: string | null })[] {
  return items.map(withUrl)
}

export function registerIpc(): void {
  const on = <A extends unknown[], R>(channel: string, fn: (...args: A) => R): void => {
    /* Ce qu'un échange de préparation écrit en base devient un pas de Ctrl+Z. */
    ipcMain.handle(channel, (_e, ...args) => {
      const r = defaire.envelopper(channel, () => fn(...(args as A)))
      /* Un lieu retouché (ou défait) : son fichier texte suit. */
      /* Les murs aussi : une coupe fait naître un lieu (voir recalerPieces). */
      if (/^(places|defaire|timeline|fiche|murs):/.test(channel)) lieuxTexte.synchroniserBientot()
      /* Un PNJ retouché, ou la fiche de campagne : son fichier suit. */
      if (/^(characters|templates|sheet|defaire|project):/.test(channel)) synchroniserPnjBientot()
      /* L'arborescence aussi, qui nomme lieux, moments et PNJ dans son fichier. */
      if (/^(trame|places|defaire|timeline|characters):/.test(channel)) synchroniserArborescencesBientot()
      return r
    })
  }

  /** Les étages dont les pièces attendent la fin d'un geste pour se recaler. */
  const piecesEnAttente = new Set<number>()

  /* ---------------- défaire, refaire ---------------- */

  /* Après un pas rejoué, l'écran des joueurs relit ce qui a pu bouger sous
     lui : les murs d'un lieu, les fiches des joueurs. */
  const apresPas = (libelle: string | null): string | null => {
    if (libelle) {
      display.refreshJoueurs()
      display.calqueABouge()
      /* Une apparence rendue ou reprise : la carte à l'écran la suit. */
      display.rehabiller()
    }
    return libelle
  }
  on('defaire:defaire', () => apresPas(defaire.defaire()))
  on('defaire:refaire', () => apresPas(defaire.refaire()))
  on('defaire:etat', () => defaire.etat())
  on('defaire:ouvrirGroupe', () => defaire.ouvrirGroupe())
  on('defaire:fermerGroupe', () => {
    /* Les pièces attendaient la fin du geste : on les recale avant de le
       fermer, et sous un canal suivi, pour que le recalage en fasse partie. */
    const enAttente = [...piecesEnAttente]
    piecesEnAttente.clear()
    for (const id of enAttente) defaire.envelopper('murs:recaler', () => piecesSuivent(id))
    defaire.fermerGroupe()
  })

  /* ---------------- application ---------------- */

  on('app:info', () => ({
    version: app.getVersion(),
    dataRoot: dataRoot(),
    campaign: isDbOpen()
      ? getDb().prepare(`SELECT id, name, system FROM campaign WHERE id = ?`).get(activeCampaignId())
      : null
  }))
  /* Le panneau d'émojis du système (Windows + point) : il écrit dans le
     champ qui a la main, comme si on l'avait ouvert au clavier. */
  on('app:emojis', () => app.showEmojiPanel())

  /*
   * Le portrait du MJ, pris n'importe où sur le disque. Il suit le maître du
   * jeu d'une campagne à l'autre, comme le reste de son profil : on en garde
   * une copie sous les données de l'application, servie en `jdr://profil/`.
   * Le nom porte l'heure, pour qu'aucun écran ne garde l'ancienne en cache.
   */
  on('profil:portraitMj', async () => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const res = await dialog.showOpenDialog(win, {
      title: 'Ton portrait de MJ',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: IMAGE_EXT }]
    })
    const source = res.canceled ? null : res.filePaths[0]
    if (!source) return null
    const dossier = profilDir()
    if (existsSync(dossier))
      for (const f of readdirSync(dossier)) rmSync(join(dossier, f), { force: true })
    else mkdirSync(dossier, { recursive: true })
    const nom = `portrait-${Date.now()}${extname(source).toLowerCase()}`
    copyFileSync(source, join(dossier, nom))
    return `jdr://profil/${nom}`
  })
  on('app:openDataFolder', () => shell.openPath(dataRoot()))

  /**
   * Les gestes de la barre de menus qui ne regardent pas la campagne.
   *
   * Ils appartiennent à la fenêtre, pas à l'interface : couper, coller,
   * recharger et le zoom sont des ordres du navigateur, et le renderer n'a
   * pas le droit de se les donner à lui-même. Le menu natif d'Electron les
   * tient toujours pour le clavier ; celui-ci est pour la souris.
   */
  on('app:commande', (nom: string) => {
    const w = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const wc = w?.webContents
    if (!wc) return
    switch (nom) {
      case 'annuler': wc.undo(); break
      case 'retablir': wc.redo(); break
      case 'couper': wc.cut(); break
      case 'copier': wc.copy(); break
      case 'coller': wc.paste(); break
      case 'recharger': wc.reload(); break
      case 'outils': wc.toggleDevTools(); break
      case 'zoomPlus': wc.setZoomLevel(Math.min(4, wc.getZoomLevel() + 0.5)); break
      case 'zoomMoins': wc.setZoomLevel(Math.max(-4, wc.getZoomLevel() - 0.5)); break
      case 'zoomNormal': wc.setZoomLevel(0); break
      case 'quitter': app.quit(); break
    }
  })

  /* ---------------- les réglages ---------------- */

  /*
   * Deux magasins, deux canaux. Chaque geste rend la pile entière plutôt que
   * la ligne qu'on vient d'écrire : c'est l'idiome de la maison, et l'interface
   * n'a alors jamais à recoudre un objet qu'elle tient en mémoire.
   */
  on('reglages:campagne', () => reglages.tous())
  on('reglages:poserCampagne', (cle: string, valeur: string | null) => {
    const brut = reglages.poser(cle, valeur)
    const lus = lireCampagne(brut)
    /* Deux réglages ne se contentent pas d'être écrits : ils font bouger
       quelque chose tout de suite, sinon il faudrait rouvrir la campagne. */
    if (cle === 'sortie.ecran') display.setOutput(lus.sortieEcran)
    if (cle === 'murs.angle') display.calqueABouge()
    /* Les téléphones lisent la bourse dans ces monnaies, et le fond de leur sac. */
    if (cle === 'monnaies' || cle === 'sac.capacite') mobile.broadcast()
    return brut
  })
  on('reglages:poste', () => carnet.reglagesPoste())
  on('reglages:poserPoste', async (cle: string, valeur: string | null) => {
    const brut = carnet.poserReglagePoste(cle, valeur)
    /* Changer de port ou d'adresse, c'est déménager le serveur : on le
       referme et on le rouvre, les téléphones appairés se retrouvent seuls. */
    if (cle === 'portable.port' || cle === 'portable.adresse') await mobile.reconfigurer()
    return brut
  })

  /* ---------------- l'examen des médias ---------------- */

  /* Ce que la fenêtre des paramètres montre du graveur, et le geste qui le
     relance en entier. */
  on('examen:etat', () => examen.etat())
  on('examen:tout', () => examen.toutRegraver())

  /* Trois canaux pour le graveur, et personne d'autre ne les appelle : voir
     `main/examen.ts` et `renderer/src/examen/main.ts`. */
  on('examen:suivant', () => examen.suivant())
  on('examen:fait', (f: ExamenFait) => examen.fait(f))
  on('examen:fini', () => examen.fini())

  /* ---------------- projets ---------------- */

  on('project:current', () => projet.currentProject())
  on('project:recents', () => carnet.recents())
  on('project:new', () => projet.promptNew())
  on('project:open', () => projet.promptOpen())
  on('project:openPath', (dir: string): ProjectInfo | null =>
    dir === projet.currentDir() ? projet.currentProject() : projet.switchTo(dir)
  )

  on('project:update', (patch: { name?: string; system?: string | null }) =>
    projet.updateCampaign(patch)
  )
  on('project:reveal', () => {
    const dir = projet.currentDir()
    if (dir) void shell.openPath(dir)
  })
  on('project:forget', (dir: string) => carnet.forget(dir))

  /* ---------------- dossier de campagne ---------------- */

  on('library:root', () => fsLib.rootState())
  on('library:rescan', () => {
    fsLib.scan()
    return fsLib.rootState()
  })
  on('library:openRoot', () => fsLib.openFolderInExplorer(''))

  /* ---------------- dossiers ---------------- */

  on('folders:tree', () => {
    const { tree, orphans } = lib.folderTree()
    const decorate = (nodes: typeof tree): any =>
      nodes.map((n) => ({ ...n, items: withUrls(n.items), children: decorate(n.children) }))
    return { tree: decorate(tree), orphans: withUrls(orphans) }
  })
  on('folders:create', (parentRel: string, name: string) => fsLib.createFolder(parentRel, name))
  on('folders:assurer', (rel: string, icone: string | null) => fsLib.assurerDossier(rel, icone))
  on('folders:rename', (rel: string, name: string) => fsLib.renameEntry(rel, name))
  on('folders:move', (rel: string, destRel: string) => fsLib.moveEntry(rel, destRel))
  on('folders:trash', (rel: string) => fsLib.trashEntry(rel))
  on('folders:decor', (rel: string, icon: string | null, color: string | null) =>
    fsLib.setFolderDecor(rel, icon, color)
  )
  on('folders:reveal', (rel: string) => fsLib.openFolderInExplorer(rel))

  /**
   * Choisir un dossier de rangement dans l'explorateur, à l'intérieur de la
   * campagne. Hors de la campagne, le fichier ne serait plus suivi : on refuse
   * plutôt que de créer un document orphelin.
   */
  on('folders:choose', async (title?: string) => {
    const racine = fsLib.campaignRoot()
    if (!racine) return { rel: null, erreur: 'Aucun dossier de campagne lié.' }

    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const res = await dialog.showOpenDialog(win, {
      title: title ?? 'Où ranger ce document ?',
      defaultPath: racine,
      properties: ['openDirectory', 'createDirectory'],
      buttonLabel: 'Ranger ici'
    })
    const abs = res.canceled ? null : res.filePaths[0]
    if (!abs) return { rel: null, erreur: null }
    if (!fsLib.insideRoot(abs))
      return { rel: null, erreur: 'Ce dossier est hors de la campagne : le fichier ne serait pas suivi.' }
    return { rel: fsLib.relOf(abs), erreur: null }
  })

  /* ---------------- éléments ---------------- */

  on('items:list', (filter: ItemFilter) => withUrls(lib.listItems(filter ?? {})))
  on('items:get', (id: number) => {
    const it = lib.getItem(id)
    return it ? withUrl(it) : null
  })
  on('items:update', (id: number, patch: any) => {
    const it = lib.updateItem(id, patch)
    return it ? withUrl(it) : null
  })
  on('items:move', (rel: string, destRel: string) => fsLib.moveEntry(rel, destRel))
  on('items:rename', (rel: string, name: string) => fsLib.renameEntry(rel, name))
  on('items:trash', (rel: string) => fsLib.trashEntry(rel))
  on('items:reveal', (rel: string) => fsLib.revealEntry(rel))
  /* La page d'un PDF dont on tire sa vignette. Le dépôt efface la signature de
     l'examen ; c'est planifier() qui remet le graveur au travail. */
  on('items:thumbPage', (id: number, page: number) => {
    const it = lib.changerPageVignette(id, page)
    examen.planifier()
    return it ? withUrl(it) : null
  })

  /** Un document neuf, c'est un vrai fichier .html posé dans le dossier. */
  on('items:createDoc', (folderRel: string, title: string) => {
    const rel = fsLib.createDoc(folderRel, title)
    const it = lib.itemByPath(rel)
    return it ? withUrl(it) : null
  })

  /** Sélecteur de fichiers : la sélection est copiée dans le dossier choisi. */
  on('items:import', async (folderRel: string) => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const res = await dialog.showOpenDialog(win, {
      title: 'Copier des fichiers dans la campagne',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Tous les médias', extensions: IMPORTABLE },
        { name: 'Images', extensions: IMAGE_EXT },
        { name: 'Vidéos', extensions: VIDEO_EXT },
        { name: 'Sons', extensions: AUDIO_EXT },
        { name: 'Tous les fichiers', extensions: ['*'] }
      ]
    })
    if (res.canceled) return []
    const made = fsLib.importInto(folderRel ?? '', res.filePaths)
    return withUrls(made.map((r) => lib.itemByPath(r)).filter(Boolean) as Item[])
  })

  /* ---------------- lieux ---------------- */

  on('places:list', () => places.listPlaces())
  on('places:ofSession', (sessionId: number) => places.listPlaces(sessionId))
  on('places:duplicate', (id: number) => places.duplicatePlace(id))
  on('places:get', (id: number) => places.getPlace(id))
  on('places:remove', (id: number) => places.removePlace(id))
  on('places:move', (id: number, parentId: number | null, beforeId: number | null) =>
    places.movePlace(id, parentId, beforeId)
  )
  on('places:etage', (id: number, tier: 'niveau' | 'lieu') => places.changerEtage(id, tier))
  /* Le lieu à l'écran suit sa carte : l'image affichée, et celle sur laquelle
     les écrans acceptent de poser les pions (`carteDuLieu`). */
  const carteChangee = (id: number, ancienne: number, neuve: number): void => {
    const slide = slideOf(neuve)
    if (slide) display.carteRemplacee(id, ancienne, slide)
  }
  on('places:upsert', (input: any) => {
    const p = places.upsertPlace(input)
    /* Seule la carte compte ici : une description tapée ne rediffuse rien. */
    if (p.id === display.getState().placeId && p.mapItemId !== display.getState().carteDuLieu)
      display.refreshPions()
    return p
  })
  on('places:rogner', (id: number, cadre: { x: number; y: number; w: number; h: number }) => {
    const p = places.getPlace(id)
    const item = p?.mapItemId ? lib.getItem(p.mapItemId) : null
    if (!p || !item?.relPath) throw new Error('Ce lieu n’a pas d’image à rogner')
    const rel = fsLib.rognerImage(item.relPath, cadre)
    const neuf = lib.itemByPath(rel)
    if (!neuf) throw new Error('L’image rognée n’a pas été retrouvée')
    places.recalerApresRognage(id, item.id, neuf.id, cadre)
    carteChangee(id, item.id, neuf.id)
    return places.getPlace(id)
  })
  /* Caler l'image sous les murs : elle ne change pas, ce sont les murs, les
     pions, les lampes et les repères qui se recalent — le même calcul qu'un
     rognage, sans nouvelle image. */
  on('places:caler', (id: number, cadre: { x: number; y: number; w: number; h: number }) => {
    const p = places.getPlace(id)
    if (!p?.mapItemId) throw new Error('Ce lieu n’a pas d’image à caler')
    places.recalerApresRognage(id, p.mapItemId, p.mapItemId, cadre)
    return places.getPlace(id)
  })
  /* Caler en tournant : l'interface a dessiné l'image telle qu'on l'a
     redressée — une copie, l'originale ne bouge pas. Le lieu la prend, et ce
     qui est posé se recale comme après un rognage : ça ne fait que
     s'agrandir, la rotation est déjà dans l'image. */
  on(
    'places:calerTourne',
    (id: number, octets: Uint8Array, jpeg: boolean, cadre: { x: number; y: number; w: number; h: number }) => {
      const p = places.getPlace(id)
      const item = p?.mapItemId ? lib.getItem(p.mapItemId) : null
      if (!p || !item?.relPath) throw new Error('Ce lieu n’a pas d’image à caler')
      const rel = fsLib.copieTournee(item.relPath, octets, jpeg)
      const neuf = lib.itemByPath(rel)
      if (!neuf) throw new Error('L’image tournée n’a pas été retrouvée')
      places.recalerApresRognage(id, item.id, neuf.id, cadre)
      carteChangee(id, item.id, neuf.id)
      return places.getPlace(id)
    }
  )
  /* Remplacer l'image d'un plan sans déformer ce qui est posé dessus : les
     pièces découpées et les niveaux qui la partagent suivent. */
  on('places:remplacerCarte', (id: number, nouvelle: number) => {
    const p = places.getPlace(id)
    if (!p) throw new Error('Lieu introuvable')
    const ancienne = p.mapItemId
    if (ancienne === nouvelle) return { place: p, pieces: 0 }
    /* Le niveau d'un bâtiment qui reçoit son image cesse d'être un morceau du
       plan d'en bas. */
    if (p.tier === 'niveau' && p.zone) places.setZone(id, null)
    const suivent = places
      .listPlaces()
      .filter((q) => q.parentId === id && q.zone && ancienne != null && q.mapItemId === ancienne).length
    if (ancienne == null) places.upsertPlace({ id, name: p.name, mapItemId: nouvelle })
    else
      places.recalerApresRognage(
        id,
        ancienne,
        nouvelle,
        places.cadrePourRemplacer(lib.getItem(ancienne), lib.getItem(nouvelle))
      )
    if (ancienne != null) carteChangee(id, ancienne, nouvelle)
    else display.refreshPions()
    return { place: places.getPlace(id), pieces: suivent }
  })
  on('places:zone', (id: number, zone: PointMur[] | null, ancre?: PointMur | null) =>
    places.setZone(id, zone, ancre)
  )
  on('places:regardPortee', (id: number, portee: number | null) =>
    places.setRegardPortee(id, portee)
  )
  on('places:lumGarde', (id: number, garde: boolean) => places.setLumGarde(id, garde))
  on('places:pieceUnique', (id: number, unique: boolean) => places.setPieceUnique(id, unique))
  on('places:epingleArrivees', (id: number, oui: boolean) => places.setEpingleArrivees(id, oui))
  /* Le soleil ou la lune change ce que les joueurs voient : on le leur dit. */
  on('places:astre', (id: number, astre: Astre | null) => {
    const p = places.setAstre(id, astre)
    display.calqueABouge()
    return p
  })
  /* Le ciel d'un espace tombe sur tous ses lieux, celui à l'écran compris. */
  on('places:cielEspace', (id: number, astre: Astre | null) => {
    const p = places.setCiel(id, astre)
    display.calqueABouge()
    return p
  })
  on('places:ciel', (id: number) => places.cielDe(id))
  on('places:nord', (id: number, nord: number) => {
    const c = places.setNord(id, nord)
    display.calqueABouge()
    return c
  })
  on('places:ouvLargeur', (id: number, largeur: number | null) =>
    places.setOuvLargeur(id, largeur)
  )
  on('places:seen', (id: number, seen: boolean) => places.setSeen(id, seen))
  /* Les apparences de la carte : l'écran suit tout de suite, au direct comme
     en préparation, et les téléphones avec lui. */
  on('places:ajouterApparence', (placeId: number, itemId: number, nom: string) =>
    places.ajouterApparence(placeId, itemId, nom)
  )
  on('places:attacherImage', (placeId: number, itemId: number) => places.attacherImage(placeId, itemId))
  on('places:detacherImage', (placeId: number, itemId: number) => places.detacherImage(placeId, itemId))
  on('places:renommerApparence', (id: number, nom: string) => places.renommerApparence(id, nom))
  on('places:retirerApparence', (id: number) => {
    places.retirerApparence(id)
    display.rehabiller()
  })
  on('places:choisirApparence', (placeId: number, apparenceId: number | null) => {
    const p = places.choisirApparence(placeId, apparenceId)
    display.rehabiller()
    return p
  })

  /* ---------------- annotations d'un lieu ---------------- */
  /* Aucun de ces canaux ne touche `display` : c'est ce qui garantit que les
     annotations ne peuvent pas partir vers la fenêtre des joueurs. */

  on('annotations:of', (placeId: number | null) => annotations.listAnnotations(placeId))
  on('annotations:counts', () => annotations.annotationCounts())
  on('annotations:add', (input: any) => annotations.addAnnotation(input))
  on('annotations:update', (id: number, patch: any) => annotations.updateAnnotation(id, patch))
  on('annotations:move', (id: number, x: number, y: number) =>
    annotations.moveAnnotation(id, x, y)
  )
  on('annotations:remove', (id: number) => annotations.removeAnnotation(id))

  /* ---------------- surligneur du Paravent ---------------- */
  /* Pas de `display` non plus : le surlignage reste au MJ. Suivi par le défaire. */

  on('surlignage:liste', () => surlignage.listSurlignages())
  on('surlignage:remplacer', (changes: { cible: Cible; plages: Plage[] }[]) => surlignage.remplacer(changes))
  on('surlignage:effacer', (cibles: Cible[]) => surlignage.effacer(cibles))

  /* ---------------- la réserve d'objets ---------------- */
  /* Même isolement que les annotations : aucun de ces canaux ne touche
     `display`, donc ce que le MJ sait d'un objet ne peut pas partir vers la
     fenêtre des joueurs. */

  /* Ce que le MJ range ou donne, les téléphones le voient : un joueur qui
     reçoit un objet doit le trouver dans son sac sans rien toucher. */
  const remue = <T>(v: T): T => {
    /* Un inventaire passé à la Pochette y montre ce qu'il tient : ce qui vient
       d'y entrer ou d'en sortir y entre ou en sort aussi. */
    if (pochette.suivreInventaires()) display.versMj('pochette:changee', null)
    mobile.broadcast()
    return v
  }
  /* Ce qui change de main peut être une lampe : l'écran des joueurs relit son
     calque. Ce n'est qu'un compteur — rien de ce que le MJ sait ne part. */
  const eclaireAutrement = <T>(v: T): T => {
    display.calqueABouge()
    return remue(v)
  }

  on('objets:list', () => ({
    objets: objets.listObjets(),
    familles: objets.listFamilles(),
    unite: objets.uniteValeur(),
    inventaires: objets.listInventaires()
  }))
  on('objets:add', (input: { nom: string; familleId?: number | null }) => remue(objets.addObjet(input)))
  on('objets:update', (id: number, patch: any) => remue(objets.updateObjet(id, patch)))
  on('objets:copy', (id: number) => remue(objets.copyObjet(id)))
  on('objets:remove', (id: number) => remue(objets.removeObjet(id)))
  on('objets:poser', (input: any) => remue(objets.poser(input)))
  on('objets:placement', (id: number, patch: any) => remue(objets.majPlacement(id, patch)))
  on('objets:situer', (id: number, pos: { x: number; y: number } | null, placeId?: number) =>
    remue(objets.situer(id, pos, placeId))
  )
  on('objets:reprendre', (id: number) => remue(objets.reprendre(id)))
  /* La corbeille, et le retour de chaque exemplaire à son emplacement initial. */
  on('objets:jeter', (id: number) => remue(objets.jeter(id)))
  on('objets:ranger', (ids: number[]) => remue(objets.ranger(ids)))
  on('objets:fixerInitial', (id: number) => objets.fixerInitial(id))
  on('objets:changerInitial', (id: number, cible: any) => objets.changerInitial(id, cible))
  on('objets:supprimerJetes', (ids: number[]) => objets.supprimerJetes(ids))
  on('objets:viderCorbeille', () => objets.viderCorbeille())
  /* Équiper : poser un objet sur quelqu'un, à un endroit du corps. Ce canal ne
     touche pas `display` non plus — l'équipement d'un personnage reste chez le
     MJ tant que personne n'a décidé de le montrer. */
  on('objets:equiper', (input: { characterId: number; emplacement: string; objetId: number | null }) =>
    eclaireAutrement(objets.equiper(input))
  )
  on('objets:desequiper', (placementId: number) => eclaireAutrement(objets.desequiper(placementId)))
  on('objets:porter', (placementId: number, emplacement: string | null) =>
    eclaireAutrement(objets.porter(placementId, emplacement))
  )
  /* Allumer ou éteindre sa lampe de poche, sans la ranger. */
  on('objets:allumer', (placementId: number, allumee: boolean) =>
    eclaireAutrement(objets.allumer(placementId, allumee))
  )
  /* Faire passer un exemplaire d'une main à l'autre, ou dans une pièce. */
  on('objets:donner', (placementId: number, cible: any, qte?: number) =>
    eclaireAutrement(objets.donner(placementId, cible, qte))
  )
  /* Les inventaires partagés : ce qu'on y range, ouvre ou ferme, les
     téléphones le voient tout de suite. */
  on('objets:inventaireAdd', (nom: string) => objets.addInventaire(nom))
  on('objets:inventaireUpdate', (id: number, patch: { nom?: string; ouvert?: boolean; enPochette?: boolean }) =>
    remue(objets.updateInventaire(id, patch))
  )
  on('objets:inventaireRemove', (id: number) => {
    const ensuite = pochette.oublierInventaire(id)
    objets.removeInventaire(id)
    ensuite()
    display.versMj('pochette:changee', null)
    return remue(undefined)
  })
  on('objets:remplir', (inventaireId: number, objetIds: number[]) =>
    remue(objets.remplir(inventaireId, objetIds))
  )
  on('objets:remettre', (placementId: number, inventaireId: number, qte?: number) =>
    remue(objets.remettre(placementId, inventaireId, qte))
  )
  on('objets:unite', (unite: string) => objets.setUniteValeur(unite))
  on('objets:familleAdd', (input: any) => objets.addFamille(input))
  on('objets:familleUpdate', (id: number, patch: any) => objets.updateFamille(id, patch))
  on('objets:familleRemove', (id: number) => objets.removeFamille(id))
  on('objets:familleMasquer', (id: number, masquee: boolean) => objets.masquerFamille(id, masquee))

  /* ---------------- murs invisibles d'un lieu ---------------- */
  /* Même isolement que les annotations, et pour la même raison : aucun de ces
     canaux ne touche `display`, donc un mur ne peut pas partir vers l'écran
     des joueurs. */

  on('murs:of', (placeId: number | null) => murs.listMurs(placeId))
  on('murs:counts', () => murs.murCounts())
  /* Le calque d'un lieu d'un seul coup : la fenetre des joueurs le redemande a
     chaque changement de scene, et quatre allers-retours pour une image, c'est
     trois de trop. */
  on('murs:calque', (placeId: number | null) => murs.calqueDe(placeId))
  /* Après chaque geste sur un mur, les pièces de l'étage suivent — dans le
     même échange, donc dans le même pas de Ctrl+Z. L'interface relit les
     lieux, et dit qui une coupe vient de faire naître. */
  const piecesSuivent = (placeId: number | null | undefined): void => {
    if (placeId == null) return
    /* Au milieu d'un geste en plusieurs appels, les murs sont à moitié posés :
       on attend qu'il se ferme. */
    if (defaire.enGroupe()) {
      piecesEnAttente.add(placeId)
      return
    }
    const { touche, suites } = murs.recalerPieces(placeId)
    if (!touche) return
    for (const w of BrowserWindow.getAllWindows())
      if (!w.isDestroyed()) w.webContents.send('places:recales', { placeId, suites })
  }
  on('murs:add', (input: any) => {
    const m = murs.addMur(input)
    piecesSuivent(m?.placeId)
    return m
  })
  on('murs:update', (id: number, patch: any) => {
    const m = murs.updateMur(id, patch)
    if (patch && ('pts' in patch || 'nature' in patch)) piecesSuivent(m?.placeId)
    /* Tirer ou ouvrir un rideau change ce que les joueurs voient : on le leur
       dit. Déplacer un trait, non — le tracé ne regarde que le MJ, et un
       calque rediffusé à chaque point d'une polyligne ferait clignoter la
       table pour rien. */
    if (patch && 'ouvert' in patch) display.calqueABouge()
    return m
  })
  on('murs:remove', (id: number) => {
    const placeId = murs.getMur(id)?.placeId
    murs.removeMur(id)
    piecesSuivent(placeId)
  })

  on('ouvertures:of', (placeId: number | null) => ouvertures.listOuvertures(placeId))
  on('ouvertures:add', (input: any) => ouvertures.addOuverture(input))
  on('ouvertures:update', (id: number, patch: any) => {
    const o = ouvertures.updateOuverture(id, patch)
    /* Ouvrir une porte change ce que les joueurs voient : on le leur dit. */
    display.calqueABouge()
    return o
  })
  on('ouvertures:remove', (id: number) => ouvertures.removeOuverture(id))
  on('ouvertures:fermerPortes', (placeId: number) => {
    const n = ouvertures.fermerLesPortes(placeId)
    display.calqueABouge()
    return n
  })

  on('lumieres:of', (placeId: number | null) => lumieres.listLumieres(placeId))
  /* Une lampe posée ou retirée en pleine partie — une bougie qu'on allume, une
     lanterne qu'on emporte — doit se voir tout de suite chez les joueurs. */
  on('lumieres:add', (input: any) => {
    const l = lumieres.addLumiere(input)
    display.calqueABouge()
    return l
  })
  on('lumieres:update', (id: number, patch: any) => {
    const l = lumieres.updateLumiere(id, patch)
    display.calqueABouge()
    return l
  })
  on('lumieres:remove', (id: number) => {
    const r = lumieres.removeLumiere(id)
    display.calqueABouge()
    return r
  })

  /* ---------------- sons : la sonothèque et les sons posés ---------------- */

  /* Ce qui s'écrit en base se prépare, et se défait d'un Ctrl+Z. */
  on('sons:list', () => sons.listSons())
  on('sons:add', (input: any) => sons.addSon(input ?? {}))
  /* Plusieurs fichiers d'un coup : un son chacun, sa nature devinée à la durée. */
  on('sons:addPlusieurs', (itemIds: number[], planche?: string) =>
    itemIds.map((id) => sons.addSon({ itemIds: [id], planche })).filter(Boolean)
  )
  on('sons:update', (id: number, patch: any) => sons.updateSon(id, patch ?? {}))
  on('sons:fichiers', (id: number, itemIds: number[]) => sons.setFichiersSon(id, itemIds))
  on('sons:remove', (id: number | number[]) => sons.removeSon(id))
  on('sons:ordonner', (ids: number[]) => sons.ordonnerSons(ids))
  on('sons:planche', (avant: string, apres: string) => sons.renommerPlanche(avant, apres))
  on('sons:nomsDesFichiers', (ids?: number[]) => sons.nomsDesFichiers(ids))
  on('sons:usages', () => sons.zonesParSon())
  on('sons:zones', (placeId: number | null) => sons.listZones(placeId))
  on('sons:zoneAdd', (input: any) => {
    const z = sons.addZone(input)
    if (z) regieSon.zoneChangee(z.id)
    return z
  })
  on('sons:zoneUpdate', (id: number, patch: any) => {
    const z = sons.updateZone(id, patch ?? {})
    regieSon.zoneChangee(id)
    return z
  })
  on('sons:zoneRemove', (id: number) => {
    sons.removeZone(id)
    regieSon.zoneChangee(id)
  })

  /* La régie du son : rien ne s'écrit, tout se joue. */
  ipcMain.handle('regieSon:etat', () => regieSon.etat())
  ipcMain.handle('regieSon:jouer', (_e, sonId: number) => regieSon.jouer(sonId))
  ipcMain.handle('regieSon:ambiance', (_e, sonId: number | null) => regieSon.ambiance(sonId))
  ipcMain.handle('regieSon:nappe', (_e, sonId: number) => regieSon.ajouterNappe(sonId))
  ipcMain.handle('regieSon:reglerNappe', (_e, sonId: number, patch: any) =>
    regieSon.reglerNappe(sonId, patch ?? {})
  )
  ipcMain.handle('regieSon:retirerNappe', (_e, sonId: number) => regieSon.retirerNappe(sonId))
  ipcMain.handle('regieSon:regler', (_e, patch: any) => regieSon.regler(patch ?? {}))
  ipcMain.handle('regieSon:silence', () => regieSon.silence())
  ipcMain.handle('regieSon:feuVert', (_e, zoneId: number) => regieSon.feuVert(zoneId))
  ipcMain.handle('regieSon:jouerZone', (_e, zoneId: number) => regieSon.jouerZone(zoneId))
  ipcMain.handle('regieSon:rearmer', (_e, zoneId: number) => regieSon.rearmer(zoneId))
  ipcMain.handle('regieSon:toutRearmer', () => regieSon.toutRearmer())
  ipcMain.handle('regieSon:vibrer', (_e, motif: any) => regieSon.vibrerTous(motif))
  regieSon.brancher()

  /* ---------------- chronologie ---------------- */

  on('timeline:sessions', () => timeline.listSessions())
  on('timeline:currentSession', () => timeline.currentSession())
  /* Entrer dans une séance, c'est y faire entrer les joueurs : chacun y reçoit
     son état de la séance d'avant, et l'écran comme les téléphones changent de
     fiche avec le MJ. */
  const entrerDansLaSeance = (id: number): void => {
    chars.preparerSeance(id)
    objets.reporterInventaires(id)
    /* Les inventaires ne tiennent pas la même chose d'une séance à l'autre. */
    if (pochette.suivreInventaires()) display.versMj('pochette:changee', null)
    /* Un combat ne passe pas d'une séance à l'autre. */
    tours.fin()
    display.refreshJoueurs()
    mobile.broadcast()
  }
  on('timeline:createSession', (label: string, date?: string) => {
    const s = timeline.createSession(label, date)
    entrerDansLaSeance(s.id)
    return s
  })
  on('timeline:setActiveSession', (id: number) => {
    timeline.setActiveSession(id)
    entrerDansLaSeance(id)
  })
  /* Dupliquer une séance : d'abord le dossier sur le disque — c'est le long,
     et la fenêtre suit sa progression —, puis la base, en une transaction. */
  ipcMain.handle(
    'timeline:dupliquerSeance',
    async (e, srcId: number, label: string, dossier: string | null, nomDossier: string) => {
      const dire = (etape: string, fait: number, total: number): void => {
        if (!e.sender.isDestroyed()) e.sender.send('timeline:progression', { etape, fait, total })
      }
      let rel: string | null = null
      let jumeaux = new Map<number, number>()
      if (dossier) {
        const copie = await fsLib.copierDossier(dossier, nomDossier || label, (fait, total) =>
          dire('fichiers', fait, total)
        )
        rel = copie.rel
        jumeaux = copie.jumeaux
      }
      dire('seance', 0, 1)
      const s = timeline.dupliquerSeance(srcId, label, rel, jumeaux)
      entrerDansLaSeance(s.id)
      dire('seance', 1, 1)
      return s
    }
  )
  on('timeline:updateSession', (id: number, patch: any) => timeline.updateSession(id, patch))
  /* Déplacer une séance change qui est « d'avant » : le hors-jeu peut en
     dépendre, l'écran et les téléphones relisent leurs joueurs. */
  on('timeline:placerSeance', (id: number, refId: number, sens: 'avant' | 'apres') => {
    const r = timeline.placerSeance(id, refId, sens)
    display.refreshJoueurs()
    mobile.broadcast()
    return r
  })
  on('timeline:deleteSession', (id: number) => {
    const r = timeline.deleteSession(id)
    /* Supprimer la séance en cours fait entrer dans la suivante. */
    if (r.ok) entrerDansLaSeance(activeSessionId())
    return r
  })
  on('timeline:beats', (sessionId?: number) =>
    timeline.listBeats(sessionId).map((b) => ({ ...b, items: withUrls(b.items) }))
  )
  on('timeline:upsertBeat', (input: any) => {
    let b = timeline.upsertBeat(input)
    /* Le titre fait foi : le fichier du texte le suit. */
    if (input.id && timeline.alignerNomsDesTextes(b.id))
      b = timeline.listBeats(b.sessionId).find((x) => x.id === b.id) ?? b
    return { ...b, items: withUrls(b.items) }
  })
  /* Le moment emporte son texte : sans quoi « Relire le dossier » le ferait
     renaître. Corbeille de Windows, comme partout. */
  on('timeline:removeBeat', async (id: number) => {
    const textes = timeline.textesPropres(id)
    timeline.removeBeat(id)
    for (const rel of textes) await fsLib.jeterTexte(rel)
  })
  on('timeline:reorderBeats', (ids: number[]) => timeline.reorderBeats(ids))
  on('timeline:attach', (beatId: number, itemId: number) => timeline.attachToBeat(beatId, itemId))
  on('timeline:detach', (beatId: number, itemId: number) => timeline.detachFromBeat(beatId, itemId))
  on('timeline:adopterTextes', () => {
    const n = timeline.adopterTextesDeMoments()
    timeline.alignerNomsDesTextes()
    return n
  })
  on('timeline:setPnjs', (beatId: number, ids: number[]) => timeline.setBeatPnjs(beatId, ids))
  on('timeline:setPresenterJoueurs', (beatId: number, on: boolean) =>
    timeline.setBeatPresenterJoueurs(beatId, on)
  )

  /* ---------------- la trame de la séance ---------------- */

  /* Le MJ seul la voit : rien ici ne part vers l'écran ni les portables. */
  on('trame:lire', () => trame.lireTrame())
  on('trame:creer', (input: any) => trame.creerCarte(input))
  on('trame:maj', (id: number, patch: any) => trame.majCarte(id, patch))
  on('trame:cocher', (id: number, fait: boolean) => trame.cocher(id, fait))
  on('trame:toutDecocher', () => trame.toutDecocher())
  on('trame:supprimer', (id: number) => trame.supprimerCarte(id))
  on('trame:relier', (de: number, a: number) => trame.relier(de, a))
  on('trame:majLien', (id: number, mot: string) => trame.majLien(id, mot))
  on('trame:supprimerLien', (id: number) => trame.supprimerLien(id))

  /* ---------------- la fiche d'un lieu ---------------- */

  /* Scénarios, découvertes, déclencheurs, PNJ du lieu : pour le MJ seul. */
  on('fiche:lire', (placeId: number) => fiche.lireFiche(placeId))
  on('fiche:ajouterScenario', (placeId: number, titre?: string) =>
    fiche.ajouterScenario(placeId, titre)
  )
  on('fiche:majScenario', (id: number, patch: any) => fiche.majScenario(id, patch))
  on('fiche:supprimerScenario', (id: number) => fiche.supprimerScenario(id))
  on('fiche:ordonnerScenarios', (placeId: number, ids: number[]) =>
    fiche.ordonnerScenarios(placeId, ids)
  )
  on('fiche:ajouterCarte', (placeId: number, c: any) => fiche.ajouterCarte(placeId, c))
  on('fiche:majCarte', (id: number, c: any) => fiche.majCarte(id, c))
  on('fiche:cocherCarte', (id: number, fait: boolean) => fiche.cocherCarte(id, fait))
  on('fiche:cocherScenario', (id: number, fait: boolean) => fiche.cocherScenario(id, fait))
  on('fiche:situer', (genre: 'carte' | 'scenario', id: number, pos: { x: number; y: number } | null) =>
    fiche.situerArticle(genre, id, pos)
  )
  on('fiche:supprimerCarte', (id: number) => fiche.supprimerCarte(id))
  on('fiche:ajouterPnj', (placeId: number, characterId: number) =>
    fiche.ajouterPnj(placeId, characterId)
  )
  on('fiche:retirerPnj', (placeId: number, characterId: number) =>
    fiche.retirerPnj(placeId, characterId)
  )

  /* ---------------- documents annexes ---------------- */

  on('annexes:list', () => annexes.listAnnexes().map(withUrl))
  on('annexes:add', (itemId: number) => annexes.addAnnexe(itemId).map(withUrl))
  on('annexes:remove', (itemId: number) => annexes.removeAnnexe(itemId).map(withUrl))
  on('annexes:reorder', (itemIds: number[]) => annexes.reorderAnnexes(itemIds).map(withUrl))

  /* ---------------- santé mentale : les événements ---------------- */

  on('sm:evenements', (sessionId: number) => smEvenements.listEvenements(sessionId))
  on('sm:ecrire', (e: Parameters<typeof smEvenements.ecrireEvenement>[0]) => smEvenements.ecrireEvenement(e))
  on('sm:effacer', (id: number) => smEvenements.effacerEvenement(id))
  on('sm:ranger', (sessionId: number, ids: number[]) => smEvenements.rangerEvenements(sessionId, ids))
  on('sm:dupliquer', (id: number, versSessionId: number) => smEvenements.dupliquerEvenement(id, versSessionId))
  on('sm:semer', () => smEvenements.semerEvenements())

  /* ---------------- la pochette ---------------- */

  /* Tout ce qui touche la pochette la repousse aux téléphones : elle n'a
     d'intérêt que vue depuis l'autre bout de la table, et un document remis
     que personne ne voit arriver n'est pas remis. */
  const poche = (): { onglets: any[]; docs: any[] } => ({
    onglets: pochette.listOnglets(),
    docs: pochette.listPochette().map((d) => ({ ...d, item: withUrl(d.item) }))
  })
  const pocheEtPousse = (): { onglets: any[]; docs: any[] } => {
    mobile.broadcast()
    return poche()
  }

  on('pochette:list', () => poche())
  on('pochette:add', (itemId: number, playerId: number | null, ongletId: number | null) => {
    pochette.addDoc(itemId, playerId, ongletId)
    return pocheEtPousse()
  })
  on('pochette:remove', (id: number) => {
    pochette.removeDoc(id)
    return pocheEtPousse()
  })
  on('pochette:setPlayer', (id: number, playerId: number | null) => {
    pochette.setDocPlayer(id, playerId)
    return pocheEtPousse()
  })
  on('pochette:setVisible', (id: number, visible: boolean) => {
    pochette.setDocVisible(id, visible)
    return pocheEtPousse()
  })
  on('pochette:setOnglet', (id: number, ongletId: number | null) => {
    pochette.setDocOnglet(id, ongletId)
    return pocheEtPousse()
  })
  on('pochette:createOnglet', (name: string) => {
    pochette.createOnglet(name)
    return pocheEtPousse()
  })
  on('pochette:renameOnglet', (id: number, name: string) => {
    pochette.renameOnglet(id, name)
    return pocheEtPousse()
  })
  on('pochette:removeOnglet', (id: number) => {
    pochette.removeOnglet(id)
    return pocheEtPousse()
  })
  on('pochette:reorderDocs', (ids: number[]) => {
    pochette.reorderDocs(ids)
    return pocheEtPousse()
  })
  on('pochette:reorderOnglets', (ids: number[]) => {
    pochette.reorderOnglets(ids)
    return pocheEtPousse()
  })

  /* ---------------- les mots secrets ---------------- */

  /* Comme la pochette : chaque geste repousse aux téléphones et rend la liste
     entière. Un mot qui part sans que le téléphone l'apprenne n'est pas parti. */
  const motsEtPousse = (): MotSecret[] => {
    mobile.broadcast()
    return mots.listMots()
  }
  on('mots:list', () => mots.listMots())
  on(
    'mots:ecrire',
    (playerIds: number[], texte: string, beatId: number | null, envoyer: boolean, vibre: boolean) => {
      mots.ecrire(playerIds, texte, beatId, envoyer, vibre !== false)
      return motsEtPousse()
    }
  )
  /* Un mot se manie par lot : tous ses exemplaires d'un seul geste. */
  on('mots:reecrire', (lot: string, texte: string, playerIds: number[], vibre: boolean) => {
    mots.reecrire(lot, texte, playerIds, vibre !== false)
    return mots.listMots()
  })
  on('mots:envoyer', (lot: string) => {
    mots.envoyer(lot)
    return motsEtPousse()
  })
  on('mots:effacer', (lot: string) => {
    mots.effacer(lot)
    return motsEtPousse()
  })

  /* ---------------- fiches ---------------- */

  on('templates:list', () => chars.listTemplates())
  on('templates:upsert', (input: any) => chars.upsertTemplate(input))
  on('templates:remove', (id: number) => chars.removeTemplate(id))
  on('templates:blankData', (templateId: number) => {
    const t = chars.listTemplates().find((x) => x.id === templateId)
    return t ? chars.blankData(t.spec) : null
  })

  /* ---------------- le portable des joueurs ---------------- */

  on('mobile:info', () => mobile.info())
  on('mobile:open', () => mobile.open())
  on('mobile:closeInvite', () => mobile.closeInvite())
  on('mobile:show', (on2: boolean) => mobile.showOnPlayers(on2))
  on('mobile:revoke', (id: number) => {
    mobile.revokeDevice(id)
    return mobile.info()
  })

  /* ---------------- la fiche de la campagne ---------------- */

  on('sheet:get', () => chars.campaignSheet())
  on('sheet:save', (input: { name: string; spec: any }) => {
    const t = chars.saveCampaignSheet(input)
    mobile.broadcast()
    return t
  })

  /* Le catalogue et les modèles appartiennent à l'application : ils traversent
     les campagnes, c'est leur raison d'être. */

  on('catalogue:list', () => carnet.listCatalogue())
  on('catalogue:add', (input: any) => carnet.addCatalogueEntry(input))
  on('catalogue:remove', (uid: string) => carnet.removeCatalogueEntry(uid))

  on('models:list', () => carnet.listModels())
  on('models:save', (input: { name: string; spec: any }) => carnet.saveModel(input.name, input.spec))
  on('models:remove', (uid: string) => carnet.removeModel(uid))

  /* ---------------- joueurs ---------------- */

  /* Le carnet appartient à l'application, les inscriptions à la campagne.
     Une personne créée ici entre dans les deux : on ne demande jamais deux
     fois le même nom. Après chaque geste, l'écran des joueurs est relu — le
     nom et la couleur d'un pion en dépendent. */

  on('players:carnet', () => carnet.listCarnet())
  on('players:masquer', (uid: string, masque: boolean) => carnet.setCarnetMasque(uid, masque))
  on('players:list', () => players.listPlayers())

  on('players:create', (name: string) => {
    const p = carnet.createCarnetPlayer(name)
    const inscrit = players.enrollPlayer(p.uid, p.name, p.color)
    display.refreshJoueurs()
    return inscrit
  })

  on('players:enroll', (uid: string) => {
    const p = carnet.listCarnet().find((x) => x.uid === uid)
    if (!p) throw new Error('Ce joueur n’est plus au carnet.')
    const inscrit = players.enrollPlayer(p.uid, p.name, p.color)
    display.refreshJoueurs()
    return inscrit
  })

  /** Renommer ou recolorier vaut partout : le carnet suit la campagne. */
  on('players:update', (id: number, patch: { name?: string; color?: string | null }) => {
    const p = players.updatePlayer(id, patch)
    if (p) carnet.updateCarnetPlayer(p.uid, { name: p.name, color: p.color })
    display.refreshJoueurs()
    return p
  })

  on('players:setCharacter', (id: number, characterId: number | null) => {
    const p = players.setPlayerCharacter(id, characterId)
    display.refreshJoueurs()
    return p
  })

  on('players:remove', (id: number) => {
    players.removePlayer(id)
    display.refreshJoueurs()
  })

  on('players:deleteFromCarnet', (uid: string) => carnet.deleteCarnetPlayer(uid))
  on('players:renameCarnet', (uid: string, name: string) =>
    carnet.updateCarnetPlayer(uid, { name })
  )

  /* ---------------- personnages ---------------- */

  on('characters:list', () => chars.listCharacters())
  on('characters:pnjOf', (sessionId: number) => chars.listPnjDe(sessionId))
  on('characters:duplicate', (id: number) => chars.duplicatePnj(id))
  on('characters:horsJeu', (id: number, horsJeu: boolean) => {
    const c = chars.setHorsJeu(id, horsJeu)
    display.refreshJoueurs()
    return c
  })
  on('characters:present', (id: number, present: boolean) => {
    const c = chars.setPresent(id, present)
    /* L'absent quitte l'encart de l'écran joueurs sur-le-champ. */
    display.refreshJoueurs()
    return c
  })
  on('characters:get', (id: number) => chars.getCharacter(id))
  on('characters:upsert', (input: any) => {
    const c = chars.upsertCharacter(input)
    display.refreshJoueurs()
    return c
  })
  /* Le butin ne bouge que chez le MJ : ni l'écran ni les téléphones n'en
     reçoivent quoi que ce soit, donc rien à rafraîchir de leur côté. */
  on('characters:setButin', (id: number, lignes: any[]) => chars.setButin(id, lignes))
  /* L'état d'un PNJ sur son pion : il part à l'écran avec les pions. */
  on('characters:etatVisible', (id: number, on: boolean) => {
    const c = chars.setEtatVisible(id, on)
    display.refreshPions()
    return c
  })
  on('characters:remove', (id: number) => {
    chars.removeCharacter(id)
    display.refreshJoueurs()
  })
  on('characters:adjust', (id: number, key: string, delta: number, reason?: string, maxDelta?: number) => {
    /* Un point de vie perdu doit se voir à l'écran dans la seconde. */
    const r = chars.adjustGauge(id, key, delta, reason, maxDelta ?? 0)
    display.refreshJoueurs()
    /* Un PNJ qui montre son état le change sur son pion. */
    if (r.character.kind === 'pnj' && r.character.etatVisible) display.refreshPions()
    return r
  })
  /* Tout ce qui se lit sur un téléphone doit y changer en même temps qu'ici. */
  on('characters:pickSkill', (id: number, key: string, on2: boolean) => {
    const c = chars.pickSkill(id, key, on2)
    mobile.broadcast()
    return c
  })
  on('characters:setSkill', (id: number, key: string, v: number) => {
    const c = chars.setSkill(id, key, v)
    mobile.broadcast()
    return c
  })
  /* Ses bonus et malus : le téléphone les montre sur chaque carac. */
  on('characters:setModifs', (id: number, modifs: Modif[]) => {
    const c = chars.setModifs(id, modifs)
    mobile.broadcast()
    return c
  })
  /* Les mêmes, posés par le jeu (malus de palier, nausée) : hors du Ctrl+Z, voir `CANAUX_HORS`. */
  on('characters:setModifsJeu', (id: number, modifs: Modif[]) => {
    const c = chars.setModifs(id, modifs)
    mobile.broadcast()
    return c
  })
  on('characters:setStat', (id: number, key: string, v: number) => {
    const c = chars.setStat(id, key, v)
    mobile.broadcast()
    return c
  })
  on('characters:setState', (id: number, key: string, on2: boolean) => chars.setState(id, key, on2))
  on('characters:log', (id: number) => chars.characterLog(id))
  /* Suivi par le Ctrl+Z : un journal vidé par mégarde revient. */
  on('characters:viderJournal', (id: number) => chars.viderJournal(id))
  /* La bourse : le téléphone du joueur la lit, il doit la voir bouger. */
  on('characters:bourse', (id: number, ecarts: Record<string, number>, reason?: string | null) => {
    const r = chars.bougerBourse(id, ecarts, monnaiesActives(lireCampagne(reglages.tous()).monnaies), reason)
    mobile.broadcast()
    return r
  })

  /* ---------------- jets ---------------- */

  on('rolls:list', (limit?: number, sessionOnly?: boolean) =>
    rolls.listRolls(limit ?? 300, sessionOnly !== false)
  )
  on('rolls:roll', (req: any) => rolls.addRoll(req))
  /* Un jet saisi pour un personnage : le serveur refait le compte — carac,
     bonus et malus — comme pour un téléphone, et use ce qui s'use. */
  on('rolls:record', (req: any) => {
    const perso = req?.characterId != null && req.caracKey ? chars.getCharacter(req.characterId) : null
    if (!perso) return rolls.recordRoll(req)
    const fait = noterJet(perso, String(req.caracKey), Number(req.die))
    if (!fait) return rolls.recordRoll(req)
    if (fait.use) mobile.broadcast()
    return fait.roll
  })
  on('rolls:formula', (formula: string, label?: string) => rolls.rollFormula(formula, label))
  on('rolls:stats', () => rolls.rollStats())
  on('rolls:trash', (id: number) => rolls.trashRoll(id))
  on('rolls:restore', (id: number) => rolls.restoreRoll(id))
  on('rolls:trashList', () => rolls.listTrash())
  on('rolls:emptyTrash', () => rolls.emptyTrash())
  on('rolls:clear', () => rolls.clearSessionRolls())

  /* Remettre la séance à son départ : suivi par le défaire, un Ctrl+Z la rend. */
  on('seance:reinitialiser', (choix: ChoixReinit) => {
    const r = reinitialiser(choix)
    display.refreshJoueurs()
    display.versMj('characters:relus', null)
    if (pochette.suivreInventaires()) display.versMj('pochette:changee', null)
    mobile.broadcast()
    return r
  })
  on('rolls:exportCsv', async () => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const session = timeline.currentSession()
    const safe = session.label.replace(/[^\p{L}\p{N}\-_ ]/gu, '').trim() || 'seance'
    const res = await dialog.showSaveDialog(win, {
      title: 'Exporter les jets',
      defaultPath: join(app.getPath('documents'), `jets-${safe}.csv`),
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (res.canceled || !res.filePath) return null
    writeFileSync(res.filePath, rolls.rollsCsv(), 'utf8')
    return res.filePath
  })

  /* ---------------- tours ---------------- */

  /* Rien n'est écrit en base : les tours vivent en mémoire, le temps d'un
     combat. D'où `ipcMain.handle` tout court, sans pas de Ctrl+Z. */
  ipcMain.handle('tours:etat', () => tours.etat())
  ipcMain.handle('tours:candidats', () => tours.candidats())
  ipcMain.handle('tours:ouvrir', () => tours.ouvrir())
  ipcMain.handle('tours:carac', (_e, key: string | null) => tours.choisirCarac(key))
  ipcMain.handle('tours:saisir', (_e, cle: string, patch) => tours.saisir(cle, patch))
  ipcMain.handle('tours:ajouter', (_e, cle: string) => tours.ajouter(cle))
  ipcMain.handle('tours:retirer', (_e, cle: string) => tours.retirer(cle))
  ipcMain.handle('tours:commencer', () => tours.commencer())
  ipcMain.handle('tours:annuler', () => tours.annuler())
  /* Un round de plus : ce qui se comptait en tours en perd un. */
  ipcMain.handle('tours:suivant', () => {
    const avant = tours.etat()?.round
    const t = tours.suivant()
    if (t && avant != null && t.round > avant && chars.vieillirModifs(apresUnTour)) modifsVieillis()
    return t
  })
  ipcMain.handle('tours:precedent', () => tours.precedent())
  ipcMain.handle('tours:retarder', () => tours.retarder())
  ipcMain.handle('tours:main', (_e, cle: string) => tours.donnerMain(cle))
  ipcMain.handle('tours:deplacer', (_e, cle: string, vers: number) => tours.deplacer(cle, vers))
  ipcMain.handle('tours:fin', () => {
    const t = tours.fin()
    if (chars.vieillirModifs(apresLeCombat)) modifsVieillis()
    return t
  })

  /* ---------------- préparation des personnages ---------------- */

  ipcMain.handle('prepa:etat', () => prepa.etat())
  ipcMain.handle('prepa:ouvrir', () => prepa.ouvrir())
  ipcMain.handle('prepa:clore', () => prepa.clore())
  ipcMain.handle('prepa:montrer', (_e, on: boolean) => prepa.montrer(on))

  /* ---------------- régie ---------------- */

  on('display:state', () => display.getState())
  on('display:screens', () => display.listScreens())
  on('display:show', (slide: SlidePayload) => display.show(slide))
  /** Ce qu'un élément devient à l'écran. Le son n'est pas une diapositive. */
  const slideOf = (itemId: number): SlidePayload | null => {
    const it = lib.getItem(itemId)
    if (!it) return null
    const url = mediaUrl(it.relPath)
    if (it.kind === 'image' && url) return { type: 'image', itemId, url, title: it.title }
    if (it.kind === 'video' && url) return { type: 'video', itemId, url, title: it.title, loop: true }
    if (it.kind === 'doc') return { type: 'text', title: it.title, html: it.body ?? '' }
    return null
  }

  const asAudio = (itemId: number, playing: boolean): boolean => {
    const it = lib.getItem(itemId)
    const url = mediaUrl(it?.relPath ?? null)
    if (!it || it.kind !== 'audio' || !url) return false
    /* Un fichier nu, pas un son de la sonothèque : il ne garde pas le nom du précédent. */
    display.setAudio({ itemId, url, title: it.title, playing, sonId: null, fondu: 2 })
    return true
  }

  on('display:showItem', (itemId: number) => {
    if (asAudio(itemId, true)) return display.getState()
    const slide = slideOf(itemId)
    return slide ? display.show(slide) : display.getState()
  })

  /** Charge l'emplacement en préparation : les joueurs ne voient rien bouger. */
  on('display:prepareItem', (itemId: number) => {
    if (asAudio(itemId, false)) return display.getState()
    const slide = slideOf(itemId)
    return slide ? display.prepare(slide) : display.getState()
  })

  on('display:swap', (ms?: number, mode?: Transition) => display.swap(ms ?? 800, mode ?? 'fondu'))

  /* ---- collages : plusieurs images sur le même écran ---- */

  on('display:prepareLayout', (layout: CollageLayout) => display.prepareLayout(layout))
  /* Écrire dans une case : sa légende sous l'image, ou son texte si elle n'en
     porte pas. La temporisation de la frappe est côté régie. */
  on('display:cellCaption', (index: number, caption: string) =>
    display.ecrireCase(index, { caption })
  )
  on('display:cellText', (index: number, texte: string, color?: string) =>
    display.ecrireCase(index, { texte, color })
  )
  on('display:frame', (slot: 'prep' | 'live', cell: number | null, frame: Frame) =>
    display.frameImage(slot, cell, frame)
  )
  on('display:prepareCell', (index: number, itemId: number | null) => {
    if (itemId == null) return display.prepareCell(index, null)
    const it = lib.getItem(itemId)
    const url = mediaUrl(it?.relPath ?? null)
    if (!it || it.kind !== 'image' || !url) return display.getState()
    return display.prepareCell(index, { kind: 'image', itemId: it.id, url, title: it.title })
  })
  on('display:texts', (slot: 'prep' | 'live', texts: TextOverlay[]) =>
    display.setTexts(slot, texts)
  )
  on('display:blackout', () => display.blackout())
  on('display:arreterPresentation', () => display.arreterPresentation())
  on('display:freeze', (on2: boolean) => display.setFrozen(on2))
  on('display:pionLabels', (on2: boolean) => display.setPionLabels(on2))
  on('display:vision', (v: 'regards' | 'jour') => display.setVision(v))
  on('display:pionPv', (on2: boolean) => display.setPionPv(on2))
  on('display:encart', (patch: any) => display.setEncart(patch))
  on('display:fenetre', (itemId: number) => display.ouvrirFenetre(itemId))
  on('display:reglerFenetre', (itemId: number, patch: any) => display.reglerFenetre(itemId, patch))
  on('display:fermerFenetre', (itemId?: number) => display.fermerFenetre(itemId))
  on('display:setOutput', (id: number | null) => display.setOutput(id))
  on('display:openPlayer', () => display.openPlayer())
  on('display:closePlayer', () => display.closePlayer())
  on('display:togglePlayer', () => display.togglePlayer())
  on('display:audio', (patch: any) => display.setAudio(patch))

  /* ---------------- lieu en scène, pions, pointeur ---------------- */

  /**
   * Préparer un lieu : sa carte va dans l'emplacement libre, son ambiance est
   * chargée **en pause** — on la lance quand la scène commence, pas avant —
   * et le lieu lui-même ne prend effet qu'à la bascule, pour que les pions ne
   * se posent jamais sur la carte du lieu précédent.
   */
  on('display:preparePlace', (placeId: number | null) => {
    display.preparePlace(placeId)
    if (placeId != null) {
      const p = places.getPlace(placeId)
      if (p?.mapItemId) {
        const slide = slideOf(p.mapItemId)
        if (slide) display.prepare(slide)
      }
      if (p?.ambienceItemId) asAudio(p.ambienceItemId, false)
    }
    return display.getState()
  })

  /** Bascule immédiate, sans préparation : le lieu prend effet tout de suite. */
  on('display:setPlace', (placeId: number | null) => {
    display.setPlace(placeId)
    if (placeId != null) {
      const p = places.getPlace(placeId)
      if (p?.mapItemId) {
        const slide = slideOf(p.mapItemId)
        if (slide) display.show(slide)
      }
      if (p?.ambienceItemId) asAudio(p.ambienceItemId, false)
    }
    return display.getState()
  })

  /** Qui se tient où : les joueurs posés, lieu par lieu, pour la liste des lieux. */
  on('pions:presence', () => pions.pionsParLieu())
  /** Les pions d'un lieu quelconque : la régie prépare un lieu qui n'est pas encore en scène. */
  on('pions:of', (placeId: number | null) => ({
    pions: pions.listPions(placeId),
    size: pions.pionSize(placeId)
  }))
  on('pions:add', (input: any) => {
    pions.addPion(input)
    return display.refreshPions()
  })
  on('pions:move', (id: number, x: number, y: number) => {
    pions.movePion(id, x, y)
    return display.refreshPions()
  })
  /* Les trois gestes du pion. Chacun rend l'état de diffusion : un pion qu'on
     cache doit en sortir tout de suite, pas au prochain rafraîchissement. */
  on('pions:rotate', (id: number, deg: number) => {
    pions.tournerPion(id, deg)
    return display.refreshPions()
  })
  on('pions:layer', (id: number, ou: 'devant' | 'derriere') => {
    pions.calquePion(id, ou)
    return display.refreshPions()
  })
  /* Faire une fiche à un pion nommé. Le gabarit est celui de la campagne :
     une seule fiche pour tout le monde, PNJ compris. */
  on('pions:promote', (id: number) => {
    const tpl = chars.campaignSheet()
    pions.promouvoirPion(id, tpl.id)
    display.refreshJoueurs()
    return display.refreshPions()
  })
  on('pions:hide', (id: number, cache: boolean) => {
    pions.cacherPion(id, cache)
    return display.refreshPions()
  })
  on('pions:anonyme', (id: number, anonyme: boolean) => {
    pions.anonymiserPion(id, anonyme)
    return display.refreshPions()
  })
  /* Le pion qu'on mène depuis son détail : les murs le retiennent comme ceux
     des téléphones — la même géométrie, au même endroit. Il rend où il est
     arrivé, pour que le pupitre se recale. */
  on('pions:marcher', (id: number, x: number, y: number) => {
    const p = pions.getPion(id)
    if (!p) return null
    const arrive = mobile.retenuParLesMurs(p.placeId, p, {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y))
    })
    pions.movePion(id, arrive.x, arrive.y)
    display.refreshPions()
    return arrive
  })
  /* Le pion qui ne paraît que sous un regard : la table le filtre elle-même. */
  on('pions:regard', (id: number, on: boolean) => {
    pions.setRegard(id, on)
    return display.refreshPions()
  })
  on('pions:remove', (id: number) => {
    pions.removePion(id)
    return display.refreshPions()
  })
  on('pions:clear', (placeId: number) => {
    const n = pions.clearPions(placeId)
    display.refreshPions()
    return n
  })
  /* La caméra de la table : elle vit dans l'état de diffusion, pas dans le
     cadrage de la diapositive — voir `focusPionId`. */
  on('pions:focus', (id: number | null) => display.setFocusPion(id))
  on('pions:size', (placeId: number, size: number) => {
    pions.setPionSize(placeId, size)
    return display.refreshPions()
  })
  /* L'échelle d'un plan : la lire, la fixer au trait, et dire si les pions la
     suivent. Chaque changement rediffuse la taille des pions. */
  on('places:echelle', (placeId: number) => echelle.echelleDe(placeId))
  on('places:etalonner', (placeId: number, metres: number | null) => {
    const e = echelle.etalonner(placeId, metres)
    display.refreshPions()
    return e
  })
  on('pions:main', (placeId: number, main: boolean) => {
    const e = echelle.poserPionMain(placeId, main)
    display.refreshPions()
    return e
  })
  on('pions:allure', (placeId: number, allure: number | null) => {
    const e = echelle.poserAllure(placeId, allure)
    display.refreshPions()
    return e
  })

  /** Le pointeur : flux léger, sans rediffuser tout l'état. */
  ipcMain.on('display:pointer', (_e, p: { x: number; y: number } | null) => display.setPointer(p))
}
