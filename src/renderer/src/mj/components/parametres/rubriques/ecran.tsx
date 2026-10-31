import { useStore } from '../../../store'
import { Curseur, Seg } from '../briques'
import type { Reglage } from '../registre'

/* ============================================================
   Écran des joueurs
   ============================================================ */

export const reglages: Reglage[] = [
  {
    id: 'sortie.ecran',
    rubrique: 'ecran',
    nom: 'Écran de sortie',
    aide: 'Choisi une fois pour l’installation. La campagne s’en souvient.',
    mots: ['moniteur', 'projecteur', 'télé', 'second écran', 'sortie'],
    Cmd: function SortieEcran() {
      const s = useStore()
      return (
        <select
          value={s.reglages.sortieEcran ?? ''}
          onChange={(e) =>
            void s.poserReglage('sortie.ecran', e.target.value === '' ? null : e.target.value)
          }
        >
          <option value="">Sortie automatique (écran secondaire)</option>
          {s.screens.map((sc) => (
            <option key={sc.id} value={sc.id}>
              {sc.label} · {sc.width}×{sc.height}
            </option>
          ))}
        </select>
      )
    }
  },
  {
    id: 'bascule.mode',
    rubrique: 'ecran',
    nom: 'Manière de basculer, par défaut',
    aide: 'Les trois boutons restent au-dessus de « Basculer ». Ici, celui qui est armé en arrivant.',
    mots: ['transition', 'fondu', 'volet', 'noir'],
    Cmd: function BasculeMode() {
      const s = useStore()
      return (
        <Seg
          valeur={s.reglages.basculeMode}
          choix={[
            { k: 'fondu' as const, label: 'Fondu', aide: 'L’une apparaît pendant que l’autre s’efface' },
            { k: 'volet' as const, label: 'Volet', aide: 'La nouvelle pousse l’ancienne hors de l’écran' },
            { k: 'noir' as const, label: 'Par le noir', aide: 'On passe par le noir entre les deux' }
          ]}
          onChoisir={(k) => s.setTransition(k)}
        />
      )
    }
  },
  {
    id: 'bascule.ms',
    rubrique: 'ecran',
    nom: 'Durée de l’enchaînement',
    aide: 'Le temps que met une bascule. « Couper » l’ignore et change d’un coup.',
    mots: ['transition', 'vitesse', 'temps', 'millisecondes', 'bascule'],
    Cmd: function BasculeMs() {
      const s = useStore()
      return (
        <Curseur
          label="Durée de l’enchaînement"
          valeur={s.reglages.basculeMs}
          min={200}
          max={2500}
          pas={50}
          texte={(v) => `${v} ms`}
          onPoser={(v) => void s.poserReglage('bascule.ms', v)}
        />
      )
    }
  },
  /* ---- En direct : tenu par l'écran des joueurs, perdu à la fermeture. ---- */
  {
    id: 'direct.vision',
    rubrique: 'ecran',
    nom: 'Vision',
    aide: 'Ce que la table voit d’une carte qui a des murs.',
    mots: ['regards', 'plein jour', 'ombre', 'brouillard', 'carte'],
    direct: true,
    Cmd: function Vision() {
      const v = useStore((s) => s.display?.vision ?? 'regards')
      return (
        <Seg
          valeur={v}
          choix={[
            { k: 'regards' as const, label: 'Leurs regards', aide: 'Ils ne voient que ce que leurs personnages ont sous les yeux : l’ombre couvre le reste' },
            { k: 'jour' as const, label: 'Plein jour', aide: 'Toute la carte, sans ombre — les murs retiennent toujours le pas' }
          ]}
          onChoisir={(k) => void window.jdr.display.vision(k)}
        />
      )
    }
  },
  {
    id: 'direct.encart',
    rubrique: 'ecran',
    nom: 'Encart joueurs',
    aide: 'Portraits, noms et points de vie, sur l’écran des joueurs.',
    mots: ['encart', 'portraits', 'joueurs', 'pv', 'bandeau'],
    direct: true,
    Cmd: function EncartJoueurs() {
      const on = useStore((s) => s.display?.encart.on ?? false)
      return (
        <input
          type="checkbox"
          aria-label="Encart joueurs"
          checked={on}
          onChange={(e) => void window.jdr.display.encart({ on: e.target.checked })}
        />
      )
    }
  },
  {
    id: 'direct.encart.sens',
    rubrique: 'ecran',
    nom: 'Sens de l’encart',
    aide: 'Les joueurs en ligne ou en colonne.',
    mots: ['encart', 'horizontal', 'vertical', 'ligne', 'colonne'],
    direct: true,
    Cmd: function EncartSens() {
      const encart = useStore((s) => s.display?.encart)
      const actuel = encart?.sens ?? 'horizontal'
      return (
        <Seg
          valeur={actuel}
          /* Encart éteint : grisé, comme en Régie. */
          desactive={!encart?.on}
          choix={[
            { k: 'horizontal' as const, label: 'En ligne', aide: 'Les joueurs en ligne' },
            { k: 'vertical' as const, label: 'En colonne', aide: 'Les joueurs en colonne' }
          ]}
          /* Changer de sens fait pivoter la boîte, comme en Régie. Le sens
             déjà allumé ne la retourne pas : on clique volontiers ce qui est
             allumé « pour confirmer ». */
          onChoisir={(sens) => {
            if (sens === actuel) return
            void window.jdr.display.encart({
              sens,
              largeur: encart?.hauteur ?? 13,
              hauteur: encart?.largeur ?? 46
            })
          }}
        />
      )
    }
  },
  {
    id: 'direct.encart.sm',
    rubrique: 'ecran',
    nom: 'Santé mentale dans l’encart',
    aide: 'À côté de la vie de chaque joueur.',
    mots: ['encart', 'sm', 'santé mentale', 'sanité'],
    direct: true,
    Cmd: function EncartSm() {
      const encart = useStore((s) => s.display?.encart)
      return (
        <input
          type="checkbox"
          aria-label="Santé mentale dans l’encart"
          checked={encart?.sm ?? false}
          disabled={!encart?.on}
          onChange={(e) => void window.jdr.display.encart({ sm: e.target.checked })}
        />
      )
    }
  },
  {
    id: 'direct.pions.noms',
    rubrique: 'ecran',
    nom: 'Noms sous les pions',
    mots: ['pions', 'noms', 'étiquettes', 'joueurs'],
    direct: true,
    Cmd: function PionsNoms() {
      const on = useStore((s) => s.display?.pionLabels ?? true)
      return (
        <input
          type="checkbox"
          aria-label="Noms sous les pions"
          checked={on}
          onChange={(e) => void window.jdr.display.pionLabels(e.target.checked)}
        />
      )
    }
  },
  {
    id: 'direct.pions.pv',
    rubrique: 'ecran',
    nom: 'PV sous les pions',
    mots: ['pions', 'pv', 'points de vie', 'vie'],
    direct: true,
    Cmd: function PionsPv() {
      const on = useStore((s) => s.display?.pionPv ?? false)
      return (
        <input
          type="checkbox"
          aria-label="PV sous les pions"
          checked={on}
          onChange={(e) => void window.jdr.display.pionPv(e.target.checked)}
        />
      )
    }
  },
  {
    id: 'direct.ambiance.volume',
    rubrique: 'ecran',
    nom: 'Volume de l’ambiance',
    aide: 'La musique d’ambiance de l’écran des joueurs.',
    mots: ['volume', 'ambiance', 'musique', 'son', 'niveau'],
    direct: true,
    Cmd: function AmbianceVolume() {
      const volume = useStore((s) => s.display?.audio.volume ?? 0.35)
      return (
        <Curseur
          label="Volume de l’ambiance"
          valeur={volume * 100}
          min={0}
          max={100}
          volume
          texte={(v) => `${v} %`}
          onPoser={(v) => void window.jdr.display.audio({ volume: v / 100 })}
        />
      )
    }
  }
]

/** Ce qui est aussi ailleurs : on le dit au pied de la rubrique. */
export const apres = (
  <p className="pm-aparte">Ces commandes sont aussi sous la main au Paravent et en Régie.</p>
)
