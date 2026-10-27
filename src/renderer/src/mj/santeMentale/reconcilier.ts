import type { Modif } from '@shared/modifs'
import { modifsDuPalier, palierDe, palierPose, type Palier, type ReglageSm } from '@shared/santeMentale'
import type { Character } from '@shared/types'

/**
 * L'accord de la fiche avec son palier, en fonctions pures : `etat.ts` en
 * applique les effets (écriture, alerte, compte des hallucinations).
 *
 * Un défaire, une jauge retouchée à la main, un module allumé en cours de
 * campagne ou une app relancée laissent la fiche en retard sur sa SM : la
 * passe d'accord du tick la rattrape, sans attendre que le module la fasse
 * lui-même changer de palier.
 */

export interface Bilan {
  sm: number
  palier: Palier
  /** Les modifs à écrire ; `null` : la fiche porte déjà les malus de son palier. */
  modifs: Modif[] | null
  /** Le palier change : l'alerte à lever, et dans quel sens ; `null` sinon. */
  change: { montee: boolean } | null
}

/**
 * Ce que demande le palier de `c`. `avant` : la SM relue avant l'écriture qui
 * vient de passer ; `null` hors d'une écriture — le palier d'où l'on vient est
 * alors celui dont la fiche porte les malus. `null` sans jauge SM.
 */
export function bilanPalier(c: Character, avant: number | null, r: ReglageSm, cle: string): Bilan | null {
  const sm = c.data.gauges[cle]?.value
  if (sm === undefined) return null
  const palier = palierDe(sm, r.paliers)
  const modifs = c.data.modifs ?? []
  const voulu = modifsDuPalier(modifs, palier)
  const aEcrire = voulu !== modifs
  const ancien = avant === null ? null : palierDe(avant, r.paliers)
  const pose = palierPose(modifs, r.paliers)
  /* Un malus seulement retouché dans les Paramètres se réécrit sans alerte. */
  const parLaSm = ancien !== null && avant !== null && ancien.id !== palier.id
  const parLaFiche = aEcrire && pose?.id !== palier.id
  return {
    sm,
    palier,
    modifs: aEcrire ? voulu : null,
    change: parLaSm ? { montee: sm > (avant ?? sm) } : parLaFiche ? { montee: !!pose && palier.min > pose.min } : null
  }
}

export interface VueAccord {
  r: ReglageSm
  /** La clé de la jauge SM. */
  cle: string
  /** Les joueurs présents et en jeu. */
  joueurs: Character[]
  halluA: Record<number, number>
  /** Ceux dont une hallucination attend le MJ : leur compte ne repart qu'après. */
  enHallucination: Set<number>
}

/**
 * Qui, parmi les joueurs en jeu, n'a pas ce que son palier demande : ses
 * malus, ou un compte d'hallucinations qui court (ou ne devrait pas). Ne lit
 * que les copies du renderer : la plupart des secondes, il n'y a rien à faire,
 * et rien n'est demandé au main. Ceux qu'elle désigne sont relus et accordés
 * dans la file des écritures.
 */
export function aAccorder(v: VueAccord): number[] {
  return v.joueurs.flatMap((c) => {
    const b = bilanPalier(c, null, v.r, v.cle)
    if (!b) return []
    const compte = v.halluA[c.id] !== undefined
    const hallu = b.palier.hallucinations != null ? !compte && !v.enHallucination.has(c.id) : compte
    return b.modifs || hallu ? [c.id] : []
  })
}
