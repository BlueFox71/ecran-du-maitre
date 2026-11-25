import { useEffect, useRef } from 'react'
import sonNiveau3 from '../../assets/chasse/emf-niveau3.mp3'
import { useStore } from '../store'
import { useSons } from '../sons'
import { SonEmf } from './emf'

/** Combien de temps une voix devenue muette attend avant d'être rendue. */
const REPIT_MS = 5000

interface Voix {
  son: SonEmf
  /** La voix est muette : elle sera rendue à la fin du répit, sauf si elle se refait entendre. */
  repit: ReturnType<typeof setTimeout> | null
}

/**
 * Le grésillement de chaque EMF en jeu, joué par le PC au volume que calcule
 * le moteur (`gain` : plein en main, sinon selon la distance et les murs
 * jusqu'au pion de joueur le plus proche). Une voix par appareil audible ;
 * devenue muette (hors de portée, hors zone), elle se tait quelques secondes
 * avant d'être rendue — un pion qui longe le bord d'une zone ne la fait pas
 * renaître à chaque pas. Elle part tout de suite quand l'appareil disparaît
 * ou s'éteint. Le « Silence » de la régie les coupe jusqu'au prochain
 * changement du moteur. Pesé par le volume général du MJ, comme le reste.
 * Monté une fois, à côté de la Sonorisation.
 */
export function SonsChasse(): null {
  const chasse = useStore((s) => s.chasse)
  const general = useSons((s) => s.regie)?.general ?? 0.8
  const voix = useRef(new Map<number, Voix>())
  /* L'état du moteur au moment du « Silence » : tant qu'il n'a pas changé, on se tait. */
  const courant = useRef(chasse)
  courant.current = chasse
  const tuSur = useRef<typeof chasse | null>(null)

  const rendre = (id: number): void => {
    const x = voix.current.get(id)
    if (!x) return
    if (x.repit) clearTimeout(x.repit)
    x.son.arreter()
    voix.current.delete(id)
  }

  useEffect(() => {
    const v = voix.current
    const tu = chasse === tuSur.current
    const presents = new Set<number>()
    for (const a of chasse) {
      if (tu || a.outil !== 'emf' || !a.allume) continue
      presents.add(a.placementId)
      let x = v.get(a.placementId)
      if (a.gain <= 0) {
        if (x) {
          x.son.setVolume(0)
          const id = a.placementId
          x.repit ??= setTimeout(() => rendre(id), REPIT_MS)
        }
        continue
      }
      if (!x) {
        x = { son: new SonEmf(sonNiveau3), repit: null }
        v.set(a.placementId, x)
        x.son.setVolume(0)
        x.son.demarrer()
      }
      if (x.repit) {
        clearTimeout(x.repit)
        x.repit = null
      }
      x.son.setNiveau(a.valeur)
      x.son.setVolume(a.gain * general)
    }
    for (const id of [...v.keys()]) if (!presents.has(id)) rendre(id)
  }, [chasse, general])

  useEffect(() => {
    const taire = window.jdr.regieSon.onSilence(() => {
      tuSur.current = courant.current
      for (const id of [...voix.current.keys()]) rendre(id)
    })
    return () => {
      taire()
      for (const id of [...voix.current.keys()]) rendre(id)
    }
  }, [])

  return null
}
