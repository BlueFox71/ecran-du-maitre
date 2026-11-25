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
import { listObjets } from './db/repos/objets'
import { pionsPartout } from './db/repos/pions'
import { listMurs } from './db/repos/murs'
import { listOuvertures } from './db/repos/ouvertures'
import { getConstruction } from './db/repos/construction'
import { echelleDe, planDe } from './db/repos/echelle'
import { barrieres, seCroisent, type Barriere, type Pt } from '@shared/murs'
import {
  LARGEUR_PLAN_DEFAUT_M,
  PORTEE_LECTURE_M,
  TEMPERATURE_MAX,
  TEMPERATURE_MIN,
  gainSon,
  niveauEmfSous,
  pionSurPlan,
  temperatureSous,
  type AppareilChasse
} from '@shared/chasse'
import type { Construction, PointCase } from '@shared/atelier'
import type { Pion, PointMur } from '@shared/types'

/** Les appareils dont le MJ a pris le contrôle, et la valeur qu'il leur impose. */
const controles = new Map<number, number>()
/** Ce qu'on a diffusé la dernière fois : on ne rediffuse que ce qui change. */
let dernier: string | null = null

/** Tout ce qu'il faut savoir d'un plan pour y situer, lire et entendre un appareil. */
interface Plan {
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

/**
 * Où est le pion, en fractions du plan. Un pion dans une bande de l'écran est
 * hors de la carte : on le ramène au bord, un appareil ne lit pas dans le vide.
 */
function surPlan(p: Pion, g: Plan): { x: number; y: number } {
  const q = pionSurPlan(p, g.w / g.h, display.ratioEcran())
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

function calculer(): AppareilChasse[] {
  const plan = plans()
  const affiche = display.getState().placeId
  const pions = pionsPartout()
  const out: AppareilChasse[] = []
  for (const o of listObjets()) {
    if (!o.outil) continue
    for (const ex of o.placements) {
      if (ex.port !== 'pj' && ex.port !== 'lieu') continue
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
          pos = surPlan(p, plan(p.placeId))
        }
      } else {
        placeId = ex.placeId
        if (ex.pos && ex.placeId != null) {
          ou = 'lieu'
          pos = ex.pos
        }
      }
      const g = placeId != null ? plan(placeId) : null
      const c = g?.construction ?? null
      const sous: PointCase | null = c && pos ? [pos.x * c.largeur, pos.y * c.hauteur] : null
      const controle = controles.get(ex.id)
      const valeur =
        controle ?? (o.outil === 'emf' ? niveauEmfSous(c, sous) : temperatureSous(c, sous))
      const allume = !ex.eteinte

      /* Le son : seul l'EMF en a, et seulement s'il marche et capte quelque chose. */
      let gain = 0
      if (o.outil === 'emf' && allume && valeur >= 0.5 && ou !== 'ailleurs') {
        if (ou === 'main') gain = 1
        else if (g && pos && placeId != null) {
          const ici = planDe(placeId)
          for (const p of pions) {
            if (!joueur(p) || planDe(p.placeId) !== ici) continue
            const t = trajet(pos, surPlan(p, g), g)
            gain = Math.max(gain, gainSon(t.m, t.murs))
          }
        }
      }

      out.push({
        placementId: ex.id,
        objetId: o.id,
        nom: o.nom,
        outil: o.outil,
        ou,
        placeId,
        pos,
        /* Posé : celui qui l'a posé depuis son téléphone — une trace qui ne
           vaut que tant qu'il est dans le lieu. */
        characterId: ex.port === 'pj' ? ex.characterId : ex.posePar,
        allume,
        valeur,
        controle: controle !== undefined,
        gain
      })
    }
  }
  /* Ce qui n'est plus un appareil — supprimé, plus un outil, jeté, rangé —
     perd le contrôle du MJ : il ne le retrouvera pas en revenant. */
  for (const id of controles.keys()) if (!out.some((a) => a.placementId === id)) controles.delete(id)
  return out
}

/** Tous les appareils, en main ou posés, avec ce qu'ils lisent en ce moment. */
export function appareils(): AppareilChasse[] {
  return calculer()
}

/**
 * Recalculer, et prévenir qui doit l'être — mais seulement si quelque chose a
 * bougé : un pion qui glisse loin de tout appareil ne doit rien rediffuser.
 */
export function recalculer(): void {
  const a = calculer()
  const json = JSON.stringify(a)
  if (json === dernier) return
  dernier = json
  display.versMj('chasse:state', a)
  mobile.broadcast()
  display.chasseABouge(a)
}

/**
 * Le MJ prend la main sur un appareil — `null` la lui rend, et l'appareil
 * relit sa zone. La valeur est bornée à ce que l'appareil sait afficher.
 */
export function controler(placementId: number, valeur: number | null): AppareilChasse[] {
  const a = calculer().find((x) => x.placementId === placementId)
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
 * — pas de lecture à distance dans le noir.
 */
export function lisiblePar(a: AppareilChasse, characterId: number): boolean {
  if (a.ou === 'main' && a.characterId === characterId) return true
  if (a.ou === 'ailleurs' || a.placeId == null || !a.pos) return false
  const plan = plans()
  const ici = planDe(a.placeId)
  const g = plan(a.placeId)
  return pionsPartout().some((p) => {
    if (p.characterId !== characterId || planDe(p.placeId) !== ici) return false
    const t = trajet(a.pos!, surPlan(p, g), g)
    return t.m <= PORTEE_LECTURE_M && t.murs === 0
  })
}

/** Une campagne qu'on ferme emporte ses contrôles : les numéros d'exemplaire ne valent que pour elle. */
export function oublier(): void {
  controles.clear()
  dernier = null
}

export function brancher(): void {
  /* Comme pour les sons : une erreur ici ne doit pas empêcher les pions de bouger. */
  display.ecouterPions(() => {
    try {
      recalculer()
    } catch (e) {
      console.error('[chasse]', e)
    }
  })
}
