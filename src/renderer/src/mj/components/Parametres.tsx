import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { jaugeSanite } from '@shared/types'
import type { Rubrique } from './Menubar'
import {
  IconClavier,
  IconClose,
  IconDie,
  IconFolder,
  IconMurs,
  IconPortable,
  IconRouage,
  IconScreen,
  IconSliders,
  IconTrash
} from './Icons'

/**
 * La fenêtre des paramètres — ce qui se pose une fois et ne se retouche pas
 * en pleine scène.
 *
 * Elle est rangée en deux groupes, et la coupure n'est pas décorative : ce qui
 * **suit la campagne** part avec son dossier quand on le copie sur une clé ;
 * ce qui **suit le poste** reste sur la machine du maître du jeu. Le bandeau
 * du haut le redit à chaque rubrique, pour qu'on n'ait jamais à le deviner.
 *
 * Ce qu'on ne trouvera pas ici, et volontairement : les noms et les PV sous
 * les pions, l'encart des joueurs, le volume de l'ambiance. On les bascule en
 * pleine scène — ils restent sous la main, en Régie et au Pupitre.
 */
const RUBRIQUES: { id: Rubrique; nom: string; icone: JSX.Element; poste?: boolean }[] = [
  { id: 'ecran', nom: 'Écran des joueurs', icone: <IconScreen /> },
  { id: 'table', nom: 'Table et règles', icone: <IconDie /> },
  { id: 'murs', nom: 'Murs et lumière', icone: <IconMurs /> },
  { id: 'biblio', nom: 'Bibliothèque', icone: <IconFolder /> },
  { id: 'portables', nom: 'Portables', icone: <IconPortable />, poste: true },
  { id: 'poste', nom: 'Le poste', icone: <IconSliders />, poste: true },
  { id: 'touches', nom: 'Raccourcis', icone: <IconClavier />, poste: true }
]

export function Parametres({
  depart,
  onClose
}: {
  depart?: Rubrique
  onClose: () => void
}): JSX.Element {
  const s = useStore()
  const [rub, setRub] = useState<Rubrique>(depart ?? 'ecran')

  useEffect(() => {
    const touche = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', touche)
    return () => document.removeEventListener('keydown', touche)
  }, [onClose])

  const active = RUBRIQUES.find((r) => r.id === rub)!
  const surLePoste = !!active.poste

  return (
    <div className="scrim plein" onMouseDown={onClose}>
      <section
        className="parametres"
        role="dialog"
        aria-modal="true"
        aria-label="Paramètres"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header>
          <IconRouage />
          <h3>Paramètres</h3>
          <span className="eyebrow ou">
            {surLePoste ? 'Suit le poste' : `Suit la campagne · ${s.campaign?.name ?? '—'}`}
          </span>
          <button className="pm-fermer" title="Fermer — Échap" aria-label="Fermer" onClick={onClose}>
            <IconClose />
          </button>
        </header>

        <div className="pm-corps">
          <nav className="pm-rubriques" role="tablist" aria-label="Rubriques">
            <span className="eyebrow titre">La campagne</span>
            {RUBRIQUES.filter((r) => !r.poste).map((r) => (
              <Onglet key={r.id} r={r} on={rub === r.id} onChoisir={() => setRub(r.id)} />
            ))}
            <span className="eyebrow titre">Le poste</span>
            {RUBRIQUES.filter((r) => r.poste).map((r) => (
              <Onglet key={r.id} r={r} on={rub === r.id} onChoisir={() => setRub(r.id)} />
            ))}
          </nav>

          <div className="pm-panneau">
            {rub === 'ecran' && <Ecran />}
            {rub === 'table' && <Table />}
            {rub === 'murs' && <Murs />}
            {rub === 'biblio' && <Biblio />}
            {rub === 'portables' && <Portables />}
            {rub === 'poste' && <Poste />}
            {rub === 'touches' && <Touches />}
          </div>
        </div>

        <footer>
          <span>
            {surLePoste
              ? 'Ces réglages restent sur ce poste, d’une campagne à l’autre.'
              : 'Ces réglages partent avec le dossier de la campagne.'}
          </span>
          <div className="spacer" />
          <span>Tout s’enregistre en sortant du champ — pas de bouton à viser.</span>
        </footer>
      </section>
    </div>
  )
}

function Onglet({
  r,
  on,
  onChoisir
}: {
  r: (typeof RUBRIQUES)[number]
  on: boolean
  onChoisir: () => void
}): JSX.Element {
  return (
    <button role="tab" aria-selected={on} onClick={onChoisir}>
      {r.icone}
      {r.nom}
    </button>
  )
}

/* ============================================================
   Les briques d'une rubrique
   ============================================================ */

function Tete({ titre, quoi }: { titre: string; quoi: string }): JSX.Element {
  return (
    <>
      <h4>{titre}</h4>
      <p className="pm-sous">{quoi}</p>
    </>
  )
}

function Ligne({
  nom,
  aide,
  pleine,
  children
}: {
  nom: string
  aide?: string
  pleine?: boolean
  children: React.ReactNode
}): JSX.Element {
  return (
    <div className={`pm-ligne${pleine ? ' pleine' : ''}`}>
      <div className="quoi">
        <span className="nom">{nom}</span>
        {aide ? <span className="aide">{aide}</span> : null}
      </div>
      <div className="cmd">{children}</div>
    </div>
  )
}

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="pm-bloc">
      <span className="eyebrow">{titre}</span>
      {children}
    </div>
  )
}

/** Un groupe de boutons dont un seul est allumé. */
function Seg<T extends string>({
  valeur,
  choix,
  onChoisir
}: {
  valeur: T
  choix: { k: T; label: string; aide?: string }[]
  onChoisir: (k: T) => void
}): JSX.Element {
  return (
    <div className="pm-seg" role="group">
      {choix.map((c) => (
        <button
          key={c.k}
          className={valeur === c.k ? 'on' : ''}
          title={c.aide}
          onClick={() => onChoisir(c.k)}
        >
          {c.label}
        </button>
      ))}
    </div>
  )
}

/** Un curseur qui dit ce qu'il vaut, et n'écrit qu'une fois lâché. */
function Curseur({
  valeur,
  min,
  max,
  pas,
  texte,
  desactive,
  onPoser,
  label
}: {
  valeur: number
  min: number
  max: number
  pas?: number
  texte: (v: number) => string
  desactive?: boolean
  onPoser: (v: number) => void
  label: string
}): JSX.Element {
  /* On suit le doigt à l'écran et on n'écrit qu'au relâchement : sans cela,
     tirer un curseur écrirait cinquante lignes en base pour un seul geste. */
  const [vu, setVu] = useState(valeur)
  useEffect(() => setVu(valeur), [valeur])
  return (
    <>
      <input
        type="range"
        min={min}
        max={max}
        step={pas ?? 1}
        value={vu}
        disabled={desactive}
        aria-label={label}
        onChange={(e) => setVu(Number(e.target.value))}
        onPointerUp={() => onPoser(vu)}
        onKeyUp={() => onPoser(vu)}
      />
      <b className="pm-val num">{texte(vu)}</b>
    </>
  )
}

/* ============================================================
   1. Écran des joueurs
   ============================================================ */

function Ecran(): JSX.Element {
  const s = useStore()
  const r = s.reglages

  return (
    <>
      <Tete
        titre="Écran des joueurs"
        quoi="Comment l’image sort, et comment elle change. Trois choses qu’on pose une fois et qu’on ne retouche pas en pleine scène."
      />

      <Ligne
        nom="Écran de sortie"
        aide="Choisi une fois pour l’installation. La campagne s’en souvient."
      >
        <select
          value={r.sortieEcran ?? ''}
          onChange={(e) =>
            void s.poserReglage('sortie.ecran', e.target.value === '' ? null : e.target.value)
          }
        >
          <option value="">Sortie automatique (écran secondaire)</option>
          {s.screens.map((sc) => (
            <option key={sc.id} value={sc.id}>
              {sc.label} · {sc.width}×{sc.height}
            </option>
          ))}
        </select>
      </Ligne>

      <Ligne
        nom="Manière de basculer, par défaut"
        aide="Les trois boutons restent au-dessus de « Basculer ». Ici, celui qui est armé en arrivant."
      >
        <Seg
          valeur={r.basculeMode}
          choix={[
            { k: 'fondu' as const, label: 'Fondu', aide: 'L’une apparaît pendant que l’autre s’efface' },
            { k: 'volet' as const, label: 'Volet', aide: 'La nouvelle pousse l’ancienne hors de l’écran' },
            { k: 'noir' as const, label: 'Par le noir', aide: 'On passe par le noir entre les deux' }
          ]}
          onChoisir={(k) => s.setTransition(k)}
        />
      </Ligne>

      <Ligne
        nom="Durée de l’enchaînement"
        aide="Le temps que met une bascule. « Couper » l’ignore et change d’un coup."
      >
        <Curseur
          label="Durée de l’enchaînement"
          valeur={r.basculeMs}
          min={200}
          max={2500}
          pas={50}
          texte={(v) => `${v} ms`}
          onPoser={(v) => void s.poserReglage('bascule.ms', v)}
        />
      </Ligne>

      <p className="pm-aparte">
        Restent en Régie et au Pupitre : <b>noms</b> et <b>PV sous les pions</b>, l’
        <b>encart des joueurs</b> et sa santé mentale, le <b>volume de l’ambiance</b>. On les
        bascule en pleine scène — les deux pages en gardent donc chacune une copie, et c’est voulu.
      </p>
    </>
  )
}

/* ============================================================
   2. Table et règles
   ============================================================ */

function Table(): JSX.Element {
  const s = useStore()
  const [nom, setNom] = useState(s.campaign?.name ?? '')
  const [systeme, setSysteme] = useState(s.campaign?.system ?? '')
  const spec = s.sheet?.spec ?? null

  const poserIdentite = async (): Promise<void> => {
    const info = await window.jdr.project.update({
      name: nom.trim() || (s.campaign?.name ?? ''),
      system: systeme.trim() || null
    })
    if (info) useStore.setState({ project: info, campaign: info.campaign })
    await s.refreshRecents()
  }

  /* La fiche se réenregistre entière : ces trois réglages ne retirent aucune
     ligne, donc aucun personnage ne perd ce qu'il a saisi. */
  const poserFiche = async (patch: Partial<NonNullable<typeof spec>>): Promise<void> => {
    if (!s.sheet || !spec) return
    await window.jdr.sheet.save({ name: s.sheet.name, spec: { ...spec, ...patch } })
    await s.refreshCharacters()
  }

  const limite = spec?.skillLimit ?? null
  const sanite = spec ? jaugeSanite(spec, spec.gauges) : undefined

  return (
    <>
      <Tete
        titre="Table et règles"
        quoi="L’identité de la campagne, et les règles qu’elle suit. Les trois dernières étaient rangées dans un coin d’en-tête de la fiche : on ne les trouvait qu’en cherchant."
      />

      <Ligne nom="Nom de la campagne">
        <input
          type="text"
          value={nom}
          style={{ width: 240 }}
          onChange={(e) => setNom(e.target.value)}
          onBlur={() => void poserIdentite()}
        />
      </Ligne>
      <Ligne nom="Système" aide="Le vôtre, ou celui d’un livre. C’est une étiquette, rien de plus.">
        <input
          type="text"
          value={systeme}
          style={{ width: 240 }}
          placeholder="maison — d20 + carac"
          onChange={(e) => setSysteme(e.target.value)}
          onBlur={() => void poserIdentite()}
        />
      </Ligne>

      <Ligne
        nom="Dossier de la campagne"
        aide="La base vit dans .ecran-du-maitre · tout le reste du dossier est la bibliothèque."
        pleine
      >
        <div className="pm-chemin">
          <code>{s.project?.dir ?? '—'}</code>
          <div className="spacer" />
          <button className="btn btn-sm btn-ghost" onClick={() => void window.jdr.project.reveal()}>
            Ouvrir
          </button>
          <button className="btn btn-sm" onClick={() => void window.jdr.project.open()}>
            Changer de campagne…
          </button>
        </div>
      </Ligne>

      <Bloc titre="Les règles de la table">
        {!spec ? (
          <p className="pm-aparte">La fiche de campagne n’est pas encore chargée.</p>
        ) : (
          <>
            <Ligne
              nom="Système de jet"
              aide="On note le dé du joueur ; le score, c’est le dé plus la caractéristique."
            >
              <select
                value={spec.rollSystem}
                onChange={(e) =>
                  void poserFiche({ rollSystem: e.target.value as typeof spec.rollSystem })
                }
              >
                <option value="d20-plus">d20 + caractéristique</option>
                <option value="d100-under">d100 sous la valeur</option>
              </select>
            </Ligne>

            <Ligne nom="Le joueur prend au plus" aide="Le nombre de compétences qu’une fiche accepte.">
              <input
                type="number"
                min={0}
                style={{ width: 74 }}
                value={limite ?? ''}
                placeholder="∞"
                aria-label="Compétences au plus"
                onChange={(e) =>
                  void poserFiche({
                    skillLimit: e.target.value === '' ? undefined : Number(e.target.value)
                  })
                }
              />
              <span className="pm-val">compétences</span>
              <button
                className={`btn btn-sm${limite === null ? ' btn-on' : ' btn-ghost'}`}
                title="Autant qu’il veut"
                onClick={() => void poserFiche({ skillLimit: limite === null ? 8 : undefined })}
              >
                ∞
              </button>
            </Ligne>

            <Ligne
              nom="La santé mentale, c’est"
              aide="Celle que l’encart des joueurs montre à côté de la vie."
            >
              <select
                value={spec.sanityGauge === null ? '__aucune' : (sanite?.key ?? '')}
                onChange={(e) =>
                  void poserFiche({
                    sanityGauge: e.target.value === '__aucune' ? null : e.target.value
                  })
                }
              >
                {spec.gauges.map((g) => (
                  <option key={g.key} value={g.key}>
                    {g.label}
                  </option>
                ))}
                <option value="__aucune">— aucune —</option>
              </select>
            </Ligne>
          </>
        )}
      </Bloc>

      <Ligne
        nom="Unité de valeur"
        aide="Nommée une fois ; chaque objet ne porte qu’un nombre. Les familles, elles, restent dans la réserve."
      >
        <input
          type="text"
          defaultValue={s.uniteValeur}
          aria-label="Le nom de l’unité"
          style={{ width: 160 }}
          onBlur={async (e) => {
            await window.jdr.objets.unite(e.target.value)
            await s.refreshObjets()
          }}
        />
      </Ligne>
    </>
  )
}

/* ============================================================
   3. Murs et lumière
   ============================================================ */

function Murs(): JSX.Element {
  const s = useStore()
  const r = s.reglages
  const sans = r.mursPortee === null

  return (
    <>
      <Tete
        titre="Murs et lumière"
        quoi="Les valeurs de départ des cartes neuves. Chaque plan garde ensuite les siennes, réglées sur place — on ne refait pas ici le travail des murs."
      />

      <Ligne
        nom="Portée du regard"
        aide="Au-delà, c’est trop loin pour distinguer quoi que ce soit."
      >
        <Curseur
          label="Portée du regard"
          valeur={Math.round((r.mursPortee ?? 0.35) * 100)}
          min={2}
          max={150}
          desactive={sans}
          texte={(v) => (sans ? '∞' : `${v} %`)}
          onPoser={(v) => void s.poserReglage('murs.portee', v / 100)}
        />
        <button
          className={`btn btn-sm${sans ? ' btn-on' : ' btn-ghost'}`}
          title="Le regard ne s’arrête qu’aux murs"
          onClick={() => void s.poserReglage('murs.portee', sans ? 0.35 : null)}
        >
          {sans ? 'Sans limite' : 'Retirer la limite'}
        </button>
      </Ligne>

      <Ligne
        nom="Angle du champ de vision"
        aide="Le secteur qu’un pion embrasse devant lui. Il vaut pour toute la campagne, et pour tous les écrans."
      >
        <Curseur
          label="Angle du champ de vision"
          valeur={r.mursAngle}
          min={45}
          max={360}
          pas={5}
          texte={(v) => (v >= 360 ? 'tout autour' : `${v}°`)}
          onPoser={(v) => void s.poserReglage('murs.angle', v)}
        />
      </Ligne>

      <Ligne
        nom="Laisser une zone éclairée découverte"
        aide="Cochée, la maison se dessine à mesure. Décochée, elle se referme derrière le groupe."
      >
        <input
          type="checkbox"
          checked={r.mursGarde}
          aria-label="Laisser une zone éclairée découverte"
          onChange={(e) => void s.poserReglage('murs.garde', e.target.checked)}
        />
      </Ligne>

      <Ligne
        nom="Largeur d’usine des ouvertures"
        aide="Une carte qui n’a pas encore retenu la sienne part de là."
      >
        <Curseur
          label="Largeur d’usine des ouvertures"
          valeur={Math.round(r.mursLargeur * 1000) / 10}
          min={1}
          max={20}
          pas={0.5}
          texte={(v) => `${v.toFixed(1).replace('.', ',')} %`}
          onPoser={(v) => void s.poserReglage('murs.largeur', v / 100)}
        />
      </Ligne>

      <p className="pm-aparte">
        Les deux natures de trait, la porte, la fenêtre, le rideau, la loupe et la gomme restent où
        ils sont : ce sont des outils de dessin, pas des réglages.
      </p>
    </>
  )
}

/* ============================================================
   4. Bibliothèque
   ============================================================ */

function Biblio(): JSX.Element {
  const s = useStore()
  const [examen, setExamen] = useState<{ actif: boolean; reste: number } | null>(null)
  const [occupe, setOccupe] = useState(false)

  /* Le graveur travaille pendant qu'on le regarde : on relit, sans hâte. */
  useEffect(() => {
    let vivant = true
    const lire = async (): Promise<void> => {
      const e = await window.jdr.examen.etat()
      if (vivant) setExamen(e)
    }
    void lire()
    const t = setInterval(lire, 2000)
    return () => {
      vivant = false
      clearInterval(t)
    }
  }, [])

  return (
    <>
      <Tete
        titre="Bibliothèque"
        quoi="Le disque fait foi. Ce qui se règle ici tient à la façon de la regarder, et au graveur qui travaille derrière."
      />

      <Ligne
        nom="Taille des vignettes"
        aide="Elle était oubliée dès qu’on changeait de page. Elle tient, maintenant."
      >
        <Seg
          valeur={s.poste.vignette <= 130 ? 'p' : s.poste.vignette >= 190 ? 'g' : 'm'}
          choix={[
            { k: 'p' as const, label: 'Petites' },
            { k: 'm' as const, label: 'Moyennes' },
            { k: 'g' as const, label: 'Grandes' }
          ]}
          onChoisir={(k) =>
            void s.poserPoste('biblio.vignette', k === 'p' ? 118 : k === 'g' ? 206 : 154)
          }
        />
      </Ligne>

      <Bloc titre="Le graveur de vignettes">
        <Ligne
          nom="Où il en est"
          aide="Une fenêtre cachée mesure les médias et grave leurs vignettes, un fichier à la fois."
        >
          <span className={`pm-etat${examen?.actif ? ' on' : ''}`}>
            {!examen
              ? '…'
              : examen.actif
                ? `au travail · ${examen.reste} en attente`
                : examen.reste
                  ? `${examen.reste} en attente`
                  : 'tout est gravé'}
          </span>
        </Ligne>
        <Ligne
          nom="Reprendre le travail"
          aide="Relire le dossier cherche ce qui a bougé ; tout regraver oublie les mesures et recommence."
        >
          <button
            className="btn btn-sm"
            disabled={occupe}
            onClick={async () => {
              setOccupe(true)
              await window.jdr.library.rescan()
              await s.refreshLibrary()
              setOccupe(false)
            }}
          >
            Relire le dossier
          </button>
          <button
            className="btn btn-sm"
            disabled={occupe}
            onClick={async () => {
              if (!confirm('Oublier les mesures de tous les médias et tout regraver ?')) return
              setOccupe(true)
              const n = await window.jdr.examen.tout()
              setOccupe(false)
              s.toast(`${n} médias à réexaminer.`)
            }}
          >
            Tout regraver
          </button>
        </Ligne>
      </Bloc>
    </>
  )
}

/* ============================================================
   5. Portables
   ============================================================ */

function Portables(): JSX.Element {
  const s = useStore()
  const info = s.mobile
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    void s.refreshMobile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <Tete
        titre="Portables"
        quoi="Tout passe par le Wi-Fi de la maison — rien ne sort vers Internet. Le QR code, lui, reste en Régie : le tendre à la table est un geste de partie."
      />

      <Ligne nom="L’accès" aide="Ouvert, il le reste toute la séance : le même code vaut pour un retardataire.">
        <span className={`pm-etat${info?.inviteOpen ? ' on' : ''}`}>
          {info?.inviteOpen ? (info.url ?? 'ouvert').replace('http://', '') : 'fermé'}
        </span>
        {info?.inviteOpen ? (
          <button
            className="btn btn-sm btn-danger"
            onClick={async () => s.setMobile(await window.jdr.mobile.closeInvite())}
          >
            Fermer l’accès
          </button>
        ) : (
          <button
            className="btn btn-sm"
            onClick={async () => {
              setErreur(null)
              try {
                s.setMobile((await window.jdr.mobile.open()).info)
              } catch (e) {
                setErreur(e instanceof Error ? e.message : String(e))
              }
            }}
          >
            Ouvrir l’accès
          </button>
        )}
      </Ligne>
      {erreur ? <p className="pm-erreur">{erreur}</p> : null}

      <Ligne
        nom="Port du serveur"
        aide="Un port déjà pris par un autre logiciel se change ici. Les téléphones devront viser la nouvelle adresse."
      >
        <input
          type="number"
          min={1024}
          max={65535}
          style={{ width: 96 }}
          defaultValue={s.poste.port}
          aria-label="Port du serveur"
          onBlur={async (e) => {
            await s.poserPoste('portable.port', Number(e.target.value))
            await s.refreshMobile()
          }}
        />
      </Ligne>

      <Ligne
        nom="Adresse annoncée"
        aide="Sur un poste à deux réseaux, le QR code ne peut en porter qu’un."
      >
        <select
          value={s.poste.adresse ?? ''}
          onChange={async (e) => {
            await s.poserPoste('portable.adresse', e.target.value || null)
            await s.refreshMobile()
          }}
        >
          <option value="">Choisir toute seule{info?.adresse ? ` (${info.adresse})` : ''}</option>
          {(info?.adresses ?? []).map((a) => (
            <option key={a.ip} value={a.ip}>
              {a.ip} · {a.nom}
            </option>
          ))}
        </select>
      </Ligne>

      <Ligne nom="Appareils par joueur" aide="Un portable et une tablette, par exemple.">
        <input
          type="number"
          min={1}
          max={8}
          style={{ width: 74 }}
          defaultValue={s.poste.appareils}
          aria-label="Appareils par joueur"
          onBlur={async (e) => {
            await s.poserPoste('portable.appareils', Number(e.target.value))
            await s.refreshMobile()
          }}
        />
      </Ligne>

      <Bloc titre="Appareils appairés">
        {!info || info.devices.length === 0 ? (
          <p className="pm-aparte">Personne encore.</p>
        ) : (
          <div className="pm-liste">
            {info.devices.map((d) => (
              <div className={`pm-lig c-${d.playerColor ?? 'neutral'}`} key={d.id}>
                <span className="pip teinte" />
                {d.playerName}
                <span className={`pm-etat${d.online ? ' on' : ''}`}>
                  {d.online ? 'en ligne' : 'hors ligne'}
                </span>
                <div className="spacer" />
                <button
                  className="btn btn-sm btn-ghost btn-danger"
                  title="Cet appareil devra rescanner le code"
                  onClick={async () => s.setMobile(await window.jdr.mobile.revoke(d.id))}
                >
                  <IconTrash />
                  Révoquer
                </button>
              </div>
            ))}
          </div>
        )}
      </Bloc>
    </>
  )
}

/* ============================================================
   6. Le poste
   ============================================================ */

function Poste(): JSX.Element {
  const s = useStore()

  return (
    <>
      <Tete
        titre="Le poste"
        quoi="Ce qui te suit d’une campagne à l’autre. Les campagnes récentes, le carnet de joueurs et le catalogue de briques sont dans le menu Campagne : ce sont des gestes, pas des réglages."
      />

      <Ligne nom="Thème" aide="Une table de jeu est une pièce sombre — mais on prépare une séance en plein jour.">
        <Seg
          valeur={s.poste.theme}
          choix={[
            { k: 'sombre' as const, label: 'Sombre' },
            { k: 'clair' as const, label: 'Clair' }
          ]}
          onChoisir={(k) => void s.poserPoste('theme', k)}
        />
      </Ligne>

      <Ligne
        nom="Rouvrir la dernière campagne au démarrage"
        aide="Décoché, l’application ouvre l’accueil et te laisse choisir."
      >
        <input
          type="checkbox"
          checked={s.poste.rouvrir}
          aria-label="Rouvrir la dernière campagne au démarrage"
          onChange={(e) => void s.poserPoste('demarrage.rouvrir', e.target.checked)}
        />
      </Ligne>

      <Ligne
        nom="Dossier de données"
        aide="Le carnet de joueurs, le catalogue et la liste des récentes vivent là."
        pleine
      >
        <div className="pm-chemin">
          <code>{s.project ? '…' : ''}application.db</code>
          <div className="spacer" />
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => void window.jdr.app.openDataFolder()}
          >
            Ouvrir le dossier
          </button>
        </div>
      </Ligne>
    </>
  )
}

/* ============================================================
   7. Raccourcis
   ============================================================ */

const TOUCHES: { touches: string[]; quoi: string; ou: string }[] = [
  { touches: ['F5'], quoi: 'Ouvrir ou fermer l’écran des joueurs', ou: 'partout' },
  { touches: ['Ctrl', 'B'], quoi: 'Voile noir', ou: 'partout' },
  {
    touches: ['Ctrl', 'Alt', 'B'],
    quoi: 'Voile noir, même quand la fenêtre n’a pas la main',
    ou: 'système'
  },
  { touches: ['Ctrl', 'K'], quoi: 'Aller à la recherche', ou: 'partout' },
  { touches: ['P'], quoi: 'Le pointeur — ou Ctrl maintenu, le temps d’un geste', ou: 'Régie' },
  { touches: ['Suppr'], quoi: 'Effacer le trait choisi', ou: 'Murs' },
  { touches: ['Échap'], quoi: 'Refermer un menu, une fenêtre, un outil armé', ou: 'partout' },
  { touches: ['Ctrl', 'N'], quoi: 'Nouvelle campagne', ou: 'menu Fichier' },
  { touches: ['Ctrl', 'O'], quoi: 'Ouvrir une campagne', ou: 'menu Fichier' }
]

function Touches(): JSX.Element {
  return (
    <>
      <Tete
        titre="Raccourcis"
        quoi="Ils n’existaient que dans des info-bulles. En lecture seule pour l’instant — les rendre modifiables est un autre chantier."
      />
      <table className="pm-touches">
        <thead>
          <tr>
            <th>Touche</th>
            <th>Ce qu’elle fait</th>
            <th>Où</th>
          </tr>
        </thead>
        <tbody>
          {TOUCHES.map((t) => (
            <tr key={t.touches.join('+')}>
              <td>
                {t.touches.map((k) => (
                  <kbd key={k}>{k}</kbd>
                ))}
              </td>
              <td>{t.quoi}</td>
              <td className="ou">{t.ou}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
