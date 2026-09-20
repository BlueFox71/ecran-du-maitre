import { useStore } from '../store'
import { Pastille } from './Pastille'

/**
 * L'identité du poste, au pied du rail : les gens autour de la table, la
 * campagne ouverte, la séance en cours.
 *
 * C'était un menu ; c'est devenu une plaque. Les gestes — changer de
 * campagne, changer de séance, ouvrir le carnet — sont montés dans la barre
 * de menus, en haut à gauche, là où tous les logiciels les mettent. Il
 * restait ici deux chemins vers la même chose, et le pied du rail n'était pas
 * le bon : on le regarde pour savoir où l'on en est, pas pour agir.
 */
export function Ident(): JSX.Element {
  const s = useStore()
  const seance = s.session

  return (
    <div className="ident plaque">
      <div className="ident-gens" title="Les joueurs de cette campagne — menu Campagne pour les inscrire">
        <span className="seats">
          {s.players.slice(0, 8).map((p) => (
            <Pastille key={p.id} nom={p.name} couleur={p.color} />
          ))}
        </span>
        <span className="lbl">
          {s.players.length === 0
            ? 'aucun joueur'
            : `${s.players.length} joueur${s.players.length > 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Le système de la campagne et la date de la séance se lisaient ici ;
          ils encombraient pour rien. Le nom suffit à dire où l'on en est, et
          le reste se retrouve dans les fiches, d'un geste. */}
      <div className="ident-ligne">
        <span className="eyebrow">Campagne</span>
        <span className="val">{s.campaign?.name ?? '…'}</span>
      </div>

      <div className="ident-ligne">
        <span className="eyebrow">Séance</span>
        <span className="val">{seance?.label ?? '…'}</span>
      </div>
    </div>
  )
}

/* ---------------- dates ---------------- */

/** « 2026-09-12 » se lit « 12 sept. » — une date de table, pas une donnée. */
export function enCourt(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
