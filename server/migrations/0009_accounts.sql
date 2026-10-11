-- Real accounts: email + hashed password, server sessions, synced progress.
-- Existing PIN-only users are kept (pin set, password_hash NULL) until
-- PIN_DEADLINE (shared/constants.js), after which the Worker deletes them.
-- SQLite can't relax `pin NOT NULL` in place, hence the table rebuild.
CREATE TABLE users_new (
  username TEXT PRIMARY KEY,
  pin TEXT,                          -- legacy 4-digit code, NULL once secured
  email TEXT COLLATE NOCASE UNIQUE,
  email_verified INTEGER NOT NULL DEFAULT 0,
  password_hash TEXT,                -- pbkdf2-sha256$<iterations>$<salt>$<hash>
  created_at INTEGER NOT NULL
);
INSERT INTO users_new (username, pin, created_at) SELECT username, pin, created_at FROM users;
DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

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
