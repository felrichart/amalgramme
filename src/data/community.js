/*
 * Local cache of community levels fetched from the backend, plus the lookups that
 * let the play machinery resolve a community level by id. Levels are cached in
 * localStorage so a reload or a direct /play/com-<id> link resolves synchronously
 * (puzzleForDate reads this cache) before any fresh fetch completes.
 *
 * A cached record is { id, author, secret, words[4], created_at }. The id is the
 * first 8 chars of the server's UUID (see COMMUNITY_ID_LENGTH); prefixed with
 * "com-" it is the puzzle date used in routes and save keys, keeping community
 * progress namespaced away from the ISO-dated dailies.
 */
const CACHE_KEY = 'amalgramme:v3:community';
/* Per-author map of the newest level the user has seen (see readSeen). */
const SEEN_KEY = 'amalgramme:v3:communitySeen';
/* Stable anonymous id for this device, so play stats count a player without a
 * sign-in and dedupe repeat opens. */
const CLIENT_KEY = 'amalgramme:v3:client';
/* Which levels this client has already reported ({ <id>: { attempt, solve } }),
 * so we hit the network at most once per kind per level. */
const REPORTED_KEY = 'amalgramme:v3:communityReported';
export const COMMUNITY_PREFIX = 'com-';
/* Community ids are the first 8 chars of a server-minted UUID — short enough to
 * keep routes and localStorage save keys compact. Legacy full-UUID ids are
 * collapsed onto this length everywhere below, so old links and saves keep
 * resolving to the same record and progress. */
export const COMMUNITY_ID_LENGTH = 8;

function trimId(id) {
  return String(id).slice(0, COMMUNITY_ID_LENGTH);
}

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

/* The cached level list (newest first), each id trimmed to its canonical length
 * so a cache written before ids were shortened still yields the short id. */
export function getCache() {
  return readCache().levels.map((l) => ({ ...l, id: trimId(l.id) }));
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

/* Bare, canonical-length community id from a "com-<id>" date or a bare id; trims
 * a legacy full UUID to its short form. Community-space callers only. */
function bareId(idOrDate) {
  const bare = isCommunityId(idOrDate) ? idOrDate.slice(COMMUNITY_PREFIX.length) : idOrDate;
  return trimId(bare);
}

/* First-8 canonical bare id from a bare or "com-"-prefixed id (accepts a legacy
 * full UUID). Used where a raw id, not a date, is needed (e.g. edit routes). */
export function shortCommunityId(idOrDate) {
  return bareId(idOrDate);
}

/* Canonical "com-<id>" date for a community slug/date, collapsing a legacy
 * full-UUID id onto its short form so old /play/com-<uuid> links resolve to the
 * same puzzle and saved progress as the short id. */
export function shortCommunityDate(idOrDate) {
  return COMMUNITY_PREFIX + bareId(idOrDate);
}

/* This device's anonymous id, minted (and persisted) on first use. Null only
 * when both crypto and localStorage are unavailable, disabling stat reporting. */
export function clientId() {
  try {
    let id = localStorage.getItem(CLIENT_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(CLIENT_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

function readReported() {
  try {
    const val = JSON.parse(localStorage.getItem(REPORTED_KEY));
    if (val && typeof val === 'object' && !Array.isArray(val)) return val;
  } catch {
    /* absent or corrupt: nothing reported yet */
  }
  return {};
}

/* Whether this client already reported `kind` ('attempt'|'solve') for a level. */
export function hasReported(idOrDate, kind) {
  return !!readReported()[bareId(idOrDate)]?.[kind];
}

/* Remember that this client reported `kind` for a level, so we don't re-post. */
export function markReported(idOrDate, kind) {
  const map = readReported();
  (map[bareId(idOrDate)] ??= {})[kind] = true;
  try {
    localStorage.setItem(REPORTED_KEY, JSON.stringify(map));
  } catch {
    /* storage unavailable: we may re-post, but the backend dedupes by client */
  }
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

/* Map of author name → their newest level's created_at (epoch ms). */
export function newestByAuthor() {
  const newest = new Map();
  for (const l of getCache()) {
    newest.set(l.author, Math.max(l.created_at, newest.get(l.author) ?? 0));
  }
  return newest;
}

/* Distinct author names, most-recently-active first. */
export function authors() {
  return [...newestByAuthor().entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
}

/* Per-author "seen" stamps: { <author>: <epoch ms of their newest seen level> }.
 * A missing map (null) means the user has never visited the community section —
 * we show no badges until a baseline is set, so a first-timer isn't flooded. */
function readSeen() {
  try {
    const val = JSON.parse(localStorage.getItem(SEEN_KEY));
    if (val && typeof val === 'object' && !Array.isArray(val)) return val;
  } catch {
    /* absent, corrupt, or a legacy value: treat as no baseline */
  }
  return null;
}

function writeSeen(map) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(map));
  } catch {
    /* storage unavailable: badges simply keep showing */
  }
}

/* Whether a baseline has been recorded (the user has opened the list at least once). */
export function hasCommunitySeen() {
  return readSeen() !== null;
}

/* First-visit baseline: mark every current author seen up to their newest level,
 * so nothing shows as new. No-op once a baseline exists. */
export function initCommunitySeen() {
  if (hasCommunitySeen()) return;
  writeSeen(Object.fromEntries(newestByAuthor()));
}

/* Mark one author's levels seen up to `ts` (defaults to their newest). */
export function markAuthorSeen(name, ts) {
  const map = readSeen() ?? {};
  map[name] = ts ?? newestByAuthor().get(name) ?? 0;
  writeSeen(map);
}

/* True when `name` has a level newer than the user last saw for them. A brand-new
 * author (absent from the map) counts as new; no baseline at all → false. */
export function isAuthorNew(name) {
  const seen = readSeen();
  if (!seen) return false;
  return (newestByAuthor().get(name) ?? 0) > (seen[name] ?? 0);
}

/* True when any author has new levels — drives the menu badge. */
export function hasNewCommunityLevels() {
  return hasCommunitySeen() && authors().some(isAuthorNew);
}

/* An author's challenges, newest first, each tagged with its display number
 * (newest is #N, oldest #1). */
export function challengesByAuthor(name) {
  const list = getCache()
    .filter((l) => l.author === name)
    .sort((a, b) => b.created_at - a.created_at);
  return list.map((l, i) => ({ ...l, number: list.length - i }));
}
