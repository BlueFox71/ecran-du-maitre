import { Visage } from './Visage'
import type { TourVu } from '@shared/types'

/**
 * « Au tour de … » en haut de l'image, pendant les tours.
 *
 * Celui qui joue, et celui qui suit : c'est ce que la table se demande. Un
 * participant caché n'a ni nom ni visage — « quelqu'un d'autre » —, et il
 * n'est pas compté non plus : `TourVu` ne le contient pas.
 */
export function BandeauTour({ tour }: { tour: TourVu }): JSX.Element | null {
  const n = tour.ordre.length
  if (!n && !tour.actifCache) return null
  const enJeu = tour.actifCache ? null : tour.ordre[tour.curseur]
  /* Caché, celui qui joue n'est pas dans l'ordre : le curseur montre déjà le suivant. */
  const ensuite = n ? tour.ordre[tour.actifCache ? tour.curseur : (tour.curseur + 1) % n] : null
  return (
    <div className="pv-tour" key={`${tour.round}-${tour.curseur}-${tour.actifCache}`}>
      {enJeu ? (
        <span className={`pv-tour-rond c-${enJeu.color}`}>
          {enJeu.url ? <Visage url={enJeu.url} cadre={enJeu.cadre} /> : enJeu.initials}
        </span>
      ) : (
        <span className="pv-tour-rond inconnu">?</span>
      )}
      <span className="pv-tour-qui">
        <span className="pv-tour-nom">Au tour de {enJeu ? enJeu.nom : 'quelqu’un d’autre'}</span>
        {ensuite && ensuite !== enJeu ? (
          <span className="pv-tour-ensuite">ensuite : {ensuite.nom}</span>
        ) : null}
      </span>
      <span className="pv-tour-round">Round {tour.round}</span>
    </div>
  )
}
