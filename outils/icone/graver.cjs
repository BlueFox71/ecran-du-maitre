/**
 * Grave l'icône de l'application : `resources/icon.png` et `resources/icon.ico`.
 *
 *   node outils/icone/graver.cjs
 *
 * Un `.ico` n'est pas une image : c'est un jeu d'images dans lequel Windows pioche.
 * Chaque couche est donc peinte à sa taille, à partir du dessin qui lui convient —
 * détaillé au-dessus de 32 px, simplifié en dessous.
 */
const { writeFileSync, mkdirSync } = require('node:fs')
const { join } = require('node:path')
const { dessin, svg } = require('./paravent.cjs')
const { rasteriser, png, bgra } = require('./rendu.cjs')
const { coucheDib, assembler } = require('./ico.cjs')

const RACINE = join(__dirname, '..', '..')
const RESSOURCES = join(RACINE, 'resources')

/** Quelle version du dessin pour quelle taille, et sous quelle forme dans le .ico. */
const COUCHES = [
  { taille: 16, niveau: 'simplifie', forme: 'dib' },
  { taille: 24, niveau: 'simplifie', forme: 'dib' },
  { taille: 32, niveau: 'simplifie', forme: 'dib' },
  { taille: 48, niveau: 'detaille', forme: 'dib' },
  { taille: 64, niveau: 'detaille', forme: 'dib' },
  { taille: 128, niveau: 'detaille', forme: 'png' },
  { taille: 256, niveau: 'detaille', forme: 'png' }
]

function graver() {
  mkdirSync(RESSOURCES, { recursive: true })
  const dessins = { detaille: dessin('detaille'), simplifie: dessin('simplifie') }

  // Le 512 que lit electron-builder, et que regardent les humains.
  const grand = rasteriser(dessins.detaille, 512)
  writeFileSync(join(RESSOURCES, 'icon.png'), png(grand, 512, 512))

  // Le dessin source, pour retoucher plus tard sans relire ce script.
  writeFileSync(join(RESSOURCES, 'icon.svg'), svg('detaille'), 'utf8')

  const couches = COUCHES.map(({ taille, niveau, forme }) => {
    const rgba = rasteriser(dessins[niveau], taille)
    return {
      largeur: taille,
      hauteur: taille,
      donnees:
        forme === 'png' ? png(rgba, taille, taille) : coucheDib(bgra(rgba), taille, taille)
    }
  })
  writeFileSync(join(RESSOURCES, 'icon.ico'), assembler(couches))

  console.log('resources/icon.png — 512 × 512')
  console.log('resources/icon.svg — le dessin source')
  console.log(`resources/icon.ico — ${COUCHES.map((c) => c.taille).join(', ')} px`)
}

graver()
