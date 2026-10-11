/*
 * Fail-soft localStorage access. Storage may be unavailable (private mode, quota,
 * disabled cookies) or hold corrupt JSON; every helper degrades silently so the
 * game stays playable without persistence.
 */

/* Namespace of every current key, e.g. `amalgramme:v3:level:<date>`. */
export const KEY_PREFIX = 'amalgramme:v3:';

/* Parsed JSON at `key`, or `fallback` when absent, corrupt, or rejected by `valid`. */
export function readJSON(key, fallback = null, valid = (v) => v != null) {
  try {
    const val = JSON.parse(localStorage.getItem(key));
    if (valid(val)) return val;
  } catch {
    // absent or corrupt
  }
  return fallback;
}

export function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or unavailable
  }
}

export function readRaw(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeRaw(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage full or unavailable
  }
}

export function removeKey(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // storage unavailable
  }
}

/* Every stored key starting with `prefix`, snapshotted so callers may mutate storage. */
export function keysWithPrefix(prefix) {
  const keys = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix)) keys.push(k);
    }
  } catch {
    // storage unavailable
  }
  return keys;
}

/* Rename a key, never overwriting an existing value at `to`. */
export function moveKey(from, to) {
  const raw = readRaw(from);
  if (raw === null) return;
  if (readRaw(to) === null) writeRaw(to, raw);
  removeKey(from);
}

/* A plain JSON object (not an array) — the shape of every map-like record. */
export const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
