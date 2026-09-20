/**
 * Le calque des murs invisibles d'un lieu — **pour le MJ seul**.
 *
 * Ce composant n'est importé que par l'interface du MJ. La fenêtre des joueurs
 * ne connaît que `Slide`, qui ne sait rien des murs : ils ne peuvent donc pas
 * s'afficher chez eux, même si quelqu'un l'oubliait un jour. Un mur sert à
 * empêcher un pion de traverser et à calculer ce qu'il voit — jamais à être
 * montré.
 *
 * Trois usages :
 * - `mode="lecture"` : on regarde, rien ne bouge.
 * - `mode="edition"` : on trace, on choisit, on efface.
 * - un pion d'essai posé : on vérifie ses murs sans quitter la fiche.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  MUR_NATURES,
  OUVERTURES,
  OUVERTURE_NATURES,
  OUVERTURE_REGARD,
  TEINTES_LUMIERE,
  type Lumiere,
  type Mur,
  type NatureMur,
  type NatureOuverture,
  type Ouverture,
  type PointMur
} from '@shared/types'
import { centreDe, contourDesMurs, formesDesMurs, type Forme } from '@shared/pieces'
import { accrocherAuMur, bordsOuverture, LARGEUR_DEFAUT } from '@shared/ouvertures'
import { useStore } from '../store'
import {
  barrieres,
  bords,
  casesAutour,
  casesVues,
  champDeVision,
  chemin,
  couperTrace,
  cheminDesInconnues,
  distanceAuSegment,
  gommerTrace,
  grille,
  piecesDesPortesOuvertes,
  murSous,
  pasContraint,
  polygone,
  soustraireTrace,
  type Pt
} from '@shared/murs'
import {
  IconAimant,
  IconCheck,
  IconSoleil,
  IconFusion,
  IconGomme,
  IconLoupe,
  IconPen,
  IconPlus,
  IconRotate,
  IconSouris,
  IconTrash,
  IconVerrou
} from './Icons'

/**
 * Les outils du calque, dans l'ordre de la barre : ce qui sélectionne, puis ce
 * qui ajoute (marqué d'un + à l'écran), puis ce qui retire.
 */
export type OutilMur =
  | 'selection'
  | 'mur'
  | 'rideau'
  | 'porte'
  | 'vitre'
  | 'lumiere'
  | 'gomme'

/** Cet outil trace-t-il un trait ? */
export const outilTrace = (o: OutilMur): o is 'mur' | 'rideau' => o === 'mur' || o === 'rideau'

/** Cet outil pose-t-il quelque chose là où l'on clique, sans viser de mur ? */
export const outilPose = (o: OutilMur): o is 'lumiere' => o === 'lumiere'

/** Cet outil pose-t-il une ouverture sur un mur ? */
export const outilPerce = (o: OutilMur): o is 'porte' | 'vitre' => o === 'porte' || o === 'vitre'

/**
 * Ce qu'un trait neuf retire à un trait déjà posé : les morceaux qui restent.
 * Vide, le trait entamé disparaît — la vitre a pris toute sa place.
 */
export interface Retrait {
  id: number
  pieces: PointMur[][]
}

/** Le pion d'essai : il n'est enregistré nulle part, il sert à vérifier. */
export interface EssaiPion {
  /** En fractions de la carte, comme un vrai pion l'est de l'écran. */
  x: number
  y: number
  /** Le cap, en degrés, 0 vers le haut — la rotation d'un pion. */
  cap: number
  ouverture: number
  /** Le pion tourne-t-il la tête dans le sens de sa marche ? */
  marche: boolean
  /**
   * La lampe que le pion porte : le rayon de sa lueur, en part de la largeur
   * de la carte. `0`, il n'a rien — et dans une maison éteinte, il ne voit
   * que ses pieds.
   */
  lampe: number
  /**
   * Le numéro de l'essai. « Replacer le pion » l'avance, et ce qui avait été
   * exploré est oublié : un nouvel essai part d'une maison noire.
   */
  reprise: number
}

/**
 * Ce que le viseur a trouvé : le point corrigé, et de quoi le montrer.
 *
 * Les guides sont en pixels de mise en page — ils ne servent qu'à l'affichage,
 * et ne sont jamais enregistrés.
 */
interface Guides {
  p: Pt
  /** Les traits pointillés : d'un point qui aligne jusqu'au point visé. */
  lignes: { de: Pt; a: Pt }[]
  /** L'angle droit avec le segment précédent, quand il est atteint. */
  equerre: { sommet: Pt; depuis: Pt; vers: Pt } | null
}

/** On se colle à un bout existant en deçà de ça, en pixels. */
const COLLE = 14

/** Et l'on s'aligne dessus en deçà de ça — plus serré : un guide se mérite. */
const ALIGNE = 8

/**
 * Jusqu'où l'on peut cliquer à côté d'un mur pour y poser une ouverture, en
 * fractions de la carte. Assez large pour ne pas avoir à viser le trait, assez
 * serré pour ne pas attraper le mur d'en face.
 */
export const PORTEE_OUVERTURE = 0.022

/** La gomme : son rayon de départ, et jusqu'où la molette le pousse. */
export const GOMME = { rayon: 22, min: 8, max: 80 }

/** Le rayon de la loupe et son agrandissement, en pixels de mise en page. */
const R_LOUPE = 54
const Z_LOUPE = 2.6

export const ESSAI_NEUF: EssaiPion = {
  x: 0.5,
  y: 0.5,
  cap: 90,
  ouverture: OUVERTURE_REGARD,
  marche: false,
  lampe: 0,
  reprise: 0
}

/** Les deux rayons d'une lampe neuve, en part de la largeur de la carte. */
export const LAMPE_NEUVE = { clair: 0.09, penombre: 0.16 }

/** La torche du pion, quand on la lui donne. */
export const TORCHE = 0.14

/* ============================================================
   L'état du calque : la liste, les outils, et de quoi défaire
   ============================================================ */

export function useMurs(placeId: number): {
  liste: Mur[]
  /** Les portes et les fenêtres posées sur ces murs. */
  ouvertures: Ouverture[]
  /** Les points de lumière de cette carte : ce qui décide de ce qu'on y voit. */
  lumieres: Lumiere[]
  /** La lumière choisie dans le volet, s'il y en a une. */
  lumChoisie: number | null
  setLumChoisie: (id: number | null) => void
  poserLumiere: (x: number, y: number) => Promise<void>
  reglerLumiere: (
    id: number,
    patch: {
      x?: number
      y?: number
      clair?: number
      penombre?: number
      allumee?: boolean
      teinte?: string
      garde?: boolean
    }
  ) => Promise<void>
  /** La même lampe, un peu plus loin : on règle une fois, on sème ensuite. */
  dupliquerLumiere: (id: number) => Promise<void>
  oterLumiere: (id: number) => Promise<void>
  /** Ce que les murs referment — recalculé à chaque changement du calque. */
  formes: Forme[]
  outil: OutilMur
  setOutil: (o: OutilMur) => void
  nature: NatureMur
  setNature: (n: NatureMur) => void
  aimant: boolean
  setAimant: (v: boolean) => void
  loupe: boolean
  setLoupe: (v: boolean) => void
  /**
   * L'aperçu « ombre et lumière » : la carte telle que les lampes la laissent,
   * sans personne pour la regarder. Il n'a de sens que l'outil Lumière en main.
   */
  apercuLum: boolean
  setApercuLum: (v: boolean) => void
  gomme: number
  setGomme: (r: number) => void
  /** La part de la carte jamais vue pendant l'essai, de 0 à 1. */
  noir: number | null
  setNoir: (v: number | null) => void
  choisi: number | null
  setChoisi: (id: number | null) => void
  essai: EssaiPion | null
  setEssai: (e: EssaiPion | null) => void
  /** L'ouverture visée dans le volet, s'il y en a une. */
  ouvChoisie: number | null
  setOuvChoisie: (id: number | null) => void
  /** La pièce qu'on regarde dans la liste : elle s'éclaire sur le plan. */
  formeVisee: number | null
  setFormeVisee: (i: number | null) => void
  poser: (nature: NatureMur, traces: PointMur[][], retraits?: Retrait[]) => Promise<void>
  /**
   * Les murs qu'on désigne pour en faire une pièce ; `null`, on ne désigne
   * rien. C'est le geste des plans pleins de seuils, que la détection
   * automatique ne peut pas refermer toute seule.
   */
  pourPiece: number[] | null
  setPourPiece: (ids: number[] | null) => void
  /** Le contour que les murs désignés dessinent ensemble, s'il tient debout. */
  contourPropose: PointMur[] | null
  /**
   * La largeur que prendront les prochaines ouvertures de cette carte, en part
   * du plan — `null`, celle d'usine. On la règle une fois sur une porte qui
   * tombe juste, et les suivantes naissent à la bonne taille.
   */
  largeurDefaut: number | null
  reglerLargeurDefaut: (largeur: number | null) => Promise<void>
  /**
   * Sur cette carte, une zone éclairée une fois reste-t-elle découverte ?
   * Décoché, elle retombe au noir dès qu'on ne la voit plus. C'est une règle
   * du plan : toutes ses lampes la suivent, torche du pion comprise.
   */
  lumGarde: boolean
  reglerLumGarde: (garde: boolean) => Promise<void>
  /**
   * Jusqu'où le regard porte sur cette carte, en part de sa largeur.
   * `null`, sans limite — il ne s'arrête qu'aux murs.
   */
  regardPortee: number | null
  reglerRegardPortee: (portee: number | null) => Promise<void>
  poserOuverture: (murId: number, nature: NatureOuverture, d: number) => Promise<void>
  reglerOuverture: (
    id: number,
    patch: { d?: number; largeur?: number; ouverte?: boolean; verrouillee?: boolean }
  ) => Promise<void>
  oterOuverture: (id: number) => Promise<void>
  couper: (id: number, pieces: PointMur[][]) => Promise<void>
  gommer: (retraits: Retrait[]) => Promise<void>
  deplacer: (id: number, pts: PointMur[]) => Promise<void>
  changerNature: (id: number, nature: NatureMur) => Promise<void>
  basculerPorte: (id: number) => Promise<void>
  verrouiller: (id: number, v: boolean) => Promise<void>
  /** Le MJ accorde : la porte se déverrouille et s'ouvre du même geste. */
  accorder: (id: number) => Promise<void>
  /** Referme toutes les portes — le début d'un essai. */
  fermerLesPortes: () => Promise<void>
  /**
   * On attend qu'on désigne le point de départ : les portes sont déjà closes,
   * la maison est noire, il ne manque que l'endroit où l'on entre.
   */
  attenteDepart: boolean
  /** Armer une visite : portes closes, puis on attend le clic du départ. */
  commencerEssai: () => Promise<void>
  /** Le départ est désigné : la visite commence là. */
  partirDe: (x: number, y: number) => void
  /** On revient au tracé : plus de pion, plus d'attente. */
  arreterEssai: () => void
  effacer: (id: number) => Promise<void>
  defaire: () => Promise<void>
  peutDefaire: boolean
} {
  const [liste, setListe] = useState<Mur[]>([])
  const [lumieres, setLumieres] = useState<Lumiere[]>([])
  const [lumChoisie, setLumChoisie] = useState<number | null>(null)
  const [ouvertures, setOuvertures] = useState<Ouverture[]>([])
  const [ouvChoisie, setOuvChoisie] = useState<number | null>(null)
  const [pourPiece, setPourPiece] = useState<number[] | null>(null)
  const [formeVisee, setFormeVisee] = useState<number | null>(null)
  const [attenteDepart, setAttenteDepart] = useState(false)
  const [outil, setOutil] = useState<OutilMur>('selection')
  const [nature, setNature] = useState<NatureMur>('mur')
  const [aimant, setAimant] = useState(true)
  const [loupe, setLoupe] = useState(true)
  const [apercuLum, setApercuLum] = useState(false)
  const [gomme, setGomme] = useState(GOMME.rayon)
  const [noir, setNoir] = useState<number | null>(null)
  const [choisi, setChoisi] = useState<number | null>(null)
  const [essai, setEssai] = useState<EssaiPion | null>(null)
  /*
   * Défaire, c'est rejouer le geste inverse — pas restaurer un instantané.
   * Un trait remis en place reçoit donc un nouvel identifiant : c'est le même
   * mur, pas la même ligne. Personne ne s'en aperçoit, et la base reste la
   * seule source.
   */
  const pile = useRef<(() => Promise<void>)[]>([])
  const [profondeur, setProfondeur] = useState(0)

  const relire = async (): Promise<void> => {
    setListe(await window.jdr.murs.of(placeId))
    setOuvertures(await window.jdr.ouvertures.of(placeId))
    setLumieres(await window.jdr.lumieres.of(placeId))
    /* La largeur d'usage de cette carte se relit avec le reste : elle vit sur
       le lieu, et non dans le composant, pour survivre à la fermeture. */
    const lieu = await window.jdr.places.get(placeId)
    setLargeurDefaut(lieu?.ouvLargeur ?? null)
    setLumGarde(!!lieu?.lumGarde)
    setRegardPortee(lieu?.regardPortee ?? null)
  }

  /*
   * Les pièces ne sont pas rangées quelque part : ce sont les faces que les
   * murs referment, et on les retrouve à chaque fois qu'un trait bouge. Rien
   * à tenir à jour, donc rien qui puisse mentir.
   */
  const formes = useMemo(() => formesDesMurs(liste), [liste])

  /* Ce que les murs désignés dessinent — recalculé à chaque clic, pour qu'on
     voie la forme se fermer au fur et à mesure qu'on les choisit. */
  const contourPropose = useMemo(() => {
    if (!pourPiece || pourPiece.length < 2) return null
    const choisis = pourPiece
      .map((id) => liste.find((m) => m.id === id))
      .filter((m): m is Mur => !!m)
    return choisis.length >= 2 ? contourDesMurs(choisis) : null
  }, [pourPiece, liste])

  useEffect(() => {
    void relire()
    setChoisi(null)
    setOuvChoisie(null)
    setPourPiece(null)
    setAttenteDepart(false)
    setEssai(null)
    pile.current = []
    setProfondeur(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeId])

  const memoriser = (inverse: () => Promise<void>): void => {
    pile.current.push(inverse)
    if (pile.current.length > 30) pile.current.shift()
    setProfondeur(pile.current.length)
  }

  /**
   * Retirer aux traits entamés ce qu'on leur prend. Rend les identifiants des
   * morceaux nés en route — un trait percé en son milieu devient deux.
   */
  const appliquer = async (retraits: Retrait[], avant: Mur[]): Promise<number[]> => {
    const ajoutes: number[] = []
    for (const r of retraits) {
      const entame = avant.find((x) => x.id === r.id)
      if (!entame) continue
      if (!r.pieces.length) {
        await window.jdr.murs.remove(r.id)
        continue
      }
      await window.jdr.murs.update(r.id, { pts: r.pieces[0] })
      for (const reste of r.pieces.slice(1)) {
        const neuf = await window.jdr.murs.add({ placeId, nature: entame.nature, pts: reste })
        if (!neuf) continue
        ajoutes.push(neuf.id)
      }
    }
    return ajoutes
  }

  /** Le geste inverse : on efface ce qui est né, on rend aux autres leur forme. */
  const defaireRetraits =
    (avant: Mur[], nes: number[], retraits: Retrait[]) => async (): Promise<void> => {
      for (const id of nes) await window.jdr.murs.remove(id)
      for (const a of avant) {
        const r = retraits.find((x) => x.id === a.id)
        if (r && !r.pieces.length) {
          await window.jdr.murs.add({ placeId, nature: a.nature, pts: a.pts })
        } else {
          await window.jdr.murs.update(a.id, { pts: a.pts })
        }
      }
    }

  /**
   * Poser un ou plusieurs traits d'un même geste, et retirer aux autres ce
   * qu'ils recouvrent.
   *
   * Plusieurs, parce qu'une pièce fait quatre murs et non un cadre : chacun se
   * change, se perce et s'efface pour lui-même — on veut pouvoir mettre une
   * fenêtre sur le mur nord sans toucher aux trois autres. Le geste compte
   * pour un : « Défaire » remet tout en une fois.
   */
  const poser = async (
    n: NatureMur,
    traces: PointMur[][],
    retraits: Retrait[] = []
  ): Promise<void> => {
    const avant = retraits
      .map((r) => liste.find((x) => x.id === r.id))
      .filter((x): x is Mur => !!x)

    const nes: number[] = []
    for (const pts of traces) {
      const m = await window.jdr.murs.add({ placeId, nature: n, pts })
      if (m) nes.push(m.id)
    }
    if (!nes.length) return
    const ajoutes = await appliquer(retraits, avant)
    memoriser(defaireRetraits(avant, [...ajoutes, ...nes], retraits))
    setChoisi(nes[0])
    await relire()
  }

  /**
   * Couper un trait en deux au point visé. Le premier morceau garde la ligne
   * d'origine — donc son identifiant, et le choix qui va avec.
   */
  const couper = async (id: number, pieces: PointMur[][]): Promise<void> => {
    const avant = liste.find((x) => x.id === id)
    if (!avant || pieces.length < 2) return
    const retraits = [{ id, pieces }]
    const ajoutes = await appliquer(retraits, [avant])
    memoriser(defaireRetraits([avant], ajoutes, retraits))
    setChoisi(id)
    await relire()
  }

  /**
   * La gomme : rien de neuf n'est posé, on retire seulement. Un coup de gomme,
   * si long soit-il, compte pour un seul « Défaire » — c'est un geste.
   */
  const gommer = async (retraits: Retrait[]): Promise<void> => {
    if (!retraits.length) return
    const avant = retraits
      .map((r) => liste.find((x) => x.id === r.id))
      .filter((x): x is Mur => !!x)
    const ajoutes = await appliquer(retraits, avant)
    memoriser(defaireRetraits(avant, ajoutes, retraits))
    setChoisi(null)
    await relire()
  }

  const deplacer = async (id: number, pts: PointMur[]): Promise<void> => {
    const avant = liste.find((m) => m.id === id)
    if (avant) memoriser(async () => void (await window.jdr.murs.update(id, { pts: avant.pts })))
    await window.jdr.murs.update(id, { pts })
    await relire()
  }

  const changerNature = async (id: number, n: NatureMur): Promise<void> => {
    const avant = liste.find((m) => m.id === id)
    if (avant) memoriser(async () => void (await window.jdr.murs.update(id, { nature: avant.nature })))
    await window.jdr.murs.update(id, { nature: n })
    await relire()
  }

  /**
   * Poser une ouverture sur un mur. Elle en prend la direction : on ne choisit
   * que l'endroit, et on règle la largeur ensuite.
   */
  /** Ce que cette carte a retenu comme largeur d'ouverture. */
  const [largeurDefaut, setLargeurDefaut] = useState<number | null>(null)
  /** Et si ce qu'elle éclaire reste découvert. */
  const [lumGarde, setLumGarde] = useState(false)
  /** Et jusqu'où l'on voit, ici. */
  const [regardPortee, setRegardPortee] = useState<number | null>(null)

  const reglerRegardPortee = async (portee: number | null): Promise<void> => {
    await window.jdr.places.regardPortee(placeId, portee)
    setRegardPortee(portee)
    /* La portée change ce que le pion voit : on repart d'une maison noire. */
    setEssai((e) => (e ? { ...e, reprise: Date.now() } : e))
  }

  const reglerLumGarde = async (garde: boolean): Promise<void> => {
    await window.jdr.places.lumGarde(placeId, garde)
    setLumGarde(garde)
    /* La règle change : ce qui avait été retenu sous l'ancienne ne veut plus
       rien dire. On repart d'une maison noire, le pion reste où il est. */
    setEssai((e) => (e ? { ...e, reprise: Date.now() } : e))
  }

  /* ---------------- les lumières ---------------- */

  /**
   * Poser une lumière là où l'on clique.
   *
   * Elle naît allumée — on pose une lampe pour éclairer. Ses deux rayons sont
   * ceux d'usine : on les règle ensuite au curseur, en voyant le rond bouger.
   */
  const poserLumiere = async (x: number, y: number): Promise<void> => {
    const l = await window.jdr.lumieres.add({
      placeId,
      x,
      y,
      clair: LAMPE_NEUVE.clair,
      penombre: LAMPE_NEUVE.penombre
    })
    if (!l) return
    memoriser(async () => void (await window.jdr.lumieres.remove(l.id)))
    setLumChoisie(l.id)
    setChoisi(null)
    setOuvChoisie(null)
    await relire()
  }

  const reglerLumiere = async (
    id: number,
    patch: {
      x?: number
      y?: number
      clair?: number
      penombre?: number
      allumee?: boolean
      teinte?: string
      garde?: boolean
    }
  ): Promise<void> => {
    await window.jdr.lumieres.update(id, patch)
    await relire()
  }

  /**
   * Dupliquer une lumière.
   *
   * Une maison éclairée aux bougies en demande dix, toutes de la même portée :
   * on en règle une, et les suivantes en sortent. La copie se pose à côté —
   * jamais dessous, sinon on croirait que rien ne s'est passé — et devient la
   * lampe choisie, prête à être glissée à sa place.
   */
  const dupliquerLumiere = async (id: number): Promise<void> => {
    const av = lumieres.find((l) => l.id === id)
    if (!av) return
    const ecart = 0.045
    const copie = await window.jdr.lumieres.add({
      placeId,
      x: av.x + ecart > 0.98 ? Math.max(0.02, av.x - ecart) : av.x + ecart,
      y: av.y + ecart > 0.98 ? Math.max(0.02, av.y - ecart) : av.y + ecart,
      clair: av.clair,
      penombre: av.penombre,
      teinte: av.teinte
    })
    if (!copie) return
    /* Une bougie soufflée se duplique soufflée : on copie la lampe, pas son état d'usine. */
    if (!av.allumee) await window.jdr.lumieres.update(copie.id, { allumee: false })
    memoriser(async () => void (await window.jdr.lumieres.remove(copie.id)))
    setLumChoisie(copie.id)
    await relire()
  }

  const oterLumiere = async (id: number): Promise<void> => {
    const avant = lumieres.find((l) => l.id === id)
    await window.jdr.lumieres.remove(id)
    if (avant)
      memoriser(async () => {
        const remis = await window.jdr.lumieres.add({
          placeId,
          x: avant.x,
          y: avant.y,
          clair: avant.clair,
          penombre: avant.penombre
        })
        if (remis && !avant.allumee) await window.jdr.lumieres.update(remis.id, { allumee: false })
      })
    setLumChoisie((c) => (c === id ? null : c))
    await relire()
  }

  /**
   * Retenir cette largeur pour les prochaines — ou cesser de la retenir.
   *
   * Rien ne change sur ce qui est déjà posé : c'est le réglage de l'outil,
   * pas une correction du plan.
   */
  const reglerLargeurDefaut = async (largeur: number | null): Promise<void> => {
    await window.jdr.places.ouvLargeur(placeId, largeur)
    setLargeurDefaut(largeur)
  }

  const poserOuverture = async (
    murId: number,
    n: NatureOuverture,
    d: number
  ): Promise<void> => {
    const o = await window.jdr.ouvertures.add({
      murId,
      nature: n,
      d,
      largeur: largeurDefaut ?? undefined
    })
    if (!o) return
    memoriser(async () => void (await window.jdr.ouvertures.remove(o.id)))
    setOuvChoisie(o.id)
    setChoisi(null)
    await relire()
  }

  const reglerOuverture = async (
    id: number,
    patch: { d?: number; largeur?: number; ouverte?: boolean; verrouillee?: boolean }
  ): Promise<void> => {
    await window.jdr.ouvertures.update(id, patch)
    await relire()
  }

  const oterOuverture = async (id: number): Promise<void> => {
    const avant = ouvertures.find((o) => o.id === id)
    if (avant)
      memoriser(async () => {
        const remis = await window.jdr.ouvertures.add({
          murId: avant.murId,
          nature: avant.nature,
          d: avant.d,
          largeur: avant.largeur
        })
        if (remis && (avant.ouverte || avant.verrouillee))
          await window.jdr.ouvertures.update(remis.id, {
            ouverte: avant.ouverte,
            verrouillee: avant.verrouillee
          })
      })
    await window.jdr.ouvertures.remove(id)
    setOuvChoisie(null)
    await relire()
  }

  /* Ouvrir une porte n'est pas une modification du plan : ça ne s'annule pas,
     ça se referme. La pile n'en entend pas parler. */
  const basculerPorte = async (id: number): Promise<void> => {
    const o = ouvertures.find((x) => x.id === id)
    if (!o || o.nature !== 'porte' || o.verrouillee) return
    await window.jdr.ouvertures.update(id, { ouverte: !o.ouverte })
    await relire()
  }

  /**
   * Verrouiller, déverrouiller. C'est le MJ seul qui accorde : une porte
   * verrouillée résiste aux joueurs jusqu'à ce qu'il en décide autrement.
   * Verrouiller referme — le dépôt s'en assure aussi, de son côté.
   */
  const verrouiller = async (id: number, v: boolean): Promise<void> => {
    const o = ouvertures.find((x) => x.id === id)
    if (!o || o.nature !== 'porte') return
    await window.jdr.ouvertures.update(id, { verrouillee: v, ouverte: false })
    await relire()
  }

  /**
   * « Bon, elle cède. » Le MJ accorde le passage : la porte se déverrouille et
   * s'ouvre du même geste, parce qu'à la table c'est un seul geste.
   */
  const accorder = async (id: number): Promise<void> => {
    const o = ouvertures.find((x) => x.id === id)
    if (!o || o.nature !== 'porte') return
    await window.jdr.ouvertures.update(id, { verrouillee: false, ouverte: true })
    await relire()
  }

  /** Une maison s'essaie portes closes : sinon le brouillard est déjà levé. */
  const fermerLesPortes = async (): Promise<void> => {
    if (!ouvertures.some((o) => o.nature === 'porte' && o.ouverte)) return
    await window.jdr.ouvertures.fermerPortes(placeId)
    await relire()
  }

  /**
   * Armer une visite.
   *
   * Le milieu d'un plan ne veut rien dire : une visite commence au seuil, à la
   * grille du parc, au pied de l'escalier. On ne pose donc pas le pion à sa
   * place — on demande où, et le clic suivant le dit.
   *
   * Les portes sont refermées **avant**, et on l'attend : sans cela le premier
   * calcul se ferait sur l'état d'avant, une porte restée ouverte découvrirait
   * la pièce derrière, et la visite commencerait à moitié faite.
   */
  const commencerEssai = async (): Promise<void> => {
    await fermerLesPortes()
    setEssai(null)
    setAttenteDepart(true)
  }

  /** L'endroit est désigné : la maison est noire, la visite commence. */
  const partirDe = (x: number, y: number): void => {
    setAttenteDepart(false)
    /* Le pion d'essai part avec l'angle de la campagne : c'est le seul outil
       qui promette « voilà ce qu'ils voient », il ne peut pas voir autrement. */
    setEssai({
      ...ESSAI_NEUF,
      ouverture: useStore.getState().reglages.mursAngle,
      x,
      y,
      reprise: Date.now()
    })
  }

  const arreterEssai = (): void => {
    setAttenteDepart(false)
    setEssai(null)
  }

  const effacer = async (id: number): Promise<void> => {
    const avant = liste.find((m) => m.id === id)
    /* Les ouvertures posées dessus partent avec lui : la base s'en charge
       (ON DELETE CASCADE), et les remettre demanderait de les retrouver — ce
       que « Défaire » ne promet pas pour un trait effacé. */
    if (avant)
      memoriser(async () => {
        await window.jdr.murs.add({ placeId, nature: avant.nature, pts: avant.pts })
      })
    await window.jdr.murs.remove(id)
    setChoisi(null)
    await relire()
  }

  const defaire = async (): Promise<void> => {
    const geste = pile.current.pop()
    setProfondeur(pile.current.length)
    if (!geste) return
    await geste()
    setChoisi(null)
    await relire()
  }

  return {
    liste,
    ouvertures,
    formes,
    ouvChoisie,
    setOuvChoisie,
    lumieres,
    lumChoisie,
    setLumChoisie,
    poserLumiere,
    reglerLumiere,
    dupliquerLumiere,
    oterLumiere,
    formeVisee,
    setFormeVisee,
    outil,
    setOutil,
    nature,
    setNature,
    aimant,
    setAimant,
    loupe,
    setLoupe,
    apercuLum,
    setApercuLum,
    gomme,
    setGomme,
    noir,
    setNoir,
    choisi,
    setChoisi,
    essai,
    setEssai,
    poser,
    pourPiece,
    setPourPiece,
    contourPropose,
    largeurDefaut,
    reglerLargeurDefaut,
    lumGarde,
    reglerLumGarde,
    regardPortee,
    reglerRegardPortee,
    poserOuverture,
    reglerOuverture,
    oterOuverture,
    couper,
    gommer,
    deplacer,
    changerNature,
    basculerPorte,
    verrouiller,
    accorder,
    fermerLesPortes,
    attenteDepart,
    commencerEssai,
    partirDe,
    arreterEssai,
    effacer,
    defaire,
    peutDefaire: profondeur > 0
  }
}

/* ============================================================
   La barre d'outils
   ============================================================ */

/**
 * Ce que la barre propose, dans l'ordre : sélectionner, ajouter, retirer.
 *
 * Le « + » n'est pas un ornement : il sépare d'un coup d'œil ce qui crée de ce
 * qui manipule. La sélection vient en premier et sert de repos — on y revient
 * après chaque geste.
 */
const OUTILS: {
  cle: OutilMur
  label: string
  aide: string
  icone?: JSX.Element
  plus?: boolean
}[] = [
  {
    cle: 'selection',
    label: 'Sélection',
    aide: 'Attraper un trait, une ouverture ou une pièce ; recliquer un trait le coupe en deux',
    icone: <IconSouris />
  },
  {
    cle: 'mur',
    label: 'Mur',
    aide: 'Clique point par point le long de la cloison — c’est ce qui ferme les pièces',
    plus: true
  },
  {
    cle: 'rideau',
    label: 'Rideau',
    aide: 'Coupe la vue, laisse passer — il ne délimite pas de pièce',
    plus: true
  },
  {
    cle: 'porte',
    label: 'Porte',
    aide: 'Clique sur un mur : elle s’y pose, alignée sur lui',
    plus: true
  },
  {
    cle: 'lumiere',
    label: 'Lumière',
    aide: 'Clique sur la carte : une lampe s’y pose, et les joueurs ne verront que ce qu’elle éclaire',
    plus: true
  },
  {
    cle: 'vitre',
    label: 'Fenêtre',
    aide: 'Clique sur un mur : elle s’y pose, alignée sur lui',
    plus: true
  },
  {
    cle: 'gomme',
    label: 'Gomme',
    aide: 'Glisser pour effacer ce qui passe dessous ; la molette change sa taille',
    icone: <IconGomme />
  }
]

/**
 * « Former une pièce » — désigner les murs, puis les faire tenir ensemble.
 *
 * La détection automatique ne referme que ce qui est vraiment clos. Un plan de
 * maison ne l'est presque jamais : il y a des seuils, des passages, des murs
 * qui s'arrêtent. Ici c'est le MJ qui désigne les traits qui bornent la pièce,
 * et l'application enjambe les trous pour en tirer un contour.
 *
 * Deux temps, donc deux boutons : on entre dans la désignation, puis on crée.
 */
function FormerPiece({
  m,
  onNommer
}: {
  m: ReturnType<typeof useMurs>
  onNommer?: (contour: PointMur[], nom: string) => void
}): JSX.Element {
  const [nom, setNom] = useState<string | null>(null)
  const champ = useRef<HTMLInputElement>(null)
  const enEssai = m.essai !== null
  const choisis = m.pourPiece?.length ?? 0

  useEffect(() => {
    if (nom !== null) champ.current?.focus()
  }, [nom])

  const valider = (): void => {
    const v = (nom ?? '').trim()
    if (!v || !m.contourPropose) return
    onNommer?.(m.contourPropose, v)
    setNom(null)
    m.setPourPiece(null)
  }

  if (m.pourPiece === null)
    return (
      <button
        className="btn btn-sm"
        disabled={enEssai || m.liste.length < 2}
        title="Désigner les murs qui bornent une pièce — les seuils et les passages sont enjambés"
        onClick={() => {
          m.setPourPiece([])
          m.setChoisi(null)
          m.setOuvChoisie(null)
        }}
      >
        <IconFusion />
        Former une pièce
      </button>
    )

  if (nom !== null)
    return (
      <>
        <input
          ref={champ}
          className="murs-nom-piece"
          type="text"
          value={nom}
          placeholder="Nom de la pièce…"
          onChange={(e) => setNom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') valider()
            else if (e.key === 'Escape') setNom(null)
          }}
        />
        <button className="btn btn-sm btn-brass" disabled={!nom.trim()} onClick={valider}>
          Créer
        </button>
      </>
    )

  return (
    <>
      <span className="murs-consigne">
        Sélectionner les murs
        {choisis ? ` · ${choisis} trait${choisis > 1 ? 's' : ''}` : ''}
        {m.contourPropose ? ' · la forme tient' : ''}
      </span>
      <button
        className="btn btn-sm btn-brass"
        disabled={!m.contourPropose}
        title={
          m.contourPropose
            ? 'Ces murs font une forme : en faire une pièce'
            : 'Clique au moins deux murs qui se suivent'
        }
        onClick={() => setNom('')}
      >
        Créer la pièce
      </button>
      <button className="btn btn-sm btn-ghost" onClick={() => m.setPourPiece(null)}>
        Annuler
      </button>
    </>
  )
}

export function BarreMurs({
  m,
  onFormer
}: {
  m: ReturnType<typeof useMurs>
  /** Créer un lieu à partir du contour que les murs désignés dessinent. */
  onFormer?: (contour: PointMur[], nom: string) => void
}): JSX.Element {
  const enEssai = m.essai !== null || m.attenteDepart
  /* Sans enveloppe : la barre de la fiche la fournit, avec la ligne d'aide. */
  return (
    <>
      <span className="eyebrow">Murs</span>

      {OUTILS.map((o) => (
        <button
          key={o.cle}
          className="btn btn-sm"
          aria-pressed={!enEssai && m.outil === o.cle}
          disabled={enEssai}
          title={o.aide}
          onClick={() => {
            m.setOutil(o.cle)
            m.setChoisi(null)
            m.setOuvChoisie(null)
          }}
        >
          {o.plus ? <IconPlus /> : o.icone}
          {o.label}
        </button>
      ))}

      {/* L'aperçu ne se propose que l'outil Lumière en main : ailleurs, il
          n'aurait rien à montrer qu'on ne voie déjà. */}
      {m.outil === 'lumiere' && !enEssai ? (
        <button
          className={`btn btn-sm${m.apercuLum ? ' btn-on' : ''}`}
          aria-pressed={m.apercuLum}
          title={
            m.lumieres.length
              ? 'Voir la carte comme la lumière la laisse : ce qui reste noir restera noir pour les joueurs'
              : 'Pose d’abord une lumière : il n’y aurait rien à montrer'
          }
          disabled={!m.lumieres.length}
          onClick={() => m.setApercuLum(!m.apercuLum)}
        >
          <IconSoleil />
          Ombre et lumière
        </button>
      ) : null}

      <span className="murs-sep" />

      <button
        className="btn btn-sm btn-ico"
        aria-pressed={m.aimant}
        aria-label="Colle aux murs"
        disabled={enEssai}
        title="Colle aux murs — le trait s’accroche aux murs existants, à leurs angles et aux angles droits"
        onClick={() => m.setAimant(!m.aimant)}
      >
        <IconAimant />
      </button>
      <FormerPiece m={m} onNommer={onFormer} />
      <button
        className="btn btn-sm btn-ico"
        aria-pressed={m.loupe}
        aria-label="Loupe"
        disabled={enEssai}
        title="Loupe — elle suit le curseur pendant le tracé pour viser au pixel"
        onClick={() => m.setLoupe(!m.loupe)}
      >
        <IconLoupe />
      </button>
      <button
        className="btn btn-sm btn-ghost"
        disabled={enEssai || !m.peutDefaire}
        title="Défaire le dernier geste"
        onClick={() => void m.defaire()}
      >
        Défaire
      </button>

      <div className="spacer" />

      {/* Entrer dans le test et en sortir sont deux gestes contraires : ils ne
          se ressemblent pas. Vert on essaie, rouge on s'arrête. */}
      <button
        className={`btn btn-sm ${enEssai ? 'btn-sortie' : 'btn-essai'}`}
        title={
          enEssai
            ? 'Ranger le pion et revenir au tracé des murs'
            : 'Poser un pion d’essai : il ne traverse pas, et il ne voit que ce que les murs lui laissent voir'
        }
        onClick={() => {
          if (enEssai) {
            m.arreterEssai()
            return
          }
          void m.commencerEssai()
        }}
      >
        {enEssai ? 'Quitter le test' : 'Tester'}
      </button>
    </>
  )
}

/* ============================================================
   Le calque posé sur la carte
   ============================================================ */

export function CalqueMurs({
  murs,
  ouvertures = [],
  pourPiece = null,
  onPourPiece,
  contourPropose = null,
  attenteDepart = false,
  onDepart,
  formes = [],
  formeVisee = null,
  nomDeForme,
  mode,
  outil,
  nature,
  aimant,
  loupe,
  apercuLum = false,
  gomme,
  carte,
  choisi,
  ouvChoisie,
  onOuvChoisie,
  onChoisir,
  onPoser,
  onPoserOuverture,
  onNommer,
  onCouper,
  onDeplacer,
  onEffacer,
  onBasculerPorte,
  onVerrouiller,
  onAccorder,
  onGommer,
  onGommeTaille,
  onBrouillard,
  essai,
  onEssai,
  largeurOuv = LARGEUR_DEFAUT,
  lumieres = [],
  lumChoisie = null,
  lumGarde = false,
  regardPortee = null,
  onLumChoisie,
  onPoserLumiere,
  onReglerLumiere,
  onOterLumiere
}: {
  murs: Mur[]
  /** Les portes et fenêtres posées sur ces murs. */
  ouvertures?: Ouverture[]
  /** Les murs qu'on désigne pour en faire une pièce. */
  pourPiece?: number[] | null
  onPourPiece?: (ids: number[]) => void
  /** Le contour que ces murs dessinent, montré tant qu'on les choisit. */
  contourPropose?: PointMur[] | null
  /** On attend le clic qui dira d'où part la visite. */
  attenteDepart?: boolean
  onDepart?: (x: number, y: number) => void
  /** Ce que les murs referment — calculé par le hook, pas ici. */
  formes?: Forme[]
  /** Le nom du lieu qui occupe cette forme, s'il en a un. */
  nomDeForme?: (f: Forme) => string | null
  /** La pièce qu'on regarde dans la liste : on l'éclaire. */
  formeVisee?: number | null
  /** La largeur que prendra l'ouverture qu'on s'apprête à poser. */
  largeurOuv?: number
  /** Les points de lumière posés sur cette carte. */
  lumieres?: Lumiere[]
  lumChoisie?: number | null
  /** Sur cette carte, une zone éclairée reste-t-elle découverte ? */
  lumGarde?: boolean
  /** Jusqu'où le regard porte, en part de la largeur ; `null`, sans limite. */
  regardPortee?: number | null
  onLumChoisie?: (id: number | null) => void
  onPoserLumiere?: (x: number, y: number) => void
  onReglerLumiere?: (
    id: number,
    patch: { x?: number; y?: number; allumee?: boolean }
  ) => void
  onOterLumiere?: (id: number) => void
  mode: 'lecture' | 'edition'
  outil?: OutilMur
  nature?: NatureMur
  aimant?: boolean
  /** La loupe qui suit le curseur pendant le tracé. */
  loupe?: boolean
  /** Montrer la carte comme la lumière la laisse : ombre et lueur, rien d'autre. */
  apercuLum?: boolean
  /** Le rayon de la gomme, en pixels de mise en page. */
  gomme?: number
  /** L'image de la carte : c'est elle que la loupe agrandit. */
  carte?: string | null
  choisi?: number | null
  ouvChoisie?: number | null
  onOuvChoisie?: (id: number | null) => void
  onChoisir?: (id: number | null) => void
  onPoser?: (nature: NatureMur, traces: PointMur[][], retraits?: Retrait[]) => void
  /** Poser une porte ou une fenêtre sur un mur, à l'endroit visé. */
  onPoserOuverture?: (murId: number, nature: NatureOuverture, d: number) => void
  /** Baptiser une forme fermée : elle devient un lieu. */
  onNommer?: (f: Forme, nom: string) => void
  onCouper?: (id: number, pieces: PointMur[][]) => void
  onGommer?: (retraits: Retrait[]) => void
  /** La part de carte jamais vue — pour que le volet puisse le dire. */
  onBrouillard?: (part: number | null) => void
  onGommeTaille?: (rayon: number) => void
  onDeplacer?: (id: number, pts: PointMur[]) => void
  onEffacer?: (id: number) => void
  onBasculerPorte?: (id: number) => void
  onVerrouiller?: (id: number, v: boolean) => void
  onAccorder?: (id: number) => void
  essai?: EssaiPion | null
  onEssai?: (e: EssaiPion) => void
}): JSX.Element {
  const hote = useRef<HTMLDivElement>(null)
  const masque = useId().replace(/:/g, '')
  const [boite, setBoite] = useState({ w: 0, h: 0 })

  /*
   * Le calque se mesure : toute la géométrie se fait en pixels de l'image,
   * jamais en fractions — sinon les angles seraient faux (voir murs.ts).
   *
   * On mesure la taille **de mise en page**, pas celle à l'écran : le cadre
   * qui nous porte est agrandi par une transformation quand le MJ zoome, et
   * un dessin déjà à la taille de l'écran s'y retrouverait agrandi deux fois.
   */
  useEffect(() => {
    const el = hote.current
    if (!el) return
    const lire = (): void => setBoite({ w: el.clientWidth, h: el.clientHeight })
    lire()
    const ro = new ResizeObserver(lire)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { w, h } = boite
  const enPx = (p: PointMur): Pt => ({ x: p[0] * w, y: p[1] * h })
  const enFrac = (p: Pt): PointMur => [w ? p.x / w : 0, h ? p.y / h : 0]

  const edition = mode === 'edition' && !essai
  const rayonGomme = gomme ?? GOMME.rayon
  const [encours, setEncours] = useState<Pt[] | null>(null)
  const [survol, setSurvol] = useState<Pt | null>(null)
  const [rect, setRect] = useState<{ a: Pt; b: Pt } | null>(null)
  const [apercu, setApercu] = useState<{ id: number; pts: Pt[] } | null>(null)
  /* Le geste de gomme : les ronds semés depuis le début du glisser. Rien n'est
     écrit tant qu'on n'a pas relâché — un coup de gomme est un geste, pas
     trente écritures. */
  const [ronds, setRonds] = useState<Pt[] | null>(null)
  /* La porte qui vient de résister : elle clignote une seconde, et on comprend
     pourquoi elle ne s'ouvre pas sans avoir à lire une phrase. */
  const [refus, setRefus] = useState<number | null>(null)
  /** La lumière qu'on traîne : on la suit à l'écran avant de l'écrire. */
  const [lumGlissee, setLumGlissee] = useState<{ id: number; x: number; y: number } | null>(null)
  const prise = useRef<{ quoi: 'poignee' | 'pion' | 'lum'; id: number; i: number } | null>(null)

  /* Le pointeur arrive en pixels d'écran ; on passe par la fraction pour
     retomber dans la mise en page, même quand la carte est agrandie. */
  const position = (e: { clientX: number; clientY: number }): Pt => {
    const b = hote.current!.getBoundingClientRect()
    return { x: ((e.clientX - b.left) / b.width) * w, y: ((e.clientY - b.top) / b.height) * h }
  }

  /** L'aimant : un bout lâché près d'un autre s'y colle. */
  /**
   * Viser un point, et dire à quoi il s'accroche.
   *
   * Un aimant muet fait douter : on ne sait pas si le trait est droit, ni à
   * quoi il s'aligne. Celui-ci rend donc le point corrigé **et** ce qu'il faut
   * montrer — les traits pointillés vers ce qui l'aligne, et l'équerre quand
   * l'angle est droit. C'est ce qui se voit qui donne confiance, pas ce qui
   * se calcule.
   *
   * Trois accroches, dans cet ordre : un bout déjà posé (on s'y colle), puis
   * l'alignement d'abscisse et celui d'ordonnée, chacun sur le point le plus
   * franchement aligné — de près comme de loin, un mur à l'autre bout du plan
   * aligne aussi bien que le voisin.
   */
  const viser = (p: Pt): Guides => {
    if (!aimant) return { p, lignes: [], equerre: null }

    const refs: Pt[] = []
    for (const m of murs) for (const q of m.pts) refs.push(enPx(q))
    if (encours) refs.push(...encours)

    let proche = COLLE
    let sur: Pt | null = null
    for (const r of refs) {
      const d = Math.hypot(p.x - r.x, p.y - r.y)
      if (d < proche) {
        proche = d
        sur = r
      }
    }
    if (sur) return { p: sur, lignes: [], equerre: null }

    let ecartX = ALIGNE
    let ecartY = ALIGNE
    let refX: Pt | null = null
    let refY: Pt | null = null
    for (const r of refs) {
      const ex = Math.abs(r.x - p.x)
      if (ex < ecartX) {
        ecartX = ex
        refX = r
      }
      const ey = Math.abs(r.y - p.y)
      if (ey < ecartY) {
        ecartY = ey
        refY = r
      }
    }

    const q: Pt = { x: refX ? refX.x : p.x, y: refY ? refY.y : p.y }
    const lignes: { de: Pt; a: Pt }[] = []
    if (refX) lignes.push({ de: refX, a: q })
    if (refY) lignes.push({ de: refY, a: q })

    /* L'équerre : le segment qu'on est en train de poser tombe à angle droit
       sur le précédent. On la montre plutôt que de la deviner. */
    let equerre: Guides['equerre'] = null
    if (encours && encours.length >= 2) {
      const dernier = encours[encours.length - 1]
      const avant = encours[encours.length - 2]
      const ax = dernier.x - avant.x
      const ay = dernier.y - avant.y
      const bx = q.x - dernier.x
      const by = q.y - dernier.y
      const na = Math.hypot(ax, ay)
      const nb = Math.hypot(bx, by)
      if (na > 2 && nb > 2 && Math.abs((ax * bx + ay * by) / (na * nb)) < 0.06)
        equerre = { sommet: dernier, depuis: avant, vers: q }
    }

    return { p: q, lignes, equerre }
  }

  /** Le point corrigé, pour qui n'a que faire des guides. */
  const aimante = (p: Pt): Pt => viser(p).p

  /**
   * Poser un trait, en retirant aux autres ce qu'il recouvre : une vitre sur
   * un mur perce une fenêtre, elle ne se superpose pas. Le calcul se fait ici
   * parce que c'est ici qu'on connaît la taille de l'image — la tolérance est
   * en pixels, et sept pixels, c'est l'épaisseur d'un trait.
   */
  const poserEtPercer = (traces: Pt[][]): void => {
    const bons = traces.filter((t) => t.length >= 2)
    if (!nature || !bons.length) return
    const retraits: Retrait[] = []
    for (const m of murs) {
      /* Chaque tracé mord sur ce que le précédent a laissé : une pièce posée
         sur un mur existant le perce quatre fois, pas une. */
      let pieces: Pt[][] = [m.pts.map(enPx)]
      let touche = false
      for (const t of bons) {
        const suite: Pt[][] = []
        for (const piece of pieces) {
          const reste = soustraireTrace(piece, t, 7)
          if (reste) {
            touche = true
            suite.push(...reste)
          } else suite.push(piece)
        }
        pieces = suite
      }
      if (touche) retraits.push({ id: m.id, pieces: pieces.map((l) => l.map(enFrac)) })
    }
    onPoser?.(
      nature,
      bons.map((t) => t.map(enFrac)),
      retraits
    )
  }

  const finirTrace = (): void => {
    const pts = encours
    setEncours(null)
    if (pts) poserEtPercer([pts])
  }

  /* Le clavier finit le trait et efface le trait choisi. L'écouteur est sur la
     fenêtre : un calque en SVG ne prend pas le focus, et on ne va pas demander
     au MJ de cliquer quelque part avant d'appuyer sur Échap. */
  useEffect(() => {
    if (!edition) return
    const h = (e: KeyboardEvent): void => {
      const cible = e.target as HTMLElement | null
      if (cible && /^(INPUT|TEXTAREA|SELECT)$/.test(cible.tagName)) return
      if (e.key === 'Escape') {
        if (encours) finirTrace()
        else onChoisir?.(null)
      } else if (e.key === 'Enter' && encours) {
        finirTrace()
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !encours) {
        if (lumChoisie != null) {
          e.preventDefault()
          onOterLumiere?.(lumChoisie)
        } else if (choisi != null) {
          e.preventDefault()
          onEffacer?.(choisi)
        }
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  /* La molette tourne le pion d'essai, comme en régie : douze crans pour un
     tour, au doigt fin avec Maj. Posée à la main, en non passif, pour retenir
     l'agrandissement de l'image qui se trouve dessous. */
  useEffect(() => {
    const el = hote.current
    const gommeActive = edition && outil === 'gomme' && !!onGommeTaille
    if (!el || (!essai && !gommeActive)) return
    const h = (e: WheelEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      const sens = e.deltaY < 0 ? 1 : -1
      if (essai && onEssai) {
        const pas = (e.shiftKey ? 5 : 30) * -sens
        onEssai({ ...essai, cap: (essai.cap + pas + 360) % 360 })
      } else if (onGommeTaille) {
        onGommeTaille(
          Math.min(GOMME.max, Math.max(GOMME.min, Math.round(rayonGomme * (sens > 0 ? 1.15 : 1 / 1.15))))
        )
      }
    }
    el.addEventListener('wheel', h, { passive: false })
    return () => el.removeEventListener('wheel', h)
  }, [essai, onEssai, edition, outil, onGommeTaille, rayonGomme])

  const barrieresPas = barrieres(murs, 'pas', enPx, ouvertures)

  /*
   * La mémoire du pion.
   *
   * Ce qu'il n'a **jamais vu** reste noir ; ce qu'il a vu et qu'il ne regarde
   * plus reste sombre. On ajoute donc, à chaque pas et à chaque tour de tête,
   * les cases que son regard couvre — plus les quelques-unes qu'il a sous les
   * pieds, parce qu'on sait où l'on est même de dos.
   *
   * Premier essai : la règle était « tout ce qu'on peut atteindre est connu ».
   * Sur une carte où les murs n'enferment rien, elle ne laissait pas un pixel
   * de noir — on connaissait la maison sans l'avoir parcourue. Ce qui compte
   * n'est pas ce qu'on pourrait atteindre, c'est ce qu'on a vu.
   *
   * À quoi s'ajoute la seule chose qu'on apprend sans regarder : **ouvrir une
   * porte montre la pièce derrière**, entière, et elle seule.
   */
  const carreaux = useMemo(() => (w > 0 && h > 0 ? grille(w, h) : null), [w, h])
  const [connu, setConnu] = useState<{ cle: string; cases: Set<number> } | null>(null)

  /*
   * Un nouvel essai repart d'une maison noire.
   *
   * `reprise` change à chaque entrée dans l'essai comme à chaque « Replacer le
   * pion » : c'est ce qui garantit qu'on ne rouvre jamais une visite à moitié
   * faite. On oublie aussi tout en sortant, pour ne rien traîner.
   */
  useEffect(() => setConnu(null), [essai?.reprise, essai === null])

  const barrieresVue = useMemo(
    () => (w > 0 && h > 0 ? barrieres(murs, 'vue', enPx, ouvertures).concat(bords(w, h)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [murs, ouvertures, w, h]
  )

  const vision =
    essai && w > 0 && h > 0
      ? champDeVision(
          barrieresVue,
          { x: essai.x * w, y: essai.y * h },
          essai.cap,
          essai.ouverture,
          regardPortee ? regardPortee * w : Infinity
        )
      : null

  /**
   * Les ronds de lumière, arrêtés par les mêmes murs que la vue.
   *
   * Une lampe est un œil sans dos : elle voit à 360°, et sa lueur s'arrête au
   * premier mur ou au bout de sa portée — celle qui vient en premier. La
   * pénombre compte comme de la lumière : on y voit mal, on y voit quand même.
   *
   * Le pion peut porter la sienne, et elle le suit.
   */
  /**
   * L'aperçu d'éclairage : l'outil Lumière en main, on regarde la carte comme
   * la lumière la laisse. Sans lui, on règle des rayons en imaginant leur
   * effet ; avec lui, on voit tout de suite ce qui restera dans le noir.
   */
  const ombreEtLumiere = !!apercuLum && outil === 'lumiere' && edition && !essai

  const eclairages = useMemo(() => {
    if ((!essai && !ombreEtLumiere) || w <= 0 || h <= 0) return []
    const ronds = lumieres
      .filter((l) => l.allumee)
      .map((l) => champDeVision(barrieresVue, { x: l.x * w, y: l.y * h }, 0, 360, l.penombre * w))
    if (essai && essai.lampe > 0)
      ronds.push(
        champDeVision(
          barrieresVue,
          { x: essai.x * w, y: essai.y * h },
          0,
          360,
          essai.lampe * w
        )
      )
    return ronds.filter((p) => p.length > 2)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    essai?.x,
    essai?.y,
    essai?.lampe,
    essai === null,
    ombreEtLumiere,
    lumieres,
    barrieresVue,
    w,
    h
  ])

  /**
   * L'éclairage commande-t-il ce qu'on voit ?
   *
   * Une carte sans la moindre lampe se visite comme avant — sinon toutes les
   * cartes déjà tracées deviendraient noires du jour au lendemain. Dès qu'une
   * lumière **existe**, la règle s'applique : on ne voit que ce qui est à la
   * fois dans le regard et dans la lueur. Toutes soufflées, il ne reste que ce
   * qu'on a au bout des bras — c'est bien ce qu'on veut d'une maison éteinte.
   */
  const sousLaLampe = lumieres.length > 0 || (essai?.lampe ?? 0) > 0

  /**
   * Les ronds qui ont une couleur à dire.
   *
   * Le blanc ne teinte rien — c'est le défaut, et poser un voile blanc sur la
   * carte ne ferait que la délaver. La torche du pion n'est pas de la partie :
   * elle n'a pas de couleur à régler.
   */
  const teintes = useMemo(() => {
    /* `eclairages` est construit sur les lampes allumées, dans cet ordre : on
       repart donc du même filtre pour que les rangs se correspondent, et on
       écarte le blanc ensuite. Filtrer avant décalerait tout d'un cran. */
    const allumees = lumieres.filter((l) => l.allumee)
    return allumees
      .map((l, i) => ({ teinte: l.teinte, rond: eclairages[i] }))
      .filter(
        (t): t is { teinte: string; rond: Pt[] } =>
          !!t.rond && t.teinte !== '#ffffff' && t.teinte !== '#fff'
      )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lumieres, eclairages])

  /* Les pièces qu'une porte ouverte découvre : elles ne dépendent que des
     murs, pas de l'endroit où se tient le pion. */
  const parLesPortes = useMemo(
    () =>
      essai && carreaux
        ? piecesDesPortesOuvertes(murs, ouvertures, enPx, carreaux)
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [essai !== null, murs, carreaux, w, h]
  )

  useEffect(() => {
    if (!essai || !carreaux || !vision) return
    const cle = `${carreaux.cols}x${carreaux.rows}`
    const neuf = casesVues(vision, carreaux)
    /* On ne retient que ce qu'on a pu voir : le regard, croisé avec la
       lumière. Ce qu'on traverse dans le noir ne s'apprend pas. */
    if (sousLaLampe) {
      /*
       * Ce qu'on retient, et ce qu'on oublie.
       *
       * La carte le décide, pas la lampe : ou bien une zone éclairée une fois
       * reste découverte — on avance, la maison se dessine —, ou bien elle
       * retombe au noir dès qu'on ne la voit plus, et l'on redécouvre tout en
       * revenant sur ses pas.
       *
       * Dans le second cas, rien de ce que la lumière montre n'entre en
       * mémoire : il ne reste que ce qu'on a sous les pieds.
       */
      const eclairees = new Set<number>()
      for (const rond of eclairages) for (const c of casesVues(rond, carreaux)) eclairees.add(c)
      if (lumGarde) {
        for (const c of [...neuf]) if (!eclairees.has(c)) neuf.delete(c)
        if (parLesPortes) for (const c of parLesPortes) if (eclairees.has(c)) neuf.add(c)
      } else {
        neuf.clear()
      }
    } else if (parLesPortes) for (const c of parLesPortes) neuf.add(c)
    /*
     * Ce qu'on a sous les pieds.
     *
     * On le voit toujours — le petit rond autour du pion est découpé dans
     * l'ombre à chaque instant. Mais on ne le **retient** que si la carte
     * garde ce qu'elle éclaire : sinon le pion laissait derrière lui une
     * traînée de cases connues, un chemin de mie de pain dans une maison
     * qu'on voulait noire.
     */
    if (!sousLaLampe || lumGarde)
      for (const c of casesAutour({ x: essai.x * w, y: essai.y * h }, carreaux.taille * 2, carreaux))
        neuf.add(c)
    setConnu((cur) => {
      const base = cur?.cle === cle ? cur.cases : null
      if (base && [...neuf].every((c) => base.has(c))) return cur
      const s = new Set(base ?? [])
      for (const c of neuf) s.add(c)
      return { cle, cases: s }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    essai?.x,
    essai?.y,
    essai?.cap,
    essai?.ouverture,
    essai?.reprise,
    eclairages,
    lumGarde,
    parLesPortes,
    carreaux,
    w,
    h
  ])

  const inconnu = useMemo(
    () => (essai && carreaux && connu ? cheminDesInconnues(connu.cases, carreaux) : ''),
    [essai, carreaux, connu]
  )

  /* Combien de carte reste noire. Dit à voix haute dans le volet : sans ça, on
     se demande si le brouillard est en panne alors qu'on a tout vu. */
  useEffect(() => {
    if (!onBrouillard) return
    if (!essai || !carreaux || !connu) {
      onBrouillard(null)
      return
    }
    const total = carreaux.cols * carreaux.rows
    onBrouillard(Math.max(0, (total - connu.cases.size) / total))
  }, [essai, carreaux, connu, onBrouillard])
  /** La lumière sous le curseur — sa pastille, pas son halo. */
  const lumiereSous = (p: Pt): Lumiere | null => {
    let vue: Lumiere | null = null
    let court = 15
    for (const l of lumieres) {
      const d = Math.hypot(p.x - l.x * w, p.y - l.y * h)
      if (d < court) {
        court = d
        vue = l
      }
    }
    return vue
  }

  const surPointerDown = (e: React.PointerEvent): void => {
    if (e.button === 2) return
    /* Le cadre qui nous porte recadre l'image au glisser : tant qu'on trace,
       il ne doit pas voir passer le geste. */
    e.stopPropagation()
    const p = position(e)

    /* On attend le départ : ce clic-là ne fait rien d'autre que le poser. */
    if (attenteDepart) {
      onDepart?.(p.x / w, p.y / h)
      return
    }

    if (essai && onEssai) {
      /* Souffler une bougie en cours de visite : la pièce retombe dans le
         noir sous les yeux du pion. C'est le même geste que pour une porte. */
      const lampe = lumiereSous(p)
      if (lampe) {
        onReglerLumiere?.(lampe.id, { allumee: !lampe.allumee })
        return
      }
      const porte = ouvertureSous(p)
      if (porte && porte.nature === 'porte') {
        if (porte.verrouillee) {
          /* Les joueurs ne passent pas. Le MJ, lui, accorde — Maj et un clic,
             le geste qu'on fait en disant « bon, elle cède ». */
          if (e.shiftKey) onAccorder?.(porte.id)
          else {
            setRefus(porte.id)
            window.setTimeout(() => setRefus((r) => (r === porte.id ? null : r)), 900)
          }
          return
        }
        onBasculerPorte?.(porte.id)
        return
      }
      const oeil = { x: essai.x * w, y: essai.y * h }
      if (Math.hypot(p.x - oeil.x, p.y - oeil.y) < 26) {
        prise.current = { quoi: 'pion', id: 0, i: 0 }
        e.currentTarget.setPointerCapture(e.pointerId)
      }
      return
    }
    if (!edition) return

    /* On désigne : chaque clic sur un trait l'ajoute ou le retire, et rien
       d'autre ne se passe — surtout pas un tracé par mégarde. */
    if (pourPiece) {
      const vise = murSous(murs, p, enPx, 14)
      if (!vise) return
      onPourPiece?.(
        pourPiece.includes(vise.id)
          ? pourPiece.filter((x) => x !== vise.id)
          : [...pourPiece, vise.id]
      )
      return
    }

    if (outil === 'gomme') {
      setRonds([p])
      e.currentTarget.setPointerCapture(e.pointerId)
      return
    }
    if (outil && outilTrace(outil)) {
      const q = aimante(p)
      setEncours((cur) => (cur ? [...cur, q] : [q]))
      return
    }
    /* Une lumière ne vise rien : elle se pose là où l'on clique. */
    if (outil === 'lumiere') {
      onPoserLumiere?.(p.x / w, p.y / h)
      return
    }
    /* Une ouverture se pose sur un mur : on clique près de lui, elle s'y met,
       alignée. Loin de tout mur, il n'y a rien à percer. */
    if (outil && outilPerce(outil)) {
      const ou = accrocherAuMur(murs, enFrac(p), PORTEE_OUVERTURE)
      if (ou) onPoserOuverture?.(ou.murId, outil, ou.d)
      return
    }
    /* Sélection : la lumière d'abord — c'est une pastille posée par-dessus
       tout le reste, et c'est elle qu'on vise en cliquant dessus. */
    const lampe = lumiereSous(p)
    if (lampe) {
      onLumChoisie?.(lampe.id)
      onChoisir?.(null)
      onOuvChoisie?.(null)
      prise.current = { quoi: 'lum', id: lampe.id, i: 0 }
      setLumGlissee({ id: lampe.id, x: lampe.x * w, y: lampe.y * h })
      e.currentTarget.setPointerCapture(e.pointerId)
      return
    }
    /* Puis une ouverture, plus petite qu'un mur et posée dessus — sinon on ne
       pourrait jamais l'attraper. */
    const ouv = ouvertureSous(p)
    if (ouv) {
      onOuvChoisie?.(ouv.id)
      onChoisir?.(null)
      return
    }
    /* Puis une poignée du trait déjà choisi — sinon on ne pourrait jamais
       rattraper un point posé de travers. */
    const m = murs.find((x) => x.id === choisi)
    if (m) {
      for (let i = 0; i < m.pts.length; i++) {
        const q = enPx(m.pts[i])
        if (Math.hypot(p.x - q.x, p.y - q.y) < 13) {
          prise.current = { quoi: 'poignee', id: m.id, i }
          setApercu({ id: m.id, pts: m.pts.map(enPx) })
          e.currentTarget.setPointerCapture(e.pointerId)
          return
        }
      }
    }
    const sous = murSous(murs, p, enPx, 12)
    /* Recliquer le trait déjà choisi le coupe en deux au point visé : c'est
       comme ça qu'on donne une nature différente à la moitié d'un mur, sans
       le refaire. Trop près d'un bout, on ne coupe pas — un moignon ne sert
       à rien. */
    if (sous && sous.id === choisi && onCouper) {
      const coupe = couperTrace(sous.pts.map(enPx), p)
      if (coupe) {
        onCouper(
          sous.id,
          coupe.map((l) => l.map(enFrac))
        )
        return
      }
    }
    onOuvChoisie?.(null)
    onLumChoisie?.(null)
    onChoisir?.(sous ? sous.id : null)
  }

  const surPointerMove = (e: React.PointerEvent): void => {
    e.stopPropagation()
    const p = position(e)
    setSurvol(p)
    const t = prise.current
    if (t?.quoi === 'pion' && essai && onEssai) {
      const de = { x: essai.x * w, y: essai.y * h }
      const vers = pasContraint(barrieresPas, de, p, { w, h }, 2)
      const dx = vers.x - de.x
      const dy = vers.y - de.y
      const cap =
        essai.marche && Math.hypot(dx, dy) > 1.5
          ? (Math.atan2(dy, dx) * 180) / Math.PI + 90
          : essai.cap
      onEssai({ ...essai, x: vers.x / w, y: vers.y / h, cap: (cap + 360) % 360 })
      return
    }
    if (ronds) {
      const dernier = ronds[ronds.length - 1]
      /* Un rond tous les demi-rayons : la souris va plus vite que les
         événements, et une gomme qui laisse des trous n'efface pas. */
      if (Math.hypot(p.x - dernier.x, p.y - dernier.y) > rayonGomme / 2) setRonds([...ronds, p])
      return
    }
    if (t?.quoi === 'lum') {
      setLumGlissee({ id: t.id, x: Math.max(0, Math.min(w, p.x)), y: Math.max(0, Math.min(h, p.y)) })
      return
    }
    if (t?.quoi === 'poignee' && apercu) {
      const q = aimante(p)
      setApercu({ id: t.id, pts: apercu.pts.map((r, i) => (i === t.i ? q : r)) })
      return
    }
    if (rect) setRect({ ...rect, b: p })
  }

  const surPointerUp = (e: React.PointerEvent): void => {
    const t = prise.current
    prise.current = null
    if (ronds) {
      const retraits: Retrait[] = []
      for (const m of murs) {
        const reste = gommerTrace(m.pts.map(enPx), ronds, rayonGomme)
        if (reste) retraits.push({ id: m.id, pieces: reste.map((l) => l.map(enFrac)) })
      }
      setRonds(null)
      e.currentTarget.releasePointerCapture?.(e.pointerId)
      if (retraits.length) onGommer?.(retraits)
      return
    }
    if (t?.quoi === 'pion') return
    if (t?.quoi === 'lum') {
      e.currentTarget.releasePointerCapture?.(e.pointerId)
      if (lumGlissee) onReglerLumiere?.(t.id, { x: lumGlissee.x / w, y: lumGlissee.y / h })
      setLumGlissee(null)
      return
    }
    if (t?.quoi === 'poignee') {
      if (apercu) onDeplacer?.(t.id, apercu.pts.map(enFrac))
      setApercu(null)
      return
    }
    if (rect) {
      const { a, b } = rect
      setRect(null)
      if (Math.abs(a.x - b.x) > 10 && Math.abs(a.y - b.y) > 10) {
        /* Quatre côtés, quatre traits : la fenêtre du mur nord ne doit rien
           avoir à faire avec le mur sud. */
        const c1 = a
        const c2 = { x: b.x, y: a.y }
        const c3 = b
        const c4 = { x: a.x, y: b.y }
        poserEtPercer([
          [c1, c2],
          [c2, c3],
          [c3, c4],
          [c4, c1]
        ])
      }
      e.currentTarget.releasePointerCapture?.(e.pointerId)
    }
  }

  /*
   * Le point que le prochain clic posera — aimant compris. L'aperçu et la
   * loupe montrent celui-là, pas la position brute de la souris : on doit voir
   * le bout se coller avant de cliquer, pas après.
   */
  const guides = survol ? viser(survol) : null
  const vise = guides?.p ?? null

  /**
   * L'ouverture qu'on s'apprête à poser, dessinée sur le mur qu'on vise.
   *
   * Sans elle, on clique à l'aveugle : on ne sait ni sur quel mur elle va se
   * mettre, ni où exactement, ni de quelle largeur. Avec elle, le geste est
   * décidé avant d'être fait.
   */
  const apercuOuverture = (): JSX.Element | null => {
    if (!edition || !outil || !outilPerce(outil) || !survol) return null
    const ou = accrocherAuMur(murs, enFrac(survol), PORTEE_OUVERTURE)
    if (!ou) return null
    const mur = murs.find((m) => m.id === ou.murId)
    if (!mur) return null
    const b = bordsOuverture(mur, {
      id: -1,
      murId: mur.id,
      nature: outil,
      d: ou.d,
      largeur: largeurOuv,
      ouverte: false,
      verrouillee: false
    })
    const a = enPx(b.a)
    const z = enPx(b.b)
    const d = `M${a.x} ${a.y}L${z.x} ${z.y}`
    return (
      <g className={`ouv n-${outil} apercu`} pointerEvents="none">
        <path d={d} className="trou" />
        <path d={d} className="marque" />
      </g>
    )
  }

  /**
   * Les guides d'alignement, pendant qu'on trace.
   *
   * Ils ne s'affichent qu'à ce moment-là : ailleurs, ils encombreraient le
   * plan sans rien apporter.
   */
  const guidesSvg = (): JSX.Element | null => {
    if (!guides || !edition || !outil || !outilTrace(outil)) return null
    if (!guides.lignes.length && !guides.equerre) return null
    const e = guides.equerre
    let equerre = ''
    if (e) {
      const bras = (a: Pt): Pt => {
        const dx = a.x - e.sommet.x
        const dy = a.y - e.sommet.y
        const n = Math.hypot(dx, dy) || 1
        return { x: (dx / n) * 12, y: (dy / n) * 12 }
      }
      const u = bras(e.depuis)
      const v = bras(e.vers)
      equerre =
        `M${e.sommet.x + u.x} ${e.sommet.y + u.y}` +
        `L${e.sommet.x + u.x + v.x} ${e.sommet.y + u.y + v.y}` +
        `L${e.sommet.x + v.x} ${e.sommet.y + v.y}`
    }
    return (
      <g className="murs-guides" pointerEvents="none">
        {guides.lignes.map((l, i) => (
          <path key={i} d={`M${l.de.x} ${l.de.y}L${l.a.x} ${l.a.y}`} className="guide" />
        ))}
        {guides.lignes.map((l, i) => (
          <circle key={`a${i}`} cx={l.de.x} cy={l.de.y} r={3.5} className="guide-ancre" />
        ))}
        {equerre ? <path d={equerre} className="guide-equerre" /> : null}
      </g>
    )
  }

  /**
   * L'ouverture sous le curseur, s'il y en a une. On la cherche par le
   * segment qu'elle occupe et non par son mur : deux portes sur le même mur
   * doivent se distinguer.
   */
  const ouvertureSous = (p: Pt): Ouverture | null => {
    let meilleure: { o: Ouverture; d: number } | null = null
    for (const o of ouvertures) {
      const mur = murs.find((x) => x.id === o.murId)
      if (!mur) continue
      const b = bordsOuverture(mur, o)
      const d = distanceAuSegment(p, enPx(b.a), enPx(b.b))
      if (d < 13 && (!meilleure || d < meilleure.d)) meilleure = { o, d }
    }
    return meilleure ? meilleure.o : null
  }

  /** Les traits posés. Dessinés deux fois : sur la carte, et dans la loupe. */
  const traits = (): JSX.Element[] =>
    murs.map((m) => {
      const pts = apercu?.id === m.id ? apercu.pts : m.pts.map(enPx)
      if (pts.length < 2) return <g key={m.id} />
      /* Sous la gomme, le trait se montre déjà tel qu'il restera : on efface
         en voyant le résultat, pas en devinant. */
      const ronge = ronds ? gommerTrace(pts, ronds, rayonGomme) : null
      if (ronge && !ronge.length) return <g key={m.id} />
      const d = ronge ? ronge.map(chemin).join(' ') : chemin(pts)
      return (
        <g
          key={m.id}
          className={
            `mur n-${m.nature}` +
            (choisi === m.id ? ' on' : '') +
            (pourPiece?.includes(m.id) ? ' designe' : '')
          }
        >
          <path d={d} className="halo" />
          <path d={d} className="trait" />
          {choisi === m.id ? <path d={d} className="liseré" /> : null}
          {choisi === m.id && edition && outil === 'selection'
            ? pts.map((p, i) => (
                <rect key={i} x={p.x - 4.5} y={p.y - 4.5} width={9} height={9} className="poignee" />
              ))
            : null}
        </g>
      )
    })

  /**
   * Les ouvertures — le trou qu'elles percent, puis leur marque.
   *
   * Le trou est peint par-dessus le mur plutôt que retiré de son tracé : le
   * mur reste un trait entier, c'est ce qui permet à la pièce de se refermer
   * alors même qu'on passe par là.
   */
  const ouverturesSvg = (): JSX.Element[] =>
    ouvertures.map((o) => {
      const mur = murs.find((x) => x.id === o.murId)
      if (!mur) return <g key={o.id} />
      const b = bordsOuverture(mur, o)
      const a = enPx(b.a)
      const z = enPx(b.b)
      const ouverte = o.nature === 'porte' && o.ouverte && !o.verrouillee
      /* Une porte ouverte s'efface presque : c'est juste pendant l'essai, où
         l'on veut lire d'un coup d'œil par où le pion passe. En tracé, elle se
         montre **toujours fermée** — sans quoi on ne voit plus où elle est au
         moment même où l'on travaille dessus. Son état, lui, ne change pas. */
      const franchie = ouverte && !!essai
      const milieu = { x: (a.x + z.x) / 2, y: (a.y + z.y) / 2 }
      return (
        <g
          key={o.id}
          className={`ouv n-${o.nature}${franchie ? ' ouverte' : ''}${
            o.verrouillee ? ' verrouillee' : ''
          }${refus === o.id ? ' refus' : ''}${ouvChoisie === o.id ? ' on' : ''}`}
        >
          <path d={`M${a.x} ${a.y}L${z.x} ${z.y}`} className="trou" />
          <path d={`M${a.x} ${a.y}L${z.x} ${z.y}`} className="marque" data-ouv={o.id} />
          <title>
            {o.nature === 'vitre'
              ? 'Fenêtre — arrête le pas, laisse voir'
              : o.verrouillee
                ? 'Porte verrouillée — le MJ seul l’accorde (Maj + clic pendant l’essai)'
                : ouverte
                  ? franchie
                    ? 'Porte ouverte'
                    : 'Porte ouverte — montrée fermée le temps du tracé'
                  : 'Porte fermée'}
          </title>
          {o.verrouillee ? (
            <path
              className="verrou"
              d={`M${milieu.x - 4} ${milieu.y - 4}l8 8M${milieu.x + 4} ${milieu.y - 4}l-8 8`}
            />
          ) : null}
        </g>
      )
    })

  /**
   * Les lampes posées sur la carte.
   *
   * En tracé, on montre leurs deux cercles — sans quoi on règle un rayon à
   * l'aveugle. En visite, la pastille seule : le rond de clair, c'est ce que
   * le brouillard laisse voir, il n'a pas besoin d'un trait pour se dire.
   */
  const lumieresSvg = (): JSX.Element[] =>
    lumieres.map((l) => {
      const glissee = lumGlissee?.id === l.id ? lumGlissee : null
      const c = { x: glissee ? glissee.x : l.x * w, y: glissee ? glissee.y : l.y * h }
      return (
        <g
          key={l.id}
          className={`lum${l.allumee ? '' : ' eteinte'}${lumChoisie === l.id ? ' on' : ''}`}
          /* La teinte ne commande que l'allure : une lampe éteinte est grise,
             quelle que soit la couleur qu'on lui a donnée. */
          style={l.allumee ? ({ '--lum': l.teinte } as React.CSSProperties) : undefined}
        >
          {edition && !essai ? (
            <>
              <circle cx={c.x} cy={c.y} r={l.penombre * w} className="penombre" />
              <circle cx={c.x} cy={c.y} r={l.clair * w} className="clair" />
            </>
          ) : null}
          <circle cx={c.x} cy={c.y} r={9} className="pastille" data-lum={l.id} />
          <path
            className="rais"
            d={`M${c.x} ${c.y - 6.5}v-3M${c.x} ${c.y + 6.5}v3M${c.x - 6.5} ${c.y}h-3M${
              c.x + 6.5
            } ${c.y}h3`}
          />
          <circle cx={c.x} cy={c.y} r={3.4} className="meche" />
          <title>
            {l.allumee
              ? `Lumière allumée — clair ${(l.clair * 100).toFixed(0)} %, pénombre ${(
                  l.penombre * 100
                ).toFixed(0)} %`
              : 'Lumière éteinte'}
          </title>
        </g>
      )
    })

  /** Les pièces que les murs referment, et le nom de celles qui en ont un. */
  const formesSvg = (): JSX.Element[] =>
    formes.map((f, i) => {
      const nom = nomDeForme?.(f) ?? null
      const c = enPx(f.centre)
      return (
        <g
          key={i}
          className={`piece${nom ? '' : ' anonyme'}${formeVisee === i ? ' visee' : ''}`}
        >
          {/* Un polygone, pas un chemin : `polygone()` rend des `points`, et
              un `d` qui commence par un couple de nombres n'est pas dessiné —
              l'aplat de la pièce ne se peignait jamais. */}
          <polygon points={polygone(f.pts.map(enPx))} className="aplat" />
          {nom ? (
            <text x={c.x} y={c.y} className="nom">
              {nom}
            </text>
          ) : null}
        </g>
      )
    })

  /** Le trait en cours : on voit le mur avant de le poser. */
  const enCoursSvg = (): JSX.Element | null => {
    if (encours && encours.length)
      return (
        <g className={`encours n-${nature ?? 'mur'}`}>
          <path d={chemin(vise ? [...encours, vise] : encours)} className="apercu" />
          {encours.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={4} className="point" />
          ))}
        </g>
      )
    if (rect)
      return (
        <rect
          className="apercu-piece"
          x={Math.min(rect.a.x, rect.b.x)}
          y={Math.min(rect.a.y, rect.b.y)}
          width={Math.abs(rect.a.x - rect.b.x)}
          height={Math.abs(rect.a.y - rect.b.y)}
        />
      )
    return null
  }

  /* La loupe ne sert qu'à viser : elle accompagne le tracé, pas l'essai. */
  const loupeVisible = !!loupe && edition && !!outil && outilTrace(outil) && w > 0
  /** Le curseur est-il collé à un bout déjà posé ? La loupe le dit. */
  const colle = !!survol && !!vise && Math.hypot(vise.x - survol.x, vise.y - survol.y) > 0.01

  return (
    <div
      ref={hote}
      className={`murs-layer${edition ? ' edit' : ''}${essai ? ' essai' : ''}${
        attenteDepart ? ' depart' : ''
      }${
        edition && outil && (outilTrace(outil) || outilPerce(outil) || outilPose(outil))
          ? ' arme'
          : ''
      }${edition && outil === 'gomme' ? ' gomme' : ''}`}
      onPointerDown={edition || essai || attenteDepart ? surPointerDown : undefined}
      onPointerMove={edition || essai || attenteDepart ? surPointerMove : undefined}
      onPointerUp={edition || essai ? surPointerUp : undefined}
      onPointerLeave={() => setSurvol(null)}
      onDoubleClick={(e) => {
        if (!edition || !encours) return
        e.preventDefault()
        finirTrace()
      }}
      onContextMenu={(e) => {
        if (!edition || !encours) return
        e.preventDefault()
        finirTrace()
      }}
    >
      <svg width={w} height={h} viewBox={`0 0 ${Math.max(1, w)} ${Math.max(1, h)}`}>
        {/* Ce que le pion d'essai voit. On ne peint pas la lumière : on retire
            l'ombre de ce qu'il voit, et le reste de la carte reste dans le noir. */}
        {vision && vision.length > 2 ? (
          <>
            <defs>
              {/* Le masque de la lumière : blanc là où la lueur porte. Tout ce
                  qu'on veut croiser avec elle se peint à travers lui. */}
              <mask id={`lum-${masque}`}>
                {eclairages.map((rond, i) => (
                  <polygon key={i} points={polygone(rond)} fill="#fff" />
                ))}
              </mask>
              {/* Le regard seul : il sert à ne teinter que ce que le pion voit. */}
              <mask id={`regard-${masque}`}>
                <polygon points={polygone(vision)} fill="#fff" />
              </mask>
              <mask id={`vu-${masque}`}>
                <rect x="0" y="0" width={w} height={h} fill="#fff" />
                {sousLaLampe ? (
                  <>
                    {/* Vu = regard ∩ lumière : on retire l'ombre là où les
                        deux se superposent, et nulle part ailleurs. */}
                    <g mask={`url(#lum-${masque})`}>
                      <polygon points={polygone(vision)} fill="#000" />
                    </g>
                    {/* Ce qu'on a au bout des bras, lampe ou pas. */}
                    <circle
                      cx={essai!.x * w}
                      cy={essai!.y * h}
                      r={Math.max(14, Math.min(w, h) * 0.022)}
                      fill="#000"
                    />
                  </>
                ) : (
                  <polygon points={polygone(vision)} fill="#000" />
                )}
              </mask>
            </defs>
            <rect
              x="0"
              y="0"
              width={w}
              height={h}
              className="murs-ombre"
              mask={`url(#vu-${masque})`}
            />
            {/* Ce que le pion n'a jamais atteint : noir plein. On ne devine
                pas le plan d'une pièce où l'on n'est jamais entré. */}
            {inconnu ? (
              <>
                <defs>
                  <mask id={`noir-${masque}`}>
                    <path d={inconnu} fill="#fff" />
                    {sousLaLampe ? (
                      <g mask={`url(#lum-${masque})`}>
                        <polygon points={polygone(vision)} fill="#000" />
                      </g>
                    ) : (
                      <polygon points={polygone(vision)} fill="#000" />
                    )}
                  </mask>
                </defs>
                <rect
                  x="0"
                  y="0"
                  width={w}
                  height={h}
                  className="murs-noir"
                  mask={`url(#noir-${masque})`}
                />
              </>
            ) : null}
            {/* La couleur des lampes, mais seulement là où le pion voit :
                une lueur orange dans son dos ne le concerne pas. */}
            {sousLaLampe ? (
              <g mask={`url(#regard-${masque})`}>
                {teintes.map((t, i) => (
                  <polygon
                    key={`t${i}`}
                    points={polygone(t.rond)}
                    className="lueur-teinte"
                    fill={t.teinte}
                  />
                ))}
              </g>
            ) : null}
            {sousLaLampe ? (
              <g mask={`url(#lum-${masque})`}>
                <polygon points={polygone(vision)} className="murs-vu" />
              </g>
            ) : (
              <polygon points={polygone(vision)} className="murs-vu" />
            )}
          </>
        ) : null}

        {lumieresSvg()}
        {/* Ombre et lumière, sans personne au milieu : on ne montre pas un
            champ de vision, on montre ce que les lampes touchent. */}
        {ombreEtLumiere && lumieres.length ? (
          <>
            <defs>
              <mask id={`seul-${masque}`}>
                <rect x="0" y="0" width={w} height={h} fill="#fff" />
                {eclairages.map((rond, i) => (
                  <polygon key={i} points={polygone(rond)} fill="#000" />
                ))}
              </mask>
            </defs>
            <rect
              x="0"
              y="0"
              width={w}
              height={h}
              className="murs-ombre ombre-seule"
              mask={`url(#seul-${masque})`}
            />
            {/* La couleur de chaque lampe, posée sur ce qu'elle touche. */}
            {teintes.map((t, i) => (
              <polygon
                key={`t${i}`}
                points={polygone(t.rond)}
                className="lueur-teinte"
                fill={t.teinte}
              />
            ))}
            {/* Le bord de chaque lueur : on voit jusqu'où elle porte. */}
            {eclairages.map((rond, i) => (
              <polygon key={i} points={polygone(rond)} className="lueur-bord" />
            ))}
          </>
        ) : null}

        {formesSvg()}
        {/* Le contour que les murs désignés dessinent : il se ferme sous l'œil
            au fur et à mesure qu'on les choisit. */}
        {contourPropose && contourPropose.length > 2 ? (
          <polygon points={polygone(contourPropose.map(enPx))} className="piece-propose" />
        ) : null}
        {traits()}
        {ouverturesSvg()}
        {guidesSvg()}
        {apercuOuverture()}
        {/* La lampe qu'on s'apprête à poser : on voit son rond avant de le
            poser, sinon on découvre la portée après coup. */}
        {edition && outil === 'lumiere' && survol ? (
          <g className="lum apercu-lum">
            <circle cx={survol.x} cy={survol.y} r={LAMPE_NEUVE.penombre * w} className="penombre" />
            <circle cx={survol.x} cy={survol.y} r={LAMPE_NEUVE.clair * w} className="clair" />
            <circle cx={survol.x} cy={survol.y} r={9} className="pastille" />
            <circle cx={survol.x} cy={survol.y} r={3.4} className="meche" />
          </g>
        ) : null}
        {enCoursSvg()}

        {/* La gomme se voit : on sait ce qu'on va manger avant de l'avoir mangé. */}
        {edition && outil === 'gomme' && survol ? (
          <circle cx={survol.x} cy={survol.y} r={rayonGomme} className="murs-gomme" />
        ) : null}

        {/* On choisit le départ : la mire suit le curseur, et dit où
            la visite commencera. */}
        {attenteDepart && survol ? (
          <g className="murs-depart" pointerEvents="none">
            <circle cx={survol.x} cy={survol.y} r={11} />
            <path d={`M${survol.x - 6} ${survol.y}h12M${survol.x} ${survol.y - 6}v12`} />
          </g>
        ) : null}

        {essai ? <PionEssai essai={essai} w={w} h={h} /> : null}

        {/* La loupe, en dernier : elle passe par-dessus tout le reste. */}
        {loupeVisible && vise ? (
          <g className="loupe" pointerEvents="none">
            <defs>
              <clipPath id={`lp-${masque}`}>
                <circle cx={vise.x} cy={vise.y} r={R_LOUPE} />
              </clipPath>
            </defs>
            <g clipPath={`url(#lp-${masque})`}>
              <rect x="0" y="0" width={w} height={h} className="fond" />
              {/* Agrandi autour du curseur : le point visé ne bouge pas d'un
                  cheveu, c'est tout l'intérêt. */}
              <g
                transform={`translate(${vise.x} ${vise.y}) scale(${Z_LOUPE}) translate(${-vise.x} ${-vise.y})`}
              >
                {carte ? (
                  <image href={carte} x={0} y={0} width={w} height={h} preserveAspectRatio="none" />
                ) : null}
                <g className="fin">
                  {traits()}
                  {ouverturesSvg()}
                  {enCoursSvg()}
                </g>
              </g>
            </g>
            <circle cx={vise.x} cy={vise.y} r={R_LOUPE} className="anneau" />
            {/* La croix marque le point exact où le trait se posera. */}
            <path
              className="croix"
              d={`M${vise.x - 9} ${vise.y} h6 M${vise.x + 3} ${vise.y} h6 M${vise.x} ${
                vise.y - 9
              } v6 M${vise.x} ${vise.y + 3} v6`}
            />
            {colle ? <circle cx={vise.x} cy={vise.y} r={7} className="colle" /> : null}
          </g>
        ) : null}
      </svg>
    </div>
  )
}

/** Le pion d'essai : un jeton, et un nez qui dit où il regarde. */
function PionEssai({ essai, w, h }: { essai: EssaiPion; w: number; h: number }): JSX.Element {
  const x = essai.x * w
  const y = essai.y * h
  const a = ((essai.cap - 90) * Math.PI) / 180
  const bout = (r: number, d: number): string =>
    `${(x + Math.cos(a + d) * r).toFixed(1)},${(y + Math.sin(a + d) * r).toFixed(1)}`
  return (
    <g className="pion-essai">
      <polygon points={`${bout(28, 0)} ${bout(17, 0.46)} ${bout(17, -0.46)}`} className="nez" />
      <circle cx={x} cy={y} r={18} className="jeton" />
      <text x={x} y={y + 4} textAnchor="middle" className="ini">
        essai
      </text>
    </g>
  )
}

/* ============================================================
   Le volet : la légende, le trait choisi, ou l'essai
   ============================================================ */

export function VoletMurs({
  m,
  nomDeForme,
  onNommer,
  onEffacerPiece
}: {
  m: ReturnType<typeof useMurs>
  /** Le nom du lieu qui occupe cette forme, s'il en a un. */
  nomDeForme?: (f: Forme) => string | null
  /** Baptiser une forme : elle devient un lieu de cet étage. */
  onNommer?: (f: Forme, nom: string) => void
  /** Effacer le lieu qui occupe cette forme — le contour, lui, reste aux murs. */
  onEffacerPiece?: (f: Forme) => void
}): JSX.Element {
  const [renomme, setRenomme] = useState<number | null>(null)
  const compte = (n: NatureMur): number => m.liste.filter((x) => x.nature === n).length
  const trait = m.liste.find((x) => x.id === m.choisi) ?? null
  const ouv = m.ouvertures.find((x) => x.id === m.ouvChoisie) ?? null
  const lampe = m.lumieres.find((x) => x.id === m.lumChoisie) ?? null
  const allumees = m.lumieres.filter((l) => l.allumee).length
  const essai = m.essai
  const portes = m.ouvertures.filter((x) => x.nature === 'porte')
  const ouvertes = portes.filter((x) => x.ouverte && !x.verrouillee).length
  const verrouillees = portes.filter((x) => x.verrouillee).length
  const fermees = portes.length - ouvertes - verrouillees

  return (
    <>
      <div className="fl-bloc murs-garde">
        <span className="eyebrow">Jamais chez les joueurs</span>
        <p>
          Comme les repères, ce calque ne sort pas de la fiche et de la régie. Il sert à empêcher
          un pion de traverser et à calculer ce qu'il voit — pas à être montré.
        </p>
      </div>

      {m.attenteDepart ? (
        <div className="fl-bloc">
          <span className="eyebrow">Où commence la visite</span>
          <p className="texte">
            Clique sur la carte : le pion se posera là, portes closes et maison noire. C'est
            l'endroit par lequel on entre — le seuil, la grille du parc, le pied de l'escalier.
          </p>
        </div>
      ) : essai ? (
        <>
          <div className="fl-bloc">
            <span className="eyebrow">Essai</span>
            <p className="texte">
              Glisse le pion : il s'arrête sur un mur, passe à travers un rideau, et longe la
              cloison plutôt que de s'y coller. Clique une porte pour l'ouvrir ou la fermer.
            </p>
            <p className="texte">
              Ce qu'il n'a <b>jamais vu</b> reste noir ; ce qu'il a vu et ne regarde plus reste
              sombre. Promène-le, la carte se découvre. Et ouvrir une porte montre la pièce
              derrière, entière : on a vu ce qu'il y avait, on ne le regarde plus.
            </p>
            <p className={!m.lumGarde || (m.noir !== null && m.noir < 0.02) ? 'texte' : 'vide'}>
              {/* Sans mémoire, le compteur dirait « 100 % » en permanence : il
                  mesure ce qu'on retient, et l'on ne retient rien. */}
              {!m.lumGarde
                ? 'Rien ne se retient : hors de la lumière, la carte reste noire.'
                : m.noir === null
                  ? 'Le brouillard se règle au premier pas.'
                  : m.noir < 0.02
                    ? 'Plus rien de noir : le pion a tout vu d’où il est passé.'
                    : `${Math.round(m.noir * 100)} % de la carte n’a jamais été vue.`}
            </p>
            <div className="murs-rangee">
              <button
                className="btn btn-sm btn-ghost"
                title="Les portes se referment, la maison redevient noire, et tu redis par où l’on entre"
                onClick={() => void m.commencerEssai()}
              >
                Recommencer ailleurs
              </button>
            </div>
          </div>

          <div className="fl-bloc">
            <span className="eyebrow">Portes · {portes.length}</span>
            <p className="texte">
              {[
                ouvertes ? `${ouvertes} ouverte${ouvertes > 1 ? 's' : ''}` : '',
                fermees ? `${fermees} fermée${fermees > 1 ? 's' : ''}` : '',
                verrouillees ? `${verrouillees} verrouillée${verrouillees > 1 ? 's' : ''}` : ''
              ]
                .filter(Boolean)
                .join(', ') || 'Aucune porte sur cette carte.'}
              {portes.length ? ' — clique-la pour ouvrir ou refermer.' : ''}
            </p>
            {verrouillees ? (
              <p className="texte">
                Une porte verrouillée résiste : les joueurs ne l'ouvrent pas. Toi seul l'accordes —{' '}
                <b>Maj + clic</b> dessus, et elle cède.
              </p>
            ) : null}
          </div>

          <div className="fl-bloc">
            <span className="eyebrow">La lumière · {allumees} allumée{allumees > 1 ? 's' : ''}</span>
            <p className={m.lumieres.length ? 'texte' : 'vide'}>
              {m.lumieres.length
                ? 'Clique une lampe sur la carte pour la souffler ou la rallumer.'
                : 'Aucune lampe sur cette carte : le regard porte partout.'}
            </p>
            <GardeEclairee m={m} />
            <div className="murs-rangee">
              <button
                className={`btn btn-sm${essai.lampe > 0 ? ' btn-on' : ''}`}
                aria-pressed={essai.lampe > 0}
                title="Le pion porte sa propre lumière — torche, lanterne, téléphone : elle le suit"
                onClick={() => m.setEssai({ ...essai, lampe: essai.lampe > 0 ? 0 : TORCHE })}
              >
                <IconSoleil />
                {essai.lampe > 0 ? 'Il porte une lampe' : 'Lui donner une lampe'}
              </button>
            </div>
            {essai.lampe > 0 ? (
              <label className="murs-reglage">
                <span>Sa portée</span>
                <input
                  type="range"
                  min={3}
                  max={60}
                  step={0.5}
                  value={Math.round(essai.lampe * 1000) / 10}
                  onChange={(e) =>
                    m.setEssai({ ...essai, lampe: Number(e.target.value) / 100 })
                  }
                />
                <b className="num">{(essai.lampe * 100).toFixed(1)} %</b>
              </label>
            ) : null}
          </div>

          <div className="fl-bloc">
            <span className="eyebrow">Le regard</span>
            <p className="texte">
              Personne ne voit dans son dos. La molette tourne le pion — Maj pour affiner —, et son
              nez dit où il regarde.
            </p>
            <PorteeDuRegard m={m} />
            <div className="murs-rangee">
              {OUVERTURES.map((o) => (
                <button
                  key={o}
                  className="btn btn-sm"
                  aria-pressed={essai.ouverture === o}
                  onClick={() => m.setEssai({ ...essai, ouverture: o })}
                >
                  {o === 360 ? 'Tout autour' : `${o}°`}
                </button>
              ))}
            </div>
            <div className="murs-rangee">
              <button
                className="btn btn-sm"
                aria-pressed={essai.marche}
                title="Le pion tourne la tête dans le sens de sa marche"
                onClick={() => m.setEssai({ ...essai, marche: !essai.marche })}
              >
                <IconRotate />
                Se tourne en marchant
              </button>
              <span className="murs-cap">cap {Math.round(essai.cap)}°</span>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Ce qu'on vient de choisir passe devant : une lampe cliquée sur la
              carte doit ouvrir ses réglages sous les yeux, pas trois écrans
              plus bas. Le reste du volet ne bouge pas. */}
          {lampe ? (
            <div className="fl-bloc">
              <span className="eyebrow">Lumière</span>
              <p className="texte">
                Elle éclaire tout autour, jusqu'à ce qu'un mur l'arrête. Les joueurs ne découvrent
                que ce qui tombe à la fois dans leur regard et dans sa lueur.
              </p>
              <label className="murs-reglage">
                <span>Clair</span>
                <input
                  type="range"
                  min={1}
                  max={60}
                  step={0.5}
                  value={Math.round(lampe.clair * 1000) / 10}
                  onChange={(e) =>
                    void m.reglerLumiere(lampe.id, { clair: Number(e.target.value) / 100 })
                  }
                />
                <b className="num">{(lampe.clair * 100).toFixed(1)} %</b>
              </label>
              <label className="murs-reglage">
                <span>Pénombre</span>
                <input
                  type="range"
                  min={1}
                  max={80}
                  step={0.5}
                  value={Math.round(lampe.penombre * 1000) / 10}
                  onChange={(e) =>
                    void m.reglerLumiere(lampe.id, { penombre: Number(e.target.value) / 100 })
                  }
                />
                <b className="num">{(lampe.penombre * 100).toFixed(1)} %</b>
              </label>
              <div className="murs-teintes">
                {TEINTES_LUMIERE.map((t) => (
                  <button
                    key={t.cle}
                    className={`lteinte${lampe.teinte === t.cle ? ' on' : ''}`}
                    style={{ ['--t' as string]: t.cle } as React.CSSProperties}
                    aria-pressed={lampe.teinte === t.cle}
                    title={`${t.label} — la couleur ne change rien à ce qui est vu`}
                    onClick={() => void m.reglerLumiere(lampe.id, { teinte: t.cle })}
                  >
                    <i />
                    {t.label}
                  </button>
                ))}
                <label
                  className={`lteinte libre${
                    TEINTES_LUMIERE.some((t) => t.cle === lampe.teinte) ? '' : ' on'
                  }`}
                  style={{ ['--t' as string]: lampe.teinte } as React.CSSProperties}
                  title="Une couleur à toi"
                >
                  <i />
                  La tienne
                  <input
                    type="color"
                    value={lampe.teinte}
                    onChange={(e) => void m.reglerLumiere(lampe.id, { teinte: e.target.value })}
                  />
                </label>
              </div>
              <div className="murs-rangee">
                <button
                  className={`btn btn-sm${lampe.allumee ? ' btn-on' : ''}`}
                  aria-pressed={lampe.allumee}
                  title="On souffle une bougie en pleine partie : la pièce retombe dans le noir"
                  onClick={() => void m.reglerLumiere(lampe.id, { allumee: !lampe.allumee })}
                >
                  <IconSoleil />
                  {lampe.allumee ? 'Allumée' : 'Éteinte'}
                </button>
                <button
                  className="btn btn-sm"
                  title="Poser la même lampe à côté — mêmes rayons, même état"
                  onClick={() => void m.dupliquerLumiere(lampe.id)}
                >
                  <IconPlus />
                  Dupliquer
                </button>
                <button
                  className="btn btn-sm btn-ghost btn-danger"
                  title="Retirer cette lumière"
                  onClick={() => void m.oterLumiere(lampe.id)}
                >
                  <IconTrash />
                  Retirer
                </button>
              </div>
              <p className="aide" style={{ wordBreak: 'normal' }}>
                Glisse la pastille pour la déplacer · <b>Suppr</b> l'efface · la copie se pose à
                côté, déjà choisie.
              </p>
            </div>
          ) : null}

          {/* Les pièces ensuite : c'est ce qu'on vient chercher en traçant. */}
          <div className="fl-bloc">
            <span className="eyebrow">
              Pièces · {m.formes.length}
            </span>
            {m.formes.length ? (
              <div className="murs-pieces">
                {m.formes.map((f, i) => {
                  const nom = nomDeForme?.(f) ?? null
                  return (
                    <div
                      key={i}
                      className={
                        `pc${nom ? '' : ' anonyme'}` + (m.formeVisee === i ? ' visee' : '')
                      }
                    >
                      {renomme === i || !nom ? (
                        <>
                          {!nom ? (
                            <span className="sw" title="Un contour que tes murs referment" />
                          ) : null}
                        <NommerForme
                          forme={f}
                          valeur={nom ?? ''}
                          onNommer={onNommer}
                          onFini={() => setRenomme(null)}
                        />
                        </>
                      ) : (
                        <>
                          <button
                            className="pc-voir"
                            title="La montrer sur le plan"
                            onClick={() => m.setFormeVisee(m.formeVisee === i ? null : i)}
                            onDoubleClick={() => setRenomme(i)}
                          >
                            <span className="sw" />
                            <span className="nom">{nom}</span>
                            <span className="n">{Math.round(f.aire * 100)} %</span>
                          </button>
                          <button
                            className="pc-crayon"
                            title="Renommer cette pièce"
                            onClick={() => setRenomme(i)}
                          >
                            <IconPen />
                          </button>
                          <EffacerPiece forme={f} onEffacer={onEffacerPiece} />
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="vide">
                Aucun contour fermé pour l'instant. Trace des murs qui se rejoignent : ce qu'ils
                enferment devient une pièce.
              </p>
            )}
            <p className={m.lumieres.length ? 'texte' : 'vide'}>
              {m.lumieres.length
                ? `${m.lumieres.length} lumière${m.lumieres.length > 1 ? 's' : ''} sur cette carte, ${allumees} allumée${allumees > 1 ? 's' : ''} — hors d'elles, les joueurs ne verront rien.`
                : 'Aucune lumière : le regard porte partout, comme avant.'}
            </p>
            <GardeEclairee m={m} />
            <PorteeDuRegard m={m} />
            <div className="murs-cle">
              <span className="cl piece-nommee">
                <i />
                une pièce : un lieu de cet étage, avec sa fiche
              </span>
              <span className="cl piece-anonyme">
                <i />
                un contour que tes murs referment — nomme-le et il devient une pièce
              </span>
            </div>
            <p className="texte">Clique une ligne : la pièce se colorie sur le plan.</p>
          </div>

          <div className="fl-bloc">
            <span className="eyebrow">
              Traits · {m.liste.length}
              {m.ouvertures.length ? ` · ${m.ouvertures.length} ouvertures` : ''}
            </span>
            <div className="murs-legende">
              {(Object.keys(MUR_NATURES) as NatureMur[]).map((n) => (
                <div key={n} className={`lg n-${n}`}>
                  <span className="sw" />
                  <span className="nom">
                    {MUR_NATURES[n].label}
                    <span className="quoi">{MUR_NATURES[n].quoi}</span>
                  </span>
                  <span className="n">{compte(n)}</span>
                </div>
              ))}
            </div>
          </div>

          {m.outil === 'gomme' ? (
            <div className="fl-bloc">
              <span className="eyebrow">Gomme · {Math.round(m.gomme)} px</span>
              <p className="texte">
                Glisse sur la carte : ce qui passe dessous s'en va, et le trait entamé reste en
                morceaux de part et d'autre. La molette change sa taille. Un coup de gomme, si
                long soit-il, se défait d'un seul « Défaire ».
              </p>
              <div className="murs-rangee">
                {[12, 22, 40, 64].map((r) => (
                  <button
                    key={r}
                    className="btn btn-sm"
                    aria-pressed={Math.round(m.gomme) === r}
                    onClick={() => m.setGomme(r)}
                  >
                    {r} px
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {ouv ? (
            <div className="fl-bloc">
              <span className="eyebrow">{OUVERTURE_NATURES[ouv.nature].label}</span>
              <p className="texte">
                Posée sur un mur : elle en prend la direction, tu n'as pas à l'aligner.
              </p>
              <label className="murs-reglage">
                <span>Largeur</span>
                <input
                  type="range"
                  min={1}
                  max={30}
                  step={0.5}
                  value={Math.round(ouv.largeur * 1000) / 10}
                  onChange={(e) =>
                    void m.reglerOuverture(ouv.id, { largeur: Number(e.target.value) / 100 })
                  }
                />
                <b className="num">{(ouv.largeur * 100).toFixed(1)} %</b>
              </label>
              <LargeurDefaut m={m} largeur={ouv.largeur} />
              <label className="murs-reglage">
                <span>Place sur le mur</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={0.5}
                  value={Math.round(ouv.d * 1000) / 10}
                  onChange={(e) =>
                    void m.reglerOuverture(ouv.id, { d: Number(e.target.value) / 100 })
                  }
                />
                <b className="num">{Math.round(ouv.d * 100)} %</b>
              </label>
              {ouv.nature === 'porte' ? (
                <div className="murs-rangee">
                  <button
                    className="btn btn-sm"
                    aria-pressed={ouv.ouverte}
                    disabled={ouv.verrouillee}
                    title={
                      ouv.verrouillee
                        ? 'Déverrouille-la d’abord : une porte à clé ne s’ouvre pas'
                        : 'Ouvrir ou refermer cette porte'
                    }
                    onClick={() => void m.basculerPorte(ouv.id)}
                  >
                    {ouv.ouverte ? 'Ouverte' : 'Fermée'}
                  </button>
                  <button
                    className="btn btn-sm"
                    aria-pressed={ouv.verrouillee}
                    title="Les joueurs ne l’ouvrent pas ; toi seul l’accordes"
                    onClick={() => void m.verrouiller(ouv.id, !ouv.verrouillee)}
                  >
                    <IconVerrou />
                    Verrouillée
                  </button>
                </div>
              ) : null}
              <div className="murs-rangee">
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => void m.oterOuverture(ouv.id)}
                >
                  <IconTrash />
                  Ôter cette ouverture
                </button>
              </div>
            </div>
          ) : (
            <div className="fl-bloc">
              <span className="eyebrow">Le trait choisi</span>
              {trait ? (
                <>
                  <p className="texte">
                    {MUR_NATURES[trait.nature].label} — {trait.pts.length} points,{' '}
                    {trait.pts.length - 1} segment{trait.pts.length > 2 ? 's' : ''},{' '}
                    {m.ouvertures.filter((o) => o.murId === trait.id).length} ouverture(s) dessus.
                  </p>
                  <div className="murs-rangee">
                    {(Object.keys(MUR_NATURES) as NatureMur[]).map((n) => (
                      <button
                        key={n}
                        className={`murs-nat n-${n}`}
                        aria-pressed={trait.nature === n}
                        onClick={() => void m.changerNature(trait.id, n)}
                      >
                        <i />
                        {MUR_NATURES[n].label}
                      </button>
                    ))}
                  </div>
                  <div className="murs-rangee">
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => void m.effacer(trait.id)}
                    >
                      <IconTrash />
                      Effacer ce trait
                    </button>
                  </div>
                </>
              ) : (
                <p className="vide">
                  {m.outil === 'selection'
                    ? 'Clique un trait ou une ouverture sur la carte. Recliquer un trait le coupe en deux ; Suppr l’efface en entier.'
                    : m.liste.length
                      ? 'Passe en « Sélection » et clique un trait sur la carte.'
                      : 'Arme « + Mur » et clique sur la carte pour poser le premier point.'}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </>
  )
}

/**
 * La règle d'éclairage de la carte : ce qu'une zone éclairée laisse derrière.
 *
 * Elle vaut pour tout le plan et pour toutes ses lampes — y compris celle que
 * le pion porte. Ce n'est pas un réglage de bougie, c'est une façon de jouer :
 * la maison se dessine à mesure, ou elle se referme derrière soi.
 */
function PorteeDuRegard({ m }: { m: ReturnType<typeof useMurs> }): JSX.Element {
  const sans = m.regardPortee === null
  return (
    <>
      <label className="murs-reglage">
        <span>Portée du regard</span>
        <input
          type="range"
          min={2}
          /* Au-delà de la largeur de la carte : un plan large reste plus haut
             que large en diagonale, et 100 % bornait encore le regard. On va
             donc jusqu'à une carte et demie — après quoi « sans limite » dit
             la même chose, plus simplement. */
          max={150}
          step={1}
          value={Math.round((m.regardPortee ?? 1) * 100)}
          onChange={(e) => void m.reglerRegardPortee(Number(e.target.value) / 100)}
        />
        <b className="num">{sans ? '∞' : `${Math.round((m.regardPortee ?? 0) * 100)} %`}</b>
      </label>
      <div className="murs-rangee">
        <button
          className={`btn btn-sm${sans ? ' btn-on' : ' btn-ghost'}`}
          title="Le regard ne s'arrête qu'aux murs, comme avant"
          onClick={() => void m.reglerRegardPortee(sans ? 0.35 : null)}
        >
          {sans ? 'Sans limite' : 'Retirer la limite'}
        </button>
        <span className="murs-cap">
          {sans
            ? 'on voit jusqu’au mur'
            : (m.regardPortee ?? 0) >= 1
              ? 'plus large que la carte — la portée ne borne presque plus rien'
              : 'au-delà, c’est trop loin pour distinguer quoi que ce soit'}
        </span>
      </div>
    </>
  )
}

function GardeEclairee({ m }: { m: ReturnType<typeof useMurs> }): JSX.Element {
  return (
    <>
      <label
        className="coche murs-coche"
        title={
          m.lumGarde
            ? 'Ce que la lumière a montré reste sur la carte, même quand on ne le voit plus'
            : 'Ce que la lumière montre retombe au noir complet dès qu’on ne le voit plus'
        }
      >
        <input
          type="checkbox"
          checked={m.lumGarde}
          onChange={(e) => void m.reglerLumGarde(e.target.checked)}
        />
        <span>Laisser une zone éclairée découverte</span>
      </label>
      <p className="aide" style={{ wordBreak: 'normal' }}>
        {m.lumGarde
          ? 'Vue une fois, une zone éclairée reste sur la carte : la maison se dessine à mesure.'
          : 'Hors de la lumière, tout retombe au noir complet : la maison se referme derrière le groupe.'}
      </p>
    </>
  )
}

/**
 * Le bouton qui fait de cette largeur celle des prochaines ouvertures.
 *
 * Sur une même carte, les portes se ressemblent : on règle la première à la
 * main, on pose le réglage, et les suivantes naissent déjà à la bonne taille.
 * Le réglage vit sur le lieu — il survit à la fermeture — et ne retouche rien
 * de ce qui est déjà posé.
 */
function LargeurDefaut({
  m,
  largeur
}: {
  m: ReturnType<typeof useMurs>
  largeur: number
}): JSX.Element {
  /* « La même » à un dixième de pourcent près : le curseur avance par demis. */
  const estLaMienne =
    m.largeurDefaut !== null && Math.abs(m.largeurDefaut - largeur) < 0.0005
  /* La largeur d'usine se règle dans les paramètres : on la dit telle qu'elle
     est, plutôt que de promettre « 5 % » à quelqu'un qui a posé autre chose. */
  const usine = useStore((st) => st.reglages.mursLargeur)
  return (
    <div className="murs-defaut">
      <button
        className={`btn btn-sm${estLaMienne ? ' btn-on' : ' btn-ghost'}`}
        title={
          estLaMienne
            ? 'Les prochaines ouvertures de cette carte naissent à cette largeur — clique pour ne plus la retenir'
            : 'Les prochaines portes, fenêtres et rideaux de cette carte naîtront à cette largeur'
        }
        onClick={() => void m.reglerLargeurDefaut(estLaMienne ? null : largeur)}
      >
        <IconCheck />
        {estLaMienne ? 'Largeur retenue ici' : 'En faire la largeur par défaut'}
      </button>
      <span className="murs-cap">
        {m.largeurDefaut === null
          ? `Sinon, ${(usine * 100).toFixed(1)} % — la largeur d’usine.`
          : `Les prochaines : ${(m.largeurDefaut * 100).toFixed(1)} %`}
      </span>
    </div>
  )
}

/**
 * Effacer la pièce — le lieu, pas les murs.
 *
 * Une croix qui efface d'un clic est une croix qu'on regrette : celle-ci
 * s'arme d'abord et le dit, puis se désarme toute seule si l'on passe son
 * chemin. Les murs, eux, restent : c'est le lieu qui s'en va, pas le plan.
 */
function EffacerPiece({
  forme,
  onEffacer
}: {
  forme: Forme
  onEffacer?: (f: Forme) => void
}): JSX.Element {
  const [arme, setArme] = useState(false)
  return (
    <button
      className={`pc-effacer${arme ? ' arme' : ''}`}
      title={arme ? 'Vraiment effacer cette pièce ?' : 'Effacer cette pièce — les murs restent'}
      onClick={() => {
        if (!arme) {
          setArme(true)
          window.setTimeout(() => setArme(false), 3000)
          return
        }
        setArme(false)
        onEffacer?.(forme)
      }}
    >
      {arme ? <IconCheck /> : <IconTrash />}
    </button>
  )
}

/**
 * Le champ qui baptise une forme fermée — ou qui la rebaptise.
 *
 * Tant qu'elle n'a pas de nom, ce n'est qu'un contour ; dès qu'elle en a un,
 * c'est un lieu de l'étage, avec sa fiche et ses documents. **Renommer ne
 * détruit rien** : c'est le même lieu qui change d'étiquette, il garde sa
 * fiche, ses documents et ses pions.
 */
function NommerForme({
  forme,
  valeur = '',
  onNommer,
  onFini
}: {
  forme: Forme
  /** Le nom actuel, quand on renomme ; vide, quand on baptise. */
  valeur?: string
  onNommer?: (f: Forme, nom: string) => void
  onFini?: () => void
}): JSX.Element {
  const [v, setV] = useState(valeur)
  const champ = useRef<HTMLInputElement>(null)

  /* On renomme : le nom en place est choisi, on tape par-dessus sans effacer. */
  useEffect(() => {
    if (!valeur) return
    champ.current?.focus()
    champ.current?.select()
  }, [valeur])

  const valider = (): void => {
    const nom = v.trim()
    if (!nom) return onFini?.()
    setV(valeur ? nom : '')
    onNommer?.(forme, nom)
    onFini?.()
  }

  return (
    <input
      ref={champ}
      className="pc-nommer"
      type="text"
      value={v}
      placeholder="Nommer cette pièce…"
      onChange={(e) => setV(e.target.value)}
      onBlur={() => onFini?.()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') valider()
        else if (e.key === 'Escape') {
          setV(valeur)
          onFini?.()
        }
      }}
    />
  )
}

/** L'aide du bas de carte : ce que fait le geste en cours. */
export function AideMurs({ m }: { m: ReturnType<typeof useMurs> }): JSX.Element {
  if (m.attenteDepart)
    return (
      <span className="note">
        Clique sur la carte : <b>la visite commencera là</b>, portes closes et maison noire.
      </span>
    )
  if (m.essai)
    return (
      <span className="note">
        Glisse le pion — il ne traverse pas. Molette : il tourne la tête. Clique une porte pour
        l'ouvrir.
      </span>
    )
  if (m.outil === 'gomme')
    return (
      <span className="note">
        Glisse sur la carte : ce qui passe sous la gomme s'efface. La molette change sa taille.
      </span>
    )
  if (m.outil === 'porte' || m.outil === 'vitre')
    return (
      <span className="note">
        Clique sur un mur : {m.outil === 'porte' ? 'la porte' : 'la fenêtre'} s'y pose, alignée sur
        lui. Sa largeur et sa place se règlent à droite.
      </span>
    )
  if (m.outil === 'selection')
    return (
      <span className="note">
        Clique un trait ou une ouverture — puis tire ses poignées, change sa nature, ou{' '}
        <b>Suppr</b>.
      </span>
    )
  if (m.outil === 'lumiere')
    return (
      <span className="note">
        {m.apercuLum ? (
          <>
            Ombre et lumière : ce qui reste noir ici restera noir pour les joueurs, quoi qu'ils
            regardent. Glisse une lampe ou tire ses rayons, le noir recule.
          </>
        ) : (
          <>
            Clique où la lampe se tient : elle éclaire tout autour jusqu'aux murs. Les joueurs ne
            verront que ce qui est <b>à la fois</b> dans leur regard et dans sa lueur.
          </>
        )}
      </span>
    )
  return (
    <span className="note">
      Clique pour poser le premier point, puis suis la cloison. <b>Double-clic, Entrée ou Échap</b>{' '}
      pour finir le trait. Un contour qui se referme devient une pièce.
    </span>
  )
}
