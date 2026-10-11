/*
 * Password hashing and opaque tokens, on WebCrypto only (no dependency).
 * PBKDF2-SHA256 at 100k iterations: the most Workers' runtime allows, and native
 * so it fits the free plan's CPU budget. The iteration count is stored in each
 * hash so it can be raised later without invalidating existing ones.
 */
const ITERATIONS = 100_000;
const enc = new TextEncoder();

const b64url = (bytes) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const fromB64url = (s) =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

/* Constant-time: the comparison never short-circuits on the first differing byte. */
function sameBytes(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await pbkdf2(password, salt, ITERATIONS);
  return `pbkdf2-sha256$${ITERATIONS}$${b64url(salt)}$${b64url(hash)}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, iter, salt, hash] = String(stored ?? '').split('$');
  if (scheme !== 'pbkdf2-sha256' || !hash) return false;
  const actual = await pbkdf2(password, fromB64url(salt), Number(iter));
  return sameBytes(actual, fromB64url(hash));
}

/* A fresh bearer/email token, given to the client once and never stored as-is. */
export const newToken = () => b64url(randomBytes(32));

/* What the DB keeps for a token: a leaked table can't be replayed. */
export async function tokenHash(token) {
  return b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(token))));
}
