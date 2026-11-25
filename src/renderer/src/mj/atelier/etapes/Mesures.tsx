/**
 * Les calques de mesure de l'étape Objets : les zones d'EMF (niveaux 1 à 5) et
 * les températures qu'un outil de chasse lit en jeu. On colorie le plan
 * entier, librement, sans tenir compte des pièces ; repeindre par-dessus
 * remplace. Ces calques ne se dessinent qu'ici, sur la toile de l'atelier :
 * ni l'image du plan, ni l'écran des joueurs ne les montrent.
 */
import { useEffect, useRef, useState } from 'react'
import { nouvelId, type PointCase } from '@shared/atelier'
import { AMBIANTE_DEFAUT, TEMPERATURE_MAX, TEMPERATURE_MIN, type TraitMesure } from '@shared/chasse'
import type { PropsEtape } from '../../modules/Atelier'
import { LEDS_EMF } from '../../chasse/emf'
import { cercle } from '../dessin'

/** La taille du pinceau, par défaut, en cases (son rayon). */
const RAYON_PINCEAU = 1

export type Calque = 'emf' | 'temperature'

/** La teinte d'une température : du bleu (froid) au rouge (chaud). */
export function couleurTemperature(t: number): string {
  const k = (Math.max(TEMPERATURE_MIN, Math.min(TEMPERATURE_MAX, t)) - TEMPERATURE_MIN) / (TEMPERATURE_MAX - TEMPERATURE_MIN)
  return `hsl(${Math.round(240 - 240 * k)}, 85%, 50%)`
}

const couleurDe = (calque: Calque, valeur: number): string =>
  calque === 'emf' ? (LEDS_EMF[valeur - 1]?.couleur ?? '#fff') : couleurTemperature(valeur)

/* Le calque se compose à part, puis se pose en un voile : un trait recouvre
   ce qu'il y a dessous (comme `mesureSous`), la gomme le découpe. */
let hors: HTMLCanvasElement | null = null

/** Dessine les traits d'un calque sur la toile de l'atelier (le repère est en cases). */
export function dessinerCalque(ctx: CanvasRenderingContext2D, traits: TraitMesure[], calque: Calque): void {
  if (!traits.length) return
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
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = 0.55
  ctx.drawImage(hors, 0, 0)
  ctx.restore()
}

/** Un nombre de degrés qu'on tape librement et qu'on valide en quittant le champ. */
function ChampDegres({
  valeur,
  onValider
}: {
  valeur: number
  onValider: (v: number) => void
}): JSX.Element {
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

export function EtapeMesures(props: PropsEtape & { calque: Calque }): JSX.Element {
  const { co, setOutil, repeindre, calque } = props
  /* Le niveau ou les degrés choisis, ou la gomme (`valeur: null` dans le trait). */
  const [niveau, setNiveau] = useState(3)
  const [degres, setDegres] = useState(0)
  const [gomme, setGomme] = useState(false)
  const valeur = gomme ? null : calque === 'emf' ? niveau : degres
  const [rayon, setRayon] = useState(RAYON_PINCEAU)
  const trait = useRef<PointCase[] | null>(null)
  const souris = useRef<PointCase | null>(null)
  const traits = (calque === 'emf' ? co.c?.emf : co.c?.temperature) ?? []

  useEffect(() => {
    trait.current = null
    setOutil({
      curseur: 'crosshair',
      onPointer: (type, _p, brut) => {
        souris.current = brut
        if (type === 'droit') trait.current = null
        else if (type === 'down') trait.current = [brut]
        else if (type === 'move' && trait.current) {
          const der = trait.current[trait.current.length - 1]
          /* Une touche tous les quarts de rayon : assez serré pour un trait continu. */
          if (Math.hypot(brut[0] - der[0], brut[1] - der[1]) >= rayon / 4) trait.current.push(brut)
        } else if (type === 'up' && trait.current) {
          const nouveau: TraitMesure = { id: nouvelId(), valeur, rayon, pts: trait.current }
          trait.current = null
          co.modifier((c) => ({ ...c, [calque]: [...(c[calque] ?? []), nouveau] }))
        }
        repeindre()
      },
      dessiner: (ctx) => {
        /* Le trait en cours se compose comme un trait posé : l'aperçu est exact. */
        const en = trait.current ? [{ id: '', valeur, rayon, pts: trait.current }] : []
        dessinerCalque(ctx, [...traits, ...en], calque)
        const p = souris.current
        if (p) cercle(ctx, p, rayon, 1)
      }
    })
    return () => setOutil(null)
  }, [calque, valeur, rayon, co.c])

  /* Échap abandonne le trait en cours. */
  useEffect(() => {
    const k = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      trait.current = null
      repeindre()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])

  const ambiante = co.c?.ambiante ?? AMBIANTE_DEFAUT

  return (
    <div className="at-colonne">
      <div className="at-section">
        <span className="eyebrow">{calque === 'emf' ? 'Niveau d’EMF' : 'Température peinte'}</span>
        <div className="at-outils">
          {calque === 'emf' ? (
            LEDS_EMF.map((l, i) => (
              <button
                key={l.nom}
                className="btn btn-sm"
                aria-pressed={!gomme && niveau === i + 1}
                title={`Niveau ${i + 1} (${l.nom})`}
                onClick={() => {
                  setNiveau(i + 1)
                  setGomme(false)
                }}
              >
                <span
                  aria-hidden="true"
                  style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: l.couleur, marginRight: 5 }}
                />
                {i + 1}
              </button>
            ))
          ) : (
            <label className="at-reglage">
              <span>Degrés (°C)</span>
              <ChampDegres
                valeur={degres}
                onValider={(v) => {
                  setDegres(v)
                  setGomme(false)
                }}
              />
            </label>
          )}
          <button
            className="btn btn-sm"
            aria-pressed={gomme}
            onClick={() => setGomme(!gomme)}
          >
            Gomme
          </button>
        </div>
        <p className="at-aide">
          {valeur === null
            ? 'Glisse pour effacer : la zone redevient sans mesure.'
            : calque === 'emf'
              ? 'Glisse pour peindre le niveau choisi ; repeindre remplace.'
              : 'Glisse pour peindre la température choisie ; repeindre remplace.'}
        </p>
        <ul className="at-raccourcis">
          <li>Clic droit ou <kbd>Échap</kbd> : annuler le trait en cours</li>
          <li>Ces zones restent dans l’atelier : ni le plan, ni les joueurs ne les voient.</li>
        </ul>
        <label className="at-reglage">
          <span className="eyebrow">Taille du pinceau · {String(rayon).replace('.', ',')} case</span>
          <input type="range" min={0.25} max={4} step={0.25} value={rayon} onChange={(e) => setRayon(Number(e.target.value))} />
        </label>
      </div>
      {calque === 'temperature' ? (
        <div className="at-section">
          <label className="at-reglage">
            <span className="eyebrow">Température ambiante (°C)</span>
            <ChampDegres
              valeur={ambiante}
              onValider={(v) => co.modifier((c) => ({ ...c, ambiante: v }))}
            />
          </label>
          <p className="at-aide">Hors des zones peintes, le thermomètre lit cette température.</p>
        </div>
      ) : null}
    </div>
  )
}
