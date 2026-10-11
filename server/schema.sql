-- Full current schema, for reference only. Apply changes via D1 migrations
-- (the migrations/ folder + `wrangler d1 migrations apply`), not this file.

-- Community levels.
CREATE TABLE IF NOT EXISTS levels (
  id TEXT PRIMARY KEY,
  author TEXT NOT NULL,
  secret TEXT NOT NULL,
  words TEXT NOT NULL,       -- JSON array of 4 index words
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_levels_created ON levels (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_levels_author ON levels (author);

-- Accounts. Legacy PIN-only rows (pin set, password_hash NULL) live until
-- PIN_DEADLINE (shared/constants.js), then the daily cron deletes them.
CREATE TABLE IF NOT EXISTS users (
  username TEXT PRIMARY KEY,
  pin TEXT,                          -- legacy 4-digit code, NULL once secured
  email TEXT COLLATE NOCASE UNIQUE,
  email_verified INTEGER NOT NULL DEFAULT 0,
  password_hash TEXT,                -- pbkdf2-sha256$<iterations>$<salt>$<hash>
  created_at INTEGER NOT NULL
);

-- Bearer sessions; only the SHA-256 of the token is stored.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (username);

-- One-shot email links (kind = 'verify' | 'reset'); token hashed like sessions.
CREATE TABLE IF NOT EXISTS email_tokens (
  token_hash TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  kind TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_email_tokens_user ON email_tokens (username, kind);

-- Per-account saved progress: one JSON save per (user, puzzle date).
CREATE TABLE IF NOT EXISTS progress (
  username TEXT NOT NULL,
  level_id TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (username, level_id)
);

-- Daily challenges, keyed by ISO date (edited at runtime via the admin dashboard).
CREATE TABLE IF NOT EXISTS dailies (
  date TEXT PRIMARY KEY,
  secret TEXT NOT NULL,
  words TEXT NOT NULL,       -- JSON array of 4 index words
  updated_at INTEGER NOT NULL
);

-- Per-puzzle play stats: one row per (puzzle, anonymous client). solved flips 0→1
-- on completion. attempts = row count, successes = SUM(solved) per puzzle. level_id
-- is a community level id or a daily's ISO date (the two id spaces never collide).
CREATE TABLE IF NOT EXISTS level_stats (
  level_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  solved INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (level_id, client_id)
);
CREATE INDEX IF NOT EXISTS idx_level_stats_level ON level_stats (level_id);

-- Level comments: one per (puzzle, account), gated on the account's synced
-- progress showing the puzzle completed. level_id = progress key (date or com-<id>).
CREATE TABLE IF NOT EXISTS comments (
  level_id TEXT NOT NULL,
  username TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (level_id, username)
);
