/**
 * Les lieux d'un son, dans sa fiche : une liste à cocher.
 *
 * Ce que veut dire « cocher » dépend de sa nature (choix de Jules, 17 oct.) :
 *  — une **ambiance** devient l'ambiance du lieu, celle qui joue quand il
 *    passe à l'écran (son premier fichier) ;
 *  — une **nappe** ou un **bruitage** est posé sur le plan du lieu, au milieu
 *    de la pièce, un cercle d'un mètre (5 % du plan sans échelle) — on le
 *    recadre dans l'éditeur.
 * Décocher retire l'un ou l'autre.
 *
 * Un son posé appartient à la pièce où tombe son centre, sinon au plan qui le
 * porte : c'est ce qui décide de la coche.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { dansForme, pointInterieur } from '@shared/pieces'
import type { Place, Son } from '@shared/types'
import { IconPlus, IconSearch } from './Icons'
import { emojiDe, useSons } from '../sons'

export interface UsageSon {
  id: number
  sonId: number
  placeId: number
  nom: string
  x: number
  y: number
}

const estPiece = (p: Place): boolean => p.tier === 'lieu' && !!p.zone

/** Le rayon d'un son posé depuis sa fiche, en mètres (Jules). */
const RAYON_METRES = 1
/** Sur un plan dont on ignore l'échelle : en part de sa largeur. */
const RAYON_SANS_ECHELLE = 0.05

export function LieuxDuSon({
  son,
  usages,
  onRelire
}: {
  son: Son
  usages: UsageSon[]
  onRelire: () => Promise<void>
}): JSX.Element {
  const s = useStore()
  const [ouvert, setOuvert] = useState(false)
  const [cherche, setCherche] = useState('')
  const hote = useRef<HTMLDivElement>(null)
  const ambiance = son.nature === 'ambiance'
  const sons = useSons((x) => x.liste)

  /** L'ambiance déjà réglée sur un lieu : le son qui porte ce fichier, sinon le fichier seul. */
  const ambianceDe = (p: Place): string | null => {
    if (p.ambienceItemId == null) return null
    const x = sons.find((y) => y.fichiers.some((f) => f.itemId === p.ambienceItemId))
    if (x) return `${emojiDe(x)} ${x.nom || 'Sans nom'}`
    return s.allItems.find((i) => i.id === p.ambienceItemId)?.title ?? 'un fichier disparu'
  }

  useEffect(() => {
    if (!ouvert) return
    const h = (e: MouseEvent): void => {
      if (!hote.current?.contains(e.target as Node)) setOuvert(false)
    }
    const k = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOuvert(false)
    }
    document.addEventListener('mousedown', h)
    document.addEventListener('keydown', k)
    return () => {
      document.removeEventListener('mousedown', h)
      document.removeEventListener('keydown', k)
    }
  }, [ouvert])

  const parId = useMemo(() => new Map(s.places.map((p) => [p.id, p])), [s.places])

  /** Le plan qui porte un lieu : l'étage pour une pièce découpée, lui-même s'il a une image. */
  const porteur = (p: Place): Place | null => {
    if (estPiece(p)) {
      const n = p.parentId != null ? parId.get(p.parentId) : undefined
      if (n && n.mapItemId != null) return n
    }
    return p.mapItemId != null ? p : null
  }

  /** Le lieu d'un son posé : la pièce où tombe son centre, sinon le plan lui-même. */
  const lieuDe = (u: UsageSon): number => {
    const piece = s.places.find(
      (q) => estPiece(q) && q.parentId === u.placeId && q.zone && dansForme([u.x, u.y], q.zone)
    )
    return piece?.id ?? u.placeId
  }

  const miens = usages.filter((u) => u.sonId === son.id)
  const coches = new Set<number>(
    ambiance
      ? s.places.filter((p) => p.ambienceItemId != null && son.fichiers.some((f) => f.itemId === p.ambienceItemId)).map((p) => p.id)
      : miens.map(lieuDe)
  )

  /** Les lieux dans l'ordre de l'arbre, avec leur profondeur. */
  const arbre = useMemo(() => {
    const prof = (p: Place): number => {
      let d = 0
      let q = p
      while (q.parentId != null && parId.has(q.parentId) && d < 6) {
        q = parId.get(q.parentId)!
        d++
      }
      return d
    }
    return s.places.map((p) => ({ p, d: prof(p) }))
  }, [s.places, parId])

  const q = cherche.trim().toLowerCase()
  const visibles = arbre.filter(({ p }) => !q || p.name.toLowerCase().includes(q))

  const basculer = async (p: Place): Promise<void> => {
    if (ambiance) {
      const f = son.fichiers[0]
      if (!f) return s.toast('Ce son n’a pas de fichier : il ne peut pas servir d’ambiance', true)
      await window.jdr.places.upsert({
        id: p.id,
        name: p.name,
        ambienceItemId: coches.has(p.id) ? null : f.itemId
      })
      await s.refreshPlaces()
      return
    }
    if (coches.has(p.id)) {
      for (const u of miens.filter((u) => lieuDe(u) === p.id)) await window.jdr.sons.zoneRemove(u.id)
    } else {
      const plan = porteur(p)
      if (!plan) return s.toast(`« ${p.name} » n’a pas de plan : rien où poser le son`, true)
      let x = 0.5
      let y = 0.5
      if (plan.id !== p.id && p.zone) [x, y] = p.ancre && dansForme(p.ancre, p.zone) ? p.ancre : pointInterieur(p.zone)
      /* Un mètre, rapporté à la largeur du plan quand on connaît son échelle
         (fixée au trait ou estimée aux portes) ; on l'agrandit à la main. */
      const { metres } = await window.jdr.places.echelle(plan.id)
      const rayon = metres ? RAYON_METRES / metres : RAYON_SANS_ECHELLE
      await window.jdr.sons.zoneAdd({ placeId: plan.id, x, y, sonId: son.id, rayon })
    }
    await onRelire()
  }

  const choisis = arbre.filter(({ p }) => coches.has(p.id))

  return (
    <div className="field snd-lieux" ref={hote}>
      <label>Lieux</label>
      <div className="snd-lieux-puces">
        {choisis.map(({ p }) => (
          <span key={p.id} className="snd-lieu-puce">
            {p.name}
            <button aria-label={`Retirer de ${p.name}`} title="Retirer de ce lieu" onClick={() => void basculer(p)}>
              ×
            </button>
          </span>
        ))}
        <button className="btn btn-sm snd-lieux-ajout" onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert}>
          <IconPlus />
          {choisis.length ? 'Lieux…' : 'Choisir des lieux'}
        </button>
      </div>
      {ouvert ? (
        <div className="snd-lieux-menu" role="listbox" aria-multiselectable="true" aria-label="Lieux du son">
          <div className="snd-lieux-cherche">
            <IconSearch />
            <input autoFocus value={cherche} placeholder="Chercher un lieu…" onChange={(e) => setCherche(e.target.value)} />
          </div>
          <div className="snd-lieux-liste">
            {visibles.map(({ p, d }) => {
              /* Une ambiance aussi ne va qu'aux lieux qui ont un plan (Jules). */
              const sansPlan = !porteur(p)
              return (
                <label
                  key={p.id}
                  className={`snd-lieux-ligne${sansPlan ? ' sans' : ''}`}
                  style={{ paddingLeft: 8 + (q ? 0 : d * 14) }}
                  title={sansPlan ? (ambiance ? 'Pas de plan : pas d’ambiance ici' : 'Pas de plan : rien où poser le son') : undefined}
                >
                  <input
                    type="checkbox"
                    checked={coches.has(p.id)}
                    disabled={sansPlan && !coches.has(p.id)}
                    onChange={() => void basculer(p)}
                  />
                  <span>{p.name}</span>
                  {ambiance && !sansPlan ? (
                    coches.has(p.id) ? null : ambianceDe(p) ? (
                      <span className="snd-lieux-amb a" title="Cocher la remplace par ce son">
                        ambiance : {ambianceDe(p)}
                      </span>
                    ) : (
                      <span className="snd-lieux-amb">sans ambiance</span>
                    )
                  ) : null}
                </label>
              )
            })}
            {!visibles.length ? <span className="snd-aide">Aucun lieu.</span> : null}
          </div>
        </div>
      ) : null}
      <span className="snd-aide">
        {ambiance
          ? 'Coché, il devient l’ambiance du lieu : elle joue quand le lieu passe à l’écran.'
          : 'Coché, il est posé sur le plan du lieu, au milieu de la pièce ; recadre son cercle dans l’éditeur de plan.'}
      </span>
    </div>
  )
}
