import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { MenuPion, type CiblePion } from '../components/MenuPion'
import { MenuImage, type CibleImage } from '../components/MenuImage'
import { Slide } from '../../shared/Slide'
import { Visage } from '../../shared/Visage'
import { Pings, usePings } from '../../shared/Pings'
import { duree } from '../../shared/mesures'
import { slideLabel } from '../components/Monitor'
import { accepteSi, initials, profondeur } from './Regie'
import { decorDossier, folderIcon } from '../components/FolderIcons'
import { Annotations, CadreAnnote } from '../components/Annotations'
import { TableauDeScene, type Surbrillance } from '../components/Tableau'
import { IconPhone, Portables } from '../components/Portables'
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
import { COLLAGE_CELLS, FRAME_NEUTRE, LUM_MAX, LUM_MIN, TRANSITIONS } from '@shared/types'
import type {
  Annotation,
  Character,
  CollageLayout,
  Frame,
  JaugeVue,
  Pion,
  PionsDuLieu,
  Pointer
} from '@shared/types'
import type { UiFolder, UiItem } from '../../../../preload/index'
import {
  IconCheck,
  IconChevron,
  IconClose,
  IconDoc,
  IconExpand,
  IconPorte,
  IconEye,
  IconCercle,
  IconEyeOff,
  IconFade,
  IconFreeze,
  IconPen,
  IconRetour,
  IconRotate,
  IconSearch,
  IconStop,
  IconTrash,
  kindIcon
} from '../components/Icons'

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
  /* Le nom qu'on donne à un pion qui n'est à personne. `null` : champ fermé. */
  const [pnj, setPnj] = useState<string | null>(null)
  /* Le côté gauche lit soit le fil de la séance, soit les documents annexes —
     règles maison, tables, fiches qu'on garde sous la main toute la partie. */
  const [cote, setCote] = useState<'chrono' | 'annexes'>('chrono')
  const [annexeVue, setAnnexeVue] = useState<number | null>(null)
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
  /* La source, sous l'ambiance : les lieux, le dossier, ou les portables. */
  const [tab, setTab] = useState<'lieux' | 'arbre' | 'portables'>('lieux')
  /* Le tableau de scène, à gauche de l'image : le MJ le montre ou le cache.
     Un confort de poste, retenu d'une ouverture à l'autre. */
  const [voirScene, setVoirScene] = useState<boolean>(() => {
    try {
      return localStorage.getItem('paravent.scene') !== 'non'
    } catch {
      return true
    }
  })
  const basculerScene = (): void =>
    setVoirScene((v) => {
      try {
        localStorage.setItem('paravent.scene', v ? 'non' : 'oui')
      } catch {
        /* sans stockage, le choix ne dure que la séance */
      }
      return !v
    })
  const [ouverts, setOuverts] = useState<Set<string>>(new Set())

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
  const pillText = frozen ? 'Figé — rien ne part' : dark ? 'Voile noir' : 'Direct'

  /** Le lieu qu'on arrange : celui de l'écran qu'on regarde. */
  const editPlaceId =
    !onLive && display?.pendingPlaceId != null ? display.pendingPlaceId : (display?.placeId ?? null)

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
  const iCase = caseDuCollage(slide, activeCell)

  /* La source ne montre que les espaces et leurs niveaux : les pièces rangées
     sous un niveau se jouent par la carte du niveau, pas une à une. Un lieu
     rangé nulle part reste, lui, à portée de main. */
  const lieuxMontres = s.places.filter((p) => {
    if (p.tier !== 'lieu' || p.parentId == null) return true
    return s.places.find((x) => x.id === p.parentId)?.tier !== 'niveau'
  })

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


  /** La manière vient du magasin : la Régie et le Pupitre basculent pareil. */
  const swap = async (ms: number): Promise<void> => {
    if (frozen) {
      s.toast('Image figée — dégèle d’abord pour changer l’écran joueurs', true)
      return
    }
    const d = await window.jdr.display.swap(ms, s.transition)
    /* On vient d'envoyer : c'est le nouveau direct qu'on veut sous les yeux. */
    setVisuel(d.liveSlot)
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

  /**
   * Un coup encaissé se note depuis l'encart, sans quitter la page : on clique
   * la jauge du joueur sur la scène. Le journal du personnage l'enregistre
   * comme n'importe quel ajustement, et l'écran des joueurs suit.
   */
  const ajusterJauge = async (characterId: number, key: string, delta: number): Promise<void> => {
    await window.jdr.characters.adjust(characterId, key, delta)
    await s.refreshCharacters()
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

  /**
   * Le pion de personne : un PNJ, une créature. Il se nomme ici et se pose
   * aussitôt — pas de fiche à attendre, et les joueurs ne pourront pas le
   * pousser depuis leur téléphone.
   *
   * Il naît **caché** : on prépare ses créatures avant la scène, et les voir
   * apparaître sur la carte serait les annoncer. Le MJ le montre quand il
   * entre — « Montrer aux joueurs », dans le menu du pion.
   */
  const poserPnj = async (): Promise<void> => {
    const nom = (pnj ?? '').trim()
    if (editPlaceId == null || !nom) return setPnj(null)
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
  const reservePions = useMemo(
    () => s.characters.filter((c) => c.present).sort((a, b) => rang(a) - rang(b)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.characters, enScene]
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
      onClick={() => void poser(i)}
      title={
        i.kind === 'image'
          ? `${i.title}\nClic : préparer · glisser : sur une case, ou en faire un pion`
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
  const sons = useMemo(() => matiere.filter((i) => i.kind === 'audio'), [matiere])
  const docs = useMemo(() => matiere.filter((i) => i.kind === 'doc'), [matiere])
  /* Les PNJ que la Chronologie a mis en scène : leur portrait se prépare d'un
     clic, leur pion se glisse sur la scène. */
  const pnjsEnScene = useMemo(
    () => s.characters.filter((c) => c.kind === 'pnj' && (beat?.pnjIds ?? []).includes(c.id)),
    [s.characters, beat]
  )

  const audio = display?.audio
  const played = s.beats.filter((b) => b.done).length
  /* L'annexe qu'on lit : celle qu'on a choisie, sinon la première. */
  const annexe = s.annexes.find((a) => a.id === annexeVue) ?? s.annexes[0] ?? null

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

  return (
    /* `chrono` n'est pas décoratif : les panneaux, leurs en-têtes et le
       sélecteur à deux boutons ne sont stylés que sous cette classe. */
    <section className="view chrono pupitre">
      <div className="pu-grid">
        {/* ================= la séance ================= */}
        <div className="pu-chrono">
          <aside className="pane">
            <div className="pane-head">
              <div className="seg pu-cote" role="tablist" aria-label="Ce qu’on lit">
                <button
                  role="tab"
                  aria-selected={cote === 'chrono'}
                  className={cote === 'chrono' ? 'on' : ''}
                  onClick={() => setCote('chrono')}
                  title={`Le fil de la séance — ${played} / ${s.beats.length} joués`}
                >
                  Chronologie
                </button>
                <button
                  role="tab"
                  aria-selected={cote === 'annexes'}
                  className={cote === 'annexes' ? 'on' : ''}
                  onClick={() => setCote('annexes')}
                  title="Les documents qu’on garde sous la main toute la séance"
                >
                  Annexes
                </button>
              </div>
            </div>
            <div className="pane-body">
              {cote === 'annexes' ? (
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

          <section className="pane lecture">
            {cote === 'annexes' ? (
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
                        {carte?.url ? <img src={carte.url} alt="" /> : <span className="pu-rien" />}
                        <span className="pu-kind">lieu</span>
                        <span className="pu-nom">{lieu.name}</span>
                      </button>
                    ) : null}

                    {visuels.map((it) => (
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
                    ))}

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

                    {!lieu && visuels.length === 0 && pnjsEnScene.length === 0 && sons.length === 0 ? (
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
        </div>

        {/* ================= l'écran des joueurs ================= */}
        <section className="pane pu-regie">
          {/* ---- la barre de la régie ---- */}
          <div className="pu-bar stage-bar">
            <div className="seg">
              {([0, 1] as const).map((n) => (
                <button
                  key={n}
                  className={visuel === n ? 'on' : ''}
                  onClick={() => setVisuel(n)}
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

            {/* Pas de dispositions au Paravent : on y joue un plan, pas un
                collage. Elles restent à la Régie. */}
            <button
              className={`btn btn-sm${voirScene ? ' btn-on' : ''}`}
              onClick={basculerScene}
              aria-pressed={voirScene}
              title={
                !calque?.murs.length
                  ? 'Le tableau de scène — portes, fenêtres, lumières. Ce lieu n’a pas de murs.'
                  : voirScene
                    ? 'Cacher le tableau de scène : l’image reprend toute la largeur'
                    : 'Montrer le tableau de scène à gauche de l’image : portes, fenêtres, lumières'
              }
            >
              <IconPorte />
              Scène
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

            {/* Comme en Régie : ouvrir l'écran des joueurs sans quitter la scène. */}
            <div className="spacer" />
            {/* Sans libellé : la barre passait à la ligne dès qu'on lui
                ajoutait un mot. L'info-bulle dit ce qu'il fait et où. */}
            <button
              className={`btn btn-sm btn-ico${display?.playerOpen ? ' btn-on' : ''}`}
              aria-label={display?.playerOpen ? 'Fermer l’écran joueurs' : 'Ouvrir l’écran joueurs'}
              onClick={() => void window.jdr.display.togglePlayer()}
              title={`${display?.playerOpen ? 'Fermer' : 'Ouvrir'} l’écran joueurs — ${
                sortie ? `${sortie.label} · ${sortie.width}×${sortie.height}` : 'sortie automatique'
              } · F5`}
            >
              <IconExpand />
            </button>
          </div>

          {/* ---- la grande scène : celle qu'on arrange ---- */}
          {/* Le tableau de scène, à gauche de l'image et à sa hauteur : son
              en-tête reste, la liste des pièces défile. Le bouton « Scène » de
              la barre le cache, et l'image reprend toute la largeur. */}
          <div className="big-avec-tableau pu-avec-tableau">
            {voirScene && calque?.murs.length ? (
              <TableauDeScene
                calque={calque}
                lieux={s.places.filter((p) => p.parentId === editPlaceId)}
                survol={survol}
                onSurvol={setSurvol}
              />
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
                  slide={slide}
                  /* Le calque est toujours donné : les murs retiennent les pions.
                     L'ombre seule s'allume au bouton « Voir ce qu'ils voient ». */
                  brouillard={calque}
                  ombre={leurOeil}
                  surbrillance={survol}
                  pions={edit.pions}
                  pionSize={edit.size}
                  /* Comme en Régie : la caméra ne suit que la scène à
                     l'antenne, jamais celle qu'on prépare. */
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
                  fenetres={onLive ? display?.fenetres : null}
                  onFenetre={(id, patch) => void window.jdr.display.reglerFenetre(id, patch)}
                  onFermerFenetre={(id) => void window.jdr.display.fermerFenetre(id)}
                  pointer={pointer}
                  onDropAt={(e, x, y, cell) => void dropOnStage(e, x, y, cell)}
                  onRemovePion={(id) => void removePion(id)}
                  onRotatePion={(id, deg) => void tournerPion(id, deg)}
                  onPionMenu={(pion, x, y) => setCiblePion({ pion, x, y })}
                  activeCell={onLive ? undefined : activeCell}
                  onPickCell={onLive ? undefined : setActiveCell}
                  /* La molette agrandit, le glisser recadre ; les textes se
                     déplacent et se choisissent sur l'image — comme en Régie. */
                  onFrame={(cell, f) =>
                    void window.jdr.display.frame(onLive ? 'live' : 'prep', cell, f)
                  }
                  onMoveText={textes.bouge}
                  activeText={textes.over?.id ?? null}
                  onPickText={textes.choisit}
                  onPoserSurCarte={lampe.poser}
                  lumieresMJ
                />
                {/* Par-dessus la scène, jamais dedans : le calque du MJ ne fait
                    pas partie de la diapositive, donc il ne part nulle part.
                    Même cadrage que l'image diffusée, pour que les repères la
                    suivent au zoom. */}
                {voirAnnots && carteScene?.url ? (
                  <CadreAnnote
                    url={carteScene.url}
                    className={`sur-scene${annot.outil ? ' arme' : ''}`}
                    frame={'frame' in slide ? (slide.frame ?? FRAME_NEUTRE) : FRAME_NEUTRE}
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
          </div>
          </div>

          {/* ---- les volets, sous la scène, quand on les demande ---- */}
          <VoletCase slide={slide} iCase={iCase} onLive={onLive} />
          {textes.ouvert ? <VoletTextes t={textes} onLive={onLive} /> : null}
          {voirAnnots ? <VoletAnnoter a={annot} /> : null}

          {/* ---- les deux visuels, et la bascule ---- */}
          <div className="pu-slots">
            {([0, 1] as const).map((n) => {
              const live = liveSlot === n
              const payload = display?.slots?.[n] ?? { type: 'black' as const }
              return (
                <button
                  key={n}
                  className={`pu-slot${live ? ' live' : ''}${visuel === n ? ' vue' : ''}`}
                  onClick={() => setVisuel(n)}
                  title={`Visuel ${n + 1} — ${slideLabel(payload)}`}
                >
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
                    fenetres={live ? display?.fenetres : null}
                  />
                  <span className="pu-slot-head">
                    <span className="nm">Visuel {n + 1}</span>
                    <span className={`live-pill ${live ? 'on' : 'off'}`}>
                      <span className="dot" />
                      {live ? 'Direct' : 'Libre'}
                    </span>
                  </span>
                </button>
              )
            })}

            {/* Le creux entre les deux visuels et la bascule : l'encart des
                joueurs s'y loge. Il ne dépend ni de l'image, ni du lieu, ni de
                la bascule — sa place est donc bien celle-ci, à côté des deux
                écrans plutôt que dans la réserve de pions. */}
            <div className="pu-encart">
              <div className="pu-encart-tete">
                <label
                  className="coche"
                  title="Portraits, noms et points de vie, sur l’écran des joueurs"
                >
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
                <SensEncart />
              </div>

              {/*
                Les jauges sont ici, et pas seulement sur l'encart de la scène :
                l'encart ne se dessine que s'il est allumé, et un coup encaissé
                se note qu'on l'ait montré aux joueurs ou non. La place et la
                taille, elles, restent des gestes à la main sur l'image.
              */}
              <div className="pu-jauges">
                {(display?.joueurs ?? []).map((j) => (
                  <div key={j.id} className="pu-j" title={j.name}>
                    <span
                      className={`pu-j-face teinte c-${j.color ?? 'neutral'}${j.url ? ' photo' : ''}`}
                    >
                      {j.url ? <Visage url={j.url} cadre={j.cadre} /> : j.initials}
                    </span>
                    {j.pv ? (
                      <JaugeRapide
                        jauge={j.pv}
                        classe="vie"
                        titre={`${j.name} — ${j.pv.label}`}
                        onAjuster={(d) => void ajusterJauge(j.id, j.pv!.key, d)}
                      />
                    ) : null}
                    {j.sm ? (
                      <JaugeRapide
                        jauge={j.sm}
                        classe="esprit"
                        titre={`${j.name} — ${j.sm.label}`}
                        onAjuster={(d) => void ajusterJauge(j.id, j.sm!.key, d)}
                      />
                    ) : null}
                  </div>
                ))}
                {(display?.joueurs ?? []).length === 0 ? (
                  <p className="pu-vide">Aucun personnage joueur dans cette campagne.</p>
                ) : null}
              </div>
            </div>

          </div>

          {/* ---- les gestes, en barre sous les visuels et l'encart ----
              Une rangée à plat plutôt qu'une colonne étroite à dérouler :
              tout se voit d'un coup d'œil, comme la barre de la Régie. */}
          <div className="pu-acts">
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
            <div className="pu-acts-row">
              <button
                className="btn btn-sm"
                onClick={() => void window.jdr.display.blackout()}
                disabled={frozen}
                title={
                  dark
                    ? 'Remet aux joueurs l’image qu’ils voyaient avant le voile. Ctrl+B'
                    : 'Coupe l’image des joueurs d’un coup — leur écran devient noir. Le même bouton la rétablit. Ctrl+B'
                }
              >
                <IconEyeOff />
                {dark ? 'Rétablir' : 'Voile'}
              </button>
              <button
                className={`btn btn-sm${frozen ? ' btn-on' : ''}`}
                onClick={() => void window.jdr.display.freeze(!frozen)}
                title="Rien ne part vers les joueurs tant que c'est figé"
              >
                <IconFreeze />
                Figer
              </button>
            </div>
            {/* Le pointeur avait son raccourci, pas son bouton : comme en
                Régie, on doit pouvoir l'allumer sans connaître la touche. */}
            <button
              className={`btn btn-sm${pointing ? ' btn-on' : ''}`}
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
              onClick={() => setLeurOeil((v) => !v)}
              disabled={!calque?.murs.length}
              title={
                !calque?.murs.length
                  ? 'Ce lieu n’a pas de murs : les joueurs voient la carte entière'
                  : leurOeil
                    ? 'Revenir au plan entier — c’est de là que tu mènes'
                    : 'Poser sur ta prévisualisation l’ombre exacte de leur écran'
              }
            >
              <IconEye />
              Voir ce qu’ils voient
            </button>
            <BoutonTextes t={textes} petit />
            <BoutonPoserLumiere p={lampe} petit />
            {/* Sur sa propre ligne : le libellé ne tient pas en tiers de
                colonne, et l'abréger aurait rendu obscur un calque qu'on
                allume rarement. */}
            <button
              className={`btn btn-sm${voirAnnots ? ' btn-on' : ''}`}
              onClick={() => setVoirAnnots((v) => !v)}
              disabled={editPlaceId == null}
              title={
                editPlaceId == null
                  ? 'Prépare d’abord le lieu où se tient la scène'
                  : 'Affiche tes repères et tes textes sur la carte — chez toi seulement, jamais chez les joueurs'
              }
            >
              <IconPen />
              Annotations
            </button>
          </div>

          {/* ---- la réserve de pions ---- */}
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
                  <div
                    key={c.id}
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
                )
              })}

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
              {editPlaceId != null
                ? 'Glisse un pion, ou une image de l’étagère, sur la scène. Le + pose un PNJ, caché.'
                : 'Prépare un lieu pour poser des pions.'}
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
                disabled={editPlaceId == null}
                onChange={async (e) => {
                  if (editPlaceId == null) return
                  await window.jdr.pions.size(editPlaceId, Number(e.target.value))
                  await refreshEdit()
                }}
              />
              <span className="val num">{edit.size.toFixed(1)} %</span>
            </label>

            <span className="sep" />
            {/* Le nom sous le pion vaut pour tout l'écran, pas pour un lieu :
                c'est une façon de montrer, pas une donnée du lieu. */}
            <label className="coche" title="Écrire le nom du joueur sous son pion">
              <input
                type="checkbox"
                checked={display?.pionLabels ?? true}
                onChange={(e) => void window.jdr.display.pionLabels(e.target.checked)}
              />
              <span>Noms</span>
            </label>
            <label className="coche" title="Ses points de vie, juste sous son nom">
              <input
                type="checkbox"
                checked={display?.pionPv ?? false}
                onChange={(e) => void window.jdr.display.pionPv(e.target.checked)}
              />
              <span>PV</span>
            </label>

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

          {/* ---- l'ambiance ---- */}
          <div className="pu-ambiance">
            <span className="eyebrow">Ambiance</span>
            <span className="t">{audio?.title ?? 'Aucune ambiance'}</span>
            <div className="spacer" />
            <button
              className="btn btn-sm"
              disabled={!audio?.itemId}
              onClick={() => void window.jdr.display.audio({ playing: !audio?.playing })}
            >
              {audio?.playing ? 'Pause' : 'Reprendre'}
            </button>
            <button
              className="btn btn-sm btn-ico"
              disabled={!audio?.itemId}
              onClick={() =>
                void window.jdr.display.audio({
                  itemId: null,
                  url: null,
                  title: null,
                  playing: false
                })
              }
              aria-label="Couper l’ambiance"
            >
              <IconStop />
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={audio?.volume ?? 0.35}
              aria-label="Volume de l’ambiance"
              onChange={(e) => void window.jdr.display.audio({ volume: Number(e.target.value) })}
            />
          </div>

          {/* ---- la source : les lieux de la campagne, ou son dossier ----
              `regieview` n'est pas décoratif non plus : l'arborescence, ses
              vignettes et les lignes de dossier ne sont stylées que sous cette
              classe. Les règles que `chrono` partage avec elle sont les mêmes,
              ou celles de `chrono` l'emportent — ce qu'on veut, pour que le
              panneau ressemble au reste du module. */}
          <div className="regieview pu-source">
            <aside className="pane side">
              <div className="pane-head">
                <div className="seg">
                  <button className={tab === 'lieux' ? 'on' : ''} onClick={() => setTab('lieux')}>
                    Lieux
                  </button>
                  <button className={tab === 'arbre' ? 'on' : ''} onClick={() => setTab('arbre')}>
                    Dossier
                  </button>
                  {/* Les portables se règlent sans quitter la scène, comme en Régie. */}
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
                    ? `${lieuxMontres.length} lieux`
                    : tab === 'arbre'
                      ? `${fichiers.length} fichiers`
                      : `${s.mobile?.devices.length ?? 0} appareils`}
                </span>
              </div>

              <div className="pane-body">
                {tab === 'portables' ? (
                  <Portables />
                ) : tab === 'lieux' ? (
                  <div className="lieux-list">
                    {lieuxMontres.map((p) => {
                      const ici = presence[p.id]?.joueurs ?? []
                      const map = s.allItems.find((i) => i.id === p.mapItemId)
                      return (
                        <button
                          key={p.id}
                          className={`lieu-row d-${profondeur(p, s.places)}${
                            display?.placeId === p.id ? ' on' : ''
                          }${display?.pendingPlaceId === p.id ? ' ready' : ''}`}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/lieu', String(p.id))
                            e.dataTransfer.effectAllowed = 'copy'
                          }}
                          onClick={() => void preparePlace(p.id)}
                          title={`${p.name}${
                            ici.length ? `\nIci : ${ici.map((j) => j.name).join(', ')}` : ''
                          }\nClic : préparer · glisser sur la scène à l’antenne : envoyer tout de suite`}
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
                          {/* Qui se trouve là : les visages, pas un décompte. */}
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
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="tree">
                    {s.tree.map(folderRow)}
                    <div className="vigs">{s.orphans.filter(diffusable).map(fileTile)}</div>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </section>
      </div>

      {choix ? (
        <ChoixMedia
          onClose={() => setChoix(false)}
          onPick={async (it) => {
            await poser(it)
            setChoix(false)
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

/* ============================================================
   Une jauge, en petit : la barre dit l'état d'un coup d'œil, les
   chiffres disent l'exact, et les deux boutons notent le coup.
   ============================================================ */

function JaugeRapide({
  jauge,
  classe,
  titre,
  onAjuster
}: {
  jauge: JaugeVue
  classe: 'vie' | 'esprit'
  titre: string
  onAjuster: (delta: number) => void
}): JSX.Element {
  const part = jauge.max ? Math.max(0, Math.min(1, jauge.value / jauge.max)) * 100 : 0
  return (
    <span className={`pu-jauge ${classe}`} title={titre}>
      <button onClick={() => onAjuster(-1)} aria-label={`Retirer 1 à ${titre}`}>
        −
      </button>
      <span className="corps">
        <span className="barre" style={{ ['--part' as string]: `${part}%` }} />
        <span className="chiffres num">
          {jauge.value}
          <i>/{jauge.max}</i>
        </span>
      </span>
      <button onClick={() => onAjuster(1)} aria-label={`Ajouter 1 à ${titre}`}>
        +
      </button>
    </span>
  )
}

/* ============================================================
   Prendre dans la bibliothèque ce que le moment n'a pas sous la main
   ============================================================ */

function ChoixMedia({
  onPick,
  onClose
}: {
  onPick: (it: UiItem) => void
  onClose: () => void
}): JSX.Element {
  const s = useStore()
  const [q, setQ] = useState('')

  const dossierDe = (it: UiItem): string => {
    const p = it.relPath ?? ''
    const i = p.lastIndexOf('/')
    return i < 0 ? 'racine' : p.slice(0, i)
  }

  const mot = q.trim().toLowerCase()
  const liste = s.fichiers
    .filter((i) => A_L_ECRAN.has(i.kind) || i.kind === 'audio')
    .filter((i) => !mot || `${i.title} ${i.relPath ?? ''}`.toLowerCase().includes(mot))
    .slice(0, 200)

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <IconSearch />
          <h3>Prendre dans la bibliothèque</h3>
        </header>

        <div className="body">
          <label className="cherche">
            <IconSearch />
            <input
              type="text"
              autoFocus
              value={q}
              placeholder="Chercher une image, une vidéo, un son"
              onChange={(e) => setQ(e.target.value)}
            />
          </label>

          <div className="liste-docs">
            {liste.map((it) => (
              <button key={it.id} className="doc-row" onClick={() => onPick(it)}>
                {kindIcon(it.kind)}
                <span className="t">
                  <span className="ttl">{it.title}</span>
                  <span className="sub">{dossierDe(it)}</span>
                </span>
              </button>
            ))}
            {liste.length === 0 ? (
              <p className="vide">
                {mot ? 'Rien de diffusable ne correspond.' : 'Aucun média dans la campagne.'}
              </p>
            ) : null}
          </div>
        </div>

        <footer>
          <button className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
        </footer>
      </div>
    </div>
  )
}
