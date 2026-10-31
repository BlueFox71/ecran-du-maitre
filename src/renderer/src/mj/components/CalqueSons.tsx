/**
 * Les sons posés sur un plan — l'outil « Son » de l'éditeur de plan.
 *
 * Un son posé est un cercle : quand un pion y entre, son son part. Il se pose
 * d'un clic, se déplace en le glissant, se règle en tirant sa poignée. Le
 * calque vit par-dessus celui des murs, dans le même cadre, en fractions de
 * la carte comme lui : il suit le zoom et le rognage sans rien savoir d'eux.
 *
 * Hors de l'outil, les cercles restent visibles, pâles et sans prise, comme
 * les repères : c'est le calque du MJ, jamais celui des joueurs.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { arreterApercu, ecouter, emojiDe, useSons, volumeApercu } from '../sons'
import { BarreSon } from './BarreSon'
import { Curseur } from '../modules/Sonotheque'
import { IconEye, IconEyeOff, IconLecture, IconNote, IconPlus, IconStop, IconTrash, IconVibre } from './Icons'
import { dansForme } from '@shared/pieces'
import { seCroisent, type Barriere } from '@shared/murs'
import { NATURES_SON, type NatureSon, type Place, type Son, type ZoneSon } from '@shared/types'

type Patch = Parameters<typeof window.jdr.sons.zoneUpdate>[1]

/* ============================================================
   L'état : les sons posés sur ce plan
   ============================================================ */

/** Les filtres de la liste des sons posés ; `null`, tous. */
export interface FiltresSons {
  par: ZoneSon['par'] | null
  quand: ZoneSon['quand'] | null
  /** « seul » : part de lui-même ; « feu » : attend le feu vert du MJ. */
  avant: 'seul' | 'feu' | null
}
const SANS_FILTRE: FiltresSons = { par: null, quand: null, avant: null }

function sansAccents(t: string): string {
  return t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('fr-FR')
}

/** Le son posé passe-t-il les filtres ? Une source n'attend jamais de feu vert. */
function passe(x: ZoneSon, f: FiltresSons): boolean {
  if (f.par && x.par !== f.par) return false
  if (f.quand && x.quand !== f.quand) return false
  const feu = x.confirmer && x.quand !== 'proche'
  if (f.avant === 'feu' && !feu) return false
  if (f.avant === 'seul' && feu) return false
  return true
}

export function useZonesSon(placeId: number): {
  zones: ZoneSon[]
  choisie: number | null
  setChoisie: (id: number | null) => void
  poser: (x: number, y: number) => Promise<void>
  regler: (id: number, patch: Patch) => Promise<void>
  /** Le même réglage tout de suite à l'écran, la base plus tard : le cercle qu'on glisse. */
  reglerVite: (id: number, patch: Patch) => void
  oter: (id: number) => Promise<void>
  dupliquer: (id: number) => Promise<void>
  /** Les sons qu'on a masqués sur le plan, pour voir ce qu'ils recouvrent. */
  caches: Set<number>
  basculerCache: (id: number) => void
  toutCacher: (oui: boolean) => void
  /** Masquer ou montrer d'un coup les sons d'une pièce. */
  cacherCes: (ids: number[], oui: boolean) => void
  /** Les filtres de la liste : ils tiennent tant qu'on reste sur ce plan. */
  filtres: FiltresSons
  setFiltres: (f: FiltresSons) => void
} {
  const [zones, setZones] = useState<ZoneSon[]>([])
  const [choisie, setChoisie] = useState<number | null>(null)
  const [filtres, setFiltres] = useState<FiltresSons>(SANS_FILTRE)
  /* Masquer un son ne change que le dessin de l'éditeur : il joue toujours.
     Le choix se retient par plan, d'une visite à l'autre — une commodité. */
  const cleCaches = `plan.sons.caches.${placeId}`
  const [caches, setCaches] = useState<Set<number>>(new Set())
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(cleCaches) ?? '[]')
      setCaches(new Set(Array.isArray(v) ? v.filter((x) => typeof x === 'number') : []))
    } catch {
      setCaches(new Set())
    }
  }, [cleCaches])
  const retenir = (n: Set<number>): Set<number> => {
    try {
      localStorage.setItem(cleCaches, JSON.stringify([...n]))
    } catch {
      /* sans stockage, le masque ne dure que la visite */
    }
    return n
  }
  /** Le son du dernier cercle réglé : le suivant naît avec lui. On sème une rangée de portes. */
  const dernierSon = useRef<number | null>(null)

  const relire = useCallback(async () => setZones(await window.jdr.sons.zones(placeId)), [placeId])
  useEffect(() => {
    setChoisie(null)
    void relire()
    const h = (): void => void relire()
    window.addEventListener('jdr:defait', h)
    return () => window.removeEventListener('jdr:defait', h)
  }, [relire])

  const regler = async (id: number, patch: Patch): Promise<void> => {
    if (patch.sonId !== undefined) dernierSon.current = patch.sonId
    setZones((l) => l.map((z) => (z.id === id ? { ...z, ...patch } : z)))
    const z = await window.jdr.sons.zoneUpdate(id, patch)
    if (z) setZones((l) => l.map((x) => (x.id === id ? z : x)))
  }

  return {
    zones,
    choisie,
    setChoisie,
    poser: async (x, y) => {
      const z = await window.jdr.sons.zoneAdd({ placeId, x, y, sonId: dernierSon.current })
      if (!z) return
      setZones((l) => [...l, z])
      setChoisie(z.id)
    },
    regler,
    reglerVite: (id, patch) => setZones((l) => l.map((z) => (z.id === id ? { ...z, ...patch } : z))),
    oter: async (id) => {
      await window.jdr.sons.zoneRemove(id)
      setZones((l) => l.filter((z) => z.id !== id))
      setChoisie((c) => (c === id ? null : c))
    },
    dupliquer: async (id) => {
      const av = zones.find((z) => z.id === id)
      if (!av) return
      const z = await window.jdr.sons.zoneAdd({
        placeId,
        x: Math.min(0.98, av.x + 0.04),
        y: Math.min(0.98, av.y + 0.04),
        sonId: av.sonId
      })
      if (!z) return
      const { id: _, placeId: __, x: ___, y: ____, ...reglages } = av
      const copie = await window.jdr.sons.zoneUpdate(z.id, reglages)
      setZones((l) => [...l, copie ?? z])
      setChoisie(z.id)
    },
    caches,
    basculerCache: (id) =>
      setCaches((c) => {
        const n = new Set(c)
        n.has(id) ? n.delete(id) : n.add(id)
        return retenir(n)
      }),
    toutCacher: (oui) => setCaches(retenir(new Set(oui ? zones.map((x) => x.id) : []))),
    filtres,
    setFiltres,
    cacherCes: (ids, oui) =>
      setCaches((c) => {
        const n = new Set(c)
        for (const id of ids) oui ? n.add(id) : n.delete(id)
        return retenir(n)
      })
  }
}

/* ============================================================
   L'essai qui s'entend : les sons posés, pour le MJ seul
   ============================================================ */

/**
 * Les sons posés, tels que le pion d'essai les déclencherait — dans le casque
 * du MJ, jamais à la table. On y juge la place et le rayon d'un cercle en
 * promenant le pion.
 *
 * Les règles sont celles de la partie (`src/main/sons.ts`), en plus simple :
 * on ne compte qu'une **entrée**, pas la pose ; « une seule fois » ne rejoue
 * pas avant le prochain essai ; « à chaque entrée » respecte son temps mort ;
 * une source monte quand on approche de son centre. Les murs arrêtent le son.
 * Le pion d'essai vaut pour tous : on ne trie ni joueurs ni PNJ. Un son qui
 * attend le feu vert du MJ reste muet : l'essai n'entend que ce qui part seul.
 */
export function useSonsDEssai(
  actif: boolean,
  pos: { x: number; y: number } | null,
  zones: ZoneSon[],
  murs: Barriere[] | null,
  taille: { w: number; h: number } | null
): void {
  const liste = useSons((x) => x.liste)
  const etat = useRef({
    dedans: new Set<number>(),
    faits: new Set<number>(),
    dernier: new Map<number, number>(),
    boucles: new Map<number, HTMLAudioElement>(),
    coups: new Set<HTMLAudioElement>(),
    premier: true
  })
  const enCours = actif && pos !== null

  /* Couper, c'est tout taire et tout oublier : le prochain essai repart armé. */
  useEffect(() => {
    if (!enCours) return
    const e = etat.current
    return () => {
      for (const a of [...e.boucles.values(), ...e.coups]) {
        a.pause()
        a.src = ''
      }
      e.boucles.clear()
      e.coups.clear()
      e.dedans.clear()
      e.faits.clear()
      e.dernier.clear()
      e.premier = true
    }
  }, [enCours])

  useEffect(() => {
    if (!enCours || !pos) return
    const e = etat.current
    const w = taille?.w ?? 1000
    const h = taille?.h ?? 1000
    const q = { x: pos.x * w, y: pos.y * h }
    /** 1 au centre, 0 au bord, au-delà, ou derrière un mur. */
    const gain = (z: ZoneSon): number => {
      const c = { x: z.x * w, y: z.y * h }
      const d = Math.hypot(q.x - c.x, q.y - c.y) / Math.max(1e-6, z.rayon * w)
      if (d > 1) return 0
      for (const m of murs ?? []) if (seCroisent(c, q, m.a, m.b)) return 0
      return Math.max(0, 1 - d)
    }
    const fichier = (son: Son): string | null =>
      son.fichiers.length ? (son.fichiers[Math.floor(Math.random() * son.fichiers.length)].url ?? null) : null

    const maintenant = new Set<number>()
    const sources = new Set<number>()
    for (const z of zones) {
      const son = liste.find((x) => x.id === z.sonId)
      if (!son) continue
      const g = gain(z)
      if (z.quand === 'proche') {
        if (g <= 0) continue
        sources.add(z.id)
        let a = e.boucles.get(z.id)
        if (!a) {
          const url = fichier(son)
          if (!url) continue
          a = new Audio(url)
          a.loop = true
          e.boucles.set(z.id, a)
          void a.play().catch(() => undefined)
        }
        a.volume = Math.min(1, son.volume * g)
        continue
      }
      if (g <= 0 || z.confirmer) continue
      maintenant.add(z.id)
      if (e.premier || e.dedans.has(z.id)) continue
      if (z.quand === 'une' && e.faits.has(z.id)) continue
      if (z.quand === 'chaque' && Date.now() - (e.dernier.get(z.id) ?? 0) < z.tempsMort * 1000) continue
      const url = fichier(son)
      if (!url) continue
      e.faits.add(z.id)
      e.dernier.set(z.id, Date.now())
      const a = new Audio(url)
      a.volume = son.volume
      e.coups.add(a)
      a.onended = (): void => void e.coups.delete(a)
      void a.play().catch(() => e.coups.delete(a))
    }
    /* Les sources qu'on a quittées se taisent. */
    for (const [id, a] of e.boucles)
      if (!sources.has(id)) {
        a.pause()
        a.src = ''
        e.boucles.delete(id)
      }
    e.dedans = maintenant
    e.premier = false
  }, [enCours, pos?.x, pos?.y, zones, liste, murs, taille])
}

/* ============================================================
   Le calque posé sur la carte
   ============================================================ */

export function CalqueSons({
  z,
  arme
}: {
  z: ReturnType<typeof useZonesSon>
  /** L'outil Son en main : on pose, on glisse, on règle. Sinon, on regarde. */
  arme: boolean
}): JSX.Element | null {
  const liste = useSons((x) => x.liste)
  const hote = useRef<HTMLDivElement>(null)
  const [taille, setTaille] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const el = hote.current
    if (!el) return
    const ro = new ResizeObserver(() => setTaille({ w: el.offsetWidth, h: el.offsetHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  /* Suppr retire le cercle choisi ; Échap le lâche. */
  useEffect(() => {
    if (!arme) return
    const h = (e: KeyboardEvent): void => {
      const el = e.target as HTMLElement | null
      if (el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable)) return
      if (z.choisie == null) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        void z.oter(z.choisie)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [arme, z])

  const fraction = (e: { clientX: number; clientY: number }): { x: number; y: number } => {
    const b = hote.current!.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(1, (e.clientX - b.left) / b.width)),
      y: Math.max(0, Math.min(1, (e.clientY - b.top) / b.height))
    }
  }

  /** Glisser un cercle, ou tirer sa poignée : l'écran suit, la base reçoit le point d'arrivée. */
  const saisir = (e: React.PointerEvent, zone: ZoneSon, quoi: 'deplacer' | 'rayon'): void => {
    if (!arme || e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    z.setChoisie(zone.id)
    const depart = fraction(e)
    let fin: Patch = {}
    const bouge = (ev: PointerEvent): void => {
      const p = fraction(ev)
      if (quoi === 'deplacer') {
        fin = {
          x: Math.max(0, Math.min(1, zone.x + p.x - depart.x)),
          y: Math.max(0, Math.min(1, zone.y + p.y - depart.y))
        }
      } else {
        /* Le rayon se compte en largeur de carte : on remet la hauteur à l'échelle. */
        const dx = p.x - zone.x
        const dy = ((p.y - zone.y) * taille.h) / Math.max(1, taille.w)
        fin = { rayon: Math.max(0.015, Math.min(1, Math.hypot(dx, dy))) }
      }
      z.reglerVite(zone.id, fin)
    }
    const lacher = (): void => {
      window.removeEventListener('pointermove', bouge)
      window.removeEventListener('pointerup', lacher)
      if (Object.keys(fin).length) void z.regler(zone.id, fin)
    }
    window.addEventListener('pointermove', bouge)
    window.addEventListener('pointerup', lacher)
  }

  const { w, h } = taille
  /* Un son masqué, ou écarté par les filtres de la liste, ne se dessine plus —
     sauf celui qu'on règle : on le place. */
  const vues = z.zones.filter(
    (x) => (!z.caches.has(x.id) && passe(x, z.filtres)) || (arme && z.choisie === x.id)
  )
  return (
    <div
      ref={hote}
      className={`snd-calque${arme ? ' arme' : ''}`}
      onPointerDown={(e) => {
        if (!arme || e.button !== 0) return
        e.preventDefault()
        const p = fraction(e)
        /* Un clic à côté lâche le cercle choisi ; un second, dans le vide, en pose un. */
        if (z.choisie != null) z.setChoisie(null)
        else void z.poser(p.x, p.y)
      }}
    >
      <svg width={w} height={h} viewBox={`0 0 ${Math.max(1, w)} ${Math.max(1, h)}`}>
        {vues.map((zone) => {
          const son = liste.find((x) => x.id === zone.sonId) ?? null
          const nature: NatureSon = son?.nature ?? 'bruitage'
          const cx = zone.x * w
          const cy = zone.y * h
          const r = zone.rayon * w
          const on = arme && z.choisie === zone.id
          return (
            <g
              key={zone.id}
              className={`snd-zone n-${nature}${on ? ' on' : ''}${son ? '' : ' muette'}${zone.quand === 'proche' ? ' source' : ''}`}
              onPointerDown={(e) => saisir(e, zone, 'deplacer')}
            >
              <circle cx={cx} cy={cy} r={r} className="disque" />
              {zone.quand === 'proche' ? <circle cx={cx} cy={cy} r={r * 0.5} className="coeur" /> : null}
              {on ? (
                <circle
                  cx={cx + r}
                  cy={cy}
                  r={6}
                  className="poignee"
                  onPointerDown={(e) => saisir(e, zone, 'rayon')}
                />
              ) : null}
            </g>
          )
        })}
      </svg>
      {/* Les étiquettes en HTML : un texte net, et un émoji en couleur. */}
      {vues.map((zone) => {
        const son = liste.find((x) => x.id === zone.sonId) ?? null
        return (
          <span
            key={zone.id}
            className={`snd-etiquette n-${son?.nature ?? 'bruitage'}`}
            style={{ left: `${zone.x * 100}%`, top: `${zone.y * 100}%` }}
          >
            {son ? emojiDe(son) : '🔇'} {zone.nom || son?.nom || 'Son à choisir'}
            {zone.confirmer ? ' · ✋' : ''}
          </span>
        )
      })}
    </div>
  )
}

/**
 * Les sons posés, rangés par la pièce où tombe leur centre — comme à la
 * Sonothèque. Ce qui ne tombe dans aucune ferme la liste. Sans pièce sur le
 * plan, un seul groupe sans titre : la liste d'avant.
 */
function groupesParPiece(
  zones: ZoneSon[],
  pieces: Place[]
): { cle: string; nom: string | null; zones: ZoneSon[] }[] {
  const avecForme = pieces.filter((p) => p.zone && p.zone.length >= 3)
  if (!avecForme.length) return zones.length ? [{ cle: 'tout', nom: null, zones }] : []
  const pieceDe = (x: ZoneSon): number | null =>
    avecForme.find((p) => dansForme([x.x, x.y], p.zone!))?.id ?? null
  const groupes = avecForme
    .map((p) => ({ cle: `p${p.id}`, nom: p.name, zones: zones.filter((x) => pieceDe(x) === p.id) }))
    .filter((g) => g.zones.length)
  const ailleurs = zones.filter((x) => pieceDe(x) === null)
  if (ailleurs.length) groupes.push({ cle: 'ailleurs', nom: 'Hors des pièces', zones: ailleurs })
  return groupes
}

/* ============================================================
   Le volet : le son posé qu'on a choisi, sinon la liste
   ============================================================ */

const QUANDS: { cle: ZoneSon['quand']; label: string; aide: string }[] = [
  { cle: 'une', label: 'Une seule fois', aide: 'Le premier pion qui entre le joue. Ensuite, plus rien, jusqu’à ce que tu le réarmes au Paravent.' },
  { cle: 'chaque', label: 'À chaque entrée', aide: 'À chaque pion qui entre, avec un temps mort pour ne pas le rejouer en boucle.' },
  { cle: 'proche', label: 'Tant qu’on est proche', aide: 'Une boucle dont le volume monte quand un pion approche du centre : la rivière, le feu, la machine.' }
]
const PARS: { cle: ZoneSon['par']; label: string }[] = [
  { cle: 'joueurs', label: 'Les joueurs' },
  { cle: 'pnj', label: 'Les PNJ' },
  { cle: 'tous', label: 'Tout pion' }
]
const VIBRERS: { cle: ZoneSon['vibrer']; label: string }[] = [
  { cle: 'aucun', label: 'Aucun' },
  { cle: 'lui', label: 'Celui qui entre' },
  { cle: 'tous', label: 'Tous' }
]

/**
 * L'ambiance du lieu : un son de la sonothèque, de nature « ambiance ». Le
 * lieu n'en retient qu'un fichier (`ambienceItemId`), comme le fait la
 * Sonothèque ; on retrouve le son par ce fichier. Un fichier nu, posé avant
 * la sonothèque, reste proposé tel quel tant qu'on n'en choisit pas d'autre.
 */
function AmbianceDuLieu({
  lieu,
  onChanger
}: {
  lieu: Place
  onChanger: (itemId: number | null) => Promise<void>
}): JSX.Element {
  const liste = useSons((x) => x.liste)
  const apercu = useSons((x) => x.apercu)
  const s = useStore()
  const ambiances = liste.filter((x) => x.nature === 'ambiance')
  const courant = lieu.ambienceItemId
  const son = courant != null ? liste.find((x) => x.fichiers.some((f) => f.itemId === courant)) : undefined
  const nu = courant != null && !son ? s.allItems.find((i) => i.id === courant) : undefined
  const valeur = son ? `s${son.id}` : courant != null ? `i${courant}` : ''
  return (
    <div className="field snd-ambiance">
      <label htmlFor="snd-amb">Ambiance</label>
      <div className="snd-ligne">
        <select
          id="snd-amb"
          value={valeur}
          title="L’ambiance part quand on met ce lieu en scène"
          onChange={(e) => {
            const v = e.target.value
            if (!v) return void onChanger(null)
            if (v.startsWith('i')) return
            const x = liste.find((y) => y.id === Number(v.slice(1)))
            const f = x?.fichiers[0]
            if (!f) return s.toast('Ce son n’a pas de fichier : il ne peut pas servir d’ambiance', true)
            void onChanger(f.itemId)
          }}
        >
          <option value="">— Aucune —</option>
          {courant != null && !son ? (
            <option value={`i${courant}`}>🎵 {nu?.title ?? 'Fichier introuvable'}</option>
          ) : null}
          {ambiances.map((x) => (
            <option key={x.id} value={`s${x.id}`}>
              {emojiDe(x)} {x.nom}
            </option>
          ))}
        </select>
        {son ? (
          <button
            className="snd-lire"
            disabled={!son.fichiers.length}
            aria-label="Écouter"
            title="Écouter pour toi, sans le jouer à la table"
            onClick={() => ecouter(son)}
          >
            {apercu === son.id ? <IconStop /> : <IconLecture />}
          </button>
        ) : null}
      </div>
    </div>
  )
}

/** Trois listes déroulantes au-dessus des sons posés, et de quoi tout remettre. */
function FiltresDesSons({ z }: { z: ReturnType<typeof useZonesSon> }): JSX.Element {
  const f = z.filtres
  const actifs = f.par !== null || f.quand !== null || f.avant !== null
  const n = z.zones.filter((x) => passe(x, f)).length
  return (
    <div className="snd-filtres" role="group" aria-label="Filtrer les sons posés">
      <label>
        <span>Déclenché par</span>
        <select
          value={f.par ?? ''}
          onChange={(e) => z.setFiltres({ ...f, par: (e.target.value || null) as FiltresSons['par'] })}
        >
          <option value="">Tous</option>
          {PARS.map((p) => (
            <option key={p.cle} value={p.cle}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Se déclenche</span>
        <select
          value={f.quand ?? ''}
          onChange={(e) => z.setFiltres({ ...f, quand: (e.target.value || null) as FiltresSons['quand'] })}
        >
          <option value="">Toujours</option>
          {QUANDS.map((q) => (
            <option key={q.cle} value={q.cle}>
              {q.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Avant de jouer</span>
        <select
          value={f.avant ?? ''}
          onChange={(e) => z.setFiltres({ ...f, avant: (e.target.value || null) as FiltresSons['avant'] })}
        >
          <option value="">Peu importe</option>
          <option value="seul">Joue tout seul</option>
          <option value="feu">J’attends mon feu vert</option>
        </select>
      </label>
      {actifs ? (
        <div className="snd-filtres-pied">
          <span>
            {n} sur {z.zones.length}
          </span>
          <button className="lien" onClick={() => z.setFiltres(SANS_FILTRE)}>
            Tout montrer
          </button>
        </div>
      ) : null}
    </div>
  )
}

export function VoletSons({
  z,
  pieces = [],
  metres = null,
  onChoisir,
  ambiance
}: {
  z: ReturnType<typeof useZonesSon>
  /** Les pièces de ce plan : la liste se range par la pièce où tombe chaque son. */
  pieces?: Place[]
  /** La largeur du plan en mètres, si l'échelle est connue : le rayon se règle alors en mètres. */
  metres?: number | null
  /** Choisir un son de la liste ; absent, il s'ouvre ici même. */
  onChoisir?: (id: number) => void
  /** L'ambiance du lieu, celle qui part quand on le met en scène. */
  ambiance?: { lieu: Place; onChanger: (itemId: number | null) => Promise<void> }
}): JSX.Element {
  const liste = useSons((x) => x.liste)
  const apercu = useSons((x) => x.apercu)
  const s = useStore()
  const zone = z.zones.find((x) => x.id === z.choisie) ?? null
  /* Ce qu'on tape pour trouver le son par son nom ; un autre son posé repart de zéro. */
  const [cherche, setCherche] = useState('')
  useEffect(() => setCherche(''), [zone?.id])
  /* Quitter l'outil Son, ou l'éditeur, coupe le son qu'on y écoutait. */
  useEffect(() => () => arreterApercu(), [])

  /** La liste des sons posés, par pièce, chacun avec son œil. */
  const listeGroupee = (groupes: ReturnType<typeof groupesParPiece>): JSX.Element => (
    <div className="snd-liste-zones">
      {groupes.map((g) => {
        const tousCaches = g.zones.every((x) => z.caches.has(x.id))
        return (
          <div key={g.cle} className="snd-par-piece">
            {g.nom ? (
              <div className="snd-par-piece-tete">
                <span className="eyebrow">
                  {g.nom} · {g.zones.length}
                </span>
                <button
                  className="snd-oeil"
                  aria-pressed={!tousCaches}
                  aria-label={tousCaches ? `Afficher les sons de ${g.nom}` : `Masquer les sons de ${g.nom}`}
                  title={tousCaches ? `Afficher les sons de ${g.nom}` : `Masquer les sons de ${g.nom}`}
                  onClick={() => z.cacherCes(g.zones.map((x) => x.id), !tousCaches)}
                >
                  {tousCaches ? <IconEyeOff /> : <IconEye />}
                </button>
              </div>
            ) : null}
            {g.zones.map((x) => {
              const son = liste.find((y) => y.id === x.sonId) ?? null
              const cache = z.caches.has(x.id)
              const nom = x.nom || son?.nom || 'Son à choisir'
              return (
                <div key={x.id} className={`snd-ligne-zone n-${son?.nature ?? 'bruitage'}${cache ? ' cache' : ''}`}>
                  <button className="snd-choisir" onClick={() => (onChoisir ? onChoisir(x.id) : z.setChoisie(x.id))}>
                    <span className="emo">{son ? emojiDe(son) : '🔇'}</span>
                    <span className="t">
                      <b>{nom}</b>
                      <span>{QUANDS.find((q) => q.cle === x.quand)?.label}</span>
                    </span>
                  </button>
                  <button
                    className="snd-oeil"
                    aria-pressed={!cache}
                    aria-label={cache ? `Afficher ${nom} sur le plan` : `Masquer ${nom} sur le plan`}
                    title={cache ? 'Masqué sur le plan — l’afficher' : 'Affiché sur le plan — le masquer (il joue toujours)'}
                    onClick={() => z.basculerCache(x.id)}
                  >
                    {cache ? <IconEyeOff /> : <IconEye />}
                  </button>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )

  if (!zone)
    return (
      <div className="snd-volet">
        {ambiance ? <AmbianceDuLieu {...ambiance} /> : null}
        <header>
          <span className="eyebrow">Sons posés</span>
          <h3>{z.zones.length ? `${z.zones.length} sur ce plan` : 'Aucun sur ce plan'}</h3>
          {z.zones.length ? (
            <button
              className="btn btn-sm btn-ghost snd-tout"
              title={z.caches.size ? 'Afficher tous les sons sur le plan' : 'Masquer tous les sons du plan'}
              onClick={() => z.toutCacher(!z.caches.size)}
            >
              {z.caches.size ? <IconEye /> : <IconEyeOff />}
              {z.caches.size ? 'Tout afficher' : 'Tout masquer'}
            </button>
          ) : null}
        </header>
        <p className="snd-aide">
          Clique sur le plan pour poser un son : il partira quand un pion entrera dans son cercle. Glisse
          un cercle pour le déplacer, tire sa poignée pour l’agrandir. Les murs et les portes fermées
          arrêtent le son.
        </p>
        {z.zones.length > 1 ? <FiltresDesSons z={z} /> : null}
        {listeGroupee(groupesParPiece(z.zones.filter((x) => passe(x, z.filtres)), pieces))}
        {z.zones.length && !z.zones.some((x) => passe(x, z.filtres)) ? (
          <p className="snd-aide">Aucun son posé ne répond à ces filtres.</p>
        ) : null}
        {!liste.length ? (
          <button className="btn btn-sm" onClick={() => s.setView('sons')}>
            <IconNote />
            La sonothèque est vide : y préparer des sons
          </button>
        ) : null}
      </div>
    )

  const son = liste.find((x) => x.id === zone.sonId) ?? null
  const autres = z.zones.filter((x) => x.id !== zone.id)
  const ici = pieces.find((p) => p.zone && p.zone.length >= 3 && dansForme([zone.x, zone.y], p.zone))
  const autresGroupes = groupesParPiece(autres, pieces).sort(
    (a, b) => Number(b.cle === `p${ici?.id}`) - Number(a.cle === `p${ici?.id}`)
  )
  const regler = (patch: Patch): void => void z.regler(zone.id, patch)
  const quand = QUANDS.find((q) => q.cle === zone.quand)!
  const choisirSon = (id: number | null): void => {
    const n = liste.find((x) => x.id === id)
    /* Une nappe se fait entendre de près ; un bruitage, à l'entrée. */
    regler({
      sonId: id,
      ...(n && n.nature !== 'bruitage' && zone.quand !== 'proche' ? { quand: 'proche' as const } : {}),
      ...(n && n.nature === 'bruitage' && zone.quand === 'proche' ? { quand: 'chaque' as const } : {})
    })
  }
  /* La recherche passe par-dessus les accents et les majuscules ; le son déjà
     choisi reste dans la liste, sans quoi le menu ne saurait plus l'afficher. */
  const q = sansAccents(cherche.trim())
  const trouves = q ? liste.filter((x) => sansAccents(x.nom).includes(q)) : liste
  const proposes = son && !trouves.includes(son) ? [son, ...trouves] : trouves

  return (
    <div className={`snd-volet n-${son?.nature ?? 'bruitage'}`}>
      <header>
        <span className="snd-pastille">son posé{son ? ` · ${NATURES_SON[son.nature].label}` : ''}</span>
        <input
          key={zone.id}
          className="snd-nom-champ"
          type="text"
          aria-label="Nom de l’endroit"
          placeholder={son?.nom ?? 'Nom de l’endroit'}
          defaultValue={zone.nom}
          onBlur={(e) => e.target.value !== zone.nom && regler({ nom: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      </header>

      <div className="field">
        <label htmlFor="snd-z-son">Son</label>
        {liste.length > 1 ? (
          <input
            className="snd-cherche"
            type="search"
            aria-label="Rechercher un son par son nom"
            placeholder="Rechercher un son…"
            value={cherche}
            onChange={(e) => setCherche(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation()
              /* Entrée prend le premier son trouvé. */
              if (e.key === 'Enter' && q && trouves.length) {
                choisirSon(trouves[0].id)
                setCherche('')
              } else if (e.key === 'Escape') setCherche('')
            }}
          />
        ) : null}
        {q && !trouves.length ? <span className="snd-aide">Aucun son ne porte ce nom.</span> : null}
        <div className="snd-ligne">
          <select
            id="snd-z-son"
            value={zone.sonId ?? ''}
            onChange={(e) => {
              choisirSon(e.target.value ? Number(e.target.value) : null)
              setCherche('')
            }}
          >
            <option value="">
              {q ? `— ${trouves.length} son${trouves.length > 1 ? 's' : ''} trouvé${trouves.length > 1 ? 's' : ''} —` : '— Choisir un son —'}
            </option>
            {(['bruitage', 'nappe', 'ambiance'] as NatureSon[]).map((n) =>
              proposes.some((x) => x.nature === n) ? (
                <optgroup key={n} label={NATURES_SON[n].pluriel}>
                  {proposes
                    .filter((x) => x.nature === n)
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {emojiDe(x)} {x.nom}
                      </option>
                    ))}
                </optgroup>
              ) : null
            )}
          </select>
          <button
            className="snd-lire"
            disabled={!son?.fichiers.length}
            aria-label="Écouter"
            title="Écouter pour toi, sans le jouer à la table"
            onClick={() => son && ecouter(son)}
          >
            {son && apercu === son.id ? <IconStop /> : <IconLecture />}
          </button>
        </div>
        {son ? <BarreSon son={son} /> : null}
      </div>

      {son ? (
        <Curseur
          label="Volume du son"
          value={son.volume * 100}
          max={100}
          unite=" %"
          volume
          onChange={async (v) => {
            /* Le volume est celui du son : il change aussi dans la sonothèque. */
            volumeApercu(v / 100)
            useSons.getState().poser(await window.jdr.sons.update(son.id, { volume: v / 100 }))
          }}
        />
      ) : null}

      <div className="field">
        <label>Se déclenche</label>
        <div className="snd-seg snd-seg-plein">
          {QUANDS.map((q) => (
            <button key={q.cle} className={zone.quand === q.cle ? 'on' : ''} onClick={() => regler({ quand: q.cle })}>
              {q.label}
            </button>
          ))}
        </div>
        <span className="snd-aide">{quand.aide}</span>
      </div>

      {zone.quand === 'chaque' ? (
        <Curseur label="Temps mort" value={zone.tempsMort} max={120} unite=" s" onChange={(v) => regler({ tempsMort: v })} />
      ) : null}

      <div className="field">
        <label>Déclenché par</label>
        <div className="snd-seg snd-seg-plein">
          {PARS.map((p) => (
            <button key={p.cle} className={zone.par === p.cle ? 'on' : ''} onClick={() => regler({ par: p.cle })}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {zone.quand !== 'proche' ? (
        <>
          <div className="field">
            <label>Avant de jouer</label>
            <div className="snd-seg snd-seg-plein">
              <button className={!zone.confirmer ? 'on' : ''} onClick={() => regler({ confirmer: false })}>
                Joue tout seul
              </button>
              <button className={zone.confirmer ? 'on' : ''} onClick={() => regler({ confirmer: true })}>
                J’attends mon feu vert
              </button>
            </div>
            <span className="snd-aide">Le feu vert s’allume au Paravent : utile quand le son trahirait un secret.</span>
          </div>
          <div className="field">
            <label>
              <IconVibre /> Téléphones qui vibrent
            </label>
            <div className="snd-seg snd-seg-plein">
              {VIBRERS.map((v) => (
                <button key={v.cle} className={zone.vibrer === v.cle ? 'on' : ''} onClick={() => regler({ vibrer: v.cle })}>
                  {v.label}
                </button>
              ))}
            </div>
            {zone.vibrer !== 'aucun' && son && !son.vibration ? (
              <span className="snd-aide">Ce son n’a pas de vibration : règle-la dans la sonothèque.</span>
            ) : null}
          </div>
        </>
      ) : null}

      {/* Le rayon reste rangé en part de la largeur du plan ; on le montre en
          mètres dès que l'échelle est connue — sinon, faute de mieux, en %. */}
      {metres ? (
        <Curseur
          label="Rayon"
          value={Math.round(zone.rayon * metres * 10) / 10}
          min={Math.round(0.015 * metres * 10) / 10 || 0.1}
          max={Math.ceil(0.6 * metres)}
          step={0.1}
          decimales={1}
          unite=" m"
          onChange={(v) => regler({ rayon: Math.max(0.001, Math.min(1, v / metres)) })}
        />
      ) : (
        <>
          <Curseur label="Rayon" value={zone.rayon * 100} min={1.5} max={60} step={0.5} decimales={1} unite=" %" onChange={(v) => regler({ rayon: v / 100 })} />
          <span className="snd-aide">Le plan n’a pas d’échelle : le rayon se compte en part de sa largeur. Donne-lui une échelle pour le régler en mètres.</span>
        </>
      )}

      <div className="snd-pied">
        <button className="btn btn-sm" title="Le même son posé à côté, mêmes réglages" onClick={() => void z.dupliquer(zone.id)}>
          <IconPlus />
          Dupliquer
        </button>
        <button className="btn btn-sm btn-ghost btn-danger" title="Retirer ce son du plan — Suppr" onClick={() => void z.oter(zone.id)}>
          <IconTrash />
          Retirer
        </button>
        <span className="snd-aide">
          Invisible des joueurs, sur l’écran comme sur les téléphones. <b>Échap</b> ou un clic à côté le lâche.
        </span>
      </div>

      {/* Les autres sons du plan, ceux de la même pièce d'abord : on passe de
          l'un à l'autre sans revenir à la liste. */}
      {autres.length ? (
        <div className="snd-autres">
          <span className="eyebrow">Les autres sons · {autres.length}</span>
          {listeGroupee(autresGroupes)}
        </div>
      ) : null}
    </div>
  )
}
