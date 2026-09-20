import { useMemo, useState } from 'react'
import { useStore } from '../store'
import {
  IconCheck,
  IconChevron,
  IconClose,
  IconDoc,
  IconFolder,
  IconLink,
  IconPen,
  IconPlus,
  IconSearch,
  IconTrash
} from '../components/Icons'
import type { UiFolder, UiItem } from '../../../../preload/index'
import type { Beat, Place } from '@shared/types'

/* ============================================================
   Chronologie : suivre sa séance, pas piloter l'écran.
   On choisit un moment ou un lieu, et on lit ce qu'on doit dire.
   ============================================================ */

type Pick = { kind: 'beat'; id: number } | { kind: 'place'; id: number } | null

export function Timeline(): JSX.Element {
  const s = useStore()
  const [tab, setTab] = useState<'moments' | 'lieux'>('moments')
  const [pick, setPick] = useState<Pick>(null)
  const [editing, setEditing] = useState(false)
  const [annexes, setAnnexes] = useState(true)

  const current: Pick = pick ?? (s.beats.length ? { kind: 'beat', id: s.beats[0].id } : null)
  const beat = current?.kind === 'beat' ? s.beats.find((b) => b.id === current.id) ?? null : null
  const place = current?.kind === 'place' ? s.places.find((p) => p.id === current.id) ?? null : null

  const addBeat = async (): Promise<void> => {
    const last = s.beats[s.beats.length - 1]
    const b = await window.jdr.timeline.upsertBeat({
      title: 'Nouveau moment',
      atTime: nextTime(last?.atTime ?? null)
    })
    await s.refreshTimeline()
    setPick({ kind: 'beat', id: b.id })
    setEditing(true)
  }

  const setDone = async (b: Beat, done: boolean): Promise<void> => {
    await window.jdr.timeline.upsertBeat({
      id: b.id,
      title: b.title,
      atTime: b.atTime,
      note: b.note,
      chapterId: b.chapterId,
      placeId: b.placeId,
      done
    })
    await s.refreshTimeline()
  }

  const played = s.beats.filter((b) => b.done).length

  return (
    <section className="view chrono">
      <div className="vhead">
        <div>
          <h2>Chronologie de la séance</h2>
          <p>
            Où tu en es, et ce que tu as à dire. Choisis un moment ou un lieu&nbsp;: son texte
            s’affiche en grand, prêt à être lu.
          </p>
        </div>
        <div className="spacer" />
        <span className="eyebrow">
          {played} / {s.beats.length} joués
        </span>
      </div>

      <div className={`chrono-grid${annexes ? '' : ' sans-annexes'}`}>
        {/* ---- fil de la séance ---- */}
        <aside className="pane">
          <div className="pane-head">
            <div className="seg">
              <button className={tab === 'moments' ? 'on' : ''} onClick={() => setTab('moments')}>
                Moments
              </button>
              <button className={tab === 'lieux' ? 'on' : ''} onClick={() => setTab('lieux')}>
                Lieux
              </button>
            </div>
            <div className="spacer" />
            {tab === 'moments' ? (
              <button className="btn btn-ghost btn-sm" onClick={() => void addBeat()}>
                <IconPlus />
                Moment
              </button>
            ) : (
              <span className="eyebrow">{s.places.length} lieux</span>
            )}
          </div>

          <div className="pane-body">
            {tab === 'moments' ? (
              <ol className="fil">
                {s.beats.map((b) => {
                  const on = current?.kind === 'beat' && current.id === b.id
                  const lieu = s.places.find((p) => p.id === b.placeId)
                  return (
                    <li key={b.id}>
                      <button
                        className={`moment${on ? ' on' : ''}${b.done ? ' done' : ''}`}
                        onClick={() => {
                          setPick({ kind: 'beat', id: b.id })
                          setEditing(false)
                        }}
                      >
                        <span className="h num">{b.atTime ?? '—'}</span>
                        <span className="t">
                          <span className="ttl">{b.title}</span>
                          {lieu ? <span className="sub">{lieu.name}</span> : null}
                        </span>
                        <span
                          className={`tick${b.done ? ' on' : ''}`}
                          role="button"
                          tabIndex={0}
                          title={b.done ? 'Joué' : 'Marquer comme joué'}
                          onClick={(e) => {
                            e.stopPropagation()
                            void setDone(b, !b.done)
                          }}
                        >
                          <IconCheck />
                        </span>
                      </button>
                    </li>
                  )
                })}
                {s.beats.length === 0 ? (
                  <li className="vide">Aucun moment. Ajoute le premier.</li>
                ) : null}
              </ol>
            ) : (
              <div className="fil">
                {s.places.map((p) => {
                  const on = current?.kind === 'place' && current.id === p.id
                  const n = s.allItems.filter((i) => i.placeId === p.id && i.kind === 'doc').length
                  return (
                    <button
                      key={p.id}
                      className={`moment${on ? ' on' : ''}`}
                      onClick={() => {
                        setPick({ kind: 'place', id: p.id })
                        setEditing(false)
                      }}
                    >
                      <span className="t">
                        <span className="ttl">{p.name}</span>
                        {p.summary ? <span className="sub">{p.summary}</span> : null}
                      </span>
                      {n ? <span className="h num">{n} ✎</span> : null}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </aside>

        {/* ---- ce que je dis ---- */}
        <section className="pane lecture">
          {beat ? (
            <BeatReading beat={beat} editing={editing} onEdit={setEditing} />
          ) : place ? (
            <PlaceReading place={place} />
          ) : (
            <div className="vide-grand">
              Choisis un moment à gauche.
              <br />
              Son texte s’affiche ici, en grand.
            </div>
          )}
        </section>

        {/* ---- ce que je garde sous la main ---- */}
        <AnnexesPane ouvert={annexes} onToggle={() => setAnnexes((v) => !v)} />
      </div>
    </section>
  )
}

/* ============================================================
   Documents annexes : sous la main du début à la fin de la séance
   ============================================================ */

function AnnexesPane({
  ouvert,
  onToggle
}: {
  ouvert: boolean
  onToggle: () => void
}): JSX.Element {
  const s = useStore()
  const [vu, setVu] = useState<number | null>(null)
  const [choix, setChoix] = useState(false)

  const doc = s.annexes.find((a) => a.id === vu) ?? s.annexes[0] ?? null

  if (!ouvert)
    return (
      <button className="annexes-repli" onClick={onToggle} title="Ouvrir les annexes">
        <IconChevron />
        <span>Annexes{s.annexes.length ? ` · ${s.annexes.length}` : ''}</span>
      </button>
    )

  return (
    <aside className="pane annexes">
      <div className="pane-head">
        <span className="eyebrow">Annexes</span>
        <div className="spacer" />
        <button className="btn btn-ghost btn-sm" onClick={() => setChoix(true)}>
          <IconPlus />
          Ajouter
        </button>
        <button className="btn btn-ghost btn-sm btn-ico" onClick={onToggle} title="Replier">
          <IconChevron className="retourne" />
        </button>
      </div>

      {s.annexes.length ? (
        <div className="annexes-onglets">
          {s.annexes.map((a) => (
            <button
              key={a.id}
              className={`a-chip${doc?.id === a.id ? ' on' : ''}`}
              onClick={() => setVu(a.id)}
              title={a.relPath ?? a.title}
            >
              {a.title}
              <span
                className="oter"
                role="button"
                tabIndex={0}
                title="Retirer des annexes"
                onClick={async (e) => {
                  e.stopPropagation()
                  await window.jdr.annexes.remove(a.id)
                  await s.refreshAnnexes()
                  if (vu === a.id) setVu(null)
                }}
              >
                <IconClose />
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="pane-body annexes-corps">
        {doc ? (
          <>
            <h4 className="a-titre">
              <IconDoc />
              {doc.title}
              <span className="spacer" />
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => s.openInEditor(doc.id)}
                title="Modifier ce document"
              >
                <IconPen />
                Écrire
              </button>
            </h4>
            <div className="read-body" dangerouslySetInnerHTML={{ __html: doc.body ?? '' }} />
          </>
        ) : (
          <p className="vide-grand">
            Rien sous la main.
            <br />
            Ajoute les textes que tu consultes en cours de partie : règles maison, fiches de PNJ,
            tables de jets.
          </p>
        )}
      </div>

      {choix ? (
        <ChoixDoc
          titre="Garder un document sous la main"
          exclure={s.annexes.map((a) => a.id)}
          onClose={() => setChoix(false)}
          onPick={async (it) => {
            await window.jdr.annexes.add(it.id)
            await s.refreshAnnexes()
            setVu(it.id)
            setChoix(false)
          }}
        />
      ) : null}
    </aside>
  )
}

/* ============================================================
   Lecture d'un moment
   ============================================================ */

function BeatReading({
  beat,
  editing,
  onEdit
}: {
  beat: Beat
  editing: boolean
  onEdit: (v: boolean) => void
}): JSX.Element {
  const s = useStore()
  const [choix, setChoix] = useState(false)
  const [neuf, setNeuf] = useState(false)
  const chapter = s.chapters.find((c) => c.id === beat.chapterId)
  const place = s.places.find((p) => p.id === beat.placeId)
  const docs = useMemo(() => beat.items.filter((i) => i.kind === 'doc'), [beat])
  const autres = beat.items.filter((i) => i.kind !== 'doc')

  const attache = async (itemId: number): Promise<void> => {
    await window.jdr.timeline.attach(beat.id, itemId)
    await s.refreshTimeline()
  }
  const detache = async (itemId: number): Promise<void> => {
    await window.jdr.timeline.detach(beat.id, itemId)
    await s.refreshTimeline()
  }

  const save = async (patch: Partial<Beat>): Promise<void> => {
    await window.jdr.timeline.upsertBeat({
      id: beat.id,
      title: patch.title ?? beat.title,
      atTime: patch.atTime !== undefined ? patch.atTime : beat.atTime,
      note: patch.note !== undefined ? patch.note : beat.note,
      done: beat.done,
      chapterId: patch.chapterId !== undefined ? patch.chapterId : beat.chapterId,
      placeId: patch.placeId !== undefined ? patch.placeId : beat.placeId
    })
    await s.refreshTimeline()
  }

  return (
    <>
      <header className="lect-head">
        <div>
          <span className="eyebrow">
            {beat.atTime ? `${beat.atTime} · ` : ''}
            {chapter?.title ?? 'sans chapitre'}
            {place ? ` · ${place.name}` : ''}
          </span>
          <h3 className="display">{beat.title}</h3>
        </div>
        <div className="spacer" />
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setChoix(true)}
          title="Lire ici un document déjà dans la campagne"
        >
          <IconLink />
          Associer
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setNeuf(true)}
          title="Créer un document pour ce moment"
        >
          <IconPlus />
          Nouveau texte
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => onEdit(!editing)}>
          {editing ? 'Terminé' : 'Modifier'}
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={async () => {
            if (!confirm(`Supprimer « ${beat.title} » ?`)) return
            await window.jdr.timeline.removeBeat(beat.id)
            await s.refreshTimeline()
          }}
        >
          <IconTrash />
        </button>
      </header>

      {editing ? (
        <div className="lect-edit">
          <label className="field">
            <span>Heure</span>
            <input
              defaultValue={beat.atTime ?? ''}
              placeholder="21h30"
              onBlur={(e) => void save({ atTime: e.target.value || null })}
            />
          </label>
          <label className="field grow">
            <span>Titre</span>
            <input defaultValue={beat.title} onBlur={(e) => void save({ title: e.target.value })} />
          </label>
          <label className="field">
            <span>Chapitre</span>
            <select
              value={beat.chapterId ?? ''}
              onChange={(e) =>
                void save({ chapterId: e.target.value === '' ? null : Number(e.target.value) })
              }
            >
              <option value="">— aucun —</option>
              {s.chapters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Lieu</span>
            <select
              value={beat.placeId ?? ''}
              onChange={(e) =>
                void save({ placeId: e.target.value === '' ? null : Number(e.target.value) })
              }
            >
              <option value="">— aucun —</option>
              {s.places.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field grow full">
            <span>Ce que je dis, ou ce que je dois retenir</span>
            <textarea
              defaultValue={beat.note ?? ''}
              rows={4}
              onBlur={(e) => void save({ note: e.target.value || null })}
            />
          </label>
        </div>
      ) : null}

      <div className="lect-body">
        {beat.note ? <p className="mine">{beat.note}</p> : null}

        {docs.map((d) => (
          <article key={d.id} className="read">
            <h4>
              <IconDoc />
              {d.title}
              <span className="spacer" />
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => s.openInEditor(d.id)}
                title="Modifier ce texte"
              >
                <IconPen />
                Écrire
              </button>
              <button
                className="btn btn-ghost btn-sm btn-ico"
                onClick={() => void detache(d.id)}
                title="Détacher de ce moment — le fichier reste dans la campagne"
              >
                <IconClose />
              </button>
            </h4>
            <div
              className="read-body"
              dangerouslySetInnerHTML={{ __html: d.body || '<p class="rien">Ce texte est vide.</p>' }}
            />
          </article>
        ))}

        {!beat.note && docs.length === 0 ? (
          <p className="vide-grand">
            Rien à lire pour ce moment.
            <br />
            Écris une note, <b>associe</b> un texte de la campagne, ou crée-lui un{' '}
            <b>nouveau texte</b>.
          </p>
        ) : null}

        {autres.length ? (
          <p className="rappel">
            <span className="eyebrow">Préparé</span>
            {autres.map((i) => i.title).join(' · ')}
          </p>
        ) : null}
      </div>

      {choix ? (
        <ChoixDoc
          titre={`Associer un texte à « ${beat.title} »`}
          exclure={docs.map((d) => d.id)}
          onClose={() => setChoix(false)}
          onPick={async (it) => {
            await attache(it.id)
            setChoix(false)
          }}
        />
      ) : null}

      {neuf ? (
        <NouveauDoc
          defaut={beat.title}
          onClose={() => setNeuf(false)}
          onCree={async (it) => {
            await attache(it.id)
            setNeuf(false)
            s.openInEditor(it.id)
          }}
        />
      ) : null}
    </>
  )
}

/* ============================================================
   Lecture d'un lieu
   ============================================================ */

function PlaceReading({ place }: { place: Place }): JSX.Element {
  const s = useStore()
  const docs = s.allItems.filter((i) => i.placeId === place.id && i.kind === 'doc')
  const chapters = s.chapters.filter((c) => place.chapterIds.includes(c.id))

  return (
    <>
      <header className="lect-head">
        <div>
          <span className="eyebrow">
            lieu{chapters.length ? ` · ${chapters.map((c) => c.title).join(', ')}` : ''}
            {place.seen ? '' : ' · pas encore découvert'}
          </span>
          <h3 className="display">{place.name}</h3>
        </div>
      </header>

      <div className="lect-body">
        {place.summary ? <p className="mine">{place.summary}</p> : null}
        {place.notes ? (
          <article className="read">
            <div className="read-body">
              {place.notes.split(/\n{2,}/).map((par, n) => (
                <p key={n}>{par}</p>
              ))}
            </div>
          </article>
        ) : null}

        {docs.map((d) => (
          <article key={d.id} className="read">
            <h4>
              <IconDoc />
              {d.title}
            </h4>
            <div className="read-body" dangerouslySetInnerHTML={{ __html: d.body ?? '' }} />
          </article>
        ))}

        {!place.summary && !place.notes && docs.length === 0 ? (
          <p className="vide-grand">Ce lieu n’a pas encore de texte.</p>
        ) : null}
      </div>
    </>
  )
}

/* ============================================================
   Choisir un texte déjà dans la campagne
   ============================================================ */

function ChoixDoc({
  titre,
  exclure,
  onPick,
  onClose
}: {
  titre: string
  exclure: number[]
  onPick: (it: UiItem) => void
  onClose: () => void
}): JSX.Element {
  const s = useStore()
  const [q, setQ] = useState('')

  const dossierDe = (it: UiItem): string => {
    const p = it.relPath ?? ''
    const i = p.lastIndexOf('/')
    return i < 0 ? 'racine' : p.slice(0, i)
  }

  const mot = q.trim().toLowerCase()
  const liste = s.allItems
    .filter((i) => i.kind === 'doc' && !exclure.includes(i.id))
    .filter((i) => !mot || `${i.title} ${i.relPath ?? ''}`.toLowerCase().includes(mot))
    .slice(0, 200)

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <IconLink />
          <h3>{titre}</h3>
        </header>

        <div className="body">
          <label className="cherche">
            <IconSearch />
            <input
              type="text"
              autoFocus
              value={q}
              placeholder="Chercher un texte par son nom ou son dossier"
              onChange={(e) => setQ(e.target.value)}
            />
          </label>

          <div className="liste-docs">
            {liste.map((it) => (
              <button key={it.id} className="doc-row" onClick={() => onPick(it)}>
                <IconDoc />
                <span className="t">
                  <span className="ttl">{it.title}</span>
                  <span className="sub">{dossierDe(it)}</span>
                </span>
              </button>
            ))}
            {liste.length === 0 ? (
              <p className="vide">
                {mot ? 'Aucun texte ne correspond.' : 'Aucun texte disponible.'}
              </p>
            ) : null}
          </div>
        </div>

        <footer>
          <button className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
        </footer>
      </div>
    </div>
  )
}

/* ============================================================
   Créer un texte, et choisir où il se range sur le disque
   ============================================================ */

/** Tous les dossiers de la campagne, à plat, dans l'ordre de l'arborescence. */
function dossiersPlats(tree: UiFolder[], prefixe = ''): { rel: string; libelle: string }[] {
  const out: { rel: string; libelle: string }[] = []
  for (const f of tree) {
    out.push({ rel: f.relPath, libelle: prefixe + f.name })
    out.push(...dossiersPlats(f.children, prefixe + '   '))
  }
  return out
}

function NouveauDoc({
  defaut,
  onCree,
  onClose
}: {
  defaut: string
  onCree: (it: UiItem) => void
  onClose: () => void
}): JSX.Element {
  const s = useStore()
  const dossiers = useMemo(() => dossiersPlats(s.tree), [s.tree])
  const [titre, setTitre] = useState(defaut)
  const [rel, setRel] = useState(dossiers[0]?.rel ?? '')
  const [occupe, setOccupe] = useState(false)

  /** Le vrai explorateur : on n'accepte que l'intérieur de la campagne. */
  const parcourir = async (): Promise<void> => {
    const r = await window.jdr.folders.choose('Où ranger ce texte ?')
    if (r.erreur) return s.toast(r.erreur, true)
    if (r.rel !== null) setRel(r.rel)
  }

  const creer = async (): Promise<void> => {
    const nom = titre.trim()
    if (!nom || occupe) return
    setOccupe(true)
    const it = await window.jdr.items.createDoc(rel, nom)
    await s.refreshLibrary()
    setOccupe(false)
    if (!it) return s.toast('Le fichier n’a pas pu être créé.', true)
    onCree(it)
  }

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <IconDoc />
          <h3>Nouveau texte</h3>
        </header>

        <div className="body">
          <div className="field">
            <label htmlFor="nd-titre">Nom du fichier</label>
            <input
              id="nd-titre"
              type="text"
              autoFocus
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void creer()}
              placeholder="Ce que je lis en arrivant au manoir"
            />
          </div>

          <div className="field">
            <label htmlFor="nd-dossier">Où le ranger</label>
            <div className="ou-ranger">
              <select id="nd-dossier" value={rel} onChange={(e) => setRel(e.target.value)}>
                <option value="">— à la racine de la campagne —</option>
                {dossiers.map((d) => (
                  <option key={d.rel} value={d.rel}>
                    {d.libelle}
                  </option>
                ))}
              </select>
              <button className="btn btn-ghost" onClick={() => void parcourir()}>
                <IconFolder />
                Parcourir…
              </button>
            </div>
            <p className="aide">
              Le fichier est créé pour de vrai dans ton dossier de campagne : {rel || 'racine'}/
              {titre.trim() || '…'}.html
            </p>
          </div>
        </div>

        <footer>
          <button className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-brass" disabled={!titre.trim() || occupe} onClick={() => void creer()}>
            Créer et écrire
          </button>
        </footer>
      </div>
    </div>
  )
}

/** Heure du moment suivant : une demi-heure après le précédent. */
function nextTime(prev: string | null): string {
  const m = prev ? /^(\d{1,2})\s*h\s*(\d{0,2})$/i.exec(prev.trim()) : null
  if (!m) return '21h00'
  const total = Number(m[1]) * 60 + Number(m[2] || 0) + 30
  const h = Math.floor(total / 60) % 24
  const mn = total % 60
  return `${h}h${String(mn).padStart(2, '0')}`
}
