/*
 * Community levels, cached from the backend. A record is
 * { id, author, secret, words[4], created_at, attempts, successes }.
 *
 * A level has one identity in two forms: its bare id (the server's `levels.id`,
 * e.g. "550e8400") and, as a puzzle date / route slug, that id under a "com-"
 * prefix ("com-550e8400"), namespacing it from the ISO-dated dailies. Legacy
 * full-UUID ids are collapsed onto LEVEL_ID_LENGTH so old links and saves still
 * resolve to the same record and progress.
 */
import { LEVEL_ID_LENGTH } from '../../shared/constants.js';
import { KEY_PREFIX, readJSON, writeJSON, isObject } from '../utils/storage.js';
import { createCache } from './cache.js';

export const COMMUNITY_PREFIX = 'com-';

export const communityCache = createCache(KEY_PREFIX + 'community');

/* Per-author map of the newest level the user has seen (see isAuthorNew). */
const SEEN_KEY = KEY_PREFIX + 'communitySeen';

export function isCommunityId(id) {
  return typeof id === 'string' && id.startsWith(COMMUNITY_PREFIX);
}

/* Collapse an id of any length to its canonical length. */
export function trimId(id) {
  return String(id).slice(0, LEVEL_ID_LENGTH);
}

/* Canonical bare id from a bare, "com-"-prefixed, or legacy full-UUID id. */
export function shortCommunityId(idOrDate) {
  return trimId(isCommunityId(idOrDate) ? idOrDate.slice(COMMUNITY_PREFIX.length) : idOrDate);
}

/* Canonical "com-<id>" puzzle date / route slug. */
export function shortCommunityDate(idOrDate) {
  return COMMUNITY_PREFIX + shortCommunityId(idOrDate);
}

/* The cached levels (newest first), ids trimmed in case the cache predates short ids. */
export function getCache() {
  return communityCache.levels().map((l) => ({ ...l, id: trimId(l.id) }));
}

export function setCache(levels, fetchedAt) {
  communityCache.set(levels, fetchedAt);
}

export function communityRecord(idOrDate) {
  const id = shortCommunityId(idOrDate);
  return getCache().find((l) => l.id === id) ?? null;
}

/* Puzzle shape; `date` keeps the prefix so saved progress stays namespaced. */
export function communityPuzzle(idOrDate) {
  const rec = communityRecord(idOrDate);
  return rec && { date: COMMUNITY_PREFIX + rec.id, secret: rec.secret, words: rec.words };
}

/* Author name → their newest level's created_at. */
function newestByAuthor() {
  const newest = new Map();
  for (const l of getCache()) {
    newest.set(l.author, Math.max(l.created_at, newest.get(l.author) ?? 0));
  }
  return newest;
}

/* Distinct author names, most recently active first. */
export function authors() {
  return [...newestByAuthor().entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
}

/* An author's levels, newest first, each tagged with its display number (oldest is #1). */
export function challengesByAuthor(name) {
  const list = getCache()
    .filter((l) => l.author === name)
    .sort((a, b) => b.created_at - a.created_at);
  return list.map((l, i) => ({ ...l, number: list.length - i }));
}

/* A level's display number and the next (older) level by the same author, if any. */
export function authorPosition(rec) {
  const list = challengesByAuthor(rec.author);
  const i = list.findIndex((c) => c.id === rec.id);
  return { number: list[i]?.number ?? null, next: i >= 0 ? (list[i + 1] ?? null) : null };
}

/* "Seen" stamps: { <author>: <created_at of their newest seen level> }. Null until
 * the user first opens the community list, so a first-timer isn't flooded with badges. */
const readSeen = () => readJSON(SEEN_KEY, null, isObject);

/* First-visit baseline: everything current counts as seen. No-op once set. */
export function initCommunitySeen() {
  if (readSeen() === null) writeJSON(SEEN_KEY, Object.fromEntries(newestByAuthor()));
}

export function markAuthorSeen(name) {
  writeJSON(SEEN_KEY, { ...readSeen(), [name]: newestByAuthor().get(name) ?? 0 });
}

/* True when `name` has a level newer than last seen (a brand-new author counts). */
export function isAuthorNew(name) {
  const seen = readSeen();
  return !!seen && (newestByAuthor().get(name) ?? 0) > (seen[name] ?? 0);
}

export function hasNewCommunityLevels() {
  return authors().some(isAuthorNew);
}
