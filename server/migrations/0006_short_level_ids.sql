-- Shorten community level ids to the first 8 chars (UUIDs were needlessly long in
-- routes and localStorage save keys — kept in sync with COMMUNITY_ID_LENGTH in
-- src/data/community.js). Re-key the stats' foreign key first, while levels still
-- hold the full id, so the two stay linked. Daily-date stats (level_id is an ISO
-- date, absent from levels) are untouched.
UPDATE level_stats
  SET level_id = substr(level_id, 1, 8)
  WHERE level_id IN (SELECT id FROM levels);

UPDATE levels SET id = substr(id, 1, 8);
