/**
 * Le carnet des chasseurs, sur le téléphone : deux listes, les indices et les
 * entités. Un toucher entoure, le suivant barre, le troisième efface.
 *
 * Ses marques à lui se dessinent sur le mot, au stylo ; celles des autres
 * joueurs se rangent à droite de la ligne, en petites pastilles pâles à la
 * couleur de leur pion. Rien ne se déduit ici : c'est le livre des fantômes
 * qui fait le travail.
 */
import { useEffect, useState } from 'react'
import { marqueSuivante, type CarnetVu, type ElementCarnet, type EtatMarque } from '@shared/carnetChasse'

export type CarnetTel = CarnetVu & { moi: number | null }

export function Carnet({
  carnet,
  lectureSeule,
  onMarquer
}: {
  carnet: CarnetTel
  /** Un spectateur lit le carnet de celui qu'il suit, sans y écrire. */
  lectureSeule: boolean
  /** Envoie l'état voulu ; rend un message d'erreur, ou null si c'est passé. */
  onMarquer: (elementId: number, etat: EtatMarque | null) => Promise<string | null>
}): JSX.Element {
  /* Ce qu'on vient de toucher, affiché tout de suite en attendant le flux :
     à la table, une marque qui met une seconde à venir se retouche. */
  const [enVol, setEnVol] = useState<Record<number, EtatMarque | null>>({})
  const [erreur, setErreur] = useState<string | null>(null)
  /* Le flux a parlé : c'est lui qui fait foi. */
  useEffect(() => setEnVol({}), [carnet])

  const miennes = new Map<number, EtatMarque>()
  for (const m of carnet.marques) if (m.characterId === carnet.moi) miennes.set(m.elementId, m.etat)
  const maMarque = (id: number): EtatMarque | null => (id in enVol ? enVol[id] : (miennes.get(id) ?? null))

  const toucher = async (id: number): Promise<void> => {
    if (lectureSeule || carnet.moi == null) return
    const voulu = marqueSuivante(maMarque(id))
    setEnVol((v) => ({ ...v, [id]: voulu }))
    setErreur(null)
    const e = await onMarquer(id, voulu)
    if (e) {
      setErreur(e)
      setEnVol((v) => {
        const { [id]: _, ...reste } = v
        return reste
      })
    }
  }

  const ligne = (el: ElementCarnet): JSX.Element => {
    const m = maMarque(el.id)
    const autres = carnet.marques.filter((x) => x.elementId === el.id && x.characterId !== carnet.moi)
    return (
      <li key={el.id}>
        <button
          className="m-cn-ligne"
          onClick={() => void toucher(el.id)}
          disabled={lectureSeule}
          aria-label={`${el.nom}${m === 'entoure' ? ', entouré' : m === 'barre' ? ', barré' : ''}`}
        >
          <span className={`m-cn-nom${m ? ` ${m}` : ''}`}>{el.nom}</span>
          {/* Les autres, en clair sous le mot : qui a entouré, qui a barré,
              chaque prénom à la couleur de son pion. */}
          {autres.length ? (
            <span className="m-cn-autres">
              {(['entoure', 'barre'] as const).map((etat) => {
                const qui = autres.filter((x) => x.etat === etat)
                if (!qui.length) return null
                return (
                  <span key={etat} className={`m-cn-groupe ${etat}`}>
                    <span className="m-cn-signe" aria-label={etat === 'entoure' ? 'entouré par' : 'barré par'}>
                      {etat === 'entoure' ? '○' : '✕'}
                    </span>
                    {qui.map((x, i) => {
                      const j = carnet.joueurs.find((p) => p.characterId === x.characterId)
                      return (
                        <span key={x.characterId} className={`m-cn-qui c-${j?.color ?? 'neutral'}`}>
                          {j?.nom ?? '?'}
                          {i < qui.length - 1 ? ', ' : ''}
                        </span>
                      )
                    })}
                  </span>
                )
              })}
            </span>
          ) : null}
        </button>
      </li>
    )
  }

  const indices = carnet.elements.filter((e) => e.genre === 'indice')
  const entites = carnet.elements.filter((e) => e.genre === 'entite')
  return (
    <div className="m-carnet">
      {erreur ? <p className="m-erreur">{erreur}</p> : null}
      {indices.length ? (
        <section className="m-cn-indices">
          <h3 className="m-cn-titre">Indices</h3>
          <ul className="m-cn-liste">{indices.map(ligne)}</ul>
        </section>
      ) : null}
      {entites.length ? (
        <section className="m-cn-entites">
          <h3 className="m-cn-titre">Entités</h3>
          <ul className="m-cn-liste">{entites.map(ligne)}</ul>
        </section>
      ) : null}
      <p className="m-cn-aide">
        {lectureSeule ? 'Spectateur : lecture seule.' : 'Toucher : entourer · encore : barrer · encore : effacer.'}
      </p>
    </div>
  )
}
