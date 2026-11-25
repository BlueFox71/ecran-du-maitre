/**
 * Les valeurs « vivantes » des appareils : ce que l'écran de l'appareil montre
 * autour de la valeur réelle (tremblement de l'EMF, glissement et bruit du
 * thermomètre). Rien de sonore ici : le son se branche à part, depuis le PC.
 */
import { useEffect, useRef, useState } from 'react'
import { borner } from './emf'
import { bornerTemperature, rapprocher } from './temperature'

/** L'EMF rafraîchit son niveau environ dix fois par seconde. */
const PAS_EMF_MS = 90
/** Un vrai thermomètre infrarouge ne rafraîchit pas en continu. */
const RAFRAICHISSEMENT_MS = 500
/** Vitesse par défaut du glissement du thermomètre, en °C par seconde. */
const VITESSE_THERMO = 1.5

/**
 * Le niveau affiché par l'EMF : la cible, avec un léger tremblement dès
 * qu'elle dépasse 0,3. Éteint : 0.
 */
export function useNiveauVivant(cible: number, allume: boolean): number {
  const [affiche, setAffiche] = useState(0)
  const cibleRef = useRef(cible)
  cibleRef.current = cible

  useEffect(() => {
    if (!allume) {
      setAffiche(0)
      return
    }
    let cadre = 0
    let dernier = 0
    const boucle = (t: number): void => {
      cadre = requestAnimationFrame(boucle)
      if (t - dernier < PAS_EMF_MS) return
      dernier = t
      const base = cibleRef.current
      const tremble = base > 0.3 ? (Math.random() - 0.5) * 0.7 : 0
      setAffiche(borner(base + tremble))
    }
    cadre = requestAnimationFrame(boucle)
    return () => cancelAnimationFrame(cadre)
  }, [allume])

  return affiche
}

/**
 * La température affichée : une valeur « vraie » qui glisse vers la cible
 * (`vitesse` °C par seconde), lue toutes les demi-secondes avec le petit bruit
 * d'un vrai appareil.
 */
export function useTemperatureVivante(cible: number, vitesse: number = VITESSE_THERMO): number {
  const [mesure, setMesure] = useState(cible)
  const vraie = useRef(cible)
  const cibleRef = useRef(cible)
  const vitesseRef = useRef(vitesse)
  cibleRef.current = cible
  vitesseRef.current = vitesse

  useEffect(() => {
    const t = setInterval(() => {
      vraie.current = rapprocher(vraie.current, cibleRef.current, vitesseRef.current, RAFRAICHISSEMENT_MS / 1000)
      setMesure(bornerTemperature(vraie.current + (Math.random() - 0.5) * 0.2))
    }, RAFRAICHISSEMENT_MS)
    return () => clearInterval(t)
  }, [])

  return mesure
}
