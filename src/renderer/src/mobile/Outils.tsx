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
import { useMemo, useState } from 'react'
import { seRegleAllume, type OutilChasse, type OutilTelephone } from '@shared/chasse'
import type { ParoleTelephone } from '@shared/parole'
import { VueLivre, VuePlanche, VueSpirit, dureeVoix, livreEcrit, plancheBouge } from '../shared/chasse/Vues'
import { useMaintenant } from '../shared/chasse/temps'
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

/** L'appareil en grand, vivant : le niveau tremble, la température glisse, le livre s'écrit… */
function Appareil({
  o,
  p,
  decalage
}: {
  o: { outil: OutilChasse; allume: boolean; valeur: number | null }
  p?: ParoleTelephone
  decalage: number
}): JSX.Element {
  if (o.outil === 'emf' || o.outil === 'thermometre')
    return (
      <div className="m-appareil">
        {o.outil === 'emf' ? <EmfVivant o={o} /> : <ThermometreVivant o={o} />}
      </div>
    )
  return (
    <div className={`m-parle m-parle-${o.outil}`}>
      <Parle outil={o.outil} allume={o.allume} p={p} decalage={decalage} />
    </div>
  )
}

/** Un outil qui parle, réglé sur l'horloge du poste : il ne s'anime que quand il se passe quelque chose. */
function Parle({
  outil,
  allume,
  p,
  decalage
}: {
  outil: 'spiritbox' | 'livre' | 'planche'
  allume: boolean
  p?: ParoleTelephone
  decalage: number
}): JSX.Element {
  const maintenant = Date.now() + decalage
  const actif =
    outil === 'livre'
      ? livreEcrit(p?.pages ?? [], maintenant)
      : outil === 'planche'
        ? plancheBouge(p?.goutte ?? null, maintenant)
        : !!p?.dit && maintenant < p.dit.a + dureeVoix(p.dit.texte)
  const t = useMaintenant(actif, decalage)
  if (outil === 'spiritbox') return <VueSpirit allume={allume} dit={p?.dit} maintenant={t} />
  if (outil === 'livre') return <VueLivre pages={p?.pages ?? []} maintenant={t} />
  return <VuePlanche goutte={p?.goutte ?? null} maintenant={t} />
}

/* Un composant par outil : chacun ne fait tourner que son animation. */
function EmfVivant({ o }: { o: { valeur: number | null; allume: boolean } }): JSX.Element {
  const niveau = useNiveauVivant(o.valeur ?? 0, o.allume)
  return <PhotoEmf n={niveau} eteint={!o.allume} />
}

function ThermometreVivant({ o }: { o: { valeur: number | null; allume: boolean } }): JSX.Element {
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
  /* Les outils qui parlent ne mesurent rien : on dit s'ils sont en marche, ou comment les lire. */
  if (o.outil === 'spiritbox') return <span className="m-op-lu">{o.allume ? 'allumée' : 'éteinte'}</span>
  if (o.outil === 'livre' || o.outil === 'planche') return <small>touche pour {o.outil === 'livre' ? 'le' : 'la'} lire</small>
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
  onRamasser,
  paroles = [],
  horloge
}: {
  outils: OutilTelephone[]
  jeton: string
  api: string
  aPortee?: AppareilAPortee[]
  onRamasser?: (placementId: number) => void
  /** Ce que disent la spirit box, le livre, la planche qu'il tient ou qui sont posés près de lui. */
  paroles?: ParoleTelephone[]
  /** L'heure du poste quand cet état est parti : les animations s'y accordent. */
  horloge?: number
}): JSX.Element | null {
  const [ouvert, setOuvert] = useState<number | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)
  /* Ce qu'il faut ajouter à l'horloge de cet appareil pour lire celle du poste. */
  const decalage = useMemo(() => (horloge ? horloge - Date.now() : 0), [horloge])
  const parole = (placementId: number): ParoleTelephone | undefined => paroles.find((p) => p.placementId === placementId)
  /* Un outil qui parle, posé près de lui par quelqu'un d'autre : il le lit sans l'avoir. */
  const proches = paroles.filter((p) => !outils.some((o) => o.placementId === p.placementId))
  /* L'appareil en grand : un outil en main, ou un outil qui parle qu'il voit. */
  const grand = outils.find((o) => o.placementId === ouvert && o.ou === 'main') ?? null
  const grandProche = !grand
    ? (paroles.find((p) => p.placementId === ouvert) ?? null)
    : null
  useRetourFerme(!!grand || !!grandProche, () => setOuvert(null))

  /* Ceux qu'un autre a posés : ils ne sont pas dans ma liste, mais je peux les prendre. */
  const autres = aPortee.filter(
    (a) => !outils.some((o) => o.placementId === a.id) && !proches.some((p) => p.placementId === a.id)
  )
  const peutRamasser = (id: number): boolean => !!onRamasser && aPortee.some((a) => a.id === id)
  /* Seulement ce qu'on porte ; un appareil posé ne revient que quand on est
     assez près pour le ramasser. */
  const visibles = outils.filter(
    (o) => o.ou === 'main' || peutRamasser(o.placementId) || (o.ou === 'lieu' && !!parole(o.placementId))
  )
  if (!visibles.length && !autres.length && !proches.length) return null

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
                {seRegleAllume(o.outil) ? (
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
                ) : null}
                <button className="m-op-btn" disabled={envoi} onClick={() => void geste('poser', o)}>
                  Poser<span className="m-op-dit"> ici</span>
                </button>
              </span>
            </div>
          ) : (
            <div key={o.placementId} className={`m-op-carte pose${peutRamasser(o.placementId) ? ' proche' : ''}`}>
              <button
                className="m-op-ouvrir"
                disabled={!parole(o.placementId)}
                aria-label={`Lire ${o.nom}`}
                onClick={() => setOuvert(o.placementId)}
              >
                <span className="m-op-img">
                  <Visage url={imageOutil(o.outil)} cadre={null} alt="" />
                </span>
                <span className="m-op-texte">
                  <b>{o.nom}</b>
                  <small>{peutRamasser(o.placementId) ? 'posé, à portée de main' : 'posé près de toi'}</small>
                  <Lecture o={o} />
                </span>
              </button>
              {peutRamasser(o.placementId) ? (
                <button className="m-op-btn m-op-ramasser" onClick={() => onRamasser!(o.placementId)}>
                  Ramasser
                </button>
              ) : null}
            </div>
          )
        )}
        {proches.map((p) => (
          <div key={p.placementId} className={`m-op-carte pose${peutRamasser(p.placementId) ? ' proche' : ''}`}>
            <button className="m-op-ouvrir" aria-label={`Lire ${p.nom}`} onClick={() => setOuvert(p.placementId)}>
              <span className="m-op-img">
                <Visage url={imageOutil(p.outil)} cadre={null} alt="" />
              </span>
              <span className="m-op-texte">
                <b>{p.nom}</b>
                <small>posé près de toi</small>
              </span>
            </button>
            {peutRamasser(p.placementId) ? (
              <button className="m-op-btn m-op-ramasser" onClick={() => onRamasser!(p.placementId)}>
                Ramasser
              </button>
            ) : null}
          </div>
        ))}
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
          <Appareil o={grand} p={parole(grand.placementId)} decalage={decalage} />
          {erreur ? <p className="m-erreur">{erreur}</p> : null}
          <div className="m-outil-actions">
            {seRegleAllume(grand.outil) ? (
              <button className="m-outil-btn" disabled={envoi} onClick={() => void geste('allumer', grand)}>
                {grand.allume ? 'Éteindre' : 'Allumer'}
              </button>
            ) : null}
            <button className="m-outil-btn" disabled={envoi} onClick={() => void geste('poser', grand)}>
              Poser ici
            </button>
          </div>
        </div>
      ) : grandProche ? (
        <div className="m-op-grand" role="dialog" aria-label={grandProche.nom}>
          <button className="m-outil-retour" onClick={() => history.back()}>
            ‹ Plan
          </button>
          <h2 className="m-outil-titre">{grandProche.nom}</h2>
          {/* Posé, il ne s'allume pas d'ici : une spirit box qu'on entend est allumée. */}
          <Appareil
            o={{ outil: grandProche.outil, allume: !!grandProche.dit || grandProche.outil !== 'spiritbox', valeur: null }}
            p={grandProche}
            decalage={decalage}
          />
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
