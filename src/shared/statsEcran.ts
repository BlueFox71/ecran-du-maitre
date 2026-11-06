import type { StatsEcran } from './types'

/**
 * Les étapes d'une présentation des statistiques à la table : le titre, les
 * grands chiffres, la répartition, les faits, puis chaque joueur du dernier au
 * meilleur, et enfin tout réuni. Le MJ passe de l'une à l'autre.
 */
export type EtapeStats =
  | { genre: 'titre' }
  | { genre: 'chiffres' }
  | { genre: 'repartition' }
  | { genre: 'faits' }
  | { genre: 'joueur'; i: number }
  | { genre: 'tout' }

export function etapesStats(stats: StatsEcran): EtapeStats[] {
  return [
    { genre: 'titre' },
    { genre: 'chiffres' },
    { genre: 'repartition' },
    ...(stats.faits.length ? [{ genre: 'faits' } as const] : []),
    ...stats.joueurs.map((_, i) => ({ genre: 'joueur', i }) as const),
    { genre: 'tout' }
  ]
}

/** Ce que le pupitre du MJ annonce : « Joueurs — 2 sur 4 ». */
export function libelleEtape(e: EtapeStats, stats: StatsEcran): string {
  switch (e.genre) {
    case 'titre':
      return 'Le titre'
    case 'chiffres':
      return 'Les grands chiffres'
    case 'repartition':
      return 'La répartition'
    case 'faits':
      return 'Les faits'
    case 'joueur':
      return `Joueurs — ${e.i + 1} sur ${stats.joueurs.length} · ${stats.joueurs[e.i].nom}`
    case 'tout':
      return 'Tout réuni'
  }
}
