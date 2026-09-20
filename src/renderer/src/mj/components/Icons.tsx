/** Jeu d'icônes maison : traits de 1,4-1,6 px, sans remplissage, cohérents à 14-16 px. */

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

export const IconScreen = (p: P = {}): JSX.Element =>
  box(
    <>
      <rect x="2.5" y="4.5" width="19" height="12" rx="1.5" />
      <path d="M9 20h6" />
    </>,
    p
  )

export const IconTimeline = (p: P = {}): JSX.Element =>
  box(
    <>
      <path d="M3 12h18" />
      <circle cx="7" cy="12" r="2" />
      <circle cx="13" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </>,
    p
  )

/** Le fil de la séance à gauche, l'écran à droite : les deux moitiés du module. */
export const IconPupitre = (p: P = {}): JSX.Element =>
  box(
    <>
      <path d="M4 6v12" />
      <circle cx="4" cy="9" r="1.4" />
      <circle cx="4" cy="15" r="1.4" />
      <rect x="9.5" y="5.5" width="12" height="10" rx="1.5" />
      <path d="M13.5 19h4" />
    </>,
    p
  )

export const IconFolder = (p: P = {}): JSX.Element =>
  box(<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10l2 2h6.5A1.5 1.5 0 0 1 20 7.5v11A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5z" />, p)

/** La pochette : une chemise dont un document dépasse. */
export const IconPochette = (p: P = {}): JSX.Element =>
  box(
    <>
      <path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4l1.8 2H19a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z" />
      <path d="M8.5 11.5h7M8.5 14.5h4.5" />
    </>,
    p
  )

export const IconDoc = (p: P = {}): JSX.Element =>
  box(
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M9 12h7M9 16h5M9 8h4" />
    </>,
    p
  )

export const IconPlace = (p: P = {}): JSX.Element =>
  box(
    <>
      <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>,
    p
  )

export const IconPeople = (p: P = {}): JSX.Element =>
  box(
    <>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5 20c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5" />
    </>,
    p
  )

export const IconDie = (p: P = {}): JSX.Element =>
  box(
    <>
      <path d="M12 3l8 4.6v8.8L12 21l-8-4.6V7.6z" />
      <path d="M12 3v18M4 7.6l8 4.6 8-4.6" />
    </>,
    p
  )

export const IconImage = (p: P = {}): JSX.Element =>
  box(
    <>
      <rect x="4" y="5" width="16" height="14" rx="1.5" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M4 16l4.5-4 3.5 3 3-2.5L20 17" />
    </>,
    p
  )

export const IconVideo = (p: P = {}): JSX.Element =>
  box(
    <>
      <rect x="3" y="6" width="13" height="12" rx="1.5" />
      <path d="M16 11l5-3v8l-5-3z" />
    </>,
    p
  )

export const IconAudio = (p: P = {}): JSX.Element =>
  box(
    <>
      <path d="M4 14V10h3l4-3.5v11L7 14z" />
      <path d="M15 9.5a3.5 3.5 0 0 1 0 5M17.6 7a7 7 0 0 1 0 10" />
    </>,
    p
  )

export const IconPdf = (p: P = {}): JSX.Element =>
  box(
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M9 14h2a1.5 1.5 0 0 0 0-3H9v6M14 17v-6h1.6a1.6 1.6 0 0 1 1.6 1.6v2.8" />
    </>,
    p
  )

/** L'œil ouvert : ce que les joueurs voient. Son pendant barré est juste dessous. */
export const IconEye = (p: P = {}): JSX.Element =>
  box(
    <>
      <path d="M3 12s4-6 9-6 9 6 9 6-4 6-9 6-9-6-9-6z" />
      <circle cx="12" cy="12" r="2.6" />
    </>,
    p
  )

export const IconEyeOff = (p: P = {}): JSX.Element =>
  box(
    <>
      <path d="M3 3l18 18" />
      <path d="M10.6 6.3A8.5 8.5 0 0 1 12 6c5 0 9 6 9 6a17 17 0 0 1-2.4 3M6.5 8.2C4.4 9.8 3 12 3 12s4 6 9 6a8.7 8.7 0 0 0 3.4-.7" />
    </>,
    p
  )

export const IconExpand = (p: P = {}): JSX.Element =>
  box(<path d="M4 9V4h5M20 15v5h-5M20 9V4h-5M4 15v5h5" />, p)

export const IconFade = (p: P = {}): JSX.Element =>
  box(
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none" />
    </>,
    p
  )

export const IconFreeze = (p: P = {}): JSX.Element =>
  box(<path d="M12 3v18M4.5 7.5l15 9M19.5 7.5l-15 9" />, p)

export const IconPlus = (p: P = {}): JSX.Element => box(<path d="M12 5v14M5 12h14" />, p)

export const IconCheck = (p: P = {}): JSX.Element => box(<path d="m5 12.5 4.5 4.5L19 7" />, p)

/** Trois curseurs : ce qu'on règle une fois et qui vaut ensuite pour tous. */
export const IconSliders = (p: P = {}): JSX.Element =>
  box(
    <>
      <path d="M4 7h10M18 7h2M4 12h4M12 12h8M4 17h8M16 17h4" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="14" cy="17" r="2" />
    </>,
    p
  )

export const IconSearch = (p: P = {}): JSX.Element =>
  box(
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </>,
    p
  )

export const IconChevron = (p: P = {}): JSX.Element => box(<path d="M9 6l6 6-6 6" />, p)

export const IconPen = (p: P = {}): JSX.Element =>
  box(
    <>
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" />
      <path d="M14.5 5.5 18.5 9.5" />
    </>,
    p
  )

export const IconLink = (p: P = {}): JSX.Element =>
  box(
    <>
      <path d="M10 13.5a4 4 0 0 0 5.7 0l3-3A4 4 0 0 0 13 4.8l-1.7 1.7" />
      <path d="M14 10.5a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 19.2l1.7-1.7" />
    </>,
    p
  )

export const IconClose = (p: P = {}): JSX.Element => box(<path d="M6 6l12 12M18 6L6 18" />, p)

export const IconTrash = (p: P = {}): JSX.Element =>
  box(
    <>
      <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
      <path d="M10 11v6M14 11v6" />
    </>,
    p
  )

/** Le cadenas d'une porte verrouillée : le MJ seul l'accorde. */
export const IconVerrou = (p: P = {}): JSX.Element =>
  box(
    <>
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="1.6" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>,
    p
  )

/** Le découpage d'un plan : les ciseaux qui taillent les pièces dans l'étage. */
export const IconDecouper = (p: P = {}): JSX.Element =>
  box(
    <>
      <circle cx="6" cy="18" r="2.6" />
      <circle cx="18" cy="18" r="2.6" />
      <path d="M8 16L19 4M16 16L5 4" />
    </>,
    p
  )

/** Le cadrage d'une pièce découpée : les deux équerres du recadrage. */
export const IconCadrage = (p: P = {}): JSX.Element =>
  box(
    <>
      <path d="M7 2v15h15" />
      <path d="M2 7h15v15" />
    </>,
    p
  )

/** Le jalon d'un lieu : un rond vide tant que le groupe n'y est pas passé. */
export const IconCercle = (p: P = {}): JSX.Element => box(<circle cx="12" cy="12" r="7" />, p)

/** Le soleil du réglage de lumière : on éclaircit la carte, pas le lieu. */
export const IconSoleil = (p: P = {}): JSX.Element =>
  box(
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
    </>,
    p
  )

/** La gomme du calque des murs : le bloc couché sur sa ligne, et son biseau. */
export const IconGomme = (p: P = {}): JSX.Element =>
  box(
    <>
      <path d="M7.2 20.3 3.4 16.5a2 2 0 0 1 0-2.8l8.8-8.8a2 2 0 0 1 2.8 0l4.9 4.9a2 2 0 0 1 0 2.8l-7.9 7.9" />
      <path d="M20.5 20.3H7.2" />
      <path d="m5.8 13.1 6.4 6.4" />
    </>,
    p
  )

/**
 * La loupe du tracé. Volontairement distincte d'`IconSearch`, la loupe de la
 * recherche : celle-ci porte un plus, elle agrandit — elle ne cherche pas.
 */
export const IconLoupe = (p: P = {}): JSX.Element =>
  box(
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.3 15.3 20.5 20.5" />
      <path d="M10.5 8v5M8 10.5h5" />
    </>,
    p
  )

/** Deux cloisons et l'ouverture d'une porte entre elles : le calque des murs. */
export const IconMurs = (p: P = {}): JSX.Element =>
  box(
    <>
      <path d="M4 20V4h16" />
      <path d="M4 13h6" />
      <path d="M14 13h6" />
      <path d="M20 4v6" />
    </>,
    p
  )

/** Une porte : son battant dans le chambranle, et sa poignée. */
export const IconPorte = (p: P = {}): JSX.Element =>
  box(
    <>
      <path d="M5.5 21V4a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v17" />
      <path d="M3 21h18" />
      <circle cx="15.5" cy="12.5" r="1" />
    </>,
    p
  )

/** Un rideau : sa tringle, et deux pans qui ondulent. */
export const IconRideau = (p: P = {}): JSX.Element =>
  box(
    <>
      <path d="M3 4h18" />
      <path d="M7 4v16c1.6-1.2 1.6-3.6 0-4.8s-1.6-3.6 0-4.8" />
      <path d="M17 4v16c-1.6-1.2-1.6-3.6 0-4.8s1.6-3.6 0-4.8" />
    </>,
    p
  )

/** Une fenêtre : son dormant et ses deux battants. */
export const IconFenetre = (p: P = {}): JSX.Element =>
  box(
    <>
      <rect x="4" y="4" width="16" height="16" rx="1" />
      <path d="M12 4v16M4 12h16" />
    </>,
    p
  )

export const IconMap = (p: P = {}): JSX.Element =>
  box(
    <>
      <path d="M9 4L4 6v14l5-2 6 2 5-2V4l-5 2z" />
      <path d="M9 4v14M15 6v14" />
    </>,
    p
  )

export const IconType = (p: P = {}): JSX.Element =>
  box(<path d="M5 6h14M12 6v13M9 19h6" />, p)

export const IconRotate = (p: P = {}): JSX.Element =>
  box(
    <>
      <path d="M20 11a8 8 0 1 0-2.3 5.6" />
      <path d="M20 5v6h-6" />
    </>,
    p
  )

/**
 * Flèche de retour — « remettre comme c'était ». Volontairement distincte de
 * `IconRotate`, la flèche circulaire du pivot : les deux se côtoient dans la
 * barre de la régie, elles ne doivent pas se confondre.
 */
export const IconRetour = (p: P = {}): JSX.Element =>
  box(
    <>
      <path d="M9.5 14.5 5 10l4.5-4.5" />
      <path d="M5 10h8.5a5.5 5.5 0 0 1 0 11H10" />
    </>,
    p
  )

export const IconStop = (p: P = {}): JSX.Element =>
  box(<rect x="6" y="6" width="12" height="12" rx="1.5" />, p)

/** Icône correspondant au type d'un élément de bibliothèque. */
export function kindIcon(kind: string, className = 'ico'): JSX.Element {
  switch (kind) {
    case 'image':
      return <IconImage className={className} />
    case 'video':
      return <IconVideo className={className} />
    case 'audio':
      return <IconAudio className={className} />
    case 'pdf':
      return <IconPdf className={className} />
    default:
      return <IconDoc className={className} />
  }
}

/** Le pointeur — ce que tout le monde appelle « la souris ». */
export const IconSouris = (p: P = {}): JSX.Element =>
  box(<path d="M5 3l12 5.6-5 1.6-1.6 5z" fill="currentColor" stroke="none" />, p)

/** L'aimant en fer à cheval, ses deux pôles vers le bas. */
export const IconAimant = (p: P = {}): JSX.Element =>
  box(
    <>
      <path d="M5.5 19.5V11a6.5 6.5 0 0 1 13 0v8.5" />
      <path d="M5.5 15.5h4.5M14 15.5h4.5" />
    </>,
    p
  )

/** Fusionner : deux bouts qui se rejoignent en un seul point. */
export const IconFusion = (p: P = {}): JSX.Element =>
  box(
    <>
      <path d="M3 6h5.5a3.5 3.5 0 0 1 3.5 3.5V18" />
      <path d="M21 6h-5.5a3.5 3.5 0 0 0-3.5 3.5" />
      <circle cx="12" cy="18" r="2" />
    </>,
    p
  )

/* ---------------- la réserve d'objets ---------------- */

/** Le coffre : ce que la table reconnaît avant de lire l'étiquette du rail. */
export const IconCoffre = (p: P = {}): JSX.Element =>
  box(
    <>
      <path d="M3.5 9.5h17V19a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z" />
      <path d="M3.5 9.5 5 4.5h14l1.5 5" />
      <path d="M10.5 9.5v3.5h3V9.5" />
    </>,
    p
  )

/** Donner : ce qui part d'une main vers quelqu'un. */
export const IconDonner = (p: P = {}): JSX.Element =>
  box(
    <>
      <path d="M3 12h9" />
      <path d="m8.5 8 4 4-4 4" />
      <circle cx="18" cy="8" r="2.6" />
      <path d="M14 19c.5-2.6 2-4 4-4s3.5 1.4 4 4" />
    </>,
    p
  )

export const IconPoser = (p: P = {}): JSX.Element =>
  box(
    <>
      <path d="M12 3v11" />
      <path d="m8 10 4 4 4-4" />
      <path d="M4 20h16" />
    </>,
    p
  )

/**
 * Les glyphes des familles d'objets.
 *
 * Un objet sans photo doit rester reconnaissable de loin : c'est son rayon
 * qu'on lit alors, dessiné plutôt qu'écrit. Le MJ choisit le glyphe quand il
 * crée une famille — les huit livrés couvrent ce qu'une campagne traîne.
 */
const GLYPHES: Record<string, JSX.Element> = {
  armes: (
    <>
      <path d="M14.5 3.5h6v6L10 20a2.5 2.5 0 0 1-3.5 0l-3-3a2.5 2.5 0 0 1 0-3.5z" />
      <path d="m6 15 3 3" />
    </>
  ),
  protections: (
    <>
      <path d="M12 3 20 6v6c0 4.5-3.2 7.6-8 9-4.8-1.4-8-4.5-8-9V6z" />
      <path d="M12 8v7" />
    </>
  ),
  outils: (
    <>
      <path d="M9 3h6l-1 3H10z" />
      <path d="M8 6h8l1.5 12.5a2 2 0 0 1-2 2.5h-7a2 2 0 0 1-2-2.5z" />
      <path d="M12 10v7" />
    </>
  ),
  soins: (
    <>
      <path d="M10 3h4v4l3.4 9a3 3 0 0 1-2.8 4H9.4a3 3 0 0 1-2.8-4L10 7z" />
      <path d="M8.2 14h7.6" />
    </>
  ),
  tresors: <path d="m12 3.5 2.4 5.5 5.6.6-4.2 3.9 1.2 5.6L12 16.3 7 19.1l1.2-5.6L4 9.6 9.6 9z" />,
  indices: (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M9 12h7M9 16h5M9 8h4" />
    </>
  ),
  cles: (
    <>
      <circle cx="8" cy="8" r="4" />
      <path d="m11 11 8 8" />
      <path d="m16 16 2-2" />
      <path d="m18.5 18.5 2-2" />
    </>
  ),
  curiosites: (
    <>
      <path d="M12 5c4 0 7.5 3.2 9 7-1.5 3.8-5 7-9 7s-7.5-3.2-9-7c1.5-3.8 5-7 9-7z" />
      <circle cx="12" cy="12" r="2.6" />
    </>
  )
}

export function glypheObjet(glyphe: string, className = 'ico'): JSX.Element {
  return box(GLYPHES[glyphe] ?? GLYPHES.outils, { className })
}

/* ---------------- les paramètres ---------------- */

/** Le rouage, en haut à droite : tout ce qui se règle une fois. */
export const IconRouage = (p: P = {}): JSX.Element =>
  box(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
    </>,
    p
  )

/** Le téléphone d'un joueur. */
export const IconPortable = (p: P = {}): JSX.Element =>
  box(
    <>
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M11 18.5h2" />
    </>,
    p
  )

/** Les touches du clavier. */
export const IconClavier = (p: P = {}): JSX.Element =>
  box(
    <>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
    </>,
    p
  )
