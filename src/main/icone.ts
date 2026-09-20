import { app } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Le chemin de l'icône des fenêtres.
 *
 * Windows habille l'exécutable avec `resources/icon.ico` au moment de
 * l'empaquetage ; en développement il n'y a pas d'exécutable à habiller, donc
 * la fenêtre porterait celle d'Electron. On la lui donne à la main.
 *
 * Le `.ico` plutôt que le `.png` : il contient un dessin par taille, et Windows
 * pioche dedans selon l'endroit — barre des tâches, Alt+Tab, coin de la fenêtre.
 */
export function cheminIcone(): string | undefined {
  const chemin = app.isPackaged
    ? join(process.resourcesPath, 'icon.ico')
    : join(__dirname, '../../resources/icon.ico')
  return existsSync(chemin) ? chemin : undefined
}
