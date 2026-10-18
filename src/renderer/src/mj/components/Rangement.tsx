/**
 * Ranger après la partie : la corbeille, et le retour de chaque exemplaire à
 * son emplacement initial — le lieu, le sac, l'inventaire où on l'avait posé
 * en préparant.
 *
 * Un exemplaire qu'on retire du sac d'un joueur ne disparaît plus : il part à
 * la corbeille, d'où on peut le ranger, ou le supprimer pour de bon. Tout ce
 * qui touche à la corbeille ou remet des objets en place passe par une
 * confirmation : le geste défait ce que la table a fait.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { IconChevron, IconCoffre, IconPeople, IconPlace, IconRetour, IconTrash } from './Icons'
import { TYPE_EXEMPLAIRE } from './BandeJoueurs'
import { Pop } from './Pop'
import { nomEmplacement } from '@shared/types'
import type { EmplacementInitial, Objet, ObjetPlacement, PortObjet } from '@shared/types'
import { useEchap } from '../echap'

/* ---------------- dire où ---------------- */

const MOT: Record<PortObjet, string> = {
  lieu: '',
  pnj: 'Butin de ',
  pj: 'Sac de ',
  inventaire: 'Dans ',
  corbeille: ''
}

/** « Sac de Marie », « Salon », « Dans Camion », « Corbeille ». */
export function ditOu(port: PortObjet, cible: string, emplacement?: string | null): string {
  if (port === 'corbeille') return 'Corbeille'
  if (emplacement && (port === 'pj' || port === 'pnj')) return `${cible} · ${nomEmplacement(emplacement)}`
  return `${MOT[port]}${cible}`
}

export function ditInitial(ini: EmplacementInitial | null): string {
  return ini ? ditOu(ini.port, ini.cible, ini.emplacement) : 'emplacement initial perdu'
}

function IconePort({ port }: { port: PortObjet }): JSX.Element {
  if (port === 'lieu') return <IconPlace />
  if (port === 'corbeille') return <IconTrash />
  if (port === 'inventaire') return <IconCoffre />
  return <IconPeople />
}

/** Les exemplaires remis ailleurs que là où on les avait rangés — corbeille comprise. */
export function deplaces(objets: Objet[]): { o: Objet; p: ObjetPlacement }[] {
  return objets
    .flatMap((o) => [...o.placements, ...o.corbeille].filter((p) => p.deplace).map((p) => ({ o, p })))
    .sort((a, b) => a.o.nom.localeCompare(b.o.nom, 'fr'))
}

/* ---------------- filtrer l'étagère par emplacement actuel ---------------- */

/** Où sont ses exemplaires, en clés : `lieu:12`, `pj:5`, `corbeille`… ; `reserve` s'il n'est nulle part. */
export function clesOu(o: Objet): string[] {
  const cles = o.placements.map((p) => `${p.port}:${p.placeId ?? p.characterId ?? p.inventaireId}`)
  if (o.corbeille.length) cles.push('corbeille')
  return cles.length ? cles : ['reserve']
}

const GROUPES: { port: PortObjet; titre: string }[] = [
  { port: 'lieu', titre: 'Dans un lieu' },
  { port: 'pj', titre: 'Dans le sac de' },
  { port: 'pnj', titre: 'Sur un PNJ' },
  { port: 'inventaire', titre: 'Dans un inventaire' }
]

/**
 * « Emplacement » à droite de la recherche : on coche un ou plusieurs
 * endroits, l'étagère ne garde que les objets qui y ont un exemplaire. Ne
 * sont proposés que les endroits qui contiennent quelque chose.
 */
export function FiltreEmplacement({
  choisis,
  onChange
}: {
  choisis: Set<string>
  onChange: (v: Set<string>) => void
}): JSX.Element {
  const s = useStore()
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)

  /* Chaque endroit, son nom et combien d'objets y ont un exemplaire. */
  const endroits = useMemo(() => {
    const m = new Map<string, { port: PortObjet | 'reserve'; nom: string; n: number }>()
    const compte = (cle: string, port: PortObjet | 'reserve', nom: string): void => {
      const e = m.get(cle)
      if (e) e.n++
      else m.set(cle, { port, nom, n: 1 })
    }
    for (const o of s.objets) {
      const vus = new Set<string>()
      for (const p of o.placements) {
        const cle = `${p.port}:${p.placeId ?? p.characterId ?? p.inventaireId}`
        if (!vus.has(cle)) compte(cle, p.port, p.cible)
        vus.add(cle)
      }
      if (o.corbeille.length) compte('corbeille', 'corbeille', 'Corbeille')
      if (!o.placements.length && !o.corbeille.length) compte('reserve', 'reserve', 'Posé nulle part')
    }
    return m
  }, [s.objets])

  const basculer = (cle: string): void => {
    const v = new Set(choisis)
    if (v.has(cle)) v.delete(cle)
    else v.add(cle)
    onChange(v)
  }
  const ligne = (cle: string, nom: string, n: number): JSX.Element => (
    <label key={cle} className="opt">
      <input type="checkbox" checked={choisis.has(cle)} onChange={() => basculer(cle)} />
      <span className="t">{nom}</span>
      <span className="n num">{n}</span>
    </label>
  )
  const actifs = [...choisis].filter((c) => endroits.has(c)).length

  return (
    <>
      <button
        className={`btn btn-sm rgm-filtre${actifs ? ' btn-on' : ''}`}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          setMenu({ x: r.left, y: r.bottom + 4 })
        }}
        title="Ne montrer que les objets qui se trouvent à certains endroits"
      >
        <IconPlace />
        Emplacement
        {actifs ? <span className="rgm-badge num">{actifs}</span> : null}
      </button>
      {menu ? (
        <Pop x={menu.x} y={menu.y} className="menu-donner rgm-menu rgm-filtre-menu" onClose={() => setMenu(null)}>
          <span className="eyebrow">Emplacement actuel</span>
          {actifs ? (
            <button className="opt rgm-effacer" onClick={() => onChange(new Set())}>
              <span className="t">Tout décocher</span>
            </button>
          ) : null}
          {endroits.size === 0 ? <p className="pop-rien">Aucun objet.</p> : null}
          {GROUPES.map((g) => {
            const liste = [...endroits.entries()]
              .filter(([, e]) => e.port === g.port)
              .sort((a, b) => a[1].nom.localeCompare(b[1].nom, 'fr'))
            if (!liste.length) return null
            return (
              <div key={g.port}>
                <hr />
                <span className="eyebrow">{g.titre}</span>
                {liste.map(([cle, e]) => ligne(cle, e.nom, e.n))}
              </div>
            )
          })}
          {endroits.has('corbeille') || endroits.has('reserve') ? <hr /> : null}
          {endroits.has('corbeille') ? ligne('corbeille', 'Corbeille', endroits.get('corbeille')!.n) : null}
          {endroits.has('reserve') ? ligne('reserve', 'Posé nulle part', endroits.get('reserve')!.n) : null}
        </Pop>
      ) : null}
    </>
  )
}

/* ---------------- choisir l'emplacement de départ ---------------- */

type Cible = Parameters<typeof window.jdr.objets.changerInitial>[1]

/**
 * Où il retournera quand on range : n'importe quel lieu, personnage ou
 * inventaire, choisi à la main. L'exemplaire, lui, ne bouge pas.
 */
function MenuDepart({
  x,
  y,
  p,
  onClose
}: {
  x: number
  y: number
  p: ObjetPlacement
  onClose: () => void
}): JSX.Element {
  const s = useStore()
  const ini = p.initial
  const est = (port: PortObjet, id: number): boolean =>
    !!ini &&
    ini.port === port &&
    (port === 'lieu' ? ini.placeId : port === 'inventaire' ? ini.inventaireId : ini.characterId) === id
  const pjs = s.characters.filter((c) => c.kind !== 'pnj')
  const pnjs = s.characters.filter((c) => c.kind === 'pnj')

  const choisir = async (cible: Cible | 'ici'): Promise<void> => {
    onClose()
    try {
      if (cible === 'ici') await window.jdr.objets.fixerInitial(p.id)
      else await window.jdr.objets.changerInitial(p.id, cible)
      await s.refreshObjets()
    } catch (e) {
      s.toast('L’emplacement de départ n’a pas changé.', true)
      console.error('[depart]', e)
    }
  }
  const opt = (cle: string, on: boolean, libelle: string, cible: Cible, teinte?: string): JSX.Element => (
    <button
      key={cle}
      className={`opt${teinte ? ` c-${teinte}` : ''}${on ? ' on' : ''}`}
      aria-pressed={on}
      onClick={() => void choisir(cible)}
    >
      {teinte ? <span className="pip" /> : null}
      <span className="t">{libelle}</span>
      {on ? <span className="rgm-coche">départ</span> : null}
    </button>
  )

  return (
    <Pop x={x} y={y} className="menu-donner rgm-menu" onClose={onClose}>
      <span className="eyebrow">Emplacement de départ</span>
      {p.port !== 'corbeille' && p.deplace ? (
        <button className="opt" onClick={() => void choisir('ici')}>
          <span className="t">Là où il est : {ditOu(p.port, p.cible, p.emplacement)}</span>
        </button>
      ) : null}
      <Section
        titre="Dans le sac de"
        n={pjs.length}
        depart={ini?.port === 'pj'}
      >
        {pjs.map((c) =>
          opt(`pj${c.id}`, est('pj', c.id), c.name, { port: 'pj', characterId: c.id }, c.color ?? 'neutral')
        )}
      </Section>
      <Section titre="Sur un PNJ" n={pnjs.length} depart={ini?.port === 'pnj'}>
        {pnjs.map((c) =>
          opt(`pnj${c.id}`, est('pnj', c.id), c.name, { port: 'pnj', characterId: c.id }, c.color ?? 'neutral')
        )}
      </Section>
      <Section titre="Dans un lieu — pas découvert" n={s.places.length} depart={ini?.port === 'lieu'}>
        {s.places.map((l) => opt(`l${l.id}`, est('lieu', l.id), l.name, { port: 'lieu', placeId: l.id }))}
      </Section>
      <Section titre="Dans un inventaire" n={s.inventaires.length} depart={ini?.port === 'inventaire'}>
        {s.inventaires.map((i) =>
          opt(`i${i.id}`, est('inventaire', i.id), i.nom, { port: 'inventaire', inventaireId: i.id })
        )}
      </Section>
    </Pop>
  )
}

/**
 * Une rubrique du menu, fermée à l'ouverture : la liste des lieux suffit à
 * remplir l'écran. Son en-tête dit combien elle contient, et si le départ
 * actuel s'y trouve.
 */
function Section({
  titre,
  n,
  depart,
  children
}: {
  titre: string
  n: number
  depart: boolean
  children: ReactNode
}): JSX.Element | null {
  const [ouverte, setOuverte] = useState(false)
  if (n === 0) return null
  return (
    <>
      <hr />
      <button
        className={`rgm-section${ouverte ? ' ouverte' : ''}`}
        aria-expanded={ouverte}
        onClick={() => setOuverte(!ouverte)}
      >
        <IconChevron />
        <span className="t">{titre}</span>
        {depart ? <span className="rgm-coche">départ</span> : null}
        <span className="n num">{n}</span>
      </button>
      {ouverte ? children : null}
    </>
  )
}

/**
 * « départ : Bureau » — se lit sous l'exemplaire, se clique pour le changer.
 * Discret tant qu'il est à sa place, en laiton quand il a bougé.
 */
export function Depart({ p }: { p: ObjetPlacement }): JSX.Element {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const ici = !p.deplace && p.initial
  return (
    <>
      <button
        className={`rgm-depart${ici ? ' ici' : ''}${p.initial ? '' : ' perdu'}`}
        onClick={(e) => {
          e.stopPropagation()
          const r = e.currentTarget.getBoundingClientRect()
          setMenu({ x: r.left, y: r.bottom + 4 })
        }}
        title="Là où « Ranger » le remet — clic pour choisir un autre emplacement de départ"
      >
        {ici ? 'départ : ici' : `départ : ${ditInitial(p.initial)}`}
      </button>
      {menu ? <MenuDepart x={menu.x} y={menu.y} p={p} onClose={() => setMenu(null)} /> : null}
    </>
  )
}

/* ---------------- la confirmation ---------------- */

/** Une petite fenêtre « vraiment ? », par-dessus tout le reste. Échap renonce. */
export function Confirmer({
  titre,
  children,
  oui,
  danger,
  onOui,
  onNon
}: {
  titre: string
  children?: ReactNode
  oui: string
  danger?: boolean
  onOui: () => void | Promise<void>
  onNon: () => void
}): JSX.Element {
  const [occupe, setOccupe] = useState(false)
  useEchap(onNon)
  return (
    <div
      className="scrim par-dessus"
      onClick={(e) => {
        e.stopPropagation()
        onNon()
      }}
    >
      <div className="modal rgm-confirme" onClick={(e) => e.stopPropagation()}>
        <header>
          {danger ? <IconTrash /> : <IconRetour />}
          <h3>{titre}</h3>
        </header>
        {children ? <div className="body">{children}</div> : null}
        <footer>
          <button className="btn btn-sm" onClick={onNon}>
            Annuler
          </button>
          <button
            className={`btn btn-sm ${danger ? 'btn-danger' : 'btn-brass'}`}
            autoFocus
            disabled={occupe}
            onClick={async () => {
              setOccupe(true)
              try {
                await onOui()
              } finally {
                setOccupe(false)
              }
            }}
          >
            {oui}
          </button>
        </footer>
      </div>
    </div>
  )
}

/** Ranger des exemplaires, relire la réserve, dire ce qui n'a pas suivi. */
async function rangerEtRelire(ids: number[]): Promise<void> {
  const s = useStore.getState()
  try {
    const n = await window.jdr.objets.ranger(ids)
    await s.refreshObjets()
    if (n < ids.length)
      s.toast(
        `${ids.length - n} objet${ids.length - n > 1 ? 's n’ont' : ' n’a'} pas pu être rangé${
          ids.length - n > 1 ? 's' : ''
        } : emplacement initial perdu.`,
        true
      )
  } catch (err) {
    s.toast('Le rangement a échoué.', true)
    console.error('[ranger]', err)
  }
}

/* ---------------- la modale « Ranger » ---------------- */

/**
 * Tout ce qui a bougé depuis la préparation, une ligne par exemplaire : où il
 * est, où il retourne. On coche, on range — après confirmation.
 */
export function ModaleRanger({ onClose }: { onClose: () => void }): JSX.Element {
  const s = useStore()
  const liste = useMemo(() => deplaces(s.objets), [s.objets])
  const rangeables = liste.filter((x) => x.p.initial)
  const [pris, setPris] = useState<Set<number>>(() => new Set(rangeables.map((x) => x.p.id)))
  const [confirme, setConfirme] = useState(false)
  useEchap(onClose, !confirme)

  /* Ce qui a été rangé entre-temps quitte la sélection. */
  const choisis = rangeables.filter((x) => pris.has(x.p.id))
  const tout = rangeables.length > 0 && choisis.length === rangeables.length
  const n = choisis.length

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal rgm-modale" onClick={(e) => e.stopPropagation()}>
        <header>
          <IconRetour />
          <h3>Ranger les objets déplacés</h3>
        </header>
        {liste.length === 0 ? (
          <div className="body">
            <p className="rgm-aide">Tout est à sa place : aucun objet n’a quitté son emplacement initial.</p>
          </div>
        ) : (
          <>
            <div className="rgm-tete">
              <label className="rgm-tout">
                <input
                  type="checkbox"
                  checked={tout}
                  disabled={rangeables.length === 0}
                  onChange={() => setPris(tout ? new Set() : new Set(rangeables.map((x) => x.p.id)))}
                />
                Tout cocher
              </label>
              <span className="rgm-aide">
                {liste.length} déplacé{liste.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="rgm-lignes">
              {liste.map(({ o, p }) => (
                <label key={p.id} className={`rgm-ligne${p.initial ? '' : ' perdu'}`}>
                  <input
                    type="checkbox"
                    disabled={!p.initial}
                    checked={!!p.initial && pris.has(p.id)}
                    onChange={(e) => {
                      const m = new Set(pris)
                      if (e.target.checked) m.add(p.id)
                      else m.delete(p.id)
                      setPris(m)
                    }}
                  />
                  <span className="rgm-nom">
                    {o.nom}
                    {p.qte > 1 ? <b className="num"> ×{p.qte}</b> : null}
                  </span>
                  <span className={`rgm-ou ${p.port}`} title="Où il est maintenant">
                    <IconePort port={p.port} />
                    <span className="t">{ditOu(p.port, p.cible, p.emplacement)}</span>
                  </span>
                  <span className="rgm-fleche" aria-hidden="true">
                    →
                  </span>
                  <span className="rgm-ou init" title="Où il retourne">
                    {p.initial ? <IconePort port={p.initial.port} /> : null}
                    <span className="t">{ditInitial(p.initial)}</span>
                  </span>
                </label>
              ))}
            </div>
          </>
        )}
        <footer>
          <button className="btn btn-sm" onClick={onClose}>
            Fermer
          </button>
          <button className="btn btn-brass btn-sm" disabled={n === 0} onClick={() => setConfirme(true)}>
            <IconRetour />
            Ranger {n > 0 ? `les ${n} objet${n > 1 ? 's' : ''}` : ''}
          </button>
        </footer>
      </div>
      {confirme ? (
        <Confirmer
          titre={`Ranger ${n} objet${n > 1 ? 's' : ''} ?`}
          oui={`Ranger ${n > 1 ? `les ${n}` : 'l’objet'}`}
          onNon={() => setConfirme(false)}
          onOui={async () => {
            await rangerEtRelire(choisis.map((x) => x.p.id))
            setConfirme(false)
            setPris(new Set())
          }}
        >
          <p className="rgm-aide">
            {n > 1 ? 'Ils retournent' : 'Il retourne'} à {n > 1 ? 'leur' : 'son'} emplacement initial —
            dans leur lieu, pas encore découverts s’ils l’étaient au départ, ou dans le sac et
            l’inventaire où on les avait rangés.
          </p>
        </Confirmer>
      ) : null}
    </div>
  )
}

/* ---------------- la corbeille ---------------- */

/** La corbeille dans la colonne des catégories. On y lâche l'affaire d'un joueur pour la jeter. */
export function BoutonCorbeille({ on, onChoisir }: { on: boolean; onChoisir: () => void }): JSX.Element {
  const s = useStore()
  const [vise, setVise] = useState(false)
  const n = s.objets.reduce((t, o) => t + o.corbeille.length, 0)
  return (
    <button
      className={`fam-btn rgm-btn${on ? ' on' : ''}${vise ? ' vise' : ''}`}
      onClick={onChoisir}
      onDragOver={(e) => {
        const types = Array.from(e.dataTransfer.types)
        if (!types.includes(TYPE_EXEMPLAIRE) && !types.includes('text/plain')) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        if (!vise) setVise(true)
      }}
      onDragLeave={() => setVise(false)}
      onDrop={async (e) => {
        e.preventDefault()
        setVise(false)
        const secours = /^jdr:exemplaire:(\d+)$/.exec(e.dataTransfer.getData('text/plain'))
        const id = Number(e.dataTransfer.getData(TYPE_EXEMPLAIRE)) || Number(secours?.[1] ?? 0)
        if (!id) return
        await window.jdr.objets.jeter(id)
        await s.refreshObjets()
      }}
      title="Ce qu’on a retiré aux joueurs — on peut le ranger ou le supprimer pour de bon"
    >
      <IconTrash />
      <span className="lib">Corbeille</span>
      <span className="n">{n}</span>
    </button>
  )
}

type Demande =
  | { quoi: 'ranger'; ids: number[] }
  | { quoi: 'supprimer'; ids: number[]; nom: string }
  | { quoi: 'vider' }

/** La corbeille au centre, à la place de l'étagère. */
export function VueCorbeille(): JSX.Element {
  const s = useStore()
  const [demande, setDemande] = useState<Demande | null>(null)
  const jetes = s.objets
    .flatMap((o) => o.corbeille.map((p) => ({ o, p })))
    .sort((a, b) => a.o.nom.localeCompare(b.o.nom, 'fr'))
  const rangeables = jetes.filter((x) => x.p.initial)

  return (
    <div className="pane rgm-vue">
      <div className="pane-head">
        <IconTrash />
        <span className="eyebrow">Corbeille</span>
        <span className="compte num">
          {jetes.length === 0 ? 'vide' : `${jetes.length} objet${jetes.length > 1 ? 's' : ''}`}
        </span>
      </div>

      <div className="pane-body">
        <p className="rgm-aide">
          Ce qu’on a retiré du sac d’un joueur atterrit ici. On peut le ranger à son emplacement
          initial, ou le supprimer pour de bon.
        </p>
        {jetes.length === 0 ? (
          <p className="rien-objet">La corbeille est vide.</p>
        ) : (
          <div className="rgm-jetes">
            {jetes.map(({ o, p }) => (
              <div
                key={p.id}
                className={`rgm-jete${o.id === s.currentObjetId ? ' on' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => s.setCurrentObjet(o.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') s.setCurrentObjet(o.id)
                }}
              >
                <span className="rgm-nom">
                  {o.nom}
                  {p.qte > 1 ? <b className="num"> ×{p.qte}</b> : null}
                </span>
                <Depart p={p} />
                <button
                  className="btn btn-sm"
                  disabled={!p.initial}
                  onClick={(e) => {
                    e.stopPropagation()
                    setDemande({ quoi: 'ranger', ids: [p.id] })
                  }}
                  title={p.initial ? `Le remettre : ${ditInitial(p.initial)}` : 'Son emplacement initial a disparu'}
                >
                  <IconRetour />
                  Ranger
                </button>
                <button
                  className="btn btn-sm btn-ghost btn-danger btn-ico"
                  onClick={(e) => {
                    e.stopPropagation()
                    setDemande({ quoi: 'supprimer', ids: [p.id], nom: o.nom })
                  }}
                  title="Le supprimer définitivement"
                  aria-label={`Supprimer ${o.nom} définitivement`}
                >
                  <IconTrash />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="pane-foot rgm-pied">
        <button
          className="btn btn-sm"
          disabled={rangeables.length === 0}
          onClick={() => setDemande({ quoi: 'ranger', ids: rangeables.map((x) => x.p.id) })}
        >
          <IconRetour />
          Tout ranger
        </button>
        <div className="spacer" />
        <button
          className="btn btn-ghost btn-sm btn-danger"
          disabled={jetes.length === 0}
          onClick={() => setDemande({ quoi: 'vider' })}
        >
          <IconTrash />
          Vider la corbeille
        </button>
      </div>

      {demande?.quoi === 'ranger' ? (
        <Confirmer
          titre={
            demande.ids.length > 1 ? `Ranger ${demande.ids.length} objets ?` : 'Ranger cet objet ?'
          }
          oui="Ranger"
          onNon={() => setDemande(null)}
          onOui={async () => {
            await rangerEtRelire(demande.ids)
            setDemande(null)
          }}
        >
          <p className="rgm-aide">
            {demande.ids.length > 1
              ? 'Ils quittent la corbeille et retournent à leur emplacement initial.'
              : `Il quitte la corbeille et retourne : ${ditInitial(
                  jetes.find((x) => x.p.id === demande.ids[0])?.p.initial ?? null
                )}.`}
          </p>
        </Confirmer>
      ) : demande ? (
        <Confirmer
          danger
          titre={demande.quoi === 'vider' ? 'Vider la corbeille ?' : `Supprimer « ${demande.nom} » ?`}
          oui={demande.quoi === 'vider' ? 'Vider' : 'Supprimer'}
          onNon={() => setDemande(null)}
          onOui={async () => {
            if (demande.quoi === 'vider') await window.jdr.objets.viderCorbeille()
            else await window.jdr.objets.supprimerJetes(demande.ids)
            await s.refreshObjets()
            setDemande(null)
          }}
        >
          <p className="rgm-aide">
            {demande.quoi === 'vider'
              ? `Les ${jetes.length} objets de la corbeille disparaissent pour de bon. Les modèles restent dans la réserve.`
              : 'Cet exemplaire disparaît pour de bon. Le modèle reste dans la réserve.'}
          </p>
        </Confirmer>
      ) : null}
    </div>
  )
}
