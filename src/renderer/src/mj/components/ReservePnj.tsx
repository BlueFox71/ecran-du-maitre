/**
 * Les PNJ de la réserve de pions.
 *
 * Une séance peut compter vingt PNJ : les mettre tous sur la ligne des pions
 * la noyait. La ligne ne montre plus d'office que les joueurs ; le MJ y ajoute
 * les PNJ dont il a besoin par le +, et les en retire d'une croix. La liste
 * vit dans les réglages de la campagne, par séance (`pions.pnj.<id>`), si
 * bien que Régie et Paravent montrent la même.
 */
import { useEffect, useMemo } from 'react'
import { useStore } from '../store'
import { IconClose, IconPeople } from './Icons'
import type { Character } from '@shared/types'
import { useEchap } from '../echap'

const cle = (sessionId: number): string => `pions.pnj.${sessionId}`

export function usePnjEnReserve(): {
  ids: Set<number>
  ajouter: (id: number) => void
  retirer: (id: number) => void
} {
  const sessionId = useStore((s) => s.session?.id ?? null)
  const brut = useStore((s) => s.reglagesBrut)
  const poser = useStore((s) => s.poserReglage)
  const liste = useMemo((): number[] => {
    if (sessionId === null) return []
    try {
      const lu = JSON.parse(brut[cle(sessionId)] ?? '[]')
      return Array.isArray(lu) ? lu.filter((x): x is number => typeof x === 'number') : []
    } catch {
      return []
    }
  }, [brut, sessionId])
  const ecrire = (l: number[]): void => {
    if (sessionId !== null) void poser(cle(sessionId), JSON.stringify(l))
  }
  return {
    ids: useMemo(() => new Set(liste), [liste]),
    ajouter: (id) => ecrire(liste.includes(id) ? liste : [...liste, id]),
    retirer: (id) => ecrire(liste.filter((x) => x !== id))
  }
}

/** La croix qui retire un PNJ de la ligne des pions — pas de la table. */
export function RetirerDeLaReserve({ c, onRetirer }: { c: Character; onRetirer: () => void }): JSX.Element {
  return (
    <button
      type="button"
      className="tray-retirer"
      title={`Retirer ${c.name} de la ligne des pions`}
      aria-label={`Retirer ${c.name} de la ligne des pions`}
      onClick={(e) => {
        e.stopPropagation()
        onRetirer()
      }}
    >
      <IconClose />
    </button>
  )
}

/**
 * Le choix des PNJ : leurs visages, ceux du moment en cours d'abord. Un clic
 * ajoute, un second retire ; la fenêtre reste ouverte pour en prendre
 * plusieurs. Plus de pion sans fiche : un PNJ a toujours la sienne.
 */
export function ChoixPnj({
  enScene,
  onClose
}: {
  enScene: Set<number>
  onClose: () => void
}): JSX.Element {
  const s = useStore()
  const { ids, ajouter, retirer } = usePnjEnReserve()
  const pnjs = useMemo(
    () =>
      s.characters
        .filter((c) => c.kind === 'pnj')
        .sort((a, b) => Number(enScene.has(b.id)) - Number(enScene.has(a.id)) || a.name.localeCompare(b.name)),
    [s.characters, enScene]
  )

  useEchap(onClose)

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal choix-pnj" onClick={(e) => e.stopPropagation()}>
        <header>
          <IconPeople />
          <h3>PNJ sur la ligne des pions</h3>
          <div className="spacer" />
          <button className="btn btn-sm btn-ghost" onClick={onClose} aria-label="Fermer" title="Fermer · Échap">
            <IconClose />
          </button>
        </header>
        <div className="body">
          {pnjs.length === 0 ? (
            <p className="expli">Aucun PNJ dans cette séance.</p>
          ) : (
            <div className="choix-pnj-grille">
              {pnjs.map((c) => {
                const pris = ids.has(c.id)
                const photo = s.allItems.find((i) => i.id === c.portraitItemId)
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`choix-pnj-carte${pris ? ' on' : ''}`}
                    aria-pressed={pris}
                    title={pris ? `Retirer ${c.name} de la ligne` : `Ajouter ${c.name} à la ligne`}
                    onClick={() => (pris ? retirer(c.id) : ajouter(c.id))}
                  >
                    <span className={`choix-pnj-visage teinte c-${c.color ?? 'neutral'}`}>
                      {photo?.url ? <img src={photo.url} alt="" draggable={false} /> : c.name.slice(0, 2)}
                    </span>
                    <span className="choix-pnj-nom">{c.name}</span>
                    <span className="choix-pnj-sous">
                      {enScene.has(c.id) ? 'dans ce moment' : (c.occupation ?? '')}
                    </span>
                    {pris ? <span className="choix-pnj-coche">✓</span> : null}
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <footer className="choix-pnj-pied">
          <div className="spacer" />
          <button className="btn btn-sm" onClick={onClose}>
            Terminé
          </button>
        </footer>
      </div>
    </div>
  )
}
