import type { SkillSpec, StatSpec, TemplateSpec } from './types'

/**
 * La préparation du personnage : avant la séance, chaque joueur répartit ses
 * points sur ses caractéristiques, depuis son téléphone, en voyant son
 * modificateur bouger à chaque point posé.
 *
 * La règle est celle de l'achat de points de D&D 5e, ramenée à la fiche de la
 * campagne : tout part d'une même valeur, on a tant de points, on ne dépasse
 * pas un plafond. Un cran coûte 1 point, et 2 au-delà de 13 — c'est ce qui
 * empêche de tout jeter dans une seule caractéristique.
 *
 * Le téléphone, le poste du MJ et le serveur comptent ici : un joueur ne peut
 * pas valider ce que le serveur refuserait.
 */
export interface ReglePreparation {
  depart: number
  points: number
  plafond: number
  /** Les joueurs choisissent-ils aussi leurs compétences ? */
  competences: boolean
}

/**
 * 27 points pour les 6 caractéristiques de D&D : 40 en garde la mesure pour 9.
 * Le plafond monte à 20, celui de la table : le cran à 2 points au-delà de 13
 * suffit à rendre cher un 18.
 */
export const REGLE_PAR_DEFAUT: ReglePreparation = { depart: 8, points: 40, plafond: 20, competences: true }

export function regleDe(spec: TemplateSpec): ReglePreparation {
  const r = { ...REGLE_PAR_DEFAUT, ...(spec.preparation ?? {}) }
  /* Un plafond sous le départ ne laisserait rien à répartir : il le rejoint. */
  return {
    ...r,
    plafond: Math.max(r.plafond, r.depart),
    competences: r.competences && !spec.sansCompetences
  }
}

/** Ce que coûte le cran qui mène à `valeur` : 2 points à partir de 14. */
const cran = (valeur: number): number => (valeur >= 14 ? 2 : 1)

/** Ce que coûte une valeur, comptée depuis le départ. */
export function coutDe(valeur: number, depart: number): number {
  let n = 0
  for (let v = depart + 1; v <= valeur; v++) n += cran(v)
  return n
}

/** Le prix du point suivant, ou `null` au plafond. */
export function prochainCran(valeur: number, regle: ReglePreparation): number | null {
  return valeur >= regle.plafond ? null : cran(valeur + 1)
}

export function depense(stats: Record<string, number>, regle: ReglePreparation): number {
  return Object.values(stats).reduce((s, v) => s + coutDe(v, regle.depart), 0)
}

/**
 * Le nom en clair d'une caractéristique.
 *
 * Une fiche bien tenue porte l'abrégé dans `code` et le nom dans `label`.
 * Beaucoup n'ont que l'abrégé, écrit dans `label` : on le déplie alors avec
 * les noms d'usage, et un abrégé qu'on ne connaît pas reste tel quel.
 */
const NOMS: Record<string, string> = {
  FOR: 'Force',
  DEX: 'Dextérité',
  CON: 'Constitution',
  INT: 'Intelligence',
  SAG: 'Sagesse',
  CHA: 'Charisme',
  PER: 'Perception',
  EDU: 'Éducation',
  MVT: 'Mouvement',
  VLT: 'Volonté',
  VOL: 'Volonté',
  POU: 'Pouvoir',
  TAI: 'Taille',
  APP: 'Apparence'
}

export function abregeDe(st: StatSpec): string {
  return st.code?.trim() || st.label
}

export function nomComplet(st: StatSpec): string {
  if (st.code?.trim() && st.label.trim() !== st.code.trim()) return st.label
  return NOMS[st.label.trim().toUpperCase()] ?? st.label
}

/** « Dextérité » et « dexterite » se valent : on compare sans accents ni casse. */
const plat = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()

/**
 * Ce qu'une compétence exige, lu dans son nom : « Lampe UV — perception ≥ 11 ».
 *
 * La fiche n'a pas de champ pour cela, et le MJ l'écrit déjà ainsi. On ne
 * retient l'exigence que si elle nomme une caractéristique de la fiche ; une
 * autre (« occulte ≥ 13 », qui est une compétence) reste un texte à lire,
 * sans rien bloquer.
 */
export interface Exigence {
  /** Le nom sans l'exigence : « Lampe UV ». */
  nom: string
  /** L'exigence telle qu'écrite : « perception ≥ 11 ». */
  texte: string | null
  /** La caractéristique qu'elle vise, quand on l'a reconnue. */
  statKey: string | null
  min: number | null
}

export function exigenceDe(sk: SkillSpec, stats: StatSpec[]): Exigence {
  const m = sk.label.match(/^(.*?)\s*[—–-]\s*(.+?)\s*(?:≥|>=)\s*(\d+)\s*$/)
  if (!m) return { nom: sk.label, texte: null, statKey: null, min: null }
  const vise = plat(m[2])
  const st = stats.find((x) =>
    [x.key, x.label, x.code ?? '', nomComplet(x)].some((n) => n && plat(n) === vise)
  )
  return {
    nom: m[1],
    texte: `${m[2]} ≥ ${m[3]}`,
    statKey: st?.key ?? null,
    min: Number(m[3])
  }
}

/** La compétence est-elle à portée avec ces valeurs ? Une exigence non reconnue ne bloque pas. */
export function exigenceTenue(e: Exigence, stats: Record<string, number>): boolean {
  return e.statKey == null || e.min == null || (stats[e.statKey] ?? 0) >= e.min
}

/**
 * Ce que le serveur accepte d'écrire : chaque valeur dans les bornes, pas plus
 * de points qu'il n'y en a, des compétences qui existent, à portée, et dans la
 * limite de la fiche. Rend la raison du refus, ou `null`.
 */
export function refusDe(
  spec: TemplateSpec,
  stats: Record<string, number>,
  skills: string[]
): string | null {
  const regle = regleDe(spec)
  for (const st of spec.stats) {
    const v = stats[st.key]
    if (!Number.isInteger(v) || v < regle.depart || v > regle.plafond)
      return `${abregeDe(st)} doit rester entre ${regle.depart} et ${regle.plafond}.`
  }
  const propres = Object.fromEntries(spec.stats.map((st) => [st.key, stats[st.key]]))
  if (depense(propres, regle) > regle.points) return 'Plus de points que la règle n’en donne.'
  if (!regle.competences) return null
  const limite = spec.skillLimit ?? null
  if (limite != null && skills.length > limite) return `${limite} compétences au plus.`
  for (const k of skills) {
    const sk = spec.skills.find((x) => x.key === k)
    if (!sk) return 'Compétence inconnue.'
    if (!exigenceTenue(exigenceDe(sk, spec.stats), stats))
      return `${exigenceDe(sk, spec.stats).nom} : il manque des points.`
  }
  return null
}
