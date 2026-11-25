/**
 * Le livre d'écriture fantôme : le MJ tape un texte, et une main invisible le
 * trace au crayon dans le livre, lettre par lettre, avec l'écriture choisie.
 *
 * Le livre est une photo (assets/chasse/livre.jpg, 1536 × 1024, vue de dessus) ;
 * le texte se pose sur ses deux pages, en deux colonnes, la gauche d'abord.
 * Tout se mesure en largeur du livre (unités cqw) : il garde ses proportions à
 * toutes les tailles. Le crayon (assets/chasse/crayon.png) a sa pointe dans le
 * coin bas gauche de son image : on pose ce coin sur la lettre qui se trace.
 *
 * Rien ne part vers l'écran ni les portables.
 */
import '@fontsource/reenie-beanie/400.css'
import '@fontsource/homemade-apple/400.css'
import '@fontsource/rock-salt/400.css'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import imageLivre from '../../assets/chasse/livre.jpg'
import imageCrayon from '../../assets/chasse/crayon.png'
import { ECRITURES, SonCrayon, delaiLettre, ecritureParId, tremblement } from './ecriture'

/** Un passage : ce que le MJ a fait écrire d'un coup, avec son écriture. */
interface Passage {
  id: number
  texte: string
  ecriture: string
  /** Multiplicateur de la taille de base de l'écriture. */
  taille: number
  /** Son inclinaison, en degrés (négatif : il monte vers la droite). */
  angle: number
  /** Écrit à cheval sur les deux pages, par-dessus la pliure (figé à l’écriture). */
  deuxPages: boolean
}

/** Les derniers textes écrits, gardés dans ce poste pour les reprendre d'un clic. */
const CLE_HISTORIQUE = 'livre.historique'
const TAILLE_HISTORIQUE = 15

function historiqueEnregistre(): string[] {
  try {
    const h = JSON.parse(localStorage.getItem(CLE_HISTORIQUE) ?? '[]') as unknown
    return Array.isArray(h) ? h.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/** Un trait dessiné à la main : ses points en pixels de la photo, son épaisseur. */
interface Trait {
  id: number
  points: [number, number][]
  epaisseur: number
}

/**
 * Le chemin SVG d'un trait, lissé : chaque point devient le contrôle d'une
 * courbe qui passe par le milieu des segments — la main ne fait pas d'angles.
 */
function cheminDuTrait(points: [number, number][]): string {
  if (!points.length) return ''
  const [x0, y0] = points[0]
  if (points.length === 1) return `M${x0} ${y0} l0.01 0`
  let d = `M${x0} ${y0}`
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i]
    const [nx, ny] = points[i + 1]
    d += ` Q${x} ${y} ${(x + nx) / 2} ${(y + ny) / 2}`
  }
  const [xn, yn] = points[points.length - 1]
  return `${d} L${xn} ${yn}`
}

/** Où se repose le crayon quand il n'écrit pas : bas de la page droite, en % du livre. */
const REPOS = { x: 72, y: 86 }

export function Livre(): JSX.Element {
  const [passages, setPassages] = useState<Passage[]>([])
  const [revele, setRevele] = useState(0)
  const [saisie, setSaisie] = useState('')
  const [ecriture, setEcriture] = useState(ECRITURES[0].id)
  const [taille, setTaille] = useState(1)
  const [angle, setAngle] = useState(0)
  /* Les prochains textes traversent les deux pages d’un seul tenant, par-dessus
     la pliure. Chaque passage garde le réglage qu’il avait à l’écriture :
     décocher ne déplace pas ce qui est déjà écrit. */
  const [deuxPages, setDeuxPages] = useState(false)
  const [historique, setHistorique] = useState<string[]>(historiqueEnregistre)
  const champ = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    try {
      localStorage.setItem(CLE_HISTORIQUE, JSON.stringify(historique))
    } catch {
      /* sans stockage, l'historique dure le temps de la séance */
    }
  }, [historique])
  const [vitesse, setVitesse] = useState(0.5)
  const [sonActif, setSonActif] = useState(true)
  const [pointe, setPointe] = useState<{ x: number; y: number; angle: number } | null>(null)
  const [plein, setPlein] = useState(false)
  const livre = useRef<HTMLDivElement>(null)
  const zone = useRef<HTMLDivElement>(null)
  const son = useRef<SonCrayon | null>(null)
  const idSuivant = useRef(1)

  useEffect(() => () => son.current?.fermer(), [])

  /* Toutes les lettres à la suite, pour savoir laquelle tracer. */
  const lettres = useMemo(() => passages.map((p) => p.texte).join(''), [passages])
  const total = lettres.length
  const ecrit = revele < total

  /* La main invisible : une lettre, puis la suivante après un temps. */
  useEffect(() => {
    if (revele >= total) return
    const lettre = lettres[revele]
    const delai = delaiLettre(lettre, vitesse, Math.random())
    if (sonActif && lettre.trim()) {
      if (!son.current) son.current = new SonCrayon()
      son.current.gratter(delai)
    }
    const t = setTimeout(() => setRevele((r) => r + 1), delai)
    return () => clearTimeout(t)
  }, [revele, total, lettres, vitesse, sonActif])

  /* La pointe du crayon suit la dernière lettre tracée. */
  useLayoutEffect(() => {
    const l = livre.current
    if (!l) return
    if (revele === 0) {
      setPointe(null)
      return
    }
    const el = l.querySelector<HTMLElement>(`[data-k="${revele - 1}"]`)
    if (!el) return
    const rl = l.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) return
    setPointe({
      x: ((r.right - rl.left) / rl.width) * 100,
      y: ((r.bottom - r.height * 0.3 - rl.top) / rl.height) * 100,
      angle: (Math.random() - 0.5) * 6
    })
    const z = zone.current
    if (z) setPlein(z.scrollWidth > z.clientWidth + 2 || z.scrollHeight > z.clientHeight + 2)
  }, [revele, passages])

  const ecrire = (): void => {
    const texte = saisie.trim()
    if (!texte || ecrit) return
    /* Un passage est un bloc : il commence toujours à la ligne. */
    setPassages((p) => [...p, { id: idSuivant.current++, texte, ecriture, taille, angle, deuxPages }])
    /* En tête de l'historique, sans doublon. */
    setHistorique((h) => [texte, ...h.filter((x) => x !== texte)].slice(0, TAILLE_HISTORIQUE))
    setSaisie('')
  }

  const effacer = (): void => {
    setPassages([])
    setRevele(0)
    setPlein(false)
    setTraits([])
  }

  /* ---- Le dessin à main levée : des traits de graphite, en coordonnées de
     la photo (1536 × 1024), pour suivre le livre à toutes les tailles. ---- */
  const [dessin, setDessin] = useState(false)
  const [epaisseur, setEpaisseur] = useState(5)
  const [traits, setTraits] = useState<Trait[]>([])
  const [enCours, setEnCours] = useState<Trait | null>(null)
  const [main, setMain] = useState<{ x: number; y: number } | null>(null)
  const dernierGrattement = useRef(0)

  const versLivre = (e: React.PointerEvent): { x: number; y: number } | null => {
    const l = livre.current
    if (!l) return null
    const r = l.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * 1536, y: ((e.clientY - r.top) / r.height) * 1024 }
  }

  const poser = (e: React.PointerEvent<SVGSVGElement>): void => {
    if (!dessin || e.button !== 0) return
    const p = versLivre(e)
    if (!p) return
    /* Le trait continue même si la souris sort un instant du livre. */
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* pointeur déjà relâché : rien à capturer */
    }
    setEnCours({ id: idSuivant.current++, points: [[p.x, p.y]], epaisseur })
    setMain(p)
  }

  const glisser = (e: React.PointerEvent<SVGSVGElement>): void => {
    if (!dessin) return
    const p = versLivre(e)
    if (!p) return
    setMain(p)
    if (!enCours) return
    const [dx, dy] = enCours.points[enCours.points.length - 1]
    if (Math.hypot(p.x - dx, p.y - dy) < 2) return
    setEnCours({ ...enCours, points: [...enCours.points, [p.x, p.y]] })
    /* Le crayon gratte tant qu'il bouge, sans s'emballer. */
    const t = performance.now()
    if (sonActif && t - dernierGrattement.current > 70) {
      dernierGrattement.current = t
      if (!son.current) son.current = new SonCrayon()
      son.current.gratter(90)
    }
  }

  const lever = (): void => {
    if (enCours && enCours.points.length) setTraits((l) => [...l, enCours])
    setEnCours(null)
  }

  /* Les lettres, groupées par mot pour que la ligne ne se coupe pas au milieu
     d'un mot ; chacune porte son rang global (data-k) pour le crayon. */
  let k = 0
  /* L'aperçu : ce qui est dans le champ, posé en pâle à la suite, avec
     l'écriture et la taille choisies — on voit où il tombera avant d'écrire. */
  const apercu = saisie.trim()
  const affiches: Passage[] = apercu
    ? [
        ...passages,
        { id: -1, texte: apercu, ecriture, taille, angle, deuxPages }
      ]
    : passages
  const rendu = affiches.map((p) => {
    const e = ecritureParId(p.ecriture)
    const enApercu = p.id === -1
    const lignes = p.texte.split('\n')
    return (
      <span
        key={p.id}
        className={`livre-passage${p.deuxPages ? ' deux-pages' : ''}`}
        data-angle={p.angle}
        style={{ fontFamily: e.police, fontSize: `${e.taille * p.taille}cqw` }}
      >
        {/* Droit, le passage reste du texte ordinaire : il coule de la page
            gauche à la droite. Incliné, il devient un bloc qui pivote — d'un
            seul morceau, il ne se coupe plus entre deux pages. */}
        <span
          className={`livre-ligne${p.angle ? ' inclinee' : ''}`}
          style={{ transform: p.angle ? `rotate(${p.angle}deg)` : undefined }}
        >
        {lignes.map((ligne, li) => {
          const blocs: JSX.Element[] = []
          if (li > 0) {
            const kk = k++
            blocs.push(<br key={`br${kk}`} data-k={kk} />)
          }
          ligne.split(/( )/).forEach((mot, mi) => {
            if (mot === '') return
            if (mot === ' ') {
              const kk = k++
              blocs.push(
                <span key={`s${kk}`} data-k={kk}>
                  {' '}
                </span>
              )
              return
            }
            blocs.push(
              <span key={`m${li}-${mi}-${k}`} className="livre-mot">
                {Array.from(mot).map((c) => {
                  const kk = k++
                  const t = tremblement(kk, e.agitation)
                  return (
                    <span
                      key={kk}
                      data-k={kk}
                      className={`livre-lettre${enApercu ? ' livre-apercu' : kk < revele ? ' vue' : ''}`}
                      style={{ transform: `translateY(${t.saut}em) rotate(${t.angle}deg)` }}
                    >
                      {c}
                    </span>
                  )
                })}
              </span>
            )
          })
          return blocs
        })}
        </span>
      </span>
    )
  })

  /* Un passage incliné monte (ou descend) d'autant que sa largeur fois le
     sinus de l'angle : on lui réserve cette place au-dessus (ou en dessous),
     pour qu’il ne sorte pas de la page ni ne mange le passage voisin — en
     remplissage, pas en marge : une marge tombe en haut d’une colonne. La
     largeur se lit sans la rotation (offsetWidth l'ignore). */
  useLayoutEffect(() => {
    const z = zone.current
    if (!z) return
    z.querySelectorAll<HTMLElement>('.livre-passage').forEach((p) => {
      const a = Number(p.dataset.angle) || 0
      const ligne = p.querySelector<HTMLElement>('.livre-ligne')
      const hausse = ligne ? ligne.offsetWidth * Math.sin((Math.abs(a) * Math.PI) / 180) : 0
      p.style.paddingTop = a < 0 ? `${hausse}px` : ''
      p.style.paddingBottom = a > 0 ? `${hausse}px` : ''
    })
  })

  /* Il suit la lettre tant qu'il écrit ; le texte fini, il retourne se poser
     en bas de la page droite, pour ne rien cacher de ce qu'il a écrit. */
  const crayon =
    dessin && main
      ? { x: (main.x / 1536) * 100, y: (main.y / 1024) * 100, angle: 0 }
      : pointe && ecrit
        ? pointe
        : { ...REPOS, angle: 0 }
  const crayonPose = ecrit || (dessin && main !== null)

  return (
    <div className="livre-case">
      <div className="livre" ref={livre}>
        <img className="livre-fond" src={imageLivre} alt="Livre ouvert" draggable={false} />
        <div className="livre-texte" ref={zone}>
          {rendu}
        </div>
        <svg
          className={`livre-dessin${dessin ? ' actif' : ''}`}
          viewBox="0 0 1536 1024"
          preserveAspectRatio="none"
          onPointerDown={poser}
          onPointerMove={glisser}
          onPointerUp={lever}
          onPointerCancel={lever}
          onPointerLeave={() => {
            if (!enCours) setMain(null)
          }}
        >
          {[...traits, ...(enCours ? [enCours] : [])].map((t) => (
            <path key={t.id} d={cheminDuTrait(t.points)} strokeWidth={t.epaisseur} />
          ))}
        </svg>
        <img
          className={`livre-crayon${crayonPose ? ' ecrit' : ''}${dessin && main ? ' dessine' : ''}`}
          src={imageCrayon}
          alt=""
          aria-hidden
          draggable={false}
          style={{
            left: `${crayon.x}%`,
            top: `${crayon.y}%`,
            transform: `translateY(-100%) rotate(${crayon.angle}deg)${crayonPose ? '' : ' translate(1.5%, -6%)'}`
          }}
        />
      </div>

      <div className="livre-commandes">
        <textarea
          ref={champ}
          className="livre-saisie"
          rows={3}
          value={saisie}
          placeholder="Ce que le fantôme écrit… (Ctrl+Entrée pour écrire)"
          onChange={(e) => setSaisie(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              ecrire()
            }
          }}
        />

        <div className="emf-champ">
          <span className="eyebrow">Écriture</span>
          <span className="livre-ecritures">
            {ECRITURES.map((e) => (
              <button
                key={e.id}
                className={`btn btn-sm${e.id === ecriture ? ' btn-on' : ''}`}
                style={{ fontFamily: e.police }}
                onClick={() => setEcriture(e.id)}
              >
                {e.nom}
              </button>
            ))}
          </span>
        </div>

        <div className="livre-reglages">
          <label className="emf-champ">
            <span className="eyebrow">Taille&nbsp;: {Math.round(taille * 100)} %</span>
            <input
              type="range"
              min={0.6}
              max={1.8}
              step={0.05}
              value={taille}
              onChange={(e) => setTaille(Number(e.target.value))}
            />
          </label>
          <label className="emf-champ">
            <span className="eyebrow">Vitesse</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={vitesse}
              onChange={(e) => setVitesse(Number(e.target.value))}
            />
          </label>
        </div>

        <label className="emf-champ">
          <span className="eyebrow">
            Orientation&nbsp;: {angle > 0 ? '+' : ''}
            {angle}°
          </span>
          <input
            type="range"
            min={-45}
            max={45}
            step={1}
            value={angle}
            onChange={(e) => setAngle(Number(e.target.value))}
            onDoubleClick={() => setAngle(0)}
            title="Double-clic : à plat"
          />
        </label>

        <label className="livre-son">
          <input type="checkbox" checked={deuxPages} onChange={(e) => setDeuxPages(e.target.checked)} />
          Écrire sur les deux pages d’un seul tenant
        </label>

        <label className="livre-son">
          <input type="checkbox" checked={sonActif} onChange={(e) => setSonActif(e.target.checked)} />
          Bruit du crayon
        </label>

        <div className="emf-ligne">
          <button className="btn btn-brass" onClick={ecrire} disabled={!saisie.trim() || ecrit}>
            Écrire
          </button>
          {ecrit ? (
            <button className="btn btn-sm" onClick={() => setRevele(total)}>
              Tout de suite
            </button>
          ) : null}
          <button className="btn btn-sm btn-ghost" onClick={effacer} disabled={!passages.length && !traits.length}>
            Effacer la page
          </button>
        </div>
        {plein ? <span className="emf-aide livre-plein">Les deux pages sont pleines : la suite ne se voit plus.</span> : null}

        <div className="emf-champ livre-dessin-commandes">
          <span className="eyebrow">Dessin à la main</span>
          <div className="emf-ligne">
            <button
              className={`btn btn-sm${dessin ? ' btn-brass' : ''}`}
              onClick={() => {
                setDessin((d) => !d)
                setMain(null)
              }}
              title="Tracer à la souris sur le livre"
            >
              {dessin ? 'Arrêter de dessiner' : 'Dessiner'}
            </button>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => setTraits((l) => l.slice(0, -1))}
              disabled={!traits.length}
            >
              Annuler le dernier trait
            </button>
          </div>
          <label className="emf-champ">
            <span className="eyebrow">Épaisseur du trait&nbsp;: {epaisseur}</span>
            <input
              type="range"
              min={2}
              max={18}
              step={1}
              value={epaisseur}
              onChange={(e) => setEpaisseur(Number(e.target.value))}
            />
          </label>
        </div>

        {historique.length ? (
          <div className="emf-champ">
            <span className="eyebrow">Déjà écrit</span>
            <ul className="livre-historique">
              {historique.map((h) => (
                <li key={h}>
                  <button
                    className="livre-historique-texte"
                    title={`${h}\n\nCliquer : l’ajouter à la suite du champ`}
                    onClick={() => {
                      /* Chaque clic l'ajoute à la suite de ce qui est déjà
                         dans le champ : deux clics, deux fois. */
                      setSaisie((s) => (s.trim() ? `${s.replace(/\s+$/, '')} ${h}` : h))
                      champ.current?.focus()
                    }}
                  >
                    {h}
                  </button>
                  <button
                    className="livre-historique-ote"
                    title="Retirer de l’historique"
                    aria-label="Retirer de l’historique"
                    onClick={() => setHistorique((l) => l.filter((x) => x !== h))}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  )
}
