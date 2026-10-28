/**
 * Le surligneur du Paravent, sans écran ni base : ce que devient un texte
 * surligné quand on y passe le feutre, et où retrouver un passage quand le
 * texte a été réécrit depuis.
 *
 * Un surlignage ne vit pas dans le texte : il en note les bornes dans le texte
 * brut (ce qu'on lit, sans la mise en forme), et le passage qu'elles tenaient.
 */

export type Sorte = 'item' | 'beat' | 'place' | 'carte' | 'scenario' | 'character' | 'objet'

/** « item:12:body » : le texte propriétaire, jamais l'endroit où on le lit. */
export type Cible = string

export const cible = (sorte: Sorte, id: number, champ: string): Cible => `${sorte}:${id}:${champ}`

/** debut/fin : décalages dans le texte brut du champ ; cite : ce qu'il y avait entre les deux. */
export interface Plage {
  debut: number
  fin: number
  cite: string
}

/**
 * Un glissé de feutre sur [debut, fin[. S'il commence dans du surligné, il
 * dé-surligne ce qu'il couvre (en coupant au besoin) ; sinon il surligne, et
 * fond en un seul ce qui chevauche ou touche. `effacer` impose le sens : sur
 * un glissé à cheval sur plusieurs textes, c'est le premier qui décide.
 */
export function basculer(plages: Plage[], debut: number, fin: number, texte: string, effacer?: boolean): Plage[] {
  const borne = (n: number): number => Math.min(texte.length, Math.max(0, n))
  const a = borne(Math.min(debut, fin))
  const b = borne(Math.max(debut, fin))
  if (a === b) return plages
  const retirer = effacer ?? plages.some((p) => p.debut <= a && a < p.fin)

  let bornes: [number, number][]
  if (retirer) {
    bornes = plages.flatMap((p): [number, number][] =>
      p.fin <= a || p.debut >= b
        ? [[p.debut, p.fin]]
        : ([
            [p.debut, a],
            [b, p.fin]
          ] as [number, number][]).filter(([d, f]) => f > d)
    )
  } else {
    let [d, f] = [a, b]
    bornes = []
    for (const p of plages) {
      if (p.fin < d || p.debut > f) bornes.push([p.debut, p.fin])
      else [d, f] = [Math.min(d, p.debut), Math.max(f, p.fin)]
    }
    bornes.push([d, f])
  }
  return bornes
    .sort((x, y) => x[0] - y[0])
    .map(([d, f]) => ({ debut: d, fin: f, cite: texte.slice(d, f) }))
}

/**
 * Où montrer chaque surlignage dans le texte tel qu'il est maintenant. Un
 * passage resté en place y reste ; déplacé par une réécriture, on le reprend
 * à l'occurrence la plus proche de son ancienne place ; disparu, on ne montre
 * plus rien plutôt que de surligner le mauvais mot.
 */
export function placer(plages: Plage[], texte: string): { debut: number; fin: number }[] {
  const places: { debut: number; fin: number }[] = []
  for (const p of plages) {
    if (!p.cite) continue
    if (texte.slice(p.debut, p.fin) === p.cite) {
      places.push({ debut: p.debut, fin: p.fin })
      continue
    }
    let meilleur = -1
    for (let i = texte.indexOf(p.cite); i !== -1; i = texte.indexOf(p.cite, i + 1))
      if (meilleur === -1 || Math.abs(i - p.debut) < Math.abs(meilleur - p.debut)) meilleur = i
    if (meilleur !== -1) places.push({ debut: meilleur, fin: meilleur + p.cite.length })
  }
  return places
}
