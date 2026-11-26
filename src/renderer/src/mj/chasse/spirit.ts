/**
 * La Spirit Box : une radio qui balaie les fréquences sans s'arrêter — du
 * grésillement, un clic à chaque station — et, quand le MJ la fait parler,
 * une voix venue de nulle part, prise dans le balayage.
 *
 * La voix est prononcée par Windows (src/main/voix.ts, en WAV) puis
 * transformée ici : passée au filtre d'une radio, rendue plus grave, hachée au
 * rythme des stations, noyée d'écho et de grésillement.
 */

export const FREQUENCE_MIN = 87.5
export const FREQUENCE_MAX = 108.0

/** La station suivante : on avance d'un pas, et l'on repart du bas au bout de la bande. */
export function frequenceSuivante(f: number, pas: number): number {
  const n = Math.round((f + pas) * 10) / 10
  return n > FREQUENCE_MAX ? FREQUENCE_MIN : n
}

/** La fréquence telle que l'écran l'écrit : « 94.3 ». */
export function texteFrequence(f: number): string {
  return f.toFixed(1)
}

/* Les réglages de la voix vivent dans le partagé : la fiche d'une spirit box les garde. */
import { REGLAGES_VOIX, type ReglagesVoix } from '@shared/parole'
export { REGLAGES_VOIX, type ReglagesVoix }

/* ============================================================
   Le son
   ============================================================ */

export class SonSpirit {
  private ctx: AudioContext | null = null
  private maitre: GainNode | null = null
  private bande: BiquadFilterNode | null = null
  private gresil: GainNode | null = null
  private bruit: AudioBuffer | null = null
  private voixEntree: GainNode | null = null
  private porte: GainNode | null = null
  private echoGain: GainNode | null = null
  private netGain: GainNode | null = null
  private abimeGain: GainNode | null = null
  private source: AudioBufferSourceNode | null = null
  private double: AudioBufferSourceNode | null = null
  private minuterie: ReturnType<typeof setTimeout> | null = null
  private frequence = 94.3
  private volume = 0.7
  private niveauGresil = 0.6
  private balayageMs = 140
  private reglages: ReglagesVoix = { ...REGLAGES_VOIX }
  private parle = false
  /** Appelée à chaque station : l'écran suit. */
  onFrequence: (f: number) => void = () => undefined

  demarrer(): void {
    if (this.ctx) {
      void this.ctx.resume()
      this.balayer()
      return
    }
    const ctx = new AudioContext()
    this.ctx = ctx
    const maitre = ctx.createGain()
    maitre.gain.value = this.volume
    maitre.connect(ctx.destination)
    this.maitre = maitre

    /* Le grésillement : du bruit blanc, dans une bande qui saute d'une station à l'autre. */
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    this.bruit = buf
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    const bande = ctx.createBiquadFilter()
    bande.type = 'bandpass'
    bande.frequency.value = 1800
    bande.Q.value = 0.7
    const gresil = ctx.createGain()
    gresil.gain.value = 0
    src.connect(bande).connect(gresil).connect(maitre)
    src.start()
    this.bande = bande
    this.gresil = gresil

    /* La chaîne de la voix : bande d'une radio (250 Hz – 3,6 kHz, assez large
       pour garder la voix rendue plus grave), un relief sur les consonnes, puis
       deux chemins mêlés selon la netteté — l'un net, l'autre râpé (grain
       métallique, saturation) — un compresseur qui la remonte au-dessus du
       grésillement, la porte hachée, un départ sec et un départ d'écho. */
    const voixEntree = ctx.createGain()
    const passeHaut = ctx.createBiquadFilter()
    passeHaut.type = 'highpass'
    passeHaut.frequency.value = 250
    const passeBas = ctx.createBiquadFilter()
    passeBas.type = 'lowpass'
    passeBas.frequency.value = 3600
    passeBas.Q.value = 0.9
    const relief = ctx.createBiquadFilter()
    relief.type = 'peaking'
    relief.frequency.value = 2200
    relief.Q.value = 0.8
    relief.gain.value = 5
    voixEntree.connect(passeHaut).connect(passeBas).connect(relief)

    const melange = ctx.createGain()
    const netGain = ctx.createGain()
    relief.connect(netGain).connect(melange)
    const anneau = ctx.createGain()
    anneau.gain.value = 0.65
    const modulante = ctx.createOscillator()
    modulante.frequency.value = 38
    const profondeur = ctx.createGain()
    profondeur.gain.value = 0.35
    modulante.connect(profondeur).connect(anneau.gain)
    modulante.start()
    const sature = ctx.createWaveShaper()
    sature.curve = courbeSaturation(3)
    const abimeGain = ctx.createGain()
    relief.connect(anneau).connect(sature).connect(abimeGain).connect(melange)

    const compresseur = ctx.createDynamicsCompressor()
    compresseur.threshold.value = -28
    compresseur.knee.value = 8
    compresseur.ratio.value = 5
    compresseur.attack.value = 0.003
    compresseur.release.value = 0.15
    const porte = ctx.createGain()
    porte.gain.value = 1
    const sec = ctx.createGain()
    sec.gain.value = 2.2
    const echo = ctx.createConvolver()
    echo.buffer = reponseEcho(ctx, 1.5)
    const echoGain = ctx.createGain()
    melange.connect(compresseur).connect(porte)
    porte.connect(sec).connect(maitre)
    porte.connect(echo).connect(echoGain).connect(maitre)
    this.voixEntree = voixEntree
    this.porte = porte
    this.echoGain = echoGain
    this.netGain = netGain
    this.abimeGain = abimeGain
    this.appliquerTimbre()

    this.balayer()
  }

  /** Une station, puis la suivante : le grésillement saute, un clic marque le pas. */
  private balayer(): void {
    if (this.minuterie) clearTimeout(this.minuterie)
    const pas = (): void => {
      const ctx = this.ctx
      if (!ctx || !this.bande || !this.gresil) return
      const t = ctx.currentTime
      this.frequence = frequenceSuivante(this.frequence, 0.2 + Math.round(Math.random() * 2) * 0.1)
      this.onFrequence(this.frequence)
      this.bande.frequency.setValueAtTime(700 + Math.random() * 2600, t)
      /* Pendant que la voix parle, le grésillement s'efface un peu devant elle. */
      const fond = this.niveauGresil * (this.parle ? 0.22 : 1)
      this.gresil.gain.cancelScheduledValues(t)
      this.gresil.gain.setValueAtTime(fond * (0.55 + Math.random() * 0.45), t)
      this.clic(t)
      /* La voix ne passe pas à toutes les stations. */
      if (this.porte) {
        const ouverte = Math.random() >= this.reglages.hachage
        /* Une station fermée laisse filer un souffle de voix : un mot ne disparaît jamais tout à fait. */
        this.porte.gain.setTargetAtTime(ouverte ? 1 : 0.12, t, 0.008)
      }
      const jeu = 0.75 + Math.random() * 0.5
      this.minuterie = setTimeout(pas, this.balayageMs * jeu)
    }
    pas()
  }

  /** Le clic d'une station : un éclat de bruit et un petit sifflement d'accord. */
  private clic(t: number): void {
    const ctx = this.ctx
    if (!ctx || !this.bruit || !this.maitre) return
    const g = ctx.createGain()
    const fort = 0.25 * this.niveauGresil
    g.gain.setValueAtTime(fort, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035)
    const b = ctx.createBufferSource()
    b.buffer = this.bruit
    b.connect(g).connect(this.maitre)
    b.start(t, Math.random(), 0.04)
    if (Math.random() < 0.35) {
      const o = ctx.createOscillator()
      o.frequency.setValueAtTime(900 + Math.random() * 2800, t)
      o.frequency.exponentialRampToValueAtTime(400 + Math.random() * 800, t + 0.06)
      const og = ctx.createGain()
      og.gain.setValueAtTime(0.04 * this.niveauGresil, t)
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.07)
      o.connect(og).connect(this.maitre)
      o.start(t)
      o.stop(t + 0.08)
    }
  }

  /** Fait passer la voix (les octets d'un WAV) dans le balayage. Rend quand elle a fini. */
  async dire(wav: Uint8Array): Promise<void> {
    const ctx = this.ctx
    if (!ctx || !this.voixEntree) return
    const copie = wav.slice().buffer
    const buf = await ctx.decodeAudioData(copie)
    this.source?.stop()
    this.double?.stop()
    /* Deux présences : la voix, et sa doublure un peu plus grave, un peu en
       retard — on n'entend plus une voix de synthèse, mais quelque chose qui
       parle à plusieurs. La doublure reste en retrait, et d'autant plus que la
       voix est nette : elle étale les consonnes. */
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.playbackRate.value = this.reglages.grave
    src.connect(this.voixEntree)
    const double = ctx.createBufferSource()
    double.buffer = buf
    double.playbackRate.value = this.reglages.grave * 0.93
    const doubleGain = ctx.createGain()
    doubleGain.gain.value = 0.15 + 0.3 * (1 - this.reglages.clarte)
    double.connect(doubleGain).connect(this.voixEntree)
    this.source = src
    this.double = double
    this.parle = true
    /* La hauteur tangue sans cesse : une voix de synthèse, elle, ne bouge pas. */
    const tangage = setInterval(() => {
      const t = ctx.currentTime
      const ecart = 1 + (Math.random() - 0.5) * (0.03 + 0.06 * (1 - this.reglages.clarte))
      src.playbackRate.setTargetAtTime(this.reglages.grave * ecart, t, 0.06)
      double.playbackRate.setTargetAtTime(this.reglages.grave * 0.93 * (2 - ecart), t, 0.06)
    }, 110)
    await new Promise<void>((fin) => {
      src.onended = () => fin()
      const t = ctx.currentTime
      src.start(t)
      double.start(t + 0.03)
    })
    clearInterval(tangage)
    double.stop()
    if (this.source === src) {
      this.source = null
      this.double = null
      this.parle = false
    }
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v))
    if (this.ctx && this.maitre) this.maitre.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02)
  }

  setGresillement(v: number): void {
    this.niveauGresil = Math.max(0, Math.min(1, v))
  }

  setBalayage(ms: number): void {
    this.balayageMs = Math.max(40, Math.min(600, ms))
  }

  setReglages(r: ReglagesVoix): void {
    this.reglages = r
    this.appliquerTimbre()
    if (this.source) this.source.playbackRate.value = r.grave
  }

  /** Écho et netteté : le chemin net et le chemin râpé, dosés l'un contre l'autre. */
  private appliquerTimbre(): void {
    const ctx = this.ctx
    if (!ctx || !this.echoGain || !this.netGain || !this.abimeGain) return
    const t = ctx.currentTime
    const c = this.reglages.clarte
    this.echoGain.gain.setTargetAtTime(this.reglages.echo * 0.8, t, 0.05)
    this.netGain.gain.setTargetAtTime(c, t, 0.05)
    this.abimeGain.gain.setTargetAtTime((1 - c) * 0.9, t, 0.05)
  }

  /** Coupe la radio, sans la fermer : on peut la rallumer. */
  suspendre(): void {
    if (this.minuterie) clearTimeout(this.minuterie)
    this.minuterie = null
    this.source?.stop()
    this.double?.stop()
    void this.ctx?.suspend()
  }

  arreter(): void {
    if (this.minuterie) clearTimeout(this.minuterie)
    this.minuterie = null
    void this.ctx?.close()
    this.ctx = null
    this.maitre = this.bande = this.gresil = this.voixEntree = this.porte = this.echoGain = null
    this.netGain = this.abimeGain = null
    this.source = null
    this.bruit = null
  }
}

/** Une saturation douce : la voix grésille comme dans un petit haut-parleur. */
function courbeSaturation(k: number): Float32Array<ArrayBuffer> {
  const n = 1024
  const c = new Float32Array(new ArrayBuffer(n * 4))
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    c[i] = Math.tanh(k * x) / Math.tanh(k)
  }
  return c
}

/** L'écho : une réponse de pièce vide, du bruit qui s'éteint en `duree` secondes. */
function reponseEcho(ctx: AudioContext, duree: number): AudioBuffer {
  const lg = Math.round(ctx.sampleRate * duree)
  const r = ctx.createBuffer(2, lg, ctx.sampleRate)
  for (let canal = 0; canal < 2; canal++) {
    const d = r.getChannelData(canal)
    for (let i = 0; i < lg; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / lg, 3)
  }
  return r
}
