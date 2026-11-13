/**
 * Étape 1 — le sol. On le peint avant les murs : c'est une surface libre,
 * qui peut déborder des pièces (une cour, une terrasse, un bout de jardin).
 */
import { useEffect, useRef, useState } from 'react'
import { nouvelId, type PointCase } from '@shared/atelier'
import { pieceSous, rectangle, solSous } from '@shared/atelierOutils'
import type { PropsEtape } from '../../modules/Atelier'
import { Palette } from '../Palette'
import { ImportAsset } from '../ImportAsset'
import { contour, pointille } from '../dessin'

type OutilSol = 'rect' | 'poly' | 'remplir' | 'choisir'

const OUTILS: { id: OutilSol; label: string; aide: string }[] = [
  { id: 'rect', label: 'Rectangle', aide: 'Glisse pour peindre un rectangle.' },
  { id: 'poly', label: 'Polygone', aide: 'Clique chaque coin ; clic droit, double-clic ou clic sur le premier point pour fermer.' },
  { id: 'remplir', label: 'Remplir la pièce', aide: 'Clique dans une pièce fermée par des murs : son sol est peint d’un coup.' },
  { id: 'choisir', label: 'Choisir', aide: 'Clique un sol pour le choisir ; une matière s’y applique, Suppr l’efface.' }
]

export function EtapeSol(props: PropsEtape): JSX.Element {
  const { co, assets, setOutil, repeindre } = props
  const sols = assets.filter((a) => a.type === 'sol')
  const [outil, setOutilSol] = useState<OutilSol>('rect')
  const [matiere, setMatiere] = useState<string | null>(null)
  const [choisi, setChoisi] = useState<string | null>(null)
  const depart = useRef<PointCase | null>(null)
  const points = useRef<PointCase[]>([])
  const souris = useRef<PointCase | null>(null)
  const matiereSure = matiere ?? sols[0]?.id ?? null

  const peindre = (brut: PointCase[] | null): void => {
    /* Un double-clic passe d'abord par deux clics : on ôte les sommets répétés. */
    const pts = brut?.filter((p, i, t) => !i || Math.hypot(p[0] - t[i - 1][0], p[1] - t[i - 1][1]) > 1e-6)
    if (!pts || pts.length < 3 || !matiereSure) return
    co.modifier((c) => ({ ...c, sols: [...c.sols, { id: nouvelId(), assetId: matiereSure, pts }] }))
  }

  useEffect(() => {
    points.current = []
    depart.current = null
    setOutil({
      curseur: outil === 'choisir' ? 'pointer' : 'crosshair',
      onPointer: (type, p, _brut, _e, prise) => {
        souris.current = p
        if (outil === 'rect') {
          if (type === 'down') depart.current = p
          if (type === 'up' && depart.current) {
            peindre(rectangle(depart.current, p))
            depart.current = null
          }
        } else if (outil === 'poly') {
          const pts = points.current
          if (type === 'down') {
            const premier = pts[0]
            if (premier && pts.length >= 3 && Math.hypot(p[0] - premier[0], p[1] - premier[1]) < Math.max(prise, 0.05)) {
              peindre([...pts])
              points.current = []
            } else pts.push(p)
          }
          if ((type === 'dbl' || type === 'droit') && pts.length >= 3) {
            peindre([...pts])
            points.current = []
          }
        } else if (outil === 'remplir') {
          if (type === 'down') {
            const piece = co.c ? pieceSous(co.c, p) : null
            if (piece) peindre(piece)
          }
        } else if (type === 'down') setChoisi(co.c ? solSous(co.c, p)?.id ?? null : null)
        repeindre()
      },
      dessiner: (ctx, echelle) => {
        const p = souris.current
        if (outil === 'rect' && depart.current && p) {
          const r = rectangle(depart.current, p)
          if (r) contour(ctx, r, echelle, true)
        }
        if (outil === 'poly' && points.current.length) {
          pointille(ctx, p ? [...points.current, p] : points.current, echelle)
        }
        if (outil === 'remplir' && p && co.c) {
          const piece = pieceSous(co.c, p)
          if (piece) contour(ctx, piece, echelle, true)
        }
        const s = choisi && co.c?.sols.find((x) => x.id === choisi)
        if (s) contour(ctx, s.pts, echelle, true)
      }
    })
    return () => setOutil(null)
  }, [outil, matiereSure, choisi, co.c])

  /* Suppr efface le sol choisi ; Échap abandonne le polygone en cours. */
  useEffect(() => {
    const k = (e: KeyboardEvent): void => {
      const el = document.activeElement
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
      if (e.key === 'Escape') {
        points.current = []
        depart.current = null
        repeindre()
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && choisi) {
        co.modifier((c) => ({ ...c, sols: c.sols.filter((s) => s.id !== choisi) }))
        setChoisi(null)
      }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [choisi, co])

  return (
    <>
      <div className="at-section">
        <span className="eyebrow">Outil</span>
        <div className="at-outils">
          {OUTILS.map((o) => (
            <button key={o.id} className="btn btn-sm" aria-pressed={outil === o.id} onClick={() => setOutilSol(o.id)}>
              {o.label}
            </button>
          ))}
        </div>
        <p className="at-aide">{OUTILS.find((o) => o.id === outil)!.aide}</p>
      </div>
      <div className="at-section">
        <span className="eyebrow">Matière</span>
        <Palette
          assets={sols}
          choisi={matiereSure}
          onChoisir={(a) => {
            setMatiere(a.id)
            if (choisi)
              co.modifier((c) => ({
                ...c,
                sols: c.sols.map((s) => (s.id === choisi ? { ...s, assetId: a.id } : s))
              }))
          }}
        />
      </div>
      {choisi ? (
        <div className="at-section">
          <button
            className="btn btn-sm"
            onClick={() => {
              co.modifier((c) => ({ ...c, sols: c.sols.filter((s) => s.id !== choisi) }))
              setChoisi(null)
            }}
          >
            Effacer ce sol
          </button>
        </div>
      ) : null}
      <ImportAsset {...props} typeParDefaut="sol" />
    </>
  )
}
