/**
 * Un rastériseur minuscule : des polygones, deux dégradés, des coins arrondis.
 *
 * C'est tout ce dont l'icône a besoin, et ça évite d'embarquer une bibliothèque
 * d'images pour dessiner sept carrés. Chaque pixel est échantillonné plusieurs
 * fois puis moyenné — c'est l'antialiasing du pauvre, et il vaut celui d'un
 * navigateur sur des arêtes droites.
 */
const { deflateSync } = require('node:zlib')

/** '#rrggbb' → [r, v, b] */
const lireCouleur = (hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16)
]

/** Couleur d'un dégradé linéaire en un point, en projetant sur son axe. */
function teinte(degrade, x, y) {
  const [x0, y0] = degrade.de
  const [x1, y1] = degrade.a
  const dx = x1 - x0
  const dy = y1 - y0
  const carre = dx * dx + dy * dy
  let t = carre === 0 ? 0 : ((x - x0) * dx + (y - y0) * dy) / carre
  t = t < 0 ? 0 : t > 1 ? 1 : t
  const a = lireCouleur(degrade.debut)
  const b = lireCouleur(degrade.fin)
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

/** Lancer de rayon horizontal : le point est-il dans le polygone ? */
function dedans(points, x, y) {
  let compte = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i]
    const [xj, yj] = points[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) compte = !compte
  }
  return compte
}

/** Le point est-il dans la vignette aux coins arrondis ? */
function dansLaTuile(cote, rayon, x, y) {
  if (x < 0 || y < 0 || x > cote || y > cote) return false
  const cx = x < rayon ? rayon : x > cote - rayon ? cote - rayon : x
  const cy = y < rayon ? rayon : y > cote - rayon ? cote - rayon : y
  if (cx === x || cy === y) return true
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy <= rayon * rayon
}

/**
 * Peint le dessin à la taille demandée.
 * @returns {Buffer} RGBA, ligne du haut en premier, alpha non prémultiplié
 */
function rasteriser(dessin, taille) {
  // Plus c'est petit, plus on échantillonne : c'est là que chaque pixel compte.
  const sous = taille >= 128 ? 4 : 8
  const echelle = dessin.cote / taille
  const rgba = Buffer.alloc(taille * taille * 4)

  // Les couleurs fixes se lisent une fois pour toutes.
  const formes = dessin.formes.map((f) => ({
    points: f.points,
    degrade: typeof f.remplissage === 'string' ? null : f.remplissage,
    couleur: typeof f.remplissage === 'string' ? lireCouleur(f.remplissage) : null,
    opacite: f.opacite === undefined ? 1 : f.opacite
  }))

  for (let py = 0; py < taille; py++) {
    for (let px = 0; px < taille; px++) {
      let r = 0
      let v = 0
      let b = 0
      let couverts = 0

      for (let sy = 0; sy < sous; sy++) {
        for (let sx = 0; sx < sous; sx++) {
          const x = (px + (sx + 0.5) / sous) * echelle
          const y = (py + (sy + 0.5) / sous) * echelle
          if (!dansLaTuile(dessin.cote, dessin.rayon, x, y)) continue

          let [cr, cv, cb] = teinte(dessin.fond, x, y)
          for (const forme of formes) {
            if (!dedans(forme.points, x, y)) continue
            const [fr, fv, fb] = forme.degrade ? teinte(forme.degrade, x, y) : forme.couleur
            const o = forme.opacite
            cr = cr + (fr - cr) * o
            cv = cv + (fv - cv) * o
            cb = cb + (fb - cb) * o
          }
          r += cr
          v += cv
          b += cb
          couverts++
        }
      }

      const total = sous * sous
      const i = (py * taille + px) * 4
      if (couverts === 0) continue
      // Moyenne sur les seuls échantillons peints : le bord garde sa couleur, pas un halo noir.
      rgba[i] = Math.round(r / couverts)
      rgba[i + 1] = Math.round(v / couverts)
      rgba[i + 2] = Math.round(b / couverts)
      rgba[i + 3] = Math.round((couverts / total) * 255)
    }
  }

  return rgba
}

/* ---------- encodage PNG ---------- */

const TABLE_CRC = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buffer) {
  let c = 0xffffffff
  for (let i = 0; i < buffer.length; i++) c = TABLE_CRC[(c ^ buffer[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function bloc(type, donnees) {
  const taille = Buffer.alloc(4)
  taille.writeUInt32BE(donnees.length, 0)
  const corps = Buffer.concat([Buffer.from(type, 'ascii'), donnees])
  const somme = Buffer.alloc(4)
  somme.writeUInt32BE(crc32(corps), 0)
  return Buffer.concat([taille, corps, somme])
}

/** Encode un RGBA en PNG 8 bits avec alpha. */
function png(rgba, largeur, hauteur) {
  const brut = Buffer.alloc(hauteur * (largeur * 4 + 1))
  for (let y = 0; y < hauteur; y++) {
    // Filtre 0 : aucune prédiction. Le dessin est plat, deflate s'en sort très bien.
    brut[y * (largeur * 4 + 1)] = 0
    rgba.copy(brut, y * (largeur * 4 + 1) + 1, y * largeur * 4, (y + 1) * largeur * 4)
  }

  const entete = Buffer.alloc(13)
  entete.writeUInt32BE(largeur, 0)
  entete.writeUInt32BE(hauteur, 4)
  entete[8] = 8 // bits par canal
  entete[9] = 6 // RVB + alpha
  entete[10] = 0 // compression standard
  entete[11] = 0 // filtrage standard
  entete[12] = 0 // pas d'entrelacement

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloc('IHDR', entete),
    bloc('IDAT', deflateSync(brut, { level: 9 })),
    bloc('IEND', Buffer.alloc(0))
  ])
}

/** RGBA → BGRA, l'ordre qu'attendent les DIB de Windows. */
function bgra(rgba) {
  const sortie = Buffer.from(rgba)
  for (let i = 0; i < sortie.length; i += 4) {
    const r = sortie[i]
    sortie[i] = sortie[i + 2]
    sortie[i + 2] = r
  }
  return sortie
}

module.exports = { rasteriser, png, bgra }
