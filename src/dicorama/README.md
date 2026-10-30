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
  durs) et occupe une seule case : la première trouvée la remplit et compte ; les
  suivantes s'ajoutent sous elle, reliées par un trait gris, sans compter.

Une famille est une **réponse**, à place numérotée (01, 02…), ou une **rare**, en
bonus. La liste est alphabétique : la place d'une réponse se remplit de son premier
mot trouvé ; tout autre mot trouvé a sa propre ligne, avec l'étiquette jaune « +1 »
s'il ouvre une famille rare, avec un « – » (variante, ne rapporte rien) s'il est
d'une famille déjà ouverte. En haut, le score (réponses trouvées) et l'étiquette
jaune des rares dès la première. Le niveau est fini quand toutes les réponses sont
trouvées ; on peut continuer à chercher des rares.

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

Survoler (ou toucher) un mot trouvé montre ce qu'il est de sa base (« part. passé
fém. plur. de fatiguer ») et le sens de la base sur le Wiktionnaire : celui choisi
par l'admin, sinon le premier qui lui est propre (`definitions.js` ; les sens sont
gardés ensuite sur l’appareil). Toucher un mot qui a d'autres graphies (pêche :
péché, pêché) les déplie dessous, un mot ouvert à la fois.

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

Ce que génère `dicorama:levels` est la **banque** (`bank.json`, plusieurs Mo),
réservée à l'admin (le compte `cara+`) : elle n'est chargée qu'à l'ouverture de la
banque ou de l'éditeur, jamais par les joueurs. Les joueurs n'ont que les **niveaux
officiels** validés, un par jour, jusqu'à aujourd'hui.

Depuis la banque, ✎ ouvre l'éditeur d'un niveau (`DicoEditView.vue`, `editor.js`) :

- passer une famille de réponse à rare et inversement ;
- changer le maître mot d'une saisie : le mot suit la base de son nouveau maître
  mot, dans sa famille (créée au besoin, la famille vidée disparaît) ;
- bannir une orthographe du niveau (✕), rétablie depuis « Bannis » ; un maître mot
  banni cède sa place à l'orthographe suivante ;
- choisir le sens du Wiktionnaire d'une base, enregistré tout de suite et valable
  dans tous les niveaux ;
- choisir son jour (« prochain jour libre » par défaut à la validation).

« Enregistrer le brouillon » le garde pour l'admin seul, « Valider » le donne aux
joueurs à son jour. Les niveaux officiels et les sens choisis vivent dans la base
D1 du Worker (`dicorama_levels`, `dicorama_definitions`, migration 0012, qui y
reprend les niveaux du labo en brouillons sans date) ; `store.js` les garde aussi
sur l'appareil. L'accueil `/dicorama` montre à l'admin les niveaux à venir et les
brouillons.

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
