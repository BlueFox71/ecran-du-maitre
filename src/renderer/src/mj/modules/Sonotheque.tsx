/**
 * La sonothèque : les sons de la campagne, rangés en planches.
 *
 * On y prépare une fois ce qu'on jouera ensuite d'un clic. Un son est une
 * nature — ambiance, nappe ou bruitage —, un volume, des fondus, une touche
 * du Paravent, et un ou plusieurs fichiers dont on tire un au hasard. Les
 * planches sont de simples rayons : « Scierie », « Météo », « Combat ».
 *
 * Trois colonnes, comme la réserve d'objets : les planches, les sons, et le
 * réglage de celui qu'on a choisi.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { arreterApercu, duree, ecouter, emojiDe, sonsDAilleurs, useSons, volumeApercu } from '../sons'
import { BarreSon } from '../components/BarreSon'
import { LieuxDuSon, type UsageSon } from '../components/LieuxDuSon'
import { ImportSons } from '../components/ImportSons'
import { ChoixDansArbre } from '../components/ChoixDansArbre'
import { Valeur } from '../components/Valeur'
import {
  IconAudio,
  IconClose,
  IconLecture,
  IconNote,
  IconPlus,
  IconStop,
  IconTrash,
  IconVibre
} from '../components/Icons'
import { MOTIFS_VIBRATION, NATURES_SON, type MotifVibration, type NatureSon, type Son } from '@shared/types'

const NATURES: NatureSon[] = ['ambiance', 'nappe', 'bruitage']
/** La planche « tout », et celle des sons rangés nulle part. */
const TOUT = '\u0000tout'
/** La planche des sons dont tous les fichiers sont rangés dans une autre séance. */
const AILLEURS = '\u0000ailleurs'

const AIDE_NATURE: Record<NatureSon, string> = {
  ambiance: 'Une seule à la fois : la suivante la remplace en fondu enchaîné.',
  nappe: 'Une boucle qu’on superpose à l’ambiance et aux autres nappes : pluie, vent, feu.',
  bruitage: 'Joue une fois. Plusieurs peuvent se chevaucher.'
}

export function Sonotheque(): JSX.Element {
  const liste = useSons((x) => x.liste)
  const apercu = useSons((x) => x.apercu)
  const s = useStore()
  const [planche, setPlanche] = useState<string>(TOUT)
  const [filtre, setFiltre] = useState<NatureSon | null>(null)
  /** Ne garder que les sons qui ne sont attribués à aucun lieu. */
  const [sansLieu, setSansLieu] = useState(false)
  /** Les sons posés sur un plan, pour savoir lesquels n'ont aucun lieu. */
  const [poses, setPoses] = useState<Set<number>>(new Set())
  const [q, setQ] = useState('')
  const [choisi, setChoisi] = useState<number | null>(null)
  /**
   * Les sons pris ensemble : Ctrl+clic ou la case d'une carte en ajoute un,
   * Maj+clic prend tout l'intervalle. À deux et plus, le volet de droite les
   * supprime d'un coup.
   */
  const [choix, setChoix] = useState<number[]>([])
  const ancre = useRef<number | null>(null)
  const [confirmer, setConfirmer] = useState(false)
  const [ajout, setAjout] = useState(false)
  const [nouvellePlanche, setNouvellePlanche] = useState<string | null>(null)
  /* Les planches vides n'existent qu'ici, le temps qu'on y range un premier son. */
  const [planchesVides, setPlanchesVides] = useState<string[]>([])
  /** « Noms des fichiers » attend qu'on confirme : il efface les noms donnés à la main. */
  const [reprendre, setReprendre] = useState(false)
  const nommes = liste.filter((x) => !x.nomSuitFichier && x.fichiers.length)

  useEffect(() => () => arreterApercu(), [])

  useEffect(() => {
    const lire = (): void => void window.jdr.sons.usages().then((u) => setPoses(new Set(u.map((x) => x.sonId))))
    lire()
    window.addEventListener('jdr:sons-lieux', lire)
    window.addEventListener('jdr:defait', lire)
    return () => {
      window.removeEventListener('jdr:sons-lieux', lire)
      window.removeEventListener('jdr:defait', lire)
    }
  }, [liste])
  /* Attribué : posé sur un plan, ou ambiance d'un lieu (son fichier y est choisi). */
  const ambiances = new Set(s.places.map((p) => p.ambienceItemId).filter((i): i is number => i != null))
  const aUnLieu = (x: Son): boolean => poses.has(x.id) || x.fichiers.some((f) => ambiances.has(f.itemId))

  const planches = useMemo(() => {
    const noms = new Set(liste.map((x) => x.planche).filter(Boolean))
    for (const p of planchesVides) noms.add(p)
    return [...noms].sort((a, b) => a.localeCompare(b, 'fr'))
  }, [liste, planchesVides])

  /*
   * La séance ouverte : comme la Bibliothèque, on écarte ce qui est rangé
   * dans le dossier d'une **autre** séance. Un son est d'ailleurs quand tous
   * ses fichiers le sont ; « Toute la campagne » (Bibliothèque) lève le filtre.
   */
  const ailleurs = useMemo(() => sonsDAilleurs(liste, s), [liste, s.session, s.sessions, s.allItems])
  const filtreSeance = !s.toutLaCampagne && ailleurs.size > 0
  const dIci = filtreSeance ? liste.filter((x) => !ailleurs.has(x.id)) : liste

  const visibles = (planche === AILLEURS ? liste.filter((x) => ailleurs.has(x.id)) : dIci).filter(
    (x) =>
      (planche === TOUT || planche === AILLEURS || x.planche === planche) &&
      (!filtre || x.nature === filtre) &&
      (!sansLieu || !aUnLieu(x)) &&
      (!q.trim() || x.nom.toLowerCase().includes(q.trim().toLowerCase()))
  )
  const son = liste.find((x) => x.id === choisi) ?? null
  /* L'ordre de l'écran — nature par nature —, pour Maj+clic. */
  const ordre = NATURES.flatMap((n) => visibles.filter((x) => x.nature === n))
  const pris = choix.filter((id) => liste.some((x) => x.id === id))
  const plusieurs = pris.length > 1

  const prendre = (id: number, e: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }, bascule = false): void => {
    setConfirmer(false)
    if (e.shiftKey && ancre.current != null) {
      const a = ordre.findIndex((x) => x.id === ancre.current)
      const b = ordre.findIndex((x) => x.id === id)
      if (a >= 0 && b >= 0) {
        const tranche = ordre.slice(Math.min(a, b), Math.max(a, b) + 1).map((x) => x.id)
        setChoix((c) => [...new Set([...(e.ctrlKey || e.metaKey ? c : []), ...tranche])])
        return
      }
    }
    if (bascule || e.ctrlKey || e.metaKey) {
      const base = pris.length ? pris : choisi != null ? [choisi] : []
      const n = base.includes(id) ? base.filter((x) => x !== id) : [...base, id]
      setChoix(n)
      ancre.current = id
      if (n.length === 1) setChoisi(n[0])
      else if (!n.length) setChoisi(null)
      return
    }
    setChoix([id])
    setChoisi(id)
    ancre.current = id
  }

  const supprimerChoix = async (): Promise<void> => {
    if (pris.includes(useSons.getState().apercu ?? -1)) arreterApercu()
    await window.jdr.sons.remove(pris)
    await useSons.getState().charger()
    setChoix([])
    setChoisi(null)
    setConfirmer(false)
  }

  /* Ctrl+A prend tous les sons visibles, Suppr propose de supprimer la
     sélection, Échap la lâche — hors d'un champ de saisie. */
  useEffect(() => {
    const touche = (e: KeyboardEvent): void => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && ordre.length) {
        e.preventDefault()
        setChoix(ordre.map((x) => x.id))
      } else if (e.key === 'Delete' && plusieurs) {
        e.preventDefault()
        setConfirmer(true)
      } else if (e.key === 'Escape' && plusieurs) {
        setChoix(choisi != null ? [choisi] : [])
        setConfirmer(false)
      }
    }
    window.addEventListener('keydown', touche)
    return () => window.removeEventListener('keydown', touche)
  })

  /* Les fichiers son qu'aucun son n'utilise encore — ceux de la séance
     ouverte, pas ceux rangés dans les autres (`fichiers` est déjà filtré). */
  const utilises = new Set(liste.flatMap((x) => x.fichiers.map((f) => f.itemId)))
  const libres = s.fichiers.filter((i) => i.kind === 'audio' && !utilises.has(i.id))
  const deLaSeance = !!s.session?.folderRel && !s.toutLaCampagne

  const plancheCourante = planche === TOUT || planche === AILLEURS ? '' : planche

  /** Tous les fichiers son de la séance, déjà utilisés ou non : la fenêtre d'import dit où en est chacun. */
  const audiosIci = s.fichiers.filter((i) => i.kind === 'audio')
  const [importOuvert, setImportOuvert] = useState(false)
  const importer = async (ids: number[]): Promise<void> => {
    const crees = await window.jdr.sons.addPlusieurs(ids, plancheCourante)
    await useSons.getState().charger()
    setImportOuvert(false)
    if (crees[0]) {
      setChoisi(crees[0].id)
      setChoix([crees[0].id])
    }
  }

  const ajouter = async (itemId: number | null): Promise<void> => {
    setAjout(false)
    if (itemId == null) return
    const n = await window.jdr.sons.add({ itemIds: [itemId], planche: plancheCourante })
    useSons.getState().poser(n)
    if (n) setChoisi(n.id)
  }

  const creerPlanche = (nom: string): void => {
    setNouvellePlanche(null)
    const n = nom.trim()
    if (!n) return
    if (!planches.includes(n)) setPlanchesVides((v) => [...v, n])
    setPlanche(n)
  }

  return (
    <section className="view snd-vue">
      <div className="vhead">
        <div>
          <h2>Sons</h2>
          <p>
            Les sons de la campagne. On les règle ici une fois&nbsp;; on les pose ensuite sur les
            plans, où ils partent quand un pion approche, et on les joue au Paravent.
          </p>
        </div>
        <div className="spacer" />
        {nommes.length ? (
          reprendre ? (
            <span className="snd-confirme">
              <span className="snd-aide">
                {nommes.length} son{nommes.length > 1 ? 's' : ''} reprendr{nommes.length > 1 ? 'ont' : 'a'} le nom de
                leur fichier, et le suivront.
              </span>
              <button className="btn btn-sm" onClick={() => setReprendre(false)}>
                Annuler
              </button>
              <button
                className="btn btn-sm btn-brass"
                onClick={async () => {
                  await window.jdr.sons.nomsDesFichiers(nommes.map((x) => x.id))
                  await useSons.getState().charger()
                  setReprendre(false)
                }}
              >
                Reprendre les noms
              </button>
            </span>
          ) : (
            <button
              className="btn btn-sm"
              onClick={() => setReprendre(true)}
              title="Donner à chaque son le nom de son fichier : renommé dans l’explorateur, le son suivra"
            >
              Noms des fichiers
            </button>
          )
        ) : null}
        {audiosIci.length ? (
          <button
            className="btn btn-sm"
            onClick={() => setImportOuvert(true)}
            title={`Choisir parmi les fichiers son ${deLaSeance ? 'de la séance (et des dossiers communs)' : 'de la campagne'} ceux qui deviennent des sons`}
          >
            <IconAudio />
            Importer{deLaSeance ? ' de la séance' : ''}…
            {libres.length ? <span className="n num">{libres.length} nouveau{libres.length > 1 ? 'x' : ''}</span> : null}
          </button>
        ) : null}
        <button className="btn btn-brass btn-sm" onClick={() => setAjout(true)}>
          <IconPlus />
          Nouveau son
        </button>
      </div>

      <div className="snd-shell">
        {/* ---------------- les planches ---------------- */}
        <div className="pane">
          <div className="pane-head">
            <span className="eyebrow">Planches</span>
            <div className="spacer" />
            <button
              className="btn btn-ghost btn-sm btn-ico"
              aria-label="Nouvelle planche"
              title="Nouvelle planche — un rayon où ranger des sons"
              onClick={() => setNouvellePlanche('')}
            >
              <IconPlus />
            </button>
          </div>
          <div className="pane-body">
            <button className={`snd-planche${planche === TOUT ? ' on' : ''}`} onClick={() => setPlanche(TOUT)}>
              <span className="lib">{filtreSeance ? 'Sons de la séance' : 'Tous les sons'}</span>
              <span className="n num">{dIci.length}</span>
            </button>
            <div className="snd-sep" />
            {planches.map((p) => (
              <Planche
                key={p}
                nom={p}
                n={dIci.filter((x) => x.planche === p).length}
                on={planche === p}
                onChoisir={() => setPlanche(p)}
                onRenommer={async (nom) => {
                  await window.jdr.sons.planche(p, nom)
                  setPlanchesVides((v) => v.map((x) => (x === p ? nom : x)))
                  await useSons.getState().charger()
                  setPlanche(nom || TOUT)
                }}
              />
            ))}
            {nouvellePlanche !== null ? (
              <input
                className="snd-planche-champ"
                type="text"
                autoFocus
                placeholder="Nom de la planche…"
                value={nouvellePlanche}
                onChange={(e) => setNouvellePlanche(e.target.value)}
                onBlur={() => creerPlanche(nouvellePlanche)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') creerPlanche(nouvellePlanche)
                  if (e.key === 'Escape') setNouvellePlanche(null)
                }}
              />
            ) : null}
            {dIci.some((x) => !x.planche) ? (
              <>
                <div className="snd-sep" />
                <button className={`snd-planche${planche === '' ? ' on' : ''}`} onClick={() => setPlanche('')}>
                  <span className="lib">Rangés nulle part</span>
                  <span className="n num">{dIci.filter((x) => !x.planche).length}</span>
                </button>
              </>
            ) : null}
            {filtreSeance ? (
              <>
                <div className="snd-sep" />
                <button
                  className={`snd-planche${planche === AILLEURS ? ' on' : ''}`}
                  onClick={() => setPlanche(AILLEURS)}
                  title="Les sons dont les fichiers sont rangés dans le dossier d’une autre séance : cachés ici. Ctrl+A puis Suppr pour les retirer tous."
                >
                  <span className="lib">Autres séances</span>
                  <span className="n num">{ailleurs.size}</span>
                </button>
              </>
            ) : null}
          </div>
        </div>

        {/* ---------------- les sons ---------------- */}
        <div className="pane">
          <div className="pane-head">
            <div className="snd-seg" role="tablist" aria-label="Nature">
              <button className={!filtre ? 'on' : ''} onClick={() => setFiltre(null)}>
                Tout
              </button>
              {NATURES.map((n) => (
                <button key={n} className={`n-${n}${filtre === n ? ' on' : ''}`} onClick={() => setFiltre(n)}>
                  {NATURES_SON[n].pluriel}
                </button>
              ))}
            </div>
            <div className="snd-seg">
              <button
                className={sansLieu ? 'on' : ''}
                aria-pressed={sansLieu}
                onClick={() => setSansLieu((v) => !v)}
                title="Seulement les sons posés nulle part : sur aucun plan, ambiance d’aucun lieu"
              >
                Sans lieu
              </button>
            </div>
            <div className="spacer" />
            <input
              className="snd-cherche"
              type="search"
              placeholder="Chercher un son…"
              aria-label="Chercher un son"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="pane-body snd-corps">
            {liste.length === 0 ? (
              <div className="empty">
                <IconNote />
                <span>
                  Aucun son pour l’instant. « Nouveau son » en fait un à partir d’un fichier de la
                  campagne{libres.length ? ', « Importer » propose ceux de la séance' : ''}.
                </span>
              </div>
            ) : visibles.length === 0 ? (
              <div className="empty">{sansLieu ? 'Tous ces sons ont un lieu.' : 'Rien ici.'}</div>
            ) : (
              NATURES.filter((n) => visibles.some((x) => x.nature === n)).map((n) => (
                <div key={n} className="snd-groupe">
                  <span className={`snd-pastille n-${n}`}>
                    {NATURES_SON[n].pluriel} · {visibles.filter((x) => x.nature === n).length}
                  </span>
                  <div className="snd-grille">
                    {visibles
                      .filter((x) => x.nature === n)
                      .map((x) => (
                        <CarteSon
                          key={x.id}
                          son={x}
                          choisi={plusieurs ? pris.includes(x.id) : x.id === choisi}
                          plusieurs={plusieurs}
                          ecoute={apercu === x.id}
                          onChoisir={(e, bascule) => prendre(x.id, e, bascule)}
                        />
                      ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ---------------- le réglage du son choisi ---------------- */}
        <div className="pane">
          {plusieurs ? (
            <SonsChoisis
              sons={liste.filter((x) => pris.includes(x.id))}
              confirmer={confirmer}
              onConfirmer={setConfirmer}
              onSupprimer={() => void supprimerChoix()}
              onLacher={() => {
                setChoix([])
                setConfirmer(false)
              }}
            />
          ) : son ? (
            <ReglageSon key={son.id} son={son} planches={planches} onRetire={() => setChoisi(null)} />
          ) : (
            <div className="pane-body">
              <div className="empty">Choisis un son pour le régler.</div>
            </div>
          )}
        </div>
      </div>

      {importOuvert ? (
        <ImportSons
          fichiers={audiosIci}
          sons={liste}
          planche={plancheCourante}
          onImporter={importer}
          onClose={() => setImportOuvert(false)}
        />
      ) : null}
      {ajout ? (
        <ChoixDansArbre
          titre="Un fichier son pour le nouveau son"
          icone={<IconAudio />}
          kinds={['audio']}
          rendu="lignes"
          courant={null}
          onPick={(id) => void ajouter(id)}
          onClose={() => setAjout(false)}
        />
      ) : null}
    </section>
  )
}

/* ============================================================
   Plusieurs sons pris ensemble
   ============================================================ */

function SonsChoisis({
  sons,
  confirmer,
  onConfirmer,
  onSupprimer,
  onLacher
}: {
  sons: Son[]
  confirmer: boolean
  onConfirmer: (v: boolean) => void
  onSupprimer: () => void
  onLacher: () => void
}): JSX.Element {
  const [poses, setPoses] = useState(0)
  const ids = sons.map((x) => x.id).join(',')
  useEffect(() => {
    const pris = new Set(sons.map((x) => x.id))
    void window.jdr.sons.usages().then((u) => setPoses(u.filter((x) => pris.has(x.sonId)).length))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids])

  return (
    <div className="pane-body snd-choisis">
      <span className="eyebrow">Sélection</span>
      <h3>{sons.length} sons pris</h3>
      <div className="snd-choisis-liste">
        {sons.map((x) => (
          <span key={x.id} className={`n-${x.nature}`}>
            <span className="emo">{emojiDe(x)}</span>
            {x.nom || 'Sans nom'}
          </span>
        ))}
      </div>
      <p className="snd-aide">
        Ctrl+clic ajoute ou retire un son, Maj+clic prend un intervalle, Ctrl+A tout ce qui est affiché, Échap lâche
        la sélection.
      </p>
      <div className="snd-pied">
        {confirmer ? (
          <>
            <span className="snd-aide">
              {poses
                ? `${poses} cercle${poses > 1 ? 's' : ''} posé${poses > 1 ? 's' : ''} sur des plans deviendr${poses > 1 ? 'ont' : 'a'} muet${poses > 1 ? 's' : ''}. `
                : ''}
              Les fichiers restent dans la bibliothèque. Ctrl+Z rattrape.
            </span>
            <button className="btn btn-sm" onClick={() => onConfirmer(false)}>
              Garder
            </button>
            <button className="btn btn-sm btn-danger" autoFocus onClick={onSupprimer}>
              <IconTrash />
              Supprimer les {sons.length}
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-sm btn-ghost" onClick={onLacher}>
              Lâcher la sélection
            </button>
            <button className="btn btn-sm btn-ghost btn-danger" onClick={() => onConfirmer(true)} title="Suppr">
              <IconTrash />
              Supprimer ces {sons.length} sons
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/* ============================================================
   Une planche, qu'un double-clic renomme
   ============================================================ */

function Planche({
  nom,
  n,
  on,
  onChoisir,
  onRenommer
}: {
  nom: string
  n: number
  on: boolean
  onChoisir: () => void
  onRenommer: (nom: string) => void
}): JSX.Element {
  const [edite, setEdite] = useState<string | null>(null)
  if (edite !== null)
    return (
      <input
        className="snd-planche-champ"
        type="text"
        autoFocus
        value={edite}
        onChange={(e) => setEdite(e.target.value)}
        onBlur={() => {
          if (edite.trim() !== nom) onRenommer(edite.trim())
          setEdite(null)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') setEdite(null)
        }}
      />
    )
  return (
    <button
      className={`snd-planche${on ? ' on' : ''}`}
      onClick={onChoisir}
      onDoubleClick={() => setEdite(nom)}
      title="Double-clic pour la renommer ; vidée de son nom, ses sons ne sont plus rangés nulle part"
    >
      <span className="lib">{nom}</span>
      <span className="n num">{n}</span>
    </button>
  )
}

/* ============================================================
   La carte d'un son
   ============================================================ */

/** Des barres d'onde, toujours les mêmes pour un même son. */
export function Onde({ graine, n = 12 }: { graine: number; n?: number }): JSX.Element {
  return (
    <span className="snd-onde" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <i key={i} style={{ height: `${25 + ((graine * 7 + i * 13) % 70)}%`, animationDelay: `${i * 60}ms` }} />
      ))}
    </span>
  )
}

function CarteSon({
  son,
  choisi,
  plusieurs,
  ecoute,
  onChoisir
}: {
  son: Son
  choisi: boolean
  /** Une sélection de plusieurs sons est en cours : les cases restent visibles. */
  plusieurs: boolean
  ecoute: boolean
  /** `bascule` : la case de la carte, qui ajoute ou retire sans lâcher les autres. */
  onChoisir: (e: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }, bascule?: boolean) => void
}): JSX.Element {
  const d = son.fichiers[0]?.duree ?? null
  return (
    <div
      className={`snd-carte n-${son.nature}${choisi ? ' on' : ''}${ecoute ? ' joue' : ''}${plusieurs ? ' multi' : ''}`}
      role="button"
      tabIndex={0}
      aria-pressed={choisi}
      onClick={(e) => onChoisir(e)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onChoisir(e)
        }
      }}
    >
      <div className="l1">
        <input
          type="checkbox"
          className="snd-case"
          checked={choisi && plusieurs}
          aria-label={`Prendre ${son.nom} avec d’autres`}
          title="Prendre avec d’autres sons (Ctrl+clic, Maj+clic pour un intervalle)"
          onClick={(e) => {
            e.stopPropagation()
            onChoisir(e, true)
          }}
          onChange={() => undefined}
        />
        <span className="emo">{emojiDe(son)}</span>
        <span className="nm">{son.nom || 'Sans nom'}</span>
        <button
          className="snd-lire"
          aria-label={ecoute ? `Arrêter ${son.nom}` : `Écouter ${son.nom}`}
          title={ecoute ? 'Arrêter' : 'Écouter pour toi, sans le jouer à la table'}
          disabled={!son.fichiers.length}
          onClick={(e) => {
            e.stopPropagation()
            ecouter(son)
          }}
        >
          {ecoute ? <IconStop /> : <IconLecture />}
        </button>
      </div>
      <div className="l2">
        <Onde graine={son.id} />
        <span className="meta num">
          {son.fichiers.length === 0 ? (
            <span className="snd-manque">aucun fichier</span>
          ) : (
            <>
              {son.fichiers.length > 1 ? `${son.fichiers.length} var. · ` : ''}
              {duree(d)}
            </>
          )}
          {son.vibration ? <IconVibre /> : null}
          {son.touche ? <kbd>{son.touche}</kbd> : null}
        </span>
      </div>
    </div>
  )
}

/* ============================================================
   Le réglage d'un son
   ============================================================ */

function ReglageSon({
  son,
  planches,
  onRetire
}: {
  son: Son
  planches: string[]
  onRetire: () => void
}): JSX.Element {
  const s = useStore()
  const apercu = useSons((x) => x.apercu)
  const apercuFichier = useSons((x) => x.apercuFichier)
  /** Combien de téléphones ont reçu le dernier « Essayer » ; null avant. */
  const [essaiVibre, setEssaiVibre] = useState<number | null>(null)
  useEffect(() => setEssaiVibre(null), [son.id])
  /* Vide : il porte le nom de son fichier, et le suit. */
  const [nom, setNom] = useState(son.nomSuitFichier ? '' : son.nom)
  const nomFichier = son.fichiers[0] ? nomDuFichier(son.fichiers[0].titre) : 'Nom du son'
  /* Les noms repris de l'extérieur (bouton « Noms des fichiers », Ctrl+Z) : le champ suit. */
  useEffect(() => setNom(son.nomSuitFichier ? '' : son.nom), [son.nom, son.nomSuitFichier])
  const [emoji, setEmoji] = useState(son.emoji ?? '')
  const [plancheTexte, setPlancheTexte] = useState(son.planche)
  const [variante, setVariante] = useState(false)
  const [supprimer, setSupprimer] = useState(false)
  const [usages, setUsages] = useState<UsageSon[]>([])
  const champEmoji = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void window.jdr.sons.usages().then(setUsages)
  }, [son.id])

  const regler = async (patch: Parameters<typeof window.jdr.sons.update>[1]): Promise<void> => {
    const n = await window.jdr.sons.update(son.id, patch)
    /* Une touche reprise à un autre son : celui-là aussi a changé. */
    if (patch.touche) await useSons.getState().charger()
    else useSons.getState().poser(n)
  }
  const fichiers = async (ids: number[]): Promise<void> => {
    useSons.getState().poser(await window.jdr.sons.fichiers(son.id, ids))
  }

  const ici = usages.filter((u) => u.sonId === son.id)
  const nomDuLieu = (id: number): string => s.places.find((p) => p.id === id)?.name ?? 'un lieu'
  const bruitage = son.nature === 'bruitage'

  return (
    <>
      <div className={`pane-head snd-tete n-${son.nature}`}>
        <span className="snd-pastille">{NATURES_SON[son.nature].label}</span>
        <div className="spacer" />
        <button
          className="btn btn-sm"
          disabled={!son.fichiers.length}
          title={
            son.nature === 'ambiance'
              ? 'La lancer à la table, en fondu'
              : son.nature === 'nappe'
                ? 'L’ajouter aux nappes qui tournent à la table'
                : 'Le jouer à la table, maintenant'
          }
          onClick={() => void window.jdr.regieSon.jouer(son.id)}
        >
          <IconLecture />
          Jouer à la table
        </button>
      </div>
      <div className="pane-body snd-reglage">
        <div className="snd-nom">
          <input
            ref={champEmoji}
            className="snd-emoji"
            type="text"
            aria-label="Émoji"
            title="Un émoji pour le reconnaître d’un coup d’œil — clic droit : le catalogue de Windows"
            value={emoji}
            placeholder={emojiDe({ emoji: null, nature: son.nature })}
            onChange={(e) => setEmoji([...e.target.value].slice(-2).join(''))}
            onBlur={() => emoji !== (son.emoji ?? '') && void regler({ emoji: emoji || null })}
            onContextMenu={(e) => {
              e.preventDefault()
              champEmoji.current?.focus()
              void window.jdr.app.emojis()
            }}
          />
          <input
            className="snd-nom-champ"
            type="text"
            aria-label="Nom du son"
            value={nom}
            placeholder={nomFichier}
            title="Vide, il porte le nom de son fichier et le suit quand on le renomme"
            onChange={(e) => setNom(e.target.value)}
            onBlur={() => nom.trim() !== (son.nomSuitFichier ? '' : son.nom) && void regler({ nom })}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        </div>
        {son.nomSuitFichier ? (
          <span className="snd-aide">Porte le nom de son fichier, et le suivra s’il est renommé.</span>
        ) : son.fichiers.length ? (
          <button
            className="btn btn-sm btn-ghost snd-suivre"
            title="Effacer ce nom : le son portera celui de son fichier, et le suivra"
            onClick={() => {
              setNom('')
              void regler({ nom: '' })
            }}
          >
            Reprendre le nom du fichier « {nomFichier} »
          </button>
        ) : null}

        <div className="field">
          <label>Nature</label>
          <div className="snd-seg">
            {NATURES.map((n) => (
              <button key={n} className={`n-${n}${son.nature === n ? ' on' : ''}`} onClick={() => void regler({ nature: n })}>
                {NATURES_SON[n].label}
              </button>
            ))}
          </div>
          <span className="snd-aide">{AIDE_NATURE[son.nature]}</span>
        </div>

        <div className="field">
          <label>
            Fichiers{son.fichiers.length > 1 ? ' · un tiré au hasard à chaque fois' : ''}
          </label>
          <div className="snd-fichiers">
            {son.fichiers.map((f) => (
              <div key={f.itemId} className="snd-fichier">
                <button
                  className="snd-lire"
                  aria-label={apercu === son.id && apercuFichier === f.itemId ? `Arrêter ${f.titre}` : `Écouter ${f.titre}`}
                  onClick={() => (apercu === son.id && apercuFichier === f.itemId ? arreterApercu() : ecouter(son, f.itemId))}
                >
                  {apercu === son.id && apercuFichier === f.itemId ? <IconStop /> : <IconLecture />}
                </button>
                <span className="t" title={f.titre}>
                  {f.titre}
                </span>
                <button
                  className="btn btn-ghost btn-sm btn-ico"
                  aria-label={`Retirer ${f.titre}`}
                  title="Retirer ce fichier du son — il reste dans la bibliothèque"
                  onClick={() => void fichiers(son.fichiers.filter((x) => x.itemId !== f.itemId).map((x) => x.itemId))}
                >
                  <IconClose />
                </button>
                <BarreSon son={son} itemId={f.itemId} />
              </div>
            ))}
            {!son.fichiers.length ? <span className="snd-manque">Aucun fichier : ce son est muet.</span> : null}
          </div>
          <button className="btn btn-sm snd-ajout" onClick={() => setVariante(true)}>
            <IconPlus />
            {son.fichiers.length ? 'Ajouter une variante' : 'Choisir un fichier'}
          </button>
        </div>

        <Curseur
          label="Volume"
          value={son.volume * 100}
          max={100}
          unite=" %"
          onChange={(v) => {
            volumeApercu(v / 100)
            void regler({ volume: v / 100 })
          }}
        />
        {!bruitage ? (
          <div className="snd-deux">
            <Curseur label="Fondu d’entrée" value={son.fonduEntree} max={10} step={0.5} decimales={1} unite=" s" onChange={(v) => void regler({ fonduEntree: v })} />
            <Curseur label="Fondu de sortie" value={son.fonduSortie} max={10} step={0.5} decimales={1} unite=" s" onChange={(v) => void regler({ fonduSortie: v })} />
          </div>
        ) : null}

        <div className="snd-deux">
          <div className="field">
            <label htmlFor="snd-touche">Touche au Paravent</label>
            <select
              id="snd-touche"
              value={son.touche ?? ''}
              onChange={(e) => void regler({ touche: e.target.value || null })}
              title="Elle joue le son au Paravent, quel que soit l’onglet ouvert. Prise à un autre son, elle lui est retirée."
            >
              <option value="">Aucune</option>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="snd-planche">Planche</label>
            <input
              id="snd-planche"
              type="text"
              list="snd-planches"
              value={plancheTexte}
              placeholder="Rangé nulle part"
              onChange={(e) => setPlancheTexte(e.target.value)}
              onBlur={() => plancheTexte.trim() !== son.planche && void regler({ planche: plancheTexte })}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
            <datalist id="snd-planches">
              {planches.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="field">
          <label htmlFor="snd-vibre">Téléphones</label>
          <div className="snd-ligne">
            <select
              id="snd-vibre"
              value={son.vibration ?? ''}
              onChange={(e) => void regler({ vibration: (e.target.value || null) as MotifVibration | null })}
            >
              <option value="">Ne vibrent pas</option>
              {(Object.keys(MOTIFS_VIBRATION) as MotifVibration[]).map((m) => (
                <option key={m} value={m}>
                  Vibrent : {MOTIFS_VIBRATION[m].label.toLowerCase()}
                </option>
              ))}
            </select>
            <button
              className="btn btn-sm"
              disabled={!son.vibration}
              title="Faire vibrer tous les téléphones connectés, pour essayer"
              onClick={async () => {
                if (!son.vibration) return
                setEssaiVibre(await window.jdr.regieSon.vibrer(son.vibration))
              }}
            >
              <IconVibre />
              Essayer
            </button>
          </div>
          {essaiVibre !== null ? (
            <span className={`snd-aide${essaiVibre ? '' : ' snd-manque'}`} role="status">
              {essaiVibre
                ? `Envoyé à ${essaiVibre} téléphone${essaiVibre > 1 ? 's' : ''}. S’il ne vibre pas, touche son écran une fois et réessaie : un navigateur ne vibre que pour une page qu’on a touchée.`
                : 'Aucun téléphone connecté : rien n’a vibré.'}
            </span>
          ) : null}
          <span className="snd-aide">
            {bruitage
              ? 'Joué au Paravent, il fait vibrer tous les téléphones ; posé sur un plan, celui de qui l’a déclenché. '
              : 'Une ambiance ou une nappe ne fait pas vibrer : seuls les bruitages le font. '}
            Android seulement : un iPhone ne vibre pour aucune page web.
          </span>
        </div>

        <LieuxDuSon
          son={son}
          usages={usages}
          onRelire={async () => {
            setUsages(await window.jdr.sons.usages())
            /* La liste, à gauche, filtre peut-être sur « Sans lieu ». */
            window.dispatchEvent(new Event('jdr:sons-lieux'))
          }}
        />

        {son.nature === 'ambiance' && ici.length ? (
        <div className="field">
          <label>Posé aussi sur des plans</label>
          <div className="snd-usages">
            {ici.map((u, i) => (
              <span key={`z${i}`}>
                Posé sur le plan de « {nomDuLieu(u.placeId)} »{u.nom ? ` · ${u.nom}` : ''}
              </span>
            ))}
          </div>
        </div>
        ) : null}

        <div className="snd-pied">
          {supprimer ? (
            <>
              <span className="snd-aide">
                {ici.length
                  ? `Il est posé ${ici.length} fois sur des plans : ces cercles deviendront muets.`
                  : 'Les fichiers restent dans la bibliothèque.'}
              </span>
              <button className="btn btn-sm" onClick={() => setSupprimer(false)}>
                Garder
              </button>
              <button
                className="btn btn-sm btn-danger"
                onClick={async () => {
                  await window.jdr.sons.remove(son.id)
                  await useSons.getState().charger()
                  onRetire()
                }}
              >
                <IconTrash />
                Supprimer
              </button>
            </>
          ) : (
            <button className="btn btn-sm btn-ghost btn-danger" onClick={() => setSupprimer(true)}>
              <IconTrash />
              Supprimer ce son
            </button>
          )}
        </div>
      </div>

      {variante ? (
        <ChoixDansArbre
          titre={son.fichiers.length ? `Une variante pour « ${son.nom} »` : `Un fichier pour « ${son.nom} »`}
          icone={<IconAudio />}
          kinds={['audio']}
          rendu="lignes"
          courant={null}
          onPick={(id) => {
            setVariante(false)
            if (id != null && !son.fichiers.some((f) => f.itemId === id))
              void fichiers([...son.fichiers.map((f) => f.itemId), id])
          }}
          onClose={() => setVariante(false)}
        />
      ) : null}
    </>
  )
}

/** Le nom d'un son tiré de son fichier — le même calcul que la base. */
const nomDuFichier = (titre: string): string =>
  titre.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_]+/g, ' ').trim() || 'Son'

/** Un curseur et sa valeur à taper à côté, comme partout dans l'application. */
export function Curseur({
  label,
  value,
  min = 0,
  max,
  step = 1,
  decimales = 0,
  unite,
  onChange
}: {
  label: string
  value: number
  min?: number
  max: number
  step?: number
  decimales?: number
  unite: string
  onChange: (v: number) => void
}): JSX.Element {
  /* Le curseur bouge tout de suite ; la base, elle, ne reçoit que la valeur où il s'arrête. */
  const [brouillon, setBrouillon] = useState<number | null>(null)
  const v = brouillon ?? value
  return (
    <label className="snd-curseur">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={v}
        onChange={(e) => setBrouillon(Number(e.target.value))}
        onPointerUp={() => {
          if (brouillon !== null) onChange(brouillon)
          setBrouillon(null)
        }}
        onKeyUp={() => {
          if (brouillon !== null) onChange(brouillon)
          setBrouillon(null)
        }}
      />
      <Valeur className="num" value={v} min={min} max={max} step={step} decimales={decimales} unite={unite} label={label} onChange={onChange} />
    </label>
  )
}
