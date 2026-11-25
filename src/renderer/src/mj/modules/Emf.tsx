/**
 * L'EMF — premier outil du chasseur de fantômes.
 *
 * Un mini-module pour régler l'effet avant de le brancher sur la carte : le MJ
 * monte un curseur (ou lance une « approche ») et l'appareil réagit, LED et
 * son. Rien ne part vers l'écran ni les portables.
 */
import { useEffect, useRef, useState } from 'react'
import sonNiveau3 from '../../assets/chasse/emf-niveau3.mp3'
import { NIVEAU_MAX, SonEmf, courbeApproche } from '../chasse/emf'
import { PhotoEmf } from '../chasse/PhotoEmf'
import { useNiveauVivant } from '../chasse/vivant'

/** La durée d'une « approche », aller et retour, en secondes. */
const DUREE_APPROCHE = 9

export function Emf(): JSX.Element {
  const son = useRef<SonEmf | null>(null)
  const [allume, setAllume] = useState(false)
  const [cible, setCible] = useState(0)
  const [volume, setVolume] = useState(0.6)
  const [approche, setApproche] = useState<number | null>(null)

  useEffect(() => () => son.current?.arreter(), [])

  /* Le niveau affiché tremble toujours autour de la cible ; le son le suit. */
  const affiche = useNiveauVivant(cible, allume)
  useEffect(() => {
    son.current?.setNiveau(affiche)
  }, [affiche])

  /* La courbe de l'approche, quand elle est lancée, pilote la cible. */
  useEffect(() => {
    if (!allume || approche === null) return
    let cadre = 0
    let dernier = 0
    const boucle = (t: number): void => {
      cadre = requestAnimationFrame(boucle)
      if (t - dernier < 90) return
      dernier = t
      const e = (performance.now() - approche) / 1000
      if (e >= DUREE_APPROCHE) {
        setApproche(null)
        setCible(0)
      } else {
        setCible(Math.round(courbeApproche(e, DUREE_APPROCHE) * 10) / 10)
      }
    }
    cadre = requestAnimationFrame(boucle)
    return () => cancelAnimationFrame(cadre)
  }, [allume, approche])

  const basculer = (): void => {
    if (allume) {
      son.current?.setNiveau(0)
      setApproche(null)
      setAllume(false)
      return
    }
    if (!son.current) son.current = new SonEmf(sonNiveau3)
    son.current.setVolume(volume)
    son.current.demarrer()
    setAllume(true)
  }

  const lancerApproche = (): void => {
    if (!allume) basculer()
    setApproche(performance.now())
  }

  return (
    <div className="emf-case">
        <div className={`emf-appareil${allume ? ' on' : ''}`}>
          <PhotoEmf n={affiche} eteint={!allume} />
        </div>

        <div className="emf-commandes">
          <button className={`btn${allume ? ' btn-brass' : ''}`} onClick={basculer}>
            {allume ? 'Éteindre' : 'Allumer'}
          </button>

          <label className="emf-champ">
            <span className="eyebrow">
              Niveau&nbsp;: {cible.toFixed(1)} / {NIVEAU_MAX}
            </span>
            <input
              type="range"
              min={0}
              max={NIVEAU_MAX}
              step={0.1}
              value={cible}
              disabled={!allume}
              onChange={(e) => {
                setApproche(null)
                setCible(Number(e.target.value))
              }}
            />
            <span className="emf-paliers">
              {[0, 1, 2, 3, 4, 5].map((p) => (
                <button
                  key={p}
                  className="btn btn-sm"
                  disabled={!allume}
                  onClick={() => {
                    setApproche(null)
                    setCible(p)
                  }}
                >
                  {p}
                </button>
              ))}
            </span>
          </label>

          <div className="emf-ligne">
            <button className="btn" onClick={lancerApproche} disabled={approche !== null}>
              Approche
            </button>
            <span className="emf-aide">Monte jusqu’à 5, tient, puis redescend ({DUREE_APPROCHE} s).</span>
          </div>

          <label className="emf-champ">
            <span className="eyebrow">Volume&nbsp;: {Math.round(volume * 100)} %</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => {
                const v = Number(e.target.value)
                setVolume(v)
                son.current?.setVolume(v)
              }}
            />
          </label>
        </div>
    </div>
  )
}
