import type { BrowserWindow } from 'electron'

/**
 * Le « mode ordi portable » du menu Mode développeur.
 *
 * La fenêtre du MJ prend la taille qu'elle a sur le portable en bureau à
 * distance (1536×864 à l'échelle 1,3875) : 1384×716 de zone utile, que
 * zoom.ts ramène à la mise en page du poste principal. On voit ainsi, depuis
 * le grand écran, ce que le MJ verra là-bas. En développement, la fenêtre
 * s'ouvre dans ce mode.
 */
export const TAILLE_PORTABLE = { width: 1384, height: 716 }

let fenetre: BrowserWindow | null = null
let actif = false
/* Les redimensionnements que l'on provoque soi-même en basculant
   (unmaximize, setContentSize) ne doivent pas décocher le mode. */
let calmeJusqua = 0

export function suivreModePortable(w: BrowserWindow, initial: boolean): void {
  fenetre = w
  actif = initial
  calmeJusqua = Date.now() + 1500 // le temps que la fenêtre s'ouvre et se montre
  /* Dès que la fenêtre change de taille (bord tiré, agrandie, ancrée, plein
     écran), elle n'est plus celle du portable : le mode se décoche. */
  const quitter = (): void => {
    if (!actif || Date.now() < calmeJusqua) return
    const [l, h] = w.getContentSize()
    const memeTaille =
      Math.abs(l - TAILLE_PORTABLE.width) <= 1 && Math.abs(h - TAILLE_PORTABLE.height) <= 1
    if (w.isMaximized() || w.isFullScreen() || !memeTaille) actif = false
  }
  for (const ev of ['resize', 'maximize', 'enter-full-screen'] as const) w.on(ev as 'resize', quitter)
}

export function modePortable(): boolean {
  return actif
}

export function basculerModePortable(): boolean {
  const w = fenetre
  if (!w || w.isDestroyed()) return actif
  calmeJusqua = Date.now() + 500
  if (actif) {
    w.maximize()
    actif = false
  } else {
    if (w.isFullScreen()) w.setFullScreen(false)
    if (w.isMaximized()) w.unmaximize()
    w.setContentSize(TAILLE_PORTABLE.width, TAILLE_PORTABLE.height)
    w.center()
    actif = true
  }
  return actif
}
