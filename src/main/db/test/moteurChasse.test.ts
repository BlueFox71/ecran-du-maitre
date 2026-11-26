import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { activer, fermerBaseEssai, lieu, objet, ouvrirBaseEssai, pj, pnj, placer, seance } from './base'

/* L'écran et les téléphones : on n'en garde que ce que le moteur lit ou appelle. */
const ecran = vi.hoisted(() => ({ placeId: null as number | null, ratio: 1 }))
vi.mock('../../display', () => ({
  ratioEcran: () => ecran.ratio,
  getState: () => ({ placeId: ecran.placeId }),
  versMj: vi.fn(),
  chasseABouge: vi.fn(),
  ecouterPions: vi.fn()
}))
vi.mock('../../mobile', () => ({
  repereDuPlan: () => ({ w: 1000, h: 1000 }),
  broadcast: vi.fn()
}))
/* Les pions, tels quels — on ne fait que compter qui les relit tous. */
vi.mock('../repos/pions', async (importOriginal) => {
  const m = await importOriginal<typeof import('../repos/pions')>()
  return { ...m, pionsPartout: vi.fn(m.pionsPartout) }
})
/* La construction aussi : on compte combien de fois elle est relue. */
vi.mock('../repos/construction', async (importOriginal) => {
  const m = await importOriginal<typeof import('../repos/construction')>()
  return { ...m, getConstruction: vi.fn(m.getConstruction) }
})

import * as display from '../../display'
import * as mobile from '../../mobile'
import * as chasse from '../../chasse'
import { getDb } from '../index'
import * as objets from '../repos/objets'
import { addPion, pionsPartout } from '../repos/pions'
import { addMur } from '../repos/murs'
import { getConstruction, setConstruction } from '../repos/construction'
import * as reglages from '../repos/reglages'
import { gainSon, type AppareilChasse, type OutilChasse } from '@shared/chasse'
import type { Construction } from '@shared/atelier'

let s: number
let salle: number

beforeEach(() => {
  ouvrirBaseEssai()
  s = seance('S1')
  activer(s)
  salle = lieu('Salle', s)
  ecran.placeId = salle
  ecran.ratio = 1
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

function outil(nom: string, quoi: OutilChasse): number {
  const o = objet(s, nom)
  objets.updateObjet(o, { outil: quoi })
  return o
}

/** Tenu en main : à lui, et dans sa main droite (sans emplacement, il serait dans son sac). */
function enMain(o: number, perso: number): number {
  const pl = placer(o, s, { port: 'pj', characterId: perso, etat: 'porte' })
  getDb().prepare(`UPDATE objet_placement SET emplacement = 'main-d' WHERE id = ?`).run(pl)
  return pl
}

function dansLeSac(o: number, perso: number): number {
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
  chasse.plansChanges()
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
  expect(mobile.broadcast).not.toHaveBeenCalled()
})

/** L'écouteur que le moteur inscrit auprès de l'écran : un pas de pion. */
function pasDePion(): (placeId: number | null) => void {
  chasse.brancher()
  const f = vi.mocked(display.ecouterPions).mock.calls.at(-1)![0]
  vi.clearAllMocks()
  return f
}

it('un pas de pion, EMF en main sur un même niveau : rien ne part vers la table ni les téléphones', () => {
  construire(salle, { emf: [{ id: 't', valeur: 3, rayon: 4, pts: [[5, 5]] }] })
  const anna = pj('Anna')
  const pion = addPion({ placeId: salle, characterId: anna, x: 0.5, y: 0.5 })
  enMain(outil('EMF', 'emf'), anna)
  const pas = pasDePion()
  pas(salle)
  /* Le premier calcul : le MJ l'apprend, l'état de la table change sans partir. */
  expect(display.versMj).toHaveBeenCalledTimes(1)
  expect(display.chasseABouge).toHaveBeenCalledWith(expect.any(Array), false)
  vi.clearAllMocks()
  for (const x of [0.52, 0.54]) {
    getDb().prepare(`UPDATE pion SET x = ? WHERE id = ?`).run(x, pion.id)
    pas(salle)
  }
  /* La position a changé : le MJ, une fois par pas ; la valeur non : personne d'autre. */
  expect(display.versMj).toHaveBeenCalledTimes(2)
  expect(display.chasseABouge).not.toHaveBeenCalled()
  expect(mobile.broadcast).not.toHaveBeenCalled()
})

it('une valeur qui change sur un pas de pion met la table à jour sans diffuser', () => {
  construire(salle)
  const anna = pj('Anna')
  const pion = addPion({ placeId: salle, characterId: anna, x: 0.1, y: 0.1 })
  enMain(outil('EMF', 'emf'), anna)
  const pas = pasDePion()
  pas(salle)
  vi.clearAllMocks()
  getDb().prepare(`UPDATE pion SET x = 0.5, y = 0.5 WHERE id = ?`).run(pion.id)
  pas(salle)
  expect(display.chasseABouge).toHaveBeenCalledTimes(1)
  expect(display.chasseABouge).toHaveBeenCalledWith(expect.any(Array), false)
  expect(mobile.broadcast).not.toHaveBeenCalled()
})

it('une séance sans outil ne lit pas les pions et ne dit rien', () => {
  addPion({ placeId: salle, characterId: pj('Anna'), x: 0.5, y: 0.5 })
  objet(s, 'Clé')
  const pas = pasDePion()
  vi.mocked(pionsPartout).mockClear()
  pas(salle)
  chasse.recalculer()
  expect(chasse.appareils()).toEqual([])
  expect(pionsPartout).not.toHaveBeenCalled()
  expect(display.versMj).not.toHaveBeenCalled()
  expect(display.chasseABouge).not.toHaveBeenCalled()
  expect(mobile.broadcast).not.toHaveBeenCalled()
})

it("la table ne reçoit pas un appareil posé qui n'est pas trouvé", () => {
  const o = outil('EMF', 'emf')
  const vu = pose(o, salle, 0.2, 0.2)
  const cache = pose(o, salle, 0.8, 0.8)
  getDb().prepare(`UPDATE objet_placement SET etat = 'cache' WHERE id = ?`).run(cache)
  chasse.recalculer()
  const envoyes = vi.mocked(display.chasseABouge).mock.calls[0][0].map((a) => a.placementId)
  expect(envoyes).toContain(vu)
  expect(envoyes).not.toContain(cache)
  /* Le MJ, lui, les voit tous. */
  expect(chasse.appareils().map((a) => a.placementId)).toEqual(expect.arrayContaining([vu, cache]))
})

it("un pion dans une bande de l'écran s'entend d'où il est, sans être ramené au bord", () => {
  /* Écran deux fois plus large que le plan carré : x = 0,99 à l'écran tombe à 1,48 sur le plan. */
  ecran.ratio = 2
  construire(salle, { emf: [{ id: 't', valeur: 4, rayon: 1.5, pts: [[10, 5]] }] })
  const pl = pose(outil('EMF', 'emf'), salle, 0.99, 0.5)
  addPion({ placeId: salle, characterId: pj('Anna'), x: 0.99, y: 0.5 })
  expect(de(pl)!.valeur).toBe(4)
  expect(de(pl)!.gain).toBeCloseTo(gainSon(0.49 * 30, 0), 5)
})

it('lisiblePar : le porteur, ou un pion proche sans mur', () => {
  construire(salle)
  const anna = pj('Anna')
  const bob = pj('Bob')
  addPion({ placeId: salle, characterId: anna, x: 0.5, y: 0.5 })
  const pl = pose(outil('EMF', 'emf'), salle, 0.5, 0.5)
  const a = de(pl)!
  expect(chasse.lisiblePar(a, anna, chasse.contexte())).toBe(true)
  expect(chasse.lisiblePar(a, bob)).toBe(false)
  addPion({ placeId: salle, characterId: bob, x: 0.65, y: 0.5 })
  expect(chasse.lisiblePar(a, bob)).toBe(true)
  addMur({ placeId: salle, nature: 'mur', pts: [[0.55, 0], [0.55, 1]] })
  chasse.plansChanges()
  expect(chasse.lisiblePar(a, bob)).toBe(false)
  addPion({ placeId: salle, characterId: bob, x: 0.5, y: 0.8 })
  expect(chasse.lisiblePar(a, bob)).toBe(false)
})

/* ---------------- poser et ramasser depuis le téléphone ---------------- */

const exemplaire = (id: number) => objets.exemplairesOutils().find((e) => e.placementId === id)

it("poser met l'EMF sous le pion, trouvé, posé par lui", () => {
  const anna = pj('Anna')
  addPion({ placeId: salle, characterId: anna, x: 0.3, y: 0.4 })
  const pl = enMain(outil('EMF', 'emf'), anna)
  expect(chasse.poserOutil(anna, pl)).toBeNull()
  expect(exemplaire(pl)).toMatchObject({ port: 'lieu', placeId: salle, posePar: anna, trouve: true, pos: { x: 0.3, y: 0.4 } })
  expect(de(pl)).toMatchObject({ ou: 'lieu', characterId: anna })
})

it("poser d'une pile de deux n'en pose qu'un", () => {
  const anna = pj('Anna')
  addPion({ placeId: salle, characterId: anna, x: 0.3, y: 0.4 })
  const o = outil('EMF', 'emf')
  const pl = placer(o, s, { port: 'pj', characterId: anna, etat: 'porte', qte: 2 })
  expect(chasse.poserOutil(anna, pl)).toBeNull()
  const tous = objets.exemplairesOutils()
  expect(tous.filter((e) => e.port === 'lieu')).toHaveLength(1)
  expect(tous.filter((e) => e.port === 'pj')).toHaveLength(1)
  expect(getDb().prepare(`SELECT qte FROM objet_placement WHERE id = ?`).get(pl)).toEqual({ qte: 1 })
})

it("on ne pose pas l'EMF d'un autre, ni sans pion", () => {
  const anna = pj('Anna')
  const bob = pj('Bob')
  addPion({ placeId: salle, characterId: anna, x: 0.3, y: 0.4 })
  const pl = enMain(outil('EMF', 'emf'), anna)
  expect(chasse.poserOutil(bob, pl)).not.toBeNull()
  expect(exemplaire(pl)!.port).toBe('pj')
  const cleo = pj('Cléo')
  const sien = enMain(outil('Thermo', 'thermometre'), cleo)
  expect(chasse.poserOutil(cleo, sien)).toMatch(/pion/)
})

function posee(): { anna: number; bob: number; pl: number } {
  const anna = pj('Anna')
  const bob = pj('Bob')
  addPion({ placeId: salle, characterId: anna, x: 0.5, y: 0.5 })
  addPion({ placeId: salle, characterId: bob, x: 0.505, y: 0.5 })
  const pl = enMain(outil('EMF', 'emf'), anna)
  expect(chasse.poserOutil(anna, pl)).toBeNull()
  chasse.recalculer(false)
  return { anna, bob, pl }
}

it('ramasser à côté : il passe dans les mains de celui qui le ramasse', () => {
  const { bob, pl } = posee()
  expect(chasse.ramasserOutil(bob, pl)).toBeNull()
  expect(exemplaire(pl)).toMatchObject({ port: 'pj', characterId: bob, posePar: null })
})

it('ramasser trop loin est refusé', () => {
  const { pl } = posee()
  const loin = pj('Loin')
  addPion({ placeId: salle, characterId: loin, x: 0.7, y: 0.5 })
  expect(chasse.ramasserOutil(loin, pl)).toMatch(/Approche-toi/)
  expect(exemplaire(pl)!.port).toBe('lieu')
})

it('ramasser à travers un mur est refusé', () => {
  const { bob, pl } = posee()
  addMur({ placeId: salle, nature: 'mur', pts: [[0.5025, 0], [0.5025, 1]] })
  chasse.plansChanges()
  expect(chasse.ramasserOutil(bob, pl)).toMatch(/mur/)
  expect(exemplaire(pl)!.port).toBe('lieu')
})

it("deux ramassages : le second est refusé et l'EMF n'est pas dupliqué", () => {
  const { anna, bob, pl } = posee()
  expect(chasse.ramasserOutil(bob, pl)).toBeNull()
  expect(chasse.ramasserOutil(anna, pl)).toBe('Quelqu’un l’a déjà ramassé.')
  expect(objets.exemplairesOutils()).toHaveLength(1)
  expect(exemplaire(pl)).toMatchObject({ port: 'pj', characterId: bob })
})

it("le téléphone liste ses outils, et les appareils posés du lieu affiché", () => {
  const { anna, bob, pl } = posee()
  const lire = chasse.lecteurTelephones()
  const a = lire(anna, salle)
  expect(a.outils).toEqual([expect.objectContaining({ placementId: pl, ou: 'lieu', nom: 'EMF' })])
  expect(a.appareilsPoses).toEqual([expect.objectContaining({ placementId: pl, outil: 'emf' })])
  /* Bob n'en a posé aucun, mais le voit sur le plan. */
  expect(lire(bob, salle).outils).toEqual([])
  expect(lire(bob, salle).appareilsPoses).toHaveLength(1)
  expect(lire(bob, null).appareilsPoses).toEqual([])
  /* Anna s'éloigne : son EMF posé ne se lit plus. */
  getDb().prepare(`UPDATE pion SET x = 0.9 WHERE character_id = ?`).run(anna)
  chasse.recalculer(false)
  expect(chasse.lecteurTelephones()(anna, salle).outils[0].valeur).toBeNull()
})

it("le téléphone garde l'outil qu'il porte même sans pion, sans valeur", () => {
  const anna = pj('Anna')
  const pl = enMain(outil('EMF', 'emf'), anna)
  chasse.recalculer(false)
  expect(chasse.lecteurTelephones()(anna, salle).outils).toEqual([
    expect.objectContaining({ placementId: pl, ou: 'main', valeur: null })
  ])
})

/* ---------------- les plans gardés d'un calcul à l'autre ---------------- */

it('la construction est relue une fois pour plusieurs pas de pion, et de nouveau après un changement de lieu', () => {
  construire(salle)
  const anna = pj('Anna')
  const pion = addPion({ placeId: salle, characterId: anna, x: 0.5, y: 0.5 })
  const pl = enMain(outil('EMF', 'emf'), anna)
  const pas = pasDePion()
  vi.mocked(getConstruction).mockClear()
  for (const x of [0.5, 0.52, 0.54, 0.56]) {
    getDb().prepare(`UPDATE pion SET x = ? WHERE id = ?`).run(x, pion.id)
    pas(salle)
  }
  chasse.lecteurTelephones()(anna, salle)
  expect(getConstruction).toHaveBeenCalledTimes(1)
  /* L'atelier repeint la zone : sans l'oublier, le moteur lirait l'ancienne. */
  construire(salle, { emf: [{ id: 't', valeur: 2, rayon: 4, pts: [[5, 5]] }] })
  chasse.plansChanges()
  pas(salle)
  expect(getConstruction).toHaveBeenCalledTimes(2)
  expect(de(pl)!.valeur).toBe(2)
})

it('juger qui lit un appareil posé ne relit pas la construction', () => {
  construire(salle)
  const { anna, pl } = posee()
  const a = de(pl)!
  chasse.plansChanges()
  vi.mocked(getConstruction).mockClear()
  expect(chasse.lisiblePar(a, anna)).toBe(true)
  expect(getConstruction).not.toHaveBeenCalled()
})

it('un terrain bâti donne sa largeur en mètres : cases × mètres par case', () => {
  /* 10 cases de 1 m : 0,1 de largeur = 1 m, quand l'échelle par défaut en dirait 3. */
  construire(salle, { metresParCase: 1 })
  const pl = pose(outil('EMF', 'emf'), salle, 0.5, 0.5)
  addPion({ placeId: salle, characterId: pj('Anna'), x: 0.8, y: 0.5 })
  expect(de(pl)!.gain).toBeCloseTo(gainSon(3, 0), 5)
})

it('un contrôle ne fait qu’un calcul, et se refuse à un appareil hors du plan', () => {
  construire(salle)
  const pl = pose(outil('EMF', 'emf'), salle, 0.1, 0.1)
  const sansPion = enMain(outil('Thermo', 'thermometre'), pj('Anna'))
  chasse.recalculer()
  vi.mocked(pionsPartout).mockClear()
  chasse.controler(pl, 3)
  expect(pionsPartout).toHaveBeenCalledTimes(1)
  const r = chasse.controler(sansPion, 30).find((a) => a.placementId === sansPion)!
  expect(r).toMatchObject({ ou: 'ailleurs', controle: false })
})

it('un appareil posé dont le MJ a effacé le point reste « posé » sur le téléphone, sans valeur', () => {
  const { anna, pl } = posee()
  getDb().prepare(`UPDATE objet_placement SET pos_x = NULL, pos_y = NULL WHERE id = ?`).run(pl)
  chasse.recalculer(false)
  expect(de(pl)!.ou).toBe('ailleurs')
  expect(chasse.lecteurTelephones()(anna, salle).outils).toEqual([
    expect.objectContaining({ placementId: pl, ou: 'lieu', valeur: null })
  ])
})

it('un appareil posé dans une pièce non découpée se montre sur le lieu parent, comme les objets', () => {
  const piece = lieu('Placard', s)
  getDb().prepare(`UPDATE place SET parent_id = ? WHERE id = ?`).run(salle, piece)
  const pl = pose(outil('EMF', 'emf'), piece, 0.5, 0.5)
  chasse.recalculer(false)
  expect(objets.objetsVus(salle).map((o) => o.id)).toContain(pl)
  expect(chasse.lecteurTelephones()(null, salle).appareilsPoses.map((a) => a.placementId)).toEqual([pl])
})

it('ramasser respecte la place du sac, avec le refus de « prendre »', () => {
  const { bob, pl } = posee()
  reglages.poser('sac.capacite', '1')
  dansLeSac(objet(s, 'Lampe'), bob)
  expect(() => chasse.ramasserOutil(bob, pl)).toThrow(/sac de Bob est plein/)
  expect(exemplaire(pl)!.port).toBe('lieu')
})

it('repeindre depuis le plan ne touche que les zones, et le moteur relit', async () => {
  const { peindreMesures } = await import('../../atelier')
  construire(salle, { sols: [{ id: 's1', assetId: 'parquet', pts: [[1, 1]], rayon: 1 } as never] })
  const e = pose(outil('EMF', 'emf'), salle, 0.5, 0.5)
  expect(de(e)?.valeur).toBe(4)
  peindreMesures(salle, { emf: [{ id: 't2', valeur: 2, rayon: 1.5, pts: [[5, 5]] }], ambiante: 12 })
  chasse.plansChanges()
  chasse.recalculer()
  expect(de(e)?.valeur).toBe(2)
  const c = getConstruction(salle)!
  expect(c.sols).toHaveLength(1)
  expect(c.ambiante).toBe(12)
  expect(c.temperature).toBeUndefined()
})

it('Ctrl+Z défait un trait de zone de chasse, un trait à la fois', async () => {
  const { peindreMesures } = await import('../../atelier')
  const defaire = await import('../../defaire')
  vi.mock('electron', () => ({ BrowserWindow: { getAllWindows: () => [] } }))
  defaire.installer(getDb())
  construire(salle)
  const t = (id: string, valeur: number) => ({ id, valeur, rayon: 1.5, pts: [[5, 5]] as [number, number][] })
  defaire.envelopper('atelier:mesures', () => peindreMesures(salle, { emf: [t('a', 2)] }))
  defaire.envelopper('atelier:mesures', () => peindreMesures(salle, { emf: [t('a', 2), t('b', 3)] }))
  expect(getConstruction(salle)!.emf).toHaveLength(2)
  expect(defaire.defaire()).toBe('Zones de chasse')
  expect(getConstruction(salle)!.emf?.map((x) => x.id)).toEqual(['a'])
  expect(defaire.defaire()).toBe('Zones de chasse')
  expect(getConstruction(salle)!.emf?.map((x) => x.id)).toEqual(['t1'])
  defaire.oublier()
})

it('ramasser : jusqu’à 5 m, pas au-delà (plan de 30 m sans échelle)', () => {
  const { pl } = posee()
  const pres = pj('Près')
  addPion({ placeId: salle, characterId: pres, x: 0.5 + 4 / 30, y: 0.5 })
  expect(chasse.ramasserOutil(pres, pl)).toBeNull()
})

it('ramasser à 6 m est refusé', () => {
  const { pl } = posee()
  const loin = pj('Six')
  addPion({ placeId: salle, characterId: loin, x: 0.5 + 6 / 30, y: 0.5 })
  expect(chasse.ramasserOutil(loin, pl)).toMatch(/Approche-toi/)
})

it('ramasser par-dessus un meuble bas : on tend le bras au-dessus de la table', () => {
  const { bob, pl } = posee()
  addMur({ placeId: salle, nature: 'obstacle-bas', pts: [[0.5025, 0], [0.5025, 1]] })
  chasse.plansChanges()
  expect(chasse.ramasserOutil(bob, pl)).toBeNull()
})

it('le téléphone distingue un appareil tenu en main d’un appareil rangé dans le sac', () => {
  const bob = pj('Bob')
  addPion({ placeId: salle, characterId: bob, x: 0.5, y: 0.5 })
  const tenu = enMain(outil('EMF', 'emf'), bob)
  const range = dansLeSac(outil('Thermo', 'thermometre'), bob)
  chasse.recalculer(false)
  const { outils } = chasse.lecteurTelephones()(bob, salle)
  expect(outils.find((o) => o.placementId === tenu)?.ou).toBe('main')
  expect(outils.find((o) => o.placementId === range)?.ou).toBe('sac')
})

it('ramasser met l’appareil dans une main libre ; mains prises, dans le sac', () => {
  const { bob, pl } = posee()
  expect(chasse.ramasserOutil(bob, pl)).toBeNull()
  const main1 = getDb().prepare(`SELECT emplacement FROM objet_placement WHERE id = ?`).get(pl) as { emplacement: string | null }
  expect(['main-g', 'main-d']).toContain(main1.emplacement)
})

it('ramasser, les deux mains prises : il va dans le sac', () => {
  const { bob, pl } = posee()
  const a = enMain(objet(s, 'Lampe'), bob)
  const b = enMain(objet(s, 'Dague'), bob)
  getDb().prepare(`UPDATE objet_placement SET emplacement = 'main-g' WHERE id = ?`).run(a)
  getDb().prepare(`UPDATE objet_placement SET emplacement = 'main-d' WHERE id = ?`).run(b)
  expect(chasse.ramasserOutil(bob, pl)).toBeNull()
  const r = getDb().prepare(`SELECT emplacement FROM objet_placement WHERE id = ?`).get(pl) as { emplacement: string | null }
  expect(r.emplacement).toBeNull()
})

/* ---------------- les outils qui parlent (chantier 2) ---------------- */

it('une spirit box allumée en main grésille à plein, sans rien mesurer ; éteinte, elle se tait', () => {
  construire(salle)
  const bob = pj('Bob')
  addPion({ placeId: salle, characterId: bob, x: 0.5, y: 0.5 })
  const sb = enMain(outil('Spirit box', 'spiritbox'), bob)
  chasse.recalculer(false)
  expect(de(sb)).toMatchObject({ ou: 'main', valeur: 0, gain: 1 })
  getDb().prepare(`UPDATE objet_placement SET eteinte = 1 WHERE id = ?`).run(sb)
  chasse.recalculer(false)
  expect(de(sb)?.gain).toBe(0)
})

it('le livre et la planche ne mesurent rien et ne font aucun bruit', () => {
  construire(salle)
  const bob = pj('Bob')
  addPion({ placeId: salle, characterId: bob, x: 0.5, y: 0.5 })
  const livre = enMain(outil('Livre', 'livre'), bob)
  const planche = enMain(outil('Planche', 'planche'), bob)
  chasse.recalculer(false)
  expect(de(livre)).toMatchObject({ valeur: 0, gain: 0 })
  expect(de(planche)).toMatchObject({ valeur: 0, gain: 0 })
})

it('on ne prend pas le contrôle d’un outil qui ne mesure rien', () => {
  const bob = pj('Bob')
  addPion({ placeId: salle, characterId: bob, x: 0.5, y: 0.5 })
  const livre = enMain(outil('Livre', 'livre'), bob)
  chasse.controler(livre, 3)
  expect(de(livre)?.controle).toBe(false)
})

it('un outil rangé dans les poches s’éteint ; repris en main, il reste éteint', () => {
  const bob = pj('Bob')
  addPion({ placeId: salle, characterId: bob, x: 0.5, y: 0.5 })
  const emf = dansLeSac(outil('EMF', 'emf'), bob)
  const tenu = enMain(outil('Thermo', 'thermometre'), bob)
  chasse.recalculer(false)
  const eteinte = (pl: number): number =>
    (getDb().prepare(`SELECT eteinte FROM objet_placement WHERE id = ?`).get(pl) as { eteinte: number }).eteinte
  expect(eteinte(emf)).toBe(1)
  expect(de(emf)?.allume).toBe(false)
  expect(eteinte(tenu)).toBe(0)
  getDb().prepare(`UPDATE objet_placement SET emplacement = 'main-g' WHERE id = ?`).run(emf)
  chasse.recalculer(false)
  expect(de(emf)?.allume).toBe(false)
})
