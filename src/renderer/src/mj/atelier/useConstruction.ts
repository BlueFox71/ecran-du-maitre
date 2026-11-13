/**
 * La construction ouverte dans l'atelier : son état, son historique, et
 * l'enregistrement qui en fait le plan du lieu.
 *
 * L'historique est local à l'atelier : tant qu'on n'a pas enregistré, rien
 * n'a touché la base, et Ctrl+Z ne fait que revenir sur un geste d'ici.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { agrandir as agrandirC, composerCadres, type Cadre, type Construction } from '@shared/atelier'
import type { AssetAtelier } from '@shared/atelierAssets'
import { exporterPng } from './rendu'
import type { ImagesAtelier } from './images'

const HISTOIRE = 100

/**
 * Les constructions modifiées et pas encore enregistrées, par lieu. On peut
 * quitter l'atelier pour jeter un œil au Paravent : en revenant, le chantier
 * est où on l'a laissé. Elles ne survivent pas à la fermeture de l'app.
 */
const brouillons = new Map<number, { c: Construction; cadre: Cadre | null }>()

export interface ConstructionOuverte {
  c: Construction | null
  /** Un geste : la fonction reçoit la construction courante et rend la suivante. */
  modifier: (f: (c: Construction) => Construction) => void
  /** Comme `modifier`, mais sans nouveau pas d'historique : un glisser en cours. */
  remplacer: (f: (c: Construction) => Construction) => void
  /** Ouvre un pas d'historique pour un geste qui se fera en plusieurs `remplacer`. */
  marquer: () => void
  annuler: () => void
  retablir: () => void
  peutAnnuler: boolean
  peutRetablir: boolean
  sale: boolean
  enregistrement: boolean
  enregistrer: () => Promise<boolean>
  agrandir: (bords: { gauche: number; haut: number; droite: number; bas: number }) => void
  abandonner: () => void
}

export function useConstruction(
  placeId: number | null,
  assets: Map<string, AssetAtelier>,
  images: ImagesAtelier,
  surErreur: (msg: string) => void
): ConstructionOuverte {
  const [c, setC] = useState<Construction | null>(null)
  const [passe, setPasse] = useState<Construction[]>([])
  const [futur, setFutur] = useState<Construction[]>([])
  const [sale, setSale] = useState(false)
  const [enregistrement, setEnregistrement] = useState(false)
  /* Les agrandissements depuis le dernier enregistrement, cumulés. */
  const cadre = useRef<Cadre | null>(null)
  const courant = useRef<Construction | null>(null)
  courant.current = c

  const charger = useCallback(async () => {
    setPasse([])
    setFutur([])
    setSale(false)
    cadre.current = null
    if (placeId == null) return setC(null)
    const b = brouillons.get(placeId)
    if (b) {
      cadre.current = b.cadre
      setC(b.c)
      setSale(true)
      return
    }
    setC(await window.jdr.atelier.de(placeId))
  }, [placeId])

  useEffect(() => {
    if (placeId != null && c && sale) brouillons.set(placeId, { c, cadre: cadre.current })
  }, [placeId, c, sale])

  useEffect(() => {
    void charger()
  }, [charger])

  const marquer = useCallback(() => {
    const cur = courant.current
    if (!cur) return
    setPasse((p) => [...p.slice(-(HISTOIRE - 1)), cur])
    setFutur([])
  }, [])

  const remplacer = useCallback((f: (c: Construction) => Construction) => {
    setC((cur) => (cur ? f(cur) : cur))
    setSale(true)
  }, [])

  const modifier = useCallback(
    (f: (c: Construction) => Construction) => {
      marquer()
      remplacer(f)
    },
    [marquer, remplacer]
  )

  const annuler = useCallback(() => {
    setPasse((p) => {
      if (!p.length || !courant.current) return p
      const prec = p[p.length - 1]
      setFutur((f) => [courant.current!, ...f])
      setC(prec)
      setSale(true)
      return p.slice(0, -1)
    })
  }, [])

  const retablir = useCallback(() => {
    setFutur((f) => {
      if (!f.length || !courant.current) return f
      setPasse((p) => [...p, courant.current!])
      setC(f[0])
      setSale(true)
      return f.slice(1)
    })
  }, [])

  /* Agrandir n'entre pas dans l'historique : défaire un agrandissement
     ferait diverger le cadre de recalage de ce qui a été dessiné. */
  const agrandir = useCallback(
    (bords: { gauche: number; haut: number; droite: number; bas: number }) => {
      const cur = courant.current
      if (!cur) return
      const r = agrandirC(cur, bords)
      cadre.current = cadre.current ? composerCadres(cadre.current, r.cadre) : r.cadre
      setPasse([])
      setFutur([])
      setC(r.construction)
      setSale(true)
    },
    []
  )

  const enregistrer = useCallback(async (): Promise<boolean> => {
    const cur = courant.current
    if (placeId == null || !cur) return false
    setEnregistrement(true)
    try {
      const png = await exporterPng(cur, assets, images)
      await window.jdr.atelier.enregistrer(placeId, cur, png, cadre.current)
      cadre.current = null
      brouillons.delete(placeId)
      setSale(false)
      return true
    } catch (e) {
      surErreur(e instanceof Error ? e.message : String(e))
      return false
    } finally {
      setEnregistrement(false)
    }
  }, [placeId, assets, images, surErreur])

  return {
    c,
    modifier,
    remplacer,
    marquer,
    annuler,
    retablir,
    peutAnnuler: passe.length > 0,
    peutRetablir: futur.length > 0,
    sale,
    enregistrement,
    enregistrer,
    agrandir,
    abandonner: () => {
      if (placeId != null) brouillons.delete(placeId)
      void charger()
    }
  }
}
