/**
 * Les apparences d'une carte : la même pièce de nuit, en flammes, effondrée.
 *
 * Elles appartiennent au lieu qui porte le plan — l'étage d'une pièce
 * découpée. Seule l'image change à l'écran : murs, lampes, brouillard et pions
 * restent où ils sont, ce qui demande une image aux proportions de la carte.
 * Une image qui ne les a pas est acceptée, mais signalée.
 */
import { useState } from 'react'
import { useStore } from '../store'
import { ChoixDansArbre } from './ChoixDansArbre'
import { IconClose, IconImage, IconPlus } from './Icons'
import type { Apparence, Place } from '@shared/types'
import type { UiItem } from '../../../../preload/index'

/** Le lieu qui porte le plan : l'étage d'une pièce découpée, sinon le lieu lui-même. */
export function porteurDe(p: Place, places: Place[]): Place {
  if (!p.zone || p.parentId == null) return p
  return places.find((q) => q.id === p.parentId) ?? p
}

/** L'image que montre le plan : son apparence choisie, sinon la carte. */
export function imageMontree(porteur: Place, items: UiItem[]): UiItem | undefined {
  const a = porteur.apparences.find((x) => x.id === porteur.apparenceId)
  return (
    (a ? items.find((i) => i.id === a.itemId) : undefined) ??
    items.find((i) => i.id === porteur.mapItemId)
  )
}

/** Deux images de proportions différentes, à 2 % près. */
const decalee = (a: UiItem | undefined, b: UiItem | undefined): boolean =>
  !!a?.width && !!a.height && !!b?.width && !!b.height &&
  Math.abs(a.width / a.height - b.width / b.height) / (b.width / b.height) > 0.02

async function choisir(porteur: Place, id: number | null): Promise<void> {
  await window.jdr.places.choisirApparence(porteur.id, id)
  await useStore.getState().refreshPlaces()
}

/** La rangée de la fiche du lieu, sous son plan. */
export function ApparencesDuPlan({ porteur }: { porteur: Place }): JSX.Element | null {
  const s = useStore()
  const [ajout, setAjout] = useState(false)
  const [enNom, setEnNom] = useState<number | null>(null)
  const carte = s.allItems.find((i) => i.id === porteur.mapItemId)
  if (!carte) return null

  const vignette = (it: UiItem | undefined): JSX.Element =>
    it?.url || it?.poster ? (
      <img src={it.poster ?? it.url ?? ''} alt="" draggable={false} />
    ) : (
      <span className="app-vide" />
    )

  const renommer = async (a: Apparence, nom: string): Promise<void> => {
    setEnNom(null)
    if (!nom.trim() || nom.trim() === a.nom) return
    await window.jdr.places.renommerApparence(a.id, nom)
    await s.refreshPlaces()
  }

  return (
    <div className="fdl-apparences">
      <span className="eyebrow">Apparences</span>
      <div className="app-rangee">
        <button
          className="app-vig"
          aria-pressed={porteur.apparenceId == null}
          onClick={() => void choisir(porteur, null)}
          title="La carte telle quelle"
        >
          {vignette(carte)}
          <span className="app-nom">Normale</span>
        </button>

        {porteur.apparences.map((a) => {
          const it = s.allItems.find((i) => i.id === a.itemId)
          const travers = decalee(it, carte)
          return (
            <div key={a.id} className="app-case">
              <button
                className="app-vig"
                aria-pressed={porteur.apparenceId === a.id}
                onClick={() => void choisir(porteur, a.id)}
                onDoubleClick={() => setEnNom(a.id)}
                title={
                  travers
                    ? 'Ses proportions ne sont pas celles de la carte : murs et pions ne tomberont pas juste'
                    : 'Montrer cette apparence — double-clic pour la renommer'
                }
              >
                {vignette(it)}
                {travers ? <span className="app-travers">⚠</span> : null}
                {enNom === a.id ? null : <span className="app-nom">{a.nom}</span>}
              </button>
              {enNom === a.id ? (
                <input
                  className="app-renom"
                  defaultValue={a.nom}
                  autoFocus
                  aria-label="Nom de l’apparence"
                  onBlur={(e) => void renommer(a, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur()
                    if (e.key === 'Escape') setEnNom(null)
                  }}
                />
              ) : null}
              <button
                className="app-retirer"
                title="Retirer cette apparence (l’image reste dans la Bibliothèque)"
                aria-label={`Retirer l’apparence ${a.nom}`}
                onClick={async () => {
                  await window.jdr.places.retirerApparence(a.id)
                  await s.refreshPlaces()
                }}
              >
                ×
              </button>
            </div>
          )
        })}

        <button className="app-ajout" onClick={() => setAjout(true)} title="Ajouter une autre image de cette carte">
          <IconPlus />
          Apparence
        </button>
      </div>

      {ajout ? (
        <ChoixDansArbre
          titre={`Une autre apparence de ${porteur.name}`}
          icone={<IconImage />}
          kinds={['image']}
          rendu="vignettes"
          courant={null}
          onClose={() => setAjout(false)}
          onPick={async (id) => {
            setAjout(false)
            const it = id == null ? undefined : s.allItems.find((i) => i.id === id)
            if (!it) return
            /* Son nom de fichier pour commencer ; un double-clic le change. */
            await window.jdr.places.ajouterApparence(porteur.id, it.id, it.title)
            await s.refreshPlaces()
          }}
        />
      ) : null}
    </div>
  )
}

/**
 * Le sélecteur de la barre de scène : basculer d'apparence sans ouvrir la
 * fiche. Il ne se montre que si la scène affiche la carte d'un lieu qui en a.
 */
export function SelecteurApparence({ porteur }: { porteur: Place }): JSX.Element {
  return (
    <label className="app-select" title="L’apparence de la carte : la même pièce, sous un autre jour">
      <span className="eyebrow">Apparence</span>
      <select
        value={porteur.apparenceId ?? ''}
        onChange={(e) => void choisir(porteur, e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">Normale</option>
        {porteur.apparences.map((a) => (
          <option key={a.id} value={a.id}>
            {a.nom}
          </option>
        ))}
      </select>
    </label>
  )
}

/**
 * Les images et vidéos à montrer dans ce lieu : au Paravent, elles rejoignent
 * celles du moment quand il s'y passe. Une même image peut servir à plusieurs
 * lieux ; la détacher d'ici ne l'ôte pas des autres.
 */
export function ImagesDuLieu({ lieu }: { lieu: Place }): JSX.Element {
  const s = useStore()
  const [choix, setChoix] = useState(false)
  const images = lieu.imageIds
    .map((id) => s.allItems.find((i) => i.id === id))
    .filter((i): i is UiItem => !!i)

  return (
    <div className="fdl-images">
      <span className="eyebrow">Images et vidéos</span>
      <div className="im-rangee">
        {images.map((im) => (
          <figure key={im.id} className="im-vignette">
            <span className="im-media">
              <img src={im.poster ?? (im.kind === 'image' ? im.url : null) ?? ''} alt="" draggable={false} />
              {im.kind === 'video' ? <span className="pu-play" /> : null}
            </span>
            <div className="im-gestes">
              <figcaption title={im.relPath ?? im.title}>{im.title}</figcaption>
              <button
                className="btn btn-ghost btn-sm btn-ico"
                title={`Détacher de ce lieu (${im.kind === 'video' ? 'la vidéo' : 'l’image'} reste dans la Bibliothèque)`}
                onClick={async () => {
                  await window.jdr.places.detacherImage(lieu.id, im.id)
                  await s.refreshPlaces()
                }}
              >
                <IconClose />
              </button>
            </div>
          </figure>
        ))}
        <button className="im-ajout" onClick={() => setChoix(true)}>
          <IconPlus />
          Image ou vidéo
        </button>
      </div>

      {choix ? (
        <ChoixDansArbre
          titre={`Des images à montrer — ${lieu.name}`}
          icone={<IconImage />}
          kinds={['image', 'video']}
          rendu="vignettes"
          courant={null}
          deja={lieu.imageIds}
          onClose={() => setChoix(false)}
          plusieurs={async (ids) => {
            setChoix(false)
            for (const id of ids) await window.jdr.places.attacherImage(lieu.id, id)
            await s.refreshPlaces()
          }}
        />
      ) : null}
    </div>
  )
}
