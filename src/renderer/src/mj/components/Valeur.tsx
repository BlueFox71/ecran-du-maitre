/**
 * La valeur d'un curseur, qu'on peut aussi taper.
 *
 * Un curseur va vite mais vise mal : 16,5 % de clair se trouve à la souris en
 * trois essais. À côté de chaque curseur de l'application, la valeur affichée
 * est donc un champ : on clique, on tape, Entrée — ou on quitte le champ.
 * Échap renonce ; les flèches haut et bas avancent d'un cran. La virgule vaut
 * le point, et ce qui sort des bornes du curseur y est ramené.
 *
 * Hors saisie, le champ se lit comme l'ancien chiffre : la valeur et son
 * unité, ou ce que `affiche` en dit (« ∞ », « tout autour »).
 */
import { useRef, useState } from 'react'

export function Valeur({
  value,
  min,
  max,
  step = 1,
  unite = '',
  decimales = 0,
  affiche,
  onChange,
  className = '',
  disabled,
  label
}: {
  value: number
  min: number
  max: number
  step?: number
  /** Collée au chiffre affiché : « % », « ° »… avec son espace s'il en faut une. */
  unite?: string
  decimales?: number
  /** Ce que le champ montre hors saisie, à la place du chiffre et de l'unité. */
  affiche?: (v: number) => string
  onChange: (v: number) => void
  className?: string
  disabled?: boolean
  label?: string
}): JSX.Element {
  /* `null` hors saisie : le champ montre alors la valeur du moment. */
  const [brouillon, setBrouillon] = useState<string | null>(null)
  /* Entrée et Échap quittent le champ ; la sortie ne doit alors rien refaire.
     Un drapeau plutôt que l'état : il est lu dans le même tour. */
  const regle = useRef(false)
  const chiffre = (v: number): string => v.toFixed(decimales)
  const montre = affiche ? affiche(value) : `${chiffre(value)}${unite}`
  const texte = brouillon ?? montre

  const poser = (v: number): void => {
    const borne = Math.min(max, Math.max(min, v))
    if (borne !== value) onChange(borne)
  }

  const valider = (): void => {
    if (regle.current) {
      regle.current = false
      return
    }
    if (brouillon === null) return
    const n = Number(brouillon.replace(',', '.').replace(/[^0-9.+-]/g, ''))
    setBrouillon(null)
    if (brouillon.trim() !== '' && Number.isFinite(n)) poser(n)
  }

  return (
    <input
      className={`valeur-saisie ${className}`}
      type="text"
      inputMode="decimal"
      value={texte}
      disabled={disabled}
      aria-label={label}
      title="Clique pour taper la valeur — Entrée pour la poser, Échap pour renoncer"
      /* La largeur suit le texte : le champ prend la place de l'ancien chiffre. */
      style={{ width: `${Math.max(3, texte.length) + 1}ch` }}
      onFocus={(e) => {
        setBrouillon(chiffre(value))
        const champ = e.currentTarget
        requestAnimationFrame(() => champ.select())
      }}
      onChange={(e) => setBrouillon(e.target.value)}
      onBlur={valider}
      /* Un clic dans le champ ne doit pas aller jusqu'au curseur voisin, ni à
         la carte qui est souvent dessous. */
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') {
          e.preventDefault()
          valider()
          regle.current = true
          e.currentTarget.blur()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          setBrouillon(null)
          regle.current = true
          e.currentTarget.blur()
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault()
          const base = Number((brouillon ?? chiffre(value)).replace(',', '.'))
          const suite = (Number.isFinite(base) ? base : value) + (e.key === 'ArrowUp' ? step : -step)
          const borne = Math.min(max, Math.max(min, suite))
          setBrouillon(chiffre(borne))
          poser(borne)
        }
      }}
    />
  )
}
