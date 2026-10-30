-- The families of a Dicorama level's list (their bases, JSON), picked by the
-- admin. NULL: its GOAL most common ones (see buildLevel, src/dicorama/game.js).
ALTER TABLE dicorama_levels ADD COLUMN main TEXT;
