import { useStore, type ViewId } from '../store'

/* ============================================================
   Préparation de la séance : deux pages sœurs, la Chronologie et les
   documents annexes. Le même sous-menu les coiffe toutes les deux, et
   le rail les range sous une seule entrée qui se déplie.
   ============================================================ */

/** Les pages de la préparation, dans l'ordre du sous-menu et du rail. */
export const PAGES_PREPARATION: { id: ViewId; label: string }[] = [
  { id: 'timeline', label: 'Chronologie' },
  { id: 'annexes', label: 'Documents annexes' }
]

export function SousMenuPreparation(): JSX.Element {
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  return (
    <div className="seg prep-onglets" role="tablist" aria-label="Préparation de la séance">
      {PAGES_PREPARATION.map((p) => (
        <button
          key={p.id}
          role="tab"
          aria-selected={view === p.id}
          className={view === p.id ? 'on' : ''}
          onClick={() => setView(p.id)}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}
