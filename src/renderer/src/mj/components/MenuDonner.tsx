/**
 * « Donner à… » — faire passer un exemplaire d'une main à l'autre.
 *
 * Le geste de la table : ils fouillent la commode, ils trouvent la clé, Marie
 * la prend. Le même menu sert dans les trois endroits où un exemplaire
 * s'affiche — la fiche de l'objet, la fiche du lieu, le sac d'un personnage —
 * parce que c'est le même geste vu de trois côtés.
 *
 * Là où il se trouve déjà ne figure pas dans la liste : on ne donne pas une
 * chose à celui qui l'a.
 *
 * Un exemplaire qui en compte plusieurs demande ensuite combien : on donne
 * deux bougies sur six, les quatre autres restent où elles sont.
 */
import { useState } from 'react'
import { useStore } from '../store'
import { Pop } from './Pop'
import { IconClose, IconDonner } from './Icons'
import type { ObjetPlacement } from '@shared/types'
import { refusSac } from '@shared/sac'

export function MenuDonner({
  x,
  y,
  p,
  onClose,
  onFait
}: {
  x: number
  y: number
  p: ObjetPlacement
  onClose: () => void
  /** Appelé après le transfert : à l'appelant de relire la réserve. */
  onFait: () => void | Promise<void>
}): JSX.Element {
  const s = useStore()
  const pnjs = s.characters.filter((c) => c.kind === 'pnj' && c.id !== p.characterId)
  const pjs = s.characters.filter((c) => c.kind !== 'pnj' && c.present && c.id !== p.characterId)
  const lieux = s.places.filter((l) => l.id !== p.placeId)

  /* L'endroit choisi, en attendant de savoir combien en donner. */
  type Vers =
    | { quoi: 'donner'; cible: Parameters<typeof window.jdr.objets.donner>[1]; nom: string }
    | { quoi: 'ranger'; inventaireId: number; nom: string }
  const [vers, setVers] = useState<Vers | null>(null)
  const [combien, setCombien] = useState(p.qte)
  const choisir = (v: Vers): void => {
    if (p.qte <= 1) {
      if (v.quoi === 'donner') void donnerVraiment(v.cible)
      else void ranger(v.inventaireId)
      return
    }
    setCombien(p.qte)
    setVers(v)
  }

  const donnerVraiment = async (
    cible: Parameters<typeof window.jdr.objets.donner>[1],
    qte?: number
  ): Promise<void> => {
    onClose()
    /* Un transfert qui échoue sans rien dire est le pire des ratés : le MJ
       croit l'objet passé de main en main, et il n'a pas bougé. */
    try {
      await window.jdr.objets.donner(p.id, cible, qte)
    } catch (e) {
      s.toast(refusSac(e) ?? 'L’objet n’a pas changé de mains.', true)
      console.error('[donner]', e)
      return
    }
    await onFait()
  }

  /* Le camion, la malle : un inventaire partagé est un endroit de plus où
     ranger un exemplaire. */
  const inventaires = s.inventaires.filter((i) => i.id !== p.inventaireId)
  const ranger = async (inventaireId: number, qte?: number): Promise<void> => {
    onClose()
    try {
      await window.jdr.objets.remettre(p.id, inventaireId, qte)
    } catch (e) {
      s.toast(refusSac(e) ?? 'L’objet n’a pas été rangé.', true)
      console.error('[ranger]', e)
      return
    }
    await onFait()
  }

  if (vers) {
    const n = Math.min(p.qte, Math.max(1, combien || 1))
    const valider = (): void => {
      if (vers.quoi === 'donner') void donnerVraiment(vers.cible, n)
      else void ranger(vers.inventaireId, n)
    }
    return (
      <Pop x={x} y={y} className="menu-donner poser-combien" onClose={onClose}>
        <span className="eyebrow">{vers.nom}</span>
        <label className="pc-ligne">
          <span>Combien&nbsp;?</span>
          <span className="inv-qte">
            <button disabled={n <= 1} onClick={() => setCombien(n - 1)} aria-label="Un de moins">
              −
            </button>
            <input
              className="num"
              type="number"
              min={1}
              max={p.qte}
              autoFocus
              value={combien}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => setCombien(Math.trunc(Number(e.target.value)) || 0)}
              onKeyDown={(e) => e.key === 'Enter' && valider()}
              aria-label="Combien en donner"
            />
            <button disabled={n >= p.qte} onClick={() => setCombien(n + 1)} aria-label="Un de plus">
              +
            </button>
          </span>
          <span className="pc-sur num">sur {p.qte}</span>
        </label>
        <div className="pc-pied">
          <button className="btn btn-sm btn-ghost" onClick={() => setVers(null)}>
            Retour
          </button>
          <div className="spacer" />
          <button className="btn btn-sm btn-brass" onClick={valider}>
            <IconDonner />
            {n >= p.qte ? 'Tout donner' : `Donner ${n}`}
          </button>
        </div>
      </Pop>
    )
  }

  return (
    <Pop x={x} y={y} className="menu-donner" onClose={onClose}>
      <button
        className="md-fermer"
        onClick={onClose}
        title="Fermer sans rien donner — Échap"
        aria-label="Fermer"
      >
        <IconClose />
      </button>
      <span className="eyebrow">Dans les mains de</span>
      {pjs.length === 0 ? <p className="pop-rien">Aucun personnage joueur.</p> : null}
      {pjs.map((c) => (
        <button
          key={c.id}
          className={`opt c-${c.color ?? 'neutral'}`}
          onClick={() => choisir({ quoi: 'donner', cible: { port: 'pj', characterId: c.id }, nom: `Dans les mains de ${c.name}` })}
        >
          <span className="pip" />
          {c.name}
        </button>
      ))}

      {pnjs.length ? (
        <>
          <hr />
          <span className="eyebrow">Sur un PNJ</span>
          {pnjs.map((c) => (
            <button
              key={c.id}
              className={`opt c-${c.color ?? 'neutral'}`}
              onClick={() => choisir({ quoi: 'donner', cible: { port: 'pnj', characterId: c.id }, nom: `Sur ${c.name}` })}
            >
              <span className="pip" />
              {c.name}
            </button>
          ))}
        </>
      ) : null}

      {lieux.length ? (
        <>
          <hr />
          {/* Le poser quelque part est la même opération, vue de l'autre bout :
              il quitte les mains de quelqu'un et reste dans la pièce. */}
          <span className="eyebrow">Le poser dans</span>
          {lieux.map((l) => (
            <button
              key={l.id}
              className="opt"
              onClick={() => choisir({ quoi: 'donner', cible: { port: 'lieu', placeId: l.id }, nom: `Le poser dans ${l.name}` })}
            >
              {l.name}
            </button>
          ))}
        </>
      ) : null}

      {inventaires.length ? (
        <>
          <hr />
          <span className="eyebrow">Le ranger dans</span>
          {inventaires.map((i) => (
            <button
              key={i.id}
              className="opt"
              onClick={() => choisir({ quoi: 'ranger', inventaireId: i.id, nom: `Le ranger dans ${i.nom}` })}
            >
              {i.nom}
            </button>
          ))}
        </>
      ) : null}
    </Pop>
  )
}
