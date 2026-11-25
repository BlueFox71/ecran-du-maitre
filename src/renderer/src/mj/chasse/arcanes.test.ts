import { describe, expect, it } from 'vitest'
import { ARCANES, arcaneParFichier, poser } from './arcanes'

describe('Tarot de Marseille', () => {
  it('compte les 22 arcanes majeurs, du Bateleur au Mat, chacun avec son texte', () => {
    expect(ARCANES).toHaveLength(22)
    expect(ARCANES[0].nom).toBe('Le Bateleur')
    expect(ARCANES[21].nom).toBe('Le Mat')
    for (const a of ARCANES) expect(a.texte.length).toBeGreaterThan(20)
    expect(new Set(ARCANES.map((a) => a.fichier)).size).toBe(22)
  })

  it('ajoute une carte au bout du tapis, face cachée, autant qu’on veut', () => {
    let t = poser([], '17-la-lune')
    t = poser(t, '18-le-soleil')
    t = poser(t, '15-la-maison-dieu')
    expect(t.map((c) => c.fichier)).toEqual(['17-la-lune', '18-le-soleil', '15-la-maison-dieu'])
    expect(t.every((c) => !c.retournee)).toBe(true)
  })

  it('ne pose pas deux fois la même carte', () => {
    const t = poser([], '17-la-lune')
    expect(poser(t, '17-la-lune')).toBe(t)
  })

  it('retrouve une carte par son fichier', () => {
    expect(arcaneParFichier('15-la-maison-dieu')?.nom).toBe('La Maison Dieu')
    expect(arcaneParFichier('rien')).toBeUndefined()
  })
})
