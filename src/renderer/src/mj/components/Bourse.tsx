import { useEffect, useState } from 'react'
import { itemById, useStore } from '../store'
import { Piece } from '../../shared/Piece'
import {
  changeComplet,
  enPlusPetite,
  monnaiesActives,
  payer,
  regrouper,
  type Monnaie,
  type Montants
} from '@shared/monnaies'
import type { Character } from '@shared/types'

/**
 * La bourse d'un personnage, joueur ou PNJ : une case par monnaie de la
 * campagne, et un geste pour payer ou recevoir. Chaque mouvement part au
 * journal du personnage, à l'heure exacte, comme un coup sur une jauge.
 *
 * Rien quand la campagne n'a pas d'argent : la section disparaît, mais les
 * montants restent en base et reviennent avec les monnaies.
 */
export function Bourse({ ch }: { ch: Character }): JSX.Element | null {
  const s = useStore()
  const liste = monnaiesActives(s.reglages.monnaies)
  const bourse: Montants = ch.data.bourse ?? {}
  const [montant, setMontant] = useState('')
  const [cle, setCle] = useState(liste[0]?.key ?? '')
  const [motif, setMotif] = useState('')

  /* Une monnaie retirée de la campagne ne peut plus être celle qu'on paie. */
  useEffect(() => {
    if (!liste.some((m) => m.key === cle)) setCle(liste[0]?.key ?? '')
  }, [liste, cle])

  if (liste.length === 0) return null

  const change = changeComplet(liste)
  const petite = liste[liste.length - 1]
  const total = change ? enPlusPetite(bourse, liste) : null

  const bouger = async (ecarts: Montants, raison?: string | null): Promise<void> => {
    if (Object.values(ecarts).every((v) => !v)) return
    await window.jdr.characters.bourse(ch.id, ecarts, raison?.trim() || null)
    await s.refreshCharacters()
  }

  const n = Math.round(Number(montant.replace(',', '.')))
  const valable = Number.isFinite(n) && n > 0

  const paye = async (): Promise<void> => {
    if (!valable) return
    const e = payer(bourse, liste, cle, n)
    const m = liste.find((x) => x.key === cle)
    if (!e) {
      s.toast(`${ch.name} n’a pas de quoi payer ${n} ${m?.abbr || m?.nom || ''}`, true)
      return
    }
    await bouger(e, motif || 'payé')
    setMontant('')
    setMotif('')
  }
  const recoit = async (): Promise<void> => {
    if (!valable) return
    await bouger({ [cle]: n }, motif || 'reçu')
    setMontant('')
    setMotif('')
  }

  return (
    <section className="sect">
      <div className="sect-tete">
        <span className="eyebrow">Bourse</span>
        <div className="spacer" />
        {total != null ? (
          <span className="sys">
            en tout {total.toLocaleString('fr-FR')} {petite.abbr || petite.nom}
          </span>
        ) : null}
        {change ? (
          <button
            className="btn btn-sm btn-ghost"
            title="Recompter la bourse avec le moins de pièces possible"
            onClick={() => void bouger(regrouper(bourse, liste), 'fait la monnaie')}
          >
            Faire la monnaie
          </button>
        ) : null}
      </div>

      <div className="bourse-sous">
        {liste.map((m) => (
          <Sou key={m.key} m={m} valeur={bourse[m.key] ?? 0} onBouge={(d) => void bouger({ [m.key]: d })} />
        ))}
      </div>

      <form
        className="bourse-geste"
        onSubmit={(e) => {
          e.preventDefault()
          void recoit()
        }}
      >
        <input
          id={`bourse-montant-${ch.id}`}
          type="number"
          min={1}
          value={montant}
          placeholder="0"
          onChange={(e) => setMontant(e.target.value)}
          aria-label="Montant"
        />
        {liste.length > 1 ? (
          <select value={cle} onChange={(e) => setCle(e.target.value)} aria-label="Monnaie">
            {liste.map((m) => (
              <option key={m.key} value={m.key}>
                {m.abbr || m.nom}
              </option>
            ))}
          </select>
        ) : (
          <span className="unite">{liste[0].abbr || liste[0].nom}</span>
        )}
        <input
          id={`bourse-motif-${ch.id}`}
          className="motif"
          type="text"
          value={motif}
          placeholder="pour… (facultatif)"
          onChange={(e) => setMotif(e.target.value)}
          aria-label="Motif, noté au journal"
        />
        <button type="button" className="btn btn-sm" disabled={!valable} onClick={() => void paye()}>
          − Payer
        </button>
        <button type="submit" className="btn btn-sm" disabled={!valable}>
          + Recevoir
        </button>
      </form>
    </section>
  )
}

/** Une monnaie de la bourse : sa pièce, son nom, et le compte qu'on retouche. */
function Sou({
  m,
  valeur,
  onBouge
}: {
  m: Monnaie
  valeur: number
  onBouge: (delta: number) => void
}): JSX.Element {
  const s = useStore()
  const img = itemById(s.allItems, m.imageItemId)
  const [tape, setTape] = useState(String(valeur))
  useEffect(() => setTape(String(valeur)), [valeur])

  /* Taper un compte, c'est un mouvement comme un autre : l'écart part au journal. */
  const valide = (): void => {
    const n = Math.round(Number(tape.replace(',', '.')))
    if (!Number.isFinite(n) || n < 0) {
      setTape(String(valeur))
      return
    }
    if (n !== valeur) onBouge(n - valeur)
  }

  return (
    <div className="bourse-sou">
      <Piece teinte={m.teinte} url={img?.url ?? null} taille={26} />
      <span className="nm" title={m.nom}>
        {m.nom}
      </span>
      <input
        type="number"
        min={0}
        value={tape}
        onChange={(e) => setTape(e.target.value)}
        onBlur={valide}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') setTape(String(valeur))
        }}
        aria-label={m.nom}
      />
      <span className="stepper">
        <button onClick={() => onBouge(-1)} disabled={valeur <= 0} aria-label={`Retirer 1 ${m.nom}`}>
          −
        </button>
        <button onClick={() => onBouge(1)} aria-label={`Ajouter 1 ${m.nom}`}>
          +
        </button>
      </span>
    </div>
  )
}
