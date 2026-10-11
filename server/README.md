# Amalgramme — community levels backend

A single Cloudflare Worker + D1 database storing player-created challenges. Free
tier: 100k Worker requests/day and generous D1 limits — plenty for a small
community. The Worker never sleeps.

## One-time setup

You need a (free) Cloudflare account and the Wrangler CLI:

```sh
npm install -g wrangler        # or: npx wrangler ...
wrangler login                 # opens the browser to authorise
```

From this `server/` directory:

1. **Create the database** and copy the printed `database_id` into
   `wrangler.toml` (replace `REPLACE_WITH_DATABASE_ID`):

   ```sh
   wrangler d1 create amalgramme
   ```

2. **Apply the schema** via migrations (creates the `levels` and `users` tables).
   The `migrations/` folder is already populated; D1 tracks what's been applied:

   ```sh
   wrangler d1 migrations apply amalgramme --remote
   ```

3. **Deploy**:

   ```sh
   wrangler deploy
   ```

   Wrangler prints the URL, e.g. `https://amalgramme-community.<you>.workers.dev`.

4. **Point the app at it**: set the URL in the repo-root `.env.production`
   (`VITE_COMMUNITY_API=https://…workers.dev`), then rebuild (`npm run build`).
   Use `.env.production.local` instead to keep it out of git.

## Changing the schema later

Add a migration, edit its SQL, then apply it (locally, then remote):

```sh
wrangler d1 migrations create amalgramme add_something   # writes migrations/0003_add_something.sql
# edit that file
wrangler d1 migrations apply amalgramme --local
wrangler d1 migrations apply amalgramme --remote
```

`wrangler d1 migrations list amalgramme --remote` shows what's still pending.

## Local development

```sh
cp .dev.vars.example .dev.vars                      # once: dev mail mode (see below)
wrangler d1 migrations apply amalgramme --local     # seed the local DB once
wrangler dev                                        # http://localhost:8787 (local D1)
npm run db:pull                                     # or: mirror the remote DB locally
```

`.dev.vars` sets `MAIL_MODE=log`: no email is sent; the verification / reset link
is printed in the `wrangler dev` console **and** returned as `devMail` in the JSON
response, which the app logs to the browser console (`[dev mail]`) in dev builds.
Never set `MAIL_MODE` in production — it would hand reset links to anyone.

`db:pull` (from the repo root, `wrangler dev` stopped) exports the remote D1 and
replaces the local one with it. Needs `wrangler login`; the dump holds legacy
plaintext PINs and password hashes, so it's written to a temp dir and deleted
after import.

The app's `npm run dev` reads `.env.development`. Set
`VITE_COMMUNITY_API=http://localhost:8787` there (while `wrangler dev` runs) to
exercise the API locally; leave it empty to run the app offline from cache.

## Accounts

- **Sign-up**: username + email + password. Passwords are PBKDF2-SHA256 hashed
  (100k iterations, WebCrypto, `crypto.js`). Signing in takes the name or email.
- **Sessions**: `Authorization: Bearer <token>`; the DB keeps only its SHA-256.
  180-day sliding expiry; a password reset revokes every session.
- **Email** (`mail.js`): verification (non-blocking, the app just nags) and password
  reset links point at `APP_URL` (`/verifier`, `/mot-de-passe`).
- **Legacy PIN accounts** keep signing in via `POST /auth/pin` until
  `PIN_DEADLINE` (`shared/constants.js`, 2027-01-11). The app badges them and asks
  for an email + password (`POST /auth/secure`, same name and levels). Past the
  deadline the daily cron deletes them; their levels stay, and a newcomer reusing
  the name can't delete them (ownership needs `level.created_at >= user.created_at`).
- **Progress** (`/progress`): one JSON save per (user, puzzle), merged with
  `shared/progress.js` (most advanced wins, then newest).

### Email setup (once)

The sending domain must be on Cloudflare:

```sh
wrangler email sending enable <your-domain>   # needs a token with Email Sending scope
```

Then set `APP_URL` and `MAIL_FROM` under `[vars]` in `wrangler.toml` and deploy.

## API

Signed-in routes take `Authorization: Bearer <token>`; `401 unauthorized` means the
session is gone.

| Method | Path                  | Body / auth                       | Notes                                                     |
| ------ | --------------------- | --------------------------------- | --------------------------------------------------------- |
| POST   | `/auth/signup`        | `{username, email, password}`     | → `{token, user}`; emails a verification link             |
| POST   | `/auth/login`         | `{login, password}`               | `login` = name or email → `{token, user}`                 |
| POST   | `/auth/pin`           | `{username, pin}`                 | legacy accounts only, until `PIN_DEADLINE`                |
| POST   | `/auth/logout`        | session                           | revokes this session                                      |
| GET    | `/auth/me`            | session                           | `{username, email, emailVerified, legacy, pinDeadline}`   |
| POST   | `/auth/secure`        | session, `{email, password}`      | legacy → secured account                                  |
| POST   | `/auth/verify`        | `{token}`                         | from the emailed link                                     |
| POST   | `/auth/verify/resend` | session                           |                                                           |
| POST   | `/auth/forgot`        | `{login}`                         | always 200 (no account probing)                           |
| POST   | `/auth/reset`         | `{token, password}`               | → `{token, user}`, other sessions revoked                 |
| GET    | `/progress`           | session                           | `{<puzzle date>: save}`                                   |
| POST   | `/progress`           | session, `{saves}`                | merges, returns the full merged set                       |
| GET    | `/levels`             | —                                 | all levels, newest first                                  |
| POST   | `/levels`             | session, `{secret, words[4]}`     | authored by the session's user; rate-limited              |
| DELETE | `/levels/:id`         | session                           | its author (or `cara+`); community levels are create-only |
| GET    | `/dailies`            | —                                 | all dailies (with play stats), oldest first               |
| POST   | `/dailies`            | admin, `{date, secret, words[4]}` | `date` must be today or later                             |
| PUT    | `/dailies/:date`      | admin, `{secret, words[4]}`       | `date` must be today or later                             |
| DELETE | `/dailies/:date`      | admin                             | `date` must be today or later                             |
| POST   | `/admin/export`       | admin                             | full DB dump (JSON) for a manual backup                   |

## Daily challenges

Dailies live in the `dailies` table (keyed by ISO date), seeded from the original
`src/data/challenges.json` by migration `0005_seed_dailies.sql`. The admin (`cara+`)
edits them from the in-app dashboard at `/admin`; the Worker only accepts a create,
edit or delete for **today or a future date** (Europe/Paris), so past challenges stay
frozen. Play stats reuse `level_stats` (the date is the `level_id`).

## Backup

There's no automatic backup. From the dashboard, "Télécharger la sauvegarde" calls
`POST /admin/export` (admin session) and downloads the whole DB as JSON. From the CLI you
can also `wrangler d1 export amalgramme --remote --output backup.sql`.

## Moderation

There is no separate admin key. The username **`cara+`** is privileged: once it
has claimed its PIN (first use, like any name), it may edit or delete **any**
level from within the app — sign in as `cara+` and the edit/delete controls
appear on every author's list. An admin edit keeps the original author.

List ids from the CLI if you need one:

```sh
curl https://amalgramme-community.<you>.workers.dev/levels | jq '.[] | {id, author, secret}'
```

### Deleting a user (and all their levels)

There is no in-app account deletion. As DB owner, do it from the CLI — levels
reference the author by **name**, so it's `DELETE`s keyed on the username
(drop `--remote`, or use `--local`, to rehearse on the dev DB first):

```sh
NAME='le_nom'        # username to purge; double any apostrophe → 'o''brien'

# 1. preview what will go
wrangler d1 execute amalgramme --remote \
  --command "SELECT id, secret FROM levels WHERE author = '$NAME';"

# 2. delete their levels, then the account
wrangler d1 execute amalgramme --remote \
  --command "DELETE FROM levels WHERE author = '$NAME';"
for t in sessions email_tokens progress users; do
  wrangler d1 execute amalgramme --remote \
    --command "DELETE FROM $t WHERE username = '$NAME';"
done
```

Inventory — who exists and how many levels each has:

```sh
wrangler d1 execute amalgramme --remote --command \
  "SELECT u.username, COUNT(l.id) AS levels FROM users u \
   LEFT JOIN levels l ON l.author = u.username GROUP BY u.username ORDER BY levels DESC;"
```

## Rate limit

`wrangler.toml` caps creations to **100 per 10 s globally** (`RATE_LIMITER`), and
credential checks / email sends to **10 per minute per IP and per targeted login**
(`AUTH_LIMITER`). `period` only allows 10 or 60 s. Adjust there and redeploy.
