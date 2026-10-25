import { expect, it } from 'vitest'
import { fusionnerRegles } from './regles'
import type { TemplateSpec } from './types'

const base: TemplateSpec = { rollSystem: 'd20-plus', gauges: [], stats: [], skills: [], skillLimit: null }
it('garde la composition du brouillon et les règles courantes', () => {
  const brouillon = {
    ...base,
    rollSystem: 'd100-under' as const,
    stats: [{ key: 'for', label: 'Force' }] as TemplateSpec['stats'],
    sansCompetences: true
  }
  const courant = { ...base, skillLimit: 4, sanityGauge: 'sm' }
  const r = fusionnerRegles(brouillon, courant)
  expect(r.stats).toEqual(brouillon.stats)
  expect(r.rollSystem).toBe('d20-plus')
  expect(r.skillLimit).toBe(4)
  expect(r.sanityGauge).toBe('sm')
  expect('sansCompetences' in r).toBe(false)
})
