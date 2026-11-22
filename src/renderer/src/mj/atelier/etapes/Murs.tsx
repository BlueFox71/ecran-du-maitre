/**
 * Étape 2 — les murs. Épais, texturés, et ce sont aussi les murs du plan :
 * enregistrés, ils arrêtent les pions et les regards.
 */
import { useEffect, useRef, useState } from 'react'
import { inverserCotes, nouvelId, type MurBati, type PointCase } from '@shared/atelier'
import {
  appliquerHabillage,
  faceDuMurSous,
  fusionnerSuperpositions,
  habillageSous,
  murSous,
  pieceSous,
  rectangle
} from '@shared/atelierOutils'
import type { PropsEtape } from '../../modules/Atelier'
import { Palette } from '../Palette'
import { IconPipette } from '../../components/Icons'
import { useStore } from '../../store'
import { lieuDansLaForme, nommerPiece, piecesDuPlan } from '../../pieces'
import { ImportAsset } from '../ImportAsset'
import { contour, poignee, pointille, trait } from '../dessin'

type OutilMurs = 'tracer' | 'piece' | 'habiller' | 'nommer' | 'choisir' | 'pipette'

const OUTILS: { id: OutilMurs; label: string; aide: string }[] = [
  {
    id: 'tracer',
    label: 'Tracer',
    aide: 'Clique de coin en coin. Clic droit, double-clic ou Échap termine ; un clic sur le premier point referme le mur.'
  },
  { id: 'piece', label: 'Pièce rectangulaire', aide: 'Glisse : les quatre murs d’une pièce, d’un coup.' },
  {
    id: 'habiller',
    label: 'Habiller une pièce',
    aide: 'Clique dans une pièce : tous ses murs prennent la matière et la couleur choisies, du côté de la pièce seulement. Alt + clic retire l’habillage.'
  },
  {
    id: 'nommer',
    label: 'Nommer une pièce',
    aide: 'Clique dans une pièce fermée par des murs, puis tape son nom : elle devient un lieu, le même que dans le plan du lieu et la liste des lieux.'
  },
  { id: 'choisir', label: 'Choisir', aide: 'Clique un mur pour le choisir, glisse un coin pour le déplacer. Suppr l’efface.' },
  {
    id: 'pipette',
    label: 'Pipette',
    aide: 'Clique un mur, du côté qui t’intéresse : sa matière et sa couleur deviennent celles des prochains murs. On revient ensuite à l’outil d’avant.'
  }
]

export const EPAISSEUR_DEFAUT = 0.4

/** Quelques couleurs de mur tout de suite à portée : badigeons, enduits, papiers peints passés. */
const TEINTES = ['#e9e2d0', '#c9b48a', '#a8785a', '#7a2e2e', '#4a5e3e', '#3e5468', '#5b4a6e', '#2f2f33']

const ferme = (pts: PointCase[]): boolean =>
  pts.length > 2 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 1e-6

export function EtapeMurs(props: PropsEtape): JSX.Element {
  const { co, assets, setOutil, repeindre } = props
  const murs = assets.filter((a) => a.type === 'mur')
  const toast = useStore((s) => s.toast)
  const places = useStore((s) => s.places)
  const refreshPlaces = useStore((s) => s.refreshPlaces)
  /* La pièce qu'on est en train de nommer : son contour et le point cliqué (en cases). */
  const [aNommer, setANommer] = useState<{ pts: PointCase[]; ancre: PointCase } | null>(null)
  const [nomSaisi, setNomSaisi] = useState('')
  const [outil, setOutilMurs] = useState<OutilMurs>('piece')
  /* L'outil d'avant la pipette : on y revient une fois la matière prise. */
  const avantPipette = useRef<OutilMurs>('piece')
  const [matiere, setMatiere] = useState<string | null>(null)
  const [epaisseur, setEpaisseur] = useState(EPAISSEUR_DEFAUT)
  /* La couleur des prochains murs ; `null`, la matière telle quelle. */
  const [teinte, setTeinte] = useState<string | null>(null)
  /* Le second côté des prochains murs ; `null`, un seul côté. Et le côté
     que règlent les sections Couleur et Matière. */
  const [cote2Neuf, setCote2Neuf] = useState<{ assetId: string; teinte?: string } | null>(null)
  const [cote, setCote] = useState<1 | 2>(1)
  /* Les prochains murs : invisibles (ils ne font que découper les pièces), et bloquants ou non. */
  const [invisibleNeuf, setInvisibleNeuf] = useState(false)
  const [bloquantNeuf, setBloquantNeuf] = useState(false)
  const [choisi, setChoisi] = useState<string | null>(null)
  const points = useRef<PointCase[]>([])
  const depart = useRef<PointCase | null>(null)
  const sommet = useRef<{ murId: string; i: number } | null>(null)
  const souris = useRef<PointCase | null>(null)
  const matiereSure = matiere ?? murs[0]?.id ?? null
  const murChoisi = choisi ? co.c?.murs.find((m) => m.id === choisi) ?? null : null

  /* Les pièces se nomment en fractions du plan enregistré : il faut qu'il existe,
     et que le terrain n'ait pas changé de taille depuis. */
  const lieu = places.find((q) => q.id === props.place.id) ?? props.place
  const nommable = !!lieu.mapItemId && !co.agrandi
  const enFractions = (pts: PointCase[]): [number, number][] =>
    co.c ? pts.map(([x, y]) => [x / co.c!.largeur, y / co.c!.hauteur] as [number, number]) : []
  const pieces = piecesDuPlan(lieu, places)
  const nomDeLaPiece = (pts: PointCase[]): string | null => lieuDansLaForme(pieces, enFractions(pts))?.name ?? null
  const baptiser = async (): Promise<void> => {
    const nom = nomSaisi.trim()
    if (!aNommer || !nom) return
    const [ancre] = enFractions([aNommer.ancre])
    if (await nommerPiece(lieu, places, enFractions(aNommer.pts), ancre, nom, toast)) {
      await refreshPlaces()
      toast(`Pièce nommée : ${nom}`)
      setANommer(null)
      setNomSaisi('')
    }
  }

  const poser = (pts: PointCase[]): void => {
    const net = pts.filter((p, i, t) => !i || Math.hypot(p[0] - t[i - 1][0], p[1] - t[i - 1][1]) > 1e-6)
    if (net.length < 2 || !matiereSure) return
    const m: MurBati = {
      id: nouvelId(),
      assetId: matiereSure,
      pts: net,
      epaisseur,
      ...(teinte ? { teinte } : {}),
      ...(cote2Neuf ? { cote2: cote2Neuf } : {}),
      ...(invisibleNeuf ? { invisible: true, ...(bloquantNeuf ? { bloquant: true } : {}) } : {})
    }
    /* Un mur invisible se pose tel quel : tiré le long d'un vrai mur, il ne
       doit pas en effacer un morceau. */
    if (invisibleNeuf) return co.modifier((c) => ({ ...c, murs: [...c.murs, m] }))
    /* Un mur posé par-dessus un autre n'est pas construit deux fois : la
       partie qui se superpose est retirée (une pièce fermée garde la sienne). */
    co.modifier((c) => fusionnerSuperpositions({ ...c, murs: [...c.murs, m] }))
  }

  const finirTrace = (): void => {
    if (points.current.length >= 2) poser([...points.current])
    points.current = []
    repeindre()
  }

  const effacer = (id: string): void => {
    co.modifier((c) => ({
      ...c,
      murs: c.murs.filter((m) => m.id !== id),
      ouvertures: c.ouvertures.filter((o) => o.murId !== id)
    }))
    setChoisi(null)
  }

  useEffect(() => {
    points.current = []
    depart.current = null
    setOutil({
      curseur: outil === 'choisir' ? 'pointer' : outil === 'pipette' ? 'copy' : 'crosshair',
      onPointer: (type, p, _brut, _e, prise) => {
        souris.current = p
        if (outil === 'pipette') {
          if (type === 'down' && co.c) {
            const f = faceDuMurSous(co.c, _brut, Math.max(prise, 0.2))
            const a = f ? murs.find((x) => x.id === f.assetId) : undefined
            if (!f || !a) return void toast('Aucun mur ici.')
            /* La matière va aux prochains murs, pas au mur choisi : on le lâche. */
            setChoisi(null)
            setCote(1)
            setMatiere(a.id)
            setTeinte(f.teinte ?? null)
            setOutilMurs(avantPipette.current)
            toast(`Matière reprise : ${a.nom}${f.teinte ? ', avec sa couleur' : ''}`)
          }
          if (type === 'droit') setOutilMurs(avantPipette.current)
          return
        }
        /* Clic droit : on range l'outil et on revient à la sélection (le
           tracé en cours est terminé, une pièce entamée abandonnée). En
           sélection, il annule le coin qu'on glisse ou désélectionne. */
        if (type === 'droit') {
          if (outil === 'tracer') finirTrace()
          if (outil !== 'choisir') {
            depart.current = null
            setOutilMurs('choisir')
          } else if (sommet.current) {
            sommet.current = null
            co.annuler()
          } else setChoisi(null)
          repeindre()
          return
        }
        if (outil === 'tracer') {
          const pts = points.current
          if (type === 'down') {
            const premier = pts[0]
            if (premier && pts.length >= 2 && Math.hypot(p[0] - premier[0], p[1] - premier[1]) < Math.max(prise, 0.05)) {
              poser([...pts, premier])
              points.current = []
            } else pts.push(p)
          }
          if (type === 'dbl') finirTrace()
        } else if (outil === 'piece') {
          if (type === 'down') depart.current = p
          if (type === 'up' && depart.current) {
            const r = rectangle(depart.current, p)
            if (r) poser([...r, r[0]])
            depart.current = null
          }
        } else if (outil === 'nommer') {
          if (type === 'down' && co.c && nommable) {
            const piece = pieceSous(co.c, _brut)
            if (!piece) toast('Clique dans une pièce fermée par des murs.')
            else {
              setANommer({ pts: piece, ancre: _brut })
              setNomSaisi(nomDeLaPiece(piece) ?? '')
            }
          }
        } else if (outil === 'habiller') {
          if (type === 'down' && co.c && pieceSous(co.c, _brut)) {
            const deja = habillageSous(co.c, _brut)
            const pt = _brut
            if (_e.altKey) {
              if (deja) co.modifier((c) => ({ ...c, habillages: (c.habillages ?? []).filter((h) => h.id !== deja.id) }))
            } else if (matiereSure) {
              /* Les murs de la pièce passent à deux côtés, la face tournée vers elle habillée. */
              const face = { assetId: matiereSure, ...(teinte ? { teinte } : {}) }
              co.modifier((c) => appliquerHabillage(c, pt, face))
            }
          }
        } else {
          if (type === 'down' && co.c) {
            const s = murSous(co.c, _brut, Math.max(prise, 0.2))
            setChoisi(s?.murId ?? null)
            if (s && s.sommet !== null) {
              co.marquer()
              sommet.current = { murId: s.murId, i: s.sommet }
            }
          }
          if (type === 'move' && sommet.current) {
            const { murId, i } = sommet.current
            co.remplacer((c) => ({
              ...c,
              murs: c.murs.map((m) => {
                if (m.id !== murId) return m
                const pts = m.pts.slice()
                const boucle = ferme(m.pts)
                pts[i] = p
                /* Un mur refermé : son premier et son dernier point ne font qu'un. */
                if (boucle && i === 0) pts[pts.length - 1] = p
                if (boucle && i === pts.length - 1) pts[0] = p
                return { ...m, pts }
              })
            }))
          }
          if (type === 'up') sommet.current = null
        }
        repeindre()
      },
      dessiner: (ctx, echelle) => {
        const p = souris.current
        const ep = epaisseur
        if (outil === 'tracer' && points.current.length) {
          const pts = p ? [...points.current, p] : points.current
          trait(ctx, pts, ep)
          pointille(ctx, pts, echelle)
        }
        if ((outil === 'habiller' || outil === 'nommer') && p && co.c) {
          const piece = pieceSous(co.c, p)
          if (piece) contour(ctx, piece, echelle, true)
        }
        if (outil === 'nommer' && co.c) {
          if (aNommer) contour(ctx, aNommer.pts, echelle)
          /* Les noms déjà donnés, au point qui désigne chaque pièce. */
          ctx.save()
          ctx.font = `600 ${13 / echelle}px system-ui, sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.lineWidth = 3 / echelle
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)'
          ctx.fillStyle = '#f3e3c0'
          for (const q of pieces) {
            if (!q.ancre) continue
            const x = q.ancre[0] * co.c.largeur
            const y = q.ancre[1] * co.c.hauteur
            ctx.strokeText(q.name, x, y)
            ctx.fillText(q.name, x, y)
          }
          ctx.restore()
        }
        if (outil === 'piece' && depart.current && p) {
          const r = rectangle(depart.current, p)
          if (r) trait(ctx, [...r, r[0], r[1]], ep)
        }
        if (murChoisi) {
          trait(ctx, murChoisi.pts, murChoisi.epaisseur + 6 / echelle, 'rgba(232, 184, 92, 0.35)')
          /* Un mur à deux côtés : le côté qu'on règle est surligné. */
          if (murChoisi.cote2) {
            const sens = cote === 1 ? 1 : -1
            const dec = (murChoisi.epaisseur / 4) * sens
            for (let i = 0; i + 1 < murChoisi.pts.length; i++) {
              const [ax, ay] = murChoisi.pts[i]
              const [bx, by] = murChoisi.pts[i + 1]
              const l = Math.hypot(bx - ax, by - ay) || 1
              const nx = ((by - ay) / l) * dec
              const ny = (-(bx - ax) / l) * dec
              trait(ctx, [[ax + nx, ay + ny], [bx + nx, by + ny]], murChoisi.epaisseur / 2, 'rgba(232, 184, 92, 0.55)')
            }
          }
          murChoisi.pts.forEach((q, i) => poignee(ctx, q, echelle, sommet.current?.i === i))
        }
      }
    })
    return () => setOutil(null)
  }, [outil, matiereSure, epaisseur, teinte, cote2Neuf, cote, choisi, co.c, aNommer, places, nommable, invisibleNeuf, bloquantNeuf])

  useEffect(() => {
    const k = (e: KeyboardEvent): void => {
      const el = document.activeElement
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
      if (e.key === 'Escape') {
        if (outil === 'tracer') finirTrace()
        depart.current = null
        setChoisi(null)
        repeindre()
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && choisi) effacer(choisi)
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [outil, choisi, co])

  const regler = (patch: Partial<MurBati>): void => {
    if (!choisi) return
    co.modifier((c) => ({ ...c, murs: c.murs.map((m) => (m.id === choisi ? { ...m, ...patch } : m)) }))
  }

  /* Les deux côtés : celui des prochains murs, ou celui du mur choisi. */
  const deux = murChoisi ? !!murChoisi.cote2 : !!cote2Neuf
  const coteActif: 1 | 2 = deux ? cote : 1
  const face2 = murChoisi ? murChoisi.cote2 : cote2Neuf
  const couleur =
    (coteActif === 2 ? face2?.teinte : murChoisi ? murChoisi.teinte : teinte) ?? null
  const matiereVue = coteActif === 2 ? (face2?.assetId ?? null) : (murChoisi?.assetId ?? matiereSure)

  const changerMur = (f: (m: MurBati) => MurBati): void => {
    if (!murChoisi) return
    co.modifier((c) => ({ ...c, murs: c.murs.map((m) => (m.id === murChoisi.id ? f(m) : m)) }))
  }
  const sansCle = <T extends object, K extends keyof T>(o: T, k: K): Omit<T, K> => {
    const { [k]: _sans, ...reste } = o
    return reste
  }

  const choisirCouleur = (t: string | null): void => {
    if (coteActif === 2) {
      const f = (c2: { assetId: string; teinte?: string }) =>
        t ? { ...c2, teinte: t } : sansCle(c2, 'teinte')
      if (murChoisi) changerMur((m) => (m.cote2 ? { ...m, cote2: f(m.cote2) } : m))
      else if (cote2Neuf) setCote2Neuf(f(cote2Neuf))
      return
    }
    setTeinte(t)
    changerMur((m) => (t ? { ...m, teinte: t } : (sansCle(m, 'teinte') as MurBati)))
  }
  const choisirMatiere = (id: string): void => {
    if (coteActif === 2) {
      if (murChoisi) changerMur((m) => (m.cote2 ? { ...m, cote2: { ...m.cote2, assetId: id } } : m))
      else if (cote2Neuf) setCote2Neuf({ ...cote2Neuf, assetId: id })
      return
    }
    setMatiere(id)
    if (murChoisi) regler({ assetId: id })
  }
  const basculerDeux = (v: boolean): void => {
    setCote(v ? 2 : 1)
    if (murChoisi)
      changerMur((m) =>
        v
          ? { ...m, cote2: { assetId: m.assetId, ...(m.teinte ? { teinte: m.teinte } : {}) } }
          : (sansCle(m, 'cote2') as MurBati)
      )
    else setCote2Neuf(v && matiereSure ? { assetId: matiereSure, ...(teinte ? { teinte } : {}) } : null)
  }
  const inverser = (): void => {
    if (murChoisi) return changerMur(inverserCotes)
    if (!cote2Neuf || !matiereSure) return
    setMatiere(cote2Neuf.assetId)
    setTeinte(cote2Neuf.teinte ?? null)
    setCote2Neuf({ assetId: matiereSure, ...(teinte ? { teinte } : {}) })
  }

  return (
    <>
      <div className="at-section">
        <span className="eyebrow">Outil</span>
        <div className="at-outils">
          {OUTILS.map((o) => (
            <button
              key={o.id}
              className="btn btn-sm"
              aria-pressed={outil === o.id}
              onClick={() => {
                if (o.id === 'pipette' && outil !== 'pipette') avantPipette.current = outil
                setOutilMurs(o.id)
              }}
            >
              {o.id === 'pipette' ? <IconPipette /> : null}
              {o.label}
            </button>
          ))}
        </div>
        <p className="at-aide">{OUTILS.find((o) => o.id === outil)!.aide}</p>
        {outil === 'nommer' && !nommable ? (
          <p className="at-alerte">
            {co.agrandi
              ? 'Le terrain a changé de taille : enregistre d’abord, pour que les pièces se placent juste.'
              : 'Enregistre une première fois : les pièces se nomment sur le plan enregistré.'}
          </p>
        ) : null}
        {outil === 'nommer' && aNommer ? (
          <form
            className="at-ligne"
            onSubmit={(e) => {
              e.preventDefault()
              void baptiser()
            }}
          >
            <input
              className="at-champ"
              autoFocus
              placeholder="Le nom de la pièce…"
              value={nomSaisi}
              onChange={(e) => setNomSaisi(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setANommer(null)
              }}
            />
            <button className="btn btn-sm btn-brass" type="submit" disabled={!nomSaisi.trim()}>
              Nommer
            </button>
          </form>
        ) : null}
        <ul className="at-raccourcis">
          <li>Clic droit : revenir à la sélection (en sélection : annuler un coin qu’on glisse, ou désélectionner)</li>
        </ul>
      </div>
      <div className="at-outils">
        <button
          className="btn btn-sm"
          title="Retire les parties de murs posées l’une sur l’autre ; une pièce fermée garde ses murs"
          onClick={() => {
            const c = co.c
            if (!c) return
            const r = fusionnerSuperpositions(c)
            if (r === c) return void toast('Aucun mur ne se superpose.')
            co.modifier(() => r)
            setChoisi(null)
          }}
        >
          Fusionner les murs superposés
        </button>
        {murChoisi ? (
          <button className="btn btn-sm" onClick={() => effacer(murChoisi.id)}>
            Effacer ce mur
          </button>
        ) : null}
      </div>
      <label className="at-reglage">
        <span className="eyebrow">
          Épaisseur · {String(murChoisi ? murChoisi.epaisseur : epaisseur).replace('.', ',')} case
        </span>
        <input
          type="range"
          min={0.2}
          max={1}
          step={0.05}
          value={murChoisi ? murChoisi.epaisseur : epaisseur}
          onChange={(e) => {
            const v = Number(e.target.value)
            setEpaisseur(v)
            if (murChoisi) regler({ epaisseur: v })
          }}
        />
      </label>
      <div className="at-section">
        <label className="at-case">
          <input
            type="checkbox"
            checked={murChoisi ? !!murChoisi.invisible : invisibleNeuf}
            onChange={(e) => {
              const v = e.target.checked
              if (murChoisi)
                changerMur((m) => {
                  const { invisible: _i, bloquant: _b, ...reste } = m
                  return v ? { ...reste, invisible: true, ...(m.bloquant ? { bloquant: true } : {}) } : reste
                })
              else setInvisibleNeuf(v)
            }}
          />
          Mur invisible{murChoisi ? '' : ' (prochains murs)'}
        </label>
        {(murChoisi ? murChoisi.invisible : invisibleNeuf) ? (
          <>
            <label className="at-case">
              <input
                type="checkbox"
                checked={murChoisi ? !!murChoisi.bloquant : bloquantNeuf}
                onChange={(e) => {
                  const v = e.target.checked
                  if (murChoisi)
                    changerMur((m) => {
                      const { bloquant: _b, ...reste } = m
                      return v ? { ...reste, bloquant: true } : reste
                    })
                  else setBloquantNeuf(v)
                }}
              />
              Bloque le passage et la vue
            </label>
            <p className="at-aide">
              Il n’est pas peint sur le plan : il sépare deux pièces sous un même toit (la salle, le comptoir, la
              cuisine). Dans l’atelier, il se voit en pointillés — bleus s’il ne bloque rien, rouges s’il bloque.
            </p>
          </>
        ) : null}
      </div>
      <div className="at-section">
        <label className="at-case">
          <input type="checkbox" checked={deux} onChange={(e) => basculerDeux(e.target.checked)} />
          Deux côtés différents{murChoisi ? '' : ' (prochains murs)'}
        </label>
        {deux ? (
          <div className="at-outils">
            <button className="btn btn-sm" aria-pressed={coteActif === 1} onClick={() => setCote(1)}>
              Côté 1
            </button>
            <button className="btn btn-sm" aria-pressed={coteActif === 2} onClick={() => setCote(2)}>
              Côté 2
            </button>
            <button className="btn btn-sm" title="Échanger les deux côtés" onClick={inverser}>
              ⇄ Inverser
            </button>
          </div>
        ) : null}
      </div>
      <div className="at-section">
        <span className="eyebrow">
          Couleur{deux ? ` · côté ${coteActif}` : ''}
          {murChoisi ? ' du mur choisi' : ''}
        </span>
        <div className="at-couleurs">
          <button
            className="at-pastille at-pastille-aucune"
            aria-pressed={!couleur}
            title="La matière telle quelle"
            onClick={() => choisirCouleur(null)}
          />
          {TEINTES.map((t) => (
            <button
              key={t}
              className="at-pastille"
              style={{ background: t }}
              aria-pressed={couleur === t}
              title={t}
              onClick={() => choisirCouleur(t)}
            />
          ))}
          <label className="at-pastille at-pastille-libre" title="Une autre couleur…">
            <input type="color" value={couleur ?? '#b8a27a'} onChange={(e) => choisirCouleur(e.target.value)} />
          </label>
        </div>
      </div>
      <div className="at-section">
        <span className="eyebrow">Matière{deux ? ` · côté ${coteActif}` : ''}</span>
        <Palette assets={murs} parCategorie cle="murs" choisi={matiereVue} onChoisir={(a) => choisirMatiere(a.id)} />
      </div>
      <ImportAsset {...props} typeParDefaut="mur" />
    </>
  )
}
