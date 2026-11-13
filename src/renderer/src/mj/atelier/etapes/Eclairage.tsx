/**
 * Étape 5 — l'éclairage. Ce ne sont pas des lumières peintes : ce sont les
 * lampes du lieu, celles que l'application allume et éteint en séance, qui
 * éclairent à travers les portes et s'arrêtent aux murs. On les pose ici
 * sur la construction, et on les règle avec les mêmes commandes que dans
 * l'éditeur de plan.
 */
import { useEffect, useRef, useState } from 'react'
import type { PointCase } from '@shared/atelier'
import { lueurDeLampe } from '@shared/essai'
import type { PropsEtape } from '../../modules/Atelier'
import { BarreLumiere, useMurs } from '../../components/Murs'


/** Une teinte de lampe (`#rgb` ou `#rrggbb`), à une opacité donnée. */
function teinte(hex: string, a: number): string {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((x) => x + x).join('')
  const n = parseInt(h.slice(0, 6), 16)
  if (!Number.isFinite(n)) return `rgba(255, 255, 255, ${a})`
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

export function EtapeEclairage(props: PropsEtape): JSX.Element {
  const { place, co } = props
  if (!place.mapItemId) return <p className="at-aide">Enregistre une première fois pour poser la lumière.</p>
  if (co.agrandi)
    return <p className="at-aide">Le terrain a changé de taille : enregistre d’abord, pour que les lampes se placent juste.</p>
  return <Lampes {...props} />
}

function Lampes({ place, co, setOutil, repeindre }: PropsEtape): JSX.Element {
  const m = useMurs(place.id)
  const glisse = useRef<{ id: number; p: PointCase } | null>(null)
  /* La pose armée : le prochain clic pose une lampe. Sans elle, un clic choisit. */
  const [arme, setArme] = useState(false)
  const souris = useRef<PointCase | null>(null)
  const c = co.c!
  const enCases = (x: number, y: number): PointCase => [x * c.largeur, y * c.hauteur]

  useEffect(() => {
    setOutil({
      curseur: arme ? 'copy' : 'default',
      curseurSous: (p, prise) =>
        !arme &&
        m.lumieres.some((l) => {
          const [x, y] = enCases(l.x, l.y)
          return Math.hypot(p[0] - x, p[1] - y) < prise
        })
          ? 'move'
          : undefined,
      onPointer: (type, _p, brut, e, prise) => {
        souris.current = brut
        /* Clic droit pendant une pose : rien n'est posé. */
        if (type === 'droit') {
          if (arme) setArme(false)
          else if (glisse.current) glisse.current = null
          else m.setLumChoisie(null)
          repeindre()
          return
        }
        if (type === 'down') {
          if (arme) {
            void m.poserLumiere(brut[0] / c.largeur, brut[1] / c.hauteur)
            /* Maj : on garde la pose pour en mettre plusieurs. */
            if (!e.shiftKey) setArme(false)
            repeindre()
            return
          }
          const proche = m.lumieres.find((l) => {
            const [x, y] = enCases(l.x, l.y)
            return Math.hypot(brut[0] - x, brut[1] - y) < prise
          })
          if (proche) {
            m.setLumChoisie(proche.id)
            glisse.current = { id: proche.id, p: brut }
          } else m.setLumChoisie(null)
        }
        if (type === 'move' && glisse.current) glisse.current = { ...glisse.current, p: brut }
        if (type === 'up' && glisse.current) {
          const { id, p } = glisse.current
          glisse.current = null
          void m.reglerLumiere(id, { x: p[0] / c.largeur, y: p[1] / c.hauteur })
        }
        repeindre()
      },
      dessiner: (ctx, echelle) => {
        /* La lampe qu'on s'apprête à poser, sous la souris. */
        if (arme && souris.current) {
          const [x, y] = souris.current
          ctx.beginPath()
          ctx.arc(x, y, 7 / echelle, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(240, 193, 90, 0.6)'
          ctx.fill()
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)'
          ctx.lineWidth = 1.5 / echelle
          ctx.stroke()
        }
        /* Un aperçu de la lueur : la vraie se calcule en séance, avec les murs. */
        for (const l of m.lumieres) {
          const g = glisse.current?.id === l.id ? glisse.current.p : enCases(l.x, l.y)
          const r = l.penombre * c.largeur
          if (l.allumee) {
            /* La lueur s'arrête aux murs et aux meubles qui cachent la vue, comme en séance. */
            const zone = lueurDeLampe(c, { ...l, x: g[0] / c.largeur, y: g[1] / c.hauteur })
            ctx.save()
            ctx.beginPath()
            zone.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
            ctx.closePath()
            ctx.clip()
            const grad = ctx.createRadialGradient(g[0], g[1], 0, g[0], g[1], r)
            grad.addColorStop(0, teinte(l.teinte, 0.4))
            grad.addColorStop(Math.min(0.99, Math.max(0.01, l.clair / l.penombre)), teinte(l.teinte, 0.2))
            grad.addColorStop(1, teinte(l.teinte, 0))
            ctx.fillStyle = grad
            ctx.beginPath()
            ctx.arc(g[0], g[1], r, 0, Math.PI * 2)
            ctx.fill()
            ctx.restore()
          }
          ctx.beginPath()
          ctx.arc(g[0], g[1], (m.lumChoisie === l.id ? 8 : 6) / echelle, 0, Math.PI * 2)
          ctx.fillStyle = l.allumee ? l.teinte : '#555'
          ctx.fill()
          ctx.strokeStyle = m.lumChoisie === l.id ? 'rgba(232, 184, 92, 1)' : 'rgba(0, 0, 0, 0.7)'
          ctx.lineWidth = 2 / echelle
          ctx.stroke()
        }
      }
    })
    return () => setOutil(null)
  }, [m.lumieres, m.lumChoisie, c, arme])

  /* Échap abandonne la pose ; Suppr retire la lampe choisie. */
  useEffect(() => {
    const k = (e: KeyboardEvent): void => {
      const el = document.activeElement
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
      if (e.key === 'Escape') setArme(false)
      if ((e.key === 'Delete' || e.key === 'Backspace') && m.lumChoisie != null) {
        e.preventDefault()
        void m.oterLumiere(m.lumChoisie)
      }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [m.lumChoisie])

  return (
    <>
      <p className="at-aide">
        Clique une lampe pour la régler, glisse-la pour la déplacer. Elles éclairent en séance,
        arrêtées par les murs.
      </p>
      <button className="btn btn-sm" aria-pressed={arme} onClick={() => setArme(!arme)}>
        {arme ? 'Clique sur le plan pour poser la lampe' : 'Ajouter une lampe'}
      </button>
      <ul className="at-raccourcis">
        <li>
          <kbd>Maj</kbd> : poser plusieurs lampes
        </li>
        <li>Clic droit ou <kbd>Échap</kbd> : annuler la pose</li>
        <li>
          <kbd>Suppr</kbd> : retirer la lampe choisie
        </li>
      </ul>
      <div className="at-section at-lampe">
        <BarreLumiere m={m} />
      </div>
    </>
  )
}
