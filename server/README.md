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
wrangler dev                                        # http://localhost:8787 (local D1)
wrangler d1 migrations apply amalgramme --local     # seed the local DB once
```

The app's `npm run dev` reads `.env.development`. Set
`VITE_COMMUNITY_API=http://localhost:8787` there (while `wrangler dev` runs) to
exercise the API locally; leave it empty to run the app offline from cache.

## API

| Method | Path             | Body / auth                             | Notes                                                                      |
| ------ | ---------------- | --------------------------------------- | -------------------------------------------------------------------------- |
| POST   | `/auth`          | `{author, pin, mode}`                   | `connexion` verifies an existing name+PIN; `inscription` claims a new name |
| GET    | `/levels`        | —                                       | all levels, newest first (no PINs)                                         |
| POST   | `/levels`        | `{author, pin, secret, words[4]}`       | claims/verifies the name via PIN; rate-limited; 429 over the cap           |
| DELETE | `/levels/:id`    | `{author, pin}`                         | owner PIN (or the `cara+` account); community levels are create-only       |
| GET    | `/dailies`       | —                                       | all dailies (with play stats), oldest first                                |
| POST   | `/dailies`       | `{author, pin, date, secret, words[4]}` | admin (`cara+`) only; `date` must be today or later                        |
| PUT    | `/dailies/:date` | `{author, pin, secret, words[4]}`       | admin only; `date` must be today or later                                  |
| DELETE | `/dailies/:date` | `{author, pin}`                         | admin only; `date` must be today or later                                  |
| POST   | `/admin/export`  | `{author, pin}`                         | admin only; full DB dump (JSON) for a manual backup                        |

## Daily challenges

Dailies live in the `dailies` table (keyed by ISO date), seeded from the original
`src/data/challenges.json` by migration `0005_seed_dailies.sql`. The admin (`cara+`)
edits them from the in-app dashboard at `/admin`; the Worker only accepts a create,
edit or delete for **today or a future date** (Europe/Paris), so past challenges stay
frozen. Play stats reuse `level_stats` (the date is the `level_id`).

## Backup

There's no automatic backup. From the dashboard, "Télécharger la sauvegarde" calls
`POST /admin/export` (admin PIN) and downloads the whole DB as JSON. From the CLI you
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
reference the author by **name**, so it's two `DELETE`s keyed on the username
(drop `--remote`, or use `--local`, to rehearse on the dev DB first):

```sh
NAME='le_nom'        # username to purge; double any apostrophe → 'o''brien'

# 1. preview what will go
wrangler d1 execute amalgramme --remote \
  --command "SELECT id, secret FROM levels WHERE author = '$NAME';"

# 2. delete their levels, then the account
wrangler d1 execute amalgramme --remote \
  --command "DELETE FROM levels WHERE author = '$NAME';"
wrangler d1 execute amalgramme --remote \
  --command "DELETE FROM users  WHERE username = '$NAME';"
```

Inventory — who exists and how many levels each has:

```sh
wrangler d1 execute amalgramme --remote --command \
  "SELECT u.username, COUNT(l.id) AS levels FROM users u \
   LEFT JOIN levels l ON l.author = u.username GROUP BY u.username ORDER BY levels DESC;"
```

## Rate limit

`wrangler.toml` caps creations to **100 per 10 s globally** (the binding's
`period` only allows 10 or 60 s). Adjust `limit`/`period` there and redeploy.
