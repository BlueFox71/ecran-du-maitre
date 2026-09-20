import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import { cheminIcone } from './icone'
import { getPion, initialsOf, listPionsVus, pionSize } from './db/repos/pions'
import { listJoueurs, listTemplates } from './db/repos/characters'
import { getItem } from './db/repos/library'
import { mediaUrl } from './vault'
import { COLLAGE_CELLS, ENCART_NEUF, jaugeSanite } from '@shared/types'
import type {
  AudioState,
  CollageCell,
  CollageLayout,
  DisplayState,
  Frame,
  Pointer,
  ScreenInfo,
  Transition,
  Encart,
  JaugeVue,
  JoueurVu,
  SlidePayload,
  TextOverlay,
  MobilePing
} from '@shared/types'

const BLACK: SlidePayload = { type: 'black' }

const state: DisplayState = {
  slide: BLACK,
  slots: [BLACK, BLACK],
  liveSlot: 0,
  transition: null,
  pendingPlaceId: null,
  previous: null,
  frozen: false,
  frozenView: null,
  calqueRev: 0,
  pionLabels: true,
  pionPv: false,
  encart: ENCART_NEUF,
  joueurs: [],
  audio: { itemId: null, url: null, title: null, playing: false, loop: true, volume: 0.35 },
  outputDisplayId: null,
  playerOpen: false,
  qr: null,
  placeId: null,
  pions: [],
  pionSize: 6,
  focusPionId: null,
  pointer: null
}

let playerWindow: BrowserWindow | null = null
let mjWindow: BrowserWindow | null = null

export function bindMjWindow(w: BrowserWindow): void {
  mjWindow = w
}

/* ---------------- écrans ---------------- */

export function listScreens(): ScreenInfo[] {
  const primary = screen.getPrimaryDisplay()
  return screen.getAllDisplays().map((d, i) => ({
    id: d.id,
    label: d.label || `Écran ${i + 1}`,
    // On annonce la résolution physique : c'est celle que l'utilisateur reconnaît.
    width: Math.round(d.size.width * d.scaleFactor),
    height: Math.round(d.size.height * d.scaleFactor),
    primary: d.id === primary.id,
    scaleFactor: d.scaleFactor
  }))
}

/** Écran de diffusion : celui choisi, sinon le premier écran secondaire, sinon le principal. */
function targetDisplay(): Electron.Display {
  const all = screen.getAllDisplays()
  if (state.outputDisplayId != null) {
    const found = all.find((d) => d.id === state.outputDisplayId)
    if (found) return found
  }
  const primary = screen.getPrimaryDisplay()
  return all.find((d) => d.id !== primary.id) ?? primary
}

export function setOutput(displayId: number | null): DisplayState {
  state.outputDisplayId = displayId
  if (playerWindow && !playerWindow.isDestroyed()) {
    const d = targetDisplay()
    playerWindow.setFullScreen(false)
    playerWindow.setBounds(d.bounds)
    playerWindow.setFullScreen(true)
  }
  broadcast()
  return state
}

/* ---------------- fenêtre joueurs ---------------- */

function playerUrl(): { url?: string; file?: string } {
  if (process.env.ELECTRON_RENDERER_URL) {
    return { url: `${process.env.ELECTRON_RENDERER_URL}/player.html` }
  }
  return { file: join(__dirname, '../renderer/player.html') }
}

export function openPlayer(): DisplayState {
  if (playerWindow && !playerWindow.isDestroyed()) {
    playerWindow.show()
    playerWindow.focus()
    state.playerOpen = true
    broadcast()
    return state
  }

  const d = targetDisplay()
  playerWindow = new BrowserWindow({
    x: d.bounds.x,
    y: d.bounds.y,
    width: d.bounds.width,
    height: d.bounds.height,
    frame: false,
    fullscreen: true,
    backgroundColor: '#040708',
    autoHideMenuBar: true,
    title: 'Écran joueurs',
    icon: cheminIcone(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      backgroundThrottling: false
    }
  })

  playerWindow.setMenuBarVisibility(false)
  // Le curseur n'a rien à faire sur l'écran des joueurs.
  playerWindow.webContents.on('did-finish-load', () => {
    playerWindow?.webContents.insertCSS('*{cursor:none !important}')
    broadcast()
  })
  playerWindow.on('closed', () => {
    playerWindow = null
    state.playerOpen = false
    broadcast()
  })

  const target = playerUrl()
  if (target.url) playerWindow.loadURL(target.url)
  else playerWindow.loadFile(target.file!)

  state.playerOpen = true
  return state
}

export function closePlayer(): DisplayState {
  if (playerWindow && !playerWindow.isDestroyed()) playerWindow.close()
  playerWindow = null
  state.playerOpen = false
  broadcast()
  return state
}

export function togglePlayer(): DisplayState {
  return state.playerOpen ? closePlayer() : openPlayer()
}

/* ---------------- diffusion ---------------- */

export function getState(): DisplayState {
  return state
}

/** L'emplacement libre : celui qui n'est pas à l'antenne. */
const idle = (): 0 | 1 => (state.liveSlot === 0 ? 1 : 0)

function sync(): void {
  state.slide = state.slots[state.liveSlot]
}

/**
 * Les textes posés sur un emplacement lui survivent : ils décrivent l'écran
 * qu'on compose, pas l'image qui s'y trouve à cet instant. On feuillette les
 * cartes, les cartouches restent ; seul « Supprimer » les enlève.
 */
function garderTextes(neuf: SlidePayload, avant: SlidePayload): SlidePayload {
  return avant.texts?.length ? { ...neuf, texts: avant.texts } : neuf
}

/** Envoie tout de suite à l'écran, sans passer par la préparation. */
export function show(slide: SlidePayload): DisplayState {
  if (state.frozen) return state
  if (slide.type !== 'black') state.previous = state.slide
  state.slots[state.liveSlot] = garderTextes(slide, state.slots[state.liveSlot])
  sync()
  broadcast()
  return state
}

/** Charge l'emplacement en préparation : rien ne bouge pour les joueurs. */
export function prepare(slide: SlidePayload): DisplayState {
  state.slots[idle()] = garderTextes(slide, state.slots[idle()])
  broadcast()
  return state
}

/**
 * Change la disposition de l'emplacement en préparation. Ce qui y était déjà
 * reste en place tant qu'il y a des cases pour l'accueillir : on essaie une
 * disposition, on revient en arrière, rien n'est perdu.
 */
export function prepareLayout(layout: CollageLayout): DisplayState {
  const n = COLLAGE_CELLS[layout]
  const cur = state.slots[idle()]
  const avant: (CollageCell | null)[] =
    cur.type === 'collage'
      ? cur.cells
      : cur.type === 'image'
        ? [{ kind: 'image', itemId: cur.itemId, url: cur.url, title: cur.title, frame: cur.frame }]
        : []
  // Exactement `n` cases, sans trou : une disposition ne dessine jamais plus de
  // cases qu'elle n'en annonce.
  const kept = Array.from({ length: n }, (_, i) => avant[i] ?? null)

  /* À une seule case, un collage d'image redevient une image plein écran : ce
     n'est plus un collage, et l'appeler ainsi compliquerait tout le reste.

     Deux cases échappent à ce repli, parce qu'elles portent quelque chose
     qu'une image plein écran ne sait pas porter : une case de **texte**, et une
     image **légendée** — la légende appartient à la case, et se replier la
     ferait disparaître sans un mot. */
  const seule = kept[0]
  state.slots[idle()] = garderTextes(
    n === 1 && (!seule || (seule.kind === 'image' && !seule.caption?.trim()))
      ? seule
        ? {
            type: 'image',
            itemId: seule.itemId,
            url: seule.url,
            title: seule.title,
            frame: seule.frame
          }
        : { type: 'black' }
      : { type: 'collage', layout, cells: kept },
    cur
  )
  broadcast()
  return state
}

/** Pose une image dans une case du collage en préparation, ou la vide. */
export function prepareCell(index: number, cell: CollageCell | null): DisplayState {
  const cur = state.slots[idle()]
  if (cur.type !== 'collage') {
    state.slots[idle()] = garderTextes(
      !cell
        ? { type: 'black' }
        : cell.kind === 'image'
          ? { type: 'image', itemId: cell.itemId, url: cell.url, title: cell.title }
          : { type: 'collage', layout: '1', cells: [cell] },
      cur
    )
  } else {
    const n = COLLAGE_CELLS[cur.layout]
    // Une case hors de la disposition n'existe pas : on ne l'invente pas.
    if (!Number.isInteger(index) || index < 0 || index >= n) return state
    const cells = Array.from({ length: n }, (_, i) => cur.cells[i] ?? null)
    cells[index] = cell
    state.slots[idle()] = { ...cur, cells }
  }
  broadcast()
  return state
}

/**
 * Écrire dans une case du collage en préparation : la légende sous une image,
 * ou le texte d'une case qui n'en porte pas.
 *
 * Les deux passent par la même porte parce qu'ils posent le même problème :
 * on écrit lettre à lettre, et l'écran des joueurs ne doit pas voir la phrase
 * se composer. La temporisation est du côté de la régie, comme pour les textes
 * libres ; ici on ne fait que ranger ce qui arrive.
 */
export function ecrireCase(
  index: number,
  quoi: { caption?: string } | { texte: string; color?: string }
): DisplayState {
  const cur = state.slots[idle()]
  if (cur.type !== 'collage') return state
  const n = COLLAGE_CELLS[cur.layout]
  if (!Number.isInteger(index) || index < 0 || index >= n) return state

  const cells = Array.from({ length: n }, (_, i) => cur.cells[i] ?? null)
  const c = cells[index]

  if ('texte' in quoi) {
    /* Écrire dans une case remplace ce qu'elle portait : une image et un texte
       dans la même case, ce seraient deux cases. Vider le texte vide la case.
       La couleur se garde d'une frappe à l'autre : on la choisit une fois. */
    const encre = quoi.color ?? (c?.kind === 'texte' ? c.color : undefined)
    cells[index] = quoi.texte.trim() ? { kind: 'texte', texte: quoi.texte, color: encre } : null
  } else {
    // Une légende sans image n'a rien à légender.
    if (c?.kind !== 'image') return state
    cells[index] = { ...c, caption: quoi.caption }
  }

  state.slots[idle()] = { ...cur, cells }
  broadcast()
  return state
}

/**
 * Recadre une image : celle d'une case du collage, ou l'image plein écran.
 * S'applique à l'emplacement qu'on est en train de regarder — on corrige un
 * cadrage aussi bien en préparant qu'en direct.
 */
export function frameImage(
  slot: 'prep' | 'live',
  cell: number | null,
  frame: Frame
): DisplayState {
  const which = slot === 'live' ? state.liveSlot : idle()
  const cur = state.slots[which]

  if (cur.type === 'collage' && cell != null) {
    const cells = [...cur.cells]
    const c = cells[cell]
    // Une case de texte n'a pas d'image à recadrer.
    if (!c || c.kind !== 'image') return state
    cells[cell] = { ...c, frame }
    state.slots[which] = { ...cur, cells }
  } else if (cur.type === 'image' || cur.type === 'video') {
    // Une vidéo se recadre comme une image : même cadre, mêmes gestes.
    state.slots[which] = { ...cur, frame }
  } else {
    return state
  }

  sync()
  broadcast()
  return state
}

/**
 * Remplace les textes de l'emplacement qu'on regarde. La régie envoie toujours
 * la liste entière : ajouter, modifier, déplacer et supprimer passent par le
 * même appel, et l'ordre d'empilement est celui de la liste.
 */
export function setTexts(slot: 'prep' | 'live', texts: TextOverlay[]): DisplayState {
  const which = slot === 'live' ? state.liveSlot : idle()
  const cur = state.slots[which]

  if (texts.length) {
    state.slots[which] = { ...cur, texts }
  } else {
    const copie = { ...cur }
    delete copie.texts
    state.slots[which] = copie
  }

  sync()
  broadcast()
  return state
}

let transitionSeq = 1

/**
 * Bascule d'un emplacement à l'autre.
 *
 * `ms` à 0 coupe net — c'est le bouton « Couper », et le mode n'a alors rien à
 * dire. Sinon la fenêtre joueurs enchaîne de la manière demandée : elle seule
 * sait le faire, parce qu'elle seule tient les deux images en même temps.
 */
export function swap(ms = 800, mode: Transition = 'fondu'): DisplayState {
  if (state.frozen) return state
  state.previous = state.slide
  state.liveSlot = idle()
  state.transition = { id: transitionSeq++, ms, mode }
  sync()
  // Le lieu préparé prend effet en même temps que son image : les pions ne
  // se posent jamais sur la carte du lieu précédent.
  if (state.pendingPlaceId != null) {
    state.placeId = state.pendingPlaceId
    state.pendingPlaceId = null
    refreshPions()
    return state
  }
  broadcast()
  return state
}

export function blackout(): DisplayState {
  if (state.frozen) return state
  if (state.slide.type === 'black') {
    state.slots[state.liveSlot] = state.previous ?? BLACK
    state.previous = null
  } else {
    state.previous = state.slide
    state.slots[state.liveSlot] = BLACK
  }
  sync()
  broadcast()
  return state
}


/**
 * Gèle l'écran joueurs. Le gel ne se contente pas de refuser trois gestes :
 * il **ferme la porte de sortie**. On garde sous la main ce que les joueurs
 * voyaient à cet instant, pour que le moniteur du rail continue de dire vrai.
 */
export function setFrozen(on: boolean): DisplayState {
  state.frozen = on
  state.frozenView = on
    ? {
        slide: state.slide,
        pions: state.pions,
        pionSize: state.pionSize,
        focusPionId: state.focusPionId
      }
    : null
  broadcast()
  return state
}

/** Le nom du joueur sous son pion : à la table, tout le monde ne le connaît pas. */
export function setPionLabels(on: boolean): DisplayState {
  state.pionLabels = on
  broadcast()
  return state
}

export function setPionPv(on: boolean): DisplayState {
  state.pionPv = on
  refreshJoueurs()
  return state
}

export function setEncart(patch: Partial<Encart>): DisplayState {
  state.encart = { ...state.encart, ...patch }
  refreshJoueurs()
  return state
}

/**
 * Relit les personnages joueurs pour l'écran. À rappeler après tout ce qui
 * touche une fiche — un point de vie perdu doit se voir tout de suite.
 *
 * Les points de vie viennent de la **première jauge du gabarit** : c'est la
 * convention des trois gabarits livrés, et elle évite d'inventer un champ
 * « c'est celle-ci la vie » que personne ne penserait à remplir.
 */
export function refreshJoueurs(): DisplayState {
  const gabarits = listTemplates()
  /* Les personnages **joueurs**, et eux seuls : un PNJ a la même fiche et le
     même pion, mais il n'a rien à faire dans l'encart de la table. */
  state.joueurs = listJoueurs().map((c): JoueurVu => {
    const spec = gabarits.find((t) => t.id === c.templateId)?.spec
    const jauges = spec?.gauges ?? []
    const vue = (g: (typeof jauges)[number] | undefined): JaugeVue | null => {
      if (!g) return null
      const j = c.data.gauges[g.key]
      return j ? { key: g.key, value: j.value, max: j.max, label: g.label } : null
    }
    /* C'est la fiche de campagne qui dit laquelle est la santé mentale ; un
       gabarit qui n'en a pas — D&D — n'affiche simplement pas de cerveau. */
    const portrait = c.portraitItemId != null ? getItem(c.portraitItemId) : null
    return {
      id: c.id,
      name: c.name,
      color: c.color,
      url: mediaUrl(portrait?.relPath ?? null),
      initials: initialsOf(c.name),
      pv: vue(jauges[0]),
      sm: vue(spec ? jaugeSanite(spec, jauges) : undefined)
    }
  })
  broadcast()
  return state
}

export function setAudio(patch: Partial<AudioState>): DisplayState {
  state.audio = { ...state.audio, ...patch }
  broadcast()
  return state
}


/* ---------------- lieu en scène et pions ---------------- */

/** Le lieu porte les pions : en changer, c'est changer de plateau. */
export function setPlace(placeId: number | null): DisplayState {
  state.placeId = placeId
  state.pendingPlaceId = null
  refreshPions()
  return state
}

/** Prépare un lieu : il ne prendra effet qu'à la bascule. */
export function preparePlace(placeId: number | null): DisplayState {
  state.pendingPlaceId = placeId
  broadcast()
  return state
}

/**
 * Suivre un pion — ou lâcher celui qu'on suivait.
 *
 * On ne vérifie pas ici qu'il existe : le MJ le désigne depuis un jeton qu'il
 * a sous les yeux. C'est en le perdant de vue que la consigne tombe.
 */
export function setFocusPion(id: number | null): DisplayState {
  state.focusPionId = id
  broadcast()
  return state
}

/** À rappeler après toute modification de pions : l'état vit ici, pas ailleurs. */
export function refreshPions(): DisplayState {
  /* Les pions vus, et eux seuls. Un pion caché n'entre pas dans l'état de
     diffusion : ni la fenêtre joueurs ni les téléphones ne peuvent donc
     l'afficher, et le moniteur du rail continue de dire vrai. La Régie et le
     Pupitre, eux, travaillent sur `pions:of`, qui les rend tous. */
  state.pions = listPionsVus(state.placeId)
  state.pionSize = pionSize(state.placeId)
  /*
   * On ne suit que ce qui est encore là. Le pion retiré, ou resté dans le lieu
   * d'avant, lâche la caméra : mieux vaut un plan large qu'un écran zoomé sur
   * un absent. Un pion seulement caché aux joueurs, lui, reste suivi — on le
   * cherche donc dans la table et non dans `state.pions`, qui ne garde que les
   * pions vus. Suivre une ombre qui approche est un plan, pas un accident.
   */
  if (state.focusPionId != null) {
    const suivi = getPion(state.focusPionId)
    if (!suivi || suivi.placeId !== state.placeId) state.focusPionId = null
  }
  broadcast()
  return state
}

/**
 * Le pointeur ne passe pas par l'état complet : il bouge des dizaines de fois
 * par seconde, on ne va pas rediffuser toute la régie à chaque frémissement.
 */
export function setPointer(p: Pointer | null): void {
  state.pointer = p
  /* Le pointeur a son propre canal : il lui faut donc sa propre porte fermée. */
  for (const w of [mjWindow, state.frozen ? null : playerWindow]) {
    if (w && !w.isDestroyed()) w.webContents.send('display:pointer', p)
  }
}

/* ---------------- diffusion de l'état ---------------- */

/**
 * Ce qu'on prévient après chaque diffusion, en plus des fenêtres : les
 * téléphones des joueurs. C'est un abonnement plutôt qu'un appel direct —
 * `mobile` a besoin de `display`, l'inverse ferait un cercle.
 */
let apres: (() => void) | null = null
export function onBroadcast(f: () => void): void {
  apres = f
}

/**
 * Une lampe ou une porte vient de changer : l'écran des joueurs doit relire.
 *
 * On ne pousse pas le calque lui-même — on dit seulement qu'il a bougé, et
 * chaque fenêtre va le rechercher. Un entier suffit à réveiller tout le monde.
 */
export function calqueABouge(): void {
  state.calqueRev++
  broadcast()
}

export function broadcast(): void {
  const payload = JSON.parse(JSON.stringify(state)) as DisplayState
  /*
   * Le gel se tient ici, au seuil, et non dans chaque fonction : c'est le seul
   * endroit qu'on ne peut pas oublier. Avant, `swap`, `blackout` et le fondu
   * se gardaient eux-mêmes, mais un pion déplacé, un lieu diffusé, un texte
   * écrit ou le pointeur passaient quand même — le gel n'en était pas un.
   */
  for (const w of [mjWindow, state.frozen ? null : playerWindow]) {
    if (w && !w.isDestroyed()) w.webContents.send('display:state', payload)
  }
  /* Les portables suivent : ils montrent le lieu réellement à l'écran, pions
     compris, et doivent donc changer en même temps que lui. */
  apres?.()
}

/**
 * Tendre le QR d'appairage aux joueurs, ou le retirer.
 *
 * Il se pose par-dessus la diapositive en cours sans la remplacer : la scène
 * reste où elle en était, et le code s'efface sans avoir rien coûté. Écran
 * gelé, il n'arrive pas — comme le reste, et c'est bien le sens du gel.
 */
export function setQr(qr: DisplayState['qr']): DisplayState {
  state.qr = qr
  broadcast()
  return state
}

/**
 * Envoie une onde aux deux écrans. Comme le pointeur, elle ne traverse pas le
 * gel : ce que les joueurs voient pendant un gel est ce qu'ils voyaient avant.
 */
export function sendPing(p: MobilePing): void {
  for (const w of [mjWindow, state.frozen ? null : playerWindow]) {
    if (w && !w.isDestroyed()) w.webContents.send('display:ping', p)
  }
}

/** Rebranche la fenêtre joueurs quand l'utilisateur débranche ou rebranche un écran. */
export function watchScreens(): void {
  const relocate = (): void => {
    if (playerWindow && !playerWindow.isDestroyed()) {
      const d = targetDisplay()
      playerWindow.setFullScreen(false)
      playerWindow.setBounds(d.bounds)
      playerWindow.setFullScreen(true)
    }
    if (mjWindow && !mjWindow.isDestroyed()) mjWindow.webContents.send('display:screens', listScreens())
  }
  screen.on('display-added', relocate)
  screen.on('display-removed', relocate)
  screen.on('display-metrics-changed', relocate)
}
