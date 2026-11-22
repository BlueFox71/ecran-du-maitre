/**
 * « Nouvelle campagne » : d'abord les règles, ensuite le dossier.
 *
 * Les règles partent avec la création (`project.create(regles)`) : la
 * campagne naît chasse aux fantômes ou World of Warcraft — avec la fiche
 * d'Azeroth dans ce cas —, et l'écran ne les redemande pas en s'ouvrant.
 *
 * Qui veut créer une campagne (l'accueil, le menu Fichier) le demande par
 * l'évènement `jdr:nouvelle-campagne`.
 */
import { useEffect, useState } from 'react'
import { REGLES, type Regles } from '@shared/wow'
import { urlPortraitMj } from '../../shared/avatarsMj'

export function nouvelleCampagne(): void {
  window.dispatchEvent(new CustomEvent('jdr:nouvelle-campagne'))
}

export function NouvelleCampagne(): JSX.Element | null {
  const [ouvert, setOuvert] = useState(false)
  const [occupe, setOccupe] = useState(false)

  useEffect(() => {
    const ouvrir = (): void => setOuvert(true)
    window.addEventListener('jdr:nouvelle-campagne', ouvrir)
    return () => window.removeEventListener('jdr:nouvelle-campagne', ouvrir)
  }, [])

  useEffect(() => {
    if (!ouvert) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !occupe) setOuvert(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ouvert, occupe])

  if (!ouvert) return null

  const creer = async (r: Regles): Promise<void> => {
    setOccupe(true)
    /* Réussie, la création recharge l'interface ; revenu ici, le choix du
       dossier a été annulé. Le processus principal retient que les règles
       viennent d'être choisies : l'écran ne les redemande pas. */
    await window.jdr.project.create(r)
    setOccupe(false)
  }

  return (
    <div className="scrim par-dessus choix-regles-scrim" onClick={() => !occupe && setOuvert(false)}>
      <div
        className="choix-regles"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nouvelle-campagne-titre"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="eyebrow">Nouvelle campagne</span>
        <h2 id="nouvelle-campagne-titre">Avec quelles règles ?</h2>
        <div className="choix-regles-cartes">
          {REGLES.map((r) => (
            <button
              key={r.id}
              className={`choix-regles-carte regles-${r.id}`}
              disabled={occupe}
              onClick={() => void creer(r.id)}
            >
              <span className="choix-regles-embleme" aria-hidden="true">
                <img
                  src={urlPortraitMj(r.id === 'fantomes' ? 'avatar:fantomes' : 'avatar:heroique') ?? undefined}
                  alt=""
                />
              </span>
              <b>{r.nom}</b>
              <span className="resume">{r.resume}</span>
            </button>
          ))}
        </div>
        <p className="aide">
          {occupe
            ? 'Choisis maintenant le dossier de la campagne…'
            : 'Le choix est définitif : une campagne garde ses règles pour toujours. Ensuite, tu choisis le dossier qui deviendra la campagne.'}
        </p>
      </div>
    </div>
  )
}
