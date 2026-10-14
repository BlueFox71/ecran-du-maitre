import { useState } from 'react'
import { SousMenuPreparation } from '../components/SousMenuPreparation'
import { PlanTrame, VoletTrame, demanderCarte, useTrame, type ChoixTrame } from '../components/PlanTrame'

/* ============================================================
   Préparation de la séance — l'Arborescence (« trame » dans le code) :
   le scénario du début à la
   fin, pour savoir quels objectifs font avancer les joueurs. Elle se
   dessine ici ; elle se coche au Paravent.
   ============================================================ */

export function Trame(): JSX.Element {
  const [trame, changer, recharger] = useTrame()
  const [choix, setChoix] = useState<ChoixTrame>(null)
  const faites = trame?.cartes.filter((c) => c.fait).length ?? 0

  return (
    <section className="view chrono">
      <div className="vhead">
        <SousMenuPreparation />
      </div>
      <div className="vhead">
        <div>
          <h2>Arborescence de la séance</h2>
          <p>
            Le scénario en cartes reliées&nbsp;: ce qui ouvre la voie à quoi. Pour toi seul — rien
            n’en part vers l’écran ni les portables. Au Paravent, un clic coche une carte.
          </p>
        </div>
        <div className="spacer" />
        <div className="tm-outils">
          <button className="btn btn-sm" onClick={() => demanderCarte('scene')}>
            <i className="tm-pastille tm-scene" />
            Scène
          </button>
          <button className="btn btn-sm" onClick={() => demanderCarte('objectif')}>
            <i className="tm-pastille tm-objectif" />
            Objectif
          </button>
          <button className="btn btn-sm" onClick={() => demanderCarte('fin')}>
            <i className="tm-pastille tm-fin" />
            Fin
          </button>
          <span className="eyebrow">
            {trame?.cartes.length ?? 0} carte{(trame?.cartes.length ?? 0) > 1 ? 's' : ''}
            {faites ? ` · ${faites} faite${faites > 1 ? 's' : ''}` : ''}
          </span>
        </div>
      </div>

      <div className="tm-grille">
        {trame ? (
          <>
            <PlanTrame
              mode="prep"
              trame={trame}
              changer={changer}
              recharger={recharger}
              choix={choix}
              onChoix={setChoix}
            />
            <aside className="pane tm-cote">
              <VoletTrame trame={trame} changer={changer} choix={choix} onChoix={setChoix} />
            </aside>
          </>
        ) : null}
      </div>
    </section>
  )
}
