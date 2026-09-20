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
 * Le piège du module est de donner dans le vide : si le portable est fermé,
 * personne ne verra rien. La bande du haut le dit toujours, et ouvre la porte
 * sur place.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { ChoixDansArbre } from '../components/ChoixDansArbre'
import {
  IconClose,
  IconEye,
  IconEyeOff,
  IconPen,
  IconPeople,
  IconPlus,
  IconPochette,
  IconTrash,
  kindIcon
} from '../components/Icons'
import type { PochetteDoc, PochetteOnglet } from '@shared/types'

/**
 * Une personne autour de la table, telle que la pochette la nomme : le MJ
 * pense au personnage, la base tient la personne. On montre les deux, le
 * personnage d'abord — c'est à Adèle qu'on donne la lettre, pas à Marc.
 */
type Convive = { id: number; name: string; characterName: string | null; color: string | null }

/** Ce qui peut entrer dans la pochette : ce qu'on regarde, pas ce qu'on écoute. */
const ENTRANTS = ['image', 'pdf', 'video'] as const

/** « Tout » n'est pas un onglet : c'est la pile entière. */
const TOUT = 'tout'
type Rangement = typeof TOUT | number

export function Pochette(): JSX.Element {
  const s = useStore()
  const [rangement, setRangement] = useState<Rangement>(TOUT)
  const [choix, setChoix] = useState(false)
  /** Le document dont on ouvre le menu « donner à » ou « ranger ». */
  const [menu, setMenu] = useState<{ id: number; quoi: 'qui' | 'ou' } | null>(null)
  /** L'onglet qu'on est en train de nommer — `0` pour un onglet neuf. */
  const [nomme, setNomme] = useState<number | null>(null)

  const onglets = s.pochetteOnglets
  const docs = s.pochette

  /* L'onglet ouvert peut disparaître sous nos pieds — on le retire, ou une
     autre fenêtre le retire. On retombe alors sur la pile entière. */
  useEffect(() => {
    if (rangement !== TOUT && !onglets.some((o) => o.id === rangement)) setRangement(TOUT)
  }, [onglets, rangement])

  const vus = useMemo(
    () => (rangement === TOUT ? docs : docs.filter((d) => d.ongletId === rangement)),
    [docs, rangement]
  )

  const convives: Convive[] = useMemo(
    () =>
      s.players.map((p) => ({
        id: p.id,
        name: p.name,
        characterName: s.characters.find((c) => c.id === p.characterId)?.name ?? null,
        color: p.color
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
                onDragOver={(e) => e.preventDefault()}
                onDrop={async (e) => {
                  e.preventDefault()
                  const id = Number(e.dataTransfer.getData('text/pochette'))
                  if (Number.isFinite(id)) poser(await window.jdr.pochette.setOnglet(id, o.id))
                }}
              >
                {o.name}
                <span className="n">{o.count}</span>
                {/* Renommer et retirer ne se montrent que sur l'onglet ouvert :
                    on ne défait pas un rangement en visant celui d'à côté. */}
                {rangement === o.id && (
                  <span className="tenir">
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
                        poser(await window.jdr.pochette.removeOnglet(o.id))
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
        <div className="poche">
          {vus.map((d) => (
            <Carte
              key={d.id}
              doc={d}
              /* Le rangement ne se rappelle que dans « Tout » : ailleurs, on
                 sait déjà où l'on est. */
              montreRangement={rangement === TOUT && onglets.length > 0}
              joueurs={convives}
              menu={menu?.id === d.id ? menu.quoi : null}
              onMenu={(quoi) => setMenu(quoi ? { id: d.id, quoi } : null)}
              onglets={onglets}
              onPoser={poser}
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
          onPick={async (id) => {
            setChoix(false)
            if (id === null) return
            /* Le même document, au même destinataire, ne fait qu'une entrée —
               la base le garantit. Un geste sans effet doit se dire, sinon on
               le refait trois fois en se demandant pourquoi rien ne bouge. */
            const avant = docs.length
            const apres = await window.jdr.pochette.add(
              id,
              null,
              rangement === TOUT ? null : rangement
            )
            poser(apres)
            if (apres.docs.length === avant) {
              s.toast('Ce document est déjà dans la pochette, pour toute la table.')
            }
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
        {s.players.map((p) => (
          <span
            key={p.id}
            className={`poche-pip c-${p.color ?? 'neutral'}${
              s.mobile?.devices.some((d) => d.playerId === p.id && d.online) ? '' : ' absent'
            }`}
            title={`${p.name}${
              s.mobile?.devices.some((d) => d.playerId === p.id && d.online)
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
  montreRangement,
  joueurs,
  onglets,
  menu,
  onMenu,
  onPoser,
  onPage
}: {
  doc: PochetteDoc
  montreRangement: boolean
  joueurs: Convive[]
  onglets: PochetteOnglet[]
  menu: 'qui' | 'ou' | null
  onMenu: (quoi: 'qui' | 'ou' | null) => void
  onPoser: (p: { onglets: PochetteOnglet[]; docs: PochetteDoc[] }) => void
  /** Changer la page dont on tire l'aperçu d'un PDF. */
  onPage: (page: number) => void
}): JSX.Element {
  /* Un document remis à quelqu'un n'a qu'une paire d'yeux à attendre ; un
     document remis à la table les a toutes. */
  const yeux = doc.playerId === null ? joueurs : joueurs.filter((p) => p.id === doc.playerId)
  const lus = yeux.filter((p) => doc.luPar.includes(p.id)).length

  return (
    <div
      className={`doc${doc.visible ? '' : ' en-reserve'}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/pochette', String(doc.id))
        e.dataTransfer.effectAllowed = 'move'
      }}
    >
      <div className="vig">
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
        <span className="t" title={doc.item.title}>
          {doc.item.title}
        </span>
        <span className="a-qui">
          <span className={`poche-pip c-${doc.playerColor ?? 'neutral'}`} />
          <span>
            {doc.playerId === null
              ? 'toute la table'
              : `${doc.characterName ?? doc.playerName} seul`}
          </span>
          <span className="h">{doc.givenAt.slice(11, 16)}</span>
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
            ...joueurs.map((p) => ({
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
