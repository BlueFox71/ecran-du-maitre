import { useEffect, useMemo, useState } from 'react'
import { templateOf, useStore } from '../store'
import type { SkillSpec } from '@shared/types'

/**
 * Les faces du dé que la table utilise. La saisie est écrite pour le système
 * maison — d20 + caractéristique — et n'en propose pas d'autre : on recopie le
 * dé du joueur, il n'y a rien à choisir.
 */
export const FACES = 20
export const VALEURS = Array.from({ length: FACES }, (_, i) => i + 1)

/**
 * Le geste « noter un jet », détaché de sa mise en page.
 *
 * Il se pose deux fois dans l'application : en grand dans le module Jets de
 * dés, en petit sous le rail pour ne pas changer de page à chaque annonce.
 * Les deux formes partagent cette mécanique — mais chacune garde son propre
 * choix en cours, si bien qu'une saisie commencée dans le rail ne se fait pas
 * effacer par un passage sur le module.
 */
export function useSaisieJet(): {
  perso: ReturnType<typeof useStore.getState>['characters'][number] | null
  charId: number | null
  setCharId: (id: number) => void
  caracs: SkillSpec[]
  caracKey: string
  setCaracKey: (k: string) => void
  carac: SkillSpec | null
  valeurDe: (key: string) => number
  bonus: number
  valeur: number | null
  setValeur: (v: number | null) => void
  pret: boolean
  enregistrer: () => Promise<boolean>
} {
  const s = useStore()
  const [charId, setCharId] = useState<number | null>(null)
  const [caracKey, setCaracKey] = useState<string>('')
  const [valeur, setValeur] = useState<number | null>(null)

  /** Le premier joueur venu tant qu'on n'a rien choisi, et jamais un disparu. */
  useEffect(() => {
    if (s.characters.length === 0) {
      if (charId !== null) setCharId(null)
      return
    }
    if (charId === null || !s.characters.some((c) => c.id === charId)) {
      setCharId(s.characters[0].id)
    }
  }, [s.characters, charId])

  const perso = s.characters.find((c) => c.id === charId) ?? null
  const tpl = templateOf(s, perso)

  /**
   * Ce à quoi le jet se rapporte : la caractéristique, toujours. Le système
   * maison n'appuie pas les jets sur les compétences — un d20, la carac du
   * personnage, et rien d'autre à choisir.
   */
  const caracs: SkillSpec[] = useMemo(
    () => (tpl?.spec.stats ?? []).map((st) => ({ key: st.key, label: st.label })),
    [tpl]
  )

  const valeurDe = (key: string): number => perso?.data.stats[key] ?? 0

  /** Un changement de joueur peut changer de gabarit : la carac suit. */
  useEffect(() => {
    if (caracs.length === 0) {
      if (caracKey !== '') setCaracKey('')
      return
    }
    if (!caracs.some((x) => x.key === caracKey)) setCaracKey(caracs[0].key)
  }, [caracs, caracKey])

  const carac = caracs.find((x) => x.key === caracKey) ?? null
  const bonus = carac ? valeurDe(carac.key) : 0
  const pret = !!perso && !!carac && valeur !== null

  /**
   * Le dé choisi se relâche après coup : deux jets identiques se cliquent deux
   * fois, et un clic distrait sur « Enregistrer » n'écrit pas la ligne en double.
   */
  const enregistrer = async (): Promise<boolean> => {
    if (!perso || !carac || valeur === null) return false
    await window.jdr.rolls.record({
      characterId: perso.id,
      label: carac.label,
      system: 'd20-plus',
      target: bonus,
      die: valeur
    })
    setValeur(null)
    await s.refreshRolls()
    return true
  }

  return {
    perso,
    charId,
    setCharId,
    caracs,
    caracKey,
    setCaracKey,
    carac,
    valeurDe,
    bonus,
    valeur,
    setValeur,
    pret,
    enregistrer
  }
}
