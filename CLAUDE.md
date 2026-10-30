# Amalgramme

Daily French word game. Guess a hidden **secret** from **4 linked words**; each
word is a puzzle piece typed from its shuffled letters, and the pieces' letters
feed the stock for typing the secret. Vue 3 + vue-router + Vite, no backend.

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
  services/                    network: api (request/mutate/refresh, bearer token), levels (CRUD),
                               account (sign-up/in, PIN legacy, email links), sync (progress ↔
                               account), comments, stats
  composables/                 useGameState (ALL game logic for one level), useEntry (cursor-based
                               answer input), useLevel, usePlayStats, useCoach (paused), useShake,
                               useRequest, useCachedList, useAccount (session + profile)
  views/                       one per route; GameView is the board
  components/                  PuzzlePiece, TutorialCoach, AidePopup, ChallengeForm,
                               LevelRow, UserBadge, AccountModal, SyncPrompt, CommentsModal; ui/ = PageHeader, BaseModal,
                               ConfirmModal, ProgressMark, BulbIcon
  dicorama/                    Dicorama, a second game at /dicorama (README there): own
                               routes.js (lazy views), store (Worker), useDicorama, bank.json
                               (admin-only, loaded on demand) and its generator scripts
shared/                        word-rules.js, constants.js (ADMIN_NAME, PIN_DEADLINE, password/email
                               rules, id length), progress.js (save merge rule); imported by both
                               the client and the Worker
server/worker.js               Cloudflare Worker: route table over D1 (accounts, progress, dailies,
                               community, stats, dicorama); crypto.js (PBKDF2, tokens), mail.js (emails)
lab/                           local-only playground for new games (`npm run lab`), never
                               built or deployed, never calls the Worker
test/                          vitest: puzzle, word, gamestate, migration, dailies, community,
                               sync, dicorama, worker (real migrations on node:sqlite, test/d1.js)
```

> `shared/` is dependency-free and bundles for both the browser (Vite) and the
> Worker (esbuild) — editing it changes server-side validation, so redeploy the
> Worker (`wrangler deploy` from `server/`).

## Core concepts

- **A puzzle** = `{ date, secret, words[4] }`. `date` (ISO) is its stable
  id everywhere — routes, saved progress, links. Text carries no accents (typed
  `é` matches `e` via `normalize`). A space in a word = two-word answer: no tile,
  shown as a gap in the answer slots.
- **`useGameState(date)`** owns everything mutable for one level: focused input
  (`'word'` | `'secret'` | `'none'`), the word / secret entries (`useEntry`:
  positional cells, locked help prefix, movable cursor), solved flags, shake
  signals. An entry auto-checks once full; the secret is typed from tiles of the
  four words. Level completes when all words AND the secret are found.
  Auto-persists to localStorage on every change.
- **GameView** = board on top (pieces + secret; pieces merge around the secret
  while it's edited, via a FLIP animation — `useFlip`) and an editor below (the
  enlarged piece, or the secret's letter stock).
- **Help** (`useHelp('word' | 'secret')`): the header lightbulb opens `AidePopup`,
  which always offers both reveals; each spends one of 3 reveals (`helpUsed`,
  capped at `HELP_MAX`) and is disabled once nothing's left to uncover there
  (`canRevealWord` / `canRevealSecret`). A word reveal uncovers the next leading
  letter (1st, 2nd, …) of a randomly chosen unsolved word that still hides one
  (`revealed[]`, a per-word count, locked in its answer boxes); a secret reveal
  uncovers the next leading letter of the énigme (`secretReveal`, locked in its
  boxes). The word pick is a deterministic pseudo-random spread over
  `helpUsed` (no `Math.random`, per the seeded-shuffle convention).
- **Slugs**: `/play/daily` aliases today; any other slug is a date. The most
  recent non-future date is today's daily.
- **Accounts**: name + email + password, bearer session (`useAccount`). Legacy
  PIN accounts sign in until `PIN_DEADLINE`, are badged (`UserBadge` "!") and asked
  to add email + password. Signed in, every save syncs to the account
  (`services/sync.js`, debounced); merging never loses progress, so the only
  question (`SyncPrompt`) is at sign-in when the device holds outside progress —
  declining stashes it until logout.
- **Stats** (`services/stats.js`): one attempt/solve per (puzzle, player); the
  player is the account when signed in, else the device id, and signing in claims
  the device's anonymous plays (`claimPlays`). Server keeps running counters.
- **Comments** (`CommentsModal`, from the finish screen): signed-in players who
  solved the level read them and post one final comment; the Worker checks the
  solve against the account's synced save (`syncSave` first).
- **Coach** (paused — GameView doesn't mount it until it's rewritten for the
  puzzle board): an inline guided walkthrough (`TutorialCoach`) shown over the board
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
