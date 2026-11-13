import { describe, expect, it } from 'vitest'
import { slug } from './Palette'

describe('slug', () => {
  it('donne le nom de fichier de l’icône d’un rayon', () => {
    expect(slug('Toiles d’araignées')).toBe('toiles-d-araignees')
    expect(slug('Lumière')).toBe('lumiere')
    expect(slug('Livres et papiers')).toBe('livres-et-papiers')
  })
})
