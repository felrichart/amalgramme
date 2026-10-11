# Amalgramme

Daily French word game. Guess a hidden **secret** from **4 linked words**; each
word is traced on its own letter wheel, and letters from solved words feed the
keyboard for typing the secret. Vue 3 + vue-router + Vite, no backend.

**Game rules, dev commands, deploy, and how to add levels live in `README.md`** —
this file covers the code only.

## Layout

```
src/
  main.js                      entry: resolve today, warm caches, migrate saves, backfill stats, mount
  router.js                    routes; admin routes guarded by `adminOnly`
  config.js                    API_URL (Worker base URL), CACHE_MS
  ui.css                       shared UI classes: .page, .press, .icon-btn, .cta, .list/.row, modal bits
  game/puzzle.js               pure helpers: parse answers, build words/secret, answerSlots, seeded shuffle
  game/word.js                 create-form validation on top of shared/word-rules.js
  utils/                       storage (fail-soft localStorage), date, format (French labels), today
  data/                        local state, synchronous: cache (factory), dailies, community, levels
                               (date → puzzle/record, slugs), progress (saves), tutorial, migrations
  services/                    network: api (request/mutate/refresh), levels (CRUD + auth), stats
  composables/                 useGameState (ALL game logic for one level), useLevel, usePlayStats,
                               useCoach, useBoardLinks, useShake, useRequest, useCachedList, useUsername
  views/                       one per route; GameView is the board
  components/                  LetterWheel, LetterKeyboard, TutorialCoach, AidePopup, ChallengeForm,
                               LevelRow, UserBadge, UsernamePrompt; ui/ = PageHeader, BaseModal,
                               ConfirmModal, ProgressMark, BulbIcon
shared/                        word-rules.js + constants.js (ADMIN_NAME, PIN, id length); imported
                               by both the client and the Worker
server/worker.js               Cloudflare Worker: route table over D1 (dailies, community, auth, stats)
test/                          vitest: puzzle, word, gamestate, migration, dailies, community, worker
```

> `shared/` is dependency-free and bundles for both the browser (Vite) and the
> Worker (esbuild) — editing it changes server-side validation, so redeploy the
> Worker (`wrangler deploy` from `server/`).

## Core concepts

- **A puzzle** = `{ date, secret, words[4] }`. `date` (ISO) is its stable
  id everywhere — routes, saved progress, links. Text carries no accents (typed
  `é` matches `e` via `normalize`). A space in a word = two-word answer: dropped
  from the wheel, shown as a gap in the answer slots.
- **`useGameState(date)`** owns everything mutable for one level: focused input
  (`'word'` | `'secret'` | `'none'`), drawn path, secret picks, solved flags,
  shake signals. Words commit on finger-release; the secret is typed from tiles
  of solved words. Level completes when all words AND the secret are found.
  Auto-persists to localStorage on every change.
- **Help** (`useHelp('word' | 'secret')`): the header lightbulb opens `AidePopup`,
  which always offers both reveals; each spends one of 3 reveals (`helpUsed`,
  capped at `HELP_MAX`) and is disabled once nothing's left to uncover there
  (`canRevealWord` / `canRevealSecret`). A word reveal uncovers the next leading
  letter (1st, 2nd, …) of a randomly chosen unsolved word that still hides one
  (`revealed[]`, a per-word count, badged on the wheel tile); a secret reveal
  uncovers the next leading letter of the énigme (`secretReveal`, shown as a
  ghost in the boxes). The word pick is a deterministic pseudo-random spread over
  `helpUsed` (no `Math.random`, per the seeded-shuffle convention).
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
- Every localStorage access goes through `utils/storage.js` (never throws).
- Every Worker call goes through `services/api.js`; writes resolve to
  `{ ok, data }` / `{ ok: false, error }` with a French message.
- Reuse the global classes in `ui.css` (`.press` for the comic press effect) and
  `components/ui/*` instead of restating header/modal/button styles per view.
- Prettier-formatted; run `npm run format` before committing.

```

```
