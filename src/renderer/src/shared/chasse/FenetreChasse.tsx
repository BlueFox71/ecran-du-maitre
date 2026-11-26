/**
 * La fenêtre de la table : le livre, la planche ou le tirage de tarot que le
 * MJ montre, par-dessus le plan — le plan et les pions restent derrière. Le
 * livre s'y écrit et la goutte y glisse en direct, au même rythme que sur
 * les téléphones : la table est sur le poste, son horloge est la bonne.
 */
import type { FenetreChasse } from '@shared/parole'
import { VueLivre, VuePlanche, VueTarot, livreEcrit, plancheBouge } from './Vues'
import { useMaintenant } from './temps'

export function FenetreChasseVue({ f }: { f: FenetreChasse }): JSX.Element {
  const actif =
    f.sorte === 'livre'
      ? livreEcrit(f.pages, Date.now())
      : f.sorte === 'planche'
        ? plancheBouge(f.goutte, Date.now())
        : false
  const maintenant = useMaintenant(actif)
  return (
    <div className={`fc-fenetre fc-${f.sorte}`} role="dialog" aria-label={f.sorte === 'tarot' ? 'Tarot' : f.nom}>
      {f.sorte === 'livre' ? (
        <VueLivre pages={f.pages} maintenant={maintenant} />
      ) : f.sorte === 'planche' ? (
        <VuePlanche goutte={f.goutte} maintenant={maintenant} />
      ) : (
        <VueTarot cartes={f.cartes} />
      )}
    </div>
  )
}
