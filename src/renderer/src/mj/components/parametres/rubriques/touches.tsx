import type { Reglage } from '../registre'

/* ============================================================
   Raccourcis
   ============================================================ */

const TOUCHES: { touches: string[]; quoi: string; ou: string }[] = [
  { touches: ['F5'], quoi: 'Ouvrir ou fermer l’écran des joueurs', ou: 'partout' },
  { touches: ['Ctrl', 'B'], quoi: 'Voile noir', ou: 'partout' },
  {
    touches: ['Ctrl', 'Alt', 'B'],
    quoi: 'Voile noir, même quand la fenêtre n’a pas la main',
    ou: 'système'
  },
  { touches: ['Ctrl', 'K'], quoi: 'Aller à la recherche', ou: 'partout' },
  { touches: ['P'], quoi: 'Le pointeur — ou Ctrl maintenu, le temps d’un geste', ou: 'Régie' },
  { touches: ['Suppr'], quoi: 'Effacer le trait choisi', ou: 'Murs' },
  { touches: ['Échap'], quoi: 'Refermer un menu, une fenêtre, un outil armé', ou: 'partout' },
  { touches: ['Ctrl', 'N'], quoi: 'Nouvelle campagne', ou: 'menu Fichier' },
  { touches: ['Ctrl', 'O'], quoi: 'Ouvrir une campagne', ou: 'menu Fichier' }
]

export const reglages: Reglage[] = [
  {
    id: 'touches.liste',
    rubrique: 'touches',
    nom: 'Les touches',
    mots: ['clavier', 'raccourcis', 'touches', 'ctrl', 'f5', 'voile'],
    pleine: true,
    Cmd: function TableDesTouches() {
      return (
        <table className="pm-touches">
          <thead>
            <tr>
              <th>Touche</th>
              <th>Ce qu’elle fait</th>
              <th>Où</th>
            </tr>
          </thead>
          <tbody>
            {TOUCHES.map((t) => (
              <tr key={t.touches.join('+')}>
                <td>
                  {t.touches.map((k) => (
                    <kbd key={k}>{k}</kbd>
                  ))}
                </td>
                <td>{t.quoi}</td>
                <td className="ou">{t.ou}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )
    }
  }
]
