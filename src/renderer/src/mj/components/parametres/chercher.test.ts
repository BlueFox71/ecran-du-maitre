import { describe, expect, it } from 'vitest'
import { chercher, normaliser } from './chercher'

const sac = { nom: 'Capacité du sac', aide: 'Les places de chaque personnage', mots: ['inventaire', 'encombrement', 'charge', 'porter', 'emplacements'], chemin: 'La campagne › Règles du jeu' }
const bascule = { nom: 'Manière de basculer, par défaut', mots: ['transition', 'fondu', 'volet'], chemin: 'La campagne › Écran des joueurs' }
const theme = { nom: 'Thème', mots: ['sombre', 'clair', 'couleurs'], chemin: 'Le poste › Le poste' }
const ambiance = { nom: 'Volume de l’ambiance', mots: ['musique', 'son'], chemin: 'La campagne › Écran des joueurs' }
const sons = { nom: 'Volume général des sons', mots: ['bruitages'], chemin: 'La campagne › Sons' }
const tous = [sac, bascule, theme, ambiance, sons]

describe('normaliser', () => {
  it('ôte accents, casse et apostrophes', () => {
    expect(normaliser('Volume de l’Ambiance')).toEqual(['volume', 'de', 'l', 'ambiance'])
    expect(normaliser('THÈME')).toEqual(['theme'])
  })
})

describe('chercher', () => {
  it('trouve par un mot proche', () => expect(chercher(tous, 'porter')).toEqual([sac]))
  it('trouve par l’aide', () => expect(chercher(tous, 'places')).toEqual([sac]))
  it('accepte un début de mot', () => expect(chercher(tous, 'transi')).toEqual([bascule]))
  it('ignore accents et casse', () => expect(chercher(tous, 'theme')).toEqual([theme]))
  it('tous les mots doivent trouver', () => {
    expect(chercher(tous, 'sac capa')).toEqual([sac])
    expect(chercher(tous, 'sac theme')).toEqual([])
  })
  it('« volume » trouve les deux volumes', () => expect(chercher(tous, 'volume')).toEqual([ambiance, sons]))
  it('le nom passe avant les mots proches', () => {
    const a = { nom: 'Fondu', mots: [], chemin: 'x' }
    expect(chercher([bascule, a], 'fondu')).toEqual([a, bascule])
  })
  it('rien pour une recherche vide ou inconnue', () => {
    expect(chercher(tous, '   ')).toEqual([])
    expect(chercher(tous, 'xyz')).toEqual([])
  })
})
