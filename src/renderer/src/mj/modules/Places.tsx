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
  IconImage,
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
import { ReprendreDUneSeance } from '../components/ReprendreDUneSeance'
import { ObjetsDuLieu } from '../components/ObjetsDuLieu'
import { Annotations, CadreAnnote, type OutilAnnotation } from '../components/Annotations'
import { AideMurs, BarreMurs, CalqueMurs, VoletMurs, useMurs } from '../components/Murs'
import {
  PARENT_TIERS,
  PION_COULEURS,
  TIER_LABEL,
  type Annotation,
  type Item,
  type Place,
  type PlaceTier,
  type PointMur,
  type Zone
} from '@shared/types'
import { boiteDe, centreDe, dansForme, pointInterieur, type Forme } from '@shared/pieces'
import { carreDAngle, mettreDEquerre, type Pt } from '@shared/murs'
import { BoutonEquerre } from '../components/BoutonEquerre'

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
const OUVERT_DABORD: Record<PlaceTier, boolean> = {
  espace: true,
  niveau: false,
  lieu: false
}

/**
 * Un lieu qui tient des niveaux : la chapelle posée sur le plan de
 * l'extérieur, avec sa nef et sa crypte. Il se range comme une pièce et
 * s'affiche comme un espace — une ligne, ses étages dessous.
 */
function estBatiment(p: Place, tous: Place[]): boolean {
  if (p.tier !== 'lieu') return false
  /* Posé à même l'espace, un lieu est un bâtiment — même avant son premier niveau. */
  if (tous.some((q) => q.id === p.parentId && q.tier === 'espace')) return true
  return tous.some((q) => q.parentId === p.id && q.tier === 'niveau')
}

/** L'habitude d'un nœud : un bâtiment montre ses étages, comme un espace. */
const habitude = (p: Place): boolean => (p.tier === 'lieu' ? true : OUVERT_DABORD[p.tier])

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
  const [reprise, setReprise] = useState(false)

  const place = (id: number | null): Place | null =>
    id === null ? null : (s.places.find((p) => p.id === id) ?? null)

  const enfants = (pid: number | null, tier: PlaceTier): Place[] =>
    s.places.filter((p) => p.tier === tier && p.parentId === pid)

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
          p.tier !== 'espace' && (p.parentId === null || !s.places.some((q) => q.id === p.parentId))
      ),
    [s.places]
  )

  /** Est-il ouvert ? Son habitude, à moins qu'on ne l'ait basculé. */
  const estDeplie = (p: Place): boolean => habitude(p) !== bascules.has(p.id)

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
      habitude(p) ? n.delete(p.id) : n.add(p.id)
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
    /* Le niveau d'un bâtiment prend d'abord le morceau du plan où se tient le
       bâtiment : on y trace ses pièces tout de suite, et on lui donne une
       image à lui quand on en a une. */
    const contenant = place(rafale.parentId)
    const herite =
      rafale.tier === 'niveau' && contenant?.tier === 'lieu' && contenant.mapItemId
        ? { mapItemId: contenant.mapItemId, zone: contenant.zone }
        : {}
    const p = await window.jdr.places.upsert({
      tier: rafale.tier,
      parentId: rafale.parentId,
      name: nom,
      ...herite
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
    if (p.tier === 'espace') return decouperEspace(p)
    if (p.tier !== 'niveau' && !estBatiment(p, s.places)) {
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

  /**
   * Découper le plan d'un espace.
   *
   * Les pièces et les bâtiments se rangent dans un niveau, jamais à même
   * l'espace : on trace donc sur un niveau qui porte la même image — celui qui
   * l'a déjà, sinon un niveau sans carte qui la reçoit, sinon un nouveau
   * niveau. L'espace garde son image pour la régie.
   */
  const decouperEspace = async (e: Place): Promise<void> => {
    if (!e.mapItemId) return
    const niveaux = enfants(e.id, 'niveau')
    let n = niveaux.find((q) => q.mapItemId === e.mapItemId) ?? null
    if (!n) {
      const vide = niveaux.find((q) => !q.mapItemId)
      n = vide
        ? await window.jdr.places.upsert({ id: vide.id, name: vide.name, mapItemId: e.mapItemId })
        : await window.jdr.places.upsert({
            tier: 'niveau',
            parentId: e.id,
            name:
              NOMS_DE_NIVEAU.find((nom) => !niveaux.some((q) => q.name === nom)) ?? 'Plan',
            mapItemId: e.mapItemId
          })
      await relire()
      s.toast(`Le plan se découpe dans le niveau « ${n.name} »`)
    }
    deplier(e.id)
    setChoisi(n.id)
    setOuvert(n.id)
    setMurs(n.id)
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
          const cible = estPiece(lieuOuvert) ? place(lieuOuvert.parentId) : lieuOuvert
          if (cible) void ouvrirLesMurs(cible)
        }}
        onRelire={relire}
      />
    )

  const rien = espaces.length === 0 && orphelins.length === 0

  /*
   * Le même rendu sert deux fois : sous son espace, et tout seul en bas quand
   * un niveau n'est rangé nulle part. Sans cela, un étage sans maison devenait
   * une tuile — et ses pièces disparaissaient avec lui.
   */
  const rendreTuiles = (
    tous: Place[],
    niveau: Place | null,
    /** Les tuiles portent-elles leur corbeille ? Seuls les lieux isolés. */
    jetable = false
  ): JSX.Element => {
    /* Un bâtiment sort de la rangée : il a des étages à montrer sous lui. */
    const batiments = tous.filter(
      (l) => estBatiment(l, s.places) || (rafale?.tier === 'niveau' && rafale.parentId === l.id)
    )
    const lieux = tous.filter((l) => !batiments.includes(l))
    return (
      <>
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
          {/* Un lieu d'étage naît sur son plan — tracé au rectangle ou fermé
              par des murs —, plus d'une tuile vide qu'on nomme à l'aveugle. */}
          {niveau ? null : (
            <Ajout
              rafale={rafale}
              parentId={null}
              tier="lieu"
              libelle="un lieu isolé…"
              onArmer={setRafale}
              onCreer={creer}
            />
          )}
        </div>
        {batiments.length ? <div className="batiments">{batiments.map(rendreBatiment)}</div> : null}
      </>
    )
  }

  /**
   * Un bouton d'ajout, posé sur la ligne du contenant : il ouvre la saisie
   * sous lui, et déplie la branche pour qu'on la voie.
   */
  const bouton = (parent: Place, tier: PlaceTier, libelle: string): JSX.Element => {
    const arme = rafale?.parentId === parent.id && rafale.tier === tier
    return (
      <button
        key={tier}
        className={`btn btn-sm${arme ? ' btn-on' : ' btn-ghost'}`}
        title={`Ajouter ${libelle} dans « ${parent.name} »`}
        onClick={(ev) => {
          ev.stopPropagation()
          setRafale(arme ? null : { parentId: parent.id, tier })
          if (!arme) deplier(parent.id)
        }}
      >
        <IconPlus />
        {libelle}
      </button>
    )
  }

  /** Un bâtiment : sa ligne, puis ses étages comme sous un espace. */
  const rendreBatiment = (b: Place): JSX.Element => {
    const deplie = estDeplie(b)
    const niveaux = enfants(b.id, 'niveau')
    return (
      <section key={b.id} className="batiment">
        <Ligne
          p={b}
          deplie={deplie}
          aDesEnfants
          choisi={choisi === b.id}
          onBasculer={() => basculer(b.id)}
          onChoisir={() => setChoisi(b.id)}
          onVu={() => void marquerVu(b)}
          onOuvrir={() => b.mapItemId && setOuvert(b.id)}
          onDeposer={deplacer}
          actions={bouton(b, 'niveau', 'Niveau')}
        />
        {deplie ? (
          <div className="branche">
            {niveaux.map(rendreNiveau)}
            <Ajout
              rafale={rafale}
              parentId={b.id}
              tier="niveau"
              libelle="un niveau…"
              pris={niveaux.map((n) => n.name)}
              seulementArme
              onArmer={setRafale}
              onCreer={creer}
            />
          </div>
        ) : null}
      </section>
    )
  }

  const rendreNiveau = (n: Place): JSX.Element => {
    const deplie = estDeplie(n)
    const lieux = enfants(n.id, 'lieu')
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
    const niveaux = enfants(e.id, 'niveau')
    const batiments = enfants(e.id, 'lieu')
    return (
      <section key={e.id} className="etage">
        <Ligne
          p={e}
          deplie={deplie}
          aDesEnfants={niveaux.length + batiments.length > 0}
          choisi={choisi === e.id}
          onBasculer={() => basculer(e.id)}
          onChoisir={() => setChoisi(e.id)}
          onVu={() => void marquerVu(e)}
          onOuvrir={() => e.mapItemId && setOuvert(e.id)}
          onDeposer={deplacer}
          actions={
            <>
              {bouton(e, 'niveau', 'Niveau')}
              {bouton(e, 'lieu', 'Bâtiment')}
            </>
          }
        />
        {deplie ? (
          <div className="branche">
            {niveaux.map(rendreNiveau)}
            {batiments.map(rendreBatiment)}
            <Ajout
              rafale={rafale}
              parentId={e.id}
              tier="niveau"
              libelle="un niveau…"
              pris={niveaux.map((n) => n.name)}
              seulementArme
              onArmer={setRafale}
              onCreer={creer}
            />
            <Ajout
              rafale={rafale}
              parentId={e.id}
              tier="lieu"
              ligne
              libelle="un bâtiment…"
              indice="Nom du bâtiment…"
              seulementArme
              onArmer={setRafale}
              onCreer={creer}
            />
          </div>
        ) : null}
      </section>
    )
  }

  /* Ce qui traîne hors de l'arbre, chacun rendu selon ce qu'il est. */
  const seuls = orphelins
  const niveauxSeuls = seuls.filter((p) => p.tier === 'niveau')
  const lieuxSeuls = seuls.filter((p) => p.tier === 'lieu')
  const aMontrerSeuls = seuls.length > 0 || (rafale?.parentId === null && rafale.tier === 'lieu')

  return (
    <section className="view">
      <div className="vhead">
        <div>
          <h2>Lieux</h2>
          <p>
            Un espace tient ses niveaux, un niveau tient ses lieux — et un lieu peut être un
            bâtiment, avec ses propres niveaux. Tu construis à gauche, tu remplis à droite.
          </p>
        </div>
        <div className="spacer" />
        {s.sessions.length > 1 ? (
          <button
            className="btn btn-ghost"
            onClick={() => setReprise(true)}
            title="Copier dans cette séance un lieu préparé pour une autre"
          >
            Reprendre d’une autre séance…
          </button>
        ) : null}
        <button className="btn" onClick={() => setRafale({ parentId: null, tier: 'espace' })}>
          <IconPlus />
          Nouvel espace
        </button>
      </div>
      {reprise ? (
        <ReprendreDUneSeance
          nature="lieu"
          onRepris={(id) => setChoisi(id)}
          onClose={() => setReprise(false)}
        />
      ) : null}

      <div className="lieux-grille">
        <div className="arbre-lieux">
          {rien && !rafale ? (
            <div className="empty">
              <b>Aucun lieu</b>
              Un espace, c'est le domaine ; il tient ses bâtiments et ses niveaux ; un niveau tient
              ses lieux. Un lieu qui ne se range nulle part reste seul, c'est très bien aussi.
            </div>
          ) : null}

          {espaces.map(rendreEspace)}

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
          onAjouterNiveau={(p) => {
            setRafale({ parentId: p.id, tier: 'niveau' })
            deplier(p.id)
          }}
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

function peutRanger(src: Place, dst: Place, tous: Place[]): { dedans: boolean; avant: boolean } {
  /* Ranger un niveau dans un bâtiment qu'il tient : une boucle. */
  let cur: Place | undefined = dst
  const vus = new Set<number>()
  while (cur && !vus.has(cur.id)) {
    if (cur.id === src.id) return { dedans: false, avant: false }
    vus.add(cur.id)
    cur = cur.parentId === null ? undefined : tous.find((q) => q.id === cur!.parentId)
  }
  return {
    dedans: PARENT_TIERS[src.tier].includes(dst.tier),
    avant: src.tier === dst.tier && src.id !== dst.id
  }
}

/** Une pièce découpée dans le plan de son étage — pas un niveau de bâtiment cadré. */
function estPiece(p: Place): boolean {
  return p.tier === 'lieu' && !!p.zone
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
  onDeposer: (
    srcId: number,
    parentId: number | null,
    beforeId: number | null
  ) => void | Promise<void>
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
    const ok = peutRanger(src, p, s.places)
    const r = e.currentTarget.getBoundingClientRect()
    const avant = couche ? e.clientX - r.left < r.width * 0.42 : e.clientY - r.top < r.height * 0.34
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
  onDeposer,
  actions
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
  /** Les boutons d'ajout du contenant, posés sur sa ligne. */
  actions?: React.ReactNode
  onDeposer: (
    srcId: number,
    parentId: number | null,
    beforeId: number | null
  ) => void | Promise<void>
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
        {map?.url ? <PlanCadre url={map.url} zone={p.zone} /> : <IconPlace />}
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
      {actions ? <span className="actions-ligne">{actions}</span> : null}
      <span className="eyebrow tier">{p.tier === 'lieu' ? 'Bâtiment' : TIER_LABEL[p.tier]}</span>
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
  onDeposer: (
    srcId: number,
    parentId: number | null,
    beforeId: number | null
  ) => void | Promise<void>
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
  ligne = false,
  indice,
  seulementArme = false,
  onArmer,
  onCreer
}: {
  rafale: Rafale | null
  parentId: number | null
  tier: PlaceTier
  libelle: string
  /** Un lieu qu'on range en ligne et non en tuile : un bâtiment. */
  ligne?: boolean
  /** Ce que le champ suggère, s'il ne s'agit pas du nom de l'étage. */
  indice?: string
  /** Le bouton est ailleurs (sur la ligne du contenant) : ne montrer que la saisie. */
  seulementArme?: boolean
  /** Pour un niveau : les étages déjà montés sous ce contenant. */
  pris?: string[]
  onArmer: (r: Rafale | null) => void
  onCreer: (nom: string) => Promise<void>
}): JSX.Element | null {
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

  if (!armee && seulementArme) return null
  if (!armee)
    return (
      <button
        className={tier === 'lieu' && !ligne ? 'ajout-tuile' : 'ajout'}
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
    <div className={tier === 'lieu' && !ligne ? 'rafale-tuile' : 'rafale'}>
      <span className="vue">⏎ crée · ⎋ arrête</span>
      <input
        ref={champ}
        type="text"
        value={v}
        placeholder={indice ?? `Nom du ${TIER_LABEL[tier].toLowerCase()}…`}
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
  onMurs,
  onAjouterNiveau
}: {
  p: Place | null
  niveau: Place | null
  onRelire: () => Promise<void>
  onEfface: () => void
  onOuvrir: () => void
  onMurs: (p: Place) => void
  /** Ouvrir la saisie d'un niveau sous ce lieu : il devient un bâtiment. */
  onAjouterNiveau: (p: Place) => void
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
          {
            ...cur,
            tier: p.tier,
            parentId: p.parentId,
            zone: p.zone,
            seen: p.seen
          }
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
      seen: v.seen
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
  /* Le son déjà choisi reste dans la liste, même venu d'une autre séance :
     sans lui, le menu s'afficherait vide et mentirait sur ce qui joue. */
  const sons = s.fichiers.filter((i) => i.kind === 'audio' || i.id === f.ambienceItemId)
  const attendus = PARENT_TIERS[f.tier]
  /* Ni lui-même ni ce qu'il tient : un niveau rangé dans son propre bâtiment
     ferait une boucle. */
  const siens = new Set([f.id, ...descendantsDe(f.id, s.places).map((q) => q.id)])
  const contenants = s.places.filter((q) => attendus.includes(q.tier) && !siens.has(q.id))
  const batiment = estBatiment(f, s.places)
  const route = cheminDe(f, s.places)
  /* Une pièce ne se découpe que si son étage a un plan où la tracer. */
  const decoupable = f.tier === 'lieu' && niveau?.mapItemId
  const tenus = siens.size - 1

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
          {f.tier === 'niveau' && f.zone && niveau ? (
            <button className="choix-carte" onClick={() => setChoixCarte(true)}>
              <span className="vue">
                {carte?.url ? <PlanCadre url={carte.url} zone={f.zone} /> : <IconPlace />}
              </span>
              <span className="tx">
                <b>Le plan de {niveau.name}, vu de près</b>
                <span className="ou">Les pièces s’y tracent ; une image à lui la remplace</span>
              </span>
              <span className="btn btn-ghost btn-sm">Son image</span>
            </button>
          ) : f.zone && niveau ? (
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
                const tier = e.target.value as PlaceTier
                /* Niveau et bâtiment s'échangent sans rien perdre : pièces et
                   tracés passent dans un niveau, ou en reviennent. */
                if (tier !== 'espace' && f.tier !== 'espace') {
                  try {
                    await window.jdr.places.etage(f.id, tier)
                    s.toast(
                      tier === 'lieu'
                        ? `« ${f.name} » est un bâtiment — son contenu est dans son niveau`
                        : `« ${f.name} » est un niveau`
                    )
                  } catch (err) {
                    s.toast(err instanceof Error ? err.message : 'Changement impossible', true)
                  }
                  await onRelire()
                  return
                }
                /* Un espace ne se range pas, et ne se range dans rien : le
                   contenant part, la zone avec. */
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
              <option value="lieu">Bâtiment ou lieu — une chapelle, une pièce</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="pl-parent">Rangé dans</label>
            <select
              id="pl-parent"
              value={f.parentId ?? ''}
              disabled={!attendus.length}
              onChange={async (e) => {
                const parentId = e.target.value === '' ? null : Number(e.target.value)
                await window.jdr.places.move(f.id, parentId, null)
                await onRelire()
              }}
            >
              <option value="">
                {attendus.length ? '— rangé nulle part —' : '— un espace ne se range pas —'}
              </option>
              {attendus.map((t) => {
                const ceux = contenants.filter((q) => q.tier === t)
                return ceux.length ? (
                  <optgroup
                    key={t}
                    label={{ espace: 'Espaces', niveau: 'Niveaux', lieu: 'Bâtiments' }[t]}
                  >
                    {ceux.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.name}
                      </option>
                    ))}
                  </optgroup>
                ) : null
              })}
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="pl-amb">Ambiance sonore</label>
          <select
            id="pl-amb"
            value={f.ambienceItemId ?? ''}
            onChange={(e) =>
              patch({
                ambienceItemId: e.target.value === '' ? null : Number(e.target.value)
              })
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

        {f.tier === 'lieu' ? (
          <div className="decouverte">
            <span className="tx">
              <b>{batiment ? 'Un bâtiment' : 'Un bâtiment ?'}</b>
              <span>
                {batiment
                  ? `${s.places.filter((q) => q.parentId === f.id).length} niveau(x) — dépliés sous lui, à gauche.`
                  : 'Une chapelle, une grange : donne-lui ses étages et leurs pièces.'}
              </span>
            </span>
            <button className="btn btn-sm" onClick={() => onAjouterNiveau(f)}>
              <IconPlus />
              Un niveau
            </button>
          </div>
        ) : null}

        {/* Ce qu'on trouve dans la pièce. On la prépare ici, l'objet se pose
            ici : plus besoin d'aller le désigner depuis la réserve. */}
        <div className="field">
          <ObjetsDuLieu placeId={f.id} />
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
        {f.tier === 'niveau' || f.tier === 'espace' ? (
          <button
            className="btn btn-brass"
            disabled={!f.mapItemId}
            title={
              f.mapItemId
                ? 'Tracer les murs sur le plan, puis former les lieux et les bâtiments qu’ils referment'
                : 'Donne-lui d’abord une carte'
            }
            onClick={() => onMurs(f)}
          >
            <IconMurs />
            Découper en lieux
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
          {confirme ? `Vraiment${tenus ? ` — et ses ${tenus} lieux` : ''} ?` : 'Supprimer'}
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
            const avant = f.mapItemId
            patch({ mapItemId: id, zone: null })
            setChoixCarte(false)
            void suivreLaCarte(f, avant, id, s.places).then((n) => (n ? onRelire() : undefined))
          }}
          onClose={() => setChoixCarte(false)}
        />
      )}
    </aside>
  )
}

/**
 * Les pièces découpées sur un plan en partagent l'image : quand l'étage en
 * change, elles suivent. Sans quoi chacune garderait l'ancienne, et ses murs,
 * posés en coordonnées du plan, tomberaient sur un autre dessin. Rend le
 * nombre de pièces emportées.
 */
async function suivreLaCarte(
  plan: Place,
  ancienne: number | null,
  nouvelle: number | null,
  places: Place[]
): Promise<number> {
  if (ancienne === nouvelle || nouvelle === null) return 0
  const pieces = places.filter((q) => q.parentId === plan.id && q.zone && q.mapItemId === ancienne)
  for (const q of pieces)
    await window.jdr.places.upsert({
      id: q.id,
      name: q.name,
      mapItemId: nouvelle
    })
  return pieces.length
}

/**
 * Deux images aux proportions différentes : murs, ouvertures et repères sont
 * en fractions de la carte, ils s'étireraient avec elle. Faute de mesure
 * (examen pas encore passé), on ne sait pas — et on ne crie pas au loup.
 */
function proportionsDifferent(a: Item | undefined, b: Item | undefined): boolean {
  if (!a?.width || !a.height || !b?.width || !b.height) return false
  return Math.abs(a.width / a.height / (b.width / b.height) - 1) > 0.02
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
  /** Le pion d'essai est posé, ou l'on attend son point de départ. */
  const enTest = mu.essai !== null || mu.attenteDepart
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
  const [remplacer, setRemplacer] = useState(false)
  /**
   * Un geste au rectangle sur la carte : garder ce cadre de l'image, ou
   * faire un lieu de ce qu'on vient d'entourer.
   */
  const [trace, setTrace] = useState<'rogner' | 'lieu' | null>(null)
  /**
   * Pendant le test : voit-on les murs, ou la carte comme les joueurs —
   * l'ombre seule ? C'est la bascule « Voir ce qu'ils voient » de la régie.
   */
  const [mursVisibles, setMursVisibles] = useState(true)
  const [rect, setRect] = useState<Zone | null>(null)
  const [nomLieu, setNomLieu] = useState('')
  const [occupe, setOccupe] = useState(false)

  const finirTrace = (): void => {
    setTrace(null)
    setRect(null)
    setNomLieu('')
  }

  /** Rogner : une copie de l'image, réduite au cadre ; murs et pions recalés. */
  const rogner = async (): Promise<void> => {
    if (!rect || occupe) return
    setOccupe(true)
    try {
      await window.jdr.places.rogner(p.id, rect)
      finirTrace()
      await onRelire()
      s.toast('Image rognée — une copie, l’originale reste dans son dossier')
    } catch (e) {
      s.toast(e instanceof Error ? e.message : 'Rognage impossible', true)
    } finally {
      setOccupe(false)
    }
  }

  /**
   * Un lieu au rectangle : il naît dans cet étage, avec ce cadre pour contour.
   * On reste en tracé — un étage se monte pièce après pièce.
   */
  const creerAuRectangle = async (): Promise<void> => {
    const nom = nomLieu.trim()
    if (!rect || !nom || occupe) return
    setOccupe(true)
    try {
      if (!(await enEtage())) return
      const contour: PointMur[] = [
        [rect.x, rect.y],
        [rect.x + rect.w, rect.y],
        [rect.x + rect.w, rect.y + rect.h],
        [rect.x, rect.y + rect.h]
      ]
      const neuf = await window.jdr.places.upsert({ tier: 'lieu', parentId: p.id, name: nom })
      await window.jdr.places.zone(neuf.id, contour, pointInterieur(contour))
      setRect(null)
      setNomLieu('')
      await onRelire()
      s.toast(`« ${nom} » tracé sur ${p.name}`)
    } finally {
      setOccupe(false)
    }
  }

  const carte = s.allItems.find((i) => i.id === p.mapItemId)
  /* Une pièce découpée n'a pas d'image à elle : c'est celle de son étage
     qu'on remplace, et toutes ses sœurs suivent. */
  const plan = estPiece(p) && niveau ? niveau : p

  /**
   * Remplacer l'image sans rien défaire : murs, portes, fenêtres et repères
   * appartiennent au lieu, pas au fichier — ils restent où ils sont. C'est
   * le geste pour la version éclairée d'un plan, celle sans les meubles, ou
   * une meilleure définition du même dessin.
   */
  const remplacerImage = async (id: number | null): Promise<void> => {
    setRemplacer(false)
    if (id === null || id === plan.mapItemId) return
    const avant = s.allItems.find((i) => i.id === plan.mapItemId)
    const apres = s.allItems.find((i) => i.id === id)
    if (
      proportionsDifferent(avant, apres) &&
      !confirm(
        `« ${apres?.title} » n’a pas les proportions de l’image actuelle (${avant?.width}×${avant?.height} contre ${apres?.width}×${apres?.height}).

Les murs, les ouvertures et les repères suivront l’image en s’étirant avec elle. Remplacer quand même ?`
      )
    )
      return
    /* Le niveau d'un bâtiment qui reçoit son image cesse d'être un morceau du
       plan d'en bas. */
    await window.jdr.places.upsert({
      id: plan.id,
      name: plan.name,
      mapItemId: id,
      ...(plan.tier === 'niveau' && plan.zone ? { zone: null } : {})
    })
    const n = await suivreLaCarte(plan, plan.mapItemId, id, s.places)
    await onRelire()
    s.toast(
      `Image remplacée — murs et repères conservés${n ? `, ${n} pièce${n > 1 ? 's' : ''} suivent` : ''}`
    )
  }
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
    if (!(await enEtage())) return
    const deja = lieuDeLaForme(f)
    if (deja) {
      await window.jdr.places.upsert({
        id: deja.id,
        name: nom,
        tier: 'lieu',
        parentId: p.id
      })
      await window.jdr.places.zone(deja.id, f.pts, f.centre)
    } else {
      const neuf = await window.jdr.places.upsert({
        tier: 'lieu',
        parentId: p.id,
        name: nom
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
    if (!(await enEtage())) return
    const neuf = await window.jdr.places.upsert({
      tier: 'lieu',
      parentId: p.id,
      name: nom
    })
    await window.jdr.places.zone(neuf.id, contour, pointInterieur(contour))
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
  const enEtage = async (): Promise<boolean> => {
    if (p.tier === 'niveau') return true
    /* Un espace ne tient pas de pièces : « Découper en lieux », dans son
       volet, passe par l'un de ses niveaux. */
    if (p.tier === 'espace') {
      s.toast(
        'Un espace ne tient pas de lieux : découpe-le depuis son volet, il passera par un niveau',
        true
      )
      return false
    }
    /* Un bâtiment a déjà ses étages : c'est sur l'un d'eux qu'une pièce se trace. */
    if (estBatiment(p, s.places)) {
      s.toast('Ce lieu est un bâtiment : trace ses pièces sur l’un de ses niveaux', true)
      return false
    }
    await window.jdr.places.upsert({
      id: p.id,
      tier: 'niveau',
      parentId: niveau?.tier === 'espace' ? niveau.id : null,
      name: p.name,
      zone: null
    })
    await onRelire()
    return true
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
      /* Un lieu nommé avant que l'ancre tombe toujours dedans — un couloir en
         L, ancré à son centre de gravité, hors de lui — ne retrouvait plus sa
         pièce. On le raccroche à un point de son propre contour. */
      for (const q of pieces)
        if (q.zone && q.ancre && !dansForme(q.ancre, q.zone)) {
          await window.jdr.places.zone(q.id, q.zone, pointInterieur(q.zone))
          touche = true
        }
      /* Les lieux dont la forme vient de changer, avec leur contour d'avant. */
      const changes: { lieu: Place; avant: PointMur[] }[] = []
      for (const f of mu.formes) {
        const lieu = lieuDeLaForme(f)
        if (!lieu) continue
        const avant = JSON.stringify(lieu.zone ?? [])
        const apres = JSON.stringify(f.pts)
        if (avant === apres) continue
        if (lieu.zone) changes.push({ lieu, avant: lieu.zone })
        await window.jdr.places.zone(lieu.id, f.pts, lieu.ancre ?? f.centre)
        touche = true
      }

      /*
       * Un mur qui traverse un lieu le **coupe en deux** : le lieu garde la
       * moitié où l'on l'avait nommé, et l'autre moitié devient un lieu à
       * part — au lieu de rester une forme sans nom, qu'on prenait pour un
       * lieu qui rétrécit. On la nomme d'après le lieu coupé ; un clic sur
       * sa pastille, ou le volet, la rebaptise.
       */
      if (p.tier === 'niveau')
        for (const f of mu.formes) {
          if (lieuDeLaForme(f)) continue
          const parent = changes.find((c) => dansForme(f.centre, c.avant))
          if (!parent) continue
          const neuf = await window.jdr.places.upsert({
            tier: 'lieu',
            parentId: p.id,
            name: `${parent.lieu.name} (suite)`
          })
          await window.jdr.places.zone(neuf.id, f.pts, f.centre)
          s.toast(`Le mur coupe « ${parent.lieu.name} » : l’autre moitié est « ${neuf.name} »`)
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
        {estPiece(p) && niveau ? (
          <button
            className="btn btn-ghost"
            onClick={onMurs}
            title="Revoir cette pièce sur le plan de son étage, avec ses murs"
          >
            <IconMurs />
            Voir les murs
          </button>
        ) : null}
        {plan.mapItemId ? (
          <button
            className="btn btn-ghost"
            onClick={() => setRemplacer(true)}
            title={
              plan === p
                ? 'Mettre une autre image sous les mêmes murs, fenêtres et repères'
                : `Remplacer l’image du plan de ${plan.name} — ses murs, ses fenêtres et ses pièces restent en place`
            }
          >
            <IconImage />
            Remplacer l’image
          </button>
        ) : null}
        {carte?.url && !estPiece(p) ? (
          <button
            className={`btn${trace === 'rogner' ? ' btn-on' : ''}`}
            disabled={enTest}
            title="Garder un morceau de l’image — une copie rognée, l’originale ne bouge pas"
            onClick={() => {
              const v = trace === 'rogner' ? null : 'rogner'
              finirTrace()
              setTrace(v)
              setAnnote(false)
              setMurs(false)
            }}
          >
            <IconCadrage />
            Rogner
          </button>
        ) : null}
        {carte?.url && !estPiece(p) && p.tier !== 'espace' ? (
          <button
            className={`btn${trace === 'lieu' ? ' btn-on' : ''}`}
            disabled={enTest}
            title="Entourer un rectangle sur la carte : il devient un lieu de cet étage"
            onClick={() => {
              const v = trace === 'lieu' ? null : 'lieu'
              finirTrace()
              setTrace(v)
              setAnnote(false)
              setMurs(false)
            }}
          >
            <IconPlus />
            Tracer un lieu
          </button>
        ) : null}
        <button
          className={`btn${annote ? ' btn-on' : ''}`}
          disabled={!carte?.url || enTest}
          title={
            carte?.url
              ? 'Poser des repères et des textes sur la carte — pour toi seul, jamais pour les joueurs'
              : 'Ce lieu n’a pas de carte à annoter'
          }
          onClick={() => {
            setAnnote((v) => !v)
            setMurs(false)
            finirTrace()
            setOutil(null)
            setChoisi(null)
          }}
        >
          <IconPen />
          Mode annotation
        </button>
        <button
          className={`btn${(enTest ? mursVisibles : murs) ? ' btn-on' : ''}`}
          disabled={!carte?.url}
          title={
            !carte?.url
              ? 'Ce lieu n’a pas de carte où tracer des murs'
              : enTest
                ? mursVisibles
                  ? 'Cacher les murs : tester la carte comme les joueurs la voient, l’ombre seule'
                  : 'Montrer les murs pendant le test'
                : 'Tracer les murs invisibles : ce qui arrête le pas et ce qui coupe la vue — jamais montré aux joueurs'
          }
          onClick={() => {
            /* En test, le bouton ne quitte rien : il montre ou cache les murs,
               comme « Voir ce qu'ils voient » en régie. */
            if (enTest) {
              setMursVisibles((v) => !v)
              return
            }
            setMurs((v) => !v)
            setAnnote(false)
            finirTrace()
            setOutil(null)
            setChoisi(null)
            mu.setChoisi(null)
            mu.setEssai(null)
          }}
        >
          <IconMurs />
          Mode murs
        </button>
        {/* Entrer dans le test et en sortir sont deux gestes contraires : ils ne
            se ressemblent pas. Vert on essaie, rouge on s'arrête. Le test se
            fait sur le calque des murs : on y passe s'il n'est pas ouvert. */}
        {carte?.url ? (
          <button
            className={`btn ${mu.essai !== null || mu.attenteDepart ? 'btn-sortie' : 'btn-essai'}`}
            title={
              mu.essai !== null || mu.attenteDepart
                ? 'Ranger le pion et revenir au tracé des murs'
                : 'Poser un pion d’essai : il ne traverse pas, et il ne voit que ce que les murs lui laissent voir'
            }
            onClick={() => {
              if (mu.essai !== null || mu.attenteDepart) {
                mu.arreterEssai()
                return
              }
              /* On reste où l'on est : en mode murs, on teste murs visibles ;
                 ailleurs, comme les joueurs, l'ombre seule. Le bouton « Mode
                 murs » bascule ensuite de l'un à l'autre. */
              setAnnote(false)
              setOutil(null)
              setChoisi(null)
              finirTrace()
              setMursVisibles(murs)
              /* Une pièce à moitié désignée n'a rien à faire dans un test. */
              mu.setPourPiece(null)
              void mu.commencerEssai()
            }}
          >
            {enTest ? 'Quitter le test' : 'Tester lieu avec un pion'}
          </button>
        ) : null}
      </div>

      <div className={`fiche-lieu${annote || murs || trace ? ' annote' : ''}`}>
        <div className="fl-carte">
          {trace ? (
            <div className="annot-barre">
              <span className="eyebrow">{trace === 'rogner' ? 'Rogner' : 'Tracer un lieu'}</span>
              {!rect ? (
                <span className="note">
                  {trace === 'rogner'
                    ? 'Glisse sur la carte pour entourer ce que tu gardes.'
                    : 'Glisse sur le vide pour entourer un lieu · glisse un lieu pour le déplacer · tire ses coins · double-clic sur un bord ajoute un coin.'}
                </span>
              ) : trace === 'rogner' ? (
                <>
                  <button
                    className="btn btn-sm btn-brass"
                    disabled={occupe}
                    onClick={() => void rogner()}
                  >
                    <IconCheck />
                    Rogner à ce cadre
                  </button>
                  <span className="note">
                    Une copie « (rognée) » à côté de l’originale ; murs, lampes, pions et repères
                    suivent.
                  </span>
                </>
              ) : (
                <>
                  <input
                    className="trace-nom"
                    type="text"
                    autoFocus
                    value={nomLieu}
                    placeholder="Nom du lieu…"
                    onChange={(e) => setNomLieu(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        void creerAuRectangle()
                      } else if (e.key === 'Escape') setRect(null)
                    }}
                  />
                  <button
                    className="btn btn-sm btn-brass"
                    disabled={!nomLieu.trim() || occupe}
                    onClick={() => void creerAuRectangle()}
                  >
                    <IconCheck />
                    Créer
                  </button>
                </>
              )}
              <div className="spacer" />
              <button className="btn btn-sm btn-ghost" onClick={finirTrace}>
                <IconClose />
                Fermer
              </button>
            </div>
          ) : null}
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
                {trace === 'rogner' ? (
                  <CalqueRectangle rect={rect} assombrir onRect={setRect} />
                ) : null}
                {trace === 'lieu' ? (
                  <CalqueLieux
                    lieux={pieces}
                    rect={rect}
                    onRect={setRect}
                    onContour={async (id, pts) => {
                      const q = pieces.find((x) => x.id === id)
                      const ancre = q?.ancre && dansForme(q.ancre, pts) ? q.ancre : pointInterieur(pts)
                      await window.jdr.places.zone(id, pts, ancre)
                      await onRelire()
                    }}
                  />
                ) : null}
                {/* Le test se joue sur ce calque, avec ou sans le mode murs. */}
                {murs || enTest ? (
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
                    joindre={mu.joindre}
                    onJoindreFini={() => mu.setJoindre(false)}
                    traitsCaches={enTest && !mursVisibles}
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

      {remplacer && (
        <ChoixDansArbre
          titre={`Remplacer l’image — ${plan.name}`}
          icone={<IconImage />}
          kinds={['image']}
          rendu="vignettes"
          courant={plan.mapItemId}
          onPick={(id) => void remplacerImage(id)}
          onClose={() => setRemplacer(false)}
        />
      )}
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

/**
 * Les lieux d'un étage, sur son plan : on en entoure un nouveau au rectangle,
 * ou l'on clique un lieu pour tirer ses coins.
 *
 * Un coin pris reste choisi, et un bouton propose de le **mettre d'équerre** :
 * ses deux côtés deviennent perpendiculaires, ses voisins ne bougent pas. La
 * géométrie se fait en pixels de mise en page — un angle droit en fractions
 * ne l'est pas sur une carte qui n'est pas carrée.
 */
function CalqueLieux({
  lieux,
  rect,
  onRect,
  onContour
}: {
  lieux: Place[]
  rect: Zone | null
  onRect: (r: Zone | null) => void
  onContour: (id: number, pts: PointMur[]) => void | Promise<void>
}): JSX.Element {
  const hote = useRef<HTMLDivElement>(null)
  const [taille, setTaille] = useState({ w: 0, h: 0 })
  const [choisi, setChoisi] = useState<number | null>(null)
  const [coin, setCoin] = useState<number | null>(null)
  /** Le contour qu'on tire, en pixels, avant de l'écrire. */
  const [tire, setTire] = useState<Pt[] | null>(null)
  const prise = useRef<{
    quoi: 'coin' | 'rect' | 'tout'
    de: Pt
    /** Pour un lieu qu'on déplace en entier : lequel, et son contour au départ. */
    id?: number
    base?: Pt[]
  } | null>(null)
  const [enCours, setEnCours] = useState<Zone | null>(null)

  useEffect(() => {
    const el = hote.current
    if (!el) return
    const lire = (): void => setTaille({ w: el.clientWidth, h: el.clientHeight })
    lire()
    const ro = new ResizeObserver(lire)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { w, h } = taille
  const enPx = (q: PointMur): Pt => ({ x: q[0] * w, y: q[1] * h })
  const enFrac = (q: Pt): PointMur => [w ? q.x / w : 0, h ? q.y / h : 0]
  const position = (e: { clientX: number; clientY: number }): Pt => {
    const b = hote.current!.getBoundingClientRect()
    return {
      x: Math.min(w, Math.max(0, ((e.clientX - b.left) / b.width) * w)),
      y: Math.min(h, Math.max(0, ((e.clientY - b.top) / b.height) * h))
    }
  }

  const avecZone = lieux.filter((l) => l.zone && l.zone.length >= 3)
  const lieu = avecZone.find((l) => l.id === choisi) ?? null
  const pts = tire ?? (lieu ? lieu.zone!.map(enPx) : null)

  /** Les deux voisins d'un coin : le contour est fermé, on fait le tour. */
  const voisins = (i: number, liste: Pt[]): [Pt, Pt] => [
    liste[(i - 1 + liste.length) % liste.length],
    liste[(i + 1) % liste.length]
  ]

  const equerrer = (): void => {
    if (!lieu || coin === null || !pts) return
    const [a, b] = voisins(coin, pts)
    const v = mettreDEquerre(pts[coin], a, b)
    void onContour(
      lieu.id,
      pts.map((q, i) => enFrac(i === coin ? v : q))
    )
  }

  /** Retirer le coin choisi : il en faut trois pour faire un lieu. */
  const supprimerCoin = (): void => {
    if (!lieu || coin === null || !pts || pts.length <= 3) return
    void onContour(
      lieu.id,
      pts.filter((_, i) => i !== coin).map(enFrac)
    )
    setCoin(null)
  }

  /* Suppr retire le coin choisi, comme pour un sommet de mur. */
  useEffect(() => {
    if (coin === null) return
    const h = (e: KeyboardEvent): void => {
      const cible = e.target as HTMLElement | null
      if (cible && /^(INPUT|TEXTAREA|SELECT)$/.test(cible.tagName)) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        supprimerCoin()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  const boite = (a: Pt, b: Pt): Zone => ({
    x: Math.min(a.x, b.x) / (w || 1),
    y: Math.min(a.y, b.y) / (h || 1),
    w: Math.abs(a.x - b.x) / (w || 1),
    h: Math.abs(a.y - b.y) / (h || 1)
  })

  let bouton: JSX.Element | null = null
  if (lieu && coin !== null && pts && pts[coin] && !tire) {
    const [a, b] = voisins(coin, pts)
    const v = pts[coin]
    const ax = a.x - v.x
    const ay = a.y - v.y
    const bx = b.x - v.x
    const by = b.y - v.y
    const droit =
      Math.abs((ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by) || 1)) < 0.002
    bouton = (
      <BoutonEquerre
        hote={hote}
        sommet={v}
        droit={droit}
        quoi="coin"
        onEquerre={equerrer}
        onSupprimer={pts.length > 3 ? supprimerCoin : undefined}
      />
    )
  }

  const r = enCours ?? rect
  return (
    <div
      ref={hote}
      className="calque-rect contours-lieux"
      onPointerDown={(e) => {
        if (e.button !== 0) return
        e.stopPropagation()
        const q = position(e)
        /* Un coin du lieu choisi : on le prend. */
        if (lieu && pts) {
          const i = pts.findIndex((c) => Math.hypot(c.x - q.x, c.y - q.y) < 12)
          if (i >= 0) {
            e.currentTarget.setPointerCapture(e.pointerId)
            prise.current = { quoi: 'coin', de: q }
            setCoin(i)
            setTire(pts)
            return
          }
        }
        /* Un lieu : on le choisit, et on le tient — il suit le pointeur en entier. */
        const vise = [...avecZone].reverse().find((l) => dansForme(enFrac(q), l.zone!))
        if (vise) {
          setChoisi(vise.id)
          setCoin(null)
          onRect(null)
          const base = vise.zone!.map(enPx)
          e.currentTarget.setPointerCapture(e.pointerId)
          prise.current = { quoi: 'tout', de: q, id: vise.id, base }
          return
        }
        /* Ailleurs : un nouveau rectangle. */
        setChoisi(null)
        setCoin(null)
        e.currentTarget.setPointerCapture(e.pointerId)
        prise.current = { quoi: 'rect', de: q }
        setEnCours(null)
      }}
      onDoubleClick={(e) => {
        /* Double-clic sur un bord du lieu choisi : un coin de plus, pris aussitôt. */
        if (!lieu || !pts) return
        const q = position(e)
        let k = -1
        let court = 12
        let proj: Pt | null = null
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i]
          const b = pts[(i + 1) % pts.length]
          const dx = b.x - a.x
          const dy = b.y - a.y
          const t = Math.max(
            0,
            Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / (dx * dx + dy * dy || 1))
          )
          const r = { x: a.x + t * dx, y: a.y + t * dy }
          const d = Math.hypot(q.x - r.x, q.y - r.y)
          if (d < court && Math.hypot(r.x - a.x, r.y - a.y) > 6 && Math.hypot(r.x - b.x, r.y - b.y) > 6) {
            court = d
            k = i
            proj = r
          }
        }
        if (k < 0 || !proj) return
        e.preventDefault()
        const suite = [...pts.slice(0, k + 1), proj, ...pts.slice(k + 1)]
        setCoin(k + 1)
        void onContour(lieu.id, suite.map(enFrac))
      }}
      onPointerMove={(e) => {
        const t = prise.current
        if (!t) return
        const q = position(e)
        if (t.quoi === 'coin' && tire && coin !== null)
          setTire(tire.map((c, i) => (i === coin ? q : c)))
        else if (t.quoi === 'tout' && t.base)
          setTire(t.base.map((c) => ({ x: c.x + q.x - t.de.x, y: c.y + q.y - t.de.y })))
        else if (t.quoi === 'rect') setEnCours(boite(t.de, q))
      }}
      onPointerUp={(e) => {
        const t = prise.current
        prise.current = null
        if (!t) return
        if (t.quoi === 'tout') {
          if (tire && t.id != null) {
            const q = position(e)
            if (Math.hypot(q.x - t.de.x, q.y - t.de.y) > 2) void onContour(t.id, tire.map(enFrac))
          }
          setTire(null)
          return
        }
        if (t.quoi === 'coin') {
          if (lieu && tire) {
            const bouge = tire.some((c, i) => {
              const avant = enPx(lieu.zone![i])
              return Math.hypot(c.x - avant.x, c.y - avant.y) > 0.5
            })
            if (bouge) void onContour(lieu.id, tire.map(enFrac))
          }
          setTire(null)
          return
        }
        const b = boite(t.de, position(e))
        setEnCours(null)
        if (b.w > 0.01 && b.h > 0.01) onRect(b)
      }}
    >
      <svg width={w} height={h} viewBox={`0 0 ${Math.max(1, w)} ${Math.max(1, h)}`} aria-hidden="true">
        {avecZone.map((l) => {
          const c = l.id === choisi && pts ? pts : l.zone!.map(enPx)
          const centre = enPx(pointInterieur(l.zone!))
          return (
            <g key={l.id} className={`contour${l.id === choisi ? ' on' : ''}`}>
              <polygon points={c.map((q) => `${q.x},${q.y}`).join(' ')} />
              {equerres(c).map((d, i) => (
                <path key={i} d={d} className="angle-droit" />
              ))}
              <text x={centre.x} y={centre.y}>
                {l.name}
              </text>
            </g>
          )
        })}
        {pts
          ? pts.map((q, i) => (
              <circle
                key={i}
                cx={q.x}
                cy={q.y}
                r={5.5}
                className={`poignee${i === coin ? ' on' : ''}`}
              />
            ))
          : null}
        {r ? (
          <rect
            className="cadre"
            x={r.x * w}
            y={r.y * h}
            width={r.w * w}
            height={r.h * h}
          />
        ) : null}
      </svg>
      {bouton}
    </div>
  )
}

/**
 * Les petits carrés des angles droits d'un contour fermé, en chemins SVG.
 *
 * On les dessine plutôt que de les laisser deviner : un coin qu'on vient de
 * tirer à la main se voit d'équerre — ou pas — d'un coup d'œil. La tolérance
 * est d'environ un demi-degré, en pixels comme tout ce qui est angle.
 */
function equerres(pts: Pt[]): string[] {
  const n = pts.length
  if (n < 3) return []
  return pts
    .map((v, i) => carreDAngle(v, pts[(i - 1 + n) % n], pts[(i + 1) % n]))
    .filter((d): d is string => !!d)
}

/**
 * Entourer un rectangle sur la carte, en fractions de l'image entière.
 *
 * Le calque se pose dans le cadre de la carte, comme les repères : il suit
 * le zoom, et ce qu'on y lit tombe en coordonnées du plan. Un rectangle trop
 * petit pour être voulu — un clic — ne compte pas.
 */
function CalqueRectangle({
  rect,
  assombrir,
  onRect
}: {
  rect: Zone | null
  /** Rogner : ce qu'on ne garde pas s'assombrit. */
  assombrir: boolean
  onRect: (r: Zone | null) => void
}): JSX.Element {
  const depart = useRef<PointMur | null>(null)
  const [enCours, setEnCours] = useState<Zone | null>(null)

  const lire = (e: React.PointerEvent<HTMLDivElement>): PointMur => {
    const b = e.currentTarget.getBoundingClientRect()
    return [
      Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)),
      Math.min(1, Math.max(0, (e.clientY - b.top) / b.height))
    ]
  }
  const boite = (a: PointMur, b: PointMur): Zone => ({
    x: Math.min(a[0], b[0]),
    y: Math.min(a[1], b[1]),
    w: Math.abs(a[0] - b[0]),
    h: Math.abs(a[1] - b[1])
  })

  const r = enCours ?? rect
  return (
    <div
      className="calque-rect"
      onPointerDown={(e) => {
        if (e.button !== 0) return
        e.stopPropagation()
        e.currentTarget.setPointerCapture(e.pointerId)
        depart.current = lire(e)
        setEnCours(null)
      }}
      onPointerMove={(e) => {
        if (depart.current) setEnCours(boite(depart.current, lire(e)))
      }}
      onPointerUp={(e) => {
        if (!depart.current) return
        const b = boite(depart.current, lire(e))
        depart.current = null
        setEnCours(null)
        if (b.w > 0.01 && b.h > 0.01) onRect(b)
      }}
    >
      {r ? (
        <svg viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
          {assombrir ? (
            <path
              className="hors"
              fillRule="evenodd"
              d={`M0 0H1V1H0Z M${r.x} ${r.y}h${r.w}v${r.h}h${-r.w}Z`}
            />
          ) : null}
          <rect className="cadre" x={r.x} y={r.y} width={r.w} height={r.h} />
        </svg>
      ) : null}
    </div>
  )
}

/** Tout ce qu'un lieu tient, à toutes les profondeurs. */
function descendantsDe(id: number, tous: Place[]): Place[] {
  const out: Place[] = []
  const pile = [id]
  const vus = new Set<number>([id])
  while (pile.length) {
    const pid = pile.shift()!
    for (const q of tous)
      if (q.parentId === pid && !vus.has(q.id)) {
        vus.add(q.id)
        out.push(q)
        pile.push(q.id)
      }
  }
  return out
}

/** Le dossier d'un fichier, pour situer une carte sans lire tout son chemin. */
function dossierDe(rel: string | null): string {
  const p = rel ?? ''
  const i = p.lastIndexOf('/')
  return i < 0 ? 'racine de la campagne' : p.slice(0, i)
}
