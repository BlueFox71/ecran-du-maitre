/**
 * Ce que des objets font à une entité — le crucifix qui fait reculer le
 * fantôme, le sel qu'il ne franchit pas, la photo qui ne lui fait rien.
 *
 * Deux côtés :
 *  — **sur sa fiche** (`EffetsObjetsFiche`), le MJ choisit les objets de la
 *    campagne, plusieurs d'un coup, et écrit pour chacun son effet ;
 *  — **au Paravent** (`EffetsObjetsPion`), dans le détail de son pion, les
 *    objets se lisent en vignettes : un clic dit l'effet.
 *
 * Rien de tout cela ne part vers les joueurs.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store'
import { useEchap } from '../echap'
import { Visage } from '../../shared/Visage'
import { IconClose, IconCopier, IconEtincelles, IconPlus, IconSearch } from './Icons'
import type { Character, EffetSurEntite, Objet } from '@shared/types'

function sansAccents(t: string): string {
  return t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('fr-FR')
}

/** La vignette d'un objet : son image cadrée, ou ses initiales sur la teinte de sa famille. */
function ImageObjet({ o }: { o: Objet }): JSX.Element {
  const s = useStore()
  const img = o.imageItemId != null ? s.allItems.find((i) => i.id === o.imageItemId) : undefined
  const famille = s.objetFamilles.find((f) => f.id === o.familleId)
  if (img?.url) return <Visage url={img.url} cadre={o.imageCadre} alt={o.nom} />
  return (
    <span className={`eo-init c-${famille?.teinte ?? 'neutral'}`}>
      {o.nom
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join('')}
    </span>
  )
}

/* ============================================================
   Sur la fiche : choisir les objets, écrire leurs effets
   ============================================================ */

export function EffetsObjetsFiche({ ch }: { ch: Character }): JSX.Element {
  const s = useStore()
  const [effets, setEffets] = useState<EffetSurEntite[]>(ch.data.effetsObjets ?? [])
  const [choix, setChoix] = useState(false)
  const [copie, setCopie] = useState(false)
  const frappe = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* Comme le butin : la liste garde la main pendant la frappe, et ne se
     recale sur la base qu'en changeant de personnage. */
  useEffect(() => setEffets(ch.data.effetsObjets ?? []), [ch.id])
  useEffect(() => () => void (frappe.current && clearTimeout(frappe.current)), [])

  const enregistre = (l: EffetSurEntite[]): void => {
    void window.jdr.characters.setEffetsObjets(ch.id, l).then(() => s.refreshCharacters())
  }
  /** Ajouter, retirer : tout de suite. */
  const pose = (l: EffetSurEntite[]): void => {
    setEffets(l)
    if (frappe.current) clearTimeout(frappe.current)
    enregistre(l)
  }
  /** Écrire : quand la main s'arrête. */
  const tape = (l: EffetSurEntite[]): void => {
    setEffets(l)
    if (frappe.current) clearTimeout(frappe.current)
    frappe.current = setTimeout(() => enregistre(l), 400)
  }

  /* Un objet supprimé de la campagne disparaît d'ici sans bruit. */
  const lignes = effets
    .map((e) => ({ e, o: s.objets.find((o) => o.id === e.objetId) }))
    .filter((x): x is { e: EffetSurEntite; o: Objet } => !!x.o)

  return (
    <section className="sect eo-fiche">
      <div className="sect-tete">
        <span className="eyebrow">Effets des objets</span>
        <span className="pnj-jamais">jamais diffusé</span>
      </div>

      {lignes.length ? (
        <ul className="eo-liste">
          {lignes.map(({ e, o }) => (
            <li key={o.id} className="eo-ligne">
              <span className="eo-vig">
                <ImageObjet o={o} />
              </span>
              <span className="eo-nom" title={o.nom}>
                {o.nom}
              </span>
              <input
                className="eo-effet"
                value={e.effet}
                onChange={(ev) =>
                  tape(effets.map((x) => (x.objetId === o.id ? { ...x, effet: ev.target.value } : x)))
                }
                placeholder="Son effet sur lui…"
                aria-label={`Effet de ${o.nom}`}
              />
              <button
                className="butin-retire"
                onClick={() => pose(effets.filter((x) => x.objetId !== o.id))}
                aria-label={`Retirer ${o.nom}`}
                title="Retirer cet objet"
              >
                <IconClose />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="eo-vide">Aucun objet. Ajoute ceux qui lui font quelque chose — ou rien du tout.</p>
      )}

      <div className="butin-pied">
        <button className="butin-ajout" onClick={() => setChoix(true)}>
          <IconPlus /> ajouter des objets
        </button>
        {lignes.length ? (
          <button className="butin-ajout eo-copier" onClick={() => setCopie(true)}>
            <IconCopier /> copier les effets à…
          </button>
        ) : null}
      </div>

      {copie ? (
        <CopierVers
          source={ch}
          onClose={() => setCopie(false)}
          onCopier={async (cibles) => {
            setCopie(false)
            /* Ce qui est à l'écran, frappe en cours comprise : on copie ce qu'on voit. */
            if (frappe.current) {
              clearTimeout(frappe.current)
              frappe.current = null
              await window.jdr.characters.setEffetsObjets(ch.id, effets)
            }
            const n = await window.jdr.characters.copierEffetsObjets(effets, cibles)
            await s.refreshCharacters()
            s.annoncer(`Effets copiés sur ${n} PNJ — Ctrl+Z pour revenir en arrière.`)
          }}
        />
      ) : null}

      {choix ? (
        <ChoixObjets
          deja={new Set(effets.map((e) => e.objetId))}
          onClose={() => setChoix(false)}
          onAjouter={(ids) => {
            setChoix(false)
            pose([...effets, ...ids.map((objetId) => ({ objetId, effet: '' }))])
          }}
        />
      ) : null}
    </section>
  )
}

/** Choisir les PNJ qui reçoivent ces effets : on coche, on copie. */
function CopierVers({
  source,
  onClose,
  onCopier
}: {
  source: Character
  onClose: () => void
  onCopier: (cibles: number[]) => void
}): JSX.Element {
  const s = useStore()
  useEchap(onClose)
  const [cherche, setCherche] = useState('')
  const [coches, setCoches] = useState<number[]>([])

  const pnj = useMemo(
    () =>
      s.characters
        .filter((c) => c.kind === 'pnj' && c.id !== source.id && !c.horsJeu)
        .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    [s.characters, source.id]
  )
  const mots = sansAccents(cherche).split(/\s+/).filter(Boolean)
  const vus = mots.length
    ? pnj.filter((c) => {
        const cle = sansAccents(`${c.name} ${c.occupation ?? ''}`)
        return mots.every((m) => cle.includes(m))
      })
    : pnj
  const basculer = (id: number): void =>
    setCoches((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))
  const tousVus = vus.length > 0 && vus.every((c) => coches.includes(c.id))

  return createPortal(
    <div className="scrim" onClick={onClose}>
      <div className="modal eo-copie" onClick={(e) => e.stopPropagation()}>
        <header>
          <h3>Copier les effets de {source.name}</h3>
          <button className="btn btn-sm btn-ghost eo-fermer" onClick={onClose} aria-label="Fermer" title="Fermer — Échap">
            <IconClose />
          </button>
        </header>
        <label className="galerie-cherche">
          <IconSearch />
          <input
            autoFocus
            type="search"
            value={cherche}
            onChange={(e) => setCherche(e.target.value)}
            placeholder="Chercher un PNJ…"
          />
        </label>
        <div className="eo-copie-liste">
          {vus.length ? (
            <>
              <label className="eo-copie-ligne eo-copie-tous">
                <input
                  type="checkbox"
                  checked={tousVus}
                  onChange={() =>
                    setCoches((c) =>
                      tousVus
                        ? c.filter((id) => !vus.some((v) => v.id === id))
                        : [...new Set([...c, ...vus.map((v) => v.id)])]
                    )
                  }
                />
                <span>Tous{mots.length ? ' ceux-là' : ''}</span>
              </label>
              {vus.map((c) => {
                const deja = (c.data.effetsObjets ?? []).length
                return (
                  <label key={c.id} className="eo-copie-ligne">
                    <input type="checkbox" checked={coches.includes(c.id)} onChange={() => basculer(c.id)} />
                    <span className="eo-copie-nom">
                      {c.name}
                      {c.occupation ? <em>{c.occupation}</em> : null}
                    </span>
                    {deja ? (
                      <span className="eo-copie-deja" title="Ses objets restent ; un objet en commun prend l’effet copié">
                        {deja} objet{deja > 1 ? 's' : ''} déjà
                      </span>
                    ) : null}
                  </label>
                )
              })}
            </>
          ) : (
            <p className="galerie-rien">{pnj.length ? 'Aucun PNJ ne correspond.' : 'Aucun autre PNJ dans la campagne.'}</p>
          )}
        </div>
        <footer>
          <span className="eo-copie-aide">Leurs objets restent ; un objet en commun prend l’effet copié.</span>
          <button className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-brass" disabled={!coches.length} onClick={() => onCopier(coches)}>
            {coches.length ? `Copier sur ${coches.length} PNJ` : 'Copier'}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  )
}

/** Choisir plusieurs objets de la campagne d'un coup : on coche, on ajoute. */
function ChoixObjets({
  deja,
  onClose,
  onAjouter
}: {
  deja: Set<number>
  onClose: () => void
  onAjouter: (ids: number[]) => void
}): JSX.Element {
  const s = useStore()
  useEchap(onClose)
  const [cherche, setCherche] = useState('')
  const [coches, setCoches] = useState<number[]>([])

  const libres = useMemo(
    () => s.objets.filter((o) => !deja.has(o.id)).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
    [s.objets, deja]
  )
  const mots = sansAccents(cherche).split(/\s+/).filter(Boolean)
  const vus = mots.length
    ? libres.filter((o) => {
        const famille = s.objetFamilles.find((f) => f.id === o.familleId)?.nom ?? ''
        const cle = sansAccents(`${o.nom} ${famille}`)
        return mots.every((m) => cle.includes(m))
      })
    : libres

  const basculer = (id: number): void =>
    setCoches((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))

  return createPortal(
    <div className="scrim" onClick={onClose}>
      <div className="modal eo-choix" onClick={(e) => e.stopPropagation()}>
        <header>
          <h3>Ajouter des objets</h3>
          <button className="btn btn-sm btn-ghost eo-fermer" onClick={onClose} aria-label="Fermer" title="Fermer — Échap">
            <IconClose />
          </button>
        </header>
        <label className="galerie-cherche">
          <IconSearch />
          <input
            autoFocus
            type="search"
            value={cherche}
            onChange={(e) => setCherche(e.target.value)}
            placeholder="Chercher un objet ou une catégorie…"
          />
        </label>
        <div className="eo-grille">
          {vus.length ? (
            vus.map((o) => {
              const on = coches.includes(o.id)
              return (
                <button
                  key={o.id}
                  className={`eo-carte${on ? ' on' : ''}`}
                  aria-pressed={on}
                  onClick={() => basculer(o.id)}
                  title={o.nom}
                >
                  <span className="eo-carte-img">
                    <ImageObjet o={o} />
                    {on ? <span className="eo-coche">✓</span> : null}
                  </span>
                  <span className="eo-carte-nom">{o.nom}</span>
                </button>
              )
            })
          ) : (
            <p className="galerie-rien">
              {libres.length ? 'Aucun objet ne correspond.' : 'Tous les objets de la campagne sont déjà là.'}
            </p>
          )}
        </div>
        <footer>
          <button className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-brass" disabled={!coches.length} onClick={() => onAjouter(coches)}>
            {coches.length ? `Ajouter ${coches.length} objet${coches.length > 1 ? 's' : ''}` : 'Ajouter'}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  )
}

/* ============================================================
   Au Paravent : les objets en vignettes, un clic dit l'effet
   ============================================================ */

export function EffetsObjetsPion({ ch }: { ch: Character }): JSX.Element | null {
  const s = useStore()
  const [vu, setVu] = useState<number | null>(null)
  useEffect(() => setVu(null), [ch.id])

  const lignes = (ch.data.effetsObjets ?? [])
    .map((e) => ({ e, o: s.objets.find((o) => o.id === e.objetId) }))
    .filter((x): x is { e: EffetSurEntite; o: Objet } => !!x.o)
  if (!lignes.length) return null
  const choisi = lignes.find((x) => x.o.id === vu) ?? null

  return (
    <section>
      <span className="eyebrow">Effets des objets</span>
      <div className="eo-pion-grille">
        {lignes.map(({ o }) => (
          <button
            key={o.id}
            className={`eo-pion-vig${vu === o.id ? ' on' : ''}`}
            aria-pressed={vu === o.id}
            onClick={() => setVu((v) => (v === o.id ? null : o.id))}
            title={o.nom}
          >
            <ImageObjet o={o} />
          </button>
        ))}
      </div>
      {choisi ? (
        <div className="eo-pion-effet">
          <b>{choisi.o.nom}</b>
          <span className={choisi.e.effet.trim() ? '' : 'eo-pion-rien'}>
            {choisi.e.effet.trim() || 'Aucun effet écrit — à remplir sur sa fiche.'}
          </span>
        </div>
      ) : (
        <p className="dp-vide">Clique un objet pour lire son effet.</p>
      )}
    </section>
  )
}

/* ============================================================
   Ce qu'un objet fait aux PNJ, lu depuis l'objet
   ============================================================ */

/** Les PNJ (en jeu) dont la fiche donne à cet objet un effet écrit, triés par nom. */
export function effetsSurPnj(
  characters: Character[],
  objetId: number
): { id: number; nom: string; effet: string }[] {
  return characters
    .filter((c) => c.kind === 'pnj' && !c.horsJeu)
    .flatMap((c) =>
      (c.data.effetsObjets ?? [])
        .filter((e) => e.objetId === objetId && e.effet.trim())
        .map((e) => ({ id: c.id, nom: c.name, effet: e.effet.trim() }))
    )
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
}

/** La liste dépliée : un PNJ, son effet. */
/**
 * La liste dépliée. Les PNJ qui ont **le même effet** (au mot près, sans
 * compter majuscules et espaces) partagent une seule ligne : leurs visages
 * côte à côte, leurs noms, puis l'effet une seule fois — dix fois « elle
 * recule » ne disaient rien de plus qu'une.
 */
export function ListeEffetsPnj({ effets }: { effets: { id: number; nom: string; effet: string }[] }): JSX.Element {
  const s = useStore()
  const groupes = new Map<string, { effet: string; qui: { id: number; nom: string }[] }>()
  for (const e of effets) {
    const cle = e.effet.replace(/\s+/g, ' ').trim().toLocaleLowerCase('fr-FR')
    const g = groupes.get(cle)
    if (g) g.qui.push({ id: e.id, nom: e.nom })
    else groupes.set(cle, { effet: e.effet, qui: [{ id: e.id, nom: e.nom }] })
  }
  /* Le plus partagé d'abord : c'est la règle ; les cas à part viennent après. */
  const lignes = [...groupes.values()].sort((a, b) => b.qui.length - a.qui.length)
  return (
    <ul className="os-effets-liste">
      {lignes.map((g) => (
        <li key={g.qui.map((q) => q.id).join('-')}>
          <span className="oe-qui">
            <span className="oe-visages">
              {g.qui.map((q) => (
                <VisagePnj key={q.id} ch={s.characters.find((c) => c.id === q.id)} nom={q.nom} />
              ))}
            </span>
            <b>{g.qui.map((q) => q.nom).join(', ')}</b>
          </span>
          <span className="oe-effet">{g.effet}</span>
        </li>
      ))}
    </ul>
  )
}

/** Le visage d'un PNJ, en pastille : son portrait cadré, ou ses initiales à sa couleur. */
function VisagePnj({ ch, nom }: { ch: Character | undefined; nom: string }): JSX.Element {
  const s = useStore()
  const img = ch?.portraitItemId != null ? s.allItems.find((i) => i.id === ch.portraitItemId) : undefined
  return (
    <span className={`oe-visage c-${ch?.color ?? 'neutral'}`} title={nom}>
      {img?.url ? (
        <Visage url={img.url} cadre={ch?.portraitCadre} alt={nom} />
      ) : (
        nom
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((w) => w[0]?.toUpperCase())
          .join('')
      )}
    </span>
  )
}

/**
 * Le bouton « effets » d'un objet, et sa liste quand on l'ouvre. Rien quand
 * aucun PNJ n'a d'effet écrit pour lui. Il prend toute la largeur de sa ligne
 * (`os-effets`), pour passer dessous.
 */
export function BoutonEffetsPnj({ objetId, libelle = 'effets' }: { objetId: number; libelle?: string }): JSX.Element | null {
  const s = useStore()
  const [ouvert, setOuvert] = useState(false)
  const effets = effetsSurPnj(s.characters, objetId)
  if (!effets.length) return null
  return (
    <div className="os-effets">
      <button
        className={`os-effets-bouton${ouvert ? ' on' : ''}`}
        aria-expanded={ouvert}
        title={
          ouvert
            ? `Masquer les ${libelle}`
            : `Ce que cet objet fait à ${effets.length} PNJ — écrit sur leurs fiches`
        }
        aria-label={ouvert ? `Masquer les ${libelle}` : `Voir les ${libelle} (${effets.length})`}
        onClick={() => setOuvert((v) => !v)}
      >
        <IconEtincelles />
        <span className="num">{effets.length}</span>
      </button>
      {ouvert ? <ListeEffetsPnj effets={effets} /> : null}
    </div>
  )
}
