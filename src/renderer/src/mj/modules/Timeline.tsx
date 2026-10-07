import { useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { useRetourMoment } from '../retourMoment'
import {
  IconClose,
  IconDoc,
  IconImage,
  IconPlus,
  IconSearch,
  IconTrash
} from '../components/Icons'
import { SelecteurHeure } from '../components/SelecteurHeure'
import { TexteEnPlace } from '../components/TexteEnPlace'
import { SousMenuPreparation } from '../components/SousMenuPreparation'
import type { UiFolder, UiItem } from '../../../../preload/index'
import type { Beat, Place } from '@shared/types'

/* ============================================================
   Chronologie : suivre sa séance, pas piloter l'écran.
   On choisit un moment ou un lieu, et on lit ce qu'on doit dire.
   ============================================================ */

/** Le dossier où se rangent les textes des moments, dans celui de la séance. */
const DOSSIER_MOMENTS = 'Moments'

type Pick = { kind: 'beat'; id: number } | { kind: 'place'; id: number } | null

export function Timeline(): JSX.Element {
  const s = useStore()
  const [tab, setTab] = useState<'moments' | 'lieux'>('moments')
  /* De retour de l'Éditeur, on retrouve le moment qu'on avait quitté. */
  const [pick, setPick] = useState<Pick>(() => {
    const b = useRetourMoment.getState().beatId
    return b ? { kind: 'beat', id: b } : null
  })

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
  }

  return (
    <section className="view chrono">
      <div className="vhead">
        <SousMenuPreparation />
      </div>
      <div className="vhead">
        <div>
          <h2>Chronologie de la séance</h2>
          {/* On prépare ici ; on joue au Paravent. */}
          <p>
            Prépare ta séance&nbsp;: ses moments, leur heure et leur lieu, les PNJ en scène, le
            texte à dire et les images à montrer. Tu la joueras au Paravent.
          </p>
        </div>
        <div className="spacer" />
        <span className="eyebrow">
          {s.beats.length} moment{s.beats.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="chrono-grid">
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
                        className={`moment${on ? ' on' : ''}`}
                        onClick={() => {
                          setPick({ kind: 'beat', id: b.id })
                        }}
                      >
                        <span className="h num">{b.atTime ?? '—'}</span>
                        <span className="t">
                          <span className="ttl">{b.title}</span>
                          {lieu ? <span className="sub">{lieu.name}</span> : null}
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
            <BeatReading key={beat.id} beat={beat} />
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
      </div>
    </section>
  )
}

/* ============================================================
   Lecture d'un moment
   ============================================================ */

function BeatReading({ beat }: { beat: Beat }): JSX.Element {
  const s = useStore()
  /* Le texte qu'on écrit sur place, sans quitter la Chronologie. */
  const [enEdition, setEnEdition] = useState<number | null>(null)
  const place = s.places.find((p) => p.id === beat.placeId)
  const docs = useMemo(() => beat.items.filter((i) => i.kind === 'doc'), [beat])
  /* Les images du moment, prises dans la Bibliothèque : sous la main, prêtes
     à partir à l'écran si la scène le demande. */
  const images = beat.items
    .filter((i) => i.kind === 'image')
    .map((i) => s.allItems.find((u) => u.id === i.id))
    .filter((u): u is UiItem => !!u)
  const autres = beat.items.filter((i) => i.kind !== 'doc' && i.kind !== 'image')
  const [choixImage, setChoixImage] = useState(false)

  const attache = async (itemId: number): Promise<void> => {
    await window.jdr.timeline.attach(beat.id, itemId)
    await s.refreshTimeline()
  }
  /* Les textes des moments se rangent ensemble, dans « Moments », au cœur du
     dossier de la séance. Le premier texte crée le dossier et lui donne son
     sablier ; on ne le recrée pas s'il est déjà là. */
  const dossierDesMoments = async (): Promise<string> => {
    const base = s.session?.folderRel ?? ''
    const rel = base ? `${base}/${DOSSIER_MOMENTS}` : DOSSIER_MOMENTS
    const existe = (ns: UiFolder[]): boolean =>
      ns.some((f) => f.relPath === rel || existe(f.children))
    if (existe(useStore.getState().tree)) return rel
    const cree = await window.jdr.folders.create(base, DOSSIER_MOMENTS)
    await window.jdr.folders.decor(cree, 'moments', null)
    return cree
  }

  const creation = useRef(false)
  const creerTexte = async (): Promise<void> => {
    if (creation.current) return
    creation.current = true
    try {
      const dossier = await dossierDesMoments()
      const it = await window.jdr.items.createDoc(dossier, beat.title.trim() || 'Moment')
      if (!it) return s.toast('Le texte n’a pas pu être créé.', true)
      await attache(it.id)
      // Attaché, il est un texte de moment : sa version .txt naît avec lui.
      await window.jdr.items.update(it.id, { body: it.body || '<p></p>' })
      await s.refreshLibrary()
      setEnEdition(it.id)
    } finally {
      creation.current = false
    }
  }

  /* L'Éditeur complet, pour ce que l'édition sur place ne fait pas : il saura
     nous ramener ici. */
  const versEditeur = (itemId: number): void => {
    useRetourMoment.setState({ beatId: beat.id, docId: itemId })
    s.openInEditor(itemId)
  }

  /* Les PNJ que la scène met en jeu : la Régie les range devant les autres. */
  const pnjs = s.characters.filter((c) => c.kind === 'pnj')
  const enScene = pnjs.filter((c) => beat.pnjIds.includes(c.id))
  const basculePnj = async (id: number): Promise<void> => {
    const ids = beat.pnjIds.includes(id)
      ? beat.pnjIds.filter((x) => x !== id)
      : [...beat.pnjIds, id]
    await window.jdr.timeline.setPnjs(beat.id, ids)
    await s.refreshTimeline()
  }

  const save = async (patch: Partial<Beat>): Promise<void> => {
    await window.jdr.timeline.upsertBeat({
      id: beat.id,
      title: patch.title ?? beat.title,
      atTime: patch.atTime !== undefined ? patch.atTime : beat.atTime,
      note: patch.note !== undefined ? patch.note : beat.note,
      done: beat.done,
      placeId: patch.placeId !== undefined ? patch.placeId : beat.placeId
    })
    await s.refreshTimeline()
  }

  return (
    <>
      <header className="lect-head">
        <div className="lect-titre-bloc">
          <span className="eyebrow">
            {[beat.atTime, place?.name].filter(Boolean).join(' · ') || 'moment'}
          </span>
          {/* Le titre se corrige là où on le lit : Entrée valide, Échap renonce. */}
          <input
            /* Neuf à chaque titre : un Ctrl+Z qui le rend doit se voir. */
            key={beat.title}
            className="display lect-titre"
            defaultValue={beat.title}
            aria-label="Titre du moment"
            title="Cliquer pour renommer le moment"
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') {
                e.currentTarget.value = beat.title
                e.currentTarget.blur()
              }
            }}
            onBlur={(e) => {
              const titre = e.target.value.trim()
              if (!titre) e.target.value = beat.title
              else if (titre !== beat.title) void save({ title: titre })
            }}
          />
        </div>
        <div className="spacer" />
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

      <div className="lect-edit">
        <div className="field">
          <span>Heure</span>
          <SelecteurHeure value={beat.atTime} onChange={(v) => void save({ atTime: v })} />
        </div>
        <label className="field">
          <span>Lieu</span>
          <select
            value={beat.placeId ?? ''}
            onChange={(e) =>
              void save({
                placeId: e.target.value === '' ? null : Number(e.target.value)
              })
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
        {/* Les PNJ en scène et, à leur droite, les images à montrer. */}
        <div className="lect-ligne">
          {/* Sans PNJ dans la séance, rien à mettre en scène : le champ se retire. */}
          {pnjs.length ? (
            <div className="field grow">
              <span>PNJ en scène</span>
              <div className="tagbar">
                {pnjs.map((c) => (
                  <button
                    key={c.id}
                    className="chip"
                    aria-pressed={beat.pnjIds.includes(c.id)}
                    onClick={() => void basculePnj(c.id)}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="field images-moment">
            <span>Images</span>
            <div className="im-rangee">
              {images.map((im) => (
                /* On la rattache ici ; on la montre depuis le Paravent. */
                <figure key={im.id} className="im-vignette">
                  <img src={im.poster ?? im.url ?? ''} alt="" draggable={false} />
                  <div className="im-gestes">
                    <figcaption title={im.relPath ?? im.title}>{im.title}</figcaption>
                    <button
                      className="btn btn-ghost btn-sm btn-ico"
                      title="Détacher du moment (l’image reste dans la Bibliothèque)"
                      onClick={async () => {
                        await window.jdr.timeline.detach(beat.id, im.id)
                        await s.refreshTimeline()
                      }}
                    >
                      <IconClose />
                    </button>
                  </div>
                </figure>
              ))}
              <button className="im-ajout" onClick={() => setChoixImage(true)}>
                <IconPlus />
                Image
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="lect-body">
        {enScene.length ? (
          <p className="pnj-en-scene">
            <span className="eyebrow">En scène</span>
            {enScene.map((c) => c.name).join(' · ')}
          </p>
        ) : null}
        {beat.note ? <p className="mine">{beat.note}</p> : null}

        {docs.map((d) => (
          /* Le texte du moment n'a pas d'autre nom que le moment lui-même. */
          <article key={d.id} className="read">
            {enEdition === d.id ? (
              <TexteEnPlace
                item={d}
                onFini={() => setEnEdition(null)}
                versEditeur={() => versEditeur(d.id)}
              />
            ) : (
              <div
                className="read-body a-ecrire"
                role="button"
                tabIndex={0}
                title="Cliquer pour écrire ce texte"
                onClick={() => setEnEdition(d.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setEnEdition(d.id)
                }}
                dangerouslySetInnerHTML={{
                  __html: d.body || '<p class="rien">Ce texte est vide.</p>'
                }}
              />
            )}
          </article>
        ))}

        {/* Un moment, un texte : la page est là d'emblée. Le fichier, lui, ne
            naît qu'au premier clic, dans le dossier de la séance et au nom du
            moment — d'ici là, le moment a eu le temps d'être baptisé. */}
        {docs.length === 0 ? (
          <article className="read">
            <div
              className="read-body a-ecrire"
              role="button"
              tabIndex={0}
              title="Cliquer pour écrire le texte de ce moment"
              onClick={() => void creerTexte()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void creerTexte()
              }}
            >
              <p className="rien">Écris le texte de ce moment…</p>
            </div>
          </article>
        ) : null}

        {autres.length ? (
          <p className="rappel">
            <span className="eyebrow">Préparé</span>
            {autres.map((i) => i.title).join(' · ')}
          </p>
        ) : null}
      </div>

      {choixImage ? (
        <ChoixImage
          exclure={images.map((i) => i.id)}
          onClose={() => setChoixImage(false)}
          onPick={async (it) => {
            await attache(it.id)
            setChoixImage(false)
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

  return (
    <>
      <header className="lect-head">
        <div>
          <span className="eyebrow">
            lieu
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
   Choisir une image de la Bibliothèque
   ============================================================ */

function ChoixImage({
  exclure,
  onPick,
  onClose
}: {
  exclure: number[]
  onPick: (it: UiItem) => void
  onClose: () => void
}): JSX.Element {
  const s = useStore()
  const [q, setQ] = useState('')

  const mot = q.trim().toLowerCase()
  const liste = s.fichiers
    .filter((i) => i.kind === 'image' && !exclure.includes(i.id))
    .filter((i) => !mot || `${i.title} ${i.relPath ?? ''}`.toLowerCase().includes(mot))
    .slice(0, 300)

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal choix-images" onClick={(e) => e.stopPropagation()}>
        <header>
          <IconImage />
          <h3>Ajouter une image au moment</h3>
        </header>

        <div className="body">
          <label className="cherche">
            <IconSearch />
            <input
              type="text"
              autoFocus
              value={q}
              placeholder="Chercher une image par son nom ou son dossier"
              onChange={(e) => setQ(e.target.value)}
            />
          </label>

          <div className="ci-grille">
            {liste.map((it) => (
              <button
                key={it.id}
                className="ci-case"
                onClick={() => onPick(it)}
                title={it.relPath ?? it.title}
              >
                <img src={it.poster ?? it.url ?? ''} alt="" loading="lazy" draggable={false} />
                <span>{it.title}</span>
              </button>
            ))}
            {liste.length === 0 ? (
              <p className="vide">
                {mot ? 'Aucune image ne correspond.' : 'Aucune image dans la Bibliothèque.'}
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

/** Heure du moment suivant : une demi-heure après le précédent. */
function nextTime(prev: string | null): string {
  const m = prev ? /^(\d{1,2})\s*h\s*(\d{0,2})$/i.exec(prev.trim()) : null
  if (!m) return '21h00'
  const total = Number(m[1]) * 60 + Number(m[2] || 0) + 30
  const h = Math.floor(total / 60) % 24
  const mn = total % 60
  return `${h}h${String(mn).padStart(2, '0')}`
}
