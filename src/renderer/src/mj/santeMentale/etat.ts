import { create, type StoreApi, type UseBoundStore } from 'zustand'
import type { Modif } from '@shared/modifs'
import {
  estFolie,
  palierDe,
  perteApresJet,
  tirerGain,
  type EvenementSm,
  type Palier,
  type Prix,
  type Recup,
  type ReglageSm
} from '@shared/santeMentale'
import { jaugeSanite, type Character, type JetSm } from '@shared/types'
import { useStore } from '../store'
import { aAccorder, bilanPalier } from './reconcilier'

/**
 * L'état de la partie pour la santé mentale : les jets attendus, les alertes,
 * les chronos, les hallucinations à venir, les folies et les nausées.
 *
 * Rien n'y est rangé en base : c'est la séance en train de se jouer. Ce qui
 * reste — la jauge SM, les malus — s'écrit sur la fiche par les chemins de
 * l'app (`characters.adjust`, `setModifsJeu`) : du jeu, que le Ctrl+Z de
 * préparation ne défait pas, comme une jauge bougée à la main.
 */

/** Des ids de personnages ; vide : tous les joueurs présents. */
export type Cible = number[]

export interface Attente {
  id: string
  titre: string
  perte: number
  raison: 'choc' | 'folie'
  joueurs: { characterId: number; resultat: { total: number; perte: number } | null }[]
}

export type Alerte =
  /** `texte` : une hallucination proposée, à la descente dans un palier qui en a. */
  | { id: string; genre: 'palier'; characterId: number; palier: Palier; sm: number; montee: boolean; texte?: string }
  | { id: string; genre: 'folie'; characterId: number; effet: string; finA: number }
  | { id: string; genre: 'hallucination'; characterId: number; texte: string }
  | { id: string; genre: 'nausee'; characterId: number }

/** Un prix dans la durée qui court sur un joueur ; `resteMs` posé, il est en pause. */
export interface Chrono {
  prixId: string
  prochainA: number
  /** En pause : ce qu'il restait avant le prochain retrait. */
  resteMs?: number
}

export interface EtatSm {
  attentes: Attente[]
  alertes: Alerte[]
  /** Par personnage : les prix dans la durée qui courent sur lui. */
  chronos: Record<number, Chrono[]>
  /** La prochaine hallucination due (ms epoch). */
  halluA: Record<number, number>
  folies: Record<number, { effet: string; finA: number }>
  /** Les horodatages des pilules prises. */
  pilules: Record<number, number[]>
  /** `recupId` → ids des personnages qui l'ont eue (scène / nuit). */
  recupsFaites: Record<string, number[]>
  /** La fin de la nausée en cours (ms epoch). */
  nausees: Record<number, number>
  declarerChoc(titre: string, perte: number, cible: Cible): void
  /** Un événement sans jet passe par ici ; avec jet, il devient un choc. */
  declarerPrix(p: Prix | EvenementSm, cible: Cible): Promise<void>
  recevoirJet(j: JetSm): Promise<void>
  /** Note le jet au journal ; il revient par `sm:jet` et c'est là qu'il est servi. */
  saisirJet(attenteId: string, characterId: number, die: number): Promise<void>
  annulerAttente(id: string): void
  /** Le seul chemin d'écriture de la SM. */
  appliquer(characterId: number, delta: number, raison: string): Promise<void>
  /** Le MJ corrige la valeur à la main : le palier suit, sans folie ni annonce. */
  rectifier(characterId: number, valeur: number): Promise<void>
  recuperer(r: Recup, cible: Cible): Promise<void>
  arreterChrono(characterId: number, prixId: string): void
  /** Ce n'est pas son tour : le chrono s'arrête où il en est, et repart de là. */
  basculerPause(characterId: number, prixId: string): void
  calmer(characterId: number): void
  /** Chronos échus, hallucinations dues, folies et nausées finies. */
  tick(maintenant: number): Promise<void>
  envoyerHallucination(alerteId: string): Promise<void>
  autreHallucination(alerteId: string): void
  fermerAlerte(id: string): void
  /** Les récupérations « une fois par scène » redeviennent possibles. */
  nouvelleScene(): void
  /** Toutes les limites tombent : scène et nuit. */
  nouvelleNuit(): void
}

/** Le hasard et l'heure : remplaçables dans les tests. */
export const monde = {
  de: (faces: number): number => 1 + Math.floor(Math.random() * faces),
  maintenant: (): number => Date.now()
}

const MINUTE = 60_000
const NAUSEE = 'sm-nausee'
let seq = 1
const nouvelId = (prefixe: string): string => `${prefixe}${seq++}`

interface Contexte {
  r: ReglageSm
  /** La clé de la jauge SM ; `null` : la fiche n'en a pas. */
  cle: string | null
  characters: Character[]
}

function contexte(): Contexte {
  const s = useStore.getState()
  const spec = s.sheet?.spec
  const jauge = spec ? jaugeSanite(spec, spec.gauges) : undefined
  return { r: s.reglages.sm, cle: jauge?.key ?? null, characters: s.characters }
}

/** Les PJ présents, en jeu, et qui ont une jauge de SM. */
function enJeu(): Character[] {
  const { cle, characters } = contexte()
  return characters.filter((c) => c.kind === 'pj' && c.present && !c.horsJeu && !!cle && !!c.data.gauges[cle])
}

/** Les joueurs visés parmi ceux en jeu ; une cible vide les prend tous. */
function vises(cible: Cible): number[] {
  const pjs = enJeu()
  return (cible.length ? pjs.filter((c) => cible.includes(c.id)) : pjs).map((c) => c.id)
}

const prevenir = (msg: string): void => useStore.getState().toast(msg, true)

/** Une perte s'annonce en bas de l'écran, même vue SM fermée — un chrono à chaque retrait. */
function signalerPerte(characterId: number, perte: number, raison: string, sm: number): void {
  useStore.getState().annoncer(`${nomDe(characterId)} perd ${perte} SM — ${raison} → ${sm}`)
}
const nomDe = (id: number): string => fiche(id)?.name ?? 'ce personnage'

const fiche = (id: number): Character | undefined => contexte().characters.find((c) => c.id === id)

/** Le personnage relu du main remplace sa copie : les calculs suivants partent de lui. */
function poser(c: Character): void {
  useStore.setState((s) => ({ characters: s.characters.map((x) => (x.id === c.id ? c : x)) }))
}

/** Les écritures passent une à une : deux pertes simultanées ne lisent pas la même valeur. */
let file: Promise<unknown> = Promise.resolve()
function enFile<T>(f: () => Promise<T>): Promise<T> {
  const p = file.then(f, f)
  file = p.catch(() => undefined)
  return p
}

function auHasard(liste: string[], sauf?: string): string | null {
  const choix = liste.length > 1 && sauf !== undefined ? liste.filter((t) => t !== sauf) : liste
  return choix.length ? choix[monde.de(choix.length) - 1] : null
}

const sansCle = <T>(rec: Record<number, T>, id: number): Record<number, T> => {
  const copie = { ...rec }
  delete copie[id]
  return copie
}

export const useSm: UseBoundStore<StoreApi<EtatSm>> = create<EtatSm>((set, get) => {
  /** Le compte des hallucinations repart, si son palier en a. */
  const rearmer = (characterId: number): void => {
    const { r, cle } = contexte()
    const c = fiche(characterId)
    const v = cle ? c?.data.gauges[cle]?.value : undefined
    const cadence = v === undefined ? null : palierDe(v, r.paliers).hallucinations
    set((s) => ({
      halluA:
        cadence == null
          ? sansCle(s.halluA, characterId)
          : { ...s.halluA, [characterId]: monde.maintenant() + cadence * MINUTE }
    }))
  }

  const ouvrirAttente = (titre: string, perte: number, raison: Attente['raison'], ids: number[]): void => {
    if (!ids.length) return
    const a: Attente = {
      id: nouvelId('att'),
      titre,
      perte,
      raison,
      joueurs: ids.map((characterId) => ({ characterId, resultat: null }))
    }
    set((s) => ({ attentes: [...s.attentes, a] }))
  }

  /** Les malus du module sont du jeu : le canal ne passe pas par le Ctrl+Z. */
  const ecrireModifs = async (id: number, modifs: Modif[]): Promise<void> => {
    poser(await window.jdr.characters.setModifsJeu(id, modifs))
  }

  /**
   * Met la fiche `c`, telle que le main vient de la rendre, d'accord avec son
   * palier : les malus du module, l'alerte si le palier change, le compte des
   * hallucinations. Dans la file. `avant` : la SM relue avant l'écriture qui
   * vient de passer ; `null` hors d'une écriture (la passe d'accord).
   */
  const accorderPalier = async (c: Character, avant: number | null): Promise<void> => {
    const { r, cle } = contexte()
    const b = cle ? bilanPalier(c, avant, r, cle) : null
    if (!b) return
    const { id } = c
    if (b.modifs) await ecrireModifs(id, b.modifs)
    if (b.change) {
      const { montee } = b.change
      /* À la descente dans un palier qui hallucine, l'alerte en propose une. */
      const texte = !montee && b.palier.hallucinations != null ? auHasard(r.hallucinations) : null
      const alerte: Alerte = { id: nouvelId('al'), genre: 'palier', characterId: id, palier: b.palier, sm: b.sm, montee }
      set((s) => ({ alertes: [...s.alertes, texte ? { ...alerte, texte } : alerte] }))
    }
    if (b.palier.hallucinations == null) {
      if (get().halluA[id] !== undefined) set((s) => ({ halluA: sansCle(s.halluA, id) }))
    } else if (get().halluA[id] === undefined) {
      const enCours = get().alertes.some((a) => a.genre === 'hallucination' && a.characterId === id)
      if (!enCours) rearmer(id)
    }
  }

  /** Ceux dont la passe d'accord est en file, et ceux dont l'échec a déjà été dit. */
  const enAccord = new Set<number>()
  const accordRate = new Set<number>()
  /** La passe d'accord, pour un joueur : relu du main, dans la file. */
  const accorder = (id: number): Promise<void> => {
    if (enAccord.has(id)) return Promise.resolve()
    enAccord.add(id)
    return enFile(async () => {
      try {
        const c = await window.jdr.characters.get(id)
        if (!c) return
        poser(c)
        await accorderPalier(c, null)
        accordRate.delete(id)
      } catch {
        /* Une fois par panne, pas à chaque seconde. */
        if (!accordRate.has(id)) prevenir(`Santé mentale : les malus de palier de ${nomDe(id)} n’ont pas pu s’écrire.`)
        accordRate.add(id)
      } finally {
        enAccord.delete(id)
      }
    })
  }

  /**
   * Retouche les modifs hors d'`appliquer` : dans la file, à partir de la fiche
   * relue du main — jamais d'une copie qu'une écriture en vol aurait dépassée.
   */
  const retoucherModifs = (id: number, f: (modifs: Modif[]) => Modif[]): Promise<void> =>
    enFile(async () => {
      const c = await window.jdr.characters.get(id)
      if (c) await ecrireModifs(id, f(c.data.modifs ?? []))
    })

  return {
    attentes: [],
    alertes: [],
    chronos: {},
    halluA: {},
    folies: {},
    pilules: {},
    recupsFaites: {},
    nausees: {},

    declarerChoc: (titre, perte, cible) => ouvrirAttente(titre, perte, 'choc', vises(cible)),

    declarerPrix: async (p, choisis) => {
      /* « Tous » : tous les joueurs présents, quoi qu'on ait coché. */
      const cible = p.tous ? [] : choisis
      if ('jet' in p && p.jet) return get().declarerChoc(p.nom, p.perte, cible)
      const ids = vises(cible)
      const intervalle = 'intervalleMin' in p ? p.intervalleMin : null
      if (intervalle && 'intervalleMin' in p) {
        const prochainA = monde.maintenant() + intervalle * MINUTE
        set((s) => {
          const chronos = { ...s.chronos }
          for (const id of ids) {
            const siens = chronos[id] ?? []
            if (!siens.some((c) => c.prixId === p.id)) chronos[id] = [...siens, { prixId: p.id, prochainA }]
          }
          return { chronos }
        })
        return
      }
      for (const id of ids) await get().appliquer(id, -p.perte, p.nom)
    },

    recevoirJet: async (j) => {
      const { r } = contexte()
      if (j.caracKey !== r.carac) return
      /* La plus ancienne attente non résolue de ce personnage. */
      const a = get().attentes.find((x) =>
        x.joueurs.some((p) => p.characterId === j.characterId && !p.resultat)
      )
      if (!a) return
      const perte = a.raison === 'choc' ? perteApresJet(a.perte, j.die, j.total, r) : 0
      /* Résolu tout de suite : un second jet arrivé pendant l'écriture sert l'attente suivante. */
      set((s) => ({
        attentes: s.attentes
          .map((x) =>
            x.id !== a.id
              ? x
              : {
                  ...x,
                  joueurs: x.joueurs.map((p) =>
                    p.characterId === j.characterId && !p.resultat ? { ...p, resultat: { total: j.total, perte } } : p
                  )
                }
          )
          .filter((x) => x.joueurs.some((p) => !p.resultat))
      }))
      if (a.raison === 'choc') {
        if (perte !== 0) await get().appliquer(j.characterId, -perte, `${a.titre} (jet ${j.total})`)
        return
      }
      /* Le second jet ne décide que de la folie : il n'écrit pas de SM. */
      if (j.total >= r.seuil || !r.folie.table.length) return
      const effet = r.folie.table[Math.min(monde.de(6), r.folie.table.length) - 1]
      const finA = monde.maintenant() + r.folie.minutes * MINUTE
      set((s) => ({
        folies: { ...s.folies, [j.characterId]: { effet, finA } },
        alertes: [...s.alertes, { id: nouvelId('al'), genre: 'folie', characterId: j.characterId, effet, finA }]
      }))
    },

    saisirJet: async (attenteId, characterId, die) => {
      const a = get().attentes.find((x) => x.id === attenteId)
      if (!a) return
      const { r } = contexte()
      /* Sans cette carac sur la fiche, le main noterait le dé sans le renvoyer : l'attente resterait muette. */
      const stats = useStore.getState().sheet?.spec.stats ?? []
      if (!stats.some((st) => st.key === r.carac))
        return prevenir(
          `Santé mentale : la fiche n’a pas de carac « ${r.carac} » pour le jet. Choisis-la dans Paramètres › Santé mentale › Le jet.`
        )
      await window.jdr.rolls.record({
        characterId,
        caracKey: r.carac,
        die,
        label: a.titre,
        system: 'd20-plus',
        target: r.seuil
      })
    },

    annulerAttente: (id) => set((s) => ({ attentes: s.attentes.filter((a) => a.id !== id) })),

    rectifier: (characterId, valeur) =>
      enFile(async () => {
        const { cle } = contexte()
        if (!cle) return
        let character: Character
        let avant: number
        try {
          const lu = await window.jdr.characters.get(characterId)
          const v = lu?.data.gauges[cle]?.value
          if (v === undefined || v === valeur) return
          avant = v
          character = (await window.jdr.characters.adjust(characterId, cle, valeur - v, 'Rectifié à la main')).character
          poser(character)
        } catch {
          return prevenir(`Santé mentale : la correction de ${nomDe(characterId)} n’a pas pu s’écrire.`)
        }
        /* Une correction du MJ n'est pas un choc : ni folie ni annonce, mais le palier suit. */
        try {
          await accorderPalier(character, avant)
        } catch {
          prevenir(`Santé mentale : les malus de palier de ${nomDe(characterId)} n’ont pas pu s’écrire.`)
        }
      }),

    appliquer: (characterId, delta, raison) =>
      enFile(async () => {
        const { r, cle } = contexte()
        if (!cle || delta === 0) return
        let character: Character
        let avant: number
        try {
          /* Relue du main, pas de la copie : un défaire ou une retouche à la main l'ont peut-être bougée. */
          const lu = await window.jdr.characters.get(characterId)
          const v = lu?.data.gauges[cle]?.value
          if (v === undefined) return
          avant = v
          character = (await window.jdr.characters.adjust(characterId, cle, delta, raison)).character
          poser(character)
        } catch {
          return prevenir(`Santé mentale : ${delta < 0 ? 'la perte' : 'le gain'} de ${nomDe(characterId)} n’a pas pu s’écrire.`)
        }
        /* Le main a borné : on raisonne sur ce qui est vraiment écrit. */
        const apres = character.data.gauges[cle]?.value ?? avant
        const perteReelle = avant - apres
        if (perteReelle > 0) signalerPerte(characterId, perteReelle, raison, apres)
        if (delta < 0 && estFolie(perteReelle, r)) ouvrirAttente(`Folie passagère — ${raison}`, perteReelle, 'folie', [characterId])
        try {
          await accorderPalier(character, avant)
        } catch {
          prevenir(`Santé mentale : les malus de palier de ${nomDe(characterId)} n’ont pas pu s’écrire.`)
        }
      }),

    recuperer: async (rec, cible) => {
      const { r } = contexte()
      for (const id of vises(cible)) {
        if (rec.limite && get().recupsFaites[rec.id]?.includes(id)) continue
        if (rec.pilule) {
          const c = fiche(id)
          const jauge = r.jaugePilules ? c?.data.gauges[r.jaugePilules] : undefined
          if (r.jaugePilules && jauge) {
            if (jauge.value <= 0) {
              useStore.getState().toast(`${c?.name ?? 'Ce joueur'} n’a plus de pilules.`, true)
              continue
            }
            try {
              poser((await window.jdr.characters.adjust(id, r.jaugePilules, -1, rec.nom)).character)
            } catch {
              prevenir(`Santé mentale : la pilule de ${c?.name ?? 'ce joueur'} n’a pas pu s’écrire.`)
              continue
            }
          }
          const maintenant = monde.maintenant()
          const derniere = get().pilules[id]?.at(-1)
          set((s) => ({ pilules: { ...s.pilules, [id]: [...(s.pilules[id] ?? []), maintenant] } }))
          if (derniere !== undefined && maintenant - derniere < r.nausee.fenetreMin * MINUTE) {
            const modif: Modif = {
              id: NAUSEE,
              valeur: r.nausee.malus,
              raison: 'SM — Nausée',
              caracKey: null,
              duree: { genre: 'retrait' }
            }
            await retoucherModifs(id, (modifs) => [...modifs.filter((m) => m.id !== NAUSEE), modif]).catch(() =>
              prevenir(`Santé mentale : la nausée de ${nomDe(id)} n’a pas pu s’écrire.`)
            )
            set((s) => ({
              nausees: { ...s.nausees, [id]: maintenant + r.nausee.dureeMin * MINUTE },
              alertes: [...s.alertes, { id: nouvelId('al'), genre: 'nausee', characterId: id }]
            }))
          }
        }
        const gain = tirerGain(rec.gain, monde.de)
        if (gain > 0) await get().appliquer(id, gain, rec.nom)
        if (rec.calme) get().calmer(id)
        if (rec.limite)
          set((s) => ({ recupsFaites: { ...s.recupsFaites, [rec.id]: [...(s.recupsFaites[rec.id] ?? []), id] } }))
      }
    },

    arreterChrono: (characterId, prixId) =>
      set((s) => ({
        chronos: { ...s.chronos, [characterId]: (s.chronos[characterId] ?? []).filter((c) => c.prixId !== prixId) }
      })),

    basculerPause: (characterId, prixId) => {
      const maintenant = monde.maintenant()
      set((s) => ({
        chronos: {
          ...s.chronos,
          [characterId]: (s.chronos[characterId] ?? []).map((c): Chrono => {
            if (c.prixId !== prixId) return c
            if (c.resteMs === undefined) return { ...c, resteMs: Math.max(0, c.prochainA - maintenant) }
            return { prixId: c.prixId, prochainA: maintenant + c.resteMs }
          })
        }
      }))
    },

    calmer: (characterId) =>
      set((s) => ({
        folies: sansCle(s.folies, characterId),
        alertes: s.alertes.filter((a) => !(a.genre === 'folie' && a.characterId === characterId))
      })),

    tick: async (maintenant) => {
      const { r, cle: cleSm } = contexte()
      /* Module éteint : rien ne court, rien ne s'écrit. */
      if (!r.actif) return
      const presents = new Set(enJeu().map((c) => c.id))
      /* Les chronos échus : l'échéance avance avant l'écriture, un tick suivant ne la rejoue pas. */
      const dus: { id: number; prix: Prix }[] = []
      const chronos: EtatSm['chronos'] = {}
      let bouge = false
      for (const [cle, liste] of Object.entries(get().chronos)) {
        const id = Number(cle)
        /* Absent ou hors jeu : son chrono tombe, il ne se vide pas sans qu'on le voie. */
        if (!presents.has(id)) {
          bouge ||= liste.length > 0
          continue
        }
        chronos[id] = liste.flatMap((c) => {
          const prix = r.prix.find((p) => p.id === c.prixId)
          if (!prix || !prix.intervalleMin) {
            bouge = true
            return []
          }
          if (c.resteMs !== undefined || c.prochainA > maintenant) return [c]
          dus.push({ id, prix })
          bouge = true
          /* Après une veille, un seul intervalle se paie : l'échéance repart de maintenant. */
          const intervalle = prix.intervalleMin * MINUTE
          const suivant = c.prochainA + intervalle
          return [{ ...c, prochainA: suivant > maintenant ? suivant : maintenant + intervalle }]
        })
      }
      if (bouge) set({ chronos })

      /* Les hallucinations dues : une alerte, jamais un envoi. */
      for (const [cle, a] of Object.entries(get().halluA)) {
        if (a > maintenant) continue
        const id = Number(cle)
        const texte = auHasard(r.hallucinations)
        set((s) => ({
          halluA: sansCle(s.halluA, id),
          alertes: texte
            ? [...s.alertes, { id: nouvelId('al'), genre: 'hallucination', characterId: id, texte }]
            : s.alertes
        }))
        if (!texte) rearmer(id)
      }

      for (const [cle, f] of Object.entries(get().folies)) if (f.finA <= maintenant) get().calmer(Number(cle))

      for (const [cle, fin] of Object.entries(get().nausees)) {
        if (fin > maintenant) continue
        const id = Number(cle)
        set((s) => ({ nausees: sansCle(s.nausees, id) }))
        await retoucherModifs(id, (modifs) => modifs.filter((m) => m.id !== NAUSEE)).catch(() =>
          prevenir(`Santé mentale : la fin de la nausée de ${nomDe(id)} n’a pas pu s’écrire.`)
        )
      }

      /* `appliquer` dit lui-même ses échecs : une perte ratée n'arrête pas les suivantes. */
      for (const d of dus) await get().appliquer(d.id, -d.prix.perte, d.prix.nom)

      /* La passe d'accord : malus de palier et compte des hallucinations, rattrapés. */
      if (!cleSm) return
      const enHallucination = new Set(get().alertes.flatMap((a) => (a.genre === 'hallucination' ? [a.characterId] : [])))
      const ids = aAccorder({ r, cle: cleSm, joueurs: enJeu(), halluA: get().halluA, enHallucination })
      await Promise.all(ids.map(accorder))
    },

    envoyerHallucination: async (alerteId) => {
      const a = get().alertes.find((x) => x.id === alerteId)
      if (!a || (a.genre !== 'hallucination' && a.genre !== 'palier') || !a.texte) return
      const joueur = useStore.getState().players.find((p) => p.characterId === a.characterId)
      if (joueur) await window.jdr.mots.ecrire([joueur.id], a.texte, null, true, true)
      if (a.genre === 'hallucination') return get().fermerAlerte(alerteId)
      /* L'alerte de palier reste, pour son texte ; seule la proposition part, et le compte repart. */
      set((s) => ({
        alertes: s.alertes.map((x) => (x.id === alerteId && x.genre === 'palier' ? { ...x, texte: undefined } : x))
      }))
      rearmer(a.characterId)
    },

    autreHallucination: (alerteId) =>
      set((s) => ({
        alertes: s.alertes.map((a) => {
          if (a.id !== alerteId || (a.genre !== 'hallucination' && a.genre !== 'palier') || !a.texte) return a
          const texte = auHasard(contexte().r.hallucinations, a.texte)
          return texte ? { ...a, texte } : a
        })
      })),

    nouvelleScene: () => {
      const scene = new Set(contexte().r.recups.filter((r) => r.limite === 'scene').map((r) => r.id))
      set((s) => ({
        recupsFaites: Object.fromEntries(Object.entries(s.recupsFaites).filter(([id]) => !scene.has(id)))
      }))
    },

    nouvelleNuit: () => set({ recupsFaites: {} }),

    fermerAlerte: (id) => {
      const a = get().alertes.find((x) => x.id === id)
      set((s) => ({ alertes: s.alertes.filter((x) => x.id !== id) }))
      /* Envoyée ou passée, le compte repart. */
      if (a?.genre === 'hallucination') rearmer(a.characterId)
    }
  }
})

/**
 * Le module éteint lâche ce qui court (chronos, comptes, jets attendus,
 * alertes) ; une autre campagne repart de rien : l'état est rangé par id de
 * personnage. Rend le désabonnement.
 */
export function suivreCampagne(): () => void {
  let actif = useStore.getState().reglages.sm.actif
  let campagne = useStore.getState().campaign?.id ?? null
  return useStore.subscribe((s) => {
    const id = s.campaign?.id ?? null
    if (id !== campagne)
      useSm.setState({ attentes: [], alertes: [], chronos: {}, halluA: {}, folies: {}, pilules: {}, recupsFaites: {}, nausees: {} })
    else if (actif && !s.reglages.sm.actif) useSm.setState({ attentes: [], alertes: [], chronos: {}, halluA: {} })
    campagne = id
    actif = s.reglages.sm.actif
  })
}

let demarre = false

/** Pose une seule fois l'écoute des jets et l'horloge des chronos ; appelé au montage du MJ. */
export function demarrerSm(): void {
  if (demarre) return
  demarre = true
  window.jdr.sm.onJet((j) => void useSm.getState().recevoirJet(j))
  suivreCampagne()
  setInterval(() => void useSm.getState().tick(monde.maintenant()), 1000)
}
