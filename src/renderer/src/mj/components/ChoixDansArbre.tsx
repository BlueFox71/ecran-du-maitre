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
 *
 * **Plus de galerie de vignettes** (13 octobre 2026) : charger toutes les
 * images d'un dossier ouvert rendait la fenêtre lente. Les images sont des
 * lignes comme le reste ; un clic en montre une seule, à droite, avec son
 * aperçu et sa date de mise à jour, et « Choisir » la retient. Le double-clic
 * choisit tout de suite.
 */
import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { IconChevron, IconClose, IconSearch, kindIcon } from './Icons'
import { decorDossier, folderIcon } from './FolderIcons'
import type { UiFolder, UiItem } from '../../../../preload/index'
import type { ItemKind } from '@shared/types'
import { useEchap } from '../echap'

/** `vignettes` : des lignes et un volet d'aperçu à droite ; `lignes` : des lignes seules. */
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
  useEchap(onClose)
  const [q, setQ] = useState('')
  const apercu = rendu === 'vignettes'
  /** La ligne qu'on regarde dans le volet d'aperçu, pas encore choisie. */
  const [vu, setVu] = useState<number | null>(courant)
  /* Deux dossiers ouverts d'emblée : celui du fichier déjà attaché — on voit
     son choix actuel —, et celui de la séance, où l'on range ce qu'on prépare
     pour elle. */
  const [ouverts, setOuverts] = useState<Set<string>>(() => {
    const it = s.allItems.find((i) => i.id === courant)
    const rel = it?.relPath ?? ''
    const i = rel.lastIndexOf('/')
    const chemins = new Set<string>()
    /* Ouvrir aussi tous les dossiers qui les contiennent, sinon ils restent cachés. */
    for (let bout of [i < 0 ? '' : rel.slice(0, i), s.session?.folderRel ?? ''])
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
    () => s.fichiers.filter(retenu).length,
    [s.fichiers, mot, kinds.join()]
  )

  const basculer = (rel: string): void =>
    setOuverts((o) => {
      const n = new Set(o)
      n.has(rel) ? n.delete(rel) : n.add(rel)
      return n
    })

  /* ---------------- les fichiers ---------------- */

  const ligne = (i: UiItem): JSX.Element => (
    <button
      key={i.id}
      className={`doc-row${(apercu ? vu : courant) === i.id ? ' on' : ''}`}
      onClick={() => (apercu ? setVu(i.id) : onPick(i.id))}
      onDoubleClick={apercu ? () => onPick(i.id) : undefined}
      title={i.relPath ?? i.title}
    >
      {kindIcon(i.kind, 'ico')}
      <span className="t">
        <span className="ttl">{apercu ? nomDeFichier(i) : i.title}</span>
        {mot ? <span className="sub">{dossierDe(i)}</span> : null}
      </span>
      {apercu && courant === i.id ? <span className="cda-actuel">actuelle</span> : null}
    </button>
  )

  const fichiers = (liste: UiItem[]): JSX.Element => (
    <div className="lignes">{liste.map(ligne)}</div>
  )

  const regarde = apercu && vu !== null ? s.allItems.find((i) => i.id === vu) ?? null : null

  const volet = (): JSX.Element => (
    <aside className="cda-volet">
      {regarde ? (
        <>
          <div className="cda-image">
            {regarde.url || regarde.poster ? (
              <img
                key={regarde.id}
                src={(regarde.kind === 'image' ? regarde.url : regarde.poster) ?? regarde.poster ?? ''}
                alt=""
                draggable={false}
              />
            ) : (
              <span className="g">{kindIcon(regarde.kind, 'ico')}</span>
            )}
          </div>
          <div className="cda-nom" title={regarde.relPath ?? regarde.title}>
            {nomDeFichier(regarde)}
          </div>
          <dl className="cda-infos">
            <dt>Dossier</dt>
            <dd>{dossierDe(regarde)}</dd>
            {regarde.width && regarde.height ? (
              <>
                <dt>Taille</dt>
                <dd>
                  {regarde.width} × {regarde.height}
                </dd>
              </>
            ) : null}
            {regarde.bytes != null ? (
              <>
                <dt>Poids</dt>
                <dd>{poids(regarde.bytes)}</dd>
              </>
            ) : null}
            <dt>Mise à jour</dt>
            <dd>{quand(regarde.updatedAt)}</dd>
          </dl>
        </>
      ) : (
        <p className="cda-rien">Cliquer sur un fichier pour le voir ici.</p>
      )}
    </aside>
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
  const trouves = aplati ? s.fichiers.filter(retenu) : []

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

          <div className={apercu ? 'cda' : undefined}>
            <div className="arbre">
              {sansLibelle && !aplati ? (
                <div className="lignes">
                  <button
                    className={`doc-row${courant === null ? ' on' : ''}`}
                    onClick={() => onPick(null)}
                    title={sansLibelle}
                  >
                    <IconClose />
                    <span className="t">
                      <span className="ttl">{sansLibelle}</span>
                    </span>
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
            {apercu ? volet() : null}
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
          {apercu ? (
            <button
              className="btn btn-primary"
              disabled={regarde === null}
              onClick={() => regarde && onPick(regarde.id)}
            >
              Choisir
            </button>
          ) : null}
        </footer>
      </div>
    </div>
  )
}

/** Le nom du fichier sur le disque, extension comprise ; le titre à défaut. */
function nomDeFichier(it: UiItem): string {
  const rel = it.relPath ?? ''
  return rel ? rel.slice(rel.lastIndexOf('/') + 1) : it.title
}

function dossierDe(it: UiItem): string {
  const p = it.relPath ?? ''
  const i = p.lastIndexOf('/')
  return i < 0 ? 'racine' : p.slice(0, i)
}

const poids = (b: number): string => {
  if (b < 1024) return `${b} o`
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} Ko`
  return `${(b / 1024 / 1024).toFixed(1)} Mo`
}

const quand = (iso: string): string => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}
