/* Dicorama's levels, the bank's and the official ones, built to play, and their
 * saved progress (on the device only). */
import { buildLevel, progressOf, scoreOf } from './game.js';
import { officialLevel, levelOn } from './store.js';
import { readJSON, writeJSON, isObject } from '../utils/storage.js';

/*
 * Every level the generator found, `{ pattern, words }` (see buildLevel), by
 * length then pattern: the admin's only, so it loads on demand (it weighs
 * megabytes) and `bank()` reads it once loaded.
 */
let loaded = null;
let loading = null;
export function loadBank() {
  loading ??= import('./bank.json').then((m) => (loaded = m.default));
  return loading;
}
export const bank = () => loaded ?? [];

export function bankLevel(pattern) {
  const l = bank().find((x) => x.pattern === pattern);
  return l ? buildLevel(l) : null;
}

/* The level a game route names, built: by `date` for players, by `pattern` for
 * the admin (an official level, else the bank's). */
export function levelFor(source, param) {
  if (source === 'day') {
    const l = levelOn(param);
    return l && { ...buildLevel(l), date: l.date };
  }
  const l = source === 'official' && officialLevel(param);
  if (l) return { ...buildLevel(l), date: l.date };
  return bankLevel(param);
}

const key = (pattern) => `dicorama:v1:level:${pattern}`;

/* `found` lists answer keys, newest first. */
export function loadProgress(pattern) {
  const p = readJSON(key(pattern), null, isObject);
  return { found: Array.isArray(p?.found) ? p.found.filter((k) => typeof k === 'string') : [] };
}

export function saveProgress(pattern, progress) {
  writeJSON(key(pattern), progress);
}

/* What the device won on an official level: its stars and score. */
export function resultOf(l) {
  const p = progressOf(buildLevel(l), loadProgress(l.pattern).found);
  return { stars: p.stars, score: scoreOf(p) };
}
