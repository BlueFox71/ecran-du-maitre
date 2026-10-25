import { itemById, playerOf, useStore } from './store'
import type { Character } from '@shared/types'

/**
 * Présenter un joueur aux autres : son portrait, son nom et ses émojis partent
 * tout de suite sur l'écran des joueurs, sans passer par la préparation. La
 * fiche du personnage le fait, et le Paravent quand le moment le demande.
 */
export function presenterLeJoueur(ch: Character): void {
  const s = useStore.getState()
  void window.jdr.display.show({
    type: 'presentation',
    characterId: ch.id,
    name: ch.name,
    occupation: [ch.occupation, ageDit(ch.age)].filter(Boolean).join(' · ') || undefined,
    player: playerOf(s, ch.id)?.name ?? ch.player ?? undefined,
    url: itemById(s.allItems, ch.portraitItemId)?.url ?? null,
    color: ch.color,
    emojis: ch.emojis
  })
}

/** Ce personnage est-il présenté en ce moment sur l'écran des joueurs ? */
export function estPresente(chId: number): boolean {
  const d = useStore.getState().display
  const direct = d?.slots[d.liveSlot]
  return direct?.type === 'presentation' && direct.characterId === chId
}

/** « 34 » se lit « 34 ans ». Une fiche d'avant qui portait déjà le mot le garde. */
export function ageDit(age: string | null): string {
  const a = age?.trim()
  if (!a) return ''
  return /^\d+$/.test(a) ? `${a} ans` : a
}
