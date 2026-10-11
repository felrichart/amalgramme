-- Level comments: one per (puzzle, account), readable and writable only by
-- accounts whose synced progress has that puzzle completed. level_id uses the
-- progress key: a daily's ISO date or "com-<id>" for a community level.
CREATE TABLE IF NOT EXISTS comments (
  level_id TEXT NOT NULL,
  username TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (level_id, username)
);
