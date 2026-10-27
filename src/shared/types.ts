/** Types partagés entre le processus principal, le préchargement et les interfaces. */
import type { Modif } from './modifs'

export type ItemKind = 'doc' | 'image' | 'video' | 'audio' | 'pdf' | 'other'

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
 *
 * **Un lieu peut être un bâtiment** (7 octobre 2026) : la chapelle posée sur
 * le plan de l'extérieur reçoit ses propres niveaux, qui tiennent ses pièces.
 * On retrouve espace → niveau → lieu à l'intérieur ; aucun autre emboîtement.
 */
export type PlaceTier = 'espace' | 'niveau' | 'lieu'

/** Les contenants admis au-dessus de chaque étage ; vide, c'est la racine. */
export const PARENT_TIERS: Record<PlaceTier, PlaceTier[]> = {
  espace: [],
  niveau: ['espace', 'lieu'],
  /* Un lieu posé à même l'espace est un bâtiment : le domaine tient la
     chapelle et la grange à côté de son plan d'ensemble. */
  lieu: ['niveau', 'espace']
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

/**
 * L'échelle d'un plan, et la taille que les pions en tirent (voir
 * `src/main/db/repos/echelle.ts`).
 */
export interface EchellePlan {
  /** Le lieu qui porte le plan : l'étage, pour une pièce découpée. */
  planId: number
  /** Combien de mètres fait la largeur de l'image ; `null`, on ne sait pas. */
  metres: number | null
  /** Fixée au trait, estimée d'après les portes, ou inconnue. */
  source: 'trait' | 'portes' | null
  /** Les portes posées sur ce plan. */
  portes: number
  /** La taille des pions est-elle réglée à la main sur ce lieu ? */
  pionMain: boolean
  /** La taille d'un pion à l'écran, en pour cent de la largeur du plan. */
  pionPourcent: number
  /**
   * L'allure des pions pilotés sur ce plan : la part de la largeur qu'ils
   * parcourent en une seconde, pouce au bord du disque.
   */
  allure: number
  /** L'allure a-t-elle été réglée sur ce plan, ou est-ce celle d'usine ? */
  allureReglee: boolean
}

/** L'allure d'usine d'un pion piloté : 12 % de la largeur du plan par seconde. */
export const ALLURE_DEFAUT = 0.12
/** Les bornes de l'allure, en part de la largeur du plan par seconde. */
export const ALLURE_MIN = 0.01
export const ALLURE_MAX = 0.6

export interface Place {
  id: number
  tier: PlaceTier
  /**
   * Le contenant : un espace — ou un lieu devenu bâtiment — pour un niveau,
   * un niveau pour un lieu.
   */
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
   * Ce lieu n'est qu'une pièce. Les murs tracés sur son plan referment le lieu
   * lui-même : ils ne proposent pas de pièces à nommer, et le lieu ne devient
   * jamais l'étage d'autres lieux.
   */
  pieceUnique: boolean
  /**
   * Un bâtiment épingle ce qui peut y arriver à tous ses lieux : ses
   * découvertes, déclencheurs et scénarios se lisent aussi sur la fiche de
   * chacun de ses niveaux et de ses pièces, marqués de son nom.
   */
  epingleArrivees: boolean
  /**
   * Jusqu'où un regard porte sur cette carte, en part de sa largeur.
   *
   * `null` — sans limite : le regard va jusqu'au mur, comme avant. Sinon, il
   * s'arrête là, même sans rien pour l'arrêter : un grand hall ne se découvre
   * pas d'un coup d'œil depuis la porte.
   */
  regardPortee: number | null
  /**
   * Le soleil ou la lune qui éclaire cette carte du dehors ; `null`, aucun.
   * Son cap se compte depuis le nord, pas depuis le haut de l'image.
   */
  astre: Astre | null
  /** Où pointe le nord sur l'image, en degrés : 0 le haut, 90 la droite. */
  nord: number
  /**
   * Le soleil ou la lune de **tous** les lieux de cet espace — un espace
   * seulement, `null` ailleurs. Posé, il prime sur ce que chaque lieu règle.
   */
  ciel: Astre | null
  /**
   * La largeur que prennent les ouvertures posées sur cette carte, en part du
   * plan. `null`, c'est la largeur d'usine — on n'a rien réglé.
   *
   * C'est un réglage d'outil, pas une propriété du lieu : une porte de manoir
   * et une porte de cabane ne font pas la même part du plan, mais sur une même
   * carte elles se ressemblent toutes.
   */
  ouvLargeur: number | null
  /**
   * Les autres apparences de sa carte — la nuit, l'incendie, après
   * l'effondrement. Seul le lieu qui porte le plan en a ; ses pièces suivent.
   */
  apparences: Apparence[]
  /** L'apparence montrée ; `null`, la carte elle-même. */
  apparenceId: number | null
  /** Les images et vidéos à montrer ici, dans leur ordre — au Paravent, avec le moment. */
  imageIds: number[]
  docCount: number
}

/**
 * Une autre image de la même carte, au même cadrage. Seule l'image change :
 * murs, lampes, brouillard et pions restent où ils sont — c'est pourquoi elle
 * doit avoir les proportions de la carte.
 */
export interface Apparence {
  id: number
  placeId: number
  itemId: number
  nom: string
  ord: number
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
  /**
   * Son icône se montre-t-elle aux joueurs ? Le MJ la voit toujours ; les
   * joueurs ne voient que la lueur, sauf si le MJ leur montre l'objet.
   */
  icone: boolean
  /**
   * De combien de degrés s'ouvre le faisceau. 360 : tout autour, la lampe
   * ordinaire ; moins, une lumière **directive** — torche, phare, soupirail.
   */
  ouverture: number
  /** Où pointe le faisceau, en degrés, 0 vers le haut — comme un pion. */
  cap: number
  /** Le nom que le MJ lui a donné ; null : « Lumière », tout simplement. */
  nom: string | null
}

/** Les faisceaux proposés d'un clic à une lumière directive. */
export const FAISCEAUX_LUMIERE = [30, 60, 90, 120, 180]

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
   * le porte, et elle le suit. Le rayon se lit dans le détail de l'effet ;
   * sans portée, c'est celui d'une torche. `ouverture`, le faisceau en
   * degrés, tourné comme le pion — 360, tout autour. `teinte`, la couleur
   * de la lueur — blanc, aucune.
   */
  porteurs: { characterId: number; rayon: number; ouverture: number; objet: string; teinte: string }[]
  /** Le soleil ou la lune de cette carte ; `null`, la nuit noire d'avant. */
  astre: Astre | null
}

/**
 * La lumière du dehors.
 *
 * Le soleil et la lune sont si loin que leurs rayons arrivent parallèles : on
 * ne les pose pas sur la carte — il n'y a pas la place autour d'un bâtiment —,
 * on dit **d'où vient la lumière**. Dehors, tout est éclairé ; dans les
 * pièces, seul ce qui entre par les fenêtres et les portes ouvertes, en
 * traits parallèles que les murs arrêtent.
 *
 * La **nuit noire** est un ciel sans astre : rien n'entre du dehors, et le
 * regard ne distingue plus rien dans le noir — seules les lampes, portées ou
 * posées (une lampe de poche, un lampadaire), font voir. Son cap ne sert pas.
 */
export type NatureAstre = 'soleil' | 'lune' | 'nuit'

/** Il fait nuit noire : le regard seul ne voit rien, il faut une lampe. */
export const nuitNoire = (a: Astre | null | undefined): boolean => a?.nature === 'nuit'

export interface Astre {
  nature: NatureAstre
  /**
   * D'où vient la lumière, en degrés. Sur un lieu ou un espace, depuis le
   * nord (90 l'est) ; dans le calque, depuis le haut de l'image (90 la droite).
   */
  cap: number
}

/**
 * La lumière du dehors d'un lieu, telle qu'elle tombe sur son plan.
 *
 * `astre` est déjà tourné dans le repère de l'image (0 le haut) : c'est ce que
 * le calque dessine. `general` dit que l'espace règle le ciel pour tous ses
 * lieux — on ne le change alors plus lieu par lieu.
 */
export interface CielDuLieu {
  astre: Astre | null
  nord: number
  general: { espaceId: number; nom: string; astre: Astre } | null
}

/** D'où vient la lumière, en mots : le vent le plus proche d'un cap compté depuis le nord. */
export function ventDe(cap: number): string {
  const VENTS = ['du nord', 'du nord-est', 'de l’est', 'du sud-est', 'du sud', 'du sud-ouest', 'de l’ouest', 'du nord-ouest']
  return VENTS[((Math.round(cap / 45) % 8) + 8) % 8]
}

/** La force de chaque astre : la lune éclaire, un peu plus sombre ; la nuit noire, pas du tout. */
export const FORCE_ASTRE: Record<NatureAstre, number> = { soleil: 1, lune: 0.7, nuit: 0 }

/**
 * La lumière commande-t-elle sur cette carte ? Dès qu'il y a une lampe —
 * posée ou portée — ou un ciel, on ne voit que ce qui est éclairé : la
 * portée du regard ne sert plus qu'aux cartes sans aucune lumière.
 */
export const lumiereCommande = (c: {
  lumieres: unknown[]
  porteurs: unknown[]
  astre: Astre | null
}): boolean => c.lumieres.length > 0 || c.porteurs.length > 0 || !!c.astre

export interface Beat {
  id: number
  sessionId: number
  ord: number
  atTime: string | null
  title: string
  note: string | null
  done: boolean
  placeId: number | null
  items: Item[]
  /** Les PNJ que ce moment met en scène : la Régie les range devant les autres. */
  pnjIds: number[]
  /** Le Paravent montre les portraits des joueurs, pour les présenter d'un clic. */
  presenterJoueurs: boolean
}

/** Ce qu'est une carte de la trame : le départ, ce qui se passe, ce qu'ils doivent obtenir, une issue. */
export type TrameType = 'ouverture' | 'scene' | 'objectif' | 'fin'

/** Une carte de la trame de la séance — le MJ seul la voit. */
export interface TrameCarte {
  id: number
  sessionId: number
  type: TrameType
  titre: string
  resume: string
  x: number
  y: number
  /** Plusieurs flèches entrantes : les faut-il toutes, ou une suffit-elle ? */
  regle: 'et' | 'ou'
  fait: boolean
  /** L'image de la carte, prise dans la Bibliothèque. */
  itemId: number | null
  /** Le morceau de l'image qu'on voit dans le bandeau ; null, le centre. */
  imageCadre: CadreCarre | null
  beatId: number | null
  placeId: number | null
  pnjIds: number[]
}

/** « Ceci ouvre la voie à cela », avec ce qui fait passer, en quelques mots. */
export interface TrameLien {
  id: number
  de: number
  a: number
  mot: string
}

export interface Trame {
  cartes: TrameCarte[]
  liens: TrameLien[]
}

/* ---------- La fiche d'un lieu : le MJ seul la voit ---------- */

/** Un scénario possible des joueurs dans ce lieu. Son numéro, c'est sa place. */
export interface LieuScenario {
  id: number
  placeId: number
  titre: string
  info: string
  /** Joué pendant la partie : il se range avec les découvertes trouvées. */
  fait: boolean
  /** Où ça se passe sur le plan de l'étage, en fractions ; `null`, pas posé. */
  pos: { x: number; y: number } | null
  /** Le moment où il mène. */
  beatId: number | null
  objetIds: number[]
  pnjIds: number[]
}

/** Ce qu'on découvre là, ou ce que les joueurs y déclenchent. */
export type SorteCarte = 'decouverte' | 'declencheur'

/**
 * Une découverte ou un déclencheur : « si… alors… ». Cochée, elle descend en
 * bas de la liste ; décochée, elle remonte en haut.
 */
export interface LieuCarte {
  id: number
  placeId: number
  sorte: SorteCarte
  titre: string
  si: string
  alors: string
  fait: boolean
  /** Où ça se passe sur le plan de l'étage, en fractions ; `null`, pas posée. */
  pos: { x: number; y: number } | null
  /** Le moment où mène un déclencheur. */
  beatId: number | null
  objetIds: number[]
  pnjIds: number[]
}

export interface FicheDuLieu {
  scenarios: LieuScenario[]
  cartes: LieuCarte[]
  /** Les PNJ qu'on rencontre dans ce lieu, dans l'ordre où on les a mis. */
  pnjIds: number[]
}

export interface GameSession {
  id: number
  label: string
  date: string
  notes: string | null
  /**
   * Le dossier de la séance, relatif à la racine de la campagne. Posé, les
   * fichiers des autres séances s'effacent des listes ; nul, on voit tout.
   */
  folderRel: string | null
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
  /** Rangée hors de la vue du carnet — elle garde ses inscriptions et ses personnages. */
  masque: boolean
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

/** Les couleurs qu'une jauge peut porter : les teintes du thème, en clair comme en sombre. */
export type CouleurJauge =
  | 'blood'
  | 'orange'
  | 'argile'
  | 'brass'
  | 'olive'
  | 'moss'
  | 'fougere'
  | 'jade'
  | 'azur'
  | 'ardoise'
  | 'outremer'
  | 'iris'
  | 'amethyste'
  | 'prune'
  | 'bruyere'
  | 'neutral'

export interface GaugeSpec {
  key: string
  label: string
  min: number
  max: number
  color: CouleurJauge
  /** Le maximum est-il modifiable par le MJ (perte de SAN définitive, par ex.) */
  maxEditable?: boolean
  /**
   * La jauge vaut-elle aussi pour les PNJ ? Absente : oui. `false` : les
   * fiches de PNJ ne la montrent pas — un figurant n'a pas de santé mentale.
   */
  pnj?: boolean
}

/** Les jauges qu'un personnage porte : toutes pour un joueur, celles des PNJ pour un PNJ. */
export function jaugesDe<G extends { pnj?: boolean }>(gauges: G[], kind: 'pj' | 'pnj'): G[] {
  return kind === 'pnj' ? gauges.filter((g) => g.pnj !== false) : gauges
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
  /**
   * La table ne se sert pas des compétences : elles disparaissent des fiches,
   * du téléphone et de la préparation. La liste reste dans la fiche de
   * campagne, et ce que les personnages avaient pris reste en base.
   */
  sansCompetences?: boolean
  /**
   * La règle de la préparation du personnage — voir `shared/preparation.ts`.
   * Absente : 8 de départ, 40 points, plafond 20, compétences comprises.
   */
  preparation?: { depart?: number; points?: number; plafond?: number; competences?: boolean }
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
  /**
   * Sa bourse : combien de chaque monnaie de la campagne, par clé (voir
   * `@shared/monnaies`). Absente, tout est à zéro. Elle suit le personnage
   * d'une séance à l'autre avec le reste de ses données.
   */
  bourse?: Record<string, number>
  /**
   * Ses bonus et malus au jet, posés par le MJ (voir `@shared/modifs`).
   * Absents, aucun ; ceux de ses objets portés ne s'y écrivent pas.
   */
  modifs?: Modif[]
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
   * Là à la séance en cours. Un PNJ l'est toujours ; un joueur absent sort
   * des fiches, de la bande, de l'encart et des pions à poser.
   */
  present: boolean
  /** Sorti de la campagne à cette séance ou avant : il ne revient plus. */
  horsJeu: boolean
  /**
   * Ce que le MJ sait de lui : ce qu'il cache, ce qui le fait céder. **Les
   * PNJ seulement** — un joueur a sa propre feuille pour ça. Jamais diffusé.
   */
  notes: string | null
  name: string
  player: string | null
  occupation: string | null
  portraitItemId: number | null
  /** Le carré qu'on taille dans son portrait pour le pion ; null, le centre. */
  portraitCadre: CadreCarre | null
  age: string | null
  /** Son histoire, écrite par le joueur ou le MJ. Les joueurs seulement. */
  biographie: string | null
  /** Où il est né — un lieu dit en toutes lettres, pas une fiche de lieu. */
  lieuNaissance: string | null
  /** La ville où il vit au début de la partie. */
  ville: string | null
  /** Ce qui jaillit derrière lui quand on le présente à l'écran : cinq au plus. */
  emojis: string[]
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
  /** PNJ : son état (blessé, à terre) se lit sur son pion, chez les joueurs aussi. */
  etatVisible: boolean
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
  /** Le cadre taillé dans l'image pour le bandeau de sa fiche ; `null`, au centre. */
  imageCadre: CadreCarre | null
  /** Pièce unique, ou chose qui se compte — une corde, six bougies. */
  unique: boolean
  /** Combien on en pose d'un coup quand il se compte. Une pièce unique, c'est 1. */
  qte: number
  /** Ce qu'il pèse, tel que le MJ l'écrit : « 1,2 kg », « deux mains ». */
  poids: string | null
  /** Les places qu'il prend dans un sac : 1 d'ordinaire, 0,5 pour une boîte de cachets. */
  places: number
  /** Les places qu'il ajoute au sac de celui qui le **porte** — un sac à dos. */
  bonusSac: number
  /**
   * Ce qu'il vaut, **en nombre seulement** : l'unité appartient à la campagne
   * (voir `uniteValeur`), pas à l'objet. « 40 », jamais « 40 francs » — sans
   * quoi aucun total ne serait calculable.
   */
  valeur: number | null
  /**
   * Son prix dans les monnaies de la campagne, par clé — « 2 po 5 pa ».
   * Remplace `valeur`, qui ne sert plus qu'à la migration 65 : elle a été
   * reprise dans la première monnaie. `null` : pas de prix.
   */
  prix: Record<string, number> | null
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
  /**
   * Ses exemplaires jetés à la corbeille, dans la séance ouverte. Ils ne
   * comptent nulle part ailleurs — ni posés, ni dans un lieu, ni dans un sac.
   */
  corbeille: ObjetPlacement[]
}

/**
 * Ce qu'un objet change, en une ligne libre : « Dégâts — 1d6 », « +1 —
 * Sang-froid », « Ouvre — la porte du grenier ».
 *
 * Rien n'est câblé à un système de jeu : la tête est l'étiquette qu'on lit en
 * gras, le détail ce qui la suit. Le moteur de fiches est un moteur de
 * gabarits ; ses objets ne peuvent pas être plus rigides que lui.
 */
/** « Éclaire », « Lumière » : la tête d'un effet qui fait de l'objet une lampe. */
export function estLumiere(tete: string): boolean {
  const t = tete.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  return t.startsWith('eclair') || t.startsWith('lumi')
}

/** Cet objet éclaire-t-il ? Un de ses effets, au moins, est une lumière. */
export const eclaire = (o: { effets: { tete: string }[] }): boolean =>
  o.effets.some((e) => estLumiere(e.tete))

export interface EffetObjet {
  id: string
  tete: string
  detail: string
  /** La couleur de la lueur, pour un effet « Éclaire » ; sans elle, aucune. */
  teinte?: string
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
  /** Un de ses objets est posé dans une autre séance : on ne la touche plus, on la masque. */
  verrouillee: boolean
  /** Masquée dans la séance ouverte — depuis celle-ci ou une d'avant. */
  masquee: boolean
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

/**
 * Là où se trouve un exemplaire : un lieu, un PNJ, un joueur, un inventaire
 * partagé — ou la corbeille, où il n'a plus de cible.
 */
export type PortObjet = 'lieu' | 'pnj' | 'pj' | 'inventaire' | 'corbeille'

/** Là où un exemplaire a été rangé au départ, et où « Ranger » le remet. */
export interface EmplacementInitial {
  port: PortObjet
  placeId: number | null
  characterId: number | null
  inventaireId: number | null
  emplacement: string | null
  etat: 'cache' | 'trouve' | 'porte'
  /** Le nom du lieu, du personnage ou de l'inventaire. */
  cible: string
}

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
  inventaireId: number | null
  /** Le nom du lieu, du personnage ou de l'inventaire, tel qu'on le lit dans la fiche. */
  cible: string
  /** Où exactement : « tiroir fermé », « sur l'évier ». */
  precision: string | null
  /**
   * Sur quelqu'un : l'endroit du corps où il le porte — `null`, c'est dans son
   * sac. Équiper et ranger sont donc le même exemplaire, à une colonne près.
   */
  emplacement: string | null
  /** Le lieu d'où il est parti la première fois qu'on l'a donné : sa fiche s'en souvient. */
  origineLieuId: number | null
  qte: number
  etat: 'cache' | 'trouve' | 'porte'
  /** Où il a été rangé au départ ; `null` si sa cible a disparu depuis. */
  initial: EmplacementInitial | null
  /** Il n'est plus là où on l'avait rangé — corbeille comprise. */
  deplace: boolean
  /** Une lampe qu'on a éteinte : elle n'éclaire plus, même portée. */
  eteinte: boolean
  /** Posé dans un lieu, son point sur le plan (fractions de l'image) ; `null` : nulle part de précis. */
  pos: { x: number; y: number } | null
}

/**
 * Un inventaire partagé : le camion, la malle. Le MJ le remplit depuis la
 * réserve ; ouvert, il se voit sur les téléphones et chacun y pioche — l'objet
 * tombe dans son sac — ou y remet ce qu'il porte.
 */
export interface Inventaire {
  id: number
  nom: string
  /** Dans le Sac des joueurs : ils y piochent depuis leur téléphone. */
  ouvert: boolean
  /** Dans la Pochette : ils voient les images de ce qu'il tient, sans rien prendre. */
  enPochette: boolean
  /** Ce qui est passé par là depuis le lancement de l'app, le plus récent en dernier. */
  journal: { heure: string; texte: string }[]
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

/** Un jet de personnage noté : ce que la santé mentale lit pour réagir. */
export interface JetSm {
  characterId: number
  caracKey: string
  /** Le dé brut, avant modificateur. */
  die: number
  /** Dé plus modificateur, bonus et malus. */
  total: number
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
  /**
   * La carac du jet. Fournie avec `characterId`, le serveur refait le compte
   * lui-même — modificateur, bonus et malus — et use ceux qui se comptent en
   * jets ; `target` est alors ignoré.
   */
  caracKey?: string
  /** Le détail lu au journal, quand le compte en dit plus que « d20=14 +3 ». */
  detail?: string
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
  /**
   * Le nom que le MJ lui a donné. Celui d'une porte commence toujours par
   * « Porte » (`nomDePorte`) ; null : elle s'appelle comme sa nature.
   */
  nom: string | null
}

/**
 * Le nom d'une porte, tel qu'on l'enregistre : toujours « Porte … ». On
 * retire le « Porte » qu'on aurait tapé soi-même, pour ne pas l'avoir deux
 * fois ; rien derrière, et la porte n'a plus de nom.
 */
export function nomDePorte(saisi: string | null | undefined): string | null {
  const reste = (saisi ?? '').trim().replace(/^porte(\s+|$)/i, '').trim()
  return reste ? `Porte ${reste}` : null
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
 * Le carré taillé dans un portrait : c'est lui que montrent le pion, la face
 * de l'encart, le téléphone. En fractions de l'image — `x`, `y` le coin haut
 * gauche, `w` et `h` les côtés —, si bien qu'un écran n'a pas besoin de
 * connaître les proportions du fichier pour le dessiner : `w` et `h` les
 * portent déjà. Un portrait sans carré se montre au centre, comme avant.
 */
export interface CadreCarre {
  x: number
  y: number
  w: number
  h: number
}

/** Le carré relu depuis sa colonne ; un texte abîmé redevient « au centre ». */
export function lisCadreCarre(txt: string | null | undefined): CadreCarre | null {
  if (!txt) return null
  try {
    const c = JSON.parse(txt)
    const ok = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
    if (!ok(c?.x) || !ok(c?.y) || !ok(c?.w) || !ok(c?.h) || c.w <= 0 || c.h <= 0) return null
    return { x: c.x, y: c.y, w: Math.min(1, c.w), h: Math.min(1, c.h) }
  } catch {
    return null
  }
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

/** La préparation des personnages, telle que le poste du MJ la suit. */
export interface PreparationEtat {
  ouverte: boolean
  /** La répartition de tous est-elle à l'écran de la table ? */
  ecran: boolean
  /** Ouverte à cet instant (ISO), ou null. */
  depuis: string | null
  persos: {
    id: number
    nom: string
    color: string | null
    stats: Record<string, number>
    skills: string[]
    reste: number
    valide: boolean
    /** Le joueur a-t-il déjà posé quelque chose ? */
    ouvert: boolean
  }[]
}

export type SlidePayload = (
  | { type: 'black' }
  | {
      type: 'image'
      itemId: number
      url: string
      title: string
      caption?: string
      frame?: Frame
      /**
       * Montrée sous une autre apparence : `url` est alors celle de l'image de
       * l'apparence, et `itemId` reste la carte — les pions s'y posent toujours.
       */
      apparence?: number
    }
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
  | {
      /** Un joueur présenté à la table : son portrait, son nom, ses émojis. */
      type: 'presentation'
      characterId: number
      name: string
      occupation?: string
      player?: string
      url: string | null
      /** Nom du jeton de couleur du personnage — il borde le portrait. */
      color: string | null
      emojis: string[]
    }
  | {
      /** La préparation des personnages, en direct : qui met ses points où. */
      type: 'preparation'
      /** Le départ et le plafond de la règle : les barres vont de l'un à l'autre. */
      bornes: [number, number]
      caracs: { key: string; code: string; nom: string }[]
      persos: {
        id: number
        nom: string
        /** Le prénom de celui qui le joue. */
        joueur: string | null
        /** La couleur du personnage, en hexadécimal. */
        couleur: string
        stats: Record<string, number>
        reste: number
        valide: boolean
      }[]
    }
  | {
      /** L'écran d'avant la partie : « ça commence bientôt ». */
      type: 'attente'
      titre: string
      sousTitre?: string
      emojis: string[]
      /** Lancé à cet instant (ms) ; sert à la jauge du compte à rebours. */
      debut: number
      /** L'heure dite (ms) ; null : pas de compte à rebours. */
      fin: number | null
      /** Les trois lueurs du fond, en hexadécimal ; absentes, celles d'usine. */
      lueurs?: [string, string, string]
      /**
       * L'ambiance de la sonothèque lancée avec l'attente. Elle s'éteint en
       * fondu quand l'attente quitte l'écran — si c'est encore elle qui joue.
       */
      musique?: number | null
      /** Ceux qu'on attend autour de la table. */
      joueurs: {
        id: number
        name: string
        player?: string
        url: string | null
        cadre: CadreCarre | null
        color: string | null
        /** Le maître du jeu : au centre de la rangée, marqué comme tel. */
        mj?: boolean
      }[]
    }
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
  /** Le pion d'un PNJ à fiche : il est sur la table, mais n'a pas de regard. */
  pnj: boolean
  itemId: number | null
  label: string
  /** Portrait ou image du pion, déjà servie en jdr://. */
  url: string | null
  /** Le carré taillé dans le portrait ; jamais pour l'image d'un objet. */
  cadre: CadreCarre | null
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
  /**
   * Montré sans son nom : les joueurs voient le jeton, pas qui c'est. Le nom
   * reste au MJ — `listPionsVus` l'efface avant qu'il ne parte.
   */
  anonyme: boolean
  /**
   * L'état d'un PNJ qui le montre (`Character.etatVisible`), lu sur ses PV.
   * Un joueur n'en porte pas ici : le sien se lit dans `joueurs`.
   */
  etat?: EtatPion | null
  /**
   * Montré aux joueurs seulement quand l'un d'eux le voit : dans le champ de
   * vision d'un joueur, il paraît ; hors de vue, il n'est pas dessiné chez eux.
   */
  regard: boolean
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
  cadre: CadreCarre | null
  initials: string
}

/** Ce qu'un lieu porte : tous ses pions, et parmi eux les joueurs. */
export interface PionsDuLieu {
  count: number
  /** Tous les pions qui ont une fiche — PNJ compris, comme avant. */
  joueurs: PionJoueur[]
  /**
   * Les PNJ posés là : ceux qui ont une fiche, et les pions nommés qui n'en
   * ont pas (`characterId` nul). Un pion d'objet sans nom n'y figure pas.
   */
  pnjs: (Omit<PionJoueur, 'characterId'> & { characterId: number | null })[]
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
  cadre: CadreCarre | null
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

/**
 * Une image posée en fenêtre par-dessus l'écran en direct, sans remplacer ce
 * qu'il montre : un portrait, un indice, une lettre qu'on tend un instant.
 * `x` et `y` placent son centre en fractions de l'écran, `largeur` est un
 * pourcentage de sa largeur ; la hauteur suit, au `ratio` de l'image.
 */
export interface FenetreImage {
  itemId: number
  url: string
  title: string
  x: number
  y: number
  largeur: number
  /** Largeur sur hauteur, pour que la fenêtre garde la forme de l'image. */
  ratio: number
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
  /** Le son de la sonothèque qui joue, s'il vient d'elle ; null : un fichier nu. */
  sonId: number | null
  /** Le fondu enchaîné quand l'ambiance change, en secondes. */
  fondu: number
  /**
   * La pause qui vient s'éteint en ce nombre de secondes ; absent, un fondu
   * court. Il ne vaut que pour la diffusion qui le porte.
   */
  extinction?: number
}

/* ---------- Les sons : sonothèque, sons posés, régie du son ---------- */

/**
 * Trois natures, et chacune sa couleur partout : l'**ambiance** (une seule à
 * la fois, la suivante la remplace en fondu), la **nappe** (une boucle qu'on
 * superpose — pluie, vent, feu) et le **bruitage** (un coup, puis silence).
 */
export type NatureSon = 'ambiance' | 'nappe' | 'bruitage'

export const NATURES_SON: Record<NatureSon, { label: string; pluriel: string }> = {
  ambiance: { label: 'ambiance', pluriel: 'Ambiances' },
  nappe: { label: 'nappe', pluriel: 'Nappes' },
  bruitage: { label: 'bruitage', pluriel: 'Bruitages' }
}

/**
 * Ce qu'un son fait sentir aux téléphones. Le motif est celui de
 * `navigator.vibrate` : vibrer, se taire, vibrer… en millisecondes. Android
 * le suit ; Safari, sur iPhone, ne vibre pour aucune page web.
 */
export type MotifVibration = 'coup' | 'grondement' | 'coeur' | 'frisson'

export const MOTIFS_VIBRATION: Record<MotifVibration, { label: string; motif: number[] }> = {
  coup: { label: 'Un coup', motif: [220] },
  grondement: { label: 'Grondement', motif: [90, 40, 90, 40, 90, 40, 260] },
  coeur: { label: 'Battement de cœur', motif: [90, 120, 140, 600, 90, 120, 140] },
  frisson: { label: 'Frisson', motif: [30, 50, 30, 50, 30, 50, 30, 50, 30] }
}

export interface FichierSon {
  itemId: number
  titre: string
  /** Durée en secondes, mesurée par l'examen des médias ; null s'il ne l'a pas encore vue. */
  duree: number | null
  url: string | null
}

/** Un son de la sonothèque : un nom, une nature, et un ou plusieurs fichiers. */
export interface Son {
  id: number
  /** Le nom affiché : celui qu'on lui a donné, sinon celui de son premier fichier. */
  nom: string
  /** Pas de nom à lui : il suit son fichier, renommages compris. */
  nomSuitFichier: boolean
  emoji: string | null
  nature: NatureSon
  /** De 0 à 1. */
  volume: number
  /** En secondes ; sans effet sur un bruitage. */
  fonduEntree: number
  fonduSortie: number
  /** La touche du Paravent, de « 1 » à « 9 » ; null : aucune. */
  touche: string | null
  /** Le rayon de la sonothèque ; vide : rangé nulle part. */
  planche: string
  vibration: MotifVibration | null
  ord: number
  /** Plusieurs : on en tire un au hasard à chaque fois. */
  fichiers: FichierSon[]
}

/** Quand un son posé sur le plan se déclenche. */
export type QuandZone = 'une' | 'chaque' | 'proche'
/** Quels pions le déclenchent. */
export type ParZone = 'joueurs' | 'pnj' | 'tous'
/** Quels téléphones vibrent quand il part. */
export type VibrerZone = 'aucun' | 'lui' | 'tous'

/**
 * Un son posé sur un plan : un cercle, et ce qui s'y passe quand un pion y
 * entre. Il vit sur le lieu qui porte la carte, comme les murs et les lampes.
 * Les murs l'arrêtent : un pion derrière une cloison n'entend rien.
 */
export interface ZoneSon {
  id: number
  placeId: number
  sonId: number | null
  nom: string
  /** En fractions de la carte. */
  x: number
  y: number
  /** En part de la largeur de la carte, comme le rayon d'une lampe. */
  rayon: number
  quand: QuandZone
  par: ParZone
  /** Le temps mort entre deux déclenchements « à chaque entrée », en secondes. */
  tempsMort: number
  /** Attendre le feu vert du MJ au Paravent plutôt que jouer tout seul. */
  confirmer: boolean
  vibrer: VibrerZone
}

/** Où en est un son posé, le temps d'une partie. */
export type EtatZone = 'arme' | 'fait' | 'attente' | 'ecoute'

/** Un son qui part : le moteur du poste du MJ le joue, le Paravent l'écrit. */
export interface SonJoue {
  /** Croissant : deux coups du même son restent deux coups. */
  n: number
  sonId: number
  nom: string
  emoji: string | null
  nature: NatureSon
  url: string | null
  volume: number
  /** Le pion qui l'a déclenché ; null : le MJ. */
  qui: string | null
  zoneId: number | null
}

/**
 * La régie du son, telle que le processus principal la tient. L'ambiance
 * reste dans `DisplayState.audio`, où elle était ; ici, tout le reste.
 */
export interface SonsMj {
  /** Le volume général, de 0 à 1 : il pèse sur tout, ambiance comprise. */
  general: number
  /** Coupé : les sons posés s'allument au Paravent, mais ne partent pas seuls. */
  auto: boolean
  /** Les nappes lancées à la main. */
  nappes: { sonId: number; url: string | null; volume: number; on: boolean }[]
  /** Les sons posés « tant qu'on est proche » du lieu en scène, et leur gain du moment. */
  sources: { zoneId: number; sonId: number; url: string | null; volume: number; gain: number }[]
  /** L'état des sons posés sur le lieu en scène. */
  zones: Record<number, EtatZone>
  /** Ceux qui attendent le feu vert, avec qui les a réveillés. */
  attente: { zoneId: number; qui: string | null }[]
  /** Les derniers sons partis, du plus récent au plus ancien. */
  journal: SonJoue[]
}

/* ---------- Les tours : à qui de jouer ---------- */

/**
 * Quelqu'un qui prend part aux tours : un personnage (joueur ou PNJ à fiche)
 * ou un pion nommé, sans fiche. On le reconnaît à `cle` — `c12` pour le
 * personnage 12, `p7` pour le pion 7 —, qui ne change pas quand on retrie.
 */
export interface EntrantTour {
  cle: string
  characterId: number | null
  /** Le pion nommé, pour qui n'a pas de fiche. */
  pionId: number | null
  kind: CharacterKind
  nom: string
  /** Nom d'un jeton de couleur, la même liste que les pions. */
  color: string
  /** Portrait, déjà servi en jdr:// ; null, on montre ses initiales. */
  url: string | null
  cadre: CadreCarre | null
  initials: string
  /** Le dé lancé à la table — `null` tant qu'on ne l'a pas noté. */
  de: number | null
  /** Ce qu'on y ajoute : la carac de la fiche, ou un nombre écrit à la main. */
  carac: number
  /**
   * Montré aux joueurs. Un PJ l'est toujours ; un PNJ caché joue quand même,
   * mais l'écran et les portables disent « quelqu'un d'autre ».
   */
  montre: boolean
}

/** L'initiative : le dé plus la carac. Un dé pas encore noté compte pour zéro. */
export const totalTour = (e: EntrantTour): number => (e.de ?? 0) + e.carac

/**
 * Les tours vus du MJ — tout le monde, cachés compris. Cet objet ne part
 * **jamais** vers les joueurs : ils reçoivent `TourVu`, taillé dedans.
 */
export interface ToursMj {
  /** On note l'initiative, ou on joue. */
  phase: 'prep' | 'combat'
  /** Le combat a-t-il déjà commencé ? Revoir l'initiative ne le recommence pas. */
  demarre: boolean
  round: number
  /** L'indice, dans `entrants`, de celui qui joue. */
  actif: number
  entrants: EntrantTour[]
  /** La carac du gabarit qui s'ajoute au dé — DEX par défaut. */
  caracKey: string | null
}

/** Un participant tel que les joueurs le voient. */
export interface EntrantVu {
  nom: string
  color: string
  url: string | null
  cadre: CadreCarre | null
  initials: string
  characterId: number | null
  /** Il a déjà joué ce round. */
  fait: boolean
}

/**
 * Les tours tels que l'écran des joueurs et les portables les montrent : les
 * seuls participants montrés, et rien qui trahisse les autres.
 */
export interface TourVu {
  round: number
  ordre: EntrantVu[]
  /**
   * Celui qui joue, dans `ordre` — ou, quand c'est un caché, celui qui jouera
   * juste après lui.
   */
  curseur: number
  /** Celui qui joue est caché aux joueurs : « quelqu'un d'autre ». */
  actifCache: boolean
  /** Le pion qui porte le halo, s'il est sur le lieu à l'écran. */
  pionEnJeuId: number | null
}

export interface DisplayState {
  /**
   * À qui le tour, tel que les joueurs le voient — `null` hors combat. Les
   * participants cachés n'y entrent pas : la vue du MJ voyage à part.
   */
  tour: TourVu | null
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
  /**
   * Ce que la table voit d'une carte qui a des murs : « regards », seulement
   * ce que leurs personnages ont sous les yeux (l'ombre) ; « jour », la carte
   * entière, sans ombre. Les murs retiennent toujours le pas.
   */
  vision: 'regards' | 'jour'
  /** Et ses points de vie, juste en dessous ? */
  pionPv: boolean
  /**
   * L'encart des joueurs : les portraits, les noms et les points de vie,
   * ancrés d'un côté de l'image et qui y restent tant qu'on les garde.
   */
  encart: Encart
  /**
   * Les images en fenêtre par-dessus le direct, de la plus ancienne à la plus
   * récente — la dernière est au premier plan. Une image n'a qu'une fenêtre.
   */
  fenetres: FenetreImage[]
  /** Les personnages joueurs, tels que l'écran les montre. */
  joueurs: JoueurVu[]
  audio: AudioState
  outputDisplayId: number | null
  playerOpen: boolean
  /** Lieu où se tient la scène : c'est lui qui porte les pions. */
  placeId: number | null
  /**
   * La carte de ce lieu, l'élément de bibliothèque. Les pions et l'ombre ne se
   * posent que sur elle (`montreLaCarte`) : basculer sur une autre image laisse
   * le lieu en scène sans dessiner ses jetons sur un portrait.
   */
  carteDuLieu: number | null
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
  /**
   * Les copies réduites d'une grande image, en WebP — voir `PLAFONDS_COPIES`.
   * Absentes pour ce qui n'est pas une image : on n'y touche pas. Une sorte
   * nulle veut dire que l'image tient déjà sous son plafond.
   */
  copies?: Record<SorteCopie, Uint8Array | null>
  erreur: string | null
}

/**
 * Les copies réduites d'une image trop grande pour être montrée telle quelle.
 *
 * Un plan peut faire 27 000 pixels de côté : décodé, il pèse deux gigaoctets,
 * dépasse la plus grande texture qu'une carte graphique accepte, et fige
 * l'application à chaque fois qu'on le montre. Un téléphone, lui, ne l'affiche
 * pas du tout. L'examen grave donc, à côté de la vignette, une copie pour les
 * écrans de l'application et une pour les portables ; l'original reste
 * intact sur le disque.
 *
 * Tout ce qu'on pose sur une image (murs, pièces, pions, repères) est en
 * fractions de sa taille : une copie aux mêmes proportions ne décale rien.
 */
export type SorteCopie = 'ecran' | 'portable'

/** Le plus grand côté de chaque copie, en pixels. Une image plus petite n'en a pas. */
export const PLAFONDS_COPIES: Record<SorteCopie, number> = {
  /* Net même zoomé sur un écran 4K, et bien sous la texture maximale (16 384). */
  ecran: 8192,
  /* Lisible au doigt pour un document, et décodable par un iPhone. */
  portable: 3072
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

/**
 * Un mot secret : ce que le MJ glisse à un seul joueur, sur son téléphone.
 * Gardé tant que `envoyeA` est nul — il attend son moment.
 */
export interface MotSecret {
  id: number
  /** Les exemplaires d'un même mot, écrit pour plusieurs joueurs, partagent leur lot. */
  lot: string
  beatId: number | null
  playerId: number
  /** Le nom de la personne, et celui de son personnage : le MJ pense aux deux. */
  playerName: string
  characterName: string | null
  playerColor: string | null
  texte: string
  createdAt: string
  envoyeA: string | null
  /** Le premier regard du joueur ; nul tant qu'il ne l'a pas ouvert. */
  luA: string | null
  /** Faire vibrer le téléphone à l'arrivée, ou le laisser arriver en silence. */
  vibre: boolean
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
