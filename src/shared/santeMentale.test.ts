import { expect, it } from 'vitest'
import type { Modif } from './modifs'
import { lireCampagne } from './reglages'
import {
  EVENEMENTS_DEFAUT,
  SM_DEFAUT,
  activiteDe,
  cibleDesEntites,
  estFolie,
  lireSm,
  modifsDuPalier,
  palierDe,
  palierPose,
  perteApresJet,
  tirerGain
} from './santeMentale'

const r = SM_DEFAUT
it('le jet de Volonté décide de la perte', () => {
  expect(perteApresJet(5, 20, 25, r)).toBe(-2) // 20 naturel : +2
  expect(perteApresJet(5, 14, 12, r)).toBe(3) // réussite : moitié arrondie au-dessus
  expect(perteApresJet(10, 14, 12, r)).toBe(5)
  expect(perteApresJet(5, 9, 11, r)).toBe(5) // échec : tout
  expect(perteApresJet(5, 1, 4, r)).toBe(10) // 1 naturel : tout +5
})
it('trouve le palier, même mal réglé', () => {
  expect(palierDe(100, r.paliers).nom).toBe('Stable')
  expect(palierDe(76, r.paliers).nom).toBe('Stable')
  expect(palierDe(75, r.paliers).nom).toBe('Ébranlé')
  expect(palierDe(26, r.paliers).nom).toBe('Hallucinations')
  expect(palierDe(1, r.paliers).nom).toBe('Terreur')
  expect(palierDe(0, r.paliers).nom).toBe('Rupture')
  expect(palierDe(-4, r.paliers).nom).toBe('Rupture')
  expect(palierDe(50, [{ ...r.paliers[0], min: 60 }]).nom).toBe('Stable') // aucun min ≤ sm : le plus bas
})
it('remplace les malus du palier sans toucher aux autres', () => {
  const main = { id: 'x', valeur: 2, raison: 'Béni', caracKey: null, duree: { genre: 'retrait' } } as Modif
  const halluc = palierDe(40, r.paliers)
  const apres = modifsDuPalier([main], halluc)
  expect(apres).toContainEqual(main)
  expect(apres.filter((m) => m.id.startsWith('sm-palier-'))).toEqual([
    expect.objectContaining({ valeur: -2, caracKey: 'per', raison: 'SM — Hallucinations', duree: { genre: 'retrait' } })
  ])
  expect(modifsDuPalier(apres, palierDe(90, r.paliers))).toEqual([main])
  expect(modifsDuPalier(apres, halluc)).toEqual(apres) // même palier : rien ne se cumule
})
it('folie, cible, activité, gains', () => {
  expect(estFolie(10, r)).toBe(true)
  expect(estFolie(9, r)).toBe(false)
  expect(cibleDesEntites([{ id: 1, sm: 40 }, { id: 2, sm: 31 }])).toBe(2)
  expect(cibleDesEntites([])).toBeNull()
  expect(activiteDe(54, r)).toMatch(/petit phénomène/)
  expect(activiteDe(70, r)).toMatch(/Seulement les déclencheurs/)
  expect(tirerGain('1d10', () => 7)).toBe(7)
  expect(tirerGain(5, () => 1)).toBe(5)
})
it('relit un réglage abîmé sans planter', () => {
  expect(lireSm(undefined)).toEqual(SM_DEFAUT)
  expect(lireSm('pas du json')).toEqual(SM_DEFAUT)
  expect(lireSm(JSON.stringify({ actif: true, seuil: 15 }))).toMatchObject({ actif: true, seuil: 15, chocs: SM_DEFAUT.chocs })
})
it('les défauts sont ceux de l’annexe', () => {
  expect(r.actif).toBe(false)
  expect(r.chocs.map((c) => c.perte)).toEqual([3, 5, 10, 15])
  expect(r.paliers.map((p) => [p.nom, p.min])).toEqual([
    ['Stable', 76],
    ['Ébranlé', 51],
    ['Hallucinations', 26],
    ['Terreur', 1],
    ['Rupture', 0]
  ])
  expect(r.folie.table).toHaveLength(6)
  expect(r.hallucinations).toHaveLength(8)
  expect(EVENEMENTS_DEFAUT).toHaveLength(15)
})

it('la campagne porte le réglage de SM', () => {
  expect(lireCampagne({}).sm).toEqual(SM_DEFAUT)
  expect(lireCampagne({ sm: JSON.stringify({ actif: true }) }).sm.actif).toBe(true)
})
it('des paliers abîmés reprennent ceux de l’annexe', () => {
  expect(lireSm(JSON.stringify({ paliers: [] })).paliers).toEqual(SM_DEFAUT.paliers)
  expect(lireSm(JSON.stringify({ paliers: [1] })).paliers).toEqual(SM_DEFAUT.paliers)
  expect(lireSm(JSON.stringify({ chocs: [null], prix: [{}], recups: ['x'] })).chocs).toEqual(SM_DEFAUT.chocs)
})
it('un malus de palier retouché dans les Paramètres se réécrit sur la fiche', () => {
  const halluc = palierDe(40, r.paliers)
  const poses = modifsDuPalier([], halluc)
  const retouche = { ...halluc, malus: [{ valeur: -3, caracKey: 'per' }] }
  expect(modifsDuPalier(poses, retouche)).toEqual([expect.objectContaining({ valeur: -3, caracKey: 'per' })])
  const autreCarac = { ...halluc, malus: [{ valeur: -2, caracKey: 'dex' }] }
  expect(modifsDuPalier(poses, autreCarac)).toEqual([expect.objectContaining({ valeur: -2, caracKey: 'dex' })])
})
it('reconnaît le palier dont la fiche porte les malus', () => {
  const main = { id: 'x', valeur: 2, raison: 'Béni', caracKey: null, duree: { genre: 'retrait' } } as Modif
  expect(palierPose([main], r.paliers)).toBeNull()
  expect(palierPose(undefined, r.paliers)).toBeNull()
  expect(palierPose(modifsDuPalier([main], palierDe(40, r.paliers)), r.paliers)?.id).toBe('hallucinations')
  expect(palierPose(modifsDuPalier([], palierDe(10, r.paliers)), r.paliers)?.id).toBe('terreur')
})
it('le climax laisse décocher le possédé', () => {
  expect(EVENEMENTS_DEFAUT.find((e) => e.nom.startsWith('Climax'))).toMatchObject({ tous: false, note: 'Tous sauf le possédé' })
})
