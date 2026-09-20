/**
 * Un joueur en petit : un anneau de sa couleur, son initiale dedans.
 *
 * C'est le même vocabulaire que les pions posés sur l'écran des joueurs — les
 * classes `c-*` de slide.css donnent l'anneau et le fond — pour qu'on
 * reconnaisse la même personne d'un bout à l'autre de l'application.
 */
export function Pastille({
  nom,
  couleur,
  grand
}: {
  nom: string
  couleur: string | null
  grand?: boolean
}): JSX.Element {
  return (
    <span
      className={`jeton c-${couleur ?? 'neutral'}${grand ? ' grand' : ''}`}
      title={nom}
      aria-hidden="true"
    >
      {initiale(nom)}
    </span>
  )
}

function initiale(nom: string): string {
  const t = nom.trim()
  return t ? t[0].toLocaleUpperCase('fr-FR') : '?'
}
