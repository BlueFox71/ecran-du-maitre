import { useState } from 'react'
import type { Choc, Prix, Recup, ReglageSm } from '@shared/santeMentale'
import { normaliser } from '../components/parametres/chercher'

/**
 * La colonne gauche de la vue SM : ce qui peut arriver. Un clic déclare
 * l'entrée sur les joueurs cochés à droite — ou sur tous, si personne ne l'est.
 */

/** « −5 », avec le vrai signe moins. */
export const moins = (n: number): string => `−${n}`

/** « −2 / min », « −1 / 10 min » ; « −5 » pour une perte fixe. */
function pertePrix(p: Prix): string {
  if (!p.intervalleMin) return moins(p.perte)
  return `${moins(p.perte)} / ${p.intervalleMin === 1 ? '' : `${p.intervalleMin} `}min`
}

/** « +1D10 », « +5 » ; rien pour un moyen qui ne rend pas de points. */
function texteGain(g: Recup['gain']): string {
  if (typeof g === 'string') return `+${g.toUpperCase()}`
  return g > 0 ? `+${g}` : ''
}

const LIMITE = { scene: 'une fois par scène', nuit: 'une fois dans la nuit' } as const

/** Une entrée qui vaut pour tous les joueurs présents : elle s'applique sans demander à qui. */
const Tous = (): JSX.Element => (
  <span className="sm-tous" title="Pour tous les joueurs présents, sans demander">
    tous
  </span>
)

/** Sous le bouton cliqué : là où poser le choix des joueurs. */
export type Ou = { x: number; y: number }
const sous = (ev: React.MouseEvent<HTMLElement>): Ou => {
  const b = ev.currentTarget.getBoundingClientRect()
  return { x: b.left, y: b.bottom + 4 }
}

interface Props {
  r: ReglageSm
  /** Les joueurs présents : un remède limité que tous ont déjà pris se grise. */
  presents: number[]
  recupsFaites: Record<string, number[]>
  onChoc: (c: Choc, ou: Ou) => void
  onPrix: (p: Prix, ou: Ou) => void
  onRecup: (rec: Recup, ou: Ou) => void
  onScene: () => void
  onNuit: () => void
}

/**
 * Chaque mot tapé doit commencer un mot du texte, accents et casse oubliés :
 * « yeux », « ouija », « spirit » trouvent sans le libellé exact.
 */
function correspond(requete: string[], ...textes: (string | null | undefined)[]): boolean {
  const mots = textes.flatMap((t) => (t ? normaliser(t) : []))
  return requete.every((q) => mots.some((m) => m.startsWith(q)))
}

export function Bareme(p: Props): JSX.Element {
  const [q, setQ] = useState('')
  const requete = normaliser(q)
  const cherche = requete.length > 0

  const prix = cherche ? p.r.prix.filter((x) => correspond(requete, x.nom)) : p.r.prix
  const recups = cherche ? p.r.recups.filter((x) => correspond(requete, x.nom)) : p.r.recups

  return (
    <div className="sm-bareme">
      <input
        type="search"
        className="sm-chercher"
        placeholder="Chercher un prix, une récupération…"
        aria-label="Chercher dans le barème"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          /* Échap vide la recherche ; vide, il laisse faire (fermer un panneau, etc.). */
          if (e.key === 'Escape' && q) {
            e.stopPropagation()
            setQ('')
          }
        }}
      />
      {cherche && !prix.length && !recups.length ? (
        <p className="sm-vide">Rien pour « {q} ».</p>
      ) : null}

      {cherche ? null : (
        <>
          <span className="eyebrow">Choc (jet de Volonté)</span>
          <div className="sm-chocs">
            {p.r.chocs.map((c) => (
              <button key={c.id} type="button" className="btn btn-sm btn-c" onClick={(ev) => p.onChoc(c, sous(ev))}>
                {c.nom} {moins(c.perte)}
              </button>
            ))}
          </div>
        </>
      )}

      {cherche && !prix.length ? null : <span className="eyebrow sm-groupe">Prix (sans jet)</span>}
      {prix.map((x) => (
        <button
          key={x.id}
          type="button"
          className="sm-it"
          title={x.intervalleMin ? 'Lance un chrono sur le joueur, jusqu’à ce que tu l’arrêtes' : undefined}
          onClick={(ev) => p.onPrix(x, sous(ev))}
        >
          <span>{x.nom}</span>
          <span className="sm-perte">
            {x.tous ? <Tous /> : null}
            {pertePrix(x)}
          </span>
        </button>
      ))}

      {cherche && !recups.length ? null : <span className="eyebrow sm-groupe">Récupérer</span>}
      <div className="sm-recups">
        {recups.map((rec) => {
          const faits = p.recupsFaites[rec.id] ?? []
          /* Une fois par scène ou par nuit, et déjà pris par tous les présents. */
          const epuise = !!rec.limite && p.presents.length > 0 && p.presents.every((id) => faits.includes(id))
          const gain = texteGain(rec.gain)
          return (
            <button
              key={rec.id}
              type="button"
              className={`btn btn-sm sm-recup${epuise ? ' sm-epuise' : ''}`}
              disabled={epuise}
              title={
                rec.limite
                  ? `${LIMITE[rec.limite]}${epuise ? ' — déjà pris ; « Nouvelle scène » ou « Nouvelle nuit » le rend' : ''}`
                  : undefined
              }
              onClick={(ev) => p.onRecup(rec, sous(ev))}
            >
              {rec.nom}
              {gain ? ` ${gain}` : ''}
            </button>
          )
        })}
      </div>
      <div className="sm-pied-recup">
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          title="Les récupérations « une fois par scène » redeviennent possibles"
          onClick={p.onScene}
        >
          Nouvelle scène
        </button>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          title="Toutes les limites tombent : scène et nuit"
          onClick={p.onNuit}
        >
          Nouvelle nuit
        </button>
      </div>
    </div>
  )
}
