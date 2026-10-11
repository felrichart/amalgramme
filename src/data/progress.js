/*
 * Per-level saved progress, keyed by puzzle date (`amalgramme:v3:level:<date>`) —
 * stable across bank reordering. Written by useGameState, summarised for the
 * level lists.
 */
import { KEY_PREFIX, readJSON, writeJSON, keysWithPrefix } from '../utils/storage.js';

export const LEVEL_PREFIX = KEY_PREFIX + 'level:';

export const levelKey = (date) => LEVEL_PREFIX + date;

export function loadProgress(date) {
  return readJSON(levelKey(date));
}

export function saveProgress(date, data) {
  writeJSON(levelKey(date), data);
}

/* Summary for the level lists; `partial` = started but not finished. */
export function levelProgress(date) {
  const s = loadProgress(date);
  const found = Array.isArray(s?.solved) ? s.solved.filter(Boolean).length : 0;
  const secretFound = !!s?.secretFound;
  const completed = !!s?.completed;
  const typed = (s?.secretEntry ?? s?.secretPicks ?? []).some(Boolean);
  const partial = !completed && (found > 0 || secretFound || typed);
  return { found, secretFound, completed, partial };
}

/* Every started or finished level, as { date, completed }. */
export function savedProgress() {
  return keysWithPrefix(LEVEL_PREFIX)
    .map((k) => k.slice(LEVEL_PREFIX.length))
    .map((date) => ({ date, ...levelProgress(date) }))
    .filter((p) => p.completed || p.partial)
    .map(({ date, completed }) => ({ date, completed }));
}
