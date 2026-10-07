import { useEffect, useRef, useState } from 'react'
import type { CadreCarre } from '@shared/types'
import { styleCarre } from '../../shared/Visage'

/*
 * Tailler le carré du pion dans un portrait.
 *
 * Le portrait de la fiche est plus haut que large ; le pion, lui, est rond, et
 * le centre de l'image tombe souvent sur le menton. On choisit donc le carré à
 * la main : glisser pour le déplacer, molette ou réglette pour serrer sur le
 * visage, double-clic pour revenir au centre. Les mêmes gestes que le cadrage
 * d'une carte — mais l'image ne laisse jamais voir de vide : le carré reste
 * toujours dedans.
 *
 * La géométrie se tient en « centre et agrandissement », plus facile à
 * manier ; elle ne sort qu'en carré, en fractions de l'image (`CadreCarre`).
 */

const SERRE_MAX = 6

const borne = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v))

interface Vise {
  /** Agrandissement : 1, le plus grand carré que l'image contienne. */
  z: number
  /** Centre du carré, en fractions de l'image. */
  cx: number
  cy: number
}

/** Le carré que donne une visée, ramené dans l'image. */
function carreDe(v: Vise, W: number, H: number): CadreCarre {
  const cote = Math.min(W, H) / v.z
  const w = cote / W
  const h = cote / H
  return { x: borne(v.cx - w / 2, 0, 1 - w), y: borne(v.cy - h / 2, 0, 1 - h), w, h }
}

/** La visée d'un carré — et celle du centre quand il n'y en a pas. */
function viseDe(c: CadreCarre | null, W: number, H: number): Vise {
  if (!c) return { z: 1, cx: 0.5, cy: 0.5 }
  return {
    z: borne(Math.min(W, H) / (c.w * W), 1, SERRE_MAX),
    cx: c.x + c.w / 2,
    cy: c.y + c.h / 2
  }
}

/** Une visée dont le carré déborde est ramenée au bord : on ne tire pas dans le vide. */
function recale(v: Vise, W: number, H: number): Vise {
  const c = carreDe(v, W, H)
  return { z: v.z, cx: c.x + c.w / 2, cy: c.y + c.h / 2 }
}

export function RognageCarre({
  titre,
  url,
  cadre,
  onValider,
  onClose
}: {
  titre: string
  url: string
  cadre: CadreCarre | null
  /** null : revenir au centre, sans carré enregistré. */
  onValider: (c: CadreCarre | null) => void
  onClose: () => void
}): JSX.Element {
  const [nat, setNat] = useState<{ W: number; H: number } | null>(null)
  const [vise, setVise] = useState<Vise>({ z: 1, cx: 0.5, cy: 0.5 })
  /* « Au centre » efface le carré : on le retient pour enregistrer null, et
     non un carré centré qui ne suivrait plus l'image si on la changeait. */
  const [auCentre, setAuCentre] = useState(cadre === null)
  const scene = useRef<HTMLDivElement>(null)
  const prise = useRef<{ x: number; y: number; de: Vise } | null>(null)

  /* Les proportions du fichier : sans elles, pas de carré. */
  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      const W = img.naturalWidth
      const H = img.naturalHeight
      if (!W || !H) return
      setNat({ W, H })
      setVise(viseDe(cadre, W, H))
    }
    img.src = url
    // Le carré de départ n'est lu qu'à l'ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  useEffect(() => {
    const touche = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', touche)
    return () => window.removeEventListener('keydown', touche)
  }, [onClose])

  const poser = (v: Vise): void => {
    if (!nat) return
    setAuCentre(false)
    setVise(recale(v, nat.W, nat.H))
  }

  const carre = nat ? carreDe(vise, nat.W, nat.H) : null

  /* La molette serre autour du curseur : le point visé reste sous la main. */
  const molette = (e: React.WheelEvent): void => {
    const b = scene.current?.getBoundingClientRect()
    if (!nat || !carre || !b) return
    const mx = (e.clientX - b.left) / b.width
    const my = (e.clientY - b.top) / b.height
    const z = borne(vise.z * Math.exp(-e.deltaY * 0.0015), 1, SERRE_MAX)
    const u = carre.x + mx * carre.w
    const v = carre.y + my * carre.h
    const k = vise.z / z
    const w = carre.w * k
    const h = carre.h * k
    poser({ z, cx: u - mx * w + w / 2, cy: v - my * h + h / 2 })
  }

  const centre = (): void => {
    setAuCentre(true)
    setVise({ z: 1, cx: 0.5, cy: 0.5 })
  }

  return (
    <div className="scrim par-dessus" onClick={onClose}>
      <div className="modal rc-fenetre" onClick={(e) => e.stopPropagation()}>
        <header>
          <h3>{titre}</h3>
        </header>
        <div className="body">
          <div className="rc-corps">
            <div
              ref={scene}
              className="rc-scene"
              onWheel={molette}
              onDoubleClick={centre}
              onPointerDown={(e) => {
                prise.current = { x: e.clientX, y: e.clientY, de: vise }
                e.currentTarget.setPointerCapture(e.pointerId)
              }}
              onPointerMove={(e) => {
                const p = prise.current
                const b = scene.current?.getBoundingClientRect()
                if (!p || !b || !nat) return
                const c = carreDe(p.de, nat.W, nat.H)
                /* On tire l'image : le carré part dans l'autre sens. */
                poser({
                  z: p.de.z,
                  cx: p.de.cx - ((e.clientX - p.x) / b.width) * c.w,
                  cy: p.de.cy - ((e.clientY - p.y) / b.height) * c.h
                })
              }}
              onPointerUp={(e) => {
                prise.current = null
                e.currentTarget.releasePointerCapture(e.pointerId)
              }}
            >
              {carre ? <img src={url} alt="" draggable={false} style={styleCarre(carre)} /> : null}
              {/* Le rond du pion, et l'ombre de ce qu'il ne montrera pas. */}
              <span className="rc-rond" />
            </div>

            <div className="rc-cote">
              <span className="eyebrow">Sur la table</span>
              <div className="rc-apercus">
                {[64, 40].map((t) => (
                  <span key={t} className="rc-apercu rond" style={{ width: t, height: t }}>
                    {carre ? <img src={url} alt="" draggable={false} style={styleCarre(carre)} /> : null}
                  </span>
                ))}
                <span className="rc-apercu" style={{ width: 64, height: 64 }}>
                  {carre ? <img src={url} alt="" draggable={false} style={styleCarre(carre)} /> : null}
                </span>
              </div>
              <label className="rc-serre">
                <span className="eyebrow">Serrer</span>
                <input
                  type="range"
                  min={1}
                  max={SERRE_MAX}
                  step={0.01}
                  value={vise.z}
                  onChange={(e) => poser({ ...vise, z: Number(e.target.value) })}
                  disabled={!nat}
                />
              </label>
              <p className="aide">
                Glisse l’image pour placer le visage, serre à la molette ou à la réglette.
                Double-clic : retour au centre.
              </p>
            </div>
          </div>
        </div>
        <footer>
          <button className="btn btn-sm btn-ghost rc-centre" onClick={centre} disabled={auCentre}>
            Au centre
          </button>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button
            className="btn btn-sm btn-brass"
            disabled={!nat}
            onClick={() => onValider(auCentre || !carre ? null : carre)}
          >
            Enregistrer
          </button>
        </footer>
      </div>
    </div>
  )
}
