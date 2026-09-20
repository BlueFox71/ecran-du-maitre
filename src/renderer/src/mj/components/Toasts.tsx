import { useStore } from '../store'

/** Retours d'action, en bas de l'écran du MJ. Jamais sur l'écran des joueurs. */
export function Toasts(): JSX.Element {
  const toasts = useStore((s) => s.toasts)
  const last = toasts[toasts.length - 1]
  return (
    <div className={`toast${last ? ' show' : ''}${last?.error ? ' err' : ''}`} role="status">
      <span className="dot" />
      <span>{last?.msg ?? ''}</span>
    </div>
  )
}
