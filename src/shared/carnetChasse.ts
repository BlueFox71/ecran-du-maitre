/**
 * Le carnet des chasseurs : sur son téléphone, chaque joueur entoure un indice
 * qu'il a constaté et barre ce qu'il a écarté — et fait de même avec les types
 * d'entités, comme dans le journal de Phasmophobia.
 *
 * Un pense-bête, rien de plus. Le carnet ne croise rien, ne barre rien tout
 * seul et ne compte rien : c'est en lisant le livre des fantômes que la table
 * trouve l'entité. C'est le cœur de la demande, et la raison pour laquelle ce
 * module ne porte aucune table « entité × indices ».
 */

export type GenreCarnet = 'indice' | 'entite'
export type EtatMarque = 'entoure' | 'barre'

/** Une ligne du carnet : un indice ou un type d'entité, propre à la campagne. */
export interface ElementCarnet {
  id: number
  genre: GenreCarnet
  nom: string
}

/** Ce qu'un personnage a fait d'une ligne, pour la séance en cours. */
export interface MarqueCarnet {
  characterId: number
  elementId: number
  etat: EtatMarque
}

/** Qui a marqué : de quoi dessiner sa pastille, à la couleur de son pion. */
export interface JoueurCarnet {
  characterId: number
  nom: string
  color: string
  initiales: string
}

/**
 * Ce qu'un téléphone et le MJ reçoivent : les lignes, les marques de la séance
 * (des personnages présents seulement), et qui est qui.
 */
export interface CarnetVu {
  elements: ElementCarnet[]
  marques: MarqueCarnet[]
  joueurs: JoueurCarnet[]
}

/**
 * Les indices de départ, tirés du livre des fantômes de la séance 5 et
 * choisis par Jules le 26/11/2026. « Apparition visible », « Chute rapide de
 * santé mentale », puis (27/11) « Détecteur de mouvement », « Voix et
 * murmures » et « Objets manipulés ou lancés » en ont été écartés exprès.
 */
export const INDICES_DEPART: readonly string[] = [
  'EMF élevé',
  'Spirit Box',
  'Températures glaciales',
  'Empreintes UV',
  'Traces dans le sel',
  'Orbes sur caméra',
  'Écriture automatique',
  'Planche Ouija',
  'Polaroïd / miroir'
]

/** Les entités du livre, dans son ordre. */
export const ENTITES_DEPART: readonly string[] = [
  'Fantôme',
  'Esprit',
  'Poltergeist',
  'Ombre',
  'Revenant',
  'Banshee',
  'Spectre',
  'Djinn',
  'Yurei',
  'Oni',
  'Yokai',
  'Hantu',
  'Goryo',
  'Onryo',
  'Les Jumeaux',
  'Obake',
  'Deogen',
  'Démon'
]

/** Un toucher : rien → entouré → barré → rien. */
export function marqueSuivante(e: EtatMarque | null): EtatMarque | null {
  return e === null ? 'entoure' : e === 'entoure' ? 'barre' : null
}
