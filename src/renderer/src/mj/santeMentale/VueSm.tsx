import { useCallback, useEffect, useMemo, useState } from 'react'
import { activiteDe, cibleDesEntites, palierDe, type EvenementSm } from '@shared/santeMentale'
import { jaugeSanite } from '@shared/types'
import { useStore } from '../store'
import { ouvrirParametres } from '../components/parametres/registre'
import { IconClose } from '../components/Icons'
import { useSm } from './etat'
import { Bareme, type Ou } from './Bareme'
import { ChoixJoueurs } from './ChoixJoueurs'
import { JournalSm } from './Journal'
import { Bandeaux, Lignes, type JoueurSm } from './Joueurs'

/**
 * La vue SM du Paravent, à la place du détail du pion : le barème à gauche,
 * les joueurs à droite. On coche qui subit, on clique ce qui arrive ; sans
 * personne de coché, l'entrée vaut pour tous les joueurs présents.
 */

/** Les événements de la séance active, relus après un défaire ou une retouche dans les Paramètres. */
function useEvenements(sessionId: number | null): EvenementSm[] {
  const [liste, setListe] = useState<EvenementSm[]>([])
  const relire = useCallback(async (): Promise<void> => {
    setListe(sessionId === null ? [] : await window.jdr.sm.evenements(sessionId))
  }, [sessionId])
  useEffect(() => {
    void relire()
    const f = (): void => void relire()
    window.addEventListener('jdr:defait', f)
    window.addEventListener('jdr:sm-evenements', f)
    return () => {
      window.removeEventListener('jdr:defait', f)
      window.removeEventListener('jdr:sm-evenements', f)
    }
  }, [relire])
  return liste
}

/** L'heure, à la seconde : les comptes à rebours s'affichent sans attendre un changement d'état. */
function useMaintenant(): number {
  const [t, setT] = useState(() => Date.now())
  useEffect(() => {
    const h = setInterval(() => setT(Date.now()), 1000)
    return () => clearInterval(h)
  }, [])
  return t
}

export function VueSm({ onFerme }: { onFerme: () => void }): JSX.Element {
  const r = useStore((s) => s.reglages.sm)
  const spec = useStore((s) => s.sheet?.spec)
  const characters = useStore((s) => s.characters)
  const sessionId = useStore((s) => s.session?.id ?? null)
  const sm = useSm()
  const evenements = useEvenements(sessionId)
  const maintenant = useMaintenant()
  /* L'entrée cliquée, en attendant qu'on dise à qui elle s'applique. */
  const [choix, setChoix] = useState<{
    titre: string
    x: number
    y: number
    exclus?: number[]
    appliquer: (ids: number[]) => unknown
  } | null>(null)

  const jauge = spec ? jaugeSanite(spec, spec.gauges) : undefined

  /* Les joueurs présents et en jeu, ceux que le module vise. */
  const joueurs = useMemo<JoueurSm[]>(() => {
    if (!jauge) return []
    return characters
      .filter((c) => c.kind === 'pj' && c.present && !c.horsJeu)
      .flatMap((c) => {
        const g = c.data.gauges[jauge.key]
        if (!g) return []
        return [{ id: c.id, nom: c.name, sm: g.value, max: g.max || jauge.max, palier: palierDe(g.value, r.paliers) }]
      })
  }, [characters, jauge, r.paliers])

  const tete = (
    <div className="sm-tete">
      <span className="eyebrow">Santé mentale</span>
      <button type="button" className="btn btn-sm btn-ghost" title="Revenir au détail du pion" aria-label="Fermer" onClick={onFerme}>
        <IconClose />
      </button>
    </div>
  )

  if (!jauge)
    return (
      <div className="sm-vue">
        {tete}
        <div className="sm-manque">
          <p>Aucune jauge de santé mentale sur la fiche.</p>
          <button type="button" className="btn btn-sm" onClick={() => ouvrirParametres('sante', 'sm.jauge')}>
            Paramètres › Santé mentale
          </button>
        </div>
      </div>
    )

  const presents = joueurs.map((j) => j.id)
  /**
   * Une entrée « tous » s'applique tout de suite (une cible vide : tous les
   * présents). Les autres demandent à qui, sous le bouton cliqué.
   */
  const demander = (
    tous: boolean,
    titre: string,
    ou: Ou,
    appliquer: (ids: number[]) => unknown,
    exclus?: number[]
  ): void => {
    if (tous) void appliquer([])
    else setChoix({ titre, ...ou, exclus, appliquer })
  }

  const nomCarac = (cle: string): string => {
    const st = spec?.stats.find((x) => x.key === cle)
    return st?.code ?? st?.label ?? cle.toUpperCase()
  }
  const nom = (id: number): string => characters.find((c) => c.id === id)?.name ?? '?'
  const cible = cibleDesEntites(joueurs)
  const moyenne = joueurs.length ? Math.round(joueurs.reduce((t, j) => t + j.sm, 0) / joueurs.length) : null
  const activite = moyenne === null ? null : activiteDe(moyenne, r)

  return (
    <div className="sm-vue">
      {tete}
      <div className="sm-cols">
        <Bareme
          r={r}
          evenements={evenements}
          presents={presents}
          recupsFaites={sm.recupsFaites}
          onChoc={(c, ou) =>
            demander(false, `${c.nom} — qui le subit ?`, ou, (ids) => sm.declarerChoc(c.nom, c.perte, ids))
          }
          onEvenement={(e, ou) => demander(e.tous, `${e.nom} — qui le subit ?`, ou, (ids) => sm.declarerPrix(e, ids))}
          onPrix={(p, ou) => demander(p.tous, `${p.nom} — qui le paie ?`, ou, (ids) => sm.declarerPrix(p, ids))}
          onRecup={(rec, ou) =>
            demander(
              false,
              `${rec.nom} — pour qui ?`,
              ou,
              (ids) => sm.recuperer(rec, ids),
              /* Un remède limité ne se reprend pas avant « Nouvelle scène » ou « Nouvelle nuit ». */
              rec.limite ? (sm.recupsFaites[rec.id] ?? []) : undefined
            )
          }
          onScene={sm.nouvelleScene}
          onNuit={sm.nouvelleNuit}
        />
        <div className="sm-droite">
          <Bandeaux r={r} nom={nom} nomCarac={nomCarac} maintenant={maintenant} />
          {joueurs.length ? (
            <Lignes
              r={r}
              joueurs={joueurs}
              cible={cible}
              nomCarac={nomCarac}
              maintenant={maintenant}
            />
          ) : (
            <p className="sm-vide">Aucun joueur présent avec une jauge de santé mentale.</p>
          )}
          {moyenne !== null ? (
            <p className="sm-moyenne">
              Moyenne {moyenne}
              {activite ? ` — ${activite}` : ''}
            </p>
          ) : null}
          <JournalSm joueurs={joueurs} cle={jauge.key} />
        </div>
      </div>
      {choix ? (
        <ChoixJoueurs
          x={choix.x}
          y={choix.y}
          titre={choix.titre}
          joueurs={joueurs}
          exclus={choix.exclus}
          onClose={() => setChoix(null)}
          onValide={(ids) => {
            setChoix(null)
            void choix.appliquer(ids)
          }}
        />
      ) : null}
    </div>
  )
}
