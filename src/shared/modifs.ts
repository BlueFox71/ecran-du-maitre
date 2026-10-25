/**
 * Les bonus et malus du jet : ce qui s'ajoute au dé en plus de la carac.
 *
 * Deux sources, et rien d'autre :
 * - ce que le MJ pose sur un personnage — « Béni +2 », « Épuisé −1 partout » —
 *   pour le prochain jet, quelques jets, quelques tours, ou jusqu'à ce qu'il
 *   l'enlève ;
 * - ce que dit un objet **porté** (pas dans le sac) : un effet « +1 —
 *   Sang-froid » compte tant qu'il est sur lui.
 *
 * Le poste du MJ, le serveur et les téléphones font le même calcul : il vit
 * ici, comme le sac, pour qu'un jet vaille partout la même chose.
 */
import type { Objet } from './types'

/** Combien de temps il tient. */
export type DureeModif =
  /** Jusqu'à ce que le MJ le retire. */
  | { genre: 'retrait' }
  /** Encore `reste` jets qu'il touche ; « le prochain jet », c'est 1. */
  | { genre: 'jets'; reste: number }
  /** Encore `reste` rounds de combat ; la fin du combat l'efface. */
  | { genre: 'tours'; reste: number }

export interface Modif {
  id: string
  /** « +2 », « −1 » : jamais nul. */
  valeur: number
  /** Ce qu'on lit à côté : « Béni », « Jambe blessée ». */
  raison: string
  /** La carac qu'il touche ; `null`, tous les jets. */
  caracKey: string | null
  duree: DureeModif
}

/** Une ligne du compte d'un jet, telle que le joueur la lit. */
export interface LigneBonus {
  valeur: number
  raison: string
  source: 'modif' | 'objet'
}

const sansAccents = (t: string): string =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

/** « +1 », « -2 », « −2 » : la tête d'un effet qui est un bonus ; sinon `null`. */
export function valeurEffet(tete: string): number | null {
  const m = /^([+\-−])\s*(\d+)$/.exec(tete.trim())
  if (!m) return null
  const n = Number(m[2])
  return m[1] === '+' ? n : -n
}

/** Les mots qui veulent dire « sur tous les jets » dans le détail d'un effet. */
const PARTOUT = new Set(['', 'tout', 'tous', 'partout', 'jet', 'jets', 'tous les jets', 'aux jets'])

/** L'effet d'objet vise-t-il ce jet ? Le détail nomme la carac, son code, ou rien. */
function effetVise(detail: string, carac: { key: string; label: string; code?: string | null } | null): boolean {
  const d = sansAccents(detail)
  if (PARTOUT.has(d)) return true
  if (!carac) return false
  return [carac.key, carac.label, carac.code ?? ''].some((x) => x && sansAccents(x) === d)
}

const touche = (m: Modif, caracKey: string | null): boolean => m.caracKey == null || m.caracKey === caracKey

/**
 * Le compte d'un jet sur une carac : ses bonus et malus posés, puis ceux de ce
 * qu'il porte. Le modificateur de la carac n'y est pas — il se lit à part.
 */
export function bonusDuJet(
  modifs: Modif[] | undefined,
  objets: Objet[],
  characterId: number,
  carac: { key: string; label: string; code?: string | null } | null
): LigneBonus[] {
  const lignes: LigneBonus[] = (modifs ?? [])
    .filter((m) => touche(m, carac?.key ?? null))
    .map((m) => ({ valeur: m.valeur, raison: m.raison, source: 'modif' as const }))
  for (const o of objets) {
    const porte = o.placements.some((p) => p.characterId === characterId && p.emplacement)
    if (!porte) continue
    for (const e of o.effets) {
      const v = valeurEffet(e.tete)
      if (v && effetVise(e.detail, carac)) lignes.push({ valeur: v, raison: o.nom, source: 'objet' })
    }
  }
  return lignes
}

export const sommeBonus = (lignes: LigneBonus[]): number => lignes.reduce((n, l) => n + l.valeur, 0)

/** Un jet fait sur cette carac : ce qui comptait des jets en perd un. */
export function apresUnJet(modifs: Modif[] | undefined, caracKey: string | null): Modif[] {
  return (modifs ?? []).flatMap((m) =>
    m.duree.genre === 'jets' && touche(m, caracKey)
      ? m.duree.reste > 1
        ? [{ ...m, duree: { genre: 'jets' as const, reste: m.duree.reste - 1 } }]
        : []
      : [m]
  )
}

/** Un round de plus : ce qui comptait des tours en perd un. */
export function apresUnTour(modifs: Modif[] | undefined): Modif[] {
  return (modifs ?? []).flatMap((m) =>
    m.duree.genre === 'tours'
      ? m.duree.reste > 1
        ? [{ ...m, duree: { genre: 'tours' as const, reste: m.duree.reste - 1 } }]
        : []
      : [m]
  )
}

/** Le combat fini, ce qui se comptait en tours n'a plus de sens. */
export const apresLeCombat = (modifs: Modif[] | undefined): Modif[] =>
  (modifs ?? []).filter((m) => m.duree.genre !== 'tours')

/** « jusqu'au retrait », « 2 jets », « prochain jet », « 3 tours ». */
export function ditDuree(d: DureeModif): string {
  if (d.genre === 'retrait') return 'jusqu’au retrait'
  if (d.genre === 'jets') return d.reste === 1 ? 'prochain jet' : `${d.reste} jets`
  return d.reste === 1 ? 'dernier tour' : `${d.reste} tours`
}
