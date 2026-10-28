import { activeCampaignId, getDb } from './db/index'
import * as chars from './db/repos/characters'
import * as objets from './db/repos/objets'
import * as rolls from './db/repos/rolls'
import * as surlignage from './db/repos/surlignage'
import type { ChoixReinit } from '@shared/types'

/**
 * Remettre la séance à son départ — pour la rejouer, ou pour l'essayer avant
 * la table. Le MJ coche ce qu'il veut remettre ; le reste ne bouge pas.
 *
 * Tout passe par un seul appel suivi par le défaire : un Ctrl+Z rend la
 * séance telle qu'elle était, objets, jauges et journaux compris.
 */
export function reinitialiser(c: ChoixReinit): {
  objets: number
  jauges: number
  surlignages: number
  pions: number
} {
  const db = getDb()
  const cid = activeCampaignId()
  let ranges = 0
  let jauges = 0

  if (c.objets) {
    /* Tous les exemplaires de la campagne : `ranger` ne bouge que ceux qui ont
       quitté leur emplacement initial, et laisse ceux qui l'ont perdu. */
    const ids = (
      db
        .prepare(
          `SELECT p.id FROM objet_placement p JOIN objet o ON o.id = p.objet_id WHERE o.campaign_id = ?`
        )
        .all(cid) as { id: number }[]
    ).map((r) => r.id)
    ranges = objets.ranger(ids)
  }

  const persos = chars
    .listCharacters()
    .filter((p) => !p.horsJeu && ((p.kind === 'pj' && c.jaugesPj) || (p.kind === 'pnj' && c.jaugesPnj)))
  for (const p of persos)
    for (const [cle, g] of Object.entries(p.data.gauges)) {
      if (g.value >= g.max) continue
      chars.adjustGauge(p.id, cle, g.max - g.value, 'Réinitialisation de la séance')
      jauges++
    }

  if (c.modifs)
    for (const p of chars.listCharacters())
      if (p.kind === 'pj' && (p.data.modifs ?? []).length) chars.setModifs(p.id, [])

  /* Les journaux en dernier : les remises au maximum ci-dessus n'y laissent pas de trace. */
  if (c.journalJauges)
    db.prepare(`DELETE FROM character_log WHERE character_id IN (SELECT id FROM character WHERE campaign_id = ?)`).run(
      cid
    )
  if (c.journalJets) rolls.clearSessionRolls()
  const surlignages = c.surlignages ? surlignage.toutEffacer() : 0
  /* Les joueurs quittent le plateau : on les reposera là où la partie reprend.
     Les pions des PNJ et les images restent où le MJ les a mis. */
  const pions = c.pionsPj
    ? db
        .prepare(
          `DELETE FROM pion WHERE character_id IN (SELECT id FROM character WHERE campaign_id = ? AND kind = 'pj')`
        )
        .run(cid).changes
    : 0

  return { objets: ranges, jauges, surlignages, pions }
}
