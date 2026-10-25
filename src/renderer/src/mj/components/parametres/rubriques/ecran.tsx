import { useStore } from '../../../store'
import { Curseur, Seg } from '../briques'
import type { Reglage } from '../registre'

/* ============================================================
   Écran des joueurs
   ============================================================ */

export const reglages: Reglage[] = [
  {
    id: 'sortie.ecran',
    rubrique: 'ecran',
    nom: 'Écran de sortie',
    aide: 'Choisi une fois pour l’installation. La campagne s’en souvient.',
    mots: ['moniteur', 'projecteur', 'télé', 'second écran', 'sortie'],
    Cmd: function SortieEcran() {
      const s = useStore()
      return (
        <select
          value={s.reglages.sortieEcran ?? ''}
          onChange={(e) =>
            void s.poserReglage('sortie.ecran', e.target.value === '' ? null : e.target.value)
          }
        >
          <option value="">Sortie automatique (écran secondaire)</option>
          {s.screens.map((sc) => (
            <option key={sc.id} value={sc.id}>
              {sc.label} · {sc.width}×{sc.height}
            </option>
          ))}
        </select>
      )
    }
  },
  {
    id: 'bascule.mode',
    rubrique: 'ecran',
    nom: 'Manière de basculer, par défaut',
    aide: 'Les trois boutons restent au-dessus de « Basculer ». Ici, celui qui est armé en arrivant.',
    mots: ['transition', 'fondu', 'volet', 'noir'],
    Cmd: function BasculeMode() {
      const s = useStore()
      return (
        <Seg
          valeur={s.reglages.basculeMode}
          choix={[
            { k: 'fondu' as const, label: 'Fondu', aide: 'L’une apparaît pendant que l’autre s’efface' },
            { k: 'volet' as const, label: 'Volet', aide: 'La nouvelle pousse l’ancienne hors de l’écran' },
            { k: 'noir' as const, label: 'Par le noir', aide: 'On passe par le noir entre les deux' }
          ]}
          onChoisir={(k) => s.setTransition(k)}
        />
      )
    }
  },
  {
    id: 'bascule.ms',
    rubrique: 'ecran',
    nom: 'Durée de l’enchaînement',
    aide: 'Le temps que met une bascule. « Couper » l’ignore et change d’un coup.',
    mots: ['transition', 'vitesse', 'temps', 'millisecondes', 'bascule'],
    Cmd: function BasculeMs() {
      const s = useStore()
      return (
        <Curseur
          label="Durée de l’enchaînement"
          valeur={s.reglages.basculeMs}
          min={200}
          max={2500}
          pas={50}
          texte={(v) => `${v} ms`}
          onPoser={(v) => void s.poserReglage('bascule.ms', v)}
        />
      )
    }
  }
]

/** Ce qui n'est pas ici, et pourquoi : on le dit au pied de la rubrique. */
export const apres = (
  <p className="pm-aparte">
    Restent en Régie et au Paravent : <b>noms</b> et <b>PV sous les pions</b>, l’
    <b>encart des joueurs</b> et sa santé mentale, le <b>volume de l’ambiance</b>. On les
    bascule en pleine scène — les deux pages en gardent donc chacune une copie, et c’est voulu.
  </p>
)
