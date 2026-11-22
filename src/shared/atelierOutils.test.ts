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
  fusionnerSuperpositions,
  sansSuperposition,
  habillageSous,
  objetsDansRectangle,
  tirerObjet,
  mettreAuPlan,
  tourner,
  tournerGroupe,
  zoneARemplir,
  matiereDuSolSous,
  faceDuMurSous,
  miroirObjets,
  alignerObjets,
  boiteDesObjets,
  etirer,
  milieuxDesCotes
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

describe('superpositions de murs', () => {
  const mur = (id: string, pts: [number, number][]) => ({ id, assetId: 'p', pts, epaisseur: 0.4 })
  it('retire la partie d’un mur qui se superpose à un autre', () => {
    const piece = mur('piece', [[2, 2], [6, 2], [6, 6], [2, 6], [2, 2]])
    expect(sansSuperposition(mur('droit', [[0, 2], [4, 2]]), [piece])).toEqual([[[0, 2], [2, 2]]])
  })
  it('un mur qui déborde des deux côtés est coupé en deux', () => {
    const piece = mur('piece', [[2, 2], [6, 2], [6, 6], [2, 6], [2, 2]])
    expect(sansSuperposition(mur('droit', [[0, 2], [9, 2]]), [piece])).toEqual([
      [[0, 2], [2, 2]],
      [[6, 2], [9, 2]]
    ])
  })
  it('un mur entièrement recouvert disparaît', () => {
    const piece = mur('piece', [[2, 2], [6, 2], [6, 6], [2, 6], [2, 2]])
    expect(sansSuperposition(mur('droit', [[3, 2], [5, 2]]), [piece])).toEqual([])
  })
  it('un mur qui croise sans se superposer reste entier', () => {
    const piece = mur('piece', [[2, 2], [6, 2], [6, 6], [2, 6], [2, 2]])
    expect(sansSuperposition(mur('croise', [[4, 0], [4, 8]]), [piece])).toEqual([[[4, 0], [4, 8]]])
  })
  it('un coude garde ses deux branches quand seule l’une est superposée en partie', () => {
    const piece = mur('piece', [[2, 2], [6, 2], [6, 6], [2, 6], [2, 2]])
    expect(sansSuperposition(mur('l', [[4, 2], [8, 2], [8, 5]]), [piece])).toEqual([[[6, 2], [8, 2], [8, 5]]])
  })
  it('fusionnerSuperpositions : les pièces fermées gardent leurs murs, les ouvertures suivent', () => {
    const c = terrain()
    c.murs.push(mur('droit', [[0, 2], [9, 2]]), mur('piece', [[2, 2], [6, 2], [6, 6], [2, 6], [2, 2]]))
    c.ouvertures.push({ id: 'p', murId: 'droit', nature: 'porte', assetId: 'x', d: 0.85, largeur: 1 })
    const r = fusionnerSuperpositions(c)
    expect(r.murs.find((m) => m.id === 'piece')!.pts).toHaveLength(5)
    const morceaux = r.murs.filter((m) => m.id !== 'piece')
    expect(morceaux.map((m) => m.pts)).toEqual([[[0, 2], [2, 2]], [[6, 2], [9, 2]]])
    const o = r.ouvertures[0]
    const porteur = r.murs.find((m) => m.id === o.murId)!
    expect(porteur.pts).toEqual([[6, 2], [9, 2]])
    /* 0,85 × 9 = 7,65 cases depuis le début : 1,65 sur 3 du nouveau morceau. */
    expect(o.d).toBeCloseTo(1.65 / 3, 6)
  })
})

describe('la pipette', () => {
  it('prend le dernier sol peint, la base sous la gomme, la base hors des sols', () => {
    const c: Construction = {
      ...terrain(),
      base: 'herbe',
      sols: [
        { id: 's1', assetId: 'dalles', pts: [[0, 0], [10, 0], [10, 10], [0, 10]] },
        { id: 's2', assetId: 'tapis', pts: [[2, 2], [4, 2], [4, 4], [2, 4]] },
        { id: 'g', assetId: '', pts: [[8, 8]], rayon: 1, gomme: true }
      ]
    }
    expect(matiereDuSolSous(c, [3, 3])).toBe('tapis')
    expect(matiereDuSolSous(c, [6, 3])).toBe('dalles')
    expect(matiereDuSolSous(c, [8, 8.5])).toBe('herbe')
    expect(matiereDuSolSous(c, [15, 5])).toBe('herbe')
    expect(matiereDuSolSous({ ...c, base: null }, [15, 5])).toBeNull()
  })

  it('prend la face du mur du côté où l’on clique', () => {
    const c: Construction = {
      ...terrain(),
      murs: [
        {
          id: 'm',
          assetId: 'pierre',
          pts: [[0, 5], [10, 5]],
          epaisseur: 0.4,
          teinte: '#aa0000',
          cote2: { assetId: 'bois' }
        }
      ]
    }
    /* Tracé vers la droite : le côté 1 est au-dessus à l'écran. */
    expect(faceDuMurSous(c, [5, 4.9], 0.2)).toEqual({ murId: 'm', assetId: 'pierre', teinte: '#aa0000' })
    expect(faceDuMurSous(c, [5, 5.1], 0.2)).toEqual({ murId: 'm', assetId: 'bois' })
    expect(faceDuMurSous(c, [5, 7], 0.2)).toBeNull()
  })

  it('un mur à un seul côté donne la même face des deux côtés', () => {
    const c: Construction = {
      ...terrain(),
      murs: [{ id: 'm', assetId: 'pierre', pts: [[0, 5], [10, 5]], epaisseur: 0.4 }]
    }
    expect(faceDuMurSous(c, [5, 5.1], 0.2)?.assetId).toBe('pierre')
  })
})

describe('miroirs et alignements', () => {
  const obj = (id: string, x: number, y: number, l = 1, h = 1, angle = 0): ObjetPose => ({
    id,
    assetId: 'a',
    x,
    y,
    l,
    h,
    angle,
    bloquePas: false,
    bloqueVue: false
  })

  it('un objet seul se retourne sur place, son angle change de signe', () => {
    const [o] = miroirObjets([obj('a', 3, 4, 2, 1, 30)], 'h')
    expect(o).toMatchObject({ x: 3, y: 4, angle: 330, miroirX: true })
    const [p] = miroirObjets([o], 'h')
    expect(p).toMatchObject({ angle: 30, miroirX: false })
    const [q] = miroirObjets([obj('a', 3, 4)], 'v')
    expect(q).toMatchObject({ x: 3, y: 4, angle: 0, miroirY: true })
  })

  it('un groupe échange ses places autour de son centre', () => {
    const r = miroirObjets([obj('a', 1, 1), obj('b', 5, 3)], 'h')
    expect(r.map((o) => o.x)).toEqual([5, 1])
    expect(r.map((o) => o.y)).toEqual([1, 3])
    const v = miroirObjets([obj('a', 1, 1), obj('b', 5, 3)], 'v')
    expect(v.map((o) => o.y)).toEqual([3, 1])
  })

  it('aligne sur la boîte du groupe', () => {
    const g = [obj('a', 1, 1), obj('b', 5, 3, 3, 1)]
    expect(alignerObjets(g, 'gauche').map((o) => o.x)).toEqual([1, 2])
    expect(alignerObjets(g, 'droite').map((o) => o.x)).toEqual([6, 5])
    expect(alignerObjets(g, 'centreH').map((o) => o.x)).toEqual([3.5, 3.5])
    expect(alignerObjets(g, 'haut').map((o) => o.y)).toEqual([1, 1])
    expect(alignerObjets(g, 'bas').map((o) => o.y)).toEqual([3, 3])
    expect(alignerObjets(g, 'centreV').map((o) => o.y)).toEqual([2, 2])
  })

  it('aligne ce qu’on voit : la boîte de l’objet tourné', () => {
    const g = [obj('a', 0, 0, 1, 1), obj('b', 5, 5, 4, 2, 90)]
    const r = alignerObjets(g, 'gauche')
    expect(boiteDesObjets([r[1]]).x0).toBeCloseTo(-0.5, 9)
  })
})

describe('étirer un objet par un côté', () => {
  const o: ObjetPose = { id: 'o', assetId: 'a', x: 5, y: 5, l: 4, h: 2, angle: 0, bloquePas: false, bloqueVue: false }

  it('les milieux des côtés : haut, droite, bas, gauche', () => {
    expect(milieuxDesCotes(o)).toEqual([[5, 4], [7, 5], [5, 6], [3, 5]])
  })

  it('la largeur rétrécit par la droite, le bord gauche reste en place', () => {
    const r = etirer(o, 1, [6, 9])
    expect(r).toMatchObject({ l: 3, h: 2, x: 4.5, y: 5 })
  })

  it('la longueur s’allonge par le haut, le bas reste en place', () => {
    const r = etirer(o, 0, [5, 3])
    expect(r).toMatchObject({ l: 4, h: 3, x: 5, y: 4.5 })
  })

  it('un objet tourné s’étire le long de son propre axe', () => {
    const t = { ...o, angle: 90 }
    /* Tourné d'un quart de tour : sa largeur est verticale à l'écran ; le côté 1 est en bas. */
    const r = etirer(t, 1, [5, 8])
    expect(r.l).toBeCloseTo(5, 9)
    expect(r.x).toBeCloseTo(5, 9)
    expect(r.y).toBeCloseTo(5.5, 9)
  })

  it('ne descend pas sous la taille minimale', () => {
    expect(etirer(o, 1, [0, 5]).l).toBeGreaterThan(0)
  })
})

describe('les murs invisibles', () => {
  it('la fusion ne les coupe pas, et ils ne coupent pas les vrais murs', () => {
    const c: Construction = {
      ...terrain(),
      murs: [
        { id: 'vrai', assetId: 'pierre', pts: [[0, 5], [10, 5]], epaisseur: 0.4 },
        { id: 'inv', assetId: 'pierre', pts: [[2, 5], [8, 5]], epaisseur: 0.4, invisible: true }
      ]
    }
    expect(fusionnerSuperpositions(c)).toBe(c)
  })

  it('une limite invisible découpe la pièce en deux', () => {
    const salle: Construction = {
      ...terrain(),
      murs: [
        { id: 'tour', assetId: 'pierre', pts: [[0, 0], [10, 0], [10, 6], [0, 6], [0, 0]], epaisseur: 0.4 },
        { id: 'lim', assetId: 'pierre', pts: [[5, 0], [5, 6]], epaisseur: 0.4, invisible: true }
      ]
    }
    const gauche = pieceSous(salle, [2, 3])!
    const xs = gauche.map((p) => p[0])
    expect(Math.max(...xs)).toBeCloseTo(5, 6)
  })
})
