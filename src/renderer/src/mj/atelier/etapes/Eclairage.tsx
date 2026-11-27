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
import { METEOS, MOMENTS, momentDe, type Moment } from '@shared/ambiance'


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
  return (
    <>
      <ReglageAmbiance {...props} />
      <span className="eyebrow">Lampes</span>
      {!place.mapItemId ? (
        <p className="at-aide">Enregistre une première fois pour poser les lampes.</p>
      ) : co.agrandi ? (
        <p className="at-aide">Le terrain a changé de taille : enregistre d’abord, pour que les lampes se placent juste.</p>
      ) : (
        <Lampes {...props} />
      )}
    </>
  )
}

/**
 * L'ambiance de la carte, d'un seul réglage : un moment (jour, aube, nuit…)
 * règle à la fois la clarté du lieu — le soleil, la lune ou la nuit noire,
 * qui décident de ce que les joueurs voient — et la couleur de la carte. Elle
 * s'enregistre aussitôt et se voit chez les joueurs dès que la carte est à
 * l'écran.
 */
function ReglageAmbiance({ ambiance: a, reglerAmbiance: regler, murs: m }: PropsEtape): JSX.Element {
  /* Le ciel que ce lieu règle — ou celui de l'espace, qui le règle pour tous. */
  const ciel = m.espace ? (m.cielGeneral?.astre ?? null) : m.cielGeneral ? m.cielGeneral.astre : m.astreLieu
  const verrou = !m.espace && !!m.cielGeneral
  const teinte = a.teinte && a.force > 0 ? a.teinte : null
  const choisi = momentDe(ciel?.nature, teinte)
  const [aMoi, setAMoi] = useState(false)
  const libre = aMoi || (!choisi && (!!teinte || !!ciel))

  const choisir = (mo: Moment): void => {
    setAMoi(false)
    if (!verrou) void m.reglerAstre({ nature: mo.astre, cap: ciel?.cap ?? 135 })
    regler({ teinte: mo.teinte, force: mo.teinte ? mo.force : a.force })
  }

  return (
    <div className="at-section at-ambiance">
      <span className="eyebrow">Ambiance de la carte</span>
      <div className="at-outils">
        {MOMENTS.map((mo) => (
          <button
            key={mo.cle}
            className="btn btn-sm"
            aria-pressed={!libre && choisi?.cle === mo.cle}
            title={mo.titre}
            onClick={() => choisir(mo)}
          >
            {mo.label}
          </button>
        ))}
        <button
          className="btn btn-sm"
          aria-pressed={libre}
          title="Choisir la couleur de la carte toi-même"
          onClick={() => setAMoi(!libre)}
        >
          Couleur à moi…
        </button>
      </div>
      {verrou ? (
        <p className="at-aide">
          Le jour et la nuit sont réglés pour tout l’espace « {m.cielGeneral!.nom} » : ici, seule la couleur change.
        </p>
      ) : null}
      {libre ? (
        <>
          <label className="at-curseur" title="La couleur que prend toute la carte">
            <span>Couleur</span>
            <input
              type="color"
              value={a.teinte ?? '#3d5f9e'}
              onChange={(e) => regler({ teinte: e.target.value, force: a.force > 0 ? a.force : 0.35 })}
            />
            <button className="btn btn-sm btn-ghost" title="La carte telle qu’elle est peinte" onClick={() => regler({ teinte: null })}>
              Aucune
            </button>
          </label>
          {teinte ? (
            <label className="at-curseur" title="Combien la couleur pèse sur la carte">
              <span>Force</span>
              <input
                type="range"
                min={5}
                max={100}
                step={1}
                value={Math.round(a.force * 100)}
                onChange={(e) => regler({ force: Number(e.target.value) / 100 })}
              />
              <span className="num">{Math.round(a.force * 100)} %</span>
            </label>
          ) : null}
        </>
      ) : null}

      <span className="eyebrow">Météo</span>
      <div className="at-outils">
        {METEOS.map((m) => (
          <button
            key={m.cle}
            className="btn btn-sm"
            aria-pressed={a.meteo === m.cle}
            title={m.titre}
            onClick={() => regler({ meteo: m.cle })}
          >
            {m.label}
          </button>
        ))}
      </div>
      {a.meteo !== 'aucune' ? (
        <label className="at-curseur" title="Une bruine ou une averse, un voile ou une purée de pois">
          <span>Intensité</span>
          <input
            type="range"
            min={5}
            max={100}
            step={1}
            value={Math.round(a.meteoForce * 100)}
            onChange={(e) => regler({ meteoForce: Number(e.target.value) / 100 })}
          />
          <span className="num">{Math.round(a.meteoForce * 100)} %</span>
        </label>
      ) : null}
      <p className="at-aide">
        Le moment règle aussi ce que les joueurs voient : de nuit, on y voit moins, et la nuit noire ne
        montre que ce qu’éclairent les lampes. La couleur et la météo, elles, ne cachent rien. Tout
        s’enregistre aussitôt et se voit chez les joueurs.
      </p>
    </div>
  )
}

function Lampes({ place, co, setOutil, repeindre, setTestLum }: PropsEtape): JSX.Element {
  const m = useMurs(place.id)
  /* Le « Test lumière » de la barre d'une lampe joue le même test que celui de l'en-tête. */
  useEffect(() => setTestLum(m.testLum), [m.testLum])
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
