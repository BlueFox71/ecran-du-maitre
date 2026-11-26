/**
 * Les animations des outils qui parlent, réglées sur l'horloge du poste.
 *
 * Un passage du livre et un trajet de la goutte partent d'un instant donné par
 * le poste du MJ (`debut`). Chaque écran — la fenêtre du MJ, la table, un
 * téléphone qui arrive en retard — calcule où en est l'animation à son
 * instant à lui : ils montrent tous la même chose, et un téléphone qui se
 * reconnecte retrouve le passage là où il en est. Le hasard d'une main qui
 * écrit est donc fixé d'avance, tiré du numéro du passage.
 */
import { useEffect, useState } from 'react'
import type { Goutte, Passage } from '@shared/parole'
import { delaiLettre } from '../../mj/chasse/ecriture'
import { REPOS, TOUTES_LES_CASES, dureeTrajet, pointDuTrajet, type Case } from '../../mj/chasse/spiritisme'

/** La vitesse de la main, comme le curseur de la simulation au milieu. */
const VITESSE = 0.5

/** Un nombre de 0 à 1, toujours le même pour une même graine. */
export function hasardFixe(graine: number): number {
  const x = Math.sin(graine * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

/** Le temps de chaque lettre d'un passage, en ms. */
function delais(p: Passage): number[] {
  return Array.from(p.texte).map((l, i) => delaiLettre(l, VITESSE, hasardFixe(p.id * 1000 + i)))
}

/** Le temps qu'il faut à la main pour écrire tout le passage. */
export function dureePassage(p: Passage): number {
  return delais(p).reduce((a, b) => a + b, 0)
}

/**
 * Combien de lettres du passage sont tracées à l'instant `maintenant`, s'il a
 * commencé à `debut` (son départ effectif, voir `calendrier`).
 */
export function lettresEcrites(p: Passage, debut: number, maintenant: number): number {
  let t = debut
  let n = 0
  for (const d of delais(p)) {
    t += d
    if (t > maintenant) break
    n++
  }
  return n
}

/** Les passages dans l'ordre, chacun partant au plus tôt quand le précédent est fini. */
export function calendrier(pages: Passage[]): { p: Passage; debut: number }[] {
  const out: { p: Passage; debut: number }[] = []
  let libre = -Infinity
  for (const p of pages) {
    const debut = Math.max(p.debut, libre)
    out.push({ p, debut })
    libre = debut + dureePassage(p)
  }
  return out
}

const caseDe = (id: string): Case => TOUTES_LES_CASES.find((c) => c.id === id) ?? REPOS

/** Où est la goutte à l'instant `maintenant` (pixels de la photo), et de combien elle penche. */
export function positionGoutte(g: Goutte | null, maintenant: number): { x: number; y: number; angle: number } {
  if (!g) return { x: REPOS.x, y: REPOS.y, angle: -4 }
  const de = caseDe(g.de)
  const vers = caseDe(g.vers)
  const duree = dureeTrajet(de, vers, 1)
  const t = Math.max(0, Math.min(1, (maintenant - g.debut) / duree))
  /* La même courbe et le même port de tête partout : tirés de l'instant de départ. */
  const courbure = (hasardFixe(g.debut) - 0.5) * 0.35
  const angleDepart = (hasardFixe(g.debut - 1) - 0.5) * 14
  const angleArrivee = (hasardFixe(g.debut + 1) - 0.5) * 14
  const p = pointDuTrajet(de, vers, t, courbure)
  const elan = Math.sin(Math.PI * t) * Math.max(-10, Math.min(10, (vers.x - de.x) / 40))
  return { x: p.x, y: p.y, angle: angleDepart + (angleArrivee - angleDepart) * t + elan }
}

/** La fin du trajet de la goutte (pour savoir quand on peut cesser d'animer). */
export function finGoutte(g: Goutte): number {
  return g.debut + dureeTrajet(caseDe(g.de), caseDe(g.vers), 1)
}

/**
 * L'instant présent, sur l'horloge du poste (`decalage` : ce qu'il faut
 * ajouter à l'horloge de cet appareil), rafraîchi à chaque image tant que
 * `actif` — et figé sinon, pour ne rien redessiner pour rien.
 */
export function useMaintenant(actif: boolean, decalage = 0): number {
  const [t, setT] = useState(() => Date.now() + decalage)
  useEffect(() => {
    setT(Date.now() + decalage)
    if (!actif) return
    let image = requestAnimationFrame(function battre() {
      setT(Date.now() + decalage)
      image = requestAnimationFrame(battre)
    })
    return () => cancelAnimationFrame(image)
  }, [actif, decalage])
  return t
}
