import { expect, it } from 'vitest'
import { texteGuide } from './guideEcriture'

const base = {
  seance: 'Séance 6 - La forêt',
  base: 'Séance 6 - La forêt',
  racine: 'D:\\JDR\\Chasse',
  modele: 'Séance 5 - Le Jardin de Jade',
  version: '1.8.0',
  fiche: {
    stats: ['FOR', 'DEX'],
    jauges: ['Points de vie', 'Santé mentale'],
    competences: ['Occulte', 'Lampe UV — perception ≥ 11']
  }
}

it('nomme la séance, ses dossiers et la version', () => {
  const t = texteGuide(base)
  expect(t).toContain('# Écrire « Séance 6 - La forêt » pour l’Écran du Maître')
  expect(t).toContain('`D:\\JDR\\Chasse\\.ecran-du-maitre\\Séance 6 - La forêt\\`')
  expect(t).toContain('`D:\\JDR\\Chasse\\Séance 6 - La forêt\\Objets\\`')
  expect(t).toContain('version 1.8.0')
  expect(t).not.toMatch(/\{\{[A-Z_]+\}\}/)
})

it('reprend la fiche de personnage de la campagne', () => {
  const t = texteGuide(base)
  expect(t).toContain('**Caractéristiques** : FOR, DEX')
  expect(t).toContain('**Jauges** : Points de vie, Santé mentale')
  expect(t).toContain('**Compétences** : Occulte, Lampe UV — perception ≥ 11')
  expect(t).toContain('Points de vie : 10 / 10')
})

it('désigne la séance d’avant comme modèle', () => {
  expect(texteGuide(base)).toContain('`D:\\JDR\\Chasse\\.ecran-du-maitre\\Séance 5 - Le Jardin de Jade\\`')
  expect(texteGuide({ ...base, modele: null })).not.toContain('servent de modèles')
})

it('une séance sans dossier range tout à la racine', () => {
  const t = texteGuide({ ...base, base: null })
  expect(t).toContain('`D:\\JDR\\Chasse\\.ecran-du-maitre\\`')
  expect(t).toContain('`D:\\JDR\\Chasse\\Objets\\`')
  expect(t).toContain('"Maps/plan.jpg"')
})
