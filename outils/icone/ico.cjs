/**
 * Assemble un fichier `.ico` multi-couches, sans dépendance.
 *
 * Windows lit deux formes de couches dans un `.ico` :
 *   - un DIB 32 bits (l'ancienne, comprise partout) — retenue jusqu'à 64 px ;
 *   - un PNG entier (depuis Vista) — retenu pour 128 et 256, où le DIB pèserait lourd.
 *
 * Un `.ico` n'est pas une image que Windows redimensionne : c'est un jeu d'images
 * dans lequel il pioche celle qui tombe juste. D'où l'intérêt d'y mettre un dessin
 * par taille plutôt qu'une seule grande image réduite sept fois.
 */

/**
 * Convertit un bitmap BGRA (celui que rend Electron, ligne du haut en premier)
 * en couche DIB : en-tête BITMAPINFOHEADER, pixels à l'envers, puis masque vide.
 */
function coucheDib(bgra, largeur, hauteur) {
  const octetsParLigne = largeur * 4
  const xor = Buffer.alloc(octetsParLigne * hauteur)
  // Un DIB se lit du bas vers le haut : on retourne les lignes.
  for (let y = 0; y < hauteur; y++) {
    const source = (hauteur - 1 - y) * octetsParLigne
    bgra.copy(xor, y * octetsParLigne, source, source + octetsParLigne)
  }

  // Masque monochrome : inutile en 32 bits (l'alpha suffit), mais le format l'exige.
  const largeurMasque = Math.ceil(largeur / 8)
  const largeurMasqueAlignee = Math.ceil(largeurMasque / 4) * 4
  const masque = Buffer.alloc(largeurMasqueAlignee * hauteur)

  const entete = Buffer.alloc(40)
  entete.writeUInt32LE(40, 0) // taille de l'en-tête
  entete.writeInt32LE(largeur, 4)
  entete.writeInt32LE(hauteur * 2, 8) // image + masque, d'où le double
  entete.writeUInt16LE(1, 12) // plans
  entete.writeUInt16LE(32, 14) // bits par pixel
  entete.writeUInt32LE(0, 16) // pas de compression
  entete.writeUInt32LE(xor.length + masque.length, 20)

  return Buffer.concat([entete, xor, masque])
}

/**
 * @param {Array<{largeur:number, hauteur:number, donnees:Buffer}>} couches
 *   `donnees` est soit un PNG, soit le résultat de `coucheDib`.
 * @returns {Buffer} le fichier `.ico` complet
 */
function assembler(couches) {
  const entete = Buffer.alloc(6)
  entete.writeUInt16LE(0, 0) // réservé
  entete.writeUInt16LE(1, 2) // 1 = icône
  entete.writeUInt16LE(couches.length, 4)

  const repertoire = Buffer.alloc(16 * couches.length)
  let position = entete.length + repertoire.length

  couches.forEach((couche, i) => {
    const d = i * 16
    // 256 s'écrit 0 : l'octet ne monte pas plus haut.
    repertoire.writeUInt8(couche.largeur >= 256 ? 0 : couche.largeur, d)
    repertoire.writeUInt8(couche.hauteur >= 256 ? 0 : couche.hauteur, d + 1)
    repertoire.writeUInt8(0, d + 2) // palette : aucune
    repertoire.writeUInt8(0, d + 3) // réservé
    repertoire.writeUInt16LE(1, d + 4) // plans
    repertoire.writeUInt16LE(32, d + 6) // bits par pixel
    repertoire.writeUInt32LE(couche.donnees.length, d + 8)
    repertoire.writeUInt32LE(position, d + 12)
    position += couche.donnees.length
  })

  return Buffer.concat([entete, repertoire, ...couches.map((c) => c.donnees)])
}

module.exports = { coucheDib, assembler }
