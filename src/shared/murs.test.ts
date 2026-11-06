import { describe, expect, it } from 'vitest'
import { cheminContraint, pasContraint, RAYON_PION, type Barriere, type Pt } from './murs'

const cadre = { w: 1000, h: 700 }
const RAYON = Math.max(cadre.w, cadre.h) * RAYON_PION

/* Un générateur reproductible : la même marche à chaque passage. */
function hasard(graine: number): () => number {
  let s = graine >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

/** Marche au pouce : des pas courts, dans une direction qui dérive. */
function marcher(murs: Barriere[], depart: Pt, n: number, graine: number, rayon: number): Pt[] {
  const r = hasard(graine)
  let p = depart
  let a = r() * Math.PI * 2
  const trace = [p]
  for (let i = 0; i < n; i++) {
    a += (r() - 0.5) * 0.6
    p = pasContraint(murs, p, { x: p.x + Math.cos(a) * 1.7, y: p.y + Math.sin(a) * 1.7 }, cadre, 2, rayon)
    trace.push(p)
  }
  return trace
}

/*
 * Deux cloisons tracées à la main, qui devraient se rejoindre en x = 500 mais
 * laissent une fente de 3 pixels — ce que montrent les vraies cartes aux
 * jonctions. Le pion part à gauche ; à droite, c'est le salon d'à côté.
 */
const fendus: Barriere[] = [
  { a: { x: 500, y: 0 }, b: { x: 500, y: 348.5 } },
  { a: { x: 500, y: 351.5 }, b: { x: 500, y: 700 } }
]
const aDroite = (t: Pt[]): boolean => t.some((p) => p.x > 500)

describe('le pion et les murs', () => {
  it('sans corps, il passait par la fente d’une jonction mal fermée', () => {
    let fuites = 0
    for (let g = 1; g <= 200; g++) if (aDroite(marcher(fendus, { x: 470, y: 350 }, 3000, g, 0))) fuites++
    expect(fuites).toBeGreaterThan(0)
  })

  it('avec son corps, la fente ne le laisse plus passer', () => {
    for (let g = 1; g <= 200; g++)
      expect(aDroite(marcher(fendus, { x: 470, y: 350 }, 3000, g, RAYON))).toBe(false)
  })

  it('une porte étroite reste franchissable', () => {
    /* Un mur percé d'une porte ouverte de 36 pixels, la plus étroite des cartes. */
    const perce: Barriere[] = [
      { a: { x: 500, y: 0 }, b: { x: 500, y: 332 } },
      { a: { x: 500, y: 368 }, b: { x: 500, y: 700 } }
    ]
    let p: Pt = { x: 460, y: 350 }
    for (let i = 0; i < 60; i++) p = pasContraint(perce, p, { x: p.x + 1.7, y: p.y }, cadre, 2, RAYON)
    expect(p.x).toBeGreaterThan(520)
  })

  it('un pion déjà contre un mur peut s’en éloigner', () => {
    const mur: Barriere[] = [{ a: { x: 500, y: 0 }, b: { x: 500, y: 700 } }]
    const colle = { x: 499, y: 350 }
    expect(pasContraint(mur, colle, { x: 490, y: 350 }, cadre, 2, RAYON)).toEqual({ x: 490, y: 350 })
    /* … mais pas s'y enfoncer davantage. */
    expect(pasContraint(mur, colle, { x: 499.8, y: 350 }, cadre, 2, RAYON).x).toBeLessThanOrEqual(499)
  })

  it('il arrive au contact au lieu de s’arrêter à un pas du mur', () => {
    const mur: Barriere[] = [{ a: { x: 500, y: 0 }, b: { x: 500, y: 700 } }]
    const p = pasContraint(mur, { x: 480, y: 350 }, { x: 520, y: 350 }, cadre, 2, RAYON)
    expect(p.x).toBeGreaterThan(500 - RAYON - 1)
    expect(p.x).toBeLessThan(500 - RAYON + 0.01)
  })

  it('le chemin suivi contourne le chambranle là où la corde butait', () => {
    /* Le bout de mur à droite d'une porte ; le pion en fait le tour. */
    const chambranle: Barriere[] = [{ a: { x: 500, y: 300 }, b: { x: 500, y: 700 } }]
    const depart = { x: 480, y: 330 }
    const chemin = [
      { x: 480, y: 290 },
      { x: 520, y: 290 },
      { x: 520, y: 330 }
    ]
    /* La corde, elle, traverse le mur : le poste renvoyait le pion en arrière. */
    expect(pasContraint(chambranle, depart, chemin[2], cadre, 2, RAYON)).not.toEqual(chemin[2])
    expect(cheminContraint(chambranle, depart, chemin, cadre, 2, RAYON)).toEqual(chemin[2])
  })
})
