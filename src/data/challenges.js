/*
 * Puzzle bank access. Each level is a hidden `secret` the player must guess and
 * 4 `words` linked to it. Each word is spelled on its own letter wheel; words
 * may contain a space (two-word answers) — the space is dropped on the wheel but
 * shown as a gap in the answer slots. Secrets and words carry no diacritics
 * (e == e, c == c) so typed accents match after normalisation.
 *
 * `date` (ISO) identifies each puzzle and makes it one day's challenge: they run
 * one per day so the most recent non-future one is today's daily (see todayDate).
 * The date is the puzzle's stable id everywhere — routes, saved progress, links.
 *
 * The bank now lives in D1, edited via the admin dashboard, and reaches here
 * through the local cache in data/dailies.js (warmed at startup in main.js) —
 * seeded originally from the bundled challenges.json (kept as the seed artifact,
 * no longer imported at runtime).
 */
import { getToday } from '../utils/today.js';
import { isCommunityId, communityPuzzle, shortCommunityDate } from './community.js';
import { getDailies, dailyPuzzle } from './dailies.js';

/* The daily bank (records with date/secret/words/attempts/successes), oldest first. */
export function listDailies() {
  return getDailies();
}

/* Date of today's challenge: the most recent puzzle not dated in the future.
 * ISO dates compare lexicographically. Computed lazily (not at import time) so
 * this module stays importable before `resolveToday` and the daily warm-up have
 * run — the first caller with a populated bank resolves it, then it's memoised.
 * Returns null when the bank is empty (a cold client with the Worker down). */
let _today = null;
export function todayDate() {
  if (_today) return _today;
  const list = listDailies();
  if (!list.length) return null;
  const today = getToday();
  let date = list[0].date;
  for (const p of list) if (p.date <= today) date = p.date;
  _today = date;
  return _today;
}

/* Puzzle for a date ("com-…" → a cached community level, else a cached daily),
 * or null if unknown. */
export function puzzleForDate(date) {
  if (isCommunityId(date)) return communityPuzzle(date);
  return dailyPuzzle(date);
}

/* Route slug → puzzle date: "daily" aliases today; a community slug is trimmed to
 * its canonical short id (so legacy full-UUID links resolve to the same progress);
 * any other slug is the date. */
export function dateForSlug(slug) {
  if (slug === 'daily') return todayDate();
  return isCommunityId(slug) ? shortCommunityDate(slug) : slug;
}

/* Puzzle date → route slug: "daily" for today, else the date itself. */
export function slugForDate(date) {
  return date === todayDate() ? 'daily' : date;
}

/* Past challenges (before today), newest first. Each record
 * carries its play stats (attempts/successes) from the cache. */
export function pastChallenges() {
  const today = todayDate();
  if (!today) return [];
  return listDailies()
    .filter((p) => p.date < today)
    .reverse();
}

/* The challenge one day older than `date`, or null at the oldest / for unknowns. */
export function olderDate(date) {
  const list = listDailies();
  const i = list.findIndex((p) => p.date === date);
  return i > 0 ? list[i - 1].date : null;
}

const DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

/* An ISO date as a short French label, e.g. "Sam 11/07". */
export function formatChallengeDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dd = String(d).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return `${DAYS[date.getDay()]} ${dd}/${mm}`;
}
