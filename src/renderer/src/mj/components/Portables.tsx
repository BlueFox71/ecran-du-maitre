import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { IconTrash } from './Icons'
import type { MobileInfo } from '@shared/types'

/**
 * Les portables des joueurs — un onglet de la Régie, pas une fenêtre.
 *
 * Le code se regarde en même temps que la scène qu'on prépare : une fenêtre
 * par-dessus aurait caché l'une pour montrer l'autre, et il aurait fallu la
 * rouvrir chaque fois qu'un joueur arrive en retard.
 *
 * Deux gestes distincts, et c'est tout l'écran :
 *  — **ouvrir l'accès**, une fois, et il le reste tant que le projet l'est ;
 *  — **tendre le code à la table**, le temps que chacun scanne.
 */
export function Portables(): JSX.Element {
  const s = useStore()
  const [erreur, setErreur] = useState<string | null>(null)
  const [occupe, setOccupe] = useState(false)
  const info = s.mobile
  const surEcran = !!s.display?.qr

  const ouvrir = async (): Promise<void> => {
    setErreur(null)
    setOccupe(true)
    try {
      s.setMobile((await window.jdr.mobile.open()).info)
    } catch (e) {
      setErreur(String(e instanceof Error ? e.message : e))
    } finally {
      setOccupe(false)
    }
  }

  const montrer = async (on: boolean): Promise<void> => {
    s.setMobile(await window.jdr.mobile.show(on))
  }

  if (!info?.inviteOpen) {
    return (
      <div className="pt-panneau">
        <p className="pt-intro">
          Chaque joueur ouvre sa fiche sur son téléphone, note son dé et pousse son propre pion.
          Tout passe par le <b>Wi-Fi</b> de la maison — rien ne sort vers Internet.
        </p>
        {erreur ? <p className="pt-erreur">{erreur}</p> : null}
        <button className="btn btn-brass" disabled={occupe} onClick={() => void ouvrir()}>
          {occupe ? 'Ouverture…' : 'Ouvrir l’accès'}
        </button>
        <p className="pt-rien">
          Une fois ouvert, il le reste toute la séance : le même code vaut pour un joueur arrivé en
          retard ou qui change de téléphone.
        </p>
      </div>
    )
  }

  return (
    <div className="pt-panneau">
      {info.qr ? (
        <button
          className={`pt-vignette${surEcran ? ' montre' : ''}`}
          title={surEcran ? 'Retirer le code de l’écran des joueurs' : 'Montrer le code à la table'}
          onClick={() => void montrer(!surEcran)}
        >
          <img src={info.qr} alt="QR code d’appairage" />
          <span className="pt-sur">
            {surEcran ? 'à l’écran des joueurs' : 'clique pour le montrer'}
          </span>
        </button>
      ) : (
        <p className="pt-erreur">Aucune adresse réseau. Vérifie que ce poste est sur le Wi-Fi.</p>
      )}

      {info.url ? <div className="pt-url">{info.url.replace('http://', '')}</div> : null}

      {/* Ce qui empêcherait le code d'arriver jusqu'à la table, dit plutôt que cherché. */}
      {surEcran && s.display?.frozen ? (
        <p className="pt-alerte">
          L’écran des joueurs est <b>figé</b> : le code ne leur parvient pas.
        </p>
      ) : null}
      {surEcran && !s.display?.playerOpen ? (
        <p className="pt-alerte">
          L’écran des joueurs est <b>fermé</b>. Ouvre-le, ou fais-leur taper l’adresse.
        </p>
      ) : null}

      <button className="btn btn-sm" onClick={() => void montrer(!surEcran)}>
        {surEcran ? 'Retirer de l’écran' : 'Montrer aux joueurs'}
      </button>

      <div className="pt-appareils">
        <div className="pt-titre">
          <span className="eyebrow">Appareils</span>
          <span className="pt-cpt">
            {info.devices.length === 0
              ? 'aucun'
              : `${info.devices.length} appairé${info.devices.length > 1 ? 's' : ''}`}
          </span>
        </div>

        {info.devices.length === 0 ? (
          <p className="pt-rien">
            Personne encore. Deux appareils au plus par joueur — un portable et une tablette, par
            exemple.
          </p>
        ) : (
          <div className="pt-liste">
            {info.devices.map((d) => {
              const siens = info.devices.filter((x) => x.playerId === d.playerId)
              return (
                <div className={`pt-lig c-${d.playerColor ?? 'neutral'}`} key={d.id}>
                  <span className="pip teinte" />
                  <span className="pt-qui">
                    <span className="pt-nom">{d.playerName}</span>
                    <span className={`pt-etat${d.online ? ' on' : ''}`}>
                      {d.online ? 'en ligne' : 'hors ligne'}
                    </span>
                  </span>
                  {siens[0]?.id === d.id ? (
                    <span className={`pt-part${siens.length >= info.maxPerPlayer ? ' plein' : ''}`}>
                      {siens.length}/{info.maxPerPlayer}
                    </span>
                  ) : (
                    <span />
                  )}
                  <button
                    className="btn btn-ghost btn-sm btn-ico"
                    title="Couper cet appareil"
                    aria-label={`Couper l’appareil de ${d.playerName}`}
                    onClick={async () => {
                      if (!confirm(`Couper l’appareil de ${d.playerName} ? Il devra rescanner.`))
                        return
                      s.setMobile(await window.jdr.mobile.revoke(d.id))
                    }}
                  >
                    <IconTrash />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Refermer change le code et oblige tout le monde à rescanner : c'est un
          geste rare, il reste possible mais ne tombe pas sous la main. */}
      <button
        className="pt-fermer"
        onClick={async () => {
          if (!confirm('Refermer l’accès ? Le code changera, les nouveaux devront rescanner.'))
            return
          s.setMobile(await window.jdr.mobile.closeInvite())
        }}
      >
        fermer l’accès
      </button>
    </div>
  )
}

/**
 * Ce que la table dit au maître du jeu, en bas de l'écran.
 *
 * Deux choses seulement, et elles ne passent pas par les étiquettes ordinaires
 * — celles-ci ne montrent que les ratés, parce qu'on a jugé qu'une confirmation
 * à chaque geste ne rassurait personne. Mais un jet qui arrive d'un téléphone
 * n'est le geste de personne ici, et un pion qui glisse tout seul ressemble à
 * un bug tant qu'on ne sait pas qui le pousse. Ces deux-là, il faut les dire.
 */
export function Annonces(): JSX.Element | null {
  const s = useStore()
  const noms = s.mobileNudges.map((n) => n.playerName)
  if (s.mobileRolls.length === 0 && noms.length === 0) return null

  return (
    <div className="pt-annonces">
      {s.mobileRolls.map((r) => (
        <div className={`pt-jet c-${r.couleur ?? 'neutral'}`} key={r.id} role="status">
          <span className="pip teinte" />
          <b>{r.nom}</b>
          {r.texte}
        </div>
      ))}
      {noms.length > 0 ? (
        <div className="pt-remue" role="status">
          <span className="pt-point" />
          {noms.length === 1
            ? `${noms[0]} déplace son pion`
            : `${noms.slice(0, -1).join(', ')} et ${noms.at(-1)} déplacent leurs pions`}
        </div>
      ) : null}
    </div>
  )
}

/**
 * Le branchement des messages venus des téléphones. Un seul endroit s'en
 * charge, monté une fois avec l'application : un jet arrivé pendant qu'on est
 * dans la Bibliothèque doit s'annoncer quand même.
 */
export function EcouteDesPortables(): null {
  const s = useStore()

  useEffect(() => {
    const api = window.jdr.mobile
    let suite = 0
    const off = [
      api.onInfo((i: MobileInfo) => s.setMobile(i)),
      api.onNudge((n) => useStore.setState({ mobileNudges: n })),
      api.onChanged(() => void s.refreshPlayers()),
      /* L'onde arrive aussi au MJ : il doit savoir qui montre, même quand il
         a les yeux sur sa Régie et pas sur l'écran de la table. */
      window.jdr.display.onPing((p) => {
        const id = ++suite
        useStore.setState((e) => ({
          mobileRolls: [
            ...e.mobileRolls,
            { id, nom: p.playerName, texte: 'montre un point', couleur: p.color }
          ]
        }))
        setTimeout(
          () => useStore.setState((e) => ({ mobileRolls: e.mobileRolls.filter((x) => x.id !== id) })),
          3000
        )
      }),
      api.onRoll((r) => {
        const id = ++suite
        useStore.setState((e) => ({
          mobileRolls: [
            ...e.mobileRolls,
            { id, nom: r.playerName, texte: `${r.label} → ${r.total}`, couleur: r.color }
          ]
        }))
        /* Six secondes : le temps de lever les yeux si on regardait ailleurs. */
        setTimeout(
          () => useStore.setState((e) => ({ mobileRolls: e.mobileRolls.filter((x) => x.id !== id) })),
          6000
        )
        void s.refreshRolls()
      })
    ]
    void s.refreshMobile()
    return () => off.forEach((f) => f())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

export const IconPhone = (): JSX.Element => (
  <svg
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="6" y="2.5" width="12" height="19" rx="2.6" />
    <path d="M10.5 18.6h3" />
  </svg>
)
