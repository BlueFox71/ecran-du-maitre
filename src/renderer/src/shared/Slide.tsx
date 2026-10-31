import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { COLLAGE_CELLS, FRAME_NEUTRE, corpsDeCase, etatDeVie } from '@shared/types'
import { Brouillard, regardsDes, sousUnRegard } from './Brouillard'
import { Visage } from './Visage'
import { usePionsLisses } from './pionsLisses'
import { barrieres, pasContraint, type Pt } from '@shared/murs'
import { bordsOuverture } from '@shared/ouvertures'
import type { Surbrillance } from '../mj/components/Tableau'
import type {
  CalqueBrouillard,
  CollageCell,
  Encart,
  EtatPion,
  FenetreImage,
  Frame,
  JaugeVue,
  JoueurVu,
  Pion,
  Pointer,
  SlidePayload,
  TextOverlay
} from '@shared/types'
import { urlPortraitMj } from './avatarsMj'
import { modificateur, signe } from '@shared/jet'

/**
 * De l'écran à la carte, et retour.
 *
 * Les pions sont posés en fractions de l'écran, les murs en fractions de
 * l'image : tout ce qui doit mettre les deux en présence — l'ombre, une
 * cloison qui retient un pion — passe par là.
 */

/** Ce que la scène du MJ montre de son calque : chaque case de « Affichage ». */
export interface TraitsMj {
  lampes: boolean
  /** Le nom de chaque pièce, écrit sur le plan à son point d'ancrage. */
  pieces: boolean
  astre: boolean
  portes: boolean
  fenetres: boolean
  murs: boolean
  /** Les sons posés sur le plan, et où ils en sont. */
  sons: boolean
  /** Les objets posés en un point du plan, cachés ou trouvés. */
  objets: boolean
  /** Ce qui peut arriver, posé sur le plan : chaque sorte a sa case. */
  decouvertes: boolean
  declencheurs: boolean
  scenarios: boolean
}

/** Une découverte, un déclencheur ou un scénario posé sur le plan, pour le MJ seul. */
export interface ArticleSurCarte {
  cle: string
  x: number
  y: number
  genre: 'decouverte' | 'declencheur' | 'scenario'
  /** Le numéro d'un scénario dans sa fiche. */
  num?: number
  titre: string
  /** Ce qu'il dit : « si… alors… » d'une carte, le texte d'un scénario. */
  si?: string
  alors?: string
  info?: string
  /** Trouvée, déclenché ou joué. */
  fait: boolean
  /** Survolé dans la fiche du lieu : il se montre, et ressort. */
  vise?: boolean
}

const GENRE_ARTICLE: Record<ArticleSurCarte['genre'], string> = {
  decouverte: 'Découverte',
  declencheur: 'Déclencheur',
  scenario: 'Scénario'
}

/**
 * Ce que dit un article survolé sur la carte du MJ : sa sorte, son titre, et
 * son texte entier. Posé dans le document, hors de l'image : l'image tourne
 * et s'agrandit, la bulle doit rester droite et lisible.
 */
function BulleArticle({ a, x, y }: { a: ArticleSurCarte; x: number; y: number }): JSX.Element {
  const etat = a.fait ? (a.genre === 'scenario' ? 'joué' : a.genre === 'decouverte' ? 'trouvée' : 'déclenché') : null
  return createPortal(
    <div className={`bulle-article sorte-${a.genre}`} style={{ left: x, top: y }} role="tooltip">
      <span className="bulle-sorte">
        {GENRE_ARTICLE[a.genre]}
        {a.num ? ` n° ${a.num}` : ''}
        {etat ? ` · ${etat}` : ''}
      </span>
      <b>{a.titre}</b>
      {a.genre === 'scenario' ? (
        a.info ? <p>{a.info}</p> : null
      ) : a.si || a.alors ? (
        <dl>
          <dt>SI</dt>
          <dd>{a.si || '—'}</dd>
          <dt>ALORS</dt>
          <dd>{a.alors || '—'}</dd>
        </dl>
      ) : null}
    </div>,
    document.body
  )
}

/** Un objet posé sur le plan, en fractions de la carte, pour le MJ seul. */
export interface ObjetSurCarte {
  id: number
  x: number
  y: number
  nom: string
  etat: 'cache' | 'trouve' | 'porte'
  /** Survolé dans la fiche du lieu : il se montre, et ressort. */
  vise?: boolean
}

/** Un son posé, tel que la scène du MJ le dessine. */
export interface SonSurCarte {
  id: number
  /** En fractions de la carte ; le rayon, en part de sa largeur. */
  x: number
  y: number
  rayon: number
  nom: string
  emoji: string
  nature: 'ambiance' | 'nappe' | 'bruitage'
  etat: 'arme' | 'fait' | 'attente' | 'ecoute'
  /** Une source : son volume du moment, de 0 à 1. */
  gain: number | null
  /** Survolé au Paravent : il s'allume, même si la case « Sons » est décochée. */
  vise?: boolean
}

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
  /** La taille naturelle de l'image : celle où vivent les murs et les regards. */
  nat: { w: number; h: number }
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
  /**
   * Le pion de celui qui joue, pendant les tours : il porte un halo doré qui
   * bat, chez le MJ comme chez les joueurs.
   */
  pionEnJeuId?: number | null
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
  /** Côté MJ : le clic gauche sur un pion le choisit — son détail s'ouvre. */
  onPionClic?: (pion: Pion) => void
  /** Le pion choisi, cerclé chez le MJ seul. */
  pionChoisiId?: number | null
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
  /** Côté MJ : un clic sur l'encart, sans le déplacer, ouvre son menu (sens, recentrer). */
  onMenuEncart?: (x: number, y: number) => void
  /** Fourni côté MJ : la poignée du coin règle ses dimensions. */
  onSizeEncart?: (largeur: number, hauteur: number) => void
  /** Fourni côté MJ : les jauges s'ajustent d'un clic depuis l'encart. */
  onAjuster?: (characterId: number, key: string, delta: number) => void
  /** Les images en fenêtre par-dessus le direct, la dernière au premier plan. */
  fenetres?: FenetreImage[] | null
  /** Fourni côté MJ : une fenêtre se déplace, se retaille et passe devant à la souris. */
  onFenetre?: (
    itemId: number,
    patch: { x?: number; y?: number; largeur?: number; devant?: boolean }
  ) => void
  /** Fourni côté MJ : la croix d'une fenêtre la ferme. */
  onFermerFenetre?: (itemId: number) => void
  /** Case du collage que la prochaine image viendra remplir. */
  activeCell?: number
  onPickCell?: (index: number) => void
  /** Fourni côté MJ : la molette agrandit, le glisser recadre. */
  onFrame?: (cell: number | null, frame: Frame) => void
  /** Fourni côté MJ : les textes posés sur l'écran se déplacent à la souris. */
  onMoveText?: (id: number, x: number, y: number) => void
  /**
   * Fourni côté MJ, quand un outil est armé (poser une lumière) : un clic sur
   * l'image rend le point visé **en fractions de la carte** — le repère des
   * murs et des lampes —, et rien d'autre ne reçoit ce clic.
   */
  onPoserSurCarte?: (x: number, y: number) => void
  /**
   * Côté MJ : l'icône de **toutes** les lumières du calque. Sans cela — chez
   * les joueurs —, seules celles que le MJ a choisi de montrer.
   */
  lumieresMJ?: boolean
  /**
   * Côté MJ : ce que la carte montre de son calque, case par case (bouton
   * « Affichage » du Paravent). Absent : rien de plus que les lampes.
   */
  traitsMj?: TraitsMj | null
  /** Plein jour : la table voit toute la carte — un pion « au regard » se montre. */
  jour?: boolean
  /** Côté MJ : les pièces du plan à l'écran, nommées, en fractions de la carte. */
  nomsPieces?: { nom: string; x: number; y: number }[]
  /** Côté MJ : les sons posés sur le plan à l'écran. */
  sonsMj?: SonSurCarte[]
  /** Côté MJ : les objets posés sur le plan à l'écran. */
  objetsMj?: ObjetSurCarte[]
  /** Côté MJ : ce qui peut arriver, posé sur le plan à l'écran. */
  articlesMj?: ArticleSurCarte[]
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
  pions: pionsRecus,
  pionSize = 6,
  focusPionId,
  onDefocus,
  pionEnJeuId,
  pionLabels = true,
  pionPv = false,
  joueurs,
  encart,
  onMoveEncart,
  onMenuEncart,
  onSizeEncart,
  onAjuster,
  fenetres,
  onFenetre,
  onFermerFenetre,
  pointer,
  onDropAt,
  onRemovePion,
  onRotatePion,
  onPionMenu,
  onPionClic,
  pionChoisiId,
  activeCell,
  onPickCell,
  onFrame,
  onMoveText,
  activeText,
  onPickText,
  onPoserSurCarte,
  lumieresMJ,
  traitsMj,
  nomsPieces,
  sonsMj,
  objetsMj,
  articlesMj,
  jour
}: { slide: SlidePayload; animate?: boolean } & SlideExtras): JSX.Element {
  /* Les pions arrivent par crans (vingt par seconde quand on marche) : on
     dessine les positions glissées, sur lesquelles se calent aussi la caméra
     qui suit et l'ombre des murs. Voir pionsLisses.ts. */
  const pions = usePionsLisses(pionsRecus)
  const cls = `slide sl-${slide.type}${animate ? ' slide-fade' : ''}${
    onPoserSurCarte ? ' pose-point' : ''
  }`
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

  /* Un outil armé prend le clic avant tout le reste — pions, textes, cases. */
  const hostProps = {
    ...dropProps,
    ...(onPoserSurCarte
      ? {
          onClickCapture: (e: React.MouseEvent) => {
            if (!repere) return
            const b = (e.currentTarget as HTMLElement).getBoundingClientRect()
            const p = repere.versCarte((e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height)
            e.stopPropagation()
            e.preventDefault()
            if (p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) return
            onPoserSurCarte(p.x, p.y)
          }
        }
      : {})
  }

  /*
   * L'encart des joueurs se pose sur tout, y compris le voile noir : il dit
   * l'état du groupe, et cet état ne dépend pas de ce qu'on montre.
   */
  const encartJoueurs =
    encart?.on && joueurs?.length ? (
      <EncartJoueurs
        encart={encart}
        joueurs={joueurs}
        onMove={onMoveEncart}
        onMenu={onMenuEncart}
        onSize={onSizeEncart}
        onAjuster={onAjuster}
      />
    ) : null
  /* La fenêtre d'image se pose, comme l'encart, par-dessus tout ce qu'on
     montre — juste sous l'encart, qui reste lisible quoi qu'il arrive. */
  /* Les lumières, en icône sur l'image : toutes pour le MJ, qui doit savoir
     où sont ses lampes ; chez les joueurs, seulement celles qu'il leur montre.
     Elles vivent dans la carte et suivent son cadrage, comme les murs. */
  const lampes =
    repere && brouillard && (slide.type === 'image' || slide.type === 'video')
      ? /* Chez les joueurs, plus aucune icône : la lueur leur suffit. */
        brouillard.lumieres.filter(() => (lumieresMJ ? (traitsMj?.lampes ?? true) : false))
      : []
  const iconesLumieres = lampes.length ? (
    <div className="lampes-zone" aria-hidden="true">
      {lampes.map((l) => {
        const q = repere!.versEcran({ x: l.x, y: l.y })
        return (
          <span
            key={l.id}
            className={`lampe-icone${l.allumee ? '' : ' eteinte'}`}
            style={{ left: `${q.x * 100}%`, top: `${q.y * 100}%` }}
          >
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="4.2" />
              <path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />
            </svg>
          </span>
        )
      })}
    </div>
  ) : null

  const bandeau = (
    <>
      {iconesLumieres}
      {(fenetres ?? []).map((f, i, toutes) => (
        <FenetreSurEcran
          key={f.itemId}
          fenetre={f}
          devant={i === toutes.length - 1}
          onRegler={onFenetre ? (patch) => onFenetre(f.itemId, patch) : undefined}
          onFermer={onFermerFenetre ? () => onFermerFenetre(f.itemId) : undefined}
        />
      ))}
      {encartJoueurs}
    </>
  )

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
    .filter((p) => p.characterId != null && !p.pnj)
    .map((p) => ({ x: p.x, y: p.y, cap: p.rotation, characterId: p.characterId as number }))

  /*
   * Le pion que l'image suit, réduit à ce dont la géométrie a besoin : deux
   * nombres. S'il n'est plus là — retiré, caché, resté dans l'autre lieu —,
   * l'image reprend son cadrage sans qu'on ait rien à défaire.
   */
  /*
   * Les pions « au regard » : chez les joueurs — et sur le moniteur, qui dit ce
   * qu'ils voient —, on ne les dessine que si un joueur les a dans son champ
   * de vision. Sur la scène du MJ (`onDropAt`), ils restent, en retrait.
   */
  /* Ceux qu'aucun joueur ne voit en ce moment. Chez le MJ, ils restent sur sa
     scène mais s'assombrissent ; chez les joueurs, ils ne sont pas dessinés. */
  const horsDeVue = ((): Set<number> => {
    const auRegard = (pions ?? []).filter((p) => p.regard && !p.cache)
    if (!auRegard.length || jour) return new Set()
    if (!brouillard || !repere) return new Set(auRegard.map((p) => p.id))
    const { w, h } = repere.nat
    const regards = regardsDes(
      brouillard,
      yeux.map((o) => ({ ...o, ...repere.pionVersCarte(o.x, o.y) })),
      w,
      h
    )
    return new Set(
      auRegard
        .filter((p) => {
          const c = repere.pionVersCarte(p.x, p.y)
          return !sousUnRegard(regards, c.x * w, c.y * h)
        })
        .map((p) => p.id)
    )
  })()
  const pionsVus = onDropAt ? (pions ?? []) : (pions ?? []).filter((p) => !horsDeVue.has(p.id))

  const suivi = focusPionId != null ? (pions ?? []).find((p) => p.id === focusPionId) : undefined
  const focus = suivi ? { x: suivi.x, y: suivi.y } : null

  const layer =
    visual && ((pions && pions.length) || pointer || onDropAt) ? (
      <PionLayer
        repere={repere}
        pions={pionsVus}
        horsDeVue={onDropAt ? horsDeVue : undefined}
        pionSize={pionSize}
        focusPionId={focusPionId ?? null}
        pionEnJeuId={pionEnJeuId ?? null}
        pionLabels={pionLabels}
        pionPv={pionPv}
        joueurs={joueurs ?? []}
        pointer={pointer ?? null}
        live={!!onDropAt}
        onRemovePion={onRemovePion}
        onRotatePion={onRotatePion}
        onPionMenu={onPionMenu}
        onPionClic={onPionClic}
        pionChoisiId={pionChoisiId ?? null}
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
      <div className={cls} key="black" {...hostProps}>
        <div className="sigil" />
        <div className="w">écran joueurs</div>
        {texte}
        {bandeau}
      </div>
    )
  }

  if (slide.type === 'image') {
    return (
      <div className={cls} key={`img-${slide.itemId}`} {...hostProps}>
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
            traitsMj={traitsMj}
            nomsPieces={nomsPieces}
            sonsMj={sonsMj}
            objetsMj={objetsMj}
            articlesMj={articlesMj}
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
      <div className={cls} key={`vid-${slide.itemId}`} {...hostProps}>
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
      <div className={`${cls} lay-${slide.layout}`} key={`col-${slide.layout}`} {...hostProps}>
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
                  traitsMj={cases.length === 1 ? traitsMj : undefined}
                  nomsPieces={cases.length === 1 ? nomsPieces : undefined}
                  sonsMj={cases.length === 1 ? sonsMj : undefined}
                  objetsMj={cases.length === 1 ? objetsMj : undefined}
                  articlesMj={cases.length === 1 ? articlesMj : undefined}
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

  if (slide.type === 'presentation') {
    return (
      <div className={cls} key={`pres-${slide.characterId}`}>
        <Presentation p={slide} />
        {texte}
        {bandeau}
      </div>
    )
  }

  if (slide.type === 'attente') {
    return (
      <div className={cls} key="attente">
        <Attente p={slide} />
        {texte}
        {bandeau}
      </div>
    )
  }

  if (slide.type === 'preparation') {
    return (
      <div className={cls} key="preparation">
        <Repartition p={slide} />
        {texte}
        {bandeau}
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
   Un joueur présenté à la table
   ============================================================ */

/** Un tirage qui ne change pas d'un écran à l'autre : le moniteur montre la même gerbe. */
function tirage(graine: number): () => number {
  let a = graine * 2654435761
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Le portrait entre, le nom suit, et les émojis du personnage jaillissent de
 * derrière lui — une gerbe d'abord, puis une montée lente qui ne s'arrête pas
 * tant que l'écran reste là. Tout est en unités du cadre : la même image dans
 * le moniteur et chez les joueurs.
 */
function Presentation({ p }: { p: Extract<SlidePayload, { type: 'presentation' }> }): JSX.Element {
  const emojis = p.emojis.length ? p.emojis : ['✨']
  const { gerbe, montee } = useMemo(() => {
    const r = tirage(p.characterId + 1)
    const gerbe = Array.from({ length: 28 }, (_, i) => {
      const angle = r() * Math.PI * 2
      const loin = 34 + r() * 30
      return {
        e: emojis[i % emojis.length],
        style: {
          '--dx': `${Math.cos(angle) * loin * 1.5}cqh`,
          '--dy': `${Math.sin(angle) * loin}cqh`,
          '--rot': `${(r() - 0.5) * 140}deg`,
          '--t': `${5 + r() * 5}cqh`,
          animationDelay: `${0.25 + r() * 0.7}s`,
          animationDuration: `${1.6 + r() * 1.2}s`
        } as React.CSSProperties
      }
    })
    const montee = Array.from({ length: 22 }, (_, i) => ({
      e: emojis[(i * 3 + 1) % emojis.length],
      style: {
        left: `${3 + r() * 94}%`,
        '--t': `${3.5 + r() * 5}cqh`,
        '--sway': `${(r() - 0.5) * 16}cqh`,
        '--rot': `${(r() - 0.5) * 60}deg`,
        animationDelay: `${1.4 + r() * 9}s`,
        animationDuration: `${7 + r() * 6}s`
      } as React.CSSProperties
    }))
    return { gerbe, montee }
  }, [p.characterId, emojis.join('')])

  return (
    <div className={`pres${p.color ? ` c-${p.color}` : ''}`}>
      <div className="pres-montee" aria-hidden>
        {montee.map((m, i) => (
          <span key={i} style={m.style}>
            {m.e}
          </span>
        ))}
      </div>
      <div className="pres-scene">
        <div className="pres-portrait">
          <div className="pres-gerbe" aria-hidden>
            {gerbe.map((g, i) => (
              <span key={i} style={g.style}>
                {g.e}
              </span>
            ))}
          </div>
          <div className="pres-cadre">
            {p.url ? (
              <img src={p.url} alt={p.name} draggable={false} />
            ) : (
              <span className="pres-init">{initialesDe(p.name)}</span>
            )}
          </div>
        </div>
        <div className="pres-texte">
          <div className="pres-kicker">Entre en scène</div>
          <div className="pres-nom">{p.name}</div>
          {p.occupation ? <div className="pres-occ">{p.occupation}</div> : null}
          {p.player ? <div className="pres-joueur">joué par {p.player}</div> : null}
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   La préparation des personnages
   ============================================================ */

/**
 * Qui met ses points où, pendant que chacun prépare son personnage : une
 * ligne par caractéristique, une colonne par personnage. Le plus fort de
 * chaque ligne prend la couleur de son joueur ; une ligne où personne ne
 * dépasse 11 le dit — c'est là que la table a un trou.
 */
function Repartition({ p }: { p: Extract<SlidePayload, { type: 'preparation' }> }): JSX.Element {
  const prets = p.persos.filter((x) => x.valide).length
  const [bas, haut] = p.bornes
  const part = (v: number): number => Math.max(0, Math.min(1, (v - bas) / Math.max(1, haut - bas)))
  return (
    <div className="rep" style={{ '--n': p.persos.length } as React.CSSProperties}>
      <div className="rep-tete">
        <div>
          <div className="rep-kicker">Avant la séance</div>
          <div className="rep-titre">Qui fait quoi dans l’équipe&nbsp;?</div>
        </div>
        <div className="rep-compte">
          {prets} personnage{prets > 1 ? 's' : ''} sur {p.persos.length} prêt{prets > 1 ? 's' : ''}
        </div>
      </div>
      <div className="rep-grille">
        <div className="rep-coin" />
        {p.persos.map((x) => (
          <div key={x.id} className="rep-perso">
            <span className="rep-nom">
              <i style={{ background: x.couleur }} />
              {x.nom}
            </span>
            {x.joueur ? <span className="rep-joueur">{x.joueur}</span> : null}
            <span className={`rep-etat${x.valide ? ' ok' : ''}`}>
              {x.valide ? '✓ prêt' : `${x.reste} point${x.reste > 1 ? 's' : ''} à poser`}
            </span>
          </div>
        ))}
        {p.caracs.map((c, i) => {
          const vals = p.persos.map((x) => x.stats[c.key] ?? 0)
          const max = Math.max(...vals, 0)
          const trou = p.persos.length > 0 && max <= 11
          return (
            <Fragment key={c.key}>
              <div className={`rep-carac${i % 2 ? ' pair' : ''}${trou ? ' trou' : ''}`}>
                <b>{c.code}</b>
                {c.nom !== c.code ? <span>{c.nom}</span> : null}
                {trou ? <em>personne n’y brille</em> : null}
              </div>
              {p.persos.map((x) => {
                const v = x.stats[c.key] ?? 0
                const m = modificateur(v)
                const fort = v === max && v >= 13
                return (
                  <div
                    key={x.id}
                    className={`rep-case${i % 2 ? ' pair' : ''}${fort ? ' fort' : ''}`}
                    style={{ '--c': x.couleur } as React.CSSProperties}
                  >
                    <span className="rep-barre">
                      <i style={{ width: `${part(v) * 100}%` }} />
                    </span>
                    <b>{v}</b>
                    <span className={`rep-mod${m > 0 ? ' plus' : m < 0 ? ' moins' : ''}`}>{signe(m)}</span>
                  </div>
                )
              })}
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}

/* ============================================================
   Ça commence bientôt
   ============================================================ */

/** « 4:07 », « 1:02:30 » : le temps qui reste, à la seconde. */
function compte(ms: number): string {
  const t = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const sec = String(t % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

/**
 * L'écran d'avant la partie. Un ciel de nuit où dérivent trois lueurs, une
 * poussière qui scintille, les émojis qui montent ; au centre le titre, que
 * traverse un reflet, et le compte à rebours dans son anneau qui se vide.
 * En bas, ceux qu'on attend, qui flottent chacun à son rythme.
 */
function Attente({ p }: { p: Extract<SlidePayload, { type: 'attente' }> }): JSX.Element {
  const [maintenant, setMaintenant] = useState(() => Date.now())
  useEffect(() => {
    if (p.fin == null) return
    const t = setInterval(() => setMaintenant(Date.now()), 250)
    return () => clearInterval(t)
  }, [p.fin])

  const emojis = p.emojis.length ? p.emojis : ['✨']
  const { poussiere, montee } = useMemo(() => {
    const r = tirage(7)
    const poussiere = Array.from({ length: 46 }, () => ({
      left: `${r() * 100}%`,
      top: `${r() * 100}%`,
      '--t': `${0.25 + r() * 0.5}cqh`,
      animationDelay: `${-r() * 6}s`,
      animationDuration: `${3 + r() * 5}s`
    })) as React.CSSProperties[]
    const montee = Array.from({ length: 18 }, (_, i) => ({
      e: emojis[i % emojis.length],
      style: {
        left: `${2 + r() * 96}%`,
        '--t': `${3 + r() * 4.5}cqh`,
        '--sway': `${(r() - 0.5) * 18}cqh`,
        '--rot': `${(r() - 0.5) * 70}deg`,
        animationDelay: `${-r() * 14}s`,
        animationDuration: `${10 + r() * 8}s`
      } as React.CSSProperties
    }))
    return { poussiere, montee }
  }, [emojis.join('')])

  const reste = p.fin != null ? p.fin - maintenant : null
  const total = p.fin != null ? Math.max(1, p.fin - p.debut) : 1
  const part = reste != null ? Math.max(0, Math.min(1, reste / total)) : 0
  const fini = reste != null && reste <= 0
  /* L'anneau : un cercle de rayon 45 dans une boîte de 100. */
  const tour = 2 * Math.PI * 45

  return (
    <div
      className="att"
      style={
        p.lueurs
          ? ({ '--l1': p.lueurs[0], '--l2': p.lueurs[1], '--l3': p.lueurs[2] } as React.CSSProperties)
          : undefined
      }
    >
      <div className="att-lueur l1" />
      <div className="att-lueur l2" />
      <div className="att-lueur l3" />
      <div className="att-poussiere" aria-hidden>
        {poussiere.map((st, i) => (
          <i key={i} style={st} />
        ))}
      </div>
      <div className="pres-montee att-montee" aria-hidden>
        {montee.map((m, i) => (
          <span key={i} style={m.style}>
            {m.e}
          </span>
        ))}
      </div>

      <div className="att-centre">
        {p.sousTitre ? <div className="att-sous">{p.sousTitre}</div> : null}
        <div className="att-titre">
          {p.titre}
          {p.fin == null ? (
            <span className="att-points" aria-hidden>
              <i>.</i>
              <i>.</i>
              <i>.</i>
            </span>
          ) : null}
        </div>
        {reste != null ? (
          <div className={`att-compte${fini ? ' fini' : ''}`}>
            <svg viewBox="0 0 100 100" aria-hidden>
              <circle className="fond" cx="50" cy="50" r="45" />
              <circle
                className="reste"
                cx="50"
                cy="50"
                r="45"
                strokeDasharray={tour}
                strokeDashoffset={tour * (1 - part)}
              />
            </svg>
            <span className="att-chiffres">{fini ? 'C’est l’heure !' : compte(reste)}</span>
          </div>
        ) : null}
      </div>

      {p.joueurs.length ? (
        <div className="att-table">
          {/* Le MJ au-dessus, ceux qu'il attend en rangée dessous. */}
          {p.joueurs
            .filter((j) => j.mj)
            .map((j) => (
              <div key="mj" className="att-joueur mj c-brass" style={{ animationDelay: '0.2s, 0s' }}>
                <div className="att-face">
                  {urlPortraitMj(j.url) ? (
                    <Visage url={urlPortraitMj(j.url)!} cadre={j.cadre} alt={j.name} />
                  ) : (
                    <b>🎲</b>
                  )}
                </div>
                <div className="att-nom">{j.name}</div>
                {j.player ? <div className="att-qui">{j.player}</div> : null}
              </div>
            ))}
          {p.joueurs.some((j) => !j.mj) ? <div className="att-table-dit">Autour de la table</div> : null}
          <div className="att-joueurs">
            {p.joueurs.filter((j) => !j.mj).map((j, i) => (
              <div
                key={j.id}
                className={`att-joueur${j.color ? ` c-${j.color}` : ''}`}
                style={{ animationDelay: `${0.3 + i * 0.15}s, ${-i * 0.7}s` }}
              >
                <div className="att-face">
                  {j.url ? (
                    <Visage url={j.url} cadre={j.cadre} alt={j.name} />
                  ) : (
                    <b>{initialesDe(j.name)}</b>
                  )}
                </div>
                <div className="att-nom">{j.name}</div>
                {j.player ? <div className="att-qui">{j.player}</div> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

const initialesDe = (nom: string): string =>
  nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

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
  traitsMj,
  nomsPieces,
  sonsMj,
  objetsMj,
  articlesMj,
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
  /** Les traits du calque montrés au MJ : murs, portes, fenêtres, astre. */
  traitsMj?: TraitsMj | null
  /** Les pièces nommées, pour écrire leur nom sur le plan. */
  nomsPieces?: { nom: string; x: number; y: number }[]
  /** Les sons posés, dessinés pour le MJ seul. */
  sonsMj?: SonSurCarte[]
  /** Les objets posés, dessinés pour le MJ seul. */
  objetsMj?: ObjetSurCarte[]
  /** Ce qui peut arriver, posé sur le plan, dessiné pour le MJ seul. */
  articlesMj?: ArticleSurCarte[]
  /** L'image publie son repère : c'est par là qu'on passe de l'écran à la carte. */
  onRepere?: (r: Repere | null) => void
}): JSX.Element {
  const box = useRef<HTMLDivElement>(null)
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null)
  /* L'article survolé sur la carte du MJ, et où poser sa bulle — à l'écran. */
  const [survolArticle, setSurvolArticle] = useState<{ a: ArticleSurCarte; x: number; y: number } | null>(null)
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
      nat,
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
        /* Un trait seul se perdait sur un plan chargé : on l'épaissit, et un
           anneau bat autour de la porte pour qu'on la trouve d'un coup d'œil. */
        const cx = ((b.a[0] + b.b[0]) / 2) * w
        const cy = ((b.a[1] + b.b[1]) / 2) * h
        const long = Math.hypot((b.b[0] - b.a[0]) * w, (b.b[1] - b.a[1]) * h)
        dessin = (
          <>
            <circle className="halo-cible" cx={cx} cy={cy} r={Math.max(long * 0.9, w * 0.028)} />
            <line
              className="halo-porte fort"
              x1={b.a[0] * w}
              y1={b.a[1] * h}
              x2={b.b[0] * w}
              y2={b.b[1] * h}
              strokeWidth={Math.max(10, w * 0.016)}
            />
          </>
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

  /*
   * Le calque, dessiné pour le MJ seul : les murs, les portes et les fenêtres
   * qu'il a tracés, et d'où vient le soleil ou la lune. Ces traits ne passent
   * que par `traitsMj`, que la fenêtre des joueurs ne reçoit jamais.
   */
  const traits = ((): JSX.Element | null => {
    if (!traitsMj || !brouillard || !nat || !repere) return null
    const { murs: voirMurs, portes, fenetres, astre, pieces } = traitsMj
    const noms = pieces ? (nomsPieces ?? []) : []
    const sons = (sonsMj ?? []).filter((z) => traitsMj.sons || z.vise)
    /* Ce qu'on survole dans la fiche se montre toujours, case cochée ou non. */
    const objets = (objetsMj ?? []).filter((o) => traitsMj.objets || o.vise)
    const SORTES = { decouverte: 'decouvertes', declencheur: 'declencheurs', scenario: 'scenarios' } as const
    const articles = (articlesMj ?? []).filter((x) => traitsMj[SORTES[x.genre]] || x.vise)
    if (
      !voirMurs &&
      !portes &&
      !fenetres &&
      !astre &&
      !noms.length &&
      !sons.length &&
      !objets.length &&
      !articles.length
    )
      return null
    const w = nat.w
    const h = nat.h
    const ep = Math.max(2, w * 0.0025)
    const ouvertures = brouillard.ouvertures.filter((o) => (o.nature === 'porte' ? portes : fenetres))
    /* La nuit noire ne vient de nulle part : pas de repère au bord. */
    const a = astre && brouillard.astre?.nature !== 'nuit' ? brouillard.astre : null
    return (
      <div className="brouillard-cadre traits-mj" style={{ ...repere.cadre, transform: repere.transform }}>
        <svg className="brouillard" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
          {voirMurs
            ? brouillard.murs
                .filter((m) => m.pts.length > 1)
                .map((m) => (
                  <polyline
                    key={`m${m.id}`}
                    className={`trait-mur${m.nature === 'rideau' ? ' rideau' : ''}`}
                    points={m.pts.map((p) => `${p[0] * w},${p[1] * h}`).join(' ')}
                    strokeWidth={ep}
                  />
                ))
            : null}
          {ouvertures.map((o) => {
            const mur = brouillard.murs.find((m) => m.id === o.murId)
            if (!mur) return null
            const b = bordsOuverture(mur, o)
            return (
              <line
                key={`o${o.id}`}
                className={`trait-${o.nature === 'porte' ? 'porte' : 'fenetre'}${o.ouverte ? ' ouverte' : ''}${
                  o.verrouillee ? ' verrou' : ''
                }`}
                x1={b.a[0] * w}
                y1={b.a[1] * h}
                x2={b.b[0] * w}
                y2={b.b[1] * h}
                strokeWidth={ep * 2.6}
              />
            )
          })}
          {/* Les sons posés. Au repos, un simple repère : son émoji, sans
              portée ni nom — dix cercles en tirets couvraient la carte
              (Jules, 17 oct.). Le cercle et le nom ne viennent que quand le son
              a quelque chose à dire : survolé, en attente du feu vert, ou
              qu'une source se fait entendre. */}
          {sons.map((z) =>
            !(z.vise || z.etat === 'attente' || (z.gain ?? 0) > 0.02) ? (
              <text
                key={`s${z.id}`}
                className={`trait-son repos ${z.nature} ${z.etat}`}
                x={z.x * w}
                y={z.y * h}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={Math.max(10, w * 0.011)}
                strokeWidth={Math.max(2, w * 0.0025)}
              >
                {z.emoji || '♪'}
              </text>
            ) : (
            <g key={`s${z.id}`} className={`trait-son ${z.nature} ${z.etat}${z.vise ? ' vise' : ''}`}>
              <circle
                cx={z.x * w}
                cy={z.y * h}
                r={z.rayon * w}
                strokeWidth={z.vise ? ep * 2.4 : ep * 0.8}
                strokeDasharray={z.etat === 'fait' ? `${ep * 1.5} ${ep * 3}` : `${ep * 4} ${ep * 3}`}
                style={z.gain != null ? ({ fillOpacity: 0.06 + z.gain * 0.3 } as React.CSSProperties) : undefined}
              />
              <text
                x={z.x * w}
                y={z.y * h}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={Math.max(10, w * 0.013)}
                strokeWidth={Math.max(2, w * 0.003)}
              >
                {z.emoji} {z.nom}
                {z.etat === 'attente' ? ' ✋' : ''}
              </text>
            </g>
            )
          )}
          {/* Les objets posés : un losange, plein trouvé, creux tant qu'il
              attend d'être découvert, et son nom dessous. */}
          {objets.map((o) => {
            const r = Math.max(5, w * 0.006)
            return (
              <g
                key={`b${o.id}`}
                className={`trait-objet ${o.etat}${o.vise ? ' vise' : ''}`}
                transform={`translate(${o.x * w} ${o.y * h})`}
              >
                {o.vise ? <circle className="halo-vise" r={r * 2.6} strokeWidth={ep * 1.2} /> : null}
                <path d={`M0 ${-r}L${r} 0L0 ${r}L${-r} 0Z`} strokeWidth={ep * 0.9} />
                <text
                  y={r * 1.4}
                  textAnchor="middle"
                  dominantBaseline="hanging"
                  fontSize={Math.max(9, w * 0.011)}
                  strokeWidth={Math.max(2, w * 0.003)}
                >
                  {o.nom}
                </text>
              </g>
            )
          })}
          {/* Ce qui peut arriver : une pastille à la marque de sa sorte — la
              loupe, l'éclair, le numéro du scénario —, et son titre dessous.
              Fait, il s'efface sans disparaître. */}
          {articles.map((x) => {
            const r = Math.max(7, w * 0.008)
            return (
              <g
                key={`a${x.cle}`}
                className={`trait-article sorte-${x.genre}${x.fait ? ' fait' : ''}${x.vise ? ' vise' : ''}`}
                transform={`translate(${x.x * w} ${x.y * h})`}
                onMouseEnter={(e) => {
                  const b = e.currentTarget.getBoundingClientRect()
                  setSurvolArticle({ a: x, x: b.left + b.width / 2, y: b.bottom + 6 })
                }}
                onMouseLeave={() => setSurvolArticle(null)}
              >
                {x.vise ? <circle className="halo-vise" r={r * 2.4} strokeWidth={ep * 1.2} /> : null}
                <rect x={-r} y={-r} width={r * 2} height={r * 2} rx={r * 0.35} strokeWidth={ep * 0.8} />
                {/* Les marques de la fiche, tracées et non en émoji : l'émoji
                    change de dessin et de couleur d'un système à l'autre. */}
                {x.genre === 'scenario' ? (
                  <text className="marque" textAnchor="middle" dominantBaseline="central" fontSize={r * 1.1}>
                    {x.num ?? '?'}
                  </text>
                ) : (
                  <g className="marque" transform={`translate(${-r * 0.65} ${-r * 0.65}) scale(${(r * 1.3) / 16})`}>
                    {x.genre === 'decouverte' ? (
                      <>
                        <circle cx="7" cy="7" r="4.5" />
                        <path d="M10.4 10.4 14 14" />
                      </>
                    ) : (
                      <path d="M9.2 1 3 9h4l-1.2 6L13 7H9l.2-6z" />
                    )}
                  </g>
                )}
                <text
                  y={r * 1.35}
                  textAnchor="middle"
                  dominantBaseline="hanging"
                  fontSize={Math.max(9, w * 0.011)}
                  strokeWidth={Math.max(2, w * 0.003)}
                >
                  {x.titre}
                </text>
              </g>
            )
          })}
          {noms.map((p, i) => (
            <text
              key={`n${i}`}
              className="trait-piece"
              x={p.x * w}
              y={p.y * h}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={Math.max(11, w * 0.017)}
              strokeWidth={Math.max(2, w * 0.004)}
            >
              {p.nom}
            </text>
          ))}
          {a
            ? (() => {
                /* Au bord du plan, du côté d'où vient la lumière : on part du
                   centre dans la direction du cap (0 le haut, 90 la droite) et
                   on s'arrête au premier bord touché, moins le rayon. */
                const r = Math.max(10, w * 0.016)
                const dx = Math.sin((a.cap * Math.PI) / 180)
                const dy = -Math.cos((a.cap * Math.PI) / 180)
                const t = Math.min(
                  Math.abs(dx) > 1e-6 ? (w / 2 - r * 1.4) / Math.abs(dx) : Infinity,
                  Math.abs(dy) > 1e-6 ? (h / 2 - r * 1.4) / Math.abs(dy) : Infinity
                )
                return (
            <g
              className={`trait-astre ${a.nature}`}
              transform={`translate(${w / 2 + dx * t} ${h / 2 + dy * t})`}
            >
              <circle r={r} />
              <text textAnchor="middle" dominantBaseline="central" fontSize={Math.max(12, w * 0.02)}>
                {a.nature === 'soleil' ? '☀' : '☾'}
              </text>
            </g>
                )
              })()
            : null}
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
      {traits}
      {/* La case décochée, l'article parti : sa bulle part avec lui. */}
      {survolArticle && traitsMj && articlesMj?.some((a) => a.cle === survolArticle.a.cle) ? (
        <BulleArticle a={survolArticle.a} x={survolArticle.x} y={survolArticle.y} />
      ) : null}
      {halo}
    </div>
  )
}

/* ============================================================
   L'image en fenêtre
   ============================================================ */

/**
 * Une image tendue aux joueurs par-dessus le direct. Côté MJ — quand
 * `onRegler` est fourni —, on la déplace en la tirant, on la retaille par la
 * poignée du coin, et la croix la ferme. On n'enregistre qu'au relâchement,
 * comme l'encart : les joueurs ne la voient pas trembler pendant qu'on la place.
 */
function FenetreSurEcran({
  fenetre,
  devant,
  onRegler,
  onFermer
}: {
  fenetre: FenetreImage
  /** Déjà au premier plan : la prendre ne la fait pas repasser devant. */
  devant: boolean
  onRegler?: (patch: { x?: number; y?: number; largeur?: number; devant?: boolean }) => void
  onFermer?: () => void
}): JSX.Element {
  const [pos, setPos] = useState({ x: fenetre.x, y: fenetre.y })
  const [largeur, setLargeur] = useState(fenetre.largeur)
  const drag = useRef<{ x: number; y: number; from: { x: number; y: number } } | null>(null)
  const poigne = useRef<{ x: number; l: number } | null>(null)
  const bouge = useRef(false)

  useEffect(() => setPos({ x: fenetre.x, y: fenetre.y }), [fenetre.x, fenetre.y])
  useEffect(() => setLargeur(fenetre.largeur), [fenetre.largeur])

  const mj = !!onRegler
  return (
    <div className="fenetre-zone">
      <div
        className={`fenetre-image${mj ? ' live' : ''}`}
        style={{
          left: `${pos.x * 100}%`,
          top: `${pos.y * 100}%`,
          width: `${largeur}cqw`,
          aspectRatio: String(fenetre.ratio)
        }}
        onPointerDown={(e) => {
          if (!mj || e.button !== 0 || (e.target as HTMLElement).closest('.fen-geste')) return
          e.preventDefault()
          drag.current = { x: e.clientX, y: e.clientY, from: pos }
          bouge.current = false
          e.currentTarget.setPointerCapture(e.pointerId)
          /* Celle qu'on prend passe au premier plan, comme une feuille qu'on
             tire de la pile. */
          if (!devant) onRegler?.({ devant: true })
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
          if (bouge.current) onRegler?.({ x: pos.x, y: pos.y })
        }}
      >
        <img src={fenetre.url} alt={fenetre.title} draggable={false} />

        {mj && onFermer ? (
          <button
            className="fen-geste fen-fermer"
            title="Retirer la fenêtre de l’écran des joueurs"
            aria-label="Fermer la fenêtre"
            onClick={(e) => {
              e.stopPropagation()
              onFermer()
            }}
          >
            ×
          </button>
        ) : null}

        {mj ? (
          <span
            className="fen-geste fen-poignee"
            title="Tirer pour agrandir ou réduire la fenêtre"
            onPointerDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              poigne.current = { x: e.clientX, l: largeur }
              e.currentTarget.setPointerCapture(e.pointerId)
            }}
            onPointerMove={(e) => {
              const p = poigne.current
              const b = (e.currentTarget.parentElement?.parentElement as HTMLElement | undefined)
                ?.getBoundingClientRect()
              if (!p || !b) return
              /* Tirée depuis le centre : un pixel gagné d'un côté en gagne
                 autant de l'autre. La hauteur suit, au ratio de l'image. */
              setLargeur(clamp(p.l + ((e.clientX - p.x) / b.width) * 200, 8, 100))
            }}
            onPointerUp={(e) => {
              if (!poigne.current) return
              poigne.current = null
              e.currentTarget.releasePointerCapture(e.pointerId)
              onRegler?.({ largeur })
            }}
          />
        ) : null}
      </div>
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
  onMenu,
  onSize,
  onAjuster
}: {
  encart: Encart
  joueurs: JoueurVu[]
  onMove?: (x: number, y: number) => void
  onMenu?: (x: number, y: number) => void
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
          /* Pris sans bouger : c'est un clic, il ouvre le menu de l'encart —
             toujours sous lui, au milieu, où qu'on ait cliqué. */ else {
            const r = e.currentTarget.getBoundingClientRect()
            onMenu?.(r.left + r.width / 2, r.bottom)
          }
        }}
      >
        {joueurs.map((j) => (
          <div key={j.id} className={`ejoueur c-${j.color ?? 'neutral'}`}>
            <span className="face">
              {j.url ? (
                <Visage url={j.url} cadre={j.cadre} alt={j.name} />
              ) : (
                <span className="ini">{j.initials}</span>
              )}
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
          {/* Dessinés plutôt qu'écrits : un « − » de police tombe rarement au
              milieu de son bouton. */}
          <button onClick={() => onAjuster(-1)} aria-label={`Retirer 1 à ${j.label}`}>
            <svg viewBox="0 0 10 10" aria-hidden="true">
              <path d="M2 5h6" />
            </svg>
          </button>
          <button onClick={() => onAjuster(1)} aria-label={`Ajouter 1 à ${j.label}`}>
            <svg viewBox="0 0 10 10" aria-hidden="true">
              <path d="M2 5h6M5 2v6" />
            </svg>
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
  else if (p.anonyme) lignes.push('Sans nom — les joueurs ne savent pas qui c’est')
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
  pionEnJeuId,
  pionLabels,
  pionPv,
  joueurs,
  pointer,
  live,
  onRemovePion,
  onRotatePion,
  onPionMenu,
  onPionClic,
  pionChoisiId,
  horsDeVue
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
  /** Celui qui joue : son pion porte le halo des tours. */
  pionEnJeuId: number | null
  pointer: Pointer | null
  /** Côté MJ : les pions se saisissent et portent leur croix. */
  live: boolean
  onRemovePion?: (id: number) => void
  onRotatePion?: (id: number, deg: number) => void
  onPionMenu?: (pion: Pion, x: number, y: number) => void
  onPionClic?: (pion: Pion) => void
  pionChoisiId: number | null
  /** Côté MJ : les pions « au regard » qu'aucun joueur ne voit en ce moment. */
  horsDeVue?: Set<number>
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
        /* Un PNJ n'est pas dans `joueurs` : son état, s'il le montre, voyage
           avec son pion. */
        const etat = j ? etatDeVie(j.pv) : (p.etat ?? null)
        return (
        <div
          key={p.id}
          data-pion={p.id}
          /* Un pion d'objet est un meuble : on le tourne pour de vrai. Un
             personnage, lui, ne se penche pas — c'est son nez qui dit où il
             regarde, et son visage reste droit. */
          className={`pion c-${p.color}${etat ? ` ${etat}` : ''}${p.cache ? ' embusque' : ''}${
            p.itemId != null ? ' objet' : ''
          }${p.id === focusPionId ? ' suivi' : ''}${p.id === pionEnJeuId ? ' en-jeu' : ''}${
            p.regard && !p.cache ? ' au-regard' : ''
          }${horsDeVue?.has(p.id) ? ' hors-vue' : ''}${
            p.id === pionChoisiId ? ' choisi' : ''
          }`}
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
          onClick={
            onPionClic
              ? (e) => {
                  e.stopPropagation()
                  onPionClic(p)
                }
              : undefined
          }
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
          {p.id === pionEnJeuId ? <span className="tour-halo" /> : null}
          {p.url ? (
            <Visage url={p.url} cadre={p.cadre} />
          ) : (
            <span className="ini">{p.initials}</span>
          )}
          {p.rotation && p.itemId == null ? <span className="nez" /> : null}
          {/* Sans nom, il n'en porte pas non plus chez le MJ : la scène montre
              ce que la table voit. Le survol le dit encore, à lui seul. */}
          {pionLabels && p.label && !p.anonyme ? <span className="lab">{p.label}</span> : null}
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
