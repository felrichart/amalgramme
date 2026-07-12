-- Daily challenges, moved out of the bundled challenges.json so the admin can
-- edit them at runtime. Keyed by ISO date (yyyy-mm-dd) — the stable id used in
-- routes and save keys, exactly like the old bank. Play stats reuse level_stats
-- (keyed by this date, which never collides with the community UUIDs).
CREATE TABLE IF NOT EXISTS dailies (
  date TEXT PRIMARY KEY,     -- ISO yyyy-mm-dd
  secret TEXT NOT NULL,
  words TEXT NOT NULL,       -- JSON array of 4 index words
  updated_at INTEGER NOT NULL
);
