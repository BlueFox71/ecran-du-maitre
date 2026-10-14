import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { Visage } from '../../shared/Visage'
import { IconTours } from './Icons'
import { totalTour } from '@shared/types'
import type { EntrantTour, Pion, ToursMj } from '@shared/types'

/**
 * Les tours : à qui de jouer, au Paravent comme à la Régie.
 *
 * Trois morceaux, partagés par les deux pages :
 * - `BoutonTours`, dans la barre, ouvre l'initiative ;
 * - `Tours`, sous la barre, montre la frise pendant le combat et le tableau
 *   d'initiative quand on le prépare ;
 * - `pionEnJeu`, pour que la scène du MJ porte le même halo que celle des
 *   joueurs.
 *
 * Tout vit dans le processus principal : chaque geste part en IPC et l'état
 * revient par `tours:state`. Le Paravent et la Régie lisent donc le même
 * combat, et l'écran comme les portables le suivent sans qu'on y pense.
 */

const api = (): typeof window.jdr.tours => window.jdr.tours

/** Le pion de celui qui joue, parmi ceux de la scène qu'on regarde. */
export function pionEnJeu(tours: ToursMj | null, pions: Pion[]): number | null {
  /* Comme chez les joueurs : le halo reste pendant qu'on revoit l'initiative. */
  if (!tours?.demarre) return null
  const e = tours.entrants[tours.actif]
  if (!e) return null
  const p =
    e.pionId != null
      ? pions.find((x) => x.id === e.pionId)
      : pions.find((x) => x.characterId != null && x.characterId === e.characterId)
  return p?.id ?? null
}

/** Le bouton de la barre : ouvrir l'initiative, la refermer, ou la revoir en plein combat. */
export function BoutonTours(): JSX.Element {
  const tours = useStore((s) => s.tours)
  const titre = !tours
    ? 'Les tours : noter l’initiative, puis savoir à qui de jouer — à l’écran et sur les portables'
    : tours.phase === 'prep'
      ? 'Refermer l’initiative sans rien changer'
      : 'Revoir l’initiative : noter un dé, ajouter quelqu’un'
  return (
    <button
      className={`btn btn-sm${tours ? ' btn-on' : ''}`}
      aria-pressed={!!tours}
      title={titre}
      onClick={() => void (tours?.phase === 'prep' ? api().annuler() : api().ouvrir())}
    >
      <IconTours />
      Tours
    </button>
  )
}

/** La frise ou l'initiative, selon où l'on en est. Rien hors combat. */
export function Tours(): JSX.Element | null {
  const tours = useStore((s) => s.tours)
  if (!tours) return null
  return (
    <div className="tr-zone">
      {tours.demarre ? <Frise tours={tours} /> : null}
      {tours.phase === 'prep' ? <Initiative tours={tours} /> : null}
    </div>
  )
}

/* ---------------- un participant en petit ---------------- */

function Rond({ e }: { e: EntrantTour }): JSX.Element {
  return (
    <span className={`tr-rond c-${e.color}`} aria-hidden="true">
      {e.url ? <Visage url={e.url} cadre={e.cadre} /> : e.initials}
    </span>
  )
}

/* ---------------- la frise ---------------- */

function Frise({ tours }: { tours: ToursMj }): JSX.Element {
  const [glisse, setGlisse] = useState<string | null>(null)

  /* N passe au suivant — hors des champs de saisie, et sans modificateur :
     Ctrl+N pourrait un jour vouloir dire autre chose. */
  const enCombat = tours.phase === 'combat'
  useEffect(() => {
    if (!enCombat) return
    const h = (ev: KeyboardEvent): void => {
      if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.key.toLowerCase() !== 'n') return
      const t = ev.target as HTMLElement | null
      if (t && (t.closest('input, textarea, select, [contenteditable="true"]') || t.isContentEditable))
        return
      ev.preventDefault()
      void api().suivant()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [enCombat])

  return (
    <div className="tr-frise">
      <div className="tr-round" title="Le round en cours">
        <span className="eyebrow">Round</span>
        <b className="num">{tours.round}</b>
      </div>
      <ol className="tr-ordre" aria-label="Ordre de jeu">
        {tours.entrants.map((e, i) => (
          <li
            key={e.cle}
            className={`tr-jeton${i === tours.actif ? ' actif' : ''}${i < tours.actif ? ' fait' : ''}${
              e.montre ? '' : ' cache'
            }${glisse === e.cle ? ' glisse' : ''}`}
            draggable
            onDragStart={(ev) => {
              ev.dataTransfer.setData('text/tour', e.cle)
              ev.dataTransfer.effectAllowed = 'move'
              setGlisse(e.cle)
            }}
            onDragEnd={() => setGlisse(null)}
            onDragOver={(ev) => {
              if (ev.dataTransfer.types.includes('text/tour')) ev.preventDefault()
            }}
            onDrop={(ev) => {
              const cle = ev.dataTransfer.getData('text/tour')
              if (!cle) return
              ev.preventDefault()
              setGlisse(null)
              void api().deplacer(cle, i)
            }}
            onClick={() => void api().main(e.cle)}
            title={`${e.nom} — initiative ${totalTour(e)}${
              e.montre ? '' : ' · caché aux joueurs'
            }\nClic : lui donner la main · glisser : changer sa place`}
          >
            <Rond e={e} />
            <span className="tr-nom">{e.nom}</span>
            <span className="tr-ini num">{totalTour(e)}</span>
            {e.montre ? null : <span className="tr-cache" aria-label="caché aux joueurs" />}
          </li>
        ))}
      </ol>
      <div className="tr-gestes">
        <button
          className="btn btn-sm"
          onClick={() => void api().precedent()}
          disabled={!enCombat}
          aria-label="Revenir au précédent"
          title="Revenir au précédent"
        >
          ◂
        </button>
        <button
          className="btn btn-sm"
          onClick={() => void api().retarder()}
          disabled={!enCombat}
          title="Il attend : il jouera juste après le suivant"
        >
          Retarder
        </button>
        <button
          className="btn btn-sm btn-brass"
          onClick={() => void api().suivant()}
          disabled={!enCombat}
          title="Au suivant — touche N"
        >
          Suivant <kbd>N</kbd>
        </button>
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => void api().fin()}
          title="Fin du combat : la frise, le halo et le bandeau s’effacent"
        >
          Fin
        </button>
      </div>
    </div>
  )
}

/* ---------------- l'initiative ---------------- */

function Initiative({ tours }: { tours: ToursMj }): JSX.Element {
  const stats = useStore((s) => s.sheet?.spec.stats ?? [])
  const [candidats, setCandidats] = useState<EntrantTour[]>([])
  const nb = tours.entrants.length
  useEffect(() => {
    void api().candidats().then(setCandidats)
  }, [nb])

  /* Échap referme sans rien trier, comme le bouton Annuler. */
  useEffect(() => {
    const h = (ev: KeyboardEvent): void => {
      if (ev.key === 'Escape') void api().annuler()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const nombre = (v: string): number | null => (v.trim() === '' ? null : Number(v))
  const caracNom = stats.find((s) => s.key === tours.caracKey)

  return (
    <div className="tr-init" role="dialog" aria-label="Initiative">
      <div className="tr-init-tete">
        <h3>Initiative</h3>
        <p>
          Note le dé lancé à la table ; la carac vient de la fiche. Le total range l’ordre, du plus
          haut au plus bas.
        </p>
        <label className="tr-carac">
          <span className="eyebrow">Carac</span>
          <select
            value={tours.caracKey ?? ''}
            onChange={(ev) => void api().carac(ev.target.value || null)}
          >
            <option value="">Aucune</option>
            {stats.map((s) => (
              <option key={s.key} value={s.key}>
                {s.code ? `${s.code} — ${s.label}` : s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="tr-init-liste">
        <table>
          <thead>
            <tr>
              <th>Qui</th>
              <th>Dé</th>
              <th>{caracNom?.code ?? caracNom?.label ?? 'Bonus'}</th>
              <th>Total</th>
              <th>Joueurs</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {tours.entrants.map((e) => (
              <tr key={e.cle}>
                <td>
                  <span className="tr-qui">
                    <Rond e={e} />
                    <span>
                      {e.nom}
                      <small>{e.kind === 'pj' ? 'joueur' : e.characterId ? 'PNJ' : 'pion'}</small>
                    </span>
                  </span>
                </td>
                <td>
                  <input
                    id={`tr-de-${e.cle}`}
                    type="number"
                    min={1}
                    max={100}
                    className="num"
                    value={e.de ?? ''}
                    placeholder="—"
                    onChange={(ev) => void api().saisir(e.cle, { de: nombre(ev.target.value) })}
                    aria-label={`Dé de ${e.nom}`}
                  />
                </td>
                <td>
                  {/* La carac d'une fiche se lit ; celle d'un pion sans fiche s'écrit. */}
                  {e.characterId != null ? (
                    <span className="num tr-bonus">
                      {e.carac >= 0 ? '+' : ''}
                      {e.carac}
                    </span>
                  ) : (
                    <input
                      id={`tr-bonus-${e.cle}`}
                      type="number"
                      className="num"
                      value={e.carac}
                      onChange={(ev) =>
                        void api().saisir(e.cle, { carac: nombre(ev.target.value) ?? 0 })
                      }
                      aria-label={`Bonus de ${e.nom}`}
                    />
                  )}
                </td>
                <td>
                  <b className={`num tr-total${e.de == null ? ' vide' : ''}`}>{totalTour(e)}</b>
                </td>
                <td>
                  {e.kind === 'pj' ? (
                    <span className="tr-toujours">toujours</span>
                  ) : (
                    <button
                      className={`btn btn-sm${e.montre ? '' : ' tr-cache-btn'}`}
                      onClick={() => void api().saisir(e.cle, { montre: !e.montre })}
                      title={
                        e.montre
                          ? 'Montré : son nom et son halo paraissent chez les joueurs'
                          : 'Caché : il joue, mais les joueurs ne voient que « quelqu’un d’autre »'
                      }
                    >
                      {e.montre ? 'montré' : 'caché'}
                    </button>
                  )}
                </td>
                <td>
                  <button
                    className="btn btn-sm btn-ghost btn-ico"
                    onClick={() => void api().retirer(e.cle)}
                    aria-label={`Retirer ${e.nom}`}
                    title="Retirer des tours"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {nb === 0 ? <p className="tr-vide">Personne dans les tours. Ajoute un participant.</p> : null}
      </div>

      <div className="tr-init-pied">
        <select
          value=""
          onChange={(ev) => ev.target.value && void api().ajouter(ev.target.value)}
          disabled={!candidats.length}
          aria-label="Ajouter un participant"
        >
          <option value="">
            {candidats.length ? 'Ajouter un participant…' : 'Tout le monde est déjà là'}
          </option>
          {candidats.map((c) => (
            <option key={c.cle} value={c.cle}>
              {c.nom}
              {c.kind === 'pj' ? ' (joueur)' : c.characterId ? '' : ' (pion)'}
            </option>
          ))}
        </select>
        <span className="spacer" />
        <button className="btn btn-sm btn-ghost" onClick={() => void api().annuler()}>
          Annuler
        </button>
        <button
          className="btn btn-sm btn-brass"
          disabled={!nb}
          onClick={() => void api().commencer()}
          title={tours.demarre ? 'Retrier ; celui qui joue garde la main' : 'Trier, puis jouer'}
        >
          {tours.demarre ? 'Trier et reprendre' : 'Trier et commencer'}
        </button>
      </div>
    </div>
  )
}
