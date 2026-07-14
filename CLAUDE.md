# Amalgramme

Daily French word game. Guess a hidden **secret** from **4 linked words**; each
word is traced on its own letter wheel, and letters from solved words feed the
keyboard for typing the secret. Vue 3 + vue-router + Vite, no backend.

**Game rules, dev commands, deploy, and how to add levels live in `README.md`** —
this file covers the code only.

## Layout

```
src/
  main.js                      entry; resolve today's date → migrate saves → mount
  router.js                    / (menu), /challenges, /play/:slug
  game/puzzle.js               pure helpers: parse answers, build words/secret, shuffle, normalize
  composables/useGameState.js  ALL mutable game logic for one level (see below)
  data/challenges.json         the puzzle bank
  data/challenges.js           bank access: today's date, slug↔date, past challenges, tutorial
  utils/today.js               resolve today's date (time API, device-clock fallback)
  views/                       MenuView, ChallengesView, GameView (the board)
  components/                  LetterWheel, LetterKeyboard, TutorialCoach
shared/word-rules.js           word normalise/validate rules; imported by both the
                               client (game/word.js) and the Worker (server/worker.js)
server/worker.js               Cloudflare Worker: dailies + community API over D1
test/                          vitest: puzzle, gamestate, migration
```

> `shared/` is dependency-free and bundles for both the browser (Vite) and the
> Worker (esbuild) — editing it changes server-side validation, so redeploy the
> Worker (`wrangler deploy` from `server/`).

## Core concepts

- **A puzzle** = `{ date, secret, words[4] }`. `date` (ISO) is its stable id
  everywhere — routes, saved progress, links. Text carries no accents (typed `é`
  matches `e` via `normalize`). A space in a word = two-word answer: dropped from
  the wheel, shown as a gap in the answer slots.
- **`useGameState(date)`** owns everything mutable for one level: focused input
  (`'word'` | `'secret'` | `'none'`), drawn path, secret picks, solved flags,
  shake signals. Words commit on finger-release; the secret is typed from tiles
  of solved words. Level completes when all words AND the secret are found.
  Auto-persists to localStorage on every change.
- **Slugs**: `/play/daily` aliases today; any other slug is a date. The most
  recent non-future date is today's daily.
- **Coach**: an inline guided walkthrough (`TutorialCoach`) shown over the board
  on a player's first play. Progress lives in a single device-wide localStorage
  record (`tutorialState`/`saveTutorialState`): `done`, last-reached `step`, and
  `keyboardSeen` for the one-off secret-keyboard hint. No dedicated tutorial
  level — `migrateTutorial()` retires the old `tutoriel` save at startup.

## Conventions

- localStorage keys are date-based (`amalgramme:v3:level:<date>`), stable across
  bank reordering. `migrateSaves()` upgrades legacy index-based saves at startup.
- Shuffles use seeded deterministic Fisher-Yates (no `Math.random`).
- Prettier-formatted; run `npm run format` before committing.

```

```
