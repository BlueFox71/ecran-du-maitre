import { createElement, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import { basculer, couvre, placer, type Cible, type Plage } from '@shared/surlignage'
import { useEchap } from './echap'
import { IconSurligneur } from './components/Icons'

/**
 * Le surligneur du Paravent : un feutre pour marquer « fait » ce qu'on lit.
 *
 * Rien n'est écrit dans les textes ni dans la page : les passages sont peints
 * par-dessus, par la CSS Custom Highlight API (`::highlight(surligne)`). Le
 * HTML d'un document reste celui de l'Éditeur, React garde la main sur son
 * DOM, et rien ne peut partir vers l'écran des joueurs.
 *
 * Les plages sont tenues par cible — le texte propriétaire —, dans un seul
 * store : un document lu à deux endroits se met à jour aux deux.
 */

interface Surligneur {
  /** Le mode feutre : chaque glissé surligne, ou dé-surligne. */
  actif: boolean
  plages: Record<Cible, Plage[]>
  basculerMode(on?: boolean): void
  charger(): Promise<void>
}

export const useSurligneur = create<Surligneur>((set, get) => ({
  actif: false,
  plages: {},
  basculerMode: (on) => set({ actif: on ?? !get().actif }),
  charger: async () => set({ plages: await window.jdr.surlignage.liste() })
}))

/* ---------- la peinture ---------- */

/** Les textes surlignables à l'écran, et le texte qu'ils portent. */
const inscrits = new Map<HTMLElement, Cible>()
let prevu = 0
/* Le Paravent est là : hors de lui, rien ne se peint. */
let monte = false

/** Les nœuds texte d'un élément, dans l'ordre de lecture. */
function noeudsTexte(el: HTMLElement): Text[] {
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  const r: Text[] = []
  while (w.nextNode()) r.push(w.currentNode as Text)
  return r
}

/** Un passage [debut, fin[ du texte brut de `el`, en Range du DOM. */
function rangeDe(el: HTMLElement, debut: number, fin: number): Range | null {
  const r = document.createRange()
  let vu = 0
  let pose = false
  for (const n of noeudsTexte(el)) {
    const l = n.data.length
    if (!pose && debut < vu + l) {
      r.setStart(n, debut - vu)
      pose = true
    }
    if (pose && fin <= vu + l) {
      r.setEnd(n, fin - vu)
      return r
    }
    vu += l
  }
  return null
}

/** Le décalage, dans le texte brut de `el`, d'un point du DOM. */
function decalage(el: HTMLElement, noeud: Node, offset: number): number {
  const r = document.createRange()
  r.selectNodeContents(el)
  r.setEnd(noeud, offset)
  return r.toString().length
}

function peindre(): void {
  prevu = 0
  if (!('highlights' in CSS) || !monte) return
  const { plages } = useSurligneur.getState()
  const h = new Highlight()
  for (const [el, c] of inscrits) {
    const ps = plages[c]
    if (!ps?.length || !el.isConnected) continue
    for (const p of placer(ps, el.textContent ?? '')) {
      const r = rangeDe(el, p.debut, p.fin)
      if (r) h.add(r)
    }
  }
  CSS.highlights.set('surligne', h)
}

const repeindre = (): void => {
  if (!prevu) prevu = requestAnimationFrame(peindre)
}

useSurligneur.subscribe((s, avant) => {
  if (s.plages !== avant.plages) repeindre()
  if (s.actif !== avant.actif) document.body.classList.toggle('surligneur-actif', s.actif)
})

/* ---------- le glissé ---------- */

/**
 * Un texte replié par `TexteCourt` garde tout son DOM, seules ses premières
 * lignes se voient : un glissé qui le dépasse ne marque que ce qu'on a lu. On
 * rend le décalage du dernier caractère visible, ou null s'il n'est pas replié.
 */
function finVisible(el: HTMLElement): number | null {
  const replie = el.closest<HTMLElement>('.replie')
  if (!replie || replie.scrollHeight <= replie.clientHeight + 1) return null
  const b = replie.getBoundingClientRect()
  const pos = document.caretRangeFromPoint(b.right - 1, b.bottom - 2)
  if (!pos || !el.contains(pos.startContainer)) return null
  return decalage(el, pos.startContainer, pos.startOffset)
}

/**
 * Un glissé terminé : chaque texte qu'il touche bascule sur sa portion. Le
 * premier décide du sens — surligner ou effacer —, les suivants le suivent,
 * et le tout part en un seul envoi : un seul pas de Ctrl+Z.
 */
function glisse(): boolean {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || !sel.rangeCount) return false
  const r = sel.getRangeAt(0)
  const touches = [...inscrits]
    .filter(([el]) => el.isConnected && r.intersectsNode(el))
    .sort(([a], [b]) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))

  const { plages } = useSurligneur.getState()
  const portions: { el: HTMLElement; c: Cible; texte: string; debut: number; fin: number; avant: Plage[] }[] = []
  for (const [el, c] of touches) {
    if (portions.some((x) => x.c === c)) continue
    const texte = el.textContent ?? ''
    const tout = document.createRange()
    tout.selectNodeContents(el)
    const debut =
      r.compareBoundaryPoints(Range.START_TO_START, tout) > 0 ? decalage(el, r.startContainer, r.startOffset) : 0
    let fin = r.compareBoundaryPoints(Range.END_TO_END, tout) < 0 ? decalage(el, r.endContainer, r.endOffset) : texte.length
    fin = Math.min(fin, finVisible(el) ?? fin)
    if (fin <= debut) continue
    /* Le texte a pu être réécrit depuis : on repart de là où on montre les passages. */
    const avant = placer(plages[c] ?? [], texte).map((p) => ({ ...p, cite: texte.slice(p.debut, p.fin) }))
    portions.push({ el, c, texte, debut, fin, avant })
  }
  if (!portions.length) return false

  /* Le sens se décide là où le geste a commencé — l'ancre de la sélection —,
     pas au début du passage : un glissé fait à rebours part de sa fin. */
  const depart = portions.find((x) => sel.anchorNode && x.el.contains(sel.anchorNode))
  const effacer = depart
    ? couvre(depart.avant, decalage(depart.el, sel.anchorNode!, sel.anchorOffset))
    : couvre(portions[0].avant, portions[0].debut)
  const changes = portions.map((x) => ({
    cible: x.c,
    plages: basculer(x.avant, x.debut, x.fin, x.texte, effacer)
  }))

  const suite = { ...plages }
  for (const x of changes) suite[x.cible] = x.plages
  useSurligneur.setState({ plages: suite })
  void window.jdr.surlignage.remplacer(changes)
  sel.removeAllRanges()
  return true
}

/**
 * Monté une fois par le Paravent : charge les surlignages, les relit après un
 * Ctrl+Z, écoute le feutre — H pour le prendre, Échap pour le poser — et le
 * repose en quittant le Paravent.
 */
export function Surligneur(): null {
  const actif = useSurligneur((s) => s.actif)
  useEchap(() => useSurligneur.getState().basculerMode(false), actif)

  useEffect(() => {
    monte = true
    void useSurligneur.getState().charger()
    const relire = (): void => void useSurligneur.getState().charger()
    window.addEventListener('jdr:defait', relire)

    const touche = (e: KeyboardEvent): void => {
      const t = e.target
      const champ =
        t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))
      if (champ || e.ctrlKey || e.metaKey || e.altKey || e.key.toLowerCase() !== 'h') return
      e.preventDefault()
      useSurligneur.getState().basculerMode()
    }
    /* Un glissé surligne ; le clic qui le termine n'a pas à cocher la case ou
       à replier l'article sur lequel on a lâché. Un clic simple, lui, garde
       son effet. */
    /* Seul compte un geste commencé dans un texte surlignable, feutre en main :
       une sélection laissée d'avant ne se surligne pas au premier clic venu. */
    let geste = false
    const appuie = (e: MouseEvent): void => {
      geste =
        useSurligneur.getState().actif && e.target instanceof Element && !!e.target.closest('[data-cible]')
    }
    const lache = (): void => {
      const parti = geste
      geste = false
      if (!parti || !useSurligneur.getState().actif || !glisse()) return
      const avale = (e: MouseEvent): void => {
        e.stopPropagation()
        e.preventDefault()
      }
      window.addEventListener('click', avale, { capture: true, once: true })
      setTimeout(() => window.removeEventListener('click', avale, { capture: true }), 0)
    }
    window.addEventListener('keydown', touche)
    document.addEventListener('mousedown', appuie, true)
    document.addEventListener('mouseup', lache)
    return () => {
      document.removeEventListener('mousedown', appuie, true)
      window.removeEventListener('jdr:defait', relire)
      window.removeEventListener('keydown', touche)
      document.removeEventListener('mouseup', lache)
      monte = false
      useSurligneur.getState().basculerMode(false)
      if ('highlights' in CSS) CSS.highlights.delete('surligne')
    }
  }, [])
  return null
}

/* ---------- les pièces qu'on pose ---------- */

/**
 * Un texte qu'on peut surligner. Avec `html`, il rend ce HTML tel quel (le
 * corps d'un document) ; sinon ses enfants. `data-cible` dit à qui il est.
 */
export function Surlignable({
  cible,
  as = 'div',
  className,
  html,
  children
}: {
  cible: Cible
  as?: 'div' | 'span' | 'dd' | 'p' | 'h3' | 'h4'
  className?: string
  html?: string
  children?: React.ReactNode
}): JSX.Element {
  const ref = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    inscrits.set(el, cible)
    repeindre()
    /* Texte relu, texte déplié (TexteCourt) : on repeint. */
    const obs = new MutationObserver(repeindre)
    obs.observe(el, { subtree: true, childList: true, characterData: true })
    return () => {
      obs.disconnect()
      inscrits.delete(el)
      repeindre()
    }
  }, [cible])
  useLayoutEffect(repeindre)
  return createElement(
    as,
    {
      ref,
      className,
      'data-cible': cible,
      ...(html !== undefined ? { dangerouslySetInnerHTML: { __html: html } } : {})
    },
    html !== undefined ? undefined : children
  )
}

/** Le feutre, à poser dans l'en-tête de ce qu'on lit. */
export function BoutonSurligneur(): JSX.Element {
  const actif = useSurligneur((s) => s.actif)
  return (
    <button
      className={`btn btn-sm${actif ? ' btn-on' : ''}`}
      onClick={() => useSurligneur.getState().basculerMode()}
      aria-pressed={actif}
      title={actif ? 'Poser le surligneur (H ou Échap)' : 'Surligneur (H) : glisser pour marquer ce qui est fait'}
    >
      <IconSurligneur />
      Surligneur
    </button>
  )
}

/**
 * « Effacer le surlignage » de tout ce qui est surlignable sous `conteneur`
 * — ou des `cibles` nommées, pour un texte seul. Il ne se montre que s'il y a
 * quelque chose à effacer.
 */
export function EffacerSurlignage({
  conteneur,
  cibles: nommees
}: {
  conteneur?: React.RefObject<HTMLElement>
  cibles?: Cible[]
}): JSX.Element | null {
  const plages = useSurligneur((s) => s.plages)
  const [vues, setCibles] = useState<Cible[]>([])
  const cibles = nommees ?? vues
  useEffect(() => {
    const el = conteneur?.current
    if (!el) return
    const lire = (): void => {
      const vues = [...new Set([...el.querySelectorAll<HTMLElement>('[data-cible]')].map((x) => x.dataset.cible!))]
      setCibles((avant) => (avant.join('|') === vues.join('|') ? avant : vues))
    }
    lire()
    const obs = new MutationObserver(lire)
    obs.observe(el, { subtree: true, childList: true })
    return () => obs.disconnect()
  }, [conteneur])

  const aEffacer = cibles.filter((c) => plages[c]?.length)
  if (!aEffacer.length) return null
  return (
    <button
      className="btn btn-ghost btn-sm"
      onClick={() => {
        const suite = { ...useSurligneur.getState().plages }
        for (const c of aEffacer) delete suite[c]
        useSurligneur.setState({ plages: suite })
        void window.jdr.surlignage.effacer(aEffacer)
      }}
      title="Retirer tout le surlignage de ce document (Ctrl+Z pour le rendre)"
    >
      Effacer le surlignage
    </button>
  )
}
