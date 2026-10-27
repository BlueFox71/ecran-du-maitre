import { useState } from 'react'
import type { Choc, EvenementSm, Prix, Recup, ReglageSm } from '@shared/santeMentale'
import { normaliser } from '../components/parametres/chercher'

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
  /** `ou` : sous le bouton cliqué, là où poser le choix des joueurs. */
  onPrix: (p: Prix, ou: { x: number; y: number }) => void
  onRecup: (rec: Recup) => void
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
  const [deplie, setDeplie] = useState(false)
  const [q, setQ] = useState('')
  const requete = normaliser(q)
  const cherche = requete.length > 0

  const evenements = cherche ? p.evenements.filter((e) => correspond(requete, e.nom, e.note)) : p.evenements
  const prix = cherche ? p.r.prix.filter((x) => correspond(requete, x.nom)) : p.r.prix
  const recups = cherche ? p.r.recups.filter((x) => correspond(requete, x.nom)) : p.r.recups
  /* Une recherche montre tout ce qu'elle trouve : pas de « N autres… » à déplier. */
  const evts = deplie || cherche ? evenements : evenements.slice(0, VISIBLES)
  const caches = cherche ? 0 : evenements.length - VISIBLES

  return (
    <div className="sm-bareme">
      <input
        type="search"
        className="sm-chercher"
        placeholder="Chercher un événement, un prix…"
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
      {cherche && !evenements.length && !prix.length && !recups.length ? (
        <p className="sm-vide">Rien pour « {q} ».</p>
      ) : null}

      {cherche ? null : (
        <>
          <span className="eyebrow">Choc (jet de Volonté)</span>
          <div className="sm-chocs">
            {p.r.chocs.map((c) => (
              <button key={c.id} type="button" className="btn btn-sm btn-c" onClick={() => p.onChoc(c)}>
                {c.nom} {moins(c.perte)}
              </button>
            ))}
          </div>
        </>
      )}

      {cherche && !evenements.length ? null : <span className="eyebrow sm-groupe">Événements de la séance</span>}
      {!cherche && p.evenements.length === 0 ? <p className="sm-vide">Aucun événement pour cette séance.</p> : null}
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

      {cherche && !prix.length ? null : <span className="eyebrow sm-groupe">Prix (sans jet)</span>}
      {prix.map((x) => (
        <button
          key={x.id}
          type="button"
          className="sm-it"
          title={x.intervalleMin ? 'Lance un chrono sur le joueur, jusqu’à ce que tu l’arrêtes' : undefined}
          onClick={(ev) => {
            const b = ev.currentTarget.getBoundingClientRect()
            p.onPrix(x, { x: b.left, y: b.bottom + 4 })
          }}
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
