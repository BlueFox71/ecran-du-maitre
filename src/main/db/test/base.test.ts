import { afterEach, beforeEach, expect, it } from 'vitest'
import { fermerBaseEssai, inventaire, objet, ouvrirBaseEssai, placer, seance } from './base'

let db: ReturnType<typeof ouvrirBaseEssai>
beforeEach(() => {
  db = ouvrirBaseEssai()
})
afterEach(() => fermerBaseEssai())

it('ouvre une base neuve', () => {
  expect((db.prepare(`SELECT COUNT(*) AS n FROM campaign`).get() as { n: number }).n).toBe(1)
})

it.todo('les fabriques posent un objet dans un inventaire')
