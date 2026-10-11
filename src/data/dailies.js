/*
 * The daily puzzle bank, cached from the backend (warmed at startup in main.js).
 * A record is { date, secret, words[4], attempts, successes, updated_at }; its ISO
 * `date` is the stable id used in routes and save keys. One daily per day: the most
 * recent non-future one is today's.
 */
import { KEY_PREFIX } from '../utils/storage.js';
import { getToday } from '../utils/today.js';
import { createCache } from './cache.js';

export const dailyCache = createCache(KEY_PREFIX + 'dailies');

/* The bank, oldest first. */
export function getDailies() {
  return [...dailyCache.levels()].sort((a, b) => a.date.localeCompare(b.date));
}

export function setDailies(levels, fetchedAt) {
  dailyCache.set(levels, fetchedAt);
}

export function dailyRecord(date) {
  return getDailies().find((d) => d.date === date) ?? null;
}

export function dailyPuzzle(date) {
  const rec = dailyRecord(date);
  return rec && { date: rec.date, secret: rec.secret, words: rec.words };
}

/* Date of today's daily: the latest one not in the future, or null for an empty
 * bank. Memoised once resolved, so it stays stable for the session. */
let today = null;
export function todayDate() {
  if (today) return today;
  const list = getDailies();
  if (!list.length) return null;
  const now = getToday();
  today = list.reduce((date, p) => (p.date <= now ? p.date : date), list[0].date);
  return today;
}

/* Dailies before today, newest first. */
export function pastChallenges() {
  const today = todayDate();
  if (!today) return [];
  return getDailies()
    .filter((p) => p.date < today)
    .reverse();
}

/* The daily one day older than `date`, or null at the oldest / for unknowns. */
export function olderDate(date) {
  const list = getDailies();
  const i = list.findIndex((p) => p.date === date);
  return i > 0 ? list[i - 1].date : null;
}
