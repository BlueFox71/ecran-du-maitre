import type { TemplateSpec } from './types'

/**
 * Les règles du jeu que porte la fiche de campagne.
 *
 * Elles se règlent dans les Paramètres, plus dans l'éditeur de la fiche : un
 * brouillon ouvert avant qu'on les change en garde une copie périmée, qu'il
 * ne doit pas réécrire en appliquant sa composition.
 */
const REGLES = ['rollSystem', 'sansCompetences', 'skillLimit', 'sanityGauge'] as const

/**
 * Le brouillon de l'éditeur, avec les règles de la fiche courante. Une règle
 * absente de `courant` est absente du résultat : « absente » a un sens (la
 * devinette de la santé mentale, « autant qu'il veut »).
 */
export function fusionnerRegles(brouillon: TemplateSpec, courant: TemplateSpec): TemplateSpec {
  const r: Record<string, unknown> = { ...brouillon }
  for (const k of REGLES) {
    if (k in courant) r[k] = courant[k]
    else delete r[k]
  }
  return r as unknown as TemplateSpec
}
