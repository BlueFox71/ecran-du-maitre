/**
 * Le calque d'annotations d'un lieu — **pour le MJ seul**.
 *
 * Ce composant n'est importé que par l'interface du MJ. La fenêtre des joueurs
 * ne connaît que `Slide`, qui ne sait rien des annotations : elles ne peuvent
 * donc pas s'afficher chez eux, même si quelqu'un l'oubliait un jour.
 *
 * Deux usages :
 * - `mode="lecture"` : on regarde, rien ne bouge (la régie, « Voir annotations »).
 * - `mode="edition"` : on pose, on déplace, on efface (la fiche du lieu).
 */
import { useEffect, useRef, useState } from 'react'
import type { Annotation, Frame, Zone } from '@shared/types'

/**
 * Un cadre exactement aux proportions de l'image, centré dans la place dont il
 * dispose. Il existe pour une raison simple : les annotations sont posées en
 * fractions de **l'image**, pas du cadre qui l'entoure. Sans lui, un plan qui
 * n'a pas les proportions de son contenant voit ses repères glisser — et
 * l'image elle-même se retrouve rognée ou perdue au milieu du vide.
 */
const borne = (v: number, l: number): number => Math.min(l, Math.max(-l, v))

export function CadreAnnote({
  url,
  className,
  zoomable = false,
  frame,
  zone,
  children
}: {
  url: string
  className?: string
  /** Molette pour agrandir, glisser pour recadrer, double-clic pour revenir. */
  zoomable?: boolean
  /**
   * Le morceau de l'image qu'on regarde — une pièce découpée dans le plan de
   * son étage. Le cadre agrandit et décale de façon que ce rectangle remplisse
   * la place, **le calque avec lui** : les repères et les murs restent posés
   * sur le plan entier et tombent quand même au bon endroit.
   */
  zone?: Zone | null
  /**
   * Cadrage imposé de l'extérieur — celui que la Régie applique à l'image
   * diffusée. Le calque le rejoue **à l'identique** : sans cela, zoomer
   * l'image en régie laissait les repères sur place, à côté de ce qu'ils
   * désignent. Exclusif de `zoomable`.
   */
  frame?: Frame
  children: React.ReactNode
}): JSX.Element {
  const hote = useRef<HTMLDivElement>(null)
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null)
  const [place, setPlace] = useState<{ w: number; h: number } | null>(null)
  /* Agrandissement et décalage, en pixels : le cadre porte l'image *et* le
     calque, donc les repères suivent d'eux-mêmes. */
  const [vue, setVue] = useState({ z: 1, ox: 0, oy: 0 })
  const tire = useRef<{ x: number; y: number; ox: number; oy: number; bouge: boolean } | null>(null)

  useEffect(() => {
    setNat(null)
    setVue({ z: 1, ox: 0, oy: 0 })
    if (!url) return
    const im = new Image()
    im.onload = () => setNat({ w: im.naturalWidth, h: im.naturalHeight })
    im.src = url
    return () => {
      im.onload = null
    }
  }, [url])

  /* On mesure la place plutôt que de la déduire : `aspect-ratio` avec des
     maxima en pourcentage se résout mal selon le contexte — grille, boîte
     flexible, hauteur indéfinie — et un plan finissait rogné. */
  useEffect(() => {
    const el = hote.current
    if (!el) return
    const lire = (): void => {
      const b = el.getBoundingClientRect()
      setPlace({ w: b.width, h: b.height })
    }
    lire()
    const ro = new ResizeObserver(lire)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  /** L'ajustement de `contain`, calculé : l'image entière, au plus grand. */
  const taille =
    nat && place && place.w > 0 && place.h > 0
      ? (() => {
          const k = Math.min(place.w / nat.w, place.h / nat.h)
          return { width: Math.round(nat.w * k), height: Math.round(nat.h * k) }
        })()
      : null

  /** Jusqu'où l'on peut décaler sans faire sortir l'image du cadre. */
  const limites = (z: number): { lx: number; ly: number } => {
    if (!taille || !place) return { lx: 0, ly: 0 }
    return {
      lx: Math.max(0, (taille.width * z - place.w) / 2),
      ly: Math.max(0, (taille.height * z - place.h) / 2)
    }
  }

  /* La molette agrandit **autour du curseur** : le point qu'on regarde ne
     bouge pas, sinon on le perd au premier cran. */
  useEffect(() => {
    const el = hote.current
    if (!el || !zoomable) return
    const h = (e: WheelEvent): void => {
      e.preventDefault()
      const b = el.getBoundingClientRect()
      const u = e.clientX - (b.left + b.width / 2)
      const v = e.clientY - (b.top + b.height / 2)
      setVue((p) => {
        const z = Math.min(8, Math.max(1, p.z * (e.deltaY < 0 ? 1.12 : 1 / 1.12)))
        const k = z / p.z
        const { lx, ly } = limites(z)
        return { z, ox: borne(u - k * (u - p.ox), lx), oy: borne(v - k * (v - p.oy), ly) }
      })
    }
    el.addEventListener('wheel', h, { passive: false })
    return () => el.removeEventListener('wheel', h)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomable, taille?.width, taille?.height, place?.w, place?.h])

  /*
   * Le cadrage de la Régie, rejoué. `Framed` décale en pourcentage de la scène,
   * agrandit, puis tourne — et corrige la taille d'un quart de tour pour que
   * l'image reste entière. On refait les trois, dans le même ordre.
   */
  const impose = ((): { transform: string } | null => {
    if (!frame || !taille || !place || !nat) return null
    const rot = frame.rot ?? 0
    const couche = rot === 90 || rot === 270
    const ajuste = couche
      ? Math.min(place.w / taille.height, place.h / taille.width)
      : 1
    return {
      transform:
        `translate(${frame.ox * place.w}px, ${frame.oy * place.h}px)` +
        ` scale(${frame.zoom * ajuste}) rotate(${rot}deg)`
    }
  })()

  /*
   * Le cadrage d'une pièce. `taille` est l'image entière ajustée à la place ;
   * on l'agrandit du facteur qui fait tenir la zone d'un bord à l'autre, puis
   * on ramène le centre de la zone au centre du cadre. Les deux valeurs se
   * recalculent à chaque mesure : un cadrage figé ne survivrait pas à un
   * redimensionnement de la fenêtre.
   */
  const cadreZone = ((): { transform: string } | null => {
    if (!zone || !taille || !place || zone.w <= 0 || zone.h <= 0) return null
    const k = Math.min(place.w / (zone.w * taille.width), place.h / (zone.h * taille.height))
    const cx = (zone.x + zone.w / 2 - 0.5) * taille.width
    const cy = (zone.y + zone.h / 2 - 0.5) * taille.height
    return { transform: `translate(${-k * cx}px, ${-k * cy}px) scale(${k})` }
  })()

  return (
    <div
      ref={hote}
      className={`cadre-hote${zoomable ? ' zoomable' : ''}${className ? ` ${className}` : ''}`}
      onPointerDown={(e) => {
        if (!zoomable || e.button !== 0) return
        tire.current = { x: e.clientX, y: e.clientY, ox: vue.ox, oy: vue.oy, bouge: false }
      }}
      onPointerMove={(e) => {
        const t = tire.current
        if (!t) return
        if (Math.abs(e.clientX - t.x) > 3 || Math.abs(e.clientY - t.y) > 3) t.bouge = true
        if (!t.bouge) return
        const { lx, ly } = limites(vue.z)
        setVue((p) => ({
          z: p.z,
          ox: borne(t.ox + (e.clientX - t.x), lx),
          oy: borne(t.oy + (e.clientY - t.y), ly)
        }))
      }}
      onPointerUp={() => {
        /* Le drapeau survit jusqu'au clic qui suit : sans quoi un recadrage
           finirait par poser un repère là où on a relâché. */
        window.setTimeout(() => {
          if (tire.current) tire.current = null
        }, 0)
      }}
      onClickCapture={(e) => {
        if (tire.current?.bouge) e.stopPropagation()
      }}
      onDoubleClick={() => zoomable && setVue({ z: 1, ox: 0, oy: 0 })}
      title={
        zoomable
          ? 'Molette : agrandir · glisser : recadrer · double-clic : revenir au plan entier'
          : undefined
      }
    >
      <div
        className={`cadre-annote${vue.z > 1 ? ' zoome' : ''}`}
        style={
          taille
            ? {
                ...taille,
                transform:
                  impose?.transform ??
                  cadreZone?.transform ??
                  `translate(${vue.ox}px, ${vue.oy}px) scale(${vue.z})`
              }
            : undefined
        }
      >
        {children}
      </div>
    </div>
  )
}

export type OutilAnnotation = 'repere' | 'texte' | null

export function Annotations({
  annotations,
  mode,
  outil,
  choisi,
  onChoisir,
  onPoser,
  onDeplacer,
  onEffacer
}: {
  annotations: Annotation[]
  mode: 'lecture' | 'edition'
  /** L'outil armé : le prochain clic sur la carte pose ceci. */
  outil?: OutilAnnotation
  choisi?: number | null
  onChoisir?: (id: number | null) => void
  onPoser?: (kind: 'repere' | 'texte', x: number, y: number) => void
  onDeplacer?: (id: number, x: number, y: number) => void
  onEffacer?: (id: number) => void
}): JSX.Element {
  const hote = useRef<HTMLDivElement>(null)
  /* Le déplacement se voit tout de suite ; la base n'apprend qu'au relâchement. */
  const [glisse, setGlisse] = useState<{ id: number; x: number; y: number } | null>(null)
  const prise = useRef<{ id: number; bouge: boolean } | null>(null)

  const edition = mode === 'edition'

  const fraction = (e: { clientX: number; clientY: number }): { x: number; y: number } => {
    const b = hote.current!.getBoundingClientRect()
    return { x: (e.clientX - b.left) / b.width, y: (e.clientY - b.top) / b.height }
  }

  return (
    <div
      ref={hote}
      className={`annot-layer${edition ? ' edit' : ''}${outil ? ' arme' : ''}`}
      onClick={(e) => {
        if (!edition) return
        /* Un clic dans le vide : soit on pose ce que l'outil tient, soit on
           désélectionne. Jamais les deux. */
        if (e.target !== hote.current) return
        if (outil && onPoser) {
          const { x, y } = fraction(e)
          onPoser(outil, x, y)
        } else onChoisir?.(null)
      }}
    >
      {annotations.map((a) => {
        const pos = glisse?.id === a.id ? glisse : a
        return (
          <div
            key={a.id}
            className={`annot annot-${a.kind} c-${a.color ?? 'brass'}${
              choisi === a.id ? ' on' : ''
            }`}
            style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}
            title={a.kind === 'repere' ? `${a.num} — ${a.texte || 'sans note'}` : a.texte}
            onPointerDown={(e) => {
              if (!edition || e.button !== 0) return
              e.stopPropagation()
              prise.current = { id: a.id, bouge: false }
              e.currentTarget.setPointerCapture(e.pointerId)
            }}
            onPointerMove={(e) => {
              const p = prise.current
              if (!p || p.id !== a.id) return
              p.bouge = true
              const { x, y } = fraction(e)
              setGlisse({ id: a.id, x, y })
            }}
            onPointerUp={(e) => {
              const p = prise.current
              if (!p || p.id !== a.id) return
              prise.current = null
              e.currentTarget.releasePointerCapture(e.pointerId)
              if (p.bouge && glisse) onDeplacer?.(a.id, glisse.x, glisse.y)
              else onChoisir?.(a.id)
              setGlisse(null)
            }}
          >
            {a.kind === 'repere' ? (
              <>
                <span className="pastille">{a.num}</span>
                {a.texte ? <span className="note">{a.texte}</span> : null}
              </>
            ) : (
              <span className="libre">{a.texte || '…'}</span>
            )}

            {edition && choisi === a.id ? (
              <button
                className="oter"
                title="Effacer cette annotation"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  onEffacer?.(a.id)
                }}
              >
                ×
              </button>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
