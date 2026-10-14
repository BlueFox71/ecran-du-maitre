/**
 * La suite du fil d'Ariane, posée par une page qui va plus loin que son entrée
 * au rail : la fiche d'un lieu, son plan.
 *
 * La barre du haut garde une place vide après le dernier maillon ; la page y
 * pose ce qu'elle veut par un portail. Tant qu'elle le fait, le dernier
 * maillon (« Lieux ») devient un lien qui la ramène à sa liste, et le
 * sous-titre (« 37 lieux ») se tait : il parlait de la liste.
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { create } from 'zustand'

export const useSuiteAriane = create<{ retour: (() => void) | null }>(() => ({ retour: null }))

export function SuiteAriane({
  onRetour,
  children
}: {
  /** Revenir à la liste de la page — le clic sur le dernier maillon. */
  onRetour: () => void
  children: React.ReactNode
}): JSX.Element | null {
  const [hote, setHote] = useState<HTMLElement | null>(null)
  const retour = useRef(onRetour)
  retour.current = onRetour

  useEffect(() => {
    /* La barre est montée avant la page : on la trouve au premier passage. */
    setHote(document.getElementById('ariane-suite'))
    useSuiteAriane.setState({ retour: () => retour.current() })
    return () => useSuiteAriane.setState({ retour: null })
  }, [])

  return hote ? createPortal(children, hote) : null
}
