/**
 * Une seule fiche par personnage WoW : celle de l'Aventure, que l'Écran tient
 * en miroir.
 *
 *  — **De l'Aventure vers l'Écran** : dès qu'un joueur a créé son personnage
 *    (prénom ou race posés par la création), l'Écran crée sa fiche de joueur
 *    (nom, joueur, « race classe », PV, ressource, les dix caractéristiques), et
 *    la tient à jour ensuite. Un joueur de l'Écran au même prénom la reçoit.
 *  — **De l'Écran vers l'Aventure** : le MJ qui change les PV, la ressource ou
 *    une caractéristique sur la fiche l'envoie à l'Aventure — dans sa boîte si
 *    le joueur est en ligne, directement dans son fichier sinon.
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
import { CARACS_WOW, type EtatWow, type JoueurWow, type PersoAAssocier } from '@shared/wow'
import type { CharacterData } from '@shared/types'

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
  return d
}

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
    const signature = JSON.stringify([nom, metier(e), data.gauges.pv, data.gauges.ressource, data.stats])
    if (dernier.get(ch.id) === signature) continue
    dernier.set(ch.id, signature)
    const avant = JSON.stringify([ch.name, ch.occupation, ch.data.gauges.pv, ch.data.gauges.ressource, ch.data.stats])
    if (avant === signature) continue
    chars.upsertCharacter({ id: ch.id, templateId: ch.templateId, name: nom, occupation: metier(e), data })
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
  maj: { pv?: number; res?: number; car?: Record<string, number>; ecarts?: Record<string, number> },
  ctx: { dossier: string; enLigne: boolean; deposer: (id: string, quoi: unknown) => void }
): boolean {
  const id = joueurDe(characterId)
  if (!id) return false
  attente.set(characterId, Date.now() + ATTENTE_MS)
  dernier.delete(characterId)
  if (ctx.enLigne) {
    ctx.deposer(id, { t: 'fiche', pv: maj.pv, res: maj.res, car: maj.car })
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
    j.savedAt = new Date().toISOString()
    writeFileSync(chemin, JSON.stringify(j))
    return true
  } catch {
    return false
  }
}
