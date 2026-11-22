import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Place } from '@shared/types'
import { lieuDansLaForme, nommerPiece, piecesDuPlan } from './pieces'

const lieu = (o: Partial<Place> & { id: number; name: string }): Place =>
  ({ tier: 'lieu', parentId: null, zone: null, ancre: null, pieceUnique: false, mapItemId: 1, ...o }) as Place

const carre: [number, number][] = [
  [0.1, 0.1],
  [0.4, 0.1],
  [0.4, 0.4],
  [0.1, 0.4],
  [0.1, 0.1]
]

describe('nommer une pièce', () => {
  let appels: { quoi: string; args: unknown[] }[]
  beforeEach(() => {
    appels = []
    let n = 100
    vi.stubGlobal('window', {
      jdr: {
        places: {
          upsert: async (input: Partial<Place>) => {
            appels.push({ quoi: 'upsert', args: [input] })
            return { ...input, id: input.id ?? ++n }
          },
          zone: async (...args: unknown[]) => {
            appels.push({ quoi: 'zone', args })
          }
        }
      }
    })
  })

  it('une pièce neuve : le lieu devient étage, la pièce naît dessous avec son contour', async () => {
    const plan = lieu({ id: 1, name: 'Rez-de-chaussée' })
    const ok = await nommerPiece(plan, [plan], carre, [0.2, 0.2], 'Bureau', () => {})
    expect(ok).toBe(true)
    expect(appels[0]).toEqual({ quoi: 'upsert', args: [expect.objectContaining({ id: 1, tier: 'niveau' })] })
    expect(appels[1]).toEqual({
      quoi: 'upsert',
      args: [{ tier: 'lieu', parentId: 1, name: 'Bureau' }]
    })
    expect(appels[2]).toEqual({ quoi: 'zone', args: [101, carre, [0.2, 0.2]] })
  })

  it('une pièce déjà nommée : renommée, son contour remis à jour', async () => {
    const plan = lieu({ id: 1, name: 'Rez-de-chaussée', tier: 'niveau' })
    const bureau = lieu({ id: 7, name: 'Bureau', parentId: 1, zone: carre, ancre: [0.3, 0.3] })
    const tous = [plan, bureau]
    expect(lieuDansLaForme(piecesDuPlan(plan, tous), carre)?.id).toBe(7)
    await nommerPiece(plan, tous, carre, [0.2, 0.2], 'Bureau du gérant', () => {})
    expect(appels).toEqual([
      { quoi: 'upsert', args: [{ id: 7, name: 'Bureau du gérant', tier: 'lieu', parentId: 1 }] },
      { quoi: 'zone', args: [7, carre, [0.2, 0.2]] }
    ])
  })

  it('une pièce unique : c’est le lieu lui-même qu’on renomme', async () => {
    const plan = lieu({ id: 1, name: 'Chapelle', pieceUnique: true })
    await nommerPiece(plan, [plan], carre, [0.2, 0.2], 'Petite chapelle', () => {})
    expect(appels).toEqual([
      { quoi: 'upsert', args: [{ id: 1, tier: 'lieu', parentId: null, name: 'Petite chapelle' }] }
    ])
  })

  it('un bâtiment refuse, avec un message', async () => {
    const espace = lieu({ id: 9, name: 'Dehors', tier: 'espace' })
    const plan = lieu({ id: 1, name: 'Chapelle', parentId: 9 })
    const toast = vi.fn()
    expect(await nommerPiece(plan, [espace, plan], carre, [0.2, 0.2], 'Nef', toast)).toBe(false)
    expect(toast).toHaveBeenCalled()
    expect(appels).toEqual([])
  })
})
