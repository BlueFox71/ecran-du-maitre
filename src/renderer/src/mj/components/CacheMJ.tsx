/**
 * Le cache du MJ : un œil dans la barre du haut, et d'un clic l'écran du MJ se
 * voile. Un joueur qui passe derrière lui pour aller chercher à boire ne lit
 * plus rien des notes ni des pièces pas encore découvertes.
 *
 * Seule la fenêtre du MJ se voile : l'écran des joueurs et les téléphones ne
 * bougent pas. Un clic n'importe où, Échap, ou l'œil à nouveau : on revient.
 */
import { useEffect, useState } from 'react'
import { IconEyeOff } from './Icons'

const PHRASES = [
  'Pas de coup d’œil, aventurier !',
  'Les secrets du MJ sont bien gardés.',
  'Ce qui se trame ici ne vous regarde pas… encore.',
  'Un jet de Discrétion ne suffira pas.',
  'Retournez à votre place, les dés vous attendent.'
]

export function CacheMJ(): JSX.Element {
  const [cache, setCache] = useState(false)
  const [phrase, setPhrase] = useState(0)

  const basculer = (): void => {
    setCache((c) => {
      if (!c) setPhrase(Math.floor(Math.random() * PHRASES.length))
      return !c
    })
  }

  useEffect(() => {
    if (!cache) return
    const touche = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setCache(false)
      }
    }
    window.addEventListener('keydown', touche, true)
    return () => window.removeEventListener('keydown', touche, true)
  }, [cache])

  return (
    <>
      <button
        className="cache-mj-oeil"
        aria-pressed={cache}
        title="Cacher l’écran aux regards indiscrets"
        aria-label="Cacher l’écran"
        onClick={basculer}
      >
        <IconEyeOff />
      </button>
      {cache ? (
        <div
          className="cache-mj-voile"
          role="dialog"
          aria-modal="true"
          aria-label="Écran caché"
          onClick={() => setCache(false)}
        >
          <div className="cache-mj-carte">
            <svg className="cache-mj-icone" viewBox="0 0 120 80" aria-hidden="true">
              {/* Un œil qui dort, ses cils, et deux « z » qui s'envolent. */}
              <path className="paupiere" d="M14 40 C 34 62, 86 62, 106 40" />
              <path className="cil" d="M24 50 l-7 9 M40 56 l-4 10 M60 58 v11 M80 56 l4 10 M96 50 l7 9" />
              <path className="z" d="M84 10 h10 l-10 12 h10" />
              <path className="z petit" d="M100 2 h7 l-7 8 h7" />
            </svg>
            <h2>L’œil du Maître est fermé</h2>
            <p>{PHRASES[phrase]}</p>
            <span className="cache-mj-aide">Clic ou Échap pour revenir</span>
          </div>
        </div>
      ) : null}
    </>
  )
}
