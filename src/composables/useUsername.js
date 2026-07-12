import { ref, computed } from 'vue';

/*
 * Player identity: a display name plus a PIN that claims/locks that name on the
 * backend so only its holder can create, edit or delete under it. Persisted in
 * localStorage as JSON { name, pin }. Plaintext by design — the PIN is a casual
 * ownership check, NOT a password (a warning says so in the UI). Empty by default.
 */
const STORAGE_KEY = 'amalgramme:v3:user';

/* The one privileged name: may edit/delete any community level (enforced
 * server-side too). Not secure — a casual moderation hook, by design. */
export const ADMIN_NAME = 'cara+';

/* A PIN is exactly 4 digits. */
export const PIN_RE = /^\d{4}$/;
export function pinValid(pin) {
  return PIN_RE.test(pin ?? '');
}

function loadIdentity() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return { name: '', pin: '' };
    const parsed = JSON.parse(raw);
    /* Legacy value was a bare name string (pre-PIN). */
    if (typeof parsed === 'string') return { name: parsed, pin: '' };
    return { name: parsed?.name ?? '', pin: parsed?.pin ?? '' };
  } catch {
    return { name: '', pin: '' };
  }
}

const initial = loadIdentity();
export const username = ref(initial.name);
export const pin = ref(initial.pin);

/* True while signed in as the moderator account. */
export const isAdmin = computed(() => username.value === ADMIN_NAME);

/* Signed in = a name with a valid PIN. */
export const connected = computed(() => !!username.value && pinValid(pin.value));

/* Set and persist the identity; trims the name. */
export function setIdentity(name, code) {
  username.value = (name ?? '').trim();
  pin.value = (code ?? '').trim();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ name: username.value, pin: pin.value }));
  } catch {
    /* storage unavailable: identity lives for this session only */
  }
}

/* Sign out: forget the stored identity. */
export function clearIdentity() {
  username.value = '';
  pin.value = '';
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable: nothing to clear */
  }
}
