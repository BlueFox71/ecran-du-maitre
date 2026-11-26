import { describe, expect, it } from 'vitest'
import { calendrier, dureePassage, lettresEcrites, positionGoutte } from './temps'
import { REPOS, TOUTES_LES_CASES } from '../../mj/chasse/spiritisme'
import type { Passage } from '@shared/parole'

const passage = (id: number, texte: string, debut: number): Passage => ({
  id,
  texte,
  ecriture: 'helpme',
  taille: 1,
  angle: 0,
  debut
})

describe('le livre, à l’heure', () => {
  it('rien avant le début, tout après la durée du passage', () => {
    const p = passage(1, 'Elle est là', 1000)
    expect(lettresEcrites(p, 1000, 999)).toBe(0)
    expect(lettresEcrites(p, 1000, 1000 + dureePassage(p))).toBe(p.texte.length)
    const mi = lettresEcrites(p, 1000, 1000 + dureePassage(p) / 2)
    expect(mi).toBeGreaterThan(0)
    expect(mi).toBeLessThan(p.texte.length)
  })
  it('deux appareils au même instant voient la même chose (pas de hasard)', () => {
    const p = passage(7, 'Je suis encore ici', 0)
    expect(lettresEcrites(p, 0, 900)).toBe(lettresEcrites(p, 0, 900))
  })
  it('un passage lancé pendant un autre attend qu’il soit fini', () => {
    const a = passage(1, 'Premier', 0)
    const b = passage(2, 'Second', 100)
    const c = calendrier([a, b])
    expect(c[0].debut).toBe(0)
    expect(c[1].debut).toBe(dureePassage(a))
  })
})

describe('la goutte, à l’heure', () => {
  const A = TOUTES_LES_CASES.find((x) => x.id === 'A')!
  const B = TOUTES_LES_CASES.find((x) => x.id === 'B')!
  it('au repos sans goutte, sur la case de départ au début, sur la case visée à la fin', () => {
    expect(positionGoutte(null, 0)).toMatchObject({ x: REPOS.x, y: REPOS.y })
    const g = { de: 'A', vers: 'B', debut: 1000 }
    expect(positionGoutte(g, 1000)).toMatchObject({ x: A.x, y: A.y })
    expect(positionGoutte(g, 1000 + 60000)).toMatchObject({ x: B.x, y: B.y })
  })
})
