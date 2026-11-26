import { useEffect, useRef } from 'react'
import sonNiveau3 from '../../assets/chasse/emf-niveau3.mp3'
import { useStore } from '../store'
import { useSons } from '../sons'
import { SonEmf } from './emf'
import { SonSpirit } from './spirit'
import { SonCrayon, delaiLettre } from './ecriture'
import { calendrier, hasardFixe } from '../../shared/chasse/temps'
import { REGLAGES_VOIX, type ParoleObjet, type TextePrepare } from '@shared/parole'

/** La radio de chaque spirit box qui grésille, par fiche d'objet : la voix passe par elle. */
const radios = new Map<number, SonSpirit>()
/** Le volume que le moteur donne à chaque radio (distance, murs) × le volume général. */
const bases = new Map<number, number>()
/** Le volume réglé par le MJ pour chaque spirit box, le temps qu'il tient le curseur. */
const volumesEnCours = new Map<number, number>()

/**
 * Régler à l'oreille le volume d'une spirit box : il s'entend tout de suite.
 * `null` : le réglage est enregistré, on revient à celui de la fiche.
 */
export function reglerVolumeSpirit(objetId: number, v: number | null): void {
  if (v === null) return void volumesEnCours.delete(objetId)
  volumesEnCours.set(objetId, v)
  radios.get(objetId)?.setVolume((bases.get(objetId) ?? 0) * v)
}

/** Le débit de la voix de Windows, celui de la simulation par défaut. */
const DEBIT = -2

/**
 * La spirit box dit ce texte : la voix (préparée par Windows, une seconde ou
 * deux) passe dans le grésillement de sa radio, et le texte part vers les
 * téléphones **au moment où elle commence**. `null` : fait ; sinon la raison.
 */
export async function lancerVoix(objetId: number, texte: string, parole: ParoleObjet): Promise<string | null> {
  const t = texte.trim()
  if (!t) return null
  const voix = parole.voix ?? { nom: null, reglages: REGLAGES_VOIX }
  let wav: Uint8Array
  try {
    wav = await window.jdr.spirit.parler(t, voix.nom, DEBIT)
  } catch (e) {
    return `La voix n’a pas pu être préparée : ${e instanceof Error ? e.message : String(e)}`
  }
  const refus = await window.jdr.parole.dire(objetId, t)
  if (refus) return refus
  const radio = radios.get(objetId)
  if (radio) {
    radio.setReglages(voix.reglages)
    await radio.dire(wav)
  }
  return null
}

let crayon: SonCrayon | null = null

/**
 * Une main invisible écrit ce texte dans le livre : le poste l'enregistre et
 * l'horodate, et le PC gratte le papier au rythme exact où les lettres
 * apparaissent sur les téléphones et à la table. `null` : fait ; sinon la raison.
 */
export async function lancerEcriture(objetId: number, t: TextePrepare): Promise<string | null> {
  const refus = await window.jdr.parole.ecrire(objetId, t)
  if (refus) return refus
  const c = calendrier(await window.jdr.parole.pages(objetId))
  const dernier = c[c.length - 1]
  if (!dernier) return null
  /* Chaque lettre à son heure : les mêmes délais que ceux du dessin (`temps.ts`). */
  let quand = dernier.debut - Date.now()
  Array.from(dernier.p.texte).forEach((l, i) => {
    const d = delaiLettre(l, 0.5, hasardFixe(dernier.p.id * 1000 + i))
    if (l.trim())
      setTimeout(() => {
        crayon ??= new SonCrayon()
        crayon.gratter(d)
      }, Math.max(0, quand))
    quand += d
  })
  return null
}

/** Combien de temps une voix devenue muette attend avant d'être rendue. */
const REPIT_MS = 5000

interface Voix {
  son: SonEmf
  /** La voix est muette : elle sera rendue à la fin du répit, sauf si elle se refait entendre. */
  repit: ReturnType<typeof setTimeout> | null
}

/**
 * Le grésillement de chaque EMF en jeu, joué par le PC au volume que calcule
 * le moteur (`gain` : plein en main, sinon selon la distance et les murs
 * jusqu'au pion de joueur le plus proche). Une voix par appareil audible ;
 * devenue muette (hors de portée, hors zone), elle se tait quelques secondes
 * avant d'être rendue — un pion qui longe le bord d'une zone ne la fait pas
 * renaître à chaque pas. Elle part tout de suite quand l'appareil disparaît
 * ou s'éteint. Le « Silence » de la régie les coupe jusqu'au prochain
 * changement du moteur. Pesé par le volume général du MJ, comme le reste.
 * Monté une fois, à côté de la Sonorisation.
 */
export function SonsChasse(): null {
  const chasse = useStore((s) => s.chasse)
  const objets = useStore((s) => s.objets)
  const general = useSons((s) => s.regie)?.general ?? 0.8
  const voix = useRef(new Map<number, Voix>())
  /* L'état du moteur au moment du « Silence » : tant qu'il n'a pas changé, on se tait. */
  const courant = useRef(chasse)
  courant.current = chasse
  const tuSur = useRef<typeof chasse | null>(null)

  const rendre = (id: number): void => {
    const x = voix.current.get(id)
    if (!x) return
    if (x.repit) clearTimeout(x.repit)
    x.son.arreter()
    voix.current.delete(id)
  }

  useEffect(() => {
    const v = voix.current
    const tu = chasse === tuSur.current
    const presents = new Set<number>()
    for (const a of chasse) {
      if (tu || a.outil !== 'emf' || !a.allume) continue
      presents.add(a.placementId)
      let x = v.get(a.placementId)
      if (a.gain <= 0) {
        if (x) {
          x.son.setVolume(0)
          const id = a.placementId
          x.repit ??= setTimeout(() => rendre(id), REPIT_MS)
        }
        continue
      }
      if (!x) {
        x = { son: new SonEmf(sonNiveau3), repit: null }
        v.set(a.placementId, x)
        x.son.setVolume(0)
        x.son.demarrer()
      }
      if (x.repit) {
        clearTimeout(x.repit)
        x.repit = null
      }
      x.son.setNiveau(a.valeur)
      x.son.setVolume(a.gain * general)
    }
    for (const id of [...v.keys()]) if (!presents.has(id)) rendre(id)

    /* Les spirit box allumées et en jeu : leur radio grésille, au volume du moteur. */
    const allumees = new Set<number>()
    for (const a of chasse) {
      if (tu || a.outil !== 'spiritbox' || !a.allume || a.ou === 'ailleurs') continue
      allumees.add(a.objetId)
      let r = radios.get(a.objetId)
      if (!r) {
        r = new SonSpirit()
        radios.set(a.objetId, r)
        r.setVolume(0)
        r.demarrer()
      }
      const base = a.gain * general
      bases.set(a.objetId, base)
      const o = objets.find((x) => x.id === a.objetId)
      r.setVolume(base * (volumesEnCours.get(a.objetId) ?? o?.parole.volume ?? 1))
    }
    for (const [id, r] of [...radios]) {
      if (allumees.has(id)) continue
      r.arreter()
      radios.delete(id)
      bases.delete(id)
    }
  }, [chasse, general, objets])

  useEffect(() => {
    const toutCouper = (): void => {
      for (const id of [...voix.current.keys()]) rendre(id)
      for (const r of radios.values()) r.arreter()
      radios.clear()
    }
    const taire = window.jdr.regieSon.onSilence(() => {
      tuSur.current = courant.current
      toutCouper()
    })
    return () => {
      taire()
      toutCouper()
    }
  }, [])

  return null
}
