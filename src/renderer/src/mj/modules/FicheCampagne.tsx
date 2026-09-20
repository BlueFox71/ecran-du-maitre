import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { IconCheck, IconClose, IconPeople, IconPlus, IconSearch, IconTrash } from '../components/Icons'
import { jaugeSanite } from '@shared/types'
import type {
  CatalogueEntry,
  GaugeSpec,
  SheetModel,
  SkillSpec,
  StatSpec,
  TemplateSpec
} from '@shared/types'

/**
 * La fiche de la campagne.
 *
 * Une campagne se joue avec une seule fiche : la même pour tous ses
 * personnages, la même d'une séance à l'autre. C'est ici qu'on la compose —
 * ses caractéristiques, ses compétences, ses jauges — en piochant dans un
 * catalogue qui, lui, appartient à l'application et traverse les campagnes.
 *
 * Deux niveaux de réutilisation, qui ne se recouvrent pas :
 *  — le **catalogue** garde les briques (une carac, une compétence) ;
 *  — un **modèle** garde une fiche entière, pour en ouvrir une autre dessus.
 */

type Partie = 'stats' | 'skills' | 'gauges'

const PARTIES: Record<Partie, { un: string; des: string; titre: string; sous: string }> = {
  stats: {
    un: 'caractéristique',
    des: 'caractéristiques',
    titre: 'Les caractéristiques',
    sous: 'c’est à elles que les jets de dés se rapportent'
  },
  skills: {
    un: 'compétence',
    des: 'compétences',
    titre: 'Les compétences',
    sous: 'chaque joueur prend les siennes dans cette liste'
  },
  gauges: {
    un: 'jauge',
    des: 'jauges',
    titre: 'Les jauges',
    sous: 'les +/− du MJ, journalisés à l’heure exacte'
  }
}

const GENRE: Record<Partie, CatalogueEntry['kind']> = {
  stats: 'stat',
  skills: 'skill',
  gauges: 'gauge'
}

/** Les couleurs qu'une jauge peut porter, dans l'ordre où on les propose. */
const COULEURS: GaugeSpec['color'][] = ['blood', 'iris', 'moss', 'brass', 'neutral']

const DIT: Record<GaugeSpec['color'], string> = {
  blood: 'sang',
  iris: 'iris',
  moss: 'mousse',
  brass: 'laiton',
  neutral: 'neutre'
}

export function FicheCampagne({ onClose }: { onClose: () => void }): JSX.Element {
  const s = useStore()
  const fiche = s.sheet

  const [nom, setNom] = useState(fiche?.name ?? '')
  const [spec, setSpec] = useState<TemplateSpec>(
    () => fiche?.spec ?? { rollSystem: 'd20-plus', gauges: [], stats: [], skills: [], skillLimit: null }
  )
  const [partie, setPartie] = useState<Partie>('stats')
  const [filtre, setFiltre] = useState('')
  const [catalogue, setCatalogue] = useState<CatalogueEntry[]>([])
  const [modeles, setModeles] = useState<SheetModel[]>([])
  const [tiroir, setTiroir] = useState(false)
  const [sale, setSale] = useState(false)
  const [saisie, setSaisie] = useState({ code: '', label: '' })
  const champNeuf = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void (async () => {
      const [c, m] = await Promise.all([window.jdr.catalogue.list(), window.jdr.models.list()])
      setCatalogue(c)
      setModeles(m)
    })()
  }, [])

  /* Échap referme le tiroir des modèles, puis l'écran. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      if (tiroir) setTiroir(false)
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tiroir, onClose])

  const p = PARTIES[partie]
  const lignes = spec[partie] as (StatSpec | SkillSpec | GaugeSpec)[]
  const posees = useMemo(() => new Set(lignes.map((x) => x.key)), [lignes])

  const toucher = (suite: TemplateSpec): void => {
    setSpec(suite)
    setSale(true)
  }

  /* ---------------- poser, ôter, ranger ---------------- */

  /**
   * Une brique du catalogue bascule : elle se pose si elle manque, elle s'ôte
   * si elle est déjà là. Le même clic dans les deux sens — on n'a pas à viser
   * une autre cible pour défaire ce qu'on vient de faire.
   */
  const basculer = (e: CatalogueEntry): void => {
    /* Le même nom donne toujours la même clé : une brique déjà posée se
       reconnaît, et le second clic la retire au lieu de la doubler. */
    const key = cleDe(e.label)
    if (posees.has(key)) {
      oter(key)
      return
    }
    const neuf =
      partie === 'stats'
        ? ({
            key,
            label: e.label,
            code: e.code?.trim() || undefined,
            derive: spec.rollSystem === 'd20-plus' ? 'mod' : 'halves'
          } as StatSpec)
        : partie === 'skills'
          ? ({ key, label: e.label } as SkillSpec)
          : ({
              key,
              label: e.label,
              min: 0,
              max: e.max ?? 10,
              color: (e.color as GaugeSpec['color']) ?? 'neutral',
              maxEditable: true
            } as GaugeSpec)
    toucher({ ...spec, [partie]: [...lignes, neuf] } as TemplateSpec)
  }

  const oter = (key: string): void =>
    toucher({ ...spec, [partie]: lignes.filter((x) => x.key !== key) } as TemplateSpec)

  const renommer = (key: string, label: string): void =>
    toucher({
      ...spec,
      [partie]: lignes.map((x) => (x.key === key ? { ...x, label } : x))
    } as TemplateSpec)

  const retoucher = (key: string, patch: Partial<GaugeSpec>): void =>
    toucher({
      ...spec,
      [partie]: lignes.map((x) => (x.key === key ? { ...x, ...patch } : x))
    } as TemplateSpec)

  const deplacer = (key: string, sens: -1 | 1): void => {
    const i = lignes.findIndex((x) => x.key === key)
    const j = i + sens
    if (i < 0 || j < 0 || j >= lignes.length) return
    const suite = [...lignes]
    ;[suite[i], suite[j]] = [suite[j], suite[i]]
    toucher({ ...spec, [partie]: suite } as TemplateSpec)
  }

  /* ---------------- créer, et garder pour plus tard ---------------- */

  /**
   * Écrire une brique la pose sur la fiche *et* l'inscrit au catalogue. C'est
   * tout l'intérêt : tapée une fois ce soir, elle sera là dans la campagne
   * suivante sans qu'on la retape.
   */
  const creer = async (): Promise<void> => {
    const label = saisie.label.trim()
    if (!label) {
      champNeuf.current?.focus()
      return
    }
    const entree = await window.jdr.catalogue.add({
      kind: GENRE[partie],
      label,
      code: partie === 'stats' ? saisie.code.trim() || label.slice(0, 3).toUpperCase() : null,
      color: partie === 'gauges' ? 'brass' : null,
      max: partie === 'gauges' ? 10 : null
    })
    setCatalogue(await window.jdr.catalogue.list())
    setSaisie({ code: '', label: '' })
    setFiltre('')
    if (!posees.has(cleDe(entree.label))) basculer(entree)
    s.toast(`« ${label} » posée sur la fiche et gardée au catalogue.`)
  }

  const oublier = async (e: CatalogueEntry): Promise<void> => {
    if (!confirm(`Retirer « ${e.label} » de ton catalogue ? Les fiches qui la portent la gardent.`))
      return
    await window.jdr.catalogue.remove(e.uid)
    setCatalogue(await window.jdr.catalogue.list())
  }

  /* ---------------- modèles ---------------- */

  const partirDe = (m: SheetModel): void => {
    if (
      !confirm(
        `Repartir de « ${m.name} » ?\n\nLes trois listes de la fiche sont remplacées. ` +
          `Rien n'est écrit tant que tu n'as pas cliqué « Appliquer ».`
      )
    )
      return
    setTiroir(false)
    setNom(m.name)
    toucher({ ...m.spec })
  }

  const garder = async (): Promise<void> => {
    setTiroir(false)
    const m = await window.jdr.models.save(nom.trim() || 'Fiche sans nom', spec)
    setModeles(await window.jdr.models.list())
    s.toast(`« ${m.name} » gardé comme modèle — proposé dans tes autres campagnes.`)
  }

  /* ---------------- appliquer ---------------- */

  /** Ce que les personnages perdront : une ligne ôtée emporte ses valeurs. */
  const pertes = useMemo(() => {
    if (!fiche) return { stats: [], skills: [], gauges: [] as string[] }
    const avant = fiche.spec
    const disparu = <T extends { key: string; label: string }>(a: T[], b: T[]): string[] =>
      a.filter((x) => !b.some((y) => y.key === x.key)).map((x) => x.label)
    return {
      stats: disparu(avant.stats, spec.stats),
      skills: disparu(avant.skills, spec.skills),
      gauges: disparu(avant.gauges, spec.gauges)
    }
  }, [fiche, spec])

  const nbPertes = pertes.stats.length + pertes.skills.length + pertes.gauges.length

  const appliquer = async (): Promise<void> => {
    if (nbPertes > 0 && s.characters.length > 0) {
      const liste = [...pertes.stats, ...pertes.skills, ...pertes.gauges].join(', ')
      if (
        !confirm(
          `${nbPertes} ligne${nbPertes > 1 ? 's' : ''} disparaît de la fiche : ${liste}.\n\n` +
            `Les valeurs que ${s.characters.length} personnage${s.characters.length > 1 ? 's ont' : ' a'} ` +
            `saisies dessus seront perdues. Continuer ?`
        )
      )
        return
    }
    await window.jdr.sheet.save({ name: nom.trim() || fiche?.name || 'Fiche', spec })
    await s.refreshCharacters()
    setSale(false)
    s.toast(
      s.characters.length > 0
        ? `Fiche appliquée aux ${s.characters.length} personnage${s.characters.length > 1 ? 's' : ''} de la campagne.`
        : 'Fiche enregistrée.'
    )
    onClose()
  }

  const fermer = (): void => {
    if (sale && !confirm('Fermer sans appliquer ? Les changements seront perdus.')) return
    onClose()
  }

  /* ---------------- le catalogue affiché ---------------- */

  const propositions = useMemo(() => {
    const q = sansAccent(filtre.trim())
    return catalogue
      .filter((e) => e.kind === GENRE[partie])
      .filter((e) => !q || sansAccent(e.label).includes(q) || sansAccent(e.code ?? '').includes(q))
  }, [catalogue, partie, filtre])

  const limite = spec.skillLimit ?? null

  return (
    <div className="scrim plein" onClick={fermer}>
      <div className="fiche-camp" onClick={(e) => e.stopPropagation()}>
        <header className="fc-tete">
          <div className="fc-titre">
            <IconPeople />
            <div>
              <h3>Fiche de campagne</h3>
              <p>
                Une seule fiche pour toute la campagne : tous les personnages la suivent, et elle ne
                change pas d’une séance à l’autre.
              </p>
            </div>
          </div>
          <div className="spacer" />
          <div className="fc-nom">
            <input
              id="fc-nom"
              type="text"
              value={nom}
              onChange={(e) => {
                setNom(e.target.value)
                setSale(true)
              }}
              aria-label="Nom de la fiche"
              spellCheck={false}
            />
            <span className={`fc-etat${sale ? ' sale' : ''}`}>
              <span className="pt" />
              {sale ? 'modifié' : 'enregistré'}
            </span>
          </div>
          <div className="fc-tiroir-hote">
            <button
              className="btn btn-sm"
              aria-haspopup="true"
              aria-expanded={tiroir}
              onClick={(e) => {
                e.stopPropagation()
                setTiroir(!tiroir)
              }}
            >
              Modèles…
            </button>
            {tiroir && (
              <div className="fc-tiroir" onClick={(e) => e.stopPropagation()}>
                <div className="eyebrow">Repartir d’un modèle</div>
                {modeles.map((m) => (
                  <div className="fc-mod" key={m.uid}>
                    <button onClick={() => partirDe(m)}>
                      <span className="t">{m.name}</span>
                      <span className="d">
                        {m.spec.stats.length} caractéristiques · {m.spec.skills.length} compétences ·{' '}
                        {m.spec.gauges.length} jauges
                      </span>
                    </button>
                    {m.builtin ? (
                      <span className="q">livré</span>
                    ) : (
                      <button
                        className="btn btn-ghost btn-sm btn-ico"
                        title="Oublier ce modèle"
                        aria-label={`Oublier le modèle ${m.name}`}
                        onClick={async () => {
                          await window.jdr.models.remove(m.uid)
                          setModeles(await window.jdr.models.list())
                        }}
                      >
                        <IconTrash />
                      </button>
                    )}
                  </div>
                ))}
                <hr />
                <button className="fc-garder" onClick={() => void garder()}>
                  <span className="t">Enregistrer cette fiche comme modèle</span>
                  <span className="d">Disponible dans toutes tes campagnes.</span>
                </button>
              </div>
            )}
          </div>
          <button className="btn btn-sm btn-ghost btn-ico" onClick={fermer} aria-label="Fermer">
            <IconClose />
          </button>
        </header>

        <div className="fc-onglets" role="tablist" aria-label="Partie de la fiche">
          {(Object.keys(PARTIES) as Partie[]).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={partie === k}
              onClick={() => {
                setPartie(k)
                setFiltre('')
                setSaisie({ code: '', label: '' })
              }}
            >
              {PARTIES[k].titre.replace('Les ', '')}
              <span className="n">{(spec[k] as unknown[]).length}</span>
            </button>
          ))}
          <div className="spacer" />
          <label className="fc-systeme">
            <span className="eyebrow">Jet</span>
            <select
              value={spec.rollSystem}
              onChange={(e) =>
                toucher({ ...spec, rollSystem: e.target.value as TemplateSpec['rollSystem'] })
              }
              aria-label="Système de jet"
            >
              <option value="d20-plus">d20 + caractéristique</option>
              <option value="d100-under">d100 sous la valeur</option>
            </select>
          </label>
        </div>

        <div className="fc-colonnes">
          <section className="card fc-carte">
            <header>
              <h4>{p.titre}</h4>
              <span className="sous">{p.sous}</span>
              <div className="spacer" />
              {partie === 'skills' && <Limite valeur={limite} onChange={(n) => toucher({ ...spec, skillLimit: n })} />}
              {partie === 'gauges' && (
                <Sanite
                  gauges={spec.gauges}
                  choisie={jaugeSanite(spec, spec.gauges)?.key ?? null}
                  explicite={spec.sanityGauge !== undefined}
                  onChange={(key) => toucher({ ...spec, sanityGauge: key })}
                />
              )}
            </header>
            <div className="fc-defile">
              {lignes.length === 0 ? (
                <div className="fc-vide">
                  <b>Aucune {p.un} sur la fiche</b>
                  Prends-en dans le catalogue, à droite, ou écris la tienne.
                </div>
              ) : (
                lignes.map((x, i) => (
                  <div className="fc-ligne" key={x.key}>
                    <span className="poignee" aria-hidden="true">
                      ⠿
                    </span>
                    {partie === 'gauges' ? (
                      <Teinte
                        couleur={(x as GaugeSpec).color}
                        onChange={(c) => retoucher(x.key, { color: c })}
                      />
                    ) : partie === 'stats' ? (
                      <input
                        className="fc-code"
                        type="text"
                        maxLength={4}
                        value={(x as StatSpec).code ?? ''}
                        placeholder={x.label.slice(0, 3).toUpperCase()}
                        onChange={(e) => retoucher(x.key, { code: e.target.value } as never)}
                        aria-label={`Abrégé — ${x.label}`}
                        spellCheck={false}
                      />
                    ) : (
                      <span className="fc-rang">{i + 1}</span>
                    )}
                    <input
                      className="nom"
                      type="text"
                      value={x.label}
                      onChange={(e) => renommer(x.key, e.target.value)}
                      aria-label={`Nom — ${x.label}`}
                      spellCheck={false}
                    />
                    {partie === 'gauges' && (
                      <input
                        className="plafond"
                        type="number"
                        min={1}
                        value={(x as GaugeSpec).max}
                        onChange={(e) => retoucher(x.key, { max: Math.max(1, Number(e.target.value) || 1) })}
                        aria-label={`Maximum — ${x.label}`}
                      />
                    )}
                    <span className="outils">
                      <button
                        onClick={() => deplacer(x.key, -1)}
                        disabled={i === 0}
                        title="Monter"
                        aria-label={`Monter ${x.label}`}
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => deplacer(x.key, 1)}
                        disabled={i === lignes.length - 1}
                        title="Descendre"
                        aria-label={`Descendre ${x.label}`}
                      >
                        ↓
                      </button>
                      <button
                        className="oter"
                        onClick={() => oter(x.key)}
                        title="Retirer de la fiche"
                        aria-label={`Retirer ${x.label}`}
                      >
                        ✕
                      </button>
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="card fc-carte">
            <header>
              <h4>Catalogue</h4>
              <div className="fc-cherche">
                <IconSearch />
                <input
                  type="search"
                  value={filtre}
                  onChange={(e) => setFiltre(e.target.value)}
                  placeholder="Chercher…"
                  aria-label="Chercher dans le catalogue"
                />
              </div>
            </header>
            <div className="fc-defile">
              {propositions.length === 0 ? (
                <p className="fc-rien">
                  {filtre ? (
                    <>
                      Rien qui ressemble à <b>« {filtre} »</b>. Écris-le en bas : il entrera au
                      catalogue et te suivra dans tes autres campagnes.
                    </>
                  ) : (
                    <>Ton catalogue de {p.des} est vide. Écris la première en bas.</>
                  )}
                </p>
              ) : (
                <div className="fc-puces">
                  {propositions.map((e) => {
                    const pose = posees.has(cleDe(e.label))
                    return (
                      <span className={`fc-puce${pose ? ' posee' : ''}${e.builtin ? '' : ' mienne'}`} key={e.uid}>
                        <button
                          onClick={() => basculer(e)}
                          title={pose ? `Retirer ${e.label} de la fiche` : `Poser ${e.label} sur la fiche`}
                        >
                          <span className="marque">{pose ? <IconCheck /> : <IconPlus />}</span>
                          {e.code ? <span className="cod">{e.code}</span> : null}
                          <span>{e.label}</span>
                        </button>
                        {!e.builtin && (
                          <button
                            className="oublier"
                            onClick={() => void oublier(e)}
                            title="Oublier du catalogue"
                            aria-label={`Oublier ${e.label} du catalogue`}
                          >
                            ✕
                          </button>
                        )}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="fc-creer">
              <span className="eyebrow">Écrire une {p.un}</span>
              <div className="rang">
                {partie === 'stats' && (
                  <input
                    className="court"
                    type="text"
                    maxLength={4}
                    value={saisie.code}
                    onChange={(e) => setSaisie({ ...saisie, code: e.target.value })}
                    placeholder="SF"
                    aria-label="Abrégé"
                    spellCheck={false}
                  />
                )}
                <input
                  ref={champNeuf}
                  className="long"
                  type="text"
                  value={saisie.label}
                  onChange={(e) => setSaisie({ ...saisie, label: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && void creer()}
                  placeholder={
                    { stats: 'Sang-froid', skills: 'Tenir le choc', gauges: 'Souffle' }[partie]
                  }
                  aria-label={`Nom de la ${p.un}`}
                  spellCheck={false}
                />
                <button className="btn btn-sm btn-brass" onClick={() => void creer()}>
                  Ajouter
                </button>
              </div>
              <p className="note">
                Posée sur la fiche <b>et gardée dans ton catalogue</b> — tu la retrouveras dans tes
                autres campagnes sans la retaper.
              </p>
            </div>
          </section>
        </div>

        <footer className="fc-pied">
          <p className="fc-suite">
            {s.characters.length === 0 ? (
              <>Aucun personnage pour l’instant : cette fiche servira aux premiers créés.</>
            ) : (
              <>
                <b>
                  {s.characters.length} personnage{s.characters.length > 1 ? 's' : ''}
                </b>{' '}
                suive{s.characters.length > 1 ? 'nt' : ''} cette fiche. Les valeurs déjà saisies sont
                conservées
                {nbPertes > 0 ? (
                  <span className="perte">
                    {' '}
                    — sauf sur {nbPertes} ligne{nbPertes > 1 ? 's' : ''} que tu retires.
                  </span>
                ) : (
                  '.'
                )}
              </>
            )}
          </p>
          <div className="spacer" />
          <button className="btn" onClick={fermer}>
            Annuler
          </button>
          <button className="btn btn-brass" onClick={() => void appliquer()} disabled={!sale}>
            Appliquer à la campagne
          </button>
        </footer>
      </div>
    </div>
  )
}

/* ============================================================
   La limite de compétences
   ============================================================ */

/**
 * Combien de compétences un joueur a le droit de prendre. Beaucoup de systèmes
 * maison tiennent à ce nombre — c'est lui qui fait qu'un personnage a un
 * métier plutôt que tous les métiers. « Sans limite » reste possible : on ne
 * force pas un plafond à qui n'en veut pas.
 */
function Limite({
  valeur,
  onChange
}: {
  valeur: number | null
  onChange: (n: number | null) => void
}): JSX.Element {
  return (
    <span className="fc-limite">
      <label htmlFor="fc-limite">Le joueur en prend au plus</label>
      <input
        id="fc-limite"
        type="number"
        min={1}
        max={99}
        value={valeur ?? ''}
        placeholder="∞"
        onChange={(e) => {
          const n = Number(e.target.value)
          onChange(e.target.value === '' || Number.isNaN(n) || n < 1 ? null : Math.min(99, n))
        }}
      />
      <button
        className={valeur === null ? 'on' : ''}
        onClick={() => onChange(valeur === null ? 5 : null)}
        title="Basculer entre un plafond et « autant qu'il veut »"
      >
        {valeur === null ? 'sans limite' : 'lever la limite'}
      </button>
    </span>
  )
}

/* ============================================================
   Laquelle est la santé mentale
   ============================================================ */

/**
 * L'écran des joueurs pose un cerveau à côté du cœur, et la fiche avertit
 * quand elle baisse : encore faut-il savoir de quelle jauge on parle.
 *
 * C'était deviné à une liste de clés en dur — « san », « sm »… — si bien
 * qu'une campagne qui appelait la sienne « lucidité » n'y avait pas droit. Le
 * gabarit le dit maintenant, et tant qu'il ne l'a pas dit la devinette
 * continue : les campagnes d'avant n'ont rien à ressaisir.
 */
function Sanite({
  gauges,
  choisie,
  explicite,
  onChange
}: {
  gauges: GaugeSpec[]
  choisie: string | null
  /** Le gabarit a-t-il tranché, ou est-ce encore la devinette qui parle ? */
  explicite: boolean
  onChange: (key: string | null) => void
}): JSX.Element | null {
  if (!gauges.length) return null
  return (
    <span className="fc-sanite">
      <label htmlFor="fc-sanite">La santé mentale, c’est</label>
      <select
        id="fc-sanite"
        value={choisie ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
      >
        <option value="">— aucune —</option>
        {gauges.map((g) => (
          <option key={g.key} value={g.key}>
            {g.label}
          </option>
        ))}
      </select>
      {!explicite && choisie ? <span className="fc-devine">devinée</span> : null}
    </span>
  )
}

/* ============================================================
   La couleur d'une jauge
   ============================================================ */

function Teinte({
  couleur,
  onChange
}: {
  couleur: GaugeSpec['color']
  onChange: (c: GaugeSpec['color']) => void
}): JSX.Element {
  return (
    <span className="fc-teintes">
      <select
        value={couleur}
        onChange={(e) => onChange(e.target.value as GaugeSpec['color'])}
        aria-label="Couleur de la jauge"
      >
        {COULEURS.map((c) => (
          <option key={c} value={c}>
            {DIT[c]}
          </option>
        ))}
      </select>
      <span className={`fc-pastille g-${couleur}`} aria-hidden="true" />
    </span>
  )
}

/* ---------------- utilitaires ---------------- */

function sansAccent(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/**
 * La clé d'une brique se déduit de son nom : c'est elle qui relie la fiche
 * aux valeurs déjà saisies. Deux briques de même nom donneraient la même clé —
 * `prises` sert à en écarter une, au prix d'un suffixe.
 */
function cleDe(label: string, prises: string[] = []): string {
  const base = sansAccent(label).replace(/[^a-z0-9]+/g, '') || 'brique'
  if (!prises.includes(base)) return base
  let n = 2
  while (prises.includes(base + n)) n++
  return base + n
}
