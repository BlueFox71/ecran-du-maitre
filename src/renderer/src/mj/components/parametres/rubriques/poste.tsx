import { useStore } from '../../../store'
import { ZOOM_MAX, ZOOM_MIN } from '@shared/reglages'
import { Curseur, Seg } from '../briques'
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
    id: 'biblio.vignette',
    rubrique: 'poste',
    nom: 'Taille des vignettes',
    aide: 'Elle était oubliée dès qu’on changeait de page. Elle tient, maintenant.',
    mots: ['miniatures', 'aperçus', 'grille', 'taille', 'images'],
    Cmd: function TailleVignettes() {
      const s = useStore()
      return (
        <Seg
          valeur={s.poste.vignette <= 130 ? 'p' : s.poste.vignette >= 190 ? 'g' : 'm'}
          choix={[
            { k: 'p' as const, label: 'Petites' },
            { k: 'm' as const, label: 'Moyennes' },
            { k: 'g' as const, label: 'Grandes' }
          ]}
          onChoisir={(k) =>
            void s.poserPoste('biblio.vignette', k === 'p' ? 118 : k === 'g' ? 206 : 154)
          }
        />
      )
    }
  },
  {
    id: 'editeur.zoom',
    rubrique: 'poste',
    nom: 'Zoom du texte dans l’Éditeur',
    aide: 'Ctrl + molette, dans l’Éditeur, le règle aussi.',
    mots: ['loupe', 'taille', 'police', 'lettres', 'grossir'],
    Cmd: function ZoomEditeur() {
      const s = useStore()
      return (
        <Curseur
          valeur={s.poste.editeurZoom}
          min={ZOOM_MIN}
          max={ZOOM_MAX}
          pas={0.1}
          texte={(v) => `${Math.round(v * 100)} %`}
          onPoser={(v) => void s.poserPoste('editeur.zoom', v)}
          label="Zoom du texte dans l’Éditeur"
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
