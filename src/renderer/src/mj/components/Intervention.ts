import { Node } from '@tiptap/core'
import type { Editor } from '@tiptap/core'

/**
 * « Intervention des joueurs » : un repère pour le MJ, posé dans le texte là où
 * la table doit prendre la main — une question, un choix, un jet. Une ligne
 * entière sur fond de couleur, qu'on ne réécrit pas : on la pose, on l'efface.
 *
 * C'est une indication de jeu, pas du texte à montrer : slide.css la cache
 * sur l'écran des joueurs, app.css l'affiche dans l'Éditeur et le Pupitre.
 */
export const LIBELLE_INTERVENTION = 'Intervention des joueurs'

export const Intervention = Node.create({
  name: 'intervention',
  group: 'block',
  atom: true,
  selectable: true,
  parseHTML() {
    return [{ tag: 'div[data-type="intervention"]' }]
  },
  renderHTML() {
    return ['div', { 'data-type': 'intervention', class: 'intervention' }, LIBELLE_INTERVENTION]
  },
  renderText() {
    return LIBELLE_INTERVENTION
  }
})

/** La pose à l'endroit du curseur, et laisse toujours une ligne où écrire après. */
export function insererIntervention(editor: Editor): void {
  editor.chain().focus().insertContent({ type: 'intervention' }).run()
  const doc = editor.state.doc
  if (doc.lastChild?.type.name === 'intervention')
    editor.chain().insertContentAt(doc.content.size, { type: 'paragraph' }).focus('end').run()
}
