import { screen, type BrowserWindow } from 'electron'

/**
 * Le zoom de la fenêtre du MJ, ajusté à l'écran.
 *
 * L'interface est dessinée pour un grand écran : en dessous de 1700 px de
 * large, ses règles de mise en page replient le Paravent et la Régie en
 * colonnes étroites. Sur un portable (ou en bureau à distance), plutôt que
 * d'obtenir une autre disposition, on rétrécit le tout : la fenêtre « voit »
 * toujours au moins LARGEUR × HAUTEUR pixels CSS, et l'on retrouve la même
 * mise en page que sur le poste principal, simplement plus petite.
 *
 * Le zoom choisi par le MJ (Agrandir / Réduire) se multiplie à cet ajustement
 * au lieu de l'écraser.
 */
const LARGEUR = 1920
const HAUTEUR = 960
const PLANCHER = 0.6

let fenetre: BrowserWindow | null = null
let preference = 1

function ajuster(): void {
  const w = fenetre
  if (!w || w.isDestroyed()) return
  const { width, height } = w.getContentBounds()
  if (!width || !height) return // fenêtre réduite dans la barre des tâches
  const auto = Math.max(PLANCHER, Math.min(1, width / LARGEUR, height / HAUTEUR))
  const facteur = Math.round(auto * preference * 1000) / 1000
  if (Math.abs(w.webContents.getZoomFactor() - facteur) > 0.001) w.webContents.setZoomFactor(facteur)
}

/** Confie la fenêtre principale à l'ajustement : il suit ses changements de taille. */
export function suivreZoom(w: BrowserWindow): void {
  fenetre = w
  for (const ev of ['resize', 'maximize', 'unmaximize', 'restore', 'enter-full-screen', 'leave-full-screen'] as const) {
    w.on(ev as 'resize', ajuster)
  }
  /* Chromium retient le zoom par page et le réapplique au chargement : on
     repasse derrière lui à chaque chargement. */
  w.webContents.on('did-finish-load', ajuster)
  // Ctrl + molette.
  w.webContents.on('zoom-changed', (_e, sens) => zoomer(sens === 'in' ? 'plus' : 'moins'))
  // Changer d'écran (ou de résolution en bureau à distance) change la place.
  w.on('moved', ajuster)
  screen.on('display-metrics-changed', ajuster)
  screen.on('display-added', ajuster)
  screen.on('display-removed', ajuster)
  ajuster()
}

/** Agrandir, réduire ou revenir au zoom ajusté. */
export function zoomer(sens: 'plus' | 'moins' | 'normal'): void {
  if (sens === 'normal') preference = 1
  else preference = Math.min(2.5, Math.max(0.5, preference * (sens === 'plus' ? 1.1 : 1 / 1.1)))
  ajuster()
}

/** Pour l'ipc : la fenêtre est-elle celle dont on règle le zoom ? */
export function estFenetreSuivie(w: BrowserWindow | null | undefined): boolean {
  return !!w && w === fenetre
}
