import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { TagPersonnage } from './TagPersonnage'
import { Intervention } from './Intervention'
import { CommandesTexte } from './CommandesTexte'

/**
 * Ce que sait un texte de la campagne. L'Éditeur et l'édition sur place de la
 * Chronologie partagent la même liste : un texte écrit d'un côté se relit à
 * l'identique de l'autre — tableaux, tags et interventions compris.
 */
export const EXTENSIONS_TEXTE = [
  StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
  Underline,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Table.configure({ resizable: true }),
  TableRow,
  TableHeader,
  TableCell,
  // les cases à cocher — les TODO du Bloc-notes, et partout ailleurs
  TaskList,
  TaskItem.configure({ nested: true }),
  // une note du Bloc-notes n'est pas une scène : elle attend autre chose
  Placeholder.configure({
    placeholder: ({ editor }) =>
      editor.view.dom.closest('.bn-note') ? 'Une note, un TODO…' : 'Écris ta scène…'
  }),
  TagPersonnage,
  Intervention,
  CommandesTexte
]
