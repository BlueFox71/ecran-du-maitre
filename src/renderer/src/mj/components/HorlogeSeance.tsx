import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { Minuteries, useMinuteries } from './Minuteries'
import { ChronosHorloge } from '../santeMentale/ChronosHorloge'
import { ReinitSeance } from './ReinitSeance'
import { IconClose, IconPen, IconRecommencer } from './Icons'

/**
 * L'horloge de la séance, au pied du rail : on la commence en début de soirée,
 * on la met en pause pour manger, on la reprend, on la finit. Une fin n'est
 * pas définitive — finie pendant une pause, elle s'arrête à l'heure de la
 * pause —, et « Reprendre » la rouvre, et le temps écoulé depuis compte
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

/**
 * Une séance finie pendant une pause s'est arrêtée à la pause : on ne revient
 * pas de table pour cliquer « Fin ». La fin prend l'heure de la pause, qui
 * disparaît. Vaut aussi pour les heures notées avant cette règle.
 */
function finALaPause(evs: Evenement[]): Evenement[] {
  const n = evs.length
  if (n < 2 || evs[n - 1].t !== 'fin' || evs[n - 2].t !== 'pause') return evs
  return [...evs.slice(0, n - 2), { t: 'fin', at: evs[n - 2].at }]
}

/**
 * Corriger l'heure d'un geste — une séance commencée en retard, une fin
 * cliquée après coup. L'heure saisie se pose sur le jour du geste ; si elle
 * tombe après le geste suivant ou avant le précédent, c'est qu'elle passe
 * minuit, et l'on change de jour. Les gestes gardent leur ordre.
 */
function corrigerHeure(evs: Evenement[], i: number, hhmm: string, maintenant: number): Evenement[] {
  const [h, m] = hhmm.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return evs
  const bas = i > 0 ? evs[i - 1].at : -Infinity
  const haut = i < evs.length - 1 ? evs[i + 1].at : maintenant
  const d = new Date(evs[i].at)
  d.setHours(h, m, 0, 0)
  let at = d.getTime()
  const JOUR = 86400000
  if (at > haut && at - JOUR >= bas) at -= JOUR
  else if (at < bas && at + JOUR <= haut) at += JOUR
  at = Math.min(haut, Math.max(bas, at))
  return evs.map((e, j) => (j === i ? { ...e, at } : e))
}

/**
 * Effacer un geste cliqué par erreur. Une pause et la reprise qui la suit
 * vont ensemble : supprimer l'une emporte l'autre, et le temps entre les deux
 * redevient du temps joué. Le début ne s'efface pas ici (« Remettre à zéro »).
 */
function effacerGeste(evs: Evenement[], i: number): Evenement[] {
  const e = evs[i]
  if (!e || e.t === 'debut') return evs
  let de = i
  let a = i
  if (e.t === 'pause' && evs[i + 1]?.t === 'reprise') a = i + 1
  if (e.t === 'reprise' && evs[i - 1]?.t === 'pause') de = i - 1
  return evs.filter((_, j) => j < de || j > a)
}

const enHHMM = (ms: number): string => {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

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
  /* Corriger les heures : on travaille sur un brouillon, posé par « Enregistrer ».
     Recliquer le crayon l'abandonne. */
  const [brouillon, setBrouillon] = useState<Evenement[] | null>(null)
  const corriger = brouillon !== null

  // La séance change : on relit sa liste.
  useEffect(() => {
    setEvs([])
    setBrouillon(null)
    if (sessionId === null) return
    let vivant = true
    void window.jdr.reglages.campagne().then((brut) => {
      if (!vivant) return
      try {
        const lu = JSON.parse(brut[cle(sessionId)] ?? '[]')
        const liste: Evenement[] = Array.isArray(lu) ? lu : []
        const juste = finALaPause(liste)
        setEvs(juste)
        if (juste !== liste) void window.jdr.reglages.poserCampagne(cle(sessionId), JSON.stringify(juste))
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
    const suite = finALaPause([...evs, { t, at: Date.now() }])
    setEvs(suite)
    setMaintenant(Date.now())
    void window.jdr.reglages.poserCampagne(cle(sessionId), JSON.stringify(suite))
    /* Les minuteries suivent l'horloge : le repas ne fait pas tomber le générateur. */
    if (t === 'pause' || t === 'fin') minuteries.suspendre()
    if (t === 'reprise') minuteries.relancer()
  }

  const enregistrer = (): void => {
    if (!brouillon) return
    const avant = etatDe(evs)
    const apres = etatDe(brouillon)
    setEvs(brouillon)
    setBrouillon(null)
    void window.jdr.reglages.poserCampagne(cle(sessionId), JSON.stringify(brouillon))
    /* Une pause ou une fin effacée relance les minuteries, et inversement. */
    if (avant !== 'en-cours' && apres === 'en-cours') minuteries.relancer()
    if (avant === 'en-cours' && apres !== 'en-cours') minuteries.suspendre()
  }

  /* Pendant la correction, l'affichage suit le brouillon. */
  const vus = brouillon ?? evs
  const etatVu = etatDe(vus)
  const debut = vus.find((e) => e.t === 'debut')?.at
  const dernier = vus[vus.length - 1]
  const joue = tempsJoue(vus, maintenant)
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
            {etatVu === 'pause' && dernier ? ` · pause depuis ${heure(dernier.at)}` : null}
            {etatVu === 'finie' && dernier ? ` · fin ${heure(dernier.at)}` : null}
            <button
              type="button"
              className={`hs-corriger${corriger ? ' on' : ''}`}
              title={
                corriger
                  ? 'Abandonner les corrections'
                  : 'Corriger les heures — une séance commencée ou finie sans cliquer à temps'
              }
              aria-label="Corriger les heures"
              aria-pressed={corriger}
              onClick={() => setBrouillon(corriger ? null : evs)}
            >
              <IconPen />
            </button>
          </div>
          {corriger ? (
            <ul className="hs-journal">
              {brouillon.map((e, i) => (
                <li key={i}>
                  <span>{LIBELLES[e.t]}</span>
                  <input
                    type="time"
                    className="num"
                    value={enHHMM(e.at)}
                    onChange={(ev) => setBrouillon(corrigerHeure(brouillon, i, ev.target.value, Date.now()))}
                  />
                  {e.t !== 'debut' ? (
                    <button
                      type="button"
                      className="hs-effacer"
                      title={
                        e.t === 'pause' && brouillon[i + 1]?.t === 'reprise'
                          ? 'Supprimer cette pause et sa reprise'
                          : e.t === 'reprise' && brouillon[i - 1]?.t === 'pause'
                            ? 'Supprimer cette reprise et sa pause'
                            : `Supprimer : ${LIBELLES[e.t]}`
                      }
                      aria-label={`Supprimer : ${LIBELLES[e.t]}`}
                      onClick={() => setBrouillon(effacerGeste(brouillon, i))}
                    >
                      <IconClose />
                    </button>
                  ) : (
                    <span className="hs-effacer" aria-hidden />
                  )}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="hs-gestes">
            {corriger ? (
              <>
                <button className="btn btn-sm" onClick={enregistrer}>
                  Enregistrer
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setBrouillon(null)}>
                  Annuler
                </button>
              </>
            ) : etat === 'en-cours' ? (
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
            {corriger ? null : etat !== 'finie' ? (
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
