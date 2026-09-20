/** Schéma SQLite. Chaque migration est jouée une fois, dans l'ordre, et enregistrée. */

export const MIGRATIONS: { id: number; sql: string }[] = [
  {
    id: 1,
    sql: `
    PRAGMA foreign_keys = ON;

    CREATE TABLE campaign (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      system      TEXT,
      active      INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE chapter (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL REFERENCES campaign(id) ON DELETE CASCADE,
      ord         INTEGER NOT NULL DEFAULT 0,
      title       TEXT NOT NULL,
      notes       TEXT
    );
    CREATE INDEX idx_chapter_campaign ON chapter(campaign_id, ord);

    CREATE TABLE folder (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL REFERENCES campaign(id) ON DELETE CASCADE,
      parent_id   INTEGER REFERENCES folder(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      ord         INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX idx_folder_parent ON folder(campaign_id, parent_id, ord);

    CREATE TABLE place (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id       INTEGER NOT NULL REFERENCES campaign(id) ON DELETE CASCADE,
      name              TEXT NOT NULL,
      summary           TEXT,
      notes             TEXT,
      map_item_id       INTEGER,
      ambience_item_id  INTEGER,
      hidden            INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE item (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL REFERENCES campaign(id) ON DELETE CASCADE,
      folder_id   INTEGER REFERENCES folder(id) ON DELETE SET NULL,
      chapter_id  INTEGER REFERENCES chapter(id) ON DELETE SET NULL,
      place_id    INTEGER REFERENCES place(id) ON DELETE SET NULL,
      kind        TEXT NOT NULL,
      title       TEXT NOT NULL,
      body        TEXT,
      rel_path    TEXT,
      mime        TEXT,
      bytes       INTEGER,
      width       INTEGER,
      height      INTEGER,
      duration    REAL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_item_campaign ON item(campaign_id);
    CREATE INDEX idx_item_folder   ON item(folder_id);
    CREATE INDEX idx_item_chapter  ON item(chapter_id);
    CREATE INDEX idx_item_place    ON item(place_id);

    CREATE TABLE tag (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL REFERENCES campaign(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      color       TEXT,
      UNIQUE(campaign_id, name)
    );

    CREATE TABLE item_tag (
      item_id INTEGER NOT NULL REFERENCES item(id) ON DELETE CASCADE,
      tag_id  INTEGER NOT NULL REFERENCES tag(id)  ON DELETE CASCADE,
      PRIMARY KEY(item_id, tag_id)
    );

    CREATE TABLE folder_tag (
      folder_id INTEGER NOT NULL REFERENCES folder(id) ON DELETE CASCADE,
      tag_id    INTEGER NOT NULL REFERENCES tag(id)    ON DELETE CASCADE,
      PRIMARY KEY(folder_id, tag_id)
    );

    CREATE TABLE place_chapter (
      place_id   INTEGER NOT NULL REFERENCES place(id)    ON DELETE CASCADE,
      chapter_id INTEGER NOT NULL REFERENCES chapter(id)  ON DELETE CASCADE,
      PRIMARY KEY(place_id, chapter_id)
    );

    CREATE TABLE game_session (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL REFERENCES campaign(id) ON DELETE CASCADE,
      label       TEXT NOT NULL,
      date        TEXT NOT NULL DEFAULT (date('now')),
      notes       TEXT,
      active      INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE beat (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id  INTEGER NOT NULL REFERENCES game_session(id) ON DELETE CASCADE,
      ord         INTEGER NOT NULL DEFAULT 0,
      at_time     TEXT,
      title       TEXT NOT NULL,
      note        TEXT,
      done        INTEGER NOT NULL DEFAULT 0,
      chapter_id  INTEGER REFERENCES chapter(id) ON DELETE SET NULL,
      place_id    INTEGER REFERENCES place(id)   ON DELETE SET NULL
    );
    CREATE INDEX idx_beat_session ON beat(session_id, ord);

    CREATE TABLE beat_item (
      beat_id INTEGER NOT NULL REFERENCES beat(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL REFERENCES item(id) ON DELETE CASCADE,
      ord     INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(beat_id, item_id)
    );

    CREATE TABLE sheet_template (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER REFERENCES campaign(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      spec        TEXT NOT NULL,
      builtin     INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE character (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id       INTEGER NOT NULL REFERENCES campaign(id) ON DELETE CASCADE,
      template_id       INTEGER NOT NULL REFERENCES sheet_template(id),
      name              TEXT NOT NULL,
      player            TEXT,
      occupation        TEXT,
      portrait_item_id  INTEGER REFERENCES item(id) ON DELETE SET NULL,
      data              TEXT NOT NULL,
      ord               INTEGER NOT NULL DEFAULT 0,
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE character_log (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id  INTEGER NOT NULL REFERENCES character(id) ON DELETE CASCADE,
      at            TEXT NOT NULL DEFAULT (datetime('now')),
      field         TEXT NOT NULL,
      label         TEXT NOT NULL,
      delta         REAL NOT NULL,
      value         REAL NOT NULL,
      max           REAL NOT NULL,
      reason        TEXT
    );
    CREATE INDEX idx_charlog ON character_log(character_id, id DESC);

    CREATE TABLE roll (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id   INTEGER NOT NULL REFERENCES campaign(id) ON DELETE CASCADE,
      session_id    INTEGER REFERENCES game_session(id) ON DELETE SET NULL,
      character_id  INTEGER REFERENCES character(id) ON DELETE SET NULL,
      at            TEXT NOT NULL DEFAULT (datetime('now')),
      label         TEXT NOT NULL,
      formula       TEXT NOT NULL,
      target        INTEGER,
      result        INTEGER NOT NULL,
      detail        TEXT,
      level         TEXT NOT NULL
    );
    CREATE INDEX idx_roll_campaign ON roll(campaign_id, id DESC);

    CREATE TABLE setting (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
    `
  },
  {
    id: 2,
    sql: `
    /* La campagne pointe vers un dossier réel : c'est lui qui fait foi.
       L'arborescence et les éléments n'en sont plus que le reflet, rangés
       par chemin relatif. L'application n'ajoute que le décor — icône et
       couleur de dossier — qu'elle garde pour elle. */
    ALTER TABLE campaign ADD COLUMN root_path TEXT;

    ALTER TABLE folder ADD COLUMN rel_path TEXT NOT NULL DEFAULT '';
    ALTER TABLE folder ADD COLUMN icon  TEXT;
    ALTER TABLE folder ADD COLUMN color TEXT;

    /* Les dossiers de l'ancienne version n'existaient que dans la base : sans
       équivalent sur le disque, ils n'ont plus de sens. L'arborescence est
       reconstruite au premier examen du dossier de campagne. */
    DELETE FROM folder;
    CREATE UNIQUE INDEX idx_folder_path ON folder(campaign_id, rel_path);
    CREATE UNIQUE INDEX idx_item_path   ON item(campaign_id, rel_path);

    /* Les étiquettes sont retirées : le dossier, le chapitre et le lieu
       suffisent à dire où va une chose. */
    DROP TABLE item_tag;
    DROP TABLE folder_tag;
    DROP TABLE tag;
    `
  },
  {
    id: 3,
    sql: `
    /* Les pions posés sur l'écran des joueurs appartiennent au lieu, pas à
       l'image : on change de carte, ils restent où ils étaient et reviennent
       quand on revient au lieu. Leur taille se règle lieu par lieu — une
       chambre n'a pas l'échelle d'un plan d'ensemble. */
    ALTER TABLE place ADD COLUMN pion_size REAL NOT NULL DEFAULT 6;

    CREATE TABLE pion (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      place_id      INTEGER NOT NULL REFERENCES place(id)      ON DELETE CASCADE,
      character_id  INTEGER          REFERENCES character(id)  ON DELETE CASCADE,
      item_id       INTEGER          REFERENCES item(id)       ON DELETE CASCADE,
      label         TEXT,
      x             REAL NOT NULL,
      y             REAL NOT NULL,
      ord           INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX idx_pion_place ON pion(place_id, ord);
    `
  },
  {
    id: 4,
    sql: `
    /* Documents annexes : les textes qu'on garde sous la main pendant toute la
       séance — règles maison, fiches de PNJ, tables de jets. Ils n'appartiennent
       à aucun moment en particulier ; on les consulte quand la table le demande.
       Le document reste un fichier de la campagne : on n'enregistre ici que le
       fait de l'avoir mis sous la main, et son rang dans la liste. */
    CREATE TABLE annexe (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL REFERENCES campaign(id) ON DELETE CASCADE,
      item_id     INTEGER NOT NULL REFERENCES item(id)     ON DELETE CASCADE,
      ord         INTEGER NOT NULL DEFAULT 0
    );
    CREATE UNIQUE INDEX idx_annexe_item ON annexe(campaign_id, item_id);
    CREATE INDEX idx_annexe_ord ON annexe(campaign_id, ord);
    `
  },
  {
    id: 5,
    sql: `
    /* La fiche de compétences du joueur, en PDF. Le personnage n'en porte que
       le renvoi : le PDF reste un fichier de la campagne, ouvrable hors de
       l'application, et suit son fichier comme le portrait. Un par personnage —
       c'est la feuille que le joueur a remplie, pas les règles du jeu. */
    ALTER TABLE character ADD COLUMN sheet_item_id INTEGER REFERENCES item(id) ON DELETE SET NULL;
    `
  },
  {
    id: 6,
    sql: `
    /* Le cadrage de l'aperçu de la fiche de compétences : zoom et décalages, en
       JSON, comme en Régie. Il appartient au personnage et non au fichier — deux
       joueurs qui rempliraient la même feuille ne regardent pas le même endroit.
       NULL veut dire « telle qu'elle entre d'elle-même ». */
    ALTER TABLE character ADD COLUMN sheet_frame TEXT;
    `
  },
  {
    id: 7,
    sql: `
    /* Les lieux se rangent les uns dans les autres, sur trois étages fixes :
       un espace (le manoir), ses niveaux (les étages), leurs lieux (les pièces).
       Les trois restent des lignes de 'place' : un étage a donc sa carte, son
       ambiance, ses documents et ses pions comme n'importe quel lieu — c'est
       seulement sa place dans l'arbre qui change.

       'parent_id' se vide plutôt que d'emporter ses enfants : la suppression
       d'un contenant est décidée dans l'interface, qui sait ce qu'elle détruit. */
    ALTER TABLE place ADD COLUMN tier TEXT NOT NULL DEFAULT 'lieu';
    ALTER TABLE place ADD COLUMN parent_id INTEGER REFERENCES place(id) ON DELETE SET NULL;
    ALTER TABLE place ADD COLUMN ord INTEGER NOT NULL DEFAULT 0;

    CREATE INDEX idx_place_parent ON place(campaign_id, parent_id, ord);
    `
  },
  {
    id: 8,
    sql: `
    /* L'âge est du texte : « 26 », « la quarantaine », « on ne sait pas » — les
       fiches des joueurs disent rarement un nombre nu.

       La couleur est le nom d'un jeton (brass, moss, iris, blood, neutral), pas
       un code hexadécimal : elle doit s'accorder à la palette et sert de bordure
       au pion du personnage. NULL laisse la couleur déduite de l'identifiant,
       comme avant. */
    ALTER TABLE character ADD COLUMN age   TEXT;
    ALTER TABLE character ADD COLUMN color TEXT;
    `
  },
  {
    id: 9,
    sql: `
    /* Une couleur par joueur, et une seule : c'est a elle qu'on se reconnait
       autour de la table. Les personnages deja crees n'en avaient pas — on la
       leur donne ici, dans l'ordre de la liste, sans deux fois la meme. */
    UPDATE character SET color = (
      SELECT CASE (
        /* Le rang se compte sur la position, jamais sur 'color' : une
           sous-requete qui lit la colonne qu'on est en train d'ecrire donne
           un resultat qui depend de l'ordre des lignes, donc des doublons. */
        (SELECT COUNT(*) FROM character c2
          WHERE c2.campaign_id = character.campaign_id
            AND (c2.ord < character.ord OR (c2.ord = character.ord AND c2.id < character.id))
        ) % 10
      )
        WHEN 0 THEN 'brass'
        WHEN 1 THEN 'blood'
        WHEN 2 THEN 'iris'
        WHEN 3 THEN 'moss'
        WHEN 4 THEN 'azur'
        WHEN 5 THEN 'jade'
        WHEN 6 THEN 'olive'
        WHEN 7 THEN 'orange'
        WHEN 8 THEN 'prune'
        WHEN 9 THEN 'neutral'
      END
    )
    WHERE color IS NULL;
    `
  },
  {
    id: 10,
    sql: `
    /* Les annotations d'un lieu : la cle de lecture de sa carte, pour le MJ
       seul. Des reperes numerotes qu'on pose sur le plan — « 3 — le coffre
       sous la latte » — et des textes libres.

       Elles ne rejoignent JAMAIS l'etat de diffusion : la fenetre joueurs ne
       recoit que le canal 'display:state', et rien de cette table n'y entre.
       C'est une garantie de structure, pas un drapeau qu'on pourrait oublier. */
    CREATE TABLE annotation (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      place_id INTEGER NOT NULL REFERENCES place(id) ON DELETE CASCADE,
      kind     TEXT NOT NULL,
      num      INTEGER,
      texte    TEXT NOT NULL DEFAULT '',
      color    TEXT,
      x        REAL NOT NULL,
      y        REAL NOT NULL,
      ord      INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX idx_annotation_place ON annotation(place_id, ord, id);
    `
  },
  {
    id: 11,
    sql: `
    /* Les joueurs de la campagne — les personnes, pas les personnages.

       Une personne vit dans le carnet de l'application (hors projet, voir
       carnet.ts) et s'inscrit ici à la campagne. Le projet garde une copie de
       son nom et de sa couleur : ouvert sur une autre machine, il reste
       lisible même si le carnet local ne connaît personne. C'est 'uid' qui
       permet de le rapprocher du carnet quand celui-ci le connaît.

       'character.player' n'est plus saisi à la main : il devient le reflet du
       nom du joueur lié, tenu à jour par repos/players.ts. Tout ce qui l'affiche
       déjà — la galerie, le PDF, l'écran des joueurs — continue de marcher. */
    CREATE TABLE player (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id  INTEGER NOT NULL REFERENCES campaign(id) ON DELETE CASCADE,
      uid          TEXT NOT NULL,
      name         TEXT NOT NULL,
      color        TEXT,
      character_id INTEGER REFERENCES character(id) ON DELETE SET NULL,
      ord          INTEGER NOT NULL DEFAULT 0,
      joined_at    TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(campaign_id, uid)
    );
    CREATE INDEX idx_player_campaign ON player(campaign_id, ord, id);

    /* Reprise de l'existant : chaque nom déjà tapé dans une fiche devient un
       joueur, qui garde la couleur de son personnage. Deux fiches au même nom
       de joueur, c'est une seule personne — elle tient la première fiche. */
    INSERT INTO player (campaign_id, uid, name, color, character_id)
    SELECT c.campaign_id, lower(hex(randomblob(8))), trim(c.player), c.color, MIN(c.id)
      FROM character c
     WHERE c.player IS NOT NULL AND trim(c.player) <> ''
     GROUP BY c.campaign_id, trim(c.player);

    UPDATE player SET ord = (
      SELECT COUNT(*) FROM player p2
       WHERE p2.campaign_id = player.campaign_id AND p2.id < player.id
    );

    /* Les fiches dont le joueur n'a pas été retenu (doublon de nom) perdent
       l'étiquette : elle mentirait sur le lien réel. */
    UPDATE character SET player = NULL
     WHERE player IS NOT NULL
       AND id NOT IN (SELECT character_id FROM player WHERE character_id IS NOT NULL);
    `
  },
  {
    id: 12,
    sql: `
    /* La corbeille des jets. Une ligne retirée du journal n'est pas effacée :
       elle est datée de sa mise au rebut et sort des listes, des statistiques
       et de l'export. On la rappelle tant qu'elle est dans la corbeille.

       C'est la DATE de mise au rebut qui ordonne la corbeille, jamais
       l'identifiant : « les vingt dernières supprimées » n'a rien à voir avec
       l'ordre où elles ont été écrites — on efface souvent une vieille ligne
       en dernier. */
    ALTER TABLE roll ADD COLUMN trashed_at TEXT;

    CREATE INDEX idx_roll_trash ON roll(session_id, trashed_at DESC, id DESC);
    `
  },
  {
    id: 13,
    sql: `
    /* ------------------------------------------------------------------
       La fiche appartient à la campagne, plus au personnage.

       Jusqu'ici chaque personnage désignait son gabarit, et rien n'empêchait
       deux joueurs de la même table de tenir des fiches qui ne se comparaient
       pas. Une campagne se joue avec UNE fiche, la même pour tous et la même
       d'une séance à l'autre : c'est elle qu'on configure, et les personnages
       n'ont plus à la choisir.

       Chaque campagne reçoit donc sa propre fiche, copiée du gabarit que ses
       personnages utilisaient déjà — le plus répandu chez eux l'emporte, à
       défaut le premier gabarit livré. Les gabarits livrés restent en base :
       ils ne sont plus des choix permanents mais des modèles de départ.
       ------------------------------------------------------------------ */
    ALTER TABLE campaign ADD COLUMN sheet_template_id INTEGER REFERENCES sheet_template(id);

    INSERT INTO sheet_template (campaign_id, name, spec, builtin)
    SELECT c.id, 'Fiche de ' || c.name,
           COALESCE(
             (SELECT t.spec
                FROM character ch JOIN sheet_template t ON t.id = ch.template_id
               WHERE ch.campaign_id = c.id
               GROUP BY t.id
               ORDER BY COUNT(*) DESC, t.id
               LIMIT 1),
             (SELECT spec FROM sheet_template WHERE builtin = 1 ORDER BY id LIMIT 1),
             '{"rollSystem":"d20-plus","gauges":[],"stats":[],"skills":[]}'
           ),
           0
      FROM campaign c;

    UPDATE campaign SET sheet_template_id = (
      SELECT t.id FROM sheet_template t
       WHERE t.campaign_id = campaign.id AND t.name = 'Fiche de ' || campaign.name
       ORDER BY t.id DESC LIMIT 1
    );

    UPDATE character SET template_id = (
      SELECT sheet_template_id FROM campaign WHERE campaign.id = character.campaign_id
    )
    WHERE (SELECT sheet_template_id FROM campaign WHERE campaign.id = character.campaign_id) IS NOT NULL;

    /* ------------------------------------------------------------------
       Les compétences ne sont plus toutes portées par tout le monde : le
       joueur choisit les siennes, et « choisie » se lit à la présence de la
       clé dans ses données. Les fiches d'avant les avaient toutes, la plupart
       à zéro — un zéro ne dit rien, on ne le prend pas pour un choix. Celles
       qui portent une vraie valeur restent, elles.
       ------------------------------------------------------------------ */
    UPDATE character SET data = json_set(
      data, '$.skills',
      COALESCE(
        (SELECT json_group_object(key, value)
           FROM json_each(character.data, '$.skills')
          WHERE value IS NOT NULL AND value <> 0),
        json('{}')
      )
    )
    WHERE json_valid(data) AND json_type(data, '$.skills') = 'object';
    `
  },
  {
    id: 14,
    sql: `
    /* Les téléphones des joueurs.

       Un appareil appartient à une personne de la campagne, pas à un
       personnage : c'est la personne qu'on reconnaît, et son personnage peut
       changer en cours de route. Le jeton est son seul mot de passe — long,
       tiré au hasard, et qui ne quitte jamais le réseau local.

       Retirer la personne de la campagne emporte ses appareils : sans elle,
       un jeton ne désigne plus rien. */
    CREATE TABLE mobile_device (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL REFERENCES player(id) ON DELETE CASCADE,
      token     TEXT NOT NULL UNIQUE,
      label     TEXT NOT NULL DEFAULT 'téléphone',
      paired_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen TEXT
    );
    CREATE INDEX idx_mobile_player ON mobile_device(player_id);
    `
  },
  {
    id: 15,
    sql: `
    /* Le code d'appairage appartient à la campagne, et lui survit.

       Un code qui meurt au redémarrage, c'est un QR à refaire à chaque
       ouverture — et surtout des téléphones appairés qui parlent dans le vide
       tant que le MJ n'a pas rouvert un panneau. Le code dort donc en base :
       rouvrir le projet rallume le serveur, avec le même code. */
    ALTER TABLE campaign ADD COLUMN mobile_invite TEXT;
    `
  },
  {
    id: 16,
    sql: `
    /* Un joueur n'est pas à deux endroits à la fois.

       La règle est neuve ; les campagnes déjà jouées peuvent porter le même
       personnage sur plusieurs lieux. On ne garde que son pion le plus
       récent — le dernier posé est le dernier endroit où le MJ l'a voulu —
       et l'index empêche le cas de revenir.

       Les pions d'objets, eux, ne sont pas concernés : une torche peut bien
       brûler dans deux salles. */
    DELETE FROM pion
     WHERE character_id IS NOT NULL
       AND id NOT IN (SELECT MAX(id) FROM pion WHERE character_id IS NOT NULL GROUP BY character_id);

    CREATE UNIQUE INDEX idx_pion_character ON pion(character_id) WHERE character_id IS NOT NULL;
    `
  },
  {
    id: 17,
    sql: `
    /* Le téléphone se souvient de lui-même, même quand il oublie son jeton.

       « Changer de joueur », c'est oublier son jeton et en demander un autre.
       Sans repère qui survive à cet oubli, le serveur voyait un inconnu et
       ouvrait une seconde ligne : au troisième aller-retour, l'appareil se
       heurtait à sa propre limite. La clé d'appareil, elle, dort dans le
       navigateur et ne s'efface pas avec le jeton : on retrouve la ligne et on
       la réattribue au lieu d'en créer une.

       Elle reste nulle pour les appareils appairés avant cette version : ils
       en recevront une au prochain appairage. */
    ALTER TABLE mobile_device ADD COLUMN device_key TEXT;
    CREATE INDEX idx_mobile_key ON mobile_device(device_key);
    `
  },
  {
    id: 18,
    sql: `
    /* Ce qu'on a déjà regardé, et ce qu'on en a gardé.

       Les colonnes width, height et duration existent depuis le premier jour et
       sont restées vides : rien, dans le processus principal, ne sait décoder
       une vidéo. Il y faut un navigateur, et l'application en embarque un —
       voir examen.ts.

       meta_sig retient le poids et la date du fichier au moment de l'examen.
       Elle diffère de ce que porte le disque, on regarde à nouveau ; elle est
       nulle, on n'a jamais regardé. Elle est posée même quand l'examen échoue,
       sinon un fichier que Chromium ne sait pas décoder reviendrait à chaque
       relecture du dossier.

       thumb_at dit qu'une vignette a été gravée, et quand : elle sert aussi de
       jeton de fraîcheur dans l'URL, pour que le navigateur cesse de montrer
       l'ancienne image quand le fichier a changé. */
    ALTER TABLE item ADD COLUMN meta_sig TEXT;
    ALTER TABLE item ADD COLUMN thumb_at TEXT;
    `
  },
  {
    id: 19,
    sql: `
    /* Un pion se tourne, se met devant, et parfois ne se montre pas.

       rotation est un angle en degrés. Elle fait tourner l'image **dans** le
       jeton, pas le jeton : le nom sous le pion doit rester lisible, et un
       jeton rond qui tourne ne se voit pas de toute façon. Elle sert aux pions
       d'objet — un canapé, une porte, une voiture — et à l'orientation d'un
       personnage.

       hidden est le rôdeur embusqué : le MJ le pose, le suit, le déplace, et
       les joueurs ne le voient pas. La garantie ne tient pas à ce drapeau mais
       à la forme des données — un pion caché n'entre jamais dans l'état de
       diffusion, donc la fenêtre joueurs ne peut pas l'afficher, même si
       quelqu'un l'oubliait. Voir listPionsVus() dans db/repos/pions.ts.

       Le calque, lui, existait déjà : c'est ord, qui ordonne le dessin. Mettre
       un pion devant, c'est lui donner le plus grand ; derrière, le plus
       petit. Rien à renuméroter. */
    ALTER TABLE pion ADD COLUMN rotation REAL NOT NULL DEFAULT 0;
    ALTER TABLE pion ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0;
    `
  },
  {
    id: 20,
    sql: `
    /* Les personnages que le MJ mène lui-même.

       Jusqu'ici, tout ce que portait cette table était un personnage joueur :
       refreshJoueurs() les prenait tous et les envoyait à l'encart de l'écran
       des joueurs. Un PNJ est le même objet — mêmes jauges, mêmes
       caractéristiques, même journal, même pion — marqué d'un mot.

       Tout ce qui parle « des joueurs » filtre donc désormais sur kind. La
       valeur par défaut est pj : les personnages déjà écrits restent ce
       qu'ils étaient, sans rien à reprendre.

       notes n'existe que pour les PNJ : ce que le MJ sait d'eux, ce qu'ils
       cachent, ce qui les fait céder. Une fiche de joueur n'en a pas — ses
       notes sont sur sa propre feuille. */
    ALTER TABLE character ADD COLUMN kind TEXT NOT NULL DEFAULT 'pj';
    ALTER TABLE character ADD COLUMN notes TEXT;
    CREATE INDEX idx_character_kind ON character(campaign_id, kind, ord);
    `
  },
  {
    id: 21,
    sql: `
    /* La table de butin d'un PNJ : ce qu'on lui prend quand il tombe.

       Une liste de lignes — intitulé, quantité, et une case cochée quand les
       joueurs l'ont ramassé — rangée en JSON dans une colonne, comme le
       cadrage d'un aperçu. Une table à part se défendrait, mais rien ici ne
       se cherche ni ne se recoupe : ce butin ne se lit qu'avec la fiche qui
       le porte, et il part avec elle.

       Comme notes, la colonne n'existe que pour les PNJ et ne sort jamais
       vers les joueurs : ni DisplayState ni l'état d'un téléphone ne
       transportent d'objet qui la porte. */
    ALTER TABLE character ADD COLUMN butin TEXT;
    `
  },
  {
    id: 22,
    sql: `
    /* La pochette : ce que les joueurs ont en main sur leur téléphone.

       Deux tables, et le même principe que les annexes : le document reste un
       fichier de la campagne, on n'enregistre ici que le fait de l'avoir
       donné — à qui, quand, et dans quel rangement.

       player_id dit à qui. NULL veut dire « toute la table » : c'est le cas
       ordinaire, et c'est pour cela qu'il est le défaut. Un joueur nommé reçoit
       le document pour lui seul — la lettre que seul l'archiviste a trouvée.
       ON DELETE CASCADE : une personne retirée de la campagne n'emporte pas
       des lignes que plus personne ne pourrait lire.

       onglet_id range. NULL veut dire « dans la pile », l'état d'une pochette
       où le MJ n'a créé aucun onglet. Créer le premier onglet y verse tout ce
       qui traîne, et retirer un onglet reverse ses documents ailleurs : jamais
       un document ne doit survivre en se cachant derrière un filtre.
       ON DELETE SET NULL le garantit même si quelqu'un efface la ligne à la
       main.

       L'unicité porte sur le trio (document, joueur, campagne) : donner deux
       fois le même plan à toute la table ne fait qu'une entrée, mais le donner
       à toute la table *et* en confier une copie à quelqu'un reste deux gestes
       distincts. SQLite ne compte pas deux NULL comme égaux dans un index
       unique — d'où player_key, qui vaut -1 pour « toute la table ». */

    CREATE TABLE pochette_onglet (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL REFERENCES campaign(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      ord         INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX idx_pochette_onglet ON pochette_onglet(campaign_id, ord);

    CREATE TABLE pochette (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL REFERENCES campaign(id) ON DELETE CASCADE,
      item_id     INTEGER NOT NULL REFERENCES item(id) ON DELETE CASCADE,
      player_id   INTEGER REFERENCES player(id) ON DELETE CASCADE,
      player_key  INTEGER NOT NULL DEFAULT -1,
      onglet_id   INTEGER REFERENCES pochette_onglet(id) ON DELETE SET NULL,
      ord         INTEGER NOT NULL DEFAULT 0,
      given_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX idx_pochette_unique ON pochette(campaign_id, item_id, player_key);
    CREATE INDEX idx_pochette_rang ON pochette(campaign_id, onglet_id, ord);

    /* Qui l'a ouvert. Une ligne par joueur qui a porté les yeux dessus : c'est
       la seule chose que le MJ ne peut pas voir en se penchant sur la table.
       Elle s'efface avec le document et avec la personne. */
    CREATE TABLE pochette_lu (
      pochette_id INTEGER NOT NULL REFERENCES pochette(id) ON DELETE CASCADE,
      player_id   INTEGER NOT NULL REFERENCES player(id) ON DELETE CASCADE,
      read_at     TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (pochette_id, player_id)
    );
    `
  },
  {
    id: 23,
    sql: `
    /* Les murs invisibles d'un lieu : ce qui arrete le pas, et ce qui coupe la
       vue. Le MJ les trace sur la carte, personne ne les voit jamais.

       Un trait est une polyligne — une suite de points en fractions de la
       carte, comme les reperes d'annotation, pour qu'il tienne sur l'image
       quelle que soit la taille a laquelle on la montre. Les points tiennent
       en JSON dans une colonne, comme le butin d'un PNJ : ils ne se cherchent
       ni ne se recoupent, ils ne se lisent qu'avec le trait qui les porte, et
       ils partent avec lui.

       nature dit ce que le trait arrete. mur : le pas et la vue. vitre : le
       pas seulement — la fenetre, la balustrade, le gouffre. voile : la vue
       seulement — le rideau, la tenture, la fumee. porte : tout, tant qu'elle
       est fermee.

       ouverte ne concerne que les portes. Elle vit dans la base plutot que
       dans la partie en cours : on rouvre l'application au milieu d'une
       campagne, les portes sont comme on les avait laissees.

       Comme la table annotation, rien d'ici ne rejoint l'etat de diffusion :
       la fenetre joueurs ne peut donc pas les afficher, meme par erreur. Les
       murs servent a empecher et a calculer, jamais a etre montres. */
    CREATE TABLE mur (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      place_id INTEGER NOT NULL REFERENCES place(id) ON DELETE CASCADE,
      nature   TEXT NOT NULL DEFAULT 'mur',
      ouverte  INTEGER NOT NULL DEFAULT 0,
      pts      TEXT NOT NULL,
      ord      INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX idx_mur_place ON mur(place_id, ord, id);
    `
  },
  {
    id: 24,
    sql: `
    /* Un document entre dans la pochette **caché**.

       C'est la manière de toute l'application : un clic prépare, une bascule
       envoie. On prépare la lettre pendant que les joueurs discutent, on la
       montre au moment où ils la trouvent — et non à la seconde où on met la
       main sur le fichier.

       Le défaut est donc 0, y compris pour les lignes déjà écrites : une
       pochette d'avant cette colonne se retrouve cachée d'un coup. C'est le
       bon sens du doute — mieux vaut avoir à montrer ce qui l'était déjà que
       de révéler sans le vouloir ce qui ne devait pas l'être. */
    ALTER TABLE pochette ADD COLUMN visible INTEGER NOT NULL DEFAULT 0;
    `
  },
  {
    id: 25,
    sql: `
    /* De quelle page d'un PDF on tire sa vignette.

       La première, presque toujours : c'est la page de titre, celle par
       laquelle on reconnaît un document. Mais une fiche d'aide de jeu scannée
       commence parfois par une couverture vide, et un dossier de presse par un
       sommaire — d'où ce choix, fichier par fichier.

       La colonne vaut pour tout élément, et non pour les PDF seulement : rien
       n'interdit qu'un jour une vidéo dise à quelle seconde la saisir, et ce
       serait la même idée. Elle ne sert qu'aux PDF pour l'instant.

       Changer la page n'écrit pas la vignette : cela efface la signature de
       l'examen, et le fichier rentre dans la file du graveur, qui la regrave.
       Voir changerPageVignette(), dans db/repos/library.ts — un accent grave
       dans ce commentaire refermerait le gabarit qui porte ce SQL. */
    ALTER TABLE item ADD COLUMN thumb_page INTEGER NOT NULL DEFAULT 1;
    `
  },
  {
    id: 26,
    sql: `
    /* Une porte verrouillee.

       ouverte dit l'etat de la porte ; verrouillee dit qui a le droit d'en
       changer. Les joueurs poussent les portes ordinaires ; celle-la leur
       resiste tant que le MJ ne l'accorde pas — la cave, la chambre du fond,
       la porte dont la cle est ailleurs dans la maison.

       Les deux colonnes se lisent ensemble et jamais separement : voir
       porteFranchissable(), dans shared/types.ts. Une porte verrouillee
       n'ouvre pas, meme si les deux drapeaux etaient a vrai. */
    ALTER TABLE mur ADD COLUMN verrouillee INTEGER NOT NULL DEFAULT 0;
    `
  },
  {
    id: 27,
    sql: `
    /* Une piece est un morceau du plan de son etage.

       Jusqu'ici, montrer le salon demandait un fichier salon.jpg a cote du
       plan du rez-de-chaussee. Desormais une piece peut n'etre qu'un
       rectangle trace sur le plan de l'etage : elle garde le map_item_id de
       son niveau, et ces quatre colonnes disent quel morceau la regarde.

       Les quatre valent ensemble ou pas du tout : zone_x nul, la carte est
       entiere. Elles sont en fractions de l'image, jamais en pixels — un plan
       rescanne plus grand garde ses pieces.

       Consequence a ne pas perdre de vue : ce qui se pose sur une carte —
       murs, reperes, pions — reste en coordonnees du plan entier. Un mur
       trace dans la cuisine est un mur du rez-de-chaussee, vu de pres. */
    ALTER TABLE place ADD COLUMN zone_x REAL;
    ALTER TABLE place ADD COLUMN zone_y REAL;
    ALTER TABLE place ADD COLUMN zone_w REAL;
    ALTER TABLE place ADD COLUMN zone_h REAL;

    /* « Masque aux joueurs » devient « decouvert par les joueurs ».

       L'ancienne colonne etait une permission : elle empechait la diffusion.
       Mais on diffuse justement un lieu qu'ils n'ont jamais vu — c'est comme
       ca qu'ils le decouvrent. La nouvelle est un etat de partie : ou le
       groupe est passe, ou il n'est pas passe. Elle ne bloque rien.

       Ce qui etait masque devient « pas encore vu », le reste est repute
       connu : une campagne en cours a deja montre ses lieux. */
    ALTER TABLE place ADD COLUMN seen INTEGER NOT NULL DEFAULT 1;
    UPDATE place SET seen = 0 WHERE hidden = 1;
    ALTER TABLE place DROP COLUMN hidden;

    /* L'ordre des freres se remue a la souris : il lui faut des rangs
       distincts. Ils etaient tous a zero, et la liste tombait sur le nom. */
    UPDATE place SET ord = (
      SELECT COUNT(*) FROM place f
       WHERE f.campaign_id = place.campaign_id
         AND f.tier = place.tier
         AND (f.parent_id IS place.parent_id)
         AND (f.name < place.name OR (f.name = place.name AND f.id < place.id))
    );
    `
  },
  {
    id: 28,
    sql: `
    /* Une ouverture se pose sur un mur ; une piece est ce que les murs ferment.

       Avant, une porte et une fenetre etaient des traits a part entiere, poses
       a cote des murs. Deux ennuis : il fallait les aligner a la main, et le
       contour d'une piece se trouvait coupe la ou l'on passe — donc jamais
       ferme. Desormais le mur reste entier et l'ouverture est **dessus** :
       elle prend sa direction, on ne regle que sa largeur et sa place.

       d va de 0 a 1 le long de la polyligne du mur ; largeur est en fraction
       de la carte, comme tout le reste du calque. */
    CREATE TABLE ouverture (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      mur_id      INTEGER NOT NULL REFERENCES mur(id) ON DELETE CASCADE,
      nature      TEXT NOT NULL DEFAULT 'porte',
      d           REAL NOT NULL DEFAULT 0.5,
      largeur     REAL NOT NULL DEFAULT 0.05,
      ouverte     INTEGER NOT NULL DEFAULT 0,
      verrouillee INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX idx_ouverture_mur ON ouverture(mur_id, id);

    /* Une porte deja tracee devient un mur, avec une ouverture dessus.

       Surtout pas un trait supprime : ces traits-la **bouchaient** le plan.
       Les effacer laisserait un trou beant a chaque seuil, et plus aucune
       piece ne se refermerait. Le trait reste donc, il change de nature, et
       l'ouverture se pose dessus sur toute sa longueur — ce qui reproduit
       exactement ce qu'il faisait avant.

       La largeur demandee est le maximum : le depot la ramene a 98 % de la
       longueur du mur qui la porte, sans qu'on ait a la calculer ici. */
    INSERT INTO ouverture (mur_id, nature, d, largeur, ouverte, verrouillee)
    SELECT v.id, v.nature, 0.5, 0.3, v.ouverte, v.verrouillee
      FROM mur v
     WHERE v.nature IN ('porte', 'vitre');

    UPDATE mur SET nature = 'mur' WHERE nature IN ('porte', 'vitre');

    /* « Voile » devient « rideau » : c'est le mot de la table, pas du logiciel. */
    UPDATE mur SET nature = 'rideau' WHERE nature = 'voile';

    /* Une piece n'est plus un rectangle mais un contour, et le lieu retient le
       point par lequel on l'a nommee : tant que ce point reste dans une forme
       fermee, le nom la suit, meme si l'on deplace une cloison. */
    ALTER TABLE place ADD COLUMN zone_pts TEXT;
    ALTER TABLE place ADD COLUMN ancre_x REAL;
    ALTER TABLE place ADD COLUMN ancre_y REAL;

    UPDATE place
       SET zone_pts = '[[' || zone_x || ',' || zone_y || '],['
                           || (zone_x + zone_w) || ',' || zone_y || '],['
                           || (zone_x + zone_w) || ',' || (zone_y + zone_h) || '],['
                           || zone_x || ',' || (zone_y + zone_h) || ']]',
           ancre_x = zone_x + zone_w / 2,
           ancre_y = zone_y + zone_h / 2
     WHERE zone_x IS NOT NULL;

    ALTER TABLE place DROP COLUMN zone_x;
    ALTER TABLE place DROP COLUMN zone_y;
    ALTER TABLE place DROP COLUMN zone_w;
    ALTER TABLE place DROP COLUMN zone_h;
    `
  },
  {
    id: 29,
    sql: `
    /* D'ou part le pion d'essai, sur cette carte.

       Le milieu du plan ne veut rien dire : une visite commence au seuil, a
       la grille du parc, au pied de l'escalier. On pose donc le depart une
       fois, et chaque essai repart de la — y compris apres avoir ferme
       l'application.

       Nul, c'est le milieu : une carte qu'on n'a pas encore reglee s'essaie
       quand meme. */
    ALTER TABLE place ADD COLUMN essai_x REAL;
    ALTER TABLE place ADD COLUMN essai_y REAL;
    `
  },
  {
    id: 30,
    sql: `
    /* Le depart du pion ne se range plus.

       On l'avait mis en base pour le poser une fois et l'oublier. A l'usage,
       c'etait un reglage de plus a comprendre : on veut simplement cliquer
       « Essayer les murs », puis cliquer par ou l'on entre. Le depart se
       choisit donc a chaque visite, et n'a plus rien a retenir. */
    ALTER TABLE place DROP COLUMN essai_x;
    ALTER TABLE place DROP COLUMN essai_y;
    `
  },
  {
    id: 31,
    sql: `
    /* La largeur des ouvertures, par carte.

       Une porte de manoir et une porte de cabane ne font pas la meme part du
       plan : sur une carte donnee, elles font toutes a peu pres la meme. On
       retient donc, pour ce lieu, la largeur qu'on vient de regler — les
       suivantes naissent a cette taille, et l'on cesse de la corriger a chaque
       fois.

       Nul, c'est la largeur d'usine (5 %). */
    ALTER TABLE place ADD COLUMN ouv_largeur REAL;
    `
  },
  {
    id: 32,
    sql: `
    /* La reserve de la campagne : ce qui se trouve, se ramasse, se porte.

       Trois tables, et une seule idee qui les tient : la reserve garde des
       MODELES, pas des exemplaires. On decrit la lanterne une fois, puis on la
       pose autant de fois qu'on veut — dans un lieu, sur un PNJ, dans le sac
       d'un joueur. Corriger sa description corrige toutes celles qui trainent
       dans la campagne.

       objet_famille est le rayon. Huit sont installes avec la campagne ; le MJ
       les renomme, en ajoute, en retire. La teinte vient de la liste des pions
       (classes c-* de slide.css) et le glyphe est dessine dans Icons.tsx : un
       objet sans photo reste reconnaissable de loin. ON DELETE SET NULL : une
       famille retiree ne fait pas disparaitre ses objets, elle les laisse au
       rayon « sans famille ».

       effets tient en JSON dans une colonne, comme le butin d'un PNJ : ces
       lignes ne se cherchent ni ne se recoupent, elles ne se lisent qu'avec
       l'objet qui les porte, et elles partent avec lui.

       valeur est un NOMBRE. L'unite — francs, pieces d'or, credits — appartient
       a la campagne et vit dans setting sous la cle 'objets.unite' : on la
       nomme une fois, chaque objet ne porte qu'un chiffre, et les totaux
       restent calculables.

       su ne sort jamais vers les joueurs : ni DisplayState ni l'etat d'un
       telephone ne transportent d'objet qui le porte. Meme promesse que les
       notes de PNJ, et elle tient a la forme des donnees. */

    CREATE TABLE objet_famille (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL REFERENCES campaign(id) ON DELETE CASCADE,
      nom         TEXT NOT NULL,
      teinte      TEXT NOT NULL DEFAULT 'neutral',
      glyphe      TEXT NOT NULL DEFAULT 'outils',
      ord         INTEGER NOT NULL DEFAULT 0,
      builtin     INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX idx_objet_famille ON objet_famille(campaign_id, ord);

    CREATE TABLE objet (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id  INTEGER NOT NULL REFERENCES campaign(id) ON DELETE CASCADE,
      famille_id   INTEGER REFERENCES objet_famille(id) ON DELETE SET NULL,
      image_item_id INTEGER REFERENCES item(id) ON DELETE SET NULL,
      nom          TEXT NOT NULL,
      unique_piece INTEGER NOT NULL DEFAULT 1,
      qte          INTEGER NOT NULL DEFAULT 1,
      poids        TEXT,
      valeur       REAL,
      vu           TEXT NOT NULL DEFAULT '',
      su           TEXT NOT NULL DEFAULT '',
      equipable    INTEGER NOT NULL DEFAULT 0,
      emplacement  TEXT,
      charge_nom   TEXT,
      charge_max   REAL,
      effets       TEXT,
      ord          INTEGER NOT NULL DEFAULT 0,
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_objet_campagne ON objet(campaign_id, ord, id);
    CREATE INDEX idx_objet_famille_de ON objet(famille_id);

    /* Un exemplaire pose quelque part. Le lieu ou le personnage part, la ligne
       part avec lui : un objet ne doit pas rester range dans une piece qui
       n'existe plus. */
    CREATE TABLE objet_placement (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      objet_id     INTEGER NOT NULL REFERENCES objet(id) ON DELETE CASCADE,
      port         TEXT NOT NULL,
      place_id     INTEGER REFERENCES place(id) ON DELETE CASCADE,
      character_id INTEGER REFERENCES character(id) ON DELETE CASCADE,
      detail       TEXT,
      qte          INTEGER NOT NULL DEFAULT 1,
      etat         TEXT NOT NULL DEFAULT 'cache',
      ord          INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX idx_objet_placement ON objet_placement(objet_id, ord, id);
    CREATE INDEX idx_placement_lieu ON objet_placement(place_id);
    CREATE INDEX idx_placement_perso ON objet_placement(character_id);

    /* Les rayons d'usine, pour les campagnes qui existaient avant la reserve.
       Un projet neuf les recoit de seed.ts, au moment ou naît sa campagne. */
    INSERT INTO objet_famille (campaign_id, nom, teinte, glyphe, ord, builtin)
      SELECT id, 'Armes', 'blood', 'armes', 0, 1 FROM campaign
      UNION ALL SELECT id, 'Protections', 'ardoise', 'protections', 1, 1 FROM campaign
      UNION ALL SELECT id, 'Outils & matériel', 'argile', 'outils', 2, 1 FROM campaign
      UNION ALL SELECT id, 'Soins & remèdes', 'moss', 'soins', 3, 1 FROM campaign
      UNION ALL SELECT id, 'Trésors & monnaie', 'brass', 'tresors', 4, 1 FROM campaign
      UNION ALL SELECT id, 'Indices & papiers', 'azur', 'indices', 5, 1 FROM campaign
      UNION ALL SELECT id, 'Clés & ouvertures', 'olive', 'cles', 6, 1 FROM campaign
      UNION ALL SELECT id, 'Curiosités', 'iris', 'curiosites', 7, 1 FROM campaign;
    `
  },
  {
    id: 33,
    sql: `
    /* Les points de lumiere.

       Le champ de vision disait jusqu'ou porte le regard ; il ne disait pas
       s'il y a de quoi voir. Une lampe pose un rond de clair — arrete par les
       memes murs que la vue — et les joueurs ne decouvrent que ce qui tombe a
       la fois dans leur regard et dans cette lumiere.

       Deux rayons, en part de la largeur de la carte : le clair, puis la
       penombre, qui est le bord exterieur de la lueur. */
    CREATE TABLE lumiere (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      place_id INTEGER NOT NULL REFERENCES place(id) ON DELETE CASCADE,
      x        REAL NOT NULL DEFAULT 0.5,
      y        REAL NOT NULL DEFAULT 0.5,
      clair    REAL NOT NULL DEFAULT 0.09,
      penombre REAL NOT NULL DEFAULT 0.16,
      allumee  INTEGER NOT NULL DEFAULT 1
    );
    CREATE INDEX idx_lumiere_place ON lumiere(place_id, id);
    `
  },
  {
    id: 34,
    sql: `
    /* La couleur d'une lampe.

       Une bougie n'eclaire pas comme une lune, et un brasero encore moins.
       La teinte ne change rien a ce qui est vu — elle se pose sur la zone
       eclairee, pour l'ambiance. Blanc par defaut : une lampe deja posee ne
       change pas d'allure du jour au lendemain. */
    ALTER TABLE lumiere ADD COLUMN teinte TEXT NOT NULL DEFAULT '#ffffff';
    `
  },
  {
    id: 35,
    sql: `
    /* Ce qu'une lampe laisse derriere elle.

       Par defaut, ce qu'on a vu sous cette lampe s'oublie des qu'on ne le voit
       plus : la piece retombe au noir complet, comme si l'on n'y etait jamais
       entre. C'est ce qu'on veut d'une bougie qu'on emporte, d'un eclair, d'un
       couloir qu'on traverse.

       Cochee, la lampe laisse sa zone decouverte : on l'a vue une fois, elle
       reste sur la carte — l'ampoule du hall, le feu de cheminee. */
    ALTER TABLE lumiere ADD COLUMN garde INTEGER NOT NULL DEFAULT 0;
    `
  },
  {
    id: 36,
    sql: `
    /* Ce que la lumiere laisse derriere elle : une regle de la carte.

       On l'avait posee lampe par lampe. A l'usage, ce n'est pas un reglage de
       bougie, c'est une facon de jouer : ou bien la maison se decouvre au fur
       et a mesure et reste decouverte, ou bien elle retombe au noir des qu'on
       tourne le dos. Ca vaut pour toutes les lampes du plan a la fois.

       Decoche par defaut : la piece retombe au noir complet. */
    ALTER TABLE place ADD COLUMN lum_garde INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE lumiere DROP COLUMN garde;
    `
  },
  {
    id: 37,
    sql: `
    /* La carrure du personnage, et l'endroit du corps ou il porte ses objets.

       sexe est la silhouette de sa poupee d'equipement — homme ou femme, deux
       dessins. Nul tant que le MJ n'a rien dit : la poupee prend alors celle
       d'homme, et la fiche propose le reglage. Ce n'est pas une case d'etat
       civil, c'est le corps sur lequel on pose la tete, le torse et les mains.

       objet_placement.emplacement dit OU sur la personne : 'tete', 'main-d'…
       Nul, c'est dans son sac. Equiper et ranger sont donc le meme exemplaire
       a une colonne pres, et un objet qu'on retire d'une case ne disparait
       pas — il retombe dans le sac.

       Les emplacements etaient ecrits en toutes lettres sur l'objet
       (« Main droite ») ; ils deviennent des cles, que la liste partagee
       traduit. On convertit ce qui existe plutot que de le perdre. */
    ALTER TABLE character ADD COLUMN sexe TEXT;
    ALTER TABLE objet_placement ADD COLUMN emplacement TEXT;

    UPDATE objet SET emplacement = 'main-d'   WHERE emplacement = 'Main droite';
    UPDATE objet SET emplacement = 'main-g'   WHERE emplacement = 'Main gauche';
    UPDATE objet SET emplacement = 'torse'    WHERE emplacement = 'Torse';
    UPDATE objet SET emplacement = 'tete'     WHERE emplacement = 'Tête';
    UPDATE objet SET emplacement = 'cou'      WHERE emplacement = 'Cou';
    UPDATE objet SET emplacement = 'ceinture' WHERE emplacement = 'Ceinture';
    `
  },
  {
    id: 38,
    sql: `
    /* Un objet peut aller a plusieurs endroits du corps.

       Une epee va dans l'une ou l'autre main, une bague a l'un ou l'autre
       doigt, un chale sur l'une ou l'autre epaule. Un seul emplacement par
       objet obligeait a decrire deux fois la meme chose.

       La liste tient en JSON dans une colonne, comme les effets : ces cles ne
       se cherchent ni ne se recoupent, elles ne se lisent qu'avec l'objet qui
       les porte, et elles partent avec lui. Ce qui existait devient une liste
       d'un seul element. */
    ALTER TABLE objet ADD COLUMN emplacements TEXT;
    UPDATE objet SET emplacements = '["' || emplacement || '"]' WHERE emplacement IS NOT NULL;
    ALTER TABLE objet DROP COLUMN emplacement;
    `
  },
  {
    id: 39,
    sql: `
    /* Jusqu'ou le regard porte, sur cette carte.

       Le champ de vision s'arretait aux murs, et nulle part ailleurs : dans un
       grand hall, les joueurs voyaient le fond comme en plein jour. On pose
       donc une portee, en part de la largeur du plan — au-dela, c'est trop
       loin pour qu'on distingue quoi que ce soit.

       Nul, c'est sans limite : les cartes deja tracees ne changent pas. */
    ALTER TABLE place ADD COLUMN regard_portee REAL;
    `
  },
  {
    id: 40,
    sql: `
    /* Un rideau se tire et s'ouvre.

       La colonne mur.ouverte existe depuis le premier jour des murs : elle
       disait alors l'etat d'une porte, du temps ou une porte etait un trait.
       Depuis la migration 28 les portes sont des ouvertures posees sur un mur,
       et cette colonne ne voulait plus rien dire — elle restait la, a zero,
       pour les traits qui avaient ete des portes.

       Elle reprend du service avec le meme sens qu'avant : cette chose est-
       elle ouverte ? Elle ne concerne plus que les rideaux. Tire, le rideau
       coupe la vue comme il l'a toujours fait ; ouvert, on voit au travers —
       chez le MJ, sur l'ecran des joueurs et sur les telephones, puisque tous
       lisent la meme regle (murArreteVue, dans shared/types.ts).

       On remet donc tout le monde a zero : un vieux 1 herite d'une porte
       d'avant la 28 ouvrirait un rideau que personne n'a touche. Les rideaux
       de Jules commencent tires, ce qui est l'etat qu'ils avaient hier. */
    UPDATE mur SET ouverte = 0;
    `
  }
]
