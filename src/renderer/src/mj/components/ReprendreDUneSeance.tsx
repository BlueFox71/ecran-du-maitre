/**
 * Reprendre un lieu ou un PNJ d'une autre séance.
 *
 * Chaque séance a les siens ; quand la table retourne au manoir, ou recroise
 * le vieux gardien, on n'a pas à tout refaire. On en tire une **copie** : ce
 * qu'on y changera ici ne remontera pas là-bas. La fenêtre le dit, parce que
 * c'est la seule chose qu'il faut savoir avant de cliquer.
 */
import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { IconPeople, IconPlace, IconPlus } from './Icons'
import type { Character, GameSession, Place } from '@shared/types'

type Nature = 'lieu' | 'pnj'

const RETRAIT: Record<Place['tier'], number> = { espace: 0, niveau: 1, lieu: 2 }

export function ReprendreDUneSeance({
  nature,
  onRepris,
  onClose
}: {
  nature: Nature
  /** L'identifiant de la copie, pour l'ouvrir aussitôt. */
  onRepris: (id: number) => void
  onClose: () => void
}): JSX.Element {
  const s = useStore()
  const autres = s.sessions.filter((x) => x.id !== s.session?.id)
  const [seance, setSeance] = useState<number | null>(autres[0]?.id ?? null)
  const [lieux, setLieux] = useState<Place[]>([])
  const [pnjs, setPnjs] = useState<Character[]>([])
  const [occupe, setOccupe] = useState(false)

  useEffect(() => {
    if (seance === null) return
    if (nature === 'lieu') void window.jdr.places.ofSession(seance).then(setLieux)
    else void window.jdr.characters.pnjOf(seance).then(setPnjs)
  }, [seance, nature])

  const reprendre = async (id: number): Promise<void> => {
    if (occupe) return
    setOccupe(true)
    try {
      const neuf =
        nature === 'lieu'
          ? await window.jdr.places.duplicate(id)
          : await window.jdr.characters.duplicate(id)
      await Promise.all([
        nature === 'lieu' ? s.refreshPlaces() : s.refreshCharacters(),
        s.refreshObjets()
      ])
      s.toast(nature === 'lieu' ? 'Lieu repris dans cette séance' : 'PNJ repris dans cette séance')
      onRepris(neuf)
      onClose()
    } catch (e) {
      s.toast(e instanceof Error ? e.message : 'Reprise impossible', true)
      setOccupe(false)
    }
  }

  /* Les lieux communs — sans séance — sont déjà là : on ne les propose pas. */
  const siens = lieux.filter((p) => !s.places.some((q) => q.id === p.id))

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header>
          {nature === 'lieu' ? <IconPlace /> : <IconPeople />}
          <h3>{nature === 'lieu' ? 'Reprendre un lieu' : 'Reprendre un PNJ'}</h3>
        </header>

        <div className="body">
          {autres.length === 0 ? (
            <p className="expli">Il n’y a pas d’autre séance dans cette campagne.</p>
          ) : (
            <>
              <div className="field">
                <label htmlFor="rp-seance">Depuis la séance</label>
                <select
                  id="rp-seance"
                  value={seance ?? ''}
                  onChange={(e) => setSeance(Number(e.target.value))}
                >
                  {autres.map((x: GameSession) => (
                    <option key={x.id} value={x.id}>
                      {x.label}
                    </option>
                  ))}
                </select>
              </div>
              <p className="expli">
                {nature === 'lieu'
                  ? 'Le lieu arrive avec ses pièces, son plan, ses murs, ses lumières, ses repères et ses objets — pas encore découvert, et sans pions. C’est une copie : ce que tu y changes ici reste ici.'
                  : 'Le PNJ arrive avec sa fiche, ses notes, son butin et ce qu’il porte. C’est une copie : ce que tu lui fais ici reste ici.'}
              </p>

              <div className="liste-docs">
                {nature === 'lieu'
                  ? siens.map((p) => (
                      <button
                        key={p.id}
                        className="doc-row"
                        disabled={occupe}
                        style={{ paddingLeft: 8 + RETRAIT[p.tier] * 18 }}
                        onClick={() => void reprendre(p.id)}
                        title={
                          p.tier === 'lieu'
                            ? 'Reprendre cette pièce'
                            : 'Reprendre, avec tout ce qu’il contient'
                        }
                      >
                        <IconPlace />
                        <span className="t" style={{ flex: 1 }}>
                          <span className="ttl">{p.name}</span>
                          <span className="sub">{p.tier}</span>
                        </span>
                        <IconPlus />
                      </button>
                    ))
                  : pnjs.map((c) => (
                      <button
                        key={c.id}
                        className="doc-row"
                        disabled={occupe}
                        onClick={() => void reprendre(c.id)}
                      >
                        <IconPeople />
                        <span className="t" style={{ flex: 1 }}>
                          <span className="ttl">{c.name}</span>
                          <span className="sub">{c.occupation ?? 'sans rôle noté'}</span>
                        </span>
                        <IconPlus />
                      </button>
                    ))}
                {(nature === 'lieu' ? siens.length : pnjs.length) === 0 ? (
                  <p className="vide">
                    {nature === 'lieu' ? 'Aucun lieu dans cette séance.' : 'Aucun PNJ dans cette séance.'}
                  </p>
                ) : null}
              </div>
            </>
          )}
        </div>

        <footer>
          <button className="btn btn-ghost" onClick={onClose}>
            Fermer
          </button>
        </footer>
      </div>
    </div>
  )
}
