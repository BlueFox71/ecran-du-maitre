import { describe, expect, it } from 'vitest'
import { modifOuvertureAutorisee, murVerrouille, planDeSynchro } from './synchro'
import type { CalqueDerive } from './atelier'
import type { Mur, Ouverture } from './types'

const mur = (id: number, atelierId: string | null, nature: Mur['nature'] = 'mur'): Mur => ({
  id,
  placeId: 1,
  nature,
  pts: [
    [0, 0],
    [1, 0]
  ],
  ouvert: false,
  atelierId
})

const ouverture = (id: number, murId: number, atelierId: string | null): Ouverture => ({
  id,
  murId,
  nature: 'porte',
  d: 0.5,
  largeur: 0.05,
  ouverte: true,
  verrouillee: true,
  nom: 'Porte de la cave',
  atelierId
})

const derive = (c: Partial<CalqueDerive>): CalqueDerive => ({ murs: [], ouvertures: [], ...c })

describe('planDeSynchro', () => {
  it('une porte déjà là est modifiée, pas recréée : son id survit', () => {
    const plan = planDeSynchro(
      derive({
        murs: [{ atelierId: 'm1', nature: 'mur', pts: [[0, 0], [1, 0]] }],
        ouvertures: [{ atelierId: 'o1', murAtelierId: 'm1', nature: 'porte', d: 0.7, largeur: 0.06 }]
      }),
      [mur(3, 'm1')],
      [ouverture(7, 3, 'o1')]
    )
    expect(plan.ouvertures.ajouter).toEqual([])
    expect(plan.ouvertures.retirer).toEqual([])
    expect(plan.ouvertures.modifier).toEqual([
      { id: 7, d: { atelierId: 'o1', murAtelierId: 'm1', nature: 'porte', d: 0.7, largeur: 0.06 } }
    ])
    expect(plan.murs.modifier.map((m) => m.id)).toEqual([3])
  })

  it('un trait fait main n’est jamais retiré ni modifié', () => {
    const plan = planDeSynchro(derive({}), [mur(3, null, 'rideau')], [ouverture(9, 3, null)])
    expect(plan.murs.retirer).toEqual([])
    expect(plan.murs.modifier).toEqual([])
    expect(plan.ouvertures.retirer).toEqual([])
  })

  it('un mur bâti supprimé de la construction est retiré', () => {
    const plan = planDeSynchro(derive({}), [mur(4, 'm9')], [])
    expect(plan.murs.retirer).toEqual([4])
  })

  it('un meuble qui cesse de bloquer retire son obstacle', () => {
    const plan = planDeSynchro(derive({}), [mur(5, 'obj:lit', 'obstacle')], [])
    expect(plan.murs.retirer).toEqual([5])
  })

  it('un nouveau mur et sa porte sont à ajouter', () => {
    const d = derive({
      murs: [{ atelierId: 'm2', nature: 'mur', pts: [[0, 0], [0, 1]] }],
      ouvertures: [{ atelierId: 'o2', murAtelierId: 'm2', nature: 'vitre', d: 0.5, largeur: 0.1 }]
    })
    const plan = planDeSynchro(d, [], [])
    expect(plan.murs.ajouter).toEqual(d.murs)
    expect(plan.ouvertures.ajouter).toEqual(d.ouvertures)
  })

  it('une porte bâtie enlevée de la construction est retirée', () => {
    const plan = planDeSynchro(
      derive({ murs: [{ atelierId: 'm1', nature: 'mur', pts: [[0, 0], [1, 0]] }] }),
      [mur(3, 'm1')],
      [ouverture(7, 3, 'o1')]
    )
    expect(plan.ouvertures.retirer).toEqual([7])
  })
})

describe('le verrou de l’atelier', () => {
  it('un mur de l’atelier est verrouillé, un trait fait main non', () => {
    expect(murVerrouille(mur(1, 'm1'))).toBe(true)
    expect(murVerrouille(mur(2, null))).toBe(false)
  })
  it('une porte de l’atelier s’ouvre, se verrouille et se nomme, mais ne se déplace pas', () => {
    const o = ouverture(7, 3, 'o1')
    expect(modifOuvertureAutorisee(o, { ouverte: true })).toBe(true)
    expect(modifOuvertureAutorisee(o, { verrouillee: true, ouverte: false })).toBe(true)
    expect(modifOuvertureAutorisee(o, { nom: 'Porte de la cave' })).toBe(true)
    expect(modifOuvertureAutorisee(o, { d: 0.3 })).toBe(false)
    expect(modifOuvertureAutorisee(o, { largeur: 0.1 })).toBe(false)
  })
  it('une ouverture faite main se modifie librement', () => {
    expect(modifOuvertureAutorisee(ouverture(8, 3, null), { d: 0.3, largeur: 0.1 })).toBe(true)
  })
})
