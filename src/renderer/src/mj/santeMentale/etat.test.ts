import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CAMPAGNE_DEFAUT } from '@shared/reglages'
import { SM_DEFAUT } from '@shared/santeMentale'
import type { Character, SheetTemplate } from '@shared/types'
import type { Modif } from '@shared/modifs'
import { useStore } from '../store'
import { monde, useSm } from './etat'

const LEA = 1
const TOM = 2
const T0 = 1_000_000_000_000

/** Les personnages tels que le main les tient : `adjust` les borne, comme lui. */
let fiches: Map<number, Character>
let jdr: {
  characters: { adjust: ReturnType<typeof vi.fn>; setModifs: ReturnType<typeof vi.fn> }
  rolls: { record: ReturnType<typeof vi.fn> }
  mots: { ecrire: ReturnType<typeof vi.fn> }
  sm: { onJet: ReturnType<typeof vi.fn> }
}

const pj = (id: number, name: string, sm: number, modifs: Modif[] = []): Character =>
  ({
    id,
    name,
    kind: 'pj',
    present: true,
    horsJeu: false,
    data: {
      gauges: { sm: { value: sm, max: 100 }, pilules: { value: 3, max: 5 } },
      stats: { vlt: 1 },
      skills: {},
      states: {},
      modifs
    }
  }) as unknown as Character

const sheet = {
  id: 1,
  name: 'Harrow Mill',
  builtin: false,
  spec: {
    rollSystem: 'd20-plus',
    sanityGauge: 'sm',
    gauges: [
      { key: 'sm', label: 'SM', min: 0, max: 100, color: 'iris' },
      { key: 'pilules', label: 'Pilules', min: 0, max: 5, color: 'moss' }
    ],
    stats: [],
    skills: []
  }
} as unknown as SheetTemplate

const copie = (id: number): Character => structuredClone(fiches.get(id)!)

beforeEach(() => {
  fiches = new Map([
    [LEA, pj(LEA, 'Léa', 80)],
    [TOM, pj(TOM, 'Tom', 52, [{ id: 'beni', valeur: 2, raison: 'Béni', caracKey: null, duree: { genre: 'retrait' } }])]
  ])
  jdr = {
    characters: {
      adjust: vi.fn(async (id: number, key: string, delta: number) => {
        const g = fiches.get(id)!.data.gauges[key]
        g.value = Math.max(0, Math.min(g.max, g.value + delta))
        return { character: copie(id), log: [] }
      }),
      setModifs: vi.fn(async (id: number, modifs: Modif[]) => {
        fiches.get(id)!.data.modifs = modifs
        return copie(id)
      })
    },
    rolls: { record: vi.fn(async () => ({})) },
    mots: { ecrire: vi.fn(async () => []) },
    sm: { onJet: vi.fn(() => () => undefined) }
  }
  vi.stubGlobal('window', { jdr })
  useStore.setState({
    characters: [copie(LEA), copie(TOM)],
    players: [{ id: 10, uid: 'u', name: 'Julie', color: null, characterId: LEA }],
    sheet,
    reglages: { ...CAMPAGNE_DEFAUT, sm: { ...structuredClone(SM_DEFAUT), actif: true } }
  })
  useSm.setState({
    attentes: [],
    alertes: [],
    chronos: {},
    halluA: {},
    folies: {},
    pilules: {},
    recupsFaites: {},
    nausees: {}
  })
  monde.maintenant = () => T0
  monde.de = () => 1
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const sm = () => useSm.getState()
const deltasSm = (): number[] =>
  jdr.characters.adjust.mock.calls.filter((c) => c[1] === 'sm').map((c) => c[2] as number)

describe('useSm', () => {
  it('déclarer un choc moyen sur Léa puis recevoir {die:14,total:12}', async () => {
    sm().declarerChoc('Ombres au bord du faisceau', 5, [LEA])
    expect(sm().attentes).toHaveLength(1)
    await sm().recevoirJet({ characterId: LEA, caracKey: 'vlt', die: 14, total: 12 })
    expect(jdr.characters.adjust).toHaveBeenCalledWith(LEA, 'sm', -3, expect.any(String))
    expect(sm().attentes).toHaveLength(0)
  })

  it("un jet FOR n'est pas consommé", async () => {
    sm().declarerChoc('Ombres', 5, [LEA])
    await sm().recevoirJet({ characterId: LEA, caracKey: 'for', die: 14, total: 12 })
    expect(jdr.characters.adjust).not.toHaveBeenCalled()
    expect(sm().attentes).toHaveLength(1)
    expect(sm().attentes[0].joueurs[0].resultat).toBeNull()
  })

  it('deux attentes sur Léa : deux jets servent dans l’ordre', async () => {
    sm().declarerChoc('Premier', 5, [LEA])
    sm().declarerChoc('Second', 4, [LEA])
    await sm().recevoirJet({ characterId: LEA, caracKey: 'vlt', die: 14, total: 12 })
    expect(sm().attentes.map((a) => a.titre)).toEqual(['Second'])
    await sm().recevoirJet({ characterId: LEA, caracKey: 'vlt', die: 5, total: 6 })
    expect(deltasSm()).toEqual([-3, -4])
    expect(sm().attentes).toHaveLength(0)
  })

  it('perte faisant passer Tom (52) sous 51', async () => {
    sm().declarerChoc('Pas au-dessus', 3, [TOM])
    await sm().recevoirJet({ characterId: TOM, caracKey: 'vlt', die: 5, total: 6 })
    const alerte = sm().alertes.find((a) => a.genre === 'palier')
    expect(alerte).toMatchObject({ genre: 'palier', characterId: TOM, sm: 49, montee: false })
    expect(alerte && alerte.genre === 'palier' && alerte.palier.id).toBe('hallucinations')
    const modifs = jdr.characters.setModifs.mock.calls.at(-1)![1] as Modif[]
    expect(modifs).toContainEqual(expect.objectContaining({ id: 'beni' }))
    expect(modifs).toContainEqual(
      expect.objectContaining({ id: expect.stringMatching(/^sm-palier-/), valeur: -2, caracKey: 'per' })
    )
    expect(sm().halluA[TOM]).toBe(T0 + 15 * 60_000)

    /* Léa, de 80 sous 76 : Ébranlé, −1 en DEX. */
    sm().declarerChoc('Ombres', 5, [LEA])
    await sm().recevoirJet({ characterId: LEA, caracKey: 'vlt', die: 5, total: 6 })
    const ebranle = sm().alertes.find((a) => a.genre === 'palier' && a.characterId === LEA)
    expect(ebranle && ebranle.genre === 'palier' && ebranle.palier.nom).toBe('Ébranlé')
    expect(jdr.characters.setModifs).toHaveBeenLastCalledWith(LEA, [
      expect.objectContaining({ id: expect.stringMatching(/^sm-palier-/), valeur: -1, caracKey: 'dex' })
    ])
  })

  it('perte réelle de 10 : une attente folie, puis un jet raté tire l’effet', async () => {
    sm().declarerChoc('Les yeux verts', 10, [LEA])
    await sm().recevoirJet({ characterId: LEA, caracKey: 'vlt', die: 5, total: 6 })
    expect(deltasSm()).toEqual([-10])
    expect(sm().attentes).toHaveLength(1)
    expect(sm().attentes[0].raison).toBe('folie')
    monde.de = () => 3
    await sm().recevoirJet({ characterId: LEA, caracKey: 'vlt', die: 4, total: 5 })
    const folie = sm().alertes.find((a) => a.genre === 'folie')
    expect(folie && folie.genre === 'folie' && folie.effet).toContain('Il hurle')
    expect(sm().folies[LEA]?.effet).toContain('Il hurle')
    expect(deltasSm()).toEqual([-10])
    expect(sm().attentes).toHaveLength(0)
  })

  it('tick après échéance d’un chrono « −2 / min », puis arreterChrono', async () => {
    const prix = SM_DEFAUT.prix.find((p) => p.id === 'seul-noir')!
    await sm().declarerPrix(prix, [TOM])
    expect(jdr.characters.adjust).not.toHaveBeenCalled()
    await sm().tick(T0 + 30_000)
    expect(jdr.characters.adjust).not.toHaveBeenCalled()
    await sm().tick(T0 + 60_000)
    expect(jdr.characters.adjust).toHaveBeenCalledWith(TOM, 'sm', -2, expect.any(String))
    sm().arreterChrono(TOM, 'seul-noir')
    await sm().tick(T0 + 10 * 60_000)
    expect(deltasSm()).toEqual([-2])
  })

  it('deux pilules en 10 min : nausée', async () => {
    const pilule = SM_DEFAUT.recups.find((r) => r.pilule)!
    monde.de = () => 4
    await sm().recuperer(pilule, [LEA])
    expect(sm().alertes.some((a) => a.genre === 'nausee')).toBe(false)
    monde.maintenant = () => T0 + 10 * 60_000
    await sm().recuperer(pilule, [LEA])
    expect(sm().alertes).toContainEqual(expect.objectContaining({ genre: 'nausee', characterId: LEA }))
    expect(jdr.characters.setModifs).toHaveBeenLastCalledWith(
      LEA,
      expect.arrayContaining([expect.objectContaining({ id: 'sm-nausee', valeur: -2, caracKey: null })])
    )
    expect(jdr.characters.adjust).toHaveBeenCalledWith(LEA, 'pilules', -1, expect.any(String))
    expect(fiches.get(LEA)!.data.gauges.pilules.value).toBe(1)
    expect(deltasSm()).toEqual([4, 4])

    /* La nausée passe après sa durée. */
    await sm().tick(T0 + 41 * 60_000)
    expect(fiches.get(LEA)!.data.modifs?.some((m) => m.id === 'sm-nausee')).toBe(false)
  })
})
