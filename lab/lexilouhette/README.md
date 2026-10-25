# Lexilouhette

Jeu en test (labo local, jamais buildé ni déployé). Une silhouette (`P_S_I__`) :
trouver le plus de mots qui rentrent dedans.

Chaque mot occupe une case, avec ses graphies qui ne diffèrent que par les accents
(cogne, cogné) : tapées sans accents, elles font une seule réponse, la plus
courante en tête et les autres dépliées dessous d'un clic. Un mot rapporte de 25 à
99 points selon la rareté de sa graphie, en courbe en S sur le log de la fréquence
(réglés pour environ 5/30/35/25/5 % des mots des niveaux de 5 à 7 lettres dans les
couleurs 25, 26–49, 50–74, 75–98 et 99). Le niveau est fini quand toutes les cases
sont remplies. Constantes en tête de `game.js`.

Survoler (ou toucher) un mot trouvé montre son premier sens sur le Wiktionnaire,
chargé dès que le mot est trouvé (`definitions.js`, seul appel réseau du labo ;
gardé ensuite sur l’appareil). Quand la page du mot n'est qu'une forme d'un autre
(« Féminin pluriel de fatigué »), la bulle suit le lien, deux fois au plus, et
affiche « de fatigué » avec son sens ; portée garde le sien, puisqu'il a une
section Nom commun.

Les mots jouables : tout ce qui n'est pas un verbe, les infinitifs et les
participes passés qui s'accordent (fatigué, fatiguée ; pas dormi). Les
conjugaisons et les participes présents sont exclus : le lexique ne sait pas
distinguer « il cogne » d'« un cogne », et un participe présent employé comme
adjectif a sa propre entrée (fatigant, portant). La fréquence d'une graphie compte
tous ses emplois, conjugaisons comprises, faute de pouvoir les séparer.

Les niveaux sont tous les motifs qui passent les seuils (en tête de
`scripts/build-levels.mjs`) : 10 à 25 mots, de 4 à 8 lettres, au plus une case
vide de plus que de lettres visibles, jamais plus de 3 lettres visibles à la
suite, au moins 7 mots connus (1 par million ou plus), pas plus de moitié de
pluriels.

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
noms propres.

## Fichiers

| Fichier                                | Rôle                                                                                     |
| -------------------------------------- | ---------------------------------------------------------------------------------------- |
| `levels.config.json`                   | Réglages manuels des niveaux (ci-dessous).                                               |
| `data/lexique-grammalecte-fr-v7.7.zip` | Le lexique Grammalecte d'origine.                                                        |
| `data/dictionnaire.tsv`                | Généré par `lab:dico` : le dictionnaire du jeu.                                          |
| `levels.json`                          | Généré : les niveaux, `[fréquence, graphie la plus courante, autres graphies…]` par mot. |
| `scripts/build-dictionary.mjs`         | La réduction du lexique Grammalecte.                                                     |
| `scripts/build-levels.mjs`             | Le générateur (règles de sélection en tête de fichier).                                  |
| `game.js`                              | Règles du jeu et formule de points.                                                      |

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
