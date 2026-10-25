# Lexilouhette

Jeu en test (labo local, jamais buildé ni déployé). Une silhouette (`P_S_I__`) :
trouver le plus de mots qui rentrent dedans.

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
  durs) et occupe une seule case : la première trouvée la remplit et compte ; les
  suivantes s'ajoutent sous elle, reliées par un trait gris, sans compter.

Une famille est une **réponse**, à case numérotée, ou une **rare**, en bonus : sa
case n'apparaît qu'une fois trouvée, marquée d'un point rose. En haut, « X+Y » : X
réponses et Y rares trouvées (le +Y dès la première). Le niveau est fini quand
toutes les réponses sont trouvées.

Dans la banque, une famille est rare selon sa note, de 25 à 99, jamais montrée aux
joueurs : rare à partir de 75. La note vient de la rareté de sa base : la somme des
fréquences de toutes les orthographes qui l'ont pour base, toutes longueurs, les
non jouables comprises (édite compte pour éditer). Courbe en S sur le log de la
fréquence, réglée pour environ 5/30/35/25/5 % des familles des niveaux de 5 à 7
lettres dans les tranches 25, 26–49, 50–74, 75–98 et 99. Constantes en tête de
`game.js`.

Survoler (ou toucher) un mot trouvé montre ce qu'il est de sa base (« part. passé
fém. plur. de fatiguer ») et le sens de la base sur le Wiktionnaire : celui choisi
par l'admin, sinon le premier qui lui est propre (`definitions.js`, seul appel
réseau du labo ; les sens sont gardés ensuite sur l’appareil).

Les mots jouables : tout ce qui n'est pas un verbe, les infinitifs et les
participes passés qui s'accordent (fatigué, fatiguée ; pas dormi). Les
conjugaisons et les participes présents sont exclus : le lexique ne sait pas
distinguer « il cogne » d'« un cogne », et un participe présent employé comme
adjectif a sa propre entrée (fatigant, portant).

Les niveaux sont tous les motifs qui passent les seuils (en tête de
`scripts/build-levels.mjs`) : 10 à 25 réponses (les rares en plus), de 4 à 7
lettres, au moins 2 lettres visibles, 2 cases vides pour 4
lettres et 3 ou 4 sinon, au moins 5 familles connues (1 par million ou plus), pas
plus de moitié de familles qui ne sont que des pluriels. Quand un niveau en précise
un autre (A__TE dans A___E), seul le plus précis reste.

## Banque et niveaux officiels

Ce que génère `lab:levels` est la **banque** (`levels.json`), réservée à l'admin
(tout le monde l'est en dev, `isAdmin` dans `official.js`). Les joueurs n'ont que
les **niveaux officiels**, édités et validés par l'admin, dans leur ordre de
validation.

Depuis la banque, ✎ ouvre l'éditeur d'un niveau (`LexEditView.vue`, `editor.js`) :

- passer une famille de réponse à rare et inversement ;
- changer le maître mot d'une saisie : le mot suit la base de son nouveau maître
  mot, dans sa famille (créée au besoin, la famille vidée disparaît) ;
- bannir une orthographe du niveau (✕), rétablie depuis « Bannis » ; un maître mot
  banni cède sa place à l'orthographe suivante ;
- choisir le sens du Wiktionnaire d'une base, enregistré tout de suite et valable
  dans tous les niveaux.

« Enregistrer le brouillon » le garde pour l'admin seul, « Valider » le donne aux
joueurs. Les niveaux officiels et les sens choisis vivent dans `official.json`,
écrit par le serveur du labo (`lab/vite.config.js`) en attendant notre Worker.

```
npm run lab                       # http://localhost:5174/lexilouhette (banque : /banque)
npm run lab:dico                  # refait data/dictionnaire.tsv
npm run lab:levels                # puis les niveaux
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
| `data/dictionnaire.tsv`                | Généré par `lab:dico` : le dictionnaire du jeu.                                      |
| `levels.json`                          | Généré : la banque, famille par famille (format en tête de `buildLevel`, `game.js`). |
| `official.json`                        | Les niveaux officiels (même format) et les sens choisis, écrits par l'éditeur.       |
| `official.js`                          | Lecture et écriture de `official.json`, et qui est admin.                            |
| `editor.js`                            | Les modifications de l'éditeur.                                                      |
| `scripts/build-dictionary.mjs`         | La réduction du lexique Grammalecte.                                                 |
| `scripts/build-levels.mjs`             | Le générateur (règles de sélection en tête de fichier).                              |
| `game.js`                              | Règles du jeu et formule de rareté.                                                  |

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
