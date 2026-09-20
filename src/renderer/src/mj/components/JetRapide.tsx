import { useStore } from '../store'
import { useSaisieJet, VALEURS } from '../modules/jet'
import { IconTrash } from './Icons'

/**
 * Noter un jet sans quitter la page où l'on est.
 *
 * C'est le même geste que dans le module Jets de dés — qui, sur quoi, la valeur
 * annoncée — mais replié sous le rail : pendant une scène, une annonce de dé ne
 * vaut pas qu'on abandonne la carte ou la fiche qu'on avait sous les yeux. Le
 * module reste l'endroit où l'on *relit* la séance ; ici on ne fait qu'écrire.
 */
export function JetRapide(): JSX.Element {
  const s = useStore()
  const {
    perso,
    charId,
    setCharId,
    caracs,
    caracKey,
    setCaracKey,
    carac,
    valeurDe,
    bonus,
    valeur,
    setValeur,
    pret,
    enregistrer
  } = useSaisieJet()

  /* Ce bloc dit « Joueur », et il le dit exprès : un jet de PNJ se tiendrait
     ailleurs, et Jules a laissé la question ouverte. */
  const joueurs = s.characters.filter((c) => c.kind !== 'pnj')
  if (joueurs.length === 0) {
    return (
      <div className="jet-rapide vide" id="jet-rapide">
        Aucun personnage. Les fiches se créent dans «&nbsp;Fiches&nbsp;».
      </div>
    )
  }

  /* On garde la somme sous les yeux au moment d'écrire : c'est elle qu'on
     annonce à la table, et la seule chose qu'on ait à vérifier. */
  const total = valeur !== null ? valeur + bonus : null

  return (
    <div className="jet-rapide" id="jet-rapide">
      <div className="jr-bloc">
        <span className="eyebrow">Joueur</span>
        <div className="jr-opts" role="radiogroup" aria-label="Joueur">
          {joueurs.map((c) => (
            <label key={c.id} className="jr-opt" title={c.name}>
              <input
                type="radio"
                name="jr-joueur"
                checked={c.id === charId}
                onChange={() => setCharId(c.id)}
              />
              <span className={`pip teinte c-${c.color ?? 'neutral'}`} />
              <span className="t">{c.player?.trim() || c.name}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="jr-bloc">
        <span className="eyebrow">Caractéristique</span>
        {caracs.length === 0 ? (
          <p className="rien">Ce gabarit n'a aucune caractéristique.</p>
        ) : (
          <div className="jr-opts jr-caracs" role="radiogroup" aria-label="Caractéristique">
            {caracs.map((x) => (
              <label key={x.key} className="jr-opt">
                <input
                  type="radio"
                  name="jr-carac"
                  checked={x.key === caracKey}
                  onChange={() => setCaracKey(x.key)}
                />
                <span className="t">{x.label}</span>
                <b className="v">{valeurDe(x.key)}</b>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="jr-bloc">
        <span className="eyebrow">Valeur du dé</span>
        <div className="jr-des" role="radiogroup" aria-label="Valeur du dé">
          {VALEURS.map((v) => (
            <button
              key={v}
              className={`jr-de${v === valeur ? ' de-on' : ''}`}
              role="radio"
              aria-checked={v === valeur}
              onClick={() => setValeur(v === valeur ? null : v)}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="jr-fin">
        <p className="jr-som">
          {pret ? (
            <>
              {valeur} + {bonus} = <b>{total}</b>
            </>
          ) : (
            <span className="pt">Joueur, carac, dé.</span>
          )}
        </p>
        <button
          className="btn btn-c btn-sm"
          disabled={!pret}
          onClick={async () => {
            /* On ne voit pas le journal d'ici : le message est la seule preuve
               que la ligne est bien partie. */
            const qui = perso?.player?.trim() || perso?.name
            const dit = `${qui} · ${carac?.label} · ${total}`
            if (await enregistrer()) s.toast(`Jet noté — ${dit}`)
          }}
        >
          Enregistrer
        </button>
      </div>

      {s.rolls.length > 0 ? (
        /* Les deux dernières lignes écrites. Elles ne remplacent pas le journal :
           elles disent seulement que la bonne ligne est partie, et offrent le
           seul geste qu'on regrette dans la minute — la reprendre. Un jet
           supprimé va en corbeille, on ne perd rien. */
        <div className="jr-derniers">
          <span className="eyebrow">Derniers jets</span>
          {s.rolls.slice(0, 2).map((r) => (
            <div className={`jr-ligne c-${r.characterColor ?? 'neutral'}`} key={r.id}>
              <span className="h">{r.at.slice(11, 16)}</span>
              <span className="t">
                {(r.playerName?.trim() || r.characterName || 'MJ') + ' · ' + r.label}
              </span>
              <b className="n">{r.result}</b>
              <button
                className="btn btn-ghost btn-sm btn-ico"
                title="Supprimer ce jet — il passe à la corbeille"
                aria-label={`Supprimer le jet ${r.label}`}
                onClick={async () => {
                  await window.jdr.rolls.trash(r.id)
                  await s.refreshRolls()
                }}
              >
                <IconTrash />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
