import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { useSm } from './etat'

/**
 * Les chronos de santé mentale, aussi dans l'horloge de séance : c'est là que
 * le MJ regarde le temps passer, vue SM ouverte ou non. En rouge, pour ne pas
 * les confondre avec ses minuteries — ceux-ci mordent les joueurs.
 */

/** « 9:15 », comme les minuteries voisines. */
function chrono(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(s / 3600)
  const mm = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, '0')
  return `${h ? `${h}:` : ''}${mm}:${String(s % 60).padStart(2, '0')}`
}

export function ChronosHorloge(): JSX.Element | null {
  const chronos = useSm((s) => s.chronos)
  const arreter = useSm((s) => s.arreterChrono)
  const basculerPause = useSm((s) => s.basculerPause)
  const prix = useStore((s) => s.reglages.sm.prix)
  const actif = useStore((s) => s.reglages.sm.actif)
  const characters = useStore((s) => s.characters)

  const lignes = Object.entries(chronos).flatMap(([id, liste]) =>
    liste.map((c) => ({ id: Number(id), c, prix: prix.find((p) => p.id === c.prixId) }))
  )

  /* L'aiguille ne tourne que s'il y a un chrono à montrer. */
  const [maintenant, setMaintenant] = useState(Date.now())
  const enCours = actif && lignes.length > 0
  useEffect(() => {
    if (!enCours) return
    const t = window.setInterval(() => setMaintenant(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [enCours])

  if (!enCours) return null

  return (
    <div className="hs-minuteries hs-sm">
      {lignes.map(({ id, c, prix: p }) => {
        const enPause = c.resteMs !== undefined
        const nom = characters.find((x) => x.id === id)?.name ?? '?'
        const libelle = `${nom} — ${p?.nom ?? c.prixId}`
        return (
          <div key={`${id}-${c.prixId}`} className={`hs-min hs-min-sm${enPause ? ' arretee' : ''}`}>
            <span
              className="hs-min-nom"
              title={`${libelle}${p ? ` : −${p.perte} SM toutes les ${p.intervalleMin} min` : ''}`}
            >
              {libelle}
            </span>
            <span className="hs-min-temps num">{chrono(enPause ? (c.resteMs ?? 0) : c.prochainA - maintenant)}</span>
            <span className="hs-min-gestes">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => basculerPause(id, c.prixId)}
                title={enPause ? 'Reprendre' : 'Mettre en pause — ce n’est pas son tour'}
              >
                {enPause ? '▶' : '❚❚'}
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => arreter(id, c.prixId)}
                title="Arrêter ce chrono"
                aria-label={`Arrêter ${libelle}`}
              >
                ×
              </button>
            </span>
          </div>
        )
      })}
    </div>
  )
}
