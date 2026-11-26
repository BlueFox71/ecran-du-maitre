/**
 * Les outils qui parlent, en jeu : le livre qui s'écrit, la planche et sa
 * goutte, la spirit box et ce qu'elle dit, le tapis du tarot. Ces vues ne
 * décident de rien : on leur donne ce que le poste a dit (`Passage`, `Goutte`)
 * et l'instant, elles le dessinent. Les mêmes sur le téléphone, la table et
 * le panneau du MJ — c'est l'horloge du poste qui les accorde (`temps.ts`).
 */
import '@fontsource/reenie-beanie/400.css'
import '@fontsource/homemade-apple/400.css'
import '@fontsource/rock-salt/400.css'
import './vues.css'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Goutte, Passage } from '@shared/parole'
import imageLivre from '../../assets/chasse/livre.jpg'
import imageCrayon from '../../assets/chasse/crayon.png'
import imagePlanche from '../../assets/chasse/planche.jpg'
import imageGoutte from '../../assets/chasse/planchette.png'
import imageSpirit from '../../assets/chasse/spirit-box.png'
import { ecritureParId, tremblement } from '../../mj/chasse/ecriture'
import { PLANCHE_H, PLANCHE_L } from '../../mj/chasse/spiritisme'
import { arcaneParFichier } from '../../mj/chasse/arcanes'
import { FREQUENCE_MIN, frequenceSuivante, texteFrequence } from '../../mj/chasse/spirit'
import { calendrier, dureePassage, finGoutte, lettresEcrites, positionGoutte } from './temps'

/* ---------------- le livre ---------------- */

/** Où se repose le crayon quand il n'écrit pas : bas de la page droite, en % du livre. */
const REPOS_CRAYON = { x: 72, y: 86 }

/** Le livre a-t-il une main en train d'écrire à cet instant ? */
export function livreEcrit(pages: Passage[], maintenant: number): boolean {
  const c = calendrier(pages)
  const der = c[c.length - 1]
  return !!der && maintenant < der.debut + dureePassage(der.p)
}

export function VueLivre({ pages, maintenant }: { pages: Passage[]; maintenant: number }): JSX.Element {
  const livre = useRef<HTMLDivElement>(null)
  const [pointe, setPointe] = useState<{ x: number; y: number } | null>(null)
  const c = calendrier(pages)
  const vues = c.map(({ p, debut }) => lettresEcrites(p, debut, maintenant))
  const total = vues.reduce((a, b) => a + b, 0)
  const ecrit = livreEcrit(pages, maintenant)

  /* La pointe du crayon suit la dernière lettre tracée. */
  useLayoutEffect(() => {
    const l = livre.current
    if (!l || !total) return setPointe(null)
    const el = l.querySelector<HTMLElement>(`[data-k="${total - 1}"]`)
    if (!el) return
    const rl = l.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    if (!r.width && !r.height) return
    setPointe({ x: ((r.right - rl.left) / rl.width) * 100, y: ((r.bottom - r.height * 0.3 - rl.top) / rl.height) * 100 })
  }, [total])

  let k = 0
  let dejaVues = 0
  const rendu = c.map(({ p }, i) => {
    const e = ecritureParId(p.ecriture)
    const limite = dejaVues + vues[i]
    dejaVues += Array.from(p.texte).length
    return (
      <span key={p.id} className="vl-passage" style={{ fontFamily: e.police, fontSize: `${e.taille * p.taille}cqw` }}>
        <span
          className={`vl-ligne${p.angle ? ' inclinee' : ''}`}
          style={{ transform: p.angle ? `rotate(${p.angle}deg)` : undefined }}
        >
          {p.texte.split('\n').map((ligne, li) => {
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
                <span key={`m${li}-${mi}-${k}`} className="vl-mot">
                  {Array.from(mot).map((ch) => {
                    const kk = k++
                    const t = tremblement(kk, e.agitation)
                    return (
                      <span
                        key={kk}
                        data-k={kk}
                        className={`vl-lettre${kk < limite ? ' vue' : ''}`}
                        style={{ transform: `translateY(${t.saut}em) rotate(${t.angle}deg)` }}
                      >
                        {ch}
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

  const crayon = ecrit && pointe ? pointe : REPOS_CRAYON
  return (
    <div className="vl" ref={livre}>
      <img className="vl-fond" src={imageLivre} alt="Livre ouvert" draggable={false} />
      <div className="vl-texte">{rendu}</div>
      <img
        className="vl-crayon"
        src={imageCrayon}
        alt=""
        aria-hidden
        draggable={false}
        style={{
          left: `${crayon.x}%`,
          top: `${crayon.y}%`,
          transform: `translateY(-100%)${ecrit ? '' : ' translate(1.5%, -6%)'}`
        }}
      />
    </div>
  )
}

/* ---------------- la planche ---------------- */

/** Le centre de la vitre, en part de l'image de la goutte (937 × 1301 détourée). */
const VITRE = { x: 467 / 937, y: 795 / 1301 }

/** La goutte est-elle en route à cet instant ? */
export function plancheBouge(g: Goutte | null, maintenant: number): boolean {
  return !!g && maintenant < finGoutte(g)
}

export function VuePlanche({ goutte, maintenant }: { goutte: Goutte | null; maintenant: number }): JSX.Element {
  const p = positionGoutte(goutte, maintenant)
  return (
    <div className="vp">
      <img className="vp-fond" src={imagePlanche} alt="Planche de spiritisme" draggable={false} />
      <img
        className="vp-goutte"
        src={imageGoutte}
        alt=""
        aria-hidden
        draggable={false}
        style={{
          left: `${(p.x / PLANCHE_L) * 100}%`,
          top: `${(p.y / PLANCHE_H) * 100}%`,
          transform: `translate(${-VITRE.x * 100}%, ${-VITRE.y * 100}%) rotate(${p.angle}deg)`,
          transformOrigin: `${VITRE.x * 100}% ${VITRE.y * 100}%`
        }}
      />
    </div>
  )
}

/* ---------------- la spirit box ---------------- */

/** Le temps qu'on laisse à une voix pour dire son texte, à peu près : l'écran frémit pendant ce temps. */
export const dureeVoix = (texte: string): number => 1200 + texte.length * 90

export function VueSpirit({
  allume,
  dit,
  maintenant
}: {
  allume: boolean
  dit?: { texte: string; a: number }
  maintenant: number
}): JSX.Element {
  /* Le balayage des fréquences : un défilé qui ne dit rien, propre à cet écran. */
  const [frequence, setFrequence] = useState(94.3)
  useEffect(() => {
    if (!allume) return
    const t = setInterval(() => setFrequence((f) => frequenceSuivante(f, 0.2 + Math.round(Math.random() * 2) * 0.1)), 140)
    return () => clearInterval(t)
  }, [allume])
  const parle = allume && !!dit && maintenant >= dit.a && maintenant < dit.a + dureeVoix(dit.texte)
  return (
    <div className="vs">
      <div className={`vs-photo${allume ? ' allume' : ''}${parle ? ' parle' : ''}`}>
        <img src={imageSpirit} alt="Spirit box" draggable={false} />
        <div className="vs-ecran">
          {allume ? (
            <>
              <span className="vs-bande">FM</span>
              <span className="vs-chiffres">{texteFrequence(frequence || FREQUENCE_MIN)}</span>
            </>
          ) : null}
        </div>
      </div>
      {/* Ce que dit la voix ne s'écrit pas sur le téléphone : on l'entend au PC,
          l'écran ne fait que frémir pendant qu'elle parle. */}
    </div>
  )
}

/* ---------------- le tarot ---------------- */

const imageCarte = (fichier: string): string =>
  new URL(`../../assets/chasse/tarot-hante/${fichier}.jpg`, import.meta.url).href

export function VueTarot({ cartes }: { cartes: { arcane: string; texte: string }[] }): JSX.Element {
  return (
    <div className="vt">
      {cartes.map((c, i) => {
        const a = arcaneParFichier(c.arcane)
        if (!a) return null
        return (
          <figure key={`${i}-${c.arcane}`} className="vt-place">
            <span className="vt-carte">
              <span className="vt-cadre">
                <span className="vt-numero">{a.numero || '·'}</span>
                <span className="vt-photo">
                  <img src={imageCarte(a.fichier)} alt={a.nom} draggable={false} />
                </span>
                <span className="vt-nom">{a.nom}</span>
              </span>
            </span>
            <figcaption className="vt-texte">{c.texte}</figcaption>
          </figure>
        )
      })}
    </div>
  )
}
