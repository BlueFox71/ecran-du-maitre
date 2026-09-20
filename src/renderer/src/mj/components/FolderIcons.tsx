import type * as React from 'react'
/**
 * Le décor des dossiers : une icône et une couleur, choisies par le MJ.
 * Rangé en base par chemin — rien n'est jamais écrit dans le dossier lui-même.
 */

type P = { className?: string }
const box = (children: JSX.Element, p: P): JSX.Element => (
  /*
   * Le trait, le vide et la taille sont posés ici en attributs : une icône reste lisible
   * même dans un contexte que la feuille de style n'a pas prévu (sans quoi le navigateur
   * la peint en noir plein, 300 × 150 px). Toute règle CSS l'emporte sur ces attributs,
   * donc les réglages par contexte d'app.css continuent de commander.
   */
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    className={p.className}
    aria-hidden="true"
  >
    {children}
  </svg>
)

export const FOLDER_ICONS: Record<string, (p?: P) => JSX.Element> = {
  dossier: (p = {}) =>
    box(
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10l2 2h6.5A1.5 1.5 0 0 1 20 7.5v11A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5z" />,
      p
    ),
  carte: (p = {}) =>
    box(
      <>
        <path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5z" />
        <path d="M9 4v13M15 6.5v13" />
      </>,
      p
    ),
  maison: (p = {}) =>
    box(
      <>
        <path d="M4 10.5 12 4l8 6.5" />
        <path d="M6 10v9.5h12V10" />
        <path d="M10.5 19.5v-5h3v5" />
      </>,
      p
    ),
  cle: (p = {}) =>
    box(
      <>
        <circle cx="8" cy="12" r="3.5" />
        <path d="M11.5 12H21M18 12v3M15 12v2.5" />
      </>,
      p
    ),
  loupe: (p = {}) =>
    box(
      <>
        <circle cx="10.5" cy="10.5" r="5.5" />
        <path d="M14.6 14.6 20 20" />
      </>,
      p
    ),
  personne: (p = {}) =>
    box(
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
      </>,
      p
    ),
  fantome: (p = {}) =>
    box(
      <>
        <path d="M5 20v-9a7 7 0 0 1 14 0v9l-2.3-1.8L14.4 20l-2.4-1.8L9.6 20l-2.3-1.8z" />
        <path d="M9.5 10h.01M14.5 10h.01" />
      </>,
      p
    ),
  son: (p = {}) => box(<path d="M3 12h2.5M8 7v10M12 4.5v15M16 8.5v7M20.5 12H19" />, p),
  film: (p = {}) =>
    box(
      <>
        <rect x="3" y="5" width="18" height="14" rx="1.5" />
        <path d="M7.5 5v14M16.5 5v14M3 12h18" />
      </>,
      p
    ),
  image: (p = {}) =>
    box(
      <>
        <rect x="3" y="5" width="18" height="14" rx="1.5" />
        <circle cx="8.5" cy="10" r="1.5" />
        <path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5" />
      </>,
      p
    ),
  texte: (p = {}) =>
    box(
      <>
        <path d="M6 3h9l4 4v14H6z" />
        <path d="M9 12h7M9 16h5M9 8h4" />
      </>,
      p
    ),
  cadenas: (p = {}) =>
    box(
      <>
        <rect x="5" y="10.5" width="14" height="9.5" rx="1.5" />
        <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
      </>,
      p
    ),
  lune: (p = {}) => box(<path d="M19 14.5A8 8 0 0 1 9 4.6a8 8 0 1 0 10 9.9" />, p),
  flamme: (p = {}) =>
    box(
      <>
        <path d="M12 21c3.6 0 6-2.3 6-5.5 0-4.4-4.6-5.8-3.6-11.5C10.8 5.4 6 8.6 6 15.5 6 18.7 8.4 21 12 21" />
        <path d="M12 21c1.6 0 2.6-1.1 2.6-2.6 0-2-2-2.6-1.6-5.1-1.6.7-3.6 2.1-3.6 5.1 0 1.5 1 2.6 2.6 2.6" />
      </>,
      p
    ),
  tombe: (p = {}) =>
    box(
      <>
        <path d="M7 21V9a5 5 0 0 1 10 0v12z" />
        <path d="M12 6v6M9.5 8.5h5" />
      </>,
      p
    ),
  de: (p = {}) =>
    box(
      <>
        <rect x="4" y="4" width="16" height="16" rx="2.5" />
        <path d="M9 9h.01M15 15h.01M12 12h.01" />
      </>,
      p
    ),
  livre: (p = {}) =>
    box(
      <>
        <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H19v16H5.5A1.5 1.5 0 0 1 4 18.5z" />
        <path d="M8 4v16" />
      </>,
      p
    ),
  lieu: (p = {}) =>
    box(
      <>
        <path d="M12 21s6.5-6.1 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 14.9 12 21 12 21" />
        <circle cx="12" cy="10.5" r="2.5" />
      </>,
      p
    ),
  losange: (p = {}) =>
    box(
      <>
        <path d="M12 3 21 12l-9 9-9-9z" />
        <circle cx="12" cy="12" r="3" />
      </>,
      p
    ),
  ecran: (p = {}) =>
    box(
      <>
        <rect x="2.5" y="4.5" width="19" height="12" rx="1.5" />
        <path d="M9 20h6" />
      </>,
      p
    ),
  etoile: (p = {}) =>
    box(<path d="m12 3.5 2.6 5.6 6 .8-4.4 4.2 1.1 6.1-5.3-2.9-5.3 2.9 1.1-6.1L3.4 9.9l6-.8z" />, p)
}

export const FOLDER_ICON_KEYS = Object.keys(FOLDER_ICONS)

/**
 * La teinte d'un dossier **vient de son icône**, et ne se choisit plus à part.
 *
 * Choisir une clé puis choisir sa couleur, c'était deux gestes pour une seule
 * idée — et rien ne garantissait que la clé soit dorée. Chaque dessin porte
 * donc sa couleur, prise aux jetons du projet : une palette de thème les
 * redéfinit toutes d'un bloc, et chacune a son fond assorti (`--x-wash`).
 */
const FOLDER_TEINTES: Record<string, string> = {
  dossier: 'brass',
  carte: 'jade',
  maison: 'argile',
  cle: 'brass',
  loupe: 'azur',
  personne: 'ardoise',
  fantome: 'iris',
  son: 'moss',
  film: 'prune',
  image: 'fougere',
  texte: 'neutral',
  cadenas: 'ardoise',
  lune: 'outremer',
  flamme: 'orange',
  tombe: 'neutral',
  de: 'olive',
  livre: 'argile',
  lieu: 'blood',
  losange: 'amethyste',
  ecran: 'azur',
  etoile: 'bruyere'
}

export function teinteDossier(icon: string | null): string {
  return FOLDER_TEINTES[icon ?? 'dossier'] ?? 'brass'
}

/**
 * Le décor d'un dossier, posé en variables CSS : l'encre du dessin et le fond
 * sur lequel il se détache. C'est le CSS qui décide ensuite quoi en faire —
 * une pastille derrière l'icône dans une liste, la chemise entière dans une
 * tuile. Un seul endroit décide de la couleur, pour cinq endroits qui la
 * dessinent.
 */
export function decorDossier(icon: string | null): React.CSSProperties {
  const t = teinteDossier(icon)
  return {
    ['--teinte' as string]: `var(--${t})`,
    ['--teinte-fond' as string]: `var(--${t}-wash)`
  }
}

export function folderIcon(name: string | null, className = 'ico'): JSX.Element {
  const make = FOLDER_ICONS[name ?? 'dossier'] ?? FOLDER_ICONS.dossier
  return make({ className })
}
