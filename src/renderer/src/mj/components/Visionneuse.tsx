/**
 * Regarder un document en grand, sur le poste du MJ seulement : une image
 * tenue entière dans la fenêtre, une vidéo avec ses commandes, un PDF dans le
 * lecteur de Chromium. Rien ne part vers l'écran des joueurs ni vers les
 * téléphones.
 *
 * Échap, la croix ou un clic à côté referment. Avec `zoom`, une image se
 * regarde de près : la molette agrandit sous le curseur, le glisser déplace,
 * un double-clic remet l'image entière.
 */
import { useRef, useState } from 'react'
import { useEchap } from '../echap'
import { IconClose, kindIcon } from './Icons'
import type { ItemKind } from '@shared/types'

export function Visionneuse({
  titre,
  kind,
  url,
  zoom = false,
  onClose
}: {
  titre: string
  kind: ItemKind
  url: string | null
  /** Une image s'agrandit à la molette et se déplace au glisser. */
  zoom?: boolean
  onClose: () => void
}): JSX.Element {
  useEchap(onClose)
  return (
    <div className="scrim visionneuse" onClick={onClose}>
      <div className="vis-cadre" onClick={(e) => e.stopPropagation()}>
        <header className="vis-tete">
          {kindIcon(kind, 'ico')}
          <span className="vis-titre" title={titre}>
            {titre}
          </span>
          {/* Un vrai bouton, avec son mot : la petite croix pâle d'avant ne se
              voyait pas, et on cherchait comment sortir de l'aperçu. */}
          <button className="btn btn-sm vis-fermer" onClick={onClose} title="Fermer — Échap">
            <IconClose />
            Fermer
          </button>
        </header>
        <div className="vis-corps">
          {!url ? (
            <p className="vis-rien">Ce fichier est introuvable sur le disque.</p>
          ) : kind === 'image' && zoom ? (
            <ImageZoom url={url} titre={titre} />
          ) : kind === 'image' ? (
            <img src={url} alt={titre} />
          ) : kind === 'video' ? (
            <video src={url} controls autoPlay />
          ) : kind === 'pdf' ? (
            <iframe title={titre} src={url} />
          ) : (
            <p className="vis-rien">Ce genre de fichier ne se regarde pas ici.</p>
          )}
        </div>
      </div>
    </div>
  )
}

/** Le zoom tient entre l'image entière et huit fois sa taille. */
const ZOOM_MAX = 8

/**
 * Une image qu'on agrandit sous le curseur et qu'on promène au glisser. Le
 * point visé reste sous la souris : c'est ce qu'on attend d'un plan qu'on
 * scrute, pas un agrandissement depuis le centre qui ferait chercher.
 */
function ImageZoom({ url, titre }: { url: string; titre: string }): JSX.Element {
  const [vue, setVue] = useState({ k: 1, x: 0, y: 0 })
  const cadre = useRef<HTMLDivElement>(null)
  const prise = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)

  const molette = (e: React.WheelEvent): void => {
    const r = cadre.current?.getBoundingClientRect()
    if (!r) return
    /* Le point sous le curseur, depuis le centre du cadre. */
    const px = e.clientX - r.left - r.width / 2
    const py = e.clientY - r.top - r.height / 2
    setVue((v) => {
      const k = Math.min(ZOOM_MAX, Math.max(1, v.k * (e.deltaY < 0 ? 1.2 : 1 / 1.2)))
      if (k === 1) return { k: 1, x: 0, y: 0 }
      const f = k / v.k
      return { k, x: px - (px - v.x) * f, y: py - (py - v.y) * f }
    })
  }

  return (
    <div
      ref={cadre}
      className={`vis-zoom${vue.k > 1 ? ' agrandi' : ''}`}
      onWheel={molette}
      onDoubleClick={() => setVue({ k: 1, x: 0, y: 0 })}
      onPointerDown={(e) => {
        if (vue.k === 1) return
        e.currentTarget.setPointerCapture(e.pointerId)
        prise.current = { x: e.clientX, y: e.clientY, vx: vue.x, vy: vue.y }
      }}
      onPointerMove={(e) => {
        const p = prise.current
        if (p) setVue((v) => ({ ...v, x: p.vx + e.clientX - p.x, y: p.vy + e.clientY - p.y }))
      }}
      onPointerUp={() => (prise.current = null)}
      title="Molette : agrandir · glisser : se déplacer · double-clic : l’image entière"
    >
      <img
        src={url}
        alt={titre}
        draggable={false}
        style={{ transform: `translate(${vue.x}px, ${vue.y}px) scale(${vue.k})` }}
      />
    </div>
  )
}
