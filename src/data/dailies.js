/*
 * Local cache of the daily puzzle bank fetched from the backend. Dailies moved
 * out of the bundled challenges.json into D1 so the admin can edit them at
 * runtime; this cache lets puzzleForDate / todayDate resolve synchronously on a
 * reload or a direct /play/<date> link before any fresh fetch completes (the
 * warm-up in main.js populates it at startup).
 *
 * A cached record is { date, secret, words[4], attempts, successes, updated_at }.
 * `date` (ISO) is the stable id used in routes and save keys, exactly as the old
 * bundled bank was. Play stats reuse the community stat client (see community.js
 * clientId/hasReported/markReported) — the date id never collides with a UUID.
 */
const CACHE_KEY = 'amalgramme:v3:dailies';

function readCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (raw && Array.isArray(raw.levels)) return raw;
  } catch {
    /* absent or corrupt: treat as empty */
  }
  return { levels: [], fetchedAt: 0 };
}

/* The cached daily bank, oldest date first. */
export function getDailies() {
  return [...readCache().levels].sort((a, b) => a.date.localeCompare(b.date));
}

/* Epoch ms of the last successful fetch, 0 if never fetched. */
export function cacheFetchedAt() {
  return readCache().fetchedAt;
}

/* Replace the cached bank and stamp the fetch time. */
export function setDailies(levels, fetchedAt) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ levels, fetchedAt }));
  } catch {
    /* storage unavailable: fall back to network each visit */
  }
}

/* Cached record for an ISO date, or null. */
export function dailyRecord(date) {
  return getDailies().find((d) => d.date === date) ?? null;
}

/* Puzzle shape ({date, secret, words}) for a daily date, or null. */
export function dailyPuzzle(date) {
  const rec = dailyRecord(date);
  if (!rec) return null;
  return { date: rec.date, secret: rec.secret, words: rec.words };
}
