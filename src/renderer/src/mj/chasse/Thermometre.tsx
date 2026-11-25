/**
 * Le thermomètre : la photo de l'appareil (assets/chasse/thermometre.png,
 * détourée, recadrée à 499 × 1520 puis réduite de moitié, vue de face), et dans son écran la température, en chiffres à
 * segments (DSEG7, licence OFL — déclarée dans app.css).
 *
 * Le MJ choisit une température ; l'écran la rejoint en douceur et la mesure
 * se rafraîchit toutes les demi-secondes, avec le petit bruit d'un vrai
 * appareil. Rien ne part vers l'écran ni les portables.
 */
import { useState } from 'react'
import { EcranThermometre } from './EcranThermometre'
import { TEMPERATURE_MAX, TEMPERATURE_MIN, texteTemperature } from './temperature'
import { useTemperatureVivante } from './vivant'

const PALIERS = [20, 15, 10, 5, 0, -5]

export function Thermometre(): JSX.Element {
  const [allume, setAllume] = useState(true)
  const [cible, setCible] = useState(18)
  const [vitesse, setVitesse] = useState(1.5)
  const mesure = useTemperatureVivante(cible, vitesse)

  return (
    <div className="emf-case">
      <div className="emf-appareil">
        <EcranThermometre t={mesure} eteint={!allume} />
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
