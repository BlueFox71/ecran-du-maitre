import { useState } from 'react'
import { useStore } from '../store'
import { emojiDe, useSons } from '../sons'
import { useEchap } from '../echap'
import { Slide } from '../../shared/Slide'
import { Valeur } from './Valeur'
import { COURSE, positionDe, texteVolume, volumeDe } from '../volume'
import { slideLabel } from './Monitor'
import { TRANSITIONS, type Transition } from '@shared/types'
import { IconAudio, IconEyeOff, IconFade, IconFreeze, IconStop } from './Icons'

/**
 * La console du direct : la même bande au pied du Paravent et de la Régie
 * (17 octobre 2026, choix de Jules sur maquette).
 *
 * À gauche les gestes d'urgence — Voile, Figer —, toujours au même endroit ;
 * au milieu l'ambiance ; à droite ce qui part ensuite, la manière, et la
 * bascule. Le direct lui-même se lit au moniteur du rail : ici, on ne montre
 * que « À suivre ».
 *
 * Elle mesure sa propre largeur (requête de conteneur `cd`) : sur un portable,
 * les transitions passent en liste et l'ambiance perd son nom, mais aucun
 * geste ne disparaît.
 */
export function ConsoleDirect({
  apres
}: {
  /** Ce que la page fait une fois la bascule partie (le Paravent remet le direct sous les yeux). */
  apres?: (liveSlot: 0 | 1) => void
}): JSX.Element {
  const s = useStore()
  const display = s.display
  const frozen = display?.frozen ?? false
  const dark = (display?.slide ?? { type: 'black' }).type === 'black'
  const liveSlot = (display?.liveSlot ?? 0) as 0 | 1
  const idleSlot: 0 | 1 = liveSlot === 0 ? 1 : 0
  const suite = display?.slots?.[idleSlot] ?? { type: 'black' as const }
  const audio = display?.audio

  /** La manière vient du magasin : la Régie et le Paravent basculent pareil. */
  const swap = async (ms: number): Promise<void> => {
    if (frozen) {
      s.toast('Image figée — dégèle d’abord pour changer l’écran joueurs', true)
      return
    }
    const d = await window.jdr.display.swap(ms, s.transition)
    apres?.(d.liveSlot as 0 | 1)
  }

  return (
    <div className="cd">
      {/* La bande intérieure porte la mise en ligne : un conteneur ne peut pas
          se restyler selon sa propre largeur, ses enfants si. */}
      <div className="cd-in">
        <div className="cd-grp">
          <button
            className={`btn btn-sm${dark ? ' cd-voile' : ''}`}
            onClick={() => void window.jdr.display.blackout()}
            disabled={frozen}
            title={
              dark
                ? 'Remet aux joueurs l’image qu’ils voyaient avant le voile. Ctrl+B'
                : 'Coupe l’image des joueurs d’un coup — leur écran devient noir. Le même bouton la rétablit. Ctrl+B, ou Ctrl+Alt+B même quand l’application n’a pas le focus'
            }
          >
            <IconEyeOff />
            {dark ? 'Rétablir' : 'Voile'}
          </button>
          <button
            className={`btn btn-sm${frozen ? ' btn-on' : ''}`}
            aria-pressed={frozen}
            onClick={() => void window.jdr.display.freeze(!frozen)}
            title={
              frozen
                ? 'L’écran des joueurs est gelé : rien n’en part. Clique pour le rendre au direct.'
                : 'Gèle l’écran des joueurs sur ce qu’il montre : plus rien ne part tant que c’est actif — ni bascule, ni voile, ni fondu.'
            }
          >
            <IconFreeze />
            {frozen ? 'Figé' : 'Figer'}
          </button>
        </div>

        <span className="cd-sep" />

        <div className="cd-amb">
          <IconAudio />
          <ChoixAmbiance nom={audio?.title ?? null} sonId={audio?.sonId ?? null} />
          <button
            className="btn btn-sm"
            disabled={!audio?.itemId}
            onClick={() => void window.jdr.display.audio({ playing: !audio?.playing })}
          >
            {audio?.playing ? 'Pause' : 'Reprendre'}
          </button>
          <button
            className="btn btn-sm btn-ico"
            disabled={!audio?.itemId}
            onClick={() =>
              void window.jdr.display.audio({ itemId: null, url: null, title: null, playing: false, sonId: null })
            }
            aria-label="Couper l’ambiance"
            title="Couper l’ambiance"
          >
            <IconStop />
          </button>
          <input
            type="range"
            min={0}
            max={COURSE}
            step={1}
            value={positionDe(audio?.volume ?? 0.35)}
            aria-label="Volume de l’ambiance"
            onChange={(e) => void window.jdr.display.audio({ volume: volumeDe(Number(e.target.value)) })}
          />
          <Valeur
            className="val num"
            value={(audio?.volume ?? 0.35) * 100}
            min={0}
            max={100}
            step={0.5}
            decimales={1}
            affiche={texteVolume}
            label="Volume de l’ambiance"
            onChange={(v) => void window.jdr.display.audio({ volume: v / 100 })}
          />
        </div>

        <div className="spacer" />

        <div className="cd-suite" title={`À suivre — Visuel ${idleSlot + 1} : ${slideLabel(suite)}`}>
          <span className="cd-suite-txt">
            <span className="eyebrow">À suivre</span>
            <span className="cd-suite-nom">
              Visuel {idleSlot + 1} · {slideLabel(suite)}
            </span>
          </span>
          <span className="cd-vig">
            <Slide slide={suite} animate={false} />
          </span>
        </div>

        {/* La manière juste avant le bouton qui l'applique : on voit ce qui va se
            passer avant de le faire. En boutons au large, en liste à l'étroit. */}
        <div className="cd-modes" role="group" aria-label="Manière de basculer">
          {TRANSITIONS.map((t) => (
            <button
              key={t.key}
              className={`cd-mode${s.transition === t.key ? ' on' : ''}`}
              onClick={() => s.setTransition(t.key)}
              title={t.aide}
            >
              {t.name}
            </button>
          ))}
        </div>
        <select
          className="cd-modes-liste"
          value={s.transition}
          aria-label="Manière de basculer"
          onChange={(e) => s.setTransition(e.target.value as Transition)}
        >
          {TRANSITIONS.map((t) => (
            <option key={t.key} value={t.key}>
              {t.name}
            </option>
          ))}
        </select>

        <button
          className="btn btn-brass cd-bascule"
          onClick={() => void swap(s.reglages.basculeMs)}
          disabled={frozen}
          title="Envoyer « À suivre » aux joueurs, avec la manière choisie"
        >
          <IconFade />
          Basculer
        </button>
        <button
          className="btn btn-sm"
          onClick={() => void swap(0)}
          disabled={frozen}
          title="Sans enchaînement — l’image change d’un coup"
        >
          Couper
        </button>
      </div>
    </div>
  )
}

/**
 * Le nom de l'ambiance, qui s'ouvre sur toutes celles de la sonothèque : on en
 * change à la main, quel que soit le lieu à l'écran. La nouvelle arrive en
 * fondu enchaîné, comme d'une tuile.
 */
function ChoixAmbiance({ nom, sonId }: { nom: string | null; sonId: number | null }): JSX.Element {
  const liste = useSons((x) => x.liste)
  const [ouvert, setOuvert] = useState(false)
  const [q, setQ] = useState('')
  useEchap(() => setOuvert(false), ouvert)
  const mot = q.trim().toLowerCase()
  const ambiances = liste
    .filter((x) => x.nature === 'ambiance' && x.fichiers.length)
    .filter((x) => !mot || `${x.nom} ${x.planche}`.toLowerCase().includes(mot))
    .sort((a, b) => a.planche.localeCompare(b.planche, 'fr') || a.nom.localeCompare(b.nom, 'fr'))

  return (
    <span className="cd-amb-hote">
      <button
        className="cd-amb-nom"
        aria-expanded={ouvert}
        title={nom ? `${nom} — changer d’ambiance` : 'Choisir une ambiance'}
        onClick={() => setOuvert((o) => !o)}
      >
        <span className="cd-amb-txt">{nom ?? 'Aucune ambiance'}</span>
        <span className="cd-amb-fl" aria-hidden>
          ▾
        </span>
      </button>
      {ouvert ? (
        <>
          <span className="cd-amb-fond" onClick={() => setOuvert(false)} />
          <span className="spx-menu cd-amb-menu" role="menu">
            <span className="eyebrow">Changer d’ambiance</span>
            {liste.filter((x) => x.nature === 'ambiance').length > 8 ? (
              <input
                className="spx-cherche"
                type="search"
                autoFocus
                placeholder="Chercher une ambiance…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            ) : null}
            <span className="cd-amb-liste">
              {ambiances.map((x) => (
                <button
                  key={x.id}
                  role="menuitem"
                  className={x.id === sonId ? 'on' : ''}
                  onClick={() => {
                    setOuvert(false)
                    void window.jdr.regieSon.ambiance(x.id)
                  }}
                >
                  <span className="emo">{emojiDe(x)}</span>
                  <span className="nm">{x.nom || 'Sans nom'}</span>
                  {x.planche ? <small>{x.planche}</small> : null}
                </button>
              ))}
              {!ambiances.length ? (
                <span className="spx-rien">
                  {mot ? 'Rien ne correspond.' : 'Aucune ambiance dans la sonothèque.'}
                </span>
              ) : null}
            </span>
          </span>
        </>
      ) : null}
    </span>
  )
}
