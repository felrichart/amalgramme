-- Stats rework. level_stats mixed bare community ids with daily dates, counted
-- devices rather than players, kept rows of deleted puzzles, and was re-aggregated
-- on every list. Now:
--   plays         one row per (puzzle, player); puzzle_id is the progress key
--                 (ISO date or "com-<id>"), player is "u:<username>" when signed in
--                 or "c:<device uuid>" otherwise (claimed into the account at sign-in)
--   puzzle_stats  running attempts/successes per puzzle, updated on each write
CREATE TABLE IF NOT EXISTS plays (
  puzzle_id TEXT NOT NULL,
  player TEXT NOT NULL,
  solved INTEGER NOT NULL DEFAULT 0,
  started_at INTEGER NOT NULL,
  solved_at INTEGER,
  PRIMARY KEY (puzzle_id, player)
);
CREATE INDEX IF NOT EXISTS idx_plays_player ON plays (player);

CREATE TABLE IF NOT EXISTS puzzle_stats (
  puzzle_id TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  successes INTEGER NOT NULL DEFAULT 0
);

-- Carry over rows of puzzles that still exist; orphans are left behind.
INSERT INTO plays (puzzle_id, player, solved, started_at, solved_at)
  SELECT 'com-' || level_id, 'c:' || client_id, solved, updated_at,
         CASE WHEN solved = 1 THEN updated_at END
  FROM level_stats WHERE level_id IN (SELECT id FROM levels);
INSERT INTO plays (puzzle_id, player, solved, started_at, solved_at)
  SELECT level_id, 'c:' || client_id, solved, updated_at,
         CASE WHEN solved = 1 THEN updated_at END
  FROM level_stats WHERE level_id IN (SELECT date FROM dailies);

INSERT INTO puzzle_stats (puzzle_id, attempts, successes)
  SELECT puzzle_id, COUNT(*), SUM(solved) FROM plays GROUP BY puzzle_id;

-- Kept for a manual check; drop once satisfied: DROP TABLE level_stats_legacy;
ALTER TABLE level_stats RENAME TO level_stats_legacy;
DROP INDEX IF EXISTS idx_level_stats_level;
