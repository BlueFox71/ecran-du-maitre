import { useEffect, useState } from 'react'
import { useStore } from '../../../store'
import { AVATARS_MJ, urlPortraitMj } from '../../../../shared/avatarsMj'
import { nomDuMj } from '@shared/reglages'
import { IconFolder } from '../../Icons'
import type { Reglage } from '../registre'

/* ============================================================
   Le maître du jeu
   ============================================================ */

/** L'aperçu du profil, en tête de rubrique : ce que l'écran d'attente montrera. */
export function Avant(): JSX.Element {
  const p = useStore((s) => s.poste)
  const choisi = p.mjImage
  return (
    <div className="pmj-apercu">
      <div className="pmj-face">
        {urlPortraitMj(choisi) ? <img src={urlPortraitMj(choisi)!} alt="" /> : <b>🎲</b>}
      </div>
      <div>
        <div className="pmj-nom">{nomDuMj(p)}</div>
        <div className="aide">Maître du jeu</div>
      </div>
    </div>
  )
}

export const reglages: Reglage[] = [
  {
    id: 'mj.prenom',
    rubrique: 'mj',
    nom: 'Prénom',
    mots: ['nom', 'profil', 'mj', 'identité', 'pseudo'],
    Cmd: function PrenomMj() {
      const s = useStore()
      return (
        <ChampTexte
          valeur={s.poste.mjPrenom}
          label="Prénom du maître du jeu"
          placeholder="Ton prénom"
          onPoser={(v) => void s.poserPoste('mj.prenom', v || null)}
        />
      )
    }
  },
  {
    id: 'mj.nom',
    rubrique: 'mj',
    nom: 'Nom',
    aide: 'Facultatif. Sans prénom ni nom, l’écran dit « Le MJ ».',
    mots: ['nom de famille', 'profil', 'mj', 'identité'],
    Cmd: function NomMj() {
      const s = useStore()
      return (
        <ChampTexte
          valeur={s.poste.mjNom}
          label="Nom du maître du jeu"
          placeholder="Ton nom"
          onPoser={(v) => void s.poserPoste('mj.nom', v || null)}
        />
      )
    }
  },
  {
    id: 'mj.image',
    rubrique: 'mj',
    nom: 'Image',
    aide: 'Une silhouette fournie avec l’application, ou une image de ton disque. Elle s’affiche dans un médaillon rond.',
    mots: ['avatar', 'portrait', 'photo', 'médaillon', 'silhouette'],
    pleine: true,
    Cmd: function ImageMj() {
      const s = useStore()
      const choisi = s.poste.mjImage
      const perso = choisi?.startsWith('jdr://') ? choisi : null
      const parcourir = async (): Promise<void> => {
        const url = await window.jdr.app.portraitMj()
        if (url) await s.poserPoste('mj.image', url)
      }
      return (
        <div className="pmj-avatars" role="radiogroup" aria-label="Image du maître du jeu">
          <button
            type="button"
            role="radio"
            aria-checked={!choisi}
            className={`pmj-avatar${!choisi ? ' on' : ''}`}
            onClick={() => void s.poserPoste('mj.image', null)}
          >
            <span className="pmj-rond">
              <b>🎲</b>
            </span>
            <span className="pmj-univers">Aucune image</span>
          </button>
          {AVATARS_MJ.map((a) => {
            const on = choisi === `avatar:${a.id}`
            return (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={on}
                className={`pmj-avatar${on ? ' on' : ''}`}
                onClick={() => void s.poserPoste('mj.image', `avatar:${a.id}`)}
              >
                <span className="pmj-rond">
                  <img src={a.url} alt="" />
                </span>
                <span className="pmj-univers">{a.nom}</span>
              </button>
            )
          })}
          <button
            type="button"
            role="radio"
            aria-checked={!!perso}
            className={`pmj-avatar${perso ? ' on' : ''}`}
            onClick={() => void parcourir()}
            title="Choisir une image dans l’explorateur de fichiers"
          >
            <span className="pmj-rond parcourir">
              {perso ? <img src={perso} alt="" /> : <IconFolder />}
            </span>
            <span className="pmj-univers">{perso ? 'Mon image · changer' : 'Parcourir…'}</span>
          </button>
        </div>
      )
    }
  }
]

/** Un champ de texte qui n'écrit qu'en sortant, ou sur Entrée. */
function ChampTexte({
  valeur,
  label,
  placeholder,
  onPoser
}: {
  valeur: string
  label: string
  placeholder?: string
  onPoser: (v: string) => void
}): JSX.Element {
  const [vu, setVu] = useState(valeur)
  useEffect(() => setVu(valeur), [valeur])
  const poser = (): void => {
    if (vu.trim() !== valeur) onPoser(vu.trim())
  }
  return (
    <input
      type="text"
      value={vu}
      aria-label={label}
      placeholder={placeholder}
      onChange={(e) => setVu(e.target.value)}
      onBlur={poser}
      onKeyDown={(e) => e.key === 'Enter' && poser()}
    />
  )
}
