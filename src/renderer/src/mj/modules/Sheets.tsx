import { useEffect, useMemo, useRef, useState } from 'react'
import { currentCharacter, itemById, playerOf, templateOf, useStore } from '../store'
import {
  IconClose,
  IconExpand,
  IconImage,
  IconPdf,
  IconPen,
  IconPeople,
  IconPlus,
  IconSliders,
  IconTrash,
  kindIcon
} from '../components/Icons'
import { ChoixDansArbre } from '../components/ChoixDansArbre'
import { jaugeSanite } from '@shared/types'
import type { CharacterKind, Sexe } from '@shared/types'
import { FicheCampagne } from './FicheCampagne'
import { Equipement } from './Equipement'
import { Framed } from '../../shared/Slide'
import type { UiItem } from '../../../../preload/index'
import { PION_COULEURS } from '@shared/types'
import type {
  ButinLigne,
  Character,
  CharacterData,
  Frame,
  GaugeSpec,
  SheetTemplate
} from '@shared/types'

/** États rapides proposés par défaut. Les gabarits pourront les redéfinir plus tard. */
const STATES: { key: string; label: string; color?: 'iris' }[] = [
  { key: 'blessure', label: 'Blessure grave' },
  { key: 'folie', label: 'Folie temporaire', color: 'iris' },
  { key: 'inconscient', label: 'Inconscient' },
  { key: 'mourant', label: 'Mourant' }
]

export function Sheets(): JSX.Element {
  const s = useStore()
  const ch = currentCharacter(s)
  const tpl = templateOf(s, ch)
  const [creating, setCreating] = useState<CharacterKind | null>(null)
  const [reglage, setReglage] = useState(false)
  /* Deux rayons sur la même étagère : ceux que les joueurs mènent, et ceux que
     le MJ mène lui-même. Le rayon suit le personnage ouvert, sans quoi on
     cliquerait un PNJ et la liste sauterait sur les joueurs. */
  const [rayon, setRayon] = useState<CharacterKind>('pj')
  /* Deux faces d'une même fiche : ses chiffres, ou ce qu'il porte. La poupée
     a besoin de toute la largeur — elle prend donc la place des chiffres et de
     la feuille, et la colonne « qui il est » reste, parce qu'on équipe
     quelqu'un, pas un numéro. */
  const [onglet, setOnglet] = useState<'fiche' | 'equipement'>('fiche')
  const joueurs = s.characters.filter((c) => c.kind !== 'pnj')
  const pnjs = s.characters.filter((c) => c.kind === 'pnj')
  const rayonne = rayon === 'pnj' ? pnjs : joueurs

  /**
   * Le rayon suit le personnage qu'on **ouvre** — et rien d'autre.
   *
   * Écrit d'abord en écoutant aussi `rayon` et `characters`, il se retournait
   * contre la main : cliquer « PNJ » pendant qu'un joueur était ouvert
   * rebasculait aussitôt sur « Joueurs », et le clic semblait sans effet. Un
   * effet qui corrige l'état dont il dépend se bat contre celui qui le change.
   */
  useEffect(() => {
    const ouvert = s.characters.find((c) => c.id === s.currentCharacterId)
    if (ouvert) setRayon(ouvert.kind)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.currentCharacterId])

  if (s.characters.length === 0) {
    return (
      <section className="view">
        <div className="vhead">
          <div>
            <h2>Fiches</h2>
            <p>
              Tous les personnages suivent la fiche de la campagne. Chaque modification de jauge est
              horodatée dans le journal du personnage.
            </p>
          </div>
          <div className="spacer" />
          <button className="btn btn-c" onClick={() => setReglage(true)}>
            <IconSliders />
            Configuration
          </button>
          <button className="btn btn-brass" onClick={() => setCreating('pj')}>
            <IconPlus />
            Nouveau personnage
          </button>
        </div>
        <div className="empty">
          <b>Aucun personnage</b>
          Ouvre «&nbsp;Configuration&nbsp;» pour régler la fiche de la campagne — ses
          caractéristiques et ses compétences —, puis crée une fiche par joueur.
        </div>
        {creating && <FormFiche kind={creating} onClose={() => setCreating(null)} />}
        {reglage && <FicheCampagne onClose={() => setReglage(false)} />}
      </section>
    )
  }

  return (
    <section className="view">
      <div className="vhead">
        <div>
          <h2>Fiches</h2>
          <p>
            Les personnages de la campagne : ceux que tes joueurs mènent, et ceux que tu mènes toi.
            Les +/− sur les jauges sont journalisés à l’heure exacte.
          </p>
        </div>
        <div className="spacer" />
        <div className="seg-fiche" role="group" aria-label="Sa fiche ou son équipement">
          <button className={onglet === 'fiche' ? 'on' : ''} onClick={() => setOnglet('fiche')}>
            Sa fiche
          </button>
          <button
            className={onglet === 'equipement' ? 'on' : ''}
            onClick={() => setOnglet('equipement')}
          >
            Son équipement
          </button>
        </div>
        {/* La fiche est celle de la campagne : elle ne se choisit pas
            personnage par personnage, elle se règle une fois pour toutes. */}
        <button
          className="btn btn-c btn-sm"
          onClick={() => setReglage(true)}
          title={`Configurer la fiche de la campagne — ${tpl?.name ?? ''}`}
        >
          <IconSliders />
          Configuration
        </button>
      </div>

      <div className="sheet-shell">
        <div className="card pc-list">
          <div className="pc-rayons" role="group" aria-label="Joueurs ou PNJ">
            <button
              className={`pc-rayon${rayon === 'pj' ? ' on' : ''}`}
              onClick={() => setRayon('pj')}
            >
              Joueurs<span className="n">{joueurs.length}</span>
            </button>
            <button
              className={`pc-rayon${rayon === 'pnj' ? ' on' : ''}`}
              onClick={() => setRayon('pnj')}
              title="Les personnages que tu mènes toi — ils n’entrent jamais dans l’encart des joueurs"
            >
              PNJ<span className="n">{pnjs.length}</span>
            </button>
          </div>
          <div className="pc-scroll">
            {rayonne.length === 0 ? (
              <p className="pc-vide">
                {rayon === 'pnj'
                  ? 'Aucun PNJ. Crée-le ici, ou fais une fiche à un pion déjà posé — clic droit dessus, en Régie.'
                  : 'Aucun personnage joueur.'}
              </p>
            ) : null}
            {rayonne.map((c) => (
              <button
                key={c.id}
                className="pc-btn"
                aria-current={c.id === s.currentCharacterId}
                onClick={() => s.setCurrentCharacter(c.id)}
              >
                {/* La couleur, pas les initiales : autour de la table on se
                    reconnaît à elle, et c'est elle qui cercle le pion. */}
                <span
                  className={`pip teinte c-${c.color ?? 'neutral'}`}
                  title={couleurDite(c.color)}
                />
                <span style={{ minWidth: 0 }}>
                  <span className="n">{c.name}</span>
                  {/* Sous le nom, ce qui identifie : la personne qui le mène
                      pour un joueur, son rôle pour un PNJ — qui n'est mené par
                      personne, et pour qui un tiret ne dit rien. */}
                  <span className="p">
                    {c.kind === 'pnj' ? (c.occupation ?? 'sans rôle noté') : (c.player ?? '—')}
                  </span>
                </span>
              </button>
            ))}
          </div>
          {/* Créer un personnage se fait au bas de la liste, là où le regard
              arrive quand il a fini de la lire — pas dans l'en-tête, où le
              geste n'avait rien à voir avec ses voisins. */}
          <button className="pc-neuf" onClick={() => setCreating(rayon)}>
            <IconPlus />
            {rayon === 'pnj' ? 'PNJ' : 'Personnage'}
          </button>
        </div>

        {ch && tpl ? (
          <SheetBody ch={ch} tpl={tpl} onglet={onglet} />
        ) : (
          <div className="empty">Sélectionne un personnage.</div>
        )}
      </div>

      {creating && <FormFiche kind={creating} onClose={() => setCreating(null)} />}
      {reglage && <FicheCampagne onClose={() => setReglage(false)} />}
    </section>
  )
}

function SheetBody({
  ch,
  tpl,
  onglet
}: {
  ch: Character
  tpl: SheetTemplate
  /** Ses chiffres, ou ce qu'il porte — le sélecteur est dans l'en-tête de vue. */
  onglet: 'fiche' | 'equipement'
}): JSX.Element {
  const s = useStore()
  const portrait = itemById(s.allItems, ch.portraitItemId)
  const fiche = itemById(s.allItems, ch.sheetItemId)
  /** Ce qui est ouvert par-dessus la fiche : le choix d'une image, d'un PDF, ou sa lecture. */
  const [fenetre, setFenetre] = useState<'portrait' | 'fiche' | 'lecture' | 'identite' | null>(
    null
  )

  const rattacher = async (patch: {
    portraitItemId?: number | null
    sheetItemId?: number | null
    sheetFrame?: Frame | null
  }) => {
    await window.jdr.characters.upsert({
      id: ch.id,
      templateId: ch.templateId,
      name: ch.name,
      ...patch
    })
    await s.refreshCharacters()
  }

  /**
   * Les compétences de ce personnage : celles qu'il a prises, dans l'ordre de
   * la fiche de campagne. Une compétence est « prise » quand sa clé est dans
   * ses données — une clé absente et un zéro écrit ne veulent pas dire la
   * même chose.
   */
  const prises = useMemo(
    () => tpl.spec.skills.filter((sk) => sk.key in ch.data.skills),
    [tpl, ch.data.skills]
  )
  const restantes = useMemo(
    () => tpl.spec.skills.filter((sk) => !(sk.key in ch.data.skills)),
    [tpl, ch.data.skills]
  )
  const plafond = tpl.spec.skillLimit && tpl.spec.skillLimit > 0 ? tpl.spec.skillLimit : null
  const complet = plafond !== null && prises.length >= plafond

  const adjust = async (g: GaugeSpec, delta: number, maxDelta = 0): Promise<void> => {
    await window.jdr.characters.adjust(ch.id, g.key, delta, null, maxDelta)
    await s.refreshCharacters()
    /* L'avertissement suit la jauge que la fiche de campagne désigne, et non
       plus la clé « san » en dur : une campagne qui appelle la sienne
       « lucidité » y a droit aussi. */
    if (delta < 0 && g.key === jaugeSanite(tpl.spec, tpl.spec.gauges)?.key) {
      s.toast('Santé mentale en baisse — jet de folie temporaire si la perte atteint 5 d’un coup')
    }
  }

  const roll = async (label: string, target: number): Promise<void> => {
    const r = await window.jdr.rolls.roll({
      characterId: ch.id,
      label,
      system: tpl.spec.rollSystem,
      target
    })
    await s.refreshRolls()
    s.toast(`${ch.name} · ${label} (${target}) → ${r.result} · ${levelWord(r.level)}`)
  }

  return (
    <div className="card sheet">
      {fenetre === 'identite' && <FormFiche ch={ch} onClose={() => setFenetre(null)} />}

      {fenetre === 'portrait' && (
        <ChoixDansArbre
          titre={`Photo de profil — ${ch.name}`}
          icone={<IconImage />}
          kinds={['image']}
          rendu="vignettes"
          courant={ch.portraitItemId}
          sansLibelle="Sans photo"
          onPick={async (id) => {
            setFenetre(null)
            await rattacher({ portraitItemId: id })
          }}
          onClose={() => setFenetre(null)}
        />
      )}

      {fenetre === 'fiche' && (
        <ChoixDansArbre
          titre={`Fiche de compétences — ${ch.name}`}
          icone={<IconPdf />}
          /* Une fiche remplie est souvent un scan ou une photo, pas seulement un PDF. */
          kinds={['pdf', 'image']}
          rendu="vignettes"
          courant={ch.sheetItemId}
          detacher
          onPick={async (id) => {
            setFenetre(id ? 'lecture' : null)
            /* Nouvelle feuille, nouveau cadrage : celui d'avant ne veut plus rien dire. */
            await rattacher({ sheetItemId: id, sheetFrame: null })
          }}
          onClose={() => setFenetre(null)}
        />
      )}

      {fenetre === 'lecture' && fiche?.url && (
        <LecteurFiche
          titre={`${ch.name}${ch.player ? ` — ${ch.player}` : ''}`}
          item={fiche}
          onChanger={() => setFenetre('fiche')}
          onOter={async () => {
            setFenetre(null)
            await rattacher({ sheetItemId: null })
          }}
          onClose={() => setFenetre(null)}
        />
      )}

      <div className="sheet-cols">
        {/*
          Trois colonnes, et chacune ne répond qu'à une question. À gauche
          **qui il est** : son visage en grand, son nom, ce qu'il fait, qui le
          mène, son état — et pour un PNJ ce qu'on sait de lui et ce qu'on lui
          prend. Au milieu **ses chiffres**, caractéristiques en tête. À droite
          **sa feuille**, celle que le joueur a remplie à la main.

          Avant, le visage tenait dans 50 px au coin d'un bandeau, les
          caractéristiques étaient les plus petits nombres de l'écran au fond
          d'une colonne de 322 px, et la description d'un PNJ s'était glissée
          entre elles et le journal.
        */}
        <div className="fiche-qui">
          <div className="fiche-qui-haut">
            <button
              className="portrait portrait-btn"
              onClick={() => setFenetre('portrait')}
              title="Choisir la photo de profil"
              aria-label="Choisir la photo de profil"
            >
              {portrait?.url ? (
                <img src={portrait.url} alt="" draggable={false} />
              ) : (
                <span className="initials">{initials(ch.name)}</span>
              )}
              <span className="chg">
                <IconImage />
                changer
              </span>
            </button>

            <h3>
              {ch.name}
              <button
                className="modif"
                onClick={() => setFenetre('identite')}
                title="Modifier la fiche : nom, joueur, occupation, gabarit"
                aria-label="Modifier la fiche"
              >
                <IconPen />
              </button>
            </h3>

            <p className="role">
              {[ch.occupation, ageDit(ch.age)].filter(Boolean).join(' · ') ||
                (ch.kind === 'pnj' ? 'sans rôle noté' : 'sans occupation renseignée')}
            </p>

            {/* La couleur et la personne qui mène le personnage vont ensemble :
                à la table, on reconnaît le sien à sa teinte. Un PNJ n'est mené
                par personne — la ligne n'a pas lieu d'être. */}
            {ch.kind === 'pnj' ? (
              ch.color ? (
                <div className="mene sans-joueur">
                  <span
                    className={`pion-teinte teinte c-${ch.color}`}
                    title={`${couleurDite(ch.color)} — la couleur de son pion`}
                  />
                  <span>{couleurDite(ch.color)}</span>
                </div>
              ) : null
            ) : (
              <div className="mene">
                {ch.color ? (
                  <span
                    className={`pion-teinte teinte c-${ch.color}`}
                    title={`${couleurDite(ch.color)} — la couleur de son pion`}
                  />
                ) : null}
                <NomDuJoueur ch={ch} />
              </div>
            )}
          </div>

          <div className="bloc">
            <div className="bloc-tete">
              <span className="eyebrow">États</span>
            </div>
            <div className="etats">
              {STATES.map((st) => (
                <button
                  key={st.key}
                  className="etat"
                  data-kind={st.color}
                  aria-pressed={!!ch.data.states[st.key]}
                  onClick={async () => {
                    await window.jdr.characters.setState(ch.id, st.key, !ch.data.states[st.key])
                    await s.refreshCharacters()
                  }}
                >
                  <span className="puce" />
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Ce que le MJ sait de lui, et ce qu'on lui prend quand il tombe.
              Les PNJ seulement : un joueur a sa propre feuille pour ça, et ces
              deux blocs ne sont jamais diffusés. */}
          {ch.kind === 'pnj' ? <NotesPnj ch={ch} /> : null}
          {ch.kind === 'pnj' ? <ButinPnj ch={ch} /> : null}
        </div>

        {onglet === 'equipement' ? <Equipement ch={ch} /> : null}

        {onglet === 'fiche' ? (
        <div className="corps">
          {/* Les caractéristiques d'abord, et en grand : c'est le chiffre qu'on
              cherche le plus souvent, et c'était le plus petit de l'écran. */}
          <section className="sect">
            <div className="sect-tete">
              <span className="eyebrow">Caractéristiques</span>
              <div className="spacer" />
              <span className="sys">{legendeDerive(tpl.spec.stats)}</span>
            </div>
            {tpl.spec.stats.length === 0 ? (
              <p className="rien">
                La campagne ne définit aucune caractéristique. Ouvre
                «&nbsp;Configuration&nbsp;» pour en choisir.
              </p>
            ) : (
              <div className="caracs">
                {tpl.spec.stats.map((st) => {
                  const v = ch.data.stats[st.key] ?? 0
                  const d = derived(v, st.derive)
                  return (
                    <div className="carac" key={st.key}>
                      <div className="code" title={st.label}>
                        {st.code?.trim() || st.label}
                      </div>
                      <input
                        type="number"
                        value={v}
                        onChange={async (e) => {
                          const n = Number(e.target.value)
                          if (Number.isNaN(n)) return
                          await window.jdr.characters.setStat(ch.id, st.key, n)
                          await s.refreshCharacters()
                        }}
                        aria-label={st.label}
                      />
                      {d ? <div className="half">{d}</div> : null}
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className="sect">
            <div className="sect-tete">
              <span className="eyebrow">Jauges</span>
              <div className="spacer" />
              <span className="sys">chaque +/− est horodaté</span>
            </div>
            {tpl.spec.gauges.length === 0 ? (
              <p className="rien">
                La campagne ne définit aucune jauge. Ouvre «&nbsp;Configuration&nbsp;» pour en
                ajouter.
              </p>
            ) : (
              <div className="jauges">
                {tpl.spec.gauges.map((g) => {
                  const v = ch.data.gauges[g.key] ?? { value: 0, max: g.max }
                  const pct = v.max ? Math.round((v.value / v.max) * 100) : 0
                  return (
                    <div className={`jauge g-${g.color}`} key={g.key}>
                      <span className="nm">{g.label}</span>
                      <span className="stepper">
                        <button
                          onClick={() => void adjust(g, -1)}
                          aria-label={`Retirer 1 à ${g.label}`}
                          title="Clic : −1"
                        >
                          −
                        </button>
                        <button
                          onClick={() => void adjust(g, 1)}
                          aria-label={`Ajouter 1 à ${g.label}`}
                          title="Clic : +1"
                        >
                          +
                        </button>
                        {g.maxEditable ? (
                          <button
                            className="plafond"
                            onClick={() => void adjust(g, 0, -1)}
                            aria-label={`Baisser le maximum de ${g.label}`}
                            title="Baisser le plafond (perte définitive)"
                          >
                            ⌄
                          </button>
                        ) : null}
                      </span>
                      <span className="vl">
                        {v.value}
                        <small> / {v.max}</small>
                      </span>
                      <span className="bar">
                        <i style={{ width: `${pct}%` }} />
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className="sect sect-skills">
            <div className="sect-tete">
              <span className="eyebrow">Compétences</span>
              {plafond !== null ? (
                <span className={`compte${prises.length > plafond ? ' trop' : ''}`}>
                  {prises.length} / {plafond}
                </span>
              ) : (
                <span className="compte libre">{prises.length}</span>
              )}
              <div className="spacer" />
              <span className="sys">
                {tpl.spec.rollSystem === 'd100-under' ? 'd100 sous la valeur' : 'd20 + modificateur'}
              </span>
            </div>

            <div className="skills-liste">
              {tpl.spec.skills.length === 0 ? (
                <p className="rien">
                  La campagne ne propose aucune compétence. Ouvre «&nbsp;Configuration&nbsp;» pour
                  en choisir.
                </p>
              ) : prises.length === 0 ? (
                <p className="rien">
                  {ch.name} n’a pris aucune compétence
                  {plafond !== null ? ` — il peut en prendre ${plafond}` : ''}. Prends-les
                  ci-dessous.
                </p>
              ) : (
                prises.map((sk) => {
                  const v = ch.data.skills[sk.key] ?? 0
                  return (
                    <div className="skill" key={sk.key}>
                      <span className="sn">{sk.label}</span>
                      <span className="dots" />
                      <input
                        type="number"
                        value={v}
                        onChange={async (e) => {
                          const n = Number(e.target.value)
                          if (Number.isNaN(n)) return
                          await window.jdr.characters.setSkill(ch.id, sk.key, n)
                          await s.refreshCharacters()
                        }}
                        aria-label={sk.label}
                      />
                      <button
                        className="go"
                        onClick={() => void roll(sk.label, v)}
                        title={`Lancer ${sk.label}`}
                      >
                        jet
                      </button>
                      <button
                        className="rendre"
                        title={`Rendre ${sk.label}`}
                        aria-label={`Rendre ${sk.label}`}
                        onClick={async () => {
                          if (v !== 0 && !confirm(`Rendre ${sk.label} ? Sa valeur (${v}) est perdue.`))
                            return
                          await window.jdr.characters.pickSkill(ch.id, sk.key, false)
                          await s.refreshCharacters()
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  )
                })
              )}
            </div>

            {restantes.length > 0 && (
              <div className="skills-choix">
                <span className="eyebrow">
                  {complet
                    ? 'Plafond atteint — rends-en une pour en prendre une autre'
                    : `À prendre${plafond !== null ? ` — encore ${plafond - prises.length}` : ''}`}
                </span>
                <div className="offres">
                  {restantes.map((sk) => (
                    <button
                      key={sk.key}
                      className="offre"
                      disabled={complet}
                      title={
                        complet
                          ? `${ch.name} a déjà ses ${plafond} compétences`
                          : `Donner ${sk.label} à ${ch.name}`
                      }
                      onClick={async () => {
                        await window.jdr.characters.pickSkill(ch.id, sk.key, true)
                        await s.refreshCharacters()
                      }}
                    >
                      <IconPlus />
                      {sk.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Le journal se lit au pied des chiffres qu'il enregistre, et non
              plus dans une colonne de 322 px où la raison du coup ne tenait
              pas sur la ligne. */}
          <section className="sect journal-bas">
            <div className="sect-tete">
              <span className="eyebrow">Journal</span>
              <span className="sys">
                {s.charLog.length === 0
                  ? 'aucune modification enregistrée'
                  : `${s.charLog.length} entrée${s.charLog.length > 1 ? 's' : ''}`}
              </span>
            </div>
            <ol className="jrn">
              {s.charLog.map((e) => (
                <li key={e.id}>
                  <time>{e.at.slice(11, 16)}</time>
                  <span className={`delta ${e.delta < 0 ? 'dn' : 'up'}`}>
                    {shortLabel(e.label)} {e.delta < 0 ? '−' : '+'}
                    {Math.abs(e.delta)}
                  </span>
                  <span>
                    {e.reason ?? 'ajusté par le MJ'} · {e.value}/{e.max}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>
        ) : null}

        {/*
          La colonne de sa feuille ne disparaît plus quand rien n'est lié :
          elle propose de la lier. Sans quoi les deux autres colonnes
          changeaient de largeur d'un personnage à l'autre, et le geste
          « lier sa fiche » se cherchait ailleurs à chaque fois.
        */}
        {onglet === 'fiche' ? (
          fiche?.url ? (
          <ApercuFiche
            item={fiche}
            frame={ch.sheetFrame}
            onFrame={(f) => void rattacher({ sheetFrame: f })}
            onAgrandir={() => setFenetre('lecture')}
            onChanger={() => setFenetre('fiche')}
          />
        ) : (
          <div className="sheet-c">
            <div className="apercu-tete">
              <span className="eyebrow">Sa fiche</span>
            </div>
            <button className="apercu-vide" onClick={() => setFenetre('fiche')}>
              <IconPdf />
              <b>Lier sa fiche de compétences</b>
              <span>
                Le PDF, le scan ou la photo de la feuille remplie par {ch.name}. Elle se lira ici,
                à côté de ses chiffres.
              </span>
            </button>
          </div>
          )
        ) : null}
      </div>
    </div>
  )
}

/* ============================================================
   L'aperçu permanent de la fiche de compétences, à droite
   ============================================================ */

function ApercuFiche({
  item,
  frame,
  onFrame,
  onAgrandir,
  onChanger
}: {
  item: UiItem
  frame: Frame | null
  onFrame: (f: Frame) => void
  onAgrandir: () => void
  onChanger: () => void
}): JSX.Element {
  /*
   * La molette appelle le cadrage à chaque cran ; l'enregistrer à chaque cran
   * ferait un aller-retour en base et un rafraîchissement complet par pixel de
   * molette. On temporise : l'affichage suit tout de suite — `Framed` tient son
   * propre état —, la base attend que la main s'arrête.
   */
  const attente = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => void (attente.current && clearTimeout(attente.current)), [])

  const enregistrer = (f: Frame): void => {
    if (attente.current) clearTimeout(attente.current)
    attente.current = setTimeout(() => onFrame(f), 300)
  }

  return (
    <div className="sheet-c">
      <div className="apercu-tete">
        <span className="eyebrow">Sa fiche</span>
        <span className="nomfic">{item.title}</span>
        {/* Changer le fichier se fait là où on le regarde : le bouton n'a plus
            à vivre dans un coin d'en-tête, loin de ce qu'il remplace. */}
        <button
          className="btn btn-sm btn-ghost"
          onClick={onChanger}
          title="Lier une autre feuille — un PDF, un scan ou une photo"
        >
          <IconPdf />
        </button>
        <button className="btn btn-sm btn-ghost" onClick={onAgrandir} title="Lire en grand">
          <IconExpand />
        </button>
      </div>
      {item.kind === 'pdf' ? (
        /* Un PDF apporte son propre lecteur, avec son zoom : on ne lui superpose rien. */
        <iframe className="apercu-pdf" title={item.title} src={item.url ?? ''} />
      ) : (
        /*
         * Les mêmes gestes qu'en Régie, par le même composant : molette pour
         * agrandir autour du curseur, glisser pour décaler, double-clic pour
         * remettre droit. Le cadrage est enregistré au relâchement.
         */
        <div className="apercu-img">
          <Framed
            url={item.url ?? ''}
            alt={item.title}
            frame={frame ?? undefined}
            onFrame={enregistrer}
          />
        </div>
      )}
    </div>
  )
}

/* ============================================================
   L'identité de la fiche — un seul formulaire, pour créer et pour modifier
   ============================================================ */

/**
 * Ce qui ne se règle ni à la molette ni au +/− : le nom, le joueur,
 * l'occupation, le gabarit. Un `ch` absent veut dire « nouvelle fiche ».
 */
/**
 * Le bloc de notes d'un PNJ : ce qu'il sait, ce qu'il cache, ce qui le fait
 * céder. Les fiches de joueurs n'en ont pas.
 *
 * On enregistre quand la main s'arrête, pas à chaque touche : un aller-retour
 * en base et un rafraîchissement complet par lettre, c'est ce que fait déjà le
 * cadrage de l'aperçu, et pour la même raison on ne le refait pas ici.
 */
function NotesPnj({ ch }: { ch: Character }): JSX.Element {
  const s = useStore()
  const [texte, setTexte] = useState(ch.notes ?? '')
  const frappe = useRef<ReturnType<typeof setTimeout> | null>(null)
  /* Le champ garde la main pendant la frappe ; il ne se recale sur la base que
     lorsqu'on change de personnage. */
  useEffect(() => setTexte(ch.notes ?? ''), [ch.id])
  useEffect(() => () => void (frappe.current && clearTimeout(frappe.current)), [])

  const tape = (v: string): void => {
    setTexte(v)
    if (frappe.current) clearTimeout(frappe.current)
    frappe.current = setTimeout(() => {
      void window.jdr.characters
        .upsert({ id: ch.id, templateId: ch.templateId, name: ch.name, notes: v })
        .then(() => s.refreshCharacters())
    }, 400)
  }

  return (
    <div className="bloc pnj-notes">
      <div className="bloc-tete">
        <span className="eyebrow">Ce que tu sais de lui</span>
        <span className="pnj-jamais">jamais diffusé</span>
      </div>
      <textarea
        value={texte}
        onChange={(e) => tape(e.target.value)}
        placeholder={'Ce qu’il cache, ce qui le fait céder, sa voix.\nCe sur quoi il ment.'}
        aria-label={`Notes sur ${ch.name}`}
      />
    </div>
  )
}

/**
 * La table de butin d'un PNJ : une ligne par prise, cochée quand les joueurs
 * l'ont ramassée. La ligne reste, barrée — le MJ doit voir ce qui est parti
 * autant que ce qui traîne encore.
 *
 * La table part entière à chaque changement, comme les notes : on ne suit pas
 * une ligne, on repose ce qui est à l'écran. Les cases et les boutons partent
 * tout de suite, la frappe attend que la main s'arrête.
 */
function ButinPnj({ ch }: { ch: Character }): JSX.Element {
  const s = useStore()
  const [lignes, setLignes] = useState<ButinLigne[]>(ch.butin)
  const frappe = useRef<ReturnType<typeof setTimeout> | null>(null)
  /* Une ligne neuve prend la main : on l'ajoute pour l'écrire, pas pour la
     regarder. */
  const neuve = useRef<string | null>(null)

  /* Comme les notes : la liste garde la main pendant la frappe, et ne se
     recale sur la base que lorsqu'on change de personnage. */
  useEffect(() => setLignes(ch.butin), [ch.id])
  useEffect(() => () => void (frappe.current && clearTimeout(frappe.current)), [])

  const enregistre = (l: ButinLigne[]): void => {
    void window.jdr.characters.setButin(ch.id, l).then(() => s.refreshCharacters())
  }

  /** Ce qui se clique part tout de suite : une case cochée doit tenir. */
  const pose = (l: ButinLigne[]): void => {
    setLignes(l)
    if (frappe.current) clearTimeout(frappe.current)
    enregistre(l)
  }

  /** Ce qui se tape attend la fin du mot. */
  const tape = (l: ButinLigne[]): void => {
    setLignes(l)
    if (frappe.current) clearTimeout(frappe.current)
    frappe.current = setTimeout(() => enregistre(l), 400)
  }

  const change = (id: string, patch: Partial<ButinLigne>): ButinLigne[] =>
    lignes.map((l) => (l.id === id ? { ...l, ...patch } : l))

  const ajoute = (): void => {
    const id = `b${Date.now().toString(36)}`
    neuve.current = id
    /* Rien à enregistrer : une ligne sans intitulé n'existe pas encore. */
    setLignes([...lignes, { id, texte: '', qte: 1, pris: false }])
  }

  const restant = lignes.filter((l) => !l.pris).length

  return (
    <div className="bloc pnj-butin">
      <div className="bloc-tete">
        <span className="eyebrow">Table et butin</span>
        <span className="pnj-jamais">jamais diffusé</span>
      </div>

      <ul className="butin-liste">
        {lignes.map((l) => (
          <li className={`butin-ligne${l.pris ? ' pris' : ''}`} key={l.id}>
            <input
              type="checkbox"
              checked={l.pris}
              onChange={(e) => pose(change(l.id, { pris: e.target.checked }))}
              aria-label={`${l.texte || 'cette ligne'} — ramassé`}
              title={l.pris ? 'Ramassé — décocher pour le remettre' : 'Cocher quand les joueurs le prennent'}
            />
            <input
              className="butin-texte"
              value={l.texte}
              ref={(el) => {
                if (el && neuve.current === l.id) {
                  neuve.current = null
                  el.focus()
                }
              }}
              onChange={(e) => tape(change(l.id, { texte: e.target.value }))}
              placeholder="Ce qu’on lui trouve"
              aria-label="Intitulé"
            />
            <input
              className="butin-qte"
              type="number"
              min={0}
              value={l.qte}
              onChange={(e) => {
                const n = Number(e.target.value)
                if (Number.isNaN(n)) return
                tape(change(l.id, { qte: Math.max(0, Math.trunc(n)) }))
              }}
              aria-label={`Quantité — ${l.texte || 'cette ligne'}`}
            />
            <button
              className="butin-retire"
              onClick={() => pose(lignes.filter((x) => x.id !== l.id))}
              aria-label={`Retirer ${l.texte || 'cette ligne'} de la table`}
              title="Retirer la ligne"
            >
              <IconClose />
            </button>
          </li>
        ))}
      </ul>

      {/* Le compte se lit au pied de la table, pas dans son titre : l'en-tête
          est déjà pris par le nom et par la promesse de ne rien diffuser. */}
      <div className="butin-pied">
        <button className="butin-ajout" onClick={ajoute}>
          <IconPlus /> ajouter une ligne
        </button>
        {lignes.length > 0 ? (
          <span className="butin-reste">
            {restant === 0 ? 'tout est pris' : `${restant} à prendre`}
          </span>
        ) : null}
      </div>
    </div>
  )
}

function FormFiche({
  ch,
  kind,
  onClose
}: {
  ch?: Character
  /** La nature d'un personnage neuf. Un personnage existant garde la sienne. */
  kind?: CharacterKind
  onClose: () => void
}): JSX.Element {
  const s = useStore()
  /* Un PNJ n'est mené par personne : le bloc « qui le joue » n'a pas lieu
     d'être, et la couleur ne se prend pas à une personne du carnet. */
  const pnj = (ch?.kind ?? kind ?? 'pj') === 'pnj'
  const [name, setName] = useState(ch?.name ?? '')
  const [occupation, setOccupation] = useState(ch?.occupation ?? '')
  const [notes, setNotes] = useState(ch?.notes ?? '')
  /* Le portrait se choisit dès la création : c'est au moment où l'on invente
     quelqu'un qu'on a son visage en tête, pas trois écrans plus loin. */
  const [portraitItemId, setPortraitItemId] = useState<number | null>(ch?.portraitItemId ?? null)
  const [choixPortrait, setChoixPortrait] = useState(false)
  const [age, setAge] = useState((ch?.age ?? '').replace(/[^0-9]/g, ''))
  const [color, setColor] = useState<string | null>(ch?.color ?? null)
  /* La silhouette de sa poupée d'équipement. Deux dessins, pas une case
     d'état civil : c'est le corps sur lequel on pose la tête et les mains. */
  const [sexe, setSexe] = useState<Sexe | null>(ch?.sexe ?? null)
  /* La fiche vient de la campagne : un personnage neuf la reçoit sans qu'on
     la lui demande, et un personnage existant garde la sienne, qui est la même. */
  const templateId = ch?.templateId ?? s.sheet?.id ?? 0
  const [confirme, setConfirme] = useState(false)

  /*
   * Qui mène ce personnage. Le choix est encodé en texte parce qu'il vient de
   * deux endroits : « p:12 » désigne quelqu'un déjà inscrit à la campagne,
   * « c:uid » quelqu'un qui n'est qu'au carnet et qu'on inscrira en
   * enregistrant. Rien n'est écrit tant qu'on n'a pas validé la fiche.
   */
  const joueurActuel = playerOf(s, ch?.id ?? null)
  const [choixJoueur, setChoixJoueur] = useState(joueurActuel ? `p:${joueurActuel.id}` : '')
  const [nouveauJoueur, setNouveauJoueur] = useState<string | null>(null)

  /*
   * Tout le monde figure dans la liste, y compris ceux qui mènent déjà
   * quelqu'un — eux ne se choisissent pas, mais on les voit et on lit
   * pourquoi. Les masquer faisait croire à un joueur manquant, ce qui est la
   * pire façon de dire « celui-là n'est pas disponible ».
   */
  const menePar = (x: { characterId: number | null }): Character | undefined =>
    s.characters.find((c) => c.id === x.characterId)
  const inscrits = s.players.map((x) => ({
    ...x,
    pris: x.characterId !== null && x.id !== joueurActuel?.id,
    mene: menePar(x)
  }))
  const auCarnet = s.carnet.filter((c) => !s.players.some((x) => x.uid === c.uid))

  /** Qui détient déjà cette teinte, fiche ou personne — personne, si elle est libre. */
  const detenteur = (key: string): string | null =>
    s.characters.find((x) => x.id !== ch?.id && x.color === key)?.name ??
    s.players.find((x) => x.color === key && `p:${x.id}` !== choixJoueur)?.name ??
    null

  /** Créer la personne pour de bon : elle entre au carnet et à la campagne. */
  const creerJoueur = async (): Promise<void> => {
    const nom = (nouveauJoueur ?? '').trim()
    if (!nom) return
    const p = await window.jdr.players.create(nom)
    await s.refreshPlayers()
    setChoixJoueur(`p:${p.id}`)
    setNouveauJoueur(null)
  }

  const enregistrer = async (): Promise<void> => {
    if (!name.trim() || !templateId) return
    const c = await window.jdr.characters.upsert({
      id: ch?.id,
      templateId,
      kind: ch?.kind ?? kind ?? 'pj',
      notes: pnj ? notes.trim() || null : undefined,
      portraitItemId,
      name: name.trim(),
      occupation: occupation.trim() || null,
      age: age.trim() || null,
      color,
      sexe
    })

    /* Quelqu'un pris au carnet n'entre à la campagne qu'ici : renoncer à la
       fiche ne doit inscrire personne. */
    let joueurId: number | null = null
    if (choixJoueur.startsWith('p:')) joueurId = Number(choixJoueur.slice(2))
    else if (choixJoueur.startsWith('c:')) {
      joueurId = (await window.jdr.players.enroll(choixJoueur.slice(2))).id
    }

    if (joueurActuel && joueurActuel.id !== joueurId) {
      await window.jdr.players.setCharacter(joueurActuel.id, null)
    }
    if (joueurId !== null) {
      await window.jdr.players.setCharacter(joueurId, c.id)
      /*
       * La couleur appartient à la personne, pas à la fiche : elle la suit
       * d'une campagne à l'autre, et la base la recopie sur le personnage
       * chaque fois qu'on lie les deux. La changer ici, c'est donc la changer
       * chez elle — sans quoi le reflet réécrirait aussitôt l'ancienne par
       * dessus et le choix n'aurait servi à rien.
       */
      const perso = s.players.find((x) => x.id === joueurId)
      if (color && perso?.color !== color) {
        await window.jdr.players.update(joueurId, { color })
      }
    }

    await s.refreshPlayers()
    await s.refreshCharacters()
    if (!ch) s.setCurrentCharacter(c.id)
    onClose()
  }

  const supprimer = async (): Promise<void> => {
    if (!ch) return
    await window.jdr.characters.remove(ch.id)
    /* `refreshCharacters` se charge de reporter la sélection sur ce qui reste. */
    await s.refreshCharacters()
    onClose()
  }

  const portraitChoisi = itemById(s.allItems, portraitItemId)

  return (
    <>
      {choixPortrait ? (
        <ChoixDansArbre
          titre={`Portrait — ${name.trim() || (pnj ? 'ce PNJ' : 'ce personnage')}`}
          icone={<IconImage />}
          kinds={['image']}
          rendu="vignettes"
          courant={portraitItemId}
          sansLibelle="Sans portrait"
          onPick={(id) => {
            setPortraitItemId(id)
            setChoixPortrait(false)
          }}
          onClose={() => setChoixPortrait(false)}
        />
      ) : null}

    <div className="scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <IconPeople />
          <h3>{ch ? 'Modifier la fiche' : pnj ? 'Nouveau PNJ' : 'Nouveau personnage'}</h3>
        </header>
        <div className="body">
          <div className="field">
            <label htmlFor="nc-name">Nom du personnage</label>
            <input
              id="nc-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void enregistrer()}
              placeholder="Adèle Kervoas"
              autoFocus
            />
          </div>
          {/* Le portrait se choisit dès la création : c'est au moment où l'on
              invente quelqu'un qu'on a son visage en tête, pas trois écrans
              plus loin. */}
          <div className="field">
            <div className="nc-portrait-rang">
              <button
                type="button"
                className="nc-portrait"
                onClick={() => setChoixPortrait(true)}
                title={portraitChoisi ? portraitChoisi.title : 'Choisir une image de la campagne'}
              >
                {portraitChoisi?.poster || portraitChoisi?.url ? (
                  <img src={portraitChoisi.poster ?? portraitChoisi.url!} alt="" />
                ) : (
                  <span className="nc-portrait-vide">
                    <IconImage />
                  </span>
                )}
              </button>
              <div className="nc-portrait-dit">
                <span className="eyebrow">Portrait</span>
                <span className="nc-portrait-nom">
                  {portraitChoisi ? portraitChoisi.title : 'Aucun — il portera ses initiales'}
                </span>
                <div className="nc-portrait-actes">
                  <button className="btn btn-sm" onClick={() => setChoixPortrait(true)}>
                    {portraitChoisi ? 'Changer…' : 'Choisir une image…'}
                  </button>
                  {portraitChoisi ? (
                    <button className="btn btn-sm btn-ghost" onClick={() => setPortraitItemId(null)}>
                      Retirer
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {/* Qui le mène. On le demande ici plutôt que sur la fiche finie :
              c'est au moment de créer le personnage qu'on sait à qui il est.
              Un PNJ n'est mené par personne : la question ne se pose pas. */}
          {pnj ? null : (
            <div className="field">
            <label htmlFor="nc-joueur">Joueur</label>
            {nouveauJoueur === null ? (
              <select
                id="nc-joueur"
                value={choixJoueur}
                onChange={(e) => {
                  if (e.target.value === '+') setNouveauJoueur('')
                  else setChoixJoueur(e.target.value)
                }}
              >
                <option value="">— personne pour l’instant —</option>
                {inscrits.length > 0 && (
                  <optgroup label="À cette campagne">
                    {inscrits.map((x) => (
                      <option key={x.id} value={`p:${x.id}`} disabled={x.pris}>
                        {x.name}
                        {x.pris ? ` — mène déjà ${x.mene?.name ?? 'un personnage'}` : ''}
                      </option>
                    ))}
                  </optgroup>
                )}
                {auCarnet.length > 0 && (
                  <optgroup label="Au carnet — sera inscrit à la campagne">
                    {auCarnet.map((x) => (
                      <option key={x.uid} value={`c:${x.uid}`}>
                        {x.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                <option value="+">＋ Nouveau joueur…</option>
              </select>
            ) : (
              <div className="joueur-neuf">
                <input
                  type="text"
                  value={nouveauJoueur}
                  onChange={(e) => setNouveauJoueur(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void creerJoueur()
                    if (e.key === 'Escape') setNouveauJoueur(null)
                  }}
                  placeholder="Prénom de la personne"
                  aria-label="Nom du nouveau joueur"
                  autoFocus
                />
                <button
                  className="btn btn-sm btn-brass"
                  disabled={!nouveauJoueur.trim()}
                  onClick={() => void creerJoueur()}
                >
                  Créer
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => setNouveauJoueur(null)}>
                  Annuler
                </button>
              </div>
            )}
            <p className="aide">
              {nouveauJoueur !== null
                ? 'La personne entre au carnet : tu la retrouveras dans tes autres campagnes.'
                : choixJoueur.startsWith('c:')
                  ? 'Cette personne sera inscrite à la campagne en enregistrant la fiche.'
                  : 'Un joueur ne mène qu’un personnage : ceux qui en ont déjà un sont grisés.'}
            </p>
          </div>
          )}

          <div className="field">
            {/* Le même champ, dit autrement : « occupation » est le métier d'un
                joueur, « rôle » est ce qu'un PNJ vient faire dans l'histoire.
                C'est cette ligne qui s'affiche sous son nom dans la liste. */}
            <label htmlFor="nc-occ">{pnj ? 'Rôle' : 'Occupation'}</label>
            <input
              id="nc-occ"
              type="text"
              value={occupation}
              onChange={(e) => setOccupation(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void enregistrer()}
              placeholder={pnj ? 'Le maître de maison' : 'Journaliste · 34 ans · Rennes'}
            />
          </div>

          {/* Deux mots pour le reconnaître, écrits au moment où on l'invente.
              Ils ouvrent le bloc « Ce que tu sais de lui » de sa fiche : c'est
              le même texte, pas un second endroit où chercher. */}
          {pnj ? (
            <div className="field">
              <label htmlFor="nc-desc">Description rapide</label>
              <textarea
                id="nc-desc"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Vieil homme voûté, sent le camphre. Ment sur la date de l’incendie."
              />
            </div>
          ) : null}
          {/* L'âge est une question de joueur : on le lit sur sa fiche, il
              compte dans son histoire. Un PNJ n'en a pas besoin — ce qu'il
              faut savoir de lui tient dans son rôle et sa description. La
              couleur, elle, sert aux deux : elle cercle leur pion. */}
          <div className={pnj ? 'deux' : 'trois'}>
            {pnj ? null : (
              <div className="field">
                <label htmlFor="nc-age">Âge</label>
                {/* Un nombre, pas une phrase : « ans » est écrit une fois pour
                    toutes à côté du champ, et rajouté à l'affichage. */}
                <div className="avec-unite">
                  <input
                    id="nc-age"
                    type="number"
                    min={0}
                    max={999}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && void enregistrer()}
                    placeholder="34"
                  />
                  <span className="unite">ans</span>
                </div>
              </div>
            )}
            <div className="field">
              {/* La silhouette porte son équipement dans l'onglet suivant.
                  Tant qu'on n'a rien dit, la poupée prend celle d'homme. */}
              <label>Silhouette</label>
              <div className="nc-sexe">
                {(['homme', 'femme'] as Sexe[]).map((x) => (
                  <button
                    key={x}
                    type="button"
                    className={sexe === x ? 'on' : ''}
                    onClick={() => setSexe(sexe === x ? null : x)}
                    title={
                      sexe === x
                        ? 'Cliquer de nouveau pour ne rien dire'
                        : `Silhouette ${x} pour son équipement`
                    }
                  >
                    {x === 'homme' ? 'Homme' : 'Femme'}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Couleur</label>
              {/* Elle cercle le pion du personnage sur l'écran des joueurs :
                  à la table, on reconnaît le sien à sa couleur. */}
              <div className="couleurs">
                {PION_COULEURS.map((c) => {
                  /* Une couleur ne sert qu'une fois : celle d'un autre se voit,
                     mais ne se prend pas. « Un autre », c'est aussi bien une
                     fiche qu'une personne inscrite sans personnage — sinon on
                     choisirait une teinte déjà retenue ailleurs. */
                  const par = detenteur(c.key)
                  return (
                    <button
                      key={c.key}
                      className={`pastille${par ? ' prise' : ''}`}
                      style={{ ['--p' as string]: c.hex }}
                      aria-pressed={color === c.key}
                      disabled={!!par}
                      title={par ? `${c.name} — déjà à ${par}` : c.name}
                      onClick={() => setColor(c.key)}
                    />
                  )
                })}
                <span className="dit">
                  {color ? PION_COULEURS.find((c) => c.key === color)?.name : 'à l’attribution'}
                </span>
              </div>
            </div>
          </div>

        </div>
        <footer>
          {ch ? (
            confirme ? (
              <>
                <span className="avert">Supprimer {ch.name} et son journal ?</span>
                <button className="btn btn-ghost" onClick={() => setConfirme(false)}>
                  Non
                </button>
                <button className="btn btn-danger" onClick={() => void supprimer()}>
                  Supprimer
                </button>
              </>
            ) : (
              <button className="btn btn-danger" onClick={() => setConfirme(true)}>
                <IconTrash />
                Supprimer
              </button>
            )
          ) : null}
          {!confirme ? (
            <>
              <button className="btn btn-ghost" onClick={onClose}>
                Annuler
              </button>
              <button className="btn btn-brass" disabled={!name.trim() || !templateId} onClick={() => void enregistrer()}>
                {ch ? 'Enregistrer' : 'Créer la fiche'}
              </button>
            </>
          ) : null}
        </footer>
      </div>
    </div>
    </>
  )
}

/* ============================================================
   Le joueur qui mène ce personnage
   ============================================================ */

/**
 * Le joueur ne se tape plus : il se choisit parmi les gens inscrits à la
 * campagne. C'est le lien joueur → personnage qui fait foi ; `character.player`
 * n'en est que le reflet, tenu à jour côté base.
 */
function NomDuJoueur({ ch }: { ch: Character }): JSX.Element {
  const s = useStore()
  const [choix, setChoix] = useState(false)
  const joueur = playerOf(s, ch.id)

  /* Un joueur ne mène qu'un personnage : ceux qui en ont déjà un autre ne
     sont pas proposés — les prendre le leur retirerait sans le dire. */
  const libres = s.players.filter((p) => p.characterId === null || p.id === joueur?.id)

  const donner = async (id: number | null): Promise<void> => {
    setChoix(false)
    if (joueur && joueur.id !== id) await window.jdr.players.setCharacter(joueur.id, null)
    if (id !== null) await window.jdr.players.setCharacter(id, ch.id)
    await s.refreshPlayers()
  }

  if (!choix)
    return (
      <button
        className={`joueur${joueur ? '' : ' vide'}`}
        title="Qui mène ce personnage"
        onClick={() => setChoix(true)}
      >
        <IconPen />
        {joueur ? `joué par ${joueur.name}` : 'attribuer un joueur'}
      </button>
    )

  return (
    <select
      className="joueur-saisie"
      autoFocus
      aria-label="Joueur de ce personnage"
      value={joueur?.id ?? ''}
      onBlur={() => setChoix(false)}
      onChange={(e) => void donner(e.target.value ? Number(e.target.value) : null)}
    >
      <option value="">— personne —</option>
      {libres.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  )
}

/* ============================================================
   Lire la fiche de compétences, en grand par-dessus l'application
   ============================================================ */

function LecteurFiche({
  titre,
  item,
  onChanger,
  onOter,
  onClose
}: {
  titre: string
  item: UiItem
  onChanger: () => void
  onOter: () => void
  onClose: () => void
}): JSX.Element {
  /* Échap referme — sauf quand le focus est dans le PDF lui-même, qui garde le clavier. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="scrim plein" onClick={onClose}>
      <div className="lecteur" onClick={(e) => e.stopPropagation()}>
        <header>
          {kindIcon(item.kind, 'ico')}
          <h3>{titre}</h3>
          <span className="nomfic">{item.title}</span>
          <div className="spacer" />
          <button className="btn btn-sm btn-ghost" onClick={onChanger}>
            Changer
          </button>
          <button className="btn btn-sm btn-ghost" onClick={onOter}>
            Détacher
          </button>
          <button className="btn btn-sm btn-ghost" onClick={onClose} aria-label="Fermer">
            <IconClose />
          </button>
        </header>
        {item.kind === 'pdf' ? (
          /* Le lecteur de PDF de Chromium : il apporte sa barre de zoom et d'impression. */
          <iframe title={item.title} src={item.url ?? ''} />
        ) : (
          /*
           * Un scan ou une photo de fiche : on la déroule sur toute la largeur, comme
           * une page. Plus lisible que l'ajuster à la fenêtre, où l'écriture devient
           * trop petite — et le défilement vertical est le geste attendu sur une feuille.
           */
          <div className="scan">
            <img src={item.url ?? ''} alt={item.title} draggable={false} />
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------------- utilitaires ---------------- */

/** Le nom d'une couleur, pour l'infobulle d'une pastille. */
function couleurDite(key: string | null): string {
  return PION_COULEURS.find((c) => c.key === key)?.name ?? 'sans couleur'
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

/** « 34 » se lit « 34 ans ». Une fiche d'avant qui portait déjà le mot le garde. */
function ageDit(age: string | null): string {
  const a = age?.trim()
  if (!a) return ''
  return /^\d+$/.test(a) ? `${a} ans` : a
}

/**
 * Ce que dit la petite ligne sous « Caractéristiques » : à quoi sert le second
 * nombre de chaque tuile. Muette si la campagne ne dérive rien.
 */
function legendeDerive(stats: { derive?: 'halves' | 'mod' | 'none' }[]): string {
  if (stats.some((st) => st.derive === 'halves')) return 'valeur · moitié · cinquième'
  if (stats.some((st) => st.derive === 'mod')) return 'valeur · modificateur'
  return ''
}

function derived(v: number, mode?: 'halves' | 'mod' | 'none'): string {
  if (mode === 'mod') {
    const m = Math.floor((v - 10) / 2)
    return `${m >= 0 ? '+' : ''}${m}`
  }
  if (mode === 'halves') return `${Math.floor(v / 2)} / ${Math.floor(v / 5)}`
  return ''
}

function shortLabel(label: string): string {
  return label
    .replace('Santé mentale', 'SAN')
    .replace('Points de vie', 'PV')
    .replace('Points de magie', 'MAG')
    .slice(0, 10)
}

function levelWord(l: string): string {
  return (
    {
      critique: 'critique',
      extreme: 'extrême',
      difficile: 'difficile',
      reussite: 'réussite',
      echec: 'échec',
      maladresse: 'maladresse',
      neutre: 'résultat'
    }[l] ?? l
  )
}

