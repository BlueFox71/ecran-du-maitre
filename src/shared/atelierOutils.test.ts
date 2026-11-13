import { describe, expect, it } from 'vitest'
import { constructionVide, type Construction, type ObjetPose } from './atelier'
import {
  murSous,
  objetSous,
  ouvertureSous,
  pieceSous,
  rectangle,
  redimensionner,
  solSous,
  appliquerHabillage,
  centreDeCase,
  habillageSous,
  objetsDansRectangle,
  tirerObjet,
  mettreAuPlan,
  tourner,
  tournerGroupe,
  zoneARemplir
} from './atelierOutils'

const terrain = (): Construction => ({ ...constructionVide(), largeur: 20, hauteur: 10 })

describe('rectangle', () => {
  it('rend les quatre coins dans l’ordre, quel que soit le sens du glisser', () => {
    expect(rectangle([5, 4], [1, 2])).toEqual([
      [1, 2],
      [5, 2],
      [5, 4],
      [1, 4]
    ])
  })
  it('un rectangle sans surface n’en est pas un', () => {
    expect(rectangle([1, 2], [1, 6])).toBeNull()
  })
})

describe('solSous', () => {
  it('rend le sol du dessus sous le point', () => {
    const c = terrain()
    c.sols.push(
      { id: 'cour', assetId: 'a', pts: [[0, 0], [20, 0], [20, 10], [0, 10]] },
      { id: 'salon', assetId: 'b', pts: [[2, 2], [8, 2], [8, 8], [2, 8]] }
    )
    expect(solSous(c, [5, 5])?.id).toBe('salon')
    expect(solSous(c, [15, 5])?.id).toBe('cour')
    expect(solSous(c, [25, 5])).toBeNull()
  })
})

describe('pieceSous', () => {
  it('rend le contour de la pièce fermée par les murs bâtis', () => {
    const c = terrain()
    c.murs.push(
      { id: 'ext', assetId: 'x', pts: [[1, 1], [11, 1], [11, 9], [1, 9], [1, 1]], epaisseur: 0.4 },
      { id: 'refend', assetId: 'x', pts: [[6, 1], [6, 9]], epaisseur: 0.4 }
    )
    const p = pieceSous(c, [8, 5])!
    const xs = p.map((q) => q[0])
    expect(Math.min(...xs)).toBeCloseTo(6, 6)
    expect(Math.max(...xs)).toBeCloseTo(11, 6)
  })
  it('hors de toute pièce fermée, rien', () => {
    const c = terrain()
    c.murs.push({ id: 'seul', assetId: 'x', pts: [[1, 1], [11, 1]], epaisseur: 0.4 })
    expect(pieceSous(c, [5, 5])).toBeNull()
  })
  it('un meuble ne ferme pas de pièce', () => {
    const c = terrain()
    c.murs.push({ id: 'ext', assetId: 'x', pts: [[1, 1], [11, 1], [11, 9], [1, 9], [1, 1]], epaisseur: 0.4 })
    c.objets.push({ id: 'lit', assetId: 'l', x: 4, y: 4, l: 2, h: 2, angle: 0, bloquePas: true, bloqueVue: true })
    const p = pieceSous(c, [4, 4])!
    expect(Math.max(...p.map((q) => q[0]))).toBeCloseTo(11, 6)
  })
})

describe('murSous', () => {
  const c = terrain()
  c.murs.push(
    { id: 'a', assetId: 'x', pts: [[1, 1], [9, 1]], epaisseur: 0.4 },
    { id: 'b', assetId: 'x', pts: [[1, 5], [9, 5], [9, 9]], epaisseur: 0.4 }
  )
  it('trouve le mur le plus proche, à la tolérance près', () => {
    expect(murSous(c, [5, 1.2], 0.5)).toEqual({ murId: 'a', sommet: null })
    expect(murSous(c, [5, 3], 0.5)).toBeNull()
  })
  it('près d’un sommet, le dit', () => {
    expect(murSous(c, [9.1, 5.1], 0.5)).toEqual({ murId: 'b', sommet: 1 })
  })
  it('le long du segment, rend aussi où l’on est', () => {
    const r = murSous(c, [9.2, 7], 0.5, true)!
    expect(r.murId).toBe('b')
    expect(r.d).toBeCloseTo((8 + 2) / 12, 6)
  })
})

describe('ouvertureSous', () => {
  const c = terrain()
  c.murs.push({ id: 'm', assetId: 'x', pts: [[0, 2], [10, 2]], epaisseur: 0.4 })
  c.ouvertures.push({ id: 'p', murId: 'm', nature: 'porte', assetId: 'y', d: 0.5, largeur: 2 })
  it('trouve l’ouverture sous le point, sur toute sa largeur', () => {
    expect(ouvertureSous(c, [5.9, 2.1])?.id).toBe('p')
  })
  it('à côté de l’ouverture, rien', () => {
    expect(ouvertureSous(c, [7, 2])).toBeNull()
    expect(ouvertureSous(c, [5, 3])).toBeNull()
  })
})

const meuble = (o: Partial<ObjetPose>): ObjetPose => ({
  id: 'o', assetId: 'a', x: 5, y: 5, l: 2, h: 1, angle: 0, bloquePas: false, bloqueVue: false, ...o
})

describe('objetSous', () => {
  it('rend l’objet du dessus, en tenant compte de sa rotation', () => {
    const c = terrain()
    c.objets.push(meuble({ id: 'tapis', l: 4, h: 4 }), meuble({ id: 'table', angle: 90 }))
    expect(objetSous(c, [5, 5.8])?.id).toBe('table')
    expect(objetSous(c, [6.5, 5])?.id).toBe('tapis')
    expect(objetSous(c, [9, 9])).toBeNull()
  })
})

describe('redimensionner', () => {
  it('tirer un coin garde les proportions et le coin opposé en place', () => {
    const o = redimensionner(meuble({}), 2, [8, 6.5], true)
    expect(o.l).toBeCloseTo(4, 6)
    expect(o.h).toBeCloseTo(2, 6)
    expect(o.x).toBeCloseTo(6, 6)
    expect(o.y).toBeCloseTo(5.5, 6)
  })
  it('sans garder les proportions, chaque côté suit', () => {
    const o = redimensionner(meuble({}), 2, [8, 7.5], false)
    expect(o.l).toBeCloseTo(4, 6)
    expect(o.h).toBeCloseTo(3, 6)
  })
  it('ne descend pas sous un dixième de case', () => {
    const o = redimensionner(meuble({}), 2, [4, 4.5], false)
    expect(o.l).toBeGreaterThanOrEqual(0.1)
    expect(o.h).toBeGreaterThanOrEqual(0.1)
  })
})

describe('tourner', () => {
  it('oriente l’objet vers le point (la poignée est au-dessus du centre)', () => {
    expect(tourner(meuble({}), [7, 5], false).angle).toBeCloseTo(90, 6)
    expect(tourner(meuble({}), [5, 3], false).angle).toBeCloseTo(0, 6)
  })
  it('par pas de 15° quand on le demande', () => {
    expect(tourner(meuble({}), [6, 3.1], true).angle % 15).toBeCloseTo(0, 6)
  })
})

describe('zoneARemplir', () => {
  it('dans une pièce fermée : la pièce', () => {
    const c = terrain()
    c.murs.push({ id: 'ext', assetId: 'x', pts: [[1, 1], [5, 1], [5, 5], [1, 5], [1, 1]], epaisseur: 0.4 })
    const z = zoneARemplir(c, [3, 3])
    expect(Math.max(...z.map((q) => q[0]))).toBeCloseTo(5, 6)
  })
  it('hors de toute pièce : toute la grille', () => {
    const c = terrain()
    c.murs.push({ id: 'ext', assetId: 'x', pts: [[1, 1], [5, 1], [5, 5], [1, 5], [1, 1]], epaisseur: 0.4 })
    expect(zoneARemplir(c, [10, 8])).toEqual([[0, 0], [20, 0], [20, 10], [0, 10]])
  })
})

describe('solSous et l’aérosol', () => {
  it('un trait d’aérosol se prend à moins d’un rayon de ses points', () => {
    const c = terrain()
    c.sols.push({ id: 'a', assetId: 'x', pts: [[2, 2], [4, 2]], rayon: 1 })
    expect(solSous(c, [4.5, 2.5])?.id).toBe('a')
    expect(solSous(c, [7, 2])).toBeNull()
  })
})

describe('centreDeCase', () => {
  it('ramène un point au centre de la case où il tombe', () => {
    expect(centreDeCase([2.1, 4.97])).toEqual([2.5, 4.5])
    expect(centreDeCase([0, 0])).toEqual([0.5, 0.5])
  })
})

describe('mettreAuPlan', () => {
  const ids = (l: { id: string }[]): string => l.map((o) => o.id).join('')
  const liste = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id }))
  it('passe les choisis devant, dans leur ordre', () => {
    expect(ids(mettreAuPlan(liste, ['d', 'b'], true))).toBe('aceb' + 'd')
  })
  it('passe les choisis derrière, dans leur ordre', () => {
    expect(ids(mettreAuPlan(liste, ['d', 'b'], false))).toBe('bdace')
  })
})

describe('tournerGroupe', () => {
  it('fait pivoter les objets autour du centre, et chacun sur lui-même', () => {
    const objs = [meuble({ id: 'a', x: 4, y: 5 }), meuble({ id: 'b', x: 6, y: 5, angle: 10 })]
    const r = tournerGroupe(objs, [5, 5], 90)
    expect(r[0].x).toBeCloseTo(5, 9)
    expect(r[0].y).toBeCloseTo(4, 9)
    expect(r[0].angle).toBeCloseTo(90, 9)
    expect(r[1].x).toBeCloseTo(5, 9)
    expect(r[1].y).toBeCloseTo(6, 9)
    expect(r[1].angle).toBeCloseTo(100, 9)
  })
})

describe('tirerObjet', () => {
  const suite = (...v: number[]): (() => number) => {
    let i = 0
    return () => v[i++ % v.length]
  }
  it('choisit une des vignettes, un angle et une taille dans les bornes', () => {
    const t = tirerObjet(['a', 'b', 'c'], suite(0.5, 0.25, 0))
    expect(t).toEqual({ id: 'b', angle: 90, echelle: 0.8 })
  })
  it('la taille reste entre 80 et 120 %', () => {
    expect(tirerObjet(['a'], suite(0.999, 0.5, 0.999))!.echelle).toBeLessThanOrEqual(1.2)
  })
  it('sans vignette, rien', () => {
    expect(tirerObjet([], Math.random)).toBeNull()
  })
})

describe('objetsDansRectangle', () => {
  const objs = [
    meuble({ id: 'dedans', x: 2, y: 2, l: 1, h: 1 }),
    meuble({ id: 'a-cheval', x: 4.2, y: 2, l: 1, h: 1 }),
    meuble({ id: 'dehors', x: 8, y: 8, l: 1, h: 1 })
  ]
  it('rend les objets que le rectangle touche, quel que soit le sens du glisser', () => {
    expect(objetsDansRectangle(objs, [4, 3], [1, 1]).sort()).toEqual(['a-cheval', 'dedans'])
  })
  it('un rectangle dans le vide ne prend rien', () => {
    expect(objetsDansRectangle(objs, [5.5, 5], [6, 6])).toEqual([])
  })
})

describe('tirerObjet, variations au choix', () => {
  it('sans rotation variée : droit ; sans taille variée : taille réelle', () => {
    const r = tirerObjet(['a', 'b'], () => 0.7, { rotation: false, taille: false })!
    expect(r.angle).toBe(0)
    expect(r.echelle).toBe(1)
    expect(r.id).toBe('b')
  })
})

describe('habillage des pièces', () => {
  const maison = (): Construction => {
    const c = terrain()
    c.murs.push(
      { id: 'ext', assetId: 'pierre', pts: [[1, 1], [11, 1], [11, 9], [1, 9], [1, 1]], epaisseur: 0.4 },
      { id: 'refend', assetId: 'pierre', pts: [[6, 1], [6, 9]], epaisseur: 0.4 }
    )
    return c
  }
  it('habillageSous retrouve l’habillage de la pièce où tombe le point', () => {
    const c = maison()
    c.habillages = [{ id: 'h', pt: [3, 5], assetId: 'bois' }]
    expect(habillageSous(c, [2, 2])?.id).toBe('h')
    expect(habillageSous(c, [8, 5])).toBeNull()
    expect(habillageSous(c, [15, 5])).toBeNull()
  })
})

describe('habillageSous, deux pièces de même forme', () => {
  it('ne confond pas deux pièces qui ont autant de coins', () => {
    const c = terrain()
    c.murs.push(
      { id: 'ext', assetId: 'p', pts: [[1, 1], [11, 1], [11, 9], [1, 9], [1, 1]], epaisseur: 0.4 },
      { id: 'refend', assetId: 'p', pts: [[6, 1], [6, 9]], epaisseur: 0.4 }
    )
    c.habillages = [{ id: 'g', pt: [3, 5], assetId: 'bois' }]
    expect(habillageSous(c, [9, 5])).toBeNull()
  })
})

describe('appliquerHabillage', () => {
  const maison = (): Construction => {
    const c = terrain()
    c.murs.push(
      { id: 'ext', assetId: 'pierre', pts: [[1, 1], [11, 1], [11, 9], [1, 9], [1, 1]], epaisseur: 0.4 },
      { id: 'refend', assetId: 'pierre', pts: [[6, 1], [6, 9]], epaisseur: 0.4 },
      { id: 'loin', assetId: 'pierre', pts: [[14, 1], [18, 1]], epaisseur: 0.4 }
    )
    return c
  }
  it('le mur qui borde toute la pièce passe à deux côtés, la face tournée vers la pièce prend la matière', () => {
    const c = appliquerHabillage(maison(), [3, 5], { assetId: 'bois', teinte: '#4a5e3e' })
    const refend = c.murs.find((m) => m.id === 'refend')!
    /* Tracé vers le bas, sa gauche est à l'est : la pièce de gauche est côté 2. */
    expect(refend.assetId).toBe('pierre')
    expect(refend.cote2).toEqual({ assetId: 'bois', teinte: '#4a5e3e' })
  })
  it('le mur extérieur, qui longe deux pièces, garde sa matière ; l’habillage est enregistré', () => {
    const c = appliquerHabillage(maison(), [3, 5], { assetId: 'bois' })
    const ext = c.murs.find((m) => m.id === 'ext')!
    expect(ext.assetId).toBe('pierre')
    expect(ext.cote2).toBeUndefined()
    expect(c.habillages).toHaveLength(1)
    expect(c.murs.find((m) => m.id === 'loin')!.cote2).toBeUndefined()
  })
  it('une pièce tracée seule : tout son mur passe à deux côtés', () => {
    const c = terrain()
    c.murs.push({ id: 'p', assetId: 'pierre', pts: [[2, 2], [6, 2], [6, 6], [2, 6], [2, 2]], epaisseur: 0.4 })
    const r = appliquerHabillage(c, [4, 4], { assetId: 'bois' })
    const m = r.murs[0]
    /* Tracée dans le sens des aiguilles d'une montre (y vers le bas) : l'intérieur est à droite. */
    expect(m.cote2).toEqual({ assetId: 'bois' })
    expect(m.assetId).toBe('pierre')
  })
})
