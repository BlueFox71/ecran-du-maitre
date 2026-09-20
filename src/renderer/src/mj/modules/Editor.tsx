import { useCallback, useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import Placeholder from '@tiptap/extension-placeholder'
import { DOMSerializer } from '@tiptap/pm/model'
import { useStore } from '../store'
import { IconPlus, IconScreen, IconTrash } from '../components/Icons'

const EXTENSIONS = [
  StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
  Underline,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Table.configure({ resizable: true }),
  TableRow,
  TableHeader,
  TableCell,
  Placeholder.configure({ placeholder: 'Écris ta scène…' })
]

export function Editor(): JSX.Element {
  const s = useStore()
  const docs = s.allItems.filter((i) => i.kind === 'doc')
  const current = docs.find((d) => d.id === s.editingItemId) ?? docs[0] ?? null

  const [title, setTitle] = useState(current?.title ?? '')
  const [saved, setSaved] = useState<'saved' | 'dirty' | 'saving'>('saved')
  const saveTimer = useRef<number | null>(null)
  const loadedFor = useRef<number | null>(null)

  const editor = useEditor({
    extensions: EXTENSIONS,
    content: current?.body ?? '<p></p>',
    onUpdate: () => scheduleSave()
  })

  /* Changement de document : on recharge le contenu sans perdre l'instance. */
  useEffect(() => {
    if (!editor || !current) return
    if (loadedFor.current === current.id) return
    loadedFor.current = current.id
    setTitle(current.title)
    editor.commands.setContent(current.body ?? '<p></p>', false)
    setSaved('saved')
  }, [editor, current])

  const doSave = useCallback(async () => {
    if (!editor || !current) return
    setSaved('saving')
    await window.jdr.items.update(current.id, { title: title.trim() || 'Sans titre', body: editor.getHTML() })
    await s.refreshLibrary()
    setSaved('saved')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, current, title])

  const scheduleSave = useCallback(() => {
    setSaved('dirty')
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => void doSave(), 900)
  }, [doSave])

  // Enregistrement de sûreté quand on quitte le module.
  useEffect(() => {
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
  }, [])

  // Ctrl+S : enregistrement immédiat.
  useEffect(() => {
    const h = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (saveTimer.current) window.clearTimeout(saveTimer.current)
        void doSave()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [doSave])

  const newDoc = async (): Promise<void> => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    await doSave()
    // Un document neuf est un vrai fichier .html, posé à côté du document
    // courant — ou à la racine de la campagne s'il n'y en a pas.
    const here = current?.relPath?.includes('/')
      ? current.relPath.slice(0, current.relPath.lastIndexOf('/'))
      : ''
    const it = await window.jdr.items.createDoc(here, 'Nouveau document')
    await s.refreshLibrary()
    if (it) s.openInEditor(it.id)
  }

  if (docs.length === 0 || !current) {
    return (
      <section className="view">
        <div className="vhead">
          <div>
            <h2>Éditeur</h2>
            <p>Rédige tes scènes, tes PNJ, tes tables de jets. Enregistrement automatique.</p>
          </div>
          <div className="spacer" />
          <button className="btn btn-brass" onClick={() => void newDoc()}>
            <IconPlus />
            Nouveau document
          </button>
        </div>
        <div className="empty">
          <b>Aucun document</b>
          Crée-en un : il ira dans la bibliothèque et pourra être diffusé aux joueurs.
        </div>
      </section>
    )
  }

  const chapterTitle = s.chapters.find((c) => c.id === current.chapterId)?.title
  const placeName = s.places.find((p) => p.id === current.placeId)?.name

  return (
    <section className="view">
      <div className="vhead">
        <div>
          <h2>Éditeur</h2>
          <p>Sélectionne un passage puis « Diffuser la sélection » pour l’envoyer aux joueurs.</p>
        </div>
        <div className="spacer" />
        <select
          className="out-pick"
          value={current.id}
          onChange={(e) => s.openInEditor(Number(e.target.value))}
          aria-label="Document ouvert"
        >
          {docs.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </select>
        <button className="btn btn-ghost btn-sm" onClick={() => void newDoc()}>
          <IconPlus />
          Nouveau
        </button>
        <span className="eyebrow">
          {saved === 'saved' ? 'Enregistré' : saved === 'saving' ? 'Enregistrement…' : 'Modifié'}
        </span>
      </div>

      <div className="editor-wrap">
        <div className="card ed-card">
          <div className="toolbar" role="toolbar" aria-label="Mise en forme">
            <select
              className="tb-select"
              value={blockValue(editor)}
              onChange={(e) => {
                const v = e.target.value
                if (!editor) return
                if (v === 'p') editor.chain().focus().setParagraph().run()
                else if (v === 'quote') editor.chain().focus().toggleBlockquote().run()
                else editor.chain().focus().toggleHeading({ level: Number(v[1]) as 1 | 2 | 3 }).run()
              }}
              aria-label="Style de paragraphe"
            >
              <option value="p">Corps de texte</option>
              <option value="h1">Titre 1</option>
              <option value="h2">Titre 2</option>
              <option value="h3">Titre 3</option>
              <option value="quote">Texte à lire</option>
            </select>

            <span className="tb-sep" />
            <Tb
              label="G"
              title="Gras"
              cls="txt"
              style={{ fontWeight: 700 }}
              active={editor?.isActive('bold')}
              onClick={() => editor?.chain().focus().toggleBold().run()}
            />
            <Tb
              label="I"
              title="Italique"
              cls="txt"
              style={{ fontStyle: 'italic', fontFamily: "'Fraunces Variable', serif" }}
              active={editor?.isActive('italic')}
              onClick={() => editor?.chain().focus().toggleItalic().run()}
            />
            <Tb
              label="S"
              title="Souligné"
              cls="txt"
              style={{ textDecoration: 'underline' }}
              active={editor?.isActive('underline')}
              onClick={() => editor?.chain().focus().toggleUnderline().run()}
            />
            <Tb
              label="B"
              title="Barré"
              cls="txt"
              style={{ textDecoration: 'line-through' }}
              active={editor?.isActive('strike')}
              onClick={() => editor?.chain().focus().toggleStrike().run()}
            />

            <span className="tb-sep" />
            <Tb
              title="Liste à puces"
              active={editor?.isActive('bulletList')}
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
              icon={
                <>
                  <path d="M9 7h11M9 12h11M9 17h11" />
                  <circle cx="5" cy="7" r="1.3" fill="currentColor" />
                  <circle cx="5" cy="12" r="1.3" fill="currentColor" />
                  <circle cx="5" cy="17" r="1.3" fill="currentColor" />
                </>
              }
            />
            <Tb
              title="Liste numérotée"
              active={editor?.isActive('orderedList')}
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              icon={<path d="M9 7h11M9 12h11M9 17h11M4 6l1.4-.7V9M3.6 12h2.2l-2.2 3h2.4" />}
            />
            <Tb
              title="Bloc de code"
              active={editor?.isActive('codeBlock')}
              onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
              icon={<path d="M9 8l-4 4 4 4M15 8l4 4-4 4" />}
            />

            <span className="tb-sep" />
            <Tb
              title="Aligner à gauche"
              active={editor?.isActive({ textAlign: 'left' })}
              onClick={() => editor?.chain().focus().setTextAlign('left').run()}
              icon={<path d="M4 6h16M4 11h10M4 16h13" />}
            />
            <Tb
              title="Centrer"
              active={editor?.isActive({ textAlign: 'center' })}
              onClick={() => editor?.chain().focus().setTextAlign('center').run()}
              icon={<path d="M4 6h16M7 11h10M6 16h12" />}
            />

            <span className="tb-sep" />
            <Tb
              title="Insérer un tableau"
              onClick={() =>
                editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
              }
              icon={
                <>
                  <rect x="3.5" y="5" width="17" height="14" rx="1" />
                  <path d="M3.5 10h17M3.5 15h17M9.5 5v14" />
                </>
              }
            />
            <Tb
              title="Ajouter une ligne"
              onClick={() => editor?.chain().focus().addRowAfter().run()}
              icon={<path d="M4 8h16M4 14h16M12 17v4M10 19h4" />}
            />
            <Tb
              title="Supprimer le tableau"
              onClick={() => editor?.chain().focus().deleteTable().run()}
              icon={<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />}
            />
            <Tb
              title="Séparateur"
              onClick={() => editor?.chain().focus().setHorizontalRule().run()}
              icon={<path d="M4 12h16" />}
            />

            <span className="tb-sep" />
            <Tb
              title="Annuler"
              onClick={() => editor?.chain().focus().undo().run()}
              icon={
                <>
                  <path d="M4 9h10a5 5 0 0 1 0 10H9" />
                  <path d="M8 5L4 9l4 4" />
                </>
              }
            />
            <Tb
              title="Rétablir"
              onClick={() => editor?.chain().focus().redo().run()}
              icon={
                <>
                  <path d="M20 9H10a5 5 0 0 0 0 10h5" />
                  <path d="M16 5l4 4-4 4" />
                </>
              }
            />
          </div>

          <div className="doc-scroll">
            <div className="doc-pad">
              <input
                className="doc-title-input"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  scheduleSave()
                }}
                placeholder="Titre du document"
                aria-label="Titre du document"
              />
              <div className="doc-sub">
                {[chapterTitle, placeName].filter(Boolean).join(' · ') || 'non rattaché'}
              </div>
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>

        <aside className="props">
          <div className="card prop-block">
            <h4>Rattachements</h4>
            <div className="field">
              <label htmlFor="ed-chap">Chapitre</label>
              <select
                id="ed-chap"
                value={current.chapterId ?? ''}
                onChange={async (e) => {
                  await window.jdr.items.update(current.id, {
                    chapterId: e.target.value === '' ? null : Number(e.target.value)
                  })
                  await s.refreshLibrary()
                }}
              >
                <option value="">— aucun —</option>
                {s.chapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="ed-place">Lieu</label>
              <select
                id="ed-place"
                value={current.placeId ?? ''}
                onChange={async (e) => {
                  await window.jdr.items.update(current.id, {
                    placeId: e.target.value === '' ? null : Number(e.target.value)
                  })
                  await s.refreshLibrary()
                }}
              >
                <option value="">— aucun —</option>
                {s.places.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="ed-folder">Dossier</label>
              <select
                id="ed-folder"
                value={current.folderId ?? ''}
                onChange={async (e) => {
                  await window.jdr.items.update(current.id, {
                    folderId: e.target.value === '' ? null : Number(e.target.value)
                  })
                  await s.refreshLibrary()
                }}
              >
                <option value="">— hors dossier —</option>
                {flatFolders(s.tree).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="card prop-block">
            <h4>Diffusion</h4>
            <button
              className="btn btn-brass btn-sm btn-c"
              onClick={async () => {
                const html = selectionHtml(editor)
                if (!html) {
                  s.toast('Sélectionne d’abord un passage', true)
                  return
                }
                await window.jdr.display.show({
                  type: 'text',
                  title: current.title,
                  html,
                  kicker: chapterTitle ?? current.title
                })
                s.toast('Passage diffusé aux joueurs')
              }}
            >
              <IconScreen />
              Diffuser la sélection
            </button>
            <button
              className="btn btn-sm btn-c"
              onClick={async () => {
                if (saveTimer.current) window.clearTimeout(saveTimer.current)
                await doSave()
                await window.jdr.display.showItem(current.id)
                s.toast('Document entier diffusé')
              }}
            >
              Diffuser tout le document
            </button>
          </div>

          <div className="card prop-block">
            <h4>Document</h4>
            <button
              className="btn btn-sm btn-c btn-danger"
              onClick={async () => {
                if (!confirm(`Envoyer « ${current.title} » à la corbeille ?`)) return
                if (saveTimer.current) window.clearTimeout(saveTimer.current)
                if (current.relPath) await window.jdr.items.trash(current.relPath)
                loadedFor.current = null
                useStore.setState({ editingItemId: null })
                await s.refreshLibrary()
                s.toast('Document envoyé à la corbeille')
              }}
            >
              <IconTrash />
              Envoyer à la corbeille
            </button>
          </div>
        </aside>
      </div>
    </section>
  )
}

/* ---------------- petits composants ---------------- */

function Tb({
  title,
  label,
  icon,
  cls,
  style,
  active,
  onClick
}: {
  title: string
  label?: string
  icon?: JSX.Element
  cls?: string
  style?: React.CSSProperties
  active?: boolean
  onClick: () => void
}): JSX.Element {
  return (
    <button
      className={`tb${cls ? ` ${cls}` : ''}`}
      title={title}
      aria-label={title}
      aria-pressed={active ?? false}
      style={style}
      onClick={onClick}
    >
      {label ?? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          {icon}
        </svg>
      )}
    </button>
  )
}

function blockValue(editor: ReturnType<typeof useEditor>): string {
  if (!editor) return 'p'
  if (editor.isActive('blockquote')) return 'quote'
  for (const l of [1, 2, 3]) if (editor.isActive('heading', { level: l })) return `h${l}`
  return 'p'
}

/** HTML de la sélection courante, pour la diffuser telle quelle. */
function selectionHtml(editor: ReturnType<typeof useEditor>): string | null {
  if (!editor) return null
  const { from, to, empty } = editor.state.selection
  if (empty) return null

  const slice = editor.state.doc.slice(from, to)
  const fragment = DOMSerializer.fromSchema(editor.schema).serializeFragment(slice.content)
  const div = document.createElement('div')
  div.appendChild(fragment)

  const html = div.innerHTML.trim()
  return html.length > 0 ? html : null
}

function flatFolders(
  tree: { id: number; name: string; children: any[] }[],
  depth = 0
): { id: number; label: string }[] {
  const out: { id: number; label: string }[] = []
  for (const f of tree) {
    out.push({ id: f.id, label: `${'  '.repeat(depth)}${f.name}` })
    out.push(...flatFolders(f.children, depth + 1))
  }
  return out
}
