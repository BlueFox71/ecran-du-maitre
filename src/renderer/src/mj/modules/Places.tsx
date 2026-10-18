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
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Valeur } from '../components/Valeur'
import { urlPortraitMj } from '../../shared/avatarsMj'
import { nomDuMj } from '@shared/reglages'
import { createPortal } from 'react-dom'
import { useStore } from '../store'
import {
  IconAudio,
  IconCadrage,
  IconCoffre,
  IconPorte,
  IconRegle,
  IconCercle,
  IconNote,
  IconCheck,
  IconChevron,
  IconDoc,
  IconAimant,
  IconGomme,
  IconImage,
  IconLoupe,
  IconMurs,
  IconPen,
  IconPlace,
  glypheObjet,
  IconPlus,
  IconSoleil,
  IconSouris,
  IconTrash,
  IconType,
} from '../components/Icons'
import { ChoixDansArbre } from '../components/ChoixDansArbre'
import { Pop } from '../components/Pop'
import { ReprendreDUneSeance } from '../components/ReprendreDUneSeance'
import { ObjetsDuLieu } from '../components/ObjetsDuLieu'
import { Annotations, CadreAnnote, type OutilAnnotation } from '../components/Annotations'
import {
  AideMurs,
  BarreLumiere,
  BarreOuverture,
  BoutonTestLumiere,
  FormerPiece,
  BarreTrait,
  CalqueMurs,
  VoletMurs,
  useMurs,
  type OngletMurs
} from '../components/Murs'
import {
  PARENT_TIERS,
  PION_COULEURS,
  TIER_LABEL,
  ventDe,
  type Annotation,
  type Astre,
  type EchellePlan,
  type Item,
  type Objet,
  type ObjetPlacement,
  type Place,
  type PlaceTier,
  type PointMur,
  type Zone
} from '@shared/types'
import { ALLURE_DEFAUT, ALLURE_MAX, ALLURE_MIN } from '@shared/types'
import { boiteDe, centreDe, dansForme, pointInterieur, type Forme } from '@shared/pieces'
import { barrieres, carreDAngle, mettreDEquerre, pasContraint, type Pt } from '@shared/murs'
import { BoutonEquerre } from '../components/BoutonEquerre'
import { FicheDuLieu, GLISSE_OBJET, QuiQuoiDuLieu } from '../components/FicheDuLieu'
import { ApercuDuCiel } from '../components/ApercuDuCiel'
import { SuiteAriane } from '../components/SuiteAriane'
import { CalqueSons, VoletSons, useSonsDEssai, useZonesSon } from '../components/CalqueSons'

/** Ce qu'on est en train de créer à la chaîne, et sous quel contenant. */
type Rafale = { parentId: number | null; tier: PlaceTier }

/**
 * L'habitude de chaque étage à l'ouverture du module.
 *
 * Tout est déplié en arrivant : espaces, bâtiments, niveaux et leurs pièces.
 * Ce qu'on replie à la main le reste d'une visite à l'autre — voir
 * `bascules`.
 */
const OUVERT_DABORD: Record<PlaceTier, boolean> = {
  espace: true,
  niveau: true,
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

export function Places({
  plans = false
}: {
  /** La page « Plans » : seulement les lieux qui ont un plan, en vignettes. */
  plans?: boolean
} = {}): JSX.Element {
  const s = useStore()
  const [choisi, setChoisi] = useState<number | null>(null)
  /** Le lieu dont l'éditeur de plan est ouvert ; la liste disparaît tant qu'il l'est. */
  const [ouvert, setOuvert] = useState<number | null>(null)
  /** Le lieu dont la fiche est ouverte : l'éditeur de plan y ramène. */
  const [fiche, setFiche] = useState<number | null>(null)
  /** Le lieu dont la fiche s'ouvre directement sur le calque des murs. */
  const [murs, setMurs] = useState<number | null>(null)
  /**
   * Les contenants qui ne font pas comme leur étage — ceux qu'on a basculés à
   * la main. Le reste suit `OUVERT_DABORD`.
   */
  /* Retenues d'une visite à l'autre, par campagne : un contenant qu'on a
     replié le reste quand on revient sur la page. */
  const cleBascules = `lieux.bascules.${s.project?.dir ?? ''}`
  const [bascules, setBascules] = useState<Set<number>>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(cleBascules) ?? '[]')
      return new Set(Array.isArray(v) ? v.filter((x) => typeof x === 'number') : [])
    } catch {
      return new Set()
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(cleBascules, JSON.stringify([...bascules]))
    } catch {
      /* sans stockage, le repli ne dure que la visite */
    }
  }, [bascules, cleBascules])
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

  const ouvrirFiche = (id: number | null): void => {
    if (id == null) return
    setChoisi(id)
    setFiche(id)
  }

  /* « Éditer le plan » depuis le volet : le même geste que celui de la fiche,
     qui reste derrière pour que « Retour » y ramène. */
  const editerPlan = (q: Place): void => {
    setFiche(q.id)
    if (q.tier === 'niveau') void ouvrirLesMurs(q)
    else {
      setChoisi(q.id)
      setOuvert(q.id)
    }
  }

  /* Passer d'un plan à l'autre, sans repasser par la liste : un niveau
     s'ouvre sur ses murs, comme depuis sa fiche ; le reste sur son plan. */
  const allerAuPlan = (q: Place): void => {
    if (fiche != null) setFiche(q.id)
    if (q.tier === 'niveau') void ouvrirLesMurs(q)
    else {
      setChoisi(q.id)
      setOuvert(q.id)
      setMurs(null)
    }
  }

  const lieuOuvert = place(ouvert)
  const ficheOuverte = place(fiche)
  if (lieuOuvert) {
    const { avant, apres } = plansVoisins(s.places, lieuOuvert.id)
    return (
      <>
      <SuiteAriane
        onRetour={() => {
          setOuvert(null)
          setMurs(null)
          setFiche(null)
        }}
      >
        <CheminDuLieu
          p={lieuOuvert}
          onOuvrir={(id) => {
            setOuvert(null)
            setMurs(null)
            ouvrirFiche(id)
          }}
          fin={
            <>
              <button
                className="ariane-lien"
                title="Revenir à la fiche du lieu"
                onClick={() => {
                  setOuvert(null)
                  setMurs(null)
                  ouvrirFiche(lieuOuvert.id)
                }}
              >
                {lieuOuvert.name}
              </button>
              <span className="ariane-sep">›</span>
              <h1 aria-current="page">Plan</h1>
              <span className="saut-lieu-hote">
                <button
                  className="btn btn-sm btn-ghost saut-fleche"
                  disabled={!avant}
                  title={avant ? `Plan précédent : ${avant.name}` : 'Premier plan'}
                  aria-label="Plan précédent"
                  onClick={() => avant && allerAuPlan(avant)}
                >
                  ←
                </button>
                <button
                  className="btn btn-sm btn-ghost saut-fleche"
                  disabled={!apres}
                  title={apres ? `Plan suivant : ${apres.name}` : 'Dernier plan'}
                  aria-label="Plan suivant"
                  onClick={() => apres && allerAuPlan(apres)}
                >
                  →
                </button>
              </span>
            </>
          }
        />
      </SuiteAriane>
      <FicheLieu
        /* Une autre fiche, un autre état : on ne garde pas un mode murs ou un
           rognage à moitié fait en changeant de lieu. */
        key={lieuOuvert.id}
        p={lieuOuvert}
        niveau={place(lieuOuvert.parentId)}
        pieces={enfants(lieuOuvert.id, 'lieu')}
        surLesMurs={murs === lieuOuvert.id}
        /* Venu d'une fiche, « Terminé » y ramène ; le fil d'Ariane, à la liste. */
        onTermine={
          ficheOuverte
            ? () => {
                setOuvert(null)
                setMurs(null)
              }
            : undefined
        }
        onFermer={() => {
          setOuvert(null)
          setMurs(null)
          setFiche(null)
        }}
        onMurs={() => {
          /* Une pièce renvoie au plan de son étage ; tout autre lieu trace
             le sien. */
          const cible = estPiece(lieuOuvert) ? place(lieuOuvert.parentId) : lieuOuvert
          if (cible) void ouvrirLesMurs(cible)
        }}
        onRelire={relire}
        onChanger={(id) => {
          setOuvert(id)
          setChoisi(id)
          setMurs(null)
          if (fiche != null) setFiche(id)
        }}
      />
      </>
    )
  }

  if (ficheOuverte)
    return (
      <>
      <SuiteAriane onRetour={() => setFiche(null)}>
        <CheminDuLieu
          p={ficheOuverte}
          onOuvrir={(id) => ouvrirFiche(id)}
          fin={<SautDeLieu courant={ficheOuverte.id} onChanger={(id) => ouvrirFiche(id)} fleches={false} />}
        />
      </SuiteAriane>
      <FicheDuLieu
        key={ficheOuverte.id}
        p={ficheOuverte}
        niveau={place(ficheOuverte.parentId)}
        voisins={voisinsDe(s.places, ficheOuverte.id)}
        onChanger={(id) => ouvrirFiche(id)}
        onEditerPlan={() => {
          /* Un niveau se découpe ; un espace, un lieu, une pièce ouvrent leur
             plan, où l'on trace les murs, les portes et les lumières. Pas de
             `decouperEspace` ici : il crée un niveau à chaque ouverture, et
             un « Rez-de-chaussée » effacé revenait au prochain passage. */
          const q = ficheOuverte
          if (q.tier === 'niveau') void ouvrirLesMurs(q)
          else setOuvert(q.id)
        }}
      />
      </>
    )

  if (plans) return <ListeDesPlans onOuvrir={allerAuPlan} />

  const rien =espaces.length === 0 && orphelins.length === 0

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
              onOuvrir={() => ouvrirFiche(l.id)}
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
          onOuvrir={() => ouvrirFiche(b.id)}
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
          onOuvrir={() => ouvrirFiche(n.id)}
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
          onOuvrir={() => ouvrirFiche(e.id)}
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
          onOuvrir={() => ouvrirFiche(choisi)}
          onEditerPlan={editerPlan}
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
export function estPiece(p: Place): boolean {
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
      {/* Le rond de découverte se pose au coin du plan, comme sur les tuiles :
          tout se lit serré à gauche, rien n'est repoussé au bout de la ligne. */}
      <span className="mini">
        {map?.url ? <PlanCadre url={map.poster ?? map.url} zone={p.zone} /> : <IconPlace />}
        <Jalon p={p} onVu={onVu} />
      </span>
      <span className="tx">
        {/* Le résumé n'a pas sa place ici : il rognait le nom. L'aperçu au
            survol du plan le montre, et le volet de droite l'écrit. */}
        <span className="eyebrow tier">{p.tier === 'lieu' ? 'Bâtiment' : TIER_LABEL[p.tier]}</span>
        <b>{p.name}</b>
      </span>
      {pieces ? (
        <span className="tag c-brass" title="Pièces tracées sur ce plan">
          {pieces} pièce{pieces > 1 ? 's' : ''}
        </span>
      ) : null}
      {actions ? <span className="actions-ligne">{actions}</span> : null}
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
/* `url` : la vignette gravée par l'examen des médias quand elle existe. Un
   plan d'étage fait souvent des dizaines de milliers de pixels de côté : le
   décoder entier pour une tuile de soixante pixels, à chaque lieu de la
   liste, figeait la page. Les vues où l'on travaille, elles, gardent l'image
   pleine. */
function PlanCadre({ url, zone }: { url: string; zone: PointMur[] | null }): JSX.Element {
  if (!zone || zone.length < 3)
    return <img src={url} alt="" loading="lazy" decoding="async" draggable={false} />
  /* Le contour n'est pas un rectangle ; la vignette, si. On cadre donc sur la
     boîte qui l'enferme — assez pour reconnaître la pièce d'un coup d'œil. */
  const b = boiteDe(zone)
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      decoding="async"
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
      <span className="vue">
        {map?.url ? <PlanCadre url={map.poster ?? map.url} zone={p.zone} /> : <IconPlace />}
        <Jalon p={p} onVu={onVu} />
        {onEffacer ? <OterTuile nom={p.name} onEffacer={onEffacer} /> : null}
      </span>
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
  onEditerPlan,
  onMurs,
  onAjouterNiveau
}: {
  p: Place | null
  niveau: Place | null
  onRelire: () => Promise<void>
  onEfface: () => void
  onOuvrir: () => void
  /** Ouvrir son plan — murs, portes, lumières — comme depuis sa fiche. */
  onEditerPlan: (p: Place) => void
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
            seen: p.seen,
            /* Le texte, lui, ne revient du dehors (son fichier dans « Lieux »)
               que si rien n'attend d'être enregistré. */
            ...(minuteur.current ? {} : { summary: p.summary, notes: p.notes })
          }
        : p
    )
    setConfirme(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p?.id, p?.tier, p?.parentId, p?.seen, p?.zone?.length, p?.summary, p?.notes])

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
    minuteur.current = null
    if (differe)
      minuteur.current = window.setTimeout(() => {
        minuteur.current = null
        void enregistrer(v)
      }, 700)
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
                {carte?.url ? <PlanCadre url={carte.poster ?? carte.url} zone={f.zone} /> : <IconPlace />}
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
                {carte?.url ? <PlanCadre url={carte.poster ?? carte.url} zone={f.zone} /> : <IconPlace />}
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
                {carte?.url ? (
                  <img src={carte.poster ?? carte.url} alt="" loading="lazy" decoding="async" draggable={false} />
                ) : (
                  <IconPlace />
                )}
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

        {p.tier === 'espace' ? (
          <CielDeLEspace
            espace={p}
            lieux={descendantsDe(p.id, s.places)}
            onRelire={onRelire}
          />
        ) : null}

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
        {/* Une seule porte pour tous : la fiche, d'où « Éditer le plan » mène
            aux murs, aux lumières et au découpage. */}
        <button
          className="btn btn-brass"
          title="Ses découvertes et déclencheurs, ses scénarios, ses PNJ et ses objets — et son plan"
          onClick={onOuvrir}
        >
          <IconPen />
          Ouvrir la fiche
        </button>
        {/* Comme dans la fiche : une pièce s'édite sur le plan de son étage. */}
        {f.mapItemId != null && !estPiece(f) ? (
          <button
            className="btn"
            title="Ouvrir son plan : murs, portes, lumières"
            onClick={() => onEditerPlan(f)}
          >
            Éditer le plan
          </button>
        ) : null}
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
 * Le soleil ou la lune de tout un espace.
 *
 * Posé, il tombe sur chacun de ses lieux, tourné selon le nord de chaque plan,
 * et les lieux ne le règlent plus eux-mêmes. « Chaque lieu le sien » rend à
 * chacun ce qu'il avait réglé avant.
 */
function CielDeLEspace({
  espace,
  lieux,
  onRelire
}: {
  espace: Place
  lieux: Place[]
  onRelire: () => Promise<void>
}): JSX.Element {
  const a = espace.ciel
  const [apercu, setApercu] = useState(false)
  const [cap, setCap] = useState(a?.cap ?? 135)
  /* Les plans à montrer : ceux qui ont une image à eux. Une pièce découpée
     se voit déjà sur le plan de son étage. */
  const plans = [espace, ...lieux].filter((q) => q.mapItemId != null && !q.zone)
  useEffect(() => setCap(a?.cap ?? 135), [a?.cap])
  const poser = async (v: Astre | null): Promise<void> => {
    await window.jdr.places.cielEspace(espace.id, v)
    await onRelire()
  }
  const tourner = (v: number): void => {
    if (a) void poser({ ...a, cap: ((v % 360) + 360) % 360 })
  }
  const reglage = (
    <>
      <div className="murs-rangee">
        <button
          className="btn btn-sm"
          aria-pressed={!a}
          title="Chaque lieu règle son soleil ou sa lune dans son plan"
          onClick={() => void poser(null)}
        >
          Chaque lieu le sien
        </button>
        <button
          className="btn btn-sm"
          aria-pressed={a?.nature === 'soleil'}
          title="Le jour sur tout l’espace"
          onClick={() => void poser({ nature: 'soleil', cap })}
        >
          ☀ Soleil
        </button>
        <button
          className="btn btn-sm"
          aria-pressed={a?.nature === 'lune'}
          title="La nuit sur tout l’espace : la même chose, un peu plus sombre"
          onClick={() => void poser({ nature: 'lune', cap })}
        >
          ☾ Lune
        </button>
        <button
          className="btn btn-sm"
          aria-pressed={a?.nature === 'nuit'}
          title="Il fait nuit sur tout l’espace : rien n’entre du dehors, et le regard ne distingue plus rien sans lampe"
          onClick={() => void poser({ nature: 'nuit', cap })}
        >
          ● Nuit noire
        </button>
      </div>
      {a?.nature === 'nuit' ? (
        <span className="murs-cap">
          Nuit noire sur {lieux.length ? `ses ${lieux.length} lieux` : 'tous ses lieux'} — sans
          lampe, portée ou posée, les joueurs n’y voient rien.
        </span>
      ) : a ? (
        <>
          <span className="murs-reglage" title="D’où vient la lumière : 0° le nord, 90° l’est">
            <span>Vient de</span>
            <input
              type="range"
              min={0}
              max={359}
              step={1}
              value={Math.round(cap)}
              onChange={(e) => setCap(Number(e.target.value))}
              onPointerUp={() => tourner(cap)}
              onKeyUp={() => tourner(cap)}
            />
            <Valeur
              className="num"
              value={Math.round(cap)}
              min={0}
              max={359}
              unite="°"
              label="D’où vient la lumière"
              onChange={(v) => {
                setCap(v)
                tourner(v)
              }}
            />
          </span>
          <span className="murs-cap">
            La lumière vient {ventDe(cap)}, sur {lieux.length ? `ses ${lieux.length} lieux` : 'tous ses lieux'} —
            chacun la tourne selon le nord de son plan, et ne la règle plus lui-même.
          </span>
        </>
      ) : null}
    </>
  )
  return (
    <div className="field ciel-espace">
      <label>Le ciel de l’espace — la lumière du dehors de tous ses lieux</label>
      {reglage}
      <button
        className="btn btn-sm"
        disabled={!plans.length}
        title={
          plans.length
            ? 'Tous les plans de cet espace côte à côte, sous le soleil ou la lune'
            : 'Aucun lieu de cet espace n’a encore de plan'
        }
        onClick={() => setApercu(true)}
      >
        <IconSoleil />
        Voir l’ensemble des lieux
      </button>
      {apercu ? (
        <ApercuDuCiel
          espace={espace}
          ciel={a ? { ...a, cap } : null}
          reglage={reglage}
          onClose={() => setApercu(false)}
        />
      ) : null}
    </div>
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
/**
 * Sauter d'une fiche à l'autre. Les lieux viennent dans l'ordre de l'arbre,
 * décalés selon leur profondeur — un espace, ses niveaux, leurs pièces —,
 * pour qu'on s'y retrouve comme dans la liste.
 */
/** Tous les lieux dans l'ordre de l'arbre, avec leur profondeur. */
function rangsDesLieux(places: Place[]): { p: Place; prof: number }[] {
  const ids = new Set(places.map((p) => p.id))
  const sous = (pid: number | null): Place[] =>
    places.filter((p) => (pid === null ? p.parentId === null || !ids.has(p.parentId) : p.parentId === pid))
  const out: { p: Place; prof: number }[] = []
  const vus = new Set<number>()
  const descendre = (pid: number | null, prof: number): void => {
    for (const p of sous(pid)) {
      if (vus.has(p.id)) continue
      vus.add(p.id)
      out.push({ p, prof })
      descendre(p.id, prof + 1)
    }
  }
  descendre(null, 0)
  return out
}

/* Précédent et suivant, dans l'ordre de l'arbre : on parcourt les lieux
   comme on lirait la liste, sans rouvrir le sélecteur. */
function voisinsDe(places: Place[], courant: number): { avant: Place | null; apres: Place | null } {
  const rangs = rangsDesLieux(places)
  const ici = rangs.findIndex((r) => r.p.id === courant)
  return {
    avant: ici > 0 ? rangs[ici - 1].p : null,
    apres: ici >= 0 && ici < rangs.length - 1 ? rangs[ici + 1].p : null
  }
}

/**
 * Les lieux qui ont un plan à eux, dans l'ordre de l'arbre.
 *
 * Une pièce taillée dans le plan de son étage n'en est qu'un morceau : elle
 * n'y est pas. Un espace dont un niveau porte la même image ne compte qu'une
 * fois, par ce niveau — c'est lui qui tient les murs.
 */
export function lesPlans(places: Place[]): Place[] {
  return rangsDesLieux(places)
    .map((r) => r.p)
    .filter(
      (p) =>
        p.mapItemId != null &&
        !p.zone &&
        !places.some((q) => q.parentId === p.id && q.mapItemId === p.mapItemId && !q.zone)
    )
}

/* Le plan d'avant et celui d'après, dans l'ordre de la liste. Ouvert sur une
   pièce, on repart des plans qui l'entourent dans l'arbre. */
function plansVoisins(places: Place[], courant: number): { avant: Place | null; apres: Place | null } {
  const rang = new Map(rangsDesLieux(places).map((r, i) => [r.p.id, i]))
  const ici = rang.get(courant) ?? -1
  const liste = lesPlans(places)
  return {
    avant: [...liste].reverse().find((p) => (rang.get(p.id) ?? -1) < ici) ?? null,
    apres: liste.find((p) => (rang.get(p.id) ?? -1) > ici) ?? null
  }
}

/** La page « Plans » : chaque plan en grande vignette, un clic l'ouvre. */
/** Ce qu'un plan tient déjà : de quoi voir d'un coup d'œil ce qui reste à préparer. */
interface ContenuDuPlan {
  lumieres: number
  portes: number
  sons: number
}

function ListeDesPlans({ onOuvrir }: { onOuvrir: (p: Place) => void }): JSX.Element {
  const s = useStore()
  const liste = useMemo(() => lesPlans(s.places), [s.places])

  /* Lumières, portes et sons vivent chacun dans leur table : on les relit à
     chaque visite de la page, un plan après l'autre, sans rien garder. */
  const [contenus, setContenus] = useState<Map<number, ContenuDuPlan>>(new Map())
  const ids = liste.map((p) => p.id).join(',')
  useEffect(() => {
    let vivant = true
    void Promise.all(
      liste.map(async (p) => {
        const [lum, ouv, sons] = await Promise.all([
          window.jdr.lumieres.of(p.id),
          window.jdr.ouvertures.of(p.id),
          window.jdr.sons.zones(p.id)
        ])
        const c: ContenuDuPlan = {
          lumieres: lum.length,
          portes: ouv.filter((o) => o.nature === 'porte').length,
          sons: sons.length
        }
        return [p.id, c] as const
      })
    ).then((l) => vivant && setContenus(new Map(l)))
    return () => {
      vivant = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids])

  /* Les objets posés sur un plan : ceux du lieu même et ceux de ses pièces. */
  const objetsDe = (p: Place): number => {
    const ici = new Set([p.id, ...s.places.filter((q) => q.parentId === p.id && estPiece(q)).map((q) => q.id)])
    return s.objets.reduce(
      (n, o) => n + o.placements.filter((x) => x.port === 'lieu' && x.placeId != null && ici.has(x.placeId)).length,
      0
    )
  }
  return (
    <section className="view">
      <div className="vhead">
        <div>
          <h2>Plans</h2>
          <p>
            Les lieux qui ont un plan, dans l’ordre de la liste. Un clic l’ouvre ; ← et → , en
            haut, passent au précédent ou au suivant.
          </p>
        </div>
      </div>
      {liste.length ? (
        <div className="plans-grille">
          {liste.map((p) => {
            const map = s.allItems.find((i) => i.id === p.mapItemId)
            const chemin = ascendants(s.places, p).map((q) => q.name)
            return (
              <button
                key={p.id}
                className="plan-vignette"
                title={`Ouvrir le plan de ${p.name}`}
                onClick={() => onOuvrir(p)}
              >
                <span className="vue">
                  {map?.url ? (
                    <img src={map.poster ?? map.url} alt="" loading="lazy" decoding="async" draggable={false} />
                  ) : (
                    <IconPlace />
                  )}
                  {/* On prépare ici : le plan reste net, un mot discret suffit. */}
                  {p.seen ? null : <span className="pasvu">pas encore vu</span>}
                </span>
                <span className="nom">{p.name}</span>
                {chemin.length ? <span className="chemin">{chemin.join(' › ')}</span> : null}
                <ContenuPlan c={contenus.get(p.id)} objets={objetsDe(p)} ambiance={p.ambienceItemId != null} />
              </button>
            )
          })}
        </div>
      ) : (
        <div className="empty">
          <b>Aucun plan</b>
          Un lieu reçoit son plan depuis son volet, dans Lieux.
        </div>
      )}
    </section>
  )
}

/** La ligne de compteurs d'une vignette de plan ; un zéro reste pâle. */
function ContenuPlan({
  c,
  objets,
  ambiance
}: {
  c: ContenuDuPlan | undefined
  objets: number
  ambiance: boolean
}): JSX.Element {
  /* `sorte` donne sa couleur à l'icône — seulement quand il y a quelque chose. */
  const pastille = (
    n: number | undefined,
    sorte: string,
    icone: JSX.Element,
    un: string,
    plusieurs: string
  ): JSX.Element => (
    <span className={`p ${sorte}${n ? '' : ' zero'}`} title={n === undefined ? '' : `${n} ${n > 1 ? plusieurs : un}`}>
      {icone}
      {n ?? '…'}
    </span>
  )
  return (
    <span className="contenu">
      {pastille(c?.lumieres, 'k-lum', <IconSoleil />, 'lumière', 'lumières')}
      {pastille(c?.portes, 'k-porte', <IconPorte />, 'porte', 'portes')}
      {pastille(objets, 'k-obj', <IconCoffre />, 'objet posé', 'objets posés')}
      {pastille(c?.sons, 'k-son', <IconNote />, 'son posé', 'sons posés')}
      <span
        className={`p amb${ambiance ? '' : ' zero'}`}
        title={ambiance ? 'Une ambiance part quand on met ce lieu en scène' : 'Aucune ambiance'}
      >
        <IconAudio />
        {ambiance ? 'Ambiance' : 'Sans ambiance'}
      </span>
    </span>
  )
}

/** Les contenants d'un lieu, du plus large au plus proche : l'espace, le bâtiment, le niveau. */
function ascendants(places: Place[], p: Place): Place[] {
  const out: Place[] = []
  let q = places.find((x) => x.id === p.parentId)
  while (q && !out.includes(q)) {
    out.unshift(q)
    q = places.find((x) => x.id === q!.parentId)
  }
  return out
}

/**
 * Le chemin d'un lieu dans la barre du haut : ses contenants, cliquables, puis
 * le lieu lui-même — le sélecteur pour sauter ailleurs, ou un lien vers sa
 * fiche quand on est sur son plan.
 */
function CheminDuLieu({
  p,
  onOuvrir,
  fin
}: {
  p: Place
  onOuvrir: (id: number) => void
  fin: React.ReactNode
}): JSX.Element {
  const s = useStore()
  return (
    <>
      {ascendants(s.places, p).map((q) => (
        <Fragment key={q.id}>
          <span className="ariane-sep">›</span>
          <button className="ariane-lien" onClick={() => onOuvrir(q.id)} title={`La fiche de ${q.name}`}>
            {q.name}
          </button>
        </Fragment>
      ))}
      <span className="ariane-sep">›</span>
      {fin}
    </>
  )
}

function SautDeLieu({
  courant,
  onChanger,
  fleches = true
}: {
  courant: number
  onChanger: (id: number) => void
  /** Les flèches précédent / suivant autour du sélecteur. */
  fleches?: boolean
}): JSX.Element {
  const s = useStore()
  const rangs = useMemo(() => rangsDesLieux(s.places), [s.places])
  const ici = rangs.findIndex((r) => r.p.id === courant)
  const { avant, apres } = voisinsDe(s.places, courant)
  /* La sorte de chaque lieu, pour la teinte de sa ligne : un espace, un
     bâtiment, un niveau, un lieu ne se confondent pas dans la liste. */
  const sorte = (p: Place): string =>
    p.tier === 'lieu' && estBatiment(p, s.places) ? 'batiment' : p.tier
  const choisi = ici >= 0 ? rangs[ici].p : null

  return (
    <span className="saut-lieu-hote">
      {fleches ? (
      <button
        className="btn btn-sm btn-ghost saut-fleche"
        disabled={!avant}
        title={avant ? `Lieu précédent : ${avant.name}` : 'Premier lieu de la liste'}
        aria-label="Lieu précédent"
        onClick={() => avant && onChanger(avant.id)}
      >
        ←
      </button>
      ) : null}
      <select
        className={`saut-lieu sorte-${choisi ? sorte(choisi) : 'lieu'}`}
        value={courant}
        aria-label="Ouvrir la fiche d’un autre lieu"
        title="Ouvrir la fiche d’un autre lieu"
        onChange={(e) => onChanger(Number(e.target.value))}
      >
        {rangs.map(({ p, prof }) => (
          <option key={p.id} value={p.id} className={`sorte-${sorte(p)}`}>
            {'   '.repeat(prof)}
            {p.name}
          </option>
        ))}
      </select>
      {fleches ? (
      <button
        className="btn btn-sm btn-ghost saut-fleche"
        disabled={!apres}
        title={apres ? `Lieu suivant : ${apres.name}` : 'Dernier lieu de la liste'}
        aria-label="Lieu suivant"
        onClick={() => apres && onChanger(apres.id)}
      >
        →
      </button>
      ) : null}
    </span>
  )
}

function FicheLieu({
  p,
  niveau,
  pieces,
  surLesMurs,
  onTermine,
  onFermer,
  onMurs,
  onRelire,
  onChanger
}: {
  p: Place
  niveau: Place | null
  /** Les lieux déjà nés des murs de cette carte. */
  pieces: Place[]
  /** La fiche s'ouvre directement sur le calque des murs. */
  surLesMurs?: boolean
  /** Ouvert depuis la fiche du lieu : « Terminé » y ramène. */
  onTermine?: () => void
  onFermer: () => void
  onMurs: () => void
  onRelire: () => Promise<void>
  /** Passer à la fiche d'un autre lieu, sans repasser par la liste. */
  onChanger: (id: number) => void
}): JSX.Element {
  const s = useStore()
  const [annote, setAnnote] = useState(false)
  /* Le calque des murs : un troisième mode, exclusif de l'annotation. Les deux
     se posent sur la même carte, et on ne trace pas une cloison en visant un
     repère. */
  /* On arrive sur « Choisir », le calque des murs prêt : murs, portes, lampes
     et repères se prennent du même clic. */
  const [murs, setMurs] = useState(true)
  /** Le menu « Image ▾ » : remplacer, caler, rogner, étalonner. */
  const [menuImage, setMenuImage] = useState<{ x: number; y: number } | null>(null)
  /** Ce qu'on montre sur le plan, sans changer d'outil. Pour l'œil seulement. */
  const [calques, setCalques] = useState({ murs: true, lumieres: true, mj: true, grille: false })
  /** Le plan comme la lumière le laisse aux joueurs, sans murs ni repères. */
  const [vueJoueurs, setVueJoueurs] = useState(false)
  const mu = useMurs(p.id)
  /** Les sons posés sur ce plan, et l'outil Son en main. */
  const zs = useZonesSon(p.id)
  const [sonArme, setSonArme] = useState(false)
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
  /** L'onglet ouvert du volet, quand rien n'est choisi sur le plan. */
  const [onglet, setOnglet] = useState<'echelle' | 'quiquoi' | 'sons' | OngletMurs>('pieces')
  /**
   * Dans « Objets et PNJ » d'un plan qui a ses pièces : celle où l'on range.
   * Une pièce n'a pas d'éditeur à elle, c'est donc d'ici qu'on la garnit.
   */
  const [pieceQq, setPieceQq] = useState<number | null>(null)
  /** Un objet cliqué sur le plan : sa rangée se déplie dans le volet. */
  const [ouvrirQq, setOuvrirQq] = useState<{ cle: string; n: number } | null>(null)
  const [remplacer, setRemplacer] = useState(false)
  /**
   * Un geste au rectangle sur la carte : garder ce cadre de l'image, ou
   * faire un lieu de ce qu'on vient d'entourer.
   */
  const [trace, setTrace] = useState<'rogner' | 'lieu' | 'etalonner' | null>(null)
  /**
   * L'échelle du plan, et le trait qu'on tire pour la fixer : ses deux bouts
   * en fractions de l'image, et la longueur qu'on tape, en mètres.
   */
  const [ech, setEch] = useState<EchellePlan | null>(null)
  /** Un pion fantôme suit la souris sur le plan : on juge sa taille sur pièce. */
  const [apercuPion, setApercuPion] = useState(false)
  /** Où il est, et où il regarde — le pilote le fait marcher, la souris le pose. */
  const [poseApercu, setPoseApercu] = useState({ x: 0.5, y: 0.5, cap: 0 })
  /** La poussée du pilote, -1 à 1 sur chaque axe : lue à chaque image. */
  const pousseApercu = useRef({ x: 0, y: 0 })
  const [trait, setTrait] = useState<{ a: PointMur; b: PointMur } | null>(null)
  const [metresTrait, setMetresTrait] = useState('')
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
    setTrait(null)
    setMetresTrait('')
  }
  /**
   * Caler l'image sous les murs : elle glisse et s'agrandit **seule**, les
   * murs restent où ils sont. `z` agrandit autour du centre, `ox`/`oy`
   * décalent, en fractions du cadre ; `r` la tourne, en degrés, sens horaire,
   * autour de son centre. `null` hors de ce geste.
   */
  const [calage, setCalage] = useState<Calage | null>(null)
  /* Une grille droite par-dessus, pour juger qu'un mur est bien d'aplomb. Elle
     reste cochée d'un calage à l'autre, tant que la fiche est ouverte. */
  const [grille, setGrille] = useState(false)
  /* Les proportions de l'image, pour qu'elle tienne entière dans le cadre une
     fois tournée. */
  const [natCarte, setNatCarte] = useState<{ w: number; h: number } | null>(null)
  /** Le zoom réellement appliqué : celui qu'on règle, réduit d'autant que la rotation déborde. */
  const zoomCalage = (c: Calage): number => c.z * tienDans(natCarte, c.r)
  /* Pendant un rognage ou un calage, la barre n'offre que lui : le reste
     attend qu'on valide ou qu'on ferme. */
  const rognage = trace === 'rogner' || calage !== null

  /**
   * Valider le calage. Un point du cadre `f` montre le point de l'image
   * `(f − ½ − o) / z + ½` : c'est là que chaque mur doit aller pour rester
   * sur ce qu'il recouvre. C'est le recalage d'un rognage au cadre
   * `x = ½ + ox − z/2`, `w = z`.
   *
   * Tournée, l'image reste tournée : on la dessine telle qu'on la voit, dans
   * une copie aussi grande que sa boîte englobante. Les murs n'ont alors plus
   * qu'à s'agrandir avec le cadre — la rotation est dans l'image, ils restent
   * où ils sont à l'écran.
   */
  const caler = async (): Promise<void> => {
    if (!calage || occupe || !carte?.url) return
    const { ox, oy, r } = calage
    const z = zoomCalage(calage)
    if (z === 1 && ox === 0 && oy === 0 && r === 0) return void setCalage(null)
    setOccupe(true)
    try {
      if (r) {
        const t = await dessinerTournee(carte.url, r)
        const cw = (z * t.w2) / t.w
        const ch = (z * t.h2) / t.h
        await window.jdr.places.calerTourne(p.id, t.octets, t.jpeg, {
          x: 0.5 + ox - cw / 2,
          y: 0.5 + oy - ch / 2,
          w: cw,
          h: ch
        })
      } else
        await window.jdr.places.caler(p.id, { x: 0.5 + ox - z / 2, y: 0.5 + oy - z / 2, w: z, h: z })
      setCalage(null)
      await onRelire()
      await mu.relire()
      await relire()
      s.toast('Image calée — les murs et ce qui est posé ont suivi')
    } catch (e) {
      s.toast(e instanceof Error ? e.message : 'Calage impossible', true)
    } finally {
      setOccupe(false)
    }
  }

  /** Rogner : une copie de l'image, réduite au cadre ; murs et pions recalés. */
  const rogner = async (): Promise<void> => {
    if (!rect || occupe) return
    setOccupe(true)
    try {
      await window.jdr.places.rogner(p.id, rect)
      finirTrace()
      await onRelire()
      /* On reste peut-être en mode murs : ils ont bougé avec l'image. */
      await mu.relire()
      await relire()
      s.toast('Image rognée — une copie, l’originale reste dans son dossier')
    } catch (e) {
      s.toast(e instanceof Error ? e.message : 'Rognage impossible', true)
    } finally {
      setOccupe(false)
    }
  }

  /* Au clavier : Entrée rogne au cadre tracé, Échap renonce. Hors d'un champ
     de saisie, pour ne pas voler la touche à qui écrit. */
  useEffect(() => {
    if (!rognage) return
    const touche = (e: KeyboardEvent): void => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      if (e.key === 'Enter' && calage) {
        e.preventDefault()
        void caler()
      } else if (e.key === 'Enter' && rect) {
        e.preventDefault()
        void rogner()
      } else if (e.key === 'Escape') {
        finirTrace()
        setCalage(null)
      }
    }
    window.addEventListener('keydown', touche)
    return () => window.removeEventListener('keydown', touche)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rognage, rect, occupe, calage])

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

  /* L'échelle se relit quand les portes changent : c'est d'elles qu'on
     l'estime tant qu'on ne l'a pas fixée au trait. */
  useEffect(() => {
    let vivant = true
    void window.jdr.places.echelle(p.id).then((e) => vivant && setEch(e))
    return () => {
      vivant = false
    }
  }, [p.id, mu.ouvertures])

  /*
   * Le pilote de l'aperçu : la même marche que le téléphone. Le pion avance
   * tant qu'on pousse, à l'allure de ce plan pouce au bord, et les murs le
   * retiennent. On juge ainsi l'allure avant que les joueurs la subissent.
   */
  const barrieresApercu = useMemo(() => {
    if (!natCarte || !mu.liste.length) return null
    const enPx = (q: PointMur): Pt => ({ x: q[0] * natCarte.w, y: q[1] * natCarte.h })
    return barrieres(mu.liste, 'pas', enPx, mu.ouvertures)
  }, [mu.liste, mu.ouvertures, natCarte])
  const allureApercu = ech?.allure ?? null
  /* La pose du moment, lue par la boucle sans attendre le dessin. */
  const poseApercuRef = useRef(poseApercu)
  poseApercuRef.current = poseApercu
  useEffect(() => {
    if (!apercuPion || allureApercu === null) return
    let vivant = true
    let image = 0
    let avant = performance.now()
    let dessin = 0
    /* Le pas se compte à chaque image, mais la fiche ne se redessine que
       vingt fois par seconde : c'est la cadence du téléphone, et tout le
       plan se repeint à chaque fois. */
    let q = poseApercuRef.current
    let enMarche = false
    const battre = (now: number): void => {
      if (!vivant) return
      image = requestAnimationFrame(battre)
      const dt = Math.min(0.06, (now - avant) / 1000)
      avant = now
      const p = pousseApercu.current
      const force = Math.min(1, Math.hypot(p.x, p.y))
      if (force <= 0.08) {
        /* Le dernier pas se dessine toujours ; ensuite, la souris peut avoir
           déplacé le pion : on repart de là. */
        if (enMarche) setPoseApercu(q)
        else q = poseApercuRef.current
        enMarche = false
        return
      }
      enMarche = true
      const l = Math.hypot(p.x, p.y) || 1
      const pas = allureApercu * force * dt
      const w = natCarte?.w ?? 1000
      const h = natCarte?.h ?? 1000
      let vise = {
        x: Math.max(0.01, Math.min(0.99, q.x + (p.x / l) * pas)),
        y: Math.max(0.01, Math.min(0.99, q.y + (p.y / l) * pas * (w / h)))
      }
      if (barrieresApercu) {
        const a = pasContraint(barrieresApercu, { x: q.x * w, y: q.y * h }, { x: vise.x * w, y: vise.y * h }, { w, h }, 2)
        vise = { x: a.x / w, y: a.y / h }
      }
      q = { x: vise.x, y: vise.y, cap: (Math.atan2(p.x, -p.y) * 180) / Math.PI }
      if (now - dessin < 50) return
      dessin = now
      setPoseApercu(q)
    }
    image = requestAnimationFrame(battre)
    return () => {
      vivant = false
      cancelAnimationFrame(image)
    }
  }, [apercuPion, allureApercu, barrieresApercu, natCarte])

  /*
   * Le pilote de l'essai : le même disque, qui fait marcher le pion d'essai à
   * l'allure du plan. Les murs le retiennent comme ceux du téléphone ; s'il
   * se tourne en marchant, son nez suit le pouce.
   */
  const pousseEssai = useRef({ x: 0, y: 0 })
  const essaiRef = useRef(mu.essai)
  essaiRef.current = mu.essai
  const poserEssai = useRef(mu.setEssai)
  poserEssai.current = mu.setEssai
  const essaiPose = mu.essai !== null
  const allureEssai = ech?.allure ?? ALLURE_DEFAUT
  useEffect(() => {
    if (!essaiPose) return
    let vivant = true
    let image = 0
    let avant = performance.now()
    let dessin = 0
    /* La pose qu'on fait marcher ; `null` à l'arrêt : on repart alors de celle
       du pion, que la souris a pu glisser entre-temps. */
    let q: { x: number; y: number; cap: number } | null = null
    const battre = (now: number): void => {
      if (!vivant) return
      image = requestAnimationFrame(battre)
      const dt = Math.min(0.06, (now - avant) / 1000)
      avant = now
      const e = essaiRef.current
      if (!e) return
      const p = pousseEssai.current
      const force = Math.min(1, Math.hypot(p.x, p.y))
      if (force <= 0.08) {
        if (q) poserEssai.current({ ...e, ...q })
        q = null
        return
      }
      if (!q) q = { x: e.x, y: e.y, cap: e.cap }
      const l = Math.hypot(p.x, p.y) || 1
      const pas = allureEssai * force * dt
      const w = natCarte?.w ?? 1000
      const h = natCarte?.h ?? 1000
      let vise = {
        x: Math.max(0.01, Math.min(0.99, q.x + (p.x / l) * pas)),
        y: Math.max(0.01, Math.min(0.99, q.y + (p.y / l) * pas * (w / h)))
      }
      if (barrieresApercu) {
        const a = pasContraint(barrieresApercu, { x: q.x * w, y: q.y * h }, { x: vise.x * w, y: vise.y * h }, { w, h }, 2)
        vise = { x: a.x / w, y: a.y / h }
      }
      /* Le cap se compte depuis le haut, comme un pion : le calcul de l'aperçu. */
      q = { x: vise.x, y: vise.y, cap: e.marche ? ((Math.atan2(p.x, -p.y) * 180) / Math.PI + 360) % 360 : q.cap }
      if (now - dessin < 50) return
      dessin = now
      poserEssai.current({ ...e, ...q })
    }
    image = requestAnimationFrame(battre)
    return () => {
      vivant = false
      cancelAnimationFrame(image)
    }
  }, [essaiPose, allureEssai, barrieresApercu, natCarte])

  /* L'ambiance du lieu, choisie depuis la liste des sons du plan. */
  const ambianceDuLieu = {
    lieu: p,
    onChanger: async (itemId: number | null): Promise<void> => {
      await window.jdr.places.upsert({ id: p.id, name: p.name, ambienceItemId: itemId })
      await s.refreshPlaces()
    }
  }

  /* « Sons activés » : le pion d'essai déclenche les sons posés, pour le MJ seul. */
  const [sonsEssai, setSonsEssai] = useState(false)
  useSonsDEssai(sonsEssai, mu.essai, zs.zones, barrieresApercu, natCarte)

  /** La longueur du trait, en part de la largeur de l'image. */
  const longueurDuTrait = (t: { a: PointMur; b: PointMur }): number | null => {
    if (!carte?.width || !carte.height) return null
    const l = Math.hypot(t.b[0] - t.a[0], ((t.b[1] - t.a[1]) * carte.height) / carte.width)
    return l > 1e-4 ? l : null
  }
  const metresSaisis = Number(metresTrait.replace(',', '.'))
  const traitValable = !!trait && metresSaisis > 0 && longueurDuTrait(trait) !== null

  /** Fixer l'échelle au trait : la longueur tapée, rapportée à la largeur du plan. */
  const fixerEchelle = async (): Promise<void> => {
    if (!trait || !traitValable) return
    const l = longueurDuTrait(trait)!
    const e = await window.jdr.places.etalonner(p.id, metresSaisis / l)
    setEch(e)
    finirTrace()
    s.toast(`Échelle fixée : le plan fait ${enMetres(e.metres)} de large`)
  }

  /* Échap renonce à l'étalonnage, hors d'un champ de saisie. */
  useEffect(() => {
    if (trace !== 'etalonner') return
    const touche = (e: KeyboardEvent): void => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return
      if (e.key === 'Escape') finirTrace()
    }
    window.addEventListener('keydown', touche)
    return () => window.removeEventListener('keydown', touche)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trace])
  /* Une pièce découpée n'a pas d'image à elle : c'est celle de son étage
     qu'on remplace, et toutes ses sœurs suivent. */
  const plan = estPiece(p) && niveau ? niveau : p
  /* Un lieu peut n'être qu'une pièce : ses murs le referment, lui — même posé
     à même l'espace, comme la chapelle. Un étage, un bâtiment qui a déjà ses
     niveaux ou une pièce découpée n'ont pas ce choix. */
  const peutEtreUnique =
    p.tier === 'lieu' &&
    !estPiece(p) &&
    !s.places.some((q) => q.parentId === p.id && q.tier === 'niveau')
  const unique = peutEtreUnique && p.pieceUnique

  const reglerUnique = async (oui: boolean): Promise<void> => {
    await window.jdr.places.pieceUnique(p.id, oui)
    await onRelire()
  }

  /**
   * Remplacer l'image sans rien défaire : murs, portes, fenêtres et repères
   * appartiennent au lieu, pas au fichier — ils restent où ils sont. C'est
   * le geste pour la version éclairée d'un plan, celle sans les meubles, ou
   * une meilleure définition du même dessin.
   *
   * Une image d'autres proportions ne les déforme pas : ils gardent leur
   * forme, centrés sur la nouvelle, et l'on rogne ensuite pour la recaler
   * dessous.
   */
  const remplacerImage = async (id: number | null): Promise<void> => {
    setRemplacer(false)
    if (id === null || id === plan.mapItemId) return
    const avant = s.allItems.find((i) => i.id === plan.mapItemId)
    const apres = s.allItems.find((i) => i.id === id)
    const autreForme = proportionsDifferent(avant, apres)
    try {
      const { pieces: n } = await window.jdr.places.remplacerCarte(plan.id, id)
      await onRelire()
      s.toast(
        `Image remplacée — murs et repères conservés${
          autreForme ? ' sans déformation, rogne pour recaler l’image' : ''
        }${n ? `, ${n} pièce${n > 1 ? 's' : ''} suivent` : ''}`
      )
    } catch (e) {
      s.toast('L’image n’a pas été remplacée.', true)
      console.error('[remplacer]', e)
    }
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
   * Ce que les murs ne savent pas trancher.
   *
   * Deux fiches accrochées dans la même pièce : le recalage n'en choisit
   * aucune, et leurs contours restent figés. Une fiche accrochée hors de toute
   * pièce fermée : son contour ne suit plus rien. On le dit, au lieu de
   * laisser la fiche du lieu et le plan du niveau se contredire en silence.
   */
  const aDemeler = useMemo(() => {
    const dans = mu.formes.map((f) => pieces.filter((q) => q.ancre && dansForme(q.ancre, f.pts)))
    return {
      conflits: dans.flatMap((l, i) => (l.length > 1 ? [{ i, lieux: l }] : [])),
      orphelins: pieces.filter((q) => q.zone && q.ancre && !dans.some((l) => l.includes(q))),
      libres: dans.flatMap((l, i) => (l.length === 0 ? [i] : []))
    }
  }, [mu.formes, pieces])

  /* « Objets et PNJ » d'un plan découpé : ce qu'on y ajoute va dans une pièce,
     jamais dans l'étage. La pièce choisie s'allume sur le plan. */
  const piecesQq = useMemo(() => (unique ? [] : pieces.filter(estPiece)), [unique, pieces])
  const pieceRangee = piecesQq.find((q) => q.id === pieceQq) ?? piecesQq[0] ?? null
  useEffect(() => {
    if (onglet !== 'quiquoi' || !pieceRangee) return
    const i = mu.formes.findIndex((f) => lieuDeLaForme(f)?.id === pieceRangee.id)
    mu.setFormeVisee(i < 0 ? null : i)
    return () => mu.setFormeVisee(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onglet, pieceRangee?.id, mu.formes])

  /** Les objets posés en un point du plan, dans l'une de ses pièces. */
  const objetsSurPlan = useMemo(() => {
    const ids = new Set(piecesQq.map((q) => q.id))
    return s.objets.flatMap((o) =>
      o.placements
        .filter((x) => x.port === 'lieu' && x.pos && x.placeId != null && ids.has(x.placeId))
        .map((x) => ({ o, x }))
    )
  }, [s.objets, piecesQq])

  /**
   * Poser un objet en un point du plan. Il ne sort pas de sa pièce : lâché
   * dehors, il est refusé. Un objet sans pièce prend celle où on le lâche.
   */
  const situerObjet = async (id: number, pt: { x: number; y: number }): Promise<boolean> => {
    const o = s.objets.find((y) => y.placements.some((x) => x.id === id))
    const x = o?.placements.find((y) => y.id === id)
    if (!o || !x || x.port !== 'lieu') return false
    const dans = (q: Place): boolean => !!q.zone && dansForme([pt.x, pt.y], q.zone)
    const sienne = piecesQq.find((q) => q.id === x.placeId)
    if (sienne) {
      if (!dans(sienne)) {
        s.toast(`« ${o.nom} » est rangé dans ${sienne.name} : pose-le dans cette pièce`, true)
        return false
      }
      await window.jdr.objets.situer(id, pt)
    } else {
      const q = piecesQq.find(dans)
      if (!q) {
        s.toast('Pose-le dans une pièce du plan', true)
        return false
      }
      await window.jdr.objets.situer(id, pt, q.id)
      setPieceQq(q.id)
    }
    await s.refreshObjets()
    return true
  }

  /** Mettre une fiche dans une pièce sans nom : son contour, et son point dedans. */
  const placerDans = async (lieu: Place, i: number): Promise<void> => {
    const f = mu.formes[i]
    if (!f) return
    await window.jdr.places.zone(lieu.id, f.pts, f.centre)
    mu.setFormeVisee(null)
    await onRelire()
  }

  /**
   * Baptiser une forme : elle devient un lieu de cet étage, avec son contour
   * et le point qui la désigne.
   */
  const nommerForme = async (f: Forme, nom: string): Promise<void> => {
    /* Pièce unique : la forme, c'est le lieu — la renommer, c'est le renommer. */
    if (unique) {
      await window.jdr.places.upsert({ id: p.id, tier: p.tier, parentId: p.parentId, name: nom })
      await onRelire()
      return
    }
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
    if (unique) {
      s.toast('Ce lieu est une pièce unique : choisis « Plusieurs pièces » pour le découper', true)
      return false
    }
    /* Un espace ne tient pas de pièces : « Découper en lieux », dans son
       volet, passe par l'un de ses niveaux. */
    if (p.tier === 'espace') {
      s.toast(
        'Un espace ne tient pas de pièces : trace-les sur l’un de ses niveaux (ajoute-en un dans la liste des lieux)',
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

  const poser = async (kind: 'repere' | 'texte', x: number, y: number): Promise<void> => {
    const a = await window.jdr.annotations.add({ placeId: p.id, kind, x, y })
    await relire()
    /* L'outil se désarme après usage : sinon on sème un repère à chaque clic,
       y compris quand on voulait seulement en choisir un. On revient à
       « Choisir », le repère posé choisi : son texte s'écrit à droite. */
    choisirOutil('choisir')
    setChoisi(a.id)
  }

  /* ---------- Les outils : un seul jeu, plus de modes ----------
     Mur, rideau, porte, fenêtre, lumière et gomme sont les outils du calque
     des murs ; repère et texte, ceux des annotations ; pièce, le tracé d'un
     lieu au rectangle (ou la désignation de ses murs). « Choisir » prend un
     mur, une porte, une lampe ou un repère, selon ce qu'on vise. */
  const outilRail: OutilRail = sonArme
    ? 'son'
    : trace === 'lieu' || mu.pourPiece !== null
      ? 'piece'
      : annote && outil
        ? outil
        : !murs || mu.outil === 'selection'
          ? 'choisir'
          : mu.outil === 'vitre'
            ? 'fenetre'
            : mu.outil
  const sansOutils = !carte?.url || enTest || rognage || trace === 'etalonner'
  const pieceInterdite = estPiece(p) || unique || p.tier === 'espace'

  /* Le volet suit l'outil qu'on prend : on trace une lampe, on voit la
     lumière ; un mur, les traits. « Choisir » et les repères n'y touchent pas. */
  useEffect(() => {
    if (trace === 'etalonner') setOnglet('echelle')
    else if (outilRail === 'lumiere') setOnglet('lumiere')
    else if (outilRail === 'piece') setOnglet('pieces')
    else if (outilRail === 'son') setOnglet('sons')
    else if (['mur', 'rideau', 'porte', 'fenetre', 'gomme'].includes(outilRail)) setOnglet('traits')
  }, [outilRail, trace])

  const choisirOutil = (o: OutilRail): void => {
    finirTrace()
    mu.setPourPiece(null)
    mu.setChoisi(null)
    mu.setOuvChoisie(null)
    mu.setLumChoisie(null)
    setChoisi(null)
    setSonArme(o === 'son')
    zs.setChoisie(null)
    if (o === 'son') {
      setMurs(false)
      setAnnote(false)
      setOutil(null)
      return
    }
    if (o === 'repere' || o === 'texte') {
      setMurs(false)
      setAnnote(true)
      setOutil(o)
      return
    }
    setAnnote(false)
    setOutil(null)
    if (o === 'piece') {
      setMurs(false)
      setTrace('lieu')
      return
    }
    setMurs(true)
    mu.setOutil(o === 'choisir' ? 'selection' : o === 'fenetre' ? 'vitre' : o)
  }

  /* Désigner des murs pour en faire une pièce se fait sur le calque des murs. */
  useEffect(() => {
    if (mu.pourPiece === null) return
    if (trace === 'lieu') finirTrace()
    setMurs(true)
    mu.setOutil('selection')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mu.pourPiece !== null])

  /* Un mur, une porte ou une lampe choisis : le repère choisi se lâche. */
  useEffect(() => {
    if (mu.choisi != null || mu.ouvChoisie != null || mu.lumChoisie != null) setChoisi(null)
  }, [mu.choisi, mu.ouvChoisie, mu.lumChoisie])

  /* Au clavier : une touche par outil, et Échap arrête l'essai. Hors d'un
     champ de saisie, sans Ctrl ni Alt — Ctrl+Z reste à défaire. */
  useEffect(() => {
    const h = (e: KeyboardEvent): void => {
      const el = e.target as HTMLElement | null
      if (el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable)) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'Escape' && enTest) {
        mu.arreterEssai()
        return
      }
      /* Échap repose l'outil Pièce ou Repère, comme le calque des murs le fait
         pour les siens : on revient à « Choisir ». */
      if (e.key === 'Escape' && !sansOutils) {
        if (mu.pourPiece !== null) return void mu.setPourPiece(null)
        if (trace === 'lieu' && rect) return void setRect(null)
        if (sonArme && zs.choisie != null) return void zs.setChoisie(null)
        if (sonArme) return void choisirOutil('choisir')
        if (trace === 'lieu' || annote) return void choisirOutil('choisir')
      }
      if (sansOutils) return
      const o = OUTILS_RAIL.find((x) => x.touche === e.key.toLowerCase())
      if (!o || (o.cle === 'piece' && pieceInterdite)) return
      e.preventDefault()
      choisirOutil(o.cle)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  const lancerGeste = (g: 'caler' | 'rogner' | 'etalonner' | 'remplacer'): void => {
    setMenuImage(null)
    if (g === 'remplacer') return void setRemplacer(true)
    choisirOutil('choisir')
    if (g === 'caler') setCalage({ z: 1, ox: 0, oy: 0, r: 0 })
    else setTrace(g)
  }
  const annulerGeste = (): void => {
    finirTrace()
    setCalage(null)
  }

  /* Le volet : ce qui est choisi, sinon l'état du plan. */
  const lampeChoisie = mu.lumChoisie != null && mu.lumieres.some((l) => l.id === mu.lumChoisie)
  const ouvChoisie = mu.ouvChoisie != null && mu.ouvertures.some((o) => o.id === mu.ouvChoisie)
  const traitChoisi = murs && mu.outil === 'selection' && mu.choisi != null && mu.liste.some((t) => t.id === mu.choisi)
  const vueJoueursOn = enTest ? !mursVisibles : vueJoueurs
  const portes = mu.ouvertures.filter((o) => o.nature === 'porte').length
  const fenetres = mu.ouvertures.length - portes

  /* L'outil en main, dit en clair, avec ses gestes et ses touches. */
  const barreOutil = (): JSX.Element => {
    if (enTest)
      return (
        <div className="annot-barre pe-barre pe-essai">
          <span className="pe-nom">Essai</span>
          <AideMurs m={mu} />
          <div className="spacer" />
          <span className="note">rien n’est enregistré</span>
          <button className="btn btn-sm" onClick={() => mu.arreterEssai()}>
            Arrêter l’essai <kbd>Échap</kbd>
          </button>
        </div>
      )
    if (calage || trace === 'rogner' || trace === 'etalonner') {
      const nom = calage ? 'Déplacer, zoomer, tourner l’image' : trace === 'rogner' ? 'Rogner' : 'Étalonner l’échelle'
      const valider = calage ? 'Caler ici' : trace === 'rogner' ? 'Rogner à ce cadre' : 'Fixer l’échelle'
      const peut = calage ? !occupe : trace === 'rogner' ? !!rect && !occupe : traitValable
      return (
        <div className="annot-barre pe-barre pe-geste">
          <span className="pe-nom">{nom}</span>
          {calage ? (
            <>
              <label htmlFor="cal-zoom">Zoom</label>
              <input
                id="cal-zoom"
                type="range"
                min={20}
                max={800}
                step={0.5}
                value={Math.round(calage.z * 1000) / 10}
                onChange={(e) => {
                  const z = Number(e.target.value) / 100
                  setCalage((c) => (c ? { ...c, z, ox: (c.ox * z) / c.z, oy: (c.oy * z) / c.z } : c))
                }}
              />
              <Valeur
                className="v"
                value={Math.round(calage.z * 1000) / 10}
                min={20}
                max={800}
                step={0.1}
                decimales={1}
                unite=" %"
                label="Zoom de l’image"
                onChange={(n) => {
                  const z = n / 100
                  setCalage((c) => (c ? { ...c, z, ox: (c.ox * z) / c.z, oy: (c.oy * z) / c.z } : c))
                }}
              />
              {/* Le décalage, en part du cadre : 0 au centre, ± 100 % d'un
                  cadre entier. Le curseur ne couvre que ± 20 %, pour viser
                  fin ; au-delà, on glisse l'image ou l'on tape la valeur. */}
              {(['ox', 'oy'] as const).map((k) => {
                const v = Math.round(calage[k] * 1000) / 10
                const regler = (n: number): void => setCalage((c) => (c ? { ...c, [k]: n / 100 } : c))
                return (
                  <Fragment key={k}>
                    <label htmlFor={`cal-${k}`}>{k === 'ox' ? 'Horizontal' : 'Vertical'}</label>
                    <input
                      id={`cal-${k}`}
                      type="range"
                      min={-20}
                      max={20}
                      step={0.1}
                      value={v}
                      onChange={(e) => regler(Number(e.target.value))}
                    />
                    <Valeur
                      className="v"
                      value={v}
                      min={-200}
                      max={200}
                      step={0.1}
                      decimales={1}
                      unite=" %"
                      label={k === 'ox' ? 'Décalage horizontal de l’image' : 'Décalage vertical de l’image'}
                      onChange={regler}
                    />
                  </Fragment>
                )
              })}
              <label htmlFor="cal-r" title="Double-clic sur le curseur : droite">
                Rotation
              </label>
              <input
                id="cal-r"
                type="range"
                min={-180}
                max={180}
                step={0.5}
                value={calage.r}
                title="Double-clic : droite"
                onChange={(e) => {
                  const r = Number(e.target.value)
                  setCalage((c) => (c ? { ...c, r } : c))
                }}
                onDoubleClick={() => setCalage((c) => (c ? { ...c, r: 0 } : c))}
              />
              <Valeur
                className="v"
                value={calage.r}
                min={-180}
                max={180}
                step={0.5}
                decimales={1}
                unite="°"
                label="Rotation de l’image"
                onChange={(r) => setCalage((c) => (c ? { ...c, r } : c))}
              />
              <label className="coche" title="Une grille droite sur la carte, pour juger l’aplomb">
                <input type="checkbox" checked={grille} onChange={(e) => setGrille(e.target.checked)} />
                <span>Grille</span>
              </label>
              <span className="note">Glisser : déplacer · molette : zoomer (Ctrl, plus fin) · double-clic : revenir au départ</span>
            </>
          ) : trace === 'rogner' ? (
            <span className="note">
              {rect
                ? 'Tire les bords du cadre pour l’ajuster · une copie est faite, l’originale reste dans son dossier'
                : 'Glisse sur la carte pour entourer ce que tu gardes · molette pour zoomer, clic molette glissé pour déplacer'}
            </span>
          ) : !trait ? (
            <span className="note">Tire un trait sur une longueur que tu connais : un mur, une case de la grille, une table.</span>
          ) : (
            <>
              <label className="etal-champ">
                Ce trait mesure
                <input
                  type="text"
                  inputMode="decimal"
                  autoFocus
                  value={metresTrait}
                  onChange={(e) => setMetresTrait(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void fixerEchelle()
                    } else if (e.key === 'Escape') finirTrace()
                  }}
                />
                m
              </label>
              <button className="btn btn-sm btn-ghost" onClick={() => setTrait(null)}>
                Retracer
              </button>
            </>
          )}
          <div className="spacer" />
          <button className="btn btn-sm btn-ghost" onClick={annulerGeste}>
            Annuler <kbd>Échap</kbd>
          </button>
          <button
            className="btn btn-sm btn-brass"
            disabled={!peut}
            onClick={() => void (calage ? caler() : trace === 'rogner' ? rogner() : fixerEchelle())}
          >
            <IconCheck />
            {valider} <kbd>Entrée</kbd>
          </button>
        </div>
      )
    }
    const o = OUTILS_RAIL.find((x) => x.cle === outilRail)!
    return (
      <div className={`annot-barre pe-barre${o.mj ? ' pe-mj' : ''}`}>
        <span className="pe-nom">{o.label}</span>
        {outilRail === 'mur' || outilRail === 'rideau' ? (
          <>
            <button
              className="btn btn-sm"
              aria-pressed={mu.aimant}
              title="Le trait s’accroche aux murs existants, à leurs angles et aux angles droits"
              onClick={() => mu.setAimant(!mu.aimant)}
            >
              <IconAimant />
              Colle aux murs
            </button>
            <button
              className="btn btn-sm"
              aria-pressed={mu.loupe}
              title="Elle suit le curseur pendant le tracé pour viser au pixel"
              onClick={() => mu.setLoupe(!mu.loupe)}
            >
              <IconLoupe />
              Loupe
            </button>
          </>
        ) : null}
        {outilRail === 'lumiere' ? (
          <>
            <button
              className={`btn btn-sm${mu.apercuLum ? ' btn-on' : ''}`}
              aria-pressed={mu.apercuLum}
              disabled={!mu.lumieres.length}
              title={
                mu.lumieres.length
                  ? 'Voir la carte comme la lumière la laisse : ce qui reste noir restera noir pour les joueurs'
                  : 'Pose d’abord une lumière : il n’y aurait rien à montrer'
              }
              onClick={() => mu.setApercuLum(!mu.apercuLum)}
            >
              <IconSoleil />
              Ombre et lumière
            </button>
          </>
        ) : null}
        {outilRail === 'piece' ? (
          trace === 'lieu' && rect ? (
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
              <button className="btn btn-sm btn-brass" disabled={!nomLieu.trim() || occupe} onClick={() => void creerAuRectangle()}>
                <IconCheck />
                Créer <kbd>Entrée</kbd>
              </button>
            </>
          ) : (
            <FormerPiece m={mu} onNommer={(contour, nom) => void formerPiece(contour, nom)} />
          )
        ) : null}
        {outilRail === 'piece' ? (
          mu.pourPiece === null && !rect ? (
            <span className="note">
              Glisse un rectangle sur le vide pour faire un lieu · glisse un lieu pour le déplacer, tire ses coins ·
              ou désigne les murs qui le bornent. Les murs fermés font déjà des pièces : nomme-les à droite.
            </span>
          ) : null
        ) : outilRail === 'son' ? (
          <span className="note">
            Clique sur le plan pour poser un son · glisse le cercle pour le déplacer, tire sa poignée pour
            l’agrandir · <kbd>Suppr</kbd> retire · jamais chez les joueurs
          </span>
        ) : o.mj ? (
          <span className="note">Clique sur le plan pour poser · jamais chez les joueurs</span>
        ) : outilRail === 'choisir' ? (
          <span className="note">
            Clique un mur, une porte, une lampe ou un repère pour le régler à droite · glisse pour déplacer ·{' '}
            <b>double-clic</b> ajoute un sommet · <b>Alt + clic</b> coupe · <kbd>Suppr</kbd> retire
          </span>
        ) : (
          <AideMurs m={mu} />
        )}
      </div>
    )
  }

  return (
    <section className="view pe">
      <div className="vhead pe-tete">
        {estPiece(p) && niveau ? (
          <button
            className="btn btn-ghost"
            onClick={onMurs}
            disabled={rognage}
            title="Revoir cette pièce sur le plan de son étage, avec ses murs"
          >
            <IconMurs />
            Voir les murs de l’étage
          </button>
        ) : null}
        <div className="spacer" />
        {plan.mapItemId ? (
          <div className="pe-menu-hote">
            <button
              className="btn"
              aria-expanded={!!menuImage}
              disabled={rognage || enTest}
              onClick={(e) => {
                if (menuImage) return setMenuImage(null)
                const b = e.currentTarget.getBoundingClientRect()
                setMenuImage({ x: b.right - 290, y: b.bottom + 6 })
              }}
            >
              <IconImage />
              Image ▾
            </button>
            {menuImage ? (
              <Pop x={menuImage.x} y={menuImage.y} className="menu-donner pe-menu" onClose={() => setMenuImage(null)}>
                {carte?.url && !estPiece(p) ? (
                  <button className="opt" onClick={() => lancerGeste('caler')}>
                    <IconCadrage />
                    <span>
                      Déplacer, zoomer, tourner
                      <span className="pe-det">Les murs restent ; l’image glisse dessous</span>
                    </span>
                  </button>
                ) : null}
                {carte?.url && !estPiece(p) ? (
                  <button className="opt" onClick={() => lancerGeste('rogner')}>
                    <IconCadrage />
                    <span>
                      Rogner
                      <span className="pe-det">Une copie ; l’originale reste dans son dossier</span>
                    </span>
                  </button>
                ) : null}
                {carte?.url ? (
                  <button className="opt" onClick={() => lancerGeste('etalonner')}>
                    <IconRegle />
                    <span>
                      Étalonner l’échelle
                      <span className="pe-det">Tirer un trait de longueur connue</span>
                    </span>
                  </button>
                ) : null}
                <button className="opt" onClick={() => lancerGeste('remplacer')}>
                  <IconImage />
                  <span>
                    Remplacer l’image…
                    <span className="pe-det">
                      {plan === p ? 'Murs, fenêtres et repères restent en place' : `L’image de ${plan.name} — ses pièces suivent`}
                    </span>
                  </span>
                </button>
              </Pop>
            ) : null}
          </div>
        ) : null}
        {/* Toujours là, quel que soit l'outil : un coup d'œil au noir, bouton tenu. */}
        {carte?.url ? <BoutonTestLumiere m={mu} /> : null}
        {carte?.url ? (
          /* Entrer dans l'essai et en sortir sont deux gestes contraires : ils ne
             se ressemblent pas. Vert on essaie, rouge on s'arrête. */
          <button
            className={`btn ${enTest ? 'btn-sortie' : 'btn-essai'}`}
            disabled={rognage}
            title={
              enTest
                ? 'Ranger le pion d’essai — Échap'
                : 'Poser un pion d’essai : il ne traverse pas, et il ne voit que ce que les murs lui laissent voir'
            }
            onClick={() => {
              if (enTest) return void mu.arreterEssai()
              choisirOutil('choisir')
              setMursVisibles(true)
              setVueJoueurs(false)
              void mu.commencerEssai()
            }}
          >
            {enTest ? 'Arrêter l’essai' : 'Essayer avec un pion'}
          </button>
        ) : null}
        {onTermine ? (
          /* En haut à droite, au bout de la barre (choix de Jules) : on a fini,
             on rentre à la fiche. */
          <button className="btn btn-brass fl-termine" onClick={onTermine} disabled={rognage}>
            <IconCheck />
            Terminé
          </button>
        ) : null}
      </div>

      <div className="fiche-lieu pe-corps annote">
        {carte?.url ? (
          <nav className="pe-outils" aria-label="Outils du plan">
            {OUTILS_RAIL.map((o, i) => (
              <Fragment key={o.cle}>
                {o.groupe && (i === 0 || OUTILS_RAIL[i - 1].groupe !== o.groupe) ? (
                  <span className="pe-groupe">{o.groupe}</span>
                ) : null}
                <button
                  className={`pe-outil${o.mj ? ' mj' : ''}${outilRail === o.cle && !sansOutils ? ' on' : ''}`}
                  aria-pressed={outilRail === o.cle && !sansOutils}
                  aria-label={o.label}
                  title={`${o.label} — ${o.touche.toUpperCase()}${o.cle === 'piece' && pieceInterdite ? ' · pas ici : ' + (unique ? 'le lieu est une pièce unique' : estPiece(p) ? 'trace-la sur le plan de l’étage' : 'un espace se découpe par un niveau') : ''}`}
                  disabled={sansOutils || (o.cle === 'piece' && pieceInterdite)}
                  onClick={() => choisirOutil(o.cle)}
                >
                  {o.icone}
                  <span className="pe-touche">{o.touche.toUpperCase()}</span>
                </button>
              </Fragment>
            ))}
          </nav>
        ) : null}

        <div className="fl-carte">
          {carte?.url ? barreOutil() : null}

          <div className="fl-image">
            {carte?.url ? (
              /* Le cadre prend les proportions de l'image : elle s'affiche
                 entière — ou cadrée sur la zone de la pièce — et les repères
                 tombent exactement dessus. */
              <CadreAnnote url={carte.url} zoomable={!p.zone && !calage} zone={p.zone ? boiteDe(p.zone) : null}>
                {/* Le filtre ne touche que l'image : repères, murs et pions
                    gardent leurs couleurs, sans quoi on ne les lirait plus.
                    Au calage, elle seule bouge : le calque reste. */}
                <img
                  src={carte.url}
                  alt={carte.title}
                  draggable={false}
                  onLoad={(e) => setNatCarte({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                  style={{
                    ...(lum === 100 ? {} : { filter: `brightness(${lum}%)` }),
                    ...(calage
                      ? {
                          transform: `translate(${calage.ox * 100}%, ${calage.oy * 100}%) scale(${zoomCalage(calage)}) rotate(${calage.r}deg)`
                        }
                      : {})
                  }}
                />
                {(calage && grille) || (calques.grille && !calage) ? <div className="cal-grille" aria-hidden="true" /> : null}
                {calage ? <CalqueCalage vue={calage} onVue={setCalage} /> : null}
                {annote && calques.mj ? (
                  <Annotations
                    annotations={liste}
                    mode="edition"
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
                {trace === 'rogner' ? <CalqueRectangle rect={rect} assombrir onRect={setRect} /> : null}
                {trace === 'etalonner' ? (
                  <CalqueTrait
                    trait={trait}
                    onTrait={(t) => {
                      setTrait(t)
                      /* On propose la longueur que dit l'échelle actuelle : souvent,
                         on n'a qu'à confirmer — ou à corriger. */
                      const l = longueurDuTrait(t)
                      setMetresTrait(ech?.metres && l ? String(Math.round(ech.metres * l * 10) / 10).replace('.', ',') : '')
                    }}
                  />
                ) : null}
                {ech?.metres ? <RegleEchelle metres={ech.metres} zone={p.zone ? boiteDe(p.zone) : null} /> : null}
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
                {/* Les murs se voient toujours ; on n'y touche qu'avec leurs outils. */}
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
                  nomDeForme={(f) => (unique ? p.name : (lieuDeLaForme(f)?.name ?? null))}
                  ouvChoisie={mu.ouvChoisie}
                  onOuvChoisie={mu.setOuvChoisie}
                  onPoserOuverture={(murId, n, d) => void mu.poserOuverture(murId, n, d)}
                  onNommer={(f, nom) => void nommerForme(f, nom)}
                  joindre={mu.joindre}
                  onJoindreFini={() => mu.setJoindre(false)}
                  traitsCaches={(enTest && !mursVisibles) || (!enTest && (vueJoueurs || !calques.murs))}
                  mode={rognage || trace !== null || !(murs || enTest) ? 'lecture' : 'edition'}
                  outil={mu.outil}
                  /* La nature du trait suit l'outil : le Rideau trace des
                     rideaux. Elle restait à « mur » depuis la 1.0.0, quel
                     que soit l'outil. */
                  nature={mu.outil === 'rideau' ? 'rideau' : 'mur'}
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
                  onDeplacerOuverture={(id, d, murId) => void mu.reglerOuverture(id, { d, murId })}
                  onVerrouiller={(id, v) => void mu.verrouiller(id, v)}
                  onAccorder={(id) => void mu.accorder(id)}
                  onGommer={(retraits) => void mu.gommer(retraits)}
                  onGommeTaille={mu.setGomme}
                  onBrouillard={mu.setNoir}
                  essai={mu.essai}
                  pionPourcent={ech?.pionPourcent}
                  onEssai={mu.setEssai}
                  largeurOuv={mu.largeurDefaut ?? s.reglages.mursLargeur}
                  apercuLum={mu.apercuLum}
                  testLum={mu.testLum}
                  lumieres={calques.lumieres || enTest ? mu.lumieres : []}
                  lumChoisie={mu.lumChoisie}
                  lumGarde={mu.lumGarde}
                  astre={mu.astre}
                  nord={mu.nord}
                  voirAstre={mu.voirAstre}
                  regardPortee={mu.regardPortee}
                  onLumChoisie={mu.setLumChoisie}
                  onOutil={mu.setOutil}
                  onPoserLumiere={(x, y) => void mu.poserLumiere(x, y)}
                  onReglerLumiere={(id, patch) => void mu.reglerLumiere(id, patch)}
                  onOterLumiere={(id) => void mu.oterLumiere(id)}
                />
                {/* Avec « Choisir », les repères se prennent par-dessus les murs ;
                    le vide, lui, laisse passer le clic vers eux. */}
                {!annote && calques.mj && !vueJoueursOn && liste.length ? (
                  <Annotations
                    annotations={liste}
                    mode={outilRail === 'choisir' && !sansOutils ? 'edition' : 'lecture'}
                    traversant
                    choisi={choisi}
                    onChoisir={(id) => {
                      if (id != null) {
                        mu.setChoisi(null)
                        mu.setOuvChoisie(null)
                        mu.setLumChoisie(null)
                      }
                      setChoisi(id)
                    }}
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
                {/* Les sons posés : du MJ seul, comme les repères. */}
                {sonArme || (calques.mj && !vueJoueursOn && !enTest && zs.zones.length) ? (
                  <CalqueSons z={zs} arme={sonArme && !sansOutils} />
                ) : null}
                {apercuPion && ech ? (
                  <ApercuPion taille={ech.pionPourcent} pose={poseApercu} onPose={setPoseApercu} />
                ) : null}
                {/* Les objets posés : du MJ seul. Ils ne se prennent qu'avec
                    l'onglet « Objets et PNJ » ouvert, pour ne pas gêner le tracé. */}
                {piecesQq.length && calques.mj && !vueJoueursOn && !enTest ? (
                  <CalqueObjets
                    objets={objetsSurPlan}
                    actif={onglet === 'quiquoi' && !sansOutils}
                    onSituer={situerObjet}
                    onOuvrir={(x) => {
                      if (x.placeId != null) setPieceQq(x.placeId)
                      setOnglet('quiquoi')
                      setOuvrirQq((v) => ({ cle: `objet-${x.objetId}`, n: (v?.n ?? 0) + 1 }))
                    }}
                  />
                ) : null}
              </CadreAnnote>
            ) : (
              <div className="fl-sans">
                <IconPlace />
                <b>Aucune carte</b>
                Ajoute-lui une carte pour tracer ses murs et l’annoter.
              </div>
            )}

            {carte?.url ? (
              <>
                {/* Ce qu'on montre ou cache, sans changer d'outil. */}
                <div className="pe-calques" role="group" aria-label="Calques">
                  {(
                    [
                      ['murs', 'Murs'],
                      ['lumieres', 'Lumières'],
                      ['mj', 'Repères MJ'],
                      ['grille', 'Grille']
                    ] as const
                  ).map(([k, l]) => (
                    <button
                      key={k}
                      aria-pressed={calques[k]}
                      onClick={() => setCalques((c) => ({ ...c, [k]: !c[k] }))}
                      title={calques[k] ? `Cacher : ${l.toLowerCase()}` : `Montrer : ${l.toLowerCase()}`}
                    >
                      <i />
                      {l}
                    </button>
                  ))}
                </div>
                {/* Ce qui ne touche que l'affichage : rien ici ne s'enregistre. */}
                <div className="pe-vue">
                  <span title="Pour y voir — n’est pas enregistré, et revient à 100 % au changement de lieu">
                    <IconSoleil />
                  </span>
                  <input
                    type="range"
                    min={40}
                    max={220}
                    step={5}
                    value={lum}
                    aria-label="Luminosité de l’affichage"
                    onChange={(e) => setLum(Number(e.target.value))}
                    onDoubleClick={() => setLum(100)}
                  />
                  <Valeur className="v" value={lum} min={40} max={220} step={5} unite=" %" label="Luminosité" onChange={setLum} />
                  <span className="pe-sep" />
                  <button
                    aria-pressed={vueJoueursOn}
                    disabled={!enTest && !mu.lumieres.length}
                    title={
                      enTest
                        ? 'Le plan comme les joueurs le voient : l’ombre seule, sans les murs'
                        : mu.lumieres.length
                          ? 'Le plan comme la lumière le laisse aux joueurs, sans murs ni repères'
                          : 'Pose d’abord une lumière, ou lance un essai avec un pion'
                    }
                    onClick={() => {
                      if (enTest) return setMursVisibles((v) => !v)
                      const v = !vueJoueurs
                      setVueJoueurs(v)
                      mu.setApercuLum(v)
                    }}
                  >
                    Vue joueurs
                  </button>
                </div>
              </>
            ) : null}
          </div>

          {carte?.url ? (
            <div className="pe-etat">
              <span>
                Échelle <b>{ech?.metres ? `${enMetres(ech.metres)} de large` : 'inconnue'}</b>
              </span>
              <span>
                <b>{mu.liste.length}</b> trait{mu.liste.length > 1 ? 's' : ''} · <b>{portes}</b> porte{portes > 1 ? 's' : ''} ·{' '}
                <b>{fenetres}</b> fenêtre{fenetres > 1 ? 's' : ''} · <b>{mu.lumieres.length}</b> lampe{mu.lumieres.length > 1 ? 's' : ''}
                {liste.length ? (
                  <>
                    {' '}
                    · <b>{liste.length}</b> repère{liste.length > 1 ? 's' : ''}
                  </>
                ) : null}
              </span>
              <div className="spacer" />
              <span>
                <kbd>Ctrl</kbd>+<kbd>Z</kbd> défaire · <kbd>Ctrl</kbd>+<kbd>Y</kbd> refaire · molette : zoomer · clic molette glissé : déplacer
              </span>
              <span className="pe-enreg">Enregistré au fur et à mesure</span>
            </div>
          ) : null}
        </div>

        <aside className="fl-cote pe-volet">
          {enTest ? (
            <VoletMurs
              m={mu}
              essaiEnPlus={
                mu.essai ? (
                  <div className="fl-bloc">
                    <span className="eyebrow">Pilote</span>
                    <Pilote
                      onPousse={(v) => (pousseEssai.current = v)}
                      note="Pousse le pilote : le pion d’essai marche comme celui d’un joueur sur son téléphone, à l’allure de ce plan, et les murs le retiennent."
                    />
                    <div className="murs-rangee">
                      <button
                        className={`btn btn-sm${sonsEssai ? ' btn-on' : ''}`}
                        aria-pressed={sonsEssai}
                        title="Le pion d’essai déclenche les sons posés — dans ton casque seulement, pas à la table"
                        onClick={() => setSonsEssai((v) => !v)}
                      >
                        <IconNote />
                        Sons activés
                      </button>
                    </div>
                    <p className="note">
                      {sonsEssai
                        ? zs.zones.length
                          ? 'Promène le pion : chaque son posé part quand il entre dans son cercle, et les murs l’arrêtent. Tu es seul à l’entendre.'
                          : 'Aucun son posé sur ce plan.'
                        : 'Les sons posés restent muets pendant l’essai.'}
                    </p>
                  </div>
                ) : null
              }
            />
          ) : sonArme ? (
            <VoletSons z={zs} pieces={piecesQq} metres={ech?.metres ?? null} ambiance={ambianceDuLieu} />
          ) : lampeChoisie ? (
            <div className="pe-choix">
              <BarreLumiere m={mu} />
            </div>
          ) : ouvChoisie ? (
            <div className="pe-choix">
              <BarreOuverture m={mu} />
            </div>
          ) : traitChoisi ? (
            <div className="pe-choix">
              <BarreTrait m={mu} />
            </div>
          ) : enCours ? (
            <NoteAnnotation
              a={enCours}
              total={liste.length}
              onEcrire={async (texte) => {
                await window.jdr.annotations.update(enCours.id, { texte })
                await relire()
              }}
              onCouleur={async (color) => {
                await window.jdr.annotations.update(enCours.id, { color })
                await relire()
              }}
            />
          ) : (
            <>
              <h3 className="pe-volet-titre">Le plan de {p.name}</h3>
              <div className="pe-onglets" role="tablist" aria-label="Le plan">
                {(
                  [
                    ['echelle', 'Échelle', null],
                    ['pieces', 'Pièces', unique ? null : mu.formes.length],
                    ['lumiere', 'Lumière', mu.lumieres.length],
                    ['traits', 'Traits', mu.liste.length],
                    ['quiquoi', 'Objets et PNJ', null],
                    ['sons', 'Sons', zs.zones.length]
                  ] as const
                ).map(([k, l, n]) => (
                  <button
                    key={k}
                    role="tab"
                    aria-selected={onglet === k}
                    onClick={() => {
                      /* La pièce qu'on regardait dans « Pièces » est celle qu'on garnit. */
                      const vue = mu.formeVisee !== null ? mu.formes[mu.formeVisee] : undefined
                      const l = k === 'quiquoi' && vue ? lieuDeLaForme(vue) : null
                      if (l) setPieceQq(l.id)
                      setOnglet(k)
                    }}
                  >
                    {l}
                    {n !== null ? <span className="n">{n}</span> : null}
                  </button>
                ))}
              </div>
              {onglet === 'echelle' && ech ? (
                <VoletEchelle
                  ech={ech}
                  onEtalonner={() => lancerGeste('etalonner')}
                  onRevenir={async () => setEch(await window.jdr.places.etalonner(p.id, null))}
                  onPionMain={async (main) => setEch(await window.jdr.pions.main(p.id, main))}
                  onTaille={async (v) => {
                    await window.jdr.pions.size(p.id, v)
                    setEch(await window.jdr.places.echelle(p.id))
                  }}
                  apercu={apercuPion}
                  onApercu={() => {
                    if (!apercuPion) setPoseApercu({ x: 0.5, y: 0.5, cap: 0 })
                    setApercuPion((a) => !a)
                  }}
                  onAllure={async (v) => setEch(await window.jdr.pions.allure(p.id, v))}
                  onPousse={(v) => (pousseApercu.current = v)}
                />
              ) : null}
              {onglet === 'pieces' && (aDemeler.conflits.length || aDemeler.orphelins.length) ? (
                <div className="fl-bloc murs-conflit">
                  <span className="eyebrow">À démêler</span>
                  {aDemeler.conflits.map((c) => (
                    <div key={`c${c.i}`} onMouseEnter={() => mu.setFormeVisee(c.i)} onMouseLeave={() => mu.setFormeVisee(null)}>
                      <p>
                        {c.lieux.map((q) => `« ${q.name} »`).join(' et ')} sont accrochés à la même pièce : aucun ne suit les
                        murs.
                      </p>
                      {c.lieux.slice(1).map((q) => (
                        <PlacerDans
                          key={q.id}
                          lieu={q}
                          libres={aDemeler.libres}
                          onVoir={mu.setFormeVisee}
                          onPlacer={(i) => void placerDans(q, i)}
                        />
                      ))}
                    </div>
                  ))}
                  {aDemeler.orphelins.map((q) => (
                    <div key={`o${q.id}`}>
                      <p>« {q.name} » n’est dans aucune pièce fermée : son contour ne suit plus les murs.</p>
                      <PlacerDans
                        lieu={q}
                        libres={aDemeler.libres}
                        onVoir={mu.setFormeVisee}
                        onPlacer={(i) => void placerDans(q, i)}
                      />
                    </div>
                  ))}
                </div>
              ) : null}
              {onglet === 'quiquoi' && pieceRangee ? (
                <>
                  <div className="pe-qq-pieces">
                    <span className="eyebrow">Dans la pièce</span>
                    <div role="radiogroup" aria-label="Dans quelle pièce">
                      {piecesQq.map((q) => (
                        <button
                          key={q.id}
                          role="radio"
                          aria-checked={q.id === pieceRangee.id}
                          onClick={() => setPieceQq(q.id)}
                        >
                          {q.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <QuiQuoiDuLieu p={pieceRangee} surPlan ouvrir={ouvrirQq} />
                </>
              ) : onglet === 'quiquoi' ? (
                <QuiQuoiDuLieu p={p} />
              ) : null}
              {/* Les sons posés, rangés par pièce : un son qu'on choisit prend
                  l'outil Son, pour le régler et le déplacer sur le plan. */}
              {onglet === 'sons' ? (
                <VoletSons
                  z={zs}
                  pieces={piecesQq}
                  metres={ech?.metres ?? null}
                  ambiance={ambianceDuLieu}
                  onChoisir={
                    sansOutils
                      ? undefined
                      : (id) => {
                          choisirOutil('son')
                          zs.setChoisie(id)
                        }
                  }
                />
              ) : null}
              {onglet === 'echelle' || onglet === 'quiquoi' || onglet === 'sons' ? null : (
              <VoletMurs
                m={mu}
                nomDeForme={(f) => (unique ? p.name : (lieuDeLaForme(f)?.name ?? null))}
                onNommer={(f, nom) => void nommerForme(f, nom)}
                onEffacerPiece={(f) => void effacerPiece(f)}
                pieceUnique={unique}
                onPieceUnique={peutEtreUnique ? (oui) => void reglerUnique(oui) : undefined}
                onglet={onglet}
              />
              )}
              {onTermine ? (
                <p className="pe-vers-fiche">
                  Le texte à lire, les secrets, les objets et les PNJ se préparent dans{' '}
                  <button className="lien" onClick={onTermine}>
                    la fiche de {p.name}
                  </button>
                  .
                </p>
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

/** Un outil de la barre de gauche : sa touche, son icône, son groupe. */
type OutilRail = 'choisir' | 'mur' | 'rideau' | 'porte' | 'fenetre' | 'lumiere' | 'piece' | 'gomme' | 'repere' | 'texte' | 'son'

const OUTILS_RAIL: { cle: OutilRail; label: string; touche: string; groupe?: string; mj?: boolean; icone: JSX.Element }[] = [
  { cle: 'choisir', label: 'Choisir', touche: 'v', icone: <IconSouris /> },
  { cle: 'mur', label: 'Mur', touche: 'm', groupe: 'Tracer', icone: <IconOutilMur /> },
  { cle: 'rideau', label: 'Rideau', touche: 'r', groupe: 'Tracer', icone: <IconOutilRideau /> },
  { cle: 'porte', label: 'Porte', touche: 'p', groupe: 'Tracer', icone: <IconOutilPorte /> },
  { cle: 'fenetre', label: 'Fenêtre', touche: 'f', groupe: 'Tracer', icone: <IconOutilFenetre /> },
  { cle: 'lumiere', label: 'Lumière', touche: 'l', groupe: 'Tracer', icone: <IconSoleil /> },
  { cle: 'piece', label: 'Pièce', touche: 'q', groupe: 'Tracer', icone: <IconOutilPiece /> },
  { cle: 'gomme', label: 'Gomme', touche: 'e', groupe: 'Tracer', icone: <IconGomme /> },
  { cle: 'repere', label: 'Repère', touche: 'a', groupe: 'MJ', mj: true, icone: <IconCercle /> },
  { cle: 'texte', label: 'Texte', touche: 't', groupe: 'MJ', mj: true, icone: <IconType /> },
  /* Un son posé : il part quand un pion entre dans son cercle. */
  { cle: 'son', label: 'Son', touche: 's', groupe: 'MJ', mj: true, icone: <IconNote /> }
]

/* Les icônes des outils qui n'en avaient pas : un trait, un rideau, une porte,
   une fenêtre, un contour de pièce. */
function IconOutilMur(): JSX.Element {
  return (
    <svg className="ico" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.1" aria-hidden="true">
      <path d="M2.5 13.5 13.5 2.5" />
      <circle cx="2.5" cy="13.5" r="1.3" />
      <circle cx="13.5" cy="2.5" r="1.3" />
    </svg>
  )
}
function IconOutilRideau(): JSX.Element {
  return (
    <svg className="ico" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.1" aria-hidden="true">
      <path d="M2.5 2v12M13.5 2v12M2.5 3c2.2 2 2.2 8 0 10M13.5 3c-2.2 2-2.2 8 0 10" />
    </svg>
  )
}
function IconOutilPorte(): JSX.Element {
  return (
    <svg className="ico" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.1" aria-hidden="true">
      <rect x="4" y="2" width="8" height="12" rx="0.5" />
      <circle cx="10" cy="8.5" r="0.8" />
    </svg>
  )
}
function IconOutilFenetre(): JSX.Element {
  return (
    <svg className="ico" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.1" aria-hidden="true">
      <rect x="3" y="3" width="10" height="10" />
      <path d="M8 3v10M3 8h10" />
    </svg>
  )
}
function IconOutilPiece(): JSX.Element {
  return (
    <svg className="ico" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.1" aria-hidden="true">
      <rect x="2.5" y="3.5" width="11" height="9" strokeDasharray="2 2" />
    </svg>
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

/** L'image au calage : agrandie, décalée, tournée sous les murs qui restent. */
type Calage = { z: number; ox: number; oy: number; r: number }

/**
 * De combien réduire une image tournée de `r` degrés pour qu'elle tienne
 * entière dans le cadre qu'elle remplissait droite. 1 à plat ; à un quart de
 * tour, le rapport de ses côtés.
 */
function tienDans(nat: { w: number; h: number } | null, r: number): number {
  if (!nat?.w || !nat.h || !r) return 1
  const a = (r * Math.PI) / 180
  const c = Math.abs(Math.cos(a))
  const sn = Math.abs(Math.sin(a))
  return Math.min(nat.w / (nat.w * c + nat.h * sn), nat.h / (nat.w * sn + nat.h * c))
}

/**
 * L'image tournée de `r` degrés (sens horaire), dessinée dans sa boîte
 * englobante. Les coins vides restent transparents en PNG, noirs en JPEG —
 * une photo de plan ne gagne rien à quadrupler de poids. Le protocole `jdr:`
 * autorise la lecture : la toile n'est pas souillée.
 */
async function dessinerTournee(
  url: string,
  r: number
): Promise<{ octets: Uint8Array; jpeg: boolean; w: number; h: number; w2: number; h2: number }> {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = url
  await img.decode()
  const w = img.naturalWidth
  const h = img.naturalHeight
  const a = (r * Math.PI) / 180
  const c = Math.abs(Math.cos(a))
  const sn = Math.abs(Math.sin(a))
  const w2 = Math.ceil(w * c + h * sn)
  const h2 = Math.ceil(w * sn + h * c)
  const jpeg = /\.jpe?g(?:$|[?#])/i.test(url)
  const toile = document.createElement('canvas')
  toile.width = w2
  toile.height = h2
  const ctx = toile.getContext('2d')
  if (!ctx) throw new Error('Impossible de dessiner l’image tournée')
  if (jpeg) {
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, w2, h2)
  }
  ctx.imageSmoothingQuality = 'high'
  ctx.translate(w2 / 2, h2 / 2)
  ctx.rotate(a)
  ctx.drawImage(img, -w / 2, -h / 2)
  const blob = await new Promise<Blob | null>((ok) =>
    toile.toBlob(ok, jpeg ? 'image/jpeg' : 'image/png', 0.92)
  )
  if (!blob) throw new Error('Impossible d’écrire l’image tournée')
  return { octets: new Uint8Array(await blob.arrayBuffer()), jpeg, w, h, w2, h2 }
}

/**
 * Le calque du calage : il prend la molette et le glisser pour l'image seule.
 * Tout se compte en fractions du cadre, lues sur sa taille à l'écran — le
 * zoom du cadre lui-même n'y change donc rien.
 */
function CalqueCalage({
  vue,
  onVue
}: {
  vue: Calage
  onVue: (v: Calage) => void
}): JSX.Element {
  const hote = useRef<HTMLDivElement>(null)
  const tire = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  /* Le gestionnaire de molette est posé une fois : il lit la vue à jour ici. */
  const courante = useRef(vue)
  courante.current = vue

  /* La molette agrandit autour du curseur : le point visé de l'image reste
     sous la souris. Ctrl, plus finement. */
  useEffect(() => {
    const el = hote.current
    if (!el) return
    const h = (e: WheelEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      const b = el.getBoundingClientRect()
      const u = (e.clientX - b.left) / b.width - 0.5
      const v = (e.clientY - b.top) / b.height - 0.5
      const p = courante.current
      /* Des crans fins : on cale au pixel près, pas on explore. */
      const pas = e.ctrlKey ? 1.004 : 1.01
      const z = Math.min(8, Math.max(0.2, p.z * (e.deltaY < 0 ? pas : 1 / pas)))
      const k = z / p.z
      onVue({ ...p, z, ox: u - k * (u - p.ox), oy: v - k * (v - p.oy) })
    }
    el.addEventListener('wheel', h, { passive: false })
    return () => el.removeEventListener('wheel', h)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      ref={hote}
      className="calque-calage"
      title="Glisser : déplacer l’image · molette : zoomer (Ctrl, plus fin) · double-clic : revenir au départ"
      onPointerDown={(e) => {
        if (e.button !== 0 && e.button !== 1) return
        e.preventDefault()
        e.stopPropagation()
        e.currentTarget.setPointerCapture(e.pointerId)
        tire.current = { x: e.clientX, y: e.clientY, ox: vue.ox, oy: vue.oy }
      }}
      onPointerMove={(e) => {
        const t = tire.current
        if (!t) return
        const b = e.currentTarget.getBoundingClientRect()
        onVue({
          ...vue,
          ox: t.ox + (e.clientX - t.x) / b.width,
          oy: t.oy + (e.clientY - t.y) / b.height
        })
      }}
      onPointerUp={() => {
        tire.current = null
      }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        onVue({ z: 1, ox: 0, oy: 0, r: 0 })
      }}
    />
  )
}

/**
 * Les pièces sans nom où l'on peut mettre une fiche : une pastille par pièce,
 * qui l'éclaire sur le plan au survol.
 */
function PlacerDans({
  lieu,
  libres,
  onVoir,
  onPlacer
}: {
  lieu: Place
  libres: number[]
  onVoir: (i: number | null) => void
  onPlacer: (i: number) => void
}): JSX.Element {
  if (!libres.length)
    return <p className="note">Aucune pièce sans nom où mettre « {lieu.name} » : trace ses murs d’abord.</p>
  return (
    <div className="placer-dans">
      <span className="note">Mettre « {lieu.name} » dans :</span>
      {libres.map((i, k) => (
        <button
          key={i}
          className="btn btn-sm"
          onMouseEnter={() => onVoir(i)}
          onMouseLeave={() => onVoir(null)}
          onClick={() => onPlacer(i)}
          title="La pièce s’éclaire sur le plan au survol"
        >
          pièce sans nom {k + 1}
        </button>
      ))}
    </div>
  )
}

/** Une longueur en mètres, à la française : « 34 m », « 2,5 m ». */
function enMetres(m: number | null): string {
  if (m === null) return '—'
  const arrondi = m >= 20 ? Math.round(m) : Math.round(m * 10) / 10
  return `${String(arrondi).replace('.', ',')} m`
}

/**
 * Le trait d'étalonnage : on le tire d'un bout à l'autre d'une longueur
 * connue. En fractions de l'image, comme tout ce qui se pose sur le plan.
 */
function CalqueTrait({
  trait,
  onTrait
}: {
  trait: { a: PointMur; b: PointMur } | null
  onTrait: (t: { a: PointMur; b: PointMur }) => void
}): JSX.Element {
  const depart = useRef<PointMur | null>(null)
  const [enCours, setEnCours] = useState<{ a: PointMur; b: PointMur } | null>(null)
  const lire = (e: React.PointerEvent<HTMLDivElement>): PointMur => {
    const b = e.currentTarget.getBoundingClientRect()
    return [
      Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)),
      Math.min(1, Math.max(0, (e.clientY - b.top) / b.height))
    ]
  }
  const t = enCours ?? trait
  return (
    <div
      className="calque-rect calque-trait"
      onPointerDown={(e) => {
        if (e.button !== 0) return
        e.stopPropagation()
        e.currentTarget.setPointerCapture(e.pointerId)
        depart.current = lire(e)
        setEnCours({ a: depart.current, b: depart.current })
      }}
      onPointerMove={(e) => {
        if (depart.current) setEnCours({ a: depart.current, b: lire(e) })
      }}
      onPointerUp={(e) => {
        if (!depart.current) return
        const fini = { a: depart.current, b: lire(e) }
        depart.current = null
        setEnCours(null)
        if (Math.hypot(fini.b[0] - fini.a[0], fini.b[1] - fini.a[1]) > 0.01) onTrait(fini)
      }}
    >
      {t ? (
        <svg viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
          <line x1={t.a[0]} y1={t.a[1]} x2={t.b[0]} y2={t.b[1]} className="trait" />
          <line x1={t.a[0]} y1={t.a[1]} x2={t.a[0]} y2={t.a[1]} className="bout" />
          <line x1={t.b[0]} y1={t.b[1]} x2={t.b[0]} y2={t.b[1]} className="bout" />
        </svg>
      ) : null}
    </div>
  )
}

/** Les longueurs rondes qu'une règle peut montrer. */
const REGLES = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500]

/**
 * La règle d'échelle, en bas à gauche du plan — ou de la pièce qu'on regarde.
 * Une longueur ronde qui tient dans un sixième de ce qu'on voit.
 */
function RegleEchelle({ metres, zone }: { metres: number; zone: Zone | null }): JSX.Element | null {
  const vue = zone ?? { x: 0, y: 0, w: 1, h: 1 }
  const visible = metres * vue.w
  const longueur = [...REGLES].reverse().find((l) => l <= visible / 6) ?? REGLES[0]
  const part = longueur / metres
  return (
    <div
      className="regle-echelle"
      style={{
        left: `${(vue.x + vue.w * 0.02) * 100}%`,
        top: `${(vue.y + vue.h * 0.96) * 100}%`,
        width: `${part * 100}%`,
        fontSize: `${Math.max(0.4, vue.w) * 12}px`
      }}
      aria-hidden="true"
    >
      <span>{enMetres(longueur)}</span>
    </div>
  )
}

/**
 * Le volet de l'échelle : d'où on la sait, ce qu'elle donne, et la taille des
 * pions qu'on en tire. Voir `src/main/db/repos/echelle.ts`.
 */
function VoletEchelle({
  ech,
  onEtalonner,
  onRevenir,
  onPionMain,
  onTaille,
  apercu,
  onApercu,
  onAllure,
  onPousse
}: {
  ech: EchellePlan
  onEtalonner: () => void
  onRevenir: () => void
  onPionMain: (main: boolean) => void
  /** Régler la taille à la main : le lieu ne suit plus l'échelle. */
  onTaille: (pourcent: number) => void
  apercu: boolean
  onApercu: () => void
  /** L'allure des pions pilotés sur ce plan ; `null`, celle d'usine. */
  onAllure: (allure: number | null) => void
  /** La poussée du pilote, -1 à 1 sur chaque axe ; zéro, on lâche. */
  onPousse: (v: { x: number; y: number }) => void
}): JSX.Element {
  const inconnue = ech.metres === null
  /* Le curseur bouge sur place et n'enregistre qu'au lâcher : un seul
     « Défaire » pour un seul geste. */
  const [taille, setTaille] = useState<number | null>(null)
  const vue = taille ?? ech.pionPourcent
  const lacher = (): void => {
    if (taille === null) return
    onTaille(taille)
    setTaille(null)
  }
  /* L'allure, en pour cent de la largeur par seconde : même geste, un seul
     enregistrement au lâcher. */
  const [allure, setAllure] = useState<number | null>(null)
  const allureVue = allure ?? ech.allure * 100
  const lacherAllure = (): void => {
    if (allure === null) return
    onAllure(allure / 100)
    setAllure(null)
  }
  const virgule = (v: number): string => String(Math.round(v * 10) / 10).replace('.', ',')
  const pourCent = (v: number): string => `${String(Math.round(v * 10) / 10).replace('.', ',')} %`
  return (
    <>
      <div className="fl-bloc echelle-bloc">
        <span className="eyebrow">Échelle du plan</span>
        <span className={`etat-echelle ${ech.source ?? 'inconnue'}`}>
          {ech.source === 'trait'
            ? 'Étalonnée au trait'
            : ech.source === 'portes'
              ? `Estimée d’après ${ech.portes} porte${ech.portes > 1 ? 's' : ''}`
              : 'Échelle inconnue'}
        </span>
        <div className="ech-ligne">
          <span>Largeur du plan</span>
          <b>{inconnue ? '—' : `≈ ${enMetres(ech.metres)}`}</b>
        </div>
        <div className="ech-ligne">
          <span>1 mètre</span>
          <b>{inconnue ? '—' : `${pourCent(100 / ech.metres!)} du plan`}</b>
        </div>
        <p className="note">
          {inconnue
            ? 'Aucune porte posée et pas d’étalonnage : l’app ne sait pas encore la taille de ce plan. Tire un trait sur une longueur connue, ou pose une porte.'
            : ech.source === 'trait'
              ? 'Tu as fixé l’échelle au trait. Elle prime sur l’estimation par les portes.'
              : 'Une porte fait environ 0,9 m : la largeur médiane des portes posées donne l’échelle. Tire un trait sur une longueur connue pour la corriger.'}
        </p>
        <div className="murs-rangee">
          <button className="btn btn-sm btn-brass" onClick={onEtalonner}>
            Étalonner au trait
          </button>
          {ech.source === 'trait' ? (
            <button className="btn btn-sm btn-ghost" onClick={onRevenir}>
              {ech.portes ? 'Revenir à l’estimation' : 'Oublier l’échelle'}
            </button>
          ) : null}
        </div>
        <p className="note">
          Les pièces de cet étage partagent cette échelle. Un rognage la recale tout seul.
        </p>
      </div>
      <div className="fl-bloc echelle-bloc">
        <span className="eyebrow">Pions sur ce plan</span>
        <div className="ech-ligne">
          <span>Taille réelle</span>
          <b>{inconnue ? '—' : ech.pionMain || taille !== null ? `≈ ${enMetres((vue / 100) * ech.metres!)}` : '1,5 m'}</b>
        </div>
        <label className="murs-reglage">
          <span>À l’écran</span>
          <input
            type="range"
            min={2}
            max={24}
            step={0.1}
            value={vue}
            aria-label="Taille des pions, en part de la largeur du plan"
            onChange={(e) => setTaille(Number(e.target.value))}
            onPointerUp={lacher}
            onKeyUp={lacher}
            onBlur={lacher}
          />
          <Valeur
            className="num"
            value={vue}
            min={2}
            max={24}
            step={0.1}
            decimales={1}
            unite=" %"
            label="Taille des pions"
            onChange={onTaille}
          />
        </label>
        <div className="murs-rangee">
          <button
            className={`btn btn-sm${apercu ? ' btn-on' : ''}`}
            aria-pressed={apercu}
            title="Un pion fantôme suit la souris sur le plan, à la taille réglée"
            onClick={onApercu}
          >
            Aperçu
          </button>
          {ech.pionMain ? (
            <button
              className="btn btn-sm btn-ghost"
              disabled={inconnue}
              title={
                inconnue
                  ? 'Échelle inconnue : étalonne le plan, ou pose une porte'
                  : 'Le pion refait 1,5 m, d’après l’échelle du plan'
              }
              onClick={() => onPionMain(false)}
            >
              Remettre à l’échelle
            </button>
          ) : null}
        </div>
        {apercu ? <Pilote onPousse={onPousse} /> : null}
        <p className="note">
          {ech.pionMain
            ? 'Réglée à ta façon sur ce lieu : elle ne suit plus l’échelle.'
            : inconnue
              ? 'Échelle inconnue : le pion garde la taille réglée à la main en attendant.'
              : 'Calculée d’après l’échelle : un pion fait une case de 1,5 m. Bouge le curseur pour la régler à ta façon.'}
        </p>
      </div>
      <div className="fl-bloc echelle-bloc">
        <span className="eyebrow">Allure des pions</span>
        <label className="murs-reglage">
          <span>Par seconde</span>
          <input
            type="range"
            min={ALLURE_MIN * 100}
            max={ALLURE_MAX * 100}
            step={0.5}
            value={allureVue}
            aria-label="Allure des pions pilotés, en part de la largeur du plan par seconde"
            onChange={(e) => setAllure(Number(e.target.value))}
            onPointerUp={lacherAllure}
            onKeyUp={lacherAllure}
            onBlur={lacherAllure}
          />
          <Valeur
            className="num"
            value={allureVue}
            min={ALLURE_MIN * 100}
            max={ALLURE_MAX * 100}
            step={0.5}
            decimales={1}
            unite=" %"
            label="Allure des pions"
            onChange={(v) => onAllure(v / 100)}
          />
        </label>
        <div className="ech-ligne">
          <span>Traverse le plan en</span>
          <b>{virgule(100 / allureVue)} s</b>
        </div>
        <div className="ech-ligne">
          <span>Vitesse réelle</span>
          <b>{inconnue ? '—' : `≈ ${virgule((allureVue / 100) * ech.metres!)} m/s`}</b>
        </div>
        <div className="murs-rangee">
          {apercu ? null : (
            <button className="btn btn-sm" title="Pose le pion du MJ sur le plan et fais-le marcher au pilote" onClick={onApercu}>
              Essayer au pilote
            </button>
          )}
          {ech.allureReglee ? (
            <button
              className="btn btn-sm btn-ghost"
              title="Revenir à l’allure d’usine : 12 % de la largeur du plan par seconde"
              onClick={() => onAllure(null)}
            >
              Allure par défaut
            </button>
          ) : null}
        </div>
        <p className="note">
          Le pas le plus long qu’un joueur donne en poussant le disque de son téléphone, pouce au bord.
          Un plan de ville veut une allure plus vive qu’un placard. Les pièces de cet étage la partagent.
        </p>
      </div>
    </>
  )
}

/**
 * Le pilote de l'aperçu : le disque du téléphone, à la souris. On le pousse,
 * le pion marche ; on lâche, il s'arrête. Le bord vaut la pleine allure.
 */
function Pilote({
  onPousse,
  note = 'Pousse le pilote : le pion du MJ marche comme celui d’un joueur sur son téléphone, à l’allure de ce plan, et les murs le retiennent.'
}: {
  onPousse: (v: { x: number; y: number }) => void
  note?: string
}): JSX.Element {
  const [pouce, setPouce] = useState({ x: 0, y: 0 })
  const [pris, setPris] = useState(false)
  /* Refermé en pleine poussée, il ne laisse pas le pion filer : on lâche au
     démontage — et seulement là, la fonction change à chaque dessin. */
  const lache = useRef(onPousse)
  lache.current = onPousse
  useEffect(() => () => lache.current({ x: 0, y: 0 }), [])
  const suivre = (e: React.PointerEvent<HTMLDivElement>): void => {
    const b = e.currentTarget.getBoundingClientRect()
    const r = b.width / 2
    const dx = e.clientX - (b.left + r)
    const dy = e.clientY - (b.top + r)
    const d = Math.hypot(dx, dy)
    const max = Math.max(1, r - 16)
    const k = d > max ? max / d : 1
    onPousse({ x: (dx * k) / max, y: (dy * k) / max })
    setPouce({ x: dx * k, y: dy * k })
  }
  const lacher = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    setPris(false)
    onPousse({ x: 0, y: 0 })
    setPouce({ x: 0, y: 0 })
  }
  return (
    <div className="pe-pilote-rangee">
      <div
        className={`pe-pilote${pris ? ' pris' : ''}`}
        title="Pousse : le pion marche à l’allure du plan, les murs le retiennent"
        onPointerDown={(e) => {
          e.preventDefault()
          e.currentTarget.setPointerCapture(e.pointerId)
          setPris(true)
          suivre(e)
        }}
        onPointerMove={(e) => pris && suivre(e)}
        onPointerUp={lacher}
        onPointerCancel={lacher}
      >
        <span className="pouce" style={{ transform: `translate(${pouce.x}px, ${pouce.y}px)` }} />
      </div>
      <p className="note">{note}</p>
    </div>
  )
}

/**
 * Le pion de l'aperçu : un vrai jeton, celui du MJ — son image des Paramètres,
 * son nom —, à la taille des pions de ce lieu. Posé au milieu du plan, il y
 * reste ; on le glisse où l'on veut juger sa taille, comme un pion en jeu.
 * Seul le jeton prend la souris : autour, on continue de tracer.
 */
function ApercuPion({
  taille,
  pose,
  onPose
}: {
  taille: number
  pose: { x: number; y: number; cap: number }
  onPose: (p: { x: number; y: number; cap: number }) => void
}): JSX.Element {
  const s = useStore()
  const url = urlPortraitMj(s.poste.mjImage)
  const nom = nomDuMj(s.poste)
  const hote = useRef<HTMLDivElement>(null)
  const pos = pose
  /** L'écart entre la souris et le centre du jeton, pris à la saisie. */
  const prise = useRef<{ dx: number; dy: number } | null>(null)
  const borne = (v: number): number => Math.min(1, Math.max(0, v))
  const versPlan = (e: React.PointerEvent): { x: number; y: number } | null => {
    const b = hote.current?.getBoundingClientRect()
    if (!b || !b.width || !b.height) return null
    return { x: (e.clientX - b.left) / b.width, y: (e.clientY - b.top) / b.height }
  }
  return (
    <div ref={hote} className="pion-layer avec-noms apercu-pion" style={{ ['--ps' as string]: taille }}>
      <div
        className="pion c-brass"
        style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%`, ['--rot' as string]: `${pos.cap}deg` }}
        title="Glisse-le pour comparer sa taille au plan, ou fais-le marcher au pilote"
        /* Le plan dessous ne doit rien savoir de ce geste : ni tracé, ni
           déplacement de la vue, ni choix d'un mur. */
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => {
          e.stopPropagation()
          e.preventDefault()
          const p = versPlan(e)
          if (!p) return
          prise.current = { dx: pos.x - p.x, dy: pos.y - p.y }
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          if (!prise.current) return
          const p = versPlan(e)
          if (p) onPose({ ...pos, x: borne(p.x + prise.current.dx), y: borne(p.y + prise.current.dy) })
        }}
        onPointerUp={(e) => {
          prise.current = null
          e.currentTarget.releasePointerCapture(e.pointerId)
        }}
      >
        {url ? <img src={url} alt="" /> : <span className="ini">MJ</span>}
        {pos.cap ? <span className="nez" /> : null}
        <span className="lab">{nom}</span>
      </div>
    </div>
  )
}

/**
 * Les objets posés sur le plan d'un étage : une puce par exemplaire, au point
 * où on l'a lâché. On en glisse un depuis la liste du volet (`GLISSE_OBJET`),
 * on déplace une puce à la souris ; `onSituer` refuse un point hors de sa
 * pièce, et la puce revient d'où elle venait. Un clic l'ouvre dans le volet.
 */
function CalqueObjets({
  objets,
  actif,
  onSituer,
  onOuvrir
}: {
  objets: { o: Objet; x: ObjetPlacement }[]
  /** Les puces se prennent, le plan accepte qu'on y lâche un objet. */
  actif: boolean
  onSituer: (id: number, pt: { x: number; y: number }) => Promise<boolean>
  onOuvrir: (x: ObjetPlacement) => void
}): JSX.Element {
  const s = useStore()
  const hote = useRef<HTMLDivElement>(null)
  /** La puce qu'on tire, et l'écart entre la souris et son centre. */
  const [tire, setTire] = useState<{ id: number; x: number; y: number; dx: number; dy: number; bouge: boolean } | null>(
    null
  )
  const versPlan = (cx: number, cy: number): { x: number; y: number } | null => {
    const b = hote.current?.getBoundingClientRect()
    if (!b || !b.width || !b.height) return null
    return { x: (cx - b.left) / b.width, y: (cy - b.top) / b.height }
  }
  const situerRef = useRef(onSituer)
  situerRef.current = onSituer

  /* Lâcher une rangée du volet sur le plan. Le calque laisse passer la souris
     pour le tracé : on écoute donc le document, et l'on ne garde que ce qui
     tombe sur le plan lui-même — pas sur le volet qu'il déborde au zoom. */
  useEffect(() => {
    if (!actif) return
    const surLePlan = (e: DragEvent): boolean => {
      if (!e.dataTransfer?.types.includes(GLISSE_OBJET)) return false
      const cadre = hote.current?.parentElement
      if (!cadre || !cadre.contains(e.target as Node)) return false
      const p = versPlan(e.clientX, e.clientY)
      return !!p && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1
    }
    const dessus = (e: DragEvent): void => {
      if (!surLePlan(e)) return
      e.preventDefault()
      e.dataTransfer!.dropEffect = 'move'
    }
    const lache = (e: DragEvent): void => {
      if (!surLePlan(e)) return
      e.preventDefault()
      e.stopPropagation()
      const id = Number(e.dataTransfer!.getData(GLISSE_OBJET))
      const p = versPlan(e.clientX, e.clientY)
      if (id && p) void situerRef.current(id, p)
    }
    document.addEventListener('dragover', dessus, true)
    document.addEventListener('drop', lache, true)
    return () => {
      document.removeEventListener('dragover', dessus, true)
      document.removeEventListener('drop', lache, true)
    }
  }, [actif])

  return (
    <div ref={hote} className={`pe-objets${actif ? ' actif' : ''}`}>
      {objets.map(({ o, x }) => {
        const enMain = tire?.id === x.id ? tire : null
        const pos = enMain ?? x.pos!
        const img = s.allItems.find((i) => i.id === o.imageItemId)
        const f = s.objetFamilles.find((y) => y.id === o.familleId) ?? null
        return (
          <div
            key={x.id}
            className={`pe-objet ${x.etat}${enMain ? ' tire' : ''}`}
            style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}
            title={`${o.nom}${x.qte > 1 ? ` ×${x.qte}` : ''} — ${x.cible}${x.etat === 'trouve' ? ' · trouvé' : ' · caché'}`}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => {
              if (!actif || e.button !== 0) return
              e.stopPropagation()
              e.preventDefault()
              const p = versPlan(e.clientX, e.clientY)
              if (!p || !x.pos) return
              setTire({ id: x.id, x: x.pos.x, y: x.pos.y, dx: x.pos.x - p.x, dy: x.pos.y - p.y, bouge: false })
              e.currentTarget.setPointerCapture(e.pointerId)
            }}
            onPointerMove={(e) => {
              if (!enMain) return
              const p = versPlan(e.clientX, e.clientY)
              if (!p) return
              const bouge = enMain.bouge || Math.hypot(e.movementX, e.movementY) > 0
              setTire({ ...enMain, x: p.x + enMain.dx, y: p.y + enMain.dy, bouge })
            }}
            onPointerUp={(e) => {
              if (!enMain) return
              e.currentTarget.releasePointerCapture(e.pointerId)
              if (!enMain.bouge) {
                setTire(null)
                onOuvrir(x)
                return
              }
              /* La puce reste où on l'a lâchée le temps de la réponse ; refusée,
                 elle revient à son point. */
              void onSituer(x.id, { x: enMain.x, y: enMain.y }).finally(() => setTire(null))
            }}
          >
            {img?.url ? (
              <img src={img.poster ?? img.url} alt="" />
            ) : (
              <span className={`c-${f?.teinte ?? 'neutral'}`}>{glypheObjet(f?.glyphe ?? 'outils', 'glyphe')}</span>
            )}
          </div>
        )
      })}
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
