import { describe, expect, it } from 'vitest'
import {
  agrandir,
  bordsPourTaille,
  tailleMinimale,
  composerCadres,
  constructionVide,
  contourDeLObjet,
  deriverCalque,
  enFraction,
  lireConstruction,
  morceauxPleins,
  placeOuverture,
  type Construction,
  type ObjetPose
} from './atelier'
import { natureObstacle } from './types'

const terrain = (largeur: number, hauteur: number): Construction => ({
  ...constructionVide(),
  largeur,
  hauteur
})

const objet = (o: Partial<ObjetPose>): ObjetPose => ({
  id: 'o',
  assetId: 'a',
  x: 5,
  y: 5,
  l: 2,
  h: 1,
  angle: 0,
  bloquePas: false,
  bloqueVue: false,
  ...o
})

describe('constructionVide', () => {
  it('fait 30 × 20 cases de 1,5 m, sans rien dessus', () => {
    expect(constructionVide()).toEqual({
      v: 1,
      largeur: 30,
      hauteur: 20,
      metresParCase: 1.5,
      sols: [],
      murs: [],
      ouvertures: [],
      objets: []
    })
  })
})

describe('deriverCalque', () => {
  it('un mur bâti donne un mur en fractions', () => {
    const c = terrain(10, 5)
    c.murs.push({ id: 'm1', assetId: 'x', pts: [[0, 0], [10, 5]], epaisseur: 0.4 })
    expect(deriverCalque(c).murs).toEqual([{ atelierId: 'm1', nature: 'mur', pts: [[0, 0], [1, 1]] }])
  })

  it('un tapis ne bloque rien, une table bloque le pas seulement', () => {
    const c = terrain(10, 10)
    c.objets.push(objet({ id: 'tapis' }), objet({ id: 'table', bloquePas: true }))
    const murs = deriverCalque(c).murs
    expect(murs).toHaveLength(1)
    expect(murs[0].atelierId).toBe('obj:table')
    expect(murs[0].nature).toBe(natureObstacle(true, false))
    expect(murs[0].pts).toHaveLength(5)
  })

  it('une porte au milieu d’un mur horizontal garde sa place et sa largeur', () => {
    const c = terrain(10, 5)
    c.murs.push({ id: 'm', assetId: 'x', pts: [[0, 2], [10, 2]], epaisseur: 0.4 })
    c.ouvertures.push({ id: 'p', murId: 'm', nature: 'porte', assetId: 'y', d: 0.5, largeur: 1 })
    const [o] = deriverCalque(c).ouvertures
    expect(o.atelierId).toBe('p')
    expect(o.murAtelierId).toBe('m')
    expect(o.nature).toBe('porte')
    expect(o.d).toBeCloseTo(0.5, 9)
    expect(o.largeur).toBeCloseTo(0.1, 9)
  })

  it('sur un mur vertical, la largeur se compte dans le sens du mur', () => {
    const c = terrain(10, 5)
    c.murs.push({ id: 'm', assetId: 'x', pts: [[2, 0], [2, 5]], epaisseur: 0.4 })
    c.ouvertures.push({ id: 'f', murId: 'm', nature: 'vitre', assetId: 'y', d: 0.5, largeur: 1 })
    const [o] = deriverCalque(c).ouvertures
    expect(o.largeur).toBeCloseTo(0.2, 9)
    expect(o.d).toBeCloseTo(0.5, 9)
  })

  it('sur un mur coudé, la porte tombe au même point qu’en cases', () => {
    const c = terrain(10, 5)
    /* 4 cases à l'horizontale, puis 4 à la verticale : la moitié est au coude. */
    c.murs.push({ id: 'm', assetId: 'x', pts: [[0, 0], [4, 0], [4, 4]], epaisseur: 0.4 })
    c.ouvertures.push({ id: 'p', murId: 'm', nature: 'porte', assetId: 'y', d: 0.25, largeur: 1 })
    const [o] = deriverCalque(c).ouvertures
    /* En fractions : 0,4 de large puis 0,8 de haut ; le point (2, 0) est à 0,2 sur 1,2. */
    expect(o.d).toBeCloseTo(0.2 / 1.2, 9)
  })

  it('une ouverture dont le mur a disparu n’est pas dérivée', () => {
    const c = terrain(10, 5)
    c.ouvertures.push({ id: 'p', murId: 'fantome', nature: 'porte', assetId: 'y', d: 0.5, largeur: 1 })
    expect(deriverCalque(c).ouvertures).toEqual([])
  })
})

describe('contourDeLObjet', () => {
  it('un objet tourné de 90° échange largeur et hauteur', () => {
    const pts = contourDeLObjet(objet({ x: 5, y: 5, l: 2, h: 1, angle: 90 }))
    expect(pts).toHaveLength(5)
    expect(pts[4]).toEqual(pts[0])
    const xs = pts.map((p) => p[0])
    const ys = pts.map((p) => p[1])
    expect(Math.min(...xs)).toBeCloseTo(4.5, 9)
    expect(Math.max(...xs)).toBeCloseTo(5.5, 9)
    expect(Math.min(...ys)).toBeCloseTo(4, 9)
    expect(Math.max(...ys)).toBeCloseTo(6, 9)
  })
})

describe('agrandir', () => {
  it('de 2 à gauche et 1 en haut : tout se décale, et le cadre de recalage suit', () => {
    const c = terrain(10, 5)
    c.murs.push({ id: 'm', assetId: 'x', pts: [[0, 0], [1, 1]], epaisseur: 0.4 })
    c.sols.push({ id: 's', assetId: 'x', pts: [[0, 0], [1, 0], [1, 1]] })
    c.objets.push(objet({ x: 3, y: 3 }))
    const { construction, cadre } = agrandir(c, { gauche: 2, haut: 1, droite: 0, bas: 0 })
    expect(construction.largeur).toBe(12)
    expect(construction.hauteur).toBe(6)
    expect(construction.murs[0].pts[0]).toEqual([2, 1])
    expect(construction.sols[0].pts[2]).toEqual([3, 2])
    expect(construction.objets[0].x).toBe(5)
    expect(construction.objets[0].y).toBe(4)
    expect(cadre.x).toBeCloseTo(-0.2, 9)
    expect(cadre.y).toBeCloseTo(-0.2, 9)
    expect(cadre.w).toBeCloseTo(1.2, 9)
    expect(cadre.h).toBeCloseTo(1.2, 9)
  })

  it('un point recalé par le cadre retombe au même endroit physique', () => {
    const c = terrain(10, 10)
    const { construction, cadre } = agrandir(c, { gauche: 10, haut: 3, droite: 4, bas: 1 })
    const avant = enFraction(c, [5, 5])
    const recale: [number, number] = [(avant[0] - cadre.x) / cadre.w, (avant[1] - cadre.y) / cadre.h]
    const attendu = enFraction(construction, [15, 8])
    expect(recale[0]).toBeCloseTo(attendu[0], 9)
    expect(recale[1]).toBeCloseTo(attendu[1], 9)
  })

  it('une lampe au centre d’une carte 10 × 10 agrandie de 10 à gauche passe à [0,75 ; 0,5]', () => {
    const { cadre } = agrandir(terrain(10, 10), { gauche: 10, haut: 0, droite: 0, bas: 0 })
    expect((0.5 - cadre.x) / cadre.w).toBeCloseTo(0.75, 9)
    expect((0.5 - cadre.y) / cadre.h).toBeCloseTo(0.5, 9)
  })

  it('rétrécit quand rien de construit ne dépasse, et le cadre suit', () => {
    const c = terrain(10, 10)
    c.murs.push({ id: 'm', assetId: 'x', pts: [[3, 3], [6, 3]], epaisseur: 0.4 })
    const { construction, cadre } = agrandir(c, { gauche: -2, haut: 0, droite: -2, bas: 0 })
    expect(construction.largeur).toBe(6)
    expect(construction.murs[0].pts[0]).toEqual([1, 3])
    expect(cadre.x).toBeCloseTo(0.2, 9)
    expect(cadre.w).toBeCloseTo(0.6, 9)
  })
  it('refuse de couper ce qui est construit', () => {
    const c = terrain(10, 10)
    c.murs.push({ id: 'm', assetId: 'x', pts: [[3, 3], [6, 3]], epaisseur: 0.4 })
    expect(() => agrandir(c, { gauche: -3, haut: 0, droite: 0, bas: 0 })).toThrow()
  })
  it('refuse un terrain de moins d’une case', () => {
    expect(() => agrandir(terrain(2, 2), { gauche: 0, haut: 0, droite: -2, bas: 0 })).toThrow()
  })
})

describe('taille du terrain', () => {
  it('bordsPourTaille répartit selon l’ancre', () => {
    const c = terrain(10, 10)
    expect(bordsPourTaille(c, 14, 8, [0, 0])).toEqual({ gauche: 0, haut: 0, droite: 4, bas: -2 })
    expect(bordsPourTaille(c, 14, 8, [1, 1])).toEqual({ gauche: 4, haut: -2, droite: 0, bas: 0 })
    expect(bordsPourTaille(c, 14, 8, [0.5, 0.5])).toEqual({ gauche: 2, haut: -1, droite: 2, bas: -1 })
  })
  it('tailleMinimale : ce qu’il faut pour garder tout le contenu, selon l’ancre', () => {
    const c = terrain(10, 10)
    c.objets.push({ id: 'o', assetId: 'a', x: 6, y: 2, l: 2, h: 2, angle: 0, bloquePas: false, bloqueVue: false })
    /* L'objet couvre x 5..7, y 1..3. */
    expect(tailleMinimale(c, [0, 0])).toEqual({ largeur: 7, hauteur: 3 })
    expect(tailleMinimale(c, [1, 1])).toEqual({ largeur: 5, hauteur: 9 })
  })
  it('un terrain vide descend jusqu’à une case', () => {
    expect(tailleMinimale(terrain(10, 10), [0.5, 0.5])).toEqual({ largeur: 1, hauteur: 1 })
  })
})

describe('lireConstruction', () => {
  it('un JSON abîmé rend une construction vide', () => {
    expect(lireConstruction('{pas du json')).toEqual(constructionVide())
  })

  it('relit ce qu’on a écrit', () => {
    const c = terrain(12, 8)
    c.murs.push({ id: 'm', assetId: 'x', pts: [[0, 0], [1, 1]], epaisseur: 0.4 })
    c.objets.push(objet({ bloqueVue: true }))
    expect(lireConstruction(JSON.stringify(c))).toEqual(c)
  })

  it('écarte un mur sans points valables, garde le reste', () => {
    const brut = JSON.stringify({
      ...terrain(10, 10),
      murs: [
        { id: 'ok', assetId: 'x', pts: [[0, 0], [1, 1]], epaisseur: 0.4 },
        { id: 'ko', assetId: 'x', pts: 'n’importe quoi', epaisseur: 0.4 }
      ]
    })
    expect(lireConstruction(brut).murs.map((m) => m.id)).toEqual(['ok'])
  })
})

describe('morceauxPleins', () => {
  const m = { id: 'm', assetId: 'x', pts: [[0, 0], [10, 0]] as [number, number][], epaisseur: 0.4 }
  it('un mur sans ouverture reste entier', () => {
    expect(morceauxPleins(m, [])).toEqual([[[0, 0], [10, 0]]])
  })
  it('une porte de 2 cases au milieu coupe le mur en deux', () => {
    const r = morceauxPleins(m, [{ id: 'p', murId: 'm', nature: 'porte', assetId: 'y', d: 0.5, largeur: 2 }])
    expect(r).toEqual([
      [[0, 0], [4, 0]],
      [[6, 0], [10, 0]]
    ])
  })
  it('sur un mur coudé, le morceau garde son coude', () => {
    const coude = { ...m, pts: [[0, 0], [4, 0], [4, 4]] as [number, number][] }
    const r = morceauxPleins(coude, [{ id: 'p', murId: 'm', nature: 'porte', assetId: 'y', d: 0.875, largeur: 1 }])
    expect(r[0]).toEqual([[0, 0], [4, 0], [4, 2.5]])
    expect(r[1]).toEqual([[4, 3.5], [4, 4]])
  })
  it('les ouvertures d’un autre mur ne comptent pas', () => {
    expect(morceauxPleins(m, [{ id: 'p', murId: 'autre', nature: 'porte', assetId: 'y', d: 0.5, largeur: 2 }])).toHaveLength(1)
  })
})

describe('placeOuverture', () => {
  it('rend le centre et l’angle de l’ouverture', () => {
    const m = { id: 'm', assetId: 'x', pts: [[2, 0], [2, 10]] as [number, number][], epaisseur: 0.4 }
    const p = placeOuverture(m, { id: 'p', murId: 'm', nature: 'porte', assetId: 'y', d: 0.3, largeur: 1 })
    expect(p.centre[0]).toBeCloseTo(2, 9)
    expect(p.centre[1]).toBeCloseTo(3, 9)
    expect(p.angle).toBeCloseTo(Math.PI / 2, 9)
    expect(p.largeur).toBe(1)
  })
})

describe('composerCadres', () => {
  it('deux agrandissements successifs recalent comme un seul', () => {
    const c0 = terrain(10, 10)
    const r1 = agrandir(c0, { gauche: 2, haut: 0, droite: 0, bas: 3 })
    const r2 = agrandir(r1.construction, { gauche: 0, haut: 4, droite: 5, bas: 0 })
    const direct = agrandir(c0, { gauche: 2, haut: 4, droite: 5, bas: 3 }).cadre
    const compose = composerCadres(r1.cadre, r2.cadre)
    for (const k of ['x', 'y', 'w', 'h'] as const) expect(compose[k]).toBeCloseTo(direct[k], 9)
  })
})

describe('orientation des ouvertures', () => {
  it('lireConstruction garde « retourne » et « miroir », et les met à faux par défaut', () => {
    const c = { ...constructionVide(), murs: [{ id: 'm', assetId: 'x', pts: [[0, 0], [5, 0]], epaisseur: 0.4 }] }
    const brut = JSON.stringify({
      ...c,
      ouvertures: [
        { id: 'a', murId: 'm', nature: 'porte', assetId: 'p', d: 0.5, largeur: 1, retourne: true, miroir: true },
        { id: 'b', murId: 'm', nature: 'vitre', assetId: 'f', d: 0.2, largeur: 1 }
      ]
    })
    const o = lireConstruction(brut).ouvertures
    expect([o[0].retourne, o[0].miroir]).toEqual([true, true])
    expect([o[1].retourne, o[1].miroir]).toEqual([false, false])
  })
})

describe('réduire un terrain couvert de sol', () => {
  it('un sol qui couvre tout ne bloque pas : il est découpé au nouveau bord', () => {
    const c = terrain(10, 10)
    c.sols.push({ id: 's', assetId: 'x', pts: [[0, 0], [10, 0], [10, 10], [0, 10]] })
    expect(tailleMinimale(c, [0, 0])).toEqual({ largeur: 1, hauteur: 1 })
    const { construction } = agrandir(c, { gauche: -3, haut: 0, droite: 0, bas: -2 })
    const xs = construction.sols[0].pts.map((p) => p[0])
    const ys = construction.sols[0].pts.map((p) => p[1])
    expect(Math.min(...xs)).toBeCloseTo(0, 9)
    expect(Math.max(...xs)).toBeCloseTo(7, 9)
    expect(Math.max(...ys)).toBeCloseTo(8, 9)
  })
  it('un sol entièrement retiré disparaît', () => {
    const c = terrain(10, 10)
    c.sols.push({ id: 's', assetId: 'x', pts: [[0, 0], [2, 0], [2, 2], [0, 2]] })
    expect(agrandir(c, { gauche: -3, haut: 0, droite: 0, bas: 0 }).construction.sols).toEqual([])
  })
  it('les murs, eux, bloquent toujours', () => {
    const c = terrain(10, 10)
    c.murs.push({ id: 'm', assetId: 'x', pts: [[1, 1], [9, 1]], epaisseur: 0.4 })
    expect(tailleMinimale(c, [0, 0]).largeur).toBe(10)
  })
})

describe('aérosol', () => {
  it('lireConstruction garde un trait d’aérosol (rayon, même avec un seul point)', () => {
    const c = terrain(10, 10)
    c.sols.push({ id: 'a', assetId: 'x', pts: [[2, 2]], rayon: 1.2 })
    expect(lireConstruction(JSON.stringify(c)).sols).toEqual(c.sols)
  })
  it('au redimensionnement, l’aérosol se décale et perd ses points sortis', () => {
    const c = terrain(10, 10)
    c.sols.push({ id: 'a', assetId: 'x', pts: [[1, 5], [6, 5]], rayon: 1 })
    const s = agrandir(c, { gauche: -3, haut: 0, droite: 0, bas: 0 }).construction.sols
    expect(s).toEqual([{ id: 'a', assetId: 'x', pts: [[3, 5]], rayon: 1 }])
  })
})
