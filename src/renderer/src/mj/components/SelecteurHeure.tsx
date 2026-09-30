import { useEffect, useRef, useState } from 'react'

/* ============================================================
   L'heure d'un moment, sans la taper : un bouton qui affiche « 21h30 »,
   et qui s'ouvre sur deux grilles — l'heure, puis les minutes par cinq.
   La molette et les flèches avancent de cinq minutes sans rien ouvrir.
   L'heure reste écrite « 21h30 » en base, comme avant.
   ============================================================ */

const HEURES = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5)

/** « 21h30 », « 21h », « 21:30 » → minutes depuis minuit ; null si illisible. */
export function lireHeure(v: string | null): number | null {
  const m = v ? /^(\d{1,2})\s*[h:]\s*(\d{0,2})$/i.exec(v.trim()) : null
  if (!m) return null
  const h = Number(m[1])
  const mn = Number(m[2] || 0)
  if (h > 23 || mn > 59) return null
  return h * 60 + mn
}

export function ecrireHeure(total: number): string {
  const t = ((total % 1440) + 1440) % 1440
  return `${Math.floor(t / 60)}h${String(t % 60).padStart(2, '0')}`
}

export function SelecteurHeure({
  value,
  onChange
}: {
  value: string | null
  onChange: (v: string | null) => void
}): JSX.Element {
  const [ouvert, setOuvert] = useState(false)
  const racine = useRef<HTMLDivElement>(null)
  const bouton = useRef<HTMLButtonElement>(null)
  const total = lireHeure(value)
  const h = total === null ? null : Math.floor(total / 60)
  const mn = total === null ? null : total % 60

  // Avancer de cinq minutes en cinq minutes, calé sur la grille.
  const pas = (sens: 1 | -1): void => {
    if (total === null) return onChange('21h00')
    const cale = sens > 0 ? Math.floor(total / 5) * 5 + 5 : Math.ceil(total / 5) * 5 - 5
    onChange(ecrireHeure(cale))
  }
  const pasRef = useRef(pas)
  pasRef.current = pas

  // La molette doit pouvoir empêcher le défilement : écouteur non passif.
  useEffect(() => {
    const el = bouton.current
    if (!el) return
    const roule = (e: WheelEvent): void => {
      e.preventDefault()
      pasRef.current(e.deltaY < 0 ? 1 : -1)
    }
    el.addEventListener('wheel', roule, { passive: false })
    return () => el.removeEventListener('wheel', roule)
  }, [])

  useEffect(() => {
    if (!ouvert) return
    const dehors = (e: PointerEvent): void => {
      if (!racine.current?.contains(e.target as Node)) setOuvert(false)
    }
    const echap = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOuvert(false)
    }
    window.addEventListener('pointerdown', dehors)
    window.addEventListener('keydown', echap)
    return () => {
      window.removeEventListener('pointerdown', dehors)
      window.removeEventListener('keydown', echap)
    }
  }, [ouvert])

  return (
    <div className="selheure" ref={racine}>
      <button
        ref={bouton}
        type="button"
        className={`selheure-val num${ouvert ? ' on' : ''}`}
        onClick={() => setOuvert(!ouvert)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            pas(e.key === 'ArrowUp' ? 1 : -1)
          }
        }}
        title="Choisir l'heure — la molette ou les flèches avancent de cinq minutes"
      >
        {value ?? '—'}
      </button>

      {ouvert ? (
        <div className="selheure-pop">
          <span className="selheure-leg">Heure</span>
          <div className="selheure-grille h">
            {HEURES.map((x) => (
              <button
                key={x}
                type="button"
                className={`num${x === h ? ' on' : ''}`}
                onClick={() => onChange(ecrireHeure(x * 60 + (mn ?? 0)))}
              >
                {x}h
              </button>
            ))}
          </div>
          <span className="selheure-leg">Minutes</span>
          <div className="selheure-grille m">
            {MINUTES.map((x) => (
              <button
                key={x}
                type="button"
                className={`num${x === mn ? ' on' : ''}`}
                onClick={() => {
                  onChange(ecrireHeure((h ?? 21) * 60 + x))
                  setOuvert(false)
                }}
              >
                {String(x).padStart(2, '0')}
              </button>
            ))}
          </div>
          <footer>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={value === null}
              onClick={() => {
                onChange(null)
                setOuvert(false)
              }}
            >
              Sans heure
            </button>
            <span className="spacer" />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOuvert(false)}>
              Fermer
            </button>
          </footer>
        </div>
      ) : null}
    </div>
  )
}
