# Mots Girafe 🦒

Jeu de mots quotidien. Chaque jour, un nouveau defi : 7 mots a reconstituer a
partir de leurs lettres melangees (anagrammes), sur un theme donne.

- Le **theme** est affiche d'emblee comme indice (pas a deviner).
- Chaque mot montre ses lettres melangees en dessous (estompees) ; le mot
  selectionne les agrandit et les rend cliquables.
- Tape une case pour commencer a ecrire n'importe ou dans le mot.
- Sur ordinateur : clavier physique, **Tab** pour changer de mot, **Backspace**
  pour effacer, **Echap** pour vider le mot, fleches pour deplacer le curseur.
- Une fois les 7 mots corrects, le defi est reussi et le temps s'affiche.
- Rejoue les defis passes (depuis janvier 2026) via le calendrier.

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

- `src/data/challenges.js` — banque de puzzles (FR, sans accents) : un `theme`
  et 7 `words`. Les defis quotidiens tournent sur cette banque selon la date.
- `src/game/puzzle.js` — selection du puzzle du jour, decoupage en cases, melange.
- `src/composables/useGameState.js` — etat du jeu, saisie, validation, chrono,
  sauvegarde (localStorage).
- `src/components/` — `WordRow` (cases + lettres), `SuccessScreen`, `GiraffeMark`.
- `src/views/` — `GameView` (jeu + clavier), `CalendarView` (calendrier).

## Credits

Icone girafe par Ben King (the Noun Project), recoloree.
