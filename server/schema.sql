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

-- Player identities: a username claimed by a 4-digit PIN (plaintext by design).
CREATE TABLE IF NOT EXISTS users (
  username TEXT PRIMARY KEY,
  pin TEXT NOT NULL,
  created_at INTEGER NOT NULL
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
