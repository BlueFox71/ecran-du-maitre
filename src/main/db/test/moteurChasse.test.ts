import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { activer, fermerBaseEssai, lieu, objet, ouvrirBaseEssai, pj, pnj, placer, seance } from './base'

/* L'écran et les téléphones : on n'en garde que ce que le moteur lit ou appelle. */
const ecran = vi.hoisted(() => ({ placeId: null as number | null }))
vi.mock('../../display', () => ({
  ratioEcran: () => 1,
  getState: () => ({ placeId: ecran.placeId }),
  versMj: vi.fn(),
  chasseABouge: vi.fn(),
  ecouterPions: vi.fn()
}))
vi.mock('../../mobile', () => ({
  repereDuPlan: () => ({ w: 1000, h: 1000 }),
  broadcast: vi.fn()
}))

import * as display from '../../display'
import * as chasse from '../../chasse'
import { getDb } from '../index'
import * as objets from '../repos/objets'
import { addPion } from '../repos/pions'
import { addMur } from '../repos/murs'
import { setConstruction } from '../repos/construction'
import { gainSon, type AppareilChasse } from '@shared/chasse'
import type { Construction } from '@shared/atelier'

let s: number
let salle: number

beforeEach(() => {
  ouvrirBaseEssai()
  s = seance('S1')
  activer(s)
  salle = lieu('Salle', s)
  ecran.placeId = salle
  vi.clearAllMocks()
})
afterEach(() => {
  chasse.oublier()
  fermerBaseEssai()
})

/** Une construction de 10×10 cases, avec un trait EMF 4 autour du centre. */
function construire(placeId: number, extra: Partial<Construction> = {}): void {
  setConstruction(placeId, {
    v: 1,
    largeur: 10,
    hauteur: 10,
    metresParCase: 3,
    sols: [],
    murs: [],
    ouvertures: [],
    objets: [],
    emf: [{ id: 't1', valeur: 4, rayon: 1.5, pts: [[5, 5]] }],
    ...extra
  })
}

function outil(nom: string, quoi: 'emf' | 'thermometre'): number {
  const o = objet(s, nom)
  objets.updateObjet(o, { outil: quoi })
  return o
}

function enMain(o: number, perso: number): number {
  return placer(o, s, { port: 'pj', characterId: perso, etat: 'porte' })
}

function pose(o: number, placeId: number, x: number, y: number): number {
  const p = placer(o, s, { port: 'lieu', placeId, etat: 'trouve' })
  getDb().prepare(`UPDATE objet_placement SET pos_x = ?, pos_y = ? WHERE id = ?`).run(x, y, p)
  return p
}

const de = (placementId: number): AppareilChasse | undefined =>
  chasse.appareils().find((a) => a.placementId === placementId)

/* Sans échelle, le plan fait 30 m de large : 0,1 de largeur = 3 m. */

it('un EMF en main lit la zone sous le pion de son porteur', () => {
  construire(salle)
  const anna = pj('Anna')
  addPion({ placeId: salle, characterId: anna, x: 0.5, y: 0.5 })
  const pl = enMain(outil('EMF', 'emf'), anna)
  const a = de(pl)!
  expect(a).toMatchObject({ ou: 'main', valeur: 4, gain: 1, characterId: anna, placeId: salle, allume: true })
  expect(a.pos).toEqual({ x: 0.5, y: 0.5 })
})

it('posé hors zone : niveau 0, muet', () => {
  construire(salle)
  addPion({ placeId: salle, characterId: pj('Anna'), x: 0.15, y: 0.1 })
  const pl = pose(outil('EMF', 'emf'), salle, 0.1, 0.1)
  expect(de(pl)).toMatchObject({ ou: 'lieu', valeur: 0, gain: 0 })
})

it('posé dans une zone, entendu selon le pion de joueur le plus proche', () => {
  construire(salle)
  const pl = pose(outil('EMF', 'emf'), salle, 0.5, 0.5)
  /* Personne : il mesure, mais personne ne l'entend. */
  expect(de(pl)).toMatchObject({ valeur: 4, gain: 0 })
  /* Un PNJ tout près ne compte pas. */
  addPion({ placeId: salle, characterId: pnj('Gardien', s), x: 0.5, y: 0.52 })
  expect(de(pl)!.gain).toBe(0)
  addPion({ placeId: salle, characterId: pj('Loin'), x: 0.9, y: 0.5 })
  addPion({ placeId: salle, characterId: pj('Près'), x: 0.6, y: 0.5 })
  expect(de(pl)!.gain).toBeCloseTo(gainSon(3, 0), 5)
})

it("un mur entre l'EMF et le pion atténue", () => {
  construire(salle)
  const pl = pose(outil('EMF', 'emf'), salle, 0.5, 0.5)
  addPion({ placeId: salle, characterId: pj('Anna'), x: 0.6, y: 0.5 })
  const libre = de(pl)!.gain
  addMur({ placeId: salle, nature: 'mur', pts: [[0.55, 0], [0.55, 1]] })
  expect(de(pl)!.gain).toBeCloseTo(libre * 0.35, 5)
})

it("posé sur un lieu qui n'est pas à l'écran, il sonne quand même", () => {
  const cave = lieu('Cave', s)
  construire(cave)
  const pl = pose(outil('EMF', 'emf'), cave, 0.5, 0.5)
  addPion({ placeId: cave, characterId: pj('Anna'), x: 0.6, y: 0.5 })
  expect(ecran.placeId).not.toBe(cave)
  expect(de(pl)).toMatchObject({ ou: 'lieu', valeur: 4 })
  expect(de(pl)!.gain).toBeGreaterThan(0)
})

it('une pièce découpée sur son étage lit la construction et entend les pions de l’étage', () => {
  construire(salle)
  const piece = lieu('Chambre', s)
  getDb()
    .prepare(`UPDATE place SET parent_id = ?, zone_pts = '[[0,0],[1,0],[1,1],[0,1]]' WHERE id = ?`)
    .run(salle, piece)
  const pl = pose(outil('EMF', 'emf'), piece, 0.5, 0.5)
  addPion({ placeId: salle, characterId: pj('Anna'), x: 0.6, y: 0.5 })
  expect(de(pl)).toMatchObject({ valeur: 4, placeId: piece })
  expect(de(pl)!.gain).toBeCloseTo(gainSon(3, 0), 5)
})

it('thermomètre sans construction : ambiante 18', () => {
  const anna = pj('Anna')
  addPion({ placeId: salle, characterId: anna, x: 0.5, y: 0.5 })
  const pl = enMain(outil('Thermo', 'thermometre'), anna)
  expect(de(pl)).toMatchObject({ ou: 'main', valeur: 18, gain: 0 })
})

it('éteint : gain 0', () => {
  construire(salle)
  const anna = pj('Anna')
  addPion({ placeId: salle, characterId: anna, x: 0.5, y: 0.5 })
  const pl = enMain(outil('EMF', 'emf'), anna)
  objets.allumer(pl, false)
  expect(de(pl)).toMatchObject({ allume: false, valeur: 4, gain: 0 })
})

it('porteur sans pion : ailleurs, muet', () => {
  construire(salle)
  const pl = enMain(outil('EMF', 'emf'), pj('Anna'))
  expect(de(pl)).toMatchObject({ ou: 'ailleurs', pos: null, valeur: 0, gain: 0 })
})

/* Un personnage n'a qu'un pion (contrainte d'unicité en base) : « celui du
   lieu affiché d'abord » ne départage donc jamais deux pions. On vérifie que
   l'appareil suit le pion où qu'il soit, à l'écran ou non. */
it('en main, il suit le pion de son porteur, même hors du lieu affiché', () => {
  const cave = lieu('Cave', s)
  construire(salle)
  construire(cave, { emf: [{ id: 't', valeur: 2, rayon: 1.5, pts: [[5, 5]] }] })
  const anna = pj('Anna')
  addPion({ placeId: cave, characterId: anna, x: 0.5, y: 0.5 })
  const pl = enMain(outil('EMF', 'emf'), anna)
  expect(de(pl)).toMatchObject({ ou: 'main', placeId: cave, valeur: 2 })
  addPion({ placeId: salle, characterId: anna, x: 0.5, y: 0.5 })
  expect(de(pl)).toMatchObject({ ou: 'main', placeId: salle, valeur: 4 })
})

it('contrôle à 5 puis lâché : revient à la zone', () => {
  construire(salle)
  const pl = pose(outil('EMF', 'emf'), salle, 0.1, 0.1)
  const avec = chasse.controler(pl, 9).find((a) => a.placementId === pl)!
  expect(avec).toMatchObject({ valeur: 5, controle: true })
  const sans = chasse.controler(pl, null).find((a) => a.placementId === pl)!
  expect(sans).toMatchObject({ valeur: 0, controle: false })
})

it('le contrôle du thermomètre est borné à −20…35', () => {
  const pl = pose(outil('Thermo', 'thermometre'), salle, 0.1, 0.1)
  expect(chasse.controler(pl, -50).find((a) => a.placementId === pl)!.valeur).toBe(-20)
  expect(chasse.controler(pl, 80).find((a) => a.placementId === pl)!.valeur).toBe(35)
})

it("contrôle conservé quand l'EMF passe d'un joueur au sol", () => {
  construire(salle)
  const anna = pj('Anna')
  addPion({ placeId: salle, characterId: anna, x: 0.1, y: 0.1 })
  const pl = enMain(outil('EMF', 'emf'), anna)
  chasse.controler(pl, 5)
  objets.donner(pl, { port: 'lieu', placeId: salle }, undefined, anna)
  objets.situer(pl, { x: 0.1, y: 0.1 })
  expect(de(pl)).toMatchObject({ ou: 'lieu', valeur: 5, controle: true, characterId: anna })
})

it("outil retiré pendant le contrôle : l'appareil disparaît, le contrôle est oublié", () => {
  construire(salle)
  const o = outil('EMF', 'emf')
  const pl = pose(o, salle, 0.1, 0.1)
  chasse.controler(pl, 5)
  objets.updateObjet(o, { outil: null })
  chasse.recalculer()
  expect(de(pl)).toBeUndefined()
  objets.updateObjet(o, { outil: 'emf' })
  expect(de(pl)).toMatchObject({ valeur: 0, controle: false })
})

it('ni rangé dans un inventaire, ni à la corbeille : pas un appareil', () => {
  const o = outil('EMF', 'emf')
  placer(o, s, { port: 'corbeille' })
  expect(chasse.appareils()).toEqual([])
})

it("recalculer n'envoie rien si rien n'a changé", () => {
  construire(salle)
  pose(outil('EMF', 'emf'), salle, 0.5, 0.5)
  chasse.recalculer()
  chasse.recalculer()
  expect(display.versMj).toHaveBeenCalledTimes(1)
  expect(display.versMj).toHaveBeenCalledWith('chasse:state', expect.any(Array))
  expect(display.chasseABouge).toHaveBeenCalledTimes(1)
})

it('lisiblePar : le porteur, ou un pion proche sans mur', () => {
  construire(salle)
  const anna = pj('Anna')
  const bob = pj('Bob')
  addPion({ placeId: salle, characterId: anna, x: 0.5, y: 0.5 })
  const pl = pose(outil('EMF', 'emf'), salle, 0.5, 0.5)
  const a = de(pl)!
  expect(chasse.lisiblePar(a, anna)).toBe(true)
  expect(chasse.lisiblePar(a, bob)).toBe(false)
  addPion({ placeId: salle, characterId: bob, x: 0.65, y: 0.5 })
  expect(chasse.lisiblePar(a, bob)).toBe(true)
  addMur({ placeId: salle, nature: 'mur', pts: [[0.55, 0], [0.55, 1]] })
  expect(chasse.lisiblePar(a, bob)).toBe(false)
  addPion({ placeId: salle, characterId: bob, x: 0.5, y: 0.8 })
  expect(chasse.lisiblePar(a, bob)).toBe(false)
})
