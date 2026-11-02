/* Dicorama's levels, the bank's and the official ones, built to play, and their
 * saved progress (on the device only). */
import { buildLevel, progressOf, defaultClues, keyOf } from './game.js';
// A URL, not a module: fetched and parsed as JSON, far faster than megabytes of JS.
import bankUrl from './bank.json?url';
import { officialLevel, levelOn } from './store.js';
import { readJSON, writeJSON, isObject, keysWithPrefix, removeKey } from '../utils/storage.js';

/*
 * Every level the generator found, `{ pattern, words, conjugated }` (see buildLevel), by
 * length then pattern: the admin's only, so it loads on demand (it weighs
 * megabytes) and `bank()` reads it once loaded.
 */
let loaded = null;
let loading = null;
export function loadBank() {
  loading ??= fetch(bankUrl)
    .then((res) => {
      if (!res.ok) throw new Error(`bank: ${res.status}`);
      return res.json();
    })
    .then((levels) => (loaded = levels))
    .catch((err) => {
      // Tried again on the next visit.
      loading = null;
      throw err;
    });
  return loading;
}
export const bank = () => loaded ?? [];

/*
 * The bank's search index, built once: each level's word count (`sizes`, by
 * bank index) and the levels holding each typed word or base (`byKey`, by key).
 */
let index = null;
export function bankIndex() {
  if (index || !loaded) return index;
  const byKey = new Map();
  const add = (key, i) => {
    const at = byKey.get(key);
    if (!at) byKey.set(key, [i]);
    else if (at.at(-1) !== i) at.push(i);
  };
  const sizes = loaded.map((l, i) => {
    const words = new Set();
    for (const [form, , , , base = form] of l.words) {
      const key = keyOf(form);
      words.add(key);
      add(key, i);
      if (base !== form) add(keyOf(base), i);
    }
    return words.size;
  });
  return (index = { sizes, byKey });
}

/* A bank level, built with its default riddles, unclued. */
export function bankLevel(pattern) {
  const l = bank().find((x) => x.pattern === pattern);
  return l ? withRiddles(l) : null;
}
export const withRiddles = (l) => buildLevel({ ...l, clues: defaultClues(l) });

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

export const progressKey = (pattern) => `dicorama:v2:level:${pattern}`;
// The saves of the levels before riddles: those levels are gone.
keysWithPrefix('dicorama:v1:level:').forEach(removeKey);

/* `found` lists answer keys, newest first. */
export function loadProgress(pattern) {
  const p = readJSON(progressKey(pattern), null, isObject);
  return { found: Array.isArray(p?.found) ? p.found.filter((k) => typeof k === 'string') : [] };
}

export function saveProgress(pattern, progress) {
  writeJSON(progressKey(pattern), progress);
}

/* Where the device stands on an official level (see progressOf). */
export const resultOf = (l) => progressOf(buildLevel(l), loadProgress(l.pattern).found);
