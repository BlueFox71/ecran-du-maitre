/**
 * Le texte d'un document sans sa mise en forme : ce qu'on lirait dans le Bloc-
 * notes. Les paragraphes et les titres gardent leur ligne, les listes leurs
 * tirets, un tag de personnage son nom, une intervention des joueurs son
 * repère entre crochets. Écrit pour le HTML que produit l'éditeur (TipTap),
 * pas pour n'importe quelle page du web.
 */
export function htmlEnTexte(html: string): string {
  const t = html
    .replace(/\r?\n/g, ' ')
    // repère du MJ : on le garde lisible, entre crochets
    .replace(/<div[^>]*data-type="intervention"[^>]*>(.*?)<\/div>/gi, '\n[$1]\n')
    // un paragraphe dans une liste ou une case n'ouvre pas de ligne de plus
    .replace(/<\/p>\s*<\/div>\s*<\/li>/gi, '</li>')
    .replace(/<\/p>\s*(<\/(li|td|th)>)/gi, '$1')
    .replace(/<\/?(tbody|thead)[^>]*>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<hr[^>]*>/gi, '\n———\n')
    // une case à cocher garde son état : - [ ] à faire, - [x] fait
    .replace(/<li[^>]*data-checked="true"[^>]*>/gi, '\n- [x] ')
    .replace(/<li[^>]*data-checked="false"[^>]*>/gi, '\n- [ ] ')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/t[dh]>\s*(?=<t[dh])/gi, '\t')
    .replace(/<\/(p|h[1-6]|blockquote|tr|ul|ol|table|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&')
  return (
    t
      .split('\n')
      .map((l) => l.replace(/[ \t]+$/g, '').replace(/^ +/, ''))
      .join('\n')
      // pas plus d'une ligne blanche d'affilée
      .replace(/\n{3,}/g, '\n\n')
      .trim() + '\n'
  )
}
