import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PION_COULEURS, porteFranchissable } from '@shared/types'
import { Pings, usePings } from '../shared/Pings'
import { Brouillard, regardsDes, sousUnRegard } from '../shared/Brouillard'
import { Visage } from '../shared/Visage'
import { Piece } from '../shared/Piece'
import { barrieres, pasContraint, seCroisent, type Pt } from '@shared/murs'
import { bordsOuverture } from '@shared/ouvertures'
import { modificateur, naturel, signe, type Naturel } from '@shared/jet'
import {
  depense,
  exigenceTenue,
  prochainCran,
  type Exigence,
  type ReglePreparation
} from '@shared/preparation'
import type { CadreCarre, CalqueBrouillard, MobilePing, Ouverture, PointMur } from '@shared/types'
import { heureLocale } from '@shared/heure'

/**
 * L'application du joueur, sur son téléphone.
 *
 * Elle ne parle pas à Electron : elle est servie par le petit serveur du poste
 * du MJ, sur le réseau local, et n'a que trois choses à faire — montrer la
 * fiche, noter un dé, pousser un pion. Le jeton d'appareil, obtenu une fois en
 * scannant le QR code, dort dans le navigateur ; on ne rescanne plus.
 */

const CLE = 'ecran-du-maitre/jeton'
const CLE_APPAREIL = 'ecran-du-maitre/appareil'
const CLE_ACCUEIL = 'ecran-du-maitre/accueil'

/*
 * L'offre d'installation du navigateur, si elle vient. Chrome ne la fait
 * qu'en HTTPS : sur le réseau de la table, en HTTP, elle ne viendra
 * généralement pas, et le bandeau montre alors le geste à faire à la main.
 * On l'écoute dès le chargement, car elle arrive avant l'affichage.
 */
let offreInstallation: (Event & { prompt: () => Promise<void> }) | null = null
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  offreInstallation = e as Event & { prompt: () => Promise<void> }
})

/**
 * Où joindre le poste du maître du jeu.
 *
 * En production la page vient de ce serveur, et tout est relatif. En
 * développement elle vient de Vite, sur un autre port : il faut alors nommer
 * le port du serveur, sans quoi les appels partiraient chez Vite, qui n'a
 * aucune campagne à offrir.
 */
const PORT = ((): string => {
  /* Le port réglé au poste arrive dans l'adresse de renvoi ; on le garde pour
     les rechargements, qui n'ont plus la requête. */
  const vu = new URLSearchParams(location.search).get('p')
  try {
    if (vu) sessionStorage.setItem('jdr.port', vu)
    return vu ?? sessionStorage.getItem('jdr.port') ?? '7777'
  } catch {
    return vu ?? '7777'
  }
})()
const API = location.port === PORT ? '' : `${location.protocol}//${location.hostname}:${PORT}`

interface Jauge { key: string; label: string; color: string; value: number; max: number }
/** `mod` : ce que le jet ajoute au dé. Absent d'un serveur plus ancien, on le calcule. */
interface Carac { key: string; label: string; code: string | null; valeur: number; mod?: number }
interface Comp { key: string; label: string; valeur: number }
interface PionVu {
  id: number
  label: string
  initials: string
  color: string
  x: number
  y: number
  /** Le côté où il regarde, en degrés, zéro vers le haut. */
  rotation: number
  /** La fiche derrière le jeton, ou `null` : un pion sans personnage n'a pas d'yeux. */
  characterId: number | null
  /** Le pion d'un PNJ : pas de regard non plus. */
  pnj?: boolean
  /** Ne paraît que sous le regard d'un joueur, comme sur l'écran de la table. */
  regard?: boolean
  url: string | null
  cadre: CadreCarre | null
  mien: boolean
  /* Blessé, à terre, ou rien à signaler. */
  etat: 'blesse' | 'ko' | null
}

/** Un document que le MJ a mis dans la pochette, tel que le téléphone le reçoit. */
interface DocPoche {
  id: number
  titre: string
  genre: 'image' | 'pdf' | 'video' | 'audio' | 'doc' | 'other'
  url: string | null
  vignette: string | null
  ongletId: number | null
  /** Vrai si ce document n'est qu'à lui — c'est le sel du procédé. */
  sien: boolean
  donneA: string
  lu: boolean
}

/** Une de ses affaires, telle que le téléphone la reçoit. */
interface ObjetTel {
  placementId: number
  objetId: number
  nom: string
  /** La clé de l'endroit du corps, ou `null` : dans son sac. */
  emplacement: string | null
  /** Les endroits où cet objet peut aller. Vide : il ne se porte pas. */
  emplacements: string[]
  qte: number
  teinte: string | null
  /** Une lampe : elle s'allume et s'éteint, et n'éclaire que portée. */
  lampe?: boolean
  allumee?: boolean
}

/** Un inventaire que le MJ a ouvert à la table : le camion, la malle. */
interface InventaireTel {
  id: number
  nom: string
  contenu: { placementId: number; objetId: number; nom: string; qte: number; teinte: string | null }[]
}

interface Etat {
  campagne: string | null
  joueur: { id: number; nom: string; couleur: string | null } | null
  /** Les couleurs des autres joueurs. Absent d'un serveur plus ancien. */
  couleursPrises?: { cle: string; par: string }[]
  perso: {
    id: number
    nom: string
    occupation: string | null
    age: string | null
    portrait: string | null
    cadre: CadreCarre | null
    jauges: Jauge[]
    caracs: Carac[]
    /** null : la campagne ne se sert pas des compétences. */
    comps: Comp[] | null
    /** Sa bourse, une ligne par monnaie. Absente d'un serveur plus ancien. */
    bourse?: { key: string; nom: string; abbr: string; teinte: string; image: string | null; valeur: number }[]
  } | null
  /** Ce qu'on lui a mis en main. Jamais ce qu'un autre a reçu. */
  pochette: { onglets: { id: number; nom: string }[]; docs: DocPoche[] }
  /** Ses affaires à lui, et les endroits du corps où les mettre. */
  objets: ObjetTel[]
  emplacements: { cle: string; nom: string }[]
  /** Les inventaires ouverts, où chacun pioche. Absent d'un serveur plus ancien. */
  inventaires?: InventaireTel[]
  gele: boolean
  /** Plein jour : la carte entière, sans ombre. */
  jour?: boolean
  /** Le lieu à l'écran, et la taille de son plan : le repère des murs. */
  lieu: { id: number; nom: string; plan: string | null; w: number | null; h: number | null; allure?: number } | null
  pions: PionVu[]
  /** Il avance dès qu'une porte ou une lampe bouge : c'est le signal de relire le calque. */
  calqueRev: number
  /** À qui le tour — `null` hors combat. Les participants cachés n'y sont pas. */
  tour: TourTel | null
  /** Le pion de celui qui joue : il porte un halo sur le plan. */
  pionEnJeuId: number | null
  /** Le MJ a invité à préparer son personnage. Absent d'un serveur plus ancien. */
  preparation?: PrepaTel | null
}

/** La préparation du personnage, telle que le téléphone la reçoit. */
interface PrepaTel {
  /** L'instant où le MJ l'a ouverte : une nouvelle invitation repart de zéro. */
  depuis: string | null
  regle: ReglePreparation
  /** Combien de compétences au plus ; null : autant qu'on veut. */
  limite: number | null
  caracs: { key: string; code: string; nom: string }[]
  comps: ({ key: string } & Exigence)[]
  mien: { stats: Record<string, number>; skills: string[]; valide: boolean }
}

interface EntrantTel {
  nom: string
  color: string
  initials: string
  url: string | null
  cadre: CadreCarre | null
  fait: boolean
  mien: boolean
}

interface TourTel {
  round: number
  ordre: EntrantTel[]
  /** Celui qui joue — ou, s'il est caché, celui qui jouera juste après. */
  curseur: number
  actifCache: boolean
}

interface Convive {
  id: number
  nom: string
  couleur: string | null
  perso: string | null
  appareils: number
}

type Onglet = 'fiche' | 'jet' | 'pion' | 'sac' | 'poche'

const jetonGarde = (): string | null => {
  try {
    return localStorage.getItem(CLE)
  } catch {
    return null
  }
}

/**
 * Le nom que cet appareil se donne à lui-même.
 *
 * Il survit à l'oubli du jeton : sans lui, un téléphone qui change de joueur
 * revient en inconnu et se fait ouvrir une seconde ligne, jusqu'à buter sur
 * les deux appareils alloués. Il ne donne accès à rien — c'est un repère, pas
 * un mot de passe, et le jeton reste le seul sésame.
 */
const cleAppareil = (): string | undefined => {
  try {
    const garde = localStorage.getItem(CLE_APPAREIL)
    if (garde) return garde
    const octets = new Uint8Array(16)
    crypto.getRandomValues(octets)
    const neuve = Array.from(octets, (o) => o.toString(16).padStart(2, '0')).join('')
    localStorage.setItem(CLE_APPAREIL, neuve)
    return neuve
  } catch {
    /* Navigation privée : l'appareil restera un inconnu, et le MJ déconnectera
       à la main la ligne de trop. */
    return undefined
  }
}

export function Mobile(): JSX.Element {
  const [jeton, setJeton] = useState<string | null>(jetonGarde)
  const [etat, setEtat] = useState<Etat | null>(null)
  /**
   * Le navigateur a refusé de vibrer. Chrome n'obéit qu'à une page qu'on a
   * touchée au moins une fois depuis son ouverture ; un iPhone, jamais. On le
   * dit, et l'écran tremble à la place.
   */
  const [vibreBloque, setVibreBloque] = useState(false)
  const vibrer = (motif: number[]): void => {
    let ok = false
    try {
      ok = !!navigator.vibrate?.(motif)
    } catch {
      ok = false
    }
    if (ok) return
    const corps = document.body
    corps.classList.remove('m-frisson')
    void corps.offsetWidth
    corps.classList.add('m-frisson')
    const total = motif.reduce((a, b) => a + b, 0)
    setTimeout(() => corps.classList.remove('m-frisson'), Math.max(400, Math.min(2500, total)))
    if (typeof navigator.vibrate === 'function') setVibreBloque(true)
  }
  /* Le premier toucher lève l'interdit : le bandeau s'en va. */
  useEffect(() => {
    if (!vibreBloque) return
    const leve = (): void => setVibreBloque(false)
    document.addEventListener('pointerdown', leve, { once: true })
    return () => document.removeEventListener('pointerdown', leve)
  }, [vibreBloque])
  const [convives, setConvives] = useState<Convive[] | null>(null)
  const [ferme, setFerme] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [onglet, setOnglet] = useState<Onglet>('fiche')
  /* La préparation refermée par le joueur, notée par son ouverture : une
     nouvelle invitation du MJ la rouvre d'elle-même. */
  const [prepaRangee, setPrepaRangee] = useState<string | null>(null)
  /* Les ondes de toute la table, la sienne comprise : on montre un point, on
     le voit partir. */
  const ondes = usePings()
  const onde = ondes.ajouter

  const invitation = new URLSearchParams(location.search).get('i')

  /** Premier contact : soit l'appareil est connu, soit on demande qui il est. */
  const frapper = useCallback(async (): Promise<void> => {
    const q = new URLSearchParams()
    if (jeton) q.set('t', jeton)
    if (invitation) q.set('i', invitation)
    try {
      const r = await fetch(`${API}/api/table?${q}`)
      const d = await r.json()
      if (r.ok && d.appaire) {
        setEtat(d.etat)
        setConvives(null)
        return
      }
      if (r.ok) {
        setConvives(d.joueurs)
        setFerme(false)
        return
      }
      /* Un jeton refusé : le MJ a coupé cet appareil. On repart de zéro. */
      if (r.status === 401 && jeton) {
        try {
          localStorage.removeItem(CLE)
        } catch {
          /* navigation privée : on oublie de toute façon en fermant */
        }
        setJeton(null)
        return
      }
      setFerme(true)
      setErreur(d.erreur === 'ferme' ? null : (d.erreur ?? null))
    } catch {
      setErreur('Le poste du maître du jeu ne répond pas. Vérifie le Wi-Fi.')
    }
  }, [jeton, invitation])

  useEffect(() => {
    void frapper()
  }, [frapper])

  /*
   * Le flux d'état. Le PC pousse tout ce qui change — une perte de points de
   * vie, un lieu qui bascule, un pion qu'un autre déplace. On se rebranche
   * seul : un téléphone qui dort coupe sa connexion sans prévenir.
   */
  useEffect(() => {
    if (!jeton || !etat) return
    let vivant = true
    let source: EventSource | null = null
    let reprise: ReturnType<typeof setTimeout> | null = null

    const brancher = (): void => {
      if (!vivant) return
      source = new EventSource(`${API}/api/stream?t=${encodeURIComponent(jeton)}`)
      source.addEventListener('state', (e) => setEtat(JSON.parse((e as MessageEvent).data)))
      source.addEventListener('ping', (e) => onde(JSON.parse((e as MessageEvent).data)))
      /* Un bruitage du MJ se sent dans la main. Android obéit ; Safari, sur
         iPhone, n'a pas `vibrate` — et rien ne doit casser pour autant. */
      source.addEventListener('vibre', (e) => {
        try {
          const motif = JSON.parse((e as MessageEvent).data)
          if (Array.isArray(motif)) vibrer(motif)
        } catch {
          /* Un motif illisible ne vibre pas, voilà tout. */
        }
      })
      source.onerror = () => {
        source?.close()
        if (vivant) reprise = setTimeout(brancher, 2500)
      }
    }
    brancher()

    /* Revenir sur l'application après l'avoir quittée doit la remettre à jour
       tout de suite, sans attendre la reconnexion du flux. */
    const reveil = (): void => {
      if (document.visibilityState === 'visible') void frapper()
    }
    document.addEventListener('visibilitychange', reveil)

    return () => {
      vivant = false
      if (reprise) clearTimeout(reprise)
      source?.close()
      document.removeEventListener('visibilitychange', reveil)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jeton, etat !== null])

  const appairer = async (playerId: number): Promise<void> => {
    setErreur(null)
    const r = await fetch(`${API}/api/pair?i=${encodeURIComponent(invitation ?? '')}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ playerId, appareil: cleAppareil() })
    })
    const d = await r.json()
    if (!r.ok) return setErreur(d.erreur)
    try {
      localStorage.setItem(CLE, d.token)
    } catch {
      /* navigation privée : l'appairage tiendra le temps de l'onglet */
    }
    setJeton(d.token)
    setEtat(d.etat)
    setConvives(null)
    setOnglet(d.etat?.perso ? 'fiche' : 'pion')
  }

  /* ---------------- les écrans ---------------- */

  if (etat?.preparation && etat.perso && prepaRangee !== etat.preparation.depuis) {
    const depuis = etat.preparation.depuis
    return (
      <Preparation
        key={depuis ?? ''}
        prepa={etat.preparation}
        nom={etat.perso.nom}
        joueur={etat.joueur?.nom ?? null}
        jeton={jeton!}
        onRanger={() => setPrepaRangee(depuis)}
      />
    )
  }

  if (etat) {
    return (
      <>
        {vibreBloque ? (
          <div className="m-vibre-bloque" role="status">
            Touche l’écran une fois : ton téléphone pourra vibrer quand le MJ le voudra.
          </div>
        ) : null}
        <Table
        etat={etat}
        jeton={jeton!}
        ondes={ondes.pings}
        onglet={onglet}
        setOnglet={setOnglet}
        onPreparer={etat.preparation && etat.perso ? () => setPrepaRangee(null) : null}
        onOublier={() => {
          /* On prévient le poste du MJ : sans cela sa ligne resterait en base,
             et l'appareil se compterait deux fois au prochain appairage. On ne
             l'attend pas pour rendre la main — la clé d'appareil rattrapera un
             réseau qui aurait coupé. */
          void fetch(`${API}/api/oublier?t=${encodeURIComponent(jeton!)}`, {
            method: 'POST'
          }).catch(() => undefined)
          try {
            localStorage.removeItem(CLE)
          } catch {
            /* rien à oublier */
          }
          setJeton(null)
          setEtat(null)
          setConvives(null)
        }}
      />
      </>
    )
  }

  if (convives) {
    return (
      <QuiEtesVous
        convives={convives}
        erreur={erreur}
        onChoix={(id) => void appairer(id)}
      />
    )
  }

  return (
    <div className="m-vide">
      <IconeApp />
      {ferme ? (
        <p>
          Le maître du jeu n’a pas ouvert l’accès. Demande-lui d’afficher le QR&nbsp;code depuis
          la&nbsp;Régie, puis scanne-le de nouveau.
        </p>
      ) : (
        <p>{erreur ?? 'Connexion…'}</p>
      )}
      <button className="m-btn" onClick={() => void frapper()}>
        Réessayer
      </button>
    </div>
  )
}

/* ============================================================
   Qui êtes-vous
   ============================================================ */

/**
 * « Mets-moi sur ton écran d'accueil » : proposé à l'ouverture, tant que la
 * page tourne dans le navigateur.
 *
 * Aucun navigateur ne laisse une page s'installer d'elle-même sur un réseau
 * local en HTTP : on montre donc le geste — le bouton Partager sur un iPhone
 * ou un iPad, le menu ⋮ ailleurs. Si le navigateur offre quand même
 * l'installation, un bouton la déclenche.
 *
 * « Plus tard » vaut pour cette visite ; « Ne plus proposer » pour toujours.
 * Ouverte depuis l'écran d'accueil, la page ne propose plus rien.
 */
function PoserSurAccueil(): JSX.Element | null {
  const [vu, setVu] = useState(() => {
    const installee =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    if (installee) return true
    try {
      return (
        localStorage.getItem(CLE_ACCUEIL) === 'non' || sessionStorage.getItem(CLE_ACCUEIL) === 'plus-tard'
      )
    } catch {
      return false
    }
  })
  if (vu) return null

  const ios =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const fermer = (pourToujours: boolean): void => {
    try {
      if (pourToujours) localStorage.setItem(CLE_ACCUEIL, 'non')
      else sessionStorage.setItem(CLE_ACCUEIL, 'plus-tard')
    } catch {
      /* navigation privée : il reviendra, tant pis */
    }
    setVu(true)
  }

  return (
    <div className="m-poser">
      <img src="/portable/icone-180.png" alt="" />
      <div className="m-poser-dit">
        <b>Garde l’Écran sur ton écran d’accueil</b>
        {offreInstallation ? (
          <span>Il s’ouvrira comme une application, sans la barre du navigateur.</span>
        ) : ios ? (
          <span>
            Touche <b>Partager</b> <i aria-hidden="true">⬆︎</i>, puis <b>Sur l’écran d’accueil</b>.
          </span>
        ) : (
          <span>
            Touche le menu <b>⋮</b> du navigateur, puis <b>Ajouter à l’écran d’accueil</b>.
          </span>
        )}
        <span className="m-poser-actes">
          {offreInstallation ? (
            <button
              className="oui"
              onClick={() => {
                void offreInstallation?.prompt()
                offreInstallation = null
                fermer(false)
              }}
            >
              Ajouter
            </button>
          ) : null}
          <button onClick={() => fermer(false)}>Plus tard</button>
          <button onClick={() => fermer(true)}>Ne plus proposer</button>
        </span>
      </div>
    </div>
  )
}

function QuiEtesVous({
  convives,
  erreur,
  onChoix
}: {
  convives: Convive[]
  erreur: string | null
  onChoix: (id: number) => void
}): JSX.Element {
  return (
    <div className="m-accueil">
      <div className="m-marque">
        <IconeApp taille={84} />
        <span>Quel joueur êtes-vous ?</span>
      </div>

      <PoserSurAccueil />

      {erreur ? <p className="m-erreur">{erreur}</p> : null}

      <div className="m-choix">
        {convives.map((c) => {
          const plein = c.appareils >= 2
          return (
            <button
              key={c.id}
              className="m-joueur"
              disabled={plein}
              style={teinte(c.couleur)}
              onClick={() => onChoix(c.id)}
            >
              <span className="m-pastille" />
              <span className="m-qui">
                <span className="m-nom">{c.nom}</span>
                <span className="m-perso">{c.perso ?? 'sans personnage'}</span>
              </span>
              {plein ? <span className="m-plein">2/2</span> : null}
            </button>
          )
        })}
      </div>

      <p className="m-note">
        Ce téléphone s’en souviendra : tu n’auras plus à scanner. Deux appareils au plus par
        joueur.
      </p>
    </div>
  )
}

/* ============================================================
   La table — fiche, jet, pion
   ============================================================ */

function Table({
  etat,
  jeton,
  ondes,
  onglet,
  setOnglet,
  onPreparer,
  onOublier
}: {
  etat: Etat
  jeton: string
  ondes: MobilePing[]
  onglet: Onglet
  setOnglet: (o: Onglet) => void
  /** La préparation est ouverte mais rangée : de quoi y revenir. */
  onPreparer: (() => void) | null
  onOublier: () => void
}): JSX.Element {
  return (
    <div className="m-app">
      <header className="m-tete" style={teinte(etat.joueur?.couleur ?? null)}>
        <span className="m-pastille" />
        <span className="m-qui">
          <span className="m-nom">{etat.perso?.nom ?? etat.joueur?.nom ?? '…'}</span>
          <span className="m-perso">{etat.perso ? etat.joueur?.nom : 'sans personnage'}</span>
        </span>
        <button className="m-sortir" onClick={onOublier}>
          changer
        </button>
      </header>

      {etat.tour ? <BandeauTour tour={etat.tour} /> : null}
      {onPreparer ? (
        <button className="m-prp-rappel" onClick={onPreparer}>
          {etat.preparation?.mien.valide
            ? 'Personnage validé · le retoucher'
            : 'Le MJ t’invite à préparer ton personnage'}
          <span aria-hidden="true">›</span>
        </button>
      ) : null}
      <PoserSurAccueil />

      <main className="m-corps">
        {onglet === 'fiche' && <Fiche etat={etat} jeton={jeton} />}
        {onglet === 'jet' && <Jet etat={etat} jeton={jeton} />}
        {onglet === 'pion' && <Plan etat={etat} jeton={jeton} ondes={ondes} />}
        {onglet === 'sac' && <Sac etat={etat} jeton={jeton} />}
        {onglet === 'poche' && <Poche etat={etat} jeton={jeton} />}
      </main>

      <nav className="m-onglets" role="tablist">
        {(['fiche', 'jet', 'pion', 'sac', 'poche'] as Onglet[]).map((o) => (
          <button key={o} role="tab" aria-selected={onglet === o} onClick={() => setOnglet(o)}>
            <span className="m-ic" aria-hidden="true">
              {{ fiche: '▤', jet: '⬢', pion: '◉', sac: '▦', poche: '✉' }[o]}
            </span>
            {{ fiche: 'Fiche', jet: 'Jet', pion: 'Pion', sac: 'Sac', poche: 'Pochette' }[o]}
            {/* Un point, pas un compte : à la table on veut savoir qu'il s'est
                passé quelque chose, pas combien de fois. */}
            {o === 'poche' && etat.pochette.docs.some((d) => !d.lu) ? (
              <span className="m-neuf" aria-label="du nouveau" />
            ) : null}
            {/* Un inventaire ouvert : il y a de quoi piocher dans le Sac. */}
            {o === 'sac' && (etat.inventaires ?? []).length > 0 ? (
              <span className="m-neuf" aria-label="un inventaire est ouvert" />
            ) : null}
          </button>
        ))}
      </nav>
    </div>
  )
}

/* ============================================================
   Préparer son personnage
   ============================================================ */

/**
 * Avant la séance, le joueur répartit ses points : une ligne par
 * caractéristique, − et +, sa valeur et son modificateur qui bougent sous son
 * pouce. Chaque geste part au poste du MJ — qui le suit, et peut le montrer à
 * toute la table ; rien n'est écrit sur la fiche avant « Valider ».
 *
 * Le compte se fait ici et au serveur avec la même règle (`shared/preparation`) :
 * un « + » grisé l'est parce que le serveur refuserait.
 */
function Preparation({
  prepa,
  nom,
  joueur,
  jeton,
  onRanger
}: {
  prepa: PrepaTel
  nom: string
  /** Le prénom de celui qui tient le téléphone. */
  joueur: string | null
  jeton: string
  onRanger: () => void
}): JSX.Element {
  const { regle, limite } = prepa
  /* Le téléphone tient son brouillon : l'état qui revient du PC le
     rattraperait en plein geste. On ne reprend celui du PC qu'à l'ouverture. */
  const [stats, setStats] = useState<Record<string, number>>(() => ({ ...prepa.mien.stats }))
  const [skills, setSkills] = useState<string[]>(() => [...prepa.mien.skills])
  const [vue, setVue] = useState<'caracs' | 'comps'>('caracs')
  const [fini, setFini] = useState(prepa.mien.valide)
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  const reste = regle.points - depense(stats, regle)
  /* Une compétence prise sort du compte si on retire le point qui l'ouvrait :
     elle ne part pas au PC, et revient si le point revient. */
  const tenuesDe = (st: Record<string, number>, sk: string[]): string[] =>
    sk.filter((k) => {
      const c = prepa.comps.find((x) => x.key === k)
      return !!c && exigenceTenue(c, st)
    })
  const tenues = tenuesDe(stats, skills)

  const envoyer = (st: Record<string, number>, sk: string[], valider = false): Promise<Response> =>
    fetch(`${API}/api/preparation?t=${encodeURIComponent(jeton)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ stats: st, skills: tenuesDe(st, sk), valider })
    })

  /* Chaque geste part au PC, regroupés : cinq « + » d'affilée font un envoi. */
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null)
  const poser = (st: Record<string, number>, sk: string[]): void => {
    setStats(st)
    setSkills(sk)
    if (minuteur.current) clearTimeout(minuteur.current)
    minuteur.current = setTimeout(() => void envoyer(st, sk).catch(() => undefined), 150)
  }
  useEffect(
    () => () => {
      if (minuteur.current) clearTimeout(minuteur.current)
    },
    []
  )

  const valider = async (): Promise<void> => {
    if (minuteur.current) clearTimeout(minuteur.current)
    setEnvoi(true)
    setErreur(null)
    try {
      const r = await envoyer(stats, skills, true)
      if (!r.ok) return setErreur(((await r.json()) as { erreur?: string }).erreur ?? 'Refusé.')
      setFini(true)
    } catch {
      setErreur('Le PC du MJ ne répond pas.')
    } finally {
      setEnvoi(false)
    }
  }

  if (fini) {
    return (
      <div className="m-prp">
        <div className="m-prp-fin">
          <span className="m-eyebrow m-prp-ok">Écrit sur ta fiche</span>
          <h1 className="m-prp-titre">{nom} est prêt·e</h1>
          <p className="m-note m-gauche">
            Le MJ voit ta répartition. Tant qu’il n’a pas clos la préparation, tu peux encore la
            retoucher.
          </p>
          <div className="m-prp-bilan">
            {prepa.caracs.map((c) => {
              const v = stats[c.key] ?? regle.depart
              const m = modificateur(v)
              return (
                <div key={c.key}>
                  <b>{v}</b>
                  <b className={m > 0 ? 'plus' : m < 0 ? 'moins' : ''}>{signe(m)}</b>
                  <span className="m-prp-code">{c.code}</span>
                  {c.nom !== c.code ? <span className="m-prp-nom">{c.nom}</span> : null}
                </div>
              )
            })}
          </div>
          {regle.competences && prepa.comps.length ? (
            <div>
              <span className="m-eyebrow">Compétences</span>
              <p className="m-prp-comps">
                {tenues.map((k) => prepa.comps.find((c) => c.key === k)?.nom).join(' · ') ||
                  'aucune'}
              </p>
            </div>
          ) : null}
        </div>
        <div className="m-prp-pied">
          <button className="m-btn" onClick={() => setFini(false)}>
            Retoucher
          </button>
          <button className="m-btn" onClick={onRanger}>
            Revenir à ma fiche
          </button>
        </div>
      </div>
    )
  }

  const avecComps = regle.competences && prepa.comps.length > 0
  return (
    <div className="m-prp">
      <div className="m-prp-tete">
        <div className="m-prp-haut">
          <span className="m-eyebrow">Avant la séance · demandé par le MJ</span>
          <button className="m-prp-ranger" onClick={onRanger}>
            plus tard
          </button>
        </div>
        <h1 className="m-prp-titre">{nom}</h1>
        {joueur ? <span className="m-prp-joueur">joué par {joueur}</span> : null}
        <div className="m-prp-reste">
          <span>Points à répartir</span>
          <span className={reste === 0 ? 'zero' : ''}>
            <b>{reste}</b> / {regle.points}
          </span>
        </div>
        <div className="m-prp-jauge">
          <i
            style={{
              width: `${Math.min(100, ((regle.points - reste) / Math.max(1, regle.points)) * 100)}%`
            }}
          />
        </div>
      </div>

      {avecComps ? (
        <div className="m-prp-vues" role="tablist">
          <button role="tab" aria-selected={vue === 'caracs'} onClick={() => setVue('caracs')}>
            Caractéristiques
          </button>
          <button role="tab" aria-selected={vue === 'comps'} onClick={() => setVue('comps')}>
            Compétences · {tenues.length}
            {limite != null ? `/${limite}` : ''}
          </button>
        </div>
      ) : null}

      <div className="m-prp-corps">
        {vue === 'caracs' || !avecComps ? (
          prepa.caracs.map((c) => {
            const v = stats[c.key] ?? regle.depart
            const m = modificateur(v)
            const suivant = prochainCran(v, regle)
            const part = (v - regle.depart) / Math.max(1, regle.plafond - regle.depart)
            return (
              <div key={c.key} className="m-prp-ligne">
                <b className="m-prp-code">{c.code}</b>
                <span className="m-prp-nomb">
                  <span>{c.nom !== c.code ? c.nom : ''}</span>
                  <span className="m-prp-barre">
                    <i style={{ width: `${part * 100}%` }} />
                  </span>
                </span>
                <button
                  aria-label={`Retirer un point en ${c.nom}`}
                  disabled={v <= regle.depart}
                  onClick={() => poser({ ...stats, [c.key]: v - 1 }, skills)}
                >
                  −
                </button>
                <b className="m-prp-val">{v}</b>
                <button
                  className="plus"
                  aria-label={`Ajouter un point en ${c.nom}`}
                  disabled={suivant === null || reste < suivant}
                  onClick={() => poser({ ...stats, [c.key]: v + 1 }, skills)}
                >
                  +
                </button>
                <span className="m-prp-mod">
                  <b className={m > 0 ? 'plus' : m < 0 ? 'moins' : ''}>{signe(m)}</b>
                  <small>
                    {suivant === null ? 'max' : `+1 = ${suivant} pt${suivant > 1 ? 's' : ''}`}
                  </small>
                </span>
              </div>
            )
          })
        ) : (
          <>
            <p className="m-note m-gauche">
              {limite != null ? `${limite} au choix. ` : ''}Celles qui demandent une
              caractéristique s’ouvrent dès que tu l’atteins.
            </p>
            {prepa.comps.map((c) => {
              const ok = exigenceTenue(c, stats)
              const pris = tenues.includes(c.key)
              const plein = limite != null && tenues.length >= limite && !pris
              const manque = c.statKey && c.min != null ? c.min - (stats[c.statKey] ?? 0) : 0
              const sans = skills.filter((k) => k !== c.key)
              return (
                <button
                  key={c.key}
                  className={`m-prp-comp${pris ? ' pris' : ''}`}
                  aria-pressed={pris}
                  disabled={!ok || plein}
                  onClick={() => poser(stats, pris ? sans : [...sans, c.key])}
                >
                  <span className="m-prp-coche">{pris ? '✓' : ''}</span>
                  <span className="m-prp-cnom">
                    <span>{c.nom}</span>
                    {c.texte ? (
                      <small className={ok ? '' : 'manque'}>
                        {c.texte}
                        {ok ? '' : ` · il te manque ${manque}`}
                      </small>
                    ) : null}
                  </span>
                </button>
              )
            })}
          </>
        )}
      </div>

      <div className="m-prp-pied">
        {erreur ? <p className="m-prp-erreur">{erreur}</p> : null}
        {/* Tous les points posés, ni plus ni moins : la fiche ne part pas à moitié faite. */}
        {reste > 0 ? (
          <p className="m-prp-avert">
            Pose encore {reste} point{reste > 1 ? 's' : ''} pour valider.
          </p>
        ) : null}
        <button
          className="m-btn m-prp-valider"
          disabled={envoi || reste !== 0}
          onClick={() => void valider()}
        >
          Valider mon personnage
        </button>
      </div>
    </div>
  )
}

/* ---------------- les tours ---------------- */

/**
 * À qui le tour, sous l'en-tête, quel que soit l'onglet ouvert.
 *
 * Quand c'est le sien, la bande se fait dorée et le téléphone vibre une fois :
 * on a souvent le nez ailleurs quand son tour arrive. Sinon, une ligne
 * discrète dit qui joue et combien passent avant lui ; un toucher déplie
 * l'ordre entier.
 */
function BandeauTour({ tour }: { tour: TourTel }): JSX.Element {
  const [ouvert, setOuvert] = useState(false)
  const n = tour.ordre.length
  const enJeu = tour.actifCache ? null : tour.ordre[tour.curseur]
  const moi = tour.ordre.findIndex((e) => e.mien)
  const aMoi = enJeu?.mien ?? false
  /* Combien de tours avant le sien. Un caché qui joue n'est pas dans
     l'ordre : le curseur montre déjà celui d'après, d'où le un de plus. */
  const dans = moi < 0 || aMoi ? null : ((moi - tour.curseur + n) % n) + (tour.actifCache ? 1 : 0)

  const cle = `${tour.round}-${tour.curseur}`
  useEffect(() => {
    if (aMoi) navigator.vibrate?.([120, 60, 120])
  }, [aMoi, cle])

  return (
    <div className={`m-tour${aMoi ? ' m-tour-moi' : ''}`}>
      <button className="m-tour-ligne" onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert}>
        <span className="m-tour-round">Round {tour.round}</span>
        <span className="m-tour-qui">
          {aMoi
            ? 'C’est ton tour'
            : `Au tour de ${enJeu ? enJeu.nom : 'quelqu’un d’autre'}`}
        </span>
        {dans != null ? (
          <span className="m-tour-dans">{dans === 1 ? 'toi juste après' : `toi dans ${dans}`}</span>
        ) : null}
        <span className="m-tour-fleche" aria-hidden="true">
          {ouvert ? '▴' : '▾'}
        </span>
      </button>
      {ouvert ? (
        <ol className="m-tour-ordre">
          {tour.ordre.map((e, i) => (
            <li
              key={i}
              className={`${!tour.actifCache && i === tour.curseur ? 'actif' : ''}${
                e.fait ? ' fait' : ''
              }`}
            >
              <span className="m-tour-rond" style={teinte(e.color)}>
                {e.url ? <Visage url={API + e.url} cadre={e.cadre} /> : e.initials}
              </span>
              {e.nom}
              {e.mien ? <em> (toi)</em> : null}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  )
}

/* ---------------- la fiche ---------------- */

function Fiche({ etat, jeton }: { etat: Etat; jeton: string }): JSX.Element {
  const p = etat.perso
  const [refus, setRefus] = useState<string | null>(null)

  const changerCouleur = async (cle: string): Promise<void> => {
    setRefus(null)
    const r = await fetch(`${API}/api/couleur?t=${encodeURIComponent(jeton)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ couleur: cle })
    })
    if (!r.ok) setRefus((await r.json()).erreur)
  }

  if (!p) {
    return (
      <div className="m-vue">
        <p className="m-note">
          Aucun personnage ne t’est attribué. Le maître du jeu t’en donnera un depuis
          «&nbsp;Fiches&nbsp;».
        </p>
      </div>
    )
  }

  return (
    <div className="m-vue">
      <div className="m-identite" style={teinte(etat.joueur?.couleur ?? null)}>
        <span className="m-portrait">
          {p.portrait ? (
            <Visage url={API + p.portrait} cadre={p.cadre} />
          ) : (
            initiales(p.nom)
          )}
        </span>
        <span>
          <h2>{p.nom}</h2>
          <span className="m-occ">
            {[p.occupation, p.age ? `${p.age} ans` : null].filter(Boolean).join(', ') || '—'}
          </span>
        </span>
      </div>

      {p.jauges.length > 0 && (
        <div className="m-jauges">
          {p.jauges.map((g) => (
            <div className="m-jauge" key={g.key}>
              <span className="m-jn">{g.label}</span>
              <span className="m-jv">
                {g.value} / {g.max}
              </span>
              <span className="m-piste">
                <i
                  className={`g-${g.color}`}
                  style={{ width: `${g.max ? Math.round((g.value / g.max) * 100) : 0}%` }}
                />
              </span>
            </div>
          ))}
        </div>
      )}

      <section>
        <span className="m-eyebrow">Caractéristiques</span>
        <div className="m-caracs">
          {p.caracs.map((c) => (
            <div className="m-cc" key={c.key} title={c.label}>
              <b>{c.valeur}</b>
              <em>{signe(bonusDe(c))}</em>
              <span>{c.code ?? abrege(c.label)}</span>
            </div>
          ))}
        </div>
      </section>

      {p.comps && (
      <section>
        <span className="m-eyebrow">Compétences</span>
        {p.comps.length === 0 ? (
          <p className="m-note m-gauche">Aucune compétence prise.</p>
        ) : (
          <div className="m-comps">
            {p.comps.map((c) => (
              <div className="m-cp" key={c.key}>
                <span>{c.label}</span>
                <span className="m-pts" />
                <b>{c.valeur}</b>
              </div>
            ))}
          </div>
        )}
      </section>
      )}

      {p.bourse && p.bourse.length > 0 ? (
        <section>
          <span className="m-eyebrow">Ma bourse</span>
          <div className="m-comps">
            {p.bourse.map((m) => (
              <div className="m-cp m-sou" key={m.key}>
                <Piece teinte={m.teinte} url={m.image ? API + m.image : null} taille={22} />
                <span>{m.nom}</span>
                <span className="m-pts" />
                <b>{m.valeur.toLocaleString('fr-FR')}</b>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <span className="m-eyebrow">Ma couleur</span>
        <div className="m-teintes">
          {PION_COULEURS.map((c) => {
            const prise = etat.couleursPrises?.find((x) => x.cle === c.key)
            return (
              <button
                key={c.key}
                className={`m-tt${prise ? ' prise' : ''}`}
                style={{ ['--p' as string]: c.hex }}
                aria-pressed={etat.joueur?.couleur === c.key}
                aria-label={prise ? `${c.name}, prise par ${prise.par}` : c.name}
                title={prise ? `${c.name} — prise par ${prise.par}` : c.name}
                disabled={!!prise}
                onClick={() => void changerCouleur(c.key)}
              />
            )
          })}
        </div>
        {refus ? <p className="m-erreur">{refus}</p> : null}
        <p className="m-note m-gauche">
          Celle de ton pion à l’écran et de ton nom dans le journal du maître du jeu.
        </p>
      </section>

      <p className="m-lecture">
        Jauges, caractéristiques et compétences sont en lecture : les points de vie restent au
        maître du jeu, qui les journalise.
      </p>
    </div>
  )
}

/* ---------------- son sac, et ce qu'il porte ---------------- */

/**
 * Ce qu'il a sur lui, et où il le met.
 *
 * Sur un téléphone, pas de poupée : une liste suffit, et elle se lit d'un
 * pouce. Chaque affaire porte l'endroit du corps où elle est ; on le tapote,
 * on choisit ailleurs — ou « dans le sac », qui n'occupe rien.
 *
 * **Il ne range que ses affaires.** Le serveur le revérifie de son côté : un
 * téléphone ne déshabille pas le voisin, et ce n'est pas l'interface qui en
 * décide.
 */
function Sac({ etat, jeton }: { etat: Etat; jeton: string }): JSX.Element {
  const [ouvert, setOuvert] = useState<number | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [cherche, setCherche] = useState('')
  const [envoi, setEnvoi] = useState<number | null>(null)
  const inventaires = etat.inventaires ?? []

  /** Prendre dans un inventaire, ou y remettre. L'état revient par le flux. */
  const geste = async (
    route: 'prendre' | 'remettre',
    corps: { placementId: number; inventaireId?: number }
  ): Promise<void> => {
    setOuvert(null)
    setErreur(null)
    setEnvoi(corps.placementId)
    try {
      const r = await fetch(`${API}/api/${route}?t=${encodeURIComponent(jeton)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(corps)
      })
      if (!r.ok)
        setErreur(
          (await r.json().catch(() => ({}))).erreur ??
            (route === 'prendre' ? 'Impossible de le prendre.' : 'Impossible de le remettre.')
        )
    } catch {
      setErreur('Le maître du jeu ne répond pas.')
    } finally {
      setEnvoi(null)
    }
  }

  const objets = etat.objets
  const portes = objets.filter((o) => o.emplacement)
  const sac = objets.filter((o) => !o.emplacement)
  const nomDe = (cle: string | null): string =>
    etat.emplacements.find((e) => e.cle === cle)?.nom ?? 'Dans le sac'

  /** Ranger : sur le corps, ou dans le sac. L'état revient par le flux. */
  const ranger = async (placementId: number, emplacement: string | null): Promise<void> => {
    setOuvert(null)
    setErreur(null)
    const r = await fetch(`${API}/api/equiper?t=${encodeURIComponent(jeton)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ placementId, emplacement })
    })
    if (!r.ok) setErreur((await r.json().catch(() => ({}))).erreur ?? 'Impossible de le ranger.')
  }

  /** Allumer ou éteindre sa lampe, sans la ranger. L'état revient par le flux. */
  const allumer = async (placementId: number, allumee: boolean): Promise<void> => {
    setErreur(null)
    const r = await fetch(`${API}/api/allumer?t=${encodeURIComponent(jeton)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ placementId, allumee })
    })
    if (!r.ok) setErreur((await r.json().catch(() => ({}))).erreur ?? 'Impossible de l’allumer.')
  }

  if (!etat.perso) {
    return (
      <div className="m-vue">
        <p className="m-note">Aucun personnage ne t’est attribué : rien à porter pour l’instant.</p>
      </div>
    )
  }

  /* Une lampe en main : la ligne s'ouvre comme les autres, et l'interrupteur
     est à côté, sous le pouce. Dans le sac, elle n'éclaire pas : pas
     d'interrupteur. */
  const ligne = (o: ObjetTel): JSX.Element =>
    o.lampe && o.emplacement ? (
      <div key={o.placementId} className="m-objet porte m-lampe" style={teinte(o.teinte)}>
        <span className="m-o-pastille" />
        <button className="m-lampe-ouvrir" onClick={() => setOuvert(o.placementId)}>
          <span className="m-o-nom">{o.nom}</span>
          <span className="m-o-ou">{nomDe(o.emplacement)}</span>
        </button>
        <button
          className={`m-lampe-bouton${o.allumee ? ' on' : ''}`}
          aria-pressed={!!o.allumee}
          onClick={() => void allumer(o.placementId, !o.allumee)}
        >
          {o.allumee ? 'Allumée' : 'Éteinte'}
        </button>
      </div>
    ) : (
      <button
        key={o.placementId}
        className={`m-objet${o.emplacement ? ' porte' : ''}`}
        style={teinte(o.teinte)}
        onClick={() => setOuvert(o.placementId)}
      >
        <span className="m-o-pastille" />
        <span className="m-o-nom">
          {o.nom}
          {o.qte > 1 ? <b> ×{o.qte}</b> : null}
        </span>
        <span className="m-o-ou">{o.emplacement ? nomDe(o.emplacement) : 'inventaire'}</span>
      </button>
    )

  const enChoix = objets.find((o) => o.placementId === ouvert) ?? null
  /* On ne lui propose que les endroits où cette chose-là peut aller — une épée
     dans l'une ou l'autre main, pas sur la tête. Un objet dont le MJ n'a rien
     dit peut se mettre n'importe où : mieux vaut le laisser faire que de lui
     présenter une liste vide. */
  const possibles =
    enChoix && (enChoix.emplacements ?? []).length
      ? etat.emplacements.filter((e) => (enChoix.emplacements ?? []).includes(e.cle))
      : etat.emplacements
  /* Ce qu'un autre objet occupe déjà : on le dit plutôt que de le cacher —
     choisir cette place-là déplacera l'autre, autant le savoir avant. */
  const occupant = (cle: string): ObjetTel | undefined =>
    objets.find((o) => o.emplacement === cle && o.placementId !== enChoix?.placementId)

  return (
    <div className="m-vue">
      {erreur ? <p className="m-erreur">{erreur}</p> : null}

      <h2 className="m-titre">Ce que je porte</h2>
      {portes.length === 0 ? (
        <p className="m-note">Rien sur toi pour l’instant.</p>
      ) : (
        <div className="m-objets">{portes.map(ligne)}</div>
      )}

      <h2 className="m-titre">Dans mon sac</h2>
      {sac.length === 0 ? (
        <p className="m-note">Ton sac est vide.</p>
      ) : (
        <div className="m-objets">{sac.map(ligne)}</div>
      )}

      {objets.length === 0 && inventaires.length === 0 ? (
        <p className="m-note">
          Le maître du jeu ne t’a rien donné. Ce qu’il te tendra apparaîtra ici tout seul.
        </p>
      ) : null}

      {/* Les inventaires que le MJ a ouverts : on y pioche, l'objet tombe dans
          le sac. Fermés, ils disparaissent d'ici. */}
      {inventaires.map((inv) => {
        const mot = cherche.trim().toLowerCase()
        const liste = inv.contenu.filter((c) => !mot || c.nom.toLowerCase().includes(mot))
        return (
          <section key={inv.id} className="m-inv">
            <h2 className="m-inv-titre">{inv.nom}</h2>
            {inv.contenu.length > 6 ? (
              <input
                className="m-inv-cherche"
                type="search"
                value={cherche}
                onChange={(e) => setCherche(e.target.value)}
                placeholder={`Chercher dans ${inv.nom}…`}
                aria-label={`Chercher dans ${inv.nom}`}
              />
            ) : null}
            {liste.length === 0 ? (
              <p className="m-note">{inv.contenu.length ? 'Rien ne correspond.' : 'Plus rien dedans.'}</p>
            ) : (
              <div className="m-objets">
                {liste.map((c) => (
                  <div key={c.placementId} className="m-objet m-inv-ligne" style={teinte(c.teinte)}>
                    <span className="m-o-pastille" />
                    <span className="m-o-nom">
                      {c.nom}
                      {c.qte > 1 ? <b> ×{c.qte}</b> : null}
                    </span>
                    <button
                      className="m-inv-prendre"
                      disabled={envoi === c.placementId}
                      onClick={() => void geste('prendre', { placementId: c.placementId })}
                    >
                      Prendre
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )
      })}

      {/* La feuille qui monte du bas : le pouce y arrive, et la liste des
          endroits du corps tient en un écran. */}
      {enChoix ? (
        <div className="m-feuille-fond" onClick={() => setOuvert(null)}>
          <div className="m-feuille" onClick={(e) => e.stopPropagation()}>
            <div className="m-f-tete">
              <b>{enChoix.nom}</b>
              <span>où le porter ?</span>
            </div>
            <div className="m-f-choix">
              {possibles.map((e) => {
                const pris = occupant(e.cle)
                return (
                  <button
                    key={e.cle}
                    className={enChoix.emplacement === e.cle ? 'on' : ''}
                    onClick={() => void ranger(enChoix.placementId, e.cle)}
                  >
                    {e.nom}
                    {pris ? <i>{pris.nom}</i> : null}
                  </button>
                )
              })}
              <button
                className={`m-f-sac${enChoix.emplacement === null ? ' on' : ''}`}
                onClick={() => void ranger(enChoix.placementId, null)}
              >
                Dans le sac
                <i>ne rien occuper</i>
              </button>
            </div>
            {/* Le rendre : il quitte le sac et retourne dans l'inventaire. */}
            {inventaires.map((inv) => (
              <button
                key={inv.id}
                className="m-f-remettre"
                onClick={() => void geste('remettre', { placementId: enChoix.placementId, inventaireId: inv.id })}
              >
                Remettre dans {inv.nom}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

/* ---------------- la pochette ---------------- */

/**
 * Ce que le maître du jeu lui a mis en main.
 *
 * Les onglets ne s'affichent que si **ce joueur-là** a de quoi en remplir plus
 * d'un : un rangement vide pour lui ne serait qu'un bouton qui ne mène nulle
 * part. Un document tapoté s'ouvre par-dessus tout le reste — une lettre se
 * lit, elle ne se consulte pas du coin de l'œil.
 */
function Poche({ etat, jeton }: { etat: Etat; jeton: string }): JSX.Element {
  const { onglets, docs } = etat.pochette
  const [rang, setRang] = useState<number | 'tout'>('tout')
  const [ouvert, setOuvert] = useState<number | null>(null)

  /* Les onglets où il a quelque chose, dans l'ordre du MJ. */
  const siens = onglets.filter((o) => docs.some((d) => d.ongletId === o.id))
  const bande = siens.length > 1

  /* Le rangement ouvert peut se vider sous ses yeux — le MJ reprend le dernier
     document qu'il contenait. On retombe alors sur la pile entière. */
  useEffect(() => {
    if (rang !== 'tout' && !siens.some((o) => o.id === rang)) setRang('tout')
  }, [siens, rang])

  const vus = docs.filter((d) => rang === 'tout' || d.ongletId === rang)
  const doc = docs.find((d) => d.id === ouvert) ?? null

  /**
   * « Je l'ai ouvert. »
   *
   * On le dit une fois, à l'ouverture, et sans attendre la réponse : le MJ
   * verra sa pastille se remplir, et si le message se perd le joueur n'en
   * saura rien — ce n'est pas lui que cela regarde.
   */
  const marquerLu = (d: DocPoche): void => {
    if (d.lu) return
    void fetch(`${API}/api/pochette/lu?t=${encodeURIComponent(jeton)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: d.id })
    }).catch(() => undefined)
  }

  const ouvre = (d: DocPoche): void => {
    setOuvert(d.id)
    marquerLu(d)
  }

  return (
    <div className="m-vue">
      <span className="m-eyebrow">
        La pochette — {docs.length} document{docs.length > 1 ? 's' : ''}
      </span>

      {bande ? (
        <div className="m-rangs" role="tablist" aria-label="Rangements">
          {([{ id: 'tout' as const, nom: 'Tout' }] as { id: number | 'tout'; nom: string }[])
            .concat(siens.map((o) => ({ id: o.id as number | 'tout', nom: o.nom })))
            .map((o) => (
              <button
                key={String(o.id)}
                className="m-rang"
                role="tab"
                aria-selected={rang === o.id}
                onClick={() => setRang(o.id)}
              >
                {o.nom}
                {docs.some((d) => (o.id === 'tout' || d.ongletId === o.id) && !d.lu) ? (
                  <span className="pt" />
                ) : null}
              </button>
            ))}
        </div>
      ) : null}

      <div className="m-poche">
        {vus.length === 0 ? (
          <p className="m-note">
            Le maître du jeu n’a encore rien mis dans la pochette. Ce qu’il y déposera s’affichera
            ici.
          </p>
        ) : null}
        {vus.map((d) => {
          /*
           * Un PDF s'ouvre dans le lecteur du navigateur, et non dans une
           * fenêtre de l'application : il y gagne le plein écran, le zoom, la
           * recherche dans le texte, et sur un iPhone il s'affiche enfin —
           * Safari ne rend pas un PDF dans un cadre, mais très bien dans un
           * onglet à lui.
           *
           * C'est un vrai lien, pas un bouton qui appellerait `window.open` :
           * un lien n'est jamais pris pour une fenêtre intruse et bloqué.
           */
          const Cadre = d.genre === 'pdf' ? 'a' : 'button'
          const propres =
            d.genre === 'pdf'
              ? {
                  href: `${API}${d.url ?? ''}#navpanes=0`,
                  target: '_blank',
                  rel: 'noreferrer',
                  onClick: () => marquerLu(d)
                }
              : { onClick: () => ouvre(d) }
          return (
          <Cadre key={d.id} className="m-doc" {...propres}>
            <span className="vig">
              {d.vignette ? (
                <img src={API + d.vignette} alt="" draggable={false} />
              ) : (
                <span className="sans" aria-hidden="true">
                  {d.genre === 'pdf' ? '▤' : '◻'}
                </span>
              )}
              {d.genre === 'video' ? <span className="lire-film">▶</span> : null}
              {d.genre !== 'image' ? (
                <span className="nature">
                  {natureDite(d.genre)}
                  {/* Il quitte l'application : autant le dire d'un signe. */}
                  {d.genre === 'pdf' ? <i aria-hidden="true">↗</i> : null}
                </span>
              ) : null}
            </span>
            <span className="dit">
              <span className="t">{d.titre}</span>
              <span className="sous">
                {d.sien ? (
                  <span className="sien">pour toi seul</span>
                ) : (
                  <span>toute la table</span>
                )}
                {bande && rang === 'tout' ? (
                  <span className="rang-dit">
                    {onglets.find((o) => o.id === d.ongletId)?.nom ?? ''}
                  </span>
                ) : null}
                {!d.lu ? <span className="point" /> : null}
                <span className="h">{heureLocale(d.donneA)}</span>
              </span>
            </span>
          </Cadre>
          )
        })}
      </div>

      {doc ? <Lire doc={doc} onClose={() => setOuvert(null)} /> : null}
    </div>
  )
}

/**
 * Un document déplié, par-dessus tout le reste.
 *
 * Une image se déroule sur toute la largeur et se pince pour agrandir — le
 * geste attendu sur une feuille tenue en main. Une vidéo apporte le lecteur du
 * téléphone, avec ses propres gestes : on ne lui superpose rien.
 *
 * Un PDF ne passe plus par ici : sa carte est un lien, et il s'ouvre dans le
 * lecteur du navigateur.
 */
function Lire({ doc, onClose }: { doc: DocPoche; onClose: () => void }): JSX.Element {
  return (
    <div className="m-lire">
      <div className="m-lire-tete">
        <span className="t">{doc.titre}</span>
        <button onClick={onClose}>fermer</button>
      </div>
      <div className="m-lire-corps">
        {/* `API` est vide en production — la page vient du même serveur — et
            nomme le poste du MJ en développement, où elle vient de Vite. Sans
            lui, l'aperçu partait chercher le fichier chez Vite, qui n'en a
            aucun : c'est ce qui cassait les vignettes. */}
        {doc.genre === 'video' ? (
          <video src={API + (doc.url ?? '')} controls playsInline />
        ) : (
          <ImagePincee src={API + (doc.url ?? '')} alt={doc.titre} />
        )}
      </div>
      <div className="m-lire-pied">
        {doc.sien ? 'Le maître du jeu ne l’a donné qu’à toi.' : 'Toute la table a ce document.'}
      </div>
    </div>
  )
}

/**
 * Une image qu'on pince pour l'agrandir, qu'on fait glisser une fois agrandie,
 * et qu'un double toucher agrandit ou remet d'aplomb.
 *
 * Le navigateur ne zoome pas pour nous : la page interdit le zoom
 * (`user-scalable=no`), sans quoi le pincement sur la carte du pion agrandirait
 * toute l'application. L'image fait donc son zoom elle-même.
 */
function ImagePincee({ src, alt }: { src: string; alt: string }): JSX.Element {
  const cadre = useRef<HTMLDivElement>(null)
  const [vue, setVue] = useState({ s: 1, x: 0, y: 0 })
  const doigts = useRef(new Map<number, { x: number; y: number }>())
  const depart = useRef<{
    vue: { s: number; x: number; y: number }
    milieu: { x: number; y: number }
    ecart: number
  } | null>(null)
  const dernierToucher = useRef<{ t: number; x: number; y: number } | null>(null)
  const bouge = useRef(false)

  /* Le contenu ne quitte jamais le cadre : agrandi, ses bords restent dehors. */
  const borner = (s: number, x: number, y: number): { s: number; x: number; y: number } => {
    const b = cadre.current?.getBoundingClientRect()
    const S = Math.min(6, Math.max(1, s))
    if (!b || S === 1) return { s: 1, x: 0, y: 0 }
    return {
      s: S,
      x: Math.min(0, Math.max(b.width - b.width * S, x)),
      y: Math.min(0, Math.max(b.height - b.height * S, y))
    }
  }

  const local = (e: React.PointerEvent): { x: number; y: number } => {
    const b = cadre.current!.getBoundingClientRect()
    return { x: e.clientX - b.left, y: e.clientY - b.top }
  }

  /* On repart de l'état présent à chaque doigt posé ou levé : passer de deux
     doigts à un ne fait pas sauter l'image. */
  const reprendre = (v: { s: number; x: number; y: number }): void => {
    const pts = [...doigts.current.values()]
    if (pts.length === 0) {
      depart.current = null
      return
    }
    const milieu =
      pts.length > 1
        ? { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }
        : pts[0]
    const ecart = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0
    depart.current = { vue: v, milieu, ecart }
  }

  return (
    <div
      ref={cadre}
      className="m-pince"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        doigts.current.set(e.pointerId, local(e))
        bouge.current = doigts.current.size > 1
        reprendre(vue)
      }}
      onPointerMove={(e) => {
        if (!doigts.current.has(e.pointerId) || !depart.current) return
        doigts.current.set(e.pointerId, local(e))
        const pts = [...doigts.current.values()]
        const d = depart.current
        if (pts.length > 1) {
          const milieu = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }
          const ecart = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
          const s = (d.vue.s * ecart) / Math.max(1, d.ecart)
          /* Le point de l'image qui était sous les doigts y reste. */
          const cx = (d.milieu.x - d.vue.x) / d.vue.s
          const cy = (d.milieu.y - d.vue.y) / d.vue.s
          setVue(borner(s, milieu.x - cx * s, milieu.y - cy * s))
          bouge.current = true
        } else {
          const dx = pts[0].x - d.milieu.x
          const dy = pts[0].y - d.milieu.y
          if (Math.hypot(dx, dy) > 8) bouge.current = true
          if (d.vue.s > 1) setVue(borner(d.vue.s, d.vue.x + dx, d.vue.y + dy))
        }
      }}
      onPointerUp={(e) => {
        const p = local(e)
        doigts.current.delete(e.pointerId)
        if (doigts.current.size === 0 && !bouge.current) {
          /* Deux touchers rapprochés : on agrandit là où l'on a touché, ou
             l'on revient à l'image entière. */
          const avant = dernierToucher.current
          const t = performance.now()
          if (avant && t - avant.t < 320 && Math.hypot(p.x - avant.x, p.y - avant.y) < 30) {
            dernierToucher.current = null
            const v =
              vue.s > 1
                ? borner(1, 0, 0)
                : borner(2.5, p.x - ((p.x - vue.x) / vue.s) * 2.5, p.y - ((p.y - vue.y) / vue.s) * 2.5)
            setVue(v)
            reprendre(v)
            return
          }
          dernierToucher.current = { t, x: p.x, y: p.y }
        }
        reprendre(vue)
      }}
      onPointerCancel={(e) => {
        doigts.current.delete(e.pointerId)
        reprendre(vue)
      }}
    >
      <div
        className="m-pince-contenu"
        style={{ transform: `translate(${vue.x}px, ${vue.y}px) scale(${vue.s})` }}
      >
        <img src={src} alt={alt} draggable={false} />
      </div>
    </div>
  )
}

function natureDite(genre: string): string {
  return { pdf: 'pdf', video: 'vidéo', audio: 'son', doc: 'texte' }[genre] ?? genre
}

/* ---------------- le jet ---------------- */

const bonusDe = (c: Carac): number => c.mod ?? modificateur(c.valeur)

/** Un jet envoyé, tel que le serveur l'a compté. */
interface JetFait {
  n: number
  carac: string
  de: number
  bonus: number
  total: number
  naturel: Naturel
}

/*
 * Ses derniers jets de la soirée. Hors du composant : changer d'onglet ne doit
 * pas les effacer, le joueur revient vérifier ce qu'il a annoncé. Une page
 * rechargée repart à vide — c'est le journal du MJ qui fait foi.
 */
let mesJets: JetFait[] = []

const NATUREL_DIT: Record<'critique' | 'maladresse', string> = {
  critique: '20 naturel',
  maladresse: '1 naturel'
}

function Jet({ etat, jeton }: { etat: Etat; jeton: string }): JSX.Element {
  const caracs = etat.perso?.caracs ?? []
  const [cle, setCle] = useState<string>(caracs[0]?.key ?? '')
  const [de, setDe] = useState<number | null>(null)
  const [envoi, setEnvoi] = useState<'non' | 'encours' | 'fait'>('non')
  const [erreur, setErreur] = useState<string | null>(null)
  const [faits, setFaits] = useState<JetFait[]>(mesJets)
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => void (minuteur.current && clearTimeout(minuteur.current)), [])
  useEffect(() => {
    if (caracs.length && !caracs.some((c) => c.key === cle)) setCle(caracs[0].key)
  }, [caracs, cle])

  const carac = caracs.find((c) => c.key === cle) ?? null
  const bonus = carac ? bonusDe(carac) : 0
  const nat = de === null ? null : naturel(de)

  /**
   * Envoyer vide la valeur du dé et laisse tout le reste en place : à la table
   * on enchaîne, et le plus souvent sur la même caractéristique. La
   * confirmation prend la place du bouton, le temps de se lire — mise
   * au-dessus, elle décalerait l'écran sous le pouce.
   */
  const envoyer = async (): Promise<void> => {
    if (!carac || de === null) return
    setEnvoi('encours')
    setErreur(null)
    const r = await fetch(`${API}/api/roll?t=${encodeURIComponent(jeton)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ caracKey: carac.key, de })
    })
    if (!r.ok) {
      setEnvoi('non')
      return setErreur((await r.json()).erreur)
    }
    /* Le compte du serveur fait foi ; un serveur plus ancien ne rend que le total. */
    const rep = (await r.json()) as Partial<JetFait> & { total: number }
    const fait: JetFait = {
      n: (mesJets[0]?.n ?? 0) + 1,
      carac: carac.code ?? abrege(carac.label),
      de: rep.de ?? de,
      bonus: rep.bonus ?? bonus,
      total: rep.total,
      naturel: rep.naturel ?? naturel(de)
    }
    mesJets = [fait, ...mesJets].slice(0, 8)
    setFaits(mesJets)
    setDe(null)
    setEnvoi('fait')
    if (minuteur.current) clearTimeout(minuteur.current)
    minuteur.current = setTimeout(() => setEnvoi('non'), 2600)
  }

  if (!etat.perso) {
    return (
      <div className="m-vue">
        <p className="m-note">Aucun personnage ne t’est attribué : rien à jeter pour l’instant.</p>
      </div>
    )
  }

  return (
    <div className="m-vue m-vue-jet">
      <section>
        <span className="m-eyebrow">Sur quelle caractéristique</span>
        <div className="m-surquoi">
          {caracs.map((c) => (
            <button
              key={c.key}
              className="m-sq"
              aria-pressed={c.key === cle}
              onClick={() => setCle(c.key)}
            >
              {c.code ?? abrege(c.label)} <b>{signe(bonusDe(c))}</b>
            </button>
          ))}
        </div>
      </section>

      <section>
        <span className="m-eyebrow">La valeur de ton dé</span>
        <div className="m-des" role="radiogroup" aria-label="Valeur du dé">
          {Array.from({ length: 20 }, (_, i) => i + 1).map((v) => (
            <button
              key={v}
              className="m-de"
              role="radio"
              aria-checked={v === de}
              onClick={() => setDe(v === de ? null : v)}
            >
              {v}
            </button>
          ))}
        </div>
      </section>

      <div className="m-somme">
        {de === null ? (
          <span className="m-pt">choisis la valeur annoncée</span>
        ) : (
          <>
            {de} {signe(bonus)} = <b>{de + bonus}</b>
            {nat ? <span className={`m-nat m-nat-${nat}`}>{NATUREL_DIT[nat]}</span> : null}
          </>
        )}
      </div>

      {erreur ? <p className="m-erreur">{erreur}</p> : null}

      {/* Le bouton et la confirmation occupent la même place : rien ne bouge
          sous le pouce entre l'envoi et le jet suivant. */}
      {envoi === 'fait' ? (
        <p className={`m-envoye${faits[0]?.naturel ? ` m-envoye-${faits[0].naturel}` : ''}`} role="status">
          {faits[0]
            ? `Envoyé : ${faits[0].carac} ${faits[0].de} ${signe(faits[0].bonus)} = ${faits[0].total}${
                faits[0].naturel ? ` · ${NATUREL_DIT[faits[0].naturel]}` : ''
              }`
            : 'Jet envoyé au maître du jeu.'}
        </p>
      ) : (
        <button
          className="m-btn m-btn-brass m-envoyer"
          disabled={de === null || envoi === 'encours'}
          onClick={() => void envoyer()}
        >
          {envoi === 'encours' ? 'Envoi…' : 'Envoyer au maître du jeu'}
        </button>
      )}

      {faits.length ? (
        <section className="m-mesjets">
          <span className="m-eyebrow">Mes jets</span>
          <ol>
            {faits.map((f) => (
              <li key={f.n} className={f.naturel ? `m-nat-${f.naturel}` : undefined}>
                <span>{f.carac}</span>
                <span className="m-mj-calc">
                  {f.de} {signe(f.bonus)}
                </span>
                <b>{f.total}</b>
                {f.naturel ? <em>{NATUREL_DIT[f.naturel]}</em> : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  )
}

/* ---------------- le pion ---------------- */

/**
 * Le pas le plus long qu'un pouce donne en une seconde, en part de la largeur
 * de la carte — celui d'usine : le MJ le règle plan par plan (`lieu.allure`). Une allure de marche, pas de course : on traverse une pièce en
 * quelques secondes, et le pouce a le temps de s'arrêter sur le seuil qu'il
 * visait. Plus vite, le pion glissait au-delà de la porte avant qu'on lâche.
 */
const ALLURE = 0.12

/**
 * Le quart de tour le plus rapide, en degrés par seconde. Le pion pivote vers
 * l'angle que l'anneau montre au lieu d'y sauter : une demi-rotation par
 * seconde, de quoi voir le cône de vue balayer la pièce et s'arrêter sur la
 * porte qu'on surveillait.
 */
const PIVOT = 180

/** Ramène un angle dans (-180, 180] : le cap ne s'enroule jamais. */
const tour = (a: number): number => ((((a + 180) % 360) + 360) % 360) - 180

/** Vingt pas par seconde au poste du MJ : son écran ne va pas plus vite. */
const CADENCE_MS = 50

/**
 * Le temps pendant lequel le pouce garde la main.
 *
 * Après un geste, l'état qui revient du poste raconte le pas d'avant : s'en
 * saisir ferait reculer le pion d'un message à chaque pas. On attend donc que
 * la main soit retombée pour redevenir d'accord avec la table.
 */
const MENE_MS = 550

/** Sa préférence à lui : son pion se tourne-t-il là où il marche ? */
const CLE_SUIVRE = 'ecran-du-maitre/suivre'

const litSuivre = (): boolean => {
  try {
    return localStorage.getItem(CLE_SUIVRE) === 'oui'
  } catch {
    return false
  }
}

function Plan({
  etat,
  jeton,
  ondes
}: {
  etat: Etat
  jeton: string
  ondes: MobilePing[]
}): JSX.Element {
  const [refus, setRefus] = useState<string | null>(null)
  const [calque, setCalque] = useState<CalqueBrouillard | null>(null)
  const [suivre, setSuivre] = useState(litSuivre)
  const cadre = useRef<HTMLDivElement>(null)
  /* La dernière tape : deux coups rapprochés au même endroit font un ping. */
  const tape = useRef<{ t: number; x: number; y: number }>({ t: 0, x: 0, y: 0 })

  const lieuId = etat.lieu?.id ?? null
  const mien = etat.pions.find((p) => p.mien) ?? null

  /*
   * La taille du plan — celle que le graveur a mesurée, sinon celle que
   * l'image avoue en arrivant. C'est le repère dans lequel les murs sont
   * écrits : sans elle, l'ombre tomberait à côté de la carte.
   */
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null)
  useEffect(() => {
    const l = etat.lieu
    setNat(l?.w && l?.h ? { w: l.w, h: l.h } : null)
  }, [lieuId, etat.lieu?.w, etat.lieu?.h])

  /*
   * Le calque d'ombre, relu quand on change de lieu ou qu'une porte s'ouvre.
   * Il ne voyage pas dans le flux : il pèse, et il ne change pas vingt fois
   * par seconde. C'est exactement ce que fait la fenêtre des joueurs.
   */
  useEffect(() => {
    if (lieuId == null || etat.gele) {
      setCalque(null)
      return
    }
    let vivant = true
    void fetch(`${API}/api/calque?t=${encodeURIComponent(jeton)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => {
        if (vivant) setCalque(c && c.placeId === lieuId ? c : null)
      })
      .catch(() => {
        /* Le poste ne répond pas : pas d'ombre, mais la carte reste. */
      })
    return () => {
      vivant = false
    }
  }, [lieuId, etat.calqueRev, etat.gele, jeton])

  /*
   * Où en est son pion, ici et maintenant.
   *
   * Le pouce ne peut pas attendre le réseau : on avance d'abord sur le
   * téléphone, on prévient le poste ensuite. C'est la seule façon d'avoir une
   * ombre qui colle au doigt sur le Wi-Fi de la maison.
   */
  const [pose, setPose] = useState({ x: 0.5, y: 0.5, cap: 0 })
  const poseRef = useRef(pose)
  const geste = useRef(0)
  const pousse = useRef({ x: 0, y: 0 })
  /* L'angle que l'anneau (ou la marche) réclame ; `null` quand on y est. */
  const capVise = useRef<number | null>(null)
  const aEnvoyer = useRef(false)
  const [pouce, setPouce] = useState({ x: 0, y: 0 })

  /* Ce que dit la table, quand la main est retombée. */
  useEffect(() => {
    if (!mien) return
    if (Date.now() - geste.current < MENE_MS) return
    const q = poseRef.current
    if (q.x === mien.x && q.y === mien.y && q.cap === mien.rotation) return
    poseRef.current = { x: mien.x, y: mien.y, cap: mien.rotation }
    setPose(poseRef.current)
  }, [mien?.id, mien?.x, mien?.y, mien?.rotation, !!mien])

  /** Les barrières du pas, dans le repère de la carte. */
  const barrieresPas = useMemo(() => {
    if (!calque?.murs.length || !nat) return null
    const enPx = (q: PointMur): Pt => ({ x: q[0] * nat.w, y: q[1] * nat.h })
    return barrieres(calque.murs, 'pas', enPx, calque.ouvertures)
  }, [calque, nat])

  /*
   * Les portes du lieu, dans le même repère. Dessinées **sous** l'ombre, elles
   * n'apparaissent que là où le personnage voit ; et quand le pas bute, c'est
   * ici qu'on cherche si c'est une porte qui le retient — sinon le joueur
   * sondait les murs à l'aveugle sans jamais savoir qu'il y avait un seuil.
   */
  const portes = useMemo(() => {
    if (!calque || !nat) return []
    const murs = new Map(calque.murs.map((m) => [m.id, m]))
    const out: { o: Ouverture; a: Pt; b: Pt }[] = []
    for (const o of calque.ouvertures) {
      const m = o.nature === 'porte' ? murs.get(o.murId) : undefined
      if (!m) continue
      const { a, b } = bordsOuverture(m, o)
      out.push({ o, a: { x: a[0] * nat.w, y: a[1] * nat.h }, b: { x: b[0] * nat.w, y: b[1] * nat.h } })
    }
    return out
  }, [calque, nat])

  /* Ce qui retient le pas, dit en clair. Posé à chaque image où l'on bute,
     mais l'état ne bouge que quand le texte change. */
  const [bute, setBute] = useState<string | null>(null)
  const buteRef = useRef<{ texte: string | null; t: number }>({ texte: null, t: 0 })

  const pousser = async (q: { x: number; y: number; cap: number }): Promise<void> => {
    const r = await fetch(`${API}/api/pion?t=${encodeURIComponent(jeton)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(q)
    })
    if (!r.ok) {
      const d = await r.json()
      setRefus(d.erreur === 'gele' ? 'L’écran est figé : ton pion ne bouge plus.' : d.erreur)
    } else setRefus(null)
  }

  /** L'allure du pouce sur ce plan, réglée par le MJ ; sinon celle d'usine. */
  const allure = etat.lieu?.allure ?? ALLURE

  /*
   * La marche : on avance tant qu'on pousse.
   *
   * Le pas se compte en pixels de la carte et non en fractions — une carte
   * n'est presque jamais carrée, et en fractions on marcherait plus vite en
   * hauteur qu'en largeur. Le mur retient ici comme il retient au poste : la
   * même géométrie des deux côtés, pour que le pion ne saute pas en arrière
   * quand la réponse arrive.
   */
  useEffect(() => {
    if (!mien || etat.gele) return
    let vivant = true
    let image = 0
    let avant = performance.now()
    let envoi = 0

    let affiche = poseRef.current

    const battre = (now: number): void => {
      if (!vivant) return
      image = requestAnimationFrame(battre)
      const dt = Math.min(0.06, (now - avant) / 1000)
      avant = now

      const p = pousse.current
      const force = Math.min(1, Math.hypot(p.x, p.y))
      if (force > 0.08) {
        const l = Math.hypot(p.x, p.y) || 1
        const pas = allure * force * dt
        const w = nat?.w ?? 1000
        const h = nat?.h ?? 1000
        const q = poseRef.current
        let vise = {
          x: Math.max(0.01, Math.min(0.99, q.x + (p.x / l) * pas)),
          y: Math.max(0.01, Math.min(0.99, q.y + (p.y / l) * pas * (w / h)))
        }
        if (barrieresPas) {
          const de = { x: q.x * w, y: q.y * h }
          const voulu = { x: vise.x * w, y: vise.y * h }
          const a = pasContraint(barrieresPas, de, voulu, { w, h }, 2)
          vise = { x: a.x / w, y: a.y / h }
          /* Moins de la moitié du pas : on bute. Une porte close droit devant ? */
          const fait = Math.hypot(a.x - de.x, a.y - de.y)
          const veut = Math.hypot(voulu.x - de.x, voulu.y - de.y)
          let texte: string | null = null
          if (veut > 0 && fait < veut / 2) {
            const sonde = {
              x: de.x + ((voulu.x - de.x) / veut) * w * 0.04,
              y: de.y + ((voulu.y - de.y) / veut) * w * 0.04
            }
            const porte = portes.find(
              (d) => !porteFranchissable(d.o) && seCroisent(de, sonde, d.a, d.b)
            )
            if (porte) {
              const nom = porte.o.nom?.trim() || 'Porte'
              texte = porte.o.verrouillee
                ? `${nom} verrouillée : il faut que le maître du jeu l’ouvre.`
                : `${nom} fermée : demande au maître du jeu de l’ouvrir.`
            }
          }
          const r = buteRef.current
          if (texte) r.t = now
          if (texte !== r.texte && (texte || now - r.t > 1800)) {
            r.texte = texte
            setBute(texte)
          }
        }
        if (suivre) capVise.current = (Math.atan2(p.x, -p.y) * 180) / Math.PI
        if (vise.x !== q.x || vise.y !== q.y) {
          poseRef.current = { x: vise.x, y: vise.y, cap: q.cap }
          geste.current = Date.now()
          aEnvoyer.current = true
        }
      } else if (buteRef.current.texte && now - buteRef.current.t > 1800) {
        /* Le pouce s'est levé : le mot reste le temps d'être lu, puis s'en va. */
        buteRef.current.texte = null
        setBute(null)
      }

      /*
       * Le pivot, après le pas et dans le même battement : on avance vers
       * l'angle visé du plus court côté, sans jamais dépasser PIVOT degrés par
       * seconde. Arrivé, on pose l'angle exact et on oublie la consigne — sans
       * quoi le pion se croirait toujours en train de tourner et la table
       * n'aurait plus jamais le droit de dire où il est.
       */
      const but = capVise.current
      if (but != null) {
        const q = poseRef.current
        const ecart = tour(but - q.cap)
        const marge = PIVOT * dt
        if (Math.abs(ecart) <= marge) {
          capVise.current = null
          if (q.cap !== but) {
            poseRef.current = { ...q, cap: but }
            geste.current = Date.now()
            aEnvoyer.current = true
          }
        } else {
          poseRef.current = { ...q, cap: tour(q.cap + Math.sign(ecart) * marge) }
          geste.current = Date.now()
          aEnvoyer.current = true
        }
      }

      /*
       * Le pas se compte à chaque image, mais on ne **redessine** que vingt
       * fois par seconde — et l'anneau passe par le même battement.
       *
       * Ce n'est pas une économie de confort : chaque affichage recalcule
       * l'ombre, c'est-à-dire un rayon vers chaque bout de mur puis le
       * balayage de la carte case par case. Soixante fois par seconde, un
       * téléphone y laisse la main ; vingt fois, c'est la cadence de l'écran
       * de la table, et l'œil n'y voit pas de différence.
       */
      if (now - envoi < CADENCE_MS) return
      envoi = now
      if (affiche !== poseRef.current) {
        affiche = poseRef.current
        setPose(affiche)
      }
      if (aEnvoyer.current) {
        aEnvoyer.current = false
        void pousser(poseRef.current)
      }
    }
    image = requestAnimationFrame(battre)
    return () => {
      vivant = false
      cancelAnimationFrame(image)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!mien, etat.gele, suivre, barrieresPas, portes, nat?.w, nat?.h, jeton, allure])

  /* ---- le pupitre : un disque qui fait marcher, un anneau qui fait tourner ---- */

  const prendreManche = (e: React.PointerEvent): void => {
    if (!mien || etat.gele) return
    e.preventDefault()
    e.stopPropagation()
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    const suivi = (ev: PointerEvent | React.PointerEvent): void => {
      const b = el.getBoundingClientRect()
      const r = b.width / 2
      const dx = ev.clientX - (b.left + r)
      const dy = ev.clientY - (b.top + r)
      const d = Math.hypot(dx, dy)
      /* Le pouce ne sort pas du disque, et le bord vaut la pleine allure. */
      const max = Math.max(1, r - 18)
      const k = d > max ? max / d : 1
      pousse.current = { x: (dx * k) / max, y: (dy * k) / max }
      setPouce({ x: dx * k, y: dy * k })
    }
    const lacher = (): void => {
      el.removeEventListener('pointermove', suivi as EventListener)
      el.removeEventListener('pointerup', lacher)
      el.removeEventListener('pointercancel', lacher)
      pousse.current = { x: 0, y: 0 }
      setPouce({ x: 0, y: 0 })
      /* Le dernier pas part toujours : on ne laisse pas la table sur un pion
         qui s'est arrêté ailleurs que là où il est. */
      aEnvoyer.current = true
    }
    el.addEventListener('pointermove', suivi as EventListener)
    el.addEventListener('pointerup', lacher)
    el.addEventListener('pointercancel', lacher)
    suivi(e)
  }

  const prendreAnneau = (e: React.PointerEvent): void => {
    if (!mien || etat.gele) return
    e.preventDefault()
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    const viser = (ev: PointerEvent | React.PointerEvent): void => {
      const b = el.getBoundingClientRect()
      const dx = ev.clientX - (b.left + b.width / 2)
      const dy = ev.clientY - (b.top + b.height / 2)
      if (Math.hypot(dx, dy) < 8) return
      /* Zéro vers le haut, comme la rotation d'un jeton en régie. Le doigt
         montre un cap ; c'est le battement qui l'y amène, à son allure. */
      capVise.current = (Math.atan2(dx, -dy) * 180) / Math.PI
    }
    const lacher = (): void => {
      el.removeEventListener('pointermove', viser as EventListener)
      el.removeEventListener('pointerup', lacher)
      el.removeEventListener('pointercancel', lacher)
      aEnvoyer.current = true
    }
    el.addEventListener('pointermove', viser as EventListener)
    el.addEventListener('pointerup', lacher)
    el.addEventListener('pointercancel', lacher)
    viser(e)
  }

  const reglerSuivre = (v: boolean): void => {
    setSuivre(v)
    try {
      localStorage.setItem(CLE_SUIVRE, v ? 'oui' : 'non')
    } catch {
      /* navigation privée : le réglage tiendra le temps de l'onglet */
    }
  }

  /**
   * Montrer un point du doigt. Deux tapes plutôt qu'une : une tape isolée est
   * trop facile à donner en posant le pouce sur l'écran, et l'onde partirait
   * pour rien au milieu d'une scène.
   */
  const montrer = async (x: number, y: number): Promise<void> => {
    const r = await fetch(`${API}/api/ping?t=${encodeURIComponent(jeton)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ x, y })
    })
    if (!r.ok) {
      const d = await r.json()
      setRefus(d.erreur === 'gele' ? 'L’écran est figé : rien ne part.' : d.erreur)
    } else setRefus(null)
  }

  const tapoter = (e: React.PointerEvent): void => {
    const b = cadre.current?.getBoundingClientRect()
    if (!b) return
    const x = (e.clientX - b.left) / b.width
    const y = (e.clientY - b.top) / b.height
    const now = Date.now()
    const t = tape.current
    /* Deux tapes en moins de 400 ms, à moins de 5 % l'une de l'autre. */
    if (now - t.t < 400 && Math.abs(x - t.x) < 0.05 && Math.abs(y - t.y) < 0.05) {
      tape.current = { t: 0, x: 0, y: 0 }
      void montrer(x, y)
      return
    }
    tape.current = { t: now, x, y }
  }

  /*
   * Les yeux de la table : un pion de personnage, et lui seul. Le sien regarde
   * depuis là où son pouce l'a mis, pas depuis le dernier message reçu —
   * sinon l'ombre traînerait d'un demi-pas derrière lui.
   *
   * On les mémorise : c'est cette liste qui déclenche le calcul de l'ombre, et
   * une nouvelle à chaque dessin la ferait recalculer pour un pouce qui remue
   * dans son disque.
   */
  const yeux = useMemo(
    () =>
      etat.pions
        .filter((p) => p.characterId != null && !p.pnj)
        .map((p) =>
          p.mien
            ? { x: pose.x, y: pose.y, cap: pose.cap, characterId: p.characterId as number }
            : { x: p.x, y: p.y, cap: p.rotation, characterId: p.characterId as number }
        ),
    [etat.pions, pose.x, pose.y, pose.cap]
  )
  /* Les pions « au regard » hors de tout champ de vision : on ne les dessine
     pas, comme sur l'écran de la table. Sans calque, on ne peut pas savoir —
     on les tait plutôt que de les trahir. */
  const horsDeVue = useMemo(() => {
    const auRegard = etat.pions.filter((p) => p.regard)
    if (!auRegard.length || etat.jour) return new Set<number>()
    if (!calque || !nat) return new Set(auRegard.map((p) => p.id))
    const regards = regardsDes(calque, yeux, nat.w, nat.h)
    return new Set(
      auRegard.filter((p) => !sousUnRegard(regards, p.x * nat.w, p.y * nat.h)).map((p) => p.id)
    )
  }, [etat.pions, etat.jour, calque, nat, yeux])

  if (etat.gele || !etat.lieu) {
    return (
      <div className="m-vue">
        <p className="m-note">
          {etat.gele
            ? 'L’écran est figé par le maître du jeu. Ton pion reprendra sa liberté quand il le dégèlera.'
            : 'Aucun lieu n’est à l’écran pour l’instant.'}
        </p>
      </div>
    )
  }

  return (
    <div className="m-vue m-vue-pion">
      <section>
        <span className="m-eyebrow">Lieu courant</span>
        <div className="m-lieu-nom">{etat.lieu.nom}</div>
      </section>

      <div
        className="m-plan"
        ref={cadre}
        onPointerDown={tapoter}
        style={{
          aspectRatio: nat ? `${nat.w} / ${nat.h}` : '16 / 10',
          ['--ratio' as string]: nat ? nat.w / nat.h : 1.6
        }}
      >
        {/* La carte se lit maintenant au lieu de s'effacer : l'ombre ne laisse
            voir que ce que son personnage voit, alors il peut la regarder. */}
        {etat.lieu.plan ? (
          <img
            className="m-plan-fond"
            src={API + etat.lieu.plan}
            alt=""
            draggable={false}
            onLoad={(e) => {
              const im = e.currentTarget
              if (!nat && im.naturalWidth && im.naturalHeight) {
                setNat({ w: im.naturalWidth, h: im.naturalHeight })
              }
            }}
          />
        ) : null}
        {portes.length && nat ? (
          <svg
            className="m-portes"
            viewBox={`0 0 ${nat.w} ${nat.h}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {portes.map(({ o, a, b }) => {
              /* Le viewBox est en pixels de la carte : le trait se règle sur elle. */
              const trait = Math.max(nat.w, nat.h) * 0.007
              const ouverte = porteFranchissable(o)
              return (
                <line
                  key={o.id}
                  className={ouverte ? 'ouverte' : o.verrouillee ? 'verrou' : 'fermee'}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  strokeWidth={trait}
                  strokeDasharray={ouverte ? `${trait} ${trait * 1.6}` : undefined}
                />
              )
            })}
          </svg>
        ) : null}
        {calque?.murs.length && nat && !etat.jour ? (
          <div className="m-ombre">
            <Brouillard calque={calque} yeux={yeux} w={nat.w} h={nat.h} />
          </div>
        ) : null}
        <Pings pings={ondes} />
        {bute ? (
          <p className="m-bute" role="status">
            {bute}
          </p>
        ) : null}
        {etat.pions.filter((p) => !horsDeVue.has(p.id)).map((p) => {
          const q = p.mien ? pose : { x: p.x, y: p.y, cap: p.rotation }
          return (
            <div
              key={p.id}
              className={`m-pion c-${p.color}${p.mien ? ' m-mien' : ''}${
                p.etat ? ` ${p.etat}` : ''
              }${p.id === etat.pionEnJeuId ? ' m-en-jeu' : ''}`}
              style={{
                left: `${q.x * 100}%`,
                top: `${q.y * 100}%`,
                ['--cap' as string]: `${q.cap}deg`
              }}
              title={p.etat ? `${p.label} — ${p.etat === 'ko' ? 'inconscient' : 'blessé'}` : p.label}
            >
              {p.url ? <Visage url={API + p.url} cadre={p.cadre} /> : p.initials}
              {/* Le nez dit de quel côté il regarde. Le sien le porte toujours,
                  les autres seulement quand ils sont tournés — comme à la table. */}
              {p.characterId != null && (p.mien || q.cap) ? <span className="m-nez" /> : null}
            </div>
          )
        })}
      </div>

      {refus ? <p className="m-erreur">{refus}</p> : null}

      {mien ? (
        <>
          <div className="m-pupitre">
            <div
              className="m-anneau"
              style={{ ['--cap' as string]: `${pose.cap}deg` }}
              role="slider"
              tabIndex={0}
              aria-label="Le côté où ton personnage regarde"
              aria-valuemin={0}
              aria-valuemax={359}
              aria-valuenow={Math.round(((pose.cap % 360) + 360) % 360)}
              onPointerDown={prendreAnneau}
              onKeyDown={(e) => {
                const pas = e.shiftKey ? 5 : 15
                if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
                e.preventDefault()
                poseRef.current = {
                  ...poseRef.current,
                  cap: poseRef.current.cap + (e.key === 'ArrowLeft' ? -pas : pas)
                }
                geste.current = Date.now()
                aEnvoyer.current = true
              }}
            >
              <span className="m-rose m-rose-n" aria-hidden="true">
                N
              </span>
              <span className="m-rose m-rose-s" aria-hidden="true">
                S
              </span>
              <span className="m-cran" aria-hidden="true" />
              <div className="m-manche" onPointerDown={prendreManche}>
                <span
                  className={`m-pouce${pousse.current.x || pousse.current.y ? ' m-pris' : ''}`}
                  style={{
                    ['--dx' as string]: `${pouce.x}px`,
                    ['--dy' as string]: `${pouce.y}px`
                  }}
                  aria-hidden="true"
                >
                  ✥
                </span>
              </div>
            </div>
          </div>

          <p className="m-note">
            Pousse le disque pour marcher, tire l’anneau pour te tourner. Deux tapes sur le
            plan montrent un point à la table.
          </p>

          <label className="m-coche">
            <input
              type="checkbox"
              checked={suivre}
              onChange={(e) => reglerSuivre(e.target.checked)}
            />
            <span>Se tourner en marchant</span>
          </label>
        </>
      ) : (
        <p className="m-note">
          Tapote deux fois pour montrer un point. Ton pion, lui, n’est pas sur ce lieu.
        </p>
      )}
    </div>
  )
}

/* ---------------- l'icône de l'application ---------------- */

/**
 * L'écran du maître lui-même : trois volets pliés, vus de biais.
 *
 * Elle remplace le nom écrit en toutes lettres — sur un téléphone, une image
 * se reconnaît d'un coup d'œil là où un titre se lit, et le joueur n'ouvre pas
 * cette page pour savoir comment elle s'appelle. Le nom reste, pour qui écoute
 * la page plutôt que de la regarder.
 */
function IconeApp({ taille = 76 }: { taille?: number }): JSX.Element {
  return (
    <svg
      width={taille}
      height={taille}
      viewBox="0 0 512 512"
      role="img"
      aria-label="Écran du Maître"
    >
      <defs>
        <linearGradient id="ic-encre" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="512">
          <stop offset="0" stopColor="#182126" />
          <stop offset="1" stopColor="#0a1013" />
        </linearGradient>
        <linearGradient
          id="ic-laiton"
          gradientUnits="userSpaceOnUse"
          x1="88"
          y1="154"
          x2="232"
          y2="380"
        >
          <stop offset="0" stopColor="#f0d193" />
          <stop offset="1" stopColor="#c2913a" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="96" fill="url(#ic-encre)" />
      <path d="M88 142 L232 174 L232 186 L88 154 Z" fill="#f4dcae" />
      <path d="M88 154 L232 186 L232 380 L88 322 Z" fill="url(#ic-laiton)" />
      <path d="M232 174 L348 146 L348 158 L232 186 Z" fill="#a8813a" />
      <path d="M232 186 L348 158 L348 328 L232 380 Z" fill="#6d5220" />
      <path d="M348 146 L424 164 L424 176 L348 158 Z" fill="#e0c07a" />
      <path d="M348 158 L424 176 L424 360 L348 328 Z" fill="#a8813a" />
      <path d="M105 209 L215 239 L215 249 L105 218 Z" fill="#8a6a2a" opacity="0.85" />
      <path d="M105 235 L215 268 L215 278 L105 243 Z" fill="#8a6a2a" opacity="0.85" />
      <path d="M105 260 L215 297 L215 306 L105 269 Z" fill="#8a6a2a" opacity="0.85" />
    </svg>
  )
}

/* ---------------- utilitaires ---------------- */

const teinte = (c: string | null): React.CSSProperties =>
  ({
    ['--pion-ring' as string]: `var(--${c ?? 'neutral'})`,
    ['--pion-fill' as string]: `var(--${c ?? 'neutral'}-wash)`
  }) as React.CSSProperties

function initiales(nom: string): string {
  return nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0]?.toUpperCase() ?? '')
    .join('')
}

/** Un nom en clair se réduit à trois lettres quand la fiche n'a pas d'abrégé. */
const abrege = (label: string): string => label.slice(0, 3).toUpperCase()
