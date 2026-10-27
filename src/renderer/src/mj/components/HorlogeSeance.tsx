import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { Minuteries, useMinuteries } from './Minuteries'
import { ChronosHorloge } from '../santeMentale/ChronosHorloge'
import { ReinitSeance } from './ReinitSeance'
import { IconRecommencer } from './Icons'

/**
 * L'horloge de la séance, au pied du rail : on la commence en début de soirée,
 * on la met en pause pour manger, on la reprend, on la finit. Une fin n'est
 * pas définitive — « Reprendre » la rouvre, et le temps écoulé depuis compte
 * comme une pause : on rectifie un clic trop tôt sans rien perdre.
 *
 * Ce qu'on garde, c'est la suite des gestes et leur heure, une liste par
 * séance, dans les réglages de la campagne (`seance.horloge.<id>`) : rien en
 * base, rien qui sorte vers les joueurs.
 */
type Geste = 'debut' | 'pause' | 'reprise' | 'fin'
interface Evenement {
  t: Geste
  at: number
}
type Etat = 'avant' | 'en-cours' | 'pause' | 'finie'

const cle = (sessionId: number): string => `seance.horloge.${sessionId}`

function etatDe(evs: Evenement[]): Etat {
  const dernier = evs[evs.length - 1]
  if (!dernier) return 'avant'
  if (dernier.t === 'pause') return 'pause'
  if (dernier.t === 'fin') return 'finie'
  return 'en-cours'
}

/** Le temps joué : de chaque départ (début, reprise) à l'arrêt suivant. */
function tempsJoue(evs: Evenement[], maintenant: number): number {
  let total = 0
  let depuis: number | null = null
  for (const e of evs) {
    if (e.t === 'debut' || e.t === 'reprise') depuis ??= e.at
    else if (depuis !== null) {
      total += e.at - depuis
      depuis = null
    }
  }
  if (depuis !== null) total += maintenant - depuis
  return total
}

const heure = (ms: number): string => {
  const d = new Date(ms)
  return `${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}`
}

const duree = (ms: number): string => {
  const min = Math.floor(ms / 60000)
  const h = Math.floor(min / 60)
  return h ? `${h} h ${String(min % 60).padStart(2, '0')}` : `${min} min`
}

const LIBELLES: Record<Geste, string> = {
  debut: 'Début',
  pause: 'Pause',
  reprise: 'Reprise',
  fin: 'Fin'
}

export function HorlogeSeance(): JSX.Element | null {
  const sessionId = useStore((s) => s.session?.id ?? null)
  const [evs, setEvs] = useState<Evenement[]>([])
  const [maintenant, setMaintenant] = useState(Date.now())
  const minuteries = useMinuteries(sessionId)
  const [reinit, setReinit] = useState(false)

  // La séance change : on relit sa liste.
  useEffect(() => {
    setEvs([])
    if (sessionId === null) return
    let vivant = true
    void window.jdr.reglages.campagne().then((brut) => {
      if (!vivant) return
      try {
        const lu = JSON.parse(brut[cle(sessionId)] ?? '[]')
        setEvs(Array.isArray(lu) ? lu : [])
      } catch {
        setEvs([])
      }
    })
    return () => {
      vivant = false
    }
  }, [sessionId])

  const etat = etatDe(evs)

  // L'aiguille ne tourne que si quelque chose avance.
  useEffect(() => {
    if (etat === 'avant' || etat === 'finie') return
    const t = window.setInterval(() => setMaintenant(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [etat])

  if (sessionId === null) return null

  const noter = (t: Geste): void => {
    const suite = [...evs, { t, at: Date.now() }]
    setEvs(suite)
    setMaintenant(Date.now())
    void window.jdr.reglages.poserCampagne(cle(sessionId), JSON.stringify(suite))
    /* Les minuteries suivent l'horloge : le repas ne fait pas tomber le générateur. */
    if (t === 'pause' || t === 'fin') minuteries.suspendre()
    if (t === 'reprise') minuteries.relancer()
  }

  const debut = evs.find((e) => e.t === 'debut')?.at
  const dernier = evs[evs.length - 1]
  const joue = tempsJoue(evs, maintenant)
  const journal = evs.map((e) => `${LIBELLES[e.t]} — ${heure(e.at)}`).join('\n')

  return (
    <div className={`horloge-seance hs-${etat}`} title={journal || undefined}>
      <div className="hs-tete">
        <span className="eyebrow">Horloge de séance</span>
        {etat !== 'avant' ? (
          <span className="hs-etat">
            {etat === 'en-cours' ? 'en cours' : etat === 'pause' ? 'en pause' : 'terminée'}
          </span>
        ) : null}
        <button
          type="button"
          className="hs-reinit"
          title="Réinitialiser la séance — objets, jauges, journaux…"
          aria-label="Réinitialiser la séance"
          onClick={() => setReinit(true)}
        >
          <IconRecommencer />
        </button>
      </div>

      {etat === 'avant' ? (
        // Pas de laiton : le seul bouton doré en jeu est Basculer.
        <button className="btn btn-sm hs-large" onClick={() => noter('debut')}>
          Commencer la séance
        </button>
      ) : (
        <>
          <div className="hs-temps num">{duree(joue)}</div>
          <div className="hs-detail">
            {debut ? `début ${heure(debut)}` : null}
            {etat === 'pause' && dernier ? ` · pause depuis ${heure(dernier.at)}` : null}
            {etat === 'finie' && dernier ? ` · fin ${heure(dernier.at)}` : null}
          </div>
          <div className="hs-gestes">
            {etat === 'en-cours' ? (
              <button className="btn btn-sm" onClick={() => noter('pause')}>
                Pause
              </button>
            ) : (
              <button
                className="btn btn-sm"
                onClick={() => noter('reprise')}
                title={
                  etat === 'finie'
                    ? 'Rouvrir la séance — le temps écoulé depuis la fin compte comme une pause'
                    : undefined
                }
              >
                Reprendre
              </button>
            )}
            {etat !== 'finie' ? (
              <button className="btn btn-ghost btn-sm" onClick={() => noter('fin')}>
                Fin de séance
              </button>
            ) : (
              /* Repartir de rien : seulement une fois la séance finie, et
                 après confirmation — les heures notées sont perdues. */
              <button
                className="btn btn-ghost btn-sm"
                title="Effacer les heures de cette séance et revenir à « Commencer la séance »"
                onClick={() => {
                  if (!confirm('Remettre l’horloge à zéro ? Les heures notées pour cette séance seront effacées.'))
                    return
                  setEvs([])
                  void window.jdr.reglages.poserCampagne(cle(sessionId), null)
                }}
              >
                Remettre à zéro
              </button>
            )}
          </div>
        </>
      )}

      <ChronosHorloge />
      <Minuteries m={minuteries} />
      {reinit ? <ReinitSeance onFerme={() => setReinit(false)} /> : null}
    </div>
  )
}
