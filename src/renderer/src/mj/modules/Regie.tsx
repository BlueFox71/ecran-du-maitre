import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { MenuPion, type CiblePion } from '../components/MenuPion'
import { TableauDeScene, type Surbrillance } from '../components/Tableau'
import { Slide } from '../../shared/Slide'
import { Pings, usePings } from '../../shared/Pings'
import { decorDossier, folderIcon } from '../components/FolderIcons'
import { Annotations, CadreAnnote, type OutilAnnotation } from '../components/Annotations'
import { slideLabel } from '../components/Monitor'
import { IconPhone, Portables } from '../components/Portables'
import {
  IconAudio,
  IconChevron,
  IconCercle,
  IconEye,
  IconEyeOff,
  IconExpand,
  IconFade,
  IconFreeze,
  IconPen,
  IconPlus,
  IconRetour,
  IconRotate,
  IconSearch,
  IconStop,
  IconTrash,
  IconType,
  kindIcon
} from '../components/Icons'
import {
  COLLAGE_CELLS,
  FRAME_NEUTRE,
  LUM_MAX,
  LUM_MIN,
  PION_COULEURS,
  TEXTE_COULEURS,
  TEXTE_NEUF,
  TRANSITIONS,
  texteNeuf
} from '@shared/types'
import type {
  CalqueBrouillard,
  Annotation,
  CollageLayout,
  Frame,
  Pion,
  PionsDuLieu,
  Place,
  Pointer,
  TextOverlay
} from '@shared/types'
import type { UiFolder, UiItem } from '../../../../preload/index'

/* ============================================================
   Régie : ce que voient les joueurs, le lieu où se tient la scène,
   et le dossier de campagne. Les pions se posent à la main sur l'image.
   ============================================================ */

type Tab = 'lieux' | 'arbre' | 'portables'

/**
 * Accepter un lâcher demande deux choses, et Chromium n'en pardonne aucune :
 * annuler l'événement **dès `dragenter`** — sinon il cesse d'envoyer les
 * `dragover` et la cible reste morte — et poser un `dropEffect`, sans quoi il
 * remplace le lâcher par un `dragleave`, silencieusement.
 */
export function accepteSi(e: React.DragEvent, type: string): boolean {
  if (!e.dataTransfer.types.includes(type)) return false
  e.preventDefault()
  e.dataTransfer.dropEffect = 'copy'
  return true
}

/** Une carte d'écran prend un lieu ; celle en préparation prend aussi une image. */
function accepte(e: React.DragEvent, live: boolean): boolean {
  const t = e.dataTransfer.types
  if (!t.includes('text/lieu') && (live || !t.includes('text/media-item'))) return false
  e.preventDefault()
  e.dataTransfer.dropEffect = 'copy'
  return true
}

/**
 * À quelle profondeur ce lieu se trouve dans l'arbre — en remontant vraiment
 * ses contenants, et non en se fiant à son étage déclaré : un lieu qu'on n'a
 * rangé nulle part est à la racine, quoi qu'en dise son étiquette.
 */
export function profondeur(p: Place, tous: Place[]): number {
  let d = 0
  let cur: Place | undefined = p
  const vus = new Set<number>()
  while (cur?.parentId != null && !vus.has(cur.id)) {
    vus.add(cur.id)
    cur = tous.find((x) => x.id === cur!.parentId)
    if (cur) d++
  }
  return Math.min(d, 2)
}

export function Regie(): JSX.Element {
  const s = useStore()
  const display = s.display

  const [tab, setTab] = useState<Tab>('lieux')
  /* Les ondes des joueurs : le MJ doit voir où on lui montre, sinon il n'a
     que le nom de celui qui parle. */
  const ondes = usePings()
  const poserOnde = ondes.ajouter

  /* Les ondes arrivent par le même canal que pour l'écran des joueurs : le MJ
     les voit sur sa copie du direct, à l'endroit exact où on lui montre. */
  useEffect(() => window.jdr.display.onPing(poserOnde), [poserOnde])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<Set<string>>(new Set())
  /* Qui se tient où : la liste des lieux montre les joueurs présents, pas un
     décompte de pions. Le total sert encore aux messages. */
  const [presence, setPresence] = useState<Record<number, PionsDuLieu>>({})
  const [pointing, setPointing] = useState(false)
  const [pointer, setPointer] = useState<Pointer | null>(null)
  /*
   * Les deux emplacements s'appellent par leur numéro — Visuel 1, Visuel 2 —
   * et non par leur rôle : le rôle change à chaque bascule, le numéro non.
   * `onLive` s'en déduit, et c'est lui qui continue de commander partout
   * ailleurs : on ne compose jamais sur l'écran que les joueurs regardent.
   */
  const visuel = s.visuel
  const setVisuel = s.setVisuel
  const [activeCell, setActiveCell] = useState(0)
  /*
   * Les annotations du lieu qu'on arrange. Volontairement de l'état **local** :
   * elles ne transitent pas par `display`, donc la fenêtre joueurs ne peut pas
   * les recevoir, quoi qu'on fasse ici.
   */
  const [voirAnnots, setVoirAnnots] = useState(false)
  const [annots, setAnnots] = useState<Annotation[]>([])
  /** Annoter depuis la régie : l'outil armé et le repère qu'on écrit. */
  const [outilAnnot, setOutilAnnot] = useState<OutilAnnotation>(null)
  const [annotChoisie, setAnnotChoisie] = useState<number | null>(null)
  const [edit, setEdit] = useState<{ pions: Pion[]; size: number }>({ pions: [], size: 6 })
  /* Le nom qu'on est en train de donner à un pion qui n'est à personne.
     `null` : le champ est fermé et la réserve montre son bouton. */
  const [pnj, setPnj] = useState<string | null>(null)
  const held = useRef(false) // Ctrl maintenu
  const lastSent = useRef(0)
  // Le champ de texte garde la main pendant la frappe : l'état de diffusion ne
  // vient le réécrire que si on n'est pas en train d'écrire dedans.
  const [texte, setTexte] = useState('')
  const [selTexte, setSelTexte] = useState<number | null>(null)
  /*
   * Le volet des textes ne s'ouvre que si on le demande — par son bouton, ou
   * en cliquant un texte sur le visuel. Il tenait une pleine rangée sous la
   * scène alors qu'on n'écrit pas à chaque plan : la place manquait à ce qui
   * sert toujours.
   */
  const [texteOuvert, setTexteOuvert] = useState(false)
  const ecrit = useRef(false)
  const frappe = useRef<number>()
  const enAttente = useRef<{ id: number | null; v: string } | null>(null)
  /* La case visée d'un collage : sa légende si elle porte une image, son texte
     si elle n'en porte pas. Même précaution que pour les textes libres — on
     n'envoie pas une lettre à la fois, les joueurs verraient écrire. */
  const [champCase, setChampCase] = useState('')
  const ecritCase = useRef(false)
  const frappeCase = useRef<number>()

  const liveSlide = display?.slide ?? { type: 'black' as const }
  const liveSlot = (display?.liveSlot ?? 0) as 0 | 1
  const idleSlot: 0 | 1 = liveSlot === 0 ? 1 : 0
  const prepSlide = display?.slots?.[idleSlot] ?? { type: 'black' as const }
  const onLive = visuel === liveSlot
  const slide = display?.slots?.[visuel] ?? { type: 'black' as const }

  const frozen = display?.frozen ?? false
  const dark = liveSlide.type === 'black'

  /* La case visée. Elle n'existe que sur un collage, et on ne compose que
     l'écran en préparation : viser une case du direct ne veut rien dire. */
  const iCase = slide.type === 'collage' ? activeCell % COLLAGE_CELLS[slide.layout] : 0
  const caseVisee = slide.type === 'collage' ? (slide.cells[iCase] ?? null) : null
  const contenuCase =
    caseVisee?.kind === 'texte'
      ? caseVisee.texte
      : caseVisee?.kind === 'image'
        ? (caseVisee.caption ?? '')
        : ''

  /** Le champ suit la case visée — sauf pendant qu'on écrit dedans. */
  useEffect(() => {
    if (ecritCase.current) return
    setChampCase(contenuCase)
  }, [contenuCase, iCase])

  const tapeCase = (v: string): void => {
    setChampCase(v)
    ecritCase.current = true
    const image = caseVisee?.kind === 'image'
    window.clearTimeout(frappeCase.current)
    frappeCase.current = window.setTimeout(() => {
      if (image) void window.jdr.display.cellCaption(iCase, v)
      else void window.jdr.display.cellText(iCase, v)
    }, 250)
  }

  /** Le lieu qu'on arrange : celui de l'écran qu'on regarde. */
  const editPlaceId =
    !onLive && display?.pendingPlaceId != null ? display.pendingPlaceId : (display?.placeId ?? null)
  const place = s.places.find((p) => p.id === editPlaceId) ?? null
  /* La carte du lieu donne ses proportions au calque d'annotations. */
  const carteDuLieu = s.allItems.find((i) => i.id === place?.mapItemId) ?? null
  const layout: CollageLayout = prepSlide.type === 'collage' ? prepSlide.layout : '1'
  const textes = slide.texts ?? []
  const over = textes.find((t) => t.id === selTexte) ?? textes[textes.length - 1] ?? null

  const pillClass = frozen ? 'frozen' : dark ? 'off' : 'on'
  const pillText = frozen ? 'Figé — rien ne part' : dark ? 'Voile noir' : 'Direct'

  /* Le visuel qu'on arrange est posé à l'ouverture de la campagne, sur le
     libre, puis gardé dans le magasin : ni une bascule, ni un aller-retour
     par un autre module ne le déplacent. Voir `visuel` dans `store.ts`. */

  /*
   * Pivoter : l'image plein écran du visuel qu'on regarde, ou la case visée
   * s'il s'agit d'un collage. Le décalage repart de zéro — une image couchée
   * n'entre plus dans son cadre de la même façon, et un ancien décalage y
   * laisserait voir du vide. L'agrandissement, lui, se garde.
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

  /** L'image sur laquelle portent pivot et luminosité, s'il y en a une. */
  const vise = cadreVise()
  const pivotable = vise !== null
  const lum = Math.round((vise?.frame.lum ?? 1) * 100)

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

  /** Changer de visuel : on solde la frappe en cours avant de bouger. */
  const regarder = (n: 0 | 1): void => {
    if (n === visuel) return
    vide()
    ecrit.current = false
    setVisuel(n)
  }

  /*
   * Ce que les joueurs voient, quand on veut le vérifier.
   *
   * La régie montre le plan entier : c'est de là qu'on mène, on ne conduit pas
   * une partie à travers le trou de serrure des joueurs. Mais on veut pouvoir
   * s'assurer d'un coup d'œil qu'une porte close cache bien ce qu'elle doit —
   * d'où cet interrupteur, qui pose sur la prévisualisation exactement l'ombre
   * de leur écran.
   */
  const [leurOeil, setLeurOeil] = useState(false)
  /* Ce que le MJ survole dans son tableau de scène : un halo sur sa carte, et
     rien du tout chez les joueurs. */
  const [survol, setSurvol] = useState<Surbrillance>(null)
  const [calque, setCalque] = useState<CalqueBrouillard | null>(null)
  useEffect(() => {
    let vivant = true
    if (editPlaceId == null) {
      setCalque(null)
      return
    }
    void window.jdr.murs.calque(editPlaceId).then((c) => {
      if (vivant) setCalque(c)
    })
    return () => {
      vivant = false
    }
  }, [editPlaceId, edit.pions, display?.pions, display?.calqueRev])

  const refreshPresence = async (): Promise<void> => setPresence(await window.jdr.pions.presence())
  const refreshEdit = async (): Promise<void> => setEdit(await window.jdr.pions.of(editPlaceId))
  /* La colonne des lieux suit tout ce qui touche aux pions, d'où qu'il vienne :
     un pion posé depuis le téléphone d'un joueur déplace le même jeton ici. */
  useEffect(() => {
    void refreshPresence()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [display?.pions])
  useEffect(() => {
    void refreshEdit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editPlaceId, display?.pions])

  /* Les annotations suivent le lieu qu'on arrange, et ne se lisent que si on
     les demande — inutile d'interroger la base pour un calque qu'on cache. */
  const relireAnnots = async (): Promise<void> =>
    setAnnots(await window.jdr.annotations.of(editPlaceId))

  useEffect(() => {
    if (!voirAnnots) {
      setAnnots([])
      setOutilAnnot(null)
      setAnnotChoisie(null)
      return
    }
    void relireAnnots()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voirAnnots, editPlaceId])

  const poserAnnot = async (kind: 'repere' | 'texte', x: number, y: number): Promise<void> => {
    if (editPlaceId == null) return
    const a = await window.jdr.annotations.add({ placeId: editPlaceId, kind, x, y })
    await relireAnnots()
    setAnnotChoisie(a.id)
    setOutilAnnot(null)
  }

  const annotEnCours = annots.find((a) => a.id === annotChoisie) ?? null

  /**
   * Un coup encaissé se note depuis l'encart, sans quitter la régie. Le journal
   * du personnage l'enregistre comme n'importe quel ajustement, et l'écran des
   * joueurs suit — `characters:adjust` relit la liste des joueurs.
   */
  const ajusterJauge = async (characterId: number, key: string, delta: number): Promise<void> => {
    await window.jdr.characters.adjust(characterId, key, delta)
    await s.refreshCharacters()
  }

  // On change de texte, ou d'emplacement : le champ suit.
  useEffect(() => {
    if (!ecrit.current) setTexte(over?.text ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onLive, over?.id, over?.text])

  // Le champ de la barre du haut envoie ici.
  useEffect(() => {
    const h = (e: Event): void => {
      setQuery((e as CustomEvent<string>).detail)
      setTab('arbre')
    }
    window.addEventListener('jdr:search', h)
    return () => window.removeEventListener('jdr:search', h)
  }, [])

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
      // Ctrl maintenu : le pointeur le temps d'un geste, comme on lève le doigt.
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
    if (now - lastSent.current < 40) return // ~25 envois par seconde suffisent
    lastSent.current = now
    const b = e.currentTarget.getBoundingClientRect()
    sendPointer({ x: (e.clientX - b.left) / b.width, y: (e.clientY - b.top) / b.height })
  }

  /* ---------------- diffusion ---------------- */

  /**
   * Un clic prépare : rien ne bouge pour les joueurs tant qu'on n'a pas basculé.
   * Si une disposition en plusieurs cases est choisie, l'image va dans la case
   * visée, et la visée avance toute seule.
   */
  const send = async (item: UiItem): Promise<void> => {
    const cells = COLLAGE_CELLS[layout]
    if (cells > 1 && item.kind === 'image') {
      const c = activeCell % cells
      await window.jdr.display.prepareCell(c, item.id)
      setActiveCell((c + 1) % cells)
      return
    }
    await window.jdr.display.prepareItem(item.id)
  }

  /** Une image envoyée sur l'écran en préparation, sans viser de case. */
  const dropOnPrepared = async (itemId: number): Promise<void> => {
    const cells = COLLAGE_CELLS[layout]
    if (cells > 1) {
      const c = activeCell % cells
      await window.jdr.display.prepareCell(c, itemId)
      setActiveCell((c + 1) % cells)
      return
    }
    await window.jdr.display.prepareItem(itemId)
  }

  const setLayout = async (l: CollageLayout): Promise<void> => {
    await window.jdr.display.prepareLayout(l)
    setActiveCell(0)
    /* La disposition se règle sur le visuel en préparation : on y revient. */
    setVisuel(idleSlot)
  }

  /* ---------------- textes à l'écran ---------------- */

  /** La régie envoie toujours la liste entière : un seul chemin à suivre. */
  const envoieTextes = (liste: TextOverlay[]): void =>
    void window.jdr.display.texts(onLive ? 'live' : 'prep', liste)

  /** Modifie le texte choisi ; s'il n'y en a pas encore, en crée un. */
  const poseTexte = (patch: Partial<TextOverlay>): void => {
    if (!over) {
      const neuf = { ...texteNeuf(Date.now(), 0), ...patch }
      setSelTexte(neuf.id)
      envoieTextes([...textes, neuf])
      return
    }
    envoieTextes(textes.map((t) => (t.id === over.id ? { ...t, ...patch } : t)))
  }

  /** Un texte de plus, posé un cran au-dessus du précédent. */
  const ajouteTexte = (): void => {
    setTexteOuvert(true)
    vide()
    const neuf = texteNeuf(Date.now(), textes.length)
    ecrit.current = false
    setTexte('')
    setSelTexte(neuf.id)
    envoieTextes([...textes, neuf])
  }

  /** Déplacer un texte : ce n'est pas forcément celui qu'on modifie. */
  const bougeTexte = (id: number, x: number, y: number): void =>
    envoieTextes(textes.map((t) => (t.id === id ? { ...t, x, y } : t)))

  /**
   * Envoie sur-le-champ ce qui attendait encore. À appeler avant de changer de
   * texte : sinon la fin d'une phrase irait se coller dans le suivant.
   */
  const vide = (): void => {
    window.clearTimeout(frappe.current)
    const p = enAttente.current
    enAttente.current = null
    if (!p) return
    if (p.id == null) poseTexte({ text: p.v })
    else envoieTextes(textes.map((t) => (t.id === p.id ? { ...t, text: p.v } : t)))
  }

  /**
   * On n'envoie pas une lettre à la fois : les joueurs verraient le texte
   * s'écrire. Un court répit après la dernière touche suffit.
   */
  const tape = (v: string): void => {
    setTexte(v)
    ecrit.current = true
    enAttente.current = { id: over?.id ?? null, v }
    window.clearTimeout(frappe.current)
    frappe.current = window.setTimeout(vide, 250)
  }

  /**
   * Choisir un autre texte : on solde le précédent, puis le champ le suit.
   *
   * Cliquer un texte sur le visuel passe par ici : c'est donc aussi ce qui
   * ouvre le volet, sans quoi on désignerait un texte sans rien pour le
   * modifier.
   */
  const choisitTexte = (id: number): void => {
    setTexteOuvert(true)
    if (id === over?.id) {
      setSelTexte(id)
      return
    }
    vide()
    ecrit.current = false
    setSelTexte(id)
  }

  const retireTexte = (): void => {
    if (!over) return
    window.clearTimeout(frappe.current)
    enAttente.current = null
    ecrit.current = false
    setTexte('')
    setSelTexte(null)
    envoieTextes(textes.filter((t) => t.id !== over.id))
  }

  const preparePlace = async (id: number): Promise<void> => {
    await window.jdr.display.preparePlace(id)
    const p = s.places.find((x) => x.id === id)
    const n = presence[id]?.count ?? 0
    s.toast(
      `${p?.name ?? 'Lieu'} prêt${n ? ` — ${n} pion${n > 1 ? 's' : ''}` : ''} · bascule quand tu veux`
    )
  }

  /** La manière vient du magasin : la Régie et le Pupitre basculent pareil. */
  const swap = async (ms: number): Promise<void> => {
    if (frozen) {
      s.toast('Image figée — dégèle d’abord pour changer l’écran joueurs', true)
      return
    }
    await window.jdr.display.swap(ms, s.transition)
    await refreshPresence()
  }

  /* ---------------- pions ---------------- */

  const dropOnStage = async (
    e: React.DragEvent,
    x: number,
    y: number,
    cell: number | null
  ): Promise<void> => {
    const pionId = e.dataTransfer.getData('text/pion')
    const charId = e.dataTransfer.getData('text/pion-char')
    const itemId = e.dataTransfer.getData('text/pion-item')
    const lieuId = e.dataTransfer.getData('text/lieu')

    if (lieuId) {
      await (onLive
        ? window.jdr.display.setPlace(Number(lieuId))
        : preparePlace(Number(lieuId)))
      return
    }
    if (pionId) {
      await window.jdr.pions.move(Number(pionId), x, y)
      /* La grande surface montre le lieu qu'on arrange (`pions:of`), que la
         diffusion d'état ne rafraîchit pas : sans ceci le pion resterait
         visuellement à sa place, alors qu'il a bien bougé en base. */
      await refreshEdit()
      return
    }
    // Une image lâchée sur une case du collage y prend place ; ailleurs, elle
    // devient un pion. On ne compose que l'écran en préparation : la case visée
    // sur l'écran en direct n'a rien à voir avec la disposition qu'on prépare.
    const visee = onLive ? null : cell
    if (itemId && visee != null && visee < COLLAGE_CELLS[layout]) {
      await window.jdr.display.prepareCell(visee, Number(itemId))
      setActiveCell((visee + 1) % COLLAGE_CELLS[layout])
      return
    }
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
    } else if (itemId) {
      await window.jdr.pions.add({ placeId: editPlaceId, itemId: Number(itemId), x, y })
    } else return
    await refreshPresence()
    await refreshEdit()
  }

  /**
   * Le lieu — autre que celui-ci — où ce personnage est déjà posé. C'est le
   * lieu qu'il s'apprête à quitter, puisqu'un joueur ne se dédouble pas.
   */
  const ailleurs = (
    characterId: number,
    sauf: number
  ): { nom: string; lieu: string } | null => {
    for (const [id, l] of Object.entries(presence)) {
      if (Number(id) === sauf) continue
      const j = l.joueurs.find((x) => x.characterId === characterId)
      if (j) return { nom: j.name, lieu: s.places.find((p) => p.id === Number(id))?.name ?? 'son lieu' }
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

  /**
   * Poser un pion qui n'est à personne : un PNJ, une créature, une silhouette
   * au fond du couloir.
   *
   * Il n'a qu'un nom — pas de fiche, pas encore — et c'est ce qui le met hors
   * de portée des joueurs : le téléphone ne rend saisissable que le pion dont
   * le personnage est celui du joueur, et celui-ci n'est à personne.
   *
   * Il naît **caché**. Le MJ prépare ses créatures avant la scène ; les voir
   * apparaître sur la carte serait leur annoncer, et il n'y a pas de geste
   * pour rattraper ce qu'ils ont déjà vu. On le montre quand il entre —
   * « Montrer aux joueurs », dans le menu du pion.
   */
  const poserPnj = async (): Promise<void> => {
    const nom = (pnj ?? '').trim()
    if (editPlaceId == null || !nom) return setPnj(null)

    /* Au milieu, mais décalé de ce qui s'y trouve déjà : trois PNJ posés coup
       sur coup ne doivent pas se cacher l'un l'autre. Le MJ les range ensuite
       à la main, comme les autres. */
    const n = edit.pions.length
    await window.jdr.pions.add({
      placeId: editPlaceId,
      label: nom,
      cache: true,
      x: 0.5 + ((n % 4) - 1.5) * 0.06,
      y: 0.5 + (Math.floor(n / 4) % 3) * 0.07
    })
    /* On garde le champ ouvert : une scène en amène rarement un seul. */
    setPnj('')
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

  /* La réserve porte les deux : un PNJ se pose sur la carte comme un joueur.
     Les joueurs d'abord, cependant — ils sont trois, les PNJ peuvent être
     vingt, et ce sont les trois qu'on cherche en pleine partie. */
  const reservePions = useMemo(
    () => [...s.characters].sort((a, b) => Number(a.kind === 'pnj') - Number(b.kind === 'pnj')),
    [s.characters]
  )

  const placedChars = new Set(edit.pions.map((p) => p.characterId).filter(Boolean))

  /* ---------------- arborescence ---------------- */

  const q = query.trim().toLowerCase()
  const matches = (i: UiItem): boolean =>
    i.kind !== 'other' && (q === '' || i.title.toLowerCase().includes(q))

  const flat = useMemo(() => s.allItems.filter(matches), [s.allItems, q])

  const out = s.screens.find((x) => x.id === display?.outputDisplayId)

  /*
   * La grande scène prend la forme de l'écran des joueurs, pas un 16/9 de
   * principe : le cadre bordait sa scène de bandes noires qui ne montraient
   * rien. Même écran que le moniteur du rail et que le pupitre — la sortie
   * réglée, sinon le premier écran qui n'est pas le principal.
   */
  const sortie = out ?? s.screens.find((x) => !x.primary) ?? s.screens[0] ?? null
  const ecran = sortie ? `${sortie.width} / ${sortie.height}` : '16 / 9'
  /* Le même rapport en nombre : `aspect-ratio` accepte la fraction, un calcul
     de largeur non — et le cadre a besoin des deux. */
  const ecranN = sortie ? String(sortie.width / sortie.height) : '1.7778'

  const audio = display?.audio
  const liveItemId = 'itemId' in slide ? slide.itemId : null

  /**
   * Un fichier est une vignette, pas une ligne de texte : en pleine partie on
   * reconnaît une carte à son image, jamais à son nom de fichier.
   */
  const fileTile = (i: UiItem): JSX.Element => (
    <button
      key={i.id}
      className={`vig k-${i.kind}${liveItemId === i.id ? ' on' : ''}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/media-item', String(i.id))
        if (i.kind === 'image') e.dataTransfer.setData('text/pion-item', String(i.id))
        e.dataTransfer.effectAllowed = 'copy'
      }}
      onClick={() => void send(i)}
      title={
        i.kind === 'image'
          ? `${i.title}
Clic : préparer · glisser : sur une case, un écran, ou en faire un pion`
          : `${i.title}
Clic : préparer`
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
    const isOpen = open.has(f.relPath) || q !== ''
    const files = f.items.filter(matches)
    if (q !== '' && !files.length && !f.children.length) return <div key={f.relPath} />
    return (
      <div key={f.relPath}>
        <div
          className={`row folder${isOpen ? ' open' : ''}`}
          onClick={() =>
            setOpen((o) => {
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

  return (
    <section className="view regieview">
      <div className="vhead">
        <div>
          <h2>Régie · écran joueurs</h2>
          <p>
            Tu composes sur l’écran en préparation ; les joueurs voient l’autre. La bascule en
            fondu envoie l’image, le lieu et ses pions d’un seul geste.
          </p>
        </div>
        <div className="spacer" />
        <button
          className={`btn${display?.playerOpen ? ' btn-on' : ''}`}
          onClick={() => void window.jdr.display.togglePlayer()}
        >
          <IconExpand />
          {display?.playerOpen ? 'Fermer l’écran joueurs' : 'Ouvrir l’écran joueurs'}
        </button>
      </div>

      <div className="regie-grid">
        <div className="regie-left">
          <div className="stage-bar">
            <div className="seg">
              {([0, 1] as const).map((n) => (
                <button
                  key={n}
                  className={visuel === n ? 'on' : ''}
                  onClick={() => regarder(n)}
                  title={
                    n === liveSlot
                      ? 'Ce que les joueurs ont sous les yeux'
                      : 'Libre : c’est ici qu’on arrange la suite'
                  }
                >
                  {n === liveSlot ? <span className="point" /> : null}
                  Visuel {n + 1}
                </button>
              ))}
            </div>

            <span className="sep" />
            <span className="eyebrow">Disposition</span>
            <div className="layouts">
              {LAYOUTS.map((l) => (
                <button
                  key={l}
                  className={`lay${layout === l ? ' on' : ''}`}
                  onClick={() => void setLayout(l)}
                  title={LAYOUT_NAME[l]}
                  aria-label={LAYOUT_NAME[l]}
                >
                  <span className={`lay-glyph g-${l}`}>
                    {Array.from({ length: COLLAGE_CELLS[l] }, (_, n) => (
                      <i key={n} />
                    ))}
                  </span>
                </button>
              ))}
            </div>
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
                  ? 'Éclaircit ou assombrit l’image visée — de 30 % à 250 %. Clique le chiffre pour revenir à l’image d’origine.'
                  : 'Rien à corriger sur ce visuel'
              }
            >
              <span className="eyebrow">Lumière</span>
              <input
                type="range"
                min={LUM_MIN * 100}
                max={LUM_MAX * 100}
                step={5}
                value={lum}
                disabled={!pivotable}
                onChange={(e) => poseLum(Number(e.target.value))}
              />
              <span className={`val num${lum !== 100 ? ' corrige' : ''}`}>{lum} %</span>
              {/* Éteint tant qu'on est déjà à 100 % : il n'aurait rien à faire,
                  et un bouton qui ne fait rien se remarque. */}
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

            <div className="spacer" />
            <span className="eyebrow">
              {out ? `${out.label} · ${out.width}×${out.height}` : 'sortie automatique'}
            </span>
          </div>

          {/* L'emplacement mesure ; le cadre s'y taille aux proportions de
              l'écran des joueurs, sans marge noire autour de la scène. */}
          {/* Le tableau de scène tient à gauche de l'image : pendant la
              partie, on ne trace plus, on ouvre et on allume. */}
          <div className="big-avec-tableau">
            {calque?.murs.length ? (
              <TableauDeScene
                calque={calque}
                lieux={s.places.filter((p) => p.parentId === editPlaceId)}
                survol={survol}
                onSurvol={setSurvol}
              />
            ) : null}
          <div
            className="big-slot"
            style={{ ['--ecran' as string]: ecran, ['--ecran-n' as string]: ecranN }}
          >
            <div className={`big-frame${onLive ? ' live' : ''}`}>
              <div className="big-inner">
                <div
                  className={`big-stage${pointing ? ' pointing' : ''}`}
                  onMouseMove={onStageMove}
                  onMouseLeave={() => sendPointer(null)}
                >
                  {/* Les ondes ne se voient que sur l'écran qu'on regarde
                      vraiment : sur la préparation, elles mentiraient. */}
                  {onLive ? <Pings pings={ondes.pings} /> : null}
                  <Slide
                    slide={slide}
                    /* Le calque est toujours donné : même quand tu vois la
                       carte entière, les murs retiennent les pions. C'est
                       l'ombre seule que le bouton allume. */
                    brouillard={calque}
                    ombre={leurOeil}
                    surbrillance={survol}
                    pions={edit.pions}
                    pionSize={edit.size}
                    /* Le visuel libre n'est pas à l'antenne : on le prépare à
                       la main, une caméra ne viendrait que déranger le
                       cadrage qu'on lui compose. */
                    focusPionId={onLive ? (display?.focusPionId ?? null) : null}
                    onDefocus={() => void window.jdr.pions.focus(null)}
  pionLabels={display?.pionLabels ?? true}
                    pionPv={display?.pionPv ?? false}
                    joueurs={display?.joueurs}
                    encart={display?.encart}
                    onMoveEncart={(x, y) => void window.jdr.display.encart({ x, y })}
                    onSizeEncart={(largeur, hauteur) =>
                      void window.jdr.display.encart({ largeur, hauteur })
                    }
                    onAjuster={(id, key, d) => void ajusterJauge(id, key, d)}
                    pointer={pointer}
                    onDropAt={(e, x, y, cell) => void dropOnStage(e, x, y, cell)}
                    onRemovePion={(id) => void removePion(id)}
                    onRotatePion={(id, deg) => void tournerPion(id, deg)}
                    onPionMenu={(pion, x, y) => setCiblePion({ pion, x, y })}
                    activeCell={onLive ? undefined : activeCell}
                    onPickCell={onLive ? undefined : setActiveCell}
                    onFrame={(cell, f) => void window.jdr.display.frame(onLive ? 'live' : 'prep', cell, f)}
                    onMoveText={bougeTexte}
                    activeText={over?.id ?? null}
                    onPickText={choisitTexte}
                  />
                  {/* Par-dessus la scène, jamais dedans : le calque du MJ ne fait
                      pas partie de la diapositive, donc il ne part nulle part. */}
                  {voirAnnots && carteDuLieu?.url ? (
                    /* Même cadre que dans la fiche — les repères sont posés en
                       fractions de la carte, pas de l'écran — et le même cadrage
                       que l'image diffusée, pour qu'ils la suivent au zoom. */
                    <CadreAnnote
                      url={carteDuLieu.url}
                      className={`sur-scene${outilAnnot ? ' arme' : ''}`}
                      frame={'frame' in slide ? (slide.frame ?? FRAME_NEUTRE) : FRAME_NEUTRE}
                    >
                      <Annotations
                        annotations={annots}
                        mode="edition"
                        outil={outilAnnot}
                        choisi={annotChoisie}
                        onChoisir={setAnnotChoisie}
                        onPoser={(k, x, y) => void poserAnnot(k, x, y)}
                        onDeplacer={async (id, x, y) => {
                          await window.jdr.annotations.move(id, x, y)
                          await relireAnnots()
                        }}
                        onEffacer={async (id) => {
                          await window.jdr.annotations.remove(id)
                          setAnnotChoisie(null)
                          await relireAnnots()
                        }}
                      />
                    </CadreAnnote>
                  ) : null}
                </div>
              </div>
              {/* Le badge dit toujours lequel on regarde et ce qu'il vaut :
                  le numéro ne suffit pas à savoir si les joueurs le voient. */}
              <span className={`big-badge live-pill ${onLive ? pillClass : 'prep'}`}>
                <span className="dot" />
                Visuel {visuel + 1} — {onLive ? pillText : 'libre, invisible des joueurs'}
              </span>
            </div>
          </div>
          </div>

          {/* ---- annoter depuis la régie ---- */}
          {voirAnnots ? (
            <div className="tray annot-regie">
              <span className="eyebrow">Annoter</span>
              <button
                className={`btn btn-sm${outilAnnot === 'repere' ? ' btn-on' : ''}`}
                onClick={() => setOutilAnnot(outilAnnot === 'repere' ? null : 'repere')}
                title="Puis clique sur la carte"
              >
                <IconPlus />
                Repère
              </button>
              <button
                className={`btn btn-sm${outilAnnot === 'texte' ? ' btn-on' : ''}`}
                onClick={() => setOutilAnnot(outilAnnot === 'texte' ? null : 'texte')}
                title="Puis clique sur la carte"
              >
                <IconType />
                Texte
              </button>

              <span className="sep" />
              {annotEnCours ? (
                <>
                  <span className="eyebrow">
                    {annotEnCours.kind === 'repere' ? `Repère ${annotEnCours.num}` : 'Texte'}
                  </span>
                  <input
                    className="annot-ligne"
                    type="text"
                    value={annotEnCours.texte}
                    placeholder="Ce que tu notes ici…"
                    onChange={async (e) => {
                      /* On écrit directement : la liste est courte et le calque
                         ne part nulle part, aucun risque à rafraîchir. */
                      await window.jdr.annotations.update(annotEnCours.id, { texte: e.target.value })
                      await relireAnnots()
                    }}
                  />
                  <div className="couleurs">
                    {PION_COULEURS.slice(0, 6).map((c) => (
                      <button
                        key={c.key}
                        className="pastille"
                        style={{ ['--p' as string]: c.hex }}
                        aria-pressed={(annotEnCours.color ?? 'brass') === c.key}
                        title={c.name}
                        onClick={async () => {
                          await window.jdr.annotations.update(annotEnCours.id, { color: c.key })
                          await relireAnnots()
                        }}
                      />
                    ))}
                  </div>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={async () => {
                      await window.jdr.annotations.remove(annotEnCours.id)
                      setAnnotChoisie(null)
                      await relireAnnots()
                    }}
                  >
                    <IconTrash />
                    Effacer
                  </button>
                </>
              ) : (
                <span className="note">
                  {outilAnnot
                    ? 'Clique sur la carte pour le poser.'
                    : 'Clique un repère pour l’écrire · jamais vu des joueurs.'}
                </span>
              )}
              <div className="spacer" />
              <span className="eyebrow">{annots.length} sur ce lieu</span>
            </div>
          ) : null}

          {/* ---- réserve de pions ---- */}
          <div className="tray">
            <span className="eyebrow">Pions</span>
            <div className="tray-pions">
              {reservePions.map((c) => {
                const placed = placedChars.has(c.id)
                /* Posé ailleurs : le glisser ici le déménagera, autant le dire
                   avant plutôt que de le voir disparaître d'un autre lieu. */
                const parti = placed || editPlaceId == null ? null : ailleurs(c.id, editPlaceId)
                const photo = s.allItems.find((i) => i.id === c.portraitItemId)
                return (
                  <div
                    key={c.id}
                    /* La couleur du personnage, ici comme sur son pion à
                       l'écran : la réserve et la table parlent la même langue. */
                    className={`tok teinte c-${c.color ?? 'neutral'}${placed ? ' placed' : ''}${
                      photo ? ' photo' : ''
                    }`}
                    draggable={!placed}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/pion-char', String(c.id))
                      e.dataTransfer.effectAllowed = 'copy'
                    }}
                    // Une image lâchée sur un pion devient sa photo : c'est la
                    // façon la plus courte de donner un visage à un personnage.
                    onDragEnter={(e) => void accepteSi(e, 'text/pion-item')}
                    onDragOver={(e) => void accepteSi(e, 'text/pion-item')}
                    onDrop={(e) => void setPhoto(e, c.id)}
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
                    {photo?.url ? (
                      <img src={photo.url} alt="" draggable={false} />
                    ) : (
                      initials(c.name)
                    )}
                  </div>
                )
              })}

              {/* Le pion de personne : un PNJ, une créature. Il se nomme ici et
                  se pose aussitôt, caché des joueurs — il n'a pas de fiche à
                  attendre, et ils ne pourront ni le voir ni le pousser. */}
              {pnj === null ? (
                <button
                  type="button"
                  className="tok neuf"
                  disabled={editPlaceId == null}
                  title={
                    editPlaceId == null
                      ? 'Choisis d’abord le lieu où se tient la scène'
                      : 'Poser un pion de PNJ — caché des joueurs jusqu’à ce que tu le montres'
                  }
                  onClick={() => setPnj('')}
                >
                  +
                </button>
              ) : (
                <input
                  className="tok-nom"
                  autoFocus
                  value={pnj}
                  placeholder="Nom du PNJ"
                  onChange={(e) => setPnj(e.target.value)}
                  onBlur={() => setPnj(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setPnj(null)
                    if (e.key === 'Enter') void poserPnj()
                  }}
                />
              )}
            </div>
            <span className="note">
              {place
                ? 'Glisse un pion, ou une image de l’arborescence, sur l’écran. Le + pose un PNJ, caché.'
                : 'Choisis un lieu pour poser des pions.'}
            </span>

            <span className="sep" />
            <label className="size" title="Taille des pions de ce lieu">
              <span className="eyebrow">Taille</span>
              <input
                type="range"
                min={2}
                max={20}
                step={0.5}
                value={edit.size}
                disabled={!place}
                onChange={async (e) => {
                  if (!place) return
                  await window.jdr.pions.size(place.id, Number(e.target.value))
                  await refreshEdit()
                }}
              />
              <span className="val num">{edit.size.toFixed(1)} %</span>
            </label>

            <span className="sep" />
            {/* Le nom sous le pion vaut pour tout l'écran, pas pour un lieu :
                c'est une façon de montrer, pas une donnée du lieu. */}
            <label
              className="coche"
              title="Écrire le nom du joueur sous son pion, sur l’écran des joueurs"
            >
              <input
                type="checkbox"
                checked={display?.pionLabels ?? true}
                onChange={(e) => void window.jdr.display.pionLabels(e.target.checked)}
              />
              <span>Noms sous les pions</span>
            </label>
            <label className="coche" title="Ses points de vie, juste sous son nom">
              <input
                type="checkbox"
                checked={display?.pionPv ?? false}
                onChange={(e) => void window.jdr.display.pionPv(e.target.checked)}
              />
              <span>PV sous les pions</span>
            </label>

            <span className="sep" />
            {/* L'encart reste ancré du côté choisi tant qu'il est coché : il ne
                dépend ni de l'image, ni du lieu, ni de la bascule. */}
            <label className="coche" title="Portraits, noms et points de vie, sur l’écran des joueurs">
              <input
                type="checkbox"
                checked={display?.encart.on ?? false}
                onChange={(e) => void window.jdr.display.encart({ on: e.target.checked })}
              />
              <span>Encart Joueurs</span>
            </label>
            <label className="coche" title="Ajouter la santé mentale à côté de la vie">
              <input
                type="checkbox"
                checked={display?.encart.sm ?? false}
                disabled={!display?.encart.on}
                onChange={(e) => void window.jdr.display.encart({ sm: e.target.checked })}
              />
              <span>Santé mentale</span>
            </label>
            {/* La place et les dimensions se prennent à la main sur la scène —
                on glisse l'encart, on tire sa poignée. Ici, seulement le sens
                de lecture et ce que ça donne en chiffres. */}
            <div className="seg" role="group" aria-label="Sens de l’encart">
              {(['horizontal', 'vertical'] as const).map((v) => (
                <button
                  key={v}
                  className={display?.encart.sens === v ? 'on' : ''}
                  disabled={!display?.encart.on}
                  onClick={() =>
                    /* Changer de sens fait pivoter la boîte : sans quoi trois
                       joueurs empilés dans un bandeau bas deviennent illisibles
                       et il faudrait retirer la poignée à chaque bascule. */
                    void window.jdr.display.encart({
                      sens: v,
                      largeur: display?.encart.hauteur ?? 13,
                      hauteur: display?.encart.largeur ?? 46
                    })
                  }
                  title={v === 'horizontal' ? 'Les joueurs en ligne' : 'Les joueurs en colonne'}
                >
                  {v === 'horizontal' ? 'En ligne' : 'En colonne'}
                </button>
              ))}
            </div>
            <span className="eyebrow num">
              {Math.round(display?.encart.largeur ?? 0)} × {Math.round(display?.encart.hauteur ?? 0)} %
            </span>
            <button
              className="btn btn-sm btn-ghost"
              disabled={!display?.encart.on}
              title="Remettre l’encart en bas au milieu, à sa taille d’origine"
              onClick={() =>
                void window.jdr.display.encart({ x: 0.5, y: 0.88, largeur: 46, hauteur: 13 })
              }
            >
              Recentrer
            </button>

            <div className="spacer" />
            <span className="eyebrow">
              {edit.pions.length ? `${edit.pions.length} sur ${place?.name ?? ''}` : ''}
            </span>
            <button
              className="btn btn-sm btn-danger"
              disabled={!edit.pions.length}
              onClick={() => void clearPions()}
            >
              <IconTrash />
              Retirer les pions du lieu
            </button>
          </div>

          {/* ---- la case visée d'un collage ---- */}
          {slide.type === 'collage' ? (
            <div className="tray tray-case">
              <span className="eyebrow">Case {iCase + 1}</span>
              <input
                className="texte-champ"
                value={champCase}
                disabled={onLive}
                placeholder={
                  onLive
                    ? 'On ne compose que l’écran en préparation'
                    : caseVisee?.kind === 'image'
                      ? 'Légender cette case — le carton sous le tableau…'
                      : 'Écrire dans cette case, ou y poser une image d’un clic…'
                }
                onChange={(e) => tapeCase(e.target.value)}
                onBlur={() => {
                  ecritCase.current = false
                }}
              />

              {caseVisee?.kind === 'texte' ? (
                <>
                  <span className="sep" />
                  <div className="teintes">
                    {TEXTE_COULEURS.map((c) => (
                      <button
                        key={c.hex}
                        className={`teinte${(caseVisee.color ?? TEXTE_NEUF.color) === c.hex ? ' on' : ''}`}
                        style={{ background: c.hex }}
                        title={c.name}
                        aria-label={c.name}
                        onClick={() => void window.jdr.display.cellText(iCase, champCase, c.hex)}
                      />
                    ))}
                  </div>
                </>
              ) : null}

              <div className="spacer" />
              <span className="note">
                {caseVisee?.kind === 'image'
                  ? 'La légende suit sa case : elle s’en va avec elle.'
                  : 'Un nom, une date, une réplique — ce qu’aucune image ne dit mieux.'}
              </span>
              <button
                className="btn btn-sm btn-danger"
                disabled={onLive || !caseVisee}
                onClick={() => {
                  window.clearTimeout(frappeCase.current)
                  ecritCase.current = false
                  setChampCase('')
                  void window.jdr.display.prepareCell(iCase, null)
                }}
              >
                <IconTrash />
                Vider la case
              </button>
            </div>
          ) : null}

          {/* ---- textes posés sur l'écran ---- */}
          {texteOuvert ? (
          <div className="tray tray-texte">
            <span className="eyebrow">Textes</span>
            <div className="onglets-textes">
              {textes.map((t, n) => (
                <button
                  key={t.id}
                  className={`t-chip${over?.id === t.id ? ' on' : ''}`}
                  style={{ borderLeftColor: t.color }}
                  onClick={() => choisitTexte(t.id)}
                  title={t.text || `Texte ${n + 1}`}
                >
                  {t.text.trim() || `Texte ${n + 1}`}
                </button>
              ))}
              <button className="t-chip plus" onClick={ajouteTexte} title="Ajouter un texte">
                +
              </button>
            </div>

            <input
              className="texte-champ"
              value={texte}
              placeholder={
                onLive ? 'Écrire sur l’écran des joueurs…' : 'Écrire sur l’écran en préparation…'
              }
              onChange={(e) => tape(e.target.value)}
              onBlur={() => {
                ecrit.current = false
              }}
            />

            <span className="sep" />
            <label className="size" title="Corps du texte, en pourcentage de la largeur">
              <span className="eyebrow">Corps</span>
              <input
                type="range"
                min={1.5}
                max={14}
                step={0.25}
                value={over?.size ?? TEXTE_NEUF.size}
                onChange={(e) => poseTexte({ size: Number(e.target.value) })}
              />
              <span className="val num">{(over?.size ?? TEXTE_NEUF.size).toFixed(2)} %</span>
            </label>

            <span className="sep" />
            <div className="teintes">
              {TEXTE_COULEURS.map((c) => (
                <button
                  key={c.hex}
                  className={`teinte${(over?.color ?? TEXTE_NEUF.color) === c.hex ? ' on' : ''}`}
                  style={{ background: c.hex }}
                  title={c.name}
                  aria-label={c.name}
                  onClick={() => poseTexte({ color: c.hex })}
                />
              ))}
            </div>

            <label className="coche" title="Bandeau sombre derrière le texte">
              <input
                type="checkbox"
                checked={over?.plate ?? TEXTE_NEUF.plate}
                onChange={(e) => poseTexte({ plate: e.target.checked })}
              />
              <span>Cartouche</span>
            </label>

            <div className="spacer" />
            {textes.length > 1 ? (
              <span className="note">Clique un texte sur l’écran pour le modifier.</span>
            ) : null}
            <button className="btn btn-sm btn-danger" disabled={!over} onClick={retireTexte}>
              <IconTrash />
              Supprimer
            </button>
          </div>
          ) : null}


          {/* ---- barre de régie ---- */}
          <div className="deck">
            <div className="deck-row">
              {/* On n'écrit pas sur chaque plan : le volet des textes s'ouvre
                  quand on le demande, et se referme sans rien effacer — ce qui
                  est déjà à l'écran y reste. */}
              <button
                className={`btn${texteOuvert ? ' btn-on' : ''}`}
                aria-expanded={texteOuvert}
                onClick={() => {
                  vide()
                  if (texteOuvert) setSelTexte(null)
                  setTexteOuvert((v) => !v)
                }}
                title={
                  texteOuvert
                    ? 'Refermer le volet des textes — ce qui est posé à l’écran y reste'
                    : 'Écrire sur l’écran : le volet s’ouvre, et un clic sur un texte du visuel l’ouvre aussi'
                }
              >
                <IconType />
                Textes
                {textes.length ? <span className="kbd num">{textes.length}</span> : null}
              </button>
              <span className="sep" />

              {/* Les trois touchent l'écran des joueurs de trois façons proches :
                  sans un mot d'explication, on ne sait pas lequel prendre. */}
              <button
                className="btn"
                onClick={() => void window.jdr.display.blackout()}
                disabled={frozen}
                title={
                  dark
                    ? 'Remet aux joueurs l’image qu’ils voyaient avant le voile. Ctrl+B'
                    : 'Coupe l’image des joueurs d’un coup — leur écran devient noir. Le même bouton la rétablit. Ctrl+B, ou Ctrl+Alt+B même quand l’application n’a pas le focus'
                }
              >
                <IconEyeOff />
                {dark ? 'Rétablir l’image' : 'Voile noir'}
              </button>
              <button
                className={`btn${voirAnnots ? ' btn-on' : ''}`}
                onClick={() => setVoirAnnots((v) => !v)}
                title={
                  editPlaceId == null
                    ? 'Choisis d’abord le lieu où se tient la scène'
                    : 'Affiche tes repères et tes textes sur la carte — chez toi seulement, jamais chez les joueurs'
                }
                disabled={editPlaceId == null}
              >
                <IconPen />
                Voir annotations
              </button>
              {/* Le brouillard s'applique tout seul dès qu'un lieu a des murs :
                  rien à armer en pleine séance. Ce bouton ne l'allume pas, il
                  te met un instant à la place des joueurs. */}
              <button
                className={`btn${leurOeil ? ' btn-on' : ''}`}
                onClick={() => setLeurOeil((v) => !v)}
                title={
                  !calque?.murs.length
                    ? 'Ce lieu n’a pas de murs : les joueurs voient la carte entière'
                    : leurOeil
                      ? 'Revenir au plan entier — c’est de là que tu mènes'
                      : 'Poser sur ta prévisualisation l’ombre exacte de leur écran'
                }
                disabled={!calque?.murs.length}
              >
                <IconEye />
                Voir ce qu’ils voient
              </button>
              <button
                className={`btn${frozen ? ' btn-on' : ''}`}
                onClick={() => void window.jdr.display.freeze(!frozen)}
                title={
                  frozen
                    ? 'L’écran des joueurs est gelé : rien n’en part. Clique pour le rendre au direct.'
                    : 'Gèle l’écran des joueurs sur ce qu’il montre : plus rien ne part tant que c’est actif — ni bascule, ni voile, ni fondu. De quoi tout réarranger sans qu’ils s’en aperçoivent.'
                }
              >
                <IconFreeze />
                {frozen ? 'Figé' : 'Figer'}
              </button>
              <span className="sep" />
              <button
                className={`btn${pointing ? ' btn-on' : ''}`}
                onClick={() => setPointing((v) => !v)}
                title="P — ou maintiens Ctrl pour le montrer le temps d’un geste"
              >
                <IconSearch />
                Pointeur
                <span className="kbd">P</span>
              </button>
            </div>

            <div className="deck-row">
              <span className="amb-name">
                <IconAudio />
                {audio?.title ?? 'Aucune ambiance'}
              </span>
              <button
                className="btn btn-sm"
                disabled={!audio?.itemId}
                onClick={() => void window.jdr.display.audio({ playing: !audio?.playing })}
              >
                {audio?.playing ? 'Pause' : 'Reprendre'}
              </button>
              <button
                className="btn btn-sm"
                disabled={!audio?.itemId}
                onClick={() =>
                  void window.jdr.display.audio({ itemId: null, url: null, title: null, playing: false })
                }
              >
                <IconStop />
                Stop
              </button>
              <span className="eyebrow">Volume</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={audio?.volume ?? 0.35}
                onChange={(e) => void window.jdr.display.audio({ volume: Number(e.target.value) })}
              />
            </div>
          </div>
        </div>

        {/* ---- lieu, arborescence, et les deux emplacements ---- */}
        <div className="side-col">
        <aside className="pane side">
          <div className="pane-head">
            <div className="seg">
              <button className={tab === 'lieux' ? 'on' : ''} onClick={() => setTab('lieux')}>
                Lieux
              </button>
              <button className={tab === 'arbre' ? 'on' : ''} onClick={() => setTab('arbre')}>
                Dossier
              </button>
              {/* Les portables se règlent sans quitter la scène qu'on prépare. */}
              <button
                className={tab === 'portables' ? 'on' : ''}
                onClick={() => setTab('portables')}
                title="Fiches, jets et pions depuis le téléphone des joueurs"
              >
                <IconPhone />
              </button>
            </div>
            <div className="spacer" />
            <span className="eyebrow">
              {tab === 'lieux'
                ? `${s.places.length} lieux`
                : tab === 'arbre'
                  ? `${flat.length} fichiers`
                  : `${s.mobile?.devices.length ?? 0} appareils`}
            </span>
          </div>

          <div className="pane-body">
            {tab === 'portables' ? (
              <Portables />
            ) : tab === 'lieux' ? (
              <>
                {/* L'arbre du rangement : un espace, ses niveaux, leurs lieux.
                    `places:list` sort déjà dans cet ordre — on ne fait qu'indenter,
                    selon la profondeur réelle : un lieu rangé nulle part reste à
                    gauche, il n'appartient pas au dernier niveau affiché. */}
                <div className="lieux-list">
                  {s.places.map((p) => {
                    const ici = presence[p.id]?.joueurs ?? []
                    const map = s.allItems.find((i) => i.id === p.mapItemId)
                    return (
                      <button
                        key={p.id}
                        className={`lieu-row d-${profondeur(p, s.places)}${display?.placeId === p.id ? ' on' : ''}${
                          display?.pendingPlaceId === p.id ? ' ready' : ''
                        }`}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/lieu', String(p.id))
                          e.dataTransfer.effectAllowed = 'copy'
                        }}
                        onClick={() => void preparePlace(p.id)}
                        title={`${p.name}${
                          ici.length ? `
Ici : ${ici.map((j) => j.name).join(', ')}` : ''
                        }
Clic : préparer · glisser sur « À l’écran » : envoyer tout de suite`}
                      >
                        <span className="mini">
                          {map?.url ? <img src={map.url} alt="" draggable={false} /> : null}
                        </span>
                        <span className="nm">{p.name}</span>
                        {p.seen ? null : (
                          <span className="lock" title="Pas encore découvert">
                            <IconCercle />
                          </span>
                        )}
                        {/* Qui se trouve là : les visages des joueurs, pas leur
                            nombre. Un joueur n'apparaît qu'une fois dans toute
                            la colonne — il n'est pas à deux endroits à la fois. */}
                        <span className="seats ici">
                          {ici.map((j) => (
                            <span
                              key={j.characterId}
                              className={`jeton c-${j.color}${j.url ? ' photo' : ''}`}
                              title={j.name}
                            >
                              {j.url ? (
                                <img src={j.url} alt="" draggable={false} />
                              ) : (
                                j.initials
                              )}
                            </span>
                          ))}
                        </span>
                      </button>
                    )
                  })}
                </div>
                <p className="note">
                  Choisir un lieu le met <b>en préparation</b> : sa carte va dans l’emplacement
                  libre et son ambiance est chargée en pause. Il prend la scène — pions compris —
                  quand tu bascules.
                </p>
              </>
            ) : (
              <div className="tree">
                {q !== '' ? (
                  <>
                    <div className="eyebrow srch">
                      <IconSearch />
                      {flat.length} résultat{flat.length > 1 ? 's' : ''} pour « {query} »
                    </div>
                    <div className="vigs">{flat.map(fileTile)}</div>
                  </>
                ) : (
                  <>
                    {s.tree.map(folderRow)}
                    <div className="vigs">{s.orphans.filter(matches).map(fileTile)}</div>
                  </>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* ---- les deux emplacements : l'un à l'antenne, l'autre se prépare ---- */}
        <div className="slots">
          {[0, 1].map((n) => {
            const live = (display?.liveSlot ?? 0) === n
            const payload = display?.slots?.[n] ?? { type: 'black' as const }
            const pending = !live && display?.pendingPlaceId != null
            return (
              <div
                key={n}
                /* Les deux cartes sont le second chemin vers le même choix :
                   un clic amène ce visuel dans la grande surface. */
                className={`slot${live ? ' live' : ''}${visuel === n ? ' vue' : ''}`}
                role="button"
                tabIndex={0}
                aria-current={visuel === n}
                title={`Visuel ${n + 1} — clic : l’arranger dans la grande surface`}
                onClick={() => regarder(n as 0 | 1)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && regarder(n as 0 | 1)}
                // Lâcher une image sur l'écran en préparation l'y envoie, sans
                // viser de case : c'est le geste large, quand on ne compose pas.
                onDragEnter={(e) => accepte(e, live) && e.currentTarget.classList.add('over')}
                onDragOver={(e) => accepte(e, live) && e.currentTarget.classList.add('over')}
                onDragLeave={(e) => e.currentTarget.classList.remove('over')}
                onDrop={(e) => {
                  e.currentTarget.classList.remove('over')
                  e.preventDefault()
                  const lieu = Number(e.dataTransfer.getData('text/lieu'))
                  // Un lieu lâché sur l'écran à l'antenne y va tout de suite ;
                  // sur l'autre, il attend la bascule.
                  if (lieu) {
                    void (live ? window.jdr.display.setPlace(lieu) : preparePlace(lieu))
                    return
                  }
                  if (live) return
                  const id = Number(e.dataTransfer.getData('text/media-item'))
                  if (id) void dropOnPrepared(id)
                }}
              >
                <div className="slot-head">
                  <span className="visuel-nom">Visuel {n + 1}</span>
                  <span className={`live-pill ${live ? 'on' : 'off'}`}>
                    <span className="dot" />
                    {/* « Visuel n » tient déjà la place : la pastille se fait courte. */}
                    {live ? 'Direct' : 'Libre'}
                  </span>
                  <span className="nm">{slideLabel(payload)}</span>
                </div>
                <div className="slot-view">
                  <Slide
                    slide={payload}
                    animate={false}
                    pions={live ? display?.pions : undefined}
                    pionSize={display?.pionSize}
                    focusPionId={live ? display?.focusPionId : null}
                    pionLabels={display?.pionLabels ?? true}
                    pionPv={display?.pionPv ?? false}
                    joueurs={display?.joueurs}
                    encart={display?.encart}
                  />
                </div>
                {pending ? (
                  <span className="slot-place">
                    Lieu prêt : {s.places.find((x) => x.id === display?.pendingPlaceId)?.name}
                  </span>
                ) : null}
              </div>
            )
          })}

          <div className="slot-acts">
            {/* La manière de basculer, juste au-dessus du bouton qui
                l'applique : on voit ce qui va se passer avant de le faire. */}
            <div className="bascule-modes" role="group" aria-label="Manière de basculer">
              {TRANSITIONS.map((t) => (
                <button
                  key={t.key}
                  className={`bascule-mode${s.transition === t.key ? ' on' : ''}`}
                  onClick={() => s.setTransition(t.key)}
                  title={t.aide}
                >
                  {t.name}
                </button>
              ))}
            </div>
            <button className="btn btn-brass" onClick={() => void swap(s.reglages.basculeMs)} disabled={frozen}>
              <IconFade />
              Basculer
            </button>
            <button
              className="btn btn-sm"
              onClick={() => void swap(0)}
              disabled={frozen}
              title="Sans enchaînement — l’image change d’un coup"
            >
              Couper
            </button>
          </div>
        </div>
        </div>
      </div>
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

/** L'ordre de la barre : par nombre d'images, puis du plus simple au plus composé. */
export const LAYOUTS: CollageLayout[] = ['1', '2h', '2v', '3g', '3h', '3b', '4', '4l', '4b', '6']

export const LAYOUT_NAME: Record<CollageLayout, string> = {
  '1': 'Une seule image',
  '2h': 'Deux, côte à côte',
  '2v': 'Deux, l’une sur l’autre',
  '3g': 'Trois : une grande à gauche, deux à droite',
  '3h': 'Trois, en bande',
  '3b': 'Trois : une large en haut, deux dessous',
  '4': 'Quatre, en grille',
  '4l': 'Quatre : une grande à gauche, trois à droite',
  '4b': 'Quatre : une large en haut, trois dessous',
  '6': 'Six, en grille'
}

/** Initiales d'un nom, pour un pion sans portrait. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

/**
 * Le sur-titre affiché aux joueurs. Sans étiquettes, c'est le dossier qui parle :
 * une image rangée dans « Cartes » s'annonce comme une carte.
 */
function captionFor(i: UiItem): string | undefined {
  if (!i.relPath || !i.relPath.includes('/')) return undefined
  const folder = i.relPath.slice(0, i.relPath.lastIndexOf('/')).split('/').pop() ?? ''
  const clean = folder.replace(/^[\d\s—–-]+/, '').trim()
  return clean.length > 1 && clean.length < 24 ? clean.toLowerCase() : undefined
}
