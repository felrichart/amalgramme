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

Les défis quotidiens vivent dans la base D1 du Worker (`server/`) et s'éditent
depuis le tableau de bord **Admin** du jeu (compte `cara+`) : seuls aujourd'hui
et les jours suivants sont modifiables. `src/data/challenges.json` n'est plus que
l'artefact d'amorçage historique. Les règles d'un mot (3–12 lettres, sans
accents, espaces/traits/apostrophes comme séparateurs) sont dans
`shared/word-rules.js`.

## Déploiement

Poussé sur `main`, le workflow `.github/workflows/deploy.yml` construit le site
et le publie sur GitHub Pages automatiquement. Le JSON des niveaux étant importé
au build, mettre à jour les niveaux ne demande qu'un commit.

## Structure

Voir `CLAUDE.md` (section _Layout_) pour l'organisation du code.
