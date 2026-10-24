# Lexilouhette

Jeu en test (labo local, jamais buildé ni déployé). Une silhouette (`P_S_I__`) :
trouver le plus de mots qui rentrent dedans.

Les mots d'un même lemme forment une famille (venir : venez, venue, venus). Le
premier trouvé rapporte les points du lemme (100 à 500 selon sa rareté) plus son
bonus ; les suivants seulement leur bonus (10 à 100, selon qu'ils sont plus rares
que le lemme). Constantes en tête de `game.js`.

```
npm run lab                       # http://localhost:5174/lexilouhette
npm run lab:levels                # met à jour les niveaux
npm run lab:levels -- --fresh     # repart de zéro
```

Les niveaux déjà dans `levels.json` gardent leur date et leur motif (leurs mots
suivent la config) ; de nouveaux sont ajoutés à la suite jusqu'à `count` niveaux
dans les seuils. Un niveau existant qui ne passe plus les seuils reste, signalé
« sous les seuils » : le mettre dans `skipped` pour le retirer.

Source : `data/Lexique4.1.tsv` (Lexique 4.10, lexique.org, licence CC BY-SA 4.0 —
voir `data/README-Lexique.txt`). Un autre fichier : `npm run lab:levels -- <tsv>`.

## Fichiers

| Fichier                    | Rôle                                                                                   |
| -------------------------- | -------------------------------------------------------------------------------------- |
| `levels.config.json`       | Réglages manuels (ci-dessous). Le seul fichier à éditer.                               |
| `levels.json`              | Généré : les niveaux joués, `[mot, fréq. mot, lemme, fréq. lemme]` par mot.            |
| `levels.report.md`         | Généré : par niveau, familles et points, variantes d'accents fusionnées, mots retirés. |
| `scripts/build-levels.mjs` | Le générateur (règles de sélection en tête de fichier).                                |
| `game.js`                  | Règles du jeu et formule de points.                                                    |

## `levels.config.json`

| Clé        | Effet                                                                                    |
| ---------- | ---------------------------------------------------------------------------------------- |
| `start`    | Date du premier niveau ; les suivants prennent un jour chacun.                           |
| `count`    | Nombre minimum de niveaux dans les seuils.                                               |
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
