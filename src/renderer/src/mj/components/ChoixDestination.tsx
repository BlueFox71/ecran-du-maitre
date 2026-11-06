/**
 * Où va un exemplaire : le choix commun à « Poser… » (un exemplaire neuf,
 * sorti de la réserve) et à « Donner à… » (un exemplaire qui change de main).
 *
 * Le même menu des deux côtés : une recherche, les joueurs présents, les PNJ
 * et les lieux — repliés tant qu'on ne les ouvre pas ou qu'on ne cherche
 * pas —, les inventaires partagés si l'appelant les accepte, et la corbeille
 * tout en bas. Là où
 * l'exemplaire se trouve déjà ne figure pas : on ne donne pas une chose à
 * celui qui l'a.
 *
 * Quand il y en a plusieurs, on choisit ensuite combien — un par défaut, le
 * plus courant : deux bougies sur
 * six, les quatre autres restent où elles sont.
 */
import { useState } from 'react'
import { useStore } from '../store'
import { Pop } from './Pop'
import { IconChevron, IconClose, IconDonner, IconPoser, IconSearch, IconTrash } from './Icons'

export type Destination =
  | { port: 'pj' | 'pnj'; characterId: number }
  | { port: 'lieu'; placeId: number }
  | { port: 'inventaire'; inventaireId: number }
  | { port: 'corbeille' }

export function ChoixDestination({
  x,
  y,
  verbe,
  max,
  exclure = {},
  inventaires: avecInventaires = false,
  onChoisir,
  onClose
}: {
  x: number
  y: number
  /** Le mot du geste, sur le bouton de l'étape « Combien ? ». */
  verbe: 'poser' | 'donner'
  /** Combien on peut en déplacer ; 1 ou moins, pas d'étape « Combien ? ». */
  max: number
  /** Là où il est déjà : absent de la liste. */
  exclure?: { characterId?: number | null; placeId?: number | null; inventaireId?: number | null }
  /** Proposer les inventaires partagés (le camion, la malle). */
  inventaires?: boolean
  /** `qte` absent : tout. Le menu est déjà fermé quand il est appelé. */
  onChoisir: (d: Destination, qte?: number) => void | Promise<void>
  onClose: () => void
}): JSX.Element {
  const s = useStore()
  const [q, setQ] = useState('')
  const [vers, setVers] = useState<{ d: Destination; nom: string } | null>(null)
  const [combien, setCombien] = useState(1)
  /* PNJ et lieux, repliés au départ : la liste des lieux noierait le reste.
     Une recherche les déplie d'elle-même. */
  const [ouverts, setOuverts] = useState<{ pnj: boolean; lieu: boolean }>({ pnj: false, lieu: false })

  /* On cherche comme on parle : sans les accents ni les majuscules —
     « cave » trouve « Cave à vin », « Caveau ». */
  const plat = (t: string): string =>
    t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('fr-FR')
  const mot = plat(q.trim())
  const garde = (nom: string): boolean => mot === '' || plat(nom).includes(mot)

  const pjs = s.characters.filter(
    (c) => c.kind !== 'pnj' && c.present && c.id !== exclure.characterId && garde(c.name)
  )
  const pnjs = s.characters.filter((c) => c.kind === 'pnj' && c.id !== exclure.characterId && garde(c.name))
  const lieux = s.places.filter((l) => l.id !== exclure.placeId && garde(l.name))
  const invs = avecInventaires
    ? s.inventaires.filter((i) => i.id !== exclure.inventaireId && garde(i.nom))
    : []
  const corbeille = garde('corbeille')

  const fini = (d: Destination, qte?: number): void => {
    onClose()
    void onChoisir(d, qte)
  }
  const choisir = (d: Destination, nom: string): void => {
    if (max <= 1) return fini(d)
    setCombien(1) // le minimum : on en prend un, on monte si besoin
    setVers({ d, nom })
  }

  /* Entrée choisit le premier qui répond : un mot, Entrée, c'est fait. */
  const premier = (): void => {
    if (pjs[0]) choisir({ port: 'pj', characterId: pjs[0].id }, `Dans les mains de ${pjs[0].name}`)
    else if (pnjs[0]) choisir({ port: 'pnj', characterId: pnjs[0].id }, `Sur ${pnjs[0].name}`)
    else if (lieux[0]) choisir({ port: 'lieu', placeId: lieux[0].id }, `Le poser dans ${lieux[0].name}`)
    else if (invs[0]) choisir({ port: 'inventaire', inventaireId: invs[0].id }, `Le ranger dans ${invs[0].nom}`)
    else if (corbeille) choisir({ port: 'corbeille' }, 'À la corbeille')
  }

  if (vers) {
    const n = Math.min(max, Math.max(1, combien || 1))
    const valider = (): void => fini(vers.d, n)
    const jeter = vers.d.port === 'corbeille'
    const libelle = jeter
      ? n >= max
        ? 'Tout jeter'
        : `Jeter ${n}`
      : verbe === 'donner'
        ? n >= max
          ? 'Tout donner'
          : `Donner ${n}`
        : `Poser ${n}`
    return (
      <Pop x={x} y={y} className="menu-donner poser-combien" onClose={onClose}>
        <span className="eyebrow">{vers.nom}</span>
        <label className="pc-ligne">
          <span>Combien&nbsp;?</span>
          <span className="inv-qte">
            <button disabled={n <= 1} onClick={() => setCombien(n - 1)} aria-label="Un de moins">
              −
            </button>
            <input
              className="num"
              type="number"
              min={1}
              max={max}
              autoFocus
              value={combien}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => setCombien(Math.trunc(Number(e.target.value)) || 0)}
              onKeyDown={(e) => e.key === 'Enter' && valider()}
              aria-label="Combien"
            />
            <button disabled={n >= max} onClick={() => setCombien(n + 1)} aria-label="Un de plus">
              +
            </button>
          </span>
          <span className="pc-sur num">sur {max}</span>
        </label>
        <div className="pc-pied">
          <button className="btn btn-sm btn-ghost" onClick={() => setVers(null)}>
            Retour
          </button>
          <div className="spacer" />
          <button className="btn btn-sm btn-brass" onClick={valider}>
            {jeter ? <IconTrash /> : verbe === 'donner' ? <IconDonner /> : <IconPoser />}
            {libelle}
          </button>
        </div>
      </Pop>
    )
  }

  const rien = mot ? <p className="pop-rien">Aucun nom ne correspond.</p> : null
  const deplie = (k: 'pnj' | 'lieu'): boolean => mot !== '' || ouverts[k]
  const titreRepli = (k: 'pnj' | 'lieu', titre: string, n: number): JSX.Element => (
    <button
      type="button"
      className="eyebrow cd-repli"
      aria-expanded={deplie(k)}
      onClick={() => setOuverts((o) => ({ ...o, [k]: !o[k] }))}
      disabled={mot !== ''}
    >
      <IconChevron />
      {titre}
      <span className="cd-n num">{n}</span>
    </button>
  )

  return (
    <Pop x={x} y={y} className="menu-donner" onClose={onClose}>
      <button className="md-fermer" onClick={onClose} title="Fermer — Échap" aria-label="Fermer">
        <IconClose />
      </button>
      <label className="filtre-inline pop-cherche">
        <IconSearch />
        <input
          type="text"
          autoFocus
          value={q}
          placeholder="Chercher un joueur, un PNJ, un lieu"
          aria-label="Chercher où le mettre"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && premier()}
        />
      </label>

      <span className="eyebrow">Dans les mains de</span>
      {pjs.length === 0 ? rien ?? <p className="pop-rien">Aucun personnage joueur.</p> : null}
      {pjs.map((c) => (
        <button
          key={c.id}
          className={`opt c-${c.color ?? 'neutral'}`}
          onClick={() => choisir({ port: 'pj', characterId: c.id }, `Dans les mains de ${c.name}`)}
        >
          <span className="pip" />
          {c.name}
        </button>
      ))}

      {pnjs.length ? (
        <>
          <hr />
          {titreRepli('pnj', 'Sur un PNJ', pnjs.length)}
          {deplie('pnj') && pnjs.map((c) => (
            <button
              key={c.id}
              className={`opt c-${c.color ?? 'neutral'}`}
              onClick={() => choisir({ port: 'pnj', characterId: c.id }, `Sur ${c.name}`)}
            >
              <span className="pip" />
              {c.name}
            </button>
          ))}
        </>
      ) : null}

      {lieux.length ? (
        <>
          <hr />
          {titreRepli('lieu', 'Le poser dans', lieux.length)}
          {deplie('lieu') && lieux.map((l) => (
            <button
              key={l.id}
              className="opt"
              onClick={() => choisir({ port: 'lieu', placeId: l.id }, `Le poser dans ${l.name}`)}
            >
              {l.name}
            </button>
          ))}
        </>
      ) : null}

      {invs.length ? (
        <>
          <hr />
          <span className="eyebrow">Le ranger dans</span>
          {invs.map((i) => (
            <button
              key={i.id}
              className="opt"
              onClick={() => choisir({ port: 'inventaire', inventaireId: i.id }, `Le ranger dans ${i.nom}`)}
            >
              {i.nom}
            </button>
          ))}
        </>
      ) : null}

      {/* Un exemplaire perdu, détruit, consommé : il existe, mais nulle part. */}
      {corbeille ? (
        <>
          <hr />
          <button className="opt" onClick={() => choisir({ port: 'corbeille' }, 'À la corbeille')}>
            <IconTrash />
            Corbeille
          </button>
        </>
      ) : null}
    </Pop>
  )
}
