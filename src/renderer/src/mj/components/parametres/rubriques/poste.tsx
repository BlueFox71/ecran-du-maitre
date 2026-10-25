import { useStore } from '../../../store'
import { Seg } from '../briques'
import type { Reglage } from '../registre'

/* ============================================================
   Le poste
   ============================================================ */

export const reglages: Reglage[] = [
  {
    id: 'theme',
    rubrique: 'poste',
    nom: 'Thème',
    aide: 'Une table de jeu est une pièce sombre — mais on prépare une séance en plein jour.',
    mots: ['sombre', 'clair', 'couleurs', 'nuit'],
    Cmd: function Theme() {
      const s = useStore()
      return (
        <Seg
          valeur={s.poste.theme}
          choix={[
            { k: 'sombre' as const, label: 'Sombre' },
            { k: 'clair' as const, label: 'Clair' }
          ]}
          onChoisir={(k) => void s.poserPoste('theme', k)}
        />
      )
    }
  },
  {
    id: 'demarrage.rouvrir',
    rubrique: 'poste',
    nom: 'Rouvrir la dernière campagne au démarrage',
    aide: 'Décoché, l’application ouvre l’accueil et te laisse choisir.',
    mots: ['lancement', 'ouverture', 'accueil', 'récente', 'démarrer'],
    Cmd: function Rouvrir() {
      const s = useStore()
      return (
        <input
          type="checkbox"
          checked={s.poste.rouvrir}
          aria-label="Rouvrir la dernière campagne au démarrage"
          onChange={(e) => void s.poserPoste('demarrage.rouvrir', e.target.checked)}
        />
      )
    }
  },
  {
    id: 'donnees.dossier',
    rubrique: 'poste',
    nom: 'Dossier de données',
    aide: 'Le carnet de joueurs, le catalogue et la liste des récentes vivent là.',
    mots: ['application.db', 'base', 'emplacement', 'carnet', 'catalogue'],
    pleine: true,
    Cmd: function DossierDonnees() {
      const s = useStore()
      return (
        <div className="pm-chemin">
          <code>{s.project ? '…' : ''}application.db</code>
          <div className="spacer" />
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => void window.jdr.app.openDataFolder()}
          >
            Ouvrir le dossier
          </button>
        </div>
      )
    }
  }
]
