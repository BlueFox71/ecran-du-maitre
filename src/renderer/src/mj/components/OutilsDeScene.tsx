import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { IconPlus, IconSoleil, IconTrash, IconType } from './Icons'
import { LAMPE_NEUVE } from './Murs'
import type { OutilAnnotation } from './Annotations'
import {
  COLLAGE_CELLS,
  PION_COULEURS,
  TEXTE_COULEURS,
  TEXTE_NEUF,
  texteNeuf
} from '@shared/types'
import type { Annotation, CalqueBrouillard, SlidePayload, TextOverlay } from '@shared/types'

/* ============================================================
   Les outils de scène que le Paravent partage avec la Régie : les
   textes posés sur l'écran, la case visée d'un collage, les
   annotations du MJ, l'œil des joueurs et le sens de l'encart.

   Repris de la Régie geste pour geste — mêmes envois, mêmes répits
   de frappe, mêmes libellés —, pour qu'on retrouve ses outils d'une
   page à l'autre. La Régie garde encore sa propre copie ; elle
   pourra venir puiser ici à son tour.
   ============================================================ */

/* ---------------- l'œil des joueurs ---------------- */

/**
 * Le calque du lieu qu'on arrange : murs, portes, lumières. Il retient les
 * pions, allume le tableau de scène, et pose sur demande l'ombre exacte de
 * l'écran des joueurs. Il se relit dès que quelque chose bouge dessus.
 */
export function useCalqueDuLieu(
  placeId: number | null,
  ...relire: unknown[]
): CalqueBrouillard | null {
  const [calque, setCalque] = useState<CalqueBrouillard | null>(null)
  useEffect(() => {
    let vivant = true
    if (placeId == null) {
      setCalque(null)
      return
    }
    void window.jdr.murs.calque(placeId).then((c) => {
      if (vivant) setCalque(c)
    })
    return () => {
      vivant = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeId, ...relire])
  return calque
}

/* ---------------- les textes posés sur l'écran ---------------- */

export interface TextesEcran {
  textes: TextOverlay[]
  over: TextOverlay | null
  ouvert: boolean
  basculer: () => void
  champ: string
  tape: (v: string) => void
  finFrappe: () => void
  vide: () => void
  ajoute: () => void
  choisit: (id: number) => void
  retire: () => void
  pose: (patch: Partial<TextOverlay>) => void
  bouge: (id: number, x: number, y: number) => void
}

/**
 * Les textes du visuel qu'on regarde. On envoie toujours la liste entière,
 * et jamais une lettre à la fois : les joueurs verraient le texte s'écrire.
 */
export function useTextesEcran(slide: SlidePayload, onLive: boolean): TextesEcran {
  const textes = slide.texts ?? []
  const [sel, setSel] = useState<number | null>(null)
  const [ouvert, setOuvert] = useState(false)
  const [champ, setChamp] = useState('')
  const ecrit = useRef(false)
  const frappe = useRef<number>()
  const enAttente = useRef<{ id: number | null; v: string } | null>(null)
  const over = textes.find((t) => t.id === sel) ?? textes[textes.length - 1] ?? null

  const envoie = (liste: TextOverlay[]): void =>
    void window.jdr.display.texts(onLive ? 'live' : 'prep', liste)

  const pose = (patch: Partial<TextOverlay>): void => {
    if (!over) {
      const neuf = { ...texteNeuf(Date.now(), 0), ...patch }
      setSel(neuf.id)
      envoie([...textes, neuf])
      return
    }
    envoie(textes.map((t) => (t.id === over.id ? { ...t, ...patch } : t)))
  }

  const vide = (): void => {
    window.clearTimeout(frappe.current)
    const p = enAttente.current
    enAttente.current = null
    if (!p) return
    if (p.id == null) pose({ text: p.v })
    else envoie(textes.map((t) => (t.id === p.id ? { ...t, text: p.v } : t)))
  }

  // On change de texte, ou de visuel : le champ suit — sauf pendant la frappe.
  useEffect(() => {
    if (!ecrit.current) setChamp(over?.text ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onLive, over?.id, over?.text])

  return {
    textes,
    over,
    ouvert,
    basculer: () => {
      vide()
      if (ouvert) setSel(null)
      setOuvert((v) => !v)
    },
    champ,
    tape: (v) => {
      setChamp(v)
      ecrit.current = true
      enAttente.current = { id: over?.id ?? null, v }
      window.clearTimeout(frappe.current)
      frappe.current = window.setTimeout(vide, 250)
    },
    finFrappe: () => {
      ecrit.current = false
    },
    vide,
    ajoute: () => {
      setOuvert(true)
      vide()
      const neuf = texteNeuf(Date.now(), textes.length)
      ecrit.current = false
      setChamp('')
      setSel(neuf.id)
      envoie([...textes, neuf])
    },
    /* Cliquer un texte sur le visuel passe par ici, et ouvre donc le volet. */
    choisit: (id) => {
      setOuvert(true)
      if (id === over?.id) {
        setSel(id)
        return
      }
      vide()
      ecrit.current = false
      setSel(id)
    },
    retire: () => {
      if (!over) return
      window.clearTimeout(frappe.current)
      enAttente.current = null
      ecrit.current = false
      setChamp('')
      setSel(null)
      envoie(textes.filter((t) => t.id !== over.id))
    },
    pose,
    bouge: (id, x, y) => envoie(textes.map((t) => (t.id === id ? { ...t, x, y } : t)))
  }
}

export function VoletTextes({ t, onLive }: { t: TextesEcran; onLive: boolean }): JSX.Element {
  return (
    <div className="tray tray-texte">
      <span className="eyebrow">Textes</span>
      <div className="onglets-textes">
        {t.textes.map((x, n) => (
          <button
            key={x.id}
            className={`t-chip${t.over?.id === x.id ? ' on' : ''}`}
            style={{ borderLeftColor: x.color }}
            onClick={() => t.choisit(x.id)}
            title={x.text || `Texte ${n + 1}`}
          >
            {x.text.trim() || `Texte ${n + 1}`}
          </button>
        ))}
        <button className="t-chip plus" onClick={t.ajoute} title="Ajouter un texte">
          +
        </button>
      </div>

      <input
        className="texte-champ"
        value={t.champ}
        placeholder={
          onLive ? 'Écrire sur l’écran des joueurs…' : 'Écrire sur l’écran en préparation…'
        }
        onChange={(e) => t.tape(e.target.value)}
        onBlur={t.finFrappe}
      />

      <span className="sep" />
      <label className="size" title="Corps du texte, en pourcentage de la largeur">
        <span className="eyebrow">Corps</span>
        <input
          type="range"
          min={1.5}
          max={14}
          step={0.25}
          value={t.over?.size ?? TEXTE_NEUF.size}
          onChange={(e) => t.pose({ size: Number(e.target.value) })}
        />
        <span className="val num">{(t.over?.size ?? TEXTE_NEUF.size).toFixed(2)} %</span>
      </label>

      <span className="sep" />
      <div className="teintes">
        {TEXTE_COULEURS.map((c) => (
          <button
            key={c.hex}
            className={`teinte${(t.over?.color ?? TEXTE_NEUF.color) === c.hex ? ' on' : ''}`}
            style={{ background: c.hex }}
            title={c.name}
            aria-label={c.name}
            onClick={() => t.pose({ color: c.hex })}
          />
        ))}
      </div>

      <label className="coche" title="Bandeau sombre derrière le texte">
        <input
          type="checkbox"
          checked={t.over?.plate ?? TEXTE_NEUF.plate}
          onChange={(e) => t.pose({ plate: e.target.checked })}
        />
        <span>Cartouche</span>
      </label>

      <div className="spacer" />
      {t.textes.length > 1 ? (
        <span className="note">Clique un texte sur l’écran pour le modifier.</span>
      ) : null}
      <button className="btn btn-sm btn-danger" disabled={!t.over} onClick={t.retire}>
        <IconTrash />
        Supprimer
      </button>
    </div>
  )
}

/** Le bouton qui ouvre et referme le volet des textes. */
export function BoutonTextes({ t, petit }: { t: TextesEcran; petit?: boolean }): JSX.Element {
  return (
    <button
      className={`btn${petit ? ' btn-sm' : ''}${t.ouvert ? ' btn-on' : ''}`}
      aria-expanded={t.ouvert}
      onClick={t.basculer}
      title={
        t.ouvert
          ? 'Refermer le volet des textes — ce qui est posé à l’écran y reste'
          : 'Écrire sur l’écran : le volet s’ouvre, et un clic sur un texte du visuel l’ouvre aussi'
      }
    >
      <IconType />
      Textes
      {t.textes.length ? <span className="kbd num">{t.textes.length}</span> : null}
    </button>
  )
}

/* ---------------- la case visée d'un collage ---------------- */

/**
 * Sa légende si elle porte une image, son texte si elle n'en porte pas. On ne
 * compose que l'écran en préparation : sur le direct, le champ se fige.
 */
export function VoletCase({
  slide,
  iCase,
  onLive
}: {
  slide: SlidePayload
  iCase: number
  onLive: boolean
}): JSX.Element | null {
  const caseVisee = slide.type === 'collage' ? (slide.cells[iCase] ?? null) : null
  const contenu =
    caseVisee?.kind === 'texte'
      ? caseVisee.texte
      : caseVisee?.kind === 'image'
        ? (caseVisee.caption ?? '')
        : ''
  const [champ, setChamp] = useState(contenu)
  const ecrit = useRef(false)
  const frappe = useRef<number>()
  useEffect(() => {
    if (!ecrit.current) setChamp(contenu)
  }, [contenu, iCase])

  if (slide.type !== 'collage') return null

  const tape = (v: string): void => {
    setChamp(v)
    ecrit.current = true
    const image = caseVisee?.kind === 'image'
    window.clearTimeout(frappe.current)
    frappe.current = window.setTimeout(() => {
      if (image) void window.jdr.display.cellCaption(iCase, v)
      else void window.jdr.display.cellText(iCase, v)
    }, 250)
  }

  return (
    <div className="tray tray-case">
      <span className="eyebrow">Case {iCase + 1}</span>
      <input
        className="texte-champ"
        value={champ}
        disabled={onLive}
        placeholder={
          onLive
            ? 'On ne compose que l’écran en préparation'
            : caseVisee?.kind === 'image'
              ? 'Légender cette case — le carton sous le tableau…'
              : 'Écrire dans cette case, ou y poser une image d’un clic…'
        }
        onChange={(e) => tape(e.target.value)}
        onBlur={() => {
          ecrit.current = false
        }}
      />
      {caseVisee?.kind === 'texte' ? (
        <>
          <span className="sep" />
          <div className="teintes">
            {TEXTE_COULEURS.map((c) => (
              <button
                key={c.hex}
                className={`teinte${(caseVisee.color ?? TEXTE_NEUF.color) === c.hex ? ' on' : ''}`}
                style={{ background: c.hex }}
                title={c.name}
                aria-label={c.name}
                onClick={() => void window.jdr.display.cellText(iCase, champ, c.hex)}
              />
            ))}
          </div>
        </>
      ) : null}
      <div className="spacer" />
      <button
        className="btn btn-sm btn-danger"
        disabled={onLive || !caseVisee}
        onClick={() => {
          window.clearTimeout(frappe.current)
          ecrit.current = false
          setChamp('')
          void window.jdr.display.prepareCell(iCase, null)
        }}
      >
        <IconTrash />
        Vider la case
      </button>
    </div>
  )
}

/** La case visée d'un collage, ramenée au nombre de cases de sa disposition. */
export const caseDuCollage = (slide: SlidePayload, activeCell: number): number =>
  slide.type === 'collage' ? activeCell % COLLAGE_CELLS[slide.layout] : 0

/* ---------------- les annotations du MJ ---------------- */

export interface AnnotationsScene {
  annots: Annotation[]
  outil: OutilAnnotation
  setOutil: (o: OutilAnnotation) => void
  choisie: number | null
  setChoisie: (id: number | null) => void
  poser: (kind: 'repere' | 'texte', x: number, y: number) => Promise<void>
  deplacer: (id: number, x: number, y: number) => Promise<void>
  effacer: (id: number) => Promise<void>
  relire: () => Promise<void>
}

/**
 * Les repères du lieu qu'on arrange. De l'état **local** : ils ne transitent
 * pas par l'écran, donc la fenêtre joueurs ne peut pas les recevoir.
 */
export function useAnnotationsScene(placeId: number | null, voir: boolean): AnnotationsScene {
  const [annots, setAnnots] = useState<Annotation[]>([])
  const [outil, setOutil] = useState<OutilAnnotation>(null)
  const [choisie, setChoisie] = useState<number | null>(null)
  const relire = async (): Promise<void> => setAnnots(await window.jdr.annotations.of(placeId))

  useEffect(() => {
    if (!voir) {
      setAnnots([])
      setOutil(null)
      setChoisie(null)
      return
    }
    void relire()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voir, placeId])

  /* Un Ctrl+Z de préparation peut rendre ou retirer un repère. */
  useEffect(() => {
    if (!voir) return
    const h = (): void => void relire()
    window.addEventListener('jdr:defait', h)
    return () => window.removeEventListener('jdr:defait', h)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voir, placeId])

  return {
    annots,
    outil,
    setOutil,
    choisie,
    setChoisie,
    poser: async (kind, x, y) => {
      if (placeId == null) return
      const a = await window.jdr.annotations.add({ placeId, kind, x, y })
      await relire()
      setChoisie(a.id)
      setOutil(null)
    },
    deplacer: async (id, x, y) => {
      await window.jdr.annotations.move(id, x, y)
      await relire()
    },
    effacer: async (id) => {
      await window.jdr.annotations.remove(id)
      setChoisie(null)
      await relire()
    },
    relire
  }
}

export function VoletAnnoter({ a }: { a: AnnotationsScene }): JSX.Element {
  const enCours = a.annots.find((x) => x.id === a.choisie) ?? null
  return (
    <div className="tray annot-regie">
      <span className="eyebrow">Annoter</span>
      <button
        className={`btn btn-sm${a.outil === 'repere' ? ' btn-on' : ''}`}
        onClick={() => a.setOutil(a.outil === 'repere' ? null : 'repere')}
        title="Puis clique sur la carte"
      >
        <IconPlus />
        Repère
      </button>
      <button
        className={`btn btn-sm${a.outil === 'texte' ? ' btn-on' : ''}`}
        onClick={() => a.setOutil(a.outil === 'texte' ? null : 'texte')}
        title="Puis clique sur la carte"
      >
        <IconType />
        Texte
      </button>

      <span className="sep" />
      {enCours ? (
        <>
          <span className="eyebrow">
            {enCours.kind === 'repere' ? `Repère ${enCours.num}` : 'Texte'}
          </span>
          <input
            className="annot-ligne"
            type="text"
            value={enCours.texte}
            placeholder="Ce que tu notes ici…"
            onChange={async (e) => {
              await window.jdr.annotations.update(enCours.id, { texte: e.target.value })
              await a.relire()
            }}
          />
          <div className="couleurs">
            {PION_COULEURS.slice(0, 6).map((c) => (
              <button
                key={c.key}
                className="pastille"
                style={{ ['--p' as string]: c.hex }}
                aria-pressed={(enCours.color ?? 'brass') === c.key}
                title={c.name}
                onClick={async () => {
                  await window.jdr.annotations.update(enCours.id, { color: c.key })
                  await a.relire()
                }}
              />
            ))}
          </div>
          <button className="btn btn-sm btn-danger" onClick={() => void a.effacer(enCours.id)}>
            <IconTrash />
            Effacer
          </button>
        </>
      ) : (
        <span className="note">
          {a.outil
            ? 'Clique sur la carte pour le poser.'
            : 'Clique un repère pour l’écrire · jamais vu des joueurs.'}
        </span>
      )}
    </div>
  )
}

/* ---------------- le sens de l'encart ---------------- */

/**
 * En ligne ou en colonne, ses dimensions en chiffres, et de quoi le remettre
 * à sa place d'origine. La place et la taille se prennent à la main sur la
 * scène ; ici, seulement le sens de lecture.
 */
export function SensEncart(): JSX.Element {
  const encart = useStore((s) => s.display?.encart)
  return (
    <>
      <div className="seg" role="group" aria-label="Sens de l’encart">
        {(['horizontal', 'vertical'] as const).map((v) => (
          <button
            key={v}
            className={encart?.sens === v ? 'on' : ''}
            disabled={!encart?.on}
            onClick={() =>
              /* Changer de sens fait pivoter la boîte : sans quoi trois joueurs
                 empilés dans un bandeau bas deviendraient illisibles. */
              void window.jdr.display.encart({
                sens: v,
                largeur: encart?.hauteur ?? 13,
                hauteur: encart?.largeur ?? 46
              })
            }
            title={v === 'horizontal' ? 'Les joueurs en ligne' : 'Les joueurs en colonne'}
          >
            {v === 'horizontal' ? 'En ligne' : 'En colonne'}
          </button>
        ))}
      </div>
      <span className="eyebrow num">
        {Math.round(encart?.largeur ?? 0)} × {Math.round(encart?.hauteur ?? 0)} %
      </span>
      <button
        className="btn btn-sm btn-ghost"
        disabled={!encart?.on}
        title="Remettre l’encart en bas au milieu, à sa taille d’origine"
        onClick={() => void window.jdr.display.encart({ x: 0.5, y: 0.88, largeur: 46, hauteur: 13 })}
      >
        Recentrer
      </button>
    </>
  )
}

/* ---------------- poser une lumière en pleine partie ---------------- */

export interface PoseLumiere {
  arme: boolean
  basculer: () => void
  /** À passer à `onPoserSurCarte` de la scène quand l'outil est armé. */
  poser: ((x: number, y: number) => void) | undefined
  possible: boolean
  raison: string
}

/**
 * Un joueur allume une bougie, pose une lanterne : le MJ arme l'outil et
 * clique dans la pièce. La lampe naît allumée, à la portée d'une lampe neuve,
 * sur le lieu à l'écran — celui qui porte les murs —, et l'écran des joueurs
 * la voit aussitôt. Elle se règle ensuite dans le tableau de scène, et un
 * Ctrl+Z la retire.
 *
 * Il faut des murs : sans eux, pas de brouillard, et une lampe n'éclairerait
 * rien que les joueurs ne voient déjà.
 */
export function usePoseLumiere(placeId: number | null, calque: CalqueBrouillard | null): PoseLumiere {
  const [arme, setArme] = useState(false)
  const possible = placeId != null && !!calque?.murs.length
  // On change de lieu, ou il perd ses murs : l'outil se désarme.
  useEffect(() => {
    if (!possible) setArme(false)
  }, [possible, placeId])
  // Échap renonce, comme partout.
  useEffect(() => {
    if (!arme) return
    const h = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setArme(false)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [arme])
  return {
    arme,
    basculer: () => setArme((v) => !v && possible),
    poser:
      arme && placeId != null
        ? (x, y) => {
            setArme(false)
            void window.jdr.lumieres.add({
              placeId,
              x,
              y,
              clair: LAMPE_NEUVE.clair,
              penombre: LAMPE_NEUVE.penombre
            })
          }
        : undefined,
    possible,
    raison: placeId == null
      ? 'Mets d’abord un lieu à l’écran'
      : !calque?.murs.length
        ? 'Ce lieu n’a pas de murs : sans brouillard, une lampe n’éclaire rien de plus'
        : arme
          ? 'Clique dans la pièce où poser la lumière — Échap pour renoncer'
          : 'Poser une lumière : une bougie qu’on allume, une lanterne qu’on pose'
  }
}

export function BoutonPoserLumiere({ p, petit }: { p: PoseLumiere; petit?: boolean }): JSX.Element {
  return (
    <button
      className={`btn${petit ? ' btn-sm' : ''}${p.arme ? ' btn-on' : ''}`}
      onClick={p.basculer}
      disabled={!p.possible}
      aria-pressed={p.arme}
      title={p.raison}
    >
      <IconSoleil />
      {p.arme ? 'Clique dans la pièce…' : 'Lumière'}
    </button>
  )
}
