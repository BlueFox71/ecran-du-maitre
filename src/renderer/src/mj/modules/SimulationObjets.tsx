/**
 * Simulation Objets — le matériel du chasseur de fantômes, essayé à part
 * avant d'aller sur la carte : l'EMF, le thermomètre, la Spirit Box, la planche
 * de spiritisme, le tarot, le livre d'écriture.
 *
 * Un petit menu en tête, un bouton par objet (sa photo, son nom) ; on n'en
 * voit qu'un à la fois. Les autres restent montés, cachés : changer d'objet
 * ne vide pas le livre ni n'éteint le thermomètre.
 *
 * Pour le MJ seul : rien ne part vers l'écran ni les portables.
 */
import { useEffect, useState } from 'react'
import { Emf } from './Emf'
import { Livre } from '../chasse/Livre'
import { Thermometre } from '../chasse/Thermometre'
import { SpiritBox } from '../chasse/SpiritBox'
import { Planche } from '../chasse/Planche'
import { Tarot } from '../chasse/Tarot'
import imageEmf from '../../assets/chasse/emf.png'
import imageThermometre from '../../assets/chasse/thermometre.png'
import imageLivre from '../../assets/chasse/livre.jpg'
import imageSpirit from '../../assets/chasse/spirit-box.png'
import imagePlanche from '../../assets/chasse/planche.jpg'
import imageTarot from '../../assets/chasse/tarot-hante/17-la-lune.jpg'

type IdObjet = 'emf' | 'thermometre' | 'spirit' | 'planche' | 'tarot' | 'livre'

const OBJETS: { id: IdObjet; nom: string; image?: string; aide: string }[] = [
  {
    id: 'emf',
    nom: 'EMF',
    image: imageEmf,
    aide: 'Plus le niveau monte, plus les LED s’allument et plus le son s’emballe.'
  },
  {
    id: 'thermometre',
    nom: 'Thermomètre',
    image: imageThermometre,
    aide: 'Choisis une température : l’écran la rejoint en douceur.'
  },
  {
    id: 'spirit',
    nom: 'Spirit Box',
    image: imageSpirit,
    aide: 'La radio balaie les fréquences ; tape ce que l’esprit répond, sa voix passe dans le grésillement.'
  },
  {
    id: 'planche',
    nom: 'Planche',
    image: imagePlanche,
    aide: 'Clique une case ou tape une lettre : la goutte glisse jusqu’à elle.'
  },
  {
    id: 'tarot',
    nom: 'Tarot',
    image: imageTarot,
    aide: 'Choisis les cartes : elles se retournent sur le tapis, leur texte dessous.'
  },
  {
    id: 'livre',
    nom: 'Livre d’écriture',
    image: imageLivre,
    aide: 'Tape ce que le fantôme écrit : une main invisible le trace au crayon.'
  }
]

const CLE_OBJET = 'simulation.objet'

function objetEnregistre(): IdObjet {
  try {
    const v = localStorage.getItem(CLE_OBJET)
    if (OBJETS.some((o) => o.id === v)) return v as IdObjet
  } catch {
    /* sans stockage, on ouvre le premier */
  }
  return OBJETS[0].id
}

export function SimulationObjets(): JSX.Element {
  const [choisi, setChoisi] = useState<IdObjet>(objetEnregistre)

  useEffect(() => {
    try {
      localStorage.setItem(CLE_OBJET, choisi)
    } catch {
      /* rien de grave */
    }
  }, [choisi])

  const contenu: Record<IdObjet, JSX.Element> = {
    emf: <Emf />,
    thermometre: <Thermometre />,
    spirit: <SpiritBox />,
    planche: <Planche visible={choisi === 'planche'} />,
    tarot: <Tarot />,
    livre: <Livre />
  }

  return (
    <section className="view simu-vue">
      <div className="vhead">
        <div>
          <h2>Simulation Objets</h2>
          <p>
            Le matériel des chasseurs de fantômes, à essayer et à régler. Pour toi seul, rien ne part
            vers l’écran ni les portables.
          </p>
        </div>
      </div>

      <nav className="simu-menu" aria-label="Objets à simuler">
        {OBJETS.map((o) => (
          <button
            key={o.id}
            className={`simu-menu-objet${o.id === choisi ? ' on' : ''}`}
            aria-pressed={o.id === choisi}
            onClick={() => setChoisi(o.id)}
          >
            {o.image ? (
              <img src={o.image} alt="" draggable={false} className={`simu-vignette v-${o.id}`} />
            ) : (
              <span className="simu-vignette-icone" aria-hidden>
                {/* Une radio et ses ondes, en attendant la photo. */}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <rect x="5" y="8" width="14" height="13" rx="2" />
                  <rect x="8" y="11" width="8" height="3" rx="0.5" />
                  <circle cx="12" cy="17.5" r="1.6" />
                  <path d="M15 8 18 3" />
                  <path d="M20 5.5a4 4 0 0 1 1 3" />
                </svg>
              </span>
            )}
            <span>{o.nom}</span>
          </button>
        ))}
      </nav>

      {OBJETS.map((o) => (
        <article key={o.id} className={`simu-case simu-${o.id}`} hidden={o.id !== choisi}>
          <header>
            <h3>{o.nom}</h3>
            <p>{o.aide}</p>
          </header>
          {contenu[o.id]}
        </article>
      ))}
    </section>
  )
}
