/**
 * Étape 2 — les murs. Épais, texturés, et ce sont aussi les murs du plan :
 * enregistrés, ils arrêtent les pions et les regards.
 */
import { useEffect, useRef, useState } from 'react'
import { nouvelId, type MurBati, type PointCase } from '@shared/atelier'
import { murSous, rectangle } from '@shared/atelierOutils'
import type { PropsEtape } from '../../modules/Atelier'
import { Palette } from '../Palette'
import { ImportAsset } from '../ImportAsset'
import { poignee, pointille, trait } from '../dessin'

type OutilMurs = 'tracer' | 'piece' | 'choisir'

const OUTILS: { id: OutilMurs; label: string; aide: string }[] = [
  {
    id: 'tracer',
    label: 'Tracer',
    aide: 'Clique de coin en coin. Clic droit, double-clic ou Échap termine ; un clic sur le premier point referme le mur.'
  },
  { id: 'piece', label: 'Pièce rectangulaire', aide: 'Glisse : les quatre murs d’une pièce, d’un coup.' },
  { id: 'choisir', label: 'Choisir', aide: 'Clique un mur pour le choisir, glisse un coin pour le déplacer. Suppr l’efface.' }
]

export const EPAISSEUR_DEFAUT = 0.4

const ferme = (pts: PointCase[]): boolean =>
  pts.length > 2 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 1e-6

export function EtapeMurs(props: PropsEtape): JSX.Element {
  const { co, assets, setOutil, repeindre } = props
  const murs = assets.filter((a) => a.type === 'mur')
  const [outil, setOutilMurs] = useState<OutilMurs>('piece')
  const [matiere, setMatiere] = useState<string | null>(null)
  const [epaisseur, setEpaisseur] = useState(EPAISSEUR_DEFAUT)
  const [choisi, setChoisi] = useState<string | null>(null)
  const points = useRef<PointCase[]>([])
  const depart = useRef<PointCase | null>(null)
  const sommet = useRef<{ murId: string; i: number } | null>(null)
  const souris = useRef<PointCase | null>(null)
  const matiereSure = matiere ?? murs[0]?.id ?? null
  const murChoisi = choisi ? co.c?.murs.find((m) => m.id === choisi) ?? null : null

  const poser = (pts: PointCase[]): void => {
    const net = pts.filter((p, i, t) => !i || Math.hypot(p[0] - t[i - 1][0], p[1] - t[i - 1][1]) > 1e-6)
    if (net.length < 2 || !matiereSure) return
    const m: MurBati = { id: nouvelId(), assetId: matiereSure, pts: net, epaisseur }
    co.modifier((c) => ({ ...c, murs: [...c.murs, m] }))
  }

  const finirTrace = (): void => {
    if (points.current.length >= 2) poser([...points.current])
    points.current = []
    repeindre()
  }

  const effacer = (id: string): void => {
    co.modifier((c) => ({
      ...c,
      murs: c.murs.filter((m) => m.id !== id),
      ouvertures: c.ouvertures.filter((o) => o.murId !== id)
    }))
    setChoisi(null)
  }

  useEffect(() => {
    points.current = []
    depart.current = null
    setOutil({
      curseur: outil === 'choisir' ? 'pointer' : 'crosshair',
      onPointer: (type, p, _brut, _e, prise) => {
        souris.current = p
        if (outil === 'tracer') {
          const pts = points.current
          if (type === 'down') {
            const premier = pts[0]
            if (premier && pts.length >= 2 && Math.hypot(p[0] - premier[0], p[1] - premier[1]) < Math.max(prise, 0.05)) {
              poser([...pts, premier])
              points.current = []
            } else pts.push(p)
          }
          if (type === 'dbl' || type === 'droit') finirTrace()
        } else if (outil === 'piece') {
          if (type === 'down') depart.current = p
          if (type === 'up' && depart.current) {
            const r = rectangle(depart.current, p)
            if (r) poser([...r, r[0]])
            depart.current = null
          }
        } else {
          if (type === 'down' && co.c) {
            const s = murSous(co.c, _brut, Math.max(prise, 0.2))
            setChoisi(s?.murId ?? null)
            if (s && s.sommet !== null) {
              co.marquer()
              sommet.current = { murId: s.murId, i: s.sommet }
            }
          }
          if (type === 'move' && sommet.current) {
            const { murId, i } = sommet.current
            co.remplacer((c) => ({
              ...c,
              murs: c.murs.map((m) => {
                if (m.id !== murId) return m
                const pts = m.pts.slice()
                const boucle = ferme(m.pts)
                pts[i] = p
                /* Un mur refermé : son premier et son dernier point ne font qu'un. */
                if (boucle && i === 0) pts[pts.length - 1] = p
                if (boucle && i === pts.length - 1) pts[0] = p
                return { ...m, pts }
              })
            }))
          }
          if (type === 'up') sommet.current = null
        }
        repeindre()
      },
      dessiner: (ctx, echelle) => {
        const p = souris.current
        const ep = epaisseur
        if (outil === 'tracer' && points.current.length) {
          const pts = p ? [...points.current, p] : points.current
          trait(ctx, pts, ep)
          pointille(ctx, pts, echelle)
        }
        if (outil === 'piece' && depart.current && p) {
          const r = rectangle(depart.current, p)
          if (r) trait(ctx, [...r, r[0], r[1]], ep)
        }
        if (murChoisi) {
          trait(ctx, murChoisi.pts, murChoisi.epaisseur + 6 / echelle, 'rgba(232, 184, 92, 0.35)')
          murChoisi.pts.forEach((q, i) => poignee(ctx, q, echelle, sommet.current?.i === i))
        }
      }
    })
    return () => setOutil(null)
  }, [outil, matiereSure, epaisseur, choisi, co.c])

  useEffect(() => {
    const k = (e: KeyboardEvent): void => {
      const el = document.activeElement
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
      if (e.key === 'Escape') {
        if (outil === 'tracer') finirTrace()
        depart.current = null
        setChoisi(null)
        repeindre()
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && choisi) effacer(choisi)
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [outil, choisi, co])

  const regler = (patch: Partial<MurBati>): void => {
    if (!choisi) return
    co.modifier((c) => ({ ...c, murs: c.murs.map((m) => (m.id === choisi ? { ...m, ...patch } : m)) }))
  }

  return (
    <>
      <div className="at-section">
        <span className="eyebrow">Outil</span>
        <div className="at-outils">
          {OUTILS.map((o) => (
            <button key={o.id} className="btn btn-sm" aria-pressed={outil === o.id} onClick={() => setOutilMurs(o.id)}>
              {o.label}
            </button>
          ))}
        </div>
        <p className="at-aide">{OUTILS.find((o) => o.id === outil)!.aide}</p>
      </div>
      <label className="at-reglage">
        <span className="eyebrow">
          Épaisseur · {String(murChoisi ? murChoisi.epaisseur : epaisseur).replace('.', ',')} case
        </span>
        <input
          type="range"
          min={0.2}
          max={1}
          step={0.05}
          value={murChoisi ? murChoisi.epaisseur : epaisseur}
          onChange={(e) => {
            const v = Number(e.target.value)
            setEpaisseur(v)
            if (murChoisi) regler({ epaisseur: v })
          }}
        />
      </label>
      <div className="at-section">
        <span className="eyebrow">Matière</span>
        <Palette
          assets={murs}
          choisi={murChoisi?.assetId ?? matiereSure}
          onChoisir={(a) => {
            setMatiere(a.id)
            if (murChoisi) regler({ assetId: a.id })
          }}
        />
      </div>
      {murChoisi ? (
        <div className="at-section">
          <button className="btn btn-sm" onClick={() => effacer(murChoisi.id)}>
            Effacer ce mur
          </button>
        </div>
      ) : null}
      <ImportAsset {...props} typeParDefaut="mur" />
    </>
  )
}
