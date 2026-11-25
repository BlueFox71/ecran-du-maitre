/**
 * La photo du thermomètre (assets/chasse/thermometre.png, détourée, recadrée à
 * 499 × 1520 puis réduite de moitié, vue de face) et, dans son écran, la
 * température en chiffres à segments (DSEG7, licence OFL — déclarée dans
 * app.css). Partagée par la page du MJ, les plans et les portables : aucune
 * dépendance au store.
 */
import imageThermometre from '../../assets/chasse/thermometre.png'
import { froid, texteTemperature } from './temperature'

/** L'écran sur la photo, en pixels du recadrage (499 × 1520) : seules les proportions comptent. */
const ECRAN = { x: 94, y: 228, l: 312, h: 278 }
const PHOTO_L = 499
const PHOTO_H = 1520

const pourcent = (v: number, total: number): string => `${(v / total) * 100}%`

/** `t` : la température affichée, en °C ; `eteint` : écran noir. */
export function EcranThermometre({ t, eteint = false }: { t: number; eteint?: boolean }): JSX.Element {
  return (
    <div className="thermo">
      <img src={imageThermometre} alt="Thermomètre infrarouge" draggable={false} />
      <div
        className={`thermo-ecran${eteint ? ' eteint' : ''}`}
        style={{
          left: pourcent(ECRAN.x, PHOTO_L),
          top: pourcent(ECRAN.y, PHOTO_H),
          width: pourcent(ECRAN.l, PHOTO_L),
          height: pourcent(ECRAN.h, PHOTO_H),
          ['--froid' as string]: froid(t)
        }}
      >
        {eteint ? null : (
          <>
            <span className="thermo-unite">°C</span>
            <span className="thermo-chiffres">
              {/* Les segments éteints, en fantôme derrière, comme sur un vrai écran. */}
              <span className="thermo-fond" aria-hidden>
                {'-88.8'}
              </span>
              <span className="thermo-valeur">{texteTemperature(t)}</span>
            </span>
          </>
        )}
      </div>
    </div>
  )
}
