/**
 * La préparation du personnage, côté poste du MJ.
 *
 * Le MJ invite ; chaque joueur répartit ses points sur son téléphone, et ce
 * qu'il pose arrive ici aussitôt — le MJ le suit, l'écran de la table peut le
 * montrer pour que la tablée s'accorde. Rien n'est écrit sur la fiche avant
 * que le joueur valide ; une fois validé, c'est écrit, sans attendre le MJ.
 * Le joueur peut retoucher et revalider tant que la préparation reste ouverte.
 *
 * L'état vit en mémoire, comme les tours : une préparation ne survit pas à la
 * fermeture de l'application, et n'a pas à le faire.
 */
import * as chars from './db/repos/characters'
import * as display from './display'
import { PION_COULEURS } from '@shared/types'
import type { PreparationEtat, SlidePayload } from '@shared/types'
import { abregeDe, depense, exigenceDe, nomComplet, refusDe, regleDe } from '@shared/preparation'

interface Brouillon {
  stats: Record<string, number>
  skills: string[]
  valide: boolean
  /** Le joueur a-t-il déjà touché à quelque chose ? */
  ouvert: boolean
}

let ouverte = false
let ecran = false
let depuis: string | null = null
const brouillons = new Map<number, Brouillon>()

/* Les deux portes vers l'extérieur, posées par `mobile.ts` : ce module ne
   l'importe pas, sans quoi chacun attendrait l'autre au chargement. */
let versMj: (canal: string, charge: unknown) => void = () => undefined
let versTelephones: () => void = () => undefined

export function brancher(mj: typeof versMj, telephones: typeof versTelephones): void {
  versMj = mj
  versTelephones = telephones
}

export const estOuverte = (): boolean => ouverte

/**
 * L'écran montre-t-il encore la répartition ? Le MJ a pu la remplacer par une
 * image ou l'arrêter d'ailleurs : on le lit sur l'écran plutôt que de croire
 * le dernier geste fait ici.
 */
function aLEcran(): boolean {
  if (ecran && display.getState().slide.type !== 'preparation') ecran = false
  return ecran
}

/** Le point de départ de chacun : la valeur de départ partout, aucune compétence. */
function brouillonDe(characterId: number): Brouillon {
  const deja = brouillons.get(characterId)
  if (deja) return deja
  const spec = chars.campaignSheet().spec
  const regle = regleDe(spec)
  const b: Brouillon = {
    stats: Object.fromEntries(spec.stats.map((st) => [st.key, regle.depart])),
    skills: [],
    valide: false,
    ouvert: false
  }
  brouillons.set(characterId, b)
  return b
}

const hexDe = (cle: string | null): string =>
  PION_COULEURS.find((c) => c.key === cle)?.hex ?? '#93a3a7'

/** Où en est chacun. Ne regarde pas l'écran : `diapo` s'en sert avant de l'y mettre. */
function persos(): PreparationEtat['persos'] {
  if (!ouverte) return []
  const regle = regleDe(chars.campaignSheet().spec)
  return chars.listJoueurs().map((c) => {
    const b = brouillonDe(c.id)
    return {
      id: c.id,
      nom: c.name,
      color: c.color,
      stats: b.stats,
      skills: b.skills,
      reste: regle.points - depense(b.stats, regle),
      valide: b.valide,
      ouvert: b.ouvert
    }
  })
}

export function etat(): PreparationEtat {
  return { ouverte, ecran: aLEcran(), depuis, persos: persos() }
}

/**
 * Ce que l'écran de la table montre : les caractéristiques de chacun, rien de
 * plus. Surtout pas `etat()` : il demande si l'écran montre déjà la
 * préparation, et au moment de l'y poser la réponse est non — l'écran se
 * croyait alors retiré, et ne suivait plus aucun point.
 */
function diapo(): SlidePayload {
  const spec = chars.campaignSheet().spec
  return {
    type: 'preparation',
    bornes: [regleDe(spec).depart, regleDe(spec).plafond],
    caracs: spec.stats.map((st) => ({ key: st.key, code: abregeDe(st), nom: nomComplet(st) })),
    persos: persos().map((p) => ({
      id: p.id,
      nom: p.nom,
      joueur: chars.getCharacter(p.id)?.player ?? null,
      couleur: hexDe(p.color),
      stats: p.stats,
      reste: p.reste,
      valide: p.valide
    }))
  }
}

/*
 * L'écran suit les points posés, mais pas à chaque toucher : un joueur qui
 * tapote « + » cinq fois ferait repeindre l'écran et repousser l'état à tous
 * les téléphones cinq fois. Un dixième de seconde regroupe la rafale.
 */
let minuteur: NodeJS.Timeout | null = null
function rafraichirEcran(): void {
  if (!aLEcran() || minuteur) return
  minuteur = setTimeout(() => {
    minuteur = null
    if (aLEcran() && ouverte) display.show(diapo())
  }, 120)
}

function prevenir(): void {
  versMj('prepa:etat', etat())
  rafraichirEcran()
}

export function ouvrir(): PreparationEtat {
  if (!ouverte) {
    ouverte = true
    depuis = new Date().toISOString()
    brouillons.clear()
  }
  prevenir()
  versTelephones()
  return etat()
}

export function clore(): PreparationEtat {
  if (aLEcran()) display.arreterPresentation()
  ouverte = false
  ecran = false
  depuis = null
  brouillons.clear()
  prevenir()
  versTelephones()
  return etat()
}

/** Montrer la répartition de tous sur l'écran de la table, ou la retirer. */
export function montrer(on: boolean): PreparationEtat {
  if (!ouverte) return etat()
  ecran = on
  if (on) display.show(diapo())
  else if (display.getState().slide.type === 'preparation') display.arreterPresentation()
  versMj('prepa:etat', etat())
  return etat()
}

/**
 * Ce qu'un téléphone a posé. Refusé si la règle ne le permet pas — le
 * téléphone compte comme nous, il ne devrait jamais l'être. Avec `valider`,
 * c'est écrit sur la fiche : les caractéristiques, et les compétences si la
 * règle les ouvre.
 */
export function poser(
  characterId: number,
  stats: Record<string, number>,
  skills: string[],
  valider: boolean
): string | null {
  if (!ouverte) return 'Le MJ a clos la préparation.'
  const spec = chars.campaignSheet().spec
  const regle = regleDe(spec)
  const propres = Object.fromEntries(spec.stats.map((st) => [st.key, Number(stats[st.key])]))
  const choisies = regle.competences ? [...new Set(skills.map(String))] : []
  const refus = refusDe(spec, propres, choisies)
  if (refus) return refus

  const b = brouillonDe(characterId)
  b.stats = propres
  b.skills = choisies
  b.ouvert = true
  /* Une retouche après coup rouvre la fiche : elle n'est plus celle qui a été écrite. */
  b.valide = valider

  if (valider) {
    for (const st of spec.stats) chars.setStat(characterId, st.key, propres[st.key])
    if (regle.competences)
      for (const sk of spec.skills) chars.pickSkill(characterId, sk.key, choisies.includes(sk.key))
    versMj('prepa:ecrit', characterId)
  }
  prevenir()
  return null
}

/** Ce que le téléphone du joueur reçoit : la règle, sa fiche à remplir, et où il en est. */
export function pourTelephone(characterId: number) {
  if (!ouverte) return null
  const spec = chars.campaignSheet().spec
  const regle = regleDe(spec)
  const b = brouillonDe(characterId)
  return {
    depuis,
    regle,
    limite: spec.skillLimit ?? null,
    caracs: spec.stats.map((st) => ({ key: st.key, code: abregeDe(st), nom: nomComplet(st) })),
    /* L'exigence d'une compétence se lit ici, une fois : le téléphone n'a
       qu'à comparer un nombre à un autre. */
    comps: regle.competences
      ? spec.skills.map((sk) => ({ key: sk.key, ...exigenceDe(sk, spec.stats) }))
      : [],
    mien: { stats: b.stats, skills: b.skills, valide: b.valide }
  }
}

/** Une autre campagne s'ouvre : la préparation de celle-ci n'a plus de sens. */
export function oublier(): void {
  ouverte = false
  ecran = false
  depuis = null
  brouillons.clear()
}
