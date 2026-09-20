import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PION_COULEURS } from '@shared/types'
import { Pings, usePings } from '../shared/Pings'
import { Brouillard } from '../shared/Brouillard'
import { barrieres, pasContraint, type Pt } from '@shared/murs'
import type { CalqueBrouillard, MobilePing, PointMur } from '@shared/types'

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

/**
 * Où joindre le poste du maître du jeu.
 *
 * En production la page vient de ce serveur, et tout est relatif. En
 * développement elle vient de Vite, sur un autre port : il faut alors nommer
 * le port du serveur, sans quoi les appels partiraient chez Vite, qui n'a
 * aucune campagne à offrir.
 */
const PORT = '7777'
const API = location.port === PORT ? '' : `${location.protocol}//${location.hostname}:${PORT}`

interface Jauge { key: string; label: string; color: string; value: number; max: number }
interface Carac { key: string; label: string; code: string | null; valeur: number }
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
  url: string | null
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
}

interface Etat {
  campagne: string | null
  joueur: { id: number; nom: string; couleur: string | null } | null
  perso: {
    id: number
    nom: string
    occupation: string | null
    age: string | null
    portrait: string | null
    jauges: Jauge[]
    caracs: Carac[]
    comps: Comp[]
  } | null
  /** Ce qu'on lui a mis en main. Jamais ce qu'un autre a reçu. */
  pochette: { onglets: { id: number; nom: string }[]; docs: DocPoche[] }
  /** Ses affaires à lui, et les endroits du corps où les mettre. */
  objets: ObjetTel[]
  emplacements: { cle: string; nom: string }[]
  gele: boolean
  /** Le lieu à l'écran, et la taille de son plan : le repère des murs. */
  lieu: { id: number; nom: string; plan: string | null; w: number | null; h: number | null } | null
  pions: PionVu[]
  /** Il avance dès qu'une porte ou une lampe bouge : c'est le signal de relire le calque. */
  calqueRev: number
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
  const [convives, setConvives] = useState<Convive[] | null>(null)
  const [ferme, setFerme] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [onglet, setOnglet] = useState<Onglet>('fiche')
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

  if (etat) {
    return (
      <Table
        etat={etat}
        jeton={jeton!}
        ondes={ondes.pings}
        onglet={onglet}
        setOnglet={setOnglet}
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
  onOublier
}: {
  etat: Etat
  jeton: string
  ondes: MobilePing[]
  onglet: Onglet
  setOnglet: (o: Onglet) => void
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
          </button>
        ))}
      </nav>
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
            <img src={API + p.portrait} alt="" draggable={false} />
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
              <span>{c.code ?? abrege(c.label)}</span>
            </div>
          ))}
        </div>
      </section>

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

      <section>
        <span className="m-eyebrow">Ma couleur</span>
        <div className="m-teintes">
          {PION_COULEURS.map((c) => (
            <button
              key={c.key}
              className="m-tt"
              style={{ ['--p' as string]: c.hex }}
              aria-pressed={etat.joueur?.couleur === c.key}
              aria-label={c.name}
              title={c.name}
              onClick={() => void changerCouleur(c.key)}
            />
          ))}
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

  if (!etat.perso) {
    return (
      <div className="m-vue">
        <p className="m-note">Aucun personnage ne t’est attribué : rien à porter pour l’instant.</p>
      </div>
    )
  }

  const ligne = (o: ObjetTel): JSX.Element => (
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

      {objets.length === 0 ? (
        <p className="m-note">
          Le maître du jeu ne t’a rien donné. Ce qu’il te tendra apparaîtra ici tout seul.
        </p>
      ) : null}

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
                <span className="h">{d.donneA.slice(11, 16)}</span>
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
          <img src={API + (doc.url ?? '')} alt={doc.titre} draggable={false} />
        )}
      </div>
      <div className="m-lire-pied">
        {doc.sien ? 'Le maître du jeu ne l’a donné qu’à toi.' : 'Toute la table a ce document.'}
      </div>
    </div>
  )
}

function natureDite(genre: string): string {
  return { pdf: 'pdf', video: 'vidéo', audio: 'son', doc: 'texte' }[genre] ?? genre
}

/* ---------------- le jet ---------------- */

function Jet({ etat, jeton }: { etat: Etat; jeton: string }): JSX.Element {
  const caracs = etat.perso?.caracs ?? []
  const [cle, setCle] = useState<string>(caracs[0]?.key ?? '')
  const [de, setDe] = useState<number | null>(null)
  const [envoi, setEnvoi] = useState<'non' | 'encours' | 'fait'>('non')
  const [erreur, setErreur] = useState<string | null>(null)
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => void (minuteur.current && clearTimeout(minuteur.current)), [])
  useEffect(() => {
    if (caracs.length && !caracs.some((c) => c.key === cle)) setCle(caracs[0].key)
  }, [caracs, cle])

  const carac = caracs.find((c) => c.key === cle) ?? null
  const bonus = carac?.valeur ?? 0

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
              {c.code ?? abrege(c.label)} <b>{c.valeur}</b>
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
            {de} + {bonus} = <b>{de + bonus}</b>
          </>
        )}
      </div>

      {erreur ? <p className="m-erreur">{erreur}</p> : null}

      {/* Le bouton et la confirmation occupent la même place : rien ne bouge
          sous le pouce entre l'envoi et le jet suivant. */}
      {envoi === 'fait' ? (
        <p className="m-envoye" role="status">
          Jet envoyé au maître du jeu.
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
    </div>
  )
}

/* ---------------- le pion ---------------- */

/**
 * Le pas le plus long qu'un pouce donne en une seconde, en part de la largeur
 * de la carte. Une allure de marche, pas de course : on traverse une pièce en
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
        const pas = ALLURE * force * dt
        const w = nat?.w ?? 1000
        const h = nat?.h ?? 1000
        const q = poseRef.current
        let vise = {
          x: Math.max(0.01, Math.min(0.99, q.x + (p.x / l) * pas)),
          y: Math.max(0.01, Math.min(0.99, q.y + (p.y / l) * pas * (w / h)))
        }
        if (barrieresPas) {
          const a = pasContraint(
            barrieresPas,
            { x: q.x * w, y: q.y * h },
            { x: vise.x * w, y: vise.y * h },
            { w, h },
            2
          )
          vise = { x: a.x / w, y: a.y / h }
        }
        if (suivre) capVise.current = (Math.atan2(p.x, -p.y) * 180) / Math.PI
        if (vise.x !== q.x || vise.y !== q.y) {
          poseRef.current = { x: vise.x, y: vise.y, cap: q.cap }
          geste.current = Date.now()
          aEnvoyer.current = true
        }
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
  }, [!!mien, etat.gele, suivre, barrieresPas, nat?.w, nat?.h, jeton])

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
        .filter((p) => p.characterId != null)
        .map((p) =>
          p.mien
            ? { x: pose.x, y: pose.y, cap: pose.cap, characterId: p.characterId as number }
            : { x: p.x, y: p.y, cap: p.rotation, characterId: p.characterId as number }
        ),
    [etat.pions, pose.x, pose.y, pose.cap]
  )

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
        {calque?.murs.length && nat ? (
          <div className="m-ombre">
            <Brouillard calque={calque} yeux={yeux} w={nat.w} h={nat.h} />
          </div>
        ) : null}
        <Pings pings={ondes} />
        {etat.pions.map((p) => {
          const q = p.mien ? pose : { x: p.x, y: p.y, cap: p.rotation }
          return (
            <div
              key={p.id}
              className={`m-pion c-${p.color}${p.mien ? ' m-mien' : ''}${
                p.etat ? ` ${p.etat}` : ''
              }`}
              style={{
                left: `${q.x * 100}%`,
                top: `${q.y * 100}%`,
                ['--cap' as string]: `${q.cap}deg`
              }}
              title={p.etat ? `${p.label} — ${p.etat === 'ko' ? 'inconscient' : 'blessé'}` : p.label}
            >
              {p.url ? <img src={API + p.url} alt="" draggable={false} /> : p.initials}
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
