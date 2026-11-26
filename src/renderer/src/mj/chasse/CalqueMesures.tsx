/**
 * Les zones d'EMF (niveaux 1 à 5) et les températures qu'un outil de chasse
 * lit en jeu, peintes depuis le plan du lieu (outil « Zones de chasse »).
 *
 * On colorie le plan entier, librement, sans tenir compte des pièces ;
 * repeindre par-dessus remplace. Les traits vivent dans la construction du
 * lieu bâti, mesurés en cases de l'atelier (`Construction.emf`,
 * `.temperature`) : c'est là que le moteur des outils les lit. Ils ne se
 * dessinent que sur ce calque, pour le MJ : ni l'image du plan, ni l'écran
 * des joueurs ne les montrent.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { nouvelId, type Construction, type PointCase } from '@shared/atelier'
import {
  AMBIANTE_DEFAUT,
  TEMPERATURE_MAX,
  TEMPERATURE_MIN,
  grilleTemperatures,
  mesureSous,
  type TraitMesure
} from '@shared/chasse'
import { IconGomme, IconPipette } from '../components/Icons'
import { LEDS_EMF } from './emf'

export type Calque = 'emf' | 'temperature'

/** La taille du pinceau, par défaut, en cases (son rayon). */
const RAYON_PINCEAU = 1

/**
 * L'échelle des températures : du bleu nuit (grand froid) au rouge sombre
 * (grande chaleur), en passant par un blanc à peine teinté vers 15-18 °C.
 * Pas de vert ni de jaune : le froid est bleu, le chaud est rouge, et chaque
 * degré se distingue de son voisin.
 */
export const ECHELLE_TEMPERATURE: [number, [number, number, number]][] = [
  [-20, [12, 20, 80]],
  [-10, [20, 60, 170]],
  [0, [40, 110, 230]],
  [8, [110, 175, 245]],
  [15, [205, 228, 250]],
  [18, [245, 240, 232]],
  [22, [252, 205, 150]],
  [27, [245, 135, 60]],
  [31, [220, 60, 35]],
  [35, [140, 15, 20]]
]

/** La teinte d'une température, sur `ECHELLE_TEMPERATURE`, en rouge-vert-bleu. */
function rvbTemperature(t: number): [number, number, number] {
  const v = Math.max(TEMPERATURE_MIN, Math.min(TEMPERATURE_MAX, t))
  const e = ECHELLE_TEMPERATURE
  let i = 0
  while (i < e.length - 2 && v > e[i + 1][0]) i++
  const [t0, a] = e[i]
  const [t1, b] = e[i + 1]
  const k = t1 === t0 ? 0 : (v - t0) / (t1 - t0)
  return a.map((x, j) => Math.round(x + (b[j] - x) * k)) as [number, number, number]
}

/** La teinte d'une température, sur `ECHELLE_TEMPERATURE`. */
export function couleurTemperature(t: number): string {
  const c = rvbTemperature(t)
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
}

/** Échantillons par case pour dessiner les températures, sans dépasser ~250 000 cellules. */
const parCase = (largeur: number, hauteur: number): number =>
  Math.max(1, Math.min(4, Math.floor(Math.sqrt(250000 / Math.max(1, largeur * hauteur)))))

let horsT: HTMLCanvasElement | null = null

/**
 * Dessine le calque des températures : chaque cellule prend la couleur de ce
 * qu'y lirait le thermomètre — l'ambiante, une température peinte, ou ce
 * qu'un pinceau relatif en a fait. Le repère de `ctx` est en cases.
 */
function dessinerTemperatures(
  ctx: CanvasRenderingContext2D,
  g: { l: number; h: number; valeurs: Float32Array },
  largeur: number,
  hauteur: number
): void {
  horsT ??= document.createElement('canvas')
  if (horsT.width !== g.l || horsT.height !== g.h) {
    horsT.width = g.l
    horsT.height = g.h
  }
  const o = horsT.getContext('2d')!
  const img = o.createImageData(g.l, g.h)
  const teintes = new Map<number, [number, number, number]>()
  for (let k = 0; k < g.valeurs.length; k++) {
    const v = g.valeurs[k]
    let c = teintes.get(v)
    if (!c) teintes.set(v, (c = rvbTemperature(v)))
    img.data[k * 4] = c[0]
    img.data[k * 4 + 1] = c[1]
    img.data[k * 4 + 2] = c[2]
    img.data[k * 4 + 3] = 255
  }
  o.putImageData(img, 0, 0)
  ctx.save()
  ctx.globalAlpha = 0.55
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(horsT, 0, 0, g.l / parCase(largeur, hauteur), g.h / parCase(largeur, hauteur))
  ctx.restore()
}

const couleurDe = (calque: Calque, valeur: number): string =>
  calque === 'emf' ? (LEDS_EMF[valeur - 1]?.couleur ?? '#fff') : couleurTemperature(valeur)

/* Le calque se compose à part, puis se pose en un voile : un trait recouvre
   ce qu'il y a dessous (comme `mesureSous`), la gomme le découpe. */
let hors: HTMLCanvasElement | null = null

/**
 * Dessine les traits d'un calque ; le repère de `ctx` est en cases. `fond` :
 * la couleur de tout ce qui n'est pas peint (la température ambiante) ; la
 * gomme la laisse voir.
 */
export function dessinerCalque(
  ctx: CanvasRenderingContext2D,
  traits: TraitMesure[],
  calque: Calque,
  fond?: string
): void {
  if (!traits.length && !fond) return
  hors ??= document.createElement('canvas')
  const { width, height } = ctx.canvas
  if (hors.width !== width || hors.height !== height) {
    hors.width = width
    hors.height = height
  } else hors.getContext('2d')!.clearRect(0, 0, width, height)
  const o = hors.getContext('2d')!
  o.setTransform(ctx.getTransform())
  for (const t of traits) {
    o.globalCompositeOperation = t.valeur === null ? 'destination-out' : 'source-over'
    o.fillStyle = t.valeur === null ? '#000' : couleurDe(calque, t.valeur)
    o.beginPath()
    for (const [x, y] of t.pts) {
      o.moveTo(x + t.rayon, y)
      o.arc(x, y, t.rayon, 0, Math.PI * 2)
    }
    o.fill()
  }
  if (fond) {
    o.globalCompositeOperation = 'destination-over'
    o.setTransform(1, 0, 0, 1, 0, 0)
    o.fillStyle = fond
    o.fillRect(0, 0, width, height)
  }
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = 0.55
  ctx.drawImage(hors, 0, 0)
  ctx.restore()
}

type Mesures = Pick<Construction, 'emf' | 'temperature' | 'ambiante'>

/**
 * Ce qu'on fait sur le plan : peindre, effacer, reprendre une valeur, ou —
 * sur la température — réchauffer et refroidir ce qui est déjà là.
 */
export type Geste = 'pinceau' | 'gomme' | 'pipette' | 'chauffer' | 'refroidir'

/** Ce qu'un passage de pinceau relatif ajoute ou retire, en °C. */
export const PAS_MIN = 1
export const PAS_MAX = 10

/** Le pinceau en main : quel calque, quelle valeur, quel geste, quelle taille. */
export interface Pinceau {
  calque: Calque
  niveau: number
  degres: number
  geste: Geste
  rayon: number
  /** Pour réchauffer ou refroidir : de combien de degrés à chaque passage. */
  pas: number
}

/**
 * Les zones de chasse d'un lieu bâti, et le pinceau pour les peindre. Le
 * pinceau survit d'un plan à l'autre le temps de la fiche ; les zones se
 * relisent à chaque fois qu'on reprend l'outil (un Ctrl+Z a pu passer).
 */
export function useMesures(placeId: number, bati: boolean, arme: boolean) {
  const [c, setC] = useState<{ placeId: number; largeur: number; hauteur: number; m: Mesures } | null>(null)
  const [pinceau, setPinceau] = useState<Pinceau>({
    calque: 'emf',
    niveau: 3,
    degres: 0,
    geste: 'pinceau',
    rayon: RAYON_PINCEAU,
    pas: 2
  })
  /* Un Ctrl+Z a pu défaire un trait : on relit. */
  const [defait, setDefait] = useState(0)
  useEffect(() => {
    const h = (): void => setDefait((n) => n + 1)
    window.addEventListener('jdr:defait', h)
    return () => window.removeEventListener('jdr:defait', h)
  }, [])

  useEffect(() => {
    if (!bati) return setC(null)
    let vivant = true
    void window.jdr.atelier.de(placeId).then((x) => {
      if (!vivant) return
      setC(
        x
          ? {
              placeId,
              largeur: x.largeur,
              hauteur: x.hauteur,
              m: { emf: x.emf, temperature: x.temperature, ambiante: x.ambiante }
            }
          : null
      )
    })
    return () => {
      vivant = false
    }
  }, [placeId, bati, arme, defait])

  /* On écrit tout d'un coup, ce qu'on voit à l'écran d'abord : le trait ne
     clignote pas pendant l'aller-retour. */
  const ecrire = useCallback(
    async (m: Mesures): Promise<void> => {
      setC((x) => (x ? { ...x, m } : x))
      const r = await window.jdr.atelier.mesures(placeId, m)
      setC((x) => (x && x.placeId === placeId ? { ...x, m: r } : x))
    },
    [placeId]
  )

  const courant = c && c.placeId === placeId ? c : null
  const valeur = pinceau.geste === 'gomme' ? null : pinceau.calque === 'emf' ? pinceau.niveau : pinceau.degres
  const ecart =
    pinceau.calque !== 'temperature'
      ? undefined
      : pinceau.geste === 'chauffer'
        ? pinceau.pas
        : pinceau.geste === 'refroidir'
          ? -pinceau.pas
          : undefined
  /** Le trait que fait le pinceau en main sur ces points. */
  const trait = (pts: PointCase[], id = nouvelId()): TraitMesure =>
    ecart !== undefined
      ? { id, valeur: null, ecart, rayon: pinceau.rayon, pts }
      : { id, valeur, rayon: pinceau.rayon, pts }
  const traits = (pinceau.calque === 'emf' ? courant?.m.emf : courant?.m.temperature) ?? []
  const ambiante = courant?.m.ambiante ?? AMBIANTE_DEFAUT

  return {
    pret: courant !== null,
    largeur: courant?.largeur ?? 1,
    hauteur: courant?.hauteur ?? 1,
    traits,
    nbEmf: courant?.m.emf?.filter((t) => t.valeur !== null).length ?? 0,
    nbTemperature: courant?.m.temperature?.filter((t) => t.valeur !== null || t.ecart !== undefined).length ?? 0,
    ambiante,
    pinceau,
    setPinceau,
    valeur,
    trait,
    peindre: (pts: PointCase[]): void => {
      if (!courant) return
      const t = trait(pts)
      const k = pinceau.calque
      void ecrire({ ...courant.m, [k]: [...(courant.m[k] ?? []), t] })
    },
    /** La pipette : la valeur sous ce point devient celle du pinceau, et l'on repeint. */
    prendre: (p: PointCase): void => {
      const v = mesureSous(traits, p, pinceau.calque === 'temperature' ? ambiante : null)
      setPinceau((x) =>
        x.calque === 'emf'
          ? v === null
            ? { ...x, geste: 'gomme' }
            : { ...x, niveau: v, geste: 'pinceau' }
          : { ...x, degres: v ?? ambiante, geste: 'pinceau' }
      )
    },
    toutEffacer: (): void => {
      if (!courant) return
      void ecrire({ ...courant.m, [pinceau.calque]: [] })
    },
    reglerAmbiante: (v: number): void => {
      if (!courant) return
      void ecrire({ ...courant.m, ambiante: v })
    }
  }
}

export type MesuresDuPlan = ReturnType<typeof useMesures>

/** Le calque posé sur le plan : on y voit les zones, et l'on y peint quand l'outil est en main. */
export function CalqueMesures({ z, arme }: { z: MesuresDuPlan; arme: boolean }): JSX.Element | null {
  const hote = useRef<HTMLDivElement>(null)
  const toile = useRef<HTMLCanvasElement>(null)
  const [taille, setTaille] = useState({ w: 0, h: 0 })
  const trait = useRef<PointCase[] | null>(null)
  const souris = useRef<PointCase | null>(null)
  /* La grille des températures peintes : refaite seulement quand les traits,
     l'ambiante ou le terrain changent ; le trait en cours s'y pose par-dessus. */
  const grille = useRef<{
    traits: TraitMesure[]
    ambiante: number
    largeur: number
    hauteur: number
    g: ReturnType<typeof grilleTemperatures>
  } | null>(null)

  useEffect(() => {
    const el = hote.current
    if (!el) return
    const ro = new ResizeObserver(() => setTaille({ w: el.offsetWidth, h: el.offsetHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { w, h } = taille
  const dpr = window.devicePixelRatio || 1

  const dessiner = (): void => {
    const cv = toile.current
    if (!cv) return
    const ctx = cv.getContext('2d')!
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, cv.width, cv.height)
    if (!w || !h) return
    /* Le repère en cases, comme dans l'atelier. */
    const kx = (w * dpr) / z.largeur
    const ky = (h * dpr) / z.hauteur
    ctx.setTransform(kx, 0, 0, ky, 0, 0)
    const en = trait.current ? [z.trait(trait.current, '')] : []
    if (z.pinceau.calque === 'temperature') {
      const k = parCase(z.largeur, z.hauteur)
      let b = grille.current
      if (!b || b.traits !== z.traits || b.ambiante !== z.ambiante || b.largeur !== z.largeur || b.hauteur !== z.hauteur) {
        b = grille.current = {
          traits: z.traits,
          ambiante: z.ambiante,
          largeur: z.largeur,
          hauteur: z.hauteur,
          g: grilleTemperatures(z.traits, z.largeur, z.hauteur, z.ambiante, k)
        }
      }
      const g = en.length ? grilleTemperatures(en, z.largeur, z.hauteur, z.ambiante, k, b.g.valeurs) : b.g
      dessinerTemperatures(ctx, g, z.largeur, z.hauteur)
    } else dessinerCalque(ctx, [...z.traits, ...en], z.pinceau.calque)
    const p = souris.current
    if (arme && p) {
      ctx.beginPath()
      ctx.arc(p[0], p[1], z.pinceau.rayon, 0, Math.PI * 2)
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.lineWidth = 1.5 * dpr
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'
      ctx.setLineDash([4 * dpr, 3 * dpr])
      ctx.stroke()
      ctx.setLineDash([])
    }
  }

  useEffect(dessiner)

  /* Échap abandonne le trait en cours. */
  useEffect(() => {
    if (!arme) return
    const k = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' || !trait.current) return
      e.stopPropagation()
      trait.current = null
      dessiner()
    }
    window.addEventListener('keydown', k, true)
    return () => window.removeEventListener('keydown', k, true)
  })

  if (!z.pret) return null

  const enCase = (e: { clientX: number; clientY: number }): PointCase => {
    const b = hote.current!.getBoundingClientRect()
    return [((e.clientX - b.left) / b.width) * z.largeur, ((e.clientY - b.top) / b.height) * z.hauteur]
  }

  return (
    <div
      ref={hote}
      className={`mes-calque${arme ? ' arme' : ''}${z.pinceau.geste === 'pipette' ? ' pipette' : ''}`}
      onPointerDown={(e) => {
        if (!arme) return
        e.preventDefault()
        if (e.button === 2) {
          trait.current = null
          return dessiner()
        }
        if (e.button !== 0) return
        if (z.pinceau.geste === 'pipette') return z.prendre(enCase(e))
        e.currentTarget.setPointerCapture(e.pointerId)
        trait.current = [enCase(e)]
        dessiner()
      }}
      onPointerMove={(e) => {
        if (!arme) return
        const p = enCase(e)
        souris.current = p
        const t = trait.current
        if (t) {
          const der = t[t.length - 1]
          /* Une touche tous les quarts de rayon : assez serré pour un trait continu. */
          if (Math.hypot(p[0] - der[0], p[1] - der[1]) >= z.pinceau.rayon / 4) t.push(p)
        }
        dessiner()
      }}
      onPointerUp={() => {
        const t = trait.current
        trait.current = null
        if (t) z.peindre(t)
        dessiner()
      }}
      onPointerLeave={() => {
        souris.current = null
        dessiner()
      }}
      onContextMenu={(e) => arme && e.preventDefault()}
    >
      <canvas ref={toile} width={Math.max(1, Math.round(w * dpr))} height={Math.max(1, Math.round(h * dpr))} />
    </div>
  )
}

/** Un nombre de degrés qu'on tape librement et qu'on valide en quittant le champ. */
function ChampDegres({ valeur, onValider }: { valeur: number; onValider: (v: number) => void }): JSX.Element {
  const [saisie, setSaisie] = useState(String(valeur))
  useEffect(() => setSaisie(String(valeur)), [valeur])
  const valider = (): void => {
    const n = Number(saisie.replace(',', '.'))
    if (saisie.trim() === '' || !Number.isFinite(n)) return setSaisie(String(valeur))
    const v = Math.max(TEMPERATURE_MIN, Math.min(TEMPERATURE_MAX, Math.round(n)))
    setSaisie(String(v))
    if (v !== valeur) onValider(v)
  }
  return (
    <input
      type="number"
      min={TEMPERATURE_MIN}
      max={TEMPERATURE_MAX}
      step={1}
      value={saisie}
      onChange={(e) => setSaisie(e.target.value)}
      onBlur={valider}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  )
}

/** L'échelle des couleurs, graduée, avec la température choisie et l'ambiante. */
function EchelleTemperatures({ degres, ambiante }: { degres: number | null; ambiante: number }): JSX.Element {
  const pos = (t: number): string => `${((t - TEMPERATURE_MIN) / (TEMPERATURE_MAX - TEMPERATURE_MIN)) * 100}%`
  const fond = `linear-gradient(to right, ${ECHELLE_TEMPERATURE.map(([t, c]) => `rgb(${c.join(',')}) ${pos(t)}`).join(', ')})`
  return (
    <div className="mes-echelle">
      <div className="mes-echelle-barre" style={{ background: fond }}>
        <span className="mes-echelle-amb" style={{ left: pos(ambiante) }} title={`Ambiante : ${ambiante} °C`} />
        {degres !== null ? (
          <span className="mes-echelle-curseur" style={{ left: pos(degres) }} title={`Pinceau : ${degres} °C`} />
        ) : null}
      </div>
      <div className="mes-echelle-graduations" aria-hidden="true">
        {[-20, -10, 0, 10, 20, 30, 35].map((t) => (
          <span key={t} style={{ left: pos(t) }}>
            {t}
          </span>
        ))}
      </div>
      <p className="note">Trait plein : le pinceau · pointillé : l’ambiante.</p>
    </div>
  )
}

/** Le volet de l'outil : quel calque, quel niveau ou combien de degrés, gomme, pipette, taille. */
export function VoletMesures({ z, onFini }: { z: MesuresDuPlan; onFini?: () => void }): JSX.Element {
  const { pinceau, setPinceau } = z
  const regler = (patch: Partial<Pinceau>): void => setPinceau((p) => ({ ...p, ...patch }))
  const emf = pinceau.calque === 'emf'
  const nb = emf ? z.nbEmf : z.nbTemperature
  const geste = (g: Geste): void => regler({ geste: pinceau.geste === g ? 'pinceau' : g })
  const degres = (v: number): void =>
    regler({ degres: Math.max(TEMPERATURE_MIN, Math.min(TEMPERATURE_MAX, v)), geste: 'pinceau' })
  return (
    <div className="mes-volet">
      <div className="mes-tete">
        <h3 className="pe-volet-titre">Zones de chasse</h3>
        {onFini ? (
          <button className="btn btn-sm" title="Reposer le pinceau" onClick={onFini}>
            Terminé
          </button>
        ) : null}
      </div>
      <div className="pe-onglets" role="tablist" aria-label="Le calque peint">
        {(
          [
            ['emf', 'EMF', z.nbEmf],
            ['temperature', 'Température', z.nbTemperature]
          ] as const
        ).map(([k, l, n]) => (
          <button
            key={k}
            role="tab"
            aria-selected={pinceau.calque === k}
            onClick={() =>
              /* Réchauffer, refroidir : la température seulement. */
              regler(
                k === 'emf' && (pinceau.geste === 'chauffer' || pinceau.geste === 'refroidir')
                  ? { calque: k, geste: 'pinceau' }
                  : { calque: k }
              )
            }
          >
            {l}
            <span className="n">{n}</span>
          </button>
        ))}
      </div>

      <div className="fl-bloc">
        <span className="eyebrow">{emf ? 'Niveau d’EMF' : 'Température peinte'}</span>
        {emf ? (
          <div className="at-outils">
            {LEDS_EMF.map((l, i) => (
              <button
                key={l.nom}
                className="btn btn-sm"
                aria-pressed={pinceau.geste === 'pinceau' && pinceau.niveau === i + 1}
                title={`Niveau ${i + 1} (${l.nom})`}
                onClick={() => regler({ niveau: i + 1, geste: 'pinceau' })}
              >
                <span className="mes-pastille" aria-hidden="true" style={{ background: l.couleur }} />
                {i + 1}
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="mes-degres">
              <button
                className="btn btn-sm"
                title="Un degré de moins"
                disabled={pinceau.degres <= TEMPERATURE_MIN}
                onClick={() => degres(pinceau.degres - 1)}
              >
                −1 °C
              </button>
              <span
                className="mes-pastille mes-pastille-grande"
                aria-hidden="true"
                style={{ background: couleurTemperature(pinceau.degres) }}
              />
              <ChampDegres valeur={pinceau.degres} onValider={degres} />
              <span>°C</span>
              <button
                className="btn btn-sm"
                title="Un degré de plus"
                disabled={pinceau.degres >= TEMPERATURE_MAX}
                onClick={() => degres(pinceau.degres + 1)}
              >
                +1 °C
              </button>
            </div>
            <EchelleTemperatures degres={pinceau.geste === 'pinceau' ? pinceau.degres : null} ambiante={z.ambiante} />
          </>
        )}
        <div className="at-outils">
          <button
            className="btn btn-sm"
            aria-pressed={pinceau.geste === 'gomme'}
            aria-label="Gomme"
            title={emf ? 'Gomme : la zone revient à 0' : 'Gomme : la zone revient à la température ambiante'}
            onClick={() => geste('gomme')}
          >
            <IconGomme />
          </button>
          <button
            className="btn btn-sm"
            aria-pressed={pinceau.geste === 'pipette'}
            aria-label="Pipette"
            title="Pipette : clique sur le plan pour reprendre la valeur peinte à cet endroit"
            onClick={() => geste('pipette')}
          >
            <IconPipette />
          </button>
          {!emf ? (
            <>
              <button
                className="btn btn-sm"
                aria-pressed={pinceau.geste === 'chauffer'}
                title="Réchauffer : chaque passage ajoute des degrés à ce qui est déjà là"
                onClick={() => geste('chauffer')}
              >
                <span className="mes-pastille" aria-hidden="true" style={{ background: couleurTemperature(30) }} />
                Réchauffer
              </button>
              <button
                className="btn btn-sm"
                aria-pressed={pinceau.geste === 'refroidir'}
                title="Refroidir : chaque passage retire des degrés à ce qui est déjà là"
                onClick={() => geste('refroidir')}
              >
                <span className="mes-pastille" aria-hidden="true" style={{ background: couleurTemperature(-5) }} />
                Refroidir
              </button>
            </>
          ) : null}
        </div>
        {pinceau.geste === 'chauffer' || pinceau.geste === 'refroidir' ? (
          <div className="mes-degres">
            <span>Par passage</span>
            <button
              className="btn btn-sm"
              title="Un degré de moins par passage"
              disabled={pinceau.pas <= PAS_MIN}
              onClick={() => regler({ pas: Math.max(PAS_MIN, pinceau.pas - 1) })}
            >
              −
            </button>
            <b>
              {pinceau.geste === 'chauffer' ? '+' : '−'}
              {pinceau.pas} °C
            </b>
            <button
              className="btn btn-sm"
              title="Un degré de plus par passage"
              disabled={pinceau.pas >= PAS_MAX}
              onClick={() => regler({ pas: Math.min(PAS_MAX, pinceau.pas + 1) })}
            >
              +
            </button>
          </div>
        ) : null}
        <label className="at-reglage">
          <span className="eyebrow">Taille du pinceau · {String(pinceau.rayon).replace('.', ',')} case</span>
          <input
            type="range"
            min={0.25}
            max={4}
            step={0.25}
            value={pinceau.rayon}
            onChange={(e) => regler({ rayon: Number(e.target.value) })}
          />
        </label>
        <p className="note">
          {pinceau.geste === 'gomme'
            ? emf
              ? 'Glisse pour effacer : la zone revient à 0.'
              : 'Glisse pour effacer : la zone revient à la température ambiante.'
            : pinceau.geste === 'pipette'
              ? 'Clique sur le plan : sa valeur devient celle du pinceau.'
              : pinceau.geste === 'chauffer' || pinceau.geste === 'refroidir'
                ? `Glisse : là où tu passes, la température ${pinceau.geste === 'chauffer' ? 'monte' : 'baisse'} de ${pinceau.pas} °C, qu’elle soit peinte ou ambiante. Repasse pour aller plus loin.`
              : emf
                ? 'Glisse pour peindre le niveau choisi ; repeindre remplace. Hors zone, l’EMF reste à 0.'
                : 'Glisse pour peindre la température choisie ; repeindre remplace.'}
        </p>
      </div>

      {!emf ? (
        <div className="fl-bloc">
          <label className="at-reglage">
            <span className="eyebrow">Température ambiante (°C)</span>
            <ChampDegres valeur={z.ambiante} onValider={z.reglerAmbiante} />
          </label>
          <p className="note">Tout ce qui n’est pas peint : le plan en prend la couleur, le thermomètre la lit.</p>
        </div>
      ) : null}

      <div className="fl-bloc">
        <button className="btn btn-sm" disabled={!nb && !z.traits.length} onClick={z.toutEffacer}>
          Effacer tout le calque {emf ? 'EMF' : 'température'}
        </button>
        <p className="note">
          Clic droit ou <kbd>Échap</kbd> : annuler le trait en cours · <kbd>Ctrl</kbd>+<kbd>Z</kbd> défait le
          dernier trait. Ces zones ne se voient que d’ici : ni le plan des joueurs, ni la table ne les montrent.
        </p>
      </div>
    </div>
  )
}
