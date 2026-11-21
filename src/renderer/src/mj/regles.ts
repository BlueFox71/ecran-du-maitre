/**
 * Changer les règles de la table : chasse aux fantômes ou World of Warcraft.
 *
 * Le choix est un réglage de la campagne (`regles`) : il part avec son
 * dossier. Passer à WoW pose aussi la fiche d'Azeroth (PV, ressource, les dix
 * caractéristiques), après avoir gardé l'ancienne fiche de côté pour pouvoir
 * y revenir. Comme la fiche se recadre sur tous les personnages, ce qu'ils
 * avaient dans des cases qui disparaissent se perd : l'appelant demande
 * avant, s'il y a des personnages.
 */
import { useStore } from './store'
import {
  CLE_FICHE_AVANT_WOW,
  FICHE_FANTOMES,
  FICHE_WOW,
  type Regles
} from '@shared/wow'
import type { TemplateSpec } from '@shared/types'

/** La fiche de campagne changerait-elle avec ces règles ? */
export function ficheAChanger(r: Regles): boolean {
  const spec = useStore.getState().sheet?.spec
  if (!spec) return false
  return r === 'wow' ? spec.systeme !== 'wow' : spec.systeme === 'wow'
}

/** Ce qu'il y a à perdre : le nombre de personnages dont la fiche serait recadrée. */
export function personnagesTouches(): number {
  return useStore.getState().characters.length
}


/** La clé de « déjà demandé à l'ouverture » : une par campagne, le temps de la fenêtre. */
export function cleDejaDemande(): string {
  const s = useStore.getState()
  return `regles.demandees:${s.project?.dir ?? ''}:${s.campaign?.id ?? ''}`
}

export async function changerRegles(r: Regles, opts: { fiche: boolean }): Promise<void> {
  const s = useStore.getState()
  if (opts.fiche && s.sheet && ficheAChanger(r)) {
    const { name, spec } = s.sheet
    let suivante: TemplateSpec
    if (r === 'wow') {
      /* L'ancienne fiche est gardée telle quelle : y revenir la rend entière. */
      await s.poserReglage(CLE_FICHE_AVANT_WOW, JSON.stringify(spec))
      suivante = FICHE_WOW
    } else {
      suivante = lireFicheGardee(useStore.getState().reglagesBrut[CLE_FICHE_AVANT_WOW]) ?? FICHE_FANTOMES
    }
    await window.jdr.sheet.save({ name, spec: suivante })
    await useStore.getState().refreshCharacters()
  }
  await useStore.getState().poserReglage('regles', r)
  /* Le module Azeroth n'a plus d'objet hors de WoW. */
  if (r !== 'wow' && useStore.getState().view === 'azeroth') useStore.setState({ view: 'pupitre' })
}

function lireFicheGardee(brut: string | undefined): TemplateSpec | null {
  if (!brut) return null
  try {
    const spec = JSON.parse(brut) as TemplateSpec
    return Array.isArray(spec.gauges) && Array.isArray(spec.stats) ? spec : null
  } catch {
    return null
  }
}
