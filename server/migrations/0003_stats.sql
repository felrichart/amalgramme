-- Per-level play stats. One row per (level, anonymous client): a client is
-- recorded on first open (solved = 0) and flipped to 1 when the level is
-- completed. The client id is a random uuid kept in the player's localStorage,
-- so attempts are counted without requiring a signed-in identity. Attempts and
-- successes are the row count and the sum of `solved` per level.
CREATE TABLE IF NOT EXISTS level_stats (
  level_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  solved INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (level_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_level_stats_level ON level_stats (level_id);
