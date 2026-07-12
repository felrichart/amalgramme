/*
 * Local cache of community levels fetched from the backend, plus the lookups that
 * let the play machinery resolve a community level by id. Levels are cached in
 * localStorage so a reload or a direct /play/com-<id> link resolves synchronously
 * (puzzleForDate reads this cache) before any fresh fetch completes.
 *
 * A cached record is { id, author, secret, words[4], created_at }. Its id, prefixed
 * with "com-", is the puzzle date used in routes and save keys, keeping community
 * progress namespaced away from the ISO-dated dailies.
 */
const CACHE_KEY = 'amalgramme:v3:community';
export const COMMUNITY_PREFIX = 'com-';

/* True for a puzzle date/slug that names a community level. */
export function isCommunityId(id) {
  return typeof id === 'string' && id.startsWith(COMMUNITY_PREFIX);
}

function readCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (raw && Array.isArray(raw.levels)) return raw;
  } catch {
    /* absent or corrupt: treat as empty */
  }
  return { levels: [], fetchedAt: 0 };
}

/* The cached level list (newest first). */
export function getCache() {
  return readCache().levels;
}

/* Epoch ms of the last successful fetch, 0 if never fetched. */
export function cacheFetchedAt() {
  return readCache().fetchedAt;
}

/* Replace the cached list and stamp the fetch time. */
export function setCache(levels, fetchedAt) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ levels, fetchedAt }));
  } catch {
    /* storage unavailable: fall back to network each visit */
  }
}

function bareId(idOrDate) {
  return isCommunityId(idOrDate) ? idOrDate.slice(COMMUNITY_PREFIX.length) : idOrDate;
}

/* Cached record for a slug/date ("com-<id>" or bare "<id>"), or null. */
export function communityRecord(idOrDate) {
  const id = bareId(idOrDate);
  return getCache().find((l) => l.id === id) ?? null;
}

/* Puzzle shape ({date, secret, words}) for a community slug/date, or null. The
 * `date` keeps the com- prefix so its saved progress stays namespaced. */
export function communityPuzzle(idOrDate) {
  const rec = communityRecord(idOrDate);
  if (!rec) return null;
  return { date: COMMUNITY_PREFIX + rec.id, secret: rec.secret, words: rec.words };
}

/* Distinct author names, most-recently-active first. */
export function authors() {
  const newest = new Map();
  for (const l of getCache()) {
    newest.set(l.author, Math.max(l.created_at, newest.get(l.author) ?? 0));
  }
  return [...newest.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
}

/* An author's challenges, newest first, each tagged with its display number
 * (newest is #N, oldest #1). */
export function challengesByAuthor(name) {
  const list = getCache()
    .filter((l) => l.author === name)
    .sort((a, b) => b.created_at - a.created_at);
  return list.map((l, i) => ({ ...l, number: list.length - i }));
}
