/** Les vignettes d'assets d'une étape, rangées par catégorie. */
import type { AssetAtelier } from '@shared/atelierAssets'
import { urlAsset } from './images'

export function Palette({
  assets,
  choisi,
  onChoisir,
  parCategorie = false
}: {
  assets: AssetAtelier[]
  choisi: string | null
  onChoisir: (a: AssetAtelier) => void
  parCategorie?: boolean
}): JSX.Element {
  if (!assets.length) return <p className="at-vide">Aucun asset de ce type pour l’instant.</p>
  const groupes = parCategorie
    ? [...new Set(assets.map((a) => a.categorie))].map((cat) => ({
        cat,
        liste: assets.filter((a) => a.categorie === cat)
      }))
    : [{ cat: '', liste: assets }]
  return (
    <>
      {groupes.map((g) => (
        <div key={g.cat} className="at-section">
          {g.cat ? <span className="eyebrow">{g.cat}</span> : null}
          <div className="at-tuiles">
            {g.liste.map((a) => (
              <button
                key={a.id}
                className="at-tuile"
                aria-pressed={choisi === a.id}
                title={a.nom}
                onClick={() => onChoisir(a)}
              >
                <img src={urlAsset(a)} alt="" loading="lazy" />
                {a.nom}
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}
