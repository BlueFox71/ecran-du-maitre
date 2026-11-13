/**
 * Les vignettes d'assets d'une étape.
 *
 * Rangées (`parCategorie`) : une recherche par nom, une rangée de catégories,
 * puis une rangée de sous-catégories — « Tout » en tête de chacune. Le choix
 * est retenu le temps de la session, d'une étape à l'autre.
 */
import { useState } from 'react'
import { filtrerAssets, rangement, type AssetAtelier } from '@shared/atelierAssets'
import { urlAsset } from './images'

/** Le rangement choisi, retenu tant que l'application est ouverte. */
const memoire = { categorie: null as string | null, sous: null as string | null, recherche: '' }

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
  parCategorie = false
}: {
  assets: AssetAtelier[]
  choisi: string | null
  /** Plusieurs vignettes cochées à la fois (le mode aléatoire de la Déco). */
  choisis?: string[]
  onChoisir: (a: AssetAtelier) => void
  parCategorie?: boolean
}): JSX.Element {
  const [categorie, setCategorieE] = useState<string | null>(memoire.categorie)
  const [sous, setSousE] = useState<string | null>(memoire.sous)
  const [recherche, setRechercheE] = useState(memoire.recherche)
  const setCategorie = (v: string | null): void => {
    memoire.categorie = v
    memoire.sous = null
    setCategorieE(v)
    setSousE(null)
  }
  const setSous = (v: string | null): void => {
    memoire.sous = v
    setSousE(v)
  }
  const setRecherche = (v: string): void => {
    memoire.recherche = v
    setRechercheE(v)
  }

  if (!assets.length) return <p className="at-vide">Aucun asset de ce type pour l’instant.</p>
  const estChoisi = (a: AssetAtelier): boolean => (choisis ? choisis.includes(a.id) : choisi === a.id)
  if (!parCategorie) return <Tuiles liste={assets} estChoisi={estChoisi} onChoisir={onChoisir} />

  const rayons = rangement(assets)
  /* Une catégorie retenue qui n'existe plus (un import retiré) : on revient à tout. */
  const cat = rayons.some((r) => r.categorie === categorie) ? categorie : null
  const sousCats = rayons.find((r) => r.categorie === cat)?.sous ?? []
  const sc = sous && sousCats.includes(sous) ? sous : null
  const liste = filtrerAssets(assets, { categorie: cat, sous: sc, recherche })

  /* Tout montrer d'un bloc serait long : sans filtre, on titre par catégorie ;
     dans une catégorie, par sous-catégorie. */
  const groupes: { titre: string; liste: AssetAtelier[] }[] = recherche.trim()
    ? [{ titre: '', liste }]
    : !cat
      ? rayons.map((r) => ({ titre: r.categorie, liste: liste.filter((a) => a.categorie === r.categorie) }))
      : !sc && sousCats.length
        ? [
            ...sousCats.map((s) => ({ titre: s, liste: liste.filter((a) => a.sousCategorie === s) })),
            { titre: '', liste: liste.filter((a) => !a.sousCategorie) }
          ]
        : [{ titre: '', liste }]

  return (
    <div className="at-rangement">
      <input
        className="at-champ at-recherche"
        type="search"
        placeholder="Chercher un objet…"
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
      />
      <div className="at-filtres" role="group" aria-label="Catégories">
        <button className="at-filtre" aria-pressed={!cat} onClick={() => setCategorie(null)}>
          Tout
        </button>
        {rayons.map((r) => (
          <button
            key={r.categorie}
            className="at-filtre"
            aria-pressed={cat === r.categorie}
            onClick={() => setCategorie(r.categorie)}
          >
            {r.categorie}
          </button>
        ))}
      </div>
      {cat && sousCats.length ? (
        <div className="at-filtres at-sous" role="group" aria-label="Sous-catégories">
          <button className="at-filtre" aria-pressed={!sc} onClick={() => setSous(null)}>
            Tout
          </button>
          {sousCats.map((s) => (
            <button key={s} className="at-filtre" aria-pressed={sc === s} onClick={() => setSous(s)}>
              {s}
            </button>
          ))}
        </div>
      ) : null}
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
    </div>
  )
}
