import { Fragment } from 'react'
import { useStore, type ViewId } from '../store'
import { useRetourMoment } from '../retourMoment'
import { avancer, reculer, useHistorique } from '../historique'
import { IconPrecedent, IconSuivant } from './Icons'
import { useSuiteAriane } from './SuiteAriane'

/* ============================================================
   La barre du haut, à gauche : ← → puis le fil d'Ariane de la page.
   Elle est commune à toutes les pages ; aucune n'y échappe.
   ============================================================ */

interface Maillon {
  label: string
  /** Une page où l'on peut se rendre ; sans elle, c'est un groupe du rail. */
  view?: ViewId
}

const PAGES: Record<Exclude<ViewId, 'editor'>, Maillon[]> = {
  regie: [{ label: 'Diffusion' }, { label: 'Régie' }],
  pupitre: [{ label: 'Diffusion' }, { label: 'Paravent' }],
  timeline: [
    { label: 'Matière' },
    { label: 'Préparation de la séance', view: 'timeline' },
    { label: 'Chronologie' }
  ],
  trame: [
    { label: 'Matière' },
    { label: 'Préparation de la séance', view: 'timeline' },
    { label: 'Arborescence' }
  ],
  annexes: [
    { label: 'Matière' },
    { label: 'Préparation de la séance', view: 'timeline' },
    { label: 'Documents annexes' }
  ],
  lib: [{ label: 'Matière' }, { label: 'Bibliothèque' }],
  notes: [{ label: 'Matière' }, { label: 'Bloc-notes' }],
  places: [{ label: 'Matière' }, { label: 'Lieux' }],
  plans: [{ label: 'Matière' }, { label: 'Lieux', view: 'places' }, { label: 'Plans' }],
  objets: [{ label: 'Matière' }, { label: 'Objets' }],
  sons: [{ label: 'Matière' }, { label: 'Sons' }],
  sheets: [{ label: 'Table' }, { label: 'Fiches' }],
  pochette: [{ label: 'Table' }, { label: 'Pochette' }],
  dice: [{ label: 'Table' }, { label: 'Jets de dés' }]
}

function chemin(
  s: ReturnType<typeof useStore.getState>,
  docDuMoment: number | null
): Maillon[] {
  if (s.view !== 'editor') return PAGES[s.view]
  /* L'Éditeur n'a pas d'entrée au rail : on le range sous la page d'où l'on
     vient — la Chronologie pour le texte d'un moment, la Bibliothèque sinon. */
  const doc = s.allItems.find((i) => i.id === s.editingItemId)
  const duMoment = docDuMoment !== null && docDuMoment === s.editingItemId
  const avant: Maillon[] = duMoment
    ? [
        { label: 'Matière' },
        { label: 'Préparation de la séance', view: 'timeline' },
        { label: 'Chronologie', view: 'timeline' }
      ]
    : [{ label: 'Matière' }, { label: 'Bibliothèque', view: 'lib' }]
  return [...avant, { label: doc ? `Éditeur · ${doc.title}` : 'Éditeur' }]
}

export function Ariane({ sousTitre }: { sousTitre: string }): JSX.Element {
  const s = useStore()
  const docDuMoment = useRetourMoment((r) => r.docId)
  const { pile, pos } = useHistorique()
  const maillons = chemin(s, docDuMoment)
  const dernier = maillons.length - 1
  /* Une page qui va plus loin (la fiche d'un lieu) : son entrée devient un
     lien de retour, et la suite s'écrit après, dans `#ariane-suite`. */
  const retour = useSuiteAriane((r) => r.retour)

  return (
    <div className="ariane">
      <div className="histo">
        <button
          className="histo-btn"
          disabled={pos <= 0}
          onClick={reculer}
          title="Page précédente — Alt ←"
          aria-label="Page précédente"
        >
          <IconPrecedent />
        </button>
        <button
          className="histo-btn"
          disabled={pos >= pile.length - 1}
          onClick={avancer}
          title="Page suivante — Alt →"
          aria-label="Page suivante"
        >
          <IconSuivant />
        </button>
      </div>

      <nav className="ariane-fil" aria-label="Fil d’Ariane">
        {maillons.map((m, i) => (
          <Fragment key={i}>
            {i > 0 ? <span className="ariane-sep">›</span> : null}
            {i === dernier && retour ? (
              <button className="ariane-lien" onClick={retour}>
                {m.label}
              </button>
            ) : i === dernier ? (
              <h1 aria-current="page">{m.label}</h1>
            ) : m.view ? (
              <button className="ariane-lien" onClick={() => s.setView(m.view!)}>
                {m.label}
              </button>
            ) : (
              <span className="ariane-groupe">{m.label}</span>
            )}
          </Fragment>
        ))}
        <span id="ariane-suite" className="ariane-suite" />
        {sousTitre && !retour ? <span className="ariane-sous">{sousTitre}</span> : null}
      </nav>
    </div>
  )
}
