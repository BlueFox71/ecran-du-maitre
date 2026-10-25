/**
 * Ses bonus et malus au jet, sous ses caractéristiques.
 *
 * Le geste de la table : « tu es béni, +2 à ton prochain jet », « la jambe
 * cassée, −1 en Dextérité jusqu'à ce qu'on la soigne ». On les pose ici, ils
 * s'ajoutent à ses jets — sur le téléphone comme dans la saisie du MJ — puis
 * s'usent tout seuls. Ce que ses objets portés lui donnent se lit dessous, sans
 * se toucher : on l'enlève en lui retirant l'objet.
 */
import { useState } from 'react'
import { useStore } from '../store'
import { signe } from '@shared/jet'
import { ditDuree, valeurEffet, type DureeModif, type Modif } from '@shared/modifs'
import type { Character, StatSpec } from '@shared/types'

type Genre = 'prochain' | 'jets' | 'tours' | 'retrait'

const DUREES: { k: Genre; l: string }[] = [
  { k: 'prochain', l: 'Prochain jet' },
  { k: 'jets', l: 'Nombre de jets' },
  { k: 'tours', l: 'Nombre de tours' },
  { k: 'retrait', l: 'Jusqu’au retrait' }
]

function duree(g: Genre, n: number): DureeModif {
  if (g === 'retrait') return { genre: 'retrait' }
  if (g === 'prochain') return { genre: 'jets', reste: 1 }
  return { genre: g, reste: Math.max(1, Math.round(n)) }
}

export function BonusMalus({ ch, stats }: { ch: Character; stats: StatSpec[] }): JSX.Element {
  const s = useStore()
  const modifs = ch.data.modifs ?? []
  const [ouvert, setOuvert] = useState(false)
  const [valeur, setValeur] = useState(1)
  const [raison, setRaison] = useState('')
  const [carac, setCarac] = useState<string>('')
  const [genre, setGenre] = useState<Genre>('prochain')
  const [n, setN] = useState(2)

  const nomCarac = (k: string | null): string => {
    if (k == null) return 'tous les jets'
    const st = stats.find((x) => x.key === k)
    return st ? (st.code ?? st.label) : k
  }
  /* Ce que ses objets portés lui donnent : un effet « +1 — Sang-froid ». */
  const parObjets = s.objets
    .filter((o) => o.placements.some((p) => p.characterId === ch.id && p.emplacement))
    .flatMap((o) =>
      o.effets.flatMap((e) => {
        const v = valeurEffet(e.tete)
        return v ? [{ id: `${o.id}-${e.id}`, valeur: v, raison: o.nom, sur: e.detail.trim() || 'tous les jets' }] : []
      })
    )

  const ecrire = async (liste: Modif[]): Promise<void> => {
    await window.jdr.characters.setModifs(ch.id, liste)
    await s.refreshCharacters()
  }
  const ajouter = async (): Promise<void> => {
    if (!valeur) return
    const m: Modif = {
      id: crypto.randomUUID(),
      valeur,
      raison: raison.trim() || (valeur > 0 ? 'Bonus' : 'Malus'),
      caracKey: carac || null,
      duree: duree(genre, n)
    }
    await ecrire([...modifs, m])
    setRaison('')
    setOuvert(false)
  }

  return (
    <div className="dp-bloc dp-bonus">
      <span className="eyebrow">Bonus et malus</span>
      {modifs.length || parObjets.length ? (
        <ul className="dp-modifs">
          {modifs.map((m) => (
            <li key={m.id} className={m.valeur > 0 ? 'plus' : 'moins'}>
              <b className="num">{signe(m.valeur)}</b>
              <span className="r">{m.raison}</span>
              <span className="c">{nomCarac(m.caracKey)}</span>
              <span className="d">{ditDuree(m.duree)}</span>
              <button
                className="x"
                title="Retirer"
                aria-label={`Retirer ${m.raison}`}
                onClick={() => void ecrire(modifs.filter((x) => x.id !== m.id))}
              >
                ✕
              </button>
            </li>
          ))}
          {parObjets.map((l) => (
            <li key={l.id} className={`objet ${l.valeur > 0 ? 'plus' : 'moins'}`} title="Un objet qu’il porte : on l’enlève en lui retirant l’objet">
              <b className="num">{signe(l.valeur)}</b>
              <span className="r">{l.raison}</span>
              <span className="c">{l.sur}</span>
              <span className="d">porté</span>
            </li>
          ))}
        </ul>
      ) : null}
      {ouvert ? (
        <div className="dp-modif-neuf">
          <span className="ligne">
            <button className="btn btn-sm btn-ico" onClick={() => setValeur((v) => (v - 1 === 0 ? -1 : v - 1))} aria-label="Moins">
              −
            </button>
            <b className={`num v ${valeur > 0 ? 'plus' : 'moins'}`}>{signe(valeur)}</b>
            <button className="btn btn-sm btn-ico" onClick={() => setValeur((v) => (v + 1 === 0 ? 1 : v + 1))} aria-label="Plus">
              +
            </button>
            <input
              className="input"
              placeholder={valeur > 0 ? 'Béni, inspiré…' : 'Blessé, épuisé…'}
              value={raison}
              onChange={(e) => setRaison(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void ajouter()}
              autoFocus
            />
          </span>
          <span className="ligne">
            <select className="input" value={carac} onChange={(e) => setCarac(e.target.value)} aria-label="Sur quel jet">
              <option value="">Tous les jets</option>
              {stats.map((st) => (
                <option key={st.key} value={st.key}>
                  {st.label}
                </option>
              ))}
            </select>
            <select className="input" value={genre} onChange={(e) => setGenre(e.target.value as Genre)} aria-label="Combien de temps">
              {DUREES.map((d) => (
                <option key={d.k} value={d.k}>
                  {d.l}
                </option>
              ))}
            </select>
            {genre === 'jets' || genre === 'tours' ? (
              <input
                className="input n"
                type="number"
                min={1}
                value={n}
                onChange={(e) => setN(Number(e.target.value))}
                aria-label={genre === 'jets' ? 'Combien de jets' : 'Combien de tours'}
              />
            ) : null}
          </span>
          <span className="ligne">
            <button className="btn btn-sm btn-brass" onClick={() => void ajouter()}>
              Ajouter
            </button>
            <button className="btn btn-sm" onClick={() => setOuvert(false)}>
              Annuler
            </button>
          </span>
        </div>
      ) : (
        <button className="btn btn-sm dp-gauche" onClick={() => setOuvert(true)}>
          + Bonus ou malus
        </button>
      )}
    </div>
  )
}
