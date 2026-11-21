const pluriel = (n: number, un: string, des: string): string => `${n} ${n > 1 ? des : un}`

/** Ce que dit la notification après un import : « 2 objets et 3 documents importés (1 déjà présent) ». */
export function bilanImport(b: { objets: number; documents: number; ignores: number }): string {
  const parts = [
    b.objets ? pluriel(b.objets, 'objet', 'objets') : null,
    b.documents ? pluriel(b.documents, 'document', 'documents') : null
  ].filter(Boolean)
  const n = b.objets + b.documents
  const tete = parts.length ? `${parts.join(' et ')} importé${n > 1 ? 's' : ''}` : 'Rien d’importé'
  return b.ignores ? `${tete} (${pluriel(b.ignores, 'déjà présent', 'déjà présents')})` : tete
}
