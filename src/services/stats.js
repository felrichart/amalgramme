/*
 * Play stats: an 'attempt' (opened) or a 'solve' (completed) per puzzle, counted
 * once per player — the account when signed in (the session rides on the
 * request), else this device's anonymous id. Each is posted at most once per
 * puzzle and kind from this device (the backend dedupes too); a failed post
 * retries next time. Signing in claims the device's anonymous plays.
 */
import { API_URL } from '../config.js';
import { request } from './api.js';
import { KEY_PREFIX, readJSON, writeJSON, readRaw, writeRaw, isObject } from '../utils/storage.js';
import { connected, username } from '../composables/useAccount.js';
import { COMMUNITY_PREFIX } from '../data/community.js';

const CLIENT_KEY = KEY_PREFIX + 'client';
/* { <puzzle date>: { attempt, solve } } already reported by this device. */
const REPORTED_KEY = KEY_PREFIX + 'reported';
/* Pre-0011 map, keyed by the server's id (bare community id or date). */
const LEGACY_REPORTED_KEY = KEY_PREFIX + 'communityReported';
/* Account the device's anonymous plays were last folded into. */
const CLAIMED_KEY = KEY_PREFIX + 'playsClaimedBy';

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

function readReported() {
  const map = readJSON(REPORTED_KEY, null, isObject);
  if (map) return map;
  const legacy = readJSON(LEGACY_REPORTED_KEY, {}, isObject);
  return Object.fromEntries(
    Object.entries(legacy).map(([id, kinds]) => [
      /^\d{4}-\d{2}-\d{2}$/.test(id) ? id : COMMUNITY_PREFIX + id,
      kinds,
    ]),
  );
}

/* Resolves once the post settles (or right away when skipped). */
export async function recordPlay(date, kind) {
  if (!API_URL || readReported()[date]?.[kind]) return;
  const client = clientId();
  if (!client && !connected.value) return;
  try {
    const res = await request(`/plays/${encodeURIComponent(date)}`, {
      method: 'POST',
      body: { client, kind },
      timeout: 5000,
    });
    if (!res.ok) return;
    const map = readReported();
    (map[date] ??= {})[kind] = true;
    writeJSON(REPORTED_KEY, map);
  } catch {
    // offline: left unmarked so it retries next time
  }
}

/* Fold this device's anonymous plays into the signed-in account, once per account. */
export async function claimPlays() {
  const client = clientId();
  if (!API_URL || !connected.value || !client || readRaw(CLAIMED_KEY) === username.value) return;
  try {
    const res = await request('/plays/claim', { method: 'POST', body: { client }, timeout: 5000 });
    if (res.ok) writeRaw(CLAIMED_KEY, username.value);
  } catch {
    // offline: retried at next launch
  }
}

/* Plays made signed out after a claim belong to the device again. */
export function resetClaim() {
  writeRaw(CLAIMED_KEY, '');
}
