-- Optional extra hint word (the "indice supplémentaire"): a fifth, already-solved
-- clue the player can unlock from the secret keyboard when stuck. Nullable so
-- every existing level keeps working and simply shows no lightbulb. Kept out of
-- the buildable-secret rule — it's a free bonus clue, not a feeder wheel.
ALTER TABLE levels ADD COLUMN hint TEXT;
ALTER TABLE dailies ADD COLUMN hint TEXT;
