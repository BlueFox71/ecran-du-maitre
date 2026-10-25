/**
 * « Ça commence bientôt » : l'écran qu'on laisse aux joueurs pendant qu'ils
 * s'installent. Le bouton de la Régie ouvre ses réglages et le lance ; tant
 * qu'il est à l'écran, le même bouton le retire et rend ce qui était là avant.
 *
 * Les réglages appartiennent à la campagne (`attente`, en JSON) : on les pose
 * une fois, on relance d'un clic à chaque séance.
 */
import { useEffect, useState } from 'react'
import { itemById, playerOf, useStore } from '../store'
import { ChampEmojis } from './ChampEmojis'
import { IconClose, IconSablier } from './Icons'
import { emojisDe } from '@shared/emojis'
import { nomDuMj } from '@shared/reglages'
import { urlPortraitMj } from '../../shared/avatarsMj'
import type { SlidePayload } from '@shared/types'
import { useEchap } from '../echap'
import { emojiDe, useSons } from '../sons'

export interface ReglagesAttente {
  titre: string
  sousTitre: string
  emojis: string[]
  /** Compte à rebours en minutes ; 0, pas de compte. */
  minutes: number
  joueurs: boolean
  /** Le MJ s'assoit-il à la table ? Son nom et son image sont ceux de son profil. */
  mj: boolean
  /** Les trois lueurs qui dérivent au fond. */
  lueurs: [string, string, string]
  /** L'ambiance de la sonothèque qui tourne en boucle pendant l'attente ; null, le silence. */
  musique: number | null
}

/**
 * Des ambiances toutes prêtes : trois teintes sombres et saturées, parce
 * qu'une lueur trop claire délave le ciel et noie le titre.
 */
const AMBIANCES: { nom: string; lueurs: [string, string, string] }[] = [
  { nom: 'Nuit dorée', lueurs: ['#8a6a2a', '#6b2a2a', '#3b3a7a'] },
  { nom: 'Brume', lueurs: ['#2f5f6b', '#3b4a6b', '#4d6b5a'] },
  { nom: 'Sang', lueurs: ['#7a1f1f', '#4a1030', '#8a3a1a'] },
  { nom: 'Forêt', lueurs: ['#2f5a2f', '#5a6b2a', '#1f4a4a'] },
  { nom: 'Arcanes', lueurs: ['#5a2f7a', '#2f3a8a', '#7a2f6b'] }
]

const HEX = /^#[0-9a-f]{6}$/i

const DEFAUT: ReglagesAttente = {
  titre: 'La partie commence bientôt',
  sousTitre: '',
  emojis: ['🎲', '🕯️', '✨'],
  minutes: 10,
  joueurs: true,
  mj: true,
  lueurs: AMBIANCES[0].lueurs,
  musique: null
}

const MINUTES_MAX = 180

export function lireAttente(brut: string | undefined): ReglagesAttente {
  try {
    const r = JSON.parse(brut ?? '{}')
    return {
      titre: typeof r.titre === 'string' && r.titre.trim() ? r.titre : DEFAUT.titre,
      sousTitre: typeof r.sousTitre === 'string' ? r.sousTitre : DEFAUT.sousTitre,
      emojis: Array.isArray(r.emojis) ? emojisDe(r.emojis.join('')) : DEFAUT.emojis,
      minutes: Number.isFinite(r.minutes)
        ? Math.max(0, Math.min(MINUTES_MAX, Math.round(r.minutes)))
        : DEFAUT.minutes,
      joueurs: typeof r.joueurs === 'boolean' ? r.joueurs : DEFAUT.joueurs,
      mj: typeof r.mj === 'boolean' ? r.mj : DEFAUT.mj,
      lueurs:
        Array.isArray(r.lueurs) &&
        r.lueurs.length === 3 &&
        r.lueurs.every((c: unknown) => typeof c === 'string' && HEX.test(c))
          ? (r.lueurs as [string, string, string])
          : DEFAUT.lueurs,
      musique: Number.isInteger(r.musique) ? r.musique : DEFAUT.musique
    }
  } catch {
    return DEFAUT
  }
}

export function BoutonAttente(): JSX.Element {
  const s = useStore()
  const [ouvert, setOuvert] = useState(false)
  const direct = s.display ? s.display.slots[s.display.liveSlot] : null
  const enCours = direct?.type === 'attente'
  const fige = !!s.display?.frozen

  return (
    <>
      <button
        className={`btn${enCours ? ' btn-on' : ''}`}
        disabled={fige}
        onClick={() => (enCours ? void window.jdr.display.arreterPresentation() : setOuvert(true))}
        title={
          enCours
            ? 'Retirer l’écran d’attente : les joueurs retrouvent ce qu’ils voyaient avant'
            : 'Montrer aux joueurs un écran « ça commence bientôt », avec compte à rebours'
        }
      >
        {enCours ? <IconClose /> : <IconSablier />}
        {enCours ? 'Arrêter l’attente' : 'Ça commence bientôt'}
      </button>
      {ouvert ? <FenetreAttente onClose={() => setOuvert(false)} /> : null}
    </>
  )
}


/**
 * Les ambiances de la sonothèque qu'on peut proposer en musique d'attente.
 * Un même fichier importé deux fois ne se propose qu'une fois ; deux fichiers
 * du même nom, rangés dans deux dossiers, se disent leur dossier.
 */
interface ChoixAmbiance {
  ids: number[]
  fichier: number | null
  nom: string
  dossier: string
}

function useAmbiances(voulue: number | null): {
  nb: number
  choix: ChoixAmbiance[]
  libelle: (c: ChoixAmbiance) => string
  /** Le son retenu ; un son retiré de la sonothèque depuis : on retombe sur le silence. */
  musique: number | null
  choisi: number | undefined
} {
  const allItems = useStore((x) => x.allItems)
  const ambiances = useSons((x) => x.liste).filter((son) => son.nature === 'ambiance')
  const musique = ambiances.some((son) => son.id === voulue) ? voulue : null

  const choix: ChoixAmbiance[] = []
  for (const son of ambiances) {
    const fichier = son.fichiers[0]?.itemId ?? null
    const deja = fichier == null ? null : choix.find((c) => c.fichier === fichier)
    if (deja) {
      deja.ids.push(son.id)
      continue
    }
    const chemin = itemById(allItems, fichier)?.relPath ?? ''
    choix.push({
      ids: [son.id],
      fichier,
      nom: `${emojiDe(son)} ${son.nom}`,
      dossier: chemin.split('/').slice(0, -1).join(' / ')
    })
  }
  const libelle = (c: ChoixAmbiance): string =>
    c.dossier && choix.some((x) => x !== c && x.nom === c.nom) ? `${c.nom} (${c.dossier})` : c.nom
  const choisi = choix.find((c) => musique != null && c.ids.includes(musique))?.ids[0]
  return { nb: ambiances.length, choix, libelle, musique, choisi }
}

/**
 * Un champ texte. Dans la fenêtre de lancement il suit chaque frappe ; dans
 * les Paramètres (`auBlur`) il garde son brouillon et n'écrit qu'en quittant
 * le champ, pour ne pas enregistrer la campagne à chaque lettre.
 */
function ChampTexte({
  id,
  valeur,
  onChange,
  auBlur,
  onEnter,
  placeholder,
  autoFocus
}: {
  id: string
  valeur: string
  onChange: (v: string) => void
  auBlur?: boolean
  onEnter?: () => void
  placeholder?: string
  autoFocus?: boolean
}): JSX.Element {
  const [brouillon, setBrouillon] = useState(valeur)
  useEffect(() => setBrouillon(valeur), [valeur])
  return (
    <input
      id={id}
      type="text"
      value={auBlur ? brouillon : valeur}
      onChange={(e) => (auBlur ? setBrouillon(e.target.value) : onChange(e.target.value))}
      onBlur={auBlur ? () => brouillon !== valeur && onChange(brouillon) : undefined}
      onKeyDown={onEnter ? (e) => e.key === 'Enter' && onEnter() : undefined}
      placeholder={placeholder}
      autoFocus={autoFocus}
    />
  )
}

/**
 * Les champs de l'écran d'attente, partagés par la fenêtre de lancement et
 * les Paramètres. `seul` ne rend que le contrôle d'un champ, sans son
 * libellé : c'est la ligne des Paramètres qui le nomme.
 */
export function ChampsAttente({
  r,
  onChange,
  seul,
  auBlur,
  onEnter,
  onProfil
}: {
  r: ReglagesAttente
  onChange: (patch: Partial<ReglagesAttente>) => void
  seul?: keyof ReglagesAttente
  /** Les textes n'écrivent qu'en quittant le champ. */
  auBlur?: boolean
  onEnter?: () => void
  /** Le lien vers le profil du MJ ; par défaut, la rubrique des Paramètres. */
  onProfil?: () => void
}): JSX.Element {
  const s = useStore()
  const portrait = urlPortraitMj(s.poste.mjImage)
  const { nb, choix, libelle, choisi } = useAmbiances(r.musique)

  /* Ceux qu'on attend : les joueurs de la séance, présents, encore en jeu. */
  const attendus = s.characters.filter((c) => c.kind !== 'pnj' && c.present && !c.horsJeu)
  const sousTitreDefaut = [s.campaign?.name, s.session?.label].filter(Boolean).join(' · ')

  /* Dans la fenêtre : le champ, son libellé et son aide. Dans les Paramètres :
     le champ seul, la ligne le nomme. */
  const montre = (k: keyof ReglagesAttente): boolean => !seul || seul === k
  const champ = (
    k: keyof ReglagesAttente,
    nom: string,
    aide: string | null,
    contenu: JSX.Element,
    htmlFor?: string
  ): JSX.Element | null => {
    if (!montre(k)) return null
    if (seul) return contenu
    return (
      <div className="field">
        <label htmlFor={htmlFor}>{nom}</label>
        {contenu}
        {aide ? <p className="aide">{aide}</p> : null}
      </div>
    )
  }

  return (
    <>
      {champ(
        'titre',
        'Titre',
        null,
        <ChampTexte
          id="att-titre"
          valeur={r.titre}
          onChange={(titre) => onChange({ titre })}
          auBlur={auBlur}
          onEnter={onEnter}
          placeholder={DEFAUT.titre}
          autoFocus={!seul}
        />,
        'att-titre'
      )}
      {champ(
        'sousTitre',
        'Au-dessus du titre',
        'Vide : le nom de la campagne et de la séance.',
        <ChampTexte
          id="att-sous"
          valeur={r.sousTitre}
          onChange={(sousTitre) => onChange({ sousTitre })}
          auBlur={auBlur}
          onEnter={onEnter}
          placeholder={sousTitreDefaut || 'Le nom de la campagne'}
        />,
        'att-sous'
      )}
      {champ(
        'minutes',
        'Compte à rebours',
        'Il part au lancement ; à zéro, l’écran annonce « C’est l’heure ! ».',
        <div className="att-minutes">
          {[0, 5, 10, 15, 30].map((m) => (
            <button
              key={m}
              type="button"
              className={`btn btn-sm${r.minutes === m ? ' btn-on' : ''}`}
              onClick={() => onChange({ minutes: m })}
            >
              {m ? `${m} min` : 'Aucun'}
            </button>
          ))}
          <div className="avec-unite">
            <input
              id="att-min"
              type="number"
              min={0}
              max={MINUTES_MAX}
              value={r.minutes}
              onChange={(e) =>
                onChange({ minutes: Math.max(0, Math.min(MINUTES_MAX, Number(e.target.value) || 0)) })
              }
            />
            <span className="unite">min</span>
          </div>
        </div>,
        'att-min'
      )}
      {champ(
        'lueurs',
        'Couleurs du fond',
        'Trois lueurs qui dérivent lentement dans le ciel. Préfère des teintes sombres : le titre reste lisible.',
        <div className="att-lueurs">
          {r.lueurs.map((c, i) => (
            <input
              key={i}
              type="color"
              value={c}
              onChange={(e) => {
                const l = [...r.lueurs] as [string, string, string]
                l[i] = e.target.value
                onChange({ lueurs: l })
              }}
              title={`Lueur ${i + 1}`}
              aria-label={`Couleur de la lueur ${i + 1}`}
            />
          ))}
          <span className="sep" />
          {AMBIANCES.map((a) => (
            <button
              key={a.nom}
              type="button"
              className={`att-ambiance${a.lueurs.join() === r.lueurs.join() ? ' on' : ''}`}
              onClick={() => onChange({ lueurs: a.lueurs })}
              title={a.nom}
              style={{ background: `linear-gradient(90deg, ${a.lueurs.join(', ')})` }}
            >
              {a.nom}
            </button>
          ))}
        </div>
      )}
      {champ(
        'musique',
        'Musique d’attente',
        nb
          ? 'Elle tourne en boucle, et s’éteint en fondu quand l’attente quitte l’écran.'
          : 'Aucune ambiance dans la sonothèque : ajoutes-y un son de nature « ambiance ».',
        <select
          id="att-musique"
          value={choisi ?? ''}
          onChange={(e) => onChange({ musique: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">Aucune</option>
          {choix.map((c) => (
            <option key={c.ids[0]} value={c.ids[0]}>
              {libelle(c)}
            </option>
          ))}
        </select>,
        'att-musique'
      )}
      {montre('emojis') ? (
        <ChampEmojis
          id="att-emojis"
          libelle={seul ? '' : 'Émojis'}
          emojis={r.emojis}
          onChange={(emojis) => onChange({ emojis })}
          aide="Ils montent doucement derrière le titre."
        />
      ) : null}
      {montre('joueurs') ? (
        <label className="att-coche">
          <input
            type="checkbox"
            checked={r.joueurs}
            onChange={(e) => onChange({ joueurs: e.target.checked })}
          />
          {seul ? null : 'Montrer les joueurs attendus'}
          <span className="aide">
            {attendus.length
              ? attendus.map((c) => c.name).join(', ')
              : 'aucun joueur présent à cette séance'}
          </span>
        </label>
      ) : null}
      {montre('mj') ? (
        <>
          <label className="att-coche">
            <input type="checkbox" checked={r.mj} onChange={(e) => onChange({ mj: e.target.checked })} />
            {seul ? null : 'Me montrer autour de la table'}
          </label>
          {r.mj ? (
            <div className="att-mj">
              <span className="att-mj-face">
                {portrait ? <img src={portrait} alt="" /> : <span>🎲</span>}
              </span>
              <span className="att-mj-nom">{nomDuMj(s.poste)}</span>
              <button
                type="button"
                className="att-mj-lien"
                onClick={onProfil ?? (() => window.dispatchEvent(new CustomEvent('jdr:parametres', { detail: 'mj' })))}
                title="Ouvrir les paramètres, rubrique « Le maître du jeu »"
              >
                Modifier mon profil dans les paramètres
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </>
  )
}

function FenetreAttente({ onClose }: { onClose: () => void }): JSX.Element {
  const s = useStore()
  useEchap(onClose)
  const [r, setR] = useState<ReglagesAttente>(() => lireAttente(s.reglagesBrut['attente']))
  const pose = (patch: Partial<ReglagesAttente>): void => setR((x) => ({ ...x, ...patch }))
  const { musique } = useAmbiances(r.musique)

  /* Le profil se modifie dans les paramètres : on garde ce qui est déjà
     réglé ici, on ferme, et la fenêtre des paramètres s'ouvre à sa place. */
  const modifierProfil = async (): Promise<void> => {
    await s.poserReglage('attente', JSON.stringify(r))
    onClose()
    window.dispatchEvent(new CustomEvent('jdr:parametres', { detail: 'mj' }))
  }

  /* Ceux qu'on attend : les joueurs de la séance, présents, encore en jeu. */
  const attendus = s.characters.filter((c) => c.kind !== 'pnj' && c.present && !c.horsJeu)
  const sousTitreDefaut = [s.campaign?.name, s.session?.label].filter(Boolean).join(' · ')

  /* Le MJ en tête : l'écran le pose au-dessus de la rangée des joueurs. */
  const autourDeLaTable = (): Extract<SlidePayload, { type: 'attente' }>['joueurs'] => {
    const joueurs = r.joueurs
      ? attendus.map((c) => ({
          id: c.id,
          name: c.name,
          player: playerOf(s, c.id)?.name ?? c.player ?? undefined,
          url: itemById(s.allItems, c.portraitItemId)?.url ?? null,
          cadre: c.portraitCadre,
          color: c.color
        }))
      : []
    if (!r.mj) return joueurs
    const mj = {
      id: 0,
      name: nomDuMj(s.poste),
      player: 'Maître du jeu',
      url: s.poste.mjImage,
      cadre: null,
      color: 'brass',
      mj: true
    }
    return [mj, ...joueurs]
  }

  const lancer = async (): Promise<void> => {
    await s.poserReglage('attente', JSON.stringify(r))
    const maintenant = Date.now()
    await window.jdr.display.show({
      type: 'attente',
      titre: r.titre.trim() || DEFAUT.titre,
      sousTitre: r.sousTitre.trim() || sousTitreDefaut || undefined,
      emojis: r.emojis,
      debut: maintenant,
      fin: r.minutes > 0 ? maintenant + r.minutes * 60000 : null,
      lueurs: r.lueurs,
      musique,
      joueurs: autourDeLaTable()
    })
    if (musique != null) await window.jdr.regieSon.ambiance(musique)
    onClose()
  }

  return (
    <div className="scrim" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <IconSablier />
          <h3>Ça commence bientôt</h3>
        </header>
        <div className="body">
          <ChampsAttente
            r={r}
            onChange={pose}
            onEnter={() => void lancer()}
            onProfil={() => void modifierProfil()}
          />
        </div>
        <footer>
          <button className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-brass" onClick={() => void lancer()}>
            Lancer à l’écran
          </button>
        </footer>
      </div>
    </div>
  )
}
