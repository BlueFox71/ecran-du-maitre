/**
 * Le jet d'un personnage, compté une seule fois pour tout le monde.
 *
 * Le téléphone du joueur et la saisie du MJ arrivent ici : le dé, le
 * modificateur de la carac, puis ses bonus et malus — posés par le MJ ou
 * portés sur lui. Ce qui se compte en jets en perd un au passage.
 */
import * as chars from './db/repos/characters'
import * as objets from './db/repos/objets'
import * as rolls from './db/repos/rolls'
import { modificateur, signe } from '@shared/jet'
import { apresUnJet, bonusDuJet, sommeBonus, type LigneBonus } from '@shared/modifs'
import type { Character, Roll, StatSpec } from '@shared/types'

/** Les caracs de sa fiche : son gabarit, sinon celui de la campagne. */
function caracsDe(perso: Character): StatSpec[] {
  const tpl = chars.listTemplates().find((t) => t.id === perso.templateId) ?? chars.campaignSheet()
  return tpl.spec.stats
}

/** Ce qu'un jet sur cette carac ajouterait au dé, sans rien user. */
export function compteDuJet(
  perso: Character,
  caracKey: string
): { carac: StatSpec; mod: number; lignes: LigneBonus[] } | null {
  const carac = caracsDe(perso).find((st) => st.key === caracKey)
  if (!carac) return null
  return {
    carac,
    mod: modificateur(perso.data.stats[carac.key] ?? 10),
    lignes: bonusDuJet(perso.data.modifs, objets.listObjets(), perso.id, carac)
  }
}

/** Les bonus de chaque carac, pour le téléphone qui les affiche avant le jet. */
export function bonusParCarac(perso: Character): Record<string, LigneBonus[]> {
  const tous = objets.listObjets()
  return Object.fromEntries(
    caracsDe(perso).map((c) => [c.key, bonusDuJet(perso.data.modifs, tous, perso.id, c)])
  )
}

/**
 * Noter le jet, et user ce qui se comptait en jets. Rend aussi le compte, que
 * le téléphone renvoie tel quel au joueur ; `null` si la carac n'existe pas.
 */
export function noterJet(
  perso: Character,
  caracKey: string,
  de: number
): { roll: Roll; mod: number; lignes: LigneBonus[]; bonus: number; total: number; use: boolean } | null {
  const c = compteDuJet(perso, caracKey)
  if (!c) return null
  const bonus = c.mod + sommeBonus(c.lignes)
  /* « d20=14 +3 FOR +2 Béni −1 Blessé » : le journal dit d'où vient chaque point. */
  const detail = [
    `d20=${de}`,
    `${signe(c.mod)} ${c.carac.code ?? c.carac.label}`,
    ...c.lignes.map((l) => `${signe(l.valeur)} ${l.raison}`)
  ].join(' ')
  const roll = rolls.recordRoll({
    characterId: perso.id,
    label: c.carac.label,
    system: 'd20-plus',
    target: bonus,
    die: de,
    detail
  })
  const apres = apresUnJet(perso.data.modifs, caracKey)
  const use = JSON.stringify(apres) !== JSON.stringify(perso.data.modifs ?? [])
  if (use) chars.setModifs(perso.id, apres)
  return { roll, mod: c.mod, lignes: c.lignes, bonus, total: de + bonus, use }
}
