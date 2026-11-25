/**
 * L'onglet Objets du téléphone : les outils de chasse que le joueur porte ou
 * qu'il a posés. Un outil en main s'ouvre sur sa page (l'appareil vivant, et
 * de quoi l'allumer ou le poser) ; un outil posé n'est qu'une ligne, avec sa
 * valeur quand le joueur a de quoi la lire d'où il est.
 */
import { useState } from 'react'
import type { OutilTelephone } from '@shared/chasse'
import { PhotoEmf } from '../mj/chasse/PhotoEmf'
import { EcranThermometre } from '../mj/chasse/EcranThermometre'
import { useNiveauVivant, useTemperatureVivante } from '../mj/chasse/vivant'
import { texteTemperature } from '../mj/chasse/temperature'
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
    return (await r.json().catch(() => ({}))).erreur ?? 'Le serveur a refusé.'
  } catch {
    return 'Le serveur ne répond pas.'
  }
}

/** La valeur lue, en mots : un niveau pour l'EMF, des degrés pour le thermomètre. */
function lecture(o: OutilTelephone): string | null {
  if (o.valeur == null || !o.allume) return null
  return o.outil === 'emf' ? `Niveau ${Math.round(o.valeur)}` : `${texteTemperature(o.valeur)} °C`
}

/** L'appareil à l'écran, vivant : le niveau tremble, la température glisse. */
function Appareil({ o }: { o: OutilTelephone }): JSX.Element {
  const niveau = useNiveauVivant(o.valeur ?? 0, o.allume)
  const temperature = useTemperatureVivante(o.valeur ?? 0)
  return (
    <div className="m-appareil">
      {o.outil === 'emf' ? (
        <PhotoEmf n={niveau} eteint={!o.allume} />
      ) : (
        <EcranThermometre t={temperature} eteint={!o.allume} />
      )}
    </div>
  )
}

export function Outils({
  outils,
  jeton,
  api
}: {
  outils: OutilTelephone[]
  jeton: string
  api: string
}): JSX.Element {
  const [ouvert, setOuvert] = useState<number | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)
  /* Une page n'existe que pour un outil encore en main : posé, on retombe sur la liste. */
  const page = outils.find((o) => o.placementId === ouvert && o.ou === 'main') ?? null
  useRetourFerme(!!page, () => setOuvert(null))

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
    if (route === 'poser') setOuvert(null)
  }

  if (page) {
    return (
      <div className="m-vue m-outil-page">
        <button className="m-outil-retour" onClick={() => history.back()}>
          ‹ Objets
        </button>
        <h2 className="m-outil-titre">{page.nom}</h2>
        <Appareil o={page} />
        {erreur ? <p className="m-erreur">{erreur}</p> : null}
        <div className="m-outil-actions">
          <button className="m-outil-btn" disabled={envoi} onClick={() => void geste('allumer', page)}>
            {page.allume ? 'Éteindre' : 'Allumer'}
          </button>
          <button className="m-outil-btn" disabled={envoi} onClick={() => void geste('poser', page)}>
            Poser ici
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="m-vue m-outils">
      {erreur ? <p className="m-erreur">{erreur}</p> : null}
      {outils.length === 0 ? <p className="m-note">Aucun objet à lire pour l’instant.</p> : null}
      {outils.map((o) => {
        const lu = o.ou === 'lieu' ? lecture(o) : null
        const contenu = (
          <>
            <span className="m-outil-img">
              <Visage url={imageOutil(o.outil)} cadre={null} alt="" />
            </span>
            <span className="m-outil-texte">
              <b>{o.nom}</b>
              <span>
                {o.allume ? 'allumé' : 'éteint'} · {o.ou === 'main' ? 'en main' : 'posé'}
              </span>
              {lu ? <span className="m-outil-valeur">{lu}</span> : null}
            </span>
            {o.ou === 'main' ? <span aria-hidden="true">›</span> : null}
          </>
        )
        return o.ou === 'main' ? (
          <button key={o.placementId} className="m-outil-ligne" onClick={() => setOuvert(o.placementId)}>
            {contenu}
          </button>
        ) : (
          <div key={o.placementId} className="m-outil-ligne pose">
            {contenu}
          </div>
        )
      })}
    </div>
  )
}
