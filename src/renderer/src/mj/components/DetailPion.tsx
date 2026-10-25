import { useStore } from '../store'
import { Visage } from '../../shared/Visage'
import { TexteCourt } from './TexteCourt'
import { modificateur, signe } from '@shared/jet'
import { PilotePion } from './PilotePion'
import { eclaire, emplacementsDe, etatDeVie, jaugesDe, nomEmplacement } from '@shared/types'
import type { ButinLigne, Character, GaugeSpec, Objet, ObjetPlacement, Pion } from '@shared/types'

/**
 * Le détail du pion choisi, sous la réserve du Paravent.
 *
 * Un clic gauche sur un pion — sur la scène ou dans la réserve — l'ouvre ; le
 * clic droit garde son menu. Un joueur montre ce qu'on regarde pendant la
 * partie : ses jauges, ses caractéristiques, ce qu'il porte. Un PNJ montre ce
 * qu'on manœuvre : comment les joueurs le voient, ses PV, sa table et son
 * butin. Les objets d'un joueur se lisent ici et s'équipent depuis sa fiche.
 *
 * `pion` peut manquer : un joueur choisi dans la réserve sans être posé sur ce
 * lieu se lit quand même — c'est sa fiche qu'on veut, pas son jeton.
 */
export function DetailPion({
  pion,
  ch,
  focusId,
  onFerme,
  onFait,
  pose
}: {
  pion: Pion | null
  ch: Character | null
  focusId: number | null
  onFerme: () => void
  /** Après un geste sur le pion : relire la scène et la présence. */
  onFait: () => Promise<void>
  /** Poser l'un de ses objets sur le plan ; absent, aucun lieu à l'écran. */
  pose?: PoseObjet
}): JSX.Element | null {
  const s = useStore()
  if (!pion && !ch) return null

  const spec = ch ? s.templates.find((t) => t.id === ch.templateId)?.spec : undefined
  const jauges = ch ? jaugesDe(spec?.gauges ?? [], ch.kind) : []
  const pv = ch && jauges[0] ? ch.data.gauges[jauges[0].key] : undefined
  const etat = pv ? (etatDeVie(pv) ?? 'ok') : null
  const nom = ch?.name ?? pion?.label ?? 'Pion'
  const portrait = ch ? s.allItems.find((i) => i.id === ch.portraitItemId) : undefined
  const url = pion?.url ?? portrait?.url ?? null
  const cadre = pion?.cadre ?? ch?.portraitCadre ?? null
  const couleur = ch?.color ?? pion?.color ?? 'neutral'
  const genre = ch?.kind === 'pj' ? 'joueur' : ch ? 'PNJ' : pion?.itemId != null ? 'objet' : 'pion sans fiche'

  const fait = async (): Promise<void> => {
    await s.refreshCharacters()
    await onFait()
  }
  const ajuster = async (g: GaugeSpec, delta: number): Promise<void> => {
    if (!ch) return
    await window.jdr.characters.adjust(ch.id, g.key, delta)
    await fait()
  }
  /* Trois façons de le montrer : toujours, au regard des joueurs (il paraît
     quand l'un d'eux le voit), ou pas du tout. Taire son nom est une case à
     part : on peut montrer un inconnu au regard. */
  const afficher = async (mode: 'montre' | 'regard' | 'cache'): Promise<void> => {
    if (!pion) return
    await window.jdr.pions.regard(pion.id, mode === 'regard')
    await window.jdr.pions.hide(pion.id, mode === 'cache')
    await fait()
  }
  const affichage = pion ? (pion.cache ? 'cache' : pion.regard ? 'regard' : 'montre') : null

  const sous = ch
    ? [ch.occupation, ch.kind === 'pj' && ch.player ? `joué par ${ch.player}` : null].filter(Boolean).join(' · ')
    : pion?.itemId != null
      ? 'Une image posée sur la carte'
      : 'Un nom posé sur la carte, sans fiche derrière'

  return (
    <div className="dp" aria-label={`Détail de ${nom}`}>
      <header className="dp-tete">
        <span className={`dp-portrait jeton c-${couleur}${url ? ' photo' : ''}`}>
          {url ? <Visage url={url} cadre={cadre} /> : (pion?.initials ?? nom.slice(0, 2).toUpperCase())}
        </span>
        <div className="dp-qui">
          <span className="eyebrow">{genre}</span>
          <h3 className="display">{nom}</h3>
          {sous ? <small>{sous}</small> : null}
        </div>
        {etat ? <span className={`dp-etat ${etat}`}>{NOM_ETAT[etat]}</span> : null}
        {pion?.cache ? <span className="dp-etat cache">Caché</span> : null}
        {pion?.regard && !pion.cache ? <span className="dp-etat cache">Au regard</span> : null}
        <div className="spacer" />
        {pion ? (
          <button
            className={`btn btn-sm${focusId === pion.id ? ' btn-on' : ''}`}
            onClick={async () => {
              await window.jdr.pions.focus(focusId === pion.id ? null : pion.id)
              await onFait()
            }}
            title="L’écran des joueurs garde ce pion au centre"
          >
            {focusId === pion.id ? 'Ne plus suivre' : 'Suivre à l’écran'}
          </button>
        ) : null}
        {ch ? (
          <button
            className="btn btn-sm"
            onClick={() => {
              s.setCurrentCharacter(ch.id)
              s.setView('sheets')
            }}
          >
            Ouvrir sa fiche ↗
          </button>
        ) : null}
        <button className="btn btn-sm btn-ico" onClick={onFerme} aria-label="Fermer le détail" title="Fermer">
          ✕
        </button>
      </header>

      {ch?.kind === 'pj' ? (
        <div className="dp-corps">
          <section>
            <span className="eyebrow">Jauges</span>
            {jauges.map((g) => (
              <GrandeJauge key={g.key} g={g} ch={ch} onAjuster={(d) => void ajuster(g, d)} />
            ))}
            {jauges.length === 0 ? <p className="dp-vide">Sa fiche n’a pas de jauge.</p> : null}
          </section>
          <section>
            <span className="eyebrow">Caractéristiques</span>
            <div className="dp-caracs">
              {(spec?.stats ?? []).map((st) => (
                <div key={st.key} className="dp-carac" title={st.label}>
                  <span>{st.code ?? st.label}</span>
                  <b className="num">
                    {ch.data.stats[st.key] ?? '—'}
                    <small>{signe(modificateur(ch.data.stats[st.key] ?? 10))}</small>
                  </b>
                </div>
              ))}
            </div>
            <Competences ch={ch} />
          </section>
          <section>
            <ObjetsPortes ch={ch} pose={pose} />
          </section>
          {pion ? (
            <section className="dp-piloter">
              <span className="eyebrow">Piloter</span>
              <PilotePion pion={pion} />
            </section>
          ) : null}
        </div>
      ) : (
        <div className="dp-corps">
          {pion ? (
            <section>
              <span className="eyebrow">À l’écran des joueurs</span>
              <div className="dp-opt">
                <span>Affichage</span>
                <div className="seg">
                  {(
                    [
                      ['montre', 'Montré', 'Les joueurs le voient, où qu’il soit'],
                      ['regard', 'Au regard', 'Il n’apparaît que lorsqu’un joueur le voit'],
                      ['cache', 'Caché', 'Pour toi seul']
                    ] as const
                  ).map(([k, l, aide]) => (
                    <button
                      key={k}
                      className={affichage === k ? 'on' : ''}
                      onClick={() => void afficher(k)}
                      title={aide}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <label className="dp-opt dp-case" title="Ils voient le jeton, pas qui c’est">
                <input
                  type="checkbox"
                  checked={pion.anonyme}
                  disabled={pion.cache}
                  onChange={async (e) => {
                    await window.jdr.pions.anonyme(pion.id, e.target.checked)
                    await fait()
                  }}
                />
                Sans nom
              </label>
              {ch ? (
                <label className="dp-opt dp-case">
                  <input
                    type="checkbox"
                    checked={ch.etatVisible}
                    onChange={async (e) => {
                      await window.jdr.characters.etatVisible(ch.id, e.target.checked)
                      await fait()
                    }}
                  />
                  Montrer « blessé » ou « à terre » sur son pion
                </label>
              ) : null}
              <div className="dp-opt">
                <span>Calque</span>
                <span className="dp-btns">
                  <button
                    className="btn btn-sm"
                    onClick={async () => {
                      await window.jdr.pions.layer(pion.id, 'devant')
                      await onFait()
                    }}
                  >
                    Devant
                  </button>
                  <button
                    className="btn btn-sm"
                    onClick={async () => {
                      await window.jdr.pions.layer(pion.id, 'derriere')
                      await onFait()
                    }}
                  >
                    Derrière
                  </button>
                  {pion.rotation ? (
                    <button
                      className="btn btn-sm"
                      onClick={async () => {
                        await window.jdr.pions.rotate(pion.id, 0)
                        await onFait()
                      }}
                    >
                      Remettre d’aplomb
                    </button>
                  ) : null}
                </span>
              </div>
            </section>
          ) : null}

          {ch ? (
            <section>
              <span className="eyebrow">Points de vie</span>
              {jauges.map((g) => (
                <GrandeJauge key={g.key} g={g} ch={ch} onAjuster={(d) => void ajuster(g, d)} />
              ))}
              {jauges.length === 0 ? <p className="dp-vide">Sa fiche n’a pas de jauge.</p> : null}
              <div className="dp-bloc dp-bloc-notes">
                <span className="eyebrow">Notes du MJ</span>
                {ch.notes ? (
                  <TexteCourt className="dp-note">{ch.notes}</TexteCourt>
                ) : (
                  <p className="dp-vide">Rien de noté sur lui.</p>
                )}
              </div>
            </section>
          ) : pion && pion.itemId == null ? (
            <section>
              <span className="eyebrow">Sans fiche</span>
              <p className="dp-vide">
                Pas de points de vie ni de butin sans fiche. Lui en faire une le range parmi les PNJ de la séance,
                avec ce même pion.
              </p>
              <button
                className="btn btn-sm btn-brass dp-gauche"
                onClick={async () => {
                  await window.jdr.pions.promote(pion.id)
                  await fait()
                }}
              >
                Lui faire une fiche
              </button>
            </section>
          ) : null}

          {ch ? (
            <section>
              <Butin ch={ch} onFait={fait} />
            </section>
          ) : null}
          {pion ? (
            <section className="dp-piloter">
              <span className="eyebrow">Piloter</span>
              <PilotePion pion={pion} />
            </section>
          ) : null}
        </div>
      )}

      {pion && ch?.kind !== 'pj' ? (
        <footer className="dp-pied">
          <button
            className="btn btn-sm dp-retirer"
            onClick={async () => {
              await window.jdr.pions.remove(pion.id)
              onFerme()
              await onFait()
            }}
          >
            Retirer ce pion
          </button>
        </footer>
      ) : null}
    </div>
  )
}

const NOM_ETAT = { ok: 'En forme', blesse: 'Blessé', ko: 'À terre' } as const

/** Une jauge en grand : sa barre, ses chiffres, et les coups qu'on lui porte. */
function GrandeJauge({
  g,
  ch,
  onAjuster
}: {
  g: GaugeSpec
  ch: Character
  onAjuster: (delta: number) => void
}): JSX.Element | null {
  const v = ch.data.gauges[g.key]
  if (!v) return null
  const part = v.max ? Math.max(0, Math.min(1, v.value / v.max)) * 100 : 0
  return (
    <div className="dp-jauge">
      <div className="dp-jauge-ligne">
        <span>{g.label}</span>
        <span className="num dp-jauge-val">
          {v.value}
          <i>/{v.max}</i>
        </span>
      </div>
      <span className={`dp-barre c-${g.color}`}>
        <i style={{ width: `${part}%` }} />
      </span>
      <div className="dp-coups">
        {[-1, 1].map((d) => (
          <button
            key={d}
            className={`num ${d < 0 ? 'moins' : 'plus'}`}
            onClick={() => onAjuster(d)}
            aria-label={`${d > 0 ? 'Ajouter' : 'Retirer'} 1 à ${g.label}`}
          >
            {d > 0 ? '+' : '−'}
          </button>
        ))}
      </div>
    </div>
  )
}

function Competences({ ch }: { ch: Character }): JSX.Element | null {
  const s = useStore()
  const spec = s.templates.find((t) => t.id === ch.templateId)?.spec
  const prises = (spec?.skills ?? []).filter((sk) => sk.key in ch.data.skills)
  if (spec?.sansCompetences) return null
  return (
    <div className="dp-bloc dp-bloc-comps">
      <span className="eyebrow">Compétences prises</span>
      {prises.length ? (
        <div className="dp-comps">
          {prises.map((sk) => (
            <span key={sk.key}>
              {sk.label}
              <b className="num">{ch.data.skills[sk.key]}</b>
            </span>
          ))}
        </div>
      ) : (
        <p className="dp-vide">Aucune compétence prise.</p>
      )}
    </div>
  )
}

/**
 * Un objet qu'il pose dans le lieu : le détecteur qu'on cale dans le couloir,
 * la balise au pied de l'arbre. Le bouton arme l'outil, un clic sur le plan
 * dit où — comme une lumière qu'on pose.
 */
export interface PoseObjet {
  /** L'exemplaire qui attend son clic ; `null`, rien d'armé. */
  arme: number | null
  armer: (placementId: number | null) => void
}

/**
 * Ce que la réserve a posé sur lui : porté, puis dans le sac. Chaque objet qui
 * se porte a son menu — le sac, ou l'un de ses endroits encore libres sur lui.
 */
function ObjetsPortes({ ch, pose }: { ch: Character; pose?: PoseObjet }): JSX.Element {
  const s = useStore()
  const surLui = s.objets.flatMap((o) => o.placements.filter((p) => p.characterId === ch.id).map((p) => ({ o, p })))
  const portes = surLui.filter((x) => x.p.emplacement)
  const sac = surLui.filter((x) => !x.p.emplacement)
  const occupes = new Set(portes.map((x) => x.p.emplacement))

  const porter = async (placementId: number, emplacement: string | null): Promise<void> => {
    await window.jdr.objets.porter(placementId, emplacement)
    await s.refreshObjets()
  }
  const allumer = async (placementId: number, allumee: boolean): Promise<void> => {
    await window.jdr.objets.allumer(placementId, allumee)
    await s.refreshObjets()
  }
  /** Le sac, sa place actuelle, et les endroits de l'objet que rien n'occupe. */
  const choix = (o: Objet, p: ObjetPlacement): JSX.Element | null => {
    const libres = emplacementsDe(o).filter((e) => e === p.emplacement || !occupes.has(e))
    if (!libres.length && !p.emplacement) return null
    return (
      <select
        className="dp-ou"
        value={p.emplacement ?? ''}
        onChange={(e) => void porter(p.id, e.target.value || null)}
        title="Où il le porte"
        aria-label={`Où ${ch.name} porte ${o.nom}`}
      >
        <option value="">Dans le sac</option>
        {libres.map((e) => (
          <option key={e} value={e}>
            {nomEmplacement(e)}
          </option>
        ))}
      </select>
    )
  }
  const poser = (o: Objet, p: ObjetPlacement): JSX.Element | null => {
    if (!pose) return null
    const arme = pose.arme === p.id
    return (
      <button
        className={`dp-poser${arme ? ' on' : ''}`}
        aria-pressed={arme}
        title={arme ? 'Clique sur le plan où le poser — Échap pour renoncer' : `${ch.name} pose ${o.nom} dans le lieu`}
        onClick={() => pose.armer(arme ? null : p.id)}
      >
        poser
      </button>
    )
  }

  return (
    <>
      <span className="eyebrow">Porté</span>
      {portes.length ? (
        <ul className="dp-objets">
          {portes.map(({ o, p }) => (
            <li key={p.id}>
              {choix(o, p)}
              {o.nom}
              {/* Une lampe en main : on l'allume ou on l'éteint sans la ranger. */}
              {eclaire(o) ? (
                <button
                  className={`dp-lampe${p.eteinte ? '' : ' on'}`}
                  aria-pressed={!p.eteinte}
                  title={p.eteinte ? 'Éteinte — clic pour l’allumer' : 'Allumée — clic pour l’éteindre'}
                  onClick={() => void allumer(p.id, p.eteinte)}
                >
                  {p.eteinte ? 'éteinte' : 'allumée'}
                </button>
              ) : null}
              {poser(o, p)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="dp-vide">Rien sur lui.</p>
      )}
      <span className="eyebrow">Dans le sac</span>
      {sac.length ? (
        <ul className="dp-objets">
          {sac.map(({ o, p }) => (
            <li key={p.id}>
              {choix(o, p)}
              {o.nom}
              <span className="q num">×{p.qte}</span>
              {poser(o, p)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="dp-vide">Sac vide.</p>
      )}
    </>
  )
}

/** La table et le butin d'un PNJ : ce qu'il a sur lui, coché quand c'est pris. */
function Butin({ ch, onFait }: { ch: Character; onFait: () => Promise<void> }): JSX.Element {
  const cocher = async (i: number, pris: boolean): Promise<void> => {
    const lignes: ButinLigne[] = ch.butin.map((l, j) => (j === i ? { ...l, pris } : l))
    await window.jdr.characters.setButin(ch.id, lignes)
    await onFait()
  }
  return (
    <>
      <span className="eyebrow">Table et butin</span>
      {ch.butin.length ? (
        <ul className="dp-butin">
          {ch.butin.map((l, i) => (
            <li key={l.id}>
              <label>
                <input type="checkbox" checked={l.pris} onChange={(e) => void cocher(i, e.target.checked)} />
                <span className={l.pris ? 'pris' : ''}>{l.texte}</span>
                <span className="q num">×{l.qte}</span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p className="dp-vide">Rien à prendre sur lui. Sa table se remplit depuis sa fiche.</p>
      )}
    </>
  )
}
