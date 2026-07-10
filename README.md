# Mots Girafe 🦒

Jeu de mots par niveaux. Chaque niveau : 7 mots a reconstituer a partir de
leurs lettres melangees (anagrammes), sur un theme donne.

- Le **theme** est affiche d'emblee comme indice (pas a deviner).
- Chaque mot montre ses lettres melangees en dessous (estompees, en apercu) ; les
  lettres du mot selectionne s'affichent en grand dans la barre du bas, a portee
  du pouce, avec les boutons melanger / vider / effacer.
- Tape une case pour commencer a ecrire n'importe ou dans le mot.
- Sur ordinateur : clavier physique, **Tab** pour changer de mot, **Espace**
  pour melanger, **Backspace** pour effacer, **Echap** pour vider le mot,
  fleches pour deplacer le curseur.
- Une fois les 7 mots corrects, le niveau est reussi et le temps s'affiche.
- L'ecran d'accueil liste tous les niveaux, groupes par difficulte (Facile,
  Normal, Difficile), avec leur theme et le nombre de mots trouves ; la
  progression est sauvegardee.

Pense pour le mobile d'abord, jouable aussi sur ordinateur. Style mots-croises /
scrabble, couleurs girafe.

## Developpement

```bash
npm install
npm run dev        # serveur de dev (http://localhost:5173)
npm run build      # build de production dans dist/
npm run preview    # sert le build de production
```

## Structure

- `src/data/challenges.js` — banque de niveaux : un `theme` (affiche, en
  francais normal), 7 `words` (sans accents, tapes par le joueur) et une
  `difficulty` (facile / normal / difficile). `DIFFICULTIES` liste les buckets.
- `src/game/puzzle.js` — selection du niveau, decoupage en cases, melange.
- `src/composables/useGameState.js` — etat du jeu, saisie, validation, chrono,
  sauvegarde et progression par niveau (localStorage).
- `src/components/` — `WordRow` (cases + lettres), `SuccessScreen`, `GiraffeMark`.
- `src/views/` — `LevelsView` (choix du niveau), `GameView` (jeu + clavier).

## Credits

Icone girafe par Ben King (the Noun Project), recoloree.
