/**
 * Le pion d'essai de l'atelier — le même que celui de l'éditeur de plan.
 *
 * On reprend ses pièces telles quelles : le calque (`CalqueMurs`) qui pose
 * le pion, le fait marcher, tourner à la molette, ouvrir les portes, et
 * dessine ce qu'il voit ; le volet (`VoletMurs`) qui lui donne une lampe, le
 * replace et dit ce qui n'a jamais été vu. Une seule différence : les murs
 * et les portes sont ceux de la construction **en cours**, même pas encore
 * enregistrée. Les lampes, elles, sont celles du lieu.
 *
 * Les portes qu'on ouvre pendant l'essai ne s'ouvrent que pour lui : rien de
 * l'atelier ne touche la base tant qu'on n'enregistre pas.
 */
import { useEffect, useMemo, useState } from 'react'
import type { Construction } from '@shared/atelier'
import { calqueDEssai } from '@shared/essai'
import type { CalqueBrouillard } from '@shared/types'
import { CalqueMurs, VoletMurs, useMurs } from '../components/Murs'

export interface EssaiAtelier {
  enTest: boolean
  basculer: () => void
  /** Le calque à poser sur le terrain ; `null` hors essai. */
  calque: JSX.Element | null
  /** Le volet qui remplace celui de l'étape pendant l'essai. */
  volet: JSX.Element | null
}

export function useEssaiAtelier(placeId: number, c: Construction | null): EssaiAtelier {
  const mu = useMurs(placeId)
  const [ouvertes, setOuvertes] = useState<Set<string>>(new Set())
  const [mursVisibles, setMursVisibles] = useState(false)
  const enTest = mu.essai !== null || mu.attenteDepart

  /* Échap range le pion, comme dans l'éditeur de plan. */
  useEffect(() => {
    if (!enTest) return
    const k = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') mu.arreterEssai()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [enTest])

  const k = useMemo(() => {
    if (!c) return null
    /* Seuls les murs et les ouvertures viennent de la construction. */
    const lieu = { murs: [], ouvertures: [] } as unknown as CalqueBrouillard
    return calqueDEssai(c, lieu, ouvertes)
  }, [c, ouvertes])

  const basculerPorte = (id: number): void => {
    const o = k?.ouvertures.find((x) => x.id === id)
    if (!o?.atelierId || o.nature !== 'porte') return
    setOuvertes((s) => {
      const n = new Set(s)
      if (n.has(o.atelierId!)) n.delete(o.atelierId!)
      else n.add(o.atelierId!)
      return n
    })
  }

  const calque =
    enTest && k ? (
      <CalqueMurs
        murs={k.murs}
        ouvertures={k.ouvertures}
        mode="edition"
        traitsCaches={!mursVisibles}
        attenteDepart={mu.attenteDepart}
        onDepart={(x, y) => mu.partirDe(x, y)}
        essai={mu.essai}
        onEssai={mu.setEssai}
        onBrouillard={mu.setNoir}
        onBasculerPorte={basculerPorte}
        lumieres={mu.lumieres}
        lumChoisie={mu.lumChoisie}
        lumGarde={mu.lumGarde}
        astre={mu.astre}
        nord={mu.nord}
        regardPortee={mu.regardPortee}
        onLumChoisie={mu.setLumChoisie}
        onReglerLumiere={(id, patch) => void mu.reglerLumiere(id, patch)}
      />
    ) : null

  const volet = enTest ? (
    <VoletMurs
      m={mu}
      essaiEnPlus={
        <label className="at-case">
          <input type="checkbox" checked={mursVisibles} onChange={(e) => setMursVisibles(e.target.checked)} />
          Voir les murs pendant l’essai
        </label>
      }
    />
  ) : null

  return {
    enTest,
    basculer: () => {
      if (enTest) return mu.arreterEssai()
      setOuvertes(new Set())
      void mu.commencerEssai()
    },
    calque,
    volet
  }
}
