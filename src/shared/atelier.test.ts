import { describe, expect, it } from 'vitest'
import {
  agrandir,
  constructionVide,
  contourDeLObjet,
  deriverCalque,
  enFraction,
  lireConstruction,
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

  it('refuse de rétrécir', () => {
    expect(() => agrandir(terrain(10, 10), { gauche: -1, haut: 0, droite: 0, bas: 0 })).toThrow()
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
