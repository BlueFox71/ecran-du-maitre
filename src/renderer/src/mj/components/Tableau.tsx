/**
 * Le tableau de bord de la scène : les pièces, leurs lampes et leurs portes.
 *
 * En partie, on ne trace plus : on **manœuvre**. Le groupe entre dans le
 * salon, on allume ; ils ouvrent la porte du bureau, on la déverrouille. Tout
 * ça se faisait jusqu'ici en cliquant des pastilles minuscules sur la carte,
 * à l'aveugle, en pleine phrase. Ici, chaque pièce donne ses interrupteurs,
 * nommés, et le survol montre sur la carte de quoi l'on parle — **chez le MJ
 * seulement** : les joueurs ne voient jamais ce halo.
 *
 * Rien n'est calculé ici que le rangement : les formes viennent des murs, les
 * noms des lieux de l'étage, et les gestes passent par les mêmes canaux que
 * partout ailleurs.
 *
 * Une maison entière tient mal dans une colonne : on filtre donc par nature —
 * l'éclairage, les portes, les rideaux, les fenêtres. Les filtres ne se
 * proposent que pour ce que la carte contient vraiment ; un plan sans rideau
 * n'a pas de bouton « Rideaux » à ne jamais toucher, et un plan qui n'a qu'une
 * seule nature n'a pas de filtres du tout.
 */
import { useMemo, useState } from 'react'
import { dansForme, formesDesMurs, type Forme } from '@shared/pieces'
import { bordsOuverture } from '@shared/ouvertures'
import {
  type CalqueBrouillard,
  type Lumiere,
  type Mur,
  type Ouverture,
  type Place
} from '@shared/types'
import {
  IconClose,
  IconPorte,
  IconRideau,
  IconSoleil,
  IconVerrou
} from './Icons'

/** Ce que le survol met en évidence sur la carte, en fractions de l'image. */
export type Surbrillance =
  | { quoi: 'lumiere'; id: number }
  | { quoi: 'ouverture'; id: number }
  /** Un rideau : ce n'est pas un point sur la carte mais tout un trait. */
  | { quoi: 'mur'; id: number }
  | { quoi: 'piece'; pts: [number, number][] }
  | null

/** Ce que la colonne sait montrer — et donc ce qu'elle sait cacher. */
type Nature = 'eclairage' | 'porte' | 'rideau' | 'fenetre'

/** Dans cet ordre : d'abord ce qu'on manœuvre, ensuite ce qui est là. */
const NATURES: { cle: Nature; label: string; icone: JSX.Element }[] = [
  { cle: 'eclairage', label: 'Éclairage', icone: <IconSoleil /> },
  { cle: 'porte', label: 'Portes', icone: <IconPorte /> },
  { cle: 'rideau', label: 'Rideaux', icone: <IconRideau /> }
  /* Plus de fenêtres ici : elles ne se manœuvrent pas, le tableau n'a rien à
     en dire. Elles restent sur la carte (« Affichage »). */
]

/** Une pièce et ce qu'elle contient — plus le fourre-tout de ce qui n'est nulle part. */
interface Salle {
  cle: string
  nom: string
  forme: Forme | null
  lumieres: Lumiere[]
  portes: Ouverture[]
  rideaux: Mur[]
  fenetres: Ouverture[]
}

/** Une salle où il n'y a rien à montrer ne s'affiche pas. */
const vide = (s: Salle): boolean =>
  !s.lumieres.length && !s.portes.length && !s.rideaux.length

/** Le milieu d'une ouverture, pour savoir dans quelle pièce elle donne. */
function milieuEtNormale(
  o: Ouverture,
  calque: CalqueBrouillard
): { m: [number, number]; n: [number, number] } | null {
  const mur = calque.murs.find((x) => x.id === o.murId)
  if (!mur) return null
  const b = bordsOuverture(mur, o)
  const dx = b.b[0] - b.a[0]
  const dy = b.b[1] - b.a[1]
  const len = Math.hypot(dx, dy) || 1
  return {
    m: [(b.a[0] + b.b[0]) / 2, (b.a[1] + b.b[1]) / 2],
    /* La perpendiculaire au seuil : de part et d'autre, deux pièces. */
    n: [-dy / len, dx / len]
  }
}

/**
 * Le milieu d'un rideau — à mi-longueur du trait, et non à mi-chemin entre ses
 * deux bouts : une tenture en L n'a pas son milieu dans le vide.
 */
function milieuEtNormaleDuMur(trait: Mur): { m: [number, number]; n: [number, number] } | null {
  if (trait.pts.length < 2) return null
  const lg: number[] = []
  let total = 0
  for (let i = 0; i + 1 < trait.pts.length; i++) {
    const d = Math.hypot(
      trait.pts[i + 1][0] - trait.pts[i][0],
      trait.pts[i + 1][1] - trait.pts[i][1]
    )
    lg.push(d)
    total += d
  }
  if (!total) return null
  let reste = total / 2
  let i = 0
  while (i < lg.length - 1 && reste > lg[i]) {
    reste -= lg[i]
    i++
  }
  const a = trait.pts[i]
  const b = trait.pts[i + 1]
  const t = lg[i] ? reste / lg[i] : 0
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = Math.hypot(dx, dy) || 1
  return { m: [a[0] + dx * t, a[1] + dy * t], n: [-dy / len, dx / len] }
}

export function TableauDeScene({
  calque,
  placeId,
  lieux,
  onSurvol,
  survol
}: {
  calque: CalqueBrouillard
  /** Le lieu à l'écran : c'est lui qui porte le soleil ou la lune. */
  placeId: number | null
  /** Les lieux de cet étage : ce sont eux qui donnent leur nom aux pièces. */
  lieux: Place[]
  onSurvol: (s: Surbrillance) => void
  survol: Surbrillance
}): JSX.Element | null {
  /* Les natures mises de côté. L'état vit ici et non dans la Régie : c'est un
     confort de lecture, pas un réglage de campagne — il n'a pas à survivre à
     la fermeture de l'application. */
  const [ecartees, setEcartees] = useState<Nature[]>([])

  const salles = useMemo<Salle[]>(() => {
    const formes = formesDesMurs(calque.murs)
    const nomDe = (f: Forme): string => {
      const l = lieux.find((p) => p.ancre && dansForme(p.ancre, f.pts))
      return l?.name ?? 'Sans nom'
    }

    const base: Salle[] = formes.map((f, i) => ({
      cle: `f${i}`,
      nom: nomDe(f),
      forme: f,
      lumieres: [],
      portes: [],
      rideaux: [],
      fenetres: []
    }))
    const ailleurs: Salle = {
      cle: 'ailleurs',
      nom: 'Hors des pièces',
      forme: null,
      lumieres: [],
      portes: [],
      rideaux: [],
      fenetres: []
    }

    for (const l of calque.lumieres) {
      const s = base.find((x) => x.forme && dansForme([l.x, l.y], x.forme.pts))
      ;(s ?? ailleurs).lumieres.push(l)
    }

    /* Une porte donne des deux côtés : elle appartient aux deux pièces qu'elle
       relie, et se manœuvre indifféremment depuis l'une ou l'autre. Fenêtres et
       rideaux se rangent de la même façon — un rideau tendu au milieu d'une
       pièce a ses deux bords dedans, et n'y figure donc qu'une fois. */
    const poser = (
      g: { m: [number, number]; n: [number, number] } | null,
      mettre: (s: Salle) => void
    ): void => {
      if (!g) return
      const pas = 0.012
      const cotes: [number, number][] = [
        [g.m[0] + g.n[0] * pas, g.m[1] + g.n[1] * pas],
        [g.m[0] - g.n[0] * pas, g.m[1] - g.n[1] * pas]
      ]
      const touchees = base.filter(
        (x) => x.forme && cotes.some((c) => dansForme(c, x.forme!.pts))
      )
      if (touchees.length) for (const t of touchees) mettre(t)
      else mettre(ailleurs)
    }

    for (const o of calque.ouvertures)
      poser(milieuEtNormale(o, calque), (s) =>
        o.nature === 'porte' ? s.portes.push(o) : s.fenetres.push(o)
      )

    for (const m of calque.murs.filter((x) => x.nature === 'rideau'))
      poser(milieuEtNormaleDuMur(m), (s) => s.rideaux.push(m))

    const pleines = base.filter((s) => !vide(s))
    pleines.sort((a, b) => (b.forme?.aire ?? 0) - (a.forme?.aire ?? 0))
    if (!vide(ailleurs)) pleines.push(ailleurs)
    return pleines
  }, [calque, lieux])

  /* Combien la carte en porte — c'est ce nombre, et lui seul, qui décide qu'un
     filtre existe. Rien n'est proposé pour ce qui n'est pas là. */
  const combien = (n: Nature): number => {
    if (n === 'eclairage') return calque.lumieres.length
    if (n === 'rideau') return calque.murs.filter((m) => m.nature === 'rideau').length
    const nat = n === 'porte' ? 'porte' : 'vitre'
    return calque.ouvertures.filter((o) => o.nature === nat).length
  }
  const presentes = NATURES.filter((x) => combien(x.cle) > 0).map((x) => x.cle)

  /* On retient ce que le MJ a écarté plutôt que ce qu'il garde : une carte qui
     gagne un rideau le montre aussitôt, sans qu'il faille penser à l'ajouter. */
  const montrees = presentes.filter((n) => !ecartees.includes(n))
  /* Un filtre qui ne laisse rien ne filtre rien : en changeant d'étage, on ne
     se retrouve pas devant une colonne vide sans comprendre pourquoi. */
  const vues = montrees.length ? montrees : presentes
  const voit = (n: Nature): boolean => vues.includes(n)

  const basculerFiltre = (n: Nature): void =>
    setEcartees((e) => (e.includes(n) ? e.filter((x) => x !== n) : [...e, n]))

  if (!calque.murs.length) return null

  const toutes = calque.lumieres
  const allumees = toutes.filter((l) => l.allumee).length

  const basculer = async (l: Lumiere, on: boolean): Promise<void> => {
    if (l.allumee === on) return
    await window.jdr.lumieres.update(l.id, { allumee: on })
  }

  const toutDe = async (liste: Lumiere[], on: boolean): Promise<void> => {
    for (const l of liste) await basculer(l, on)
  }

  /* Tirer ou ouvrir un rideau : la vue change pour tout le monde, le pas
     jamais — on passe derrière une tenture, tirée ou non. */
  const tirer = async (m: Mur, ouvert: boolean): Promise<void> => {
    if (m.ouvert === ouvert) return
    await window.jdr.murs.update(m.id, { ouvert })
  }

  /* Une pièce dont le filtre ne laisse rien s'en va avec son titre : mieux
     vaut une colonne courte qu'une liste de noms sans rien dessous. */
  const montre = (s: Salle): boolean =>
    (voit('eclairage') && s.lumieres.length > 0) ||
    (voit('porte') && s.portes.length > 0) ||
    (voit('rideau') && s.rideaux.length > 0)

  return (
    <aside className="tableau" onMouseLeave={() => onSurvol(null)}>
      <header className="tb-tete">
        <span className="eyebrow">La scène</span>
        {/* Une seule nature sur la carte : il n'y a rien à trier, et une rangée
            de boutons qui ne servent à rien vaut moins que rien. */}
        {presentes.length > 1 ? (
          <div className="tb-filtres" role="group" aria-label="Filtrer la scène">
            {NATURES.filter((x) => presentes.includes(x.cle)).map((x) => {
              const vu = voit(x.cle)
              const seule = vu && vues.length === 1
              return (
                <button
                  key={x.cle}
                  type="button"
                  className={`tb-f${vu ? ' vu' : ''}`}
                  aria-pressed={vu}
                  disabled={seule}
                  title={
                    seule
                      ? 'Le dernier filtre allumé : il en faut bien un'
                      : vu
                        ? `Masquer : ${x.label.toLowerCase()}`
                        : `Remontrer : ${x.label.toLowerCase()}`
                  }
                  onClick={() => basculerFiltre(x.cle)}
                >
                  {x.icone}
                  {x.label}
                  <em>{combien(x.cle)}</em>
                </button>
              )
            })}
          </div>
        ) : null}

        {/* Le compte et les deux boutons viennent après les filtres, et non
            avant : ils s'en vont avec l'éclairage qu'on écarte, et s'ils
            étaient au-dessus, la rangée de filtres sauterait sous le doigt
            au moment même où l'on s'en sert. */}
        {voit('eclairage') && toutes.length ? (
          <>
            <span className="tb-compte">
              {allumees} / {toutes.length} allumée{allumees > 1 ? 's' : ''}
            </span>
            <div className="tb-tout">
              <button
                className="btn btn-sm"
                disabled={allumees === toutes.length}
                title="Allumer toutes les lampes de la carte"
                onClick={() => void toutDe(toutes, true)}
              >
                <IconSoleil />
                Tout allumer
              </button>
              <button
                className="btn btn-sm btn-ghost"
                disabled={!allumees}
                title="Souffler toutes les lampes de la carte"
                onClick={() => void toutDe(toutes, false)}
              >
                Tout éteindre
              </button>
            </div>
          </>
        ) : null}
      </header>


      <div className="tb-salles">
        {salles.filter(montre).map((s) => {
          const on = s.lumieres.filter((l) => l.allumee).length
          return (
            <section
              key={s.cle}
              className="tb-salle"
              onMouseEnter={() => onSurvol(s.forme ? { quoi: 'piece', pts: s.forme.pts } : null)}
            >
              <div className="tb-salle-tete">
                <b>{s.nom}</b>
                {voit('eclairage') && s.lumieres.length ? (
                  <span className="tb-mini">
                    <button
                      className="tb-b"
                      disabled={on === s.lumieres.length}
                      title="Tout allumer dans cette pièce"
                      onClick={() => void toutDe(s.lumieres, true)}
                    >
                      Tout
                    </button>
                    <button
                      className="tb-b"
                      disabled={!on}
                      title="Tout éteindre dans cette pièce"
                      onClick={() => void toutDe(s.lumieres, false)}
                    >
                      Rien
                    </button>
                  </span>
                ) : null}
              </div>

              {/* La lampe est elle-même le bouton, comme la porte : un clic
                  l'allume ou la souffle — jaune allumée, sans couleur éteinte.
                  Elle porte la croix qui la retire : la tuile n'est donc pas un
                  <button>, mais en a le rôle et le clavier. */}
              {(voit('eclairage') ? s.lumieres : []).map((l) => (
                <div
                  key={`l${l.id}`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={l.allumee}
                  className={`tb-ligne tb-lampe ${l.allumee ? 'allumee' : 'eteinte'}${
                    survol && survol.quoi === 'lumiere' && survol.id === l.id ? ' vise' : ''
                  }`}
                  title={l.allumee ? 'Allumée — cliquer pour la souffler' : 'Éteinte — cliquer pour la rallumer'}
                  onMouseEnter={(e) => {
                    e.stopPropagation()
                    onSurvol({ quoi: 'lumiere', id: l.id })
                  }}
                  onClick={() => void basculer(l, !l.allumee)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' && e.key !== ' ') return
                    e.preventDefault()
                    void basculer(l, !l.allumee)
                  }}
                >
                  <span className={`tb-pastille${l.allumee ? ' on' : ''}`}>
                    <IconSoleil />
                  </span>
                  <span className="tb-nom">
                    {l.nom ?? 'Lampe'}
                    <em>{l.allumee ? 'allumée' : 'éteinte'}</em>
                  </span>
                  {/* La lanterne qu'un joueur emporte s'en va de la pièce. */}
                  <button
                    className="tb-oter"
                    title="Retirer cette lampe"
                    aria-label="Retirer cette lampe"
                    onClick={(e) => {
                      e.stopPropagation()
                      void window.jdr.lumieres.remove(l.id)
                    }}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <IconClose />
                  </button>
                </div>
              ))}

              {/* La porte est elle-même le bouton : un clic l'ouvre ou la
                  referme, verte ouverte, neutre fermée. Verrouillée, le clic la
                  déverrouille et l'ouvre du même geste. */}
              {(voit('porte') ? s.portes : []).map((o) => (
                <button
                  key={`o${o.id}`}
                  type="button"
                  className={`tb-ligne tb-porte ${o.verrouillee ? 'verrou' : o.ouverte ? 'ouverte' : 'fermee'}${
                    survol && survol.quoi === 'ouverture' && survol.id === o.id ? ' vise' : ''
                  }`}
                  aria-pressed={o.ouverte}
                  title={
                    o.verrouillee
                      ? 'Verrouillée — cliquer pour la déverrouiller et l’ouvrir'
                      : o.ouverte
                        ? 'Ouverte — cliquer pour la refermer'
                        : 'Fermée — cliquer pour l’ouvrir'
                  }
                  onMouseEnter={(e) => {
                    e.stopPropagation()
                    onSurvol({ quoi: 'ouverture', id: o.id })
                  }}
                  onClick={() =>
                    void window.jdr.ouvertures.update(
                      o.id,
                      o.verrouillee ? { verrouillee: false, ouverte: true } : { ouverte: !o.ouverte }
                    )
                  }
                >
                  <span className={`tb-pastille porte${o.verrouillee ? ' close' : ''}`}>
                    {o.verrouillee ? <IconVerrou /> : <IconPorte />}
                  </span>
                  <span className="tb-nom">
                    {o.nom ?? 'Porte'}
                    <em>{o.verrouillee ? 'verrouillée' : o.ouverte ? 'ouverte' : 'fermée'}</em>
                  </span>
                </button>
              ))}

              {(voit('rideau') ? s.rideaux : []).map((m) => (
                <div
                  key={`r${m.id}`}
                  className={`tb-ligne${
                    survol && survol.quoi === 'mur' && survol.id === m.id ? ' vise' : ''
                  }`}
                  onMouseEnter={(e) => {
                    e.stopPropagation()
                    onSurvol({ quoi: 'mur', id: m.id })
                  }}
                >
                  <span className={`tb-pastille rideau${m.ouvert ? '' : ' close'}`}>
                    <IconRideau />
                  </span>
                  <span className="tb-nom">
                    Rideau
                    <em>{m.ouvert ? 'ouvert' : 'tiré'}</em>
                  </span>
                  <button
                    className={`btn btn-sm${m.ouvert ? ' btn-on' : ''}`}
                    disabled={m.ouvert}
                    title="Écarter ce rideau : on verra au travers"
                    onClick={() => void tirer(m, true)}
                  >
                    Ouvrir
                  </button>
                  <button
                    className={`btn btn-sm${m.ouvert ? '' : ' btn-on'}`}
                    disabled={!m.ouvert}
                    title="Tirer ce rideau : il voile de nouveau"
                    onClick={() => void tirer(m, false)}
                  >
                    Tirer
                  </button>
                </div>
              ))}

            </section>
          )
        })}
      </div>
    </aside>
  )
}
