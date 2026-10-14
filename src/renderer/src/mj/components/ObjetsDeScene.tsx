/**
 * Les objets de la scène : ce qui traîne dans le lieu qu'on joue.
 *
 * On a préparé la clé dans le tiroir du bureau ; en partie, on ne va pas la
 * chercher dans **Objets** ni dans **Lieux**. Elle est là, à gauche de l'image,
 * à la place du tableau de scène — l'un ou l'autre, jamais les deux : la
 * colonne n'a pas la largeur de deux listes.
 *
 * Trois gestes, ceux de la table : la **montrer** (son image, sur un visuel ou
 * en fenêtre sur le direct), dire que les joueurs l'ont **trouvée**, la
 * **donner** à quelqu'un. On y lit le lieu affiché et ses pièces — un étage
 * découpé range ses objets dans les pièces, pas sur le palier.
 */
import { useState } from 'react'
import { itemById, useStore } from '../store'
import { IconCoffre, IconDonner, IconEye, glypheObjet } from './Icons'
import { MenuDonner } from './MenuDonner'
import { AlerteLieux, lieuxDe } from './ObjetsDuLieu'
import type { Surbrillance } from './Tableau'
import type { Objet, ObjetPlacement, Place } from '@shared/types'
import type { UiItem } from '../../../../preload/index'

interface Ici {
  o: Objet
  p: ObjetPlacement
}

/** Le lieu affiché, puis ses pièces : là où l'on cherche les objets. */
function lieuxDeScene(places: Place[], placeId: number | null): Place[] {
  if (placeId == null) return []
  const lui = places.find((p) => p.id === placeId)
  return [...(lui ? [lui] : []), ...places.filter((p) => p.parentId === placeId)]
}

function posesDans(objets: Objet[], placeId: number): Ici[] {
  return objets.flatMap((o) =>
    o.placements.filter((p) => p.port === 'lieu' && p.placeId === placeId).map((p) => ({ o, p }))
  )
}

/** Combien d'objets posés dans la scène — le chiffre du bouton. */
export function compteObjetsDeScene(objets: Objet[], places: Place[], placeId: number | null): number {
  return lieuxDeScene(places, placeId).reduce((n, l) => n + posesDans(objets, l.id).length, 0)
}

/** Ce que la colonne de gauche montre : la scène, les objets, ou rien. */
export type PanneauScene = 'scene' | 'objets' | null

/**
 * La colonne de gauche, retenue d'une ouverture à l'autre — un confort de
 * poste, pas un réglage de campagne. Rappuyer sur le bouton allumé la ferme ;
 * appuyer sur l'autre remplace l'une par l'autre.
 */
export function usePanneauScene(
  cle: string,
  defaut: () => PanneauScene
): [PanneauScene, (quoi: 'scene' | 'objets') => void] {
  const [panneau, setPanneau] = useState<PanneauScene>(() => {
    try {
      const v = localStorage.getItem(cle)
      if (v === 'scene' || v === 'objets') return v
      if (v === 'rien') return null
    } catch {
      /* sans stockage, on part du défaut */
    }
    return defaut()
  })
  const basculer = (quoi: 'scene' | 'objets'): void =>
    setPanneau((v) => {
      const suite = v === quoi ? null : quoi
      try {
        localStorage.setItem(cle, suite ?? 'rien')
      } catch {
        /* sans stockage, le choix ne dure que la séance */
      }
      return suite
    })
  return [panneau, basculer]
}

/** Le bouton de la barre, avec le nombre d'objets posés dans la scène. */
export function BoutonObjets({
  on,
  placeId,
  onClick
}: {
  on: boolean
  placeId: number | null
  onClick: () => void
}): JSX.Element {
  const s = useStore()
  const n = compteObjetsDeScene(s.objets, s.places, placeId)
  return (
    <button
      className={`btn btn-sm${on ? ' btn-on' : ''}`}
      onClick={onClick}
      aria-pressed={on}
      title={
        n === 0
          ? 'Les objets posés dans ce lieu — il n’y en a aucun'
          : on
            ? 'Cacher les objets : l’image reprend toute la largeur'
            : `Montrer les ${n > 1 ? `${n} objets posés` : 'objet posé'} dans ce lieu, à gauche de l’image`
      }
    >
      <IconCoffre />
      Objets
      {n ? <span className="os-badge num">{n}</span> : null}
    </button>
  )
}

export function ObjetsDeScene({
  placeId,
  onMontrer,
  onSurvol
}: {
  placeId: number | null
  /** Ouvre le menu d'image du module, au curseur. */
  onMontrer: (it: UiItem, titre: string, x: number, y: number) => void
  onSurvol?: (s: Surbrillance) => void
}): JSX.Element {
  const s = useStore()
  const [donne, setDonne] = useState<{ x: number; y: number; p: ObjetPlacement } | null>(null)

  const salles = lieuxDeScene(s.places, placeId)
    .map((l) => ({ l, ici: posesDans(s.objets, l.id) }))
    .filter((x) => x.ici.length)
  const total = salles.reduce((n, x) => n + x.ici.length, 0)
  const caches = salles.reduce((n, x) => n + x.ici.filter((y) => y.p.etat === 'cache').length, 0)

  const relire = (): Promise<void> => s.refreshObjets()

  return (
    <aside className="tableau objets-scene" onMouseLeave={() => onSurvol?.(null)}>
      <header className="tb-tete">
        <span className="eyebrow">Les objets</span>
        {total ? (
          <span className="tb-compte">
            {caches === 0
              ? 'tout est découvert'
              : `${caches} / ${total} pas encore découvert${caches > 1 ? 's' : ''}`}
          </span>
        ) : null}
      </header>

      <div className="tb-salles">
        {placeId == null ? (
          <p className="os-vide">Aucun lieu à l’écran.</p>
        ) : salles.length === 0 ? (
          <p className="os-vide">
            Rien n’est posé ici. On range un objet dans un lieu depuis sa fiche, dans
            «&nbsp;Lieux&nbsp;» ou «&nbsp;Objets&nbsp;».
          </p>
        ) : (
          salles.map(({ l, ici }) => (
            <section
              key={l.id}
              className="tb-salle"
              onMouseEnter={() =>
                onSurvol?.(l.id !== placeId && l.zone ? { quoi: 'piece', pts: l.zone } : null)
              }
            >
              <div className="tb-salle-tete">
                <b>{l.name}</b>
              </div>
              {ici.map(({ o, p }) => {
                const f = s.objetFamilles.find((y) => y.id === o.familleId) ?? null
                const image = itemById(s.allItems, o.imageItemId)
                return (
                  <div key={p.id} className={`tb-ligne os-ligne c-${f?.teinte ?? 'neutral'}`}>
                    <span className="os-g">{glypheObjet(f?.glyphe ?? 'outils', 'glyphe')}</span>
                    <span className="tb-nom" title={p.precision ?? undefined}>
                      <span className="os-nm">{o.nom}</span>
                      {p.qte > 1 ? <em className="num">×{p.qte}</em> : null}
                      <AlerteLieux lieux={lieuxDe(o, l.id)} />
                    </span>
                    <button
                      className={`ou-etat ${p.etat}`}
                      title={
                        p.etat === 'cache'
                          ? 'Les joueurs ne l’ont pas trouvé — clic quand ils mettent la main dessus'
                          : 'Ils savent qu’il est là — clic pour le remettre à couvert'
                      }
                      onClick={async () => {
                        await window.jdr.objets.placement(p.id, {
                          etat: p.etat === 'cache' ? 'trouve' : 'cache'
                        })
                        await relire()
                      }}
                    >
                      {p.etat === 'cache' ? 'caché' : 'trouvé'}
                    </button>
                    <button
                      className="tb-oeil"
                      disabled={!image}
                      title={
                        image
                          ? `Montrer ${o.nom} aux joueurs`
                          : 'Pas d’image pour cet objet — ajoute-en une dans sa fiche'
                      }
                      aria-label={`Montrer ${o.nom}`}
                      onClick={(e) => {
                        if (!image) return
                        e.stopPropagation()
                        onMontrer(image, o.nom, e.clientX, e.clientY)
                      }}
                    >
                      <IconEye />
                    </button>
                    <button
                      className="tb-oeil"
                      title={`Donner ${o.nom} à quelqu’un — il quitte ${l.name}`}
                      aria-label={`Donner ${o.nom}`}
                      onClick={(e) => {
                        const r = e.currentTarget.getBoundingClientRect()
                        setDonne({ x: r.right + 6, y: r.top, p })
                      }}
                    >
                      <IconDonner />
                    </button>
                  </div>
                )
              })}
            </section>
          ))
        )}
      </div>

      {donne ? (
        <MenuDonner
          x={donne.x}
          y={donne.y}
          p={donne.p}
          onClose={() => setDonne(null)}
          onFait={relire}
        />
      ) : null}
    </aside>
  )
}
