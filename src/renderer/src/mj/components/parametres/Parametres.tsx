import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../../store'
import { IconClose, IconRouage } from '../Icons'
import { useEchap } from '../../echap'
import { Ligne, Onglet, Tete } from './briques'
import { REGLAGES, RUBRIQUES, cheminDe, type Reglage, type Rubrique } from './registre'
import { chercher } from './chercher'

/**
 * La fenêtre des paramètres — ce qui se pose une fois et ne se retouche pas
 * en pleine scène.
 *
 * Elle est rangée en deux groupes, et la coupure n'est pas décorative : ce qui
 * **suit la campagne** part avec son dossier quand on le copie sur une clé ;
 * ce qui **suit le poste** reste sur la machine du maître du jeu. Le bandeau
 * du haut le redit à chaque rubrique, pour qu'on n'ait jamais à le deviner.
 *
 * Ce qu'on ne trouvera pas ici, et volontairement : les noms et les PV sous
 * les pions, l'encart des joueurs, le volume de l'ambiance. On les bascule en
 * pleine scène — ils restent sous la main, en Régie et au Pupitre.
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

export function Parametres({
  depart,
  cible,
  onClose
}: {
  depart?: Rubrique
  /** L'id d'un réglage : on ouvre sa rubrique et on le montre. */
  cible?: string
  onClose: () => void
}): JSX.Element {
  const s = useStore()
  const [rub, setRub] = useState<Rubrique>(
    () => REGLAGES.find((r) => r.id === cible)?.rubrique ?? depart ?? 'ecran'
  )

  const [q, setQ] = useState('')
  const trouves = useMemo(() => chercher(CHERCHABLES, q), [q])
  const cherche = q.trim() !== ''

  useEchap(onClose)
  /* Inscrit après : au sommet de la pile, Échap vide d'abord la recherche. */
  useEchap(() => setQ(''), q !== '')

  /* Le réglage visé : on le fait venir sous les yeux, et on l'allume le temps
     qu'on le repère. */
  useEffect(() => {
    if (!cible) return
    const r = REGLAGES.find((x) => x.id === cible)
    if (!r) return
    setRub(r.rubrique)
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
  }, [cible])

  const active = RUBRIQUES.find((r) => r.id === rub)!
  const surLePoste = !!active.poste
  const lignes = REGLAGES.filter((r) => r.rubrique === rub)

  return (
    <div className="scrim plein" onMouseDown={onClose}>
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
          <button className="pm-fermer" title="Fermer — Échap" aria-label="Fermer" onClick={onClose}>
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
              {trouves.length === 0 ? (
                <p className="pm-sous">Rien pour « {q.trim()} ».</p>
              ) : (
                RUBRIQUES.map((rub) => {
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
                      {groupe.map((r) => (
                        <LigneReglage key={r.id} r={r} />
                      ))}
                    </div>
                  )
                })
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
                {lignes.map((r) => (
                  <LigneReglage key={r.id} r={r} />
                ))}
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
    </div>
  )
}
