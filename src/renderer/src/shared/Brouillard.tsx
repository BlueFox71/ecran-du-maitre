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
import { FORCE_ASTRE, type CalqueBrouillard } from '@shared/types'
import { formesDesMurs } from '@shared/pieces'
import { bordsOuverture } from '@shared/ouvertures'
import {
  CLAIR_DE_TORCHE,
  DegradesLueurs,
  LumiereDuDehors,
  MELANGE_LUMIERE,
  FlouRegard,
  CouchesRegard,
  DegradesDuRegard,
  couchesDuRegard,
  empreinteDehors,
  empreinteLueurs,
  halosDesLampes,
  type Dehors,
  type Lueur
} from './Lueur'
import {
  barrieres,
  bords,
  casesAutour,
  casesVues,
  champDeVision,
  cheminDesInconnues,
  grille,
  lueurDuDehors,
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

  /**
   * Le regard de chaque joueur, arrêté par les murs.
   *
   * Sa portée est celle de la carte — sauf s'il porte une lampe : il voit
   * alors aussi loin qu'elle éclaire, et la lampe passe avant le réglage.
   * `loin`, le même regard sans limite, pour ce qu'une lampe éclaire au-delà.
   */
  const regardsY = useMemo(
    () =>
      w > 0 && h > 0
        ? yeux
            .map((o) => {
              const c = { x: o.x * w, y: o.y * h }
              const portee = porteurs.find((p) => p.characterId === o.characterId)?.rayon ?? regardPortee
              const pts = champDeVision(barrieresVue, c, o.cap, calque.regardOuverture, portee ? portee * w : Infinity)
              return {
                c,
                cap: o.cap,
                portee,
                pts,
                loin: portee ? champDeVision(barrieresVue, c, o.cap, calque.regardOuverture) : pts
              }
            })
            .filter((r) => r.pts.length > 2)
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [yeux, porteurs, barrieresVue, regardPortee, calque.regardOuverture, w, h]
  )
  const regards = useMemo(() => regardsY.map((r) => r.pts), [regardsY])
  const loins = useMemo(() => regardsY.map((r) => r.loin), [regardsY])
  /** Ce qu'on voit sans lumière : les regards, jusqu'à leur portée. */
  const proches = regardsY.filter((r) => r.portee).map((r) => r.pts)
  /** Les mêmes murs, où les vitres ne laissent rien passer — s'il y en a. */
  const sansVitres = useMemo(
    () =>
      w > 0 && h > 0 && ouvertures.some((o) => o.nature === 'vitre')
        ? barrieres(
            murs,
            'vue',
            enPx,
            ouvertures.filter((o) => o.nature !== 'vitre')
          ).concat(bords(w, h))
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [murs, ouvertures, w, h]
  )
  /**
   * Chaque regard en couches : ses côtés, flous, et sa part nette — chacun vu
   * directement ou à travers une vitre, qui le voile encore. Sans limite pour
   * ce qu'une lampe éclaire ; jusqu'à la portée pour ce qu'on distingue dans
   * le noir. Dans l'ordre des regards, pour aller avec leur fondu.
   */
  const couchesY = useMemo(
    () =>
      regardsY.map((r) => ({
        loin: couchesDuRegard(barrieresVue, sansVitres, r.c, r.cap, calque.regardOuverture, null),
        proche: r.portee
          ? couchesDuRegard(barrieresVue, sansVitres, r.c, r.cap, calque.regardOuverture, r.portee * w)
          : []
      })),
    [regardsY, barrieresVue, sansVitres, calque.regardOuverture, w]
  )

  /**
   * Les ronds de lumière, arrêtés par les mêmes murs.
   *
   * Deux sortes, et elles se valent : celles du décor, posées sur le plan, et
   * **celles qu'on porte** — la torche au poing d'un personnage, qui le suit.
   * Une pièce éclairée l'est pour toute la table, quelle que soit la main qui
   * tient la lampe.
   */
  const lueurs = useMemo((): Lueur[] => {
    if (w <= 0 || h <= 0) return []
    const ronds: Lueur[] = lumieres
      .filter((l) => l.allumee)
      /* Une lampe directive n'éclaire que son faisceau — le même secteur que
         le regard d'un pion. */
      .map((l) => {
        const c = { x: l.x * w, y: l.y * h }
        return {
          pts: champDeVision(barrieresVue, c, l.cap, l.ouverture, l.penombre * w),
          c,
          r: l.penombre * w,
          f: l.clair / l.penombre
        }
      })
    for (const o of yeux) {
      const porte = porteurs.find((p) => p.characterId === o.characterId)
      if (!porte) continue
      const c = { x: o.x * w, y: o.y * h }
      ronds.push({
        /* Une lampe de poche éclaire où le pion regarde. */
        pts: champDeVision(barrieresVue, c, o.cap, porte.ouverture ?? 360, porte.rayon * w),
        c,
        r: porte.rayon * w,
        f: CLAIR_DE_TORCHE
      })
    }
    ronds.push(...halosDesLampes(lumieres, barrieresVue, w, h))
    return ronds.filter((l) => l.pts.length > 2)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lumieres, porteurs, yeux, barrieresVue, w, h])

  /**
   * La lumière commande-t-elle ?
   *
   * Dès qu'il y a une lampe sur la carte — posée ou portée —, on ne voit que
   * ce qui tombe à la fois dans un regard et dans une lueur. Une carte sans la
   * moindre lampe se visite comme avant, à la seule vue.
   */
  /* Le soleil ou la lune : dehors éclairé, et ce qui entre par les fenêtres. */
  const dehors = useMemo((): Dehors | null => {
    if (!calque.astre || w <= 0 || h <= 0) return null
    return {
      dedans: lueurDuDehors(murs, ouvertures, calque.astre.cap, w, h),
      pieces: formesDesMurs(murs).map((f) => f.pts.map(enPx)),
      force: FORCE_ASTRE[calque.astre.nature]
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calque.astre?.nature, calque.astre?.cap, murs, ouvertures, w, h])

  const sousLaLampe = lumieres.length > 0 || porteurs.length > 0 || !!dehors


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
  const empreinte = useMemo(
    () => `${empreinteLueurs(lueurs)}${empreinteDehors(dehors)}`,
    [lueurs, dehors]
  )

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
    for (const r of loins) for (const c of casesVues(r, carreaux)) neuf.add(c)
    if (sousLaLampe) {
      const eclairees = new Set<number>()
      for (const l of lueurs) for (const c of casesVues(l.pts, carreaux)) eclairees.add(c)
      if (dehors) {
        /* Dehors, tout est éclairé ; dedans, ce que l'astre fait entrer. */
        const dansLesPieces = new Set<number>()
        for (const p of dehors.pieces) for (const c of casesVues(p, carreaux)) dansLesPieces.add(c)
        for (let c = 0; c < carreaux.cols * carreaux.rows; c++)
          if (!dansLesPieces.has(c)) eclairees.add(c)
        for (const c of casesVues(dehors.dedans, carreaux)) eclairees.add(c)
      }
      for (const c of [...neuf]) if (!eclairees.has(c)) neuf.delete(c)
      for (const r of proches) for (const c of casesVues(r, carreaux)) neuf.add(c)
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
  }, [regards, loins, lueurs, dehors, carreaux, lumGarde, sousLaLampe])

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
  /* Le fondu de chaque regard proche : net près de l'œil, effacé au bout de
     la portée — comme une lampe. Un par œil ; l'identifiant suit l'œil. */
  const fondus = regardsY.map((r, i) =>
    r.portee
      ? {
          id: `${id}-rg-${i}-${Math.round(r.c.x)}-${Math.round(r.c.y)}-${Math.round(r.portee * 1000)}`,
          c: r.c,
          r: r.portee * w
        }
      : null
  )
  /**
   * Les regards dans un masque : `voir`, le blanc est ce qu'on voit ; sinon le
   * blanc est l'ombre. Les côtés d'abord, à moitié, puis la part nette ; sous
   * la lampe, ce qui est éclairé au loin, puis ce qu'on distingue jusqu'à la
   * portée, en fondu.
   */
  const regardsDans = (voir: boolean): JSX.Element => (
    /* Les bords des cônes, adoucis : tout le regard passe par un léger flou. */
    <g filter={`url(#${id}-flou)`}>
      {sousLaLampe ? (
        <g mask={`url(#${id}-lum)`}>
          {couchesY.map((c, i) => (
            <CouchesRegard key={i} couches={c.loin} voir={voir} />
          ))}
        </g>
      ) : (
        couchesY.map((c, i) =>
          regardsY[i]?.portee ? null : <CouchesRegard key={i} couches={c.loin} voir={voir} />
        )
      )}
      {/* Jusqu'à la portée, on distingue sans lumière — de moins en moins. */}
      {couchesY.map((c, i) => (
        <CouchesRegard key={`p${i}`} couches={c.proche} voir={voir} fondu={fondus[i]?.id ?? null} />
      ))}
    </g>
  )
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
        {/* Plein jour jusqu'au clair, puis la pénombre qui baisse : ce qu'on
            y voit se voit moins bien. */}
        {fondus.map((f, i) =>
          f ? (
            <DegradesDuRegard key={f.id} id={f.id} c={f.c} r={f.r} couches={couchesY[i]?.proche ?? []} voir />
          ) : null
        )}
        <FlouRegard id={`${id}-flou`} w={w} h={h} />
        <mask id={`${id}-lum`}>
          <DegradesLueurs lueurs={lueurs} id={`${id}-g`} />
          {/* Le même flou que le regard : une lueur arrêtée par un mur, ou le
              bord d'un faisceau, ne fait pas un trait net. */}
          <g filter={`url(#${id}-flou)`}>
            {lueurs.map((l, i) => (
              <polygon
                key={i}
                points={polygone(l.pts)}
                fill={`url(#${id}-g-${i})`}
                style={MELANGE_LUMIERE}
              />
            ))}
            {dehors ? <LumiereDuDehors dehors={dehors} w={w} h={h} /> : null}
          </g>
        </mask>
        {/* Blanc = on voit. C'est l'inverse du masque d'ombre, et il sert à
            n'écrire sur la carte que dans le champ des joueurs. */}
        <mask id={`${id}-champ`}>
          {regardsDans(true)}
          {yeux.map((o, i) => (
            <circle key={i} cx={o.x * w} cy={o.y * h} r={w * A_PORTEE} fill="#fff" />
          ))}
        </mask>
        {/* Blanc = on ne voit pas. Chaque regard y creuse son trou. */}
        <mask id={`${id}-vu`}>
          <rect x="0" y="0" width={w} height={h} fill="#fff" />
          {regardsDans(false)}
          {/* Ce qu'on a au bout des bras, lampe ou pas : on ne joue pas un
              aveugle qui ne sait pas où il pose les pieds. */}
          {yeux.map((o, i) => (
            <circle key={i} cx={o.x * w} cy={o.y * h} r={w * A_PORTEE} fill="#000" />
          ))}
        </mask>
        {inconnu ? (
          <mask id={`${id}-noir`}>
            <path d={inconnu} fill="#fff" />
            {regardsDans(false)}
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
