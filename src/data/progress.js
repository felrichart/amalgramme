/*
 * Per-level saved progress, keyed by puzzle date (`amalgramme:v3:level:<date>`) —
 * stable across bank reordering. Written by useGameState, summarised for the
 * level lists.
 */
import { KEY_PREFIX, readJSON, writeJSON, keysWithPrefix, removeKey } from '../utils/storage.js';
import { isSave } from '../../shared/progress.js';

export const LEVEL_PREFIX = KEY_PREFIX + 'level:';

export const levelKey = (date) => LEVEL_PREFIX + date;

export function loadProgress(date) {
  return readJSON(levelKey(date));
}

let onSaved = null;

/* Single listener told of each player-made save (the account sync). */
export function onProgressSaved(fn) {
  onSaved = fn;
}

/* A save made by playing: stamped (the sync's tie-breaker) and announced. */
export function saveProgress(date, data) {
  writeJSON(levelKey(date), { ...data, updatedAt: Date.now() });
  onSaved?.(date);
}

/* Store a save as-is, e.g. one pulled from the account. */
export function writeSave(date, data) {
  writeJSON(levelKey(date), data);
}

/* Every valid save on this device, as { <date>: save }. */
export function allSaves() {
  const saves = {};
  for (const key of keysWithPrefix(LEVEL_PREFIX)) {
    const save = readJSON(key);
    if (isSave(save)) saves[key.slice(LEVEL_PREFIX.length)] = save;
  }
  return saves;
}

export function clearSaves() {
  keysWithPrefix(LEVEL_PREFIX).forEach(removeKey);
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
