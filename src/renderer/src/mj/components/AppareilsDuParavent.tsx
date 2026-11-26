/**
 * Les outils de chasse, pilotés depuis le panneau Objets du Paravent.
 *
 * En séance, le MJ n'a pas à chercher : tout ce qui est en jeu est là, quel
 * que soit le lieu à l'écran — l'EMF et le thermomètre (leur mesure, la main
 * du MJ dessus), la spirit box (ses textes et sa voix), le livre (ses textes
 * et leur écriture), la planche (la goutte, case par case), et le tarot (une
 * carte et l'un de ses textes, à la table). Les textes se préparent ici aussi,
 * pour la séance : sur la fiche de l'objet, ou carte par carte pour le tarot.
 */
import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { Curseur } from '../chasse/Appareils'
import { lancerEcriture, lancerVoix } from '../chasse/SonsChasse'
import { ECRITURES, ecritureParId } from '../chasse/ecriture'
import { ARCANES } from '../chasse/arcanes'
import { CASES_CHIFFRES, CASES_LETTRES, CASES_MOTS, caseDeLaTouche } from '../chasse/spiritisme'
import { texteTemperature } from '../chasse/temperature'
import { imageOutil } from '../../shared/outilsChasse'
import { VuePlanche, plancheBouge } from '../../shared/chasse/Vues'
import { useMaintenant } from '../../shared/chasse/temps'
import { estMesureur, seRegleAllume, type AppareilChasse } from '@shared/chasse'
import { REGLAGES_VOIX, type Goutte, type ParoleObjet, type TextePrepare, type TexteTarot } from '@shared/parole'
import type { Objet } from '@shared/types'

const nouvelId = (): string => Math.random().toString(36).slice(2, 10)

/**
 * Pourquoi rien ne peut partir de cet outil en ce moment — personne ne le
 * tient, il dort dans un sac, la spirit box est éteinte — ou `null` s'il est
 * en jeu. Les mêmes refus que le poste (`parole.ts`), dits avant le clic : la
 * voix met une seconde ou deux à se préparer, on ne la prépare pas pour rien.
 */
function horsJeu(a: AppareilChasse): string | null {
  const elle = a.outil !== 'livre'
  if (a.dansLeSac) return `${elle ? 'Elle' : 'Il'} est dans un sac.`
  if (a.ou === 'ailleurs') return `Personne ne ${elle ? 'la' : 'le'} tient.`
  if (a.outil === 'spiritbox' && !a.allume) return 'Elle est éteinte.'
  return null
}

/** Écrire la parole d'une fiche, puis relire les objets. */
async function enregistrer(o: Objet, parole: ParoleObjet): Promise<void> {
  await window.jdr.objets.update(o.id, { parole })
  await useStore.getState().refreshObjets()
}

/** La liste des textes préparés d'un outil : ajouter, retirer, lancer. */
function Textes({
  o,
  verbe,
  onLancer,
  reglages,
  bloque = null
}: {
  o: Objet
  /** Le bouton qui lance : « Dire », « Écrire ». */
  verbe: string
  onLancer: (t: TextePrepare) => Promise<string | null>
  /** Pourquoi on ne peut rien lancer maintenant ; `null` : on peut. */
  bloque?: string | null
  /** Ce qu'on règle sur un texte neuf (le livre : son écriture). */
  reglages?: (t: TextePrepare, maj: (t: TextePrepare) => void) => JSX.Element
}): JSX.Element {
  const [saisie, setSaisie] = useState('')
  const [modele, setModele] = useState<TextePrepare>({ id: '', texte: '' })
  const [refus, setRefus] = useState<string | null>(null)
  const [enCours, setEnCours] = useState<string | null>(null)
  const ajouter = (): void => {
    const t = saisie.trim()
    if (!t) return
    void enregistrer(o, { ...o.parole, textes: [...o.parole.textes, { ...modele, id: nouvelId(), texte: t }] })
    setSaisie('')
  }
  return (
    <div className="ap-textes">
      {o.parole.textes.length === 0 ? <p className="ap-aide">Aucun texte préparé pour la séance.</p> : null}
      <ul>
        {o.parole.textes.map((t) => (
          <li key={t.id}>
            <button
              className="btn btn-sm btn-brass"
              disabled={enCours !== null || !!bloque}
              title={bloque ?? undefined}
              onClick={async () => {
                setRefus(null)
                setEnCours(t.id)
                setRefus(await onLancer(t))
                setEnCours(null)
              }}
            >
              {enCours === t.id ? '…' : verbe}
            </button>
            <span className="ap-texte" style={t.ecriture ? { fontFamily: ecritureParId(t.ecriture).police } : undefined}>
              {t.texte}
            </span>
            <button
              className="ap-ote"
              aria-label="Retirer ce texte"
              title="Retirer ce texte"
              onClick={() => void enregistrer(o, { ...o.parole, textes: o.parole.textes.filter((x) => x.id !== t.id) })}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      {bloque ? <p className="ap-aide">{bloque}</p> : refus ? <p className="ap-refus">{refus}</p> : null}
      <div className="ap-ajout">
        <textarea
          rows={2}
          value={saisie}
          placeholder="Un texte à préparer… (Ctrl+Entrée pour l’ajouter)"
          onChange={(e) => setSaisie(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              ajouter()
            }
          }}
        />
        {reglages ? reglages(modele, setModele) : null}
        <button className="btn btn-sm" disabled={!saisie.trim()} onClick={ajouter}>
          Ajouter
        </button>
      </div>
    </div>
  )
}

/** La voix d'une spirit box : laquelle, et comment la radio la déforme. */
function Voix({ o }: { o: Objet }): JSX.Element {
  const [voix, setVoix] = useState<{ nom: string }[]>([])
  useEffect(() => {
    void window.jdr.spirit.voix().then(setVoix)
  }, [])
  const v = o.parole.voix ?? { nom: null, reglages: REGLAGES_VOIX }
  const regler = (patch: Partial<typeof v>): void => void enregistrer(o, { ...o.parole, voix: { ...v, ...patch } })
  const curseur = (cle: keyof typeof v.reglages, nom: string, min: number, max: number): JSX.Element => (
    <label className="ap-reglage">
      <span>{nom}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={0.05}
        defaultValue={v.reglages[cle]}
        onPointerUp={(e) => regler({ reglages: { ...v.reglages, [cle]: Number(e.currentTarget.value) } })}
        onKeyUp={(e) => regler({ reglages: { ...v.reglages, [cle]: Number(e.currentTarget.value) } })}
      />
    </label>
  )
  return (
    <details className="ap-voix">
      <summary>Voix</summary>
      <select value={v.nom ?? ''} onChange={(e) => regler({ nom: e.target.value || null })}>
        <option value="">Voix par défaut de Windows</option>
        {voix.map((x) => (
          <option key={x.nom} value={x.nom}>
            {x.nom.replace(/^Microsoft\s+/, '').replace(/\s+Desktop$/, '')}
          </option>
        ))}
      </select>
      {curseur('grave', 'Grave', 0.5, 1.2)}
      {curseur('hachage', 'Hachage', 0, 1)}
      {curseur('echo', 'Écho', 0, 1)}
      {curseur('clarte', 'Clarté', 0, 1)}
    </details>
  )
}

/** Montrer ce livre ou cette planche à la table, ou les retirer. */
function Montrer({ sorte, objetId }: { sorte: 'livre' | 'planche'; objetId: number }): JSX.Element {
  const f = useStore((s) => s.display?.fenetreChasse)
  const montre = !!f && f.sorte === sorte && f.objetId === objetId
  return (
    <button
      className={`btn btn-sm${montre ? ' btn-on' : ''}`}
      title={montre ? 'Retirer la fenêtre de la table' : 'Montrer à la table, dans une fenêtre par-dessus le plan'}
      onClick={() => void window.jdr.parole.montrer(montre ? null : { sorte, objetId })}
    >
      {montre ? 'Retirer de la table' : 'Montrer à la table'}
    </button>
  )
}

/** La planche : la goutte, case par case — au clic, ou au clavier quand la souris est dessus. */
function Planche({ o, bloque }: { o: Objet; bloque: string | null }): JSX.Element {
  const [goutte, setGoutte] = useState<Goutte | null>(null)
  const [refus, setRefus] = useState<string | null>(null)
  const [survol, setSurvol] = useState(false)
  const maintenant = useMaintenant(plancheBouge(goutte, Date.now()))
  const bouge = plancheBouge(goutte, maintenant)
  const viser = async (id: string): Promise<void> => {
    if (bouge || bloque) return
    const r = await window.jdr.parole.viser(o.id, id)
    setRefus(r)
    if (!r) setGoutte((g) => ({ de: g?.vers ?? '', vers: id, debut: Date.now() }))
  }
  useEffect(() => {
    if (!survol) return
    const h = (e: KeyboardEvent): void => {
      const el = e.target as HTMLElement | null
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
      const c = caseDeLaTouche(e.key)
      if (!c) return
      e.preventDefault()
      void viser(c.id)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })
  return (
    <div className="ap-planche" onMouseEnter={() => setSurvol(true)} onMouseLeave={() => setSurvol(false)}>
      <VuePlanche goutte={goutte} maintenant={maintenant} />
      <div className="ap-cases">
        {[...CASES_MOTS, ...CASES_LETTRES, ...CASES_CHIFFRES].map((c) => (
          <button key={c.id} className="btn btn-sm" disabled={bouge || !!bloque} onClick={() => void viser(c.id)}>
            {c.id}
          </button>
        ))}
      </div>
      <p className="ap-aide">{bloque ?? 'Souris sur la planche : les touches du clavier la font glisser.'}</p>
      {refus ? <p className="ap-refus">{refus}</p> : null}
    </div>
  )
}

/** Une carte d'appareil en jeu. */
function Appareil({ a, o, ou }: { a: AppareilChasse; o: Objet | undefined; ou: string }): JSX.Element {
  return (
    <article className={`ap-carte${a.controle ? ' controle' : ''}`}>
      <header>
        <img src={imageOutil(a.outil)} alt="" draggable={false} />
        <span>
          <b>{a.nom}</b>
          <small>
            {ou}
            {seRegleAllume(a.outil) ? (a.allume ? ' · allumé' : ' · éteint') : ''}
          </small>
        </span>
        {estMesureur(a.outil) ? (
          <span className="ap-mesure">
            {a.outil === 'emf' ? `Niveau ${a.valeur.toFixed(1)}` : `${texteTemperature(a.valeur)} °C`}
          </span>
        ) : null}
      </header>
      {estMesureur(a.outil) ? (
        <div className="ap-corps">
          {a.controle ? <Curseur a={a} /> : null}
          {a.ou !== 'ailleurs' || a.controle ? (
            <button
              className={`btn btn-sm${a.controle ? ' btn-brass' : ''}`}
              onClick={() => void window.jdr.chasse.controler(a.placementId, a.controle ? null : a.valeur)}
            >
              {a.controle ? 'Lâcher le contrôle' : 'Prendre le contrôle'}
            </button>
          ) : null}
        </div>
      ) : o && a.outil === 'spiritbox' ? (
        <div className="ap-corps">
          <Voix o={o} />
          <Textes o={o} verbe="Dire" bloque={horsJeu(a)} onLancer={(t) => lancerVoix(o.id, t.texte, o.parole)} />
        </div>
      ) : o && a.outil === 'livre' ? (
        <div className="ap-corps">
          <Montrer sorte="livre" objetId={o.id} />
          <Textes
            o={o}
            verbe="Écrire"
            bloque={horsJeu(a)}
            onLancer={(t) => lancerEcriture(o.id, t)}
            reglages={(t, maj) => (
              <span className="ap-ecritures">
                {ECRITURES.map((e) => (
                  <button
                    key={e.id}
                    className={`btn btn-sm${(t.ecriture ?? ECRITURES[0].id) === e.id ? ' btn-on' : ''}`}
                    style={{ fontFamily: e.police }}
                    onClick={() => maj({ ...t, ecriture: e.id })}
                  >
                    {e.nom}
                  </button>
                ))}
                <label className="ap-reglage">
                  <span>Inclinaison {t.angle ?? 0}°</span>
                  <input
                    type="range"
                    min={-45}
                    max={45}
                    step={1}
                    value={t.angle ?? 0}
                    onChange={(e) => maj({ ...t, angle: Number(e.target.value) })}
                  />
                </label>
                <label className="ap-reglage">
                  <span>Taille {Math.round((t.taille ?? 1) * 100)} %</span>
                  <input
                    type="range"
                    min={0.6}
                    max={1.8}
                    step={0.05}
                    value={t.taille ?? 1}
                    onChange={(e) => maj({ ...t, taille: Number(e.target.value) })}
                  />
                </label>
              </span>
            )}
          />
        </div>
      ) : o && a.outil === 'planche' ? (
        <div className="ap-corps">
          <Montrer sorte="planche" objetId={o.id} />
          <Planche o={o} bloque={horsJeu(a)} />
        </div>
      ) : null}
    </article>
  )
}

/** Le tarot : la carte qu'un joueur a tirée, et l'un de ses textes, à la table. */
function Tarot(): JSX.Element {
  const [carte, setCarte] = useState<string | null>(null)
  const [textes, setTextes] = useState<TexteTarot[]>([])
  const [saisie, setSaisie] = useState('')
  const f = useStore((s) => s.display?.fenetreChasse)
  const relire = async (): Promise<void> => setTextes(await window.jdr.tarot.liste())
  useEffect(() => {
    void relire()
  }, [])
  const a = ARCANES.find((x) => x.fichier === carte)
  const siens = textes.filter((t) => t.arcane === carte)
  return (
    <section className="ap-tarot">
      <header className="ap-tete">
        <span className="eyebrow">Tarot</span>
        {f?.sorte === 'tarot' ? (
          <button className="btn btn-sm" onClick={() => void window.jdr.parole.retirerTarot()}>
            Retirer le tapis ({f.cartes.length})
          </button>
        ) : null}
      </header>
      <div className="ap-arcanes">
        {ARCANES.map((x) => (
          <button
            key={x.fichier}
            className={`btn btn-sm${x.fichier === carte ? ' btn-on' : ''}`}
            onClick={() => setCarte(x.fichier === carte ? null : x.fichier)}
          >
            {x.numero ? `${x.numero} · ` : ''}
            {x.nom}
          </button>
        ))}
      </div>
      {a ? (
        <div className="ap-textes">
          <ul>
            {siens.map((t) => (
              <li key={t.id}>
                <button className="btn btn-sm btn-brass" onClick={() => void window.jdr.parole.tarot(a.fichier, t.texte)}>
                  Afficher
                </button>
                <span className="ap-texte">{t.texte}</span>
                <button
                  className="ap-ote"
                  aria-label="Retirer ce texte"
                  onClick={async () => {
                    await window.jdr.tarot.retirer(t.id)
                    await relire()
                  }}
                >
                  ×
                </button>
              </li>
            ))}
            {/* Le texte de l'Écran pour cette carte : un point de départ. */}
            <li className="ap-integre">
              <button className="btn btn-sm" onClick={() => void window.jdr.parole.tarot(a.fichier, a.texte)}>
                Afficher
              </button>
              <span className="ap-texte">{a.texte}</span>
            </li>
          </ul>
          <div className="ap-ajout">
            <textarea
              rows={2}
              value={saisie}
              placeholder={`Un texte pour ${a.nom}, pour cette séance…`}
              onChange={(e) => setSaisie(e.target.value)}
            />
            <button
              className="btn btn-sm"
              disabled={!saisie.trim()}
              onClick={async () => {
                await window.jdr.tarot.ajouter(a.fichier, saisie)
                setSaisie('')
                await relire()
              }}
            >
              Ajouter
            </button>
          </div>
        </div>
      ) : (
        <p className="ap-aide">Choisis la carte que le joueur a tirée.</p>
      )}
    </section>
  )
}

export function AppareilsDuParavent(): JSX.Element {
  const chasse = useStore((s) => s.chasse)
  const objets = useStore((s) => s.objets)
  const characters = useStore((s) => s.characters)
  const places = useStore((s) => s.places)
  const ou = (a: AppareilChasse): string => {
    const qui = characters.find((c) => c.id === a.characterId)?.name ?? '?'
    if (a.dansLeSac) return `dans le sac de ${qui}`
    if (a.ou === 'main') return `en main de ${qui}`
    if (a.ou === 'lieu') return `posé — ${places.find((p) => p.id === a.placeId)?.name ?? '?'}`
    return a.characterId != null ? 'rangé' : 'hors du plan'
  }
  return (
    <section className="ap" aria-label="Appareils en jeu">
      <header className="ap-tete">
        <span className="eyebrow">Appareils</span>
      </header>
      {chasse.length === 0 ? (
        <p className="ap-aide">Aucun appareil porté ou posé pour l’instant.</p>
      ) : (
        chasse.map((a) => (
          <Appareil key={a.placementId} a={a} o={objets.find((x) => x.id === a.objetId)} ou={ou(a)} />
        ))
      )}
      <Tarot />
    </section>
  )
}
