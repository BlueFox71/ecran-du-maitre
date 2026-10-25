import { useEffect, useState } from 'react'
import { useStore } from '../../../store'
import { Seg } from '../briques'
import type { Reglage } from '../registre'

/* ============================================================
   Bibliothèque
   ============================================================ */

export const reglages: Reglage[] = [
  {
    id: 'biblio.vignette',
    rubrique: 'biblio',
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
    id: 'graveur.etat',
    rubrique: 'biblio',
    nom: 'Le graveur de vignettes',
    aide: 'Une fenêtre cachée mesure les médias et grave leurs vignettes, un fichier à la fois.',
    mots: ['miniatures', 'examen', 'file', 'attente', 'progression'],
    Cmd: function EtatGraveur() {
      const [examen, setExamen] = useState<{ actif: boolean; reste: number } | null>(null)

      /* Le graveur travaille pendant qu'on le regarde : on relit, sans hâte. */
      useEffect(() => {
        let vivant = true
        const lire = async (): Promise<void> => {
          const e = await window.jdr.examen.etat()
          if (vivant) setExamen(e)
        }
        void lire()
        const t = setInterval(lire, 2000)
        return () => {
          vivant = false
          clearInterval(t)
        }
      }, [])

      return (
        <span className={`pm-etat${examen?.actif ? ' on' : ''}`}>
          {!examen
            ? '…'
            : examen.actif
              ? `au travail · ${examen.reste} en attente`
              : examen.reste
                ? `${examen.reste} en attente`
                : 'tout est gravé'}
        </span>
      )
    }
  },
  {
    id: 'graveur.reprendre',
    rubrique: 'biblio',
    nom: 'Reprendre le travail',
    aide: 'Relire le dossier cherche ce qui a bougé ; tout regraver oublie les mesures et recommence.',
    mots: ['relire', 'regraver', 'rescanner', 'actualiser', 'miniatures'],
    Cmd: function ReprendreGraveur() {
      const s = useStore()
      const [occupe, setOccupe] = useState(false)
      return (
        <>
          <button
            className="btn btn-sm"
            disabled={occupe}
            onClick={async () => {
              setOccupe(true)
              await window.jdr.library.rescan()
              await s.refreshLibrary()
              setOccupe(false)
            }}
          >
            Relire le dossier
          </button>
          <button
            className="btn btn-sm"
            disabled={occupe}
            onClick={async () => {
              if (!confirm('Oublier les mesures de tous les médias et tout regraver ?')) return
              setOccupe(true)
              const n = await window.jdr.examen.tout()
              setOccupe(false)
              s.toast(`${n} médias à réexaminer.`)
            }}
          >
            Tout regraver
          </button>
        </>
      )
    }
  }
]
