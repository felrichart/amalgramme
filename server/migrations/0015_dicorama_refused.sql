-- Why each banned spelling of a Dicorama level is banned ({ form: 'conj' |
-- 'invalid' | 'offensive' }, JSON), and the verb forms that fit its pattern
-- (typed keys, JSON): the player's told why they're no answer.
ALTER TABLE dicorama_levels ADD COLUMN reasons TEXT NOT NULL DEFAULT '{}';
ALTER TABLE dicorama_levels ADD COLUMN conjugated TEXT NOT NULL DEFAULT '[]';
