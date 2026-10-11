/*
 * Anonymous play stats: an 'attempt' (opened) or a 'solve' (completed) per level,
 * counted per device without sign-in. Each is posted at most once per level and
 * kind (the backend also dedupes by client); a failed post retries next time.
 */
import { API_URL } from '../config.js';
import { request } from './api.js';
import { KEY_PREFIX, readJSON, writeJSON, isObject } from '../utils/storage.js';
import { isCommunityId, shortCommunityId } from '../data/community.js';

const CLIENT_KEY = KEY_PREFIX + 'client';
/* { <level id>: { attempt, solve } } already reported by this device. */
const REPORTED_KEY = KEY_PREFIX + 'communityReported';

/* This device's anonymous id, minted on first use; null when crypto or storage fails. */
function clientId() {
  try {
    let id = localStorage.getItem(CLIENT_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(CLIENT_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

/* The server's level_id: a community level's bare id, or a daily's ISO date. */
const levelId = (date) => (isCommunityId(date) ? shortCommunityId(date) : date);

const readReported = () => readJSON(REPORTED_KEY, {}, isObject);

/* Resolves once the post settles (or right away when skipped). */
export async function recordPlay(date, kind) {
  const id = levelId(date);
  if (!API_URL || readReported()[id]?.[kind]) return;
  const client = clientId();
  if (!client) return;
  const base = isCommunityId(date) ? '/levels' : '/dailies';
  try {
    const res = await request(`${base}/${id}/${kind}`, {
      method: 'POST',
      body: { client },
      timeout: 5000,
    });
    if (!res.ok) return;
    const map = readReported();
    (map[id] ??= {})[kind] = true;
    writeJSON(REPORTED_KEY, map);
  } catch {
    // offline: left unmarked so it retries next time
  }
}
