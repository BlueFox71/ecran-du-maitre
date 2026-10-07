import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { create } from 'zustand'
import Mention from '@tiptap/extension-mention'
import type { Editor } from '@tiptap/core'
import type { SuggestionProps } from '@tiptap/suggestion'
import type { Character } from '@shared/types'
import { useStore } from '../store'
import { Pastille } from './Pastille'

/**
 * Le tag de personnage : « @ » dans l'éditeur ouvre la liste des personnages
 * à la table, et celui qu'on choisit s'écrit en gras, dans sa couleur.
 *
 * Le tag retient le personnage, pas son nom : s'il change de nom ou de
 * couleur, les documents suivent (voir `resynchroniserTags`). Le HTML garde
 * malgré tout le nom et la couleur en clair, pour l'écran des joueurs, qui
 * reçoit le texte tel quel — les classes `c-*` de slide.css font la teinte.
 *
 * Comme sur Messenger, un retour arrière juste après le tag lui retire le nom
 * de famille : « Lysandra Nocturne » devient « Lysandra », et reste un tag.
 * Le suivant l'efface, comme avant.
 */

/** Ce que le tag affiche : le nom entier, ou le seul prénom une fois raccourci. */
function texteDuTag(attrs: Record<string, any>): string {
  const nom: string = attrs.label ?? ''
  return attrs.court ? nom.trim().split(/\s+/)[0] : nom
}

/**
 * Retour arrière juste après un tag au nom entier — ou après l'espace que la
 * suggestion pose derrière lui : on le raccourcit au prénom au lieu de
 * l'effacer. Rend faux s'il n'y a rien à raccourcir, pour laisser faire.
 */
function raccourcir(editor: Editor): boolean {
  const { selection, doc } = editor.state
  if (!selection.empty) return false
  let fin = selection.from
  let tag = selection.$from.nodeBefore
  if (tag?.isText && tag.text === ' ') {
    fin -= 1
    tag = doc.resolve(fin).nodeBefore
  }
  if (!tag || tag.type.name !== 'pj' || tag.attrs.court) return false
  if (!/\s/.test((tag.attrs.label ?? '').trim())) return false
  editor.view.dispatch(
    editor.state.tr.setNodeMarkup(fin - tag.nodeSize, undefined, { ...tag.attrs, court: true })
  )
  return true
}

/** Les personnages qu'on peut nommer : les joueurs là ce soir. */
export function personnagesALaTable(characters: Character[]): Character[] {
  return characters.filter((c) => c.kind === 'pj' && c.present && !c.horsJeu)
}

/** Le tag posé d'un clic, depuis le volet « Tags » : au curseur, suivi d'une espace. */
export function insererTag(editor: Editor, c: Character): void {
  editor
    .chain()
    .focus()
    .insertContent([
      { type: 'pj', attrs: { id: String(c.id), label: c.name, couleur: c.color } },
      { type: 'text', text: ' ' }
    ])
    .run()
}

function personnagesActifs(query: string): Character[] {
  const q = sansAccents(query.trim())
  return personnagesALaTable(useStore.getState().characters)
    .filter(
      (c) => !q || sansAccents(c.name).includes(q) || sansAccents(c.player ?? '').includes(q)
    )
}

function sansAccents(t: string): string {
  return t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('fr-FR')
}

/* La liste ouverte vit hors de React : ce sont les rappels de la suggestion
   TipTap qui la remplissent, et le menu ne fait que la lire. */
interface EtatMenu {
  items: Character[]
  index: number
  rect: DOMRect | null
  choisir: ((c: Character) => void) | null
}
const useMenu = create<EtatMenu>(() => ({ items: [], index: 0, rect: null, choisir: null }))

function ouvrir(p: SuggestionProps<Character>, garderIndex: boolean): void {
  const index = garderIndex ? Math.min(useMenu.getState().index, Math.max(0, p.items.length - 1)) : 0
  useMenu.setState({
    items: p.items,
    index,
    rect: p.clientRect?.() ?? null,
    choisir: (c) => p.command({ id: String(c.id), label: c.name, couleur: c.color })
  })
}

export const TagPersonnage = Mention.extend({
  name: 'pj',
  addAttributes() {
    return {
      ...this.parent?.(),
      couleur: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-couleur'),
        renderHTML: (a: { couleur: string | null }) => (a.couleur ? { 'data-couleur': a.couleur } : {})
      },
      court: {
        default: false,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-court') === '1',
        renderHTML: (a: { court: boolean }) => (a.court ? { 'data-court': '1' } : {})
      }
    }
  },
  addKeyboardShortcuts() {
    const parent = this.parent?.() ?? {}
    return {
      ...parent,
      Backspace: (p) => raccourcir(this.editor) || (parent.Backspace?.(p) ?? false)
    }
  }
}).configure({
  renderText: ({ node }) => texteDuTag(node.attrs),
  renderHTML: ({ options, node }) => [
    'span',
    { ...options.HTMLAttributes, class: `pj-tag c-${node.attrs.couleur ?? 'neutral'}` },
    texteDuTag(node.attrs)
  ],
  suggestion: {
    char: '@',
    items: ({ query }) => personnagesActifs(query),
    render: () => ({
      onStart: (p) => ouvrir(p, false),
      onUpdate: (p) => ouvrir(p, true),
      onExit: () => useMenu.setState({ items: [], rect: null, choisir: null }),
      onKeyDown: ({ event }) => {
        const m = useMenu.getState()
        if (event.key === 'Escape') {
          useMenu.setState({ items: [], rect: null, choisir: null })
          return true
        }
        if (m.items.length === 0) return false
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          const pas = event.key === 'ArrowDown' ? 1 : -1
          useMenu.setState({ index: (m.index + pas + m.items.length) % m.items.length })
          return true
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          m.choisir?.(m.items[m.index])
          return true
        }
        return false
      }
    })
  }
})

/**
 * Remet chaque tag au nom et à la couleur du moment. Hors de l'historique :
 * ce n'est pas une frappe qu'on voudrait annuler.
 */
export function resynchroniserTags(editor: Editor, characters: Character[]): void {
  const tr = editor.state.tr
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'pj') return
    const c = characters.find((x) => String(x.id) === node.attrs.id)
    if (!c) return
    if (c.name === node.attrs.label && c.color === node.attrs.couleur) return
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, label: c.name, couleur: c.color })
  })
  if (tr.docChanged) editor.view.dispatch(tr.setMeta('addToHistory', false))
}

/** La liste qui s'ouvre sous le « @ ». */
export function MenuTagPersonnage(): JSX.Element | null {
  const { items, index, rect, choisir } = useMenu()
  const ref = useRef<HTMLUListElement>(null)

  useEffect(() => {
    ref.current?.children[index]?.scrollIntoView({ block: 'nearest' })
  }, [index])

  if (!rect || !choisir) return null
  return createPortal(
    <ul
      ref={ref}
      className="pj-menu"
      role="listbox"
      aria-label="Personnages"
      style={{
        left: Math.min(rect.left, window.innerWidth - 250),
        ...(rect.bottom + 260 > window.innerHeight
          ? { bottom: window.innerHeight - rect.top + 4 }
          : { top: rect.bottom + 4 })
      }}
    >
      {items.length === 0 ? (
        <li className="pj-menu-vide">Aucun personnage à la table</li>
      ) : (
        items.map((c, i) => (
          <li
            key={c.id}
            role="option"
            aria-selected={i === index}
            className={i === index ? 'on' : undefined}
            // mousedown, pas click : l'éditeur garderait sinon le focus perdu
            onMouseDown={(e) => {
              e.preventDefault()
              choisir(c)
            }}
            onMouseEnter={() => useMenu.setState({ index: i })}
          >
            <Pastille nom={c.name} couleur={c.color} />
            <b className={`c-${c.color ?? 'neutral'}`}>{c.name}</b>
            {c.player && <span className="pj-menu-joueur">{c.player}</span>}
          </li>
        ))
      )}
    </ul>,
    document.body
  )
}
