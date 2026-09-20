import { useEffect } from 'react'
import { useStore } from '../store'
import { Slide } from '../../shared/Slide'
import { Pings, usePings } from '../../shared/Pings'
import { IconEyeOff, IconExpand } from './Icons'
import type { CollageCell } from '@shared/types'

/**
 * Moniteur de l'écran joueurs, en haut à gauche et visible depuis tous les modules.
 * Il montre en direct ce que voient les joueurs ; un clic ouvre la régie.
 */
export function Monitor(): JSX.Element {
  const display = useStore((s) => s.display)
  const screens = useStore((s) => s.screens)
  const setView = useStore((s) => s.setView)
  const toast = useStore((s) => s.toast)

  /*
   * Les ondes des joueurs se voient ici, et pas seulement en Régie : le
   * moniteur montre toujours l'écran réel, alors que la grande scène de la
   * Régie montre souvent celle qu'on prépare — où un point montré du doigt
   * désignerait une autre image. Et il est là depuis tous les modules.
   */
  const ondes = usePings()
  const poserOnde = ondes.ajouter
  useEffect(() => window.jdr.display.onPing(poserOnde), [poserOnde])

  const frozen = display?.frozen ?? false
  /*
   * Gelé, le moniteur montre l'écran **que les joueurs ont réellement** — celui
   * d'avant le gel — et non ce que le MJ est en train d'arranger. C'est tout
   * l'objet de ce moniteur : ne jamais mentir sur ce qu'ils voient.
   */
  const vue = frozen ? display?.frozenView : null
  const slide = vue?.slide ?? display?.slide ?? { type: 'black' as const }
  const dark = slide.type === 'black'
  const open = display?.playerOpen ?? false

  const pillClass = frozen ? 'frozen' : dark ? 'off' : 'on'
  const pillText = frozen ? 'Figé' : dark ? 'Voile noir' : 'Direct'

  const out = screens.find((x) => x.id === display?.outputDisplayId)
  const fallback = screens.find((x) => !x.primary) ?? screens[0]
  const target = out ?? fallback

  return (
    <div className="monitor-zone">
      <button
        className="monitor"
        onClick={() => setView('regie')}
        title="Ouvrir la régie de l'écran joueurs"
      >
        <span className="mon-frame">
          <Slide
            slide={slide}
            pions={vue?.pions ?? display?.pions}
            pionSize={vue?.pionSize ?? display?.pionSize}
            /* Pendant le gel, la caméra est celle du gel : elle a été mise de
               côté avec la scène, et le moniteur montre la scène d'alors. */
            focusPionId={vue ? vue.focusPionId : display?.focusPionId}
            pionLabels={display?.pionLabels ?? true}
            pionPv={display?.pionPv ?? false}
            joueurs={display?.joueurs}
            encart={display?.encart}
          />
          {/* Pendant un gel, rien ne part vers les joueurs : une onde n'aurait
              pas lieu d'apparaître sur ce qu'ils voient encore. */}
          {!frozen ? <Pings pings={ondes.pings} /> : null}
          <span className={`mon-badge live-pill ${pillClass}`}>
            <span className="dot" />
            {pillText}
          </span>
        </span>
        <span className="mon-foot">
          <span className="mon-name">{slideLabel(slide)}</span>
          <span className="mon-open">Régie ›</span>
        </span>
      </button>

      <div className="mon-quick">
        <button
          className="btn btn-sm btn-c"
          onClick={() => void window.jdr.display.blackout()}
          disabled={frozen}
          title="Ctrl+B"
        >
          <IconEyeOff />
          Voile noir
        </button>
        <button
          className={`btn btn-sm btn-c${open ? ' btn-on' : ''}`}
          onClick={async () => {
            const st = await window.jdr.display.togglePlayer()
            toast(st.playerOpen ? 'Écran joueurs ouvert' : 'Écran joueurs fermé')
          }}
          title="F5"
        >
          <IconExpand />
          {open ? 'Fermer' : 'Ouvrir'}
        </button>
      </div>

      <div className="mon-out">
        <b className={open ? '' : 'off'} />
        <span>
          {target
            ? `${target.label} · ${target.width}×${target.height}${open ? '' : ' · fermé'}`
            : 'aucun écran détecté'}
        </span>
      </div>
    </div>
  )
}

export function slideLabel(slide: {
  type: string
  title?: string
  cells?: (CollageCell | null)[]
}): string {
  if (slide.type === 'black') return 'Voile noir'
  if (slide.type === 'collage') {
    const pleines = (slide.cells ?? []).filter(Boolean) as CollageCell[]
    if (!pleines.length) return 'Collage vide'
    /* Une case de texte s'annonce par ce qu'elle dit, abrégé : « Collage vide »
       pour une case qui porte trois mots serait un mensonge poli. */
    return pleines
      .map((c) => (c.kind === 'texte' ? `« ${abrege(c.texte)} »` : c.title))
      .join(' · ')
  }
  return slide.title ?? 'Sans titre'
}

const abrege = (t: string): string => {
  const clean = t.trim().replace(/\s+/g, ' ')
  return clean.length > 24 ? `${clean.slice(0, 23)}…` : clean || 'texte'
}
