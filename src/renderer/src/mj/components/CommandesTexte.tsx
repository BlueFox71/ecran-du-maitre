import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { create } from 'zustand'
import { Extension } from '@tiptap/core'
import type { Editor, Range } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import Suggestion, { type SuggestionProps } from '@tiptap/suggestion'
import { LIBELLE_INTERVENTION } from './Intervention'

/**
 * « / » dans un texte : la liste des genres de paragraphe — titres, corps,
 * texte à lire, listes — et ce qu'on pose d'un geste. On tape pour filtrer
 * (« /ti » ne garde que les titres), ↑↓ et Entrée pour choisir, comme au « @ ».
 * Le « / » et ce qu'on a tapé derrière disparaissent au choix.
 */
interface Commande {
  cle: string
  libelle: string
  aide: string
  /** Une lettre ou un signe, pour reconnaître la ligne d'un coup d'œil. */
  signe: string
  faire: (editor: Editor, range: Range) => void
}

const COMMANDES: Commande[] = [
  {
    cle: 'corps',
    libelle: 'Corps de texte',
    aide: 'Un paragraphe ordinaire',
    signe: '¶',
    faire: (e, r) => e.chain().focus().deleteRange(r).setParagraph().run()
  },
  {
    cle: 'titre1',
    libelle: 'Titre 1',
    aide: 'Grand titre',
    signe: 'T1',
    faire: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 1 }).run()
  },
  {
    cle: 'titre2',
    libelle: 'Titre 2',
    aide: 'Titre de partie',
    signe: 'T2',
    faire: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 2 }).run()
  },
  {
    cle: 'titre3',
    libelle: 'Titre 3',
    aide: 'Petit titre',
    signe: 'T3',
    faire: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 3 }).run()
  },
  {
    cle: 'lire',
    libelle: 'Texte à lire',
    aide: 'Ce que tu lis à voix haute',
    signe: '« »',
    faire: (e, r) => {
      e.chain().focus().deleteRange(r).setParagraph().run()
      if (!e.isActive('blockquote')) e.chain().focus().toggleBlockquote().run()
    }
  },
  {
    cle: 'puces',
    libelle: 'Liste à puces',
    aide: 'Une liste sans ordre',
    signe: '•',
    faire: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run()
  },
  {
    cle: 'numeros',
    libelle: 'Liste numérotée',
    aide: 'Une liste dans l’ordre',
    signe: '1.',
    faire: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run()
  },
  {
    cle: 'taches',
    libelle: 'Liste de tâches',
    aide: 'Des cases à cocher, pour les TODO',
    signe: '☐',
    faire: (e, r) => e.chain().focus().deleteRange(r).toggleTaskList().run()
  },
  {
    cle: 'intervention',
    libelle: LIBELLE_INTERVENTION,
    aide: 'Là où la table prend la main',
    signe: '!',
    faire: (e, r) => {
      e.chain().focus().deleteRange(r).insertContent({ type: 'intervention' }).run()
      if (e.state.doc.lastChild?.type.name === 'intervention')
        e.chain().insertContentAt(e.state.doc.content.size, { type: 'paragraph' }).focus('end').run()
    }
  },
  {
    cle: 'separateur',
    libelle: 'Séparateur',
    aide: 'Un trait entre deux parties',
    signe: '—',
    faire: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run()
  }
]

function sansAccents(t: string): string {
  return t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('fr-FR')
}

/* Comme pour les tags : la liste ouverte vit hors de React, la suggestion
   TipTap la remplit et le menu la lit. */
interface EtatMenu {
  items: Commande[]
  index: number
  rect: DOMRect | null
  choisir: ((c: Commande) => void) | null
}
const useMenu = create<EtatMenu>(() => ({ items: [], index: 0, rect: null, choisir: null }))
const fermer = (): void => useMenu.setState({ items: [], rect: null, choisir: null })

function ouvrir(p: SuggestionProps<Commande>, garderIndex: boolean): void {
  const index = garderIndex ? Math.min(useMenu.getState().index, Math.max(0, p.items.length - 1)) : 0
  useMenu.setState({ items: p.items, index, rect: p.clientRect?.() ?? null, choisir: (c) => p.command(c) })
}

export const CommandesTexte = Extension.create({
  name: 'commandesTexte',
  addProseMirrorPlugins() {
    return [
      Suggestion<Commande>({
        editor: this.editor,
        char: '/',
        pluginKey: new PluginKey('commandesTexte'),
        items: ({ query }) => {
          const q = sansAccents(query.trim())
          return COMMANDES.filter((c) => !q || sansAccents(c.libelle).includes(q))
        },
        command: ({ editor, range, props }) => props.faire(editor, range),
        render: () => ({
          onStart: (p) => ouvrir(p, false),
          onUpdate: (p) => ouvrir(p, true),
          onExit: fermer,
          onKeyDown: ({ event }) => {
            const m = useMenu.getState()
            if (event.key === 'Escape') {
              fermer()
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
      })
    ]
  }
})

/** La liste qui s'ouvre sous le « / ». */
export function MenuCommandesTexte(): JSX.Element | null {
  const { items, index, rect, choisir } = useMenu()
  const ref = useRef<HTMLUListElement>(null)

  useEffect(() => {
    ref.current?.children[index]?.scrollIntoView({ block: 'nearest' })
  }, [index])

  // Rien ne correspond : pas de liste, le « / » reste un simple caractère.
  if (!rect || !choisir || items.length === 0) return null
  return createPortal(
    <ul
      ref={ref}
      className="cmd-menu"
      role="listbox"
      aria-label="Type de texte"
      style={{
        left: Math.min(rect.left, window.innerWidth - 270),
        ...(rect.bottom + 330 > window.innerHeight
          ? { bottom: window.innerHeight - rect.top + 4 }
          : { top: rect.bottom + 4 })
      }}
    >
      {items.map((c, i) => (
        <li
          key={c.cle}
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
          <span className="cmd-signe">{c.signe}</span>
          <span className="cmd-texte">
            <b>{c.libelle}</b>
            <span>{c.aide}</span>
          </span>
        </li>
      ))}
    </ul>,
    document.body
  )
}
