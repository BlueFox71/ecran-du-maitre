/**
 * Les mots secrets d'un moment — ce que le MJ glisse à un joueur, ou à
 * quelques-uns, sur leur téléphone, sans que le reste de la table le sache.
 *
 * Deux façons de le donner, côte à côte sous le même champ :
 *
 *  — **garder** : écrit pendant la préparation, il attend ici, sur le moment
 *    où il doit partir, et part d'un clic quand la scène y arrive ;
 *  — **envoyer** : écrit en pleine partie, il part tout de suite.
 *
 * Pour plusieurs joueurs, chacun reçoit son exemplaire et le lit à son heure ;
 * ici, le mot reste une seule ligne, et chaque nom dit s'il l'a lu.
 *
 * Le téléphone vibre (si on le veut) et montre un bandeau qui ne dit rien du
 * contenu. Un seul sens : pas de réponse à attendre.
 */
import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { useEchap } from '../echap'
import { heureLocale } from '@shared/heure'
import { IconClose, IconPen, IconPlus } from './Icons'
import type { CampaignPlayer, MotSecret } from '@shared/types'

const CLE_VIBRE = 'mots.vibre'

/** Un mot tel que le MJ le voit : un texte, et ses exemplaires, un par joueur. */
type Lot = { lot: string; premier: MotSecret; exemplaires: MotSecret[] }

export function MotsSecrets({ beatId }: { beatId: number | null }): JSX.Element {
  const s = useStore()
  const [ouvert, setOuvert] = useState(false)
  const [pour, setPour] = useState<number[]>([])
  const [texte, setTexte] = useState('')
  /* Le mot gardé qu'on retouche, par son lot, s'il y en a un. */
  const [retouche, setRetouche] = useState<string | null>(null)
  /* Faire vibrer le téléphone : le dernier choix du MJ est retenu, il a sa
     table en tête — une vibration s'entend parfois jusqu'au voisin. */
  const [vibre, setVibre] = useState<boolean>(() => {
    try {
      return localStorage.getItem(CLE_VIBRE) !== 'non'
    } catch {
      return true
    }
  })
  const choisirVibre = (v: boolean): void => {
    setVibre(v)
    try {
      localStorage.setItem(CLE_VIBRE, v ? 'oui' : 'non')
    } catch {
      /* le choix tiendra le temps de la fenêtre */
    }
  }

  /* Les exemplaires du moment, réunis par mot, dans l'ordre où ils ont été écrits. */
  const lots = useMemo((): Lot[] => {
    const parLot = new Map<string, Lot>()
    for (const m of s.mots) {
      if (m.beatId !== beatId) continue
      const l = parLot.get(m.lot)
      if (l) l.exemplaires.push(m)
      else parLot.set(m.lot, { lot: m.lot, premier: m, exemplaires: [m] })
    }
    return [...parLot.values()]
  }, [s.mots, beatId])

  /* Les joueurs de la séance — ceux dont le personnage est à la table. Une
     séance où personne n'est noté présent les propose tous, comme les
     téléphones. */
  const joueurs = useMemo((): CampaignPlayer[] => {
    const presents = new Set(
      s.characters.filter((c) => c.kind !== 'pnj' && c.present && !c.horsJeu).map((c) => c.id)
    )
    const la = s.players.filter((p) => p.characterId != null && presents.has(p.characterId))
    return la.length ? la : s.players
  }, [s.players, s.characters])

  const nomDe = (p: { name: string; characterId?: number | null }): string => {
    const perso = s.characters.find((c) => c.id === p.characterId)
    return perso ? `${perso.name} (${p.name})` : p.name
  }
  /* Un mot part même vers un téléphone éteint : il l'attendra. On le dit. */
  const enLigne = (playerId: number): boolean =>
    !!s.mobile?.devices.some((d) => d.playerId === playerId && d.online)

  const basculer = (id: number): void =>
    setPour((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const tous = joueurs.length > 1 && joueurs.every((p) => pour.includes(p.id))

  const fermer = (): void => {
    setOuvert(false)
    setTexte('')
    setPour([])
    setRetouche(null)
    /* Une retouche a pu reprendre le réglage du mot : on revient au choix retenu. */
    try {
      setVibre(localStorage.getItem(CLE_VIBRE) !== 'non')
    } catch {
      /* rien à relire */
    }
  }
  useEchap(fermer, ouvert)

  const pret = pour.length > 0 && texte.trim() !== ''

  const valider = async (envoyer: boolean): Promise<void> => {
    if (!pret) return
    const api = window.jdr.mots
    if (retouche != null) {
      let liste = await api.reecrire(retouche, texte, pour, vibre)
      if (envoyer) liste = await api.envoyer(retouche)
      s.setMots(liste)
    } else {
      s.setMots(await api.ecrire(pour, texte, beatId, envoyer, vibre))
    }
    if (envoyer) {
      const noms = s.players.filter((p) => pour.includes(p.id))
      const absents = noms.filter((p) => !enLigne(p.id))
      s.toast(
        `Mot envoyé à ${noms.map((p) => p.name).join(', ')}` +
          (absents.length
            ? ` — ${absents.map((p) => p.name).join(', ')} le recevr${absents.length > 1 ? 'ont' : 'a'} en se connectant`
            : '')
      )
    }
    fermer()
  }

  const retoucher = (l: Lot): void => {
    setRetouche(l.lot)
    setPour(l.exemplaires.map((m) => m.playerId))
    setTexte(l.premier.texte)
    setVibre(l.premier.vibre)
    setOuvert(true)
  }

  return (
    <div className="pu-mots">
      <div className="pu-sect">
        <span className="eyebrow">Mots secrets</span>
        <span className="pu-line" />
        {ouvert ? null : (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setOuvert(true)}
            disabled={joueurs.length === 0}
            title={
              joueurs.length
                ? 'Glisser un mot à un ou plusieurs joueurs, sur leur téléphone'
                : 'Aucun joueur inscrit à la campagne'
            }
          >
            <IconPlus />
            Écrire un mot
          </button>
        )}
      </div>

      {lots.length ? (
        <ul className="pu-mots-liste">
          {lots.map(({ lot, premier: m, exemplaires }) => {
            const noms = exemplaires.map((x) => x.playerName).join(', ')
            return (
              <li key={lot} className={m.envoyeA ? 'parti' : 'garde'}>
                <span className="qui">
                  {exemplaires.map((x) => (
                    <span
                      key={x.id}
                      className={`dest${x.envoyeA && x.luA ? ' lu' : ''}`}
                      style={x.playerColor ? { color: `var(--${x.playerColor})` } : undefined}
                      title={
                        !x.envoyeA
                          ? `${x.playerName} — pas encore envoyé`
                          : x.luA
                            ? `${x.playerName} l’a lu à ${heureLocale(x.luA)}`
                            : `${x.playerName} ne l’a pas encore lu`
                      }
                    >
                      {x.characterName ?? x.playerName}
                      {x.envoyeA && x.luA ? ' ✓' : ''}
                    </span>
                  ))}
                </span>
                <span className="t" title={m.texte}>
                  {m.texte}
                </span>
                {m.vibre ? null : (
                  <span className="etat" title="Arrive sans faire vibrer le téléphone">
                    silencieux
                  </span>
                )}
                {m.envoyeA ? (
                  <span className={`etat${exemplaires.every((x) => x.luA) ? ' lu' : ''}`}>
                    {exemplaires.every((x) => x.luA)
                      ? exemplaires.length > 1
                        ? 'lu par tous'
                        : `lu à ${heureLocale(m.luA!)}`
                      : `envoyé à ${heureLocale(m.envoyeA)} · ${
                          exemplaires.length > 1
                            ? `lu ${exemplaires.filter((x) => x.luA).length}/${exemplaires.length}`
                            : 'pas encore lu'
                        }`}
                  </span>
                ) : (
                  <>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => retoucher({ lot, premier: m, exemplaires })}
                      title="Retoucher ce mot avant de l’envoyer"
                      aria-label="Retoucher"
                    >
                      <IconPen />
                    </button>
                    <button
                      className="btn btn-brass btn-sm"
                      onClick={async () => {
                        s.setMots(await window.jdr.mots.envoyer(lot))
                        s.toast(`Mot envoyé à ${noms}`)
                      }}
                      title={`Envoyer ce mot sur le téléphone de ${noms}`}
                    >
                      Envoyer
                    </button>
                  </>
                )}
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={async () => s.setMots(await window.jdr.mots.effacer(lot))}
                  title={m.envoyeA ? 'Le reprendre : il disparaît des téléphones' : 'Effacer ce mot'}
                  aria-label={m.envoyeA ? 'Reprendre' : 'Effacer'}
                >
                  <IconClose />
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}

      {ouvert ? (
        <div className="pu-mots-ecrire">
          <div className="tagbar" role="group" aria-label="Pour qui">
            {joueurs.length > 1 ? (
              <button
                className="chip"
                aria-pressed={tous}
                onClick={() => setPour(tous ? [] : joueurs.map((p) => p.id))}
                title={tous ? 'Ne plus choisir personne' : 'Choisir tous les joueurs de la séance'}
              >
                Tous
              </button>
            ) : null}
            {joueurs.map((p) => (
              <button
                key={p.id}
                className="chip"
                aria-pressed={pour.includes(p.id)}
                onClick={() => basculer(p.id)}
                title={enLigne(p.id) ? 'Téléphone connecté' : 'Téléphone pas connecté — il recevra le mot en se connectant'}
              >
                {nomDe(p)}
                {enLigne(p.id) ? null : <span className="hors"> · hors ligne</span>}
              </button>
            ))}
          </div>
          <textarea
            autoFocus
            rows={3}
            value={texte}
            placeholder="Ce qu’eux seuls doivent savoir…"
            onChange={(e) => setTexte(e.target.value)}
            onKeyDown={(e) => {
              /* Ctrl+Entrée : part tout de suite, le geste de la partie. */
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void valider(true)
            }}
          />
          <div className="pu-mots-gestes">
            <button className="btn btn-ghost btn-sm" onClick={fermer}>
              Annuler
            </button>
            <div className="spacer" />
            <label
              className="pu-mots-vibre"
              title="Décoché, le mot arrive en silence : seul le bandeau du téléphone le dit"
            >
              <input type="checkbox" checked={vibre} onChange={(e) => choisirVibre(e.target.checked)} />
              Faire vibrer
            </label>
            <button
              className="btn btn-sm"
              disabled={!pret}
              onClick={() => void valider(false)}
              title={pour.length ? 'Le garder sur ce moment, et l’envoyer d’un clic le moment venu' : 'Choisis d’abord à qui'}
            >
              {retouche != null ? 'Enregistrer' : 'Garder pour ce moment'}
            </button>
            <button
              className="btn btn-brass btn-sm"
              disabled={!pret}
              onClick={() => void valider(true)}
              title={pour.length ? 'L’envoyer tout de suite sur leur téléphone — Ctrl+Entrée' : 'Choisis d’abord à qui'}
            >
              Envoyer maintenant
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
