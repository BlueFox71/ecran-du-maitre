/**
 * Mettre un document de la Bibliothèque sous la main, dans les annexes.
 *
 * On y arrive de trois façons : le bouton « Ajouter » de la page Annexes, le
 * bouton de la fiche d'un fichier dans la Bibliothèque, et le glisser — un
 * fichier de la Bibliothèque lâché sur l'entrée « Annexes » du rail.
 *
 * La Bibliothèque garde son propre glisser (ranger un fichier dans un dossier)
 * dans une référence à elle ; le rail, lui, ne la voit pas. Le fichier tenu
 * voyage donc aussi dans le `dataTransfer`, sous un type à nous.
 */
import type React from 'react'
import { useStore } from './store'
import type { ItemKind } from '@shared/types'

export const GLISSE_ANNEXE = 'application/x-jdr-annexe'

/**
 * Ce qui se consulte en cours de partie : un texte, un PDF, une image, ou un
 * fichier que Windows ouvre (un Word, par exemple). Le son et la vidéo ont
 * leurs propres pages.
 */
export function peutEtreAnnexe(kind: ItemKind): boolean {
  return kind === 'doc' || kind === 'pdf' || kind === 'image' || kind === 'other'
}

/** À poser dans le `onDragStart` d'un fichier de la Bibliothèque. */
export function marquerPourAnnexe(e: React.DragEvent, it: { id: number; kind: ItemKind }): void {
  if (!peutEtreAnnexe(it.kind)) return
  e.dataTransfer.setData(GLISSE_ANNEXE, String(it.id))
  // Le rangement dans un dossier est un déplacement, l'annexe une copie : les deux.
  e.dataTransfer.effectAllowed = 'copyMove'
}

export async function mettreEnAnnexe(itemId: number): Promise<void> {
  const s = useStore.getState()
  if (s.annexes.some((a) => a.id === itemId)) {
    s.toast('Ce document est déjà dans les annexes.')
    return
  }
  await window.jdr.annexes.add(itemId)
  await s.refreshAnnexes()
  const it = useStore.getState().annexes.find((a) => a.id === itemId)
  s.toast(`« ${it?.title ?? 'Document'} » ajouté aux annexes`)
}

/**
 * Les gestes d'une cible qui accepte un document glissé depuis la
 * Bibliothèque. Chromium ne garde une cible que si l'on annule dès
 * `dragenter` ; on n'annule que pour notre type, le reste passe son chemin.
 */
export function cibleAnnexe(): Record<string, (e: React.DragEvent<HTMLElement>) => void> {
  const tenu = (e: React.DragEvent): boolean => e.dataTransfer.types.includes(GLISSE_ANNEXE)
  const survol = (e: React.DragEvent<HTMLElement>): void => {
    if (!tenu(e)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    e.currentTarget.classList.add('drop-annexe')
  }
  return {
    onDragEnter: survol,
    onDragOver: survol,
    onDragLeave: (e) => e.currentTarget.classList.remove('drop-annexe'),
    onDrop: (e) => {
      e.currentTarget.classList.remove('drop-annexe')
      if (!tenu(e)) return
      e.preventDefault()
      const id = Number(e.dataTransfer.getData(GLISSE_ANNEXE))
      if (id) void mettreEnAnnexe(id)
    }
  }
}
