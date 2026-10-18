/**
 * Les tours : qui joue, dans quel ordre, et à quel round on en est.
 *
 * L'état vit ici, en mémoire, comme celui de l'écran : un combat dure une
 * scène, pas une campagne, et il n'a rien à faire dans la base. Le MJ en
 * reçoit tout par `tours:state` ; les joueurs n'en voient que `TourVu`, taillé
 * à chaque diffusion — les participants cachés n'y entrent pas.
 */
import * as display from './display'
import * as chars from './db/repos/characters'
import { colorFor, getPion, initialsOf, listPions } from './db/repos/pions'
import { getItem } from './db/repos/library'
import { mediaUrl } from './vault'
import { totalTour } from '@shared/types'
import { modificateur } from '@shared/jet'
import type { Character, EntrantTour, EntrantVu, Pion, ToursMj, TourVu } from '@shared/types'

let tours: ToursMj | null = null

export function etat(): ToursMj | null {
  return tours
}

/* ---------------- qui peut entrer ---------------- */

function depuisPerso(c: Character, caracKey: string | null): EntrantTour {
  const portrait = c.portraitItemId != null ? getItem(c.portraitItemId) : null
  return {
    cle: `c${c.id}`,
    characterId: c.id,
    pionId: null,
    kind: c.kind,
    nom: c.name,
    color: c.color ?? colorFor(c.id),
    url: mediaUrl(portrait?.relPath ?? null),
    cadre: portrait ? c.portraitCadre : null,
    initials: initialsOf(c.name),
    de: null,
    /* L'initiative suit la règle des jets : le dé plus le modificateur. */
    carac: caracKey ? modificateur(c.data.stats[caracKey] ?? 10) : 0,
    montre: true
  }
}

function depuisPion(p: Pion): EntrantTour {
  return {
    cle: `p${p.id}`,
    characterId: null,
    pionId: p.id,
    kind: 'pnj',
    nom: p.label,
    color: p.color,
    url: p.url,
    cadre: p.cadre,
    initials: p.initials,
    de: null,
    carac: 0,
    /* Un pion embusqué entre caché : le mettre dans les tours ne doit pas le trahir. */
    montre: !p.cache
  }
}

/**
 * La carac qui s'ajoute au dé quand on n'a encore rien choisi : la dextérité
 * si le gabarit en a une, sinon la première.
 */
function caracParDefaut(): string | null {
  const stats = chars.campaignSheet().spec.stats
  const dex = stats.find((s) => /^(dex|agi)/i.test(s.code ?? s.key) || /dext|agilit/i.test(s.label))
  return (dex ?? stats[0])?.key ?? null
}

/** Les pions posés sur le lieu à l'écran : les PNJ qui s'y trouvent sont sans doute de la partie. */
const pionsEnScene = (): Pion[] => listPions(display.getState().placeId)

/**
 * Ceux qu'on peut ajouter : un joueur présent qu'on aurait retiré, les PNJ de
 * la séance, et les pions nommés du lieu à l'écran qui n'ont pas de fiche. Pas
 * les objets — une armoire ne joue pas.
 */
export function candidats(): EntrantTour[] {
  const deja = new Set(tours?.entrants.map((e) => e.cle))
  const key = tours?.caracKey ?? caracParDefaut()
  const pnj = chars
    .listCharacters()
    .filter((c) => (c.kind === 'pnj' || c.present) && !c.horsJeu)
    .map((c) => depuisPerso(c, key))
  const pions = pionsEnScene()
    .filter((p) => p.characterId == null && p.itemId == null)
    .map(depuisPion)
  return [...pnj, ...pions].filter((e) => !deja.has(e.cle))
}

/* ---------------- les gestes du MJ ---------------- */

/**
 * Ouvre l'initiative. La première fois, les joueurs présents y sont d'office,
 * avec les PNJ dont le pion est déjà sur le lieu à l'écran ; ensuite, on
 * retrouve la liste telle qu'on l'avait laissée.
 */
export function ouvrir(): ToursMj | null {
  if (tours) {
    tours.phase = 'prep'
    return publier()
  }
  const caracKey = caracParDefaut()
  const joueurs = chars.listJoueurs().map((c) => depuisPerso(c, caracKey))
  const enScene = pionsEnScene()
  const pnj = enScene
    .filter((p) => p.characterId != null && !joueurs.some((j) => j.characterId === p.characterId))
    .map((p) => {
      const c = chars.getCharacter(p.characterId as number)
      if (!c || c.kind !== 'pnj') return null
      return { ...depuisPerso(c, caracKey), montre: !p.cache }
    })
    .filter((e): e is EntrantTour => e != null)
  const nommes = enScene.filter((p) => p.characterId == null && p.itemId == null).map(depuisPion)
  tours = {
    phase: 'prep',
    demarre: false,
    round: 1,
    actif: 0,
    entrants: [...joueurs, ...pnj, ...nommes],
    caracKey
  }
  return publier()
}

/** Changer la carac de l'initiative : on la relit sur chaque fiche. */
export function choisirCarac(key: string | null): ToursMj | null {
  if (!tours) return null
  tours.caracKey = key
  for (const e of tours.entrants) {
    if (e.characterId == null) continue
    const c = chars.getCharacter(e.characterId)
    if (c) e.carac = key ? modificateur(c.data.stats[key] ?? 10) : 0
  }
  return publier()
}

export function saisir(
  cle: string,
  patch: Partial<Pick<EntrantTour, 'de' | 'carac' | 'montre'>>
): ToursMj | null {
  const e = tours?.entrants.find((x) => x.cle === cle)
  if (!e) return tours
  if ('de' in patch) e.de = patch.de == null || Number.isNaN(patch.de) ? null : patch.de
  if (patch.carac != null && !Number.isNaN(patch.carac)) e.carac = patch.carac
  /* Un joueur ne se cache pas : la table sait qu'il est là. */
  if (patch.montre != null && e.kind === 'pnj') e.montre = patch.montre
  return publier()
}

export function ajouter(cle: string): ToursMj | null {
  if (!tours) return null
  const e = candidats().find((x) => x.cle === cle)
  if (!e) return tours
  /* En plein combat, il entre en fin de round : il n'a pas encore joué. */
  tours.entrants.push(e)
  return publier()
}

export function retirer(cle: string): ToursMj | null {
  if (!tours) return null
  const i = tours.entrants.findIndex((x) => x.cle === cle)
  if (i < 0) return tours
  tours.entrants.splice(i, 1)
  /* Celui qui jouait après lui garde la main. */
  if (i < tours.actif) tours.actif--
  if (tours.actif >= tours.entrants.length) tours.actif = 0
  return publier()
}

/**
 * Trier du plus haut total au plus bas, puis jouer. À égalité, la plus forte
 * carac passe devant ; ensuite l'ordre d'avant, que le tri respecte.
 *
 * Revoir l'initiative en plein combat ne le recommence pas : celui qui avait
 * la main la garde, au rang où le tri l'a mis.
 */
export function commencer(): ToursMj | null {
  if (!tours || tours.entrants.length === 0) return tours
  const enMain = tours.demarre ? tours.entrants[tours.actif] : null
  tours.entrants.sort((a, b) => totalTour(b) - totalTour(a) || b.carac - a.carac)
  if (enMain) tours.actif = Math.max(0, tours.entrants.indexOf(enMain))
  else {
    tours.round = 1
    tours.actif = 0
  }
  tours.phase = 'combat'
  tours.demarre = true
  return publier()
}

/** Quitter l'initiative sans rien trier : on revient au combat, ou à rien. */
export function annuler(): ToursMj | null {
  if (!tours) return null
  if (tours.demarre) tours.phase = 'combat'
  else tours = null
  return publier()
}

export function suivant(): ToursMj | null {
  if (!tours || tours.phase !== 'combat' || !tours.entrants.length) return tours
  tours.actif++
  if (tours.actif >= tours.entrants.length) {
    tours.actif = 0
    tours.round++
  }
  return publier()
}

export function precedent(): ToursMj | null {
  if (!tours || tours.phase !== 'combat' || !tours.entrants.length) return tours
  if (tours.actif > 0) tours.actif--
  else if (tours.round > 1) {
    tours.round--
    tours.actif = tours.entrants.length - 1
  }
  return publier()
}

/**
 * Il attend : il jouera juste après le suivant. Le suivant prend donc la main
 * tout de suite, puisqu'il glisse à la place qu'on lui laisse.
 */
export function retarder(): ToursMj | null {
  if (!tours || tours.phase !== 'combat' || tours.entrants.length < 2) return tours
  const i = tours.actif
  if (i === tours.entrants.length - 1) return suivant()
  const [e] = tours.entrants.splice(i, 1)
  tours.entrants.splice(i + 1, 0, e)
  return publier()
}

/** Donner la main à quelqu'un, d'un clic sur son jeton. */
export function donnerMain(cle: string): ToursMj | null {
  if (!tours) return null
  const i = tours.entrants.findIndex((x) => x.cle === cle)
  if (i >= 0) tours.actif = i
  return publier()
}

/** Glisser un jeton à une autre place. Celui qui a la main la garde. */
export function deplacer(cle: string, vers: number): ToursMj | null {
  if (!tours) return null
  const i = tours.entrants.findIndex((x) => x.cle === cle)
  if (i < 0) return tours
  const enMain = tours.entrants[tours.actif]
  const [e] = tours.entrants.splice(i, 1)
  tours.entrants.splice(Math.max(0, Math.min(vers, tours.entrants.length)), 0, e)
  tours.actif = Math.max(0, tours.entrants.indexOf(enMain))
  return publier()
}

/** Fin du combat : tout s'efface, à l'écran comme sur les portables. */
export function fin(): ToursMj | null {
  tours = null
  return publier()
}

/* ---------------- ce qu'on en montre ---------------- */

/** Le pion de quelqu'un, sur le lieu donné — le sien s'il en a un nommé, sinon celui de sa fiche. */
export function pionDe(e: EntrantTour, pions: Pion[]): Pion | undefined {
  if (e.pionId != null) return pions.find((p) => p.id === e.pionId)
  return pions.find((p) => p.characterId != null && p.characterId === e.characterId)
}

/**
 * Les tours vus des joueurs. Seuls les participants montrés y entrent ; celui
 * qui joue, s'il est caché, ne laisse qu'un drapeau — « quelqu'un d'autre ».
 */
function vu(): TourVu | null {
  if (!tours || !tours.demarre || !tours.entrants.length) return null
  const { entrants, actif } = tours
  const ordre: EntrantVu[] = []
  let curseur = 0
  /* Un pion montré sans son nom ne le livre pas non plus par la frise. */
  const enScene = pionsEnScene()
  entrants.forEach((e, i) => {
    if (i < actif && e.montre) curseur++
    if (!e.montre) return
    const anonyme = e.kind === 'pnj' && !!pionDe(e, enScene)?.anonyme
    ordre.push({
      nom: anonyme ? '?' : e.nom,
      color: e.color,
      url: e.url,
      cadre: e.cadre,
      initials: anonyme ? '?' : e.initials,
      characterId: e.characterId,
      fait: i < actif
    })
  })
  const enJeu = entrants[actif]
  /* `state.pions` ne tient que les pions vus du lieu à l'écran : un pion
     caché ne peut donc pas recevoir le halo, même par erreur. */
  const pion = enJeu.montre ? pionDe(enJeu, display.getState().pions) : undefined
  return {
    round: tours.round,
    ordre,
    curseur: ordre.length ? curseur % ordre.length : 0,
    actifCache: !enJeu.montre,
    pionEnJeuId: pion?.id ?? null
  }
}

/** Le MJ apprend tout ; l'écran et les portables relisent leur part. */
function publier(): ToursMj | null {
  /* Un pion nommé retiré du plan n'a plus de nom à jour : on le relit. */
  if (tours)
    for (const e of tours.entrants) {
      if (e.pionId == null) continue
      const p = getPion(e.pionId)
      if (p) e.nom = p.label
    }
  display.versMj('tours:state', tours)
  display.broadcast()
  return tours
}

display.onCalculTour(vu)
