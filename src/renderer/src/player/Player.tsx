import { useEffect, useRef, useState } from 'react'
import { Slide } from '../shared/Slide'
import { Pings, usePings } from '../shared/Pings'
import type {
  CalqueBrouillard,
  DisplayState,
  Pointer,
  SlidePayload,
  Transition
} from '@shared/types'

/**
 * Fenêtre des joueurs. Elle ne décide de rien : elle reflète l'état
 * de diffusion envoyé par le processus principal.
 *
 * La bascule entre les deux emplacements de la régie se joue ici : l'ancienne
 * image reste dessous le temps que la nouvelle apparaisse par-dessus.
 */
export function Player(): JSX.Element {
  const [state, setState] = useState<DisplayState | null>(null)
  // Le pointeur arrive par son propre canal : il bouge trop vite pour
  // rediffuser tout l'état de la régie à chaque frémissement.
  const [pointer, setPointer] = useState<Pointer | null>(null)
  const ondes = usePings()
  const [under, setUnder] = useState<{ slide: SlidePayload; ms: number; mode: Transition } | null>(
    null
  )
  const lastTransition = useRef(0)
  /*
   * Les murs et les lumières du lieu à l'antenne.
   *
   * La fenêtre des joueurs va les chercher elle-même : les faire voyager dans
   * l'état de diffusion l'alourdirait à chaque frémissement de pion, alors
   * qu'ils ne changent qu'entre deux scènes. On relit à chaque changement
   * d'état — le MJ vient peut-être de percer une porte.
   */
  const [calque, setCalque] = useState<CalqueBrouillard | null>(null)
  const placeId = state?.placeId ?? null
  useEffect(() => {
    let vivant = true
    if (placeId == null) {
      setCalque(null)
      return
    }
    void window.jdr.murs.calque(placeId).then((c) => {
      if (vivant) setCalque(c)
    })
    return () => {
      vivant = false
    }
    /* `calqueRev` avance dès qu'une lampe ou une porte change : c'est ce qui
       rallume la pièce chez les joueurs sans qu'on rediffuse la scène. */
  }, [placeId, state?.calqueRev, state?.slide, state?.pions])

  useEffect(() => {
    void window.jdr.display.state().then(setState)
    const offState = window.jdr.display.onState(setState)
    const offPointer = window.jdr.display.onPointer(setPointer)
    const offPing = window.jdr.display.onPing(ondes.ajouter)
    return () => {
      offState()
      offPointer()
      offPing()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tId = state?.transition?.id ?? 0
  useEffect(() => {
    const t = state?.transition
    if (!t || t.id === lastTransition.current) return
    lastTransition.current = t.id
    if (t.ms <= 0 || !state?.previous) {
      setUnder(null)
      return
    }
    setUnder({ slide: state.previous, ms: t.ms, mode: t.mode ?? 'fondu' })
    const timer = setTimeout(() => setUnder(null), t.ms)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tId])

  return (
    <div className="pv-root">
      <div className="pv-stage">
        {state ? (
          <>
            {/* L'enchaînement se joue ici, et nulle part ailleurs : cette
                fenêtre est la seule à tenir les deux images en même temps.
                La manière vient de la régie ; les deux calques portent la
                même classe, chacun jouant sa moitié du mouvement. */}
            {under ? (
              <div
                className={`pv-under m-${under.mode}`}
                style={{ animationDuration: `${under.ms}ms` }}
              >
                <Slide slide={under.slide} animate={false} />
              </div>
            ) : null}
            <div
              className={under ? `pv-over m-${under.mode}` : undefined}
              style={under ? { animationDuration: `${under.ms}ms` } : undefined}
              key={under ? lastTransition.current : 'live'}
            >
              <Slide
                slide={state.slide}
                animate={!under}
                brouillard={calque}
                pions={state.pions}
                pionSize={state.pionSize}
                focusPionId={state.focusPionId}
                pionLabels={state.pionLabels}
                pionPv={state.pionPv}
                joueurs={state.joueurs}
                encart={state.encart}
                pointer={pointer}
              />
            </div>

            {/* Le QR d'appairage, par-dessus la scène. Il ne la remplace pas :
                on le tend le temps que chacun scanne, puis il s'efface. */}
            {/* Ce qu'un joueur montre du doigt depuis son téléphone. */}
            <Pings pings={ondes.pings} />

            {state.qr ? (
              <div className="pv-qr">
                <div className="pv-qr-carte">
                  <span className="pv-qr-titre">Vos portables</span>
                  <img src={state.qr.dataUrl} alt="" />
                  <span className="pv-qr-url">{state.qr.url}</span>
                  <span className="pv-qr-note">
                    Scannez, puis choisissez votre nom. Une seule fois : votre téléphone s’en
                    souviendra.
                  </span>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="pv-idle">écran du maître</div>
        )}
      </div>
    </div>
  )
}
