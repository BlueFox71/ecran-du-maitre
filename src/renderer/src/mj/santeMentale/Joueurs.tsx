import { useState } from 'react'
import type { Palier, ReglageSm } from '@shared/santeMentale'
import { useStore } from '../store'
import { useSm, type Alerte, type Attente } from './etat'
import { moins } from './Bareme'

/**
 * La colonne droite de la vue SM : au-dessus, les rappels, les jets attendus
 * et les alertes ; puis une ligne par joueur, avec ce qui pèse sur lui en clair.
 */

export interface JoueurSm {
  id: number
  nom: string
  sm: number
  max: number
  palier: Palier
}

/** Le libellé court d'une caractéristique (« PER »), d'après sa clé. */
export type NomCarac = (cle: string) => string

/** « 09:15 », « 1:02:30 » : ce qui reste avant `a`, à la seconde — on le voit filer. */
function delai(a: number, maintenant: number): string {
  const ms = a - maintenant
  if (ms <= 0) return 'maintenant'
  const s = Math.ceil(ms / 1000)
  const deux = (n: number): string => String(n).padStart(2, '0')
  const h = Math.floor(s / 3600)
  const mmss = `${deux(Math.floor((s % 3600) / 60))}:${deux(s % 60)}`
  return h ? `${h}:${mmss}` : mmss
}

const signe = (n: number): string => (n < 0 ? moins(-n) : `+${n}`)

/** « −2 PER », « −2 à tous les jets ». */
function texteMalus(p: Palier, nomCarac: NomCarac): string {
  return p.malus.map((m) => `${signe(m.valeur)} ${m.caracKey ? nomCarac(m.caracKey) : 'à tous les jets'}`).join(', ')
}

/* ------------------------------------------------------------
   Au-dessus des joueurs
   ------------------------------------------------------------ */

interface PropsBandeaux {
  r: ReglageSm
  nom: (id: number) => string
  nomCarac: NomCarac
  maintenant: number
}

export function Bandeaux({ r, nom, nomCarac, maintenant }: PropsBandeaux): JSX.Element {
  const attentes = useSm((s) => s.attentes)
  const alertes = useSm((s) => s.alertes)
  return (
    <>
      {r.rappels.length ? (
        <ul className="sm-rappels">
          {r.rappels.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      ) : null}
      {attentes.map((a) => (
        <BandeauJet key={a.id} a={a} nom={nom} />
      ))}
      {alertes.map((a) => (
        <CarteAlerte key={a.id} a={a} r={r} nom={nom} nomCarac={nomCarac} maintenant={maintenant} />
      ))}
    </>
  )
}

/** « Jet de Volonté attendu » : un jeton par joueur, et la saisie à la main en secours. */
function BandeauJet({ a, nom }: { a: Attente; nom: (id: number) => string }): JSX.Element {
  const annuler = useSm((s) => s.annulerAttente)
  const [saisie, setSaisie] = useState(false)
  const folie = a.raison === 'folie'
  return (
    <div className="sm-attente">
      <div className="sm-attente-tete">
        <span className="eyebrow">
          {folie ? 'Jet de Volonté attendu (folie passagère)' : 'Jet de Volonté attendu'} · {a.titre}
          {folie ? '' : ` ${moins(a.perte)}`}
        </span>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          title="Oublier ce jet : rien n’est retiré à ceux qui ne l’ont pas fait"
          onClick={() => annuler(a.id)}
        >
          Annuler
        </button>
      </div>
      <div className="sm-jetons">
        {a.joueurs.map((j) => (
          <span key={j.characterId} className={`sm-jeton${j.resultat ? ' fait' : ''}`}>
            {nom(j.characterId)} ·{' '}
            {j.resultat
              ? folie
                ? `${j.resultat.total} ✓`
                : `${j.resultat.total} → ${j.resultat.perte < 0 ? `+${-j.resultat.perte}` : moins(j.resultat.perte)} ✓`
              : 'en attente…'}
          </span>
        ))}
        {saisie ? null : (
          <button type="button" className="btn btn-sm sm-a-droite" onClick={() => setSaisie(true)}>
            Saisir à la main
          </button>
        )}
      </div>
      {saisie ? <SaisieMain a={a} nom={nom} onFin={() => setSaisie(false)} /> : null}
    </div>
  )
}

/** Le dé d'un joueur sans téléphone : il part au journal et revient servir l'attente. */
function SaisieMain({ a, nom, onFin }: { a: Attente; nom: (id: number) => string; onFin: () => void }): JSX.Element {
  const saisir = useSm((s) => s.saisirJet)
  const restants = a.joueurs.filter((j) => !j.resultat).map((j) => j.characterId)
  const [qui, setQui] = useState<number | null>(restants[0] ?? null)
  const [de, setDe] = useState('')
  const n = Number(de)
  const valide = qui !== null && restants.includes(qui) && Number.isInteger(n) && n >= 1 && n <= 20
  const valider = (): void => {
    if (!valide || qui === null) return
    void saisir(a.id, qui, n)
    setDe('')
    if (restants.length <= 1) onFin()
    else setQui(restants.find((id) => id !== qui) ?? null)
  }
  return (
    <form
      className="sm-saisie"
      onSubmit={(e) => {
        e.preventDefault()
        valider()
      }}
    >
      {restants.length > 1 ? (
        <select value={qui ?? ''} aria-label="Joueur" onChange={(e) => setQui(Number(e.target.value))}>
          {restants.map((id) => (
            <option key={id} value={id}>
              {nom(id)}
            </option>
          ))}
        </select>
      ) : (
        <span>{qui !== null ? nom(qui) : ''}</span>
      )}
      <input
        type="number"
        min={1}
        max={20}
        value={de}
        autoFocus
        placeholder="d20"
        aria-label="Résultat du dé (1 à 20)"
        className="sm-de"
        onChange={(e) => setDe(e.target.value)}
      />
      <button type="submit" className="btn btn-sm btn-brass" disabled={!valide}>
        OK
      </button>
      <button type="button" className="btn btn-sm btn-ghost" onClick={onFin}>
        Fermer
      </button>
    </form>
  )
}

interface PropsAlerte {
  a: Alerte
  r: ReglageSm
  nom: (id: number) => string
  nomCarac: NomCarac
  maintenant: number
}

function CarteAlerte({ a, r, nom, nomCarac, maintenant }: PropsAlerte): JSX.Element {
  const sm = useSm()
  const qui = nom(a.characterId)
  const vu = (
    <button type="button" className="btn btn-sm" onClick={() => sm.fermerAlerte(a.id)}>
      Vu
    </button>
  )

  if (a.genre === 'folie')
    return (
      <div className="sm-alerte">
        <b>{qui} : folie passagère</b> — {a.effet} <span className="sm-dim">(encore {delai(a.finA, maintenant)})</span>
        <div className="sm-alerte-actions">
          <button type="button" className="btn btn-sm btn-brass" onClick={() => sm.calmer(a.characterId)}>
            Calmé
          </button>
        </div>
      </div>
    )

  if (a.genre === 'nausee')
    return (
      <div className="sm-alerte">
        <b>{qui} a la nausée</b> — deux pilules en moins de {r.nausee.fenetreMin} min : {signe(r.nausee.malus)} à
        tous les jets pendant {r.nausee.dureeMin} min, posé sur sa fiche.
        <div className="sm-alerte-actions">{vu}</div>
      </div>
    )

  if (a.genre === 'hallucination')
    return (
      <div className="sm-alerte sm-alerte-iris">
        <b>Une hallucination pour {qui}</b>
        <Hallucination alerteId={a.id} characterId={a.characterId} texte={a.texte} />
      </div>
    )

  /* Le changement de palier. */
  const malus = texteMalus(a.palier, nomCarac)
  return (
    <div className={`sm-alerte${a.montee ? ' sm-alerte-moss' : ''}`}>
      <b>
        {qui} {a.montee ? 'remonte' : 'passe'} en {a.palier.nom} ({a.sm})
      </b>{' '}
      — {malus ? `${malus} posé sur sa fiche.` : 'plus de malus de santé mentale sur sa fiche.'}
      {a.palier.texte ? <p className="sm-texte">{a.palier.texte}</p> : null}
      {a.texte ? (
        <Hallucination alerteId={a.id} characterId={a.characterId} texte={a.texte} />
      ) : (
        <div className="sm-alerte-actions">{vu}</div>
      )}
    </div>
  )
}

/** La phrase proposée : elle ne part que sur un clic du meneur. */
function Hallucination(p: { alerteId: string; characterId: number; texte: string }): JSX.Element {
  const sm = useSm()
  /* Sans joueur lié, pas de mot secret possible : seule la voix reste. */
  const lie = useStore((s) => s.players.some((x) => x.characterId === p.characterId))
  return (
    <>
      <p className="sm-hallu">« {p.texte} »</p>
      <div className="sm-alerte-actions">
        {lie ? (
          <button
            type="button"
            className="btn btn-sm btn-brass"
            title="L’envoyer en mot secret sur son téléphone"
            onClick={() => void sm.envoyerHallucination(p.alerteId)}
          >
            Envoyer
          </button>
        ) : null}
        <button
          type="button"
          className={`btn btn-sm${lie ? '' : ' btn-brass'}`}
          title="Tu la lui as glissée à voix basse : rien n’est envoyé, la prochaine viendra à son heure"
          onClick={() => void sm.envoyerHallucination(p.alerteId, true)}
        >
          Dite à l’oral
        </button>
        <button type="button" className="btn btn-sm" onClick={() => sm.autreHallucination(p.alerteId)}>
          Une autre
        </button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => sm.fermerAlerte(p.alerteId)}>
          Plus tard
        </button>
      </div>
    </>
  )
}

/* ------------------------------------------------------------
   Les joueurs
   ------------------------------------------------------------ */

/**
 * « 47 · Hallucinations » : un clic, et la valeur se corrige à la main — une
 * erreur de saisie, un « 20 naturel : +2 » rendu à la table. Entrée valide,
 * Échap renonce. Le palier suit, sans folie ni annonce.
 */
function ValeurSm({ j }: { j: JoueurSm }): JSX.Element {
  const rectifier = useSm((s) => s.rectifier)
  const [edite, setEdite] = useState<string | null>(null)
  if (edite === null)
    return (
      <button
        type="button"
        className={`sm-pastille c-${j.palier.couleur}`}
        title="Corriger la santé mentale à la main"
        onClick={() => setEdite(String(j.sm))}
      >
        {j.sm} · {j.palier.nom}
      </button>
    )
  const valider = (): void => {
    const n = Math.round(Number(edite))
    setEdite(null)
    if (edite.trim() !== '' && Number.isFinite(n) && n !== j.sm) void rectifier(j.id, Math.max(0, Math.min(j.max, n)))
  }
  return (
    <input
      type="number"
      className="sm-rectif num"
      autoFocus
      min={0}
      max={j.max}
      value={edite}
      aria-label={`Santé mentale de ${j.nom}`}
      onChange={(e) => setEdite(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={valider}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          e.stopPropagation()
          setEdite(null)
        }
      }}
    />
  )
}

interface PropsLignes {
  r: ReglageSm
  joueurs: JoueurSm[]
  /** Le joueur à la SM la plus basse : 🎯. */
  cible: number | null
  nomCarac: NomCarac
  maintenant: number
}

export function Lignes({ r, joueurs, cible, nomCarac, maintenant }: PropsLignes): JSX.Element {
  const chronos = useSm((s) => s.chronos)
  const halluA = useSm((s) => s.halluA)
  const folies = useSm((s) => s.folies)
  const nausees = useSm((s) => s.nausees)
  const arreter = useSm((s) => s.arreterChrono)
  const basculerPause = useSm((s) => s.basculerPause)
  const calmer = useSm((s) => s.calmer)

  return (
    <div className="sm-joueurs">
      {joueurs.map((j) => {
        const pct = j.max > 0 ? Math.max(0, Math.min(100, (j.sm / j.max) * 100)) : 0
        const malus = texteMalus(j.palier, nomCarac)
        const hallu = halluA[j.id]
        const effets = [
          malus,
          hallu !== undefined ? `hallucination dans ${delai(hallu, maintenant)}` : '',
          nausees[j.id] !== undefined ? `nausée (encore ${delai(nausees[j.id], maintenant)})` : '',
          cible === j.id ? 'cible des entités' : ''
        ].filter(Boolean)
        const siens = chronos[j.id] ?? []
        const folie = folies[j.id]
        return (
          <div key={j.id} className="sm-ligne">
            <span className="sm-qui">
              <span className="sm-cible" title={cible === j.id ? 'Cible des entités : la SM la plus basse' : undefined}>
                {cible === j.id ? '🎯' : ''}
              </span>
              <b>{j.nom}</b>
            </span>
            <div className={`dp-barre c-${j.palier.couleur}`}>
              <i style={{ width: `${pct}%` }} />
            </div>
            <ValeurSm j={j} />
            {effets.length || siens.length || folie ? (
              <div className="sm-effets">
                {effets.length ? <span>{effets.join(' · ')}</span> : null}
                {siens.map((c) => {
                  const prix = r.prix.find((x) => x.id === c.prixId)
                  const enPause = c.resteMs !== undefined
                  return (
                    <span key={c.prixId} className={`sm-chrono${enPause ? ' sm-pause' : ''}`}>
                      ⏱ {prix?.nom ?? c.prixId} —{' '}
                      {enPause
                        ? `en pause (${delai(maintenant + (c.resteMs ?? 0), maintenant)} avant le retrait)`
                        : `prochain retrait dans ${delai(c.prochainA, maintenant)}`}
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        title={enPause ? 'Reprendre ce chrono' : 'Mettre en pause — ce n’est pas son tour'}
                        aria-label={enPause ? 'Reprendre ce chrono' : 'Mettre ce chrono en pause'}
                        onClick={() => basculerPause(j.id, c.prixId)}
                      >
                        {enPause ? '▶' : '❚❚'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        title="Arrêter ce chrono"
                        aria-label="Arrêter ce chrono"
                        onClick={() => arreter(j.id, c.prixId)}
                      >
                        ✕
                      </button>
                    </span>
                  )
                })}
                {folie ? (
                  <span className="sm-folie">
                    Folie : {folie.effet} (encore {delai(folie.finA, maintenant)})
                    <button type="button" className="btn btn-sm" onClick={() => calmer(j.id)}>
                      Calmé
                    </button>
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
