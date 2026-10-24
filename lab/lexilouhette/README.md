# Lexilouhette

Jeu en test (labo local, jamais buildé ni déployé). Une silhouette (`P_S_I__`) :
trouver le plus de mots qui rentrent dedans.

Les mots d'un même lemme forment une famille (placer : placez, plaçai) qui occupe
une seule case : le premier trouvé la remplit et rapporte les points du lemme, de
100 à 500 selon sa rareté, en pente douce pour les plus courants (réglés pour
environ 20/30/30/15/5 % des familles par centaine) ; les suivants s'ajoutent en
petit dessous, sans points. Une seule famille est dépliée à la fois : celle qu'on
vient de compléter, jusqu'au prochain mot d'une autre ; un clic sur une famille la
plie ou la déplie. Le niveau est fini quand toutes les cases sont remplies.
Constantes en tête de `game.js`. Survoler (ou toucher) un mot trouvé montre son
lemme.

Un nom ou un adjectif tiré d'un participe va avec son verbe (fatigués, blessés :
fatiguer, blesser).
Des lemmes qui s'écrivent pareil ne font qu'une famille, quel que soit le sens
(lever et levez, fiers et fiées). Sinon, un mot qui a un sens à lui dans le niveau
sort de la famille : porte reste seul plutôt que d'aller avec portez.

Les niveaux sont tous les motifs qui passent les seuils (en tête de
`scripts/build-levels.mjs`) : 10 à 25 familles, des mots de 5 à 8 lettres, au plus
une case vide de plus que de lettres visibles, jamais plus de 2 lettres visibles à
la suite, au moins 7 familles connues (lemme à 1 par million ou plus), pas plus de
moitié de verbes. Tous les lemmes comptent, même très rares, avec toutes leurs
formes (rêvas, rêvât).

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
noms propres ni les listes faites à la main.

## Fichiers

| Fichier                                | Rôle                                                                       |
| -------------------------------------- | -------------------------------------------------------------------------- |
| `levels.config.json`                   | Réglages manuels des niveaux (ci-dessous).                                 |
| `data/lexique-grammalecte-fr-v7.7.zip` | Le lexique Grammalecte d'origine.                                          |
| `data/exclus-noms-propres.txt`         | Noms propres retirés, un par ligne.                                        |
| `data/exclus-inconnus.txt`             | Mots inexistants retirés (un mot ou un lemme : toutes ses formes partent). |
| `data/dictionnaire.tsv`                | Généré par `lab:dico` : le dictionnaire du jeu.                            |
| `levels.json`                          | Généré : les niveaux, `[mot, fréq. mot, lemme, fréq. lemme]` par mot.      |
| `scripts/build-dictionary.mjs`         | La réduction du lexique Grammalecte.                                       |
| `scripts/build-levels.mjs`             | Le générateur (règles de sélection en tête de fichier).                    |
| `game.js`                              | Règles du jeu et formule de points.                                        |

## `levels.config.json`

| Clé        | Effet                                                             |
| ---------- | ----------------------------------------------------------------- |
| `skipped`  | Motifs à ne jamais proposer.                                      |
| `banned`   | Mots refusés partout.                                             |
| `rejected` | Mots refusés dans un seul niveau : `{ "PA__": ["pacs"] }`.        |
| `added`    | Mots absents du dictionnaire à accepter : `{ "PA__": ["pacs"] }`. |

Les mots s'écrivent sous leur forme la plus courante, accents compris.
