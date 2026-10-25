import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Les minuteries de la séance, sous l'horloge : un générateur qui tient
 * quarante minutes, un rituel qui s'achève, des renforts en route. On en lance
 * autant qu'on veut ; quand l'une tombe à zéro, le MJ est prévenu par une
 * alerte qui reste jusqu'à ce qu'il l'ait vue. Pas de son : il sortirait par
 * les haut-parleurs de la table. Rien ne part vers les joueurs.
 *
 * Elles suivent l'horloge : la pause du repas les arrête, la reprise les
 * relance. Rangées comme elle dans les réglages de la campagne
 * (`seance.minuteries.<id>`), elles survivent à un redémarrage.
 */
export interface Minuterie {
  id: string
  nom: string
  /** En millisecondes ; « +5 min » l'allonge. */
  duree: number
  /** Le temps déjà couru avant `depuis`. */
  ecoule: number
  /** L'instant où elle est repartie ; null : arrêtée. */
  depuis: number | null
  /** Arrêtée par la pause de l'horloge — c'est la reprise qui la relance. */
  suspendue?: boolean
  /** L'alerte de fin a été vue. */
  vue?: boolean
  /** Un chronomètre : il compte vers le haut, sans fin ni alerte. */
  montant?: boolean
}

const cle = (sessionId: number): string => `seance.minuteries.${sessionId}`
const MIN = 60000
const DUREES = [5, 10, 15, 30, 40, 60]

export const restant = (m: Minuterie, maintenant: number): number =>
  m.duree - m.ecoule - (m.depuis != null ? maintenant - m.depuis : 0)

/** 23:41, 1:02:05 ; au-delà de zéro, le dépassement : +2:10. */
function chrono(ms: number): string {
  const neg = ms < 0
  const s = Math.floor(Math.abs(ms) / 1000)
  const h = Math.floor(s / 3600)
  const mm = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${neg ? '+' : ''}${h ? `${h}:` : ''}${mm}:${ss}`
}

export function useMinuteries(sessionId: number | null): {
  liste: Minuterie[]
  maintenant: number
  poser: (l: Minuterie[]) => void
  /** La pause de l'horloge : celles qui tournent s'arrêtent avec elle. */
  suspendre: () => void
  /** La reprise : celles que la pause avait arrêtées repartent. */
  relancer: () => void
} {
  const [liste, setListe] = useState<Minuterie[]>([])
  const [maintenant, setMaintenant] = useState(Date.now())

  useEffect(() => {
    setListe([])
    if (sessionId === null) return
    let vivant = true
    void window.jdr.reglages.campagne().then((brut) => {
      if (!vivant) return
      try {
        const lu = JSON.parse(brut[cle(sessionId)] ?? '[]')
        setListe(Array.isArray(lu) ? lu : [])
      } catch {
        setListe([])
      }
    })
    return () => {
      vivant = false
    }
  }, [sessionId])

  const tourne = liste.some((m) => m.depuis != null)
  useEffect(() => {
    if (!tourne) return
    setMaintenant(Date.now())
    const t = window.setInterval(() => setMaintenant(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [tourne])

  const poser = (l: Minuterie[]): void => {
    setListe(l)
    setMaintenant(Date.now())
    if (sessionId !== null)
      void window.jdr.reglages.poserCampagne(cle(sessionId), l.length ? JSON.stringify(l) : null)
  }

  const suspendre = (): void => {
    const t = Date.now()
    if (!liste.some((m) => m.depuis != null)) return
    poser(
      liste.map((m) =>
        m.depuis != null
          ? {
              ...m,
              ecoule: m.ecoule + t - m.depuis,
              depuis: null,
              suspendue: true
            }
          : m
      )
    )
  }
  const relancer = (): void => {
    const t = Date.now()
    if (!liste.some((m) => m.suspendue)) return
    poser(liste.map((m) => (m.suspendue ? { ...m, depuis: t, suspendue: false } : m)))
  }

  return { liste, maintenant, poser, suspendre, relancer }
}

export function Minuteries({
  m: { liste, maintenant, poser }
}: {
  m: ReturnType<typeof useMinuteries>
}): JSX.Element {
  /* Le formulaire ouvert : une minuterie, ou un chronomètre — sans durée. */
  const [ajout, setAjout] = useState<'minuterie' | 'chrono' | null>(null)
  const [nom, setNom] = useState('')
  const [minutes, setMinutes] = useState(40)
  const [secondes, setSecondes] = useState(0)
  const duree = (minutes * 60 + secondes) * 1000

  const finies = liste.filter((m) => !m.montant && restant(m, maintenant) <= 0 && !m.vue)

  const changer = (id: string, f: (m: Minuterie) => Minuterie): void =>
    poser(liste.map((m) => (m.id === id ? f(m) : m)))

  const lancer = (): void => {
    const montant = ajout === 'chrono'
    if (!montant && duree <= 0) return
    poser([
      ...liste,
      {
        id: `${Date.now()}`,
        nom: nom.trim() || (montant ? 'Chronomètre' : 'Minuterie'),
        duree: montant ? 0 : duree,
        ecoule: 0,
        depuis: Date.now(),
        ...(montant ? { montant: true } : {})
      }
    ])
    setAjout(null)
    setNom('')
  }

  /* Le chronomètre repart de zéro, et garde son allure : en marche, il
     continue ; arrêté, il attend. */
  const remettre = (m: Minuterie): void =>
    changer(m.id, (x) => ({
      ...x,
      ecoule: 0,
      depuis: x.depuis != null ? Date.now() : null
    }))

  const basculer = (m: Minuterie): void => {
    const t = Date.now()
    changer(m.id, (x) =>
      x.depuis != null
        ? {
            ...x,
            ecoule: x.ecoule + t - x.depuis,
            depuis: null,
            suspendue: false
          }
        : { ...x, depuis: t, suspendue: false }
    )
  }

  /* Cinq minutes de plus. Une minuterie déjà finie repart pour cinq minutes
     à compter de maintenant, et son alerte avec elle. */
  const prolonger = (m: Minuterie): void => {
    const r = restant(m, Date.now())
    changer(m.id, (x) => ({
      ...x,
      duree: x.duree + 5 * MIN - Math.min(0, r),
      vue: false
    }))
  }

  return (
    <div className="hs-minuteries">
      {liste.map((m) => {
        const r = restant(m, maintenant)
        const finie = !m.montant && r <= 0
        return (
          <div
            key={m.id}
            className={`hs-min${finie ? ' finie' : ''}${finie && !m.vue ? ' sonne' : ''}${
              m.depuis == null && !finie ? ' arretee' : ''
            }`}
          >
            <span className="hs-min-nom" title={m.nom}>
              {m.nom}
            </span>
            <span className="hs-min-temps num">
              {m.montant ? chrono(-r) : finie ? chrono(r) : chrono(r + 999)}
            </span>
            <span className="hs-min-gestes">
              {!finie ? (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => basculer(m)}
                  title={m.depuis != null ? 'Mettre en pause' : 'Relancer'}
                >
                  {m.depuis != null ? '❚❚' : '▶'}
                </button>
              ) : null}
              {m.montant ? (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => remettre(m)}
                  title="Remettre à zéro"
                >
                  ↺
                </button>
              ) : (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => prolonger(m)}
                  title="Cinq minutes de plus"
                >
                  +5
                </button>
              )}
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => poser(liste.filter((x) => x.id !== m.id))}
                title={m.montant ? 'Retirer ce chronomètre' : 'Retirer cette minuterie'}
                aria-label={`Retirer ${m.nom}`}
              >
                ×
              </button>
            </span>
          </div>
        )
      })}

      {ajout ? (
        <div className="hs-min-ajout">
          <input
            type="text"
            value={nom}
            placeholder={ajout === 'chrono' ? 'Nom — la poursuite' : 'Nom — le générateur'}
            autoFocus
            onChange={(e) => setNom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') lancer()
              if (e.key === 'Escape') setAjout(null)
            }}
          />
          {ajout === 'minuterie' ? (
            <div className="hs-min-durees">
              {DUREES.map((d) => (
                <button
                  key={d}
                  className={`btn btn-sm${minutes === d && secondes === 0 ? ' btn-on' : ''}`}
                  onClick={() => {
                    setMinutes(d)
                    setSecondes(0)
                  }}
                >
                  {d}
                </button>
              ))}
              <input
                type="number"
                min={0}
                max={600}
                value={minutes}
                aria-label="Durée : les minutes"
                onChange={(e) =>
                  setMinutes(Math.max(0, Math.min(600, Math.round(Number(e.target.value) || 0))))
                }
              />
              <span className="unite">min</span>
              <input
                type="number"
                min={0}
                max={59}
                step={5}
                value={secondes}
                aria-label="Durée : les secondes"
                onChange={(e) =>
                  setSecondes(Math.max(0, Math.min(59, Math.round(Number(e.target.value) || 0))))
                }
              />
              <span className="unite">s</span>
            </div>
          ) : null}
          <div className="hs-gestes">
            <button
              className="btn btn-sm"
              disabled={ajout === 'minuterie' && duree <= 0}
              onClick={lancer}
            >
              Lancer
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setAjout(null)}>
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <div className="hs-gestes">
          <button className="btn btn-ghost btn-sm" onClick={() => setAjout('minuterie')}>
            + Minuterie
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setAjout('chrono')}>
            + Chronomètre
          </button>
        </div>
      )}

      {/* L'alerte : en haut de la fenêtre, jusqu'à ce qu'on l'ait vue. Posée
          sur le corps de la page, pour que rien dans le rail ne la retienne. */}
      {finies.length
        ? createPortal(
            <div className="hs-alerte" role="alert">
              <span className="hs-alerte-titre">
                ⏰ {finies.map((m) => m.nom).join(', ')} —{' '}
                {finies.length > 1 ? 'terminées' : 'terminée'}
              </span>
              <button
                className="btn btn-sm"
                onClick={() =>
                  poser(liste.map((m) => (finies.includes(m) ? { ...m, vue: true } : m)))
                }
              >
                Vu
              </button>
            </div>,
            document.body
          )
        : null}
    </div>
  )
}
