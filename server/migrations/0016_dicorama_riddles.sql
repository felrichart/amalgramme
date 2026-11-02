-- Dicorama turns to riddles: a few words of each level get a clue (clues: JSON,
-- { typed key: clue }, see buildLevel in src/dicorama/game.js) and the rare
-- families go. The levels before are dropped, to be written again; the picked
-- definitions stay.
DELETE FROM dicorama_levels;
ALTER TABLE dicorama_levels DROP COLUMN rare;
ALTER TABLE dicorama_levels ADD COLUMN clues TEXT NOT NULL DEFAULT '{}';
