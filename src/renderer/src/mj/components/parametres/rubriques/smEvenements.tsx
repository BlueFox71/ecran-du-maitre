import { useCallback, useEffect, useState } from 'react'
import { useStore } from '../../../store'
import type { EvenementSm } from '@shared/santeMentale'
import { Champ, Num, Txt } from './sante'

/* ============================================================
   Santé mentale : les événements, séance par séance
   ============================================================ */

type Maj = Partial<Omit<EvenementSm, 'id' | 'ord' | 'sessionId'>>

export function Evenements(): JSX.Element {
  const sessions = useStore((s) => s.sessions)
  const active = useStore((s) => s.session)
  const [choisie, setChoisie] = useState<number | null>(null)
  const [liste, setListe] = useState<EvenementSm[]>([])
  /* La séance montrée : celle qu'on a choisie, sinon la séance active, sinon la première. */
  const sid =
    choisie !== null && sessions.some((x) => x.id === choisie) ? choisie : (active?.id ?? sessions[0]?.id ?? null)

  const relire = useCallback(async (): Promise<void> => {
    setListe(sid === null ? [] : await window.jdr.sm.evenements(sid))
  }, [sid])

  useEffect(() => {
    void relire()
  }, [relire])
  /* Un Ctrl+Z ou Ctrl+Y : la liste a pu changer sous nos yeux. */
  useEffect(() => {
    const f = (): void => void relire()
    window.addEventListener('jdr:defait', f)
    return () => window.removeEventListener('jdr:defait', f)
  }, [relire])

  if (sid === null) return <p className="rgm-aide">Aucune séance : crée-en une pour y poser des événements.</p>

  const maj = async (e: EvenementSm, p: Maj): Promise<void> => {
    const { ord: _ord, ...reste } = { ...e, ...p }
    void _ord
    setListe(await window.jdr.sm.ecrire(reste))
  }
  const deplacer = async (i: number, d: number): Promise<void> => {
    const j = i + d
    if (j < 0 || j >= liste.length) return
    const ids = liste.map((e) => e.id)
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    setListe(await window.jdr.sm.ranger(sid, ids))
  }
  const ajouter = async (): Promise<void> =>
    setListe(
      await window.jdr.sm.ecrire({ sessionId: sid, nom: 'Nouvel événement', note: null, perte: 3, jet: true, tous: false })
    )
  const autres = sessions.filter((x) => x.id !== sid)

  return (
    <div className="sm-liste">
      <Champ label="Séance">
        <select value={sid} aria-label="Séance" onChange={(e) => setChoisie(Number(e.target.value))}>
          {sessions.map((x) => (
            <option key={x.id} value={x.id}>
              {x.label}
            </option>
          ))}
        </select>
      </Champ>
      {liste.length === 0 ? <p className="rgm-aide">Aucun événement dans cette séance.</p> : null}
      {liste.map((e, i) => (
        <div className="sm-rang" key={e.id}>
          <div className="sm-champs">
            <Champ label="Nom">
              <Txt v={e.nom} label="Nom" large onCommit={(v) => void maj(e, { nom: v })} />
            </Champ>
            <Champ label="Note">
              <Txt v={e.note ?? ''} label="Note" onCommit={(v) => void maj(e, { note: v.trim() === '' ? null : v })} />
            </Champ>
            <Champ label="Perte">
              <Num v={e.perte} label="Perte" min={0} onCommit={(v) => void maj(e, { perte: v ?? 0 })} />
            </Champ>
            <Champ label="Avec jet">
              <input
                type="checkbox"
                checked={e.jet}
                aria-label="Avec jet"
                onChange={(x) => void maj(e, { jet: x.target.checked })}
              />
            </Champ>
            <Champ label="Tous">
              <input
                type="checkbox"
                checked={e.tous}
                aria-label="Tous"
                onChange={(x) => void maj(e, { tous: x.target.checked })}
              />
            </Champ>
            {autres.length ? (
              <Champ label="Dupliquer">
                <select
                  value=""
                  aria-label="Dupliquer vers une séance"
                  onChange={(x) => {
                    const vers = Number(x.target.value)
                    if (vers) void window.jdr.sm.dupliquer(e.id, vers)
                  }}
                >
                  <option value="">Dupliquer vers une séance…</option>
                  {autres.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Champ>
            ) : null}
          </div>
          <div className="sm-outils">
            <button className="btn btn-sm btn-ghost" aria-label="Monter" disabled={i === 0} onClick={() => void deplacer(i, -1)}>
              ▲
            </button>
            <button
              className="btn btn-sm btn-ghost"
              aria-label="Descendre"
              disabled={i === liste.length - 1}
              onClick={() => void deplacer(i, 1)}
            >
              ▼
            </button>
            <button
              className="btn btn-sm btn-ghost"
              aria-label="Effacer"
              title="Effacer (Ctrl+Z le rend)"
              onClick={async () => setListe(await window.jdr.sm.effacer(e.id))}
            >
              ✕
            </button>
          </div>
        </div>
      ))}
      <div>
        <button className="btn btn-sm" onClick={() => void ajouter()}>
          + Ajouter un événement
        </button>
      </div>
    </div>
  )
}
