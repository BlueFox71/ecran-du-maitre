/**
 * Le livre d'écriture fantôme : le MJ tape, une main invisible trace au crayon.
 *
 * Ici, le calcul pur : les écritures au choix, le rythme du tracé lettre par
 * lettre, le tremblement de chaque lettre. Le livre (Livre.tsx) les met en
 * scène, et `SonCrayon` gratte le papier.
 */

/** Une écriture : une police manuscrite libre, embarquée (Livre.tsx l'importe). */
export interface Ecriture {
  id: string
  nom: string
  /** La famille CSS. */
  police: string
  /** Une taille de base, en % de la largeur du livre : les polices n'ont pas la même carrure. */
  taille: number
  /** De combien chaque lettre peut pencher et sauter (0 : sage, 1 : très agité). */
  agitation: number
}

export const ECRITURES: Ecriture[] = [
  /* Help Me : GGBotNet, licence OFL, déclarée dans app.css (@font-face). */
  { id: 'helpme', nom: 'Help Me', police: "'Help Me', cursive", taille: 3.0, agitation: 0.4 },
  { id: 'griffonnage', nom: 'Griffonnage', police: "'Reenie Beanie', cursive", taille: 3.4, agitation: 0.5 },
  { id: 'plume', nom: 'Plume ancienne', police: "'Homemade Apple', cursive", taille: 2.1, agitation: 0.25 },
  { id: 'tremblante', nom: 'Tremblante', police: "'Rock Salt', cursive", taille: 2.0, agitation: 1 },
]

export function ecritureParId(id: string): Ecriture {
  return ECRITURES.find((e) => e.id === id) ?? ECRITURES[0]
}

/**
 * Le temps avant la lettre suivante, en ms. `vitesse` de 0 (lent) à 1 (rapide),
 * `hasard` de 0 à 1 : une main ne trace pas au métronome. Une espace passe
 * vite, une ponctuation marque un temps, un retour à la ligne plus encore.
 */
export function delaiLettre(lettre: string, vitesse: number, hasard: number): number {
  const v = Math.max(0, Math.min(1, vitesse))
  const base = 240 - 190 * v
  const jeu = 0.6 + 0.8 * Math.max(0, Math.min(1, hasard))
  if (lettre === '\n') return Math.round(base * 4 * jeu)
  if (lettre === ' ') return Math.round(base * 0.5 * jeu)
  if ('.,;:!?…'.includes(lettre)) return Math.round(base * 2.5 * jeu)
  return Math.round(base * jeu)
}

/**
 * Le tremblement d'une lettre : un angle (degrés) et un saut vertical (em),
 * tirés d'un hasard fixe pour la position `i` — la lettre ne bouge plus une
 * fois tracée, même quand la page se redessine.
 */
export function tremblement(i: number, agitation: number): { angle: number; saut: number } {
  const h = (n: number): number => {
    const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453
    return x - Math.floor(x) - 0.5
  }
  return { angle: h(i) * 9 * agitation, saut: h(i + 7919) * 0.12 * agitation }
}

/* ============================================================
   Le grattement du crayon
   ============================================================ */

/** Un court frottement de graphite sur le papier, à chaque lettre. */
export class SonCrayon {
  private ctx: AudioContext | null = null
  private bruit: AudioBuffer | null = null
  private sortie: GainNode | null = null

  private preparer(): AudioContext {
    if (this.ctx) return this.ctx
    const ctx = new AudioContext()
    const buf = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.5), ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    const sortie = ctx.createGain()
    sortie.gain.value = 0.5
    sortie.connect(ctx.destination)
    this.ctx = ctx
    this.bruit = buf
    this.sortie = sortie
    return ctx
  }

  /** `duree` en ms : la lettre en train de se tracer. */
  gratter(duree: number): void {
    const ctx = this.preparer()
    if (ctx.state === 'suspended') void ctx.resume()
    if (!this.bruit || !this.sortie) return
    const t = ctx.currentTime
    const d = Math.max(0.03, Math.min(0.16, (duree / 1000) * 0.7))
    const src = ctx.createBufferSource()
    src.buffer = this.bruit
    src.playbackRate.value = 0.8 + Math.random() * 0.5
    const bande = ctx.createBiquadFilter()
    bande.type = 'bandpass'
    bande.frequency.value = 2600 + Math.random() * 1800
    bande.Q.value = 1.4
    const g = ctx.createGain()
    const fort = 0.05 + Math.random() * 0.04
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(fort, t + 0.01)
    g.gain.setValueAtTime(fort * 0.7, t + d * 0.6)
    g.gain.linearRampToValueAtTime(0, t + d)
    src.connect(bande).connect(g).connect(this.sortie)
    src.start(t, Math.random() * 0.3, d + 0.02)
  }

  fermer(): void {
    void this.ctx?.close()
    this.ctx = null
    this.bruit = null
    this.sortie = null
  }
}
