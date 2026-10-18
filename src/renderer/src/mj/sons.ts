/**
 * Les sons, côté MJ : la sonothèque telle que la base la rend, et la régie du
 * son telle que le processus principal la tient.
 *
 * Un magasin à part plutôt qu'une case de plus dans `store.ts` : trois pages
 * le lisent (la sonothèque, l'éditeur de plan, le Paravent) et le moteur qui
 * fait entendre les sons, et aucune n'a besoin du reste.
 */
import { create } from 'zustand'
import type { Son, SonJoue, SonsMj } from '@shared/types'
import { useStore } from './store'

interface EtatSons {
  liste: Son[]
  regie: SonsMj | null
  /** Le dernier son parti — le Paravent l'allume un instant. */
  dernier: SonJoue | null
  /** Le son qu'on écoute pour soi, dans la sonothèque ou l'éditeur : l'aperçu n'est pas joué à la table. */
  apercu: number | null
  /** Le fichier de ce son qu'on entend : la barre de son suit celui-là. */
  apercuFichier: number | null
  /**
   * Ce que la souris survole au Paravent : un son posé (`zone`) ou tous ceux
   * d'un son (`son`). La scène allume leurs cercles.
   */
  vise: { zone?: number; son?: number } | null
  charger: () => Promise<void>
  /** Remplacer un son dans la liste après une retouche, sans tout relire. */
  poser: (s: Son | null) => void
  setRegie: (r: SonsMj) => void
}

export const useSons = create<EtatSons>((set, get) => ({
  liste: [],
  regie: null,
  dernier: null,
  apercu: null,
  apercuFichier: null,
  vise: null,
  charger: async () => {
    const [liste, regie] = await Promise.all([window.jdr.sons.list(), window.jdr.regieSon.etat()])
    set({ liste, regie })
  },
  poser: (s) => {
    if (!s) return
    const l = get().liste
    set({ liste: l.some((x) => x.id === s.id) ? l.map((x) => (x.id === s.id ? s : x)) : [...l, s] })
  },
  setRegie: (regie) => set({ regie })
}))

let branche = false
/** Une fois pour toutes : la liste, l'état de la régie, et ce qui les fait bouger. */
export function brancherSons(): void {
  if (branche) return
  branche = true
  void useSons.getState().charger()
  window.jdr.regieSon.onState((r) => useSons.getState().setRegie(r))
  window.jdr.regieSon.onJoue((j) => useSons.setState({ dernier: j }))
  /* Un Ctrl+Z peut avoir rendu un son ou une planche. */
  window.addEventListener('jdr:defait', () => void useSons.getState().charger())
  /* L'aperçu s'écoute là où on l'a lancé : changer de page le coupe. */
  useStore.subscribe((st, avant) => {
    if (st.view !== avant.view) arreterApercu()
  })
}

/* ---------------- l'aperçu : écouter pour soi ---------------- */

let lecteur: HTMLAudioElement | null = null

/**
 * Écouter un son dans son casque, sans le jouer à la table ; un second clic
 * l'arrête. `depart`, de 0 à 1 : là où la barre de son a été cliquée.
 */
export function ecouter(son: Son, itemId?: number, depart?: number): void {
  const deja = useSons.getState().apercu
  arreterApercu()
  if (deja === son.id && itemId === undefined) return
  const f = itemId != null ? son.fichiers.find((x) => x.itemId === itemId) : son.fichiers[Math.floor(Math.random() * son.fichiers.length)]
  if (!f?.url) return
  const l = new Audio(f.url)
  lecteur = l
  l.volume = son.volume
  l.onended = (): void => arreterApercu()
  if (depart) l.addEventListener('loadedmetadata', () => (l.currentTime = depart * l.duration), { once: true })
  void l.play().catch(() => arreterApercu())
  useSons.setState({ apercu: son.id, apercuFichier: f.itemId })
}

/** Où en est l'aperçu, de 0 à 1 ; `null` quand rien ne joue. */
export function positionApercu(): number | null {
  if (!lecteur || !lecteur.duration || !Number.isFinite(lecteur.duration)) return null
  return lecteur.currentTime / lecteur.duration
}

/** Sauter à un point de l'aperçu en cours, de 0 à 1. */
export function chercherApercu(t: number): void {
  if (lecteur && lecteur.duration && Number.isFinite(lecteur.duration)) lecteur.currentTime = t * lecteur.duration
}

/** Le volume de l'aperçu en cours suit le curseur, sans relancer le son. */
export function volumeApercu(v: number): void {
  if (lecteur) lecteur.volume = Math.min(1, Math.max(0, v))
}

export function arreterApercu(): void {
  if (lecteur) {
    lecteur.pause()
    lecteur.src = ''
  }
  lecteur = null
  useSons.setState({ apercu: null, apercuFichier: null })
}

/* ---------------- l'onde : les volumes d'un fichier ---------------- */

/** Combien de bâtons dans une barre de son. */
export const BATONS = 96

const ondes = new Map<string, Promise<number[] | null>>()
let decodeur: AudioContext | null = null

/**
 * Les volumes d'un fichier, en `BATONS` crêtes de 0 à 1 — lus une fois par
 * adresse, puis gardés. Un fichier trop lourd (une ambiance d'une heure) ou
 * illisible rend `null` : la barre reste plate, la lecture marche quand même.
 */
export function ondeDe(url: string): Promise<number[] | null> {
  let p = ondes.get(url)
  if (!p) {
    p = (async () => {
      try {
        const brut = await (await fetch(url)).arrayBuffer()
        if (brut.byteLength > 60 * 1024 * 1024) return null
        decodeur ??= new AudioContext()
        const b = await decodeur.decodeAudioData(brut)
        const canaux = Array.from({ length: b.numberOfChannels }, (_, i) => b.getChannelData(i))
        const pas = Math.max(1, Math.floor(b.length / BATONS))
        const cretes: number[] = []
        for (let i = 0; i < BATONS; i++) {
          let m = 0
          const fin = Math.min(b.length, (i + 1) * pas)
          /* Un échantillon sur huit suffit pour une crête à l'œil. */
          for (let j = i * pas; j < fin; j += 8)
            for (const c of canaux) {
              const v = Math.abs(c[j])
              if (v > m) m = v
            }
          cretes.push(m)
        }
        const max = Math.max(...cretes) || 1
        return cretes.map((v) => v / max)
      } catch {
        return null
      }
    })()
    ondes.set(url, p)
  }
  return p
}

/** « 2:05 », ou « 0:03 » : la durée telle qu'on la lit sur un lecteur. */
export function duree(s: number | null | undefined): string {
  if (s == null || !Number.isFinite(s)) return '—'
  const t = Math.round(s)
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}

/**
 * Les sons d'**une autre séance** : tous leurs fichiers sont rangés dans le
 * dossier d'une séance qui n'est pas celle ouverte. Même règle que la
 * Bibliothèque (`focaliser`, store.ts) ; un son sans fichier n'est de nulle part.
 */
export function sonsDAilleurs(
  liste: Son[],
  st: {
    session: { folderRel: string | null } | null
    sessions: { folderRel: string | null }[]
    allItems: { id: number; relPath: string | null }[]
  }
): Set<number> {
  const ici = st.session?.folderRel
  if (!ici) return new Set()
  const dedans = (rel: string, d: string): boolean => rel === d || rel.startsWith(d + '/')
  const autres = st.sessions.map((x) => x.folderRel).filter((r): r is string => !!r && !dedans(ici, r))
  if (!autres.length) return new Set()
  const rel = new Map(st.allItems.map((i) => [i.id, i.relPath]))
  const horsDIci = (id: number): boolean => {
    const r = rel.get(id)
    return !!r && autres.some((d) => dedans(r, d))
  }
  return new Set(liste.filter((x) => x.fichiers.length && x.fichiers.every((f) => horsDIci(f.itemId))).map((x) => x.id))
}

/** Les gestes de survol d'un bouton de son : allumer ses cercles sur la scène, puis les éteindre. */
export function viser(v: { zone?: number; son?: number }): { onMouseEnter: () => void; onMouseLeave: () => void } {
  return {
    onMouseEnter: () => useSons.setState({ vise: v }),
    onMouseLeave: () => useSons.setState({ vise: null })
  }
}

/** L'émoji d'un son, ou celui de sa nature quand il n'en a pas. */
export const emojiDe = (s: Pick<Son, 'emoji' | 'nature'>): string =>
  s.emoji || (s.nature === 'ambiance' ? '🎼' : s.nature === 'nappe' ? '🌫️' : '🔔')
