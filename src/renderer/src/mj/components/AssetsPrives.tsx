/**
 * « Voir les assets privés de … », depuis le mode développeur.
 *
 * On demande d'abord si l'on est bien la personne : ces assets sont cachés
 * pour ne rien gâcher d'une séance à venir. Non, la fenêtre se ferme ; oui,
 * on les montre, rangés comme dans l'atelier.
 */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { AssetAtelier } from '@shared/atelierAssets'
import { useEchap } from '../echap'
import { urlAsset } from '../atelier/images'

const TYPES: Record<string, string> = {
  objet: 'Objets',
  mur: 'Murs',
  sol: 'Sols',
  porte: 'Portes',
  vitre: 'Fenêtres'
}

export function AssetsPrives({ nom, onClose }: { nom: string; onClose: () => void }): JSX.Element {
  const [confirme, setConfirme] = useState(false)
  const [assets, setAssets] = useState<AssetAtelier[] | null>(null)
  useEchap(onClose)

  useEffect(() => {
    if (!confirme) return
    window.jdr.atelier.assetsPrives(nom).then(setAssets, () => setAssets([]))
  }, [confirme, nom])

  /* Par type, puis par famille et rayon : comme on les retrouvera dans l'atelier. */
  const groupes = new Map<string, AssetAtelier[]>()
  for (const a of assets ?? []) {
    const titre = `${TYPES[a.type] ?? a.type} · ${a.categorie}${a.sousCategorie ? ` › ${a.sousCategorie}` : ''}`
    if (!groupes.has(titre)) groupes.set(titre, [])
    groupes.get(titre)!.push(a)
  }

  return createPortal(
    <div className="scrim" onClick={onClose}>
      <div
        className={`modal assets-prives${confirme ? ' large' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="assets-prives-titre"
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <h3 id="assets-prives-titre">
            Assets privés de {nom}
            {assets ? ` · ${assets.length}` : ''}
          </h3>
          {confirme ? (
            <button className="btn btn-sm btn-ghost" style={{ marginLeft: 'auto' }} onClick={onClose}>
              Fermer
            </button>
          ) : null}
        </header>
        {!confirme ? (
          <>
            <div className="body">
              <p>
                Vous allez voir les assets privés de <b>{nom}</b>. Êtes-vous bien {nom} ?
              </p>
            </div>
            <footer>
              <span className="spacer" />
              <button className="btn btn-sm" onClick={onClose}>
                Non
              </button>
              <button className="btn btn-sm btn-brass" autoFocus onClick={() => setConfirme(true)}>
                Oui, je suis {nom}
              </button>
            </footer>
          </>
        ) : (
          <div className="body">
            {assets === null ? (
              <p className="expli">Chargement…</p>
            ) : assets.length ? (
              [...groupes].map(([titre, liste]) => (
                <section key={titre} className="ap-groupe">
                  <span className="eyebrow">
                    {titre} · {liste.length}
                  </span>
                  <div className="ap-grille">
                    {liste.map((a) => (
                      <figure key={a.id} className="ap-asset" title={a.nom}>
                        <img src={urlAsset(a)} alt="" loading="lazy" />
                        <figcaption>{a.nom}</figcaption>
                      </figure>
                    ))}
                  </div>
                </section>
              ))
            ) : (
              <p className="expli">{nom} n’a aucun asset privé.</p>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
