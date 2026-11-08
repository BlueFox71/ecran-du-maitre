<!-- version: 1.6.2 -->
### Nouveautés
- **Le nom des pièces sur le plan des joueurs.** Dans « Gestion des pièces » (l'ancien bouton « Portes et lumières » du Paravent), chaque pièce peut montrer son nom aux joueurs : il s'écrit sur l'écran de la table et sur les téléphones, là où tu l'as placé. Caché par défaut, pièce par pièce.
- **Les gains et pertes de santé mentale annoncés à la table.** Quand un joueur gagne ou perd de la santé mentale, l'écran de la table l'affiche comme un dé : qui, combien et pourquoi, jusqu'à ce que tu cliques sur « Vu ». Le goutte-à-goutte d'un chrono ne s'annonce pas, pour ne pas couvrir l'écran.
- **Le jet de Volonté réclamé sur le téléphone.** Quand tu attends le jet de Volonté d'un joueur, son téléphone le lui demande et, sur l'onglet Jet, la bonne caractéristique est déjà choisie.
- **La caméra suit celui qui joue.** Si l'écran suivait déjà un pion, il passe au pion du personnage dont c'est le tour, à condition que ce pion soit sur le lieu et visible des joueurs.

### Améliorations
- **Fini le ralentissement des longues séances.** Au bout de quelques heures, l'application pouvait faire ramer le PC et les animations (chute du d20…) ne se jouaient plus. En cause : un téléphone écran éteint laissait s'accumuler en mémoire tout ce que le PC lui envoyait. Le PC ne garde plus que le dernier état pour un téléphone en retard, et coupe celui qui ne répond plus depuis une minute (il se reconnecte seul au réveil). Les téléphones ne reçoivent plus que ce qui change : environ 45 fois moins de données sur le Wi-Fi.
- **Porter un sac à dos d'un geste.** Quand un sac à dos arrive dans le sac d'un joueur, son téléphone lui propose aussitôt de le mettre sur le dos.
- **La fiche d'un objet depuis la bande des joueurs.** Un clic sur un objet de la bande ouvre sa fiche.
- **Le barème de santé mentale s'allège.** Il ne garde que les prix et les récupérations ; les événements de la séance se gèrent dans les Paramètres.

### Corrections
- **Un sac plein accepte toujours un sac à dos.** On ne pouvait plus tendre un sac à dos à un joueur dont le sac était plein, alors que le porter libère justement de la place.
- **Le QR code des téléphones visait parfois le mauvais réseau.** Sur un PC équipé d'Hyper-V, le QR pouvait pointer vers un réseau interne qu'aucun téléphone ne joint. Le PC choisit maintenant la carte du vrai réseau de la maison.
