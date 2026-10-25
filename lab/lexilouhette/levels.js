/* The lab's levels and their saved progress (local only). */
import raw from './levels.json';
import { BLANK, buildLevel, maxScore } from './game.js';
import { readJSON, writeJSON, isObject } from '../../src/utils/storage.js';

/* A level's rating: harder with more blanks and letters, and more points to win. */
export const difficultyOf = (l) =>
  10 * [...l.pattern].filter((ch) => ch === BLANK).length +
  10 * l.pattern.length +
  Math.round(maxScore(buildLevel(l)) / 1000);

/* Every level the generator found, `{ pattern, words, difficulty }`, easiest
 * first, built only when played. */
export const LEVELS = raw
  .map((l) => ({ ...l, difficulty: difficultyOf(l) }))
  .sort((a, b) => a.difficulty - b.difficulty);

export function levelByPattern(pattern) {
  const l = LEVELS.find((x) => x.pattern === pattern);
  return l ? buildLevel(l) : null;
}

const key = (pattern) => `lexilouhette:v1:level:${pattern}`;

/* `found` lists answer keys, newest first; `revealed` once solutions were shown. */
export function loadProgress(pattern) {
  const p = readJSON(key(pattern), null, isObject);
  return {
    found: Array.isArray(p?.found) ? p.found.filter((k) => typeof k === 'string') : [],
    revealed: p?.revealed === true,
  };
}

export function saveProgress(pattern, progress) {
  writeJSON(key(pattern), progress);
}
