import { useContext, useState } from 'react'
import { useStore } from '../../../store'
import type { Reglage } from '../registre'
import { ListeJoueurs } from '../../Fiches'
import { OuvrirCarnet } from '../contexte'

/* ============================================================
   La campagne — son identité et son dossier
   ============================================================ */

/** L'identité s'écrit en sortant du champ ; le magasin reprend ce que le disque a gardé. */
async function poserIdentite(patch: { name?: string; system?: string | null }): Promise<void> {
  const info = await window.jdr.project.update(patch)
  if (info) useStore.setState({ project: info, campaign: info.campaign })
  await useStore.getState().refreshRecents()
}

export const reglages: Reglage[] = [
  {
    id: 'campagne.nom',
    rubrique: 'campagne',
    nom: 'Nom de la campagne',
    mots: ['titre', 'intitulé', 'renommer', 'appeler'],
    Cmd: function NomCampagne() {
      const s = useStore()
      const [nom, setNom] = useState(s.campaign?.name ?? '')
      return (
        <input
          type="text"
          value={nom}
          style={{ width: 240 }}
          onChange={(e) => setNom(e.target.value)}
          onBlur={() => void poserIdentite({ name: nom.trim() || (s.campaign?.name ?? '') })}
        />
      )
    }
  },
  {
    id: 'campagne.systeme',
    rubrique: 'campagne',
    nom: 'Système',
    aide: 'Le vôtre, ou celui d’un livre. C’est une étiquette, rien de plus.',
    mots: ['jeu', 'livre', 'édition', 'gamme', 'étiquette'],
    Cmd: function SystemeCampagne() {
      const s = useStore()
      const [systeme, setSysteme] = useState(s.campaign?.system ?? '')
      return (
        <input
          type="text"
          value={systeme}
          style={{ width: 240 }}
          placeholder="maison — d20 + carac"
          onChange={(e) => setSysteme(e.target.value)}
          onBlur={() => void poserIdentite({ system: systeme.trim() || null })}
        />
      )
    }
  },
  {
    id: 'campagne.dossier',
    rubrique: 'campagne',
    nom: 'Dossier de la campagne',
    aide: 'La base vit dans .ecran-du-maitre · tout le reste du dossier est la bibliothèque.',
    mots: ['chemin', 'emplacement', 'disque', 'ouvrir', 'changer'],
    pleine: true,
    Cmd: function DossierCampagne() {
      const s = useStore()
      return (
        <div className="pm-chemin">
          <code>{s.project?.dir ?? '—'}</code>
          <div className="spacer" />
          <button className="btn btn-sm btn-ghost" onClick={() => void window.jdr.project.reveal()}>
            Ouvrir
          </button>
          <button className="btn btn-sm" onClick={() => void window.jdr.project.open()}>
            Changer de campagne…
          </button>
        </div>
      )
    }
  },
  {
    id: 'joueurs',
    rubrique: 'campagne',
    nom: 'Joueurs de la campagne',
    mots: ['joueurs', 'couleur', 'personnage', 'inscrire', 'table'],
    pleine: true,
    Cmd: function JoueursCampagne() {
      return <ListeJoueurs onCarnet={useContext(OuvrirCarnet)} />
    }
  }
]
