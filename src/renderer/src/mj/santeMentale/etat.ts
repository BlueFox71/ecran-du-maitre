import { create, type StoreApi, type UseBoundStore } from 'zustand'
import type { Modif } from '@shared/modifs'
import {
  estFolie,
  modifsDuPalier,
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

/**
 * L'état de la partie pour la santé mentale : les jets attendus, les alertes,
 * les chronos, les hallucinations à venir, les folies et les nausées.
 *
 * Rien n'y est rangé en base : c'est la séance en train de se jouer. Ce qui
 * reste — la jauge SM, les malus — s'écrit sur la fiche par les chemins de
 * l'app (`characters.adjust`, `setModifs`), et le « défaire » s'y applique.
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
  | { id: string; genre: 'palier'; characterId: number; palier: Palier; sm: number; montee: boolean }
  | { id: string; genre: 'folie'; characterId: number; effet: string; finA: number }
  | { id: string; genre: 'hallucination'; characterId: number; texte: string }
  | { id: string; genre: 'nausee'; characterId: number }

export interface EtatSm {
  attentes: Attente[]
  alertes: Alerte[]
  /** Par personnage : les prix dans la durée qui courent sur lui. */
  chronos: Record<number, { prixId: string; prochainA: number }[]>
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
  recuperer(r: Recup, cible: Cible): Promise<void>
  arreterChrono(characterId: number, prixId: string): void
  calmer(characterId: number): void
  /** Chronos échus, hallucinations dues, folies et nausées finies. */
  tick(maintenant: number): Promise<void>
  envoyerHallucination(alerteId: string): Promise<void>
  autreHallucination(alerteId: string): void
  fermerAlerte(id: string): void
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

/** Les joueurs visés : des PJ présents et en jeu ; une cible vide les prend tous. */
function vises(cible: Cible): number[] {
  const pjs = contexte().characters.filter((c) => c.kind === 'pj' && c.present && !c.horsJeu)
  return (cible.length ? pjs.filter((c) => cible.includes(c.id)) : pjs).map((c) => c.id)
}

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

  const ecrireModifs = async (id: number, modifs: Modif[]): Promise<void> => {
    poser(await window.jdr.characters.setModifs(id, modifs))
  }

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

    declarerPrix: async (p, cible) => {
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

    appliquer: (characterId, delta, raison) =>
      enFile(async () => {
        const { r, cle } = contexte()
        const c = fiche(characterId)
        const avant = cle ? c?.data.gauges[cle]?.value : undefined
        if (!c || !cle || avant === undefined || delta === 0) return
        const { character } = await window.jdr.characters.adjust(characterId, cle, delta, raison)
        poser(character)
        /* Le main a borné : on raisonne sur ce qui est vraiment écrit. */
        const apres = character.data.gauges[cle]?.value ?? avant
        const ancien = palierDe(avant, r.paliers)
        const nouveau = palierDe(apres, r.paliers)
        if (ancien.id !== nouveau.id) {
          await ecrireModifs(characterId, modifsDuPalier(character.data.modifs, nouveau))
          set((s) => ({
            alertes: [
              ...s.alertes,
              { id: nouvelId('al'), genre: 'palier', characterId, palier: nouveau, sm: apres, montee: apres > avant }
            ]
          }))
          if (nouveau.hallucinations == null) set((s) => ({ halluA: sansCle(s.halluA, characterId) }))
          else if (ancien.hallucinations == null || get().halluA[characterId] === undefined) {
            const enCours = get().alertes.some((a) => a.genre === 'hallucination' && a.characterId === characterId)
            if (!enCours) rearmer(characterId)
          }
        }
        const perteReelle = avant - apres
        if (delta < 0 && estFolie(perteReelle, r)) ouvrirAttente(`Folie passagère — ${raison}`, perteReelle, 'folie', [characterId])
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
            poser((await window.jdr.characters.adjust(id, r.jaugePilules, -1, rec.nom)).character)
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
            const modifs = (fiche(id)?.data.modifs ?? []).filter((m) => m.id !== NAUSEE)
            await ecrireModifs(id, [...modifs, modif])
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

    calmer: (characterId) =>
      set((s) => ({
        folies: sansCle(s.folies, characterId),
        alertes: s.alertes.filter((a) => !(a.genre === 'folie' && a.characterId === characterId))
      })),

    tick: async (maintenant) => {
      const { r } = contexte()
      /* Les chronos échus : l'échéance avance avant l'écriture, un tick suivant ne la rejoue pas. */
      const dus: { id: number; prix: Prix }[] = []
      const chronos: EtatSm['chronos'] = {}
      for (const [cle, liste] of Object.entries(get().chronos)) {
        const id = Number(cle)
        chronos[id] = liste.flatMap((c) => {
          const prix = r.prix.find((p) => p.id === c.prixId)
          if (!prix || !prix.intervalleMin) return []
          if (c.prochainA > maintenant) return [c]
          dus.push({ id, prix })
          return [{ ...c, prochainA: c.prochainA + prix.intervalleMin * MINUTE }]
        })
      }
      if (dus.length) set({ chronos })

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
        const modifs = fiche(id)?.data.modifs ?? []
        if (modifs.some((m) => m.id === NAUSEE)) await ecrireModifs(id, modifs.filter((m) => m.id !== NAUSEE))
      }

      for (const d of dus) await get().appliquer(d.id, -d.prix.perte, d.prix.nom)
    },

    envoyerHallucination: async (alerteId) => {
      const a = get().alertes.find((x) => x.id === alerteId)
      if (!a || a.genre !== 'hallucination') return
      const joueur = useStore.getState().players.find((p) => p.characterId === a.characterId)
      if (joueur) await window.jdr.mots.ecrire([joueur.id], a.texte, null, true, true)
      get().fermerAlerte(alerteId)
    },

    autreHallucination: (alerteId) =>
      set((s) => ({
        alertes: s.alertes.map((a) => {
          if (a.id !== alerteId || a.genre !== 'hallucination') return a
          const texte = auHasard(contexte().r.hallucinations, a.texte)
          return texte ? { ...a, texte } : a
        })
      })),

    fermerAlerte: (id) => {
      const a = get().alertes.find((x) => x.id === id)
      set((s) => ({ alertes: s.alertes.filter((x) => x.id !== id) }))
      /* Envoyée ou passée, le compte repart. */
      if (a?.genre === 'hallucination') rearmer(a.characterId)
    }
  }
})

let demarre = false

/** Pose une seule fois l'écoute des jets et l'horloge des chronos ; appelé au montage du MJ. */
export function demarrerSm(): void {
  if (demarre) return
  demarre = true
  window.jdr.sm.onJet((j) => void useSm.getState().recevoirJet(j))
  setInterval(() => void useSm.getState().tick(monde.maintenant()), 1000)
}
