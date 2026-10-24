# Lexilouhette

Jeu en test (labo local, jamais buildé ni déployé). Une silhouette (`P_S_I__`) :
trouver le plus de mots qui rentrent dedans.

Les mots d'un même lemme forment une famille (placer : placez, plaçai) qui occupe
une seule case : le premier trouvé la remplit et rapporte les points du lemme, de
100 à 500 selon sa rareté, en pente douce pour les plus courants (réglés pour
environ 25/30/25/15/5 % des familles par centaine) ; les suivants s'ajoutent en
petit dessous, sans points. Une seule famille est dépliée à la fois : celle qu'on
vient de compléter, jusqu'au prochain mot d'une autre ; un clic sur une famille la
plie ou la déplie. Le niveau est fini quand toutes les cases sont remplies.
Constantes en tête de `game.js`.

Un adjectif qui est aussi un participe va avec son verbe (fatigués : fatiguer ;
mais fier n'est pas se fier). Sinon, un mot qui a un sens à lui dans le niveau
sort de la famille : porte reste seul plutôt que d'aller avec portez. Un
niveau a 10 à 25 familles, des mots de 5 à 8 lettres, au plus une case vide de plus
que de lettres visibles, et jamais plus de 2 lettres visibles à la suite.

```
npm run lab                       # http://localhost:5174/lexilouhette
npm run lab:levels                # ajoute `batch` niveaux
npm run lab:levels -- --add 30    # en ajoute 30
npm run lab:levels -- --fresh     # repart de zéro
```

Les niveaux déjà dans `levels.json` gardent leur date et leur motif (leurs mots
suivent la config) ; chaque lancement en ajoute de nouveaux à la suite, tirés au
hasard (graine fixe) parmi les motifs qui passent les seuils, les motifs `reviewed`
d'abord. Un niveau existant qui ne passe plus les seuils reste, signalé
« sous les seuils » : le mettre dans `skipped` pour le retirer.

Source : `data/Lexique4.1.tsv` (Lexique 4.10, lexique.org, licence CC BY-SA 4.0 —
voir `data/README-Lexique.txt`), nettoyé une fois pour toutes dans
`data/lexique.tsv` (toutes longueurs) : sans les mots inconnus du correcteur
Grammalecte (`data/grammalecte.txt`, celui de LibreOffice), les noms propres ni les
mots qui n'existent pas. Ces deux dernières listes sont faites à la main ; après les
avoir modifiées :

```
npm run lab:lexique               # refait data/lexique.tsv
npm run lab:levels                # puis les niveaux
```

Mieux vaut manquer un mot que proposer un mot douteux : tout ce que Grammalecte ne
connaît pas part (environ 5 % du Lexique : fautes des sous-titres comme machète,
anglais, mots très rares comme macoute, mais aussi du vocabulaire régional). Les
listes faites à la main retirent en plus ce que Grammalecte accepte à tort.

## Fichiers

| Fichier                        | Rôle                                                                        |
| ------------------------------ | --------------------------------------------------------------------------- |
| `levels.config.json`           | Réglages manuels des niveaux (ci-dessous).                                  |
| `data/grammalecte.txt`         | Formes connues du correcteur Grammalecte v7.7 (licence MPL 2.0).            |
| `data/exclus-noms-propres.txt` | Noms propres retirés du Lexique, un par ligne.                              |
| `data/exclus-inconnus.txt`     | Mots inexistants retirés (un mot ou un lemme : toutes ses formes partent).  |
| `data/lexique.tsv`             | Généré par `lab:lexique` : le dictionnaire du jeu.                          |
| `levels.json`                  | Généré : les niveaux joués, `[mot, fréq. mot, lemme, fréq. lemme]` par mot. |
| `levels.report.md`             | Généré : par niveau, familles et points, variantes d'accents, mots retirés. |
| `levels.all.json`              | Généré : tous les niveaux possibles, jouables depuis « Tous les niveaux ».  |
| `scripts/clean-lexique.mjs`    | Le nettoyage du Lexique.                                                    |
| `scripts/build-levels.mjs`     | Le générateur (règles de sélection en tête de fichier).                     |
| `game.js`                      | Règles du jeu et formule de points.                                         |

## `levels.config.json`

| Clé        | Effet                                                                                    |
| ---------- | ---------------------------------------------------------------------------------------- |
| `start`    | Date du premier niveau ; les suivants prennent un jour chacun.                           |
| `batch`    | Nombre de niveaux ajoutés à chaque lancement.                                            |
| `pinned`   | Motifs imposés (`"PA__"`), placés en premier, sans contrôle de qualité.                  |
| `skipped`  | Motifs à ne jamais proposer.                                                             |
| `reviewed` | Motifs dont les solutions ont été triées ; ils sont choisis en priorité.                 |
| `banned`   | Mots refusés partout (noms propres, anglicismes, coquilles du Lexique…).                 |
| `rejected` | Mots refusés dans un seul niveau : `{ "PA__": ["pacs"] }`.                               |
| `added`    | Mots absents du Lexique à accepter : `{ "PA__": ["pacs"] }` (comptés moyennement rares). |

Les mots s'écrivent comme dans le rapport (forme la plus courante, accents compris).

## Trier les niveaux

1. `npm run lab:levels` : la console liste les niveaux et affiche toutes
   les solutions de ceux qui ne sont pas encore `reviewed`.
2. Ajouter les mots douteux à `banned` (ou `rejected`), et le motif à `reviewed`.
3. Relancer. Retirer des mots peut faire passer un niveau sous les seuils : il reste,
   et un autre est ajouté à la suite, à trier à son tour. On s'arrête quand la
   console affiche « 0 à revoir ».
