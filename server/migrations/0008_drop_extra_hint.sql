-- Drop the "indice supplémentaire" hint column (feature removed): help is now a
-- letter-reveal aid driven entirely client-side, so no server-stored hint remains.
ALTER TABLE levels DROP COLUMN hint;
ALTER TABLE dailies DROP COLUMN hint;
