/**
 * Ce qu'un personnage porte — la poupée d'équipement.
 *
 * La silhouette au milieu, les endroits du corps tout autour : on voit d'un
 * coup d'œil ce qu'il a sur lui et ce qui lui manque, comme sur une planche
 * d'armurier. Un clic sur une case propose ce que la réserve a pour cet
 * endroit-là — jamais la liste entière : on ne met pas des bottes sur la tête
 * par mégarde.
 *
 * **Équiper, c'est poser.** Un objet porté est un exemplaire de la réserve
 * rangé sur ce personnage, à un emplacement ; le même exemplaire sans
 * emplacement est dans son sac. Vider une case n'efface donc rien : l'objet
 * retombe dans le sac.
 *
 * Rien de tout cela ne passe par `display` : l'équipement reste chez le MJ.
 */
import { useState } from 'react'
import { useStore } from '../store'
import { IconClose, IconDonner, IconPlus, IconTrash, glypheObjet } from '../components/Icons'
import { Silhouette } from '../components/Silhouette'
import { EMPLACEMENTS_OBJET, ditEmplacements, emplacementsDe, nomEmplacement } from '@shared/types'
import type { Character, Objet, ObjetPlacement } from '@shared/types'
import { Pop } from '../components/Pop'
import { MenuDonner } from '../components/MenuDonner'

/** Un objet posé sur le personnage : l'objet, et l'exemplaire qui est à lui. */
interface SurLui {
  o: Objet
  p: ObjetPlacement
}

export function Equipement({ ch }: { ch: Character }): JSX.Element {
  const s = useStore()
  const [pop, setPop] = useState<{ x: number; y: number; emplacement: string | null } | null>(null)

  /* Tout ce que la réserve a posé sur lui : porté d'un côté, dans le sac de
     l'autre. On le lit du magasin — la réserve porte déjà ses exemplaires. */
  const surLui: SurLui[] = s.objets.flatMap((o) =>
    o.placements.filter((p) => p.characterId === ch.id).map((p) => ({ o, p }))
  )
  const porte = new Map<string, SurLui>()
  for (const x of surLui) if (x.p.emplacement) porte.set(x.p.emplacement, x)
  const sac = surLui.filter((x) => !x.p.emplacement)

  const equiper = async (emplacement: string, objetId: number | null): Promise<void> => {
    await window.jdr.objets.equiper({ characterId: ch.id, emplacement, objetId })
    await s.refreshObjets()
  }

  const colonne = (col: 'g' | 'd'): JSX.Element => (
    <div className={`eq-colonne ${col === 'g' ? 'gauche' : 'droite'}`}>
      {EMPLACEMENTS_OBJET.filter((e) => e.col === col).map((e) => (
        <Case
          key={e.cle}
          nom={e.nom}
          x={porte.get(e.cle) ?? null}
          onClic={(ev) => {
            const r = ev.currentTarget.getBoundingClientRect()
            setPop({ x: col === 'g' ? r.right + 8 : r.left - 260, y: r.top, emplacement: e.cle })
          }}
        />
      ))}
    </div>
  )

  /* Ce que l'équipement change : les lignes libres des objets portés, réunies.
     On les reporte, on ne les applique pas — un jet reste jeté par la table. */
  const effets = [...porte.values()].flatMap((x) => x.o.effets.map((e) => ({ ...e, de: x.o.nom })))

  const poidsPorte = [...porte.values(), ...sac].reduce((n, x) => n + poidsDe(x.o) * x.p.qte, 0)
  const chiffre = poidsPorte > 0

  return (
    <div className="equip">
      <div className="eq-poupee">
        <div className="eq-tete">
          <span className="eyebrow">Ce qu’il porte</span>
          <div className="spacer" />
          <span className="sys">
            {porte.size === 0
              ? 'rien sur lui'
              : `${porte.size} emplacement${porte.size > 1 ? 's' : ''} occupé${porte.size > 1 ? 's' : ''}`}
          </span>
        </div>

        <div className="eq-planche">
          {colonne('g')}
          <div className="eq-corps">
            <Silhouette sexe={ch.sexe} teinte={ch.color} />
          </div>
          {colonne('d')}
          <div className="eq-bas">
            {EMPLACEMENTS_OBJET.filter((e) => e.col === 'bas').map((e) => (
              <Case
                key={e.cle}
                nom={e.nom}
                x={porte.get(e.cle) ?? null}
                onClic={(ev) => {
                  const r = ev.currentTarget.getBoundingClientRect()
                  setPop({ x: r.left, y: r.top - 8, emplacement: e.cle })
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <aside className="eq-volet">
        <div className="bloc">
          <div className="bloc-tete">
            <span className="eyebrow">Ce que ça change</span>
            <div className="spacer" />
            <span className="sys">reporté, jamais appliqué en douce</span>
          </div>
          {effets.length === 0 ? (
            <p className="rien-eq">Rien de ce qu’il porte ne change ses jets.</p>
          ) : (
            <div className="eq-effets">
              {effets.map((e, i) => (
                <span className="puce" key={`${e.id}-${i}`}>
                  <b>{e.tete}</b>
                  {e.detail}
                  <i>{e.de.toLowerCase()}</i>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="bloc">
          <div className="bloc-tete">
            <span className="eyebrow">Ce qu’il traîne</span>
            <div className="spacer" />
            {chiffre ? (
              <span className="sys num">{poidsPorte.toFixed(1).replace('.', ',')} de port</span>
            ) : null}
          </div>
          {sac.length === 0 ? (
            <p className="rien-eq">Son sac est vide.</p>
          ) : (
            <div className="eq-sac">
              {sac.map((x) => (
                <LigneSac key={x.p.id} x={x} />
              ))}
            </div>
          )}
          <button
            className="eq-prendre"
            onClick={(ev) => {
              const r = ev.currentTarget.getBoundingClientRect()
              setPop({ x: r.left, y: r.bottom + 6, emplacement: null })
            }}
          >
            <IconPlus />
            Prendre dans la réserve
          </button>
        </div>
      </aside>

      {pop ? (
        <Pop x={pop.x} y={pop.y} onClose={() => setPop(null)} className="eq-pop">
          {pop.emplacement ? (
            <ChoixPourCase
              emplacement={pop.emplacement}
              actuel={porte.get(pop.emplacement) ?? null}
              sac={sac}
              onChoisi={async (id) => {
                setPop(null)
                await equiper(pop.emplacement!, id)
              }}
            />
          ) : (
            <ChoixPourLeSac ch={ch} deja={surLui} onFini={() => setPop(null)} />
          )}
        </Pop>
      ) : null}
    </div>
  )
}

/* ============================================================
   Une case du corps
   ============================================================ */

function Case({
  nom,
  x,
  onClic
}: {
  nom: string
  x: SurLui | null
  onClic: (e: React.MouseEvent<HTMLButtonElement>) => void
}): JSX.Element {
  const s = useStore()
  const famille = x ? (s.objetFamilles.find((f) => f.id === x.o.familleId) ?? null) : null
  const img = x?.o.imageItemId ? s.allItems.find((i) => i.id === x.o.imageItemId) : null
  const url = img?.poster ?? img?.url ?? null

  if (!x) {
    return (
      <button className="eq-case vide" onClick={onClic} title={`${nom} — rien`}>
        <span className="boite">
          <IconPlus />
        </span>
        <span className="emp">{nom}</span>
      </button>
    )
  }
  return (
    <button
      className={`eq-case pris c-${famille?.teinte ?? 'neutral'}`}
      onClick={onClic}
      title={`${nom} — ${x.o.nom}`}
    >
      <span className="boite">
        {url ? <img src={url} alt="" /> : glypheObjet(famille?.glyphe ?? 'outils', 'glyphe')}
      </span>
      <span className="emp">{nom}</span>
      <span className="porte-nom">{x.o.nom}</span>
    </button>
  )
}

function LigneSac({ x }: { x: SurLui }): JSX.Element {
  const s = useStore()
  const [donne, setDonne] = useState<{ x: number; y: number } | null>(null)
  const famille = s.objetFamilles.find((f) => f.id === x.o.familleId) ?? null
  return (
    <div className={`eq-sac-ligne c-${famille?.teinte ?? 'neutral'}`}>
      <span className="g">{glypheObjet(famille?.glyphe ?? 'outils', 'glyphe')}</span>
      {/* Le volet est étroit : un nom long se coupe, et l'infobulle le rend. */}
      <span className="nm" title={x.o.nom}>
        {x.o.nom}
      </span>
      {x.p.qte > 1 ? <span className="q num">×{x.p.qte}</span> : <span />}
      {/* L'endroit du corps où il irait, pour ce qui se porte. Ce qui ne se
          porte pas ne dit rien : le silence vaut mieux qu'une étiquette qui
          mange la place du nom. */}
      {x.o.equipable ? <span className="ou">{ditEmplacements(emplacementsDe(x.o))}</span> : <span />}
      {/* Il le tend à quelqu'un d'autre, ou le pose en partant. */}
      <button
        className="d"
        title={`Donner ${x.o.nom} à quelqu’un, ou le poser quelque part`}
        aria-label={`Donner ${x.o.nom}`}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          setDonne({ x: r.left - 210, y: r.top })
        }}
      >
        <IconDonner />
      </button>
      <button
        className="x"
        title="Le lui reprendre — il retourne en réserve"
        aria-label={`Reprendre ${x.o.nom}`}
        onClick={async () => {
          await window.jdr.objets.reprendre(x.p.id)
          await s.refreshObjets()
        }}
      >
        <IconTrash />
      </button>

      {donne ? (
        <MenuDonner
          x={donne.x}
          y={donne.y}
          p={x.p}
          onClose={() => setDonne(null)}
          onFait={() => s.refreshObjets()}
        />
      ) : null}
    </div>
  )
}

/* ============================================================
   Les panneaux
   ============================================================ */

/** Ce que la réserve propose pour cet endroit du corps — et rien d'autre. */
function ChoixPourCase({
  emplacement,
  actuel,
  sac,
  onChoisi
}: {
  emplacement: string
  actuel: SurLui | null
  sac: SurLui[]
  onChoisi: (objetId: number | null) => void
}): JSX.Element {
  const s = useStore()
  /* Ce qui peut aller là, et rien d'autre : un objet peut viser plusieurs
     endroits du corps — une épée, l'une ou l'autre main. */
  const vont = s.objets.filter((o) => o.equipable && emplacementsDe(o).includes(emplacement))
  const dansSonSac = new Set(sac.map((x) => x.o.id))

  return (
    <>
      <span className="eyebrow">{nomEmplacement(emplacement)}</span>
      {vont.length === 0 ? (
        <p className="pop-rien">
          Aucun objet de la réserve ne va là. Coche «&nbsp;se porte&nbsp;» sur sa fiche, dans
          Objets, et choisis cet emplacement.
        </p>
      ) : (
        vont.map((o) => {
          const f = s.objetFamilles.find((x) => x.id === o.familleId) ?? null
          return (
            <button
              key={o.id}
              className={`opt c-${f?.teinte ?? 'neutral'}${actuel?.o.id === o.id ? ' on' : ''}`}
              onClick={() => onChoisi(o.id)}
            >
              <span className="gl">{glypheObjet(f?.glyphe ?? 'outils', 'glyphe')}</span>
              {o.nom}
              {dansSonSac.has(o.id) ? <span className="det">dans son sac</span> : null}
            </button>
          )
        })
      )}
      {actuel ? (
        <>
          <hr />
          <button className="opt" onClick={() => onChoisi(null)}>
            <IconClose />
            Retirer — il retombe dans son sac
          </button>
        </>
      ) : null}
    </>
  )
}

/** Lui donner quelque chose de la réserve, sans le lui faire porter. */
function ChoixPourLeSac({
  ch,
  deja,
  onFini
}: {
  ch: Character
  deja: SurLui[]
  onFini: () => void
}): JSX.Element {
  const s = useStore()
  const dejaLa = new Set(deja.map((x) => x.o.id))
  const libres = s.objets.filter((o) => !dejaLa.has(o.id))

  return (
    <>
      <span className="eyebrow">Prendre dans la réserve</span>
      {libres.length === 0 ? (
        <p className="pop-rien">
          {s.objets.length === 0
            ? 'La réserve est vide — décris tes objets dans « Objets ».'
            : 'Il a déjà tout ce que la réserve contient.'}
        </p>
      ) : (
        libres.map((o) => {
          const f = s.objetFamilles.find((x) => x.id === o.familleId) ?? null
          return (
            <button
              key={o.id}
              className={`opt c-${f?.teinte ?? 'neutral'}`}
              onClick={async () => {
                onFini()
                await window.jdr.objets.poser({ objetId: o.id, port: 'pj', characterId: ch.id })
                await s.refreshObjets()
              }}
            >
              <span className="gl">{glypheObjet(f?.glyphe ?? 'outils', 'glyphe')}</span>
              {o.nom}
              {o.equipable ? <span className="det">{ditEmplacements(emplacementsDe(o))}</span> : null}
            </button>
          )
        })
      )}
    </>
  )
}

/**
 * Le poids d'un objet, lu dans ce que le MJ a écrit : « 1,2 kg » vaut 1,2.
 *
 * Tant que le poids est un texte libre — la question n'est pas tranchée —, on
 * ne fait pas semblant d'avoir un chiffre : on prend celui qui est écrit quand
 * il y en a un, et rien sinon. Aucun plafond n'est calculé.
 */
function poidsDe(o: Objet): number {
  if (!o.poids) return 0
  const m = o.poids.replace(',', '.').match(/-?\d+(\.\d+)?/)
  return m ? Number(m[0]) : 0
}
