/**
 * La régie du son, pendant la partie.
 *
 * L'état vit ici, en mémoire, comme celui des tours : qu'un son posé ait déjà
 * joué, qu'il attende le feu vert, quelles nappes tournent — rien de cela n'a
 * à survivre à la soirée. Le MJ en reçoit tout par `sons:state` ; les sons qui
 * partent, un par un, par `sons:joue`. Le moteur qui les fait entendre est
 * dans la fenêtre du MJ (`Sonorisation.tsx`), comme l'ambiance l'était : la
 * musique doit survivre à la fermeture de l'écran des joueurs.
 *
 * **Les sons posés** partent quand un pion entre dans leur cercle. On le
 * voit à chaque rafraîchissement des pions (`display.ecouterPions`), d'où
 * qu'il vienne — la Régie, le Paravent, un téléphone. Un pion qu'on vient de
 * poser, ou un lieu qu'on vient de mettre en scène, ne déclenche rien : on
 * ne compte que ceux qui **entrent**. Les murs arrêtent le son : un pion
 * derrière une cloison, ou derrière une porte fermée, n'entend rien.
 */
import * as display from './display'
import * as mobile from './mobile'
import * as sons from './db/repos/sons'
import { listPions } from './db/repos/pions'
import { listMurs } from './db/repos/murs'
import { listOuvertures } from './db/repos/ouvertures'
import { barrieres, seCroisent, type Barriere, type Pt } from '@shared/murs'
import {
  MOTIFS_VIBRATION,
  type EtatZone,
  type Pion,
  type PointMur,
  type Son,
  type SonJoue,
  type SonsMj,
  type ZoneSon
} from '@shared/types'

/** Combien de sons partis on garde pour le journal du Paravent. */
const JOURNAL = 8

const regie = {
  general: 0.8,
  auto: true,
  nappes: [] as SonsMj['nappes'],
  journal: [] as SonJoue[]
}
/** L'état de chaque son posé ; absent, il est armé (ou à l'écoute). */
const etats = new Map<number, EtatZone>()
const attente = new Map<number, string | null>()
/** Le dernier départ de chaque son posé, pour son temps mort. */
const dernier = new Map<number, number>()
/** Qui est dans quel cercle : « zone:pion ». */
let dedans = new Set<string>()
/** Les pions déjà vus sur le lieu, pour ne pas compter une pose comme une entrée. */
let connus = new Set<number>()
let lieuSuivi: number | null = null
/** Les sources du lieu en scène et leur gain du moment. */
let sources: SonsMj['sources'] = []
/** Le fichier tiré pour une source : une fois, pas à chaque pas. */
const fichierDeSource = new Map<number, string | null>()
let suite = 0

/* ============================================================
   L'état envoyé au MJ
   ============================================================ */

export function etat(): SonsMj {
  const zones: Record<number, EtatZone> = {}
  for (const z of sons.listZones(lieuSuivi))
    zones[z.id] = etats.get(z.id) ?? (z.quand === 'proche' ? 'ecoute' : 'arme')
  return {
    general: regie.general,
    auto: regie.auto,
    nappes: regie.nappes,
    sources,
    zones,
    attente: [...attente.entries()].map(([zoneId, qui]) => ({ zoneId, qui })),
    journal: regie.journal
  }
}

function diffuser(): void {
  display.versMj('sons:state', etat())
}

/* ============================================================
   Jouer
   ============================================================ */

/** Un fichier du son, tiré au hasard : une porte ne grince jamais deux fois pareil. */
function tirer(son: Son): { itemId: number; url: string | null } | null {
  if (!son.fichiers.length) return null
  const f = son.fichiers[Math.floor(Math.random() * son.fichiers.length)]
  return { itemId: f.itemId, url: f.url }
}

/**
 * Faire partir un son. Un bruitage part tel quel ; une nappe s'ajoute à
 * celles qui tournent ; une ambiance prend la place de la précédente.
 */
export function jouer(
  sonId: number,
  depuis: { qui?: string | null; zoneId?: number | null; vibrer?: number[] | 'tous' | null } = {}
): SonsMj {
  const son = sons.getSon(sonId)
  if (!son) return etat()
  if (son.nature === 'ambiance') return ambiance(sonId)
  if (son.nature === 'nappe') return ajouterNappe(sonId)

  const f = tirer(son)
  const joue: SonJoue = {
    n: ++suite,
    sonId: son.id,
    nom: son.nom,
    emoji: son.emoji,
    nature: son.nature,
    url: f?.url ?? null,
    volume: son.volume,
    qui: depuis.qui ?? null,
    zoneId: depuis.zoneId ?? null
  }
  regie.journal = [joue, ...regie.journal].slice(0, JOURNAL)
  display.versMj('sons:joue', joue)
  /* Le téléphone vibre avec le son, pas à sa place : sans motif, rien. */
  const vise = depuis.vibrer === undefined ? 'tous' : depuis.vibrer
  if (son.vibration && vise) mobile.vibrer(vise, MOTIFS_VIBRATION[son.vibration].motif)
  diffuser()
  return etat()
}

/** L'ambiance : une seule à la fois, la nouvelle arrive en fondu enchaîné. */
export function ambiance(sonId: number | null): SonsMj {
  if (sonId == null) {
    display.setAudio({ playing: false })
    return etat()
  }
  const son = sons.getSon(sonId)
  const f = son ? tirer(son) : null
  if (!son || !f?.url) return etat()
  display.setAudio({
    itemId: f.itemId,
    url: f.url,
    title: son.nom,
    playing: true,
    loop: true,
    volume: son.volume,
    sonId: son.id,
    fondu: son.fonduEntree
  })
  return etat()
}

export function ajouterNappe(sonId: number): SonsMj {
  const son = sons.getSon(sonId)
  if (!son) return etat()
  const deja = regie.nappes.find((n) => n.sonId === sonId)
  if (deja) deja.on = true
  else regie.nappes = [...regie.nappes, { sonId, url: tirer(son)?.url ?? null, volume: son.volume, on: true }]
  diffuser()
  return etat()
}

export function reglerNappe(sonId: number, patch: { volume?: number; on?: boolean }): SonsMj {
  regie.nappes = regie.nappes.map((n) =>
    n.sonId !== sonId
      ? n
      : {
          ...n,
          volume: patch.volume === undefined ? n.volume : Math.max(0, Math.min(1, patch.volume)),
          on: patch.on === undefined ? n.on : patch.on
        }
  )
  diffuser()
  return etat()
}

export function retirerNappe(sonId: number): SonsMj {
  regie.nappes = regie.nappes.filter((n) => n.sonId !== sonId)
  diffuser()
  return etat()
}

export function regler(patch: { general?: number; auto?: boolean }): SonsMj {
  if (patch.general !== undefined) regie.general = Math.max(0, Math.min(1, Number(patch.general) || 0))
  if (patch.auto !== undefined) regie.auto = !!patch.auto
  diffuser()
  return etat()
}

/**
 * Silence : tout s'éteint, en fondu court. Les nappes s'arrêtent sans
 * disparaître de la liste — on les relance d'un clic —, l'ambiance se met en
 * pause, et ce qui attendait un feu vert n'attend plus.
 */
export function silence(): SonsMj {
  regie.nappes = regie.nappes.map((n) => ({ ...n, on: false }))
  attente.clear()
  for (const [id, e] of etats) if (e === 'attente') etats.set(id, 'arme')
  display.setAudio({ playing: false })
  display.versMj('sons:silence', null)
  diffuser()
  return etat()
}

/** Faire vibrer tous les téléphones, sans son : le frisson dans le dos. */
export function vibrerTous(motif: keyof typeof MOTIFS_VIBRATION): number {
  const m = MOTIFS_VIBRATION[motif]
  return m ? mobile.vibrer('tous', m.motif) : 0
}

/* ============================================================
   Les sons posés
   ============================================================ */

/** Ce qui arrête le son sur ce lieu, dans le repère en pixels du plan. */
function geometrie(placeId: number): { murs: Barriere[]; w: number; h: number } {
  const { w, h } = mobile.repereDuPlan(placeId)
  const enPx = (q: PointMur): Pt => ({ x: q[0] * w, y: q[1] * h })
  return { murs: barrieres(listMurs(placeId), 'pas', enPx, listOuvertures(placeId)), w, h }
}

const concerne = (z: ZoneSon, p: Pion): boolean => {
  const joueur = p.characterId != null && !p.pnj
  return z.par === 'tous' || (z.par === 'joueurs' ? joueur : !joueur)
}

/** La part du rayon qui reste entre le pion et le bord : 1 au centre, 0 au bord ou au-delà. */
function proximite(z: ZoneSon, p: Pion, g: { murs: Barriere[]; w: number; h: number }): number {
  const c = { x: z.x * g.w, y: z.y * g.h }
  const q = { x: p.x * g.w, y: p.y * g.h }
  const d = Math.hypot(q.x - c.x, q.y - c.y) / (z.rayon * g.w)
  if (d > 1) return 0
  for (const m of g.murs) if (seCroisent(c, q, m.a, m.b)) return 0
  return Math.max(0, 1 - d)
}

/** Faire partir un son posé, de lui-même ou au feu vert du MJ. */
function declencher(z: ZoneSon, qui: Pion | null): void {
  if (z.sonId == null) return
  dernier.set(z.id, Date.now())
  etats.set(z.id, z.quand === 'une' ? 'fait' : 'arme')
  attente.delete(z.id)
  /* « Lui » : le téléphone de celui qui entre — un PNJ n'en a pas. */
  const vibrer =
    z.vibrer === 'tous'
      ? ('tous' as const)
      : z.vibrer === 'lui' && qui?.characterId != null
        ? [qui.characterId]
        : null
  jouer(z.sonId, { qui: qui?.label ?? null, zoneId: z.id, vibrer })
}

/**
 * Un pion a bougé, ou le lieu a changé. On regarde qui vient d'entrer dans
 * quel cercle, et l'on recalcule le volume des sources.
 */
function surPions(placeId: number | null): void {
  const zones = sons.listZones(placeId)
  const changeDeLieu = placeId !== lieuSuivi
  if (changeDeLieu) {
    lieuSuivi = placeId
    dedans = new Set()
    connus = new Set()
    attente.clear()
  }
  if (!zones.length || placeId == null) {
    const avait = sources.length > 0 || changeDeLieu
    sources = []
    if (avait) diffuser()
    return
  }

  const pions = listPions(placeId)
  const g = geometrie(placeId)
  const maintenant = new Set<string>()
  let bouge = changeDeLieu

  for (const z of zones) {
    if (z.quand === 'proche' || z.sonId == null) continue
    for (const p of pions) {
      if (!concerne(z, p) || proximite(z, p, g) <= 0) continue
      const cle = `${z.id}:${p.id}`
      maintenant.add(cle)
      /* Déjà dedans, ou tout juste posé : ce n'est pas une entrée. */
      if (dedans.has(cle) || !connus.has(p.id)) continue
      const e = etats.get(z.id) ?? 'arme'
      if (e === 'fait' || e === 'attente') continue
      if (z.quand === 'chaque' && Date.now() - (dernier.get(z.id) ?? 0) < z.tempsMort * 1000) continue
      bouge = true
      if (z.confirmer || !regie.auto) {
        etats.set(z.id, 'attente')
        attente.set(z.id, p.label)
      } else declencher(z, p)
    }
  }
  dedans = maintenant
  connus = new Set(pions.map((p) => p.id))

  /* Les sources : le pion le plus proche fixe le gain. */
  const avant = JSON.stringify(sources)
  sources = zones
    .filter((z) => z.quand === 'proche' && z.sonId != null)
    .map((z) => {
      const son = sons.getSon(z.sonId!)
      if (!fichierDeSource.has(z.id)) fichierDeSource.set(z.id, son ? (tirer(son)?.url ?? null) : null)
      const gain = pions.reduce((m, p) => (concerne(z, p) ? Math.max(m, proximite(z, p, g)) : m), 0)
      return {
        zoneId: z.id,
        sonId: z.sonId!,
        url: fichierDeSource.get(z.id) ?? null,
        volume: son?.volume ?? 0.5,
        /* Arrondi : vingt pas par seconde n'ont pas à faire vingt messages. */
        gain: Math.round(gain * 50) / 50
      }
    })
  if (bouge || JSON.stringify(sources) !== avant) diffuser()
}

/** Le feu vert du MJ : le son qui attendait part. */
export function feuVert(zoneId: number): SonsMj {
  const z = sons.getZone(zoneId)
  if (!z) return etat()
  const qui = attente.get(zoneId) ?? null
  const pion = qui ? (listPions(z.placeId).find((p) => p.label === qui) ?? null) : null
  declencher(z, pion)
  return etat()
}

/** Jouer un son posé tout de suite, quel que soit son état. */
export function jouerZone(zoneId: number): SonsMj {
  const z = sons.getZone(zoneId)
  if (z) declencher(z, null)
  return etat()
}

/** Refuser le feu vert, ou réarmer un son déjà joué. */
export function rearmer(zoneId: number): SonsMj {
  etats.delete(zoneId)
  attente.delete(zoneId)
  dernier.delete(zoneId)
  diffuser()
  return etat()
}

export function toutRearmer(): SonsMj {
  etats.clear()
  attente.clear()
  dernier.clear()
  diffuser()
  return etat()
}

/** Un son posé a changé dans l'éditeur : la source retire son fichier, le gain se recalcule. */
export function zoneChangee(zoneId: number): void {
  fichierDeSource.delete(zoneId)
  surPions(display.getState().placeId)
  diffuser()
}

/** Une campagne qu'on ferme emporte sa régie : rien ne doit survivre d'une base à l'autre. */
export function oublier(): void {
  regie.nappes = []
  regie.journal = []
  etats.clear()
  attente.clear()
  dernier.clear()
  fichierDeSource.clear()
  dedans = new Set()
  connus = new Set()
  sources = []
  lieuSuivi = null
}

export function brancher(): void {
  /* Un son qui ne part pas vaut mieux que des pions qui ne bougent plus : une
     erreur ici — une base qu'on ferme, un plan illisible — reste ici. */
  display.ecouterPions((placeId) => {
    try {
      surPions(placeId)
    } catch (e) {
      console.error('[sons]', e)
    }
  })
}

