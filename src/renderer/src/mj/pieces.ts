/**
 * Baptiser une pièce : une forme fermée par les murs d'un plan devient un
 * lieu, rangé sous ce plan, avec son contour et le point qui la désigne.
 *
 * Le plan d'un lieu et l'atelier passent par ici : une pièce nommée dans
 * l'un se retrouve dans l'autre, et dans la liste des lieux.
 */
import { dansForme } from '@shared/pieces'
import type { Place, PointMur } from '@shared/types'

/** Une pièce découpée dans le plan de son étage — pas un niveau de bâtiment cadré. */
export function estPiece(p: Place): boolean {
  return p.tier === 'lieu' && !!p.zone
}

/**
 * Un lieu qui tient des niveaux : la chapelle posée sur le plan de
 * l'extérieur, avec sa nef et sa crypte.
 */
export function estBatiment(p: Place, tous: Place[]): boolean {
  if (p.tier !== 'lieu') return false
  /* Posé à même l'espace, un lieu est un bâtiment — même avant son premier niveau. */
  if (tous.some((q) => q.id === p.parentId && q.tier === 'espace')) return true
  return tous.some((q) => q.parentId === p.id && q.tier === 'niveau')
}

/** Ce lieu n'est qu'une pièce : ses murs le referment, la forme c'est lui. */
export function estPieceUnique(p: Place, tous: Place[]): boolean {
  return (
    p.tier === 'lieu' &&
    !estPiece(p) &&
    !tous.some((q) => q.parentId === p.id && q.tier === 'niveau') &&
    !!p.pieceUnique
  )
}

/** Les pièces nommées d'un plan : ses lieux enfants qui ont un contour. */
export function piecesDuPlan(p: Place, tous: Place[]): Place[] {
  return tous.filter((q) => q.parentId === p.id && q.tier === 'lieu' && !!q.zone)
}

/**
 * Le lieu qui habite une forme — celui dont l'ancre y tombe. On ne compare
 * pas les contours : ils changent dès qu'on déplace une cloison.
 */
export function lieuDansLaForme(pieces: Place[], pts: PointMur[]): Place | null {
  return pieces.find((q) => q.ancre && dansForme(q.ancre, pts)) ?? null
}

/**
 * Ce lieu devient l'étage de ses pièces — au moment où il en reçoit une. Un
 * lieu ne peut pas en contenir d'autres : les trois étages du rangement sont
 * fixes. `false` (avec un message) quand ce n'est pas possible.
 */
export async function devenirEtage(
  p: Place,
  tous: Place[],
  toast: (m: string, erreur?: boolean) => void
): Promise<boolean> {
  if (p.tier === 'niveau') return true
  if (estPieceUnique(p, tous)) {
    toast('Ce lieu est une pièce unique : choisis « Plusieurs pièces » pour le découper', true)
    return false
  }
  if (p.tier === 'espace') {
    toast(
      'Un espace ne tient pas de pièces : trace-les sur l’un de ses niveaux (ajoute-en un dans la liste des lieux)',
      true
    )
    return false
  }
  if (estBatiment(p, tous)) {
    toast('Ce lieu est un bâtiment : trace ses pièces sur l’un de ses niveaux', true)
    return false
  }
  const parent = tous.find((q) => q.id === p.parentId) ?? null
  await window.jdr.places.upsert({
    id: p.id,
    tier: 'niveau',
    parentId: parent?.tier === 'espace' ? parent.id : null,
    name: p.name,
    zone: null
  })
  return true
}

/**
 * Nommer la pièce que dessine `pts` (en fractions du plan), désignée par
 * `ancre`, un point à l'intérieur. Une pièce déjà là est renommée et son
 * contour mis à jour ; sinon un lieu naît sous le plan. Sur une pièce
 * unique, c'est le lieu lui-même qu'on renomme. Rend `false` si rien n'a
 * été fait (le message est déjà donné).
 */
export async function nommerPiece(
  p: Place,
  tous: Place[],
  pts: PointMur[],
  ancre: PointMur,
  nom: string,
  toast: (m: string, erreur?: boolean) => void
): Promise<boolean> {
  if (estPieceUnique(p, tous)) {
    await window.jdr.places.upsert({ id: p.id, tier: p.tier, parentId: p.parentId, name: nom })
    return true
  }
  if (!(await devenirEtage(p, tous, toast))) return false
  const deja = lieuDansLaForme(piecesDuPlan(p, tous), pts)
  if (deja) {
    await window.jdr.places.upsert({ id: deja.id, name: nom, tier: 'lieu', parentId: p.id })
    await window.jdr.places.zone(deja.id, pts, ancre)
  } else {
    const neuf = await window.jdr.places.upsert({ tier: 'lieu', parentId: p.id, name: nom })
    await window.jdr.places.zone(neuf.id, pts, ancre)
  }
  return true
}
