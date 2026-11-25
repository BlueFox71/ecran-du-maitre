/**
 * L'ambiance peinte sur une carte : la teinte de la lumière générale, et le
 * temps qu'il fait, animé.
 *
 * Les deux couches remplissent leur parent — le cadre de l'image dans la
 * scène, le terrain dans l'atelier — et ne captent jamais la souris. La
 * teinte se pose juste sur l'image, sous l'ombre ; le temps par-dessus tout.
 */
import { useEffect, useRef } from 'react'
import type { Ambiance, Meteo } from '@shared/ambiance'

/** La couleur générale : elle assombrit en teintant (multiplier), et pousse un peu la couleur. */
export function TeinteAmbiance({ ambiance }: { ambiance: Ambiance | null | undefined }): JSX.Element | null {
  if (!ambiance?.teinte || ambiance.force <= 0) return null
  const base: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    background: ambiance.teinte
  }
  return (
    <>
      <div className="ambiance-teinte" style={{ ...base, mixBlendMode: 'multiply', opacity: ambiance.force }} />
      <div className="ambiance-teinte" style={{ ...base, mixBlendMode: 'color', opacity: ambiance.force * 0.3 }} />
    </>
  )
}

/** Une particule : une goutte, un flocon, une cendre ou une nappe de brume. */
interface Grain {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  /** Une phase pour le balancement ou le scintillement. */
  p: number
  /** Une braise parmi les cendres. */
  braise?: boolean
}

interface Eclat {
  x: number
  y: number
  t: number
}

/** Le plus large que le dessin se calcule : au-delà, on étire — la pluie n'a pas besoin de détail. */
const LARGEUR_MAX = 1400
/** La surface de référence des densités. */
const AIRE_REF = 1280 * 720

export function MeteoAnimee({ meteo, force }: { meteo: Meteo; force: number }): JSX.Element | null {
  const toile = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = toile.current
    if (!cv || meteo === 'aucune' || force <= 0) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    let w = 0
    let h = 0
    let grains: Grain[] = []
    let eclats: Eclat[] = []
    let eclair = 0
    let prochainEclair = 2 + Math.random() * 6
    const f = meteo === 'orage' ? Math.max(0.7, force) : force

    const aleat = (a: number, b: number): number => a + Math.random() * (b - a)
    const nouveau = (partout: boolean): Grain => {
      const g: Grain = { x: aleat(0, w), y: partout ? aleat(0, h) : aleat(-h * 0.1, 0), vx: 0, vy: 0, r: 1, p: aleat(0, 6.28) }
      if (meteo === 'pluie' || meteo === 'orage') {
        g.vy = aleat(0.9, 1.3) * h
        g.vx = g.vy * 0.18
        g.r = aleat(10, 20) * (w / 1000)
      } else if (meteo === 'neige') {
        g.vy = aleat(0.05, 0.11) * h
        g.vx = aleat(-0.01, 0.02) * w
        g.r = aleat(1, 3.2) * (w / 1000)
      } else if (meteo === 'cendres') {
        g.braise = Math.random() < 0.18
        g.vy = aleat(0.03, 0.08) * h
        g.vx = aleat(0.03, 0.07) * w
        g.r = aleat(1, g.braise ? 2.2 : 2.8) * (w / 1000)
      } else {
        /* Le brouillard : de larges nappes qui dérivent. */
        g.x = aleat(-0.2, 1.2) * w
        g.y = aleat(-0.2, 1.2) * h
        g.vx = aleat(0.006, 0.02) * w
        g.vy = aleat(-0.004, 0.004) * h
        g.r = aleat(0.18, 0.38) * Math.max(w, h)
      }
      return g
    }
    const combien = (): number => {
      const k = (w * h) / AIRE_REF
      if (meteo === 'brouillard') return Math.round(8 + 18 * f)
      if (meteo === 'neige') return Math.round((80 + 420 * f) * k)
      if (meteo === 'cendres') return Math.round((60 + 300 * f) * k)
      return Math.round((120 + 700 * f) * k)
    }
    const dimensionner = (): void => {
      const r = cv.getBoundingClientRect()
      const lw = cv.clientWidth || r.width
      const lh = cv.clientHeight || r.height
      if (!lw || !lh) return
      const k = Math.min(1, LARGEUR_MAX / lw)
      const nw = Math.max(1, Math.round(lw * k))
      const nh = Math.max(1, Math.round(lh * k))
      if (nw === w && nh === h) return
      w = cv.width = nw
      h = cv.height = nh
      grains = Array.from({ length: combien() }, () => nouveau(true))
      eclats = []
    }
    dimensionner()
    const ro = new ResizeObserver(dimensionner)
    ro.observe(cv)

    let avant = performance.now()
    let raf = 0
    const image = (t: number): void => {
      raf = requestAnimationFrame(image)
      const dt = Math.min(0.05, (t - avant) / 1000)
      avant = t
      if (!w || !h) return
      ctx.clearRect(0, 0, w, h)

      if (meteo === 'brouillard') {
        ctx.fillStyle = `rgba(215, 222, 228, ${0.06 + 0.16 * f})`
        ctx.fillRect(0, 0, w, h)
        for (const g of grains) {
          g.x += g.vx * dt
          g.y += g.vy * dt
          if (g.x - g.r > w) g.x = -g.r
          if (g.y - g.r > h) g.y = -g.r
          if (g.y + g.r < 0) g.y = h + g.r
          const a = (0.1 + 0.22 * f) * (0.75 + 0.25 * Math.sin(t / 2400 + g.p))
          const grad = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r)
          grad.addColorStop(0, `rgba(235, 240, 244, ${a})`)
          grad.addColorStop(1, 'rgba(235, 240, 244, 0)')
          ctx.fillStyle = grad
          ctx.fillRect(g.x - g.r, g.y - g.r, g.r * 2, g.r * 2)
        }
        return
      }

      if (meteo === 'pluie' || meteo === 'orage') {
        ctx.strokeStyle = `rgba(205, 220, 240, ${0.28 + 0.2 * f})`
        ctx.lineWidth = Math.max(1, w / 1100)
        ctx.lineCap = 'round'
        ctx.beginPath()
        for (const g of grains) {
          g.x += g.vx * dt
          g.y += g.vy * dt
          if (g.y > h || g.x > w) {
            /* Une goutte arrivée au sol éclabousse, parfois. */
            if (Math.random() < 0.25) eclats.push({ x: g.x % w, y: aleat(0, h), t: 0 })
            Object.assign(g, nouveau(false))
            g.x = aleat(-0.2 * w, w)
          }
          const k = g.r / Math.hypot(g.vx, g.vy)
          ctx.moveTo(g.x, g.y)
          ctx.lineTo(g.x - g.vx * k, g.y - g.vy * k)
        }
        ctx.stroke()
        ctx.lineWidth = Math.max(1, w / 1400)
        eclats = eclats.filter((e) => (e.t += dt) < 0.35)
        for (const e of eclats) {
          const q = e.t / 0.35
          ctx.strokeStyle = `rgba(215, 228, 245, ${0.45 * (1 - q)})`
          ctx.beginPath()
          ctx.arc(e.x, e.y, (2 + 6 * q) * (w / 1000), 0, Math.PI * 2)
          ctx.stroke()
        }
        if (meteo === 'orage') {
          prochainEclair -= dt
          if (prochainEclair <= 0) {
            eclair = 1
            prochainEclair = aleat(4, 12)
          }
          if (eclair > 0) {
            /* Deux battements : l'éclair, puis son rebond. */
            const a = eclair > 0.75 ? 0.55 : eclair > 0.6 ? 0.1 : eclair * 0.5
            ctx.fillStyle = `rgba(225, 235, 255, ${a})`
            ctx.fillRect(0, 0, w, h)
            eclair = Math.max(0, eclair - dt * 2.2)
          }
        }
        return
      }

      /* La neige et les cendres : des points qui dérivent en se balançant. */
      for (const g of grains) {
        g.p += dt * 1.6
        g.x += (g.vx + Math.sin(g.p) * 0.015 * w) * dt
        g.y += g.vy * dt
        if (g.y - g.r > h) {
          Object.assign(g, nouveau(false))
        }
        if (g.x - g.r > w) g.x = -g.r
        if (g.x + g.r < 0) g.x = w + g.r
        if (meteo === 'neige') {
          ctx.fillStyle = `rgba(250, 252, 255, ${0.65 + 0.3 * f})`
        } else if (g.braise) {
          const s = 0.55 + 0.45 * Math.sin(g.p * 3.1)
          ctx.fillStyle = `rgba(255, ${120 + Math.round(80 * s)}, 40, ${0.55 + 0.4 * s})`
        } else {
          ctx.fillStyle = `rgba(120, 112, 108, ${0.45 + 0.3 * f})`
        }
        ctx.beginPath()
        ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    raf = requestAnimationFrame(image)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [meteo, force])

  if (meteo === 'aucune' || force <= 0) return null
  return (
    <canvas
      ref={toile}
      className="ambiance-meteo"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  )
}
