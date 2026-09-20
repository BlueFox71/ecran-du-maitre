/**
 * Ce qu'on trouve dans un lieu.
 *
 * On prépare une pièce dans **Lieux** ; y mettre une clé demandait jusqu'ici
 * d'aller dans **Objets** et de désigner la pièce — à l'envers de la façon dont
 * on prépare une séance. Le bloc s'ouvre donc là où l'on est déjà.
 *
 * Trois gestes, et rien d'autre : poser un objet ici, dire que les joueurs
 * l'ont trouvé, le faire passer dans les mains de quelqu'un. Le détail de
 * l'objet — ce qu'il est, ce qu'il fait — reste dans la réserve : cette liste
 * ne décrit pas, elle range.
 *
 * **Rien ici ne part vers les joueurs** : comme les annotations et les murs, ce
 * qu'une pièce cache est une antisèche du MJ.
 */
import { useState } from 'react'
import { useStore } from '../store'
import { IconClose, IconDonner, IconPlus, glypheObjet } from './Icons'
import { Pop } from './Pop'
import { MenuDonner } from './MenuDonner'
import type { Objet, ObjetPlacement } from '@shared/types'

interface Ici {
  o: Objet
  p: ObjetPlacement
}

export function ObjetsDuLieu({ placeId }: { placeId: number }): JSX.Element {
  const s = useStore()
  const [poser, setPoser] = useState<{ x: number; y: number } | null>(null)
  const [donne, setDonne] = useState<{ x: number; y: number; p: ObjetPlacement } | null>(null)

  const ici: Ici[] = s.objets.flatMap((o) =>
    o.placements.filter((p) => p.port === 'lieu' && p.placeId === placeId).map((p) => ({ o, p }))
  )
  const caches = ici.filter((x) => x.p.etat === 'cache').length

  const relire = (): Promise<void> => s.refreshObjets()

  return (
    <div className="objets-lieu">
      <div className="ol-tete">
        <span className="eyebrow">Ce qu’on y trouve</span>
        <div className="spacer" />
        {ici.length ? (
          <span className="ol-compte">
            {caches === 0
              ? 'tout est découvert'
              : `${caches} pas encore ${caches > 1 ? 'découverts' : 'découvert'}`}
          </span>
        ) : null}
      </div>

      {ici.length === 0 ? (
        <p className="ol-vide">Rien n’y est posé.</p>
      ) : (
        <div className="ol-liste">
          {ici.map((x) => {
            const f = s.objetFamilles.find((y) => y.id === x.o.familleId) ?? null
            return (
              <div className={`ol-ligne c-${f?.teinte ?? 'neutral'}`} key={x.p.id}>
                <span className="g">{glypheObjet(f?.glyphe ?? 'outils', 'glyphe')}</span>
                <span className="nm" title={x.p.precision ?? undefined}>
                  {x.o.nom}
                  {x.p.precision ? <em> — {x.p.precision}</em> : null}
                </span>
                {x.p.qte > 1 ? <span className="q num">×{x.p.qte}</span> : <span />}
                <button
                  className={`ou-etat ${x.p.etat}`}
                  title={
                    x.p.etat === 'cache'
                      ? 'Les joueurs ne l’ont pas trouvé — clic quand ils mettent la main dessus'
                      : 'Ils savent qu’il est là — clic pour le remettre à couvert'
                  }
                  onClick={async () => {
                    await window.jdr.objets.placement(x.p.id, {
                      etat: x.p.etat === 'cache' ? 'trouve' : 'cache'
                    })
                    await relire()
                  }}
                >
                  {x.p.etat === 'cache' ? 'pas découvert' : 'sur place'}
                </button>
                <button
                  className="ol-donner"
                  title={`Donner ${x.o.nom} à quelqu’un`}
                  aria-label={`Donner ${x.o.nom}`}
                  onClick={(e) => {
                    const r = e.currentTarget.getBoundingClientRect()
                    setDonne({ x: r.left - 200, y: r.top, p: x.p })
                  }}
                >
                  <IconDonner />
                </button>
                <button
                  className="ol-retire"
                  title="Le reprendre d’ici — il reste en réserve"
                  aria-label={`Reprendre ${x.o.nom}`}
                  onClick={async () => {
                    await window.jdr.objets.reprendre(x.p.id)
                    await relire()
                  }}
                >
                  <IconClose />
                </button>
              </div>
            )
          })}
        </div>
      )}

      <button
        className="ol-poser"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          setPoser({ x: r.left, y: r.bottom + 6 })
        }}
      >
        <IconPlus />
        Poser un objet ici
      </button>

      {poser ? (
        <Pop x={poser.x} y={poser.y} className="menu-donner" onClose={() => setPoser(null)}>
          <span className="eyebrow">Poser ici</span>
          {s.objets.length === 0 ? (
            <p className="pop-rien">
              La réserve est vide — décris tes objets dans «&nbsp;Objets&nbsp;», tu les poseras
              ensuite.
            </p>
          ) : (
            s.objets.map((o) => {
              const f = s.objetFamilles.find((y) => y.id === o.familleId) ?? null
              return (
                <button
                  key={o.id}
                  className={`opt c-${f?.teinte ?? 'neutral'}`}
                  onClick={async () => {
                    setPoser(null)
                    await window.jdr.objets.poser({ objetId: o.id, port: 'lieu', placeId })
                    await relire()
                  }}
                >
                  <span className="gl">{glypheObjet(f?.glyphe ?? 'outils', 'glyphe')}</span>
                  {o.nom}
                  {!o.unique ? <span className="det">×{o.qte}</span> : null}
                </button>
              )
            })
          )}
        </Pop>
      ) : null}

      {donne ? (
        <MenuDonner
          x={donne.x}
          y={donne.y}
          p={donne.p}
          onClose={() => setDonne(null)}
          onFait={relire}
        />
      ) : null}
    </div>
  )
}
