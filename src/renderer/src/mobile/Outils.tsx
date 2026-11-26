/**
 * Les outils de chasse du joueur, sur la page Pion : ceux qu'il porte et ceux
 * qu'il a posés, sous le plan (au téléphone, en bande) ou à côté (à la
 * tablette en paysage, en colonne).
 *
 * Chaque carte montre l'appareil vivant — les LED de l'EMF, les degrés du
 * thermomètre — et, en main, de quoi l'allumer ou le poser sans quitter le
 * plan. Un toucher sur la carte ouvre l'appareil en grand par-dessus la page ;
 * le retour du téléphone le referme. Un appareil posé à portée de main — le
 * sien ou celui d'un autre, pourvu qu'on le voie — porte un bouton
 * « Ramasser ». Sa valeur ne s'affiche que si le joueur a de quoi la lire
 * d'où il est.
 */
import { useState } from 'react'
import type { OutilChasse, OutilTelephone } from '@shared/chasse'
import { PhotoEmf } from '../mj/chasse/PhotoEmf'
import { EcranThermometre } from '../mj/chasse/EcranThermometre'
import { useNiveauVivant, useTemperatureVivante } from '../mj/chasse/vivant'
import { texteTemperature } from '../mj/chasse/temperature'
import { LEDS_EMF, ledsVisibles } from '../mj/chasse/emf'
import { imageOutil } from '../shared/outilsChasse'
import { Visage } from '../shared/Visage'
import { useRetourFerme } from './Mobile'

/** Un geste vers le serveur ; le refus (`{ erreur }`) revient en clair, `null` si tout va bien. */
async function envoyer(
  api: string,
  jeton: string,
  route: 'allumer' | 'poser',
  corps: Record<string, unknown>
): Promise<string | null> {
  try {
    const r = await fetch(`${api}/api/${route}?t=${encodeURIComponent(jeton)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(corps)
    })
    if (r.ok) return null
    const erreur = (await r.json().catch(() => ({}))).erreur ?? 'Le serveur a refusé.'
    return erreur === 'gele' ? 'L’écran est figé : rien ne part.' : erreur
  } catch {
    return 'Le serveur ne répond pas.'
  }
}

/** L'appareil en grand, vivant : le niveau tremble, la température glisse. */
function Appareil({ o }: { o: OutilTelephone }): JSX.Element {
  return (
    <div className="m-appareil">
      {o.outil === 'emf' ? <EmfVivant o={o} /> : <ThermometreVivant o={o} />}
    </div>
  )
}

/* Un composant par outil : chacun ne fait tourner que son animation. */
function EmfVivant({ o }: { o: OutilTelephone }): JSX.Element {
  const niveau = useNiveauVivant(o.valeur ?? 0, o.allume)
  return <PhotoEmf n={niveau} eteint={!o.allume} />
}

function ThermometreVivant({ o }: { o: OutilTelephone }): JSX.Element {
  const temperature = useTemperatureVivante(o.valeur ?? 0)
  return <EcranThermometre t={temperature} eteint={!o.allume} />
}

/** La lecture d'une carte, vivante elle aussi : les LED et le niveau, ou les degrés. */
function LectureEmf({ o }: { o: OutilTelephone }): JSX.Element {
  const niveau = useNiveauVivant(o.valeur ?? 0, o.allume)
  const n = ledsVisibles(niveau, o.allume)
  return (
    <>
      <span className="m-op-leds" aria-hidden="true">
        {LEDS_EMF.map((l, i) => (
          <i key={l.nom} style={i < n ? { background: l.couleur, boxShadow: `0 0 6px ${l.couleur}` } : undefined} />
        ))}
      </span>
      <span className="m-op-lu">
        {!o.allume ? 'éteint' : o.valeur == null ? '—' : `Niveau ${Math.max(0, Math.round(o.valeur))}`}
      </span>
    </>
  )
}

function LectureThermometre({ o }: { o: OutilTelephone }): JSX.Element {
  const t = useTemperatureVivante(o.valeur ?? 0)
  return (
    <span className={`m-op-lu m-op-degres${t < 10 ? ' froid' : ''}`}>
      {o.allume ? `${texteTemperature(t).replace('.', ',')} °C` : 'éteint'}
    </span>
  )
}

/** Ce que lit l'appareil, s'il y a de quoi le lire d'ici. */
function Lecture({ o }: { o: OutilTelephone }): JSX.Element {
  /* Rien à lire d'ici : l'EMF garde ses LED éteintes et le thermomètre un tiret,
     pour que la carte ne change pas de taille. */
  if (o.valeur == null && o.outil !== 'emf') return <span className="m-op-lu">{o.allume ? '—' : 'éteint'}</span>
  return o.outil === 'emf' ? <LectureEmf o={o} /> : <LectureThermometre o={o} />
}

/** Un appareil posé assez près du pion pour qu'on le ramasse, et qu'on voit. */
export interface AppareilAPortee {
  id: number
  nom: string
  outil: OutilChasse
}

export function ObjetsDuPion({
  outils,
  jeton,
  api,
  aPortee = [],
  onRamasser
}: {
  outils: OutilTelephone[]
  jeton: string
  api: string
  aPortee?: AppareilAPortee[]
  onRamasser?: (placementId: number) => void
}): JSX.Element | null {
  const [ouvert, setOuvert] = useState<number | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)
  /* L'appareil en grand n'existe que pour un outil encore en main : posé, il se referme. */
  const grand = outils.find((o) => o.placementId === ouvert && o.ou === 'main') ?? null
  useRetourFerme(!!grand, () => setOuvert(null))

  /* Ceux qu'un autre a posés : ils ne sont pas dans ma liste, mais je peux les prendre. */
  const autres = aPortee.filter((a) => !outils.some((o) => o.placementId === a.id))
  const peutRamasser = (id: number): boolean => !!onRamasser && aPortee.some((a) => a.id === id)
  /* Seulement ce qu'on porte ; un appareil posé ne revient que quand on est
     assez près pour le ramasser. */
  const visibles = outils.filter((o) => o.ou === 'main' || peutRamasser(o.placementId))
  if (!visibles.length && !autres.length) return null

  const geste = async (route: 'allumer' | 'poser', o: OutilTelephone): Promise<void> => {
    setErreur(null)
    setEnvoi(true)
    const refus = await envoyer(
      api,
      jeton,
      route,
      route === 'allumer' ? { placementId: o.placementId, allumee: !o.allume } : { placementId: o.placementId }
    )
    setEnvoi(false)
    if (refus) return setErreur(refus)
    if (route === 'poser' && ouvert === o.placementId) history.back()
  }

  /* En main d'abord : ce sont eux qu'on manie. */
  const tries = [...visibles.filter((o) => o.ou === 'main'), ...visibles.filter((o) => o.ou !== 'main')]

  return (
    <section className="m-objets-pion">
      <span className="m-eyebrow">Mes objets</span>
      {erreur ? <p className="m-erreur">{erreur}</p> : null}
      <div className="m-op-liste">
        {tries.map((o) =>
          o.ou === 'main' ? (
            <div key={o.placementId} className="m-op-carte">
              <button
                className="m-op-ouvrir"
                aria-label={`Ouvrir ${o.nom} en grand`}
                onClick={() => setOuvert(o.placementId)}
              >
                <span className="m-op-img">
                  <Visage url={imageOutil(o.outil)} cadre={null} alt="" />
                </span>
                <span className="m-op-texte">
                  <b>{o.nom}</b>
                  <Lecture o={o} />
                </span>
              </button>
              <span className="m-op-actions">
                <button
                  className={`m-op-btn m-op-marche${o.allume ? ' on' : ''}`}
                  disabled={envoi}
                  aria-pressed={o.allume}
                  aria-label={o.allume ? `Éteindre ${o.nom}` : `Allumer ${o.nom}`}
                  onClick={() => void geste('allumer', o)}
                >
                  <IconMarche />
                  {o.allume ? 'Éteindre' : 'Allumer'}
                </button>
                <button className="m-op-btn" disabled={envoi} onClick={() => void geste('poser', o)}>
                  Poser<span className="m-op-dit"> ici</span>
                </button>
              </span>
            </div>
          ) : (
            <div key={o.placementId} className={`m-op-carte pose${peutRamasser(o.placementId) ? ' proche' : ''}`}>
              <span className="m-op-img">
                <Visage url={imageOutil(o.outil)} cadre={null} alt="" />
              </span>
              <span className="m-op-texte">
                <b>{o.nom}</b>
                <small>posé, à portée de main</small>
                <Lecture o={o} />
              </span>
              {peutRamasser(o.placementId) ? (
                <button className="m-op-btn m-op-ramasser" onClick={() => onRamasser!(o.placementId)}>
                  Ramasser
                </button>
              ) : null}
            </div>
          )
        )}
        {autres.map((a) => (
          <div key={a.id} className="m-op-carte pose proche">
            <span className="m-op-img">
              <Visage url={imageOutil(a.outil)} cadre={null} alt="" />
            </span>
            <span className="m-op-texte">
              <b>{a.nom}</b>
              <small>posé là, à portée de main</small>
            </span>
            {onRamasser ? (
              <button className="m-op-btn m-op-ramasser" onClick={() => onRamasser(a.id)}>
                Ramasser
              </button>
            ) : null}
          </div>
        ))}
      </div>

      {grand ? (
        <div className="m-op-grand" role="dialog" aria-label={grand.nom}>
          <button className="m-outil-retour" onClick={() => history.back()}>
            ‹ Plan
          </button>
          <h2 className="m-outil-titre">{grand.nom}</h2>
          <Appareil o={grand} />
          {erreur ? <p className="m-erreur">{erreur}</p> : null}
          <div className="m-outil-actions">
            <button className="m-outil-btn" disabled={envoi} onClick={() => void geste('allumer', grand)}>
              {grand.allume ? 'Éteindre' : 'Allumer'}
            </button>
            <button className="m-outil-btn" disabled={envoi} onClick={() => void geste('poser', grand)}>
              Poser ici
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}

/** Le symbole marche/arrêt, dessiné : le glyphe ⏻ manque à bien des téléphones. */
function IconMarche(): JSX.Element {
  return (
    <svg className="m-op-icone" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v8" />
      <path d="M6.3 7.2a7.5 7.5 0 1 0 11.4 0" />
    </svg>
  )
}
