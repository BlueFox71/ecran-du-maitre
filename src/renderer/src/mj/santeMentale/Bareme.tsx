import { useState } from 'react'
import type { Choc, EvenementSm, Prix, Recup, ReglageSm } from '@shared/santeMentale'

/**
 * La colonne gauche de la vue SM : ce qui peut arriver. Un clic déclare
 * l'entrée sur les joueurs cochés à droite — ou sur tous, si personne ne l'est.
 */

/** Les événements montrés avant « N autres… ». */
const VISIBLES = 6

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

/** Une entrée qui vaut pour tous les joueurs présents : les coches n'y changent rien. */
const Tous = (): JSX.Element => (
  <span className="sm-tous" title="Pour tous les joueurs présents, cochés ou non">
    tous
  </span>
)

interface Props {
  r: ReglageSm
  evenements: EvenementSm[]
  /** Ceux que vise un clic : les cochés, sinon tous les joueurs présents. */
  vises: number[]
  recupsFaites: Record<string, number[]>
  onChoc: (c: Choc) => void
  onEvenement: (e: EvenementSm) => void
  onPrix: (p: Prix) => void
  onRecup: (rec: Recup) => void
  onScene: () => void
  onNuit: () => void
}

export function Bareme(p: Props): JSX.Element {
  const [deplie, setDeplie] = useState(false)
  const evts = deplie ? p.evenements : p.evenements.slice(0, VISIBLES)
  const caches = p.evenements.length - VISIBLES

  return (
    <div className="sm-bareme">
      <span className="eyebrow">Choc (jet de Volonté)</span>
      <div className="sm-chocs">
        {p.r.chocs.map((c) => (
          <button key={c.id} type="button" className="btn btn-sm btn-c" onClick={() => p.onChoc(c)}>
            {c.nom} {moins(c.perte)}
          </button>
        ))}
      </div>

      <span className="eyebrow sm-groupe">Événements de la séance</span>
      {p.evenements.length === 0 ? <p className="sm-vide">Aucun événement pour cette séance.</p> : null}
      {evts.map((e) => (
        <button
          key={e.id}
          type="button"
          className="sm-it"
          title={[e.note, e.jet ? 'Avec jet de Volonté' : 'Sans jet : la perte est retirée tout de suite']
            .filter(Boolean)
            .join(' — ')}
          onClick={() => p.onEvenement(e)}
        >
          <span>{e.nom}</span>
          <span className="sm-perte">
            {e.tous ? <Tous /> : null}
            {moins(e.perte)}
            {e.jet ? ' 🎲' : ''}
          </span>
        </button>
      ))}
      {caches > 0 ? (
        <button type="button" className="sm-it sm-plus" onClick={() => setDeplie((d) => !d)}>
          <span>{deplie ? 'Replier' : `${caches} autre${caches > 1 ? 's' : ''}…`}</span>
        </button>
      ) : null}

      <span className="eyebrow sm-groupe">Prix (sans jet)</span>
      {p.r.prix.map((x) => (
        <button
          key={x.id}
          type="button"
          className="sm-it"
          title={x.intervalleMin ? 'Lance un chrono sur le joueur, jusqu’à ce que tu l’arrêtes' : undefined}
          onClick={() => p.onPrix(x)}
        >
          <span>{x.nom}</span>
          <span className="sm-perte">
            {x.tous ? <Tous /> : null}
            {pertePrix(x)}
          </span>
        </button>
      ))}

      <span className="eyebrow sm-groupe">Récupérer</span>
      <div className="sm-recups">
        {p.r.recups.map((rec) => {
          const faits = p.recupsFaites[rec.id] ?? []
          /* Une fois par scène ou par nuit, et déjà pris par tous ceux que viserait le clic. */
          const epuise = !!rec.limite && p.vises.length > 0 && p.vises.every((id) => faits.includes(id))
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
              onClick={() => p.onRecup(rec)}
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
