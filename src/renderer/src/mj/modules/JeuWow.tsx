/**
 * Le jeu World of Warcraft, dans la fenêtre de l'Écran : l'Arbre de talents
 * (Édition, Jeu, Grimoire, Métiers, Aventure — le générateur d'objets y est)
 * et l'éditeur de cartes.
 *
 * Les pages viennent du serveur du jeu que l'Écran fait tourner. Une page
 * ouverte reste vivante quand on change de module : le jeu attend une
 * seconde de calme avant d'écrire ses sauvegardes, et le recharger à chaque
 * passage risquerait de perdre le dernier geste (et serait lent).
 */
import { useEffect, useState } from 'react'
import { useStore } from '../store'

type Page = 'Arbre-de-talents.html' | 'Editeur-de-cartes.html'
const PAGES: Record<'wow-jeu' | 'wow-cartes', Page> = {
  'wow-jeu': 'Arbre-de-talents.html',
  'wow-cartes': 'Editeur-de-cartes.html'
}

export function JeuWow(): JSX.Element | null {
  const view = useStore((s) => s.view)
  const regles = useStore((s) => s.reglages.regles)
  /** Les pages déjà ouvertes, et leur adresse. */
  const [ouvertes, setOuvertes] = useState<Partial<Record<Page, string>>>({})
  const [erreur, setErreur] = useState<string | null>(null)
  const ici = view === 'wow-jeu' || view === 'wow-cartes' ? PAGES[view] : null

  useEffect(() => {
    if (!ici || ouvertes[ici]) return
    let vivant = true
    void window.jdr.wow.adresse(ici).then((url) => {
      if (!vivant) return
      if (url) setOuvertes((o) => ({ ...o, [ici]: url }))
      else setErreur('Le jeu ne s’est pas lancé : voir le module Azeroth.')
    })
    return () => {
      vivant = false
    }
  }, [ici, ouvertes])

  /* Hors des règles WoW, rien ne reste ouvert. */
  if (regles !== 'wow') return null
  return (
    <>
      {(Object.keys(ouvertes) as Page[]).map((p) => (
        <iframe
          key={p}
          className="jeu-wow"
          title={p === 'Arbre-de-talents.html' ? 'Talents et Aventure' : 'Cartes d’Azeroth'}
          src={ouvertes[p]}
          style={{ display: ici === p ? undefined : 'none' }}
          allow="clipboard-read; clipboard-write; fullscreen"
        />
      ))}
      {ici && !ouvertes[ici] ? (
        <div className="view">
          <div className="empty">{erreur ?? 'Ouverture du jeu…'}</div>
        </div>
      ) : null}
    </>
  )
}
