import { useEffect, useRef, useState } from 'react'
import { ALLURE_DEFAUT, type Pion } from '@shared/types'

/*
 * Les mêmes allures que le pupitre du téléphone (voir mobile/Mobile.tsx) : un
 * pion mené d'ici marche et tourne comme celui que son joueur mène.
 */
/** Le pivot, en degrés par seconde. */
const PIVOT = 180
/** On prévient la table vingt fois par seconde, pas à chaque image. */
const CADENCE_MS = 50
/** Après un geste, la table ne reprend la main qu'au bout de ce délai. */
const MENE_MS = 550
/** L'écran est plus large que haut : le pas vertical se rapporte à sa largeur. */
const RAPPORT = 16 / 9
const tour = (a: number): number => ((((a + 180) % 360) + 360) % 360) - 180

/**
 * Piloter un pion depuis son détail, comme le joueur depuis son téléphone : un
 * disque qui fait marcher, un anneau qui fait tourner. Le MJ n'est pas retenu
 * par les murs — il pose ses pions où il veut, à la souris comme ici.
 */
export function PilotePion({ pion }: { pion: Pion }): JSX.Element {
  const [pose, setPose] = useState({ x: pion.x, y: pion.y, cap: pion.rotation })
  const poseRef = useRef(pose)
  const geste = useRef(0)
  const pousse = useRef({ x: 0, y: 0 })
  const capVise = useRef<number | null>(null)
  const aEnvoyer = useRef<{ pas: boolean; cap: boolean }>({ pas: false, cap: false })
  const [pouce, setPouce] = useState({ x: 0, y: 0 })
  const [suivre, setSuivre] = useState(true)
  const suivreRef = useRef(suivre)
  suivreRef.current = suivre
  /* Décochée, les murs le retiennent comme sur le téléphone. */
  const [traverse, setTraverse] = useState(false)
  const traverseRef = useRef(traverse)
  traverseRef.current = traverse
  /* La pleine allure, en part de la largeur par seconde : celle que le MJ a
     réglée pour ce plan dans l'éditeur, comme pour les téléphones. */
  const allure = useRef(ALLURE_DEFAUT)
  useEffect(() => {
    let vivant = true
    allure.current = ALLURE_DEFAUT
    void window.jdr.places.echelle(pion.placeId).then((e) => {
      if (vivant) allure.current = e.allure
    })
    return () => {
      vivant = false
    }
  }, [pion.placeId])

  /* Ce que dit la table, quand la main est retombée — ou qu'on change de pion. */
  useEffect(() => {
    if (Date.now() - geste.current < MENE_MS) return
    poseRef.current = { x: pion.x, y: pion.y, cap: pion.rotation }
    setPose(poseRef.current)
  }, [pion.id, pion.x, pion.y, pion.rotation])

  useEffect(() => {
    let vivant = true
    let image = 0
    let avant = performance.now()
    let envoi = 0
    const battre = (now: number): void => {
      if (!vivant) return
      image = requestAnimationFrame(battre)
      const dt = Math.min(0.06, (now - avant) / 1000)
      avant = now

      const p = pousse.current
      const force = Math.min(1, Math.hypot(p.x, p.y))
      if (force > 0.08) {
        const l = Math.hypot(p.x, p.y) || 1
        const pas = allure.current * force * dt
        const q = poseRef.current
        poseRef.current = {
          ...q,
          x: Math.max(0.01, Math.min(0.99, q.x + (p.x / l) * pas)),
          y: Math.max(0.01, Math.min(0.99, q.y + (p.y / l) * pas * RAPPORT))
        }
        if (suivreRef.current) capVise.current = (Math.atan2(p.x, -p.y) * 180) / Math.PI
        geste.current = Date.now()
        aEnvoyer.current.pas = true
      }

      const but = capVise.current
      if (but != null) {
        const q = poseRef.current
        const ecart = tour(but - q.cap)
        const marge = PIVOT * dt
        poseRef.current = Math.abs(ecart) <= marge ? { ...q, cap: but } : { ...q, cap: tour(q.cap + Math.sign(ecart) * marge) }
        if (Math.abs(ecart) <= marge) capVise.current = null
        geste.current = Date.now()
        aEnvoyer.current.cap = true
      }

      if (now - envoi < CADENCE_MS) return
      envoi = now
      const e = aEnvoyer.current
      if (e.pas || e.cap) {
        const q = poseRef.current
        setPose(q)
        if (e.pas) {
          if (traverseRef.current) void window.jdr.pions.move(pion.id, q.x, q.y)
          else
            void window.jdr.pions.marcher(pion.id, q.x, q.y).then((a) => {
              /* Le mur a retenu le pas : on repart d'où il est vraiment. */
              if (a && (a.x !== poseRef.current.x || a.y !== poseRef.current.y)) {
                poseRef.current = { ...poseRef.current, x: a.x, y: a.y }
              }
            })
        }
        if (e.cap) void window.jdr.pions.rotate(pion.id, q.cap)
        aEnvoyer.current = { pas: false, cap: false }
      }
    }
    image = requestAnimationFrame(battre)
    return () => {
      vivant = false
      cancelAnimationFrame(image)
    }
  }, [pion.id])

  const prendreManche = (e: React.PointerEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    const suivi = (ev: PointerEvent | React.PointerEvent): void => {
      const b = el.getBoundingClientRect()
      const r = b.width / 2
      const dx = ev.clientX - (b.left + r)
      const dy = ev.clientY - (b.top + r)
      const d = Math.hypot(dx, dy)
      const max = Math.max(1, r - 14)
      const k = d > max ? max / d : 1
      pousse.current = { x: (dx * k) / max, y: (dy * k) / max }
      setPouce({ x: dx * k, y: dy * k })
    }
    const lacher = (): void => {
      el.removeEventListener('pointermove', suivi as EventListener)
      el.removeEventListener('pointerup', lacher)
      el.removeEventListener('pointercancel', lacher)
      pousse.current = { x: 0, y: 0 }
      setPouce({ x: 0, y: 0 })
      aEnvoyer.current.pas = true
    }
    el.addEventListener('pointermove', suivi as EventListener)
    el.addEventListener('pointerup', lacher)
    el.addEventListener('pointercancel', lacher)
    suivi(e)
  }

  const prendreAnneau = (e: React.PointerEvent): void => {
    e.preventDefault()
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    const viser = (ev: PointerEvent | React.PointerEvent): void => {
      const b = el.getBoundingClientRect()
      const dx = ev.clientX - (b.left + b.width / 2)
      const dy = ev.clientY - (b.top + b.height / 2)
      if (Math.hypot(dx, dy) < 8) return
      capVise.current = (Math.atan2(dx, -dy) * 180) / Math.PI
    }
    const lacher = (): void => {
      el.removeEventListener('pointermove', viser as EventListener)
      el.removeEventListener('pointerup', lacher)
      el.removeEventListener('pointercancel', lacher)
    }
    el.addEventListener('pointermove', viser as EventListener)
    el.addEventListener('pointerup', lacher)
    el.addEventListener('pointercancel', lacher)
    viser(e)
  }

  return (
    <div className="pp">
      <div
        className="pp-anneau"
        style={{ ['--cap' as string]: `${pose.cap}deg` }}
        role="slider"
        tabIndex={0}
        aria-label="Le côté où il regarde"
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuenow={Math.round(((pose.cap % 360) + 360) % 360)}
        title="Tire l’anneau pour le tourner · flèches gauche et droite"
        onPointerDown={prendreAnneau}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
          e.preventDefault()
          const pas = e.shiftKey ? 5 : 15
          capVise.current = tour(poseRef.current.cap + (e.key === 'ArrowLeft' ? -pas : pas))
        }}
      >
        <span className="pp-rose n" aria-hidden="true">
          N
        </span>
        <span className="pp-cran" aria-hidden="true" />
        <div className="pp-manche" onPointerDown={prendreManche} title="Pousse le disque pour le faire marcher">
          <span
            className={`pp-pouce${pouce.x || pouce.y ? ' pris' : ''}`}
            style={{ ['--dx' as string]: `${pouce.x}px`, ['--dy' as string]: `${pouce.y}px` }}
            aria-hidden="true"
          >
            ✥
          </span>
        </div>
      </div>
      <label className="dp-case pp-suivre">
        <input type="checkbox" checked={suivre} onChange={(e) => setSuivre(e.target.checked)} />
        Regarder où il va
      </label>
      <label className="dp-case pp-suivre" title="Cochée, il passe au travers des murs, des portes fermées et des rideaux">
        <input type="checkbox" checked={traverse} onChange={(e) => setTraverse(e.target.checked)} />
        Traverse les murs
      </label>
    </div>
  )
}
