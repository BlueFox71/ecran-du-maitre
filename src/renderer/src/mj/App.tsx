import { useEffect, useState } from 'react'
import { useStore, type ViewId } from './store'
import { useRetourMoment } from './retourMoment'
import { avancer, reculer, suivreHistorique } from './historique'
import { Ariane } from './components/Ariane'
import { Monitor } from './components/Monitor'
import { Menubar, type Rubrique } from './components/Menubar'
import { Parametres } from './components/Parametres'
import { FicheCampagne, FicheSeance, Carnet, DupliquerSeance } from './components/Fiches'
import { FicheCampagne as FicheDeCampagne } from './modules/FicheCampagne'
import { Ambience } from './components/Ambience'
import { Ident } from './components/Ident'
import { Home } from './components/Home'
import { Toasts } from './components/Toasts'
import { Annonces, EcouteDesPortables } from './components/Portables'
import { JetRapide } from './components/JetRapide'
import { Regie } from './modules/Regie'
import { Pupitre } from './modules/Pupitre'
import { Pochette } from './modules/Pochette'
import { Library } from './modules/Library'
import { Editor } from './modules/Editor'
import { Places } from './modules/Places'
import { Objets } from './modules/Objets'
import { Timeline } from './modules/Timeline'
import { Annexes } from './modules/Annexes'
import { PAGES_PREPARATION } from './components/SousMenuPreparation'
import { BlocNotes } from './modules/BlocNotes'
import { Sheets } from './modules/Sheets'
import { Dice } from './modules/Dice'
import {
  IconChevron,
  IconCoffre,
  IconDoc,
  IconDie,
  IconFolder,
  IconNotes,
  IconPeople,
  IconPen,
  IconPlace,
  IconPupitre,
  IconPochette,
  IconRouage,
  IconScreen,
  IconSearch,
  IconTimeline
} from './components/Icons'

export function App(): JSX.Element {
  const s = useStore()
  /* Le rail garde la saisie des jets sous la main : ouverte, elle reste ouverte
     d'un module à l'autre, parce qu'on note des dés pendant qu'on fait autre
     chose — c'est tout l'intérêt de ne pas changer de page. */
  const [jetOuvert, setJetOuvert] = useState(false)

  /* Les fenêtres que la barre de menus et le rouage font paraître. Elles
     vivent ici, au-dessus de tout : on les ouvre depuis le haut de l'écran,
     et elles ne doivent pas mourir quand on change de module. */
  const [fiche, setFiche] = useState<'campagne' | 'seance' | 'carnet' | 'fiche' | 'dupliquer' | null>(null)
  const [params, setParams] = useState<{ depart?: Rubrique } | null>(null)

  /* L'historique des pages : il écoute le magasin dès le départ. */
  useEffect(() => suivreHistorique(), [])

  /* Les boutons latéraux de la souris reculent et avancent, comme ailleurs. */
  useEffect(() => {
    const onSouris = (e: MouseEvent): void => {
      if (e.button === 3) {
        e.preventDefault()
        reculer()
      } else if (e.button === 4) {
        e.preventDefault()
        avancer()
      }
    }
    window.addEventListener('mouseup', onSouris)
    return () => window.removeEventListener('mouseup', onSouris)
  }, [])

  useEffect(() => {
    void s.boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Raccourcis de table : voile noir, écran joueurs, navigation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const inField =
        e.target instanceof HTMLElement &&
        (e.target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName))

      /* Ctrl+Z, Ctrl+Y (ou Ctrl+Maj+Z) : la préparation se défait et se refait.
         Dans un champ ou un texte, ils restent ceux du texte. */
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !inField) {
        const k = e.key.toLowerCase()
        if (k === 'z' && !e.shiftKey) {
          e.preventDefault()
          void useStore.getState().defaire()
          return
        }
        if (k === 'y' || (k === 'z' && e.shiftKey)) {
          e.preventDefault()
          void useStore.getState().refaire()
          return
        }
      }
      if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault()
        if (e.key === 'ArrowLeft') reculer()
        else avancer()
        return
      }
      if (e.key === 'F5') {
        e.preventDefault()
        void window.jdr.display.togglePlayer()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b' && !inField) {
        e.preventDefault()
        void window.jdr.display.blackout()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        document.querySelector<HTMLInputElement>('.topbar .search input')?.focus()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault()
        setParams({})
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const sub = subtitle(s)

  /* Aucune campagne ouverte : l'accueil prend toute la fenêtre. Le rail n'a
     rien à montrer — ni moniteur, ni modules — tant qu'il n'y a pas de base. */
  /* Les fenêtres du haut, les mêmes avec ou sans campagne ouverte. */
  const dessus = (
    <>
      {fiche === 'campagne' ? (
        <FicheCampagne onClose={() => setFiche(null)} onCarnet={() => setFiche('carnet')} />
      ) : null}
      {fiche === 'seance' ? <FicheSeance onClose={() => setFiche(null)} /> : null}
      {fiche === 'carnet' ? <Carnet onClose={() => setFiche(null)} /> : null}
      {fiche === 'dupliquer' ? <DupliquerSeance onClose={() => setFiche(null)} /> : null}
      {fiche === 'fiche' ? <FicheDeCampagne onClose={() => setFiche(null)} /> : null}
      {params ? <Parametres depart={params.depart} onClose={() => setParams(null)} /> : null}
      <Toasts />
    </>
  )

  if (s.ready && !s.project) {
    return (
      <div className="chassis">
        <Menubar onFiche={setFiche} onParametres={(depart) => setParams({ depart })} />
        <div className="app sans-projet">
          <Home />
        </div>
        {dessus}
      </div>
    )
  }

  return (
    <div className="chassis">
    <Menubar onFiche={setFiche} onParametres={(depart) => setParams({ depart })} />
    <div className="app">
      <aside className="rail">
        <Monitor />

        <nav className="nav" aria-label="Modules">
          <Group label="Diffusion">
            {/* Le Paravent (l'ancien Pupitre) : le fil de la séance et l'écran des
                joueurs sur la même page, pour jouer sans quitter le moment en cours.
                Premier du groupe : c'est là qu'on passe la soirée. */}
            <NavItem id="pupitre" label="Paravent" icon={<IconPupitre />} />
            <NavItem id="regie" label="Régie" count={diffusableCount(s)} icon={<IconScreen />} />
          </Group>
          <Group label="Matière">
            {/* La Préparation de la séance (Chronologie et annexes) ; le Paravent la joue. */}
            <Preparation />
            <NavItem id="lib" label="Bibliothèque" count={s.fichiers.length} icon={<IconFolder />} />
            {/* Ce qu'on se note en écrivant la séance — les TODO, les idées en
                vrac. Un seul pour toute la campagne. */}
            <NavItem id="notes" label="Bloc-notes" icon={<IconNotes />} />
            {/* L'Éditeur n'est plus dans le rail : on n'y va jamais pour lui-même, toujours
                pour un document précis — depuis la Bibliothèque, la Chronologie ou un moment. */}
            <NavItem id="places" label="Lieux" count={s.places.length} icon={<IconPlace />} />
            {/* La réserve : ce qui se trouve, se ramasse, se porte. Elle est
                de la matière, comme les lieux — on la prépare avant la séance,
                puis on la pose. */}
            <NavItem id="objets" label="Objets" count={s.objets.length} icon={<IconCoffre />} />
          </Group>
          <Group label="Table">
            <NavItem id="sheets" label="Fiches" count={s.characters.length} icon={<IconPeople />} />
            {/* Ce que les joueurs ont en main : la chemise de documents qu'on
                fait passer autour de la table, par le Wi-Fi de la maison. */}
            <NavItem
              id="pochette"
              label="Pochette"
              count={s.pochette.length}
              icon={<IconPochette />}
            />
            <NavItem
              id="dice"
              label="Jets de dés"
              count={s.rollStats.total}
              icon={<IconDie />}
              ouvert={jetOuvert}
              onDeplier={() => setJetOuvert((v) => !v)}
            />
            {jetOuvert ? <JetRapide /> : null}
          </Group>
        </nav>

        {/* La campagne et la séance ferment le rail, juste au-dessus du numéro
            de version : on les ouvre au début de la soirée et plus après, alors
            que les modules au-dessus servent toute la partie. */}
        <Ident />

        <div className="rail-foot">
          <div className="session-row">
            <span className="eyebrow">Version</span>
            <b>{s.version || '—'}</b>
          </div>
        </div>
      </aside>

      <EcouteDesPortables />
      <Annonces />

      <div className="stage">
        <header className="topbar">
          {/* ← → et le fil d'Ariane : sur toutes les pages, sans exception. */}
          <Ariane sousTitre={sub} />
          <label className="search">
            <IconSearch />
            <input
              type="text"
              placeholder="Chercher un document"
              aria-label="Chercher"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const q = e.currentTarget.value.trim()
                  if (q) {
                    useStore.setState({ view: 'lib' })
                    window.dispatchEvent(new CustomEvent('jdr:search', { detail: q }))
                  }
                }
              }}
            />
            <kbd>Ctrl K</kbd>
          </label>
          {/* Le rouage ferme la barre du haut, à droite de la recherche : la
              barre de menus tient les gestes, lui tient les réglages. */}
          <button
            className="rouage"
            aria-expanded={!!params}
            aria-haspopup="dialog"
            title="Paramètres — Ctrl ,"
            aria-label="Paramètres"
            onClick={() => setParams(params ? null : {})}
          >
            <IconRouage />
          </button>
        </header>

        <div className="work">
          {!s.ready ? (
            <div className="view">
              <div className="empty">Ouverture de la campagne…</div>
            </div>
          ) : (
            <>
              {s.view === 'regie' && <Regie />}
              {s.view === 'pupitre' && <Pupitre />}
              {s.view === 'lib' && <Library />}
              {s.view === 'editor' && <Editor />}
              {s.view === 'places' && <Places />}
              {s.view === 'objets' && <Objets />}
              {s.view === 'timeline' && <Timeline />}
              {s.view === 'annexes' && <Annexes />}
              {s.view === 'notes' && <BlocNotes />}
              {s.view === 'sheets' && <Sheets />}
              {s.view === 'pochette' && <Pochette />}
              {s.view === 'dice' && <Dice />}
            </>
          )}
        </div>
      </div>

      <Ambience />
    </div>
    {dessus}
    </div>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="nav-group">
      <span className="eyebrow">{label}</span>
      {children}
    </div>
  )
}

function NavItem({
  id,
  label,
  count,
  icon,
  ouvert,
  onDeplier
}: {
  id: ViewId
  label: string
  count?: number
  icon: JSX.Element
  /** Un module peut tenir un bout de lui-même sous le rail : le chevron l'ouvre. */
  ouvert?: boolean
  onDeplier?: () => void
}): JSX.Element {
  const setView = useStore((s) => s.setView)
  /* L'Éditeur ouvert sur le texte d'un moment reste un détour de la
     Chronologie : c'est elle que le rail garde allumée. */
  const view = useStore((s) => s.view)
  const editingItemId = useStore((s) => s.editingItemId)
  const docDuMoment = useRetourMoment((r) => r.docId)
  const ici = view === 'editor' && docDuMoment !== null && docDuMoment === editingItemId ? 'timeline' : view
  const entree = (
    <button className="nav-item" aria-current={ici === id} onClick={() => setView(id)}>
      {icon}
      {label}
      {count !== undefined ? <span className="count">{count}</span> : null}
    </button>
  )
  if (!onDeplier) return entree
  return (
    <div className="nav-row">
      {entree}
      <button
        className={`nav-deplier${ouvert ? ' on' : ''}`}
        aria-expanded={!!ouvert}
        aria-controls="jet-rapide"
        title={ouvert ? `Replier ${label}` : `Déplier ${label} sans quitter la page`}
        aria-label={ouvert ? `Replier ${label}` : `Déplier ${label}`}
        onClick={onDeplier}
      >
        <IconChevron />
      </button>
    </div>
  )
}

/* ---------------- préparation de la séance ---------------- */

/** Le rail se souvient seulement de l'entrée repliée : une commodité, pas un réglage. */
const CLE_PREPARATION = 'rail.preparation.ouvert'

/**
 * « Préparation de la séance » : une entrée du rail qui se déplie sur ses
 * deux pages, la Chronologie et les documents annexes. Repliée, c'est elle
 * qui s'allume quand on est sur l'une des deux.
 */
function Preparation(): JSX.Element {
  const s = useStore()
  const [ouvert, setOuvert] = useState<boolean>(() => {
    try {
      return localStorage.getItem(CLE_PREPARATION) !== 'non'
    } catch {
      return true
    }
  })
  const basculer = (): void => {
    setOuvert((v) => {
      try {
        localStorage.setItem(CLE_PREPARATION, v ? 'non' : 'oui')
      } catch {
        /* sans stockage, le rail oublie : rien de grave */
      }
      return !v
    })
  }
  /* Un texte de moment ouvert dans l'Éditeur reste un détour de la Chronologie. */
  const docDuMoment = useRetourMoment((r) => r.docId)
  const detour = s.view === 'editor' && docDuMoment !== null && docDuMoment === s.editingItemId
  const dedans = detour || PAGES_PREPARATION.some((p) => p.id === s.view)

  return (
    <>
      <div className="nav-row">
        <button
          className="nav-item"
          aria-current={dedans && !ouvert}
          onClick={() => {
            if (!dedans) s.setView('timeline')
            if (!ouvert) basculer()
          }}
        >
          <IconPen />
          Préparation de la séance
        </button>
        <button
          className={`nav-deplier${ouvert ? ' on' : ''}`}
          aria-expanded={ouvert}
          title={ouvert ? 'Replier la préparation' : 'Déplier la préparation'}
          aria-label={ouvert ? 'Replier la préparation' : 'Déplier la préparation'}
          onClick={basculer}
        >
          <IconChevron />
        </button>
      </div>
      {ouvert ? (
        <div className="nav-sous">
          <NavItem
            id="timeline"
            label="Chronologie"
            count={s.beats.length}
            icon={<IconTimeline />}
          />
          <NavItem id="annexes" label="Annexes" count={s.annexes.length} icon={<IconDoc />} />
        </div>
      ) : null}
    </>
  )
}

/* ---------------- sous-titres de la barre du haut ---------------- */

function diffusableCount(s: ReturnType<typeof useStore.getState>): number {
  return s.fichiers.filter((i) => i.kind !== 'other').length
}
function docCount(s: ReturnType<typeof useStore.getState>): number {
  return s.fichiers.filter((i) => i.kind === 'doc').length
}

function subtitle(s: ReturnType<typeof useStore.getState>): string {
  switch (s.view) {
    case 'regie': {
      const out = s.screens.find((x) => x.id === s.display?.outputDisplayId)
      const label = out ? out.label : s.screens.length > 1 ? 'écran secondaire' : 'écran principal'
      return `${label} · ${diffusableCount(s)} médias diffusables`
    }
    case 'lib':
      return s.root?.path
        ? `${s.root.folders} dossiers · ${s.root.files} fichiers`
        : 'aucun dossier de campagne'
    case 'editor':
      return `${docCount(s)} documents rédigés`
    case 'places':
      return `${s.places.length} lieux`
    case 'objets': {
      const poses = s.objets.reduce((n, o) => n + o.placements.length, 0)
      return `${s.objets.length} objets · ${s.objetFamilles.length} familles · ${poses} posés`
    }
    case 'timeline':
      return `${s.session?.label ?? ''} · ${s.beats.length} moment${s.beats.length > 1 ? 's' : ''}`
    case 'annexes':
      return `${s.session?.label ?? ''} · ${s.annexes.length} document${s.annexes.length > 1 ? 's' : ''}`
    case 'pupitre': {
      const out = s.screens.find((x) => x.id === s.display?.outputDisplayId)
      const label = out ? out.label : s.screens.length > 1 ? 'écran secondaire' : 'écran principal'
      return `${s.beats.filter((b) => b.done).length} / ${s.beats.length} joués · ${label}`
    }
    case 'sheets':
      return `${s.characters.length} personnages`
    case 'dice':
      return s.rollStats.total
        ? `${s.rollStats.total} jets · ${s.rollStats.rate} % de réussite`
        : 'aucun jet pour cette séance'
    default:
      return ''
  }
}
