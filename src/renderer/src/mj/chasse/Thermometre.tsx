/**
 * Le thermomètre : la photo de l'appareil (assets/chasse/thermometre.png,
 * détourée, recadrée à 499 × 1520 puis réduite de moitié, vue de face), et dans son écran la température, en chiffres à
 * segments (DSEG7, licence OFL — déclarée dans app.css).
 *
 * Le MJ choisit une température ; l'écran la rejoint en douceur et la mesure
 * se rafraîchit toutes les demi-secondes, avec le petit bruit d'un vrai
 * appareil. Rien ne part vers l'écran ni les portables.
 */
import { useEffect, useRef, useState } from 'react'
import imageThermometre from '../../assets/chasse/thermometre.png'
import {
  TEMPERATURE_MAX,
  TEMPERATURE_MIN,
  bornerTemperature,
  froid,
  rapprocher,
  texteTemperature
} from './temperature'

/** L'écran sur la photo, en pixels du recadrage (499 × 1520) : seules les proportions comptent. */
const ECRAN = { x: 94, y: 228, l: 312, h: 278 }
const PHOTO_L = 499
const PHOTO_H = 1520
/** Un vrai thermomètre infrarouge ne rafraîchit pas en continu. */
const RAFRAICHISSEMENT_MS = 500

const PALIERS = [20, 15, 10, 5, 0, -5]

export function Thermometre(): JSX.Element {
  const [allume, setAllume] = useState(true)
  const [cible, setCible] = useState(18)
  const [vitesse, setVitesse] = useState(1.5)
  const [mesure, setMesure] = useState(18)
  /* La valeur « vraie », qui glisse vers la cible ; la mesure en est la lecture bruitée. */
  const vraie = useRef(18)
  const cibleRef = useRef(cible)
  const vitesseRef = useRef(vitesse)
  cibleRef.current = cible
  vitesseRef.current = vitesse

  useEffect(() => {
    if (!allume) return
    const t = setInterval(() => {
      vraie.current = rapprocher(vraie.current, cibleRef.current, vitesseRef.current, RAFRAICHISSEMENT_MS / 1000)
      const bruit = (Math.random() - 0.5) * 0.2
      setMesure(bornerTemperature(vraie.current + bruit))
    }, RAFRAICHISSEMENT_MS)
    return () => clearInterval(t)
  }, [allume])

  const f = froid(mesure)
  const pourcent = (v: number, total: number): string => `${(v / total) * 100}%`

  return (
    <div className="emf-case">
      <div className="emf-appareil">
        <div className="thermo">
          <img src={imageThermometre} alt="Thermomètre infrarouge" draggable={false} />
          <div
            className={`thermo-ecran${allume ? '' : ' eteint'}`}
            style={{
              left: pourcent(ECRAN.x, PHOTO_L),
              top: pourcent(ECRAN.y, PHOTO_H),
              width: pourcent(ECRAN.l, PHOTO_L),
              height: pourcent(ECRAN.h, PHOTO_H),
              ['--froid' as string]: f
            }}
          >
            {allume ? (
              <>
                <span className="thermo-unite">°C</span>
                <span className="thermo-chiffres">
                  {/* Les segments éteints, en fantôme derrière, comme sur un vrai écran. */}
                  <span className="thermo-fond" aria-hidden>
                    {'-88.8'}
                  </span>
                  <span className="thermo-valeur">{texteTemperature(mesure)}</span>
                </span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="emf-commandes">
        <button className={`btn${allume ? ' btn-brass' : ''}`} onClick={() => setAllume((a) => !a)}>
          {allume ? 'Éteindre' : 'Allumer'}
        </button>

        <label className="emf-champ">
          <span className="eyebrow">Température visée&nbsp;: {texteTemperature(cible)} °C</span>
          <input
            type="range"
            min={TEMPERATURE_MIN}
            max={TEMPERATURE_MAX}
            step={0.5}
            value={cible}
            onChange={(e) => setCible(Number(e.target.value))}
          />
          <span className="emf-paliers">
            {PALIERS.map((p) => (
              <button
                key={p}
                className={`btn btn-sm${cible === p ? ' btn-on' : ''}`}
                onClick={() => setCible(p)}
              >
                {p}°
              </button>
            ))}
          </span>
        </label>

        <label className="emf-champ">
          <span className="eyebrow">Rapidité&nbsp;: {vitesse.toFixed(1)} °C par seconde</span>
          <input
            type="range"
            min={0.2}
            max={6}
            step={0.1}
            value={vitesse}
            onChange={(e) => setVitesse(Number(e.target.value))}
          />
        </label>
      </div>
    </div>
  )
}
