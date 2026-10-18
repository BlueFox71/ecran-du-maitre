import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useStore } from '../store'
import type { TraitsMj } from '../../shared/Slide'
import { useEchap } from '../echap'

/** Les traits de la carte, au départ : les lampes comme avant, le reste tu. */
const TRAITS_NEUFS: TraitsMj = {
  lampes: true,
  pieces: false,
  astre: false,
  portes: true,
  fenetres: false,
  murs: false,
  sons: true,
  objets: true
}
const CLE = 'paravent.traits'

/*
 * Ce que la scène du MJ montre de son calque — une habitude du poste.
 *
 * Partagé à toute la fenêtre : le bouton vit sous le moniteur, visible de
 * partout, et c'est la scène du Paravent qui lit les cases.
 */
let traitsCourants: TraitsMj = ((): TraitsMj => {
  try {
    const v = localStorage.getItem(CLE)
    return v ? { ...TRAITS_NEUFS, ...(JSON.parse(v) as Partial<TraitsMj>) } : TRAITS_NEUFS
  } catch {
    return TRAITS_NEUFS
  }
})()
const abonnes = new Set<() => void>()
function poserTraits(patch: Partial<TraitsMj>): void {
  traitsCourants = { ...traitsCourants, ...patch }
  try {
    localStorage.setItem(CLE, JSON.stringify(traitsCourants))
  } catch {
    /* sans mémoire, le choix vaut pour la séance */
  }
  abonnes.forEach((f) => f())
}
const sAbonner = (f: () => void): (() => void) => {
  abonnes.add(f)
  return () => abonnes.delete(f)
}

export function useTraitsMj(): [TraitsMj, (patch: Partial<TraitsMj>) => void] {
  const t = useSyncExternalStore(sAbonner, () => traitsCourants)
  return [t, poserTraits]
}

/**
 * « Affichage » : toutes les cases de ce qui se montre, en un seul endroit.
 *
 * En haut, l'écran des joueurs — l'encart, les noms et les PV sous les pions.
 * En bas, la carte telle que le MJ la voit sur sa scène : ces traits-là ne
 * partent jamais chez les joueurs (les lampes gardent leur œil, une à une).
 */
export function BoutonAffichage({ className = '' }: { className?: string }): JSX.Element {
  const display = useStore((s) => s.display)
  const [traits, onTraits] = useTraitsMj()
  /* Ouvert : où poser la fenêtre, sous le bouton. Elle est fixe, pour passer
     par-dessus tout ce qui rogne ce qui déborde de lui. */
  const [ouvert, setOuvert] = useState<{ gauche: number; haut: number } | null>(null)
  const zone = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ouvert) return
    const dehors = (e: MouseEvent): void => {
      if (zone.current && !zone.current.contains(e.target as Node)) setOuvert(null)
    }
    window.addEventListener('mousedown', dehors)
    return () => window.removeEventListener('mousedown', dehors)
  }, [ouvert])
  useEchap(() => setOuvert(null), !!ouvert)

  const encartOn = display?.encart.on ?? false
  const carte: [keyof TraitsMj, string, string][] = [
    ['lampes', 'Éclairage', 'L’icône de chaque lampe, allumée ou éteinte'],
    ['pieces', 'Nom des pièces', 'Le nom de chaque pièce, écrit sur le plan'],
    ['astre', 'Soleil / lune', 'D’où vient la lumière du dehors, au bord du plan'],
    ['portes', 'Portes', 'Rouges fermées, vertes ouvertes, en tirets verrouillées'],
    ['fenetres', 'Fenêtres', 'Les vitres posées sur les murs'],
    ['murs', 'Murs', 'Les traits qui arrêtent le regard ; les rideaux en pointillé'],
    ['sons', 'Sons', 'Les sons posés sur le plan : armés, joués, ou qui attendent ton feu vert'],
    ['objets', 'Objets', 'Les objets posés sur le plan : pleins trouvés, creux encore cachés']
  ]

  return (
    <div className="aff" ref={zone}>
      <button
        className={`btn btn-sm ${className}${ouvert ? ' btn-on' : ''}`}
        aria-expanded={!!ouvert}
        onClick={(e) => {
          if (ouvert) return setOuvert(null)
          const r = e.currentTarget.getBoundingClientRect()
          /* Sous le bouton, calée sur son bord droit : il est au bout de la barre. */
          setOuvert({ gauche: Math.max(8, Math.min(r.left, r.right - 270)), haut: r.bottom + 6 })
        }}
        title="Affichage : ce qui se montre sur l’écran des joueurs, et sur ta carte"
      >
        Affichage ▾
      </button>
      {ouvert ? (
        <div
          className="aff-pop"
          role="dialog"
          aria-label="Affichage"
          style={{ left: ouvert.gauche, top: ouvert.haut }}
        >
          <section>
            <span className="eyebrow">Écran des joueurs</span>
            {/* Ce que la table voit d'une carte qui a des murs. */}
            <div className="aff-vision" role="radiogroup" aria-label="Ce qu’ils voient de la carte">
              {(
                [
                  ['regards', 'Leurs regards', 'Ils ne voient que ce que leurs personnages ont sous les yeux : l’ombre couvre le reste'],
                  ['jour', 'Plein jour', 'Toute la carte, sans ombre — les murs retiennent toujours le pas']
                ] as const
              ).map(([v, nom, aide]) => (
                <label key={v} className="coche" title={aide}>
                  <input
                    type="radio"
                    name="aff-vision"
                    checked={(display?.vision ?? 'regards') === v}
                    onChange={() => void window.jdr.display.vision(v)}
                  />
                  <span>{nom}</span>
                </label>
              ))}
            </div>
            <label className="coche">
              <input
                type="checkbox"
                checked={encartOn}
                onChange={(e) => void window.jdr.display.encart({ on: e.target.checked })}
              />
              <span>Encart joueurs</span>
            </label>
            <label className={`coche aff-sous${encartOn ? '' : ' eteint'}`}>
              <input
                type="checkbox"
                checked={display?.encart.sm ?? false}
                disabled={!encartOn}
                onChange={(e) => void window.jdr.display.encart({ sm: e.target.checked })}
              />
              <span>Santé mentale dans l’encart</span>
            </label>
            <label className="coche">
              <input
                type="checkbox"
                checked={display?.pionLabels ?? true}
                onChange={(e) => void window.jdr.display.pionLabels(e.target.checked)}
              />
              <span>Noms sous les pions</span>
            </label>
            <label className="coche">
              <input
                type="checkbox"
                checked={display?.pionPv ?? false}
                onChange={(e) => void window.jdr.display.pionPv(e.target.checked)}
              />
              <span>PV sous les pions</span>
            </label>
          </section>
          <section>
            <span className="eyebrow">Ma carte · jamais chez eux</span>
            {carte.map(([k, nom, aide]) => (
              <label key={k} className="coche" title={aide}>
                <input type="checkbox" checked={traits[k]} onChange={(e) => onTraits({ [k]: e.target.checked })} />
                <span className={`aff-pastille ${k}`} aria-hidden="true" />
                <span>{nom}</span>
              </label>
            ))}
          </section>
        </div>
      ) : null}
    </div>
  )
}
