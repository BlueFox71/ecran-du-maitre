/**
 * « Un nouveau personnage vient d'être créé : à qui est-il ? »
 *
 * Quand un joueur crée son personnage dans l'Aventure, l'Écran en fait une
 * fiche (voir `main/wowFiches.ts`) et demande ici au MJ à quel joueur de la
 * campagne l'associer : un joueur inscrit, un nouveau joueur, ou personne.
 * « Plus tard » remet la question au prochain lancement.
 */
import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store'
import type { CampaignPlayer } from '@shared/types'
import type { PersoAAssocier } from '@shared/wow'

export function AssocierPerso(): JSX.Element | null {
  const s = useStore()
  const actif = s.ready && !!s.project && s.reglages.regles === 'wow'
  const [liste, setListe] = useState<PersoAAssocier[]>([])
  const [joueurs, setJoueurs] = useState<CampaignPlayer[]>([])
  /** Les personnages remis à plus tard, le temps de ce lancement. */
  const [plusTard, setPlusTard] = useState<number[]>([])
  const [choix, setChoix] = useState<number | 'nouveau' | 'personne' | null>(null)
  const [nouveau, setNouveau] = useState('')
  const [occupe, setOccupe] = useState(false)

  const relire = useCallback(async () => {
    if (!actif) return
    const [l, p] = await Promise.all([window.jdr.wow.aAssocier(), window.jdr.players.list()])
    setListe(l)
    setJoueurs(p)
  }, [actif])

  useEffect(() => {
    if (!actif) return
    void relire()
    const off = window.jdr.wow.onAAssocier(() => void relire())
    /* Au cas où l'évènement se perdrait (une fenêtre rechargée à ce moment-là). */
    const t = window.setInterval(() => void relire(), 15000)
    return () => {
      off()
      window.clearInterval(t)
    }
  }, [actif, relire])

  const perso = liste.find((p) => !plusTard.includes(p.characterId)) ?? null

  /* Un nouveau personnage : on part de la suggestion (le joueur au même prénom). */
  useEffect(() => {
    if (!perso) return
    setChoix(perso.suggestion ?? (joueurs.some((j) => j.characterId == null) ? null : 'nouveau'))
    setNouveau(perso.joueurWow)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perso?.characterId])

  if (!actif || !perso) return null

  const valider = async (): Promise<void> => {
    if (choix === null) return
    setOccupe(true)
    try {
      await window.jdr.wow.associer(
        perso.characterId,
        choix === 'nouveau' ? { nouveau } : choix === 'personne' ? {} : { playerId: choix }
      )
      await s.refreshCharacters()
      await s.refreshPlayers()
      await relire()
    } catch (e) {
      s.toast(e instanceof Error ? e.message : String(e), true)
    } finally {
      setOccupe(false)
    }
  }

  const libres = joueurs.filter((j) => j.characterId == null)
  const pris = joueurs.filter((j) => j.characterId != null)

  return createPortal(
    <div className="scrim par-dessus">
      <div className="modal az-associer" role="dialog" aria-modal="true" aria-labelledby="az-associer-titre">
        <header>
          <h3 id="az-associer-titre">Un nouveau personnage : à qui est-il ?</h3>
        </header>
        <div className="body">
          <p>
            <b>{perso.nom}</b>
            {perso.occupation ? ` — ${perso.occupation}` : ''} vient d’être créé dans l’Aventure de{' '}
            <b>{perso.joueurWow}</b>. Sa fiche est dans les Fiches ; à quel joueur de la campagne l’associer ?
          </p>
          <div className="az-choix-joueurs">
            {libres.map((j) => (
              <label key={j.id} className={`az-choix${choix === j.id ? ' on' : ''}`}>
                <input type="radio" name="az-joueur" checked={choix === j.id} onChange={() => setChoix(j.id)} />
                {j.name}
                {perso.suggestion === j.id ? <em>même prénom</em> : null}
              </label>
            ))}
            {pris.map((j) => (
              <label key={j.id} className={`az-choix${choix === j.id ? ' on' : ''}`} title="Ce joueur a déjà un personnage : il passera à celui-ci">
                <input type="radio" name="az-joueur" checked={choix === j.id} onChange={() => setChoix(j.id)} />
                {j.name}
                <em>a déjà un personnage</em>
              </label>
            ))}
            <label className={`az-choix${choix === 'nouveau' ? ' on' : ''}`}>
              <input type="radio" name="az-joueur" checked={choix === 'nouveau'} onChange={() => setChoix('nouveau')} />
              Un nouveau joueur :
              <input
                type="text"
                value={nouveau}
                onFocus={() => setChoix('nouveau')}
                onChange={(e) => setNouveau(e.target.value)}
                aria-label="Nom du nouveau joueur"
              />
            </label>
            <label className={`az-choix${choix === 'personne' ? ' on' : ''}`}>
              <input type="radio" name="az-joueur" checked={choix === 'personne'} onChange={() => setChoix('personne')} />
              Personne (un personnage du MJ, un essai…)
            </label>
          </div>
        </div>
        <footer>
          <button
            className="btn btn-ghost"
            disabled={occupe}
            onClick={() => setPlusTard((l) => [...l, perso.characterId])}
            title="La question reviendra au prochain lancement"
          >
            Plus tard
          </button>
          <div className="spacer" />
          <button
            className="btn btn-brass"
            disabled={occupe || choix === null || (choix === 'nouveau' && !nouveau.trim())}
            onClick={() => void valider()}
          >
            Associer
          </button>
        </footer>
      </div>
    </div>,
    document.body
  )
}
