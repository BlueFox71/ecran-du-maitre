/**
 * Recopier ce qu'une séance possède vers une autre : familles, objets,
 * inventaires, pochette.
 *
 * Chaque séance a les siens. Quand on en reprend d'une autre — import,
 * duplication, lieu ou PNJ repris, et la migration qui a séparé les séances —
 * on en tire des **copies** : ce qu'on y changera ne remontera jamais.
 *
 * La séance cible est toujours passée en paramètre, jamais lue dans la
 * séance active : la migration copie avant qu'aucune ne soit ouverte.
 *
 * Une `Correspondance` retient ce qui a déjà été copié pendant une même
 * opération : deux objets d'une même famille n'en font pas deux copies.
 */
import { copierLigne } from '../copie'
import { getDb } from '../index'

export interface Correspondance {
  objets: Map<number, number>
  familles: Map<number, number>
  inventaires: Map<number, number>
  onglets: Map<number, number>
}

export function nouvelleCorrespondance(): Correspondance {
  return { objets: new Map(), familles: new Map(), inventaires: new Map(), onglets: new Map() }
}

const cle = (nom: string): string => nom.trim().toLocaleLowerCase('fr')

/**
 * La famille dans `sid` : celle du même nom si la séance en a déjà une — pas
 * de deuxième « Documents » —, sinon une copie.
 */
export function copierFamille(familleId: number, sid: number, c: Correspondance): number {
  const deja = c.familles.get(familleId)
  if (deja != null) return deja
  const db = getDb()
  const src = db.prepare(`SELECT nom FROM objet_famille WHERE id = ?`).get(familleId) as { nom: string }
  const homonyme = (
    db.prepare(`SELECT id, nom FROM objet_famille WHERE session_id = ? ORDER BY ord, id`).all(sid) as {
      id: number
      nom: string
    }[]
  ).find((f) => cle(f.nom) === cle(src.nom))
  const id = homonyme?.id ?? copierLigne('objet_famille', familleId, { session_id: sid, masquee_depuis: null })
  c.familles.set(familleId, id)
  return id
}

/** La famille était-elle masquée à partir de `sid` ou d'une séance d'avant ? */
function masqueePour(familleId: number, sid: number): boolean {
  return !!getDb()
    .prepare(
      `SELECT 1 FROM objet_famille f, game_session m, game_session s
        WHERE f.id = ? AND m.id = f.masquee_depuis AND s.id = ?
          AND (s.ord > m.ord OR (s.ord = m.ord AND s.id >= m.id))`
    )
    .get(familleId, sid)
}

/**
 * La fiche seule — nom, description, image, effets… —, sans aucun
 * exemplaire. Sa famille suit, sauf si elle était masquée pour `sid` : la
 * copie part alors sans famille plutôt que de la faire revivre.
 */
export function copierObjet(objetId: number, sid: number, c: Correspondance): number {
  const src = getDb().prepare(`SELECT famille_id AS f FROM objet WHERE id = ?`).get(objetId) as {
    f: number | null
  }
  const famille = src.f == null || masqueePour(src.f, sid) ? null : copierFamille(src.f, sid, c)
  const id = copierLigne('objet', objetId, { session_id: sid, famille_id: famille })
  c.objets.set(objetId, id)
  return id
}

export function copierOnglet(ongletId: number, sid: number, c: Correspondance): number {
  const deja = c.onglets.get(ongletId)
  if (deja != null) return deja
  const id = copierLigne('pochette_onglet', ongletId, { session_id: sid })
  c.onglets.set(ongletId, id)
  return id
}

/**
 * Un inventaire, vide : son contenu, ce sont les exemplaires qu'on y range.
 * `enPochette: false` : la copie n'est pas passée à la pochette, quoi qu'il
 * en soit de l'original.
 */
export function copierInventaire(
  invId: number,
  sid: number,
  c: Correspondance,
  o: { enPochette: boolean }
): number {
  const deja = c.inventaires.get(invId)
  if (deja != null) return deja
  const src = getDb()
    .prepare(`SELECT en_pochette AS p, pochette_onglet_id AS o FROM inventaire WHERE id = ?`)
    .get(invId) as { p: number; o: number | null }
  const garde = o.enPochette && !!src.p
  const id = copierLigne('inventaire', invId, {
    session_id: sid,
    en_pochette: garde ? 1 : 0,
    pochette_onglet_id: garde && src.o != null ? copierOnglet(src.o, sid, c) : null
  })
  c.inventaires.set(invId, id)
  return id
}

/**
 * Un document de la pochette, dans la copie de son onglet.
 * 'depart' : caché, lu par personne — comme s'il venait d'y être glissé.
 * 'actuel' : tel quel, avec ceux qui l'ont lu.
 * Rend null quand la séance l'a déjà (même document, même destinataire), ou
 * quand il vient d'un inventaire que la séance n'a pas.
 */
export function copierDoc(
  pochetteId: number,
  sid: number,
  c: Correspondance,
  mode: 'depart' | 'actuel'
): number | null {
  const db = getDb()
  const src = db
    .prepare(
      `SELECT item_id AS item, player_key AS joueur, onglet_id AS onglet, inventaire_id AS inv
         FROM pochette WHERE id = ?`
    )
    .get(pochetteId) as { item: number; joueur: number; onglet: number | null; inv: number | null }
  let inv: number | null = null
  if (src.inv != null) {
    inv = c.inventaires.get(src.inv) ?? null
    if (inv == null) return null
  }
  const deja = db
    .prepare(`SELECT 1 FROM pochette WHERE session_id = ? AND item_id = ? AND player_key = ?`)
    .get(sid, src.item, src.joueur)
  if (deja) return null
  const id = copierLigne('pochette', pochetteId, {
    session_id: sid,
    onglet_id: src.onglet == null ? null : copierOnglet(src.onglet, sid, c),
    inventaire_id: inv,
    ...(mode === 'depart' ? { visible: 0 } : {})
  })
  if (mode === 'actuel')
    db.prepare(
      `INSERT INTO pochette_lu (pochette_id, player_id, read_at)
       SELECT ?, player_id, read_at FROM pochette_lu WHERE pochette_id = ?`
    ).run(id, pochetteId)
  return id
}

/**
 * Tout ce que les exemplaires de `sid` et les fiches de ses lieux désignent
 * hors de `sid` — l'objet, l'inventaire où il est, celui d'où il part — est
 * remplacé par une copie dans `sid`, faite une seule fois. Les inventaires
 * gardent leur passage à la pochette : c'est la même séance qui continue
 * ailleurs, pas un import.
 */
export function rattacherASeance(sid: number, c: Correspondance = nouvelleCorrespondance()): Correspondance {
  const db = getDb()
  const objetIci = (id: number): number => c.objets.get(id) ?? copierObjet(id, sid, c)
  const invIci = (id: number): number => copierInventaire(id, sid, c, { enPochette: true })

  const objetsAilleurs = db
    .prepare(
      `SELECT DISTINCT p.objet_id AS id FROM objet_placement p JOIN objet o ON o.id = p.objet_id
        WHERE p.session_id = ? AND o.session_id IS NOT ?`
    )
    .all(sid, sid) as { id: number }[]
  const majObjet = db.prepare(`UPDATE objet_placement SET objet_id = ? WHERE session_id = ? AND objet_id = ?`)
  for (const o of objetsAilleurs) majObjet.run(objetIci(o.id), sid, o.id)

  /* Un objet de la séance range ses pareils dans une famille de la séance. */
  const famillesAilleurs = db
    .prepare(
      `SELECT o.id, o.famille_id AS f FROM objet o JOIN objet_famille f ON f.id = o.famille_id
        WHERE o.session_id = ? AND f.session_id IS NOT ?`
    )
    .all(sid, sid) as { id: number; f: number }[]
  for (const o of famillesAilleurs)
    db.prepare(`UPDATE objet SET famille_id = ? WHERE id = ?`).run(
      masqueePour(o.f, sid) ? null : copierFamille(o.f, sid, c),
      o.id
    )

  for (const col of ['inventaire_id', 'init_inventaire_id']) {
    const ailleurs = db
      .prepare(
        `SELECT DISTINCT p.${col} AS id FROM objet_placement p JOIN inventaire i ON i.id = p.${col}
          WHERE p.session_id = ? AND i.session_id IS NOT ?`
      )
      .all(sid, sid) as { id: number }[]
    const maj = db.prepare(`UPDATE objet_placement SET ${col} = ? WHERE session_id = ? AND ${col} = ?`)
    for (const i of ailleurs) maj.run(invIci(i.id), sid, i.id)
  }

  for (const [table, cle, parent] of [
    ['lieu_carte_objet', 'carte_id', 'lieu_carte'],
    ['lieu_scenario_objet', 'scenario_id', 'lieu_scenario']
  ] as const) {
    const liens = db
      .prepare(
        `SELECT l.${cle} AS k, l.objet_id AS o FROM ${table} l
           JOIN ${parent} x ON x.id = l.${cle}
           JOIN place pl ON pl.id = x.place_id
           JOIN objet ob ON ob.id = l.objet_id
          WHERE pl.session_id = ? AND ob.session_id IS NOT ?`
      )
      .all(sid, sid) as { k: number; o: number }[]
    for (const l of liens) {
      db.prepare(`INSERT OR IGNORE INTO ${table} (${cle}, objet_id) VALUES (?, ?)`).run(l.k, objetIci(l.o))
      db.prepare(`DELETE FROM ${table} WHERE ${cle} = ? AND objet_id = ?`).run(l.k, l.o)
    }
  }
  return c
}
