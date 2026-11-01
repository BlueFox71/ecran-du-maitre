/**
 * Le clic droit sur le plan : poser ici l'objet d'un joueur.
 *
 * Le chemin long — ouvrir le détail du pion, armer « poser », cliquer sur le
 * plan — reste là ; celui-ci part de l'endroit. On vise d'abord, on choisit
 * ensuite : les objets des personnages présents, rangés par personnage.
 */
import { useStore } from '../store'
import { Pop } from './Pop'
import { IconClose, glypheObjet } from './Icons'
import type { Objet, ObjetPlacement } from '@shared/types'

export function MenuPoserIci({
  x,
  y,
  onPoser,
  onClose
}: {
  /** Où ouvrir le menu, à l'écran. */
  x: number
  y: number
  /** L'exemplaire choisi : à poser au point visé. */
  onPoser: (placementId: number) => void
  onClose: () => void
}): JSX.Element {
  const s = useStore()
  const pjs = s.characters.filter((c) => c.kind !== 'pnj' && c.present && !c.horsJeu)
  const porte = (characterId: number): { o: Objet; p: ObjetPlacement }[] =>
    s.objets.flatMap((o) =>
      o.placements.filter((p) => p.port === 'pj' && p.characterId === characterId).map((p) => ({ o, p }))
    )
  const groupes = pjs.map((c) => ({ c, objets: porte(c.id) })).filter((g) => g.objets.length)

  return (
    <Pop x={x} y={y} className="menu-donner" onClose={onClose}>
      <button className="md-fermer" onClick={onClose} title="Fermer sans rien poser — Échap" aria-label="Fermer">
        <IconClose />
      </button>
      <span className="eyebrow">Poser ici</span>
      {groupes.length === 0 ? (
        <p className="pop-rien">Les joueurs présents n’ont rien sur eux.</p>
      ) : (
        groupes.map(({ c, objets }, i) => (
          <div key={c.id}>
            {i ? <hr /> : null}
            <span className={`mp-qui c-${c.color ?? 'neutral'}`}>
              <span className="pip" />
              {c.name}
            </span>
            {objets.map(({ o, p }) => {
              const f = s.objetFamilles.find((y) => y.id === o.familleId) ?? null
              return (
                <button
                  key={p.id}
                  className={`opt c-${f?.teinte ?? 'neutral'}`}
                  title={`${c.name} pose ${o.nom} ici — les joueurs le voient`}
                  onClick={() => {
                    onClose()
                    onPoser(p.id)
                  }}
                >
                  <span className="gl">{glypheObjet(f?.glyphe ?? 'outils', 'glyphe')}</span>
                  {o.nom}
                  {p.qte > 1 ? <span className="det">×{p.qte}</span> : null}
                </button>
              )
            })}
          </div>
        ))
      )}
    </Pop>
  )
}
