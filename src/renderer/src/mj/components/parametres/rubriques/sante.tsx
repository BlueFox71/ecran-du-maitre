import { useEffect, useState } from 'react'
import { useStore } from '../../../store'
import { Confirmer } from '../../Rangement'
import { SM_DEFAUT, type Choc, type Palier, type Prix, type Recup, type ReglageSm } from '@shared/santeMentale'
import type { Reglage } from '../registre'
import { SanteMentale, sansFiche, useFiche } from './regles'
import { Evenements } from './smEvenements'

/* ============================================================
   Santé mentale
   ============================================================ */

/** La dernière écriture du réglage : la suivante part d'elle, pas d'avant. */
let enCours: Promise<void> = Promise.resolve()

/**
 * Écrit un morceau du réglage : toujours sur la valeur la plus fraîche, pour
 * que deux retouches de suite ne s'écrasent pas. Les écritures passent une à
 * une ; un patch en fonction se calcule sur le réglage tel que la précédente
 * l'a laissé (un blur puis un clic sur « + » : le clic garde la saisie).
 */
export function poserSm(patch: Partial<ReglageSm> | ((sm: ReglageSm) => Partial<ReglageSm>)): Promise<void> {
  const ecrire = async (): Promise<void> => {
    const s = useStore.getState()
    const p = typeof patch === 'function' ? patch(s.reglages.sm) : patch
    await s.poserReglage('sm', JSON.stringify({ ...s.reglages.sm, ...p }))
  }
  const fait = enCours.then(ecrire, ecrire)
  enCours = fait.catch(() => undefined)
  return fait
}

const actif = (s: ReturnType<typeof useStore.getState>): boolean => s.reglages.sm.actif
const nouvelId = (): string => `n${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`

/* ---------------- les champs : ils n'écrivent qu'au blur ---------------- */

export function Txt({
  v,
  onCommit,
  large,
  label
}: {
  v: string
  onCommit: (v: string) => void
  large?: boolean
  label: string
}): JSX.Element {
  const [t, setT] = useState(v)
  useEffect(() => setT(v), [v])
  return (
    <input
      type="text"
      className={large ? 'sm-large' : undefined}
      value={t}
      aria-label={label}
      onChange={(e) => setT(e.target.value)}
      onBlur={() => t !== v && onCommit(t)}
    />
  )
}

/** Un nombre ; vide, il vaut `null` si le champ le permet. */
export function Num({
  v,
  onCommit,
  nul,
  label,
  min
}: {
  v: number | null
  onCommit: (v: number | null) => void
  nul?: boolean
  label: string
  min?: number
}): JSX.Element {
  const [t, setT] = useState(v === null ? '' : String(v))
  useEffect(() => setT(v === null ? '' : String(v)), [v])
  const valider = (): void => {
    if (t.trim() === '') {
      if (nul) v !== null && onCommit(null)
      else setT(v === null ? '' : String(v))
      return
    }
    const n = Number(t)
    if (!Number.isFinite(n)) return setT(v === null ? '' : String(v))
    if (n !== v) onCommit(n)
  }
  return (
    <input
      type="number"
      className="sm-num"
      min={min}
      value={t}
      placeholder={nul ? '—' : undefined}
      aria-label={label}
      onChange={(e) => setT(e.target.value)}
      onBlur={valider}
    />
  )
}

export function Champ({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <label className="sm-champ">
      <span>{label}</span>
      {children}
    </label>
  )
}

/* ---------------- l'éditeur de liste, un seul pour toutes ---------------- */

interface ChampListe<T> {
  label: string
  /** `maj` reçoit un patch, ou une fonction de l'élément tel qu'il est au moment d'écrire. */
  rendu: (it: T, maj: (p: Partial<T> | ((x: T) => Partial<T>)) => void) => JSX.Element
}

/** Une retouche de liste, appliquée à la liste la plus fraîche. */
type Retouche<T> = (items: T[]) => T[]

const txt = <T,>(k: keyof T & string, label: string, large?: boolean): ChampListe<T> => ({
  label,
  rendu: (it, maj) => <Txt v={String(it[k] ?? '')} label={label} large={large} onCommit={(v) => maj({ [k]: v } as Partial<T>)} />
})
const num = <T,>(k: keyof T & string, label: string, nul?: boolean): ChampListe<T> => ({
  label,
  rendu: (it, maj) => (
    <Num
      v={(it[k] as number | null) ?? null}
      nul={nul}
      label={label}
      onCommit={(v) => maj({ [k]: v } as Partial<T>)}
    />
  )
})
const oui = <T,>(k: keyof T & string, label: string): ChampListe<T> => ({
  label,
  rendu: (it, maj) => (
    <input
      type="checkbox"
      checked={!!it[k]}
      aria-label={label}
      onChange={(e) => maj({ [k]: e.target.checked } as Partial<T>)}
    />
  )
})
/** Un choix parmi des valeurs fixes ; `null` s'écrit en chaîne vide. */
/* Une teinte se choisit à l'œil : des pastilles, comme celles des monnaies,
   plutôt qu'un menu de noms qu'il faut traduire en couleur. */
const teinte = <T,>(k: keyof T & string, label: string, options: [string, string][]): ChampListe<T> => ({
  label,
  rendu: (it, maj) => (
    <span className="mc-teintes" role="group" aria-label={label}>
      {options.map(([o, nom]) => (
        <button
          key={o}
          type="button"
          aria-pressed={it[k] === o}
          aria-label={nom}
          title={nom}
          style={{ ['--t' as string]: `var(--${o})` }}
          onClick={() => maj({ [k]: o } as Partial<T>)}
        />
      ))}
    </span>
  )
})
const choix = <T,>(k: keyof T & string, label: string, options: [string | null, string][]): ChampListe<T> => ({
  label,
  rendu: (it, maj) => (
    <select
      value={String(it[k] ?? '')}
      aria-label={label}
      onChange={(e) => maj({ [k]: options.find(([o]) => String(o ?? '') === e.target.value)![0] } as Partial<T>)}
    >
      {options.map(([o, nom]) => (
        <option key={String(o ?? '')} value={String(o ?? '')}>
          {nom}
        </option>
      ))}
    </select>
  )
})

function ListeEditeur<T>({
  items,
  onChange,
  champs,
  nouveau,
  ajout
}: {
  items: T[]
  /** Chaque geste est une retouche : rejouée sur la liste à jour, il n'efface pas une saisie en vol. */
  onChange: (f: Retouche<T>) => void
  champs: ChampListe<T>[]
  nouveau: () => T
  ajout: string
}): JSX.Element {
  const remplacer = (i: number, p: Partial<T> | ((x: T) => Partial<T>)): void =>
    onChange((l) => l.map((x, j) => (j === i ? { ...x, ...(typeof p === 'function' ? p(x) : p) } : x)))
  const deplacer = (i: number, d: number): void =>
    onChange((l) => {
      const j = i + d
      if (j < 0 || j >= l.length) return l
      const c = [...l]
      ;[c[i], c[j]] = [c[j], c[i]]
      return c
    })
  return (
    <div className="sm-liste">
      {items.map((it, i) => (
        <div className="sm-rang" key={i}>
          <div className="sm-champs">
            {champs.map((c) => (
              <Champ key={c.label} label={c.label}>
                {c.rendu(it, (p) => remplacer(i, p))}
              </Champ>
            ))}
          </div>
          <div className="sm-outils">
            <button className="btn btn-sm btn-ghost" aria-label="Monter" disabled={i === 0} onClick={() => deplacer(i, -1)}>
              ▲
            </button>
            <button
              className="btn btn-sm btn-ghost"
              aria-label="Descendre"
              disabled={i === items.length - 1}
              onClick={() => deplacer(i, 1)}
            >
              ▼
            </button>
            <button
              className="btn btn-sm btn-ghost"
              aria-label="Retirer"
              title="Retirer"
              onClick={() => onChange((l) => l.filter((_, j) => j !== i))}
            >
              ✕
            </button>
          </div>
        </div>
      ))}
      <div>
        <button className="btn btn-sm" onClick={() => onChange((l) => [...l, nouveau()])}>
          + {ajout}
        </button>
      </div>
    </div>
  )
}

/** Une liste de phrases : le même éditeur, sur des objets `{ t }`. */
function Phrases({
  items,
  onChange,
  ajout
}: {
  items: string[]
  onChange: (f: Retouche<string>) => void
  ajout: string
}): JSX.Element {
  return (
    <ListeEditeur<{ t: string }>
      items={items.map((t) => ({ t }))}
      onChange={(f) => onChange((l) => f(l.map((t) => ({ t }))).map((x) => x.t))}
      champs={[txt('t', 'Texte', true)]}
      nouveau={() => ({ t: '' })}
      ajout={ajout}
    />
  )
}

/* ---------------- le malus d'un palier ---------------- */

function Malus({ it, maj }: { it: Palier; maj: (p: Partial<Palier> | ((x: Palier) => Partial<Palier>)) => void }): JSX.Element {
  const { spec } = useFiche()
  const caracs = spec?.stats ?? []
  const poser = (i: number, p: Partial<Palier['malus'][number]>): void =>
    maj((x) => ({ malus: x.malus.map((m, j) => (j === i ? { ...m, ...p } : m)) }))
  return (
    <span className="sm-malus">
      {it.malus.map((m, i) => (
        <span key={i} className="sm-malus-un">
          <Num v={m.valeur} label="Malus" onCommit={(v) => poser(i, { valeur: v ?? 0 })} />
          <select
            value={m.caracKey ?? ''}
            aria-label="Jet concerné"
            onChange={(e) => poser(i, { caracKey: e.target.value || null })}
          >
            <option value="">tous les jets</option>
            {caracs.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
            {m.caracKey && !caracs.some((c) => c.key === m.caracKey) ? (
              <option value={m.caracKey}>{m.caracKey}</option>
            ) : null}
          </select>
          <button
            className="btn btn-sm btn-ghost"
            aria-label="Retirer le malus"
            onClick={() => maj((x) => ({ malus: x.malus.filter((_, j) => j !== i) }))}
          >
            ✕
          </button>
        </span>
      ))}
      <button className="btn btn-sm btn-ghost" onClick={() => maj((x) => ({ malus: [...x.malus, { valeur: -1, caracKey: null }] }))}>
        + malus
      </button>
    </span>
  )
}

/* ---------------- les réglages ---------------- */

const COULEURS: [string, string][] = [
  ['moss', 'Mousse'],
  ['brass', 'Laiton'],
  ['iris', 'Iris'],
  ['blood', 'Sang']
]
const LIMITES: [string | null, string][] = [
  [null, 'Aucune'],
  ['scene', 'Par scène'],
  ['nuit', 'Par nuit']
]

function Jet(): JSX.Element {
  const sm = useStore((s) => s.reglages.sm)
  const { spec } = useFiche()
  if (!spec) return sansFiche
  const caracs = spec.stats
  return (
    <div className="sm-champs">
      <Champ label="Jet de">
        <select value={sm.carac} aria-label="Caractéristique du jet" onChange={(e) => void poserSm({ carac: e.target.value })}>
          {caracs.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
          {caracs.some((c) => c.key === sm.carac) ? null : <option value={sm.carac}>{sm.carac}</option>}
        </select>
      </Champ>
      <Champ label="Réussi à partir de">
        <Num v={sm.seuil} label="Total à atteindre pour réussir le jet" onCommit={(v) => void poserSm({ seuil: v ?? 0 })} />
      </Champ>
      <Champ label="Un 20 naturel rend (points)">
        <Num v={sm.gain20} label="Gain sur un 20 naturel" onCommit={(v) => void poserSm({ gain20: v ?? 0 })} />
      </Champ>
      <Champ label="Si réussi, on perd">
        <select
          value={sm.partReussite}
          aria-label="Part de la perte en cas de réussite"
          onChange={(e) => void poserSm({ partReussite: e.target.value as ReglageSm['partReussite'] })}
        >
          <option value="moitie">la moitié</option>
          <option value="tout">tout</option>
          <option value="rien">rien</option>
        </select>
      </Champ>
      <Champ label="Un 1 naturel fait perdre en plus">
        <Num v={sm.surcout1} label="Surcoût sur un 1 naturel" onCommit={(v) => void poserSm({ surcout1: v ?? 0 })} />
      </Champ>
    </div>
  )
}

function Folie(): JSX.Element {
  const f = useStore((s) => s.reglages.sm.folie)
  return (
    <div className="sm-liste">
      <div className="sm-champs">
        <Champ label="Perte d’un coup à partir de">
          <Num v={f.seuil} label="Seuil de folie" onCommit={(v) => void poserSm((sm) => ({ folie: { ...sm.folie, seuil: v ?? 0 } }))} />
        </Champ>
        <Champ label="Durée (min)">
          <Num
            v={f.minutes}
            label="Durée de la folie"
            onCommit={(v) => void poserSm((sm) => ({ folie: { ...sm.folie, minutes: v ?? 0 } }))}
          />
        </Champ>
      </div>
      <Phrases
        items={f.table}
        ajout="Une crise"
        onChange={(g) => void poserSm((sm) => ({ folie: { ...sm.folie, table: g(sm.folie.table) } }))}
      />
    </div>
  )
}

function Pilules(): JSX.Element {
  const sm = useStore((s) => s.reglages.sm)
  const { spec } = useFiche()
  if (!spec) return sansFiche
  const n = sm.nausee
  return (
    <div className="sm-champs">
      <Champ label="Jauge des pilules">
        <select
          value={sm.jaugePilules ?? ''}
          aria-label="Jauge des pilules"
          onChange={(e) => void poserSm({ jaugePilules: e.target.value || null })}
        >
          <option value="">— aucune —</option>
          {spec.gauges.map((g) => (
            <option key={g.key} value={g.key}>
              {g.label}
            </option>
          ))}
          {sm.jaugePilules && !spec.gauges.some((g) => g.key === sm.jaugePilules) ? (
            <option value={sm.jaugePilules}>{sm.jaugePilules}</option>
          ) : null}
        </select>
      </Champ>
      <Champ label="Nausée si deux pilules en (min)">
        <Num v={n.fenetreMin} label="Fenêtre de nausée" onCommit={(v) => void poserSm((sm) => ({ nausee: { ...sm.nausee, fenetreMin: v ?? 0 } }))} />
      </Champ>
      <Champ label="Malus">
        <Num v={n.malus} label="Malus de nausée" onCommit={(v) => void poserSm((sm) => ({ nausee: { ...sm.nausee, malus: v ?? 0 } }))} />
      </Champ>
      <Champ label="Durée (min)">
        <Num v={n.dureeMin} label="Durée de la nausée" onCommit={(v) => void poserSm((sm) => ({ nausee: { ...sm.nausee, dureeMin: v ?? 0 } }))} />
      </Champ>
    </div>
  )
}

function Retablir(): JSX.Element {
  const [demande, setDemande] = useState(false)
  return (
    <>
      <button className="btn btn-sm" onClick={() => setDemande(true)}>
        Rétablir les valeurs de l’annexe
      </button>
      {demande ? (
        <Confirmer
          titre="Rétablir les valeurs de l’annexe ?"
          oui="Rétablir"
          danger
          onOui={async () => {
            await poserSm({ ...SM_DEFAUT, actif: useStore.getState().reglages.sm.actif })
            setDemande(false)
          }}
          onNon={() => setDemande(false)}
        >
          <p>
            Le jet, les paliers, la folie, les hallucinations, les pertes et les remèdes reprennent
            ceux de l’annexe. <b>Tes retouches sont perdues.</b>
          </p>
        </Confirmer>
      ) : null}
    </>
  )
}

/** Une liste du réglage, rangée sous `cle`. */
function liste<T>(cle: keyof ReglageSm, champs: ChampListe<T>[], nouveau: () => T, ajout: string): () => JSX.Element {
  return function Liste() {
    const items = useStore((s) => s.reglages.sm[cle]) as unknown as T[]
    return (
      <ListeEditeur<T>
        items={items}
        champs={champs}
        nouveau={nouveau}
        ajout={ajout}
        onChange={(f) => void poserSm((sm) => ({ [cle]: f(sm[cle] as unknown as T[]) }) as Partial<ReglageSm>)}
      />
    )
  }
}

const Chocs = liste<Choc>(
  'chocs',
  [txt('nom', 'Nom'), num('perte', 'Perte')],
  () => ({ id: nouvelId(), nom: '', perte: 1 }),
  'Un choc'
)
const Paliers = liste<Palier>(
  'paliers',
  [
    txt('nom', 'Nom'),
    num('min', 'À partir de'),
    teinte('couleur', 'Teinte', COULEURS),
    num('hallucinations', 'Hallucination (min)', true),
    txt('texte', 'Ce que ça change', true),
    { label: 'Malus', rendu: (it, maj) => <Malus it={it} maj={maj} /> }
  ],
  () => ({ id: nouvelId(), nom: '', min: 0, couleur: 'brass', texte: '', malus: [], hallucinations: null }),
  'Un palier'
)
const Prixs = liste<Prix>(
  'prix',
  [txt('nom', 'Nom', true), num('perte', 'Perte'), num('intervalleMin', 'Toutes les (min)', true), oui('tous', 'Tout le groupe')],
  () => ({ id: nouvelId(), nom: '', perte: 1, tous: false, intervalleMin: null }),
  'Un prix'
)
const Recups = liste<Recup>(
  'recups',
  [
    txt('nom', 'Nom', true),
    {
      label: 'Gain (5 ou 1d10)',
      rendu: (it, maj) => (
        <Txt
          v={String(it.gain)}
          label="Gain"
          onCommit={(v) => maj({ gain: /^\s*-?\d+(\.\d+)?\s*$/.test(v) ? Number(v) : v.trim() })}
        />
      )
    },
    choix('limite', 'Limite', LIMITES),
    oui('pilule', 'Pilule'),
    oui('calme', 'Calme la folie')
  ],
  () => ({ id: nouvelId(), nom: '', gain: 5, limite: null, pilule: false, calme: false }),
  'Un remède'
)

type Activite = ReglageSm['activite'][number]
const Activites = liste<Activite>(
  'activite',
  [num('min', 'Moyenne à partir de'), txt('texte', 'Ce que fait la maison', true)],
  () => ({ min: 0, texte: '' }),
  'Une tranche'
)

function Hallucinations(): JSX.Element {
  const l = useStore((s) => s.reglages.sm.hallucinations)
  return (
    <Phrases
      items={l}
      ajout="Une hallucination"
      onChange={(f) => void poserSm((sm) => ({ hallucinations: f(sm.hallucinations) }))}
    />
  )
}
function Rappels(): JSX.Element {
  const l = useStore((s) => s.reglages.sm.rappels)
  return <Phrases items={l} ajout="Un rappel" onChange={(f) => void poserSm((sm) => ({ rappels: f(sm.rappels) }))} />
}

export const reglages: Reglage[] = [
  {
    id: 'sm.actif',
    rubrique: 'sante',
    nom: 'Assistance de santé mentale',
    aide: 'Cochée, la table suit la santé mentale des personnages : le Paravent propose les pertes, les paliers et leurs effets. Les valeurs de départ sont celles de l’annexe.',
    mots: ['sanité', 'sm', 'folie', 'activer', 'assistant', 'peur', 'raison'],
    Cmd: function Actif() {
      const sm = useStore((s) => s.reglages.sm)
      const jamais = useStore((s) => s.reglagesBrut['sm'] === undefined)
      return (
        <input
          type="checkbox"
          checked={sm.actif}
          aria-label="Assistance de santé mentale"
          onChange={(e) => {
            /* Jamais posé : on écrit tout le barème de l'annexe avec l'activation. */
            if (e.target.checked && jamais)
              void poserSm({ ...SM_DEFAUT, actif: true })
                .then(() => window.jdr.sm.semer())
                .then(() => window.dispatchEvent(new Event('jdr:sm-evenements')))
            else void poserSm({ actif: e.target.checked })
          }}
        />
      )
    }
  },
  {
    id: 'sm.jauge',
    rubrique: 'sante',
    visible: actif,
    nom: 'La santé mentale, c’est',
    aide: 'La jauge de la fiche que l’assistance lit et écrit. C’est le même réglage que dans « Règles du jeu ».',
    mots: ['sanité', 'jauge', 'raison', 'encart', 'fiche'],
    Cmd: SanteMentale
  },
  {
    id: 'sm.jet',
    rubrique: 'sante',
    visible: actif,
    nom: 'Le jet',
    aide: 'Le jet qui adoucit une perte. Exemple, un choc à −5 : un total de 12 ou plus, il perd la moitié (−3) ; en dessous, tout (−5) ; un 20 au dé, il ne perd rien et regagne 2 ; un 1 au dé, il perd tout plus 5 (−10).',
    mots: ['volonté', 'jet', 'seuil', 'réussite', 'critique', 'vlt', '20 naturel'],
    pleine: true,
    Cmd: Jet
  },
  {
    id: 'sm.chocs',
    rubrique: 'sante',
    visible: actif,
    nom: 'Les chocs',
    aide: 'Les pertes types, proposées en un geste.',
    mots: ['perte', 'choc', 'petit', 'gros', 'terreur', 'barème'],
    pleine: true,
    Cmd: Chocs
  },
  {
    id: 'sm.paliers',
    rubrique: 'sante',
    visible: actif,
    nom: 'Les paliers',
    aide: 'Chaque palier commence à sa valeur et dure jusqu’au suivant. Ses malus se posent seuls sur la fiche ; la cadence est celle des hallucinations proposées.',
    mots: ['palier', 'seuil', 'malus', 'ébranlé', 'terreur', 'rupture', 'stable', 'effets'],
    pleine: true,
    Cmd: Paliers
  },
  {
    id: 'sm.folie',
    rubrique: 'sante',
    visible: actif,
    nom: 'La folie',
    aide: 'Une perte d’un coup assez lourde déclenche un second jet ; l’échec tire une crise passagère.',
    mots: ['folie', 'crise', 'passagère', 'panique', 'second jet'],
    pleine: true,
    Cmd: Folie
  },
  {
    id: 'sm.hallucinations',
    rubrique: 'sante',
    visible: actif,
    nom: 'Les hallucinations',
    aide: 'Ce que le MJ glisse au joueur, tiré au sort ou choisi.',
    mots: ['hallucination', 'mot secret', 'vision', 'voix', 'murmure'],
    pleine: true,
    Cmd: Hallucinations
  },
  {
    id: 'sm.prix',
    rubrique: 'sante',
    visible: actif,
    nom: 'Prix (sans jet)',
    aide: 'Ce qui coûte de la santé mentale : une fois, ou à chaque intervalle tant que ça dure.',
    mots: ['perte', 'prix', 'coût', 'noir', 'seul', 'ouija', 'spirit box', 'intervalle'],
    pleine: true,
    Cmd: Prixs
  },
  {
    id: 'sm.recups',
    rubrique: 'sante',
    visible: actif,
    nom: 'Les remèdes',
    aide: 'Ce qui en rend : un gain fixe ou au dé, limité ou non. Une pilule se prend dans la jauge des pilules ; « Calme la folie » arrête une crise.',
    mots: ['remède', 'gain', 'pilule', 'récupérer', 'encens', 'prière', 'calme', 'dé'],
    pleine: true,
    Cmd: Recups
  },
  {
    id: 'sm.pilules',
    rubrique: 'sante',
    visible: actif,
    nom: 'Pilules et nausée',
    aide: 'La jauge où l’on compte les pilules, et ce que fait en prendre deux trop près l’une de l’autre.',
    mots: ['pilule', 'nausée', 'jauge', 'malus', 'médicament'],
    pleine: true,
    Cmd: Pilules
  },
  {
    id: 'sm.activite',
    rubrique: 'sante',
    visible: actif,
    nom: 'L’activité de la maison',
    aide: 'Ce que fait le lieu selon la santé mentale moyenne de la table.',
    mots: ['activité', 'maison', 'moyenne', 'entités', 'générateur', 'ombres', 'démon'],
    pleine: true,
    Cmd: Activites
  },
  {
    id: 'sm.rappels',
    rubrique: 'sante',
    visible: actif,
    nom: 'Les rappels',
    aide: 'Les phrases de règle gardées sous la main, dans la vue Santé mentale.',
    mots: ['rappel', 'règle', 'modificateur', 'ambiance', 'mémo'],
    pleine: true,
    Cmd: Rappels
  },
  {
    id: 'sm.evenements',
    rubrique: 'sante',
    visible: actif,
    nom: 'Les événements',
    aide: 'Ce qui, dans chaque séance, peut faire perdre de la raison : la perte proposée, avec ou sans jet, pour un personnage ou pour tous. Chaque séance a sa liste.',
    mots: ['événement', 'séance', 'perte', 'scène', 'jet', 'dupliquer', 'harrow mill'],
    pleine: true,
    Cmd: Evenements
  },
  {
    id: 'sm.retablir',
    rubrique: 'sante',
    visible: actif,
    nom: 'Rétablir l’annexe',
    aide: 'Remet tout ce qui précède aux valeurs de l’annexe. L’assistance reste cochée.',
    mots: ['réinitialiser', 'défaut', 'annexe', 'restaurer', 'remettre'],
    Cmd: Retablir
  }
]
