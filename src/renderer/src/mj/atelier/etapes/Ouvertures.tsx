/**
 * Étape 3 — portes et fenêtres. Elles se posent sur un mur, jamais à part :
 * on survole un mur, l'aperçu montre où le clic la posera. Enregistrées, ce
 * sont les portes du plan — on les ouvre et on les verrouille en séance.
 */
import { useEffect, useRef, useState } from 'react'
import { nouvelId, placeOuverture, type OuvertureBatie, type PointCase } from '@shared/atelier'
import { murSous, ouvertureSous } from '@shared/atelierOutils'
import type { PropsEtape } from '../../modules/Atelier'
import { Palette } from '../Palette'
import { ImportAsset } from '../ImportAsset'
import { contour } from '../dessin'

/** La largeur d'une ouverture qu'on pose, en cases. */
export const LARGEUR_PORTE = 0.8
export const LARGEUR_FENETRE = 1

const TOLERANCE = 0.5

/** Le rectangle d'une ouverture, pour la dessiner en aide. */
function rect(centre: PointCase, angle: number, l: number, e: number): PointCase[] {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return [
    [-l / 2, -e / 2],
    [l / 2, -e / 2],
    [l / 2, e / 2],
    [-l / 2, e / 2]
  ].map(([x, y]) => [centre[0] + x * c - y * s, centre[1] + x * s + y * c] as PointCase)
}

export function EtapeOuvertures(props: PropsEtape): JSX.Element {
  const { co, assets, setOutil, repeindre } = props
  const portes = assets.filter((a) => a.type === 'porte')
  const fenetres = assets.filter((a) => a.type === 'vitre')
  const [modele, setModele] = useState<string | null>(null)
  const [choisie, setChoisie] = useState<string | null>(null)
  const glisse = useRef<string | null>(null)
  const survol = useRef<{ murId: string; d: number } | null>(null)
  const modeleSur = modele ?? portes[0]?.id ?? fenetres[0]?.id ?? null
  const asset = assets.find((a) => a.id === modeleSur)
  const nature: OuvertureBatie['nature'] = asset?.type === 'vitre' ? 'vitre' : 'porte'
  const ouvChoisie = choisie ? co.c?.ouvertures.find((o) => o.id === choisie) ?? null : null
  const [largeur, setLargeur] = useState(LARGEUR_PORTE)

  useEffect(() => {
    setOutil({
      curseur: 'crosshair',
      onPointer: (type, _p, brut) => {
        const c = co.c
        if (!c) return
        const s = murSous(c, brut, TOLERANCE, true)
        survol.current = s && s.d !== undefined ? { murId: s.murId, d: s.d } : null
        if (type === 'down') {
          const sous = ouvertureSous(c, brut)
          if (sous) {
            setChoisie(sous.id)
            co.marquer()
            glisse.current = sous.id
          } else if (s && s.d !== undefined && modeleSur) {
            const o: OuvertureBatie = { id: nouvelId(), murId: s.murId, nature, assetId: modeleSur, d: s.d, largeur }
            co.modifier((x) => ({ ...x, ouvertures: [...x.ouvertures, o] }))
            /* Pas choisie d'office : on enchaîne souvent porte puis fenêtre, et
               prendre une autre vignette changerait celle qu'on vient de poser. */
            setChoisie(null)
          } else setChoisie(null)
        }
        if (type === 'move' && glisse.current) {
          const id = glisse.current
          const o = c.ouvertures.find((x) => x.id === id)
          const r = o ? murSous({ ...c, murs: c.murs.filter((m) => m.id === o.murId) }, brut, 3, true) : null
          if (r && r.d !== undefined)
            co.remplacer((x) => ({ ...x, ouvertures: x.ouvertures.map((v) => (v.id === id ? { ...v, d: r.d! } : v)) }))
        }
        if (type === 'up') glisse.current = null
        repeindre()
      },
      dessiner: (ctx, echelle) => {
        const c = co.c
        if (!c) return
        const s = survol.current
        if (s && !glisse.current) {
          const m = c.murs.find((x) => x.id === s.murId)
          if (m) {
            const p = placeOuverture(m, { id: '', murId: m.id, nature, assetId: '', d: s.d, largeur })
            contour(ctx, rect(p.centre, p.angle, p.largeur, m.epaisseur * 1.4), echelle, true)
          }
        }
        if (ouvChoisie) {
          const m = c.murs.find((x) => x.id === ouvChoisie.murId)
          if (m) {
            const p = placeOuverture(m, ouvChoisie)
            contour(ctx, rect(p.centre, p.angle, p.largeur, m.epaisseur * 1.6), echelle)
          }
        }
      }
    })
    return () => setOutil(null)
  }, [modeleSur, nature, largeur, choisie, co.c])

  useEffect(() => {
    const k = (e: KeyboardEvent): void => {
      const el = document.activeElement
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && choisie) {
        co.modifier((c) => ({ ...c, ouvertures: c.ouvertures.filter((o) => o.id !== choisie) }))
        setChoisie(null)
      }
      if (e.key === 'Escape') setChoisie(null)
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [choisie, co])

  const choisirModele = (id: string, type: string): void => {
    setModele(id)
    const l = type === 'vitre' ? LARGEUR_FENETRE : LARGEUR_PORTE
    if (!ouvChoisie) setLargeur(l)
    else
      co.modifier((c) => ({
        ...c,
        ouvertures: c.ouvertures.map((o) =>
          o.id === ouvChoisie.id ? { ...o, assetId: id, nature: type === 'vitre' ? 'vitre' : 'porte' } : o
        )
      }))
  }

  const l = ouvChoisie ? ouvChoisie.largeur : largeur
  return (
    <>
      <p className="at-aide">
        Survole un mur : l’aperçu montre où le clic posera l’ouverture. Glisse une ouverture pour la
        déplacer le long de son mur ; Suppr l’efface.
      </p>
      <label className="at-reglage">
        <span className="eyebrow">Largeur · {String(Math.round(l * 100) / 100).replace('.', ',')} case</span>
        <input
          type="range"
          min={0.4}
          max={3}
          step={0.1}
          value={l}
          onChange={(e) => {
            const v = Number(e.target.value)
            if (ouvChoisie)
              co.modifier((c) => ({
                ...c,
                ouvertures: c.ouvertures.map((o) => (o.id === ouvChoisie.id ? { ...o, largeur: v } : o))
              }))
            else setLargeur(v)
          }}
        />
      </label>
      <div className="at-section">
        <span className="eyebrow">Portes</span>
        <Palette
          assets={portes}
          choisi={ouvChoisie?.assetId ?? modeleSur}
          onChoisir={(a) => choisirModele(a.id, a.type)}
        />
      </div>
      <div className="at-section">
        <span className="eyebrow">Fenêtres</span>
        <Palette
          assets={fenetres}
          choisi={ouvChoisie?.assetId ?? modeleSur}
          onChoisir={(a) => choisirModele(a.id, a.type)}
        />
      </div>
      {ouvChoisie ? (
        <button
          className="btn btn-sm"
          onClick={() => {
            co.modifier((c) => ({ ...c, ouvertures: c.ouvertures.filter((o) => o.id !== ouvChoisie.id) }))
            setChoisie(null)
          }}
        >
          Effacer cette ouverture
        </button>
      ) : null}
      <ImportAsset {...props} typeParDefaut="porte" />
    </>
  )
}
