import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { activer, fermerBaseEssai, lieu, objet, ouvrirBaseEssai, pj, placer, seance } from './base'

/* L'écran et les téléphones : on n'en garde que ce que le moteur lit ou appelle. */
vi.mock('../../display', () => ({
  ratioEcran: () => 1,
  getState: () => ({ placeId: null }),
  versMj: vi.fn(),
  chasseABouge: vi.fn(),
  ecouterPions: vi.fn(),
  setFenetreChasse: vi.fn()
}))
vi.mock('../../mobile', () => ({
  repereDuPlan: () => ({ w: 1000, h: 1000 }),
  broadcast: vi.fn()
}))

import * as chasse from '../../chasse'
import * as parole from '../../parole'
import { getDb } from '../index'
import * as objets from '../repos/objets'
import { addPion } from '../repos/pions'
import type { OutilChasse } from '@shared/chasse'

let s: number
let salle: number
beforeEach(() => {
  ouvrirBaseEssai()
  s = seance('S1')
  activer(s)
  salle = lieu('Salle', s)
})
afterEach(() => {
  parole.oublier()
  chasse.oublier()
  fermerBaseEssai()
})

function outil(nom: string, quoi: OutilChasse): number {
  const o = objet(s, nom)
  objets.updateObjet(o, { outil: quoi })
  return o
}
function enMain(o: number, perso: number): number {
  const pl = placer(o, s, { port: 'pj', characterId: perso, etat: 'porte' })
  getDb().prepare(`UPDATE objet_placement SET emplacement = 'main-d' WHERE id = ?`).run(pl)
  return pl
}
function pose(o: number, x: number, y: number): number {
  const pl = placer(o, s, { port: 'lieu', placeId: salle, etat: 'trouve' })
  getDb().prepare(`UPDATE objet_placement SET pos_x = ?, pos_y = ? WHERE id = ?`).run(x, y, pl)
  return pl
}
/* Sans échelle, le plan fait 30 m de large : 0,1 de largeur = 3 m. */
function joueurEn(nom: string, x: number): number {
  const c = pj(nom)
  addPion({ placeId: salle, characterId: c, x, y: 0.5 })
  return c
}

it('une spirit box dans un sac ne parle pas ; éteinte non plus ; en main, oui', () => {
  const bob = joueurEn('Bob', 0.5)
  const sb = outil('Spirit box', 'spiritbox')
  const pl = placer(sb, s, { port: 'pj', characterId: bob, etat: 'porte' })
  chasse.recalculer(false)
  expect(parole.dire(sb, 'Partez')).toBe('Elle est dans un sac.')
  getDb().prepare(`UPDATE objet_placement SET emplacement = 'main-d', eteinte = 1 WHERE id = ?`).run(pl)
  chasse.recalculer(false)
  expect(parole.dire(sb, 'Partez')).toBe('Elle est éteinte.')
  getDb().prepare(`UPDATE objet_placement SET eteinte = 0 WHERE id = ?`).run(pl)
  chasse.recalculer(false)
  expect(parole.dire(sb, 'Partez')).toBeNull()
  expect(parole.paroleDe(bob)).toEqual([expect.objectContaining({ objetId: sb, outil: 'spiritbox', dit: expect.objectContaining({ texte: 'Partez' }) })])
})

it('personne ne tient l’outil : rien ne part', () => {
  const livre = outil('Livre', 'livre')
  placer(livre, s, { port: 'lieu', placeId: salle, etat: 'trouve' })
  chasse.recalculer(false)
  expect(parole.ecrire(livre, { id: 't', texte: 'Viens' })).toBe('Personne ne le tient.')
})

it('un livre posé : seul le joueur proche voit ses pages', () => {
  const pres = joueurEn('Près', 0.52)
  const loin = joueurEn('Loin', 0.9)
  const livre = outil('Livre', 'livre')
  pose(livre, 0.5, 0.5)
  chasse.recalculer(false)
  expect(parole.ecrire(livre, { id: 't', texte: 'Elle est là', ecriture: 'reenie', taille: 1, angle: -2 })).toBeNull()
  const vu = parole.paroleDe(pres)
  expect(vu).toHaveLength(1)
  expect(vu[0].pages).toEqual([expect.objectContaining({ texte: 'Elle est là', ecriture: 'reenie', taille: 1, angle: -2 })])
  expect(parole.paroleDe(loin)).toEqual([])
})

it('le livre change de main : le nouveau porteur voit les pages déjà écrites', () => {
  const anna = joueurEn('Anna', 0.5)
  const bob = joueurEn('Bob', 0.5)
  const livre = outil('Livre', 'livre')
  const pl = enMain(livre, anna)
  chasse.recalculer(false)
  parole.ecrire(livre, { id: 't', texte: 'Premier passage' })
  getDb().prepare(`UPDATE objet_placement SET character_id = ? WHERE id = ?`).run(bob, pl)
  chasse.recalculer(false)
  expect(parole.paroleDe(bob)[0].pages?.map((p) => p.texte)).toEqual(['Premier passage'])
  expect(parole.paroleDe(anna)).toEqual([])
})

it('la goutte part de la case où elle était', () => {
  const bob = joueurEn('Bob', 0.5)
  const planche = outil('Planche', 'planche')
  enMain(planche, bob)
  chasse.recalculer(false)
  expect(parole.viser(planche, 'A')).toBeNull()
  expect(parole.viser(planche, 'B')).toBeNull()
  expect(parole.paroleDe(bob)[0].goutte).toEqual(expect.objectContaining({ de: 'A', vers: 'B' }))
})

it('montrer le livre à la table, puis le retirer ; le tarot s’ajoute carte après carte', () => {
  const bob = joueurEn('Bob', 0.5)
  const livre = outil('Livre', 'livre')
  enMain(livre, bob)
  chasse.recalculer(false)
  parole.ecrire(livre, { id: 't', texte: 'Ici' })
  parole.montrer({ sorte: 'livre', objetId: livre })
  expect(parole.fenetreDeLaTable()).toEqual(
    expect.objectContaining({ sorte: 'livre', objetId: livre, pages: [expect.objectContaining({ texte: 'Ici' })] })
  )
  parole.montrer(null)
  expect(parole.fenetreDeLaTable()).toBeNull()
  parole.tirerTarot('16-la-maison-dieu', 'Tout tombe.')
  parole.tirerTarot('17-l-etoile', 'Un espoir.')
  expect(parole.fenetreDeLaTable()).toEqual({
    sorte: 'tarot',
    cartes: [
      { arcane: '16-la-maison-dieu', texte: 'Tout tombe.' },
      { arcane: '17-l-etoile', texte: 'Un espoir.' }
    ]
  })
  parole.retirerTarot()
  expect(parole.fenetreDeLaTable()).toBeNull()
})

/* ---------------- relecture finale ---------------- */

it('une spirit box allumée rangée dans un sac se tait, et le moteur le dit', () => {
  const bob = joueurEn('Bob', 0.5)
  const sb = outil('Spirit box', 'spiritbox')
  const pl = placer(sb, s, { port: 'pj', characterId: bob, etat: 'porte' })
  chasse.recalculer(false)
  const a = chasse.appareils().find((x) => x.placementId === pl)!
  expect(a.dansLeSac).toBe(true)
  expect(a.gain).toBe(0)
})

it('un livre caché (pas encore trouvé) ne se montre à personne, même tout près', () => {
  const pres = joueurEn('Près', 0.51)
  const livre = outil('Journal', 'livre')
  const pl = placer(livre, s, { port: 'lieu', placeId: salle, etat: 'cache' })
  getDb().prepare(`UPDATE objet_placement SET pos_x = 0.5, pos_y = 0.5 WHERE id = ?`).run(pl)
  chasse.recalculer(false)
  expect(parole.paroleDe(pres)).toEqual([])
})

it('changer de campagne retire aussi la fenêtre de la table', async () => {
  const display = await import('../../display')
  parole.tirerTarot('16-la-maison-dieu', 'Tout tombe.')
  vi.mocked(display.setFenetreChasse).mockClear()
  parole.oublier()
  expect(display.setFenetreChasse).toHaveBeenCalledWith(null)
})
