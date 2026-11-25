/**
 * Le tarot : le MJ choisit lui-même les cartes, autant qu'il veut. Une carte
 * cliquée dans le jeu s'ajoute au bout du tapis et se retourne aussitôt, son
 * texte dessous ; un clic sur elle la recache.
 *
 * Le jeu « Daguerréotypes » : des photographies hantées générées pour l'Écran
 * (assets/chasse/tarot-hante/), que l'Écran encadre lui-même — carton jauni,
 * filets, chiffre romain en haut, nom en bas — pour l'orthographe exacte et
 * le format d'une vraie carte.
 *
 * Les 22 arcanes majeurs et leurs textes : arcanes.ts. Rien ne part vers
 * l'écran ni les portables.
 */
import { useState } from 'react'
import { ARCANES, arcaneParFichier, poser, type Arcane, type CartePosee } from './arcanes'

/** L'adresse d'une photographie du jeu (Vite la range avec le reste de l'appli). */
const image = (fichier: string): string =>
  new URL(`../../assets/chasse/tarot-hante/${fichier}.jpg`, import.meta.url).href

/** La face d'une carte : la photo dans son cadre, chiffre en haut, nom en bas. */
function Recto({ a }: { a: Arcane }): JSX.Element {
  return (
    <span className="tarot-recto cadre-hante">
      <span className="ch-numero">{a.numero || '·'}</span>
      <span className="ch-photo">
        <img src={image(a.fichier)} alt={a.nom} draggable={false} />
      </span>
      <span className="ch-nom">{a.nom}</span>
    </span>
  )
}

/** Le dos : encadré comme les faces, sans chiffre ni nom. */
function Dos(): JSX.Element {
  return (
    <span className="tarot-dos cadre-hante dos-hante">
      <span className="ch-photo">
        <img src={image('dos')} alt="Dos de carte" draggable={false} />
      </span>
    </span>
  )
}

export function Tarot(): JSX.Element {
  const [tapis, setTapis] = useState<CartePosee[]>([])

  const basculer = (fichier: string): void =>
    setTapis((l) => l.map((c) => (c.fichier === fichier ? { ...c, retournee: !c.retournee } : c)))

  return (
    <div className="tarot-case">
      <div className="tarot-gauche">
        <div className="tarot-tapis">
          {tapis.length ? (
            tapis.map((c) => {
              const a = arcaneParFichier(c.fichier)
              if (!a) return null
              return (
                <figure key={c.fichier} className="tarot-place">
                  <button
                    className={`tarot-carte arrive${c.retournee ? ' face' : ''}`}
                    onClick={() => basculer(c.fichier)}
                    title={c.retournee ? 'Cliquer : la remettre face cachée' : 'Cliquer : la retourner'}
                  >
                    <span className="tarot-interieur">
                      <Dos />
                      <Recto a={a} />
                    </span>
                  </button>
                  {/* Le nom est déjà sur la carte : dessous, seulement son texte. */}
                  <div className={`tarot-texte${c.retournee ? ' vu' : ''}`}>
                    <p>{a.texte}</p>
                  </div>
                  <button
                    className="btn btn-sm btn-ghost tarot-retirer"
                    onClick={() => setTapis((l) => l.filter((x) => x.fichier !== c.fichier))}
                  >
                    Retirer
                  </button>
                </figure>
              )
            })
          ) : (
            <div className="tarot-emplacement">Choisis une carte dans le jeu</div>
          )}
        </div>

        <div className="tarot-jeu" aria-label="Le jeu : cliquer une carte l’ajoute au tapis">
          {ARCANES.map((a) => {
            const posee = tapis.some((c) => c.fichier === a.fichier)
            return (
              <button
                key={a.fichier}
                className={`tarot-vignette${posee ? ' posee' : ''}`}
                disabled={posee}
                onClick={() => {
                  setTapis((l) => poser(l, a.fichier))
                  /* Elle arrive face cachée, puis se retourne d'elle-même. */
                  setTimeout(
                    () =>
                      setTapis((l) =>
                        l.map((c) => (c.fichier === a.fichier ? { ...c, retournee: true } : c))
                      ),
                    420
                  )
                }}
                title={posee ? `${a.nom} — déjà sur le tapis` : `Poser ${a.nom}`}
              >
                <img src={image(a.fichier)} alt="" draggable={false} />
                <span>{a.nom}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="tarot-commandes">
        <div className="emf-ligne">
          <button
            className="btn btn-sm"
            onClick={() => setTapis((l) => l.map((c) => ({ ...c, retournee: true })))}
            disabled={!tapis.some((c) => !c.retournee)}
          >
            Tout retourner
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => setTapis([])} disabled={!tapis.length}>
            Vider le tapis
          </button>
        </div>
        <p className="emf-aide">
          Clique une carte du jeu : elle s’ajoute au bout du tapis et se retourne, son texte dessous.
          Clique-la sur le tapis pour la cacher ou la retourner de nouveau.
        </p>
      </div>
    </div>
  )
}
