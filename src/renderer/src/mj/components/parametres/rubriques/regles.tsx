import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../../../store'
import { MonnaiesCampagne } from '../../MonnaiesCampagne'
import { Confirmer } from '../../Rangement'
import { monnaiesPosees, type ReglageMonnaies } from '@shared/monnaies'
import { jaugeSanite, type TemplateSpec } from '@shared/types'
import { Curseur } from '../briques'
import type { Reglage } from '../registre'

/* ============================================================
   Règles du jeu
   ============================================================ */

/** La fiche de campagne, et de quoi en changer une règle. */
function useFiche(): {
  spec: TemplateSpec | null
  poserFiche: (patch: Partial<TemplateSpec>) => Promise<void>
} {
  const s = useStore()
  const spec = s.sheet?.spec ?? null
  /* La fiche se réenregistre entière : ces réglages ne retirent aucune
     ligne, donc aucun personnage ne perd ce qu'il a saisi. */
  const poserFiche = async (patch: Partial<TemplateSpec>): Promise<void> => {
    if (!s.sheet || !spec) return
    await window.jdr.sheet.save({ name: s.sheet.name, spec: { ...spec, ...patch } })
    await s.refreshCharacters()
  }
  return { spec, poserFiche }
}

/** Ce que montre une règle de la fiche tant que celle-ci n'est pas là. */
const sansFiche = <span className="aide">La fiche de campagne n’est pas encore chargée.</span>

export const reglages: Reglage[] = [
  {
    id: 'fiche.jet',
    rubrique: 'regles',
    nom: 'Système de jet',
    aide: 'On note le dé du joueur ; le score, c’est le dé plus la caractéristique.',
    mots: ['dé', 'dés', 'd20', 'd100', 'lancer', 'score'],
    Cmd: function SystemeDeJet() {
      const { spec, poserFiche } = useFiche()
      if (!spec) return sansFiche
      return (
        <select
          value={spec.rollSystem}
          onChange={(e) =>
            void poserFiche({ rollSystem: e.target.value as typeof spec.rollSystem })
          }
        >
          <option value="d20-plus">d20 + caractéristique</option>
          <option value="d100-under">d100 sous la valeur</option>
        </select>
      )
    }
  },
  {
    id: 'fiche.competences',
    rubrique: 'regles',
    nom: 'Compétences',
    aide: 'Décochée, la table ne s’en sert pas : elles disparaissent des fiches, du téléphone et de la préparation. Ce que les personnages avaient pris est gardé.',
    mots: ['talents', 'aptitudes', 'savoir-faire', 'spécialités'],
    Cmd: function Competences() {
      const { spec, poserFiche } = useFiche()
      if (!spec) return sansFiche
      return (
        <input
          type="checkbox"
          checked={!spec.sansCompetences}
          aria-label="Se servir des compétences"
          onChange={(e) => void poserFiche({ sansCompetences: e.target.checked ? undefined : true })}
        />
      )
    }
  },
  {
    id: 'fiche.limite',
    rubrique: 'regles',
    nom: 'Le joueur prend au plus',
    aide: 'Le nombre de compétences qu’une fiche accepte.',
    mots: ['limite', 'maximum', 'nombre', 'compétences', 'plafond'],
    Cmd: function LimiteCompetences() {
      const { spec, poserFiche } = useFiche()
      if (!spec) return sansFiche
      /* Sans compétences, la limite n'a pas d'objet : on le dit plutôt que
         de montrer un champ qui ne mène à rien. */
      if (spec.sansCompetences) return <span className="aide">La table ne se sert pas des compétences.</span>
      const limite = spec.skillLimit ?? null
      return (
        <>
          <input
            type="number"
            min={0}
            style={{ width: 74 }}
            value={limite ?? ''}
            placeholder="∞"
            aria-label="Compétences au plus"
            onChange={(e) =>
              void poserFiche({
                skillLimit: e.target.value === '' ? undefined : Number(e.target.value)
              })
            }
          />
          <span className="pm-val">compétences</span>
          <button
            className={`btn btn-sm${limite === null ? ' btn-on' : ' btn-ghost'}`}
            title="Autant qu’il veut"
            onClick={() => void poserFiche({ skillLimit: limite === null ? 8 : undefined })}
          >
            ∞
          </button>
        </>
      )
    }
  },
  {
    id: 'fiche.sanite',
    rubrique: 'regles',
    nom: 'La santé mentale, c’est',
    aide: 'Celle que l’encart des joueurs montre à côté de la vie. Une jauge ajoutée dans la fiche de campagne apparaît ici une fois appliquée.',
    mots: ['sanité', 'folie', 'jauge', 'raison', 'encart'],
    Cmd: function SanteMentale() {
      const { spec, poserFiche } = useFiche()
      if (!spec) return sansFiche
      const sanite = jaugeSanite(spec, spec.gauges)
      return (
        <select
          value={spec.sanityGauge === null ? '__aucune' : (sanite?.key ?? '')}
          onChange={(e) =>
            void poserFiche({
              sanityGauge: e.target.value === '__aucune' ? null : e.target.value
            })
          }
        >
          {spec.gauges.map((g) => (
            <option key={g.key} value={g.key}>
              {g.label}
            </option>
          ))}
          <option value="__aucune">— aucune —</option>
        </select>
      )
    }
  },
  {
    id: 'pnj.fiche',
    rubrique: 'regles',
    nom: 'Fiche de compétences des PNJ',
    aide: 'Décochée, la fiche d’un PNJ n’a pas de colonne pour lier un PDF ou un scan : ses chiffres prennent la place.',
    mots: ['pnj', 'figurants', 'pdf', 'scan', 'personnages non joueurs'],
    Cmd: function PnjFiche() {
      const s = useStore()
      return (
        <input
          type="checkbox"
          checked={s.reglages.pnjFiche}
          aria-label="Fiche de compétences des PNJ"
          onChange={(e) => void s.poserReglage('pnj.fiche', e.target.checked)}
        />
      )
    }
  },
  {
    id: 'sac.capacite',
    rubrique: 'regles',
    nom: 'Capacité du sac',
    aide: 'Les places de chaque personnage, avant sac à dos. Un objet en prend 1 d’ordinaire ; ce qu’il porte ne compte pas. Sac plein, on ne peut plus rien y mettre.',
    mots: ['inventaire', 'encombrement', 'charge', 'places', 'porter', 'emplacements'],
    Cmd: function SacCapacite() {
      const s = useStore()
      const sansFond = s.reglages.sacCapacite === 0
      return (
        <>
          <Curseur
            label="Capacité du sac"
            valeur={s.reglages.sacCapacite || 10}
            min={1}
            max={60}
            desactive={sansFond}
            texte={(v) => (sansFond ? '∞' : `${v} places`)}
            onPoser={(v) => void s.poserReglage('sac.capacite', v)}
          />
          <button
            className={`btn btn-sm${sansFond ? ' btn-on' : ' btn-ghost'}`}
            title="Un sac sans fond : on y met ce qu’on veut"
            onClick={() => void s.poserReglage('sac.capacite', sansFond ? 10 : 0)}
          >
            {sansFond ? 'Sans limite' : 'Retirer la limite'}
          </button>
        </>
      )
    }
  },
  /* Les monnaies ont remplacé l'unité de valeur. Elles ne sont pas de la
     fiche (elles ne partent pas dans les modèles), mais c'est une règle de la
     table : elles se règlent ici, et attendent « Appliquer ». */
  {
    id: 'monnaies',
    rubrique: 'regles',
    nom: 'Monnaies',
    aide: 'La bourse des personnages et le prix des objets.',
    mots: ['argent', 'bourse', 'pièces', 'or', 'prix', 'devise'],
    pleine: true,
    Cmd: function Monnaies() {
      const s = useStore()
      const enregistre = s.reglages.monnaies
      const [argent, setArgent] = useState<ReglageMonnaies>(enregistre)
      const posees = useMemo(() => monnaiesPosees(s.reglagesBrut['monnaies']), [s.reglagesBrut])
      const sale = JSON.stringify(argent) !== JSON.stringify(enregistre)
      /** La campagne perd son argent : on le dit avant de l'appliquer. */
      const [masquer, setMasquer] = useState(false)
      /* Le réglage a changé ailleurs (une annulation, un chargement tardif) :
         un brouillon intact le suit ; un brouillon entamé reste à qui l'écrit.
         « Intact » se juge contre la valeur d'avant le changement — contre la
         nouvelle, tout brouillon paraîtrait modifié. */
      const suivi = JSON.stringify(enregistre)
      const avant = useRef(suivi)
      useEffect(() => {
        if (JSON.stringify(argent) === avant.current) setArgent(enregistre)
        avant.current = suivi
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [suivi])
      const appliquer = async (masqueAccepte = false): Promise<void> => {
        if (enregistre.actif && !argent.actif && !masqueAccepte) {
          setMasquer(true)
          return
        }
        /* Les monnaies s'écrivent avec leur liste : à partir de là, elles sont
           sur les fiches et ne se suppriment plus. */
        await s.poserReglage('monnaies', JSON.stringify(argent))
        /* Le brouillon reprend ce qui a été relu : il n'est plus « modifié ». */
        setArgent(useStore.getState().reglages.monnaies)
      }
      return (
        <div className="pm-monnaies">
          <MonnaiesCampagne r={argent} posees={posees} onChange={setArgent} />
          <div className="pm-monnaies-pied">
            <span className="aide">
              Une monnaie appliquée est sur les fiches : elle ne se supprime plus.
            </span>
            <div className="spacer" />
            <button className="btn btn-sm btn-brass" disabled={!sale} onClick={() => void appliquer()}>
              Appliquer les monnaies
            </button>
          </div>
          {masquer ? (
            <Confirmer
              titre="Passer la campagne sans monnaie ?"
              oui="Appliquer à la campagne"
              onOui={async () => {
                setMasquer(false)
                await appliquer(true)
              }}
              onNon={() => setMasquer(false)}
            >
              <p>
                La bourse disparaît des fiches et des téléphones, le prix disparaît des objets.
              </p>
              <p>
                <b>Rien n’est effacé</b> : les montants déjà saisis sont simplement masqués. Ils
                reviennent tels quels si la campagne retrouve de l’argent.
              </p>
            </Confirmer>
          ) : null}
        </div>
      )
    }
  }
]
