# Assistance à la santé mentale (vue SM du Paravent)

## Pourquoi

La santé mentale est le point faible du meneur à la table. En pratique, il retire
des points au jugé, et il ne sait pas quoi appliquer quand un joueur change de
palier. Le système existe pourtant, écrit dans une annexe de la campagne « Chasse
aux fantômes » (`.ecran-du-maitre/Séance 4 - La scierie/Annexes/Santé mentale.html`) :
tailles de choc, jet de Volonté, paliers, folie passagère, hallucinations,
récupération, activité selon la moyenne de l'équipe, barème de Harrow Mill. Il
n'est simplement pas consultable en pleine scène.

Le module fait les deux travaux que le meneur ne fait pas bien aujourd'hui, à
égalité :

1. **Calculer la perte** : on déclare ce qui arrive, l'outil fait le compte et
   retire les points de la fiche.
2. **Appliquer les paliers** : l'outil dit ce qui change pour le joueur, pose ce
   qu'il peut poser seul, et rappelle en continu les effets en cours.

## Décisions de l'utilisateur

1. **Dédié au thème chasse aux fantômes**, mais **entièrement configurable dans
   les Paramètres** : on l'active, on règle les paliers, etc. Éteint par défaut.
2. **L'emplacement** : dans le Paravent (`mj/modules/Pupitre.tsx`), dans la zone
   sous la réserve des pions, celle qu'occupe `DetailPion` (`.pu-detail`). Un
   bouton **« Gérer les SM »** affiche la **vue SM** ; un clic sur un pion
   ramène le détail du pion, comme aujourd'hui.
3. **Le joueur lance son jet de Volonté sur son téléphone, comme d'habitude**
   (option « A »). L'outil **attend** ce jet : rien de nouveau côté téléphone,
   pas de demande poussée. Le meneur annonce le jet à l'oral. Une **saisie à la
   main** sert de secours pour un joueur sans téléphone.
4. **La mise en page** (validée sur maquette, `.superpowers/brainstorm/…/vue-sm-v2.html`) :
   le **barème à gauche**, les **joueurs à droite**. Voir « La vue SM ».
5. **L'automatisation**, validée telle que proposée : malus de palier posés seuls,
   chronos des prix dans la durée, compte à rebours des hallucinations (voir
   « Comportements »).
6. **Les événements nommés sont rangés par séance**. On peut **dupliquer un
   événement vers une autre séance**.

## Objectifs

- En pleine scène, deux clics au plus pour déclarer une perte : cocher qui la
  subit, cliquer sur ce qui arrive.
- La perte, le jet, la moitié arrondie au-dessus, le 20 et le 1 naturels :
  l'outil les fait, le meneur ne calcule rien.
- Un changement de palier ne passe jamais inaperçu, et ses effets sont écrits
  en clair à côté du joueur tant qu'ils durent.
- Tout ce que dit l'annexe est réglable, et pré-rempli avec son contenu à
  l'activation.

## Non-objectifs

- Pas de nouvel écran ni de demande de jet côté téléphone. Le joueur ne voit de
  ce module que ce qui existe déjà : sa jauge, ses malus de jet, les mots
  secrets.
- Pas de module SM pour les PNJ : la vue ne montre que les joueurs (`kind = 'pj'`)
  de la séance.
- Pas de remplacement de l'annexe : elle reste un document que le meneur garde.
- On ne touche pas aux autres systèmes (Cthulhu, D&D). Le module ne s'allume que
  pour la campagne qui l'active.

## Anti-objectifs (échec même si « ça marche »)

- Une hallucination ou une perte qui **part toute seule** vers un joueur sans
  que le meneur l'ait voulue. Le chrono d'un prix dans la durée est la seule
  perte automatique, et c'est le meneur qui le lance.
- Un malus de palier qui **reste** sur la fiche après la remontée du joueur, ou
  qui se **cumule** à chaque perte dans le même palier.
- Une vue SM qui pousse la scène ou la réserve : elle prend la place du détail
  du pion et défile en elle-même, comme lui.
- Une perte mal comptée sans moyen de revenir en arrière. Toute écriture sur la
  fiche passe par les chemins existants (`characters.adjust`, modifs), et
  l'historique et le « défaire » de l'app s'y appliquent.

## La vue SM

Elle est dans `.pu-detail`, à la place de `DetailPion`. Le bouton
« Gérer les SM » est visible dans le Paravent seulement si le module est activé.
L'état « vue SM ouverte » et l'état « pion choisi » s'excluent : choisir un pion
ferme la vue SM, et ouvrir la vue SM désélectionne le pion.

**À gauche, le barème**, en quatre groupes :
- **Choc (jet de Volonté)** : les tailles de choc réglées (Petit −3, Moyen −5,
  Gros −10, Terreur −15).
- **Événements de la séance** : ceux de la séance active, chacun avec sa perte
  et l'indication 🎲 (avec jet) ou non. La liste est repliée au-delà de quelques
  lignes (« 8 autres… »).
- **Prix (sans jet)** : perte fixe, ou prix **dans la durée** (« −2 / min »).
- **Récupérer** : pilule, encens, chapelle, etc.

**À droite, les joueurs**, en lignes compactes :
- une case à cocher, 🎯 sur la cible des entités (la SM la plus basse), le nom,
  la jauge SM, une pastille « valeur · palier » colorée selon le palier ;
- sous la ligne, les effets en cours en clair : « −2 Perception · hallucination
  dans 6 min · cible des entités », ainsi qu'un chrono de prix ou une folie
  passagère en cours ;
- en bas, la **moyenne de l'équipe** et l'**activité** correspondante
  (« Moyenne 54 — un petit phénomène toutes les 15 min »).

**Au-dessus des joueurs**, s'il y a lieu :
- le bandeau **« Jet de Volonté attendu »** : l'événement, puis un jeton par
  joueur (« Tom · 14 → −3 ✓ », « Léa · en attente… »), et « Saisir à la main » ;
- les **alertes** (changement de palier, folie passagère, hallucination due),
  chacune avec ses boutons (« Envoyer une hallucination », « Plus tard »,
  « Calmé »).

**Déclarer** : on coche les joueurs, puis on clique une entrée du barème. Si
personne n'est coché, l'entrée vaut pour **tous les joueurs présents**. Les
cases se décochent après la déclaration.

## Comportements

### Choc (avec jet)

1. Le meneur déclare un choc ou un événement 🎲 de perte P sur des joueurs.
2. Chacun passe « en attente » dans le bandeau.
3. L'outil prend le **prochain jet de la caractéristique de jet** (VLT) de chaque
   joueur attendu, lancé depuis son téléphone (journal des jets), ou saisi à la
   main dans le bandeau.
4. Barème (réglable ; valeurs de l'annexe) :
   - 20 naturel : aucune perte, **+2 SM** ;
   - total ≥ seuil (12) : **moitié de P, arrondie au-dessus** ;
   - total < seuil : **P** ;
   - 1 naturel : **P + 5**.
5. Le résultat est retiré de la jauge SM (bornée à 0), puis on vérifie le palier
   et la folie passagère.

Plusieurs déclarations peuvent attendre en même temps : un joueur attendu deux
fois voit ses jets servir dans l'ordre des déclarations. Un bandeau se ferme
quand tous ses joueurs sont résolus, et on peut l'annuler.

### Prix (sans jet)

- **Fixe** : la perte est retirée tout de suite à chaque joueur concerné.
- **Dans la durée** (« −2 par minute », « −1 toutes les 10 minutes ») : on lance
  un **chrono sur le joueur**, visible sur sa ligne, qui retire les points à
  chaque échéance jusqu'à ce que le meneur l'arrête. Chaque retrait passe par le
  contrôle de palier.

### Paliers

- Chaque palier a des bornes, un nom, une couleur, un texte « ce que tu
  appliques », des **malus de jet** (valeur + caractéristique ou tous les jets),
  un indicateur « avec hallucinations » et sa cadence.
- **Au changement de palier**, à la baisse comme à la hausse : une alerte « Tom
  passe en Hallucinations (48) » avec le texte du palier. Les malus de l'ancien
  palier sont retirés de la fiche et ceux du nouveau posés, en modifs
  « jusqu'au retrait » (`shared/modifs.ts`), avec la raison « SM —
  <palier> ». Ils se reconnaissent comme posés par le module : on ne retire
  jamais un malus posé à la main par le meneur.
- **Cible des entités** : le joueur à la SM la plus basse porte 🎯.

### Folie passagère

Une perte ≥ seuil (10) d'un coup déclenche un **second jet de Volonté attendu**,
comme pour un choc. S'il est raté, l'outil tire **1D6** dans la table de folie,
affiche l'effet sur la ligne du joueur, avec une durée indicative (~5 min) et un
bouton **« Calmé »**.

*(Mes choix)* La perte qui compte est celle **réellement retirée** (après
moitié, +5, etc.), quelle que soit sa source : choc, prix fixe ou un seul
retrait d'un chrono. Le second jet ne fait que décider de la folie, avec le
même seuil. Il ne retire ni ne rend de SM, même sur un 20 ou un 1 naturel.

### Hallucinations

Un joueur dans un palier « avec hallucinations » a un **compte à rebours**
(cadence du palier, 15 min dans l'annexe). À zéro, sa ligne s'allume et
l'alerte propose une hallucination tirée au hasard de la liste. Le meneur
l'**envoie en mot secret** à ce joueur (mécanisme des mots secrets, table `mot`),
en tire une autre ou la **passe**. **Elle ne part jamais seule.**
*(Mon choix)* Un personnage sans joueur lié (`mot` vise un `player_id`) n'a pas
de bouton d'envoi : l'alerte affiche la phrase pour que le meneur la glisse à
voix basse, avec « Fait » et « Passer ». Le compte
repart après l'envoi ou le refus. Le changement de palier propose aussi d'en
envoyer une.

### Récupération

Chaque moyen a son gain (fixe ou dé, comme « 1D10 ») et une limite optionnelle
(« une fois par scène », « une fois dans la nuit »).
- La **pilule** tire 1D10. Si une jauge « pilules » est réglée et existe sur la
  fiche, elle est décrémentée. Une deuxième pilule en moins de 30 min affiche
  l'alerte de nausée avec son malus (−2 à tous les jets, 30 min).
- Un gain passe par le même contrôle de palier, et peut donc retirer des malus.
- « Un ami le rassure » arrête une folie passagère, sans rendre de points.

### Activité de l'équipe

La moyenne SM des joueurs présents est affichée en continu avec la ligne
d'activité du tableau réglé (100-70, 69-50, 49-30, 29-0). C'est un rappel pour
le meneur, sans aucun effet automatique.

## Paramètres — rubrique « Santé mentale »

Une nouvelle rubrique du registre (`mj/components/parametres/registre.tsx`),
**propre à la campagne**. Tout y est enregistré immédiatement, comme dans le
reste des Paramètres.

- **Activer l'assistance à la santé mentale** (éteint par défaut).
- **Jauge SM** : la même valeur que « jauge de santé mentale » dans Règles
  (`sanityGauge` du gabarit). Une seule source, affichée aux deux endroits.
- **Caractéristique du jet** (VLT) et **seuil de réussite** (12).
- **Résultats du jet** : gain sur 20 naturel (+2), part de la perte en cas de
  réussite (moitié, arrondie au-dessus), surcoût sur 1 naturel (+5).
- **Tailles de choc** : liste nom + perte.
- **Paliers** : liste éditable (bornes, nom, couleur, texte, malus, hallucinations
  oui/non et cadence).
- **Folie passagère** : seuil (10), durée indicative, table d'effets (1D6).
- **Hallucinations** : liste de phrases.
- **Prix** (valables pour toute la campagne) : nom, perte, fixe ou dans la durée
  (perte + intervalle).
- **Récupération** : nom, gain (fixe ou dé), limite, et la jauge « pilules »
  optionnelle avec la règle de nausée.
- **Activité de l'équipe** : tranches de moyenne et texte.
- **Événements par séance** : choix de la séance (`game_session`), puis la liste
  de ses événements (nom, qui les subit en note libre, perte, avec jet ou non).
  Chaque événement a l'action **« Dupliquer vers une séance… »**.
- **Rétablir les valeurs de l'annexe**.

**À l'activation**, si rien n'est encore réglé, tout est pré-rempli avec le
contenu de l'annexe (tailles, barème du jet, paliers, folie, hallucinations,
prix, récupération, activité). Le barème de Harrow Mill est rangé sous la séance
active.

## Données

- Les réglages (sauf les événements) se rangent dans une seule valeur JSON de la
  campagne (table `setting`, comme les autres réglages de campagne,
  `shared/reglages.ts`), avec un type partagé dans `shared/`.
- Les événements, rangés par séance, ont leur propre table (`game_session_id`,
  `ord`, nom, note, perte, avec jet), en suivant la migration du projet
  (`main/db/schema.ts`).
- L'état de jeu (jets attendus, chronos, comptes à rebours d'hallucination,
  folies en cours, dernière pilule) vit dans le processus principal le temps de
  la séance, **sans être écrit en base** : fermer l'app le perd, et c'est
  accepté. Les points retirés et les malus posés, eux, sont écrits sur la fiche
  au moment même.

## Laissé au constructeur

- Reconnaître le jet de Volonté dans le journal : aujourd'hui une ligne `roll`
  ne garde que son libellé (« VLT »), pas la clé de la caractéristique. Ajouter
  la clé à la ligne, ou s'appuyer sur le libellé de la carac réglée, est un
  choix d'implémentation.
- Le marquage des modifs posées par le module (champ dédié ou préfixe d'`id`).
- Le découpage en composants, les icônes, les styles (suivre `app.css` et
  `tokens.css` ; la maquette v2 donne le ton).
- Les tests : la logique de calcul (barème du jet, paliers, folie, prix dans la
  durée) va dans `shared/` et se teste avec vitest, comme `shared/jet.ts` et
  `shared/regles.ts`.

## Le total du jet (décision de l'utilisateur)

L'outil retient **le total que l'app calcule déjà et que le téléphone affiche** :
d20 + `modificateur(VLT)` (`shared/jet.ts`, façon D&D), plus les bonus et malus.
On n'utilise **pas** la table de modificateurs de l'annexe (« score 0-2 = −2… »)
et on ne change pas le calcul de l'app. Le jet est donc plus dur que ce que
prévoyait l'annexe ; le seuil reste réglable si le meneur veut compenser.

## Mes choix (à vérifier par l'utilisateur)

- **Les malus du module comptent dans le jet de Volonté** (palier Terreur
  « −2 à tous les jets », nausée) : l'annexe dit « tous les jets ». La spirale
  (moins de SM, moins de réussite) est voulue par le jeu.
- Un jet de VLT saisi par le meneur pour un joueur (saisie existante de l'app)
  compte comme le jet attendu, au même titre que celui du téléphone.
- Les joueurs pris en compte sont les **personnages joueurs présents à la
  séance** (hors absents de `seance_absent`).
- L'état de jeu n'est pas sauvegardé entre deux lancements.
- Les « prix » sont valables pour **toute la campagne**, les « événements »
  sont **par séance**.

## Annexe — valeurs par défaut (reprises de l'annexe « Santé mentale »)

L'annexe vit hors du dépôt, dans la campagne. Voici ce qui sert au pré-remplissage
et à « Rétablir les valeurs de l'annexe ».

**Jet** : carac `vlt`, seuil 12 ; 20 naturel → aucune perte et +2 ; réussite →
moitié arrondie au-dessus ; échec → tout ; 1 naturel → tout +5.

**Tailles de choc** : Petit −3 · Moyen −5 · Gros −10 · Terreur −15.

**Paliers** :

| SM | Nom | Couleur | Malus | Halluc. | Texte |
|---|---|---|---|---|---|
| 100-76 | Stable | moss | — | non | Rien. |
| 75-51 | Ébranlé | brass | −1 DEX | non | Ses mains tremblent. Décris-lui un détail de plus qu'aux autres (un froid, une odeur, un bruit). |
| 50-26 | Hallucinations | iris | −2 PER | oui, 15 min | Passe-lui un mot. Les entités le remarquent. |
| 25-1 | Terreur | blood | −2 tous | oui, 15 min | Des objets bougent autour de lui. Pour rester seul ou entrer dans une pièce sombre : jet de Volonté (12+), sinon il refuse. Cible préférée des entités. |
| 0 | Rupture | blood | −2 tous | oui, 15 min | Hallucinations sans arrêt. N'agit que si un ami reste à côté et lui parle. Ne meurt pas de sa SM. Remonte avec une pilule ou un ami qui le calme. |

**Cible des entités** : la SM la plus basse. Note du palier : « À Harrow Mill,
c'est lui que le Démon appelle dans le talkie. »

**Folie passagère** (seuil 10, jet 12+, ~5 min) : 1 Il se fige, il faut le tirer
par le bras · 2 Il fuit en courant, droit devant, et lâche ce qu'il tient ·
3 Il hurle : les Ombres savent où il est et viennent vers lui · 4 Il rit
nerveusement et ne peut pas parler sérieusement · 5 Il se colle au mur, sa lampe
serrée contre lui, et refuse d'avancer · 6 Il croit qu'un des autres joueurs est
la bête et refuse de lui tourner le dos.

**Hallucinations** :
- On chante ton prénom tout bas, en espagnol.
- Une main froide se pose sur ton épaule. Personne derrière toi.
- Une corde pend de la rampe de l'escalier. Quand tu regardes à nouveau, elle n'y est plus.
- Des pas te suivent. Ils s'arrêtent quand tu t'arrêtes.
- Tu sens de la neige fondre sur ton visage. À l'intérieur.
- Quelqu'un tousse dans le noir, juste derrière toi.
- Ta lampe passe sur un lit : quelqu'un y est assis. Tu reviens dessus, le lit est vide.
- Des voix comptent, très loin : quatorze… contre trois.

**Prix (campagne)** : Séparé du groupe ou sans lumière −1 / 10 min (durée) ·
Seul dans le noir complet −2 / min (durée) · Manque de respect −5 (tous) ·
Colère des sept −10 (tous ; −15 si les deux objets) · Parler au Démon par la
spirit box −5 / 5 min (durée) · Ouija fini sans « au revoir » −10 · Ouija raté
−10 · Pentacle au grenier, rires du Démon −10.
Rappel affiché : « Toute l'équipe dans la même pièce éclairée : aucune perte
due à l'ambiance. »

**Modificateurs de situation** (rappel affiché sous le bandeau du jet) : joueur
isolé −3, lumière ou bougie près de lui +2.

**Récupération** : Pilule +1D10 (jauge `pilules` si présente ; 2 en moins de
30 min → nausée, −2 à tous les jets pendant 30 min) · Encens béni ou prière
réussie +5, une fois par scène · Calme à la chapelle (10 min) +5, une fois dans
la nuit · Un ami le rassure (CHA 12+) : arrête une folie, sans rendre de points ·
Fin heureuse +10 à tous. (« 20 naturel sur n'importe quel jet : +2 » reste
manuel.)

**Activité de l'équipe** : 100-70 Seulement les déclencheurs prévus (coupures,
manques de respect, outils) · 69-50 En plus, un petit phénomène toutes les
15 min (pas au-dessus, lanterne, porte entrouverte, froid) · 49-30 Le générateur
lâche après 30 min au lieu de 40 ; les Ombres restent au bord du faisceau même
éclairées · 29-0 Le Démon parle dans les talkies même sans coupure ; les Ombres
attaquent dès qu'une lampe faiblit.

**Événements — séance active (« Séance 4 - La scierie »)** :
Pas au-dessus, à l'entrée −3 🎲 · Première coupure du générateur −3 🎲 (tous) ·
Ombres au bord du faisceau −5 🎲 · Une Ombre attaque (noir complet) −10 🎲, et
1D6 PV · Première vision dans un miroir −5 🎲 · Vision du médium à l'enclume −10 ·
Griffures, touffe de poil et fil rouge −3 🎲 · Les yeux verts au fond du
couloir −10 🎲 · Silhouette à la caméra thermique −5 🎲 · Photo au flash du
Démon −10 🎲 · Corde refusée qui se dénoue −3 🎲 (tous) · Climax : 8 s de noir,
un ami possédé −15 🎲 (tous sauf le possédé) · Le Démon saute sur un deuxième
joueur −15 · Fin d'une possession −20 · Fin malheureuse −10 (tous).
