/* The lab's levels and their saved progress (local only). */
import raw from './levels.json';
import { buildLevel } from './game.js';
import { readJSON, writeJSON, isObject } from '../../src/utils/storage.js';

/* Every level the generator found, `{ pattern, words }`, built only when played. */
export const LEVELS = raw;

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
