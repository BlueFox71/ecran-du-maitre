/**
 * Étape 4 — la déco. Meubles, tapis, objets, toiles d'araignée : on prend
 * une vignette, on clique où le poser. Un petit objet se pose sur un grand —
 * une bougie sur la commode — puisque le dernier posé passe devant.
 */
import { useEffect, useRef, useState } from 'react'
import { contourDeLObjet, nouvelId, type ObjetPose, type PointCase } from '@shared/atelier'
import { objetSous, redimensionner, tourner } from '@shared/atelierOutils'
import type { AssetAtelier } from '@shared/atelierAssets'
import type { PropsEtape } from '../../modules/Atelier'
import { Palette } from '../Palette'
import { contour, poignee } from '../dessin'
import { ImportAsset } from '../ImportAsset'

/** Où se tient la poignée de rotation : au-dessus de l'objet, en cases. */
const ECART_ROTATION = 0.45

type Geste =
  | { quoi: 'deplacer'; id: string; dx: number; dy: number }
  | { quoi: 'coin'; id: string; i: number }
  | { quoi: 'tourner'; id: string }

function poigneeRotation(o: ObjetPose): PointCase {
  const a = (o.angle * Math.PI) / 180
  const r = o.h / 2 + ECART_ROTATION
  return [o.x + r * Math.sin(a), o.y - r * Math.cos(a)]
}

export function EtapeDeco(props: PropsEtape): JSX.Element {
  const { co, assets, setOutil, repeindre } = props
  const objets = assets.filter((a) => a.type === 'objet')
  const [arme, setArme] = useState<AssetAtelier | null>(null)
  const [choisi, setChoisi] = useState<string | null>(null)
  const geste = useRef<Geste | null>(null)
  const souris = useRef<PointCase | null>(null)
  const objet = choisi ? co.c?.objets.find((o) => o.id === choisi) ?? null : null

  const majObjet = (id: string, f: (o: ObjetPose) => ObjetPose, pas = true): void => {
    const g = (c: NonNullable<typeof co.c>) => ({ ...c, objets: c.objets.map((o) => (o.id === id ? f(o) : o)) })
    if (pas) co.modifier(g)
    else co.remplacer(g)
  }

  useEffect(() => {
    setOutil({
      curseur: arme ? 'copy' : 'default',
      onPointer: (type, p, brut, e, prise) => {
        souris.current = brut
        const c = co.c
        if (!c) return
        if (type === 'down') {
          if (arme) {
            const o: ObjetPose = {
              id: nouvelId(),
              assetId: arme.id,
              x: p[0],
              y: p[1],
              l: arme.l ?? 1,
              h: arme.h ?? 1,
              angle: 0,
              bloquePas: !!arme.bloquePas,
              bloqueVue: !!arme.bloqueVue
            }
            co.modifier((x) => ({ ...x, objets: [...x.objets, o] }))
            setChoisi(o.id)
            /* Maj : on garde la vignette pour en poser plusieurs. */
            if (!e.shiftKey) setArme(null)
            return
          }
          const sel = choisi ? c.objets.find((o) => o.id === choisi) : null
          if (sel) {
            const rot = poigneeRotation(sel)
            if (Math.hypot(brut[0] - rot[0], brut[1] - rot[1]) < prise) {
              co.marquer()
              geste.current = { quoi: 'tourner', id: sel.id }
              return
            }
            const coins = contourDeLObjet(sel).slice(0, 4)
            const i = coins.findIndex((q) => Math.hypot(brut[0] - q[0], brut[1] - q[1]) < prise)
            if (i >= 0) {
              co.marquer()
              geste.current = { quoi: 'coin', id: sel.id, i }
              return
            }
          }
          const sous = objetSous(c, brut)
          setChoisi(sous?.id ?? null)
          if (sous) {
            co.marquer()
            geste.current = { quoi: 'deplacer', id: sous.id, dx: brut[0] - sous.x, dy: brut[1] - sous.y }
          }
        }
        if (type === 'move' && geste.current) {
          const g = geste.current
          if (g.quoi === 'deplacer') majObjet(g.id, (o) => ({ ...o, x: brut[0] - g.dx, y: brut[1] - g.dy }), false)
          if (g.quoi === 'coin') majObjet(g.id, (o) => redimensionner(o, g.i, brut, !e.altKey), false)
          if (g.quoi === 'tourner') majObjet(g.id, (o) => tourner(o, brut, e.shiftKey), false)
        }
        if (type === 'up') geste.current = null
        repeindre()
      },
      dessiner: (ctx, echelle) => {
        const c = co.c
        if (!c) return
        if (arme && souris.current) {
          const [x, y] = souris.current
          contour(ctx, contourDeLObjet({ ...({} as ObjetPose), x, y, l: arme.l ?? 1, h: arme.h ?? 1, angle: 0 }), echelle, true)
        }
        const o = choisi ? c.objets.find((x) => x.id === choisi) : null
        if (o) {
          const pts = contourDeLObjet(o)
          contour(ctx, pts, echelle)
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
  }, [arme, choisi, co.c])

  useEffect(() => {
    const k = (e: KeyboardEvent): void => {
      const el = document.activeElement
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
      if (e.key === 'Escape') {
        setArme(null)
        setChoisi(null)
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && choisi) supprimer()
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && choisi) {
        e.preventDefault()
        dupliquer()
      }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [choisi, co])

  const supprimer = (): void => {
    if (!choisi) return
    co.modifier((c) => ({ ...c, objets: c.objets.filter((o) => o.id !== choisi) }))
    setChoisi(null)
  }
  const dupliquer = (): void => {
    if (!objet) return
    const copie = { ...objet, id: nouvelId(), x: objet.x + 0.3, y: objet.y + 0.3 }
    co.modifier((c) => ({ ...c, objets: [...c.objets, copie] }))
    setChoisi(copie.id)
  }
  const plan = (devant: boolean): void => {
    if (!objet) return
    co.modifier((c) => {
      const reste = c.objets.filter((o) => o.id !== objet.id)
      return { ...c, objets: devant ? [...reste, objet] : [objet, ...reste] }
    })
  }
  const nom = objet ? assets.find((a) => a.id === objet.assetId)?.nom ?? 'Objet introuvable' : ''

  return (
    <>
      {objet ? (
        <div className="at-section at-objet">
          <span className="eyebrow">{nom}</span>
          <label className="at-case">
            <input
              type="checkbox"
              checked={objet.bloquePas}
              onChange={(e) => majObjet(objet.id, (o) => ({ ...o, bloquePas: e.target.checked }))}
            />
            Bloque le passage
          </label>
          <label className="at-case">
            <input
              type="checkbox"
              checked={objet.bloqueVue}
              onChange={(e) => majObjet(objet.id, (o) => ({ ...o, bloqueVue: e.target.checked }))}
            />
            Bloque la vue
          </label>
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
          <p className="at-aide">
            Glisse l’objet pour le déplacer, un coin pour le redimensionner (Alt : sans garder les
            proportions), le rond pour le tourner (Maj : par 15°).
          </p>
        </div>
      ) : (
        <p className="at-aide">
          Prends une vignette puis clique où poser l’objet (Maj : en poser plusieurs). Clique un
          objet posé pour le régler.
        </p>
      )}
      <Palette assets={objets} choisi={arme?.id ?? null} onChoisir={(a) => setArme(arme?.id === a.id ? null : a)} parCategorie />
      <ImportAsset {...props} typeParDefaut="objet" />
    </>
  )
}
