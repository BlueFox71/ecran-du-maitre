import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { usePoignee } from '../components/Poignee'
import { ChoixPnj, RetirerDeLaReserve, usePnjEnReserve } from '../components/ReservePnj'
import { MenuPion, type CiblePion } from '../components/MenuPion'
import { TailleEchelle } from '../components/TailleEchelle'
import { DetailPion } from '../components/DetailPion'
import { BoutonAffichage, useTraitsMj } from '../components/Affichage'
import { MenuImage, type CibleImage } from '../components/MenuImage'
import { ARTICLES_SITUES, FicheCompacte } from '../components/FicheDuLieu'
import { useViseCarte } from '../viseCarte'
import type { ArticleSurCarte } from '../../shared/Slide'
import { Slide } from '../../shared/Slide'
import { BoutonTours, Tours, pionEnJeu } from '../components/Tours'
import { TrameEnJeu } from '../components/PlanTrame'
import { Valeur } from '../components/Valeur'
import { Visage } from '../../shared/Visage'
import { Pings, usePings } from '../../shared/Pings'
import { duree } from '../../shared/mesures'
import { accepteSi, initials, profondeur, useMontrerPieces } from './Regie'
import { estPiece } from './Places'
import { decorDossier, folderIcon } from '../components/FolderIcons'
import { Annotations, CadreAnnote } from '../components/Annotations'
import { TableauDeScene, type Surbrillance } from '../components/Tableau'
import { BoutonObjets, ObjetsDeScene, usePanneauScene } from '../components/ObjetsDeScene'
import { IconPhone, Portables } from '../components/Portables'
import { TexteCourt } from '../components/TexteCourt'
import { ConsoleDirect } from '../components/ConsoleDirect'
import {
  BoutonPoserLumiere,
  BoutonTextes,
  SensEncart,
  VoletAnnoter,
  VoletCase,
  VoletTextes,
  caseDuCollage,
  useAnnotationsScene,
  useCalqueDuLieu,
  usePoseLumiere,
  useTextesEcran
} from '../components/OutilsDeScene'
import { COLLAGE_CELLS, FRAME_NEUTRE, LUM_MAX, LUM_MIN } from '@shared/types'
import type {
  Annotation,
  Character,
  CollageLayout,
  Frame,
  JaugeVue,
  Pion,
  PionsDuLieu,
  Place,
  Pointer
} from '@shared/types'
import type { UiFolder, UiItem } from '../../../../preload/index'
import {
  IconCheck,
  IconVerrou,
  IconChevron,
  IconClose,
  IconDoc,
  IconExpand,
  IconFolder,
  IconPlace,
  IconPorte,
  IconScreen,
  IconEye,
  IconCercle,
  IconPen,
  IconRetour,
  IconRotate,
  IconSearch,
  IconNote,
  IconTimeline,
  IconTrame,
  IconTrash,
  kindIcon
} from '../components/Icons'
import { useEchap } from '../echap'
import { ChoixDansArbre } from '../components/ChoixDansArbre'
import { SelecteurApparence, porteurDe } from '../components/Apparences'
import { estPresente, presenterLeJoueur } from '../presentation'
import { montreLaCarte } from '@shared/scene'
import { PanneauSons, useSonsSurCarte, useTouchesSon } from '../components/PanneauSons'

/* ============================================================
   Pupitre : le fil de la séance à gauche, l'écran des
   joueurs à droite. Ce que le moment a sous la main se pose
   directement dans le visuel libre — on n'a pas à changer de page
   pour envoyer ce qu'on vient de lire.

   Ce module ne refait pas la Régie : le recadrage, la luminosité,
   les textes à l'écran, les annotations et les portables restent
   là-bas. Ici on suit la partie et on diffuse.
   ============================================================ */

/** Ce qui va vraiment à l'écran : le reste ne produit aucune diapositive. */
const A_L_ECRAN = new Set(['image', 'video'])

/*
 * Ce qu'on lisait au Paravent survit à un détour par une autre page : l'onglet,
 * le lieu, l'annexe et les dossiers ouverts. Gardé ici, hors du composant, le
 * temps que l'application tourne — on revient où l'on était, pas au premier
 * moment.
 */
const retenu = new Map<string, unknown>()
function useRetenu<T>(cle: string, depart: T): [T, (v: T | ((x: T) => T)) => void] {
  const [v, setV] = useState<T>(() => (retenu.has(cle) ? (retenu.get(cle) as T) : depart))
  const poser = (n: T | ((x: T) => T)): void =>
    setV((x) => {
      const suivant = typeof n === 'function' ? (n as (x: T) => T)(x) : n
      retenu.set(cle, suivant)
      return suivant
    })
  return [v, poser]
}

export function Pupitre(): JSX.Element {
  const s = useStore()
  const display = s.display

  /* Le moment courant est celui du store : on le partage avec la Chronologie,
     pour ne pas perdre sa place en passant d'un module à l'autre. */
  const beat = s.beats.find((b) => b.id === s.activeBeatId) ?? s.beats[0] ?? null

  /* Le visuel qu'on arrange vient du magasin : il survit au changement de
     page, et la Régie regarde le même. */
  const visuel = s.visuel
  const setVisuel = s.setVisuel
  const [activeCell, setActiveCell] = useState(0)
  const [edit, setEdit] = useState<{ pions: Pion[]; size: number }>({ pions: [], size: 6 })
  const [choix, setChoix] = useState(false)
  /* Qui se tient où, pour prévenir qu'un joueur posé ici quittera son lieu. */
  const [presence, setPresence] = useState<Record<number, PionsDuLieu>>({})
  /* Le côté gauche lit soit le fil de la séance, soit les lieux — ce que voient
     les joueurs en arrivant, et ce qu'ils ne doivent pas savoir —, soit les
     documents annexes : règles maison, tables, fiches qu'on garde sous la main
     toute la partie —, soit le dossier de la campagne, soit les portables. Ces
     deux derniers prennent toute la colonne : ils n'ont rien à lire à côté. */
  const [cote, setCote] = useRetenu<'chrono' | 'lieux' | 'annexes' | 'dossier' | 'portables' | 'sons'>(
    'cote',
    'chrono'
  )
  const plein = cote === 'dossier' || cote === 'portables' || cote === 'sons'
  /* Les chiffres jouent les bruitages et le point fait silence, quel que soit l'onglet. */
  useTouchesSon()
  const [annexeVue, setAnnexeVue] = useRetenu<number | null>('annexe', null)
  /* Sur un petit écran, on lit ou on joue : la page ne montre qu'un côté, et
     la console du direct reste au pied dans les deux cas. Au large, ce choix
     ne fait rien — tout est côte à côte. */
  const [vue, setVue] = useRetenu<'lire' | 'scene'>('vue', 'lire')
  const [lieuVu, setLieuVu] = useRetenu<number | null>('lieu', null)
  /* Ce que la scène du MJ montre de son calque : murs, portes, fenêtres… */
  const [traits] = useTraitsMj()
  /* Le menu de l'encart, ouvert d'un clic sur lui dans la scène. */
  const [menuEncart, setMenuEncart] = useState<{ x: number; y: number } | null>(null)
  /* Le pion dont le détail est ouvert sous la réserve — ou, choisi dans la
     réserve sans être posé ici, le personnage seul. */
  const [choisi, setChoisi] = useRetenu<{ pionId: number | null; characterId: number | null } | null>(
    'choisi',
    null
  )
  /* Le lieu survolé dans le fil, et où poser sa bulle : à gauche de la ligne. */
  const [bulleLieu, setBulleLieu] = useState<{ id: number; x: number; y: number } | null>(null)
  /* Le choix qu'ouvre un clic sur une image : visuel libre, ou fenêtre sur le direct. */
  const [cibleImage, setCibleImage] = useState<CibleImage | null>(null)
  /*
   * Les annotations du lieu qu'on arrange, comme en Régie : on les voit, on les
   * pose et on les écrit d'ici. De l'état local — la fenêtre joueurs ne peut
   * pas les recevoir. Voir `useAnnotationsScene`.
   */
  const [voirAnnots, setVoirAnnots] = useState(false)
  /* L'ombre exacte de l'écran des joueurs, posée sur la scène à la demande. */
  const [leurOeil, setLeurOeil] = useState(false)
  /* Ce que le MJ survole dans son tableau de scène : un halo chez lui seul. */
  const [survol, setSurvol] = useState<Surbrillance>(null)
  /* Le tableau de scène (portes et lumières) ou les objets du lieu : un tiroir
     par-dessus la carte, l'un ou l'autre, qu'on ouvre par à-coups (17 oct.).
     Fermé au départ — ouvert, il cacherait la carte. Échap le referme. */
  const [panneau, basculerPanneau] = usePanneauScene('paravent.tiroir', () => null)
  const voirScene = panneau === 'scene'
  useEchap(() => panneau && basculerPanneau(panneau), panneau != null)
  /* L'arborescence de la séance, par-dessus tout : on y coche ce qui est fait. */
  const [trameOuverte, setTrameOuverte] = useState(false)
  const basculerScene = (): void => basculerPanneau('scene')
  const [ouverts, setOuverts] = useRetenu<Set<string>>('ouverts', new Set())
  /* Le dossier de la séance s'ouvre de lui-même, et ceux qui y mènent : c'est
     là qu'on va chercher pendant la partie. Les autres restent fermés. */
  const dossierSeance = s.session?.folderRel ?? null
  useEffect(() => {
    if (!dossierSeance) return
    const parts = dossierSeance.split('/').filter(Boolean)
    setOuverts((o) => {
      const n = new Set(o)
      parts.forEach((_, i) => n.add(parts.slice(0, i + 1).join('/')))
      return n
    })
  }, [dossierSeance])

  /* Le pointeur, comme en Régie : P le maintient, Ctrl le prête le temps d'un
     geste. Les deux se lisent ici aussi, sinon on montrerait du doigt sur une
     page et pas sur l'autre. */
  const [pointing, setPointing] = useState(false)
  const [pointer, setPointer] = useState<Pointer | null>(null)
  const held = useRef(false)
  const lastSent = useRef(0)

  const ondes = usePings()
  const poserOnde = ondes.ajouter
  useEffect(() => window.jdr.display.onPing(poserOnde), [poserOnde])

  const liveSlot = (display?.liveSlot ?? 0) as 0 | 1
  const idleSlot: 0 | 1 = liveSlot === 0 ? 1 : 0
  const onLive = visuel === liveSlot

  /* En arrivant sur la page, on regarde ce que voient les joueurs : le direct,
     toujours. Une fois seulement, dès que l'état de l'écran est connu — ensuite
     on passe d'un visuel à l'autre comme on veut. */
  const arrive = useRef(false)
  useEffect(() => {
    if (arrive.current || !display) return
    arrive.current = true
    setVisuel(display.liveSlot)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [display])
  const slide = display?.slots?.[visuel] ?? { type: 'black' as const }
  /*
   * « Bloquer le zoom MJ » : sur le direct, la molette et le glisser ne
   * recadrent plus que la scène du MJ. Les joueurs gardent leur cadrage ; le
   * MJ regarde de près sans rien leur montrer. Le cadrage local s'oublie dès
   * qu'on débloque, ou que l'image change.
   */
  const [zoomMj, setZoomMj] = useState(false)
  const [cadreMj, setCadreMj] = useState<Frame | null>(null)
  const imageVue = 'itemId' in slide ? slide.itemId : null
  useEffect(() => setCadreMj(null), [imageVue, visuel, zoomMj])
  const slideVu =
    zoomMj && cadreMj && (slide.type === 'image' || slide.type === 'video') ? { ...slide, frame: cadreMj } : slide
  const prepSlide = display?.slots?.[idleSlot] ?? { type: 'black' as const }
  const layout: CollageLayout = prepSlide.type === 'collage' ? prepSlide.layout : '1'

  /*
   * La scène prend la forme de l'écran des joueurs, pas un 16/9 de principe :
   * un cadre qui ment sur les proportions fait composer de travers, et le
   * 16/9 laissait du vide dans sa boîte. Même choix d'écran que le moniteur
   * du rail — la sortie réglée, sinon le premier écran qui n'est pas le
   * principal.
   */
  const sortie =
    s.screens.find((x) => x.id === display?.outputDisplayId) ??
    s.screens.find((x) => !x.primary) ??
    s.screens[0] ??
    null
  const ecran = sortie ? `${sortie.width} / ${sortie.height}` : '16 / 9'

  const frozen = display?.frozen ?? false
  const dark = (display?.slide ?? { type: 'black' }).type === 'black'
  const pillClass = frozen ? 'frozen' : dark ? 'off' : 'on'
  const pillText = frozen ? 'Figé — rien ne part' : dark ? 'Voile noir' : 'Direct : chaque geste part aussitôt'

  /** Le lieu qu'on arrange : celui de l'écran qu'on regarde. */
  const editPlaceId =
    !onLive && display?.pendingPlaceId != null
      ? display.pendingPlaceId
      : /* Le lieu en scène ne s'arrange que sur sa carte : une autre image
           regardée ici, libre ou au direct, ne porte ni ses pions ni ses murs. */
        montreLaCarte(slide, display?.carteDuLieu ?? null)
        ? (display?.placeId ?? null)
        : null

  const refreshEdit = async (): Promise<void> => setEdit(await window.jdr.pions.of(editPlaceId))
  const refreshPresence = async (): Promise<void> => setPresence(await window.jdr.pions.presence())
  useEffect(() => {
    void refreshEdit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editPlaceId, display?.pions])
  /* Un pion poussé depuis le téléphone d'un joueur bouge le même jeton ici. */
  useEffect(() => {
    void refreshPresence()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [display?.pions])

  /* Les annotations suivent le lieu qu'on arrange, et ne se lisent que si on
     les demande — inutile d'interroger la base pour un calque qu'on cache. */
  const annot = useAnnotationsScene(editPlaceId, voirAnnots)
  /* Le calque du lieu : il retient les pions, nourrit le tableau de scène et
     l'œil des joueurs. Il se relit dès qu'un pion ou une porte bouge. */
  const calque = useCalqueDuLieu(editPlaceId, edit.pions, display?.pions, display?.calqueRev)
  /* Les textes posés sur le visuel qu'on regarde, et la case visée d'un collage. */
  const textes = useTextesEcran(slide, onLive)
  /* Une bougie qu'on allume, une lanterne qu'on pose : un clic dans la pièce. */
  const lampe = usePoseLumiere(editPlaceId, calque)
  /* Un joueur pose l'un de ses objets dans le lieu : armé depuis le détail du
     pion, il attend un clic sur le plan. Changer de lieu le désarme. */
  const [objetAPoser, setObjetAPoser] = useState<number | null>(null)
  useEffect(() => setObjetAPoser(null), [editPlaceId])
  useEchap(() => setObjetAPoser(null), objetAPoser != null)
  const poserObjet =
    objetAPoser != null && editPlaceId != null
      ? (x: number, y: number): void => {
          const id = objetAPoser
          setObjetAPoser(null)
          void (async () => {
            await window.jdr.objets.donner(id, { port: 'lieu', placeId: editPlaceId })
            await window.jdr.objets.situer(id, { x, y })
            await s.refreshObjets()
          })()
        }
      : undefined
  /* Les sons posés sur ce lieu, pour la carte du MJ (case « Sons » d'Affichage). */
  const sonsScene = useSonsSurCarte(editPlaceId)
  /* Les objets posés en un point du plan : dans l'étage même, ou l'une de
     ses pièces (case « Objets » d'Affichage). */
  const objetsScene = useMemo(() => {
    if (editPlaceId == null) return []
    const ici = new Set(
      s.places.filter((p) => p.id === editPlaceId || p.parentId === editPlaceId).map((p) => p.id)
    )
    return s.objets.flatMap((o) =>
      o.placements
        .filter((x) => x.port === 'lieu' && x.pos && x.placeId != null && ici.has(x.placeId))
        .map((x) => ({
          id: x.id,
          x: x.pos!.x,
          y: x.pos!.y,
          nom: x.qte > 1 ? `${o.nom} ×${x.qte}` : o.nom,
          etat: x.etat
        }))
    )
  }, [s.objets, s.places, editPlaceId])
  /* Ce qui peut arriver, posé sur le plan : de l'étage même, ou de l'une de
     ses pièces (cases « Découvertes », « Déclencheurs », « Scénarios »
     d'Affichage). Relu quand un article bouge, se coche ou s'écrit. */
  const articlesPoses = useArticlesSurCarte(
    editPlaceId,
    s.places.filter((p) => p.id === editPlaceId || p.parentId === editPlaceId).map((p) => p.id)
  )
  /* Ce que la main survole dans la fiche du lieu ressort sur la carte. */
  const viseCarte = useViseCarte()
  const articlesScene = useMemo(
    () =>
      articlesPoses.map((a) =>
        viseCarte && 'article' in viseCarte && viseCarte.article === a.cle ? { ...a, vise: true } : a
      ),
    [articlesPoses, viseCarte]
  )
  const objetsVises = useMemo(
    () =>
      objetsScene.map((o) => (viseCarte && 'objet' in viseCarte && viseCarte.objet === o.id ? { ...o, vise: true } : o)),
    [objetsScene, viseCarte]
  )
  const iCase = caseDuCollage(slide, activeCell)

  /** Le lieu mis en scène, et sa carte — c'est elle qui porte les repères. */
  const placeArrangee = s.places.find((p) => p.id === editPlaceId) ?? null
  const carteScene = s.allItems.find((i) => i.id === placeArrangee?.mapItemId) ?? null

  /* ---------------- pointeur ---------------- */

  const sendPointer = (p: Pointer | null): void => {
    setPointer(p)
    window.jdr.display.pointer(p)
  }

  useEffect(() => {
    const inField = (t: EventTarget | null): boolean =>
      t instanceof HTMLElement &&
      (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))

    const down = (e: KeyboardEvent): void => {
      if ((e.key === 'p' || e.key === 'P') && !e.ctrlKey && !e.metaKey && !inField(e.target)) {
        setPointing((v) => !v)
      }
      if (e.key === 'Control') held.current = true
    }
    const up = (e: KeyboardEvent): void => {
      if (e.key === 'Control') {
        held.current = false
        if (!pointing) sendPointer(null)
      }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [pointing])

  useEffect(() => {
    if (!pointing) sendPointer(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointing])

  const onStageMove = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (!pointing && !held.current) return
    const now = performance.now()
    if (now - lastSent.current < 40) return
    lastSent.current = now
    const b = e.currentTarget.getBoundingClientRect()
    sendPointer({ x: (e.clientX - b.left) / b.width, y: (e.clientY - b.top) / b.height })
  }

  /* ---------------- diffusion ---------------- */

  /**
   * Un clic prépare : rien ne bouge pour les joueurs tant qu'on n'a pas
   * basculé. Un son, lui, part tout de suite — il ne se prépare pas, il se
   * joue, et on l'arrête d'un bouton.
   */
  const poser = async (it: UiItem): Promise<void> => {
    if (it.kind === 'audio') {
      await window.jdr.display.showItem(it.id)
      return
    }
    const cells = COLLAGE_CELLS[layout]
    if (cells > 1 && it.kind === 'image') {
      const c = activeCell % cells
      await window.jdr.display.prepareCell(c, it.id)
      setActiveCell((c + 1) % cells)
      return
    }
    await window.jdr.display.prepareItem(it.id)
  }

  const preparePlace = async (id: number): Promise<void> => {
    await window.jdr.display.preparePlace(id)
  }

  /* ---------------- l'image visée : pivot et lumière ---------------- */

  /**
   * Sur quoi portent le pivot et la lumière : l'image plein écran du visuel
   * qu'on regarde, ou la case visée s'il s'agit d'un collage.
   */
  const cadreVise = (): { cell: number | null; frame: Frame } | null => {
    // Une vidéo se recadre comme une image, donc elle se pivote et s'éclaircit.
    if (slide.type === 'image' || slide.type === 'video')
      return { cell: null, frame: slide.frame ?? FRAME_NEUTRE }
    if (slide.type === 'collage') {
      const i = activeCell % COLLAGE_CELLS[slide.layout]
      const c = slide.cells[i]
      // Une case de texte ne se recadre pas : rien à pivoter, rien à éclaircir.
      return c?.kind === 'image' ? { cell: i, frame: c.frame ?? FRAME_NEUTRE } : null
    }
    return null
  }

  const vise = cadreVise()
  const pivotable = vise !== null
  const lum = Math.round((vise?.frame.lum ?? 1) * 100)

  /* La carte à l'écran a-t-elle d'autres apparences ? Le lieu de ce visuel :
     celui en scène au direct, celui qu'on prépare à côté. */
  const lieuDuVisuel = onLive
    ? (display?.placeId ?? null)
    : (display?.pendingPlaceId ?? display?.placeId ?? null)
  const lieuDuVisuelVu = s.places.find((p) => p.id === lieuDuVisuel)
  const porteurVu = lieuDuVisuelVu ? porteurDe(lieuDuVisuelVu, s.places) : null
  const avecApparences =
    porteurVu &&
    porteurVu.apparences.length &&
    slide.type === 'image' &&
    slide.itemId === porteurVu.mapItemId
      ? porteurVu
      : null

  /* Le décalage repart de zéro : une image couchée n'entre plus dans son cadre
     de la même façon, et un ancien décalage y laisserait voir du vide.
     L'agrandissement, lui, se garde. */
  const pivoter = (): void => {
    if (!vise) return
    const rot = (((vise.frame.rot ?? 0) + 90) % 360) as 0 | 90 | 180 | 270
    void window.jdr.display.frame(onLive ? 'live' : 'prep', vise.cell, {
      zoom: vise.frame.zoom,
      ox: 0,
      oy: 0,
      rot,
      lum: vise.frame.lum
    })
  }

  /** Corrige la luminosité de l'image visée, sans toucher à son cadrage. */
  const poseLum = (pct: number): void => {
    if (!vise) return
    void window.jdr.display.frame(onLive ? 'live' : 'prep', vise.cell, {
      ...vise.frame,
      lum: pct / 100
    })
  }


  /* ---------------- pions sur la scène ---------------- */

  const dropOnStage = async (
    e: React.DragEvent,
    x: number,
    y: number,
    cell: number | null
  ): Promise<void> => {
    const pionId = e.dataTransfer.getData('text/pion')
    const itemId = e.dataTransfer.getData('text/pion-item')

    const charId = e.dataTransfer.getData('text/pion-char')
    const lieuId = e.dataTransfer.getData('text/lieu')

    /* Un lieu lâché sur l'écran à l'antenne y va tout de suite ; sur l'autre,
       il attend la bascule. */
    if (lieuId) {
      await (onLive
        ? window.jdr.display.setPlace(Number(lieuId))
        : preparePlace(Number(lieuId)))
      return
    }
    if (pionId) {
      await window.jdr.pions.move(Number(pionId), x, y)
      await refreshEdit()
      return
    }
    /* Une image lâchée dans une case du collage y prend place ; ailleurs, elle
       devient un pion. On ne compose jamais l'écran que les joueurs regardent. */
    const visee = onLive ? null : cell
    if (itemId && visee != null && visee < COLLAGE_CELLS[layout]) {
      await window.jdr.display.prepareCell(visee, Number(itemId))
      setActiveCell((visee + 1) % COLLAGE_CELLS[layout])
      return
    }
    if (!itemId && !charId) return
    if (editPlaceId == null) {
      s.toast('Choisis d’abord le lieu où se tient la scène', true)
      return
    }
    if (charId) {
      /* Un joueur n'est pas à deux endroits à la fois : le poser ici le retire
         du lieu où il se tenait. On le dit, sinon son pion disparaît ailleurs
         sans que personne ne l'ait vu partir. */
      const quitte = ailleurs(Number(charId), editPlaceId)
      /* Un PNJ se pose caché, fiche ou pas : le MJ range sa scène avant de
         l'ouvrir, et les joueurs n'ont pas à voir arriver ce qui les attend.
         Un personnage joueur, lui, est déjà connu de tous. */
      const cache = s.characters.find((c) => c.id === Number(charId))?.kind === 'pnj'
      await window.jdr.pions.add({ placeId: editPlaceId, characterId: Number(charId), x, y, cache })
      if (quitte) s.toast(`${quitte.nom} quitte ${quitte.lieu}`)
    } else {
      await window.jdr.pions.add({ placeId: editPlaceId, itemId: Number(itemId), x, y })
    }
    await refreshPresence()
    await refreshEdit()
  }

  const removePion = async (id: number): Promise<void> => {
    await window.jdr.pions.remove(id)
    await refreshPresence()
    await refreshEdit()
  }

  /* Le menu du pion : calque, cachette, aplomb. Il se dessine ici et non dans
     la scène — voir MenuPion.tsx. */
  const [ciblePion, setCiblePion] = useState<CiblePion | null>(null)

  /**
   * La molette tourne le pion sous le curseur. On rafraîchit la scène du MJ,
   * mais pas la présence : un pion qui tourne ne change pas de lieu, et
   * relire toute la table à chaque cran de molette serait cher pour rien.
   */
  const tournerPion = async (id: number, deg: number): Promise<void> => {
    await window.jdr.pions.rotate(id, deg)
    await refreshEdit()
  }

  const clearPions = async (): Promise<void> => {
    if (editPlaceId == null) return
    await window.jdr.pions.clear(editPlaceId)
    await refreshPresence()
    await refreshEdit()
  }

  /** Où ce personnage se tient déjà, si ce n'est pas ici. */
  const ailleurs = (characterId: number, sauf: number): { nom: string; lieu: string } | null => {
    for (const [id, l] of Object.entries(presence)) {
      if (Number(id) === sauf) continue
      const j = l.joueurs.find((x) => x.characterId === characterId)
      if (j)
        return {
          nom: j.name,
          lieu: s.places.find((p) => p.id === Number(id))?.name ?? 'son lieu'
        }
    }
    return null
  }

  /** Donner un visage à un personnage : une image lâchée sur son pion. */
  const setPhoto = async (e: React.DragEvent, characterId: number): Promise<void> => {
    e.preventDefault()
    const itemId = Number(e.dataTransfer.getData('text/pion-item'))
    if (!itemId) return
    const c = s.characters.find((x) => x.id === characterId)
    if (!c) return
    await window.jdr.characters.upsert({
      id: c.id,
      templateId: c.templateId,
      name: c.name,
      portraitItemId: itemId
    })
    await s.refreshCharacters()
    s.toast(`Photo de ${c.name} mise à jour`)
  }


  /* La réserve porte les deux : un PNJ se pose sur la carte comme un joueur.
     Les joueurs d'abord, cependant — ils sont trois, les PNJ peuvent être
     vingt, et ce sont les trois qu'on cherche en pleine partie. */
  /* Puis, parmi les PNJ, ceux que le moment en cours met en scène : ce sont
     eux qu'on cherche. Les autres restent là, en retrait. */
  const enScene = useMemo(
    () => new Set(s.beats.find((b) => b.id === s.activeBeatId)?.pnjIds ?? []),
    [s.beats, s.activeBeatId]
  )
  const rang = (c: Character): number => (c.kind !== 'pnj' ? 0 : enScene.has(c.id) ? 1 : 2)
  /* Les joueurs, et les seuls PNJ que le MJ a mis sur la ligne (le +). */
  const reserve = usePnjEnReserve()
  const [choixPnj, setChoixPnj] = useState(false)
  const reservePions = useMemo(
    () =>
      s.characters
        .filter((c) => c.present && (c.kind !== 'pnj' || reserve.ids.has(c.id)))
        .sort((a, b) => rang(a) - rang(b)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.characters, enScene, reserve.ids]
  )

  const placedChars = new Set(edit.pions.map((p) => p.characterId).filter(Boolean))

  /* ---------------- la source : lieux et dossier ---------------- */

  /** Ce qui peut aller à l'écran, d'une façon ou d'une autre. */
  const diffusable = (i: UiItem): boolean => i.kind !== 'other'
  const fichiers = useMemo(() => s.fichiers.filter(diffusable), [s.fichiers])
  const vuItemId = 'itemId' in slide ? slide.itemId : null

  /**
   * Un fichier est une vignette, pas une ligne de texte : en pleine partie on
   * reconnaît une carte à son image, jamais à son nom de fichier.
   */
  const fileTile = (i: UiItem): JSX.Element => (
    <button
      key={i.id}
      className={`vig k-${i.kind}${vuItemId === i.id ? ' on' : ''}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/media-item', String(i.id))
        if (i.kind === 'image') e.dataTransfer.setData('text/pion-item', String(i.id))
        e.dataTransfer.effectAllowed = 'copy'
      }}
      /* Une image demande où aller — visuel libre, ou fenêtre sur le direct —,
         comme celles d'un moment ; le reste se prépare tout de suite. */
      onClick={(e) =>
        i.kind === 'image'
          ? setCibleImage({ item: i, titre: i.title, x: e.clientX, y: e.clientY })
          : void poser(i)
      }
      title={
        i.kind === 'image'
          ? `${i.title}\nClic : visuel libre ou fenêtre sur le direct · glisser : sur une case, ou en faire un pion`
          : `${i.title}\nClic : préparer`
      }
    >
      {/* La vignette gravée par l'examen d'abord : elle pèse quarante kilos,
          là où la carte entière en pèse dix mille. Une vidéo la porte aussi,
          avec sa marque par-dessus pour rester reconnaissable. */}
      {i.kind === 'image' && (i.poster || i.url) ? (
        <img src={i.poster ?? i.url!} alt="" loading="lazy" draggable={false} />
      ) : i.poster ? (
        <>
          <img src={i.poster} alt="" loading="lazy" draggable={false} />
          <span className="g vig-marque">{kindIcon(i.kind, 'ico')}</span>
        </>
      ) : (
        <span className="g">{kindIcon(i.kind, 'ico')}</span>
      )}
      <span className="nm">{i.title}</span>
    </button>
  )

  const folderRow = (f: UiFolder): JSX.Element => {
    const isOpen = ouverts.has(f.relPath)
    const files = f.items.filter(diffusable)
    return (
      <div key={f.relPath}>
        <div
          className={`row folder${isOpen ? ' open' : ''}`}
          onClick={() =>
            setOuverts((o) => {
              const n = new Set(o)
              n.has(f.relPath) ? n.delete(f.relPath) : n.add(f.relPath)
              return n
            })
          }
        >
          <IconChevron className="caret" />
          <span className="fico" style={decorDossier(f.icon)}>
            {folderIcon(f.icon, 'ico')}
          </span>
          <span className="name">{f.name}</span>
          <span className="go num">{files.length || ''}</span>
        </div>
        {isOpen ? (
          <div className="kids">
            {f.children.map(folderRow)}
            {files.length ? <div className="vigs">{files.map(fileTile)}</div> : null}
          </div>
        ) : null}
      </div>
    )
  }

  /* ---------------- la matière de ce moment ---------------- */

  const lieu = s.places.find((p) => p.id === beat?.placeId) ?? null
  const carte = s.allItems.find((i) => i.id === lieu?.mapItemId) ?? null

  /* Les pièces jointes du moment arrivent sans leur URL : on les retrouve
     dans la bibliothèque, seule liste qui porte le `jdr://` des vignettes. */
  const matiere = useMemo<UiItem[]>(() => {
    const ids = new Set((beat?.items ?? []).map((i) => i.id))
    return s.allItems.filter((i) => ids.has(i.id))
  }, [beat, s.allItems])

  const visuels = useMemo(() => matiere.filter((i) => A_L_ECRAN.has(i.kind)), [matiere])

  /* Une image ou une vidéo de l'étagère, celle du moment comme celle du lieu :
     un clic la prépare, ou l'ouvre en fenêtre ; glissée sur la scène, un pion. */
  const vignetteVisuel = (it: UiItem): JSX.Element => (
    <button
      key={it.id}
      className="pu-vig"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/media-item', String(it.id))
        e.dataTransfer.setData('text/pion-item', String(it.id))
        e.dataTransfer.effectAllowed = 'copy'
      }}
      onClick={(e) =>
        it.kind === 'image'
          ? setCibleImage({ item: it, titre: it.title, x: e.clientX, y: e.clientY })
          : void poser(it)
      }
      title={
        it.kind === 'image'
          ? `${it.title} — clic : visuel libre ou fenêtre sur le direct ; glisser sur la scène : un pion`
          : `Préparer ${it.title} — ou le glisser sur la scène pour en faire un pion`
      }
    >
      {it.poster || (it.kind === 'image' && it.url) ? (
        <img src={it.poster ?? it.url!} alt="" />
      ) : null}
      {it.kind === 'video' ? <span className="pu-play" /> : null}
      {/* Le triangle dit déjà que c'est une vidéo ; la place sert
          mieux à dire combien de temps elle dure. */}
      <span className="pu-kind">
        {it.kind === 'video' ? (duree(it.duration) ?? 'vidéo') : 'image'}
      </span>
      <span className="pu-nom">{it.title}</span>
    </button>
  )
  const sons = useMemo(() => matiere.filter((i) => i.kind === 'audio'), [matiere])
  const docs = useMemo(() => matiere.filter((i) => i.kind === 'doc'), [matiere])
  /* Les PNJ que la Chronologie a mis en scène : leur portrait se prépare d'un
     clic, leur pion se glisse sur la scène. */
  /* Le moment où l'on présente les joueurs : ceux de la séance, présents et
     encore en jeu, comme sur l'écran d'attente. */
  const joueursAPresenter = useMemo(
    () =>
      beat?.presenterJoueurs
        ? s.characters.filter((c) => c.kind !== 'pnj' && c.present && !c.horsJeu)
        : [],
    [s.characters, beat]
  )
  const pnjsEnScene = useMemo(
    () => s.characters.filter((c) => c.kind === 'pnj' && (beat?.pnjIds ?? []).includes(c.id)),
    [s.characters, beat]
  )

  const audio = display?.audio
  const played = s.beats.filter((b) => b.done).length
  /* L'annexe qu'on lit : celle qu'on a choisie, sinon la première. */
  const annexe = s.annexes.find((a) => a.id === annexeVue) ?? s.annexes[0] ?? null

  /* Les lieux en arbre, comme leurs fichiers : l'espace, puis ses niveaux,
     puis leurs pièces. Un lieu dont le parent a disparu remonte à la racine. */
  const lieuxEnArbre = useMemo(() => {
    const ids = new Set(s.places.map((p) => p.id))
    const enfants = new Map<number | null, Place[]>()
    for (const p of s.places) {
      const cle = p.parentId != null && ids.has(p.parentId) ? p.parentId : null
      enfants.set(cle, [...(enfants.get(cle) ?? []), p])
    }
    const out: { p: Place; prof: number }[] = []
    const vus = new Set<number>()
    const descendre = (cle: number | null, prof: number): void => {
      const freres = [...(enfants.get(cle) ?? [])].sort((a, b) => a.ord - b.ord || a.id - b.id)
      for (const p of freres) {
        if (vus.has(p.id)) continue
        vus.add(p.id)
        out.push({ p, prof })
        descendre(p.id, prof + 1)
      }
    }
    descendre(null, 0)
    return out
  }, [s.places])
  /* Le lieu qu'on lit : celui qu'on a choisi, sinon celui du moment. */
  const lieuLu =
    s.places.find((p) => p.id === lieuVu) ?? lieu ?? lieuxEnArbre[0]?.p ?? null
  /* Ses images à montrer, et celles de son étage pour une pièce. */
  const imagesLieuLu = lieuLu
    ? [...new Set([...lieuLu.imageIds, ...porteurDe(lieuLu, s.places).imageIds])]
        .map((id) => s.allItems.find((i) => i.id === id))
        .filter((i): i is UiItem => !!i && A_L_ECRAN.has(i.kind))
    : []
  /* Taire les pièces ; celle qu'on lit reste, sa ligne allumée dit où l'on est. */
  const [montrerPieces, basculerPieces] = useMontrerPieces('paravent.montrerPieces')
  const sansPieces = !montrerPieces
  /* Seulement ceux qu'on peut montrer : un lieu sans plan n'a rien à mettre
     à l'écran. Celui qu'on lit reste, comme pour les pièces. */
  const [avecPlan, basculerAvecPlan] = useMontrerPieces('paravent.avecPlan')
  const lieuxLus = lieuxEnArbre.filter(
    ({ p }) =>
      p.id === lieuLu?.id || ((!sansPieces || !estPiece(p)) && (!avecPlan || p.mapItemId != null))
  )
  const filiationLu = useMemo(() => {
    const noms: string[] = []
    for (
      let p = lieuLu ? s.places.find((x) => x.id === lieuLu.parentId) : undefined;
      p && noms.length < 12;
      p = s.places.find((x) => x.id === p!.parentId)
    )
      noms.unshift(p.name)
    return noms.join(' › ')
  }, [lieuLu, s.places])

  const setDone = async (done: boolean): Promise<void> => {
    if (!beat) return
    await window.jdr.timeline.upsertBeat({
      id: beat.id,
      title: beat.title,
      atTime: beat.atTime,
      note: beat.note,
      placeId: beat.placeId,
      done
    })
    await s.refreshTimeline()
  }

  /* Les joueurs d'un lieu, sans les PNJ qui ont une fiche : ceux-là ont leur
     propre rubrique dans la bulle. */
  const joueursIci = (id: number): PionsDuLieu['joueurs'] => {
    const ici = presence[id]
    const pnj = new Set((ici?.pnjs ?? []).map((x) => x.characterId))
    return (ici?.joueurs ?? []).filter((j) => !pnj.has(j.characterId))
  }
  /* La bulle d'un lieu survolé : qui s'y trouve, joueurs puis PNJ. */
  const BulleLieu = ({ id, x, y }: { id: number; x: number; y: number }): JSX.Element | null => {
    const lieuSurvole = s.places.find((p) => p.id === id)
    if (!lieuSurvole) return null
    const joueurs = joueursIci(id)
    const pnjs = presence[id]?.pnjs ?? []
    const visage = (j: { name: string; color: string; url: string | null; cadre: PionsDuLieu['joueurs'][number]['cadre']; initials: string }): JSX.Element => (
      <span className={`jeton c-${j.color}${j.url ? ' photo' : ''}`}>
        {j.url ? <Visage url={j.url} cadre={j.cadre} /> : j.initials}
      </span>
    )
    return (
      <div
        className="pu-bulle"
        role="tooltip"
        style={{ left: x - 10, top: Math.max(70, Math.min(y, window.innerHeight - 70)) }}
      >
        <span className="pu-bulle-nom">{lieuSurvole.name}</span>
        {joueurs.length === 0 && pnjs.length === 0 ? (
          <span className="pu-bulle-vide">Personne ici.</span>
        ) : null}
        {joueurs.length ? (
          <div className="pu-bulle-groupe">
            <span className="eyebrow">Pions · {joueurs.length}</span>
            {joueurs.map((j) => (
              <span key={j.characterId} className="pu-bulle-ligne">
                {visage(j)}
                {j.name}
              </span>
            ))}
          </div>
        ) : null}
        {pnjs.length ? (
          <div className="pu-bulle-groupe">
            <span className="eyebrow">PNJ · {pnjs.length}</span>
            {pnjs.map((j, i) => (
              <span key={`${j.characterId ?? 'n'}-${i}`} className="pu-bulle-ligne">
                {visage(j)}
                {j.name}
              </span>
            ))}
          </div>
        ) : null}
        <span className="pu-bulle-aide">Clic : lire · glisser sur la scène : envoyer</span>
      </div>
    )
  }

  /* La frontière entre la lecture et la régie se tire à la souris. */
  const colonnes = usePoignee({ variable: '--pu-g', cle: 'paravent.largeurGauche', gauche: ':scope > .pu-chrono', min: 420, resteMin: 480, demiEcart: 7 })

  return (
    /* `chrono` n'est pas décoratif : les panneaux, leurs en-têtes et le
       sélecteur à deux boutons ne sont stylés que sous cette classe. */
    <section className="view chrono pupitre">
      <div
        ref={colonnes.ref}
        className="pu-grid"
        data-vue={vue}
        style={colonnes.largeur != null ? ({ '--pu-g': `${colonnes.largeur}px` } as React.CSSProperties) : undefined}
      >
        {colonnes.poignee}
        <div className="seg pu-vue" role="tablist" aria-label="Lire ou jouer">
          <button
            role="tab"
            aria-selected={vue === 'lire'}
            className={vue === 'lire' ? 'on' : ''}
            onClick={() => setVue('lire')}
          >
            <IconDoc />
            Lire
          </button>
          <button
            role="tab"
            aria-selected={vue === 'scene'}
            className={vue === 'scene' ? 'on' : ''}
            onClick={() => setVue('scene')}
          >
            <IconScreen />
            Scène
          </button>
        </div>
        {/* ================= la séance ================= */}
        <div className={`pu-chrono${plein ? ' plein' : ''}`}>
          <aside className="pane">
            <div className="pane-head pu-cote-tete">
              {/* Six onglets dans la largeur du fil : des icônes de même
                  largeur, et le nom de celui qu'on lit écrit dessous. */}
              <div className="seg pu-cote" role="tablist" aria-label="Ce qu’on lit">
                {COTES.map((c) => (
                  <button
                    key={c.id}
                    role="tab"
                    aria-selected={cote === c.id}
                    aria-label={c.nom}
                    className={cote === c.id ? 'on' : ''}
                    onClick={() => setCote(c.id)}
                    title={`${c.nom} — ${c.aide}`}
                  >
                    <c.Icone />
                  </button>
                ))}
              </div>
              <div className="pu-cote-nom">
                <span className="nm">{COTES.find((c) => c.id === cote)?.nom}</span>
                <span className="eyebrow num">
                  {cote === 'chrono'
                    ? `${played} / ${s.beats.length} joués`
                    : cote === 'lieux'
                      ? `${s.places.length} lieux`
                      : cote === 'annexes'
                        ? `${s.annexes.length} documents`
                        : cote === 'dossier'
                          ? `${fichiers.length} fichiers`
                          : cote === 'sons'
                            ? 'touches 1 à 9 · « . » : silence'
                            : `${s.mobile?.devices.length ?? 0} appareils`}
                </span>
              </div>
            </div>
            {/* Les sons tiennent la hauteur en trois étages : seul le dernier défile. */}
            <div className={`pane-body${cote === 'sons' ? ' spx-corps' : ''}`}>
              {cote === 'portables' ? (
                <Portables />
              ) : cote === 'sons' ? (
                <PanneauSons />
              ) : cote === 'dossier' ? (
                /* `regieview` n'est pas décoratif : l'arborescence, ses vignettes
                   et les lignes de dossier ne sont stylées que sous cette classe. */
                <div className="regieview pu-dossier">
                  <div className="tree">
                    {s.tree.map(folderRow)}
                    <div className="vigs">{s.orphans.filter(diffusable).map(fileTile)}</div>
                  </div>
                </div>
              ) : cote === 'lieux' ? (
                <div className="fil">
                  <label className="lieux-filtre pu-filtre">
                    <input
                      type="checkbox"
                      checked={montrerPieces}
                      onChange={(e) => basculerPieces(e.target.checked)}
                    />
                    Montrer les pièces
                  </label>
                  <label className="lieux-filtre pu-filtre">
                    <input
                      type="checkbox"
                      checked={avecPlan}
                      onChange={(e) => basculerAvecPlan(e.target.checked)}
                    />
                    Seulement les lieux ayant un plan
                  </label>
                  {lieuxLus.map(({ p, prof }) => {
                    const ici = joueursIci(p.id)
                    return (
                      <div
                        key={p.id}
                        className={`pu-lieu-ligne${display?.placeId === p.id ? ' direct' : ''}${
                          display?.pendingPlaceId === p.id ? ' pret' : ''
                        }`}
                        onMouseEnter={(e) => {
                          const r = e.currentTarget.getBoundingClientRect()
                          setBulleLieu({ id: p.id, x: r.left, y: r.top + r.height / 2 })
                        }}
                        onMouseLeave={() => setBulleLieu(null)}
                      >
                        <button
                          className={`moment pu-lieu${(lieuLu?.id ?? null) === p.id ? ' on' : ''}`}
                          style={{ '--prof': prof } as React.CSSProperties}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/lieu', String(p.id))
                            e.dataTransfer.effectAllowed = 'copy'
                          }}
                          onClick={() => setLieuVu(p.id)}
                        >
                          <span className="t">
                            <span className="ttl">{p.name}</span>
                            {/* Qui se trouve là : les visages, pas un décompte —
                                sous le nom, qui garde ainsi toute sa largeur. */}
                            {ici.length ? (
                              <span className="seats ici">
                                {ici.map((j) => (
                                  <span
                                    key={j.characterId}
                                    className={`jeton c-${j.color}${j.url ? ' photo' : ''}`}
                                    title={j.name}
                                  >
                                    {j.url ? <Visage url={j.url} cadre={j.cadre} /> : j.initials}
                                  </span>
                                ))}
                              </span>
                            ) : null}
                          </span>
                        </button>
                        <button
                          className="pu-lieu-visuel"
                          onClick={() => void preparePlace(p.id)}
                          title="Afficher dans le visuel libre"
                          aria-label={`Afficher ${p.name} dans le visuel`}
                        >
                          <IconScreen />
                        </button>
                      </div>
                    )
                  })}
                  {lieuxEnArbre.length === 0 ? <p className="vide">Aucun lieu.</p> : null}
                </div>
              ) : cote === 'annexes' ? (
                <div className="fil">
                  {s.annexes.map((a) => (
                    <button
                      key={a.id}
                      className={`moment${(annexe?.id ?? null) === a.id ? ' on' : ''}`}
                      onClick={() => setAnnexeVue(a.id)}
                      title={a.relPath ?? a.title}
                    >
                      <span className="t">
                        <span className="ttl">{a.title}</span>
                      </span>
                    </button>
                  ))}
                  {s.annexes.length === 0 ? (
                    <p className="vide">Aucun document annexe.</p>
                  ) : null}
                </div>
              ) : (
              <ol className="fil">
                {s.beats.map((b) => (
                  <li key={b.id}>
                    <button
                      className={`moment${b.id === beat?.id ? ' on' : ''}${b.done ? ' done' : ''}`}
                      onClick={() => s.setActiveBeat(b.id)}
                    >
                      <span className="h num">{b.atTime ?? '—'}</span>
                      <span className="t">
                        <span className="ttl">{b.title}</span>
                        {b.placeId ? (
                          <span className="sub">
                            {s.places.find((p) => p.id === b.placeId)?.name}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                ))}
                {s.beats.length === 0 ? (
                  <li className="vide">Aucun moment dans cette séance.</li>
                ) : null}
              </ol>
              )}
            </div>
          </aside>

          {plein ? null : (
          <section className="pane lecture">
            {cote === 'lieux' ? (
              /* Au Paravent on lit ; on écrit dans Lieux, ou dans le fichier. */
              lieuLu ? (
                <>
                  <header className="lect-head">
                    <div>
                      <span className="eyebrow">{filiationLu || 'lieu'}</span>
                      <h3 className="display">{lieuLu.name}</h3>
                    </div>
                    <div className="spacer" />
                    <button
                      className={`btn btn-sm${display?.pendingPlaceId === lieuLu.id ? ' btn-on' : ''}`}
                      onClick={() => void preparePlace(lieuLu.id)}
                      title="Préparer ce lieu dans le visuel libre"
                    >
                      <IconScreen />
                      Afficher dans le visuel
                    </button>
                  </header>
                  {/* Ses images à montrer — et celles de son étage, pour une pièce. */}
                  {imagesLieuLu.length ? (
                    <div className="pu-montrer">
                      <div className="pu-sect">
                        <span className="eyebrow">À montrer</span>
                        <span className="pu-line" />
                      </div>
                      <div className="pu-etagere">{imagesLieuLu.map(vignetteVisuel)}</div>
                    </div>
                  ) : null}
                  <div className="lect-body lect-lieu">
                    {/* La fiche du lieu, simplifiée : on y coche et on y montre ;
                        on l'écrit dans Lieux. */}
                    <FicheCompacte
                      key={lieuLu.id}
                      p={lieuLu}
                      onChanger={setLieuVu}
                      onMontrer={(item, titre, x, y) => setCibleImage({ item, titre, x, y })}
                      avant={
                        <article className="read pu-lieu-lecture">
                          <h4>Ce que voient les joueurs</h4>
                          <TexteDeLieu texte={lieuLu.summary} />
                        </article>
                      }
                      apres={
                        <article className="read pu-lieu-lecture">
                          <h4>Notes du MJ</h4>
                          <TexteDeLieu texte={lieuLu.notes} />
                        </article>
                      }
                    />
                  </div>
                </>
              ) : (
                <div className="vide-grand">
                  Aucun lieu.
                  <br />
                  Crée-les dans Lieux.
                </div>
              )
            ) : cote === 'annexes' ? (
              /* Au Paravent on lit ; on écrit dans Préparation › Annexes. */
              annexe ? (
                <>
                  <header className="lect-head">
                    <div>
                      <span className="eyebrow">document annexe</span>
                      <h3 className="display">{annexe.title}</h3>
                    </div>
                  </header>
                  <div className="lect-body">
                    <article className="read">
                      <div
                        className="read-body"
                        dangerouslySetInnerHTML={{
                          __html: annexe.body || '<p class="rien">Ce texte est vide.</p>'
                        }}
                      />
                    </article>
                  </div>
                </>
              ) : (
                <div className="vide-grand">
                  Aucun document annexe.
                  <br />
                  Ajoute-les dans Préparation de la séance › Annexes.
                </div>
              )
            ) : beat ? (
              <>
                <header className="lect-head">
                  <div>
                    <span className="eyebrow">
                      {beat.atTime ? `${beat.atTime} · ` : ''}
                      {lieu?.name ?? 'sans lieu'}
                    </span>
                    <h3 className="display">{beat.title}</h3>
                  </div>
                  <div className="spacer" />
                  <button
                    className={`btn btn-sm${beat.done ? ' btn-on' : ''}`}
                    onClick={() => void setDone(!beat.done)}
                    title={beat.done ? 'Joué' : 'Marquer comme joué'}
                  >
                    <IconCheck />
                    {beat.done ? 'Joué' : 'Jouer'}
                  </button>
                </header>

                {/* Ce que le moment a à montrer, juste sous son titre : son lieu,
                    ses images, ses PNJ en scène et ses sons — préparés dans la
                    Chronologie, envoyés d'ici. */}
                <div className="pu-montrer">
                  <div className="pu-sect">
                    <span className="eyebrow">À montrer</span>
                    <span className="pu-line" />
                    {display?.fenetres.length ? (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => void window.jdr.display.fermerFenetre()}
                        title={`Retirer de l’écran des joueurs : ${display.fenetres
                          .map((f) => `« ${f.title} »`)
                          .join(', ')}`}
                      >
                        <IconClose />
                        {display.fenetres.length > 1
                          ? `Fermer les ${display.fenetres.length} fenêtres`
                          : 'Fermer la fenêtre'}
                      </button>
                    ) : null}
                    <button className="btn btn-ghost btn-sm" onClick={() => setChoix(true)}>
                      <IconSearch />
                      Bibliothèque…
                    </button>
                  </div>
                  <div className="pu-etagere">
                    {lieu ? (
                      <button
                        className="pu-vig pu-lieu"
                        onClick={() => void preparePlace(lieu.id)}
                        title={`Préparer ${lieu.name} — ses pions reviennent avec lui`}
                      >
                        {carte?.url ? <img src={carte.poster ?? carte.url} alt="" /> : <span className="pu-rien" />}
                        <span className="pu-kind">lieu</span>
                        <span className="pu-nom">{lieu.name}</span>
                      </button>
                    ) : null}

                    {visuels.map(vignetteVisuel)}

                    {pnjsEnScene.map((c) => {
                      const photo = s.allItems.find((i) => i.id === c.portraitItemId)
                      return (
                        <button
                          key={c.id}
                          className="pu-vig pu-pnj"
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/pion-char', String(c.id))
                            e.dataTransfer.effectAllowed = 'copy'
                          }}
                          onClick={(e) =>
                            photo
                              ? setCibleImage({
                                  item: photo,
                                  titre: c.name,
                                  x: e.clientX,
                                  y: e.clientY,
                                  pnj: true
                                })
                              : undefined
                          }
                          title={
                            photo
                              ? `${c.name} — clic : son portrait sur le visuel libre ou en fenêtre sur le direct ; glisser sur la scène : son pion`
                              : `${c.name} n’a pas de portrait — glisse-le sur la scène pour poser son pion`
                          }
                        >
                          {photo?.url ? (
                            <img src={photo.url} alt="" draggable={false} />
                          ) : (
                            <span className="pu-initiales">{initials(c.name)}</span>
                          )}
                          <span className="pu-kind">pnj</span>
                          <span className="pu-nom">{c.name}</span>
                        </button>
                      )
                    })}

                    {joueursAPresenter.map((c) => {
                      const photo = s.allItems.find((i) => i.id === c.portraitItemId)
                      const presente = estPresente(c.id)
                      return (
                        <button
                          key={c.id}
                          className={`pu-vig pu-pnj${presente ? ' on' : ''}`}
                          aria-pressed={presente}
                          onClick={() =>
                            presente ? void window.jdr.display.arreterPresentation() : presenterLeJoueur(c)
                          }
                          title={
                            presente
                              ? `Arrêter la présentation de ${c.name} : l’écran revient à ce qu’il montrait avant`
                              : `Présenter ${c.name} à l’écran : son portrait, son nom et ses émojis, en direct`
                          }
                        >
                          {photo?.url ? (
                            <img src={photo.url} alt="" draggable={false} />
                          ) : (
                            <span className="pu-initiales">{initials(c.name)}</span>
                          )}
                          <span className="pu-kind">{presente ? 'à l’écran' : 'joueur'}</span>
                          <span className="pu-nom">{c.name}</span>
                        </button>
                      )
                    })}

                    {sons.length ? (
                      <div className="pu-sons">
                        {sons.map((it) => (
                          <button
                            key={it.id}
                            className={`pu-son${audio?.itemId === it.id && audio.playing ? ' on' : ''}`}
                            onClick={() => void poser(it)}
                            title="Lancer cette ambiance"
                          >
                            {kindIcon('audio')}
                            <span className="t">{it.title}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {!lieu &&
                    visuels.length === 0 &&
                    pnjsEnScene.length === 0 &&
                    joueursAPresenter.length === 0 &&
                    sons.length === 0 ? (
                      <p className="pu-vide">
                        Rien à montrer pour ce moment — prépare-le dans la Chronologie, ou prends dans la bibliothèque.
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="lect-body">
                  {beat.note ? <p className="mine">{beat.note}</p> : null}
                  {docs.map((d) => (
                    <article key={d.id} className="read">
                      {/* On lit au Paravent ; on écrit dans la Chronologie. */}
                      <h4>
                        <IconDoc />
                        {d.title}
                      </h4>
                      <div
                        className="read-body"
                        dangerouslySetInnerHTML={{
                          __html: d.body || '<p class="rien">Ce texte est vide.</p>'
                        }}
                      />
                    </article>
                  ))}
                  {!beat.note && docs.length === 0 ? (
                    <p className="vide-grand">
                      Rien à lire pour ce moment.
                      <br />
                      Ce qu’il a à montrer est juste au-dessus.
                    </p>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="vide-grand">Aucun moment dans cette séance.</div>
            )}
          </section>
          )}
        </div>

        {/* ================= l'écran des joueurs ================= */}
        <section className="pane pu-regie">
          {/* ---- la barre de la régie ---- */}
          <div className="pu-bar stage-bar">
            {/* Le visuel qu'on arrange. Le direct porte son point rouge ; ce
                qu'il montre se lit au moniteur du rail, et « À suivre » dans
                la console. */}
            <div className="seg pu-visuels">
              {([0, 1] as const).map((n) => (
                <button
                  key={n}
                  className={visuel === n ? 'on' : ''}
                  aria-pressed={visuel === n}
                  onClick={() => setVisuel(n)}
                  title={
                    n === liveSlot
                      ? `Visuel ${n + 1} — ce que les joueurs ont sous les yeux : chaque geste part aussitôt`
                      : `Visuel ${n + 1} — libre : rien ne part avant la bascule`
                  }
                >
                  {n === liveSlot ? <span className="point" /> : null}
                  Visuel {n + 1}
                </button>
              ))}
            </div>

            {/* Pas de dispositions au Paravent : on y joue un plan, pas un
                collage. Elles restent à la Régie. */}
            <button
              className={`btn btn-sm${voirScene ? ' btn-on' : ''}`}
              onClick={basculerScene}
              aria-pressed={voirScene}
              title={
                !calque?.murs.length
                  ? 'Portes, fenêtres et lumières — ce lieu n’a pas de murs.'
                  : voirScene
                    ? 'Refermer le tiroir — Échap'
                    : 'Ouvrir par-dessus la carte les portes, fenêtres et lumières du lieu'
              }
            >
              <IconPorte />
              Portes et lumières
            </button>
            <BoutonObjets
              on={panneau === 'objets'}
              placeId={editPlaceId}
              onClick={() => basculerPanneau('objets')}
            />
            {/* Les sons sous la main sans quitter le fil : le même panneau que
                l'onglet Sons, en tiroir sur la carte. */}
            <button
              className={`btn btn-sm${panneau === 'sons' ? ' btn-on' : ''}`}
              onClick={() => basculerPanneau('sons')}
              aria-pressed={panneau === 'sons'}
              title={
                panneau === 'sons'
                  ? 'Refermer les sons — Échap'
                  : 'Ouvrir par-dessus la carte ce qui joue, les sons du lieu et ceux de la séance'
              }
            >
              <IconNote />
              Sons
            </button>
            <BoutonTours />
            <button
              className={`btn btn-sm${trameOuverte ? ' btn-on' : ''}`}
              aria-pressed={trameOuverte}
              onClick={() => setTrameOuverte(true)}
              title="L’arborescence de la séance : cocher ce qui est fait, voir ce qui est à portée — pour toi seul"
            >
              <IconTrame />
              Arborescence
            </button>
            <span className="sep" />
            {/* Sans libellé, comme les dispositions voisines : la barre passait
                à la ligne dès qu'on lui ajoutait un mot. */}
            <button
              className="btn btn-sm pivot"
              disabled={!pivotable}
              onClick={pivoter}
              aria-label="Pivoter d’un quart de tour"
              title={
                pivotable
                  ? 'Pivoter d’un quart de tour — sur l’image visée ; double-clic sur l’image pour la remettre droite'
                  : 'Rien à pivoter sur ce visuel'
              }
            >
              <IconRotate />
            </button>

            {/* La luminosité appartient à l'image, pas à l'écran : une carte
                scannée trop sombre s'éclaircit ici, et la correction la suit
                partout — au moniteur, chez les joueurs, et si on la bascule. */}
            <label
              className={`lum${pivotable ? '' : ' off'}`}
              title={
                pivotable
                  ? 'Éclaircit ou assombrit l’image visée — de 30 % à 250 %'
                  : 'Rien à corriger sur ce visuel'
              }
            >
              <span className="eyebrow">Luminosité</span>
              <input
                type="range"
                min={LUM_MIN * 100}
                max={LUM_MAX * 100}
                step={5}
                value={lum}
                disabled={!pivotable}
                onChange={(e) => poseLum(Number(e.target.value))}
              />
              <Valeur
                className={`val num${lum !== 100 ? ' corrige' : ''}`}
                value={lum}
                min={LUM_MIN * 100}
                max={LUM_MAX * 100}
                step={5}
                unite=" %"
                disabled={!pivotable}
                label="Luminosité de l’image"
                onChange={poseLum}
              />
              <button
                type="button"
                className="btn btn-sm lum-neutre"
                disabled={!pivotable || lum === 100}
                onClick={() => poseLum(100)}
                aria-label="Remettre la luminosité à 100 %"
                title="Revenir à l’image d’origine — 100 %"
              >
                <IconRetour />
              </button>
            </label>

            {avecApparences ? <SelecteurApparence porteur={avecApparences} /> : null}

            {/* Comme en Régie : ouvrir l'écran des joueurs sans quitter la scène. */}
            <div className="spacer" />
            {/* Sans libellé : la barre passait à la ligne dès qu'on lui
                ajoutait un mot. L'info-bulle dit ce qu'il fait et où. */}
            <button
              className={`btn btn-sm btn-ico${display?.playerOpen ? ' btn-on' : ''}`}
              aria-label={display?.playerOpen ? 'Fermer l’écran joueurs' : 'Projeter l’écran joueurs'}
              onClick={() => void window.jdr.display.togglePlayer()}
              title={`${display?.playerOpen ? 'Fermer' : 'Projeter'} l’écran joueurs — ${
                sortie ? `${sortie.label} · ${sortie.width}×${sortie.height}` : 'sortie automatique'
              } · F5`}
            >
              <IconExpand />
            </button>
            {/* Toutes les cases de ce qui se montre, à droite de Projeter. */}
            <BoutonAffichage />
          </div>

          {/* ---- les tours : à qui de jouer ---- */}
          <Tours />
          {trameOuverte ? <TrameEnJeu onClose={() => setTrameOuverte(false)} /> : null}

          {/* ---- la grande scène : celle qu'on arrange ---- */}
          {/* Le tableau de scène, les objets ou les sons, en volet à gauche de
              la carte : elle leur cède la place plutôt que d'être recouverte. */}
          <div className="big-avec-tableau pu-avec-tableau">
            {voirScene && calque?.murs.length ? (
              <TableauDeScene
                calque={calque}
                placeId={editPlaceId}
                lieux={s.places.filter((p) => p.parentId === editPlaceId)}
                survol={survol}
                onSurvol={setSurvol}
              />
            ) : null}
            {panneau === 'objets' ? (
              <ObjetsDeScene
                placeId={editPlaceId}
                onSurvol={setSurvol}
                onMontrer={(item, titre, x, y) => setCibleImage({ item, titre, x, y })}
              />
            ) : null}
            {panneau === 'sons' ? (
              <aside className="tableau sons-scene">
                <PanneauSons />
              </aside>
            ) : null}
          <div
            className={`big-frame${onLive ? ' live' : ''}`}
            style={{ ['--ecran' as string]: ecran }}
          >
            <div className="big-inner">
              <div
                className={`big-stage${pointing ? ' pointing' : ''}`}
                onMouseMove={onStageMove}
                onMouseLeave={() => sendPointer(null)}
              >
                {/* Les ondes ne se voient que sur l'écran qu'on regarde vraiment :
                    sur la préparation, elles désigneraient une autre image. */}
                {onLive ? <Pings pings={ondes.pings} /> : null}
                <Slide
                  slide={slideVu}
                  /* Le calque est toujours donné : les murs retiennent les pions.
                     L'ombre seule s'allume au bouton « Voir ce qu'ils voient ». */
                  brouillard={calque}
                  ombre={leurOeil && display?.vision !== 'jour'}
                  jour={display?.vision === 'jour'}
                  surbrillance={survol}
                  pions={edit.pions}
                  pionSize={edit.size}
                  /* Comme en Régie : la caméra ne suit que la scène à
                     l'antenne, jamais celle qu'on prépare. */
                  focusPionId={onLive ? (display?.focusPionId ?? null) : null}
                  /* Le halo de celui qui joue, comme chez les joueurs. */
                  pionEnJeuId={onLive ? pionEnJeu(s.tours, edit.pions) : null}
                  onDefocus={() => void window.jdr.pions.focus(null)}
                  pionLabels={display?.pionLabels ?? true}
                  pionPv={display?.pionPv ?? false}
                  joueurs={display?.joueurs}
                  encart={display?.encart}
                  onMoveEncart={(x, y) => void window.jdr.display.encart({ x, y })}
                  onMenuEncart={(x, y) => setMenuEncart({ x, y })}
                  onSizeEncart={(largeur, hauteur) =>
                    void window.jdr.display.encart({ largeur, hauteur })
                  }
                  fenetres={onLive ? display?.fenetres : null}
                  onFenetre={(id, patch) => void window.jdr.display.reglerFenetre(id, patch)}
                  onFermerFenetre={(id) => void window.jdr.display.fermerFenetre(id)}
                  pointer={pointer}
                  onDropAt={(e, x, y, cell) => void dropOnStage(e, x, y, cell)}
                  onRemovePion={(id) => void removePion(id)}
                  onRotatePion={(id, deg) => void tournerPion(id, deg)}
                  onPionMenu={(pion, x, y) => setCiblePion({ pion, x, y })}
                  onPionClic={(pion) =>
                    setChoisi((c) =>
                      c?.pionId === pion.id ? null : { pionId: pion.id, characterId: pion.characterId }
                    )
                  }
                  pionChoisiId={choisi?.pionId ?? null}
                  activeCell={onLive ? undefined : activeCell}
                  onPickCell={onLive ? undefined : setActiveCell}
                  /* La molette agrandit, le glisser recadre ; les textes se
                     déplacent et se choisissent sur l'image — comme en Régie. */
                  onFrame={(cell, f) =>
                    zoomMj && onLive && cell == null
                      ? setCadreMj(f)
                      : void window.jdr.display.frame(onLive ? 'live' : 'prep', cell, f)
                  }
                  onMoveText={textes.bouge}
                  activeText={textes.over?.id ?? null}
                  onPickText={textes.choisit}
                  onPoserSurCarte={lampe.poser ?? poserObjet}
                  lumieresMJ
                  traitsMj={traits}
                  /* Les pièces de l'étage qu'on arrange, là où on les a nommées. */
                  nomsPieces={s.places
                    .filter((p) => p.parentId === editPlaceId && p.ancre)
                    .map((p) => ({ nom: p.name, x: p.ancre![0], y: p.ancre![1] }))}
                  sonsMj={sonsScene}
                  objetsMj={objetsVises}
                  articlesMj={articlesScene}
                />
                {/* Par-dessus la scène, jamais dedans : le calque du MJ ne fait
                    pas partie de la diapositive, donc il ne part nulle part.
                    Même cadrage que l'image diffusée, pour que les repères la
                    suivent au zoom. */}
                {voirAnnots && carteScene?.url ? (
                  <CadreAnnote
                    url={carteScene.url}
                    className={`sur-scene${annot.outil ? ' arme' : ''}`}
                    frame={'frame' in slideVu ? (slideVu.frame ?? FRAME_NEUTRE) : FRAME_NEUTRE}
                  >
                    <Annotations
                      annotations={annot.annots}
                      mode="edition"
                      outil={annot.outil}
                      choisi={annot.choisie}
                      onChoisir={annot.setChoisie}
                      onPoser={(k, x, y) => void annot.poser(k, x, y)}
                      onDeplacer={(id, x, y) => void annot.deplacer(id, x, y)}
                      onEffacer={(id) => void annot.effacer(id)}
                    />
                  </CadreAnnote>
                ) : null}
              </div>
            </div>
            <span className={`big-badge live-pill ${onLive ? pillClass : 'prep'}`}>
              <span className="dot" />
              Visuel {visuel + 1} — {onLive ? pillText : 'libre, invisible des joueurs'}
            </span>
            {/* Les outils de la carte, posés sur elle : ils changent ce que fait
                la souris sur la scène ou ce qu'on y voit. Nommés, en colonne
                (choix de Jules, 17 oct.) ; la bascule et le voile restent dans
                la console. */}
            <div className="pu-outils" role="toolbar" aria-label="Outils de la carte">
              {/* Le pointeur avait son raccourci, pas son bouton : on doit
                  pouvoir l'allumer sans connaître la touche. */}
              <button
                className={`btn btn-sm${pointing ? ' btn-on' : ''}`}
                aria-pressed={pointing}
                onClick={() => setPointing((v) => !v)}
                title="Montre du doigt aux joueurs ce que la souris survole sur la scène — P, ou maintiens Ctrl le temps d’un geste"
              >
                <IconSearch />
                Pointeur
                <span className="kbd">P</span>
              </button>
              {/* Le brouillard s'applique tout seul dès qu'un lieu a des murs :
                  ce bouton te met un instant à la place des joueurs. */}
              <button
                className={`btn btn-sm${leurOeil ? ' btn-on' : ''}`}
                aria-pressed={leurOeil}
                onClick={() => setLeurOeil((v) => !v)}
                disabled={!calque?.murs.length}
                title={
                  !calque?.murs.length
                    ? 'Ce lieu n’a pas de murs : les joueurs voient la carte entière'
                    : leurOeil
                      ? 'Revenir au plan entier — c’est de là que tu mènes'
                      : 'Voir ce qu’ils voient : poser sur ta prévisualisation l’ombre exacte de leur écran'
                }
              >
                <IconEye />
                Leur vue
              </button>
              <span className="pu-outils-sep" />
              <button
                className={`btn btn-sm${voirAnnots ? ' btn-on' : ''}`}
                aria-pressed={voirAnnots}
                onClick={() => setVoirAnnots((v) => !v)}
                disabled={editPlaceId == null}
                title={
                  editPlaceId == null
                    ? 'Prépare d’abord le lieu où se tient la scène'
                    : 'Tes repères et tes textes sur la carte — chez toi seulement, jamais chez les joueurs'
                }
              >
                <IconPen />
                Annoter
              </button>
              <BoutonTextes t={textes} petit />
              <BoutonPoserLumiere p={lampe} petit court />
              <span className="pu-outils-sep" />
              {/* Regarder de près sans que la table suive. */}
              <button
                className={`btn btn-sm${zoomMj ? ' btn-on' : ''}`}
                aria-pressed={zoomMj}
                onClick={() => setZoomMj((v) => !v)}
                title={
                  zoomMj
                    ? 'Le zoom du direct ne vaut que pour toi — cliquer pour que les joueurs suivent de nouveau'
                    : 'Bloquer le zoom MJ : zoomer et recadrer le direct pour toi seul, l’écran des joueurs ne bouge pas'
                }
              >
                <IconVerrou />
                Zoom MJ
              </button>
            </div>
          </div>
          </div>

          {/* ---- les volets, sous la scène, quand on les demande ---- */}
          <VoletCase slide={slide} iCase={iCase} onLive={onLive} />
          {textes.ouvert ? <VoletTextes t={textes} onLive={onLive} /> : null}
          {voirAnnots ? <VoletAnnoter a={annot} /> : null}

          {/* ---- la réserve de pions ---- */}
          {choixPnj ? (
            <ChoixPnj
              enScene={enScene}
              onClose={() => setChoixPnj(false)}
            />
          ) : null}
          <div className="tray pu-tray">
            <span className="eyebrow">Pions</span>
            <div className="tray-pions">
              {reservePions.map((c) => {
                const placed = placedChars.has(c.id)
                /* Posé ailleurs : le glisser ici le déménagera, autant le dire
                   avant plutôt que de le voir disparaître d'un autre lieu. */
                const parti = placed || editPlaceId == null ? null : ailleurs(c.id, editPlaceId)
                const photo = s.allItems.find((i) => i.id === c.portraitItemId)
                return (
                  <span key={c.id} className="tray-tok">
                    <div
                      className={`tok teinte c-${c.color ?? 'neutral'}${placed ? ' placed' : ''}${
                        enScene.size && rang(c) === 2 ? ' en-retrait' : ''
                      }${
                        photo ? ' photo' : ''
                      }`}
                      draggable={!placed}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/pion-char', String(c.id))
                        e.dataTransfer.effectAllowed = 'copy'
                      }}
                      onDragEnter={(e) => void accepteSi(e, 'text/pion-item')}
                      onDragOver={(e) => void accepteSi(e, 'text/pion-item')}
                      onDrop={(e) => void setPhoto(e, c.id)}
                      onClick={() => {
                        const pose = edit.pions.find((x) => x.characterId === c.id)
                        setChoisi((ch) =>
                          ch?.characterId === c.id ? null : { pionId: pose?.id ?? null, characterId: c.id }
                        )
                      }}
                      title={
                        placed
                          ? `${c.name} — déjà sur la table`
                          : parti
                            ? `${c.name} — actuellement à ${parti.lieu} ; le poser ici l’y fera quitter`
                            : photo
                              ? c.name
                              : `${c.name} — glisse une image ici pour lui donner sa photo`
                      }
                    >
                      {photo?.url ? <img src={photo.url} alt="" draggable={false} /> : initials(c.name)}
                    </div>
                    {c.kind === 'pnj' ? <RetirerDeLaReserve c={c} onRetirer={() => reserve.retirer(c.id)} /> : null}
                  </span>
                )
              })}

              <button
                type="button"
                className="tok neuf"
                title="Ajouter des PNJ à la ligne des pions"
                onClick={() => setChoixPnj(true)}
              >
                +
              </button>
            </div>

            {/* Les gestes s'apprennent au survol ; seul l'empêchement se dit. */}
            {editPlaceId == null ? <span className="note">Prépare un lieu pour poser des pions.</span> : null}

            <span className="sep" />
            <label className="size" title="Taille des pions de ce lieu">
              <span className="eyebrow">Taille</span>
              <input
                type="range"
                min={2}
                max={20}
                step={0.5}
                value={edit.size}
                disabled={editPlaceId == null}
                onChange={async (e) => {
                  if (editPlaceId == null) return
                  await window.jdr.pions.size(editPlaceId, Number(e.target.value))
                  await refreshEdit()
                }}
              />
              <Valeur
                className="val num"
                value={edit.size}
                min={2}
                max={20}
                step={0.5}
                decimales={1}
                unite=" %"
                disabled={editPlaceId == null}
                label="Taille des pions"
                onChange={async (v) => {
                  if (editPlaceId == null) return
                  await window.jdr.pions.size(editPlaceId, v)
                  await refreshEdit()
                }}
              />
            </label>
            <TailleEchelle placeId={editPlaceId} size={edit.size} onFait={refreshEdit} />

            <span className="sep" />
            {/* Noms et PV sous les pions : dans « Affichage », avec le reste. */}

            <div className="spacer" />
            <span className="eyebrow">
              {edit.pions.length
                ? `${edit.pions.length} sur ${s.places.find((p) => p.id === editPlaceId)?.name ?? ''}`
                : ''}
            </span>
            <button
              className="btn btn-sm btn-danger"
              disabled={!edit.pions.length}
              onClick={() => void clearPions()}
            >
              <IconTrash />
              Retirer
            </button>
          </div>

          {/* ---- le détail du pion choisi ----
              Il prend la hauteur qui reste sous la réserve, et défile en
              lui-même : la scène ne lui cède rien. */}
          {choisi ? (
            <div className="pu-detail">
              <DetailPion
                pion={choisi.pionId != null ? (edit.pions.find((x) => x.id === choisi.pionId) ?? null) : null}
                ch={choisi.characterId != null ? (s.characters.find((c) => c.id === choisi.characterId) ?? null) : null}
                focusId={display?.focusPionId ?? null}
                onFerme={() => setChoisi(null)}
                onFait={async () => {
                  await refreshPresence()
                  await refreshEdit()
                }}
                pose={editPlaceId != null ? { arme: objetAPoser, armer: setObjetAPoser } : undefined}
              />
            </div>
          ) : null}

          <ConsoleDirect apres={setVisuel} />
        </section>
      </div>

      {choix ? (
        /* Ce que le moment n'a pas sous la main, cherché dans l'arborescence. */
        <ChoixDansArbre
          titre="Prendre dans la bibliothèque"
          icone={<IconSearch />}
          kinds={['image', 'video', 'audio']}
          rendu="vignettes"
          courant={null}
          onClose={() => setChoix(false)}
          onPick={async (id) => {
            setChoix(false)
            const it = id == null ? null : s.allItems.find((i) => i.id === id)
            if (it) await poser(it)
          }}
        />
      ) : null}
      <MenuImage
        cible={cibleImage}
        onFerme={() => setCibleImage(null)}
        onPreparer={poser}
        libre={idleSlot + 1}
        direct={liveSlot + 1}
        /* Sur le direct, tout de suite, à la place de ce qu'il montre — et on
           l'a sous les yeux. */
        onDirect={async (it) => {
          if (frozen) {
            s.toast('Image figée — dégèle d’abord pour changer l’écran joueurs', true)
            return
          }
          await window.jdr.display.showItem(it.id)
          setVisuel(liveSlot)
        }}
        /* La fenêtre s'ouvre sur le direct : c'est lui qu'on veut avoir sous
           les yeux pour la placer, pas le visuel libre. */
        onFenetre={async (it) => {
          await window.jdr.display.fenetre(it.id)
          setVisuel(liveSlot)
        }}
      />
      {bulleLieu ? <BulleLieu {...bulleLieu} /> : null}
      {menuEncart ? <MenuEncart {...menuEncart} onFerme={() => setMenuEncart(null)} /> : null}
      <MenuPion
        cible={ciblePion}
        focusId={display?.focusPionId ?? null}
        onFerme={() => setCiblePion(null)}
        onFait={async () => {
          await refreshPresence()
          await refreshEdit()
        }}
      />
    </section>
  )
}

/**
 * Le menu de l'encart des joueurs, ouvert d'un clic sur lui dans la scène :
 * en ligne ou en colonne, et le remettre à sa place. La place et la taille,
 * elles, se prennent toujours à la main sur l'image.
 */
function MenuEncart({ x, y, onFerme }: { x: number; y: number; onFerme: () => void }): JSX.Element {
  const zone = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const dehors = (e: MouseEvent): void => {
      if (zone.current && !zone.current.contains(e.target as Node)) onFerme()
    }
    window.addEventListener('mousedown', dehors)
    return () => window.removeEventListener('mousedown', dehors)
  }, [onFerme])
  useEchap(onFerme)
  return (
    <div
      ref={zone}
      className="menu-encart"
      role="dialog"
      aria-label="L’encart des joueurs"
      /* Sous l'encart, centré sur lui ; s'il touche le bas, il remonte juste ce qu'il faut. */
      style={{
        left: Math.max(190, Math.min(x, window.innerWidth - 190)),
        top: Math.min(y + 6, window.innerHeight - 90)
      }}
    >
      <span className="eyebrow">Encart des joueurs</span>
      <div className="menu-encart-ligne">
        <SensEncart />
      </div>
    </div>
  )
}

/* Les onglets du fil, à gauche du Paravent. Les portables se règlent sans
   quitter la scène, comme en Régie. */
const COTES = [
  { id: 'chrono', nom: 'Chronologie', aide: 'le fil de la séance', Icone: IconTimeline },
  { id: 'lieux', nom: 'Lieux', aide: 'ce que voient les joueurs, qui est où, et le visuel', Icone: IconPlace },
  { id: 'annexes', nom: 'Annexes', aide: 'les documents gardés sous la main', Icone: IconDoc },
  { id: 'dossier', nom: 'Dossier', aide: 'les fichiers de la campagne', Icone: IconFolder },
  { id: 'portables', nom: 'Portables', aide: 'fiches, jets et pions depuis le téléphone', Icone: IconPhone },
  { id: 'sons', nom: 'Sons', aide: 'ambiance, nappes, bruitages et sons posés sur le plan', Icone: IconNote }
] as const

/**
 * Le texte d'un lieu, tel qu'on l'a tapé ou écrit dans son fichier : une ligne
 * vide sépare deux paragraphes, un retour simple reste un retour.
 */
function TexteDeLieu({ texte }: { texte: string | null }): JSX.Element {
  const paras = (texte ?? '')
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (paras.length === 0) return <p className="rien">Rien d’écrit.</p>
  return (
    <TexteCourt lignes={4} className="read-body">
      {paras.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </TexteCourt>
  )
}

/**
 * Les découvertes, déclencheurs et scénarios posés sur le plan du lieu en
 * scène et de ses pièces, en fractions de la carte. Chaque fiche se lit à
 * part ; on relit tout quand un article est posé, coché ou réécrit.
 */
function useArticlesSurCarte(placeId: number | null, lieux: number[]): ArticleSurCarte[] {
  const [articles, setArticles] = useState<ArticleSurCarte[]>([])
  const cle = lieux.join(',')
  useEffect(() => {
    setArticles([])
    if (placeId == null || !lieux.length) return
    let vivant = true
    const relire = async (): Promise<void> => {
      const fiches = await Promise.all(lieux.map((id) => window.jdr.fiche.lire(id)))
      if (!vivant) return
      setArticles(
        fiches.flatMap((f): ArticleSurCarte[] => [
          ...f.cartes.flatMap((c): ArticleSurCarte[] =>
            c.pos
              ? [
                  {
                    cle: `c${c.id}`,
                    x: c.pos.x,
                    y: c.pos.y,
                    genre: c.sorte,
                    titre: c.titre,
                    si: c.si,
                    alors: c.alors,
                    fait: c.fait
                  }
                ]
              : []
          ),
          ...f.scenarios.flatMap((sc, i): ArticleSurCarte[] =>
            sc.pos
              ? [
                  {
                    cle: `s${sc.id}`,
                    x: sc.pos.x,
                    y: sc.pos.y,
                    genre: 'scenario',
                    num: i + 1,
                    titre: sc.titre || 'Sans titre',
                    info: sc.info,
                    fait: sc.fait
                  }
                ]
              : []
          )
        ])
      )
    }
    void relire()
    const h = (): void => void relire()
    window.addEventListener(ARTICLES_SITUES, h)
    window.addEventListener('jdr:defait', h)
    const lache = window.jdr.fiche.onRelue(h)
    return () => {
      vivant = false
      window.removeEventListener(ARTICLES_SITUES, h)
      window.removeEventListener('jdr:defait', h)
      lache()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeId, cle])
  return articles
}
