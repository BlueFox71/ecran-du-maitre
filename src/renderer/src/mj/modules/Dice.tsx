import { useEffect, useMemo, useRef, useState } from 'react'
import { itemById, useStore } from '../store'
import {
  IconBalance,
  IconCheck,
  IconChute,
  IconCible,
  IconCrane,
  IconDie,
  IconEtoile,
  IconCopier,
  IconImage,
  IconPeople,
  IconScreen,
  IconRecommencer,
  IconRotate,
  IconSliders,
  IconTrash,
  IconTrefle,
  IconTrophee
} from '../components/Icons'
import { initials } from './Sheets'
import { FACES, joueursDuJet, useSaisieJet, VALEURS } from './jet'
import type { Character, Roll, StatsEcran, VisageStats } from '@shared/types'
import { signe } from '@shared/jet'
import { heureLocale } from '@shared/heure'

/**
 * Jets de dés — **un journal, pas un dé**. Les joueurs lancent leurs propres dés
 * à la table ; l'application note ce qu'ils annoncent. Qui, sur quoi, combien,
 * et on enregistre.
 */
export function Dice(): JSX.Element {
  const s = useStore()
  const [freshId, setFreshId] = useState<number | null>(null)
  const [panneau, setPanneau] = useState<'journal' | 'stats'>('journal')
  const lastCount = useRef(s.rolls.length)

  /* La saisie elle-même vit dans un crochet : le rail en tient une seconde,
     en petit, sans que les deux se marchent dessus. */
  const {
    perso,
    charId,
    setCharId,
    caracs,
    caracKey,
    setCaracKey,
    carac,
    bonusDe,
    bonus,
    lignes,
    valeur,
    setValeur,
    pret,
    enregistrer
  } = useSaisieJet()

  useEffect(() => {
    if (s.rolls.length > lastCount.current && s.rolls[0]) setFreshId(s.rolls[0].id)
    lastCount.current = s.rolls.length
  }, [s.rolls])

  const jeter = async (id: number): Promise<void> => {
    await window.jdr.rolls.trash(id)
    await s.refreshRolls()
  }

  const joueurs = joueursDuJet(s.characters)

  return (
    <section className="view">
      <div className="vhead">
        <div>
          <h2>Jets de dés</h2>
          <p>
            Les joueurs lancent, on note. Qui, sur quoi, la valeur annoncée — puis
            «&nbsp;Enregistrer&nbsp;».
          </p>
        </div>
        <div className="spacer" />
        <button
          className="btn btn-ghost btn-sm"
          onClick={async () => {
            const p = await window.jdr.rolls.exportCsv()
            if (p) s.toast(`Exporté vers ${p.split(/[\\/]/).pop()}`)
          }}
          disabled={s.rolls.length === 0}
        >
          Exporter en CSV
        </button>
        <button
          className="btn btn-ghost btn-sm btn-danger"
          disabled={s.rolls.length === 0 && s.rollTrash.length === 0}
          onClick={async () => {
            if (!confirm('Effacer tous les jets de cette séance, corbeille comprise ?')) return
            await window.jdr.rolls.clear()
            await s.refreshRolls()
            s.toast('Journal des jets vidé')
          }}
        >
          <IconTrash />
          Vider
        </button>
      </div>

      {joueurs.length === 0 ? (
        <div className="card saisie-bar saisie-vide">
          Aucun joueur présent. Crée les fiches dans le module «&nbsp;Fiches&nbsp;», ou coche les présents de la séance.
        </div>
      ) : (
        <div className="card saisie-bar">
          <div className="bloc">
            <span className="eyebrow">Joueur</span>
            <div className="choix-lig" role="radiogroup" aria-label="Joueur">
              {joueurs.map((c) => (
                <label key={c.id} className="opt">
                  <input
                    type="radio"
                    name="jet-joueur"
                    checked={c.id === charId}
                    onChange={() => setCharId(c.id)}
                  />
                  <span className={`pip teinte c-${c.color ?? 'neutral'}`} />
                  <span className="t">{c.player?.trim() || c.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="bloc bloc-carac">
            <span className="eyebrow">Caractéristique</span>
            {caracs.length === 0 ? (
              <p className="rien">Ce gabarit n'a aucune caractéristique à quoi rapporter un jet.</p>
            ) : (
              <div className="choix-lig choix-carac" role="radiogroup" aria-label="Caractéristique">
                {caracs.map((x) => (
                  <label key={x.key} className="opt">
                    <input
                      type="radio"
                      name="jet-carac"
                      checked={x.key === caracKey}
                      onChange={() => setCaracKey(x.key)}
                    />
                    <span className="t">{x.label}</span>
                    <b className="v">{signe(bonusDe(x.key))}</b>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="bloc bloc-de">
            <span className="eyebrow">Valeur du dé</span>
            <div className="des" role="radiogroup" aria-label="Valeur du dé">
              {VALEURS.map((v) => (
                <button
                  key={v}
                  className={`de${v === valeur ? ' de-on' : ''}`}
                  role="radio"
                  aria-checked={v === valeur}
                  onClick={() => setValeur(v === valeur ? null : v)}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="bloc bloc-fin">
            <p className="apercu">
              {pret ? (
                <>
                  <b>{perso!.player?.trim() || perso!.name}</b> · {carac!.label}
                  <br />
                  <span className="som">
                    {valeur} {signe(bonus)} = <b>{valeur! + bonus}</b>
                  </span>
                  {lignes.length ? (
                    <span className="dont">
                      dont {lignes.map((l) => `${signe(l.valeur)} ${l.raison}`).join(', ')}
                    </span>
                  ) : null}
                </>
              ) : (
                <span className="pt">Joueur, caractéristique, valeur du dé.</span>
              )}
            </p>
            <button className="btn btn-c" disabled={!pret} onClick={() => void enregistrer()}>
              Enregistrer le jet
            </button>
          </div>
        </div>
      )}

      <div className="dice">
        <div className="card dice-card">
          {panneau === 'stats' ? (
            <Statistiques
              rolls={s.rolls}
              characters={s.characters}
              reussite={s.rollStats.judged ? { taux: s.rollStats.rate, juges: s.rollStats.judged } : null}
            />
          ) : s.rolls.length === 0 ? (
            <div className="empty">
              <b>Aucun jet pour cette séance</b>
              Note le premier depuis la barre du dessus.
            </div>
          ) : (
            <div className="dice-scroll">
              <table className="roll-table">
                <thead>
                  <tr>
                    <th>Heure</th>
                    <th>Joueur</th>
                    <th>Jet</th>
                    <th>Dé</th>
                    <th>Total</th>
                    <th aria-label="Supprimer" />
                  </tr>
                </thead>
                <tbody>
                  {s.rolls.map((r) => (
                    <RollRow key={r.id} r={r} fresh={r.id === freshId} onTrash={() => void jeter(r.id)} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="side">
          <div className="card roller">
            <div className="bascule" role="radiogroup" aria-label="Panneau">
              <button
                className={panneau === 'journal' ? 'on' : ''}
                aria-pressed={panneau === 'journal'}
                onClick={() => setPanneau('journal')}
              >
                Journal
              </button>
              <button
                className={panneau === 'stats' ? 'on' : ''}
                aria-pressed={panneau === 'stats'}
                onClick={() => setPanneau('stats')}
              >
                Statistiques
              </button>
            </div>
            <div className="stat-strip">
              <div>
                <b>{s.rollStats.total}</b>
                <span>jets</span>
              </div>
              <div>
                <b>{s.rollStats.judged ? `${s.rollStats.rate}%` : '—'}</b>
                <span>réussite</span>
              </div>
              <div>
                <b>{s.rollStats.fumble}</b>
                <span>maladresses</span>
              </div>
            </div>
          </div>

          <Corbeille />
        </aside>
      </div>
    </section>
  )
}

/* ============================================================
   La corbeille
   ============================================================ */

/**
 * Les vingt dernières lignes retirées du journal, la plus fraîche en tête.
 * Supprimer sans filet, à une table où l'on note vite, c'est la faute qu'on ne
 * peut pas réparer — ici on rend la ligne à sa place, à son heure.
 */
function Corbeille(): JSX.Element {
  const s = useStore()
  const rendre = async (id: number): Promise<void> => {
    await window.jdr.rolls.restore(id)
    await s.refreshRolls()
  }

  return (
    <div className="card roller corbeille">
      <h4>
        Corbeille
        {s.rollTrash.length > 0 ? <span className="ct">{s.rollTrash.length}</span> : null}
      </h4>
      {s.rollTrash.length === 0 ? (
        <p className="rien">Rien de supprimé. Les vingt dernières lignes jetées attendent ici.</p>
      ) : (
        <>
          <div className="jetes">
            {s.rollTrash.map((r) => (
              <div className={`jete c-${r.characterColor ?? 'neutral'}`} key={r.id}>
                <span className="h">{heureLocale(r.at)}</span>
                <span className="t">
                  {r.playerName?.trim() || r.characterName || 'MJ'} · {r.label}
                </span>
                <b className="n">{r.result}</b>
                <button
                  className="btn btn-ghost btn-sm btn-ico"
                  title="Rendre ce jet au journal"
                  aria-label={`Rendre au journal le jet ${r.label}`}
                  onClick={() => void rendre(r.id)}
                >
                  <IconRotate />
                </button>
              </div>
            ))}
          </div>
          <button
            className="btn btn-ghost btn-sm btn-danger"
            onClick={async () => {
              if (!confirm(`Effacer définitivement ${s.rollTrash.length} jet(s) de la corbeille ?`))
                return
              await window.jdr.rolls.emptyTrash()
              await s.refreshRolls()
            }}
          >
            Vider la corbeille
          </button>
        </>
      )}
    </div>
  )
}

/* ============================================================
   Statistiques de la séance
   ============================================================ */

/**
 * Ce que mesurent les statistiques : le dé seul (la chance), ou le total avec
 * le modificateur de la caractéristique (ce que le joueur a vraiment fait).
 */
type Mesure = 'de' | 'total'

/** Le dé espéré d'un d20 honnête : (1 + 20) / 2. */
const ATTENDU = (FACES + 1) / 2

/** Un jet de d20 relu : son dé nu, son total, son bonus. */
interface JetLu {
  de: number
  total: number
  bonus: number
  qui: string
  characterId: number | null
  carac: string
  at: string
}

/** Les jets en d20 seulement : les seuls dont on sache retrouver le dé nu. */
function jetsLus(rolls: Roll[]): JetLu[] {
  const out: JetLu[] = []
  for (const r of rolls) {
    if (r.formula !== '1d20') continue
    const bonus = r.target ?? 0
    const de = r.result - bonus
    if (de < 1 || de > FACES) continue
    out.push({
      de,
      total: r.result,
      bonus,
      qui: r.playerName?.trim() || r.characterName || 'MJ',
      characterId: r.characterId,
      carac: r.label,
      at: r.at
    })
  }
  return out
}

const valeurDe = (j: JetLu, m: Mesure): number => (m === 'de' ? j.de : j.total)
const moyenneDe = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / (xs.length || 1)

/** L'axe des valeurs : 1 à 20 pour le dé ; pour le total, assez large pour tout tenir. */
interface Axe {
  min: number
  max: number
}

/** Combien de fois chaque valeur de l'axe est sortie, et la plus fréquente (la plus haute à égalité). */
function compter(valeurs: number[], axe: Axe): { comptes: number[]; mode: number; modeN: number } {
  const comptes = Array.from({ length: axe.max - axe.min + 1 }, () => 0)
  for (const x of valeurs) comptes[x - axe.min]++
  let k = 0
  comptes.forEach((n, i) => {
    if (n >= comptes[k]) k = i
  })
  return { comptes, mode: axe.min + k, modeN: comptes[k] }
}

interface LigneStat {
  id: number
  nom: string
  /** Son personnage, quand le joueur a un nom à lui. */
  perso: string | null
  color: string
  n: number
  /** Les valeurs mesurées — dé seul ou total, selon la mesure. */
  valeurs: number[]
  moyenne: number
  /** Ce qu'un dé honnête lui aurait donné en moyenne : 10,5, plus son bonus moyen avec le modificateur. */
  attendu: number
  mode: number
  modeN: number
  /** Le cumul des totaux réellement obtenus — dé + caractéristique. */
  score: number
  /** Les coups du sort se lisent toujours sur le dé nu. */
  critiques: number
  maladresses: number
}

/** Les jets de la séance, relus par joueur, selon la mesure choisie. */
function statsParJoueur(jets: JetLu[], characters: Character[], m: Mesure, axe: Axe): LigneStat[] {
  const lignes: LigneStat[] = []
  for (const c of characters) {
    const siens = jets.filter((j) => j.characterId === c.id)
    if (siens.length === 0) continue
    const valeurs = siens.map((j) => valeurDe(j, m))
    const { mode, modeN } = compter(valeurs, axe)
    const joueur = c.player?.trim()
    lignes.push({
      id: c.id,
      nom: joueur || c.name,
      perso: joueur ? c.name : null,
      color: c.color ?? 'neutral',
      n: siens.length,
      valeurs,
      moyenne: moyenneDe(valeurs),
      attendu: ATTENDU + (m === 'total' ? moyenneDe(siens.map((j) => j.bonus)) : 0),
      mode,
      modeN,
      score: siens.reduce((a, j) => a + j.total, 0),
      critiques: siens.filter((j) => j.de === FACES).length,
      maladresses: siens.filter((j) => j.de === 1).length
    })
  }
  return lignes
}

function Statistiques({
  rolls,
  characters,
  reussite
}: {
  rolls: Roll[]
  characters: Character[]
  reussite: { taux: number; juges: number } | null
}): JSX.Element {
  /* Avec le modificateur d'abord : c'est ce que les jets ont vraiment donné. */
  const [mesure, setMesure] = useState<Mesure>('total')
  const toast = useStore((x) => x.toast)
  const page = useRef<HTMLDivElement>(null)
  const [exportEnCours, setExportEnCours] = useState<'copier' | 'exporter' | null>(null)

  /**
   * La page en image : elle défile plus loin que l'écran, on la capture donc
   * par tranches — en la faisant défiler —, puis on recolle les tranches sur
   * une toile. Le bouton d'export et les bulles de survol se cachent le temps
   * de la prise (`.st-capture`).
   */
  const exporter = async (geste: 'copier' | 'exporter'): Promise<void> => {
    const el = page.current
    if (!el || exportEnCours) return
    setExportEnCours(geste)
    const avant = el.scrollTop
    el.classList.add('st-capture')
    /* La page revient en place dès les tranches prises, sans attendre
       l'assemblage : sinon elle reste figée en bas le temps de l'encodage. */
    let rendue = false
    const rendre = (): void => {
      if (rendue) return
      rendue = true
      el.classList.remove('st-capture')
      el.scrollTop = avant
    }
    try {
      const r = el.getBoundingClientRect()
      const largeur = el.clientWidth
      const vue = el.clientHeight
      const total = el.scrollHeight
      const fond = getComputedStyle(el).backgroundColor || '#0f1518'
      const tranches: { y: number; png: Uint8Array }[] = []
      for (let y = 0; y < total; y += vue) {
        el.scrollTop = y
        /* Deux images pour que le défilement soit peint avant la prise. */
        await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)))
        tranches.push({
          y: el.scrollTop,
          png: await window.jdr.app.capturerZone({ x: r.left, y: r.top, width: largeur, height: vue })
        })
      }
      rendre()
      /* Décodage hors du fil de l'interface. */
      const images = await Promise.all(
        tranches.map(async (t) => ({
          y: t.y,
          img: await createImageBitmap(new Blob([t.png as Uint8Array<ArrayBuffer>], { type: 'image/png' }))
        }))
      )
      /* L'échelle de la capture (zoom de la fenêtre, écran haute densité). */
      const k = images[0].img.width / largeur
      const toile = document.createElement('canvas')
      toile.width = Math.round(largeur * k)
      toile.height = Math.round(total * k)
      const ctx = toile.getContext('2d')!
      ctx.fillStyle = fond
      ctx.fillRect(0, 0, toile.width, toile.height)
      for (const { y, img } of images) {
        ctx.drawImage(img, 0, Math.round(y * k))
        img.close()
      }
      /* toBlob encode sans bloquer l'interface, au contraire de toDataURL. */
      const blob = await new Promise<Blob>((ok, ko) =>
        toile.toBlob((b) => (b ? ok(b) : ko(new Error('toile vide'))), 'image/png')
      )
      const png = new Uint8Array(await blob.arrayBuffer())
      if (geste === 'copier') {
        await window.jdr.rolls.copierImage(png)
        toast('Statistiques copiées — colle-les où tu veux.')
      } else {
        const chemin = await window.jdr.rolls.exportImage(png)
        if (chemin) toast(`Exporté vers ${chemin.split(/[\\/]/).pop()}`)
      }
    } catch (e) {
      console.error('[statistiques] export', e)
      toast('L’image n’a pas pu être faite.', true)
    } finally {
      rendre()
      setExportEnCours(null)
    }
  }

  const jets = useMemo(() => jetsLus(rolls), [rolls])
  const v = useMemo(() => seanceDe(jets, mesure), [jets, mesure])
  const lignes = useMemo(
    () => (v ? statsParJoueur(jets, characters, mesure, v.axe) : []),
    [jets, characters, mesure, v]
  )

  /* Les chiffres tels qu'on les montre à la table — à l'écran ou sur les téléphones. */
  const pourLaTable = (): StatsEcran | null => {
    if (!v) return null
    const st = useStore.getState()
    return statsPourEcran(
      v,
      lignes,
      reussite,
      characters,
      (c) => itemById(st.allItems, c.portraitItemId)?.url ?? null,
      st.session?.label ?? null
    )
  }

  /* Les joueurs peuvent-ils les enregistrer en image sur leur téléphone ? La
     même case qu'à la fin de la présentation : le poste s'en souvient. */
  const [partage, setPartage] = useState(false)
  useEffect(() => {
    void window.jdr.mobile.statsPartagees().then(setPartage)
  }, [])
  const basculerPartage = async (): Promise<void> => {
    const stats = partage ? null : pourLaTable()
    if (!partage && !stats) return
    const oui = await window.jdr.mobile.partagerStats(stats)
    setPartage(oui)
    toast(
      oui
        ? 'Les joueurs peuvent enregistrer ces statistiques — onglet Jet de leur téléphone.'
        : 'Les statistiques ne sont plus enregistrables par les joueurs.'
    )
  }

  /* Sur l'écran des joueurs, étape par étape : le pupitre du MJ prend la suite. */
  const presenter = (): void => {
    const stats = pourLaTable()
    if (!stats) return
    const st = useStore.getState()
    void window.jdr.display.show({ type: 'statistiques', etape: 0, anime: true, stats })
    /* On présente depuis le Paravent : c'est là qu'on tient la soirée. */
    st.setView('pupitre')
    if (!st.display?.playerOpen) toast('Présentation lancée — la fenêtre des joueurs est fermée (F5 pour l’ouvrir).')
  }
  if (!v) {
    return (
      <div className="empty">
        <b>Rien à mesurer</b>
        Note quelques jets de d20 : moyennes, valeurs fétiches et scores apparaîtront ici.
      </div>
    )
  }
  const quoi = mesure === 'de' ? 'des faces' : 'des totaux'
  return (
    <div className="dice-scroll st" ref={page}>
      <Titre
        v={v}
        mesure={mesure}
        onMesure={setMesure}
        onImage={(g) => void exporter(g)}
        enCours={exportEnCours}
        onPresenter={presenter}
        partage={partage}
        onPartage={() => void basculerPartage()}
      />
      <Bandeau v={v} reussite={reussite} />
      <div className="st-cols">
        <section className="st-carte st-repartition">
          <EnTete
            n="01"
            titre={mesure === 'de' ? 'Les faces' : 'Les totaux'}
            note={`la répartition ${quoi} de ${v.n} jets de d20`}
          />
          <Histogramme v={v} />
          <Tranches v={v} />
        </section>
        <section className="st-carte st-faits">
          <EnTete n="02" titre="Les faits" note="ce qu’on retiendra" />
          <Faits v={v} />
        </section>
      </div>
      {lignes.length ? (
        <section className="st-section">
          <EnTete
            n="03"
            titre="Les joueurs"
            note={`chacun sa répartition ${quoi}, à la même échelle — de la meilleure moyenne à la moins bonne`}
          />
          <CartesJoueurs lignes={lignes} axe={v.axe} mesure={mesure} />
        </section>
      ) : null}
    </div>
  )
}

/** Le grand titre, la soirée dite en une phrase, et le choix de la mesure. */
function Titre({
  v,
  mesure,
  onMesure,
  onImage,
  enCours,
  onPresenter,
  partage,
  onPartage
}: {
  v: Seance
  mesure: Mesure
  onMesure: (m: Mesure) => void
  onImage: (geste: 'copier' | 'exporter') => void
  enCours: 'copier' | 'exporter' | null
  onPresenter: () => void
  partage: boolean
  onPartage: () => void
}): JSX.Element {
  const ecart = v.moyenne - v.attendu
  const humeur =
    Math.abs(ecart) < 0.5 ? 'un dé dans la norme' : ecart > 0 ? 'un dé plutôt chaud' : 'un dé plutôt froid'
  return (
    <header className="st-titre">
      <div className="st-titre-haut">
        <span className="st-sur">Statistiques de la séance</span>
        {/* Dé seul : la chance. Avec le modificateur : ce que le joueur a vraiment fait. */}
        <div className="seg-fiche st-mesure" role="radiogroup" aria-label="Ce qu’on mesure">
          {(
            [
              ['de', 'Dé seul', 'La valeur du dé, sans la caractéristique : la chance pure'],
              ['total', 'Avec modificateur', 'Le total — dé + caractéristique : ce que le jet a vraiment donné']
            ] as const
          ).map(([k, l, aide]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={mesure === k}
              className={mesure === k ? 'on' : ''}
              title={aide}
              onClick={() => onMesure(k)}
            >
              {l}
            </button>
          ))}
        </div>
        <span className="st-exporter">
          <button
            type="button"
            className="btn btn-sm btn-brass"
            disabled={enCours !== null}
            title="Montrer ces statistiques sur l’écran des joueurs, partie par partie"
            onClick={onPresenter}
          >
            <IconScreen />
            Présentation à l’écran
          </button>
          <button
            type="button"
            className="btn btn-sm"
            disabled={enCours !== null}
            title="Copier ces statistiques en image, à coller dans un message"
            onClick={() => onImage('copier')}
          >
            <IconCopier />
            {enCours === 'copier' ? 'Capture…' : 'Copier l’image'}
          </button>
          <button
            type="button"
            className="btn btn-sm"
            disabled={enCours !== null}
            title="Enregistrer ces statistiques en image PNG"
            onClick={() => onImage('exporter')}
          >
            <IconImage />
            {enCours === 'exporter' ? 'Capture…' : 'Exporter en image'}
          </button>
          {/* Le partage est un instantané : recocher après de nouveaux jets
              ou un changement de mesure pour envoyer les chiffres à jour. */}
          <label
            className="coche st-partage"
            title="Sur leur téléphone (onglet Jet), chaque joueur pourra enregistrer en image les statistiques du groupe et les siennes — les chiffres de cet instant"
          >
            <input type="checkbox" checked={partage} onChange={onPartage} />
            <span>Enregistrables par les joueurs</span>
          </label>
        </span>
      </div>
      <h3 className="display">La soirée en dés</h3>
      <p>
        <b>{v.n} jets</b>, {humeur} (<b>{v.moyenne.toFixed(1)}</b> de moyenne{' '}
        {mesure === 'de' ? 'au dé' : 'au total'}, {v.attendu.toFixed(1)} attendu),{' '}
        <b className="or">
          {v.critiques} coup{v.critiques > 1 ? 's' : ''} de génie
        </b>{' '}
        pour{' '}
        <b className="sang">
          {v.maladresses} maladresse{v.maladresses > 1 ? 's' : ''}
        </b>
        .{v.chanceux ? (
          <>
            {' '}
            La chance a souri à <b>{v.chanceux.qui}</b>.
          </>
        ) : null}
      </p>
    </header>
  )
}

function EnTete({ n, titre, note }: { n: string; titre: string; note?: string }): JSX.Element {
  return (
    <header className="st-tete">
      <span className="st-num display">{n}</span>
      <h4 className="display">{titre}</h4>
      {note ? <span className="st-note">{note}</span> : null}
    </header>
  )
}

/* ============================================================
   La séance d'un coup d'œil
   ============================================================ */

interface Seance {
  mesure: Mesure
  n: number
  axe: Axe
  /** Les valeurs mesurées, et leur compte sur l'axe : `comptes[x - axe.min]`. */
  valeurs: number[]
  comptes: number[]
  moyenne: number
  attendu: number
  mode: number
  modeN: number
  mediane: number
  /** Toujours sur le dé nu : les 20 et les 1, les jets hauts (15+) et bas (5−). */
  critiques: number
  maladresses: number
  hauts: number
  bas: number
  /** Le plus haut total — dé + caractéristique — et qui l'a fait. */
  meilleur: { total: number; qui: string } | null
  /** Le plus bas, de même. */
  pire: { total: number; qui: string } | null
  /** Celui dont le dé nu fait la meilleure moyenne — trois jets au moins. */
  chanceux: { qui: string; moyenne: number } | null
  /** Celui qui a le plus jeté. */
  actif: { qui: string; n: number } | null
  /** La caractéristique la plus sollicitée. */
  carac: { nom: string; n: number } | null
  /** Jets par heure, du premier au dernier — null sur moins de dix minutes. */
  rythme: number | null
}

function seanceDe(jets: JetLu[], m: Mesure): Seance | null {
  if (jets.length === 0) return null
  const valeurs = jets.map((j) => valeurDe(j, m))
  const axe: Axe =
    m === 'de' ? { min: 1, max: FACES } : { min: Math.min(1, ...valeurs), max: Math.max(FACES, ...valeurs) }
  const { comptes, mode, modeN } = compter(valeurs, axe)

  const tries = [...valeurs].sort((x, y) => x - y)
  const mi = tries.length >> 1
  const mediane = tries.length % 2 ? tries[mi] : (tries[mi - 1] + tries[mi]) / 2

  let meilleur: Seance['meilleur'] = null
  let pire: Seance['pire'] = null
  const parQui = new Map<string, number[]>()
  const parCarac = new Map<string, number>()
  const instants: number[] = []
  for (const j of jets) {
    if (!meilleur || j.total > meilleur.total) meilleur = { total: j.total, qui: j.qui }
    if (!pire || j.total < pire.total) pire = { total: j.total, qui: j.qui }
    parQui.set(j.qui, [...(parQui.get(j.qui) ?? []), j.de])
    parCarac.set(j.carac, (parCarac.get(j.carac) ?? 0) + 1)
    const t = Date.parse(j.at.replace(' ', 'T'))
    if (Number.isFinite(t)) instants.push(t)
  }
  /* La chance se lit au dé nu, quelle que soit la mesure. */
  let chanceux: Seance['chanceux'] = null
  let actif: Seance['actif'] = null
  for (const [qui, des] of parQui) {
    const moy = moyenneDe(des)
    if (des.length >= 3 && (!chanceux || moy > chanceux.moyenne)) chanceux = { qui, moyenne: moy }
    if (!actif || des.length > actif.n) actif = { qui, n: des.length }
  }
  let carac: Seance['carac'] = null
  for (const [nom, n] of parCarac) if (!carac || n > carac.n) carac = { nom, n }

  const duree = instants.length > 1 ? (Math.max(...instants) - Math.min(...instants)) / 3600000 : 0
  return {
    mesure: m,
    n: jets.length,
    axe,
    valeurs,
    comptes,
    moyenne: moyenneDe(valeurs),
    attendu: ATTENDU + (m === 'total' ? moyenneDe(jets.map((j) => j.bonus)) : 0),
    mode,
    modeN,
    mediane,
    critiques: jets.filter((j) => j.de === FACES).length,
    maladresses: jets.filter((j) => j.de === 1).length,
    hauts: jets.filter((j) => j.de >= 15).length,
    bas: jets.filter((j) => j.de <= 5).length,
    meilleur,
    pire,
    chanceux,
    actif,
    carac,
    rythme: duree >= 1 / 6 ? jets.length / duree : null
  }
}

/* ---------------- le bandeau : quatre chiffres, chacun son repère ---------------- */

/**
 * Ce qu'on veut savoir d'abord, en grand : combien de jets, si le dé est
 * chaud ou froid, combien réussissent, et les coups du sort. Chaque chiffre
 * a son repère dessiné — on lit la jauge avant le nombre.
 */
function Bandeau({
  v,
  reussite
}: {
  v: Seance
  reussite: { taux: number; juges: number } | null
}): JSX.Element {
  const ecart = v.moyenne - v.attendu
  /* Sous un demi-point d'écart, le dé est dans la norme : ni chaud ni froid. */
  const humeur = Math.abs(ecart) < 0.5 ? 'dans la norme' : ecart > 0 ? 'dé chaud' : 'dé froid'
  const pos = (x: number): string => `${((x - v.axe.min) / (v.axe.max - v.axe.min)) * 100}%`
  return (
    <div className="st-bandeau">
      <div className="st-chiffre">
        <span className="st-ic">
          <IconDie />
        </span>
        <span className="st-lib">Jets de d20</span>
        <b className="st-gros display">{v.n}</b>
        <span className="st-sous">
          {v.rythme === null ? 'séance trop courte pour un rythme' : `${v.rythme.toFixed(0)} par heure`}
        </span>
      </div>

      <div className="st-chiffre">
        <span className="st-ic">
          <IconCible />
        </span>
        <span className="st-lib">{v.mesure === 'de' ? 'Moyenne du dé' : 'Moyenne du total'}</span>
        <b className="st-gros display">{v.moyenne.toFixed(1)}</b>
        {/* La jauge sur l'axe : l'attendu en trait, la moyenne en pastille. */}
        <span className="st-jauge" aria-hidden="true">
          <span className="st-jauge-attendu" style={{ left: pos(v.attendu) }} />
          <span className="st-jauge-point" style={{ left: pos(v.moyenne) }} />
        </span>
        <span className={`st-sous${humeur === 'dans la norme' ? '' : ecart > 0 ? ' chaud' : ' froid'}`}>
          {humeur} · {ecart >= 0 ? '+' : '−'}
          {Math.abs(ecart).toFixed(1)} sur {v.attendu.toFixed(1)}
        </span>
      </div>

      <div className="st-chiffre">
        <span className="st-ic">
          <IconCheck />
        </span>
        <span className="st-lib">Réussite</span>
        <b className="st-gros display">{reussite ? `${reussite.taux} %` : '—'}</b>
        <span className="st-jauge plein" aria-hidden="true">
          <span className="st-jauge-rempli" style={{ width: `${reussite?.taux ?? 0}%` }} />
        </span>
        <span className="st-sous">
          {reussite ? `sur ${reussite.juges} jet${reussite.juges > 1 ? 's' : ''} jugé${reussite.juges > 1 ? 's' : ''}` : 'aucun jet jugé'}
        </span>
      </div>

      <div className="st-chiffre st-sort">
        <span className="st-ic">
          <IconEtoile />
        </span>
        <span className="st-lib">Coups du sort</span>
        <span className="st-duo">
          <span className="st-duo-c">
            <b className="st-gros display">{v.critiques}</b>
            <span className="st-tag or">
              <IconEtoile /> 20 naturels
            </span>
          </span>
          <span className="st-duo-c">
            <b className="st-gros display">{v.maladresses}</b>
            <span className="st-tag sang">
              <IconCrane /> 1 naturels
            </span>
          </span>
        </span>
        <span className="st-sous">un dé honnête : {(v.n / FACES).toFixed(1)} de chaque</span>
      </div>
    </div>
  )
}

/* ---------------- l'histogramme ---------------- */

/**
 * Une barre par valeur de l'axe. Au dé seul, le 20 en or et le 1 en rouge —
 * l'axe les nomme aussi — ; des lignes de repère discrètes, la moyenne en trait
 * plein, un dé honnête en pointillés (au dé seul : au total, il n'a pas de
 * sens face par face). Au survol, la valeur et son compte.
 */
function Histogramme({ v }: { v: Seance }): JSX.Element {
  const [survol, setSurvol] = useState<number | null>(null)
  const nb = v.comptes.length
  const auDe = v.mesure === 'de'
  const haut = Math.max(...v.comptes, auDe ? v.n / FACES : 0, 1)
  /* Des repères ronds : 2, 5 ou 10 en 10, selon la hauteur. */
  const pas = haut <= 6 ? 2 : haut <= 15 ? 5 : 10
  const reperes = Array.from({ length: Math.floor(haut / pas) }, (_, i) => (i + 1) * pas)
  const pct = (x: number): string => `${Math.round((x / v.n) * 100)} %`
  const gauche = (x: number): string => `${((x - v.axe.min + 0.5) / nb) * 100}%`
  /* Sur un axe long, une étiquette sur deux. */
  const montre = (x: number): boolean => nb <= 22 || x % 2 === 0

  return (
    <figure className="hg">
      <div
        className="hg-plan"
        style={{ gridTemplateColumns: `repeat(${nb}, 1fr)` }}
        onMouseLeave={() => setSurvol(null)}
      >
        {reperes.map((r) => (
          <span key={r} className="hg-repere" style={{ bottom: `${(r / haut) * 100}%` }}>
            <em className="num">{r}</em>
          </span>
        ))}
        {auDe ? (
          <span className="hg-attendu" style={{ bottom: `${(v.n / FACES / haut) * 100}%` }}>
            <em>dé honnête</em>
          </span>
        ) : null}
        <span className="hg-moyenne" style={{ left: gauche(v.moyenne) }}>
          <em>moyenne {v.moyenne.toFixed(1)}</em>
        </span>
        {v.comptes.map((c, i) => {
          const x = v.axe.min + i
          const ton = auDe && x === FACES ? ' or' : auDe && x === 1 ? ' sang' : ''
          return (
            <button
              key={x}
              type="button"
              className={`hg-col${ton}${survol === x ? ' on' : ''}${x === v.mode ? ' mode' : ''}`}
              onMouseEnter={() => setSurvol(x)}
              onFocus={() => setSurvol(x)}
              aria-label={`${auDe ? 'Face' : 'Total'} ${x} : ${c} fois`}
            >
              <span className="hg-barre" style={{ height: c ? `${(c / haut) * 100}%` : 0 }} />
            </button>
          )
        })}
        {/* Une annotation sur la valeur la plus sortie, comme dans une infographie. */}
        {v.modeN ? (
          <span className="hg-note" style={{ left: gauche(v.mode), bottom: `${(v.modeN / haut) * 100}%` }}>
            le {v.mode}, sorti {v.modeN} fois
          </span>
        ) : null}
        {survol !== null ? (
          <span className="hg-bulle" style={{ left: gauche(survol) }} role="status">
            <b>
              {auDe ? 'Face' : 'Total'} {survol}
            </b>
            <span>
              {v.comptes[survol - v.axe.min]} fois · {pct(v.comptes[survol - v.axe.min])}
            </span>
          </span>
        ) : null}
      </div>
      <div className="hg-axe num" style={{ gridTemplateColumns: `repeat(${nb}, 1fr)` }} aria-hidden="true">
        {v.comptes.map((_, i) => {
          const x = v.axe.min + i
          return (
            <span key={x} className={auDe && x === 1 ? 'sang' : auDe && x === FACES ? 'or' : undefined}>
              {montre(x) ? x : ''}
            </span>
          )
        })}
      </div>
    </figure>
  )
}

/** Bas, milieu, haut — sur le dé nu : une seule barre partagée en trois, et ses parts écrites. */
function Tranches({ v }: { v: Seance }): JSX.Element {
  const milieu = v.n - v.bas - v.hauts
  const parts: [string, string, number][] = [
    ['bas', '1 à 5', v.bas],
    ['milieu', '6 à 14', milieu],
    ['haut', '15 à 20', v.hauts]
  ]
  return (
    <div className="tr">
      <div className="tr-barre" role="img" aria-label={parts.map(([, l, x]) => `${l} : ${x}`).join(', ')}>
        {parts.map(([k, , x]) => (x ? <span key={k} className={`tr-${k}`} style={{ flexGrow: x }} /> : null))}
      </div>
      <div className="tr-leg">
        <span className="tr-titre">au dé seul</span>
        {parts.map(([k, l, x]) => (
          <span key={k} className="tr-item">
            <i className={`tr-${k}`} />
            <span className="tr-l">{l}</span>
            <b className="num">{Math.round((x / v.n) * 100)} %</b>
            <span className="tr-n num">{x}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

/* ---------------- les faits marquants ---------------- */

/** Une liste à lire de haut en bas : l'icône, ce que c'est, la réponse, un détail. */
function Faits({ v }: { v: Seance }): JSX.Element {
  const auDe = v.mesure === 'de'
  type Fait = [JSX.Element, string, string, string]
  const faits: Fait[] = [
    [<IconRecommencer key="r" />, auDe ? 'Valeur la plus jouée' : 'Total le plus fréquent', String(v.mode), `${v.modeN} fois`],
    [<IconBalance key="b" />, auDe ? 'Médiane du dé' : 'Médiane du total', String(v.mediane), 'la moitié des jets au-dessus'],
    ...(v.meilleur ? [[<IconTrophee key="t" />, 'Plus haut total', String(v.meilleur.total), v.meilleur.qui] as Fait] : []),
    ...(v.pire ? [[<IconChute key="c" />, 'Plus bas total', String(v.pire.total), v.pire.qui] as Fait] : []),
    ...(v.chanceux
      ? [[<IconTrefle key="f" />, 'Le plus chanceux', v.chanceux.qui, `${v.chanceux.moyenne.toFixed(1)} au dé`] as Fait]
      : []),
    ...(v.actif ? [[<IconPeople key="p" />, 'Le plus de jets', v.actif.qui, `${v.actif.n} jets`] as Fait] : []),
    ...(v.carac ? [[<IconSliders key="s" />, 'Carac la plus jetée', v.carac.nom, `${v.carac.n} jets`] as Fait] : [])
  ]
  return (
    <ul className="fm">
      {faits.map(([ic, lib, val, det]) => (
        <li key={lib}>
          <span className="fm-ic">{ic}</span>
          <span className="fm-lib">{lib}</span>
          <b className="fm-val" title={val}>
            {val}
          </b>
          <span className="fm-det" title={det}>
            {det}
          </span>
        </li>
      ))}
    </ul>
  )
}

/* ---------------- à l'écran des joueurs ---------------- */

/**
 * Les statistiques prêtes pour l'écran des joueurs : les mêmes chiffres que la
 * page, figés à l'instant du lancement, et les joueurs du dernier au meilleur
 * avec leur portrait et leurs émojis.
 */
function statsPourEcran(
  v: Seance,
  lignes: LigneStat[],
  reussite: { taux: number; juges: number } | null,
  characters: Character[],
  portraitDe: (c: Character) => string | null,
  seance: string | null
): StatsEcran {
  const ecart = v.moyenne - v.attendu
  const titres = titresDes(lignes)
  const visages = new Map<string, VisageStats>()
  for (const l of lignes) {
    const c = characters.find((x) => x.id === l.id)
    visages.set(l.nom, { nom: l.nom, url: c ? portraitDe(c) : null, color: l.color })
  }
  const visage = (qui: string): VisageStats | null => visages.get(qui) ?? null
  const auDe = v.mesure === 'de'
  const faits: StatsEcran['faits'] = [
    { icone: 'recommencer', lib: auDe ? 'Valeur la plus jouée' : 'Total le plus fréquent', val: String(v.mode), det: `${v.modeN} fois`, visage: null },
    { icone: 'balance', lib: auDe ? 'Médiane du dé' : 'Médiane du total', val: String(v.mediane), det: 'la moitié des jets au-dessus', visage: null },
    ...(v.meilleur
      ? [{ icone: 'trophee', lib: 'Plus haut total', val: String(v.meilleur.total), det: v.meilleur.qui, visage: visage(v.meilleur.qui) } as const]
      : []),
    ...(v.pire
      ? [{ icone: 'chute', lib: 'Plus bas total', val: String(v.pire.total), det: v.pire.qui, visage: visage(v.pire.qui) } as const]
      : []),
    ...(v.chanceux
      ? [{ icone: 'trefle', lib: 'Le plus chanceux', val: v.chanceux.qui, det: `${v.chanceux.moyenne.toFixed(1)} au dé`, visage: visage(v.chanceux.qui) } as const]
      : []),
    ...(v.actif
      ? [{ icone: 'people', lib: 'Le plus de jets', val: v.actif.qui, det: `${v.actif.n} jets`, visage: visage(v.actif.qui) } as const]
      : []),
    ...(v.carac ? [{ icone: 'sliders', lib: 'Carac la plus jetée', val: v.carac.nom, det: `${v.carac.n} jets`, visage: null } as const] : [])
  ]
  return {
    seance,
    mesure: v.mesure,
    humeur: Math.abs(ecart) < 0.5 ? 'norme' : ecart > 0 ? 'chaud' : 'froid',
    n: v.n,
    rythme: v.rythme,
    moyenne: v.moyenne,
    attendu: v.attendu,
    reussite,
    critiques: v.critiques,
    maladresses: v.maladresses,
    chanceux: v.chanceux?.qui ?? null,
    histo: {
      min: v.axe.min,
      comptes: v.comptes,
      mode: v.mode,
      modeN: v.modeN,
      honnete: auDe ? v.n / FACES : null
    },
    faits,
    /* Du dernier au meilleur : le suspense va jusqu'au bout. */
    joueurs: [...lignes]
      .sort((a, b) => a.moyenne - b.moyenne)
      .map((l) => {
        const c = characters.find((x) => x.id === l.id)
        return {
          id: l.id,
          nom: l.nom,
          perso: l.perso,
          url: c ? portraitDe(c) : null,
          color: l.color,
          moyenne: l.moyenne,
          attendu: l.attendu,
          titre: titres.get(l.id) ?? null,
          emojis: c?.emojis ?? [],
          comptes: compter(l.valeurs, v.axe).comptes,
          n: l.n,
          critiques: l.critiques,
          maladresses: l.maladresses
        }
      })
  }
}

/* ---------------- par joueur ---------------- */

/** Les titres qu'on se décerne à table : un seul par joueur, le plus parlant. */
function titresDes(lignes: LigneStat[]): Map<number, string | null> {
  /* Un titre ne se décerne qu'à un seul : à égalité, personne ne l'a — deux
     joueurs à trois 20 ne font pas un « roi du 20 ». */
  const seulEnTete = (f: (l: LigneStat) => number): number | null => {
    const max = Math.max(...lignes.map(f))
    const tete = lignes.filter((l) => f(l) === max)
    return max > 0 && tete.length === 1 ? tete[0].id : null
  }
  const roiDu20 = seulEnTete((l) => l.critiques)
  const abonneAu1 = seulEnTete((l) => l.maladresses)
  const bavard = seulEnTete((l) => l.n)
  /* Chaud ou froid se juge à l'écart à l'attendu — la chance du dé, même au total. */
  const parChance = [...lignes].sort((a, b) => b.moyenne - b.attendu - (a.moyenne - a.attendu))
  const plusChaud = parChance[0]?.id
  const plusFroid = parChance[parChance.length - 1]?.id
  return new Map(
    lignes.map((l) => [
      l.id,
      lignes.length > 1 && l.id === plusChaud
        ? 'Le dé le plus chaud'
        : lignes.length > 1 && l.id === plusFroid
          ? 'Le dé le plus froid'
          : l.id === roiDu20
            ? 'Le roi du 20'
            : l.id === abonneAu1
              ? 'L’abonné au 1'
              : l.id === bavard
                ? 'Le plus bavard des dés'
                : null
    ])
  )
}

/**
 * Une carte par joueur, toutes sur le même axe et à la même hauteur pour qu'on
 * les compare d'un regard : sa moyenne en grand et son verdict, sa répartition
 * à sa couleur, puis ses chiffres — jets, coups du sort, valeur fétiche,
 * score. Rangées de la meilleure moyenne à la moins bonne.
 */
function CartesJoueurs({ lignes, axe, mesure }: { lignes: LigneStat[]; axe: Axe; mesure: Mesure }): JSX.Element {
  const auDe = mesure === 'de'
  const repartitions = new Map(lignes.map((l) => [l.id, compter(l.valeurs, axe).comptes]))
  const tries = [...lignes].sort((a, b) => b.moyenne - a.moyenne)
  const haut = Math.max(...[...repartitions.values()].flat(), 1)
  const titres = titresDes(lignes)
  const milieuAxe = Math.round((axe.min + axe.max) / 2)
  return (
    <div className="cj">
      {tries.map((l) => {
        const ecart = l.moyenne - l.attendu
        const etat = Math.abs(ecart) < 0.5 ? 'norme' : ecart > 0 ? 'chaud' : 'froid'
        const titre = titres.get(l.id) ?? null
        const comptes = repartitions.get(l.id)!
        return (
          <article key={l.id} className={`cj-carte c-${l.color}`}>
            <header className="cj-tete">
              <span className="pip teinte" />
              <span className="cj-qui">
                <b>{l.nom}</b>
                {l.perso ? <span>{l.perso}</span> : null}
              </span>
              {titre ? <span className="cj-titre">{titre}</span> : null}
            </header>

            <div className="cj-moy">
              <b className="display">{l.moyenne.toFixed(1)}</b>
              <span className={`cj-etat ${etat}`} title={`Attendu : ${l.attendu.toFixed(1)}`}>
                {etat === 'norme' ? 'dans la norme' : etat === 'chaud' ? 'chaud' : 'froid'}{' '}
                {ecart >= 0 ? '+' : '−'}
                {Math.abs(ecart).toFixed(1)}
              </span>
            </div>

            {/* Sa répartition : même axe et même hauteur pour tous ; le détail au survol. */}
            <MiniHisto comptes={comptes} axe={axe} auDe={auDe} haut={haut} n={l.n} nom={l.nom} />
            <div className="cj-axe num" aria-hidden="true">
              <span className={auDe ? 'sang' : undefined}>{axe.min}</span>
              <span>{milieuAxe}</span>
              <span className={auDe ? 'or' : undefined}>{axe.max}</span>
            </div>

            <dl className="cj-chiffres">
              <div>
                <dt>Jets</dt>
                <dd className="num">{l.n}</dd>
              </div>
              <div>
                <dt>
                  <IconEtoile /> 20
                </dt>
                <dd className="num or">{l.critiques}</dd>
              </div>
              <div>
                <dt>
                  <IconCrane /> 1
                </dt>
                <dd className="num sang">{l.maladresses}</dd>
              </div>
              <div>
                <dt>Fétiche</dt>
                <dd className="num">
                  {l.mode}
                  <small>×{l.modeN}</small>
                </dd>
              </div>
              <div>
                <dt>Score</dt>
                <dd className="num">
                  {l.score}
                  <small>{Math.round(l.score / l.n)}/jet</small>
                </dd>
              </div>
            </dl>
          </article>
        )
      })}
    </div>
  )
}

/**
 * La répartition d'un joueur, en petit : une barre par valeur, à sa couleur
 * (au dé seul, le 1 en rouge et le 20 en or). Au survol, comme sur le grand
 * histogramme : la valeur, combien de fois, et la part de ses jets.
 */
function MiniHisto({
  comptes,
  axe,
  auDe,
  haut,
  n,
  nom
}: {
  comptes: number[]
  axe: Axe
  auDe: boolean
  haut: number
  n: number
  nom: string
}): JSX.Element {
  const [survol, setSurvol] = useState<number | null>(null)
  const nb = comptes.length
  return (
    <div
      className="cj-hg"
      style={{ gridTemplateColumns: `repeat(${nb}, 1fr)` }}
      aria-label={`Répartition de ${nom}`}
      onMouseLeave={() => setSurvol(null)}
    >
      {comptes.map((c, k) => {
        const x = axe.min + k
        return (
          <span
            key={x}
            className={`cj-col${auDe && x === 1 ? ' sang' : auDe && x === FACES ? ' or' : ''}${survol === x ? ' on' : ''}`}
            onMouseEnter={() => setSurvol(x)}
            aria-label={`${auDe ? 'Face' : 'Total'} ${x} : ${c} fois`}
          >
            <span style={{ height: c ? `${(c / haut) * 100}%` : 0 }} />
          </span>
        )
      })}
      {survol !== null ? (
        <span className="hg-bulle cj-bulle" style={{ left: `${((survol - axe.min + 0.5) / nb) * 100}%` }} role="status">
          <b>
            {auDe ? 'Face' : 'Total'} {survol}
          </b>
          <span>
            {comptes[survol - axe.min]} fois · {Math.round((comptes[survol - axe.min] / n) * 100)} %
          </span>
        </span>
      ) : null}
    </div>
  )
}

/* ============================================================
   Le journal
   ============================================================ */

function RollRow({
  r,
  fresh,
  onTrash
}: {
  r: Roll
  fresh: boolean
  onTrash: () => void
}): JSX.Element {
  /* Le dé nu se relit du total : c'est lui que le joueur a annoncé. */
  const de = r.formula === '1d20' ? r.result - (r.target ?? 0) : r.result
  const qui = r.playerName?.trim() || r.characterName
  return (
    <tr className={`jr c-${r.characterColor ?? 'neutral'}${fresh ? ' fresh' : ''}`}>
      <td className="num" style={{ color: 'var(--text-faint)', fontSize: 11.5 }}>
        {heureLocale(r.at)}
      </td>
      <td>
        <span className="who">
          <span className={`pip c-${r.characterColor ?? 'neutral'}`}>
            {r.characterName ? initials(r.characterName) : 'MJ'}
          </span>
          <span>
            <span className="n">{qui ?? 'Jet du MJ'}</span>
            {r.characterName && qui !== r.characterName ? (
              <>
                <br />
                <span className="p">{r.characterName}</span>
              </>
            ) : null}
          </span>
        </span>
      </td>
      <td>{r.label}</td>
      <td className="num" style={{ color: 'var(--text-dim)' }}>
        {de}
      </td>
      <td className="d100" title={r.detail ?? ''}>
        {r.result}
      </td>
      <td className="tdel">
        <button
          className="btn btn-ghost btn-sm btn-ico"
          title="Supprimer ce jet — il passe à la corbeille"
          aria-label={`Supprimer le jet ${r.label}`}
          onClick={onTrash}
        >
          <IconTrash />
        </button>
      </td>
    </tr>
  )
}
