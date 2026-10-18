/**
 * « Nouvel objet » : une vraie fenêtre, pour le créer d'un coup avec ce qui
 * le définit — son nom, sa catégorie, s'il se compte et combien. Le reste
 * (image, description, effets) se remplit ensuite dans sa fiche, qui s'ouvre
 * dès qu'il existe. La rafale au pied de l'étagère reste là pour en créer
 * dix à la suite.
 */
import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { IconPlus } from './Icons'

export function ModaleNouvelObjet({
  familleDepart,
  onClose
}: {
  /** La catégorie ouverte à gauche, choisie d'office. */
  familleDepart: number | null
  onClose: () => void
}): JSX.Element {
  const s = useStore()
  const familles = s.objetFamilles.filter((f) => !f.masquee)
  const [nom, setNom] = useState('')
  const [familleId, setFamilleId] = useState<number | null>(familleDepart)
  const [compte, setCompte] = useState(false)
  const [qte, setQte] = useState(1)
  const [occupe, setOccupe] = useState(false)
  const champNom = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const touche = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', touche)
    return () => window.removeEventListener('keydown', touche)
  }, [onClose])

  const pret = nom.trim().length > 0 && !occupe

  /** Le créer ; `encore` garde la fenêtre ouverte pour le suivant. */
  const creer = async (encore: boolean): Promise<void> => {
    if (!pret) return
    setOccupe(true)
    try {
      const neuf = await window.jdr.objets.add({ nom: nom.trim(), familleId })
      if (compte) await window.jdr.objets.update(neuf.id, { unique: false, qte: Math.max(1, qte) })
      await s.refreshObjets()
      s.setCurrentObjet(neuf.id)
      if (encore) {
        setNom('')
        champNom.current?.focus()
      } else onClose()
    } catch (e) {
      s.toast('L’objet n’a pas été créé.', true)
      console.error('[nouvel objet]', e)
    } finally {
      setOccupe(false)
    }
  }

  return (
    <div className="scrim" onClick={onClose}>
      <form
        className="modal nobj-modale"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          void creer(false)
        }}
      >
        <header>
          <IconPlus />
          <h3>Nouvel objet</h3>
        </header>
        <div className="body">
          <div className="field">
            <label htmlFor="nobj-nom">Nom</label>
            <input
              id="nobj-nom"
              ref={champNom}
              type="text"
              autoFocus
              value={nom}
              placeholder="Lanterne, clé du grenier, six bougies…"
              onChange={(e) => setNom(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="nobj-cat">Catégorie</label>
            <select
              id="nobj-cat"
              value={familleId ?? ''}
              onChange={(e) => setFamilleId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Sans catégorie</option>
              {familles.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nom}
                </option>
              ))}
            </select>
          </div>
          <div className="nobj-ligne">
            <div className="field">
              <label htmlFor="nobj-type">Type</label>
              <select
                id="nobj-type"
                value={compte ? 'pile' : 'unique'}
                onChange={(e) => setCompte(e.target.value === 'pile')}
              >
                <option value="unique">Pièce unique</option>
                <option value="pile">Se compte</option>
              </select>
            </div>
            {compte ? (
              <div className="field">
                <label htmlFor="nobj-qte">Quantité</label>
                <input
                  id="nobj-qte"
                  type="number"
                  min={1}
                  value={qte}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => setQte(Math.trunc(Number(e.target.value)) || 1)}
                />
              </div>
            ) : null}
          </div>
          <p className="nobj-aide">
            L’image, la description et les effets se remplissent ensuite dans sa fiche, qui s’ouvre
            à droite.
          </p>
        </div>
        <footer>
          <button type="button" className="btn btn-sm" onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="btn btn-sm" disabled={!pret} onClick={() => void creer(true)}>
            Créer et en ajouter un autre
          </button>
          <button type="submit" className="btn btn-brass btn-sm" disabled={!pret}>
            Créer
          </button>
        </footer>
      </form>
    </div>
  )
}
