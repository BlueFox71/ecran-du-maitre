/**
 * Importer depuis une séance précédente.
 *
 * Une séance neuve part vide. Le MJ y reprend, d'une autre séance, les objets
 * et les documents qu'il veut — famille par famille, onglet par onglet, ou un
 * par un. Rien n'est coché d'office : on choisit ce qu'on emporte, pas ce
 * qu'on laisse.
 *
 * Tout ce qui arrive est une copie, et la fenêtre le dit.
 */
import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { useEchap } from '../echap'
import type { GameSession, ImportSource } from '@shared/types'
import { bilanImport } from '@shared/bilanImport'

type Onglet = 'objets' | 'pochette'

/** Une case qui sait dire « en partie ». */
function Case({
  etat,
  onChange,
  label
}: {
  etat: 'tout' | 'partiel' | 'rien'
  onChange: (coche: boolean) => void
  label: string
}): JSX.Element {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = etat === 'partiel'
  }, [etat])
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      checked={etat === 'tout'}
      onChange={(e) => onChange(e.target.checked)}
    />
  )
}

export function ImporterDUneSeance({
  onglet: ongletDepart,
  onClose
}: {
  onglet: Onglet
  onClose: () => void
}): JSX.Element {
  const s = useStore()
  useEchap(onClose)
  const autres = s.sessions.filter((x) => x.id !== s.session?.id)
  const [seance, setSeance] = useState<number | null>(autres[autres.length - 1]?.id ?? null)
  const [onglet, setOnglet] = useState<Onglet>(ongletDepart)
  const [source, setSource] = useState<ImportSource | null>(null)
  const [objets, setObjets] = useState<Set<number>>(new Set())
  const [docs, setDocs] = useState<Set<number>>(new Set())
  const [occupe, setOccupe] = useState(false)

  useEffect(() => {
    setSource(null)
    setObjets(new Set())
    setDocs(new Set())
    if (seance === null) return
    void window.jdr.seance.importSource(seance).then(setSource)
  }, [seance])

  const basculer = (set: Set<number>, ids: number[], coche: boolean): Set<number> => {
    const n = new Set(set)
    for (const id of ids) {
      if (coche) n.add(id)
      else n.delete(id)
    }
    return n
  }
  const etatDe = (set: Set<number>, ids: number[]): 'tout' | 'partiel' | 'rien' => {
    const k = ids.filter((id) => set.has(id)).length
    return k === 0 ? 'rien' : k === ids.length ? 'tout' : 'partiel'
  }

  const importer = async (): Promise<void> => {
    if (seance === null || occupe) return
    setOccupe(true)
    try {
      const b = await window.jdr.seance.importer(seance, { objetIds: [...objets], docIds: [...docs] })
      await Promise.all([s.refreshObjets(), s.refreshPochette()])
      s.toast(bilanImport(b))
      onClose()
    } catch (e) {
      s.toast(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : 'Import impossible', true)
      setOccupe(false)
    }
  }

  const rien = objets.size + docs.size === 0

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal import-seance" onClick={(e) => e.stopPropagation()}>
        <header>
          <h3>Importer depuis une séance</h3>
        </header>

        <div className="body">
          {autres.length === 0 ? (
            <p className="expli">Il n’y a pas d’autre séance dans cette campagne.</p>
          ) : (
            <>
              <div className="field">
                <label htmlFor="imp-seance">Depuis la séance</label>
                <select id="imp-seance" value={seance ?? ''} onChange={(e) => setSeance(Number(e.target.value))}>
                  {autres.map((x: GameSession) => (
                    <option key={x.id} value={x.id}>
                      {x.label}
                    </option>
                  ))}
                </select>
              </div>
              <p className="expli">
                Les objets et documents importés sont des copies&nbsp;: ce que tu y changeras ici ne
                touchera pas l’autre séance. Un objet arrive dans l’inventaire d’où il partait&nbsp;;
                parti d’un personnage ou d’un lieu, il arrive dans la réserve. Les documents arrivent
                en réserve, cachés.
              </p>

              <div className="seg" role="tablist">
                <button role="tab" aria-selected={onglet === 'objets'} className={onglet === 'objets' ? 'on' : ''} onClick={() => setOnglet('objets')}>
                  Objets{objets.size ? ` (${objets.size})` : ''}
                </button>
                <button role="tab" aria-selected={onglet === 'pochette'} className={onglet === 'pochette' ? 'on' : ''} onClick={() => setOnglet('pochette')}>
                  Pochette{docs.size ? ` (${docs.size})` : ''}
                </button>
              </div>

              <div className="liste-import">
                {source === null ? (
                  <p className="vide">…</p>
                ) : onglet === 'objets' ? (
                  source.familles.length === 0 ? (
                    <p className="vide">Aucun objet dans cette séance.</p>
                  ) : (
                    source.familles.map((f) => {
                      const ids = f.objets.map((o) => o.id)
                      return (
                        <div className="imp-groupe" key={f.id ?? 'sans'}>
                          <label className="imp-tete">
                            <Case
                              label={f.nom}
                              etat={etatDe(objets, ids)}
                              onChange={(c) => setObjets(basculer(objets, ids, c))}
                            />
                            <span className="lib">{f.nom}</span>
                            <span className="n num">{ids.length}</span>
                          </label>
                          {f.objets.map((o) => (
                            <label className="imp-ligne" key={o.id}>
                              <input
                                type="checkbox"
                                checked={objets.has(o.id)}
                                onChange={(e) => setObjets(basculer(objets, [o.id], e.target.checked))}
                              />
                              <span className={`pastille c-${o.teinte ?? 'neutral'}`} />
                              <span className="lib">{o.nom}</span>
                            </label>
                          ))}
                        </div>
                      )
                    })
                  )
                ) : source.onglets.length === 0 ? (
                  <p className="vide">La pochette de cette séance est vide.</p>
                ) : (
                  source.onglets.map((o) => {
                    const ids = o.docs.map((d) => d.id)
                    return (
                      <div className="imp-groupe" key={o.id ?? 'pile'}>
                        <label className="imp-tete">
                          <Case label={o.nom} etat={etatDe(docs, ids)} onChange={(c) => setDocs(basculer(docs, ids, c))} />
                          <span className="lib">{o.nom}</span>
                          <span className="n num">{ids.length}</span>
                        </label>
                        {o.docs.map((d) => (
                          <label className="imp-ligne" key={d.id}>
                            <input
                              type="checkbox"
                              checked={docs.has(d.id)}
                              onChange={(e) => setDocs(basculer(docs, [d.id], e.target.checked))}
                            />
                            <span className="lib">{d.titre}</span>
                            {d.playerId != null ? (
                              <span className="sub">
                                pour {s.players.find((p) => p.id === d.playerId)?.name ?? 'un joueur'}
                              </span>
                            ) : null}
                          </label>
                        ))}
                      </div>
                    )
                  })
                )}
              </div>
            </>
          )}
        </div>

        <footer>
          <button className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-brass" disabled={rien || occupe} onClick={() => void importer()}>
            Importer
          </button>
        </footer>
      </div>
    </div>
  )
}
