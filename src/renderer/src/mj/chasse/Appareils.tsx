/**
 * Les appareils de chasse en jeu : ceux que portent les joueurs, ceux qu'ils
 * ont posés. Une ligne chacun — où il est, ce qu'il mesure — et, d'un clic, la
 * main du MJ dessus : un curseur remplace alors la mesure de la carte, pour
 * faire grésiller l'EMF ou plonger le thermomètre au bon moment.
 */
import { useEffect, useRef, useState } from 'react'
import type { AppareilChasse } from '@shared/chasse'
import { imageOutil } from '../../shared/outilsChasse'
import { useStore } from '../store'
import { NIVEAU_MAX } from './emf'
import { TEMPERATURE_MAX, TEMPERATURE_MIN, texteTemperature } from './temperature'

/** Au plus dix envois par seconde pendant qu'on tire le curseur. */
const PAS_ENVOI_MS = 100

function Curseur({ a }: { a: AppareilChasse }): JSX.Element {
  const emf = a.outil === 'emf'
  const [valeur, setValeur] = useState(a.valeur)
  const dernier = useRef(0)
  const attente = useRef<ReturnType<typeof setTimeout> | null>(null)
  const voulue = useRef(a.valeur)

  useEffect(
    () => () => {
      if (attente.current) clearTimeout(attente.current)
    },
    []
  )

  const envoyer = (v: number): void => {
    voulue.current = v
    setValeur(v)
    const reste = PAS_ENVOI_MS - (Date.now() - dernier.current)
    const partir = (): void => {
      attente.current = null
      dernier.current = Date.now()
      void window.jdr.chasse.controler(a.placementId, voulue.current)
    }
    if (reste <= 0) partir()
    else if (!attente.current) attente.current = setTimeout(partir, reste)
  }

  return (
    <input
      type="range"
      className="chasse-curseur"
      aria-label={`Valeur de ${a.nom}`}
      min={emf ? 0 : TEMPERATURE_MIN}
      max={emf ? NIVEAU_MAX : TEMPERATURE_MAX}
      step={emf ? 0.1 : 1}
      value={valeur}
      onChange={(e) => envoyer(Number(e.target.value))}
    />
  )
}

export function Appareils(): JSX.Element {
  const chasse = useStore((s) => s.chasse)
  const characters = useStore((s) => s.characters)
  const places = useStore((s) => s.places)

  const ou = (a: AppareilChasse): string => {
    if (a.ou === 'main') {
      const nom = characters.find((c) => c.id === a.characterId)?.name
      return nom ? `en main de ${nom}` : 'en main'
    }
    if (a.ou === 'lieu') {
      const lieu = places.find((p) => p.id === a.placeId)?.name
      return lieu ? `posé — ${lieu}` : 'posé'
    }
    return a.characterId != null ? 'rangé' : 'hors du plan'
  }

  const mesure = (a: AppareilChasse): string =>
    a.outil === 'emf' ? `Niveau ${a.valeur.toFixed(1)}` : `${texteTemperature(a.valeur)} °C`

  return (
    <section className="chasse-appareils" aria-label="Appareils en jeu">
      <h3>Appareils en jeu</h3>
      {chasse.length === 0 ? (
        <p className="chasse-vide">Aucun appareil porté ou posé pour l’instant.</p>
      ) : (
        <ul>
          {chasse.map((a) => (
            <li key={a.placementId} className={`chasse-ligne${a.controle ? ' controle' : ''}`}>
              <img src={imageOutil(a.outil)} alt="" draggable={false} className={`chasse-vignette v-${a.outil}`} />
              <div className="chasse-infos">
                <strong>{a.nom}</strong>
                <span className="chasse-ou">{ou(a)}</span>
              </div>
              <span className={`chasse-valeur${a.allume ? '' : ' eteint'}`}>
                {mesure(a)}
                {a.allume ? '' : ' (éteint)'}
              </span>
              {a.controle && <Curseur a={a} />}
              <button
                className={`btn btn-sm${a.controle ? ' btn-brass' : ''}`}
                onClick={() => void window.jdr.chasse.controler(a.placementId, a.controle ? null : a.valeur)}
              >
                {a.controle ? 'Lâcher le contrôle de cet objet' : 'Prendre le contrôle de cet objet'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
