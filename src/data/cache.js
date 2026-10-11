/*
 * A localStorage-backed copy of a backend list, so lookups resolve synchronously
 * (on a reload or a direct /play link) before any fresh fetch completes.
 */
import { readJSON, writeJSON } from '../utils/storage.js';

export function createCache(key) {
  const read = () => readJSON(key, { levels: [], fetchedAt: 0 }, (v) => Array.isArray(v?.levels));
  return {
    levels: () => read().levels,
    /* Epoch ms of the last successful fetch, 0 if never fetched. */
    fetchedAt: () => read().fetchedAt,
    set: (levels, fetchedAt = Date.now()) => writeJSON(key, { levels, fetchedAt }),
  };
}
