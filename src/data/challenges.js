/*
 * Puzzle bank, loaded from challenges.json for easy editing. Each level is a
 * hidden `secret` the player must guess and 4 `words` linked to it. Each word is
 * spelled on its own letter wheel; words may contain a space (two-word answers)
 * — the space is dropped on the wheel but shown as a gap in the answer slots.
 * Secrets and words carry no diacritics (e == e, c == c) so typed accents match
 * after normalisation.
 *
 * `date` (ISO) identifies each puzzle and makes it one day's challenge: they run
 * one per day so the most recent non-future one is today's daily (see todayDate).
 * The date is the puzzle's stable id everywhere — routes, saved progress, links.
 * Keep the array sorted by ascending date; append new puzzles at the end.
 */
import puzzles from './challenges.json';
import { getToday } from '../utils/today.js';
import { isCommunityId, communityPuzzle } from './community.js';

export const PUZZLES = puzzles;

/* The guided tutorial: identified by a slug "date", kept OUT of PUZZLES so it
 * never joins the daily/challenge rotation. */
export const TUTORIAL_DATE = 'tutoriel';
export const TUTORIAL_PUZZLE = {
  date: TUTORIAL_DATE,
  secret: 'soleil',
  words: ['rayon', 'ciel', 'astre', 'chaleur'],
};

/* Date of today's challenge: the most recent puzzle not dated in the future.
 * ISO dates compare lexicographically. Computed lazily (not at import time) so
 * this module stays importable before `resolveToday` has run — the first caller
 * after startup resolves it, then the result is memoised. */
let _today = null;
export function todayDate() {
  if (_today) return _today;
  const today = getToday();
  let date = PUZZLES[0].date;
  for (const p of PUZZLES) if (p.date <= today) date = p.date;
  _today = date;
  return _today;
}

/* Puzzle for a date ("tutoriel" → the tutorial, "com-…" → a cached community
 * level), or null if unknown. */
export function puzzleForDate(date) {
  if (date === TUTORIAL_DATE) return TUTORIAL_PUZZLE;
  if (isCommunityId(date)) return communityPuzzle(date);
  return PUZZLES.find((p) => p.date === date) ?? null;
}

/* Route slug → puzzle date: "daily" aliases today; any other slug is the date. */
export function dateForSlug(slug) {
  return slug === 'daily' ? todayDate() : slug;
}

/* Puzzle date → route slug: "daily" for today, else the date itself. */
export function slugForDate(date) {
  return date === todayDate() ? 'daily' : date;
}

/* Past challenges (before today, tutorial excluded), newest first. */
export function pastChallenges() {
  const today = todayDate();
  return PUZZLES.filter((p) => p.date < today).reverse();
}

/* The challenge one day older than `date`, or null at the oldest / for unknowns. */
export function olderDate(date) {
  const i = PUZZLES.findIndex((p) => p.date === date);
  return i > 0 ? PUZZLES[i - 1].date : null;
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
