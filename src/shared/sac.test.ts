import { describe, expect, it } from 'vitest'
import { alourdi, etatSac, sacPlein, type LigneSac } from './sac'

const objet = (places: number, qte = 1): LigneSac => ({
  places,
  bonusSac: 0,
  qte,
  emplacement: null
})
const sacADos = (emplacement: string | null): LigneSac => ({
  places: 1,
  bonusSac: 5,
  qte: 1,
  emplacement
})

describe('sac', () => {
  it('un sac à dos tendu à un sac plein ne l’alourdit pas', () => {
    const avant = etatSac([objet(1, 10)], 10)
    const apres = etatSac([objet(1, 10), sacADos(null)], 10)
    expect(sacPlein(apres)).toBe(true)
    expect(alourdi(avant, apres)).toBe(0)
  })

  it('un objet ordinaire tendu à un sac plein l’alourdit', () => {
    const avant = etatSac([objet(1, 10)], 10)
    const apres = etatSac([objet(1, 10), objet(2)], 10)
    expect(alourdi(avant, apres)).toBe(2)
  })

  it('un objet ordinaire l’alourdit même avec un sac à dos rangé', () => {
    const avant = etatSac([objet(1, 10), sacADos(null)], 10)
    const apres = etatSac([objet(1, 11), sacADos(null)], 10)
    expect(alourdi(avant, apres)).toBe(1)
  })

  it('porté, le sac à dos fait la place qu’il prenait', () => {
    const e = etatSac([objet(1, 10), sacADos('dos')], 10)
    expect(e).toMatchObject({ charge: 10, capacite: 15 })
    expect(sacPlein(e)).toBe(false)
  })
})
