/**
 * La galerie des images de la campagne, ouverte depuis les outils du Paravent.
 *
 * On y cherche une image par son nom, ou par le dossier qui la range : taper
 * « manoir » trouve aussi bien « Manoir — rez-de-chaussée » que tout ce qui
 * dort dans « Cartes/Manoir ». Plusieurs mots se cumulent, sans accents ni
 * majuscules qui comptent.
 *
 * Un clic sur une image referme la galerie et rend la main au Paravent, qui
 * demande où l'envoyer — visuel libre, direct ou fenêtre — comme partout.
 */
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store'
import { useEchap } from '../echap'
import { IconClose, IconImage, IconSearch } from './Icons'
import type { UiItem } from '../../../../preload/index'

function sansAccents(t: string): string {
  return t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('fr-FR')
}

/** Le dossier d'un fichier, tel qu'on le lit : « Cartes / Manoir », ou rien à la racine. */
function dossierDe(i: UiItem): string {
  if (!i.relPath || !i.relPath.includes('/')) return ''
  return i.relPath.slice(0, i.relPath.lastIndexOf('/')).split('/').join(' / ')
}

export function Galerie({
  onChoisir,
  onClose
}: {
  /** L'image choisie, et l'endroit du clic : le menu d'envoi s'ouvre là. */
  onChoisir: (item: UiItem, x: number, y: number) => void
  onClose: () => void
}): JSX.Element {
  const s = useStore()
  useEchap(onClose)
  const [cherche, setCherche] = useState('')

  const images = useMemo(
    () =>
      s.fichiers
        .filter((i) => i.kind === 'image')
        .map((i) => ({ i, dossier: dossierDe(i), cle: sansAccents(`${i.title} ${dossierDe(i)}`) }))
        .sort(
          (a, b) =>
            a.dossier.localeCompare(b.dossier, 'fr') || a.i.title.localeCompare(b.i.title, 'fr')
        ),
    [s.fichiers]
  )

  const mots = sansAccents(cherche).split(/\s+/).filter(Boolean)
  const trouvees = mots.length ? images.filter((x) => mots.every((m) => x.cle.includes(m))) : images

  return createPortal(
    <div className="scrim" onClick={onClose}>
      <div className="modal galerie-fen" onClick={(e) => e.stopPropagation()}>
        <header>
          <IconImage />
          <h3>Images</h3>
          <span className="eyebrow num">
            {mots.length ? `${trouvees.length} / ${images.length}` : images.length}
          </span>
          <button className="btn btn-sm btn-ghost galerie-fermer" onClick={onClose} title="Fermer — Échap" aria-label="Fermer">
            <IconClose />
          </button>
        </header>
        <label className="galerie-cherche">
          <IconSearch />
          <input
            autoFocus
            type="search"
            value={cherche}
            onChange={(e) => setCherche(e.target.value)}
            placeholder="Chercher par nom d’image ou par dossier…"
          />
        </label>
        <div className="galerie-grille">
          {trouvees.length ? (
            trouvees.map(({ i, dossier }) => (
              <button
                key={i.id}
                className="galerie-vig"
                onClick={(e) => onChoisir(i, e.clientX, e.clientY)}
                title={`${i.title}${dossier ? `\n${dossier}` : ''}\nClic : visuel libre, direct ou fenêtre`}
              >
                <span className="galerie-img">
                  {i.poster || i.url ? (
                    <img src={i.poster ?? i.url!} alt="" loading="lazy" draggable={false} />
                  ) : (
                    <IconImage className="ico" />
                  )}
                </span>
                <span className="nm">{i.title}</span>
                {dossier ? (
                  /* Le dossier se lit sous le nom ; un clic dessus le cherche. */
                  <span
                    className="galerie-dossier"
                    role="button"
                    title={`${dossier}
Clic : ne montrer que ce dossier`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setCherche(dossier.split(' / ').pop() ?? dossier)
                    }}
                  >
                    {/* Le dernier dossier suffit à reconnaître ; le chemin entier est au survol. */}
                    {dossier.split(' / ').pop()}
                  </span>
                ) : null}
              </button>
            ))
          ) : (
            <p className="galerie-rien">
              {images.length ? 'Aucune image ne correspond.' : 'Cette campagne n’a pas encore d’image.'}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
