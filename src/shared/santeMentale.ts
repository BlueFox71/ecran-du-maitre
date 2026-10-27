import type { Modif } from './modifs'

/** La règle de santé mentale (SM), en fonctions pures : le barème, les paliers, les valeurs de l'annexe. */

export interface Choc {
  id: string
  nom: string
  perte: number
}

export interface Palier {
  id: string
  nom: string
  /** Borne basse incluse ; le palier va jusqu'au min du palier au-dessus − 1. */
  min: number
  couleur: 'moss' | 'brass' | 'iris' | 'blood'
  texte: string
  /** `caracKey` nul : tous les jets. */
  malus: { valeur: number; caracKey: string | null }[]
  /** Cadence en minutes ; `null` : aucune. */
  hallucinations: number | null
}

/** `intervalleMin` nul : perte fixe ; sinon, perte à chaque intervalle (prix dans la durée). */
export interface Prix {
  id: string
  nom: string
  perte: number
  tous: boolean
  intervalleMin: number | null
}

export interface Recup {
  id: string
  nom: string
  /** Fixe (5) ou dé ('1d10'). */
  gain: number | string
  limite: 'scene' | 'nuit' | null
  pilule: boolean
  /** Arrête une folie passagère. */
  calme: boolean
}

export interface ReglageSm {
  actif: boolean
  carac: string
  seuil: number
  gain20: number
  partReussite: 'moitie' | 'tout' | 'rien'
  surcout1: number
  /** Triés du plus haut min au plus bas. */
  chocs: Choc[]
  paliers: Palier[]
  folie: { seuil: number; minutes: number; table: string[] }
  hallucinations: string[]
  prix: Prix[]
  recups: Recup[]
  jaugePilules: string | null
  nausee: { fenetreMin: number; malus: number; dureeMin: number }
  activite: { min: number; texte: string }[]
  rappels: string[]
}

export interface EvenementSm {
  id: number
  sessionId: number
  ord: number
  nom: string
  note: string | null
  perte: number
  jet: boolean
  tous: boolean
}

export const SM_DEFAUT: ReglageSm = {
  actif: false,
  carac: 'vlt',
  seuil: 12,
  gain20: 2,
  partReussite: 'moitie',
  surcout1: 5,
  chocs: [
    { id: 'petit', nom: 'Petit', perte: 3 },
    { id: 'moyen', nom: 'Moyen', perte: 5 },
    { id: 'gros', nom: 'Gros', perte: 10 },
    { id: 'terreur', nom: 'Terreur', perte: 15 }
  ],
  paliers: [
    { id: 'stable', nom: 'Stable', min: 76, couleur: 'moss', texte: 'Rien.', malus: [], hallucinations: null },
    {
      id: 'ebranle',
      nom: 'Ébranlé',
      min: 51,
      couleur: 'brass',
      texte: 'Ses mains tremblent. Décris-lui un détail de plus qu’aux autres (un froid, une odeur, un bruit).',
      malus: [{ valeur: -1, caracKey: 'dex' }],
      hallucinations: null
    },
    {
      id: 'hallucinations',
      nom: 'Hallucinations',
      min: 26,
      couleur: 'iris',
      texte: 'Passe-lui un mot. Les entités le remarquent.',
      malus: [{ valeur: -2, caracKey: 'per' }],
      hallucinations: 15
    },
    {
      id: 'terreur',
      nom: 'Terreur',
      min: 1,
      couleur: 'blood',
      texte:
        'Des objets bougent autour de lui. Pour rester seul ou entrer dans une pièce sombre : jet de Volonté (12+), sinon il refuse. Cible préférée des entités.',
      malus: [{ valeur: -2, caracKey: null }],
      hallucinations: 15
    },
    {
      id: 'rupture',
      nom: 'Rupture',
      min: 0,
      couleur: 'blood',
      texte:
        'Hallucinations sans arrêt. N’agit que si un ami reste à côté et lui parle. Ne meurt pas de sa SM. Remonte avec une pilule ou un ami qui le calme.',
      malus: [{ valeur: -2, caracKey: null }],
      hallucinations: 15
    }
  ],
  folie: {
    seuil: 10,
    minutes: 5,
    table: [
      'Il se fige, il faut le tirer par le bras.',
      'Il fuit en courant, droit devant, et lâche ce qu’il tient.',
      'Il hurle : les Ombres savent où il est et viennent vers lui.',
      'Il rit nerveusement et ne peut pas parler sérieusement.',
      'Il se colle au mur, sa lampe serrée contre lui, et refuse d’avancer.',
      'Il croit qu’un des autres joueurs est la bête et refuse de lui tourner le dos.'
    ]
  },
  hallucinations: [
    'On chante ton prénom tout bas, en espagnol.',
    'Une main froide se pose sur ton épaule. Personne derrière toi.',
    'Une corde pend de la rampe de l’escalier. Quand tu regardes à nouveau, elle n’y est plus.',
    'Des pas te suivent. Ils s’arrêtent quand tu t’arrêtes.',
    'Tu sens de la neige fondre sur ton visage. À l’intérieur.',
    'Quelqu’un tousse dans le noir, juste derrière toi.',
    'Ta lampe passe sur un lit : quelqu’un y est assis. Tu reviens dessus, le lit est vide.',
    'Des voix comptent, très loin : quatorze… contre trois.'
  ],
  prix: [
    { id: 'separe', nom: 'Séparé du groupe ou sans lumière', perte: 1, tous: false, intervalleMin: 10 },
    { id: 'seul-noir', nom: 'Seul dans le noir complet', perte: 2, tous: false, intervalleMin: 1 },
    { id: 'manque-respect', nom: 'Manque de respect', perte: 5, tous: true, intervalleMin: null },
    { id: 'colere-sept', nom: 'Colère des sept (−15 si les deux objets)', perte: 10, tous: true, intervalleMin: null },
    { id: 'spirit-box', nom: 'Parler au Démon par la spirit box', perte: 5, tous: false, intervalleMin: 5 },
    { id: 'ouija-fini', nom: 'Ouija fini sans « au revoir »', perte: 10, tous: false, intervalleMin: null },
    { id: 'ouija-rate', nom: 'Ouija raté', perte: 10, tous: false, intervalleMin: null },
    { id: 'pentacle', nom: 'Pentacle au grenier, rires du Démon', perte: 10, tous: false, intervalleMin: null }
  ],
  recups: [
    { id: 'pilule', nom: 'Pilule', gain: '1d10', limite: null, pilule: true, calme: false },
    { id: 'encens', nom: 'Encens béni ou prière réussie', gain: 5, limite: 'scene', pilule: false, calme: false },
    { id: 'chapelle', nom: 'Calme à la chapelle (10 min)', gain: 5, limite: 'nuit', pilule: false, calme: false },
    { id: 'ami', nom: 'Un ami le rassure (CHA 12+)', gain: 0, limite: null, pilule: false, calme: true },
    { id: 'fin-heureuse', nom: 'Fin heureuse', gain: 10, limite: null, pilule: false, calme: false }
  ],
  jaugePilules: 'pilules',
  nausee: { fenetreMin: 30, malus: -2, dureeMin: 30 },
  activite: [
    { min: 70, texte: 'Seulement les déclencheurs prévus (coupures, manques de respect, outils).' },
    {
      min: 50,
      texte: 'En plus, un petit phénomène toutes les 15 min (pas au-dessus, lanterne, porte entrouverte, froid).'
    },
    {
      min: 30,
      texte: 'Le générateur lâche après 30 min au lieu de 40 ; les Ombres restent au bord du faisceau même éclairées.'
    },
    { min: 0, texte: 'Le Démon parle dans les talkies même sans coupure ; les Ombres attaquent dès qu’une lampe faiblit.' }
  ],
  rappels: [
    'Toute l’équipe dans la même pièce éclairée : aucune perte due à l’ambiance.',
    'Modificateurs de situation : joueur isolé −3, lumière ou bougie près de lui +2.'
  ]
}

/** Le barème de Harrow Mill, rangé sous la séance active à l'activation. */
export const EVENEMENTS_DEFAUT: Omit<EvenementSm, 'id' | 'sessionId' | 'ord'>[] = [
  { nom: 'Pas au-dessus, à l’entrée', note: null, perte: 3, jet: true, tous: false },
  { nom: 'Première coupure du générateur', note: 'Tous', perte: 3, jet: true, tous: true },
  { nom: 'Ombres au bord du faisceau', note: null, perte: 5, jet: true, tous: false },
  { nom: 'Une Ombre attaque (noir complet)', note: 'Et 1D6 PV', perte: 10, jet: true, tous: false },
  { nom: 'Première vision dans un miroir', note: null, perte: 5, jet: true, tous: false },
  { nom: 'Vision du médium à l’enclume', note: null, perte: 10, jet: false, tous: false },
  { nom: 'Griffures, touffe de poil et fil rouge', note: null, perte: 3, jet: true, tous: false },
  { nom: 'Les yeux verts au fond du couloir', note: null, perte: 10, jet: true, tous: false },
  { nom: 'Silhouette à la caméra thermique', note: null, perte: 5, jet: true, tous: false },
  { nom: 'Photo au flash du Démon', note: null, perte: 10, jet: true, tous: false },
  { nom: 'Corde refusée qui se dénoue', note: 'Tous', perte: 3, jet: true, tous: true },
  { nom: 'Climax : 8 s de noir, un ami possédé', note: 'Tous sauf le possédé', perte: 15, jet: true, tous: true },
  { nom: 'Le Démon saute sur un deuxième joueur', note: null, perte: 15, jet: false, tous: false },
  { nom: 'Fin d’une possession', note: null, perte: 20, jet: false, tous: false },
  { nom: 'Fin malheureuse', note: 'Tous', perte: 10, jet: false, tous: true }
]

const tableau = <T>(v: unknown, defaut: T[]): T[] => (Array.isArray(v) ? (v as T[]) : defaut)
const nonVide = (v: unknown, champs: Record<string, 'number' | 'string'>): boolean =>
  Array.isArray(v) &&
  v.length > 0 &&
  v.every((x) => x && typeof x === 'object' && Object.entries(champs).every(([k, t]) => typeof x[k] === t))
/** Une liste d'objets aux champs requis, sinon le défaut : un réglage abîmé ne casse pas l'écran. */
const liste = <T>(v: unknown, defaut: T[], champs: Record<string, 'number' | 'string'>): T[] =>
  nonVide(v, champs) ? (v as T[]) : defaut
const objet = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
const nombre = (v: unknown, defaut: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : defaut)

/** Relit le réglage rangé : champ par champ, ce qui manque ou est abîmé reprend le défaut. */
export function lireSm(json: string | undefined): ReglageSm {
  let brut: Record<string, unknown> = {}
  if (json) {
    try {
      brut = objet(JSON.parse(json))
    } catch {
      brut = {}
    }
  }
  const d = structuredClone(SM_DEFAUT)
  const folie = objet(brut.folie)
  const nausee = objet(brut.nausee)
  const part = brut.partReussite
  return {
    actif: typeof brut.actif === 'boolean' ? brut.actif : d.actif,
    carac: typeof brut.carac === 'string' ? brut.carac : d.carac,
    seuil: nombre(brut.seuil, d.seuil),
    gain20: nombre(brut.gain20, d.gain20),
    partReussite: part === 'moitie' || part === 'tout' || part === 'rien' ? part : d.partReussite,
    surcout1: nombre(brut.surcout1, d.surcout1),
    chocs: liste(brut.chocs, d.chocs, { nom: 'string', perte: 'number' }),
    paliers: [...liste<Palier>(brut.paliers, d.paliers, { min: 'number', nom: 'string' })].sort((a, b) => b.min - a.min),
    folie: {
      seuil: nombre(folie.seuil, d.folie.seuil),
      minutes: nombre(folie.minutes, d.folie.minutes),
      table: tableau(folie.table, d.folie.table)
    },
    hallucinations: tableau(brut.hallucinations, d.hallucinations),
    prix: liste(brut.prix, d.prix, { nom: 'string', perte: 'number' }),
    recups: liste(brut.recups, d.recups, { nom: 'string' }),
    jaugePilules:
      brut.jaugePilules === null || typeof brut.jaugePilules === 'string' ? brut.jaugePilules : d.jaugePilules,
    nausee: {
      fenetreMin: nombre(nausee.fenetreMin, d.nausee.fenetreMin),
      malus: nombre(nausee.malus, d.nausee.malus),
      dureeMin: nombre(nausee.dureeMin, d.nausee.dureeMin)
    },
    activite: tableau(brut.activite, d.activite),
    rappels: tableau(brut.rappels, d.rappels)
  }
}

/** Ce que le jet de Volonté laisse de la perte `perte`. Négatif : un gain (20 naturel). */
export function perteApresJet(perte: number, de: number, total: number, r: ReglageSm): number {
  if (de === 20) return -r.gain20
  if (de === 1) return perte + r.surcout1
  if (total >= r.seuil) {
    if (r.partReussite === 'moitie') return Math.ceil(perte / 2)
    return r.partReussite === 'rien' ? 0 : perte
  }
  return perte
}

/** Le premier palier (du plus haut min) dont le min ≤ sm ; à défaut, le plus bas. */
export function palierDe(sm: number, paliers: Palier[]): Palier {
  const tries = [...paliers].sort((a, b) => b.min - a.min)
  return tries.find((p) => p.min <= sm) ?? tries[tries.length - 1]
}

const PREFIXE = 'sm-palier-'

/** Retire les malus posés par le module et pose ceux du palier ; ceux du même palier, déjà là, ne se cumulent pas. */
export function modifsDuPalier(modifs: Modif[] | undefined, palier: Palier): Modif[] {
  const liste = modifs ?? []
  const miens = liste.filter((m) => m.id.startsWith(PREFIXE))
  const ceux = `${PREFIXE}${palier.id}-`
  if (miens.length === palier.malus.length && miens.every((m) => m.id.startsWith(ceux))) return liste
  return [
    ...liste.filter((m) => !m.id.startsWith(PREFIXE)),
    ...palier.malus.map(
      (b, i): Modif => ({
        id: `${ceux}${i}`,
        valeur: b.valeur,
        raison: `SM — ${palier.nom}`,
        caracKey: b.caracKey,
        duree: { genre: 'retrait' }
      })
    )
  ]
}

/** Une perte réellement retirée d'un coup qui déclenche le second jet de folie. */
export function estFolie(perteReelle: number, r: ReglageSm): boolean {
  return perteReelle >= r.folie.seuil
}

/** Le joueur à la SM la plus basse (le premier, à égalité) ; `null` sans joueur. */
export function cibleDesEntites(joueurs: { id: number; sm: number }[]): number | null {
  let cible: { id: number; sm: number } | null = null
  for (const j of joueurs) if (!cible || j.sm < cible.sm) cible = j
  return cible ? cible.id : null
}

/** La ligne d'activité de la tranche où tombe la moyenne ; `null` si aucune. */
export function activiteDe(moyenne: number, r: ReglageSm): string | null {
  const tranche = [...r.activite].sort((a, b) => b.min - a.min).find((t) => t.min <= moyenne)
  return tranche ? tranche.texte : null
}

/** Un gain fixe (5) ou au dé ('1d10'), `d(faces)` donnant un dé. Une forme illisible ne rend rien. */
export function tirerGain(gain: number | string, d: (faces: number) => number): number {
  if (typeof gain === 'number') return gain
  const m = /^\s*(\d*)d(\d+)\s*$/i.exec(gain)
  if (!m) return Number(gain) || 0
  let somme = 0
  for (let i = 0; i < (m[1] === '' ? 1 : Number(m[1])); i++) somme += d(Number(m[2]))
  return somme
}
