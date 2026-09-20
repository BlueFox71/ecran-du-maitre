import { contextBridge, ipcRenderer } from 'electron'
import type { Brut } from '@shared/reglages'
import type {
  Annotation,
  Encart,
  Beat,
  ButinLigne,
  CampaignPlayer,
  CarnetPlayer,
  CatalogueEntry,
  CollageLayout,
  Frame,
  Chapter,
  Character,
  ExamenFait,
  ExamenJob,
  CharacterData,
  CharacterKind,
  CharacterLogEntry,
  DisplayState,
  EffetObjet,
  FolderNode,
  GlypheObjet,
  Objet,
  ObjetFamille,
  ObjetPlacement,
  PortObjet,
  GameSession,
  Item,
  ItemFilter,
  Mur,
  NatureMur,
  Pion,
  PionsDuLieu,
  CalqueBrouillard,
  Lumiere,
  NatureOuverture,
  Ouverture,
  Place,
  PochetteDoc,
  PochetteOnglet,
  Pointer,
  ProjectInfo,
  RecentProject,
  Roll,
  RollRecord,
  RollRequest,
  LibraryRoot,
  MobileDevice,
  MobileInfo,
  MobileNudge,
  MobilePing,
  MobileRoll,
  ScreenInfo,
  Sexe,
  SheetModel,
  SheetTemplate,
  SlidePayload,
  TemplateSpec,
  TextOverlay,
  Transition
} from '@shared/types'

/**
 * Un élément tel que le voit l'interface : avec ses URL jdr:// prêtes à
 * l'emploi — le fichier, et la vignette gravée par l'examen quand il y en a une.
 */
export type UiItem = Item & { url: string | null; poster: string | null }
/** La pochette entière : ses rangements, et ce qui y est rangé. */
export type UiPochette = { onglets: PochetteOnglet[]; docs: PochetteDoc[] }
export type UiFolder = Omit<FolderNode, 'items' | 'children'> & {
  items: UiItem[]
  children: UiFolder[]
}

const call = <R>(channel: string, ...args: unknown[]): Promise<R> =>
  ipcRenderer.invoke(channel, ...args) as Promise<R>

const api = {
  app: {
    info: () =>
      call<{
        version: string
        dataRoot: string
        campaign: { id: number; name: string; system: string | null } | null
      }>('app:info'),
    openDataFolder: () => call<void>('app:openDataFolder'),
    /** Un geste de la barre de menus : annuler, coller, recharger, le zoom… */
    commande: (nom: string) => call<void>('app:commande', nom)
  },

  /**
   * Les réglages. Deux piles de chaînes — la campagne et le poste — que
   * `@shared/reglages` sait relire. Chaque geste rend la pile entière.
   */
  reglages: {
    campagne: () => call<Brut>('reglages:campagne'),
    poserCampagne: (cle: string, valeur: string | null) =>
      call<Brut>('reglages:poserCampagne', cle, valeur),
    poste: () => call<Brut>('reglages:poste'),
    poserPoste: (cle: string, valeur: string | null) =>
      call<Brut>('reglages:poserPoste', cle, valeur)
  },

  /**
   * Le projet ouvert — un dossier de campagne. Changer de projet recharge
   * l'interface : les promesses de `new`, `open` et `openPath` ne se résolvent
   * donc jamais côté appelant quand la bascule a lieu.
   */
  project: {
    current: () => call<ProjectInfo | null>('project:current'),
    recents: () => call<RecentProject[]>('project:recents'),
    create: () => call<ProjectInfo | null>('project:new'),
    open: () => call<ProjectInfo | null>('project:open'),
    openPath: (dir: string) => call<ProjectInfo | null>('project:openPath', dir),
    update: (patch: { name?: string; system?: string | null }) =>
      call<ProjectInfo | null>('project:update', patch),
    reveal: () => call<void>('project:reveal'),
    forget: (dir: string) => call<void>('project:forget', dir)
  },

  /** Les joueurs : le carnet de l'application, et les inscrits de la campagne. */
  players: {
    carnet: () => call<CarnetPlayer[]>('players:carnet'),
    list: () => call<CampaignPlayer[]>('players:list'),
    create: (name: string) => call<CampaignPlayer>('players:create', name),
    enroll: (uid: string) => call<CampaignPlayer>('players:enroll', uid),
    update: (id: number, patch: { name?: string; color?: string | null }) =>
      call<CampaignPlayer | null>('players:update', id, patch),
    setCharacter: (id: number, characterId: number | null) =>
      call<CampaignPlayer | null>('players:setCharacter', id, characterId),
    remove: (id: number) => call<void>('players:remove', id),
    deleteFromCarnet: (uid: string) => call<void>('players:deleteFromCarnet', uid)
  },

  /** Le dossier de campagne : c'est lui qui fait foi. */
  /**
   * L'examen des médias. Seul le graveur — la fenêtre cachée d'examen.html —
   * appelle ces trois-là : il demande du travail, rend ce qu'il a vu, et
   * prévient quand il n'y a plus rien.
   */
  examen: {
    suivant: () => call<ExamenJob | null>('examen:suivant'),
    fait: (f: ExamenFait) => call<void>('examen:fait', f),
    fini: () => call<void>('examen:fini'),
    /** Ceux-là, en revanche, sont pour la fenêtre des paramètres. */
    etat: () => call<{ actif: boolean; reste: number }>('examen:etat'),
    tout: () => call<number>('examen:tout')
  },

  library: {
    root: () => call<LibraryRoot>('library:root'),
    rescan: () => call<LibraryRoot>('library:rescan'),
    openRoot: () => call<void>('library:openRoot'),

    /** Le dossier a bougé sur le disque. Renvoie la fonction de désabonnement. */
    onChanged: (cb: (s: LibraryRoot) => void) => {
      const h = (_e: unknown, s: LibraryRoot): void => cb(s)
      ipcRenderer.on('library:changed', h)
      return (): void => {
        ipcRenderer.removeListener('library:changed', h)
      }
    }
  },

  /** Les chapitres de la campagne. Chaque geste rend la liste entière. */
  chapters: {
    list: () => call<Chapter[]>('chapters:list'),
    create: (title: string) => call<Chapter[]>('chapters:create', title),
    update: (id: number, patch: { title?: string; notes?: string }) =>
      call<Chapter[]>('chapters:update', id, patch),
    remove: (id: number) => call<Chapter[]>('chapters:remove', id),
    /** L'ordre, donné en entier : les rangs se renumérotent de zéro. */
    reorder: (ids: number[]) => call<Chapter[]>('chapters:reorder', ids)
  },

  folders: {
    tree: () => call<{ tree: UiFolder[]; orphans: UiItem[] }>('folders:tree'),
    create: (parentRel: string, name: string) => call<string>('folders:create', parentRel, name),
    rename: (rel: string, name: string) => call<string>('folders:rename', rel, name),
    move: (rel: string, destRel: string) => call<string>('folders:move', rel, destRel),
    trash: (rel: string) => call<void>('folders:trash', rel),
    decor: (rel: string, icon: string | null, color: string | null) =>
      call<void>('folders:decor', rel, icon, color),
    reveal: (rel: string) => call<void>('folders:reveal', rel),
    /** Choisit un dossier de rangement dans l'explorateur, au sein de la campagne. */
    choose: (title?: string) =>
      call<{ rel: string | null; erreur: string | null }>('folders:choose', title)
  },

  /** Les documents gardés sous la main pendant la séance. */
  annexes: {
    list: () => call<UiItem[]>('annexes:list'),
    add: (itemId: number) => call<UiItem[]>('annexes:add', itemId),
    remove: (itemId: number) => call<UiItem[]>('annexes:remove', itemId),
    reorder: (itemIds: number[]) => call<UiItem[]>('annexes:reorder', itemIds)
  },

  /**
   * La pochette : ce que les joueurs ont en main sur leur téléphone.
   *
   * Chaque appel rend la pochette entière — onglets et documents. Elle tient
   * dans une poignée de lignes, et la reprendre en entier évite d'avoir à
   * recoudre un état à chaque geste.
   */
  pochette: {
    list: () => call<UiPochette>('pochette:list'),
    /** `playerId` nul : à toute la table. `ongletId` nul : dans l'onglet ouvert. */
    add: (itemId: number, playerId: number | null, ongletId: number | null) =>
      call<UiPochette>('pochette:add', itemId, playerId, ongletId),
    remove: (id: number) => call<UiPochette>('pochette:remove', id),
    setPlayer: (id: number, playerId: number | null) =>
      call<UiPochette>('pochette:setPlayer', id, playerId),
    /** Le montrer aux joueurs, ou le remettre en réserve. */
    setVisible: (id: number, visible: boolean) =>
      call<UiPochette>('pochette:setVisible', id, visible),
    setOnglet: (id: number, ongletId: number | null) =>
      call<UiPochette>('pochette:setOnglet', id, ongletId),
    createOnglet: (name: string) => call<UiPochette>('pochette:createOnglet', name),
    renameOnglet: (id: number, name: string) => call<UiPochette>('pochette:renameOnglet', id, name),
    removeOnglet: (id: number) => call<UiPochette>('pochette:removeOnglet', id),
    reorderOnglets: (ids: number[]) => call<UiPochette>('pochette:reorderOnglets', ids),

    /** Un joueur vient d'ouvrir un document sur son téléphone. */
    onChanged: (cb: () => void) => {
      const h = (): void => cb()
      ipcRenderer.on('pochette:changee', h)
      return () => void ipcRenderer.removeListener('pochette:changee', h)
    }
  },

  items: {
    list: (filter: ItemFilter = {}) => call<UiItem[]>('items:list', filter),
    get: (id: number) => call<UiItem | null>('items:get', id),
    update: (
      id: number,
      patch: Partial<Pick<Item, 'title' | 'body' | 'folderId' | 'chapterId' | 'placeId'>>
    ) => call<UiItem | null>('items:update', id, patch),
    createDoc: (folderRel: string, title: string) =>
      call<UiItem | null>('items:createDoc', folderRel, title),
    move: (rel: string, destRel: string) => call<string>('items:move', rel, destRel),
    rename: (rel: string, name: string) => call<string>('items:rename', rel, name),
    trash: (rel: string) => call<void>('items:trash', rel),
    importFiles: (folderRel = '') => call<UiItem[]>('items:import', folderRel),
    reveal: (relPath: string) => call<void>('items:reveal', relPath),
    /**
     * De quelle page d'un PDF on tire sa vignette. Elle se regrave ensuite
     * toute seule, et `library.onChanged` l'annonce.
     */
    thumbPage: (id: number, page: number) => call<UiItem | null>('items:thumbPage', id, page)
  },

  /** Les pions posés sur l'écran joueurs, lieu par lieu. */
  pions: {
    presence: () => call<Record<number, PionsDuLieu>>('pions:presence'),
    of: (placeId: number | null) =>
      call<{ pions: Pion[]; size: number }>('pions:of', placeId),
    add: (input: {
      placeId: number
      characterId?: number | null
      itemId?: number | null
      label?: string | null
      x: number
      y: number
      /** Le poser déjà caché des joueurs. */
      cache?: boolean
    }) => call<DisplayState>('pions:add', input),
    move: (id: number, x: number, y: number) => call<DisplayState>('pions:move', id, x, y),
    /** L'angle en degrés : c'est l'image qui tourne dans le jeton. */
    rotate: (id: number, deg: number) => call<DisplayState>('pions:rotate', id, deg),
    /** Le calque : devant tout le monde, ou derrière tout le monde. */
    layer: (id: number, ou: 'devant' | 'derriere') => call<DisplayState>('pions:layer', id, ou),
    /** Le soustraire aux joueurs, ou le leur rendre. */
    hide: (id: number, cache: boolean) => call<DisplayState>('pions:hide', id, cache),
    /** Lui faire une fiche : il devient un PNJ, sans bouger de la carte. */
    promote: (id: number) => call<DisplayState>('pions:promote', id),
    remove: (id: number) => call<DisplayState>('pions:remove', id),
    clear: (placeId: number) => call<number>('pions:clear', placeId),
    /** Suivre ce pion à l'écran, ou lâcher celui qu'on suivait avec `null`. */
    focus: (id: number | null) => call<DisplayState>('pions:focus', id),
    size: (placeId: number, size: number) => call<DisplayState>('pions:size', placeId, size)
  },

  places: {
    list: () => call<Place[]>('places:list'),
    get: (id: number) => call<Place | null>('places:get', id),
    upsert: (input: Partial<Place> & { name: string }) => call<Place>('places:upsert', input),
    remove: (id: number) => call<void>('places:remove', id),
    /**
     * Ranger un lieu ailleurs, ou le remuer parmi ses freres. `beforeId` dit
     * devant qui il se pose ; `null`, il va au bout. La liste entiere revient,
     * parce qu'un deplacement renumerote toute une fratrie.
     */
    move: (id: number, parentId: number | null, beforeId: number | null) =>
      call<Place[]>('places:move', id, parentId, beforeId),
    /**
     * Le contour qu'une piece occupe sur le plan de son etage, et le point par
     * lequel on l'a nommee.
     */
    zone: (id: number, zone: [number, number][] | null, ancre?: [number, number] | null) =>
      call<Place | null>('places:zone', id, zone, ancre),
    /** Le groupe y est entre, ou on s'etait trompe. */
    seen: (id: number, seen: boolean) => call<Place | null>('places:seen', id, seen),
    /**
     * La largeur que prendront les prochaines portes et fenetres de cette
     * carte. `null` remet la largeur d'usine.
     */
    ouvLargeur: (id: number, largeur: number | null) =>
      call<Place | null>('places:ouvLargeur', id, largeur),
    /** Une zone eclairee une fois reste-t-elle decouverte, sur cette carte ? */
    lumGarde: (id: number, garde: boolean) =>
      call<Place | null>('places:lumGarde', id, garde),
    /** Jusqu'ou le regard porte ici, en part de la largeur ; `null`, sans limite. */
    regardPortee: (id: number, portee: number | null) =>
      call<Place | null>('places:regardPortee', id, portee)
  },

  /**
   * Les annotations d'un lieu, pour le MJ seul. Rien ici ne passe par
   * `display` : la fenêtre joueurs ne peut pas les recevoir.
   */
  annotations: {
    of: (placeId: number | null) => call<Annotation[]>('annotations:of', placeId),
    counts: () => call<Record<number, number>>('annotations:counts'),
    add: (input: {
      placeId: number
      kind: 'repere' | 'texte'
      texte?: string
      color?: string | null
      x: number
      y: number
    }) => call<Annotation>('annotations:add', input),
    update: (id: number, patch: { texte?: string; color?: string | null }) =>
      call<Annotation | null>('annotations:update', id, patch),
    move: (id: number, x: number, y: number) =>
      call<Annotation | null>('annotations:move', id, x, y),
    remove: (id: number) => call<void>('annotations:remove', id)
  },

  /**
   * La réserve de la campagne : ce qui se trouve, se ramasse, se porte.
   *
   * La réserve tient des **modèles** ; poser un objet crée un exemplaire. Comme
   * les annotations et les murs, rien ici ne passe par `display` : ce que le MJ
   * sait d'un objet ne peut pas atteindre la fenêtre des joueurs.
   */
  objets: {
    /** Tout d'un coup : la réserve, ses rayons, et l'unité de valeur. */
    list: () =>
      call<{ objets: Objet[]; familles: ObjetFamille[]; unite: string }>('objets:list'),
    /** Un nom suffit : la fiche se remplit après, l'objet existe tout de suite. */
    add: (input: { nom: string; familleId?: number | null }) => call<Objet>('objets:add', input),
    update: (
      id: number,
      patch: {
        nom?: string
        familleId?: number | null
        imageItemId?: number | null
        unique?: boolean
        qte?: number
        poids?: string | null
        /** Un nombre seulement : l'unité appartient à la campagne. */
        valeur?: number | null
        vu?: string
        su?: string
        equipable?: boolean
        /** Les endroits du corps où il peut aller — vide, il ne se porte pas. */
        emplacements?: string[]
        chargeNom?: string | null
        chargeMax?: number | null
        effets?: EffetObjet[]
      }
    ) => call<Objet | null>('objets:update', id, patch),
    /** Repartir d'un objet : la description suit, les exemplaires posés, non. */
    copy: (id: number) => call<Objet | null>('objets:copy', id),
    remove: (id: number) => call<void>('objets:remove', id),

    /** Pose un exemplaire dans un lieu, sur un PNJ, dans le sac d'un joueur. */
    poser: (input: {
      objetId: number
      port: PortObjet
      placeId?: number | null
      characterId?: number | null
      qte?: number
      precision?: string | null
      /** Sur quelqu'un : l'endroit du corps. Absent, c'est dans son sac. */
      emplacement?: string | null
    }) => call<Objet | null>('objets:poser', input),

    /**
     * Équiper quelqu'un à un endroit du corps. `objetId` nul vide la case —
     * ce qui s'y trouvait retombe dans son sac plutôt que de disparaître.
     */
    equiper: (input: { characterId: number; emplacement: string; objetId: number | null }) =>
      call<{ objets: Objet[] }>('objets:equiper', input),
    /** Le retirer du corps sans le lui prendre : il retombe dans son sac. */
    desequiper: (placementId: number) => call<Objet | null>('objets:desequiper', placementId),
    /**
     * Faire passer un exemplaire à quelqu'un d'autre, ou le poser dans un lieu.
     * L'emplacement ne suit pas — ce qu'on ramasse tombe dans le sac.
     */
    donner: (
      placementId: number,
      cible: { port: PortObjet; placeId?: number | null; characterId?: number | null }
    ) => call<Objet | null>('objets:donner', placementId, cible),
    placement: (
      id: number,
      patch: { qte?: number; etat?: ObjetPlacement['etat']; precision?: string | null }
    ) => call<Objet | null>('objets:placement', id, patch),
    /** Retire un exemplaire de là où il était. L'objet, lui, reste en réserve. */
    reprendre: (id: number) => call<Objet | null>('objets:reprendre', id),

    /** Le nom de l'unité de valeur de la campagne — francs, crédits, pièces d'or. */
    unite: (unite: string) => call<string>('objets:unite', unite),
    familleAdd: (input: { nom: string; teinte?: string; glyphe?: GlypheObjet }) =>
      call<ObjetFamille>('objets:familleAdd', input),
    familleUpdate: (id: number, patch: { nom?: string; teinte?: string; glyphe?: GlypheObjet }) =>
      call<ObjetFamille | null>('objets:familleUpdate', id, patch),
    /** Retirer un rayon laisse ses objets en réserve, sans famille. */
    familleRemove: (id: number) => call<void>('objets:familleRemove', id),

    /**
     * Un joueur vient de ranger une de ses affaires depuis son téléphone.
     * Renvoie la fonction de désabonnement.
     */
    onChanged: (cb: () => void) => {
      const h = (): void => cb()
      ipcRenderer.on('objets:changes', h)
      return () => void ipcRenderer.removeListener('objets:changes', h)
    }
  },

  /**
   * Les murs invisibles d'un lieu, pour le MJ seul. Comme les annotations,
   * rien ici ne passe par `display` : un mur ne peut pas atteindre la fenêtre
   * des joueurs. Il sert à empêcher un pion de traverser et à calculer ce
   * qu'il voit — jamais à être montré.
   */
  murs: {
    of: (placeId: number | null) => call<Mur[]>('murs:of', placeId),
    counts: () => call<Record<number, number>>('murs:counts'),
    /** Murs, ouvertures, lumieres et la regle d'eclairage, d'un seul coup. */
    calque: (placeId: number | null) => call<CalqueBrouillard>('murs:calque', placeId),
    /** Un trait de moins de deux points ne barre rien : il n'est pas posé. */
    add: (input: { placeId: number; nature: NatureMur; pts: [number, number][] }) =>
      call<Mur | null>('murs:add', input),
    /** `ouvert` ne vaut que pour un rideau : tiré, il voile ; ouvert, on voit. */
    update: (
      id: number,
      patch: { nature?: NatureMur; pts?: [number, number][]; ouvert?: boolean }
    ) => call<Mur | null>('murs:update', id, patch),
    remove: (id: number) => call<void>('murs:remove', id)
  },

  /**
   * Les portes et les fenêtres, posées sur un mur : elles en prennent la
   * direction, on ne règle que leur largeur et leur place.
   */
  ouvertures: {
    of: (placeId: number | null) => call<Ouverture[]>('ouvertures:of', placeId),
    add: (input: { murId: number; nature: NatureOuverture; d: number; largeur?: number }) =>
      call<Ouverture | null>('ouvertures:add', input),
    update: (
      id: number,
      patch: {
        nature?: NatureOuverture
        d?: number
        largeur?: number
        ouverte?: boolean
        /** Verrouiller referme : une porte à clé ne reste pas ouverte. */
        verrouillee?: boolean
      }
    ) => call<Ouverture | null>('ouvertures:update', id, patch),
    remove: (id: number) => call<void>('ouvertures:remove', id),
    /** Referme toutes les portes du lieu ; rend combien se sont refermées. */
    fermerPortes: (placeId: number) => call<number>('ouvertures:fermerPortes', placeId)
  },

  /** Les points de lumiere d'une carte : ce qui decide de ce qu'on y voit. */
  lumieres: {
    of: (placeId: number | null) => call<Lumiere[]>('lumieres:of', placeId),
    add: (input: {
      placeId: number
      x: number
      y: number
      clair?: number
      penombre?: number
      teinte?: string
    }) => call<Lumiere | null>('lumieres:add', input),
    update: (
      id: number,
      patch: {
        x?: number
        y?: number
        clair?: number
        penombre?: number
        allumee?: boolean
        teinte?: string
      }
    ) => call<Lumiere | null>('lumieres:update', id, patch),
    remove: (id: number) => call<void>('lumieres:remove', id)
  },

  timeline: {
    sessions: () => call<GameSession[]>('timeline:sessions'),
    currentSession: () => call<GameSession>('timeline:currentSession'),
    createSession: (label: string, date?: string) =>
      call<GameSession>('timeline:createSession', label, date),
    setActiveSession: (id: number) => call<void>('timeline:setActiveSession', id),
    updateSession: (id: number, patch: { label?: string; date?: string; notes?: string | null }) =>
      call<GameSession | null>('timeline:updateSession', id, patch),
    deleteSession: (id: number) =>
      call<{ ok: boolean; raison?: string }>('timeline:deleteSession', id),
    beats: (sessionId?: number) =>
      call<(Beat & { items: UiItem[] })[]>('timeline:beats', sessionId),
    upsertBeat: (input: {
      id?: number
      atTime?: string | null
      title: string
      note?: string | null
      done?: boolean
      chapterId?: number | null
      placeId?: number | null
    }) => call<Beat & { items: UiItem[] }>('timeline:upsertBeat', input),
    removeBeat: (id: number) => call<void>('timeline:removeBeat', id),
    reorderBeats: (ids: number[]) => call<void>('timeline:reorderBeats', ids),
    attach: (beatId: number, itemId: number) => call<void>('timeline:attach', beatId, itemId),
    detach: (beatId: number, itemId: number) => call<void>('timeline:detach', beatId, itemId)
  },

  templates: {
    list: () => call<SheetTemplate[]>('templates:list'),
    upsert: (input: { id?: number; name: string; spec: TemplateSpec }) =>
      call<SheetTemplate>('templates:upsert', input),
    remove: (id: number) => call<void>('templates:remove', id),
    blankData: (templateId: number) => call<CharacterData | null>('templates:blankData', templateId)
  },

  /**
   * Le portable des joueurs : un petit serveur sur le réseau local, un QR code
   * à tendre, et des appareils qui restent appairés d'une séance à l'autre.
   */
  mobile: {
    info: () => call<MobileInfo>('mobile:info'),
    open: () => call<{ info: MobileInfo; qr: string | null }>('mobile:open'),
    closeInvite: () => call<MobileInfo>('mobile:closeInvite'),
    /** Tendre le code à la table sur l'écran des joueurs, ou l'en retirer. */
    show: (on: boolean) => call<MobileInfo>('mobile:show', on),
    revoke: (id: number) => call<MobileInfo>('mobile:revoke', id),

    onInfo: (cb: (i: MobileInfo) => void) => {
      const h = (_: unknown, i: MobileInfo): void => cb(i)
      ipcRenderer.on('mobile:info', h)
      return () => void ipcRenderer.removeListener('mobile:info', h)
    },
    /** Un jet arrive d'un téléphone : le MJ en est averti, toujours. */
    onRoll: (cb: (r: MobileRoll) => void) => {
      const h = (_: unknown, r: MobileRoll): void => cb(r)
      ipcRenderer.on('mobile:roll', h)
      return () => void ipcRenderer.removeListener('mobile:roll', h)
    },
    /** Qui remue son pion en ce moment. */
    onNudge: (cb: (n: MobileNudge[]) => void) => {
      const h = (_: unknown, n: MobileNudge[]): void => cb(n)
      ipcRenderer.on('mobile:nudge', h)
      return () => void ipcRenderer.removeListener('mobile:nudge', h)
    },
    /** Le téléphone a changé quelque chose que le PC affiche aussi. */
    onChanged: (cb: () => void) => {
      const h = (): void => cb()
      ipcRenderer.on('mobile:changed', h)
      return () => void ipcRenderer.removeListener('mobile:changed', h)
    }
  },

  /** La fiche que partagent tous les personnages de la campagne. */
  sheet: {
    get: () => call<SheetTemplate>('sheet:get'),
    save: (input: { name: string; spec: TemplateSpec }) => call<SheetTemplate>('sheet:save', input)
  },

  /** Les briques de fiche gardées d'une campagne à l'autre. */
  catalogue: {
    list: () => call<CatalogueEntry[]>('catalogue:list'),
    add: (input: {
      kind: 'stat' | 'skill' | 'gauge'
      label: string
      code?: string | null
      color?: string | null
      max?: number | null
    }) => call<CatalogueEntry>('catalogue:add', input),
    remove: (uid: string) => call<void>('catalogue:remove', uid)
  },

  /** Les fiches entières, gardées pour servir de départ ailleurs. */
  models: {
    list: () => call<SheetModel[]>('models:list'),
    save: (name: string, spec: TemplateSpec) => call<SheetModel>('models:save', { name, spec }),
    remove: (uid: string) => call<void>('models:remove', uid)
  },

  characters: {
    list: () => call<Character[]>('characters:list'),
    get: (id: number) => call<Character | null>('characters:get', id),
    upsert: (input: {
      id?: number
      templateId: number
      /** La nature d'un personnage neuf ; un existant garde la sienne. */
      kind?: CharacterKind
      /** Ce que le MJ sait de lui — les PNJ seulement, jamais diffusé. */
      notes?: string | null
      /** Sa table de butin — les PNJ seulement, jamais diffusée. */
      butin?: ButinLigne[]
      name: string
      player?: string | null
      occupation?: string | null
      age?: string | null
      color?: string | null
      /** La silhouette de sa poupée d'équipement — homme ou femme. */
      sexe?: Sexe | null
      portraitItemId?: number | null
      sheetItemId?: number | null
      sheetFrame?: Frame | null
      data?: CharacterData
    }) => call<Character>('characters:upsert', input),
    /** Reposer la table de butin d'un PNJ, entière. */
    setButin: (id: number, lignes: ButinLigne[]) =>
      call<Character>('characters:setButin', id, lignes),
    remove: (id: number) => call<void>('characters:remove', id),
    adjust: (id: number, key: string, delta: number, reason?: string | null, maxDelta = 0) =>
      call<{ character: Character; log: CharacterLogEntry[] }>(
        'characters:adjust',
        id,
        key,
        delta,
        reason,
        maxDelta
      ),
    /** Prendre une compétence de la campagne, ou la rendre. */
    pickSkill: (id: number, key: string, on: boolean) =>
      call<Character>('characters:pickSkill', id, key, on),
    setSkill: (id: number, key: string, value: number) =>
      call<Character>('characters:setSkill', id, key, value),
    setStat: (id: number, key: string, value: number) =>
      call<Character>('characters:setStat', id, key, value),
    setState: (id: number, key: string, on: boolean) =>
      call<Character>('characters:setState', id, key, on),
    log: (id: number) => call<CharacterLogEntry[]>('characters:log', id)
  },

  rolls: {
    list: (limit = 300, sessionOnly = true) => call<Roll[]>('rolls:list', limit, sessionOnly),
    roll: (req: RollRequest) => call<Roll>('rolls:roll', req),
    /** Noter le jet qu'un joueur vient de faire, dé en main. */
    record: (req: RollRecord) => call<Roll>('rolls:record', req),
    formula: (formula: string, label?: string) => call<Roll>('rolls:formula', formula, label),
    stats: () =>
      call<{ total: number; judged: number; success: number; fumble: number; rate: number }>(
        'rolls:stats'
      ),
    /** Retirer un jet du journal : il passe à la corbeille, il n'est pas effacé. */
    trash: (id: number) => call<void>('rolls:trash', id),
    restore: (id: number) => call<void>('rolls:restore', id),
    trashList: () => call<Roll[]>('rolls:trashList'),
    emptyTrash: () => call<void>('rolls:emptyTrash'),
    clear: () => call<void>('rolls:clear'),
    exportCsv: () => call<string | null>('rolls:exportCsv')
  },

  display: {
    state: () => call<DisplayState>('display:state'),
    screens: () => call<ScreenInfo[]>('display:screens'),
    show: (slide: SlidePayload) => call<DisplayState>('display:show', slide),
    showItem: (itemId: number) => call<DisplayState>('display:showItem', itemId),
    /** Charge l'emplacement en préparation : rien ne bouge pour les joueurs. */
    prepareItem: (itemId: number) => call<DisplayState>('display:prepareItem', itemId),
    /** Bascule les deux emplacements. `ms` à 0 coupe net. */
    swap: (ms?: number, mode?: Transition) => call<DisplayState>('display:swap', ms, mode),

    /** Disposition du collage en préparation. */
    prepareLayout: (layout: CollageLayout) =>
      call<DisplayState>('display:prepareLayout', layout),
    /** Le temps qu'il fait sur la scène. Le même deux fois l'éteint. */
    /** Pose une image dans une case du collage, ou la vide avec `null`. */
    prepareCell: (index: number, itemId: number | null) =>
      call<DisplayState>('display:prepareCell', index, itemId),
    /** La légende d'une case : elle appartient à la case, pas à l'écran. */
    cellCaption: (index: number, caption: string) =>
      call<DisplayState>('display:cellCaption', index, caption),
    /** Le texte d'une case qui ne porte pas d'image. Vide, la case se vide. */
    cellText: (index: number, texte: string, color?: string) =>
      call<DisplayState>('display:cellText', index, texte, color),
    /** Recadre une image : agrandissement et décalage. */
    frame: (slot: 'prep' | 'live', cell: number | null, frame: Frame) =>
      call<DisplayState>('display:frame', slot, cell, frame),
    /** Remplace les textes posés sur l'emplacement regardé. */
    texts: (slot: 'prep' | 'live', texts: TextOverlay[]) =>
      call<DisplayState>('display:texts', slot, texts),
    blackout: () => call<DisplayState>('display:blackout'),
    freeze: (on: boolean) => call<DisplayState>('display:freeze', on),
    pionLabels: (on: boolean) => call<DisplayState>('display:pionLabels', on),
    pionPv: (on: boolean) => call<DisplayState>('display:pionPv', on),
    encart: (patch: Partial<Encart>) => call<DisplayState>('display:encart', patch),
    setOutput: (displayId: number | null) => call<DisplayState>('display:setOutput', displayId),
    openPlayer: () => call<DisplayState>('display:openPlayer'),
    closePlayer: () => call<DisplayState>('display:closePlayer'),
    togglePlayer: () => call<DisplayState>('display:togglePlayer'),
    audio: (patch: { itemId?: number | null; url?: string | null; title?: string | null; playing?: boolean; loop?: boolean; volume?: number }) =>
      call<DisplayState>('display:audio', patch),

    /** Met un lieu en scène : sa carte part à l'écran, ses pions reviennent. */
    setPlace: (placeId: number | null) => call<DisplayState>('display:setPlace', placeId),
    preparePlace: (placeId: number | null) =>
      call<DisplayState>('display:preparePlace', placeId),

    /** Le pointeur va vite : canal léger, sans réponse. */
    pointer: (p: Pointer | null) => ipcRenderer.send('display:pointer', p),
    onPointer: (cb: (p: Pointer | null) => void) => {
      const h = (_e: unknown, p: Pointer | null): void => cb(p)
      ipcRenderer.on('display:pointer', h)
      return (): void => {
        ipcRenderer.removeListener('display:pointer', h)
      }
    },

    /** S'abonne à l'état de diffusion. Renvoie la fonction de désabonnement. */
    /** Une onde montrée depuis un téléphone — elle passe et ne reste pas. */
    onPing: (cb: (p: MobilePing) => void) => {
      const h = (_: unknown, p: MobilePing): void => cb(p)
      ipcRenderer.on('display:ping', h)
      return () => void ipcRenderer.removeListener('display:ping', h)
    },
    onState: (cb: (s: DisplayState) => void) => {
      const h = (_e: unknown, s: DisplayState): void => cb(s)
      ipcRenderer.on('display:state', h)
      return (): void => {
        ipcRenderer.removeListener('display:state', h)
      }
    },
    onScreens: (cb: (s: ScreenInfo[]) => void) => {
      const h = (_e: unknown, s: ScreenInfo[]): void => cb(s)
      ipcRenderer.on('display:screens', h)
      return (): void => {
        ipcRenderer.removeListener('display:screens', h)
      }
    }
  }
}

export type JdrApi = typeof api

contextBridge.exposeInMainWorld('jdr', api)
