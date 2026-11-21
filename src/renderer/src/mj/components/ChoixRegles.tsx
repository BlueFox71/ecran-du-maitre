/**
 * Les règles d'une campagne se choisissent **une fois pour toutes**, à sa
 * création (`NouvelleCampagne.tsx`). Elles ne se changent plus ensuite.
 *
 * Cette fenêtre ne sert qu'aux campagnes créées **avant** les règles, qui n'en
 * ont aucune : elle les demande une seule fois, et le choix est définitif.
 * Une campagne qui a ses règles ne la voit jamais.
 */
import { useState } from 'react'
import { useStore } from '../store'
import { REGLES, type Regles } from '@shared/wow'
import { changerRegles, ficheAChanger, personnagesTouches } from '../regles'
import { urlPortraitMj } from '../../shared/avatarsMj'

export function ChoixRegles(): JSX.Element | null {
  const s = useStore()
  const [ferme, setFerme] = useState(false)
  /** Les règles choisies, en attente de la question sur la fiche. */
  const [attente, setAttente] = useState<Regles | null>(null)
  const [occupe, setOccupe] = useState(false)

  const visible = s.ready && !!s.project && s.reglages.regles === null && !ferme

  const finir = async (r: Regles, fiche: boolean): Promise<void> => {
    setOccupe(true)
    try {
      await changerRegles(r, { fiche })
      setFerme(true)
      if (r === 'wow') useStore.setState({ view: 'azeroth' })
    } catch (e) {
      s.toast(e instanceof Error ? e.message : String(e), true)
    } finally {
      setOccupe(false)
    }
  }

  const choisir = (r: Regles): void => {
    /* La fiche changerait et des personnages y ont des chiffres : on demande. */
    if (ficheAChanger(r) && personnagesTouches() > 0) setAttente(r)
    else void finir(r, true)
  }

  if (!visible) return null
  const n = personnagesTouches()

  return (
    <div className="scrim par-dessus choix-regles-scrim">
      <div className="choix-regles" role="dialog" aria-modal="true" aria-labelledby="choix-regles-titre">
        <span className="eyebrow">{s.campaign?.name ?? 'La campagne'}</span>
        <h2 id="choix-regles-titre">Les règles de cette campagne</h2>
        {attente ? (
          <div className="choix-regles-fiche">
            <p>
              La fiche de campagne va passer aux règles <b>{REGLES.find((x) => x.id === attente)?.nom}</b>.
              Les {n} personnage{n > 1 ? 's' : ''} de la campagne {n > 1 ? 'perdront' : 'perdra'} les cases qui
              n’existent pas dans la nouvelle fiche (caractéristiques, compétences, jauges).
            </p>
            <div className="choix-regles-pied">
              <button className="btn btn-ghost" disabled={occupe} onClick={() => setAttente(null)}>
                Retour
              </button>
              <div className="spacer" />
              <button className="btn" disabled={occupe} onClick={() => void finir(attente, false)}>
                Garder la fiche actuelle
              </button>
              <button className="btn btn-brass" disabled={occupe} onClick={() => void finir(attente, true)}>
                Changer la fiche
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="choix-regles-cartes">
              {REGLES.map((r) => (
                <button
                  key={r.id}
                  className={`choix-regles-carte regles-${r.id}`}
                  disabled={occupe}
                  onClick={() => choisir(r.id)}
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
              Cette campagne a été créée avant les règles : choisis-les une fois. <b>Le choix est définitif</b> —
              une campagne garde ses règles pour toujours.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
