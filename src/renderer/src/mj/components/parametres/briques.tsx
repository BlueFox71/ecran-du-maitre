import { useEffect, useState } from 'react'
import { Valeur } from '../Valeur'
import { COURSE, positionDe, texteVolume, volumeDe } from '../../volume'

/* ============================================================
   Les briques d'une rubrique
   ============================================================ */

export function Tete({ titre, quoi }: { titre: string; quoi: string }): JSX.Element {
  return (
    <>
      <h4>{titre}</h4>
      <p className="pm-sous">{quoi}</p>
    </>
  )
}

/** Une ligne de réglage. `id` la rend retrouvable : la recherche y mène. */
export function Ligne({
  id,
  nom,
  aide,
  pleine,
  children
}: {
  id?: string
  nom: string
  aide?: string
  pleine?: boolean
  children: React.ReactNode
}): JSX.Element {
  return (
    <div className={`pm-ligne${pleine ? ' pleine' : ''}`} data-reglage={id}>
      <div className="quoi">
        <span className="nom">{nom}</span>
        {aide ? <span className="aide">{aide}</span> : null}
      </div>
      <div className="cmd">{children}</div>
    </div>
  )
}

export function Bloc({ titre, children }: { titre: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="pm-bloc">
      <span className="eyebrow">{titre}</span>
      {children}
    </div>
  )
}

/** Un groupe de boutons dont un seul est allumé. */
export function Seg<T extends string>({
  valeur,
  choix,
  desactive,
  onChoisir
}: {
  valeur: T
  choix: { k: T; label: string; aide?: string }[]
  desactive?: boolean
  onChoisir: (k: T) => void
}): JSX.Element {
  return (
    <div className="pm-seg" role="group">
      {choix.map((c) => (
        <button
          key={c.k}
          className={valeur === c.k ? 'on' : ''}
          title={c.aide}
          disabled={desactive}
          onClick={() => onChoisir(c.k)}
        >
          {c.label}
        </button>
      ))}
    </div>
  )
}

/** Un curseur qui dit ce qu'il vaut, et n'écrit qu'une fois lâché. */
export function Curseur({
  valeur,
  min,
  max,
  pas,
  texte,
  desactive,
  onPoser,
  label,
  volume = false
}: {
  valeur: number
  min: number
  max: number
  pas?: number
  texte: (v: number) => string
  desactive?: boolean
  onPoser: (v: number) => void
  label: string
  /** Un volume en pour cent (0 à 100) : le curseur suit l'oreille, fin dans le bas (voir `volume.ts`). */
  volume?: boolean
}): JSX.Element {
  /* On suit le doigt à l'écran et on n'écrit qu'au relâchement : sans cela,
     tirer un curseur écrirait cinquante lignes en base pour un seul geste. */
  const [vu, setVu] = useState(valeur)
  useEffect(() => setVu(valeur), [valeur])
  return (
    <>
      <input
        type="range"
        min={volume ? 0 : min}
        max={volume ? COURSE : max}
        step={volume ? 1 : (pas ?? 1)}
        value={volume ? positionDe(vu / 100) : vu}
        disabled={desactive}
        aria-label={label}
        onChange={(e) => {
          const n = Number(e.target.value)
          setVu(volume ? volumeDe(n) * 100 : n)
        }}
        onPointerUp={() => onPoser(vu)}
        onKeyUp={() => onPoser(vu)}
      />
      <Valeur
        className="pm-val num"
        value={vu}
        min={min}
        max={max}
        step={volume ? 0.5 : (pas ?? 1)}
        decimales={volume || (pas !== undefined && pas < 1) ? 1 : 0}
        affiche={volume ? texteVolume : texte}
        disabled={desactive}
        label={label}
        onChange={(v) => {
          setVu(v)
          onPoser(v)
        }}
      />
    </>
  )
}

/** Un onglet de la navigation de gauche. */
export function Onglet({
  r,
  on,
  onChoisir
}: {
  r: { nom: string; icone: JSX.Element }
  on: boolean
  onChoisir: () => void
}): JSX.Element {
  return (
    <button role="tab" aria-selected={on} onClick={onChoisir}>
      {r.icone}
      {r.nom}
    </button>
  )
}
