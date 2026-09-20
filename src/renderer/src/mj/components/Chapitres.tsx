import { useState } from 'react'
import { useStore } from '../store'
import { Fenetre } from './Fiches'
import { IconCheck, IconChevron, IconPen, IconPlus, IconTimeline, IconTrash } from './Icons'
import type { Chapter } from '@shared/types'

/**
 * Les chapitres — enfin écrivables.
 *
 * Ils existaient depuis le début : un document, un lieu ou un moment pouvait
 * en désigner un, la page des Lieux filtrait dessus, l'Éditeur en faisait le
 * sur-titre du texte diffusé aux joueurs. Mais **aucun écran ne savait en
 * créer un** : on héritait des trois posés à l'installation, et c'était tout
 * le vocabulaire de la campagne. Les trois canaux dormaient dans le pont.
 *
 * Un chapitre ne contient rien. C'est une étiquette ordonnée, et ce sont les
 * choses qui la désignent — d'où les comptes sur chaque ligne : avant d'en
 * effacer un, on voit ce qui va perdre son étiquette.
 */
export function Chapitres({ onClose }: { onClose: () => void }): JSX.Element {
  const s = useStore()
  const [neuf, setNeuf] = useState('')
  const [notesOuvertes, setNotesOuvertes] = useState<number | null>(null)
  const [arme, setArme] = useState<number | null>(null)

  /* Chaque geste rend la liste entière : les comptes bougent en même temps
     que les chapitres, et on la repose telle quelle. */
  const pose = (liste: Chapter[]): void => useStore.setState({ chapters: liste })

  const ajouter = async (): Promise<void> => {
    const t = neuf.trim()
    if (!t) return
    pose(await window.jdr.chapters.create(t))
    setNeuf('')
  }

  /* On donne l'ordre entier plutôt que d'échanger deux rangs : une base
     héritée peut porter deux chapitres au même rang — c'est arrivé — et un
     échange les y laisserait pour toujours. */
  const bouger = async (id: number, pas: number): Promise<void> => {
    const ids = s.chapters.map((c) => c.id)
    const i = ids.indexOf(id)
    const j = i + pas
    if (i < 0 || j < 0 || j >= ids.length) return
    const permute = [...ids]
    permute[i] = ids[j]
    permute[j] = ids[i]
    pose(await window.jdr.chapters.reorder(permute))
  }

  return (
    <Fenetre titre="Les chapitres" icone={<IconTimeline />} onClose={onClose} large>
      <p className="chap-intro">
        Un chapitre ne contient rien : ce sont les documents, les lieux et les moments qui le
        désignent. Il donne son nom au sur-titre d’un texte diffusé, sert de filtre dans les Lieux,
        et range la Chronologie.
      </p>

      {s.chapters.length === 0 ? (
        <p className="rien">Aucun chapitre. Écris-en un ci-dessous — « I — Ouverture », par exemple.</p>
      ) : (
        <div className="chap-liste">
          {s.chapters.map((c, n) => (
            <div className="chap-lig" key={c.id}>
              <span className="chap-rang num">{n + 1}</span>

              <div className="chap-corps">
                <input
                  className="chap-titre"
                  defaultValue={c.title}
                  aria-label={`Titre du chapitre ${n + 1}`}
                  onBlur={async (e) => {
                    const t = e.target.value.trim()
                    if (!t || t === c.title) {
                      e.target.value = c.title
                      return
                    }
                    pose(await window.jdr.chapters.update(c.id, { title: t }))
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur()
                  }}
                />
                <span className="chap-compte">{attaches(c)}</span>
              </div>

              <button
                className="btn btn-sm btn-ghost chap-fleche"
                title="Monter"
                aria-label="Monter"
                disabled={n === 0}
                onClick={() => void bouger(c.id, -1)}
              >
                <IconChevron className="vers-haut" />
              </button>
              <button
                className="btn btn-sm btn-ghost chap-fleche"
                title="Descendre"
                aria-label="Descendre"
                disabled={n === s.chapters.length - 1}
                onClick={() => void bouger(c.id, 1)}
              >
                <IconChevron className="vers-bas" />
              </button>
              <button
                className={`btn btn-sm btn-ghost${notesOuvertes === c.id ? ' btn-on' : ''}`}
                title="Ce que tu notes pour toi sur ce chapitre"
                aria-label="Notes du chapitre"
                onClick={() => setNotesOuvertes(notesOuvertes === c.id ? null : c.id)}
              >
                <IconPen />
              </button>
              <button
                className={`btn btn-sm${arme === c.id ? ' btn-danger btn-on' : ' btn-ghost'}`}
                title={
                  arme === c.id
                    ? 'Vraiment ? Ce qui y était rattaché perd son chapitre — rien n’est effacé'
                    : 'Effacer ce chapitre'
                }
                aria-label="Effacer ce chapitre"
                onClick={async () => {
                  /* Une croix qui efface d'un clic est une croix qu'on
                     regrette : celle-ci s'arme, et se désarme toute seule. */
                  if (arme !== c.id) {
                    setArme(c.id)
                    window.setTimeout(() => setArme((a) => (a === c.id ? null : a)), 4000)
                    return
                  }
                  setArme(null)
                  pose(await window.jdr.chapters.remove(c.id))
                }}
              >
                {arme === c.id ? <IconCheck /> : <IconTrash />}
              </button>

              {notesOuvertes === c.id ? (
                <textarea
                  className="chap-notes"
                  rows={3}
                  defaultValue={c.notes ?? ''}
                  placeholder="Ce que tu veux te rappeler de ce chapitre — pour toi seul."
                  onBlur={async (e) => {
                    if ((c.notes ?? '') === e.target.value) return
                    pose(await window.jdr.chapters.update(c.id, { notes: e.target.value }))
                  }}
                />
              ) : null}
            </div>
          ))}
        </div>
      )}

      <div className="chap-neuf">
        <input
          type="text"
          value={neuf}
          placeholder="Un chapitre de plus…"
          aria-label="Titre du nouveau chapitre"
          onChange={(e) => setNeuf(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void ajouter()
          }}
        />
        <button className="btn btn-sm" disabled={!neuf.trim()} onClick={() => void ajouter()}>
          <IconPlus />
          Ajouter
        </button>
      </div>

      <span className="eyebrow">
        Effacer un chapitre ne détruit rien : ce qui y était rattaché le reste, sans chapitre.
      </span>
    </Fenetre>
  )
}

/** Ce qui désigne ce chapitre, dit en français. */
function attaches(c: Chapter): string {
  const bouts: string[] = []
  if (c.items) bouts.push(`${c.items} document${c.items > 1 ? 's' : ''}`)
  if (c.places) bouts.push(`${c.places} lieu${c.places > 1 ? 'x' : ''}`)
  if (c.beats) bouts.push(`${c.beats} moment${c.beats > 1 ? 's' : ''}`)
  return bouts.length ? bouts.join(' · ') : 'rien n’y est rattaché'
}
