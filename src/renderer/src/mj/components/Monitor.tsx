import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { Slide } from '../../shared/Slide'
import { Pings, usePings } from '../../shared/Pings'
import { BandeauTour } from '../../shared/BandeauTour'
import { montreLaCarte } from '@shared/scene'
import { IconEyeOff, IconExpand, IconQr } from './Icons'
import type { CalqueBrouillard, CollageCell, Pointer } from '@shared/types'

/**
 * Moniteur de l'écran joueurs, en haut à gauche et visible depuis tous les modules.
 * Il montre en direct ce que voient les joueurs ; un clic ouvre la régie.
 */
export function Monitor(): JSX.Element {
  const display = useStore((s) => s.display)
  const screens = useStore((s) => s.screens)
  const setView = useStore((s) => s.setView)
  const toast = useStore((s) => s.toast)
  const mobile = useStore((s) => s.mobile)
  const setMobile = useStore((s) => s.setMobile)

  /*
   * Les ondes des joueurs se voient ici, et pas seulement en Régie : le
   * moniteur montre toujours l'écran réel, alors que la grande scène de la
   * Régie montre souvent celle qu'on prépare — où un point montré du doigt
   * désignerait une autre image. Et il est là depuis tous les modules.
   */
  const ondes = usePings()
  const poserOnde = ondes.ajouter
  useEffect(() => window.jdr.display.onPing(poserOnde), [poserOnde])

  /* Le doigt du MJ sur le visuel, tel que les joueurs le voient bouger. */
  const [pointer, setPointer] = useState<Pointer | null>(null)
  useEffect(() => window.jdr.display.onPointer(setPointer), [])

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
  /* La même garde que la fenêtre des joueurs : pas de jetons sur une lettre. */
  const surCarte = montreLaCarte(slide, display?.carteDuLieu ?? null)

  const pillClass = frozen ? 'frozen' : dark ? 'off' : 'on'
  const pillText = frozen ? 'Figé' : dark ? 'Voile noir' : 'Direct'

  /*
   * Le brouillard et les murs du lieu à l'antenne, que l'écran des joueurs va
   * chercher de son côté : sans eux, le moniteur montrerait toute la carte là
   * où la table ne voit que ce qu'elle a découvert. Même relecture que lui.
   * Pendant un gel, la scène est celle d'avant : on ne sait plus sur quel
   * calque, on n'en pose pas plutôt que d'en poser un faux.
   */
  const [calque, setCalque] = useState<CalqueBrouillard | null>(null)
  const placeId = frozen ? null : (display?.placeId ?? null)
  useEffect(() => {
    let vivant = true
    if (placeId == null) {
      setCalque(null)
      return
    }
    void window.jdr.murs.calque(placeId).then((c) => {
      if (vivant) setCalque(c)
    })
    return () => {
      vivant = false
    }
  }, [placeId, display?.calqueRev, display?.slide, display?.pions])

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
            brouillard={surCarte ? calque : null}
            ombre={display?.vision !== 'jour'}
            jour={display?.vision === 'jour'}
            pions={surCarte ? (vue?.pions ?? display?.pions) : undefined}
            pionSize={vue?.pionSize ?? display?.pionSize}
            /* Pendant le gel, la caméra est celle du gel : elle a été mise de
               côté avec la scène, et le moniteur montre la scène d'alors. */
            focusPionId={vue ? vue.focusPionId : display?.focusPionId}
            /* Gelé, les joueurs gardent le halo d'avant : on ne le sait pas, on n'en montre pas. */
            pionEnJeuId={vue ? null : (display?.tour?.pionEnJeuId ?? null)}
            pionLabels={display?.pionLabels ?? true}
            pionPv={display?.pionPv ?? false}
            joueurs={display?.joueurs}
            encart={display?.encart}
            fenetres={display?.fenetres}
            /* Gelé, les joueurs ne le voient pas : le moniteur non plus. */
            pointer={frozen ? null : pointer}
          />
          {/* Pendant un gel, rien ne part vers les joueurs : une onde n'aurait
              pas lieu d'apparaître sur ce qu'ils voient encore. */}
          {!frozen ? <Pings pings={ondes.pings} /> : null}
          {/* « Au tour de … », comme en haut de leur écran. */}
          {!frozen && display?.tour ? <BandeauTour tour={display.tour} /> : null}
          {/* Le QR des portables, comme les joueurs le voient : par-dessus la
              scène, qu'il voile sans la remplacer. Le gel ne le retient pas. */}
          {display?.qr ? (
            <span className="mon-qr">
              <span className="mon-qr-carte">
                <span className="mon-qr-titre">Vos portables</span>
                <img src={display.qr.dataUrl} alt="" />
                <span className="mon-qr-url">{display.qr.url}</span>
              </span>
            </span>
          ) : null}
          <span className={`mon-badge live-pill ${pillClass}`}>
            <span className="dot" />
            {pillText}
          </span>
        </span>
        <span className="mon-foot">
          <span className="mon-name">
            {display?.qr ? `QR des portables · ${slideLabel(slide)}` : slideLabel(slide)}
          </span>
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
            toast(st.playerOpen ? 'Écran joueurs projeté' : 'Écran joueurs fermé')
          }}
          title="F5"
        >
          <IconExpand />
          {open ? 'Fermer' : 'Projeter'}
        </button>
        {/* Le raccourci du QR des portables : tendu à la table d'un clic, accès
            ouvert au passage s'il ne l'était pas. Le reste vit en Régie. */}
        <button
          className={`btn btn-sm btn-c${display?.qr ? ' btn-on' : ''}`}
          disabled={frozen}
          aria-pressed={!!display?.qr}
          aria-label={display?.qr ? 'Retirer le QR code de l’écran' : 'Montrer le QR code des portables'}
          title={display?.qr ? 'Retirer le QR code de l’écran' : 'Montrer le QR code des portables à la table'}
          onClick={async () => {
            try {
              if (!display?.qr && !mobile?.inviteOpen) setMobile((await window.jdr.mobile.open()).info)
              setMobile(await window.jdr.mobile.show(!display?.qr))
            } catch (e) {
              toast(String(e instanceof Error ? e.message : e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''), true)
            }
          }}
        >
          <IconQr />
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
  name?: string
  titre?: string
}): string {
  if (slide.type === 'black') return 'Voile noir'
  if (slide.type === 'presentation') return `Présentation · ${slide.name ?? ''}`
  if (slide.type === 'attente') return slide.titre ?? 'Ça commence bientôt'
  if (slide.type === 'preparation') return 'Préparation des personnages'
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
