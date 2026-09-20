/**
 * Le portable des joueurs.
 *
 * Une table, ce sont des gens autour d'un écran — et chacun son téléphone dans
 * la poche. Ce module ouvre une petite porte sur le réseau local pour que
 * chaque joueur consulte sa fiche, note son dé et pousse son pion sans passer
 * par-dessus l'épaule du maître du jeu.
 *
 * Trois règles tiennent tout le reste :
 *
 *  — **Le réseau local, et rien d'autre.** Le serveur écoute sur le Wi-Fi de la
 *    maison. Rien ne sort, rien n'entre d'ailleurs, aucun compte nulle part.
 *  — **Le PC reste le maître.** Il ouvre l'accès quand il veut, le referme
 *    quand il veut, et voit qui est connecté. Un téléphone ne peut rien faire
 *    que le MJ n'ait autorisé.
 *  — **Un joueur n'agit que sur lui-même.** Sa fiche, son jet, son pion. Les
 *    jauges restent au MJ, qui les journalise ; l'écran gelé le reste.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import { randomBytes, randomUUID } from 'node:crypto'
import { extname, join, normalize } from 'node:path'
import { BrowserWindow, app } from 'electron'
import { toDataURL } from 'qrcode'
import { activeCampaignId, getDb, isDbOpen } from './db'
import { absOf, insideRoot } from './library'
import { vignettesDir } from './vault'
import { plageDemandee } from './plage'
import * as chars from './db/repos/characters'
import * as players from './db/repos/players'
import * as rolls from './db/repos/rolls'
import { listPionsVus, movePion, tournerPion } from './db/repos/pions'
import { calqueDe } from './db/repos/murs'
import { barrieres, pasContraint, type Pt } from '@shared/murs'
import type { PointMur } from '@shared/types'
import * as poche from './db/repos/pochette'
import * as objets from './db/repos/objets'
import * as carnet from './carnet'
import { lirePoste, type ReglagesPoste } from '@shared/reglages'
import * as display from './display'
import { EMPLACEMENTS_OBJET, etatDeVie } from '@shared/types'
import type { MobileInfo, MobileDevice, MobileNudge, MobilePing } from '@shared/types'

/**
 * Le port et le nombre d'appareils sont des réglages du poste : ils se lisent
 * au moment de s'en servir, jamais gardés dans une constante. Un port déjà
 * pris par un autre logiciel se change alors dans la fenêtre des paramètres,
 * au lieu de condamner les portables pour la soirée.
 */
const reglages = (): ReglagesPoste => lirePoste(carnet.reglagesPoste())
const PORT = (): number => reglages().port
/** Deux appareils par joueur par défaut : le portable et la tablette, pas la maisonnée. */
const MAX_APPAREILS = (): number => reglages().appareils
/** On dit « il déplace son pion » encore cinq secondes après son dernier geste. */
const REMUE_MS = 5000

let serveur: Server | null = null
/**
 * L'invitation : le code que porte le QR.
 *
 * Elle ne s'éteint pas toute seule. Un code qui périme, c'est un QR à refaire
 * chaque fois qu'un joueur arrive en retard ou change de téléphone — et le
 * réseau est celui de la maison, pas la rue. Elle vit tant que le projet est
 * ouvert, et le même code vaut toute la soirée.
 */
let invite: string | null = null
/** L'image du code, gardée : la remontrer ne doit pas la refabriquer. */
let qrImage: string | null = null
let mj: BrowserWindow | null = null

/** Les flux ouverts vers les téléphones, par jeton d'appareil. */
const flux = new Map<string, ServerResponse[]>()
/** Qui remue son pion en ce moment, et jusqu'à quand. */
const remuent = new Map<number, { nom: string; jusqua: number; minuteur: NodeJS.Timeout }>()

export function bindMjWindow(w: BrowserWindow): void {
  mj = w
}

/* ============================================================
   L'adresse à laquelle les joueurs nous trouvent
   ============================================================ */

/**
 * L'adresse du poste sur le réseau local.
 *
 * On ne garde que l'IPv4 d'une interface réelle. Les cartes virtuelles —
 * VirtualBox, WSL, Docker — portent des adresses qu'aucun téléphone ne sait
 * joindre : les proposer enverrait le joueur sur une page qui ne répond pas.
 */
export function adresses(): { nom: string; ip: string }[] {
  const suspectes = /(virtual|vmware|vethernet|wsl|docker|loopback|hyper-v|bluetooth)/i
  const candidates: { nom: string; ip: string }[] = []

  for (const [nom, liste] of Object.entries(networkInterfaces())) {
    for (const i of liste ?? []) {
      if (i.family !== 'IPv4' || i.internal) continue
      candidates.push({ nom, ip: i.address })
    }
  }

  const vraies = candidates.filter((c) => !suspectes.test(c.nom))
  /* Le Wi-Fi d'abord : c'est par lui que passent les téléphones. */
  const wifi = vraies.filter((c) => /(wi-?fi|wlan|sans fil|wireless)/i.test(c.nom))
  const reste = vraies.filter((c) => !wifi.includes(c))
  const douteuses = candidates.filter((c) => !vraies.includes(c))
  return [...wifi, ...reste, ...douteuses]
}

/**
 * L'adresse qu'on annonce.
 *
 * Le réglage du poste l'emporte s'il désigne une carte encore là : sur une
 * machine qui a deux réseaux, le QR ne peut en porter qu'un, et la devinette
 * envoyait le joueur sur celui qui ne répond pas.
 */
function adresseLocale(): string | null {
  const liste = adresses()
  const voulue = reglages().adresse
  if (voulue && liste.some((c) => c.ip === voulue)) return voulue
  return liste[0]?.ip ?? null
}

const baseUrl = (): string | null => {
  const ip = adresseLocale()
  return ip ? `http://${ip}:${PORT()}` : null
}

/* ============================================================
   Les appareils appairés
   ============================================================ */

function toDevice(r: any): MobileDevice {
  return {
    id: r.id,
    playerId: r.player_id,
    playerName: r.player_name,
    playerColor: r.player_color,
    characterName: r.character_name,
    label: r.label,
    pairedAt: r.paired_at,
    lastSeen: r.last_seen,
    /* « En ligne » ne se devine pas : c'est un flux ouvert, ou rien. */
    online: flux.has(r.token) && (flux.get(r.token)?.length ?? 0) > 0
  }
}

export function listDevices(): MobileDevice[] {
  if (!isDbOpen()) return []
  return (
    getDb()
      .prepare(
        `SELECT d.id, d.player_id, d.token, d.label, d.paired_at, d.last_seen,
                p.name AS player_name, p.color AS player_color, c.name AS character_name
           FROM mobile_device d
           JOIN player p ON p.id = d.player_id
      LEFT JOIN character c ON c.id = p.character_id
          WHERE p.campaign_id = ?
          ORDER BY p.ord, d.paired_at`
      )
      .all(activeCampaignId()) as any[]
  ).map(toDevice)
}

/**
 * Retâter la ligne d'un appareil et couper son flux. Dit si elle existait.
 *
 * Trois chemins mènent ici : le MJ qui déconnecte un téléphone, le téléphone
 * qui s'oublie lui-même, et le même téléphone qui revient se faire appairer
 * autrement. Aucun des trois ne doit laisser de ligne fantôme derrière lui :
 * elle compterait encore dans les deux appareils alloués au joueur.
 */
function supprimerAppareil(id: number): boolean {
  const db = getDb()
  const r = db.prepare(`SELECT token FROM mobile_device WHERE id = ?`).get(id) as
    | { token: string }
    | undefined
  if (!r) return false
  for (const res of flux.get(r.token) ?? []) res.end()
  flux.delete(r.token)
  db.prepare(`DELETE FROM mobile_device WHERE id = ?`).run(id)
  return true
}

export function revokeDevice(id: number): void {
  if (supprimerAppareil(id)) prevenirMj()
}

/** Le jeton présenté par un téléphone, s'il vaut encore quelque chose. */
function appareilDe(token: string | null): { id: number; playerId: number } | null {
  if (!token || !isDbOpen()) return null
  const r = getDb()
    .prepare(
      `SELECT d.id, d.player_id AS playerId FROM mobile_device d
         JOIN player p ON p.id = d.player_id
        WHERE d.token = ? AND p.campaign_id = ?`
    )
    .get(token, activeCampaignId()) as { id: number; playerId: number } | undefined
  if (r) {
    getDb().prepare(`UPDATE mobile_device SET last_seen = datetime('now') WHERE id = ?`).run(r.id)
  }
  return r ?? null
}

/**
 * La clé que le téléphone porte sur lui, telle qu'on accepte de la lire.
 *
 * Elle ne prouve rien — elle ne donne accès à rien : elle sert seulement à
 * reconnaître un appareil déjà venu. On la borne quand même, pour n'écrire en
 * base que ce qu'on a demandé.
 */
function cleAppareil(brut: unknown): string | null {
  return typeof brut === 'string' && /^[0-9a-f]{16,64}$/.test(brut) ? brut : null
}

/** La ligne de cet appareil dans la campagne ouverte, s'il en a une. */
function appareilParCle(cle: string): { id: number } | null {
  const r = getDb()
    .prepare(
      `SELECT d.id FROM mobile_device d
         JOIN player p ON p.id = d.player_id
        WHERE d.device_key = ? AND p.campaign_id = ?`
    )
    .get(cle, activeCampaignId()) as { id: number } | undefined
  return r ?? null
}

/* ============================================================
   Ouvrir et refermer
   ============================================================ */

export function info(): MobileInfo {
  return {
    running: serveur !== null,
    url: serveur ? baseUrl() : null,
    port: PORT(),
    inviteOpen: invite !== null,
    qr: qrImage,
    devices: listDevices(),
    maxPerPlayer: MAX_APPAREILS(),
    adresses: adresses(),
    adresse: adresseLocale()
  }
}

/** Le code gardé en base, et celui qu'on y écrit. */
function codeEnBase(): string | null {
  if (!isDbOpen()) return null
  const r = getDb()
    .prepare(`SELECT mobile_invite FROM campaign WHERE id = ?`)
    .get(activeCampaignId()) as { mobile_invite: string | null } | undefined
  return r?.mobile_invite ?? null
}

function garderCode(code: string | null): void {
  if (!isDbOpen()) return
  getDb()
    .prepare(`UPDATE campaign SET mobile_invite = ? WHERE id = ?`)
    .run(code, activeCampaignId())
}

/**
 * Rallume l'accès à l'ouverture d'un projet qui en avait un.
 *
 * Sans cela, les téléphones déjà appairés parleraient dans le vide jusqu'à ce
 * que le MJ pense à rouvrir le panneau — et il n'a aucune raison d'y penser,
 * puisque de son côté rien n'a l'air fermé.
 */
export async function restore(): Promise<void> {
  const code = codeEnBase()
  if (!code) return
  try {
    await open()
    console.log('[portable] accès rallumé pour cette campagne')
  } catch (e) {
    console.error('[portable] impossible de rallumer :', e)
  }
}

/** Démarre le serveur s'il dort, et ouvre l'accès des téléphones. */
export async function open(): Promise<{ info: MobileInfo; qr: string | null }> {
  if (!serveur) {
    serveur = createServer(router)
    await new Promise<void>((ok, ko) => {
      serveur!.once('error', ko)
      serveur!.listen(PORT(), '0.0.0.0', ok)
    }).catch((e) => {
      serveur = null
      throw new Error(`Impossible d'ouvrir le port ${PORT()} : ${String(e)}`)
    })
    console.log(`[portable] serveur ouvert sur ${baseUrl() ?? `le port ${PORT()}`}`)
  }

  /* Le même code d'une séance à l'autre : il dort en base, et ne se refabrique
     que s'il n'y en a jamais eu. */
  if (!invite) invite = codeEnBase() ?? randomBytes(4).toString('hex')
  garderCode(invite)

  const base = baseUrl()
  qrImage = base
    ? await toDataURL(`${base}/?i=${invite}`, {
        margin: 1,
        width: 420,
        color: { dark: '#0a1013', light: '#e7e2d4' }
      })
    : null

  prevenirMj()
  return { info: info(), qr: qrImage }
}

/**
 * Tendre le code à la table, ou le retirer.
 *
 * C'est un geste à part de l'ouverture de l'accès : l'accès reste ouvert toute
 * la séance, le code ne reste à l'écran que le temps que chacun scanne.
 */
export function showOnPlayers(on: boolean): MobileInfo {
  const base = baseUrl()
  if (on && qrImage && base) display.setQr({ dataUrl: qrImage, url: base.replace('http://', '') })
  else display.setQr(null)
  return info()
}

/**
 * Referme l'invitation. Les appareils déjà appairés restent connectés : on
 * ferme la porte d'entrée, on ne met personne dehors.
 */
export function closeInvite(): MobileInfo {
  invite = null
  qrImage = null
  garderCode(null)
  display.setQr(null)
  prevenirMj()
  return info()
}

/** Éteint tout — à la fermeture d'un projet ou de l'application. */
/**
 * Le port ou l'adresse viennent de changer dans les paramètres.
 *
 * On ne sait pas déplacer un serveur déjà ouvert : on le referme et on le
 * rouvre. Les téléphones appairés se reconnectent d'eux-mêmes — ils gardent
 * leur jeton — mais ils devront viser la nouvelle adresse, et c'est pourquoi
 * la fenêtre des paramètres le dit avant qu'on y touche.
 */
export async function reconfigurer(): Promise<MobileInfo> {
  if (!serveur) return info()
  const ouvert = invite !== null
  const code = invite
  serveur.close()
  serveur = null
  if (ouvert) {
    invite = code
    await open()
  }
  return info()
}

export function stop(): void {
  invite = null
  qrImage = null
  if (isDbOpen()) display.setQr(null)
  for (const liste of flux.values()) for (const res of liste) res.end()
  flux.clear()
  for (const r of remuent.values()) clearTimeout(r.minuteur)
  remuent.clear()
  serveur?.close()
  serveur = null
}

/* ============================================================
   Ce que le PC apprend des téléphones
   ============================================================ */

function versMj(canal: string, charge: unknown): void {
  if (mj && !mj.isDestroyed()) mj.webContents.send(canal, charge)
}

const prevenirMj = (): void => versMj('mobile:info', info())

/**
 * « Alexis déplace son pion. »
 *
 * Un déplacement, ce sont vingt messages par seconde ; on n'en fait qu'un seul
 * état, qui s'éteint cinq secondes après le dernier geste. Le MJ voit que ça
 * bouge sans que l'écran clignote à chaque pixel.
 */
function remue(playerId: number, nom: string): void {
  const avant = remuent.get(playerId)
  if (avant) clearTimeout(avant.minuteur)
  const minuteur = setTimeout(() => {
    remuent.delete(playerId)
    versMj('mobile:nudge', nudges())
  }, REMUE_MS)
  remuent.set(playerId, { nom, jusqua: Date.now() + REMUE_MS, minuteur })
  if (!avant) versMj('mobile:nudge', nudges())
}

const nudges = (): MobileNudge[] =>
  [...remuent.entries()].map(([playerId, r]) => ({ playerId, playerName: r.nom }))

/* ============================================================
   Ce que les téléphones apprennent du PC
   ============================================================ */

/** Pousse l'état à tous les téléphones. Appelé quand le PC change quelque chose. */
export function broadcast(): void {
  if (flux.size === 0 || !isDbOpen()) return
  for (const [token, liste] of flux) {
    const ap = appareilDe(token)
    if (!ap) continue
    const charge = JSON.stringify(etatJoueur(ap.playerId))
    for (const res of liste) res.write(`event: state\ndata: ${charge}\n\n`)
  }
}

/**
 * Tout ce qu'un téléphone affiche, en un seul objet : sa fiche, le lieu à
 * l'écran, les pions dessus. On ne lui envoie rien d'autre — ni la
 * préparation du MJ, ni ce que voient les autres.
 */
function etatJoueur(playerId: number) {
  const joueur = players.getPlayer(playerId)
  const perso = joueur?.characterId != null ? chars.getCharacter(joueur.characterId) : null
  const fiche = chars.campaignSheet()
  const d = display.getState()

  /* L'écran gelé fige aussi les téléphones : ce qu'ils montrent doit être ce
     que les joueurs ont sous les yeux, sinon l'application ment. */
  const placeId = d.frozen ? null : d.placeId
  /* Le téléphone est un écran de joueur : il ne reçoit que les pions vus. */
  const pions = placeId != null ? listPionsVus(placeId) : []

  return {
    campagne: nomCampagne(),
    joueur: joueur
      ? { id: joueur.id, nom: joueur.name, couleur: joueur.color }
      : null,
    perso: perso
      ? {
          id: perso.id,
          nom: perso.name,
          occupation: perso.occupation,
          age: perso.age,
          portrait: httpMedia(portraitDe(perso.portraitItemId)),
          jauges: fiche.spec.gauges.map((g) => ({
            key: g.key,
            label: g.label,
            color: g.color,
            ...(perso.data.gauges[g.key] ?? { value: 0, max: g.max })
          })),
          caracs: fiche.spec.stats.map((st) => ({
            key: st.key,
            label: st.label,
            code: st.code ?? null,
            valeur: perso.data.stats[st.key] ?? 0
          })),
          comps: fiche.spec.skills
            .filter((sk) => sk.key in perso.data.skills)
            .map((sk) => ({ key: sk.key, label: sk.label, valeur: perso.data.skills[sk.key] }))
        }
      : null,
    /*
     * Ce qu'on lui a mis en main. Les onglets d'abord, puis ses documents —
     * ceux de toute la table et ceux qui ne sont qu'à lui, jamais ceux d'un
     * autre : `pochetteDe` ne laisse pas passer la lettre du voisin, et c'est
     * là, pas dans l'interface, que la garantie doit tenir.
     *
     * Les onglets voyagent tels quels ; c'est le téléphone qui décide de les
     * montrer ou non, selon qu'il a de quoi en remplir plus d'un.
     */
    pochette: {
      onglets: poche.listOnglets().map((o) => ({ id: o.id, nom: o.name })),
      docs: poche.pochetteDe(playerId).map((x) => ({
        id: x.id,
        titre: x.item.title,
        genre: x.item.kind,
        url: httpMedia(x.item.relPath),
        /*
         * L'image gravée quand il y en a une — pour un PDF, c'est sa première
         * page (voir `examen.ts`) ; pour une vidéo, un arrêt sur image.
         *
         * Sinon le fichier lui-même, mais **seulement s'il est une image** :
         * autrement le téléphone recevait l'adresse d'un PDF dans une balise
         * `img`, et affichait l'icône de l'image cassée. Mieux vaut pas de
         * vignette du tout — la carte a un dessin pour ce cas.
         */
        vignette:
          httpVignette(x.item.id, x.item.thumbAt) ??
          (x.item.kind === 'image' ? httpMedia(x.item.relPath) : null),
        ongletId: x.ongletId,
        sien: x.playerId !== null,
        donneA: x.givenAt,
        lu: x.luPar.includes(playerId)
      }))
    },
    /*
     * Ses affaires, et les endroits du corps où il peut les mettre.
     *
     * Ce sont **ses** exemplaires, personne d'autre : la requête part de son
     * personnage, comme la pochette part de lui. Un téléphone ne voit jamais
     * le sac du voisin.
     */
    objets: perso ? objets.objetsDe(perso.id) : [],
    emplacements: EMPLACEMENTS_OBJET.map((e) => ({ cle: e.cle, nom: e.nom })),

    /* Le lieu et les pions ne sortent que si l'écran n'est pas gelé. */
    gele: d.frozen,
    lieu: placeId != null ? lieuVu(placeId) : null,
    pions: pions.map((p) => {
      /* L'état se lit sur la vie du personnage — la première jauge du gabarit,
         la même règle que sur l'écran des joueurs. Les pions qui ne sont à
         personne, PNJ et créatures, n'en ont pas à dire. */
      const sien = p.characterId != null ? chars.getCharacter(p.characterId) : null
      const vie = fiche.spec.gauges[0]
      return {
        id: p.id,
        label: p.label,
        initials: p.initials,
        color: p.color,
        x: p.x,
        y: p.y,
        /* Le cap : sans lui le téléphone ne saurait pas dessiner les regards,
           et l'ombre qu'il montrerait ne serait pas celle de la table. */
        rotation: p.rotation,
        characterId: p.characterId,
        url: httpMedia(relDeUrl(p.url)),
        mien: perso != null && p.characterId === perso.id,
        etat: etatDeVie(vie && sien ? sien.data.gauges[vie.key] : null)
      }
    }),
    /*
     * Le numéro du calque d'ombre. On ne pousse pas les murs dans le flux —
     * ils pèsent, et ils ne changent pas dix fois par seconde. Ce compteur
     * avance dès qu'une porte ou une lampe bouge, et le téléphone va relire
     * `/api/calque` quand il le voit changer. C'est exactement ce que fait la
     * fenêtre des joueurs.
     */
    calqueRev: d.calqueRev
  }
}

function nomCampagne(): string {
  const r = getDb().prepare(`SELECT name FROM campaign WHERE id = ?`).get(activeCampaignId()) as
    | { name: string }
    | undefined
  return r?.name ?? 'La campagne'
}

/**
 * Le lieu tel que le téléphone le montre : son nom, et son plan.
 *
 * Le plan sert de repère, pas de tableau : il s'affiche en fond effacé, pour
 * que les pions s'y détachent. Un petit écran tenu dans une pièce sombre ne
 * supporte pas deux choses qui réclament l'œil en même temps.
 */
function lieuVu(id: number): {
  id: number
  nom: string
  plan: string | null
  w: number | null
  h: number | null
} {
  const r = getDb()
    .prepare(
      `SELECT p.name, i.rel_path AS plan, i.width AS w, i.height AS h
         FROM place p LEFT JOIN item i ON i.id = p.map_item_id
        WHERE p.id = ?`
    )
    .get(id) as { name: string; plan: string | null; w: number | null; h: number | null } | undefined
  /*
   * La taille du plan, telle que le graveur l'a mesurée.
   *
   * Le téléphone en a besoin avant même d'avoir chargé l'image : c'est elle
   * qui donne ses proportions au cadre, et c'est dans ce repère-là que les
   * murs sont écrits. Sans elle, le cadre serait au petit bonheur et l'ombre
   * tomberait à côté de la carte.
   */
  return {
    id,
    nom: r?.name ?? 'Lieu',
    plan: httpMedia(r?.plan ?? null),
    w: r?.w ?? null,
    h: r?.h ?? null
  }
}

/**
 * Le repère dans lequel on calcule : les pixels du plan.
 *
 * Jamais les fractions — une carte n'est presque jamais carrée, et en
 * fractions un angle droit ne l'est plus : un pion glisserait le long d'un mur
 * en biais. Faute de mesure, un carré de mille : la géométrie reste juste pour
 * une carte carrée, et approchée pour les autres, ce qui vaut mieux que rien.
 */
function repereDuPlan(placeId: number): { w: number; h: number } {
  const l = lieuVu(placeId)
  return l.w && l.h ? { w: l.w, h: l.h } : { w: 1000, h: 1000 }
}

function portraitDe(itemId: number | null): string | null {
  if (itemId == null) return null
  const r = getDb().prepare(`SELECT rel_path FROM item WHERE id = ?`).get(itemId) as
    | { rel_path: string }
    | undefined
  return r?.rel_path ?? null
}

/** `jdr://media/x/y.png` redevient `x/y.png` : le téléphone ne connaît pas ce protocole. */
function relDeUrl(url: string | null): string | null {
  if (!url) return null
  const m = /^jdr:\/\/media\/(.*)$/.exec(url)
  return m ? decodeURIComponent(m[1]) : null
}

const httpMedia = (rel: string | null): string | null =>
  rel ? `/media/${rel.split('/').map(encodeURIComponent).join('/')}` : null

/**
 * La vignette gravée d'un document, pour le téléphone.
 *
 * Un PDF et une vidéo n'ont rien à montrer d'eux-mêmes dans une liste : c'est
 * l'examen qui leur a tiré une image (voir `examen.ts`), et elle dort à côté
 * de la base, hors de la bibliothèque. D'où une route à elle, jumelle de
 * l'hôte `jdr://vignette` que servent les fenêtres de l'application.
 *
 * La date de gravure suit, comme là-bas : sans elle, un téléphone garderait
 * l'ancienne image d'un fichier qui a changé.
 */
const httpVignette = (id: number, thumbAt: string | null): string | null =>
  thumbAt ? `/vignette/${id}.jpg?v=${encodeURIComponent(thumbAt)}` : null

/* ============================================================
   Les routes
   ============================================================ */

function router(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'local'}`)
  const chemin = url.pathname

  /*
   * En production, la page du téléphone vient de ce serveur : même origine,
   * rien à autoriser. En développement elle vient de Vite, sur un autre port,
   * et le navigateur refuserait les appels sans un mot de notre part. On
   * n'ouvre donc CORS que là, jamais dans l'application livrée.
   */
  if (!app.isPackaged) {
    res.setHeader('access-control-allow-origin', '*')
    res.setHeader('access-control-allow-headers', 'content-type')
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }
  }

  try {
    if (chemin === '/' || chemin === '/index.html') return pageMobile(res, url)
    if (chemin.startsWith('/media/')) return media(res, chemin.slice(7), req)
    if (chemin.startsWith('/vignette/')) return vignette(res, chemin.slice(10), req)
    if (chemin === '/api/table') return table(res, url)
    if (chemin === '/api/pair') return void lireJson(req, res, (b) => pair(res, url, b))
    if (chemin === '/api/stream') return stream(req, res, url)
    if (chemin === '/api/roll') return void lireJson(req, res, (b) => roll(res, url, b))
    if (chemin === '/api/calque') return calque(res, url)
    if (chemin === '/api/pion') return void lireJson(req, res, (b) => pion(res, url, b))
    if (chemin === '/api/ping') return void lireJson(req, res, (b) => ping(res, url, b))
    if (chemin === '/api/couleur') return void lireJson(req, res, (b) => couleur(res, url, b))
    if (chemin === '/api/pochette/lu') return void lireJson(req, res, (b) => pocheLu(res, url, b))
    if (chemin === '/api/equiper') return void lireJson(req, res, (b) => equiper(res, url, b))
    if (chemin === '/api/oublier') return void lireJson(req, res, () => oublier(res, url))
    if (chemin.startsWith('/assets/')) return statique(res, chemin, req)
    json(res, 404, { erreur: 'Rien ici.' })
  } catch (e) {
    console.error('[portable]', e)
    json(res, 500, { erreur: String(e) })
  }
}

function json(res: ServerResponse, code: number, charge: unknown): void {
  const corps = JSON.stringify(charge)
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  })
  res.end(corps)
}

function lireJson(
  req: IncomingMessage,
  res: ServerResponse,
  suite: (corps: any) => void
): void {
  if (req.method !== 'POST') return json(res, 405, { erreur: 'Méthode refusée.' })
  let brut = ''
  req.on('data', (c) => {
    brut += c
    /* Un téléphone n'envoie que quelques dizaines d'octets. Au-delà, on coupe. */
    if (brut.length > 8192) req.destroy()
  })
  req.on('end', () => {
    try {
      suite(brut ? JSON.parse(brut) : {})
    } catch {
      json(res, 400, { erreur: 'Requête illisible.' })
    }
  })
}

const jeton = (url: URL): string | null => url.searchParams.get('t')

function exige(res: ServerResponse, url: URL): { id: number; playerId: number } | null {
  const ap = appareilDe(jeton(url))
  if (!ap) {
    json(res, 401, { erreur: 'Cet appareil n’est plus reconnu.' })
    return null
  }
  return ap
}

/* ---------------- la page ---------------- */

/**
 * En développement, l'application du téléphone est servie par Vite : on y
 * renvoie, HMR compris. Une fois empaquetée, elle vit dans `out/renderer` et
 * c'est nous qui la servons.
 */
function pageMobile(res: ServerResponse, url: URL): void {
  const dev = !app.isPackaged && process.env.ELECTRON_RENDERER_URL
  if (dev) {
    const ip = adresseLocale()
    const vite = new URL(process.env.ELECTRON_RENDERER_URL!)
    const cible = `http://${ip ?? vite.hostname}:${vite.port}/mobile.html${url.search}`
    res.writeHead(302, { location: cible })
    res.end()
    return
  }
  envoyer(res, join(__dirname, '../renderer/mobile.html'))
}

function statique(res: ServerResponse, chemin: string, req: IncomingMessage): void {
  const f = join(__dirname, '../renderer', normalize(chemin).replace(/^([/\\])+/, ''))
  if (!f.startsWith(join(__dirname, '../renderer'))) return json(res, 403, { erreur: 'Interdit.' })
  envoyer(res, f, req)
}

/*
 * Ce qu'on sait nommer. Le reste part en `application/octet-stream`, et un
 * navigateur **télécharge** toujours ça au lieu de l'ouvrir : c'est la seule
 * chose qui manquait pour qu'un PDF de la pochette s'affiche sur un téléphone.
 *
 * La table couvre donc tout ce que la pochette peut porter — et aussi les sons,
 * qu'un lieu diffuse : il n'y a aucune raison de tenir une liste plus courte
 * que celle des fichiers que la campagne accepte (voir `kinds.ts`).
 */
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.opus': 'audio/opus',
  '.woff2': 'font/woff2'
}


/**
 * Servir un fichier du disque.
 *
 * Trois choses s'y jouent, et chacune a coûté une déconvenue :
 *
 *  — **le type.** Sans lui, `application/octet-stream`, et le navigateur
 *    télécharge au lieu d'ouvrir.
 *  — **« en place ».** `content-disposition: inline` le dit explicitement, et
 *    porte le nom du fichier : c'est celui que le lecteur de PDF affiche en
 *    titre, et celui que le téléphone proposera si le joueur l'enregistre.
 *  — **par morceaux.** Un iPhone ne joue une vidéo que si le serveur sait
 *    répondre à une demande de plage d'octets ; sans `accept-ranges`, la
 *    lecture ne démarre pas du tout. Le lecteur de PDF s'en sert aussi pour
 *    n'aller chercher que les pages qu'il affiche.
 */
function envoyer(res: ServerResponse, abs: string, req?: IncomingMessage): void {
  if (!existsSync(abs) || !statSync(abs).isFile()) return json(res, 404, { erreur: 'Introuvable.' })

  const taille = statSync(abs).size
  const ext = extname(abs).toLowerCase()
  const type = TYPES[ext] ?? 'application/octet-stream'
  const nom = abs.split(/[/\\]/).pop() ?? 'fichier'
  const enTetes: Record<string, string | number> = {
    'content-type': type,
    /* Le nom en clair pour les navigateurs anciens, et encodé pour les accents. */
    'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(nom)}`,
    'accept-ranges': 'bytes'
  }

  const plage = plageDemandee(req?.headers.range, taille)

  if (plage === false) {
    res.writeHead(416, { 'content-range': `bytes */${taille}` })
    return void res.end()
  }
  if (plage) {
    res.writeHead(206, {
      ...enTetes,
      'content-range': `bytes ${plage.debut}-${plage.fin}/${taille}`,
      'content-length': plage.fin - plage.debut + 1
    })
    return void createReadStream(abs, { start: plage.debut, end: plage.fin }).pipe(res)
  }

  res.writeHead(200, { ...enTetes, 'content-length': taille })
  createReadStream(abs).pipe(res)
}

/** Les images de la campagne, servies en lecture et jamais hors du dossier. */
function media(res: ServerResponse, rel: string, req: IncomingMessage): void {
  let abs: string
  try {
    abs = absOf(decodeURIComponent(rel))
  } catch {
    return json(res, 404, { erreur: 'Aucune campagne ouverte.' })
  }
  if (!insideRoot(abs)) return json(res, 403, { erreur: 'Interdit.' })
  envoyer(res, abs, req)
}

/** Les vignettes gravées, en lecture seule et par leur seul numéro. */
function vignette(res: ServerResponse, nom: string, req: IncomingMessage): void {
  const dir = vignettesDir()
  /* Le nom ne peut être qu'un nombre suivi de `.jpg` : rien à assainir, rien
     qui puisse remonter d'un dossier. */
  if (!dir || !/^\d+\.jpg$/.test(nom)) return json(res, 404, { erreur: 'Introuvable.' })
  envoyer(res, join(dir, nom), req)
}

/* ---------------- l'appairage ---------------- */

/** Qui joue à cette table — la seule chose qu'on montre sans jeton. */
function table(res: ServerResponse, url: URL): void {
  if (!isDbOpen()) return json(res, 503, { erreur: 'Aucune campagne ouverte sur le poste du MJ.' })

  /* Un appareil déjà appairé n'a pas à repasser par le QR. */
  const ap = appareilDe(jeton(url))
  if (ap) return json(res, 200, { appaire: true, etat: etatJoueur(ap.playerId) })

  if (!invite || url.searchParams.get('i') !== invite) {
    return json(res, 403, { erreur: 'ferme' })
  }

  json(res, 200, {
    appaire: false,
    campagne: nomCampagne(),
    joueurs: players.listPlayers().map((p) => {
      const perso = p.characterId != null ? chars.getCharacter(p.characterId) : null
      return {
        id: p.id,
        nom: p.name,
        couleur: p.color,
        perso: perso?.name ?? null,
        appareils: listDevices().filter((d2) => d2.playerId === p.id).length
      }
    })
  })
}

function pair(res: ServerResponse, url: URL, corps: any): void {
  if (!invite || (url.searchParams.get('i') ?? corps.invite) !== invite) {
    return json(res, 403, { erreur: 'L’accès est refermé. Demande au MJ de le rouvrir.' })
  }
  const playerId = Number(corps.playerId)
  const joueur = players.getPlayer(playerId)
  if (!joueur) return json(res, 404, { erreur: 'Ce joueur n’existe plus.' })

  /* Le même téléphone qui revient ne compte pas deux fois. Changer de joueur,
     c'est oublier son jeton — sa ligne, elle, doit céder la place à la
     nouvelle, fût-elle rangée chez quelqu'un d'autre. */
  const cle = cleAppareil(corps.appareil)
  const revenant = cle ? appareilParCle(cle) : null
  if (revenant) supprimerAppareil(revenant.id)

  const siens = listDevices().filter((d) => d.playerId === playerId)
  if (siens.length >= MAX_APPAREILS()) {
    return json(res, 409, {
      erreur: `${joueur.name} a déjà ses ${MAX_APPAREILS()} appareils. Déconnecte-en un, ou demande au MJ.`
    })
  }

  const token = randomUUID().replace(/-/g, '') + randomBytes(8).toString('hex')
  const label = siens.length === 0 ? 'téléphone' : 'tablette'
  getDb()
    .prepare(
      `INSERT INTO mobile_device (player_id, token, label, device_key) VALUES (?, ?, ?, ?)`
    )
    .run(playerId, token, label, cle)

  prevenirMj()
  json(res, 200, { token, etat: etatJoueur(playerId) })
}

/**
 * « Je l'ai ouvert. »
 *
 * Le téléphone le dit quand le joueur déplie un document, et le MJ voit sa
 * pastille se remplir. Le dépôt ne croit pas l'appareil sur parole : il
 * vérifie que ce document était bien pour lui avant d'en prendre note.
 */
function pocheLu(res: ServerResponse, url: URL, corps: any): void {
  const ap = exige(res, url)
  if (!ap) return
  const id = Number(corps.id)
  if (!Number.isFinite(id)) return json(res, 400, { erreur: 'Document illisible.' })
  poche.marquerLu(id, ap.playerId)
  /* Le MJ regarde la pochette pendant que ça se lit : sa page doit bouger. */
  versMj('pochette:changee', null)
  json(res, 200, { lu: true })
}

/**
 * Le téléphone rend son jeton.
 *
 * Sans cette route, « changer de joueur » n'effaçait le jeton que dans le
 * navigateur : la ligne restait en base, et l'appareil finissait par se voir
 * refuser sa propre place. Oublier ne se refuse pas — un jeton déjà périmé a
 * obtenu ce qu'il demandait.
 */
function oublier(res: ServerResponse, url: URL): void {
  const ap = appareilDe(jeton(url))
  if (ap && supprimerAppareil(ap.id)) prevenirMj()
  json(res, 200, { oublie: true })
}

/* ---------------- le flux ---------------- */

function stream(req: IncomingMessage, res: ServerResponse, url: URL): void {
  const ap = exige(res, url)
  if (!ap) return
  const token = jeton(url)!

  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-store',
    connection: 'keep-alive'
  })
  res.write(`event: state\ndata: ${JSON.stringify(etatJoueur(ap.playerId))}\n\n`)

  const liste = flux.get(token) ?? []
  liste.push(res)
  flux.set(token, liste)
  prevenirMj()

  /* Un commentaire toutes les vingt-cinq secondes : sans lui, le téléphone en
     veille ou un routeur bavard coupe la connexion sans prévenir. */
  const battement = setInterval(() => res.write(': .\n\n'), 25000)

  req.on('close', () => {
    clearInterval(battement)
    const reste = (flux.get(token) ?? []).filter((x) => x !== res)
    if (reste.length) flux.set(token, reste)
    else flux.delete(token)
    prevenirMj()
  })
}

/* ---------------- les trois gestes du joueur ---------------- */

/**
 * Un jet noté depuis le téléphone entre au journal comme celui du MJ : on fait
 * confiance au joueur, il annonce son dé à voix haute de toute façon. Le MJ en
 * est averti — c'est la seule chose qui arrive sans qu'il l'ait demandée.
 */
/**
 * Le joueur range une de ses affaires : sur lui, ou dans son sac.
 *
 * Il ne peut toucher qu'à **ses** exemplaires — on vérifie le porteur avant
 * tout, sinon un téléphone pourrait déshabiller le voisin. Un emplacement
 * inconnu est refusé plutôt qu'écrit : la liste des endroits du corps est
 * partagée, elle ne se devine pas.
 */
function equiper(res: ServerResponse, url: URL, corps: any): void {
  const ap = exige(res, url)
  if (!ap) return
  const joueur = players.getPlayer(ap.playerId)
  const perso = joueur?.characterId != null ? chars.getCharacter(joueur.characterId) : null
  if (!perso) return json(res, 409, { erreur: 'Aucun personnage ne t’est attribué.' })

  const placementId = Number(corps.placementId)
  const emplacement = corps.emplacement == null ? null : String(corps.emplacement)
  if (!Number.isInteger(placementId)) return json(res, 400, { erreur: 'Objet inconnu.' })
  if (objets.porteurDe(placementId) !== perso.id)
    return json(res, 403, { erreur: 'Cet objet n’est pas à toi.' })
  if (emplacement !== null && !EMPLACEMENTS_OBJET.some((e) => e.cle === emplacement))
    return json(res, 400, { erreur: 'Endroit du corps inconnu.' })

  if (emplacement === null) objets.desequiper(placementId)
  else objets.equiper({ characterId: perso.id, emplacement, objetId: objetDuPlacement(placementId) })

  /* Le poste du MJ suit, et les téléphones aussi — celui du joueur, qui vient
     d'agir, et son second appareil s'il en a un. */
  versMj('objets:changes', null)
  broadcast()
  json(res, 200, { ok: true })
}

/** L'objet d'un exemplaire — pour équiper, il faut dire lequel on pose. */
function objetDuPlacement(placementId: number): number {
  const r = getDb()
    .prepare(`SELECT objet_id AS objetId FROM objet_placement WHERE id = ?`)
    .get(placementId) as { objetId: number } | undefined
  return r?.objetId ?? 0
}

function roll(res: ServerResponse, url: URL, corps: any): void {
  const ap = exige(res, url)
  if (!ap) return
  const joueur = players.getPlayer(ap.playerId)
  const perso = joueur?.characterId != null ? chars.getCharacter(joueur.characterId) : null
  if (!perso) return json(res, 409, { erreur: 'Aucun personnage ne t’est attribué.' })

  const fiche = chars.campaignSheet()
  const carac = fiche.spec.stats.find((st) => st.key === String(corps.caracKey))
  const de = Number(corps.de)
  if (!carac) return json(res, 400, { erreur: 'Caractéristique inconnue.' })
  if (!Number.isInteger(de) || de < 1 || de > 20) return json(res, 400, { erreur: 'Valeur de dé impossible.' })

  const bonus = perso.data.stats[carac.key] ?? 0
  rolls.recordRoll({
    characterId: perso.id,
    label: carac.label,
    system: 'd20-plus',
    target: bonus,
    die: de
  })

  versMj('mobile:roll', {
    playerName: joueur!.name,
    characterName: perso.name,
    color: joueur!.color,
    label: carac.label,
    die: de,
    total: de + bonus
  })
  json(res, 200, { ok: true, total: de + bonus })
}

/**
 * Le calque d'ombre du lieu à l'écran : les murs, les ouvertures, les lampes.
 *
 * **C'est la seule chose de la préparation du MJ qui parte vers un téléphone**,
 * et elle ne part que pour être soustraite : le portable s'en sert à calculer
 * l'ombre qu'il pose par-dessus sa carte, exactement comme la fenêtre des
 * joueurs. On l'envoie plutôt que de renvoyer le polygone déjà taillé parce
 * que le regard suit le pouce : vingt allers-retours par seconde pour une
 * ombre qui doit coller au doigt, le Wi-Fi de la maison ne les tiendrait pas.
 *
 * Deux gardes, les mêmes que partout ailleurs : le lieu **réellement à
 * l'écran**, et rien du tout si le MJ a gelé. Un téléphone ne peut donc pas
 * demander le calque d'un lieu que la table n'a pas encore vu.
 */
function calque(res: ServerResponse, url: URL): void {
  const ap = exige(res, url)
  if (!ap) return
  const d = display.getState()
  if (d.frozen || d.placeId == null) return json(res, 200, null)
  json(res, 200, { placeId: d.placeId, ...calqueDe(d.placeId) })
}

/**
 * Le joueur pilote son pion. Il ne touche qu'au sien, et seulement sur le lieu
 * réellement à l'écran : l'écran gelé ne bouge plus, sinon le gel ne voudrait
 * plus rien dire.
 *
 * Deux gestes dans la même porte, parce que c'est le même pion et la même
 * permission : `x`/`y` le fait marcher, `cap` le fait pivoter, et un message
 * peut porter les deux — c'est ce qu'envoie un pouce qui pousse le disque
 * quand la carte se tourne en marchant.
 */
function pion(res: ServerResponse, url: URL, corps: any): void {
  const ap = exige(res, url)
  if (!ap) return
  const joueur = players.getPlayer(ap.playerId)
  const perso = joueur?.characterId != null ? chars.getCharacter(joueur.characterId) : null
  if (!perso) return json(res, 409, { erreur: 'Aucun personnage ne t’est attribué.' })

  const d = display.getState()
  if (d.frozen) return json(res, 409, { erreur: 'gele' })
  if (d.placeId == null) return json(res, 409, { erreur: 'Aucun lieu à l’écran.' })

  const mien = listPionsVus(d.placeId).find((p) => p.characterId === perso.id)
  if (!mien) return json(res, 409, { erreur: 'Ton pion n’est pas sur ce lieu.' })

  const veutMarcher = corps.x != null && corps.y != null
  const veutTourner = corps.cap != null

  if (veutTourner) {
    const cap = Number(corps.cap)
    if (!Number.isFinite(cap)) return json(res, 400, { erreur: 'Cap illisible.' })
    tournerPion(mien.id, cap)
  }

  if (veutMarcher) {
    const x = Number(corps.x)
    const y = Number(corps.y)
    if (!Number.isFinite(x) || !Number.isFinite(y))
      return json(res, 400, { erreur: 'Position illisible.' })
    const arrive = retenuParLesMurs(d.placeId, mien, {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y))
    })
    movePion(mien.id, arrive.x, arrive.y)
  }

  if (!veutMarcher && !veutTourner) return json(res, 400, { erreur: 'Rien à faire.' })

  /* `refreshPions` diffuse déjà, et sa diffusion passe par ici : un second
     `broadcast()` reconstruisait l'état de chaque téléphone pour rien, vingt
     fois par seconde pendant qu'un pouce marche. */
  display.refreshPions()
  remue(ap.playerId, joueur!.name)
  json(res, 200, { ok: true })
}

/**
 * Un pion ne traverse pas un mur — même poussé depuis un téléphone.
 *
 * La Régie retenait déjà le jeton qu'on lâche sur la carte, mais elle le
 * faisait dans la fenêtre du MJ : un pas venu du réseau entrait sans rien
 * rencontrer, et le portable était la porte dérobée du manoir. La retenue est
 * donc ici, au seuil, là où l'on ne peut pas l'oublier — et c'est la même
 * géométrie des deux côtés, `@shared/murs`, pas une seconde écriture qui
 * dériverait de la première.
 */
function retenuParLesMurs(
  placeId: number,
  pion: { x: number; y: number },
  vers: { x: number; y: number }
): { x: number; y: number } {
  const cal = calqueDe(placeId)
  if (!cal.murs.length) return vers
  const { w, h } = repereDuPlan(placeId)
  const enPx = (q: PointMur): Pt => ({ x: q[0] * w, y: q[1] * h })
  const arrive = pasContraint(
    barrieres(cal.murs, 'pas', enPx, cal.ouvertures),
    { x: pion.x * w, y: pion.y * h },
    { x: vers.x * w, y: vers.y * h },
    { w, h },
    2
  )
  return { x: arrive.x / w, y: arrive.y / h }
}

/**
 * Montrer un point du doigt — deux tapes sur le plan.
 *
 * L'onde part à l'écran des joueurs et aux autres téléphones, et rien n'est
 * gardé : c'est un geste de table, il vaut le temps qu'il dure. Comme le pion,
 * il ne passe pas si le MJ a figé l'écran.
 */
let suitePing = 0

function ping(res: ServerResponse, url: URL, corps: any): void {
  const ap = exige(res, url)
  if (!ap) return
  const joueur = players.getPlayer(ap.playerId)
  if (!joueur) return json(res, 404, { erreur: 'Joueur inconnu.' })

  const d = display.getState()
  if (d.frozen) return json(res, 409, { erreur: 'gele' })

  const x = Number(corps.x)
  const y = Number(corps.y)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return json(res, 400, { erreur: 'Point illisible.' })

  const onde: MobilePing = {
    id: ++suitePing,
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y)),
    color: joueur.color,
    playerName: joueur.name
  }

  display.sendPing(onde)
  versMj('mobile:ping', onde)
  /* Les autres téléphones la voient aussi : celui qui montre a souvent le nez
     sur son écran, pas sur celui de la table. */
  diffuserPing(onde)
  json(res, 200, { ok: true })
}

function diffuserPing(onde: MobilePing): void {
  const charge = JSON.stringify(onde)
  for (const liste of flux.values()) {
    for (const res of liste) res.write(`event: ping\ndata: ${charge}\n\n`)
  }
}

/** Sa couleur — celle de son pion et de son nom dans le journal. */
function couleur(res: ServerResponse, url: URL, corps: any): void {
  const ap = exige(res, url)
  if (!ap) return
  const teinte = String(corps.couleur ?? '')
  if (!/^[a-z]+$/.test(teinte)) return json(res, 400, { erreur: 'Couleur inconnue.' })

  /* Une couleur ne sert qu'une fois à la table. */
  const prise = players
    .listPlayers()
    .find((p) => p.id !== ap.playerId && p.color === teinte)
  if (prise) return json(res, 409, { erreur: `Cette couleur est déjà à ${prise.name}.` })

  players.updatePlayer(ap.playerId, { color: teinte })
  display.refreshJoueurs()
  versMj('mobile:changed', null)
  broadcast()
  json(res, 200, { ok: true })
}
