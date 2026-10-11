/*
 * Resolves a puzzle "date" — the stable id used in routes and save keys — to its
 * level: an ISO date names a daily, a "com-<id>" date a community level.
 */
import {
  isCommunityId,
  communityPuzzle,
  communityRecord,
  shortCommunityDate,
} from './community.js';
import { dailyPuzzle, dailyRecord, todayDate } from './dailies.js';

/* Puzzle shape { date, secret, words }, or null if unknown. */
export function puzzleForDate(date) {
  return isCommunityId(date) ? communityPuzzle(date) : dailyPuzzle(date);
}

/* Cached record (with play stats), or null if unknown. */
export function recordForDate(date) {
  return isCommunityId(date) ? communityRecord(date) : dailyRecord(date);
}

/* Route slug → date: "daily" aliases today; community slugs are canonicalised so
 * legacy full-UUID links reach the same progress. */
export function dateForSlug(slug) {
  if (slug === 'daily') return todayDate();
  return isCommunityId(slug) ? shortCommunityDate(slug) : slug;
}

export function slugForDate(date) {
  return date === todayDate() ? 'daily' : date;
}
