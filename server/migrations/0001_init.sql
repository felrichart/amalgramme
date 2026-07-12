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
