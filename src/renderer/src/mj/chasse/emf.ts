/**
 * L'EMF du chasseur de fantômes : cinq LED, du vert au rouge, et un son qui
 * s'emballe quand on approche.
 *
 * Ici, le calcul pur (combien de LED, comment jouer le son à un niveau) et le
 * moteur de son. La page (modules/Emf.tsx) ne fait que les brancher sur un
 * curseur. Le son est un enregistrement (assets/chasse/emf-niveau3.mp3), joué
 * tel quel au niveau 3 et transformé pour les autres.
 */

/** Le niveau va de 0 (rien) à 5 (le fantôme est là). Il peut être fractionnaire. */
export const NIVEAU_MAX = 5

/** Les cinq LED, de gauche à droite, avec leur couleur. */
export const LEDS_EMF = [
  { couleur: '#3ddc5a', nom: 'vert' },
  { couleur: '#9be03a', nom: 'vert clair' },
  { couleur: '#f2d33a', nom: 'jaune' },
  { couleur: '#f5902e', nom: 'orange' },
  { couleur: '#f0433a', nom: 'rouge' }
] as const

export function borner(n: number): number {
  return Math.max(0, Math.min(NIVEAU_MAX, Number.isFinite(n) ? n : 0))
}

/** Combien de LED brillent pour un niveau : au niveau 3, les trois premières. */
export function ledsAllumees(niveau: number): number {
  return Math.round(borner(niveau))
}

/**
 * La courbe du bouton « Approche » : le niveau monte en douceur, tient un
 * instant au sommet, puis redescend. `t` en secondes, `duree` le tout.
 */
export function courbeApproche(t: number, duree: number): number {
  if (t <= 0 || t >= duree) return 0
  const x = t / duree
  /* Une cloche aplatie au sommet : sin^0.6 tient plus longtemps en haut. */
  return NIVEAU_MAX * Math.pow(Math.sin(Math.PI * x), 0.6)
}

/**
 * Le son enregistré, selon le niveau. Il est joué tel quel au niveau 3.
 * - `vitesse` : sa vitesse de lecture (1 = d'origine), qui le rend aussi plus
 *   grave ou plus aigu : deux demi-tons par niveau ;
 * - `volume` : de 0 à 1 ;
 * - `rafale` : sous le niveau 3, il ne joue que par rafales — la durée d'une
 *   rafale et l'écart entre deux, en ms. `null` : en continu.
 */
export function reglageFichier(niveau: number): {
  vitesse: number
  volume: number
  rafale: { dureeMs: number; ecartMs: number } | null
} | null {
  const n = borner(niveau)
  if (n < 0.5) return null
  const vitesse = Math.pow(2, ((n - 3) * 2) / 12)
  const volume = Math.min(1, 0.45 + 0.2 * (n - 0.5))
  if (n >= 2.6) return { vitesse, volume, rafale: null }
  /* Niveau 1 : une rafale de 140 ms par seconde ; niveau 2 : 260 ms toutes les 0,5 s. */
  const t = (n - 0.5) / 2.1
  return {
    vitesse,
    volume,
    rafale: { dureeMs: Math.round(140 + 160 * t), ecartMs: Math.round(1100 - 650 * t) }
  }
}

/* ============================================================
   Le son
   ============================================================ */

/**
 * Le moteur : l'enregistrement tourne en boucle, et l'on règle sa vitesse et
 * son volume selon le niveau. Sous le niveau 3, un petit ordonnanceur pose les
 * rafales à l'avance sur l'horloge audio, pour qu'elles tombent juste même si
 * l'interface rame.
 */
export class SonEmf {
  private ctx: AudioContext | null = null
  private maitre: GainNode | null = null
  private source: AudioBufferSourceNode | null = null
  private porte: GainNode | null = null
  private minuterie: ReturnType<typeof setInterval> | null = null
  private prochaineRafale = 0
  private niveau = 0
  private volume = 0.6

  constructor(private readonly url: string) {}

  /** À appeler sur un geste du MJ : le navigateur ne laisse pas jouer sans. */
  demarrer(): void {
    if (this.ctx) {
      void this.ctx.resume()
      return
    }
    const ctx = new AudioContext()
    this.ctx = ctx
    const maitre = ctx.createGain()
    maitre.gain.value = this.volume
    maitre.connect(ctx.destination)
    this.maitre = maitre
    const porte = ctx.createGain()
    porte.gain.value = 0
    porte.connect(maitre)
    this.porte = porte
    void this.charger(ctx)
    this.prochaineRafale = ctx.currentTime
    this.minuterie = setInterval(() => this.ordonner(), 25)
  }

  private async charger(ctx: AudioContext): Promise<void> {
    try {
      const donnees = await (await fetch(this.url)).arrayBuffer()
      const buf = await ctx.decodeAudioData(donnees)
      if (this.ctx !== ctx || !this.porte) return
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.loop = true
      src.connect(this.porte)
      src.start()
      this.source = src
    } catch (e) {
      console.error('[EMF] son illisible', e)
    }
  }

  setNiveau(n: number): void {
    this.niveau = borner(n)
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v))
    if (this.ctx && this.maitre) this.maitre.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02)
  }

  arreter(): void {
    if (this.minuterie) clearInterval(this.minuterie)
    this.minuterie = null
    void this.ctx?.close()
    this.ctx = null
    this.maitre = this.porte = null
    this.source = null
  }

  /** La vitesse et le volume suivent le niveau ; en rafales sous 3. */
  private ordonner(): void {
    const ctx = this.ctx
    const g = this.porte
    if (!ctx || !g) return
    const now = ctx.currentTime
    const r = reglageFichier(this.niveau)
    if (!r) {
      g.gain.setTargetAtTime(0, now, 0.03)
      this.prochaineRafale = now
      return
    }
    this.source?.playbackRate.setTargetAtTime(r.vitesse, now, 0.08)
    const fort = r.volume * 0.5
    if (!r.rafale) {
      g.gain.setTargetAtTime(fort, now, 0.04)
      this.prochaineRafale = now
      return
    }
    if (this.prochaineRafale < now) this.prochaineRafale = now
    while (this.prochaineRafale < now + 0.1) {
      const t = this.prochaineRafale
      const duree = r.rafale.dureeMs / 1000
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(fort, t + 0.015)
      g.gain.setValueAtTime(fort, t + duree)
      g.gain.linearRampToValueAtTime(0, t + duree + 0.03)
      this.prochaineRafale += r.rafale.ecartMs / 1000
    }
  }
}
