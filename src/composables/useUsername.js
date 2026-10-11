/*
 * Player identity: a display name plus a PIN that claims it on the backend, so only
 * its holder can create or delete under it. Stored in plaintext by design — the
 * PIN is a casual ownership check, not a password (the UI says so).
 */
import { ref, computed } from 'vue';
import { ADMIN_NAME, pinValid } from '../../shared/constants.js';
import { KEY_PREFIX, readJSON, writeJSON, removeKey } from '../utils/storage.js';

const STORAGE_KEY = KEY_PREFIX + 'user';

function loadIdentity() {
  const saved = readJSON(STORAGE_KEY);
  // Legacy value was a bare name string (pre-PIN).
  if (typeof saved === 'string') return { name: saved, pin: '' };
  return { name: saved?.name ?? '', pin: saved?.pin ?? '' };
}

const initial = loadIdentity();
export const username = ref(initial.name);
export const pin = ref(initial.pin);

export const isAdmin = computed(() => username.value === ADMIN_NAME);
export const connected = computed(() => !!username.value && pinValid(pin.value));

/* { author, pin } as the backend's authenticated calls expect. */
export const credentials = () => ({ author: username.value, pin: pin.value });

export function setIdentity(name, code) {
  username.value = (name ?? '').trim();
  pin.value = (code ?? '').trim();
  writeJSON(STORAGE_KEY, { name: username.value, pin: pin.value });
}

export function clearIdentity() {
  username.value = '';
  pin.value = '';
  removeKey(STORAGE_KEY);
}
