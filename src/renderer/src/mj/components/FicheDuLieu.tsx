/**
 * La fiche d'un lieu : tout ce qu'il contient, sur une page.
 *
 * Trois colonnes. À gauche, le lieu lui-même — son nom, son plan, le texte à
 * lire aux joueurs, les secrets du MJ. Au milieu, ce qui peut y arriver : les
 * découvertes, les déclencheurs et les scénarios en une seule liste, qu'on
 * filtre. À droite, qui et quoi : les PNJ, ce qu'ils portent, les objets
 * posés. Un clic déplie pour lire en entier, le crayon ouvre l'écriture ; ce qu'on tape
 * s'enregistre, Échap referme. Chaque colonne défile chez elle ; la page,
 * jamais.
 *
 * « Éditer le plan » mène à l'éditeur de carte (murs, portes, lumières,
 * découpage), qui ramène ici d'un « Terminé ».
 *
 * **Rien ici ne part vers les joueurs**, sauf ce qu'on montre exprès : l'image
 * d'un objet, d'un clic.
 */
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import {
  IconDonner,
  IconImage,
  IconSearch,
  IconPen,
  IconScreen,
  IconTrash,
  glypheObjet
} from './Icons'
import { MenuDonner } from './MenuDonner'
import { usePnjEnReserve } from './ReservePnj'
import type { UiItem } from '../../../../preload/index'
import { ChoixDansArbre } from './ChoixDansArbre'
import { TexteCourt } from './TexteCourt'
import type {
  Character,
  FicheDuLieu as Fiche,
  LieuCarte,
  LieuScenario,
  Objet,
  ObjetPlacement,
  Place,
  SorteCarte
} from '@shared/types'
import { TIER_LABEL } from '@shared/types'
import { formesDesMurs } from '@shared/pieces'
import { useEchap } from '../echap'

/** L'éclair des déclencheurs. */
function IconEclair(): JSX.Element {
  return (
    <svg className="ico" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M9.2 1 3 9h4l-1.2 6L13 7H9l.2-6z" />
    </svg>
  )
}

/** La loupe des découvertes, dessinée au centre de sa case comme l'éclair. */
function IconDecouverte(): JSX.Element {
  return (
    <svg className="ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.4 10.4 14 14" />
    </svg>
  )
}

/** Ce qu'on tape attend un peu avant de partir : on n'écrit pas à chaque lettre. */
function useDiffere(): (cle: string, fn: () => void) => void {
  const minuteurs = useRef(new Map<string, number>())
  useEffect(() => {
    const m = minuteurs.current
    return () => m.forEach((t) => window.clearTimeout(t))
  }, [])
  return (cle, fn) => {
    const m = minuteurs.current
    if (m.has(cle)) window.clearTimeout(m.get(cle))
    m.set(
      cle,
      window.setTimeout(() => {
        m.delete(cle)
        fn()
      }, 600)
    )
  }
}

function initiales(nom: string): string {
  return nom
    .split(/\s+/)
    .map((m) => m[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

/**
 * Ce que la fiche montre, pour le dire juste : « Le niveau », « Le bâtiment »,
 * « L'espace » ou « Le lieu » — et « dans ce niveau », pas « dans ce lieu ».
 * Un bâtiment est un lieu posé à même l'espace, ou qui porte des niveaux
 * (la même règle que la liste des lieux).
 */
function sorteDu(p: Place, tous: Place[]): { le: string; ce: string; nom: string } {
  if (p.tier === 'espace') return { le: 'L’espace', ce: 'cet espace', nom: 'Espace' }
  if (p.tier === 'niveau') return { le: 'Le niveau', ce: 'ce niveau', nom: 'Niveau' }
  const batiment =
    tous.some((q) => q.id === p.parentId && q.tier === 'espace') ||
    tous.some((q) => q.parentId === p.id && q.tier === 'niveau')
  /* Une pièce unique posée à même l'espace reste un lieu pour le MJ : il n'y
     a pas d'étage à y ranger. */
  return batiment && !p.pieceUnique
    ? { le: 'Le bâtiment', ce: 'ce bâtiment', nom: 'Bâtiment' }
    : { le: 'Le lieu', ce: 'ce lieu', nom: 'Lieu' }
}

export function FicheDuLieu({
  p,
  niveau,
  voisins,
  onEditerPlan,
  onChanger
}: {
  p: Place
  /** Le contenant direct : pour une pièce, l'étage dont elle partage le plan. */
  niveau: Place | null
  /** Les lieux d'avant et d'après, dans l'ordre de l'arbre. */
  voisins?: { avant: Place | null; apres: Place | null }
  onEditerPlan: () => void
  /** Passer à la fiche d'un autre lieu : son niveau, ou l'un des lieux qu'il tient. */
  onChanger: (id: number) => void
}): JSX.Element {
  const s = useStore()
  const [fiche, setFiche] = useState<Fiche | null>(null)
  /** Le PNJ ou l'objet déplié à droite : `pnj-3`, `objet-5`. */
  const [deplie, setDeplie] = useState<string | null>(null)

  const relire = async (): Promise<void> => setFiche(await window.jdr.fiche.lire(p.id))

  useEffect(() => {
    setFiche(null)
    setDeplie(null)
    void relire()
    /* Un Ctrl+Z peut défaire ce qu'on vient d'écrire ici. */
    const h = (): void => void relire()
    window.addEventListener('jdr:defait', h)
    /* Ou le fichier du lieu, écrit hors de l'app. */
    const lache = window.jdr.fiche.onRelue(h)
    return () => {
      window.removeEventListener('jdr:defait', h)
      lache()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.id])

  /* Les PNJ de la séance : ceux du lieu d'abord, dans leur ordre. */
  const pnjsSeance = useMemo(() => s.characters.filter((c) => c.kind === 'pnj'), [s.characters])
  const pnjsIci = useMemo(
    () =>
      (fiche?.pnjIds ?? [])
        .map((id) => pnjsSeance.find((c) => c.id === id))
        .filter((c): c is Character => !!c),
    [fiche, pnjsSeance]
  )
  const objetsIci = exemplairesIci(s.objets, p.id, pnjsIci)

  /* Une pastille cliquée à gauche : on déplie la ligne à droite et on la fait briller. */
  const voir = (cle: string): void => {
    setDeplie(cle)
    window.requestAnimationFrame(() => eclairer(cle))
  }

  const piece = !!p.zone && !!niveau?.mapItemId
  const carte = s.allItems.find((i) => i.id === (piece ? niveau!.mapItemId : p.mapItemId))
  const decouvertes = (fiche?.cartes ?? []).filter((c) => c.sorte === 'decouverte')
  const aFaire = decouvertes.filter((c) => !c.fait).length
  const caches = objetsIci.filter((e) => e.x.port === 'lieu' && e.x.etat === 'cache').length
  /* « Rien de préparé » ne se dit que d'un lieu vraiment vide : un texte à lire,
     des secrets, un PNJ, c'est déjà une préparation. */
  const rien =
    !!fiche &&
    !fiche.cartes.length &&
    !fiche.scenarios.length &&
    !objetsIci.length &&
    !pnjsIci.length &&
    !p.summary?.trim() &&
    !p.notes?.trim()

  return (
    <section className="view fdl">
      <div className="fdl-barre">
        <nav className="fdl-voisins-noms" aria-label="Lieux voisins">
          {voisins?.avant ? (
            <button title="Le lieu d’avant, dans l’ordre de la liste" onClick={() => onChanger(voisins.avant!.id)}>
              ‹ {voisins.avant.name}
            </button>
          ) : null}
          {voisins?.apres ? (
            <button title="Le lieu d’après, dans l’ordre de la liste" onClick={() => onChanger(voisins.apres!.id)}>
              {voisins.apres.name} ›
            </button>
          ) : null}
        </nav>
        <div className="spacer" />
        {rien ? <span className="fdl-pastille">Rien de préparé</span> : null}
        {decouvertes.length ? (
          <span className="fdl-pastille">
            <b>{aFaire}</b> découverte{aFaire > 1 ? 's' : ''} à faire
          </span>
        ) : null}
        {caches ? (
          <span className="fdl-pastille">
            <b>{caches}</b> objet{caches > 1 ? 's' : ''} caché{caches > 1 ? 's' : ''}
          </span>
        ) : null}
        {carte && !piece ? (
          <button className="btn btn-sm btn-brass" onClick={onEditerPlan}>
            <IconPen />
            Éditer le plan
          </button>
        ) : null}
      </div>

      <div className="fdl-grille">
        <PanneauLieu p={p} niveau={niveau} onChanger={onChanger} />
        <PanneauArrivees
          p={p}
          fiche={fiche}
          pnjsIci={pnjsIci}
          pnjsSeance={pnjsSeance}
          relire={relire}
          onVoir={voir}
        />
        <PanneauQuiQuoi
          p={p}
          cartes={fiche?.cartes ?? []}
          pnjsIci={pnjsIci}
          pnjsSeance={pnjsSeance}
          objetsIci={objetsIci}
          relire={relire}
          deplie={deplie}
          onDeplier={setDeplie}
        />
      </div>
    </section>
  )
}

/**
 * Les PNJ et les objets d'un lieu, seuls : l'onglet « Objets et PNJ » du volet
 * de l'éditeur de plan. Le même panneau que la fiche, sans son cadre.
 */
export function QuiQuoiDuLieu({
  p,
  surPlan,
  ouvrir
}: {
  p: Place
  /** Les objets se glissent sur le plan d'à côté. */
  surPlan?: boolean
  /** Déplier cette rangée — un objet cliqué sur le plan. `n` relance le même. */
  ouvrir?: { cle: string; n: number } | null
}): JSX.Element {
  const s = useStore()
  const [fiche, setFiche] = useState<Fiche | null>(null)
  const [deplie, setDeplie] = useState<string | null>(null)

  const relire = async (): Promise<void> => setFiche(await window.jdr.fiche.lire(p.id))

  useEffect(() => {
    setFiche(null)
    setDeplie(null)
    void relire()
    const h = (): void => void relire()
    window.addEventListener('jdr:defait', h)
    const lache = window.jdr.fiche.onRelue(h)
    return () => {
      window.removeEventListener('jdr:defait', h)
      lache()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.id])
  useEffect(() => {
    if (ouvrir) setDeplie(ouvrir.cle)
  }, [ouvrir])

  const pnjsSeance = useMemo(() => s.characters.filter((c) => c.kind === 'pnj'), [s.characters])
  const pnjsIci = useMemo(
    () =>
      (fiche?.pnjIds ?? [])
        .map((id) => pnjsSeance.find((c) => c.id === id))
        .filter((c): c is Character => !!c),
    [fiche, pnjsSeance]
  )

  return (
    <PanneauQuiQuoi
      p={p}
      cartes={fiche?.cartes ?? []}
      pnjsIci={pnjsIci}
      pnjsSeance={pnjsSeance}
      objetsIci={exemplairesIci(s.objets, p.id, pnjsIci)}
      relire={relire}
      deplie={deplie}
      onDeplier={setDeplie}
      nu
      surPlan={surPlan}
    />
  )
}

/** Le type du glisser d'un exemplaire, de la liste vers le plan : son id. */
export const GLISSE_OBJET = 'application/x-jdr-placement'

/** Les exemplaires d'objets du lieu : posés ici, ou portés par l'un de ses PNJ. */
function exemplairesIci(objets: Objet[], placeId: number, pnjsIci: Character[]): Exemplaire[] {
  const ids = new Set(pnjsIci.map((c) => c.id))
  return objets.flatMap((o) =>
    o.placements
      .filter(
        (x) =>
          (x.port === 'lieu' && x.placeId === placeId) ||
          (x.port === 'pnj' && x.characterId != null && ids.has(x.characterId))
      )
      .map((x) => ({ o, x }))
  )
}

/**
 * Cocher une découverte, et ce qu'elle révèle suit : les objets qui lui sont
 * liés et qui sont posés dans ce lieu passent « trouvé » — ou redeviennent
 * « caché » si l'on décoche. Une seule coche pour un seul événement.
 */
async function cocherEtSuivre(c: LieuCarte, fait: boolean, placeId: number, objets: Objet[]): Promise<void> {
  await window.jdr.fiche.cocherCarte(c.id, fait)
  if (c.sorte !== 'decouverte') return
  const etat = fait ? 'trouve' : 'cache'
  for (const o of objets) {
    if (!c.objetIds.includes(o.id)) continue
    for (const x of o.placements)
      if (x.port === 'lieu' && x.placeId === placeId && x.etat !== etat)
        await window.jdr.objets.placement(x.id, { etat })
  }
}

/** L'inverse : un objet trouvé coche les découvertes qui le révèlent. */
async function suivreObjet(objetId: number, etat: 'cache' | 'trouve', cartes: LieuCarte[]): Promise<void> {
  const fait = etat === 'trouve'
  for (const c of cartes)
    if (c.sorte === 'decouverte' && c.objetIds.includes(objetId) && c.fait !== fait)
      await window.jdr.fiche.cocherCarte(c.id, fait)
}

/* ============================================================
   Le lieu : son nom, son plan, le texte à lire, les secrets du MJ
   ============================================================ */

function PanneauLieu({
  p,
  niveau,
  onChanger
}: {
  p: Place
  niveau: Place | null
  onChanger: (id: number) => void
}): JSX.Element {
  const s = useStore()
  const differe = useDiffere()
  const [summary, setSummary] = useState(p.summary ?? '')
  const [notes, setNotes] = useState(p.notes ?? '')
  const [choix, setChoix] = useState(false)
  const [grand, setGrand] = useState(false)
  const [rapport, setRapport] = useState(4 / 3)
  const enCours = useRef(false)

  /* Le texte revient du dehors (le volet, son fichier) tant qu'on n'écrit pas ici. */
  useEffect(() => {
    if (enCours.current) return
    setSummary(p.summary ?? '')
    setNotes(p.notes ?? '')
  }, [p.id, p.summary, p.notes])

  useEchap(() => setGrand(false), grand)

  const ecrire = (patch: { summary?: string; notes?: string }): void => {
    enCours.current = true
    /* Une clé par champ : écrire les notes juste après la description ne doit
       pas annuler l'envoi de la description. */
    differe(`texte-${Object.keys(patch)[0]}`, async () => {
      await window.jdr.places.upsert({ id: p.id, name: p.name, ...patch })
      enCours.current = false
      await s.refreshPlaces()
    })
  }

  /* Une pièce découpée montre le plan de son étage, sa zone en évidence. */
  const piece = !!p.zone && !!niveau?.mapItemId
  const porteur = piece ? niveau! : p
  const carte = s.allItems.find((i) => i.id === porteur.mapItemId)
  const soeurs = piece
    ? s.places.filter((q) => q.parentId === niveau!.id && q.zone && q.id !== p.id)
    : s.places.filter((q) => q.parentId === p.id && q.zone)
  const enfants = s.places
    .filter((q) => q.parentId === p.id)
    .sort((a, b) => a.ord - b.ord || a.name.localeCompare(b.name))
  const pts = (z: [number, number][]): string => z.map(([x, y]) => `${x},${y}`).join(' ')

  /* Les PNJ de chacune de ses pièces, pour les compter dans la liste. */
  const [pnjsDe, setPnjsDe] = useState<Record<number, number[]>>({})
  const clesEnfants = enfants.map((q) => q.id).join(',')
  useEffect(() => {
    let vivant = true
    const lire = async (): Promise<void> => {
      const ids = clesEnfants ? clesEnfants.split(',').map(Number) : []
      const fiches = await Promise.all(ids.map((id) => window.jdr.fiche.lire(id)))
      if (vivant) setPnjsDe(Object.fromEntries(ids.map((id, i) => [id, fiches[i].pnjIds])))
    }
    void lire()
    const fin = window.jdr.fiche.onRelue(() => void lire())
    return () => {
      vivant = false
      fin()
    }
  }, [clesEnfants])

  /* Une pièce unique n'a pas de zone : ce sont ses murs qui la referment. On
     les relit pour la montrer comme une pièce découpée, en évidence. */
  const [contours, setContours] = useState<[number, number][][]>([])
  useEffect(() => {
    if (!p.pieceUnique || piece) return setContours([])
    let vivant = true
    void window.jdr.murs.of(p.id).then((m) => {
      if (vivant) setContours(formesDesMurs(m).map((f) => f.pts))
    })
    return () => {
      vivant = false
    }
  }, [p.id, p.pieceUnique, p.mapItemId, piece])

  const sorte = sorteDu(p, s.places)
  /* La vignette suffit dans la colonne ; agrandi, il faut l'image entière. */
  const dessin = (entier: boolean): JSX.Element | null =>
    carte?.url ? (
      <>
        <img
          src={entier && carte.kind === 'image' ? carte.url : (carte.poster ?? carte.url)}
          alt={`Plan : ${porteur.name}`}
          draggable={false}
          onLoad={(e) => {
            const i = e.currentTarget
            if (i.naturalWidth && i.naturalHeight) setRapport(i.naturalWidth / i.naturalHeight)
          }}
        />
        <svg viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
          {soeurs.map((q) => (
            <polygon key={q.id} className="fdl-zone" points={pts(q.zone!)}>
              <title>{q.name}</title>
            </polygon>
          ))}
          {piece ? <polygon className="fdl-zone ici" points={pts(p.zone!)} /> : null}
          {contours.map((c, i) => (
            <polygon key={`u${i}`} className="fdl-zone ici" points={pts(c)} />
          ))}
        </svg>
      </>
    ) : null

  return (
    <section className="fdl-pane fdl-lieu">
      <div className="fdl-tete fdl-tete-lieu">
        <h3>{p.name}</h3>
        <span className="fdl-sorte-lieu">
          {sorte.nom}
          {p.pieceUnique ? ' · pièce unique' : ''}
          {niveau ? ` · dans ${niveau.name}` : ''}
        </span>
      </div>
      <div className="fdl-corps">
        {carte?.url ? (
          <button className="fdl-plan" title="Agrandir le plan" onClick={() => setGrand(true)}>
            {dessin(false)}
            <span className="fdl-agrandir">Agrandir</span>
          </button>
        ) : (
          <div className="fdl-plan sans">
            Pas encore de plan
            <button className="btn btn-sm" onClick={() => setChoix(true)}>
              <IconImage />
              Choisir un plan
            </button>
          </div>
        )}

        {/* Descendre dans l'un des lieux qu'il tient ; on remonte par le chemin, en haut. */}
        {enfants.length ? (
          <nav className="fdl-voisins" aria-label="Ce qu’il contient">
            <span className="eyebrow">
              {p.tier === 'niveau' ? 'Les pièces de ce niveau' : 'Ce qu’il contient'} · {enfants.length}
            </span>
            <div className="fdl-pieces">
              {enfants.map((q) => {
                const pnjs = (pnjsDe[q.id] ?? [])
                  .map((id) => s.characters.find((c) => c.id === id))
                  .filter((c): c is Character => !!c && c.kind === 'pnj')
                const objets = exemplairesIci(s.objets, q.id, pnjs).length
                return (
                  <button key={q.id} className="fdl-piece" onClick={() => onChanger(q.id)}>
                    <span className="fdl-piece-nom">{q.name}</span>
                    <span className={`fdl-piece-compte${pnjs.length ? '' : ' zero'}`} title="PNJ présents">
                      {pnjs.length} PNJ
                    </span>
                    <span className={`fdl-piece-compte${objets ? '' : ' zero'}`} title="Objets posés, et portés par ses PNJ">
                      {objets} objet{objets > 1 ? 's' : ''}
                    </span>
                  </button>
                )
              })}
            </div>
          </nav>
        ) : null}

        <label className="eyebrow" htmlFor="fdl-sum">
          À lire aux joueurs
        </label>
        <textarea
          id="fdl-sum"
          className="fdl-alire"
          value={summary}
          placeholder="Ce qu’ils voient en arrivant…"
          onChange={(e) => {
            setSummary(e.target.value)
            ecrire({ summary: e.target.value })
          }}
        />
        <label className="eyebrow" htmlFor="fdl-notes">
          Secrets du MJ
        </label>
        <textarea
          id="fdl-notes"
          className="fdl-secret"
          value={notes}
          placeholder="Ce qu’ils ne doivent pas savoir…"
          onChange={(e) => {
            setNotes(e.target.value)
            ecrire({ notes: e.target.value })
          }}
        />
      </div>

      {grand && carte?.url ? (
        <div className="fdl-voile" onClick={() => setGrand(false)}>
          {/* Toute la place de l'écran, à la proportion du plan — même un petit plan grandit. */}
          <div className="fdl-plan grand" style={{ aspectRatio: rapport, width: `min(94vw, calc(88vh * ${rapport}))` }}>
            {dessin(true)}
          </div>
          <button className="btn btn-sm fdl-voile-fermer">Fermer · Échap</button>
        </div>
      ) : null}

      {choix ? (
        <ChoixDansArbre
          titre={`Le plan de ${porteur.name}`}
          icone={<IconImage />}
          kinds={['image']}
          rendu="vignettes"
          courant={porteur.mapItemId}
          onPick={async (id) => {
            setChoix(false)
            if (id == null) return
            await window.jdr.places.upsert({ id: porteur.id, name: porteur.name, mapItemId: id })
            await s.refreshPlaces()
          }}
          onClose={() => setChoix(false)}
        />
      ) : null}
    </section>
  )
}

/* ============================================================
   Ce qui peut arriver ici : découvertes, déclencheurs, scénarios
   ============================================================ */

/** Ce qu'on écrit d'une carte, entier — ce que `majCarte` reçoit. */
interface Brouillon {
  sorte: SorteCarte
  titre: string
  si: string
  alors: string
  beatId: number | null
  objetIds: number[]
  pnjIds: number[]
}

/** La sorte d'un article : les deux sortes de carte, et le scénario. */
type Genre = SorteCarte | 'scenario'

const GENRES: { cle: Genre; label: string; pluriel: string }[] = [
  { cle: 'decouverte', label: 'Découverte', pluriel: 'Découvertes' },
  { cle: 'declencheur', label: 'Déclencheur', pluriel: 'Déclencheurs' },
  { cle: 'scenario', label: 'Scénario', pluriel: 'Scénarios' }
]

/** Un article de la liste : une carte, ou un scénario avec son numéro. */
type Article = { cle: string; genre: SorteCarte; c: LieuCarte } | { cle: string; genre: 'scenario'; sc: LieuScenario; num: number }

function MarqueGenre({ genre, num }: { genre: Genre; num?: number }): JSX.Element {
  return (
    <span className={`fdl-sorte ${genre}`} title={GENRES.find((g) => g.cle === genre)!.label}>
      {genre === 'decouverte' ? <IconDecouverte /> : genre === 'declencheur' ? <IconEclair /> : <span className="num">{num ?? 'n°'}</span>}
    </span>
  )
}

function PanneauArrivees({
  p,
  fiche,
  pnjsIci,
  pnjsSeance,
  relire,
  onVoir
}: {
  p: Place
  fiche: Fiche | null
  pnjsIci: Character[]
  pnjsSeance: Character[]
  relire: () => Promise<void>
  onVoir: (cle: string) => void
}): JSX.Element {
  const s = useStore()
  const [filtre, setFiltre] = useState<Genre | 'tout'>('tout')
  const [genre, setGenre] = useState<Genre>('decouverte')
  const [titre, setTitre] = useState('')
  const [ouvert, setOuvert] = useState<string | null>(null)
  /* Un clic déplie l'article pour le lire en entier ; le crayon l'ouvre à l'écriture. */
  const [lu, setLu] = useState<string | null>(null)
  const [faitsReplies, setFaitsReplies] = useState(() => {
    try {
      return localStorage.getItem('fiche.faitsReplies') !== '0'
    } catch {
      return true
    }
  })
  const champ = useRef<HTMLInputElement>(null)
  const liste = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setOuvert(null)
    setLu(null)
  }, [p.id])

  /* L'article ouvert se referme d'un clic ailleurs — pas dans un menu qu'il a ouvert. */
  useEffect(() => {
    if (!ouvert) return
    const h = (e: MouseEvent): void => {
      const t = e.target as HTMLElement | null
      if (!t || t.closest('.fdl-art.ouvert') || t.closest('.pop') || !document.body.contains(t)) return
      setOuvert(null)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [ouvert])

  const cartes = fiche?.cartes ?? []
  const scenarios = fiche?.scenarios ?? []
  const aVenir: Article[] = [
    ...cartes.filter((c) => !c.fait).map((c): Article => ({ cle: `c${c.id}`, genre: c.sorte, c })),
    ...scenarios.map((sc, i): Article => ({ cle: `s${sc.id}`, genre: 'scenario', sc, num: i + 1 }))
  ]
  const faits: Article[] = cartes.filter((c) => c.fait).map((c) => ({ cle: `c${c.id}`, genre: c.sorte, c }))
  const garde = (a: Article): boolean => filtre === 'tout' || a.genre === filtre
  const compte = (g: Genre | 'tout'): number =>
    g === 'tout' ? cartes.length + scenarios.length : g === 'scenario' ? scenarios.length : cartes.filter((c) => c.sorte === g).length

  const creer = async (): Promise<void> => {
    const t = titre.trim()
    if (!t) return
    if (genre === 'scenario') await window.jdr.fiche.ajouterScenario(p.id, t)
    else
      await window.jdr.fiche.ajouterCarte(p.id, {
        sorte: genre,
        titre: t,
        si: '',
        alors: '',
        beatId: null,
        objetIds: [],
        pnjIds: []
      })
    setTitre('')
    if (filtre !== 'tout' && filtre !== genre) setFiltre('tout')
    await relire()
  }

  const basculerFaits = (): void =>
    setFaitsReplies((v) => {
      try {
        localStorage.setItem('fiche.faitsReplies', v ? '0' : '1')
      } catch {
        /* sans stockage, le choix ne dure que la visite */
      }
      return !v
    })

  const rendre = (a: Article): JSX.Element =>
    ouvert === a.cle ? (
      a.genre === 'scenario' ? (
        <EditionScenario
          key={a.cle}
          sc={a.sc}
          num={a.num}
          p={p}
          scenarios={scenarios}
          relire={relire}
          onFermer={() => setOuvert(null)}
          onRouvrir={setOuvert}
        />
      ) : (
        <EditionCarte
          key={a.cle}
          c={a.c}
          p={p}
          pnjsIci={pnjsIci}
          pnjsSeance={pnjsSeance}
          relire={relire}
          onFermer={() => setOuvert(null)}
          onRouvrir={setOuvert}
        />
      )
    ) : (
      <LigneArticle
        key={a.cle}
        a={a}
        pnjsSeance={pnjsSeance}
        lu={lu === a.cle}
        onLire={() => setLu(lu === a.cle ? null : a.cle)}
        onModifier={() => {
          setLu(a.cle)
          setOuvert(a.cle)
        }}
        onVoir={onVoir}
        onCocher={async (c, fait) => {
          await cocherEtSuivre(c, fait, p.id, s.objets)
          await Promise.all([relire(), s.refreshObjets()])
        }}
      />
    )

  const vus = aVenir.filter(garde)
  const faitsVus = faits.filter(garde)

  return (
    <section className="fdl-pane fdl-arrivees">
      <div className="fdl-tete">
        <h3>Ce qui peut arriver ici</h3>
        <span className="fdl-compte">{aVenir.length ? `${aVenir.length} à venir` : ''}</span>
        <div className="spacer" />
        <div className="fdl-filtres" role="group" aria-label="Filtrer">
          {(['tout', ...GENRES.map((g) => g.cle)] as const).map((g) => (
            <button key={g} aria-pressed={filtre === g} onClick={() => setFiltre(g)}>
              {g === 'tout' ? 'Tout' : GENRES.find((x) => x.cle === g)!.pluriel}
              <span className="fdl-compte">{compte(g)}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="fdl-corps" ref={liste}>
        <div className="fdl-nouveau">
          <span className="fdl-genre" role="group" aria-label="Sorte">
            {GENRES.map((g) => (
              <button
                key={g.cle}
                className={genre === g.cle ? 'on' : ''}
                title={g.label}
                onClick={() => {
                  setGenre(g.cle)
                  champ.current?.focus()
                }}
              >
                {g.cle === 'decouverte' ? <IconDecouverte /> : g.cle === 'declencheur' ? <IconEclair /> : <b className="num">n°</b>}
                {genre === g.cle ? g.label : null}
              </button>
            ))}
          </span>
          <input
            ref={champ}
            value={titre}
            placeholder="Titre court, puis Entrée — Échap pour arrêter"
            aria-label="Titre du nouvel article"
            onChange={(e) => setTitre(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void creer()
              } else if (e.key === 'Escape') {
                setTitre('')
                e.currentTarget.blur()
              }
            }}
          />
        </div>

        {fiche && cartes.length === 0 && scenarios.length === 0 ? (
          <div className="fdl-amorces">
            <b>Rien de prévu ici pour l’instant</b>
            <span>Commence par une de ces questions — Entrée crée, et le champ reste ouvert pour la suivante.</span>
            {(
              [
                ['decouverte', 'Que peuvent-ils trouver en fouillant ?'],
                ['declencheur', 'Que se passe-t-il s’ils font telle chose ?'],
                ['scenario', 'Que peuvent-ils décider de faire ici ?']
              ] as const
            ).map(([g, q]) => (
              <button
                key={g}
                className="fdl-amorce"
                onClick={() => {
                  setGenre(g)
                  champ.current?.focus()
                }}
              >
                <MarqueGenre genre={g} />
                {q}
              </button>
            ))}
          </div>
        ) : null}

        {fiche && compte(filtre) > 0 && vus.length === 0 && faitsVus.length === 0 ? (
          <p className="fdl-vide">Rien dans ce filtre.</p>
        ) : null}
        {vus.map(rendre)}
        {faitsVus.length ? (
          <>
            <button className="fdl-faits" aria-expanded={!faitsReplies} onClick={basculerFaits}>
              <span className="eyebrow">
                {faitsReplies ? '▸' : '▾'} Trouvé ou déclenché · {faitsVus.length}
              </span>
            </button>
            {faitsReplies ? null : faitsVus.map(rendre)}
          </>
        ) : null}
      </div>
    </section>
  )
}

/**
 * Un article fermé : sa marque, son titre, sa coche, ce qu'il dit en deux
 * lignes, ses liens. Lu (un clic), il dit tout, et le crayon ouvre l'écriture.
 */
function LigneArticle({
  a,
  pnjsSeance,
  lu,
  onLire,
  onModifier,
  onVoir,
  onCocher
}: {
  a: Article
  pnjsSeance: Character[]
  lu: boolean
  onLire: () => void
  onModifier: () => void
  onVoir: (cle: string) => void
  onCocher: (c: LieuCarte, fait: boolean) => void
}): JSX.Element {
  const s = useStore()
  const crayon = lu ? (
    <button
      className="fdl-icone"
      title="Modifier"
      aria-label="Modifier"
      onClick={(e) => {
        e.stopPropagation()
        onModifier()
      }}
    >
      <IconPen />
    </button>
  ) : null
  if (a.genre === 'scenario')
    return (
      <article className={`fdl-art${lu ? ' lu' : ''}`} onClick={onLire} aria-expanded={lu}>
        <div className="fdl-art-ligne">
          <MarqueGenre genre="scenario" num={a.num} />
          <span className="fdl-art-titre">{a.sc.titre || 'Sans titre'}</span>
          <span className="fdl-art-actions">{crayon}</span>
        </div>
        {a.sc.info ? <p className="fdl-art-resume">{a.sc.info}</p> : null}
      </article>
    )
  const c = a.c
  const objets = c.objetIds.map((id) => s.objets.find((o) => o.id === id)).filter((o): o is Objet => !!o)
  const pnjs = c.pnjIds.map((id) => pnjsSeance.find((x) => x.id === id)).filter((x): x is Character => !!x)
  const moment = c.beatId != null ? s.beats.find((b) => b.id === c.beatId) : null
  return (
    <article className={`fdl-art${c.fait ? ' fait' : ''}${lu ? ' lu' : ''}`} onClick={onLire} aria-expanded={lu}>
      <div className="fdl-art-ligne">
        <MarqueGenre genre={c.sorte} />
        <span className="fdl-art-titre">{c.titre}</span>
        <span className="fdl-art-actions">
          <label className={`fdl-coche${c.fait ? ' fait' : ''}`} title="Pendant la partie" onClick={(e) => e.stopPropagation()}>
            <input type="checkbox" checked={c.fait} onChange={(e) => onCocher(c, e.target.checked)} />
            {c.sorte === 'decouverte' ? 'trouvée' : 'déclenché'}
          </label>
          {crayon}
        </span>
      </div>
      {!(c.si || c.alors) ? null : lu ? (
        <dl className="fdl-si fdl-art-tout">
          <dt>SI</dt>
          <dd>{c.si || '—'}</dd>
          <dt>ALORS</dt>
          <dd>{c.alors || '—'}</dd>
        </dl>
      ) : (
        <p className="fdl-art-resume">
          <em>SI</em> {c.si || '—'} <em>ALORS</em> {c.alors || '—'}
        </p>
      )}
      {objets.length || pnjs.length || moment ? (
        <div className="fdl-liens" onClick={(e) => e.stopPropagation()}>
          {objets.map((o) => (
            <PuceObjet key={o.id} o={o} onClick={() => onVoir(`objet-${o.id}`)} />
          ))}
          {pnjs.map((x) => (
            <PucePnj key={x.id} c={x} onClick={() => onVoir(`pnj-${x.id}`)} />
          ))}
          {moment ? (
            <button
              className="fdl-puce moment"
              title="Ouvrir ce moment dans la Chronologie"
              onClick={() => {
                s.setActiveBeat(moment.id)
                s.setView('timeline')
              }}
            >
              → moment « {moment.title} »
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

/**
 * Écrire au fil de la frappe : on garde le dernier état, on l'envoie un peu
 * après, et on l'envoie tout de suite si l'article se referme entre-temps.
 */
function useEnvoiDiffere<T>(envoyer: (v: T) => Promise<void>): (v: T) => void {
  const attente = useRef<number | null>(null)
  const dernier = useRef<T | null>(null)
  const fn = useRef(envoyer)
  fn.current = envoyer
  useEffect(
    () => () => {
      if (attente.current != null) {
        window.clearTimeout(attente.current)
        if (dernier.current !== null) void fn.current(dernier.current)
      }
    },
    []
  )
  return (v) => {
    dernier.current = v
    if (attente.current != null) window.clearTimeout(attente.current)
    attente.current = window.setTimeout(() => {
      attente.current = null
      void fn.current(v)
    }, 600)
  }
}

/** Changer de sorte : d'une carte à l'autre on garde tout ; vers un scénario ou depuis, on recrée. */
function ChoixGenre({ genre, onGenre }: { genre: Genre; onGenre: (g: Genre) => void }): JSX.Element {
  return (
    <select
      className="fdl-saisie fdl-art-genre"
      value={genre}
      aria-label="Sorte"
      onChange={(e) => onGenre(e.target.value as Genre)}
    >
      {GENRES.map((g) => (
        <option key={g.cle} value={g.cle}>
          {g.label}
        </option>
      ))}
    </select>
  )
}

function EditionCarte({
  c,
  p,
  pnjsIci,
  pnjsSeance,
  relire,
  onFermer,
  onRouvrir
}: {
  c: LieuCarte
  p: Place
  pnjsIci: Character[]
  pnjsSeance: Character[]
  relire: () => Promise<void>
  onFermer: () => void
  /** Rouvrir l'article sous sa nouvelle forme (après un changement de sorte). */
  onRouvrir: (cle: string) => void
}): JSX.Element {
  const s = useStore()
  const [b, setB] = useState<Brouillon>({
    sorte: c.sorte,
    titre: c.titre,
    si: c.si,
    alors: c.alors,
    beatId: c.beatId,
    objetIds: [...c.objetIds],
    pnjIds: [...c.pnjIds]
  })
  const titre = useRef<HTMLInputElement>(null)
  useEffect(() => titre.current?.focus(), [])

  const envoyer = useEnvoiDiffere(async (v: Brouillon) => {
    /* Le titre est la clé du fichier texte du lieu : sans lui, on n'écrit pas. */
    if (!v.titre.trim()) return
    await window.jdr.fiche.majCarte(c.id, { ...v, titre: v.titre.trim(), beatId: v.sorte === 'declencheur' ? v.beatId : null })
    await relire()
  })
  const set = (patch: Partial<Brouillon>): void => {
    const n = { ...b, ...patch }
    setB(n)
    envoyer(n)
  }

  const changerGenre = async (g: Genre): Promise<void> => {
    if (g !== 'scenario') return set({ sorte: g, beatId: g === 'declencheur' ? b.beatId : null })
    const sc = await window.jdr.fiche.ajouterScenario(p.id, b.titre.trim() || 'Sans titre')
    const info = [b.si ? `Si : ${b.si}` : '', b.alors].filter(Boolean).join('\n')
    if (info) await window.jdr.fiche.majScenario(sc.id, { info })
    await window.jdr.fiche.supprimerCarte(c.id)
    await relire()
    onRouvrir(`s${sc.id}`)
  }

  return (
    <article
      className="fdl-art ouvert"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onFermer()
      }}
    >
      <div className="fdl-art-ligne">
        <MarqueGenre genre={b.sorte} />
        <input
          ref={titre}
          className="fdl-saisie fdl-art-titre"
          value={b.titre}
          placeholder="Titre court"
          aria-label="Titre"
          onChange={(e) => set({ titre: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onFermer()
          }}
        />
      </div>
      <div className="fdl-art-edition">
        <label className="fdl-champ">
          <span className="eyebrow">Si</span>
          <textarea className="fdl-saisie" value={b.si} placeholder="Ce que font les joueurs…" onChange={(e) => set({ si: e.target.value })} />
        </label>
        <label className="fdl-champ">
          <span className="eyebrow">Alors</span>
          <textarea
            className="fdl-saisie"
            value={b.alors}
            placeholder={b.sorte === 'decouverte' ? 'Ce qu’ils trouvent…' : 'Ce qui se passe…'}
            onChange={(e) => set({ alors: e.target.value })}
          />
        </label>
        <div className="fdl-champ">
          <span className="eyebrow">Liés</span>
          <ChoixLiens b={b} p={p} pnjsIci={pnjsIci} pnjsSeance={pnjsSeance} onChange={set} />
        </div>
        <div className="fdl-pied">
          <span className="fdl-astuce">Enregistré au fil de la frappe · Échap ou clic ailleurs pour refermer</span>
          <div className="spacer" />
          <ChoixGenre genre={b.sorte} onGenre={(g) => void changerGenre(g)} />
          <button
            className="btn btn-sm btn-ghost btn-danger"
            onClick={async () => {
              await window.jdr.fiche.supprimerCarte(c.id)
              onFermer()
              await relire()
              s.toast(`« ${c.titre} » supprimé — Ctrl+Z pour le rendre`)
            }}
          >
            <IconTrash />
            Supprimer
          </button>
        </div>
      </div>
    </article>
  )
}

function EditionScenario({
  sc,
  num,
  p,
  scenarios,
  relire,
  onFermer,
  onRouvrir
}: {
  sc: LieuScenario
  num: number
  p: Place
  scenarios: LieuScenario[]
  relire: () => Promise<void>
  onFermer: () => void
  onRouvrir: (cle: string) => void
}): JSX.Element {
  const s = useStore()
  const [titre, setTitre] = useState(sc.titre)
  const [info, setInfo] = useState(sc.info)
  const champ = useRef<HTMLInputElement>(null)
  useEffect(() => champ.current?.focus(), [])
  const envoyer = useEnvoiDiffere(async (v: { titre: string; info: string }) => {
    await window.jdr.fiche.majScenario(sc.id, v)
    await relire()
  })
  const i = scenarios.findIndex((x) => x.id === sc.id)
  const deplacer = async (sens: -1 | 1): Promise<void> => {
    const ids = scenarios.map((x) => x.id)
    const j = i + sens
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    await window.jdr.fiche.ordonnerScenarios(p.id, ids)
    await relire()
  }
  const changerGenre = async (g: Genre): Promise<void> => {
    if (g === 'scenario') return
    const id = await window.jdr.fiche.ajouterCarte(p.id, {
      sorte: g,
      titre: titre.trim() || 'Sans titre',
      si: '',
      alors: info,
      beatId: null,
      objetIds: [],
      pnjIds: []
    })
    await window.jdr.fiche.supprimerScenario(sc.id)
    await relire()
    onRouvrir(`c${id}`)
  }

  return (
    <article
      className="fdl-art ouvert"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onFermer()
      }}
    >
      <div className="fdl-art-ligne">
        <MarqueGenre genre="scenario" num={num} />
        <input
          ref={champ}
          className="fdl-saisie fdl-art-titre"
          value={titre}
          placeholder="Titre court"
          aria-label={`Titre du scénario ${num}`}
          onChange={(e) => {
            setTitre(e.target.value)
            envoyer({ titre: e.target.value, info })
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onFermer()
          }}
        />
      </div>
      <div className="fdl-art-edition">
        <label className="fdl-champ">
          <span className="eyebrow">Suite</span>
          <textarea
            className="fdl-saisie"
            value={info}
            placeholder="Ce qui se passe…"
            onChange={(e) => {
              setInfo(e.target.value)
              envoyer({ titre, info: e.target.value })
            }}
          />
        </label>
        <div className="fdl-pied">
          <button className="btn btn-sm btn-ghost" disabled={i <= 0} onClick={() => void deplacer(-1)} title="Monter d’un rang">
            ↑
          </button>
          <button
            className="btn btn-sm btn-ghost"
            disabled={i < 0 || i >= scenarios.length - 1}
            onClick={() => void deplacer(1)}
            title="Descendre d’un rang"
          >
            ↓
          </button>
          <span className="fdl-astuce">Enregistré au fil de la frappe · Échap pour refermer</span>
          <div className="spacer" />
          <ChoixGenre genre="scenario" onGenre={(g) => void changerGenre(g)} />
          <button
            className="btn btn-sm btn-ghost btn-danger"
            onClick={async () => {
              await window.jdr.fiche.supprimerScenario(sc.id)
              onFermer()
              await relire()
              s.toast(`Scénario « ${sc.titre || num} » supprimé — Ctrl+Z pour le rendre`)
            }}
          >
            <IconTrash />
            Supprimer
          </button>
        </div>
      </div>
    </article>
  )
}

/** Lier une carte à des objets, des PNJ et — pour un déclencheur — un moment. */
function ChoixLiens({
  b,
  p,
  pnjsIci,
  pnjsSeance,
  onChange
}: {
  b: Brouillon
  p: Place
  pnjsIci: Character[]
  pnjsSeance: Character[]
  onChange: (patch: Partial<Brouillon>) => void
}): JSX.Element {
  const s = useStore()
  const ce = sorteDu(p, s.places).ce
  const [choix, setChoix] = useState<'objet' | 'pnj' | 'moment' | null>(null)
  const [cherche, setCherche] = useState('')
  useEffect(() => setCherche(''), [choix])

  const objets = b.objetIds.map((id) => s.objets.find((o) => o.id === id)).filter((o): o is Objet => !!o)
  const pnjs = b.pnjIds.map((id) => pnjsSeance.find((x) => x.id === id)).filter((x): x is Character => !!x)
  const moment = b.beatId != null ? s.beats.find((m) => m.id === b.beatId) : null

  /* Les objets : ceux du lieu, puis ceux posés ailleurs dans la séance, puis la réserve. */
  const groupesObjets = (): { titre: string; liste: Objet[] }[] => {
    const ici = s.objets.filter((o) => o.placements.some((x) => x.port === 'lieu' && x.placeId === p.id))
    const poses = s.objets.filter((o) => !ici.includes(o) && o.placements.length > 0)
    const reste = s.objets.filter((o) => !ici.includes(o) && !poses.includes(o))
    return [
      { titre: `Dans ${ce}`, liste: ici },
      { titre: 'Ailleurs dans la séance', liste: poses },
      { titre: 'Dans la réserve', liste: reste }
    ].filter((g) => g.liste.length)
  }
  const ouObjet = (o: Objet): string => {
    const x = o.placements.find((y) => y.port === 'lieu' && y.placeId === p.id) ?? o.placements[0]
    if (!x) return 'réserve'
    return x.port === 'lieu' && x.placeId === p.id ? (x.precision ?? 'ici') : x.cible
  }
  const q = cherche.trim().toLowerCase()
  const garde = (nom: string): boolean => !q || nom.toLowerCase().includes(q)

  const lier = (type: 'objet' | 'pnj' | 'moment', nom: string): JSX.Element => (
    <button className="fdl-lier" aria-expanded={choix === type} onClick={() => setChoix(choix === type ? null : type)}>
      + {nom}
    </button>
  )

  return (
    <div className="fdl-liens-edition">
      <div className="fdl-liens">
        {objets.map((o) => (
          <PuceObjet key={o.id} o={o} retirer onClick={() => onChange({ objetIds: b.objetIds.filter((x) => x !== o.id) })} />
        ))}
        {pnjs.map((x) => (
          <PucePnj key={x.id} c={x} retirer onClick={() => onChange({ pnjIds: b.pnjIds.filter((y) => y !== x.id) })} />
        ))}
        {moment ? (
          <button className="fdl-puce moment" title="Retirer le lien" onClick={() => onChange({ beatId: null })}>
            → « {moment.title} »<span className="x">×</span>
          </button>
        ) : null}
        {lier('objet', 'Objet')}
        {lier('pnj', 'PNJ')}
        {b.sorte === 'declencheur' ? lier('moment', 'Moment') : null}
      </div>

      {choix ? (
        <div className="fdl-choix">
          {choix !== 'moment' ? (
            <input
              className="fdl-saisie"
              autoFocus
              value={cherche}
              placeholder={choix === 'objet' ? 'Chercher un objet de la réserve…' : 'Chercher un PNJ…'}
              onChange={(e) => setCherche(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.stopPropagation()
                  setChoix(null)
                }
              }}
            />
          ) : null}
          <div className="fdl-choix-liste">
            {choix === 'objet'
              ? groupesObjets().map((g) => {
                  const liste = g.liste.filter((o) => garde(o.nom))
                  return liste.length ? (
                    <div key={g.titre}>
                      <div className="fdl-choix-groupe">{g.titre}</div>
                      {liste.map((o) => {
                        const pris = b.objetIds.includes(o.id)
                        const img = s.allItems.find((i) => i.id === o.imageItemId)
                        return (
                          <button
                            key={o.id}
                            className="fdl-choix-item"
                            disabled={pris}
                            onClick={() => onChange({ objetIds: [...b.objetIds, o.id] })}
                          >
                            {img?.url ? <img src={img.poster ?? img.url} alt="" /> : <span className="rond" />}
                            <span>
                              {o.nom}
                              {pris ? ' ✓' : ''}
                            </span>
                            <span className="ou">{ouObjet(o)}</span>
                          </button>
                        )
                      })}
                    </div>
                  ) : null
                })
              : choix === 'pnj'
                ? [
                    { titre: `Dans ${ce}`, liste: pnjsIci },
                    { titre: 'Ailleurs dans la séance', liste: pnjsSeance.filter((c) => !pnjsIci.includes(c)) }
                  ].map((g) => {
                    const liste = g.liste.filter((c) => garde(c.name))
                    return liste.length ? (
                      <div key={g.titre}>
                        <div className="fdl-choix-groupe">{g.titre}</div>
                        {liste.map((c) => {
                          const pris = b.pnjIds.includes(c.id)
                          const img = s.allItems.find((i) => i.id === c.portraitItemId)
                          return (
                            <button
                              key={c.id}
                              className="fdl-choix-item pnj"
                              disabled={pris}
                              onClick={() => onChange({ pnjIds: [...b.pnjIds, c.id] })}
                            >
                              {img?.url ? <img src={img.poster ?? img.url} alt="" /> : <span className="rond">{initiales(c.name)}</span>}
                              <span>
                                {c.name}
                                {pris ? ' ✓' : ''}
                              </span>
                              <span className="ou">{c.occupation ?? ''}</span>
                            </button>
                          )
                        })}
                      </div>
                    ) : null
                  })
                : (
                  <div>
                    <div className="fdl-choix-groupe">Moments de la séance</div>
                    {s.beats.length === 0 ? (
                      <p className="fdl-vide">Aucun moment dans cette séance.</p>
                    ) : (
                      s.beats.map((m) => (
                        <button
                          key={m.id}
                          className="fdl-choix-item"
                          disabled={b.beatId === m.id}
                          onClick={() => {
                            onChange({ beatId: m.id })
                            setChoix(null)
                          }}
                        >
                          <span className="rond">{m.atTime ?? '·'}</span>
                          <span>{m.title}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

/* ============================================================
   Qui et quoi : les PNJ du lieu, ce qu'ils portent, ce qui est posé
   ============================================================ */

function PanneauQuiQuoi({
  p,
  cartes,
  pnjsIci,
  pnjsSeance,
  objetsIci,
  relire,
  deplie,
  onDeplier,
  nu = false,
  surPlan = false
}: {
  p: Place
  cartes: LieuCarte[]
  pnjsIci: Character[]
  pnjsSeance: Character[]
  objetsIci: Exemplaire[]
  relire: () => Promise<void>
  deplie: string | null
  onDeplier: (cle: string | null) => void
  /** Sans cadre ni titre : dans le volet de l'éditeur de plan. */
  nu?: boolean
  /** Dans l'éditeur de plan : un objet posé se glisse sur le plan. */
  surPlan?: boolean
}): JSX.Element {
  const s = useStore()
  const [cherche, setCherche] = useState('')
  const [menu, setMenu] = useState(false)
  const hote = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    const h = (e: MouseEvent): void => {
      if (!hote.current?.contains(e.target as Node)) setMenu(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [menu])

  const q = cherche.trim().toLowerCase()
  const autres = pnjsSeance.filter((c) => !pnjsIci.includes(c) && (!q || c.name.toLowerCase().includes(q)))
  const reserve = s.objets.filter((o) => !q || o.nom.toLowerCase().includes(q)).slice(0, 40)
  const libres = objetsIci.filter((e) => e.x.port === 'lieu')

  const fini = (cle: string): void => {
    setCherche('')
    setMenu(false)
    onDeplier(cle)
  }
  const prendrePnj = async (id: number): Promise<void> => {
    await window.jdr.fiche.ajouterPnj(p.id, id)
    await relire()
    fini(`pnj-${id}`)
  }
  const creerPnj = async (nom: string): Promise<void> => {
    const tpl = s.sheet?.id ?? s.templates[0]?.id
    if (!tpl) return s.toast('Aucune fiche de personnage dans cette campagne', true)
    const c = await window.jdr.characters.upsert({ templateId: tpl, kind: 'pnj', name: nom })
    await s.refreshCharacters()
    await prendrePnj(c.id)
  }
  const poserObjet = async (objetId: number): Promise<void> => {
    await window.jdr.objets.poser({ objetId, port: 'lieu', placeId: p.id })
    await s.refreshObjets()
    fini(`objet-${objetId}`)
  }
  const creerObjet = async (nom: string): Promise<void> => {
    const o = await window.jdr.objets.add({ nom })
    await poserObjet(o.id)
  }

  return (
    <section className={nu ? 'fdl-qq fdl-qq-nu' : 'fdl-pane fdl-qq'}>
      {nu ? null : (
        <div className="fdl-tete">
          <h3>Qui et quoi</h3>
          <span className="fdl-compte">
            {pnjsIci.length + objetsIci.length ? `${pnjsIci.length} PNJ · ${objetsIci.length} objet${objetsIci.length > 1 ? 's' : ''}` : ''}
          </span>
        </div>
      )}
      <div className="fdl-corps">
        <div className="fdl-qq-chercher" ref={hote}>
          <div className="fdl-nouveau">
            <IconSearch />
            <input
              value={cherche}
              placeholder="Ajouter un PNJ ou un objet…"
              aria-label="Ajouter un PNJ ou un objet"
              onFocus={() => setMenu(true)}
              onChange={(e) => {
                setCherche(e.target.value)
                setMenu(true)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setMenu(false)
                  e.currentTarget.blur()
                }
              }}
            />
          </div>
          {menu ? (
            <div className="fdl-qq-menu">
              {autres.length ? <div className="fdl-choix-groupe">PNJ de la séance</div> : null}
              {autres.map((c) => {
                const img = s.allItems.find((i) => i.id === c.portraitItemId)
                return (
                  <button key={c.id} className="fdl-choix-item pnj" onClick={() => void prendrePnj(c.id)}>
                    {img?.url ? <img src={img.poster ?? img.url} alt="" /> : <span className="rond">{initiales(c.name)}</span>}
                    <span>{c.name}</span>
                    <span className="ou">{c.occupation ?? ''}</span>
                  </button>
                )
              })}
              {reserve.length ? <div className="fdl-choix-groupe">Réserve d’objets</div> : null}
              {reserve.map((o) => {
                const img = s.allItems.find((i) => i.id === o.imageItemId)
                const ici = objetsIci.some((e) => e.o.id === o.id)
                return (
                  <button key={o.id} className="fdl-choix-item" onClick={() => void poserObjet(o.id)}>
                    {img?.url ? <img src={img.poster ?? img.url} alt="" /> : <span className="rond" />}
                    <span>{o.nom}</span>
                    <span className="ou">{ici ? 'déjà ici — un de plus' : o.placements.length ? 'posé ailleurs' : 'réserve'}</span>
                  </button>
                )
              })}
              {q ? (
                <>
                  <div className="fdl-choix-groupe">Créer</div>
                  <button className="fdl-choix-item creer" onClick={() => void creerPnj(cherche.trim())}>
                    <span className="rond">+</span>
                    <span>PNJ « {cherche.trim()} »</span>
                  </button>
                  <button className="fdl-choix-item creer" onClick={() => void creerObjet(cherche.trim())}>
                    <span className="rond">+</span>
                    <span>Objet « {cherche.trim()} »</span>
                  </button>
                </>
              ) : !autres.length && !reserve.length ? (
                <p className="fdl-vide">Tape un nom pour créer un PNJ ou un objet.</p>
              ) : null}
            </div>
          ) : null}
        </div>

        {!pnjsIci.length && !objetsIci.length ? (
          <p className="fdl-vide">Personne et rien ici. Tape un nom ci-dessus : un PNJ ou un objet existant, ou crée-le sur place.</p>
        ) : null}

        {pnjsIci.length ? <span className="eyebrow fdl-qq-groupe">PNJ · {pnjsIci.length}</span> : null}
        {pnjsIci.map((c) => {
          const cle = `pnj-${c.id}`
          const ouvert = deplie === cle
          const img = s.allItems.find((i) => i.id === c.portraitItemId)
          const tenus = objetsIci.filter((e) => e.x.port === 'pnj' && e.x.characterId === c.id)
          return (
            <Fragment key={c.id}>
              <div className={`fdl-rangee${ouvert ? ' ouvert' : ''}`} data-fdl={cle} onClick={() => onDeplier(ouvert ? null : cle)}>
                {img?.url ? <img className="fdl-rvig pnj" src={img.poster ?? img.url} alt="" /> : <span className="fdl-rvig pnj">{initiales(c.name)}</span>}
                <span className="fdl-rnom">
                  <b>{c.name}</b>
                  <span>{c.occupation ?? ''}</span>
                </span>
                {tenus.length ? <span className="fdl-compte">{tenus.length} objet{tenus.length > 1 ? 's' : ''}</span> : null}
              </div>
              {ouvert ? (
                <div className="fdl-detail">
                  {img?.url ? <img className="fdl-detail-image" src={img.url} alt={`Portrait : ${c.name}`} /> : null}
                  {c.notes ? <TexteCourt className="fdl-info">{c.notes}</TexteCourt> : <p className="fdl-vide">Rien de noté sur lui.</p>}
                  <div className="fdl-pied">
                    <button
                      className="btn btn-sm"
                      onClick={() => {
                        s.setCurrentCharacter(c.id)
                        s.setView('sheets')
                      }}
                    >
                      Ouvrir sa fiche ↗
                    </button>
                    {img ? (
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={async () => {
                          await window.jdr.display.showItem(img.id)
                          s.toast(`Portrait de ${c.name} à l’écran des joueurs`)
                        }}
                      >
                        <IconScreen />
                        Portrait à l’écran
                      </button>
                    ) : null}
                    <div className="spacer" />
                    <button
                      className="btn btn-sm btn-ghost btn-danger"
                      title="Sa fiche reste ; il ne fait plus partie de ce lieu"
                      onClick={async () => {
                        await window.jdr.fiche.retirerPnj(p.id, c.id)
                        onDeplier(null)
                        await relire()
                      }}
                    >
                      Retirer d’ici
                    </button>
                  </div>
                </div>
              ) : null}
              {tenus.map((e) => (
                <RangeeObjet key={e.x.id} e={e} p={p} enfant cartes={cartes} pnjsIci={pnjsIci} relire={relire} deplie={deplie} onDeplier={onDeplier} />
              ))}
            </Fragment>
          )
        })}

        {libres.length ? <span className="eyebrow fdl-qq-groupe">Objets posés · {libres.length}</span> : null}
        {surPlan && libres.length ? (
          <p className="fdl-vide">Glisse un objet sur le plan pour le poser à sa place dans {p.name}.</p>
        ) : null}
        {libres.map((e) => (
          <RangeeObjet
            key={e.x.id}
            e={e}
            p={p}
            cartes={cartes}
            pnjsIci={pnjsIci}
            relire={relire}
            deplie={deplie}
            onDeplier={onDeplier}
            surPlan={surPlan}
          />
        ))}
      </div>
    </section>
  )
}

function RangeeObjet({
  e: { o, x },
  p,
  enfant,
  cartes,
  pnjsIci,
  relire,
  deplie,
  onDeplier,
  surPlan = false
}: {
  e: Exemplaire
  p: Place
  /** Porté par un PNJ : rangé sous lui, en retrait. */
  enfant?: boolean
  cartes: LieuCarte[]
  pnjsIci: Character[]
  relire: () => Promise<void>
  deplie: string | null
  onDeplier: (cle: string | null) => void
  surPlan?: boolean
}): JSX.Element {
  const s = useStore()
  const differe = useDiffere()
  const cle = `objet-${o.id}`
  const ouvert = deplie === cle
  const img = s.allItems.find((i) => i.id === o.imageItemId)
  const f = s.objetFamilles.find((y) => y.id === o.familleId) ?? null
  const tenu = x.port === 'pnj'
  const [precision, setPrecision] = useState(x.precision ?? '')
  const [su, setSu] = useState(o.su)
  useEffect(() => setPrecision(x.precision ?? ''), [x.precision])
  useEffect(() => setSu(o.su), [o.su])
  const revele = cartes.find((c) => c.sorte === 'decouverte' && c.objetIds.includes(o.id))
  const sousNom = tenu
    ? 'sur lui'
    : [x.precision, x.pos ? 'sur le plan' : null].filter(Boolean).join(' · ') || 'endroit à préciser'
  const glissable = surPlan && !tenu

  const basculer = async (): Promise<void> => {
    const etat = x.etat === 'cache' ? 'trouve' : 'cache'
    await window.jdr.objets.placement(x.id, { etat })
    await suivreObjet(o.id, etat, cartes)
    await Promise.all([s.refreshObjets(), relire()])
  }

  return (
    <>
      <div
        className={`fdl-rangee${enfant ? ' enfant' : ''}${ouvert ? ' ouvert' : ''}${glissable ? ' glissable' : ''}`}
        data-fdl={cle}
        onClick={() => onDeplier(ouvert ? null : cle)}
        draggable={glissable}
        title={glissable ? (x.pos ? 'Glisse-le ailleurs sur le plan' : 'Glisse-le sur le plan') : undefined}
        onDragStart={(ev) => {
          if (!glissable) return
          ev.dataTransfer.setData(GLISSE_OBJET, String(x.id))
          ev.dataTransfer.effectAllowed = 'move'
        }}
      >
        {img?.url ? (
          <img className="fdl-rvig" src={img.poster ?? img.url} alt="" />
        ) : (
          <span className={`fdl-rvig c-${f?.teinte ?? 'neutral'}`}>{glypheObjet(f?.glyphe ?? 'outils', 'glyphe')}</span>
        )}
        <span className="fdl-rnom">
          <b>
            {o.nom}
            {x.qte > 1 ? <span className="num"> ×{x.qte}</span> : null}
          </b>
          <span>{sousNom}</span>
        </span>
        {tenu ? (
          <span className="fdl-etat porte">porté</span>
        ) : (
          <button
            className={`fdl-etat ${x.etat}`}
            title={x.etat === 'cache' ? 'Clic quand ils mettent la main dessus' : 'Clic pour le remettre à couvert'}
            onClick={(e) => {
              e.stopPropagation()
              void basculer()
            }}
          >
            {x.etat === 'cache' ? 'caché' : 'trouvé'}
          </button>
        )}
      </div>
      {ouvert ? (
        <div className={`fdl-detail${enfant ? ' enfant' : ''}`}>
          {img?.url ? <img className="fdl-detail-image" src={img.url} alt={o.nom} /> : null}
          <div className="fdl-ou">
            <span className="fdl-bascule petite">
              <button
                className={!tenu ? 'on' : ''}
                onClick={async () => {
                  if (!tenu) return
                  await window.jdr.objets.donner(x.id, { port: 'lieu', placeId: p.id })
                  await s.refreshObjets()
                }}
              >
                Endroit
              </button>
              <button
                className={tenu ? 'on' : ''}
                disabled={pnjsIci.length === 0}
                title={pnjsIci.length ? 'Un PNJ du lieu le détient' : 'Aucun PNJ dans ce lieu'}
                onClick={async () => {
                  if (tenu || !pnjsIci.length) return
                  await window.jdr.objets.donner(x.id, { port: 'pnj', characterId: pnjsIci[0].id })
                  await s.refreshObjets()
                }}
              >
                Détenu par
              </button>
            </span>
            {tenu ? (
              <select
                className="fdl-saisie"
                value={x.characterId ?? ''}
                aria-label="Qui le détient"
                onChange={async (e) => {
                  await window.jdr.objets.donner(x.id, { port: 'pnj', characterId: Number(e.target.value) })
                  await s.refreshObjets()
                }}
              >
                {pnjsIci.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="fdl-saisie"
                value={precision}
                placeholder="Endroit précis…"
                aria-label="Endroit précis"
                onChange={(e) => {
                  const v = e.target.value
                  setPrecision(v)
                  differe(`p-${x.id}`, async () => {
                    await window.jdr.objets.placement(x.id, { precision: v.trim() || null })
                    await s.refreshObjets()
                  })
                }}
              />
            )}
          </div>
          <span className="eyebrow">Ce qu’il est</span>
          <textarea
            className="fdl-saisie"
            value={su}
            placeholder="Ce qu’il est vraiment, ce qu’il apprend aux joueurs…"
            aria-label={`Ce qu’est ${o.nom}`}
            onChange={(e) => {
              const v = e.target.value
              setSu(v)
              differe(`su-${o.id}`, async () => {
                await window.jdr.objets.update(o.id, { su: v })
                await s.refreshObjets()
              })
            }}
          />
          <span className="fdl-partage">Le texte de l’objet : il change aussi dans la réserve et dans les autres lieux.</span>
          {revele ? (
            <span className="fdl-revele">
              <IconDecouverte /> Révélé par « {revele.titre} » — cocher l’un coche l’autre
            </span>
          ) : null}
          <div className="fdl-pied">
            {img ? (
              <button
                className="btn btn-sm"
                onClick={async () => {
                  await window.jdr.display.showItem(img.id)
                  s.toast(`« ${o.nom} » à l’écran des joueurs`)
                }}
              >
                <IconScreen />
                Montrer à l’écran
              </button>
            ) : null}
            {surPlan && x.pos ? (
              <button
                className="btn btn-sm btn-ghost"
                title="Il reste dans la pièce, sans point précis"
                onClick={async () => {
                  await window.jdr.objets.situer(x.id, null)
                  await s.refreshObjets()
                }}
              >
                Ôter du plan
              </button>
            ) : null}
            <div className="spacer" />
            <button
              className="btn btn-sm btn-ghost btn-danger"
              title="Il quitte le lieu et reste dans la réserve"
              onClick={async () => {
                await window.jdr.objets.reprendre(x.id)
                onDeplier(null)
                await s.refreshObjets()
              }}
            >
              Retirer d’ici
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}


/** Une pastille d'objet : sa vignette et son nom. */
function PuceObjet({
  o,
  onClick,
  retirer
}: {
  o: Objet
  onClick?: () => void
  retirer?: boolean
}): JSX.Element {
  const s = useStore()
  const img = s.allItems.find((i) => i.id === o.imageItemId)
  const f = s.objetFamilles.find((y) => y.id === o.familleId) ?? null
  return (
    <button
      className={`fdl-puce c-${f?.teinte ?? 'neutral'}`}
      onClick={onClick}
      title={retirer ? 'Retirer le lien' : o.nom}
    >
      {img?.url ? (
        <img src={img.poster ?? img.url} alt="" />
      ) : (
        <span className="rond">{glypheObjet(f?.glyphe ?? 'outils', 'glyphe')}</span>
      )}
      {o.nom}
      {retirer ? <span className="x">×</span> : null}
    </button>
  )
}

function PucePnj({
  c,
  onClick,
  retirer
}: {
  c: Character
  onClick?: () => void
  retirer?: boolean
}): JSX.Element {
  const s = useStore()
  const img = s.allItems.find((i) => i.id === c.portraitItemId)
  return (
    <button className="fdl-puce pnj" onClick={onClick} title={retirer ? 'Retirer le lien' : c.name}>
      {img?.url ? (
        <img src={img.poster ?? img.url} alt="" />
      ) : (
        <span className="rond">{initiales(c.name)}</span>
      )}
      {c.name}
      {retirer ? <span className="x">×</span> : null}
    </button>
  )
}

function CarteLue({
  c,
  deplie,
  pnjsSeance,
  onDeplier,
  onCocher,
  onModifier
}: {
  c: LieuCarte
  deplie: boolean
  pnjsSeance: Character[]
  onDeplier: () => void
  onCocher: (fait: boolean) => void
  /** Absent au Paravent : on y coche, on n'y écrit pas. */
  onModifier?: () => void
}): JSX.Element {
  const s = useStore()
  const objets = c.objetIds.map((id) => s.objets.find((o) => o.id === id)).filter((o): o is Objet => !!o)
  const pnjs = c.pnjIds
    .map((id) => pnjsSeance.find((x) => x.id === id))
    .filter((x): x is Character => !!x)
  const moment = c.beatId != null ? s.beats.find((b) => b.id === c.beatId) : null
  const ouvert = !c.fait || deplie

  return (
    <article className={`fdl-carte${c.fait ? ' fait' : ''}${deplie ? ' deplie' : ''}`}>
      <span className={`fdl-sorte ${c.sorte}`} title={c.sorte === 'decouverte' ? 'Découverte' : 'Déclencheur'}>
        {c.sorte === 'decouverte' ? <IconDecouverte /> : <IconEclair />}
      </span>
      <span className="fdl-titre">{c.titre}</span>
      <span className="fdl-actions">
        <label className="fdl-coche">
          <input type="checkbox" checked={c.fait} onChange={(e) => onCocher(e.target.checked)} />
          {c.sorte === 'decouverte' ? 'trouvée' : 'déclenché'}
        </label>
        {onModifier ? (
          <button className="fdl-icone" onClick={onModifier} title="Modifier" aria-label={`Modifier « ${c.titre} »`}>
            <IconPen />
          </button>
        ) : null}
      </span>
      {ouvert && (c.si || c.alors) ? (
        <dl className="fdl-si">
          <dt>SI</dt>
          <dd>{c.si || '—'}</dd>
          <dt>ALORS</dt>
          <dd>{c.alors || '—'}</dd>
        </dl>
      ) : null}
      {objets.length || pnjs.length || moment ? (
        <div className="fdl-liens">
          {objets.map((o) => (
            <PuceObjet key={o.id} o={o} onClick={() => eclairer(`objet-${o.id}`)} />
          ))}
          {pnjs.map((x) => (
            <PucePnj key={x.id} c={x} onClick={() => eclairer(`pnj-${x.id}`)} />
          ))}
          {moment ? (
            <button
              className="fdl-puce moment"
              title="Ouvrir ce moment dans la Chronologie"
              onClick={() => {
                s.setActiveBeat(moment.id)
                s.setView('timeline')
              }}
            >
              → moment « {moment.title} »
            </button>
          ) : null}
        </div>
      ) : null}
      {c.fait && (c.si || c.alors) ? (
        <button className="fdl-voir" onClick={onDeplier}>
          {deplie ? '▴ replier' : '▾ si / alors'}
        </button>
      ) : null}
    </article>
  )
}

/** Faire briller un objet ou un PNJ du lieu ; rend faux s'il n'est pas ici. */
function eclairer(cle: string): boolean {
  const el = document.querySelector<HTMLElement>(`[data-fdl="${cle}"]`)
  if (!el) return false
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  el.classList.remove('eclaire')
  void el.offsetWidth
  el.classList.add('eclaire')
  window.setTimeout(() => el.classList.remove('eclaire'), 1400)
  return true
}


interface Exemplaire {
  o: Objet
  x: ObjetPlacement
}


/* ============================================================
   Au Paravent : la fiche, simplifiée
   ============================================================ */

/** Une rubrique qui se replie ; son état reste d'une partie à l'autre. */
function Rubrique({
  cle,
  titre,
  compte,
  outils,
  children
}: {
  cle: string
  titre: string
  compte?: string
  outils?: React.ReactNode
  children: React.ReactNode
}): JSX.Element {
  const k = `paravent.lieu.replie.${cle}`
  const [replie, setReplie] = useState(() => {
    try {
      return localStorage.getItem(k) === '1'
    } catch {
      return false
    }
  })
  const basculer = (): void =>
    setReplie((v) => {
      try {
        localStorage.setItem(k, v ? '0' : '1')
      } catch {
        /* sans stockage, le repli ne dure que la visite */
      }
      return !v
    })
  return (
    <section className={`fdc-rubrique${replie ? ' replie' : ''}`}>
      <div className="fdc-tete">
        <button className="fdc-titre" onClick={basculer} aria-expanded={!replie}>
          <span className="fdc-fleche">▸</span>
          {titre}
          {compte ? <span className="fdl-compte">{compte}</span> : null}
        </button>
        <div className="spacer" />
        {replie ? null : outils}
      </div>
      {replie ? null : <div className="fdc-corps">{children}</div>}
    </section>
  )
}

/**
 * La fiche d'un lieu, pour jouer : on coche ce qui est trouvé ou déclenché, on
 * lit les scénarios, on voit qui est là et ce qu'il porte, on montre un objet
 * ou un portrait. On écrit dans Lieux.
 */
export function FicheCompacte({
  p,
  avant,
  apres,
  onMontrer,
  onChanger
}: {
  p: Place
  /** Ce qui vient avant les rubriques : ce que voient les joueurs. */
  avant?: React.ReactNode
  /** Ce qui vient après : les notes du MJ. */
  apres?: React.ReactNode
  onMontrer: (item: UiItem, titre: string, x: number, y: number) => void
  /** Passer à son niveau, ou à l'un des lieux qu'il tient. */
  onChanger: (id: number) => void
}): JSX.Element {
  const s = useStore()
  const [fiche, setFiche] = useState<Fiche | null>(null)
  const [deplies, setDeplies] = useState<Set<number>>(new Set())
  const [ouverts, setOuverts] = useState<Set<number>>(new Set())
  /* Le menu « Donner à… » d'un objet : dans le sac d'un joueur ou d'un PNJ. */
  const [donne, setDonne] = useState<{ x: number; y: number; p: ObjetPlacement } | null>(null)
  /* « Créer pion » : le PNJ rejoint la ligne des pions du Paravent et de la Régie. */
  const reserve = usePnjEnReserve()
  const [masquer, setMasquer] = useState(() => {
    try {
      return localStorage.getItem('fiche.masquerFaits') === '1'
    } catch {
      return false
    }
  })

  const relire = async (): Promise<void> => setFiche(await window.jdr.fiche.lire(p.id))
  useEffect(() => {
    setFiche(null)
    setDeplies(new Set())
    setOuverts(new Set())
    void relire()
    const h = (): void => void relire()
    window.addEventListener('jdr:defait', h)
    /* Ou le fichier du lieu, écrit hors de l'app. */
    const lache = window.jdr.fiche.onRelue(h)
    return () => {
      window.removeEventListener('jdr:defait', h)
      lache()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.id])

  const pnjsSeance = s.characters.filter((c) => c.kind === 'pnj')
  const pnjsIci = (fiche?.pnjIds ?? [])
    .map((id) => pnjsSeance.find((c) => c.id === id))
    .filter((c): c is Character => !!c)
  const ids = new Set(pnjsIci.map((c) => c.id))
  const objets: Exemplaire[] = s.objets.flatMap((o) =>
    o.placements
      .filter(
        (x) =>
          (x.port === 'lieu' && x.placeId === p.id) ||
          (x.port === 'pnj' && x.characterId != null && ids.has(x.characterId)) ||
          /* Trouvé ici puis donné : il reste sur la fiche, pour mémoire. */
          x.origineLieuId === p.id
      )
      .map((x) => ({ o, x }))
  )
  const cartes = fiche?.cartes ?? []
  const faites = cartes.filter((c) => c.fait).length
  const vues = cartes.filter((c) => !(masquer && c.fait))
  const premiereFaite = vues.findIndex((c) => c.fait)
  const caches = objets.filter((e) => e.x.port === 'lieu' && e.x.etat === 'cache').length

  const parent = s.places.find((q) => q.id === p.parentId) ?? null
  const enfants = s.places
    .filter((q) => q.parentId === p.id)
    .sort((a, b) => a.ord - b.ord || a.name.localeCompare(b.name))

  return (
    <div className="fdc">
      {parent || enfants.length ? (
        <nav className="fdc-voisins" aria-label="Lieux voisins">
          {parent ? (
            <button
              className="fdl-voisin haut"
              title={`${TIER_LABEL[parent.tier]} : ${parent.name}`}
              onClick={() => onChanger(parent.id)}
            >
              ↑ {parent.name}
            </button>
          ) : null}
          {enfants.map((q) => (
            <button key={q.id} className="fdl-voisin" onClick={() => onChanger(q.id)}>
              {q.name}
            </button>
          ))}
        </nav>
      ) : null}

      {/* Ce qu'on cherche en pleine partie : ce qu'il y a à prendre, et qui est là. */}
      {objets.length ? (
        <Rubrique
          cle="objets"
          titre="Objets"
          compte={caches ? `${caches} caché${caches > 1 ? 's' : ''}` : 'tout est trouvé'}
        >
          {objets.map(({ o, x }) => {
            const img = s.allItems.find((i) => i.id === o.imageItemId)
            const f = s.objetFamilles.find((y) => y.id === o.familleId) ?? null
            const porteur = x.port === 'pnj' ? pnjsIci.find((c) => c.id === x.characterId) : null
            /* Parti d'ici : on dit où il est maintenant. */
            const parti = x.origineLieuId === p.id && !(x.port === 'lieu' && x.placeId === p.id)
            return (
              <div key={x.id} className={`fdc-ligne${parti ? ' parti' : ''}`} data-fdl={`objet-${o.id}`}>
                {img?.url ? (
                  <button
                    className="fdc-vig"
                    title="Montrer à l’écran"
                    onClick={(e) => onMontrer(img, o.nom, e.clientX, e.clientY)}
                  >
                    <img src={img.poster ?? img.url} alt="" />
                  </button>
                ) : (
                  <span className={`fdc-vig vide c-${f?.teinte ?? 'neutral'}`}>
                    {glypheObjet(f?.glyphe ?? 'outils', 'glyphe')}
                  </span>
                )}
                <div className="fdc-t">
                  <b>
                    {o.nom}
                    {x.qte > 1 ? <span className="num"> ×{x.qte}</span> : null}
                  </b>
                  <span className="fdc-sous">
                    {parti
                      ? `${x.port === 'lieu' || x.port === 'inventaire' ? 'rangé à' : 'pris par'} ${x.cible}${x.precision ? ` · trouvé ${x.precision}` : ''}`
                      : porteur
                        ? `détenu par ${porteur.name}`
                        : (x.precision ?? 'quelque part ici')}
                  </span>
                  {o.su ? (
                    <TexteCourt className="fdc-info" lignes={1}>
                      {o.su}
                    </TexteCourt>
                  ) : null}
                </div>
                {x.port === 'lieu' && !parti ? (
                  <button
                    className={`fdl-etat ${x.etat}`}
                    title={
                      x.etat === 'cache'
                        ? 'Clic quand ils mettent la main dessus'
                        : 'Clic pour le remettre à couvert'
                    }
                    onClick={async () => {
                      const etat = x.etat === 'cache' ? 'trouve' : 'cache'
                      await window.jdr.objets.placement(x.id, { etat })
                      /* La découverte qui le révèle se coche avec lui. */
                      await suivreObjet(o.id, etat, cartes)
                      await Promise.all([s.refreshObjets(), relire()])
                    }}
                  >
                    {x.etat === 'cache' ? 'caché' : 'trouvé'}
                  </button>
                ) : parti ? (
                  <span className="fdl-etat porte">pris</span>
                ) : (
                  <span className="fdl-etat porte">porté</span>
                )}
                <button
                  className="fdc-donner"
                  title={`Mettre ${o.nom} dans le sac de quelqu’un`}
                  aria-label={`Donner ${o.nom}`}
                  onClick={(e) => {
                    const r = e.currentTarget.getBoundingClientRect()
                    setDonne({ x: r.left - 200, y: r.top, p: x })
                  }}
                >
                  <IconDonner />
                </button>
              </div>
            )
          })}
        </Rubrique>
      ) : null}

      {pnjsIci.length ? (
        <Rubrique cle="pnj" titre="PNJ" compte={String(pnjsIci.length)}>
          {pnjsIci.map((c) => {
            const img = s.allItems.find((i) => i.id === c.portraitItemId)
            const detenus = s.objets.filter((o) =>
              o.placements.some((x) => x.port === 'pnj' && x.characterId === c.id)
            )
            return (
              <div key={c.id} className="fdc-ligne" data-fdl={`pnj-${c.id}`}>
                {img?.url ? (
                  <button
                    className="fdc-vig pnj"
                    title="Montrer son portrait"
                    onClick={(e) => onMontrer(img, c.name, e.clientX, e.clientY)}
                  >
                    <img src={img.poster ?? img.url} alt="" />
                  </button>
                ) : (
                  <span className="fdc-vig pnj vide">{initiales(c.name)}</span>
                )}
                <div className="fdc-t">
                  <b>{c.name}</b>
                  {c.occupation ? <span className="fdc-sous">{c.occupation}</span> : null}
                  {c.notes ? (
                    <TexteCourt className="fdc-info" lignes={1}>
                      {c.notes}
                    </TexteCourt>
                  ) : null}
                  {detenus.length ? (
                    <div className="fdl-liens">
                      {detenus.map((o) => (
                        <PuceObjet key={o.id} o={o} onClick={() => eclairer(`objet-${o.id}`)} />
                      ))}
                    </div>
                  ) : null}
                </div>
                {reserve.ids.has(c.id) ? (
                  <button
                    className="fdc-pion on"
                    title="Déjà sur la ligne des pions — clic pour l’en retirer"
                    onClick={() => reserve.retirer(c.id)}
                  >
                    ✓ Pion
                  </button>
                ) : (
                  <button
                    className="fdc-pion"
                    title="L’ajouter à la ligne des pions, prêt à poser"
                    onClick={() => reserve.ajouter(c.id)}
                  >
                    Créer pion
                  </button>
                )}
              </div>
            )
          })}
        </Rubrique>
      ) : null}

      {avant}

      <Rubrique
        cle="cartes"
        titre="Découvertes et déclencheurs"
        compte={cartes.length ? `${cartes.length - faites} à venir` : undefined}
        outils={
          faites ? (
            <button
              className="fdl-masquer"
              aria-pressed={masquer}
              onClick={() =>
                setMasquer((v) => {
                  try {
                    localStorage.setItem('fiche.masquerFaits', v ? '0' : '1')
                  } catch {
                    /* sans stockage, le choix ne dure que la visite */
                  }
                  return !v
                })
              }
            >
              Masquer les faits ({faites})
            </button>
          ) : null
        }
      >
        {fiche && cartes.length === 0 ? (
          <p className="fdl-vide">Rien de prévu ici — ça s’écrit dans la fiche du lieu.</p>
        ) : null}
        {cartes.length > 0 && vues.length === 0 ? (
          <p className="fdl-vide">Tout a été trouvé ou déclenché.</p>
        ) : null}
        {vues.map((c, k) => (
          <div key={c.id} className="fdl-cartes-ligne">
            {k === premiereFaite ? (
              <div className="fdl-groupe eyebrow">Trouvées et déclenchés · {faites}</div>
            ) : null}
            <CarteLue
              c={c}
              deplie={deplies.has(c.id)}
              pnjsSeance={pnjsSeance}
              onDeplier={() =>
                setDeplies((d) => {
                  const n = new Set(d)
                  n.has(c.id) ? n.delete(c.id) : n.add(c.id)
                  return n
                })
              }
              onCocher={async (fait) => {
                await cocherEtSuivre(c, fait, p.id, s.objets)
                await Promise.all([relire(), s.refreshObjets()])
              }}
            />
          </div>
        ))}
      </Rubrique>

      {fiche?.scenarios.length ? (
        <Rubrique cle="scenarios" titre="Scénarios" compte={String(fiche.scenarios.length)}>
          {fiche.scenarios.map((sc, i) => {
            const ouvert = ouverts.has(sc.id)
            return (
              <button
                key={sc.id}
                className={`fdc-scen${ouvert ? ' ouvert' : ''}`}
                aria-expanded={ouvert}
                onClick={() =>
                  setOuverts((o) => {
                    const n = new Set(o)
                    n.has(sc.id) ? n.delete(sc.id) : n.add(sc.id)
                    return n
                  })
                }
              >
                <span className="fdl-num num">{i + 1}</span>
                <span className="fdc-scen-t">
                  <b>{sc.titre || 'Sans titre'}</b>
                  {sc.info ? <span className="fdc-scen-info">{sc.info}</span> : null}
                </span>
              </button>
            )
          })}
        </Rubrique>
      ) : null}

      {apres}

      {donne ? (
        <MenuDonner
          x={donne.x}
          y={donne.y}
          p={donne.p}
          onClose={() => setDonne(null)}
          onFait={() => s.refreshObjets()}
        />
      ) : null}
    </div>
  )
}
