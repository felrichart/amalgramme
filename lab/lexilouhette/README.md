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
  durs) et occupe une seule case : la première trouvée la remplit et rapporte les
  points ; les suivantes s'ajoutent sous elle, reliées par un trait, sans rien
  rapporter.

Une famille rapporte de 25 à 99 points selon la rareté de sa base : la somme des
fréquences de toutes les orthographes qui l'ont pour base, toutes longueurs, les
non jouables comprises (édite compte pour éditer). Courbe en S sur le log de la
fréquence, réglée pour environ 5/30/35/25/5 % des familles des niveaux de 5 à 7
lettres dans les couleurs 25, 26–49, 50–74, 75–98 et 99. Le niveau est fini quand
toutes les cases sont remplies. Constantes en tête de `game.js`.

Survoler (ou toucher) un mot trouvé montre ce qu'il est de sa base (« part. passé
fém. plur. de fatiguer ») et le premier sens de la base sur le Wiktionnaire, chargé
dès que le mot est trouvé (`definitions.js`, seul appel réseau du labo ; gardé
ensuite sur l’appareil).

Les mots jouables : tout ce qui n'est pas un verbe, les infinitifs et les
participes passés qui s'accordent (fatigué, fatiguée ; pas dormi). Les
conjugaisons et les participes présents sont exclus : le lexique ne sait pas
distinguer « il cogne » d'« un cogne », et un participe présent employé comme
adjectif a sa propre entrée (fatigant, portant).

Les niveaux sont tous les motifs qui passent les seuils (en tête de
`scripts/build-levels.mjs`) : 10 à 30 familles, de 4 à 7 lettres, au moins 2
lettres visibles et 2 cases vides, au moins 5 familles connues (1 par million ou
plus), pas plus de moitié de familles qui ne sont que des pluriels. Quand un niveau
en précise un autre (A__TE dans A___E), seul le plus précis reste.

Le menu les range par difficulté croissante (`difficultyOf` dans `levels.js`) :
10 × cases vides + 10 × lettres + score maximal / 250 (arrondi).

```
npm run lab                       # http://localhost:5174/lexilouhette
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

| Fichier                                | Rôle                                                                                   |
| -------------------------------------- | -------------------------------------------------------------------------------------- |
| `levels.config.json`                   | Réglages manuels des niveaux (ci-dessous).                                             |
| `data/lexique-grammalecte-fr-v7.7.zip` | Le lexique Grammalecte d'origine.                                                      |
| `data/dictionnaire.tsv`                | Généré par `lab:dico` : le dictionnaire du jeu.                                        |
| `levels.json`                          | Généré : les niveaux, famille par famille (format en tête de `buildLevel`, `game.js`). |
| `scripts/build-dictionary.mjs`         | La réduction du lexique Grammalecte.                                                   |
| `scripts/build-levels.mjs`             | Le générateur (règles de sélection en tête de fichier).                                |
| `game.js`                              | Règles du jeu et formule de points.                                                    |

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
