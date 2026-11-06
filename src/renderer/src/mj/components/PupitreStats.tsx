import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { etapesStats, libelleEtape } from '@shared/statsEcran'
import type { SlidePayload } from '@shared/types'
import { IconPrecedent, IconStop, IconSuivant } from './Icons'

type SlideStats = Extract<SlidePayload, { type: 'statistiques' }>

/**
 * Le pupitre de la présentation des statistiques : il flotte au bas de la
 * fenêtre du MJ tant qu'elles sont sur l'écran des joueurs, où qu'on soit dans
 * l'application. Le MJ passe d'une étape à l'autre quand il a fini de
 * commenter — les flèches ← → du clavier aussi. Revenir en arrière pose
 * l'étape sans rejouer son entrée.
 */
export function PupitreStats(): JSX.Element | null {
  const display = useStore((s) => s.display)
  const toast = useStore((s) => s.toast)
  const slide = display?.slide.type === 'statistiques' ? display.slide : null
  const etapes = slide ? etapesStats(slide.stats) : []
  const i = slide ? Math.max(0, Math.min(slide.etape, etapes.length - 1)) : 0

  const aller = (sens: 1 | -1): void => {
    if (!slide) return
    const cible = i + sens
    if (cible < 0 || cible >= etapes.length) return
    if (display?.frozen) {
      toast('L’écran des joueurs est gelé : dégèle-le pour avancer.', true)
      return
    }
    const suite: SlideStats = { ...slide, etape: cible, anime: sens > 0 }
    void window.jdr.display.show(suite)
  }
  const allerRef = useRef(aller)
  allerRef.current = aller

  /* Les joueurs peuvent-ils emporter ces statistiques en image sur leur
     téléphone ? Le poste s'en souvient : on relit à l'ouverture. */
  const [partage, setPartage] = useState(false)
  const actif = slide !== null
  useEffect(() => {
    if (actif) void window.jdr.mobile.statsPartagees().then(setPartage)
  }, [actif])
  const basculerPartage = async (): Promise<void> => {
    if (!slide) return
    const oui = await window.jdr.mobile.partagerStats(partage ? null : slide.stats)
    setPartage(oui)
    toast(
      oui
        ? 'Les joueurs peuvent enregistrer ces statistiques — onglet Jet de leur téléphone.'
        : 'Les statistiques ne sont plus enregistrables par les joueurs.'
    )
  }

  useEffect(() => {
    if (!actif) return
    const touche = (e: KeyboardEvent): void => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
      const el = e.target as HTMLElement | null
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return
      e.preventDefault()
      allerRef.current(e.key === 'ArrowRight' ? 1 : -1)
    }
    window.addEventListener('keydown', touche)
    return () => window.removeEventListener('keydown', touche)
  }, [actif])

  if (!slide) return null
  const derniere = i === etapes.length - 1
  return (
    <div className="pupitre-stats" role="toolbar" aria-label="Présentation des statistiques">
      <span className="ps-quoi">
        <span className="ps-sur">Statistiques à l’écran · {i + 1}/{etapes.length}</span>
        <b>{libelleEtape(etapes[i], slide.stats)}</b>
      </span>
      <button
        type="button"
        className="btn btn-sm"
        disabled={i === 0}
        title="Étape précédente (←)"
        onClick={() => aller(-1)}
      >
        <IconPrecedent />
        Précédent
      </button>
      <button
        type="button"
        className="btn btn-sm btn-brass"
        disabled={derniere}
        title="Étape suivante (→)"
        onClick={() => aller(1)}
      >
        {derniere ? 'Fin' : 'Suivant'}
        <IconSuivant />
      </button>
      {/* Tout est révélé : le MJ peut laisser les joueurs les emporter. */}
      {derniere ? (
        <label
          className="coche ps-partage"
          title="Sur leur téléphone (onglet Jet), chaque joueur pourra enregistrer en image les statistiques du groupe et les siennes"
        >
          <input type="checkbox" checked={partage} onChange={() => void basculerPartage()} />
          <span>Enregistrables par les joueurs</span>
        </label>
      ) : null}
      <button
        type="button"
        className="btn btn-sm btn-ghost"
        title="Rendre aux joueurs l’écran d’avant"
        onClick={() => void window.jdr.display.arreterPresentation()}
      >
        <IconStop />
        Arrêter
      </button>
    </div>
  )
}
