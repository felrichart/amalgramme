/*
 * Network layer over the Cloudflare Worker (shared by dailies, community levels,
 * auth and stats). Fail-soft: reads fall back to the local caches, writes resolve
 * to { ok: false, error } with a French message — nothing ever throws.
 */
import { API_URL, CACHE_MS } from '../config.js';
import { sessionToken, clearSession } from '../composables/useAccount.js';

export const OFFLINE = 'Connexion impossible, réessaie plus tard.';

/* Messages for the Worker's error codes; callers may override per call. */
const MESSAGES = {
  unauthorized: 'Session expirée, reconnecte-toi.',
  forbidden: 'Action non autorisée pour ce compte.',
  rate_limited: 'Trop de requêtes, réessaie dans un instant.',
};

/* Sends the session token when signed in. `keepalive` lets a request outlive the
 * page (flushing progress on hide). */
export async function request(path, { method = 'GET', body, timeout = 8000, keepalive } = {}) {
  const token = sessionToken();
  const headers = {};
  if (body) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(API_URL + path, {
    method,
    headers,
    body: body && JSON.stringify(body),
    keepalive,
    signal: keepalive ? undefined : AbortSignal.timeout(timeout),
  });
  // The Worker no longer knows this session (revoked, expired, PIN deadline).
  if (res.status === 401 && token && token === sessionToken()) {
    const code = await res
      .clone()
      .json()
      .then((b) => b.error)
      .catch(() => '');
    if (code === 'unauthorized') clearSession();
  }
  return res;
}

async function errorCode(res) {
  if (res.status === 429) return 'rate_limited';
  try {
    return (await res.json()).error;
  } catch {
    return '';
  }
}

/*
 * A write call: { ok: true, data } with the parsed response, or { ok: false, error }.
 * `messages` maps error codes to text; `fallback` covers anything else.
 */
export async function mutate(path, { method = 'POST', body, timeout, messages = {}, fallback }) {
  if (!API_URL) return { ok: false, error: 'Serveur non configuré.' };
  try {
    const res = await request(path, { method, body, timeout });
    if (!res.ok) {
      const code = await errorCode(res);
      return { ok: false, error: messages[code] ?? MESSAGES[code] ?? fallback };
    }
    const data = await res.json();
    // Dev Worker (MAIL_MODE=log): the email it would have sent.
    if (import.meta.env.DEV && data?.devMail) console.info('[dev mail]', data.devMail);
    return { ok: true, data };
  } catch {
    return { ok: false, error: OFFLINE };
  }
}

/*
 * Refresh `cache` (see data/cache.js) from `path` when older than `maxAgeMs`
 * (0 forces a fetch). Every request counts toward the Worker's free-tier quota,
 * hence the cache window.
 */
export async function refresh(cache, path, maxAgeMs = CACHE_MS) {
  if (!API_URL) return;
  if (maxAgeMs > 0 && Date.now() - cache.fetchedAt() < maxAgeMs) return;
  try {
    const res = await request(path, { timeout: 5000 });
    if (!res.ok) return;
    const levels = await res.json();
    if (Array.isArray(levels)) cache.set(levels);
  } catch {
    // offline: keep the cache
  }
}
