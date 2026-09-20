import { useEffect, useRef } from 'react'
import { useStore } from '../store'

/**
 * Lecteur d'ambiance sonore. Il vit dans la fenêtre du MJ et non dans celle des
 * joueurs : la musique doit survivre à la fermeture de l'écran joueurs.
 */
export function Ambience(): JSX.Element {
  const audio = useStore((s) => s.display?.audio)
  const ref = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !audio) return

    if (audio.url && el.getAttribute('src') !== audio.url) el.setAttribute('src', audio.url)
    el.loop = audio.loop
    el.volume = Math.max(0, Math.min(1, audio.volume))

    if (audio.playing && audio.url) {
      void el.play().catch(() => undefined)
    } else {
      el.pause()
    }
  }, [audio?.url, audio?.playing, audio?.loop, audio?.volume])

  return <audio ref={ref} hidden />
}
