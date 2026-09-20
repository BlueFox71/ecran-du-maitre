/** Types partagés entre le processus principal, le préchargement et les interfaces. */

export type ItemKind = 'doc' | 'image' | 'video' | 'audio' | 'pdf' | 'other'

export interface Chapter {
  id: number
  ord: number
  title: string
  notes: string | null
  /**
   * Ce qui le désigne. Un chapitre ne contient rien : ce sont les documents,
   * les lieux et les moments qui pointent vers lui. Ces comptes sont là pour
   * qu'on sache ce qu'on perd avant d'en effacer un.
   */
  items: number
  places: number
  beats: number
}

export interface Folder {
  id: number
  parentId: number | null
  /** Chemin relatif au dossier de campagne, en séparateurs « / ». */
  relPath: string
  name: string
  ord: number
  /** Décor propre à l'application : jamais écrit dans le dossier. */
  icon: string | null
  color: string | null
}

export interface FolderNode extends Folder {
  children: FolderNode[]
  items: Item[]
}

export interface Item {
  id: number
  folderId: number | null
  chapterId: number | null
  placeId: number | null
  kind: ItemKind
  title: string
  body: string | null
  relPath: string | null
  mime: string | null
  bytes: number | null
  width: number | null
  height: number | null
  /** Durée en secondes, pour une vidéo ou un son. Voir `main/examen.ts`. */
  duration: number | null
  /** Date de gravure de la vignette ; `null` si l'élément n'en a pas. */
  thumbAt: string | null
  /**
   * La page dont on tire la vignette d'un PDF. 1 par défaut — la page de
   * titre, celle par laquelle on reconnaît un document. Sans objet pour les
   * autres natures.
   */
  thumbPage: number
  updatedAt: string
}

/**
 * Les trois étages du rangement des lieux : un espace (le manoir) tient des
 * niveaux (les étages), qui tiennent des lieux (les pièces). Les trois sont
 * des lieux à part entière — carte, ambiance, documents, pions.
 */
export type PlaceTier = 'espace' | 'niveau' | 'lieu'

/** Le contenant admis au-dessus de chaque étage ; `null`, c'est la racine. */
export const PARENT_TIER: Record<PlaceTier, PlaceTier | null> = {
  espace: null,
  niveau: 'espace',
  lieu: 'niveau'
}

export const TIER_LABEL: Record<PlaceTier, string> = {
  espace: 'Espace',
  niveau: 'Niveau',
  lieu: 'Lieu'
}

/**
 * Un cadrage sur une image, en fractions — (0,0) en haut à gauche.
 *
 * **Une zone est un cadrage, pas une image.** Une pièce garde le `mapItemId`
 * de son étage : c'est le même fichier, regardé de près. Tout ce qui se pose
 * sur une carte — murs, repères, pions — reste donc en coordonnées du plan
 * entier, et un mur tracé dans la cuisine est un mur du rez-de-chaussée.
 *
 * Le contour d'une pièce, lui, est un polygone (`Place.zone`) ; cette boîte
 * est ce qu'on en tire pour cadrer une vignette.
 */
export interface Zone {
  x: number
  y: number
  w: number
  h: number
}

export interface Place {
  id: number
  tier: PlaceTier
  /** Le contenant : un espace pour un niveau, un niveau pour un lieu. */
  parentId: number | null
  /** Le rang parmi ses frères. C'est lui qu'on remue en glissant une tuile. */
  ord: number
  name: string
  summary: string | null
  notes: string | null
  mapItemId: number | null
  /**
   * Le contour de la pièce sur le plan de son étage, en fractions — `null`,
   * la carte entière. Ce n'est plus un rectangle : c'est ce que les murs
   * referment, et une pièce n'est pas forcément carrée.
   */
  zone: PointMur[] | null
  /**
   * Le point par lequel on l'a nommée. Tant qu'il tombe dans une forme fermée,
   * le nom la suit — on déplace une cloison sans perdre « le salon ».
   */
  ancre: PointMur | null
  ambienceItemId: number | null
  /**
   * Le groupe y est passé. C'est un état de partie, pas une permission : rien
   * n'empêche de diffuser un lieu qu'ils n'ont pas encore vu — on le fait même
   * exprès, pour le leur montrer la première fois.
   */
  seen: boolean
  /**
   * Ce que la lumière laisse derrière elle, sur cette carte.
   *
   * `false` — ce qu'on a vu sous une lampe s'oublie dès qu'on ne le voit
   * plus : la pièce retombe au noir complet. `true` — une zone éclairée une
   * fois reste découverte. C'est une règle de la carte, pas d'une lampe :
   * toutes les lumières du plan la suivent.
   */
  lumGarde: boolean
  /**
   * Jusqu'où un regard porte sur cette carte, en part de sa largeur.
   *
   * `null` — sans limite : le regard va jusqu'au mur, comme avant. Sinon, il
   * s'arrête là, même sans rien pour l'arrêter : un grand hall ne se découvre
   * pas d'un coup d'œil depuis la porte.
   */
  regardPortee: number | null
  /**
   * La largeur que prennent les ouvertures posées sur cette carte, en part du
   * plan. `null`, c'est la largeur d'usine — on n'a rien réglé.
   *
   * C'est un réglage d'outil, pas une propriété du lieu : une porte de manoir
   * et une porte de cabane ne font pas la même part du plan, mais sur une même
   * carte elles se ressemblent toutes.
   */
  ouvLargeur: number | null
  chapterIds: number[]
  docCount: number
}

/**
 * Un point de lumière posé sur une carte.
 *
 * Les rayons sont en part de la **largeur** de la carte, comme tout ce qui se
 * mesure sur un plan ici. `penombre` est le bord extérieur de la lueur, jamais
 * plus petit que `clair`.
 */
export interface Lumiere {
  id: number
  placeId: number
  /** En fractions de la carte, comme un pion. */
  x: number
  y: number
  /** Le rayon où l'on y voit comme en plein jour. */
  clair: number
  /** Jusqu'où la lueur porte encore, en s'éteignant. */
  penombre: number
  /** Une bougie qu'on souffle en cours de partie s'éteint sans disparaître. */
  allumee: boolean
  /**
   * La couleur de la lueur, en hexadécimal. Elle ne change **rien** à ce qui
   * est vu : c'est de l'ambiance, pas une règle. Blanc par défaut.
   */
  teinte: string
}

/** Les teintes proposées d'un clic — au-delà, on choisit la sienne. */
export const TEINTES_LUMIERE: { cle: string; label: string }[] = [
  { cle: '#ffffff', label: 'Blanc' },
  { cle: '#f5d98a', label: 'Jaune' },
  { cle: '#e8944a', label: 'Orange' }
]

/**
 * Tout ce qu'il faut pour peindre l'ombre sur une carte diffusée.
 *
 * Les murs arrêtent le regard, les ouvertures le laissent passer, les lampes
 * disent où il y a de quoi voir, et `lumGarde` dit si une zone éclairée une
 * fois reste découverte. On le lit d'un bloc : la régie et la fenêtre des
 * joueurs doivent peindre exactement la même chose.
 */
export interface CalqueBrouillard {
  murs: Mur[]
  ouvertures: Ouverture[]
  lumieres: Lumiere[]
  lumGarde: boolean
  /** Jusqu'où le regard porte ici, en part de la largeur ; `null`, sans limite. */
  regardPortee: number | null
  /**
   * De combien de degrés s'ouvre le regard d'un pion.
   *
   * C'est un réglage de la campagne, pas de la carte — mais il voyage avec le
   * calque parce que trois écrans en ont besoin et qu'aucun des trois ne lit
   * la base : la fenêtre des joueurs, la Régie et le téléphone. Sans cela,
   * deux d'entre eux dessineraient un cône et le troisième un autre.
   */
  regardOuverture: number
  /**
   * Ceux qui portent de la lumière sur eux.
   *
   * Un objet de la réserve dont un effet parle d'éclairer — « Éclaire », «
   * Éclairage », « Lumière » — allume une lampe sur le pion du personnage qui
   * le porte, et elle le suit. Le rayon se lit dans le détail de l'effet s'il
   * y a un pourcentage ; sinon c'est celui d'une torche.
   */
  porteurs: { characterId: number; rayon: number; objet: string }[]
}

export interface Beat {
  id: number
  sessionId: number
  ord: number
  atTime: string | null
  title: string
  note: string | null
  done: boolean
  chapterId: number | null
  placeId: number | null
  items: Item[]
}

export interface GameSession {
  id: number
  label: string
  date: string
  notes: string | null
}

/* ---------- Projets : une campagne est un dossier ---------- */

/** Le projet ouvert : son dossier sur le disque, et la campagne qu'il contient. */
export interface ProjectInfo {
  dir: string
  campaign: { id: number; name: string; system: string | null }
}

export interface RecentProject {
  path: string
  name: string
  openedAt: string
  /** Le dossier est-il toujours là ? Un récent disparu se montre, grisé. */
  exists: boolean
}

/* ---------- Joueurs : les personnes, pas les personnages ---------- */

/**
 * Une personne du carnet de l'application. Le carnet vit hors des projets :
 * les mêmes gens jouent d'une campagne à l'autre, et gardent leur couleur.
 */
export interface CarnetPlayer {
  uid: string
  name: string
  color: string | null
  notes: string | null
}

/** Une personne inscrite à la campagne ouverte, et le personnage qu'elle mène. */
export interface CampaignPlayer {
  id: number
  /** Ce qui la relie à la même personne dans le carnet et dans les autres projets. */
  uid: string
  name: string
  color: string | null
  characterId: number | null
}

/* ---------- Fiches de personnage : moteur de gabarits ---------- */

export type FieldType = 'gauge' | 'stat' | 'skill' | 'text' | 'number'

export interface GaugeSpec {
  key: string
  label: string
  min: number
  max: number
  color: 'blood' | 'iris' | 'brass' | 'moss' | 'neutral'
  /** Le maximum est-il modifiable par le MJ (perte de SAN définitive, par ex.) */
  maxEditable?: boolean
}

export interface StatSpec {
  key: string
  label: string
  /** L'abrégé porté par la fiche — FOR, DEX. Le label reste le nom en clair. */
  code?: string
  /** Affichage des dérivés : 'halves' = moitié/cinquième (Cthulhu), 'mod' = modificateur (D&D) */
  derive?: 'halves' | 'mod' | 'none'
}

export interface SkillSpec {
  key: string
  label: string
  /**
   * Rubrique sous laquelle la compétence se range sur la fiche. Absente, elle
   * tombe dans « Compétences » — un gabarit qui n'a pas pris la peine de
   * classer ses compétences reste parfaitement lisible.
   */
  group?: string
}

export interface TemplateSpec {
  /** Dé par défaut pour les jets de compétence. */
  rollSystem: 'd100-under' | 'd20-plus'
  /**
   * La jauge qui tient lieu de santé mentale, désignée par sa clé. Absente,
   * on la devine — voir `jaugeSanite()`. `null` dit qu'il n'y en a pas, et
   * c'est différent d'absente : un gabarit peut vouloir qu'on cesse de
   * chercher.
   */
  sanityGauge?: string | null
  gauges: GaugeSpec[]
  stats: StatSpec[]
  /**
   * Les compétences que la campagne propose. Elles ne sont pas toutes portées
   * par tous : chaque joueur choisit les siennes sur sa fiche, dans la limite
   * de `skillLimit`.
   */
  skills: SkillSpec[]
  /**
   * Combien de compétences un joueur peut prendre. `null` — ou absent, comme
   * dans les fiches d'avant — veut dire « autant qu'il veut ».
   */
  skillLimit?: number | null
}

/**
 * Laquelle des jauges est la santé mentale.
 *
 * Le gabarit le dit, et c'est lui qui a raison : `sanityGauge` porte la clé
 * choisie sur la fiche de campagne, `null` dit qu'il n'y en a pas. Ce champ
 * existait dans le type depuis le premier jour **sans que rien ne le lise** —
 * deux endroits devinaient la jauge à une liste de clés en dur, si bien qu'une
 * campagne qui appelait la sienne « lucidité » n'avait pas de cerveau dans
 * l'encart et pas d'avertissement en perdant des points.
 *
 * La devinette reste, en second : les campagnes écrites avant ce champ n'ont
 * rien à ressaisir pour continuer de marcher.
 */
export function jaugeSanite<G extends { key: string }>(
  spec: { sanityGauge?: string | null },
  gauges: G[]
): G | undefined {
  if (spec.sanityGauge === null) return undefined
  if (spec.sanityGauge) return gauges.find((g) => g.key === spec.sanityGauge)
  return gauges.find((g) => ['san', 'sm', 'sante', 'mental'].includes(g.key))
}

/* ============================================================
   Le catalogue et les modèles — hors campagne
   ============================================================ */

/**
 * Une brique de fiche gardée par l'application, pas par un projet : une
 * caractéristique, une compétence ou une jauge qu'on retrouve d'une campagne
 * à l'autre sans la retaper. Vit dans `application.db`, avec le carnet.
 */
export interface CatalogueEntry {
  uid: string
  kind: 'stat' | 'skill' | 'gauge'
  /** L'abrégé d'une caractéristique — FOR, DEX. Vide pour le reste. */
  code: string | null
  label: string
  /** Jauges seulement : la couleur de la barre et son plafond d'origine. */
  color: string | null
  max: number | null
  /** Livrée avec l'application, ou écrite par le maître du jeu. */
  builtin: boolean
}

/** Une fiche entière, nommée et gardée pour servir de départ ailleurs. */
export interface SheetModel {
  uid: string
  name: string
  spec: TemplateSpec
  builtin: boolean
  savedAt: string
}

export interface SheetTemplate {
  id: number
  name: string
  spec: TemplateSpec
  builtin: boolean
}

export interface CharacterData {
  gauges: Record<string, { value: number; max: number }>
  stats: Record<string, number>
  skills: Record<string, number>
  states: Record<string, boolean>
  notes?: string
}

/**
 * Un personnage joueur, ou un personnage que le MJ mène lui-même.
 *
 * C'est le même objet : mêmes jauges, mêmes caractéristiques, même journal,
 * même pion. Seul le mot change — et avec lui la place dans l'encart de
 * l'écran des joueurs, où un PNJ n'entre jamais.
 */
export type CharacterKind = 'pj' | 'pnj'

/**
 * La carrure du personnage — celle de la silhouette qui porte son équipement.
 *
 * Deux dessins, pas une case d'état civil : c'est le corps sur lequel on pose
 * la tête, le torse et les mains dans l'onglet « Son équipement ». `null` tant
 * que le MJ n'a rien dit ; la poupée prend alors la silhouette d'homme, et le
 * réglage attend sur la fiche.
 */
export type Sexe = 'homme' | 'femme'

/**
 * Une ligne de la table de butin d'un PNJ : ce qu'on lui trouve sur le corps.
 *
 * `pris` est coché quand les joueurs l'ont ramassé — la ligne reste, barrée,
 * pour que le MJ sache ce qui est parti et ce qui traîne encore. Comme les
 * notes, **ces lignes ne sortent jamais vers les joueurs** : ni l'écran ni les
 * téléphones ne reçoivent d'objet qui les porte.
 */
export interface ButinLigne {
  /** Un identifiant propre à la ligne, pour la suivre pendant qu'on la tape. */
  id: string
  /** L'intitulé : « Pièces d'argent », « Clé du grenier ». */
  texte: string
  /** Combien on en trouve. Un objet unique, c'est 1. */
  qte: number
  pris: boolean
}

export interface Character {
  id: number
  templateId: number
  kind: CharacterKind
  /**
   * Ce que le MJ sait de lui : ce qu'il cache, ce qui le fait céder. **Les
   * PNJ seulement** — un joueur a sa propre feuille pour ça. Jamais diffusé.
   */
  notes: string | null
  name: string
  player: string | null
  occupation: string | null
  portraitItemId: number | null
  age: string | null
  /**
   * Nom d'un jeton de couleur — la même liste que les pions. C'est elle qui
   * cercle le pion du personnage sur l'écran des joueurs ; `null` laisse la
   * couleur se déduire de l'identifiant.
   */
  color: string | null
  /**
   * La silhouette qui le représente dans son équipement. `null` : pas encore
   * dit — la poupée prend alors celle d'homme, et la fiche le propose.
   */
  sexe: Sexe | null
  /** La fiche de compétences remplie par le joueur — PDF, scan ou photo de la campagne. */
  sheetItemId: number | null
  /** Le cadrage de son aperçu ; null, c'est l'image telle qu'elle entre d'elle-même. */
  sheetFrame: Frame | null
  /**
   * Ce qu'on lui prend quand il tombe. **Les PNJ seulement**, et jamais
   * diffusé — un joueur tient son inventaire sur sa propre feuille. Vide tant
   * que le MJ n'a rien écrit.
   */
  butin: ButinLigne[]
  data: CharacterData
}

export interface CharacterLogEntry {
  id: number
  at: string
  field: string
  label: string
  delta: number
  value: number
  max: number
  reason: string | null
}

/* ---------- Objets : la réserve de la campagne ---------- */

/**
 * La réserve tient des **modèles**, pas des exemplaires.
 *
 * Un objet se décrit une fois — ce qu'on en voit, ce qu'il fait, ce qu'il
 * pèse — puis on le **pose** autant de fois qu'on veut : dans un lieu, sur un
 * PNJ, dans le sac d'un joueur. Corriger la description corrige tout ce qui en
 * traîne dans la campagne, et c'est tout l'intérêt : le MJ n'écrit pas seize
 * fois la même lanterne.
 */
export interface Objet {
  id: number
  nom: string
  /** Le rayon où il se range ; `null` tant qu'aucune famille ne lui va. */
  familleId: number | null
  /** Son image, prise dans la bibliothèque. Sans elle, le glyphe de sa famille. */
  imageItemId: number | null
  /** Pièce unique, ou chose qui se compte — une corde, six bougies. */
  unique: boolean
  /** Combien on en pose d'un coup quand il se compte. Une pièce unique, c'est 1. */
  qte: number
  /** Ce qu'il pèse, tel que le MJ l'écrit : « 1,2 kg », « deux mains ». */
  poids: string | null
  /**
   * Ce qu'il vaut, **en nombre seulement** : l'unité appartient à la campagne
   * (voir `uniteValeur`), pas à l'objet. « 40 », jamais « 40 francs » — sans
   * quoi aucun total ne serait calculable.
   */
  valeur: number | null
  /** Ce que les joueurs ont sous les yeux quand ils le trouvent. Diffusable. */
  vu: string
  /**
   * Ce qu'il fait vraiment, d'où il vient, ce qu'il coûte. **Jamais diffusé** —
   * même promesse que les notes de PNJ : aucun état de diffusion ne transporte
   * d'objet qui le porte.
   */
  su: string
  /** Se porte : il occupe alors un emplacement sur la fiche du personnage. */
  equipable: boolean
  /**
   * Les endroits du corps où il **peut** aller — une épée va dans l'une ou
   * l'autre main, une bague à l'un ou l'autre doigt. Vide, il ne se porte nulle
   * part. Ce n'est pas là qu'il est : ça, c'est l'affaire de l'exemplaire.
   */
  emplacements: string[]
  /** Ce qui s'épuise : « balles », « huile ». Nul, l'objet ne s'use pas. */
  chargeNom: string | null
  chargeMax: number | null
  effets: EffetObjet[]
  /** Où ses exemplaires se trouvent, dans l'ordre où on les a posés. */
  placements: ObjetPlacement[]
}

/**
 * Ce qu'un objet change, en une ligne libre : « Dégâts — 1d6 », « +1 —
 * Sang-froid », « Ouvre — la porte du grenier ».
 *
 * Rien n'est câblé à un système de jeu : la tête est l'étiquette qu'on lit en
 * gras, le détail ce qui la suit. Le moteur de fiches est un moteur de
 * gabarits ; ses objets ne peuvent pas être plus rigides que lui.
 */
export interface EffetObjet {
  id: string
  tete: string
  detail: string
}

/** Un rayon de la réserve. Huit sont livrés ; le MJ en ajoute et les renomme. */
export interface ObjetFamille {
  id: number
  nom: string
  /** Nom d'un jeton de couleur — la même liste que les pions. */
  teinte: string
  /** Le dessin porté par les objets sans image. */
  glyphe: GlypheObjet
  ord: number
  /** Livrée avec l'application : on peut la renommer, pas s'étonner qu'elle soit là. */
  builtin: boolean
}

export const GLYPHES_OBJET = [
  'armes',
  'protections',
  'outils',
  'soins',
  'tresors',
  'indices',
  'cles',
  'curiosites'
] as const
export type GlypheObjet = (typeof GLYPHES_OBJET)[number]

/** Les huit rayons livrés, dans l'ordre où ils s'installent. */
export const FAMILLES_LIVREES: { nom: string; teinte: string; glyphe: GlypheObjet }[] = [
  { nom: 'Armes', teinte: 'blood', glyphe: 'armes' },
  { nom: 'Protections', teinte: 'ardoise', glyphe: 'protections' },
  { nom: 'Outils & matériel', teinte: 'argile', glyphe: 'outils' },
  { nom: 'Soins & remèdes', teinte: 'moss', glyphe: 'soins' },
  { nom: 'Trésors & monnaie', teinte: 'brass', glyphe: 'tresors' },
  { nom: 'Indices & papiers', teinte: 'azur', glyphe: 'indices' },
  { nom: 'Clés & ouvertures', teinte: 'olive', glyphe: 'cles' },
  { nom: 'Curiosités', teinte: 'iris', glyphe: 'curiosites' }
]

/**
 * Les endroits du corps où un objet se porte.
 *
 * `col` dit de quel côté de la silhouette la case se pose : à gauche, à
 * droite, ou dans la rangée sous les pieds — c'est une donnée de la
 * disposition, pas de l'objet, mais elle vit ici pour que la poupée et la
 * fiche d'objet parlent des mêmes quinze places.
 *
 * Fixes pour l'instant. Le jour où une campagne en veut d'autres, ils
 * rejoindront la fiche de campagne, avec les jauges.
 */
export interface EmplacementSpec {
  cle: string
  nom: string
  col: 'g' | 'd' | 'bas'
}

export const EMPLACEMENTS_OBJET: EmplacementSpec[] = [
  { cle: 'tete', nom: 'Tête', col: 'g' },
  { cle: 'cou', nom: 'Cou', col: 'g' },
  { cle: 'epaule-g', nom: 'Épaule gauche', col: 'g' },
  { cle: 'bras-g', nom: 'Bras gauche', col: 'g' },
  { cle: 'gant-g', nom: 'Gant gauche', col: 'g' },
  { cle: 'dos', nom: 'Dos', col: 'd' },
  { cle: 'torse', nom: 'Torse', col: 'd' },
  { cle: 'epaule-d', nom: 'Épaule droite', col: 'd' },
  { cle: 'bras-d', nom: 'Bras droit', col: 'd' },
  { cle: 'gant-d', nom: 'Gant droit', col: 'd' },
  { cle: 'main-g', nom: 'Main gauche', col: 'bas' },
  { cle: 'ceinture', nom: 'Ceinture', col: 'bas' },
  { cle: 'jambes', nom: 'Jambes', col: 'bas' },
  { cle: 'pieds', nom: 'Pieds', col: 'bas' },
  { cle: 'main-d', nom: 'Main droite', col: 'bas' }
]

/** Le nom lisible d'un emplacement ; la clé elle-même si on ne la connaît pas. */
export function nomEmplacement(cle: string | null): string {
  if (!cle) return '—'
  return EMPLACEMENTS_OBJET.find((e) => e.cle === cle)?.nom ?? cle
}

/**
 * Les endroits d'un objet, même s'il vient d'un pont plus ancien.
 *
 * En développement l'interface se recharge à chaud alors que le préchargement
 * date du dernier démarrage : un objet peut alors arriver sans sa liste, et une
 * lecture directe ferait tomber tout le module. Un objet en a toujours une, même
 * vide — c'est ce que cette fonction garantit.
 */
export function emplacementsDe(o: { emplacements?: string[] }): string[] {
  return o.emplacements ?? []
}

/**
 * Les endroits possibles d'un objet, dits d'une traite : « Main gauche »,
 * « Main gauche ou droite », « 4 emplacements ». Au-delà de deux on compte —
 * une ligne de liste n'a pas la place d'une énumération.
 */
export function ditEmplacements(cles: string[] | undefined): string {
  cles = cles ?? []
  if (cles.length === 0) return 'ne se porte pas'
  if (cles.length === 1) return nomEmplacement(cles[0])
  if (cles.length === 2) return `${nomEmplacement(cles[0])} ou ${nomEmplacement(cles[1]).toLowerCase()}`
  return `${cles.length} emplacements`
}

/** L'unité de valeur par défaut d'une campagne neuve. */
export const UNITE_VALEUR_PAR_DEFAUT = 'pièces'

/** Là où se trouve un exemplaire : un lieu, un PNJ, un joueur. */
export type PortObjet = 'lieu' | 'pnj' | 'pj'

/**
 * Un exemplaire posé quelque part.
 *
 * `etat` dit ce que la table en sait : `cache`, les joueurs ne l'ont pas encore
 * découvert ; `trouve`, il est sur place et ils le savent ; `porte`, quelqu'un
 * l'a sur lui. Comme le butin, **rien de tout cela ne sort vers les joueurs** :
 * c'est l'antisèche du MJ, pas un inventaire partagé.
 */
export interface ObjetPlacement {
  id: number
  objetId: number
  port: PortObjet
  placeId: number | null
  characterId: number | null
  /** Le nom du lieu ou du personnage, tel qu'on le lit dans la fiche. */
  cible: string
  /** Où exactement : « tiroir fermé », « sur l'évier ». */
  precision: string | null
  /**
   * Sur quelqu'un : l'endroit du corps où il le porte — `null`, c'est dans son
   * sac. Équiper et ranger sont donc le même exemplaire, à une colonne près.
   */
  emplacement: string | null
  qte: number
  etat: 'cache' | 'trouve' | 'porte'
}

/* ---------- Jets de dés ---------- */

export type RollLevel =
  | 'critique'
  | 'extreme'
  | 'difficile'
  | 'reussite'
  | 'echec'
  | 'maladresse'
  | 'neutre'

export interface Roll {
  id: number
  characterId: number | null
  characterName: string | null
  playerName: string | null
  /** Nom du jeton de couleur du personnage : c'est lui qui teinte la ligne. */
  characterColor: string | null
  at: string
  label: string
  formula: string
  target: number | null
  result: number
  detail: string | null
  level: RollLevel
}

export interface RollRequest {
  characterId: number | null
  label: string
  /** 'd100-under' compare au seuil ; 'd20-plus' ajoute le modificateur. */
  system: 'd100-under' | 'd20-plus'
  target: number
}

/**
 * Un jet **joué à la table** : le dé est celui du joueur, l'application ne fait
 * que le noter. `die` est la valeur lue sur le dé ; le total et le niveau s'en
 * déduisent exactement comme pour un tirage, si bien qu'un jet enregistré et un
 * jet tiré sont la même ligne dans le journal.
 */
export interface RollRecord extends RollRequest {
  die: number
}

/* ---------- Annotations d'un lieu — pour le MJ seul ---------- */

/**
 * Ce que le MJ écrit sur la carte d'un lieu pour lui-même : des repères
 * numérotés — « 3 — le coffre sous la latte » — et des textes libres.
 *
 * **Ces objets n'entrent jamais dans `DisplayState`.** La fenêtre joueurs ne
 * reçoit que l'état de diffusion ; tant que les annotations n'y figurent pas,
 * elle ne peut pas les afficher, même par erreur. C'est voulu : la garantie
 * tient à la forme des données, pas à un drapeau qu'on penserait à vérifier.
 */
export interface Annotation {
  id: number
  placeId: number
  kind: 'repere' | 'texte'
  /** Numéro du repère ; nul pour un texte libre. */
  num: number | null
  texte: string
  /** Nom d'un jeton de couleur, comme les pions. */
  color: string | null
  /** Position en fraction de la carte, comme les pions. */
  x: number
  y: number
}

/* ---------- Murs invisibles d'un lieu — pour le MJ seul ---------- */

/**
 * Ce qu'un trait du calque de murs arrête.
 *
 * Deux choses seulement se laissent arrêter : le pas et la vue. Les quatre
 * natures sont les quatre façons de les combiner — et c'est pour ça qu'il y en
 * a quatre, pas trois ni douze.
 */
/**
 * Ce qu'un trait du calque peut être — deux natures, pas quatre.
 *
 * Un mur ferme, un rideau voile. Porte et fenêtre ne sont plus des traits :
 * elles se posent **sur** un mur (voir `Ouverture`), justement pour que le
 * contour reste entier et qu'une pièce puisse se refermer dessus.
 */
export type NatureMur = 'mur' | 'rideau'

export const MUR_NATURES: Record<
  NatureMur,
  { label: string; quoi: string; pas: boolean; vue: boolean }
> = {
  mur: { label: 'Mur', quoi: 'arrête le pas et la vue', pas: true, vue: true },
  rideau: { label: 'Rideau', quoi: 'laisse passer, coupe la vue', pas: false, vue: true }
}

/** Ce qu'on perce dans un mur. */
export type NatureOuverture = 'porte' | 'vitre'

export const OUVERTURE_NATURES: Record<
  NatureOuverture,
  { label: string; quoi: string }
> = {
  /* Une porte fermée est un mur ; ouverte, elle n'est plus rien. La bascule
     vit dans la base : on rouvre l'application au milieu d'une campagne, les
     portes sont comme on les a laissées. */
  porte: { label: 'Porte', quoi: 'arrête tout — fermée' },
  vitre: { label: 'Fenêtre', quoi: 'arrête le pas, laisse voir' }
}

/** Un point du calque, en fractions de la carte : `[x, y]`, comme les repères. */
export type PointMur = [number, number]

/**
 * Un trait du calque de murs : une polyligne posée sur la carte d'un lieu.
 *
 * **Ces objets n'entrent jamais dans `DisplayState`**, exactement comme les
 * annotations : les murs servent à empêcher un pion de traverser et à calculer
 * ce qu'il voit, jamais à être montrés. La garantie tient à la forme des
 * données, pas à un drapeau qu'on penserait à vérifier.
 */
export interface Mur {
  id: number
  placeId: number
  nature: NatureMur
  /** Au moins deux points ; le dernier rejoint le premier pour une pièce. */
  pts: PointMur[]
  /**
   * Ouvert : n'a de sens que pour un rideau, et c'est le MJ seul qui le tire.
   *
   * Tiré, il voile — c'est ce qu'un rideau fait. Ouvert, on voit au travers,
   * et il ne reste qu'un trait sur le plan du MJ. Le pas, lui, n'en a jamais
   * rien su : on passe derrière une tenture, tirée ou non.
   */
  ouvert: boolean
}

/**
 * Une porte ou une fenêtre, **posée sur un mur**.
 *
 * Elle ne se trace pas : elle prend la direction du mur qui la porte, et on
 * ne règle que sa largeur et sa place le long de lui. Le mur, lui, reste
 * entier — c'est ce qui permet au contour d'une pièce de se refermer alors
 * même qu'on y passe.
 */
export interface Ouverture {
  id: number
  murId: number
  nature: NatureOuverture
  /** Où elle se trouve le long du mur, de 0 (le début) à 1 (la fin). */
  d: number
  /** Sa largeur, en fraction de la carte — comme tout le reste du calque. */
  largeur: number
  /** N'a de sens que pour une porte. */
  ouverte: boolean
  /**
   * Verrouillée : n'a de sens que pour une porte, et c'est le MJ seul qui
   * l'accorde. Les joueurs poussent toutes les autres ; celle-là leur résiste
   * tant qu'il ne l'a pas ouverte — la cave, la chambre du fond, la porte
   * dont la clé est ailleurs dans la maison.
   */
  verrouillee: boolean
}

/**
 * Une porte laisse-t-elle passer ? Verrouillée, jamais — même si quelqu'un
 * avait mis les deux drapeaux à vrai. L'invariant tient ici, une fois pour
 * toutes, plutôt que dans chaque endroit qui interroge une porte.
 */
export function porteFranchissable(o: Ouverture): boolean {
  return o.nature === 'porte' && o.ouverte && !o.verrouillee
}

/** Ce trait arrête-t-il le pas ? (Les ouvertures le percent ailleurs.) */
export function murArretePas(m: Mur): boolean {
  return MUR_NATURES[m.nature].pas
}

/**
 * Ce trait arrête-t-il la vue ?
 *
 * Un rideau ouvert ne voile plus rien. L'invariant tient ici, comme celui de
 * la porte verrouillée : la Régie, la fenêtre des joueurs et le serveur du
 * portable passent tous par cette fonction, et voient donc la même chose.
 */
export function murArreteVue(m: Mur): boolean {
  return MUR_NATURES[m.nature].vue && !m.ouvert
}

/** Un rideau, et tiré : le seul trait qu'on manœuvre en partie. */
export function rideauTire(m: Mur): boolean {
  return m.nature === 'rideau' && !m.ouvert
}

/** Cette ouverture laisse-t-elle passer le pas ? la vue ? */
export function ouvertureLaissePasser(o: Ouverture, quoi: 'pas' | 'vue'): boolean {
  if (o.nature === 'vitre') return quoi === 'vue'
  return porteFranchissable(o)
}

/**
 * L'ouverture du regard, en degrés. 120°, c'est l'œil humain utile : personne
 * ne voit dans son dos, et un pion qui verrait à 360° rendrait toute embuscade
 * impossible. Le cap, lui, appartient déjà au pion — c'est sa rotation.
 */
export const OUVERTURE_REGARD = 120

/** Les ouvertures proposées. 360, c'est ce qui n'a pas de dos : une lanterne. */
export const OUVERTURES = [60, 90, 120, 180, 360]

/* ---------- Régie / écran joueurs ---------- */

/**
 * Dispositions de collage. Le chiffre dit combien d'images tiennent à l'écran,
 * la lettre comment elles se partagent la place.
 */
export type CollageLayout =
  | '1'
  | '2h'
  | '2v'
  | '3g'
  | '3h'
  | '3b'
  | '4'
  | '4l'
  | '4b'
  | '6'

export const COLLAGE_CELLS: Record<CollageLayout, number> = {
  '1': 1,
  '2h': 2,
  '2v': 2,
  '3g': 3,
  '3h': 3,
  '3b': 3,
  '4': 4,
  '4l': 4,
  '4b': 4,
  '6': 6
}

/**
 * Cadrage d'une image : l'agrandissement et le décalage, en fractions du cadre.
 * `zoom` 1 et décalages nuls, c'est l'image telle qu'elle entre d'elle-même.
 */
export interface Frame {
  zoom: number
  ox: number
  oy: number
  /**
   * Quart de tour appliqué à l'image, en degrés. Absent, elle est droite.
   * Par quarts et non librement : une carte scannée de travers se redresse
   * d'un quart de tour, et les bornes du recadrage restent calculables.
   */
  rot?: 0 | 90 | 180 | 270
  /**
   * Luminosité de cette image, de 0.3 à 2.5. 1, ou absente, c'est le fichier
   * tel qu'il est. Une carte scannée trop sombre s'éclaircit, une illustration
   * trop crue s'assombrit — la correction appartient à l'image et la suit
   * partout : elle vaut aussi bien en plein écran que dans une case de collage.
   */
  lum?: number
}

/** Bornes du réglage de luminosité. En deçà et au-delà, il ne reste rien à voir. */
export const LUM_MIN = 0.3
export const LUM_MAX = 2.5

export const FRAME_NEUTRE: Frame = { zoom: 1, ox: 0, oy: 0 }

/**
 * Une case de collage.
 *
 * Elle porte une image — c'est le cas courant — ou du texte écrit à même
 * l'écran. La case de texte existe pour ce qu'aucune image ne dit mieux : un
 * nom, une date, une réplique, la ligne d'un télégramme. Aller chercher un
 * fichier pour afficher trois mots serait une comédie.
 */
export type CollageCell =
  | {
      kind: 'image'
      itemId: number
      url: string
      title: string
      frame?: Frame
      /**
       * La légende de la case. Elle appartient à la case et non à l'écran :
       * elle se range sous elle, la suit si on change de disposition, et s'en
       * va avec elle. C'est ce qui la distingue d'un `TextOverlay`, qu'on pose
       * librement à la main n'importe où sur l'image.
       */
      caption?: string
    }
  | {
      kind: 'texte'
      texte: string
      /** L'encre, en hexadécimal : la fenêtre joueurs n'a pas nos jetons CSS. */
      color?: string
    }

/**
 * Le corps d'une case de texte, en `em` de la diapositive — donc juste aux
 * trois échelles, comme tout le reste de `Slide.tsx`.
 *
 * Il se déduit de la longueur, et non d'un réglage de plus : trois mots sont
 * un titre, qu'on lit du fond de la pièce ; trente lignes sont une lettre,
 * qu'on lit en se penchant. Entre les deux, le texte doit surtout tenir dans
 * sa case.
 */
export function corpsDeCase(texte: string): number {
  const n = texte.trim().length
  if (n <= 16) return 3.4
  if (n <= 48) return 2.4
  if (n <= 140) return 1.7
  return 1.2
}

/**
 * Un texte posé par-dessus l'écran : un nom de lieu, une inscription, une
 * réplique. Il appartient à l'emplacement, pas à l'image : on feuillette les
 * cartes, le texte reste, jusqu'à ce qu'on le retire. Un écran peut en porter
 * plusieurs — légender trois photos d'un collage demande trois textes.
 */
export interface TextOverlay {
  /** Propre à l'emplacement ; sert à savoir lequel on modifie ou déplace. */
  id: number
  text: string
  /** Corps du texte, en pourcentage de la largeur de l'écran. */
  size: number
  /** Couleur en hexadécimal : la fenêtre joueurs n'a pas nos jetons CSS. */
  color: string
  /** Position du centre du texte, en fractions de l'écran. */
  x: number
  y: number
  /** Cartouche sombre derrière le texte, lisible même sur une carte claire. */
  plate: boolean
}

export const TEXTE_NEUF: Omit<TextOverlay, 'id'> = {
  text: '',
  size: 4,
  color: '#f2ece0',
  x: 0.5,
  y: 0.86,
  plate: true
}

/**
 * Les textes suivants ne se posent pas au même endroit que le premier : sans
 * ça, ils s'empileraient exactement l'un sur l'autre et on croirait avoir raté
 * son geste. On monte d'un cran à chaque fois.
 */
export function texteNeuf(id: number, deja: number): TextOverlay {
  return { ...TEXTE_NEUF, id, y: Math.max(0.12, TEXTE_NEUF.y - deja * 0.11) }
}

/** Les couleurs proposées en régie, reprises des jetons de l'interface. */
/**
 * Les couleurs qu'un personnage peut prendre : le nom d'un jeton, jamais un
 * code hexadécimal, pour que la palette reste maîtresse. `hex` n'est là que
 * pour dessiner la pastille de choix.
 */
export const PION_COULEURS: { key: string; name: string; hex: string }[] = [
  { key: 'brass', name: 'Laiton', hex: '#d8a94a' },
  { key: 'blood', name: 'Sang', hex: '#c0564d' },
  { key: 'iris', name: 'Iris', hex: '#8f7fc9' },
  { key: 'moss', name: 'Mousse', hex: '#6aa87c' },
  { key: 'azur', name: 'Azur', hex: '#5aa9c9' },
  { key: 'jade', name: 'Jade', hex: '#4fb3a3' },
  { key: 'olive', name: 'Olive', hex: '#a3a63f' },
  { key: 'orange', name: 'Orange', hex: '#e0813c' },
  { key: 'prune', name: 'Prune', hex: '#a0628f' },
  /* Six teintes de plus, choisies dans les trous du cercle chromatique laissés
     par les neuf premières : un vert franc, un bleu profond, un violet, un
     rose, un brun et un gris bleuté. Assez écartées les unes des autres pour
     qu'on les distingue à un mètre, sur un pion de deux centimètres. */
  { key: 'fougere', name: 'Fougère', hex: '#6fae4e' },
  { key: 'outremer', name: 'Outremer', hex: '#5f7ad0' },
  { key: 'amethyste', name: 'Améthyste', hex: '#a06fd0' },
  { key: 'bruyere', name: 'Bruyère', hex: '#d0708f' },
  { key: 'argile', name: 'Argile', hex: '#9d6b4c' },
  { key: 'ardoise', name: 'Ardoise', hex: '#708a9c' },
  { key: 'neutral', name: 'Pierre', hex: '#6b7b80' }
]

/**
 * L'ordre d'attribution : le premier personnage prend Laiton, le suivant Sang,
 * et ainsi de suite. **Une couleur ne sert qu'une fois** à une table — c'est à
 * ça qu'on se reconnaît. Au-delà de seize joueurs, on recommence au début.
 */
export const couleurLibre = (prises: (string | null)[]): string => {
  const dejaLa = new Set(prises.filter(Boolean) as string[])
  return PION_COULEURS.find((c) => !dejaLa.has(c.key))?.key ?? PION_COULEURS[0].key
}

export const TEXTE_COULEURS: { name: string; hex: string }[] = [
  { name: 'Ivoire', hex: '#f2ece0' },
  { name: 'Laiton', hex: '#d8a94a' },
  { name: 'Sang', hex: '#c2563f' },
  { name: 'Mousse', hex: '#7fb08c' },
  { name: 'Iris', hex: '#a79ada' },
  { name: 'Encre', hex: '#0b1013' }
]

export type SlidePayload = (
  | { type: 'black' }
  | { type: 'image'; itemId: number; url: string; title: string; caption?: string; frame?: Frame }
  | {
      type: 'video'
      itemId: number
      url: string
      title: string
      loop: boolean
      /** Une vidéo se recadre comme une image : même cadre, mêmes gestes. */
      frame?: Frame
    }
  | { type: 'collage'; layout: CollageLayout; cells: (CollageCell | null)[] }
  | { type: 'text'; title: string; html: string; kicker?: string }
  | { type: 'plate'; title: string; subtitle?: string }
) & {
  /** Les textes posés sur cet écran, du fond vers le dessus. */
  texts?: TextOverlay[]
}

/* ---------- La manière de basculer ---------- */

/**
 * Comment l'écran des joueurs passe d'un visuel à l'autre.
 *
 * Une table de mixage a ses enchaînements, et ils ne disent pas la même chose :
 * un fondu relie deux moments, un volet en ouvre un autre, le passage par le
 * noir met un point. La coupe, elle, n'est pas dans cette liste : c'est un
 * bouton à part, celui qu'on frappe quand il faut que ça s'arrête tout de
 * suite.
 */
export type Transition = 'fondu' | 'volet' | 'noir'

export const TRANSITIONS: { key: Transition; name: string; aide: string }[] = [
  { key: 'fondu', name: 'Fondu', aide: 'Les deux images se traversent — deux moments qui se suivent' },
  { key: 'volet', name: 'Volet', aide: 'La nouvelle balaie l’ancienne — on ouvre autre chose' },
  { key: 'noir', name: 'Par le noir', aide: 'On passe par le noir — un point, puis autre chose' }
]

/* ---------- Pions posés sur l'écran joueurs ---------- */

/**
 * Un pion appartient à un lieu, pas à une image : on change de carte, il reste
 * où il était et revient quand on revient au lieu.
 */
export interface Pion {
  id: number
  placeId: number
  characterId: number | null
  itemId: number | null
  label: string
  /** Portrait ou image du pion, déjà servie en jdr://. */
  url: string | null
  initials: string
  /** Nom d'un jeton de couleur : brass, moss, iris, blood, neutral. */
  color: string
  /** Position en fraction de la largeur et de la hauteur de l'écran. */
  x: number
  y: number
  /**
   * Le calque : qui passe devant qui. Les pions se dessinent dans cet ordre,
   * et le dernier dessiné est au-dessus.
   */
  ord: number
  /**
   * Angle en degrés. C'est l'image qui tourne dans le jeton, pas le jeton :
   * un rond qui tourne ne se voit pas, et un nom à l'envers ne se lit plus.
   */
  rotation: number
  /**
   * Posé pour le MJ seul — le rôdeur embusqué. Un pion caché n'entre jamais
   * dans `DisplayState` : la fenêtre joueurs ne peut donc pas l'afficher, et
   * le moniteur du rail ne ment pas en ne le montrant pas.
   */
  cache: boolean
}

/**
 * Un joueur posé quelque part, vu depuis la liste des lieux : son visage, sa
 * couleur, et de quel personnage il s'agit. C'est ce que la régie affiche en
 * face de chaque lieu — qui s'y trouve, et non combien de pions y traînent.
 */
export interface PionJoueur {
  characterId: number
  name: string
  /** Nom d'un jeton de couleur : brass, moss, iris, blood, neutral. */
  color: string
  /** Portrait du personnage, déjà servi en jdr:// ; null, on montre ses initiales. */
  url: string | null
  initials: string
}

/** Ce qu'un lieu porte : tous ses pions, et parmi eux les joueurs. */
export interface PionsDuLieu {
  count: number
  joueurs: PionJoueur[]
}

/**
 * Un personnage joueur tel que l'écran le montre : son visage, sa couleur et
 * ses points de vie. C'est la **première jauge du gabarit** qui fait foi — tous
 * les gabarits livrés commencent par les points de vie, et un gabarit maison
 * qui ferait autrement dirait simplement autre chose de sa première jauge.
 */
export interface JaugeVue {
  /** Clé de la jauge dans le gabarit — c'est elle qu'on ajuste. */
  key: string
  value: number
  max: number
  label: string
}

/**
 * Ce qu'un pion dit de l'état de son personnage — lu sur ses points de vie.
 *
 * Rien à saisir nulle part : le MJ baisse la jauge, le pion le dit tout seul,
 * sur l'écran des joueurs comme sur leur téléphone. Tombé à zéro, le
 * personnage est à terre ; à la moitié ou en dessous, il est blessé. Un
 * gabarit sans jauge de vie ne dit rien : mieux vaut se taire que deviner.
 */
export type EtatPion = 'blesse' | 'ko'

export function etatDeVie(
  pv: { value: number; max: number } | null | undefined
): EtatPion | null {
  if (!pv || pv.max <= 0) return null
  if (pv.value <= 0) return 'ko'
  return pv.value <= pv.max / 2 ? 'blesse' : null
}

export interface JoueurVu {
  id: number
  name: string
  color: string | null
  /** Portrait, déjà servi en jdr://. */
  url: string | null
  initials: string
  /** La vie : première jauge du gabarit. */
  pv: JaugeVue | null
  /** La santé mentale, si le gabarit en a une ; sinon rien à montrer. */
  sm: JaugeVue | null
}

/**
 * L'encart des joueurs : posé où l'on veut sur l'image, à la taille qu'on veut.
 * `x` et `y` sont des fractions de l'écran — comme les pions et les textes,
 * pour que le même réglage donne la même image aux trois échelles.
 */
export interface Encart {
  on: boolean
  x: number
  y: number
  /** En ligne ou en colonne : deux façons de lire le même groupe. */
  sens: 'horizontal' | 'vertical'
  /** Largeur et hauteur, en pourcentage de l'écran — réglées à la poignée. */
  largeur: number
  hauteur: number
  /** Montrer aussi la santé mentale, à côté de la vie. */
  sm: boolean
}

export const ENCART_NEUF: Encart = {
  on: false,
  x: 0.5,
  y: 0.88,
  sens: 'horizontal',
  largeur: 46,
  hauteur: 13,
  sm: false
}

/** Ce que le MJ montre du doigt, en fraction de l'écran. */
export interface Pointer {
  x: number
  y: number
}

export interface AudioState {
  itemId: number | null
  url: string | null
  title: string | null
  playing: boolean
  loop: boolean
  volume: number
}

export interface DisplayState {
  /** Ce qui est à l'écran : toujours `slots[liveSlot]`. */
  slide: SlidePayload
  /**
   * Deux emplacements, comme une table de mixage : l'un est à l'antenne,
   * l'autre se prépare. La bascule se fait en fondu, quand on le décide.
   */
  slots: [SlidePayload, SlidePayload]
  liveSlot: 0 | 1
  /** Change à chaque bascule : la fenêtre joueurs sait qu'il faut enchaîner. */
  transition: { id: number; ms: number; mode: Transition } | null
  /** Lieu chargé dans l'emplacement en préparation, pris à la bascule. */
  pendingPlaceId: number | null
  /** Diapositive avant le voile noir, pour pouvoir rétablir. */
  previous: SlidePayload | null
  /**
   * Gelé : **plus rien ne sort vers la fenêtre joueurs** tant que c'est actif.
   * Ni image, ni lieu, ni pion, ni texte, ni cadrage, ni pointeur — le MJ
   * réarrange tout ce qu'il veut, les joueurs gardent l'écran qu'ils avaient.
   * Le son en cours continue ; aucun nouveau ne part.
   */
  frozen: boolean
  /**
   * Ce que les joueurs ont vraiment sous les yeux pendant le gel — figé au
   * moment où on l'a déclenché. Le moniteur du rail le montre, sans quoi il
   * mentirait, ce qui est tout ce que cette application refuse de faire.
   */
  frozenView: {
    slide: SlidePayload
    pions: Pion[]
    pionSize: number
    /** Le pion suivi à l'instant du gel : le moniteur recentre comme eux. */
    focusPionId: number | null
  } | null
  /** Le nom du joueur s'écrit-il sous son pion, sur l'écran des joueurs ? */
  pionLabels: boolean
  /** Et ses points de vie, juste en dessous ? */
  pionPv: boolean
  /**
   * L'encart des joueurs : les portraits, les noms et les points de vie,
   * ancrés d'un côté de l'image et qui y restent tant qu'on les garde.
   */
  encart: Encart
  /** Les personnages joueurs, tels que l'écran les montre. */
  joueurs: JoueurVu[]
  audio: AudioState
  outputDisplayId: number | null
  playerOpen: boolean
  /** Lieu où se tient la scène : c'est lui qui porte les pions. */
  placeId: number | null
  /**
   * Avance d'un cran chaque fois qu'une lampe ou une porte change d'état.
   *
   * Le calque des murs ne voyage pas dans cet état — il ne bouge qu'entre deux
   * scènes, et l'y mettre alourdirait chaque frémissement de pion. Mais quand
   * le MJ souffle une bougie, l'écran des joueurs doit l'apprendre : ce
   * compteur est le signal qu'il attend pour relire le calque.
   */
  calqueRev: number
  pions: Pion[]
  /** Taille des pions du lieu, en pourcentage de la largeur de l'écran. */
  pionSize: number
  /**
   * Le pion que l'écran suit, ou `null` : la caméra de la table.
   *
   * Ce n'est pas un cadrage de plus — c'est une consigne. Le cadrage rangé
   * dans la diapositive ne bouge pas ; chaque écran, connaissant sa propre
   * taille, recentre l'image sur ce pion au moment de la dessiner et la
   * retrouve intacte quand on lâche le pion. C'est aussi pourquoi suivre
   * quelqu'un qui marche ne coûte rien : la position du pion voyage déjà.
   */
  focusPionId: number | null
  pointer: Pointer | null
  /**
   * Le QR code d'appairage, posé par-dessus ce qui est à l'écran.
   *
   * C'est l'écran que toute la table regarde : c'est donc là qu'on tend le
   * code, pas sur le portable du MJ autour duquel il faudrait se pencher. Il
   * s'en va avec l'invitation, au bout de cinq minutes ou d'un clic.
   */
  qr: { dataUrl: string; url: string } | null
}

export interface ScreenInfo {
  id: number
  label: string
  width: number
  height: number
  primary: boolean
  scaleFactor: number
}

/* ---------- Filtres ---------- */

export interface ItemFilter {
  folderId?: number | null
  chapterId?: number | null
  placeId?: number | null
  kinds?: ItemKind[]
  search?: string
}

/* ---------- L'examen des médias ---------- */

/**
 * Le travail confié au graveur pour un média — la fenêtre cachée qui décode ce
 * que le processus principal ne sait pas lire. Voir `main/examen.ts`.
 */
export interface ExamenJob {
  id: number
  kind: 'image' | 'video' | 'audio'
  url: string
  titre: string
  /** Rendue telle quelle avec le résultat : c'est elle qu'on retiendra. */
  sig: string
}

/** Ce que le graveur en rapporte. Tout peut être nul : un média peut résister. */
export interface ExamenFait {
  id: number
  sig: string
  width: number | null
  height: number | null
  duration: number | null
  /** L'image saisie, en `data:image/jpeg;base64,…` — nulle pour un son. */
  vignette: string | null
  erreur: string | null
}

/* ---------- Dossier de campagne ---------- */

/** État du lien entre la campagne et son dossier sur le disque. */
export interface LibraryRoot {
  path: string | null
  exists: boolean
  watching: boolean
  folders: number
  files: number
  scannedAt: string | null
}

/* ============================================================
   Le portable des joueurs
   ============================================================ */

/** Un téléphone ou une tablette appairé à un joueur de la campagne. */
export interface MobileDevice {
  id: number
  playerId: number
  playerName: string
  playerColor: string | null
  characterName: string | null
  /** « téléphone » pour le premier appareil, « tablette » pour le second. */
  label: string
  pairedAt: string
  lastSeen: string | null
  /** Un flux ouvert en ce moment — pas « il s'est connecté un jour ». */
  online: boolean
}

export interface MobileInfo {
  running: boolean
  /** L'adresse à taper si le QR ne se scanne pas. */
  url: string | null
  port: number
  /** L'accès est-il ouvert — il le reste tant que le projet l'est. */
  inviteOpen: boolean
  /** L'image du code, fabriquée une fois et gardée. */
  qr: string | null
  devices: MobileDevice[]
  maxPerPlayer: number
  /** Les cartes réseau de ce poste : sur deux réseaux, le QR n'en porte qu'un. */
  adresses: { nom: string; ip: string }[]
  /** Celle qu'on annonce, choisie ou devinée. */
  adresse: string | null
}

/**
 * Un point montré du doigt depuis un téléphone.
 *
 * Il ne dure pas : c'est un geste, pas un état. Deux tapes sur le plan et
 * l'onde part à l'écran des joueurs, à la couleur de celui qui montre — la
 * même qui cercle son pion, pour qu'on sache qui parle sans qu'il le dise.
 */
export interface MobilePing {
  id: number
  x: number
  y: number
  color: string | null
  /** Qui montre — pour le dire au MJ, qui ne regarde pas toujours l'écran. */
  playerName: string
}

/** « Alexis déplace son pion » — vrai encore cinq secondes après son geste. */
export interface MobileNudge {
  playerId: number
  playerName: string
}

/* ============================================================
   La pochette — ce que les joueurs ont en main
   ============================================================ */

/** Un rangement de la pochette. Facultatif : une pochette peut n'en avoir aucun. */
export interface PochetteOnglet {
  id: number
  name: string
  ord: number
  /** Combien de documents y sont rangés — pour le compte de la barre. */
  count: number
}

/**
 * Un document donné aux joueurs.
 *
 * `playerId` nul veut dire « toute la table » ; nommé, le document n'est qu'à
 * cette personne. `ongletId` nul veut dire « dans la pile » — l'état d'une
 * pochette sans onglet.
 */
export interface PochetteDoc {
  id: number
  itemId: number
  /** Le document lui-même, tel que la bibliothèque le sert. */
  item: Item & { url: string | null; poster: string | null }
  playerId: number | null
  /** Le nom de la personne, et celui de son personnage : le MJ pense aux deux. */
  playerName: string | null
  characterName: string | null
  playerColor: string | null
  ongletId: number | null
  ongletName: string | null
  /**
   * Montré aux joueurs, ou encore en réserve. Un document entre caché : on le
   * prépare pendant qu'ils discutent, on le montre quand ils le trouvent.
   */
  visible: boolean
  givenAt: string
  /** Qui l'a ouvert, par identifiant de joueur. */
  luPar: number[]
}

/** Un jet arrivé d'un téléphone, annoncé au maître du jeu. */
export interface MobileRoll {
  playerName: string
  characterName: string
  color: string | null
  label: string
  die: number
  total: number
}
