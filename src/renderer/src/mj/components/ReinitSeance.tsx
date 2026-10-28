import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store'
import { useEchap } from '../echap'
import { useSm } from '../santeMentale/etat'
import { useSurligneur } from '../surligneur'
import { IconRecommencer } from './Icons'
import type { ChoixReinit } from '@shared/types'

/**
 * « Réinitialiser la séance » : on coche ce qu'on remet à son départ, et on
 * valide. Pour rejouer une séance, ou l'essayer seul avant la table. Un
 * Ctrl+Z rend tout ce qui est en base ; l'état de la santé mentale (chronos,
 * jets attendus), lui, ne vit qu'ici et ne revient pas.
 */
const CASES: { k: keyof ChoixReinit; nom: string; aide: string; sm?: boolean }[] = [
  { k: 'objets', nom: 'Ranger les objets', aide: 'Chaque exemplaire déplacé retourne à son emplacement initial.' },
  { k: 'jaugesPj', nom: 'Jauges des joueurs au maximum', aide: 'PV, santé mentale, chance…' },
  { k: 'jaugesPnj', nom: 'Jauges des PNJ au maximum', aide: 'Ceux de la séance et ceux de la campagne.' },
  { k: 'modifs', nom: 'Retirer les bonus et malus des joueurs', aide: 'Ceux posés sur leurs fiches, à la main ou par la santé mentale.' },
  { k: 'journalJauges', nom: 'Vider le journal des jauges', aide: 'L’historique des fiches, et le journal de la santé mentale.' },
  { k: 'journalJets', nom: 'Vider le journal des jets', aide: 'Les jets de la séance active.' },
  { k: 'surlignages', nom: 'Retirer tous les surlignages', aide: 'Ceux du Paravent, dans toute la campagne.' },
  { k: 'etatSm', nom: 'Effacer la santé mentale en cours', aide: 'Chronos, jets attendus, alertes, remèdes déjà pris.', sm: true }
]

const DEFAUT: ChoixReinit = {
  objets: true,
  jaugesPj: true,
  jaugesPnj: false,
  modifs: false,
  journalJauges: true,
  journalJets: true,
  etatSm: true,
  surlignages: false
}

export function ReinitSeance({ onFerme }: { onFerme: () => void }): JSX.Element {
  const s = useStore()
  const smActif = s.reglages.sm.actif
  const [choix, setChoix] = useState<ChoixReinit>({ ...DEFAUT, etatSm: smActif })
  const [occupe, setOccupe] = useState(false)
  useEchap(onFerme)

  const cases = CASES.filter((c) => !c.sm || smActif)
  const rien = !cases.some((c) => choix[c.k])

  const valider = async (): Promise<void> => {
    setOccupe(true)
    try {
      await window.jdr.seance.reinitialiser(choix)
      if (choix.etatSm) useSm.getState().remettreAZero()
      if (choix.surlignages) await useSurligneur.getState().charger()
      await Promise.all([s.refreshCharacters(), s.refreshObjets(), s.refreshRolls()])
      s.annoncer('Séance réinitialisée — Ctrl+Z pour revenir en arrière.')
      onFerme()
    } catch (e) {
      console.error('[réinitialiser]', e)
      s.toast('La séance n’a pas pu être réinitialisée.', true)
      setOccupe(false)
    }
  }

  return createPortal(
    <div className="scrim par-dessus" onClick={onFerme}>
      <div className="modal reinit-seance" onClick={(e) => e.stopPropagation()}>
        <header>
          <IconRecommencer />
          <h3>Réinitialiser la séance</h3>
        </header>
        <div className="body">
          <p className="rs-intro">Coche ce qui repart de zéro. Le reste ne bouge pas.</p>
          {cases.map((c) => (
            <label key={c.k} className="rs-case">
              <input
                type="checkbox"
                checked={choix[c.k]}
                onChange={(e) => setChoix((x) => ({ ...x, [c.k]: e.target.checked }))}
              />
              <span>
                <b>{c.nom}</b>
                <span className="rs-aide">{c.aide}</span>
              </span>
            </label>
          ))}
        </div>
        <footer>
          <button className="btn btn-sm" onClick={onFerme}>
            Annuler
          </button>
          <button className="btn btn-sm btn-danger" disabled={rien || occupe} onClick={() => void valider()}>
            Réinitialiser
          </button>
        </footer>
      </div>
    </div>,
    document.body
  )
}
