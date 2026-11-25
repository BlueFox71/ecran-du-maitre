/**
 * Une seule fiche par personnage WoW : celle de l'Aventure, que l'Écran tient
 * en miroir.
 *
 *  — **De l'Aventure vers l'Écran** : dès qu'un joueur a créé son personnage
 *    (prénom ou race posés par la création), l'Écran crée sa fiche de joueur
 *    (nom, joueur, « race classe », PV, ressource, les dix caractéristiques,
 *    sexe, âge, histoire, bourse, effets en cours), et la tient à jour ensuite.
 *  — **De l'Écran vers l'Aventure** : le MJ qui change les PV, la ressource,
 *    une caractéristique, l'identité ou la bourse sur la fiche, ou qui y pose
 *    ou retire un effet, l'envoie à l'Aventure — dans sa boîte si le joueur
 *    est en ligne, directement dans son fichier sinon.
 *
 * Le lien joueur WoW → personnage de l'Écran est un réglage de la campagne :
 * `wow.liens` = `{ "<id du joueur>": <id du personnage> }`.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import * as chars from './db/repos/characters'
import * as players from './db/repos/players'
import * as carnet from './carnet'
import * as reglages from './db/repos/reglages'
import { isDbOpen } from './db'
import * as display from './display'
import { lireCampagne } from '@shared/reglages'
import { lireMonnaies, type ReglageMonnaies } from '@shared/monnaies'
import {
  CARACS_WOW,
  PIECES_WOW,
  type ArgentWow,
  type EffetFicheWow,
  type EtatWow,
  type JoueurWow,
  type MajFicheWow,
  type PersoAAssocier
} from '@shared/wow'
import type { Character, CharacterData, Sexe } from '@shared/types'

const CLE_LIENS = 'wow.liens'

/** Après une correction du MJ, on laisse le temps à l'Aventure de la recevoir. */
const ATTENTE_MS = 9000
const attente = new Map<number, number>()
/** Ce qui a été écrit la dernière fois, pour ne pas réécrire la base à chaque tour. */
const dernier = new Map<number, string>()

const sansAccent = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

function liens(): Record<string, number> {
  try {
    const l = JSON.parse(reglages.tous()[CLE_LIENS] ?? '{}')
    return l && typeof l === 'object' ? l : {}
  } catch {
    return {}
  }
}

function poserLiens(l: Record<string, number>): void {
  reglages.poser(CLE_LIENS, JSON.stringify(l))
}

/** Le personnage a-t-il été créé (et pas seulement une fiche vide ouverte) ? */
const estCree = (e: Partial<EtatWow>): boolean => !!((e.prenom || e.nomPerso) && e.race)

const nomJoueur = (j: JoueurWow): string =>
  (j.etat?.joueur || j.id.charAt(0).toUpperCase() + j.id.slice(1)).trim()

const metier = (e: Partial<EtatWow>): string =>
  [e.race, e.classeNom, e.niveau ? `niv. ${e.niveau}` : null].filter(Boolean).join(' · ')

const sexeEcran = (s: string | undefined): Sexe | null | undefined =>
  s === undefined ? undefined : s === 'Femme' ? 'femme' : s === 'Homme' ? 'homme' : null

type Identite = { sexe?: Sexe | null; age?: string | null; biographie?: string | null }

/** L'identité de la fiche d'après l'Aventure : seulement ce qu'elle dit (une fiche dormante n'a pas tout). */
function identite(e: Partial<EtatWow>): Identite {
  const out: Identite = {}
  const sx = sexeEcran(e.sexe)
  if (sx !== undefined) out.sexe = sx
  if (e.age !== undefined) out.age = String(e.age).trim() || null
  if (e.histoire !== undefined) out.biographie = String(e.histoire).trim() || null
  return out
}

/**
 * Une campagne WoW paie en pièces d'or, d'argent et de cuivre, comme
 * l'Aventure : sans monnaies à elle (aucune, ou la « Pièce » d'une campagne
 * neuve), elle prend celles-là, pour que la bourse de la fiche les montre.
 */
export function monnaiesDeWow(): boolean {
  if (!isDbOpen() || lireCampagne(reglages.tous()).regles !== 'wow') return false
  const m: ReglageMonnaies = lireMonnaies(reglages.tous()['monnaies'])
  if (m.liste.some((x) => x.key === 'po')) return false
  const neuve = !m.actif || (m.liste.length === 1 && m.liste[0].key === 'piece')
  if (!neuve) return false
  reglages.poser(
    'monnaies',
    JSON.stringify({
      actif: true,
      liste: PIECES_WOW.map((p, i) => ({ ...p, imageItemId: null, taux: i === 0 ? null : 100 }))
    })
  )
  return true
}

/** Les données de la fiche, d'après l'Aventure, posées sur celles qu'elle avait. */
function donnees(e: Partial<EtatWow>, avant: CharacterData | null, cles: Set<string>): CharacterData {
  const d: CharacterData = avant
    ? JSON.parse(JSON.stringify(avant))
    : { gauges: {}, stats: {}, skills: {}, states: {} }
  if (e.pv !== undefined) {
    const max = e.pvMax ?? Math.max(d.gauges.pv?.max ?? 0, e.pv)
    d.gauges.pv = { value: Math.min(e.pv, max), max }
  }
  if (e.res !== undefined && cles.has('ressource')) {
    const max = e.resMax ?? Math.max(d.gauges.ressource?.max ?? 0, e.res)
    d.gauges.ressource = { value: Math.min(e.res, max), max }
  }
  for (const [k] of CARACS_WOW) if (e.car && Number.isFinite(e.car[k]) && cles.has(k)) d.stats[k] = e.car[k]
  if (e.argent && typeof e.argent === 'object') {
    const b = { ...(d.bourse ?? {}) }
    for (const p of PIECES_WOW) b[p.key] = Math.max(0, Math.round(Number(e.argent[p.key]) || 0))
    d.bourse = b
  }
  if (Number(e.niveau) > 0) d.niveauWow = Math.round(Number(e.niveau))
  if (e.combat && typeof e.combat === 'object')
    d.combatWow = {
      armure: Math.round(Number(e.combat.armure) || 0),
      defense: Math.round(Number(e.combat.defense) || 0),
      initiative: Math.round(Number(e.combat.initiative) || 0),
      resist: Object.fromEntries(Object.entries(e.combat.resist ?? {}).map(([k, v]) => [k, Math.round(Number(v) || 0)]))
    }
  if (Array.isArray(e.auras))
    d.aurasWow = e.auras.map((a) => ({ nom: a.nom, mal: !!a.mal, tours: a.tours | 0, pile: a.pile | 0, lbl: a.lbl ?? '' }))
  /* Le panneau Aventure : d'une Aventure ouverte, ou de ce que sa fiche enregistrée en dit. */
  if (Array.isArray(e.sacs))
    d.aventureWow = {
      equip: (e.equip ?? []).map((o) => ({ c: String(o.c), nom: String(o.nom), q: o.q | 0 })),
      sacs: e.sacs.map((o) => ({ nom: String(o.nom), q: o.q | 0, qte: Math.max(1, o.qte | 0) })),
      /* Une fiche enregistrée par une Aventure d'avant ne nomme pas ses talents : on garde ceux qu'on avait. */
      talents: e.talents
        ? e.talents.map((t) => ({ nom: String(t.nom), rang: t.rang | 0, max: Math.max(1, t.max | 0) }))
        : (d.aventureWow?.talents ?? []),
      sorts: e.sorts ? e.sorts.map((s) => ({ nom: String(s.nom), niveau: s.niveau | 0 })) : (d.aventureWow?.sorts ?? [])
    }
  return d
}

/** Ce qui compte pour savoir si la fiche a bougé : nom, métier, identité, chiffres, bourse, effets. */
const signatureDe = (nom: string, occupation: string, id: Identite, d: CharacterData): string =>
  JSON.stringify([
    nom,
    occupation,
    id.sexe,
    id.age,
    id.biographie,
    d.gauges.pv,
    d.gauges.ressource,
    d.stats,
    d.bourse,
    d.aurasWow,
    d.aventureWow,
    d.niveauWow,
    d.combatWow
  ])

/** La même, lue sur la fiche de l'Écran (seulement l'identité que l'Aventure a dite). */
const signatureFiche = (ch: Character, id: Identite): string =>
  signatureDe(
    ch.name,
    ch.occupation ?? '',
    {
      sexe: id.sexe !== undefined ? ch.sexe : undefined,
      age: id.age !== undefined ? ch.age : undefined,
      biographie: id.biographie !== undefined ? ch.biographie : undefined
    },
    ch.data
  )

/**
 * Un tour de synchronisation : l'Aventure → l'Écran. Appelé régulièrement tant
 * que le jeu tourne sur une campagne aux règles WoW.
 */
export function synchroniser(table: JoueurWow[]): void {
  if (!isDbOpen() || lireCampagne(reglages.tous()).regles !== 'wow') return
  const fiche = chars.campaignSheet()
  const cles = new Set([...fiche.spec.gauges.map((g) => g.key), ...fiche.spec.stats.map((s) => s.key)])
  const l = liens()
  let change = false

  for (const j of table) {
    const e = j.etat ?? {}
    if (!estCree(e)) continue
    const nom = (e.nomPerso || [e.prenom, e.nom].filter(Boolean).join(' ') || nomJoueur(j)).trim()
    let ch = l[j.id] ? chars.getCharacter(l[j.id]) : null

    if (!ch || ch.kind !== 'pj') {
      ch = chars.upsertCharacter({
        templateId: fiche.id,
        kind: 'pj',
        name: nom,
        player: nomJoueur(j),
        occupation: metier(e),
        sexe: e.sexe === 'Femme' ? 'femme' : e.sexe === 'Homme' ? 'homme' : null,
        age: e.age || null,
        biographie: e.histoire || null,
        data: donnees(e, chars.blankData(fiche.spec), cles)
      })
      l[j.id] = ch.id
      poserLiens(l)
      /* À qui est ce personnage ? Le MJ le dit (voir aAssocier) : l'Écran demande. */
      display.versMj('wow:aAssocier', null)
      change = true
      continue
    }

    /* Le MJ vient de corriger cette fiche : l'Aventure ne l'a peut-être pas encore reçue. */
    if ((attente.get(ch.id) ?? 0) > Date.now()) continue

    const data = donnees(e, ch.data, cles)
    const id = identite(e)
    const signature = signatureDe(nom, metier(e), id, data)
    if (dernier.get(ch.id) === signature) continue
    dernier.set(ch.id, signature)
    if (signatureFiche(ch, id) === signature) continue
    chars.upsertCharacter({ id: ch.id, templateId: ch.templateId, name: nom, occupation: metier(e), ...id, data })
    change = true
  }

  if (change) {
    display.versMj('characters:relus', null)
    display.refreshJoueurs()
  }
}

/* ---------------- à qui est ce personnage ? ---------------- */

/** Les personnages dont le MJ a déjà décidé qu'ils n'étaient à personne. */
const CLE_SANS_JOUEUR = 'wow.sansJoueur'

function sansJoueur(): number[] {
  try {
    const l = JSON.parse(reglages.tous()[CLE_SANS_JOUEUR] ?? '[]')
    return Array.isArray(l) ? l : []
  } catch {
    return []
  }
}

/**
 * Les personnages créés dans l'Aventure qui n'ont encore ni joueur dans
 * l'Écran, ni décision « à personne » du MJ.
 */
export function aAssocier(): PersoAAssocier[] {
  if (!isDbOpen()) return []
  const pris = new Set(players.listPlayers().map((p) => p.characterId).filter((x) => x != null))
  const personne = new Set(sansJoueur())
  const ps = players.listPlayers()
  const out: PersoAAssocier[] = []
  for (const [joueur, id] of Object.entries(liens())) {
    if (pris.has(id) || personne.has(id)) continue
    const ch = chars.getCharacter(id)
    if (!ch || ch.kind !== 'pj') continue
    const nomWow = ch.player || joueur
    const meme = ps.find((p) => p.characterId == null && sansAccent(p.name) === sansAccent(nomWow))
    out.push({ characterId: id, nom: ch.name, joueurWow: nomWow, occupation: ch.occupation, suggestion: meme?.id ?? null })
  }
  return out
}

/**
 * La réponse du MJ : un joueur de l'Écran (`playerId`), un nouveau joueur
 * (`nouveau` : son nom), ou personne (ni l'un ni l'autre).
 */
export function associer(characterId: number, choix: { playerId?: number | null; nouveau?: string | null }): void {
  let pid = choix.playerId ?? null
  const nouveau = choix.nouveau?.trim()
  if (!pid && nouveau) {
    /* Comme « Ajouter un joueur » : il entre au carnet du poste, puis dans la campagne. */
    const p = carnet.createCarnetPlayer(nouveau)
    pid = players.enrollPlayer(p.uid, p.name, p.color).id
  }
  if (pid) {
    players.setPlayerCharacter(pid, characterId)
  } else {
    reglages.poser(CLE_SANS_JOUEUR, JSON.stringify([...new Set([...sansJoueur(), characterId])]))
  }
  display.versMj('characters:relus', null)
  display.refreshJoueurs()
}

/** Le joueur WoW d'un personnage de l'Écran, s'il en a un. */
export function joueurDe(characterId: number): string | null {
  if (!isDbOpen()) return null
  const e = Object.entries(liens()).find(([, id]) => id === characterId)
  return e ? e[0] : null
}

/**
 * Le MJ a changé la fiche dans l'Écran : on l'envoie à l'Aventure.
 * `enLigne` : le joueur a son Aventure ouverte (on passe par sa boîte) ;
 * sinon, on écrit directement dans son fichier (personne ne l'a ouvert).
 */
export function versAventure(
  characterId: number,
  maj: MajFicheWow,
  ctx: { dossier: string; enLigne: boolean; deposer: (id: string, quoi: unknown) => void }
): boolean {
  const id = joueurDe(characterId)
  if (!id) return false
  attente.set(characterId, Date.now() + ATTENTE_MS)
  dernier.delete(characterId)
  if (ctx.enLigne) {
    ctx.deposer(id, {
      t: 'fiche',
      niveau: maj.niveau,
      portrait: maj.portrait,
      totaux: maj.totaux,
      pv: maj.pv,
      res: maj.res,
      car: maj.car,
      sexe: maj.sexe,
      age: maj.age,
      histoire: maj.histoire,
      argent: maj.argent ? argentPropre(maj.argent) : undefined
    })
    return true
  }
  const chemin = join(ctx.dossier, 'Sauvegardes', 'Joueurs', `${id}.json`)
  if (!existsSync(chemin)) return false
  try {
    const j = JSON.parse(readFileSync(chemin, 'utf8'))
    const perso = j?.progress?.perso
    if (!perso) return false
    if (maj.pv !== undefined && perso.pv) perso.pv.cur = Math.max(0, Math.round(maj.pv))
    if (maj.res !== undefined && perso.res) perso.res.cur = Math.max(0, Math.round(maj.res))
    /* Hors ligne, on ne connaît pas les bonus du moment : on décale les points
       de l'écart voulu par le MJ (nouvelle valeur moins l'ancienne). */
    if (maj.ecarts && perso.car) {
      for (const [k, d] of Object.entries(maj.ecarts))
        if (perso.car[k] && Number.isFinite(d)) perso.car[k].pt = (parseInt(perso.car[k].pt) || 0) + d
    }
    if (maj.niveau !== undefined && j.progress) j.progress.level = Math.max(1, Math.round(maj.niveau))
    if (maj.portrait !== undefined) perso.portrait = maj.portrait
    if (maj.totaux && Object.keys(maj.totaux).length)
      perso.courrierMj = [...(Array.isArray(perso.courrierMj) ? perso.courrierMj : []), { t: 'fiche', totaux: maj.totaux }]
    if (maj.sexe !== undefined) perso.sexe = maj.sexe
    if (maj.age !== undefined) perso.age = maj.age
    if (maj.histoire !== undefined) perso.histoire = maj.histoire
    if (maj.argent) perso.argent = { ...(perso.argent ?? {}), ...argentPropre(maj.argent) }
    j.savedAt = new Date().toISOString()
    writeFileSync(chemin, JSON.stringify(j))
    return true
  } catch {
    return false
  }
}

function argentPropre(a: ArgentWow): ArgentWow {
  const out: ArgentWow = {}
  for (const p of PIECES_WOW)
    if (a[p.key] !== undefined) out[p.key] = Math.max(0, Math.round(Number(a[p.key]) || 0))
  return out
}

/** La bourse de la fiche, dans la forme de l'Aventure. */
export function argentDe(ch: Character): ArgentWow {
  const b = ch.data.bourse ?? {}
  return argentPropre({ po: b.po ?? 0, pa: b.pa ?? 0, pc: b.pc ?? 0 })
}

/** Le sexe de la fiche, dans les mots de l'Aventure. */
export const sexeAventure = (s: Sexe | null): string => (s === 'femme' ? 'Femme' : s === 'homme' ? 'Homme' : '')

/**
 * Le MJ pose ou retire un effet depuis la fiche. La fiche de l'Écran le montre
 * tout de suite ; l'Aventure le reçoit dans sa boîte (en ligne) ou dans son
 * fichier (hors ligne).
 */
export function effetVersAventure(
  characterId: number,
  effet: EffetFicheWow,
  ctx: { dossier: string; enLigne: boolean; deposer: (id: string, quoi: unknown) => void }
): boolean {
  const id = joueurDe(characterId)
  const ch = chars.getCharacter(characterId)
  if (!id || !ch) return false
  attente.set(characterId, Date.now() + ATTENTE_MS)
  dernier.delete(characterId)
  /* La fiche de l'Écran suit sans attendre l'Aventure. */
  const auras = ch.data.aurasWow ?? []
  const apres =
    effet.t === 'aura'
      ? [
          ...auras.filter((a) => a.nom !== effet.aura.nom),
          { nom: effet.aura.nom, mal: effet.aura.mal, tours: effet.aura.tours | 0, pile: 0, lbl: '' }
        ]
      : auras.filter((a) => a.nom !== effet.nom)
  chars.upsertCharacter({ id: ch.id, templateId: ch.templateId, name: ch.name, data: { ...ch.data, aurasWow: apres } })
  display.versMj('characters:relus', null)
  if (ctx.enLigne) {
    ctx.deposer(id, effet)
    return true
  }
  const chemin = join(ctx.dossier, 'Sauvegardes', 'Joueurs', `${id}.json`)
  if (!existsSync(chemin)) return false
  try {
    const j = JSON.parse(readFileSync(chemin, 'utf8'))
    const perso = j?.progress?.perso
    if (!perso) return false
    const liste: { nom?: string }[] = Array.isArray(perso.auras) ? perso.auras : []
    perso.auras =
      effet.t === 'aura'
        ? [
            ...liste.filter((a) => a?.nom !== effet.aura.nom),
            {
              nom: effet.aura.nom,
              desc: effet.aura.desc ?? '',
              mal: effet.aura.mal,
              tours: effet.aura.tours | 0,
              pile: 0,
              lbl: '',
              de: 'MJ'
            }
          ]
        : liste.filter((a) => a?.nom !== effet.nom)
    j.savedAt = new Date().toISOString()
    writeFileSync(chemin, JSON.stringify(j))
    return true
  } catch {
    return false
  }
}

/**
 * Le MJ donne un objet du catalogue, ou en reprend un, depuis la fiche.
 * En ligne : la boîte du joueur. Hors ligne : le courrier de son fichier
 * (perso.courrierMj), que son Aventure ouvre au prochain lancement.
 */
export function objetVersAventure(
  characterId: number,
  envoi: { t: 'objet'; o: Record<string, unknown>; n: number } | { t: 'retireObjet'; nom: string; n: number },
  ctx: { dossier: string; enLigne: boolean; deposer: (id: string, quoi: unknown) => void }
): 'recu' | 'en-attente' | 'echec' {
  const id = joueurDe(characterId)
  if (!id) return 'echec'
  if (ctx.enLigne) {
    ctx.deposer(id, envoi)
    return 'recu'
  }
  const chemin = join(ctx.dossier, 'Sauvegardes', 'Joueurs', `${id}.json`)
  if (!existsSync(chemin)) return 'echec'
  try {
    const j = JSON.parse(readFileSync(chemin, 'utf8'))
    const perso = j?.progress?.perso
    if (!perso) return 'echec'
    perso.courrierMj = [...(Array.isArray(perso.courrierMj) ? perso.courrierMj : []), envoi]
    j.savedAt = new Date().toISOString()
    writeFileSync(chemin, JSON.stringify(j))
    return 'en-attente'
  } catch {
    return 'echec'
  }
}

/** Le MJ change le niveau sur la fiche : la fiche le garde, l'Aventure le reçoit. */
export function poserNiveau(characterId: number, niveau: number): Character | null {
  const ch = chars.getCharacter(characterId)
  if (!ch) return null
  const n = Math.max(1, Math.min(60, Math.round(niveau) || 1))
  const occupation = (ch.occupation ?? '').replace(/niv\. \d+/, `niv. ${n}`)
  return chars.upsertCharacter({
    id: ch.id,
    templateId: ch.templateId,
    name: ch.name,
    occupation: occupation || null,
    data: { ...ch.data, niveauWow: n }
  })
}

/**
 * Un envoi du MJ pour l'Aventure d'un joueur (un message, un objet…) : dans sa
 * boîte s'il est en ligne, sinon dans le courrier de son fichier, que son
 * Aventure ouvre au prochain lancement.
 */
export function courrierVersAventure(
  joueurWow: string,
  quoi: { t: string; [cle: string]: unknown },
  ctx: { dossier: string; enLigne: boolean; deposer: (id: string, quoi: unknown) => void }
): 'recu' | 'en-attente' | 'echec' {
  if (ctx.enLigne) {
    ctx.deposer(joueurWow, quoi)
    return 'recu'
  }
  const chemin = join(ctx.dossier, 'Sauvegardes', 'Joueurs', `${joueurWow}.json`)
  if (!existsSync(chemin)) return 'echec'
  try {
    const j = JSON.parse(readFileSync(chemin, 'utf8'))
    const perso = j?.progress?.perso
    if (!perso) return 'echec'
    perso.courrierMj = [...(Array.isArray(perso.courrierMj) ? perso.courrierMj : []), quoi]
    j.savedAt = new Date().toISOString()
    writeFileSync(chemin, JSON.stringify(j))
    return 'en-attente'
  } catch {
    return 'echec'
  }
}

/** Les personnages de l'Écran nés dans l'Aventure : joueur WoW → personnage. */
export function liensWow(): Record<string, number> {
  return isDbOpen() ? liens() : {}
}

/** Le MJ règle des totaux de combat sur la fiche : la fiche les montre aussitôt, l'Aventure suit. */
export function poserCombat(characterId: number, totaux: Record<string, number>): Character | null {
  const ch = chars.getCharacter(characterId)
  if (!ch) return null
  const c = ch.data.combatWow ?? { armure: 0, defense: 0, initiative: 0, resist: {} }
  const apres = { ...c, resist: { ...c.resist } }
  for (const [p, v] of Object.entries(totaux)) {
    const n = Math.round(Number(v) || 0)
    const m = /^total\.(armure|defense|initiative)$/.exec(p)
    const r = /^total\.resist\.(\w+)$/.exec(p)
    if (m) apres[m[1] as 'armure' | 'defense' | 'initiative'] = n
    else if (r) apres.resist[r[1]] = n
  }
  return chars.upsertCharacter({ id: ch.id, templateId: ch.templateId, name: ch.name, data: { ...ch.data, combatWow: apres } })
}
