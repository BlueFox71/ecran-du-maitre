/**
 * La Pochette — ce que les joueurs ont en main.
 *
 * La chemise de documents qu'on fait passer autour de la table, sauf qu'elle
 * passe par le Wi-Fi de la maison : un plan, une lettre, une photo, un film
 * mis ici s'affiche à la seconde sur le téléphone des joueurs.
 *
 * Trois choses la distinguent d'une simple liste de fichiers :
 *
 *  — **à qui.** Par défaut à toute la table ; nommément à quelqu'un pour la
 *    lettre que seul l'archiviste a trouvée.
 *  — **le rangement.** Des onglets facultatifs. Tant qu'il n'y en a aucun, la
 *    pochette est une seule pile, ici comme sur les téléphones.
 *  — **qui l'a ouvert.** Une pastille par joueur, pleine quand il l'a déplié.
 *    C'est la seule chose que le MJ ne peut pas voir en se penchant sur la
 *    table.
 *
 * Plusieurs cartes se choisissent ensemble — la case au coin de la vignette,
 * ou Ctrl + clic — pour les montrer, les remettre en réserve ou les donner à
 * quelqu'un d'un seul geste.
 *
 * Le piège du module est de donner dans le vide : si le portable est fermé,
 * personne ne verra rien. La bande du haut le dit toujours, et ouvre la porte
 * sur place.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { useEchap } from '../echap'
import { ChoixDansArbre } from '../components/ChoixDansArbre'
import { Visionneuse } from '../components/Visionneuse'
import {
  IconCheck,
  IconClose,
  IconEye,
  IconEyeOff,
  IconFolder,
  IconLoupe,
  IconPen,
  IconPeople,
  IconPlus,
  IconPochette,
  IconTrash,
  kindIcon
} from '../components/Icons'
import type { PochetteDoc, PochetteOnglet } from '@shared/types'
import { PION_COULEURS } from '@shared/types'
import { heureLocale } from '@shared/heure'

/**
 * Une personne autour de la table, telle que la pochette la nomme : le MJ
 * pense au personnage, la base tient la personne. On montre les deux, le
 * personnage d'abord — c'est à Adèle qu'on donne la lettre, pas à Marc.
 */
type Convive = {
  id: number
  name: string
  characterName: string | null
  color: string | null
  /** Son personnage est à la table ce soir : lui seul se propose dans « à qui ». */
  present: boolean
}

/** Ce qui peut entrer dans la pochette : ce qu'on regarde, pas ce qu'on écoute. */
const ENTRANTS = ['image', 'pdf', 'video'] as const

/** « Tout » n'est pas un onglet : c'est la pile entière. */
const TOUT = 'tout'
type Rangement = typeof TOUT | number

/** Le code d'une teinte des pions, pour la dessiner — `null` si l'onglet n'en a pas. */
const hexDe = (cle: string | null): string | null =>
  PION_COULEURS.find((c) => c.key === cle)?.hex ?? null

/** L'étiquette d'un onglet qu'on déplace — distincte de celle d'une carte. */
const GLISSE_ONGLET = 'text/pochette-onglet'

export function Pochette(): JSX.Element {
  const s = useStore()
  const [rangement, setRangement] = useState<Rangement>(TOUT)
  const [choix, setChoix] = useState(false)
  /** Le document dont on ouvre le menu « donner à » ou « ranger ». */
  const [menu, setMenu] = useState<{ id: number; quoi: 'qui' | 'ou' } | null>(null)
  /** L'onglet qu'on est en train de nommer — `0` pour un onglet neuf. */
  const [nomme, setNomme] = useState<number | null>(null)
  /** Où l'onglet qu'on fait glisser se poserait : avant ou après celui-ci. */
  const [marque, setMarque] = useState<{ id: number; apres: boolean } | null>(null)
  /** L'onglet dont on choisit la couleur, et où poser la palette sous lui. */
  const [teinte, setTeinte] = useState<{ id: number; x: number; y: number } | null>(null)
  useEchap(() => setTeinte(null), teinte !== null)

  const onglets = s.pochetteOnglets
  const docs = s.pochette

  /* Un Ctrl+Z peut rendre un onglet retiré : on relit la pochette. */
  useEffect(() => {
    const relire = (): void => void window.jdr.pochette.list().then(s.setPochette)
    window.addEventListener('jdr:defait', relire)
    return () => window.removeEventListener('jdr:defait', relire)
  }, [s.setPochette])

  /* L'onglet ouvert peut disparaître sous nos pieds — on le retire, ou une
     autre fenêtre le retire. On retombe alors sur la pile entière. */
  useEffect(() => {
    if (rangement !== TOUT && !onglets.some((o) => o.id === rangement)) setRangement(TOUT)
  }, [onglets, rangement])

  const vus = useMemo(
    () => (rangement === TOUT ? docs : docs.filter((d) => d.ongletId === rangement)),
    [docs, rangement]
  )

  /* Les cartes choisies ensemble. Changer d'onglet repart de rien : on ne
     montre pas ce qu'on ne voit plus. */
  const [choisis, setChoisis] = useState<Set<number>>(new Set())
  useEffect(() => setChoisis(new Set()), [rangement])
  useEffect(() => {
    setChoisis((c) => {
      const restent = [...c].filter((id) => docs.some((d) => d.id === id))
      return restent.length === c.size ? c : new Set(restent)
    })
  }, [docs])
  useEchap(() => setChoisis(new Set()), choisis.size > 0 && menu === null)
  const basculer = (id: number): void =>
    setChoisis((c) => {
      const n = new Set(c)
      if (!n.delete(id)) n.add(id)
      return n
    })

  const convives: Convive[] = useMemo(
    () =>
      s.players.map((p) => ({
        id: p.id,
        name: p.name,
        characterName: s.characters.find((c) => c.id === p.characterId)?.name ?? null,
        color: p.color,
        present: !!s.characters.find((c) => c.id === p.characterId)?.present
      })),
    [s.players, s.characters]
  )

  const enligne = s.mobile?.devices.filter((d) => d.online) ?? []
  const ouvert = !!s.mobile?.running && !!s.mobile?.inviteOpen

  const poser = (p: { onglets: PochetteOnglet[]; docs: PochetteDoc[] }): void => s.setPochette(p)

  return (
    <section className="view">
      <div className="vhead">
        <div>
          <h2>La Pochette</h2>
          <p>
            Ce que les joueurs ont en main. Un document entre ici <b>en réserve</b> : tu le
            prépares pendant qu’ils discutent, et tu le montres quand ils le trouvent — à toute
            la table, ou à un seul. Rien ne sort du Wi-Fi de la maison.
          </p>
        </div>
        <div className="spacer" />
        <button className="btn btn-brass" onClick={() => setChoix(true)}>
          <IconPlus />
          Mettre un document
        </button>
      </div>

      <EtatDuPortable
        ouvert={ouvert}
        enligne={enligne.length}
        enReserve={docs.filter((d) => !d.visible).length}
      />

      {/* La barre n'a pas lieu d'être tant que rien n'est rangé. */}
      {onglets.length > 0 && (
        <div className="poche-onglets" role="tablist" aria-label="Rangements de la pochette">
          <button
            role="tab"
            aria-selected={rangement === TOUT}
            onClick={() => setRangement(TOUT)}
          >
            Tout<span className="n">{docs.length}</span>
          </button>
          {onglets.map((o) =>
            nomme === o.id ? (
              <SaisieOnglet
                key={o.id}
                valeur={o.name}
                onFini={async (nom) => {
                  setNomme(null)
                  if (nom !== null) poser(await window.jdr.pochette.renameOnglet(o.id, nom))
                }}
              />
            ) : (
              <button
                key={o.id}
                role="tab"
                aria-selected={rangement === o.id}
                onClick={() => setRangement(o.id)}
                onDoubleClick={() => setNomme(o.id)}
                /* L'onglet se déplace en le faisant glisser dans la barre ; une
                   carte lâchée dessus s'y range. Les deux gestes ne portent pas
                   la même étiquette, on ne les confond pas. */
                draggable
                className={
                  [
                    hexDe(o.couleur) ? 'colorie' : '',
                    marque?.id === o.id ? (marque.apres ? 'pose-apres' : 'pose-avant') : ''
                  ]
                    .filter(Boolean)
                    .join(' ') || undefined
                }
                style={
                  hexDe(o.couleur) ? { ['--onglet' as string]: hexDe(o.couleur) } : undefined
                }
                onDragStart={(e) => {
                  e.dataTransfer.setData(GLISSE_ONGLET, String(o.id))
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onDragEnd={() => setMarque(null)}
                onDragOver={(e) => {
                  e.preventDefault()
                  if (!e.dataTransfer.types.includes(GLISSE_ONGLET)) return
                  const r = e.currentTarget.getBoundingClientRect()
                  const apres = e.clientX > r.left + r.width / 2
                  if (marque?.id !== o.id || marque.apres !== apres) setMarque({ id: o.id, apres })
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setMarque(null)
                }}
                onDrop={async (e) => {
                  e.preventDefault()
                  const m = marque
                  setMarque(null)
                  if (e.dataTransfer.types.includes(GLISSE_ONGLET)) {
                    const pris = Number(e.dataTransfer.getData(GLISSE_ONGLET))
                    if (!m || !pris || pris === o.id) return
                    const ids = onglets.map((x) => x.id).filter((x) => x !== pris)
                    const i = ids.indexOf(o.id) + (m.apres ? 1 : 0)
                    ids.splice(i, 0, pris)
                    if (ids.every((x, n) => x === onglets[n].id)) return
                    poser(await window.jdr.pochette.reorderOnglets(ids))
                    return
                  }
                  const id = Number(e.dataTransfer.getData('text/pochette'))
                  if (Number.isFinite(id) && id) poser(await window.jdr.pochette.setOnglet(id, o.id))
                }}
              >
                {o.name}
                <span className="n">{o.count}</span>
                {/* Renommer et retirer ne se montrent que sur l'onglet ouvert :
                    on ne défait pas un rangement en visant celui d'à côté. */}
                {rangement === o.id && (
                  <span className="tenir">
                    <button
                      className="colorier"
                      title={`Colorier « ${o.name} »`}
                      aria-label={`Colorier « ${o.name} »`}
                      onClick={(e) => {
                        e.stopPropagation()
                        const r = e.currentTarget.getBoundingClientRect()
                        setTeinte(
                          teinte?.id === o.id ? null : { id: o.id, x: r.left, y: r.bottom + 6 }
                        )
                      }}
                    >
                      <span className={o.couleur ? 'disque' : 'disque sans'} />
                    </button>
                    <button
                      title={`Renommer « ${o.name} »`}
                      aria-label={`Renommer « ${o.name} »`}
                      onClick={(e) => {
                        e.stopPropagation()
                        setNomme(o.id)
                      }}
                    >
                      <IconPen />
                    </button>
                    <button
                      className="oter"
                      title={`Retirer l’onglet « ${o.name} » — ses documents restent aux joueurs`}
                      aria-label={`Retirer l’onglet « ${o.name} »`}
                      onClick={async (e) => {
                        e.stopPropagation()
                        /* Ses documents passent dans l'onglet voisin : on le dit
                           avant, et Ctrl+Z le rend après. */
                        const i = onglets.findIndex((x) => x.id === o.id)
                        const voisin = onglets[i - 1] ?? onglets[i + 1]
                        const n = o.count
                        if (
                          !confirm(
                            `Retirer l’onglet « ${o.name} » ?` +
                              (n
                                ? `\n\nSes ${n} document${n > 1 ? 's' : ''} ${n > 1 ? 'passent' : 'passe'} dans « ${voisin?.name ?? 'la pile'} » — rien n’est retiré aux joueurs.`
                                : '') +
                              '\n\nCtrl+Z le rendra.'
                          )
                        )
                          return
                        poser(await window.jdr.pochette.removeOnglet(o.id))
                        s.toast(`Onglet « ${o.name} » retiré — Ctrl+Z pour le rendre.`)
                      }}
                    >
                      <IconClose />
                    </button>
                  </span>
                )}
              </button>
            )
          )}
          {nomme === 0 ? (
            <SaisieOnglet
              valeur=""
              onFini={async (nom) => {
                setNomme(null)
                if (nom) poser(await window.jdr.pochette.createOnglet(nom))
              }}
            />
          ) : (
            <button className="plus" title="Nouvel onglet" onClick={() => setNomme(0)}>
              <IconPlus />
            </button>
          )}
        </div>
      )}

      {/* La palette d'un onglet. Posée hors de la barre, qui rogne ce qui
          dépasse ; un clic à côté la referme. */}
      {teinte &&
        (() => {
          const o = onglets.find((x) => x.id === teinte.id)
          if (!o) return null
          const colorier = async (cle: string | null): Promise<void> => {
            setTeinte(null)
            if (cle !== o.couleur) poser(await window.jdr.pochette.couleurOnglet(o.id, cle))
          }
          return (
            <>
              <div className="poche-teinte-fond" onClick={() => setTeinte(null)} />
              <div
                className="poche-teinte"
                role="dialog"
                aria-label={`Couleur de « ${o.name} »`}
                style={{ left: teinte.x, top: teinte.y }}
              >
                <button
                  className={`teinte sans${o.couleur ? '' : ' on'}`}
                  title="Sans couleur"
                  aria-label="Sans couleur"
                  onClick={() => void colorier(null)}
                />
                {PION_COULEURS.map((c) => (
                  <button
                    key={c.key}
                    className={`teinte${o.couleur === c.key ? ' on' : ''}`}
                    style={{ background: c.hex }}
                    title={c.name}
                    aria-label={c.name}
                    onClick={() => void colorier(c.key)}
                  />
                ))}
              </div>
            </>
          )
        })()}

      {docs.length === 0 ? (
        <div className="empty poche-vide">
          <b>La pochette est vide</b>
          Un plan, une lettre, une photo, un film — pris dans la bibliothèque de la campagne.
          <br />
          Ce que tu y mets attend en réserve : c’est toi qui décides du moment où ils le voient.
          <button className="btn btn-brass" onClick={() => setChoix(true)}>
            <IconPlus />
            Mettre un document
          </button>
        </div>
      ) : (
        <>
        {choisis.size > 0 && (
          <BarreSelection
            docs={vus.filter((d) => choisis.has(d.id))}
            total={vus.length}
            joueurs={convives}
            onPoser={poser}
            onTout={() => setChoisis(new Set(vus.map((d) => d.id)))}
            onVider={() => setChoisis(new Set())}
          />
        )}
        <div className={`poche${choisis.size > 0 ? ' en-selection' : ''}`}>
          {vus.map((d) => (
            <Carte
              key={d.id}
              doc={d}
              choisi={choisis.has(d.id)}
              enSelection={choisis.size > 0}
              onChoisir={() => basculer(d.id)}
              /* Le rangement ne se rappelle que dans « Tout » : ailleurs, on
                 sait déjà où l'on est. */
              montreRangement={rangement === TOUT && onglets.length > 0}
              joueurs={convives}
              menu={menu?.id === d.id ? menu.quoi : null}
              onMenu={(quoi) => setMenu(quoi ? { id: d.id, quoi } : null)}
              onglets={onglets}
              onPoser={poser}
              onDeposeSur={async (pris) => {
                /* Le document glissé prend la place de celui qu'on vise, qui
                   recule d'un cran. */
                if (pris === d.id) return
                const ids = vus.map((x) => x.id).filter((x) => x !== pris)
                ids.splice(ids.indexOf(d.id), 0, pris)
                poser(await window.jdr.pochette.reorderDocs(ids))
              }}
              onPage={async (page) => {
                await window.jdr.items.thumbPage(d.itemId, page)
                /* Le graveur travaille en arrière-plan et annonce son résultat
                   par `library:changed` — la boutique relit alors la pochette
                   et la vignette se remplace d'elle-même. En attendant, on le
                   dit : une image qui ne change pas tout de suite ressemble à
                   un geste sans effet. */
                s.toast(`Aperçu pris à la page ${page} — la vignette se regrave.`)
              }}
            />
          ))}
          <button className="doc-neuf" onClick={() => setChoix(true)}>
            <span className="sig">
              <IconPlus />
            </span>
            <b>Mettre un document</b>
            <span>
              Pris dans la bibliothèque : image, PDF ou vidéo. Il entrera en réserve.
              {rangement !== TOUT
                ? ` Il ira dans « ${onglets.find((o) => o.id === rangement)?.name} ».`
                : ''}
            </span>
          </button>
          {/* Un onglet neuf se propose au bout de la pile quand il n'y en a
              aucun : la barre, elle, n'existe pas encore. */}
          {onglets.length === 0 && (
            <button className="doc-neuf mince" onClick={() => setNomme(0)}>
              <span className="sig">
                <IconPochette />
              </span>
              <b>Ranger par onglets</b>
              <span>
                Plans, courrier, preuves… Le premier onglet ramasse ce qui est déjà là.
              </span>
            </button>
          )}
        </div>
        </>
      )}

      {/* La saisie du premier onglet, quand la barre n'existe pas encore. */}
      {onglets.length === 0 && nomme === 0 && (
        <div className="scrim" onClick={() => setNomme(null)}>
          <div className="modal etroit" onClick={(e) => e.stopPropagation()}>
            <header>
              <IconPochette />
              <h3>Premier onglet</h3>
            </header>
            <div className="body">
              <div className="field">
                <label htmlFor="po-nom">Son nom</label>
                <input
                  id="po-nom"
                  autoFocus
                  placeholder="Plans"
                  onKeyDown={async (e) => {
                    const v = (e.target as HTMLInputElement).value.trim()
                    if (e.key === 'Escape') setNomme(null)
                    if (e.key === 'Enter' && v) {
                      setNomme(null)
                      poser(await window.jdr.pochette.createOnglet(v))
                    }
                  }}
                />
                <p className="aide">
                  Les {docs.length} document{docs.length > 1 ? 's' : ''} déjà donné
                  {docs.length > 1 ? 's' : ''} y {docs.length > 1 ? 'seront rangés' : 'sera rangé'} —
                  rien ne se perd derrière un filtre.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {choix && (
        <ChoixDansArbre
          titre="Mettre un document dans la pochette"
          icone={<IconPochette />}
          kinds={[...ENTRANTS]}
          rendu="vignettes"
          courant={null}
          /* Plusieurs d'un coup : on coche, « Ajouter » les met tous en réserve,
             dans l'ordre des coches. Ceux déjà donnés à toute la table sont
             marqués et ne se cochent pas — la base n'en garderait qu'un. */
          deja={docs.filter((d) => d.playerId === null).map((d) => d.itemId)}
          plusieurs={async (ids) => {
            setChoix(false)
            const onglet = rangement === TOUT ? null : rangement
            let apres: { onglets: PochetteOnglet[]; docs: PochetteDoc[] } | null = null
            for (const id of ids) apres = await window.jdr.pochette.add(id, null, onglet)
            if (apres) poser(apres)
            if (ids.length > 1) s.toast(`${ids.length} documents mis en réserve.`)
          }}
          onClose={() => setChoix(false)}
        />
      )}
    </section>
  )
}

/* ============================================================
   La bande d'état : donner dans le vide est le piège du module
   ============================================================ */

function EtatDuPortable({
  ouvert,
  enligne,
  enReserve
}: {
  ouvert: boolean
  enligne: number
  enReserve: number
}): JSX.Element {
  const s = useStore()
  /* Ce qui attend d'être montré se dit là : sans quoi on cherche sur les
     téléphones un document qu'on n'a jamais sorti de la réserve. */
  const attente =
    enReserve === 0
      ? ''
      : ` ${enReserve} document${enReserve > 1 ? 's' : ''} ${enReserve > 1 ? 'attendent' : 'attend'} d’être montré${enReserve > 1 ? 's' : ''}.`

  if (!ouvert)
    return (
      <div className="poche-etat fermee">
        <span className="voyant" />
        <span>
          <b>Le portable est fermé.</b> Personne ne verra la pochette tant qu’il l’est.
          {attente}
        </span>
        <div className="spacer" />
        <button
          className="btn btn-sm btn-brass"
          onClick={async () => s.setMobile((await window.jdr.mobile.open()).info)}
        >
          Ouvrir le portable
        </button>
      </div>
    )

  return (
    <div className="poche-etat">
      <span className="voyant" />
      <span>
        <b>Le portable est ouvert.</b>{' '}
        {enligne === 0
          ? 'Aucun téléphone en ligne pour l’instant — ce que tu montres ici les attendra.'
          : `${enligne} téléphone${enligne > 1 ? 's' : ''} en ligne — ce que tu montres ici s’affiche chez eux dans la seconde.`}
        {attente}
      </span>
      <div className="spacer" />
      <span className="gens">
        {/* Les joueurs de la séance seulement : un absent n'a pas de téléphone à attendre. */}
        {s.players
          .filter((p) => s.characters.find((c) => c.id === p.characterId)?.present)
          .map((p) => (
          <span
            key={p.id}
            className={`poche-pip c-${p.color ?? 'neutral'}${
              s.mobile?.devices.some((d) => d.playerId === p.id && d.online && !d.spectateur) ? '' : ' absent'
            }`}
            title={`${p.name}${
              s.mobile?.devices.some((d) => d.playerId === p.id && d.online && !d.spectateur)
                ? ''
                : ' — pas de téléphone en ligne'
            }`}
          />
        ))}
      </span>
    </div>
  )
}

/* ============================================================
   Une carte de la pochette
   ============================================================ */

function Carte({
  doc,
  choisi,
  enSelection,
  onChoisir,
  montreRangement,
  joueurs,
  onglets,
  menu,
  onMenu,
  onPoser,
  onDeposeSur,
  onPage
}: {
  doc: PochetteDoc
  choisi: boolean
  /** Au moins une carte est choisie : un clic sur la carte la choisit aussi. */
  enSelection: boolean
  onChoisir: () => void
  montreRangement: boolean
  joueurs: Convive[]
  onglets: PochetteOnglet[]
  menu: 'qui' | 'ou' | null
  onMenu: (quoi: 'qui' | 'ou' | null) => void
  onPoser: (p: { onglets: PochetteOnglet[]; docs: PochetteDoc[] }) => void
  /** Un autre document lâché sur celui-ci : il vient se mettre devant. */
  onDeposeSur: (id: number) => void
  /** Changer la page dont on tire l'aperçu d'un PDF. */
  onPage: (page: number) => void
}): JSX.Element {
  /* Un document remis à quelqu'un n'a qu'une paire d'yeux à attendre ; un
     document remis à la table les a toutes. */
  const yeux =
    doc.playerId === null
      ? joueurs.filter((p) => p.present) // la table de ce soir, pas toute la campagne
      : joueurs.filter((p) => p.id === doc.playerId)
  const lus = yeux.filter((p) => doc.luPar.includes(p.id)).length
  /* Un document survolé par un autre qu'on glisse : un trait dit où il tombera. */
  const [vise, setVise] = useState(false)
  /* Renommer : c'est le fichier qui change de nom, comme dans la bibliothèque —
     le téléphone des joueurs le lit sous ce nom. */
  const [nom, setNom] = useState<string | null>(null)
  /* La loupe : le document en grand, pour le MJ seul. */
  const [loupe, setLoupe] = useState(false)
  const s = useStore()
  const renommer = async (v: string | null): Promise<void> => {
    setNom(null)
    const neuf = v?.trim()
    if (!neuf || neuf === doc.item.title) return
    try {
      await window.jdr.items.update(doc.itemId, { title: neuf })
      onPoser(await window.jdr.pochette.list())
    } catch (e) {
      s.toast('Impossible de le renommer — un fichier porte peut-être déjà ce nom.', true)
      console.error('[pochette] renommer', e)
    }
  }

  return (
    <div
      className={`doc${doc.visible ? '' : ' en-reserve'}${vise ? ' vise' : ''}${choisi ? ' choisi' : ''}`}
      draggable
      onClick={(e) => {
        /* Ctrl + clic choisit ; une fois la sélection commencée, un simple clic
           suffit. Les boutons de la carte gardent leur geste à eux. */
        if ((e.target as HTMLElement).closest('button, input, .doc-menu, .visionneuse')) return
        if (enSelection || e.ctrlKey || e.metaKey) onChoisir()
      }}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/pochette', String(doc.id))
        e.dataTransfer.effectAllowed = 'move'
      }}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('text/pochette')) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        if (!vise) setVise(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setVise(false)
      }}
      onDrop={(e) => {
        setVise(false)
        const id = Number(e.dataTransfer.getData('text/pochette'))
        if (!Number.isFinite(id) || !id) return
        e.preventDefault()
        onDeposeSur(id)
      }}
    >
      <div className="vig">
        <button
          className="doc-coche"
          role="checkbox"
          aria-checked={choisi}
          title={choisi ? 'Ne plus le choisir' : 'Le choisir — pour agir sur plusieurs documents à la fois'}
          aria-label={choisi ? 'Ne plus le choisir' : 'Le choisir'}
          onClick={onChoisir}
        >
          <IconCheck />
        </button>
        <button
          className="doc-loupe"
          title="Le regarder en grand — pour toi seul"
          aria-label="Le regarder en grand"
          onClick={() => setLoupe(true)}
        >
          <IconLoupe />
        </button>
        {doc.item.poster || doc.item.kind === 'image' ? (
          <img src={doc.item.poster ?? doc.item.url ?? ''} alt="" draggable={false} />
        ) : (
          <span className="sans-vignette">{kindIcon(doc.item.kind, 'ico')}</span>
        )}
        {doc.item.kind === 'video' && <span className="lire-film">▶</span>}
        {/*
          Pour un PDF, le badge dit en plus de quelle page vient l'aperçu, et
          s'ouvre en champ d'un clic : on change la vignette là où on la
          regarde. Pour le reste, il ne dit que la nature.
        */}
        {doc.item.kind === 'pdf' ? (
          <PageDuPdf page={doc.item.thumbPage} onPage={onPage} />
        ) : doc.item.kind !== 'image' ? (
          <span className="nature">{nature(doc.item.kind)}</span>
        ) : null}
        {montreRangement && <span className="range">{doc.ongletName ?? 'la pile'}</span>}
        {/* Tant qu'il est en réserve, la vignette le dit : c'est l'état qu'on
            doit lire d'un coup d'œil sur une pile de dix cartes. */}
        {!doc.visible && (
          <span className="reserve">
            <IconEyeOff />
            en réserve
          </span>
        )}
      </div>

      <div className="dit">
        {nom !== null ? (
          <SaisieNom valeur={nom} onFini={(v) => void renommer(v)} />
        ) : (
          <span className="t-ligne">
            <span
              className="t"
              title={`${doc.item.title} — double-clic pour le renommer`}
              onDoubleClick={() => setNom(doc.item.title)}
            >
              {doc.item.title}
            </span>
            <button
              className="doc-renommer"
              title="Le renommer"
              aria-label="Le renommer"
              onClick={() => setNom(doc.item.title)}
            >
              <IconPen />
            </button>
          </span>
        )}
        <span className="a-qui">
          <span className={`poche-pip c-${doc.playerColor ?? 'neutral'}`} />
          <span>
            {doc.playerId === null
              ? 'toute la table'
              : `${doc.characterName ?? doc.playerName} seul`}
          </span>
          <span className="h">{heureLocale(doc.givenAt)}</span>
        </span>
        {/* Ce qui n'est pas montré n'a pas de lecteur : la ligne dirait
            « personne ne l'a ouvert » d'un document que personne n'a pu voir. */}
        {doc.visible ? (
        <span className="lu">
          {yeux.map((p) => (
            <span
              key={p.id}
              className={`oeil c-${p.color ?? 'neutral'}${
                doc.luPar.includes(p.id) ? ' ouvert' : ''
              }`}
              title={`${p.name} — ${doc.luPar.includes(p.id) ? 'ouvert' : 'pas encore ouvert'}`}
            />
          ))}
          <span>
            {lus === 0
              ? 'personne ne l’a encore ouvert'
              : lus === yeux.length
                ? yeux.length === 1
                  ? 'ouvert'
                  : 'tous l’ont ouvert'
                : `${lus} l’ont ouvert`}
          </span>
        </span>
        ) : (
          <span className="lu attente">pas encore montré</span>
        )}
      </div>

      {/*
        Un seul mot lisible, celui qui compte — montrer ou cacher —, et le reste
        en icônes à infobulle. Trois libellés côte à côte ne tenaient pas dans
        la largeur d'une carte : `.btn` ne coupe pas son texte, il le laisse
        déborder sur son voisin.
      */}
      <div className="actes">
        <button
          className={`btn btn-sm poche-montrer${doc.visible ? ' on' : ' btn-brass'}`}
          title={
            doc.visible
              ? 'Le remettre en réserve — il disparaît de leur téléphone'
              : doc.playerId === null
                ? 'Le montrer à toute la table, sur leur téléphone'
                : `Le montrer à ${doc.characterName ?? doc.playerName}, sur son téléphone`
          }
          onClick={async () =>
            onPoser(await window.jdr.pochette.setVisible(doc.id, !doc.visible))
          }
        >
          {doc.visible ? <IconEye /> : <IconEyeOff />}
          {doc.visible ? 'Montré' : 'Montrer'}
        </button>
        <div className="spacer" />
        <button
          className="ico-acte"
          title="À qui il est donné"
          aria-label="À qui il est donné"
          onClick={() => onMenu(menu === 'qui' ? null : 'qui')}
        >
          <IconPeople />
        </button>
        {onglets.length > 0 && (
          <button
            className="ico-acte"
            title="Le ranger dans un autre onglet"
            aria-label="Le ranger dans un autre onglet"
            onClick={() => onMenu(menu === 'ou' ? null : 'ou')}
          >
            <IconPochette />
          </button>
        )}
        <button
          className="ico-acte"
          title="Ouvrir l’emplacement du fichier — l’explorateur, le fichier sélectionné"
          aria-label="Ouvrir l’emplacement du fichier"
          disabled={!doc.item.relPath}
          onClick={() => doc.item.relPath && void window.jdr.items.reveal(doc.item.relPath)}
        >
          <IconFolder />
        </button>
        <button
          className="ico-acte oter"
          title="Le retirer de la pochette"
          aria-label="Le retirer de la pochette"
          onClick={async () => onPoser(await window.jdr.pochette.remove(doc.id))}
        >
          <IconTrash />
        </button>
      </div>

      {menu === 'qui' && (
        <Choisir
          onClose={() => onMenu(null)}
          items={[
            { cle: 'tous', libelle: 'Toute la table', on: doc.playerId === null },
            /* Les joueurs de la séance — et celui qui l'a déjà, même absent. */
            ...joueurs.filter((p) => p.present || p.id === doc.playerId).map((p) => ({
              cle: String(p.id),
              libelle: `${p.characterName ?? p.name} seul`,
              sous: p.characterName ? p.name : undefined,
              couleur: p.color,
              on: doc.playerId === p.id
            }))
          ]}
          onPick={async (cle) => {
            onMenu(null)
            onPoser(
              await window.jdr.pochette.setPlayer(doc.id, cle === 'tous' ? null : Number(cle))
            )
          }}
        />
      )}

      {loupe && (
        <Visionneuse
          titre={doc.item.title}
          kind={doc.item.kind}
          url={doc.item.url ?? null}
          onClose={() => setLoupe(false)}
        />
      )}

      {menu === 'ou' && (
        <Choisir
          onClose={() => onMenu(null)}
          items={onglets.map((o) => ({
            cle: String(o.id),
            libelle: o.name,
            on: doc.ongletId === o.id
          }))}
          onPick={async (cle) => {
            onMenu(null)
            onPoser(await window.jdr.pochette.setOnglet(doc.id, Number(cle)))
          }}
        />
      )}
    </div>
  )
}

/* ============================================================
   Plusieurs cartes à la fois
   ============================================================ */

/**
 * La bande des cartes choisies : les montrer, les remettre en réserve, les
 * donner à toute la table ou à quelqu'un. Chaque geste passe carte par carte
 * — c'est le même que sur une seule — et la pochette se relit à la fin.
 */
function BarreSelection({
  docs,
  total,
  joueurs,
  onPoser,
  onTout,
  onVider
}: {
  docs: PochetteDoc[]
  total: number
  joueurs: Convive[]
  onPoser: (p: { onglets: PochetteOnglet[]; docs: PochetteDoc[] }) => void
  onTout: () => void
  onVider: () => void
}): JSX.Element {
  const s = useStore()
  const [qui, setQui] = useState(false)
  const n = docs.length
  const enReserve = docs.filter((d) => !d.visible)
  const montres = docs.filter((d) => d.visible)

  const pourChacun = async (
    lesquels: PochetteDoc[],
    geste: (d: PochetteDoc) => Promise<{ onglets: PochetteOnglet[]; docs: PochetteDoc[] }>,
    refus?: (n: number) => string
  ): Promise<void> => {
    let dernier: { onglets: PochetteOnglet[]; docs: PochetteDoc[] } | null = null
    let rates = 0
    for (const d of lesquels) {
      try {
        dernier = await geste(d)
      } catch (e) {
        rates++
        console.error('[pochette]', e)
      }
    }
    onPoser(dernier ?? (await window.jdr.pochette.list()))
    if (rates) s.toast(refus?.(rates) ?? `${rates} document${rates > 1 ? 's' : ''} n’ont pas bougé.`, true)
  }

  return (
    <div className="poche-selection" role="toolbar" aria-label="Documents choisis">
      <b className="num">
        {n} choisi{n > 1 ? 's' : ''}
      </b>
      <button
        className="btn btn-sm btn-brass"
        disabled={enReserve.length === 0}
        title="Les montrer, chacun à qui il est donné"
        onClick={() => void pourChacun(enReserve, (d) => window.jdr.pochette.setVisible(d.id, true))}
      >
        <IconEye />
        Montrer{enReserve.length && enReserve.length < n ? ` (${enReserve.length})` : ''}
      </button>
      <button
        className="btn btn-sm"
        disabled={montres.length === 0}
        title="Les remettre en réserve — ils disparaissent de leur téléphone"
        onClick={() => void pourChacun(montres, (d) => window.jdr.pochette.setVisible(d.id, false))}
      >
        <IconEyeOff />
        En réserve{montres.length && montres.length < n ? ` (${montres.length})` : ''}
      </button>
      <span className="sel-qui">
        <button className="btn btn-sm" aria-expanded={qui} onClick={() => setQui(!qui)}>
          <IconPeople />
          Qui le voit…
        </button>
        {qui && (
          <Choisir
            onClose={() => setQui(false)}
            items={[
              { cle: 'tous', libelle: 'Toute la table', on: docs.every((d) => d.playerId === null) },
              ...joueurs.filter((p) => p.present).map((p) => ({
                cle: String(p.id),
                libelle: `${p.characterName ?? p.name} seul`,
                sous: p.characterName ? p.name : undefined,
                couleur: p.color,
                on: docs.every((d) => d.playerId === p.id)
              }))
            ]}
            onPick={(cle) => {
              setQui(false)
              const playerId = cle === 'tous' ? null : Number(cle)
              void pourChacun(
                docs.filter((d) => d.playerId !== playerId),
                (d) => window.jdr.pochette.setPlayer(d.id, playerId),
                (r) =>
                  r > 1
                    ? `${r} documents étaient déjà donnés ainsi : laissés tels quels.`
                    : 'Un document était déjà donné ainsi : laissé tel quel.'
              )
            }}
          />
        )}
      </span>
      <div className="spacer" />
      {n < total ? (
        <button className="btn btn-ghost btn-sm" onClick={onTout}>
          Tout choisir ({total})
        </button>
      ) : null}
      <button className="btn btn-ghost btn-sm" title="Échap" onClick={onVider}>
        <IconClose />
        Désélectionner
      </button>
    </div>
  )
}

/**
 * De quelle page d'un PDF vient l'aperçu.
 *
 * Au repos, un badge : « pdf · p1 ». Cliqué, un champ. La page n'a pas de
 * plafond — on ne sait pas combien le fichier en porte, et le lecteur de
 * Chromium s'arrête de lui-même à la dernière.
 */
function PageDuPdf({
  page,
  onPage
}: {
  page: number
  onPage: (page: number) => void
}): JSX.Element {
  const [saisie, setSaisie] = useState<string | null>(null)

  if (saisie === null)
    return (
      <button
        className="nature nature-page"
        title={`L’aperçu vient de la page ${page} — cliquer pour en choisir une autre`}
        onClick={() => setSaisie(String(page))}
      >
        pdf<span className="p">p{page}</span>
      </button>
    )

  return (
    <input
      className="nature-saisie"
      type="number"
      min={1}
      autoFocus
      value={saisie}
      aria-label="Page de l’aperçu"
      onChange={(e) => setSaisie(e.target.value)}
      onBlur={() => {
        const n = Math.max(1, Math.trunc(Number(saisie)) || 1)
        setSaisie(null)
        if (n !== page) onPage(n)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') setSaisie(null)
      }}
    />
  )
}

/** Un petit menu posé sur la carte : le destinataire, ou le rangement. */
function Choisir({
  items,
  onPick,
  onClose
}: {
  items: { cle: string; libelle: string; sous?: string; couleur?: string | null; on: boolean }[]
  onPick: (cle: string) => void
  onClose: () => void
}): JSX.Element {
  return (
    <>
      <div className="doc-voile" onClick={onClose} />
      <div className="doc-menu" role="menu">
        {items.map((i) => (
          <button key={i.cle} role="menuitem" aria-current={i.on} onClick={() => onPick(i.cle)}>
            {i.couleur !== undefined && <span className={`poche-pip c-${i.couleur ?? 'neutral'}`} />}
            <span>
              {i.libelle}
              {i.sous ? <small>{i.sous}</small> : null}
            </span>
          </button>
        ))}
      </div>
    </>
  )
}

/** Le nouveau nom d'un document, saisi sur la carte. Entrée valide, Échap renonce. */
function SaisieNom({ valeur, onFini }: { valeur: string; onFini: (v: string | null) => void }): JSX.Element {
  const [v, setV] = useState(valeur)
  const renonce = useRef(false)
  return (
    <input
      className="doc-nom"
      autoFocus
      value={v}
      aria-label="Nom du document"
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => onFini(renonce.current ? null : v)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          renonce.current = true
          ;(e.target as HTMLInputElement).blur()
        }
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
    />
  )
}

/**
 * Nommer un onglet sur place, dans la barre — c'est là qu'on le lit, c'est là
 * qu'on le corrige. Échap renonce, Entrée valide, et perdre le champ vaut
 * validation : on ne piège personne dans une saisie.
 */
function SaisieOnglet({
  valeur,
  onFini
}: {
  valeur: string
  onFini: (nom: string | null) => void
}): JSX.Element {
  const [v, setV] = useState(valeur)
  /* Renoncer et valider passent tous deux par le flou du champ : sans ce
     drapeau, Échap validerait ce qu'on venait d'abandonner. */
  const renonce = useRef(false)

  return (
    <input
      className="poche-saisie"
      autoFocus
      value={v}
      placeholder="Nom de l’onglet"
      aria-label="Nom de l’onglet"
      onChange={(e) => setV(e.target.value)}
      onBlur={() => onFini(renonce.current ? null : v.trim() || null)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          renonce.current = true
          ;(e.target as HTMLInputElement).blur()
        }
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
    />
  )
}

function nature(kind: string): string {
  return { pdf: 'pdf', video: 'vidéo', audio: 'son', doc: 'texte' }[kind] ?? kind
}
