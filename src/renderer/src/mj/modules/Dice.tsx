import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { IconRotate, IconTrash } from '../components/Icons'
import { initials } from './Sheets'
import { FACES, useSaisieJet, VALEURS } from './jet'
import type { Character, Roll } from '@shared/types'

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
    valeurDe,
    bonus,
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

  const stats = useMemo(() => statsParJoueur(s.rolls, s.characters), [s.rolls, s.characters])

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

      {s.characters.length === 0 ? (
        <div className="card saisie-bar saisie-vide">
          Aucun personnage. Crée les fiches dans le module «&nbsp;Fiches&nbsp;».
        </div>
      ) : (
        <div className="card saisie-bar">
          <div className="bloc">
            <span className="eyebrow">Joueur</span>
            <div className="choix-lig" role="radiogroup" aria-label="Joueur">
              {s.characters.map((c) => (
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
                    <b className="v">{valeurDe(x.key)}</b>
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
                    {valeur} + {bonus} = <b>{valeur! + bonus}</b>
                  </span>
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
            <Statistiques lignes={stats} />
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
                <span className="h">{r.at.slice(11, 16)}</span>
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

interface LigneStat {
  id: number
  nom: string
  color: string
  n: number
  /** Moyenne du dé nu, hors caractéristique : la chance du joueur. */
  moyenne: number
  /** La valeur qui revient le plus, et combien de fois. */
  mode: number
  modeN: number
  /** Le cumul des totaux réellement obtenus — dé + caractéristique. */
  score: number
}

/**
 * Les jets de la séance, relus par joueur.
 *
 * Seuls les jets en d20 comptent : ce sont les seuls dont on sache retrouver le
 * dé nu (`result` moins la caractéristique ajoutée). Mêler un d100 aux moyennes
 * donnerait un chiffre qui ne veut rien dire.
 */
function statsParJoueur(rolls: Roll[], characters: Character[]): LigneStat[] {
  const brut = new Map<number, number[]>()
  const scores = new Map<number, number>()
  for (const r of rolls) {
    if (r.formula !== '1d20' || r.characterId === null) continue
    const de = r.result - (r.target ?? 0)
    if (de < 1 || de > FACES) continue
    if (!brut.has(r.characterId)) brut.set(r.characterId, [])
    brut.get(r.characterId)!.push(de)
    scores.set(r.characterId, (scores.get(r.characterId) ?? 0) + r.result)
  }

  const lignes: LigneStat[] = []
  for (const c of characters) {
    const des = brut.get(c.id)
    if (!des || des.length === 0) continue
    const comptes = new Map<number, number>()
    for (const d of des) comptes.set(d, (comptes.get(d) ?? 0) + 1)
    let mode = des[0]
    let modeN = 0
    /* À égalité, la plus haute : c'est celle dont le joueur se vante. */
    for (const [v, n] of comptes) if (n > modeN || (n === modeN && v > mode)) (mode = v), (modeN = n)
    lignes.push({
      id: c.id,
      nom: c.player?.trim() || c.name,
      color: c.color ?? 'neutral',
      n: des.length,
      moyenne: des.reduce((a, b) => a + b, 0) / des.length,
      mode,
      modeN,
      score: scores.get(c.id) ?? 0
    })
  }
  return lignes
}

function Statistiques({ lignes }: { lignes: LigneStat[] }): JSX.Element {
  if (lignes.length === 0) {
    return (
      <div className="empty">
        <b>Rien à mesurer</b>
        Note quelques jets : moyennes, valeurs fétiches et scores apparaîtront ici.
      </div>
    )
  }
  const maxScore = Math.max(...lignes.map((l) => l.score), 1)
  return (
    <div className="dice-scroll graphes">
      <Barres
        titre="Moyenne du dé"
        note={`sur ${FACES} — le dé nu, sans la caractéristique`}
        lignes={lignes}
        max={FACES}
        part={(l) => l.moyenne}
        valeur={(l) => l.moyenne.toFixed(1)}
        appoint={(l) => `${l.n} jet${l.n > 1 ? 's' : ''}`}
      />
      <Barres
        titre="Valeur la plus sortie"
        note={`sur ${FACES} — et le nombre de fois`}
        lignes={lignes}
        max={FACES}
        part={(l) => l.mode}
        valeur={(l) => String(l.mode)}
        appoint={(l) => `×${l.modeN}`}
      />
      <Barres
        titre="Score"
        note="cumul des totaux — dé + caractéristique"
        lignes={lignes}
        max={maxScore}
        part={(l) => l.score}
        valeur={(l) => String(l.score)}
        appoint={(l) => `${Math.round(l.score / l.n)} de moyenne`}
      />
    </div>
  )
}

/**
 * Un graphe : une barre par joueur, sa couleur, sa valeur écrite au bout.
 * Le nom porte l'identité — la couleur ne fait que la rappeler, si bien qu'un
 * daltonien lit le graphe aussi bien qu'un autre.
 */
function Barres({
  titre,
  note,
  lignes,
  max,
  part,
  valeur,
  appoint
}: {
  titre: string
  note: string
  lignes: LigneStat[]
  max: number
  part: (l: LigneStat) => number
  valeur: (l: LigneStat) => string
  appoint: (l: LigneStat) => string
}): JSX.Element {
  return (
    <figure className="graphe">
      <figcaption>
        <h4>{titre}</h4>
        <span>{note}</span>
      </figcaption>
      {lignes.map((l) => (
        <div className="barre" key={l.id} title={`${l.nom} — ${valeur(l)} (${appoint(l)})`}>
          <span className="qui">
            <span className={`pip teinte c-${l.color}`} />
            <span className="t">{l.nom}</span>
          </span>
          <span className="piste">
            <span
              className={`remplissage c-${l.color}`}
              style={{ width: `${Math.max(1.5, (part(l) / max) * 100)}%` }}
            />
          </span>
          <b className="val">{valeur(l)}</b>
          <span className="app">{appoint(l)}</span>
        </div>
      ))}
    </figure>
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
        {r.at.slice(11, 16)}
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
