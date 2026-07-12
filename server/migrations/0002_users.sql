-- Player identities: a username claimed by a 4-digit PIN. Plaintext by design
-- (a casual ownership check, not a password). Used to authorise create/edit/delete.
CREATE TABLE IF NOT EXISTS users (
  username TEXT PRIMARY KEY,
  pin TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
