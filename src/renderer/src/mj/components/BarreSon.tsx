/**
 * La barre d'un son : les volumes de son fichier en bâtons, et, pendant
 * qu'on l'écoute, la part déjà jouée qui se colore et avance. Un clic sur la
 * barre lance l'écoute à cet endroit — ou y saute, si elle joue déjà.
 *
 * Elle ne lit que l'aperçu (le casque du MJ), jamais ce qui joue à la table.
 */
import { useEffect, useState } from 'react'
import type { Son } from '@shared/types'
import { BATONS, chercherApercu, duree, ecouter, ondeDe, positionApercu, useSons } from '../sons'

export function BarreSon({
  son,
  itemId,
  className = ''
}: {
  son: Son
  /** Ce fichier-là ; sans lui, celui qu'on entend, sinon le premier. */
  itemId?: number
  className?: string
}): JSX.Element | null {
  const apercu = useSons((x) => x.apercu)
  const apercuFichier = useSons((x) => x.apercuFichier)
  const ecoute = apercu === son.id
  const f =
    son.fichiers.find((x) => x.itemId === (itemId ?? (ecoute ? apercuFichier : undefined))) ?? son.fichiers[0] ?? null
  const joue = ecoute && f != null && apercuFichier === f.itemId
  const [onde, setOnde] = useState<number[] | null>(null)
  const [t, setT] = useState(0)

  useEffect(() => {
    setOnde(null)
    if (!f?.url) return
    let vivant = true
    void ondeDe(f.url).then((o) => vivant && setOnde(o))
    return () => {
      vivant = false
    }
  }, [f?.url])

  /* La tête de lecture suit l'aperçu, à chaque image. */
  useEffect(() => {
    if (!joue) {
      setT(0)
      return
    }
    let r = 0
    const tic = (): void => {
      setT(positionApercu() ?? 0)
      r = requestAnimationFrame(tic)
    }
    r = requestAnimationFrame(tic)
    return () => cancelAnimationFrame(r)
  }, [joue])

  if (!f) return null
  const batons = onde ?? Array.from({ length: BATONS }, () => 0.12)
  const fait = Math.round(t * batons.length)

  return (
    <div
      className={`snd-barre n-${son.nature}${joue ? ' joue' : ''}${onde ? '' : ' plate'} ${className}`}
      role="slider"
      aria-label={`Barre de son : ${f.titre}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(t * 100)}
      title={joue ? 'Clique pour sauter à cet endroit' : 'Clique pour écouter à partir d’ici'}
      onClick={(e) => {
        e.stopPropagation()
        if ((e.target as HTMLElement).closest('.temps')) return
        /* Les bâtons seuls, pas le temps écrit à droite : sinon le clic
           tombait plus à gauche que la tête de lecture. */
        const zone = e.currentTarget.querySelector('.batons') ?? e.currentTarget
        const b = zone.getBoundingClientRect()
        const x = Math.min(1, Math.max(0, (e.clientX - b.left) / b.width))
        if (joue) chercherApercu(x)
        else ecouter(son, f.itemId, x)
      }}
    >
      <div className="batons">
        {batons.map((v, i) => (
          <i key={i} className={i < fait ? 'fait' : ''} style={{ height: `${Math.max(6, v * 100)}%` }} />
        ))}
        {joue ? <span className="tete" style={{ left: `${t * 100}%` }} /> : null}
      </div>
      <span className="temps num">
        {joue && f.duree ? `${duree(t * f.duree)} / ` : ''}
        {duree(f.duree)}
      </span>
    </div>
  )
}
