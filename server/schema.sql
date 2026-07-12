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
