import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fermerBaseEssai, ouvrirBaseEssai } from './base'

vi.mock('../../display', () => ({ versMj: vi.fn(), refreshJoueurs: vi.fn() }))
vi.mock('../../carnet', () => ({ createCarnetPlayer: vi.fn() }))

import * as reglages from '../repos/reglages'
import * as chars from '../repos/characters'
import { lireMonnaies } from '@shared/monnaies'
import type { JoueurWow, EtatWow } from '@shared/wow'
import * as fiches from '../../wowFiches'

beforeEach(() => {
  ouvrirBaseEssai()
  reglages.poser('regles', 'wow')
})
afterEach(() => fermerBaseEssai())

const jokobo = (e: Partial<EtatWow> = {}): JoueurWow[] => [
  {
    id: 'gilibert',
    nom: 'Jokobo',
    enLigne: true,
    classe: 'chaman',
    enregistreLe: null,
    etat: {
      prenom: 'Jokobo',
      nom: "Sabot d'ébène",
      nomPerso: "Jokobo Sabot d'ébène",
      race: 'Tauren',
      classeNom: 'Chaman',
      niveau: 1,
      sexe: 'Homme',
      age: '32',
      histoire: 'Né dans les Mille pointes.',
      pv: 10,
      pvMax: 12,
      argent: { po: 3, pa: 12, pc: 40 },
      auras: [{ nom: 'Bouclier de foudre', mal: false, tours: 3, pile: 1, lbl: '' }],
      ...e
    }
  }
]

const lePerso = () => chars.getCharacter(Number(Object.values(JSON.parse(reglages.tous()['wow.liens']))[0]))!

it('la campagne WoW prend les pièces d’or, d’argent et de cuivre', () => {
  expect(fiches.monnaiesDeWow()).toBe(true)
  expect(lireMonnaies(reglages.tous()['monnaies']).liste.map((m) => m.key)).toEqual(['po', 'pa', 'pc'])
  expect(fiches.monnaiesDeWow()).toBe(false)
})

it('l’identité, la bourse et les effets de l’Aventure arrivent sur la fiche', () => {
  fiches.synchroniser(jokobo())
  const ch = lePerso()
  expect(ch.name).toBe("Jokobo Sabot d'ébène")
  expect(ch.sexe).toBe('homme')
  expect(ch.age).toBe('32')
  expect(ch.biographie).toBe('Né dans les Mille pointes.')
  expect(ch.data.bourse).toMatchObject({ po: 3, pa: 12, pc: 40 })
  expect(ch.data.aurasWow?.map((a) => a.nom)).toEqual(['Bouclier de foudre'])

  /* Puis elle suit : l'Aventure change, la fiche aussi. */
  fiches.synchroniser(jokobo({ age: '33', argent: { po: 5, pa: 0, pc: 0 }, auras: [] }))
  const apres = lePerso()
  expect(apres.age).toBe('33')
  expect(apres.data.bourse).toMatchObject({ po: 5, pa: 0, pc: 0 })
  expect(apres.data.aurasWow).toEqual([])
})

it('une fiche dormante sans histoire n’efface pas celle de l’Écran', () => {
  fiches.synchroniser(jokobo())
  fiches.synchroniser(jokobo({ histoire: undefined, age: undefined, sexe: undefined, pv: 8 }))
  const ch = lePerso()
  expect(ch.biographie).toBe('Né dans les Mille pointes.')
  expect(ch.data.gauges.pv.value).toBe(8)
})

it('hors ligne, l’identité, la bourse et les effets du MJ s’écrivent dans le fichier du joueur', () => {
  fiches.synchroniser(jokobo())
  const ch = lePerso()
  const dossier = mkdtempSync(join(tmpdir(), 'edm-wow-'))
  mkdirSync(join(dossier, 'Sauvegardes', 'Joueurs'), { recursive: true })
  const chemin = join(dossier, 'Sauvegardes', 'Joueurs', 'gilibert.json')
  writeFileSync(
    chemin,
    JSON.stringify({ progress: { perso: { prenom: 'Jokobo', argent: { po: 3, pa: 12, pc: 40 }, auras: [] } } })
  )
  const ctx = { dossier, enLigne: false, deposer: vi.fn() }

  expect(
    fiches.versAventure(ch.id, { age: '40', histoire: 'Exilé.', sexe: 'Homme', argent: { po: 9, pa: 1, pc: 2 } }, ctx)
  ).toBe(true)
  expect(fiches.effetVersAventure(ch.id, { t: 'aura', aura: { nom: 'Étourdi', mal: true, tours: 1 } }, ctx)).toBe(true)

  const perso = JSON.parse(readFileSync(chemin, 'utf8')).progress.perso
  expect(perso).toMatchObject({ age: '40', histoire: 'Exilé.', sexe: 'Homme', argent: { po: 9, pa: 1, pc: 2 } })
  expect(perso.auras.map((a: { nom: string }) => a.nom)).toEqual(['Étourdi'])
  /* La fiche de l'Écran montre l'effet sans attendre l'Aventure. */
  expect(lePerso().data.aurasWow?.map((a) => a.nom)).toContain('Étourdi')

  fiches.effetVersAventure(ch.id, { t: 'retire', nom: 'Étourdi' }, ctx)
  expect(JSON.parse(readFileSync(chemin, 'utf8')).progress.perso.auras).toEqual([])
  expect(ctx.deposer).not.toHaveBeenCalled()
})

it('en ligne, tout passe par la boîte du joueur', () => {
  fiches.synchroniser(jokobo())
  const ch = lePerso()
  const ctx = { dossier: tmpdir(), enLigne: true, deposer: vi.fn() }
  fiches.versAventure(ch.id, { argent: fiches.argentDe({ ...ch, data: { ...ch.data, bourse: { po: 1, pa: 2, pc: 3 } } }) }, ctx)
  expect(ctx.deposer).toHaveBeenCalledWith('gilibert', expect.objectContaining({ t: 'fiche', argent: { po: 1, pa: 2, pc: 3 } }))
  fiches.effetVersAventure(ch.id, { t: 'retire', nom: 'Bouclier de foudre' }, ctx)
  expect(ctx.deposer).toHaveBeenLastCalledWith('gilibert', { t: 'retire', nom: 'Bouclier de foudre' })
})

it('le panneau Aventure arrive d’une Aventure ouverte, et reste quand elle se ferme', () => {
  fiches.synchroniser(
    jokobo({
      equip: [{ c: 'mainD', nom: 'Masse de l’initié', q: 1 }],
      sacs: [{ nom: 'Pain de seigle', q: 1, qte: 5 }],
      talents: [{ nom: 'Fureur des éléments', rang: 2, max: 5 }],
      sorts: [{ nom: 'Horion de terre', niveau: 4 }]
    })
  )
  const av = lePerso().data.aventureWow
  expect(av?.equip[0]).toEqual({ c: 'mainD', nom: 'Masse de l’initié', q: 1 })
  expect(av?.sacs[0]).toEqual({ nom: 'Pain de seigle', q: 1, qte: 5 })
  expect(av?.talents[0]).toEqual({ nom: 'Fureur des éléments', rang: 2, max: 5 })
  expect(av?.sorts[0]).toEqual({ nom: 'Horion de terre', niveau: 4 })

  /* Une fiche dormante (sans sacs ni talents nommés) ne l'efface pas. */
  fiches.synchroniser(jokobo({ pv: 7 }))
  expect(lePerso().data.aventureWow?.sacs).toHaveLength(1)
})

it('un objet donné hors ligne attend dans le courrier du fichier du joueur', () => {
  fiches.synchroniser(jokobo())
  const ch = lePerso()
  const dossier = mkdtempSync(join(tmpdir(), 'edm-wow-'))
  mkdirSync(join(dossier, 'Sauvegardes', 'Joueurs'), { recursive: true })
  const chemin = join(dossier, 'Sauvegardes', 'Joueurs', 'gilibert.json')
  writeFileSync(chemin, JSON.stringify({ progress: { perso: { prenom: 'Jokobo' } } }))
  const ctx = { dossier, enLigne: false, deposer: vi.fn() }

  expect(fiches.objetVersAventure(ch.id, { t: 'objet', o: { id: 1, nom: 'Pain de seigle' }, n: 3 }, ctx)).toBe('en-attente')
  expect(fiches.objetVersAventure(ch.id, { t: 'retireObjet', nom: 'Torche', n: 1 }, ctx)).toBe('en-attente')
  expect(JSON.parse(readFileSync(chemin, 'utf8')).progress.perso.courrierMj).toEqual([
    { t: 'objet', o: { id: 1, nom: 'Pain de seigle' }, n: 3 },
    { t: 'retireObjet', nom: 'Torche', n: 1 }
  ])

  const enLigne = { dossier, enLigne: true, deposer: vi.fn() }
  expect(fiches.objetVersAventure(ch.id, { t: 'retireObjet', nom: 'Torche', n: 1 }, enLigne)).toBe('recu')
  expect(enLigne.deposer).toHaveBeenCalledWith('gilibert', { t: 'retireObjet', nom: 'Torche', n: 1 })
})

it('le niveau se décide sur la fiche et part dans l’Aventure', () => {
  fiches.synchroniser(jokobo({ niveau: 10 }))
  expect(lePerso().data.niveauWow).toBe(10)

  const ch = fiches.poserNiveau(lePerso().id, 12)!
  expect(ch.data.niveauWow).toBe(12)

  const dossier = mkdtempSync(join(tmpdir(), 'edm-wow-'))
  mkdirSync(join(dossier, 'Sauvegardes', 'Joueurs'), { recursive: true })
  const chemin = join(dossier, 'Sauvegardes', 'Joueurs', 'gilibert.json')
  writeFileSync(chemin, JSON.stringify({ progress: { level: 10, perso: { prenom: 'Jokobo' } } }))
  expect(fiches.versAventure(ch.id, { niveau: 12 }, { dossier, enLigne: false, deposer: vi.fn() })).toBe(true)
  expect(JSON.parse(readFileSync(chemin, 'utf8')).progress.level).toBe(12)

  const enLigne = { dossier, enLigne: true, deposer: vi.fn() }
  fiches.versAventure(ch.id, { niveau: 13 }, enLigne)
  expect(enLigne.deposer).toHaveBeenCalledWith('gilibert', expect.objectContaining({ t: 'fiche', niveau: 13 }))
})

it('armure, défense et résistances se règlent sur la fiche et partent dans l’Aventure', () => {
  fiches.synchroniser(jokobo({ combat: { armure: 30, defense: 5, initiative: 2, resist: { feu: 1 } } }))
  expect(lePerso().data.combatWow).toMatchObject({ armure: 30, defense: 5, resist: { feu: 1 } })

  const ch = fiches.poserCombat(lePerso().id, { 'total.resist.feu': 4, 'total.armure': 40 })!
  expect(ch.data.combatWow).toMatchObject({ armure: 40, resist: { feu: 4 } })

  /* Hors ligne : le total attend dans le courrier (il dépend des bonus du moment). */
  const dossier = mkdtempSync(join(tmpdir(), 'edm-wow-'))
  mkdirSync(join(dossier, 'Sauvegardes', 'Joueurs'), { recursive: true })
  const chemin = join(dossier, 'Sauvegardes', 'Joueurs', 'gilibert.json')
  writeFileSync(chemin, JSON.stringify({ progress: { perso: { prenom: 'Jokobo' } } }))
  fiches.versAventure(ch.id, { totaux: { 'total.resist.feu': 4 } }, { dossier, enLigne: false, deposer: vi.fn() })
  expect(JSON.parse(readFileSync(chemin, 'utf8')).progress.perso.courrierMj).toEqual([{ t: 'fiche', totaux: { 'total.resist.feu': 4 } }])

  const enLigne = { dossier, enLigne: true, deposer: vi.fn() }
  fiches.versAventure(ch.id, { totaux: { 'total.armure': 40 } }, enLigne)
  expect(enLigne.deposer).toHaveBeenCalledWith('gilibert', expect.objectContaining({ t: 'fiche', totaux: { 'total.armure': 40 } }))
})
