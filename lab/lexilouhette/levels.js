/* The lab's levels, the bank's and the official ones, and their saved progress
 * (local only). */
import raw from './levels.json';
import { buildLevel } from './game.js';
import { officialLevel, playableLevels, isAdmin } from './official.js';
import { readJSON, writeJSON, isObject } from '../../src/utils/storage.js';

/* Every level the generator found, `{ pattern, words }`, by length then pattern,
 * built only when played. */
export const BANK = raw;

export function bankLevel(pattern) {
  const l = BANK.find((x) => x.pattern === pattern);
  return l ? buildLevel(l) : null;
}

/* An official level one can play (drafts too for the admin), built. */
export function playableLevel(pattern) {
  const l = officialLevel(pattern);
  return l && (isAdmin || l.status === 'valid') ? buildLevel(l) : null;
}

/* The levels of a list, `'official'` or `'bank'`, as stored. */
export const levelsOf = (source) => (source === 'bank' ? BANK : playableLevels());

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
