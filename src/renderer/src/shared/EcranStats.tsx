import { Component, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { IconeFait, SlidePayload, StatsEcran, VisageStats } from '@shared/types'
import { etapesStats } from '@shared/statsEcran'
import { D20 } from './D20'
import {
  IconBalance,
  IconCheck,
  IconChute,
  IconCible,
  IconCrane,
  IconDie,
  IconEtoile,
  IconPeople,
  IconRecommencer,
  IconSliders,
  IconTrefle,
  IconTrophee
} from '../mj/components/Icons'
import './ecranStats.css'

/**
 * Les statistiques de la séance sur l'écran des joueurs, une étape à la fois.
 * Chaque étape entre en scène — le dé tombe, les nombres défilent, les barres
 * poussent, les joueurs arrivent du dernier au meilleur — puis tout se range
 * sur un seul écran. Revenir en arrière pose l'étape sans rejouer son entrée.
 *
 * Tout est en unités du cadre (cqh) : la même image dans le moniteur du MJ et
 * chez les joueurs.
 */
export function EcranStats({ p }: { p: Extract<SlidePayload, { type: 'statistiques' }> }): JSX.Element {
  /* Une présentation lancée par une version précédente peut rester à l'écran
     avec des données d'une autre forme : elle ne doit jamais faire tomber la
     fenêtre du MJ, dont le moniteur la dessine aussi. */
  return (
    <Garde>
      <Etape p={p} />
    </Garde>
  )
}

class Garde extends Component<{ children: ReactNode }, { casse: boolean }> {
  state = { casse: false }
  static getDerivedStateFromError(): { casse: boolean } {
    return { casse: true }
  }
  componentDidCatch(e: unknown): void {
    console.error('[statistiques] écran', e)
  }
  render(): ReactNode {
    return this.state.casse ? <div className="se" /> : this.props.children
  }
}

function Etape({ p }: { p: Extract<SlidePayload, { type: 'statistiques' }> }): JSX.Element {
  const etapes = etapesStats(p.stats)
  const e = etapes[Math.max(0, Math.min(p.etape, etapes.length - 1))]
  const anime = p.anime && !mouvementReduit()
  const cls = `se${anime ? '' : ' se-fixe'}`
  const s = p.stats
  switch (e.genre) {
    case 'titre':
      return (
        <div className={cls}>
          <Titre s={s} anime={anime} />
        </div>
      )
    case 'chiffres':
      return (
        <div className={cls}>
          <Chiffres s={s} anime={anime} />
        </div>
      )
    case 'repartition':
      return (
        <div className={cls}>
          <Repartition s={s} />
        </div>
      )
    case 'faits':
      return (
        <div className={cls}>
          <Faits s={s} />
        </div>
      )
    case 'joueur':
      return (
        <div className={`${cls} c-${s.joueurs[e.i].color}`}>
          <Joueur s={s} i={e.i} anime={anime} />
        </div>
      )
    case 'tout':
      return (
        <div className={cls}>
          <Tout s={s} />
        </div>
      )
  }
}

const mouvementReduit = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Un nombre qui défile de zéro jusqu'à sa valeur, en ralentissant. */
function useDefile(cible: number, anime: boolean, delaiMs = 0, dureeMs = 1200): number {
  const [v, setV] = useState(anime ? 0 : cible)
  useEffect(() => {
    if (!anime) {
      setV(cible)
      return
    }
    let raf = 0
    const t0 = performance.now() + delaiMs
    const pas = (t: number): void => {
      const x = Math.min(1, Math.max(0, (t - t0) / dureeMs))
      setV(cible * (1 - Math.pow(1 - x, 3)))
      if (x < 1) raf = requestAnimationFrame(pas)
    }
    raf = requestAnimationFrame(pas)
    return () => cancelAnimationFrame(raf)
  }, [cible, anime, delaiMs, dureeMs])
  return v
}

const pluriel = (n: number, mot: string): string => `${n} ${mot}${n > 1 ? 's' : ''}`

function Phrase({ s }: { s: StatsEcran }): JSX.Element {
  return s.humeur === 'norme' ? (
    <>
      Un dé <em>dans la norme</em>
    </>
  ) : (
    <>
      Un dé plutôt <em className={s.humeur === 'chaud' ? 'or' : 'froid'}>{s.humeur}</em>
    </>
  )
}

function SousTitre({ s }: { s: StatsEcran }): JSX.Element {
  return (
    <>
      {pluriel(s.n, 'jet')} · <b className="or">{pluriel(s.critiques, 'coup')} de génie</b> pour{' '}
      <b className="sang">{pluriel(s.maladresses, 'maladresse')}</b>
      {s.chanceux ? <> · la chance a souri à {s.chanceux}</> : null}
    </>
  )
}

/* ---------------- 1. le titre ---------------- */

function Titre({ s, anime }: { s: StatsEcran; anime: boolean }): JSX.Element {
  return (
    <div className="se-titre">
      <div className="se-d20">
        <D20 valeur={20} sansChute={!anime} />
      </div>
      <div className="se-titre-texte">
        <div className="se-kicker">Statistiques de la séance</div>
        <div className="se-phrase">
          <Phrase s={s} />
        </div>
        <div className="se-sous">
          <SousTitre s={s} />
        </div>
      </div>
    </div>
  )
}

/* ---------------- 2. les grands chiffres ---------------- */

function Chiffre({
  icone,
  lib,
  valeur,
  decimales = 0,
  suffixe = '',
  ton,
  sous,
  i,
  anime
}: {
  icone: JSX.Element
  lib: string
  valeur: number | null
  decimales?: number
  suffixe?: string
  ton?: 'or' | 'sang'
  sous?: string
  i: number
  anime: boolean
}): JSX.Element {
  const delai = 300 + i * 350
  const v = useDefile(valeur ?? 0, anime, delai)
  return (
    <div className="se-chiffre" style={{ animationDelay: `${delai}ms` }}>
      <span className={`se-ic${ton ? ` ${ton}` : ''}`}>{icone}</span>
      <b className={`se-gros${ton ? ` ${ton}` : ''}`}>{valeur === null ? '—' : `${v.toFixed(decimales)}${suffixe}`}</b>
      <span className="se-lib">{lib}</span>
      {sous ? <span className="se-mini">{sous}</span> : null}
    </div>
  )
}

function Chiffres({ s, anime }: { s: StatsEcran; anime: boolean }): JSX.Element {
  const ecart = s.moyenne - s.attendu
  return (
    <div className="se-plein">
      <div className="se-kicker">La soirée en chiffres</div>
      <div className="se-chiffres">
        <Chiffre
          i={0}
          anime={anime}
          icone={<IconDie />}
          lib="jets de d20"
          valeur={s.n}
          sous={s.rythme === null ? undefined : `${s.rythme.toFixed(0)} par heure`}
        />
        <Chiffre
          i={1}
          anime={anime}
          icone={<IconCible />}
          lib={s.mesure === 'de' ? 'moyenne du dé' : 'moyenne du total'}
          valeur={s.moyenne}
          decimales={1}
          sous={`${ecart >= 0 ? '+' : '−'}${Math.abs(ecart).toFixed(1)} sur ${s.attendu.toFixed(1)}`}
        />
        <Chiffre
          i={2}
          anime={anime}
          icone={<IconCheck />}
          lib="réussite"
          valeur={s.reussite?.taux ?? null}
          suffixe=" %"
          sous={s.reussite ? `sur ${pluriel(s.reussite.juges, 'jet')} jugé${s.reussite.juges > 1 ? 's' : ''}` : undefined}
        />
        <Chiffre i={3} anime={anime} icone={<IconEtoile />} lib="20 naturels" valeur={s.critiques} ton="or" />
        <Chiffre i={4} anime={anime} icone={<IconCrane />} lib="1 naturels" valeur={s.maladresses} ton="sang" />
      </div>
    </div>
  )
}

/* ---------------- 3. la répartition ---------------- */

function Histo({ s, compact }: { s: StatsEcran; compact?: boolean }): JSX.Element {
  const h = s.histo
  const nb = h.comptes.length
  const auDe = s.mesure === 'de'
  const max = h.min + nb - 1
  const haut = Math.max(...h.comptes, h.honnete ?? 0, 1)
  const gauche = (x: number): string => `${((x - h.min + 0.5) / nb) * 100}%`
  const montre = (x: number): boolean => nb <= 22 || x % 2 === 0
  return (
    <figure className={`se-hg${compact ? ' compact' : ''}`}>
      <div className="se-hg-plan" style={{ gridTemplateColumns: `repeat(${nb}, 1fr)` }}>
        {h.honnete !== null ? (
          <span className="se-hg-honnete" style={{ bottom: `${(h.honnete / haut) * 100}%` }}>
            {compact ? null : <em>dé honnête</em>}
          </span>
        ) : null}
        {h.comptes.map((c, i) => {
          const x = h.min + i
          const ton = auDe && x === max ? ' or' : auDe && x === h.min ? ' sang' : ''
          return (
            <span key={x} className="se-hg-col">
              <span
                className={`se-hg-barre${ton}${x === h.mode ? ' mode' : ''}`}
                style={{ height: c ? `${(c / haut) * 100}%` : 0, animationDelay: `${300 + i * 45}ms` }}
              />
            </span>
          )
        })}
        <span className="se-hg-moyenne" style={{ left: gauche(s.moyenne), animationDelay: `${450 + nb * 45}ms` }}>
          {compact ? null : <em>moyenne {s.moyenne.toFixed(1)}</em>}
        </span>
        {!compact && h.modeN ? (
          <span
            className="se-hg-note"
            style={{ left: gauche(h.mode), bottom: `${(h.modeN / haut) * 100}%`, animationDelay: `${800 + nb * 45}ms` }}
          >
            le {h.mode}, sorti {h.modeN} fois
          </span>
        ) : null}
      </div>
      <div className="se-hg-axe" style={{ gridTemplateColumns: `repeat(${nb}, 1fr)` }}>
        {h.comptes.map((_, i) => {
          const x = h.min + i
          return (
            <span key={x} className={auDe && x === h.min ? 'sang' : auDe && x === max ? 'or' : undefined}>
              {montre(x) ? x : ''}
            </span>
          )
        })}
      </div>
    </figure>
  )
}

function Repartition({ s }: { s: StatsEcran }): JSX.Element {
  return (
    <div className="se-plein se-large">
      <div className="se-entete">
        <span className="se-num">01</span>
        <span className="se-h">{s.mesure === 'de' ? 'Les faces' : 'Les totaux'}</span>
        <span className="se-note">
          la répartition {s.mesure === 'de' ? 'des faces' : 'des totaux'} de {pluriel(s.n, 'jet')} de d20
        </span>
      </div>
      <Histo s={s} />
    </div>
  )
}

/* ---------------- 4. les faits ---------------- */

const ICONES_FAIT: Record<IconeFait, () => JSX.Element> = {
  recommencer: IconRecommencer,
  balance: IconBalance,
  trophee: IconTrophee,
  chute: IconChute,
  trefle: IconTrefle,
  people: IconPeople,
  sliders: IconSliders
}

function Visage({ v, className }: { v: VisageStats; className: string }): JSX.Element {
  return (
    <span className={`${className} c-${v.color}`}>
      {v.url ? <img src={v.url} alt="" draggable={false} /> : <span className="se-init">{initiales(v.nom)}</span>}
    </span>
  )
}

const initiales = (nom: string): string =>
  nom
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0]!.toUpperCase())
    .join('')

function ListeFaits({ s, compact }: { s: StatsEcran; compact?: boolean }): JSX.Element {
  return (
    <ul className={`se-faits${compact ? ' compact' : ''}`}>
      {s.faits.map((f, i) => {
        const Ic = ICONES_FAIT[f.icone]
        return (
          <li key={f.lib} style={{ animationDelay: `${300 + i * 500}ms` }}>
            <span className="se-fait-ic">
              <Ic />
            </span>
            <span className="se-fait-lib">{f.lib}</span>
            {f.visage ? <Visage v={f.visage} className="se-fait-visage" /> : null}
            <b className="se-fait-val">{f.val}</b>
            {compact ? null : <span className="se-fait-det">{f.det}</span>}
          </li>
        )
      })}
    </ul>
  )
}

function Faits({ s }: { s: StatsEcran }): JSX.Element {
  return (
    <div className="se-plein">
      <div className="se-entete">
        <span className="se-num">02</span>
        <span className="se-h">Les faits</span>
        <span className="se-note">ce qu’on retiendra</span>
      </div>
      <ListeFaits s={s} />
    </div>
  )
}

/* ---------------- 5. un joueur ---------------- */

/** Un tirage qui ne change pas d'un écran à l'autre : le moniteur montre la même gerbe. */
function tirage(graine: number): () => number {
  let a = graine * 2654435761
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rangDit = (r: number): string => (r === 1 ? '1er' : `${r}ᵉ`)

function Joueur({ s, i, anime }: { s: StatsEcran; i: number; anime: boolean }): JSX.Element {
  const j = s.joueurs[i]
  const rang = s.joueurs.length - i
  const ecart = j.moyenne - j.attendu
  const etat = Math.abs(ecart) < 0.5 ? 'norme' : ecart > 0 ? 'chaud' : 'froid'
  const moy = useDefile(j.moyenne, anime, 700, 1400)
  const emojis = j.emojis.length ? j.emojis : ['✨']
  const gerbe = useMemo(() => {
    const r = tirage(j.id + 7)
    return Array.from({ length: 24 }, (_, k) => {
      const angle = r() * Math.PI * 2
      const loin = 30 + r() * 28
      return {
        e: emojis[k % emojis.length],
        style: {
          '--dx': `${Math.cos(angle) * loin * 1.4}cqh`,
          '--dy': `${Math.sin(angle) * loin}cqh`,
          '--rot': `${(r() - 0.5) * 140}deg`,
          '--t': `${4.5 + r() * 4.5}cqh`,
          animationDelay: `${0.3 + r() * 0.6}s`,
          animationDuration: `${1.6 + r() * 1.2}s`
        } as React.CSSProperties
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [j.id, emojis.join('')])
  return (
    <div className="se-joueur">
      <div className="se-rang">
        {rangDit(rang)} sur {s.joueurs.length}
      </div>
      <div className="se-portrait">
        {anime ? (
          <div className="pres-gerbe" aria-hidden>
            {gerbe.map((g, k) => (
              <span key={k} style={g.style}>
                {g.e}
              </span>
            ))}
          </div>
        ) : null}
        <Visage v={j} className="se-cadre" />
      </div>
      <div className="se-joueur-texte">
        <div className="se-kicker">
          {j.nom}
          {j.perso ? ` · ${j.perso}` : ''}
        </div>
        <div className="se-moy">{moy.toFixed(1)}</div>
        <div className={`se-etat ${etat}`}>
          {etat === 'norme' ? 'dans la norme' : etat} · {ecart >= 0 ? '+' : '−'}
          {Math.abs(ecart).toFixed(1)} sur {j.attendu.toFixed(1)}
        </div>
        {j.titre ? <div className="se-medaille">{j.titre}</div> : null}
      </div>
    </div>
  )
}

/* ---------------- 6. tout réuni ---------------- */

/** La répartition d'un joueur : même axe et même hauteur pour tous, pour qu'on les compare. */
function MiniHisto({ comptes, min, haut, auDe }: { comptes: number[]; min: number; haut: number; auDe: boolean }): JSX.Element {
  const max = min + comptes.length - 1
  return (
    <div className="se-mh">
      <div className="se-mh-plan" style={{ gridTemplateColumns: `repeat(${comptes.length}, 1fr)` }}>
        {comptes.map((c, i) => {
          const x = min + i
          const ton = auDe && x === max ? ' or' : auDe && x === min ? ' sang' : ''
          return (
            <span key={x} className="se-hg-col">
              <span className={`se-mh-barre${ton}`} style={{ height: c ? `${(c / haut) * 100}%` : 0 }} />
            </span>
          )
        })}
      </div>
      <div className="se-mh-axe">
        <span className={auDe ? 'sang' : undefined}>{min}</span>
        <span>{Math.round((min + max) / 2)}</span>
        <span className={auDe ? 'or' : undefined}>{max}</span>
      </div>
    </div>
  )
}

function Tout({ s }: { s: StatsEcran }): JSX.Element {
  const n = s.joueurs.length
  const hautJoueurs = Math.max(1, ...s.joueurs.flatMap((j) => j.comptes ?? []))
  return (
    <div className="se-tout">
      <div className="se-tout-haut se-bloc-entre" style={{ animationDelay: '100ms' }}>
        <div className="se-d20 petit">
          <D20 valeur={20} sansChute />
        </div>
        <div>
          <div className="se-kicker">Statistiques de la séance{s.seance ? ` · ${s.seance}` : ''}</div>
          <div className="se-phrase petit">
            <Phrase s={s} />
          </div>
          <div className="se-sous petit">
            <SousTitre s={s} />
          </div>
        </div>
      </div>
      <div className="se-tout-chiffres se-bloc-entre" style={{ animationDelay: '350ms' }}>
        <div>
          <b>{s.n}</b>
          <span>jets</span>
        </div>
        <div>
          <b>{s.moyenne.toFixed(1)}</b>
          <span>moyenne</span>
        </div>
        <div>
          <b>{s.reussite ? `${s.reussite.taux} %` : '—'}</b>
          <span>réussite</span>
        </div>
        <div>
          <b className="or">{s.critiques}</b>
          <span>20 naturels</span>
        </div>
        <div>
          <b className="sang">{s.maladresses}</b>
          <span>1 naturels</span>
        </div>
      </div>
      <div className={`se-tout-milieu${s.faits.length ? '' : ' seul'}`}>
        <div className="se-tout-bloc se-bloc-entre" style={{ animationDelay: '600ms' }}>
          <div className="se-tout-k">01 · {s.mesure === 'de' ? 'Les faces' : 'Les totaux'}</div>
          <Histo s={s} compact />
        </div>
        {s.faits.length ? (
          <div className="se-tout-bloc se-bloc-entre" style={{ animationDelay: '850ms' }}>
            <div className="se-tout-k">02 · Les faits</div>
            <ListeFaits s={s} compact />
          </div>
        ) : null}
      </div>
      {n ? (
        <div className="se-tout-joueurs">
          {s.joueurs.map((j, i) => (
            <div
              key={j.id}
              className={`se-tj c-${j.color} se-bloc-entre${i === n - 1 ? ' meilleur' : ''}`}
              style={{ animationDelay: `${1100 + i * 250}ms` }}
            >
              <div className="se-tj-tete">
                <Visage v={j} className="se-tj-visage" />
                <span className="se-tj-qui">
                  <b>{j.nom}</b>
                  {j.titre ? <span className="se-tj-titre">{j.titre}</span> : null}
                </span>
                <b className="se-tj-moy">{j.moyenne.toFixed(1)}</b>
              </div>
              {j.comptes?.length ? (
                <MiniHisto comptes={j.comptes} min={s.histo.min} haut={hautJoueurs} auDe={s.mesure === 'de'} />
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
