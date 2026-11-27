/**
 * Les effets en cours d'un personnage WoW, sur sa fiche de l'Écran.
 *
 * Ils viennent de son Aventure (voir `main/wowFiches.ts`) et s'y renvoient :
 * le MJ en pose un ou en retire un ici, l'Aventure du joueur le reçoit — dans
 * sa boîte s'il est en ligne, dans son fichier sinon.
 */
import { useEffect, useState } from 'react'
import { useStore } from '../store'
import type { Character } from '@shared/types'
import type { EffetFicheWow } from '@shared/wow'

export function EffetsWow({ ch }: { ch: Character }): JSX.Element | null {
  const s = useStore()
  const [lie, setLie] = useState<string | null>(null)
  const [nom, setNom] = useState('')
  const [tours, setTours] = useState(2)
  const [mal, setMal] = useState(false)

  /* Seul un personnage né dans l'Aventure a des effets à suivre. */
  useEffect(() => {
    let vivant = true
    void window.jdr.wow.joueurDe(ch.id).then((j) => vivant && setLie(j))
    return () => {
      vivant = false
    }
  }, [ch.id])

  if (s.reglages.regles !== 'wow' || !lie) return null

  const auras = ch.data.aurasWow ?? []
  const envoyer = async (effet: EffetFicheWow, dit: string): Promise<void> => {
    try {
      const ok = await window.jdr.wow.effetFiche(ch.id, effet)
      await s.refreshCharacters()
      s.toast(ok ? dit : `${dit} — l’Aventure de ${ch.name} ne l’a pas reçu`, !ok)
    } catch (e) {
      s.toast(e instanceof Error ? e.message : String(e), true)
    }
  }
  const poser = (): void => {
    const n = nom.trim()
    if (!n) return
    void envoyer(
      { t: 'aura', aura: { nom: n, tours, mal } },
      `${mal ? 'Affaiblissement' : 'Amélioration'} « ${n} » posé sur ${ch.name}`
    )
    setNom('')
  }

  return (
    <section className="sect sect-effets-wow">
      <div className="sect-tete">
        <span className="eyebrow">Effets en cours</span>
        <span className="compte libre">{auras.length}</span>
        <div className="spacer" />
        <span className="sys">reliés à l’Aventure</span>
      </div>
      {auras.length === 0 ? (
        <p className="rien">{ch.name} n’a aucun effet en cours.</p>
      ) : (
        <div className="az-rapides">
          {auras.map((a) => (
            <span key={a.nom} className={`az-puce${a.mal ? ' mal' : ''}`}>
              {a.nom}
              {a.pile > 1 ? ` ×${a.pile}` : ''}
              {a.tours > 0 ? ` · ${a.tours} tour${a.tours > 1 ? 's' : ''}` : ''}
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => void envoyer({ t: 'retire', nom: a.nom }, `« ${a.nom} » retiré de ${ch.name}`)}
                aria-label={`Retirer ${a.nom}`}
                title="Retirer cet effet (dans l’Aventure aussi)"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="az-ligne">
        <input
          type="text"
          placeholder="Poser un effet…"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && poser()}
        />
        <input
          type="number"
          min={0}
          max={99}
          value={tours}
          onChange={(e) => setTours(Math.max(0, Number(e.target.value) || 0))}
          aria-label="Tours (0 : sans fin)"
          title="Tours (0 : jusqu’à ce qu’on le retire)"
        />
        <label className="az-coche">
          <input type="checkbox" checked={mal} onChange={(e) => setMal(e.target.checked)} />
          néfaste
        </label>
        <button className="btn btn-sm" disabled={!nom.trim()} onClick={poser}>
          Poser
        </button>
      </div>
    </section>
  )
}
