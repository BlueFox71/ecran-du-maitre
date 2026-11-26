/**
 * Ce que disent les outils qui parlent, pendant la soirée.
 *
 * Le MJ fait dire un texte à une spirit box, écrire un passage dans un livre,
 * glisser la goutte de la planche ; il montre le livre, la planche ou un
 * tirage de tarot à la table. Tout ceci vit ici, en mémoire, comme les
 * contrôles des appareils (`chasse.ts`) : rien n'a à survivre à la soirée, et
 * l'écriture d'un livre appartient au livre — celui qui le ramasse la lit.
 *
 * Qui voit quoi : le joueur qui tient l'outil en main, et — posé — chaque
 * joueur dont le pion est assez près, sans mur (`lisiblePar`, la règle de
 * l'EMF posé). Un outil rangé dans un sac ou porté sans pion est hors jeu.
 * Le son, lui, sort du PC (la fenêtre du MJ).
 */
import * as display from './display'
import * as mobile from './mobile'
import { etatDesAppareils, lisiblePar } from './chasse'
import { getObjet } from './db/repos/objets'
import type { AppareilChasse } from '@shared/chasse'
import {
  ECRITURE_DEFAUT,
  type FenetreChasse,
  type Goutte,
  type ParoleTelephone,
  type Passage,
  type TextePrepare
} from '@shared/parole'

type Parleur = 'spiritbox' | 'livre' | 'planche'
const parle = (o: string): o is Parleur => o === 'spiritbox' || o === 'livre' || o === 'planche'

/** Le dernier texte dit par chaque spirit box (par fiche d'objet). */
const dits = new Map<number, { texte: string; a: number }>()
/** Ce qui a été écrit dans chaque livre. */
const pages = new Map<number, Passage[]>()
/** Où va la goutte de chaque planche. */
const gouttes = new Map<number, Goutte>()
/** Ce qui est montré à la table : un livre, une planche, ou le tapis du tarot. */
let montre: { sorte: 'livre' | 'planche'; objetId: number; nom: string } | null = null
let tarot: { arcane: string; texte: string }[] = []
let numero = 0

/** Une soirée qui se termine (campagne fermée) : on oublie tout. */
export function oublier(): void {
  dits.clear()
  pages.clear()
  gouttes.clear()
  montre = null
  tarot = []
}

/* Les mots du refus, accordés à l'outil : la spirit box, le livre, la planche. */
const MOTS: Record<Parleur, { pronom: string; complement: string }> = {
  spiritbox: { pronom: 'Elle', complement: 'la' },
  livre: { pronom: 'Il', complement: 'le' },
  planche: { pronom: 'Elle', complement: 'la' }
}

/**
 * L'exemplaire en jeu de cette fiche : en main (pas dans un sac) ou posé sur
 * le plan. Sinon la raison, à montrer au MJ.
 */
function enJeu(objetId: number, outil: Parleur): AppareilChasse | string {
  const { appareils, sacs } = etatDesAppareils()
  const siens = appareils.filter((a) => a.objetId === objetId && a.outil === outil)
  const actif = siens.find((a) => a.ou !== 'ailleurs' && !sacs.has(a.placementId))
  if (actif) return actif
  if (siens.some((a) => sacs.has(a.placementId))) return `${MOTS[outil].pronom} est dans un sac.`
  return `Personne ne ${MOTS[outil].complement} tient.`
}

/** Après un geste : les téléphones et la table relisent. */
function diffuser(): void {
  display.setFenetreChasse(fenetreDeLaTable())
  mobile.broadcast()
}

/** La spirit box dit ce texte (la voix commence à l'instant). `null` : fait ; sinon la raison. */
export function dire(objetId: number, texte: string): string | null {
  const a = enJeu(objetId, 'spiritbox')
  if (typeof a === 'string') return a
  if (!a.allume) return 'Elle est éteinte.'
  const t = texte.trim()
  if (!t) return null
  dits.set(objetId, { texte: t, a: Date.now() })
  diffuser()
  return null
}

/** Une main invisible écrit ce texte dans le livre. `null` : fait ; sinon la raison. */
export function ecrire(objetId: number, t: TextePrepare): string | null {
  const a = enJeu(objetId, 'livre')
  if (typeof a === 'string') return a
  const texte = t.texte.trim()
  if (!texte) return null
  const passage: Passage = {
    id: ++numero,
    texte,
    ecriture: t.ecriture ?? ECRITURE_DEFAUT,
    taille: t.taille ?? 1,
    angle: t.angle ?? 0,
    debut: Date.now()
  }
  pages.set(objetId, [...(pages.get(objetId) ?? []), passage])
  diffuser()
  return null
}

/** La goutte glisse vers cette case (`spiritisme.ts`). `null` : fait ; sinon la raison. */
export function viser(objetId: number, caseId: string): string | null {
  const a = enJeu(objetId, 'planche')
  if (typeof a === 'string') return a
  const avant = gouttes.get(objetId)
  gouttes.set(objetId, { de: avant?.vers ?? '', vers: caseId, debut: Date.now() })
  diffuser()
  return null
}

/** Montrer un livre ou une planche à la table, ou les retirer (`null`). Le tarot a ses gestes à lui. */
export function montrer(f: { sorte: 'livre' | 'planche'; objetId: number } | null): void {
  montre = f ? { ...f, nom: getObjet(f.objetId)?.nom ?? (f.sorte === 'livre' ? 'Livre' : 'Planche') } : null
  if (montre) tarot = []
  diffuser()
}

/** Une carte de plus sur le tapis de la table, avec son texte. */
export function tirerTarot(arcane: string, texte: string): void {
  montre = null
  tarot = [...tarot, { arcane, texte }]
  diffuser()
}

export function retirerTarot(): void {
  tarot = []
  diffuser()
}

/** Ce que la table montre en ce moment, dans sa fenêtre ; `null` : rien. */
export function fenetreDeLaTable(): FenetreChasse | null {
  if (montre?.sorte === 'livre')
    return { sorte: 'livre', objetId: montre.objetId, nom: montre.nom, pages: pages.get(montre.objetId) ?? [] }
  if (montre?.sorte === 'planche')
    return { sorte: 'planche', objetId: montre.objetId, nom: montre.nom, goutte: gouttes.get(montre.objetId) ?? null }
  return tarot.length ? { sorte: 'tarot', cartes: tarot } : null
}

/** Les outils qui parlent que ce personnage voit : ceux qu'il tient, ceux posés près de lui. */
export function paroleDe(characterId: number | null): ParoleTelephone[] {
  if (characterId == null) return []
  const { appareils, sacs, ctx } = etatDesAppareils()
  const out: ParoleTelephone[] = []
  for (const a of appareils) {
    if (!parle(a.outil) || a.ou === 'ailleurs' || sacs.has(a.placementId)) continue
    /* En main : seulement celui qui le tient. Posé : tout joueur assez près. */
    if (a.ou === 'main' ? a.characterId !== characterId : !lisiblePar(a, characterId, ctx)) continue
    out.push({
      placementId: a.placementId,
      objetId: a.objetId,
      outil: a.outil,
      ...(a.outil === 'spiritbox' && dits.has(a.objetId) ? { dit: dits.get(a.objetId) } : {}),
      ...(a.outil === 'livre' ? { pages: pages.get(a.objetId) ?? [] } : {}),
      ...(a.outil === 'planche' && gouttes.has(a.objetId) ? { goutte: gouttes.get(a.objetId) } : {})
    })
  }
  return out
}
