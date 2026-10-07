import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { Pastille } from './Pastille'
import { IconFolder, IconPeople, IconPen, IconPlus, IconTrash } from './Icons'
import { PION_COULEURS } from '@shared/types'
import type { CampaignPlayer, CarnetPlayer } from '@shared/types'
import type { UiFolder } from '../../../../preload/index'

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
    folderRel?: string | null
  }): Promise<void> => {
    await window.jdr.timeline.updateSession(seance.id, patch)
    await s.refreshTimeline()
  }

  /* Les dossiers de séance se rangent d'ordinaire à la racine de la campagne,
     parfois un cran plus bas : au-delà, on proposerait tous les sous-dossiers
     de bruitages, et on ne trouverait plus rien. */
  const dossiers = dossiersDeSeance(s.arbreComplet)
  const pris = new Map(
    s.sessions.filter((x) => x.id !== seance.id && x.folderRel).map((x) => [x.folderRel!, x.label])
  )
  const perdu = !!seance.folderRel && !dossiers.some((d) => d.rel === seance.folderRel)

  const joueurs = s.characters.filter((c) => c.kind === 'pj' && !c.horsJeu)
  const presents = joueurs.filter((c) => c.present).length
  const basculer = async (id: number, present: boolean): Promise<void> => {
    await window.jdr.characters.setPresent(id, present)
    await s.refreshCharacters()
  }

  const supprimer = async (): Promise<void> => {
    const r = await window.jdr.timeline.deleteSession(seance.id)
    if (!r.ok) {
      s.toast(r.raison ?? 'Suppression impossible', true)
      return
    }
    await s.refreshSeance()
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

      <PlaceDeLaSeance key={seance.id} id={seance.id} />

      <div className="field">
        <label htmlFor="fs-dossier">Dossier de la séance</label>
        <select
          id="fs-dossier"
          value={seance.folderRel ?? ''}
          onChange={(e) => void poser({ folderRel: e.target.value || null })}
        >
          <option value="">— toute la campagne —</option>
          {perdu ? <option value={seance.folderRel!}>{seance.folderRel} (introuvable)</option> : null}
          {dossiers.map((d) => (
            <option key={d.rel} value={d.rel}>
              {d.libelle}
              {pris.has(d.rel) ? ` · ${pris.get(d.rel)}` : ''}
            </option>
          ))}
        </select>
        <p className="expli">
          {perdu
            ? 'Ce dossier a été renommé ou déplacé hors de l’application : choisis-le de nouveau.'
            : 'Les dossiers des autres séances disparaissent de la bibliothèque et des choix de fichiers ; ce qui est rangé à la racine de la campagne reste là.'}
        </p>
      </div>

      {joueurs.length ? (
        <div className="field">
          <label>
            Présents à cette séance · {presents} sur {joueurs.length}
          </label>
          <div className="tagbar">
            {joueurs.map((c) => (
              <button
                key={c.id}
                className="chip"
                aria-pressed={c.present}
                onClick={() => void basculer(c.id, !c.present)}
                title={c.present ? 'Présent — cliquer pour le noter absent' : 'Absent — cliquer pour le noter présent'}
              >
                {c.name}
                {c.player ? ` · ${c.player}` : ''}
              </button>
            ))}
          </div>
          <p className="expli">
            Un absent sort des fiches, de la bande des joueurs, du jet rapide, de l’écran et des
            pions à poser. Il reste inscrit à la campagne, et retrouve sa fiche à la séance suivante.
          </p>
        </div>
      ) : null}

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
   Dupliquer une séance
   ============================================================ */

/**
 * Une séance neuve, copiée d'une autre : on choisit laquelle — la dernière
 * créée d'abord —, le dossier qu'on recopie avec elle et le nom de sa copie,
 * qui devient le dossier de la nouvelle séance. La fenêtre ne se ferme pas
 * tant que la copie court : elle continuerait de toute façon, sans personne
 * pour en voir la fin.
 */
export function DupliquerSeance({ onClose }: { onClose: () => void }): JSX.Element {
  const s = useStore()
  const derniere = [...s.sessions].sort((a, b) => b.id - a.id)[0]
  const [srcId, setSrcId] = useState(derniere?.id ?? 0)
  const [dossier, setDossier] = useState(derniere?.folderRel ?? '')
  const [label, setLabel] = useState('Séance ' + (s.sessions.length + 1))
  const [nomDossier, setNomDossier] = useState<string | null>(null)
  const [prog, setProg] = useState<{ etape: 'fichiers' | 'seance'; fait: number; total: number } | null>(null)

  /* Une fenêtre de dev lancée avant ce code a un preload qui ne connaît pas
     encore la progression : sans le `?.`, tout l'écran tombait au noir. */
  useEffect(() => window.jdr.timeline.onProgression?.(setProg), [])

  const enCours = prog !== null
  const nom = nomDossier ?? label
  const dossiers = dossiersDeSeance(s.arbreComplet)
  if (dossier && !dossiers.some((d) => d.rel === dossier)) dossiers.unshift({ rel: dossier, libelle: dossier })

  const choisirSource = (id: number): void => {
    setSrcId(id)
    setDossier(s.sessions.find((x) => x.id === id)?.folderRel ?? '')
  }

  const dupliquer = async (): Promise<void> => {
    if (!srcId || enCours) return
    setProg({ etape: dossier ? 'fichiers' : 'seance', fait: 0, total: 1 })
    try {
      const neuve = await window.jdr.timeline.dupliquerSeance(srcId, label.trim(), dossier || null, nom.trim())
      await s.refreshSeance()
      s.toast(`« ${neuve.label} » est prête`)
      onClose()
    } catch (e) {
      setProg(null)
      s.toast(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : 'Duplication impossible', true)
    }
  }

  /* Les fichiers font l'essentiel du chemin ; la séance, en base, le dernier pas. */
  const part = !prog
    ? 0
    : prog.etape === 'fichiers'
      ? (prog.fait / (prog.total || 1)) * 0.95
      : 0.95 + 0.05 * (prog.fait / (prog.total || 1))
  const mo = (b: number): string => `${(b / 1024 / 1024).toFixed(1)} Mo`

  return (
    <Fenetre
      titre="Dupliquer une séance"
      icone={<IconPlus />}
      onClose={() => {
        if (!enCours) onClose()
      }}
      pied={
        <>
          <button className="btn" disabled={enCours} onClick={onClose}>
            Annuler
          </button>
          <button
            className="btn btn-primary"
            disabled={enCours || !srcId || !label.trim() || (!!dossier && !nom.trim())}
            onClick={() => void dupliquer()}
          >
            Dupliquer
          </button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="ds-source">Séance à dupliquer</label>
        <select
          id="ds-source"
          value={srcId}
          disabled={enCours}
          onChange={(e) => choisirSource(Number(e.target.value))}
        >
          {s.sessions.map((x) => (
            <option key={x.id} value={x.id}>
              {x.label}
              {x.id === derniere?.id ? ' · la dernière créée' : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="ds-nom">Nom de la nouvelle séance</label>
        <input
          id="ds-nom"
          type="text"
          value={label}
          disabled={enCours}
          onChange={(e) => setLabel(e.target.value)}
        />
      </div>

      <div className="deux">
        <div className="field">
          <label htmlFor="ds-dossier">Dossier à dupliquer</label>
          <select
            id="ds-dossier"
            value={dossier}
            disabled={enCours}
            onChange={(e) => setDossier(e.target.value)}
          >
            <option value="">— aucun, pas de fichiers —</option>
            {dossiers.map((d) => (
              <option key={d.rel} value={d.rel}>
                {d.libelle}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="ds-copie">Nom de la copie</label>
          <input
            id="ds-copie"
            type="text"
            value={nom}
            disabled={enCours || !dossier}
            onChange={(e) => setNomDossier(e.target.value)}
          />
        </div>
      </div>
      <p className="expli">
        {dossier
          ? `« ${dossier} » est recopié à côté de lui sous le nom « ${nom.trim() || '…'} », qui devient le dossier de la nouvelle séance. Plans, portraits et textes des moments pointent sur la copie.`
          : 'Sans dossier, la nouvelle séance garde les mêmes fichiers que l’autre.'}{' '}
        Lieux (non découverts, sans pions), PNJ, moments (aucun joué) et notes sont repris ; les
        joueurs arrivent avec leur état le plus récent.
      </p>

      {prog ? (
        <div className="dupli-avance" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(part * 100)}>
          <div className="dupli-piste">
            <span style={{ width: `${part * 100}%` }} />
          </div>
          <span className="dupli-etape">
            {prog.etape === 'fichiers'
              ? `Copie des fichiers · ${mo(prog.fait)} sur ${mo(prog.total)}`
              : 'Copie des lieux, des PNJ et des moments…'}
          </span>
        </div>
      ) : null}
    </Fenetre>
  )
}

/**
 * Où la séance se range parmi les autres : juste avant ou juste après l'une
 * d'elles. C'est l'ordre de la liste, et celui qui dit « la séance d'avant »
 * — l'état des joueurs qu'on recopie en entrant, le hors-jeu.
 */
function PlaceDeLaSeance({ id }: { id: number }): JSX.Element | null {
  const s = useStore()
  const rang = s.sessions.findIndex((x) => x.id === id)
  const autres = s.sessions.filter((x) => x.id !== id)
  /* Par défaut, la position qu'elle occupe déjà : après celle qui la précède. */
  const [sens, setSens] = useState<'avant' | 'apres'>(rang > 0 ? 'apres' : 'avant')
  const [refId, setRefId] = useState(
    (rang > 0 ? s.sessions[rang - 1]?.id : s.sessions[rang + 1]?.id) ?? 0
  )
  if (!autres.length) return null

  const placer = async (): Promise<void> => {
    if (!refId) return
    await window.jdr.timeline.placerSeance(id, refId, sens)
    await s.refreshTimeline()
    await s.refreshCharacters()
  }

  return (
    <div className="field">
      <label htmlFor="fs-place">
        Place dans la campagne · {rang + 1}
        {rang === 0 ? 'ʳᵉ' : 'ᵉ'} sur {s.sessions.length}
      </label>
      <div className="place-seance">
        <select value={sens} onChange={(e) => setSens(e.target.value as 'avant' | 'apres')}>
          <option value="avant">Avant</option>
          <option value="apres">Après</option>
        </select>
        <select id="fs-place" value={refId} onChange={(e) => setRefId(Number(e.target.value))}>
          {autres.map((x) => (
            <option key={x.id} value={x.id}>
              {x.label}
            </option>
          ))}
        </select>
        <button className="btn btn-sm" onClick={() => void placer()}>
          Placer
        </button>
      </div>
      <p className="expli">
        L’ordre de la liste est aussi celui qui dit quelle séance vient avant : c’est d’elle que les
        joueurs reprennent leur état quand on entre dans une séance pour la première fois.
      </p>
    </div>
  )
}

function dossiersDeSeance(
  arbre: UiFolder[],
  prefixe = '',
  reste = 2
): { rel: string; libelle: string }[] {
  if (!reste) return []
  return arbre.flatMap((f) => [
    { rel: f.relPath, libelle: prefixe + f.name },
    ...dossiersDeSeance(f.children, prefixe + '   ', reste - 1)
  ])
}

/* ============================================================
   Le carnet de joueurs — hors projet
   ============================================================ */

export function Carnet({ onClose }: { onClose: () => void }): JSX.Element {
  const s = useStore()
  const [nouveau, setNouveau] = useState('')
  const [voirMasques, setVoirMasques] = useState(false)

  const inscrits = new Map(s.players.map((p) => [p.uid, p]))
  const masques = s.carnet.filter((c) => c.masque).length
  const vus = s.carnet.filter((c) => voirMasques || !c.masque)

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
        {vus.map((c) => (
          <LigneCarnet key={c.uid} c={c} inscrit={inscrits.get(c.uid) ?? null} onGeste={geste} />
        ))}
        {s.carnet.length === 0 ? <p className="rien">Le carnet est vide.</p> : null}
      </div>
      {masques ? (
        <button className="btn btn-sm btn-ghost" onClick={() => setVoirMasques(!voirMasques)}>
          {voirMasques
            ? 'Ranger les masqués'
            : `Voir les masqués · ${masques}`}
        </button>
      ) : null}

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
  const [nom, setNom] = useState(c.name)
  const [confirme, setConfirme] = useState(false)
  useEffect(() => setNom(c.name), [c.name])

  /* Inscrite, on la renomme par la campagne : son personnage reprend le nom
     aussitôt. Sinon, le carnet seul. */
  const renommer = (): void => {
    const n = nom.trim()
    if (!n || n === c.name) return setNom(c.name)
    void onGeste(() =>
      inscrit ? window.jdr.players.update(inscrit.id, { name: n }) : window.jdr.players.renameCarnet(c.uid, n)
    )
  }

  /* On ne supprime que quelqu'un qui ne tient rien : sans personnage, elle
     n'a laissé de trace dans aucune séance. Celle qui mène quelqu'un se
     masque — ou se voit d'abord retirer son personnage, dans la fiche. */
  const supprimer = (): void =>
    void onGeste(async () => {
      if (inscrit) await window.jdr.players.remove(inscrit.id)
      await window.jdr.players.deleteFromCarnet(c.uid)
    })

  return (
    <div className={`ligne-carnet${inscrit && !c.masque ? '' : ' dehors'}`}>
      <Pastille nom={c.name} couleur={c.color} grand />
      <span className="qui">
        <input
          className="nom"
          type="text"
          value={nom}
          aria-label={`Nom de ${c.name}`}
          onChange={(e) => setNom(e.target.value)}
          onBlur={renommer}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            if (e.key === 'Escape') setNom(c.name)
          }}
        />
        <span>
          {inscrit
            ? perso
              ? `à cette table · mène ${perso.name}`
              : 'à cette table · sans personnage'
            : 'pas inscrit à cette campagne'}
        </span>
      </span>
      {/* Masquer range la personne hors de la vue : ses personnages restent
          les siens. */}
      {inscrit ? (
        <button
          className="btn btn-sm btn-ghost"
          title={c.masque ? 'La remettre dans la liste' : 'La ranger hors de la liste — elle garde ses inscriptions et ses personnages'}
          onClick={() => void onGeste(() => window.jdr.players.masquer(c.uid, !c.masque))}
        >
          {c.masque ? 'Afficher' : 'Masquer'}
        </button>
      ) : (
        <button
          className="btn btn-sm"
          onClick={() => void onGeste(() => window.jdr.players.enroll(c.uid))}
        >
          Inscrire
        </button>
      )}
      {confirme ? (
        <span className="suppr">
          <button className="btn btn-sm btn-ghost" onClick={() => setConfirme(false)}>
            Non
          </button>
          <button className="btn btn-sm btn-danger" onClick={supprimer}>
            Supprimer
          </button>
        </span>
      ) : (
        <button
          className="btn btn-sm btn-ghost"
          disabled={!!perso}
          title={
            perso
              ? `${c.name} mène ${perso.name} : retire-lui d’abord son personnage, ou masque-la`
              : `Supprimer ${c.name} du carnet`
          }
          aria-label={`Supprimer ${c.name}`}
          onClick={() => setConfirme(true)}
        >
          <IconTrash />
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
  pied,
  children
}: {
  titre: string
  icone: JSX.Element
  large?: boolean
  onClose: () => void
  /** Les boutons du pied, à la place de « Terminé ». */
  pied?: React.ReactNode
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
          {pied ?? (
            <button className="btn btn-primary" onClick={onClose}>
              Terminé
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}
