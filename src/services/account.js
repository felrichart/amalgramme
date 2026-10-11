/* Account calls: sign-up/in, the legacy PIN path, email verification, password reset. */
import { mutate, OFFLINE } from './api.js';
import { PIN_RE } from '../../shared/constants.js';
import { KEY_PREFIX, readJSON, removeKey } from '../utils/storage.js';
import { setSession, updateUser, clearSession, connected } from '../composables/useAccount.js';
import { afterSignIn, afterSignOut } from './sync.js';
import { claimPlays, resetClaim } from './stats.js';

const MESSAGES = {
  bad_name: 'Nom invalide (20 caractères max, sans / ? # %).',
  bad_email: 'Adresse email invalide.',
  weak_password: 'Mot de passe trop court (8 caractères minimum).',
  name_taken: 'Ce nom est déjà pris.',
  email_taken: 'Cette adresse est déjà utilisée par un autre compte.',
  bad_credentials: 'Identifiants incorrects.',
  legacy: 'Ce compte utilise encore un code PIN : connecte-toi avec ton code.',
  secured: 'Ce compte est sécurisé : connecte-toi avec ton mot de passe.',
  pin_expired: 'Les codes PIN ne sont plus acceptés.',
  bad_token: 'Lien expiré ou déjà utilisé.',
  already_secured: 'Ce compte est déjà sécurisé.',
  rate_limited: 'Trop de tentatives, réessaie dans une minute.',
};

const call = (path, body, fallback = 'Requête refusée.') =>
  mutate(path, { body, messages: MESSAGES, fallback });

/* Store the session the Worker opened, then reconcile progress. */
async function signedIn(res) {
  if (res.ok) {
    setSession(res.data.token, res.data.user);
    resetClaim();
    claimPlays();
    await afterSignIn();
  }
  return res;
}

export const signup = ({ username, email, password }) =>
  call('/auth/signup', { username, email, password }, 'Inscription refusée.').then(signedIn);

/* `login` is a username or an email. */
export const login = ({ login, password }) =>
  call('/auth/login', { login, password }, 'Connexion refusée.').then(signedIn);

export const loginPin = ({ username, pin }) =>
  call('/auth/pin', { username, pin }, 'Connexion refusée.').then(signedIn);

export async function logout() {
  if (connected.value) await mutate('/auth/logout', { body: {} });
  clearSession();
  afterSignOut();
}

export async function secureAccount({ email, password }) {
  const res = await call('/auth/secure', { email, password }, 'Échec de la sécurisation.');
  if (res.ok) updateUser(res.data);
  return res;
}

export async function verifyEmail(token) {
  const res = await call('/auth/verify', { token }, 'Vérification impossible.');
  if (res.ok && connected.value) updateUser({ emailVerified: true });
  return res;
}

export const resendVerification = () => call('/auth/verify/resend', {}, 'Envoi impossible.');

export const forgotPassword = (login) => call('/auth/forgot', { login }, 'Envoi impossible.');

export const resetPassword = ({ token, password }) =>
  call('/auth/reset', { token, password }, 'Réinitialisation impossible.').then(signedIn);

/* Refresh the profile (e.g. email verified from another device). */
export async function refreshUser() {
  if (!connected.value) return;
  const res = await mutate('/auth/me', { method: 'GET' });
  if (res.ok) updateUser(res.data);
}

/*
 * Pre-accounts devices stored { name, pin } and sent it with every write. Trade
 * it for a session once, silently; the old record goes either way unless the
 * server was unreachable (retried next launch).
 */
const LEGACY_KEY = KEY_PREFIX + 'user';

export async function upgradeLegacyIdentity() {
  const saved = readJSON(LEGACY_KEY);
  if (!saved || connected.value) return removeKey(LEGACY_KEY);
  const name = typeof saved === 'string' ? saved : saved.name;
  if (!name || !PIN_RE.test(saved.pin ?? '')) return removeKey(LEGACY_KEY);
  const res = await loginPin({ username: name, pin: saved.pin });
  if (res.ok || res.error !== OFFLINE) removeKey(LEGACY_KEY);
}
