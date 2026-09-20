/**
 * Le dessin de l'icône : un paravent de maître de jeu, vu de trois quarts.
 *
 * Deux niveaux de détail, parce qu'une icône ne se réduit pas — elle se redessine :
 *   - « detaille »  : volets, chant du carton, table de règles imprimée (48 px et plus)
 *   - « simplifie » : sans l'imprimé, objet un peu plus gros, contrastes forcés (32 px et moins)
 *
 * Ce qui, dans ce dessin, empêche de lire une fenêtre :
 *   des volets de largeur inégale — 144, 116, 76 — donc une vraie perspective ;
 *   une arête et une base qui zigzaguent toutes les deux ;
 *   trois tons de laiton, un par orientation de volet ;
 *   la table de règles imprimée sur le grand volet.
 *
 * Tout est exprimé dans une vignette de 512, coins arrondis de 96.
 */

const COTE = 512
const RAYON = 96

/** Fond de la vignette : l'encre de l'application, un peu plus claire en haut. */
const ENCRE = { de: [0, 0], a: [0, COTE], debut: '#182126', fin: '#0a1013' }

/** Le laiton du grand volet, éclairé depuis le haut-gauche. */
const LAITON = { de: [88, 182], a: [232, 408], debut: '#f0d193', fin: '#c2913a' }

/** Les trois volets : le chant (le dessus du carton) puis la face. */
const VOLETS = [
  {
    chant: [[88, 170], [232, 202], [232, 214], [88, 182]],
    face: [[88, 182], [232, 214], [232, 408], [88, 350]]
  },
  {
    chant: [[232, 202], [348, 174], [348, 186], [232, 214]],
    face: [[232, 214], [348, 186], [348, 356], [232, 408]]
  },
  {
    chant: [[348, 174], [424, 192], [424, 204], [348, 186]],
    face: [[348, 186], [424, 204], [424, 388], [348, 356]]
  }
]

/** La table de règles imprimée sur le grand volet. */
const IMPRIME = [
  [[105, 237], [215, 267], [215, 277], [105, 246]],
  [[105, 263], [215, 296], [215, 306], [105, 271]],
  [[105, 288], [215, 325], [215, 334], [105, 297]]
]

const TONS = {
  detaille: {
    chants: ['#f4dcae', '#a8813a', '#e0c07a'],
    faces: [LAITON, '#6d5220', '#a8813a'],
    imprime: '#8a6a2a'
  },
  // En petit, l'antialiasing mange les écarts de ton : on les creuse.
  simplifie: {
    chants: ['#ffe9c4', '#9c7830', '#e8cc8c'],
    faces: [LAITON, '#5c451b', '#b08a3a'],
    imprime: null
  }
}

/** Le centre de l'objet dessiné, autour duquel on l'agrandit. */
const CENTRE = 289

/**
 * De combien le paravent remonte dans la vignette. Le centre optique d'une icône
 * est un peu au-dessus de son centre géométrique : posé au milieu, l'objet paraît tomber.
 */
const MONTEE = 28

/** Agrandit autour du centre de l'objet, puis remonte le tout. */
const placer = ([x, y], facteur) => [
  256 + (x - 256) * facteur,
  CENTRE + (y - CENTRE) * facteur - MONTEE
]

/**
 * Le dessin, prêt à rastériser : un fond et des formes peintes dans l'ordre.
 * @param {'detaille'|'simplifie'} niveau
 */
function dessin(niveau = 'detaille') {
  const tons = TONS[niveau]
  // Le paravent occupe 65 % de la vignette ; en petit on le pousse pour qu'il tienne le coup.
  const facteur = niveau === 'simplifie' ? 1.1 : 1
  const ajuster = (points) => points.map((point) => placer(point, facteur))
  // Le dégradé du grand volet est calé sur le volet : il suit le même déplacement.
  const laiton = { ...LAITON, de: placer(LAITON.de, facteur), a: placer(LAITON.a, facteur) }
  const teindre = (remplissage) => (remplissage === LAITON ? laiton : remplissage)

  const formes = []
  VOLETS.forEach((volet, i) => {
    formes.push({ points: ajuster(volet.chant), remplissage: tons.chants[i] })
    formes.push({ points: ajuster(volet.face), remplissage: teindre(tons.faces[i]) })
  })
  if (tons.imprime) {
    for (const barre of IMPRIME) {
      formes.push({ points: ajuster(barre), remplissage: tons.imprime, opacite: 0.85 })
    }
  }

  return { cote: COTE, rayon: RAYON, fond: ENCRE, formes }
}

/** Le même dessin en SVG — pour regarder, documenter, ou coller dans une maquette. */
function svg(niveau = 'detaille') {
  const d = dessin(niveau)
  const chemin = (points) =>
    points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join(' ') + ' Z'
  const degrade = (nom, g) =>
    `    <linearGradient id="${nom}" gradientUnits="userSpaceOnUse" ` +
    `x1="${g.de[0]}" y1="${g.de[1]}" x2="${g.a[0]}" y2="${g.a[1]}">\n` +
    `      <stop offset="0" stop-color="${g.debut}"/>\n` +
    `      <stop offset="1" stop-color="${g.fin}"/>\n` +
    `    </linearGradient>`

  const laiton = d.formes.find((f) => typeof f.remplissage !== 'string').remplissage
  const formes = d.formes
    .map((f) => {
      const couleur = typeof f.remplissage === 'string' ? f.remplissage : 'url(#laiton)'
      const opacite = f.opacite ? ` opacity="${f.opacite}"` : ''
      return `  <path d="${chemin(f.points)}" fill="${couleur}"${opacite}/>`
    })
    .join('\n')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${COTE}" height="${COTE}" viewBox="0 0 ${COTE} ${COTE}">
  <defs>
${degrade('encre', ENCRE)}
${degrade('laiton', laiton)}
  </defs>
  <rect width="${COTE}" height="${COTE}" rx="${RAYON}" fill="url(#encre)"/>
${formes}
</svg>`
}

module.exports = { dessin, svg, COTE, RAYON }
