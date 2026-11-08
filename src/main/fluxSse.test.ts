import { describe, expect, it } from 'vitest'
import { AbonneSse, type SortieSse } from './fluxSse'

/**
 * Une connexion simulée : `lire` vide ce que le téléphone a reçu. Comme un
 * vrai flux Node, `write` rend `false` dès que le tampon déborde, et `drain`
 * ne vient qu'une fois le tampon vidé.
 */
function connexion(seuil = 100) {
  const recu: string[] = []
  let tampon: string[] = []
  let drain: (() => void) | null = null
  const c = {
    detruite: false,
    recu,
    get enAttente() {
      return tampon.length
    },
    lire() {
      recu.push(...tampon)
      tampon = []
      const d = drain
      drain = null
      d?.()
    },
    sortie: {
      write(s: string): boolean {
        tampon.push(s)
        return tampon.join('').length < seuil
      },
      get writableLength() {
        return tampon.join('').length
      },
      once(_e: 'drain', f: () => void) {
        drain = f
      },
      destroy() {
        c.detruite = true
      }
    } as SortieSse
  }
  return c
}

const PAD = 'x'.repeat(200)
const etat = (n: number): Record<string, unknown> => ({ n, pad: PAD })
const complet = (o: unknown): string => `event: state\ndata: ${JSON.stringify(o)}\n\n`
const patch = (set: Record<string, unknown>, del: string[] = []): string =>
  `event: patch\ndata: ${JSON.stringify({ set, del })}\n\n`

describe('flux SSE vers un téléphone — contre-pression', () => {
  it('un téléphone qui suit reçoit chaque état', () => {
    const c = connexion()
    const a = new AbonneSse(c.sortie)
    for (let n = 1; n <= 3; n++) {
      a.etat(etat(n))
      c.lire()
    }
    expect(c.recu).toEqual([complet(etat(1)), complet(etat(2)), complet(etat(3))])
  })

  it('un téléphone qui ne lit plus ne fait pas grossir le tampon', () => {
    const c = connexion()
    const a = new AbonneSse(c.sortie)
    for (let n = 1; n <= 1000; n++) a.etat(etat(n))
    expect(c.enAttente).toBe(1)
  })

  it('au réveil, il reçoit le dernier état, pas toute la file', () => {
    const c = connexion()
    const a = new AbonneSse(c.sortie)
    for (let n = 1; n <= 50; n++) a.etat(etat(n))
    c.lire()
    c.lire()
    expect(c.recu).toEqual([complet(etat(1)), complet(etat(50))])
  })

  it('un événement ponctuel (vibration) n’est pas perdu pendant un retard bref', () => {
    const c = connexion()
    const a = new AbonneSse(c.sortie)
    a.etat(etat(1))
    a.evenement('event: vibre\ndata: [200]\n\n')
    a.etat(etat(2))
    c.lire()
    c.lire()
    expect(c.recu).toEqual([complet(etat(1)), 'event: vibre\ndata: [200]\n\n', complet(etat(2))])
  })

  it('les événements ponctuels en retard sont bornés', () => {
    const c = connexion()
    const a = new AbonneSse(c.sortie)
    a.etat(etat(1))
    for (let i = 0; i < 500; i++) a.evenement(`event: ping\ndata: ${i}\n\n`)
    c.lire()
    c.lire()
    expect(c.recu.length).toBeLessThanOrEqual(1 + 20)
  })

  it('bloqué plus d’une minute, la connexion est coupée', () => {
    let t = 0
    const c = connexion()
    const a = new AbonneSse(c.sortie, { maintenant: () => t })
    a.etat(etat(1))
    t = 30_000
    a.etat(etat(2))
    expect(c.detruite).toBe(false)
    t = 61_000
    a.evenement(': .\n\n')
    expect(c.detruite).toBe(true)
  })

  it('un retard résorbé remet le compteur à zéro', () => {
    let t = 0
    const c = connexion()
    const a = new AbonneSse(c.sortie, { maintenant: () => t })
    a.etat(etat(1))
    t = 50_000
    c.lire()
    a.etat(etat(2))
    t = 100_000
    a.etat(etat(3))
    expect(c.detruite).toBe(false)
  })
})

describe('flux SSE vers un téléphone — seulement ce qui change', () => {
  const pochette = { docs: 'y'.repeat(300) }

  it('le premier envoi est complet, les suivants ne portent que ce qui a changé', () => {
    const c = connexion(10_000)
    const a = new AbonneSse(c.sortie, { patchs: true })
    a.etat({ pions: [1], pochette })
    a.etat({ pions: [2], pochette })
    c.lire()
    expect(c.recu).toEqual([complet({ pions: [1], pochette }), patch({ pions: [2] })])
  })

  it('un état identique n’envoie rien', () => {
    const c = connexion(10_000)
    const a = new AbonneSse(c.sortie, { patchs: true })
    a.etat({ pions: [1], pochette })
    a.etat({ pions: [1], pochette })
    c.lire()
    expect(c.recu).toEqual([complet({ pions: [1], pochette })])
  })

  it('une rubrique qui disparaît est retirée', () => {
    const c = connexion(10_000)
    const a = new AbonneSse(c.sortie, { patchs: true })
    a.etat({ pions: [1], jetAttendu: { titre: 'Volonté' } })
    a.etat({ pions: [1] })
    c.lire()
    expect(c.recu[1]).toBe(patch({}, ['jetAttendu']))
  })

  it('une rubrique qui passe à null est transmise, pas retirée', () => {
    const c = connexion(10_000)
    const a = new AbonneSse(c.sortie, { patchs: true })
    a.etat({ perso: { nom: 'Marie' } })
    a.etat({ perso: null })
    c.lire()
    expect(c.recu[1]).toBe(patch({ perso: null }))
  })

  it('au réveil, un seul patch rattrape tout ce que le téléphone a manqué', () => {
    const c = connexion()
    const a = new AbonneSse(c.sortie, { patchs: true })
    a.etat({ pions: [0], pochette, lieu: 'a' })
    for (let n = 1; n <= 30; n++) a.etat({ pions: [n], pochette, lieu: 'b' })
    c.lire()
    c.lire()
    expect(c.recu).toEqual([complet({ pions: [0], pochette, lieu: 'a' }), patch({ pions: [30], lieu: 'b' })])
  })

  it('sans les patchs (page ancienne), chaque envoi reste complet', () => {
    const c = connexion(10_000)
    const a = new AbonneSse(c.sortie)
    a.etat({ pions: [1], pochette })
    a.etat({ pions: [2], pochette })
    c.lire()
    expect(c.recu).toEqual([complet({ pions: [1], pochette }), complet({ pions: [2], pochette })])
  })
})
