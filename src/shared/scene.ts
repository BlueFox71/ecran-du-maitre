import type { SlidePayload } from './types'

/**
 * La diapositive montre-t-elle la carte du lieu en scène ?
 *
 * Les pions et l'ombre appartiennent au lieu, et se posent sur **sa** carte.
 * Sans cette garde, le lieu restait en scène quand on basculait sur une autre
 * image — un portrait, une lettre, la côte de nuit — et ses jetons, ses murs
 * et son noir se dessinaient par-dessus, chez le MJ comme chez les joueurs.
 *
 * Un lieu sans carte, lui, garde l'ancienne règle : le MJ pose ses pions sur
 * l'image de son choix, rien ne dit laquelle est la bonne.
 */
export function montreLaCarte(slide: SlidePayload, carte: number | null): boolean {
  if (carte == null) return true
  if (slide.type === 'image' || slide.type === 'video') return slide.itemId === carte
  if (slide.type === 'collage') return slide.cells.some((c) => c?.kind === 'image' && c.itemId === carte)
  return false
}
