import { BrowserWindow, app, dialog, ipcMain, shell } from 'electron'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { activeCampaignId, dataRoot, getDb, isDbOpen } from '../db'
import * as lib from '../db/repos/library'
import * as places from '../db/repos/places'
import * as ouvertures from '../db/repos/ouvertures'
import * as lumieres from '../db/repos/lumieres'
import * as timeline from '../db/repos/timeline'
import * as chars from '../db/repos/characters'
import * as players from '../db/repos/players'
import * as carnet from '../carnet'
import * as mobile from '../mobile'
import * as projet from '../project'
import * as annexes from '../db/repos/annexes'
import * as pochette from '../db/repos/pochette'
import * as annotations from '../db/repos/annotations'
import * as objets from '../db/repos/objets'
import * as murs from '../db/repos/murs'
import * as reglages from '../db/repos/reglages'
import * as rolls from '../db/repos/rolls'
import * as pions from '../db/repos/pions'
import * as display from '../display'
import * as fsLib from '../library'
import * as examen from '../examen'
import { mediaUrl, vignetteUrl } from '../vault'
import { IMPORTABLE, IMAGE_EXT, VIDEO_EXT, AUDIO_EXT } from '../kinds'
import { lireCampagne, type Brut } from '@shared/reglages'
import type {
  CollageLayout,
  ExamenFait,
  Frame,
  Item,
  ItemFilter,
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
    ipcMain.handle(channel, (_e, ...args) => fn(...(args as A)))
  }

  /* ---------------- application ---------------- */

  on('app:info', () => ({
    version: app.getVersion(),
    dataRoot: dataRoot(),
    campaign: isDbOpen()
      ? getDb().prepare(`SELECT id, name, system FROM campaign WHERE id = ?`).get(activeCampaignId())
      : null
  }))
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

  /* ---------------- chapitres ---------------- */

  /* Chaque geste rend la liste entière : les comptes de ce qui s'y rattache
     bougent en même temps que les chapitres, et l'interface les relit d'un
     coup plutôt que d'aller recoudre une ligne. */
  on('chapters:list', () => lib.listChapters())
  on('chapters:create', (title: string) => {
    lib.createChapter(title)
    return lib.listChapters()
  })
  on('chapters:update', (id: number, patch: any) => {
    lib.updateChapter(id, patch)
    return lib.listChapters()
  })
  on('chapters:remove', (id: number) => {
    lib.removeChapter(id)
    return lib.listChapters()
  })
  on('chapters:reorder', (ids: number[]) => {
    lib.reorderChapters(ids)
    return lib.listChapters()
  })

  /* ---------------- dossiers ---------------- */

  on('folders:tree', () => {
    const { tree, orphans } = lib.folderTree()
    const decorate = (nodes: typeof tree): any =>
      nodes.map((n) => ({ ...n, items: withUrls(n.items), children: decorate(n.children) }))
    return { tree: decorate(tree), orphans: withUrls(orphans) }
  })
  on('folders:create', (parentRel: string, name: string) => fsLib.createFolder(parentRel, name))
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
  on('places:get', (id: number) => places.getPlace(id))
  on('places:upsert', (input: any) => places.upsertPlace(input))
  on('places:remove', (id: number) => places.removePlace(id))
  on('places:move', (id: number, parentId: number | null, beforeId: number | null) =>
    places.movePlace(id, parentId, beforeId)
  )
  on('places:zone', (id: number, zone: PointMur[] | null, ancre?: PointMur | null) =>
    places.setZone(id, zone, ancre)
  )
  on('places:regardPortee', (id: number, portee: number | null) =>
    places.setRegardPortee(id, portee)
  )
  on('places:lumGarde', (id: number, garde: boolean) => places.setLumGarde(id, garde))
  on('places:ouvLargeur', (id: number, largeur: number | null) =>
    places.setOuvLargeur(id, largeur)
  )
  on('places:seen', (id: number, seen: boolean) => places.setSeen(id, seen))

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

  /* ---------------- la réserve d'objets ---------------- */
  /* Même isolement que les annotations : aucun de ces canaux ne touche
     `display`, donc ce que le MJ sait d'un objet ne peut pas partir vers la
     fenêtre des joueurs. */

  /* Ce que le MJ range ou donne, les téléphones le voient : un joueur qui
     reçoit un objet doit le trouver dans son sac sans rien toucher. */
  const remue = <T>(v: T): T => {
    mobile.broadcast()
    return v
  }

  on('objets:list', () => ({
    objets: objets.listObjets(),
    familles: objets.listFamilles(),
    unite: objets.uniteValeur()
  }))
  on('objets:add', (input: { nom: string; familleId?: number | null }) => remue(objets.addObjet(input)))
  on('objets:update', (id: number, patch: any) => remue(objets.updateObjet(id, patch)))
  on('objets:copy', (id: number) => remue(objets.copyObjet(id)))
  on('objets:remove', (id: number) => remue(objets.removeObjet(id)))
  on('objets:poser', (input: any) => remue(objets.poser(input)))
  on('objets:placement', (id: number, patch: any) => remue(objets.majPlacement(id, patch)))
  on('objets:reprendre', (id: number) => remue(objets.reprendre(id)))
  /* Équiper : poser un objet sur quelqu'un, à un endroit du corps. Ce canal ne
     touche pas `display` non plus — l'équipement d'un personnage reste chez le
     MJ tant que personne n'a décidé de le montrer. */
  on('objets:equiper', (input: { characterId: number; emplacement: string; objetId: number | null }) =>
    remue(objets.equiper(input))
  )
  on('objets:desequiper', (placementId: number) => remue(objets.desequiper(placementId)))
  /* Faire passer un exemplaire d'une main à l'autre, ou dans une pièce. */
  on('objets:donner', (placementId: number, cible: any) => remue(objets.donner(placementId, cible)))
  on('objets:unite', (unite: string) => objets.setUniteValeur(unite))
  on('objets:familleAdd', (input: any) => objets.addFamille(input))
  on('objets:familleUpdate', (id: number, patch: any) => objets.updateFamille(id, patch))
  on('objets:familleRemove', (id: number) => objets.removeFamille(id))

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
  on('murs:add', (input: any) => murs.addMur(input))
  on('murs:update', (id: number, patch: any) => {
    const m = murs.updateMur(id, patch)
    /* Tirer ou ouvrir un rideau change ce que les joueurs voient : on le leur
       dit. Déplacer un trait, non — le tracé ne regarde que le MJ, et un
       calque rediffusé à chaque point d'une polyligne ferait clignoter la
       table pour rien. */
    if (patch && 'ouvert' in patch) display.calqueABouge()
    return m
  })
  on('murs:remove', (id: number) => murs.removeMur(id))

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
  on('lumieres:add', (input: any) => lumieres.addLumiere(input))
  on('lumieres:update', (id: number, patch: any) => {
    const l = lumieres.updateLumiere(id, patch)
    display.calqueABouge()
    return l
  })
  on('lumieres:remove', (id: number) => lumieres.removeLumiere(id))

  /* ---------------- chronologie ---------------- */

  on('timeline:sessions', () => timeline.listSessions())
  on('timeline:currentSession', () => timeline.currentSession())
  on('timeline:createSession', (label: string, date?: string) => timeline.createSession(label, date))
  on('timeline:setActiveSession', (id: number) => timeline.setActiveSession(id))
  on('timeline:updateSession', (id: number, patch: any) => timeline.updateSession(id, patch))
  on('timeline:deleteSession', (id: number) => timeline.deleteSession(id))
  on('timeline:beats', (sessionId?: number) =>
    timeline.listBeats(sessionId).map((b) => ({ ...b, items: withUrls(b.items) }))
  )
  on('timeline:upsertBeat', (input: any) => {
    const b = timeline.upsertBeat(input)
    return { ...b, items: withUrls(b.items) }
  })
  on('timeline:removeBeat', (id: number) => timeline.removeBeat(id))
  on('timeline:reorderBeats', (ids: number[]) => timeline.reorderBeats(ids))
  on('timeline:attach', (beatId: number, itemId: number) => timeline.attachToBeat(beatId, itemId))
  on('timeline:detach', (beatId: number, itemId: number) => timeline.detachFromBeat(beatId, itemId))

  /* ---------------- documents annexes ---------------- */

  on('annexes:list', () => annexes.listAnnexes().map(withUrl))
  on('annexes:add', (itemId: number) => annexes.addAnnexe(itemId).map(withUrl))
  on('annexes:remove', (itemId: number) => annexes.removeAnnexe(itemId).map(withUrl))
  on('annexes:reorder', (itemIds: number[]) => annexes.reorderAnnexes(itemIds).map(withUrl))

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
  on('pochette:reorderOnglets', (ids: number[]) => {
    pochette.reorderOnglets(ids)
    return pocheEtPousse()
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

  /* ---------------- personnages ---------------- */

  on('characters:list', () => chars.listCharacters())
  on('characters:get', (id: number) => chars.getCharacter(id))
  on('characters:upsert', (input: any) => {
    const c = chars.upsertCharacter(input)
    display.refreshJoueurs()
    return c
  })
  /* Le butin ne bouge que chez le MJ : ni l'écran ni les téléphones n'en
     reçoivent quoi que ce soit, donc rien à rafraîchir de leur côté. */
  on('characters:setButin', (id: number, lignes: any[]) => chars.setButin(id, lignes))
  on('characters:remove', (id: number) => {
    chars.removeCharacter(id)
    display.refreshJoueurs()
  })
  on('characters:adjust', (id: number, key: string, delta: number, reason?: string, maxDelta?: number) => {
    /* Un point de vie perdu doit se voir à l'écran dans la seconde. */
    const r = chars.adjustGauge(id, key, delta, reason, maxDelta ?? 0)
    display.refreshJoueurs()
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
  on('characters:setStat', (id: number, key: string, v: number) => {
    const c = chars.setStat(id, key, v)
    mobile.broadcast()
    return c
  })
  on('characters:setState', (id: number, key: string, on2: boolean) => chars.setState(id, key, on2))
  on('characters:log', (id: number) => chars.characterLog(id))

  /* ---------------- jets ---------------- */

  on('rolls:list', (limit?: number, sessionOnly?: boolean) =>
    rolls.listRolls(limit ?? 300, sessionOnly !== false)
  )
  on('rolls:roll', (req: any) => rolls.addRoll(req))
  on('rolls:record', (req: any) => rolls.recordRoll(req))
  on('rolls:formula', (formula: string, label?: string) => rolls.rollFormula(formula, label))
  on('rolls:stats', () => rolls.rollStats())
  on('rolls:trash', (id: number) => rolls.trashRoll(id))
  on('rolls:restore', (id: number) => rolls.restoreRoll(id))
  on('rolls:trashList', () => rolls.listTrash())
  on('rolls:emptyTrash', () => rolls.emptyTrash())
  on('rolls:clear', () => rolls.clearSessionRolls())
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
    display.setAudio({ itemId, url, title: it.title, playing })
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
  on('display:freeze', (on2: boolean) => display.setFrozen(on2))
  on('display:pionLabels', (on2: boolean) => display.setPionLabels(on2))
  on('display:pionPv', (on2: boolean) => display.setPionPv(on2))
  on('display:encart', (patch: any) => display.setEncart(patch))
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

  /** Le pointeur : flux léger, sans rediffuser tout l'état. */
  ipcMain.on('display:pointer', (_e, p: { x: number; y: number } | null) => display.setPointer(p))
}
