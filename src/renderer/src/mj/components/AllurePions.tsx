import { useEffect, useState } from 'react'
import { ALLURE_MAX, ALLURE_MIN, type EchellePlan } from '@shared/types'
import { Valeur } from './Valeur'

/** L'événement que reçoit le pilote du MJ quand l'allure d'un plan change. */
export const ALLURE_CHANGEE = 'jdr:allure-changee'

/**
 * La vitesse des pions pilotés au téléphone, réglée depuis la table.
 *
 * C'est l'allure du plan (Lieux › plan › Allure des pions) : la part de la
 * largeur du plan qu'un pion parcourt en une seconde. Elle appartient au plan,
 * donc les pièces d'un même étage la partagent. Le curseur ne l'écrit qu'au
 * lâcher : les téléphones n'ont pas à recevoir chaque cran du glisser.
 */
export function AllurePions({ placeId }: { placeId: number | null }): JSX.Element {
  const [ech, setEch] = useState<EchellePlan | null>(null)
  /* En pour cent, pendant qu'on glisse ; `null` hors glisser. */
  const [glisse, setGlisse] = useState<number | null>(null)

  useEffect(() => {
    let vivant = true
    setGlisse(null)
    if (placeId == null) {
      setEch(null)
      return
    }
    void window.jdr.places.echelle(placeId).then((e) => {
      if (vivant) setEch(e)
    })
    return () => {
      vivant = false
    }
  }, [placeId])

  const poser = async (pourcent: number | null): Promise<void> => {
    if (placeId == null) return
    setEch(await window.jdr.pions.allure(placeId, pourcent === null ? null : pourcent / 100))
    /* Le pilote du MJ, s'il est ouvert, garde l'allure qu'il a lue : on le
       prévient qu'elle a changé. */
    window.dispatchEvent(new Event(ALLURE_CHANGEE))
  }
  const lacher = (): void => {
    if (glisse === null) return
    void poser(glisse)
    setGlisse(null)
  }

  const off = placeId == null || ech == null
  const vue = glisse ?? (ech ? ech.allure * 100 : 12)
  const traverse = Math.round((100 / vue) * 10) / 10
  return (
    <label
      className="size"
      title={`Vitesse des pions pilotés au téléphone sur ce plan : ils le traversent en ${String(traverse).replace('.', ',')} s. Les pièces d’un même étage la partagent.`}
    >
      <span className="eyebrow">Vitesse</span>
      <input
        type="range"
        min={ALLURE_MIN * 100}
        max={ALLURE_MAX * 100}
        step={0.5}
        value={vue}
        disabled={off}
        aria-label="Vitesse des pions pilotés, en part de la largeur du plan par seconde"
        onChange={(e) => setGlisse(Number(e.target.value))}
        onPointerUp={lacher}
        onKeyUp={lacher}
        onBlur={lacher}
      />
      <Valeur
        className="val num"
        value={vue}
        min={ALLURE_MIN * 100}
        max={ALLURE_MAX * 100}
        step={0.5}
        decimales={1}
        unite=" %"
        disabled={off}
        label="Vitesse des pions"
        onChange={(v) => void poser(v)}
      />
    </label>
  )
}
