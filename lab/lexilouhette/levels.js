/* The lab's levels and their saved progress (local only). */
import raw from './levels.json';
import { buildLevel } from './game.js';
import { readJSON, writeJSON, isObject } from '../../src/utils/storage.js';

export const LEVELS = raw.map(buildLevel);

export const levelByDate = (date) => LEVELS.find((l) => l.date === date) ?? null;

const key = (date) => `lexilouhette:v1:level:${date}`;

/* `found` lists answer keys, newest first; `revealed` once solutions were shown. */
export function loadProgress(date) {
  const p = readJSON(key(date), null, isObject);
  return {
    found: Array.isArray(p?.found) ? p.found.filter((k) => typeof k === 'string') : [],
    revealed: p?.revealed === true,
  };
}

export function saveProgress(date, progress) {
  writeJSON(key(date), progress);
}
