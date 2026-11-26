/**
 * Les carnets des chasseurs, vus du Paravent (onglet Portables) : pour chaque
 * indice et chaque entité, qui l'a entouré et qui l'a barré. Le MJ regarde
 * seulement — savoir si la table est sur la bonne piste, sans rien y écrire.
 *
 * Les pastilles ont la forme de celles du téléphone, mais pleines : ici rien
 * n'est « à moi », chaque marque compte autant.
 */
import { useEffect, useState } from 'react'
import type { CarnetVu, ElementCarnet } from '@shared/carnetChasse'

export function CarnetsJoueurs(): JSX.Element | null {
  const [carnet, setCarnet] = useState<CarnetVu | null>(null)
  useEffect(() => {
    let vivant = true
    const relire = (): void =>
      void window.jdr.carnetChasse.etat().then((c) => {
        if (vivant) setCarnet(c)
      })
    relire()
    const fin = window.jdr.carnetChasse.onChange(relire)
    return () => {
      vivant = false
      fin()
    }
  }, [])

  if (!carnet || !carnet.elements.length) return null

  const ligne = (el: ElementCarnet): JSX.Element => {
    const marques = carnet.marques.filter((m) => m.elementId === el.id)
    return (
      <li key={el.id} className={`cj-ligne${marques.length ? '' : ' vide'}`}>
        <span className="cj-nom">{el.nom}</span>
        <span className="cj-qui">
          {marques.map((m) => {
            const j = carnet.joueurs.find((p) => p.characterId === m.characterId)
            return (
              <span
                key={m.characterId}
                className={`cj-pastille c-${j?.color ?? 'neutral'} ${m.etat}`}
                title={`${j?.nom ?? '?'} : ${m.etat === 'entoure' ? 'entouré' : 'barré'}`}
              >
                {j?.initiales ?? '?'}
              </span>
            )
          })}
        </span>
      </li>
    )
  }

  const indices = carnet.elements.filter((e) => e.genre === 'indice')
  const entites = carnet.elements.filter((e) => e.genre === 'entite')
  return (
    <div className="cj">
      <div className="pt-titre">
        <span className="eyebrow">Carnets</span>
        <span className="pt-cpt">
          {carnet.marques.length ? `${carnet.marques.length} marques` : 'rien de marqué'}
        </span>
      </div>
      {indices.length ? (
        <>
          <span className="cj-genre">Indices</span>
          <ul className="cj-liste">{indices.map(ligne)}</ul>
        </>
      ) : null}
      {entites.length ? (
        <>
          <span className="cj-genre">Entités</span>
          <ul className="cj-liste">{entites.map(ligne)}</ul>
        </>
      ) : null}
    </div>
  )
}
