/**
 * Le tarot : les 22 arcanes majeurs, dans l'ordre du tarot de Marseille, et
 * pour chacun le texte que la carte « dit ». Les images (jeu
 * « Daguerréotypes ») sont dans assets/chasse/tarot-hante/.
 *
 * Les textes sont écrits pour la table : courts, à lire à voix haute, teintés
 * d'enquête paranormale. Ce sont des interprétations propres à l'Écran.
 */

export interface Arcane {
  /** Le nom du fichier, sans « .jpg » : « 00-le-bateleur ». */
  fichier: string
  /** Le numéro tel qu'il est gravé sur la carte ; le Mat n'en a pas. */
  numero: string
  nom: string
  /** Ce que la carte dit, à lire à la table. */
  texte: string
}

export const ARCANES: Arcane[] = [
  {
    fichier: '00-le-bateleur',
    numero: 'I',
    nom: 'Le Bateleur',
    texte: 'Un commencement. Tout ce qu’il faut est déjà sur la table : il reste à oser s’en servir.'
  },
  {
    fichier: '01-la-papesse',
    numero: 'II',
    nom: 'La Papesse',
    texte: 'Un savoir caché attend d’être lu. La réponse est écrite quelque part, dans un livre ou dans une mémoire.'
  },
  {
    fichier: '02-l-imperatrice',
    numero: 'III',
    nom: 'L’Impératrice',
    texte: 'Une présence protectrice veille sur ce lieu. Elle a aimé quelqu’un ici, et elle l’aime encore.'
  },
  {
    fichier: '03-l-empereur',
    numero: 'IIII',
    nom: 'L’Empereur',
    texte: 'Une autorité, un maître des lieux. Ses règles valent encore, même s’il n’est plus là pour les dire.'
  },
  {
    fichier: '04-le-pape',
    numero: 'V',
    nom: 'Le Pape',
    texte: 'Un rite, une parole transmise. Quelqu’un connaît la formule qui apaise : il faut aller la lui demander.'
  },
  {
    fichier: '05-l-amoureux',
    numero: 'VI',
    nom: 'L’Amoureux',
    texte: 'Un choix entre deux chemins. Celui que vous prendrez décidera de qui vous rencontrerez au bout.'
  },
  {
    fichier: '06-le-chariot',
    numero: 'VII',
    nom: 'Le Chariot',
    texte: 'Avancer, sans se retourner. Vous tenez les rênes, mais il faudra aller vite.'
  },
  {
    fichier: '07-la-justice',
    numero: 'VIII',
    nom: 'La Justice',
    texte: 'Ce qui est dû sera rendu. L’esprit attend réparation, pas vengeance.'
  },
  {
    fichier: '08-l-hermite',
    numero: 'VIIII',
    nom: 'L’Hermite',
    texte: 'Cherchez seul, lentement, une lanterne à la main. La vérité est dans un coin où personne ne va.'
  },
  {
    fichier: '09-la-roue-de-fortune',
    numero: 'X',
    nom: 'La Roue de Fortune',
    texte: 'Les choses tournent. Ce qui a eu lieu ici va se reproduire, et vous êtes au bon moment pour le voir.'
  },
  {
    fichier: '10-la-force',
    numero: 'XI',
    nom: 'La Force',
    texte: 'Le courage tranquille. Ce qui gronde ici se calme si on lui parle avec douceur plutôt qu’avec crainte.'
  },
  {
    fichier: '11-le-pendu',
    numero: 'XII',
    nom: 'Le Pendu',
    texte: 'Regarder autrement. La réponse apparaît quand on accepte de voir les choses à l’envers.'
  },
  {
    fichier: '12-l-arcane-sans-nom',
    numero: 'XIII',
    nom: 'L’Arcane sans nom',
    texte: 'Une fin nécessaire. Quelque chose doit mourir pour que le reste puisse enfin passer.'
  },
  {
    fichier: '13-temperance',
    numero: 'XIIII',
    nom: 'Tempérance',
    texte: 'Un passage entre deux mondes. Un messager est là, et il cherche à vous parler.'
  },
  {
    fichier: '14-le-diable',
    numero: 'XV',
    nom: 'Le Diable',
    texte: 'Un pacte, une tentation. On vous offrira ce que vous désirez, mais le prix ne sera pas dit.'
  },
  {
    fichier: '15-la-maison-dieu',
    numero: 'XVI',
    nom: 'La Maison Dieu',
    texte: 'Un effondrement soudain, une révélation brutale. Ce lieu a connu une catastrophe, et ses murs s’en souviennent.'
  },
  {
    fichier: '16-l-etoile',
    numero: 'XVII',
    nom: 'L’Étoile',
    texte: 'L’espoir. Une âme bienveillante vous guide ; suivez la lumière, même faible.'
  },
  {
    fichier: '17-la-lune',
    numero: 'XVIII',
    nom: 'La Lune',
    texte: 'Les rêves, les illusions, la nuit. Rien de ce que vous percevez ce soir n’est tout à fait sûr.'
  },
  {
    fichier: '18-le-soleil',
    numero: 'XVIIII',
    nom: 'Le Soleil',
    texte: 'La clarté, la joie, un enfant. Ce qui hante ici était heureux autrefois, et le redeviendra.'
  },
  {
    fichier: '19-le-jugement',
    numero: 'XX',
    nom: 'Le Jugement',
    texte: 'Un appel, un réveil. Les morts se lèvent pour qu’on les entende enfin.'
  },
  {
    fichier: '20-le-monde',
    numero: 'XXI',
    nom: 'Le Monde',
    texte: 'L’accomplissement. Une histoire arrive à sa fin, et l’esprit pourra partir en paix.'
  },
  {
    fichier: '21-le-mat',
    numero: '',
    nom: 'Le Mat',
    texte: 'Un saut dans l’inconnu. Vous avancez sans savoir où, et c’est peut-être la seule façon d’y arriver.'
  }
]

export function arcaneParFichier(fichier: string): Arcane | undefined {
  return ARCANES.find((a) => a.fichier === fichier)
}

/** Une carte posée sur le tapis : laquelle, et si elle est retournée. */
export interface CartePosee {
  fichier: string
  retournee: boolean
}

/** Ajoute une carte au bout du tapis, face cachée ; jamais deux fois la même. */
export function poser(tapis: CartePosee[], fichier: string): CartePosee[] {
  if (tapis.some((c) => c.fichier === fichier)) return tapis
  return [...tapis, { fichier, retournee: false }]
}
