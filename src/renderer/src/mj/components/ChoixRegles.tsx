/**
 * « Quelles règles ce soir ? » — à l'ouverture de l'écran, une fois par
 * campagne et par lancement : chasse aux fantômes, ou World of Warcraft.
 *
 * Le choix reste celui de la campagne (Paramètres › Règles du jeu le change
 * aussi) ; on le redemande à chaque lancement parce que la même table joue
 * l'un ou l'autre selon le soir. Entrée garde les règles actuelles.
 */
import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { REGLES, type Regles } from '@shared/wow'
import {
  changerRegles,
  cleDejaDemande,
  ficheAChanger,
  personnagesTouches
} from '../regles'
import { urlPortraitMj } from '../../shared/avatarsMj'

function dejaDemande(): boolean {
  try {
    return sessionStorage.getItem(cleDejaDemande()) === '1'
  } catch {
    return false
  }
}

function noterDemande(): void {
  try {
    sessionStorage.setItem(cleDejaDemande(), '1')
  } catch {
    /* sans stockage, on redemandera : rien de grave */
  }
}

export function ChoixRegles(): JSX.Element | null {
  const s = useStore()
  const actuelles = s.reglages.regles
  const [ferme, setFerme] = useState(false)
  /** Les règles choisies, en attente de la question sur la fiche. */
  const [attente, setAttente] = useState<Regles | null>(null)
  const [occupe, setOccupe] = useState(false)

  /* Une campagne qu'on vient de créer a reçu ses règles à la création : on le
     demande au processus principal (une fois) avant de rien montrer. */
  const [verifie, setVerifie] = useState(false)
  const pret = s.ready && !!s.project
  useEffect(() => {
    if (!pret || verifie) return
    void window.jdr.project.reglesChoisiesALaCreation().then((oui) => {
      if (oui) {
        noterDemande()
        setFerme(true)
      }
      setVerifie(true)
    })
  }, [pret, verifie])

  const visible = pret && verifie && !ferme && !dejaDemande()

  const finir = async (r: Regles, fiche: boolean): Promise<void> => {
    setOccupe(true)
    try {
      await changerRegles(r, { fiche })
      noterDemande()
      setFerme(true)
      if (r === 'wow' && actuelles !== 'wow') useStore.setState({ view: 'azeroth' })
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

  useEffect(() => {
    if (!visible || attente) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault()
        choisir(actuelles ?? 'fantomes')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, attente, actuelles])

  if (!visible) return null
  const n = personnagesTouches()

  return (
    <div className="scrim par-dessus choix-regles-scrim">
      <div className="choix-regles" role="dialog" aria-modal="true" aria-labelledby="choix-regles-titre">
        <span className="eyebrow">{s.campaign?.name ?? 'La campagne'}</span>
        <h2 id="choix-regles-titre">Quelles règles pour ce soir ?</h2>
        {attente ? (
          <div className="choix-regles-fiche">
            <p>
              La fiche de campagne va passer aux règles{' '}
              <b>{REGLES.find((x) => x.id === attente)?.nom}</b>. Les {n} personnage
              {n > 1 ? 's' : ''} de la campagne {n > 1 ? 'perdront' : 'perdra'} les cases qui n’existent pas
              dans la nouvelle fiche (caractéristiques, compétences, jauges).
              {attente === 'fantomes'
                ? ' L’ancienne fiche, gardée au passage à WoW, revient telle quelle.'
                : ' L’ancienne fiche est gardée : revenir aux fantômes la rendra.'}
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
              {REGLES.map((r) => {
                const ici = (actuelles ?? null) === r.id
                return (
                  <button
                    key={r.id}
                    className={`choix-regles-carte regles-${r.id}${ici ? ' ici' : ''}`}
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
                    {ici ? <span className="ici-badge">Règles actuelles · Entrée</span> : null}
                  </button>
                )
              })}
            </div>
            <p className="aide">
              {actuelles
                ? 'Le choix reste celui de la campagne ; il se change aussi dans Paramètres › Règles du jeu.'
                : 'Cette campagne n’a pas encore de règles : choisis-les une fois, l’écran s’en souviendra.'}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
