/**
 * Choisir un fichier de la campagne sans perdre de vue où il est rangé.
 *
 * On y voit l'arborescence du dossier, pas une liste à plat : un portrait se
 * trouve dans « Joueurs », une carte dans « Maps », et c'est le rangement qui
 * dit ce qu'est le fichier. Un mot dans le champ de recherche aplatit l'arbre,
 * comme en Régie.
 *
 * Les dossiers sans rien à proposer sont retirés — inutile de montrer trente
 * dossiers de bruitages quand on cherche un PDF.
 */
import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { IconChevron, IconClose, IconSearch, kindIcon } from './Icons'
import { decorDossier, folderIcon } from './FolderIcons'
import type { UiFolder, UiItem } from '../../../../preload/index'
import type { ItemKind } from '@shared/types'

type Rendu = 'vignettes' | 'lignes'

export function ChoixDansArbre({
  titre,
  icone,
  kinds,
  rendu,
  courant,
  sansLibelle,
  detacher,
  onPick,
  onClose
}: {
  titre: string
  icone: JSX.Element
  /** Natures de fichier proposées ; le reste du dossier est ignoré. */
  kinds: ItemKind[]
  rendu: Rendu
  courant: number | null
  /** Si fourni, une case de tête pour n'attacher aucun fichier. */
  sansLibelle?: string
  /** Si vrai, un bouton de détachement en pied de fenêtre. */
  detacher?: boolean
  onPick: (id: number | null) => void
  onClose: () => void
}): JSX.Element {
  const s = useStore()
  const [q, setQ] = useState('')
  /* Le dossier du fichier déjà attaché est ouvert d'emblée : on voit son choix actuel. */
  const [ouverts, setOuverts] = useState<Set<string>>(() => {
    const it = s.allItems.find((i) => i.id === courant)
    const rel = it?.relPath ?? ''
    const i = rel.lastIndexOf('/')
    const dossier = i < 0 ? '' : rel.slice(0, i)
    const chemins = new Set<string>()
    /* Ouvrir aussi tous les dossiers qui le contiennent, sinon il reste caché. */
    let bout = dossier
    while (bout) {
      chemins.add(bout)
      const j = bout.lastIndexOf('/')
      bout = j < 0 ? '' : bout.slice(0, j)
    }
    return chemins
  })

  const mot = q.trim().toLowerCase()
  const retenu = (i: UiItem): boolean =>
    kinds.includes(i.kind) &&
    (mot === '' || `${i.title} ${i.relPath ?? ''}`.toLowerCase().includes(mot))

  /** Un dossier ne se montre que s'il a quelque chose à proposer, lui ou l'un des siens. */
  const porte = (f: UiFolder): boolean =>
    f.items.some(retenu) || f.children.some(porte)

  const racine = useMemo(() => s.orphans.filter(retenu), [s.orphans, mot, kinds.join()])
  const total = useMemo(
    () => s.allItems.filter(retenu).length,
    [s.allItems, mot, kinds.join()]
  )

  const basculer = (rel: string): void =>
    setOuverts((o) => {
      const n = new Set(o)
      n.has(rel) ? n.delete(rel) : n.add(rel)
      return n
    })

  /* ---------------- les fichiers ---------------- */

  const vignette = (i: UiItem): JSX.Element => (
    <button
      key={i.id}
      className={`vign${courant === i.id ? ' on' : ''}`}
      onClick={() => onPick(i.id)}
      title={i.relPath ?? i.title}
    >
      {i.kind === 'image' && i.url ? (
        <img src={i.url} alt="" draggable={false} loading="lazy" />
      ) : (
        <span className="g">{kindIcon(i.kind, 'ico')}</span>
      )}
      <span className="nm">{i.title}</span>
    </button>
  )

  const ligne = (i: UiItem): JSX.Element => (
    <button
      key={i.id}
      className={`doc-row${courant === i.id ? ' on' : ''}`}
      onClick={() => onPick(i.id)}
      title={i.relPath ?? i.title}
    >
      {kindIcon(i.kind, 'ico')}
      <span className="t">
        <span className="ttl">{i.title}</span>
        {mot ? <span className="sub">{dossierDe(i)}</span> : null}
      </span>
    </button>
  )

  const fichiers = (liste: UiItem[]): JSX.Element =>
    rendu === 'vignettes' ? (
      <div className="galerie">{liste.map(vignette)}</div>
    ) : (
      <div className="lignes">{liste.map(ligne)}</div>
    )

  /* ---------------- les dossiers ---------------- */

  const dossier = (f: UiFolder): JSX.Element | null => {
    if (!porte(f)) return null
    const ouvert = ouverts.has(f.relPath) || mot !== ''
    const siens = f.items.filter(retenu)
    return (
      <div key={f.relPath}>
        <div
          className={`row folder${ouvert ? ' open' : ''}`}
          onClick={() => basculer(f.relPath)}
        >
          <IconChevron className="caret" />
          <span className="fico" style={decorDossier(f.icon)}>
            {folderIcon(f.icon, 'ico')}
          </span>
          <span className="name">{f.name}</span>
          <span className="num">{siens.length || ''}</span>
        </div>
        {ouvert ? (
          <div className="kids">
            {f.children.map(dossier)}
            {siens.length ? fichiers(siens) : null}
          </div>
        ) : null}
      </div>
    )
  }

  /* Un mot cherché aplatit l'arbre : on veut le fichier, pas son rangement. */
  const aplati = mot !== ''
  const trouves = aplati ? s.allItems.filter(retenu) : []

  return (
    /* `par-dessus` : ce choix s'ouvre souvent depuis une fenêtre déjà ouverte
       — la fiche qu'on modifie, par exemple. Sans ce cran de plus, il se
       rangeait derrière elle. */
    <div className="scrim par-dessus" onClick={onClose}>
      <div
        className={`modal ${rendu === 'vignettes' ? 'large' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          {icone}
          <h3>{titre}</h3>
        </header>

        <div className="body">
          <label className="cherche">
            <IconSearch />
            <input
              type="text"
              autoFocus
              value={q}
              placeholder="Chercher par son nom ou son dossier"
              onChange={(e) => setQ(e.target.value)}
            />
          </label>

          <div className="arbre">
            {sansLibelle && !aplati ? (
              <div className="galerie sans-seul">
                <button
                  className={`vign sans${courant === null ? ' on' : ''}`}
                  onClick={() => onPick(null)}
                  title={sansLibelle}
                >
                  <span className="g">
                    <IconClose />
                  </span>
                  <span className="nm">{sansLibelle}</span>
                </button>
              </div>
            ) : null}

            {aplati ? fichiers(trouves) : null}
            {!aplati ? s.tree.map(dossier) : null}
            {!aplati && racine.length ? fichiers(racine) : null}

            {(aplati ? trouves.length : total) === 0 ? (
              <p className="rien">
                {mot ? 'Rien ne correspond.' : 'Rien de ce genre dans le dossier de campagne.'}
              </p>
            ) : null}
          </div>
        </div>

        <footer>
          {detacher && courant !== null ? (
            <button className="btn btn-ghost" onClick={() => onPick(null)}>
              Détacher
            </button>
          ) : null}
          <button className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
        </footer>
      </div>
    </div>
  )
}

function dossierDe(it: UiItem): string {
  const p = it.relPath ?? ''
  const i = p.lastIndexOf('/')
  return i < 0 ? 'racine' : p.slice(0, i)
}
