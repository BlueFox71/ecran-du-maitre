import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CAMPAGNE_DEFAUT } from '@shared/reglages'
import { SM_DEFAUT } from '@shared/santeMentale'
import type { Character, SheetTemplate } from '@shared/types'
import type { Modif } from '@shared/modifs'
import { useStore } from '../store'
import { monde, suivreCampagne, useSm } from './etat'

const LEA = 1
const TOM = 2
const T0 = 1_000_000_000_000

/** Les personnages tels que le main les tient : `adjust` les borne, comme lui. */
let fiches: Map<number, Character>
/** Posée par un test : `adjust` écrit tout de suite mais ne répond qu'à son ouverture. */
let barriere: Promise<void> | null
let jdr: {
  characters: {
    adjust: ReturnType<typeof vi.fn>
    setModifs: ReturnType<typeof vi.fn>
    setModifsJeu: ReturnType<typeof vi.fn>
    get: ReturnType<typeof vi.fn>
  }
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
        const character = copie(id)
        if (barriere) await barriere
        return { character, log: [] }
      }),
      setModifs: vi.fn(async (id: number, modifs: Modif[]) => {
        fiches.get(id)!.data.modifs = modifs
        return copie(id)
      }),
      setModifsJeu: vi.fn(async (id: number, modifs: Modif[]) => {
        fiches.get(id)!.data.modifs = modifs
        return copie(id)
      }),
      get: vi.fn(async (id: number) => copie(id))
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
    reglages: { ...CAMPAGNE_DEFAUT, sm: { ...structuredClone(SM_DEFAUT), actif: true } },
    toasts: []
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
  barriere = null
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
    const modifs = jdr.characters.setModifsJeu.mock.calls.at(-1)![1] as Modif[]
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
    expect(jdr.characters.setModifsJeu).toHaveBeenLastCalledWith(LEA, [
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
    expect(jdr.characters.setModifsJeu).toHaveBeenLastCalledWith(
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

  it('la fin d’une nausée pendant une écriture de palier : malus gardé, nausée retirée', async () => {
    const nausee: Modif = { id: 'sm-nausee', valeur: -2, raison: 'SM — Nausée', caracKey: null, duree: { genre: 'retrait' } }
    fiches.get(LEA)!.data.modifs = [nausee]
    useStore.setState({ characters: [copie(LEA), copie(TOM)] })
    useSm.setState({ nausees: { [LEA]: T0 } })
    let ouvrir!: () => void
    barriere = new Promise((r) => (ouvrir = r))
    /* Léa passe de 80 à 70 (Ébranlé) ; adjust est en vol quand la nausée finit. */
    const perte = sm().appliquer(LEA, -10, 'Les yeux verts')
    await Promise.resolve()
    const tick = sm().tick(T0 + 1)
    ouvrir()
    await Promise.all([perte, tick])
    const modifs = fiches.get(LEA)!.data.modifs ?? []
    expect(modifs).toContainEqual(expect.objectContaining({ id: expect.stringMatching(/^sm-palier-ebranle-/), valeur: -1 }))
    expect(modifs.some((m) => m.id === 'sm-nausee')).toBe(false)
  })

  it('la descente dans un palier qui hallucine propose une hallucination, à envoyer ou changer', async () => {
    useStore.setState({ players: [{ id: 11, uid: 'v', name: 'Marc', color: null, characterId: TOM }] })
    await sm().appliquer(TOM, -3, 'Pas au-dessus')
    const alerte = sm().alertes.find((a) => a.genre === 'palier')!
    expect(alerte.genre === 'palier' && alerte.texte).toBe(SM_DEFAUT.hallucinations[0])
    monde.de = () => 2
    sm().autreHallucination(alerte.id)
    const changee = sm().alertes.find((a) => a.id === alerte.id)!
    expect(changee.genre === 'palier' && changee.texte).toBe(SM_DEFAUT.hallucinations[2])
    monde.maintenant = () => T0 + 5 * 60_000
    await sm().envoyerHallucination(alerte.id)
    expect(jdr.mots.ecrire).toHaveBeenCalledWith([11], SM_DEFAUT.hallucinations[2], null, true, true)
    const apres = sm().alertes.find((a) => a.id === alerte.id)!
    expect(apres.genre === 'palier' && apres.texte).toBeFalsy()
    expect(sm().halluA[TOM]).toBe(T0 + 20 * 60_000)

    /* À la remontée, rien n'est proposé. */
    await sm().appliquer(TOM, 10, 'Fin heureuse')
    const montee = sm().alertes.find((a) => a.genre === 'palier' && a.montee)!
    expect(montee.genre === 'palier' && montee.texte).toBeUndefined()
  })

  it('nouvelleScene rend les récupérations de scène, nouvelleNuit toutes', async () => {
    const encens = SM_DEFAUT.recups.find((r) => r.id === 'encens')!
    const chapelle = SM_DEFAUT.recups.find((r) => r.id === 'chapelle')!
    await sm().recuperer(encens, [LEA])
    await sm().recuperer(chapelle, [LEA])
    await sm().recuperer(encens, [LEA])
    expect(deltasSm()).toEqual([5, 5])
    sm().nouvelleScene()
    await sm().recuperer(encens, [LEA])
    await sm().recuperer(chapelle, [LEA])
    expect(deltasSm()).toEqual([5, 5, 5])
    sm().nouvelleNuit()
    await sm().recuperer(chapelle, [LEA])
    expect(deltasSm()).toEqual([5, 5, 5, 5])
  })

  it('une entrée « tous » vaut pour tous les présents, cochés ou non', async () => {
    const tous = { id: 1, sessionId: 1, ord: 0, nom: 'Corde refusée', note: 'Tous', perte: 3, jet: true, tous: true }
    await sm().declarerPrix(tous, [LEA])
    expect(sm().attentes[0].joueurs.map((j) => j.characterId)).toEqual([LEA, TOM])
    const respect = SM_DEFAUT.prix.find((p) => p.id === 'manque-respect')!
    await sm().declarerPrix(respect, [LEA])
    expect(jdr.characters.adjust.mock.calls.map((c) => c[0])).toEqual([LEA, TOM])
    /* Sans « tous », la coche décide. */
    const climax = { ...tous, id: 2, nom: 'Climax', tous: false }
    await sm().declarerPrix(climax, [TOM])
    expect(sm().attentes[1].joueurs.map((j) => j.characterId)).toEqual([TOM])
  })

  it('une jauge changée hors du module : le palier se rattrape au tick suivant', async () => {
    fiches.get(TOM)!.data.gauges.sm.value = 40
    useStore.setState({ characters: [copie(LEA), copie(TOM)] })
    await sm().tick(T0)
    const modifs = fiches.get(TOM)!.data.modifs ?? []
    expect(modifs).toContainEqual(expect.objectContaining({ id: 'beni' }))
    expect(modifs).toContainEqual(
      expect.objectContaining({ id: expect.stringMatching(/^sm-palier-hallucinations-/), valeur: -2, caracKey: 'per' })
    )
    expect(jdr.characters.setModifs).not.toHaveBeenCalled()
    expect(sm().halluA[TOM]).toBe(T0 + 15 * 60_000)
    expect(sm().alertes).toContainEqual(expect.objectContaining({ genre: 'palier', characterId: TOM, montee: false }))
    /* Léa, à 80, est Stable : rien à poser, rien à dire. */
    expect(sm().alertes.filter((a) => a.characterId === LEA)).toEqual([])
    /* Déjà d'accord : un second tick n'écrit rien. */
    const n = jdr.characters.setModifsJeu.mock.calls.length
    await sm().tick(T0 + 1000)
    expect(jdr.characters.setModifsJeu.mock.calls.length).toBe(n)
    expect(sm().alertes.filter((a) => a.genre === 'palier')).toHaveLength(1)
  })

  it('un malus de palier retiré par un défaire revient à la perte suivante', async () => {
    await sm().appliquer(TOM, -3, 'Pas au-dessus')
    /* Le défaire a rendu à Tom ses anciennes modifs, sans malus de palier. */
    fiches.get(TOM)!.data.modifs = [{ id: 'beni', valeur: 2, raison: 'Béni', caracKey: null, duree: { genre: 'retrait' } }]
    useStore.setState({ characters: [copie(LEA), copie(TOM)] })
    await sm().appliquer(TOM, -1, 'Ombres')
    expect(fiches.get(TOM)!.data.modifs).toContainEqual(expect.objectContaining({ id: 'sm-palier-hallucinations-0' }))
  })

  it('module éteint : le tick ne fait rien', async () => {
    const prix = SM_DEFAUT.prix.find((p) => p.id === 'seul-noir')!
    await sm().declarerPrix(prix, [TOM])
    useSm.setState({ halluA: { [LEA]: T0 } })
    useStore.setState((s) => ({ reglages: { ...s.reglages, sm: { ...s.reglages.sm, actif: false } } }))
    await sm().tick(T0 + 5 * 60_000)
    expect(jdr.characters.adjust).not.toHaveBeenCalled()
    expect(jdr.characters.get).not.toHaveBeenCalled()
    expect(sm().alertes).toEqual([])
  })

  it('le module éteint lâche ce qui court ; une autre campagne repart de rien', () => {
    useStore.setState({ campaign: { id: 1, name: 'A', system: null } })
    const fin = suivreCampagne()
    try {
      useSm.setState({
        chronos: { [TOM]: [{ prixId: 'seul-noir', prochainA: T0 }] },
        halluA: { [TOM]: T0 },
        pilules: { [LEA]: [T0] }
      })
      sm().declarerChoc('Ombres', 5, [LEA])
      useStore.setState((s) => ({ reglages: { ...s.reglages, sm: { ...s.reglages.sm, actif: false } } }))
      expect(sm()).toMatchObject({ chronos: {}, halluA: {}, attentes: [], alertes: [] })
      expect(sm().pilules[LEA]).toEqual([T0])
      useStore.setState({ campaign: { id: 2, name: 'B', system: null } })
      expect(sm().pilules).toEqual({})
    } finally {
      fin()
    }
  })

  it('un chrono ne court pas sur un absent', async () => {
    const prix = SM_DEFAUT.prix.find((p) => p.id === 'seul-noir')!
    await sm().declarerPrix(prix, [TOM])
    useStore.setState((s) => ({ characters: s.characters.map((c) => (c.id === TOM ? { ...c, present: false } : c)) }))
    await sm().tick(T0 + 60_000)
    expect(jdr.characters.adjust).not.toHaveBeenCalled()
    expect(sm().chronos[TOM] ?? []).toEqual([])
  })

  it('après une veille, un chrono ne rattrape qu’un intervalle', async () => {
    const prix = SM_DEFAUT.prix.find((p) => p.id === 'seul-noir')!
    await sm().declarerPrix(prix, [TOM])
    await sm().tick(T0 + 10 * 60_000)
    expect(deltasSm()).toEqual([-2])
    await sm().tick(T0 + 10 * 60_000 + 1000)
    expect(deltasSm()).toEqual([-2])
    expect(sm().chronos[TOM][0].prochainA).toBe(T0 + 11 * 60_000)
    await sm().tick(T0 + 11 * 60_000)
    expect(deltasSm()).toEqual([-2, -2])
  })

  it('une écriture ratée prévient le MJ et ne bloque pas la suivante', async () => {
    jdr.characters.adjust.mockRejectedValueOnce(new Error('base occupée'))
    await sm().appliquer(LEA, -3, 'Ombres')
    expect(useStore.getState().toasts).toContainEqual(
      expect.objectContaining({ msg: 'Santé mentale : la perte de Léa n’a pas pu s’écrire.', error: true })
    )
    await sm().appliquer(TOM, -1, 'Ombres')
    expect(fiches.get(TOM)!.data.gauges.sm.value).toBe(51)
    /* Dans une déclaration de groupe, l'échec de l'un n'arrête pas les autres. */
    jdr.characters.adjust.mockRejectedValueOnce(new Error('base occupée'))
    await sm().declarerPrix(SM_DEFAUT.prix.find((p) => p.id === 'manque-respect')!, [])
    expect(fiches.get(TOM)!.data.gauges.sm.value).toBe(46)
  })

  it('un personnage sans jauge de SM n’est jamais visé', () => {
    const sansJauge = { ...copie(LEA), id: 3, name: 'Chien' }
    sansJauge.data = { ...sansJauge.data, gauges: { pilules: { value: 1, max: 5 } } }
    useStore.setState((s) => ({ characters: [...s.characters, sansJauge] }))
    sm().declarerChoc('Ombres', 5, [])
    expect(sm().attentes[0].joueurs.map((j) => j.characterId)).toEqual([LEA, TOM])
  })

  it('saisir un jet sur une carac absente de la fiche : le MJ est prévenu', async () => {
    sm().declarerChoc('Ombres', 5, [LEA])
    await sm().saisirJet(sm().attentes[0].id, LEA, 12)
    expect(jdr.rolls.record).not.toHaveBeenCalled()
    expect(useStore.getState().toasts.some((t) => t.error && t.msg.includes('vlt'))).toBe(true)
    useStore.setState({
      sheet: { ...sheet, spec: { ...sheet.spec, stats: [{ key: 'vlt', label: 'Volonté', code: 'VLT' }] } } as SheetTemplate
    })
    await sm().saisirJet(sm().attentes[0].id, LEA, 12)
    expect(jdr.rolls.record).toHaveBeenCalled()
  })

  it('chaque retrait d’un chrono s’annonce, sans carte dans la vue', async () => {
    const prix = SM_DEFAUT.prix.find((p) => p.id === 'seul-noir')!
    await sm().declarerPrix(prix, [TOM])
    await sm().tick(T0 + 60_000)
    await sm().tick(T0 + 120_000)
    const annonces = useStore.getState().toasts.filter((t) => !t.error && /perd 2 SM/.test(t.msg))
    expect(annonces).toHaveLength(2)
    /* Seule carte : Tom passe de 52 à 48, en Hallucinations. Les pertes n'en posent pas. */
    expect(sm().alertes.map((a) => a.genre)).toEqual(['palier'])
  })

  it('une perte déclarée par le MJ ne s’annonce pas', async () => {
    const fixe = SM_DEFAUT.prix.find((p) => p.intervalleMin === null && !p.tous)!
    await sm().declarerPrix(fixe, [LEA])
    expect(deltasSm()).toEqual([-fixe.perte])
    expect(useStore.getState().toasts.filter((t) => !t.error)).toEqual([])
  })

  it('un chrono en pause ne retire rien, et repart avec ce qu’il lui restait', async () => {
    const prix = SM_DEFAUT.prix.find((p) => p.id === 'seul-noir')!
    await sm().declarerPrix(prix, [TOM])
    monde.maintenant = () => T0 + 20_000
    sm().basculerPause(TOM, 'seul-noir')
    await sm().tick(T0 + 10 * 60_000)
    expect(deltasSm()).toEqual([])
    monde.maintenant = () => T0 + 10 * 60_000
    sm().basculerPause(TOM, 'seul-noir')
    expect(sm().chronos[TOM][0]).toEqual({ prixId: 'seul-noir', prochainA: T0 + 10 * 60_000 + 40_000 })
    await sm().tick(T0 + 10 * 60_000 + 40_000)
    expect(deltasSm()).toEqual([-2])
  })

  it('rectifier à la main : la valeur est posée, le palier suit, sans folie ni annonce', async () => {
    await sm().rectifier(LEA, 40)
    expect(jdr.characters.adjust).toHaveBeenCalledWith(LEA, 'sm', -40, 'Rectifié à la main')
    expect(sm().attentes).toEqual([])
    expect(useStore.getState().toasts.filter((t) => !t.error)).toEqual([])
    const lea = useStore.getState().characters.find((c) => c.id === LEA)!
    expect(lea.data.modifs).toContainEqual(expect.objectContaining({ caracKey: 'per', valeur: -2 }))
  })
})
