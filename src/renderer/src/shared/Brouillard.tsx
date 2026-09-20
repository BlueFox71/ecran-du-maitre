/**
 * L'ombre posée sur une carte diffusée.
 *
 * C'est le calque des murs, mais joué pour de vrai : les yeux ne sont plus un
 * pion d'essai, ce sont **les pions des joueurs**. Chacun regarde devant lui,
 * dans le sens où son jeton est tourné ; ce qu'ils voient est la réunion de
 * leurs regards, et rien d'autre ne sort du noir.
 *
 * Deux règles, les mêmes que dans la fiche du lieu :
 * - **la lumière commande** — dès qu'une lampe existe sur la carte, on ne voit
 *   que ce qui tombe à la fois dans un regard et dans une lueur ;
 * - **la mémoire dépend du lieu** — si « laisser une zone éclairée découverte »
 *   est cochée, ce qui a été vu reste sur la carte, en sombre ; sinon tout
 *   retombe au noir dès qu'on tourne le dos.
 *
 * Ce composant ne décide de rien et n'écrit rien : on lui donne un calque, des
 * yeux et la taille de l'image, il rend du noir.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { CalqueBrouillard } from '@shared/types'
import { bordsOuverture } from '@shared/ouvertures'
import {
  barrieres,
  bords,
  casesAutour,
  casesVues,
  champDeVision,
  cheminDesInconnues,
  grille,
  polygone,
  type Pt
} from '@shared/murs'

/** Ce qu'un pion de joueur voit : d'où il regarde, et de quel côté. */
export interface Oeil {
  /** En fractions de l'image, comme les murs. */
  x: number
  y: number
  /** Le cap en degrés, 0 vers le haut — la rotation du jeton. */
  cap: number
  /** Le personnage derrière le jeton : c'est lui qui porte, ou non, une lampe. */
  characterId: number
}

/*
 * L'ouverture du regard d'un joueur ne se décide plus ici : elle arrive avec
 * le calque. C'est un réglage de la campagne, et il doit être le même sur les
 * trois écrans qui dessinent ce cône — sans quoi le MJ verrait un secteur et
 * les joueurs un autre.
 */

/** Ce qu'on a au bout des bras, même dans le noir : en part de la largeur. */
const A_PORTEE = 0.018

export function Brouillard({
  calque,
  yeux,
  w,
  h
}: {
  calque: CalqueBrouillard
  yeux: Oeil[]
  /** La taille naturelle de l'image : le repère de tout ce qu'on dessine. */
  w: number
  h: number
}): JSX.Element | null {
  const { murs, ouvertures, lumieres, lumGarde, regardPortee } = calque
  /* Ceux qui portent de la lumière, réduits à ceux qui sont sur cette carte :
     un personnage resté au campement n'éclaire pas le manoir. */
  const porteurs = useMemo(
    () => calque.porteurs.filter((p) => yeux.some((o) => o.characterId === p.characterId)),
    [calque.porteurs, yeux]
  )
  const enPx = (p: [number, number]): Pt => ({ x: p[0] * w, y: p[1] * h })

  const barrieresVue = useMemo(
    () => (w > 0 && h > 0 ? barrieres(murs, 'vue', enPx, ouvertures).concat(bords(w, h)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [murs, ouvertures, w, h]
  )

  /** Le regard de chaque joueur, arrêté par les murs. */
  const regards = useMemo(
    () =>
      w > 0 && h > 0
        ? yeux
            .map((o) =>
              champDeVision(
                barrieresVue,
                { x: o.x * w, y: o.y * h },
                o.cap,
                calque.regardOuverture,
                regardPortee ? regardPortee * w : Infinity
              )
            )
            .filter((p) => p.length > 2)
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [yeux, barrieresVue, regardPortee, calque.regardOuverture, w, h]
  )

  /**
   * Les ronds de lumière, arrêtés par les mêmes murs.
   *
   * Deux sortes, et elles se valent : celles du décor, posées sur le plan, et
   * **celles qu'on porte** — la torche au poing d'un personnage, qui le suit.
   * Une pièce éclairée l'est pour toute la table, quelle que soit la main qui
   * tient la lampe.
   */
  const lueurs = useMemo(() => {
    if (w <= 0 || h <= 0) return []
    const ronds = lumieres
      .filter((l) => l.allumee)
      .map((l) => champDeVision(barrieresVue, { x: l.x * w, y: l.y * h }, 0, 360, l.penombre * w))
    for (const o of yeux) {
      const porte = porteurs.find((p) => p.characterId === o.characterId)
      if (!porte) continue
      ronds.push(champDeVision(barrieresVue, { x: o.x * w, y: o.y * h }, 0, 360, porte.rayon * w))
    }
    return ronds.filter((p) => p.length > 2)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lumieres, porteurs, yeux, barrieresVue, w, h])

  /**
   * La lumière commande-t-elle ?
   *
   * Dès qu'il y a une lampe sur la carte — posée ou portée —, on ne voit que
   * ce qui tombe à la fois dans un regard et dans une lueur. Une carte sans la
   * moindre lampe se visite comme avant, à la seule vue.
   */
  const sousLaLampe = lumieres.length > 0 || porteurs.length > 0


  /* La mémoire de la table : ce qui a été vu et qu'on ne regarde plus. Elle ne
     sert que si le lieu garde ce qu'il éclaire — sinon rien ne se retient. */
  /*
   * Un identifiant par calque, et non par taille d'image.
   *
   * Deux ombres peuvent vivre dans la même page — la régie et son moniteur, ou
   * les deux images d'un enchaînement chez les joueurs. Avec un `id` calculé
   * sur la taille, elles portaient le même : le navigateur résout `url(#…)`
   * sur le premier venu, et l'une se masquait avec les masques de l'autre.
   *
   * Il se prend **ici**, avec les autres crochets : plus bas, après le retour
   * anticipé du cas « personne sur la carte », le nombre de crochets changeait
   * d'un rendu à l'autre — et React casse le composant quand le dernier pion
   * quitte le lieu, ou quand le premier y arrive.
   */
  const propre = useId().replace(/:/g, '')

  /**
   * Une empreinte des lueurs, collée à l'identifiant des masques.
   *
   * Sans elle, souffler les lampes ne change rien à l'écran. React remplace
   * pourtant bien les polygones du masque `-lum` — mesuré : neuf lueurs
   * deviennent deux —, mais **le navigateur ne repeint pas** ce qui référence
   * ce masque, parce qu'il est lui-même utilisé depuis un autre masque
   * (`<g mask="url(#…-lum)">`, dans `-vu`, `-champ` et `-noir`). Le rendu
   * gardait l'ancienne lumière jusqu'à ce qu'un pion bouge et force le
   * repeint — d'où l'impression que les lampes n'obéissaient qu'au pas des
   * joueurs.
   *
   * Changer l'identifiant quand la lumière change crée des masques neufs :
   * il n'y a plus rien à réutiliser. L'empreinte se calcule sur les polygones
   * déjà en main, donc elle ne coûte qu'une boucle d'entiers, et elle ne
   * bouge que si l'image doit bouger.
   */
  const empreinte = useMemo(() => {
    let h = lueurs.length
    for (const l of lueurs) {
      h = (h * 33 + l.length) | 0
      for (const p of l) h = (h * 33 + (p.x | 0) * 7 + (p.y | 0) * 13) | 0
    }
    return (h >>> 0).toString(36)
  }, [lueurs])

  const id = `${propre}-${empreinte}`

  const carreaux = useMemo(() => (w > 0 && h > 0 ? grille(w, h) : null), [w, h])
  const [connu, setConnu] = useState<Set<number>>(new Set())
  const cle = useRef('')

  useEffect(() => {
    /* Changer de carte efface la mémoire : on ne traîne pas le brouillard d'un
       étage sur le plan du suivant. */
    const k = `${w}x${h}x${murs.length}x${lumGarde ? 1 : 0}`
    if (cle.current === k) return
    cle.current = k
    setConnu(new Set())
  }, [w, h, murs.length, lumGarde])

  useEffect(() => {
    if (!lumGarde || !carreaux || !regards.length) return
    const neuf = new Set<number>()
    for (const r of regards) for (const c of casesVues(r, carreaux)) neuf.add(c)
    if (sousLaLampe) {
      const eclairees = new Set<number>()
      for (const l of lueurs) for (const c of casesVues(l, carreaux)) eclairees.add(c)
      for (const c of [...neuf]) if (!eclairees.has(c)) neuf.delete(c)
    }
    for (const o of yeux)
      for (const c of casesAutour({ x: o.x * w, y: o.y * h }, Math.max(carreaux.taille, w * A_PORTEE), carreaux))
        neuf.add(c)
    setConnu((cur) => {
      if ([...neuf].every((c) => cur.has(c))) return cur
      const s = new Set(cur)
      for (const c of neuf) s.add(c)
      return s
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regards, lueurs, carreaux, lumGarde, sousLaLampe])

  const inconnu = useMemo(
    () => (lumGarde && carreaux && connu.size ? cheminDesInconnues(connu, carreaux) : ''),
    [lumGarde, carreaux, connu]
  )

  /* Personne sur la carte : elle se montre entière. Poser un plan sans y avoir
     encore mis les joueurs ne doit pas donner un écran noir. */
  if (!regards.length || w <= 0 || h <= 0) return null

  /**
   * Les portes, dessinées dans le champ de vision.
   *
   * Sur une carte peinte, un seuil ne se voit pas toujours : le plan montre un
   * mur, et les joueurs passent devant une porte sans la remarquer. On la
   * marque donc — mais **seulement là où ils voient**, sinon on leur donnerait
   * le plan de la maison. Fermée, un trait plein en travers ; ouverte, un
   * trait creux : le passage est libre, et ça se lit d'un coup d'œil.
   */
  const portes = ouvertures
    .filter((o) => o.nature === 'porte')
    .map((o) => {
      const mur = murs.find((m) => m.id === o.murId)
      if (!mur) return null
      const b = bordsOuverture(mur, o)
      return {
        id: o.id,
        ouverte: o.ouverte && !o.verrouillee,
        a: { x: b.a[0] * w, y: b.a[1] * h },
        z: { x: b.b[0] * w, y: b.b[1] * h }
      }
    })
    .filter((p): p is NonNullable<typeof p> => !!p)
  return (
    <svg
      className="brouillard"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        {/* Blanc là où une lampe porte : tout ce qu'on croise avec elle. */}
        <mask id={`${id}-lum`}>
          {lueurs.map((l, i) => (
            <polygon key={i} points={polygone(l)} fill="#fff" />
          ))}
        </mask>
        {/* Blanc = on voit. C'est l'inverse du masque d'ombre, et il sert à
            n'écrire sur la carte que dans le champ des joueurs. */}
        <mask id={`${id}-champ`}>
          {sousLaLampe ? (
            <g mask={`url(#${id}-lum)`}>
              {regards.map((r, i) => (
                <polygon key={i} points={polygone(r)} fill="#fff" />
              ))}
            </g>
          ) : (
            regards.map((r, i) => <polygon key={i} points={polygone(r)} fill="#fff" />)
          )}
          {yeux.map((o, i) => (
            <circle key={i} cx={o.x * w} cy={o.y * h} r={w * A_PORTEE} fill="#fff" />
          ))}
        </mask>
        {/* Blanc = on ne voit pas. Chaque regard y creuse son trou. */}
        <mask id={`${id}-vu`}>
          <rect x="0" y="0" width={w} height={h} fill="#fff" />
          {sousLaLampe ? (
            <g mask={`url(#${id}-lum)`}>
              {regards.map((r, i) => (
                <polygon key={i} points={polygone(r)} fill="#000" />
              ))}
            </g>
          ) : (
            regards.map((r, i) => <polygon key={i} points={polygone(r)} fill="#000" />)
          )}
          {/* Ce qu'on a au bout des bras, lampe ou pas : on ne joue pas un
              aveugle qui ne sait pas où il pose les pieds. */}
          {yeux.map((o, i) => (
            <circle key={i} cx={o.x * w} cy={o.y * h} r={w * A_PORTEE} fill="#000" />
          ))}
        </mask>
        {inconnu ? (
          <mask id={`${id}-noir`}>
            <path d={inconnu} fill="#fff" />
            {sousLaLampe ? (
              <g mask={`url(#${id}-lum)`}>
                {regards.map((r, i) => (
                  <polygon key={i} points={polygone(r)} fill="#000" />
                ))}
              </g>
            ) : (
              regards.map((r, i) => <polygon key={i} points={polygone(r)} fill="#000" />)
            )}
            {yeux.map((o, i) => (
              <circle key={i} cx={o.x * w} cy={o.y * h} r={w * A_PORTEE} fill="#000" />
            ))}
          </mask>
        ) : null}
      </defs>

      {/* Ce qu'on ne voit pas à cet instant : sombre si on l'a déjà vu, noir
          plein sinon. Sans mémoire, il n'y a qu'un seul noir. */}
      <rect
        x="0"
        y="0"
        width={w}
        height={h}
        className={lumGarde ? 'br-vu' : 'br-noir'}
        mask={`url(#${id}-vu)`}
      />
      {inconnu ? (
        <rect x="0" y="0" width={w} height={h} className="br-noir" mask={`url(#${id}-noir)`} />
      ) : null}

      {/* Les portes, par-dessus l'ombre et coupées à son bord. */}
      {portes.length ? (
        <g mask={`url(#${id}-champ)`}>
          {portes.map((p) => (
            <line
              key={p.id}
              x1={p.a.x}
              y1={p.a.y}
              x2={p.z.x}
              y2={p.z.y}
              className={`br-porte${p.ouverte ? ' ouverte' : ''}`}
              strokeWidth={Math.max(2, w * 0.004)}
            />
          ))}
        </g>
      ) : null}
    </svg>
  )
}
