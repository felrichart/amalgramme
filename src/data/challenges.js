/*
 * Puzzle bank, loaded from challenges.json for easy editing. Each level is a
 * hidden `secret` the player must guess and 4 `words` linked to it. Each word is
 * spelled on its own letter wheel; words may contain a space (two-word answers)
 * — the space is dropped on the wheel but shown as a gap in the answer slots.
 * Secrets and words carry no diacritics (e == e, c == c) so typed accents match
 * after normalisation.
 *
 * `date` (ISO) makes each puzzle one day's challenge: they run one per day so
 * the last is today's daily challenge (see DAILY_INDEX). Keep the array sorted
 * by ascending date; append new puzzles at the end.
 */
import puzzles from './challenges.json';
import { getToday } from '../utils/today.js';

export const PUZZLES_NEW = puzzles;

/* Slug of the guided tutorial (not a dated daily challenge). */
export const TUTORIAL_SLUG = 'tutoriel';

/* The tutorial puzzle, kept OUT of PUZZLES_NEW on purpose: sitting in the array
 * would shift every daily/challenge index (and thus their saved progress) by
 * one. Its level id is the slug string, distinct from the numeric puzzle
 * indices and from -1 (indexForSlug's "unknown"). */
export const TUTORIAL_INDEX = TUTORIAL_SLUG;
export const TUTORIAL_PUZZLE = {
  date: TUTORIAL_SLUG,
  secret: 'soleil',
  words: ['rayon', 'ciel', 'astre', 'chaleur'],
};

/* Today's challenge: the most recent puzzle not dated in the future. ISO dates
 * compare lexicographically, so a string compare orders them correctly.
 * `getToday()` must be resolved (see resolveToday) before this module loads. */
export const DAILY_INDEX = (() => {
  const today = getToday();
  let idx = 0;
  for (let i = 0; i < PUZZLES_NEW.length; i++) {
    if (PUZZLES_NEW[i].date <= today) idx = i;
  }
  return idx;
})();

/* Route slug for a puzzle index: "daily" for today, else its ISO date. */
export function slugForIndex(i) {
  if (i === TUTORIAL_INDEX) return TUTORIAL_SLUG;
  return i === DAILY_INDEX ? 'daily' : PUZZLES_NEW[i]?.date;
}

/* Resolve a route slug ("daily", "tutoriel", or an ISO date) to a level id, or -1. */
export function indexForSlug(slug) {
  if (slug === 'daily') return DAILY_INDEX;
  if (slug === TUTORIAL_SLUG) return TUTORIAL_INDEX;
  return PUZZLES_NEW.findIndex((p) => p.date === slug);
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
