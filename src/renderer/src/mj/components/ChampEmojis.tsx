/**
 * Le champ d'émojis : cinq au plus, tous différents, tapés, piochés parmi
 * vingt, ou pris dans le catalogue de Windows. Sert à la fiche d'un joueur
 * et à l'écran « Ça commence bientôt ».
 */
import { useRef } from 'react'
import { EMOJIS_MAX, emojisDe } from '@shared/emojis'

/** Une poignée d'émojis à piocher d'un clic, pour qui n'a pas le clavier sous la main. */
const EMOJIS_PROPOSES = [
  '✨', '🔥', '💀', '👻', '🕯️', '🔮', '🗡️', '🛡️', '🍀', '🌙',
  '⭐', '🎲', '📜', '🔍', '🧪', '🐺', '🦇', '🌹', '💰', '🎭'
]

/**
 * Les émojis de présentation : ceux qui jaillissent derrière le portrait
 * quand on le présente à l'écran. Cinq au plus, tous différents — le champ
 * écarte tout seul ce qui n'est pas un émoji, les doublons et le surplus.
 */
export function ChampEmojis({
  emojis,
  onChange,
  id = 'nc-emojis',
  libelle = 'Émojis de présentation',
  aide = 'Ils jaillissent derrière son portrait quand on le présente à l’écran.'
}: {
  emojis: string[]
  onChange: (e: string[]) => void
  id?: string
  libelle?: string
  aide?: string
}): JSX.Element {
  const plein = emojis.length >= EMOJIS_MAX
  const champ = useRef<HTMLInputElement>(null)
  /* Le panneau de Windows écrit là où est le curseur : on donne la main au
     champ, curseur au bout, avant de l'ouvrir. */
  const catalogue = (): void => {
    const el = champ.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
    void window.jdr.app.emojis()
  }
  return (
    <div className="field">
      <label htmlFor={id}>{libelle}</label>
      <div className="emo-saisie">
        <input
          ref={champ}
          id={id}
          type="text"
          className="nc-emojis"
          value={emojis.join('')}
          onChange={(e) => onChange(emojisDe(e.target.value))}
          placeholder="🕯️👻🔍"
        />
        <button
          type="button"
          className="btn btn-sm"
          onClick={catalogue}
          disabled={plein}
          title={plein ? `${EMOJIS_MAX} au plus : retires-en un d’abord` : 'Le catalogue d’émojis de Windows'}
        >
          Tous les émojis…
        </button>
      </div>
      <div className="emo-choix">
        {EMOJIS_PROPOSES.map((x) => {
          const pris = emojis.includes(x)
          return (
            <button
              key={x}
              type="button"
              aria-pressed={pris}
              disabled={!pris && plein}
              onClick={() => onChange(pris ? emojis.filter((y) => y !== x) : [...emojis, x])}
              title={pris ? 'Retirer' : plein ? `${EMOJIS_MAX} au plus` : 'Ajouter'}
            >
              {x}
            </button>
          )
        })}
      </div>
      <p className="aide">
        {emojis.length}/{EMOJIS_MAX}, tous différents. {aide}
      </p>
    </div>
  )
}
