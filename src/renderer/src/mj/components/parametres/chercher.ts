// Recherche dans les réglages : une fonction pure, sans React, pour la tester seule.

export interface Cherchable {
  nom: string
  aide?: string
  // Synonymes que le MJ pourrait taper sans connaître le libellé exact.
  mots: string[]
  // « Section › Page », affiché sous le résultat.
  chemin: string
}

// Minuscules, sans accents, coupé sur tout ce qui n'est pas lettre ou chiffre
// (apostrophes comprises : « l’ambiance » donne « l » et « ambiance »).
export function normaliser(t: string): string[] {
  return t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

// Petits mots retirés de la requête seulement : « volume du son » doit trouver
// « Volume de l’ambiance » sans qu'un « du » ne fasse tout échouer.
const PETITS_MOTS = new Set([
  'de', 'du', 'des', 'd', 'la', 'le', 'les', 'l', 'un', 'une',
  'et', 'a', 'au', 'aux', 'en', 'pour', 'sur',
])

// Chaque mot de la requête doit être le début d'un des mots visés.
const tousTrouves = (requete: string[], mots: string[]): boolean =>
  requete.every((q) => mots.some((m) => m.startsWith(q)))

// Rang : 0 si le nom suffit, 1 avec les synonymes, 2 avec l'aide ou le chemin.
// Le tri est stable : à rang égal, l'ordre du registre départage.
export function chercher<T extends Cherchable>(liste: T[], q: string): T[] {
  const requete = normaliser(q).filter((m) => !PETITS_MOTS.has(m))
  if (requete.length === 0) return []
  const nom = (c: T): string[] => normaliser(c.nom)
  const avecMots = (c: T): string[] => [...nom(c), ...c.mots.flatMap(normaliser)]
  const tout = (c: T): string[] => [
    ...avecMots(c),
    ...normaliser(c.aide ?? ''),
    ...normaliser(c.chemin),
  ]
  const rang = (c: T): number =>
    tousTrouves(requete, nom(c)) ? 0 : tousTrouves(requete, avecMots(c)) ? 1 : 2
  return liste
    .filter((c) => tousTrouves(requete, tout(c)))
    .map((c) => ({ c, r: rang(c) }))
    .sort((a, b) => a.r - b.r)
    .map(({ c }) => c)
}
