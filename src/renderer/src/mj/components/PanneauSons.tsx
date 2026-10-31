/**
 * L'onglet Sons du Paravent : tout ce qui s'entend à la table, sous la main —
 * ce qui joue, le lieu en scène, puis le reste de la séance (voir `PanneauSons`).
 *
 * Les touches marchent partout au Paravent, onglet ouvert ou non : voir
 * `useTouchesSon`.
 */
import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import { emojiDe, sonsDAilleurs, useSons, viser } from '../sons'
import { Valeur } from './Valeur'
import { IconClose, IconLecture, IconRetour, IconStop, IconVibre } from './Icons'
import { dansForme } from '@shared/pieces'
import {
  MOTIFS_VIBRATION,
  NATURES_SON,
  type MotifVibration,
  type NatureSon,
  type Place,
  type Son,
  type SonJoue,
  type SonsMj,
  type ZoneSon
} from '@shared/types'
import type { SonSurCarte } from '../../shared/Slide'

/** Les chiffres jouent les bruitages, le point fait silence — hors d'un champ, sans Ctrl ni Alt. */
export function useTouchesSon(): void {
  useEffect(() => {
    const h = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return
      const el = e.target as HTMLElement | null
      if (el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable)) return
      if (e.key === '.') {
        e.preventDefault()
        void window.jdr.regieSon.silence()
        return
      }
      if (!/^[1-9]$/.test(e.key)) return
      const son = useSons.getState().liste.find((x) => x.touche === e.key)
      if (!son) return
      e.preventDefault()
      void window.jdr.regieSon.jouer(son.id)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])
}

/**
 * Les sons posés sur un lieu, prêts à dessiner sur la scène du Paravent.
 *
 * Leur état (armé, joué, feu vert) ne vaut que pour le lieu en scène : celui
 * qu'on prépare à côté les montre tous armés.
 */
export function useSonsSurCarte(placeId: number | null): SonSurCarte[] {
  const liste = useSons((x) => x.liste)
  const regie = useSons((x) => x.regie)
  const enScene = useStore((x) => x.display?.placeId ?? null) === placeId
  const vise = useSons((x) => x.vise)
  const [zones, setZones] = useState<ZoneSon[]>([])
  const cle = Object.keys(regie?.zones ?? {}).join(',')
  useEffect(() => {
    let vivant = true
    void window.jdr.sons.zones(placeId).then((z) => vivant && setZones(z))
    return () => {
      vivant = false
    }
  }, [placeId, cle])
  return zones.map((z) => {
    const son = liste.find((x) => x.id === z.sonId) ?? null
    const src = enScene ? regie?.sources.find((x) => x.zoneId === z.id) : undefined
    return {
      id: z.id,
      x: z.x,
      y: z.y,
      rayon: z.rayon,
      nom: z.nom || son?.nom || 'Son à choisir',
      emoji: son ? emojiDe(son) : '🔇',
      nature: son?.nature ?? 'bruitage',
      etat: (enScene ? regie?.zones[z.id] : undefined) ?? (z.quand === 'proche' ? 'ecoute' : 'arme'),
      gain: z.quand === 'proche' ? (src?.gain ?? 0) : null,
      vise: !!vise && (vise.zone === z.id || (vise.son != null && vise.son === z.sonId))
    }
  })
}

const ETAT: Record<string, string> = {
  arme: 'armé',
  fait: 'joué',
  attente: 'feu vert ?',
  ecoute: 'suit les pions'
}

const QUAND: Record<string, string> = { une: 'une fois', chaque: 'à chaque entrée', proche: 'de près' }

/** L'ordre des natures dans les tuiles : ce qui dure, puis ce qui part. */
const RANG: Record<NatureSon, number> = { ambiance: 0, nappe: 1, bruitage: 2 }

/** Une planche qui n'en est pas une : tout montrer. */
const TOUTES = '\u0000toutes'

/**
 * L'onglet Sons du Paravent, en trois étages (maquette validée le 17 oct.) :
 *  — **Ce qui joue** : tout ce qui s'entend, chacun avec son volume et sa
 *    croix ; le silence et le volume général ;
 *  — **Ici** : le lieu en scène — son ambiance, ses sons posés et ceux qui
 *    attendent le feu vert ;
 *  — **La séance** : le reste des sons de la séance, en tuiles par planche.
 * « La séance » défile ; « Ici » aussi quand le lieu porte beaucoup de sons
 * posés, sans jamais prendre plus de la moitié de la hauteur — sinon il
 * écrasait la séance à rien. Un clic sur une tuile joue, selon la nature.
 */
export function PanneauSons(): JSX.Element {
  const liste = useSons((x) => x.liste)
  const regie = useSons((x) => x.regie)
  const s = useStore()
  const placeId = s.display?.placeId ?? null
  const lieu = s.places.find((p) => p.id === placeId) ?? null

  if (!liste.length)
    return (
      <div className="spx">
        <div className="spx-vide">
          La sonothèque est vide. Prépare tes ambiances et tes bruitages dans{' '}
          <button className="btn btn-sm" onClick={() => s.setView('sons')}>
            Matière › Sons
          </button>
        </div>
      </div>
    )

  return (
    <div className="spx">
      <CeQuiJoue />
      <Ici lieu={lieu} regie={regie} />
      <LaSeance lieu={lieu} />
    </div>
  )
}

/* ---------------- Ce qui joue ---------------- */

function CeQuiJoue(): JSX.Element {
  const liste = useSons((x) => x.liste)
  const regie = useSons((x) => x.regie)
  const dernier = useSons((x) => x.dernier)
  const s = useStore()
  const audio = s.display?.audio
  const general = regie?.general ?? 0.8
  const [menu, setMenu] = useState(false)
  /* Les bruitages qui viennent de partir restent une seconde et demie dans la liste. */
  const [partis, setPartis] = useState<SonJoue[]>([])
  useEffect(() => {
    if (!dernier) return
    setPartis((p) => [dernier, ...p.filter((x) => x.n !== dernier.n)].slice(0, 3))
    const t = window.setTimeout(() => setPartis((p) => p.filter((x) => x.n !== dernier.n)), 1600)
    return () => window.clearTimeout(t)
  }, [dernier?.n])

  const sonDe = (id: number | null | undefined): Son | null => liste.find((x) => x.id === id) ?? null
  const amb = sonDe(audio?.sonId)
  const nappes = (regie?.nappes ?? []).filter((n) => n.on)
  const rien = !audio?.url && !nappes.length && !regie?.sources.length && !partis.length

  return (
    <section className="spx-etage spx-joue" aria-label="Ce qui joue">
      <div className="spx-tete">
        <span className="eyebrow">Ce qui joue</span>
        <span className="spacer" />
        <span className="spx-menu-hote">
          <button
            className="btn btn-ghost btn-sm btn-ico"
            aria-label="Plus"
            aria-expanded={menu}
            title="Faire vibrer les téléphones"
            onClick={() => setMenu((m) => !m)}
          >
            ⋯
          </button>
          {menu ? (
            <span className="spx-menu" onMouseLeave={() => setMenu(false)}>
              <span className="eyebrow">
                <IconVibre /> Faire vibrer, sans son
              </span>
              {(Object.keys(MOTIFS_VIBRATION) as MotifVibration[]).map((m) => (
                <button
                  key={m}
                  title="Tous les téléphones connectés — Android seulement"
                  onClick={() => {
                    setMenu(false)
                    void window.jdr.regieSon.vibrer(m)
                  }}
                >
                  {MOTIFS_VIBRATION[m].label}
                </button>
              ))}
            </span>
          ) : null}
        </span>
        <button className="spx-silence" title="Tout couper en fondu court" onClick={() => void window.jdr.regieSon.silence()}>
          <IconStop />
          Silence <kbd>.</kbd>
        </button>
      </div>

      <div className="spx-pistes">
        {audio?.url ? (
          <Piste
            nature="ambiance"
            emoji={amb ? emojiDe(amb) : '🎼'}
            nom={audio.title ?? amb?.nom ?? 'Ambiance'}
            sous={audio.playing ? 'ambiance' : 'ambiance · en pause'}
            volume={audio.volume}
            onVolume={(v) => void window.jdr.display.audio({ volume: v })}
            onCouper={() => void window.jdr.display.audio({ itemId: null, url: null, title: null, playing: false, sonId: null })}
          />
        ) : null}
        {nappes.map((n) => {
          const son = sonDe(n.sonId)
          return (
            <Piste
              key={n.sonId}
              nature="nappe"
              emoji={son ? emojiDe(son) : '🌫️'}
              nom={son?.nom ?? 'Nappe'}
              sous="nappe"
              volume={n.volume}
              onVolume={(v) => void window.jdr.regieSon.reglerNappe(n.sonId, { volume: v, on: true })}
              onCouper={() => void window.jdr.regieSon.retirerNappe(n.sonId)}
            />
          )
        })}
        {(regie?.sources ?? []).map((src) => {
          const son = sonDe(src.sonId)
          return (
            <Piste
              key={`z${src.zoneId}`}
              survol={{ zone: src.zoneId }}
              nature={son?.nature ?? 'nappe'}
              emoji={son ? emojiDe(son) : '🌫️'}
              nom={son?.nom ?? 'Son posé'}
              sous="suit les pions"
              jauge={src.gain}
            />
          )
        })}
        {partis.map((j) => (
          <Piste key={`j${j.n}`} nature={j.nature} emoji={j.emoji ?? emojiDe(j)} nom={j.nom} sous={j.qui ? `${j.qui} · vient de partir` : 'vient de partir'} jauge={0.9} />
        ))}
        {rien ? <span className="spx-rien">Silence. Un clic sur une tuile fait entendre un son.</span> : null}
      </div>

      <label className="spx-general">
        <span>Volume général</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={general}
          aria-label="Volume général"
          onChange={(e) => void window.jdr.regieSon.regler({ general: Number(e.target.value) })}
        />
        <Valeur
          className="num"
          value={Math.round(general * 100)}
          min={0}
          max={100}
          unite=" %"
          label="Volume général"
          onChange={(v) => void window.jdr.regieSon.regler({ general: v / 100 })}
        />
      </label>
    </section>
  )
}

/** Une ligne de « Ce qui joue » : un curseur et une croix, ou une jauge pour ce qui ne se règle pas ici. */
function Piste({
  nature,
  emoji,
  nom,
  sous,
  volume,
  onVolume,
  onCouper,
  jauge,
  survol
}: {
  /** Ce que la scène allume quand on la survole. */
  survol?: { zone?: number; son?: number }
  nature: NatureSon
  emoji: string
  nom: string
  sous: string
  volume?: number
  onVolume?: (v: number) => void
  onCouper?: () => void
  /** De 0 à 1 : ce que le son donne en ce moment. */
  jauge?: number
}): JSX.Element {
  return (
    <div className={`spx-piste n-${nature}`} {...(survol ? viser(survol) : {})}>
      <span className="emo">{emoji}</span>
      <span className="nm" title={nom}>
        {nom}
        <small>{sous}</small>
      </span>
      {jauge !== undefined ? (
        <span className="spx-jauge" title={`${Math.round(jauge * 100)} %`}>
          <i style={{ width: `${jauge * 100}%` }} />
        </span>
      ) : (
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume ?? 0}
          aria-label={`Volume de ${nom}`}
          onChange={(e) => onVolume?.(Number(e.target.value))}
        />
      )}
      {onCouper ? (
        <button className="spx-x" aria-label={`Couper ${nom}`} title="Couper, en fondu" onClick={onCouper}>
          <IconClose />
        </button>
      ) : (
        <span />
      )}
    </div>
  )
}

/* ---------------- Ici : le lieu en scène ---------------- */

/** Le plan qui porte les sons d'un lieu : celui de son étage pour une pièce découpée. */
const porteurDe = (p: Place): number => (p.tier === 'lieu' && p.zone && p.parentId != null ? p.parentId : p.id)

function Ici({ lieu, regie }: { lieu: Place | null; regie: SonsMj | null }): JSX.Element {
  const liste = useSons((x) => x.liste)
  const s = useStore()
  const audio = s.display?.audio
  const [zones, setZones] = useState<ZoneSon[]>([])
  const cle = Object.keys(regie?.zones ?? {}).join(',')
  const plan = lieu ? porteurDe(lieu) : null
  useEffect(() => {
    let vivant = true
    void window.jdr.sons.zones(plan).then((z) => vivant && setZones(z))
    return () => {
      vivant = false
    }
  }, [plan, cle])

  /* Une pièce découpée : seuls les sons qui tombent dans son contour. */
  const ici = lieu?.zone && plan !== lieu.id ? zones.filter((z) => dansForme([z.x, z.y], lieu.zone!)) : zones
  const sonDe = (id: number | null): Son | null => liste.find((x) => x.id === id) ?? null
  const attente = new Map((regie?.attente ?? []).map((a) => [a.zoneId, a.qui]))

  /* L'ambiance du lieu : la sienne, sinon celle du premier contenant qui en a une. */
  let amb: { itemId: number; son: Son | null } | null = null
  for (let q: Place | undefined = lieu ?? undefined; q && !amb; q = s.places.find((x) => x.id === q!.parentId)) {
    if (q.ambienceItemId != null)
      amb = { itemId: q.ambienceItemId, son: liste.find((x) => x.fichiers.some((f) => f.itemId === q!.ambienceItemId)) ?? null }
  }
  const ambFichier = amb && !amb.son ? s.allItems.find((i) => i.id === amb!.itemId) : null
  const ambEnCours = !!amb && audio?.itemId === amb.itemId && !!audio?.playing

  return (
    <section className="spx-etage spx-ici" aria-label="Le lieu en scène">
      <div className="spx-tete">
        <span className="eyebrow">Ici</span>
        <span className="spx-lieu">{lieu ? lieu.name : 'Aucun lieu en scène'}</span>
        <span className="spacer" />
        <label className="spx-auto" title="Coupé : rien ne part tout seul, les sons posés attendent ton feu vert ici">
          <input
            type="checkbox"
            checked={regie?.auto ?? true}
            onChange={(e) => void window.jdr.regieSon.regler({ auto: e.target.checked })}
          />
          Auto
        </label>
      </div>

      {ici
        .filter((z) => regie?.zones[z.id] === 'attente')
        .map((z) => {
          const son = sonDe(z.sonId)
          return (
            <div key={z.id} className="spx-attente" {...viser({ zone: z.id })}>
              <span className="emo">{son ? emojiDe(son) : '🔇'}</span>
              <span className="t">
                <b>{z.nom || son?.nom || 'Son posé'}</b>
                <small>{attente.get(z.id) ? `${attente.get(z.id)} est entré` : 'Un pion est entré'} — feu vert ?</small>
              </span>
              <button className="btn btn-sm btn-brass" onClick={() => void window.jdr.regieSon.feuVert(z.id)}>
                <IconLecture />
                Jouer
              </button>
              <button
                className="btn btn-sm btn-ico"
                aria-label="Ne pas jouer"
                title="Ne pas le jouer : il se réarme"
                onClick={() => void window.jdr.regieSon.rearmer(z.id)}
              >
                <IconClose />
              </button>
            </div>
          )
        })}

      {lieu ? (
        <div className="spx-tuiles">
          {amb ? (
            amb.son ? (
              <Tuile son={amb.son} sous={ambEnCours ? 'en cours' : 'ambiance du lieu'} on={ambEnCours} />
            ) : ambFichier ? (
              <button
                className={`spx-tuile n-ambiance${ambEnCours ? ' on' : ''}`}
                title="Faire venir en fondu"
                onClick={() =>
                  void window.jdr.display.audio({ itemId: ambFichier.id, url: ambFichier.url, title: ambFichier.title, playing: true, loop: true, sonId: null })
                }
              >
                <span className="emo">🎼</span>
                <span className="nm">{ambFichier.title}</span>
                <span className="ou">{ambEnCours ? 'en cours' : 'ambiance du lieu'}</span>
              </button>
            ) : null
          ) : null}
          {ici.map((z) => {
            const son = sonDe(z.sonId)
            const e = regie?.zones[z.id] ?? (z.quand === 'proche' ? 'ecoute' : 'arme')
            const proche = z.quand === 'proche'
            return (
              <button
                key={z.id}
                className={`spx-tuile n-${son?.nature ?? 'bruitage'}${e === 'fait' ? ' fait' : ''}${e === 'attente' ? ' attend' : ''}`}
                disabled={!son || proche}
                {...viser({ zone: z.id })}
                title={proche ? 'Il suit les pions : son volume monte quand on s’approche' : e === 'fait' ? 'Déjà joué — clic pour le rejouer' : 'Le jouer maintenant'}
                onClick={() => void window.jdr.regieSon.jouerZone(z.id)}
              >
                {son?.touche ? <kbd>{son.touche}</kbd> : null}
                <span className="emo">{son ? emojiDe(son) : '🔇'}</span>
                <span className="nm">{z.nom || son?.nom || 'Son à choisir'}</span>
                <span className="ou">
                  posé · {e === 'arme' ? QUAND[z.quand] : ETAT[e]}
                </span>
              </button>
            )
          })}
        </div>
      ) : null}
      <span className="spx-note">
        {!lieu
          ? 'Mets un lieu en scène : son ambiance et ses sons posés viendront ici.'
          : !amb && !ici.length
            ? 'Ni ambiance ni son posé ici. Ils se règlent dans la fiche d’un son ou l’éditeur de plan.'
            : null}
        {Object.values(regie?.zones ?? {}).some((e) => e === 'fait') ? (
          <button className="btn btn-sm btn-ghost" onClick={() => void window.jdr.regieSon.toutRearmer()}>
            <IconRetour />
            Tout réarmer
          </button>
        ) : null}
      </span>
    </section>
  )
}

/* ---------------- La séance ---------------- */

function LaSeance({ lieu }: { lieu: Place | null }): JSX.Element {
  const liste = useSons((x) => x.liste)
  const regie = useSons((x) => x.regie)
  const s = useStore()
  const audio = s.display?.audio
  const [planche, setPlanche] = useState(TOUTES)
  const [q, setQ] = useState('')
  const [zonesIci, setZonesIci] = useState<Set<number>>(new Set())
  const plan = lieu ? porteurDe(lieu) : null
  useEffect(() => {
    let vivant = true
    void window.jdr.sons.zones(plan).then((z) => vivant && setZonesIci(new Set(z.map((x) => x.sonId).filter((i): i is number => i != null))))
    return () => {
      vivant = false
    }
  }, [plan])

  const ailleurs = useMemo(() => sonsDAilleurs(liste, s), [liste, s.session, s.sessions, s.allItems])
  /* Ce qu'« Ici » montre déjà ne se répète pas. */
  const ambIci = lieu?.ambienceItemId ?? null
  const seance = liste.filter(
    (x) => x.fichiers.length && !ailleurs.has(x.id) && !zonesIci.has(x.id) && !x.fichiers.some((f) => f.itemId === ambIci)
  )
  const planches = [...new Set(seance.map((x) => x.planche).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'))
  const mot = q.trim().toLowerCase()
  const montres = seance
    .filter((x) => (planche === TOUTES || x.planche === planche) && (!mot || x.nom.toLowerCase().includes(mot)))
    .sort((a, b) => RANG[a.nature] - RANG[b.nature] || a.nom.localeCompare(b.nom, 'fr'))

  return (
    <section className="spx-etage spx-seance" aria-label="Les sons de la séance">
      <div className="spx-tete">
        <span className="eyebrow">La séance</span>
        <span className="spacer" />
        <span className="spx-note num">
          {montres.length} son{montres.length > 1 ? 's' : ''}
        </span>
      </div>
      {planches.length ? (
        <div className="spx-puces" role="group" aria-label="Planches">
          {[TOUTES, ...planches].map((p) => (
            <button key={p} aria-pressed={planche === p} onClick={() => setPlanche(p)}>
              {p === TOUTES ? 'Toutes' : p}
            </button>
          ))}
        </div>
      ) : null}
      <input className="spx-cherche" type="search" placeholder="Chercher un son…" aria-label="Chercher un son" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="spx-defile">
        <div className="spx-tuiles">
          {montres.map((x) => {
            const on =
              x.nature === 'ambiance'
                ? audio?.sonId === x.id && !!audio?.playing
                : x.nature === 'nappe'
                  ? !!regie?.nappes.some((n) => n.sonId === x.id && n.on)
                  : false
            return <Tuile key={x.id} son={x} on={on} sous={on ? (x.nature === 'ambiance' ? 'en cours' : 'tourne') : x.planche || NATURES_SON[x.nature].label} />
          })}
        </div>
        {!montres.length ? <span className="spx-rien">{mot ? 'Rien ne correspond.' : 'Rien d’autre dans cette séance.'}</span> : null}
      </div>
    </section>
  )
}

/**
 * Une tuile de son : un clic le fait entendre selon sa nature — l'ambiance
 * vient en fondu, la nappe s'allume ou s'éteint, le bruitage part une fois.
 */
function Tuile({ son, sous, on }: { son: Son; sous: string; on: boolean }): JSX.Element {
  const [part, setPart] = useState(0)
  const jouer = (): void => {
    if (son.nature === 'ambiance') void window.jdr.regieSon.ambiance(son.id)
    else if (son.nature === 'nappe') void (on ? window.jdr.regieSon.retirerNappe(son.id) : window.jdr.regieSon.nappe(son.id))
    else {
      void window.jdr.regieSon.jouer(son.id)
      setPart((n) => n + 1)
    }
  }
  return (
    <button
      key={part}
      className={`spx-tuile n-${son.nature}${on ? ' on' : ''}${part ? ' part' : ''}`}
      {...viser({ son: son.id })}
      title={`${son.nom}${son.touche ? ` — touche ${son.touche}` : ''} · ${
        son.nature === 'ambiance' ? 'faire venir en fondu' : son.nature === 'nappe' ? (on ? 'couper' : 'lancer en boucle') : 'jouer une fois'
      }${son.vibration ? ' · fait vibrer les téléphones' : ''}`}
      onClick={jouer}
    >
      {son.touche ? <kbd>{son.touche}</kbd> : null}
      <span className="emo">{emojiDe(son)}</span>
      <span className="nm">{son.nom || 'Sans nom'}</span>
      <span className="ou">
        {son.vibration ? <IconVibre /> : null}
        {sous}
      </span>
    </button>
  )
}
