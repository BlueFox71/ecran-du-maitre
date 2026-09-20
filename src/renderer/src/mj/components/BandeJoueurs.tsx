/**
 * Qui possède quoi — la bande des joueurs, au pied de la réserve.
 *
 * Une colonne par joueur, ses affaires dessous, et pour chacune l'endroit du
 * corps où il la porte — ou « inventaire » si elle ne fait que suivre dans son
 * sac. C'est la vue d'ensemble qui manquait : la fiche d'un personnage dit ce
 * que *lui* porte, la réserve dit où va *un* objet ; ici on lit la table
 * entière d'un regard, et on redistribue.
 *
 * **Le râtelier**, choisi sur maquette contre quatre autres traitements : les
 * colonnes se partagent toute la largeur au lieu de se serrer à gauche, le
 * visage du personnage tient lieu d'étiquette, et la ligne d'un objet porté
 * prend un voile de sa couleur. La première version tenait dans des colonnes
 * de 208 px, en corps 11, avec des noms coupés et du vide à droite ; elle ne
 * se lisait pas de loin, et c'est une bande qu'on regarde en jouant.
 *
 * **On donne en glissant.** Une carte de l'étagère lâchée sur une colonne, et
 * le joueur l'a ; une ligne glissée d'une colonne à l'autre, et l'objet a
 * changé de mains sans repasser par la réserve. Le geste est celui de la table,
 * où l'on tend les choses.
 */
import { useState } from 'react'
import { itemById, useStore } from '../store'
import { IconClose, glypheObjet } from './Icons'
import { initials } from '../modules/Sheets'
import { nomEmplacement } from '@shared/types'
import type { Character, Objet, ObjetPlacement } from '@shared/types'

/** Ce qu'un joueur a sur lui : l'objet, et l'exemplaire qui est à lui. */
interface Avoir {
  o: Objet
  p: ObjetPlacement
}

/** Ce qu'on tient pendant un glisser : une carte de la réserve, ou un exemplaire. */
export const TYPE_OBJET = 'application/x-jdr-objet'
export const TYPE_EXEMPLAIRE = 'application/x-jdr-exemplaire'

/**
 * Ce qu'on lit dans un glisser en cours.
 *
 * Pendant le survol, le navigateur cache les **valeurs** transportées mais
 * laisse voir leurs **types** : c'est assez pour savoir si l'on tient une carte
 * de la réserve ou un exemplaire déjà posé, et donc pour annoncer le bon effet.
 *
 * Il le faut : un glisser annoncé « copie » que l'on accueille en « déplacement »
 * est refusé par le navigateur, et le lâcher n'arrive jamais. C'est ce qui
 * faisait que donner un objet en le glissant ne produisait rien du tout.
 */
function typeTenu(dt: DataTransfer): 'objet' | 'exemplaire' | null {
  const types = Array.from(dt.types)
  if (types.includes(TYPE_EXEMPLAIRE)) return 'exemplaire'
  if (types.includes(TYPE_OBJET)) return 'objet'
  return null
}

/**
 * Le texte de secours, lu quand le type maison n'a pas survécu au voyage.
 * Certains environnements filtrent les types inventés ; `text/plain`, jamais.
 */
export function chargeTexte(dt: DataTransfer): { quoi: 'objet' | 'exemplaire'; id: number } | null {
  const brut = dt.getData('text/plain')
  const m = /^jdr:(objet|exemplaire):(\d+)$/.exec(brut)
  return m ? { quoi: m[1] as 'objet' | 'exemplaire', id: Number(m[2]) } : null
}

export function BandeJoueurs(): JSX.Element | null {
  const s = useStore()
  const joueurs = s.characters.filter((c) => c.kind !== 'pnj')
  const [survole, setSurvole] = useState<number | null>(null)

  if (joueurs.length === 0) return null

  const avoirsDe = (ch: Character): Avoir[] =>
    s.objets.flatMap((o) =>
      o.placements.filter((p) => p.characterId === ch.id).map((p) => ({ o, p }))
    )

  /** Le lâcher : un objet de l'étagère se pose, un exemplaire change de mains. */
  const lacher = async (e: React.DragEvent, ch: Character): Promise<void> => {
    e.preventDefault()
    setSurvole(null)
    const dt = e.dataTransfer
    const secours = chargeTexte(dt)
    const objetId = Number(dt.getData(TYPE_OBJET)) || (secours?.quoi === 'objet' ? secours.id : 0)
    const placementId =
      Number(dt.getData(TYPE_EXEMPLAIRE)) || (secours?.quoi === 'exemplaire' ? secours.id : 0)
    try {
      if (placementId) {
        await window.jdr.objets.donner(placementId, { port: 'pj', characterId: ch.id })
      } else if (objetId) {
        await window.jdr.objets.poser({ objetId, port: 'pj', characterId: ch.id })
      } else {
        return
      }
    } catch (err) {
      s.toast('L’objet n’est pas arrivé jusqu’à lui.', true)
      console.error('[bande]', err)
      return
    }
    await s.refreshObjets()
  }

  return (
    <section className="bande" aria-label="Ce que les joueurs possèdent">
      <div className="bande-tete">
        <span className="eyebrow">Qui possède quoi</span>
        <span className="sys">glisse un objet de l’étagère sur un joueur pour le lui donner</span>
      </div>

      <div className="bande-cols">
        {joueurs.map((ch) => {
          const avoirs = avoirsDe(ch)
          const portes = avoirs.filter((a) => a.p.emplacement).length
          const portrait = itemById(s.allItems, ch.portraitItemId)
          const url = portrait?.poster ?? portrait?.url ?? null
          return (
            <div
              key={ch.id}
              className={`bj-col c-${ch.color ?? 'neutral'}${survole === ch.id ? ' vise' : ''}`}
              onDragOver={(e) => {
                /* On n'accueille que ce qui vient de la réserve : un fichier
                   lâché là ne doit pas être avalé. Et l'effet annoncé suit ce
                   qu'on tient — une carte se copie, un exemplaire se déplace —
                   sans quoi le navigateur refuse le lâcher en silence. */
                const quoi = typeTenu(e.dataTransfer)
                if (!quoi) return
                e.preventDefault()
                e.dataTransfer.dropEffect = quoi === 'exemplaire' ? 'move' : 'copy'
                if (survole !== ch.id) setSurvole(ch.id)
              }}
              onDragLeave={() => setSurvole((v) => (v === ch.id ? null : v))}
              onDrop={(e) => void lacher(e, ch)}
            >
              {/* Son visage, pas une pastille : c'est à lui qu'on donne, et on
                  le reconnaît comme partout ailleurs dans l'application. */}
              <div className="bj-tete">
                <span className="bj-visage">
                  {url ? <img src={url} alt="" /> : initials(ch.name)}
                </span>
                <span className="bj-qui">
                  <b>{ch.name}</b>
                  <span>
                    {avoirs.length === 0
                      ? 'les mains vides'
                      : `${portes} porté${portes > 1 ? 's' : ''} · ${avoirs.length - portes} en sac`}
                  </span>
                </span>
              </div>

              {avoirs.length === 0 ? (
                <p className="bj-vide">Rien ne lui a été donné.</p>
              ) : (
                <div className="bj-liste">
                  {avoirs.map((a) => (
                    <LigneAvoir key={a.p.id} a={a} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

/**
 * Une chose qu'il possède : son nom, et où il la porte.
 *
 * La ligne se glisse : on la dépose sur un autre joueur et l'objet a changé de
 * mains. La croix la rend à la réserve — elle ne détruit rien, l'objet reste
 * décrit. Ce qui est **porté** prend un voile de la couleur du joueur et son
 * emplacement s'écrit en laiton ; ce qui dort dans le sac reste gris.
 */
function LigneAvoir({ a }: { a: Avoir }): JSX.Element {
  const s = useStore()
  const f = s.objetFamilles.find((x) => x.id === a.o.familleId) ?? null
  const porte = !!a.p.emplacement

  return (
    <div
      className={`bj-ligne${porte ? ' porte' : ''}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(TYPE_EXEMPLAIRE, String(a.p.id))
        e.dataTransfer.setData('text/plain', `jdr:exemplaire:${a.p.id}`)
        e.dataTransfer.effectAllowed = 'move'
      }}
      title={`${a.o.nom} — ${porte ? nomEmplacement(a.p.emplacement) : 'dans son inventaire'}`}
    >
      <span className={`g c-${f?.teinte ?? 'neutral'}`}>
        {glypheObjet(f?.glyphe ?? 'outils', 'glyphe')}
      </span>
      <span className="nm">
        {a.o.nom}
        {a.p.qte > 1 ? <b className="num"> ×{a.p.qte}</b> : null}
      </span>
      <span className="ou">{porte ? nomEmplacement(a.p.emplacement) : 'inventaire'}</span>
      <button
        className="bj-retire"
        title="Le lui reprendre — il retourne en réserve"
        aria-label={`Reprendre ${a.o.nom}`}
        onClick={async () => {
          await window.jdr.objets.reprendre(a.p.id)
          await s.refreshObjets()
        }}
      >
        <IconClose />
      </button>
    </div>
  )
}
