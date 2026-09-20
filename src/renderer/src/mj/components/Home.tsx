import { useStore } from '../store'
import { IconClose, IconFolder, IconPlus } from './Icons'

/**
 * L'accueil : ce qu'on voit quand aucune campagne n'est ouverte.
 *
 * Il n'apparaît qu'à la toute première ouverture, ou si le dossier de la
 * dernière campagne a disparu — le reste du temps, l'application rouvre
 * directement là où on s'était arrêté.
 */
export function Home(): JSX.Element {
  const s = useStore()

  return (
    <div className="accueil">
      <div className="accueil-corps">
        <div className="marque">
          <span className="marque-glyphe" aria-hidden="true" />
          <div>
            <h1>Écran du Maître</h1>
            <p>Aucune campagne ouverte.</p>
          </div>
        </div>

        <div className="gestes">
          <button className="geste" onClick={() => void window.jdr.project.create()}>
            <IconPlus />
            <b>Nouvelle campagne</b>
            <span>Choisis un dossier : il devient la campagne.</span>
          </button>
          <button className="geste" onClick={() => void window.jdr.project.open()}>
            <IconFolder />
            <b>Ouvrir une campagne…</b>
            <span>Parcours le disque jusqu'à un dossier de campagne.</span>
          </button>
        </div>

        {s.recents.length ? (
          <div className="recents">
            <span className="eyebrow">Campagnes récentes</span>
            {s.recents.map((r) => (
              <div key={r.path} className={`recent${r.exists ? '' : ' perdu'}`}>
                <button
                  className="ouvre"
                  disabled={!r.exists}
                  onClick={() => void window.jdr.project.openPath(r.path)}
                >
                  <span className="pt" aria-hidden="true" />
                  <span className="t">
                    <b>{r.name}</b>
                    <span className="chemin">{r.path}</span>
                  </span>
                  <span className="quand">{r.exists ? quand(r.openedAt) : 'introuvable'}</span>
                </button>
                <button
                  className="oublie"
                  title="Retirer de la liste"
                  aria-label={`Retirer ${r.name} de la liste`}
                  onClick={async () => {
                    await window.jdr.project.forget(r.path)
                    await s.refreshRecents()
                  }}
                >
                  <IconClose />
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

/** « Ouvert hier », plutôt qu'un horodatage que personne ne lit. */
function quand(iso: string): string {
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z')
  if (Number.isNaN(d.getTime())) return ''
  const jours = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  if (jours <= 0) return "aujourd'hui"
  if (jours === 1) return 'hier'
  if (jours < 7) return `il y a ${jours} jours`
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
