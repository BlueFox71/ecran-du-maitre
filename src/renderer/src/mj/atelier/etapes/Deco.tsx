/**
 * Étape 4 — la déco. Meubles, tapis, objets, toiles d'araignée : on prend
 * une vignette, on clique où le poser. Un petit objet se pose sur un grand —
 * une bougie sur la commode — puisque le dernier posé passe devant.
 *
 * Ctrl + clic ajoute un objet à la sélection (ou l'en retire) : on règle
 * alors tout le groupe d'un coup — ses blocages, son plan, sa place.
 *
 * Les outils de l'objet choisi (plans, miroirs, alignements) se posent dans
 * l'en-tête, à droite des onglets : le panneau reste aux vignettes.
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { contourDeLObjet, nouvelId, type ObjetPose, type PointCase } from '@shared/atelier'
import {
  alignerObjets,
  boiteDesObjets,
  centreDeCase,
  etirer,
  milieuxDesCotes,
  miroirObjets,
  mettreAuPlan,
  objetSous,
  objetsDansRectangle,
  redimensionner,
  tirerObjet,
  tourner,
  tournerGroupe,
  type Alignement
} from '@shared/atelierOutils'
import type { AssetAtelier } from '@shared/atelierAssets'
import type { PropsEtape } from '../../modules/Atelier'
import { CatalogueObjets } from '../Palette'
import { contour, poignee } from '../dessin'
import { ImportAsset } from '../ImportAsset'

/** Où se tient la poignée de rotation : au-dessus de l'objet, en cases. */
const ECART_ROTATION = 0.45

/** Le pas des flèches du clavier, en cases ; avec Maj, une case entière. */
const PAS_FLECHE = 0.1
const FLECHES: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1]
}

/** Les petites icônes de la barre d'outils (trait, 24 × 24). */
const ICONES = {
  devant: <path d="M5 16l7 4 7-4M5 12l7 4 7-4M12 4l7 4-7 4-7-4z" />,
  derriere: <path d="M12 12l7 4-7 4-7-4zM5 8l7 4 7-4M5 12l2 1.2M19 12l-2 1.2M12 4l7 4M12 4L5 8" />,
  dupliquer: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </>
  ),
  supprimer: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />,
  miroirH: <path d="M12 3v18M9 6L3 18h6zM15 6l6 12h-6z" />,
  miroirV: <path d="M3 12h18M6 9L18 3v6zM6 15l12 6v-6z" />,
  tournerG: <path d="M4 4v5h5M4.6 13.5A8 8 0 1 0 6.3 6.3L4 9" />,
  tournerD: <path d="M20 4v5h-5M19.4 13.5A8 8 0 1 1 17.7 6.3L20 9" />,
  gauche: <path d="M4 3v18M8 7h10v3H8zM8 14h6v3H8z" />,
  centreH: <path d="M12 3v18M6 7h12v3H6zM8 14h8v3H8z" />,
  droite: <path d="M20 3v18M6 7h10v3H6zM10 14h6v3h-6z" />,
  haut: <path d="M3 4h18M7 8h3v10H7zM14 8h3v6h-3z" />,
  centreV: <path d="M3 12h18M7 6h3v12H7zM14 8h3v8h-3z" />,
  bas: <path d="M3 20h18M7 6h3v10H7zM14 10h3v6h-3z" />
}

const ALIGNEMENTS: { id: Alignement; titre: string }[] = [
  { id: 'gauche', titre: 'Aligner à gauche' },
  { id: 'centreH', titre: 'Centrer horizontalement' },
  { id: 'droite', titre: 'Aligner à droite' },
  { id: 'haut', titre: 'Aligner en haut' },
  { id: 'centreV', titre: 'Centrer verticalement' },
  { id: 'bas', titre: 'Aligner en bas' }
]

function BoutonIcone({
  icone,
  titre,
  onClick
}: {
  icone: keyof typeof ICONES
  titre: string
  onClick: () => void
}): JSX.Element {
  return (
    <button className="btn btn-sm" onClick={onClick} title={titre} aria-label={titre}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {ICONES[icone]}
      </svg>
    </button>
  )
}

type Geste =
  /** `depart` : la place de chaque objet du groupe quand on l'a saisi. */
  | { quoi: 'deplacer'; id: string; prise: PointCase; depart: Map<string, PointCase> }
  /** `depart` : l'objet quand on l'a saisi — tiré au-delà du bord opposé, il se retourne en miroir. */
  | { quoi: 'coin'; id: string; i: number; depart: ObjetPose }
  /** Le milieu d'un côté : 0 haut, 1 droite, 2 bas, 3 gauche. */
  | { quoi: 'cote'; id: string; i: number; depart: ObjetPose }
  | { quoi: 'tourner'; id: string }
  /** Un rectangle de sélection tiré depuis le vide ; `plus` : il ajoute à la sélection (Ctrl). */
  | { quoi: 'cadre'; de: PointCase; plus: boolean; base: string[] }
  /** Le groupe pivote autour de son centre ; `a0` : l'angle de la souris au départ. */
  | { quoi: 'tournerGroupe'; centre: PointCase; a0: number; depart: ObjetPose[] }

function poigneeRotation(o: ObjetPose): PointCase {
  const a = (o.angle * Math.PI) / 180
  const r = o.h / 2 + ECART_ROTATION
  return [o.x + r * Math.sin(a), o.y - r * Math.cos(a)]
}

const boiteDuGroupe = boiteDesObjets

/** Le curseur d'une poignée de côté : la flèche qui suit l'axe d'étirement, l'objet tourné compris. */
function curseurDeCote(o: ObjetPose, i: number): string {
  const a = (((o.angle + (i % 2 === 1 ? 0 : 90)) % 180) + 180) % 180
  if (a < 22.5 || a >= 157.5) return 'ew-resize'
  if (a < 67.5) return 'nwse-resize'
  if (a < 112.5) return 'ns-resize'
  return 'nesw-resize'
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
  /* Le mode aléatoire : les vignettes cochées, et le prochain tirage (celui que montre l'aperçu). */
  const [hasard, setHasard] = useState(false)
  const [lot, setLot] = useState<string[]>([])
  const [prochain, setProchain] = useState<{ id: string; angle: number; echelle: number } | null>(null)
  const [varier, setVarier] = useState({ rotation: true, taille: true })
  const tirer = (ids: string[], v = varier): void => setProchain(tirerObjet(ids, Math.random, v))
  /* Ce que le prochain clic posera : la vignette armée, ou le tirage du mode aléatoire. */
  const aPoser: { asset: AssetAtelier; angle: number; echelle: number } | null = (() => {
    if (hasard && prochain) {
      const a = objets.find((x) => x.id === prochain.id)
      return a ? { asset: a, angle: prochain.angle, echelle: prochain.echelle } : null
    }
    return arme ? { asset: arme, angle: 0, echelle: 1 } : null
  })()
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
      curseur: aPoser ? 'copy' : 'default',
      /* Le curseur dit ce qu'un clic ferait : tourner, retailler, déplacer. */
      curseurSous: (p, prise) => {
        const c = co.c
        if (aPoser || !c) return undefined
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
          const j = milieuxDesCotes(seul).findIndex((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < prise)
          if (j >= 0) return curseurDeCote(seul, j)
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
          if (hasard) setHasard(false)
          else if (arme) setArme(null)
          else if (geste.current?.quoi === 'cadre') {
            setChoisis(geste.current.base)
            geste.current = null
          } else if (geste.current) {
            geste.current = null
            co.annuler()
          } else setChoisis([])
          repeindre()
          return
        }
        if (type === 'down') {
          if (aPoser) {
            const { asset: a, angle, echelle } = aPoser
            const [x, y] = e.ctrlKey ? centreDeCase(brut) : brut
            const o: ObjetPose = {
              id: nouvelId(),
              assetId: a.id,
              x,
              y,
              l: (a.l ?? 1) * echelle,
              h: (a.h ?? 1) * echelle,
              angle,
              bloquePas: !!a.bloquePas,
              bloqueVue: !!a.bloqueVue
            }
            co.modifier((v) => ({ ...v, objets: [...v.objets, o] }))
            if (hasard) {
              /* En mode aléatoire, on enchaîne : un nouveau tirage pour le clic suivant. */
              tirer(lot)
              return
            }
            setChoisis([o.id])
            /* Maj : on garde la vignette pour en poser plusieurs. */
            if (!e.shiftKey) setArme(null)
            return
          }
          const sous = objetSous(c, brut)
          /* Ctrl + clic : on ajoute l'objet au groupe, ou on l'en retire. */
          if (e.ctrlKey && sous) {
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
              geste.current = { quoi: 'coin', id: seul.id, i, depart: seul }
              return
            }
            const j = milieuxDesCotes(seul).findIndex((q) => Math.hypot(brut[0] - q[0], brut[1] - q[1]) < prise)
            if (j >= 0) {
              co.marquer()
              geste.current = { quoi: 'cote', id: seul.id, i: j, depart: seul }
              return
            }
          }
          /* Depuis le vide : un rectangle de sélection (Ctrl : il ajoute à ce qui est choisi). */
          if (!sous) {
            geste.current = { quoi: 'cadre', de: brut, plus: e.ctrlKey, base: e.ctrlKey ? choisis : [] }
            if (!e.ctrlKey) setChoisis([])
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
          if (g.quoi === 'coin') majObjets([g.id], () => redimensionner(g.depart, g.i, brut, !e.altKey), false)
          if (g.quoi === 'cote') majObjets([g.id], () => etirer(g.depart, g.i, brut), false)
          if (g.quoi === 'tourner') majObjets([g.id], (o) => tourner(o, brut, e.shiftKey), false)
          if (g.quoi === 'tournerGroupe') {
            let delta = angleVers(g.centre, brut) - g.a0
            if (e.shiftKey) delta = Math.round(delta / 15) * 15
            const tournes = new Map(tournerGroupe(g.depart, g.centre, delta).map((o) => [o.id, o]))
            co.remplacer((v) => ({ ...v, objets: v.objets.map((o) => tournes.get(o.id) ?? o) }))
          }
        }
        if (type === 'up' && geste.current?.quoi === 'cadre') {
          const g = geste.current
          const pris = objetsDansRectangle(c.objets, g.de, brut)
          setChoisis(g.plus ? [...new Set([...g.base, ...pris])] : pris)
        }
        if (type === 'up') geste.current = null
        repeindre()
      },
      dessiner: (ctx, echelle) => {
        const c = co.c
        if (!c) return
        if (aPoser && souris.current) {
          const [x, y] = cale.current ? centreDeCase(souris.current) : souris.current
          const { asset: a, angle, echelle: k } = aPoser
          contour(
            ctx,
            contourDeLObjet({ ...({} as ObjetPose), x, y, l: (a.l ?? 1) * k, h: (a.h ?? 1) * k, angle }),
            echelle,
            true
          )
        }
        const g = geste.current
        if (g?.quoi === 'cadre' && souris.current) {
          /* Le rectangle, et en direct ce qu'il prendra. */
          const [a, b] = [g.de, souris.current]
          ctx.setLineDash([5 / echelle, 4 / echelle])
          ctx.strokeStyle = 'rgba(232, 184, 92, 0.95)'
          ctx.fillStyle = 'rgba(232, 184, 92, 0.08)'
          ctx.lineWidth = 1.5 / echelle
          ctx.fillRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))
          ctx.strokeRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))
          ctx.setLineDash([])
          const pris = new Set([...g.base, ...objetsDansRectangle(c.objets, a, b)])
          for (const o of c.objets) if (pris.has(o.id)) contour(ctx, contourDeLObjet(o), echelle)
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
          /* Les milieux des côtés, plus petits : on étire dans un seul sens. */
          milieuxDesCotes(o).forEach((q, i) => {
            const actif = geste.current?.quoi === 'cote' && geste.current.i === i
            const r = (actif ? 5 : 3.5) / echelle
            ctx.beginPath()
            ctx.arc(q[0], q[1], r, 0, Math.PI * 2)
            ctx.fillStyle = actif ? 'rgba(232, 184, 92, 1)' : '#fff'
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)'
            ctx.lineWidth = 1.5 / echelle
            ctx.fill()
            ctx.stroke()
          })
        }
      }
    })
    return () => setOutil(null)
  }, [arme, choisis, co.c, hasard, prochain, lot])

  useEffect(() => {
    const k = (e: KeyboardEvent): void => {
      const el = document.activeElement
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
      if (e.key === 'Escape') {
        setArme(null)
        setHasard(false)
        setChoisis([])
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && choisis.length) supprimer()
      /* Les flèches poussent la sélection ; une touche tenue ne fait qu'un pas d'historique. */
      const f = FLECHES[e.key]
      if (f && choisis.length && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        const pas = e.shiftKey ? 1 : PAS_FLECHE
        majObjets(choisis, (o) => ({ ...o, x: o.x + f[0] * pas, y: o.y + f[1] * pas }), !e.repeat)
      }
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
  /* Un quart de tour : l'objet seul sur lui-même, un groupe autour de son centre. */
  const quartDeTour = (delta: number): void =>
    transformer((g) => {
      const b = boiteDesObjets(g)
      return tournerGroupe(g, [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2], delta)
    })
  /* Miroirs et alignements : le groupe tel qu'il est maintenant, remis à sa place dans la liste. */
  const transformer = (f: (g: ObjetPose[]) => ObjetPose[]): void => {
    if (!choisis.length) return
    co.modifier((c) => {
      const faits = new Map(f(c.objets.filter((o) => choisis.includes(o.id))).map((o) => [o.id, o]))
      return { ...c, objets: c.objets.map((o) => faits.get(o.id) ?? o) }
    })
  }
  const titre = seul
    ? (assets.find((a) => a.id === seul.assetId)?.nom ?? 'Objet introuvable')
    : `${groupe.length} objets choisis`

  const onChoisir = (a: AssetAtelier): void => {
    if (!hasard) return setArme(arme?.id === a.id ? null : a)
    const n = lot.includes(a.id) ? lot.filter((id) => id !== a.id) : [...lot, a.id]
    setLot(n)
    tirer(n)
  }

  const barre =
    groupe.length && props.barreOutils
      ? createPortal(
          <>
            <BoutonIcone icone="devant" titre="Premier plan" onClick={() => plan(true)} />
            <BoutonIcone icone="derriere" titre="Arrière-plan" onClick={() => plan(false)} />
            <span className="at-sep" />
            <BoutonIcone icone="tournerG" titre="Tourner d’un quart de tour à gauche" onClick={() => quartDeTour(-90)} />
            <BoutonIcone icone="tournerD" titre="Tourner d’un quart de tour à droite" onClick={() => quartDeTour(90)} />
            <BoutonIcone
              icone="miroirH"
              titre="Miroir horizontal (gauche ↔ droite)"
              onClick={() => transformer((g) => miroirObjets(g, 'h'))}
            />
            <BoutonIcone
              icone="miroirV"
              titre="Miroir vertical (haut ↔ bas)"
              onClick={() => transformer((g) => miroirObjets(g, 'v'))}
            />
            {groupe.length > 1 ? (
              <>
                <span className="at-sep" />
                {ALIGNEMENTS.map((a) => (
                  <BoutonIcone
                    key={a.id}
                    icone={a.id}
                    titre={a.titre}
                    onClick={() => transformer((g) => alignerObjets(g, a.id))}
                  />
                ))}
              </>
            ) : null}
            <span className="at-sep" />
            <BoutonIcone icone="dupliquer" titre="Dupliquer (Ctrl+D)" onClick={dupliquer} />
            <BoutonIcone icone="supprimer" titre="Supprimer (Suppr)" onClick={supprimer} />
          </>,
          props.barreOutils
        )
      : null

  /* Comme pour le sol : le haut est figé, seule la grille des objets défile. */
  return (
    <div className="at-colonne">
      {barre}
      <div className="at-fige">
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
          <ul className="at-raccourcis">
            <li>
              <kbd>Ctrl</kbd> <span className="at-geste">+ clic</span> : ajouter ou retirer de la sélection
            </li>
            <li>Glisser : déplacer {seul ? 'l’objet' : 'le groupe'} (<kbd>Ctrl</kbd> : centrer sur la case)</li>
            <li>
              Flèches : pousser d’un dixième de case (<kbd>Maj</kbd> : d’une case)
            </li>
            {seul ? (
              <li>
                Coin : redimensionner (<kbd>Alt</kbd> : sans garder les proportions)
              </li>
            ) : null}
            {seul ? (
              <li>Milieu d’un côté : allonger ou rétrécir dans ce sens seulement</li>
            ) : null}
            {seul ? <li>Tirer un coin ou un côté au-delà du bord opposé : retourner l’objet en miroir</li> : null}
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
            <kbd>Ctrl</kbd> <span className="at-geste">+ clic sur un objet</span> : sélection multiple
          </li>
        </ul>
      )}
      <div className="at-section">
        <div className="at-outils">
        <button
          className="btn btn-sm"
          aria-pressed={hasard}
          title="Coche plusieurs vignettes : chaque clic pose l’une d’elles au hasard, tournée et retaillée au hasard"
          onClick={() => {
            const v = !hasard
            setHasard(v)
            setArme(null)
            if (v) tirer(lot)
          }}
        >
          🎲 Mode aléatoire
        </button>
        </div>
        {hasard ? (
          <>
            <label className="at-case">
              <input
                type="checkbox"
                checked={varier.rotation}
                onChange={(e) => {
                  const v = { ...varier, rotation: e.target.checked }
                  setVarier(v)
                  tirer(lot, v)
                }}
              />
              Rotation variée
            </label>
            <label className="at-case">
              <input
                type="checkbox"
                checked={varier.taille}
                onChange={(e) => {
                  const v = { ...varier, taille: e.target.checked }
                  setVarier(v)
                  tirer(lot, v)
                }}
              />
              Taille variée
            </label>
          </>
        ) : null}
      </div>
      </div>
      {/* Le catalogue prend le reste du panneau : ses colonnes et sa grille défilent chacune. */}
      <CatalogueObjets
        assets={objets}
        choisi={arme?.id ?? null}
        choisis={hasard ? lot : undefined}
        onChoisir={onChoisir}
        apres={<ImportAsset {...props} typeParDefaut="objet" />}
      />
    </div>
  )
}
