import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { enCourt } from './Ident'
import { IconCheck } from './Icons'

/**
 * La barre de menus, en haut à gauche — là où tous les logiciels la mettent.
 *
 * Elle tient les **gestes** : ouvrir une campagne, changer de séance, tendre
 * le voile noir. Le rouage, à l'autre bout de la fenêtre, tient les
 * **réglages**. La règle vaut la peine d'être écrite : si ça se fait, c'est
 * ici ; si ça se pose une fois pour toutes, c'est là-bas.
 *
 * Elle double le menu natif d'Electron plutôt que de le remplacer. Celui-ci
 * reste, caché, parce qu'il tient les accélérateurs du clavier ; celui-là est
 * pour la souris, et il a nos couleurs — y compris en thème clair, ce que le
 * menu de Windows ne saurait pas faire.
 */
export type Rubrique = 'ecran' | 'table' | 'murs' | 'biblio' | 'portables' | 'poste' | 'touches'

export function Menubar({
  onFiche,
  onParametres
}: {
  onFiche: (q: 'campagne' | 'seance' | 'carnet' | 'fiche' | 'chapitres') => void
  onParametres: (r?: Rubrique) => void
}): JSX.Element {
  const s = useStore()
  const [ouvert, setOuvert] = useState<string | null>(null)
  const barre = useRef<HTMLDivElement>(null)

  /* Un menu se ferme quand on clique ailleurs, ou sur Échap. */
  useEffect(() => {
    if (!ouvert) return
    const dehors = (e: MouseEvent): void => {
      if (!barre.current?.contains(e.target as Node)) setOuvert(null)
    }
    const touche = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOuvert(null)
    }
    document.addEventListener('mousedown', dehors)
    document.addEventListener('keydown', touche)
    return () => {
      document.removeEventListener('mousedown', dehors)
      document.removeEventListener('keydown', touche)
    }
  }, [ouvert])

  const cmd = (nom: string) => (): void => void window.jdr.app.commande(nom)
  const seance = s.session
  const recentes = s.recents.filter((r) => r.path !== s.project?.dir).slice(0, 6)

  return (
    <div className="menubar" ref={barre} role="menubar">
      <Menu nom="Fichier" id="fichier" ouvert={ouvert} onOuvrir={setOuvert}>
        <Mi label="Nouvelle campagne…" acc="Ctrl N" on={() => void window.jdr.project.create()} />
        <Mi label="Ouvrir une campagne…" acc="Ctrl O" on={() => void window.jdr.project.open()} />
        <hr />
        <Mi label="Ouvrir le dossier de données" on={() => void window.jdr.app.openDataFolder()} />
        <hr />
        <Mi label="Quitter" acc="Alt F4" on={cmd('quitter')} />
      </Menu>

      <Menu nom="Édition" id="edition" ouvert={ouvert} onOuvrir={setOuvert}>
        <Mi label="Annuler" acc="Ctrl Z" on={cmd('annuler')} />
        <Mi label="Rétablir" acc="Ctrl Y" on={cmd('retablir')} />
        <hr />
        <Mi label="Couper" acc="Ctrl X" on={cmd('couper')} />
        <Mi label="Copier" acc="Ctrl C" on={cmd('copier')} />
        <Mi label="Coller" acc="Ctrl V" on={cmd('coller')} />
      </Menu>

      <Menu nom="Campagne" id="campagne" ouvert={ouvert} onOuvrir={setOuvert}>
        <Mi label={s.campaign?.name ?? 'Aucune campagne'} coche on={() => onFiche('campagne')} />
        {recentes.length ? (
          <>
            <span className="eyebrow">Récentes</span>
            {recentes.map((r) => (
              <Mi
                key={r.path}
                label={r.name}
                acc={r.exists ? undefined : 'introuvable'}
                pale={!r.exists}
                on={() => {
                  if (r.exists) void window.jdr.project.openPath(r.path)
                }}
              />
            ))}
          </>
        ) : null}
        <hr />
        <Mi label="Configurer la campagne…" on={() => onFiche('campagne')} />
        <Mi label="Fiche de campagne…" on={() => onFiche('fiche')} />
        <Mi label="Carnet de joueurs…" on={() => onFiche('carnet')} />
        <hr />
        <Mi label="Ouvrir le dossier sur le disque" on={() => void window.jdr.project.reveal()} />
      </Menu>

      <Menu nom="Séance" id="seance" ouvert={ouvert} onOuvrir={setOuvert}>
        {s.sessions.length === 0 ? <span className="eyebrow">Aucune séance</span> : null}
        {s.sessions.map((x) => (
          <Mi
            key={x.id}
            label={x.label}
            acc={enCourt(x.date)}
            coche={x.id === seance?.id}
            on={async () => {
              if (x.id === seance?.id) return
              await window.jdr.timeline.setActiveSession(x.id)
              await s.refreshTimeline()
              await s.refreshRolls()
            }}
          />
        ))}
        <hr />
        <Mi label="Configurer la séance…" on={() => onFiche('seance')} />
        <Mi
          label="Nouvelle séance…"
          on={async () => {
            await window.jdr.timeline.createSession('Séance ' + (s.sessions.length + 1))
            await s.refreshTimeline()
            await s.refreshRolls()
            onFiche('seance')
          }}
        />
        <hr />
        {/* Les chapitres sont l'ossature du récit, pas de la soirée — mais
            c'est en préparant une séance qu'on les écrit, et c'est là qu'on
            vient les chercher. */}
        <Mi label="Gérer les chapitres…" on={() => onFiche('chapitres')} />
      </Menu>

      <Menu nom="Écran joueurs" id="ecranj" ouvert={ouvert} onOuvrir={setOuvert}>
        <Mi
          label={s.display?.playerOpen ? 'Fermer l’écran' : 'Ouvrir l’écran'}
          acc="F5"
          on={() => void window.jdr.display.togglePlayer()}
        />
        <Mi label="Voile noir" acc="Ctrl B" on={() => void window.jdr.display.blackout()} />
        <Mi
          label={s.display?.frozen ? 'Rendre au direct' : 'Figer l’écran'}
          coche={!!s.display?.frozen}
          on={() => void window.jdr.display.freeze(!s.display?.frozen)}
        />
        <hr />
        <Mi label="Réglages de l’écran…" on={() => onParametres('ecran')} />
      </Menu>

      <Menu nom="Affichage" id="affichage" ouvert={ouvert} onOuvrir={setOuvert}>
        <Mi label="Recharger" acc="Ctrl R" on={cmd('recharger')} />
        <Mi label="Outils de développement" acc="F12" on={cmd('outils')} />
        <hr />
        <Mi label="Zoom normal" acc="Ctrl 0" on={cmd('zoomNormal')} />
        <Mi label="Agrandir" acc="Ctrl +" on={cmd('zoomPlus')} />
        <Mi label="Réduire" acc="Ctrl -" on={cmd('zoomMoins')} />
      </Menu>

      <Menu nom="Aide" id="aide" droite ouvert={ouvert} onOuvrir={setOuvert}>
        <Mi label="Raccourcis de table…" on={() => onParametres('touches')} />
        <Mi label="Paramètres…" on={() => onParametres()} />
        <hr />
        <Mi label="Écran du Maître" acc={s.version || '—'} on={() => undefined} />
      </Menu>
    </div>
  )
}

/* ---------------- un menu, et ses lignes ---------------- */

function Menu({
  nom,
  id,
  ouvert,
  droite,
  onOuvrir,
  children
}: {
  nom: string
  id: string
  ouvert: string | null
  droite?: boolean
  onOuvrir: (id: string | null) => void
  children: React.ReactNode
}): JSX.Element {
  const on = ouvert === id
  return (
    <div className="mb-menu">
      <button
        className="mb-titre"
        role="menuitem"
        aria-expanded={on}
        aria-haspopup="menu"
        onClick={() => onOuvrir(on ? null : id)}
        /* Un menu ouvert, les autres s'ouvrent au survol : c'est ce que font
           tous les logiciels, et sans cela il faut recliquer à chaque fois. */
        onMouseEnter={() => {
          if (ouvert) onOuvrir(id)
        }}
      >
        {nom}
      </button>
      {on ? (
        <div
          className={`mb-deroulant${droite ? ' droite' : ''}`}
          role="menu"
          onClick={() => onOuvrir(null)}
        >
          {children}
        </div>
      ) : null}
    </div>
  )
}

function Mi({
  label,
  acc,
  coche,
  pale,
  on
}: {
  label: string
  acc?: string
  coche?: boolean
  pale?: boolean
  on: () => void | Promise<void>
}): JSX.Element {
  return (
    <button className={`mb-mi${pale ? ' pale' : ''}`} role="menuitem" onClick={() => void on()}>
      <span className="mark">{coche ? <IconCheck /> : null}</span>
      {label}
      {acc ? <span className="acc num">{acc}</span> : null}
    </button>
  )
}
