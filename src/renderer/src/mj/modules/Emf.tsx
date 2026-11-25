/**
 * L'EMF — premier outil du chasseur de fantômes.
 *
 * Un mini-module pour régler l'effet avant de le brancher sur la carte : le MJ
 * monte un curseur (ou lance une « approche ») et l'appareil réagit, LED et
 * son. Rien ne part vers l'écran ni les portables.
 *
 * Deux photos du même appareil, au pixel près : `emf-eteint.png`, les cinq LED
 * éteintes (retouchées), et `emf.png`, toutes allumées. On pose la première, et
 * pour chaque LED allumée on découvre la seconde dans un petit cercle autour
 * d'elle : rien à caler, c'est la même image.
 */
import { useEffect, useRef, useState } from 'react'
import photoAllumee from '../../assets/chasse/emf.png'
import photoEteinte from '../../assets/chasse/emf-eteint.png'
import sonNiveau3 from '../../assets/chasse/emf-niveau3.mp3'
import { LEDS_EMF, NIVEAU_MAX, SonEmf, borner, courbeApproche, ledsAllumees } from '../chasse/emf'

/** La taille des photos, en pixels. */
const PHOTO_L = 348
const PHOTO_H = 908

/** Les LED sur la photo : centre et rayon du verre, en pixels (mesurés sur l'image). */
const LEDS_PHOTO: { x: number; y: number; r: number }[] = [
  { x: 68.8, y: 58.5, r: 19.0 },
  { x: 121.9, y: 53.0, r: 19.4 },
  { x: 173.3, y: 46.4, r: 21.0 },
  { x: 226.6, y: 50.7, r: 20.4 },
  { x: 279.6, y: 55.0, r: 19.8 }
]
/** De combien le cercle découvert dépasse le verre : assez pour emporter son liseré lumineux. */
const MARGE_DECOUVERTE = 8

/** La durée d'une « approche », aller et retour, en secondes. */
const DUREE_APPROCHE = 9

export function Emf(): JSX.Element {
  const son = useRef<SonEmf | null>(null)
  const [allume, setAllume] = useState(false)
  const [cible, setCible] = useState(0)
  const [affiche, setAffiche] = useState(0)
  const [volume, setVolume] = useState(0.6)
  const [approche, setApproche] = useState<number | null>(null)
  const cibleRef = useRef(cible)
  cibleRef.current = cible

  useEffect(() => () => son.current?.arreter(), [])

  /* L'aiguille ne tient jamais en place : un léger tremblement autour de la
     cible, et la courbe de l'approche quand elle est lancée. */
  useEffect(() => {
    if (!allume) {
      setAffiche(0)
      son.current?.setNiveau(0)
      return
    }
    let cadre = 0
    let dernier = 0
    const boucle = (t: number): void => {
      cadre = requestAnimationFrame(boucle)
      if (t - dernier < 90) return
      dernier = t
      let base = cibleRef.current
      if (approche !== null) {
        const e = (performance.now() - approche) / 1000
        if (e >= DUREE_APPROCHE) {
          setApproche(null)
          setCible(0)
          base = 0
        } else {
          base = courbeApproche(e, DUREE_APPROCHE)
          setCible(Math.round(base * 10) / 10)
        }
      }
      const tremble = base > 0.3 ? (Math.random() - 0.5) * 0.7 : 0
      const n = borner(base + tremble)
      setAffiche(n)
      son.current?.setNiveau(n)
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

  const n = allume ? ledsAllumees(affiche) : 0

  return (
    <div className="emf-case">
        <div className={`emf-appareil${allume ? ' on' : ''}`}>
          <PhotoEmf n={n} />
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

/**
 * L'appareil : la photo éteinte, et pour chaque LED allumée, la photo allumée
 * découverte dans un cercle autour d'elle, plus un halo qui déborde.
 */
function PhotoEmf({ n }: { n: number }): JSX.Element {
  return (
    <div className="emf-photo">
      <img src={photoEteinte} alt="Détecteur EMF" draggable={false} />
      {LEDS_PHOTO.map((p, i) => {
        if (i >= n) return null
        const x = (p.x / PHOTO_L) * 100
        const y = (p.y / PHOTO_H) * 100
        const rx = ((p.r + MARGE_DECOUVERTE) / PHOTO_L) * 100
        const ry = ((p.r + MARGE_DECOUVERTE) / PHOTO_H) * 100
        return (
          <span key={i}>
            <img
              src={photoAllumee}
              alt=""
              aria-hidden
              draggable={false}
              className="emf-allumee"
              style={{ clipPath: `ellipse(${rx}% ${ry}% at ${x}% ${y}%)` }}
            />
            <i
              className="emf-halo"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                width: `${((p.r * 5) / PHOTO_L) * 100}%`,
                ['--led' as string]: LEDS_EMF[i].couleur
              }}
            />
          </span>
        )
      })}
    </div>
  )
}
