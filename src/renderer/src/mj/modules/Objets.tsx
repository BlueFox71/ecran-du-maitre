/**
 * La réserve de la campagne : ce qui se trouve, se ramasse, se porte.
 *
 * **Un modèle, des exemplaires.** On décrit la lanterne une fois — ce qu'on en
 * voit, ce qu'elle fait, ce qu'elle pèse — puis on la pose autant de fois qu'on
 * veut : dans un lieu, sur un PNJ, dans le sac d'un joueur. Corriger sa
 * description corrige toutes celles qui traînent dans la campagne, et c'est
 * tout l'intérêt : le MJ n'écrit pas seize fois la même lanterne.
 *
 * Trois colonnes, hauteur fixe, chacune qui défile chez elle : les rayons,
 * l'étagère, la fiche de l'objet ouvert.
 *
 * Ce que le MJ sait d'un objet **ne sort jamais** : ce module n'appelle aucun
 * canal de diffusion, exactement comme les annotations et les murs.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { currentObjet, itemById, useStore } from '../store'
import {
  IconClose,
  IconCoffre,
  IconDonner,
  IconImage,
  IconPlus,
  IconPoser,
  IconSearch,
  IconSliders,
  IconTrash,
  glypheObjet
} from '../components/Icons'
import { ChoixDansArbre } from '../components/ChoixDansArbre'
import { Pop } from '../components/Pop'
import { MenuDonner } from '../components/MenuDonner'
import { BandeJoueurs, TYPE_OBJET } from '../components/BandeJoueurs'
import { EMPLACEMENTS_OBJET, GLYPHES_OBJET, PION_COULEURS, emplacementsDe } from '@shared/types'
import type {
  EffetObjet,
  GlypheObjet,
  Objet,
  ObjetFamille,
  ObjetPlacement,
  PortObjet
} from '@shared/types'

/** Le rayon des objets qu'aucune famille ne réclame. */
const SANS_FAMILLE = -1


/* ============================================================
   La vue
   ============================================================ */

export function Objets(): JSX.Element {
  const s = useStore()
  const o = currentObjet(s)
  const [rayon, setRayon] = useState<number | 'tout'>('tout')
  const [filtre, setFiltre] = useState('')
  const [enListe, setEnListe] = useState(false)
  const [reglages, setReglages] = useState<{ x: number; y: number } | null>(null)
  const rafale = useRef<HTMLInputElement>(null)

  /* Le rayon suit l'objet qu'on ouvre depuis « Tout » ? Non : on trie
     l'étagère, on ne la fait pas sauter sous la main. Seul un rayon devenu
     vide — sa famille retirée — ramène à « Tout ». */
  useEffect(() => {
    if (rayon === 'tout' || rayon === SANS_FAMILLE) return
    if (!s.objetFamilles.some((f) => f.id === rayon)) setRayon('tout')
  }, [s.objetFamilles, rayon])

  const mot = filtre.trim().toLowerCase()
  const visibles = useMemo(
    () =>
      s.objets.filter(
        (x) =>
          (rayon === 'tout' ||
            (rayon === SANS_FAMILLE ? x.familleId == null : x.familleId === rayon)) &&
          (mot === '' || x.nom.toLowerCase().includes(mot))
      ),
    [s.objets, rayon, mot]
  )

  const creer = async (nom: string): Promise<void> => {
    const neuf = await window.jdr.objets.add({
      nom,
      familleId: rayon === 'tout' || rayon === SANS_FAMILLE ? null : rayon
    })
    await s.refreshObjets()
    s.setCurrentObjet(neuf.id)
  }

  return (
    <section className="view objview">
      <div className="vhead">
        <div>
          <h2>Objets</h2>
          <p>
            Ce que la campagne contient de matériel. Un objet se décrit une fois&nbsp;; on le pose
            ensuite autant de fois qu’on veut — dans un lieu, sur un PNJ, dans un sac.
          </p>
        </div>
        <div className="spacer" />
        <button
          className="btn btn-sm"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            setReglages({ x: r.left, y: r.bottom + 6 })
          }}
          title="Les rayons de la réserve, et l’unité de valeur de la campagne"
        >
          <IconSliders />
          Réglages
        </button>
        <button className="btn btn-brass btn-sm" onClick={() => rafale.current?.focus()}>
          <IconPlus />
          Nouvel objet
        </button>
      </div>

      <div className="obj-shell">
        {/* ---------------- les rayons ---------------- */}
        <div className="pane">
          <div className="pane-head">
            <span className="eyebrow">Familles</span>
          </div>
          <div className="pane-body">
            <button
              className={`fam-btn${rayon === 'tout' ? ' on' : ''}`}
              onClick={() => setRayon('tout')}
            >
              <span className="pastille tout" />
              <span className="lib">Tout</span>
              <span className="n">{s.objets.length}</span>
            </button>
            <div className="fam-sep" />
            {s.objetFamilles.map((f) => (
              <button
                key={f.id}
                className={`fam-btn${rayon === f.id ? ' on' : ''}`}
                onClick={() => setRayon(f.id)}
              >
                <span className={`pastille c-${f.teinte}`} />
                <span className="lib">{f.nom}</span>
                <span className="n">{s.objets.filter((x) => x.familleId === f.id).length}</span>
              </button>
            ))}
            {/* Les objets qu'aucun rayon ne réclame : ils existent, ils doivent
                se retrouver, sans quoi une famille retirée les enterrerait. */}
            {s.objets.some((x) => x.familleId == null) ? (
              <>
                <div className="fam-sep" />
                <button
                  className={`fam-btn${rayon === SANS_FAMILLE ? ' on' : ''}`}
                  onClick={() => setRayon(SANS_FAMILLE)}
                  title="Les objets qui n’ont pas de famille"
                >
                  <span className="pastille" />
                  <span className="lib">Sans famille</span>
                  <span className="n">{s.objets.filter((x) => x.familleId == null).length}</span>
                </button>
              </>
            ) : null}
          </div>
        </div>

        {/* ---------------- l'étagère ---------------- */}
        <div className="pane">
          <div className="pane-head">
            <label className="filtre-inline">
              <IconSearch />
              <input
                type="text"
                value={filtre}
                onChange={(e) => setFiltre(e.target.value)}
                placeholder="Filtrer les objets"
                aria-label="Filtrer les objets"
              />
            </label>
            <span className="compte num">
              {visibles.length === 0
                ? 'aucun objet'
                : `${visibles.length} objet${visibles.length > 1 ? 's' : ''}`}
            </span>
            <div className="spacer" />
            <div className="seg" role="group" aria-label="Grille ou liste">
              <button className={enListe ? '' : 'on'} onClick={() => setEnListe(false)}>
                Grille
              </button>
              <button className={enListe ? 'on' : ''} onClick={() => setEnListe(true)}>
                Liste
              </button>
            </div>
          </div>

          <div className="pane-body">
            {s.objets.length === 0 ? (
              <div className="empty">
                <IconCoffre />
                <b>La réserve est vide</b>
                Tape un nom en bas de l’étagère&nbsp;: l’objet existe aussitôt, sa fiche s’ouvre à
                droite pour le décrire.
              </div>
            ) : visibles.length === 0 ? (
              <p className="rien-objet">
                Rien sous ce filtre. Tape un nom en bas pour en créer un ici.
              </p>
            ) : enListe ? (
              <ListeObjets objets={visibles} familles={s.objetFamilles} unite={s.uniteValeur} />
            ) : (
              <GrilleObjets objets={visibles} familles={s.objetFamilles} />
            )}
          </div>

          <div className="pane-foot">
            {/* Créer en rafale, comme les lieux : un nom, Entrée, et le champ
                reste sous la main pour le suivant. */}
            <div className="rafale">
              <IconPlus />
              <input
                ref={rafale}
                type="text"
                placeholder="Un objet de plus — tape son nom"
                aria-label="Créer un objet"
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  const nom = e.currentTarget.value.trim()
                  if (!nom) return
                  e.currentTarget.value = ''
                  void creer(nom)
                }}
              />
              <span className="aide">Entrée</span>
            </div>
          </div>
        </div>

        {/* ---------------- la fiche ---------------- */}
        {o ? (
          <FicheObjet key={o.id} o={o} />
        ) : (
          <div className="pane">
            <div className="pane-head">
              <span className="eyebrow">La fiche de l’objet</span>
            </div>
            <div className="pane-body">
              <p className="rien-objet">Choisis un objet sur l’étagère.</p>
            </div>
          </div>
        )}
      </div>

      {/* Au pied de la réserve, qui possède quoi — et où on lâche ce qu'on
          leur donne. */}
      <BandeJoueurs />

      {reglages ? (
        <PanneauReglages x={reglages.x} y={reglages.y} onClose={() => setReglages(null)} />
      ) : null}
    </section>
  )
}

/* ============================================================
   L'étagère
   ============================================================ */

function vignetteObjet(o: Objet, familles: ObjetFamille[]): JSX.Element {
  const s = useStore.getState()
  const f = familles.find((x) => x.id === o.familleId) ?? null
  const img = itemById(s.allItems, o.imageItemId)
  const url = img?.poster ?? img?.url ?? null
  if (url) return <img src={url} alt="" />
  return glypheObjet(f?.glyphe ?? 'outils', 'glyphe')
}

function GrilleObjets({
  objets,
  familles
}: {
  objets: Objet[]
  familles: ObjetFamille[]
}): JSX.Element {
  const s = useStore()
  return (
    <div className="etagere">
      {objets.map((o) => {
        const f = familles.find((x) => x.id === o.familleId) ?? null
        const n = o.placements.reduce((t, p) => t + p.qte, 0)
        return (
          <button
            key={o.id}
            className={`obj-carte${o.id === s.currentObjetId ? ' on' : ''}`}
            onClick={() => s.setCurrentObjet(o.id)}
            /* On l'attrape pour le lâcher sur un joueur, en bas. */
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(TYPE_OBJET, String(o.id))
              /* Le même en texte : si le type maison ne survit pas au voyage,
                 la cible sait quand même ce qu'elle reçoit. */
              e.dataTransfer.setData('text/plain', `jdr:objet:${o.id}`)
              e.dataTransfer.effectAllowed = 'copy'
            }}
          >
            <span className={`vignette c-${f?.teinte ?? 'neutral'}`}>
              {vignetteObjet(o, familles)}
              {n > 0 ? <span className="posee num">posé {n}×</span> : null}
              {!o.unique ? <span className="qte num">×{o.qte}</span> : null}
            </span>
            <span className="nom">{o.nom}</span>
            <span className="sous">
              {f?.nom ?? 'sans famille'}
              {o.equipable ? <span className="pt">·</span> : null}
              {o.equipable ? 'se porte' : null}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function ListeObjets({
  objets,
  familles,
  unite
}: {
  objets: Objet[]
  familles: ObjetFamille[]
  unite: string
}): JSX.Element {
  const s = useStore()
  return (
    <div className="liste-objets">
      <div className="liste-tete">
        <span />
        <span className="nm">Objet</span>
        <span className="col">Famille</span>
        <span className="col">Poids</span>
        <span className="col">Valeur · {unite}</span>
        <span className="col">Posé</span>
      </div>
      {objets.map((o) => {
        const f = familles.find((x) => x.id === o.familleId) ?? null
        const n = o.placements.reduce((t, p) => t + p.qte, 0)
        return (
          <button
            key={o.id}
            className={`liste-ligne${o.id === s.currentObjetId ? ' on' : ''}`}
            onClick={() => s.setCurrentObjet(o.id)}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(TYPE_OBJET, String(o.id))
              /* Le même en texte : si le type maison ne survit pas au voyage,
                 la cible sait quand même ce qu'elle reçoit. */
              e.dataTransfer.setData('text/plain', `jdr:objet:${o.id}`)
              e.dataTransfer.effectAllowed = 'copy'
            }}
          >
            <span className={`g c-${f?.teinte ?? 'neutral'}`}>
              {glypheObjet(f?.glyphe ?? 'outils', 'glyphe')}
            </span>
            <span className="nm">{o.nom}</span>
            <span className="col">{f?.nom ?? '—'}</span>
            <span className="col">{o.poids || '—'}</span>
            <span className="col">{o.valeur ?? '—'}</span>
            <span className="col">
              {n > 0
                ? `${n} · ${o.placements.length} endroit${o.placements.length > 1 ? 's' : ''}`
                : '—'}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* ============================================================
   La fiche de l'objet
   ============================================================ */

/**
 * Ce qui se tape attend la fin du mot, ce qui se clique part tout de suite :
 * même règle que le butin d'un PNJ. La fiche garde donc ses champs en état
 * local le temps de la frappe, et se recale quand on change d'objet — d'où la
 * `key` posée par la vue.
 */
function FicheObjet({ o }: { o: Objet }): JSX.Element {
  const s = useStore()
  const [nom, setNom] = useState(o.nom)
  const [poids, setPoids] = useState(o.poids ?? '')
  const [valeur, setValeur] = useState(o.valeur == null ? '' : String(o.valeur))
  const [vu, setVu] = useState(o.vu)
  const [su, setSu] = useState(o.su)
  const [image, setImage] = useState(false)
  const [effetOuvert, setEffetOuvert] = useState<{
    x: number
    y: number
  } | null>(null)
  const [poserOuvert, setPoserOuvert] = useState<{
    x: number
    y: number
  } | null>(null)
  const frappe = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => void (frappe.current && clearTimeout(frappe.current)), [])

  const famille = s.objetFamilles.find((f) => f.id === o.familleId) ?? null

  const enregistre = async (
    patch: Parameters<typeof window.jdr.objets.update>[1]
  ): Promise<void> => {
    await window.jdr.objets.update(o.id, patch)
    await s.refreshObjets()
  }
  /** Un clic : tout de suite. */
  const pose = (patch: Parameters<typeof window.jdr.objets.update>[1]): void => {
    if (frappe.current) clearTimeout(frappe.current)
    void enregistre(patch)
  }
  /** Une frappe : à la fin du mot. */
  const tape = (patch: Parameters<typeof window.jdr.objets.update>[1]): void => {
    if (frappe.current) clearTimeout(frappe.current)
    frappe.current = setTimeout(() => void enregistre(patch), 400)
  }

  const img = itemById(s.allItems, o.imageItemId)
  const urlImage = img?.poster ?? img?.url ?? null
  const totalPose = o.placements.reduce((t, p) => t + p.qte, 0)

  return (
    <div className="pane fiche-objet">
      <div className="pane-head">
        <span className="eyebrow">La fiche de l’objet</span>
        <div className="spacer" />
        <span className="compte num">{totalPose > 0 ? `${totalPose} en jeu` : 'jamais posé'}</span>
      </div>

      <div className="pane-body flush">
        <div className={`fiche-vign c-${famille?.teinte ?? 'neutral'}`}>
          {urlImage ? (
            <img src={urlImage} alt={o.nom} />
          ) : (
            glypheObjet(famille?.glyphe ?? 'outils', 'grand')
          )}
          <button className="changer" onClick={() => setImage(true)}>
            <IconImage />
            {urlImage ? 'changer l’image' : 'une image de la bibliothèque'}
          </button>
        </div>

        {/* ---- identité ---- */}
        <div className="bloc">
          <input
            className="nom-objet"
            value={nom}
            onChange={(e) => {
              setNom(e.target.value)
              tape({ nom: e.target.value })
            }}
            aria-label="Nom de l’objet"
          />
          <div className="champs">
            <label className="champ">
              <span>Famille</span>
              <select
                value={o.familleId ?? ''}
                onChange={(e) =>
                  pose({
                    familleId: e.target.value ? Number(e.target.value) : null
                  })
                }
              >
                <option value="">Sans famille</option>
                {s.objetFamilles.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nom}
                  </option>
                ))}
              </select>
            </label>

            <label className="champ">
              <span>Quantité</span>
              <select
                value={o.unique ? 'unique' : 'pile'}
                onChange={(e) => pose({ unique: e.target.value === 'unique' })}
              >
                <option value="unique">Pièce unique</option>
                <option value="pile">Se compte</option>
              </select>
            </label>

            {!o.unique ? (
              <label className="champ">
                <span>Par défaut</span>
                <input
                  type="number"
                  min={1}
                  value={o.qte}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    if (Number.isNaN(n)) return
                    tape({ qte: Math.max(1, Math.trunc(n)) })
                  }}
                  title="Combien on en pose d’un coup"
                />
              </label>
            ) : null}

            <label className="champ">
              <span>Poids</span>
              <input
                value={poids}
                placeholder="—"
                onChange={(e) => {
                  setPoids(e.target.value)
                  tape({ poids: e.target.value.trim() || null })
                }}
              />
            </label>

            {/* La valeur est un nombre ; l'unité appartient à la campagne et se
                lit en suffixe. On ne retape pas « francs » seize fois, et les
                totaux restent calculables. */}
            <label className="champ">
              <span>Valeur</span>
              <span className="champ-suffixe">
                <input
                  inputMode="decimal"
                  value={valeur}
                  placeholder="—"
                  aria-label={`Valeur en ${s.uniteValeur}`}
                  onChange={(e) => {
                    setValeur(e.target.value)
                    const n = Number(e.target.value.replace(',', '.'))
                    tape({
                      valeur: e.target.value.trim() && Number.isFinite(n) ? n : null
                    })
                  }}
                />
                <span className="unite">{s.uniteValeur}</span>
              </span>
            </label>
          </div>
        </div>

        {/* ---- les deux textes, jamais mélangés ---- */}
        <div className="bloc">
          <div className="bloc-tete">
            <span className="eyebrow">Ce qu’on en voit</span>
            <span className="mention">peut partir dans la Pochette</span>
          </div>
          <textarea
            className="texte-objet"
            value={vu}
            placeholder="Ce que les joueurs ont sous les yeux quand ils le trouvent."
            onChange={(e) => {
              setVu(e.target.value)
              tape({ vu: e.target.value })
            }}
          />
        </div>

        <div className="bloc">
          <div className="bloc-tete">
            <span className="eyebrow">Ce que le MJ sait</span>
            <span className="mention jamais">jamais diffusé</span>
          </div>
          <textarea
            className="texte-objet"
            value={su}
            placeholder="Ce qu’il fait vraiment, d’où il vient, ce qu’il coûte."
            onChange={(e) => {
              setSu(e.target.value)
              tape({ su: e.target.value })
            }}
          />
        </div>

        {/* ---- ce qu'il fait ---- */}
        <div className="bloc">
          <div className="bloc-tete">
            <span className="eyebrow">Ce qu’il fait</span>
          </div>
          <label className={`bascule${o.equipable ? ' on' : ''}`}>
            <input
              type="checkbox"
              checked={o.equipable}
              onChange={(e) =>
                pose({
                  equipable: e.target.checked,
                  emplacements: e.target.checked
                    ? emplacementsDe(o).length
                      ? emplacementsDe(o)
                      : [EMPLACEMENTS_OBJET[0].cle]
                    : []
                })
              }
            />
            Se porte — occupe un emplacement
          </label>

          {/* Plusieurs endroits possibles, et non un seul : une épée va dans
              l'une ou l'autre main, une bague à l'un ou l'autre doigt. On coche
              ce qui convient ; c'est l'exemplaire qui dira où il est vraiment. */}
          {o.equipable ? (
            <div className="emplacements">
              <span className="eyebrow">Où il peut se porter</span>
              <div className="emp-choix">
                {EMPLACEMENTS_OBJET.map((e) => {
                  const pris = emplacementsDe(o).includes(e.cle)
                  return (
                    <button
                      key={e.cle}
                      className={`emp${pris ? ' on' : ''}`}
                      aria-pressed={pris}
                      onClick={() =>
                        pose({
                          emplacements: pris
                            ? emplacementsDe(o).filter((x) => x !== e.cle)
                            : [...emplacementsDe(o), e.cle]
                        })
                      }
                    >
                      {e.nom}
                    </button>
                  )
                })}
              </div>
              {emplacementsDe(o).length === 0 ? (
                <p className="emp-rien">
                  Aucun endroit coché&nbsp;: il ne pourra se poser sur personne.
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Ce qui s'épuise ne tient pas au fait de se porter : une fiole a
              trois doses sans occuper d'emplacement. L'emplacement, lui, n'a de
              sens que pour ce qui se porte. */}
          <div className="champs">
            <label className="champ">
              <span>Ce qui s’épuise</span>
              <span className="champ-suffixe">
                <input
                  type="number"
                  min={0}
                  value={o.chargeMax ?? ''}
                  placeholder="—"
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    tape({
                      chargeMax: e.target.value.trim() && Number.isFinite(n) ? n : null,
                      chargeNom: o.chargeNom ?? 'charges'
                    })
                  }}
                />
                <input
                  className="unite unite-libre"
                  value={o.chargeNom ?? ''}
                  placeholder="charges"
                  onChange={(e) => tape({ chargeNom: e.target.value.trim() || null })}
                  aria-label="Nom de ce qui s’épuise"
                />
              </span>
            </label>
          </div>

          <div className="effets">
            {o.effets.map((e) => (
              <span className="effet" key={e.id}>
                <b>{e.tete}</b>
                {e.detail}
                <button
                  className="x"
                  title="Retirer cet effet"
                  aria-label={`Retirer ${e.tete}`}
                  onClick={() => pose({ effets: o.effets.filter((x) => x.id !== e.id) })}
                >
                  ×
                </button>
              </span>
            ))}
            <button
              className="effet effet-neuf"
              onClick={(ev) => {
                const r = ev.currentTarget.getBoundingClientRect()
                setEffetOuvert({ x: r.left, y: r.bottom + 6 })
              }}
            >
              + un effet
            </button>
          </div>
        </div>

        {/* ---- où il est ---- */}
        <div className="bloc">
          <div className="bloc-tete">
            <span className="eyebrow">Où il est</span>
            <div className="spacer" />
            <span className="mention">
              {o.placements.length === 0
                ? 'nulle part'
                : `${o.placements.length} endroit${o.placements.length > 1 ? 's' : ''}`}
            </span>
          </div>
          {o.placements.length === 0 ? (
            <p className="ou-vide">
              Nulle part encore. «&nbsp;Poser&nbsp;» le range dans un lieu, dans un butin, dans un
              sac.
            </p>
          ) : (
            <div className="ou-liste">
              {o.placements.map((p) => (
                <LignePlacement key={p.id} o={o} p={p} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="fiche-pied">
        <button
          className="btn btn-sm"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            setPoserOuvert({ x: r.left, y: r.top - 6 })
          }}
        >
          <IconPoser />
          Poser…
        </button>
        <div className="spacer" />
        <button
          className="btn btn-ghost btn-sm"
          title="Repartir de celui-ci — la description suit, pas les exemplaires posés"
          onClick={async () => {
            const copie = await window.jdr.objets.copy(o.id)
            await s.refreshObjets()
            if (copie) s.setCurrentObjet(copie.id)
          }}
        >
          Dupliquer
        </button>
        <button
          className="btn btn-ghost btn-sm btn-danger"
          title="Retirer de la réserve — avec tous ses exemplaires posés"
          aria-label="Retirer de la réserve"
          onClick={async () => {
            await window.jdr.objets.remove(o.id)
            await s.refreshObjets()
          }}
        >
          <IconTrash />
        </button>
      </div>

      {image ? (
        <ChoixDansArbre
          titre={`Image — ${o.nom}`}
          icone={<IconImage />}
          kinds={['image']}
          rendu="vignettes"
          courant={o.imageItemId}
          sansLibelle="Le glyphe de sa famille"
          onPick={async (id) => {
            setImage(false)
            await enregistre({ imageItemId: id })
          }}
          onClose={() => setImage(false)}
        />
      ) : null}

      {effetOuvert ? (
        <PanneauEffet
          x={effetOuvert.x}
          y={effetOuvert.y}
          onClose={() => setEffetOuvert(null)}
          onPose={(e) => {
            setEffetOuvert(null)
            pose({ effets: [...o.effets, e] })
          }}
        />
      ) : null}

      {poserOuvert ? (
        <PanneauPoser
          x={poserOuvert.x}
          y={poserOuvert.y}
          objetId={o.id}
          onClose={() => setPoserOuvert(null)}
        />
      ) : null}
    </div>
  )
}

/**
 * Un exemplaire posé. L'état se clique : dans un lieu, il passe de « pas
 * découvert » à « sur place » le jour où les joueurs mettent la main dessus —
 * c'est l'antisèche du MJ, et elle doit suivre la partie.
 */
function LignePlacement({ o, p }: { o: Objet; p: ObjetPlacement }): JSX.Element {
  const s = useStore()
  const [precis, setPrecis] = useState(p.precision ?? '')
  const [donne, setDonne] = useState<{ x: number; y: number } | null>(null)
  const frappe = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => void (frappe.current && clearTimeout(frappe.current)), [])

  const maj = async (patch: Parameters<typeof window.jdr.objets.placement>[1]): Promise<void> => {
    await window.jdr.objets.placement(p.id, patch)
    await s.refreshObjets()
  }

  const dit = p.etat === 'cache' ? 'pas découvert' : p.etat === 'trouve' ? 'sur place' : 'porté'

  return (
    <div className="ou-ligne">
      <span className="ou-port">
        {p.port === 'lieu' ? (
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
          >
            <path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
          >
            <circle cx="12" cy="8" r="3.6" />
            <path d="M4.5 20c.8-4 3.8-6 7.5-6s6.7 2 7.5 6" />
          </svg>
        )}
      </span>

      <span className="ou-txt">
        <span className="ou-cible">{p.cible}</span>
        <input
          className="ou-precis"
          value={precis}
          placeholder={p.port === 'lieu' ? 'où exactement ?' : 'comment il le porte'}
          aria-label="Précision"
          onChange={(e) => {
            setPrecis(e.target.value)
            if (frappe.current) clearTimeout(frappe.current)
            frappe.current = setTimeout(
              () => void maj({ precision: e.target.value.trim() || null }),
              400
            )
          }}
        />
      </span>

      {!o.unique ? (
        <input
          className="ou-qte num"
          type="number"
          min={1}
          value={p.qte}
          aria-label={`Combien à ${p.cible}`}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (Number.isNaN(n)) return
            if (frappe.current) clearTimeout(frappe.current)
            frappe.current = setTimeout(() => void maj({ qte: Math.max(1, Math.trunc(n)) }), 400)
          }}
        />
      ) : null}

      {p.port === 'lieu' ? (
        <button
          className={`ou-etat ${p.etat}`}
          title={
            p.etat === 'cache'
              ? 'Les joueurs ne l’ont pas trouvé — clic quand ils mettent la main dessus'
              : 'Ils savent qu’il est là — clic pour le remettre à couvert'
          }
          onClick={() => void maj({ etat: p.etat === 'cache' ? 'trouve' : 'cache' })}
        >
          {dit}
        </button>
      ) : (
        <span className="ou-etat porte">{dit}</span>
      )}

      {/* Le faire passer sans repasser par la réserve : c'est le geste de la
          table, quand quelqu'un ramasse ce qui traînait là. */}
      <button
        className="ou-donner"
        title={`Donner à quelqu’un — il quitte ${p.cible}`}
        aria-label="Donner à"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          setDonne({ x: r.left - 210, y: r.top })
        }}
      >
        <IconDonner />
      </button>

      <button
        className="ou-retire"
        title="Le reprendre d’ici — l’objet reste en réserve"
        aria-label={`Reprendre de ${p.cible}`}
        onClick={async () => {
          await window.jdr.objets.reprendre(p.id)
          await s.refreshObjets()
        }}
      >
        <IconClose />
      </button>

      {donne ? (
        <MenuDonner
          x={donne.x}
          y={donne.y}
          p={p}
          onClose={() => setDonne(null)}
          onFait={() => s.refreshObjets()}
        />
      ) : null}
    </div>
  )
}

/* ============================================================
   Les panneaux posés au curseur
   ============================================================ */

/** Où poser un exemplaire : un lieu, un PNJ, le sac d'un joueur. */
function PanneauPoser({
  x,
  y,
  objetId,
  onClose
}: {
  x: number
  y: number
  objetId: number
  onClose: () => void
}): JSX.Element {
  const s = useStore()
  const pnjs = s.characters.filter((c) => c.kind === 'pnj')
  const pjs = s.characters.filter((c) => c.kind !== 'pnj')

  const poser = async (
    port: PortObjet,
    placeId: number | null,
    characterId: number | null
  ): Promise<void> => {
    onClose()
    await window.jdr.objets.poser({ objetId, port, placeId, characterId })
    await s.refreshObjets()
  }

  return (
    <Pop x={x} y={y} onClose={onClose}>
      <span className="eyebrow">Dans un lieu</span>
      {s.places.length === 0 ? <p className="pop-rien">Aucun lieu dans la campagne.</p> : null}
      {s.places.map((l) => (
        <button key={l.id} className="opt" onClick={() => void poser('lieu', l.id, null)}>
          {l.name}
        </button>
      ))}

      <hr />
      <span className="eyebrow">Dans le butin d’un PNJ</span>
      {pnjs.length === 0 ? <p className="pop-rien">Aucun PNJ.</p> : null}
      {pnjs.map((c) => (
        <button key={c.id} className="opt" onClick={() => void poser('pnj', null, c.id)}>
          {c.name}
        </button>
      ))}

      <hr />
      <span className="eyebrow">Dans le sac d’un joueur</span>
      {pjs.length === 0 ? <p className="pop-rien">Aucun personnage joueur.</p> : null}
      {pjs.map((c) => (
        <button key={c.id} className="opt" onClick={() => void poser('pj', null, c.id)}>
          {c.name}
        </button>
      ))}
    </Pop>
  )
}

/**
 * Un effet de plus.
 *
 * Rien n'est câblé : une tête, un détail, et c'est tout. Les suggestions, elles,
 * viennent de la fiche de la campagne — ses caractéristiques et ses
 * compétences —, si bien que « +1 » propose ce que cette table sait faire.
 */
function PanneauEffet({
  x,
  y,
  onClose,
  onPose
}: {
  x: number
  y: number
  onClose: () => void
  onPose: (e: EffetObjet) => void
}): JSX.Element {
  const s = useStore()
  const [tete, setTete] = useState('')
  const [detail, setDetail] = useState('')
  const champ = useRef<HTMLInputElement>(null)

  useEffect(() => champ.current?.focus(), [])

  const cibles = [
    ...(s.sheet?.spec.stats ?? []).map((x) => x.label),
    ...(s.sheet?.spec.skills ?? []).map((x) => x.label)
  ]

  const poser = (): void => {
    const t = tete.trim()
    if (!t) return
    onPose({
      id: `e${Date.now().toString(36)}`,
      tete: t,
      detail: detail.trim()
    })
  }

  return (
    <Pop x={x} y={y} className="large" onClose={onClose}>
      <span className="eyebrow">Un effet de plus</span>
      <div className="effet-form">
        <div className="effet-tetes">
          {['+1', '−1', 'Dégâts', 'Protège', 'Éclaire', 'Ouvre', 'Force', 'Rend', 'Coûte'].map(
            (t) => (
              <button
                key={t}
                className={`tete-prop${tete === t ? ' on' : ''}`}
                onClick={() => setTete(t)}
              >
                {t}
              </button>
            )
          )}
        </div>
        <label className="champ">
          <span>Ce qu’on lit en gras</span>
          <input
            ref={champ}
            value={tete}
            placeholder="Dégâts"
            onChange={(e) => setTete(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && poser()}
          />
        </label>
        <label className="champ">
          <span>Et ce qui suit</span>
          <input
            value={detail}
            list="objet-cibles"
            placeholder="1d6 + Vigueur"
            onChange={(e) => setDetail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && poser()}
          />
          <datalist id="objet-cibles">
            {cibles.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <button className="btn btn-sm btn-brass btn-c" onClick={poser} disabled={!tete.trim()}>
          Poser l’effet
        </button>
      </div>
    </Pop>
  )
}

/**
 * Les réglages de la réserve : ses rayons, et l'unité de valeur de la campagne.
 *
 * L'unité se nomme **une fois** ici ; chaque objet ne porte qu'un chiffre. Sans
 * cela on retaperait « francs » à chaque ligne, et aucun total ne serait
 * calculable.
 */
function PanneauReglages({
  x,
  y,
  onClose
}: {
  x: number
  y: number
  onClose: () => void
}): JSX.Element {
  const s = useStore()
  const [editee, setEditee] = useState<number | null>(null)

  const fam = s.objetFamilles.find((f) => f.id === editee) ?? null

  if (fam) {
    return (
      <Pop x={x} y={y} className="large" onClose={onClose}>
        <ReglageFamille f={fam} onRetour={() => setEditee(null)} />
      </Pop>
    )
  }

  return (
    <Pop x={x} y={y} className="large" onClose={onClose}>
      <span className="eyebrow">Les familles</span>
      {s.objetFamilles.map((f) => (
        <button key={f.id} className="opt" onClick={() => setEditee(f.id)}>
          <span className={`pastille c-${f.teinte}`} />
          <span className="lib">{f.nom}</span>
          <span className="n num">{s.objets.filter((o) => o.familleId === f.id).length}</span>
        </button>
      ))}
      <button
        className="opt neuve"
        onClick={async () => {
          /* La teinte suivante qui n'est pas déjà prise : deux rayons de la
             même couleur ne se distinguent plus à un mètre. */
          const prises = new Set(s.objetFamilles.map((f) => f.teinte))
          const libre = PION_COULEURS.find((c) => !prises.has(c.key))?.key ?? 'neutral'
          const neuve = await window.jdr.objets.familleAdd({
            nom: 'Nouvelle famille',
            teinte: libre,
            glyphe: 'outils'
          })
          await s.refreshObjets()
          setEditee(neuve.id)
        }}
      >
        <IconPlus />
        Une famille de plus
      </button>

      <p className="reglage-ailleurs">
        L’unité de valeur — francs, pièces d’or, crédits — se nomme une fois dans les
        paramètres, sous « Table et règles ». Elle vaut pour toute la campagne.
      </p>
    </Pop>
  )
}

/** Un rayon : son nom, sa teinte, son dessin. */
function ReglageFamille({ f, onRetour }: { f: ObjetFamille; onRetour: () => void }): JSX.Element {
  const s = useStore()
  const [nom, setNom] = useState(f.nom)
  const frappe = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => void (frappe.current && clearTimeout(frappe.current)), [])

  const maj = async (patch: {
    nom?: string
    teinte?: string
    glyphe?: GlypheObjet
  }): Promise<void> => {
    await window.jdr.objets.familleUpdate(f.id, patch)
    await s.refreshObjets()
  }

  const n = s.objets.filter((o) => o.familleId === f.id).length

  return (
    <div className="fam-editeur">
      <button className="retour" onClick={onRetour}>
        ← toutes les familles
      </button>

      <label className="champ">
        <span>Nom du rayon</span>
        <input
          value={nom}
          onChange={(e) => {
            setNom(e.target.value)
            if (frappe.current) clearTimeout(frappe.current)
            frappe.current = setTimeout(() => void maj({ nom: e.target.value }), 400)
          }}
        />
      </label>

      <span className="eyebrow">Son dessin</span>
      <div className="grid-glyphes">
        {GLYPHES_OBJET.map((g) => (
          <button
            key={g}
            className={`gl c-${f.teinte}${f.glyphe === g ? ' on' : ''}`}
            title={g}
            onClick={() => void maj({ glyphe: g })}
          >
            {glypheObjet(g, '')}
          </button>
        ))}
      </div>

      <span className="eyebrow">Sa teinte</span>
      <div className="teintes-grille">
        {PION_COULEURS.map((c) => (
          <button
            key={c.key}
            className={`teinte sw${f.teinte === c.key ? ' on' : ''}`}
            style={{ background: c.hex }}
            title={c.name}
            onClick={() => void maj({ teinte: c.key })}
          />
        ))}
      </div>

      <button
        className="btn btn-sm btn-danger btn-c"
        onClick={async () => {
          await window.jdr.objets.familleRemove(f.id)
          await s.refreshObjets()
          onRetour()
        }}
      >
        <IconTrash />
        Retirer ce rayon
      </button>
      <p className="note">
        {n === 0
          ? 'Ce rayon est vide.'
          : `Ses ${n} objet${n > 1 ? 's' : ''} rest${n > 1 ? 'ent' : 'e'} en réserve, sans famille.`}
      </p>
    </div>
  )
}
