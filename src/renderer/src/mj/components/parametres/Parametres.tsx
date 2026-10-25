import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../../store'
import { IconClose, IconRouage } from '../Icons'
import { useEchap } from '../../echap'
import { Ligne, Onglet, Tete } from './briques'
import { AILLEURS, REGLAGES, RUBRIQUES, cheminDe, type Ailleurs, type Reglage, type Rubrique } from './registre'
import { chercher } from './chercher'
import { Carnet } from '../Fiches'
import { BrouillonMonnaies, OuvrirCarnet } from './contexte'
import { useBrouillonMonnaies } from './rubriques/regles'

/**
 * La fenêtre des paramètres — ce qui se pose une fois et ne se retouche pas
 * en pleine scène.
 *
 * Elle est rangée en deux groupes, et la coupure n'est pas décorative : ce qui
 * **suit la campagne** part avec son dossier quand on le copie sur une clé ;
 * ce qui **suit le poste** reste sur la machine du maître du jeu. Le bandeau
 * du haut le redit à chaque rubrique, pour qu'on n'ait jamais à le deviner.
 *
 * Les commandes « en direct » (vision, encart, noms et PV sous les pions,
 * volumes) y sont aussi, sous un sous-titre à part : elles se basculent en
 * pleine scène, et les copies de la Régie et du Paravent restent. Leur état
 * est tenu en mémoire, oublié à la fermeture de l'application.
 *
 * Les lignes elles-mêmes ne vivent pas ici : chacune est déclarée une fois
 * dans le registre (`registre.tsx`), une rubrique par fichier.
 */

/* Une rubrique sans ligne (pas encore remplie) ne paraît pas dans la navigation. */
const VISIBLES = RUBRIQUES.filter((r) => REGLAGES.some((g) => g.rubrique === r.id))

/* Le registre, avec le chemin de chaque réglage : ce que `chercher` lit. */
const CHERCHABLES = REGLAGES.map((r) => ({ ...r, chemin: cheminDe(r) }))

/** Une ligne du registre — la même dans la rubrique et dans les résultats.
 *  Sans campagne ouverte, ce qui en dépend ne se règle pas : on le dit au lieu
 *  de monter une commande qui lirait une fiche absente. */
function LigneReglage({ r }: { r: Reglage }): JSX.Element {
  const campagne = useStore((s) => s.campaign)
  const poste = RUBRIQUES.find((x) => x.id === r.rubrique)?.poste
  return (
    <Ligne id={r.id} nom={r.nom} aide={r.aide} pleine={r.pleine}>
      {campagne || poste ? <r.Cmd /> : <span className="aide">Ouvre une campagne pour régler ceci.</span>}
    </Ligne>
  )
}

/** Des lignes du registre, le sous-titre « En direct » posé avant la première
 *  qui l'est — partout où l'on en rend (la rubrique, chaque groupe de recherche). */
function Lignes({ rows }: { rows: Reglage[] }): JSX.Element {
  const premier = rows.findIndex((r) => r.direct)
  return (
    <>
      {rows.map((r, i) => (
        <Fragment key={r.id}>
          {i === premier ? (
            <p className="pm-sous pm-direct">En direct — oublié à la fermeture de l’application, comme au Paravent.</p>
          ) : null}
          <LigneReglage r={r} />
        </Fragment>
      ))}
    </>
  )
}

/** Un réglage qui vit ailleurs : où le trouver, et le bouton qui y mène — qui
 *  ferme d'abord les Paramètres. Sans campagne (ou, pour la séance, sans
 *  séance courante), il n'y a rien à ouvrir : on garde seulement le texte. */
function LigneAilleurs({ a, onClose }: { a: Ailleurs; onClose: () => boolean }): JSX.Element {
  const campagne = useStore((s) => s.campaign)
  const seance = useStore((s) => s.session)
  const aller = a.aller && campagne && (!a.id.startsWith('seance.') || seance) ? a.aller : null
  return (
    <Ligne nom={a.nom} aide={a.ou}>
      {aller ? (
        <button
          className="btn btn-ghost"
          onClick={() => {
            if (onClose()) aller.faire()
          }}
        >
          {aller.libelle}
        </button>
      ) : null}
    </Ligne>
  )
}

export function Parametres({
  depart,
  cible,
  demande,
  onClose
}: {
  depart?: Rubrique
  /** L'id d'un réglage : on ouvre sa rubrique et on le montre. */
  cible?: string
  /** Le numéro de la demande : une fenêtre déjà ouverte suit chaque nouvelle demande. */
  demande?: number
  onClose: () => void
}): JSX.Element {
  const s = useStore()
  const [rub, setRub] = useState<Rubrique>(
    () => REGLAGES.find((r) => r.id === cible)?.rubrique ?? depart ?? 'ecran'
  )

  /* Le carnet s'ouvre par-dessus : il s'inscrit à Échap après nous, donc se ferme le premier. */
  const [carnet, setCarnet] = useState(false)

  const [q, setQ] = useState('')
  const trouves = useMemo(() => chercher(CHERCHABLES, q), [q])
  const ailleurs = useMemo(() => chercher(AILLEURS, q), [q])
  const cherche = q.trim() !== ''

  /* Les monnaies attendent « Appliquer » : leur brouillon vit ici, pour
     survivre aux rubriques et à la recherche, et l'on demande avant de le
     perdre en fermant. Rend vrai si la fenêtre se ferme. */
  const brouillon = useBrouillonMonnaies()
  const fermer = (): boolean => {
    if (brouillon.sale && !confirm('Fermer sans appliquer les monnaies ? Les changements seront perdus.'))
      return false
    onClose()
    return true
  }

  useEchap(fermer)
  /* Inscrit après : au sommet de la pile, Échap vide d'abord la recherche. */
  useEchap(() => setQ(''), q !== '')

  /* Une nouvelle demande alors que la fenêtre est ouverte (« modifier mon
     profil » depuis une autre rubrique) : on va à la rubrique, recherche vidée.
     Le premier passage est l'ouverture elle-même, déjà réglée plus haut. */
  const premiere = useRef(true)
  useEffect(() => {
    if (premiere.current) {
      premiere.current = false
      return
    }
    if (depart && !cible) {
      setRub(depart)
      setQ('')
    }
  }, [demande]) // eslint-disable-line react-hooks/exhaustive-deps

  /* Le réglage visé : on le fait venir sous les yeux, et on l'allume le temps
     qu'on le repère. */
  useEffect(() => {
    if (!cible) return
    const r = REGLAGES.find((x) => x.id === cible)
    if (!r) return
    setRub(r.rubrique)
    setQ('')
    let t: ReturnType<typeof setTimeout> | undefined
    const f = requestAnimationFrame(() => {
      const el = document.querySelector(`[data-reglage="${CSS.escape(cible)}"]`)
      if (!el) return
      el.scrollIntoView({ block: 'center' })
      el.classList.add('pm-cible')
      t = setTimeout(() => el.classList.remove('pm-cible'), 1500)
    })
    return () => {
      cancelAnimationFrame(f)
      if (t) clearTimeout(t)
    }
  }, [cible, demande]) // eslint-disable-line react-hooks/exhaustive-deps

  const active = RUBRIQUES.find((r) => r.id === rub)!
  const surLePoste = !!active.poste
  const lignes = REGLAGES.filter((r) => r.rubrique === rub)

  return (
    <div className="scrim plein" onMouseDown={fermer}>
      <OuvrirCarnet.Provider value={() => setCarnet(true)}>
      <BrouillonMonnaies.Provider value={brouillon}>
      <section
        className="parametres"
        role="dialog"
        aria-modal="true"
        aria-label="Paramètres"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header>
          <IconRouage />
          <h3>Paramètres</h3>
          {cherche ? null : (
            <span className="eyebrow ou">
              {surLePoste ? 'Suit le poste' : `Suit la campagne · ${s.campaign?.name ?? '—'}`}
            </span>
          )}
          <button className="pm-fermer" title="Fermer — Échap" aria-label="Fermer" onClick={fermer}>
            <IconClose />
          </button>
        </header>

        <div className="pm-recherche">
          <input
            type="search"
            autoFocus
            value={q}
            placeholder="Chercher un réglage…"
            aria-label="Chercher un réglage"
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="pm-corps">
          {cherche ? (
            <div className="pm-panneau pm-resultats">
              {trouves.length === 0 && ailleurs.length === 0 ? (
                <p className="pm-sous">Rien pour « {q.trim()} ».</p>
              ) : (
                <>
                  {RUBRIQUES.map((rub) => {
                    const groupe = trouves.filter((r) => r.rubrique === rub.id)
                    if (groupe.length === 0) return null
                    return (
                      <div key={rub.id} className="pm-bloc">
                        <button
                          className="eyebrow pm-chemin-lien"
                          onClick={() => {
                            setQ('')
                            setRub(rub.id)
                          }}
                        >
                          {groupe[0].chemin}
                        </button>
                        <Lignes rows={groupe} />
                      </div>
                    )
                  })}
                  {ailleurs.length > 0 ? (
                    <div className="pm-bloc">
                      <span className="eyebrow">Ailleurs</span>
                      {ailleurs.map((a) => (
                        <LigneAilleurs key={a.id} a={a} onClose={fermer} />
                      ))}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : (
            <>
              <nav className="pm-rubriques" role="tablist" aria-label="Rubriques">
                <span className="eyebrow titre">La campagne</span>
                {VISIBLES.filter((r) => !r.poste).map((r) => (
                  <Onglet key={r.id} r={r} on={rub === r.id} onChoisir={() => setRub(r.id)} />
                ))}
                <span className="eyebrow titre">Le poste</span>
                {VISIBLES.filter((r) => r.poste).map((r) => (
                  <Onglet key={r.id} r={r} on={rub === r.id} onChoisir={() => setRub(r.id)} />
                ))}
              </nav>

              <div className="pm-panneau">
                <Tete titre={active.nom} quoi={active.quoi} />
                {active.Avant ? <active.Avant /> : null}
                <Lignes rows={lignes} />
                {active.apres ?? null}
              </div>
            </>
          )}
        </div>

        <footer>
          {cherche ? null : (
            <>
              <span>
                {surLePoste
                  ? 'Ces réglages restent sur ce poste, d’une campagne à l’autre.'
                  : 'Ces réglages partent avec le dossier de la campagne.'}
              </span>
              <div className="spacer" />
            </>
          )}
          <span>
            {cherche
              ? 'Tout s’enregistre en sortant du champ.'
              : 'Tout s’enregistre en sortant du champ — pas de bouton à viser.'}
          </span>
        </footer>
      </section>
      </BrouillonMonnaies.Provider>
      </OuvrirCarnet.Provider>
      {carnet ? (
        /* Un clic dans le carnet ne doit pas remonter jusqu'au fond des Paramètres, qui se fermeraient. */
        <div style={{ display: 'contents' }} onMouseDown={(e) => e.stopPropagation()}>
          <Carnet onClose={() => setCarnet(false)} />
        </div>
      ) : null}
    </div>
  )
}
