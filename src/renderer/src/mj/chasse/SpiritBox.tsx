/**
 * La Spirit Box : la radio qui balaie les fréquences, et la voix que le MJ
 * lui fait dire. Il tape une phrase, Windows la prononce (hors ligne, voix
 * installées), le moteur (spirit.ts) la transforme et la noie dans le
 * grésillement.
 *
 * La photo de l'appareil (assets/chasse/spirit-box.png, détourée, recadrée à
 * 629 × 1519 puis réduite de moitié, vue de face) ; son écran affiche la fréquence qui défile, en chiffres à segments
 * (DSEG7).
 *
 * Rien ne part vers l'écran ni les portables : le son sort de ce poste.
 */
import { useEffect, useRef, useState } from 'react'
import imageSpirit from '../../assets/chasse/spirit-box.png'
import { REGLAGES_VOIX, SonSpirit, texteFrequence, type ReglagesVoix } from './spirit'

/** L'écran sur la photo, en pixels du recadrage (629 × 1519) : seules les proportions comptent. */
const ECRAN = { x: 97, y: 565, l: 402, h: 176 }
const PHOTO_L = 629
const PHOTO_H = 1519
const pourcent = (v: number, total: number): string => `${(v / total) * 100}%`

interface Voix {
  nom: string
  langue: string
  genre: string
}

/** « Microsoft Hortense Desktop » → « Hortense ». */
function nomCourt(nom: string): string {
  return nom.replace(/^Microsoft\s+/, '').replace(/\s+Desktop$/, '')
}

export function SpiritBox(): JSX.Element {
  const son = useRef<SonSpirit | null>(null)
  const champ = useRef<HTMLTextAreaElement>(null)
  const [allume, setAllume] = useState(false)
  const [frequence, setFrequence] = useState(94.3)
  const [voix, setVoix] = useState<Voix[]>([])
  const [voixChoisie, setVoixChoisie] = useState<string | null>(null)
  const [texte, setTexte] = useState('')
  const [etat, setEtat] = useState<'repos' | 'prepare' | 'parle'>('repos')
  const [erreur, setErreur] = useState<string | null>(null)
  const [debit, setDebit] = useState(-2)
  const [reglages, setReglages] = useState<ReglagesVoix>(REGLAGES_VOIX)
  const [gresil, setGresil] = useState(0.6)
  const [balayage, setBalayage] = useState(140)
  const [volume, setVolume] = useState(0.7)

  /* Les voix de Windows, une fois ; la française d'abord. */
  useEffect(() => {
    void window.jdr.spirit.voix().then((v) => {
      setVoix(v)
      const fr = v.find((x) => x.langue.startsWith('fr')) ?? v[0]
      setVoixChoisie(fr?.nom ?? null)
    })
    return () => son.current?.arreter()
  }, [])

  useEffect(() => son.current?.setReglages(reglages), [reglages])
  useEffect(() => son.current?.setGresillement(gresil), [gresil])
  useEffect(() => son.current?.setBalayage(balayage), [balayage])
  useEffect(() => son.current?.setVolume(volume), [volume])

  const moteur = (): SonSpirit => {
    if (!son.current) {
      const s = new SonSpirit()
      s.onFrequence = setFrequence
      s.setReglages(reglages)
      s.setGresillement(gresil)
      s.setBalayage(balayage)
      s.setVolume(volume)
      son.current = s
    }
    return son.current
  }

  const basculer = (): void => {
    if (allume) {
      son.current?.suspendre()
      setAllume(false)
      return
    }
    moteur().demarrer()
    setAllume(true)
  }

  const parler = async (): Promise<void> => {
    const t = texte.trim()
    if (!t || etat !== 'repos') return
    setErreur(null)
    if (!allume) {
      moteur().demarrer()
      setAllume(true)
    }
    setEtat('prepare')
    try {
      const wav = await window.jdr.spirit.parler(t, voixChoisie, debit)
      setEtat('parle')
      await moteur().dire(wav)
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e))
    } finally {
      setEtat('repos')
    }
  }

  const curseur = (
    titre: string,
    valeur: number,
    min: number,
    max: number,
    pas: number,
    changer: (v: number) => void
  ): JSX.Element => (
    <label className="emf-champ">
      <span className="eyebrow">{titre}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={pas}
        value={valeur}
        onChange={(e) => changer(Number(e.target.value))}
      />
    </label>
  )

  return (
    <div className="emf-case spirit-case">
      <div className="emf-appareil">
        <div className={`spirit-photo${allume ? ' allume' : ''}${etat === 'parle' ? ' parle' : ''}`}>
          <img src={imageSpirit} alt="Spirit Box" draggable={false} />
          <div
            className="spirit-ecran"
            style={{
              left: pourcent(ECRAN.x, PHOTO_L),
              top: pourcent(ECRAN.y, PHOTO_H),
              width: pourcent(ECRAN.l, PHOTO_L),
              height: pourcent(ECRAN.h, PHOTO_H)
            }}
          >
            {allume ? (
              <>
                <span className="spirit-bande">FM</span>
                <span className="spirit-chiffres">
                  <span className="spirit-fond" aria-hidden>
                    {'888.8'}
                  </span>
                  <span className="spirit-valeur">{texteFrequence(frequence)}</span>
                </span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="emf-commandes">
        <button className={`btn${allume ? ' btn-brass' : ''}`} onClick={basculer}>
          {allume ? 'Éteindre' : 'Allumer'}
        </button>

        <textarea
          ref={champ}
          className="livre-saisie"
          rows={3}
          value={texte}
          placeholder="Ce que l’esprit répond… (Ctrl+Entrée pour le faire parler)"
          onChange={(e) => setTexte(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              void parler()
            }
          }}
        />
        <div className="emf-ligne">
          <button className="btn btn-brass" onClick={() => void parler()} disabled={!texte.trim() || etat !== 'repos'}>
            {etat === 'prepare' ? 'Préparation…' : etat === 'parle' ? 'Il parle…' : 'Faire parler'}
          </button>
          {voix.length > 1 ? (
            <span className="livre-ecritures">
              {voix.map((v) => (
                <button
                  key={v.nom}
                  className={`btn btn-sm${v.nom === voixChoisie ? ' btn-on' : ''}`}
                  onClick={() => setVoixChoisie(v.nom)}
                  title={`${v.nom} — ${v.langue}`}
                >
                  {nomCourt(v.nom)}
                </button>
              ))}
            </span>
          ) : null}
        </div>
        {erreur ? <span className="emf-aide livre-plein">La voix n’a pas pu être préparée : {erreur}</span> : null}

        <div className="spirit-reglages">
          {curseur(
            `Voix : ${reglages.grave < 0.75 ? 'très grave' : reglages.grave < 0.95 ? 'grave' : 'naturelle'}`,
            reglages.grave,
            0.55,
            1.1,
            0.01,
            (v) => setReglages((r) => ({ ...r, grave: v }))
          )}
          {curseur(
            `Netteté des paroles : ${Math.round(reglages.clarte * 100)} %`,
            reglages.clarte,
            0,
            1,
            0.01,
            (v) => setReglages((r) => ({ ...r, clarte: v }))
          )}
          {curseur(`Débit de parole : ${debit}`, debit, -8, 4, 1, setDebit)}
          {curseur(
            `Voix hachée : ${Math.round(reglages.hachage * 100)} %`,
            reglages.hachage,
            0,
            0.8,
            0.01,
            (v) => setReglages((r) => ({ ...r, hachage: v }))
          )}
          {curseur(
            `Écho : ${Math.round(reglages.echo * 100)} %`,
            reglages.echo,
            0,
            1.2,
            0.01,
            (v) => setReglages((r) => ({ ...r, echo: v }))
          )}
          {curseur(`Grésillement : ${Math.round(gresil * 100)} %`, gresil, 0, 1, 0.01, setGresil)}
          {curseur(`Balayage : une station toutes les ${balayage} ms`, balayage, 50, 400, 5, setBalayage)}
          {curseur(`Volume : ${Math.round(volume * 100)} %`, volume, 0, 1, 0.01, setVolume)}
        </div>
      </div>
    </div>
  )
}
