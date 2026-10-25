import { useStore } from '../../../store'
import { Curseur } from '../briques'
import type { Reglage } from '../registre'

/* ============================================================
   Murs et lumière
   ============================================================ */

export const reglages: Reglage[] = [
  {
    id: 'murs.portee',
    rubrique: 'murs',
    nom: 'Portée du regard',
    aide: 'Jusque-là, on voit même dans le noir ; au-delà, seulement ce qui est éclairé.',
    mots: ['vision', 'distance', 'vue', 'brouillard', 'obscurité'],
    Cmd: function MursPortee() {
      const s = useStore()
      const sans = s.reglages.mursPortee === null
      return (
        <>
          <Curseur
            label="Portée du regard"
            valeur={Math.round((s.reglages.mursPortee ?? 0.35) * 100)}
            min={2}
            max={150}
            desactive={sans}
            texte={(v) => (sans ? '∞' : `${v} %`)}
            onPoser={(v) => void s.poserReglage('murs.portee', v / 100)}
          />
          <button
            className={`btn btn-sm${sans ? ' btn-on' : ' btn-ghost'}`}
            title="Le regard ne s’arrête qu’aux murs"
            onClick={() => void s.poserReglage('murs.portee', sans ? 0.35 : null)}
          >
            {sans ? 'Sans limite' : 'Retirer la limite'}
          </button>
        </>
      )
    }
  },
  {
    id: 'murs.angle',
    rubrique: 'murs',
    nom: 'Angle du champ de vision',
    aide: 'Le secteur qu’un pion embrasse devant lui. Il vaut pour toute la campagne, et pour tous les écrans.',
    mots: ['vision', 'cône', 'secteur', 'regard', 'degrés'],
    Cmd: function MursAngle() {
      const s = useStore()
      return (
        <Curseur
          label="Angle du champ de vision"
          valeur={s.reglages.mursAngle}
          min={45}
          max={360}
          pas={5}
          texte={(v) => (v >= 360 ? 'tout autour' : `${v}°`)}
          onPoser={(v) => void s.poserReglage('murs.angle', v)}
        />
      )
    }
  },
  {
    id: 'murs.garde',
    rubrique: 'murs',
    nom: 'Laisser une zone éclairée découverte',
    aide: 'Cochée, la maison se dessine à mesure. Décochée, elle se referme derrière le groupe.',
    mots: ['brouillard', 'exploration', 'mémoire', 'découvert', 'lumière'],
    Cmd: function MursGarde() {
      const s = useStore()
      return (
        <input
          type="checkbox"
          checked={s.reglages.mursGarde}
          aria-label="Laisser une zone éclairée découverte"
          onChange={(e) => void s.poserReglage('murs.garde', e.target.checked)}
        />
      )
    }
  },
  {
    id: 'murs.largeur',
    rubrique: 'murs',
    nom: 'Largeur d’usine des ouvertures',
    aide: 'Une carte qui n’a pas encore retenu la sienne part de là.',
    mots: ['porte', 'fenêtre', 'ouverture', 'passage', 'largeur'],
    Cmd: function MursLargeur() {
      const s = useStore()
      return (
        <Curseur
          label="Largeur d’usine des ouvertures"
          valeur={Math.round(s.reglages.mursLargeur * 1000) / 10}
          min={1}
          max={20}
          pas={0.5}
          texte={(v) => `${v.toFixed(1).replace('.', ',')} %`}
          onPoser={(v) => void s.poserReglage('murs.largeur', v / 100)}
        />
      )
    }
  }
]

/** Ce qui n'est pas ici, et pourquoi : on le dit au pied de la rubrique. */
export const apres = (
  <p className="pm-aparte">
    Les deux natures de trait, la porte, la fenêtre, le rideau, la loupe et la gomme restent où
    ils sont : ce sont des outils de dessin, pas des réglages.
  </p>
)
