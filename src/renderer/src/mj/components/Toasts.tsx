import { useStore } from '../store'
import { IconClose } from './Icons'

/** Retours d'action, en bas de l'écran du MJ. Jamais sur l'écran des joueurs. */
export function Toasts(): JSX.Element {
  const toasts = useStore((s) => s.toasts)
  const fermer = useStore((s) => s.dismissToast)
  const retours = toasts.filter((t) => !t.annonce)
  const last = retours[retours.length - 1]
  /* Les annonces de partie (une perte de SM) s'empilent en bas à droite :
     plusieurs tombent parfois d'un coup, et aucune ne doit cacher l'autre. */
  const annonces = toasts.filter((t) => t.annonce).slice(-5)
  return (
    <>
      <div className={`toast${last ? ' show' : ''}${last?.error ? ' err' : ''}`} role="status">
        <span className="dot" />
        <span>{last?.msg ?? ''}</span>
      </div>
      {annonces.length ? (
        <div className="annonces" role="status">
          {annonces.map((t) => (
            <div key={t.id} className="annonce">
              <span className="dot" />
              <span>{t.msg}</span>
              <button type="button" title="Fermer" aria-label="Fermer" onClick={() => fermer(t.id)}>
                <IconClose />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </>
  )
}
