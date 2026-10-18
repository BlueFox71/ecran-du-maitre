import { TEINTES_MONNAIE, type TeinteMonnaie } from '@shared/monnaies'

/**
 * Le visage d'une monnaie : son image quand le MJ en a choisi une, sinon une
 * pièce dessinée dans sa teinte. Le même dessin sert au poste et aux
 * téléphones, qui n'ont pas la même façon d'atteindre une image — c'est donc
 * l'appelant qui donne l'adresse.
 */
export function Piece({
  teinte,
  url,
  taille = 20,
  titre
}: {
  teinte: TeinteMonnaie | string
  url?: string | null
  taille?: number
  titre?: string
}): JSX.Element {
  if (url)
    return (
      <img
        className="piece-img"
        src={url}
        alt={titre ?? ''}
        title={titre}
        width={taille}
        height={taille}
        style={{ width: taille, height: taille, objectFit: 'contain', flex: 'none' }}
      />
    )
  const c = TEINTES_MONNAIE[teinte as TeinteMonnaie] ?? teinte
  return (
    <svg
      viewBox="0 0 32 32"
      width={taille}
      height={taille}
      style={{ flex: 'none' }}
      role={titre ? 'img' : undefined}
      aria-label={titre}
      aria-hidden={titre ? undefined : true}
    >
      {titre ? <title>{titre}</title> : null}
      <circle cx="16" cy="16" r="13.5" fill={c} />
      <circle cx="16" cy="16" r="13.5" fill="none" stroke="rgba(0,0,0,.35)" strokeWidth="1" />
      <circle cx="16" cy="16" r="9.5" fill="none" stroke="rgba(0,0,0,.28)" strokeWidth="1.5" />
      <path d="M11 11.5a8 8 0 0 1 6-3" fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
