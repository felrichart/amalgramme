/*
 * Account ↔ device progress sync. Saves merge level by level with the shared
 * "most advanced wins" rule (shared/progress.js), so syncing is silent: it can't
 * lose progress. The one question asked is on sign-in, when this device holds
 * progress from outside the account (played signed out, or by another account)
 * that would change the account's own history — see `prompt`.
 *
 * SYNCED_KEY names the account the device's saves currently mirror. Declining
 * the import stashes the device's saves (STASH_KEY) and restores them on logout.
 */
import { ref } from 'vue';
import { mutate, request } from './api.js';
import { pickSave } from '../../shared/progress.js';
import {
  KEY_PREFIX,
  readJSON,
  writeJSON,
  readRaw,
  writeRaw,
  removeKey,
  isObject,
} from '../utils/storage.js';
import { allSaves, writeSave, clearSaves, onProgressSaved } from '../data/progress.js';
import { connected, username } from '../composables/useAccount.js';

const SYNCED_KEY = KEY_PREFIX + 'syncedUser';
const STASH_KEY = KEY_PREFIX + 'signedOutSaves';
const PUSH_DELAY_MS = 5000;

/* { count, resolve } while asking whether to add this device's progress. */
export const prompt = ref(null);
/* Bumped whenever saves change under the views, so they re-read them. */
export const syncVersion = ref(0);

const dirty = new Set();
let timer = null;

/* Write every account save that beats the device's; true if any changed. */
function applyAccount(saves) {
  const local = allSaves();
  let changed = false;
  for (const [id, save] of Object.entries(saves)) {
    if (pickSave(local[id], save) !== local[id]) {
      writeSave(id, save);
      changed = true;
    }
  }
  if (changed) syncVersion.value++;
}

async function push(saves) {
  if (!Object.keys(saves).length) return true;
  const res = await mutate('/progress', { body: { saves } });
  if (res.ok) applyAccount(res.data);
  return res.ok;
}

async function pull() {
  const res = await mutate('/progress', { method: 'GET' });
  return res.ok && isObject(res.data) ? res.data : null;
}

/* Device saves that would change the account if merged in. */
function aheadOf(account, local) {
  return Object.fromEntries(
    Object.entries(local).filter(([id, s]) => pickSave(account[id], s) !== account[id]),
  );
}

const ask = (count) => new Promise((resolve) => (prompt.value = { count, resolve }));

/* Reconcile right after signing in (or on launch, when already signed in). */
export async function afterSignIn() {
  const account = await pull();
  if (!account) return; // offline: next launch retries
  const local = allSaves();
  const ahead = aheadOf(account, local);
  const mirrored = readRaw(SYNCED_KEY) === username.value;
  const foreign = Object.keys(ahead).length && Object.keys(account).length && !mirrored;

  if (foreign && !(await ask(Object.keys(ahead).length))) {
    // Keep the device's own progress aside; the account's replaces it until logout.
    if (readJSON(STASH_KEY) === null) writeJSON(STASH_KEY, local);
    clearSaves();
    applyAccount(account);
    syncVersion.value++;
  } else {
    applyAccount(account);
    await push(ahead);
  }
  writeRaw(SYNCED_KEY, username.value);
}

export function answerPrompt(add) {
  prompt.value?.resolve(add);
  prompt.value = null;
}

/* Signed out: the device keeps what it has, unless its own saves were stashed. */
export function afterSignOut() {
  clearTimeout(timer);
  dirty.clear();
  removeKey(SYNCED_KEY);
  const stash = readJSON(STASH_KEY, null, isObject);
  if (stash) {
    clearSaves();
    for (const [id, save] of Object.entries(stash)) writeSave(id, save);
    removeKey(STASH_KEY);
    syncVersion.value++;
  }
}

/* Push one level's save right away (server-side gates read it, e.g. comments). */
export async function syncSave(id) {
  const save = allSaves()[id];
  if (!connected.value || !save) return false;
  dirty.delete(id);
  return push({ [id]: save });
}

/* Send pending saves now; `onHide` uses a keepalive request that outlives the page. */
async function flush(onHide = false) {
  clearTimeout(timer);
  if (!connected.value || !dirty.size) return;
  const local = allSaves();
  const saves = Object.fromEntries(
    [...dirty].filter((id) => local[id]).map((id) => [id, local[id]]),
  );
  dirty.clear();
  if (onHide) {
    request('/progress', { method: 'POST', body: { saves }, keepalive: true }).catch(() => {});
  } else if (!(await push(saves))) {
    Object.keys(saves).forEach((id) => dirty.add(id)); // retry with the next change
  }
}

/* Wire autosave pushes; call once at startup. */
export function startSync() {
  onProgressSaved((id) => {
    if (!connected.value) return;
    dirty.add(id);
    clearTimeout(timer);
    timer = setTimeout(flush, PUSH_DELAY_MS);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush(true);
  });
}
