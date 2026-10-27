import { useEffect, useState } from 'react'
import { heureLocale } from '@shared/heure'
import type { CharacterLogEntry } from '@shared/types'
import type { JoueurSm } from './Joueurs'

/**
 * Le journal de la santé mentale : qui a perdu ou regagné quoi, à quelle
 * heure, et pourquoi — toute la table d'un coup d'œil, la plus récente en
 * haut. Il lit le journal des jauges que la fiche tient déjà : rien de plus
 * n'est écrit pour lui.
 */

/** Combien de lignes on garde : la soirée récente, pas l'archive. */
const LIGNES = 40

interface Ligne extends CharacterLogEntry {
  nom: string
}

export function JournalSm({ joueurs, cle }: { joueurs: JoueurSm[]; cle: string }): JSX.Element | null {
  const [lignes, setLignes] = useState<Ligne[]>([])
  /* Relu quand une SM bouge : la valeur de chacun suffit à le savoir. */
  const signature = joueurs.map((j) => `${j.id}:${j.sm}`).join(',')

  useEffect(() => {
    let vivant = true
    void Promise.all(
      joueurs.map(async (j) =>
        (await window.jdr.characters.log(j.id)).filter((e) => e.field === cle).map((e) => ({ ...e, nom: j.nom }))
      )
    ).then((parJoueur) => {
      if (!vivant) return
      setLignes(
        parJoueur
          .flat()
          .sort((a, b) => (a.at === b.at ? b.id - a.id : a.at < b.at ? 1 : -1))
          .slice(0, LIGNES)
      )
    })
    return () => {
      vivant = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, cle])

  if (!lignes.length) return null
  return (
    <div className="sm-journal">
      <span className="eyebrow">Journal</span>
      <ol>
        {lignes.map((l) => (
          <li key={l.id} title={l.reason ?? undefined}>
            <span className="sm-j-heure num">{heureLocale(l.at)}</span>
            <b>{l.nom}</b>
            <span className={`sm-j-delta num${l.delta < 0 ? ' perte' : ' gain'}`}>
              {l.delta < 0 ? `−${-l.delta}` : `+${l.delta}`} → {l.value}
            </span>
            <span className="sm-j-raison">{l.reason ?? ''}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
