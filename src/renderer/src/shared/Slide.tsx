import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { COLLAGE_CELLS, FRAME_NEUTRE, corpsDeCase, etatDeVie } from '@shared/types'
import { Brouillard } from './Brouillard'
import { barrieres, pasContraint, type Pt } from '@shared/murs'
import { bordsOuverture } from '@shared/ouvertures'
import type { Surbrillance } from '../mj/components/Tableau'
import type {
  CalqueBrouillard,
  CollageCell,
  Encart,
  EtatPion,
  Frame,
  JaugeVue,
  JoueurVu,
  Pion,
  Pointer,
  SlidePayload,
  TextOverlay
} from '@shared/types'

/**
 * De l'écran à la carte, et retour.
 *
 * Les pions sont posés en fractions de l'écran, les murs en fractions de
 * l'image : tout ce qui doit mettre les deux en présence — l'ombre, une
 * cloison qui retient un pion — passe par là.
 */
export interface Repere {
  /** Le quart de tour de l'image, en degrés. */
  rot: number
  /** L'agrandissement courant : les pions grossissent avec l'image. */
  zoom: number
  versCarte: (u: number, v: number) => { x: number; y: number }
  versEcran: (p: { x: number; y: number }) => { x: number; y: number }
  /**
   * Un pion est posé **au cadrage neutre** : c'est le sens de ses coordonnées
   * depuis toujours, et on ne les réécrit pas. Ces trois fonctions le suivent
   * quand l'image bouge — recadrée, agrandie, couchée — sans que rien ne
   * change tant qu'on ne touche à rien.
   */
  pionVersEcran: (u: number, v: number) => { x: number; y: number }
  ecranVersPion: (u: number, v: number) => { x: number; y: number }
  /** Et pour les murs, qui vivent dans la carte : du pion vers le plan. */
  pionVersCarte: (u: number, v: number) => { x: number; y: number }
  /** Le rectangle qu'occupe l'image dans son cadre, et sa transformation. */
  cadre: { left: number; top: number; width: number; height: number }
  transform: string
}

/**
 * Rendu d'une diapositive. Le même composant sert au moniteur du MJ,
 * à la grande prévisualisation de la régie et à la fenêtre des joueurs :
 * seule la font-size du conteneur change (voir slide.css).
 *
 * Les pions et le pointeur se posent par-dessus, en fractions de l'écran,
 * donc identiques aux trois échelles.
 */
export interface SlideExtras {
  /** Le temps qu'il fait sur l'image : pluie, vent, feu, brouillard. */
  /**
   * Le calque d'ombre : murs, ouvertures et lumières du lieu diffusé.
   *
   * Donné, la carte se couvre de noir et les pions des joueurs y creusent leur
   * regard. Absent ou nul, l'image se montre entière — c'est ce qui se passe
   * sur un plan sans murs, et côté MJ tant qu'il ne demande pas à voir ce que
   * les joueurs voient.
   */
  brouillard?: CalqueBrouillard | null
  /**
   * L'ombre se peint-elle ? Les murs servent même quand on ne la montre pas :
   * côté MJ, ils retiennent les pions alors que la carte reste entière.
   */
  ombre?: boolean
  /**
   * Ce que le MJ survole dans son tableau de scène, mis en évidence sur la
   * carte. Cela ne part **jamais** vers la fenêtre des joueurs : c'est un
   * repère de travail, pas un élément de la scène.
   */
  surbrillance?: Surbrillance
  pions?: Pion[]
  /** Taille des pions en pourcentage de la largeur. */
  pionSize?: number
  /**
   * Le pion que l'image suit, s'il y en a un.
   *
   * Le cadrage rangé dans la diapositive n'est pas réécrit : c'est à la
   * dernière seconde, ici, qu'on recentre l'image sur ce pion. Chaque écran le
   * fait pour sa propre taille, et le lâcher rend le cadrage intact.
   */
  focusPionId?: number | null
  /** Fourni côté MJ : la main reprend le cadrage, le pion est lâché. */
  onDefocus?: () => void
  pointer?: Pointer | null
  /**
   * Fourni seulement côté MJ : les pions deviennent saisissables, et la scène
   * accepte les lâchers. `cell` dit sur quelle case du collage on a lâché.
   */
  onDropAt?: (e: React.DragEvent, x: number, y: number, cell: number | null) => void
  onRemovePion?: (id: number) => void
  /** Fourni côté MJ : la molette sur un pion le fait tourner. */
  onRotatePion?: (id: number, deg: number) => void
  /**
   * Fourni côté MJ : le clic droit sur un pion ouvre son menu — calque, pion
   * caché, aplomb. Le menu lui-même est dessiné par le module, pas ici : le
   * calque des pions est dans un conteneur de taille, qui piège tout ce qui
   * se veut `position: fixed`.
   */
  onPionMenu?: (pion: Pion, x: number, y: number) => void
  /** Le nom du joueur s'écrit-il sous son pion ? Vrai par défaut. */
  pionLabels?: boolean
  /** Et ses points de vie, juste en dessous ? */
  pionPv?: boolean
  /** Les personnages joueurs : leurs visages et leurs points de vie. */
  joueurs?: JoueurVu[]
  /** L'encart des joueurs, posé où l'on veut sur l'image. */
  encart?: Encart
  /** Fourni côté MJ : l'encart se déplace à la souris. */
  onMoveEncart?: (x: number, y: number) => void
  /** Fourni côté MJ : la poignée du coin règle ses dimensions. */
  onSizeEncart?: (largeur: number, hauteur: number) => void
  /** Fourni côté MJ : les jauges s'ajustent d'un clic depuis l'encart. */
  onAjuster?: (characterId: number, key: string, delta: number) => void
  /** Case du collage que la prochaine image viendra remplir. */
  activeCell?: number
  onPickCell?: (index: number) => void
  /** Fourni côté MJ : la molette agrandit, le glisser recadre. */
  onFrame?: (cell: number | null, frame: Frame) => void
  /** Fourni côté MJ : les textes posés sur l'écran se déplacent à la souris. */
  onMoveText?: (id: number, x: number, y: number) => void
  /** Texte en cours de modification dans la régie. */
  activeText?: number | null
  onPickText?: (id: number) => void
}

export function Slide({
  slide,
  animate = true,
  brouillard,
  ombre = true,
  surbrillance,
  pions,
  pionSize = 6,
  focusPionId,
  onDefocus,
  pionLabels = true,
  pionPv = false,
  joueurs,
  encart,
  onMoveEncart,
  onSizeEncart,
  onAjuster,
  pointer,
  onDropAt,
  onRemovePion,
  onRotatePion,
  onPionMenu,
  activeCell,
  onPickCell,
  onFrame,
  onMoveText,
  activeText,
  onPickText
}: { slide: SlidePayload; animate?: boolean } & SlideExtras): JSX.Element {
  const cls = `slide sl-${slide.type}${animate ? ' slide-fade' : ''}`
  /* Le repère de l'image, que `Framed` publie dès qu'il le connaît. C'est un
     état et non une référence : les pions se replacent avec lui. */
  const [repere, setRepere] = useState<Repere | null>(null)

  /**
   * Un pion ne traverse pas un mur.
   *
   * Le lâcher donne un point d'arrivée ; on le ramène dans la carte, on y
   * cherche le pas le plus long qui ne coupe aucune cloison — en longeant le
   * mur plutôt qu'en s'y collant — et on renvoie le point corrigé, en
   * fractions d'écran comme il était venu.
   *
   * Un rideau laisse passer, une porte ouverte aussi : ce sont les mêmes
   * barrières que dans la fiche du lieu. Seul un pion **déjà posé** est
   * retenu ; celui qu'on vient poser se met où l'on veut.
   */
  const retenuParLesMurs = (pionId: string, x: number, y: number): { x: number; y: number } => {
    const r = repere
    const cal = brouillard
    const p = (pions ?? []).find((q) => String(q.id) === pionId)
    if (!r || !cal || !cal.murs.length || !p) return { x, y }
    /* La carte se mesure en pixels de son image : n'importe quelle échelle
       ferait l'affaire, pourvu que murs et pions partagent la même. */
    const W = 1000
    const H = 1000
    const enPx = (q: [number, number]): Pt => ({ x: q[0] * W, y: q[1] * H })
    const de = r.pionVersCarte(p.x, p.y)
    const vers = r.versCarte(x, y)
    const arrive = pasContraint(
      barrieres(cal.murs, 'pas', enPx, cal.ouvertures),
      { x: de.x * W, y: de.y * H },
      { x: vers.x * W, y: vers.y * H },
      { w: W, h: H },
      2
    )
    /* On rend un point d'écran : l'appelant le ramènera au cadrage neutre. */
    return r.versEcran({ x: arrive.x / W, y: arrive.y / H })
  }

  /**
   * Le lâcher est reçu par la scène elle-même, pas par le calque des pions :
   * lui est transparent aux événements, sinon il masquerait les cases.
   *
   * Chromium n'adresse ni le survol ni le lâcher à la case : il les donne à
   * l'élément qui a accepté le glisser, c'est-à-dire la scène. `e.target` ne
   * dit donc rien de fiable — la case se retrouve par le **point du curseur**,
   * qui est de toute façon ce que vise la main.
   */
  const caseSous = (x: number, y: number): HTMLElement | null =>
    (document.elementFromPoint(x, y) as HTMLElement | null)?.closest?.('.cell') ?? null

  /** Une seule case allumée à la fois : deux cadres, on ne sait plus où on va. */
  const vise = (host: HTMLElement, x: number, y: number): HTMLElement | null => {
    const cellEl = caseSous(x, y)
    host.querySelectorAll('.cell.over').forEach((c) => {
      if (c !== cellEl) c.classList.remove('over')
    })
    cellEl?.classList.add('over')
    return cellEl
  }

  /*
   * Le `dropEffect` doit être compatible avec l'`effectAllowed` posé au départ
   * du glisser, sinon Chromium refuse le lâcher sans rien dire. Un pion qu'on
   * redéplace part en 'move' : lui répondre 'copy' le rendait immobile une fois
   * posé. Tout le reste — une image, un lieu — part en 'copy'.
   */
  const effetPour = (e: React.DragEvent): 'move' | 'copy' =>
    e.dataTransfer.types.includes('text/pion') ? 'move' : 'copy'

  const dropProps = onDropAt
    ? {
        // Il ne suffit pas d'annuler l'événement : sans `dropEffect`, Chromium
        // considère que rien n'est accepté ici et remplace le lâcher par un
        // `dragleave`. C'est ce qui rendait les cases inertes.
        onDragEnter: (e: React.DragEvent) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = effetPour(e)
          vise(e.currentTarget as HTMLElement, e.clientX, e.clientY)
        },
        onDragOver: (e: React.DragEvent) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = effetPour(e)
          vise(e.currentTarget as HTMLElement, e.clientX, e.clientY)
        },
        onDragLeave: (e: React.DragEvent) => {
          const host = e.currentTarget as HTMLElement
          // On quitte vraiment la scène : plus rien ne doit rester allumé.
          if (!host.contains(document.elementFromPoint(e.clientX, e.clientY)))
            host.querySelectorAll('.cell.over').forEach((c) => c.classList.remove('over'))
        },
        onDrop: (e: React.DragEvent) => {
          e.preventDefault()
          const host = e.currentTarget as HTMLElement
          const cellEl = caseSous(e.clientX, e.clientY)
          host.querySelectorAll('.cell.over').forEach((c) => c.classList.remove('over'))
          const b = host.getBoundingClientRect()
          const brut = {
            x: (e.clientX - b.left) / b.width,
            y: (e.clientY - b.top) / b.height
          }
          const pionId = e.dataTransfer.getData('text/pion')
          /* Un pion se range au cadrage neutre : ce qu'on lâche à l'écran est
             d'abord ramené là, sinon il sauterait au premier recadrage. */
          const vise = pionId ? retenuParLesMurs(pionId, brut.x, brut.y) : brut
          const pose =
            repere && (pionId || e.dataTransfer.types.includes('text/pion-char'))
              ? repere.ecranVersPion(vise.x, vise.y)
              : vise
          onDropAt(e, pose.x, pose.y, cellEl ? Number(cellEl.dataset.cell) : null)
        }
      }
    : {}

  /*
   * L'encart des joueurs se pose sur tout, y compris le voile noir : il dit
   * l'état du groupe, et cet état ne dépend pas de ce qu'on montre.
   */
  const bandeau =
    encart?.on && joueurs?.length ? (
      <EncartJoueurs
        encart={encart}
        joueurs={joueurs}
        onMove={onMoveEncart}
        onSize={onSizeEncart}
        onAjuster={onAjuster}
      />
    ) : null

  // Les pions se posent sur une image, pas sur une carte à lire ni sur le noir.
  const visual = slide.type === 'image' || slide.type === 'video' || slide.type === 'collage'

  /*
   * Les yeux de la table : un pion de personnage-joueur, et lui seul.
   *
   * Un PNJ posé au fond du couloir ne découvre rien pour eux, et un pion
   * d'objet n'a pas d'yeux. Les positions sont en fractions de l'écran —
   * c'est `Framed` qui les ramène dans le repère de la carte, puisque c'est
   * lui qui sait où l'image se trouve et de combien elle est recadrée.
   */
  const yeux = (pions ?? [])
    .filter((p) => p.characterId != null)
    .map((p) => ({ x: p.x, y: p.y, cap: p.rotation, characterId: p.characterId as number }))

  /*
   * Le pion que l'image suit, réduit à ce dont la géométrie a besoin : deux
   * nombres. S'il n'est plus là — retiré, caché, resté dans l'autre lieu —,
   * l'image reprend son cadrage sans qu'on ait rien à défaire.
   */
  const suivi = focusPionId != null ? (pions ?? []).find((p) => p.id === focusPionId) : undefined
  const focus = suivi ? { x: suivi.x, y: suivi.y } : null

  const layer =
    visual && ((pions && pions.length) || pointer || onDropAt) ? (
      <PionLayer
        repere={repere}
        pions={pions ?? []}
        pionSize={pionSize}
        focusPionId={focusPionId ?? null}
        pionLabels={pionLabels}
        pionPv={pionPv}
        joueurs={joueurs ?? []}
        pointer={pointer ?? null}
        live={!!onDropAt}
        onRemovePion={onRemovePion}
        onRotatePion={onRotatePion}
        onPionMenu={onPionMenu}
      />
    ) : null

  // Les textes se posent sur n'importe quoi : une carte, un collage, le noir.
  const lus = (slide.texts ?? []).filter((o) => o.text.trim())
  const texte = lus.length ? (
    <div className={`legendes${onMoveText ? ' live' : ''}`}>
      {lus.map((o) => (
        <TexteUn
          key={o.id}
          o={o}
          actif={activeText === o.id}
          onMove={onMoveText}
          onPick={onPickText}
        />
      ))}
    </div>
  ) : null

  if (slide.type === 'black') {
    return (
      <div className={cls} key="black" {...dropProps}>
        <div className="sigil" />
        <div className="w">écran joueurs</div>
        {texte}
        {bandeau}
      </div>
    )
  }

  if (slide.type === 'image') {
    return (
      <div className={cls} key={`img-${slide.itemId}`} {...dropProps}>
        <div className="slide-media">
          <Framed
            url={slide.url}
            alt={slide.title}
            frame={slide.frame}
            focus={focus}
            onDefocus={onDefocus}
            brouillard={brouillard}
            yeux={yeux}
            ombre={ombre}
            surbrillance={surbrillance}
            onRepere={setRepere}
            onFrame={onFrame ? (f) => onFrame(null, f) : undefined}
          />
        </div>
        {layer}
        {texte}
        {bandeau}
      </div>
    )
  }

  /* Une vidéo passe par le même cadre qu'une image : elle se recadre, se
     pivote et s'éclaircit de la même façon, et il n'y a plus deux géométries
     à tenir d'accord. */
  if (slide.type === 'video') {
    return (
      <div className={cls} key={`vid-${slide.itemId}`} {...dropProps}>
        <div className="slide-media">
          <Framed
            url={slide.url}
            alt={slide.title}
            frame={slide.frame}
            focus={focus}
            onDefocus={onDefocus}
            onFrame={onFrame ? (f) => onFrame(null, f) : undefined}
            video
            loop={slide.loop}
          />
        </div>
        {layer}
        {texte}
        {bandeau}
      </div>
    )
  }

  if (slide.type === 'collage') {
    // La disposition fait foi : si l'état porte des cases en trop — un ancien
    // collage plus fourni, un lâcher mal placé — elles ne sont pas dessinées.
    const cases = Array.from(
      { length: COLLAGE_CELLS[slide.layout] ?? slide.cells.length },
      (_, i) => slide.cells[i] ?? null
    )
    return (
      <div className={`${cls} lay-${slide.layout}`} key={`col-${slide.layout}`} {...dropProps}>
        {cases.map((c, i) => (
          <div
            key={i}
            data-cell={i}
            className={`cell${activeCell === i ? ' active' : ''}${c ? '' : ' empty'}`}
            onClick={onPickCell ? () => onPickCell(i) : undefined}
            title={onPickCell ? titreDeCase(c) : undefined}
          >
            {c?.kind === 'texte' ? (
              <CaseTexte texte={c.texte} color={c.color} />
            ) : c ? (
              <>
                <Framed
                  url={c.url}
                  alt={c.title}
                  frame={c.frame}
                  onFrame={onFrame ? (f) => onFrame(i, f) : undefined}
                  /* Un collage d'une seule case est une carte plein écran qui
                     s'ignore : les murs, l'ombre et les pions y ont leur place
                     comme ailleurs. À plusieurs cases, aucune ne peut prétendre
                     porter la scène — on ne pose rien. */
                  brouillard={cases.length === 1 ? brouillard : null}
                  yeux={cases.length === 1 ? yeux : undefined}
                  ombre={ombre}
                  surbrillance={cases.length === 1 ? surbrillance : undefined}
                  onRepere={cases.length === 1 ? setRepere : undefined}
                />
                {/* La légende appartient à la case : elle se range dedans, en
                    bas, comme le carton d'un tableau — et non quelque part sur
                    l'écran, ce que font déjà les textes libres. */}
                {c.caption?.trim() ? <span className="cell-cap">{c.caption}</span> : null}
              </>
            ) : null}
            {onPickCell ? <span className="cell-n">{i + 1}</span> : null}
          </div>
        ))}
        {layer}
        {texte}
      </div>
    )
  }

  if (slide.type === 'plate') {
    return (
      <div className={cls} key={`plate-${slide.title}`}>
        <div>
          <div className="ttl">{slide.title}</div>
          {slide.subtitle ? <div className="sub">{slide.subtitle}</div> : null}
        </div>
        {texte}
        {bandeau}
      </div>
    )
  }

  // texte
  return (
    <div className={cls} key={`text-${slide.title}`}>
      <div className="q">
        <span className="k">{slide.kicker ?? slide.title}</span>
        <div className="body" dangerouslySetInnerHTML={{ __html: slide.html }} />
      </div>
      {texte}
      {bandeau}
    </div>
  )
}

/* ============================================================
   Le texte posé sur l'écran
   ============================================================ */

/**
 * Un texte par-dessus la diapositive. Sa taille est en `cqw`, comme les pions :
 * le même réglage donne la même image dans le moniteur, dans la régie et chez
 * les joueurs. Côté MJ il se saisit à la souris ; on n'enregistre qu'au
 * relâchement, sinon les joueurs le verraient trembler.
 */
function TexteUn({
  o,
  actif,
  onMove,
  onPick
}: {
  o: TextOverlay
  actif: boolean
  onMove?: (id: number, x: number, y: number) => void
  onPick?: (id: number) => void
}): JSX.Element {
  const [pos, setPos] = useState({ x: o.x, y: o.y })
  const drag = useRef<{ x: number; y: number; from: { x: number; y: number } } | null>(null)
  const bouge = useRef(false)

  useEffect(() => setPos({ x: o.x, y: o.y }), [o.x, o.y])

  return (
    <div
      className={`legende${o.plate ? ' plate' : ''}${actif ? ' actif' : ''}`}
      style={
        {
          left: `${pos.x * 100}%`,
          top: `${pos.y * 100}%`,
          color: o.color,
          '--os': o.size
        } as React.CSSProperties
      }
      title={onMove ? 'Glisse pour déplacer · clique pour le modifier' : undefined}
      onPointerDown={(e) => {
        if (!onMove || e.button !== 0) return
        e.preventDefault()
        drag.current = { x: e.clientX, y: e.clientY, from: pos }
        bouge.current = false
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        const d = drag.current
        const b = e.currentTarget.parentElement?.getBoundingClientRect()
        if (!d || !b) return
        if (Math.abs(e.clientX - d.x) > 3 || Math.abs(e.clientY - d.y) > 3) bouge.current = true
        setPos({
          x: clamp(d.from.x + (e.clientX - d.x) / b.width, 0, 1),
          y: clamp(d.from.y + (e.clientY - d.y) / b.height, 0, 1)
        })
      }}
      onPointerUp={(e) => {
        if (!drag.current) return
        drag.current = null
        e.currentTarget.releasePointerCapture(e.pointerId)
        // Un simple clic choisit le texte à modifier ; un glisser le déplace.
        if (bouge.current) onMove?.(o.id, pos.x, pos.y)
        else onPick?.(o.id)
      }}
    >
      {o.text}
    </div>
  )
}

/* ============================================================
   Cadrage — la molette agrandit, le glisser déplace
   ============================================================ */

const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v))

const quart = (f: Frame | undefined): number => f?.rot ?? 0
/** Un quart de tour d'un côté ou de l'autre couche l'image : largeur et hauteur s'échangent. */
const couche = (rot: number): boolean => rot === 90 || rot === 270

/**
 * Le facteur qui remet l'image entière dans son cadre **après** rotation.
 * `object-fit: contain` l'ajuste avant de tourner ; une fois couchée, elle
 * déborde (ou flotte), d'où cette correction. Droite, il vaut 1.
 */
/*
 * Le facteur ne dépend que des *proportions* du cadre et de l'image, jamais de
 * leur taille : le lire au rendu suffit, un redimensionnement de la fenêtre ne
 * le change pas. Inutile d'observer le cadre.
 */
function ajuste(
  box: DOMRect | undefined,
  nat: { w: number; h: number } | null,
  rot: number
): number {
  if (!box || !box.width || !nat || !couche(rot)) return 1
  const entier = Math.min(box.width / nat.w, box.height / nat.h)
  const iw = nat.w * entier
  const ih = nat.h * entier
  return Math.min(box.width / ih, box.height / iw)
}

/**
 * Jusqu'où l'image peut se décaler sans qu'on voie du vide, axe par axe.
 * Elle entre entière dans son cadre au départ : tant qu'un axe ne déborde pas,
 * il n'y a rien à déplacer de ce côté-là. Couchée, ses deux axes s'échangent.
 */
function limites(
  box: DOMRect | undefined,
  nat: { w: number; h: number } | null,
  z: number,
  rot = 0
): { lx: number; ly: number } {
  if (!box || !box.width || !nat) {
    const l = Math.max(0, (z - 1) / 2)
    return { lx: l, ly: l }
  }
  const entier = Math.min(box.width / nat.w, box.height / nat.h)
  const k = z * ajuste(box, nat, rot)
  let w = nat.w * entier * k
  let h = nat.h * entier * k
  if (couche(rot)) [w, h] = [h, w]
  return {
    lx: Math.max(0, (w - box.width) / box.width / 2),
    ly: Math.max(0, (h - box.height) / box.height / 2)
  }
}

/**
 * Une image qu'on recadre à la main : molette pour agrandir autour du curseur,
 * glisser pour décaler, double-clic pour remettre droit. Exportée parce que la
 * fiche de compétences d'un personnage veut exactement les mêmes gestes que la
 * Régie — et surtout les mêmes bornes, qui interdisent de laisser voir du vide.
 */
/**
 * Une image — ou une vidéo — dans son cadre, recadrable à la main.
 *
 * Les deux ont les mêmes besoins : une carte scannée de travers se redresse,
 * une vidéo filmée trop large se resserre, et l'une comme l'autre peut être
 * trop sombre. Toute la géométrie est ici ; seule la balise change, et la
 * façon de lui demander ses proportions.
 */
export function Framed({
  url,
  alt,
  frame,
  onFrame,
  focus,
  onDefocus,
  video,
  loop,
  brouillard,
  yeux,
  ombre: montrerOmbre = true,
  surbrillance,
  onRepere
}: {
  url: string
  alt: string
  frame?: Frame
  onFrame?: (f: Frame) => void
  /**
   * Le point que l'image suit, en fractions de l'écran au cadrage neutre —
   * les coordonnées d'un pion. Donné, le décalage du cadrage n'est plus lu :
   * il est recalculé à chaque image pour amener ce point au centre.
   */
  focus?: { x: number; y: number } | null
  /** La main reprend le cadrage : à celui qui tient le focus de le lâcher. */
  onDefocus?: () => void
  /** Une vidéo au lieu d'une image : même cadre, même recadrage. */
  video?: boolean
  loop?: boolean
  /** Le calque d'ombre à poser sur cette image, s'il y en a un. */
  brouillard?: CalqueBrouillard | null
  /** Les pions des joueurs, en fractions de l'écran. */
  yeux?: { x: number; y: number; cap: number; characterId: number }[]
  /** L'ombre se peint-elle ? Les murs servent aussi quand on ne la montre pas. */
  ombre?: boolean
  /** Ce que le MJ survole dans son tableau : un halo, chez lui seulement. */
  surbrillance?: Surbrillance
  /** L'image publie son repère : c'est par là qu'on passe de l'écran à la carte. */
  onRepere?: (r: Repere | null) => void
}): JSX.Element {
  const box = useRef<HTMLDivElement>(null)
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null)
  /* La taille du cadre, mesurée et non devinée : l'ombre doit tomber au pixel
     sur l'image, y compris quand la fenêtre change de taille. */
  const [taille, setTaille] = useState<{ w: number; h: number } | null>(null)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const lire = (): void => {
      const r = el.getBoundingClientRect()
      setTaille((t) => (t && t.w === r.width && t.h === r.height ? t : { w: r.width, h: r.height }))
    }
    lire()
    const ro = new ResizeObserver(lire)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const [live, setLive] = useState<Frame>(frame ?? FRAME_NEUTRE)
  const drag = useRef<{ x: number; y: number; from: Frame } | null>(null)
  // Un recadrage se termine par un clic : il ne doit pas être pris pour une
  // sélection de case.
  const bouge = useRef(false)

  useEffect(() => {
    setLive(frame ?? FRAME_NEUTRE)
  }, [frame?.zoom, frame?.ox, frame?.oy, frame?.rot, frame?.lum])

  // Source suivante : ses proportions ne sont pas celles de la précédente.
  useEffect(() => setNat(null), [url])

  /*
   * Une image déjà en cache ne déclenche pas `load`.
   *
   * Le navigateur l'a décodée avant que React n'ait posé l'écouteur, et
   * `onLoad` n'arrive jamais : on restait sans proportions. Tant que seul
   * `ajuste()` s'en servait, cela passait inaperçu — il rend 1 par défaut.
   * Depuis que les pions et l'ombre s'accrochent à la carte, il faut la
   * mesure : on va donc la chercher sur l'élément lui-même.
   */
  const media = useRef<HTMLImageElement & HTMLVideoElement>(null)
  useEffect(() => {
    const el = media.current
    if (!el) return
    const w = (el as HTMLImageElement).naturalWidth || (el as HTMLVideoElement).videoWidth
    const h = (el as HTMLImageElement).naturalHeight || (el as HTMLVideoElement).videoHeight
    if (w && h) setNat((n) => (n && n.w === w && n.h === h ? n : { w, h }))
  }, [url, taille])

  const pose = (f: Frame, garder = false): void => {
    setLive(f)
    if (!garder) onFrame?.(f)
  }

  /*
   * Le cadrage tel qu'on le montre — celui qu'on a rangé, ou celui que le pion
   * suivi impose.
   *
   * Suivre quelqu'un, ce n'est pas réécrire le cadrage vingt fois par seconde :
   * c'est le recalculer au moment de dessiner, ici, avec la taille de **cet**
   * écran. Le poste du MJ et la fenêtre des joueurs n'ont ni la même boîte ni
   * les mêmes marges, et chacun recentre chez lui à partir de la même consigne.
   *
   * Les mêmes bornes qu'au glisser : un pion collé au bord de la carte ne fait
   * pas apparaître du vide à côté de lui, l'image s'arrête et lui continue.
   * L'agrandissement, lui, reste celui du MJ : le pion dit où l'on regarde,
   * pas d'à quelle distance.
   */
  const vue = ((): Frame => {
    if (!focus || !taille || !taille.w || !taille.h) return live
    const b = box.current?.getBoundingClientRect()
    const r = quart(live)
    const rad = (r * Math.PI) / 180
    const cs = Math.cos(rad)
    const sn = Math.sin(rad)
    const X = (focus.x - 0.5) * taille.w
    const Y = (focus.y - 0.5) * taille.h
    /* La même rotation que `pionVersEcran`, puis on annule le résultat : c'est
       la définition même de « ce pion au centre ». */
    const Xr = X * cs - Y * sn
    const Yr = X * sn + Y * cs
    const { lx, ly } = limites(b, nat, live.zoom, r)
    return {
      ...live,
      ox: clamp(-(Xr * live.zoom) / taille.w, -lx, lx),
      oy: clamp(-(Yr * live.zoom) / taille.h, -ly, ly)
    }
  })()

  /* Le même calcul pour une image et pour une vidéo : ce sont les mêmes
     proportions dans le même cadre. */
  const styleImage: React.CSSProperties = {
    /*
     * L'ordre compte : on tourne d'abord, on agrandit ensuite, on décale
     * en dernier. Le décalage reste donc aligné sur l'écran, pas sur
     * l'image — c'est ce que la main attend quand elle tire dessus.
     */
    transform:
      `translate(${vue.ox * 100}%, ${vue.oy * 100}%)` +
      ` scale(${vue.zoom * ajuste(box.current?.getBoundingClientRect(), nat, quart(vue))})` +
      ` rotate(${quart(vue)}deg)`,
    // À 1, pas de filtre du tout : inutile d'allumer une couche de
    // composition sur chaque image d'un collage pour ne rien changer.
    filter: vue.lum != null && vue.lum !== 1 ? `brightness(${vue.lum})` : undefined
  }

  /**
   * L'ombre des murs, posée sur l'image.
   *
   * Tout se joue dans le repère de la **carte** : les murs y sont déjà, les
   * pions non — ils sont posés en fractions de l'écran, et l'image peut être
   * agrandie, décalée, couchée. On refait donc le chemin à l'envers pour
   * chaque œil, puis on colle le calque sur le rectangle exact qu'occupe
   * l'image, avec la même transformation qu'elle : il la suit partout.
   */
  /**
   * Le repère de l'image : passer de l'écran à la carte, et retour.
   *
   * L'image est ajustée dans son cadre, puis agrandie, tournée, décalée. Les
   * murs vivent dans la carte, les pions sur l'écran : sans ce va-et-vient,
   * les deux ne se rencontrent jamais. Nul tant qu'on ne sait pas encore la
   * taille de l'image — on ne devine pas une géométrie.
   */
  const repere = ((): Repere | null => {
    if (!nat || !taille || taille.w <= 0) return null
    /* Le repère suit la **vue** et non le cadrage rangé : sans cela l'image se
       recentrerait sur le pion suivi, et les pions, eux, resteraient à leur
       ancienne place — l'ombre des murs avec. */
    const r = quart(vue)
    const s = vue.zoom * ajuste(box.current?.getBoundingClientRect(), nat, r)
    const entier = Math.min(taille.w / nat.w, taille.h / nat.h)
    const iw = nat.w * entier
    const ih = nat.h * entier
    const a = (-r * Math.PI) / 180
    const cos = Math.cos(a)
    const sin = Math.sin(a)
    const rad = (r * Math.PI) / 180
    const cs = Math.cos(rad)
    const sn = Math.sin(rad)
    return {
      rot: r,
      zoom: vue.zoom,
      pionVersEcran: (u, v) => {
        const X = (u - 0.5) * taille.w
        const Y = (v - 0.5) * taille.h
        const Xr = X * cs - Y * sn
        const Yr = X * sn + Y * cs
        return {
          x: (Xr * vue.zoom + vue.ox * taille.w) / taille.w + 0.5,
          y: (Yr * vue.zoom + vue.oy * taille.h) / taille.h + 0.5
        }
      },
      ecranVersPion: (u, v) => {
        const X = ((u - 0.5) * taille.w - vue.ox * taille.w) / vue.zoom
        const Y = ((v - 0.5) * taille.h - vue.oy * taille.h) / vue.zoom
        return { x: (X * cs + Y * sn) / taille.w + 0.5, y: (-X * sn + Y * cs) / taille.h + 0.5 }
      },
      pionVersCarte: (u, v) => ({
        x: ((u - 0.5) * taille.w) / iw + 0.5,
        y: ((v - 0.5) * taille.h) / ih + 0.5
      }),
      versCarte: (u, v) => {
        const X = ((u - 0.5) * taille.w - vue.ox * taille.w) / s
        const Y = ((v - 0.5) * taille.h - vue.oy * taille.h) / s
        return { x: (X * cos - Y * sin) / iw + 0.5, y: (X * sin + Y * cos) / ih + 0.5 }
      },
      versEcran: (p) => {
        /* Le chemin d'aller : on tourne, on agrandit, on décale. */
        const X = (p.x - 0.5) * iw
        const Y = (p.y - 0.5) * ih
        const ca = Math.cos(-a)
        const sa = Math.sin(-a)
        const Xr = X * ca - Y * sa
        const Yr = X * sa + Y * ca
        return {
          x: (Xr * s + vue.ox * taille.w) / taille.w + 0.5,
          y: (Yr * s + vue.oy * taille.h) / taille.h + 0.5
        }
      },
      cadre: { left: (taille.w - iw) / 2, top: (taille.h - ih) / 2, width: iw, height: ih },
      transform: `translate(${vue.ox * taille.w}px, ${vue.oy * taille.h}px) scale(${s}) rotate(${r}deg)`
    }
  })()

  /* La scène qui nous porte a besoin de ce repère pour retenir un pion au mur :
     on le lui passe dès qu'il change. */
  useEffect(() => {
    onRepere?.(repere)
    return () => onRepere?.(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repere?.transform, repere?.cadre.width, repere?.cadre.height, !!onRepere])

  const ombre = ((): JSX.Element | null => {
    if (!brouillard || !nat || !repere) return null
    if (!brouillard.murs.length) return null
    const { pionVersCarte, rot: r } = repere
    const vus = (yeux ?? []).map((o) => {
      const p = pionVersCarte(o.x, o.y)
      /* Le cap tourne avec l'image : une carte couchée d'un quart de tour ne
         fait pas regarder les joueurs ailleurs. */
      return { x: p.x, y: p.y, cap: o.cap - r, characterId: o.characterId }
    })
    if (!montrerOmbre) return null
    return (
      <div className="brouillard-cadre" style={{ ...repere.cadre, transform: repere.transform }}>
        <Brouillard calque={brouillard} yeux={vus} w={nat.w} h={nat.h} />
      </div>
    )
  })()

  /**
   * Ce que le MJ survole, montré sur la carte.
   *
   * Une lampe se cercle, une porte s'épaissit, une pièce se remplit. C'est le
   * seul calque de cette scène qui ne parle qu'au MJ : la fenêtre des joueurs
   * ne reçoit pas de survol, elle n'a donc rien à cacher.
   */
  const halo = ((): JSX.Element | null => {
    if (!surbrillance || !brouillard || !nat || !repere) return null
    const w = nat.w
    const h = nat.h
    let dessin: JSX.Element | null = null
    if (surbrillance.quoi === 'piece') {
      dessin = (
        <polygon
          className="halo-piece"
          points={surbrillance.pts.map((p) => `${p[0] * w},${p[1] * h}`).join(' ')}
        />
      )
    } else if (surbrillance.quoi === 'lumiere') {
      const l = brouillard.lumieres.find((x) => x.id === surbrillance.id)
      if (l)
        dessin = (
          <>
            <circle
              className="halo-lum"
              cx={l.x * w}
              cy={l.y * h}
              r={Math.max(l.penombre * w, 18)}
            />
            <circle className="halo-pt" cx={l.x * w} cy={l.y * h} r={Math.max(w * 0.006, 5)} />
          </>
        )
    } else if (surbrillance.quoi === 'mur') {
      /* Un rideau n'est pas un point mais un trait : on repasse dessus. */
      const m = brouillard.murs.find((x) => x.id === surbrillance.id)
      if (m && m.pts.length > 1)
        dessin = (
          <polyline
            className="halo-porte"
            points={m.pts.map((p) => `${p[0] * w},${p[1] * h}`).join(' ')}
            strokeWidth={Math.max(6, w * 0.01)}
          />
        )
    } else {
      const o = brouillard.ouvertures.find((x) => x.id === surbrillance.id)
      const mur = o && brouillard.murs.find((m) => m.id === o.murId)
      if (o && mur) {
        const b = bordsOuverture(mur, o)
        dessin = (
          <line
            className="halo-porte"
            x1={b.a[0] * w}
            y1={b.a[1] * h}
            x2={b.b[0] * w}
            y2={b.b[1] * h}
            strokeWidth={Math.max(6, w * 0.01)}
          />
        )
      }
    }
    if (!dessin) return null
    return (
      <div className="brouillard-cadre" style={{ ...repere.cadre, transform: repere.transform }}>
        <svg className="brouillard" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
          {dessin}
        </svg>
      </div>
    )
  })()

  /**
   * La molette agrandit autour du curseur : le point visé ne bouge pas, sinon
   * on perd ce qu'on regardait dès le premier cran.
   */
  useEffect(() => {
    const el = box.current
    if (!el || !onFrame) return
    const h = (e: WheelEvent): void => {
      e.preventDefault()
      const b = el.getBoundingClientRect()
      const z = clamp(live.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12), 1, 8)
      /*
       * Un pion suivi tient le centre : la molette ne fait plus qu'approcher
       * ou reculer, et c'est donc sur lui qu'on approche. On n'écrit que
       * l'agrandissement — le décalage rangé reste celui d'avant, et il
       * reviendra tel quel le jour où l'on lâchera le pion.
       */
      if (focus) {
        pose({ ...live, zoom: z })
        return
      }
      const uc = (e.clientX - b.left) / b.width - 0.5
      const vc = (e.clientY - b.top) / b.height - 0.5
      const k = z / live.zoom
      const { lx, ly } = limites(b, nat, z, quart(live))
      pose({
        zoom: z,
        ox: clamp(uc - k * (uc - live.ox), -lx, lx),
        oy: clamp(vc - k * (vc - live.oy), -ly, ly),
        rot: live.rot,
        lum: live.lum
      })
    }
    el.addEventListener('wheel', h, { passive: false })
    return () => el.removeEventListener('wheel', h)
  }, [live.zoom, live.ox, live.oy, live.rot, live.lum, nat, onFrame, !!focus])

  return (
    <div
      ref={box}
      className={`framed${onFrame ? ' live' : ''}`}
      onPointerDown={(e) => {
        if (!onFrame || e.button !== 0) return
        /* Reprendre l'image à la main, c'est lâcher le pion — mais sans saut :
           on repart du cadrage qu'on avait sous les yeux, pas de celui qui
           dormait dans la diapositive. */
        if (focus) onDefocus?.()
        drag.current = { x: e.clientX, y: e.clientY, from: vue }
        bouge.current = false
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        const d = drag.current
        const b = box.current?.getBoundingClientRect()
        if (!d || !b) return
        if (Math.abs(e.clientX - d.x) > 3 || Math.abs(e.clientY - d.y) > 3) bouge.current = true
        const { lx, ly } = limites(b, nat, d.from.zoom, quart(d.from))
        pose(
          {
            zoom: d.from.zoom,
            ox: clamp(d.from.ox + (e.clientX - d.x) / b.width, -lx, lx),
            oy: clamp(d.from.oy + (e.clientY - d.y) / b.height, -ly, ly),
            rot: d.from.rot,
            lum: d.from.lum
          },
          true // on n'enregistre qu'au relâchement : pas un aller-retour par pixel
        )
      }}
      onPointerUp={(e) => {
        if (!drag.current) return
        drag.current = null
        e.currentTarget.releasePointerCapture(e.pointerId)
        onFrame?.(live)
      }}
      onClickCapture={(e) => {
        if (bouge.current) e.stopPropagation()
      }}
      /* Le double-clic remet le **cadrage** droit ; la luminosité n'en est pas,
         elle corrige le fichier. Elle a son propre retour à 100 %. */
      onDoubleClick={() => {
        if (!onFrame) return
        if (focus) onDefocus?.()
        pose({ ...FRAME_NEUTRE, lum: live.lum })
      }}
      title={
        !onFrame
          ? undefined
          : focus
            ? 'L’écran suit un pion · molette : approcher · glisser : reprendre la main'
            : 'Molette : agrandir · glisser : recadrer · double-clic : remettre droit et d’aplomb'
      }
    >
      {video ? (
        <video
          key={url}
          ref={media}
          src={url}
          autoPlay
          loop={loop}
          /* Le son passe par la piste d'ambiance, pas par la vidéo. */
          muted
          playsInline
          onLoadedMetadata={(e) =>
            setNat({ w: e.currentTarget.videoWidth, h: e.currentTarget.videoHeight })
          }
          style={styleImage}
        />
      ) : (
      <img
        ref={media}
        src={url}
        alt={alt}
        draggable={false}
        onLoad={(e) =>
          setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
        }
        style={styleImage}
      />
      )}
      {/* Après l'image, jamais avant : peinte dessous, l'ombre ne se verrait
          pas. C'est le genre de détail qui ne se trouve qu'à l'écran. */}
      {ombre}
      {halo}
    </div>
  )
}

/* ============================================================
   L'encart des joueurs
   ============================================================ */

/* Les deux icônes sont dessinées ici, et non importées de l'interface du MJ :
   ce module est partagé avec la fenêtre des joueurs, qui n'en connaît rien. */
const Coeur = (): JSX.Element => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 20s-7-4.6-7-9.4A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7 2.6C19 15.4 12 20 12 20z" />
  </svg>
)

const Cerveau = (): JSX.Element => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M9 4.5a2.6 2.6 0 0 0-2.6 2.6A2.6 2.6 0 0 0 4.5 9.7c0 .9.4 1.7 1.1 2.2a2.6 2.6 0 0 0-.6 1.7 2.6 2.6 0 0 0 2.6 2.6c0 1.4 1.1 2.5 2.5 2.5h.9V4.5z" />
    <path d="M15 4.5a2.6 2.6 0 0 1 2.6 2.6 2.6 2.6 0 0 1 1.9 2.6c0 .9-.4 1.7-1.1 2.2a2.6 2.6 0 0 1 .6 1.7 2.6 2.6 0 0 1-2.6 2.6c0 1.4-1.1 2.5-2.5 2.5H13V4.5z" />
  </svg>
)

/**
 * Les joueurs et leurs jauges, posés où le MJ l'a décidé sur l'image.
 * Pas de nom : le visage suffit à la table, et la place est précieuse.
 *
 * Côté MJ seulement — quand `onAjuster` est fourni — chaque jauge porte un
 * moins et un plus : un coup encaissé se note sans quitter la régie.
 */
function EncartJoueurs({
  encart,
  joueurs,
  onMove,
  onSize,
  onAjuster
}: {
  encart: Encart
  joueurs: JoueurVu[]
  onMove?: (x: number, y: number) => void
  onSize?: (largeur: number, hauteur: number) => void
  onAjuster?: (characterId: number, key: string, delta: number) => void
}): JSX.Element {
  const boite = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: encart.x, y: encart.y })
  const [taille, setTaille] = useState({ l: encart.largeur, h: encart.hauteur })
  /*
   * L'unité de tout ce qui s'écrit dedans, en pixels, **mesurée** plutôt que
   * déduite : `cqh` se résout contre un conteneur qui n'est pas toujours celui
   * qu'on croit, et le texte se retrouvait trois fois trop petit. Un joueur
   * occupe toute la hauteur en ligne, sa part en colonne.
   */
  const [u, setU] = useState(1)
  const drag = useRef<{ x: number; y: number; from: { x: number; y: number } } | null>(null)
  const poigne = useRef<{ x: number; y: number; l: number; h: number } | null>(null)
  const bouge = useRef(false)

  useEffect(() => setPos({ x: encart.x, y: encart.y }), [encart.x, encart.y])
  useEffect(
    () => setTaille({ l: encart.largeur, h: encart.hauteur }),
    [encart.largeur, encart.hauteur]
  )

  useEffect(() => {
    const el = boite.current
    if (!el) return
    const lire = (): void => {
      const b = el.getBoundingClientRect()
      const n = Math.max(1, joueurs.length)
      const vertical = encart.sens === 'vertical'
      /*
       * L'unité tient compte des **deux** dimensions de la place d'un joueur :
       * sa hauteur vaut cent unités, sa largeur deux cent cinq — un
       * visage, deux jauges, leurs barres et « 100/100 » en chiffres. En ne
       * regardant que la hauteur, une colonne étroite rognait les nombres.
       */
      const hDispo = vertical ? b.height / n : b.height
      const lDispo = vertical ? b.width : b.width / n
      setU(Math.max(0.2, Math.min(hDispo / 100, lDispo / 205)))
    }
    lire()
    const ro = new ResizeObserver(lire)
    ro.observe(el)
    return () => ro.disconnect()
  }, [encart.sens, joueurs.length])

  return (
    <div className="encart-zone">
      <div
        ref={boite}
        className={`encart sens-${encart.sens}${onMove ? ' live' : ''}`}
        style={{
          /* La boîte ne peut pas sortir de l'écran : son centre se retient à
             une demi-largeur des bords. Sans cela, faire pivoter un bandeau bas
             en colonne l'envoyait à moitié hors champ. */
          left: `${clamp(pos.x, taille.l / 200, 1 - taille.l / 200) * 100}%`,
          top: `${clamp(pos.y, taille.h / 200, 1 - taille.h / 200) * 100}%`,
          width: `${taille.l}cqw`,
          height: `${taille.h}cqh`,
          ['--u' as string]: `${u}px`
        }}
        onPointerDown={(e) => {
          /* Un moins ou un plus n'est pas une prise : sinon on déplacerait
             l'encart à chaque point de vie retiré. */
          if (!onMove || e.button !== 0 || (e.target as HTMLElement).closest('.pas')) return
          /* Sans `preventDefault`, la sélection native du navigateur démarre et
             avale les déplacements : la prise reste sans effet. */
          e.preventDefault()
          drag.current = { x: e.clientX, y: e.clientY, from: pos }
          bouge.current = false
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          const d = drag.current
          const b = e.currentTarget.parentElement?.getBoundingClientRect()
          if (!d || !b) return
          if (Math.abs(e.clientX - d.x) > 3 || Math.abs(e.clientY - d.y) > 3) bouge.current = true
          setPos({
            x: clamp(d.from.x + (e.clientX - d.x) / b.width, 0, 1),
            y: clamp(d.from.y + (e.clientY - d.y) / b.height, 0, 1)
          })
        }}
        onPointerUp={(e) => {
          if (!drag.current) return
          drag.current = null
          e.currentTarget.releasePointerCapture(e.pointerId)
          /* On n'enregistre qu'au relâchement : sinon les joueurs verraient
             l'encart trembler pendant qu'on le place. */
          if (bouge.current) onMove?.(pos.x, pos.y)
        }}
      >
        {joueurs.map((j) => (
          <div key={j.id} className={`ejoueur c-${j.color ?? 'neutral'}`}>
            <span className="face">
              {j.url ? <img src={j.url} alt={j.name} /> : <span className="ini">{j.initials}</span>}
            </span>
            <span className="jauges">
              {j.pv ? (
                <Jauge
                  j={j.pv}
                  icone={<Coeur />}
                  classe="vie"
                  titre={`${j.name} — ${j.pv.label}`}
                  onAjuster={onAjuster ? (d) => onAjuster(j.id, j.pv!.key, d) : undefined}
                />
              ) : null}
              {encart.sm && j.sm ? (
                <Jauge
                  j={j.sm}
                  icone={<Cerveau />}
                  classe="esprit"
                  titre={`${j.name} — ${j.sm.label}`}
                  onAjuster={onAjuster ? (d) => onAjuster(j.id, j.sm!.key, d) : undefined}
                />
              ) : null}
            </span>
          </div>
        ))}

        {onSize ? (
          <span
            className="poignee"
            title="Tirer pour régler la largeur et la hauteur"
            onPointerDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              poigne.current = { x: e.clientX, y: e.clientY, l: taille.l, h: taille.h }
              e.currentTarget.setPointerCapture(e.pointerId)
            }}
            onPointerMove={(e) => {
              const p = poigne.current
              const b = (e.currentTarget.parentElement?.parentElement as HTMLElement | undefined)
                ?.getBoundingClientRect()
              if (!p || !b) return
              /* La poignée est au coin : on tire depuis le centre, donc un
                 pixel gagné d'un côté en gagne autant de l'autre. */
              setTaille({
                l: clamp(p.l + ((e.clientX - p.x) / b.width) * 200, 8, 100),
                h: clamp(p.h + ((e.clientY - p.y) / b.height) * 200, 6, 100)
              })
            }}
            onPointerUp={(e) => {
              if (!poigne.current) return
              poigne.current = null
              e.currentTarget.releasePointerCapture(e.pointerId)
              onSize?.(taille.l, taille.h)
            }}
          />
        ) : null}
      </div>
    </div>
  )
}

function Jauge({
  j,
  icone,
  classe,
  titre,
  onAjuster
}: {
  j: JaugeVue
  icone: JSX.Element
  classe: string
  titre: string
  onAjuster?: (delta: number) => void
}): JSX.Element {
  const part = j.max ? Math.max(0, Math.min(1, j.value / j.max)) * 100 : 0
  return (
    <span className={`ejauge ${classe}`} title={titre}>
      <span className="ico">{icone}</span>
      <span className="barre" style={{ ['--part' as string]: `${part}%` }} />
      <span className="chiffres">
        {j.value}
        <i>/{j.max}</i>
      </span>
      {onAjuster ? (
        <span className="pas">
          <button onClick={() => onAjuster(-1)} aria-label={`Retirer 1 à ${j.label}`}>
            −
          </button>
          <button onClick={() => onAjuster(1)} aria-label={`Ajouter 1 à ${j.label}`}>
            +
          </button>
        </span>
      ) : null}
    </span>
  )
}

/* ============================================================
   Pions et pointeur
   ============================================================ */

/**
 * Ce que le pion dit quand on s'arrête dessus. C'est le seul endroit où les
 * gestes s'apprennent : il n'y a ni poignée ni barre d'outils sur la scène.
 */
function aideDuPion(p: Pion, etat: EtatPion | null, live: boolean, suivi = false): string {
  const lignes = [p.label]
  if (etat) lignes.push(etat === 'ko' ? 'À terre' : 'Blessé')
  if (p.cache) lignes.push('Caché — les joueurs ne le voient pas')
  if (suivi) lignes.push('L’écran le suit — agrandis, l’image restera sur lui')
  if (live) lignes.push('Molette : tourner · clic droit : calque, cachette')
  return lignes.join('\n')
}

/**
 * Le texte d'une case, ajusté pour tenir dedans.
 *
 * `corpsDeCase()` donne le bon ordre de grandeur — trois mots sont un titre,
 * trente lignes sont une lettre — mais il ne connaît pas la case : dans la
 * colonne étroite d'un « 3 à gauche », « Elle ne dort plus » débordait par le
 * bas. On mesure donc, et on réduit jusqu'à ce que ça entre, exactement comme
 * l'encart des joueurs et le cadre des annotations : **quand la résolution
 * d'une unité dépend du contexte, on mesure et on calcule.**
 *
 * Le corps reste exprimé en `em` de la diapositive : le résultat est donc le
 * même aux trois échelles — moniteur, grande prévisualisation, écran joueurs.
 */
function CaseTexte({ texte, color }: { texte: string; color?: string }): JSX.Element {
  const box = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = box.current
    const sp = el?.firstElementChild as HTMLElement | null
    if (!el || !sp) return

    const ajuste = (): void => {
      const st = getComputedStyle(el)
      const h = el.clientHeight - parseFloat(st.paddingTop) - parseFloat(st.paddingBottom)
      const l = el.clientWidth - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight)
      if (h <= 0 || l <= 0) return
      let c = corpsDeCase(texte)
      el.style.fontSize = `${c}em`
      /* On réduit par petits pas plutôt que de résoudre : le texte se replie à
         chaque essai, et la hauteur d'un paragraphe replié ne se calcule pas.
         Le garde-fou n'est pas décoratif — une case de zéro pixel de haut
         tournerait sans fin. */
      for (let n = 0; n < 60 && c > 0.5; n++) {
        if (sp.offsetHeight <= h && sp.offsetWidth <= l) break
        c *= 0.93
        el.style.fontSize = `${c}em`
      }
    }

    ajuste()
    /* La case change de taille quand les panneaux bougent, et d'une fenêtre à
       l'autre : on remesure au lieu de garder un chiffre qui a vieilli. */
    const ro = new ResizeObserver(ajuste)
    ro.observe(el)
    return () => ro.disconnect()
  }, [texte])

  return (
    <div ref={box} className="cell-texte" style={{ color: color ?? '#f2ece0' }}>
      <span>{texte}</span>
    </div>
  )
}

/* ============================================================
   Le temps qu'il fait
   ============================================================ */

function titreDeCase(c: CollageCell | null): string {
  if (!c) return 'Case vide — clique pour la viser, ou écris-y un texte'
  return c.kind === 'texte' ? c.texte || 'Case de texte' : c.title
}

function PionLayer({
  repere,
  pions,
  pionSize,
  focusPionId,
  pionLabels,
  pionPv,
  joueurs,
  pointer,
  live,
  onRemovePion,
  onRotatePion,
  onPionMenu
}: Required<Pick<SlideExtras, 'pions' | 'pionSize' | 'pionLabels' | 'pionPv' | 'joueurs'>> & {
  /**
   * Le repère de l'image, quand il y en a une.
   *
   * Sans lui — un collage, une carte à lire —, les pions se posent sur l'écran
   * comme avant. Avec lui, ils sont **accrochés à la carte** : on recadre, on
   * agrandit, ils suivent et grossissent avec elle.
   */
  repere: Repere | null
  /**
   * Le pion que l'écran suit. On le marque d'un viseur — mais chez le MJ
   * seulement : à la table, une caméra qui se voit n'est plus une caméra.
   * Et sans ce viseur, prendre un pion en filature au cadrage neutre ne
   * ferait rien voir du tout : il n'y a pas encore de quoi se décaler.
   */
  focusPionId: number | null
  pointer: Pointer | null
  /** Côté MJ : les pions se saisissent et portent leur croix. */
  live: boolean
  onRemovePion?: (id: number) => void
  onRotatePion?: (id: number, deg: number) => void
  onPionMenu?: (pion: Pion, x: number, y: number) => void
}): JSX.Element {
  const box = useRef<HTMLDivElement>(null)

  /**
   * La molette sur un pion le fait tourner ; ailleurs, elle agrandit l'image,
   * comme avant. L'écouteur est posé à la main, en non passif : celui de React
   * est passif, et un écouteur passif ne peut pas retenir le zoom de l'image
   * qui se trouve dessous. Un seul écouteur pour tout le calque, et le pion
   * visé se retrouve par `data-pion` — on ne va pas en poser un par jeton.
   */
  useEffect(() => {
    const el = box.current
    if (!el || !onRotatePion) return
    const h = (e: WheelEvent): void => {
      const cible = (e.target as HTMLElement | null)?.closest('[data-pion]')
      if (!cible) return
      const p = pions.find((x) => String(x.id) === cible.getAttribute('data-pion'))
      if (!p) return
      e.preventDefault()
      e.stopPropagation()
      // Douze crans pour un tour ; au doigt fin avec Maj.
      const pas = (e.shiftKey ? 5 : 30) * (e.deltaY < 0 ? -1 : 1)
      onRotatePion(p.id, p.rotation + pas)
    }
    el.addEventListener('wheel', h, { passive: false })
    return () => el.removeEventListener('wheel', h)
  }, [pions, onRotatePion])

  return (
    <div
      ref={box}
      className={`pion-layer${live ? ' live' : ''}${pionLabels ? ' avec-noms' : ''}`}
      /* `--pz` porte l'agrandissement : un pion grossit comme la carte. */
      style={{ ['--ps' as string]: pionSize, ['--pz' as string]: repere?.zoom ?? 1 }}
    >
      {[...pions]
        .sort((a, b) => a.ord - b.ord || a.id - b.id)
        .map((p) => {
        const j = p.characterId != null ? joueurs.find((x) => x.id === p.characterId) : undefined
        /* L'état se lit sur le pion même quand les PV sont cachés : on veut voir
           d'un coup d'œil qui tient debout, sans compter les points. */
        const etat = etatDeVie(j?.pv)
        return (
        <div
          key={p.id}
          data-pion={p.id}
          /* Un pion d'objet est un meuble : on le tourne pour de vrai. Un
             personnage, lui, ne se penche pas — c'est son nez qui dit où il
             regarde, et son visage reste droit. */
          className={`pion c-${p.color}${etat ? ` ${etat}` : ''}${p.cache ? ' embusque' : ''}${
            p.itemId != null ? ' objet' : ''
          }${p.id === focusPionId ? ' suivi' : ''}`}
          style={(() => {
            const q = repere ? repere.pionVersEcran(p.x, p.y) : { x: p.x, y: p.y }
            return {
              left: `${q.x * 100}%`,
              top: `${q.y * 100}%`,
              /* Le jeton tourne avec l'image : une carte couchée d'un quart de
                 tour ne fait pas regarder les pions ailleurs. */
              ['--rot' as string]: `${p.rotation + (repere?.rot ?? 0)}deg`
            }
          })()}
          draggable={live}
          onDragStart={(e) => {
            e.dataTransfer.setData('text/pion', String(p.id))
            e.dataTransfer.effectAllowed = 'move'
          }}
          onContextMenu={
            onPionMenu
              ? (e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onPionMenu(p, e.clientX, e.clientY)
                }
              : undefined
          }
          title={aideDuPion(p, etat, live, p.id === focusPionId)}
        >
          {/* Un cercle à part, et non `::before` : la blessure et la mise à
              terre tiennent déjà les deux pseudo-éléments du jeton. */}
          {p.id === focusPionId ? <span className="viseur" /> : null}
          {p.url ? (
            <img src={p.url} alt="" draggable={false} />
          ) : (
            <span className="ini">{p.initials}</span>
          )}
          {p.rotation && p.itemId == null ? <span className="nez" /> : null}
          {pionLabels ? <span className="lab">{p.label}</span> : null}
          {pionPv && j?.pv ? (
            <span className="pv" title={j.pv.label}>
              {j.pv.value}
              <i>/{j.pv.max}</i>
            </span>
          ) : null}
          {onRemovePion ? (
            <button
              className="kill"
              title="Retirer ce pion"
              onClick={(e) => {
                e.stopPropagation()
                onRemovePion(p.id)
              }}
            >
              ×
            </button>
          ) : null}
        </div>
        )
      })}
      {pointer ? (
        <span className="laser" style={{ left: `${pointer.x * 100}%`, top: `${pointer.y * 100}%` }} />
      ) : null}
    </div>
  )
}
