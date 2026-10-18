import { useEffect, useState } from 'react'
import type { EchellePlan } from '@shared/types'

/**
 * Remettre les pions d'un lieu à la taille que leur donne l'échelle du plan.
 *
 * Toucher la réglette fait passer le lieu « à la main » ; ce bouton le rend à
 * son échelle — celle fixée au trait, ou estimée d'après les portes. Sans
 * échelle connue, il n'y a rien à retrouver : le bouton le dit au survol.
 */
export function TailleEchelle({
  placeId,
  size,
  onFait
}: {
  placeId: number | null
  /** La taille affichée : quand elle bouge, on relit l'échelle. */
  size: number
  onFait: () => Promise<void>
}): JSX.Element {
  const [ech, setEch] = useState<EchellePlan | null>(null)
  useEffect(() => {
    let vivant = true
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
  }, [placeId, size])

  const connue = ech?.metres != null
  const aLaMain = ech?.pionMain ?? false
  return (
    <button
      className="btn btn-sm"
      disabled={placeId == null || !connue || !aLaMain}
      onClick={async () => {
        if (placeId == null) return
        setEch(await window.jdr.pions.main(placeId, false))
        await onFait()
      }}
      title={
        !connue
          ? 'Ce plan n’a pas d’échelle : fixe-la dans Lieux (au trait, ou par les portes)'
          : aLaMain
            ? `Revenir à la taille de l’échelle du plan (${ech!.metres!.toFixed(0)} m de large)`
            : 'Les pions suivent déjà l’échelle du plan'
      }
    >
      À l’échelle
    </button>
  )
}
