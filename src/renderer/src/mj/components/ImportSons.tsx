/**
 * Importer des fichiers son dans la sonothèque, en choisissant lesquels.
 *
 * Chaque fichier de la séance (et des dossiers communs) dit où il en est :
 *  — **nouveau** : aucun son ne l'utilise, rien ne lui ressemble — coché ;
 *  — **en double** : un autre fichier, de même poids (et même durée quand on
 *    la connaît), sert déjà à un son — décoché, on dit lequel ;
 *  — **déjà là** : ce fichier même sert déjà à un son, peut-être sous un autre
 *    nom — on ne peut pas le reprendre.
 */
import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { useEchap } from '../echap'
import { duree, emojiDe } from '../sons'
import type { UiItem } from '../../../../preload/index'
import type { Son } from '@shared/types'
import { IconAudio, IconSearch } from './Icons'

type Etat = { sorte: 'nouveau' } | { sorte: 'double'; son: Son } | { sorte: 'deja'; son: Son }

/** Le nom qu'un son tire de son fichier — le même calcul que la base. */
const nomTire = (titre: string): string =>
  titre.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_]+/g, ' ').trim() || 'Son'

export function ImportSons({
  fichiers,
  sons,
  planche,
  onImporter,
  onClose
}: {
  /** Les fichiers son visibles dans la séance. */
  fichiers: UiItem[]
  sons: Son[]
  /** La planche où ils iront ; vide, rangés nulle part. */
  planche: string
  onImporter: (ids: number[]) => Promise<void>
  onClose: () => void
}): JSX.Element {
  const s = useStore()
  useEchap(onClose)
  const [q, setQ] = useState('')
  /** N'en montrer qu'une sorte : les nouveaux, les doubles ou ceux déjà là. */
  const [sorte, setSorte] = useState<Etat['sorte'] | ''>('')
  const [enCours, setEnCours] = useState(false)

  const etats = useMemo(() => {
    const parFichier = new Map<number, Son>()
    for (const x of sons) for (const f of x.fichiers) parFichier.set(f.itemId, x)
    const item = new Map(s.allItems.map((i) => [i.id, i]))
    /* L'empreinte d'un fichier : son poids, sa durée au dixième. */
    const empreinte = (i: UiItem): string | null =>
      i.bytes ? `${i.bytes}|${i.duration != null ? Math.round(i.duration * 10) : '?'}` : null
    const parEmpreinte = new Map<string, Son>()
    for (const [id, x] of parFichier) {
      const i = item.get(id)
      const e = i ? empreinte(i) : null
      if (e) parEmpreinte.set(e, x)
    }
    const out = new Map<number, Etat>()
    for (const i of fichiers) {
      const deja = parFichier.get(i.id)
      const e = empreinte(i)
      const jumeau = e ? parEmpreinte.get(e) : undefined
      out.set(i.id, deja ? { sorte: 'deja', son: deja } : jumeau ? { sorte: 'double', son: jumeau } : { sorte: 'nouveau' })
    }
    return out
  }, [fichiers, sons, s.allItems])

  const [coches, setCoches] = useState<Set<number>>(
    () => new Set(fichiers.filter((i) => etats.get(i.id)?.sorte === 'nouveau').map((i) => i.id))
  )

  const mot = q.trim().toLowerCase()
  const tries = [...fichiers]
    .filter((i) => !mot || `${i.title} ${i.relPath ?? ''}`.toLowerCase().includes(mot))
    .filter((i) => !sorte || etats.get(i.id)?.sorte === sorte)
    .sort((a, b) => (a.relPath ?? a.title).localeCompare(b.relPath ?? b.title, 'fr'))
  const prenables = tries.filter((i) => etats.get(i.id)?.sorte !== 'deja')
  const compte = { nouveau: 0, double: 0, deja: 0 }
  for (const i of fichiers) compte[etats.get(i.id)?.sorte ?? 'nouveau']++

  const basculer = (id: number): void =>
    setCoches((c) => {
      const n = new Set(c)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal large snd-import" onClick={(e) => e.stopPropagation()}>
        <header>
          <IconAudio />
          <h3>Importer des fichiers son</h3>
        </header>
        <div className="body">
          <p className="snd-aide">
            {compte.nouveau} nouveau{compte.nouveau > 1 ? 'x' : ''} · {compte.double} en double · {compte.deja} déjà dans
            la sonothèque. Un son par fichier coché, sa nature devinée à sa durée
            {planche ? `, rangé dans la planche « ${planche} »` : ''}.
          </p>
          <div className="snd-import-outils">
            <label className="cherche">
              <IconSearch />
              <input type="text" autoFocus value={q} placeholder="Chercher un fichier ou un dossier" onChange={(e) => setQ(e.target.value)} />
            </label>
            <select
              className="snd-import-sorte"
              value={sorte}
              aria-label="N’afficher qu’une sorte de fichier"
              onChange={(e) => setSorte(e.target.value as Etat['sorte'] | '')}
            >
              <option value="">Tous ({fichiers.length})</option>
              <option value="nouveau">Nouveaux ({compte.nouveau})</option>
              <option value="double">En double ({compte.double})</option>
              <option value="deja">Déjà là ({compte.deja})</option>
            </select>
            <button className="btn btn-sm btn-ghost" onClick={() => setCoches(new Set([...coches, ...prenables.map((i) => i.id)]))}>
              Tout cocher
            </button>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => setCoches(new Set([...coches].filter((id) => !prenables.some((i) => i.id === id))))}
            >
              Rien
            </button>
          </div>
          <div className="snd-import-liste">
            {tries.map((i) => {
              const e = etats.get(i.id)!
              const rel = i.relPath ?? ''
              const k = rel.lastIndexOf('/')
              return (
                <label key={i.id} className={`snd-import-ligne ${e.sorte}`}>
                  <input
                    type="checkbox"
                    checked={e.sorte !== 'deja' && coches.has(i.id)}
                    disabled={e.sorte === 'deja'}
                    onChange={() => basculer(i.id)}
                  />
                  <span className="t">
                    <b title={rel}>{k < 0 ? i.title : rel.slice(k + 1)}</b>
                    <span>{k < 0 ? 'racine' : rel.slice(0, k)}</span>
                  </span>
                  <span className="d num">{duree(i.duration)}</span>
                  <span className={`snd-import-etat ${e.sorte}`}>
                    {e.sorte === 'nouveau' ? (
                      'Nouveau'
                    ) : (
                      <>
                        {e.sorte === 'deja' ? 'Déjà là' : 'En double'}
                        {e.sorte === 'double' || (e.son.nom || '') !== nomTire(i.title) ? (
                          <span className={`n-${e.son.nature}`}>
                            {emojiDe(e.son)} sous « {e.son.nom || 'Sans nom'} »
                          </span>
                        ) : null}
                      </>
                    )}
                  </span>
                </label>
              )
            })}
            {!tries.length ? <p className="rien">{mot || sorte ? 'Rien ne correspond.' : 'Aucun fichier son dans la séance.'}</p> : null}
          </div>
        </div>
        <footer>
          <button className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button
            className="btn btn-primary"
            disabled={!coches.size || enCours}
            onClick={async () => {
              setEnCours(true)
              await onImporter([...coches].filter((id) => etats.get(id)?.sorte !== 'deja'))
            }}
          >
            Importer {coches.size} fichier{coches.size > 1 ? 's' : ''}
          </button>
        </footer>
      </div>
    </div>
  )
}
