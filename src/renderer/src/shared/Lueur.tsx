/**
 * La lueur d'une lampe : pleine jusqu'au rayon clair, puis qui baisse jusqu'au
 * bord de la pénombre.
 *
 * Le clair et la pénombre ne se distinguaient pas à l'écran : tout ce que la
 * lampe touchait était aussi éclairé. Ici la pénombre **se voit** : elle
 * descend jusqu'à `PENOMBRE_BORD` — le noir, réglé ainsi par Jules —, et ce
 * qui s'y trouve reste pourtant découvert. Ce qui est vu ne change pas ;
 * seule l'allure change.
 *
 * Le dégradé est radial depuis la lampe, et c'est le polygone — arrêté par
 * les murs, ou taillé en faisceau — qui en garde la forme.
 */
import { champDeVision, polygone, type Barriere, type Pt } from '@shared/murs'

export interface Lueur {
  /** Le polygone éclairé, déjà arrêté par les murs. */
  pts: Pt[]
  /** La lampe, en pixels de l'image. */
  c: Pt
  /** Le bord de la pénombre, en pixels. */
  r: number
  /** La part du rayon où il fait plein jour : clair / pénombre. */
  f: number
}

/** Ce qu'il reste de lumière au bord de la pénombre. */
export const PENOMBRE_BORD = 0

/** Une torche portée n'a qu'un rayon : son plein jour en tient cette part. */
export const CLAIR_DE_TORCHE = 0.6

/** La couleur d'une flamme portée : un jaune chaud, posé sur ce qu'elle éclaire. */
export const TEINTE_TORCHE = '#ffc23d'

/**
 * Le halo d'une lampe orientée : ce qu'elle laisse filer dans son dos.
 *
 * Un faisceau coupé net au ras de la lampe laissait le noir complet juste
 * derrière elle — une applique un peu de biais sur son mur y découpait un
 * coin d'ombre, où le pion d'essai ne voyait rien. Une vraie lampe éclaire
 * aussi un peu autour d'elle : un rond, arrêté par les murs, qui va du plein
 * jour sur la lampe au noir au bout de son rayon clair. Les lampes tout
 * autour n'en ont pas besoin.
 */
export function halosDesLampes(
  lumieres: { x: number; y: number; ouverture: number; clair: number; allumee: boolean }[],
  barrieres: Barriere[],
  w: number,
  h: number
): Lueur[] {
  return lumieres
    .filter((l) => l.allumee && l.ouverture < 360 && l.clair > 0)
    .map((l) => {
      const c = { x: l.x * w, y: l.y * h }
      return { pts: champDeVision(barrieres, c, 0, 360, l.clair * w), c, r: l.clair * w, f: 0 }
    })
}

export const gris = (v: number): string => {
  const n = Math.round(Math.min(1, Math.max(0, v)) * 255)
  return `rgb(${n},${n},${n})`
}

/**
 * Les dégradés, un par lueur, à poser dans un masque. `ombre` les inverse :
 * pour un masque où le blanc est le noir de la carte.
 */
export function DegradesLueurs({
  lueurs,
  id,
  ombre = false
}: {
  lueurs: Lueur[]
  id: string
  ombre?: boolean
}): JSX.Element {
  const plein = ombre ? gris(0) : gris(1)
  const bord = ombre ? gris(1 - PENOMBRE_BORD) : gris(PENOMBRE_BORD)
  return (
    <>
      {lueurs.map((l, i) => (
        <radialGradient
          key={i}
          id={`${id}-${i}`}
          gradientUnits="userSpaceOnUse"
          cx={l.c.x}
          cy={l.c.y}
          r={Math.max(1, l.r)}
        >
          <stop offset={0} stopColor={plein} />
          <stop offset={Math.min(1, Math.max(0, l.f))} stopColor={plein} />
          <stop offset={1} stopColor={bord} />
        </radialGradient>
      ))}
    </>
  )
}

/** La part de la portée du regard où l'on voit net ; au-delà, ça s'efface. */
export const REGARD_NET = 0.92

/**
 * La vision périphérique, de chaque côté du regard net.
 *
 * Un œil humain couvre environ 200° : 120° vus des deux yeux, nets, et le
 * reste sur les bords, flou — on devine un mouvement, on ne lit rien. Le
 * réglage d'ouverture dit la part nette ; on y ajoute ces degrés de chaque
 * côté, vus à `VUE_PERIPHERIQUE` seulement. « Tout autour » n'en a pas.
 */
export const PERIPHERIE_DEG = 40
export const VUE_PERIPHERIQUE = 0.4
/**
 * Le flou des bords du regard, en part de la largeur de la carte : le passage
 * du net au flou, et du flou au noir, se fait en douceur plutôt que d'un trait.
 */
export const FLOU_REGARD = 0.005

/** Le filtre qui adoucit les bords du regard, à poser dans les `defs`. */
export function FlouRegard({ id, w, h }: { id: string; w: number; h: number }): JSX.Element {
  return (
    <filter id={id} filterUnits="userSpaceOnUse" x={0} y={0} width={w} height={h}>
      <feGaussianBlur stdDeviation={Math.max(0.5, w * FLOU_REGARD)} />
    </filter>
  )
}

/** L'ouverture totale, bords compris. */
export const ouvertureAvecBords = (ouverture: number): number =>
  ouverture >= 360 ? 360 : Math.min(360, ouverture + 2 * PERIPHERIE_DEG)

/**
 * Ce qu'on voit à travers une vitre, en part de ce qu'on verrait sans elle :
 * le verre est vieux, sale, la pièce derrière se devine plus qu'elle ne se lit.
 */
export const VUE_VITRE = 0.5

/** Une part du regard, et ce qu'on y voit — 1 au plus net. */
export interface Couche {
  pts: Pt[]
  force: number
}

/**
 * Les couches d'un regard, de la plus faible à la plus nette : ses côtés et sa
 * part nette, chacun vu directement ou à travers une vitre. `sansVitres`, les
 * mêmes murs où les vitres ne laissent rien passer ; `null` s'il n'y a pas de
 * vitre sur la carte, et l'on s'épargne la moitié des calculs. `portee` en
 * pixels ; `null`, sans limite.
 */
export function couchesDuRegard(
  barrieres: Barriere[],
  sansVitres: Barriere[] | null,
  oeil: Pt,
  cap: number,
  ouverture: number,
  portee: number | null
): Couche[] {
  const lim = portee ?? Infinity
  const voir = (b: Barriere[], ouv: number): Pt[] => champDeVision(b, oeil, cap, ouv, lim)
  const cotes = ouverture < 360 ? ouvertureAvecBords(ouverture) : null
  const out: Couche[] = []
  if (cotes !== null) {
    if (sansVitres) out.push({ pts: voir(barrieres, cotes), force: VUE_PERIPHERIQUE * VUE_VITRE })
    out.push({ pts: voir(sansVitres ?? barrieres, cotes), force: VUE_PERIPHERIQUE })
  }
  if (sansVitres) out.push({ pts: voir(barrieres, ouverture), force: VUE_VITRE })
  out.push({ pts: voir(sansVitres ?? barrieres, ouverture), force: 1 })
  return out.filter((c) => c.pts.length > 2)
}

const pourCent = (f: number): number => Math.round(f * 100)

/**
 * Les fondus d'un regard, un par netteté de ses couches : `id-<pour cent>`
 * pour un masque d'ombre, `id-<pour cent>-v` pour un masque où l'on voit.
 */
export function DegradesDuRegard({
  id,
  c,
  r,
  couches,
  voir = false
}: {
  id: string
  c: Pt
  r: number
  couches: Couche[]
  voir?: boolean
}): JSX.Element {
  const forces = [...new Set(couches.map((k) => k.force))]
  return (
    <>
      {forces.map((f) => (
        <DegradeRegard key={f} id={`${id}-${pourCent(f)}`} c={c} r={r} force={f} />
      ))}
      {voir
        ? forces.map((f) => (
            <DegradeRegard key={`v${f}`} id={`${id}-${pourCent(f)}-v`} c={c} r={r} force={f} voir />
          ))
        : null}
    </>
  )
}

/**
 * Les couches d'un regard dans un masque. `voir`, le blanc est ce qu'on voit ;
 * sinon, l'ombre. Avec `fondu`, chaque couche s'efface au bout de la portée.
 * Les couches se mélangent à la plus visible : un même endroit vu net et à
 * travers une vitre reste net.
 */
export function CouchesRegard({
  couches,
  voir = false,
  fondu = null
}: {
  couches: Couche[]
  voir?: boolean
  fondu?: string | null
}): JSX.Element {
  return (
    <>
      {couches.map((k, i) => (
        <polygon
          key={i}
          points={polygone(k.pts)}
          fill={
            fondu
              ? `url(#${fondu}-${pourCent(k.force)}${voir ? '-v' : ''})`
              : gris(voir ? k.force : 1 - k.force)
          }
          style={voir ? MELANGE_LUMIERE : MELANGE_OMBRE}
        />
      ))}
    </>
  )
}

/**
 * Le fondu du regard, comme celui d'une lampe : net autour de l'œil, puis qui
 * s'efface jusqu'au bout de la portée. Sans lui, ce qu'on distingue dans le
 * noir s'arrêtait d'un trait sec. `voir` pour un masque où le blanc est ce
 * qu'on voit ; sinon le blanc est l'ombre. L'identifiant doit changer quand
 * l'œil bouge : un dégradé référencé depuis un masque ne se repeint pas
 * toujours (voir Brouillard.tsx).
 */
export function DegradeRegard({
  id,
  c,
  r,
  voir = false,
  force = 1
}: {
  id: string
  c: Pt
  r: number
  voir?: boolean
  /** Ce qu'on voit au plus net : 1 au centre du regard, moins sur ses bords. */
  force?: number
}): JSX.Element {
  const net = voir ? gris(force) : gris(1 - force)
  const loin = voir ? '#000' : '#fff'
  return (
    <radialGradient id={id} gradientUnits="userSpaceOnUse" cx={c.x} cy={c.y} r={Math.max(1, r)}>
      <stop offset={0} stopColor={net} />
      <stop offset={REGARD_NET} stopColor={net} />
      <stop offset={1} stopColor={loin} />
    </radialGradient>
  )
}

/**
 * Deux lueurs qui se croisent : la plus claire l'emporte, sans quoi le bord
 * pâle de l'une assombrirait le plein jour de l'autre. `darken` pour un
 * masque d'ombre.
 */
export const MELANGE_LUMIERE = { mixBlendMode: 'lighten' } as const
export const MELANGE_OMBRE = { mixBlendMode: 'darken' } as const

/** Le soleil ou la lune, prêt à dessiner : ce qu'il éclaire dedans, et les pièces. */
export interface Dehors {
  /** Le polygone éclairé par les fenêtres et les portes, vu de l'astre. */
  dedans: Pt[]
  /** Les pièces, en pixels : dehors, c'est tout ce qui n'est pas elles. */
  pieces: Pt[][]
  /** La force de l'astre : 1 le soleil, moins la lune. */
  force: number
}

/**
 * La lumière du dehors, dans un masque.
 *
 * Tout est éclairé, puis les pièces retombent au noir, puis ce que l'astre y
 * fait entrer se rallume. Sur un plan vu d'en haut, le soleil est haut : le
 * bâtiment ne jette pas d'ombre sans fin sur le jardin. Un groupe mélangé,
 * comme une lampe : la plus claire des deux lumières l'emporte. `ombre` pour
 * un masque où le blanc est le noir de la carte.
 */
export function LumiereDuDehors({
  dehors,
  w,
  h,
  ombre = false
}: {
  dehors: Dehors
  w: number
  h: number
  ombre?: boolean
}): JSX.Element {
  const jour = ombre ? gris(1 - dehors.force) : gris(dehors.force)
  const nuit = ombre ? '#fff' : '#000'
  return (
    <g style={ombre ? MELANGE_OMBRE : MELANGE_LUMIERE}>
      <rect x={0} y={0} width={w} height={h} fill={jour} />
      {dehors.pieces.map((p, i) => (
        <polygon key={i} points={polygone(p)} fill={nuit} />
      ))}
      {dehors.dedans.length > 2 ? <polygon points={polygone(dehors.dedans)} fill={jour} /> : null}
    </g>
  )
}

/** L'empreinte du dehors, pour la joindre à celle des lueurs. */
export function empreinteDehors(d: Dehors | null): string {
  if (!d) return '0'
  let h = Math.round(d.force * 100)
  for (const p of d.dedans) h = (h * 33 + (p.x | 0) * 7 + (p.y | 0) * 13) | 0
  for (const piece of d.pieces) h = (h * 31 + piece.length) | 0
  return (h >>> 0).toString(36)
}

/**
 * Une empreinte des lueurs, pour l'identifiant des masques : un masque imbriqué
 * ne se repeint pas quand son contenu change (voir Brouillard.tsx).
 */
export function empreinteLueurs(lueurs: Lueur[]): string {
  let h = lueurs.length
  for (const l of lueurs) {
    h = (h * 33 + l.pts.length) | 0
    h = (h * 33 + (l.r | 0) * 5 + Math.round(l.f * 1000)) | 0
    for (const p of l.pts) h = (h * 33 + (p.x | 0) * 7 + (p.y | 0) * 13) | 0
  }
  return (h >>> 0).toString(36)
}
