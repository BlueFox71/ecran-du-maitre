import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { Pastille } from './Pastille'
import { IconClose, IconFolder, IconPeople, IconPen, IconPlus, IconTrash } from './Icons'
import { PION_COULEURS } from '@shared/types'
import type { CampaignPlayer, CarnetPlayer } from '@shared/types'

/* ============================================================
   La campagne : son identité, son dossier, ses joueurs
   ============================================================ */

export function FicheCampagne({
  onClose,
  onCarnet
}: {
  onClose: () => void
  onCarnet: () => void
}): JSX.Element {
  const s = useStore()
  const [nom, setNom] = useState(s.campaign?.name ?? '')
  const [systeme, setSysteme] = useState(s.campaign?.system ?? '')

  /* L'identité s'enregistre quand on quitte le champ : pas de bouton à viser
     pour un nom qu'on corrige d'une lettre. */
  const poser = async (): Promise<void> => {
    const info = await window.jdr.project.update({
      name: nom.trim() || (s.campaign?.name ?? ''),
      system: systeme.trim() || null
    })
    if (info) useStore.setState({ project: info, campaign: info.campaign })
    await s.refreshRecents()
  }

  return (
    <Fenetre titre="La campagne" icone={<IconFolder />} onClose={onClose} large>
      <div className="deux">
        <div className="field">
          <label htmlFor="fc-nom">Nom de la campagne</label>
          <input
            id="fc-nom"
            type="text"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            onBlur={() => void poser()}
          />
        </div>
        <div className="field">
          <label htmlFor="fc-sys">Système</label>
          <input
            id="fc-sys"
            type="text"
            value={systeme}
            placeholder="maison — d20 + carac"
            onChange={(e) => setSysteme(e.target.value)}
            onBlur={() => void poser()}
          />
        </div>
      </div>

      <div className="field">
        <label>Dossier de la campagne</label>
        <div className="chemin-projet">
          <code>{s.project?.dir ?? '—'}</code>
          <button className="btn btn-sm btn-ghost" onClick={() => void window.jdr.project.reveal()}>
            Ouvrir
          </button>
        </div>
        <span className="eyebrow">
          La base vit dans .ecran-du-maitre · tout le reste du dossier est la bibliothèque
        </span>
      </div>

      <ListeJoueurs onCarnet={onCarnet} />
    </Fenetre>
  )
}

/** Les inscrits de la campagne, et le personnage que chacun mène. */
function ListeJoueurs({ onCarnet }: { onCarnet: () => void }): JSX.Element {
  const s = useStore()

  const geste = async (fn: () => Promise<unknown>): Promise<void> => {
    try {
      await fn()
      await s.refreshPlayers()
    } catch (e) {
      s.toast(e instanceof Error ? e.message : 'Geste impossible', true)
    }
  }

  return (
    <div className="bloc-joueurs">
      <div className="bloc-tete">
        <span className="eyebrow">Joueurs de la campagne</span>
        <div className="spacer" />
        <button className="btn btn-sm" onClick={onCarnet}>
          <IconPeople />
          Inscrire un joueur…
        </button>
      </div>

      {s.players.length === 0 ? (
        <p className="rien">
          Personne d’inscrit. Ouvre le carnet pour amener quelqu’un à cette table.
        </p>
      ) : (
        <div className="lignes">
          {s.players.map((p) => (
            <LigneJoueur key={p.id} p={p} onGeste={geste} />
          ))}
        </div>
      )}
    </div>
  )
}

function LigneJoueur({
  p,
  onGeste
}: {
  p: CampaignPlayer
  onGeste: (fn: () => Promise<unknown>) => Promise<void>
}): JSX.Element {
  const s = useStore()
  const [nom, setNom] = useState(p.name)
  const [teintes, setTeintes] = useState(false)
  useEffect(() => setNom(p.name), [p.name])

  /* Un personnage n'est mené que par une personne : ceux que quelqu'un d'autre
     tient déjà ne sont pas proposés. Et un PNJ n'est mené par personne — il est
     au MJ, la base refuse d'ailleurs de le donner. */
  const pris = new Set(s.players.filter((x) => x.id !== p.id).map((x) => x.characterId))
  const libres = s.characters.filter((c) => c.kind !== 'pnj' && !pris.has(c.id))

  return (
    <div className="ligne-joueur">
      <button
        className="jeton-btn"
        title="Couleur du joueur"
        aria-label={`Couleur de ${p.name}`}
        onClick={() => setTeintes((t) => !t)}
      >
        <Pastille nom={p.name} couleur={p.color} grand />
      </button>

      <input
        className="nom"
        type="text"
        value={nom}
        aria-label={`Nom du joueur ${p.name}`}
        onChange={(e) => setNom(e.target.value)}
        onBlur={() => {
          if (nom.trim() && nom.trim() !== p.name)
            void onGeste(() => window.jdr.players.update(p.id, { name: nom.trim() }))
          else setNom(p.name)
        }}
      />

      <select
        aria-label={`Personnage de ${p.name}`}
        value={p.characterId ?? ''}
        onChange={(e) =>
          void onGeste(() =>
            window.jdr.players.setCharacter(p.id, e.target.value ? Number(e.target.value) : null)
          )
        }
      >
        <option value="">— aucun personnage —</option>
        {libres.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <button
        className="btn btn-sm btn-ghost"
        title="Retirer de la campagne — son personnage reste"
        aria-label={`Retirer ${p.name} de la campagne`}
        onClick={() => void onGeste(() => window.jdr.players.remove(p.id))}
      >
        <IconClose />
      </button>

      {teintes ? (
        /* La couleur suit la personne d'une campagne à l'autre, et cercle le
           pion de son personnage sur l'écran des joueurs. */
        <div className="couleurs">
          {PION_COULEURS.map((c) => {
            const par = s.players.find((x) => x.id !== p.id && x.color === c.key)
            return (
              <button
                key={c.key}
                className={`pastille${par ? ' prise' : ''}`}
                style={{ ['--p' as string]: c.hex }}
                aria-pressed={p.color === c.key}
                disabled={!!par}
                title={par ? `${c.name} — déjà à ${par.name}` : c.name}
                onClick={() => {
                  setTeintes(false)
                  void onGeste(() => window.jdr.players.update(p.id, { color: c.key }))
                }}
              />
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

/* ============================================================
   La séance
   ============================================================ */

export function FicheSeance({ onClose }: { onClose: () => void }): JSX.Element {
  const s = useStore()
  const seance = s.session
  const [label, setLabel] = useState(seance?.label ?? '')
  const [date, setDate] = useState(seance?.date ?? '')
  const [notes, setNotes] = useState(seance?.notes ?? '')

  if (!seance) return <></>

  const poser = async (patch: {
    label?: string
    date?: string
    notes?: string | null
  }): Promise<void> => {
    await window.jdr.timeline.updateSession(seance.id, patch)
    await s.refreshTimeline()
  }

  const supprimer = async (): Promise<void> => {
    const r = await window.jdr.timeline.deleteSession(seance.id)
    if (!r.ok) {
      s.toast(r.raison ?? 'Suppression impossible', true)
      return
    }
    await s.refreshTimeline()
    await s.refreshRolls()
    onClose()
  }

  const joues = s.beats.filter((b) => b.done).length

  return (
    <Fenetre titre="La séance" icone={<IconPen />} onClose={onClose}>
      <div className="deux">
        <div className="field">
          <label htmlFor="fs-nom">Nom de la séance</label>
          <input
            id="fs-nom"
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={() => void poser({ label: label.trim() || seance.label })}
          />
        </div>
        <div className="field">
          <label htmlFor="fs-date">Date</label>
          <input
            id="fs-date"
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value)
              if (e.target.value) void poser({ date: e.target.value })
            }}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="fs-notes">Notes du maître de jeu</label>
        <textarea
          id="fs-notes"
          rows={4}
          value={notes}
          placeholder="Où reprendre, ce qu’ils ignorent encore, ce qu’il ne faut pas oublier de dire."
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => void poser({ notes: notes.trim() || null })}
        />
      </div>

      <div className="bloc-tete">
        <span className="eyebrow">
          {s.beats.length} moments · {joues} joués · {s.rollStats.total} jets
        </span>
        <div className="spacer" />
        <button className="btn btn-sm btn-danger" onClick={() => void supprimer()}>
          <IconTrash />
          Supprimer la séance
        </button>
      </div>
    </Fenetre>
  )
}

/* ============================================================
   Le carnet de joueurs — hors projet
   ============================================================ */

export function Carnet({ onClose }: { onClose: () => void }): JSX.Element {
  const s = useStore()
  const [nouveau, setNouveau] = useState('')

  const inscrits = new Map(s.players.map((p) => [p.uid, p]))

  const geste = async (fn: () => Promise<unknown>): Promise<void> => {
    try {
      await fn()
      await s.refreshPlayers()
    } catch (e) {
      s.toast(e instanceof Error ? e.message : 'Geste impossible', true)
    }
  }

  const ajouter = async (): Promise<void> => {
    const nom = nouveau.trim()
    if (!nom) return
    setNouveau('')
    await geste(() => window.jdr.players.create(nom))
  }

  return (
    <Fenetre titre="Carnet de joueurs" icone={<IconPeople />} onClose={onClose}>
      <p className="expli">
        Le carnet appartient à l’application, pas à une campagne : les mêmes personnes te suivent
        d’une table à l’autre, et gardent leur couleur partout.
      </p>

      <div className="lignes">
        {s.carnet.map((c) => (
          <LigneCarnet key={c.uid} c={c} inscrit={inscrits.get(c.uid) ?? null} onGeste={geste} />
        ))}
        {s.carnet.length === 0 ? <p className="rien">Le carnet est vide.</p> : null}
      </div>

      <div className="ajout-joueur">
        <input
          type="text"
          value={nouveau}
          placeholder="Nom d’un nouveau joueur"
          aria-label="Nom d’un nouveau joueur"
          onChange={(e) => setNouveau(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void ajouter()
          }}
        />
        <button className="btn btn-sm" disabled={!nouveau.trim()} onClick={() => void ajouter()}>
          <IconPlus />
          Ajouter et inscrire
        </button>
      </div>
    </Fenetre>
  )
}

function LigneCarnet({
  c,
  inscrit,
  onGeste
}: {
  c: CarnetPlayer
  inscrit: CampaignPlayer | null
  onGeste: (fn: () => Promise<unknown>) => Promise<void>
}): JSX.Element {
  const s = useStore()
  const perso = inscrit ? s.characters.find((x) => x.id === inscrit.characterId) : null

  return (
    <div className={`ligne-carnet${inscrit ? '' : ' dehors'}`}>
      <Pastille nom={c.name} couleur={c.color} grand />
      <span className="qui">
        <b>{c.name}</b>
        <span>
          {inscrit
            ? perso
              ? `à cette table · mène ${perso.name}`
              : 'à cette table · sans personnage'
            : 'pas inscrit à cette campagne'}
        </span>
      </span>
      {inscrit ? (
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => void onGeste(() => window.jdr.players.remove(inscrit.id))}
        >
          Retirer
        </button>
      ) : (
        <button
          className="btn btn-sm"
          onClick={() => void onGeste(() => window.jdr.players.enroll(c.uid))}
        >
          Inscrire
        </button>
      )}
    </div>
  )
}

/* ============================================================
   L'enveloppe commune
   ============================================================ */

export function Fenetre({
  titre,
  icone,
  large,
  onClose,
  children
}: {
  titre: string
  icone: JSX.Element
  large?: boolean
  onClose: () => void
  children: React.ReactNode
}): JSX.Element {
  useEffect(() => {
    const touche = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', touche)
    return () => document.removeEventListener('keydown', touche)
  }, [onClose])

  return (
    <div className="scrim" onClick={onClose}>
      <div
        className={`modal fiche-projet${large ? ' large' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={titre}
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          {icone}
          <h3>{titre}</h3>
        </header>
        <div className="body">{children}</div>
        <footer>
          <button className="btn btn-primary" onClick={onClose}>
            Terminé
          </button>
        </footer>
      </div>
    </div>
  )
}
