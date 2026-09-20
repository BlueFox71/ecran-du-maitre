import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import {
  IconChevron,
  IconDoc,
  IconExpand,
  IconFolder,
  IconPlus,
  IconScreen,
  IconTrash,
  kindIcon
} from '../components/Icons'
import { FOLDER_ICON_KEYS, decorDossier, folderIcon } from '../components/FolderIcons'
import { dimensions, duree } from '../../shared/mesures'
import type { UiFolder, UiItem } from '../../../../preload/index'

/* ============================================================
   La bibliothèque est une vue sur un dossier réel.
   Créer, renommer, déplacer, supprimer : tout passe par le disque,
   et tout ce qui arrive au dossier remonte ici.
   ============================================================ */

type ViewMode = 'tree' | 'grid' | 'table'
type Sel = { kind: 'folder'; rel: string } | { kind: 'file'; id: number } | null

const KIND_LABEL: Record<string, string> = {
  doc: 'document',
  image: 'image',
  video: 'vidéo',
  audio: 'son',
  pdf: 'PDF',
  other: 'fichier'
}

const VIEWS: { id: ViewMode; label: string }[] = [
  { id: 'tree', label: 'Arborescence' },
  { id: 'grid', label: 'Grandes icônes' },
  { id: 'table', label: 'Détails' }
]

const parentOf = (rel: string): string => {
  const i = rel.lastIndexOf('/')
  return i < 0 ? '' : rel.slice(0, i)
}
const poids = (b: number | null): string => {
  if (b == null) return '—'
  if (b < 1024) return `${b} o`
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} Ko`
  return `${(b / 1024 / 1024).toFixed(1)} Mo`
}
/** Ce qu'un fichier mesure : sa durée s'il en a une, sinon ses dimensions. */
const mesure = (i: UiItem): string => duree(i.duration) ?? dimensions(i.width, i.height) ?? ''
const quand = (iso: string): string => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
    + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function Library(): JSX.Element {
  const s = useStore()
  const [view, setView] = useState<ViewMode>('grid')
  const [cwd, setCwd] = useState('')
  const [sel, setSel] = useState<Sel>(null)
  /* La taille des vignettes est un réglage du poste : elle se retenait le
     temps d'une page, et repartait à zéro dès qu'on en changeait. */
  const tile = s.poste.vignette
  const setTile = (px: number): void => void s.poserPoste('biblio.vignette', px)
  const [sort, setSort] = useState<{ col: string; asc: boolean }>({ col: 'title', asc: true })
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; rel: string } | null>(null)
  const [picker, setPicker] = useState<{ x: number; y: number; rel: string } | null>(null)
  const [doomed, setDoomed] = useState<{ x: number; y: number; rel: string; n: number } | null>(null)
  /* Ce qu'on tient pendant un glisser : un fichier, ou un dossier entier. Un
     dossier ne se déplace pas comme un fichier — il ne peut pas entrer dans
     lui-même — d'où la nature portée à côté du chemin. */
  const dragged = useRef<
    { kind: 'file'; item: UiItem } | { kind: 'folder'; rel: string; name: string } | null
  >(null)

  useEffect(() => {
    const h = (e: Event): void => setSearch((e as CustomEvent<string>).detail)
    window.addEventListener('jdr:search', h)
    return () => window.removeEventListener('jdr:search', h)
  }, [])

  useEffect(() => {
    const close = (): void => {
      setMenu(null)
      setPicker(null)
      setDoomed(null)
    }
    const key = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('click', close)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('keydown', key)
    }
  }, [])

  /* ---------------- lecture de l'arbre ---------------- */

  const folders = useMemo(() => {
    const out: UiFolder[] = []
    const walk = (ns: UiFolder[]): void => ns.forEach((n) => (out.push(n), walk(n.children)))
    walk(s.tree)
    return out
  }, [s.tree])

  const folderAt = (rel: string): UiFolder | null =>
    rel ? (folders.find((f) => f.relPath === rel) ?? null) : null

  const childFolders = (rel: string): UiFolder[] =>
    rel ? (folderAt(rel)?.children ?? []) : s.tree
  const childFiles = (rel: string): UiItem[] => (rel ? (folderAt(rel)?.items ?? []) : s.orphans)

  const selectedFolder = sel?.kind === 'folder' ? folderAt(sel.rel) : null
  const selectedFile =
    sel?.kind === 'file' ? (s.allItems.find((i) => i.id === sel.id) ?? null) : null

  const q = search.trim().toLowerCase()
  const matches = (i: UiItem): boolean => q === '' || i.title.toLowerCase().includes(q)

  /* ---------------- écritures ---------------- */

  const after = async (msg?: string): Promise<void> => {
    await s.refreshLibrary()
    if (msg) s.toast(msg)
  }
  const guard = async (fn: () => Promise<unknown>, msg: string): Promise<void> => {
    try {
      await fn()
      await after(msg)
    } catch (e) {
      s.toast(e instanceof Error ? e.message : 'Opération impossible', true)
    }
  }

  /* Le dossier de la campagne, c'est le projet lui-même : en changer, c'est
     ouvrir un autre projet — et l'interface se recharge alors d'elle-même. */
  const chooseRoot = async (): Promise<void> => {
    await window.jdr.project.open()
  }

  const newFolder = (parentRel: string): void =>
    void guard(async () => {
      const rel = await window.jdr.folders.create(parentRel, 'Nouveau dossier')
      setCwd(parentRel)
      setOpen((o) => new Set(o).add(parentRel))
      setSel({ kind: 'folder', rel })
      setRenaming(rel)
    }, 'Dossier créé sur le disque')

  const newDoc = (folderRel: string): void =>
    void guard(async () => {
      const it = await window.jdr.items.createDoc(folderRel, 'Nouveau document')
      await s.refreshLibrary()
      if (it) s.openInEditor(it.id)
    }, 'Document créé')

  const importHere = (folderRel: string): void =>
    void guard(async () => {
      const made = await window.jdr.items.importFiles(folderRel)
      await s.refreshLibrary()
      if (made.length) s.toast(`${made.length} fichier${made.length > 1 ? 's' : ''} copié${made.length > 1 ? 's' : ''}`)
    }, '')

  const commitRename = (rel: string, value: string): void => {
    setRenaming(null)
    const was = rel.split('/').pop() ?? ''
    if (!value.trim() || value === was) return
    void guard(async () => {
      const next = await window.jdr.folders.rename(rel, value)
      setSel({ kind: 'folder', rel: next })
      if (cwd === rel) setCwd(next)
    }, `Renommé sur le disque : « ${was} »`)
  }

  const trash = (rel: string): void => {
    setDoomed(null)
    void guard(async () => {
      await window.jdr.folders.trash(rel)
      if (cwd === rel || cwd.startsWith(rel + '/')) setCwd(parentOf(rel))
      setSel(null)
    }, 'Envoyé à la corbeille de Windows')
  }

  /**
   * La couleur ne se choisit plus : elle vient de l'icône (`decorDossier`).
   *
   * On la **réécrit telle quelle** plutôt que de la mettre à nul : les couleurs
   * choisies avant ce changement n'ont plus d'effet, mais les effacer serait
   * jeter le travail de quelqu'un pour rien.
   */
  const setDecor = (rel: string, icon: string | null): void =>
    void guard(() => window.jdr.folders.decor(rel, icon, folderAt(rel)?.color ?? null), '')

  /**
   * Chromium ne reconnaît une cible que si l'on annule **dès `dragenter`** —
   * sans quoi il n'envoie plus de `dragover` — et qu'on lui donne un
   * `dropEffect` ; sinon il remplace le lâcher par un `dragleave`, sans rien dire.
   */
  /**
   * Un dossier n'entre ni dans lui-même ni dans sa propre descendance, et il
   * ne bouge pas s'il est déjà là. On le dit **au survol**, pas au lâcher :
   * une cible qui s'allume puis refuse est une cible qui ment.
   */
  const accepte = (dest: string): boolean => {
    const d = dragged.current
    if (!d) return false
    const source = d.kind === 'file' ? d.item.relPath : d.rel
    if (!source) return false
    if (parentOf(source) === dest) return false
    if (d.kind === 'folder' && (dest === source || dest.startsWith(`${source}/`))) return false
    return true
  }

  const survol = (e: React.DragEvent, dest: string): void => {
    if (!dragged.current) return
    // On annule quand même : sans cela Chromium cesse d'envoyer les `dragover`
    // et la case voisine, elle, ne s'allumerait plus non plus.
    e.preventDefault()
    if (!accepte(dest)) {
      e.dataTransfer.dropEffect = 'none'
      return
    }
    e.dataTransfer.dropEffect = 'move'
    e.currentTarget.classList.add('drop')
  }

  /**
   * Le sélecteur d'icône **appartient au menu qui l'a ouvert** : les deux
   * vivent ensemble et s'en vont ensemble.
   *
   * Sans cela, ouvrir le menu d'un autre dossier laissait le sélecteur du
   * précédent posé sur l'écran — deux panneaux ouverts sur deux dossiers
   * différents, et le clic suivant allait au mauvais.
   */
  const ouvrirMenu = (e: React.MouseEvent, rel: string): void => {
    e.preventDefault()
    e.stopPropagation()
    setPicker(null)
    setMenu({ x: e.clientX, y: e.clientY, rel })
  }

  const fermerMenu = (): void => {
    setMenu(null)
    setPicker(null)
  }

  /** Les quatre gestes d'une cible de lâcher, posés d'un coup. */
  const cible = (dest: string): Record<string, unknown> => ({
    onDragEnter: (e: React.DragEvent) => survol(e, dest),
    onDragOver: (e: React.DragEvent) => survol(e, dest),
    onDragLeave: (e: React.DragEvent) => e.currentTarget.classList.remove('drop'),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      e.currentTarget.classList.remove('drop')
      dropOn(dest)
    }
  })

  const dropOn = (folderRel: string): void => {
    const d = dragged.current
    dragged.current = null
    if (!d || !accepte(folderRel)) return
    const ou = `« ${folderRel.split('/').pop() ?? 'la racine'} »`

    if (d.kind === 'file') {
      void guard(() => window.jdr.items.move(d.item.relPath!, folderRel), `Déplacé vers ${ou}`)
      return
    }

    /* Un dossier déplacé emporte son chemin, et celui de tout ce qu'il contient.
       Si l'on était dedans, on y reste — mais à sa nouvelle adresse. */
    void guard(async () => {
      const dest = await window.jdr.folders.move(d.rel, folderRel)
      setCwd((c) => (c === d.rel || c.startsWith(`${d.rel}/`) ? dest + c.slice(d.rel.length) : c))
      setOpen((o) => {
        const n = new Set<string>()
        for (const p of o) {
          n.add(p === d.rel || p.startsWith(`${d.rel}/`) ? dest + p.slice(d.rel.length) : p)
        }
        return n.add(folderRel)
      })
      setSel({ kind: 'folder', rel: dest })
    }, `« ${d.name} » déplacé vers ${ou}`)
  }

  /* ---------------- dossier non lié ---------------- */

  if (!s.root?.path) {
    return (
      <section className="view libview">
        <div className="vhead">
          <div>
            <h2>Bibliothèque</h2>
            <p>
              La bibliothèque est une vue directe sur un dossier de ton disque. Désigne-le une fois,
              et tout ce qu’il contient devient la matière de la campagne.
            </p>
          </div>
        </div>
        <div className="pane empty-root">
          <IconFolder />
          <h3 className="display">Le dossier de cette campagne est introuvable</h3>
          <p>
            Il a été déplacé, renommé, ou il vit sur un disque débranché. Remets-le à sa place,
            ou ouvre la campagne là où elle se trouve maintenant.
          </p>
          <button className="btn btn-primary" onClick={() => void chooseRoot()}>
            <IconFolder />
            Ouvrir une campagne…
          </button>
        </div>
      </section>
    )
  }

  const missing = !s.root.exists

  /* ---------------- rendus ---------------- */

  const crumbs = cwd ? cwd.split('/') : []

  const folderRow = (f: UiFolder, depth: number): JSX.Element => {
    const isOpen = open.has(f.relPath)
    const on = sel?.kind === 'folder' && sel.rel === f.relPath
    const count = f.items.length
    return (
      <div key={f.relPath}>
        <div
          className={`row folder${isOpen ? ' open' : ''}${on ? ' on' : ''}`}
          onClick={() => {
            setSel({ kind: 'folder', rel: f.relPath })
            setOpen((o) => {
              const n = new Set(o)
              n.has(f.relPath) ? n.delete(f.relPath) : n.add(f.relPath)
              return n
            })
          }}
          onContextMenu={(e) => ouvrirMenu(e, f.relPath)}
          /* Un dossier se glisse comme un fichier — sauf pendant qu'on le
             renomme, où le champ doit garder la main sur la souris. */
          draggable={renaming !== f.relPath}
          onDragStart={(e) => {
            e.stopPropagation()
            dragged.current = { kind: 'folder', rel: f.relPath, name: f.name }
          }}
          onDragEnter={(e) => void survol(e, f.relPath)}
          onDragOver={(e) => void survol(e, f.relPath)}
          onDragLeave={(e) => e.currentTarget.classList.remove('drop')}
          onDrop={(e) => {
            e.preventDefault()
            e.currentTarget.classList.remove('drop')
            dropOn(f.relPath)
          }}
        >
          <IconChevron className="caret" />
          <span className="fico" style={decorDossier(f.icon)}>
            {folderIcon(f.icon, 'ico')}
          </span>
          {renaming === f.relPath ? (
            <input
              className="rename"
              autoFocus
              defaultValue={f.name}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                if (e.key === 'Escape') setRenaming(null)
              }}
              onBlur={(e) => commitRename(f.relPath, e.target.value)}
            />
          ) : (
            <span className="name">{f.name}</span>
          )}
          <span className="meta">
            <span className="num">{count}</span>
            <button
              className="dots"
              title="Actions"
              onClick={(e) => {
                ouvrirMenu(e, f.relPath)
              }}
            >
              ⋯
            </button>
          </span>
        </div>
        {isOpen ? (
          <div className="kids">
            {f.children.map((c) => folderRow(c, depth + 1))}
            {f.items.filter(matches).map(fileRow)}
          </div>
        ) : null}
      </div>
    )
  }

  const fileRow = (i: UiItem): JSX.Element => {
    const on = sel?.kind === 'file' && sel.id === i.id
    return (
      <div
        key={i.id}
        className={`row file${on ? ' on' : ''}`}
        draggable
        onDragStart={() => (dragged.current = { kind: 'file', item: i })}
        onClick={() => setSel({ kind: 'file', id: i.id })}
        onDoubleClick={() => void window.jdr.display.showItem(i.id)}
      >
        <span className="caret" />
        <span className="fico dim">{kindIcon(i.kind, 'ico')}</span>
        <span className="name">{i.title}</span>
        <span className="meta">
          <span>{quand(i.updatedAt)}</span>
          <span className="num">{mesure(i)}</span>
          <span className="num">{poids(i.bytes)}</span>
        </span>
      </div>
    )
  }

  const shot = (i: UiItem): JSX.Element => {
    const d = duree(i.duration)
    // La vignette gravée par l'examen plutôt que le fichier entier : une carte
    // de 4000 pixels n'a pas à être décodée pour tenir dans 154.
    if (i.kind === 'image' && (i.poster || i.url)) {
      return <img src={i.poster ?? i.url!} alt="" loading="lazy" draggable={false} />
    }
    if (i.kind === 'video') {
      return (
        <>
          {i.poster ? <img src={i.poster} alt="" loading="lazy" draggable={false} /> : null}
          <span className="play" />
          {/* Le triangle dit déjà « vidéo ». Sur un carré noir il ne suffisait
              pas, d'où l'étiquette ; sur une image, elle fait la troisième
              marque de trop. */}
          {i.poster ? null : <span className="pill">vidéo</span>}
          {d ? <span className="duree">{d}</span> : null}
        </>
      )
    }
    if (i.kind === 'audio') {
      return (
        <>
          <span className="wave">
            {Array.from({ length: 13 }, (_, n) => (
              <i key={n} style={{ height: `${20 + ((i.id * 7 + n * 13) % 68)}%` }} />
            ))}
          </span>
          <span className="pill">son</span>
          {d ? <span className="duree">{d}</span> : null}
        </>
      )
    }
    return (
      <>
        <span className="lines">
          {Array.from({ length: 5 }, (_, n) => (
            <i key={n} style={{ width: `${56 + ((i.id * 5 + n * 11) % 44)}%` }} />
          ))}
        </span>
        <span className="pill">{i.kind === 'pdf' ? 'pdf' : 'texte'}</span>
      </>
    )
  }

  const folderTile = (f: UiFolder): JSX.Element => {
    const on = sel?.kind === 'folder' && sel.rel === f.relPath
    return (
      <div
        key={f.relPath}
        className={`tile folder${on ? ' on' : ''}`}
        /* La chemise entière prend la teinte de son icône : c'est ce qui fait
           qu'un dossier se voit d'un coup d'œil au milieu des fichiers. */
        style={decorDossier(f.icon)}
        onClick={() => setSel({ kind: 'folder', rel: f.relPath })}
        onDoubleClick={() => setCwd(f.relPath)}
        onContextMenu={(e) => ouvrirMenu(e, f.relPath)}
        draggable={renaming !== f.relPath}
        onDragStart={(e) => {
          e.stopPropagation()
          dragged.current = { kind: 'folder', rel: f.relPath, name: f.name }
        }}
        onDragEnter={(e) => void survol(e, f.relPath)}
        onDragOver={(e) => void survol(e, f.relPath)}
        onDragLeave={(e) => e.currentTarget.classList.remove('drop')}
        onDrop={(e) => {
          e.preventDefault()
          e.currentTarget.classList.remove('drop')
          dropOn(f.relPath)
        }}
      >
        <div className="shot">
          <svg className="fold" viewBox="0 0 100 80" preserveAspectRatio="none">
            <path d="M1.5 9a4 4 0 0 1 4-4h27l6.5 7h55.5a4 4 0 0 1 4 4v58a4 4 0 0 1-4 4h-89a4 4 0 0 1-4-4z" />
          </svg>
          <span className="fic" style={decorDossier(f.icon)}>
            {folderIcon(f.icon, '')}
          </span>
        </div>
        <div>
          {renaming === f.relPath ? (
            <input
              className="rename wide"
              autoFocus
              defaultValue={f.name}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                if (e.key === 'Escape') setRenaming(null)
              }}
              onBlur={(e) => commitRename(f.relPath, e.target.value)}
            />
          ) : (
            <div className="cap">{f.name}</div>
          )}
          <div className="sub">
            {f.items.length} fichier{f.items.length > 1 ? 's' : ''}
          </div>
        </div>
        <button
          className="dots"
          onClick={(e) => {
            ouvrirMenu(e, f.relPath)
          }}
        >
          ⋯
        </button>
      </div>
    )
  }

  const fileTile = (i: UiItem): JSX.Element => {
    const on = sel?.kind === 'file' && sel.id === i.id
    return (
      <div
        key={i.id}
        className={`tile${on ? ' on' : ''}`}
        draggable
        onDragStart={() => (dragged.current = { kind: 'file', item: i })}
        onClick={() => setSel({ kind: 'file', id: i.id })}
        onDoubleClick={() => void window.jdr.display.showItem(i.id)}
      >
        <div className="shot">{shot(i)}</div>
        <div>
          <div className="cap">{i.title}</div>
          {/* La durée est déjà sur l'image ; les dimensions, elles, n'y sont
              nulle part. */}
          <div className="sub">
            {[dimensions(i.width, i.height), poids(i.bytes), quand(i.updatedAt)]
              .filter(Boolean)
              .join(' · ')}
          </div>
        </div>
      </div>
    )
  }

  const tableRows = useMemo(() => {
    const rows = s.allItems.filter(matches).map((i) => ({
      i,
      folder: i.relPath ? (parentOf(i.relPath).split('/').pop() ?? '—') : '—'
    }))
    const dir = sort.asc ? 1 : -1
    rows.sort((a, b) => {
      if (sort.col === 'bytes') return ((a.i.bytes ?? 0) - (b.i.bytes ?? 0)) * dir
      /* Une durée et des pixels ne se comparent pas : on trie les vidéos et
         les sons entre eux par la durée, le reste par la surface. */
      if (sort.col === 'mesure') {
        const q = (x: UiItem): number => x.duration ?? (x.width ?? 0) * (x.height ?? 0)
        return (q(a.i) - q(b.i)) * dir
      }
      if (sort.col === 'updatedAt') return a.i.updatedAt.localeCompare(b.i.updatedAt) * dir
      if (sort.col === 'kind') return a.i.kind.localeCompare(b.i.kind) * dir
      if (sort.col === 'folder') return a.folder.localeCompare(b.folder, 'fr') * dir
      return a.i.title.localeCompare(b.i.title, 'fr') * dir
    })
    return rows
  }, [s.allItems, sort, q])

  const COLS: { id: string; label: string; right?: boolean }[] = [
    { id: 'title', label: 'Nom' },
    { id: 'kind', label: 'Type' },
    { id: 'folder', label: 'Dossier' },
    { id: 'updatedAt', label: 'Modifié' },
    { id: 'mesure', label: 'Mesure', right: true },
    { id: 'bytes', label: 'Poids', right: true }
  ]

  return (
    <section className="view libview">
      <div className="vhead">
        <div>
          <h2>Bibliothèque</h2>
          <p>
            Ce que tu vois ici, c’est ton dossier de campagne. L’application écrit dans
            l’explorateur, l’explorateur remonte dans l’application.
          </p>
        </div>
        <div className="spacer" />
        <button className="btn btn-ghost btn-sm" onClick={() => newFolder(cwd)}>
          <IconFolder />
          Dossier
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => newDoc(cwd)}>
          <IconDoc />
          Document
        </button>
        <button className="btn" onClick={() => importHere(cwd)}>
          <IconPlus />
          Importer des fichiers
        </button>
      </div>

      <div className={`rootbar${missing ? ' lost' : ''}`}>
        <IconFolder className="ico brass" />
        <span className="path">{s.root.path}</span>
        {missing ? (
          <span className="lost-tag">Dossier introuvable</span>
        ) : (
          <span className="live">Lié</span>
        )}
        <div className="spacer" />
        <span className="eyebrow">
          {s.root.folders} dossiers · {s.root.files} fichiers
        </span>
        <button className="btn btn-sm btn-ghost" onClick={() => void window.jdr.library.openRoot()}>
          <IconExpand />
          Ouvrir
        </button>
        <button className="btn btn-sm btn-ghost" onClick={() => void chooseRoot()}>
          Changer de campagne…
        </button>
      </div>

      <div className="lib2" style={{ ['--tile' as string]: `${tile}px` }}>
        <section className="pane">
          <div className="pane-head">
            <div className="seg">
              {VIEWS.map((v) => (
                <button
                  key={v.id}
                  className={view === v.id ? 'on' : ''}
                  onClick={() => setView(v.id)}
                >
                  {v.label}
                </button>
              ))}
            </div>

            {view === 'grid' ? (
              /* Le fil d'Ariane accepte les lâchers : c'est le seul chemin pour
                 faire **remonter** quelque chose d'un cran ou deux, puisqu'on
                 ne voit pas les dossiers parents d'ici. */
              <div className="crumbs">
                <button onClick={() => setCwd('')} {...cible('')}>
                  {s.campaign?.name ?? 'Campagne'}
                </button>
                {crumbs.map((c, n) => (
                  <span key={n}>
                    <span className="sep">›</span>
                    {n === crumbs.length - 1 ? (
                      <b>{c}</b>
                    ) : (
                      <button
                        onClick={() => setCwd(crumbs.slice(0, n + 1).join('/'))}
                        {...cible(crumbs.slice(0, n + 1).join('/'))}
                      >
                        {c}
                      </button>
                    )}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="spacer" />

            {view === 'grid' ? (
              <>
                <span className="eyebrow">Taille</span>
                <div className="sizer">
                  {[118, 154, 206].map((px, n) => (
                    <button
                      key={px}
                      className={tile === px ? 'on' : ''}
                      onClick={() => setTile(px)}
                      title={`${px} px`}
                    >
                      <i style={{ width: 9 + n * 3, height: 9 + n * 3 }} />
                    </button>
                  ))}
                </div>
              </>
            ) : null}
            <span className="eyebrow">
              {view === 'table' ? 'Clique une colonne pour trier' : 'Glisse un fichier sur un dossier'}
            </span>
          </div>

          <div className={`pane-body${view === 'table' ? ' flush' : ''}`}>
            {view === 'tree' ? (
              <>
                {s.tree.map((f) => folderRow(f, 0))}
                {s.orphans.filter(matches).map(fileRow)}
              </>
            ) : null}

            {view === 'grid'
              ? (() => {
                  const kids = childFolders(cwd)
                  const files = childFiles(cwd).filter(matches)
                  if (!kids.length && !files.length) {
                    return (
                      <div className="empty">
                        Ce dossier est vide.
                        <br />
                        Dépose des fichiers dedans, ici ou dans l’explorateur.
                      </div>
                    )
                  }
                  return (
                    <div className="grid">
                      {kids.length ? (
                        <div className="gsec">
                          <span className="eyebrow">Dossiers</span>
                          <span className="eyebrow num">{kids.length}</span>
                        </div>
                      ) : null}
                      {kids.map(folderTile)}
                      {files.length ? (
                        <div className="gsec">
                          <span className="eyebrow">Fichiers</span>
                          <span className="eyebrow num">{files.length}</span>
                        </div>
                      ) : null}
                      {files.map(fileTile)}
                    </div>
                  )
                })()
              : null}

            {view === 'table' ? (
              <table>
                <thead>
                  <tr>
                    {COLS.map((c) => (
                      <th
                        key={c.id}
                        className={c.right ? 'rt' : ''}
                        onClick={() =>
                          setSort((o) => ({ col: c.id, asc: o.col === c.id ? !o.asc : true }))
                        }
                      >
                        {c.label}
                        {sort.col === c.id ? (
                          <span className="ar"> {sort.asc ? '↑' : '↓'}</span>
                        ) : null}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map(({ i, folder }) => (
                    <tr
                      key={i.id}
                      className={sel?.kind === 'file' && sel.id === i.id ? 'on' : ''}
                      draggable
                      onDragStart={() => (dragged.current = { kind: 'file', item: i })}
                      onClick={() => setSel({ kind: 'file', id: i.id })}
                      onDoubleClick={() => void window.jdr.display.showItem(i.id)}
                    >
                      <td className="nm">
                        <span>
                          {kindIcon(i.kind, 'ico')}
                          {i.title}
                        </span>
                      </td>
                      <td>{KIND_LABEL[i.kind]}</td>
                      <td>{folder}</td>
                      <td className="num">{quand(i.updatedAt)}</td>
                      <td className="rt">{mesure(i)}</td>
                      <td className="rt">{poids(i.bytes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>
        </section>

        <aside className="pane insp">
          {selectedFolder ? (
            <FolderCard
              f={selectedFolder}
              onOpen={() => {
                setView('grid')
                setCwd(selectedFolder.relPath)
              }}
              onNewSub={() => newFolder(selectedFolder.relPath)}
              onRename={() => setRenaming(selectedFolder.relPath)}
              onDelete={(e) =>
                setDoomed({
                  x: e.clientX,
                  y: e.clientY,
                  rel: selectedFolder.relPath,
                  n: selectedFolder.items.length
                })
              }
              onDecor={(icon) => setDecor(selectedFolder.relPath, icon)}
            />
          ) : selectedFile ? (
            <FileCard item={selectedFile} />
          ) : (
            <div className="empty">
              Choisis un dossier ou un fichier.
              <br />
              Sa fiche et son chemin réel s’affichent ici.
            </div>
          )}
        </aside>
      </div>

      {menu ? (
        <Pop x={menu.x} y={menu.y} className="menu">
          <button
            onClick={() => {
              setView('grid')
              setCwd(menu.rel)
              fermerMenu()
            }}
          >
            Ouvrir
          </button>
          <button
            onClick={() => {
              newFolder(menu.rel)
              fermerMenu()
            }}
          >
            Nouveau sous-dossier
          </button>
          <button
            onClick={() => {
              setRenaming(menu.rel)
              setSel({ kind: 'folder', rel: menu.rel })
              fermerMenu()
            }}
          >
            Renommer<span className="k">F2</span>
          </button>
          <button
            /* À côté du menu, pas dessus : les deux restent ouverts, et un
               panneau qui recouvre celui qui l'a appelé ne se comprend pas.
               La position se prend sur **le menu tel qu'il est posé**, pas sur
               le clic : près d'un bord, `Pop` l'a déjà recalé, et partir du
               clic aurait mis le sélecteur par-dessus. */
            onClick={(e) => {
              const b = (e.currentTarget as HTMLElement).closest('.pop')?.getBoundingClientRect()
              const large = 330
              const x = b
                ? b.right + 12 + large < window.innerWidth
                  ? b.right + 12
                  : b.left - 12 - large
                : menu.x
              setPicker({ x, y: b?.top ?? menu.y, rel: menu.rel })
            }}
          >
            Choisir une icône…
          </button>
          <hr />
          <button
            onClick={() => {
              void window.jdr.folders.reveal(menu.rel)
              fermerMenu()
            }}
          >
            Ouvrir dans l’explorateur
          </button>
          <button
            className="danger"
            onClick={(e) =>
              setDoomed({
                x: e.clientX,
                y: e.clientY,
                rel: menu.rel,
                n: folderAt(menu.rel)?.items.length ?? 0
              })
            }
          >
            Supprimer…
          </button>
        </Pop>
      ) : null}

      {picker ? (
        <Pop x={picker.x} y={picker.y} className="picker">
          <span className="eyebrow">Icône du dossier</span>
          <div className="grid-ic">
            {FOLDER_ICON_KEYS.map((k) => (
              <button
                key={k}
                className={folderAt(picker.rel)?.icon === k ? 'ic on' : 'ic'}
                style={decorDossier(k)}
                title={k}
                onClick={() => setDecor(picker.rel, k)}
              >
                {folderIcon(k, '')}
              </button>
            ))}
          </div>
        </Pop>
      ) : null}

      {doomed ? (
        <Pop x={doomed.x} y={doomed.y} className="confirm">
          <p>
            Envoyer <b>{doomed.rel.split('/').pop()}</b> à la corbeille de Windows, avec{' '}
            <b>
              {doomed.n} fichier{doomed.n > 1 ? 's' : ''}
            </b>{' '}
            ?<br />
            Leurs rattachements de chapitre et de lieu seront perdus. Rien n’est effacé
            définitivement.
          </p>
          <div className="acts">
            <button className="btn btn-sm" onClick={() => setDoomed(null)}>
              Annuler
            </button>
            <button className="btn btn-sm btn-danger" onClick={() => trash(doomed.rel)}>
              <IconTrash />
              Envoyer à la corbeille
            </button>
          </div>
        </Pop>
      ) : null}
    </section>
  )
}

/* ============================================================
   Les panneaux surgissants
   ============================================================ */

/**
 * Un panneau posé au curseur — menu, choix d'icône, confirmation.
 *
 * Il se **recale pour tenir dans la fenêtre**. Les trois se contentaient des
 * coordonnées brutes du clic : ouvert près du bord droit ou du bas, le panneau
 * débordait et on en perdait la moitié. On ne peut pas le deviner à l'avance —
 * sa taille dépend de son contenu — alors on le mesure une fois posé, avant
 * que le navigateur ne peigne, et on le ramène dans le cadre.
 */
function Pop({
  x,
  y,
  className,
  children
}: {
  x: number
  y: number
  className: string
  children: React.ReactNode
}): JSX.Element {
  const box = useRef<HTMLDivElement>(null)
  const [pose, setPose] = useState({ left: x, top: y })

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const b = el.getBoundingClientRect()
    const marge = 10
    setPose({
      left: Math.max(marge, Math.min(x, window.innerWidth - b.width - marge)),
      top: Math.max(marge, Math.min(y, window.innerHeight - b.height - marge))
    })
  }, [x, y])

  return (
    <div
      ref={box}
      className={`pop ${className}`}
      style={pose}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  )
}

/* ============================================================
   Panneau de droite
   ============================================================ */

function FolderCard(props: {
  f: UiFolder
  onOpen: () => void
  onNewSub: () => void
  onRename: () => void
  onDelete: (e: React.MouseEvent) => void
  onDecor: (icon: string | null) => void
}): JSX.Element {
  const { f } = props
  const s = useStore()
  return (
    <>
      <div>
        <span className="eyebrow">Dossier</span>
        <div className="dt-title">
          <span className="fico" style={decorDossier(f.icon)}>{folderIcon(f.icon, 'ico')}</span>
          {f.name}
        </div>
      </div>
      <dl className="kv">
        <dt>Chemin</dt>
        <dd className="mono">
          {s.root?.path}
          {f.relPath ? `\\${f.relPath.split('/').join('\\')}` : ''}
        </dd>
        <dt>Contenu</dt>
        <dd>
          {f.items.length} fichiers · {f.children.length} sous-dossiers
        </dd>
      </dl>

      <div className="card">
        <h4>Icône</h4>
        <div className="grid-ic">
          {/* Les vingt et une, pas quatorze : le panneau tient la grille
              entière, et n'en montrer qu'une partie donnait à croire que le
              reste n'existait pas. */}
          {FOLDER_ICON_KEYS.map((k) => (
            <button
              key={k}
              className={f.icon === k ? 'ic on' : 'ic'}
              style={decorDossier(k)}
              title={k}
              onClick={() => props.onDecor(k)}
            >
              {folderIcon(k, '')}
            </button>
          ))}
        </div>
        <p className="note">
          L’icône est rangée dans la base, par chemin. <b>Rien n’est écrit dans ton dossier.</b>
        </p>
      </div>

      <div className="card">
        <h4>Agir</h4>
        <button className="btn btn-sm" onClick={props.onOpen}>
          Ouvrir en grandes icônes
        </button>
        <button className="btn btn-sm" onClick={props.onNewSub}>
          <IconPlus />
          Nouveau sous-dossier
        </button>
        <button className="btn btn-sm" onClick={props.onRename}>
          Renommer
        </button>
        <button className="btn btn-sm btn-danger" onClick={props.onDelete}>
          <IconTrash />
          Supprimer
        </button>
      </div>
    </>
  )
}

function FileCard({ item }: { item: UiItem }): JSX.Element {
  const s = useStore()
  return (
    <>
      <div className="insp-thumb">
        {item.kind === 'image' && item.url ? (
          <img src={item.url} alt="" draggable={false} />
        ) : item.poster ? (
          <img src={item.poster} alt="" draggable={false} />
        ) : (
          kindIcon(item.kind, 'big')
        )}
      </div>
      <div>
        <span className="eyebrow">{KIND_LABEL[item.kind]}</span>
        <div className="dt-title">{item.title}</div>
      </div>
      <dl className="kv">
        <dt>Chemin</dt>
        <dd className="mono">
          {s.root?.path}\{(item.relPath ?? '').split('/').join('\\')}
        </dd>
        {dimensions(item.width, item.height) ? (
          <>
            <dt>Dimensions</dt>
            <dd className="num">{dimensions(item.width, item.height)}</dd>
          </>
        ) : null}
        {duree(item.duration) ? (
          <>
            <dt>Durée</dt>
            <dd className="num">{duree(item.duration)}</dd>
          </>
        ) : null}
        <dt>Poids</dt>
        <dd className="num">{poids(item.bytes)}</dd>
        <dt>Modifié</dt>
        <dd className="num">{quand(item.updatedAt)}</dd>
      </dl>

      <div className="card">
        <h4>Rattachements</h4>
        <label className="field">
          <span>Chapitre</span>
          <select
            value={item.chapterId ?? ''}
            onChange={async (e) => {
              await window.jdr.items.update(item.id, {
                chapterId: e.target.value === '' ? null : Number(e.target.value)
              })
              await s.refreshLibrary()
            }}
          >
            <option value="">— aucun —</option>
            {s.chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Lieu</span>
          <select
            value={item.placeId ?? ''}
            onChange={async (e) => {
              await window.jdr.items.update(item.id, {
                placeId: e.target.value === '' ? null : Number(e.target.value)
              })
              await s.refreshLibrary()
            }}
          >
            <option value="">— aucun —</option>
            {s.places.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <p className="note">
          Chapitre et lieu vivent dans la base, <b>suivis par le fichier</b> : renommé ou déplacé
          dans l’explorateur, il les garde.
        </p>
      </div>

      <div className="card">
        <h4>Agir</h4>
        <button
          className="btn btn-sm btn-primary"
          onClick={() => void window.jdr.display.showItem(item.id)}
        >
          <IconScreen />
          Diffuser
        </button>
        {item.kind === 'doc' ? (
          <button className="btn btn-sm" onClick={() => s.openInEditor(item.id)}>
            <IconDoc />
            Ouvrir dans l’éditeur
          </button>
        ) : null}
        <button
          className="btn btn-sm"
          onClick={() => item.relPath && void window.jdr.items.reveal(item.relPath)}
        >
          Montrer dans l’explorateur
        </button>
        <button
          className="btn btn-sm btn-danger"
          onClick={async () => {
            if (!item.relPath) return
            await window.jdr.items.trash(item.relPath)
            await s.refreshLibrary()
            s.toast('Envoyé à la corbeille de Windows')
          }}
        >
          <IconTrash />
          Supprimer
        </button>
      </div>
    </>
  )
}
