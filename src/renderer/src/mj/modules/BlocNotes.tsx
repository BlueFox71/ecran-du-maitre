import { useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import type { UiFolder, UiItem } from '../../../../preload/index'
import { useStore } from '../store'
import { EXTENSIONS_TEXTE } from '../components/extensionsTexte'
import { MenuTagPersonnage, resynchroniserTags } from '../components/TagPersonnage'
import { MenuCommandesTexte } from '../components/CommandesTexte'
import { IconPlus, IconTrash } from '../components/Icons'

/* ============================================================
   Bloc-notes : ce qu'on se note en écrivant la séance — les TODO,
   les idées en vrac, la question à trancher plus tard.
   ============================================================ */

/**
 * Des notes en petit, comme sur un tableau de liège : chacune n'est haute que
 * de ce qu'elle contient et grandit avec son texte. Une note est un vrai
 * fichier — `Bloc-notes/<date>.html`, à la racine de la campagne, avec sa
 * version .txt — donc elle s'ouvre aussi dans l'explorateur. Un seul
 * Bloc-notes pour toute la campagne.
 */
const DOSSIER = 'Bloc-notes'

/** « 2026-10-01 23h52 » : un nom qui se trie tout seul, du plus récent au plus ancien. */
function horodatage(d = new Date()): string {
  const z = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}h${z(d.getMinutes())}`
}

const casesOuvertes = (html: string): number => (html.match(/data-checked="false"/g) ?? []).length

/** Une note neuve porte sa date pour nom, tant qu'on ne lui a pas donné de titre. */
const SANS_TITRE = /^\d{4}-\d\d-\d\d \d\dh\d\d( \(\d+\))?$/

/**
 * Les couleurs d'une note : des lavis légers posés sur son papier (app.css),
 * pour qu'elle reste lisible dans les deux thèmes. La couleur est écrite dans
 * le fichier même, en tête, dans un commentaire que l'éditeur ne voit pas : la
 * note l'emporte partout où elle va.
 */
const COULEURS: { cle: string; nom: string }[] = [
  { cle: 'papier', nom: 'Papier' },
  { cle: 'brass', nom: 'Laiton' },
  { cle: 'orange', nom: 'Orange' },
  { cle: 'moss', nom: 'Mousse' },
  { cle: 'azur', nom: 'Azur' },
  { cle: 'prune', nom: 'Prune' }
]
const MARQUE = /^<!--note:([a-z]+)-->/
const couleurDe = (body: string | null): string => MARQUE.exec(body ?? '')?.[1] ?? 'papier'
const sansMarque = (body: string | null): string => (body ?? '').replace(MARQUE, '')
const avecMarque = (html: string, couleur: string): string =>
  couleur === 'papier' ? html : `<!--note:${couleur}-->${html}`

export function BlocNotes(): JSX.Element {
  const s = useStore()
  const notes = s.allItems
    .filter(
      (i) =>
        i.kind === 'doc' &&
        !!i.relPath?.startsWith(`${DOSSIER}/`) &&
        !i.relPath.slice(DOSSIER.length + 1).includes('/')
    )
    // la plus récente en tête : l'identifiant suit l'ordre de création, le titre non
    .sort((a, b) => b.id - a.id)
  /* Le texte tel qu'on le tape, note par note : le compte des cases suit la frappe. */
  const [vivants, setVivants] = useState<Record<number, string>>({})
  const [neuve, setNeuve] = useState<number | null>(null)
  const [occupe, setOccupe] = useState(false)

  const aFaire = notes.reduce((n, i) => n + casesOuvertes(vivants[i.id] ?? i.body ?? ''), 0)

  const ajouter = async (): Promise<void> => {
    if (occupe) return
    setOccupe(true)
    try {
      const existe = (ns: UiFolder[]): boolean => ns.some((f) => f.relPath === DOSSIER)
      if (!existe(useStore.getState().arbreComplet)) {
        const rel = await window.jdr.folders.create('', DOSSIER)
        await window.jdr.folders.decor(rel, 'notes', null)
      }
      const it = await window.jdr.items.createDoc(DOSSIER, horodatage())
      if (!it) return s.toast('La note n’a pas pu être créée.', true)
      // Écrite une première fois, elle a tout de suite sa version .txt.
      await window.jdr.items.update(it.id, { body: '<p></p>' })
      await s.refreshLibrary()
      setNeuve(it.id)
    } finally {
      setOccupe(false)
    }
  }

  const jeter = async (note: UiItem): Promise<void> => {
    const texte = (vivants[note.id] ?? note.body ?? '').replace(/<[^>]+>|\s|&nbsp;/g, '')
    if (texte && !confirm('Envoyer cette note à la corbeille ?')) return
    if (note.relPath) await window.jdr.items.trash(note.relPath)
    const txt = note.relPath?.replace(/\.html?$/i, '.txt')
    if (txt && s.allItems.some((i) => i.relPath === txt)) await window.jdr.items.trash(txt)
    await s.refreshLibrary()
  }

  return (
    <section className="view bloc-notes">
      <div className="vhead">
        <div>
          <h2>Bloc-notes</h2>
          <p>
            Ce que tu te notes en écrivant : les TODO, les idées en vrac. « / » pour les cases à
            cocher, « @ » pour nommer un joueur.
          </p>
        </div>
        <div className="spacer" />
        {notes.length ? (
          <span className="eyebrow">
            {aFaire === 0 ? 'Rien à faire' : `${aFaire} chose${aFaire > 1 ? 's' : ''} à faire`}
          </span>
        ) : null}
        <button className="btn btn-brass" onClick={() => void ajouter()} disabled={occupe}>
          <IconPlus />
          Ajouter une note
        </button>
      </div>

      <div className="card bn-tableau">
        {notes.length ? (
          <div className="bn-grille">
            {notes.map((n) => (
              <Note
                key={n.id}
                note={n}
                focus={n.id === neuve}
                onTexte={(html) => setVivants((v) => ({ ...v, [n.id]: html }))}
                onJeter={() => void jeter(n)}
              />
            ))}
          </div>
        ) : (
          <div className="empty">
            <b>Aucune note</b>
            « Ajouter une note » en ouvre une : écris, elle s’enregistre toute seule.
          </div>
        )}
        <MenuTagPersonnage />
        <MenuCommandesTexte />
      </div>
    </section>
  )
}

/** Une note : son texte s'écrit sur place et s'enregistre au fil de la frappe. */
function Note({
  note,
  focus,
  onTexte,
  onJeter
}: {
  note: UiItem
  focus: boolean
  onTexte: (html: string) => void
  onJeter: () => void
}): JSX.Element {
  const characters = useStore((s) => s.characters)
  const refreshLibrary = useStore((s) => s.refreshLibrary)
  const [couleur, setCouleur] = useState(() => couleurDe(note.body))
  const teinte = useRef(couleur)
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
    await window.jdr.items.update(note.id, { body: avecMarque(body, teinte.current) })
  }

  const peindre = (c: string): void => {
    setCouleur(c)
    teinte.current = c
    if (editor) {
      html.current = editor.getHTML()
      void ecrire()
    }
  }

  const titrer = async (titre: string): Promise<void> => {
    const t = titre.trim()
    if (!t || t === note.title) return
    await window.jdr.items.update(note.id, { title: t })
    await refreshLibrary()
  }

  const editor = useEditor({
    extensions: EXTENSIONS_TEXTE,
    content: sansMarque(note.body) || '<p></p>',
    autofocus: focus ? 'end' : false,
    onUpdate: ({ editor: ed }) => {
      html.current = ed.getHTML()
      onTexte(html.current)
      if (minuterie.current) window.clearTimeout(minuterie.current)
      minuterie.current = window.setTimeout(() => void ecrire(), 900)
    }
  })

  // Un personnage renommé ou recoloré : ses tags suivent.
  useEffect(() => {
    if (editor) resynchroniserTags(editor, characters)
  }, [editor, characters])

  // En quittant la page : ce qui n'est pas encore écrit l'est.
  useEffect(
    () => () => {
      void ecrire()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  return (
    <article className="bn-note" data-couleur={couleur}>
      <header>
        <input
          className="bn-titre"
          defaultValue={SANS_TITRE.test(note.title) ? '' : note.title}
          placeholder="Sans titre"
          aria-label="Titre de la note"
          onKeyDown={(e) => {
            // Entrée : le titre est posé, on descend écrire la note
            if (e.key === 'Enter') {
              e.preventDefault()
              editor?.commands.focus('end')
            }
          }}
          onBlur={(e) => void titrer(e.target.value)}
        />
        <span className="bn-teintes" role="group" aria-label="Couleur de la note">
          {COULEURS.map((c) => (
            <button
              key={c.cle}
              className={`bn-teinte t-${c.cle}`}
              title={c.nom}
              aria-label={`Note ${c.nom.toLowerCase()}`}
              aria-pressed={couleur === c.cle}
              onClick={() => peindre(c.cle)}
            />
          ))}
        </span>
        <button
          className="btn btn-ghost btn-sm btn-ico"
          title="Envoyer la note à la corbeille"
          onClick={onJeter}
        >
          <IconTrash />
        </button>
      </header>
      <div className="read-body" onClick={() => editor?.commands.focus()}>
        <EditorContent editor={editor} />
      </div>
    </article>
  )
}
