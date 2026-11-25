/**
 * La planche de spiritisme : le MJ appuie sur une case (bouton ou touche du
 * clavier) et la goutte glisse jusqu'à elle, sa vitre au-dessus de la lettre.
 * Tant qu'elle se déplace, on ne peut pas en demander une autre.
 *
 * La planche (assets/chasse/planche.jpg, 1536 × 1024) et la goutte
 * (assets/chasse/planchette.png, détourée, vitre rendue transparente) sont
 * deux images : la goutte se pose par-dessus, sa vitre centrée sur la case.
 * Les positions des cases sont dans spiritisme.ts.
 *
 * Rien ne part vers l'écran ni les portables.
 */
import { useEffect, useRef, useState } from 'react'
import imagePlanche from '../../assets/chasse/planche.jpg'
import imageGoutte from '../../assets/chasse/planchette.png'
import {
  CASES_CHIFFRES,
  CASES_LETTRES,
  CASES_MOTS,
  PLANCHE_H,
  PLANCHE_L,
  REPOS,
  TOUTES_LES_CASES,
  caseDeLaTouche,
  dureeTrajet,
  pointDuTrajet,
  type Case
} from './spiritisme'

/** L'identifiant d'une « case » hors de la planche : la goutte chassée. */
const DEHORS = '(dehors)'

/** Le centre de la vitre, en part de l'image de la goutte (937 × 1301 détourée). */
const VITRE = { x: 467 / 937, y: 795 / 1301 }

export function Planche({ visible }: { visible: boolean }): JSX.Element {
  const [position, setPosition] = useState<{ x: number; y: number; angle: number }>({
    x: REPOS.x,
    y: REPOS.y,
    angle: -4
  })
  const [enRoute, setEnRoute] = useState<string | null>(null)
  const [vitesse, setVitesse] = useState(1)
  const [message, setMessage] = useState<string[]>([])
  const ici = useRef<Case>(REPOS)
  const angle = useRef(-4)
  const cadre = useRef(0)

  useEffect(() => () => cancelAnimationFrame(cadre.current), [])

  /**
   * `chassee` : la goutte file tout droit, en accélérant, sans tourner —
   * aucune main ne la guide plus.
   */
  const aller = (cible: Case, chassee = false): void => {
    if (enRoute) return
    const de = ici.current
    /* Chassée : un éclair. Revenant de dehors : elle rentre vite, pas en flânant. */
    const duree = chassee
      ? Math.round(520 / Math.max(0.4, vitesse))
      : dureeTrajet(de, cible, de.id === DEHORS ? vitesse * 2.2 : vitesse)
    const courbure = (Math.random() - 0.5) * 0.35
    const angleDepart = angle.current
    const angleArrivee = chassee ? angleDepart : (Math.random() - 0.5) * 14
    const debut = performance.now()
    setEnRoute(cible.id)
    const pas = (maintenant: number): void => {
      const t = Math.min(1, (maintenant - debut) / duree)
      if (chassee) {
        /* En ligne droite, de plus en plus vite. */
        const u = Math.pow(t, 2.4)
        setPosition({ x: de.x + (cible.x - de.x) * u, y: de.y + (cible.y - de.y) * u, angle: angleDepart })
      } else {
        const p = pointDuTrajet(de, cible, t, courbure)
        /* Elle penche dans le sens où on la pousse, puis se pose de travers. */
        const elan = Math.sin(Math.PI * t) * Math.max(-10, Math.min(10, (cible.x - de.x) / 40))
        const a = angleDepart + (angleArrivee - angleDepart) * t + elan
        setPosition({ x: p.x, y: p.y, angle: a })
      }
      if (t < 1) {
        cadre.current = requestAnimationFrame(pas)
        return
      }
      /* Chassée très loin pour sortir sûrement ; mais elle attend juste derrière
         le bord, pour revenir sans traîner. */
      ici.current =
        cible.id === DEHORS
          ? {
              id: DEHORS,
              x: Math.max(-220, Math.min(PLANCHE_L + 220, cible.x)),
              y: Math.max(-220, Math.min(PLANCHE_H + 220, cible.y))
            }
          : cible
      angle.current = angleArrivee
      setEnRoute(null)
      /* Seules les vraies cases s'écrivent : ni le centre, ni la sortie. */
      if (TOUTES_LES_CASES.includes(cible)) setMessage((m) => [...m, cible.id])
    }
    cadre.current = requestAnimationFrame(pas)
  }

  const dehors = ici.current.id === DEHORS

  /* Hors de la planche, tout droit, un peu en diagonale vers la droite de sa
     pointe : assez loin pour sortir quel que soit le bord. Elle reviendra par là. */
  const DIAGONALE = 25
  const sortir = (): void => {
    const { x, y } = ici.current
    const a = ((angle.current + DIAGONALE) * Math.PI) / 180
    const loin = 2200
    aller({ id: DEHORS, x: x + Math.sin(a) * loin, y: y - Math.cos(a) * loin }, true)
  }

  /* Au clavier : une lettre ou un chiffre l'envoie, si l'on n'écrit pas ailleurs. */
  useEffect(() => {
    if (!visible) return
    const touche = (e: KeyboardEvent): void => {
      const cible = e.target as HTMLElement | null
      if (cible && (cible.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(cible.tagName))) return
      if (e.ctrlKey || e.altKey || e.metaKey) return
      const c = caseDeLaTouche(e.key)
      if (!c) return
      e.preventDefault()
      aller(c)
    }
    window.addEventListener('keydown', touche)
    return () => window.removeEventListener('keydown', touche)
  })

  const bouton = (c: Case): JSX.Element => (
    <button
      key={c.id}
      className={`btn btn-sm${enRoute === c.id ? ' btn-on' : ''}`}
      disabled={enRoute !== null}
      onClick={() => aller(c)}
    >
      {c.id}
    </button>
  )

  return (
    <div className="planche-case">
      <div className="planche">
        <img className="planche-fond" src={imagePlanche} alt="Planche de spiritisme" draggable={false} />
        <img
          className="planche-goutte"
          src={imageGoutte}
          alt=""
          aria-hidden
          draggable={false}
          style={{
            left: `${(position.x / PLANCHE_L) * 100}%`,
            top: `${(position.y / PLANCHE_H) * 100}%`,
            transform: `translate(${-VITRE.x * 100}%, ${-VITRE.y * 100}%) rotate(${position.angle}deg)`,
            transformOrigin: `${VITRE.x * 100}% ${VITRE.y * 100}%`
          }}
        />
      </div>

      <div className="planche-commandes">
        <div className="emf-champ">
          <div className="planche-touches planche-mots">{CASES_MOTS.map(bouton)}</div>
          <div className="planche-touches">{CASES_LETTRES.map(bouton)}</div>
          <div className="planche-touches">{CASES_CHIFFRES.map(bouton)}</div>
        </div>

        <label className="emf-champ">
          <span className="eyebrow">Vitesse de la goutte&nbsp;: ×{vitesse.toFixed(1)}</span>
          <input
            type="range"
            min={0.4}
            max={2.5}
            step={0.1}
            value={vitesse}
            onChange={(e) => setVitesse(Number(e.target.value))}
          />
        </label>

        <div className="emf-champ">
          <span className="eyebrow">Ce qu’elle a montré</span>
          <div className="planche-message">{message.length ? message.join(' · ') : '—'}</div>
          <div className="emf-ligne">
            <button className="btn btn-sm btn-ghost" onClick={() => setMessage([])} disabled={!message.length}>
              Effacer
            </button>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => aller(REPOS)}
              disabled={enRoute !== null || ici.current === REPOS || dehors}
            >
              Ramener au centre
            </button>
          </div>
        </div>

        <div className="emf-champ">
          <button
            className={`btn${dehors ? ' btn-brass' : ''}`}
            onClick={() => (dehors ? aller(REPOS) : sortir())}
            disabled={enRoute !== null}
            title={dehors ? 'Elle revient au centre de la planche' : 'Elle file hors de la planche par le bord le plus proche'}
          >
            {dehors ? 'Ramener la goutte' : 'Faire sortir la goutte'}
          </button>
        </div>
      </div>
    </div>
  )
}
