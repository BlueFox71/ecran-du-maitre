/**
 * La couleur générale de la carte et le temps qu'il y fait, réglés depuis la
 * régie, juste sous le soleil et la lune.
 *
 * C'est le même réglage que l'étape « Éclairage » de l'atelier : il s'écrit
 * dans le lieu et part aussitôt sur l'écran des joueurs.
 */
import { METEOS, type Ambiance } from '@shared/ambiance'

/** Les couleurs d'un clic : les mêmes teintes que les moments de l'atelier. */
const COULEURS: { label: string; teinte: string; force: number; titre: string }[] = [
  { label: 'Dorée', teinte: '#f2b35e', force: 0.3, titre: 'Le soleil levant' },
  { label: 'Orangée', teinte: '#c8643c', force: 0.4, titre: 'Le soleil couchant' },
  { label: 'Bleu nuit', teinte: '#3d5f9e', force: 0.5, titre: 'La nuit sous la lune' },
  { label: 'Nuit profonde', teinte: '#1d2a4a', force: 0.5, titre: 'La nuit sans lune' },
  { label: 'Verte gangrène', teinte: '#5fbf3a', force: 0.35, titre: 'La lueur verte de la Légion' },
  { label: 'Violette', teinte: '#7d4fd1', force: 0.4, titre: 'Une lumière arcanique' }
]

export function CouleurDuLieu({
  ambiance: a,
  regler
}: {
  ambiance: Ambiance
  regler: (patch: Partial<Ambiance>) => void
}): JSX.Element {
  const teinte = a.teinte && a.force > 0 ? a.teinte : null

  return (
    <>
      <span className="eyebrow">Couleur de toute la carte</span>
      <div className="murs-rangee">
        <button className="btn btn-sm" aria-pressed={!teinte} onClick={() => regler({ teinte: null })}>
          Aucune
        </button>
        {COULEURS.map((c) => (
          <button
            key={c.teinte}
            className="btn btn-sm"
            aria-pressed={teinte === c.teinte}
            title={c.titre}
            onClick={() => regler({ teinte: c.teinte, force: c.force })}
          >
            <span
              aria-hidden
              style={{
                display: 'inline-block',
                width: '0.8em',
                height: '0.8em',
                borderRadius: '50%',
                background: c.teinte,
                marginRight: 4,
                verticalAlign: '-0.1em'
              }}
            />
            {c.label}
          </button>
        ))}
        <input
          type="color"
          title="Une couleur à toi"
          value={a.teinte ?? '#3d5f9e'}
          onChange={(e) => regler({ teinte: e.target.value, force: a.force > 0 ? a.force : 0.4 })}
        />
      </div>
      {teinte ? (
        <label className="murs-reglage" title="Combien la couleur pèse sur la carte">
          <span>Force</span>
          <input
            type="range"
            min={5}
            max={100}
            step={1}
            value={Math.round(a.force * 100)}
            onChange={(e) => regler({ force: Number(e.target.value) / 100 })}
          />
          <span className="num">{Math.round(a.force * 100)} %</span>
        </label>
      ) : null}

      <span className="eyebrow">Météo</span>
      <div className="murs-rangee">
        {METEOS.map((m) => (
          <button
            key={m.cle}
            className="btn btn-sm"
            aria-pressed={a.meteo === m.cle}
            title={m.titre}
            onClick={() => regler({ meteo: m.cle })}
          >
            {m.label}
          </button>
        ))}
      </div>
      {a.meteo !== 'aucune' ? (
        <label className="murs-reglage" title="Une bruine ou une averse, un voile ou une purée de pois">
          <span>Intensité</span>
          <input
            type="range"
            min={5}
            max={100}
            step={1}
            value={Math.round(a.meteoForce * 100)}
            onChange={(e) => regler({ meteoForce: Number(e.target.value) / 100 })}
          />
          <span className="num">{Math.round(a.meteoForce * 100)} %</span>
        </label>
      ) : null}
    </>
  )
}
