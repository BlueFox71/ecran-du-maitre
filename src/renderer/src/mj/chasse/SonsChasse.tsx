import { useEffect, useRef } from 'react'
import sonNiveau3 from '../../assets/chasse/emf-niveau3.mp3'
import { useStore } from '../store'
import { useSons } from '../sons'
import { SonEmf } from './emf'

/**
 * Le grésillement de chaque EMF en jeu, joué par le PC au volume que calcule
 * le moteur (`gain` : la distance et les murs jusqu'au pion du MJ). Une voix
 * par appareil audible ; elle s'éteint quand l'appareil disparaît, s'éteint
 * lui-même ou devient trop loin. Pesé par le volume général du MJ, comme le
 * reste. Monté une fois, à côté de la Sonorisation.
 */
export function SonsChasse(): null {
  const chasse = useStore((s) => s.chasse)
  const general = useSons((s) => s.regie)?.general ?? 0.8
  const voix = useRef(new Map<number, SonEmf>())

  useEffect(() => {
    const v = voix.current
    const audibles = new Set<number>()
    for (const a of chasse) {
      if (a.outil !== 'emf' || !a.allume || a.gain <= 0) continue
      audibles.add(a.placementId)
      let son = v.get(a.placementId)
      if (!son) {
        son = new SonEmf(sonNiveau3)
        v.set(a.placementId, son)
        son.setVolume(0)
        son.demarrer()
      }
      son.setNiveau(a.valeur)
      son.setVolume(a.gain * general)
    }
    for (const [id, son] of v) {
      if (audibles.has(id)) continue
      son.arreter()
      v.delete(id)
    }
  }, [chasse, general])

  useEffect(() => {
    const v = voix.current
    return () => {
      for (const son of v.values()) son.arreter()
      v.clear()
    }
  }, [])

  return null
}
