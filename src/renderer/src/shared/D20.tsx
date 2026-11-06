import { useEffect, useRef, useState } from 'react'
import { naturel } from '@shared/jet'
import './d20.css'

/** Le temps que met le dé à tomber, rebondir et se poser. */
export const CHUTE_MS = 1800

/**
 * Un d20 à facettes qui tombe du coin, rebondit et se pose sur sa face.
 *
 * Il prend la couleur du joueur : `--pion-ring` (les classes `c-*`) ou
 * `--d20-couleur` posés par qui l'affiche ; l'or à défaut.
 *
 * Le même dé sert au téléphone du joueur et à l'écran de la table : la table
 * voit tomber exactement ce que le joueur a vu tomber. Les faces défilent
 * pendant la chute, puis la valeur tirée par le poste du MJ se fige. Un 20
 * naturel s'allume d'or, un 1 tourne au rouge — une fois posé, pas avant.
 *
 * L'animation se joue une fois, au montage : rediffuser l'état de l'écran ne
 * relance pas le dé, tant que sa clé ne change pas.
 */
export function D20({
  valeur,
  onPose,
  sansChute,
  className
}: {
  valeur: number
  /** Déjà vu tomber dans cette fenêtre : on le montre posé, sans rejouer la chute. */
  sansChute?: boolean
  /** Le dé vient de se poser : c'est le moment de montrer le total. */
  onPose?: () => void
  className?: string
}): JSX.Element {
  const [face, setFace] = useState(() => 1 + Math.floor(Math.random() * 20))
  const [pose, setPose] = useState(false)
  const rappel = useRef(onPose)
  rappel.current = onPose

  useEffect(() => {
    const finir = (): void => {
      setFace(valeur)
      setPose(true)
      rappel.current?.()
    }
    if (sansChute || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finir()
      return
    }
    /* Les faces défilent tant que le dé roule, puis la vraie valeur s'impose
       avant les derniers rebonds : on lit le chiffre pendant qu'il se cale. */
    const roule = setInterval(() => setFace(1 + Math.floor(Math.random() * 20)), 75)
    const fige = setTimeout(() => {
      clearInterval(roule)
      setFace(valeur)
    }, CHUTE_MS * 0.62)
    const fin = setTimeout(finir, CHUTE_MS)
    return () => {
      clearInterval(roule)
      clearTimeout(fige)
      clearTimeout(fin)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const nat = pose ? naturel(valeur) : null
  return (
    <div
      className={['d20', sansChute ? 'd20-sans-chute' : '', pose ? 'd20-pose' : '', nat ? `d20-${nat}` : '', className ?? '']
        .filter(Boolean)
        .join(' ')}
      role="img"
      aria-label={pose ? `d20 : ${valeur}` : 'd20 qui roule'}
    >
      {/* L'ombre au sol : petite et pâle quand le dé est haut, nette quand il touche. */}
      <span className="d20-ombre" aria-hidden="true" />
      {/* L'onde du choc, à la couleur du joueur, quand il se pose. */}
      <span className="d20-onde" aria-hidden="true" />
      {/* Deux étages : le vol porte l'avancée de gauche à droite, le saut la
          hauteur, la rotation et l'écrasement. Séparés, ils dessinent un arc
          — ensemble, le dé filait en ligne droite. */}
      <div className="d20-vol">
        <div className="d20-saut">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          {/* Les facettes autour de la face : plus claires en haut, plus sombres
              en bas — la lumière vient d'en haut à gauche. */}
          <polygon className="d20-f d20-f-hg" points="50,3 50,22 22,68 7,27" />
          <polygon className="d20-f d20-f-hd" points="50,3 93,27 78,68 50,22" />
          <polygon className="d20-f d20-f-g" points="7,27 22,68 7,73" />
          <polygon className="d20-f d20-f-d" points="93,27 93,73 78,68" />
          <polygon className="d20-f d20-f-bg" points="7,73 22,68 50,97" />
          <polygon className="d20-f d20-f-bd" points="93,73 50,97 78,68" />
          <polygon className="d20-f d20-f-b" points="22,68 78,68 50,97" />
          <polygon className="d20-face" points="50,22 78,68 22,68" />
          <polygon className="d20-contour" points="50,3 93,27 93,73 50,97 7,73 7,27" />
          {/* Un reflet sur l'arête haute. */}
          <polyline className="d20-reflet" points="12,29 50,7 88,29" />
          <text x="50" y="60" textAnchor="middle">
            {face}
          </text>
        </svg>
        </div>
      </div>
    </div>
  )
}
