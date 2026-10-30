# Amalgramme 😎

Jeu de mots quotidien. Chaque défi cache un **secret** à deviner et 4 **mots**
qui lui sont liés, chacun sur une pièce de puzzle. Chaque mot se reconstitue à
partir de ses lettres mélangées ; une fois les pièces assemblées autour du mot du
milieu, leurs lettres servent à taper le secret.

**Jouer en ligne : https://felrichart.github.io/amalgramme/**

## Règles

- Le **secret** n'est pas affiché : il faut le deviner à partir des 4 mots.
- Le plateau montre les 4 pièces et le mot du milieu ; toucher une pièce l'ouvre
  en grand dessous : toucher ses lettres pour remplir les cases. Le mot est
  vérifié dès que toutes les cases sont remplies (la pièce tremble s'il est faux).
- Toucher une case y place le curseur ; **⌫** efface une lettre, la corbeille tout
  le mot, les flèches croisées rebattent les lettres.
- Toucher le mot du milieu assemble les pièces autour de lui : les lettres des 4
  mots (dans l'ordre pour les mots trouvés) servent à taper le secret. Toucher
  une pièce du bloc revient à ce mot.
- Un mot peut contenir un espace (réponse en deux mots) : affiché comme un blanc
  dans les cases de la réponse.
- Sur ordinateur : taper au clavier, **Backspace** pour effacer, **← →** pour
  déplacer le curseur, **Espace** pour mélanger, **Échap** pour fermer.
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

## Dicorama

Un second jeu, à `/dicorama` (ex-Lexilouhette du labo) : règles, banque et
éditeur dans `src/dicorama/README.md`. Ses niveaux officiels vivent aussi dans D1
(migration 0012) et ne s'éditent que depuis le compte `cara+`.

## Déploiement

Poussé sur `main`, le workflow `.github/workflows/deploy.yml` construit le site
et le publie sur GitHub Pages automatiquement. Le JSON des niveaux étant importé
au build, mettre à jour les niveaux ne demande qu'un commit.

## Structure

Voir `CLAUDE.md` (section _Layout_) pour l'organisation du code.
