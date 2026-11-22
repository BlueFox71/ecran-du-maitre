/**
 * Le profil de cette machine, en bas du rail, à gauche de la version.
 *
 * Un profil a ses assets privés dans l'atelier : le restaurant de la
 * prochaine séance n'apparaît qu'au profil qui l'a fait. La liste dit, sous
 * chaque prénom, combien d'assets il garde pour lui. Changer de profil
 * relit le catalogue de l'atelier, s'il est ouvert.
 */
import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'

/** Prévenir l'atelier : le catalogue à montrer a changé. */
export const PROFIL_CHANGE = 'atelier-profil-change'

type Profils = { courant: string | null; liste: { nom: string; prives: number }[] }

export function ChoixProfil(): JSX.Element | null {
  const toast = useStore((s) => s.toast)
  const [p, setP] = useState<Profils | null>(null)
  const [ouvert, setOuvert] = useState(false)
  const boite = useRef<HTMLDivElement>(null)

  useEffect(() => {
    /* Sans réponse (une version qui ne connaît pas les profils), pas de menu. */
    window.jdr.atelier.profils().then(setP, () => setP(null))
  }, [])

  /* Un clic ailleurs, ou Échap, referme la liste. */
  useEffect(() => {
    if (!ouvert) return
    const clic = (e: PointerEvent): void => {
      if (!boite.current?.contains(e.target as Node)) setOuvert(false)
    }
    const touche = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOuvert(false)
    }
    window.addEventListener('pointerdown', clic)
    window.addEventListener('keydown', touche)
    return () => {
      window.removeEventListener('pointerdown', clic)
      window.removeEventListener('keydown', touche)
    }
  }, [ouvert])

  if (!p || !p.liste.length) return null

  const choisir = async (nom: string | null): Promise<void> => {
    setOuvert(false)
    if (nom === p.courant) return
    const courant = await window.jdr.atelier.choisirProfil(nom)
    setP({ ...p, courant })
    window.dispatchEvent(new Event(PROFIL_CHANGE))
    toast(courant ? `Profil : ${courant}` : 'Aucun profil : seuls les assets publics sont visibles')
  }
  const pluriel = (n: number): string => (n ? `${n} asset${n > 1 ? 's' : ''} privé${n > 1 ? 's' : ''}` : 'aucun asset privé')

  return (
    <div className="choix-profil" ref={boite}>
      <button
        className="choix-profil-bouton"
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        title="Le profil de cette machine : il voit ses assets privés dans l’atelier"
        onClick={() => setOuvert(!ouvert)}
      >
        <span className="eyebrow">Profil</span>
        <b>{p.courant ?? '—'}</b>
        <span className="choix-profil-chevron">{ouvert ? '▾' : '▴'}</span>
      </button>
      {ouvert ? (
        <ul className="choix-profil-liste" role="listbox" aria-label="Profils">
          {p.liste.map((x) => (
            <li key={x.nom}>
              <button role="option" aria-selected={p.courant === x.nom} onClick={() => void choisir(x.nom)}>
                <span className="nom">{x.nom}</span>
                <span className="quoi">{pluriel(x.prives)}</span>
              </button>
            </li>
          ))}
          <li>
            <button role="option" aria-selected={p.courant === null} onClick={() => void choisir(null)}>
              <span className="nom">Aucun</span>
              <span className="quoi">seulement les assets publics</span>
            </button>
          </li>
        </ul>
      ) : null}
    </div>
  )
}
