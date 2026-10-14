/**
 * Tous les plans d'un espace sous un même ciel.
 *
 * Le soleil de l'espace tombe sur chacun de ses lieux, tourné selon le nord de
 * chaque plan : on le règle une fois, et c'est ici qu'on vérifie qu'il entre
 * bien par les fenêtres de la chapelle comme par celles du manoir. On n'y voit
 * que l'astre, sans les lampes — comme « Voir le soleil » dans le plan.
 *
 * Le cap suit la main : la fenêtre reçoit le ciel en cours de réglage, pas
 * celui déjà écrit, pour que tourner le curseur fasse tourner tous les plans.
 */
import { useEffect, useId, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store'
import { IconSoleil } from './Icons'
import { FORCE_ASTRE, ventDe, type Astre, type Mur, type Ouverture, type Place, type PointMur } from '@shared/types'
import { formesDesMurs } from '@shared/pieces'
import { lueurDuDehors } from '@shared/murs'
import { LumiereDuDehors, empreinteDehors, type Dehors } from '../../shared/Lueur'

/** La largeur de calcul d'un plan : la géométrie se fait en pixels, jamais en fractions. */
const LARGEUR = 600

export function ApercuDuCiel({
  espace,
  ciel,
  reglage,
  onClose
}: {
  espace: Place
  /** Le ciel de l'espace tel qu'il se règle ; `null`, chaque lieu le sien. */
  ciel: Astre | null
  /** Les boutons et le curseur du ciel, repris en tête pour régler en regardant. */
  reglage: JSX.Element
  onClose: () => void
}): JSX.Element {
  const places = useStore((st) => st.places)
  /* Les plans à montrer : l'espace et tout ce qu'il tient, s'ils ont une image
     à eux. Une pièce découpée se voit déjà sur le plan de son étage. */
  const plans = useMemo(() => {
    const tenus = new Set([espace.id])
    for (let encore = true; encore; ) {
      encore = false
      for (const q of places)
        if (q.parentId != null && tenus.has(q.parentId) && !tenus.has(q.id)) {
          tenus.add(q.id)
          encore = true
        }
    }
    return [espace, ...places.filter((q) => q.id !== espace.id && tenus.has(q.id))].filter(
      (q) => q.mapItemId != null && !q.zone
    )
  }, [espace, places])

  useEffect(() => {
    /* Échap ferme la fenêtre, et elle seule : prise à la capture, la touche
       n'atteint pas l'éditeur de plan resté dessous. */
    const k = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', k, true)
    return () => window.removeEventListener('keydown', k, true)
  }, [onClose])

  /* Au corps de la page : le volet qui l'ouvre ne doit pas la rogner. */
  return createPortal(
    <div className="scrim" onClick={onClose}>
      <div className="modal apercu-ciel" onClick={(e) => e.stopPropagation()}>
        <header>
          <IconSoleil />
          <h3>Le ciel sur « {espace.name} »</h3>
          <button className="btn btn-sm btn-ghost ac-fermer" onClick={onClose}>
            Fermer
          </button>
        </header>
        <div className="ac-reglage">{reglage}</div>
        <div className="body">
          {plans.length ? (
            <div className="ac-grille">
              {plans.map((p) => (
                <PlanSousLeCiel key={p.id} p={p} ciel={ciel} />
              ))}
            </div>
          ) : (
            <p className="expli">Aucun lieu de cet espace n’a encore de plan.</p>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

function PlanSousLeCiel({ p, ciel }: { p: Place; ciel: Astre | null }): JSX.Element {
  const item = useStore((st) => st.allItems.find((i) => i.id === p.mapItemId))
  const [murs, setMurs] = useState<Mur[]>([])
  const [ouvertures, setOuvertures] = useState<Ouverture[]>([])
  /* Les proportions de l'image : celles que l'examen a mesurées, sinon celles
     que le navigateur lit en la chargeant. */
  const [nat, setNat] = useState<{ w: number; h: number } | null>(
    item?.width && item.height ? { w: item.width, h: item.height } : null
  )

  useEffect(() => {
    let vivant = true
    void Promise.all([window.jdr.murs.of(p.id), window.jdr.ouvertures.of(p.id)]).then(([m, o]) => {
      if (!vivant) return
      setMurs(m)
      setOuvertures(o)
    })
    return () => {
      vivant = false
    }
  }, [p.id])

  /* Un espace n'a pas d'astre à lui : sans ciel, son plan reste sans soleil. */
  const source = ciel ?? (p.tier === 'espace' ? null : p.astre)
  const w = LARGEUR
  const h = nat ? (LARGEUR * nat.h) / nat.w : 0
  const cap = source ? (((source.cap + p.nord) % 360) + 360) % 360 : 0

  const dehors = useMemo((): Dehors | null => {
    if (!source || h <= 0) return null
    const enPx = (q: PointMur): { x: number; y: number } => ({ x: q[0] * w, y: q[1] * h })
    return {
      dedans: lueurDuDehors(murs, ouvertures, cap, w, h),
      pieces: formesDesMurs(murs).map((f) => f.pts.map(enPx)),
      force: FORCE_ASTRE[source.nature]
    }
  }, [source?.nature, cap, murs, ouvertures, w, h])

  /* Un masque imbriqué ne se repeint pas : son identifiant porte l'empreinte
     de ce qu'il dessine (voir Brouillard.tsx). */
  const id = `${useId().replace(/:/g, '')}-${empreinteDehors(dehors)}`
  const url = item?.poster ?? item?.url

  return (
    <figure className="ac-plan">
      <div className="ac-image" style={nat ? { aspectRatio: `${nat.w} / ${nat.h}` } : undefined}>
        {url ? (
          <img
            src={url}
            alt=""
            draggable={false}
            onLoad={(e) => {
              const i = e.currentTarget
              if (!nat && i.naturalWidth && i.naturalHeight)
                setNat({ w: i.naturalWidth, h: i.naturalHeight })
            }}
          />
        ) : null}
        {dehors ? (
          <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
            <defs>
              <mask id={id} maskUnits="userSpaceOnUse" x={0} y={0} width={w} height={h}>
                <LumiereDuDehors dehors={dehors} w={w} h={h} ombre />
              </mask>
            </defs>
            <rect x={0} y={0} width={w} height={h} fill="#000" mask={`url(#${id})`} />
          </svg>
        ) : null}
      </div>
      <figcaption>
        <b>{p.name}</b>
        <span>
          {source
            ? `${source.nature === 'soleil' ? '☀' : '☾'} ${ventDe(source.cap)}${ciel ? '' : ' · son réglage'}`
            : 'ni soleil ni lune'}
          {murs.length ? '' : ' · aucun mur : tout est dehors'}
          {p.nord ? ` · nord à ${Math.round(p.nord)}°` : ''}
        </span>
      </figcaption>
    </figure>
  )
}
