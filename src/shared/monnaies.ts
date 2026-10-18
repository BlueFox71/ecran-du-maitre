/**
 * Les monnaies de la campagne.
 *
 * Elles appartiennent à **la campagne**, pas à sa fiche : elles vivent dans
 * `setting['monnaies']` et ne partent pas avec « Enregistrer cette fiche comme
 * modèle » (choix de Jules, 16 octobre 2026). Une campagne de 1920 paie en
 * dollars, une campagne de fantaisie en pièces d'or, d'argent et de bronze —
 * et une autre ne paie pas du tout : `actif` à faux efface la bourse et les
 * prix de partout, sans rien jeter de ce qui avait été saisi.
 *
 * Une bourse et un prix s'écrivent de la même façon : un nombre par clé de
 * monnaie. Une clé ne change jamais une fois posée — c'est elle que les
 * personnages et les objets retiennent, et renommer la monnaie ne doit rien
 * leur faire perdre.
 */

/** Les teintes d'une pièce dessinée, quand la monnaie n'a pas d'image. */
export const TEINTES_MONNAIE = {
  or: '#d8a94a',
  argent: '#b9c2c6',
  bronze: '#b0703f',
  cuivre: '#c46a3a',
  vert: '#6aa87c',
  bleu: '#5aa9c9',
  violet: '#8f7fc9'
} as const

export type TeinteMonnaie = keyof typeof TEINTES_MONNAIE

export interface Monnaie {
  /** Fixe pour toujours : les bourses et les prix la retiennent. */
  key: string
  /** « Pièce d'or », « Dollar ». */
  nom: string
  /** Ce qu'on lit sur un prix : « po », « $ ». */
  abbr: string
  /** La couleur de la pièce dessinée par défaut. */
  teinte: TeinteMonnaie
  /** Son image, prise dans la bibliothèque. Sans elle, la pièce dessinée. */
  imageItemId: number | null
  /**
   * Combien il en faut pour faire **une** de la monnaie d'au-dessus — « 1 po
   * = 10 pa » s'écrit `taux: 10` sur la pièce d'argent. `null` : pas de change,
   * elle vit seule. Sans objet sur la première, la plus forte.
   */
  taux: number | null
}

export interface ReglageMonnaies {
  /** Faux : la campagne n'a pas d'argent. Les montants saisis restent en base. */
  actif: boolean
  /** De la plus forte à la plus faible. */
  liste: Monnaie[]
}

/** Une bourse ou un prix : combien de chaque monnaie, par clé. */
export type Montants = Record<string, number>

/** La monnaie d'une campagne neuve, et celle dont héritent les prix d'avant. */
export const CLE_PIECE = 'piece'

export function monnaiesParDefaut(unite?: string | null, actif = false): ReglageMonnaies {
  const nom = unite?.trim() ? majuscule(unite.trim()) : 'Pièce'
  return {
    actif,
    liste: [{ key: CLE_PIECE, nom, abbr: abreviation(nom), teinte: 'or', imageItemId: null, taux: null }]
  }
}

/** Les points de départ proposés dans la fiche de campagne. */
export const MODELES_MONNAIE: { nom: string; liste: Omit<Monnaie, 'key'>[] }[] = [
  {
    nom: 'Pièces',
    liste: [{ nom: 'Pièce', abbr: 'p', teinte: 'or', imageItemId: null, taux: null }]
  },
  {
    nom: 'Dollars',
    liste: [
      { nom: 'Dollar', abbr: '$', teinte: 'vert', imageItemId: null, taux: null },
      { nom: 'Cent', abbr: '¢', teinte: 'cuivre', imageItemId: null, taux: 100 }
    ]
  },
  {
    nom: 'Fantaisie',
    liste: [
      { nom: 'Pièce d’or', abbr: 'po', teinte: 'or', imageItemId: null, taux: null },
      { nom: 'Pièce d’argent', abbr: 'pa', teinte: 'argent', imageItemId: null, taux: 10 },
      { nom: 'Pièce de bronze', abbr: 'pb', teinte: 'bronze', imageItemId: null, taux: 10 }
    ]
  }
]

/**
 * Relire le réglage tel que la base le garde.
 *
 * Jamais posé : une campagne neuve, **sans monnaie** — mais avec une « Pièce »
 * toute prête si le MJ en veut une. Posé sans liste (`{"actif": true}`, écrit
 * par la migration 66 pour les campagnes d'avant) : une seule monnaie, nommée
 * d'après l'ancienne unité de valeur des objets, celle où leurs prix ont été
 * repris.
 */
export function lireMonnaies(brut: string | undefined, unite?: string | null): ReglageMonnaies {
  if (!brut) return monnaiesParDefaut(unite, false)
  try {
    const v = JSON.parse(brut) as Partial<ReglageMonnaies>
    if (!Array.isArray(v.liste)) return monnaiesParDefaut(unite, v.actif !== false)
    const liste = Array.isArray(v.liste)
      ? v.liste
          .filter((m): m is Monnaie => !!m && typeof m.key === 'string' && m.key !== '')
          .map((m, i) => ({
            key: m.key,
            nom: String(m.nom ?? ''),
            abbr: String(m.abbr ?? ''),
            teinte: m.teinte in TEINTES_MONNAIE ? m.teinte : 'or',
            imageItemId: typeof m.imageItemId === 'number' ? m.imageItemId : null,
            taux: i > 0 && typeof m.taux === 'number' && m.taux >= 1 ? Math.round(m.taux) : null
          }))
      : []
    return { actif: v.actif !== false, liste }
  } catch {
    return monnaiesParDefaut(unite, false)
  }
}

/**
 * Les monnaies déjà posées sur les fiches : celles d'un réglage écrit avec sa
 * liste. Elles se renomment, se redessinent, changent de taux — elles ne se
 * suppriment plus, puisque des bourses et des prix y sont écrits.
 */
export function monnaiesPosees(brut: string | undefined): Set<string> {
  if (!brut) return new Set()
  try {
    const v = JSON.parse(brut) as Partial<ReglageMonnaies>
    if (!Array.isArray(v.liste)) return v.actif === false ? new Set() : new Set([CLE_PIECE])
    return new Set(v.liste.map((m) => m?.key).filter((k): k is string => typeof k === 'string'))
  } catch {
    return new Set()
  }
}

/** Les monnaies en usage : aucune quand la campagne n'a pas d'argent. */
export const monnaiesActives = (r: ReglageMonnaies): Monnaie[] => (r.actif ? r.liste : [])

/** Une clé neuve, qui ne reprend jamais celle d'une monnaie retirée. */
export function nouvelleCle(nom: string, prises: string[]): string {
  const base =
    nom
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'monnaie'
  let k = base
  for (let i = 2; prises.includes(k); i++) k = `${base}-${i}`
  return k
}

/** Chaque monnaie a son taux : on peut tout compter dans la plus petite. */
export const changeComplet = (liste: Monnaie[]): boolean =>
  liste.length > 1 && liste.slice(1).every((m) => m.taux != null && m.taux >= 1)

/** Ce que vaut une pièce de chaque monnaie, compté dans la plus petite. */
function facteurs(liste: Monnaie[]): number[] {
  const f = new Array<number>(liste.length).fill(1)
  for (let i = liste.length - 2; i >= 0; i--) f[i] = f[i + 1] * (liste[i + 1].taux ?? 1)
  return f
}

/** Tout ramené à la plus petite monnaie ; `null` si un taux manque. */
export function enPlusPetite(m: Montants, liste: Monnaie[]): number | null {
  if (liste.length === 0) return 0
  if (liste.length > 1 && !changeComplet(liste)) return null
  const f = facteurs(liste)
  return liste.reduce((t, x, i) => t + (m[x.key] ?? 0) * f[i], 0)
}

/** Un total rendu avec le moins de pièces possible, des plus fortes aux plus faibles. */
export function repartir(total: number, liste: Monnaie[]): Montants {
  const f = facteurs(liste)
  const out: Montants = {}
  let reste = Math.max(0, Math.round(total))
  liste.forEach((x, i) => {
    out[x.key] = Math.floor(reste / f[i])
    reste -= out[x.key] * f[i]
  })
  return out
}

/**
 * Payer `montant` dans la monnaie `cle`. Ce qui reste dans cette monnaie part
 * d'abord ; s'il n'y en a pas assez et que le change est réglé, on fait la
 * monnaie — la bourse est alors recomptée avec le moins de pièces possible.
 * Rend les écarts à appliquer, ou `null` si la bourse n'y suffit pas.
 */
export function payer(bourse: Montants, liste: Monnaie[], cle: string, montant: number): Montants | null {
  if (montant <= 0) return {}
  const a = bourse[cle] ?? 0
  if (a >= montant) return { [cle]: -montant }
  if (!changeComplet(liste)) return null
  const total = enPlusPetite(bourse, liste)!
  const i = liste.findIndex((x) => x.key === cle)
  if (i < 0) return null
  const prix = montant * facteurs(liste)[i]
  if (total < prix) return null
  return ecarts(bourse, repartir(total - prix, liste), liste)
}

/** La bourse recomptée avec le moins de pièces possible. */
export function regrouper(bourse: Montants, liste: Monnaie[]): Montants {
  const total = enPlusPetite(bourse, liste)
  if (total == null) return {}
  return ecarts(bourse, repartir(total, liste), liste)
}

function ecarts(avant: Montants, apres: Montants, liste: Monnaie[]): Montants {
  const d: Montants = {}
  for (const x of liste) {
    const e = (apres[x.key] ?? 0) - (avant[x.key] ?? 0)
    if (e !== 0) d[x.key] = e
  }
  return d
}

/** « 2 po 5 pa » ; vide si rien. Les monnaies retirées ne se lisent plus. */
export function ditMontant(m: Montants | null | undefined, liste: Monnaie[]): string {
  if (!m) return ''
  return liste
    .filter((x) => (m[x.key] ?? 0) !== 0)
    .map((x) => `${nombre(m[x.key])} ${x.abbr || x.nom}`)
    .join(' ')
}

/** Un montant sans rien : il ne mérite pas d'être gardé. */
export const montantVide = (m: Montants | null | undefined): boolean =>
  !m || Object.values(m).every((v) => !v)

const nombre = (n: number): string => n.toLocaleString('fr-FR')

function majuscule(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** « Pièces » → « p », « Francs » → « f » : une lettre suffit pour démarrer. */
function abreviation(nom: string): string {
  return nom.charAt(0).toLowerCase()
}
