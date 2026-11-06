/**
 * Regarder un document en grand, sur le poste du MJ seulement : une image
 * tenue entière dans la fenêtre, une vidéo avec ses commandes, un PDF dans le
 * lecteur de Chromium. Rien ne part vers l'écran des joueurs ni vers les
 * téléphones.
 *
 * Échap, la croix ou un clic à côté referment.
 */
import { useEchap } from '../echap'
import { IconClose, kindIcon } from './Icons'
import type { ItemKind } from '@shared/types'

export function Visionneuse({
  titre,
  kind,
  url,
  onClose
}: {
  titre: string
  kind: ItemKind
  url: string | null
  onClose: () => void
}): JSX.Element {
  useEchap(onClose)
  return (
    <div className="scrim visionneuse" onClick={onClose}>
      <div className="vis-cadre" onClick={(e) => e.stopPropagation()}>
        <header className="vis-tete">
          {kindIcon(kind, 'ico')}
          <span className="vis-titre" title={titre}>
            {titre}
          </span>
          {/* Un vrai bouton, avec son mot : la petite croix pâle d'avant ne se
              voyait pas, et on cherchait comment sortir de l'aperçu. */}
          <button className="btn btn-sm vis-fermer" onClick={onClose} title="Fermer — Échap">
            <IconClose />
            Fermer
          </button>
        </header>
        <div className="vis-corps">
          {!url ? (
            <p className="vis-rien">Ce fichier est introuvable sur le disque.</p>
          ) : kind === 'image' ? (
            <img src={url} alt={titre} />
          ) : kind === 'video' ? (
            <video src={url} controls autoPlay />
          ) : kind === 'pdf' ? (
            <iframe title={titre} src={url} />
          ) : (
            <p className="vis-rien">Ce genre de fichier ne se regarde pas ici.</p>
          )}
        </div>
      </div>
    </div>
  )
}
