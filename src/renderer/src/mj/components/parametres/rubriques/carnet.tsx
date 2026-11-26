/**
 * Le carnet des chasseurs, côté réglages : les indices et les entités que les
 * joueurs entourent ou barrent sur leur téléphone. On les écrit ici, on les
 * renomme, on les range ; ils partent aussitôt sur les téléphones. Rien ne se
 * déduit : c'est le livre des fantômes qui fait le travail.
 */
import { useEffect, useState } from 'react'
import type { CarnetVu, ElementCarnet, GenreCarnet } from '@shared/carnetChasse'
import type { Reglage } from '../registre'

/** Les lignes du carnet, relues à chaque changement — d'ici, d'un téléphone ou d'un Ctrl+Z (le serveur prévient). */
function useCarnet(): [CarnetVu | null, (c: CarnetVu) => void] {
  const [carnet, setCarnet] = useState<CarnetVu | null>(null)
  useEffect(() => {
    let vivant = true
    const relire = (): void =>
      void window.jdr.carnetChasse.etat().then((c) => {
        if (vivant) setCarnet(c)
      })
    relire()
    const fin = window.jdr.carnetChasse.onChange(relire)
    return () => {
      vivant = false
      fin()
    }
  }, [])
  return [carnet, setCarnet]
}

/** Un nom qu'on corrige sur place : il part quand on quitte le champ, ou à Entrée. */
function NomEnPlace({ el, onRenommer }: { el: ElementCarnet; onRenommer: (nom: string) => void }): JSX.Element {
  const [v, setV] = useState(el.nom)
  useEffect(() => setV(el.nom), [el.nom])
  const valider = (): void => {
    if (v.trim() && v.trim() !== el.nom) onRenommer(v)
    else setV(el.nom)
  }
  return (
    <input
      className="cn-nom"
      value={v}
      aria-label={`Renommer ${el.nom}`}
      onChange={(e) => setV(e.target.value)}
      onBlur={valider}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') setV(el.nom)
      }}
    />
  )
}

function Liste({ genre }: { genre: GenreCarnet }): JSX.Element {
  const [carnet, setCarnet] = useCarnet()
  const [neuf, setNeuf] = useState('')
  const api = window.jdr.carnetChasse
  const lignes = (carnet?.elements ?? []).filter((e) => e.genre === genre)

  const deplacer = (i: number, de: -1 | 1): void => {
    const ids = lignes.map((e) => e.id)
    const j = i + de
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    void api.ordonner(genre, ids).then(setCarnet)
  }
  const ajouter = (): void => {
    if (!neuf.trim()) return
    void api.ajouter(genre, neuf).then(setCarnet)
    setNeuf('')
  }

  return (
    <div className="cn-liste">
      {lignes.map((el, i) => (
        <div key={el.id} className="cn-ligne">
          <NomEnPlace el={el} onRenommer={(nom) => void api.renommer(el.id, nom).then(setCarnet)} />
          <button
            className="btn btn-sm btn-ghost"
            disabled={i === 0}
            onClick={() => deplacer(i, -1)}
            aria-label={`Monter ${el.nom}`}
            title="Monter"
          >
            ↑
          </button>
          <button
            className="btn btn-sm btn-ghost"
            disabled={i === lignes.length - 1}
            onClick={() => deplacer(i, 1)}
            aria-label={`Descendre ${el.nom}`}
            title="Descendre"
          >
            ↓
          </button>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => void api.retirer(el.id).then(setCarnet)}
            aria-label={`Retirer ${el.nom}`}
            title="Retirer — ses marques partent avec lui (Ctrl+Z le ramène)"
          >
            ✕
          </button>
        </div>
      ))}
      {!lignes.length ? (
        <p className="aide">
          {genre === 'indice' ? 'Aucun indice' : 'Aucune entité'} : sans aucune ligne, le carnet n’apparaît pas sur
          les téléphones.
        </p>
      ) : null}
      <div className="cn-ligne cn-ajout">
        <input
          className="cn-nom"
          value={neuf}
          placeholder={genre === 'indice' ? 'Un indice de plus…' : 'Une entité de plus…'}
          onChange={(e) => setNeuf(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ajouter()}
        />
        <button className="btn btn-sm" onClick={ajouter} disabled={!neuf.trim()}>
          Ajouter
        </button>
      </div>
    </div>
  )
}

export const reglages: Reglage[] = [
  {
    id: 'carnet.indices',
    rubrique: 'carnet',
    nom: 'Indices',
    aide: 'Ce que les joueurs constatent avec leurs outils, à entourer ou à barrer.',
    mots: ['indice', 'preuve', 'emf', 'spirit box', 'phasmo'],
    pleine: true,
    Cmd: function Indices() {
      return <Liste genre="indice" />
    }
  },
  {
    id: 'carnet.entites',
    rubrique: 'carnet',
    nom: 'Entités',
    aide: 'Les types d’entités du livre des fantômes, à entourer ou à barrer.',
    mots: ['entité', 'fantôme', 'type', 'démon', 'phasmo'],
    pleine: true,
    Cmd: function Entites() {
      return <Liste genre="entite" />
    }
  }
]
