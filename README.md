# Amalgramme 😎

Jeu de mots par niveaux. Chaque niveau : 6 mots lies par un theme, chacun
reconstitue en reliant les lettres de sa roue.

- Le **theme** est affiche d'emblee comme indice (pas a deviner).
- L'ecran d'un niveau montre 6 petites roues (deux colonnes de trois). On
  touche une roue : elle devient la grande roue active en bas de l'ecran.
- Pour saisir un mot : garder le doigt appuye et tracer une ligne de lettre en
  lettre. Le mot s'affiche au-dessus de la roue.
- Doigt relache avant la fin : le mot est simplement abandonne. Toutes les
  lettres utilisees mais mot faux : la roue tremble.
- Un appui au centre de la roue melange les lettres.
- Sur ordinateur : taper le mot au clavier, **Backspace** pour effacer une
  lettre, **Echap** pour tout annuler, **Espace** pour melanger.
- Quand un mot est correct, sa roue est remplacee par le mot dans la colonne.
- Les 6 mots trouves : le niveau est reussi (😎) et le temps s'affiche.
- Chaque mot fait 5 a 9 lettres (une lettre par noeud de la roue).

Pense pour le mobile d'abord, jouable aussi sur ordinateur. Theme visuel
« liquid glass » : pastels calmes (bleu, rose, jaune), verre depoli, fond clair.

## Developpement

```bash
npm install
npm run dev        # serveur de dev (http://localhost:5173)
npm run build      # build de production dans dist/
npm run preview    # sert le build de production
```

## Structure

- `src/data/challenges.js` — banque de niveaux : un `theme` (affiche, en
  francais normal) et 6 `words` (5-9 lettres, sans accents).
- `src/game/puzzle.js` — selection du niveau, construction des roues, melange.
- `src/composables/useGameState.js` — etat du jeu, trace du doigt, validation,
  chrono, sauvegarde et progression par niveau (localStorage).
- `src/components/` — `LetterWheel` (roue de lettres + trace), `SuccessScreen`.
- `src/views/` — `LevelsView` (choix du niveau), `GameView` (grille + roue active).
