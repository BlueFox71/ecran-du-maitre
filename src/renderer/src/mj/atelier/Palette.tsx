/**
 * Les vignettes d'assets d'une étape.
 *
 * Rangées (`parCategorie`) : une rangée d'icônes pour les catégories, une
 * rangée d'icônes plus petites pour les sous-catégories de celle qui est
 * ouverte, et une loupe pour chercher par nom. Le choix est retenu le temps de
 * la session, d'une étape à l'autre.
 *
 * L'icône d'un rayon est une image du pack (`icones/<nom>.png`) ; tant qu'elle
 * n'existe pas, on montre la vignette d'un objet du rayon.
 */
import { useState, useSyncExternalStore } from 'react'
import { filtrerAssets, rangement, type AssetAtelier } from '@shared/atelierAssets'
import { urlAsset } from './images'

/** Le rangement choisi, retenu tant que l'application est ouverte — un par palette (sols, objets…). */
type Memoire = { categorie: string | null; sous: string | null; recherche: string; chercher: boolean }
const memoires = new Map<string, Memoire>()
const ecoutes = new Set<() => void>()
const memoireDe = (cle: string): Memoire => {
  let m = memoires.get(cle)
  if (!m) memoires.set(cle, (m = { categorie: null, sous: null, recherche: '', chercher: false }))
  return m
}
/* Un rangement partagé : les filtres et la grille d'une même palette peuvent
   vivre à deux endroits du panneau (les filtres figés, la grille qui défile). */
function useRangement(cle: string): [Memoire, (patch: Partial<Memoire>) => void] {
  const m = useSyncExternalStore(
    (f) => {
      ecoutes.add(f)
      return () => ecoutes.delete(f)
    },
    () => memoireDe(cle)
  )
  const changer = (patch: Partial<Memoire>): void => {
    memoires.set(cle, { ...memoireDe(cle), ...patch })
    for (const f of ecoutes) f()
  }
  return [m, changer]
}

/** Le nom de fichier de l'icône d'un rayon : « Toiles d'araignées » → `toiles-d-araignees`. */
export function slug(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** L'icône d'un rayon : son image dédiée, sinon celle d'un objet qui y est rangé. */
function IconeRayon({ nom, repli }: { nom: string; repli: AssetAtelier | undefined }): JSX.Element {
  const [manque, setManque] = useState(false)
  if (!manque) return <img src={`jdr://atelier/pack/icones/${slug(nom)}.png`} alt="" onError={() => setManque(true)} />
  return repli ? <img src={urlAsset(repli)} alt="" /> : <span className="at-icone-vide" />
}

/** « Tout » : quatre petits carrés. */
const IconeTout = (): JSX.Element => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="4" y="4" width="7" height="7" rx="1.5" />
    <rect x="13" y="4" width="7" height="7" rx="1.5" />
    <rect x="4" y="13" width="7" height="7" rx="1.5" />
    <rect x="13" y="13" width="7" height="7" rx="1.5" />
  </svg>
)

const IconeLoupe = (): JSX.Element => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="10.5" cy="10.5" r="6" fill="none" strokeWidth="2.2" />
    <path d="M15 15l5 5" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
)

function Tuiles({
  liste,
  estChoisi,
  onChoisir
}: {
  liste: AssetAtelier[]
  estChoisi: (a: AssetAtelier) => boolean
  onChoisir: (a: AssetAtelier) => void
}): JSX.Element {
  return (
    <div className="at-tuiles">
      {liste.map((a) => (
        <button
          key={a.id}
          className="at-tuile"
          aria-pressed={estChoisi(a)}
          title={a.sousCategorie ? `${a.nom} · ${a.categorie} › ${a.sousCategorie}` : a.nom}
          onClick={() => onChoisir(a)}
        >
          <img src={urlAsset(a)} alt="" loading="lazy" />
          {a.nom}
        </button>
      ))}
    </div>
  )
}

export function Palette({
  assets,
  choisi,
  choisis,
  onChoisir,
  parCategorie = false,
  cle = 'objets',
  partie = 'tout'
}: {
  assets: AssetAtelier[]
  choisi: string | null
  /** Plusieurs vignettes cochées à la fois (le mode aléatoire de la Déco). */
  choisis?: string[]
  onChoisir: (a: AssetAtelier) => void
  parCategorie?: boolean
  /** La palette dont on retient le rangement : deux palettes ne se mélangent pas. */
  cle?: string
  /** Ce qu'on affiche ici : tout, seulement les filtres, ou seulement la grille. */
  partie?: 'tout' | 'filtres' | 'tuiles'
}): JSX.Element {
  const [{ categorie, sous, recherche, chercher }, changer] = useRangement(cle)
  const setCategorie = (v: string | null): void => changer({ categorie: v, sous: null })
  const setSous = (v: string | null): void => changer({ sous: v })
  const setRecherche = (v: string): void => changer({ recherche: v })
  const setChercher = (v: boolean): void => changer({ chercher: v, ...(v ? {} : { recherche: '' }) })

  if (!assets.length) return <p className="at-vide">Aucun asset de ce type pour l’instant.</p>
  const estChoisi = (a: AssetAtelier): boolean => (choisis ? choisis.includes(a.id) : choisi === a.id)
  if (!parCategorie) return <Tuiles liste={assets} estChoisi={estChoisi} onChoisir={onChoisir} />

  const rayons = rangement(assets)
  /* Un rayon retenu qui n'existe plus (un import retiré) : on revient à tout. */
  const cat = rayons.some((r) => r.categorie === categorie) ? categorie : null
  const sousCats = rayons.find((r) => r.categorie === cat)?.sous ?? []
  const sc = sous && sousCats.includes(sous) ? sous : null
  const liste = filtrerAssets(assets, { categorie: cat, sous: sc, recherche: chercher ? recherche : '' })
  const repliCat = (c: string): AssetAtelier | undefined => assets.find((a) => a.categorie === c)
  const repliSous = (c: string, s: string): AssetAtelier | undefined =>
    assets.find((a) => a.categorie === c && a.sousCategorie === s)

  /* Sans filtre, on titre par catégorie ; dans une catégorie, par sous-catégorie. */
  const groupes: { titre: string; liste: AssetAtelier[] }[] =
    chercher && recherche.trim()
      ? [{ titre: '', liste }]
      : !cat
        ? rayons.map((r) => ({ titre: r.categorie, liste: liste.filter((a) => a.categorie === r.categorie) }))
        : !sc && sousCats.length
          ? [
              ...sousCats.map((s) => ({ titre: s, liste: liste.filter((a) => a.sousCategorie === s) })),
              { titre: '', liste: liste.filter((a) => !a.sousCategorie) }
            ]
          : [{ titre: '', liste }]

  const filtres = (
    <>
      <div className="at-icones" role="group" aria-label="Catégories">
        <button className="at-icone" aria-pressed={!cat} title="Tout" onClick={() => setCategorie(null)}>
          <IconeTout />
          <span>Tout</span>
        </button>
        {rayons.map((r) => (
          <button
            key={r.categorie}
            className="at-icone"
            aria-pressed={cat === r.categorie}
            title={r.categorie}
            onClick={() => setCategorie(r.categorie)}
          >
            <IconeRayon nom={r.categorie} repli={repliCat(r.categorie)} />
            <span>{r.categorie}</span>
          </button>
        ))}
        <button className="at-icone" aria-pressed={chercher} title="Chercher par nom" onClick={() => setChercher(!chercher)}>
          <IconeLoupe />
          <span>Chercher</span>
        </button>
      </div>
      {chercher ? (
        <input
          className="at-champ at-recherche"
          type="search"
          autoFocus
          placeholder="Chercher un objet…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
      ) : null}
      {cat && sousCats.length ? (
        <div className="at-icones at-sous" role="group" aria-label="Sous-catégories">
          <button className="at-icone" aria-pressed={!sc} title={`Tout ${cat}`} onClick={() => setSous(null)}>
            <IconeTout />
            <span>Tout</span>
          </button>
          {sousCats.map((s) => (
            <button key={s} className="at-icone" aria-pressed={sc === s} title={s} onClick={() => setSous(s)}>
              <IconeRayon nom={s} repli={repliSous(cat, s)} />
              <span>{s}</span>
            </button>
          ))}
        </div>
      ) : null}
    </>
  )
  const grille = (
    <>
      {liste.length ? (
        groupes
          .filter((g) => g.liste.length)
          .map((g, i) => (
            <div key={g.titre || i} className="at-section">
              {g.titre ? <span className="eyebrow">{g.titre}</span> : null}
              <Tuiles liste={g.liste} estChoisi={estChoisi} onChoisir={onChoisir} />
            </div>
          ))
      ) : (
        <p className="at-vide">Rien ne correspond.</p>
      )}
    </>
  )
  if (partie === 'filtres') return <div className="at-rangement">{filtres}</div>
  if (partie === 'tuiles') return <div className="at-rangement">{grille}</div>
  return (
    <div className="at-rangement">
      {filtres}
      {grille}
    </div>
  )
}
