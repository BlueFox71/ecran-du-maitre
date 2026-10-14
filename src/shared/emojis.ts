/** Les émojis de présentation d'un personnage : cinq au plus, tous différents. */
export const EMOJIS_MAX = 5

/**
 * Ce qu'on garde d'une saisie : les émojis seuls, dans l'ordre, sans doublon,
 * cinq au plus. On découpe en graphèmes et non en caractères : un drapeau, une
 * peau nuancée ou une famille tiennent en plusieurs points de code.
 */
export function emojisDe(texte: string | null | undefined): string[] {
  if (!texte) return []
  const vus: string[] = []
  const decoupe = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  for (const { segment } of decoupe.segment(texte)) {
    if (!/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(segment)) continue
    if (vus.includes(segment)) continue
    vus.push(segment)
    if (vus.length === EMOJIS_MAX) break
  }
  return vus
}
