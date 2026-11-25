/**
 * Les outils de chasse pendant la partie : où est chaque appareil, ce qu'il
 * lit, et à quel volume le PC le fait entendre.
 *
 * Un appareil, c'est un exemplaire d'objet rattaché à un outil (`Objet.outil`)
 * qui est en main (`port = 'pj'`) ou posé dans un lieu (`port = 'lieu'`). En
 * main, il suit le pion de son porteur ; posé, il reste où on l'a laissé et
 * continue de mesurer. On calcule **tous les lieux**, pas seulement celui à
 * l'écran : un EMF resté au rez-de-chaussée s'entend des pions qui y sont,
 * même quand la table regarde la cave.
 *
 * La valeur vient des calques peints dans l'atelier (`Construction.emf`,
 * `.temperature`), sauf quand le MJ a pris le contrôle d'un appareil : ce
 * contrôle vit ici, en mémoire, comme la régie du son — rien n'a à survivre à
 * la soirée. Les calques, eux, ne sortent jamais d'ici vers les joueurs : la
 * table ne reçoit que la valeur lue par les appareils posés.
 */
import * as display from './display'
import * as mobile from './mobile'
import { getDb } from './db'
import { donner, exemplairesOutils, situer } from './db/repos/objets'
import { pionsPartout } from './db/repos/pions'
import { listMurs } from './db/repos/murs'
import { listOuvertures } from './db/repos/ouvertures'
import { getConstruction } from './db/repos/construction'
import { echelleDe, planDe } from './db/repos/echelle'
import { barrieres, RAYON_PION, seCroisent, type Barriere, type Pt } from '@shared/murs'
import {
  LARGEUR_PLAN_DEFAUT_M,
  PORTEE_LECTURE_M,
  TEMPERATURE_MAX,
  TEMPERATURE_MIN,
  gainSon,
  niveauEmfSous,
  pionSurPlan,
  temperatureSous,
  type AppareilChasse,
  type AppareilPose,
  type OutilTelephone
} from '@shared/chasse'
import type { Construction, PointCase } from '@shared/atelier'
import type { Pion, PointMur } from '@shared/types'

/** Les appareils dont le MJ a pris le contrôle, et la valeur qu'il leur impose. */
const controles = new Map<number, number>()
/**
 * Ce qu'on a envoyé la dernière fois : au MJ (tout, positions comprises), et
 * ce que voient la table et les téléphones (valeur, où, allumé). On ne
 * renvoie que ce qui change — un pion qui marche, EMF en main, au-dessus d'un
 * même niveau ne doit rien rediffuser aux joueurs.
 */
let dernierMj = '[]'
let dernierVu = '[]'
/** Le dernier calcul : les téléphones le relisent à chaque diffusion sans tout refaire. */
let dernier: Calcul | null = null

/** Tout ce qu'il faut savoir d'un plan pour y situer, lire et entendre un appareil. */
export interface Plan {
  w: number
  h: number
  /** Ce qui arrête le pas — et donc le son, en partie. En pixels du plan. */
  murs: Barriere[]
  construction: Construction | null
  /** La largeur du plan, en mètres. */
  metres: number
}

function lirePlan(plan: number): Plan {
  const { w, h } = mobile.repereDuPlan(plan)
  const enPx = (q: PointMur): Pt => ({ x: q[0] * w, y: q[1] * h })
  return {
    w,
    h,
    murs: barrieres(listMurs(plan), 'pas', enPx, listOuvertures(plan)),
    construction: getConstruction(plan),
    metres: echelleDe(plan).metres ?? LARGEUR_PLAN_DEFAUT_M
  }
}

/** Les plans lus pendant un calcul : chacun une seule fois, quel que soit le nombre d'appareils. */
function plans(): (placeId: number) => Plan {
  const lus = new Map<number, Plan>()
  return (placeId) => {
    const plan = planDe(placeId)
    let p = lus.get(plan)
    if (!p) lus.set(plan, (p = lirePlan(plan)))
    return p
  }
}

const borne = (v: number): number => Math.min(1, Math.max(0, v))

/** Où est le pion, en fractions du plan — hors de [0, 1] s'il se tient dans une bande de l'écran. */
function ouEstLePion(p: Pion, g: Plan): { x: number; y: number } {
  return pionSurPlan(p, g.w / g.h, display.ratioEcran())
}

/**
 * Où est l'appareil qu'il tient. Un pion dans une bande est hors de la carte :
 * on ramène l'appareil au bord, il ne lit pas dans le vide. L'oreille, elle,
 * reste où est le pion.
 */
function appareilEnMain(p: Pion, g: Plan): { x: number; y: number } {
  const q = ouEstLePion(p, g)
  return { x: borne(q.x), y: borne(q.y) }
}

/** Distance en mètres et murs traversés entre deux points du plan (en fractions). */
function trajet(a: { x: number; y: number }, b: { x: number; y: number }, g: Plan): { m: number; murs: number } {
  const pa = { x: a.x * g.w, y: a.y * g.h }
  const pb = { x: b.x * g.w, y: b.y * g.h }
  let murs = 0
  for (const m of g.murs) if (seCroisent(pa, pb, m.a, m.b)) murs++
  return { m: (Math.hypot(pb.x - pa.x, pb.y - pa.y) / g.w) * g.metres, murs }
}

const joueur = (p: Pion): boolean => p.characterId != null && !p.pnj

/**
 * Ce qu'il faut pour situer les pions et lire les plans, lu une fois et
 * partagé : `lisiblePar`, appelé pour chaque téléphone et chaque appareil, ne
 * doit pas relire la base à chaque appel.
 */
export interface ContexteChasse {
  pions: Pion[]
  plan: (placeId: number) => Plan
}

export function contexte(): ContexteChasse {
  return { pions: pionsPartout(), plan: plans() }
}

interface Calcul {
  appareils: AppareilChasse[]
  /** Les exemplaires posés et trouvés : seuls ceux-là peuvent se montrer à la table. */
  trouves: Set<number>
}

function calculer(): Calcul {
  const exemplaires = exemplairesOutils()
  /* Une séance sans outil ne coûte rien : ni pions, ni plans à lire. */
  if (exemplaires.length === 0) {
    controles.clear()
    return (dernier = { appareils: [], trouves: new Set() })
  }
  const { pions, plan } = contexte()
  const affiche = display.getState().placeId
  const out: AppareilChasse[] = []
  const trouves = new Set<number>()
  for (const ex of exemplaires) {
    let ou: AppareilChasse['ou'] = 'ailleurs'
    let placeId: number | null = null
    let pos: AppareilChasse['pos'] = null
    if (ex.port === 'pj') {
      /* En main : le pion de son porteur, celui du lieu à l'écran d'abord. */
      const siens = pions.filter((p) => p.characterId === ex.characterId)
      const p = siens.find((q) => q.placeId === affiche) ?? siens[0]
      if (p) {
        ou = 'main'
        placeId = p.placeId
        pos = appareilEnMain(p, plan(p.placeId))
      }
    } else {
      placeId = ex.placeId
      if (ex.pos && ex.placeId != null) {
        ou = 'lieu'
        pos = ex.pos
        if (ex.trouve) trouves.add(ex.placementId)
      }
    }
    const g = placeId != null ? plan(placeId) : null
    const c = g?.construction ?? null
    const sous: PointCase | null = c && pos ? [pos.x * c.largeur, pos.y * c.hauteur] : null
    const controle = controles.get(ex.placementId)
    const valeur = controle ?? (ex.outil === 'emf' ? niveauEmfSous(c, sous) : temperatureSous(c, sous))
    const allume = !ex.eteinte

    /* Le son : seul l'EMF en a, et seulement s'il marche et capte quelque chose. */
    let gain = 0
    if (ex.outil === 'emf' && allume && valeur >= 0.5 && ou !== 'ailleurs') {
      if (ou === 'main') gain = 1
      else if (g && pos && placeId != null) {
        const ici = planDe(placeId)
        for (const p of pions) {
          if (!joueur(p) || planDe(p.placeId) !== ici) continue
          const t = trajet(pos, ouEstLePion(p, g), g)
          gain = Math.max(gain, gainSon(t.m, t.murs))
        }
      }
    }

    out.push({
      placementId: ex.placementId,
      objetId: ex.objetId,
      nom: ex.nom,
      outil: ex.outil,
      ou,
      placeId,
      pos,
      /* Posé : celui qui l'a posé depuis son téléphone (le dépôt ne le rend
         que pour un exemplaire dans un lieu). */
      characterId: ex.port === 'pj' ? ex.characterId : ex.posePar,
      allume,
      valeur,
      controle: controle !== undefined,
      gain
    })
  }
  /* Ce qui n'est plus un appareil — supprimé, plus un outil, jeté, rangé —
     perd le contrôle du MJ : il ne le retrouvera pas en revenant. */
  for (const id of controles.keys()) if (!out.some((a) => a.placementId === id)) controles.delete(id)
  return (dernier = { appareils: out, trouves })
}

/** Tous les appareils, en main ou posés, avec ce qu'ils lisent en ce moment. */
export function appareils(): AppareilChasse[] {
  return calculer().appareils
}

/** Ce que les joueurs peuvent en percevoir : ni position, ni gain — ceux-là ne regardent que le MJ. */
const vuDesJoueurs = (a: AppareilChasse[], trouves: Set<number>): string =>
  JSON.stringify(
    a.map((x) => [x.placementId, x.ou, x.placeId, x.characterId, x.valeur, x.allume, trouves.has(x.placementId)])
  )

/**
 * Recalculer, et prévenir qui doit l'être — seulement ce qui a changé.
 *
 * Le MJ reçoit `chasse:state` dès que quoi que ce soit bouge. La table et les
 * téléphones ne sont rediffusés que si ce qu'ils voient a changé, et alors
 * une seule fois : `display.broadcast` prévient aussi les téléphones.
 * `diffuser = false` quand l'appelant diffuse juste après (un pas de pion,
 * une porte, un objet donné) : l'état de la table est mis à jour sans partir.
 */
export function recalculer(diffuser = true): void {
  const { appareils: a, trouves } = calculer()
  const mj = JSON.stringify(a)
  if (mj !== dernierMj) {
    dernierMj = mj
    display.versMj('chasse:state', a)
  }
  const vu = vuDesJoueurs(a, trouves)
  if (vu === dernierVu) return
  dernierVu = vu
  /* La table ne reçoit, des appareils posés, que ceux qui sont trouvés (comme `objetsVus`). */
  display.chasseABouge(
    a.filter((x) => x.ou !== 'lieu' || trouves.has(x.placementId)),
    diffuser
  )
}

/**
 * Le MJ prend la main sur un appareil — `null` la lui rend, et l'appareil
 * relit sa zone. La valeur est bornée à ce que l'appareil sait afficher.
 */
export function controler(placementId: number, valeur: number | null): AppareilChasse[] {
  const a = appareils().find((x) => x.placementId === placementId)
  if (a && valeur !== null && Number.isFinite(valeur)) {
    const [min, max] = a.outil === 'emf' ? [0, 5] : [TEMPERATURE_MIN, TEMPERATURE_MAX]
    controles.set(placementId, Math.min(max, Math.max(min, valeur)))
  } else if (valeur === null) controles.delete(placementId)
  recalculer()
  return appareils()
}

/**
 * Le joueur peut-il lire cet appareil ? Le sien, en main, toujours ; un autre
 * seulement si son pion est sur le même plan, assez près, sans mur entre eux
 * — pas de lecture à distance dans le noir. Pour plusieurs appels de suite,
 * passer un même `contexte()`.
 */
export function lisiblePar(
  a: AppareilChasse,
  characterId: number,
  ctx: ContexteChasse = contexte()
): boolean {
  if (a.ou === 'main' && a.characterId === characterId) return true
  if (a.ou === 'ailleurs' || a.placeId == null || !a.pos) return false
  const ici = planDe(a.placeId)
  const g = ctx.plan(a.placeId)
  return ctx.pions.some((p) => {
    if (p.characterId !== characterId || planDe(p.placeId) !== ici) return false
    const t = trajet(a.pos!, ouEstLePion(p, g), g)
    return t.m <= PORTEE_LECTURE_M && t.murs === 0
  })
}

/**
 * Ce que les téléphones affichent des appareils, pour une diffusion : à créer
 * **une fois** puis à appeler pour chaque téléphone. Sans outil dans la séance,
 * ça ne coûte qu'une requête ; sinon on reprend le dernier calcul du moteur et
 * on ne lit les pions et les plans que si un appareil posé est à juger.
 */
export function lecteurTelephones(): (
  characterId: number | null,
  placeId: number | null
) => { outils: OutilTelephone[]; appareilsPoses: AppareilPose[] } {
  if (exemplairesOutils().length === 0) return () => ({ outils: [], appareilsPoses: [] })
  const { appareils: tous, trouves } = dernier ?? calculer()
  let ctx: ContexteChasse | null = null
  return (characterId, placeId) => {
    const outils: OutilTelephone[] = []
    if (characterId != null) {
      for (const a of tous) {
        /* En main, ou posé par lui (`characterId` vaut alors `posePar`). */
        if (a.characterId !== characterId) continue
        /* Porté mais sans pion (le MJ ne l'a pas encore posé) : il a l'appareil, il ne lit rien. */
        const ou = a.ou === 'lieu' ? 'lieu' : 'main'
        let valeur: number | null = a.ou === 'ailleurs' ? null : a.valeur
        if (a.ou === 'lieu') valeur = lisiblePar(a, characterId, (ctx ??= contexte())) ? a.valeur : null
        outils.push({
          placementId: a.placementId,
          nom: a.nom,
          outil: a.outil,
          ou,
          allume: a.allume,
          valeur
        })
      }
    }
    const appareilsPoses: AppareilPose[] =
      placeId == null
        ? []
        : tous
            .filter(
              (a) =>
                a.ou === 'lieu' &&
                a.placeId != null &&
                trouves.has(a.placementId) &&
                (a.placeId === placeId || planDe(a.placeId) === placeId)
            )
            .map((a) => ({ placementId: a.placementId, outil: a.outil, valeur: a.valeur, allume: a.allume }))
    return { outils, appareilsPoses }
  }
}

/** Le pion du personnage : celui du lieu à l'écran d'abord, comme pour l'appareil qu'il tient. */
function pionDe(characterId: number, pions: Pion[]): Pion | undefined {
  const siens = pions.filter((p) => p.characterId === characterId)
  const affiche = display.getState().placeId
  return siens.find((q) => q.placeId === affiche) ?? siens[0]
}

/**
 * Le joueur pose un de ses appareils sous son pion. Un seul, même d'une pile.
 * `null` : fait ; sinon la raison du refus, à lui montrer.
 */
export function poserOutil(characterId: number, placementId: number): string | null {
  const ex = exemplairesOutils().find((e) => e.placementId === placementId)
  if (!ex || ex.port !== 'pj' || ex.characterId !== characterId) return 'Cet appareil n’est pas à toi.'
  const { pions, plan } = contexte()
  const p = pionDe(characterId, pions)
  if (!p) return 'Ton pion n’est sur aucun lieu.'
  const q = appareilEnMain(p, plan(p.placeId))
  const avant = new Set(exemplairesOutils().map((e) => e.placementId))
  /* Tout ou rien : si la part posée est introuvable, l'appareil reste dans ses mains. */
  getDb().transaction(() => {
    donner(placementId, { port: 'lieu', placeId: p.placeId }, 1, characterId)
    /* Une pile se détache : la part posée est une nouvelle ligne. */
    const pose = exemplairesOutils().find(
      (e) => e.port === 'lieu' && e.posePar === characterId && (e.placementId === placementId || !avant.has(e.placementId))
    )
    if (!pose) throw new Error('pose introuvable')
    /* Un geste de jeu, pas de préparation : le lieu d'origine du MJ ne bouge pas. */
    situer(pose.placementId, q, undefined, true)
  })()
  return null
}

/**
 * Le joueur ramasse un appareil posé : son pion doit être sur le même plan,
 * tout près, sans mur entre eux. Deux joueurs qui tendent la main en même
 * temps : le premier l'a, le second apprend qu'il n'y est plus.
 */
export function ramasserOutil(characterId: number, placementId: number): string | null {
  const ex = exemplairesOutils().find((e) => e.placementId === placementId)
  if (!ex || ex.port !== 'lieu' || !ex.trouve) return 'Quelqu’un l’a déjà ramassé.'
  if (ex.placeId == null || !ex.pos) return 'Quelqu’un l’a déjà ramassé.'
  const { pions, plan } = contexte()
  const ici = planDe(ex.placeId)
  const p = pions.find((q) => q.characterId === characterId && planDe(q.placeId) === ici)
  if (!p) return 'Ton pion n’est pas dans ce lieu.'
  const g = plan(ex.placeId)
  const pion = ouEstLePion(p, g)
  const pa = { x: pion.x * g.w, y: pion.y * g.h }
  const pb = { x: ex.pos.x * g.w, y: ex.pos.y * g.h }
  if (Math.hypot(pb.x - pa.x, pb.y - pa.y) > 3 * RAYON_PION * Math.max(g.w, g.h))
    return 'Tu es trop loin pour le ramasser.'
  if (g.murs.some((m) => seCroisent(pa, pb, m.a, m.b))) return 'Un mur te sépare de cet appareil.'
  donner(placementId, { port: 'pj', characterId })
  return null
}

/** Une campagne qu'on ferme emporte ses contrôles : les numéros d'exemplaire ne valent que pour elle. */
export function oublier(): void {
  controles.clear()
  dernierMj = '[]'
  dernierVu = '[]'
  dernier = null
}

export function brancher(): void {
  /* Comme pour les sons : une erreur ici ne doit pas empêcher les pions de
     bouger. Pas de diffusion : `refreshPions` diffuse juste après. */
  display.ecouterPions(() => {
    try {
      recalculer(false)
    } catch (e) {
      console.error('[chasse]', e)
    }
  })
}
