import { expect, it, vi } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import './base'

vi.mock('../../carnet', () => ({ reglagesPoste: () => ({}) }))
vi.mock('../../project', () => ({ currentProject: () => null }))

import { lireFiche } from '../../wow'

const fichier = (contenu: unknown): string => {
  const f = join(mkdtempSync(join(tmpdir(), 'edm-fiche-')), 'jules.json')
  writeFileSync(f, JSON.stringify(contenu))
  return f
}

it('une fiche fermée donne ses caractéristiques : les points, plus les bonus notés par l’Aventure', () => {
  const f = fichier({
    classe: 'chaman',
    apercu: { carBonus: { force: 2 }, talents: [{ nom: 'Fureur', rang: 1, max: 5 }], sorts: [] },
    progress: {
      level: 3,
      perso: {
        prenom: 'Jokobô',
        car: { force: { pt: 16 }, dexterite: { pt: 5 } },
        equip: { mainD: { nom: 'Masse', qualite: 2 } },
        contenu: [[{ nom: 'Pain', qte: 4 }, null], []]
      }
    }
  })
  const e = lireFiche(f)!.etat
  expect(e.car).toEqual({ force: 18, dexterite: 5 })
  expect(e.equip).toEqual([{ c: 'mainD', nom: 'Masse', q: 2 }])
  expect(e.sacs).toEqual([{ nom: 'Pain', q: 0, qte: 4 }])
  expect(e.talents).toEqual([{ nom: 'Fureur', rang: 1, max: 5 }])
})

it('une fiche d’une Aventure d’avant (sans aperçu) donne quand même ses points', () => {
  const e = lireFiche(fichier({ classe: 'chaman', progress: { perso: { car: { force: { pt: 16, de: '' } } } } }))!.etat
  expect(e.car).toEqual({ force: 16 })
  expect(e.talents).toBeUndefined()
})
