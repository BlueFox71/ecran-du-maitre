/**
 * Les avatars du maître du jeu que l'application fournit : une silhouette
 * sans visage par univers, pour qui ne veut pas montrer le sien.
 *
 * Le réglage ne retient que `avatar:<id>`, jamais l'adresse du fichier : celle
 * que Vite donne change d'une version à l'autre, et chaque fenêtre (régie,
 * écran des joueurs, portables) la retrouve ici, dans son propre paquet.
 */
import fantomes from '../assets/avatars-mj/fantomes.png'
import fantasy from '../assets/avatars-mj/fantasy.png'
import heroique from '../assets/avatars-mj/heroique.png'
import cosmique from '../assets/avatars-mj/cosmique.png'
import spaceOpera from '../assets/avatars-mj/space-opera.png'
import cyberpunk from '../assets/avatars-mj/cyberpunk.png'
import western from '../assets/avatars-mj/western.png'
import pirates from '../assets/avatars-mj/pirates.png'
import classique from '../assets/avatars-mj/classique.png'

export interface AvatarMj {
  id: string
  /** L'univers qu'il évoque, écrit sous la vignette. */
  nom: string
  url: string
}

export const AVATARS_MJ: AvatarMj[] = [
  { id: 'classique', nom: 'Maître du jeu', url: classique },
  { id: 'fantomes', nom: 'Chasse aux fantômes', url: fantomes },
  { id: 'fantasy', nom: 'Fantasy', url: fantasy },
  { id: 'heroique', nom: 'Fantasy héroïque', url: heroique },
  { id: 'cosmique', nom: 'Horreur cosmique', url: cosmique },
  { id: 'space-opera', nom: 'Space opera', url: spaceOpera },
  { id: 'cyberpunk', nom: 'Cyberpunk', url: cyberpunk },
  { id: 'western', nom: 'Western', url: western },
  { id: 'pirates', nom: 'Pirates', url: pirates }
]

/** L'adresse à montrer pour l'image du MJ, quelle qu'en soit la source. */
export function urlPortraitMj(image: string | null | undefined): string | null {
  if (!image) return null
  if (image.startsWith('avatar:')) return AVATARS_MJ.find((a) => `avatar:${a.id}` === image)?.url ?? null
  return image
}
