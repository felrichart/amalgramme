# Dicorama

Ex-Lexilouhette, sorti du labo : il vit dans l'app à `/dicorama`. Une silhouette
(`P_S_I__`) : trouver le plus de mots qui rentrent dedans. Un niveau par jour,
une couleur par jour de la semaine (`days.js`).

Trois niveaux de regroupement :

- **L'orthographe** (avec accents) réunit tous les sens d'une même graphie et
  leurs fréquences (tigres : le nom et « tu tigres »). Elle garde son meilleur
  sens jouable : nom, puis adjectif, puis verbe (participe passé ou infinitif),
  chacun au singulier avant le pluriel, puis au masculin avant le féminin sauf
  pour les noms. Ce sens donne sa base (tigres : le nom tigre).
- **La saisie** (sans accents, ce qu'on tape) réunit les orthographes qui se
  tapent pareil. Son maître mot est celle au meilleur sens, la plus fréquente à
  égalité (tares avant tarés) ; les autres sont ses homonymes, trouvés avec lui,
  listés dessous (ouverte quand on le trouve, d'un clic ensuite).
- **La famille** réunit les saisies dont le maître mot a la même base (dur, dure,
  durs) et occupe une seule ligne : la première trouvée la remplit et compte ; les
  suivantes rejoignent sa sous-liste, après ses homonymes, sans compter (la
  sous-liste s'ouvre à leur arrivée).

Les familles **courantes** forment la liste : une place numérotée chacune (01,
02…), vide au départ, dans l'ordre alphabétique, toutes visibles d'emblée en 2
colonnes, la première remplie d'abord (lignes plus serrées si l'écran est court, défilement en dernier recours), lues de haut
en bas. Sous elles, la place de la plus longue sous-liste du niveau est gardée,
pour qu'en ouvrir une ne déplace rien. Le score, en haut à droite, est X/N : les
familles de la liste trouvées, sur leur nombre.

Les familles **rares** sont à part, marquées d'un livre ouvert : la dernière
place de la liste est leur boîte, vide jusqu'au premier rare trouvé, puis un petit
bouton « 📖 3 » qui ouvre leur fenêtre (qui dit quand tous sont trouvés). Un mot
rare trouvé y rentre : le bouton s'élargit en case noire, la carte du mot sort, se
montre et rentre, puis la case redevient le petit bouton. Ils ne comptent pas dans
le score.

Trois étoiles, chacune avec sa fenêtre : **une** au tiers de la liste (⌈N/3⌉),
**deux** aux deux tiers (⌈2N/3⌉), **trois** avec toute la liste. Un quatrième
badge, le **livre doré**, quand tous les rares sont trouvés (s'il y en a). Les
badges s'affichent près du score une fois leur fenêtre fermée. Sous la saisie,
jusqu'au premier mot tapé en entier (trouvé ou non), le prochain but : « trouve 4
mots », « trouve 8 mots », « trouve tous les mots de la liste ».

L'accueil (`/dicorama`) montre le motif du jour en grand, Jouer, puis les jours
passés avec leur score et leurs badges ; en toucher un l'ouvre
(`/dicorama/<date>`).

La saisie : le curseur va à la case touchée, sinon à la première vide, sinon à la
dernière. Un mot complet est vérifié tout de suite, sans bouton ; refusé, il reste
(« mot inconnu », « déjà trouvé ») et la dernière lettre se retape directement.
⌫ efface la dernière lettre, ↺ toutes.

Dans la banque, une famille est rare selon sa note, de 25 à 99, jamais montrée aux
joueurs : rare à partir de 75. La note vient de la rareté de sa base : la somme des
fréquences de toutes les orthographes qui l'ont pour base, toutes longueurs, les
non jouables comprises (édite compte pour éditer). Courbe en S sur le log de la
fréquence, réglée pour environ 5/30/35/25/5 % des familles des niveaux de 5 à 7
lettres dans les tranches 25, 26–49, 50–74, 75–98 et 99. Constantes en tête de
`game.js`.

Survoler (ou toucher) un mot trouvé montre ce qu'il est de sa base (« adj., part.
passé fém. plur. de fatiguer », rien pour un infinitif) et le sens de la base sur
le Wiktionnaire : celui choisi par l'admin, sinon le premier qui lui est propre
(`definitions.js` ; les sens sont gardés ensuite sur l’appareil). Toucher un mot qui a d'autres graphies (pêche :
péché, pêché) les déplie dessous, un mot ouvert à la fois.

Les mots jouables : tout ce qui n'est pas un verbe, les infinitifs et les
participes passés qui s'accordent (fatigué, fatiguée ; pas dormi). Les
conjugaisons et les participes présents sont exclus : le lexique ne sait pas
distinguer « il cogne » d'« un cogne », et un participe présent employé comme
adjectif a sa propre entrée (fatigant, portant). Le générateur garde pourtant
les formes de verbe qui remplissent chaque motif (`conjugated`) : les taper
répond « pas de conjugaison », pas « mot inconnu ».

Les niveaux sont tous les motifs qui passent les seuils (en tête de
`scripts/build-levels.mjs`) : 10 à 25 familles courantes (les rares en plus), de 4 à 7
lettres, au moins 2 lettres visibles, 2 cases vides pour 4
lettres et 3 ou 4 sinon, au moins 5 familles connues (1 par million ou plus), pas
plus de moitié de familles qui ne sont que des pluriels, moins de 200 formes de
verbe qui le remplissent (pas de ____AIS). Quand un niveau en précise
un autre (A__TE dans A___E), seul le plus précis reste.

## Banque et niveaux officiels

Ce que génère `dicorama:levels` est la **banque** (`bank.json`, plusieurs Mo),
réservée à l'admin (le compte `cara+`) : elle n'est chargée qu'à l'ouverture de la
banque ou de l'éditeur, jamais par les joueurs. Les joueurs n'ont que les **niveaux
officiels** validés, un par jour, jusqu'à aujourd'hui.

Depuis la banque, ✎ ouvre l'éditeur d'un niveau (`DicoEditView.vue`, `editor.js`) :

- passer une famille de la liste aux rares et inversement ; la liste doit garder
  au moins 11 familles pour enregistrer (une étoile, puis deux) ;
- changer le maître mot d'une saisie : le mot suit la base de son nouveau maître
  mot, dans sa famille (créée au besoin, la famille vidée disparaît) ;
- bannir une orthographe du niveau (✕), pour une raison : conjugaison passée
  entre les mailles, mot invalide ou mot offensant, ce que le joueur lit en la
  tapant ; elle se rétablit depuis « Bannis », rangé par raison avec les
  conjugaisons du générateur ; un maître mot banni cède sa place à l'orthographe
  suivante ;
- choisir le sens du Wiktionnaire d'une base, enregistré tout de suite et valable
  dans tous les niveaux ;
- choisir son jour (« prochain jour libre » par défaut à la validation).

« Enregistrer le brouillon » le garde pour l'admin seul, « Valider » le donne aux
joueurs à son jour. Les niveaux officiels et les sens choisis vivent dans la base
D1 du Worker (`dicorama_levels`, `dicorama_definitions`, migration 0012, qui y
reprend les niveaux du labo en brouillons sans date ; les raisons et les formes
de verbe : 0015, que `scripts/conjugated-sql.mjs` remplit pour les niveaux déjà
enregistrés) ;
`store.js` les garde aussi sur l'appareil. L'admin trouve les niveaux à venir et
les brouillons à `/dicorama/a-venir`.

```
npm run dev                       # /dicorama (banque : /dicorama/banque, admin)
npm run dicorama:dico             # refait data/dictionnaire.tsv
npm run dicorama:levels           # puis la banque
```

Source : le lexique de Grammalecte v7.7, le correcteur de LibreOffice
(`data/lexique-grammalecte-fr-v7.7.zip`, grammalecte.net, licence MPL 2.0) : chaque
forme avec son lemme, sa nature et sa fréquence (Google Books, Wikipédia,
Wikisource, littérature). Il est réduit une fois pour toutes dans
`data/dictionnaire.tsv` (toutes longueurs) : graphies courantes, modernes et
classiques (sans celles de la réforme de 1990 ni les variantes douteuses), sans les
noms propres ni les abréviations (kcal, chap ; les mots abrégés comme radio restent).

## Fichiers

| Fichier                                | Rôle                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------ |
| `levels.config.json`                   | Réglages manuels des niveaux (ci-dessous).                                           |
| `data/lexique-grammalecte-fr-v7.7.zip` | Le lexique Grammalecte d'origine.                                                    |
| `data/dictionnaire.tsv`                | Généré par `dicorama:dico` : le dictionnaire du jeu.                                 |
| `bank.json`                            | Généré : la banque, famille par famille (format en tête de `buildLevel`, `game.js`). |
| `game.js`                              | Règles du jeu, liste et formule de rareté.                                           |
| `useDicorama.js`                       | Une partie : saisie, vérification, enchaînement des animations, sauvegarde.          |
| `store.js`                             | Niveaux officiels et sens choisis, depuis le Worker (écriture admin).                |
| `levels.js`                            | Banque (chargée à la demande), niveau d'une route, progression sur l'appareil.       |
| `editor.js`                            | Les modifications de l'éditeur.                                                      |
| `definitions.js`                       | Les sens du Wiktionnaire.                                                            |
| `days.js`, `theme.js`, `dicorama.css`  | Couleur du jour, polices, jetons et animations partagés.                             |
| `routes.js`, `views/`, `components/`   | Les routes `/dicorama…` et les écrans.                                               |
| `scripts/build-dictionary.mjs`         | La réduction du lexique Grammalecte.                                                 |
| `scripts/build-levels.mjs`             | Le générateur (règles de sélection en tête de fichier).                              |

## `levels.config.json`

| Clé              | Effet                                                                    |
| ---------------- | ------------------------------------------------------------------------ |
| `skipped`        | Motifs à ne jamais proposer.                                             |
| `skippedEndings` | Fins de motif à ne jamais proposer : `["NT"]` écarte `__ANT`, `E____NT`. |
| `banned`         | Mots refusés partout.                                                    |
| `rejected`       | Mots refusés dans un seul niveau : `{ "PA__": ["pacs"] }`.               |
| `added`          | Mots absents du dictionnaire à accepter : `{ "PA__": ["pacs"] }`.        |

Les mots s'écrivent avec leurs accents, une graphie à la fois : refuser cogné garde
cogne.
