import { useEffect, useState } from 'react'
import { useStore } from '../../../store'
import { IconTrash } from '../../Icons'
import type { Reglage } from '../registre'

/* ============================================================
   Portables
   ============================================================ */

/** L'état du serveur se relit quand la ligne qui le montre paraît. */
function useMobileFrais(): void {
  const refreshMobile = useStore((s) => s.refreshMobile)
  useEffect(() => {
    void refreshMobile()
  }, [refreshMobile])
}

export const reglages: Reglage[] = [
  {
    id: 'portable.acces',
    rubrique: 'portables',
    nom: 'L’accès',
    aide: 'Ouvert, il le reste toute la séance : le même code vaut pour un retardataire.',
    mots: ['téléphones', 'qr code', 'serveur', 'ouvrir', 'wi-fi', 'invitation'],
    Cmd: function Acces() {
      const s = useStore()
      const info = s.mobile
      const [erreur, setErreur] = useState<string | null>(null)
      useMobileFrais()
      return (
        <>
          <span className={`pm-etat${info?.inviteOpen ? ' on' : ''}`}>
            {info?.inviteOpen ? (info.url ?? 'ouvert').replace('http://', '') : 'fermé'}
          </span>
          {info?.inviteOpen ? (
            <button
              className="btn btn-sm btn-danger"
              onClick={async () => s.setMobile(await window.jdr.mobile.closeInvite())}
            >
              Fermer l’accès
            </button>
          ) : (
            <button
              className="btn btn-sm"
              onClick={async () => {
                setErreur(null)
                try {
                  s.setMobile((await window.jdr.mobile.open()).info)
                } catch (e) {
                  setErreur(e instanceof Error ? e.message : String(e))
                }
              }}
            >
              Ouvrir l’accès
            </button>
          )}
          {erreur ? <p className="pm-erreur">{erreur}</p> : null}
        </>
      )
    }
  },
  {
    id: 'portable.port',
    rubrique: 'portables',
    nom: 'Port du serveur',
    aide: 'Un port déjà pris par un autre logiciel se change ici. Les téléphones devront viser la nouvelle adresse.',
    mots: ['réseau', 'serveur', 'numéro', 'pare-feu'],
    Cmd: function Port() {
      const s = useStore()
      return (
        <input
          type="number"
          min={1024}
          max={65535}
          style={{ width: 96 }}
          defaultValue={s.poste.port}
          aria-label="Port du serveur"
          onBlur={async (e) => {
            await s.poserPoste('portable.port', Number(e.target.value))
            await s.refreshMobile()
          }}
        />
      )
    }
  },
  {
    id: 'portable.adresse',
    rubrique: 'portables',
    nom: 'Adresse annoncée',
    aide: 'Sur un poste à deux réseaux, le QR code ne peut en porter qu’un.',
    mots: ['ip', 'réseau', 'wi-fi', 'qr code', 'carte réseau'],
    Cmd: function Adresse() {
      const s = useStore()
      const info = s.mobile
      return (
        <select
          value={s.poste.adresse ?? ''}
          onChange={async (e) => {
            await s.poserPoste('portable.adresse', e.target.value || null)
            await s.refreshMobile()
          }}
        >
          <option value="">Choisir toute seule{info?.adresse ? ` (${info.adresse})` : ''}</option>
          {(info?.adresses ?? []).map((a) => (
            <option key={a.ip} value={a.ip}>
              {a.ip} · {a.nom}
            </option>
          ))}
        </select>
      )
    }
  },
  {
    id: 'portable.appareils',
    rubrique: 'portables',
    nom: 'Appareils par joueur',
    aide: 'Un portable et une tablette, par exemple.',
    mots: ['téléphones', 'tablettes', 'nombre', 'limite'],
    Cmd: function AppareilsParJoueur() {
      const s = useStore()
      return (
        <input
          type="number"
          min={1}
          max={8}
          style={{ width: 74 }}
          defaultValue={s.poste.appareils}
          aria-label="Appareils par joueur"
          onBlur={async (e) => {
            await s.poserPoste('portable.appareils', Number(e.target.value))
            await s.refreshMobile()
          }}
        />
      )
    }
  },
  {
    id: 'portable.appaires',
    rubrique: 'portables',
    nom: 'Appareils appairés',
    mots: ['téléphones', 'révoquer', 'connectés', 'liste', 'oublier'],
    pleine: true,
    Cmd: function Appaires() {
      const s = useStore()
      const info = s.mobile
      useMobileFrais()
      if (!info || info.devices.length === 0) return <p className="pm-aparte">Personne encore.</p>
      return (
        <div className="pm-liste">
          {info.devices.map((d) => (
            <div className={`pm-lig c-${d.playerColor ?? 'neutral'}`} key={d.id}>
              <span className="pip teinte" />
              {d.playerName}
              <span className={`pm-etat${d.online ? ' on' : ''}`}>
                {d.online ? 'en ligne' : 'hors ligne'}
              </span>
              <div className="spacer" />
              <button
                className="btn btn-sm btn-ghost btn-danger"
                title="Cet appareil devra rescanner le code"
                onClick={async () => s.setMobile(await window.jdr.mobile.revoke(d.id))}
              >
                <IconTrash />
                Révoquer
              </button>
            </div>
          ))}
        </div>
      )
    }
  }
]
