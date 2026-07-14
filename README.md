# Amalgramme 😎

Jeu de mots quotidien. Chaque défi cache un **secret** à deviner et 4 **mots**
qui lui sont liés. Chaque mot se reconstitue en reliant les lettres de sa roue ;
les lettres trouvées alimentent le clavier qui sert à taper le secret.

**Jouer en ligne : https://felrichart.github.io/amalgramme/**

## Règles

- Le **secret** n'est pas affiché : il faut le deviner à partir des 4 mots.
- Chaque mot a sa roue de lettres. Pour saisir un mot : garder le doigt appuyé
  et tracer une ligne de lettre en lettre. La roue tremble si le mot est faux.
- Un appui au centre de la roue mélange les lettres.
- Les lettres des mots trouvés forment le stock de lettres pour taper le secret.
- Une **aide** facultative : si le défi propose un indice supplémentaire, une
  ampoule apparaît sur le clavier du secret ; l'activer révèle un 5ᵉ indice
  (déjà résolu) au-dessus de l'énigme.
- Un mot peut contenir un espace (réponse en deux mots) : l'espace est absent de
  la roue mais affiché comme un blanc dans les cases de la réponse.
- Sur ordinateur : taper au clavier, **Backspace** pour effacer, **Échap** pour
  tout annuler, **Espace** pour mélanger.
- Un **défi quotidien** par jour ; les défis passés restent rejouables.
- La progression est sauvegardée par défi (localStorage).

Pensé pour le mobile d'abord, jouable aussi sur ordinateur.

## Développement

```bash
npm install
npm run dev        # serveur de dev (http://localhost:5173)
npm run build      # build de production dans dist/
npm run preview    # sert le build de production
```

## Ajouter des niveaux

Les niveaux vivent dans `src/data/challenges.json` — un simple tableau, un objet
par défi :

```json
{ "date": "2026-07-12", "secret": "mot", "words": ["indice1", "indice2", "indice3", "indice4"] }
```

- `date` (ISO `AAAA-MM-JJ`) : un défi par jour ; le plus récent non futur est le
  défi du jour. Garder le tableau trié par date croissante, ajouter à la fin.
- `secret` et `words` : sans accents (le `é` tapé correspond au `e` après
  normalisation). Un espace dans un mot = réponse en deux mots.
- `hint` : un indice supplémentaire, révélable via l'ampoule du clavier. Requis à
  la création (formulaire), mais absent des anciens niveaux (= pas d'ampoule, ils
  restent jouables). Il suit les mêmes règles qu'un mot mais ne compte pas dans
  les lettres qui doivent pouvoir écrire le secret.

Éditer le JSON, commiter, pousser sur `main` : le déploiement se refait tout
seul (voir ci-dessous).

## Déploiement

Poussé sur `main`, le workflow `.github/workflows/deploy.yml` construit le site
et le publie sur GitHub Pages automatiquement. Le JSON des niveaux étant importé
au build, mettre à jour les niveaux ne demande qu'un commit.

## Structure

- `src/data/challenges.json` — banque de niveaux (données pures, éditables).
- `src/data/challenges.js` — charge le JSON, logique du défi du jour et des
  slugs de route.
- `src/game/puzzle.js` — sélection du niveau, construction des roues, du secret
  et du stock de lettres, mélange déterministe.
- `src/composables/useGameState.js` — état du jeu, tracé du doigt, validation,
  chrono, sauvegarde et progression par défi (localStorage).
- `src/components/` — `LetterWheel` (roue + tracé), `LetterKeyboard` (saisie du
  secret).
- `src/views/` — `MenuView` (accueil, défi du jour), `ChallengesView` (défis
  passés), `GameView` (roues + saisie du secret).
