import { describe, expect, it } from 'vitest'
import { AMBIANCE_NEUTRE, ambianceVide, lireAmbiance, momentDe } from './ambiance'

describe('lireAmbiance', () => {
  it('rend la neutre pour rien, du bruit ou du JSON cassé', () => {
    expect(lireAmbiance(null)).toEqual(AMBIANCE_NEUTRE)
    expect(lireAmbiance('{oups')).toEqual(AMBIANCE_NEUTRE)
    expect(lireAmbiance(42)).toEqual(AMBIANCE_NEUTRE)
  })

  it('lit une ambiance enregistrée en JSON', () => {
    expect(lireAmbiance('{"teinte":"#3D5F9E","force":0.6,"meteo":"pluie","meteoForce":0.8}')).toEqual({
      teinte: '#3d5f9e',
      force: 0.6,
      meteo: 'pluie',
      meteoForce: 0.8
    })
  })

  it('borne les forces et refuse une teinte ou un temps inconnus', () => {
    expect(lireAmbiance({ teinte: 'bleu', force: 3, meteo: 'grêle', meteoForce: -1 })).toEqual({
      teinte: null,
      force: 1,
      meteo: 'aucune',
      meteoForce: 0
    })
  })
})

describe('ambianceVide', () => {
  it('ne peint rien sans teinte ni temps', () => {
    expect(ambianceVide(null)).toBe(true)
    expect(ambianceVide(AMBIANCE_NEUTRE)).toBe(true)
    expect(ambianceVide({ ...AMBIANCE_NEUTRE, teinte: '#3d5f9e' })).toBe(false)
    expect(ambianceVide({ ...AMBIANCE_NEUTRE, meteo: 'neige' })).toBe(false)
    expect(ambianceVide({ ...AMBIANCE_NEUTRE, meteo: 'neige', meteoForce: 0 })).toBe(true)
  })
})

describe('momentDe', () => {
  it('reconnaît un moment à son ciel et à sa couleur', () => {
    expect(momentDe('soleil', null)?.cle).toBe('jour')
    expect(momentDe('lune', '#3D5F9E')?.cle).toBe('nuit-claire')
    expect(momentDe('nuit', '#1d2a4a')?.cle).toBe('nuit-noire')
  })

  it('ne reconnaît rien d’un réglage à soi', () => {
    expect(momentDe('soleil', '#123456')).toBeNull()
    expect(momentDe(null, null)).toBeNull()
  })
})
