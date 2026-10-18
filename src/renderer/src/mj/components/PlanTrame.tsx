import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { ChoixImage } from '../modules/Timeline'
import { RognageCarre } from './RognageCarre'
import { styleCarre } from '../../shared/Visage'
import type { UiItem } from '../../../../preload/index'
import { IconClose, IconCrop, IconImage, IconTrame, IconTrash } from './Icons'
import type { CadreCarre, Trame, TrameCarte, TrameType } from '@shared/types'
import { useEchap } from '../echap'

/* ============================================================
   L'arborescence de la séance (la « trame » du code) : le scénario du
   début à la fin, en cartes
   reliées par des flèches — « ceci ouvre la voie à cela ».
   On la dessine dans la Préparation ; au Paravent, un clic sur une
   carte la coche (fond vert). Elle ne quitte jamais le poste du MJ.
   ============================================================ */

/** La largeur d'une carte, sa hauteur sans image, et ce que l'image ajoute. */
const W = 210
const H = 104
const H_IMAGE = 82
const PAS = 20
/** Les proportions du bandeau : la largeur de la carte entre ses bords, sur sa hauteur. */
const RAPPORT_IMAGE = (W - 2) / H_IMAGE

export const NOMS_TYPE: Record<TrameType, string> = {
  ouverture: 'Ouverture',
  scene: 'Scène',
  objectif: 'Objectif',
  fin: 'Fin'
}
const TYPES = Object.keys(NOMS_TYPE) as TrameType[]

const hauteur = (c: TrameCarte): number => (c.itemId != null ? H + H_IMAGE : H)
const grille = (v: number): number => Math.round(v / PAS) * PAS

/**
 * À portée : rien n'y mène, ou ce qui y mène est fait — toutes les flèches,
 * ou une seule si la carte s'en contente.
 */
export function aPortee(c: TrameCarte, t: Trame): boolean {
  const entrees = t.liens.filter((l) => l.a === c.id)
  if (!entrees.length) return true
  const faits = entrees.filter((l) => t.cartes.find((x) => x.id === l.de)?.fait).length
  return c.regle === 'ou' || entrees.length === 1 ? faits > 0 : faits === entrees.length
}

/** La trame de la séance en cours, relue quand on change de séance ou qu'on défait. */
export function useTrame(): [Trame | null, (f: (t: Trame) => Trame) => void, () => Promise<void>] {
  const sessionId = useStore((s) => s.session?.id)
  const [trame, setTrame] = useState<Trame | null>(null)
  const recharger = useCallback(async () => setTrame(await window.jdr.trame.lire()), [])
  useEffect(() => {
    void recharger()
    const h = (): void => void recharger()
    window.addEventListener('jdr:defait', h)
    /* Le fichier Arborescence.json réécrit hors de l'application : on relit —
       mais pas sous les doigts de qui écrit dans le volet ; on attend qu'il
       en sorte, sans quoi sa frappe serait remplacée par l'ancien texte. */
    let enAttente = false
    const enSaisie = (): boolean => !!document.activeElement?.closest('.tm-volet input, .tm-volet textarea')
    const fin = window.jdr.library.onChanged(() => {
      if (enSaisie()) enAttente = true
      else h()
    })
    const sortie = (): void => {
      if (!enAttente) return
      /* Le blur a enregistré le champ : on relit une fois qu'il a abouti. */
      setTimeout(() => {
        if (enSaisie()) return
        enAttente = false
        h()
      }, 300)
    }
    window.addEventListener('focusout', sortie)
    return () => {
      window.removeEventListener('jdr:defait', h)
      window.removeEventListener('focusout', sortie)
      fin()
    }
  }, [sessionId, recharger])
  const changer = useCallback((f: (t: Trame) => Trame) => setTrame((t) => (t ? f(t) : t)), [])
  return [trame, changer, recharger]
}

type Choix = { k: 'carte' | 'lien'; id: number } | null
type Vue = { x: number; y: number; z: number }

type Geste =
  | { k: 'pan'; x0: number; y0: number; vx: number; vy: number; bouge: boolean }
  | {
      k: 'carte'
      id: number
      x0: number
      y0: number
      /** Ctrl tenu : le clic ajoute ou retire la carte de la sélection. */
      ctrl: boolean
      /** Les cartes qui suivent le glisser, et d'où elles partent. */
      depart: Map<number, { x: number; y: number }>
      bouge: boolean
    }
  | { k: 'relier'; de: number; x: number; y: number }

/* ============================================================
   Le plan : partagé par la page de préparation et le Paravent
   ============================================================ */

export function PlanTrame({
  mode,
  trame,
  changer,
  recharger,
  choix,
  onChoix
}: {
  mode: 'prep' | 'jeu'
  trame: Trame
  changer: (f: (t: Trame) => Trame) => void
  recharger: () => Promise<void>
  choix: Choix
  onChoix: (c: Choix) => void
}): JSX.Element {
  const s = useStore()
  const plan = useRef<HTMLDivElement>(null)
  const [vue, setVue] = useState<Vue>({ x: 30, y: 30, z: 0.8 })
  const geste = useRef<Geste | null>(null)
  const [brouillon, setBrouillon] = useState<{ de: number; x: number; y: number } | null>(null)
  const ajuste = useRef(false)
  /* Plusieurs cartes choisies d'un Ctrl+clic, qui se déplacent ensemble. La
     dernière touchée reste celle du volet. */
  const [groupe, setGroupe] = useState<number[]>([])
  const choisies = new Set(groupe)
  if (choix?.k === 'carte') choisies.add(choix.id)
  /* Une flèche qui entre dans une carte choisie ou qui en sort. */
  const touche = (l: { de: number; a: number }): boolean => choisies.has(l.de) || choisies.has(l.a)

  const carte = (id: number): TrameCarte | undefined => trame.cartes.find((c) => c.id === id)

  const ajuster = useCallback(() => {
    const r = plan.current?.getBoundingClientRect()
    if (!r || !r.width) return
    if (!trame.cartes.length) return setVue({ x: 40, y: 40, z: 0.9 })
    const x0 = Math.min(...trame.cartes.map((c) => c.x)) - 30
    const y0 = Math.min(...trame.cartes.map((c) => c.y)) - 30
    const x1 = Math.max(...trame.cartes.map((c) => c.x + W)) + 30
    const y1 = Math.max(...trame.cartes.map((c) => c.y + hauteur(c))) + 30
    const z = Math.max(0.3, Math.min(1, r.width / (x1 - x0), r.height / (y1 - y0)))
    setVue({ z, x: (r.width - (x1 - x0) * z) / 2 - x0 * z, y: (r.height - (y1 - y0) * z) / 2 - y0 * z })
  }, [trame])

  /* La première fois, on montre tout. */
  useLayoutEffect(() => {
    if (ajuste.current) return
    ajuste.current = true
    ajuster()
  }, [ajuster])

  const versMonde = (cx: number, cy: number): { x: number; y: number } => {
    const r = plan.current!.getBoundingClientRect()
    return { x: (cx - r.left - vue.x) / vue.z, y: (cy - r.top - vue.y) / vue.z }
  }

  const zoomer = (facteur: number, cx?: number, cy?: number): void => {
    const r = plan.current?.getBoundingClientRect()
    if (!r) return
    const px = cx ?? r.width / 2
    const py = cy ?? r.height / 2
    setVue((v) => {
      const z = Math.min(1.6, Math.max(0.3, v.z * facteur))
      return { z, x: px - ((px - v.x) * z) / v.z, y: py - ((py - v.y) * z) / v.z }
    })
  }

  /* La molette zoome autour du pointeur ; React pose ses écouteurs de roue en
     passif, d'où celui-ci, à la main. */
  useEffect(() => {
    const el = plan.current
    if (!el) return
    const h = (e: WheelEvent): void => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      zoomer(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - r.left, e.clientY - r.top)
    }
    el.addEventListener('wheel', h, { passive: false })
    return () => el.removeEventListener('wheel', h)
  }, [])

  const creer = async (type: TrameType, x: number, y: number): Promise<void> => {
    const c = await window.jdr.trame.creer({ type, x: grille(x), y: grille(y) })
    changer((t) => ({ ...t, cartes: [...t.cartes, c] }))
    setGroupe([])
    onChoix({ k: 'carte', id: c.id })
  }

  /* ---- les gestes ---- */

  const down = (e: React.PointerEvent): void => {
    if (e.button !== 0) return
    const cible = e.target as HTMLElement
    const port = cible.closest('.tm-port')
    const el = cible.closest<HTMLElement>('.tm-carte')
    const lien = cible.closest<SVGElement>('[data-lien]')
    plan.current!.setPointerCapture(e.pointerId)
    if (port && el && mode === 'prep') {
      const c = carte(Number(el.dataset.id))!
      geste.current = { k: 'relier', de: c.id, x: c.x + W, y: c.y + hauteur(c) / 2 }
      return
    }
    if (el) {
      const c = carte(Number(el.dataset.id))!
      const ctrl = mode === 'prep' && (e.ctrlKey || e.metaKey)
      /* On emporte la sélection si on la saisit (ou si Ctrl l'agrandit) ;
         sinon la carte seule. */
      const ids = ctrl || (choisies.has(c.id) && choisies.size > 1) ? new Set([...choisies, c.id]) : new Set([c.id])
      const depart = new Map<number, { x: number; y: number }>()
      for (const x of trame.cartes) if (ids.has(x.id)) depart.set(x.id, { x: x.x, y: x.y })
      geste.current = { k: 'carte', id: c.id, x0: e.clientX, y0: e.clientY, ctrl, depart, bouge: false }
      return
    }
    if (lien && mode === 'prep') {
      geste.current = null
      setGroupe([])
      onChoix({ k: 'lien', id: Number(lien.dataset.lien) })
      return
    }
    geste.current = { k: 'pan', x0: e.clientX, y0: e.clientY, vx: vue.x, vy: vue.y, bouge: false }
  }

  const move = (e: React.PointerEvent): void => {
    const g = geste.current
    if (!g) return
    if (g.k === 'pan') {
      const dx = e.clientX - g.x0
      const dy = e.clientY - g.y0
      if (Math.abs(dx) + Math.abs(dy) > 3) g.bouge = true
      setVue((v) => ({ ...v, x: g.vx + dx, y: g.vy + dy }))
    } else if (g.k === 'carte' && mode === 'prep') {
      const dx = (e.clientX - g.x0) / vue.z
      const dy = (e.clientY - g.y0) / vue.z
      if (!g.bouge && Math.abs(dx) + Math.abs(dy) < 4) return
      g.bouge = true
      changer((t) => ({
        ...t,
        cartes: t.cartes.map((c) => {
          const d = g.depart.get(c.id)
          return d ? { ...c, x: grille(d.x + dx), y: grille(d.y + dy) } : c
        })
      }))
    } else if (g.k === 'relier') {
      const p = versMonde(e.clientX, e.clientY)
      setBrouillon({ de: g.de, x: p.x, y: p.y })
    }
  }

  const up = (e: React.PointerEvent): void => {
    const g = geste.current
    geste.current = null
    if (!g) return
    if (g.k === 'relier') {
      setBrouillon(null)
      const sous = document
        .elementsFromPoint(e.clientX, e.clientY)
        .find((x) => x instanceof HTMLElement && x.classList.contains('tm-carte')) as HTMLElement | undefined
      const a = sous ? Number(sous.dataset.id) : null
      if (a && a !== g.de)
        void window.jdr.trame.relier(g.de, a).then((l) => {
          if (l) changer((t) => ({ ...t, liens: [...t.liens, l] }))
        })
      return
    }
    if (g.k === 'carte') {
      const c = carte(g.id)
      if (!c) return
      if (g.bouge) {
        /* Plusieurs cartes déplacées : un seul pas de Ctrl+Z. */
        const bougees = trame.cartes.filter((x) => g.depart.has(x.id))
        void (async () => {
          if (bougees.length > 1) await window.jdr.defaire.ouvrirGroupe()
          try {
            for (const x of bougees) await window.jdr.trame.maj(x.id, { x: x.x, y: x.y })
          } finally {
            if (bougees.length > 1) await window.jdr.defaire.fermerGroupe()
          }
        })()
      } else if (mode === 'jeu') {
        const fait = !c.fait
        changer((t) => ({ ...t, cartes: t.cartes.map((x) => (x.id === c.id ? { ...x, fait } : x)) }))
        void window.jdr.trame.cocher(c.id, fait)
      } else if (g.ctrl) {
        const avant = [...choisies]
        const apres = avant.includes(c.id) ? avant.filter((x) => x !== c.id) : [...avant, c.id]
        setGroupe(apres)
        const derniere = apres.includes(c.id) ? c.id : apres[apres.length - 1]
        onChoix(derniere != null ? { k: 'carte', id: derniere } : null)
      } else {
        setGroupe([])
        onChoix({ k: 'carte', id: c.id })
      }
      return
    }
    if (g.k === 'pan' && !g.bouge && (choix || groupe.length)) {
      setGroupe([])
      onChoix(null)
    }
  }

  const dbl = (e: React.MouseEvent): void => {
    if (mode !== 'prep' || (e.target as HTMLElement).closest('.tm-carte')) return
    const p = versMonde(e.clientX, e.clientY)
    void creer('scene', p.x - W / 2, p.y - H / 2)
  }

  /* Suppr efface ce qui est choisi ; Échap le lâche. */
  useEffect(() => {
    const h = (e: KeyboardEvent): void => {
      if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return
      if (e.key === 'Escape') {
        setGroupe([])
        if (choix) onChoix(null)
      }
      if (mode !== 'prep' || !choix || e.key !== 'Delete') return
      e.preventDefault()
      if (groupe.length > 1) {
        /* Toute la sélection, d'un seul pas de Ctrl+Z. */
        const ids = [...new Set([...groupe, ...(choix.k === 'carte' ? [choix.id] : [])])]
        void (async () => {
          await window.jdr.defaire.ouvrirGroupe()
          try {
            for (const id of ids) await window.jdr.trame.supprimer(id)
          } finally {
            await window.jdr.defaire.fermerGroupe()
          }
          changer((t) => ({
            cartes: t.cartes.filter((c) => !ids.includes(c.id)),
            liens: t.liens.filter((l) => !ids.includes(l.de) && !ids.includes(l.a))
          }))
          setGroupe([])
          onChoix(null)
        })()
        return
      }
      void supprimerChoix(choix, changer, onChoix)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [choix, groupe, mode, changer, onChoix])

  /* ---- le dessin ---- */

  const libelleLiens = (c: TrameCarte): string => {
    const bouts: string[] = []
    const b = c.beatId != null ? s.beats.find((x) => x.id === c.beatId) : null
    if (b) bouts.push(`◷ ${b.atTime ?? b.title}`)
    const p = c.placeId != null ? s.places.find((x) => x.id === c.placeId) : null
    if (p) bouts.push(`⌂ ${p.name}`)
    const pnj = c.pnjIds.map((id) => s.characters.find((x) => x.id === id)?.name).filter(Boolean)
    if (pnj.length) bouts.push(`☺ ${pnj.join(', ')}`)
    return bouts.join(' · ')
  }

  const chemin = (x1: number, y1: number, x2: number, y2: number): string => {
    const dx = Math.max(40, (x2 - x1) / 2)
    return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`
  }

  return (
    <div
      ref={plan}
      className={`tm-plan${mode === 'jeu' ? ' tm-en-jeu' : ''}`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => {
        geste.current = null
        setBrouillon(null)
      }}
      onDoubleClick={dbl}
      style={{ backgroundPosition: `${vue.x}px ${vue.y}px`, backgroundSize: `${PAS * vue.z}px ${PAS * vue.z}px` }}
    >
      <div className="tm-monde" style={{ transform: `translate(${vue.x}px, ${vue.y}px) scale(${vue.z})` }}>
        <svg className="tm-liens" width="1" height="1">
          <defs>
            {['', 'franchi', 'voisin', 'choisi'].map((k) => (
              <marker
                key={k}
                id={`tm-fleche-${k || 'n'}`}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto"
              >
                <path className={`tm-pointe ${k}`} d="M0,0 L10,5 L0,10 z" />
              </marker>
            ))}
          </defs>
          {/* Les flèches qui entrent dans une carte choisie ou qui en sortent
             passent en jaune, tracées en dernier pour rester par-dessus. */}
          {[...trame.liens].sort((p, q) => Number(touche(p)) - Number(touche(q))).map((l) => {
            const a = carte(l.de)
            const b = carte(l.a)
            if (!a || !b) return null
            const x1 = a.x + W
            const y1 = a.y + hauteur(a) / 2
            const x2 = b.x - 4
            const y2 = b.y + hauteur(b) / 2
            const d = chemin(x1, y1, x2, y2)
            const k =
              choix?.k === 'lien' && choix.id === l.id
                ? 'choisi'
                : touche(l)
                  ? 'voisin'
                  : a.fait
                    ? 'franchi'
                    : ''
            return (
              <g key={l.id}>
                <path className={`tm-lien ${k}`} d={d} markerEnd={`url(#tm-fleche-${k || 'n'})`} />
                {mode === 'prep' ? <path className="tm-lien-prise" data-lien={l.id} d={d} /> : null}
                {l.mot ? (
                  <text className="tm-mot" x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6} textAnchor="middle">
                    {l.mot}
                  </text>
                ) : null}
              </g>
            )
          })}
          {brouillon
            ? (() => {
                const a = carte(brouillon.de)
                return a ? (
                  <path className="tm-brouillon" d={chemin(a.x + W, a.y + hauteur(a) / 2, brouillon.x, brouillon.y)} />
                ) : null
              })()
            : null}
        </svg>

        {trame.cartes.map((c) => {
          const nEntrees = trame.liens.filter((l) => l.a === c.id).length
          const portee = aPortee(c, trame)
          const img = c.itemId != null ? s.fichiers.find((i) => i.id === c.itemId) : null
          const liens = libelleLiens(c)
          return (
            <div
              key={c.id}
              data-id={c.id}
              className={`tm-carte tm-${c.type}${c.fait ? ' fait' : ''}${portee ? ' portee' : ' verrou'}${
                choisies.has(c.id) ? ' choisie' : ''
              }`}
              style={{ left: c.x, top: c.y, height: hauteur(c) }}
              title={mode === 'jeu' ? (c.fait ? 'Faite — cliquer pour décocher' : 'Cliquer quand c’est fait') : undefined}
            >
              {c.fait ? <span className="tm-coche">✓</span> : null}
              {c.itemId != null ? (
                <ImageCarte className="tm-vignette" img={img} cadre={c.imageCadre} />
              ) : null}
              <div className="tm-type">
                <i />
                {NOMS_TYPE[c.type]}
                {nEntrees > 1 ? (
                  <span
                    className="tm-regle"
                    title={c.regle === 'ou' ? 'Une seule flèche entrante suffit' : 'Il faut toutes les flèches entrantes'}
                  >
                    {c.regle === 'ou' ? 'une suffit' : 'toutes'}
                  </span>
                ) : null}
              </div>
              <h4>{c.titre || 'Sans titre'}</h4>
              {c.resume ? <p>{c.resume}</p> : null}
              {liens ? <div className="tm-attaches">{liens}</div> : null}
              {mode === 'prep' ? (
                <div
                  className="tm-port"
                  style={{ top: hauteur(c) / 2 - 7 }}
                  title="Tirer vers une autre carte pour les relier"
                />
              ) : null}
            </div>
          )
        })}
      </div>

      {!trame.cartes.length ? (
        <div className="tm-vide">
          <IconTrame />
          {mode === 'prep' ? (
            <>
              <b>L’arborescence est vide.</b>
              <span>Commence par l’ouverture, puis ajoute scènes, objectifs et fins, et relie-les.</span>
              <button
                className="btn btn-brass"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  const r = plan.current!.getBoundingClientRect()
                  const p = versMonde(r.left + 60, r.top + r.height / 2)
                  void creer('ouverture', p.x, p.y - H / 2)
                }}
              >
                Poser l’ouverture
              </button>
            </>
          ) : (
            <>
              <b>Aucune arborescence pour cette séance.</b>
              <span>Elle se prépare dans « Préparation de la séance », onglet Arborescence.</span>
            </>
          )}
        </div>
      ) : null}

      {mode === 'prep' && choisies.size > 1 ? (
        <div className="tm-selection">
          {choisies.size} cartes choisies — glisser l’une les déplace toutes · Suppr les efface · Échap
        </div>
      ) : null}

      <div className="tm-legende">
        {mode === 'prep' ? (
          <>
            <span>double-clic : nouvelle scène</span>
            <span>tirer le rond ● : relier</span>
            <span>Ctrl+clic : en choisir plusieurs</span>
            <span>Suppr : effacer</span>
            <span>molette : zoom</span>
          </>
        ) : (
          <>
            <span>
              <i className="l-fait" />
              faite
            </span>
            <span>
              <i className="l-portee" />à portée
            </span>
            <span>
              <i className="l-verrou" />
              pas encore
            </span>
          </>
        )}
      </div>

      <div className="tm-zoom" onPointerDown={(e) => e.stopPropagation()}>
        <button className="btn btn-sm btn-ghost" onClick={() => zoomer(1 / 1.15)} aria-label="Dézoomer">
          −
        </button>
        <span className="num">{Math.round(vue.z * 100)} %</span>
        <button className="btn btn-sm btn-ghost" onClick={() => zoomer(1.15)} aria-label="Zoomer">
          +
        </button>
        <button className="btn btn-sm btn-ghost" onClick={ajuster} title="Cadrer toute l’arborescence">
          Tout voir
        </button>
        {mode === 'prep' ? null : (
          <button className="btn btn-sm btn-ghost" onClick={() => void recharger()} title="Relire l’arborescence">
            Relire
          </button>
        )}
      </div>

      {/* Pour les boutons de la barre : créer au milieu de ce qu'on voit. */}
      <CreerAuCentre
        plan={plan}
        versMonde={versMonde}
        creer={(t, x, y) => void creer(t, x, y)}
      />
    </div>
  )
}

/** Les boutons « Scène / Objectif / Fin » de la page parlent au plan par un événement. */
function CreerAuCentre({
  plan,
  versMonde,
  creer
}: {
  plan: React.RefObject<HTMLDivElement>
  versMonde: (cx: number, cy: number) => { x: number; y: number }
  creer: (t: TrameType, x: number, y: number) => void
}): null {
  const ref = useRef({ versMonde, creer })
  ref.current = { versMonde, creer }
  useEffect(() => {
    const h = (e: Event): void => {
      const r = plan.current?.getBoundingClientRect()
      if (!r) return
      const p = ref.current.versMonde(r.left + r.width / 2, r.top + r.height / 2)
      const decale = (Math.random() - 0.5) * 80
      ref.current.creer((e as CustomEvent<TrameType>).detail, p.x - W / 2 + decale, p.y - H / 2 + decale)
    }
    window.addEventListener('trame:creer', h)
    return () => window.removeEventListener('trame:creer', h)
  }, [plan])
  return null
}

export const demanderCarte = (t: TrameType): void => {
  window.dispatchEvent(new CustomEvent('trame:creer', { detail: t }))
}

async function supprimerChoix(
  choix: NonNullable<Choix>,
  changer: (f: (t: Trame) => Trame) => void,
  onChoix: (c: Choix) => void
): Promise<void> {
  if (choix.k === 'carte') {
    await window.jdr.trame.supprimer(choix.id)
    changer((t) => ({
      cartes: t.cartes.filter((c) => c.id !== choix.id),
      liens: t.liens.filter((l) => l.de !== choix.id && l.a !== choix.id)
    }))
  } else {
    await window.jdr.trame.supprimerLien(choix.id)
    changer((t) => ({ ...t, liens: t.liens.filter((l) => l.id !== choix.id) }))
  }
  onChoix(null)
}

/** L'image d'une carte : le morceau choisi, ou le centre qui remplit le bandeau. */
function ImageCarte({
  img,
  cadre,
  className
}: {
  img: UiItem | null | undefined
  cadre: CadreCarre | null
  className?: string
}): JSX.Element {
  const src = cadre ? (img?.url ?? img?.poster) : (img?.poster ?? img?.url)
  return (
    <div className={`tm-cadre-image${className ? ` ${className}` : ''}`}>
      {src ? <img src={src} alt="" draggable={false} style={cadre ? styleCarre(cadre) : undefined} /> : null}
    </div>
  )
}

/* ============================================================
   Le volet de préparation : la carte ou la flèche choisie
   ============================================================ */

export function VoletTrame({
  trame,
  changer,
  choix,
  onChoix
}: {
  trame: Trame
  changer: (f: (t: Trame) => Trame) => void
  choix: Choix
  onChoix: (c: Choix) => void
}): JSX.Element {
  const s = useStore()
  const [choixImage, setChoixImage] = useState(false)
  const [rogner, setRogner] = useState(false)

  if (!choix) {
    return (
      <div className="tm-volet">
        <h3>L’arborescence de la séance</h3>
        <p className="tm-aide">
          Le scénario du début à la fin, en cartes reliées par des flèches. Une flèche veut dire
          «&nbsp;ceci ouvre la voie à cela&nbsp;».
        </p>
        <div className="tm-types">
          <span className="tm-ouverture"><i />Ouverture<small>le point de départ</small></span>
          <span className="tm-scene"><i />Scène<small>ce qui se passe</small></span>
          <span className="tm-objectif"><i />Objectif<small>ce qu’ils doivent obtenir</small></span>
          <span className="tm-fin"><i />Fin<small>une issue possible</small></span>
        </div>
        <p className="tm-aide">
          Quand plusieurs flèches arrivent sur une carte, choisis s’il les faut <b>toutes</b> ou si{' '}
          <b>une suffit</b>. C’est ce qui dit, au Paravent, ce qui est à portée des joueurs.
        </p>
        <p className="tm-aide">L’arborescence ne sort jamais de ton poste : ni l’écran ni les portables ne la voient.</p>
      </div>
    )
  }

  if (choix.k === 'lien') {
    const l = trame.liens.find((x) => x.id === choix.id)
    if (!l) return <div className="tm-volet" />
    const de = trame.cartes.find((c) => c.id === l.de)
    const a = trame.cartes.find((c) => c.id === l.a)
    const poser = (mot: string): void =>
      changer((t) => ({ ...t, liens: t.liens.map((x) => (x.id === l.id ? { ...x, mot } : x)) }))
    return (
      <div className="tm-volet">
        <span className="eyebrow">Flèche</span>
        <h3>
          {de?.titre} → {a?.titre}
        </h3>
        <div className="field">
          <label htmlFor="tm-mot">Ce qui fait passer (facultatif)</label>
          <input
            id="tm-mot"
            type="text"
            value={l.mot}
            placeholder="ex. ils trouvent la clé"
            onChange={(e) => poser(e.target.value)}
            onBlur={(e) => void window.jdr.trame.majLien(l.id, e.target.value.trim())}
          />
        </div>
        <div className="tm-actions">
          <button className="btn btn-sm btn-danger" onClick={() => void supprimerChoix(choix, changer, onChoix)}>
            <IconTrash />
            Effacer la flèche
          </button>
        </div>
      </div>
    )
  }

  const c = trame.cartes.find((x) => x.id === choix.id)
  if (!c) return <div className="tm-volet" />
  const nEntrees = trame.liens.filter((l) => l.a === c.id).length
  const img = c.itemId != null ? s.fichiers.find((i) => i.id === c.itemId) : null
  const pnjs = s.characters.filter((x) => x.kind === 'pnj')

  /* Le texte s'enregistre en sortant du champ ; le reste, tout de suite. */
  const local = (patch: Partial<TrameCarte>): void =>
    changer((t) => ({ ...t, cartes: t.cartes.map((x) => (x.id === c.id ? { ...x, ...patch } : x)) }))
  const poser = (patch: Partial<Omit<TrameCarte, 'id' | 'sessionId' | 'fait'>>): void => {
    local(patch)
    void window.jdr.trame.maj(c.id, patch)
  }

  return (
    <div className="tm-volet" key={c.id}>
      <div className="seg tm-seg" role="radiogroup" aria-label="Sorte de carte">
        {TYPES.map((t) => (
          <button key={t} className={c.type === t ? 'on' : ''} aria-checked={c.type === t} role="radio" onClick={() => poser({ type: t })}>
            {NOMS_TYPE[t]}
          </button>
        ))}
      </div>

      <div className="field">
        <label htmlFor="tm-titre">Titre</label>
        <input
          id="tm-titre"
          type="text"
          value={c.titre}
          autoFocus={c.titre.startsWith('Nouvel')}
          onFocus={(e) => e.target.select()}
          onChange={(e) => local({ titre: e.target.value })}
          onBlur={(e) => void window.jdr.trame.maj(c.id, { titre: e.target.value.trim() })}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      </div>

      <div className="field">
        <label>Image de la carte</label>
        {c.itemId != null ? (
          <>
            <button
              className="tm-image"
              disabled={!img}
              onClick={() => setRogner(true)}
              title="Rogner : choisir le morceau de l’image que montre la carte"
            >
              <ImageCarte img={img} cadre={c.imageCadre} />
            </button>
            <span className="tm-chemin">{img?.relPath ?? 'Fichier introuvable'}</span>
            <div className="tm-actions">
              <button className="btn btn-sm" disabled={!img} onClick={() => setRogner(true)}>
                <IconCrop />
                Rogner…
              </button>
              <button className="btn btn-sm" onClick={() => setChoixImage(true)}>
                <IconImage />
                Changer…
              </button>
              <button className="btn btn-sm btn-ghost" onClick={() => poser({ itemId: null, imageCadre: null })}>
                <IconClose />
                Retirer
              </button>
            </div>
          </>
        ) : (
          <div className="tm-actions">
            <button className="btn btn-sm" onClick={() => setChoixImage(true)}>
              <IconImage />
              Choisir une image…
            </button>
          </div>
        )}
      </div>

      <div className="field">
        <label htmlFor="tm-resume">Ce qu’il faut retenir</label>
        <textarea
          id="tm-resume"
          rows={4}
          value={c.resume}
          onChange={(e) => local({ resume: e.target.value })}
          onBlur={(e) => void window.jdr.trame.maj(c.id, { resume: e.target.value })}
        />
      </div>

      {nEntrees > 1 ? (
        <div className="field">
          <label>Pour y arriver ({nEntrees} flèches)</label>
          <div className="seg tm-seg">
            <button className={c.regle === 'et' ? 'on' : ''} onClick={() => poser({ regle: 'et' })}>
              Il les faut toutes
            </button>
            <button className={c.regle === 'ou' ? 'on' : ''} onClick={() => poser({ regle: 'ou' })}>
              Une seule suffit
            </button>
          </div>
        </div>
      ) : null}

      <div className="field">
        <label htmlFor="tm-moment">Moment de la chronologie</label>
        <select
          id="tm-moment"
          value={c.beatId ?? ''}
          onChange={(e) => poser({ beatId: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">—</option>
          {s.beats.map((b) => (
            <option key={b.id} value={b.id}>
              {b.atTime ? `${b.atTime} · ` : ''}
              {b.title}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="tm-lieu">Lieu</label>
        <select
          id="tm-lieu"
          value={c.placeId ?? ''}
          onChange={(e) => poser({ placeId: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">—</option>
          {s.places.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {pnjs.length ? (
        <div className="field">
          <label>PNJ</label>
          <div className="tm-puces">
            {pnjs.map((p) => {
              const on = c.pnjIds.includes(p.id)
              return (
                <button
                  key={p.id}
                  className={`chip${on ? ' on' : ''}`}
                  aria-pressed={on}
                  onClick={() =>
                    poser({ pnjIds: on ? c.pnjIds.filter((x) => x !== p.id) : [...c.pnjIds, p.id] })
                  }
                >
                  {p.name}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      <div className="tm-actions">
        <button className="btn btn-sm btn-danger" onClick={() => void supprimerChoix(choix, changer, onChoix)}>
          <IconTrash />
          Supprimer la carte
        </button>
      </div>

      {choixImage ? (
        <ChoixImage
          exclure={c.itemId != null ? [c.itemId] : []}
          titre="L’image de la carte"
          onClose={() => setChoixImage(false)}
          onPick={(it) => {
            /* Une image neuve repart du centre, et on la rogne aussitôt. */
            poser({ itemId: it.id, imageCadre: null })
            setChoixImage(false)
            setRogner(true)
          }}
        />
      ) : null}
      {rogner && img?.url ? (
        <RognageCarre
          titre="Rogner l’image de la carte"
          url={img.url}
          cadre={c.imageCadre}
          rapport={RAPPORT_IMAGE}
          onClose={() => setRogner(false)}
          onValider={(cadre) => {
            poser({ imageCadre: cadre })
            setRogner(false)
          }}
        />
      ) : null}
    </div>
  )
}

/* ============================================================
   Au Paravent : la trame par-dessus tout, pour cocher
   ============================================================ */

export function TrameEnJeu({ onClose }: { onClose: () => void }): JSX.Element {
  const [trame, changer, recharger] = useTrame()
  const [choix, setChoix] = useState<Choix>(null)

  useEchap(onClose)

  const faites = trame?.cartes.filter((c) => c.fait) ?? []
  const aPorteeMaintenant = trame?.cartes.filter((c) => !c.fait && aPortee(c, trame)) ?? []
  const total = trame?.cartes.length ?? 0

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal tm-jeu" onClick={(e) => e.stopPropagation()}>
        <header>
          <IconTrame />
          <h3>Arborescence de la séance</h3>
          <span className="tm-compte num">
            {faites.length} / {total} faites
          </span>
          <div className="spacer" />
          {faites.length ? (
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => {
                changer((t) => ({ ...t, cartes: t.cartes.map((c) => ({ ...c, fait: false })) }))
                void window.jdr.trame.toutDecocher()
              }}
            >
              Tout décocher
            </button>
          ) : null}
          <button className="btn btn-sm btn-ghost" onClick={onClose} aria-label="Fermer l’arborescence" title="Fermer · Échap">
            <IconClose />
          </button>
        </header>
        <div className="tm-jeu-corps">
          {trame ? (
            <PlanTrame
              mode="jeu"
              trame={trame}
              changer={changer}
              recharger={recharger}
              choix={choix}
              onChoix={setChoix}
            />
          ) : (
            <div className="tm-plan" />
          )}
          <aside className="tm-volet">
            <h3>Où en sont-ils</h3>
            <div className="tm-jauge">
              <div style={{ width: total ? `${(faites.length / total) * 100}%` : 0 }} />
            </div>
            <span className="eyebrow">À portée maintenant</span>
            <ListeCartes cartes={aPorteeMaintenant} vide="Plus rien : l’arborescence est bouclée." changer={changer} />
            <span className="eyebrow">Déjà faites</span>
            <ListeCartes cartes={faites} vide="Rien encore." changer={changer} />
          </aside>
        </div>
      </div>
    </div>
  )
}

/** Une liste de cartes à cocher d'un clic, hors du plan. */
function ListeCartes({
  cartes,
  vide,
  changer
}: {
  cartes: TrameCarte[]
  vide: string
  changer: (f: (t: Trame) => Trame) => void
}): JSX.Element {
  if (!cartes.length) return <p className="tm-aide">{vide}</p>
  return (
    <div className="tm-liste">
      {cartes.map((c) => (
        <button
          key={c.id}
          className={`tm-${c.type}${c.fait ? ' fait' : ''}`}
          title={c.fait ? 'Décocher' : 'Cocher : c’est fait'}
          onClick={() => {
            changer((t) => ({ ...t, cartes: t.cartes.map((x) => (x.id === c.id ? { ...x, fait: !c.fait } : x)) }))
            void window.jdr.trame.cocher(c.id, !c.fait)
          }}
        >
          <i />
          <span>{c.titre || 'Sans titre'}</span>
          <small>{NOMS_TYPE[c.type]}</small>
        </button>
      ))}
    </div>
  )
}

export type { Choix as ChoixTrame }
