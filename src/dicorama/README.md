# Dicorama

Ex-Lexilouhette, sorti du labo : il vit dans l'app à `/dicorama`. Une silhouette
(`P_S_I__`) : trouver, d'après leurs indices, les mots qui rentrent dedans, et
tous les autres en bonus. Un niveau par jour,
une couleur par jour de la semaine (`days.js`).

Un **mot** est ce qu'on tape (sans accents). Il réunit les orthographes qui se
tapent pareil : son maître mot, montré, et ses homonymes (pêche : péché, pêché),
trouvés avec lui. Chaque orthographe garde son meilleur sens jouable : nom, puis
adjectif, puis verbe (participe ou infinitif), chacun au singulier avant le
pluriel, puis au masculin avant le féminin sauf pour les noms. Ce sens donne sa
base (tigres : le nom tigre). Le maître mot est l'orthographe au meilleur sens,
la plus fréquente à égalité (tares avant tarés). Les mots d'une même base (dur,
dure, durs) sont des mots distincts.

Les **énigmes** (6 à 12 par niveau) forment la liste : une place numérotée
chacune (01, 02…), dans l'ordre alphabétique, sur une colonne, avec son indice
écrit dans la fente vide. Trouvée, sa carte arrive par-dessus et garde l'indice
en petit à droite du mot. Les lignes se resserrent si l'écran est court, et la
liste défile en dernier recours. Le score, en haut à droite, est X/N : les
énigmes trouvées, sur leur nombre. Une étoile vide le suit.

Les **mots bonus** sont tous les autres mots, et les homonymes des énigmes. Ils
sont à part, marqués d'un livre ouvert : la dernière place de la liste est leur
boîte, vide jusqu'au premier trouvé, puis un petit bouton « 📖 3 » qui ouvre leur
fenêtre (qui dit quand tous sont trouvés). Un mot bonus trouvé y rentre : le
bouton s'élargit en case noire, la carte du mot sort, se montre et rentre, puis
la case redevient le petit bouton. Dans la fenêtre, un mot bonus qui a des
homonymes les déplie dessous quand on le touche ; les homonymes d'une énigme y
ont leur propre ligne.

Deux badges, chacun avec sa fenêtre : l'**étoile**, quand toutes les énigmes sont
trouvées, et le **trophée**, quand tous les mots le sont (énigmes et bonus). Ils
s'affichent près du score une fois leur fenêtre fermée. Sous la saisie, jusqu'au
premier mot tapé en entier (trouvé ou non), le prochain but : « trouve les 7
mots », puis « trouve tous les mots bonus ».

L'accueil (`/dicorama`) montre le motif du jour en grand, Jouer, puis les jours
passés avec leur score, leurs mots bonus trouvés (en petit, à côté d'un livre) et
leurs badges ; en toucher un l'ouvre (`/dicorama/<date>`).

La saisie : le curseur va à la case touchée, sinon à la première vide, sinon à la
dernière. Un mot complet est vérifié tout de suite, sans bouton ; refusé, il reste
(« mot inconnu », « déjà trouvé ») et la dernière lettre se retape directement.
⌫ efface la dernière lettre, ↺ toutes.

Chaque mot a une note de rareté, de 25 à 99, jamais montrée aux joueurs : celle de
la base de son maître mot. Elle vient de la somme des fréquences de toutes les
orthographes qui ont cette base, toutes longueurs, les non jouables comprises
(édite compte pour éditer). Courbe en S sur le log de la fréquence, réglée pour
environ 5/30/35/25/5 % des bases des niveaux de 5 à 7 lettres dans les tranches
25, 26–49, 50–74, 75–98 et 99. Une base est **courante** sous 75. Constantes en
tête de `game.js`.

Survoler (ou toucher) un mot trouvé montre ce qu'il est de sa base (« part. passé
fém. plur. de fatiguer », rien pour un infinitif) et le sens de la base sur le
Wiktionnaire : celui choisi par l'admin, sinon le premier qui lui est propre
(`definitions.js` ; les sens sont gardés ensuite sur l'appareil).

Les mots jouables : tout ce qui n'est pas un verbe, les infinitifs et tous les
participes, passés (dormi, fatiguées) ou présents (chantant). Les autres
conjugaisons sont exclues : le lexique ne sait pas distinguer « il cogne » d'« un
cogne ». Le générateur garde pourtant les formes de verbe qui remplissent chaque
motif (`conjugated`) : les taper répond « pas de conjugaison », pas « mot
inconnu ».

Les niveaux sont tous les motifs qui passent les seuils (en tête de
`scripts/build-levels.mjs`) : de 4 à 9 lettres, 2 à 4 cases vides, au moins 2
lettres visibles, 10 à 30 mots, au moins 6 bases courantes différentes, au plus
60 % de mots au pluriel, moins de 250 formes de verbe qui le remplissent (pas de
____AIS). Quand un niveau en précise un autre (A__TE dans A___E), seul le plus
précis reste.

## Banque et niveaux officiels

Ce que génère `dicorama:levels` est la **banque** (`bank.json`, environ 15 Mo, lue en JSON),
réservée à l'admin (le compte `cara+`) : elle n'est chargée qu'à l'ouverture de la
banque ou de l'éditeur, jamais par les joueurs. Ses niveaux n'ont pas d'énigmes :
jouée depuis la banque, un niveau prend ses 6 mots les plus courants, une base
chacun tant qu'il y en a assez, sans indice. Les joueurs n'ont que les **niveaux
officiels** validés, un par jour, jusqu'à aujourd'hui.

Depuis la banque, ✎ ouvre l'éditeur d'un niveau (`DicoEditView.vue`, `editor.js`),
qui part de ces 6 énigmes aux indices vides :

- passer un mot des énigmes aux bonus et inversement, et écrire l'indice de
  chaque énigme ; valider demande de 6 à 12 énigmes, chacune avec son indice (un
  brouillon s'enregistre tel quel) ;
- changer le maître mot d'un mot ;
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
D1 du Worker (`dicorama_levels`, `dicorama_definitions` ; migration 0016 : les
énigmes, `clues`, et l'effacement des niveaux d'avant) ; `store.js` les garde
aussi sur l'appareil. L'admin trouve les niveaux à venir et les brouillons à
`/dicorama/a-venir`.

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

| Fichier                                | Rôle                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------ |
| `levels.config.json`                   | Réglages manuels des niveaux (ci-dessous).                                     |
| `data/lexique-grammalecte-fr-v7.7.zip` | Le lexique Grammalecte d'origine.                                              |
| `data/dictionnaire.tsv`                | Généré par `dicorama:dico` : le dictionnaire du jeu.                           |
| `bank.json`                            | Généré : la banque (format en tête de `buildLevel`, `game.js`).                |
| `game.js`                              | Règles du jeu, énigmes, bonus et formule de rareté.                            |
| `useDicorama.js`                       | Une partie : saisie, vérification, enchaînement des animations, sauvegarde.    |
| `store.js`                             | Niveaux officiels et sens choisis, depuis le Worker (écriture admin).          |
| `levels.js`                            | Banque (chargée à la demande), niveau d'une route, progression sur l'appareil. |
| `editor.js`                            | Les modifications de l'éditeur.                                                |
| `definitions.js`                       | Les sens du Wiktionnaire.                                                      |
| `days.js`, `theme.js`, `dicorama.css`  | Couleur du jour, polices, jetons et animations partagés.                       |
| `routes.js`, `views/`, `components/`   | Les routes `/dicorama…` et les écrans.                                         |
| `scripts/build-dictionary.mjs`         | La réduction du lexique Grammalecte.                                           |
| `scripts/build-levels.mjs`             | Le générateur (règles de sélection en tête de fichier).                        |

## `levels.config.json`

| Clé              | Effet                                                                     |
| ---------------- | ------------------------------------------------------------------------- |
| `skipped`        | Motifs à ne jamais proposer.                                              |
| `skippedEndings` | Fins de motif à ne jamais proposer : `["AIS"]` écarte `__AIS`, `E___AIS`. |
| `banned`         | Mots refusés partout.                                                     |
| `rejected`       | Mots refusés dans un seul niveau : `{ "PA__": ["pacs"] }`.                |
| `added`          | Mots absents du dictionnaire à accepter : `{ "PA__": ["pacs"] }`.         |

Les mots s'écrivent avec leurs accents, une graphie à la fois : refuser cogné garde
cogne.
