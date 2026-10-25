/**
 * La réserve de la campagne : ce qui se trouve, se ramasse, se porte.
 *
 * **Un modèle, des exemplaires.** On décrit la lanterne une fois — ce qu'on en
 * voit, ce qu'elle fait, ce qu'elle pèse — puis on la pose autant de fois qu'on
 * veut : dans un lieu, sur un PNJ, dans le sac d'un joueur. Corriger sa
 * description corrige toutes celles qui traînent dans la campagne, et c'est
 * tout l'intérêt : le MJ n'écrit pas seize fois la même lanterne.
 *
 * Trois colonnes, hauteur fixe, chacune qui défile chez elle : les rayons,
 * l'étagère, la fiche de l'objet ouvert.
 *
 * Ce que le MJ sait d'un objet **ne sort jamais** : ce module n'appelle aucun
 * canal de diffusion, exactement comme les annotations et les murs.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { currentObjet, itemById, useStore } from '../store'
import {
  IconClose,
  IconCoffre,
  IconCrop,
  IconDonner,
  IconLoupe,
  IconEye,
  IconEyeOff,
  IconImage,
  IconPeople,
  IconPlace,
  IconPochette,
  IconPlus,
  IconPoser,
  IconRetour,
  IconRouage,
  IconSearch,
  IconSliders,
  IconTrash,
  IconVerrou,
  glypheObjet
} from '../components/Icons'
import { ChoixDansArbre } from '../components/ChoixDansArbre'
import { Pop } from '../components/Pop'
import { Valeur } from '../components/Valeur'
import { CLAIR_DE_TORCHE } from '../../shared/Lueur'
import { champDeVision, polygone, type Barriere } from '@shared/murs'
import { MenuDonner } from '../components/MenuDonner'
import { BandeJoueurs, TYPE_EXEMPLAIRE, TYPE_OBJET } from '../components/BandeJoueurs'
import { AlerteLieux, lieuxDe } from '../components/ObjetsDuLieu'
import { ModaleNouvelObjet } from '../components/NouvelObjet'
import { RognageCarre } from '../components/RognageCarre'
import { Piece } from '../../shared/Piece'
import { ditMontant, monnaiesActives, type Monnaie } from '@shared/monnaies'
import { ditPlaces, refusSac } from '@shared/sac'
import {
  BoutonCorbeille,
  Confirmer,
  Depart,
  FiltreEmplacement,
  clesOu,
  ModaleRanger,
  VueCorbeille,
  deplaces,
  ditInitial
} from '../components/Rangement'
import {
  EMPLACEMENTS_OBJET,
  FAISCEAUX_LUMIERE,
  GLYPHES_OBJET,
  TEINTES_LUMIERE,
  estLumiere,
  PION_COULEURS,
  emplacementsDe
} from '@shared/types'
import type {
  EffetObjet,
  GlypheObjet,
  Inventaire,
  Objet,
  ObjetFamille,
  ObjetPlacement,
  PortObjet
} from '@shared/types'
import { useEchap } from '../echap'

/** Le rayon des objets qu'aucune famille ne réclame. */
const SANS_FAMILLE = -1


/* ============================================================
   La vue
   ============================================================ */

export function Objets(): JSX.Element {
  const s = useStore()
  const o = currentObjet(s)
  const [rayon, setRayon] = useState<number | 'tout'>('tout')
  const [filtre, setFiltre] = useState('')
  const [enListe, setEnListe] = useState(false)
  const [reglages, setReglages] = useState<{ x: number; y: number } | null>(null)
  const [familles, setFamilles] = useState(false)
  const rafale = useRef<HTMLInputElement>(null)
  /* Un inventaire ouvert au centre prend la place de l'étagère. */
  const [inventaireVu, setInventaireVu] = useState<number | null>(null)
  const inv = s.inventaires.find((i) => i.id === inventaireVu) ?? null
  /* La corbeille aussi, tant qu'aucun inventaire n'est ouvert. */
  const [corbeilleVue, setCorbeilleVue] = useState(false)
  const corbeille = corbeilleVue && !inv
  const [rangerOuvert, setRangerOuvert] = useState(false)
  const [nouvelObjet, setNouvelObjet] = useState(false)
  const nDeplaces = useMemo(() => deplaces(s.objets).length, [s.objets])
  const choisirRayon = (r: number | 'tout'): void => {
    setRayon(r)
    setInventaireVu(null)
    setCorbeilleVue(false)
  }
  const voirInventaire = (id: number): void => {
    setInventaireVu(id)
    setCorbeilleVue(false)
  }

  /* Le rayon suit l'objet qu'on ouvre depuis « Tout » ? Non : on trie
     l'étagère, on ne la fait pas sauter sous la main. Seul un rayon devenu
     vide — sa famille retirée — ramène à « Tout ». */
  const rayons = useMemo(() => s.objetFamilles.filter((f) => !f.masquee), [s.objetFamilles])
  useEffect(() => {
    if (rayon === 'tout' || rayon === SANS_FAMILLE) return
    if (!rayons.some((f) => f.id === rayon)) setRayon('tout')
  }, [rayons, rayon])

  const mot = filtre.trim().toLowerCase()
  /* Les endroits cochés dans « Emplacement » ; vide, tout passe. */
  const [ou, setOu] = useState<Set<string>>(new Set())
  /* Un endroit que le dernier objet vient de quitter ne filtre plus rien :
     sans quoi l'étagère resterait vide derrière un filtre qui ne se voit plus. */
  const ouActifs = useMemo(() => {
    const presents = new Set(s.objets.flatMap(clesOu))
    return new Set([...ou].filter((c) => presents.has(c)))
  }, [s.objets, ou])
  useEffect(() => {
    if (ouActifs.size !== ou.size) setOu(ouActifs)
  }, [ouActifs, ou])
  const visibles = useMemo(
    () =>
      s.objets.filter(
        (x) =>
          (rayon === 'tout' ||
            (rayon === SANS_FAMILLE ? x.familleId == null : x.familleId === rayon)) &&
          (mot === '' || x.nom.toLowerCase().includes(mot)) &&
          (ouActifs.size === 0 || clesOu(x).some((c) => ouActifs.has(c)))
      ),
    [s.objets, rayon, mot, ouActifs]
  )

  const creer = async (nom: string): Promise<void> => {
    const neuf = await window.jdr.objets.add({
      nom,
      familleId: rayon === 'tout' || rayon === SANS_FAMILLE ? null : rayon
    })
    await s.refreshObjets()
    s.setCurrentObjet(neuf.id)
  }

  return (
    <section className="view objview">
      <div className="vhead">
        <div>
          <h2>Objets</h2>
          <p>
            Ce que la campagne contient de matériel. Un objet se décrit une fois&nbsp;; on le pose
            ensuite autant de fois qu’on veut — dans un lieu, sur un PNJ, dans un sac.
          </p>
        </div>
        <div className="spacer" />
        <button
          className="btn btn-sm"
          onClick={() => setRangerOuvert(true)}
          title="Remettre à leur emplacement initial les objets qui ont bougé pendant la partie"
        >
          <IconRetour />
          Ranger
          {nDeplaces > 0 ? <span className="rgm-badge num">{nDeplaces}</span> : null}
        </button>
        <button
          className="btn btn-sm"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            setReglages({ x: r.left, y: r.bottom + 6 })
          }}
          title="Les catégories de la réserve, et l’unité de valeur de la campagne"
        >
          <IconSliders />
          Réglages
        </button>
        <button className="btn btn-brass btn-sm" onClick={() => setNouvelObjet(true)}>
          <IconPlus />
          Nouvel objet
        </button>
      </div>

      <div className="obj-shell">
        {/* ---------------- les rayons ---------------- */}
        <div className="pane">
          <div className="pane-head">
            <span className="eyebrow">Catégories</span>
            <div className="spacer" />
            <button
              className="btn btn-ghost btn-sm btn-ico"
              onClick={() => setFamilles(true)}
              title="Régler les catégories : leur nom, leur couleur"
              aria-label="Régler les catégories"
            >
              <IconRouage />
            </button>
          </div>
          <div className="pane-body">
            <button
              className={`fam-btn${!inv && !corbeille && rayon === 'tout' ? ' on' : ''}`}
              onClick={() => choisirRayon('tout')}
            >
              <span className="pastille tout" />
              <span className="lib">Tout</span>
              <span className="n">{s.objets.length}</span>
            </button>
            <div className="fam-sep" />
            {rayons.map((f) => (
              <button
                key={f.id}
                className={`fam-btn${!inv && !corbeille && rayon === f.id ? ' on' : ''}`}
                onClick={() => choisirRayon(f.id)}
              >
                <span className={`pastille c-${f.teinte}`} />
                <span className="lib">{f.nom}</span>
                <span className="n">{s.objets.filter((x) => x.familleId === f.id).length}</span>
              </button>
            ))}
            {/* Les objets qu'aucun rayon ne réclame : ils existent, ils doivent
                se retrouver, sans quoi une famille retirée les enterrerait. */}
            {s.objets.some((x) => x.familleId == null) ? (
              <>
                <div className="fam-sep" />
                <button
                  className={`fam-btn${!inv && !corbeille && rayon === SANS_FAMILLE ? ' on' : ''}`}
                  onClick={() => choisirRayon(SANS_FAMILLE)}
                  title="Les objets qui n’ont pas de catégorie"
                >
                  <span className="pastille" />
                  <span className="lib">Sans catégorie</span>
                  <span className="n">{s.objets.filter((x) => x.familleId == null).length}</span>
                </button>
              </>
            ) : null}

            {/* Les inventaires partagés : le camion, la malle. On y lâche une
                carte de l'étagère pour l'y ranger. */}
            <div className="fam-sep" />
            <span className="eyebrow inv-titre">Inventaires</span>
            {s.inventaires.map((i) => (
              <BoutonInventaire
                key={i.id}
                inv={i}
                on={inv?.id === i.id}
                onChoisir={() => voirInventaire(i.id)}
              />
            ))}
            <button
              className="fam-btn inv-neuf"
              onClick={async () => {
                const neuf = await window.jdr.objets.inventaireAdd('Nouvel inventaire')
                await s.refreshObjets()
                voirInventaire(neuf.id)
              }}
              title="Un inventaire que les joueurs pourront ouvrir sur leur portable"
            >
              <IconPlus />
              <span className="lib">Nouvel inventaire</span>
            </button>

            {/* Ce qu'on a retiré aux joueurs attend ici qu'on le range. */}
            <div className="fam-sep" />
            <BoutonCorbeille
              on={corbeille}
              onChoisir={() => {
                setInventaireVu(null)
                setCorbeilleVue(true)
              }}
            />
          </div>
        </div>

        {/* ---------------- l'étagère, ou l'inventaire choisi ---------------- */}
        {corbeille ? (
          <VueCorbeille />
        ) : inv ? (
          <VueInventaire key={inv.id} inv={inv} onSupprime={() => setInventaireVu(null)} />
        ) : (
          <div className="pane">
            <div className="pane-head">
              <label className="filtre-inline">
                <IconSearch />
                <input
                  type="text"
                  value={filtre}
                  onChange={(e) => setFiltre(e.target.value)}
                  placeholder="Filtrer les objets"
                  aria-label="Filtrer les objets"
                />
              </label>
              <FiltreEmplacement choisis={ou} onChange={setOu} />
              <span className="compte num">
                {visibles.length === 0
                  ? 'aucun objet'
                  : `${visibles.length} objet${visibles.length > 1 ? 's' : ''}`}
              </span>
              <div className="spacer" />
              <div className="seg" role="group" aria-label="Grille ou liste">
                <button className={enListe ? '' : 'on'} onClick={() => setEnListe(false)}>
                  Grille
                </button>
                <button className={enListe ? 'on' : ''} onClick={() => setEnListe(true)}>
                  Liste
                </button>
              </div>
            </div>

            <div className="pane-body">
              {s.objets.length === 0 ? (
                <div className="empty">
                  <IconCoffre />
                  <b>La réserve est vide</b>
                  Tape un nom en bas de l’étagère&nbsp;: l’objet existe aussitôt, sa fiche s’ouvre à
                  droite pour le décrire.
                </div>
              ) : visibles.length === 0 ? (
                <p className="rien-objet">
                  Rien sous ce filtre. Tape un nom en bas pour en créer un ici.
                </p>
              ) : enListe ? (
                <ListeObjets objets={visibles} familles={s.objetFamilles} monnaies={monnaiesActives(s.reglages.monnaies)} />
              ) : (
                <GrilleObjets objets={visibles} familles={s.objetFamilles} />
              )}
            </div>

            <div className="pane-foot">
              {/* Créer en rafale, comme les lieux : un nom, Entrée, et le champ
                  reste sous la main pour le suivant. */}
              <div className="rafale">
                <IconPlus />
                <input
                  ref={rafale}
                  type="text"
                  placeholder="Un objet de plus — tape son nom"
                  aria-label="Créer un objet"
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    const nom = e.currentTarget.value.trim()
                    if (!nom) return
                    e.currentTarget.value = ''
                    void creer(nom)
                  }}
                />
                <span className="aide">Entrée</span>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- la fiche ---------------- */}
        {o ? (
          <FicheObjet key={o.id} o={o} />
        ) : (
          <div className="pane">
            <div className="pane-head">
              <span className="eyebrow">La fiche de l’objet</span>
            </div>
            <div className="pane-body">
              <p className="rien-objet">Choisis un objet sur l’étagère.</p>
            </div>
          </div>
        )}
      </div>

      {/* Au pied de la réserve, qui possède quoi — et où on lâche ce qu'on
          leur donne. */}
      <BandeJoueurs />

      {reglages ? (
        <PanneauReglages x={reglages.x} y={reglages.y} onClose={() => setReglages(null)} />
      ) : null}
      {rangerOuvert ? <ModaleRanger onClose={() => setRangerOuvert(false)} /> : null}
      {nouvelObjet ? (
        <ModaleNouvelObjet
          familleDepart={rayon === 'tout' || rayon === SANS_FAMILLE ? null : rayon}
          onClose={() => setNouvelObjet(false)}
        />
      ) : null}
      {familles ? (
        <ModaleFamilles
          depart={rayon === 'tout' || rayon === SANS_FAMILLE ? null : rayon}
          onClose={() => setFamilles(false)}
        />
      ) : null}
    </section>
  )
}

/* ============================================================
   L'étagère
   ============================================================ */

function vignetteObjet(o: Objet, familles: ObjetFamille[]): JSX.Element {
  const s = useStore.getState()
  const f = familles.find((x) => x.id === o.familleId) ?? null
  const img = itemById(s.allItems, o.imageItemId)
  const url = img?.poster ?? img?.url ?? null
  if (url) return <img src={url} alt="" />
  return glypheObjet(f?.glyphe ?? 'outils', 'glyphe')
}

function GrilleObjets({
  objets,
  familles
}: {
  objets: Objet[]
  familles: ObjetFamille[]
}): JSX.Element {
  const s = useStore()
  /* L'image en grand au survol de la vignette : la carte la rogne, l'aperçu
     la montre entière. Un temps d'arrêt avant, pour qu'un curseur qui ne
     fait que passer sur l'étagère n'allume rien. */
  const [apercu, setApercu] = useState<{ url: string; rect: DOMRect } | null>(null)
  const attente = useRef<number | null>(null)
  const oublier = (): void => {
    if (attente.current) clearTimeout(attente.current)
    attente.current = null
    setApercu(null)
  }
  useEffect(() => oublier, [])
  return (
    <div className="etagere">
      {objets.map((o) => {
        const f = familles.find((x) => x.id === o.familleId) ?? null
        const n = o.placements.reduce((t, p) => t + p.qte, 0)
        const img = itemById(s.allItems, o.imageItemId)
        const url = img?.poster ?? img?.url ?? null
        return (
          <button
            key={o.id}
            className={`obj-carte${o.id === s.currentObjetId ? ' on' : ''}`}
            onClick={() => s.setCurrentObjet(o.id)}
            /* On l'attrape pour le lâcher sur un joueur, en bas. */
            draggable
            onDragStart={(e) => {
              oublier()
              e.dataTransfer.setData(TYPE_OBJET, String(o.id))
              /* Le même en texte : si le type maison ne survit pas au voyage,
                 la cible sait quand même ce qu'elle reçoit. */
              e.dataTransfer.setData('text/plain', `jdr:objet:${o.id}`)
              e.dataTransfer.effectAllowed = 'copy'
            }}
          >
            <span
              className={`vignette c-${f?.teinte ?? 'neutral'}`}
              onMouseEnter={(e) => {
                if (!url) return
                const rect = e.currentTarget.getBoundingClientRect()
                if (attente.current) clearTimeout(attente.current)
                attente.current = window.setTimeout(() => setApercu({ url, rect }), 250)
              }}
              onMouseLeave={oublier}
            >
              {vignetteObjet(o, familles)}
              {n > 0 ? <span className="posee num">posé {n}×</span> : null}
              {!o.unique ? <span className="qte num">×{o.qte}</span> : null}
            </span>
            <span className="nom">
              {o.nom}
              {lieuxDe(o).length > 1 ? <AlerteLieux lieux={lieuxDe(o)} /> : null}
            </span>
            <span className="sous">
              {f?.nom ?? 'sans catégorie'}
            </span>
            <OuIlEst o={o} />
          </button>
        )
      })}
      {apercu ? <ApercuObjet {...apercu} /> : null}
    </div>
  )
}

/** Taille maximale de l'aperçu, et l'écart qu'il garde avec la carte. */
const APERCU = 350
const ECART = 12

/**
 * L'image entière, à côté de la vignette : à droite s'il y a la place, à
 * gauche sinon, centrée sur elle sans sortir de la fenêtre. Elle ne prend
 * jamais le curseur — elle ne doit rien masquer de ce qu'on vise.
 */
function ApercuObjet({ url, rect }: { url: string; rect: DOMRect }): JSX.Element {
  const aDroite = rect.right + ECART + APERCU <= window.innerWidth
  const milieu = rect.top + rect.height / 2
  const haut = Math.max(ECART + APERCU / 2, Math.min(window.innerHeight - ECART - APERCU / 2, milieu))
  return createPortal(
    <div
      className="obj-survol"
      style={
        aDroite
          ? { left: rect.right + ECART, top: haut }
          : { right: window.innerWidth - rect.left + ECART, top: haut }
      }
    >
      <img src={url} alt="" />
    </div>,
    document.body
  )
}

/* ============================================================
   Les inventaires partagés
   ============================================================ */

/** Ce qu'on lâche sur un inventaire : une carte de la réserve, ou un exemplaire. */
function lireLacher(dt: DataTransfer): { objetId: number; placementId: number } {
  const secours = /^jdr:(objet|exemplaire):(\d+)$/.exec(dt.getData('text/plain'))
  return {
    objetId: Number(dt.getData(TYPE_OBJET)) || (secours?.[1] === 'objet' ? Number(secours[2]) : 0),
    placementId:
      Number(dt.getData(TYPE_EXEMPLAIRE)) || (secours?.[1] === 'exemplaire' ? Number(secours[2]) : 0)
  }
}

/**
 * Un inventaire dans la colonne de gauche. On y lâche une carte de l'étagère
 * pour l'y ranger, ou une affaire d'un joueur, depuis la bande du bas, pour
 * la lui reprendre.
 */
function BoutonInventaire({
  inv,
  on,
  onChoisir
}: {
  inv: Inventaire
  on: boolean
  onChoisir: () => void
}): JSX.Element {
  const s = useStore()
  const [vise, setVise] = useState(false)
  const n = s.objets.reduce(
    (t, o) => t + o.placements.filter((p) => p.inventaireId === inv.id).reduce((u, p) => u + p.qte, 0),
    0
  )
  return (
    <button
      className={`fam-btn inv-btn${on ? ' on' : ''}${vise ? ' vise' : ''}`}
      onClick={onChoisir}
      onDragOver={(e) => {
        const types = Array.from(e.dataTransfer.types)
        if (!types.includes(TYPE_OBJET) && !types.includes(TYPE_EXEMPLAIRE) && !types.includes('text/plain'))
          return
        e.preventDefault()
        e.dataTransfer.dropEffect = types.includes(TYPE_EXEMPLAIRE) ? 'move' : 'copy'
        if (!vise) setVise(true)
      }}
      onDragLeave={() => setVise(false)}
      onDrop={async (e) => {
        e.preventDefault()
        setVise(false)
        const { objetId, placementId } = lireLacher(e.dataTransfer)
        try {
          if (placementId) await window.jdr.objets.remettre(placementId, inv.id)
          else if (objetId) {
            const ajoutes = await window.jdr.objets.remplir(inv.id, [objetId])
            if (!ajoutes)
              s.toast('Déjà au complet dans cet inventaire, ou pièce unique posée ailleurs.', true)
          } else return
          await s.refreshObjets()
        } catch (err) {
          s.toast(refusSac(err) ?? 'L’objet n’a pas été rangé.', true)
          console.error('[inventaire]', err)
        }
      }}
      title={
        inv.ouvert
          ? 'Dans le Sac : les joueurs y piochent depuis leur portable'
          : inv.enPochette
            ? 'Dans la Pochette : les joueurs en voient les images'
            : 'Fermé aux joueurs'
      }
    >
      <IconCoffre />
      <span className="lib">{inv.nom}</span>
      {inv.ouvert ? <span className="inv-ouvert">ouvert</span> : null}
      {inv.enPochette ? <span className="inv-ouvert">pochette</span> : null}
      <span className="n">{n}</span>
    </button>
  )
}

/**
 * L'inventaire ouvert au centre, à la place de l'étagère : son nom, s'il est
 * ouvert aux joueurs, ce qu'il contient et ce qui est passé par là.
 */
function VueInventaire({ inv, onSupprime }: { inv: Inventaire; onSupprime: () => void }): JSX.Element {
  const s = useStore()
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [choix, setChoix] = useState(false)
  const [suppr, setSuppr] = useState(false)
  const contenu = s.objets.flatMap((o) =>
    o.placements.filter((p) => p.inventaireId === inv.id).map((p) => ({ o, p }))
  )
  contenu.sort((a, b) => a.o.nom.localeCompare(b.o.nom, 'fr'))
  const rayons = s.objetFamilles.filter((f) => !f.masquee)

  /* Ce que la Pochette ne montrera pas : un objet sans image n'a rien à y faire voir. */
  const sansImage = contenu.filter(({ o }) => o.imageItemId == null).length
  const maj = async (patch: { nom?: string; ouvert?: boolean; enPochette?: boolean }): Promise<void> => {
    await window.jdr.objets.inventaireUpdate(inv.id, patch)
    await s.refreshObjets()
  }
  const remplir = async (ids: number[]): Promise<void> => {
    const n = await window.jdr.objets.remplir(inv.id, ids)
    await s.refreshObjets()
    /* Rangés, ils apparaissent sous la main : rien à dire. Rien de rangé, en
       revanche, doit se voir — seuls les ratés s'affichent en bas d'écran. */
    if (n === 0)
      s.toast(
        ids.length === 0
          ? 'Ce rayon est vide.'
          : 'Rien à ranger : déjà au complet ici, ou pièces uniques posées ailleurs.',
        true
      )
  }

  return (
    <div className="pane inv-vue">
      <div className="pane-head inv-tete">
        <IconCoffre />
        <input
          className="inv-nom"
          defaultValue={inv.nom}
          aria-label="Nom de l’inventaire"
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          onBlur={(e) => {
            const nom = e.target.value.trim()
            if (!nom) e.target.value = inv.nom
            else if (nom !== inv.nom) void maj({ nom })
          }}
        />
        <div className="spacer" />
        {/* Fermé, dans le Sac pour y piocher, ou dans la Pochette pour voir. */}
        <div className="inv-mode" role="radiogroup" aria-label="Ce que les joueurs en voient">
          <button
            role="radio"
            aria-checked={!inv.ouvert && !inv.enPochette}
            onClick={() => void maj({ ouvert: false, enPochette: false })}
            title="Personne ne le voit sur son portable"
          >
            Fermé
          </button>
          <button
            role="radio"
            aria-checked={inv.ouvert}
            onClick={() => void maj({ ouvert: true })}
            title="Dans la page Sac des portables : chacun y pioche"
          >
            Dans le Sac
          </button>
          <button
            role="radio"
            aria-checked={inv.enPochette}
            onClick={() => void maj({ enPochette: true })}
            title="Dans la Pochette, un onglet à son nom : les images de ce qu’il tient, à regarder"
          >
            Dans la Pochette
          </button>
        </div>
      </div>

      <div className="pane-body inv-corps">
        <p className="inv-aide">
          {inv.ouvert
            ? 'Visible sur tous les portables, dans la page Sac. Chacun pioche : l’objet tombe dans son sac. Il peut aussi y remettre ce qu’il a.'
            : inv.enPochette
              ? `Dans la Pochette de toute la table, onglet « ${inv.nom} » : on y voit l’image de chaque objet, sans rien prendre. Ce que tu y ranges la rejoint.${
                  sansImage
                    ? ` ${sansImage} objet${sansImage > 1 ? 's' : ''} sans image n’y ${sansImage > 1 ? 'sont' : 'est'} pas.`
                    : ''
                }`
              : 'Personne ne le voit sur son portable. Remplis-le tranquillement avant de l’ouvrir.'}
        </p>
        <div className="inv-outils">
          <button
            className="btn btn-sm"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect()
              setMenu({ x: r.left, y: r.bottom + 4 })
            }}
          >
            <IconPlus />
            Remplir depuis la réserve
          </button>
          <span className="inv-aide">ou glisse une carte de l’étagère sur « {inv.nom} », à gauche</span>
        </div>

        {contenu.length === 0 ? (
          <p className="rien-objet">Inventaire vide. Remplis-le depuis la réserve.</p>
        ) : (
          <div className="etagere">
            {contenu.map(({ o, p }) => {
              const f = s.objetFamilles.find((x) => x.id === o.familleId) ?? null
              return (
                <div
                  key={p.id}
                  className={`obj-carte${o.id === s.currentObjetId ? ' on' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => s.setCurrentObjet(o.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') s.setCurrentObjet(o.id)
                  }}
                  /* On l'attrape pour le donner à un joueur, en bas. */
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(TYPE_EXEMPLAIRE, String(p.id))
                    e.dataTransfer.setData('text/plain', `jdr:exemplaire:${p.id}`)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                >
                  <span className={`vignette c-${f?.teinte ?? 'neutral'}`}>
                    {vignetteObjet(o, s.objetFamilles)}
                    {p.qte > 1 ? <span className="qte num">×{p.qte}</span> : null}
                  </span>
                  <span className="nom">{o.nom}</span>
                  {/* Combien il en reste dedans : chaque pioche en ôte un. On
                      n'en remet pas plus que la quantité de l'objet. */}
                  {o.unique ? null : (
                    <span className="inv-qte" onClick={(e) => e.stopPropagation()}>
                      <button
                        disabled={p.qte <= 1}
                        onClick={async () => {
                          await window.jdr.objets.placement(p.id, { qte: p.qte - 1 })
                          await s.refreshObjets()
                        }}
                        title="Un de moins"
                        aria-label={`Un ${o.nom} de moins`}
                      >
                        −
                      </button>
                      <span className="num">{p.qte}</span>
                      <button
                        disabled={p.qte >= o.qte}
                        onClick={async () => {
                          await window.jdr.objets.placement(p.id, { qte: p.qte + 1 })
                          await s.refreshObjets()
                        }}
                        title={
                          p.qte >= o.qte
                            ? `Pas plus que sa quantité : ${o.qte} — à changer dans sa fiche`
                            : 'Un de plus'
                        }
                        aria-label={`Un ${o.nom} de plus`}
                      >
                        +
                      </button>
                    </span>
                  )}
                  <button
                    className="inv-retirer"
                    onClick={async (e) => {
                      e.stopPropagation()
                      await window.jdr.objets.reprendre(p.id)
                      await s.refreshObjets()
                    }}
                    title="Le retirer de l’inventaire — il reste dans la réserve"
                    aria-label={`Retirer ${o.nom}`}
                  >
                    <IconClose />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <div className="inv-journal">
          <span className="eyebrow">Ce qui est passé par là</span>
          {inv.journal.length === 0 ? (
            <p className="inv-aide">Rien encore depuis le lancement.</p>
          ) : (
            <ul>
              {[...inv.journal].reverse().slice(0, 8).map((l, i) => (
                <li key={i}>
                  <time className="num">{l.heure}</time>
                  {l.texte}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="pane-foot inv-pied">
        {suppr ? (
          <>
            <span className="inv-aide">Supprimer « {inv.nom} » ? Son contenu retourne dans la réserve.</span>
            <div className="spacer" />
            <button className="btn btn-sm" onClick={() => setSuppr(false)}>
              Garder
            </button>
            <button
              className="btn btn-sm btn-danger"
              onClick={async () => {
                await window.jdr.objets.inventaireRemove(inv.id)
                await s.refreshObjets()
                onSupprime()
              }}
            >
              Supprimer
            </button>
          </>
        ) : (
          <>
            <div className="spacer" />
            <button className="btn btn-ghost btn-sm" onClick={() => setSuppr(true)}>
              <IconTrash />
              Supprimer l’inventaire
            </button>
          </>
        )}
      </div>

      {menu ? (
        <Pop x={menu.x} y={menu.y} className="inv-menu" onClose={() => setMenu(null)}>
          <span className="eyebrow">Tout un rayon</span>
          {rayons.map((f) => (
            <button
              key={f.id}
              className="opt"
              onClick={() => {
                setMenu(null)
                void remplir(s.objets.filter((o) => o.familleId === f.id).map((o) => o.id))
              }}
            >
              <span className={`pastille c-${f.teinte}`} />
              <span className="t">{f.nom}</span>
              <span className="n num">{s.objets.filter((o) => o.familleId === f.id).length}</span>
            </button>
          ))}
          <hr />
          <button
            className="opt"
            onClick={() => {
              setMenu(null)
              setChoix(true)
            }}
          >
            <span className="t">Choisir des objets un par un…</span>
          </button>
        </Pop>
      ) : null}
      {choix ? (
        <ModaleRemplir
          inv={inv}
          onClose={() => setChoix(false)}
          onRanger={async (ids) => {
            setChoix(false)
            await remplir(ids)
          }}
        />
      ) : null}
    </div>
  )
}

/** Choisir, case par case, ce qu'on range dans un inventaire. */
function ModaleRemplir({
  inv,
  onClose,
  onRanger
}: {
  inv: Inventaire
  onClose: () => void
  onRanger: (ids: number[]) => void | Promise<void>
}): JSX.Element {
  const s = useStore()
  const [mot, setMot] = useState('')
  const [pris, setPris] = useState<Set<number>>(new Set())
  useEchap(onClose)
  const m = mot.trim().toLowerCase()
  const liste = s.objets.filter((o) => !m || o.nom.toLowerCase().includes(m))
  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal inv-modale" onClick={(e) => e.stopPropagation()}>
        <header>
          <IconCoffre />
          <h3>Ranger dans « {inv.nom} »</h3>
        </header>
        <label className="filtre-inline">
          <IconSearch />
          <input
            autoFocus
            value={mot}
            onChange={(e) => setMot(e.target.value)}
            placeholder="Chercher un objet"
            aria-label="Chercher un objet"
          />
        </label>
        <div className="inv-cases">
          {liste.map((o) => {
            const ailleurs = o.unique && o.placements.length > 0
            return (
              <label key={o.id} className={`opt${ailleurs ? ' pris' : ''}`} title={ailleurs ? 'Pièce unique déjà posée ailleurs' : undefined}>
                <input
                  type="checkbox"
                  disabled={ailleurs}
                  checked={pris.has(o.id)}
                  onChange={(e) => {
                    const n = new Set(pris)
                    if (e.target.checked) n.add(o.id)
                    else n.delete(o.id)
                    setPris(n)
                  }}
                />
                <span className="t">{o.nom}</span>
                {ailleurs ? <span className="v">{o.placements[0]?.cible}</span> : null}
              </label>
            )
          })}
        </div>
        <footer>
          <button className="btn btn-sm" onClick={onClose}>
            Annuler
          </button>
          <button
            className="btn btn-brass btn-sm"
            disabled={pris.size === 0}
            onClick={() => void onRanger([...pris])}
          >
            Ranger {pris.size || ''} objet{pris.size > 1 ? 's' : ''}
          </button>
        </footer>
      </div>
    </div>
  )
}

/** Ce que dit l'étiquette, selon où l'exemplaire attend. */
const PORT_OU: Record<PortObjet, { mot: string; icone: () => JSX.Element }> = {
  lieu: { mot: 'Lieu', icone: () => <IconPlace /> },
  pnj: { mot: 'Butin de', icone: () => <IconCoffre /> },
  pj: { mot: 'Sac de', icone: () => <IconPeople /> },
  inventaire: { mot: 'Dans', icone: () => <IconCoffre /> },
  corbeille: { mot: '', icone: () => <IconTrash /> }
}

/**
 * Où il est, sous sa catégorie : une étiquette par endroit — le lieu, le PNJ
 * qui le garde en butin, le joueur qui l'a dans son sac. Deux se lisent, le
 * reste se compte ; le survol les dit toutes.
 */
function OuIlEst({ o }: { o: Objet }): JSX.Element | null {
  const vus = new Map<string, { port: PortObjet; cible: string }>()
  for (const p of o.placements)
    vus.set(`${p.port}:${p.placeId ?? p.characterId ?? p.inventaireId}`, { port: p.port, cible: p.cible })
  const ou = [...vus.values()]
  const jetes = o.corbeille.reduce((t, p) => t + p.qte, 0)
  if (ou.length === 0 && jetes === 0) return null
  const dit = [
    ...ou.map((x) => `${PORT_OU[x.port].mot} ${x.cible}`),
    ...(jetes ? [`${jetes} à la corbeille`] : [])
  ].join(' · ')
  return (
    <span className="obj-ou" title={dit}>
      {/* Jeté : il ne compte plus nulle part, mais on doit le voir. */}
      {jetes ? (
        <span className="obj-ou-tag corbeille">
          <IconTrash />
          <span className="t">Corbeille{jetes > 1 ? ` ×${jetes}` : ''}</span>
        </span>
      ) : null}
      {ou.slice(0, 2).map((x, i) => (
        <span key={i} className={`obj-ou-tag ${x.port}`}>
          {PORT_OU[x.port].icone()}
          <span className="t">{x.cible}</span>
        </span>
      ))}
      {ou.length > 2 ? <span className="obj-ou-tag plus num">+{ou.length - 2}</span> : null}
    </span>
  )
}

function ListeObjets({
  objets,
  familles,
  monnaies
}: {
  objets: Objet[]
  familles: ObjetFamille[]
  monnaies: Monnaie[]
}): JSX.Element {
  const s = useStore()
  return (
    <div className="liste-objets">
      <div className="liste-tete">
        <span />
        <span className="nm">Objet</span>
        <span className="col">Catégorie</span>
        <span className="col">Place</span>
        <span className="col">Valeur</span>
        <span className="col">Posé</span>
      </div>
      {objets.map((o) => {
        const f = familles.find((x) => x.id === o.familleId) ?? null
        const n = o.placements.reduce((t, p) => t + p.qte, 0)
        return (
          <button
            key={o.id}
            className={`liste-ligne${o.id === s.currentObjetId ? ' on' : ''}`}
            onClick={() => s.setCurrentObjet(o.id)}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(TYPE_OBJET, String(o.id))
              /* Le même en texte : si le type maison ne survit pas au voyage,
                 la cible sait quand même ce qu'elle reçoit. */
              e.dataTransfer.setData('text/plain', `jdr:objet:${o.id}`)
              e.dataTransfer.effectAllowed = 'copy'
            }}
          >
            <span className={`g c-${f?.teinte ?? 'neutral'}`}>
              {glypheObjet(f?.glyphe ?? 'outils', 'glyphe')}
            </span>
            <span className="nm">
              <span className="nm-tx">{o.nom}</span>
              {lieuxDe(o).length > 1 ? <AlerteLieux lieux={lieuxDe(o)} /> : null}
              {o.corbeille.length > 0 ? (
                <span className="obj-ou-tag corbeille" title="Des exemplaires à la corbeille">
                  <IconTrash />
                  <span className="t">Corbeille</span>
                </span>
              ) : null}
            </span>
            <span className="col">{f?.nom ?? '—'}</span>
            <span className="col">{ditPlaces(o.places)}</span>
            <span className="col">{ditMontant(o.prix, monnaies) || '—'}</span>
            <span className="col">
              {n > 0
                ? `${n} · ${o.placements.length} endroit${o.placements.length > 1 ? 's' : ''}`
                : '—'}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* ============================================================
   La fiche de l'objet
   ============================================================ */

/**
 * Ce qui se tape attend la fin du mot, ce qui se clique part tout de suite :
 * même règle que le butin d'un PNJ. La fiche garde donc ses champs en état
 * local le temps de la frappe, et se recale quand on change d'objet — d'où la
 * `key` posée par la vue.
 */
/** L'image d'un objet en grand, par-dessus tout : un clic ou Échap la referme. */
function ImageEnGrand({ url, nom, onClose }: { url: string; nom: string; onClose: () => void }): JSX.Element {
  useEchap(onClose)
  return (
    <div className="scrim image-en-grand" onClick={onClose} role="dialog" aria-modal="true" aria-label={nom}>
      <img src={url} alt={nom} draggable={false} />
    </div>
  )
}

/** Ce qu'on porte va d'abord en main : un objet neuf y est proposé d'office (voir `addObjet`). */
const MAINS = ['main-g', 'main-d']

/* Les mains en tête de la liste à cocher, le reste dans l'ordre de la poupée. */
const EMPLACEMENTS_CHOIX = [
  ...EMPLACEMENTS_OBJET.filter((e) => MAINS.includes(e.cle)),
  ...EMPLACEMENTS_OBJET.filter((e) => !MAINS.includes(e.cle))
]

/** Les places qu'un objet peut prendre dans un sac. */
const PLACES = [0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

function FicheObjet({ o }: { o: Objet }): JSX.Element {
  const s = useStore()
  const [nom, setNom] = useState(o.nom)
  const [bonusSac, setBonusSac] = useState(o.bonusSac ? ditPlaces(o.bonusSac) : '')
  /* Le prix se tape monnaie par monnaie ; chaque case garde sa frappe. */
  const [prix, setPrix] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(o.prix ?? {}).map(([k, n]) => [k, String(n)]))
  )
  const monnaies = monnaiesActives(s.reglages.monnaies)
  const [vu, setVu] = useState(o.vu)
  const [su, setSu] = useState(o.su)
  const [image, setImage] = useState(false)
  const [rogner, setRogner] = useState(false)
  const [zoom, setZoom] = useState(false)
  const [effetOuvert, setEffetOuvert] = useState<{
    x: number
    y: number
  } | null>(null)
  const [poserOuvert, setPoserOuvert] = useState<{
    x: number
    y: number
  } | null>(null)
  const [demande, setDemande] = useState<'supprimer' | 'ranger' | null>(null)
  const frappe = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => void (frappe.current && clearTimeout(frappe.current)), [])

  /* Ses exemplaires qui ont quitté leur emplacement initial — corbeille comprise. */
  const aRanger = [...o.placements, ...o.corbeille].filter((p) => p.deplace && p.initial)

  const famille = s.objetFamilles.find((f) => f.id === o.familleId) ?? null

  const enregistre = async (
    patch: Parameters<typeof window.jdr.objets.update>[1]
  ): Promise<void> => {
    await window.jdr.objets.update(o.id, patch)
    await s.refreshObjets()
  }
  /** Un clic : tout de suite. */
  const pose = (patch: Parameters<typeof window.jdr.objets.update>[1]): void => {
    if (frappe.current) clearTimeout(frappe.current)
    void enregistre(patch)
  }
  /** Une frappe : à la fin du mot. */
  const tape = (patch: Parameters<typeof window.jdr.objets.update>[1]): void => {
    if (frappe.current) clearTimeout(frappe.current)
    frappe.current = setTimeout(() => void enregistre(patch), 400)
  }

  const img = itemById(s.allItems, o.imageItemId)
  const urlImage = img?.poster ?? img?.url ?? null
  const totalPose = o.placements.reduce((t, p) => t + p.qte, 0)
  /* Ce qu'on tape dans la quantité, recalé sur l'objet dès qu'il change. */
  const [qteTapee, setQteTapee] = useState(String(o.qte))
  useEffect(() => setQteTapee(String(o.qte)), [o.qte])
  /* Son image dans la Pochette, pour toute la table. */
  const enPoche = img
    ? (s.pochette.find((d) => d.itemId === img.id && d.playerId == null) ?? null)
    : null

  /**
   * Mettre son image dans la Pochette, **cachée** — on la montre quand ils le
   * trouvent —, et rangée dans l'onglet « Objets », créé s'il manque. Le
   * premier onglet d'une pochette ramasse toute la pile : s'il y traîne déjà
   * des documents, on leur ouvre d'abord un onglet « Documents », pour qu'ils
   * ne se retrouvent pas rangés parmi les objets.
   */
  const mettreEnPoche = async (): Promise<void> => {
    if (!img) return
    const estObjets = (n: string): boolean => n.trim().toLowerCase() === 'objets'
    try {
      let p = await window.jdr.pochette.list()
      if (!p.onglets.some((x) => estObjets(x.name))) {
        if (p.onglets.length === 0 && p.docs.length > 0)
          p = await window.jdr.pochette.createOnglet('Documents')
        p = await window.jdr.pochette.createOnglet('Objets')
      }
      const onglet = p.onglets.find((x) => estObjets(x.name)) ?? null
      s.setPochette(await window.jdr.pochette.add(img.id, null, onglet?.id ?? null))
    } catch (e) {
      s.toast('L’image n’est pas entrée dans la Pochette.', true)
      console.error('[pochette]', e)
    }
  }

  return (
    <div className="pane fiche-objet">
      <div className="pane-head">
        <span className="eyebrow">La fiche de l’objet</span>
        <div className="spacer" />
        <span className="compte num">{totalPose > 0 ? `${totalPose} en jeu` : 'jamais posé'}</span>
      </div>

      {zoom && urlImage ? (
        /* L'image elle-même, pas l'affiche réduite : on zoome pour voir le détail. */
        <ImageEnGrand
          url={img?.kind === 'image' ? (img.url ?? urlImage) : urlImage}
          nom={o.nom}
          onClose={() => setZoom(false)}
        />
      ) : null}

      <div className="pane-body flush">
        <div className={`fiche-vign c-${famille?.teinte ?? 'neutral'}`}>
          {urlImage ? (
            /* L'image entière, ajustée au bandeau : le recadrage ne sert
               qu'aux vignettes carrées de la réserve. */
            <img src={urlImage} alt={o.nom} draggable={false} />
          ) : (
            glypheObjet(famille?.glyphe ?? 'outils', 'grand')
          )}
          <span className="vign-actions">
            {urlImage ? (
              <button className="changer" onClick={() => setZoom(true)} title="Voir l’image en grand">
                <IconLoupe />
                zoomer
              </button>
            ) : null}
            {urlImage ? (
              <button className="changer" onClick={() => setRogner(true)} title="Choisir la partie de l’image que montre la fiche">
                <IconCrop />
                recadrer
              </button>
            ) : null}
            <button className="changer" onClick={() => setImage(true)}>
              <IconImage />
              {urlImage ? 'changer l’image' : 'une image de la bibliothèque'}
            </button>
          </span>
        </div>

        {/* ---- identité ---- */}
        <div className="bloc">
          <input
            className="nom-objet"
            value={nom}
            onChange={(e) => {
              setNom(e.target.value)
              tape({ nom: e.target.value })
            }}
            aria-label="Nom de l’objet"
          />
          <div className="champs">
            <label className="champ">
              <span>Catégorie</span>
              <select
                value={o.familleId ?? ''}
                onChange={(e) =>
                  pose({
                    familleId: e.target.value ? Number(e.target.value) : null
                  })
                }
              >
                <option value="">Sans catégorie</option>
                {s.objetFamilles
                  .filter((f) => !f.masquee || f.id === o.familleId)
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.masquee ? `${f.nom} (masquée)` : f.nom}
                    </option>
                  ))}
              </select>
            </label>

            <label className="champ">
              <span>Type</span>
              <select
                value={o.unique ? 'unique' : 'pile'}
                onChange={(e) => pose({ unique: e.target.value === 'unique' })}
              >
                <option value="unique">Pièce unique</option>
                <option value="pile">Se compte</option>
              </select>
            </label>

            {!o.unique ? (
              <label className="champ">
                <span>Quantité</span>
                <input
                  type="number"
                  min={Math.max(1, totalPose)}
                  value={qteTapee}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    setQteTapee(e.target.value)
                    if (Number.isNaN(n) || e.target.value === '') return
                    /* Pas en dessous de ce qui est déjà posé : on retire
                       d'abord un exemplaire de son emplacement. */
                    const voulu = Math.max(1, Math.trunc(n))
                    if (frappe.current) clearTimeout(frappe.current)
                    frappe.current = setTimeout(() => {
                      if (voulu < totalPose) {
                        setQteTapee(String(o.qte))
                        s.toast(
                          `${totalPose} exemplaires sont posés : retire-en d’abord d’un emplacement pour descendre à ${voulu}.`,
                          true
                        )
                        return
                      }
                      setQteTapee(String(voulu))
                      void enregistre({ qte: voulu })
                    }, 400)
                  }}
                  title={
                    totalPose > 1
                      ? `Combien on en pose d’un coup — pas moins que les ${totalPose} déjà posés`
                      : 'Combien on en pose d’un coup — et le plus qu’un inventaire peut en tenir'
                  }
                />
              </label>
            ) : null}

            <label className="champ" title="Les places qu’il prend dans un sac — 0,5 pour une boîte de cachets, 2 pour un gros livre">
              <span>Place occupée</span>
              <select value={o.places} onChange={(e) => pose({ places: Number(e.target.value) })}>
                {/* Une valeur d'avant la liste reste lisible tant qu'on ne la change pas. */}
                {(PLACES.includes(o.places) ? PLACES : [...PLACES, o.places].sort((a, b) => a - b)).map((n) => (
                  <option key={n} value={n}>
                    {ditPlaces(n)}
                  </option>
                ))}
              </select>
            </label>

            {/* Un sac à dos, une besace : porté, il agrandit le sac. */}
            <label className="champ" title="Les places qu’il ajoute au sac de celui qui le porte — un sac à dos">
              <span>Augmente le sac de</span>
              <input
                inputMode="decimal"
                value={bonusSac}
                placeholder="0"
                onChange={(e) => {
                  setBonusSac(e.target.value)
                  const t = e.target.value.trim()
                  const n = t ? Number(t.replace(',', '.')) : 0
                  if (Number.isFinite(n) && n >= 0) tape({ bonusSac: n })
                }}
              />
            </label>

            {/* La valeur se dit dans les monnaies de la campagne, réglées une
                fois dans la fiche de campagne : un nombre par monnaie. Sans
                monnaie, la campagne n'a pas de prix. */}
            {monnaies.length > 0 ? (
              <div className="champ">
                <span>Valeur</span>
                <div className="prix-objet">
                  {monnaies.map((m) => {
                    const img = itemById(s.allItems, m.imageItemId)
                    return (
                      <label className="champ-suffixe" key={m.key} title={m.nom}>
                        <Piece teinte={m.teinte} url={img?.url ?? null} taille={18} />
                        <input
                          inputMode="decimal"
                          value={prix[m.key] ?? ''}
                          placeholder="0"
                          aria-label={`Valeur en ${m.nom}`}
                          onChange={(e) => {
                            const suite = { ...prix, [m.key]: e.target.value }
                            setPrix(suite)
                            const p: Record<string, number> = { ...(o.prix ?? {}) }
                            for (const [k, t] of Object.entries(suite)) {
                              const n = Number(t.replace(',', '.'))
                              if (t.trim() && Number.isFinite(n) && n !== 0) p[k] = n
                              else delete p[k]
                            }
                            tape({ prix: Object.keys(p).length ? p : null })
                          }}
                        />
                        <span className="unite">{m.abbr || m.nom}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* ---- les deux textes, jamais mélangés ---- */}
        <div className="bloc">
          <div className="bloc-tete">
            <span className="eyebrow">Ce qu’on en voit</span>
            <span className="mention">peut partir dans la Pochette</span>
          </div>
          <textarea
            className="texte-objet"
            value={vu}
            placeholder="Ce que les joueurs ont sous les yeux quand ils le trouvent."
            onChange={(e) => {
              setVu(e.target.value)
              tape({ vu: e.target.value })
            }}
          />
        </div>

        <div className="bloc">
          <div className="bloc-tete">
            <span className="eyebrow">Ce que le MJ sait</span>
            <span className="mention jamais">jamais diffusé</span>
          </div>
          <textarea
            className="texte-objet"
            value={su}
            placeholder="Ce qu’il fait vraiment, d’où il vient, ce qu’il coûte."
            onChange={(e) => {
              setSu(e.target.value)
              tape({ su: e.target.value })
            }}
          />
        </div>

        {/* ---- ce qu'il fait ---- */}
        <div className="bloc">
          <div className="bloc-tete">
            <span className="eyebrow">Ce qu’il fait</span>
          </div>
          {/* Plusieurs endroits possibles, et non un seul : une épée va dans
              l'une ou l'autre main, une bague à l'un ou l'autre doigt. On coche
              ce qui convient ; c'est l'exemplaire qui dira où il est vraiment. */}
          <div className="emplacements">
            <span className="eyebrow">Où il peut se porter</span>
            <div className="emp-choix">
              {EMPLACEMENTS_CHOIX.map((e) => {
                const pris = emplacementsDe(o).includes(e.cle)
                return (
                  <button
                    key={e.cle}
                    className={`emp${pris ? ' on' : ''}`}
                    aria-pressed={pris}
                    onClick={() =>
                      pose({
                        emplacements: pris
                          ? emplacementsDe(o).filter((x) => x !== e.cle)
                          : [...emplacementsDe(o), e.cle]
                      })
                    }
                  >
                    {e.nom}
                  </button>
                )
              })}
            </div>
            {emplacementsDe(o).length === 0 ? (
              <p className="emp-rien">
                Aucun endroit coché&nbsp;: il ne pourra se poser sur personne.
              </p>
            ) : null}
          </div>

          {/* Ce qui s'épuise ne tient pas au fait de se porter : une fiole a
              trois doses sans occuper d'emplacement. L'emplacement, lui, n'a de
              sens que pour ce qui se porte. */}
          <div className="champs">
            <label className="champ">
              <span>Ce qui s’épuise</span>
              <span className="champ-suffixe">
                <input
                  type="number"
                  min={0}
                  value={o.chargeMax ?? ''}
                  placeholder="—"
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    tape({
                      chargeMax: e.target.value.trim() && Number.isFinite(n) ? n : null,
                      chargeNom: o.chargeNom ?? 'charges'
                    })
                  }}
                />
                <input
                  className="unite unite-libre"
                  value={o.chargeNom ?? ''}
                  placeholder="charges"
                  onChange={(e) => tape({ chargeNom: e.target.value.trim() || null })}
                  aria-label="Nom de ce qui s’épuise"
                />
              </span>
            </label>
          </div>

          <div className="effets">
            {o.effets.map((e) => (
              <span className="effet" key={e.id}>
                <b>{e.tete}</b>
                {/* Une lumière : sa couleur, qu'on change d'un clic sur la
                    pastille — même un effet posé avant qu'on puisse la choisir. */}
                {estLumiere(e.tete) ? (
                  <label
                    className="effet-teinte"
                    style={{ background: e.teinte ?? '#ffffff' }}
                    title="La couleur de sa lumière — clic pour la changer"
                  >
                    <input
                      type="color"
                      value={e.teinte ?? '#ffffff'}
                      aria-label={`Couleur de la lumière de ${o.nom}`}
                      onChange={(ev) =>
                        tape({
                          effets: o.effets.map((x) =>
                            x.id === e.id ? { ...x, teinte: ev.target.value } : x
                          )
                        })
                      }
                    />
                  </label>
                ) : null}
                {e.detail}
                <button
                  className="x"
                  title="Retirer cet effet"
                  aria-label={`Retirer ${e.tete}`}
                  onClick={() => pose({ effets: o.effets.filter((x) => x.id !== e.id) })}
                >
                  ×
                </button>
              </span>
            ))}
            <button
              className="effet effet-neuf"
              onClick={(ev) => {
                const r = ev.currentTarget.getBoundingClientRect()
                setEffetOuvert({ x: r.left, y: r.top - 6 })
              }}
            >
              + un effet
            </button>
          </div>
        </div>

        {/* ---- où il est ---- */}
        <div className="bloc">
          <div className="bloc-tete">
            <span className="eyebrow">Où il est</span>
            <div className="spacer" />
            <span className="mention">
              {o.placements.length === 0
                ? 'nulle part'
                : `${o.placements.length} endroit${o.placements.length > 1 ? 's' : ''}`}
            </span>
          </div>
          {o.placements.length === 0 ? (
            <p className="ou-vide">
              Nulle part encore. «&nbsp;Poser&nbsp;» le range dans un lieu, dans un butin, dans un
              sac.
            </p>
          ) : (
            <div className="ou-liste">
              {o.placements.map((p) => (
                <LignePlacement key={p.id} o={o} p={p} />
              ))}
            </div>
          )}
          {o.corbeille.length > 0 ? (
            <div className="ou-liste rgm-fiche-jetes">
              {o.corbeille.map((p) => (
                <div key={p.id} className="ou-ligne jete">
                  <span className="ou-port">
                    <IconTrash />
                  </span>
                  <span className="ou-txt">
                    <span className="ou-cible">
                      Corbeille{p.qte > 1 ? <b className="num"> ×{p.qte}</b> : null}
                    </span>
                    <Depart p={p} />
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="fiche-pied">
        <button
          className="btn btn-sm"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            setPoserOuvert({ x: r.left, y: r.top - 6 })
          }}
        >
          <IconPoser />
          Poser…
        </button>
        <button
          className={`btn btn-sm${enPoche ? ' btn-on' : ''}`}
          disabled={!img}
          aria-pressed={!!enPoche}
          title={
            !img
              ? 'Pas d’image — choisis-en une pour la mettre dans la Pochette'
              : enPoche
                ? `Dans la Pochette, onglet « ${enPoche.ongletName ?? 'pile'} » — ${
                    enPoche.visible ? 'montrée aux joueurs' : 'masquée'
                  }. Clic pour l’en retirer.`
                : 'Mettre son image dans la Pochette, onglet « Objets » — masquée, tu la montreras quand ils le trouvent'
          }
          onClick={async () => {
            if (!enPoche) return void mettreEnPoche()
            s.setPochette(await window.jdr.pochette.remove(enPoche.id))
          }}
        >
          <IconPochette />
          {enPoche ? (enPoche.visible ? 'Pochette · montrée' : 'Pochette · masquée') : 'Pochette'}
        </button>
        <button
          className="btn btn-sm"
          disabled={aRanger.length === 0}
          onClick={() => setDemande('ranger')}
          title={
            aRanger.length === 0
              ? 'Il est à son emplacement initial'
              : 'Remettre ses exemplaires là où on les avait rangés au départ'
          }
        >
          <IconRetour />
          Ranger à sa place
        </button>
        <div className="spacer" />
        <button
          className="btn btn-ghost btn-sm btn-danger"
          title="Supprimer définitivement — avec tous ses exemplaires posés"
          aria-label="Supprimer définitivement"
          onClick={() => setDemande('supprimer')}
        >
          <IconTrash />
        </button>
      </div>

      {demande === 'supprimer' ? (
        <Confirmer
          danger
          titre={`Supprimer « ${o.nom} » définitivement ?`}
          oui="Supprimer"
          onNon={() => setDemande(null)}
          onOui={async () => {
            await window.jdr.objets.remove(o.id)
            await s.refreshObjets()
          }}
        >
          <p className="rgm-aide">
            {o.placements.length + o.corbeille.length === 0
              ? 'Il disparaît de la réserve. Cela ne se défait pas.'
              : `Il disparaît de la réserve, et avec lui ses ${
                  o.placements.length + o.corbeille.length
                } exemplaire${o.placements.length + o.corbeille.length > 1 ? 's' : ''} — dans les lieux, les sacs, les inventaires, la corbeille. Cela ne se défait pas.`}
          </p>
        </Confirmer>
      ) : demande === 'ranger' ? (
        <Confirmer
          titre={`Ranger « ${o.nom} » à sa place ?`}
          oui="Ranger"
          onNon={() => setDemande(null)}
          onOui={async () => {
            try {
              await window.jdr.objets.ranger(aRanger.map((p) => p.id))
            } finally {
              await s.refreshObjets()
              setDemande(null)
            }
          }}
        >
          <ul className="rgm-recap">
            {aRanger.map((p) => (
              <li key={p.id}>
                {p.port === 'corbeille' ? 'Corbeille' : p.cible}
                {p.qte > 1 ? ` ×${p.qte}` : ''} → <b>{ditInitial(p.initial)}</b>
              </li>
            ))}
          </ul>
        </Confirmer>
      ) : null}

      {rogner && urlImage ? (
        <RognageCarre
          titre={`Recadrer l’image — ${o.nom}`}
          url={urlImage}
          cadre={o.imageCadre}
          rapport={16 / 7}
          onClose={() => setRogner(false)}
          onValider={async (cadre) => {
            setRogner(false)
            await enregistre({ imageCadre: cadre })
          }}
        />
      ) : null}

      {image ? (
        <ChoixDansArbre
          titre={`Image — ${o.nom}`}
          icone={<IconImage />}
          kinds={['image']}
          rendu="vignettes"
          courant={o.imageItemId}
          sansLibelle="Le glyphe de sa catégorie"
          onPick={async (id) => {
            setImage(false)
            await enregistre({ imageItemId: id })
          }}
          onClose={() => setImage(false)}
        />
      ) : null}

      {effetOuvert ? (
        <PanneauEffet
          x={effetOuvert.x}
          y={effetOuvert.y}
          onClose={() => setEffetOuvert(null)}
          onPose={(e) => {
            setEffetOuvert(null)
            pose({ effets: [...o.effets, e] })
          }}
        />
      ) : null}

      {poserOuvert ? (
        <PanneauPoser
          x={poserOuvert.x}
          y={poserOuvert.y}
          objetId={o.id}
          onClose={() => setPoserOuvert(null)}
        />
      ) : null}
    </div>
  )
}

/**
 * Un exemplaire posé. L'état se clique : dans un lieu, il passe de « pas
 * découvert » à « sur place » le jour où les joueurs mettent la main dessus —
 * c'est l'antisèche du MJ, et elle doit suivre la partie.
 */
function LignePlacement({ o, p }: { o: Objet; p: ObjetPlacement }): JSX.Element {
  const s = useStore()
  const [precis, setPrecis] = useState(p.precision ?? '')
  /* Ce qu'on tape dans le nombre, recalé sur l'exemplaire dès qu'il change. */
  const [qteTapee, setQteTapee] = useState(String(p.qte))
  useEffect(() => setQteTapee(String(p.qte)), [p.qte])
  const [donne, setDonne] = useState<{ x: number; y: number } | null>(null)
  const frappe = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => void (frappe.current && clearTimeout(frappe.current)), [])

  const maj = async (patch: Parameters<typeof window.jdr.objets.placement>[1]): Promise<void> => {
    await window.jdr.objets.placement(p.id, patch)
    await s.refreshObjets()
  }

  const dit = p.etat === 'cache' ? 'pas découvert' : p.etat === 'trouve' ? 'sur place' : 'porté'

  return (
    <div className="ou-ligne">
      <span className="ou-port">
        {p.port === 'lieu' ? (
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
          >
            <path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
          >
            <circle cx="12" cy="8" r="3.6" />
            <path d="M4.5 20c.8-4 3.8-6 7.5-6s6.7 2 7.5 6" />
          </svg>
        )}
      </span>

      <span className="ou-txt">
        <span className="ou-cible">
          {p.cible}
        </span>
        <Depart p={p} />
        <input
          className="ou-precis"
          value={precis}
          placeholder={p.port === 'lieu' ? 'où exactement ?' : 'comment il le porte'}
          aria-label="Précision"
          onChange={(e) => {
            setPrecis(e.target.value)
            if (frappe.current) clearTimeout(frappe.current)
            frappe.current = setTimeout(
              () => void maj({ precision: e.target.value.trim() || null }),
              400
            )
          }}
        />
      </span>

      {p.port === 'lieu' ? <AlerteLieux lieux={lieuxDe(o, p.placeId)} /> : null}

      {!o.unique ? (
        <input
          className="ou-qte num"
          type="number"
          min={1}
          max={Math.max(p.qte, o.qte)}
          value={qteTapee}
          aria-label={`Combien à ${p.cible}`}
          title={`Pas plus que sa quantité : ${o.qte}`}
          onChange={(e) => {
            const n = Number(e.target.value)
            setQteTapee(e.target.value)
            if (Number.isNaN(n) || e.target.value === '') return
            /* Pas au-delà de la quantité de l'objet — ce qui la dépassait
               déjà peut seulement descendre. */
            const borne = Math.min(Math.max(1, Math.trunc(n)), Math.max(p.qte, o.qte))
            if (frappe.current) clearTimeout(frappe.current)
            frappe.current = setTimeout(() => {
              setQteTapee(String(borne))
              void maj({ qte: borne })
            }, 400)
          }}
        />
      ) : null}

      {p.port === 'lieu' ? (
        <button
          className={`ou-etat ${p.etat}`}
          title={
            p.etat === 'cache'
              ? 'Les joueurs ne l’ont pas trouvé — clic quand ils mettent la main dessus'
              : 'Ils savent qu’il est là — clic pour le remettre à couvert'
          }
          onClick={() => void maj({ etat: p.etat === 'cache' ? 'trouve' : 'cache' })}
        >
          {dit}
        </button>
      ) : (
        <span className="ou-etat porte">{dit}</span>
      )}

      {/* Le faire passer sans repasser par la réserve : c'est le geste de la
          table, quand quelqu'un ramasse ce qui traînait là. */}
      <button
        className="ou-donner"
        title={`Donner à quelqu’un — il quitte ${p.cible}`}
        aria-label="Donner à"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          setDonne({ x: r.left - 210, y: r.top })
        }}
      >
        <IconDonner />
      </button>

      {/* Ce qu'on retire à un joueur part à la corbeille ; ailleurs, on
          défait seulement la pose. */}
      <button
        className="ou-retire"
        title={
          p.port === 'pj'
            ? 'Le lui retirer — il part à la corbeille'
            : 'Le reprendre d’ici — l’objet reste en réserve'
        }
        aria-label={`Reprendre de ${p.cible}`}
        onClick={async () => {
          if (p.port === 'pj') await window.jdr.objets.jeter(p.id)
          else await window.jdr.objets.reprendre(p.id)
          await s.refreshObjets()
        }}
      >
        <IconClose />
      </button>

      {donne ? (
        <MenuDonner
          x={donne.x}
          y={donne.y}
          p={p}
          onClose={() => setDonne(null)}
          onFait={() => s.refreshObjets()}
        />
      ) : null}
    </div>
  )
}

/* ============================================================
   Les panneaux posés au curseur
   ============================================================ */

/** Où poser un exemplaire : un lieu, un PNJ, le sac d'un joueur. */
function PanneauPoser({
  x,
  y,
  objetId,
  onClose
}: {
  x: number
  y: number
  objetId: number
  onClose: () => void
}): JSX.Element {
  const s = useStore()
  const [q, setQ] = useState('')
  const objet = s.objets.find((o) => o.id === objetId) ?? null
  /* Un objet qui se compte : on choisit d'abord où, puis combien. */
  const [cible, setCible] = useState<{
    port: PortObjet
    placeId: number | null
    characterId: number | null
    nom: string
  } | null>(null)
  const [combien, setCombien] = useState(objet?.qte ?? 1)
  const max = Math.max(1, objet?.qte ?? 1)

  /* On cherche comme on parle : sans les accents ni les majuscules —
     « cave » trouve « Cave à vin », « Caveau ». */
  const plat = (t: string): string =>
    t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('fr-FR')
  const mot = plat(q.trim())
  const garde = (nom: string): boolean => mot === '' || plat(nom).includes(mot)

  const lieux = s.places.filter((l) => garde(l.name))
  const pnjs = s.characters.filter((c) => c.kind === 'pnj' && garde(c.name))
  const pjs = s.characters.filter((c) => c.kind !== 'pnj' && c.present && garde(c.name))

  const poserVraiment = async (
    port: PortObjet,
    placeId: number | null,
    characterId: number | null,
    qte?: number
  ): Promise<void> => {
    onClose()
    await window.jdr.objets.poser({ objetId, port, placeId, characterId, qte })
    await s.refreshObjets()
  }
  const poser = (
    port: PortObjet,
    placeId: number | null,
    characterId: number | null,
    nom: string
  ): void => {
    if (objet && !objet.unique && max > 1) {
      setCombien(max)
      setCible({ port, placeId, characterId, nom })
    } else void poserVraiment(port, placeId, characterId)
  }

  /* Entrée pose dans le premier qui répond : un mot, Entrée, c'est posé. */
  const premier = (): void => {
    if (lieux[0]) poser('lieu', lieux[0].id, null, lieux[0].name)
    else if (pnjs[0]) poser('pnj', null, pnjs[0].id, pnjs[0].name)
    else if (pjs[0]) poser('pj', null, pjs[0].id, pjs[0].name)
  }

  if (cible) {
    const n = Math.min(max, Math.max(1, combien || 1))
    const valider = (): void => void poserVraiment(cible.port, cible.placeId, cible.characterId, n)
    return (
      <Pop x={x} y={y} onClose={onClose} className="poser-combien">
        <span className="eyebrow">
          {cible.port === 'lieu' ? 'Dans' : cible.port === 'pnj' ? 'Butin de' : 'Sac de'} {cible.nom}
        </span>
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
              aria-label="Combien en poser"
            />
            <button disabled={n >= max} onClick={() => setCombien(n + 1)} aria-label="Un de plus">
              +
            </button>
          </span>
          <span className="pc-sur num">sur {max}</span>
        </label>
        <div className="pc-pied">
          <button className="btn btn-sm btn-ghost" onClick={() => setCible(null)}>
            Retour
          </button>
          <div className="spacer" />
          <button className="btn btn-sm btn-brass" onClick={valider}>
            <IconPoser />
            Poser {n}
          </button>
        </div>
      </Pop>
    )
  }

  const rien = (quoi: string): JSX.Element => (
    <p className="pop-rien">{mot ? 'Aucun nom ne correspond.' : quoi}</p>
  )

  return (
    <Pop x={x} y={y} onClose={onClose}>
      <label className="filtre-inline pop-cherche">
        <IconSearch />
        <input
          type="text"
          autoFocus
          value={q}
          placeholder="Chercher un lieu, un PNJ, un joueur"
          aria-label="Chercher où poser"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && premier()}
        />
      </label>

      <span className="eyebrow">Dans un lieu</span>
      {lieux.length === 0 ? rien('Aucun lieu dans la campagne.') : null}
      {lieux.map((l) => (
        <button key={l.id} className="opt" onClick={() => poser('lieu', l.id, null, l.name)}>
          {l.name}
        </button>
      ))}

      <hr />
      <span className="eyebrow">Dans le butin d’un PNJ</span>
      {pnjs.length === 0 ? rien('Aucun PNJ.') : null}
      {pnjs.map((c) => (
        <button key={c.id} className="opt" onClick={() => poser('pnj', null, c.id, c.name)}>
          {c.name}
        </button>
      ))}

      <hr />
      <span className="eyebrow">Dans le sac d’un joueur</span>
      {pjs.length === 0 ? rien('Aucun personnage joueur.') : null}
      {pjs.map((c) => (
        <button key={c.id} className="opt" onClick={() => poser('pj', null, c.id, c.name)}>
          {c.name}
        </button>
      ))}
    </Pop>
  )
}

/**
 * Un effet de plus.
 *
 * Rien n'est câblé : une tête, un détail, et c'est tout. Les suggestions, elles,
 * viennent de la fiche de la campagne — ses caractéristiques et ses
 * compétences —, si bien que « +1 » propose ce que cette table sait faire.
 */
function PanneauEffet({
  x,
  y,
  onClose,
  onPose
}: {
  x: number
  y: number
  onClose: () => void
  onPose: (e: EffetObjet) => void
}): JSX.Element {
  const s = useStore()
  const [tete, setTete] = useState('')
  const [detail, setDetail] = useState('')
  const champ = useRef<HTMLInputElement>(null)

  useEffect(() => champ.current?.focus(), [])

  const cibles = [
    ...(s.sheet?.spec.stats ?? []).map((x) => x.label),
    ...(s.sheet?.spec.sansCompetences ? [] : (s.sheet?.spec.skills ?? [])).map((x) => x.label)
  ]

  /* « Éclaire », « Lumière » : la tête que lit la régie pour faire une torche
     de l'objet porté (voir porteursDeLumiere). Le détail n'est alors qu'une
     portée en mètres — on la règle au curseur plutôt que de taper « 9 m » ;
     l'échelle de chaque plan la change en part de la carte. */
  const eclaire = estLumiere(tete)
  const [rayon, setRayon] = useState(9)
  /* Le faisceau, en degrés : 360, tout autour ; moins, une lampe de poche
     tournée comme le pion. La régie le relit dans « cône 30° ». */
  const [ouverture, setOuverture] = useState(360)
  /* La couleur de la lueur, les mêmes choix qu'une lampe du plan. Jaune
     d'abord : c'est une flamme qu'on tient le plus souvent. */
  const [teinte, setTeinte] = useState(TEINTES_LUMIERE[1].cle)

  const poser = (): void => {
    const t = tete.trim()
    if (!t) return
    onPose({
      id: `e${Date.now().toString(36)}`,
      tete: t,
      detail: eclaire
        ? `${String(rayon).replace('.', ',')} m${ouverture < 360 ? ` · cône ${ouverture}°` : ''}`
        : detail.trim(),
      ...(eclaire ? { teinte } : {})
    })
  }

  return (
    <Pop x={x} y={y} haut className="large" onClose={onClose}>
      <span className="eyebrow">Un effet de plus</span>
      <div className="effet-form">
        <div className="effet-tetes">
          {['+1', '−1', 'Dégâts', 'Protège', 'Éclaire', 'Ouvre', 'Force', 'Rend', 'Coûte'].map(
            (t) => (
              <button
                key={t}
                className={`tete-prop${tete === t ? ' on' : ''}`}
                onClick={() => setTete(t)}
              >
                {t}
              </button>
            )
          )}
        </div>
        <label className="champ">
          <span>Ce qu’on lit en gras</span>
          <input
            ref={champ}
            value={tete}
            placeholder="Dégâts"
            onChange={(e) => setTete(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && poser()}
          />
        </label>
        {eclaire ? (
          <div className="effet-rayon">
            <span className="eyebrow">Portée de la lumière</span>
            <div className="ligne">
              <input
                type="range"
                min={1}
                max={40}
                step={0.5}
                value={rayon}
                aria-label="Portée de la lumière"
                onChange={(e) => setRayon(Number(e.target.value))}
              />
              <Valeur
                className="v"
                value={rayon}
                min={0.5}
                max={300}
                step={0.5}
                decimales={1}
                unite=" m"
                label="Portée de la lumière"
                onChange={setRayon}
              />
            </div>
            <span className="eyebrow">Cône de la lumière</span>
            <div className="effet-cone">
              <button
                className="btn btn-sm"
                aria-pressed={ouverture >= 360}
                title="Une torche, une lanterne : elle éclaire dans toutes les directions"
                onClick={() => setOuverture(360)}
              >
                Tout autour
              </button>
              {FAISCEAUX_LUMIERE.map((o) => (
                <button
                  key={o}
                  className="btn btn-sm"
                  aria-pressed={ouverture === o}
                  title={`Une lampe de poche — un faisceau de ${o}°, là où le pion regarde`}
                  onClick={() => setOuverture(o)}
                >
                  {o}°
                </button>
              ))}
            </div>
            <span className="eyebrow">Couleur de la lumière</span>
            <div className="murs-teintes">
              {TEINTES_LUMIERE.map((t) => (
                <button
                  key={t.cle}
                  className={`lteinte${teinte === t.cle ? ' on' : ''}`}
                  style={{ ['--t' as string]: t.cle } as React.CSSProperties}
                  aria-pressed={teinte === t.cle}
                  title={`${t.label} — la couleur ne change rien à ce qui est vu`}
                  onClick={() => setTeinte(t.cle)}
                >
                  <i />
                  {t.label}
                </button>
              ))}
              <label
                className={`lteinte libre${TEINTES_LUMIERE.some((t) => t.cle === teinte) ? '' : ' on'}`}
                style={{ ['--t' as string]: teinte } as React.CSSProperties}
                title="Une couleur à toi"
              >
                <i />
                La tienne
                <input type="color" value={teinte} onChange={(e) => setTeinte(e.target.value)} />
              </label>
            </div>
            <DemoLueur rayon={rayon} ouverture={ouverture} teinte={teinte} />
            <span className="note">
              {ouverture < 360
                ? 'Posé sur un emplacement d’un personnage — en main, à la ceinture —, l’objet éclaire droit devant lui, dans le sens où son pion regarde ; les murs arrêtent le faisceau. Dans le sac, il n’éclaire pas. Une lampe de poche : 10 m, 30°.'
                : 'Posé sur un emplacement d’un personnage — en main, à la ceinture —, l’objet l’éclaire tout autour, à l’échelle du plan ; les murs arrêtent la lueur. Dans le sac, il n’éclaire pas. Une torche ordinaire : 9 m.'}
            </span>
          </div>
        ) : (
          <label className="champ">
            <span>Et ce qui suit</span>
            <input
              value={detail}
              list="objet-cibles"
              placeholder="1d6 + Vigueur"
              onChange={(e) => setDetail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && poser()}
            />
            <datalist id="objet-cibles">
              {cibles.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
        )}
        <button className="btn btn-sm btn-brass btn-c" onClick={poser} disabled={!tete.trim()}>
          Poser l’effet
        </button>
      </div>
    </Pop>
  )
}

/**
 * L'exemple d'une lueur portée, calculé comme sur la carte.
 *
 * Un petit plan — trois pièces, un couloir, des portes — de 20 m de large, un
 * personnage dans la première pièce, à 9 m environ de large. La lueur part de lui, s'arrête aux murs
 * (`champDeVision`, le calcul de la carte) et passe par les portes : plein
 * jour sur `CLAIR_DE_TORCHE` du rayon, puis la pénombre jusqu'au noir. Le plan
 * reste deviné dans l'ombre, comme le MJ le voit ; le cercle en tirets dit
 * jusqu'où la lueur irait sans mur. Une barre donne l'échelle : 2 m.
 */
const DEMO_W = 240
/** Le plan d'exemple fait 20 m de large : 12 unités par mètre. */
const DEMO_PAR_M = DEMO_W / 20
const DEMO_H = 150
const DEMO_PION = { x: 62, y: 92 }
const DEMO_MURS: Barriere[] = [
  [10, 10, 230, 10],
  [230, 10, 230, 140],
  [230, 140, 10, 140],
  [10, 140, 10, 10],
  /* Entre la pièce du personnage et le couloir, une porte. */
  [120, 10, 120, 60],
  [120, 84, 120, 140],
  /* Le couloir, et une porte vers chaque pièce de droite. */
  [150, 10, 150, 28],
  [150, 48, 150, 98],
  [150, 118, 150, 140],
  [150, 75, 230, 75]
].map(([ax, ay, bx, by]) => ({ a: { x: ax, y: ay }, b: { x: bx, y: by } }))

function PlanDemo(): JSX.Element {
  return (
    <>
      <rect x={10} y={10} width={220} height={130} className="sol" />
      {[24, 38, 52, 66, 80, 94, 108, 122].map((y) => (
        <line key={y} x1={10} x2={120} y1={y} y2={y} className="latte" />
      ))}
      {[24, 38, 52, 66, 80, 94, 108, 122].map((x) => (
        <line key={x} x1={150 + x * 0.6} x2={150 + x * 0.6} y1={75} y2={140} className="latte" />
      ))}
      <rect x={24} y={22} width={40} height={24} rx={2} className="meuble" />
      <rect x={86} y={110} width={24} height={20} rx={2} className="meuble" />
      <rect x={196} y={18} width={26} height={40} rx={2} className="meuble" />
      <circle cx={190} cy={108} r={10} className="meuble" />
      {DEMO_MURS.map((m, i) => (
        <line key={i} x1={m.a.x} y1={m.a.y} x2={m.b.x} y2={m.b.y} className="mur" />
      ))}
    </>
  )
}

/** Le personnage de l'exemple regarde vers la porte, à droite. */
const DEMO_CAP = 90

function DemoLueur({
  rayon,
  ouverture,
  teinte
}: {
  rayon: number
  ouverture: number
  teinte: string
}): JSX.Element {
  const r = Math.max(1, rayon * DEMO_PAR_M)
  const rond = useMemo(
    () => champDeVision(DEMO_MURS, DEMO_PION, DEMO_CAP, ouverture, r),
    [r, ouverture]
  )
  /* Jusqu'où irait la lueur sans mur : un cercle, ou le secteur du faisceau. */
  const sansMur = useMemo((): string | null => {
    if (ouverture >= 360) return null
    const point = (deg: number): string => {
      const a = ((deg - 90) * Math.PI) / 180
      return `${DEMO_PION.x + r * Math.cos(a)} ${DEMO_PION.y + r * Math.sin(a)}`
    }
    const grand = ouverture > 180 ? 1 : 0
    return `M ${DEMO_PION.x} ${DEMO_PION.y} L ${point(DEMO_CAP - ouverture / 2)} A ${r} ${r} 0 ${grand} 1 ${point(DEMO_CAP + ouverture / 2)} Z`
  }, [r, ouverture])
  return (
    <svg className="lueur-demo" viewBox={`0 0 ${DEMO_W} ${DEMO_H}`} aria-hidden="true">
      <defs>
        <radialGradient
          id="lueur-demo-g"
          gradientUnits="userSpaceOnUse"
          cx={DEMO_PION.x}
          cy={DEMO_PION.y}
          r={r}
        >
          <stop offset={0} stopColor="#fff" />
          <stop offset={CLAIR_DE_TORCHE} stopColor="#fff" />
          <stop offset={1} stopColor="#000" />
        </radialGradient>
        <mask id="lueur-demo-m" maskUnits="userSpaceOnUse" x={0} y={0} width={DEMO_W} height={DEMO_H}>
          <polygon points={polygone(rond)} fill="url(#lueur-demo-g)" />
        </mask>
      </defs>
      <rect x={0} y={0} width={DEMO_W} height={DEMO_H} className="fond" />
      <g className="ombre">
        <PlanDemo />
      </g>
      <g mask="url(#lueur-demo-m)">
        <PlanDemo />
        {/* Le blanc ne teinte rien, comme sur la carte. */}
        {teinte.toLowerCase() !== '#ffffff' ? (
          <rect x={0} y={0} width={DEMO_W} height={DEMO_H} fill={teinte} opacity={0.16} />
        ) : null}
      </g>
      {sansMur ? (
        <path d={sansMur} className="portee" />
      ) : (
        <circle cx={DEMO_PION.x} cy={DEMO_PION.y} r={r} className="portee" />
      )}
      <circle cx={DEMO_PION.x} cy={DEMO_PION.y} r={5} className="pion" />
      <line x1={14} x2={14 + 2 * DEMO_PAR_M} y1={146} y2={146} className="echelle" />
      <text x={18 + 2 * DEMO_PAR_M} y={148.5} className="echelle-txt">
        2 m
      </text>
    </svg>
  )
}

/**
 * Les réglages de la réserve : ses rayons, et l'unité de valeur de la campagne.
 *
 * L'unité se nomme **une fois** ici ; chaque objet ne porte qu'un chiffre. Sans
 * cela on retaperait « francs » à chaque ligne, et aucun total ne serait
 * calculable.
 */
function PanneauReglages({
  x,
  y,
  onClose
}: {
  x: number
  y: number
  onClose: () => void
}): JSX.Element {
  const s = useStore()
  const [editee, setEditee] = useState<number | null>(null)

  const fam = s.objetFamilles.find((f) => f.id === editee) ?? null

  if (fam) {
    return (
      <Pop x={x} y={y} className="large" onClose={onClose}>
        <ReglageFamille f={fam} onRetour={() => setEditee(null)} />
      </Pop>
    )
  }

  return (
    <Pop x={x} y={y} className="large" onClose={onClose}>
      <span className="eyebrow">Les catégories</span>
      {s.objetFamilles.map((f) => (
        <button
          key={f.id}
          className={`opt${f.masquee ? ' masquee' : ''}`}
          onClick={() => setEditee(f.id)}
        >
          <span className={`pastille c-${f.teinte}`} />
          <span className="lib">{f.nom}</span>
          {f.masquee ? <IconEyeOff /> : f.verrouillee ? <IconVerrou /> : null}
          <span className="n num">{s.objets.filter((o) => o.familleId === f.id).length}</span>
        </button>
      ))}
      <button
        className="opt neuve"
        onClick={async () => {
          /* La teinte suivante qui n'est pas déjà prise : deux rayons de la
             même couleur ne se distinguent plus à un mètre. */
          const prises = new Set(s.objetFamilles.map((f) => f.teinte))
          const libre = PION_COULEURS.find((c) => !prises.has(c.key))?.key ?? 'neutral'
          const neuve = await window.jdr.objets.familleAdd({
            nom: 'Nouvelle catégorie',
            teinte: libre,
            glyphe: 'outils'
          })
          await s.refreshObjets()
          setEditee(neuve.id)
        }}
      >
        <IconPlus />
        Une catégorie de plus
      </button>

      <p className="reglage-ailleurs">
        Les monnaies — dollars, pièces d’or, crédits — se règlent une fois dans la fiche de
        campagne, onglet « Monnaies ». Elles valent pour toute la campagne.
      </p>
    </Pop>
  )
}

/**
 * Les familles en grand : la liste à gauche, celle qu'on règle à droite. On
 * ouvre sur le rayon où l'on se trouve, sinon sur le premier.
 */
function ModaleFamilles({
  depart,
  onClose
}: {
  depart: number | null
  onClose: () => void
}): JSX.Element {
  const s = useStore()
  const [choisie, setChoisie] = useState<number | null>(depart ?? s.objetFamilles[0]?.id ?? null)
  const fam = s.objetFamilles.find((f) => f.id === choisie) ?? null

  useEchap(onClose)

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal fam-modale" onClick={(e) => e.stopPropagation()}>
        <header>
          <IconRouage />
          <h3>Les catégories d’objets</h3>
        </header>
        <div className="fam-modale-corps">
          <div className="fam-rangs">
            {s.objetFamilles.map((f) => (
              <button
                key={f.id}
                className={`fam-btn${choisie === f.id ? ' on' : ''}${f.masquee ? ' masquee' : ''}`}
                onClick={() => setChoisie(f.id)}
                title={
                  f.masquee
                    ? 'Masquée à partir de cette séance'
                    : f.verrouillee
                      ? 'A servi dans une autre séance : elle ne se modifie plus'
                      : undefined
                }
              >
                <span className={`pastille c-${f.teinte}`} />
                <span className="lib">{f.nom}</span>
                {f.masquee ? <IconEyeOff /> : f.verrouillee ? <IconVerrou /> : null}
                <span className="n">{s.objets.filter((o) => o.familleId === f.id).length}</span>
              </button>
            ))}
            <button
              className="fam-btn neuve"
              onClick={async () => {
                /* La teinte suivante qui n'est pas déjà prise : deux rayons de
                   la même couleur ne se distinguent plus à un mètre. */
                const prises = new Set(s.objetFamilles.map((f) => f.teinte))
                const libre = PION_COULEURS.find((c) => !prises.has(c.key))?.key ?? 'neutral'
                const neuve = await window.jdr.objets.familleAdd({
                  nom: 'Nouvelle catégorie',
                  teinte: libre,
                  glyphe: 'outils'
                })
                await s.refreshObjets()
                setChoisie(neuve.id)
              }}
            >
              <IconPlus />
              <span className="lib">Une catégorie de plus</span>
            </button>
          </div>
          {fam ? (
            <ReglageFamille key={fam.id} f={fam} onRetour={() => setChoisie(null)} enGrand />
          ) : (
            <p className="rien-objet">Choisis une catégorie à gauche, ou crées-en une.</p>
          )}
        </div>
        <footer>
          <button className="btn btn-ghost" onClick={onClose}>
            Fermer
          </button>
        </footer>
      </div>
    </div>
  )
}

/** Un rayon : son nom, sa teinte, son dessin. */
function ReglageFamille({
  f,
  onRetour,
  enGrand = false
}: {
  f: ObjetFamille
  onRetour: () => void
  enGrand?: boolean
}): JSX.Element {
  const s = useStore()
  const [nom, setNom] = useState(f.nom)
  const frappe = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => void (frappe.current && clearTimeout(frappe.current)), [])

  const maj = async (patch: {
    nom?: string
    teinte?: string
    glyphe?: GlypheObjet
  }): Promise<void> => {
    await window.jdr.objets.familleUpdate(f.id, patch)
    await s.refreshObjets()
  }

  const n = s.objets.filter((o) => o.familleId === f.id).length
  const fige = f.verrouillee

  const masquer = async (masquee: boolean): Promise<void> => {
    await window.jdr.objets.familleMasquer(f.id, masquee)
    await s.refreshObjets()
  }

  return (
    <div className={`fam-editeur${fige ? ' fige' : ''}`}>
      {enGrand ? null : (
        <button className="retour" onClick={onRetour}>
          ← toutes les catégories
        </button>
      )}

      {fige ? (
        <p className="fam-verrou">
          <IconVerrou />
          Elle a servi dans une autre séance&nbsp;: on ne la modifie plus. On peut la masquer
          à partir de celle-ci — les séances d’avant la montrent toujours.
        </p>
      ) : null}

      <label className="champ">
        <span>Nom de la catégorie</span>
        <input
          autoFocus={enGrand && !fige}
          disabled={fige}
          value={nom}
          onChange={(e) => {
            setNom(e.target.value)
            if (frappe.current) clearTimeout(frappe.current)
            frappe.current = setTimeout(() => void maj({ nom: e.target.value }), 400)
          }}
        />
      </label>

      <span className="eyebrow">Son dessin</span>
      <div className="grid-glyphes">
        {GLYPHES_OBJET.map((g) => (
          <button
            key={g}
            className={`gl c-${f.teinte}${f.glyphe === g ? ' on' : ''}`}
            title={g}
            disabled={fige}
            onClick={() => void maj({ glyphe: g })}
          >
            {glypheObjet(g, '')}
          </button>
        ))}
      </div>

      <span className="eyebrow">Sa teinte</span>
      <div className="teintes-grille">
        {PION_COULEURS.map((c) => (
          <button
            key={c.key}
            className={`teinte sw${f.teinte === c.key ? ' on' : ''}`}
            style={{ background: c.hex }}
            title={c.name}
            disabled={fige}
            onClick={() => void maj({ teinte: c.key })}
          />
        ))}
      </div>

      {f.masquee ? (
        <>
          <button className="btn btn-sm btn-c" onClick={() => void masquer(false)}>
            <IconEye />
            Réafficher cette catégorie
          </button>
          <p className="note">
            Masquée&nbsp;: elle n’est plus dans la colonne ni dans le choix d’un objet. Ses objets
            restent sous «&nbsp;Tout&nbsp;».
          </p>
        </>
      ) : fige ? (
        <>
          <button className="btn btn-sm btn-c" onClick={() => void masquer(true)}>
            <IconEyeOff />
            Masquer à partir de cette séance
          </button>
          <p className="note">
            Elle sort de la colonne et du choix d’un objet&nbsp;; ses objets restent sous
            «&nbsp;Tout&nbsp;».
          </p>
        </>
      ) : (
        <>
          <button
            className="btn btn-sm btn-danger btn-c"
            onClick={async () => {
              await window.jdr.objets.familleRemove(f.id)
              await s.refreshObjets()
              onRetour()
            }}
          >
            <IconTrash />
            Retirer cette catégorie
          </button>
          <p className="note">
            {n === 0
              ? 'Cette catégorie est vide.'
              : `Ses ${n} objet${n > 1 ? 's' : ''} rest${n > 1 ? 'ent' : 'e'} en réserve, sans catégorie.`}
          </p>
        </>
      )}
    </div>
  )
}
