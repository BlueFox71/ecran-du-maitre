/**
 * Étape 4 — la déco. Meubles, tapis, objets, toiles d'araignée : on prend
 * une vignette, on clique où le poser. Un petit objet se pose sur un grand —
 * une bougie sur la commode — puisque le dernier posé passe devant.
 *
 * Ctrl + clic ajoute un objet à la sélection (ou l'en retire) : on règle
 * alors tout le groupe d'un coup — ses blocages, son plan, sa place.
 */
import { useEffect, useRef, useState } from 'react'
import { contourDeLObjet, nouvelId, type ObjetPose, type PointCase } from '@shared/atelier'
import { centreDeCase, mettreAuPlan, objetSous, redimensionner, tourner, tournerGroupe } from '@shared/atelierOutils'
import type { AssetAtelier } from '@shared/atelierAssets'
import type { PropsEtape } from '../../modules/Atelier'
import { Palette } from '../Palette'
import { contour, poignee } from '../dessin'
import { ImportAsset } from '../ImportAsset'

/** Où se tient la poignée de rotation : au-dessus de l'objet, en cases. */
const ECART_ROTATION = 0.45

type Geste =
  /** `depart` : la place de chaque objet du groupe quand on l'a saisi. */
  | { quoi: 'deplacer'; id: string; prise: PointCase; depart: Map<string, PointCase> }
  | { quoi: 'coin'; id: string; i: number }
  | { quoi: 'tourner'; id: string }
  /** Le groupe pivote autour de son centre ; `a0` : l'angle de la souris au départ. */
  | { quoi: 'tournerGroupe'; centre: PointCase; a0: number; depart: ObjetPose[] }

function poigneeRotation(o: ObjetPose): PointCase {
  const a = (o.angle * Math.PI) / 180
  const r = o.h / 2 + ECART_ROTATION
  return [o.x + r * Math.sin(a), o.y - r * Math.cos(a)]
}

/** La boîte d'un groupe d'objets, en cases. */
function boiteDuGroupe(groupe: ObjetPose[]): { x0: number; y0: number; x1: number; y1: number } {
  const pts = groupe.flatMap((o) => contourDeLObjet(o))
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }
}

/** La poignée de rotation d'un groupe : au-dessus de sa boîte, au milieu. */
function poigneeDuGroupe(groupe: ObjetPose[]): { poignee: PointCase; centre: PointCase } {
  const b = boiteDuGroupe(groupe)
  const cx = (b.x0 + b.x1) / 2
  return { poignee: [cx, b.y0 - ECART_ROTATION], centre: [cx, (b.y0 + b.y1) / 2] }
}

/** L'angle d'un point vu d'un centre, en degrés, 0 vers le haut, dans le sens des aiguilles d'une montre. */
const angleVers = (centre: PointCase, p: PointCase): number =>
  (Math.atan2(p[0] - centre[0], -(p[1] - centre[1])) * 180) / Math.PI

/** Une case à cocher qui sait dire « mixte » quand les objets choisis diffèrent. */
function CaseGroupe({
  valeurs,
  onChange,
  children
}: {
  valeurs: boolean[]
  onChange: (v: boolean) => void
  children: React.ReactNode
}): JSX.Element {
  const ref = useRef<HTMLInputElement>(null)
  const toutes = valeurs.every(Boolean)
  const mixte = !toutes && valeurs.some(Boolean)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = mixte
  }, [mixte])
  return (
    <label className="at-case">
      <input ref={ref} type="checkbox" checked={toutes} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  )
}

export function EtapeDeco(props: PropsEtape): JSX.Element {
  const { co, assets, setOutil, repeindre } = props
  const objets = assets.filter((a) => a.type === 'objet')
  const [arme, setArme] = useState<AssetAtelier | null>(null)
  const [choisis, setChoisis] = useState<string[]>([])
  const geste = useRef<Geste | null>(null)
  const souris = useRef<PointCase | null>(null)
  /* Ctrl maintenu : l'objet se cale au centre de la case. */
  const cale = useRef(false)
  const groupe = (co.c?.objets ?? []).filter((o) => choisis.includes(o.id))
  /* Les poignées de taille et de rotation : pour un objet seul. */
  const seul = groupe.length === 1 ? groupe[0] : null

  const majObjets = (ids: string[], f: (o: ObjetPose) => ObjetPose, pas = true): void => {
    const g = (c: NonNullable<typeof co.c>) => ({ ...c, objets: c.objets.map((o) => (ids.includes(o.id) ? f(o) : o)) })
    if (pas) co.modifier(g)
    else co.remplacer(g)
  }

  useEffect(() => {
    setOutil({
      curseur: arme ? 'copy' : 'default',
      /* Le curseur dit ce qu'un clic ferait : tourner, retailler, déplacer. */
      curseurSous: (p, prise) => {
        const c = co.c
        if (arme || !c) return undefined
        if (groupe.length > 1) {
          const { poignee: pg } = poigneeDuGroupe(groupe)
          if (Math.hypot(p[0] - pg[0], p[1] - pg[1]) < prise) return 'grab'
        }
        if (seul) {
          const rot = poigneeRotation(seul)
          if (Math.hypot(p[0] - rot[0], p[1] - rot[1]) < prise) return 'grab'
          const coins = contourDeLObjet(seul).slice(0, 4)
          const i = coins.findIndex((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < prise)
          if (i >= 0) return i % 2 === 0 ? 'nwse-resize' : 'nesw-resize'
        }
        return objetSous(c, p) ? 'move' : undefined
      },
      onPointer: (type, _p, brut, e, prise) => {
        souris.current = brut
        cale.current = e.ctrlKey
        const c = co.c
        if (!c) return
        /* Clic droit pendant une pose : on repose la vignette, rien n'est posé. */
        if (type === 'droit') {
          if (arme) setArme(null)
          else if (geste.current) {
            geste.current = null
            co.annuler()
          } else setChoisis([])
          repeindre()
          return
        }
        if (type === 'down') {
          if (arme) {
            const [x, y] = e.ctrlKey ? centreDeCase(brut) : brut
            const o: ObjetPose = {
              id: nouvelId(),
              assetId: arme.id,
              x,
              y,
              l: arme.l ?? 1,
              h: arme.h ?? 1,
              angle: 0,
              bloquePas: !!arme.bloquePas,
              bloqueVue: !!arme.bloqueVue
            }
            co.modifier((v) => ({ ...v, objets: [...v.objets, o] }))
            setChoisis([o.id])
            /* Maj : on garde la vignette pour en poser plusieurs. */
            if (!e.shiftKey) setArme(null)
            return
          }
          const sous = objetSous(c, brut)
          /* Ctrl + clic : on ajoute l'objet au groupe, ou on l'en retire. */
          if (e.ctrlKey) {
            if (sous)
              setChoisis((l) => (l.includes(sous.id) ? l.filter((id) => id !== sous.id) : [...l, sous.id]))
            repeindre()
            return
          }
          if (groupe.length > 1) {
            const { poignee: pg, centre } = poigneeDuGroupe(groupe)
            if (Math.hypot(brut[0] - pg[0], brut[1] - pg[1]) < prise) {
              co.marquer()
              geste.current = { quoi: 'tournerGroupe', centre, a0: angleVers(centre, brut), depart: groupe }
              return
            }
          }
          if (seul) {
            const rot = poigneeRotation(seul)
            if (Math.hypot(brut[0] - rot[0], brut[1] - rot[1]) < prise) {
              co.marquer()
              geste.current = { quoi: 'tourner', id: seul.id }
              return
            }
            const coins = contourDeLObjet(seul).slice(0, 4)
            const i = coins.findIndex((q) => Math.hypot(brut[0] - q[0], brut[1] - q[1]) < prise)
            if (i >= 0) {
              co.marquer()
              geste.current = { quoi: 'coin', id: seul.id, i }
              return
            }
          }
          if (!sous) {
            setChoisis([])
            repeindre()
            return
          }
          /* Saisir un objet du groupe emporte tout le groupe ; un autre, lui seul. */
          const ids = choisis.includes(sous.id) ? choisis : [sous.id]
          if (!choisis.includes(sous.id)) setChoisis(ids)
          co.marquer()
          geste.current = {
            quoi: 'deplacer',
            id: sous.id,
            prise: [brut[0] - sous.x, brut[1] - sous.y],
            depart: new Map(c.objets.filter((o) => ids.includes(o.id)).map((o) => [o.id, [o.x, o.y]]))
          }
        }
        if (type === 'move' && geste.current) {
          const g = geste.current
          if (g.quoi === 'deplacer') {
            /* L'objet saisi mène : calé sur la case avec Ctrl, les autres suivent du même pas. */
            const cible: PointCase = [brut[0] - g.prise[0], brut[1] - g.prise[1]]
            const [x, y] = e.ctrlKey ? centreDeCase(cible) : cible
            const d0 = g.depart.get(g.id)!
            const dx = x - d0[0]
            const dy = y - d0[1]
            majObjets(
              [...g.depart.keys()],
              (o) => {
                const d = g.depart.get(o.id)!
                return { ...o, x: d[0] + dx, y: d[1] + dy }
              },
              false
            )
          }
          if (g.quoi === 'coin') majObjets([g.id], (o) => redimensionner(o, g.i, brut, !e.altKey), false)
          if (g.quoi === 'tourner') majObjets([g.id], (o) => tourner(o, brut, e.shiftKey), false)
          if (g.quoi === 'tournerGroupe') {
            let delta = angleVers(g.centre, brut) - g.a0
            if (e.shiftKey) delta = Math.round(delta / 15) * 15
            const tournes = new Map(tournerGroupe(g.depart, g.centre, delta).map((o) => [o.id, o]))
            co.remplacer((v) => ({ ...v, objets: v.objets.map((o) => tournes.get(o.id) ?? o) }))
          }
        }
        if (type === 'up') geste.current = null
        repeindre()
      },
      dessiner: (ctx, echelle) => {
        const c = co.c
        if (!c) return
        if (arme && souris.current) {
          const [x, y] = cale.current ? centreDeCase(souris.current) : souris.current
          contour(ctx, contourDeLObjet({ ...({} as ObjetPose), x, y, l: arme.l ?? 1, h: arme.h ?? 1, angle: 0 }), echelle, true)
        }
        for (const o of c.objets) if (choisis.includes(o.id)) contour(ctx, contourDeLObjet(o), echelle)
        const sel = c.objets.filter((o) => choisis.includes(o.id))
        if (sel.length > 1) {
          /* Le groupe : sa boîte en pointillés, et sa poignée de rotation. */
          const b = boiteDuGroupe(sel)
          const { poignee: pg } = poigneeDuGroupe(sel)
          ctx.setLineDash([5 / echelle, 4 / echelle])
          ctx.strokeStyle = 'rgba(232, 184, 92, 0.8)'
          ctx.lineWidth = 1.5 / echelle
          ctx.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0)
          ctx.setLineDash([])
          ctx.beginPath()
          ctx.moveTo(pg[0], b.y0)
          ctx.lineTo(pg[0], pg[1])
          ctx.stroke()
          ctx.beginPath()
          ctx.arc(pg[0], pg[1], 5 / echelle, 0, Math.PI * 2)
          ctx.fillStyle = '#fff'
          ctx.fill()
        }
        const o = choisis.length === 1 ? c.objets.find((x) => x.id === choisis[0]) : null
        if (o) {
          const pts = contourDeLObjet(o)
          const rot = poigneeRotation(o)
          ctx.beginPath()
          ctx.moveTo(o.x + ((rot[0] - o.x) * (o.h / 2)) / (o.h / 2 + ECART_ROTATION), o.y + ((rot[1] - o.y) * (o.h / 2)) / (o.h / 2 + ECART_ROTATION))
          ctx.lineTo(rot[0], rot[1])
          ctx.strokeStyle = 'rgba(232, 184, 92, 0.9)'
          ctx.lineWidth = 1.5 / echelle
          ctx.stroke()
          ctx.beginPath()
          ctx.arc(rot[0], rot[1], 5 / echelle, 0, Math.PI * 2)
          ctx.fillStyle = '#fff'
          ctx.fill()
          pts.slice(0, 4).forEach((q, i) => poignee(ctx, q, echelle, geste.current?.quoi === 'coin' && geste.current.i === i))
        }
      }
    })
    return () => setOutil(null)
  }, [arme, choisis, co.c])

  useEffect(() => {
    const k = (e: KeyboardEvent): void => {
      const el = document.activeElement
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
      if (e.key === 'Escape') {
        setArme(null)
        setChoisis([])
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && choisis.length) supprimer()
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && choisis.length) {
        e.preventDefault()
        dupliquer()
      }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [choisis, co])

  const supprimer = (): void => {
    if (!choisis.length) return
    co.modifier((c) => ({ ...c, objets: c.objets.filter((o) => !choisis.includes(o.id)) }))
    setChoisis([])
  }
  const dupliquer = (): void => {
    if (!groupe.length) return
    const copies = groupe.map((o) => ({ ...o, id: nouvelId(), x: o.x + 0.3, y: o.y + 0.3 }))
    co.modifier((c) => ({ ...c, objets: [...c.objets, ...copies] }))
    setChoisis(copies.map((o) => o.id))
  }
  const plan = (devant: boolean): void => {
    if (!choisis.length) return
    co.modifier((c) => ({ ...c, objets: mettreAuPlan(c.objets, choisis, devant) }))
  }
  const titre = seul
    ? (assets.find((a) => a.id === seul.assetId)?.nom ?? 'Objet introuvable')
    : `${groupe.length} objets choisis`

  return (
    <>
      {groupe.length ? (
        <div className="at-section at-objet">
          <span className="eyebrow">{titre}</span>
          <CaseGroupe
            valeurs={groupe.map((o) => o.bloquePas)}
            onChange={(v) => majObjets(choisis, (o) => ({ ...o, bloquePas: v }))}
          >
            Bloque le passage
          </CaseGroupe>
          <CaseGroupe
            valeurs={groupe.map((o) => o.bloqueVue)}
            onChange={(v) => majObjets(choisis, (o) => ({ ...o, bloqueVue: v }))}
          >
            Bloque la vue
          </CaseGroupe>
          <div className="at-outils">
            <button className="btn btn-sm" onClick={() => plan(true)}>
              Premier plan
            </button>
            <button className="btn btn-sm" onClick={() => plan(false)}>
              Arrière-plan
            </button>
            <button className="btn btn-sm" onClick={dupliquer} title="Ctrl+D">
              Dupliquer
            </button>
            <button className="btn btn-sm" onClick={supprimer} title="Suppr">
              Supprimer
            </button>
          </div>
          <ul className="at-raccourcis">
            <li>
              <kbd>Ctrl</kbd> + clic : ajouter ou retirer de la sélection
            </li>
            <li>Glisser : déplacer {seul ? 'l’objet' : 'le groupe'} (<kbd>Ctrl</kbd> : centrer sur la case)</li>
            {seul ? (
              <li>
                Coin : redimensionner (<kbd>Alt</kbd> : sans garder les proportions)
              </li>
            ) : null}
            <li>
              Rond : tourner {seul ? 'l’objet' : 'le groupe'} (<kbd>Maj</kbd> : par 15°)
            </li>
          </ul>
        </div>
      ) : (
        <ul className="at-raccourcis">
          <li>
            <kbd>Ctrl</kbd> : centrer sur la case
          </li>
          <li>
            <kbd>Maj</kbd> : poser plusieurs fois
          </li>
          <li>
            <kbd>Ctrl</kbd> + clic sur un objet : sélection multiple
          </li>
        </ul>
      )}
      <Palette assets={objets} choisi={arme?.id ?? null} onChoisir={(a) => setArme(arme?.id === a.id ? null : a)} parCategorie />
      <ImportAsset {...props} typeParDefaut="objet" />
    </>
  )
}
