/**
 * Ce que disent les outils qui parlent — spirit box, livre d'écriture,
 * planche, tarot — et ce que le MJ prépare pour eux. Logique pure, partagée
 * entre le main et le renderer.
 *
 * Les textes préparés sont rangés sur la fiche de l'objet (`objet.parole`,
 * une ligne recopiée avec l'objet quand on duplique une séance) ; ceux du
 * tarot, par carte, dans la séance (`tarot_texte`).
 */

/** Les réglages de la voix, tous de 0 à 1 sauf `grave` (vitesse de lecture). */
export interface ReglagesVoix {
  /** Vitesse de lecture : sous 1, la voix descend et ralentit. */
  grave: number
  /** Part de la voix perdue entre deux stations. */
  hachage: number
  /** L'écho, de sec à caverneux. */
  echo: number
  /** Netteté des paroles : à 0, tout passe à la râpe (grain métallique, saturation) ; à 1, la voix reste lisible. */
  clarte: number
}

/** Les réglages de départ : une voix d'outre-tombe, mais dont on comprend les mots. */
export const REGLAGES_VOIX: ReglagesVoix = { grave: 0.8, hachage: 0.15, echo: 0.45, clarte: 0.6 }

/** Un texte préparé : ce qu'une spirit box dira, ce qu'un livre écrira (avec sa main). */
export interface TextePrepare {
  id: string
  texte: string
  /** Livre : l'écriture (`ECRITURES`), sa taille (multiplicateur) et son inclinaison en degrés. */
  ecriture?: string
  taille?: number
  angle?: number
}

/** Ce que le MJ a préparé pour un outil, pour la séance. */
export interface ParoleObjet {
  textes: TextePrepare[]
  /** Spirit box : la voix Windows (`null` : celle par défaut) et ses réglages. */
  voix?: { nom: string | null; reglages: ReglagesVoix }
}

/** Un texte du tarot, préparé pour une carte et pour la séance. `arcane` : `Arcane.fichier`. */
export interface TexteTarot {
  id: number
  arcane: string
  texte: string
}

const fini = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** La parole d'une fiche, lue d'où qu'elle vienne : jamais d'exception, vide par défaut. */
export function lireParole(brut: unknown): ParoleObjet {
  let v: any = brut
  if (typeof brut === 'string') {
    try {
      v = JSON.parse(brut)
    } catch {
      return { textes: [] }
    }
  }
  if (!v || typeof v !== 'object') return { textes: [] }
  const textes: TextePrepare[] = []
  for (const t of Array.isArray(v.textes) ? v.textes : []) {
    if (!t || typeof t.id !== 'string' || typeof t.texte !== 'string' || !t.texte.trim()) continue
    textes.push({
      id: t.id,
      texte: t.texte,
      ...(typeof t.ecriture === 'string' ? { ecriture: t.ecriture } : {}),
      ...(fini(t.taille) && t.taille > 0 ? { taille: t.taille } : {}),
      ...(fini(t.angle) ? { angle: t.angle } : {})
    })
  }
  const r = v.voix?.reglages
  const voix =
    v.voix && r && fini(r.grave) && fini(r.hachage) && fini(r.echo) && fini(r.clarte)
      ? {
          nom: typeof v.voix.nom === 'string' ? v.voix.nom : null,
          reglages: { grave: r.grave, hachage: r.hachage, echo: r.echo, clarte: r.clarte }
        }
      : undefined
  return { textes, ...(voix ? { voix } : {}) }
}
