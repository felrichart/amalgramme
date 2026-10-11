/*
 * The signed-in account: a bearer session token plus the public profile the
 * Worker returned ({ username, email, emailVerified, legacy, pinDeadline }).
 * Kept in localStorage so a session survives reloads; the Worker revokes it.
 */
import { ref, computed } from 'vue';
import { ADMIN_NAME } from '../../shared/constants.js';
import { KEY_PREFIX, readJSON, writeJSON, removeKey, isObject } from '../utils/storage.js';

const STORAGE_KEY = KEY_PREFIX + 'session';

const saved = readJSON(STORAGE_KEY, {}, isObject);
const token = ref(typeof saved.token === 'string' ? saved.token : '');
export const user = ref(token.value && isObject(saved.user) ? saved.user : null);

export const username = computed(() => user.value?.username ?? '');
export const connected = computed(() => !!token.value && !!user.value);
export const isAdmin = computed(() => username.value === ADMIN_NAME);
/* A PIN-only account that must add an email + password before its deadline. */
export const needsSecuring = computed(() => !!user.value?.legacy);
export const needsVerification = computed(
  () => !!user.value && !user.value.legacy && !user.value.emailVerified,
);

export const sessionToken = () => token.value;

const persist = () => writeJSON(STORAGE_KEY, { token: token.value, user: user.value });

export function setSession(newToken, profile) {
  token.value = newToken;
  user.value = profile;
  persist();
}

export function updateUser(profile) {
  user.value = { ...user.value, ...profile };
  persist();
}

export function clearSession() {
  token.value = '';
  user.value = null;
  removeKey(STORAGE_KEY);
}
