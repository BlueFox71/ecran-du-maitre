import { Fragment, useEffect, useState } from 'react'
import { useStore } from '../store'
import { Valeur } from './Valeur'
import { heureLocale } from '@shared/heure'
import { modificateur, signe } from '@shared/jet'
import { abregeDe, coutDe, nomComplet, regleDe, type ReglePreparation } from '@shared/preparation'
import type { PreparationEtat } from '@shared/types'

/**
 * La préparation des personnages, côté MJ.
 *
 * À gauche, la règle : départ, points, plafond — ils vivent sur la fiche de
 * la campagne, et le barème montre ce que coûte chaque valeur. À droite,
 * l'invitation puis le suivi : chaque point posé sur un téléphone arrive ici
 * aussitôt, et peut partir sur l'écran de la table pour que les joueurs
 * s'accordent. Une fiche validée est déjà écrite — rien à accepter.
 */
export function PreparationPersos(): JSX.Element {
  const s = useStore()
  const spec = s.sheet?.spec ?? null
  const regle = spec ? regleDe(spec) : null
  const [etat, setEtat] = useState<PreparationEtat | null>(null)

  useEffect(() => {
    void window.jdr.prepa.etat().then(setEtat)
    return window.jdr.prepa.onEtat(setEtat)
  }, [])

  /* La règle s'écrit sur la fiche de la campagne : elle vaut d'une séance à l'autre. */
  const regler = async (patch: Partial<ReglePreparation>): Promise<void> => {
    if (!s.sheet || !regle) return
    const neuve = { ...regle, ...patch }
    neuve.plafond = Math.max(neuve.plafond, neuve.depart)
    await window.jdr.sheet.save({ name: s.sheet.name, spec: { ...s.sheet.spec, preparation: neuve } })
    await s.refreshCharacters()
  }

  if (!spec || !regle) return <div className="empty">La fiche de la campagne se charge…</div>
  if (spec.stats.length === 0)
    return (
      <div className="empty">
        <b>Aucune caractéristique</b>
        Ouvre «&nbsp;Configuration&nbsp;» pour choisir celles de la campagne : c’est sur elles que
        les joueurs répartiront leurs points.
      </div>
    )

  const valeurs = Array.from({ length: regle.plafond - regle.depart + 1 }, (_, i) => regle.depart + i)
  const ouverte = etat?.ouverte ?? false
  const persos = etat?.persos ?? []
  const prets = persos.filter((p) => p.valide).length

  return (
    <div className="prp">
      <section className="card prp-regle">
        <div>
          <span className="eyebrow">La règle · fiche de campagne</span>
          <h3>Achat de points</h3>
        </div>
        <div className="prp-nombres">
          <label>
            Départ
            <Valeur value={regle.depart} min={1} max={30} onChange={(v) => void regler({ depart: v })} />
          </label>
          <label>
            Points
            <Valeur value={regle.points} min={1} max={300} onChange={(v) => void regler({ points: v })} />
          </label>
          <label>
            Plafond
            <Valeur
              value={regle.plafond}
              min={regle.depart}
              max={30}
              onChange={(v) => void regler({ plafond: v })}
            />
          </label>
        </div>
        <div className="prp-bareme" style={{ '--n': valeurs.length } as React.CSSProperties}>
          <span className="t">valeur</span>
          {valeurs.map((v) => (
            <span key={v}>{v}</span>
          ))}
          <span className="t">coût</span>
          {valeurs.map((v) => (
            <span key={v} className={v >= 14 ? 'cher' : ''}>
              {coutDe(v, regle.depart)}
            </span>
          ))}
          <span className="t">modif.</span>
          {valeurs.map((v) => {
            const m = modificateur(v)
            return (
              <span key={v} className={m > 0 ? 'plus' : m < 0 ? 'moins' : ''}>
                {signe(m)}
              </span>
            )
          })}
        </div>
        {!spec.sansCompetences && (
        <label className="prp-case">
          <input
            type="checkbox"
            checked={regle.competences}
            onChange={(e) => void regler({ competences: e.target.checked })}
          />
          <span>
            Les joueurs choisissent aussi leurs compétences
            <small>
              {spec.skillLimit != null
                ? `${spec.skillLimit} au choix — la limite de la fiche de campagne`
                : 'sans limite — la fiche de campagne n’en fixe pas'}
            </small>
          </span>
        </label>
        )}
        <p className="prp-aide">
          Le joueur voit ces nombres sur son téléphone, et son modificateur bouge à chaque point
          posé. Un cran coûte 1 point, 2 à partir de 14.
        </p>
      </section>

      <section className="card prp-suivi">
        {!ouverte ? (
          <div className="prp-vide">
            <h3>Personne ne prépare encore son personnage</h3>
            <p>
              Les joueurs présents reçoivent l’invitation sur leur téléphone. Leur fiche part de{' '}
              {regle.depart} partout, et rien n’y est écrit avant qu’ils valident.
            </p>
            <button className="btn btn-brass" onClick={() => void window.jdr.prepa.ouvrir()}>
              Inviter les joueurs à préparer leur personnage
            </button>
          </div>
        ) : (
          <>
            <div className="prp-barre">
              <div>
                <span className="eyebrow">
                  En cours{etat?.depuis ? ` · ouverte à ${heureLocale(etat.depuis)}` : ''}
                </span>
                <h3>
                  {prets} joueur{prets > 1 ? 's' : ''} sur {persos.length} {prets > 1 ? 'ont' : 'a'}{' '}
                  validé
                </h3>
              </div>
              <div className="spacer" />
              <button
                className={`btn btn-sm ${etat?.ecran ? 'prp-direct' : 'btn-c'}`}
                aria-pressed={etat?.ecran ?? false}
                onClick={() => void window.jdr.prepa.montrer(!etat?.ecran)}
              >
                {etat?.ecran ? '● À l’écran — retirer' : 'Montrer à l’écran'}
              </button>
              <button className="btn btn-sm btn-c" onClick={() => void window.jdr.prepa.clore()}>
                Clore la préparation
              </button>
            </div>

            <div
              className="prp-table"
              style={{ '--n': spec.stats.length } as React.CSSProperties}
            >
              <span />
              <span />
              {spec.stats.map((st) => (
                <span key={st.key} className="prp-tete">
                  <b>{abregeDe(st)}</b>
                  {nomComplet(st) !== abregeDe(st) ? <small>{nomComplet(st)}</small> : null}
                </span>
              ))}
              {persos.map((p) => (
                <Fragment key={p.id}>
                  <span className="prp-nom">
                    <span className={`pip teinte c-${p.color ?? 'neutral'}`} />
                    {p.nom}
                  </span>
                  <span className={`prp-etat${p.valide ? ' ok' : ''}`}>
                    {p.valide
                      ? '✓ validé'
                      : p.ouvert
                        ? `${p.reste} pt${p.reste > 1 ? 's' : ''} à poser`
                        : 'pas encore commencé'}
                  </span>
                  {spec.stats.map((st) => {
                    const v = p.stats[st.key] ?? regle.depart
                    const m = modificateur(v)
                    return (
                      <span key={st.key} className="prp-val">
                        <b>{v}</b>
                        <small className={m > 0 ? 'plus' : m < 0 ? 'moins' : ''}>{signe(m)}</small>
                      </span>
                    )
                  })}
                </Fragment>
              ))}
            </div>
            {persos.length === 0 ? (
              <p className="prp-aide">Aucun joueur présent à cette séance.</p>
            ) : null}
            <p className="prp-aide">
              Chaque point posé arrive ici aussitôt. Une fiche validée est déjà écrite : rien à
              accepter. Le joueur peut la retoucher tant que la préparation est ouverte.
            </p>
          </>
        )}
      </section>
    </div>
  )
}
