/**
 * Le jeu World of Warcraft, dans la fenêtre de l'Écran : l'Arbre de talents
 * (Édition, Jeu, Grimoire, Métiers, Aventure — le générateur d'objets y est)
 * et l'éditeur de cartes.
 *
 * Les pages viennent du serveur du jeu que l'Écran fait tourner. Une page
 * ouverte reste vivante quand on change de module : le jeu attend une
 * seconde de calme avant d'écrire ses sauvegardes, et le recharger à chaque
 * passage risquerait de perdre le dernier geste (et serait lent).
 *
 * « Talents et Aventure » s'ouvre sur la vue du MJ (les arbres, le grimoire,
 * la fiche d'essai), ou sur l'Aventure d'un joueur de la table — la même que
 * sur son téléphone, tenue en miroir avec sa fiche de l'Écran.
 */
import { useEffect, useState } from 'react'
import { useStore } from '../store'
import type { JoueurWow } from '@shared/wow'

type Page = 'Arbre-de-talents.html' | 'Editeur-de-cartes.html'
const PAGES: Record<'wow-jeu' | 'wow-cartes', Page> = {
  'wow-jeu': 'Arbre-de-talents.html',
  'wow-cartes': 'Editeur-de-cartes.html'
}
const CLE_QUI = 'ecran.wow.aventureDe'

const lireQui = (): string => {
  try {
    return localStorage.getItem(CLE_QUI) ?? ''
  } catch {
    return ''
  }
}

export function JeuWow(): JSX.Element | null {
  const view = useStore((s) => s.view)
  const regles = useStore((s) => s.reglages.regles)
  /** Les pages déjà ouvertes, et leur adresse. */
  const [ouvertes, setOuvertes] = useState<Partial<Record<Page, string>>>({})
  const [erreur, setErreur] = useState<string | null>(null)
  /** L'Aventure montrée : '' pour la vue du MJ, sinon l'identifiant du joueur. */
  const [qui, setQui] = useState<string>(lireQui)
  const [table, setTable] = useState<JoueurWow[]>([])
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

  /* Les joueurs de la table : ceux qui ont une fiche dans l'Aventure, ou qui y sont en ce moment. */
  useEffect(() => {
    if (view !== 'wow-jeu') return
    let vivant = true
    const lire = (): void =>
      void window.jdr.wow
        .table()
        .then((t) => {
          if (vivant) setTable(t)
        })
        .catch(() => undefined)
    lire()
    const t = window.setInterval(lire, 10000)
    return () => {
      vivant = false
      window.clearInterval(t)
    }
  }, [view])

  const choisir = (id: string): void => {
    setQui(id)
    try {
      localStorage.setItem(CLE_QUI, id)
    } catch {
      /* le choix tiendra le temps de la session */
    }
  }

  /* Hors des règles WoW, rien ne reste ouvert. */
  if (regles !== 'wow') return null

  const adresse = (p: Page): string | undefined => {
    const u = ouvertes[p]
    if (!u || p !== 'Arbre-de-talents.html' || !qui) return u
    return u + (u.includes('?') ? '&' : '?') + 'joueur=' + encodeURIComponent(qui)
  }
  const joueurs = table.filter((j) => j.id && j.id !== 'mj')

  return (
    <>
      {(Object.keys(ouvertes) as Page[]).map((p) =>
        p === 'Arbre-de-talents.html' ? (
          <div key={p} className="jeu-wow-hote" style={{ display: ici === p ? undefined : 'none' }}>
            <div className="jeu-wow-qui">
              <label>
                Aventure de
                <select value={qui} onChange={(e) => choisir(e.target.value)}>
                  <option value="">MJ — arbres, grimoire, essais</option>
                  {joueurs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.nom}
                      {j.nom.toLowerCase() !== j.id ? ` (${j.id})` : ''}
                      {j.enLigne ? ' · en ligne' : ''}
                    </option>
                  ))}
                  {qui && !joueurs.some((j) => j.id === qui) ? <option value={qui}>{qui}</option> : null}
                </select>
              </label>
              <span className="aide">
                {qui
                  ? 'Son Aventure, comme sur son téléphone : tenue en miroir avec sa fiche de l’Écran.'
                  : 'Ta vue de MJ : l’Édition des arbres et du grimoire, et une fiche d’essai reliée à personne.'}
              </span>
            </div>
            <iframe
              key={adresse(p)}
              className="jeu-wow"
              title="Talents et Aventure"
              src={adresse(p)}
              allow="clipboard-read; clipboard-write; fullscreen"
            />
          </div>
        ) : (
          <iframe
            key={p}
            className="jeu-wow"
            title="Cartes d’Azeroth"
            src={ouvertes[p]}
            style={{ display: ici === p ? undefined : 'none' }}
            allow="clipboard-read; clipboard-write; fullscreen"
          />
        )
      )}
      {ici && !ouvertes[ici] ? (
        <div className="view">
          <div className="empty">{erreur ?? 'Ouverture du jeu…'}</div>
        </div>
      ) : null}
    </>
  )
}
