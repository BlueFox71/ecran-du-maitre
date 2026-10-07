import { useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { useStore } from '../store'
import { EXTENSIONS_TEXTE } from './extensionsTexte'
import { MenuTagPersonnage, resynchroniserTags } from './TagPersonnage'
import { insererIntervention, LIBELLE_INTERVENTION } from './Intervention'
import { MenuCommandesTexte } from './CommandesTexte'

/**
 * Le texte d'un moment, écrit là où on le lit : un clic dans la Chronologie et
 * la page devient modifiable sur place, sans quitter la séance des yeux. Le
 * gros de l'outillage (tableaux, diffusion, rattachements) reste à l'Éditeur,
 * à un bouton de là.
 *
 * Enregistrement au fil de la frappe, et une dernière fois en sortant — même
 * quand on passe à un autre moment sans avoir cliqué « Terminé ».
 */
export function TexteEnPlace({
  item,
  onFini,
  versEditeur
}: {
  item: { id: number; body: string | null }
  onFini: () => void
  versEditeur: () => void
}): JSX.Element {
  const s = useStore()
  const [etat, setEtat] = useState<'saved' | 'dirty' | 'saving'>('saved')
  /* Le dernier état du texte, gardé hors de l'éditeur : à la sortie, celui-ci
     est peut-être déjà détruit quand vient l'heure d'enregistrer. */
  const html = useRef<string | null>(null)
  const minuterie = useRef<number | null>(null)

  const ecrire = async (): Promise<void> => {
    if (minuterie.current) window.clearTimeout(minuterie.current)
    minuterie.current = null
    if (html.current === null) return
    const body = html.current
    html.current = null
    setEtat('saving')
    await window.jdr.items.update(item.id, { body })
    setEtat((e) => (e === 'saving' ? 'saved' : e))
  }

  const editor = useEditor({
    extensions: EXTENSIONS_TEXTE,
    content: item.body || '<p></p>',
    autofocus: 'end',
    onUpdate: ({ editor: ed }) => {
      html.current = ed.getHTML()
      setEtat('dirty')
      if (minuterie.current) window.clearTimeout(minuterie.current)
      minuterie.current = window.setTimeout(() => void ecrire(), 900)
    }
  })

  // Un personnage renommé ou recoloré : ses tags suivent.
  useEffect(() => {
    if (editor) resynchroniserTags(editor, s.characters)
  }, [editor, s.characters])

  // En sortant : ce qui n'est pas encore écrit l'est, et la Chronologie relit.
  useEffect(
    () => () => {
      void ecrire().then(async () => {
        const st = useStore.getState()
        /* Les annexes aussi : elles s'écrivent sur place, comme les moments. */
        await Promise.all([st.refreshLibrary(), st.refreshTimeline(), st.refreshAnnexes()])
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const bouton = (
    titre: string,
    actif: boolean | undefined,
    faire: () => void,
    contenu: string,
    style?: React.CSSProperties
  ): JSX.Element => (
    <button
      className={`tb txt${contenu.length > 3 ? ' large' : ''}`}
      title={titre}
      aria-label={titre}
      aria-pressed={actif ?? false}
      style={style}
      // mousedown : garder la sélection du texte pendant le clic
      onMouseDown={(e) => e.preventDefault()}
      onClick={faire}
    >
      {contenu}
    </button>
  )

  return (
    <div className="texte-en-place">
      <div className="toolbar tep-barre" role="toolbar" aria-label="Mise en forme">
        {bouton('Gras', editor?.isActive('bold'), () => editor?.chain().focus().toggleBold().run(), 'G', { fontWeight: 700 })}
        {bouton('Italique', editor?.isActive('italic'), () => editor?.chain().focus().toggleItalic().run(), 'I', { fontStyle: 'italic', fontFamily: "'Fraunces Variable', serif" })}
        {bouton('Souligné', editor?.isActive('underline'), () => editor?.chain().focus().toggleUnderline().run(), 'S', { textDecoration: 'underline' })}
        <span className="tb-sep" />
        {bouton('Titre', editor?.isActive('heading', { level: 3 }), () => editor?.chain().focus().toggleHeading({ level: 3 }).run(), 'T')}
        {bouton('Texte à lire', editor?.isActive('blockquote'), () => editor?.chain().focus().toggleBlockquote().run(), '« »')}
        {bouton('Liste à puces', editor?.isActive('bulletList'), () => editor?.chain().focus().toggleBulletList().run(), '•')}
        {bouton(
          'Liste de tâches — des cases à cocher',
          editor?.isActive('taskList'),
          () => editor?.chain().focus().toggleTaskList().run(),
          '☐'
        )}
        <span className="tb-sep" />
        {bouton(
          "Marquer l'endroit où la table doit prendre la main — invisible des joueurs",
          false,
          () => editor && insererIntervention(editor),
          LIBELLE_INTERVENTION
        )}
        <span className="spacer" />
        <span className="eyebrow">
          {etat === 'saved' ? 'Enregistré' : etat === 'saving' ? 'Enregistrement…' : 'Modifié'}
        </span>
        <button
          className="btn btn-ghost btn-sm"
          onClick={versEditeur}
          title="Ouvrir ce texte dans l'Éditeur, avec tous ses outils"
        >
          Éditeur complet
        </button>
        <button className="btn btn-brass btn-sm" onClick={onFini}>
          Terminé
        </button>
      </div>
      <div className="read-body">
        <EditorContent editor={editor} />
      </div>
      <MenuTagPersonnage />
      <MenuCommandesTexte />
    </div>
  )
}
