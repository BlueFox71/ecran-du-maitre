/**
 * Un téléphone abonné au flux du PC — la contre-pression, et le poids de ce
 * qu'on lui envoie.
 *
 * Le piège, mesuré : un téléphone écran éteint garde souvent sa connexion
 * Wi-Fi. Son système accuse réception, mais la page ne lit plus rien ; la
 * connexion ne se ferme donc jamais. Écrire sans regarder empilait alors chaque
 * état dans la mémoire du PC — un état entier (~50 Ko, la pochette surtout) à
 * chaque pas de pion, pour chaque téléphone endormi : +120 Mo par minute de
 * marche. Au bout de quelques heures de séance, le PC ramait, et les
 * animations arrivaient trop tard pour se jouer.
 *
 * D'où ces règles :
 *  - **l'état est un instantané** : tant que le téléphone n'a pas avalé le
 *    précédent, on ne garde que le dernier. Il ne perd rien — il saute
 *    seulement les images intermédiaires ;
 *  - **seulement ce qui change** : une page qui le comprend (`patchs`) reçoit
 *    l'état complet une fois, puis les seules rubriques modifiées. Un pas de
 *    pion ne renvoie plus la pochette ; un état identique n'envoie rien ;
 *  - **les événements ponctuels** (vibration, onde) attendent leur tour, mais
 *    en file bornée : un téléphone endormi ne les vivra pas de toute façon ;
 *  - **bloqué plus d'une minute**, la connexion est coupée. Le téléphone se
 *    reconnecte de lui-même au réveil et reçoit l'état du moment.
 */

/** Ce dont on a besoin d'une réponse HTTP — de quoi la simuler en test. */
export interface SortieSse {
  write(s: string): boolean
  readonly writableLength: number
  once(e: 'drain', f: () => void): void
  destroy(): void
}

/** Au-delà, un téléphone qui ne lit plus est considéré comme parti. */
export const BLOCAGE_MAX_MS = 60_000
/** Les vibrations et ondes gardées pour un téléphone en retard. */
const FILE_MAX = 20

type Etat = Record<string, unknown>

export class AbonneSse {
  /** Depuis quand le tampon déborde ; `null`, il suit. */
  private bloqueDepuis: number | null = null
  private etatEnAttente: Etat | null = null
  private file: string[] = []
  private coupe = false
  /** Ce que le téléphone a déjà, rubrique par rubrique, en JSON. */
  private base: Map<string, string> | null = null
  private readonly patchs: boolean
  private readonly maintenant: () => number

  constructor(
    private readonly sortie: SortieSse,
    opts: { patchs?: boolean; maintenant?: () => number } = {}
  ) {
    this.patchs = opts.patchs ?? false
    this.maintenant = opts.maintenant ?? Date.now
  }

  /** Un état complet : seul le dernier compte. */
  etat(e: Etat): void {
    if (this.coupe) return
    if (this.bloqueDepuis == null) {
      const t = this.texteEtat(e)
      if (t) this.ecrire([t])
      return
    }
    this.etatEnAttente = e
    this.surveiller()
  }

  /** Un événement ponctuel : il passe dans l'ordre, ou tombe si la file déborde. */
  evenement(texte: string): void {
    if (this.coupe) return
    if (this.bloqueDepuis == null) return this.ecrire([texte])
    this.file.push(texte)
    if (this.file.length > FILE_MAX) this.file.shift()
    this.surveiller()
  }

  /**
   * Ce qu'il faut écrire pour que le téléphone ait `e` — et on le tient pour
   * acquis : l'appelant l'écrit aussitôt. `null`, il l'a déjà.
   */
  private texteEtat(e: Etat): string | null {
    const rubriques = new Map<string, string>()
    for (const [k, v] of Object.entries(e)) if (v !== undefined) rubriques.set(k, JSON.stringify(v))
    const avant = this.base
    this.base = rubriques
    if (!this.patchs || !avant) return `event: state\ndata: ${JSON.stringify(e)}\n\n`
    const set: string[] = []
    for (const [k, j] of rubriques) if (avant.get(k) !== j) set.push(`${JSON.stringify(k)}:${j}`)
    const del = [...avant.keys()].filter((k) => !rubriques.has(k))
    if (!set.length && !del.length) return null
    return `event: patch\ndata: {"set":{${set.join(',')}},"del":${JSON.stringify(del)}}\n\n`
  }

  private ecrire(textes: string[]): void {
    let suit = true
    for (const t of textes) suit = this.sortie.write(t)
    if (suit) return
    this.bloqueDepuis = this.maintenant()
    this.sortie.once('drain', () => this.vider())
  }

  /** Le téléphone a tout avalé : on lui donne ce qui a attendu. */
  private vider(): void {
    this.bloqueDepuis = null
    if (this.coupe) return
    const textes = this.file
    if (this.etatEnAttente != null) {
      const t = this.texteEtat(this.etatEnAttente)
      if (t) textes.push(t)
    }
    this.file = []
    this.etatEnAttente = null
    if (textes.length) this.ecrire(textes)
  }

  private surveiller(): void {
    if (this.bloqueDepuis == null) return
    if (this.maintenant() - this.bloqueDepuis < BLOCAGE_MAX_MS) return
    this.coupe = true
    this.file = []
    this.etatEnAttente = null
    this.sortie.destroy()
  }
}
