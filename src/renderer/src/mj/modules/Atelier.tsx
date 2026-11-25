/**
 * L'atelier des lieux : un plan qu'on construit au lieu de le retracer.
 *
 * Cinq étapes, dans l'ordre où on bâtit une maison — le sol, les murs, les
 * portes et fenêtres, la déco, l'éclairage — mais sans verrou : on revient à
 * n'importe laquelle. Ce qu'on enregistre devient la carte du lieu, et ses
 * murs les murs du plan : brouillard, regards et pas suivent d'eux-mêmes.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import type { AssetAtelier } from '@shared/atelierAssets'
import type { Place } from '@shared/types'
import { AMBIANCE_NEUTRE, type Ambiance } from '@shared/ambiance'
import { MeteoAnimee, TeinteAmbiance } from '../../shared/Ambiance'
import { bordsPourTaille, niveauxDuLieu, tailleMinimale, type Ancre, type Construction } from '@shared/atelier'
import { chargerImages, type ImagesAtelier } from '../atelier/images'
import { useConstruction, type ConstructionOuverte } from '../atelier/useConstruction'
import { Toile, type Outil } from '../atelier/Toile'
import { useEssaiAtelier, type EssaiAtelier } from '../atelier/Essai'
import { IconSoleil } from '../components/Icons'
import { EtapeSol } from '../atelier/etapes/Sol'
import { EtapeMurs } from '../atelier/etapes/Murs'
import { EtapeOuvertures } from '../atelier/etapes/Ouvertures'
import { EtapeDeco } from '../atelier/etapes/Deco'
import { EtapeEclairage } from '../atelier/etapes/Eclairage'
import { useFiltreWow } from '../atelier/Palette'
import iconeWow from '../../assets/atelier/wow.png'

/** L'atelier s'enregistre de lui-même à ce rythme, s'il y a des changements. */
const AUTO_ENREGISTREMENT = 5 * 60 * 1000

export type EtapeId = 'sol' | 'murs' | 'ouvertures' | 'deco' | 'eclairage'

const ETAPES: { id: EtapeId; label: string }[] = [
  { id: 'sol', label: 'Sol' },
  { id: 'murs', label: 'Murs' },
  { id: 'ouvertures', label: 'Portes et fenêtres' },
  { id: 'deco', label: 'Objets' },
  { id: 'eclairage', label: 'Éclairage' }
]

/** Ce que chaque étape reçoit de l'atelier. */
export interface PropsEtape {
  co: ConstructionOuverte
  place: Place
  assets: AssetAtelier[]
  parId: Map<string, AssetAtelier>
  images: ImagesAtelier
  /** L'étape dit ce que fait la souris sur la toile, et ce qu'elle y dessine. */
  setOutil: (o: Outil | null) => void
  /** La couche de l'outil a changé (un aperçu qui suit la souris). */
  repeindre: () => void
  /** Un asset vient d'être importé : on relit le catalogue. */
  recharger: () => Promise<void>
  grille: boolean
  /** La place des outils de l'étape dans l'en-tête, juste à droite des onglets. */
  barreOutils: HTMLElement | null
  /** « Test lumière », tenu : la construction dans le noir, avec ce que les lampes éclairent. */
  setTestLum: (v: boolean) => void
  /** La teinte générale de la carte et le temps qu'il y fait, enregistrés aussitôt. */
  ambiance: Ambiance
  reglerAmbiance: (patch: Partial<Ambiance>) => void
  /** Les murs et le ciel du lieu, ceux de l'essai : un ciel réglé se voit aussitôt au test. */
  murs: EssaiAtelier['murs']
}

export function Atelier(): JSX.Element {
  const lieuId = useStore((s) => s.atelierLieuId)
  const place = useStore((s) => s.places.find((p) => p.id === lieuId) ?? null)
  /* L'atelier n'a pas de page à lui : sans lieu bâti à ouvrir, on retourne
     d'où l'on venait (Lieux ou Plans). */
  const vide = !place?.construit
  useEffect(() => {
    if (vide) useStore.getState().ouvrirAtelier(null)
  }, [vide])
  return place?.construit ? <Chantier key={place.id} place={place} /> : <></>
}


/* ---------------- le chantier ---------------- */

function Chantier({ place }: { place: Place }): JSX.Element {
  const s = useStore()
  const [assets, setAssets] = useState<AssetAtelier[]>([])
  const [filtreWow, setFiltreWow] = useFiltreWow()
  const images = useMemo<ImagesAtelier>(() => new Map(), [])
  const [versionImages, setVersionImages] = useState(0)
  const parId = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets])
  const toastErreur = useCallback((m: string) => s.toast(m, true), [s.toast])
  const co = useConstruction(place.id, parId, images, toastErreur)
  const [etape, setEtape] = useState<EtapeId>('sol')
  /* À l'ouverture, un lieu déjà meublé s'ouvre sur ses objets : c'est là
     qu'on revient le plus souvent. Une seule fois, au premier chargement. */
  const ouvert = useRef(false)
  useEffect(() => {
    if (ouvert.current || !co.c) return
    ouvert.current = true
    if (co.c.objets.length) setEtape('deco')
  }, [co.c])
  const [grille, setGrille] = useState(true)
  const [outil, setOutil] = useState<Outil | null>(null)
  const [barreOutils, setBarreOutils] = useState<HTMLDivElement | null>(null)
  const [repeint, setRepeint] = useState(0)
  const [agrandir, setAgrandir] = useState(false)
  const [apercuTaille, setApercuTaille] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
  const [quitter, setQuitter] = useState(false)
  const essai = useEssaiAtelier(place.id, co.c)

  /* L'ambiance du lieu : elle ne fait pas partie de la construction, elle
     s'enregistre aussitôt, comme les lampes (les curseurs, un peu après). */
  const [ambiance, setAmbiance] = useState<Ambiance>(AMBIANCE_NEUTRE)
  const ecritAmbiance = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    let vivant = true
    void window.jdr.places.lireAmbiance(place.id).then((a) => {
      if (vivant) setAmbiance(a ?? AMBIANCE_NEUTRE)
    })
    return () => {
      vivant = false
    }
  }, [place.id])
  const reglerAmbiance = useCallback(
    (patch: Partial<Ambiance>) => {
      setAmbiance((avant) => {
        const neuve = { ...avant, ...patch }
        if (ecritAmbiance.current) clearTimeout(ecritAmbiance.current)
        ecritAmbiance.current = setTimeout(() => void window.jdr.places.ambiance(place.id, neuve), 200)
        return neuve
      })
    },
    [place.id]
  )

  /* Tant que des images manquent, un voile de chargement couvre le chantier :
     on ne montre pas un lieu à moitié dessiné. */
  const [chargement, setChargement] = useState<{ faites: number; total: number } | null>({ faites: 0, total: 0 })
  const recharger = useCallback(async () => {
    const a = await window.jdr.atelier.assets()
    setAssets(a)
    await chargerImages(a, images, (faites, total) => setChargement({ faites, total }))
    setVersionImages((v) => v + 1)
    setChargement(null)
  }, [images])

  useEffect(() => {
    void recharger()
  }, [recharger])

  /* Les raccourcis de l'atelier : annuler, rétablir, enregistrer. */
  useEffect(() => {
    const k = (e: KeyboardEvent): void => {
      const el = document.activeElement
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
      if (!(e.ctrlKey || e.metaKey)) return
      const t = e.key.toLowerCase()
      if (t === 'z' && !e.shiftKey) co.annuler()
      else if (t === 'y' || (t === 'z' && e.shiftKey)) co.retablir()
      else if (t === 's') {
        if (co.sale) void enregistrer()
      }
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })

  const enregistrer = async (): Promise<void> => {
    if (await co.enregistrer()) {
      await s.refreshPlaces()
      s.toast(`« ${place.name} » est enregistré : son plan et ses murs sont à jour.`)
    }
  }

  /* L'enregistrement automatique : toutes les cinq minutes, s'il y a du neuf.
     La construction de l'instant est lue au moment du tic, pas à la pose de
     la minuterie. */
  const dernier = useRef(co)
  dernier.current = co
  useEffect(() => {
    const t = window.setInterval(async () => {
      const k = dernier.current
      if (!k.sale || k.enregistrement) return
      if (await k.enregistrer()) {
        await s.refreshPlaces()
        s.toast(`« ${place.name} » enregistré automatiquement.`)
      }
    }, AUTO_ENREGISTREMENT)
    return () => window.clearInterval(t)
  }, [place.id])

  /* Un niveau de plus : on enregistre d'abord ce qui est en cours, pour que
     le double parte de l'état qu'on voit, puis on ouvre le nouveau niveau. */
  const [doublage, setDoublage] = useState(false)
  const ajouterNiveau = async (): Promise<void> => {
    if (doublage) return
    setDoublage(true)
    try {
      if (co.sale && !(await co.enregistrer())) return
      const neuf = await window.jdr.atelier.ajouterNiveau(place.id)
      await s.refreshPlaces()
      s.ouvrirAtelier(neuf.id)
      s.toast(`« ${neuf.name} » est prêt : c'est un double de « ${place.name} », à retoucher pour cet étage.`)
    } catch (e) {
      s.toast(e instanceof Error ? e.message : String(e), true)
    } finally {
      setDoublage(false)
    }
  }

  /* Passer d'un niveau à l'autre : ce qui est en cours est enregistré d'abord. */
  const niveaux = niveauxDuLieu(place, s.places.filter((p) => p.construit))
  const rang = niveaux.findIndex((n) => n.id === place.id)
  const allerAuNiveau = async (i: number): Promise<void> => {
    const cible = niveaux[i]
    if (!cible || doublage) return
    if (co.sale && !(await co.enregistrer())) return
    s.ouvrirAtelier(cible.id)
  }

  const sortir = (): void => {
    if (co.sale) setQuitter(true)
    else s.ouvrirAtelier(null)
  }

  const props: PropsEtape | null = co.c
    ? {
        co,
        place,
        assets,
        parId,
        images,
        setOutil,
        repeindre: () => setRepeint((n) => n + 1),
        recharger,
        grille,
        barreOutils,
        setTestLum: essai.setTestLum,
        ambiance,
        reglerAmbiance,
        murs: essai.murs
      }
    : null
  /* L'ambiance se voit à l'étape de l'éclairage et pendant un essai. */
  const voirAmbiance = etape === 'eclairage' || essai.enTest

  return (
    <section className="view at-chantier">
      <div className="at-barre">
        <button
          className="btn btn-sm"
          onClick={sortir}
          title={`Revenir ${s.atelierRetour === 'places' ? 'aux Lieux' : 'aux Plans'}, sur ce lieu`}
        >
          ← {s.atelierRetour === 'places' ? 'Lieux' : 'Plans'}
        </button>
        <TitreDuLieu place={place} />
        <nav className="at-etapes" role="tablist" aria-label="Les étapes de la construction">
          {ETAPES.map((e) => (
            <button
              key={e.id}
              role="tab"
              aria-selected={etape === e.id}
              className="at-etape"
              onClick={() => {
                /* L'onglet déjà ouvert : rien à faire — effacer l'outil ici
                   laisserait la toile sans outil, l'étape ne le recréant pas. */
                if (e.id === etape) return
                setOutil(null)
                setEtape(e.id)
              }}
            >
              {e.label}
            </button>
          ))}
        </nav>
        {/* Les étapes y posent leurs outils (l'objet choisi : plans, miroirs, alignements). */}
        <div className="at-barre-outils" ref={setBarreOutils} />
        <span className="spacer" />
        <button
          className="btn btn-sm at-filtre-wow"
          aria-pressed={filtreWow}
          title={filtreWow ? 'Montrer de nouveau tous les assets' : 'Ne montrer que les assets World of Warcraft'}
          onClick={() => setFiltreWow(!filtreWow)}
        >
          <img src={iconeWow} alt="" />
          WoW
        </button>
        <button className="btn btn-sm" aria-pressed={grille} onClick={() => setGrille(!grille)}>
          ▦ Grille
        </button>
        <button
          className={`btn btn-sm ${essai.enTest ? 'btn-sortie' : 'btn-essai'}`}
          aria-pressed={essai.enTest}
          onClick={essai.basculer}
          title={
            essai.enTest
              ? 'Arrêter l’essai (Échap)'
              : 'Poser un pion d’essai dans la construction en cours : il ne traverse pas, et il ne voit que ce que les murs et la lumière lui laissent voir'
          }
        >
          {essai.enTest ? 'Arrêter l’essai' : 'Essayer avec un pion'}
        </button>
        {/* Tenu, pas cliqué : on regarde, on lâche, on reprend où l'on était. */}
        <button
          className={`btn btn-sm${essai.testLum ? ' btn-on' : ''}`}
          aria-pressed={essai.testLum}
          disabled={essai.enTest || !essai.peutTesterLum}
          title={
            essai.peutTesterLum
              ? essai.testLum
                ? 'Cliquer pour revenir à la construction éclairée'
                : 'Cliquer : la construction en cours dans le noir, avec ce que les lampes éclairent. Recliquer pour revenir.'
              : 'Pose d’abord une lampe (étape Éclairage) : il n’y aurait rien à montrer'
          }
          onClick={() => essai.setTestLum(!essai.testLum)}
        >
          <IconSoleil />
          Test lumière
        </button>
        {niveaux.length > 1 ? (
          <span className="at-niveaux" title="Les niveaux de ce lieu">
            <button
              className="btn btn-sm"
              disabled={rang <= 0 || co.enregistrement}
              onClick={() => void allerAuNiveau(rang - 1)}
              title="Niveau précédent"
            >
              ‹
            </button>
            <span className="at-niveau">{niveaux[rang]?.n ?? '?'}</span>
            <button
              className="btn btn-sm"
              disabled={rang >= niveaux.length - 1 || co.enregistrement}
              onClick={() => void allerAuNiveau(rang + 1)}
              title="Niveau suivant"
            >
              ›
            </button>
          </span>
        ) : null}
        <button
          className="btn btn-sm"
          disabled={doublage || co.enregistrement}
          onClick={() => void ajouterNiveau()}
          title="Doubler ce lieu pour en faire l’étage suivant : murs, portes, sols, objets et lumières sont repris, à retoucher"
        >
          + Niveau
        </button>
        <button className="btn btn-sm" onClick={() => setAgrandir(!agrandir)} aria-pressed={agrandir}>
          Taille du terrain…
        </button>
        <button className="btn btn-sm" disabled={!co.peutAnnuler} onClick={co.annuler} title="Annuler (Ctrl+Z)">
          ↶
        </button>
        <button className="btn btn-sm" disabled={!co.peutRetablir} onClick={co.retablir} title="Rétablir (Ctrl+Y)">
          ↷
        </button>
        <button
          className="btn btn-sm btn-brass"
          disabled={!co.sale || co.enregistrement}
          onClick={() => void enregistrer()}
          title="Enregistrer (Ctrl+S) : l’image devient le plan du lieu"
        >
          {co.enregistrement ? 'Enregistrement…' : co.sale ? 'Enregistrer' : 'Enregistré'}
        </button>
      </div>

      {quitter ? (
        <div className="at-bandeau" role="alert">
          <span>Des changements ne sont pas enregistrés.</span>
          <button
            className="btn btn-sm btn-brass"
            onClick={async () => {
              setQuitter(false)
              if (await co.enregistrer()) {
                await s.refreshPlaces()
                s.ouvrirAtelier(null)
              }
            }}
          >
            Enregistrer
          </button>
          <button
            className="btn btn-sm"
            onClick={() => {
              setQuitter(false)
              co.abandonner()
              s.ouvrirAtelier(null)
            }}
          >
            Abandonner
          </button>
          <button className="btn btn-sm" onClick={() => setQuitter(false)}>
            Rester
          </button>
        </div>
      ) : null}

      {agrandir && co.c ? (
        <PanneauTaille
          c={co.c}
          onApercu={setApercuTaille}
          onAppliquer={(b) => {
            co.agrandir(b)
            setAgrandir(false)
          }}
          onFermer={() => setAgrandir(false)}
        />
      ) : null}

      <div className="at-corps">
        {chargement || !co.c ? (
          <div className="at-chargement" role="status" aria-live="polite">
            <span className="at-roue" aria-hidden="true" />
            <span>Chargement du lieu…</span>
            {chargement?.total ? (
              <>
                <span className="at-jauge">
                  <span style={{ width: `${(chargement.faites / chargement.total) * 100}%` }} />
                </span>
                <span className="at-compte">
                  {chargement.faites} / {chargement.total} images
                </span>
              </>
            ) : null}
          </div>
        ) : null}
        {co.c ? (
          <Toile
            c={co.c}
            assets={parId}
            images={images}
            versionImages={versionImages}
            grille={grille && !essai.enTest && !essai.testLum}
            outil={essai.enTest ? null : outil}
            repeindre={repeint}
            calque={
              voirAmbiance ? (
                <>
                  <TeinteAmbiance ambiance={ambiance} />
                  {essai.calque}
                  <div className="at-meteo">
                    <MeteoAnimee meteo={ambiance.meteo} force={ambiance.meteoForce} />
                  </div>
                </>
              ) : (
                essai.calque
              )
            }
            apercuTaille={agrandir ? apercuTaille : null}
          />
        ) : (
          <div className="at-toile" />
        )}
        <aside className={`at-panneau${etape === 'deco' && !essai.volet ? ' at-panneau-large' : ''}`}>
          {essai.volet ? (
            essai.volet
          ) : props ? (
            etape === 'sol' ? (
              <EtapeSol {...props} />
            ) : etape === 'murs' ? (
              <EtapeMurs {...props} />
            ) : etape === 'ouvertures' ? (
              <EtapeOuvertures {...props} />
            ) : etape === 'deco' ? (
              <EtapeDeco {...props} />
            ) : (
              <EtapeEclairage {...props} />
            )
          ) : null}
        </aside>
      </div>

      <div className="at-etat">
        {co.c ? (
          <>
            <span>
              Terrain : {co.c.largeur} × {co.c.hauteur} cases
            </span>
            <span>Case : {String(co.c.metresParCase).replace('.', ',')} m</span>
            <span>{grille ? 'Maj = tracé libre' : 'Grille coupée : tracé libre'}</span>
            <span>Molette : zoom · Espace ou clic milieu : déplacer</span>
            <span className="spacer" />
            <span>Les murs enregistrés arrêtent les pions et les regards</span>
          </>
        ) : null}
      </div>
    </section>
  )
}

/** Le nom du lieu, dans la barre de l'atelier : un clic pour le changer. */
function TitreDuLieu({ place }: { place: Place }): JSX.Element {
  const s = useStore()
  const [edition, setEdition] = useState<string | null>(null)
  /* Échap retire le champ : le « blur » qui suit ne doit rien enregistrer. */
  const annule = useRef(false)
  const valider = async (): Promise<void> => {
    if (annule.current) return
    const nom = edition?.trim()
    setEdition(null)
    if (!nom || nom === place.name) return
    try {
      await window.jdr.places.upsert({ id: place.id, name: nom })
      await s.refreshPlaces()
    } catch (e) {
      s.toast(e instanceof Error ? e.message : String(e), true)
    }
  }
  if (edition !== null)
    return (
      <input
        className="at-champ at-titre-champ"
        autoFocus
        value={edition}
        onChange={(e) => setEdition(e.target.value)}
        onBlur={() => void valider()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void valider()
          if (e.key === 'Escape') {
            annule.current = true
            setEdition(null)
          }
        }}
      />
    )
  return (
    <button
      className="at-titre"
      title="Renommer le lieu"
      onClick={() => {
        annule.current = false
        setEdition(place.name)
      }}
    >
      {place.name}
    </button>
  )
}

function PanneauTaille({
  c,
  onAppliquer,
  onApercu,
  onFermer
}: {
  c: Construction
  onAppliquer: (b: { gauche: number; haut: number; droite: number; bas: number }) => void
  /** Le terrain tel qu'il serait, en cases du terrain actuel ; `null` : rien à montrer. */
  onApercu: (r: { x0: number; y0: number; x1: number; y1: number } | null) => void
  onFermer: () => void
}): JSX.Element {
  const [unite, setUnite] = useState<'cases' | 'metres'>('cases')
  const [ancre, setAncre] = useState<Ancre>([0, 0])
  const [taille, setTaille] = useState({ largeur: c.largeur, hauteur: c.hauteur })
  const m = c.metresParCase
  const min = tailleMinimale(c, ancre)
  const enUnite = (cases: number): number => (unite === 'cases' ? cases : Math.round(cases * m * 10) / 10)
  const metres = (cases: number): string => String(Math.round(cases * m * 10) / 10).replace('.', ',')
  const enCases = (v: number): number => Math.max(1, Math.round(unite === 'cases' ? v : v / m))
  const trop = taille.largeur < min.largeur || taille.hauteur < min.hauteur
  const pareil = taille.largeur === c.largeur && taille.hauteur === c.hauteur
  const bords = bordsPourTaille(c, taille.largeur, taille.hauteur, ancre)

  /* L'aperçu suit chaque changement ; il s'efface en fermant le panneau. */
  useEffect(() => {
    onApercu(
      pareil
        ? null
        : { x0: -bords.gauche, y0: -bords.haut, x1: c.largeur + bords.droite, y1: c.hauteur + bords.bas }
    )
  }, [bords.gauche, bords.haut, bords.droite, bords.bas, pareil])
  useEffect(() => () => onApercu(null), [])

  const champ = (k: 'largeur' | 'hauteur', label: string): JSX.Element => (
    <label className="at-nombre">
      {label}
      <input
        type="number"
        min={unite === 'cases' ? 1 : m}
        step={unite === 'cases' ? 1 : m}
        value={enUnite(taille[k])}
        onChange={(e) => {
          const v = Number(e.target.value)
          if (Number.isFinite(v) && v > 0) setTaille({ ...taille, [k]: enCases(v) })
        }}
      />
    </label>
  )
  return (
    <div className="at-agrandir">
      <span>Taille du terrain :</span>
      {champ('largeur', 'largeur')}
      {champ('hauteur', 'hauteur')}
      <div className="at-outils">
        <button className="btn btn-sm" aria-pressed={unite === 'cases'} onClick={() => setUnite('cases')}>
          cases
        </button>
        <button className="btn btn-sm" aria-pressed={unite === 'metres'} onClick={() => setUnite('metres')}>
          mètres
        </button>
      </div>
      <span className="at-dim" title="Ce qui reste en place : le terrain grandit ou rétrécit de l’autre côté">
        Garder
      </span>
      <div className="at-ancre" role="group" aria-label="Le point qui reste en place">
        {([0, 0.5, 1] as const).flatMap((y) =>
          ([0, 0.5, 1] as const).map((x) => (
            <button
              key={`${x}-${y}`}
              aria-pressed={ancre[0] === x && ancre[1] === y}
              onClick={() => setAncre([x, y])}
              title="Ce coin (ou ce bord) reste en place"
            />
          ))
        )}
      </div>
      <span className="at-dim">
        {taille.largeur} × {taille.hauteur} cases · {metres(taille.largeur)} × {metres(taille.hauteur)} m
      </span>
      {trop ? (
        <span className="at-alerte">
          Trop petit : ce qui est construit dépasserait. Au moins {min.largeur} × {min.hauteur} cases (
          {metres(min.largeur)} × {metres(min.hauteur)} m) avec ce point gardé.
        </span>
      ) : null}
      <button className="btn btn-sm btn-brass" disabled={trop || pareil} onClick={() => onAppliquer(bords)}>
        Appliquer
      </button>
      <button className="btn btn-sm" onClick={onFermer}>
        Fermer
      </button>
    </div>
  )
}
