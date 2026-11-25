/**
 * Azeroth — la table de World of Warcraft, vue du MJ.
 *
 * Les joueurs jouent dans l'**Aventure** (l'écran du joueur du jeu WoW), sur
 * leur tablette, leur téléphone ou leur PC. Ce module en est le pendant pour
 * le MJ :
 *
 *  — le **serveur du jeu** : le lancer, et donner à chaque joueur l'adresse
 *    de sa fiche (`?joueur=<prénom>`), en QR code ;
 *  — **la table** : chaque personnage, ses PV, sa ressource, ses
 *    améliorations et affaiblissements, en direct ;
 *  — **la console** : demander un jet (1D20 contre 1, 5, 10, 15 ou 20, plus
 *    les facteurs), infliger des dégâts, soigner, poser un affaiblissement,
 *    écrire, passer au tour suivant — sur un joueur ou tout le groupe ;
 *  — **le journal** : ce que les fiches ont lancé, sans regarder les écrans.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import {
  DDS,
  idJoueur,
  jugerJet,
  type EnvoiWow,
  type JetWow,
  type JoueurWow,
  type QuetePreparee,
  type ServeurWow
} from '@shared/wow'

/** Les couleurs de classe de WoW, pour reconnaître un personnage d'un coup d'œil. */
const COULEUR_CLASSE: Record<string, string> = {
  guerrier: '#C69B6D',
  paladin: '#F48CBA',
  chasseur: '#AAD372',
  voleur: '#FFF468',
  pretre: '#F0EBE0',
  chaman: '#0070DD',
  mage: '#3FC7EB',
  demoniste: '#8788EE',
  druide: '#FF7C0A'
}

const NOM_CLASSE: Record<string, string> = {
  guerrier: 'Guerrier',
  paladin: 'Paladin',
  chasseur: 'Chasseur',
  voleur: 'Voleur',
  pretre: 'Prêtre',
  chaman: 'Chaman',
  mage: 'Mage',
  demoniste: 'Démoniste',
  druide: 'Druide'
}

const ECOLES = ['Feu', 'Givre', 'Arcane', 'Nature', 'Ombre', 'Sacré']

/** Les affaiblissements qu'un MJ pose le plus souvent, d'un clic. */
const ETATS_RAPIDES: { nom: string; tours: number; mal: boolean; desc: string }[] = [
  { nom: 'Étourdi', tours: 1, mal: true, desc: 'Ne peut pas agir.' },
  { nom: 'Empoisonné', tours: 3, mal: true, desc: 'Le poison ronge les forces.' },
  { nom: 'Apeuré', tours: 2, mal: true, desc: 'Fuit, ne peut pas attaquer.' },
  { nom: 'Ralenti', tours: 2, mal: true, desc: 'Vitesse de déplacement réduite.' },
  { nom: 'Saignement', tours: 3, mal: true, desc: 'Perd du sang à chaque tour.' },
  { nom: 'Immobilisé', tours: 1, mal: true, desc: 'Ne peut pas se déplacer.' },
  { nom: 'Béni', tours: 3, mal: false, desc: 'Une faveur du MJ.' }
]

export function Azeroth(): JSX.Element {
  const s = useStore()
  const [serveur, setServeur] = useState<ServeurWow | null>(null)
  const [joueurs, setJoueurs] = useState<JoueurWow[]>([])
  const [lancement, setLancement] = useState(false)
  /** Les joueurs visés par la console ; vide, toute la table en ligne. */
  const [cibles, setCibles] = useState<string[]>([])
  const [invite, setInvite] = useState<{ id: string; nom: string } | null>(null)

  const relireServeur = useCallback(async () => setServeur(await window.jdr.wow.etat()), [])
  const relireTable = useCallback(async () => setJoueurs(await window.jdr.wow.table()), [])

  useEffect(() => {
    void relireServeur()
    void relireTable()
    const t1 = window.setInterval(() => void relireTable(), 2000)
    const t2 = window.setInterval(() => void relireServeur(), 10000)
    return () => {
      window.clearInterval(t1)
      window.clearInterval(t2)
    }
  }, [relireServeur, relireTable])

  const lancer = async (): Promise<void> => {
    setLancement(true)
    try {
      const e = await window.jdr.wow.demarrer()
      setServeur(e)
      if (e.lance) s.toast('Le jeu est lancé : les joueurs peuvent ouvrir l’Aventure.')
      else if (e.probleme) s.toast(e.probleme, true)
      void relireTable()
    } finally {
      setLancement(false)
    }
  }

  /* À l'arrivée sur le module, on lance le jeu s'il ne tourne pas : c'est
     pour ça qu'on vient. Une seule fois, et seulement si le dossier est bon. */
  const [tente, setTente] = useState(false)
  useEffect(() => {
    if (tente || !serveur) return
    setTente(true)
    if (!serveur.lance && !serveur.probleme) void lancer()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serveur, tente])

  const enLigne = joueurs.filter((j) => j.enLigne)
  /* Les cibles parties entre-temps ne comptent plus. */
  const ciblesValides = cibles.filter((id) => joueurs.some((j) => j.id === id))
  const visees = ciblesValides.length ? ciblesValides : enLigne.map((j) => j.id)
  const nomDe = (id: string): string => joueurs.find((j) => j.id === id)?.nom ?? id

  const envoyer = async (quoi: EnvoiWow, recit: string): Promise<void> => {
    if (!visees.length) {
      s.toast('Aucun joueur en ligne : personne ne recevrait ça.', true)
      return
    }
    const ok = await window.jdr.wow.envoyer(visees, quoi)
    if (!ok) s.toast('Le serveur du jeu ne répond pas.', true)
    else s.toast(`${recit} → ${visees.map(nomDe).join(', ')}`)
  }

  const basculerCible = (id: string): void =>
    setCibles((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))

  /* Les prénoms des joueurs que l'écran connaît déjà : de quoi inviter vite. */
  const suggestions = useMemo(() => {
    const connus = new Set(joueurs.map((j) => j.id))
    const noms = s.characters
      .filter((c) => c.kind === 'pj' && !c.horsJeu)
      .map((c) => (c.player || c.name || '').trim())
      .filter(Boolean)
    return [...new Set(noms)].filter((n) => !connus.has(idJoueur(n)))
  }, [s.characters, joueurs])

  return (
    <div className="view azeroth">
      <div className="vhead">
        <div>
          <h2>Azeroth</h2>
          <p>
            Les règles de World of Warcraft : 1D20 contre le score demandé (1, 5, 10, 15 ou 20) et ses facteurs.
            Les joueurs jouent dans l’Aventure ; tu tiens la table d’ici.
          </p>
        </div>
        <div className="spacer" />
        <Serveur serveur={serveur} lancement={lancement} onLancer={() => void lancer()} onRelire={() => void relireServeur()} />
      </div>

      <div className="az-corps">
        <section className="az-table" aria-label="La table">
          <div className="az-titre">
            <span className="eyebrow">La table</span>
            <span className="az-compte">
              {enLigne.length} en ligne · {joueurs.length} fiche{joueurs.length > 1 ? 's' : ''}
            </span>
            <div className="spacer" />
            <Inviter
              suggestions={suggestions}
              onInviter={(nom) => setInvite({ id: idJoueur(nom), nom })}
              desactive={!serveur?.lance}
            />
          </div>
          {joueurs.length ? (
            <div className="az-joueurs">
              {joueurs.map((j) => (
                <CarteJoueur
                  key={j.id}
                  j={j}
                  vise={ciblesValides.includes(j.id)}
                  onViser={() => basculerCible(j.id)}
                  onLien={() => setInvite({ id: j.id, nom: j.etat?.joueur || j.id.charAt(0).toUpperCase() + j.id.slice(1) })}
                />
              ))}
            </div>
          ) : (
            <div className="empty">
              <b>Personne à la table pour l’instant.</b>
              {serveur?.lance
                ? 'Invite un joueur : il ouvre l’adresse (ou le QR code) sur sa tablette, choisit sa race et sa classe, et apparaît ici.'
                : 'Lance le jeu, puis invite les joueurs.'}
            </div>
          )}
          <Journal joueurs={joueurs} />
        </section>

        <aside className="az-console" aria-label="Console du MJ">
          <div className="az-titre">
            <span className="eyebrow">Console du MJ</span>
          </div>
          <div className="az-visees">
            <span>Pour :</span>
            {ciblesValides.length ? (
              <>
                {ciblesValides.map((id) => (
                  <button key={id} className="az-puce on" onClick={() => basculerCible(id)} title="Retirer">
                    {nomDe(id)} ×
                  </button>
                ))}
                <button className="az-puce" onClick={() => setCibles([])}>
                  Tout le groupe
                </button>
              </>
            ) : (
              <span className="az-groupe">
                tout le groupe en ligne{enLigne.length ? ` (${enLigne.length})` : ' — personne'}
              </span>
            )}
          </div>
          <p className="aide az-astuce">Clique sur une fiche pour viser ce joueur seulement.</p>

          <DemanderJet onEnvoyer={envoyer} />
          <Quetes onEnvoyer={envoyer} />
          <Degats onEnvoyer={envoyer} />
          <Etats onEnvoyer={envoyer} />
          <Message onEnvoyer={envoyer} />
          <div className="az-bloc">
            <div className="az-ligne">
              <button
                className="btn"
                onClick={() => void envoyer({ t: 'combat', etat: 'debut' }, 'Début du combat')}
                title="Les fiches visées entrent en combat"
              >
                ⚔ Début du combat
              </button>
              <button
                className="btn"
                onClick={() => void envoyer({ t: 'tour' }, 'Tour suivant')}
                title="Chaque fiche visée passe au tour suivant : régénération, durées, incantations"
              >
                ⏳ Tour suivant
              </button>
              <button
                className="btn"
                onClick={() => void envoyer({ t: 'combat', etat: 'fin' }, 'Fin du combat')}
                title="Le combat est terminé : les capacités « une fois par combat » reviennent"
              >
                🏳 Fin du combat
              </button>
            </div>
          </div>
          <JetDuMj />
        </aside>
      </div>

      {invite && serveur ? <Invitation serveur={serveur} invite={invite} onClose={() => setInvite(null)} /> : null}
    </div>
  )
}

/* ---------------- le serveur du jeu ---------------- */

function Serveur({
  serveur,
  lancement,
  onLancer,
  onRelire
}: {
  serveur: ServeurWow | null
  lancement: boolean
  onLancer: () => void
  onRelire: () => void
}): JSX.Element {
  const s = useStore()
  if (!serveur) return <span className="az-etat">…</span>
  const choisir = async (): Promise<void> => {
    const r = await window.jdr.wow.choisirDossier()
    if (r.message) s.toast(r.message, true)
    if (r.ok) {
      await s.refreshReglages()
      onRelire()
    }
  }
  return (
    <div className="az-serveur">
      <span className={`az-etat${serveur.lance ? ' on' : ''}`}>
        <i aria-hidden="true" />
        {serveur.lance ? `Jeu lancé · port ${serveur.port}` : 'Jeu arrêté'}
      </span>
      {serveur.lance ? (
        <>
          <button
            className="btn btn-sm"
            onClick={() => s.setView('wow-jeu')}
            title="Édition des arbres, Jeu, Grimoire, Métiers et objets, Aventure du MJ"
          >
            Talents et Aventure
          </button>
          <button className="btn btn-sm" onClick={() => s.setView('wow-cartes')} title="L’éditeur de cartes d’Azeroth">
            Cartes
          </button>
        </>
      ) : (
        <button className="btn btn-sm btn-brass" disabled={lancement} onClick={onLancer}>
          {lancement ? 'Lancement…' : 'Lancer le jeu'}
        </button>
      )}
      <button
        className="btn btn-sm btn-ghost"
        onClick={() => void window.jdr.wow.ouvrirDonnees()}
        title={`Les sauvegardes et les images du jeu : ${serveur.dossier ?? ''}`}
      >
        Données
      </button>
      <button className="btn btn-sm btn-ghost" onClick={() => void choisir()} title="Changer de dossier de données">
        …
      </button>
      <Simulateur />
      {serveur.ancien ? (
        <span className="az-alerte">
          L’ancien lanceur (Lancer-le-jeu.cmd) tourne encore à côté : ferme sa fenêtre noire. Les joueurs
          passent maintenant par l’adresse de l’Écran (port {serveur.port}).
        </span>
      ) : null}
      {serveur.probleme ? <span className="az-alerte">{serveur.probleme}</span> : null}
    </div>
  )
}

/* ---------------- le simulateur ---------------- */

/** Refabriquer (et publier) le site où les joueurs découvrent races et classes. */
function Simulateur(): JSX.Element {
  const [ouvert, setOuvert] = useState(false)
  const [occupe, setOccupe] = useState(false)
  const [compte, setCompte] = useState<{ ok: boolean; texte: string } | null>(null)
  const faire = async (publier: boolean): Promise<void> => {
    setOccupe(true)
    setCompte(null)
    try {
      setCompte(await window.jdr.wow.simulateur(publier))
    } finally {
      setOccupe(false)
    }
  }
  return (
    <>
      <button
        className="btn btn-sm btn-ghost"
        onClick={() => setOuvert(true)}
        title="Le site des joueurs (GitHub Pages) : races, classes, arbres et grimoires"
      >
        Simulateur
      </button>
      {ouvert ? (
        <div className="scrim par-dessus" onClick={() => !occupe && setOuvert(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <h3>Le simulateur des joueurs</h3>
            </header>
            <div className="body">
              <p className="aide">
                Le site où les joueurs découvrent les races et les classes avant de créer leur personnage. Il
                reprend les arbres, les sorts et la création tels qu’ils sont maintenant : refais-le après des
                retouches. « Publier » l’envoie en ligne (GitHub).
              </p>
              {occupe ? <p>Fabrication…</p> : null}
              {compte ? (
                <pre className={`az-compte-rendu${compte.ok ? '' : ' ko'}`}>{compte.texte}</pre>
              ) : null}
            </div>
            <footer>
              <button className="btn btn-sm" disabled={occupe} onClick={() => setOuvert(false)}>
                Fermer
              </button>
              <button className="btn btn-sm" disabled={occupe} onClick={() => void faire(false)}>
                Fabriquer seulement
              </button>
              <button className="btn btn-sm btn-brass" disabled={occupe} onClick={() => void faire(true)}>
                Fabriquer et publier
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  )
}

/* ---------------- inviter un joueur ---------------- */

function Inviter({
  suggestions,
  onInviter,
  desactive
}: {
  suggestions: string[]
  onInviter: (nom: string) => void
  desactive: boolean
}): JSX.Element {
  const [nom, setNom] = useState('')
  const valider = (): void => {
    const n = nom.trim()
    if (!n || !idJoueur(n)) return
    onInviter(n)
    setNom('')
  }
  return (
    <div className="az-inviter">
      <input
        type="text"
        placeholder="Prénom du joueur"
        value={nom}
        list="az-suggestions"
        disabled={desactive}
        onChange={(e) => setNom(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && valider()}
        aria-label="Prénom du joueur à inviter"
      />
      <datalist id="az-suggestions">
        {suggestions.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <button className="btn btn-sm btn-brass" disabled={desactive || !nom.trim()} onClick={valider}>
        Inviter
      </button>
    </div>
  )
}

function Invitation({
  serveur,
  invite,
  onClose
}: {
  serveur: ServeurWow
  invite: { id: string; nom: string }
  onClose: () => void
}): JSX.Element {
  const s = useStore()
  const adresses = [
    ...serveur.adresses.map((a) => ({ a, ou: 'Wi-Fi de la maison' })),
    ...serveur.distance.map((a) => ({ a, ou: 'À distance (Tailscale)' }))
  ].map((x) => ({ ...x, url: `${x.a}?joueur=${encodeURIComponent(invite.id)}` }))
  const [choix, setChoix] = useState(0)
  const [qr, setQr] = useState<string | null>(null)
  const url = adresses[choix]?.url ?? null

  useEffect(() => {
    if (!url) return
    let vivant = true
    void window.jdr.wow.qr(url).then((d) => vivant && setQr(d))
    return () => {
      vivant = false
    }
  }, [url])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="scrim par-dessus" onClick={onClose}>
      <div className="modal az-invitation" onClick={(e) => e.stopPropagation()}>
        <header>
          <h3>L’Aventure de {invite.nom}</h3>
        </header>
        <div className="body">
          {url ? (
            <>
              <p>
                Sur sa tablette ou son téléphone, connecté au même Wi-Fi, {invite.nom} scanne ce code ou tape
                l’adresse. La première fois, il crée son personnage (race et classe) ; ensuite sa fiche
                s’ouvre directement. Ajoute-la à l’écran d’accueil.
              </p>
              {adresses.length > 1 ? (
                <div className="az-adresses">
                  {adresses.map((x, i) => (
                    <button key={x.url} className={`az-puce${i === choix ? ' on' : ''}`} onClick={() => setChoix(i)}>
                      {x.ou} · {x.a.replace(/^http:\/\//, '').split('/')[0]}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="az-qr">{qr ? <img src={qr} alt={`QR code de ${url}`} /> : null}</div>
              <code className="az-url">{url}</code>
            </>
          ) : (
            <p>
              Le jeu ne voit aucun réseau : ce PC est-il connecté au Wi-Fi ? Sur ce PC seulement, la fiche
              s’ouvre avec « Ouvrir ici ».
            </p>
          )}
        </div>
        <footer>
          <button
            className="btn btn-ghost"
            onClick={() => void window.jdr.wow.fenetreJoueur(invite.id)}
            title="Ouvre l’Aventure de ce joueur dans une fenêtre de l’Écran (pas en même temps que lui : vous écririez la même fiche)"
          >
            Ouvrir ici
          </button>
          <div className="spacer" />
          {url ? (
            <button
              className="btn"
              onClick={() => {
                void navigator.clipboard.writeText(url)
                s.toast('Adresse copiée.')
              }}
            >
              Copier l’adresse
            </button>
          ) : null}
          <button className="btn btn-brass" onClick={onClose}>
            Fermer
          </button>
        </footer>
      </div>
    </div>
  )
}

/* ---------------- un joueur ---------------- */

function Jauge({
  cur,
  max,
  sorte,
  texte
}: {
  cur: number
  max: number | undefined
  sorte: string
  texte: string
}): JSX.Element {
  const pct = max && max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 100
  return (
    <div className={`az-jauge az-${sorte}`}>
      <i style={{ width: `${pct}%` }} />
      <span>{texte}</span>
    </div>
  )
}

function CarteJoueur({
  j,
  vise,
  onViser,
  onLien
}: {
  j: JoueurWow
  vise: boolean
  onViser: () => void
  onLien: () => void
}): JSX.Element {
  const e = j.etat ?? {}
  const classe = e.classe || j.classe
  const couleur = COULEUR_CLASSE[classe] ?? 'var(--line)'
  const titre = e.nomPerso || j.nom
  const sous = [e.race, e.classeNom || NOM_CLASSE[classe], e.niveau ? `niv. ${e.niveau}` : null]
    .filter(Boolean)
    .join(' · ')
  const pv = e.pv ?? 0
  const aTerre = j.enLigne && e.pvMax !== undefined && pv <= 0
  const buffs = (e.auras ?? []).filter((a) => !a.mal)
  const debuffs = (e.auras ?? []).filter((a) => a.mal)
  const derniere = (e.journal ?? []).slice(-2)
  return (
    <article
      className={`az-joueur${j.enLigne ? ' en-ligne' : ''}${vise ? ' vise' : ''}${aTerre ? ' a-terre' : ''}`}
      style={{ ['--classe' as string]: couleur }}
      onClick={onViser}
      title={j.enLigne ? 'Clic : viser ce joueur avec la console' : 'Hors ligne : sa fiche enregistrée'}
    >
      <header>
        <span className="az-point" aria-label={j.enLigne ? 'en ligne' : 'hors ligne'} />
        <div className="az-qui">
          <b>{titre}</b>
          <span>{sous || 'Pas encore de personnage'}</span>
        </div>
        <button
          className="btn btn-sm btn-ghost"
          onClick={(ev) => {
            ev.stopPropagation()
            onLien()
          }}
          title="L’adresse et le QR code de sa fiche"
        >
          QR
        </button>
      </header>
      <Jauge
        cur={pv}
        max={e.pvMax}
        sorte="pv"
        texte={e.pvMax !== undefined ? `${pv} / ${e.pvMax} PV` : `${pv} PV`}
      />
      <Jauge
        cur={e.res ?? 0}
        max={e.resMax}
        sorte={e.resType || 'mana'}
        texte={`${e.res ?? 0} / ${e.resMax ?? 0} ${e.resNom || 'Ressource'}`}
      />
      {buffs.length || debuffs.length ? (
        <div className="az-auras">
          {buffs.map((a, i) => (
            <span key={`b${i}`} className="az-aura" title={a.lbl || undefined}>
              {a.nom}
              {a.tours ? <em>{a.tours}</em> : null}
            </span>
          ))}
          {debuffs.map((a, i) => (
            <span key={`d${i}`} className="az-aura mal" title={a.lbl || undefined}>
              {a.nom}
              {a.tours ? <em>{a.tours}</em> : null}
            </span>
          ))}
        </div>
      ) : null}
      {j.enLigne && derniere.length ? (
        <ul className="az-dernier">
          {derniere.map((l, i) => (
            <li key={i}>{l.x}</li>
          ))}
        </ul>
      ) : null}
      {aTerre ? <div className="az-ko">À terre</div> : null}
    </article>
  )
}

/* ---------------- le journal de la table ---------------- */

function Journal({ joueurs }: { joueurs: JoueurWow[] }): JSX.Element | null {
  const lignes = joueurs
    .filter((j) => j.enLigne)
    .flatMap((j) => (j.etat?.journal ?? []).map((l) => ({ ...l, qui: j.etat?.nomPerso || j.nom, classe: j.classe })))
    /* Les heures sont « 21:47 » : l'ordre du texte est celui du temps, dans la soirée. */
    .sort((a, b) => a.t.localeCompare(b.t))
    .slice(-40)
  if (!lignes.length) return null
  return (
    <div className="az-journal">
      <span className="eyebrow">Journal de la table</span>
      <ul>
        {lignes.map((l, i) => (
          <li key={i} className={`az-l-${l.c || 'dit'}`}>
            <span className="hr">{l.t}</span>
            <b style={{ color: COULEUR_CLASSE[l.classe] }}>{l.qui}</b> {l.x}
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ---------------- la console ---------------- */

type Envoyer = (quoi: EnvoiWow, recit: string) => Promise<void>

function Facteurs({ mod, setMod }: { mod: number; setMod: (n: number) => void }): JSX.Element {
  return (
    <span className="az-facteurs">
      <button className="btn btn-sm" onClick={() => setMod(Math.max(-20, mod - 1))} aria-label="Facteur −1">
        −
      </button>
      <b className={mod ? 'on' : ''}>{mod > 0 ? `+${mod}` : mod}</b>
      <button className="btn btn-sm" onClick={() => setMod(Math.min(20, mod + 1))} aria-label="Facteur +1">
        +
      </button>
    </span>
  )
}

function DemanderJet({ onEnvoyer }: { onEnvoyer: Envoyer }): JSX.Element {
  const [dd, setDd] = useState<number>(10)
  const [mod, setMod] = useState(0)
  const [quoi, setQuoi] = useState('')
  return (
    <div className="az-bloc">
      <h4>Demander un jet</h4>
      <div className="az-dds">
        {DDS.map((v) => (
          <button key={v} className={`az-dd${dd === v ? ' on' : ''}`} onClick={() => setDd(v)}>
            {v}
          </button>
        ))}
      </div>
      <div className="az-ligne">
        <span className="az-lbl">Facteurs</span>
        <Facteurs mod={mod} setMod={setMod} />
      </div>
      <input
        type="text"
        placeholder="Pourquoi ? (Force pour enfoncer la porte…)"
        value={quoi}
        onChange={(e) => setQuoi(e.target.value)}
      />
      <button
        className="btn btn-brass"
        onClick={() => {
          void onEnvoyer(
            { t: 'dd', dd, mod, quoi: quoi.trim() || undefined },
            `Jet demandé : DD ${dd}${mod ? ` (${mod > 0 ? '+' : ''}${mod})` : ''}`
          )
          setMod(0)
          setQuoi('')
        }}
      >
        Demander : DD {dd}
        {mod ? ` ${mod > 0 ? '+' : ''}${mod}` : ''}
      </button>
      <p className="aide">
        Le panneau « Difficulté » de leur Aventure se règle tout seul ; le joueur lance son sort, sa
        caractéristique ou le d20, et le verdict tombe dans son journal (et ici).
      </p>
    </div>
  )
}

/**
 * Les quêtes de la campagne : préparées dans `quetes-wow.json` (dossier de la
 * campagne), envoyées d'un clic au journal de quêtes des joueurs visés. Une
 * quête déjà reçue n'arrive pas deux fois.
 */
function Quetes({ onEnvoyer }: { onEnvoyer: Envoyer }): JSX.Element {
  const [liste, setListe] = useState<QuetePreparee[]>([])
  const [choix, setChoix] = useState(0)
  const [libre, setLibre] = useState({ titre: '', texte: '' })
  useEffect(() => {
    void window.jdr.wow.quetes().then(setListe)
  }, [])
  const actes = [...new Set(liste.map((q) => q.acte))]
  const q = liste[choix]
  const donner = (x: { titre: string; donneur?: string; lieu?: string; texte?: string }): void =>
    void onEnvoyer({ t: 'quete', quete: x }, `Quête « ${x.titre} »`)
  return (
    <div className="az-bloc">
      <h4>Quêtes</h4>
      {liste.length ? (
        <>
          <select value={choix} onChange={(e) => setChoix(Number(e.target.value))} aria-label="Quête préparée">
            {actes.map((a) => (
              <optgroup key={a} label={a}>
                {liste.map((x, i) =>
                  x.acte === a ? (
                    <option key={i} value={i}>
                      {x.sorte} {x.titre}
                    </option>
                  ) : null
                )}
              </optgroup>
            ))}
          </select>
          {q ? (
            <div className="az-quete">
              <span className="az-lbl">{[q.donneur, q.lieu].filter(Boolean).join(' · ')}</span>
              {q.texte ? <p>{q.texte}</p> : null}
            </div>
          ) : null}
          <div className="az-ligne">
            <button className="btn btn-brass" disabled={!q} onClick={() => q && donner(q)}>
              Donner la quête
            </button>
            <button
              className="btn btn-ghost"
              disabled={!q}
              onClick={() => q && void onEnvoyer({ t: 'queteFinie', titre: q.titre }, `Quête terminée : « ${q.titre} »`)}
              title="Marque la quête comme terminée dans leur journal"
            >
              Terminée
            </button>
          </div>
          <p className="aide">★ principale · ◆ secondaire liée · ○ secondaire libre. Le texte est celui que lisent les joueurs.</p>
        </>
      ) : (
        <p className="aide">Aucune quête préparée pour cette campagne (fichier quetes-wow.json dans son dossier).</p>
      )}
      <div className="az-ligne">
        <input
          type="text"
          placeholder="Ou une quête à la volée…"
          value={libre.titre}
          onChange={(e) => setLibre({ ...libre, titre: e.target.value })}
        />
        <button
          className="btn"
          disabled={!libre.titre.trim()}
          onClick={() => {
            donner({ titre: libre.titre.trim(), texte: libre.texte.trim() || undefined, donneur: 'Le MJ' })
            setLibre({ titre: '', texte: '' })
          }}
        >
          Donner
        </button>
      </div>
    </div>
  )
}

function Degats({ onEnvoyer }: { onEnvoyer: Envoyer }): JSX.Element {
  const [n, setN] = useState(5)
  const [magique, setMagique] = useState(false)
  const [ecole, setEcole] = useState(ECOLES[0])
  const [res, setRes] = useState(10)
  return (
    <div className="az-bloc">
      <h4>Dégâts et soins</h4>
      <div className="az-ligne">
        <input
          type="number"
          min={0}
          max={999}
          value={n}
          onChange={(e) => setN(Math.max(0, Number(e.target.value) || 0))}
          aria-label="Montant"
        />
        <select value={magique ? 'magique' : 'physique'} onChange={(e) => setMagique(e.target.value === 'magique')}>
          <option value="physique">physiques</option>
          <option value="magique">magiques</option>
        </select>
        {magique ? (
          <select value={ecole} onChange={(e) => setEcole(e.target.value)} aria-label="École">
            {ECOLES.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        ) : null}
      </div>
      <div className="az-ligne">
        <button
          className="btn az-rouge"
          disabled={!n}
          onClick={() =>
            void onEnvoyer(
              { t: 'degats', n, type: magique ? 'magique' : 'physique', ecole: magique ? ecole.toLowerCase() : undefined },
              `${n} dégâts ${magique ? ecole.toLowerCase() : 'physiques'}`
            )
          }
          title="L’armure et les boucliers de la fiche s’appliquent"
        >
          🩸 Infliger {n}
        </button>
        <button className="btn az-vert" disabled={!n} onClick={() => void onEnvoyer({ t: 'soin', n }, `Soin de ${n} PV`)}>
          ✚ Soigner {n}
        </button>
      </div>
      <div className="az-ligne">
        <span className="az-lbl">Ressource</span>
        <input
          type="number"
          min={0}
          max={999}
          value={res}
          onChange={(e) => setRes(Math.max(0, Number(e.target.value) || 0))}
          aria-label="Ressource"
        />
        <button className="btn btn-sm" onClick={() => void onEnvoyer({ t: 'ressource', n: -res }, `−${res} ressource`)}>
          −{res}
        </button>
        <button className="btn btn-sm" onClick={() => void onEnvoyer({ t: 'ressource', n: res }, `+${res} ressource`)}>
          +{res}
        </button>
      </div>
    </div>
  )
}

function Etats({ onEnvoyer }: { onEnvoyer: Envoyer }): JSX.Element {
  const [nom, setNom] = useState('')
  const [tours, setTours] = useState(2)
  const [mal, setMal] = useState(true)
  const poser = (a: { nom: string; tours: number; mal: boolean; desc?: string }): void =>
    void onEnvoyer(
      { t: 'aura', aura: { nom: a.nom, tours: a.tours, mal: a.mal, desc: a.desc ?? '' } },
      `${a.mal ? 'Affaiblissement' : 'Amélioration'} « ${a.nom} » (${a.tours} tour${a.tours > 1 ? 's' : ''})`
    )
  return (
    <div className="az-bloc">
      <h4>États</h4>
      <div className="az-rapides">
        {ETATS_RAPIDES.map((e) => (
          <button key={e.nom} className={`az-puce${e.mal ? ' mal' : ''}`} onClick={() => poser(e)} title={e.desc}>
            {e.nom} · {e.tours}
          </button>
        ))}
      </div>
      <div className="az-ligne">
        <input type="text" placeholder="Autre état…" value={nom} onChange={(e) => setNom(e.target.value)} />
        <input
          type="number"
          min={0}
          max={99}
          value={tours}
          onChange={(e) => setTours(Math.max(0, Number(e.target.value) || 0))}
          aria-label="Tours (0 : sans fin)"
          title="Tours (0 : jusqu’à ce qu’on le retire)"
        />
        <label className="az-coche">
          <input type="checkbox" checked={mal} onChange={(e) => setMal(e.target.checked)} />
          néfaste
        </label>
      </div>
      <div className="az-ligne">
        <button
          className="btn"
          disabled={!nom.trim()}
          onClick={() => {
            poser({ nom: nom.trim(), tours, mal })
            setNom('')
          }}
        >
          Poser
        </button>
        <button
          className="btn btn-ghost"
          disabled={!nom.trim()}
          onClick={() => void onEnvoyer({ t: 'retire', nom: nom.trim() }, `« ${nom.trim()} » retiré`)}
          title="Retire l’état de ce nom (posé par le MJ)"
        >
          Retirer
        </button>
      </div>
    </div>
  )
}

function Message({ onEnvoyer }: { onEnvoyer: Envoyer }): JSX.Element {
  const [texte, setTexte] = useState('')
  const envoyer = (): void => {
    const t = texte.trim()
    if (!t) return
    void onEnvoyer({ t: 'message', texte: t }, 'Message')
    setTexte('')
  }
  return (
    <div className="az-bloc">
      <h4>Message</h4>
      <div className="az-ligne">
        <input
          type="text"
          placeholder="Dans leur discussion…"
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && envoyer()}
        />
        <button className="btn" disabled={!texte.trim()} onClick={envoyer}>
          Envoyer
        </button>
      </div>
    </div>
  )
}

/** Le jet du MJ lui-même (un PNJ, un piège), aux mêmes règles. */
function JetDuMj(): JSX.Element {
  const [dd, setDd] = useState<number | null>(10)
  const [mod, setMod] = useState(0)
  const [jets, setJets] = useState<JetWow[]>([])
  const lancer = (): void => {
    const a = new Uint32Array(1)
    crypto.getRandomValues(a)
    const de = (a[0] % 20) + 1
    setJets((j) => [jugerJet(de, mod, dd), ...j].slice(0, 6))
  }
  return (
    <div className="az-bloc">
      <h4>Jet du MJ</h4>
      <div className="az-dds">
        <button className={`az-dd${dd === null ? ' on' : ''}`} onClick={() => setDd(null)} title="Sans difficulté">
          –
        </button>
        {DDS.map((v) => (
          <button key={v} className={`az-dd${dd === v ? ' on' : ''}`} onClick={() => setDd(v)}>
            {v}
          </button>
        ))}
      </div>
      <div className="az-ligne">
        <span className="az-lbl">Facteurs</span>
        <Facteurs mod={mod} setMod={setMod} />
        <div className="spacer" />
        <button className="btn btn-brass" onClick={lancer}>
          🎲 1D20
        </button>
      </div>
      {jets.length ? (
        <ul className="az-jets">
          {jets.map((j, i) => (
            <li key={i} className={j.reussi === null ? '' : j.reussi ? 'ok' : 'ko'}>
              <b>{j.de}</b>
              {j.mod ? ` ${j.mod > 0 ? '+' : '−'} ${Math.abs(j.mod)} = ${j.total}` : ''}
              {j.dd ? ` — DD ${j.dd} : ${j.reussi ? 'RÉUSSITE' : 'ÉCHEC'}` : ''}
              {j.naturel === 'vingt' ? ' · 20 naturel !' : j.naturel === 'un' ? ' · 1 naturel' : ''}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
