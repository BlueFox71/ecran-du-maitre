import { useEffect, useRef } from 'react'
import { useStore } from '../store'
import { brancherSons, useSons } from '../sons'

/**
 * Le moteur du son. Il vit dans la fenêtre du MJ et non dans celle des
 * joueurs : la musique doit survivre à la fermeture de l'écran joueurs.
 *
 * Quatre voix, toutes pesées par le volume général :
 * - **l'ambiance**, une seule à la fois ; quand elle change, la nouvelle
 *   arrive pendant que l'ancienne s'éteint — deux lecteurs qui se relaient ;
 * - **les nappes** lancées à la main, en boucle, chacune à son volume ;
 * - **les sources** posées sur le plan, dont le volume suit le pion le plus
 *   proche ;
 * - **les bruitages** — et les sons posés qu'un pion déclenche —, qui
 *   partent et s'oublient.
 *
 * Il ne décide de rien : il suit `display.audio` et la régie du son.
 */

/** Un fondu en cours sur un lecteur, qu'un fondu plus récent remplace. */
const fondus = new WeakMap<HTMLAudioElement, number>()

/** Amener le volume d'un lecteur à `cible` en `secondes` ; à zéro, on peut le suspendre. */
function fondre(el: HTMLAudioElement, cible: number, secondes: number, puis?: () => void): void {
  const c = Math.max(0, Math.min(1, cible))
  const jeton = (fondus.get(el) ?? 0) + 1
  fondus.set(el, jeton)
  if (secondes <= 0.02) {
    el.volume = c
    puis?.()
    return
  }
  const depart = el.volume
  const t0 = performance.now()
  /* Une minuterie plutôt que requestAnimationFrame : celui-ci s'arrête quand
     la fenêtre du MJ est réduite, et le fondu resterait à mi-chemin. */
  const pas = (): void => {
    if (fondus.get(el) !== jeton) return
    const k = Math.min(1, (performance.now() - t0) / (secondes * 1000))
    el.volume = depart + (c - depart) * k
    if (k < 1) window.setTimeout(pas, 30)
    else puis?.()
  }
  pas()
}

const lancer = (el: HTMLAudioElement): void => void el.play().catch(() => undefined)

export function Sonorisation(): JSX.Element | null {
  const audio = useStore((s) => s.display?.audio)
  const regie = useSons((s) => s.regie)
  const general = regie?.general ?? 0.8

  useEffect(() => brancherSons(), [])

  /* ---------------- l'ambiance : deux lecteurs qui se relaient ---------------- */

  const amb = useRef<{ lecteurs: HTMLAudioElement[]; actif: number; url: string | null }>({
    lecteurs: [],
    actif: 0,
    url: null
  })

  useEffect(() => {
    const a = amb.current
    if (!a.lecteurs.length) a.lecteurs = [new Audio(), new Audio()]
    if (!audio) return
    const cible = (audio.volume ?? 0.35) * general
    const fondu = audio.fondu ?? 2
    let el = a.lecteurs[a.actif]

    if (audio.url && audio.url !== a.url) {
      /* Une autre ambiance : l'ancienne s'éteint pendant que la nouvelle monte. */
      const ancien = el
      if (a.url) fondre(ancien, 0, fondu, () => ancien.pause())
      a.actif = 1 - a.actif
      el = a.lecteurs[a.actif]
      el.src = audio.url
      el.volume = 0
      a.url = audio.url
    }
    el.loop = audio.loop
    if (audio.playing && a.url) {
      if (el.paused) {
        lancer(el)
        fondre(el, cible, el.volume < cible * 0.9 ? Math.max(0.4, fondu) : 0.15)
      } else fondre(el, cible, 0.25)
    } else if (!el.paused) {
      fondre(el, 0, audio.extinction ?? 0.6, () => el.pause())
    }
    if (!audio.url && a.url) {
      fondre(el, 0, 0.6, () => el.pause())
      a.url = null
    }
  }, [audio?.url, audio?.playing, audio?.loop, audio?.volume, audio?.fondu, general])

  /* ---------------- nappes et sources : un lecteur en boucle chacune ---------------- */

  const boucles = useRef(new Map<string, { el: HTMLAudioElement; url: string }>())

  useEffect(() => {
    const voulues = new Map<string, { url: string; cible: number; fondu: number }>()
    for (const n of regie?.nappes ?? [])
      if (n.url) voulues.set(`n${n.sonId}`, { url: n.url, cible: n.on ? n.volume * general : 0, fondu: 1.5 })
    for (const s of regie?.sources ?? [])
      if (s.url) voulues.set(`z${s.zoneId}`, { url: s.url, cible: s.volume * s.gain * general, fondu: 0.5 })

    const lus = boucles.current
    for (const [cle, b] of lus)
      if (!voulues.has(cle) || voulues.get(cle)!.url !== b.url) {
        const el = b.el
        fondre(el, 0, 1, () => {
          el.pause()
          el.src = ''
        })
        lus.delete(cle)
      }
    for (const [cle, v] of voulues) {
      let b = lus.get(cle)
      if (!b) {
        const el = new Audio(v.url)
        el.loop = true
        el.volume = 0
        b = { el, url: v.url }
        lus.set(cle, b)
      }
      const el = b.el
      if (v.cible > 0.001) {
        if (el.paused) lancer(el)
        fondre(el, v.cible, v.fondu)
      } else if (!el.paused) fondre(el, 0, v.fondu, () => el.pause())
    }
  }, [regie?.nappes, regie?.sources, general])

  /* ---------------- les bruitages : ils partent et s'oublient ---------------- */

  const enCours = useRef(new Set<HTMLAudioElement>())
  const generalRef = useRef(general)
  generalRef.current = general

  useEffect(() => {
    const finir = window.jdr.regieSon.onJoue((j) => {
      /* Tout ce qui arrive ici part une fois : nappes et ambiances n'y passent
         qu'en coup unique (un son posé qu'un pion a déclenché). */
      if (!j.url) return
      const el = new Audio(j.url)
      el.volume = Math.max(0, Math.min(1, j.volume * generalRef.current))
      enCours.current.add(el)
      el.onended = (): void => void enCours.current.delete(el)
      lancer(el)
    })
    const taire = window.jdr.regieSon.onSilence(() => {
      for (const el of enCours.current) fondre(el, 0, 0.4, () => el.pause())
      enCours.current.clear()
    })
    return () => {
      finir()
      taire()
    }
  }, [])

  return null
}
