import { create } from 'zustand'
import {
  CAMPAGNE_DEFAUT,
  POSTE_DEFAUT,
  enChaine,
  lireCampagne,
  lirePoste,
  type Brut,
  type ReglagesCampagne,
  type ReglagesPoste
} from '@shared/reglages'
import type { UiFolder, UiItem } from '../../../preload/index'
import type {
  Beat,
  CampaignPlayer,
  CarnetPlayer,
  Chapter,
  Character,
  CharacterLogEntry,
  DisplayState,
  GameSession,
  LibraryRoot,
  MobileInfo,
  MobileNudge,
  Objet,
  ObjetFamille,
  Place,
  PochetteDoc,
  PochetteOnglet,
  ProjectInfo,
  RecentProject,
  Roll,
  ScreenInfo,
  SheetTemplate,
  Transition
} from '@shared/types'

export type ViewId =
  | 'regie'
  | 'pupitre'
  | 'lib'
  | 'editor'
  | 'places'
  | 'objets'
  | 'timeline'
  | 'sheets'
  | 'pochette'
  | 'dice'

interface Toast {
  id: number
  msg: string
  error?: boolean
}

interface State {
  ready: boolean
  view: ViewId
  toasts: Toast[]

  /**
   * Le projet ouvert, ou `null` : dans ce cas l'application montre l'accueil
   * et rien d'autre n'est chargé — il n'y a pas de base à interroger.
   */
  project: ProjectInfo | null
  recents: RecentProject[]
  campaign: { id: number; name: string; system: string | null } | null
  version: string

  display: DisplayState | null
  screens: ScreenInfo[]
  /**
   * Le visuel qu'on arrange — Visuel 1 ou Visuel 2. Il vit ici, et non dans la
   * Régie ou dans le Pupitre, pour deux raisons : on passe de l'un à
   * l'autre en cours de partie et on doit retrouver l'écran qu'on était en
   * train de composer, et quitter la page ne doit pas défaire ce choix. Il
   * n'est posé qu'une fois, à l'ouverture de la campagne, sur le visuel libre.
   */
  visuel: 0 | 1

  /**
   * La manière de basculer — fondu, volet, par le noir. Elle vit ici, comme
   * `visuel`, parce que la Régie et le Pupitre basculent tous les deux et
   * doivent le faire de la même façon : c'est un réglage de la table de
   * mixage, pas de la page qu'on regarde.
   *
   * Elle part de ce que les paramètres ont retenu, et y retourne dès qu'on en
   * change : la bascule qu'on préfère est la même d'une soirée à l'autre.
   */
  transition: Transition

  /**
   * Les réglages, relus et sûrs — la campagne d'un côté, le poste de l'autre.
   *
   * Ils vivent ici plutôt que dans la fenêtre des paramètres parce que c'est
   * l'application entière qui s'en sert : la Régie y prend la durée de son
   * fondu, la Bibliothèque la taille de ses vignettes, les Murs l'angle du
   * regard. La fenêtre ne fait que les écrire.
   */
  reglages: ReglagesCampagne
  poste: ReglagesPoste
  /** Les mêmes, tels que la base les rend : pour savoir ce qui a été posé. */
  reglagesBrut: Brut
  posteBrut: Brut

  chapters: Chapter[]
  root: LibraryRoot | null
  tree: UiFolder[]
  orphans: UiItem[]
  allItems: UiItem[]
  places: Place[]

  /**
   * La réserve : ce qui se trouve, se ramasse, se porte. Elle vit ici plutôt
   * que dans sa page parce que le rail en compte les objets, et parce qu'un
   * butin de PNJ ira y pointer — deux pages pour une même matière.
   */
  objets: Objet[]
  objetFamilles: ObjetFamille[]
  /** Francs, pièces d'or, crédits : l'unité de valeur de la campagne. */
  uniteValeur: string
  currentObjetId: number | null

  session: GameSession | null
  sessions: GameSession[]
  beats: Beat[]
  activeBeatId: number | null

  annexes: UiItem[]

  /**
   * La pochette — ce que les joueurs ont en main sur leur téléphone. Elle vit
   * ici plutôt que dans sa page : le rail en affiche le compte, et le
   * téléphone qui ouvre un document fait bouger la page du MJ sans qu'il ait
   * rien touché.
   */
  pochette: PochetteDoc[]
  pochetteOnglets: PochetteOnglet[]

  /** Le serveur des portables, ses appareils, et qui remue son pion. */
  mobile: MobileInfo | null
  mobileNudges: MobileNudge[]
  /**
   * Les jets qui viennent d'arriver d'un téléphone. Ils ne passent pas par
   * `toast`, qui ne montre que les ratés : ceci n'est pas la confirmation d'un
   * geste du MJ, c'est une nouvelle de la table, et elle doit se voir.
   */
  mobileRolls: { id: number; nom: string; texte: string; couleur: string | null }[]

  templates: SheetTemplate[]
  /** La fiche de la campagne : une seule, suivie par tous les personnages. */
  sheet: SheetTemplate | null
  characters: Character[]
  currentCharacterId: number | null
  charLog: CharacterLogEntry[]

  /** Les personnes autour de la table, et le carnet où on va les chercher. */
  players: CampaignPlayer[]
  carnet: CarnetPlayer[]

  rolls: Roll[]
  /** Les derniers jets retirés du journal, du plus récemment jeté au plus ancien. */
  rollTrash: Roll[]
  rollStats: { total: number; judged: number; success: number; fumble: number; rate: number }

  /** Document ouvert dans l'éditeur. */
  editingItemId: number | null

  setView: (v: ViewId) => void
  setVisuel: (v: 0 | 1) => void
  setTransition: (t: Transition) => void
  /** Écrit un réglage de la campagne. `null` l'efface et rend son défaut. */
  poserReglage: (cle: string, valeur: boolean | number | string | null) => Promise<void>
  /** Écrit un réglage du poste. */
  poserPoste: (cle: string, valeur: boolean | number | string | null) => Promise<void>
  refreshReglages: () => Promise<void>
  toast: (msg: string, error?: boolean) => void
  dismissToast: (id: number) => void

  boot: () => Promise<void>
  refreshLibrary: () => Promise<void>
  refreshPlaces: () => Promise<void>
  refreshObjets: () => Promise<void>
  setCurrentObjet: (id: number | null) => void
  refreshTimeline: () => Promise<void>
  refreshAnnexes: () => Promise<void>
  refreshPochette: () => Promise<void>
  setPochette: (p: { onglets: PochetteOnglet[]; docs: PochetteDoc[] }) => void
  refreshCharacters: () => Promise<void>
  refreshPlayers: () => Promise<void>
  refreshMobile: () => Promise<void>
  setMobile: (m: MobileInfo) => void
  refreshRecents: () => Promise<void>
  refreshRolls: () => Promise<void>
  loadCharLog: (id: number) => Promise<void>
  openInEditor: (itemId: number) => void
  setActiveBeat: (id: number | null) => void
  setCurrentCharacter: (id: number) => void
}

let toastSeq = 1

export const useStore = create<State>((set, get) => ({
  ready: false,
  view: 'regie',
  toasts: [],

  project: null,
  recents: [],
  campaign: null,
  version: '',

  display: null,
  screens: [],
  visuel: 1,
  transition: CAMPAGNE_DEFAUT.basculeMode,

  reglages: CAMPAGNE_DEFAUT,
  poste: POSTE_DEFAUT,
  reglagesBrut: {},
  posteBrut: {},

  chapters: [],
  root: null,
  tree: [],
  orphans: [],
  allItems: [],
  places: [],

  objets: [],
  objetFamilles: [],
  uniteValeur: 'pièces',
  currentObjetId: null,

  session: null,
  sessions: [],
  beats: [],
  activeBeatId: null,

  annexes: [],

  pochette: [],
  pochetteOnglets: [],

  mobile: null,
  mobileNudges: [],
  mobileRolls: [],

  templates: [],
  sheet: null,
  characters: [],
  currentCharacterId: null,
  charLog: [],

  players: [],
  carnet: [],

  rolls: [],
  rollTrash: [],
  rollStats: { total: 0, judged: 0, success: 0, fumble: 0, rate: 0 },

  editingItemId: null,

  setView: (v) => set({ view: v }),
  setVisuel: (v) => set({ visuel: v }),
  /* Le geste est immédiat — on arme la bascule et on bascule — et l'écriture
     suit sans qu'on l'attende : une bascule ne se met pas en file d'attente
     derrière un aller-retour vers la base. */
  setTransition: (t) => {
    set({ transition: t })
    void get().poserReglage('bascule.mode', t)
  },

  poserReglage: async (cle, valeur) => {
    const brut = await window.jdr.reglages.poserCampagne(cle, enChaine(valeur))
    const lus = lireCampagne(brut)
    set({ reglagesBrut: brut, reglages: lus, transition: lus.basculeMode })
  },

  poserPoste: async (cle, valeur) => {
    const brut = await window.jdr.reglages.poserPoste(cle, enChaine(valeur))
    const lus = lirePoste(brut)
    set({ posteBrut: brut, poste: lus })
    appliquerTheme(lus)
  },

  refreshReglages: async () => {
    const api = window.jdr
    const [brut, brutPoste] = await Promise.all([api.reglages.campagne(), api.reglages.poste()])
    const lus = lireCampagne(brut)
    const poste = lirePoste(brutPoste)
    set({ reglagesBrut: brut, reglages: lus, posteBrut: brutPoste, poste, transition: lus.basculeMode })
    appliquerTheme(poste)
  },

  /**
   * Seuls les ratés s'affichent. Confirmer chaque geste par une étiquette en
   * bas de l'écran ne rassurait personne : l'interface montre déjà ce qui a
   * changé. Ce qui a échoué, en revanche, doit se voir.
   */
  toast: (msg, error) => {
    if (!error) return
    const id = toastSeq++
    set((s) => ({ toasts: [...s.toasts, { id, msg, error }] }))
    setTimeout(() => get().dismissToast(id), 4000)
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  boot: async () => {
    const api = window.jdr
    const [project, info] = await Promise.all([api.project.current(), api.app.info()])
    set({ project, campaign: info.campaign, version: info.version })

    /* Les réglages du poste d'abord, et même sans campagne ouverte : c'est
       d'eux que vient le thème, et l'accueil a une couleur lui aussi. */
    const brutPoste = await api.reglages.poste()
    const poste = lirePoste(brutPoste)
    set({ posteBrut: brutPoste, poste })
    appliquerTheme(poste)

    /* Aucun projet ouvert : l'accueil s'affiche, et on ne va rien chercher
       ailleurs — il n'y a pas de base derrière. */
    if (!project) {
      await get().refreshRecents()
      set({ ready: true })
      return
    }

    const [display, screens] = await Promise.all([api.display.state(), api.display.screens()])
    /* Le seul moment où l'on choisit à sa place : à l'ouverture, on se met sur
       le visuel libre, celui qu'on peut arranger. Ensuite c'est à lui, et ni
       une bascule ni un changement de page n'y touchent. */
    set({ display, screens, visuel: display.liveSlot === 0 ? 1 : 0 })

    api.display.onState((d) => set({ display: d }))
    api.display.onScreens((s) => set({ screens: s }))
    // Le dossier de campagne a bougé sur le disque : on relit la bibliothèque.
    api.library.onChanged(() => {
      void get().refreshLibrary()
      void get().refreshAnnexes()
      /* Un fichier effacé du disque disparaît de la pochette par cascade : la
         page doit le perdre aussi, sans quoi elle montrerait une carte vide. */
      void get().refreshPochette()
    })
    /* Un joueur vient d'ouvrir un document sur son téléphone. */
    api.pochette.onChanged(() => void get().refreshPochette())
    /* Un joueur vient de ranger une de ses affaires depuis son téléphone : la
       réserve du MJ et sa poupée d'équipement doivent le montrer tout de suite. */
    /* Garde-fou : le pont n'expose `onChanged` que depuis la réserve d'objets,
       et un pont plus ancien que l'interface faisait planter tout le magasin —
       la campagne restait en « ouverture » pour toujours. */
    api.objets.onChanged?.(() => void get().refreshObjets())

    await Promise.all([
      get().refreshReglages(),
      get().refreshLibrary(),
      get().refreshPlaces(),
      get().refreshObjets(),
      get().refreshTimeline(),
      get().refreshCharacters(),
      get().refreshPlayers(),
      get().refreshRecents(),
      get().refreshAnnexes(),
      get().refreshPochette(),
      get().refreshRolls()
    ])
    set({ ready: true })
  },

  refreshLibrary: async () => {
    const api = window.jdr
    const [chapters, treeRes, root, allItems] = await Promise.all([
      api.chapters.list(),
      api.folders.tree(),
      api.library.root(),
      api.items.list({})
    ])
    set({ chapters, tree: treeRes.tree, orphans: treeRes.orphans, root, allItems })
  },

  refreshPlaces: async () => set({ places: await window.jdr.places.list() }),

  /**
   * La réserve entière d'un coup — objets, rayons, unité. Chaque geste la
   * repose telle quelle plutôt que d'aller recoudre une ligne dans un tableau :
   * poser un objet change sa fiche *et* le compte du rail.
   */
  refreshObjets: async () => {
    const r = await window.jdr.objets.list()
    const cur = get().currentObjetId
    set({
      objets: r.objets,
      objetFamilles: r.familles,
      uniteValeur: r.unite,
      currentObjetId: r.objets.some((o) => o.id === cur) ? cur : (r.objets[0]?.id ?? null)
    })
  },

  setCurrentObjet: (id) => set({ currentObjetId: id }),

  refreshAnnexes: async () => set({ annexes: await window.jdr.annexes.list() }),

  refreshPochette: async () => get().setPochette(await window.jdr.pochette.list()),

  /* Chaque geste de la pochette rend la pochette entière : on la repose telle
     quelle plutôt que d'aller recoudre une ligne dans un tableau. */
  setPochette: (p) => set({ pochette: p.docs, pochetteOnglets: p.onglets }),

  refreshTimeline: async () => {
    const api = window.jdr
    const [session, sessions, beats] = await Promise.all([
      api.timeline.currentSession(),
      api.timeline.sessions(),
      api.timeline.beats()
    ])
    const active = get().activeBeatId
    const stillThere = beats.some((b) => b.id === active)
    set({
      session,
      sessions,
      beats,
      activeBeatId: stillThere ? active : (beats.find((b) => !b.done)?.id ?? beats[0]?.id ?? null)
    })
  },

  refreshCharacters: async () => {
    const api = window.jdr
    const [templates, sheet, characters] = await Promise.all([
      api.templates.list(),
      api.sheet.get(),
      api.characters.list()
    ])
    const cur = get().currentCharacterId
    const id = characters.some((c) => c.id === cur) ? cur : (characters[0]?.id ?? null)
    set({ templates, sheet, characters, currentCharacterId: id })
    if (id) await get().loadCharLog(id)
    else set({ charLog: [] })
  },

  /**
   * Les joueurs touchent aux fiches — le nom et la couleur d'un personnage
   * suivent la personne qui le mène — donc on relit les deux ensemble.
   */
  refreshPlayers: async () => {
    const api = window.jdr
    const [players, carnet, characters] = await Promise.all([
      api.players.list(),
      api.players.carnet(),
      api.characters.list()
    ])
    set({ players, carnet, characters })
  },

  refreshRecents: async () => set({ recents: await window.jdr.project.recents() }),

  refreshMobile: async () => set({ mobile: await window.jdr.mobile.info() }),
  setMobile: (m) => set({ mobile: m }),

  refreshRolls: async () => {
    const api = window.jdr
    const [rolls, rollTrash, rollStats] = await Promise.all([
      api.rolls.list(),
      api.rolls.trashList(),
      api.rolls.stats()
    ])
    set({ rolls, rollTrash, rollStats })
  },

  loadCharLog: async (id) => set({ charLog: await window.jdr.characters.log(id) }),

  openInEditor: (itemId) => set({ editingItemId: itemId, view: 'editor' }),
  setActiveBeat: (id) => set({ activeBeatId: id }),
  setCurrentCharacter: (id) => {
    set({ currentCharacterId: id })
    void get().loadCharLog(id)
  }
}))

/**
 * Le thème se pose sur la racine du document : toute la feuille de style est
 * bâtie sur `[data-theme]`, et le clair y dormait depuis le début sans que
 * personne puisse l'allumer.
 */
function appliquerTheme(p: ReglagesPoste): void {
  document.documentElement.dataset.theme = p.theme === 'clair' ? 'light' : 'dark'
}

/* ---------------- sélecteurs utilitaires ---------------- */

export function itemById(items: UiItem[], id: number | null): UiItem | null {
  if (id == null) return null
  return items.find((i) => i.id === id) ?? null
}

export function currentCharacter(s: State): Character | null {
  return s.characters.find((c) => c.id === s.currentCharacterId) ?? null
}

/**
 * La fiche d'un personnage — c'est celle de la campagne, la même pour tous.
 * Le paramètre `c` ne sert plus qu'à distinguer « pas de personnage » de
 * « personnage sans fiche », que les appelants traitent pareil.
 */
export function templateOf(s: State, c: Character | null): SheetTemplate | null {
  if (!c) return null
  return s.sheet ?? s.templates.find((t) => t.id === c.templateId) ?? null
}

/** Combien de compétences ce personnage a prises, et combien il peut en prendre. */
export function skillCount(s: State, c: Character | null): { pris: number; max: number | null } {
  const max = s.sheet?.spec.skillLimit ?? null
  return { pris: c ? Object.keys(c.data.skills).length : 0, max: max && max > 0 ? max : null }
}

/** L'objet ouvert dans la réserve. */
export function currentObjet(s: State): Objet | null {
  return s.objets.find((o) => o.id === s.currentObjetId) ?? null
}

export function activeBeat(s: State): Beat | null {
  return s.beats.find((b) => b.id === s.activeBeatId) ?? null
}

/** La personne qui mène ce personnage, s'il en a une. */
export function playerOf(s: State, characterId: number | null): CampaignPlayer | null {
  if (characterId == null) return null
  return s.players.find((p) => p.characterId === characterId) ?? null
}
