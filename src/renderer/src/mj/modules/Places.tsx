/**
 * Les lieux — l'arbre et son volet.
 *
 * Trois étages de rangement : un espace tient des niveaux, un niveau tient des
 * lieux. Les deux premiers sont des lignes qu'on replie ; le dernier est une
 * rangée de plans, parce qu'une pièce se reconnaît à son dessin et non à son
 * nom. Rien ne se diffuse d'ici : la diffusion, c'est la régie.
 *
 * Deux gestes portent le module :
 * - **le volet de droite**, qui écrit ce qu'on choisit dans l'arbre, sans modale ;
 * - **le découpage d'un plan**, où les pièces d'un étage se tracent au rectangle
 *   sur la carte du niveau, au lieu de chercher une image chacune.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store'
import {
  IconAudio,
  IconCadrage,
  IconCercle,
  IconCheck,
  IconChevron,
  IconClose,
  IconDoc,
  IconMurs,
  IconPen,
  IconPlace,
  IconPlus,
  IconSoleil,
  IconTrash,
  IconType,
  kindIcon
} from '../components/Icons'
import { ChoixDansArbre } from '../components/ChoixDansArbre'
import { ObjetsDuLieu } from '../components/ObjetsDuLieu'
import { Annotations, CadreAnnote, type OutilAnnotation } from '../components/Annotations'
import { AideMurs, BarreMurs, CalqueMurs, VoletMurs, useMurs } from '../components/Murs'
import {
  PARENT_TIER,
  PION_COULEURS,
  TIER_LABEL,
  type Annotation,
  type Item,
  type Place,
  type PlaceTier,
  type PointMur
} from '@shared/types'
import { boiteDe, centreDe, dansForme, type Forme } from '@shared/pieces'

/** Ce qu'on est en train de créer à la chaîne, et sous quel contenant. */
type Rafale = { parentId: number | null; tier: PlaceTier }

/**
 * L'habitude de chaque étage à l'ouverture du module.
 *
 * Un espace montre ses niveaux : il y en a deux ou trois, ce sont les titres
 * de la maison. Un niveau, lui, tient parfois quinze pièces — il attend qu'on
 * le demande. C'est l'arbre qu'on veut voir en arrivant : les bâtiments, leurs
 * étages, et rien de plus.
 */
const OUVERT_DABORD: Record<PlaceTier, boolean> = { espace: true, niveau: false, lieu: false }

/**
 * Les noms qu'un niveau porte neuf fois sur dix.
 *
 * Un bâtiment a un rez-de-chaussée et des étages ; les nommer à la main, c'est
 * cinq fautes de frappe et autant d'orthographes différentes dans la même
 * campagne. On les propose donc tout faits — et l'on garde la porte ouverte
 * pour le grenier, la cave et le donjon, qui ne rentrent dans aucune liste.
 */
const NOMS_DE_NIVEAU = [
  'Rez-de-chaussée',
  '1er étage',
  '2e étage',
  '3e étage',
  '4e étage',
  '5e étage'
]

/** La sortie de secours de la liste : un nom à soi. */
const NOM_LIBRE = '__autre'

export function Places(): JSX.Element {
  const s = useStore()
  const [chapter, setChapter] = useState<number | 'all'>('all')
  const [choisi, setChoisi] = useState<number | null>(null)
  /** Le lieu ouvert en grand ; la liste disparaît tant qu'il l'est. */
  const [ouvert, setOuvert] = useState<number | null>(null)
  /** Le lieu dont la fiche s'ouvre directement sur le calque des murs. */
  const [murs, setMurs] = useState<number | null>(null)
  /**
   * Les contenants qui ne font pas comme leur étage — ceux qu'on a basculés à
   * la main. Le reste suit `OUVERT_DABORD`.
   */
  const [bascules, setBascules] = useState<Set<number>>(new Set())
  const [rafale, setRafale] = useState<Rafale | null>(null)

  const place = (id: number | null): Place | null =>
    id === null ? null : (s.places.find((p) => p.id === id) ?? null)

  const retenu = (p: Place): boolean => chapter === 'all' || p.chapterIds.includes(chapter)
  const enfants = (pid: number | null, tier: PlaceTier): Place[] =>
    s.places.filter((p) => p.tier === tier && p.parentId === pid)

  /*
   * Le filtre par chapitre s'applique aux lieux ; un contenant reste visible
   * tant qu'il tient quelque chose qui passe le filtre — sinon on chercherait
   * une pièce dans une maison qui aurait disparu.
   */
  const niveauVisible = (n: Place): boolean => retenu(n) || enfants(n.id, 'lieu').some(retenu)
  const espaceVisible = (e: Place): boolean =>
    retenu(e) || enfants(e.id, 'niveau').some(niveauVisible)

  const espaces = enfants(null, 'espace')

  /*
   * Ce qui n'a pas de contenant : un niveau sans espace, un lieu sans niveau.
   * On ne compte pas ici ce qu'ils tiennent — un niveau orphelin garde ses
   * pièces sous lui, et les montrer deux fois serait pire que de les perdre.
   */
  const orphelins = useMemo(
    () =>
      s.places.filter(
        (p) =>
          p.tier !== 'espace' &&
          (p.parentId === null || !s.places.some((q) => q.id === p.parentId))
      ),
    [s.places]
  )

  /** Est-il ouvert ? Son habitude, à moins qu'on ne l'ait basculé. */
  const estDeplie = (p: Place): boolean => OUVERT_DABORD[p.tier] !== bascules.has(p.id)

  const basculer = (id: number): void =>
    setBascules((r) => {
      const n = new Set(r)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  /** Déplier un contenant sans le basculer — quand on vient d'y poser quelque chose. */
  const deplier = (id: number | null): void => {
    const p = id === null ? null : place(id)
    if (!p) return
    setBascules((r) => {
      const n = new Set(r)
      /* Ouvrir, c'est rejoindre son habitude ou s'en écarter, selon l'étage. */
      OUVERT_DABORD[p.tier] ? n.delete(p.id) : n.add(p.id)
      return n
    })
  }

  const relire = async (): Promise<void> => {
    await s.refreshPlaces()
    await s.refreshLibrary()
  }

  /** Créer à la chaîne : la ligne de saisie reste ouverte pour le suivant. */
  const creer = async (nom: string): Promise<void> => {
    if (!rafale) return
    const p = await window.jdr.places.upsert({
      tier: rafale.tier,
      parentId: rafale.parentId,
      name: nom,
      chapterIds: chapter === 'all' ? [] : [chapter]
    })
    setChoisi(p.id)
    /* Ce qu'on vient de créer doit se voir : le contenant s'ouvre. */
    deplier(rafale.parentId)
    await relire()
  }

  /**
   * Jeter un lieu depuis sa tuile.
   *
   * Réservé aux lieux rangés nulle part : ceux-là s'accumulent — un import,
   * une pièce qu'on a promue, un essai — et les faire disparaître un par un
   * par le volet est une corvée. Ailleurs, la suppression reste au volet, où
   * l'on voit ce que le lieu tient avant de l'effacer.
   */
  const effacerLieu = async (p: Place): Promise<void> => {
    await window.jdr.places.remove(p.id)
    if (choisi === p.id) setChoisi(null)
    await relire()
  }

  const marquerVu = async (p: Place): Promise<void> => {
    await window.jdr.places.seen(p.id, !p.seen)
    await s.refreshPlaces()
  }

  /** Le geste du glisser-déposer, une fois la cible connue. */
  const deplacer = async (
    srcId: number,
    parentId: number | null,
    beforeId: number | null
  ): Promise<void> => {
    await window.jdr.places.move(srcId, parentId, beforeId)
    setChoisi(srcId)
    /* On voit où l'on vient de poser : le contenant d'accueil s'ouvre. */
    deplier(parentId)
    await s.refreshPlaces()
  }

  /**
   * Ouvrir une carte sur son calque de murs — c'est là que tout se passe.
   *
   * Un lieu qui reçoit des murs devient l'étage des pièces qu'ils referment ;
   * mais on ne le convertit pas ici, seulement quand une pièce naît vraiment
   * (voir `enEtage`, dans la fiche). Ouvrir un plan ne doit rien changer.
   */
  const ouvrirLesMurs = async (p: Place): Promise<void> => {
    if (p.tier !== 'niveau') {
      /* Un niveau se range dans un espace : on prend celui du dessus s'il existe. */
      const parent = place(p.parentId)
      const grandParent = parent?.tier === 'niveau' ? place(parent.parentId) : parent
      await window.jdr.places.upsert({
        id: p.id,
        tier: 'niveau',
        parentId: grandParent?.tier === 'espace' ? grandParent.id : null,
        name: p.name,
        zone: null
      })
      await relire()
    }
    setChoisi(p.id)
    setOuvert(p.id)
    setMurs(p.id)
  }

  const lieuOuvert = place(ouvert)
  if (lieuOuvert)
    return (
      <FicheLieu
        p={lieuOuvert}
        niveau={place(lieuOuvert.parentId)}
        pieces={enfants(lieuOuvert.id, 'lieu')}
        surLesMurs={murs === lieuOuvert.id}
        onFermer={() => {
          setOuvert(null)
          setMurs(null)
        }}
        onMurs={() => {
          /* Une pièce renvoie au plan de son étage ; tout autre lieu trace
             le sien. */
          const cible = lieuOuvert.zone ? place(lieuOuvert.parentId) : lieuOuvert
          if (cible) void ouvrirLesMurs(cible)
        }}
        onRelire={relire}
      />
    )

  const rien = espaces.filter(espaceVisible).length === 0 && orphelins.filter(retenu).length === 0

  /*
   * Le même rendu sert deux fois : sous son espace, et tout seul en bas quand
   * un niveau n'est rangé nulle part. Sans cela, un étage sans maison devenait
   * une tuile — et ses pièces disparaissaient avec lui.
   */
  const rendreTuiles = (
    lieux: Place[],
    niveau: Place | null,
    /** Les tuiles portent-elles leur corbeille ? Seuls les lieux isolés. */
    jetable = false
  ): JSX.Element => (
    <div className="tuiles">
      {lieux.map((l) => (
        <Tuile
          key={l.id}
          p={l}
          niveau={niveau}
          choisi={choisi === l.id}
          onChoisir={() => setChoisi(l.id)}
          onVu={() => void marquerVu(l)}
          onOuvrir={() => setOuvert(l.id)}
          onDeposer={deplacer}
          onEffacer={jetable ? () => void effacerLieu(l) : undefined}
        />
      ))}
      <Ajout
        rafale={rafale}
        parentId={niveau ? niveau.id : null}
        tier="lieu"
        libelle={niveau ? 'un lieu…' : 'un lieu isolé…'}
        onArmer={setRafale}
        onCreer={creer}
      />
    </div>
  )

  const rendreNiveau = (n: Place): JSX.Element => {
    const deplie = estDeplie(n)
    const lieux = enfants(n.id, 'lieu').filter(retenu)
    return (
      <section key={n.id}>
        <Ligne
          p={n}
          deplie={deplie}
          aDesEnfants
          choisi={choisi === n.id}
          pieces={lieux.filter((l) => l.zone).length}
          onBasculer={() => basculer(n.id)}
          onChoisir={() => setChoisi(n.id)}
          onVu={() => void marquerVu(n)}
          onOuvrir={() => n.mapItemId && void ouvrirLesMurs(n)}
          onDeposer={deplacer}
        />
        {deplie ? rendreTuiles(lieux, n) : null}
      </section>
    )
  }

  const rendreEspace = (e: Place): JSX.Element => {
    const deplie = estDeplie(e)
    const niveaux = enfants(e.id, 'niveau').filter(niveauVisible)
    return (
      <section key={e.id} className="etage">
        <Ligne
          p={e}
          deplie={deplie}
          aDesEnfants={niveaux.length > 0}
          choisi={choisi === e.id}
          onBasculer={() => basculer(e.id)}
          onChoisir={() => setChoisi(e.id)}
          onVu={() => void marquerVu(e)}
          onDeposer={deplacer}
        />
        {deplie ? (
          <div className="branche">
            {niveaux.map(rendreNiveau)}
            <Ajout
              rafale={rafale}
              parentId={e.id}
              tier="niveau"
              libelle="un niveau…"
              pris={niveaux.map((n) => n.name)}
              onArmer={setRafale}
              onCreer={creer}
            />
          </div>
        ) : null}
      </section>
    )
  }

  /* Ce qui traîne hors de l'arbre, chacun rendu selon ce qu'il est. */
  const seuls = orphelins.filter(retenu)
  const niveauxSeuls = seuls.filter((p) => p.tier === 'niveau')
  const lieuxSeuls = seuls.filter((p) => p.tier === 'lieu')
  const aMontrerSeuls =
    seuls.length > 0 || (rafale?.parentId === null && rafale.tier === 'lieu')

  return (
    <section className="view">
      <div className="vhead">
        <div>
          <h2>Lieux</h2>
          <p>
            Un espace tient ses niveaux, un niveau tient ses lieux — et une pièce se reconnaît à
            son plan. Tu construis à gauche, tu remplis à droite.
          </p>
        </div>
        <div className="spacer" />
        <div className="tagbar" style={{ flex: 'none' }}>
          <span className="eyebrow">Chapitre</span>
          <button className="chip" aria-pressed={chapter === 'all'} onClick={() => setChapter('all')}>
            Tous
          </button>
          {s.chapters.map((c) => (
            <button
              key={c.id}
              className="chip"
              aria-pressed={chapter === c.id}
              onClick={() => setChapter(c.id)}
              title={c.title}
            >
              {shortChapter(c.title)}
            </button>
          ))}
        </div>
        <button className="btn" onClick={() => setRafale({ parentId: null, tier: 'espace' })}>
          <IconPlus />
          Nouvel espace
        </button>
      </div>

      <div className="lieux-grille">
        <div className="arbre-lieux">
          {rien && !rafale ? (
            <div className="empty">
              <b>{s.places.length === 0 ? 'Aucun lieu' : 'Rien dans ce chapitre'}</b>
              Un espace, c'est le manoir ; ses niveaux, les étages ; ses lieux, les pièces. Un lieu
              qui ne se range nulle part reste seul, c'est très bien aussi.
            </div>
          ) : null}

          {espaces.filter(espaceVisible).map(rendreEspace)}

          <Ajout
            rafale={rafale}
            parentId={null}
            tier="espace"
            libelle="un espace…"
            onArmer={setRafale}
            onCreer={creer}
          />

          {aMontrerSeuls ? (
            <section className="etage etage-seuls">
              <span className="eyebrow">Rangés nulle part</span>
              {niveauxSeuls.map(rendreNiveau)}
              {lieuxSeuls.length || !niveauxSeuls.length
                ? rendreTuiles(lieuxSeuls, null, true)
                : null}
            </section>
          ) : null}
        </div>

        <Volet
          p={place(choisi)}
          niveau={place(place(choisi)?.parentId ?? null)}
          onRelire={relire}
          onEfface={() => setChoisi(null)}
          onOuvrir={() => setOuvert(choisi)}
          onMurs={(p) => void ouvrirLesMurs(p)}
        />
      </div>
    </section>
  )
}

/* ============================================================
   Le glisser-déposer, partagé par les lignes et les tuiles
   ============================================================ */

/** Où l'on s'apprête à lâcher : dedans un contenant, ou devant un frère. */
type Cible = 'dedans' | 'avant' | null

function peutRanger(src: Place, dst: Place): { dedans: boolean; avant: boolean } {
  return {
    dedans:
      (src.tier === 'lieu' && dst.tier === 'niveau') ||
      (src.tier === 'niveau' && dst.tier === 'espace'),
    avant: src.tier === dst.tier && src.id !== dst.id
  }
}

/**
 * Un nœud de l'arbre qu'on peut attraper et sur lequel on peut lâcher.
 *
 * Le sens de la coupe suit le sens du rangement : une rangée de tuiles se
 * coupe par la gauche, une pile de lignes par le haut.
 */
function useDepot(
  p: Place,
  couche: boolean,
  onDeposer: (srcId: number, parentId: number | null, beforeId: number | null) => void | Promise<void>
): {
  cible: Cible
  props: React.HTMLAttributes<HTMLDivElement> & { draggable: boolean }
} {
  const s = useStore()
  const [cible, setCible] = useState<Cible>(null)

  const source = (e: React.DragEvent): Place | null => {
    const id = Number(e.dataTransfer.getData('text/plain') || dragEnCours)
    return s.places.find((q) => q.id === id) ?? null
  }

  const viser = (e: React.DragEvent): Cible => {
    const src = source(e)
    if (!src || src.id === p.id) return null
    const ok = peutRanger(src, p)
    const r = e.currentTarget.getBoundingClientRect()
    const avant = couche
      ? e.clientX - r.left < r.width * 0.42
      : e.clientY - r.top < r.height * 0.34
    if (ok.dedans && !avant) return 'dedans'
    if (ok.avant) return 'avant'
    return ok.dedans ? 'dedans' : null
  }

  return {
    cible,
    props: {
      draggable: true,
      onDragStart: (e) => {
        dragEnCours = p.id
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', String(p.id))
      },
      onDragEnd: () => {
        dragEnCours = null
        setCible(null)
      },
      onDragOver: (e) => {
        const ou = viser(e)
        if (!ou) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setCible(ou)
      },
      onDragLeave: () => setCible(null),
      onDrop: (e) => {
        e.preventDefault()
        e.stopPropagation()
        const src = source(e)
        const ou = viser(e)
        setCible(null)
        if (!src || !ou) return
        if (ou === 'dedans') void onDeposer(src.id, p.id, null)
        else void onDeposer(src.id, p.parentId, p.id)
      }
    }
  }
}

/* Firefox ne rend pas les données du transfert pendant `dragover` : on garde
   la pièce en main de côté, le temps du geste. */
let dragEnCours: number | null = null

/**
 * Le nom d'un niveau : une liste d'étages, et un champ pour le reste.
 *
 * Choisir dans la liste vaut décision — le nom est posé aussitôt. « Autre
 * nom… » ouvre un champ libre, qui est aussi ce qu'on voit d'emblée quand le
 * niveau porte déjà un nom hors liste.
 */
function NomDeNiveau({
  id,
  valeur,
  pris = [],
  focus = false,
  onChoisir,
  onEcrire,
  onValider,
  onAnnuler
}: {
  id?: string
  valeur: string
  /** Les noms déjà portés par les niveaux voisins : on ne les propose plus. */
  pris?: string[]
  focus?: boolean
  onChoisir: (nom: string) => void
  onEcrire?: (nom: string) => void
  onValider?: () => void
  onAnnuler?: () => void
}): JSX.Element {
  const connu = NOMS_DE_NIVEAU.includes(valeur)
  const [libre, setLibre] = useState(!!valeur && !connu)
  const liste = useRef<HTMLSelectElement>(null)
  const champ = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (libre) champ.current?.focus()
    else if (focus) liste.current?.focus()
  }, [libre, focus])

  return (
    <>
      <select
        id={id}
        ref={liste}
        value={libre ? NOM_LIBRE : connu ? valeur : ''}
        onChange={(e) => {
          const v = e.target.value
          if (v === NOM_LIBRE) return setLibre(true)
          setLibre(false)
          onChoisir(v)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onAnnuler?.()
        }}
      >
        {libre || connu ? null : <option value="">Quel étage ?…</option>}
        {NOMS_DE_NIVEAU.map((n) => (
          <option key={n} value={n} disabled={n !== valeur && pris.includes(n)}>
            {n}
          </option>
        ))}
        <option value={NOM_LIBRE}>Autre nom…</option>
      </select>
      {libre ? (
        <input
          ref={champ}
          type="text"
          value={connu ? '' : valeur}
          placeholder="Le nom de cet étage…"
          onChange={(e) => (onEcrire ?? onChoisir)(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onValider?.()
            } else if (e.key === 'Escape') onAnnuler?.()
          }}
        />
      ) : null}
    </>
  )
}

/* ============================================================
   Une ligne — un espace ou un niveau
   ============================================================ */

function Ligne({
  p,
  deplie,
  aDesEnfants,
  choisi,
  pieces = 0,
  onBasculer,
  onChoisir,
  onVu,
  onOuvrir,
  onDeposer
}: {
  p: Place
  deplie: boolean
  aDesEnfants: boolean
  choisi: boolean
  pieces?: number
  onBasculer: () => void
  onChoisir: () => void
  onVu: () => void
  onOuvrir?: () => void
  onDeposer: (srcId: number, parentId: number | null, beforeId: number | null) => void | Promise<void>
}): JSX.Element {
  const s = useStore()
  const map = s.allItems.find((i) => i.id === p.mapItemId)
  const { cible, props } = useDepot(p, false, onDeposer)
  const ap = useApercu()

  return (
    <div
      {...props}
      className={
        `ligne ligne-${p.tier}` +
        (deplie ? ' ouverte' : '') +
        (choisi ? ' choisie' : '') +
        (cible ? ` survol-${cible}` : '')
      }
      role="treeitem"
      aria-selected={choisi}
      tabIndex={0}
      onClick={onChoisir}
      onDoubleClick={onOuvrir}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onChoisir())}
    >
      <span className="poignee" title="Glisser pour ranger ailleurs">
        <svg viewBox="0 0 6 14" width="6" height="14" fill="currentColor" aria-hidden="true">
          <circle cx="1.5" cy="2" r="1" />
          <circle cx="4.5" cy="2" r="1" />
          <circle cx="1.5" cy="7" r="1" />
          <circle cx="4.5" cy="7" r="1" />
          <circle cx="1.5" cy="12" r="1" />
          <circle cx="4.5" cy="12" r="1" />
        </svg>
      </span>
      <button
        className={`plier${aDesEnfants ? '' : ' creux'}`}
        aria-label={deplie ? 'Replier' : 'Déplier'}
        onClick={(e) => {
          e.stopPropagation()
          onBasculer()
        }}
      >
        <IconChevron className="caret" />
      </button>
      <span className="mini" {...ap.gestes}>
        {map?.url ? <img src={map.url} alt="" draggable={false} /> : <IconPlace />}
      </span>
      {ap.vise ? <Apercu p={p} url={map?.url ?? null} vise={ap.vise} /> : null}
      <span className="tx">
        <b>{p.name}</b>
        {p.summary ? <span className="sum">{p.summary}</span> : null}
      </span>
      {pieces ? (
        <span className="tag c-brass" title="Pièces tracées sur ce plan">
          {pieces} pièce{pieces > 1 ? 's' : ''}
        </span>
      ) : null}
      <span className="eyebrow tier">{TIER_LABEL[p.tier]}</span>
      <Jalon p={p} onVu={onVu} />
    </div>
  )
}

/** Le rond de découverte : vide tant que le groupe n'y est pas passé. */
function Jalon({ p, onVu }: { p: Place; onVu: () => void }): JSX.Element {
  return (
    <button
      className={`jalon${p.seen ? ' vu' : ''}`}
      title={
        p.seen
          ? 'Découvert par les joueurs — clique pour revenir en arrière'
          : 'Pas encore découvert — clique quand ils y entrent'
      }
      onClick={(e) => {
        e.stopPropagation()
        onVu()
      }}
    >
      {p.seen ? <IconCheck /> : <IconCercle />}
    </button>
  )
}

/* ============================================================
   Une tuile — un lieu
   ============================================================ */

/**
 * Le plan d'une pièce, cadré sur sa zone.
 *
 * L'image reste celle de l'étage : on ne la recoupe pas, on la place et on
 * l'agrandit derrière une fenêtre aux proportions de la tuile. C'est le même
 * calcul que `CadreAnnote`, en beaucoup plus court — ici rien ne se pose
 * dessus.
 */
function PlanCadre({ url, zone }: { url: string; zone: PointMur[] | null }): JSX.Element {
  if (!zone || zone.length < 3) return <img src={url} alt="" draggable={false} />
  /* Le contour n'est pas un rectangle ; la vignette, si. On cadre donc sur la
     boîte qui l'enferme — assez pour reconnaître la pièce d'un coup d'œil. */
  const b = boiteDe(zone)
  return (
    <img
      src={url}
      alt=""
      draggable={false}
      className="cadree"
      style={{
        width: `${100 / b.w}%`,
        height: `${100 / b.h}%`,
        left: `${(-b.x * 100) / b.w}%`,
        top: `${(-b.y * 100) / b.h}%`
      }}
    />
  )
}

/* ------------------------------------------------------------
   L'aperçu au survol
   ------------------------------------------------------------ */

/** La taille du panneau flottant, en pixels de mise en page. */
const APERCU_L = 360
const APERCU_H = 240

/** Où le panneau va se poser, et de quel côté de la vignette. */
type Vise = { x: number; y: number; cote: 'droite' | 'gauche' }

/**
 * Poser le panneau à côté de la vignette, sans sortir de la fenêtre.
 *
 * À droite si la place y est, à gauche sinon ; centré sur la vignette en
 * hauteur, puis ramené dans l'écran. On ne le met jamais **sur** la vignette :
 * le curseur y est, et le panneau s'en irait aussitôt.
 */
function placerApercu(r: DOMRect): Vise {
  const marge = 10
  const h = APERCU_H + 52
  const aDroite = r.right + marge + APERCU_L <= window.innerWidth
  const x = aDroite ? r.right + marge : Math.max(marge, r.left - marge - APERCU_L)
  const y = Math.min(
    Math.max(marge, r.top + r.height / 2 - h / 2),
    Math.max(marge, window.innerHeight - h - marge)
  )
  return { x, y, cote: aDroite ? 'droite' : 'gauche' }
}

/**
 * Le survol qui agrandit.
 *
 * Les vignettes sont petites — c'est voulu, un étage en tient beaucoup —, mais
 * un plan minuscule ne se lit pas. Le curseur touche la vignette, le plan
 * s'ouvre en grand à côté : **pas de délai**, on survole pour voir, on ne
 * devrait pas avoir à attendre pour être compris. Tout le reste le referme :
 * on part, on clique, on fait défiler, on commence à glisser.
 */
function useApercu(): {
  vise: Vise | null
  gestes: {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => void
    onMouseLeave: () => void
    onMouseDown: () => void
  }
} {
  const [vise, setVise] = useState<Vise | null>(null)

  const fermer = useCallback((): void => setVise(null), [])

  /* Si la liste bouge sous le panneau, il ne montre plus la bonne vignette. */
  useEffect(() => {
    if (!vise) return
    window.addEventListener('scroll', fermer, true)
    window.addEventListener('wheel', fermer, { capture: true, passive: true })
    return () => {
      window.removeEventListener('scroll', fermer, true)
      window.removeEventListener('wheel', fermer, true)
    }
  }, [vise, fermer])

  return {
    vise,
    gestes: {
      onMouseEnter: (e) => setVise(placerApercu(e.currentTarget.getBoundingClientRect())),
      onMouseLeave: fermer,
      onMouseDown: fermer
    }
  }
}

/**
 * Le panneau lui-même : le même plan, en grand, et de quoi le nommer.
 *
 * Il se pose sur le corps de la page et non dans la tuile : une tuile est dans
 * une liste qui défile et qui coupe ce qui dépasse, le panneau n'y tiendrait
 * pas.
 */
function Apercu({ p, url, vise }: { p: Place; url: string | null; vise: Vise }): JSX.Element {
  return createPortal(
    <div
      className={`apercu apercu-${vise.cote}`}
      style={{ left: vise.x, top: vise.y, width: APERCU_L }}
      role="presentation"
    >
      <div className="apercu-vue" style={{ height: APERCU_H }}>
        {url ? <PlanCadre url={url} zone={p.zone} /> : <IconPlace />}
      </div>
      <div className="apercu-tx">
        <b>{p.name}</b>
        {p.summary ? <span>{p.summary}</span> : null}
      </div>
    </div>,
    document.body
  )
}

function Tuile({
  p,
  niveau,
  choisi,
  onChoisir,
  onVu,
  onOuvrir,
  onDeposer,
  onEffacer
}: {
  p: Place
  niveau: Place | null
  choisi: boolean
  onChoisir: () => void
  onVu: () => void
  onOuvrir: () => void
  onDeposer: (srcId: number, parentId: number | null, beforeId: number | null) => void | Promise<void>
  /** S'il est donné, la tuile porte une corbeille. */
  onEffacer?: () => void
}): JSX.Element {
  const s = useStore()
  const map = s.allItems.find((i) => i.id === p.mapItemId)
  const { cible, props } = useDepot(p, true, onDeposer)
  const ap = useApercu()

  return (
    <div
      {...props}
      className={
        'tuile' +
        (choisi ? ' choisie' : '') +
        (p.seen ? '' : ' pasvu') +
        (cible ? ` survol-${cible}` : '')
      }
      role="treeitem"
      aria-selected={choisi}
      tabIndex={0}
      onClick={onChoisir}
      onDoubleClick={onOuvrir}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onChoisir())}
    >
      {/* Le nom et le résumé ne sont plus dans un `title` : ils sont dans
          l'aperçu, qui les montre avec le plan plutôt qu'à côté. */}
      {/* Les deux pastilles vivent dans la vue, et non dans la tuile : c'est au
          plan qu'elles doivent se tenir, quelle que soit la marge autour. */}
      <span className="vue" {...ap.gestes}>
        {map?.url ? <PlanCadre url={map.url} zone={p.zone} /> : <IconPlace />}
        <Jalon p={p} onVu={onVu} />
        {onEffacer ? <OterTuile nom={p.name} onEffacer={onEffacer} /> : null}
      </span>
      {ap.vise ? <Apercu p={p} url={map?.url ?? null} vise={ap.vise} /> : null}
      <span className="nom">{p.name}</span>
      <span className="sig">
        {p.docCount ? (
          <span className="p" title={`${p.docCount} document${p.docCount > 1 ? 's' : ''}`}>
            <IconDoc />
            {p.docCount}
          </span>
        ) : null}
        {p.zone && niveau ? (
          <span className="p zone" title={`Une zone du plan de ${niveau.name}`}>
            <IconCadrage />
          </span>
        ) : null}
      </span>
    </div>
  )
}

/**
 * La corbeille d'une tuile.
 *
 * Elle ne se montre qu'au survol, et surtout elle **s'arme d'abord** : le
 * premier clic prévient, le second efface, et l'oubli la désarme. Un lieu
 * supprimé ne revient pas, une croix qui mord du premier coup non plus.
 */
function OterTuile({ nom, onEffacer }: { nom: string; onEffacer: () => void }): JSX.Element {
  const [arme, setArme] = useState(false)
  return (
    <button
      className={`oter${arme ? ' arme' : ''}`}
      title={arme ? `Vraiment supprimer « ${nom} » ?` : `Supprimer « ${nom} »`}
      onClick={(e) => {
        e.stopPropagation()
        if (!arme) {
          setArme(true)
          window.setTimeout(() => setArme(false), 3500)
          return
        }
        setArme(false)
        onEffacer()
      }}
    >
      {arme ? <IconCheck /> : <IconTrash />}
    </button>
  )
}

/* ============================================================
   La création à la chaîne
   ============================================================ */

/**
 * Une ligne — ou une tuile — fantôme au bout d'une fratrie. On tape le nom,
 * Entrée le crée et rouvre aussitôt un champ vide pour le suivant : c'est
 * comme ça qu'on monte un étage sans lâcher le clavier. Échap arrête.
 */
function Ajout({
  rafale,
  parentId,
  tier,
  libelle,
  pris = [],
  onArmer,
  onCreer
}: {
  rafale: Rafale | null
  parentId: number | null
  tier: PlaceTier
  libelle: string
  /** Pour un niveau : les étages déjà montés sous ce contenant. */
  pris?: string[]
  onArmer: (r: Rafale | null) => void
  onCreer: (nom: string) => Promise<void>
}): JSX.Element {
  const [v, setV] = useState('')
  const armee = rafale?.parentId === parentId && rafale.tier === tier
  const champ = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (armee) champ.current?.focus()
  }, [armee])

  const valider = async (): Promise<void> => {
    const nom = v.trim()
    if (!nom) return onArmer(null)
    setV('')
    await onCreer(nom)
    champ.current?.focus()
  }

  if (!armee)
    return (
      <button
        className={tier === 'lieu' ? 'ajout-tuile' : 'ajout'}
        onClick={() => onArmer({ parentId, tier })}
      >
        <span className="vue">
          <IconPlus />
        </span>
        <span className="nom">{libelle}</span>
      </button>
    )

  /* Un niveau se choisit dans la liste des étages : un clic suffit à le créer. */
  if (tier === 'niveau')
    return (
      <div className="rafale rafale-etage">
        <span className="vue">⎋ arrête</span>
        <NomDeNiveau
          valeur={v}
          pris={pris}
          focus
          onChoisir={(nom) => {
            setV('')
            void onCreer(nom)
          }}
          onEcrire={setV}
          onValider={() => void valider()}
          onAnnuler={() => {
            setV('')
            onArmer(null)
          }}
        />
      </div>
    )

  return (
    <div className={tier === 'lieu' ? 'rafale-tuile' : 'rafale'}>
      <span className="vue">⏎ crée · ⎋ arrête</span>
      <input
        ref={champ}
        type="text"
        value={v}
        placeholder={`Nom du ${TIER_LABEL[tier].toLowerCase()}…`}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            void valider()
          } else if (e.key === 'Escape') {
            setV('')
            onArmer(null)
          }
        }}
        onBlur={() => {
          if (!v.trim()) onArmer(null)
        }}
      />
    </div>
  )
}

/* ============================================================
   Le volet — ce que le lieu choisi a dans le ventre
   ============================================================ */

function Volet({
  p,
  niveau,
  onRelire,
  onEfface,
  onOuvrir,
  onMurs
}: {
  p: Place | null
  niveau: Place | null
  onRelire: () => Promise<void>
  onEfface: () => void
  onOuvrir: () => void
  onMurs: (p: Place) => void
}): JSX.Element {
  const s = useStore()
  const [f, setF] = useState<Place | null>(p)
  const [ecrit, setEcrit] = useState(false)
  const [confirme, setConfirme] = useState(false)
  const [choixCarte, setChoixCarte] = useState(false)
  const minuteur = useRef<number | null>(null)

  /* Le brouillon se recharge quand on change de lieu, jamais pendant qu'on
     écrit dedans : sinon la relecture qui suit l'enregistrement viendrait
     reposer le texte sous le curseur. */
  useEffect(() => {
    setF((cur) =>
      cur && p && cur.id === p.id
        ? /* Le texte en cours reste ; l'étage, le rangement, la zone et la
             découverte viennent d'ailleurs et doivent se rafraîchir. */
          { ...cur, tier: p.tier, parentId: p.parentId, zone: p.zone, seen: p.seen }
        : p
    )
    setConfirme(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p?.id, p?.tier, p?.parentId, p?.seen, p?.zone?.length])

  if (!f || !p)
    return (
      <aside className="volet-lieu vide">
        <IconPlace />
        <b>Rien de choisi</b>
        <p>Clique une ligne ou une tuile : tout ce qui la décrit s'écrit ici.</p>
      </aside>
    )

  const enregistrer = async (v: Place): Promise<void> => {
    await window.jdr.places.upsert({
      id: v.id,
      tier: v.tier,
      parentId: v.tier === 'espace' ? null : v.parentId,
      name: v.name.trim() || 'Sans nom',
      summary: v.summary,
      notes: v.notes,
      mapItemId: v.mapItemId,
      zone: v.zone,
      ambienceItemId: v.ambienceItemId,
      seen: v.seen,
      chapterIds: v.chapterIds
    })
    setEcrit(true)
    window.setTimeout(() => setEcrit(false), 1200)
    await onRelire()
  }

  /** Ce qu'on tape attend une seconde ; ce qu'on choisit part tout de suite. */
  const patch = (d: Partial<Place>, differe = false): void => {
    const v = { ...f, ...d }
    setF(v)
    if (minuteur.current) window.clearTimeout(minuteur.current)
    if (differe) minuteur.current = window.setTimeout(() => void enregistrer(v), 700)
    else void enregistrer(v)
  }

  const carte = s.allItems.find((i) => i.id === f.mapItemId)
  const sons = s.allItems.filter((i) => i.kind === 'audio')
  const attendu = PARENT_TIER[f.tier]
  const contenants = attendu ? s.places.filter((q) => q.tier === attendu && q.id !== f.id) : []
  const route = cheminDe(f, s.places)
  /* Une pièce ne se découpe que si son étage a un plan où la tracer. */
  const decoupable = f.tier === 'lieu' && niveau?.mapItemId
  const tenus = s.places.filter(
    (q) => q.parentId === f.id || s.places.some((r) => r.id === q.parentId && r.parentId === f.id)
  ).length

  return (
    <aside className="volet-lieu">
      <header>
        <div className="chemin">
          <span className="eyebrow">{TIER_LABEL[f.tier]}</span>
          {route.map((b) => (
            <span key={b.id}>
              <span className="sep">·</span>
              {b.name}
            </span>
          ))}
        </div>
        <h3>{f.name || 'Sans nom'}</h3>
      </header>

      <div className="corps">
        <div className="field">
          <label htmlFor="pl-name">Nom</label>
          {f.tier === 'niveau' ? (
            <NomDeNiveau
              key={f.id}
              id="pl-name"
              valeur={f.name}
              pris={s.places
                .filter((q) => q.tier === 'niveau' && q.parentId === f.parentId && q.id !== f.id)
                .map((q) => q.name)}
              onChoisir={(nom) => patch({ name: nom })}
              onEcrire={(nom) => patch({ name: nom }, true)}
            />
          ) : (
            <input
              id="pl-name"
              type="text"
              value={f.name}
              onChange={(e) => patch({ name: e.target.value }, true)}
            />
          )}
        </div>

        <div className={`decouverte${f.seen ? ' vu' : ''}`}>
          <span className="tx">
            <b>{f.seen ? 'Découvert' : 'Pas encore découvert'}</b>
            <span>
              {f.seen ? 'Le groupe y est passé.' : 'Le groupe n’y a jamais mis les pieds.'}
            </span>
          </span>
          <button className="btn btn-sm" onClick={() => patch({ seen: !f.seen })}>
            {f.seen ? 'Pas encore' : 'Ils y entrent'}
          </button>
        </div>

        <div className="field">
          <label htmlFor="pl-sum">Description courte — ce que voient les joueurs en arrivant</label>
          <textarea
            id="pl-sum"
            value={f.summary ?? ''}
            onChange={(e) => patch({ summary: e.target.value }, true)}
          />
        </div>

        <div className="field">
          <label htmlFor="pl-notes">Notes du MJ — ce qu'ils ne doivent pas savoir</label>
          <textarea
            id="pl-notes"
            value={f.notes ?? ''}
            onChange={(e) => patch({ notes: e.target.value }, true)}
          />
        </div>

        <div className="field">
          <label>Carte</label>
          {f.zone && niveau ? (
            <button className="choix-carte" onClick={() => onMurs(niveau)}>
              <span className="vue">
                {carte?.url ? <PlanCadre url={carte.url} zone={f.zone} /> : <IconPlace />}
              </span>
              <span className="tx">
                <b>Une pièce du plan de {niveau.name}</b>
                <span className="ou">{carte ? carte.title : 'Ce niveau n’a plus de carte'}</span>
              </span>
              <span className="btn btn-ghost btn-sm">Voir les murs</span>
            </button>
          ) : (
            <button className="choix-carte" onClick={() => setChoixCarte(true)}>
              <span className="vue">
                {carte?.url ? <img src={carte.url} alt="" draggable={false} /> : <IconPlace />}
              </span>
              <span className="tx">
                <b>{carte ? carte.title : 'Aucune carte'}</b>
                <span className="ou">
                  {carte ? dossierDe(carte.relPath) : 'Choisir dans le dossier de la campagne'}
                </span>
              </span>
              <span className="btn btn-ghost btn-sm">{carte ? 'Changer' : 'Choisir'}</span>
            </button>
          )}
        </div>

        <div className="deux">
          <div className="field">
            <label htmlFor="pl-tier">Ce que c'est</label>
            <select
              id="pl-tier"
              value={f.tier}
              onChange={async (e) => {
                /* Changer d'étage vide le contenant : un espace n'en a pas, et
                   celui d'un niveau n'est pas celui d'un lieu. La zone part
                   avec, elle ne voulait dire quelque chose que sous un niveau. */
                const tier = e.target.value as PlaceTier
                await window.jdr.places.upsert({
                  id: f.id,
                  tier,
                  parentId: null,
                  name: f.name,
                  zone: null
                })
                await onRelire()
              }}
            >
              <option value="espace">Espace — un manoir, un village, un vaisseau</option>
              <option value="niveau">Niveau — un étage, une aile, un pont</option>
              <option value="lieu">Lieu — une pièce, une clairière</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="pl-parent">Rangé dans</label>
            <select
              id="pl-parent"
              value={f.parentId ?? ''}
              disabled={!attendu}
              onChange={async (e) => {
                const parentId = e.target.value === '' ? null : Number(e.target.value)
                await window.jdr.places.move(f.id, parentId, null)
                await onRelire()
              }}
            >
              <option value="">
                {attendu ? `— aucun ${attendu} —` : '— un espace ne se range pas —'}
              </option>
              {contenants.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
            <label htmlFor="pl-amb">Ambiance sonore</label>
            <select
              id="pl-amb"
              value={f.ambienceItemId ?? ''}
              onChange={(e) =>
                patch({ ambienceItemId: e.target.value === '' ? null : Number(e.target.value) })
              }
            >
              <option value="">— aucune —</option>
              {sons.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.title}
                </option>
              ))}
            </select>
        </div>

        {/* Ce qu'on trouve dans la pièce. On la prépare ici, l'objet se pose
            ici : plus besoin d'aller le désigner depuis la réserve. */}
        <div className="field">
          <ObjetsDuLieu placeId={f.id} />
        </div>

        <div className="field">
          <label>Chapitres</label>
          <div className="tagbar">
            {s.chapters.map((c) => (
              <button
                key={c.id}
                className="chip"
                aria-pressed={f.chapterIds.includes(c.id)}
                title={c.title}
                onClick={() =>
                  patch({
                    chapterIds: f.chapterIds.includes(c.id)
                      ? f.chapterIds.filter((x) => x !== c.id)
                      : [...f.chapterIds, c.id]
                  })
                }
              >
                {shortChapter(c.title)}
              </button>
            ))}
            {s.chapters.length === 0 && (
              <span className="vide">Aucun chapitre défini pour l’instant.</span>
            )}
          </div>
        </div>

        {f.tier === 'niveau' ? (
          <p className="mot">
            {s.places.filter((q) => q.parentId === f.id && q.zone).length
              ? 'Les pièces tracées sur ce plan en partagent l’image : leurs murs et leurs repères sont ceux de l’étage, vus de près.'
              : 'Ce plan n’est pas encore découpé : trace les pièces dessus plutôt que de chercher une image à chacune.'}
          </p>
        ) : null}
      </div>

      <footer>
        {f.tier === 'niveau' && f.mapItemId ? (
          <button className="btn btn-brass" onClick={() => onMurs(f)}>
            <IconMurs />
            Tracer les murs
          </button>
        ) : (
          <>
            <button
              className="btn btn-brass"
              disabled={!f.mapItemId}
              title={
                f.mapItemId ? 'La carte en grand : repères et murs' : 'Donne-lui d’abord une carte'
              }
              onClick={onOuvrir}
            >
              <IconPen />
              Ouvrir la carte
            </button>

          </>
        )}
        <span className="spacer" />
        {ecrit ? <span className="etat">enregistré</span> : null}
        {/* La confirmation tient dans le bouton : une seconde ligne ferait
            grandir le pied et pousserait le bouton hors du volet. */}
        <button
          className={`btn btn-sm btn-danger${confirme ? ' arme' : ' btn-ghost'}`}
          title={
            confirme
              ? `Supprimer « ${f.name} »${tenus ? ` et les ${tenus} lieux qu'il tient` : ''}`
              : 'Supprimer ce lieu'
          }
          onClick={async () => {
            if (!confirme) {
              setConfirme(true)
              window.setTimeout(() => setConfirme(false), 4000)
              return
            }
            await window.jdr.places.remove(f.id)
            onEfface()
            await onRelire()
          }}
        >
          <IconTrash />
          {confirme
            ? `Vraiment${tenus ? ` — et ses ${tenus} lieux` : ''} ?`
            : 'Supprimer'}
        </button>
      </footer>

      {choixCarte && (
        <ChoixDansArbre
          titre={`Carte — ${f.name.trim() || TIER_LABEL[f.tier].toLowerCase()}`}
          icone={<IconPlace />}
          kinds={['image']}
          rendu="vignettes"
          courant={f.mapItemId}
          sansLibelle="Aucune carte"
          onPick={(id) => {
            patch({ mapItemId: id, zone: null })
            setChoixCarte(false)
          }}
          onClose={() => setChoixCarte(false)}
        />
      )}
    </aside>
  )
}

/* ============================================================
   La fiche d'un lieu — et son calque d'annotations
   ============================================================ */

/**
 * La fiche prend toute la page : c'est la place qu'il faut pour lire une carte
 * et l'annoter. Le fil d'Ariane ramène à la liste.
 *
 * **Le calque d'annotations ne se voit que d'ici et de la régie, jamais des
 * joueurs** : il ne passe pas par l'état de diffusion.
 *
 * Une pièce découpée montre sa zone, mais pose ses repères et ses murs en
 * coordonnées du plan entier : c'est le même calque que celui de l'étage.
 */
function FicheLieu({
  p,
  niveau,
  pieces,
  surLesMurs,
  onFermer,
  onMurs,
  onRelire
}: {
  p: Place
  niveau: Place | null
  /** Les lieux déjà nés des murs de cette carte. */
  pieces: Place[]
  /** La fiche s'ouvre directement sur le calque des murs. */
  surLesMurs?: boolean
  onFermer: () => void
  onMurs: () => void
  onRelire: () => Promise<void>
}): JSX.Element {
  const s = useStore()
  const [annote, setAnnote] = useState(false)
  /* Le calque des murs : un troisième mode, exclusif de l'annotation. Les deux
     se posent sur la même carte, et on ne trace pas une cloison en visant un
     repère. */
  const [murs, setMurs] = useState(!!surLesMurs)
  const mu = useMurs(p.id)
  const [outil, setOutil] = useState<OutilAnnotation>(null)
  const [choisi, setChoisi] = useState<number | null>(null)
  const [liste, setListe] = useState<Annotation[]>([])
  /**
   * L'éclat de la carte, en pourcentage — **pour l'œil seulement**.
   *
   * Beaucoup de plans de donjon sont peints très sombres : on n'y distingue
   * plus une cloison d'un meuble au moment de tracer. Ce curseur n'écrit rien,
   * ne suit pas le lieu et ne sort pas de cette fiche ; il se remet à 100 % dès
   * qu'on ouvre une autre carte. Les joueurs voient l'image telle qu'elle est.
   */
  const [lum, setLum] = useState(100)

  const carte = s.allItems.find((i) => i.id === p.mapItemId)
  const amb = s.allItems.find((i) => i.id === p.ambienceItemId)
  const docs = s.allItems.filter((i) => i.placeId === p.id)

  const relire = async (): Promise<void> => setListe(await window.jdr.annotations.of(p.id))

  useEffect(() => {
    void relire()
    setChoisi(null)
    setLum(100)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.id])

  const enCours = liste.find((a) => a.id === choisi) ?? null

  /**
   * Le lieu qui habite cette forme — celui dont l'ancre y tombe.
   *
   * On ne compare pas les contours : ils changent dès qu'on déplace une
   * cloison. Le point par lequel on a nommé la pièce, lui, reste dedans.
   */
  const lieuDeLaForme = (f: Forme): Place | null =>
    pieces.find((q) => q.ancre && dansForme(q.ancre, f.pts)) ?? null

  /**
   * Baptiser une forme : elle devient un lieu de cet étage, avec son contour
   * et le point qui la désigne.
   */
  const nommerForme = async (f: Forme, nom: string): Promise<void> => {
    await enEtage()
    const deja = lieuDeLaForme(f)
    if (deja) {
      await window.jdr.places.upsert({ id: deja.id, name: nom, tier: 'lieu', parentId: p.id })
      await window.jdr.places.zone(deja.id, f.pts, f.centre)
    } else {
      const neuf = await window.jdr.places.upsert({
        tier: 'lieu',
        parentId: p.id,
        name: nom,
        chapterIds: p.chapterIds
      })
      await window.jdr.places.zone(neuf.id, f.pts, f.centre)
    }
    await onRelire()
  }

  /**
   * Effacer la pièce qui occupe cette forme.
   *
   * On efface le **lieu**, jamais les murs : le contour appartient au plan, et
   * le plan n'a rien demandé. La forme restera donc détectée, sans nom — libre
   * de recevoir le bon.
   */
  const effacerPiece = async (f: Forme): Promise<void> => {
    const lieu = lieuDeLaForme(f)
    if (!lieu) return
    await window.jdr.places.remove(lieu.id)
    mu.setFormeVisee(null)
    await onRelire()
  }

  /**
   * Faire un lieu d'un contour qu'on vient de désigner.
   *
   * Même chemin que le nommage d'une forme détectée — c'est le même objet au
   * bout : un lieu de cet étage, avec son contour et le point qui le désigne.
   */
  const formerPiece = async (contour: PointMur[], nom: string): Promise<void> => {
    await enEtage()
    const neuf = await window.jdr.places.upsert({
      tier: 'lieu',
      parentId: p.id,
      name: nom,
      chapterIds: p.chapterIds
    })
    await window.jdr.places.zone(neuf.id, contour, centreDe(contour))
    await onRelire()
  }

  /**
   * Ce lieu devient l'étage de ses pièces — au moment où il en reçoit une.
   *
   * Un lieu ne peut pas en contenir d'autres : les trois étages du rangement
   * sont fixes. Plutôt que d'exiger la conversion d'avance, par un bouton
   * qu'il fallait comprendre, on la fait ici, la première fois qu'une pièce
   * naît sur ce plan. Rien à savoir, rien à préparer.
   */
  const enEtage = async (): Promise<void> => {
    if (p.tier === 'niveau') return
    await window.jdr.places.upsert({
      id: p.id,
      tier: 'niveau',
      parentId: niveau?.tier === 'espace' ? niveau.id : null,
      name: p.name,
      zone: null
    })
    await onRelire()
  }

  /*
   * Les contours suivent les murs : quand un trait bouge, la pièce qu'il
   * ferme change de forme, et le lieu doit s'en apercevoir. On ne réécrit que
   * ce qui a vraiment changé, sinon on écrirait à chaque rendu.
   */
  useEffect(() => {
    if (!murs) return
    let vivant = true
    void (async () => {
      let touche = false
      for (const f of mu.formes) {
        const lieu = lieuDeLaForme(f)
        if (!lieu) continue
        const avant = JSON.stringify(lieu.zone ?? [])
        const apres = JSON.stringify(f.pts)
        if (avant === apres) continue
        await window.jdr.places.zone(lieu.id, f.pts, lieu.ancre ?? f.centre)
        touche = true
      }
      if (touche && vivant) await onRelire()
    })()
    return () => {
      vivant = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [murs, mu.formes])

  const poser = async (kind: 'repere' | 'texte', x: number, y: number): Promise<void> => {
    const a = await window.jdr.annotations.add({ placeId: p.id, kind, x, y })
    await relire()
    setChoisi(a.id)
    /* L'outil se désarme après usage : sinon on sème un repère à chaque clic,
       y compris quand on voulait seulement en choisir un. */
    setOutil(null)
  }

  return (
    <section className="view">
      <div className="vhead">
        <div>
          <h2 className="fil-ariane">
            <button className="retour" onClick={onFermer}>
              Lieux
            </button>
            <span className="chev">›</span>
            {p.name}
          </h2>
          <p>
            {[
              TIER_LABEL[p.tier],
              p.zone && niveau ? `une zone du plan de ${niveau.name}` : null,
              p.summary
            ]
              .filter(Boolean)
              .join(' · ') || 'Sans description courte.'}
          </p>
        </div>
        <div className="spacer" />
        {p.zone && niveau ? (
          <button
            className="btn btn-ghost"
            onClick={onMurs}
            title="Revoir cette pièce sur le plan de son étage, avec ses murs"
          >
            <IconMurs />
            Voir les murs
          </button>
        ) : null}
        <button
          className={`btn${annote ? ' btn-on' : ''}`}
          disabled={!carte?.url}
          title={
            carte?.url
              ? 'Poser des repères et des textes sur la carte — pour toi seul, jamais pour les joueurs'
              : 'Ce lieu n’a pas de carte à annoter'
          }
          onClick={() => {
            setAnnote((v) => !v)
            setMurs(false)
            setOutil(null)
            setChoisi(null)
          }}
        >
          <IconPen />
          Mode annotation
        </button>
        <button
          className={`btn${murs ? ' btn-on' : ''}`}
          disabled={!carte?.url}
          title={
            carte?.url
              ? 'Tracer les murs invisibles : ce qui arrête le pas et ce qui coupe la vue — jamais montré aux joueurs'
              : 'Ce lieu n’a pas de carte où tracer des murs'
          }
          onClick={() => {
            setMurs((v) => !v)
            setAnnote(false)
            setOutil(null)
            setChoisi(null)
            mu.setChoisi(null)
            mu.setEssai(null)
          }}
        >
          <IconMurs />
          Mode murs
        </button>
      </div>

      <div className={`fiche-lieu${annote || murs ? ' annote' : ''}`}>
        <div className="fl-carte">
          {murs ? (
            <div className="annot-barre murs-barre">
              <BarreMurs m={mu} onFormer={(contour, nom) => void formerPiece(contour, nom)} />
              <AideMurs m={mu} />
            </div>
          ) : null}
          {annote ? (
            <div className="annot-barre">
              <span className="eyebrow">Annoter</span>
              <button
                className={`btn btn-sm${outil === 'repere' ? ' btn-on' : ''}`}
                onClick={() => setOutil(outil === 'repere' ? null : 'repere')}
                title="Puis clique sur la carte pour poser le repère"
              >
                <IconPlus />
                Repère
              </button>
              <button
                className={`btn btn-sm${outil === 'texte' ? ' btn-on' : ''}`}
                onClick={() => setOutil(outil === 'texte' ? null : 'texte')}
                title="Puis clique sur la carte pour poser le texte"
              >
                <IconType />
                Texte
              </button>
              <div className="spacer" />
              <span className="note">
                {outil
                  ? 'Clique sur la carte pour le poser.'
                  : 'Glisse pour déplacer · clique pour écrire · jamais vu des joueurs.'}
              </span>
            </div>
          ) : null}

          {carte?.url ? (
            <div className="fl-lum">
              <IconSoleil />
              <label htmlFor="fl-lum">Luminosité</label>
              <input
                id="fl-lum"
                type="range"
                min={40}
                max={220}
                step={5}
                value={lum}
                onChange={(e) => setLum(Number(e.target.value))}
              />
              <span className="v">{lum} %</span>
              {lum === 100 ? null : (
                <button className="btn btn-sm btn-ghost" onClick={() => setLum(100)}>
                  Rétablir
                </button>
              )}
              <span className="note">Pour y voir — rien n’est enregistré.</span>
            </div>
          ) : null}

          <div className="fl-image">
            {carte?.url ? (
              /* Le cadre prend les proportions de l'image : elle s'affiche
                 entière — ou cadrée sur la zone de la pièce — et les repères
                 tombent exactement dessus. */
              <CadreAnnote
                url={carte.url}
                zoomable={!p.zone}
                zone={p.zone ? boiteDe(p.zone) : null}
              >
                {/* Le filtre ne touche que l'image : repères, murs et pions
                    gardent leurs couleurs, sans quoi on ne les lirait plus. */}
                <img
                  src={carte.url}
                  alt={carte.title}
                  draggable={false}
                  style={lum === 100 ? undefined : { filter: `brightness(${lum}%)` }}
                />
                {annote || liste.length ? (
                  <Annotations
                    annotations={liste}
                    mode={annote ? 'edition' : 'lecture'}
                    outil={outil}
                    choisi={choisi}
                    onChoisir={setChoisi}
                    onPoser={(k, x, y) => void poser(k, x, y)}
                    onDeplacer={async (id, x, y) => {
                      await window.jdr.annotations.move(id, x, y)
                      await relire()
                    }}
                    onEffacer={async (id) => {
                      await window.jdr.annotations.remove(id)
                      setChoisi(null)
                      await relire()
                    }}
                  />
                ) : null}
                {murs ? (
                  <CalqueMurs
                    murs={mu.liste}
                    ouvertures={mu.ouvertures}
                    pourPiece={mu.pourPiece}
                    onPourPiece={mu.setPourPiece}
                    contourPropose={mu.contourPropose}
                    attenteDepart={mu.attenteDepart}
                    onDepart={(x, y) => mu.partirDe(x, y)}
                    formes={mu.formes}
                    formeVisee={mu.formeVisee}
                    nomDeForme={(f) => lieuDeLaForme(f)?.name ?? null}
                    ouvChoisie={mu.ouvChoisie}
                    onOuvChoisie={mu.setOuvChoisie}
                    onPoserOuverture={(murId, n, d) => void mu.poserOuverture(murId, n, d)}
                    onNommer={(f, nom) => void nommerForme(f, nom)}
                    mode="edition"
                    outil={mu.outil}
                    nature={mu.nature}
                    aimant={mu.aimant}
                    loupe={mu.loupe}
                    gomme={mu.gomme}
                    carte={carte.url}
                    choisi={mu.choisi}
                    onChoisir={mu.setChoisi}
                    onPoser={(n, traces, retraits) => void mu.poser(n, traces, retraits)}
                    onCouper={(id, pieces) => void mu.couper(id, pieces)}
                    onDeplacer={(id, pts) => void mu.deplacer(id, pts)}
                    onEffacer={(id) => void mu.effacer(id)}
                    onBasculerPorte={(id) => void mu.basculerPorte(id)}
                    onVerrouiller={(id, v) => void mu.verrouiller(id, v)}
                    onAccorder={(id) => void mu.accorder(id)}
                    onGommer={(retraits) => void mu.gommer(retraits)}
                    onGommeTaille={mu.setGomme}
                    onBrouillard={mu.setNoir}
                    essai={mu.essai}
                    onEssai={mu.setEssai}
                    largeurOuv={mu.largeurDefaut ?? s.reglages.mursLargeur}
                    apercuLum={mu.apercuLum}
                    lumieres={mu.lumieres}
                    lumChoisie={mu.lumChoisie}
                    lumGarde={mu.lumGarde}
                    regardPortee={mu.regardPortee}
                    onLumChoisie={mu.setLumChoisie}
                    onPoserLumiere={(x, y) => void mu.poserLumiere(x, y)}
                    onReglerLumiere={(id, patch) => void mu.reglerLumiere(id, patch)}
                    onOterLumiere={(id) => void mu.oterLumiere(id)}
                  />
                ) : null}
              </CadreAnnote>
            ) : (
              <div className="fl-sans">
                <IconPlace />
                <b>Aucune carte</b>
                Ajoute-lui une carte pour pouvoir l’annoter.
              </div>
            )}
          </div>

        </div>

        <aside className="fl-cote">
          {murs ? (
            <VoletMurs
              m={mu}
              nomDeForme={(f) => lieuDeLaForme(f)?.name ?? null}
              onNommer={(f, nom) => void nommerForme(f, nom)}
              onEffacerPiece={(f) => void effacerPiece(f)}
            />
          ) : annote ? (
            <NoteAnnotation
              a={enCours}
              total={liste.length}
              onEcrire={async (texte) => {
                if (!enCours) return
                await window.jdr.annotations.update(enCours.id, { texte })
                await relire()
              }}
              onCouleur={async (color) => {
                if (!enCours) return
                await window.jdr.annotations.update(enCours.id, { color })
                await relire()
              }}
            />
          ) : (
            <>
              <div className="fl-bloc">
                <span className="eyebrow">Notes du MJ</span>
                <p className={p.notes ? 'texte' : 'vide'}>
                  {p.notes || 'Rien de noté pour l’instant.'}
                </p>
              </div>

              <div className="fl-bloc">
                <span className="eyebrow">Découverte</span>
                <p className={p.seen ? 'texte' : 'vide'}>
                  {p.seen ? 'Le groupe y est passé.' : 'Le groupe n’y a jamais mis les pieds.'}
                </p>
              </div>

              <div className="fl-bloc">
                <span className="eyebrow">Ambiance</span>
                <p className={amb ? 'texte' : 'vide'}>{amb ? amb.title : 'Aucune ambiance.'}</p>
              </div>

              <div className="fl-bloc">
                <span className="eyebrow">Chapitres</span>
                <div className="tagbar">
                  {p.chapterIds.length ? (
                    p.chapterIds.map((cid) => (
                      <span key={cid} className="tag">
                        {shortChapter(s.chapters.find((c) => c.id === cid)?.title ?? '')}
                      </span>
                    ))
                  ) : (
                    <span className="vide">Rattaché à aucun chapitre.</span>
                  )}
                </div>
              </div>

              <div className="fl-bloc">
                <ObjetsDuLieu placeId={p.id} />
              </div>

              <div className="fl-bloc">
                <span className="eyebrow">Documents {docs.length ? `· ${docs.length}` : ''}</span>
                {docs.length ? (
                  <div className="fl-docs">
                    {docs.map((d: Item) => (
                      <button
                        key={d.id}
                        className="doc-row"
                        onClick={() => s.openInEditor(d.id)}
                        title="Ouvrir dans l’éditeur"
                      >
                        {kindIcon(d.kind, 'ico')}
                        <span className="t">
                          <span className="ttl">{d.title}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="vide">Aucun document rattaché.</p>
                )}
              </div>

              {liste.length ? (
                <div className="fl-bloc">
                  <span className="eyebrow">Annotations · {liste.length}</span>
                  <p className="vide">Visibles de toi seul, ici et en régie. Jamais des joueurs.</p>
                </div>
              ) : null}
            </>
          )}
        </aside>
      </div>
    </section>
  )
}

/** Le volet d'écriture d'une annotation : son texte et sa couleur. */
function NoteAnnotation({
  a,
  total,
  onEcrire,
  onCouleur
}: {
  a: Annotation | null
  total: number
  onEcrire: (texte: string) => void | Promise<void>
  onCouleur: (color: string) => void | Promise<void>
}): JSX.Element {
  const [v, setV] = useState('')
  useEffect(() => setV(a?.texte ?? ''), [a?.id, a?.texte])

  if (!a)
    return (
      <div className="fl-bloc">
        <span className="eyebrow">Annotation</span>
        <p className="vide">
          {total
            ? 'Choisis un repère sur la carte pour écrire sa note.'
            : 'Arme « Repère » ou « Texte », puis clique sur la carte.'}
        </p>
        <p className="vide">Rien de ce calque n’est jamais montré aux joueurs.</p>
      </div>
    )

  return (
    <div className="fl-bloc">
      <span className="eyebrow">
        {a.kind === 'repere' ? `Repère ${a.num}` : 'Texte sur la carte'}
      </span>
      <textarea
        className="annot-texte"
        value={v}
        autoFocus
        placeholder={a.kind === 'repere' ? 'Le coffre sous la latte…' : 'Ce qu’on lit ici…'}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => void onEcrire(v)}
      />
      <div className="couleurs">
        {PION_COULEURS.map((c) => (
          <button
            key={c.key}
            className="pastille"
            style={{ ['--p' as string]: c.hex }}
            aria-pressed={(a.color ?? 'brass') === c.key}
            title={c.name}
            onClick={() => void onCouleur(c.key)}
          />
        ))}
      </div>
    </div>
  )
}

/** Les contenants au-dessus d'un lieu, du plus lointain au plus proche. */
function cheminDe(p: Place, tous: Place[]): Place[] {
  const out: Place[] = []
  let cur: Place | undefined = p
  while (cur && cur.parentId !== null) {
    cur = tous.find((q) => q.id === cur!.parentId)
    if (cur) out.unshift(cur)
  }
  return out
}

/** Le dossier d'un fichier, pour situer une carte sans lire tout son chemin. */
function dossierDe(rel: string | null): string {
  const p = rel ?? ''
  const i = p.lastIndexOf('/')
  return i < 0 ? 'racine de la campagne' : p.slice(0, i)
}

/** « I — Ouverture » → « I ». Les pastilles de filtre doivent rester courtes. */
function shortChapter(title: string): string {
  const m = /^\s*([IVXLC]+|\d+)\s*[—–-]/.exec(title)
  return m ? m[1] : title.slice(0, 12)
}
