import { Curseur } from '../briques'
import { useSons } from '../../../sons'
import type { Reglage } from '../registre'

/* ============================================================
   Sons — le niveau et le déclenchement, en direct comme au pupitre
   ============================================================ */

export const reglages: Reglage[] = [
  {
    id: 'direct.sons.general',
    rubrique: 'sons',
    nom: 'Volume général des sons',
    aide: 'Les sons posés sur les cartes et les bruitages.',
    mots: ['volume', 'général', 'niveau', 'bruitages'],
    direct: true,
    Cmd: function SonsGeneral() {
      const general = useSons((x) => x.regie?.general ?? 0.8)
      return (
        <Curseur
          label="Volume général des sons"
          valeur={general * 100}
          min={0}
          max={100}
          volume
          texte={(v) => `${v} %`}
          onPoser={(v) => void window.jdr.regieSon.regler({ general: v / 100 })}
        />
      )
    }
  },
  {
    id: 'direct.sons.auto',
    rubrique: 'sons',
    nom: 'Déclenchement auto',
    aide: 'Coupé : rien ne part tout seul, les sons posés attendent ton feu vert.',
    mots: ['automatique', 'déclencheur', 'feu vert', 'zones', 'proche'],
    direct: true,
    Cmd: function SonsAuto() {
      const auto = useSons((x) => x.regie?.auto ?? true)
      return (
        <input
          type="checkbox"
          aria-label="Déclenchement auto"
          checked={auto}
          onChange={(e) => void window.jdr.regieSon.regler({ auto: e.target.checked })}
        />
      )
    }
  }
]
